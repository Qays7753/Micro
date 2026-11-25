/** @vitest-environment jsdom */

/* M1.2 (§14.3 / IMPACT S2 — أمر تنفيذ المرحلة ١، الموجة A): قطع رابط
 * التقدير بتكلفة الطلب من جهة الصفحة — صفحة تفصيل الطلب لا تجري أي بحث عن
 * تقدير المصدر: لا نداء لخدمة المسودات ولا لخدمة التقديرات، ولا يُعرض
 * مقطع «المصدر: تقدير» حتى مع وجود مسودة مرتبطة بالطلب تحمل معرّف تقدير
 * مصدر حيًّا في المخزن نفسه. البذور موجودة عمدًا كي يفشل الاختبار قبل
 * القطع (يبحث القديم ويعرض)، وينجح بعده (لا بحث ولا عرض). */
import React from "react";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { usePrototypeServices } from "@/app/PrototypeServicesContext";
import { AssetService } from "@/application/assets/assetService";
import { LoanService } from "@/application/loans/loanService";
import { RetainedDepositService } from "@/application/financial-records/retainedDepositService";
import { AgreementService } from "@/application/agreements/agreementService";
import { InventoryMaterialService } from "@/application/inventory/inventoryMaterialService";
import { CostService } from "@/application/cost/costService";
import { AgreementContextService } from "@/application/agreements/agreementContextService";
import { ActualTimeService } from "@/application/time/actualTimeService";
import { DraftService } from "@/application/drafts/draftService";
import { CostEstimateService } from "@/application/estimates/costEstimateService";
import { CollectionReversalService } from "@/application/collections/collectionReversalService";
import { ProjectFinancialService } from "@/application/finance/projectFinancialService";
import { DeliveryReviewService } from "@/application/fulfillment/deliveryReviewService";
import { FulfillmentService } from "@/application/fulfillment/fulfillmentService";
import { CashContinuityService } from "@/application/cash/cashContinuityService";
import { PartyDirectoryService } from "@/application/parties/partyLedgerService";
import { calculateCostSnapshot, createCraftOrder, type CraftOrder } from "@micro-domain/craft-order/index.js";
import { MemoryLocalStore } from "@/storage/local/MemoryLocalStore";
import type { OrderDraft, StoredCraftOrder } from "@/storage/local/types";
import OrderDetail from "@/pages/OrderDetail";

vi.mock("@/app/PrototypeServicesContext", () => ({
  usePrototypeServices: vi.fn(),
}));

const wouterMocks = vi.hoisted(() => ({
  navigate: vi.fn(),
  location: "/orders/order-m12",
  params: { id: "order-m12" } as Record<string, string>,
}));
vi.mock("wouter", () => ({
  useLocation: () => [wouterMocks.location, wouterMocks.navigate],
  useParams: () => wouterMocks.params,
  useSearch: () => "",
}));

const mockedUsePrototypeServices = vi.mocked(usePrototypeServices);
const NOW = "2026-11-26T10:00:00.000Z";

let store: MemoryLocalStore;
let drafts: DraftService;
let costEstimates: CostEstimateService;

/** طلب مؤكد + مسودة مرتبطة به تحمل معرّف تقدير مصدر + التقدير نفسه حي في المخزن. */
async function seedOrderWithLinkedDraftAndEstimate(): Promise<void> {
  const snapshot = calculateCostSnapshot("snap-m12", {
    currency: "JOD",
    materialItems: [
      {
        name: "خيط",
        quantity: 1,
        unit: "متر",
        unitPriceMinor: 300,
        priceDate: "2026-11-01",
        source: "user_input",
        confidence: "known",
      },
    ],
    time: null,
    packagingMinor: 0,
    deliveryMinor: 0,
    wasteMinor: 0,
    safetyBufferMinor: 0,
    quantity: 1,
    createdAt: NOW,
    source: "price_approval",
  });
  const order: CraftOrder = createCraftOrder({
    id: "order-m12",
    customerName: "ليلى",
    itemName: "فستان",
    specifications: "قياس مخصص",
    quantity: 1,
    agreedPriceMinor: 10000,
    costSnapshot: snapshot,
    createdAt: NOW,
  });
  const stored: StoredCraftOrder = {
    id: "order-m12",
    order,
    catalogItemId: null,
    deliveryDate: "2026-11-20",
    agreementSource: "whatsapp",
    createdAt: NOW,
    updatedAt: NOW,
  };
  await store.saveOrder(stored);

  const estimate = await costEstimates.save({
    title: "تقدير فستان ليلى",
    materialItems: [{ name: "خيط", quantity: 1, unit: "متر", unitPriceMinor: 300, confidence: "known" }],
    time: null,
    packagingMinor: 0,
    deliveryMinor: 0,
    wasteMinor: 0,
    safetyBufferMinor: 0,
    quantity: 1,
    note: null,
  });
  if (!estimate.ok) throw new Error("seed: تعذر حفظ التقدير");

  const draft: OrderDraft = {
    id: "draft-m12",
    intent: "customer_order",
    customerName: "ليلى",
    orderName: null,
    itemName: "فستان",
    catalogItemId: null,
    specifications: "قياس مخصص",
    quantity: 1,
    costSnapshots: [],
    activeCostSnapshotId: null,
    linkedOrderId: "order-m12",
    sourceEstimateId: estimate.value.id,
    offeringRef: null,
    groups: null,
    suggestedPriceMinor: null,
    createdAt: NOW,
    updatedAt: NOW,
  };
  await store.saveDraft(draft);
}

beforeEach(() => {
  store = new MemoryLocalStore();
  drafts = new DraftService(store, () => NOW);
  costEstimates = new CostEstimateService(store, () => NOW);
  vi.clearAllMocks();
  mockedUsePrototypeServices.mockReturnValue({
    actualTime: new ActualTimeService(store, () => NOW),
    agreements: new AgreementService(store, new CostService(store, () => NOW)),
    agreementContext: new AgreementContextService(store, () => NOW),
    inventory: new InventoryMaterialService(store, () => NOW),
    drafts,
    costEstimates,
    collectionReversal: new CollectionReversalService(store, new ProjectFinancialService(store, () => NOW)),
    retainedDeposits: new RetainedDepositService(store),
    cashContinuity: new CashContinuityService(store, () => NOW),
    projectFinance: new ProjectFinancialService(store, () => NOW),
    partyDirectory: new PartyDirectoryService(store, () => NOW),
    fulfillment: new FulfillmentService(store, () => NOW),
    deliveryReview: new DeliveryReviewService(store, () => NOW),
    loans: new LoanService(store, () => NOW),
    assets: new AssetService(store, () => NOW),
    dataVersion: 0,
    notifyDataChanged: vi.fn(),
  } as unknown as ReturnType<typeof usePrototypeServices>);
});
afterEach(cleanup);

describe("M1.2 (§14.3 / IMPACT S2) — صفحة تفصيل الطلب لا تبحث عن تقدير المصدر", () => {
  it("لا نداء لخدمة المسودات ولا لخدمة التقديرات من الصفحة (انتظار يستقر حتمًا)", async () => {
    await seedOrderWithLinkedDraftAndEstimate();
    const draftsListSpy = vi.spyOn(drafts, "list");
    const costEstimatesGetSpy = vi.spyOn(costEstimates, "get");
    render(<OrderDetail />);
    expect(await screen.findByText("فستان")).toBeTruthy();
    await waitFor(() => expect(draftsListSpy).not.toHaveBeenCalled());
    expect(costEstimatesGetSpy).not.toHaveBeenCalled();
  });

  it("لا يُعرض مقطع «المصدر: تقدير» ولا وصلة فتح التقدير رغم وجود المسودة المرتبطة والتقدير الحي", async () => {
    await seedOrderWithLinkedDraftAndEstimate();
    render(<OrderDetail />);
    expect(await screen.findByText("فستان")).toBeTruthy();
    await waitFor(() => expect(screen.queryByRole("heading", { name: "المصدر: تقدير" })).toBeNull());
    expect(screen.queryByText(/بدأ هذا الطلب من تقديرك/)).toBeNull();
    expect(screen.queryByRole("button", { name: /افتح التقدير/ })).toBeNull();
  });
});
