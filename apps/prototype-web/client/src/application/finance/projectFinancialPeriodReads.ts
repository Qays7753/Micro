/* Wave F (ADR-013 عنقود ٣ — تقسيم مسؤولية داخلي، 2026-10-04): عائلة قراءة
 * نتيجة الفترة المسجلة — اشتقاق COGS (W2-D/D-034) وتصنيف المصروفات المشتركة
 * والاعتراف بالإيراد بآخر تسليم ساري — انتقلت حرفيًا من projectFinancialService.ts
 * إلى هذا البيت الشقيق؛ لا صيغة ولا تقريب ولا تصنيف تحرّك — نقل نصّي فقط،
 * والقارئ الكنوني (عقد ٤٠ §8) يبقى الواجهة والهوية في الخدمة. */
import { reversedEventIds, type FinancialEvent } from "@micro-domain/financial-event/index.js";
import {
  ammanDateOrNull,
  isValidLocalDate,
  localDateInAmman as ammanDate,
} from "@micro-domain/shared/index.js";
import { isCostBackedConsumption, type InventoryMovement } from "@micro-domain/inventory-material/index.js";
/* F-008 (W2-D): المعين الكنوني الخفيف لكلفة توصيل المشروع — لا سحب تحلل
 * الطلب الكامل إلى حزبة الدخول (الدخول يحتاج الكلفة فقط). */
import { projectDeliveryCostMinor as orderDeliveryCostMinor } from "@micro-domain/craft-order/index.js";
import { directSaleOutstandingMinor } from "@micro-domain/direct-sale/index.js";
import { lastEffectiveDeliveryEvent } from "@/application/fulfillment/deliveryAttribution";
import { STORAGE_ERROR, storageFailure } from "@/application/resultCodes";
import type { PrototypeLocalStore } from "@/storage/local/types";

/** R3 (بطاقة R3-SC-01/11): عدسة الخدمة — قراءات الفترة الست بالضبط. */
export type ProjectFinancialPeriodReadsStore = Pick<
    PrototypeLocalStore,
    "listOrders" | "listDirectSales" | "listFinancialEvents" | "listMaterials" |
    "listInventoryMovements" | "getInventoryActivation"
  >;
import type { CogsStatus, FinanceResult, RecordedPeriodResult } from "./projectFinancialTypes";

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
/* W2-D (D-034): جامع القيمة المطلقة لدلتا الحركة — ثلاث لامدا متطابقة
 * كانت تكرر البايتات نفسها في حزبة الدخول بلا معنى جديد. */
function sumAbsValueDelta(movements: readonly InventoryMovement[]): number {
  return movements.reduce((sum, movement) => sum + Math.abs(movement.valueDeltaMinor), 0);
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
  const recordedCogsMinor = sumAbsValueDelta(qualified);
  const cogsOrderCount = finals.length - cogsMissingOrderCount;
  const cogsStatus: CogsStatus =
    finals.length === 0
      ? "not_available"
      : cogsOrderCount === finals.length
        ? "recorded"
        : cogsOrderCount > 0
          ? "partial"
          : "not_available";
  const unallocatedInventoryCostMinor = sumAbsValueDelta(
    active.filter(movement => movement.type === "consumption" && !movement.orderId),
  );
  const generalInventoryWasteMinor = sumAbsValueDelta(active.filter(movement => movement.type === "waste"));
  const cogsReasons: string[] = [];
  if (finals.length > 0 && cogsStatus === "not_available") cogsReasons.push("نسخة تكلفة بديلة");
  if (cogsStatus === "partial") cogsReasons.push("تكلفة بيع جزئية");
  if (unallocatedInventoryCostMinor > 0) cogsReasons.push("استهلاك غير موزع");
  if (generalInventoryWasteMinor > 0) cogsReasons.push("هدر عام");
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

export async function readRecordedPeriodResult(
  store: ProjectFinancialPeriodReadsStore,
  from: string,
  to: string,
): Promise<FinanceResult<RecordedPeriodResult>> {
  const [ordersResult, eventsResult, movementsResult, activationResult, materialsResult, directSalesResult] =
    await Promise.all([
      store.listOrders(),
      store.listFinancialEvents(),
      store.listInventoryMovements(),
      store.getInventoryActivation(),
      store.listMaterials(),
      store.listDirectSales(),
    ]);
  if (
    !ordersResult.ok ||
    !eventsResult.ok ||
    !movementsResult.ok ||
    !activationResult.ok ||
    !materialsResult.ok ||
    !directSalesResult.ok
  )
    return storageFailure("تعذر قراءة نتيجة الفترة المحلية.");
  /* القرار ٩/١٠: تاريخ بدء إدارة المخزون — المعلن صراحة أو أقدم دليل للموجود القائم. */
  const inventoryManagedFrom =
    activationResult.value?.activatedOn ??
    ((): string | null => {
      const evidence = [
        ...movementsResult.value.map(movement => movement.occurredOn),
        ...materialsResult.value.map(material => ammanDateOrNull(material.createdAt)),
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
        nonCashLossMinor: 0,
        projectDeliveryCostMinor: 0,
        orderReceivableMinor: 0,
        directSaleUncollectedMinor: 0,
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
  /* F-020 (W3-B): الجمع المشتق للفرق غير المحصّل — من الحقول المحفوظة
   * للكيانات نفسها (receivableMinor بأساس D-15-A للطلب؛ ومعيّن المجال
   * الواحد للمتبقي على البيع المباشر S4-09) — لا مصدر حساب ثانٍ ولا إعادة
   * تفسير تاريخ. */
  const orderReceivableMinor = finals.reduce((total, item) => total + item.order.receivableMinor, 0);
  const directSaleUncollectedMinor = activeDirectSales.reduce(
    (total, sale) => total + directSaleOutstandingMinor(sale),
    0,
  );
  const recognizedRevenueMinor = finals.reduce((total, item) => total + item.order.recognizedRevenueMinor, 0);
  const recognizedDirectCostMinor = finals.reduce((total, item) => total + item.order.recognizedCostMinor, 0);
  const cogs = derivePeriodCogs(finals, movementsResult.value);
  const periodEvents = eventsResult.value.filter(event => inPeriod(event.occurredOn));
  const operatingEvents = periodEvents.filter(event => isRecordedOperatingExpense(event));
  /* F-019 (W2-D): الخسارة غير النقدية بند مستقل — تُخصم باسمها لا داخل
   * المصروف التشغيلي، وتخرج من المصنفات القديمة كي لا تُوسم «مصروفًا
   * غير مصنف» وهي ليست مصروفًا نقديًا أصلًا. المعادلة محايدة: البند نفسه
   * يُخصم فالنتيجة لا تتغير. */
  const cashOperatingEvents = operatingEvents.filter(event => event.type !== "loss_non_cash");
  const sharedUnallocatedEvents = periodEvents.filter(sharedExpenseIsUnallocated);
  const sharedUnallocatedSources = sharedUnallocatedEvents.filter(
    event => event.correctionType !== "reverse",
  );
  const reviewableOperatingEvents = [
    ...cashOperatingEvents.filter(event => event.operatingExpenseDeltaMinor > 0),
    ...sharedUnallocatedSources,
  ];
  /* F-019 (W2-D — D-034): جامع دلتا المصروف الواحد للمجموعات الأربع — أربع
   * لامدا متطابقة كانت تكرر بايتات حزبة الدخول بلا معنى جديد. */
  const sumOperatingDelta = (events: readonly FinancialEvent[]) =>
    events.reduce((total, event) => total + event.operatingExpenseDeltaMinor, 0);
  const recordedOperatingExpenseMinor = sumOperatingDelta(cashOperatingEvents);
  /* F-019 (W2-D): الخسارة = دلتا المصروف الكاملة − دلتا النقدي منها — نفس
   * مجموع أحداث loss_non_cash تمامًا (الجامع الموحد نفسه، لا مسار ثانٍ). */
  const nonCashLossMinor = sumOperatingDelta(operatingEvents) - recordedOperatingExpenseMinor;
  const projectOperatingExpenseMinor = sumOperatingDelta(
    cashOperatingEvents.filter(event => event.expenseContext?.relationship === "project"),
  );
  const sharedProjectExpenseMinor = sumOperatingDelta(
    cashOperatingEvents.filter(event => event.expenseContext?.relationship === "shared"),
  );
  const sharedUnallocatedExpenseMinor = sharedUnallocatedEvents.reduce(
    (total, event) =>
      total +
      (event.correctionType === "reverse" ? -1 : 1) *
        (event.expenseContext?.sharedProjectShare?.totalAmountMinor ?? event.amountMinor),
    0,
  );
  const legacyUnclassifiedExpenseMinor = sumOperatingDelta(
    cashOperatingEvents.filter(event => !event.expenseContext),
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
  /* W2-D (D-034): سلسلتا «صنف المجموعة ٤ ثم مجموع المبلغ» صارتا معينًا واحدًا. */
  const group4AmountMinor = (type: "asset_depreciation" | "asset_writeoff") =>
    activePeriodGroup4Events
      .filter(event => event.type === type)
      .reduce((sum, event) => sum + event.amountMinor, 0);
  const assetDepreciationMinor = group4AmountMinor("asset_depreciation");
  const assetWriteOffLossMinor = group4AmountMinor("asset_writeoff");
  const assetDisposalResultMinor = activePeriodGroup4Events
    .filter(event => event.type === "asset_disposal_cash")
    .reduce((sum, event) => sum + (event.amountMinor - (event.assetContext?.bookValueMinor ?? 0)), 0);
  const retainedDepositRevenueMinor = activePeriodGroup4Events
    .filter(event => event.type === "deposit_retained_revenue")
    .reduce((sum, event) => sum + (event.revenueDeltaMinor ?? event.amountMinor), 0);
  /* F-008 (W2-D — ثم قرار المالك D-03 بتاريخ 2026-09-29): كلفة التوصيل التي دفعها المشروع
   * للطلبات النهائية، كما تُشتقها وحدة تحلل الطلب الكنونية من شروط التوصيل
   * المسجلة — معلنة حقلًا تفسيريًا بلا طرح ثانية أبدًا (الحقل تحلل تفسيري؛
   * الخصم الموثق الوحيد للمصروف المسجل يدويًا)، منعًا للخصم المزدوج. */
  const projectDeliveryCostMinor = finals.reduce(
    (total, { order }) => total + (orderDeliveryCostMinor(order) ?? 0),
    0,
  );
  const reasons: string[] = [];
  if (excludedOrderCount > 0) reasons.push("طلبات مستبعدة");
  if (directSaleCostUnknownCount > 0) reasons.push("بيع مباشر بتكلفة غير معروفة");
  if (sharedEstimatedExpenseCount > 0) reasons.push("حصة تقديرية");
  if (sharedMissingBasisCount > 0) reasons.push("حصة بلا مصدر");
  if (sharedUnallocatedExpenseCount > 0) reasons.push("حصة غير موزعة");
  if (legacyUnclassifiedExpenseCount > 0) reasons.push("مصروفات غير مصنفة");
  /* F-019 (W2-D): الخسارة غير النقدية معلنة باسمها — بند مستقل في المعادلة. */
  if (nonCashLossMinor > 0) reasons.push("خسارة غير نقدية");
  /* F-008 (W2-D — ثم قرار المالك D-03 بتاريخ 2026-09-29): إعلان الحقل التفسيري — الكلفة
   * مرئية والنتيجة لا تُخفض؛ الخصم الموثق الوحيد مسار التسجيل اليدوي للمصروف. */
  if (projectDeliveryCostMinor > 0) reasons.push("كلفة توصيل معلنة");
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
      nonCashLossMinor,
      projectDeliveryCostMinor,
      orderReceivableMinor,
      directSaleUncollectedMinor,
      /* F-005 + المجموعة ٤ + F-019: النتيجة تتضمن إيراد البيع المباشر وتكلفته
       * المعروفة، وتخصم الإهلاك المسجّل وخسارة الشطب والخسارة غير النقدية
       * باسمها، وتضيف نتيجة التخلص وإيراد عربون محتفظ مصنَّف — كلها بنود
       * صريحة بلا اختراع كاش. وأي بيع بتكلفة مجهولة يمنع عرض رقم نهائي —
       * «غير متاح» لا ربحًا متوهّمًا. */
      resultMinor:
        directSaleCostUnknownCount > 0
          ? null
          : recognizedRevenueMinor +
            directSaleRevenueMinor -
            cogs.effectiveDirectCostMinor -
            directSaleCostKnownMinor -
            recordedOperatingExpenseMinor -
            nonCashLossMinor -
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
