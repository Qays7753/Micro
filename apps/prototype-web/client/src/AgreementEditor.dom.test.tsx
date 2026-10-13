/** @vitest-environment jsdom */
/*
 * R10-B4 (F-020 + NF-016، 2026-10-12): اختبار مباشر لمحرر الاتفاق — الصفحة
 * كانت بين الصفحات الثلاث بلا اختبار مباشر (مرجع الاسم في خريطة الاختبار
 * كان إيجابية كاذبة: ذكر اسم الملف داخل جدول حارس). الرحلات هنا تغطي آلة
 * القراءة الصريحة الجديدة: فشل القراءة برسالته الحقيقية بصفة alert مع
 * إعادة محاولة (كان يُدمج مع «التكلفة غير متاحة» بلا alert ولا إعادة)،
 * و«غير موجود» الصادق، والتكلفة غير المتاحة (مسار توجيه سليم مختلف)،
 * والجاهزية مع خطأ التحقق المعلن.
 */
import React from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { usePrototypeServices } from "@/app/PrototypeServicesContext";
import { DraftService } from "@/application/drafts/draftService";
import { CostService } from "@/application/cost/costService";
import { UnsavedChangesProvider } from "@/components/forms/UnsavedChangesGuard";
import { MemoryLocalStore } from "@/storage/local/MemoryLocalStore";
import AgreementEditor from "@/pages/AgreementEditor";

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
const NOW = "2026-10-12T09:00:00.000Z";

let store: MemoryLocalStore;
let currentStore: MemoryLocalStore;
const bumpVersion = vi.fn();

/* فشل قراءة واحد قابل للتعافي — برسالة التخزين الفعلية. */
class FailingDraftReadStore extends MemoryLocalStore {
  failReads = true;
  override async getDraft(id: string) {
    if (this.failReads)
      return { ok: false as const, code: "storage_error" as const, message: "تعذر قراءة المسودة." };
    return super.getDraft(id);
  }
}

function services() {
  return {
    drafts: new DraftService(store, () => NOW),
    costs: new CostService(store, () => NOW),
    /* رحلات القراءة لا تلمس هذه؛ كعبات صادقة الشكل فقط. */
    agreements: { createFromDraft: vi.fn() },
    cashContinuity: { overview: async () => ({ ok: true, value: { wallets: [] } }) },
    projectFinance: {},
    partyLedger: { read: async () => ({ ok: true, value: { parties: [] } }) },
    notifyDataChanged: bumpVersion,
    dataVersion: 0,
  };
}

function Harness() {
  return (
    <UnsavedChangesProvider navigate={wouterMocks.navigate}>
      <AgreementEditor />
    </UnsavedChangesProvider>
  );
}

/* مسودة قائمة بنسخة تكلفة صالحة (وقت معروف واحد) — الجاهزية. */
async function seedDraftWithCost(): Promise<string> {
  const drafts = new DraftService(store, () => NOW);
  const created = await drafts.create("customer_order", { itemName: "رف خشبي" });
  if (!created.ok) throw new Error(created.message);
  const costs = new CostService(store, () => NOW);
  const saved = await costs.saveSnapshot(created.draft, {
    materialItems: [
      {
        name: "خشب",
        quantity: 1,
        unit: "قطعة",
        unitPriceMinor: 300,
        confidence: "known",
      },
    ],
    time: { minutes: 60, hourlyRateMinor: 100, confidence: "known" },
    packagingMinor: 0,
    deliveryMinor: 0,
    wasteMinor: 0,
    safetyBufferMinor: 0,
    quantity: 1,
  });
  if (!saved.ok) throw new Error("cost save failed: " + saved.message);
  return saved.draft.id;
}

/* مسودة قائمة بلا أي نسخة تكلفة — «التكلفة المطلوبة غير متاحة». */
async function seedDraftWithoutCost(): Promise<string> {
  const drafts = new DraftService(store, () => NOW);
  const created = await drafts.create("customer_order", { itemName: "طاولة صغيرة" });
  if (!created.ok) throw new Error(created.message);
  return created.draft.id;
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

describe("R10-B4/NF-016 — AgreementEditor explicit read state machine", () => {
  it("a storage read failure renders its actual message with role=alert and a retry that recovers to the editor", async () => {
    const failStore = new FailingDraftReadStore();
    store = failStore;
    currentStore = failStore;
    mockedUsePrototypeServices.mockReturnValue(
      services() as unknown as ReturnType<typeof usePrototypeServices>,
    );
    wouterMocks.params = { id: "draft-any" };
    render(<Harness />);
    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toContain("تعذر قراءة المسودة.");
    /* لا دمج مع «التكلفة غير متاحة» — رسالة الفشل الفعلية وحدها. */
    expect(alert.textContent).not.toContain("التكلفة المطلوبة غير متاحة");
    /* التعافي: إعادة المحاولة تعيد القراءة فتنجح إلى الجاهزية. */
    failStore.failReads = false;
    const seeded = await seedDraftWithCost();
    wouterMocks.params = { id: seeded };
    fireEvent.click(screen.getByRole("button", { name: "إعادة المحاولة" }));
    await waitFor(() => {
      expect(screen.getByText("سجّل ما اتفقت عليه")).toBeTruthy();
    });
  });

  it("an unknown draft id shows the honest not-found message on the read-error surface (R9 canonical)", async () => {
    wouterMocks.params = { id: "missing-draft" };
    render(<Harness />);
    /* «غير موجود» رسالة صادقة على سطح خطأ القراءة نفسه (نمط R9-GA-F3.7):
     * alert + إعادة محاولة + مخرج قانوني — لا سطحًا منفصلًا بلا إعلان. */
    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toContain("لم نجد هذه المسودة");
    expect(alert.textContent).toContain("قد تكون حذفت محليًا أو أصبحت طلبًا محفوظًا");
    expect(screen.getByRole("button", { name: "إعادة المحاولة" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "العودة للطلبات" }));
    expect(wouterMocks.navigate).toHaveBeenCalledWith("/orders");
  });

  it("a draft without a valid cost snapshot keeps its distinct guidance surface with the cost action", async () => {
    const draftId = await seedDraftWithoutCost();
    wouterMocks.params = { id: draftId };
    render(<Harness />);
    const heading = await screen.findByRole("heading", { name: "التكلفة المطلوبة غير متاحة" });
    expect(heading).toBeTruthy();
    expect(screen.getByText("احفظ نسخة تكلفة صالحة قبل تسجيل الاتفاق.")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "فتح التكلفة" }));
    expect(wouterMocks.navigate).toHaveBeenCalledWith(`/orders/draft/${draftId}/cost`);
  });

  it("a draft with a valid cost snapshot reaches the ready editor; a premature save announces the validation error", async () => {
    const draftId = await seedDraftWithCost();
    wouterMocks.params = { id: draftId };
    render(<Harness />);
    await waitFor(() => {
      expect(screen.getByText("سجّل ما اتفقت عليه")).toBeTruthy();
    });
    /* السعر فارغ — التسجيل المبكر يُعلن خطأ التحقق (قناة الخطأ الصريحة). */
    fireEvent.click(screen.getByRole("button", { name: /تسجيل الاتفاق/ }));
    const error = await screen.findByRole("alert");
    expect(error.textContent).toContain("السعر المتفق عليه");
  });
});
