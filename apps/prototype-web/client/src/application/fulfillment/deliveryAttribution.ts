/**
 * المجموعة ٦ (تدقيق A1 — FT-01): عزو التسليم للفترة يجب أن يقرأ «آخر تسليم
 * ساري» لا «أول حدث تسليم» — بعد عكس التسليم وإعادة التسليم لاحقًا كان
 * القارئ العام يعزو الإيراد المعاد الاعتراف به إلى تاريخ التسليم المعكوس،
 * فتربح فترة قديمة من إيراد فترة أحدث وتخسر الأحدث أثرها. هذا المساعد يعكس
 * منطق النطاق نفسه (hasDeliveryReversal في policies) للقراءة فقط.
 */
import type { CraftOrder } from "@micro-domain/craft-order/index.js";
import { lastEffectiveDeliveryEvent } from "@micro-domain/craft-order/index.js";

/* F-049 (Group 1 — الميثاق الرئيسي 2026-09-28): الاشتقاق انتقل إلى الدومين
 * (craft-order/deliveryAttribution.ts) — أكثر قيمة ماليةً يُقرأ في النظام
 * لا يعاد تنفيذه خارج مصدره؛ تعيد هذه الوحدة تصديره لمستهلكيها الحاليين
 * فلا يتغير أي استيراد مستهلك، وتحتفظ بخريطة التاريخ المحلي (عرض فقط). */
export { lastEffectiveDeliveryEvent };

/** تاريخ آخر تسليم ساري بصيغة ISO المحلية (Amman) — أو null. */
export function effectiveDeliveryDate(
  order: CraftOrder,
  toLocalDate: (timestamp: string) => string,
): string | null {
  const event = lastEffectiveDeliveryEvent(order);
  return event ? toLocalDate(event.createdAt) : null;
}
