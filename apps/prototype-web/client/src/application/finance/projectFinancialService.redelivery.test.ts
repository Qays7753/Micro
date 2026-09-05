/** المجموعة ٦ (تدقيق A1 — FT-01): عزو الفترة بعد عكس التسليم وإعادة التسليم.
 * القارئ العام كان يلتقط أول حدث تسليم (المعكوس) فيعزو الإيراد المعاد
 * الاعتراف به إلى فترة التسليم القديمة — الإيراد يجب أن يتبع آخر تسليم ساري. */
import { describe, expect, it } from "vitest";
import { ProjectFinancialService } from "./projectFinancialService";
import { lastEffectiveDeliveryEvent } from "@/application/fulfillment/deliveryAttribution";
import { MemoryLocalStore } from "@/storage/local/MemoryLocalStore";
import {
  calculateCostSnapshot,
  createCraftOrder,
  reverseDelivery,
  transitionOrder,
} from "@micro-domain/craft-order/index.js";

const now = () => "2026-09-05T09:00:00.000Z";

function deliveredOrder(id: string, deliveredAt: string) {
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
  let order = createCraftOrder({
    id,
    customerName: "عميلة",
    itemName: "قطعة",
    specifications: "اختبار عزو إعادة التسليم",
    quantity: 1,
    agreedPriceMinor: 5000,
    costSnapshot: cost,
    createdAt: "2026-01-01T09:00:00.000Z",
  });
  for (const [to, stamp] of [
    ["provisional_agreement", "2026-01-02T10:00:00.000Z"],
    ["confirmed", "2026-01-02T11:00:00.000Z"],
    ["in_progress", "2026-01-03T09:00:00.000Z"],
    ["ready", "2026-01-04T09:00:00.000Z"],
    ["delivered", deliveredAt],
  ] as const)
    order = transitionOrder(order, { to, idempotencyKey: `${id}-${to}`, createdAt: stamp });
  return order;
}

describe("period attribution after delivery reversal and re-delivery (FT-01)", () => {
  it("lastEffectiveDeliveryEvent returns the unreversed delivery, then null after reversal alone", () => {
    const order = deliveredOrder("ft01-pure", "2026-01-05T09:00:00.000Z");
    const first = lastEffectiveDeliveryEvent(order);
    expect(first?.idempotencyKey).toBe("ft01-pure-delivered");
    const reversed = reverseDelivery(order, {
      idempotencyKey: "ft01-reverse",
      createdAt: "2026-01-20T09:00:00.000Z",
      reason: "أُرجعت القطعة للتصليح",
    });
    expect(lastEffectiveDeliveryEvent(reversed)).toBeNull();
    const redelivered = transitionOrder(
      transitionOrder(
        transitionOrder(
          transitionOrder(reversed, {
            to: "confirmed",
            idempotencyKey: "ft01-reconfirm",
            createdAt: "2026-02-01T09:00:00.000Z",
          }),
          { to: "in_progress", idempotencyKey: "ft01-resume", createdAt: "2026-02-01T10:00:00.000Z" },
        ),
        { to: "ready", idempotencyKey: "ft01-ready2", createdAt: "2026-02-02T09:00:00.000Z" },
      ),
      { to: "delivered", idempotencyKey: "ft01-delivered2", createdAt: "2026-02-03T09:00:00.000Z" },
    );
    const effective = lastEffectiveDeliveryEvent(redelivered);
    expect(effective?.idempotencyKey).toBe("ft01-delivered2");
    expect(effective?.createdAt).toBe("2026-02-03T09:00:00.000Z");
  });

  it("re-delivered revenue is attributed to the re-delivery period, not the reversed one", async () => {
    const store = new MemoryLocalStore();
    const finance = new ProjectFinancialService(store, now);
    const order = reverseDelivery(deliveredOrder("ft01-order", "2026-01-05T09:00:00.000Z"), {
      idempotencyKey: "ft01-order-reverse",
      createdAt: "2026-01-20T09:00:00.000Z",
      reason: "أُرجعت القطعة للتصليح",
    });
    const redelivered = transitionOrder(
      transitionOrder(
        transitionOrder(
          transitionOrder(order, {
            to: "confirmed",
            idempotencyKey: "ft01-order-reconfirm",
            createdAt: "2026-02-01T09:00:00.000Z",
          }),
          { to: "in_progress", idempotencyKey: "ft01-order-resume", createdAt: "2026-02-01T10:00:00.000Z" },
        ),
        { to: "ready", idempotencyKey: "ft01-order-ready2", createdAt: "2026-02-02T09:00:00.000Z" },
      ),
      { to: "delivered", idempotencyKey: "ft01-order-delivered2", createdAt: "2026-02-03T09:00:00.000Z" },
    );
    await store.saveOrder({
      id: redelivered.id,
      order: redelivered,
      catalogItemId: null,
      deliveryDate: "2026-02-03",
      agreementSource: "test",
      createdAt: redelivered.createdAt,
      updatedAt: "2026-02-03T09:00:00.000Z",
    });

    /* يناير: لا إيراد معترفًا — تسليمه الوحيد معكوس وإعادة التسليم في فبراير. */
    await expect(finance.readRecordedPeriodResult("2026-01-01", "2026-01-31")).resolves.toMatchObject({
      ok: true,
      value: {
        recognizedRevenueMinor: 0,
        finalOrderCount: 0,
      },
    });
    /* فبراير: الإيراد المعاد الاعتراف به في فترة إعادة التسليم الفعلية. */
    await expect(finance.readRecordedPeriodResult("2026-02-01", "2026-02-28")).resolves.toMatchObject({
      ok: true,
      value: {
        recognizedRevenueMinor: 5000,
        finalOrderCount: 1,
        excludedOrderCount: 0,
      },
    });
  });

  it("a delivered order that was never reversed keeps its original period attribution", async () => {
    const store = new MemoryLocalStore();
    const finance = new ProjectFinancialService(store, now);
    const order = deliveredOrder("ft01-plain", "2026-01-05T09:00:00.000Z");
    await store.saveOrder({
      id: order.id,
      order,
      catalogItemId: null,
      deliveryDate: "2026-01-05",
      agreementSource: "test",
      createdAt: order.createdAt,
      updatedAt: "2026-01-05T09:00:00.000Z",
    });
    await expect(finance.readRecordedPeriodResult("2026-01-01", "2026-01-31")).resolves.toMatchObject({
      ok: true,
      value: { recognizedRevenueMinor: 5000, finalOrderCount: 1 },
    });
    await expect(finance.readRecordedPeriodResult("2026-02-01", "2026-02-28")).resolves.toMatchObject({
      ok: true,
      value: { recognizedRevenueMinor: 0, finalOrderCount: 0 },
    });
  });
});
