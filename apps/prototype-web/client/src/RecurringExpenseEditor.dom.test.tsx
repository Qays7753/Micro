/** @vitest-environment jsdom */
/*
 * R9-GA-F3.7 (WS-216/ARCH-007 — استمرار R9 الجذري): اختبار مباشر لآلة حالة
 * القراءة في محرر التذكير المتكرر — كان فشل القراءة (وعدم وجود السلسلة)
 * يضبط الرسالة دون رفع «loaded» فتبقى الصفحة في التحميل الأبدي والرسالة
 * لا تُعرض أبدًا. الحدود المختبرة عبر الخدمة الحقيقية فوق مخزن الذاكرة:
 * الفشل يُعرض برسالته الفعلية بصفة alert مع إعادة محاولة، والتحميل ينتهي
 * دائمًا، ولا حفظ خارج الجاهزية.
 */
import React from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { usePrototypeServices } from "@/app/PrototypeServicesContext";
import { RecurringExpenseService } from "@/application/recurring/recurringExpenseService";
import { UnsavedChangesProvider } from "@/components/forms/UnsavedChangesGuard";
import { MemoryLocalStore } from "@/storage/local/MemoryLocalStore";
import RecurringExpenseEditor from "@/pages/RecurringExpenseEditor";

vi.mock("@/app/PrototypeServicesContext", () => ({
  usePrototypeServices: vi.fn(),
  getPrototypeLocalStore: () => currentStore,
}));

const wouterMocks = vi.hoisted(() => ({
  navigate: vi.fn(),
  location: "/",
  params: {} as Record<string, string>,
  search: "",
}));
vi.mock("wouter", () => ({
  useLocation: () => [wouterMocks.location, wouterMocks.navigate],
  useParams: () => wouterMocks.params,
  useSearch: () => wouterMocks.search,
}));

const mockedUsePrototypeServices = vi.mocked(usePrototypeServices);
const NOW = "2026-10-11T09:00:00.000Z";

let store: MemoryLocalStore;
let currentStore: MemoryLocalStore;
const bumpVersion = vi.fn();

/* فشل قراءة واحد ثم نجاح عند إعادة المحاولة — برسالة الخدمة الفعلية،
 * والعلم داخل الاختبار وحده لا في الصفحة. */
class FailingSeriesReadStore extends MemoryLocalStore {
  failReads = true;
  override async listRecurringExpenseSeries() {
    if (this.failReads)
      return { ok: false as const, code: "storage_error" as const, message: "تعذر قراءة التذكيرات." };
    return super.listRecurringExpenseSeries();
  }
}

function services() {
  return {
    recurringExpenses: new RecurringExpenseService(store, () => NOW),
    notifyDataChanged: bumpVersion,
    dataVersion: 0,
  };
}

function Harness() {
  return (
    <UnsavedChangesProvider navigate={wouterMocks.navigate}>
      <RecurringExpenseEditor />
    </UnsavedChangesProvider>
  );
}

async function seedSeries() {
  const service = new RecurringExpenseService(store, () => NOW);
  const created = await service.createDraft({
    title: "إيجار المحل",
    rule: {
      effectiveFromPeriod: "2026-09",
      frequency: "monthly",
      interval: 1,
      anchorDate: "2026-09-01",
      dueDay: 5,
      monthEndPolicy: "last_valid_day",
      timezone: "Asia/Amman",
      amountMode: "manual",
      suggestedAmountMinor: null,
      suggestedWalletId: null,
      categoryLabel: null,
      changeReason: null,
    },
  });
  if (!created.ok) throw new Error(created.message);
  return created.value.series.id;
}

beforeEach(() => {
  store = new MemoryLocalStore();
  currentStore = store;
  wouterMocks.search = "";
  wouterMocks.params = {};
  wouterMocks.navigate.mockReset();
  bumpVersion.mockReset();
  mockedUsePrototypeServices.mockReturnValue(
    services() as unknown as ReturnType<typeof usePrototypeServices>,
  );
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("RecurringExpenseEditor — explicit read state machine (R9-GA-F3.7)", () => {
  it("an unknown series id in edit mode ends loading and shows the actual service message with role=alert plus retry — no infinite loading", async () => {
    wouterMocks.params = { id: "missing-series" };
    render(<Harness />);
    expect(screen.getByRole("status")).toBeTruthy();
    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toContain("سلسلة المصروف المتكرر غير موجودة.");
    expect(screen.queryByRole("status")).toBeNull();
    expect(wouterMocks.navigate).not.toHaveBeenCalled();
    expect(bumpVersion).not.toHaveBeenCalled();
  });

  it("a storage read failure renders its actual message with role=alert, and retry after recovery reaches the ready editor", async () => {
    const failStore = new FailingSeriesReadStore();
    store = failStore;
    currentStore = failStore;
    mockedUsePrototypeServices.mockReturnValue(
      services() as unknown as ReturnType<typeof usePrototypeServices>,
    );
    const seriesId = await seedSeries();
    wouterMocks.params = { id: seriesId };
    render(<Harness />);
    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toContain("تعذر قراءة سجل المصروف المتكرر.");
    expect(screen.queryByRole("status")).toBeNull();
    /* إعادة المحاولة بعد زوال الفشل تعود إلى الجاهزية بصدق. */
    failStore.failReads = false;
    fireEvent.click(screen.getByRole("button", { name: "إعادة المحاولة" }));
    expect(await screen.findByRole("heading", { name: "غيّر قاعدة المستقبل فقط" })).toBeTruthy();
    await waitFor(() => {
      expect(screen.queryByRole("alert")).toBeNull();
    });
  });

  it("create mode renders the ready form immediately with no read surface", async () => {
    wouterMocks.params = {};
    render(<Harness />);
    expect(await screen.findByRole("heading", { name: "ما المصروف الذي يتكرر عليك؟" })).toBeTruthy();
    expect(screen.queryByRole("alert")).toBeNull();
    expect(screen.queryByRole("status")).toBeNull();
  });
});
