/** التحصين الكامل (D-031، المجموعة ٣): عقد خدمة مراجعة التسليم للحالة
 * المقفلة — السجل المسلّم داخل «يحتاج مراجعة» بلا تراجع موثق. التراجع
 * الموثق عن التسليم يعمل من القفل نفسه (المخرج الكنسي الوحيد): علاقة صريحة
 * بالحدث المصحَّح، حتمية بمفتاح العملية، حياد الإيراد إلى غياب المعرفة،
 * ولا مساس بالكاش المقبوض. الكود المطبوع invalid_state للرفض لا نصوص. */
import { describe, expect, it } from "vitest";
import { DeliveryReviewService } from "@/application/fulfillment/deliveryReviewService";
import { MemoryLocalStore } from "@/storage/local/MemoryLocalStore";
import {
  calculateCostSnapshot,
  collectRemaining,
  createCraftOrder,
  transitionOrder,
} from "@micro-domain/craft-order/index.js";
import type { StoredCraftOrder } from "@/storage/local/types";

const NOW = "2026-09-11T09:00:00.000Z";

async function lockedOrderStored(store: MemoryLocalStore): Promise<string> {
  const cost = calculateCostSnapshot("d031-service-cost", {
    currency: "JOD",
    materialItems: [
      {
        name: "قماش",
        quantity: 2,
        unit: "متر",
        unitPriceMinor: 400,
        priceDate: "2026-09-01",
        source: "user_input",
        confidence: "known",
      },
    ],
    time: { minutes: 90, hourlyRateMinor: 600, confidence: "known" },
    packagingMinor: 100,
    deliveryMinor: 100,
    wasteMinor: 50,
    safetyBufferMinor: 200,
    quantity: 1,
    createdAt: "2026-09-01T09:00:00Z",
    source: "price_approval",
  });
  let order = createCraftOrder({
    id: "d031-service-order",
    customerName: "سلمى",
    itemName: "فستان خياطة",
    specifications: "مقاس 38",
    quantity: 1,
    agreedPriceMinor: 7000,
    costSnapshot: cost,
    createdAt: "2026-09-01T09:05:00Z",
  });
  const chain: ReadonlyArray<
    ["provisional_agreement" | "confirmed" | "in_progress" | "ready" | "delivered", string]
  > = [
    ["provisional_agreement", "s-provisional"],
    ["confirmed", "s-confirmed"],
    ["in_progress", "s-progress"],
    ["ready", "s-ready"],
    ["delivered", "s-delivered"],
  ];
  for (const [to, key] of chain) {
    order = transitionOrder(order, {
      to,
      idempotencyKey: key,
      createdAt: `2026-09-02T09:1${chain.findIndex(item => item[1] === key)}:00Z`,
    });
  }
  order = collectRemaining(order, 2500, "s-collect", "2026-09-03T10:00:00Z");
  order = transitionOrder(order, {
    to: "needs_review",
    idempotencyKey: "s-review",
    createdAt: "2026-09-03T11:00:00Z",
  });
  const stored: StoredCraftOrder = {
    id: "d031-service-order",
    order,
    deliveryDate: "2026-09-03",
    catalogItemId: null,
    agreementSource: null,
    createdAt: "2026-09-01T09:05:00Z",
    updatedAt: "2026-09-03T11:00:00Z",
  };
  const saved = await store.saveOrder(stored);
  if (!saved.ok) throw new Error(saved.message);
  return stored.id;
}

describe("deliveryReviewService — D-031 documented correction from the locked review state", () => {
  it("reverses the delivery of a locked delivered record: typed success, linked event, cash untouched", async () => {
    const store = new MemoryLocalStore();
    const orderId = await lockedOrderStored(store);
    const service = new DeliveryReviewService(store, () => NOW);

    const result = await service.reverseDelivery(orderId, {
      reason: "سُلّم قبل إتمام التعديل المتفق عليه",
    });
    if (!result.ok) throw new Error(result.message);
    expect(result.value.reused).toBe(false);

    const stored = await store.getOrder(orderId);
    if (!stored.ok || !stored.value) throw new Error("order should read");
    const order = stored.value.order;
    expect(order.status).toBe("needs_review");
    expect(order.events.filter(e => e.type === "delivery_reversed")).toHaveLength(1);
    expect(order.recognizedRevenueMinor).toBe(0);
    expect(order.collectedMinor).toBe(2500);
  });

  it("replaying the same operation key is idempotent — reused, no second event", async () => {
    const store = new MemoryLocalStore();
    const orderId = await lockedOrderStored(store);
    const service = new DeliveryReviewService(store, () => NOW);
    const first = await service.reverseDelivery(orderId, {
      reason: "خطأ تسليم",
      operationKey: "d031-replay-key",
    });
    if (!first.ok) throw new Error(first.message);
    const replay = await service.reverseDelivery(orderId, {
      reason: "إعادة محاولة بعد انقطاع",
      operationKey: "d031-replay-key",
    });
    expect(replay.ok).toBe(true);
    if (replay.ok) expect(replay.value.reused).toBe(true);
    const stored = await store.getOrder(orderId);
    if (!stored.ok || !stored.value) throw new Error("order should read");
    expect(stored.value.order.events.filter(e => e.type === "delivery_reversed")).toHaveLength(1);
  });

  it("refuses without a reason with the typed invalid_state code and writes nothing", async () => {
    const store = new MemoryLocalStore();
    const orderId = await lockedOrderStored(store);
    const service = new DeliveryReviewService(store, () => NOW);
    const result = await service.reverseDelivery(orderId, { reason: "   " });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("invalid_state");
      expect(result.message).toContain("سبب");
    }
    const stored = await store.getOrder(orderId);
    if (!stored.ok || !stored.value) throw new Error("order should read");
    expect(stored.value.order.events.filter(e => e.type === "delivery_reversed")).toHaveLength(0);
    expect(stored.value.order.status).toBe("needs_review");
  });
});
