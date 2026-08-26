export type OwnerEntitlementPolicyStatus = "active" | "ended";
export type OwnerEntitlementPolicyFamily = "time_period" | "fixed_amount" | "completed_work" | "profit_share" | "completed_sale_percentage" | "unit";
export type OwnerEntitlementPolicyKind = "monthly" | "weekly" | "daily" | "hourly" | "fixed_period" | "fixed_shift" | "per_completed_work" | "profit_share" | "sale_percentage" | "per_unit";
export type OwnerEntitlementKnowledge = "known" | "estimated" | "partial" | "incomplete";
export type OwnerEntitlementCalculationBasis = "time_period" | "fixed_amount" | "completed_work" | "profit_share" | "completed_sale_percentage" | "unit";

export type OwnerEntitlementPolicy = {
  id: string;
  seriesId: string;
  successorOfPolicyId: string | null;
  version: number;
  family: OwnerEntitlementPolicyFamily;
  kind: OwnerEntitlementPolicyKind;
  amountMinor: number | null;
  percentageBps: number | null;
  unitLabel: string | null;
  startsOn: string;
  endsOn: string | null;
  source: string;
  note: string;
  status: OwnerEntitlementPolicyStatus;
  idempotencyKey: string;
  createdAt: string;
};

export type CreateOwnerEntitlementPolicyInput = Omit<OwnerEntitlementPolicy, "createdAt" | "seriesId" | "successorOfPolicyId"> & {
  createdAt: string;
  seriesId?: string | null;
  successorOfPolicyId?: string | null;
};

/** Terms that a dated successor may change without rewriting its predecessor. */
export type OwnerEntitlementPolicyTerms = Pick<OwnerEntitlementPolicy, "kind" | "amountMinor" | "percentageBps" | "unitLabel" | "endsOn">;

export type CreateOwnerEntitlementPolicySuccessorInput = Omit<OwnerEntitlementPolicy, "family" | "createdAt"> & {
  createdAt: string;
};

export type OwnerEntitlementRecord = {
  id: string;
  policyId: string;
  policyVersion: number;
  periodFrom: string;
  periodTo: string;
  occurredOn: string;
  recordedAt: string;
  amountMinor: number;
  knowledge: Exclude<OwnerEntitlementKnowledge, "incomplete">;
  calculationBasis: OwnerEntitlementCalculationBasis;
  baseMinor: number | null;
  quantity: number | null;
  sourceKeys: readonly string[];
  note: string;
  idempotencyKey: string;
  reversalOfId: string | null;
  reversalReason: string | null;
};

export type OwnerEntitlementOpeningBalance = {
  id: string;
  amountMinor: number;
  occurredOn: string;
  recordedAt: string;
  reason: string;
  note: string;
  idempotencyKey: string;
  reversalOfId: string | null;
  reversalReason: string | null;
};

export type OwnerMovementKind = "draw" | "return";
export type OwnerMovementReason = "entitlement_settlement" | "opening_balance_settlement" | "pre_entitlement_draw" | "owner_draw" | "settlement_of_prior_draw" | "new_capital_investment";

export type OwnerMovement = {
  id: string;
  kind: OwnerMovementKind;
  amountMinor: number;
  walletId: string;
  occurredOn: string;
  recordedAt: string;
  reason: OwnerMovementReason;
  note: string;
  idempotencyKey: string;
  relatedEntitlementId: string | null;
  relatedOpeningBalanceId: string | null;
  relatedMovementId: string | null;
  reversalOfId: string | null;
  reversalReason: string | null;
  cashDeltaMinor: number;
  entitlementDeltaMinor: number;
  openingBalanceDeltaMinor: number;
  ownerCapitalDeltaMinor: number;
};

export type CreateOwnerMovementInput = {
  id: string;
  kind: OwnerMovementKind;
  amountMinor: number;
  walletId: string;
  occurredOn: string;
  recordedAt: string;
  reason: OwnerMovementReason;
  note: string;
  idempotencyKey: string;
  relatedEntitlementId?: string | null;
  relatedOpeningBalanceId?: string | null;
  relatedMovementId?: string | null;
};

export type CreateOwnerMovementReversalInput = {
  id: string;
  source: OwnerMovement;
  occurredOn: string;
  recordedAt: string;
  reason: string;
  idempotencyKey: string;
};

export type OwnerEntitlementRecordReversalInput = {
  id: string;
  source: OwnerEntitlementRecord;
  occurredOn: string;
  recordedAt: string;
  reason: string;
  idempotencyKey: string;
};

export type OwnerEntitlementOpeningBalanceReversalInput = {
  id: string;
  source: OwnerEntitlementOpeningBalance;
  occurredOn: string;
  recordedAt: string;
  reason: string;
  idempotencyKey: string;
};
