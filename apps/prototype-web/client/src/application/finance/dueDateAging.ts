/**
 * Stage 2 — OPS-001 (tracker): تصنيف تاريخ الاستحقاق مقابل «اليوم» المحلي
 * والتقادم الأساسي — منطق قراءة صرف بلا ساعة داخلية ولا كتابة.
 *
 * خوارزمية «تاريخ مقابل اليوم» المعتمدة نفسها المعتمدة لمواعيد المتابعة
 * (classifyFollowUpDate — عقد G7-A) تُستخدم بمصدر واحد لا نسختين؛ الاسم
 * الصريح هنا لمواعيد الدفع والتحصيل. التاريخ المفقود (null) يبقى «غير محدد»
 * ولا يتحول إلى اليوم أو الصفر أبدًا، وغير الصالح يُعلن ولا يُعوّض.
 */
import { classifyFollowUpDate, type FollowUpDateStatus } from "@/application/agreements/followUpDate";

/** حالة تاريخ الاستحقاق المقروء: غير محدد / غير صالح / متأخر / اليوم / قادم. */
export type DueDateState = FollowUpDateStatus;

/** تصنيف تاريخ استحقاق مقابل تاريخ اليوم المحلي (YYYY-MM-DD) — بلا ساعة مخفية. */
export function classifyDueDate(dueOn: string | null, today: string): DueDateState {
  return classifyFollowUpDate(dueOn, today);
}

/** التقادم الأساسي (OPS-001): متأخر / حالي (اليوم أو قادم) / مجهول التاريخ. */
export type DueAgingBucket = "overdue" | "current" | "unknown";

export function dueAgingBucket(state: DueDateState): DueAgingBucket {
  if (state === "overdue") return "overdue";
  if (state === "today" || state === "upcoming") return "current";
  return "unknown";
}
