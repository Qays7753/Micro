/** @vitest-environment jsdom */

/* المجموعة ٤ (عقد ٢٩ — اختبار سطح قرار العربون المحتفظ): الافتراضي الآمن
 * «معلق» ظاهر بقرار صريح؛ التصنيف إيرادًا يُعترف مرة واحدة (لا كاش جديد)،
 * والتصحيح عكس + بديل موثق — كله من صفحة الطلب. */
import React from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { usePrototypeServices } from "@/app/PrototypeServicesContext";
import { AssetService } from "@/application/assets/assetService";
import { LoanService } from "@/application/loans/loanService";
import { RetainedDepositService } from "@/application/finance/retainedDepositService";
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
import {
  calculateCostSnapshot,
  cancelOrder,
  collectDeposit,
  createCraftOrder,
  settleDepositRetain,
  type CraftOrder,
} from "@micro-domain/craft-order/index.js";
import { MemoryLocalStore } from "@/storage/local/MemoryLocalStore";
import type { StoredCraftOrder } from "@/storage/local/types";
import OrderDetail from "@/pages/OrderDetail";

vi.mock("@/app/PrototypeServicesContext", () => ({
  usePrototypeServices: vi.fn(),
}));

const wouterMocks = vi.hoisted(() => ({
  navigate: vi.fn(),
  location: "/orders/order-g4",
  params: { id: "order-g4" } as Record<string, string>,
}));
vi.mock("wouter", () => ({
  useLocation: () => [wouterMocks.location, wouterMocks.navigate],
  useParams: () => wouterMocks.params,
  useSearch: () => "",
}));

const mockedUsePrototypeServices = vi.mocked(usePrototypeServices);
const NOW = "2026-09-04T10:00:00.000Z";

let store: MemoryLocalStore;
let retainedDeposits: RetainedDepositService;
const contextRef: { current: Record<string, unknown> } = { current: {} };

function Harness({ page }: { page: React.ReactNode }) {
  const [version, setVersion] = React.useState(0);
  contextRef.current = {
    retainedDeposits,
    loans: new LoanService(store, () => NOW),
    assets: new AssetService(store, () => NOW),
    agreements: new AgreementService(store, new CostService(store, () => NOW)),
    agreementContext: new AgreementContextService(store, () => NOW),
    inventory: new InventoryMaterialService(store, () => NOW),
    actualTime: new ActualTimeService(store, () => NOW),
    drafts: new DraftService(store, () => NOW),
    costEstimates: new CostEstimateService(store, () => NOW),
    collectionReversal: new CollectionReversalService(store, new ProjectFinancialService(store, () => NOW)),
    fulfillment: new FulfillmentService(store, () => NOW),
    deliveryReview: new DeliveryReviewService(store, () => NOW),
    dataVersion: version,
    notifyDataChanged: () => setVersion(current => current + 1),
  };
  return <>{page}</>;
}

async function seedCancelledRetainedOrder(): Promise<void> {
  const snapshot = calculateCostSnapshot("snap-g4-dep", {
    currency: "JOD",
    materialItems: [{ name: "خيط", quantity: 1, unit: "متر", unitPriceMinor: 300, priceDate: "2026-09-01", source: "user_input", confidence: "known" }],
    time: null,
    packagingMinor: 0,
    deliveryMinor: 0,
    wasteMinor: 0,
    safetyBufferMinor: 0,
    quantity: 1,
    createdAt: NOW,
    source: "price_approval",
  });
  let order: CraftOrder = createCraftOrder({
    id: "order-g4",
    customerName: "ليلى",
    itemName: "فستان",
    specifications: "قياس مخصص",
    quantity: 1,
    agreedPriceMinor: 10000,
    costSnapshot: snapshot,
    createdAt: NOW,
  });
  order = collectDeposit(order, 5000, "order-g4:dep", NOW);
  order = cancelOrder(order, "العميلة ألغت", "order-g4:cancel", NOW);
  order = settleDepositRetain(order, 5000, "تنازل عن العربون", "order-g4:retain", NOW);
  const stored: StoredCraftOrder = {
    id: "order-g4",
    order,
    catalogItemId: null,
    deliveryDate: "2026-09-01",
    agreementSource: "whatsapp",
    createdAt: NOW,
    updatedAt: NOW,
  };
  await store.saveOrder(stored);
}

beforeEach(() => {
  store = new MemoryLocalStore();
  retainedDeposits = new RetainedDepositService(store, () => NOW);
  vi.clearAllMocks();
  mockedUsePrototypeServices.mockImplementation(
    () => contextRef.current as unknown as ReturnType<typeof usePrototypeServices>,
  );
});
afterEach(cleanup);

describe("G4 retained deposit decision surface (المجموعة ٤ — عقد ٢٩)", () => {
  it("shows the three-outcome decision with pending as the safe default", async () => {
    await seedCancelledRetainedOrder();
    render(<Harness page={<OrderDetail />} />);
    expect(await screen.findByText(/شو بدك تعمل فيه؟/)).toBeTruthy();
    expect(screen.getByText(/أو اتركه معلقًا/)).toBeTruthy();
    expect(screen.getByRole("button", { name: "مال مالك" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "إيراد مشروع" })).toBeTruthy();
  });

  it("classifies as revenue once: recognized in events, no new cash, no double count", async () => {
    await seedCancelledRetainedOrder();
    render(<Harness page={<OrderDetail />} />);
    fireEvent.change(await screen.findByPlaceholderText("مثال: العميل تنازل عن العربون مقابل الإلغاء"), {
      target: { value: "تعويض متفق عليه" },
    });
    fireEvent.click(await screen.findByRole("button", { name: "إيراد مشروع" }));
    await waitFor(async () => {
      const events = await store.listFinancialEvents();
      if (!events.ok) throw new Error(events.message);
      expect(events.value.filter(event => event.type === "deposit_retained_revenue")).toHaveLength(1);
    });
    const events = await store.listFinancialEvents();
    if (!events.ok) throw new Error(events.message);
    const revenue = events.value.find(event => event.type === "deposit_retained_revenue")!;
    expect(revenue.revenueDeltaMinor).toBe(5000);
    expect(revenue.cashDeltaMinor).toBe(0);
    expect(revenue.ownerCapitalDeltaMinor).toBe(0);
    /* القرار يُعرض بعد التصنيف. */
    expect(await screen.findByText(/صُنّف إيراد مشروع/)).toBeTruthy();
    /* التصنيف الثاني مرفوض — التصحيح هو المسار الموثق. */
    const orders = await store.listOrders();
    if (!orders.ok) throw new Error(orders.message);
    expect(orders.value[0]!.order.retainedMeaning).toBe("revenue");
  });

  it("reclassifies to owner money through a documented correction", async () => {
    await seedCancelledRetainedOrder();
    render(<Harness page={<OrderDetail />} />);
    fireEvent.change(await screen.findByPlaceholderText("مثال: العميل تنازل عن العربون مقابل الإلغاء"), {
      target: { value: "قرار أول" },
    });
    fireEvent.click(await screen.findByRole("button", { name: "إيراد مشروع" }));
    expect(await screen.findByText(/صُنّف إيراد مشروع/)).toBeTruthy();
    fireEvent.click(await screen.findByText(/صحِّح التصنيف بقرار موثق/));
    fireEvent.click(await screen.findByRole("button", { name: "مال مالك" }));
    fireEvent.change(await screen.findByPlaceholderText("مثال: القرار الأول كان متسرعًا"), {
      target: { value: "القرار الأول كان متسرعًا" },
    });
    fireEvent.click(await screen.findByRole("button", { name: /احفظ التصحيح الموثق/ }));
    await waitFor(async () => {
      const events = await store.listFinancialEvents();
      if (!events.ok) throw new Error(events.message);
      expect(
        events.value.filter(
          event => event.type === "deposit_retained_owner" || event.type === "deposit_retained_revenue",
        ),
      ).toHaveLength(3);
    });
    expect(await screen.findByText(/صُنّف مال مالك/)).toBeTruthy();
    const orders = await store.listOrders();
    if (!orders.ok) throw new Error(orders.message);
    expect(orders.value[0]!.order.retainedMeaning).toBe("owner");
  });
});
