import type { CraftOrder, OrderEvent } from "./types.js";

/* F-049 (Group 1 — الميثاق الرئيسي للإصلاح 2026-09-28): عزو التسليم
 * للفترة أغلى قيمة مالية تُقرأ في النظام — «آخر تسليم ساري» لا «أول حدث
 * تسليم»؛ بعد عكس التسليم وإعادة التسليم لاحقًا كان القارئ العام يعزو
 * الإيراد المعاد الاعتراف به إلى تاريخ التسليم المعكوس فتربح فترة قديمة
 * من إيراد فترة أحدث. الاشتقاق كان مرآة في طبقة التطبيق
 * (fulfillment/deliveryAttribution.ts) — صار ملك الدومين هنا (منطق
 * hasDeliveryReversal نفسه) وتعيد طبقة التطبيق تصديره لمستهلكيها؛ لا سلوك
 * جديد ولا حساب مغير — النقل حرفي باختبارات القائمة خضراء. */

function isDeliveredEvent(event: OrderEvent): boolean {
  return event.type === "status_changed" && event.toStatus === "delivered";
}

/** آخر حدث تسليم غير معكوس — null إذا كان كل تسليم معكوسًا أو لا تسليم أصلًا.
 * التراجع يقترن بربط صريح (reversesEventId) بحدث التسليم نفسه. */
export function lastEffectiveDeliveryEvent(order: CraftOrder): OrderEvent | null {
  const delivered = order.events.filter(isDeliveredEvent);
  for (let index = delivered.length - 1; index >= 0; index -= 1) {
    const candidate = delivered[index];
    if (candidate === undefined) continue;
    const reversed = order.events.some(
      event => event.type === "delivery_reversed" && event.reversesEventId === candidate.id,
    );
    if (!reversed) return candidate;
  }
  return null;
}
