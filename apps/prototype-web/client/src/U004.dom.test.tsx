/** @vitest-environment jsdom */

/* U-004: جسر «ابدأ مسودة من هذا التقدير» — القيم المنسوخة مقترحات قابلة للتعديل،
 * والتقدير لا يتغير، ولا تُنشأ أي حركة مالية. */
import React from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { usePrototypeServices } from "@/app/PrototypeServicesContext";
import { CostEstimateService } from "@/application/estimates/costEstimateService";
import { DraftService } from "@/application/drafts/draftService";
import { CatalogService } from "@/application/catalog/catalogService";
import { ScheduleService } from "@/application/scheduling/scheduleService";
import { SupplierPurchaseService } from "@/application/suppliers/supplierPurchaseService";
import { PartyDirectoryService } from "@/application/parties/partyLedgerService";
import { UnsavedChangesProvider } from "@/components/forms/UnsavedChangesGuard";
import { MemoryLocalStore } from "@/storage/local/MemoryLocalStore";
import Tools from "@/pages/Tools";
import DraftEditor from "@/pages/DraftEditor";
import { FormDraftService } from "@/application/drafts/formDraftService";

vi.mock("@/app/PrototypeServicesContext", () => ({
  usePrototypeServices: vi.fn(),
}));

const wouterMocks = vi.hoisted(() => ({ navigate: vi.fn(), location: "/" }));

vi.mock("wouter", () => ({
  /* و٥-ب (مجموعة ٣): المحاكاة أمينة — الاستعلام من useSearch كما في المتصفح الحقيقي. */
  useSearch: () => {
    const query = wouterMocks.location.split("?")[1] ?? "";
    return query ? `?${query}` : "";
  },
  useLocation: () => [wouterMocks.location, wouterMocks.navigate],
  useParams: () => ({ id: "new" }),
}));

const mockedUsePrototypeServices = vi.mocked(usePrototypeServices);
const NOW = "2026-08-29T09:00:00.000Z";
let store: MemoryLocalStore;
let costEstimates: CostEstimateService;
let drafts: DraftService;
let catalog: CatalogService;

const estimateInput = {
  title: "كيكة مناسبة صغيرة",
  materialItems: [
    { name: "دقيق", quantity: 2, unit: "كيلو", unitPriceMinor: 150, confidence: "known" as const },
  ],
  time: { minutes: 90, hourlyRateMinor: 500, confidence: "known" as const },
  packagingMinor: 200,
  deliveryMinor: 0,
  wasteMinor: 0,
  safetyBufferMinor: 100,
  quantity: 1,
  note: null,
};

describe("U-004 estimate-to-draft bridge", () => {
  beforeEach(() => {
    store = new MemoryLocalStore();
    costEstimates = new CostEstimateService(store, () => NOW);
    drafts = new DraftService(store, () => NOW);
    catalog = new CatalogService(store, () => NOW);
    wouterMocks.location = "/tools";
    wouterMocks.navigate.mockClear();
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it("starts a prefilled editable draft from a saved estimate without touching the estimate", async () => {
    const saved = await costEstimates.save(estimateInput);
    if (!saved.ok) throw new Error("estimate should save");

    /* S10 (UNIT-030 — أمر b56967d8، U030-ACD06): مدخل الجسر من أدوات
     * التخطيط أُزيل من التجربة الجديدة (لا جسر أداة→معاملة) — يعمل الفحص
     * على عقد URL نفسه الذي يملكه مسار الطلب؛ والمدخل لا يعود للأدوات. */
    mockedUsePrototypeServices.mockImplementation(
      () =>
        ({
          costEstimates,
          drafts,
          catalog,
          formDrafts: new FormDraftService(store),
          inventory: { readActivation: () => Promise.resolve({ ok: true, value: { activatedOn: null } }) },
          schedules: new ScheduleService(store, () => NOW),
          supplierPurchases: new SupplierPurchaseService(store, () => NOW),
          partyDirectory: new PartyDirectoryService(store, () => NOW),
          dataVersion: 0,
          notifyDataChanged: vi.fn(),
        }) as unknown as ReturnType<typeof usePrototypeServices>,
    );
    render(<Tools />);
    expect(screen.queryByText("ابدأ مسودة من هذا التقدير")).toBeNull();
    cleanup();
    /* الوصلة العميقة نفسها ما زالت تعمل عند الوصول إليها مباشرة (عقد مسار
     * الطلب) — البذرة قيم مقترحة قابلة للتعديل والمصدر محفوظ. */
    wouterMocks.location = `/orders/draft/new?intent=planned_design&estimate=${encodeURIComponent(saved.value.id)}&returnTo=%2Ftools`;

    /* الخطوة ٢: المحرر يفتح على القيم المقترحة، والإشعار يعلن أنها مقترحات. */
    cleanup();
    wouterMocks.location = `/orders/draft/new?intent=planned_design&estimate=${saved.value.id}`;
    render(
      <UnsavedChangesProvider navigate={wouterMocks.navigate}>
        <DraftEditor />
      </UnsavedChangesProvider>,
    );
    await waitFor(() => expect(screen.getByPlaceholderText("مثال: صندوق خشبي مخصص")).toBeTruthy());
    expect(screen.getByText(/القيم المنسوخة مقترحات قابلة للتعديل/)).toBeTruthy();
    /* القيم كلها قابلة للتعديل: حقل الاسم والكمية والملاحظات حقول إدخال فعلية.
     * S09: حقل وصف القطعة يُستعلم بوسمه الفريد — قسم «حفظ لاستخدامه مرة أخرى»
     * يعرض بعد الحفظ اسم العرض مبدئيًا من الوصف نفسه (U029-R02) فيتطابق
     * عرض القيمتين بلا التباس. */
    const nameField = screen.getByPlaceholderText("مثال: صندوق خشبي مخصص") as HTMLInputElement;
    expect((nameField as HTMLInputElement).value).toBe("كيكة مناسبة صغيرة");
    fireEvent.change(nameField, { target: { value: "كيكة معدلة" } });
    await waitFor(() => expect((nameField as HTMLInputElement).value).toBe("كيكة معدلة"));
    /* حفظ التعديل يثبّته في المسودة نفسها — لا مسودة ثانية. */
    fireEvent.click(screen.getByText("حفظ مسودة"));
    await waitFor(() => expect(screen.getByText("تم حفظ المسودة على هذا الجهاز.")).toBeTruthy());

    /* المسودة تُنشأ فعليًا بقيم التقدير وبمرجع المصدر — بلا أي حدث مالي. */
    const draftList = await store.listDrafts();
    if (!draftList.ok) throw new Error("drafts should list");
    expect(draftList.value.length).toBe(1);
    expect(draftList.value[0]).toMatchObject({
      itemName: "كيكة معدلة",
      quantity: 1,
      sourceEstimateId: saved.value.id,
    });
    /* التقدير نفسه لم يتغير. */
    const estimateAfter = await costEstimates.get(saved.value.id);
    if (!estimateAfter.ok || !estimateAfter.value) throw new Error("estimate should read");
    expect(estimateAfter.value).toEqual(saved.value);
    /* لا أحداث مالية ولا حركات كاش — المسودة والتقدير غير ماليين. */
    const events = await store.listFinancialEvents();
    const cash = await store.listCashContinuityEntries();
    if (!events.ok || !cash.ok) throw new Error("stores should read");
    expect(events.value.length).toBe(0);
    expect(cash.value.length).toBe(0);
  });

  it("falls back honestly to an empty draft when the referenced estimate no longer exists", async () => {
    wouterMocks.location = `/orders/draft/new?intent=planned_design&estimate=deleted-estimate`;
    mockedUsePrototypeServices.mockImplementation(
      () =>
        ({
          costEstimates,
          drafts,
          catalog,
          formDrafts: new FormDraftService(store),
          dataVersion: 0,
          notifyDataChanged: vi.fn(),
        }) as unknown as ReturnType<typeof usePrototypeServices>,
    );
    render(
      <UnsavedChangesProvider navigate={wouterMocks.navigate}>
        <DraftEditor />
      </UnsavedChangesProvider>,
    );
    await waitFor(() =>
      expect(
        screen.getByText("لم نجد التقدير المشار إليه (قد حُذف)؛ بدأت المسودة فارغة ولم يُنشأ شيء."),
      ).toBeTruthy(),
    );
    const draftList = await store.listDrafts();
    if (!draftList.ok) throw new Error("drafts should list");
    expect(draftList.value.length).toBe(0);
  });
});
