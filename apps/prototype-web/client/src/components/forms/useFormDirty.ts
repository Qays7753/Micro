import { useRef } from "react";

/* U-005 (دورة التدقيق النهائي): حماية المدخلات غير المحفوظة لكل المحررات العميقة —
 * routeClassifier يوثّق الحارس كسبب إخفاء شريط التنقل السفلي في المحررات، فوجب أن
 * يكون الحارس مسجّلًا فعلًا في كل نموذج عميق لا في خمسة فقط. */
/* هذا المساعد يكتشف «وسخ» النموذج بمقارنة قيم الحقول الحالية بلقطة أولية تُلتقط
 * عند التركيب، وتُعاد التقاطها حين يتغير resetToken (بعد تحميل سجل موجود أو بعد
 * حفظ ناجح). المقارنة سطحية بالقيم — كافية لحقول النماذج المستقيمة هنا. */
export function useFormDirty(values: readonly unknown[], resetToken?: unknown): boolean {
  const snapshot = useRef<readonly unknown[] | null>(null);
  const tokenRef = useRef<unknown>(Symbol("initial"));
  if (snapshot.current === null || resetToken === undefined || tokenRef.current !== resetToken) {
    if (resetToken !== undefined) tokenRef.current = resetToken;
    snapshot.current = values;
  }
  const initial = snapshot.current;
  return initial.length !== values.length || initial.some((value, index) => value !== values[index]);
}
