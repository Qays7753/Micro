/** @vitest-environment jsdom */
/* Z2.0 — عقود وضوح رحلة الطلب في صفحة التفاصيل (§3.3/§6/Z2.2):
 * ١) الفعل التالي في بطاقة القرار هو فعل الدومين لحالة الطلب، متسقًا مع
 *    الفعل السياقي الظاهر على الشاشة نفسها.
 * ٢) تكوين «ما أُنجز / ما ينقص / الخطوة التالية» مدمج بجوار بطاقة القرار.
 * ٣) التقديري قابل للتمييز عن النهائي بعد التسليم.
 * ٤) التحصيل الجزئي لا يُقرأ اكتمالًا أبدًا.
 * ٥) أثر المراجعة (النتيجة) لا يسدّ الإغلاق ولا يخفي الفعل التالي.
 * ٦) المسلّم يرى لحظة التسليم في بطاقة القرار لا موعدًا مستحقًا مضى. */
import React from "react";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
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
import OrderDetail from "@/pages/OrderDetail";

vi.mock("@/app/PrototypeServicesContext", () => ({
  usePrototypeServices: vi.fn(),
}));

const wouterMocks = vi.hoisted(() => ({
  navigate: vi.fn(),
  location: "/orders/o1",
  params: {} as Record<string, string | undefined>,
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
const NOW = "2026-09-16T10:00:00.000Z";

let store: MemoryLocalStore;
let costs: CostService;
let agreements: AgreementService;
let fulfillment: FulfillmentService;
let deliveryReview: DeliveryReviewService;
const contextRef: { current: Record<string, unknown> } = { current: {} };

function Harness({ page }: { page: React.ReactNode }) {
  const [version, setVersion] = React.useState(0);
  contextRef.current = {
    costs,
    agreements,
    fulfillment,
    deliveryReview,
    inventory: new InventoryMaterialService(store, () => NOW),
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
  mockedUsePrototypeServices.mockImplementation(
    () => contextRef.current as unknown as ReturnType<typeof usePrototypeServices>,
  );
  return <UnsavedChangesProvider navigate={wouterMocks.navigate}>{page}</UnsavedChangesProvider>;
}

const costInput = (confidence: "known" | "estimated"): CostEditorInput => ({
  materialItems: [],
  time: { minutes: 60, hourlyRateMinor: 400, confidence },
  packagingMinor: 0,
  deliveryMinor: 0,
  wasteMinor: 0,
  safetyBufferMinor: 0,
  quantity: 1,
});

async function agreedOrder(options?: {
  depositMinor?: number;
  confidence?: "known" | "estimated";
  customer?: string;
}) {
  const drafts = new DraftService(store, () => NOW);
  const created = await drafts.create("customer_order");
  if (!created.ok) throw new Error(created.message);
  const saved = await drafts.save({
    ...created.draft,
    customerName: options?.customer ?? "سارة",
    itemName: "رف خشبي",
    specifications: "مقاس كبير",
    quantity: 1,
  });
  if (!saved.ok) throw new Error(saved.message);
  const withCost = await costs.saveSnapshot(saved.draft, costInput(options?.confidence ?? "known"));
  if (!withCost.ok) throw new Error(withCost.message);
  const agreed = await agreements.createFromDraft(withCost.draft, {
    agreedPriceMinor: 5000,
    deliveryDate: "2026-09-20",
    depositMinor: options?.depositMinor ?? 0,
    agreementSource: null,
  });
  if (!agreed.ok) throw new Error(agreed.message);
  return agreed.stored;
}

async function deliverOrder(
  stored: { id: string },
  collectNow: { amountMinor: number; walletId: string | null } | null,
) {
  const started = await agreements.startExecution(stored.id);
  if (!started.ok) throw new Error(started.message);
  const ready = await fulfillment.markReady(stored.id);
  if (!ready.ok) throw new Error(ready.message);
  const delivered = await deliveryReview.commitDelivery(stored.id, {
    rows: [],
    finalPriceMinor: null,
    priceRevisionReason: null,
    collectNow,
    operationKey: `z2-deliver-${stored.id}`,
  });
  if (!delivered.ok) throw new Error(delivered.message);
  return delivered.value.stored;
}

async function openOrder(stored: { id: string }) {
  wouterMocks.params = { id: stored.id };
  wouterMocks.location = `/orders/${stored.id}`;
  render(<Harness page={<OrderDetail />} />);
  await waitFor(() => expect(screen.getByText("رف خشبي")).toBeTruthy());
}

const decisionCard = () => document.querySelector(".micro-decision-card");

describe("Z2.0 — order-detail journey clarity contracts", () => {
  beforeEach(() => {
    wouterMocks.navigate.mockClear();
    wouterMocks.params = { id: "order-z2-1" };
    wouterMocks.location = "/orders/order-z2-1";
    vi.clearAllMocks();
    store = new MemoryLocalStore();
    costs = new CostService(store, () => NOW);
    agreements = new AgreementService(store, costs, () => NOW);
    fulfillment = new FulfillmentService(store, () => NOW);
    deliveryReview = new DeliveryReviewService(store, () => NOW);
  });
  afterEach(() => cleanup());

  it("states the domain next action on the decision card, aligned with the on-screen contextual action", async () => {
    const stored = await agreedOrder({ depositMinor: 1000 });
    await openOrder(stored);

    const card = decisionCard();
    expect(card).toBeTruthy();
    /* فعل الدومين لحالة اتفاق مؤكد بعربون: التنفيذ ثم التسليم. */
    expect(card?.textContent).toContain("نفّذ الطلب ثم سجّل التسليم");
    /* الفعل السياقي على الشاشة نفسها متسق معه. */
    expect(screen.getByRole("button", { name: /ابدأ التنفيذ/ })).toBeTruthy();
  });

  it("keeps the domain next action for a ready order beside the delivery-review action", async () => {
    const stored = await agreedOrder({ depositMinor: 1000 });
    const started = await agreements.startExecution(stored.id);
    if (!started.ok) throw new Error(started.message);
    const ready = await fulfillment.markReady(stored.id);
    if (!ready.ok) throw new Error(ready.message);
    await openOrder(stored);

    const card = decisionCard();
    expect(card?.textContent).toContain("سجّل التسليم");
    expect(screen.getByRole("button", { name: "راجع التسليم وسجّله" })).toBeTruthy();
  });

  it("shows a compact completed/missing/next composition beside the decision card", async () => {
    const stored = await agreedOrder({ depositMinor: 1000 });
    await openOrder(stored);

    const composition = await waitFor(() => {
      const node = document.querySelector('[data-testid="order-journey-composition"]');
      expect(node).toBeTruthy();
      return node as HTMLElement;
    });
    /* بجوار بطاقة القرار — تابعها في ترتيب الصفحة لا بعيدًا عنها. */
    expect(
      document.querySelector(".micro-decision-card ~ [data-testid='order-journey-composition']"),
    ).toBeTruthy();
    const text = composition.textContent ?? "";
    expect(text).toContain("ما أُنجز");
    expect(text).toContain("الاتفاق محفوظ");
    expect(text).toContain("ما ينقص");
    expect(text).toContain("المتبقي");
    expect(text).toContain("الخطوة التالية");
    expect(text).toContain("نفّذ الطلب ثم سجّل التسليم");
  });

  it("keeps estimated and final markers distinguishable after delivery", async () => {
    const finalOrder = await agreedOrder({ depositMinor: 1000, confidence: "known" });
    await deliverOrder(finalOrder, { amountMinor: 4000, walletId: null });
    await openOrder(finalOrder);

    const finalCard = document.querySelector(".micro-result-card");
    expect(finalCard?.getAttribute("data-result")).toBe("final");
    const finalComposition = document.querySelector('[data-testid="order-journey-composition"]');
    expect(finalComposition?.textContent).toContain("نهائي");
    expect(finalComposition?.textContent).not.toContain("تقديري");
    cleanup();

    const estimatedOrder = await agreedOrder({ depositMinor: 1000, confidence: "estimated" });
    await deliverOrder(estimatedOrder, null);
    await openOrder(estimatedOrder);

    const estimatedCard = document.querySelector(".micro-result-card");
    expect(estimatedCard?.getAttribute("data-result")).toBe("estimated");
    const estimatedComposition = document.querySelector('[data-testid="order-journey-composition"]');
    expect(estimatedComposition?.textContent).toContain("تقديري");
    expect(estimatedComposition?.textContent).not.toContain("نهائي");
  });

  it("never reads a partial collection as complete", async () => {
    const partialOrder = await agreedOrder({ depositMinor: 1000, confidence: "known" });
    await deliverOrder(partialOrder, null);
    await openOrder(partialOrder);

    const partialComposition = document.querySelector('[data-testid="order-journey-composition"]');
    expect(partialComposition?.textContent).toContain("جزئي");
    expect(partialComposition?.textContent).not.toContain("تم التحصيل الكامل");
    expect(screen.queryByText(/تم التحصيل الكامل/)).toBeNull();
    cleanup();

    const fullOrder = await agreedOrder({ depositMinor: 1000, confidence: "known" });
    await deliverOrder(fullOrder, { amountMinor: 4000, walletId: null });
    await openOrder(fullOrder);

    expect(screen.getByText(/تم التحصيل الكامل وإغلاق الطلب/)).toBeTruthy();
    const fullComposition = document.querySelector('[data-testid="order-journey-composition"]');
    expect(fullComposition?.textContent).toContain("كامل");
    expect(fullComposition?.textContent).not.toContain("جزئي");
  });

  it("keeps review impact a follow-up that never blocks closure", async () => {
    const debtOrder = await agreedOrder({ depositMinor: 1000, confidence: "known" });
    await deliverOrder(debtOrder, null);
    await openOrder(debtOrder);

    /* أثر المراجعة (بطاقة النتيجة) حاضر… */
    const resultCard = document.querySelector(".micro-result-card");
    expect(resultCard).toBeTruthy();
    /* …والإغلاق مفتوح: فعلا التحصيل/الدين متاحان غير معطلين. */
    const collect = screen.getByRole("button", { name: /تحصيل المتبقي الآن/ }) as HTMLButtonElement;
    expect(collect.disabled).toBe(false);
    expect(screen.getByRole("button", { name: /تسجيله دينًا/ })).toBeTruthy();
    cleanup();

    const closedOrder = await agreedOrder({ depositMinor: 1000, confidence: "known" });
    await deliverOrder(closedOrder, { amountMinor: 4000, walletId: null });
    await openOrder(closedOrder);

    /* الطلب مغلق فعلًا مع بقاء النتيجة للمراجعة — لا حاجب ولا خطأ. */
    expect(screen.getByText(/تم التحصيل الكامل وإغلاق الطلب/)).toBeTruthy();
    expect(document.querySelector(".micro-result-card")).toBeTruthy();
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("qualifies a delivered order's decision card with the delivery moment, not a stale due date", async () => {
    const stored = await agreedOrder({ depositMinor: 1000, confidence: "known" });
    await deliverOrder(stored, null);
    await openOrder(stored);

    const card = decisionCard();
    expect(card?.textContent).toContain("سُلّم في");
    expect(card?.textContent).not.toContain("موعد التسليم");
  });
});
