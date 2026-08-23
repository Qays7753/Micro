/**
 * Project financial Application layer. It combines recorded project events with existing order-only
 * collections and receivables without turning either into project profit or unrecorded cash.
 */
import { createFinancialEvent, summarizeFinancialEvents, type FinancialEvent, type FinancialEventType, type OperatingExpenseContext } from "@micro-domain/financial-event/index.js";
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
export type RecordedPeriodResult = { from: string; to: string; recognizedRevenueMinor: number; recognizedDirectCostMinor: number; recordedOperatingExpenseMinor: number; resultMinor: number; finalOrderCount: number; excludedOrderCount: number; expenseNeedsReviewCount: number; status: "recorded_only" | "incomplete"; truth: string };
export type FinancialRecordInput = { type: FinancialEventType; amountMinor: number; occurredOn: string; note: string; counterparty: string | null; relatedEventId: string | null; expenseContext?: OperatingExpenseContext | null; idempotencyKey: string };
export type FinanceResult<T> = { ok: true; value: T; reused?: boolean } | { ok: false; code: "validation_error" | "storage_error"; message: string };

function id(): string { return globalThis.crypto?.randomUUID?.() ?? `financial-${Date.now()}-${Math.random().toString(36).slice(2)}`; }
function ammanDate(timestamp: string): string { const parts = new Intl.DateTimeFormat("en", { timeZone: "Asia/Amman", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date(timestamp)); const value = (type: string) => parts.find((part) => part.type === type)?.value; return `${value("year")}-${value("month")}-${value("day")}`; }

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
    const inPeriod = (date: string) => date >= from && date <= to;
    const delivered = ordersResult.value.map((stored) => { const event = stored.order.events.find((candidate) => candidate.type === "status_changed" && candidate.toStatus === "delivered"); return { order: stored.order, deliveredAt: event ? ammanDate(event.createdAt) : null }; }).filter((item) => item.deliveredAt !== null && inPeriod(item.deliveredAt));
    const finals = delivered.filter((item) => item.order.resultStatus === "final"); const excludedOrderCount = delivered.length - finals.length;
    const recognizedRevenueMinor = finals.reduce((total, item) => total + item.order.recognizedRevenueMinor, 0); const recognizedDirectCostMinor = finals.reduce((total, item) => total + item.order.recognizedCostMinor, 0); const periodEvents = eventsResult.value.filter((event) => inPeriod(event.occurredOn)); const recordedOperatingExpenseMinor = periodEvents.reduce((total, event) => total + event.operatingExpenseDeltaMinor, 0); const expenseNeedsReviewCount = periodEvents.filter((event) => event.operatingExpenseDeltaMinor > 0 && (!event.expenseContext || event.expenseContext.knowledge !== "known")).length; const incomplete = excludedOrderCount > 0 || expenseNeedsReviewCount > 0;
    return { ok: true, value: { from, to, recognizedRevenueMinor, recognizedDirectCostMinor, recordedOperatingExpenseMinor, resultMinor: recognizedRevenueMinor - recognizedDirectCostMinor - recordedOperatingExpenseMinor, finalOrderCount: finals.length, excludedOrderCount, expenseNeedsReviewCount, status: incomplete ? "incomplete" : "recorded_only", truth: incomplete ? "توجد طلبات مسلّمة أو مصاريف مسجلة تحتاج معرفة أو تصنيفًا أو مراجعة. لا تجعل هذه الصورة صافي ربح نهائيًا؛ المخزون والتوزيع والضرائب خارجها." : "هذه نتيجة الطلبات النهائية ناقص المصاريف التشغيلية المعروفة المسجلة في الفترة. لا تؤكد اكتمال المخزون أو التوزيع أو الضرائب، لذلك ليست صافي ربح نهائيًا." } };
  }

  async record(input: FinancialRecordInput): Promise<FinanceResult<FinancialEvent>> {
    const existing = await this.store.listFinancialEvents(); if (!existing.ok) return { ok: false, code: "storage_error", message: "تعذر التحقق من سجل الأحداث المالية." };
    const repeated = existing.value.find((event) => event.type === input.type && event.idempotencyKey === input.idempotencyKey);
    if (repeated) return { ok: true, value: repeated, reused: true };
    if ((input.type === "operating_expense_cash" || input.type === "operating_expense_payable") && !input.expenseContext) return { ok: false, code: "validation_error", message: "حدد سياق المصروف ودرجة معرفته قبل الحفظ." };
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
