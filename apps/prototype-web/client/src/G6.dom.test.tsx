/** @vitest-environment jsdom */

/* المجموعة ٦ (البند ١ — S2-04أ): اختبارات سطح التراجع المزدوج — الفعل المزدوج
 * يظهر عند المطابقة الكاملة فقط، برفض صادق عند غيابها، وبعد التأكيد تتحرك
 * المحفظة وغير الموزع والإجمالي معًا — وسجل الطلب يحمل التراجع الموثق. */
import React from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { usePrototypeServices } from "@/app/PrototypeServicesContext";
import { AgreementService } from "@/application/agreements/agreementService";
import { CostService } from "@/application/cost/costService";
import { DraftService } from "@/application/drafts/draftService";
import { FulfillmentService } from "@/application/fulfillment/fulfillmentService";
import { InventoryMaterialService } from "@/application/inventory/inventoryMaterialService";
import { ActualTimeService } from "@/application/time/actualTimeService";
import { ProjectFinancialService } from "@/application/finance/projectFinancialService";
import { CollectionService } from "@/application/collections/collectionService";
import { CollectionReversalService } from "@/application/collections/collectionReversalService";
import { DirectSaleService } from "@/application/direct-sales/directSaleService";
import { UnsavedChangesProvider } from "@/components/forms/UnsavedChangesGuard";
import { MemoryLocalStore } from "@/storage/local/MemoryLocalStore";
import OrderDetail from "@/pages/OrderDetail";
import {
  calculateCostSnapshot,
  collectDeposit,
  collectRemaining,
  createCraftOrder,
  transitionOrder,
} from "@micro-domain/craft-order/index.js";
import { createCashContinuityEntry, createCashWallet } from "@micro-domain/cash-continuity/index.js";

vi.mock("@/app/PrototypeServicesContext", () => ({
  usePrototypeServices: vi.fn(),
}));

const wouterMocks = vi.hoisted(() => ({
  navigate: vi.fn(),
  location: "/orders",
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
const NOW = "2026-09-02T10:00:00.000Z";

let store: MemoryLocalStore;
const contextRef: { current: Record<string, unknown> } = { current: {} };

function G6Harness({ page }: { page: React.ReactNode }) {
  const [version, setVersion] = React.useState(0);
  const costs = new CostService(store, () => NOW);
  const fulfillment = new FulfillmentService(store, () => NOW);
  const projectFinance = new ProjectFinancialService(store, () => NOW);
  const directSales = new DirectSaleService(store, () => NOW);
  contextRef.current = {
    agreements: new AgreementService(store, costs, () => NOW),
    costs,
    fulfillment,
    inventory: new InventoryMaterialService(store, () => NOW),
    actualTime: new ActualTimeService(store, () => NOW),
    drafts: new DraftService(store, () => NOW),
    costEstimates: undefined,
    collectionReversal: new CollectionReversalService(store, projectFinance, () => NOW),
    collections: new CollectionService(store, fulfillment, directSales, projectFinance, () => NOW),
    dataVersion: version,
    notifyDataChanged: () => setVersion(current => current + 1),
  };
  return <UnsavedChangesProvider navigate={wouterMocks.navigate}>{page}</UnsavedChangesProvider>;
}

/** طلب مسلّم بمتبقٍ مع عربون — جاهز للتحصيل من الورقة. */
async function deliveredOrder(store: MemoryLocalStore, id: string) {
  const cost = calculateCostSnapshot(`${id}-cost`, {
    currency: "JOD",
    materialItems: [],
    time: { minutes: 60, hourlyRateMinor: 500, confidence: "known" },
    packagingMinor: 0,
    deliveryMinor: 0,
    wasteMinor: 0,
    safetyBufferMinor: 0,
    quantity: 1,
    createdAt: "2026-08-20T09:00:00.000Z",
    source: "order_confirmation",
    freshnessDays: null,
  });
  let order = createCraftOrder({
    id,
    customerName: "خالد",
    itemName: "طقم مطرز",
    specifications: "اختبار",
    quantity: 1,
    agreedPriceMinor: 10000,
    costSnapshot: cost,
    createdAt: "2026-08-20T09:00:00.000Z",
  });
  order = collectDeposit(order, 2000, `${id}-deposit`, "2026-08-20T10:00:00.000Z");
  for (const [to, stamp] of [
    ["provisional_agreement", "2026-08-20T11:00:00.000Z"],
    ["confirmed", "2026-08-21T09:00:00.000Z"],
    ["in_progress", "2026-08-22T09:00:00.000Z"],
    ["ready", "2026-08-23T09:00:00.000Z"],
    ["delivered", "2026-08-25T09:00:00.000Z"],
  ] as const)
    order = transitionOrder(order, { to, idempotencyKey: `${id}-${to}`, createdAt: stamp });
  const saved = await store.saveOrder({
    id,
    order,
    catalogItemId: null,
    deliveryDate: "2026-08-25",
    agreementSource: "walk_in",
    createdAt: "2026-08-20T09:00:00.000Z",
    updatedAt: "2026-08-25T09:00:00.000Z",
  });
  if (!saved.ok) throw new Error("order should save");
  return saved.value;
}

async function openDrawer(store: MemoryLocalStore) {
  const wallet = createCashWallet({
    id: "drawer-g6",
    name: "درج المحل",
    kind: "cash_drawer",
    createdAt: "2026-09-01T09:00:00.000Z",
    createdOperationKey: "g6-wallet-open",
  });
  const opening = createCashContinuityEntry({
    id: "drawer-g6-opening",
    walletId: wallet.id,
    type: "opening_balance",
    occurredOn: "2026-09-01",
    recordedAt: "2026-09-01T09:00:00.000Z",
    cashDeltaMinor: 5000,
    note: "رصيد بداية",
    operationKey: "g6-wallet-open",
  });
  const committed = await store.commitCashContinuity(wallet, [opening]);
  if (!committed.ok) throw new Error("wallet should commit");
}

describe("G6 — OrderDetail compound collection reversal (S2-04a)", () => {
  beforeEach(() => {
    store = new MemoryLocalStore();
    wouterMocks.location = "/orders";
    wouterMocks.params = {};
    wouterMocks.navigate.mockReset();
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it("full match: compound action moves wallet + keeps unallocated net, refusal hidden, honest preview dims", async () => {
    await deliveredOrder(store, "order-g6-1");
    await openDrawer(store);
    const fulfillment = new FulfillmentService(store, () => NOW);
    const directSales = new DirectSaleService(store, () => NOW);
    const projectFinance = new ProjectFinancialService(store, () => NOW);
    const collections = new CollectionService(store, fulfillment, directSales, projectFinance, () => NOW);
    const collected = await collections.collect({
      sourceKind: "order",
      sourceId: "order-g6-1",
      amountMinor: 3000,
      walletId: "drawer-g6",
      idempotencyKey: "g6-sheet-1",
    });
    expect(collected.ok).toBe(true);

    wouterMocks.location = "/orders/order-g6-1?from=%2Forders";
    wouterMocks.params = { id: "order-g6-1" };
    mockedUsePrototypeServices.mockImplementation(
      () => contextRef.current as unknown as ReturnType<typeof usePrototypeServices>,
    );
    render(<G6Harness page={<OrderDetail />} />);
    await screen.findByRole("heading", { name: /طقم مطرز/ });

    /* S3-12: التصحيحات خلف إفصاح مسمّى — فتحه يظهر أفعال التراجع. */
    fireEvent.click(screen.getByText("تصحيحات موثقة على الطلب"));
    const reversalButton = await screen.findByRole("button", { name: /تراجع عن 30\.00 د\.أ/ });
    fireEvent.click(reversalButton);

    /* المطابقة الكاملة: زر التأكيد المزدوج يظهر مع أبعاد المحفظة وغير الموزع. */
    const compoundConfirm = await screen.findByRole("button", {
      name: "أكّد التراجع عن القبضة والتخصيص",
    });
    expect(screen.getByText(/رصيد محفظة «درج المحل»/)).toBeTruthy();
    expect(screen.getByText("الكاش غير الموزع")).toBeTruthy();
    /* المفرد يبقى متاحًا كخيار بديل صريح. */
    expect(screen.getByRole("button", { name: "تراجع عن القبضة لحالها بدلًا" })).toBeTruthy();

    /* السبب مطلوب كما في كل تصحيح موثق — بلا سبب يُرفض الحفظ. */
    fireEvent.change(screen.getByPlaceholderText("مثال: رجّعت المبلغ للزبون من الدرج"), {
      target: { value: "رجعت المبلغ للزبون من الدرج" },
    });
    fireEvent.click(compoundConfirm);
    await waitFor(async () => {
      const stored = await store.getOrder("order-g6-1");
      expect(stored.ok && stored.value?.order.collectedMinor).toBe(2000);
    });

    /* الحكم الحاسم: المحفظة نقصت 30.00، غير الموزع صافيه لم يتغير،
     * والإجمالي المسجل نقص بمقدار المبلغ المرجّع للعميل. */
    const entries = await store.listCashContinuityEntries();
    expect(entries.ok).toBe(true);
    const allEntries = entries.ok ? entries.value : [];
    const drawer = allEntries.filter(entry => entry.walletId === "drawer-g6");
    const drawerBalance = drawer.reduce((sum, entry) => sum + entry.cashDeltaMinor, 0);
    expect(drawerBalance).toBe(5000);
    const stored = await store.getOrder("order-g6-1");
    expect(stored.ok && stored.value).toBeTruthy();
    const order = stored.ok && stored.value ? stored.value.order : { collectedMinor: -1, events: [] as { type: string }[] };
    expect(order.collectedMinor).toBe(2000);
    expect(order.events.some(event => event.type === "collection_reversed")).toBe(true);
    const reversals = allEntries.filter(entry => entry.type === "reversal" && entry.reversesEntryId);
    expect(reversals.length).toBe(1);
    expect(reversals[0]!.cashDeltaMinor).toBe(-3000);
  });

  it("no allocation: compound hidden with honest one-line reason, single reversal still works", async () => {
    await deliveredOrder(store, "order-g6-2");
    const fulfillment = new FulfillmentService(store, () => NOW);
    const directSales = new DirectSaleService(store, () => NOW);
    const projectFinance = new ProjectFinancialService(store, () => NOW);
    const collections = new CollectionService(store, fulfillment, directSales, projectFinance, () => NOW);
    const collected = await collections.collect({
      sourceKind: "order",
      sourceId: "order-g6-2",
      amountMinor: 3000,
      walletId: null,
      idempotencyKey: "g6-sheet-2",
    });
    expect(collected.ok).toBe(true);

    wouterMocks.location = "/orders/order-g6-2?from=%2Forders";
    wouterMocks.params = { id: "order-g6-2" };
    mockedUsePrototypeServices.mockImplementation(
      () => contextRef.current as unknown as ReturnType<typeof usePrototypeServices>,
    );
    render(<G6Harness page={<OrderDetail />} />);
    await screen.findByRole("heading", { name: /طقم مطرز/ });
    fireEvent.click(screen.getByText("تصحيحات موثقة على الطلب"));
    fireEvent.click(await screen.findByRole("button", { name: /تراجع عن 30\.00 د\.أ/ }));

    /* لا مطابقة: لا زر مزدوج، والسبب الصادق يظهر بسطر واحد. */
    await waitFor(() =>
      expect(screen.getByText(/ما إلها تخصيص بمحفظة/)).toBeTruthy(),
    );
    expect(
      screen.queryByRole("button", { name: "أكّد التراجع عن القبضة والتخصيص" }),
    ).toBeNull();
    /* المفرد يبقى: زر التأكيد الموثق القائم. */
    expect(await screen.findByRole("button", { name: "أكّد التراجع الموثق" })).toBeTruthy();

    fireEvent.change(screen.getByPlaceholderText("مثال: رجّعت المبلغ للزبون من الدرج"), {
      target: { value: "رجعت المبلغ للزبون" },
    });
    fireEvent.click(screen.getByRole("button", { name: "أكّد التراجع الموثق" }));
    await waitFor(async () => {
      const stored = await store.getOrder("order-g6-2");
      expect(stored.ok && stored.value?.order.collectedMinor).toBe(2000);
    });
  });
});


import OwnerEntitlement from "@/pages/OwnerEntitlement";
import OwnerWithdrawalEditor from "@/pages/OwnerWithdrawalEditor";
import { OwnerEntitlementService } from "@/application/finance/ownerEntitlementService";
import { CashContinuityService } from "@/application/cash/cashContinuityService";
import { createFinancialEvent } from "@micro-domain/financial-event/index.js";

vi.mock("@/app/useReturnNavigation", () => ({
  useReturnPath: () => "/finance",
}));

function G6OwnerHarness({ page }: { page: React.ReactNode }) {
  const [version, setVersion] = React.useState(0);
  const projectFinance = new ProjectFinancialService(store, () => NOW);
  const ownerEntitlement = new OwnerEntitlementService(
    store,
    async () => ({ ok: true as const, value: { resultMinor: 0, status: "recorded_only" as const } }),
    () => NOW,
  );
  contextRef.current = {
    ownerEntitlement,
    projectFinance,
    cashContinuity: new CashContinuityService(store, () => NOW),
    agreements: new AgreementService(store, new CostService(store, () => NOW), () => NOW),
    dataVersion: version,
    notifyDataChanged: () => setVersion(current => current + 1),
  };
  return <UnsavedChangesProvider navigate={wouterMocks.navigate}>{page}</UnsavedChangesProvider>;
}

describe("G6 — unified owner money screen «مال المالك» (S2-07)", () => {
  beforeEach(() => {
    store = new MemoryLocalStore();
    wouterMocks.location = "/finance/owner-entitlement";
    wouterMocks.params = {};
    wouterMocks.navigate.mockReset();
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it("renders one unified screen: two separated numbers, both write actions, merged history layer", async () => {
    /* سياسة فعالة + حق مسجل + سحب دفتر (محفظة) + حدث إدخال مالك عام. */
    const ownerEntitlement = new OwnerEntitlementService(
      store,
      async () => ({ ok: true as const, value: { resultMinor: 0, status: "recorded_only" as const } }),
      () => NOW,
    );
    const savedPolicy = await ownerEntitlement.createPolicy({
      id: "g6-policy-1",
      version: 1,
      family: "time_period",
      kind: "monthly",
      amountMinor: 1500,
      percentageBps: null,
      unitLabel: null,
      startsOn: "2026-09-01",
      endsOn: null,
      source: "اتفاق المالك",
      note: "استحقاق شهري",
      status: "active",
      idempotencyKey: "g6-policy",
    } as never);
    expect(savedPolicy.ok).toBe(true);
    const invested = await store.saveFinancialEvent(
      createFinancialEvent({
        id: "g6-own-inv",
        type: "owner_investment_cash",
        amountMinor: 5000,
        occurredOn: "2026-09-01",
        recordedAt: "2026-09-01T08:00:00.000Z",
        idempotencyKey: "g6-own-inv-key",
        note: "أضفت مالًا للمشروع",
        counterparty: null,
        relatedEventId: null,
      }),
    );
    expect(invested.ok).toBe(true);
    await openDrawer(store);
    /* حركة دفتر (سحب قبل تسجيل الحق) — المصدر الثاني للسجل الموحد. */
    const ledgerDraw = await ownerEntitlement.recordMovement({
      kind: "draw",
      amountMinor: 1000,
      walletId: "drawer-g6",
      occurredOn: "2026-09-02",
      note: "سحبت من الدرج",
      reason: "pre_entitlement_draw",
      idempotencyKey: "g6-ledger-draw",
    });
    expect(ledgerDraw.ok).toBe(true);

    mockedUsePrototypeServices.mockImplementation(
      () => contextRef.current as unknown as ReturnType<typeof usePrototypeServices>,
    );
    render(<G6OwnerHarness page={<OwnerEntitlement />} />);
    /* شاشة واحدة باسم واحد ومدخلان للكتابة. */
    await screen.findByRole("heading", { name: "مال المالك" });
    expect(screen.getByText("رأس مالك في المشروع")).toBeTruthy();
    expect(screen.getByText("حق مسجل متبقٍ")).toBeTruthy();
    expect(screen.getByRole("button", { name: "أدخل مالًا للمشروع" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "اسحب لنفسك" })).toBeTruthy();
    /* فعل الإدخال يذهب لمحرر الحدث مع العودة للدفتر الموحد. */
    fireEvent.click(screen.getByRole("button", { name: "أدخل مالًا للمشروع" }));
    expect(wouterMocks.navigate).toHaveBeenCalledWith("/finance/new/owner_investment_cash?from=%2Ffinance%2Fowner-entitlement");
    /* السجل الموحد خلف إفصاح مسمّى ويظهر مصدرَي الحركة معًا. */
    fireEvent.click(screen.getByText("حركات مالك"));
    await waitFor(() => expect(screen.getByText("حدث عام")).toBeTruthy());
    expect(screen.getByText("دفتر المالك")).toBeTruthy();
    expect(screen.getByText(/أضفت مالًا للمشروع/)).toBeTruthy();
    /* حدود مال المالك خلف إفصاح هادئ. */
    expect(screen.getByText("حدود مال المالك")).toBeTruthy();
  });
});

describe("G6 — OwnerWithdrawalEditor pre-entitlement draw (G6-U2-1)", () => {
  beforeEach(() => {
    store = new MemoryLocalStore();
    wouterMocks.location = "/finance/withdraw?from=%2Ffinance";
    wouterMocks.params = {};
    wouterMocks.navigate.mockReset();
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it("active policy with no recorded entitlement: saves honestly as a pre-entitlement draw, no dead end", async () => {
    /* سياسة فعالة بلا أي حق مسجل — الحالة التي كانت طريقًا مسدودًا. */
    const ownerEntitlement = new OwnerEntitlementService(
      store,
      async () => ({ ok: true as const, value: { resultMinor: 0, status: "recorded_only" as const } }),
      () => NOW,
    );
    const policy = await ownerEntitlement.createPolicy({
      id: "g6-policy-2",
      version: 1,
      family: "time_period",
      kind: "monthly",
      amountMinor: 1500,
      percentageBps: null,
      unitLabel: null,
      startsOn: "2026-09-01",
      endsOn: null,
      source: "اتفاق المالك",
      note: "استحقاق شهري",
      status: "active",
      idempotencyKey: "g6-policy-2",
    } as never);
    expect(policy.ok).toBe(true);
    await openDrawer(store);

    mockedUsePrototypeServices.mockImplementation(
      () => contextRef.current as unknown as ReturnType<typeof usePrototypeServices>,
    );
    render(<G6OwnerHarness page={<OwnerWithdrawalEditor />} />);
    await screen.findByRole("heading", { name: "سحب من المشروع لنفسك؟" });
    /* الرسالة الصادقة للحالة: سياسة فعالة بس لا حق مسجل بعد. */
    await waitFor(() =>
      expect(screen.getByText(/سياسة حق مالك فعالة بس ما في حق مسجل بعد/)).toBeTruthy(),
    );
    fireEvent.change(screen.getByLabelText("مبلغ السحب"), { target: { value: "20.00" } });
    fireEvent.click(screen.getByRole("button", { name: "سجّل السحب" }));
    await waitFor(async () => {
      const movements = await store.listOwnerMovements();
      expect(movements.ok && movements.value.length).toBe(1);
    });
    const movements = await store.listOwnerMovements();
    const saved = movements.ok ? movements.value[0] : null;
    expect(saved?.reason).toBe("pre_entitlement_draw");
    expect(saved?.relatedEntitlementId).toBeNull();
    /* الكاش خرج من المحفظة — كتابة موثقة لا رسالة يأس. */
    const entries = await store.listCashContinuityEntries();
    const balance = entries.ok
      ? entries.value.filter(entry => entry.walletId === "drawer-g6").reduce((sum, e) => sum + e.cashDeltaMinor, 0)
      : 0;
    expect(balance).toBe(5000 - 2000);
  });
});

import { RestatementNote } from "@/components/finance/RestatementNote";

describe("G6 — RestatementNote (S2-09)", () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it("renders nothing at count 0 — silence is honest when nothing changed", () => {
    const { container } = render(
      <RestatementNote count={0} netAmountMinor={null} onOpen={() => undefined} />,
    );
    expect(container.firstChild).toBeNull();
  });

  it("states the semantics in plain Arabic: original preserved, correction is a new record, shown number is the net", () => {
    const onOpen = vi.fn();
    render(
      <RestatementNote count={1} netAmountMinor={-5000} scopeLabel="هذه الفترة" onOpen={onOpen} />,
    );
    expect(screen.getByText(/تصحيح موثق واحد/)).toBeTruthy();
    expect(screen.getByText(/الأصل محفوظ كما هو؛ التصحيح سِجِل جديد/)).toBeTruthy();
    expect(screen.getByText(/صافي أثرِهما معًا/)).toBeTruthy();
    expect(screen.getByText(/صافي الأثر/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "افتح الأصل والتصحيح" }));
    expect(onOpen).toHaveBeenCalledTimes(1);
  });

  it("pluralizes honestly and omits the amount when not expressible in one number", () => {
    render(<RestatementNote count={3} netAmountMinor={null} onOpen={() => undefined} />);
    expect(screen.getByText("3 تصحيحات موثقة")).toBeTruthy();
    expect(screen.queryByText(/صافي الأثر/)).toBeNull();
  });
});
