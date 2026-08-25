/**
 * Project financial Application layer. It combines recorded project events with existing order-only
 * collections and receivables without turning either into project profit or unrecorded cash.
 */
import { createFinancialEvent, createFinancialReversal, summarizeFinancialEvents, type FinancialEvent, type FinancialEventType, type OperatingExpenseContext } from "@micro-domain/financial-event/index.js";
import { summarizeLocalCraftOrders } from "@/application/financial-pulse/financialPulseService";
import type { PrototypeLocalStore } from "@/storage/local/types";

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
export type RecordedPeriodResult = { from: string; to: string; recognizedRevenueMinor: number; recognizedDirectCostMinor: number; recordedOperatingExpenseMinor: number; projectOperatingExpenseMinor: number; sharedProjectExpenseMinor: number; legacyUnclassifiedExpenseMinor: number; sharedEstimatedExpenseCount: number; sharedMissingBasisCount: number; legacyUnclassifiedExpenseCount: number; resultMinor: number | null; finalOrderCount: number; excludedOrderCount: number; expenseNeedsReviewCount: number; status: "recorded_only" | "incomplete" | "invalid"; reasons: readonly string[]; truth: string };
export type FinancialInsightStatus = "recorded_only" | "incomplete" | "not_available";
export type WorkNameProfitability = { itemName: string; finalOrderCount: number; deliveredQuantity: number; recognizedRevenueMinor: number; recognizedDirectCostMinor: number; directMarginMinor: number };
export type RecordedCostComposition = { materialMinor: number; timeMinor: number; packagingMinor: number; deliveryMinor: number; wasteMinor: number; operatingExpenseMinor: number };
export type CoverageIndicator = { status: FinancialInsightStatus; fixedExpenseMinor: number; finalDeliveredQuantity: number; directMarginMinor: number; breakEvenUnits: number | null; reasons: readonly string[]; truth: string };
export type RecordedLiquidity = { status: "recorded_only" | "incomplete"; recordedCashMinor: number; customerReceivablesMinor: number; supplierPayablesMinor: number; cashCoverageAfterLiabilitiesMinor: number; truth: string };
export type FinancialInsights = { period: RecordedPeriodResult; workNames: readonly WorkNameProfitability[]; costComposition: RecordedCostComposition; inventoryMovementCount: number; coverage: CoverageIndicator; liquidity: RecordedLiquidity; truth: string };
export type FinancialRecordInput = { type: FinancialEventType; amountMinor: number; occurredOn: string; note: string; counterparty: string | null; relatedEventId: string | null; expenseContext?: OperatingExpenseContext | null; idempotencyKey: string };
export type FinancialReversalInput = { sourceEventId: string; occurredOn: string; reason: string; idempotencyKey: string };
export type FinanceResult<T> = { ok: true; value: T; reused?: boolean } | { ok: false; code: "validation_error" | "storage_error"; message: string };

function id(): string { return globalThis.crypto?.randomUUID?.() ?? `financial-${Date.now()}-${Math.random().toString(36).slice(2)}`; }
function ammanDate(timestamp: string): string { const parts = new Intl.DateTimeFormat("en", { timeZone: "Asia/Amman", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date(timestamp)); const value = (type: string) => parts.find((part) => part.type === type)?.value; return `${value("year")}-${value("month")}-${value("day")}`; }
function isValidLocalDate(value: string): boolean { if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false; const [year, month, day] = value.split("-").map(Number); const date = new Date(Date.UTC(year!, month! - 1, day!)); return date.getUTCFullYear() === year && date.getUTCMonth() === month! - 1 && date.getUTCDate() === day; }
function sharedExpenseHasMissingBasis(event: FinancialEvent) { return event.expenseContext?.relationship === "shared" && !event.expenseContext.sharedProjectShare; }
function isRecordedOperatingExpense(event: FinancialEvent) { return event.operatingExpenseDeltaMinor !== 0; }
function expenseNeedsReview(event: FinancialEvent) { return event.operatingExpenseDeltaMinor > 0 && (!event.expenseContext || event.expenseContext.knowledge !== "known" || sharedExpenseHasMissingBasis(event)); }

export class ProjectFinancialService {
  constructor(private readonly store: PrototypeLocalStore, private readonly now: () => string = () => new Date().toISOString()) {}

  async readPosition(): Promise<FinanceResult<ProjectFinancialPosition>> {
    const [ordersResult, eventsResult, purchasesResult, walletsResult, continuityResult] = await Promise.all([this.store.listOrders(), this.store.listFinancialEvents(), this.store.listSupplierPurchases(), this.store.listCashWallets(), this.store.listCashContinuityEntries()]);
    if (!ordersResult.ok || !eventsResult.ok || !purchasesResult.ok || !walletsResult.ok || !continuityResult.ok) return { ok: false, code: "storage_error", message: "تعذر قراءة السجلات المالية المحلية." };
    const orderPulse = summarizeLocalCraftOrders(ordersResult.value); const project = summarizeFinancialEvents(eventsResult.value); const supplierMaterialPayablesMinor = purchasesResult.value.reduce((sum, purchase) => sum + purchase.payableMinor, 0); const supplierPurchaseCashPaidMinor = purchasesResult.value.reduce((sum, purchase) => sum + purchase.paidMinor, 0); const unallocatedCashMinor = orderPulse.registeredCollectionsMinor + project.cashMinor - supplierPurchaseCashPaidMinor; const walletCashMinor = continuityResult.value.reduce((sum, entry) => sum + entry.cashDeltaMinor, 0);
    return { ok: true, value: { recordedCashMinor: unallocatedCashMinor + walletCashMinor, customerReceivablesMinor: orderPulse.registeredDebtMinor, supplierPayablesMinor: project.payableMinor + supplierMaterialPayablesMinor, ownerCapitalRecordedMinor: project.ownerCapitalMinor, operatingExpensesRecordedMinor: project.operatingExpenseMinor, orderCollectionsMinor: orderPulse.registeredCollectionsMinor, projectEventCount: project.eventCount, supplierPurchaseCount: purchasesResult.value.length, supplierMaterialPayablesMinor, walletCashMinor, unallocatedCashMinor, cashWalletCount: walletsResult.value.length, truth: "الكاش المسجل يجمع رصيد المحافظ المعلن والكاش غير الموزع من الطلبات والأحداث وشراء المواد. الافتتاح والضبط لا يمثلان دخلًا أو مصروفًا أو مال مالك، والتحويل بين المحافظ لا يغير الكاش الكلي." } };
  }

  async listEvents(): Promise<FinanceResult<readonly FinancialEvent[]>> { const result = await this.store.listFinancialEvents(); return result.ok ? { ok: true, value: result.value } : { ok: false, code: "storage_error", message: "تعذر قراءة سجل الأحداث المالية." }; }

  async readRecordedPeriodResult(from: string, to: string): Promise<FinanceResult<RecordedPeriodResult>> {
    const [ordersResult, eventsResult] = await Promise.all([this.store.listOrders(), this.store.listFinancialEvents()]);
    if (!ordersResult.ok || !eventsResult.ok) return { ok: false, code: "storage_error", message: "تعذر قراءة نتيجة الفترة المحلية." };
    if (!isValidLocalDate(from) || !isValidLocalDate(to) || from > to) return { ok: true, value: { from, to, recognizedRevenueMinor: 0, recognizedDirectCostMinor: 0, recordedOperatingExpenseMinor: 0, projectOperatingExpenseMinor: 0, sharedProjectExpenseMinor: 0, legacyUnclassifiedExpenseMinor: 0, sharedEstimatedExpenseCount: 0, sharedMissingBasisCount: 0, legacyUnclassifiedExpenseCount: 0, resultMinor: null, finalOrderCount: 0, excludedOrderCount: 0, expenseNeedsReviewCount: 0, status: "invalid", reasons: ["الفترة المحلية غير صالحة؛ لا يمكن بناء نتيجة قابلة للقراءة."], truth: "لا توجد نتيجة رقمية لهذه الفترة لأن حدودها غير صالحة. صحح الشهر أو الفترة قبل الاعتماد على القراءة." } };
    const inPeriod = (date: string) => date >= from && date <= to;
    const delivered = ordersResult.value.map((stored) => { const event = stored.order.events.find((candidate) => candidate.type === "status_changed" && candidate.toStatus === "delivered"); return { order: stored.order, deliveredAt: event ? ammanDate(event.createdAt) : null }; }).filter((item) => item.deliveredAt !== null && inPeriod(item.deliveredAt));
    const finals = delivered.filter((item) => item.order.resultStatus === "final"); const excludedOrderCount = delivered.length - finals.length;
    const recognizedRevenueMinor = finals.reduce((total, item) => total + item.order.recognizedRevenueMinor, 0); const recognizedDirectCostMinor = finals.reduce((total, item) => total + item.order.recognizedCostMinor, 0); const operatingEvents = eventsResult.value.filter((event) => inPeriod(event.occurredOn) && isRecordedOperatingExpense(event)); const reviewableOperatingEvents = operatingEvents.filter((event) => event.operatingExpenseDeltaMinor > 0); const projectEvents = operatingEvents.filter((event) => event.expenseContext?.relationship === "project"); const sharedEvents = operatingEvents.filter((event) => event.expenseContext?.relationship === "shared"); const legacyEvents = operatingEvents.filter((event) => !event.expenseContext); const recordedOperatingExpenseMinor = operatingEvents.reduce((total, event) => total + event.operatingExpenseDeltaMinor, 0); const projectOperatingExpenseMinor = projectEvents.reduce((total, event) => total + event.operatingExpenseDeltaMinor, 0); const sharedProjectExpenseMinor = sharedEvents.reduce((total, event) => total + event.operatingExpenseDeltaMinor, 0); const legacyUnclassifiedExpenseMinor = legacyEvents.reduce((total, event) => total + event.operatingExpenseDeltaMinor, 0); const sharedEstimatedExpenseCount = reviewableOperatingEvents.filter((event) => event.expenseContext?.relationship === "shared" && event.expenseContext.knowledge !== "known").length; const sharedMissingBasisCount = reviewableOperatingEvents.filter((event) => event.expenseContext?.relationship === "shared" && sharedExpenseHasMissingBasis(event)).length; const legacyUnclassifiedExpenseCount = reviewableOperatingEvents.filter((event) => !event.expenseContext).length; const expenseNeedsReviewCount = reviewableOperatingEvents.filter(expenseNeedsReview).length; const reasons: string[] = []; if (excludedOrderCount > 0) reasons.push("توجد طلبات مسلّمة مستبعدة بسبب درجة المعرفة أو المراجعة."); if (sharedEstimatedExpenseCount > 0) reasons.push("توجد حصة مشروع مشتركة تقديرية أو تحتاج مراجعة."); if (sharedMissingBasisCount > 0) reasons.push("توجد حصة مشروع مشتركة بلا مصدر موثق."); if (legacyUnclassifiedExpenseCount > 0) reasons.push("توجد مصروفات قديمة بلا سياق مالي."); const incomplete = reasons.length > 0;
    return { ok: true, value: { from, to, recognizedRevenueMinor, recognizedDirectCostMinor, recordedOperatingExpenseMinor, projectOperatingExpenseMinor, sharedProjectExpenseMinor, legacyUnclassifiedExpenseMinor, sharedEstimatedExpenseCount, sharedMissingBasisCount, legacyUnclassifiedExpenseCount, resultMinor: incomplete ? null : recognizedRevenueMinor - recognizedDirectCostMinor - recordedOperatingExpenseMinor, finalOrderCount: finals.length, excludedOrderCount, expenseNeedsReviewCount, status: incomplete ? "incomplete" : "recorded_only", reasons, truth: incomplete ? "هذه نتيجة فترة أوسع من السجل المحلي، لكنها ناقصة للأسباب الظاهرة. لا تجعلها صافي ربح نهائيًا؛ COGS الفعلي والتوزيع على المنتجات والضرائب خارجها." : "هذه نتيجة طلبات نهائية ناقص مصروف مشروع وحصص مشتركة موثقة لهذه الفترة. لا تؤكد COGS الفعلي أو التوزيع على المنتجات أو الضرائب، لذلك ليست صافي ربح نهائيًا." } };
  }

  async readFinancialInsights(from: string, to: string): Promise<FinanceResult<FinancialInsights>> {
    const [periodResult, ordersResult, eventsResult, movementsResult, positionResult] = await Promise.all([this.readRecordedPeriodResult(from, to), this.store.listOrders(), this.store.listFinancialEvents(), this.store.listInventoryMovements(), this.readPosition()]);
    if (!periodResult.ok || !ordersResult.ok || !eventsResult.ok || !movementsResult.ok || !positionResult.ok) return { ok: false, code: "storage_error", message: "تعذر قراءة مؤشرات الفترة المحلية." };
    const inPeriod = (date: string) => date >= from && date <= to;
    const delivered = ordersResult.value.map((stored) => { const event = stored.order.events.find((candidate) => candidate.type === "status_changed" && candidate.toStatus === "delivered"); return { order: stored.order, deliveredAt: event ? ammanDate(event.createdAt) : null }; }).filter((item) => item.deliveredAt !== null && inPeriod(item.deliveredAt));
    const finals = delivered.filter((item) => item.order.resultStatus === "final");
    const grouped = new Map<string, WorkNameProfitability>();
    let materialMinor = 0; let timeMinor = 0; let packagingMinor = 0; let deliveryMinor = 0; let wasteMinor = 0;
    for (const { order } of finals) { const prior = grouped.get(order.itemName) ?? { itemName: order.itemName, finalOrderCount: 0, deliveredQuantity: 0, recognizedRevenueMinor: 0, recognizedDirectCostMinor: 0, directMarginMinor: 0 }; const next = { ...prior, finalOrderCount: prior.finalOrderCount + 1, deliveredQuantity: prior.deliveredQuantity + order.quantity, recognizedRevenueMinor: prior.recognizedRevenueMinor + order.recognizedRevenueMinor, recognizedDirectCostMinor: prior.recognizedDirectCostMinor + order.recognizedCostMinor, directMarginMinor: prior.directMarginMinor + order.recognizedRevenueMinor - order.recognizedCostMinor }; grouped.set(order.itemName, next); materialMinor += order.costSnapshot.materialCostMinor; timeMinor += order.costSnapshot.timeCostMinor; packagingMinor += order.costSnapshot.packagingMinor; deliveryMinor += order.costSnapshot.deliveryMinor; wasteMinor += order.costSnapshot.wasteMinor; }
    const periodEvents = eventsResult.value.filter((event) => inPeriod(event.occurredOn)); const operating = periodEvents.filter(isRecordedOperatingExpense); const reviewableOperating = operating.filter((event) => event.operatingExpenseDeltaMinor > 0); const operatingExpenseMinor = operating.reduce((total, event) => total + event.operatingExpenseDeltaMinor, 0); const fixed = operating.filter((event) => event.expenseContext?.behavior === "fixed"); const reviewableFixed = reviewableOperating.filter((event) => event.expenseContext?.behavior === "fixed"); const fixedExpenseMinor = fixed.reduce((total, event) => total + event.operatingExpenseDeltaMinor, 0); const finalDeliveredQuantity = finals.reduce((total, item) => total + item.order.quantity, 0); const directMarginMinor = finals.reduce((total, item) => total + item.order.recognizedRevenueMinor - item.order.recognizedCostMinor, 0); const movementCount = movementsResult.value.filter((movement) => inPeriod(movement.occurredOn)).length;
    const coverageReasons: string[] = []; if (finals.length === 0) coverageReasons.push("لا توجد طلبات مسلّمة بنتيجة نهائية في الفترة."); if (periodResult.value.excludedOrderCount > 0) coverageReasons.push("توجد طلبات مسلّمة مستبعدة بسبب درجة المعرفة أو المراجعة."); if (reviewableFixed.some((event) => event.expenseContext?.knowledge !== "known")) coverageReasons.push("توجد مصروفات ثابتة تحتاج مراجعة أو تقديرًا."); if (reviewableOperating.some((event) => event.expenseContext?.behavior === "variable" || event.expenseContext?.behavior === "mixed" || event.expenseContext?.behavior === "unknown")) coverageReasons.push("توجد مصروفات متغيرة أو مختلطة لا تحمل تلقائيًا على هامش المساهمة."); if (movementCount > 0) coverageReasons.push("توجد حركات مخزون فعلية لا تعيد كتابة Snapshot أو تكلفة الفترة في هذا الإصدار."); if (directMarginMinor <= 0) coverageReasons.push("الهامش المباشر المسجل غير موجب."); if (fixedExpenseMinor <= 0) coverageReasons.push("لا توجد مصروفات ثابتة مسجلة ومعروفة للفترة.");
    const coverageStatus: FinancialInsightStatus = finals.length === 0 || fixedExpenseMinor <= 0 ? "not_available" : coverageReasons.length > 0 ? "incomplete" : "recorded_only"; const breakEvenUnits = coverageStatus === "recorded_only" ? Math.ceil((fixedExpenseMinor * finalDeliveredQuantity) / directMarginMinor) : null;
    const liquidityIncomplete = positionResult.value.customerReceivablesMinor > 0 || positionResult.value.supplierPayablesMinor > 0; const liquidity: RecordedLiquidity = { status: liquidityIncomplete ? "incomplete" : "recorded_only", recordedCashMinor: positionResult.value.recordedCashMinor, customerReceivablesMinor: positionResult.value.customerReceivablesMinor, supplierPayablesMinor: positionResult.value.supplierPayablesMinor, cashCoverageAfterLiabilitiesMinor: positionResult.value.recordedCashMinor - positionResult.value.supplierPayablesMinor, truth: liquidityIncomplete ? "الذمم أو الالتزامات المسجلة لا تحمل مواعيد تحصيل أو دفع كافية؛ لا يمثل هذا توقع سيولة للأيام القادمة." : "هذه تغطية الكاش المسجل بعد الالتزامات المسجلة فقط؛ ليست توقع تدفق نقدي." };
    return { ok: true, value: { period: periodResult.value, workNames: [...grouped.values()].sort((left, right) => right.directMarginMinor - left.directMarginMinor || left.itemName.localeCompare(right.itemName, "ar")), costComposition: { materialMinor, timeMinor, packagingMinor, deliveryMinor, wasteMinor, operatingExpenseMinor }, inventoryMovementCount: movementCount, coverage: { status: coverageStatus, fixedExpenseMinor, finalDeliveredQuantity, directMarginMinor, breakEvenUnits, reasons: coverageReasons, truth: coverageStatus === "recorded_only" ? "هذا مؤشر تغطية من مزيج الطلبات النهائية والمصروفات الثابتة المسجلة لهذه الفترة، وليس نقطة تعادل نهائية أو توقعًا." : "لا يمكن عرض رقم تغطية موثوق حتى تكتمل شروط البيانات والسياسة الظاهرة." }, liquidity, truth: "هذه مؤشرات مشتقة من السجل المحلي في الفترة؛ لا تحفظ نتيجة جديدة ولا تحول الكاش أو المخزون أو الذمم إلى صافي ربح." } };
  }

  async reverse(input: FinancialReversalInput): Promise<FinanceResult<FinancialEvent>> {
    const existing = await this.store.listFinancialEvents();
    if (!existing.ok) return { ok: false, code: "storage_error", message: "تعذر التحقق من سجل الأحداث المالية." };
    const sourceEventId = input.sourceEventId.trim();
    const idempotencyKey = input.idempotencyKey.trim();
    const reason = input.reason.trim();
    if (!sourceEventId) return { ok: false, code: "validation_error", message: "اختر الواقعة الأصلية قبل تصحيحها." };
    if (!reason) return { ok: false, code: "validation_error", message: "اكتب سبب التصحيح قبل تنفيذ العكس." };
    if (!idempotencyKey) return { ok: false, code: "validation_error", message: "مفتاح التصحيح مطلوب لمنع تكرار الأثر." };
    if (!isValidLocalDate(input.occurredOn)) return { ok: false, code: "validation_error", message: "تاريخ التصحيح المحلي غير صالح." };
    const repeated = existing.value.find(event => event.correctionType === "reverse" && event.correctionOfEventId === sourceEventId && event.idempotencyKey === idempotencyKey);
    if (repeated) return { ok: true, value: repeated, reused: true };
    const keyCollision = existing.value.find(event => event.idempotencyKey === idempotencyKey);
    if (keyCollision) return { ok: false, code: "validation_error", message: "مفتاح التصحيح مستخدم في واقعة أخرى؛ اختر مفتاحًا جديدًا." };
    const source = existing.value.find(event => event.id === sourceEventId);
    if (!source) return { ok: false, code: "validation_error", message: "لم تُعثر على الواقعة الأصلية؛ لم يتغير السجل." };
    if (source.correctionType === "reverse" || source.correctionOfEventId) return { ok: false, code: "validation_error", message: "لا يمكن عكس واقعة عكس سابقة." };
    const alreadyReversed = existing.value.find(event => event.correctionType === "reverse" && event.correctionOfEventId === source.id);
    if (alreadyReversed) return { ok: false, code: "validation_error", message: "هذه الواقعة عُكست سابقًا؛ لا يُنشأ عكس ثانٍ." };
    try {
      const reversal = createFinancialReversal({ id: id(), sourceEvent: source, occurredOn: input.occurredOn, recordedAt: this.now(), idempotencyKey, reason });
      const saved = await this.store.commitFinancialEventCorrection(source.id, reversal);
      if (!saved.ok) return { ok: false, code: "storage_error", message: "تعذر حفظ العكس ذريًا. بقيت الواقعة الأصلية دون تغيير." };
      return saved.value.id === reversal.id ? { ok: true, value: saved.value } : { ok: true, value: saved.value, reused: true };
    } catch (error) {
      return { ok: false, code: "validation_error", message: error instanceof Error ? error.message : "بيانات التصحيح غير صالحة." };
    }
  }

  async record(input: FinancialRecordInput): Promise<FinanceResult<FinancialEvent>> {
    const existing = await this.store.listFinancialEvents(); if (!existing.ok) return { ok: false, code: "storage_error", message: "تعذر التحقق من سجل الأحداث المالية." };
    const repeated = existing.value.find((event) => event.type === input.type && event.idempotencyKey === input.idempotencyKey);
    if (repeated) return { ok: true, value: repeated, reused: true };
    if ((input.type === "operating_expense_cash" || input.type === "operating_expense_payable") && !input.expenseContext) return { ok: false, code: "validation_error", message: "حدد سياق المصروف ودرجة معرفته قبل الحفظ." };
    if (input.expenseContext?.relationship === "shared" && !input.expenseContext.sharedProjectShare) return { ok: false, code: "validation_error", message: "حدد كيف عرفت حصة المشروع من المصروف المشترك قبل الحفظ." };
    if (input.type === "payable_settlement_cash") {
      const source = existing.value.find((event) => event.id === input.relatedEventId);
      if (!source || source.type !== "operating_expense_payable") return { ok: false, code: "validation_error", message: "اختر التزام مصروف مسجلًا قبل تسجيل تسديده." };
      const paid = existing.value.filter((event) => event.type === "payable_settlement_cash" && event.relatedEventId === source.id).reduce((sum, event) => sum + event.amountMinor, 0);
      if (input.amountMinor > source.amountMinor - paid) return { ok: false, code: "validation_error", message: "لا يمكن أن يتجاوز التسديد المتبقي المسجل على هذا الالتزام." };
    }
    try {
      const event = createFinancialEvent({ id: id(), type: input.type, amountMinor: input.amountMinor, occurredOn: input.occurredOn, recordedAt: this.now(), idempotencyKey: input.idempotencyKey, note: input.note, counterparty: input.counterparty, relatedEventId: input.relatedEventId, expenseContext: input.expenseContext });
      const saved = await this.store.saveFinancialEvent(event);
      return saved.ok ? { ok: true, value: saved.value } : { ok: false, code: "storage_error", message: "تعذر حفظ الحدث المالي محليًا. لم يتم تأكيد نجاح العملية." };
    } catch (error) { return { ok: false, code: "validation_error", message: error instanceof Error ? error.message : "بيانات الحدث المالي غير صالحة." }; }
  }
}
