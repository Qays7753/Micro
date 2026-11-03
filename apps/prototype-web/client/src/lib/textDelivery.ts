/**
 * المجموعة ٥ (عقد ٣٣ — تسليم يدوي) ثم UNIT-040 (تنفيذ S15 بالأمر الموحد
 * §5): معيّن تنزيل نص كملف فقط — المشاركة اليدوية (لوحة النظام) والنسخ
 * النصي أزيلتا بقرار إلغاء المشاركة المعتمد، بلا بديل واتساب أو رسالة
 * أو نسخ نص.
 *
 * العقد:
 * - التنزيل دائمًا متاح (نمط S5-11: إبطال مؤجل ٣٠ ثانية لتفادي إجهاد WebKit).
 * - لا شبكة هنا إطلاقًا: كل شيء محلي؛ لا يغادر الجهاز شيء — الملف يبقى
 *   بيد المالك وحده.
 * - هذا المعيّن يخدم تنزيل كشف الفترة (UNIT-016) وما يعتمد عليه من
 *   أدوات تنزيل معتمدة؛ النسخ الاحتياطي (UNIT-044) له خدمة النقل الخاصة
 *   به ولا يمر من هنا.
 */

export function downloadTextFile(filename: string, text: string, mimeType: string): void {
  const blob = new Blob([`\uFEFF${text}`], { type: `${mimeType};charset=utf-8` });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  /* S5-11: الإبطال مؤجل — الإبطال الفوري المتزامن قد يجهض التنزيل في WebKit. */
  globalThis.setTimeout(() => URL.revokeObjectURL(url), 30_000);
}
