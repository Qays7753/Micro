/**
 * المجموعة ٥ (عقد ٣٨ — تحديث لا يهدم عملًا): سجل قذارة نماذج على مستوى
 * الوحدة — الجسر بين حارس المدخلات (React) وطبقة تسجيل عامل الخدمة (خارج
 * React). عامل الخدمة لا يعيد التحميل تلقائيًا فوق نموذج قذر، وزر التحديث
 * يعلّم المستخدم أن يحفظ أولًا.
 */

let dirtyFormCount = 0;

export function setDirtyForms(count: number): void {
  dirtyFormCount = Math.max(0, count);
}

export function hasDirtyForms(): boolean {
  return dirtyFormCount > 0;
}
