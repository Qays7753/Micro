/**
 * R7 / R6-F17-P06 (WS-216 — 2026-10-10): سطح استعلام صفحة الجدول — القراءة
 * الثلاثية (نظرة اليوم/لوحة الشهر/التكرارات) بفصل رسائل الفشل وترتيبها،
 * ومعامل طبقة السعة، خلف سطح تطبيقي مالك في بيت الجدولة. كان هذا المنطق
 * داخل pages/Schedule.tsx؛ الصفحة تبقي ربط React وأقسام العرض (32%
 * منسّق رئيسي + 68% أقسام) وقنوات الكتابة.
 *
 * عقد هذه الوحدة: قراءات فقط عبر الخدمتين الكنسيتين (scheduleService/
 * recurrenceService)؛ لا تخزين مباشر ولا React؛ نفس أسبقية رسائل الخطأ
 * ونص الاحتياط الحرفي.
 */

import type { ScheduleService, ScheduleOverview, MonthOverview } from "./scheduleService";
import type { ScheduleRecurrenceService, RecurrenceView } from "./recurrenceService";

/** حالة صفحة الجدول — فصل رسائل الفشل بترتيب القراءات نفسه. */
export type ScheduleState =
  | { phase: "loading" }
  | { phase: "error"; message: string }
  | {
      phase: "ready";
      overview: ScheduleOverview;
      month: MonthOverview;
      recurrences: readonly RecurrenceView[];
    };

/** القراءة الثلاثية للصفحة — نفس الوعد الأصلي وترتيبه وأسبقية رسائله. */
export async function readSchedulePage(
  deps: { schedules: ScheduleService; recurrences: ScheduleRecurrenceService },
  month: string,
): Promise<ScheduleState> {
  try {
    const [overviewResult, monthResult, recurrenceResult] = await Promise.all([
      deps.schedules.overview(),
      deps.schedules.monthOverview(month),
      deps.recurrences.list(),
    ]);
    if (!overviewResult.ok || !monthResult.ok || !recurrenceResult.ok) {
      const message = !overviewResult.ok
        ? overviewResult.message
        : !monthResult.ok
          ? monthResult.message
          : !recurrenceResult.ok
            ? recurrenceResult.message
            : "تعذر قراءة جدول المواعيد المحلي.";
      return { phase: "error", message };
    }
    return {
      phase: "ready",
      overview: overviewResult.value,
      month: monthResult.value,
      recurrences: recurrenceResult.value,
    };
  } catch {
    return { phase: "error", message: "تعذر قراءة جدول المواعيد المحلي." };
  }
}

/** المجموعة ١ (Scope A/E): وصلة عميقة دفاعية — ?focus=capacity|recurrence
 *  يفتح طبقة «التكرار والسعة»؛ القيمة المجهولة تُهمل بلا أثر. */
export function capacityLayerParam(search: string | null): boolean {
  try {
    return ["capacity", "recurrence"].includes(new URLSearchParams(search ?? "").get("focus") ?? "");
  } catch {
    return false;
  }
}
