/** Project-level financial events are separate from CraftOrder result fields. All money is JOD minor units. */
export type FinancialEventType = "owner_investment_cash" | "owner_withdrawal_cash" | "operating_expense_cash" | "operating_expense_payable" | "payable_settlement_cash";
export type FinancialEvent = {
  id: string;
  type: FinancialEventType;
  currency: "JOD";
  amountMinor: number;
  occurredOn: string;
  recordedAt: string;
  idempotencyKey: string;
  note: string;
  counterparty: string | null;
  relatedEventId: string | null;
  cashDeltaMinor: number;
  payableDeltaMinor: number;
  ownerCapitalDeltaMinor: number;
  operatingExpenseDeltaMinor: number;
};

export type CreateFinancialEventInput = {
  id: string;
  type: FinancialEventType;
  amountMinor: number;
  occurredOn: string;
  recordedAt: string;
  idempotencyKey: string;
  note: string;
  counterparty?: string | null;
  relatedEventId?: string | null;
};

export type FinancialEventTotals = {
  cashMinor: number;
  payableMinor: number;
  ownerCapitalMinor: number;
  operatingExpenseMinor: number;
  eventCount: number;
};
