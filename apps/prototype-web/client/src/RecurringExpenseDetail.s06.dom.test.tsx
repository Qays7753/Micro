/** @vitest-environment jsdom */
/* S06 (UNIT-019 B4 — عقد الربط الموجود D06): مسار DOM مركزر للوحة «اربط
 * مصروفًا مسجلًا» في تفصيل التذكير — التحميل والاختيار الصريح والربط بلا
 * حدث جديد، وحدود الرفض الصادقة. مراجعة القراءة ١ (R1-F04). */
import React from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { usePrototypeServices } from "@/app/PrototypeServicesContext";
import { MemoryLocalStore } from "@/storage/local/MemoryLocalStore";
import { RecurringExpenseService } from "@/application/recurring/recurringExpenseService";
import { ProjectFinancialService } from "@/application/finance/projectFinancialService";
import { CashContinuityService } from "@/application/cash/cashContinuityService";
import type { RecurringExpenseRuleDraft } from "@micro-domain/recurring-expense/index.js";
import RecurringExpenseDetail from "@/pages/RecurringExpenseDetail";
import { UnsavedChangesProvider } from "@/components/forms/UnsavedChangesGuard";

vi.mock("@/app/PrototypeServicesContext", () => ({
  usePrototypeServices: vi.fn(),
}));

const wouterMocks = vi.hoisted(() => ({
  navigate: vi.fn(),
  location: "/finance/recurring/series-1",
  params: { id: "series-1" } as Record<string, string>,
}));
vi.mock("wouter", () => ({
  useLocation: () => [wouterMocks.location, wouterMocks.navigate],
  useSearch: () => "",
  useParams: () => wouterMocks.params,
}));

const mockedUsePrototypeServices = vi.mocked(usePrototypeServices);
const NOW = "2026-09-21T08:00:00.000Z"; /* عمّان +03: اليوم 2026-09-21 */

let store: MemoryLocalStore;
let service: RecurringExpenseService;
let finance: ProjectFinancialService;

const baseRule: RecurringExpenseRuleDraft = {
  effectiveFromPeriod: "2026-09",
  frequency: "monthly",
  interval: 1,
  anchorDate: "2026-09-01",
  dueDay: 5,
  monthEndPolicy: "last_valid_day",
  timezone: "Asia/Amman",
  amountMode: "suggested",
  suggestedAmountMinor: 25_000,
  suggestedWalletId: null,
  categoryLabel: "إيجار",
  changeReason: null,
};

function buildServices() {
  finance = new ProjectFinancialService(store, () => NOW);
  service = new RecurringExpenseService(store, () => NOW, finance);
  mockedUsePrototypeServices.mockReturnValue({
    recurringExpenses: service,
    projectFinance: finance,
    cashContinuity: new CashContinuityService(store, () => NOW),
    dataVersion: 0,
    notifyDataChanged: vi.fn(),
  } as unknown as ReturnType<typeof usePrototypeServices>);
}

async function seedActiveSeries() {
  const created = await service.createDraft({ title: "إيجار المحل الشهري", rule: baseRule });
  if (!created.ok) throw new Error(created.message);
  const activated = await service.activate(created.value.series.id);
  if (!activated.ok) throw new Error(activated.message);
  return created.value.series.id;
}

async function eventsCount() {
  const events = await store.listFinancialEvents();
  if (!events.ok) throw new Error(events.message);
  return events.value.length;
}

beforeEach(() => {
  store = new MemoryLocalStore();
  wouterMocks.navigate.mockClear();
  buildServices();
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("S06 — لوحة ربط مصروف مسجل بالدورة (D06 / R1-F04)", () => {
  it("المرشحات تُحمّل، والاختيار الصريح يربط بلا حدث جديد، والدورة تقرّ", async () => {
    const seriesId = await seedActiveSeries();
    wouterMocks.params = { id: seriesId };
    /* توليد الفترات (اليوم 2026-09-21 ← فترات سبتمبر/أكتوبر). */
    await service.readDetail(seriesId);
    /* مصروف يدوي داخل فترة سبتمبر — المرشح الصريح للربط. */
    const manual = await finance.record({
      type: "operating_expense_cash",
      amountMinor: 25_000,
      occurredOn: "2026-09-05",
      note: "إيجار سبتمبر — سجلته يدويًا",
      counterparty: null,
      relatedEventId: null,
      expenseContext: {
        relationship: "project",
        behavior: "fixed",
        purpose: "period",
        knowledge: "known",
      },
      idempotencyKey: "manual-september",
    });
    if (!manual.ok) throw new Error(manual.message);
    const before = await eventsCount();

    render(
      <UnsavedChangesProvider navigate={() => undefined}>
        <RecurringExpenseDetail />
      </UnsavedChangesProvider>,
    );
    /* لوحة الفترات: زر الربط ظاهر لدورة سبتمبر المفتوحة. */
    const [linkButton] = await screen.findAllByRole("button", { name: /اربط مصروفًا مسجلًا/ });
    fireEvent.click(linkButton);
    /* المرشح يُعرض بوصفه ومبلغه وتاريخه — اختيار صريح لا تطابقًا آليًا. */
    const candidate = await screen.findByRole("button", { name: /إيجار سبتمبر — سجلته يدويًا/ });
    expect(candidate.textContent).toContain("250.00");
    await userEvent.setup().click(candidate);
    /* القرار يهبط في المخزن (حد الحقيقة) — لوحة المرشحات تُغلق بالقرار. */
    await waitFor(async () => {
      const occurrences = await store.listRecurringExpenseOccurrences();
      if (!occurrences.ok) throw new Error(occurrences.message);
      const september = occurrences.value.find(occurrence => occurrence.periodKey === "2026-09");
      expect(september?.status).toBe("recorded");
      expect(september?.recordedFinancialEventId).toBe(manual.value.id);
    });
    /* لا حدث جديد إطلاقًا: العدد كما كان قبل الربط وبعده. */
    const after = await eventsCount();
    expect(after).toBe(before);
  });

  it("لا مرشحين في الفترة ← إعلان صادق بلا اختراع، وإغلاق اللوحة قرار عرض", async () => {
    const seriesId = await seedActiveSeries();
    wouterMocks.params = { id: seriesId };
    await service.readDetail(seriesId);
    render(
      <UnsavedChangesProvider navigate={() => undefined}>
        <RecurringExpenseDetail />
      </UnsavedChangesProvider>,
    );
    const [linkButton] = await screen.findAllByRole("button", { name: /اربط مصروفًا مسجلًا/ });
    fireEvent.click(linkButton);
    await waitFor(() =>
      expect(screen.getByText(/لا مصروف تشغيل قائم في فترة هذه الدورة يمكن ربطه/)).toBeTruthy(),
    );
    fireEvent.click(screen.getByRole("button", { name: /إغلاق/ }));
    await waitFor(() => expect(screen.queryByText(/لا مصروف تشغيل قائم في فترة هذه الدورة/)).toBeNull());
    expect(await eventsCount()).toBe(0);
  });

  it("فشل قراءة المرشحات يُعلن صراحة لا يُظهر فراغًا كاذبًا", async () => {
    const seriesId = await seedActiveSeries();
    wouterMocks.params = { id: seriesId };
    await service.readDetail(seriesId);
    /* فشل قراءة مفتعل: نستبدل الخدمة بنسخة ترفض القراءة. */
    const failing = service as unknown as {
      listLinkableExpenses: () => Promise<{ ok: false; code: string; message: string }>;
    };
    failing.listLinkableExpenses = () =>
      Promise.resolve({ ok: false, code: "storage_error", message: "تعذر قراءة السجل الآن." });
    render(
      <UnsavedChangesProvider navigate={() => undefined}>
        <RecurringExpenseDetail />
      </UnsavedChangesProvider>,
    );
    const [linkButton] = await screen.findAllByRole("button", { name: /اربط مصروفًا مسجلًا/ });
    fireEvent.click(linkButton);
    await waitFor(() => expect(screen.getByText("تعذر قراءة السجل الآن.")).toBeTruthy());
  });
});
