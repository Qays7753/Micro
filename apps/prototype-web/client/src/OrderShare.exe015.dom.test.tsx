/** @vitest-environment jsdom */
/* EXE-015 (SHR-001) ثم UNIT-040 (تنفيذ S15 بالأمر الموحد §5): عقد المشاركة
 * من سطح الطلب أُلغي بقرار المالك المعتمد — لا زر «شارك رسالة مع الزبون»
 * ولا مسودة ولا معاينة ولا بديل رسالة أو نسخ نص في أي حالة طلب (قبض قائم،
 * ملغى، عربون معكوس). السجل المحفوظ نفسه وسجل أحداثه هما الحقيقة المعروضة،
 * وزيارة السطح لا تكتب حرفًا في المخزن. */
import React from "react";
import { cleanup, render, screen } from "@testing-library/react";
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

describe("EXE-015 → UNIT-040 — إلغاء المشاركة من سطح الطلب", () => {
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

  it("لا زر مشاركة في أي حالة — القبض القائم يُقرأ من سجله لا من مسودة", async () => {
    const stored = await agreedOrder({ depositMinor: 1000 });
    wouterMocks.params = { id: stored.id };
    wouterMocks.location = `/orders/${stored.id}`;
    render(<Harness page={<OrderDetail />} />);
    await screen.findByRole("heading", { name: "رف خشبي" });
    /* UNIT-040: لا زر «شارك رسالة مع الزبون» ولا أي فعل مشاركة. */
    expect(screen.queryByText("شارك رسالة مع الزبون")).toBeNull();
    expect(screen.queryByText(/شارك/)).toBeNull();
  });

  it("الملغى يبقى نصُه إلغاء صادق — بلا زر مشاركة ولا «جاهز للمتابعة»", async () => {
    const stored = await agreedOrder({ depositMinor: 1000 });
    const cancelled = await fulfillment.cancel(stored.id, "الزبون عدل عن الطلب");
    if (!cancelled.ok) throw new Error(cancelled.message);

    wouterMocks.params = { id: stored.id };
    wouterMocks.location = `/orders/${stored.id}`;
    render(<Harness page={<OrderDetail />} />);
    await screen.findByRole("heading", { name: "رف خشبي" });
    expect(document.body.textContent ?? "").toContain("ملغى");
    expect(document.body.textContent ?? "").not.toContain("جاهز للمتابعة");
    expect(screen.queryByText(/شارك/)).toBeNull();
  });

  it("العربون المعكوس يبقى تذكير ذمة في السجل — بلا مسار مشاركة يعيده قبضًا", async () => {
    const stored = await agreedOrder({ depositMinor: 1000 });
    const reversed = await fulfillment.reverseDeposit(stored.id, "سُجل العربون بالخطأ");
    if (!reversed.ok) throw new Error(reversed.message);

    wouterMocks.params = { id: stored.id };
    wouterMocks.location = `/orders/${stored.id}`;
    render(<Harness page={<OrderDetail />} />);
    await screen.findByRole("heading", { name: "رف خشبي" });
    /* السجل المحفوظ نفسه هو مصدر الحقيقة — لا مسودة مشاركة تعيد تفسيره. */
    expect(screen.queryByText(/شارك/)).toBeNull();
    expect(wouterMocks.navigate).not.toHaveBeenCalled();
  });

  it("زيارة السطح بلا مشاركة لا تكتب حرفًا — اللقطة قبل وبعد واحدة", async () => {
    const stored = await agreedOrder({ depositMinor: 1000 });
    wouterMocks.params = { id: stored.id };
    wouterMocks.location = `/orders/${stored.id}`;
    const before = await store.readSnapshot();
    render(<Harness page={<OrderDetail />} />);
    await screen.findByRole("heading", { name: "رف خشبي" });
    expect(screen.queryByText(/شارك/)).toBeNull();
    const after = await store.readSnapshot();
    expect(after).toEqual(before);
  });
});
