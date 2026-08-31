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
import { PartyLedgerService } from "@/application/parties/partyLedgerService";
import { UnsavedChangesProvider } from "@/components/forms/UnsavedChangesGuard";
import { MemoryLocalStore } from "@/storage/local/MemoryLocalStore";
import Tools from "@/pages/Tools";
import DraftEditor from "@/pages/DraftEditor";

vi.mock("@/app/PrototypeServicesContext", () => ({
  usePrototypeServices: vi.fn(),
}));

const wouterMocks = vi.hoisted(() => ({ navigate: vi.fn(), location: "/" }));

vi.mock("wouter", () => ({
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

    /* الخطوة ١: زر الجسر موجود في قائمة التقديرات وينتقل لمحرر المسودة. */
    mockedUsePrototypeServices.mockImplementation(
      () =>
        ({
          costEstimates,
          drafts,
          catalog,
          inventory: { readActivation: () => Promise.resolve({ ok: true, value: { activatedOn: null } }) },
          schedules: new ScheduleService(store, () => NOW),
          supplierPurchases: new SupplierPurchaseService(store, () => NOW),
          partyLedger: new PartyLedgerService(store),
          dataVersion: 0,
          notifyDataChanged: vi.fn(),
        }) as unknown as ReturnType<typeof usePrototypeServices>,
    );
    render(<Tools />);
    const bridgeButton = await screen.findByText("ابدأ مسودة من هذا التقدير");
    fireEvent.click(bridgeButton);
    expect(wouterMocks.navigate).toHaveBeenCalledWith(
      `/orders/draft/new?intent=planned_design&estimate=${encodeURIComponent(saved.value.id)}`,
    );

    /* الخطوة ٢: المحرر يفتح على القيم المقترحة، والإشعار يعلن أنها مقترحات. */
    cleanup();
    wouterMocks.location = `/orders/draft/new?intent=planned_design&estimate=${saved.value.id}`;
    render(
      <UnsavedChangesProvider navigate={wouterMocks.navigate}>
        <DraftEditor />
      </UnsavedChangesProvider>,
    );
    await waitFor(() => expect(screen.getByDisplayValue("كيكة مناسبة صغيرة")).toBeTruthy());
    expect(screen.getByText(/القيم المنسوخة مقترحات قابلة للتعديل/)).toBeTruthy();
    /* القيم كلها قابلة للتعديل: حقل الاسم والكمية والملاحظات حقول إدخال فعلية. */
    const nameField = screen.getByDisplayValue("كيكة مناسبة صغيرة") as HTMLInputElement;
    fireEvent.change(nameField, { target: { value: "كيكة معدلة" } });
    await waitFor(() => expect(screen.getByDisplayValue("كيكة معدلة")).toBeTruthy());
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
