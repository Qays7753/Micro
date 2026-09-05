/**
 * Project financial Application layer. It combines recorded project events with existing order-only
 * collections and receivables without turning either into project profit or unrecorded cash.
 */
import {
  activeSettlementsMinor,
  calculateSharedProjectShareMinor,
  createFinancialEvent,
  createFinancialReversal,
  reversedEventIds,
  summarizeFinancialEvents,
  type FinancialEvent,
  type FinancialEventType,
  type OperatingExpenseContext,
  type AssetEventContext,
  type LoanEventContext,
  type DepositEventContext,
} from "@micro-domain/financial-event/index.js";
import { formatMoneyWithUnit, localDateInAmman as ammanDate} from "@/presentation/formatters";
import { isValidLocalDate } from "@micro-domain/shared/index.js";
import { isCostBackedConsumption, type InventoryMovement } from "@micro-domain/inventory-material/index.js";
import {
  createCashContinuityEntry,
  summarizeCashContinuity,
} from "@micro-domain/cash-continuity/index.js";
import { summarizeLocalCraftOrders } from "@/application/financial-pulse/financialPulseService";
import { calculateBreakEvenUnits } from "@micro-domain/g5/index.js";
import { lastEffectiveDeliveryEvent } from "@/application/fulfillment/deliveryAttribution";
import type { PrototypeLocalStore } from "@/storage/local/types";
import type { OwnerMovement } from "@micro-domain/owner-entitlement/index.js";

export type ProjectFinancialPosition = {
  recordedCashMinor: number;
  customerReceivablesMinor: number;
  supplierPayablesMinor: number;
  ownerCapitalRecordedMinor: number;
  operatingExpensesRecordedMinor: number;
  orderCollectionsMinor: number;
  projectEventCount: number;
  supplierPurchaseCount: number;
  supplierMaterialPayablesMinor: number;
  walletCashMinor: number;
  unallocatedCashMinor: number;
  cashWalletCount: number;
  /* المبدأ ١٣: أمانات بحوزتك — كاش حقيقي في الدرج وليس إيرادًا ولا مالك لك. */
  amanahHeldMinor: number;
  /* ما انتقل من غير الموزع إلى المحافظ بتخصيص صريح (PA-002). */
  allocatedToWalletsMinor: number;
  /* المجموعة ٤ (عقد ٢٩): طبقات مستقلة في المركز — الدفتري للأصول النشطة،
   * والقروض القائمة (ذمم لصالح المشروع)، وعربونات محتفظة بانتظار القرار. */
  assetBookValueMinor: number;
  loansOutstandingMinor: number;
  pendingRetainedDepositsMinor: number;
};
export type CogsStatus = "recorded" | "partial" | "not_available";
export type RecordedPeriodResult = {
  from: string;
  to: string;
  /* القرار ١٠: التقارير القديمة تقول صراحةً إن المخزون لم يكن مُدارًا — لا إخفاء ولا صفر.
   * null = لم يُدر المخزون إطلاقًا؛ وتاريخ لاحق لبداية الفترة = جزء الفترة قبل التفعيل بلا إدارة. */
  inventoryManagedFrom: string | null;
  recognizedRevenueMinor: number;
  recognizedDirectCostMinor: number;
  snapshotDirectCostMinor: number;
  recordedCogsMinor: number;
  effectiveDirectCostMinor: number;
  cogsStatus: CogsStatus;
  cogsMissingOrderCount: number;
  unallocatedInventoryCostMinor: number;
  generalInventoryWasteMinor: number;
  cogsReasons: readonly string[];
  recordedOperatingExpenseMinor: number;
  projectOperatingExpenseMinor: number;
  sharedProjectExpenseMinor: number;
  sharedUnallocatedExpenseMinor: number;
  legacyUnclassifiedExpenseMinor: number;
  sharedEstimatedExpenseCount: number;
  sharedMissingBasisCount: number;
  sharedUnallocatedExpenseCount: number;
  legacyUnclassifiedExpenseCount: number;
  /* F-005 (قرار المالك D-01): البيع المباشر يُعترف بإيراده في نتيجة الفترة بتاريخ
   * البيع نفسه (occurredOn) لا بتاريخ القبض — والملغى مستبعد، والتكلفة غير المعروفة
   * تبقى غير معروفة فلا يُعرض ربحٌ يبدو قاطعًا. قراءة مشتقة فقط: لا سجل يُعاد كتابته. */
  directSaleCount: number;
  directSaleCancelledCount: number;
  directSaleRevenueMinor: number;
  directSaleCostKnownMinor: number;
  directSaleCostUnknownCount: number;
  /* المجموعة ٤ (عقد ٢٩): الإهلاك المسجّل — بند مستقل غير نقدي يخفض النتيجة
   * ولا يدخل بند المصروفات التشغيلية أبدًا. */
  assetDepreciationMinor: number;
  /* خسارة شطب أصل — غير نقدية، مبلغ دفتري مفقود صراحةً. */
  assetWriteOffLossMinor: number;
  /* نتيجة التخلص: المقابل ناقص الدفتري — سالبة خسارة وموجبة ربح، معلنة. */
  assetDisposalResultMinor: number;
  /* إيراد عربون محتفظ به مصنَّف صراحةً — يُعترف مرة واحدة بتاريخ التصنيف. */
  retainedDepositRevenueMinor: number;
  resultMinor: number | null;
  finalOrderCount: number;
  excludedOrderCount: number;
  expenseNeedsReviewCount: number;
  status: "recorded_only" | "incomplete" | "invalid";
  reasons: readonly string[];
};
export type FinancialInsightStatus = "recorded_only" | "incomplete" | "not_available";
export type WorkNameProfitability = {
  itemName: string;
  finalOrderCount: number;
  deliveredQuantity: number;
  recognizedRevenueMinor: number;
  recognizedDirectCostMinor: number;
  directMarginMinor: number;
};
export type RecordedCostComposition = {
  materialMinor: number;
  timeMinor: number;
  packagingMinor: number;
  deliveryMinor: number;
  wasteMinor: number;
  operatingExpenseMinor: number;
};
export type CoverageIndicator = {
  status: FinancialInsightStatus;
  fixedExpenseMinor: number;
  finalDeliveredQuantity: number;
  directMarginMinor: number;
  breakEvenUnits: number | null;
  reasons: readonly string[];
};
export type RecordedLiquidity = {
  status: "recorded_only" | "incomplete";
  recordedCashMinor: number;
  customerReceivablesMinor: number;
  supplierPayablesMinor: number;
  cashCoverageAfterLiabilitiesMinor: number;
  /* S2-05 (تدقيق المجموعة ٥): الأمانات المحتجزة كاش موجود لكنه ليس مالكًا —
   * تظهر هنا لتفسر التغطية بصدق بدل تضخيمها بصمت. */
  amanahHeldMinor: number;
  amanahNotice: string | null;
};
export type FinancialInsights = {
  period: RecordedPeriodResult;
  workNames: readonly WorkNameProfitability[];
  costComposition: RecordedCostComposition;
  inventoryMovementCount: number;
  coverage: CoverageIndicator;
  liquidity: RecordedLiquidity;
};
/* المجموعة ١ (معاينة الأثر): نوع خيارات الحصة انتقل إلى وحدة التوسيع النقية
 * `expenseRecordIntent` مصدرًا واحدًا للحفظ والمعاينة — يُعاد تصديره هنا
 * للتوافق مع المستوردين القائمين. */
export type { SharedExpenseRecordInput } from "@/application/finance/expenseRecordIntent";
import { expandExpenseRecordIntent } from "@/application/finance/expenseRecordIntent";
import type { SharedExpenseRecordInput } from "@/application/finance/expenseRecordIntent";
export type FinancialRecordInput = {
  type: FinancialEventType;
  amountMinor?: number;
  occurredOn: string;
  note: string;
  counterparty: string | null;
  relatedEventId: string | null;
  expenseContext?: OperatingExpenseContext | null;
  /* جولة الاستئناف (F-2): سياقات العائلات المتخصصة تمر عبر التصحيح العام
   * (استرجاع/تعديل) كما تمر عبر التسجيل — الأصل والقرض والعربون أحداث لها
   * سياق إلزامي في عقد المجال، وتغيّره عند الاسترجاع كان يفشل بلا كتابة. */
  assetContext?: AssetEventContext | null;
  loanContext?: LoanEventContext | null;
  depositContext?: DepositEventContext | null;
  idempotencyKey: string;
  sharedExpense?: SharedExpenseRecordInput;
};
export type FinancialReversalInput = {
  sourceEventId: string;
  occurredOn: string;
  reason: string;
  idempotencyKey: string;
};
/* PA-002: توزيع صريح من الكاش غير الموزع إلى محفظة، أو تغطية صرف منها.
 * المجموعة ٢ (§9.1): مصدر التخصيص يُحفظ مع الحركة ليصل دفتر المحفظة للمصدر. */
export type UnallocatedDistributionInput = {
  walletId: string;
  deltaMinor: number;
  note?: string | null;
  operationKey?: string;
  occurredOn?: string;
  sourceRefId?: string | null;
  sourceRefKind?: "sale" | "expense" | "collection" | "order" | null;
  /* المجموعة ٦ (S2-04أ): حدث القبضة المصدر — يربط التخصيص بسطر التحصيل نفسه
   * فيصير التراجع المزدوج قابلًا للتحديد المطابق بلا تخمين. */
  sourceRefLineId?: string | null;
};
/* تعديل/حذف بسيطان (مبدأ المالك ٥.٦): التراجع والبديل في معاملة واحدة ذرّية. */
export type FinancialEditInput = {
  sourceEventId: string;
  amountMinor: number;
  occurredOn: string;
  note: string;
  counterparty: string | null;
  reason?: string | null;
  idempotencyKey: string;
};
export type SettleablePayable = { event: FinancialEvent; remainingMinor: number };
export type FinanceResult<T> =
  | { ok: true; value: T; reused?: boolean }
  | { ok: false; code: "validation_error" | "storage_error"; message: string };

function id(): string {
  return (
    globalThis.crypto?.randomUUID?.() ?? `financial-${Date.now()}-${Math.random().toString(36).slice(2)}`
  );
}
/* F-006 (دورة التدقيق النهائي ٢٠٢٦‑٠٩‑٠١): رسالة حد الأمانة تعرض الرصيد المتاح
 * والمبلغ المطلوب بالأرقام — قرار المالك المعتمد §٥.٢: «رسالة عربية واضحة تُظهر
 * الرصيد المتاح والمبلغ المطلوب». التنسيق بالقرش (منزلتان) هو نفسه سياسة P‑001. */
function amanahLimitMessage(availableMinor: number, requestedMinor: number, action: string): string {
  return `${action} يتجاوز الأمانات بحوزتك — المتاح لديك ${formatMoneyWithUnit(availableMinor)} والمطلوب ${formatMoneyWithUnit(requestedMinor)}. راجع رصيد الأمانات أولًا ثم سجّل ما يطابقه.`;
}
function sharedExpenseHasMissingBasis(event: FinancialEvent) {
  return event.expenseContext?.relationship === "shared" && !event.expenseContext.sharedProjectShare;
}
function sharedExpenseIsUnallocated(event: FinancialEvent) {
  return (
    event.expenseContext?.relationship === "shared" &&
    event.expenseContext.sharedProjectShare?.allocation === "unallocated"
  );
}
function isRecordedOperatingExpense(event: FinancialEvent) {
  return event.operatingExpenseDeltaMinor !== 0;
}
function expenseNeedsReview(event: FinancialEvent) {
  return (
    (event.operatingExpenseDeltaMinor > 0 &&
      (!event.expenseContext ||
        event.expenseContext.knowledge !== "known" ||
        sharedExpenseHasMissingBasis(event))) ||
    sharedExpenseIsUnallocated(event)
  );
}
type PeriodCogsReading = {
  snapshotDirectCostMinor: number;
  recordedCogsMinor: number;
  effectiveDirectCostMinor: number;
  cogsStatus: CogsStatus;
  cogsMissingOrderCount: number;
  unallocatedInventoryCostMinor: number;
  generalInventoryWasteMinor: number;
  cogsReasons: readonly string[];
};
function activeInventoryMovements(movements: readonly InventoryMovement[]) {
  const reversedIds = new Set(
    movements
      .filter(movement => movement.type === "reversal" && movement.reversesMovementId)
      .map(movement => movement.reversesMovementId),
  );
  return movements.filter(movement => movement.type !== "reversal" && !reversedIds.has(movement.id));
}
function derivePeriodCogs(
  finals: readonly {
    order: { id: string; recognizedCostMinor: number; costSnapshot: { materialCostMinor: number } };
  }[],
  movements: readonly InventoryMovement[],
): PeriodCogsReading {
  const active = activeInventoryMovements(movements);
  const finalOrderIds = new Set(finals.map(item => item.order.id));
  const qualified = active.filter(
    movement => isCostBackedConsumption(movement) && finalOrderIds.has(movement.orderId!),
  );
  const byOrder = new Map<string, number>();
  qualified.forEach(movement =>
    byOrder.set(
      movement.orderId!,
      (byOrder.get(movement.orderId!) ?? 0) + Math.abs(movement.valueDeltaMinor),
    ),
  );
  let snapshotDirectCostMinor = 0;
  let effectiveDirectCostMinor = 0;
  let cogsMissingOrderCount = 0;
  for (const item of finals) {
    const observedCogsMinor = byOrder.get(item.order.id) ?? 0;
    snapshotDirectCostMinor += item.order.recognizedCostMinor;
    effectiveDirectCostMinor +=
      observedCogsMinor > 0
        ? item.order.recognizedCostMinor - item.order.costSnapshot.materialCostMinor + observedCogsMinor
        : item.order.recognizedCostMinor;
    if (observedCogsMinor === 0) cogsMissingOrderCount += 1;
  }
  const recordedCogsMinor = qualified.reduce((sum, movement) => sum + Math.abs(movement.valueDeltaMinor), 0);
  const cogsOrderCount = finals.length - cogsMissingOrderCount;
  const cogsStatus: CogsStatus =
    finals.length === 0
      ? "not_available"
      : cogsOrderCount === finals.length
        ? "recorded"
        : cogsOrderCount > 0
          ? "partial"
          : "not_available";
  const unallocatedInventoryCostMinor = active
    .filter(movement => movement.type === "consumption" && !movement.orderId)
    .reduce((sum, movement) => sum + Math.abs(movement.valueDeltaMinor), 0);
  const generalInventoryWasteMinor = active
    .filter(movement => movement.type === "waste")
    .reduce((sum, movement) => sum + Math.abs(movement.valueDeltaMinor), 0);
  const cogsReasons: string[] = [];
  if (finals.length > 0 && cogsStatus === "not_available")
    cogsReasons.push(
      "نسخة تكلفة بديلة",
    );
  if (cogsStatus === "partial")
    cogsReasons.push(
      "تكلفة بيع جزئية",
    );
  if (unallocatedInventoryCostMinor > 0)
    cogsReasons.push("استهلاك غير موزع");
  if (generalInventoryWasteMinor > 0)
    cogsReasons.push("هدر عام");
  return {
    snapshotDirectCostMinor,
    recordedCogsMinor,
    effectiveDirectCostMinor,
    cogsStatus,
    cogsMissingOrderCount,
    unallocatedInventoryCostMinor,
    generalInventoryWasteMinor,
    cogsReasons,
  };
}

export class ProjectFinancialService {
  constructor(
    private readonly store: PrototypeLocalStore,
    private readonly now: () => string = () => new Date().toISOString(),
  ) {}

  async readPosition(): Promise<FinanceResult<ProjectFinancialPosition>> {
    const [
      ordersResult,
      eventsResult,
      purchasesResult,
      walletsResult,
      continuityResult,
      ownerMovementsResult,
      directSalesResult,
    ] = await Promise.all([
      this.store.listOrders(),
      this.store.listFinancialEvents(),
      this.store.listSupplierPurchases(),
      this.store.listCashWallets(),
      this.store.listCashContinuityEntries(),
      this.store.listOwnerMovements(),
      this.store.listDirectSales(),
    ]);
    if (
      !ordersResult.ok ||
      !eventsResult.ok ||
      !purchasesResult.ok ||
      !walletsResult.ok ||
      !continuityResult.ok ||
      !ownerMovementsResult.ok ||
      !directSalesResult.ok
    )
      return { ok: false, code: "storage_error", message: "تعذر قراءة السجلات المالية المحلية." };
    const orderPulse = summarizeLocalCraftOrders(ordersResult.value);
    const project = summarizeFinancialEvents(eventsResult.value);
    /* §٥-١٣ (المرحلة أ): تحصيل البيع المباشر كاش كأي تحصيل — يدخل الكاش غير الموزع
     * نظير تحصيلات الطلبات. البيع الملغى لا يُحتسب: نقضُه ينقض قبضه. */
    const activeDirectSales = directSalesResult.value.filter(
      sale => (sale.status ?? "active") === "active",
    );
    const directSalesCashMinor = activeDirectSales.reduce(
      (sum, sale) => sum + sale.collectedMinor,
      0,
    );
    /* X-06 (و٤): ما قرّره المالك دَينًا من فرق البيع المباشر يظهر في «لي عند العملاء» —
     * المال المستحق لا يُخفى. و«يحتاج مراجعة» فرق لم يُقرَّر بعد فلا يدخل الذمم. */
    const directSalesReceivablesMinor = activeDirectSales
      .filter(sale => sale.collectionStatus === "partial_debt")
      .reduce((sum, sale) => sum + (sale.revenueMinor - sale.collectedMinor), 0);
    const supplierMaterialPayablesMinor = purchasesResult.value.reduce(
      (sum, purchase) => sum + purchase.payableMinor,
      0,
    );
    const supplierPurchaseCashPaidMinor = purchasesResult.value.reduce(
      (sum, purchase) => sum + purchase.paidMinor,
      0,
    );
    /* PA-002: «تخصيص» صريح ينقل القيمة من غير الموزع إلى محفظة — الإجمالي لا يتغير.
     * (إصلاح تكاملي — مجموعة ٤): التخصيص المُتراجَع يُستبعد من المجموع — التراجع عن
     * تخصيصٍ يجب أن يعيد قيمته إلى «غير الموزع» لا أن تختفي من الإجمالي المسجل
     * (حارس «التخصيص لا يغيّر الإجمالي» يشمل التراجع عنه). */
    const reversedEntryIds = new Set(
      continuityResult.value
        .filter(entry => entry.type === "reversal" && entry.reversesEntryId)
        .map(entry => entry.reversesEntryId as string),
    );
    const allocatedToWalletsMinor = continuityResult.value
      .filter(entry => entry.type === "allocation" && !reversedEntryIds.has(entry.id))
      .reduce((sum, entry) => sum + entry.cashDeltaMinor, 0);
    const unallocatedCashMinor =
      orderPulse.registeredCollectionsMinor +
      project.cashMinor -
      supplierPurchaseCashPaidMinor +
      directSalesCashMinor -
      allocatedToWalletsMinor;
    const walletCashMinor = continuityResult.value.reduce((sum, entry) => sum + entry.cashDeltaMinor, 0);
    const ownerCapitalFromMovementsMinor = ownerMovementsResult.value.reduce(
      (sum: number, movement: OwnerMovement) => sum + movement.ownerCapitalDeltaMinor,
      0,
    );
    /* المجموعة ٤ (عقد ٢٩): العربونات المحتفظة بلا قرار — كاش محتفظ به بلا معنى
     * بعد؛ ظاهرة هنا حتى يختار المالك، لا مدفونة في المجموعات. */
    const pendingRetainedDepositsMinor = ordersResult.value
      .filter(
        stored =>
          stored.order.status === "cancelled" &&
          stored.order.depositSettlement === "retain_deposit" &&
          (stored.order.retainedMeaning ?? null) === null,
      )
      .reduce((sum, stored) => sum + stored.order.depositCollectedMinor, 0);
    return {
      ok: true,
      value: {
        recordedCashMinor: unallocatedCashMinor + walletCashMinor,
        customerReceivablesMinor: orderPulse.registeredDebtMinor + directSalesReceivablesMinor,
        supplierPayablesMinor: project.payableMinor + supplierMaterialPayablesMinor,
        ownerCapitalRecordedMinor: project.ownerCapitalMinor + ownerCapitalFromMovementsMinor,
        operatingExpensesRecordedMinor: project.operatingExpenseMinor,
        orderCollectionsMinor: orderPulse.registeredCollectionsMinor,
        projectEventCount: project.eventCount,
        supplierPurchaseCount: purchasesResult.value.length,
        supplierMaterialPayablesMinor,
        walletCashMinor,
        unallocatedCashMinor,
        cashWalletCount: walletsResult.value.length,
        amanahHeldMinor: project.amanahMinor,
        allocatedToWalletsMinor,
        assetBookValueMinor: project.assetMinor,
        loansOutstandingMinor: project.loanMinor,
        pendingRetainedDepositsMinor,
      },
    };
  }

  async listEvents(): Promise<FinanceResult<readonly FinancialEvent[]>> {
    const result = await this.store.listFinancialEvents();
    return result.ok
      ? { ok: true, value: result.value }
      : { ok: false, code: "storage_error", message: "تعذر قراءة سجل الأحداث المالية." };
  }

  async listSettleablePayables(): Promise<FinanceResult<readonly SettleablePayable[]>> {
    const events = await this.store.listFinancialEvents();
    if (!events.ok) return { ok: false, code: "storage_error", message: "تعذر قراءة سجل الأحداث المالية." };
    const reversedIds = reversedEventIds(events.value);
    return {
      ok: true,
      value: events.value
        .filter(
          event =>
            event.type === "operating_expense_payable" &&
            event.payableDeltaMinor > 0 &&
            !reversedIds.has(event.id),
        )
        .map(event => ({
          event,
          remainingMinor: event.amountMinor - activeSettlementsMinor(events.value, event.id),
        }))
        .filter(payable => payable.remainingMinor > 0),
    };
  }

  async readRecordedPeriodResult(from: string, to: string): Promise<FinanceResult<RecordedPeriodResult>> {
    const [ordersResult, eventsResult, movementsResult, activationResult, materialsResult, directSalesResult] =
      await Promise.all([
        this.store.listOrders(),
        this.store.listFinancialEvents(),
        this.store.listInventoryMovements(),
        this.store.getInventoryActivation(),
        this.store.listMaterials(),
        this.store.listDirectSales(),
      ]);
    if (
      !ordersResult.ok ||
      !eventsResult.ok ||
      !movementsResult.ok ||
      !activationResult.ok ||
      !materialsResult.ok ||
      !directSalesResult.ok
    )
      return { ok: false, code: "storage_error", message: "تعذر قراءة نتيجة الفترة المحلية." };
    /* القرار ٩/١٠: تاريخ بدء إدارة المخزون — المعلن صراحة أو أقدم دليل للموجود القائم. */
    const inventoryManagedFrom =
      activationResult.value?.activatedOn ??
      ((): string | null => {
        const evidence = [
          ...movementsResult.value.map(movement => movement.occurredOn),
          ...materialsResult.value.map(material => material.createdAt.slice(0, 10)),
        ].filter(date => date);
        return evidence.length > 0 ? evidence.slice().sort()[0]! : null;
      })();
    if (!isValidLocalDate(from) || !isValidLocalDate(to) || from > to)
      return {
        ok: true,
        value: {
          from,
          to,
          inventoryManagedFrom: null,
          recognizedRevenueMinor: 0,
          recognizedDirectCostMinor: 0,
          snapshotDirectCostMinor: 0,
          recordedCogsMinor: 0,
          effectiveDirectCostMinor: 0,
          cogsStatus: "not_available",
          cogsMissingOrderCount: 0,
          unallocatedInventoryCostMinor: 0,
          generalInventoryWasteMinor: 0,
          cogsReasons: [],
          recordedOperatingExpenseMinor: 0,
          projectOperatingExpenseMinor: 0,
          sharedProjectExpenseMinor: 0,
          sharedUnallocatedExpenseMinor: 0,
          legacyUnclassifiedExpenseMinor: 0,
          sharedEstimatedExpenseCount: 0,
          sharedMissingBasisCount: 0,
          sharedUnallocatedExpenseCount: 0,
          legacyUnclassifiedExpenseCount: 0,
          directSaleCount: 0,
          directSaleCancelledCount: 0,
          directSaleRevenueMinor: 0,
          directSaleCostKnownMinor: 0,
          directSaleCostUnknownCount: 0,
          assetDepreciationMinor: 0,
          assetWriteOffLossMinor: 0,
          assetDisposalResultMinor: 0,
          retainedDepositRevenueMinor: 0,
          resultMinor: null,
          finalOrderCount: 0,
          excludedOrderCount: 0,
          expenseNeedsReviewCount: 0,
          status: "invalid",
          reasons: ["فترة غير صالحة"],
        },
      };
    const inPeriod = (date: string) => date >= from && date <= to;
    /* F-005: الاعتراف بتاريخ البيع — القبض اللاحق لا يُنشئ إيرادًا ثانيًا ولا يُحسب
     * مرتين: القبض يدخل الكاش والمركز فقط، والإيراد يُعترف مرة واحدة هنا. */
    const directSalesInPeriod = directSalesResult.value.filter(sale => inPeriod(sale.occurredOn));
    const activeDirectSales = directSalesInPeriod.filter(sale => (sale.status ?? "active") === "active");
    const directSaleCancelledCount = directSalesInPeriod.length - activeDirectSales.length;
    const directSaleRevenueMinor = activeDirectSales.reduce((total, sale) => total + sale.revenueMinor, 0);
    const directSaleCostKnownMinor = activeDirectSales.reduce(
      (total, sale) => total + (sale.costMinor ?? 0),
      0,
    );
    /* التكلفة المجهولة تبقى مجهولة: جمعها هنا يعني «مجموع المعروف منها» لا «التكلفة صفر». */
    const directSaleCostUnknownCount = activeDirectSales.filter(sale => sale.costMinor === null).length;
    /* المجموعة ٦ (تدقيق A1 — FT-01): الإيراد المعاد الاعتراف به يُعزى لآخر تسليم
     * ساري (غير معكوس) — لا لأول حدث تسليم قديم قد يكون معكوسًا. */
    const delivered = ordersResult.value
      .map(stored => {
        const event = lastEffectiveDeliveryEvent(stored.order);
        return { order: stored.order, deliveredAt: event ? ammanDate(event.createdAt) : null };
      })
      .filter(item => item.deliveredAt !== null && inPeriod(item.deliveredAt));
    const finals = delivered.filter(item => item.order.resultStatus === "final");
    const excludedOrderCount = delivered.length - finals.length;
    const recognizedRevenueMinor = finals.reduce(
      (total, item) => total + item.order.recognizedRevenueMinor,
      0,
    );
    const recognizedDirectCostMinor = finals.reduce(
      (total, item) => total + item.order.recognizedCostMinor,
      0,
    );
    const cogs = derivePeriodCogs(finals, movementsResult.value);
    const periodEvents = eventsResult.value.filter(event => inPeriod(event.occurredOn));
    const operatingEvents = periodEvents.filter(event => isRecordedOperatingExpense(event));
    const sharedUnallocatedEvents = periodEvents.filter(sharedExpenseIsUnallocated);
    const sharedUnallocatedSources = sharedUnallocatedEvents.filter(
      event => event.correctionType !== "reverse",
    );
    const reviewableOperatingEvents = [
      ...operatingEvents.filter(event => event.operatingExpenseDeltaMinor > 0),
      ...sharedUnallocatedSources,
    ];
    const projectEvents = operatingEvents.filter(event => event.expenseContext?.relationship === "project");
    const sharedEvents = operatingEvents.filter(event => event.expenseContext?.relationship === "shared");
    const legacyEvents = operatingEvents.filter(event => !event.expenseContext);
    const recordedOperatingExpenseMinor = operatingEvents.reduce(
      (total, event) => total + event.operatingExpenseDeltaMinor,
      0,
    );
    const projectOperatingExpenseMinor = projectEvents.reduce(
      (total, event) => total + event.operatingExpenseDeltaMinor,
      0,
    );
    const sharedProjectExpenseMinor = sharedEvents.reduce(
      (total, event) => total + event.operatingExpenseDeltaMinor,
      0,
    );
    const sharedUnallocatedExpenseMinor = sharedUnallocatedEvents.reduce(
      (total, event) =>
        total +
        (event.correctionType === "reverse" ? -1 : 1) *
          (event.expenseContext?.sharedProjectShare?.totalAmountMinor ?? event.amountMinor),
      0,
    );
    const legacyUnclassifiedExpenseMinor = legacyEvents.reduce(
      (total, event) => total + event.operatingExpenseDeltaMinor,
      0,
    );
    const sharedEstimatedExpenseCount = reviewableOperatingEvents.filter(
      event =>
        event.expenseContext?.relationship === "shared" &&
        event.expenseContext.knowledge !== "known" &&
        !sharedExpenseIsUnallocated(event),
    ).length;
    const sharedMissingBasisCount = reviewableOperatingEvents.filter(
      event => event.expenseContext?.relationship === "shared" && sharedExpenseHasMissingBasis(event),
    ).length;
    const sharedUnallocatedExpenseCount = sharedUnallocatedSources.length;
    const legacyUnclassifiedExpenseCount = reviewableOperatingEvents.filter(
      event => !event.expenseContext,
    ).length;
    const expenseNeedsReviewCount = reviewableOperatingEvents.filter(expenseNeedsReview).length;
    /* المجموعة ٤ (عقد ٢٩): أحداث الطبقات الجديدة النشطة داخل الفترة — الإهلاك
     * والشطب والتخلص وتصنيف العربون؛ معكوسة أو معكوس أثرها لا تُحتسب. */
    const reversedIds = reversedEventIds(eventsResult.value);
    const activePeriodGroup4Events = periodEvents.filter(
      event =>
        event.correctionType !== "reverse" &&
        !reversedIds.has(event.id) &&
        (event.type === "asset_depreciation" ||
          event.type === "asset_writeoff" ||
          event.type === "asset_disposal_cash" ||
          event.type === "deposit_retained_revenue"),
    );
    const assetDepreciationMinor = activePeriodGroup4Events
      .filter(event => event.type === "asset_depreciation")
      .reduce((sum, event) => sum + event.amountMinor, 0);
    const assetWriteOffLossMinor = activePeriodGroup4Events
      .filter(event => event.type === "asset_writeoff")
      .reduce((sum, event) => sum + event.amountMinor, 0);
    const assetDisposalResultMinor = activePeriodGroup4Events
      .filter(event => event.type === "asset_disposal_cash")
      .reduce((sum, event) => sum + (event.amountMinor - (event.assetContext?.bookValueMinor ?? 0)), 0);
    const retainedDepositRevenueMinor = activePeriodGroup4Events
      .filter(event => event.type === "deposit_retained_revenue")
      .reduce((sum, event) => sum + (event.revenueDeltaMinor ?? event.amountMinor), 0);
    const reasons: string[] = [];
    if (excludedOrderCount > 0) reasons.push("طلبات مستبعدة");
    if (directSaleCostUnknownCount > 0) reasons.push("بيع مباشر بتكلفة غير معروفة");
    if (sharedEstimatedExpenseCount > 0) reasons.push("حصة تقديرية");
    if (sharedMissingBasisCount > 0) reasons.push("حصة بلا مصدر");
    if (sharedUnallocatedExpenseCount > 0)
      reasons.push("حصة غير موزعة");
    if (legacyUnclassifiedExpenseCount > 0) reasons.push("مصروفات غير مصنفة");
    /* المجموعة ٤: بنود مستقلة معلنة — لا تُخلط بالمصروفات التشغيلية. */
    if (assetDepreciationMinor > 0) reasons.push("إهلاك مسجّل");
    if (assetWriteOffLossMinor > 0) reasons.push("شطب أصل");
    if (assetDisposalResultMinor !== 0) reasons.push("تخلص من أصل");
    if (retainedDepositRevenueMinor > 0) reasons.push("عربون محتفظ كإيراد");
    const incomplete = reasons.length > 0;
    return {
      ok: true,
      value: {
        from,
        to,
        inventoryManagedFrom,
        recognizedRevenueMinor,
        recognizedDirectCostMinor,
        snapshotDirectCostMinor: cogs.snapshotDirectCostMinor,
        recordedCogsMinor: cogs.recordedCogsMinor,
        effectiveDirectCostMinor: cogs.effectiveDirectCostMinor,
        cogsStatus: cogs.cogsStatus,
        cogsMissingOrderCount: cogs.cogsMissingOrderCount,
        unallocatedInventoryCostMinor: cogs.unallocatedInventoryCostMinor,
        generalInventoryWasteMinor: cogs.generalInventoryWasteMinor,
        cogsReasons: cogs.cogsReasons,
        recordedOperatingExpenseMinor,
        projectOperatingExpenseMinor,
        sharedProjectExpenseMinor,
        sharedUnallocatedExpenseMinor,
        legacyUnclassifiedExpenseMinor,
        sharedEstimatedExpenseCount,
        sharedMissingBasisCount,
        sharedUnallocatedExpenseCount,
        legacyUnclassifiedExpenseCount,
        directSaleCount: activeDirectSales.length,
        directSaleCancelledCount,
        directSaleRevenueMinor,
        directSaleCostKnownMinor,
        directSaleCostUnknownCount,
        assetDepreciationMinor,
        assetWriteOffLossMinor,
        assetDisposalResultMinor,
        retainedDepositRevenueMinor,
        /* F-005 + المجموعة ٤: النتيجة تتضمن إيراد البيع المباشر وتكلفته المعروفة،
         * وتخصم الإهلاك المسجّل وخسارة الشطب وتضيف نتيجة التخلص وإيراد عربون
         * محتفظ مصنَّف — كلها بنود صريحة بلا اختراع كاش. وأي بيع بتكلفة مجهولة
         * يمنع عرض رقم نهائي — «غير متاح» لا ربحًا متوهّمًا. */
        resultMinor:
          directSaleCostUnknownCount > 0
            ? null
            : recognizedRevenueMinor +
              directSaleRevenueMinor -
              cogs.effectiveDirectCostMinor -
              directSaleCostKnownMinor -
              recordedOperatingExpenseMinor -
              assetDepreciationMinor -
              assetWriteOffLossMinor +
              assetDisposalResultMinor +
              retainedDepositRevenueMinor,
        finalOrderCount: finals.length,
        excludedOrderCount,
        expenseNeedsReviewCount,
        status: incomplete ? "incomplete" : "recorded_only",
        reasons,
      },
    };
  }

  async readFinancialInsights(from: string, to: string): Promise<FinanceResult<FinancialInsights>> {
    const [periodResult, ordersResult, eventsResult, movementsResult, positionResult] = await Promise.all([
      this.readRecordedPeriodResult(from, to),
      this.store.listOrders(),
      this.store.listFinancialEvents(),
      this.store.listInventoryMovements(),
      this.readPosition(),
    ]);
    if (!periodResult.ok || !ordersResult.ok || !eventsResult.ok || !movementsResult.ok || !positionResult.ok)
      return { ok: false, code: "storage_error", message: "تعذر قراءة مؤشرات الفترة المحلية." };
    const inPeriod = (date: string) => date >= from && date <= to;
    /* FT-01 (المجموعة ٦): آخر تسليم ساري — انظر أعلاه. */
    const delivered = ordersResult.value
      .map(stored => {
        const event = lastEffectiveDeliveryEvent(stored.order);
        return { order: stored.order, deliveredAt: event ? ammanDate(event.createdAt) : null };
      })
      .filter(item => item.deliveredAt !== null && inPeriod(item.deliveredAt));
    const finals = delivered.filter(item => item.order.resultStatus === "final");
    const grouped = new Map<string, WorkNameProfitability>();
    let materialMinor = 0;
    let timeMinor = 0;
    let packagingMinor = 0;
    let deliveryMinor = 0;
    let wasteMinor = 0;
    for (const { order } of finals) {
      const prior = grouped.get(order.itemName) ?? {
        itemName: order.itemName,
        finalOrderCount: 0,
        deliveredQuantity: 0,
        recognizedRevenueMinor: 0,
        recognizedDirectCostMinor: 0,
        directMarginMinor: 0,
      };
      const next = {
        ...prior,
        finalOrderCount: prior.finalOrderCount + 1,
        deliveredQuantity: prior.deliveredQuantity + order.quantity,
        recognizedRevenueMinor: prior.recognizedRevenueMinor + order.recognizedRevenueMinor,
        recognizedDirectCostMinor: prior.recognizedDirectCostMinor + order.recognizedCostMinor,
        directMarginMinor: prior.directMarginMinor + order.recognizedRevenueMinor - order.recognizedCostMinor,
      };
      grouped.set(order.itemName, next);
      materialMinor += order.costSnapshot.materialCostMinor;
      timeMinor += order.costSnapshot.timeCostMinor;
      packagingMinor += order.costSnapshot.packagingMinor;
      deliveryMinor += order.costSnapshot.deliveryMinor;
      wasteMinor += order.costSnapshot.wasteMinor;
    }
    const periodEvents = eventsResult.value.filter(event => inPeriod(event.occurredOn));
    const operating = periodEvents.filter(isRecordedOperatingExpense);
    const reviewableOperating = operating.filter(event => event.operatingExpenseDeltaMinor > 0);
    const operatingExpenseMinor = operating.reduce(
      (total, event) => total + event.operatingExpenseDeltaMinor,
      0,
    );
    const fixed = operating.filter(event => event.expenseContext?.behavior === "fixed");
    const reviewableFixed = reviewableOperating.filter(event => event.expenseContext?.behavior === "fixed");
    const fixedExpenseMinor = fixed.reduce((total, event) => total + event.operatingExpenseDeltaMinor, 0);
    const finalDeliveredQuantity = finals.reduce((total, item) => total + item.order.quantity, 0);
    const directMarginMinor = finals.reduce(
      (total, item) => total + item.order.recognizedRevenueMinor - item.order.recognizedCostMinor,
      0,
    );
    const movementCount = movementsResult.value.filter(movement => inPeriod(movement.occurredOn)).length;
    const coverageReasons: string[] = [];
    if (finals.length === 0) coverageReasons.push("لا توجد طلبات مسلّمة بنتيجة نهائية في الفترة.");
    if (periodResult.value.excludedOrderCount > 0)
      coverageReasons.push("طلبات مستبعدة");
    if (reviewableFixed.some(event => event.expenseContext?.knowledge !== "known"))
      coverageReasons.push("مصروفات تحتاج مراجعة");
    if (
      reviewableOperating.some(
        event =>
          event.expenseContext?.behavior === "variable" ||
          event.expenseContext?.behavior === "mixed" ||
          event.expenseContext?.behavior === "unknown",
      )
    )
      coverageReasons.push("مصروفات غير موزعة");
    if (movementCount > 0)
      coverageReasons.push(
        "حركات مخزون فعلية",
      );
    if (directMarginMinor <= 0) coverageReasons.push("هامش غير موجب");
    if (fixedExpenseMinor <= 0) coverageReasons.push("بلا مصروفات ثابتة");
    const coverageStatus: FinancialInsightStatus =
      finals.length === 0 || fixedExpenseMinor <= 0
        ? "not_available"
        : coverageReasons.length > 0
          ? "incomplete"
          : "recorded_only";
    const breakEvenUnits =
      coverageStatus === "recorded_only"
        ? calculateBreakEvenUnits(fixedExpenseMinor, finalDeliveredQuantity, directMarginMinor)
        : null;
    if (coverageStatus === "recorded_only" && breakEvenUnits === null)
      coverageReasons.push("تعادل غير محسوب");
    /* S2-05: الأمانات ضمن الكاش المسجل لكنها محتجزة لغير المالك — التغطية
     * تعلن ذلك بدل عدّها مالًا قابلًا للصرف بصمت. */
    const amanahHeldMinor = positionResult.value.amanahHeldMinor;
    const liquidityIncomplete =
      positionResult.value.customerReceivablesMinor > 0 ||
      positionResult.value.supplierPayablesMinor > 0 ||
      amanahHeldMinor > 0;
    const liquidity: RecordedLiquidity = {
      status: liquidityIncomplete ? "incomplete" : "recorded_only",
      recordedCashMinor: positionResult.value.recordedCashMinor,
      customerReceivablesMinor: positionResult.value.customerReceivablesMinor,
      supplierPayablesMinor: positionResult.value.supplierPayablesMinor,
      cashCoverageAfterLiabilitiesMinor:
        positionResult.value.recordedCashMinor - positionResult.value.supplierPayablesMinor,
      amanahHeldMinor,
      amanahNotice:
        amanahHeldMinor > 0
          ? "من الكاش المسجل أمانات محتجزة ليست مالكًا — راجعها قبل الاعتماد على التغطية."
          : null,
    };
    return {
      ok: true,
      value: {
        period: periodResult.value,
        workNames: [...grouped.values()].sort(
          (left, right) =>
            right.directMarginMinor - left.directMarginMinor ||
            left.itemName.localeCompare(right.itemName, "ar"),
        ),
        costComposition: {
          materialMinor,
          timeMinor,
          packagingMinor,
          deliveryMinor,
          wasteMinor,
          operatingExpenseMinor,
        },
        inventoryMovementCount: movementCount,
        coverage: {
          status: coverageStatus,
          fixedExpenseMinor,
          finalDeliveredQuantity,
          directMarginMinor,
          breakEvenUnits,
          reasons: coverageReasons,
        },
        liquidity,
      },
    };
  }

  async reverse(input: FinancialReversalInput): Promise<FinanceResult<FinancialEvent>> {
    const existing = await this.store.listFinancialEvents();
    if (!existing.ok)
      return { ok: false, code: "storage_error", message: "تعذر التحقق من سجل الأحداث المالية." };
    const sourceEventId = input.sourceEventId.trim();
    const idempotencyKey = input.idempotencyKey.trim();
    const reason = input.reason.trim();
    if (!sourceEventId)
      return { ok: false, code: "validation_error", message: "اختر الحدث الأصلي قبل تصحيحه." };
    if (!reason) return { ok: false, code: "validation_error", message: "اكتب سبب التصحيح قبل تنفيذ التراجع." };
    if (!idempotencyKey)
      return { ok: false, code: "validation_error", message: "مفتاح التصحيح مطلوب لمنع تكرار الأثر." };
    if (!isValidLocalDate(input.occurredOn))
      return { ok: false, code: "validation_error", message: "تاريخ التصحيح المحلي غير صالح." };
    const repeated = existing.value.find(
      event =>
        event.correctionType === "reverse" &&
        event.correctionOfEventId === sourceEventId &&
        event.idempotencyKey === idempotencyKey,
    );
    if (repeated) return { ok: true, value: repeated, reused: true };
    const keyCollision = existing.value.find(event => event.idempotencyKey === idempotencyKey);
    if (keyCollision)
      return {
        ok: false,
        code: "validation_error",
        message: "مفتاح التصحيح مستخدم في حدث آخر؛ اختر مفتاحًا جديدًا.",
      };
    const source = existing.value.find(event => event.id === sourceEventId);
    if (!source)
      return {
        ok: false,
        code: "validation_error",
        message: "لم يُعثر على الحدث الأصلي؛ لم يتغير السجل.",
      };
    if (source.correctionType === "reverse" || source.correctionOfEventId)
      return { ok: false, code: "validation_error", message: "لا يمكن التراجع عن حدث تراجع سابق." };
    const alreadyReversed = existing.value.find(
      event => event.correctionType === "reverse" && event.correctionOfEventId === source.id,
    );
    if (alreadyReversed)
      return { ok: false, code: "validation_error", message: "تم التراجع عن هذا الحدث سابقًا؛ لا يُنشأ تراجع ثانٍ." };
    /* F-006 (دورة التدقيق النهائي): التراجع/الحذف يخضع لنفس حد الأمانة — التراجع عن
     * استلام أمانة جرى تسليم جزء منها يجعل الرصيد الأمين سالبًا (خصم زائد). المسار
     * الصحيح: تراجع عن التسليم أولًا ثم عن الاستلام. لا يُكتب شيء عند الرفض. */
    if ((source.amanahDeltaMinor ?? 0) > 0) {
      const heldMinor = summarizeFinancialEvents(existing.value).amanahMinor;
      if ((source.amanahDeltaMinor ?? 0) > heldMinor)
        return {
          ok: false,
          code: "validation_error",
          message: amanahLimitMessage(
            heldMinor,
            source.amanahDeltaMinor ?? 0,
            "التراجع عن استلام الأمانة",
          ),
        };
    }
    try {
      const reversal = createFinancialReversal({
        id: id(),
        sourceEvent: source,
        occurredOn: input.occurredOn,
        recordedAt: this.now(),
        idempotencyKey,
        reason,
      });
      const saved = await this.store.commitFinancialEventCorrection(source.id, reversal);
      if (!saved.ok)
        return {
          ok: false,
          code: "storage_error",
          message: "تعذر حفظ التراجع ذريًا. بقي الحدث الأصلي دون تغيير.",
        };
      return saved.value.id === reversal.id
        ? { ok: true, value: saved.value }
        : { ok: true, value: saved.value, reused: true };
    } catch (error) {
      return {
        ok: false,
        code: "validation_error",
        message: error instanceof Error ? error.message : "بيانات التصحيح غير صالحة.",
      };
    }
  }

  /** توزيع صريح من الكاش غير الموزع (PA-002): لا تخصيص صامت ولا كاش بلا طريق حل. */
  async distributeUnallocated(
    input: UnallocatedDistributionInput,
  ): Promise<FinanceResult<{ unallocatedAfterMinor: number; walletBalanceAfterMinor: number }>> {
    if (!Number.isInteger(input.deltaMinor) || input.deltaMinor === 0)
      return { ok: false, code: "validation_error", message: "أدخل مبلغ تخصيص صحيحًا غير صفري." };
    const [walletsResult, entriesResult] = await Promise.all([
      this.store.listCashWallets(),
      this.store.listCashContinuityEntries(),
    ]);
    if (!walletsResult.ok || !entriesResult.ok)
      return { ok: false, code: "storage_error", message: "تعذر قراءة المحافظ قبل التخصيص." };
    const wallet = walletsResult.value.find(candidate => candidate.id === input.walletId);
    if (!wallet)
      return { ok: false, code: "validation_error", message: "اختر محفظة موجودة قبل التخصيص." };
    const existingKey = entriesResult.value.find(
      entry => entry.operationKey === (input.operationKey ?? ""),
    );
    if (input.operationKey && existingKey)
      return {
        ok: true,
        value: { unallocatedAfterMinor: 0, walletBalanceAfterMinor: 0 },
        reused: true,
      };
    const position = await this.readPosition();
    if (!position.ok)
      return { ok: false, code: "storage_error", message: "تعذر قراءة الكاش غير الموزع قبل التخصيص." };
    const walletEntries = entriesResult.value.filter(entry => entry.walletId === wallet.id);
    const walletBalanceMinor = summarizeCashContinuity(walletEntries);
    if (input.deltaMinor > 0 && input.deltaMinor > position.value.unallocatedCashMinor)
      return {
        ok: false,
        code: "validation_error",
        message:
          "المبلغ المطلوب أكبر من الكاش غير الموزع المتاح؛ لا يُخصم من رصيد المحافظ ولا يُخترع فرق.",
      };
    if (input.deltaMinor < 0 && walletBalanceMinor + input.deltaMinor < 0)
      return {
        ok: false,
        code: "validation_error",
        message: "رصيد المحفظة لا يغطي هذا الصرف؛ اختر محفظة أخرى أو صرّف المبلغ من غير الموزع.",
      };
    try {
      const entry = createCashContinuityEntry({
        id: id(),
        walletId: wallet.id,
        type: "allocation",
        occurredOn: input.occurredOn ?? ammanDate(this.now()),
        recordedAt: this.now(),
        cashDeltaMinor: input.deltaMinor,
        note:
          (input.note?.trim() || null) ??
          (input.deltaMinor > 0 ? "تخصيص كاش غير موزع إلى محفظة" : "تغطية صرف من رصيد محفظة"),
        operationKey: input.operationKey ?? `allocation-${id()}`,
        sourceRefId: input.sourceRefId ?? null,
        sourceRefKind: input.sourceRefKind ?? null,
        sourceRefLineId: input.sourceRefLineId ?? null,
      });
      const saved = await this.store.commitCashContinuity(wallet, [entry]);
      if (!saved.ok)
        return { ok: false, code: "storage_error", message: "تعذر حفظ التخصيص؛ لم يتغير أي رصيد." };
      return {
        ok: true,
        value: {
          unallocatedAfterMinor: position.value.unallocatedCashMinor - input.deltaMinor,
          walletBalanceAfterMinor: walletBalanceMinor + input.deltaMinor,
        },
      };
    } catch (error) {
      return {
        ok: false,
        code: "validation_error",
        message: error instanceof Error ? error.message : "بيانات التخصيص غير صالحة.",
      };
    }
  }

  /** تعديل بسيط موثق (مبدأ ٥.٦): تراجع + بديل في معاملة ذرّية واحدة — الأثر يتجدد والسجل يبقى. */
  async editEvent(input: FinancialEditInput): Promise<FinanceResult<FinancialEvent>> {
    const existing = await this.store.listFinancialEvents();
    if (!existing.ok)
      return { ok: false, code: "storage_error", message: "تعذر قراءة سجل الأحداث المالية." };
    const source = existing.value.find(event => event.id === input.sourceEventId.trim());
    if (!source)
      return { ok: false, code: "validation_error", message: "لم يُعثر على الحدث الأصلي؛ لم يتغير السجل." };
    if (source.correctionType === "reverse" || source.correctionOfEventId)
      return { ok: false, code: "validation_error", message: "لا يمكن تعديل سجل تراجع سابق." };
    const alreadyReversed = existing.value.find(
      event => event.correctionType === "reverse" && event.correctionOfEventId === source.id,
    );
    if (alreadyReversed)
      return { ok: false, code: "validation_error", message: "عُدّل هذا الحدث سابقًا؛ عدّل النسخة الحالية." };
    if (input.amountMinor <= 0 || !Number.isInteger(input.amountMinor))
      return { ok: false, code: "validation_error", message: "أدخل مبلغًا صحيحًا موجبًا بالأرقام 0–9." };
    if (!input.note.trim())
      return { ok: false, code: "validation_error", message: "اكتب ما حدث؛ الوصف جزء من السجل المالي." };
    if (!isValidLocalDate(input.occurredOn))
      return { ok: false, code: "validation_error", message: "تاريخ الحدث المحلي غير صالح." };
    /* تسديد التزام: تعديل المبلغ لا يتجاوز المتبقي بعد استبعاد الأصل من الحساب. */
    if (source.type === "payable_settlement_cash" && source.relatedEventId) {
      const payable = existing.value.find(event => event.id === source.relatedEventId);
      if (payable) {
        const remainingWithoutSource =
          payable.amountMinor - activeSettlementsMinor(existing.value, payable.id) + source.amountMinor;
        if (input.amountMinor > remainingWithoutSource)
          return {
            ok: false,
            code: "validation_error",
            message: "المبلغ الجديد يتجاوز المتبقي من الالتزام؛ عدّله أو سجّل تسديدًا إضافيًا.",
          };
      }
    }
    if (existing.value.some(event => event.idempotencyKey === input.idempotencyKey))
      return { ok: false, code: "validation_error", message: "مفتاح التعديل مستخدم؛ اختر مفتاحًا جديدًا." };
    try {
      const reversal = createFinancialReversal({
        id: id(),
        sourceEvent: source,
        occurredOn: ammanDate(this.now()),
        recordedAt: this.now(),
        idempotencyKey: `${input.idempotencyKey}:reversal`,
        reason: (input.reason?.trim() || "تعديل موثق"),
      });
      const replacement = createFinancialEvent({
        id: id(),
        type: source.type,
        amountMinor: input.amountMinor,
        occurredOn: input.occurredOn,
        recordedAt: this.now(),
        idempotencyKey: input.idempotencyKey,
        note: input.note.trim(),
        counterparty: input.counterparty,
        relatedEventId: source.relatedEventId,
        expenseContext: source.expenseContext ?? null,
        assetContext: source.assetContext ?? null,
        loanContext: source.loanContext ?? null,
        depositContext: source.depositContext ?? null,
      });
      /* F-006 (دورة التدقيق النهائي): التعديل الذرّي يخضع لنفس حد الأمانة الذي يخضع
       * له التسجيل — رفع تسليم أو إنقاص استلام بما يتجاوز المحتجز فعليًا يجعل الرصيد
       * الأمين سالبًا. يُفحص قبل الكتابة؛ لا يُلمس السجل عند الرفض. */
      const sourceAmanahDelta = source.amanahDeltaMinor ?? 0;
      const replacementAmanahDelta = replacement.amanahDeltaMinor ?? 0;
      const postEditAmanahMinor =
        summarizeFinancialEvents(existing.value).amanahMinor - sourceAmanahDelta + replacementAmanahDelta;
      if (postEditAmanahMinor < 0) {
        const heldBeforeMinor = summarizeFinancialEvents(existing.value).amanahMinor;
        if (sourceAmanahDelta < 0) {
          /* تسليم يُرفع مبلغُه: المتاح بعد استبعاد الأصل = الرصيد + قيمة الأصل. */
          return {
            ok: false,
            code: "validation_error",
            message: amanahLimitMessage(
              heldBeforeMinor - sourceAmanahDelta,
              input.amountMinor,
              "المبلغ الجديد المُسلَّم بعد التعديل",
            ),
          };
        }
        /* استلام يُنقص مبلغُه: الإنقاص المتاح = الرصيد الحالي؛ والمطلوب = قيمة الإنقاص. */
        return {
          ok: false,
          code: "validation_error",
          message: amanahLimitMessage(
            heldBeforeMinor,
            sourceAmanahDelta - input.amountMinor,
            "الإنقاص من استلام الأمانة",
          ),
        };
      }
      const saved = await this.store.commitFinancialEventReplacement(source.id, reversal, replacement);
      if (!saved.ok) return { ok: false, code: "storage_error", message: saved.message };
      return saved.value.replacement.id === replacement.id
        ? { ok: true, value: saved.value.replacement }
        : { ok: true, value: saved.value.replacement, reused: true };
    } catch (error) {
      return {
        ok: false,
        code: "validation_error",
        message: error instanceof Error ? error.message : "بيانات التعديل غير صالحة.",
      };
    }
  }

  /** حذف بسيط (مبدأ ٥.٦): التراجع الموثق هو الآلية — الأثر يتلاشى والسجل يبقى. */
  async deleteEvent(input: {
    sourceEventId: string;
    reason?: string | null;
    idempotencyKey: string;
  }): Promise<FinanceResult<FinancialEvent>> {
    return this.reverse({
      sourceEventId: input.sourceEventId,
      occurredOn: ammanDate(this.now()),
      reason: input.reason?.trim() || "حذف",
      idempotencyKey: input.idempotencyKey,
    });
  }

  /** تراجع عن الحذف (Undo): يعاد تسجيل القيم الأصلية كحدث جديد — لا يُلمس الماضي. */
  async restoreEvent(input: {
    sourceEventId: string;
    idempotencyKey: string;
  }): Promise<FinanceResult<FinancialEvent>> {
    const existing = await this.store.listFinancialEvents();
    if (!existing.ok)
      return { ok: false, code: "storage_error", message: "تعذر قراءة سجل الأحداث المالية." };
    const source = existing.value.find(event => event.id === input.sourceEventId.trim());
    if (!source)
      return { ok: false, code: "validation_error", message: "لم يُعثر على الحدث الأصلي." };
    return this.record({
      type: source.type,
      amountMinor: source.amountMinor,
      occurredOn: source.occurredOn,
      note: source.note.replace(/^تراجع: /u, ""),
      counterparty: source.counterparty,
      relatedEventId: source.relatedEventId,
      expenseContext: source.expenseContext ?? null,
      assetContext: source.assetContext ?? null,
      loanContext: source.loanContext ?? null,
      depositContext: source.depositContext ?? null,
      idempotencyKey: input.idempotencyKey,
    });
  }

  async record(input: FinancialRecordInput): Promise<FinanceResult<FinancialEvent>> {
    const existing = await this.store.listFinancialEvents();
    if (!existing.ok)
      return { ok: false, code: "storage_error", message: "تعذر التحقق من سجل الأحداث المالية." };
    const repeated = existing.value.find(
      event => event.type === input.type && event.idempotencyKey === input.idempotencyKey,
    );
    if (repeated) return { ok: true, value: repeated, reused: true };
    let amountMinor = input.amountMinor;
    let expenseContext = input.expenseContext ?? null;
    /* المجموعة ١ (معاينة الأثر): التوسيع نفسه الذي تعرضه المعاينة قبل الحفظ —
     * وحدة نقية واحدة (`expenseRecordIntent`) لا مسار حساب ثانٍ. */
    const intentType: "operating_expense_cash" | "operating_expense_payable" =
      input.type === "operating_expense_cash" || input.type === "operating_expense_payable"
        ? input.type
        : "operating_expense_cash";
    if (intentType === input.type || input.sharedExpense || input.expenseContext) {
      const expanded = expandExpenseRecordIntent({
        type: intentType,
        amountMinor: input.amountMinor,
        expenseContext: input.expenseContext ?? null,
        sharedExpense: input.sharedExpense,
      });
      if (!expanded.ok) return { ok: false, code: "validation_error", message: expanded.message };
      amountMinor = expanded.amountMinor;
      expenseContext = expanded.expenseContext;
    }
    if (amountMinor === undefined)
      return { ok: false, code: "validation_error", message: "أدخل مبلغًا صالحًا قبل الحفظ." };
    if (input.type === "payable_settlement_cash") {
      const source = existing.value.find(event => event.id === input.relatedEventId);
      if (!source || source.type !== "operating_expense_payable")
        return { ok: false, code: "validation_error", message: "اختر التزام مصروف مسجلًا قبل تسجيل تسديده." };
      if (source.correctionType === "reverse" || reversedEventIds(existing.value).has(source.id))
        return { ok: false, code: "validation_error", message: "اختر التزامًا فعالًا لم يتم التراجع عنه." };
      const paid = activeSettlementsMinor(existing.value, source.id);
      if (amountMinor > source.amountMinor - paid)
        return {
          ok: false,
          code: "validation_error",
          message: "لا يمكن أن يتجاوز التسديد المتبقي المسجل على هذا الالتزام.",
        };
    }
    /* F-006: تسليم الأمانة لا يتجاوز الرصيد الأمين المحتجز فعليًا — رصيد سالب
     * يعني ملكًا زائفًا ونقص كاشٍ كاذبًا. المجهول لا يُقرّب: إن لم تُسجّل الأمانة
     * بعد فسجلها أولًا، ثم سلّم منها. الرسالة تعرض المتاح والمطلوب بالأرقام (§٥.٢). */
    if (input.type === "amanah_released_cash") {
      const heldMinor = summarizeFinancialEvents(existing.value).amanahMinor;
      if (amountMinor > heldMinor)
        return {
          ok: false,
          code: "validation_error",
          message: amanahLimitMessage(heldMinor, amountMinor, "المبلغ المُسلَّم"),
        };
    }
    try {
      const event = createFinancialEvent({
        id: id(),
        type: input.type,
        amountMinor,
        occurredOn: input.occurredOn,
        recordedAt: this.now(),
        idempotencyKey: input.idempotencyKey,
        note: input.note,
        counterparty: input.counterparty,
        relatedEventId: input.relatedEventId,
        expenseContext,
        assetContext: input.assetContext ?? null,
        loanContext: input.loanContext ?? null,
        depositContext: input.depositContext ?? null,
      });
      const saved = await this.store.saveFinancialEvent(event);
      return saved.ok
        ? { ok: true, value: saved.value }
        : {
            ok: false,
            code: "storage_error",
            message: "تعذر حفظ الحدث المالي محليًا. لم يتم تأكيد نجاح العملية.",
          };
    } catch (error) {
      return {
        ok: false,
        code: "validation_error",
        message: error instanceof Error ? error.message : "بيانات الحدث المالي غير صالحة.",
      };
    }
  }
}
