export const allocationPolicyKinds = [
  "manual_amount",
  "per_output_unit",
  "actual_time",
  "completed_revenue_percentage",
] as const;
export type AllocationPolicyKind = (typeof allocationPolicyKinds)[number];
type AllocationPolicyStatus = "active" | "inactive";

export type AllocationPolicy = {
  id: string;
  seriesId: string;
  successorOfPolicyId: string | null;
  version: number;
  catalogItemId: string;
  kind: AllocationPolicyKind;
  amountMinor: number | null;
  /** JOD minor per one complete 1.000 unit for per_output_unit; null for other kinds. */
  rateMinorPerWholeUnit: number | null;
  /** JOD minor per one whole minute for actual_time; null for other kinds. */
  rateMinor: number | null;
  percentageBps: number | null;
  unitId: string | null;
  periodFrom: string;
  periodTo: string;
  startsOn: string;
  endsOn: string | null;
  source: string;
  reason: string;
  note: string;
  status: AllocationPolicyStatus;
  idempotencyKey: string;
  createdAt: string;
  updatedAt: string;
};

export type CreateAllocationPolicyInput = Omit<AllocationPolicy, "rateMinorPerWholeUnit"> & {
  rateMinorPerWholeUnit?: number | null;
};
export type AllocationPolicyTerms = Pick<
  AllocationPolicy,
  | "kind"
  | "amountMinor"
  | "rateMinor"
  | "percentageBps"
  | "unitId"
  | "catalogItemId"
  | "periodFrom"
  | "periodTo"
  | "startsOn"
  | "endsOn"
  | "source"
  | "reason"
  | "note"
> & { rateMinorPerWholeUnit?: number | null };

export type AllocationEvidence = {
  catalogItemId: string;
  periodFrom: string;
  periodTo: string;
  finalOrderIds: readonly string[];
  excludedOrderIds: readonly string[];
  /** Total output in thousandths: 1.000 unit is 1000. */
  outputQuantityMilli: number | null;
  outputUnitId: string | null;
  actualTimeMinutes: number | null;
  missingTimeOrderIds: readonly string[];
  recognizedRevenueMinor: number | null;
  missingRevenueOrderIds: readonly string[];
  directMarginMinor: number;
};

export type AllocationKnowledge = "known" | "incomplete" | "needs_review";
export type AllocationCalculation = {
  policyId: string;
  catalogItemId: string;
  kind: AllocationPolicyKind;
  periodFrom: string;
  periodTo: string;
  status: AllocationKnowledge;
  amountMinor: number | null;
  resultMinor: number | null;
  directMarginMinor: number;
  source: string;
  reason: string;
  note: string;
  evidence: AllocationEvidence;
  excluded: readonly string[];
  reasons: readonly string[];
  nextAction: string;
  truth: string;
  calculationNote: string;
};

export type WasteContext =
  | { kind: "order"; orderId: string }
  | { kind: "catalog_item"; catalogItemId: string }
  | { kind: "catalog_template"; catalogItemId: string; templateId: string }
  | { kind: "general_project" }
  | { kind: "unallocated"; allocationNote: string | null };
