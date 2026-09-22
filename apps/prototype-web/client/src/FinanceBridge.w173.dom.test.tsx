/** @vitest-environment jsdom */

/* FIN-003 (WS-173 — Wave 1): جسر النتيجة المسجلة إلى تغير الكاش المقيس على
 * «ملخص الفترة» — البذرة نفسها كاختبار الخدمة (عالم آب 2026 المتماسك كل رقم
 * فيه محسوب يدويًا: نتيجة 107.00 وكاش مقيس −188.00) فوق خدمات حقيقية
 * وMemoryLocalStore؛ الساعة مثبتة على 2026-08-20 فشهر الصفحة هو آب نفسه،
 * والقراءة لا تكتب سجلًا واحدًا (مطابقة لقطة كاملة قبل/بعد). */
import React from "react";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { usePrototypeServices } from "@/app/PrototypeServicesContext";
import { UnsavedChangesProvider } from "@/components/forms/UnsavedChangesGuard";
import { MemoryLocalStore } from "@/storage/local/MemoryLocalStore";
import { ProjectFinancialService } from "@/application/finance/projectFinancialService";
import { CorrectionHistoryService } from "@/application/finance/correctionHistoryService";
import { OwnerEntitlementService } from "@/application/finance/ownerEntitlementService";
import { G5Service } from "@/application/g5/g5Service";
import { FinancialPulseService } from "@/application/financial-pulse/financialPulseService";
import { FulfillmentService } from "@/application/fulfillment/fulfillmentService";
import { ScheduleService } from "@/application/scheduling/scheduleService";
import { AssetService } from "@/application/assets/assetService";
import { LoanService } from "@/application/loans/loanService";
import { RetainedDepositService } from "@/application/finance/retainedDepositService";
import { ProfitToCashBridgeService } from "@/application/finance/profitToCashBridgeService";
import { InventoryMaterialService } from "@/application/inventory/inventoryMaterialService";
import { SupplierPurchaseService } from "@/application/suppliers/supplierPurchaseService";
import { CashContinuityService } from "@/application/cash/cashContinuityService";
import { AgreementContextService } from "@/application/agreements/agreementContextService";
import { ActivityService } from "@/application/activity/activityService";
import Finance from "@/pages/Finance";
import {
  calculateCostSnapshot,
  collectDeposit,
  collectRemaining,
  createCraftOrder,
  transitionOrder,
  type CraftOrder,
} from "@micro-domain/craft-order/index.js";
import { createDirectSale } from "@micro-domain/direct-sale/index.js";
import { createFinancialEvent } from "@micro-domain/financial-event/index.js";
import { createCashContinuityEntry, createCashWallet } from "@micro-domain/cash-continuity/index.js";
import { createOwnerMovement } from "@micro-domain/owner-entitlement/index.js";
import { createSupplierPurchase } from "@micro-domain/supplier-purchase/index.js";
import type { StoredCraftOrder } from "@/storage/local/types";

vi.mock("@/app/PrototypeServicesContext", () => ({
  usePrototypeServices: vi.fn(),
}));

const wouterMocks = vi.hoisted(() => ({
  navigate: vi.fn(),
  location: "/finance",
  search: "view=period",
  params: {} as Record<string, string>,
}));
vi.mock("wouter", () => ({
  useLocation: () => [wouterMocks.location, wouterMocks.navigate],
  useParams: () => wouterMocks.params,
  useSearch: () => wouterMocks.search,
}));

const mockedUsePrototypeServices = vi.mocked(usePrototypeServices);
/* ساعة الصفحة داخل آب (2026-08-20) فشهر «ملخص الفترة» الافتراضي هو آب نفسه. */
const NOW = "2026-08-20T09:00:00.000Z";
/* ختم التسجيل كما في اختبار الخدمة — لحظة لاحقة لكل occurredOn المزروع. */
const RECORDED_AT = "2026-10-05T09:00:00.000Z";

let store: MemoryLocalStore;
let dataVersion = 0;

function buildServices() {
  const schedules = new ScheduleService(store, () => NOW);
  const projectFinance = new ProjectFinancialService(store, () => NOW);
  const ownerEntitlement = new OwnerEntitlementService(
    store,
    (from: string, to: string) => projectFinance.readRecordedPeriodResult(from, to),
    () => NOW,
  );
  const g5 = new G5Service(store, projectFinance, () => NOW);
  const fulfillment = new FulfillmentService(store, () => NOW);
  return {
    projectFinance,
    correctionHistory: new CorrectionHistoryService(store),
    ownerEntitlement,
    g5,
    financialPulse: new FinancialPulseService(store),
    fulfillment,
    inventory: new InventoryMaterialService(store, () => NOW),
    assets: new AssetService(store, () => NOW),
    loans: new LoanService(store, () => NOW),
    retainedDeposits: new RetainedDepositService(store, () => NOW),
    profitToCashBridge: new ProfitToCashBridgeService(store, () => NOW),
    cashContinuity: new CashContinuityService(store, () => NOW),
    supplierPurchases: new SupplierPurchaseService(store, () => NOW),
    schedules,
    activity: new ActivityService(store),
    agreements: new AgreementContextService(store, () => NOW),
    dataVersion,
    notifyDataChanged: () => {
      dataVersion += 1;
    },
  } as unknown as ReturnType<typeof usePrototypeServices>;
}

function Harness() {
  const services = React.useMemo(() => buildServices(), []);
  mockedUsePrototypeServices.mockImplementation(() => services);
  return (
    <UnsavedChangesProvider navigate={wouterMocks.navigate}>
      <Finance />
    </UnsavedChangesProvider>
  );
}

function knownSnapshot(id: string, timeRateMinor: number) {
  return calculateCostSnapshot(`${id}-cost`, {
    currency: "JOD",
    materialItems: [],
    time: { minutes: 60, hourlyRateMinor: timeRateMinor, confidence: "known" },
    packagingMinor: 0,
    deliveryMinor: 0,
    wasteMinor: 0,
    safetyBufferMinor: 0,
    quantity: 1,
    createdAt: "2026-08-01T09:00:00.000Z",
    freshnessDays: null,
    source: "price_approval",
  });
}

async function saveEvent(store: MemoryLocalStore, input: Parameters<typeof createFinancialEvent>[0]) {
  const saved = await store.saveFinancialEvent(createFinancialEvent(input));
  if (!saved.ok) throw new Error("event should save");
  return saved.value;
}

/** طلب نهائي مسلّم بعربون قبل التسليم وتحصيل متبقٍ بعده — كما في اختبار الخدمة. */
async function saveCollectedOrder(
  store: MemoryLocalStore,
  input: {
    id: string;
    priceMinor: number;
    timeRateMinor?: number;
    createdOn: string;
    depositMinor: number;
    depositAt: string;
    deliveredOn: string;
    remainingMinor: number | null;
    remainingAt: string | null;
  },
): Promise<void> {
  let order: CraftOrder = createCraftOrder({
    id: input.id,
    customerName: "عميلة",
    itemName: "قطعة",
    specifications: "جسر النتيجة إلى الكاش",
    quantity: 1,
    agreedPriceMinor: input.priceMinor,
    costSnapshot: knownSnapshot(input.id, input.timeRateMinor ?? 500),
    createdAt: `${input.createdOn}T08:00:00.000Z`,
  });
  if (input.depositMinor > 0)
    order = collectDeposit(order, input.depositMinor, `${input.id}-deposit`, input.depositAt);
  for (const [to, stamp] of [
    ["provisional_agreement", `${input.createdOn}T08:30:00.000Z`],
    ["confirmed", `${input.createdOn}T09:00:00.000Z`],
    ["in_progress", `${input.deliveredOn}T09:30:00.000Z`],
    ["ready", `${input.deliveredOn}T09:45:00.000Z`],
    ["delivered", `${input.deliveredOn}T10:00:00.000Z`],
  ] as const)
    order = transitionOrder(order, { to, idempotencyKey: `${input.id}-${to}`, createdAt: stamp });
  if (input.remainingMinor !== null && input.remainingAt !== null)
    order = collectRemaining(order, input.remainingMinor, `${input.id}-remaining`, input.remainingAt);
  const stored: StoredCraftOrder = {
    id: order.id,
    order,
    deliveryDate: input.deliveredOn,
    agreementSource: "test",
    catalogItemId: null,
    createdAt: order.createdAt,
    updatedAt: input.remainingAt ?? `${input.deliveredOn}T10:00:00.000Z`,
  };
  const saved = await store.saveOrder(stored);
  if (!saved.ok) throw new Error("order should save");
}

/** عالم آب 2026 المتماسك — النتيجة المسجلة 10,700 والكاش المقيس −18,800 (اختبار الخدمة نفسه). */
async function seedCleanAugustWorld(store: MemoryLocalStore): Promise<void> {
  await saveCollectedOrder(store, {
    id: "aug-order",
    priceMinor: 10_000,
    createdOn: "2026-08-01",
    depositMinor: 2_000,
    depositAt: "2026-08-03T09:00:00.000Z",
    deliveredOn: "2026-08-10",
    remainingMinor: 8_000,
    remainingAt: "2026-08-12T09:00:00.000Z",
  });
  const savedSale = await store.saveDirectSale(
    createDirectSale({
      id: "aug-sale",
      itemName: "قطعة",
      quantity: 1,
      revenueMinor: 5_000,
      collectedMinor: 5_000,
      catalogItemId: null,
      customerName: null,
      costMinor: 2_000,
      occurredOn: "2026-08-15",
      recordedAt: RECORDED_AT,
      note: "بيع مباشر نقدي لاختبار الجسر",
      idempotencyKey: "bridge-aug-sale",
    }),
  );
  if (!savedSale.ok) throw new Error("direct sale should save");
  await saveEvent(store, {
    id: "bridge-ev-expense-cash",
    type: "operating_expense_cash",
    amountMinor: 300,
    occurredOn: "2026-08-18",
    recordedAt: RECORDED_AT,
    idempotencyKey: "bridge-expense-cash",
    note: "توصيل قطع",
    counterparty: null,
    relatedEventId: null,
    expenseContext: {
      relationship: "project",
      behavior: "variable",
      purpose: "project_general",
      knowledge: "known",
    },
  });
  const sharedPayable = await saveEvent(store, {
    id: "bridge-ev-expense-payable",
    type: "operating_expense_payable",
    amountMinor: 1_500,
    occurredOn: "2026-08-20",
    recordedAt: RECORDED_AT,
    idempotencyKey: "bridge-expense-payable",
    note: "كهرباء — حصة مشروع متفق عليها",
    counterparty: "شركة كهرباء",
    relatedEventId: null,
    expenseContext: {
      relationship: "shared",
      behavior: "fixed",
      purpose: "period",
      knowledge: "known",
      sharedProjectShare: { basis: "agreed_fixed_share", note: "حصة ثابتة", allocation: "allocated" },
    },
  });
  await saveEvent(store, {
    id: "bridge-ev-payable-settlement",
    type: "payable_settlement_cash",
    amountMinor: 1_500,
    occurredOn: "2026-09-05",
    recordedAt: RECORDED_AT,
    idempotencyKey: "bridge-payable-settlement",
    note: "تسديد كهرباء آب",
    counterparty: "شركة كهرباء",
    relatedEventId: sharedPayable.id,
  });
  await saveEvent(store, {
    id: "bridge-ev-owner-investment",
    type: "owner_investment_cash",
    amountMinor: 20_000,
    occurredOn: "2026-08-01",
    recordedAt: RECORDED_AT,
    idempotencyKey: "bridge-owner-investment",
    note: "أضفت مالًا للمشروع",
    counterparty: null,
    relatedEventId: null,
  });
  await saveEvent(store, {
    id: "bridge-ev-owner-withdrawal",
    type: "owner_withdrawal_cash",
    amountMinor: 5_000,
    occurredOn: "2026-08-25",
    recordedAt: RECORDED_AT,
    idempotencyKey: "bridge-owner-withdrawal",
    note: "سحبت لنفسي",
    counterparty: null,
    relatedEventId: null,
  });
  await saveEvent(store, {
    id: "bridge-ev-asset-purchase",
    type: "asset_purchase_cash",
    amountMinor: 40_000,
    occurredOn: "2026-08-05",
    recordedAt: RECORDED_AT,
    idempotencyKey: "bridge-asset-purchase",
    note: "مكينة خياطة",
    counterparty: null,
    relatedEventId: null,
    assetContext: { assetId: "bridge-asset-machine", name: "مكينة خياطة" },
  });
  await saveEvent(store, {
    id: "bridge-ev-depreciation-july",
    type: "asset_depreciation",
    amountMinor: 800,
    occurredOn: "2026-07-15",
    recordedAt: RECORDED_AT,
    idempotencyKey: "bridge-depreciation-july",
    note: "إهلاك مكينة — تموز",
    counterparty: null,
    relatedEventId: null,
    assetContext: { assetId: "bridge-asset-machine", name: "مكينة خياطة" },
  });
  await saveEvent(store, {
    id: "bridge-ev-loan-outgoing",
    type: "loan_outgoing_cash",
    amountMinor: 12_000,
    occurredOn: "2026-08-08",
    recordedAt: RECORDED_AT,
    idempotencyKey: "bridge-loan-outgoing",
    note: "أعطيت أخي قرضًا",
    counterparty: null,
    relatedEventId: null,
    loanContext: { loanId: "bridge-loan-1", borrower: "سامي" },
  });
  await saveEvent(store, {
    id: "bridge-ev-loan-repayment",
    type: "loan_repayment_cash",
    amountMinor: 5_000,
    occurredOn: "2026-08-20",
    recordedAt: RECORDED_AT,
    idempotencyKey: "bridge-loan-repayment",
    note: "سداد جزء من القرض",
    counterparty: null,
    relatedEventId: null,
    loanContext: { loanId: "bridge-loan-1", borrower: "سامي" },
  });
  await saveEvent(store, {
    id: "bridge-ev-amanah-held",
    type: "amanah_held_cash",
    amountMinor: 4_000,
    occurredOn: "2026-08-06",
    recordedAt: RECORDED_AT,
    idempotencyKey: "bridge-amanah-held",
    note: "أمانة جارها",
    counterparty: "هدى",
    relatedEventId: null,
  });
  await saveEvent(store, {
    id: "bridge-ev-amanah-released",
    type: "amanah_released_cash",
    amountMinor: 4_000,
    occurredOn: "2026-08-27",
    recordedAt: RECORDED_AT,
    idempotencyKey: "bridge-amanah-released",
    note: "سُلّمت الأمانة",
    counterparty: "هدى",
    relatedEventId: null,
  });
  const savedPurchase = await store.saveSupplierPurchase(
    createSupplierPurchase({
      id: "bridge-purchase",
      supplierName: "مورد الخيط",
      note: "خيط وحرير",
      purchasedOn: "2026-08-14",
      dueOn: null,
      totalMinor: 3_000,
      initialPaidMinor: 1_000,
      recordedAt: RECORDED_AT,
      idempotencyKey: "bridge-purchase-key",
    }),
  );
  if (!savedPurchase.ok) throw new Error("supplier purchase should save");
  const wallet = createCashWallet({
    id: "bridge-drawer",
    name: "درج الكاش",
    kind: "cash_drawer",
    createdAt: "2026-08-01T08:00:00.000Z",
    createdOperationKey: "bridge-drawer-open",
  });
  const adjustment = createCashContinuityEntry({
    id: "bridge-adjustment",
    walletId: wallet.id,
    type: "cash_adjustment",
    occurredOn: "2026-08-30",
    recordedAt: "2026-08-30T18:00:00.000Z",
    cashDeltaMinor: 500,
    note: "تسوية عدّ",
    reason: "فائض عدّ في الدرج",
    operationKey: "bridge-adjustment-op",
  });
  const committedAdjustment = await store.commitCashContinuity(wallet, [adjustment]);
  if (!committedAdjustment.ok) throw new Error("cash adjustment should commit");
  const drawMovement = createOwnerMovement({
    id: "bridge-owner-draw",
    kind: "draw",
    amountMinor: 1_000,
    walletId: wallet.id,
    occurredOn: "2026-08-28",
    recordedAt: "2026-08-28T15:00:00.000Z",
    reason: "owner_draw",
    note: "سحب شخصي من الدرج",
    idempotencyKey: "bridge-owner-draw-key",
  });
  const drawCash = createCashContinuityEntry({
    id: "bridge-owner-draw-cash",
    walletId: wallet.id,
    type: "cash_adjustment",
    occurredOn: "2026-08-28",
    recordedAt: "2026-08-28T15:00:00.000Z",
    cashDeltaMinor: drawMovement.cashDeltaMinor,
    note: "سحب شخصي من الدرج",
    reason: "حركة مالك: owner_draw",
    operationKey: `owner-movement:${drawMovement.idempotencyKey}`,
  });
  const committedDraw = await store.commitOwnerMovement(drawMovement, drawCash);
  if (!committedDraw.ok) throw new Error("owner movement should commit");
}

/** عالم صغير بتراجع محفظة يتيم الأصل — فرق غير مطابق −70.00 وحالة ناقصة. */
async function seedRemainderWorld(store: MemoryLocalStore): Promise<void> {
  await saveCollectedOrder(store, {
    id: "remainder-order",
    priceMinor: 3_000,
    createdOn: "2026-08-01",
    depositMinor: 1_000,
    depositAt: "2026-08-02T09:00:00.000Z",
    deliveredOn: "2026-08-10",
    remainingMinor: 2_000,
    remainingAt: "2026-08-12T09:00:00.000Z",
  });
  const wallet = createCashWallet({
    id: "remainder-drawer",
    name: "درج",
    kind: "cash_drawer",
    createdAt: "2026-08-01T08:00:00.000Z",
    createdOperationKey: "remainder-drawer-open",
  });
  const orphanReversal = createCashContinuityEntry({
    id: "bridge-orphan-reversal",
    walletId: wallet.id,
    type: "reversal",
    occurredOn: "2026-08-15",
    recordedAt: "2026-08-15T19:00:00.000Z",
    cashDeltaMinor: -7_000,
    note: "تراجع عن افتتاح لم يعد موجودًا",
    reason: "تصحيح مفتعل للاختبار",
    operationKey: "bridge-orphan-reversal-op",
    reversesEntryId: "ghost-opening-id-that-never-existed",
  });
  const committed = await store.commitCashContinuity(wallet, [orphanReversal]);
  if (!committed.ok) throw new Error("orphan reversal should commit");
}

async function renderBridgeReady() {
  render(<Harness />);
  await waitFor(() => {
    expect(document.querySelector("[data-bridge-status]")).toBeTruthy();
  });
  return document.querySelector("[data-bridge-status]")!;
}

beforeEach(() => {
  store = new MemoryLocalStore();
  vi.useFakeTimers({ now: new Date(NOW), toFake: ["Date"] });
  dataVersion = 0;
  wouterMocks.search = "view=period";
  wouterMocks.navigate.mockClear();
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.clearAllMocks();
});

describe("Finance — جسر الربح والكاش (FIN-003)", () => {
  it("يعرض النتيجة والكاش المقيس وكل بند بمصدره متوازنًا على عالم آب النظيف", async () => {
    await seedCleanAugustWorld(store);
    const bridge = await renderBridgeReady();
    expect(bridge.getAttribute("data-bridge-status")).toBe("recorded_only");
    expect(bridge.textContent).toContain("نتيجة الفترة المسجلة");
    expect(bridge.textContent).toContain("107.00");
    expect(bridge.textContent).toContain("تغير الكاش المسجل المقيس");
    expect(bridge.textContent).toContain("-188.00");
    expect(bridge.textContent).toContain("متوازنة من السجلات");
    /* بنود الجسر كل بند بمصدره: المالك +140.00 وتوقيت المواد −5.00. */
    expect(document.querySelector('[data-line-id="owner_flows"]')?.textContent).toContain("140.00");
    expect(document.querySelector('[data-line-id="materials_timing"]')?.textContent).toContain("-5.00");
    expect(document.querySelector('[data-line-id="owner_flows"]')?.textContent).toContain("تدفقات المالك");
    /* لا سطر «فرق غير مطابق» على العالم المتوازن. */
    expect(document.querySelector('[data-line-id="remainder"]')).toBeNull();
    /* الترويسة الفرعية بنطاق الأشهر نفسه المعروض على الصفحة. */
    expect(screen.getByText(/^من 08\/2026 إلى 08\/2026$/)).toBeTruthy();
    expect(screen.getByText("لماذا يختلف الربح عن الكاش؟")).toBeTruthy();
  });

  it("يظهر سطر «فرق غير مطابق» موسومًا حين يدخل مبلغ غير قابل للتفسير", async () => {
    await seedRemainderWorld(store);
    const bridge = await renderBridgeReady();
    expect(bridge.getAttribute("data-bridge-status")).toBe("incomplete");
    const remainder = document.querySelector('[data-line-id="remainder"]');
    expect(remainder).toBeTruthy();
    expect(remainder?.getAttribute("data-state")).toBe("unexplained");
    expect(remainder?.textContent).toContain("فرق غير مطابق");
    expect(remainder?.textContent).toContain("-70.00");
    expect(bridge.textContent).toContain("ناقصة");
    expect(bridge.textContent).toContain("تراجع محفظة بلا حركة أصل معروفة");
  });

  it("يقرأ الجسر دون كتابة سجل واحد — مطابقة لقطة كاملة قبل/بعد", async () => {
    await seedCleanAugustWorld(store);
    const before = await store.readSnapshot();
    await renderBridgeReady();
    const after = await store.readSnapshot();
    expect(after.ok && before.ok ? after.value : after).toEqual(before.ok ? before.value : before);
  });
});
