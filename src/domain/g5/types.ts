export type G5Status = "available" | "incomplete" | "invalid" | "needs_review";
export type G5Knowledge = "known" | "estimated" | "needs_review";
export type G5Direction = "collection" | "commitment";
export type ShortCashDeclarationKind = "declaration" | "reversal";

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
  quantity: number;
  recognizedRevenueMinor: number;
  recognizedCostMinor: number;
};

export type G5ExpenseInput = {
  id: string;
  amountMinor: number;
  behavior: "fixed" | "variable" | "mixed" | "unknown";
  relationship: "project" | "shared";
  knowledge: G5Knowledge;
  sharedProjectShareBasis: "agreed_fixed_share" | "owner_estimate" | "needs_review" | null;
  directlyLinked: boolean;
  source: string;
};

export type G5MixItem = {
  itemName: string;
  orderCount: number;
  quantity: number;
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
