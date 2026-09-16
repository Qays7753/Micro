/** @vitest-environment jsdom */
/* EXE-015 (SHR-001) — عقد المشاركة الموحد من سطح الطلب الحقيقي:
 * زر المشاركة الوحيد يبني نصه من السجل المحفوظ عبر نقطة قرار واحدة:
 * إشعار قبض من حدث القبض القائم نفسه (بمرجع العملية/الحدث)، والملغى نصُه
 * إلغاء صادق بلا «جاهز للمتابعة»، والمعكوس يسقط إلى تذكير الذمة، والنقر
 * المزدوج لا يكرر شيئًا ولا يكتب حرفًا في السجل. */
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
  useSearch: () => "",
}));

const mockedUsePrototypeServices = vi.mocked(usePrototypeServices);
const NOW = "2026-09-16T10:00:00.000Z";

let store: MemoryLocalStore;
let costs: CostService;
let agreements: AgreementService;
let fulfillment: FulfillmentService;
const contextRef: { current: Record<string, unknown> } = { current: {} };

function Harness({ page }: { page: React.ReactNode }) {
  const [version, setVersion] = React.useState(0);
  contextRef.current = {
    costs,
    agreements,
    fulfillment,
    deliveryReview: new DeliveryReviewService(store, () => NOW),
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

const costInput: CostEditorInput = {
  materialItems: [],
  time: { minutes: 60, hourlyRateMinor: 400, confidence: "known" },
  packagingMinor: 0,
  deliveryMinor: 0,
  wasteMinor: 0,
  safetyBufferMinor: 0,
  quantity: 1,
};

async function agreedOrder(options?: { depositMinor?: number }) {
  const drafts = new DraftService(store, () => NOW);
  const created = await drafts.create("customer_order");
  if (!created.ok) throw new Error(created.message);
  const saved = await drafts.save({
    ...created.draft,
    customerName: "سارة",
    itemName: "رف خشبي",
    specifications: "مقاس كبير",
    quantity: 1,
  });
  if (!saved.ok) throw new Error(saved.message);
  const withCost = await costs.saveSnapshot(saved.draft, costInput);
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

/** نقر زر المشاركة واستخراج المسودة التي سافرت إلى /share/preview. */
async function clickShareAndGetDraft() {
  const button = await screen.findByText("شارك رسالة مع الزبون");
  fireEvent.click(button);
  await waitFor(() => expect(wouterMocks.navigate).toHaveBeenCalled());
  const call = wouterMocks.navigate.mock.calls[wouterMocks.navigate.mock.calls.length - 1];
  const state = (call[1] as { state: { draft: Record<string, unknown> } }).state;
  return { url: call[0] as string, draft: state.draft };
}

describe("EXE-015 — عقد المشاركة الموحد من سطح الطلب", () => {
  beforeEach(() => {
    wouterMocks.navigate.mockClear();
    wouterMocks.params = { id: "order-ord-1" };
    wouterMocks.location = "/orders/order-ord-1";
    vi.clearAllMocks();
    store = new MemoryLocalStore();
    costs = new CostService(store, () => NOW);
    agreements = new AgreementService(store, costs, () => NOW);
    fulfillment = new FulfillmentService(store, () => NOW);
  });
  afterEach(() => cleanup());

  it("القبض المحفوظ القائم ينتج إشعار قبض من الحدث نفسه — بمرجع العملية والحدث", async () => {
    const stored = await agreedOrder({ depositMinor: 1000 });
    const savedOrder = await store.getOrder(stored.id);
    if (!savedOrder.ok) throw new Error(savedOrder.message);
    const depositEvent = savedOrder.value.order.events.find(event => event.type === "deposit_collected");
    expect(depositEvent).toBeTruthy();

    wouterMocks.params = { id: stored.id };
    wouterMocks.location = `/orders/${stored.id}`;
    render(<Harness page={<OrderDetail />} />);
    const { url, draft } = await clickShareAndGetDraft();

    expect(url).toContain("/share/preview");
    /* المصدر محفوظ في الرابط (مرمّزًا كما يليق بمسار داخلي آمن). */
    expect(decodeURIComponent(url)).toContain(`returnTo=/orders/${stored.id}`);
    expect(draft.kind).toBe("collection");
    expect(draft.body).toContain("استلمت منك");
    expect(draft.body).toContain("10.00 د.أ");
    /* مرجع الحدث المثبت نفسه — لا أرقام من State مؤقت. */
    expect(draft.origin).toEqual({ orderId: stored.id, eventId: depositEvent?.id });
  });

  it("إعادة الإرسال تشير إلى الحدث نفسه — لا مسودة مكررة ولا كتابة في السجل", async () => {
    const stored = await agreedOrder({ depositMinor: 1000 });
    wouterMocks.params = { id: stored.id };
    wouterMocks.location = `/orders/${stored.id}`;
    const before = await store.readSnapshot();
    render(<Harness page={<OrderDetail />} />);
    const first = await clickShareAndGetDraft();
    wouterMocks.navigate.mockClear();
    const second = await clickShareAndGetDraft();
    expect(second.draft).toEqual(first.draft);
    const after = await store.readSnapshot();
    expect(after).toEqual(before);
  });

  it("الطلب الملغى لا يعرض ولا يمرر «جاهز للمتابعة» — نص إلغاء صادق", async () => {
    const stored = await agreedOrder({ depositMinor: 1000 });
    const cancelled = await fulfillment.cancel(stored.id, "الزبون عدل عن الطلب");
    if (!cancelled.ok) throw new Error(cancelled.message);

    wouterMocks.params = { id: stored.id };
    wouterMocks.location = `/orders/${stored.id}`;
    render(<Harness page={<OrderDetail />} />);
    const { draft } = await clickShareAndGetDraft();
    expect(draft.body).toContain("أُلغي");
    expect(draft.body).not.toContain("جاهز للمتابعة");
    expect(draft.body).not.toContain("استلمت منك");
  });

  it("العربون المعكوس لا يبقى تحصيلًا قائمًا قابلًا للمشاركة — يسقط إلى تذكير الذمة", async () => {
    const stored = await agreedOrder({ depositMinor: 1000 });
    const reversed = await fulfillment.reverseDeposit(stored.id, "سُجل العربون بالخطأ");
    if (!reversed.ok) throw new Error(reversed.message);

    wouterMocks.params = { id: stored.id };
    wouterMocks.location = `/orders/${stored.id}`;
    render(<Harness page={<OrderDetail />} />);
    const { draft } = await clickShareAndGetDraft();
    expect(draft.kind).toBe("reminder");
    expect(draft.body).toContain("أتذكر لك");
    expect(draft.body).not.toContain("استلمت منك");
  });
});
