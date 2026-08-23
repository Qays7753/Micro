export type ActualTimeKnowledge = "known" | "estimated" | "needs_review";

export type ActualTimeRecord = {
  id: string;
  orderId: string;
  minutesDelta: number;
  recordedOn: string;
  createdAt: string;
  note: string | null;
  operationKey: string;
  reversalOfId: string | null;
  reversalReason: string | null;
};

export type CreateActualTimeRecordInput = Omit<ActualTimeRecord, "reversalOfId" | "reversalReason">;
export type ReverseActualTimeRecordInput = { id: string; target: ActualTimeRecord; recordedOn: string; createdAt: string; reason: string; operationKey: string };
export type ActualTimeComparison = { status: "not_recorded" | "recorded" | "needs_review"; plannedMinutes: number; actualMinutes: number | null; varianceMinutes: number | null; recordCount: number; reversedRecordCount: number };
