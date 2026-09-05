/**
 * المجموعة ٦ (تدقيق A1 — FT-01): عزو التسليم للفترة يجب أن يقرأ «آخر تسليم
 * ساري» لا «أول حدث تسليم» — بعد عكس التسليم وإعادة التسليم لاحقًا كان
 * القارئ العام يعزو الإيراد المعاد الاعتراف به إلى تاريخ التسليم المعكوس،
 * فتربح فترة قديمة من إيراد فترة أحدث وتخسر الأحدث أثرها. هذا المساعد يعكس
 * منطق النطاق نفسه (hasDeliveryReversal في policies) للقراءة فقط.
 */
import type { CraftOrder, OrderEvent } from "@micro-domain/craft-order/index.js";

function isDeliveredEvent(event: OrderEvent): boolean {
  return event.type === "status_changed" && event.toStatus === "delivered";
}

/** آخر حدث تسليم غير معكوس — null إذا كان كل تسليم معكوسًا أو لا تسليم أصلًا.
 * التراجع يقترن بربط صريح (reversesEventId) بحدث التسليم نفسه. */
export function lastEffectiveDeliveryEvent(order: CraftOrder): OrderEvent | null {
  const delivered = order.events.filter(isDeliveredEvent);
  for (let index = delivered.length - 1; index >= 0; index -= 1) {
    const candidate = delivered[index];
    const reversed = order.events.some(
      event => event.type === "delivery_reversed" && event.reversesEventId === candidate.id,
    );
    if (!reversed) return candidate;
  }
  return null;
}

/** تاريخ آخر تسليم ساري بصيغة ISO المحلية (Amman) — أو null. */
export function effectiveDeliveryDate(order: CraftOrder, toLocalDate: (timestamp: string) => string): string | null {
  const event = lastEffectiveDeliveryEvent(order);
  return event ? toLocalDate(event.createdAt) : null;
}
