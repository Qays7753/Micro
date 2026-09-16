/** @vitest-environment jsdom */
/** EXE-010 (AUD-NEW-04/05): أسطح عكس التحصيل — لوحة «عكس عربون نشط» في
 * صفحة الطلب تظهر قبل التسليم فقط وتتطلب سببًا، وقسم «عكس تحصيل» في محرر
 * البيع يعرض معاينة الأثر ويكمل العكس بأثر واحد موثق. */
import React from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { usePrototypeServices } from "@/app/PrototypeServicesContext";
import { FulfillmentService } from "@/application/fulfillment/fulfillmentService";
import { ProjectFinancialService } from "@/application/finance/projectFinancialService";
import { CashContinuityService } from "@/application/cash/cashContinuityService";
import { DirectSaleService } from "@/application/direct-sales/directSaleService";
import { CollectionService } from "@/application/collections/collectionService";
import { SaleCollectionReversalService } from "@/application/collections/saleCollectionReversalService";
import { CatalogService } from "@/application/catalog/catalogService";
import { FormDraftService } from "@/application/drafts/formDraftService";
import { RetainedDepositService } from "@/application/finance/retainedDepositService";
import { LoanService } from "@/application/loans/loanService";
import { AssetService } from "@/application/assets/assetService";
import { AgreementService } from "@/application/agreements/agreementService";
import { AgreementContextService } from "@/application/agreements/agreementContextService";
import { InventoryMaterialService } from "@/application/inventory/inventoryMaterialService";
import { ActualTimeService } from "@/application/time/actualTimeService";
import { DraftService } from "@/application/drafts/draftService";
import { CostEstimateService } from "@/application/estimates/costEstimateService";
import { CollectionReversalService } from "@/application/collections/collectionReversalService";
import { DeliveryReviewService } from "@/application/fulfillment/deliveryReviewService";
import { CostService } from "@/application/cost/costService";
import {
  calculateCostSnapshot,
  collectDeposit,
  createCraftOrder,
  transitionOrder,
} from "@micro-domain/craft-order/index.js";
import { MemoryLocalStore } from "@/storage/local/MemoryLocalStore";
import type { StoredCraftOrder } from "@/storage/local/types";
import OrderDetail from "@/pages/OrderDetail";

vi.mock("@/app/PrototypeServicesContext", () => ({
  usePrototypeServices: vi.fn(),
}));

const wouterMocks = vi.hoisted(() => ({
  navigate: vi.fn(),
  location: "/orders/order-exe010",
  params: { id: "order-exe010" } as Record<string, string>,
}));
vi.mock("wouter", () => ({
  useLocation: () => [wouterMocks.location, wouterMocks.navigate],
  useParams: () => wouterMocks.params,
  useSearch: () => "",
}));

const mockedUsePrototypeServices = vi.mocked(usePrototypeServices);
const NOW = "2026-09-16T10:00:00.000Z";

let store: MemoryLocalStore;
const contextRef: { current: Record<string, unknown> } = { current: {} };

function Harness({ page }: { page: React.ReactNode }) {
  const [version, setVersion] = React.useState(0);
  const projectFinance = new ProjectFinancialService(store, () => NOW);
  contextRef.current = {
    retainedDeposits: new RetainedDepositService(store, () => NOW),
    loans: new LoanService(store, () => NOW),
    assets: new AssetService(store, () => NOW),
    agreements: new AgreementService(store, new CostService(store, () => NOW)),
    agreementContext: new AgreementContextService(store, () => NOW),
    inventory: new InventoryMaterialService(store, () => NOW),
    actualTime: new ActualTimeService(store, () => NOW),
    drafts: new DraftService(store, () => NOW),
    costEstimates: new CostEstimateService(store, () => NOW),
    collectionReversal: new CollectionReversalService(store, projectFinance),
    deliveryReview: new DeliveryReviewService(store, () => NOW),
    fulfillment: new FulfillmentService(store, () => NOW),
    projectFinance,
    cashContinuity: new CashContinuityService(store, () => NOW),
    directSales: new DirectSaleService(store, () => NOW),
    saleCollectionReversal: new SaleCollectionReversalService(store, projectFinance, () => NOW),
    catalog: new CatalogService(store, () => NOW),
    formDrafts: new FormDraftService(store),
    dataVersion: version,
    notifyDataChanged: () => setVersion(current => current + 1),
  };
  return <>{page}</>;
}

async function seedActiveOrderWithDeposit(): Promise<StoredCraftOrder> {
  const snapshot = calculateCostSnapshot("snap-exe010", {
    currency: "JOD",
    materialItems: [
      {
        name: "خشب",
        quantity: 1,
        unit: "متر",
        unitPriceMinor: 1000,
        priceDate: "2026-09-01",
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
  let order: ReturnType<typeof createCraftOrder> = createCraftOrder({
    id: "order-exe010",
    customerName: "رنا",
    itemName: "رف كتب",
    specifications: "مقاس عادي",
    quantity: 1,
    agreedPriceMinor: 6000,
    costSnapshot: snapshot,
    createdAt: NOW,
  });
  order = collectDeposit(order, 2000, "order-exe010:dep", NOW);
  order = transitionOrder(order, {
    to: "provisional_agreement",
    idempotencyKey: "order-exe010:prov",
    createdAt: NOW,
  });
  order = transitionOrder(order, {
    to: "confirmed",
    idempotencyKey: "order-exe010:conf",
    createdAt: NOW,
  });
  const stored: StoredCraftOrder = {
    id: "order-exe010",
    order,
    catalogItemId: null,
    deliveryDate: "2026-09-20",
    agreementSource: null,
    createdAt: NOW,
    updatedAt: NOW,
  };
  await store.saveOrder(stored);
  return stored;
}

beforeEach(() => {
  store = new MemoryLocalStore();
  wouterMocks.params = { id: "order-exe010" };
  vi.clearAllMocks();
  mockedUsePrototypeServices.mockImplementation(
    () => contextRef.current as unknown as ReturnType<typeof usePrototypeServices>,
  );
});
afterEach(cleanup);

describe("EXE-010 — active deposit reversal surface in OrderDetail", () => {
  it("shows the reversal panel pre-delivery, requires a reason, and reverses the standing deposit", async () => {
    await seedActiveOrderWithDeposit();
    render(<Harness page={<OrderDetail />} />);
    const summary = await screen.findByText("عكس عربون نشط");
    expect(summary).toBeTruthy();
    fireEvent.click(summary);
    const reverseButton = await screen.findByRole("button", { name: /اعكس العربون/ });
    /* السبب إلزامي — الزر معطل بلا سبب. */
    expect(reverseButton.getAttribute("disabled")).not.toBeNull();
    fireEvent.change(screen.getByLabelText(/سبب العكس/), {
      target: { value: "العربون سُجل على الطلب الخطأ" },
    });
    await waitFor(() =>
      expect(screen.getByRole("button", { name: /اعكس العربون/ }).getAttribute("disabled")).toBeNull(),
    );
    fireEvent.click(screen.getByRole("button", { name: /اعكس العربون/ }));
    /* بعد النجاح: العربون القائم يختفي فتختفي اللوحة، والحقيقة تعرض صفر عربون. */
    await waitFor(async () => {
      const row = await store.getOrder("order-exe010");
      expect(row.ok && row.value ? row.value.order.depositCollectedMinor : -1).toBe(0);
    });
    /* اللوحة تختفي (تيست-آيدي خاص بها) — وتسمية الحدث تبقى في السجل
     * وهو عين المطلوب: الأصل باقٍ ظاهرًا. */
    await waitFor(() => expect(screen.queryByTestId("active-deposit-reversal")).toBeNull());
    expect(await screen.findByText("عكس عربون نشط")).toBeTruthy();
    const stored = await store.getOrder("order-exe010");
    if (!stored.ok || !stored.value) throw new Error("order missing");
    expect(stored.value.order.depositCollectedMinor).toBe(0);
    expect(stored.value.order.collectedMinor).toBe(0);
    expect(stored.value.order.receivableMinor).toBe(6000);
    expect(stored.value.order.events.some(event => event.type === "deposit_reversed")).toBe(true);
  });
});

describe("EXE-010 — sale collection reversal surface in DirectSaleEditor", () => {
  it("lists the wallet-attributed collection with an honest preview and reverses in one documented step", async () => {
    /* محفظة + بيع بدين + تحصيل على المحفظة — المسار الإنتاجي نفسه. */
    const cash = new CashContinuityService(store, () => NOW);
    const wallet = await cash.openWallet({
      name: "درج EXE010-واجهة",
      kind: "cash_drawer",
      openingMinor: 10000,
      occurredOn: "2026-09-15",
      note: "رصيد بداية",
      operationKey: "ui-open",
    });
    if (!wallet.ok) throw new Error(wallet.message);
    const projectFinance = new ProjectFinancialService(store, () => NOW);
    const directSales = new DirectSaleService(store, () => NOW);
    const recorded = await directSales.record({
      itemName: "مزهرية",
      quantity: 1,
      revenueMinor: 8000,
      collectedMinor: 0,
      collectionStatus: "partial_debt",
      catalogItemId: null,
      customerName: "سمر",
      costMinor: 3000,
      occurredOn: "2026-09-15",
      note: "بيع بدين للواجهة",
      idempotencyKey: "ui-sale-record",
    });
    if (!recorded.ok) throw new Error(recorded.message);
    const collections = new CollectionService(
      store,
      new FulfillmentService(store, () => NOW),
      directSales,
      projectFinance,
    );
    const collected = await collections.collect({
      sourceKind: "direct_sale",
      sourceId: recorded.value.id,
      amountMinor: 3000,
      idempotencyKey: "ui-sheet-key",
      walletId: wallet.value.wallet.id,
    });
    if (!collected.ok) throw new Error(collected.message);
    wouterMocks.location = `/direct-sales/${recorded.value.id}`;
    wouterMocks.params = {};
    const { default: DirectSaleEditor } = await import("@/pages/DirectSaleEditor");
    const { UnsavedChangesProvider } = await import("@/components/forms/UnsavedChangesGuard");
    render(
      <Harness
        page={
          <UnsavedChangesProvider navigate={() => undefined}>
            <DirectSaleEditor />
          </UnsavedChangesProvider>
        }
      />,
    );
    const section = await screen.findByText("عكس تحصيل");
    expect(section).toBeTruthy();
    fireEvent.click(section);
    await screen.findByTestId("sale-reversal-preview");
    expect(screen.getByText("معاينة أثر العكس")).toBeTruthy();
    fireEvent.change(screen.getByLabelText(/سبب العكس/), {
      target: { value: "القبض سُجل على البيع الخطأ" },
    });
    fireEvent.click(screen.getByRole("button", { name: /اعكس التحصيل/ }));
    await waitFor(() => expect(screen.getByText(/تم عكس التحصيل/)).toBeTruthy());
    /* السجل بعد العكس: المقبوض صفر والدين عاد. */
    const after = await directSales.get(recorded.value.id);
    if (!after.ok || !after.value) throw new Error("sale missing");
    expect(after.value.collectedMinor).toBe(0);
    expect(after.value.collectionStatus).toBe("partial_debt");
    const entries = await store.listCashContinuityEntries();
    const reversal = entries.ok
      ? entries.value.find(
          entry => entry.type === "reversal" && entry.reason === "القبض سُجل على البيع الخطأ",
        )
      : null;
    expect(reversal).toBeDefined();
    expect(reversal!.cashDeltaMinor).toBe(-3000);
    const user = userEvent.setup();
    void user;
  });
});
