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
} from "@micro-domain/financial-event/index.js";
import { isCostBackedConsumption, type InventoryMovement } from "@micro-domain/inventory-material/index.js";
import { summarizeLocalCraftOrders } from "@/application/financial-pulse/financialPulseService";
import { calculateBreakEvenUnits } from "@micro-domain/g5/index.js";
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
  truth: string;
};
export type CogsStatus = "recorded" | "partial" | "not_available";
export type RecordedPeriodResult = {
  from: string;
  to: string;
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
  cogsNextAction: string;
  recordedOperatingExpenseMinor: number;
  projectOperatingExpenseMinor: number;
  sharedProjectExpenseMinor: number;
  sharedUnallocatedExpenseMinor: number;
  legacyUnclassifiedExpenseMinor: number;
  sharedEstimatedExpenseCount: number;
  sharedMissingBasisCount: number;
  sharedUnallocatedExpenseCount: number;
  legacyUnclassifiedExpenseCount: number;
  resultMinor: number | null;
  finalOrderCount: number;
  excludedOrderCount: number;
  expenseNeedsReviewCount: number;
  status: "recorded_only" | "incomplete" | "invalid";
  reasons: readonly string[];
  truth: string;
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
  truth: string;
};
export type RecordedLiquidity = {
  status: "recorded_only" | "incomplete";
  recordedCashMinor: number;
  customerReceivablesMinor: number;
  supplierPayablesMinor: number;
  cashCoverageAfterLiabilitiesMinor: number;
  truth: string;
};
export type FinancialInsights = {
  period: RecordedPeriodResult;
  workNames: readonly WorkNameProfitability[];
  costComposition: RecordedCostComposition;
  inventoryMovementCount: number;
  coverage: CoverageIndicator;
  liquidity: RecordedLiquidity;
  truth: string;
};
export type SharedExpenseRecordInput =
  | { mode?: "fixed"; amountMinor: number; sharedTotalAmountMinor?: never; sharedPercentageBps?: never }
  | { mode: "percentage"; amountMinor?: never; sharedTotalAmountMinor: number; sharedPercentageBps: number }
  | { mode: "estimate"; amountMinor: number; sharedTotalAmountMinor?: never; sharedPercentageBps?: never }
  | { mode: "defer"; amountMinor?: never; sharedTotalAmountMinor: number; sharedPercentageBps?: never };
export type FinancialRecordInput = {
  type: FinancialEventType;
  amountMinor?: number;
  occurredOn: string;
  note: string;
  counterparty: string | null;
  relatedEventId: string | null;
  expenseContext?: OperatingExpenseContext | null;
  idempotencyKey: string;
  sharedExpense?: SharedExpenseRecordInput;
};
export type FinancialReversalInput = {
  sourceEventId: string;
  occurredOn: string;
  reason: string;
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
function ammanDate(timestamp: string): string {
  const parts = new Intl.DateTimeFormat("en", {
    timeZone: "Asia/Amman",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date(timestamp));
  const value = (type: string) => parts.find(part => part.type === type)?.value;
  return `${value("year")}-${value("month")}-${value("day")}`;
}
function isValidLocalDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year!, month! - 1, day!));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month! - 1 && date.getUTCDate() === day;
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
  cogsNextAction: string;
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
      "لا توجد حركات استهلاك ذات قيمة تكلفة مثبتة مرتبطة بطلب نهائي؛ تستخدم القراءة نسخة التكلفة كبديل معلن.",
    );
  if (cogsStatus === "partial")
    cogsReasons.push(
      "تتوفر تكلفة بيع مسجلة لبعض الأعمال النهائية فقط؛ تستخدم القراءة نسخة التكلفة لبقية الأعمال، فلا تُعرض كل التكلفة كتكلفة بيع فعلية.",
    );
  if (unallocatedInventoryCostMinor > 0)
    cogsReasons.push("توجد حركة استهلاك عامة أو بلا ارتباط صالح؛ لم توزع على عمل ولم تدخل تكلفة البيع.");
  if (generalInventoryWasteMinor > 0)
    cogsReasons.push("يوجد هدر مخزون عام؛ لا يسمى تكلفة بيع ولا يوزّع على عمل تلقائيًا.");
  const cogsNextAction =
    cogsStatus === "recorded" && unallocatedInventoryCostMinor === 0 && generalInventoryWasteMinor === 0
      ? "راجع أن حركات الاستهلاك تغطي المواد المقصودة؛ تبقى بقية عناصر التكلفة من نسخة التكلفة."
      : "سجل استهلاكًا بقيمة تكلفة محفوظة واربطه بعمل مكتمل، أو راجع الحركات العامة؛ لا تدخل صفرًا عند غياب الدليل.";
  return {
    snapshotDirectCostMinor,
    recordedCogsMinor,
    effectiveDirectCostMinor,
    cogsStatus,
    cogsMissingOrderCount,
    unallocatedInventoryCostMinor,
    generalInventoryWasteMinor,
    cogsReasons,
    cogsNextAction,
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
    ] = await Promise.all([
      this.store.listOrders(),
      this.store.listFinancialEvents(),
      this.store.listSupplierPurchases(),
      this.store.listCashWallets(),
      this.store.listCashContinuityEntries(),
      this.store.listOwnerMovements(),
    ]);
    if (
      !ordersResult.ok ||
      !eventsResult.ok ||
      !purchasesResult.ok ||
      !walletsResult.ok ||
      !continuityResult.ok ||
      !ownerMovementsResult.ok
    )
      return { ok: false, code: "storage_error", message: "تعذر قراءة السجلات المالية المحلية." };
    const orderPulse = summarizeLocalCraftOrders(ordersResult.value);
    const project = summarizeFinancialEvents(eventsResult.value);
    const supplierMaterialPayablesMinor = purchasesResult.value.reduce(
      (sum, purchase) => sum + purchase.payableMinor,
      0,
    );
    const supplierPurchaseCashPaidMinor = purchasesResult.value.reduce(
      (sum, purchase) => sum + purchase.paidMinor,
      0,
    );
    const unallocatedCashMinor =
      orderPulse.registeredCollectionsMinor + project.cashMinor - supplierPurchaseCashPaidMinor;
    const walletCashMinor = continuityResult.value.reduce((sum, entry) => sum + entry.cashDeltaMinor, 0);
    const ownerCapitalFromMovementsMinor = ownerMovementsResult.value.reduce(
      (sum: number, movement: OwnerMovement) => sum + movement.ownerCapitalDeltaMinor,
      0,
    );
    return {
      ok: true,
      value: {
        recordedCashMinor: unallocatedCashMinor + walletCashMinor,
        customerReceivablesMinor: orderPulse.registeredDebtMinor,
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
        truth:
          "الكاش المسجل يجمع رصيد المحافظ المعلن والكاش غير الموزع من الطلبات والأحداث وشراء المواد. حق المالك لا يغير الكاش، بينما حركة السحب أو الإرجاع الفعلية تغير المحفظة بسببها؛ الاستثمار الجديد مستقل عن الحق.",
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
    const [ordersResult, eventsResult, movementsResult] = await Promise.all([
      this.store.listOrders(),
      this.store.listFinancialEvents(),
      this.store.listInventoryMovements(),
    ]);
    if (!ordersResult.ok || !eventsResult.ok || !movementsResult.ok)
      return { ok: false, code: "storage_error", message: "تعذر قراءة نتيجة الفترة المحلية." };
    if (!isValidLocalDate(from) || !isValidLocalDate(to) || from > to)
      return {
        ok: true,
        value: {
          from,
          to,
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
          cogsNextAction: "صحح حدود الفترة قبل مراجعة تكلفة البيع.",
          recordedOperatingExpenseMinor: 0,
          projectOperatingExpenseMinor: 0,
          sharedProjectExpenseMinor: 0,
          sharedUnallocatedExpenseMinor: 0,
          legacyUnclassifiedExpenseMinor: 0,
          sharedEstimatedExpenseCount: 0,
          sharedMissingBasisCount: 0,
          sharedUnallocatedExpenseCount: 0,
          legacyUnclassifiedExpenseCount: 0,
          resultMinor: null,
          finalOrderCount: 0,
          excludedOrderCount: 0,
          expenseNeedsReviewCount: 0,
          status: "invalid",
          reasons: ["الفترة المحلية غير صالحة؛ لا يمكن بناء نتيجة قابلة للقراءة."],
          truth:
            "لا توجد نتيجة رقمية لهذه الفترة لأن حدودها غير صالحة. صحح الشهر أو الفترة قبل الاعتماد على القراءة.",
        },
      };
    const inPeriod = (date: string) => date >= from && date <= to;
    const delivered = ordersResult.value
      .map(stored => {
        const event = stored.order.events.find(
          candidate => candidate.type === "status_changed" && candidate.toStatus === "delivered",
        );
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
    const reasons: string[] = [];
    if (excludedOrderCount > 0) reasons.push("توجد طلبات مسلّمة مستبعدة بسبب درجة المعرفة أو المراجعة.");
    if (sharedEstimatedExpenseCount > 0) reasons.push("توجد حصة مشروع مشتركة تقديرية أو تحتاج مراجعة.");
    if (sharedMissingBasisCount > 0) reasons.push("توجد حصة مشروع مشتركة بلا مصدر موثق.");
    if (sharedUnallocatedExpenseCount > 0)
      reasons.push("توجد مصاريف مشتركة غير موزّعة؛ حدد حصة المشروع قبل خصمها من النتيجة.");
    if (legacyUnclassifiedExpenseCount > 0) reasons.push("توجد مصروفات قديمة بلا سياق مالي.");
    const incomplete = reasons.length > 0;
    return {
      ok: true,
      value: {
        from,
        to,
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
        cogsNextAction: cogs.cogsNextAction,
        recordedOperatingExpenseMinor,
        projectOperatingExpenseMinor,
        sharedProjectExpenseMinor,
        sharedUnallocatedExpenseMinor,
        legacyUnclassifiedExpenseMinor,
        sharedEstimatedExpenseCount,
        sharedMissingBasisCount,
        sharedUnallocatedExpenseCount,
        legacyUnclassifiedExpenseCount,
        resultMinor: recognizedRevenueMinor - cogs.effectiveDirectCostMinor - recordedOperatingExpenseMinor,
        finalOrderCount: finals.length,
        excludedOrderCount,
        expenseNeedsReviewCount,
        status: incomplete ? "incomplete" : "recorded_only",
        reasons,
        truth: incomplete
          ? "هذه هي نتيجة الفترة المسجلة من البنود الداخلة فيها، لكنها تحتاج مراجعة للأسباب الظاهرة. الرقم لا يشمل المصدر المشترك غير الموزّع، وتوضح قراءة تكلفة البيع هل استُخدم استهلاك مثبت أم نسخة تكلفة بديلة؛ هذه القراءة ليست صافي ربح نهائيًا."
          : "هذه هي نتيجة الفترة المسجلة من الأعمال المكتملة والتكلفة المباشرة المستخدمة وفق مصدرها ومصروفات الفترة. لا تؤكد تكلفة البيع كاملة خارج الاستهلاك المثبت أو نسخة التكلفة، ولا التوزيع على المنتجات أو الضرائب؛ لذلك ليست صافي ربح نهائيًا.",
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
    const delivered = ordersResult.value
      .map(stored => {
        const event = stored.order.events.find(
          candidate => candidate.type === "status_changed" && candidate.toStatus === "delivered",
        );
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
      coverageReasons.push("توجد طلبات مسلّمة مستبعدة بسبب درجة المعرفة أو المراجعة.");
    if (reviewableFixed.some(event => event.expenseContext?.knowledge !== "known"))
      coverageReasons.push("توجد مصروفات ثابتة تحتاج مراجعة أو تقديرًا.");
    if (
      reviewableOperating.some(
        event =>
          event.expenseContext?.behavior === "variable" ||
          event.expenseContext?.behavior === "mixed" ||
          event.expenseContext?.behavior === "unknown",
      )
    )
      coverageReasons.push("توجد مصروفات متغيرة أو مختلطة لا توزّع تلقائيًا على الهامش بعد الكلفة المباشرة.");
    if (movementCount > 0)
      coverageReasons.push(
        "توجد حركات مخزون فعلية؛ تعرض نتيجة الفترة تكلفة البيع الاختيارية عند اكتمال دليلها، لكنها لا تعيد كتابة نسخة التكلفة أو هامش اسم العمل.",
      );
    if (directMarginMinor <= 0) coverageReasons.push("الهامش المباشر المسجل غير موجب.");
    if (fixedExpenseMinor <= 0) coverageReasons.push("لا توجد مصروفات ثابتة مسجلة ومعروفة للفترة.");
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
      coverageReasons.push("تعذر حساب وحدات التعادل ضمن الدقة الآمنة.");
    const liquidityIncomplete =
      positionResult.value.customerReceivablesMinor > 0 || positionResult.value.supplierPayablesMinor > 0;
    const liquidity: RecordedLiquidity = {
      status: liquidityIncomplete ? "incomplete" : "recorded_only",
      recordedCashMinor: positionResult.value.recordedCashMinor,
      customerReceivablesMinor: positionResult.value.customerReceivablesMinor,
      supplierPayablesMinor: positionResult.value.supplierPayablesMinor,
      cashCoverageAfterLiabilitiesMinor:
        positionResult.value.recordedCashMinor - positionResult.value.supplierPayablesMinor,
      truth: liquidityIncomplete
        ? "الديون أو الالتزامات المسجلة لا تحمل مواعيد تحصيل أو دفع كافية؛ لا يمثل هذا توقع سيولة للأيام القادمة."
        : "هذه تغطية الكاش المسجل بعد الالتزامات المسجلة فقط؛ ليست توقع تدفق نقدي.",
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
          truth:
            coverageStatus === "recorded_only"
              ? "هذا مؤشر تغطية من مزيج الطلبات النهائية والمصروفات الثابتة المسجلة لهذه الفترة، وليس نقطة تعادل نهائية أو توقعًا."
              : "لا يمكن عرض رقم تغطية موثوق حتى تكتمل شروط البيانات والسياسة الظاهرة.",
        },
        liquidity,
        truth:
          "هذه مؤشرات مشتقة من السجل المحلي في الفترة؛ لا تحفظ نتيجة جديدة ولا تحول الكاش أو المخزون أو الديون إلى صافي ربح. نتيجة الفترة تعرض تكلفة البيع الاختيارية وفق العقد، بينما تبقى مؤشرات التغطية وهامش اسم العمل محافظة على نسخة التكلفة الخاصة بالطلب.",
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
      return { ok: false, code: "validation_error", message: "اختر الواقعة الأصلية قبل تصحيحها." };
    if (!reason) return { ok: false, code: "validation_error", message: "اكتب سبب التصحيح قبل تنفيذ العكس." };
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
        message: "مفتاح التصحيح مستخدم في واقعة أخرى؛ اختر مفتاحًا جديدًا.",
      };
    const source = existing.value.find(event => event.id === sourceEventId);
    if (!source)
      return {
        ok: false,
        code: "validation_error",
        message: "لم تُعثر على الواقعة الأصلية؛ لم يتغير السجل.",
      };
    if (source.correctionType === "reverse" || source.correctionOfEventId)
      return { ok: false, code: "validation_error", message: "لا يمكن عكس واقعة عكس سابقة." };
    const alreadyReversed = existing.value.find(
      event => event.correctionType === "reverse" && event.correctionOfEventId === source.id,
    );
    if (alreadyReversed)
      return { ok: false, code: "validation_error", message: "هذه الواقعة عُكست سابقًا؛ لا يُنشأ عكس ثانٍ." };
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
          message: "تعذر حفظ العكس ذريًا. بقيت الواقعة الأصلية دون تغيير.",
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
    if (input.sharedExpense && expenseContext?.relationship !== "shared")
      return {
        ok: false,
        code: "validation_error",
        message: "خيارات حصة المصروف لا تستخدم إلا مع مصروف مشترك.",
      };
    if (
      (input.type === "operating_expense_cash" || input.type === "operating_expense_payable") &&
      !expenseContext
    )
      return { ok: false, code: "validation_error", message: "حدد سياق المصروف ودرجة معرفته قبل الحفظ." };
    if (expenseContext?.relationship === "shared" && input.sharedExpense) {
      const note = expenseContext.sharedProjectShare?.note ?? null;
      if (input.sharedExpense.mode === "percentage") {
        const calculatedShareMinor = calculateSharedProjectShareMinor(
          input.sharedExpense.sharedTotalAmountMinor,
          input.sharedExpense.sharedPercentageBps,
        );
        amountMinor = calculatedShareMinor;
        expenseContext = {
          ...expenseContext,
          knowledge: "known",
          sharedProjectShare: {
            basis: "agreed_percentage",
            note,
            allocation: "allocated",
            totalAmountMinor: input.sharedExpense.sharedTotalAmountMinor,
            percentageBps: input.sharedExpense.sharedPercentageBps,
            calculatedShareMinor,
          },
        };
      } else if (input.sharedExpense.mode === "defer") {
        amountMinor = input.sharedExpense.sharedTotalAmountMinor;
        expenseContext = {
          ...expenseContext,
          knowledge: "needs_review",
          sharedProjectShare: {
            basis: "needs_review",
            note,
            allocation: "unallocated",
            totalAmountMinor: input.sharedExpense.sharedTotalAmountMinor,
            percentageBps: null,
            calculatedShareMinor: null,
          },
        };
      } else if (input.sharedExpense.mode === "estimate") {
        if (amountMinor === undefined)
          return { ok: false, code: "validation_error", message: "أدخل حصة المالك التقديرية قبل الحفظ." };
        expenseContext = {
          ...expenseContext,
          knowledge: "estimated",
          sharedProjectShare: {
            basis: "owner_estimate",
            note,
            allocation: "allocated",
            totalAmountMinor: null,
            percentageBps: null,
            calculatedShareMinor: null,
          },
        };
      } else {
        if (amountMinor === undefined)
          return { ok: false, code: "validation_error", message: "أدخل مبلغ حصة المشروع قبل الحفظ." };
        expenseContext = {
          ...expenseContext,
          knowledge: "known",
          sharedProjectShare: {
            basis: "agreed_fixed_share",
            note,
            allocation: "allocated",
            totalAmountMinor: null,
            percentageBps: null,
            calculatedShareMinor: null,
          },
        };
      }
    }
    if (
      (input.type === "operating_expense_cash" || input.type === "operating_expense_payable") &&
      expenseContext?.relationship === "shared" &&
      !expenseContext.sharedProjectShare
    )
      return {
        ok: false,
        code: "validation_error",
        message: "حدد كيف عرفت حصة المشروع من المصروف المشترك قبل الحفظ.",
      };
    if (amountMinor === undefined)
      return { ok: false, code: "validation_error", message: "أدخل مبلغًا صالحًا قبل الحفظ." };
    if (input.type === "payable_settlement_cash") {
      const source = existing.value.find(event => event.id === input.relatedEventId);
      if (!source || source.type !== "operating_expense_payable")
        return { ok: false, code: "validation_error", message: "اختر التزام مصروف مسجلًا قبل تسجيل تسديده." };
      if (source.correctionType === "reverse" || reversedEventIds(existing.value).has(source.id))
        return { ok: false, code: "validation_error", message: "اختر التزامًا فعالًا غير معكوس." };
      const paid = activeSettlementsMinor(existing.value, source.id);
      if (amountMinor > source.amountMinor - paid)
        return {
          ok: false,
          code: "validation_error",
          message: "لا يمكن أن يتجاوز التسديد المتبقي المسجل على هذا الالتزام.",
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
