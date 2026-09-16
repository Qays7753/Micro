/** EXE-013 (ACC-001 / AUD-NEW-15): اختبار التسوية المحاسبية الشاملة الدائم.
 *
 * السيناريو الخارجي (تقرير التدقيق العميق ٢٠٢٦-٠٩-١٦) صار اختبارًا داخل
 * المستودع يشتغل بالخدمات الحية والمخازن الحقيقية (الذاكرة وfake-indexeddb
 * معًا) ويغطي الحلقات العشر: رصيد افتتاحي، بيع بدين وقبض جزئي، مصروف، شراء
 * بدين مورد ودفعة، استثمار مالك وسحب شخصي، قرض وسداد، مادة واستهلاك، أصل
 * وإهلاك، عربون محتفظ وأثره في نتيجة الفترة، وتصرف في أصل وأثره.
 *
 * لا قيم نهائية مزروعة (No Fixtures of finals): كل رقم متوقَّع يُشتق من
 * تسلسل خدمات حي، والتحقق يطابق المعادلات: الكاش المسجل = المحافظ + غير
 * الموزع، الذمم، القروض، مال المالك، الدفترية، نتيجة الفترة وحالة اكتمالها،
 * وعدم احتساب أي حدث مرتين، ثم فحص النزاهة الشامل ينجح على السيناريو.
 */
import "fake-indexeddb/auto";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { MemoryLocalStore } from "@/storage/local/MemoryLocalStore";
import { IndexedDbLocalStore } from "@/storage/local/IndexedDbLocalStore";
import type { PrototypeLocalStore } from "@/storage/local/types";
import { CashContinuityService } from "@/application/cash/cashContinuityService";
import { SupplierPurchaseService } from "@/application/suppliers/supplierPurchaseService";
import { ProjectFinancialService } from "@/application/finance/projectFinancialService";
import { StatementService } from "@/application/finance/statementService";
import { IntegrityCheckService } from "@/application/finance/integrityCheckService";
import { OwnerEntitlementService } from "@/application/finance/ownerEntitlementService";
import { LoanService } from "@/application/loans/loanService";
import { AssetService } from "@/application/assets/assetService";
import { InventoryMaterialService } from "@/application/inventory/inventoryMaterialService";
import { RetainedDepositService } from "@/application/finance/retainedDepositService";
import {
  calculateCostSnapshot,
  cancelOrder,
  collectDeposit,
  collectRegisteredDebt,
  createCraftOrder,
  registerDebt,
  settleDepositRetain,
  transitionOrder,
  type CraftOrder,
} from "@micro-domain/craft-order/index.js";
import type { StoredCraftOrder } from "@/storage/local/types";

const NOW = "2026-09-16T13:00:00.000Z";
const now = () => NOW;

const databaseName = "micro-prototype-local";
function clearDatabase() {
  return new Promise<void>((resolve, reject) => {
    const request = indexedDB.deleteDatabase(databaseName);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

async function walkAndAssert(store: PrototypeLocalStore): Promise<void> {
  const cash = new CashContinuityService(store, now);
  const suppliers = new SupplierPurchaseService(store, now);
  const finance = new ProjectFinancialService(store, now);
  const statement = new StatementService(store, finance);
  const owner = new OwnerEntitlementService(store, now);
  const loans = new LoanService(store, now);
  const assets = new AssetService(store, now);
  const inventory = new InventoryMaterialService(store, now);
  const retainedDeposits = new RetainedDepositService(store, now);
  const integrity = new IntegrityCheckService(store, finance, statement, cash, now);

  /* ١ — رصيد افتتاحي: محفظة الدرج 200.00 */
  const wallet = await cash.openWallet({
    name: "الدرج",
    kind: "cash_drawer",
    openingMinor: 20000,
    occurredOn: "2026-09-01",
    note: "رصيد بداية",
    operationKey: "cycle-wallet",
  });
  if (!wallet.ok) throw new Error(wallet.message);

  /* ٢ — بيع بدين وقبض جزئي: طلب 50.00، عربون 20.00، دين مسجل 30.00، قبض 10.00
   * (نسخة التكلفة: مواد 10.00 + وقت 5.00 = 15.00) */
  const snapshot = calculateCostSnapshot("cycle-cost", {
    currency: "JOD",
    materialItems: [
      {
        name: "خشب",
        quantity: 1,
        unit: "قطعة",
        unitPriceMinor: 1000,
        priceDate: "2026-08-01",
        source: "user_input",
        confidence: "known",
      },
    ],
    time: { minutes: 60, hourlyRateMinor: 500, confidence: "known" },
    packagingMinor: 0,
    deliveryMinor: 0,
    wasteMinor: 0,
    safetyBufferMinor: 0,
    quantity: 1,
    createdAt: "2026-09-01T09:00:00.000Z",
    freshnessDays: null,
  });
  let order: CraftOrder = createCraftOrder({
    id: "cycle-order",
    customerName: "عميلة",
    itemName: "قطعة",
    specifications: "سلسلة التسوية الشاملة",
    quantity: 1,
    agreedPriceMinor: 5000,
    costSnapshot: snapshot,
    createdAt: "2026-09-01T09:00:00.000Z",
  });
  order = collectDeposit(order, 2000, "cycle-deposit", "2026-09-02T09:00:00.000Z");
  for (const [to, stamp] of [
    ["provisional_agreement", "2026-09-01T10:00:00.000Z"],
    ["confirmed", "2026-09-01T11:00:00.000Z"],
    ["in_progress", "2026-09-03T09:00:00.000Z"],
    ["ready", "2026-09-04T09:00:00.000Z"],
    ["delivered", "2026-09-05T09:00:00.000Z"],
  ] as const)
    order = transitionOrder(order, { to, idempotencyKey: `cycle-${to}`, createdAt: stamp });
  order = registerDebt(order, "cycle-debt", "2026-09-06T09:00:00.000Z");
  order = collectRegisteredDebt(order, 1000, "cycle-debt-collect", "2026-09-10T09:00:00.000Z");
  const storedOrder: StoredCraftOrder = {
    id: order.id,
    order,
    deliveryDate: "2026-09-05",
    agreementSource: "test",
    createdAt: order.createdAt,
    updatedAt: NOW,
  };
  const savedOrder = await store.saveOrder(storedOrder);
  if (!savedOrder.ok) throw new Error("order should save");

  /* ٣ — عربون محتفظ وأثره في نتيجة الفترة: طلب ثانٍ 40.00، عربون 15.00،
   * إلغاء ثم تنازل، ثم تصنيف العربون إيرادًا — الكاش دخل سابقًا بالقبض،
   * والتصنيف يعترف بالإيراد مرة واحدة بلا كاش جديد. */
  let retainedOrder: CraftOrder = createCraftOrder({
    id: "cycle-retained-order",
    customerName: "عميلة ثانية",
    itemName: "شحنة",
    specifications: "عربون محتفظ",
    quantity: 1,
    agreedPriceMinor: 4000,
    costSnapshot: snapshot,
    createdAt: "2026-09-02T09:00:00.000Z",
  });
  retainedOrder = collectDeposit(retainedOrder, 1500, "cycle-retained-dep", "2026-09-02T10:00:00.000Z");
  retainedOrder = cancelOrder(retainedOrder, "العميلة ألغت", "cycle-cancel", "2026-09-03T09:00:00.000Z");
  retainedOrder = settleDepositRetain(retainedOrder, 1500, "تنازل عن العربون", "cycle-retain", NOW);
  const savedRetained = await store.saveOrder({
    id: retainedOrder.id,
    order: retainedOrder,
    deliveryDate: null,
    agreementSource: "test",
    createdAt: retainedOrder.createdAt,
    updatedAt: NOW,
  });
  if (!savedRetained.ok) throw new Error("retained order should save");
  const cashBeforeClassification = await finance.readPosition();
  if (!cashBeforeClassification.ok) throw new Error(cashBeforeClassification.message);
  const classified = await retainedDeposits.classify(
    retainedOrder.id,
    "revenue",
    "عربون محتفظ قُرّر إيرادًا للفترة",
  );
  if (!classified.ok) throw new Error(classified.message);
  const cashAfterClassification = await finance.readPosition();
  if (!cashAfterClassification.ok) throw new Error(cashAfterClassification.message);
  /* عدم الاحتساب مرتين: الإيراد المعترف به لا يضيف كاشًا — الكاش دخل بالقبض. */
  expect(classified.value.event.type).toBe("deposit_retained_revenue");
  expect(classified.value.event.cashDeltaMinor).toBe(0);
  expect(classified.value.event.revenueDeltaMinor).toBe(1500);
  expect(cashAfterClassification.value.recordedCashMinor).toBe(
    cashBeforeClassification.value.recordedCashMinor,
  );

  /* ٤ — مصروف تشغيلي نقدي 3.00 (غير الموزع) */
  const expense = await finance.record({
    type: "operating_expense_cash",
    amountMinor: 300,
    occurredOn: "2026-09-06",
    note: "توصيل",
    counterparty: null,
    relatedEventId: null,
    expenseContext: { relationship: "project", behavior: "variable", purpose: "order", knowledge: "known" },
    idempotencyKey: "cycle-expense",
  });
  if (!expense.ok) throw new Error(expense.message);

  /* ٥ — شراء بدين مورد 12.00، مدفوع الآن 4.00 (غير الموزع) */
  const purchase = await suppliers.recordPurchase({
    supplierName: "مورد السلسلة",
    note: "خامات",
    purchasedOn: "2026-09-07",
    dueOn: null,
    totalMinor: 1200,
    initialPaidMinor: 400,
    idempotencyKey: "cycle-purchase",
  });
  if (!purchase.ok) throw new Error(purchase.message);

  /* ٦ — دفعة مورد 5.00 من المحفظة → الذمة 3.00 */
  const payment = await suppliers.recordPayment({
    purchaseId: purchase.value.id,
    amountMinor: 500,
    occurredOn: "2026-09-08",
    note: "دفعة من المحفظة",
    idempotencyKey: "cycle-pay",
    walletId: wallet.value.wallet.id,
  });
  if (!payment.ok) throw new Error(payment.message);

  /* ٧ — استثمار مالك 100.00 (حدث مالي) + سحب شخصي 15.00 (حركة دفتر مالك من المحفظة) */
  const investment = await finance.record({
    type: "owner_investment_cash",
    amountMinor: 10000,
    occurredOn: "2026-09-03",
    note: "استثمار",
    counterparty: null,
    relatedEventId: null,
    idempotencyKey: "cycle-investment",
  });
  if (!investment.ok) throw new Error(investment.message);
  const draw = await owner.recordMovement({
    kind: "draw",
    amountMinor: 1500,
    walletId: wallet.value.wallet.id,
    occurredOn: "2026-09-09",
    note: "سحب شخصي من المحفظة",
    reason: "owner_draw",
    idempotencyKey: "cycle-owner-draw",
  });
  if (!draw.ok) throw new Error(draw.message);
  expect(draw.value.cashEntry.cashDeltaMinor).toBe(-1500);

  /* ٨ — قرض خارج 20.00 + سداد 8.00 */
  const loan = await loans.create({
    borrowerName: "سليم",
    principalMinor: 2000,
    loanDate: "2026-09-08",
    purposeNote: "قرض سلسلة التسوية",
  });
  if (!loan.ok) throw new Error(loan.message);
  const repayment = await loans.recordRepayment(loan.value.loan.id, {
    amountMinor: 800,
    date: "2026-09-14",
    note: "دفعة سداد",
  });
  if (!repayment.ok) throw new Error(repayment.message);

  /* ٩ — مادة واستهلاك: افتتاح 10 قطع بقيمة 10.00، استهلاك قطعة واحدة للطلب المسلَّم */
  const material = await inventory.openMaterial({
    name: "خشب السلسلة",
    unit: "piece",
    tracking: "tracked",
    opening: {
      quantityState: "confirmed",
      quantityMilli: 10000,
      costState: "known",
      valueMinor: 10000,
      confirmedOn: "2026-09-01",
      sourceNote: "جرد افتتاحي",
    },
    note: "رصيد معلوم",
    operationKey: "cycle-material",
  });
  if (!material.ok) throw new Error(material.message);
  const consumption = await inventory.consume({
    materialId: material.value.material.id,
    orderId: order.id,
    saleId: null,
    reason: "تنفيذ الطلب المسلَّم",
    quantityMilli: 1000,
    occurredOn: "2026-09-05",
    note: "استهلاك مثبت للطلب",
    operationKey: "cycle-consumption",
  });
  if (!consumption.ok) throw new Error(consumption.message);
  expect(consumption.value.quantityDeltaMilli).toBe(-1000);
  expect(consumption.value.valueDeltaMinor).toBe(-1000);

  /* ١٠ — أصلان: الأول 60.00 يُهلك شهرًا (5.00)، والثاني 24.00 يُهلك شهرًا (2.00)
   * ثم يُتخلص منه بمقابل 25.00 → ربح 3.00 في نتيجة الفترة. */
  const machine = await assets.create({
    name: "ماكينة الإنتاج",
    acquisitionAmountMinor: 6000,
    acquisitionKind: "cash",
    purchaseDate: "2026-08-01",
    lifeMonths: 12,
    depreciationStartOn: "2026-08-01",
    note: "أصل السلسلة الأول",
  });
  if (!machine.ok) throw new Error(machine.message);
  const machineDepreciation = await assets.recordDepreciation(machine.value.asset.id, {
    asOf: "2026-09-16",
  });
  if (!machineDepreciation.ok) throw new Error(machineDepreciation.message);
  const table = await assets.create({
    name: "طاولة القص",
    acquisitionAmountMinor: 2400,
    acquisitionKind: "cash",
    purchaseDate: "2026-08-01",
    lifeMonths: 12,
    depreciationStartOn: "2026-08-01",
    note: "أصل السلسلة الثاني — للتخلص",
  });
  if (!table.ok) throw new Error(table.message);
  const tableDepreciation = await assets.recordDepreciation(table.value.asset.id, {
    asOf: "2026-09-16",
  });
  if (!tableDepreciation.ok) throw new Error(tableDepreciation.message);
  const disposal = await assets.dispose(table.value.asset.id, {
    on: "2026-09-16",
    proceedsMinor: 2500,
    reason: "بيع الطاولة بعد الاستبدال",
  });
  if (!disposal.ok) throw new Error(disposal.message);

  /* ════════ التسوية: كل معادلة من تسلسل الخدمات الحية ════════ */
  const position = await finance.readPosition();
  if (!position.ok) throw new Error(position.message);
  const cashOverview = await cash.overview();
  if (!cashOverview.ok) throw new Error(cashOverview.message);
  const period = await finance.readRecordedPeriodResult("2026-09-01", "2026-09-30");
  if (!period.ok) throw new Error(period.message);

  /* المعادلة ١ (MIC): الكاش المسجل = المحافظ + غير الموزع — بالأرقام المشتقة. */
  expect(position.value.recordedCashMinor).toBe(
    cashOverview.value.totalWalletCashMinor + position.value.unallocatedCashMinor,
  );
  /* مسار المصادر: 20000 افتتاح + 3000 قبض طلب (عربون 2000 + دين 1000) + 1500
   * قبض عربون محتفظ + 10000 استثمار − 300 مصروف − 400 دفعة شراء أولية − 500
   * دفعة من المحفظة − 1500 سحب − 2000 قرض + 800 سداد − 6000 أصل أول − 2400
   * أصل ثانٍ + 2500 مقابل التخلص = 24700. */
  expect(position.value.recordedCashMinor).toBe(24700);
  expect(cashOverview.value.totalWalletCashMinor).toBe(18000);
  expect(position.value.unallocatedCashMinor).toBe(6700);
  /* المعادلة ٢: الذمم المدينة = دين الطلب المتبقي (5000 − 3000). */
  expect(position.value.customerReceivablesMinor).toBe(2000);
  /* المعادلة ٣: الذمم الدائنة = المتبقي للمورد (1200 − 400 − 500). */
  expect(position.value.supplierPayablesMinor).toBe(300);
  /* المعادلة ٤: مال المالك = الاستثمار − السحب، مرة واحدة عبر النموذجين. */
  expect(position.value.ownerCapitalRecordedMinor).toBe(8500);
  /* المعادلة ٥: القيمة الدفترية = الأصل الأول بعد إهلاك شهر (الثاني مباع). */
  expect(position.value.assetBookValueMinor).toBe(5500);
  /* المعادلة ٦: القروض القائمة = 2000 − 800. */
  expect(position.value.loansOutstandingMinor).toBe(1200);
  /* المعادلة ٧: الأمانات غير ممسوسة، والعربون المحتفظ صار مصنفًا (لا معلق). */
  expect(position.value.amanahHeldMinor).toBe(0);
  expect(position.value.pendingRetainedDepositsMinor).toBe(0);

  /* المعادلة ٨: نتيجة الفترة وحالة اكتمالها — الإيراد 5000، التكلفة الفعالة
   * 1500 (نسخة 1500 − مواد 1000 + مسجل 1000)، المصروف 300، الإهلاك 700
   * (500 + 200)، نتيجة التخلص +300، إيراد العربون المحتفظ +1500 → 4300. */
  expect(period.value.recognizedRevenueMinor).toBe(5000);
  expect(period.value.snapshotDirectCostMinor).toBe(1500);
  expect(period.value.recordedCogsMinor).toBe(1000);
  expect(period.value.effectiveDirectCostMinor).toBe(1500);
  expect(period.value.recordedOperatingExpenseMinor).toBe(300);
  expect(period.value.assetDepreciationMinor).toBe(700);
  expect(period.value.assetDisposalResultMinor).toBe(300);
  expect(period.value.retainedDepositRevenueMinor).toBe(1500);
  expect(period.value.resultMinor).toBe(4300);
  expect(period.value.status).toBe("incomplete");
  expect(period.value.reasons).toContain("إهلاك مسجّل");
  expect(period.value.reasons).toContain("تخلص من أصل");
  expect(period.value.reasons).toContain("عربون محتفظ كإيراد");

  /* عدم الاحتساب مرتين: الاستهلاك يدخل التكلفة الفعالة مرة واحدة — لا
   * استهلاك غير موزع ولا هدر عام في هذه السلسلة. */
  expect(period.value.unallocatedInventoryCostMinor).toBe(0);
  expect(period.value.generalInventoryWasteMinor).toBe(0);

  /* فحص النزاهة الشامل على السيناريو كاملًا — ينجح بلا فشل واحد. */
  const report = await integrity.run();
  expect(report.overall).toBe("PASS");
  for (const check of report.checks) expect(check.status).not.toBe("FAIL");
}

describe("EXE-013 full-cycle accounting reconciliation (ACC-001 / AUD-NEW-15)", () => {
  beforeEach(() => {
    return clearDatabase();
  });
  afterEach(() => {
    return clearDatabase();
  });

  it("walks the ten loops on MemoryLocalStore and every equation reconciles", async () => {
    await walkAndAssert(new MemoryLocalStore());
  });

  it("walks the same chain on IndexedDbLocalStore (fake-indexeddb) — no behavioral split", async () => {
    await walkAndAssert(new IndexedDbLocalStore());
  });
});

describe("EXE-013 family guard vs legal family paths (AUD-NEW-15)", () => {
  beforeEach(() => {
    return clearDatabase();
  });
  afterEach(() => {
    return clearDatabase();
  });

  it("the general path refuses family events while the loan family reversal keeps working", async () => {
    const store = new MemoryLocalStore();
    const finance = new ProjectFinancialService(store, now);
    const loans = new LoanService(store, now);
    const created = await loans.create({
      borrowerName: "سليم",
      principalMinor: 5000,
      loanDate: "2026-09-01",
      purposeNote: "قرض حرس العائلة",
    });
    if (!created.ok) throw new Error(created.message);
    const repayment = await loans.recordRepayment(created.value.loan.id, {
      amountMinor: 2000,
      date: "2026-09-10",
      note: "سداد أول",
    });
    if (!repayment.ok) throw new Error(repayment.message);
    const repaymentId = repayment.value.loan.repayments[repayment.value.loan.repayments.length - 1]?.id;
    if (!repaymentId) throw new Error("repayment should exist on the loan record");
    const events = await store.listFinancialEvents();
    if (!events.ok) throw new Error(events.message);
    const repaymentEvent = events.value.find(
      event => event.type === "loan_repayment_cash" && event.loanContext?.loanId === created.value.loan.id,
    );
    if (!repaymentEvent) throw new Error("repayment event should exist");
    /* المسار العام مرفوض ويوجه لصفحة القرض. */
    const refused = await finance.reverse({
      sourceEventId: repaymentEvent.id,
      occurredOn: "2026-09-16",
      reason: "محاولة عامة",
      idempotencyKey: "guard-attempt",
    });
    expect(refused.ok).toBe(false);
    if (refused.ok) return;
    expect(refused.message).toContain("صفحة القرض");
    /* المسار القانوني داخل عائلة القرض يعمل كما هو. */
    const legal = await loans.reverseRepayment(created.value.loan.id, repaymentId, "سُجّل سدادان بالخطأ");
    if (!legal.ok) throw new Error(legal.message);
    const overview = await loans.overview();
    if (!overview.ok) throw new Error(overview.message);
    const loanRow = overview.value.find(row => row.loan.id === created.value.loan.id);
    expect(loanRow?.reading.outstandingMinor).toBe(5000);
  });
});
