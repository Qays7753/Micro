/** Project-level financial events are separate from CraftOrder result fields. All money is JOD minor units. */
import type { Currency, MoneyMinor } from "../shared/index.js";

/* المبدأ الثالث عشر: المال الذي بحوزتك ليس بالضرورة مالك — الأمانات مال عابر يدخل
 * الكاش ولا يدخل الإيراد ولا المصروف ولا رأس مال المالك. والخسارة غير النقدية (هالك/تلف)
 * تخفض الربح من دون حركة كاش. كلاهما نوع صريح له أثر معلن، لا مجرد تسمية. */
export type FinancialEventType =
  | "owner_investment_cash"
  | "owner_withdrawal_cash"
  | "operating_expense_cash"
  | "operating_expense_payable"
  | "payable_settlement_cash"
  | "amanah_held_cash"
  | "amanah_released_cash"
  | "loss_non_cash";
export type ExpenseRelationship = "project" | "shared";
export type ExpenseBehavior = "fixed" | "variable" | "mixed" | "unknown";
export type ExpensePurpose = "project_general" | "period" | "order" | "product" | "campaign" | "unallocated";
export type ExpenseKnowledge = "known" | "estimated" | "needs_review";
export type SharedProjectShareBasis =
  "agreed_fixed_share" | "agreed_percentage" | "owner_estimate" | "needs_review";
export type SharedProjectShare = {
  basis: SharedProjectShareBasis;
  note: string | null;
  allocation?: "allocated" | "unallocated";
  totalAmountMinor?: number | null;
  percentageBps?: number | null;
  calculatedShareMinor?: number | null;
};
export type OperatingExpenseContext = {
  relationship: ExpenseRelationship;
  behavior: ExpenseBehavior;
  purpose: ExpensePurpose;
  knowledge: ExpenseKnowledge;
  sharedProjectShare?: SharedProjectShare | null;
};
export type FinancialEventCorrectionType = "reverse";
export type FinancialEvent = {
  id: string;
  type: FinancialEventType;
  currency: Currency;
  amountMinor: MoneyMinor;
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
  cashDeltaMinor: MoneyMinor;
  payableDeltaMinor: MoneyMinor;
  ownerCapitalDeltaMinor: MoneyMinor;
  operatingExpenseDeltaMinor: MoneyMinor;
  /** أثر الأمانات: موجب عند قبض أمانة وسالب عند تسليمها. القيمة القديمة قبل هذا الحقل تُقرأ صفرًا. */
  amanahDeltaMinor?: MoneyMinor;
};

export type CreateFinancialEventInput = {
  id: string;
  type: FinancialEventType;
  amountMinor: MoneyMinor;
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
  cashMinor: MoneyMinor;
  payableMinor: MoneyMinor;
  ownerCapitalMinor: MoneyMinor;
  operatingExpenseMinor: MoneyMinor;
  amanahMinor: MoneyMinor;
  eventCount: number;
};
