/** Project-level financial events are separate from CraftOrder result fields. All money is JOD minor units. */
import type { Currency, MoneyMinor } from "../shared/index.js";

/* المبدأ الثالث عشر: المال الذي بحوزتك ليس بالضرورة مالك — الأمانات مال عابر يدخل
 * الكاش ولا يدخل الإيراد ولا المصروف ولا رأس مال المالك. والخسارة غير النقدية (هالك/تلف)
 * تخفض الربح من دون حركة كاش. كلاهما نوع صريح له أثر معلن، لا مجرد تسمية.
 * المجموعة ٤ (عقد ٢٩): الأصول والقروض الصادرة والعربون المحتفظ به طبقات مالية
 * مستقلة — الشراء الرأسمالي ليس مصروفًا تشغيليًا، والقرض ليس سحبًا ولا مصروفًا،
 * والعربون المحتفظ به لا يصير إيرادًا ولا مالكًا إلا بتصنيف صريح قابل للعكس. */
export type FinancialEventType =
  | "owner_investment_cash"
  | "owner_withdrawal_cash"
  | "operating_expense_cash"
  | "operating_expense_payable"
  | "payable_settlement_cash"
  | "amanah_held_cash"
  | "amanah_released_cash"
  | "loss_non_cash"
  | "asset_purchase_cash"
  | "asset_purchase_payable"
  | "asset_depreciation"
  | "asset_disposal_cash"
  | "asset_writeoff"
  | "loan_outgoing_cash"
  | "loan_repayment_cash"
  | "deposit_retained_revenue"
  | "deposit_retained_owner";
type ExpenseRelationship = "project" | "shared";
type ExpenseBehavior = "fixed" | "variable" | "mixed" | "unknown";
type ExpensePurpose = "project_general" | "period" | "order" | "product" | "campaign" | "unallocated";
type ExpenseKnowledge = "known" | "estimated" | "needs_review";
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
  /* المجموعة ١ (تصنيفي للمصاريف): وسم بشري اختياري يجيب «على شو اندفعت المصاري؟»
   * — بُعد قراءة وتجميع فقط؛ لا يغيّر أي دلتا مالية ولا الحصة ولا النتيجة.
   * مجمّد مع الحدث؛ تعديله لاحقًا = تراجع موثق + تسجيل جديد. */
  categoryLabel?: string | null;
};
/* المجموعة ٤ (عقد ٢٩): سياقات مرتبطة — هوية الأصل أو القرض أو الطلب المصدر.
 * سياق إلزامي لنوعه؛ غيابه عن الأنواع الأخرى يُرفض (لا حدث أصول بلا أصل). */
export type AssetEventContext = {
  assetId: string;
  name: string;
  /* الدفتري المجمد لحظة التخلص — إلزامي لنوع التخلص فقط. */
  bookValueMinor?: number;
};
export type LoanEventContext = {
  loanId: string;
  borrower: string;
};
export type DepositEventContext = {
  orderId: string;
};
type FinancialEventCorrectionType = "reverse";
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
  /** المجموعة ٤: أثر صافي قيمة الأصول الدفترية — شراء موجب، إهلاك/تخلص/شطب سالب.
   * القيمة القديمة قبل هذا الحقل تُقرأ صفرًا (سابقة الأمانات). */
  assetDeltaMinor?: MoneyMinor;
  /** المجموعة ٤: أثر القروض الصادرة القائمة — إقراض موجب، سداد سالب. قراءة قديمة = صفر. */
  loanDeltaMinor?: MoneyMinor;
  /** المجموعة ٤: إيراد عربون محتفظ به مصنَّف صراحةً — لا يُنشأ إلا بقرار موثق. قراءة قديمة = صفر. */
  revenueDeltaMinor?: MoneyMinor;
  assetContext?: AssetEventContext | null;
  loanContext?: LoanEventContext | null;
  depositContext?: DepositEventContext | null;
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
  assetContext?: AssetEventContext | null;
  loanContext?: LoanEventContext | null;
  depositContext?: DepositEventContext | null;
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
  /* المجموعة ٤: طبقات مستقلة تُجمع كالأمانات — القديم يقرأ صفرًا. */
  assetMinor: MoneyMinor;
  loanMinor: MoneyMinor;
  retainedDepositRevenueMinor: MoneyMinor;
  eventCount: number;
};
