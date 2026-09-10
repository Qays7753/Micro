/** رقعة إغلاق المجموعة ٣ (D-031): عقد كود النتيجة المطبوع لخدمة عكس التسليم —
 * التعارض المتزامن يظهر كـ storage_stale مميزًا عن الفشل التخزيني الحقيقي
 * بلا تفسير نصوص، والرسالة من المخزّن حرفيًا، ولا كتابة عند الرفض. السباق
 * محقون عند حد الالتزام نفسه (كتابة متزامنة حقيقية بين قراءة الخدمة
 * والتزامها) — حتمي بلا نوم ولا عشوائية. */
import { describe, expect, it } from "vitest";
import { DeliveryReviewService } from "@/application/fulfillment/deliveryReviewService";
import { MemoryLocalStore } from "@/storage/local/MemoryLocalStore";
import type { StoredCraftOrder } from "@/storage/local/types";
import {
  calculateCostSnapshot,
  collectRemaining,
  createCraftOrder,
  transitionOrder,
} from "@micro-domain/craft-order/index.js";
import { createInventoryMovement, type InventoryMovement } from "@micro-domain/inventory-material/index.js";

const NOW = "2026-09-11T09:00:00.000Z";

function deliveredStored(): StoredCraftOrder {
  const snapshot = calculateCostSnapshot("d031-stale-snap", {
    currency: "JOD",
    materialItems: [
      {
        name: "قماش",
        quantity: 2,
        unit: "متر",
        unitPriceMinor: 500,
        priceDate: "2026-09-01",
        source: "user_input",
        confidence: "known",
        materialId: "mat-1",
      },
    ],
    time: null,
    packagingMinor: 0,
    deliveryMinor: 0,
    wasteMinor: 0,
    safetyBufferMinor: 0,
    quantity: 1,
    createdAt: "2026-09-01T08:00:00.000Z",
    source: "draft",
  });
  let order = createCraftOrder({
    id: "d031-stale-order",
    customerName: "سلمى",
    itemName: "فستان خياطة",
    specifications: "مقاس 38",
    quantity: 1,
    agreedPriceMinor: 7000,
    costSnapshot: snapshot,
    createdAt: "2026-09-01T08:05:00.000Z",
  });
  const chain: ReadonlyArray<
    ["provisional_agreement" | "confirmed" | "in_progress" | "ready" | "delivered", string]
  > = [
    ["provisional_agreement", "s-agree"],
    ["confirmed", "s-confirm"],
    ["in_progress", "s-start"],
    ["ready", "s-ready"],
    ["delivered", "s-deliver"],
  ];
  for (const [to, key] of chain) {
    order = transitionOrder(order, { to, idempotencyKey: key, createdAt: "2026-09-02T09:00:00.000Z" });
  }
  return {
    id: "d031-stale-order",
    order,
    catalogItemId: null,
    deliveryDate: "2026-09-10",
    agreementSource: null,
    createdAt: "2026-09-01T08:05:00.000Z",
    updatedAt: "2026-09-02T09:00:00.000Z",
  };
}

function consumption(): InventoryMovement {
  const stored = deliveredStored();
  const deliveryEventId = [...stored.order.events]
    .reverse()
    .find(event => event.type === "status_changed" && event.toStatus === "delivered")!.id;
  return createInventoryMovement({
    id: "d031-stale-mv-1",
    materialId: "mat-1",
    type: "consumption",
    occurredOn: "2026-09-02",
    recordedAt: "2026-09-02T09:00:00.000Z",
    quantityDeltaMilli: -2000,
    valueDeltaMinor: -1000,
    note: "استهلاك تسليم الطلب: فستان خياطة",
    operationKey: `d031-stale-order:deliver:${deliveryEventId}:mat-1`,
    orderId: "d031-stale-order",
    costKnowledge: "known",
  });
}

/** مخزن سباق: كتابة متزامنة حقيقية عبر saveOrder داخل حد الالتزام نفسه —
 * بين قراءة الخدمة وتزامتها — لا محاكاة توقيت. */
class RacingReversalStore extends MemoryLocalStore {
  armed = false;
  async commitOrderDeliveryReversal(
    order: StoredCraftOrder,
    reversalMovements: readonly InventoryMovement[],
  ): Promise<ReturnType<MemoryLocalStore["commitOrderDeliveryReversal"]>> {
    if (this.armed) {
      this.armed = false;
      const concurrent = collectRemaining(
        order.order.events.filter(event => event.type !== "delivery_reversed").length > 0
          ? deliveredStored().order
          : order.order,
        2000,
        "d031-stale:concurrent",
        "2026-09-11T08:59:00.000Z",
      );
      await this.saveOrder({
        id: order.id,
        order: concurrent,
        catalogItemId: null,
        deliveryDate: "2026-09-10",
        agreementSource: null,
        createdAt: "2026-09-01T08:05:00.000Z",
        updatedAt: "2026-09-11T08:59:00.000Z",
      });
    }
    return super.commitOrderDeliveryReversal(order, reversalMovements);
  }
}

/** مخزن فشل حقيقي: رفض تخزيني عام (لا تعارض) — يجب أن يظهر storage_error. */
class GenuineFailureStore extends MemoryLocalStore {
  override async commitOrderDeliveryReversal(
    order: StoredCraftOrder,
    reversalMovements: readonly InventoryMovement[],
  ): Promise<ReturnType<MemoryLocalStore["commitOrderDeliveryReversal"]>> {
    void order;
    void reversalMovements;
    return { ok: false, code: "storage_error", message: "فشل تخزيني حقيقي مُحقن." };
  }
}

describe("deliveryReviewService.reverseDelivery — typed stale-conflict contract (D-031 closure)", () => {
  it("a concurrent order update between the service read and its commit returns typed storage_stale and writes nothing", async () => {
    const store = new RacingReversalStore();
    const stored = deliveredStored();
    const saved = await store.saveOrder(stored);
    if (!saved.ok) throw new Error(saved.message);
    const target = consumption();
    const seeded = await store.commitInventory(null, [target]);
    if (!seeded.ok) throw new Error(seeded.message);
    const service = new DeliveryReviewService(store, () => NOW);
    store.armed = true;
    const result = await service.reverseDelivery(stored.id, { reason: "سُلّم للزبون الخطأ" });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("storage_stale");
      expect(result.code).not.toBe("storage_error");
      expect(result.message.trim().length).toBeGreaterThan(0);
    }
    const after = await store.getOrder(stored.id);
    if (!after.ok || !after.value) throw new Error("order should read");
    /* لا كتابة عند الرفض: التحصيل المتزامن باقٍ ولا عكس ولا حركة مرآة. */
    expect(after.value.order.events.some(event => event.type === "delivery_reversed")).toBe(false);
    expect(after.value.order.events.some(event => event.type === "collection_recorded")).toBe(true);
    expect(after.value.order.collectedMinor).toBe(2000);
    const movements = await store.listInventoryMovements();
    if (!movements.ok) throw new Error("movements should list");
    expect(movements.value.filter(movement => movement.type === "reversal")).toHaveLength(0);
  });

  it("a genuine storage failure stays storage_error with the adapter message verbatim", async () => {
    const store = new GenuineFailureStore();
    const stored = deliveredStored();
    const saved = await store.saveOrder(stored);
    if (!saved.ok) throw new Error(saved.message);
    const service = new DeliveryReviewService(store, () => NOW);
    const result = await service.reverseDelivery(stored.id, { reason: "سبب موثق" });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("storage_error");
      expect(result.code).not.toBe("storage_stale");
      expect(result.message).toBe("فشل تخزيني حقيقي مُحقن.");
    }
  });
});
