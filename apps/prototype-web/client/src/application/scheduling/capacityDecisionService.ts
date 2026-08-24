import type { ScheduleDay } from "./scheduleService";

export type CapacityDecisionStatus = "unknown" | "needs_review" | "within_limit" | "over_limit";
export type CapacityDecision = { date: string; status: CapacityDecisionStatus; scheduledMinutes: number; capacityMinutes: number | null; unknownTimingCount: number; conflictCount: number; nextAction: string; truth: string };

export function deriveCapacityDecision(day: ScheduleDay, capacityMinutes: number | null): CapacityDecision {
  if (capacityMinutes === null) return { date: day.date, status: "unknown", scheduledMinutes: day.scheduledMinutes, capacityMinutes: null, unknownTimingCount: day.unknownTimingCount, conflictCount: day.conflictCount, nextAction: "حدد سعة يومية فقط إذا كانت لديك قاعدة عملية قابلة للقياس.", truth: "لم تحدد سعة هذا اليوم؛ لا يعرض Micro رفضًا أو سعة صفرية." };
  if (day.unknownTimingCount > 0) return { date: day.date, status: "needs_review", scheduledMinutes: day.scheduledMinutes, capacityMinutes, unknownTimingCount: day.unknownTimingCount, conflictCount: day.conflictCount, nextAction: "راجع المواعيد التي لا تملك لها وقتًا أو مدة قبل اتخاذ قرار.", truth: "بعض المواعيد بلا مدة معروفة؛ لم تحول البيانات الناقصة إلى صفر." };
  if (day.overCapacity) return { date: day.date, status: "over_limit", scheduledMinutes: day.scheduledMinutes, capacityMinutes, unknownTimingCount: 0, conflictCount: day.conflictCount, nextAction: "راجع الموعد أو أجّل العمل بقرار المالك؛ هذا تحذير وليس رفضًا آليًا.", truth: "الوقت المعروف يتجاوز القيد اليومي المعلن، ولا يغير ذلك أي مال أو طلب تاريخي." };
  return { date: day.date, status: "within_limit", scheduledMinutes: day.scheduledMinutes, capacityMinutes, unknownTimingCount: 0, conflictCount: day.conflictCount, nextAction: "يمكن متابعة القرار التشغيلي مع إبقاء التعارضات الظاهرة إن وجدت.", truth: "الوقت المعروف ضمن القيد اليومي المعلن؛ لا يعني ذلك ضمان توفر كامل." };
}
