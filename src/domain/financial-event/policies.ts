import type { CreateFinancialEventInput, FinancialEvent, FinancialEventTotals } from "./types.js";

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
function assertNonBlank(value: string, field: string) { if (!value.trim()) throw new Error(`${field} is required`); }
function assertMinor(value: number) { if (!Number.isInteger(value) || value <= 0) throw new Error("amountMinor must be a positive integer"); }
function assertDate(value: string, field: string) { if (!DATE_PATTERN.test(value) || Number.isNaN(new Date(`${value}T12:00:00.000Z`).valueOf())) throw new Error(`${field} must be a valid local date`); }
function deltas(type: CreateFinancialEventInput["type"], amountMinor: number) {
  switch (type) {
    case "owner_investment_cash": return { cashDeltaMinor: amountMinor, payableDeltaMinor: 0, ownerCapitalDeltaMinor: amountMinor, operatingExpenseDeltaMinor: 0 };
    case "owner_withdrawal_cash": return { cashDeltaMinor: -amountMinor, payableDeltaMinor: 0, ownerCapitalDeltaMinor: -amountMinor, operatingExpenseDeltaMinor: 0 };
    case "operating_expense_cash": return { cashDeltaMinor: -amountMinor, payableDeltaMinor: 0, ownerCapitalDeltaMinor: 0, operatingExpenseDeltaMinor: amountMinor };
    case "operating_expense_payable": return { cashDeltaMinor: 0, payableDeltaMinor: amountMinor, ownerCapitalDeltaMinor: 0, operatingExpenseDeltaMinor: amountMinor };
    case "payable_settlement_cash": return { cashDeltaMinor: -amountMinor, payableDeltaMinor: -amountMinor, ownerCapitalDeltaMinor: 0, operatingExpenseDeltaMinor: 0 };
  }
}

export function createFinancialEvent(input: CreateFinancialEventInput): FinancialEvent {
  assertNonBlank(input.id, "id"); assertMinor(input.amountMinor); assertNonBlank(input.idempotencyKey, "idempotencyKey"); assertNonBlank(input.note, "note"); assertDate(input.occurredOn, "occurredOn");
  if (Number.isNaN(Date.parse(input.recordedAt))) throw new Error("recordedAt must be ISO-8601");
  const relatedEventId = input.relatedEventId?.trim() || null;
  if (input.type === "payable_settlement_cash" && !relatedEventId) throw new Error("payable settlement requires relatedEventId");
  if (input.type !== "payable_settlement_cash" && relatedEventId) throw new Error("only payable settlement may reference a related event");
  const counterparty = input.counterparty?.trim() || null;
  return Object.freeze({ id: input.id, type: input.type, currency: "JOD", amountMinor: input.amountMinor, occurredOn: input.occurredOn, recordedAt: input.recordedAt, idempotencyKey: input.idempotencyKey, note: input.note.trim(), counterparty, relatedEventId, ...deltas(input.type, input.amountMinor) });
}

export function summarizeFinancialEvents(events: readonly FinancialEvent[]): FinancialEventTotals {
  return events.reduce<FinancialEventTotals>((totals, event) => ({ cashMinor: totals.cashMinor + event.cashDeltaMinor, payableMinor: totals.payableMinor + event.payableDeltaMinor, ownerCapitalMinor: totals.ownerCapitalMinor + event.ownerCapitalDeltaMinor, operatingExpenseMinor: totals.operatingExpenseMinor + event.operatingExpenseDeltaMinor, eventCount: totals.eventCount + 1 }), { cashMinor: 0, payableMinor: 0, ownerCapitalMinor: 0, operatingExpenseMinor: 0, eventCount: 0 });
}
