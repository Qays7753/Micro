/** Project-level financial events are separate from CraftOrder result fields. All money is JOD minor units. */
export type FinancialEventType = "owner_investment_cash" | "owner_withdrawal_cash" | "operating_expense_cash" | "operating_expense_payable" | "payable_settlement_cash";
export type ExpenseRelationship = "project" | "shared";
export type ExpenseBehavior = "fixed" | "variable" | "mixed" | "unknown";
export type ExpensePurpose = "project_general" | "period" | "order" | "product" | "campaign" | "unallocated";
export type ExpenseKnowledge = "known" | "estimated" | "needs_review";
export type SharedProjectShareBasis = "agreed_fixed_share" | "owner_estimate" | "needs_review";
export type SharedProjectShare = { basis: SharedProjectShareBasis; note: string | null };
export type OperatingExpenseContext = { relationship: ExpenseRelationship; behavior: ExpenseBehavior; purpose: ExpensePurpose; knowledge: ExpenseKnowledge; sharedProjectShare?: SharedProjectShare | null };
export type FinancialEventCorrectionType = "reverse";
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
  /** Present on newly classified operating expenses; absent records are preserved as legacy local history. */
  expenseContext?: OperatingExpenseContext | null;
  /** Present only on a new event that corrects an existing general financial event. */
  correctionType?: FinancialEventCorrectionType | null;
  correctionOfEventId?: string | null;
  correctionReason?: string | null;
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
  expenseContext?: OperatingExpenseContext | null;
};

export type CreateFinancialReversalInput = {
  id: string;
  sourceEvent: FinancialEvent;
  occurredOn: string;
  recordedAt: string;
  idempotencyKey: string;
  reason: string;
};

export type FinancialEventTotals = {
  cashMinor: number;
  payableMinor: number;
  ownerCapitalMinor: number;
  operatingExpenseMinor: number;
  eventCount: number;
};
