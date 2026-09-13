/** المجموعة ٩ (STR-008): توصيف مسند التسليم قبل توحيد مصدر الحقيقة —
 * يثبت هذا الملف سلوك «آخر تسليم ساري» (عزو الفترة، FT-01) عبر المصفوفة
 * الكاملة للحالات المتاحة عبر آلة حالات النطاق العامة، بلا أي إعادة
 * لمسح الأحداث في الصفحات. الحالات: لا تسليم / مسلّم / معكوس / معكوس ثم
 * إعادة تسليم / إعادة تشغيل نفس مفتاح العكس (idempotency). */
import { describe, expect, it } from "vitest";
import { lastEffectiveDeliveryEvent } from "./deliveryAttribution";
import {
  calculateCostSnapshot,
  createCraftOrder,
  reverseDelivery,
  transitionOrder,
  type CraftOrder,
} from "@micro-domain/craft-order/index.js";

function baseOrder(id: string): CraftOrder {
  const cost = calculateCostSnapshot(`${id}-cost`, {
    currency: "JOD",
    materialItems: [
      {
        name: "خيط",
        quantity: 1,
        unit: "قطعة",
        unitPriceMinor: 500,
        priceDate: "2026-01-01",
        source: "user_input",
        confidence: "known",
      },
    ],
    time: { minutes: 60, hourlyRateMinor: 500, confidence: "known" },
    packagingMinor: 0,
    deliveryMinor: 0,
    wasteMinor: 0,
    safetyBufferMinor: 0,
    quantity: 1,
    createdAt: "2026-01-01T09:00:00.000Z",
    freshnessDays: null,
  });
  return createCraftOrder({
    id,
    customerName: "عميلة",
    itemName: "قطعة",
    specifications: "اختبار مسند التسليم",
    quantity: 1,
    agreedPriceMinor: 5000,
    costSnapshot: cost,
    createdAt: "2026-01-01T09:00:00.000Z",
  });
}

function throughPreDelivery(order: CraftOrder, id: string): CraftOrder {
  return ["provisional_agreement", "confirmed", "in_progress", "ready"].reduce<CraftOrder>(
    (current, to, index) =>
      transitionOrder(current, {
        to,
        idempotencyKey: `${id}-${to}`,
        createdAt: `2026-01-0${index + 2}T09:00:00.000Z`,
      }),
    order,
  );
}

function deliveredOrder(id: string, deliveredAt: string): CraftOrder {
  const ready = throughPreDelivery(baseOrder(id), id);
  return transitionOrder(ready, {
    to: "delivered",
    idempotencyKey: `${id}-delivered`,
    createdAt: deliveredAt,
  });
}

function redeliverAfterReversal(order: CraftOrder, id: string): CraftOrder {
  return transitionOrder(
    transitionOrder(
      transitionOrder(
        transitionOrder(order, {
          to: "confirmed",
          idempotencyKey: `${id}-reconfirm`,
          createdAt: "2026-02-01T09:00:00.000Z",
        }),
        { to: "in_progress", idempotencyKey: `${id}-resume`, createdAt: "2026-02-01T10:00:00.000Z" },
      ),
      { to: "ready", idempotencyKey: `${id}-ready2`, createdAt: "2026-02-02T09:00:00.000Z" },
    ),
    { to: "delivered", idempotencyKey: `${id}-delivered2`, createdAt: "2026-02-03T09:00:00.000Z" },
  );
}

describe("lastEffectiveDeliveryEvent characterization (STR-008 / FT-01)", () => {
  it("returns null when the order was never delivered", () => {
    expect(lastEffectiveDeliveryEvent(throughPreDelivery(baseOrder("pred-1"), "pred-1"))).toBeNull();
  });

  it("returns the delivery event when delivered and unreversed", () => {
    const order = deliveredOrder("pred-2", "2026-01-05T09:00:00.000Z");
    const effective = lastEffectiveDeliveryEvent(order);
    expect(effective?.idempotencyKey).toBe("pred-2-delivered");
    expect(effective?.createdAt).toBe("2026-01-05T09:00:00.000Z");
  });

  it("returns null after the only delivery is reversed", () => {
    const reversed = reverseDelivery(deliveredOrder("pred-3", "2026-01-05T09:00:00.000Z"), {
      idempotencyKey: "pred-3-reverse",
      createdAt: "2026-01-20T09:00:00.000Z",
      reason: "أُرجعت القطعة للتصليح",
    });
    expect(lastEffectiveDeliveryEvent(reversed)).toBeNull();
  });

  it("returns the re-delivery event after reversal then re-delivery", () => {
    const reversed = reverseDelivery(deliveredOrder("pred-4", "2026-01-05T09:00:00.000Z"), {
      idempotencyKey: "pred-4-reverse",
      createdAt: "2026-01-20T09:00:00.000Z",
      reason: "أُرجعت القطعة للتصليح",
    });
    const redelivered = redeliverAfterReversal(reversed, "pred-4");
    const effective = lastEffectiveDeliveryEvent(redelivered);
    expect(effective?.idempotencyKey).toBe("pred-4-delivered2");
    expect(effective?.createdAt).toBe("2026-02-03T09:00:00.000Z");
  });

  it("keeps null when the same reversal key is replayed (idempotent reversal, no duplicate effect)", () => {
    const delivered = deliveredOrder("pred-5", "2026-01-05T09:00:00.000Z");
    const reversed = reverseDelivery(delivered, {
      idempotencyKey: "pred-5-reverse",
      createdAt: "2026-01-20T09:00:00.000Z",
      reason: "أُرجعت القطعة للتصليح",
    });
    const replay = reverseDelivery(reversed, {
      idempotencyKey: "pred-5-reverse",
      createdAt: "2026-01-21T09:00:00.000Z",
      reason: "إعادة تشغيل نفس المفتاح",
    });
    expect(replay.events.filter(event => event.type === "delivery_reversed")).toHaveLength(1);
    expect(lastEffectiveDeliveryEvent(replay)).toBeNull();
  });

  it("still links the reversal to the re-delivery event when the redelivery is reversed again", () => {
    const reversed = reverseDelivery(deliveredOrder("pred-6", "2026-01-05T09:00:00.000Z"), {
      idempotencyKey: "pred-6-reverse",
      createdAt: "2026-01-20T09:00:00.000Z",
      reason: "أُرجعت القطعة للتصليح",
    });
    const redelivered = redeliverAfterReversal(reversed, "pred-6");
    const reversedAgain = reverseDelivery(redelivered, {
      idempotencyKey: "pred-6-reverse2",
      createdAt: "2026-02-10T09:00:00.000Z",
      reason: "عكس إعادة التسليم",
    });
    expect(lastEffectiveDeliveryEvent(reversedAgain)).toBeNull();
    expect(
      reversedAgain.events.filter(event => event.type === "status_changed" && event.toStatus === "delivered"),
    ).toHaveLength(2);
    expect(reversedAgain.events.filter(event => event.type === "delivery_reversed")).toHaveLength(2);
  });
});
