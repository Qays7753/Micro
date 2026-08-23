/**
 * Project financial Application layer. It combines recorded project events with existing order-only
 * collections and receivables without turning either into project profit or unrecorded cash.
 */
import { createFinancialEvent, summarizeFinancialEvents, type FinancialEvent, type FinancialEventType } from "@micro-domain/financial-event/index.js";
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
  truth: string;
};
export type FinancialRecordInput = { type: FinancialEventType; amountMinor: number; occurredOn: string; note: string; counterparty: string | null; relatedEventId: string | null; idempotencyKey: string };
export type FinanceResult<T> = { ok: true; value: T; reused?: boolean } | { ok: false; code: "validation_error" | "storage_error"; message: string };

function id(): string { return globalThis.crypto?.randomUUID?.() ?? `financial-${Date.now()}-${Math.random().toString(36).slice(2)}`; }

export class ProjectFinancialService {
  constructor(private readonly store: PrototypeLocalStore, private readonly now: () => string = () => new Date().toISOString()) {}

  async readPosition(): Promise<FinanceResult<ProjectFinancialPosition>> {
    const [ordersResult, eventsResult] = await Promise.all([this.store.listOrders(), this.store.listFinancialEvents()]);
    if (!ordersResult.ok || !eventsResult.ok) return { ok: false, code: "storage_error", message: "تعذر قراءة السجلات المالية المحلية." };
    const orderPulse = summarizeLocalCraftOrders(ordersResult.value); const project = summarizeFinancialEvents(eventsResult.value);
    return { ok: true, value: { recordedCashMinor: orderPulse.registeredCollectionsMinor + project.cashMinor, customerReceivablesMinor: orderPulse.registeredDebtMinor, supplierPayablesMinor: project.payableMinor, ownerCapitalRecordedMinor: project.ownerCapitalMinor, operatingExpensesRecordedMinor: project.operatingExpenseMinor, orderCollectionsMinor: orderPulse.registeredCollectionsMinor, projectEventCount: project.eventCount, truth: "الكاش والذمم هنا مبنيان على أحداث محلية مسجلة فقط. لا يعرض هذا السطح صافي الربح أو مخزونًا أو قيمة كل ما تملكه." } };
  }

  async listEvents(): Promise<FinanceResult<readonly FinancialEvent[]>> { const result = await this.store.listFinancialEvents(); return result.ok ? { ok: true, value: result.value } : { ok: false, code: "storage_error", message: "تعذر قراءة سجل الأحداث المالية." }; }

  async record(input: FinancialRecordInput): Promise<FinanceResult<FinancialEvent>> {
    const existing = await this.store.listFinancialEvents(); if (!existing.ok) return { ok: false, code: "storage_error", message: "تعذر التحقق من سجل الأحداث المالية." };
    const repeated = existing.value.find((event) => event.type === input.type && event.idempotencyKey === input.idempotencyKey);
    if (repeated) return { ok: true, value: repeated, reused: true };
    if (input.type === "payable_settlement_cash") {
      const source = existing.value.find((event) => event.id === input.relatedEventId);
      if (!source || source.type !== "operating_expense_payable") return { ok: false, code: "validation_error", message: "اختر التزام مصروف مسجلًا قبل تسجيل تسديده." };
      const paid = existing.value.filter((event) => event.type === "payable_settlement_cash" && event.relatedEventId === source.id).reduce((sum, event) => sum + event.amountMinor, 0);
      if (input.amountMinor > source.amountMinor - paid) return { ok: false, code: "validation_error", message: "لا يمكن أن يتجاوز التسديد المتبقي المسجل على هذا الالتزام." };
    }
    try {
      const event = createFinancialEvent({ id: id(), type: input.type, amountMinor: input.amountMinor, occurredOn: input.occurredOn, recordedAt: this.now(), idempotencyKey: input.idempotencyKey, note: input.note, counterparty: input.counterparty, relatedEventId: input.relatedEventId });
      const saved = await this.store.saveFinancialEvent(event);
      return saved.ok ? { ok: true, value: saved.value } : { ok: false, code: "storage_error", message: "تعذر حفظ الحدث المالي محليًا. لم يتم تأكيد نجاح العملية." };
    } catch (error) { return { ok: false, code: "validation_error", message: error instanceof Error ? error.message : "بيانات الحدث المالي غير صالحة." }; }
  }
}
