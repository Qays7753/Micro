/** @vitest-environment jsdom */

/* المجموعة ٣ (عقد D5/D7 — اختبارات سطوح التسليم): مراجعة التسليم قبل الالتزام،
 * مسار الزر من تفاصيل الطلب، مقترحات الحاسبة من المخزون — ولا خصم مخزون خفي
 * ولا إيراد مكرر ولا قبض بلا وجهة من مسارات الطلب. */
import React from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { usePrototypeServices } from "@/app/PrototypeServicesContext";
import { CostEstimateService } from "@/application/estimates/costEstimateService";
import { DraftService } from "@/application/drafts/draftService";
import { CostService, type CostEditorInput } from "@/application/cost/costService";
import { AgreementService } from "@/application/agreements/agreementService";
import { FulfillmentService } from "@/application/fulfillment/fulfillmentService";
import { DeliveryReviewService } from "@/application/fulfillment/deliveryReviewService";
import { InventoryMaterialService } from "@/application/inventory/inventoryMaterialService";
import { ScheduleService } from "@/application/scheduling/scheduleService";
import { ProjectFinancialService } from "@/application/finance/projectFinancialService";
import { CashContinuityService } from "@/application/cash/cashContinuityService";
import { ActualTimeService } from "@/application/time/actualTimeService";
import { AgreementContextService } from "@/application/agreements/agreementContextService";
import { CollectionReversalService } from "@/application/collections/collectionReversalService";
import { UnsavedChangesProvider } from "@/components/forms/UnsavedChangesGuard";
import { MemoryLocalStore } from "@/storage/local/MemoryLocalStore";
import DeliveryReview from "@/pages/DeliveryReview";
import OrderDetail from "@/pages/OrderDetail";
import CostCalculator from "@/pages/CostCalculator";

vi.mock("@/app/PrototypeServicesContext", () => ({
  usePrototypeServices: vi.fn(),
}));

const wouterMocks = vi.hoisted(() => ({
  navigate: vi.fn(),
  location: "/orders/o1/deliver",
  params: {} as Record<string, string>,
}));
vi.mock("wouter", () => ({
  useLocation: () => [wouterMocks.location, wouterMocks.navigate],
  useParams: () => wouterMocks.params,
  useSearch: () => {
    const query = wouterMocks.location.split("?")[1] ?? "";
    return query ? `?${query}` : "";
  },
}));

const mockedUsePrototypeServices = vi.mocked(usePrototypeServices);
const NOW = "2026-09-04T10:00:00.000Z";

let store: MemoryLocalStore;
let costs: CostService;
let agreements: AgreementService;
let fulfillment: FulfillmentService;
let deliveryReview: DeliveryReviewService;
let inventory: InventoryMaterialService;
const contextRef: { current: Record<string, unknown> } = { current: {} };

function Harness({ page }: { page: React.ReactNode }) {
  const [version, setVersion] = React.useState(0);
  contextRef.current = {
    costs,
    agreements,
    fulfillment,
    deliveryReview,
    inventory,
    costEstimates: new CostEstimateService(store, () => NOW),
    drafts: new DraftService(store, () => NOW),
    cashContinuity: new CashContinuityService(store, () => NOW),
    actualTime: new ActualTimeService(store, () => NOW),
    agreementContext: new AgreementContextService(store, () => NOW),
    collectionReversal: new CollectionReversalService(store, new ProjectFinancialService(store, () => NOW)),
    schedules: new ScheduleService(store, () => NOW),
    dataVersion: version,
    notifyDataChanged: () => setVersion(current => current + 1),
  };
  return <UnsavedChangesProvider navigate={wouterMocks.navigate}>{page}</UnsavedChangesProvider>;
}

const costInput: CostEditorInput = {
  materialItems: [
    { name: "قماش قطنية", quantity: 2, unit: "متر", unitPriceMinor: 500, confidence: "known" },
  ],
  time: { minutes: 60, hourlyRateMinor: 500, confidence: "known" },
  packagingMinor: 0,
  deliveryMinor: 0,
  wasteMinor: 0,
  safetyBufferMinor: 100,
  quantity: 1,
};

async function readyOrderWithTrackedMaterial() {
  const inventoryService = new InventoryMaterialService(store, () => NOW);
  const opened = await inventoryService.openMaterial({
    name: "قماش قطنية",
    unit: "meter",
    tracking: "tracked",
    opening: {
      quantityState: "confirmed",
      quantityMilli: 10_000,
      costState: "known",
      valueMinor: 5_000,
      confirmedOn: "2026-09-01",
      sourceNote: "جرد",
    },
    note: "افتتاح",
    operationKey: "g3-delivery-open",
  });
  if (!opened.ok) throw new Error("material should open");
  const drafts = new DraftService(store, () => NOW);
  const created = await drafts.create("customer_order");
  if (!created.ok) throw new Error("draft should create");
  const saved = await drafts.save({
    ...created.draft,
    customerName: "سارة",
    itemName: "فستان",
    specifications: "تطريز",
    quantity: 1,
  });
  if (!saved.ok) throw new Error("draft should save");
  const withCost = await costs.saveSnapshot(saved.draft, {
    ...costInput,
    materialItems: [
      {
        name: "قماش قطنية",
        quantity: 2,
        unit: "متر",
        unitPriceMinor: 500,
        confidence: "known",
        materialId: opened.value.material.id,
      },
    ],
  });
  if (!withCost.ok) throw new Error("cost should save");
  const agreed = await agreements.createFromDraft(withCost.draft, {
    agreedPriceMinor: 5_000,
    deliveryDate: "2026-09-10",
    depositMinor: 1_000,
    agreementSource: null,
  });
  if (!agreed.ok) throw new Error("agreement should save");
  await agreements.startExecution(agreed.stored.id);
  await fulfillment.markReady(agreed.stored.id);
  return { orderId: agreed.stored.id, materialId: opened.value.material.id };
}

describe("G3 delivery surfaces — review before commitment", () => {
  beforeEach(() => {
    store = new MemoryLocalStore();
    costs = new CostService(store, () => NOW);
    agreements = new AgreementService(store, costs, () => NOW);
    fulfillment = new FulfillmentService(store, () => NOW);
    deliveryReview = new DeliveryReviewService(store, () => NOW);
    inventory = new InventoryMaterialService(store, () => NOW);
    wouterMocks.location = "/orders/o1/deliver";
    wouterMocks.params = {};
    wouterMocks.navigate.mockReset();
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it("delivery review shows money and proposed consumption before any commit; confirming delivers once with the linked movement", async () => {
    const { orderId } = await readyOrderWithTrackedMaterial();
    wouterMocks.params = { id: orderId };
    wouterMocks.location = `/orders/${orderId}/deliver`;
    mockedUsePrototypeServices.mockImplementation(
      () => contextRef.current as unknown as ReturnType<typeof usePrototypeServices>,
    );
    render(<Harness page={<DeliveryReview />} />);
    await screen.findByRole("heading", { name: "مراجعة التسليم" });
    /* المال كله معروض قبل الالتزام — لا رقم يظهر بعد فوات الأوان. */
    expect(screen.getAllByText("السعر المتفق عليه (د.أ)")).toBeTruthy();
    expect(screen.getByText("المتبقي على العميل (د.أ)")).toBeTruthy();
    /* المخزون المقترح ظاهر: المادة المتتبَّعة بمسار استهلاك كامل. */
    expect(screen.getByText("قماش قطنية")).toBeTruthy();
    expect(screen.getByText(/المتاح: 10 متر/)).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "أكّد التسليم" }));
    await waitFor(() => expect(screen.getByText("تم تسجيل التسليم")).toBeTruthy());
    expect(screen.getByText(/حركات استهلاك مخزون: 1/)).toBeTruthy();
    expect(screen.getByText(/لم يُسجَّل قبض جديد عند التسليم/)).toBeTruthy();

    /* الحكم الحاسم: حركة واحدة مربوطة بالطلب، ولا حدث مالي مستقل، وإيراد مرة واحدة. */
    const movements = await store.listInventoryMovements();
    const order = await store.getOrder(orderId);
    if (!movements.ok || !order.ok || !order.value) throw new Error("stores should read");
    /* حركة الافتتاح ليست استهلاكًا — الاستهلاك المستهدف حركة واحدة مربوطة بالطلب. */
    const consumptions = movements.value.filter(movement => movement.type === "consumption");
    expect(consumptions).toHaveLength(1);
    expect(consumptions[0]).toMatchObject({
      orderId,
      quantityDeltaMilli: -2_000,
    });
    expect(order.value.order).toMatchObject({
      status: "delivered",
      recognizedRevenueMinor: 5_000,
      collectedMinor: 1_000,
    });
    const events = await store.listFinancialEvents();
    if (!events.ok) throw new Error("events should read");
    expect(events.value).toHaveLength(0);
  });

  it("order detail routes the ready order to the delivery review instead of one-click delivery", async () => {
    const { orderId } = await readyOrderWithTrackedMaterial();
    wouterMocks.params = { id: orderId };
    wouterMocks.location = `/orders/${orderId}?from=%2Forders`;
    mockedUsePrototypeServices.mockImplementation(
      () => contextRef.current as unknown as ReturnType<typeof usePrototypeServices>,
    );
    render(<Harness page={<OrderDetail />} />);
    const reviewButton = await screen.findByRole("button", { name: "راجع التسليم وسجّله" });
    fireEvent.click(reviewButton);
    expect(wouterMocks.navigate).toHaveBeenCalledWith(
      `/orders/${orderId}/deliver?from=%2Forders%2F${orderId}`,
    );
    /* لا زر تسليم بنقرة واحدة بعد الآن. */
    expect(screen.queryByRole("button", { name: "تم التسليم" })).toBeNull();
  });

  it("calculator offers inventory material suggestions with receipt-based confidence — zero inventory effect", async () => {
    const inventoryService = new InventoryMaterialService(store, () => NOW);
    await inventoryService.openMaterial({
      name: "خشب زان",
      unit: "meter",
      tracking: "tracked",
      opening: {
        quantityState: "confirmed",
        quantityMilli: 5_000,
        costState: "known",
        valueMinor: 2_500,
        confirmedOn: "2026-09-01",
        sourceNote: "جرد",
      },
      note: "افتتاح",
      operationKey: "g3-calculator-open",
    });
    wouterMocks.location = "/tools/calculator?from=%2Ftools";
    mockedUsePrototypeServices.mockImplementation(
      () => contextRef.current as unknown as ReturnType<typeof usePrototypeServices>,
    );
    render(<Harness page={<CostCalculator />} />);
    await screen.findByRole("heading", { name: "حاسبة التكلفة والسعر" });
    const chip = await screen.findByRole("button", { name: /خشب زان/ });
    fireEvent.click(chip);
    /* الاقتراح عبّأ البند بلا فتح لوحة مفاتيح ولا حركة مخزون. */
    await waitFor(() => expect(screen.getByDisplayValue("خشب زان")).toBeTruthy());
    const movements = await store.listInventoryMovements();
    const events = await store.listFinancialEvents();
    if (!movements.ok || !events.ok) throw new Error("stores should read");
    expect(movements.value.filter(movement => movement.type === "consumption")).toHaveLength(0);
    expect(events.value).toHaveLength(0);
  });
});
