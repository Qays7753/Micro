import { useRef } from "react";

/* U-005 (دورة التدقيق النهائي): حماية المدخلات غير المحفوظة لكل المحررات العميقة —
 * routeClassifier يوثّق الحارس كسبب إخفاء شريط التنقل السفلي في المحررات، فوجب أن
 * يكون الحارس مسجّلًا فعلًا في كل نموذج عميق لا في خمسة فقط. */
/* هذا المساعد يكتشف «وسخ» النموذج بمقارنة قيم الحقول الحالية بلقطة أولية تُلتقط
 * عند التركيب، وتُعاد التقاطها حين يتغير resetToken (بعد تحميل سجل موجود أو بعد
 * حفظ ناجح). المقارنة سطحية بالقيم — كافية لحقول النماذج المستقيمة هنا.
 *
 * إصلاح المجموعة ٥ (استمرارية المسودة): الشرط القديم أعاد التقاط اللقطة كل
 * إعادة رسم لمن لا يمرّر resetToken (صيغ الإنشاء الجديد كالأصل والقرض) فصار
 * «الوسخ» false دومًا — لا كتابة مسودة ولا حارس مدخلات لهذه الصفحات. اللقطة
 * الآن تُلتقط عند التركيب، وتُعاد فقط عند تغيّر الرمز الممرَّر فعليًا. */
export function useFormDirty(values: readonly unknown[], resetToken?: unknown): boolean {
  const snapshot = useRef<readonly unknown[] | null>(null);
  const tokenRef = useRef<unknown>(Symbol("initial"));
  const tokenChanged = resetToken !== undefined && tokenRef.current !== resetToken;
  if (snapshot.current === null || tokenChanged) {
    if (resetToken !== undefined) tokenRef.current = resetToken;
    snapshot.current = values;
  }
  const initial = snapshot.current;
  return initial.length !== values.length || initial.some((value, index) => value !== values[index]);
}
