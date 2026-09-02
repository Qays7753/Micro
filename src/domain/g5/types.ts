type G5Status = "available" | "incomplete" | "invalid" | "needs_review";
export type G5Knowledge = "known" | "estimated" | "needs_review";
type G5Direction = "collection" | "commitment";
type ShortCashDeclarationKind = "declaration" | "reversal";
type G5QuantityIssue = "needs_conversion" | "invalid";

export type ShortCashDeclaration = {
  id: string;
  kind: ShortCashDeclarationKind;
  direction: G5Direction;
  amountMinor: number;
  dueOn: string;
  source: string;
  knowledge: G5Knowledge;
  note: string;
  relatedOrderId: string | null;
  relatedEventId: string | null;
  idempotencyKey: string;
  reversalOfId: string | null;
  createdAt: string;
};

export type CreateShortCashDeclarationInput = {
  id: string;
  direction: G5Direction;
  amountMinor: number;
  dueOn: string;
  source: string;
  knowledge: G5Knowledge;
  note: string;
  relatedOrderId?: string | null;
  relatedEventId?: string | null;
  idempotencyKey: string;
  createdAt: string;
};

export type CreateShortCashReversalInput = {
  id: string;
  original: ShortCashDeclaration;
  idempotencyKey: string;
  createdAt: string;
  note: string;
};

export type G5OrderInput = {
  id: string;
  itemName: string;
  deliveredOn: string;
  resultStatus: "final" | "estimated" | "incomplete" | "review_required";
  quantityMilli: number | null;
  unitKey: string | null;
  unitLabel: string | null;
  quantityIssue?: G5QuantityIssue | null;
  recognizedRevenueMinor: number;
  recognizedCostMinor: number;
};

export type G5ExpenseInput = {
  id: string;
  amountMinor: number;
  behavior: "fixed" | "variable" | "mixed" | "unknown";
  relationship: "project" | "shared";
  knowledge: G5Knowledge;
  sharedProjectShareBasis:
    "agreed_fixed_share" | "agreed_percentage" | "owner_estimate" | "needs_review" | null;
  directlyLinked: boolean;
  source: string;
};

export type G5MixItem = {
  itemName: string;
  orderCount: number;
  quantityMilli: number | null;
  unitKey: string | null;
  unitLabel: string | null;
  revenueMinor: number;
  variableCostMinor: number;
  contributionMarginMinor: number;
};

export type ContributionMarginResult = {
  status: G5Status;
  from: string;
  to: string;
  totalRevenueMinor: number;
  totalVariableCostMinor: number;
  contributionMarginMinor: number;
  contributionMarginPerUnitMinor: number | null;
  totalQuantityMilli: number | null;
  quantityUnitKey: string | null;
  quantityUnitLabel: string | null;
  fixedExpenseMinor: number;
  finalOrderCount: number;
  excludedOrderCount: number;
  mix: readonly G5MixItem[];
  sources: readonly string[];
  excluded: readonly string[];
  assumptions: readonly string[];
  reasons: readonly string[];
  nextAction: string;
};

export type BreakEvenResult = ContributionMarginResult & {
  breakEvenUnits: number | null;
};

export type ShortCashBalanceItem = {
  id: string;
  direction: G5Direction;
  amountMinor: number;
  dueOn: string | null;
  source: string;
};

export type ShortCashInput = {
  from: string;
  to: string;
  recordedCashMinor: number;
  receivables: readonly ShortCashBalanceItem[];
  payables: readonly ShortCashBalanceItem[];
  declarations: readonly ShortCashDeclaration[];
};

export type ShortCashResult = {
  status: G5Status;
  from: string;
  to: string;
  recordedCashMinor: number;
  declaredCollectionsMinor: number;
  declaredCommitmentsMinor: number;
  undatedReceivablesMinor: number;
  undatedPayablesMinor: number;
  projectedCashMinor: number | null;
  activeDeclarationCount: number;
  sources: readonly string[];
  assumptions: readonly string[];
  reasons: readonly string[];
  nextAction: string;
};
