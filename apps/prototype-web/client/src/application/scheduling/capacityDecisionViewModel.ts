import { deriveCapacityDecision, type CapacityDecision } from "./capacityDecisionService";
import type { ScheduleDay } from "./scheduleService";

export type CapacityDecisionViewModel = CapacityDecision & { label: string; tone: "accent" | "support" | "warning" };

export function buildCapacityDecisionViewModel(day: ScheduleDay, capacityMinutes: number | null): CapacityDecisionViewModel {
  const decision = deriveCapacityDecision(day, capacityMinutes);
  const presentation = {
    unknown: { label: "سعة اليوم غير محددة", tone: "support" as const },
    needs_review: { label: "تحتاج مراجعة المدة", tone: "warning" as const },
    within_limit: { label: "ضمن القيد المعلن", tone: "support" as const },
    over_limit: { label: "تحذير سعة — ليس رفضًا", tone: "warning" as const },
  }[decision.status];
  return { ...decision, ...presentation };
}
