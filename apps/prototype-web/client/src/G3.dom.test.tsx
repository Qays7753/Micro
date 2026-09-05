/** @vitest-environment jsdom */

/* المجموعة ٣ (§14 — اختبارات السطوح): الحاسبة والتقدير والكتالوج→البيع —
 * التقدير بلا أثر مالي، السعر الفعلي بيد المالك، إغلاق واقعي بعد البيع،
 * تخصيص صريح بلا تكرار، ورجوع محفوظ لكل مسار جديد. */
import React from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { usePrototypeServices } from "@/app/PrototypeServicesContext";
import { CostEstimateService } from "@/application/estimates/costEstimateService";
import { DraftService } from "@/application/drafts/draftService";
import { CatalogService } from "@/application/catalog/catalogService";
import { RecurringWorkService } from "@/application/recurring-work/recurringWorkService";
import { DirectSaleService } from "@/application/direct-sales/directSaleService";
import { ProjectFinancialService } from "@/application/finance/projectFinancialService";
import { CashContinuityService } from "@/application/cash/cashContinuityService";
import { CostService } from "@/application/cost/costService";
import { AgreementService } from "@/application/agreements/agreementService";
import { AgreementContextService } from "@/application/agreements/agreementContextService";
import { FulfillmentService } from "@/application/fulfillment/fulfillmentService";
import { InventoryMaterialService } from "@/application/inventory/inventoryMaterialService";
import { ActualTimeService } from "@/application/time/actualTimeService";
import { ScheduleService } from "@/application/scheduling/scheduleService";
import { SupplierPurchaseService } from "@/application/suppliers/supplierPurchaseService";
import { PartyLedgerService } from "@/application/parties/partyLedgerService";
import { UnsavedChangesProvider } from "@/components/forms/UnsavedChangesGuard";
import { MemoryLocalStore } from "@/storage/local/MemoryLocalStore";
import { FormDraftService } from "@/application/drafts/formDraftService";
import CostCalculator from "@/pages/CostCalculator";
import EstimateDetail from "@/pages/EstimateDetail";
import Tools from "@/pages/Tools";
import Catalog from "@/pages/Catalog";
import DirectSaleEditor from "@/pages/DirectSaleEditor";
import OrderDetail from "@/pages/OrderDetail";
import { createCashWallet } from "@micro-domain/cash-continuity/index.js";

vi.mock("@/app/PrototypeServicesContext", () => ({
  usePrototypeServices: vi.fn(),
}));

const wouterMocks = vi.hoisted(() => ({
  navigate: vi.fn(),
  location: "/tools/calculator",
  params: {} as Record<string, string>,
}));
vi.mock("wouter", () => ({
  useLocation: () => [wouterMocks.location, wouterMocks.navigate],
  useParams: () => wouterMocks.params,
  /* و٥-ب: المحاكاة أمينة لواقع wouter — الاستعلام جزء من useSearch لا من المسار. */
  useSearch: () => {
    const query = wouterMocks.location.split("?")[1] ?? "";
    return query ? `?${query}` : "";
  },
}));

const mockedUsePrototypeServices = vi.mocked(usePrototypeServices);
const NOW = "2026-09-02T10:00:00.000Z";

let store: MemoryLocalStore;
let costEstimates: CostEstimateService;
let drafts: DraftService;
let catalog: CatalogService;
let costs: CostService;
let agreements: AgreementService;
let fulfillment: FulfillmentService;
const contextRef: { current: Record<string, unknown> } = { current: {} };

function G3Harness({ page }: { page: React.ReactNode }) {
  const [version, setVersion] = React.useState(0);
  contextRef.current = {
    formDrafts: new FormDraftService(store),
    costEstimates,
    drafts,
    catalog,
    costs,
    agreements,
    fulfillment,
    recurringWork: new RecurringWorkService(store, () => NOW),
    directSales: new DirectSaleService(store, () => NOW),
    projectFinance: new ProjectFinancialService(store, () => NOW),
    cashContinuity: new CashContinuityService(store, () => NOW),
    agreementContext: new AgreementContextService(store, () => NOW),
    inventory: new InventoryMaterialService(store, () => NOW),
    actualTime: new ActualTimeService(store, () => NOW),
    schedules: new ScheduleService(store, () => NOW),
    supplierPurchases: new SupplierPurchaseService(store, () => NOW),
    partyLedger: new PartyLedgerService(store),
    dataVersion: version,
    notifyDataChanged: () => setVersion(current => current + 1),
  };
  return <UnsavedChangesProvider navigate={wouterMocks.navigate}>{page}</UnsavedChangesProvider>;
}

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

describe("G3 — Group 3 surfaces: calculator, estimates, product-to-sale", () => {
  beforeEach(() => {
    store = new MemoryLocalStore();
    costEstimates = new CostEstimateService(store, () => NOW);
    drafts = new DraftService(store, () => NOW);
    catalog = new CatalogService(store, () => NOW);
    costs = new CostService(store, () => NOW);
    agreements = new AgreementService(store, costs, () => NOW);
    fulfillment = new FulfillmentService(store, () => NOW);
    wouterMocks.location = "/tools/calculator";
    wouterMocks.params = {};
    wouterMocks.navigate.mockReset();
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it("calculator: live result with honest unknowns, save with zero financial effect, then next actions", async () => {
    wouterMocks.location = "/tools/calculator?from=%2Ftools";
    mockedUsePrototypeServices.mockImplementation(
      () => contextRef.current as unknown as ReturnType<typeof usePrototypeServices>,
    );
    render(<G3Harness page={<CostCalculator />} />);
    await screen.findByRole("heading", { name: "حاسبة التكلفة والسعر" });
    /* §7.3: القاعدة معلنة قبل أي رقم — في البطاقة وفي سطر النتيجة معًا. */
    expect(
      screen.getAllByText("هذا حساب تقديري. ما انحفظت أي حركة مالية ولا مخزون.").length,
    ).toBeGreaterThan(0);
    /* §7.2: المجهول معلن — وقت العمل غير مُدخل لا يصير صفرًا. */
    expect(screen.getByText("وقت العمل غير مُدخل — النتيجة بلا أجر وقتك.")).toBeTruthy();

    fireEvent.change(screen.getByPlaceholderText("مثال: كيكة مناسبة صغيرة"), {
      target: { value: "كيكة اختبار" },
    });
    fireEvent.change(screen.getByPlaceholderText("مثال: دقيق"), { target: { value: "دقيق" } });
    fireEvent.change(screen.getByLabelText("سعر وحدة المادة 1"), { target: { value: "5.00" } });
    /* النتيجة الحية تتحدث أثناء الكتابة. */
    await waitFor(() => expect(screen.getAllByText("5.00").length).toBeGreaterThan(0));

    fireEvent.click(screen.getByRole("button", { name: "احفظ التقدير لمراجعته لاحقًا" }));
    await waitFor(() => expect(screen.getByText(/حُفظ التقدير لمراجعته لاحقًا/)).toBeTruthy());
    const list = await costEstimates.list();
    if (!list.ok) throw new Error(list.message);
    expect(list.value).toHaveLength(1);
    /* §7.5: بعد الحفظ — فتح التقدير أو بدء مسودة، لا «أنشئ بيعًا» تلقائيًا. */
    expect(screen.getByRole("button", { name: "افتح التقدير" })).toBeTruthy();
    const bridgeButton = screen.getByRole("button", { name: "ابدأ مسودة من هذا التقدير" });
    expect(bridgeButton).toBeTruthy();
    /* رحلة §12: بدء المسودة من الحاسبة يعود إلى التقدير نفسه عند الرجوع. */
    const estimateId = list.value[0]!.id;
    fireEvent.click(bridgeButton);
    expect(wouterMocks.navigate).toHaveBeenCalledWith(
      `/orders/draft/new?intent=planned_design&estimate=${estimateId}&from=%2Ftools%2Festimate%2F${estimateId}`,
    );

    /* الحكم الحاسم: لا حدث مالي ولا حركة كاش ولا مخزون. */
    const events = await store.listFinancialEvents();
    const cash = await store.listCashContinuityEntries();
    const movements = await store.listInventoryMovements();
    if (!events.ok || !cash.ok || !movements.ok) throw new Error("stores should read");
    expect(events.value).toHaveLength(0);
    expect(cash.value).toHaveLength(0);
    expect(movements.value).toHaveLength(0);
  });

  it("estimate detail: inputs/result/qualifier, start-draft bridge preserves the estimate as referrer, edit link keeps context", async () => {
    const saved = await costEstimates.save(estimateInput);
    if (!saved.ok) throw new Error(saved.message);
    wouterMocks.location = `/tools/estimate/${saved.value.id}?from=%2Ftools`;
    wouterMocks.params = { id: saved.value.id };
    mockedUsePrototypeServices.mockImplementation(
      () => contextRef.current as unknown as ReturnType<typeof usePrototypeServices>,
    );
    render(<G3Harness page={<EstimateDetail />} />);
    await screen.findByRole("heading", { name: "كيكة مناسبة صغيرة" });
    /* المدخلات تظهر كما حُفظت. */
    expect(screen.getByText("دقيق")).toBeTruthy();
    /* §8.1: المؤهل الصريح — أداة تفكير بلا أثر مالي. */
    expect(
      screen.getByText("هذا التقدير أداة تفكير — لا حدث مالي ولا مخزون ولا التزام مرتبط به."),
    ).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "ابدأ مسودة من هذا التقدير" }));
    expect(wouterMocks.navigate).toHaveBeenCalledWith(
      `/orders/draft/new?intent=planned_design&estimate=${saved.value.id}&from=%2Ftools%2Festimate%2F${saved.value.id}`,
    );

    fireEvent.click(screen.getByRole("button", { name: "عدّل التقدير" }));
    expect(wouterMocks.navigate).toHaveBeenCalledWith(
      `/tools/calculator?estimate=${saved.value.id}&from=%2Ftools%2Festimate%2F${saved.value.id}`,
    );
  });

  it("calculator edit mode (?estimate=) loads the original and updates it in place — no duplicate", async () => {
    const saved = await costEstimates.save(estimateInput);
    if (!saved.ok) throw new Error(saved.message);
    wouterMocks.location = `/tools/calculator?estimate=${saved.value.id}&from=%2Ftools%2Festimate%2F${saved.value.id}`;
    mockedUsePrototypeServices.mockImplementation(
      () => contextRef.current as unknown as ReturnType<typeof usePrototypeServices>,
    );
    render(<G3Harness page={<CostCalculator />} />);
    await screen.findByDisplayValue("كيكة مناسبة صغيرة");
    await screen.findByDisplayValue("دقيق");
    expect((screen.getByLabelText("سعر وحدة المادة 1") as HTMLInputElement).value).toBe("1.50");

    fireEvent.change(screen.getByLabelText("سعر وحدة المادة 1"), { target: { value: "20.00" } });
    fireEvent.click(screen.getByRole("button", { name: "احفظ التعديلات على هذا التقدير" }));
    await waitFor(() => expect(screen.getByText(/حُفظ تعديل التقدير/)).toBeTruthy());

    const list = await costEstimates.list();
    if (!list.ok) throw new Error(list.message);
    expect(list.value).toHaveLength(1);
    expect(list.value[0]!.id).toBe(saved.value.id);
    /* مواد 2×20.00=4000 + وقت 90د×5.00=750 + تغليف 2.00 = 4950. */
    expect(list.value[0]!.plannedCostMinor).toBe(4950);
    const events = await store.listFinancialEvents();
    if (!events.ok) throw new Error("events should read");
    expect(events.value).toHaveLength(0);
  });

  it("tools list: the estimate row opens its detail page with tools as referrer", async () => {
    const saved = await costEstimates.save(estimateInput);
    if (!saved.ok) throw new Error(saved.message);
    wouterMocks.location = "/tools";
    mockedUsePrototypeServices.mockImplementation(
      () => contextRef.current as unknown as ReturnType<typeof usePrototypeServices>,
    );
    render(<G3Harness page={<Tools />} />);
    await screen.findByText("تقديراتي المحفوظة");
    fireEvent.click(screen.getByRole("button", { name: "كيكة مناسبة صغيرة" }));
    expect(wouterMocks.navigate).toHaveBeenCalledWith(
      `/tools/estimate/${saved.value.id}?from=%2Ftools`,
    );
    /* بطاقة الحاسبة تفتح المسار العميق وتحفظ أدواتي مصدرًا. */
    fireEvent.click(screen.getByRole("button", { name: /افتح الحاسبة/ }));
    expect(wouterMocks.navigate).toHaveBeenCalledWith("/tools/calculator?from=%2Ftools");
  });

  it("catalog row sell action opens the sale editor with the product preselected and the catalog as referrer", async () => {
    const created = await catalog.create({
      kind: "product",
      name: "صابون غار",
      unitLabel: null,
      defaultPriceMinor: 700,
      defaultUnitCostMinor: 300,
      operationKey: "g3-catalog-1",
    });
    if (!created.ok) throw new Error(created.message);
    wouterMocks.location = "/catalog?from=%2Ftools";
    mockedUsePrototypeServices.mockImplementation(
      () => contextRef.current as unknown as ReturnType<typeof usePrototypeServices>,
    );
    render(<G3Harness page={<Catalog />} />);
    const sellButton = await screen.findByRole("button", { name: "سجّل بيع هذا المنتج" });
    fireEvent.click(sellButton);
    expect(wouterMocks.navigate).toHaveBeenCalledWith(
      `/direct-sales/new?product=${created.item.id}&from=%2Fcatalog`,
    );
  });

  it("product-to-sale: prefilled suggestions, owner overrides the price, one sale, attributed cash, factual closure", async () => {
    const created = await catalog.create({
      kind: "product",
      name: "صابون غار",
      unitLabel: null,
      defaultPriceMinor: 700,
      defaultUnitCostMinor: 300,
      operationKey: "g3-catalog-2",
    });
    if (!created.ok) throw new Error(created.message);
    const wallet = createCashWallet({
      id: "g3-drawer",
      name: "درج البيت",
      kind: "cash_drawer",
      createdAt: NOW,
      createdOperationKey: "g3-drawer-key",
    });
    const walletSaved = await store.commitCashContinuity(wallet, []);
    if (!walletSaved.ok) throw new Error(walletSaved.message);

    wouterMocks.location = `/direct-sales/new?product=${created.item.id}&from=%2Fcatalog`;
    mockedUsePrototypeServices.mockImplementation(
      () => contextRef.current as unknown as ReturnType<typeof usePrototypeServices>,
    );
    render(<G3Harness page={<DirectSaleEditor />} />);
    await screen.findByRole("heading", { name: "تسجيل بيع مباشر" });
    /* §10.1: المرجع مُختار مسبقًا واقتراحاته معلنة. */
    await waitFor(() =>
      expect((screen.getByLabelText("ربط مرجع") as HTMLSelectElement).value).toBe(created.item.id),
    );
    expect((screen.getByPlaceholderText("مثال: كوب جاهز") as HTMLInputElement).value).toBe(
      "صابون غار",
    );
    await waitFor(() =>
      expect((screen.getByLabelText("السعر المتفق عليه") as HTMLInputElement).value).toBe("7.00"),
    );
    expect(screen.getByText(/سعر مقترح من المرجع/)).toBeTruthy();
    /* وجهة القبض: الدرج افتراضيًا حين يوجد. */
    await waitFor(() =>
      expect((screen.getByLabelText("وجهة القبض") as HTMLSelectElement).value).toBe("g3-drawer"),
    );

    /* §10.3: تجاوز السعر — السعر الفعلي هو المرجع النهائي. */
    fireEvent.change(screen.getByLabelText("السعر المتفق عليه"), { target: { value: "9.50" } });
    fireEvent.click(screen.getByRole("button", { name: "حفظ البيع المباشر" }));

    /* §10.4: إغلاق واقعي — ما بيع والسعر الفعلي وأثر الكاش. */
    await screen.findByRole("heading", { name: "سُجّل البيع" });
    expect(screen.getByText("صابون غار")).toBeTruthy();
    expect(screen.getByText(/قُبض المبلغ كاملًا/)).toBeTruthy();

    const sales = await store.listDirectSales();
    if (!sales.ok) throw new Error(sales.message);
    expect(sales.value).toHaveLength(1);
    expect(sales.value[0]).toMatchObject({
      catalogItemId: created.item.id,
      revenueMinor: 950,
      collectedMinor: 950,
      costMinor: 300,
    });
    /* لا حدث مالي — البيع المباشر سجله المالي نفسه (مسار المجموعة ٢). */
    const events = await store.listFinancialEvents();
    if (!events.ok) throw new Error(events.message);
    expect(events.value).toHaveLength(0);
    /* تخصيص واحد صريح بمصدر البيع — لا تكرار. */
    const entries = await store.listCashContinuityEntries();
    if (!entries.ok) throw new Error(entries.message);
    const allocations = entries.value.filter(entry => entry.type === "allocation");
    expect(allocations).toHaveLength(1);
    expect(allocations[0]!.cashDeltaMinor).toBe(950);
    expect(allocations[0]!.sourceRefId).toBe(sales.value[0]!.id);
    expect(allocations[0]!.sourceRefKind).toBe("sale");
  });

  it("product deep link to an inactive reference degrades honestly without prefill", async () => {
    const created = await catalog.create({
      kind: "product",
      name: "شمعة موقوفة",
      unitLabel: null,
      defaultPriceMinor: 400,
      operationKey: "g3-catalog-3",
    });
    if (!created.ok) throw new Error(created.message);
    const deactivated = await catalog.deactivate(created.item.id);
    if (!deactivated.ok) throw new Error(deactivated.message);

    wouterMocks.location = `/direct-sales/new?product=${created.item.id}&from=%2Fcatalog`;
    mockedUsePrototypeServices.mockImplementation(
      () => contextRef.current as unknown as ReturnType<typeof usePrototypeServices>,
    );
    render(<G3Harness page={<DirectSaleEditor />} />);
    await screen.findByRole("heading", { name: "تسجيل بيع مباشر" });
    await waitFor(() => expect(screen.getByText(/هذا المرجع موقوف/)).toBeTruthy());
    expect((screen.getByLabelText("ربط مرجع") as HTMLSelectElement).value).toBe("");
    expect((screen.getByLabelText("السعر المتفق عليه") as HTMLInputElement).value).toBe("0.00");
  });

  it("order detail: source estimate link and real correction-event labels in the order log", async () => {
    /* جسر كامل: تقدير → مسودة → اتفاق → طلب؛ ثم تصحيح سعر موثق. */
    const savedEstimate = await costEstimates.save(estimateInput);
    if (!savedEstimate.ok) throw new Error(savedEstimate.message);
    const draftCreated = await drafts.create("customer_order", {
      itemName: "طقم مطرز",
      customerName: "سارة",
      specifications: "اختبار جسر التقدير",
      quantity: 1,
      sourceEstimateId: savedEstimate.value.id,
    });
    if (!draftCreated.ok) throw new Error(draftCreated.message);
    const costSaved = await costs.saveSnapshot(draftCreated.draft, {
      materialItems: [
        { name: "خيط", quantity: 1, unit: "قطعة", unitPriceMinor: 300, confidence: "known" },
      ],
      time: { minutes: 60, hourlyRateMinor: 500, confidence: "known" },
      packagingMinor: 0,
      deliveryMinor: 0,
      wasteMinor: 0,
      safetyBufferMinor: 0,
      quantity: 1,
    });
    if (!costSaved.ok) throw new Error(costSaved.message);
    const agreement = await agreements.createFromDraft(costSaved.draft, {
      agreedPriceMinor: 10000,
      deliveryDate: "2026-09-10",
      depositMinor: 0,
      agreementSource: "whatsapp",
    });
    if (!agreement.ok) throw new Error(agreement.message);
    const orderId = agreement.stored.id;
    const revised = await fulfillment.revisePrice(orderId, {
      newPriceMinor: 11000,
      reason: "العميلة طلفت إضافة",
    });
    if (!revised.ok) throw new Error(revised.message);

    wouterMocks.location = `/orders/${orderId}?from=%2Forders`;
    wouterMocks.params = { id: orderId };
    mockedUsePrototypeServices.mockImplementation(
      () => contextRef.current as unknown as ReturnType<typeof usePrototypeServices>,
    );
    render(<G3Harness page={<OrderDetail />} />);
    await screen.findByRole("heading", { name: /طقم مطرز/ });
    /* §11.3: تفاصيل إضافية تحمل المصدر والتسميات الحقيقية للتصحيحات. */
    fireEvent.click(screen.getByText("تفاصيل إضافية"));
    await waitFor(() => expect(screen.getByText("المصدر: تقدير")).toBeTruthy());
    expect(screen.getByText(/بدأ هذا الطلب من تقديرك «كيكة مناسبة صغيرة»/)).toBeTruthy();
    expect(screen.getByText("تعديل السعر بعد الاتفاق")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /افتح التقدير/ }));
    expect(wouterMocks.navigate).toHaveBeenCalledWith(
      `/tools/estimate/${savedEstimate.value.id}?from=%2Forders%2F${orderId}`,
    );
  });
});
