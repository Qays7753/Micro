/**
 * S13 (CAL-C — أمر 2158b0fc §6): اقتراح موعد التقويم بين خطوات الطلب —
 * حالة عرض جلسة بمفتاح محدود (لا أسماء ولا مبالغ) يملكها البيت التطبيقي
 * لا الصفحات (حدود المجموعة ٦)؛ وذاكرة جلسة داخل التطبيق لا مخازن المتصفح
 * إطلاقًا (حارس R11 ARCH-010: لا وصول إنتاجيًا لمفاتيح تخزين المتصفح خارج
 * مهايئ التشخيص المسجل الوحيد).
 * اليوم المختار من تقويم الطلبات يصل محرر المسودة اقتراحًا ظاهرًا قابلًا
 * للتعديل أو الإزالة، ويُستهلك عند خطوة الاتفاق مرة واحدة — لا حفظ من
 * الفتح ولا حقل خفي ولا حجز يوم (CAL-AC05/06/07).
 *
 * طبيعة الجلسة الداخلية: تعيش طول تنقلات التطبيق داخل المتصفح (مسار
 * مفرد داخل الجلسة الواحدة) وتضيع عند إعادة التحميل بلا أي أثر مالي —
 * والأدق لعقد CAL-C: لا يُستعاد اقتراح في إنشاء لاحق بلا قصد (القاعدة
 * صارمة من مالك اليوم المختار)؛ ولا تتسرب بين التبويبات ولا تُخلّد (لا مخزن
 * دائم لسياق تقويم — الطلب §7 من أمر S13: لا مصدر حقيقة دائم لعرض مشتق).
 */
import { isValidLocalDate } from "@micro-domain/shared/index.js";

/* ذاكرة جلسة داخلية بمفتاح المسودة — حالة عرض صافية
 * بلا أسماء ولا مبالغ (تاريخ محلي صالح فقط)، يملكها البيت التطبيقي حصرًا
 * (نمط عناصر الحالة الدائمة في جذر التركيب — singletonStore والخدمات
 * الدائمة — عنصر حالة مستقل بمستوى الوحدة). */
const sessionProposals = new Map<string, string>();

/** تسجيل الاقتراح بهوية المسودة — التاريخ المحلي الصالح وحده يُقبل
 * (صاحب الصلاحية الكنوني: isValidLocalDate — لا فحص شكل موازٍ هنا). */
export function storeScheduleProposal(draftId: string, date: string): void {
  if (!isValidLocalDate(date)) return;
  sessionProposals.set(draftId, date);
}

/** قراءة الاقتراح بلا استهلاك — لعرضه في محرر المسودة وإزالته الصريحة. */
export function readScheduleProposal(draftId: string): string | null {
  const value = sessionProposals.get(draftId);
  return value !== undefined && isValidLocalDate(value) ? value : null;
}

/** استهلاك الاقتراح مرة واحدة عند خطوة الاتفاق — يظهر للمراجعة ثم يزول المفتاح. */
export function consumeScheduleProposal(draftId: string): string | null {
  const value = sessionProposals.get(draftId);
  if (value === undefined) return null;
  sessionProposals.delete(draftId);
  return isValidLocalDate(value) ? value : null;
}

/** إزالة صريحة من محرر المسودة — قرار المالك لا تخلية تلقائية. */
export function clearScheduleProposal(draftId: string): void {
  sessionProposals.delete(draftId);
}
