/** المجموعة ٢ (التحصين الكامل — D-031/D-2): حدّ القفة على مستوى الخدمات —
 * التراجع عن القبضة عبر أي مدخل عام (خدمة التنفيذ أو خدمة التراجع المزدوج)
 * يُرفض على طلب مسلّم مقفل في «يحتاج مراجعة»، والمخزن بايتًا-ببايت كما هو،
 * ومسارات القراءة تعمل. */
import { describe, expect, it } from "vitest";
import { FulfillmentService } from "@/application/fulfillment/fulfillmentService";
import { CollectionReversalService } from "@/application/collections/collectionReversalService";
import { ProjectFinancialService } from "@/application/finance/projectFinancialService";
import { MemoryLocalStore } from "@/storage/local/MemoryLocalStore";
import { calculateCostSnapshot, createCraftOrder } from "@micro-domain/craft-order/index.js";
import type { StoredCraftOrder } from "@/storage/local/types";

const now = () => "2026-09-08T09:00:00.000Z";

function buildCostSnapshot() {
  return calculateCostSnapshot("cost-app-lock", {
    currency: "JOD",
    materialItems: [],
    time: { minutes: 60, hourlyRateMinor: 500, confidence: "known" },
    packagingMinor: 0,
    deliveryMinor: 0,
    wasteMinor: 0,
    safetyBufferMinor: 0,
    quantity: 1,
    createdAt: "2026-09-01T09:00:00Z",
    freshnessDays: null,
  });
}

async function lockedDeliveredOrder(store: MemoryLocalStore): Promise<StoredCraftOrder> {
  const cost = buildCostSnapshot();
  const order = createCraftOrder({
    id: "order-app-lock",
    customerName: "ليلى",
    itemName: "رف خشبي",
    specifications: "مقاس متوسط",
    quantity: 1,
    agreedPriceMinor: 8000,
    costSnapshot: cost,
    createdAt: "2026-09-01T09:05:00Z",
  });
  let current: StoredCraftOrder = {
    id: "order-app-lock",
    order,
    catalogItemId: null,
    deliveryDate: "2026-09-05",
    agreementSource: null,
    createdAt: "2026-09-01T09:05:00Z",
    updatedAt: "2026-09-01T09:05:00Z",
  };
  const transitions = ["provisional_agreement", "confirmed", "in_progress", "ready", "delivered"] as const;
  for (const [index, to] of transitions.entries()) {
    const events = current.order.events;
    current = {
      ...current,
      order: {
        ...current.order,
        status: to,
        events: [
          ...events,
          {
            id: `order-app-lock:status:app-${index}`,
            type: "status_changed" as const,
            idempotencyKey: `status:app-${index}`,
            createdAt: `2026-09-0${index + 1}T10:00:00Z`,
            fromStatus: transitions[index - 1] ?? "draft",
            toStatus: to,
          },
        ],
      },
      updatedAt: `2026-09-0${index + 1}T10:00:00Z`,
    };
  }
  /* قبضة جزئية على الطلب المسلّم ثم القفل بالمراجعة. */
  const collectionEventId = "order-app-lock:collect-partial";
  current = {
    ...current,
    order: {
      ...current.order,
      collectedMinor: 3000,
      receivableMinor: 5000,
      settlementStatus: "partially_paid",
      events: [
        ...current.order.events,
        {
          id: collectionEventId,
          type: "collection_recorded" as const,
          idempotencyKey: "collect-partial",
          createdAt: "2026-09-06T10:00:00Z",
          amountMinor: 3000,
        },
      ],
    },
    updatedAt: "2026-09-06T10:00:00Z",
  };
  current = {
    ...current,
    order: {
      ...current.order,
      status: "needs_review",
      nextAction: "راجع التعارض أو النقص",
      events: [
        ...current.order.events,
        {
          id: "order-app-lock:status:app-review",
          type: "status_changed" as const,
          idempotencyKey: "status:app-review",
          createdAt: "2026-09-07T10:00:00Z",
          fromStatus: "delivered",
          toStatus: "needs_review",
        },
      ],
    },
    updatedAt: "2026-09-07T10:00:00Z",
  };
  await store.saveOrder(current);
  return current;
}

async function orderSnapshot(store: MemoryLocalStore): Promise<unknown> {
  const result = await store.getOrder("order-app-lock");
  if (!result.ok) throw new Error(result.message);
  return structuredClone(result.value);
}

describe("application-level review lock boundary (D-031)", () => {
  it("fulfillmentService.reverseCollection refuses a locked order and writes nothing", async () => {
    const store = new MemoryLocalStore();
    await lockedDeliveredOrder(store);
    const fulfillment = new FulfillmentService(store, now);
    const before = await orderSnapshot(store);
    const result = await fulfillment.reverseCollection("order-app-lock", {
      collectionEventId: "order-app-lock:collect-partial",
      amountMinor: 1000,
      reason: "محاولة تراجع على مقفل",
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.message).toContain("تصحيح موثق صريح");
    const after = await orderSnapshot(store);
    expect(after).toEqual(before);
  });

  it("collectionReversalService.reverse refuses a locked order and writes nothing", async () => {
    const store = new MemoryLocalStore();
    await lockedDeliveredOrder(store);
    const projectFinance = new ProjectFinancialService(store, now);
    const reversal = new CollectionReversalService(store, projectFinance, now);
    const before = await orderSnapshot(store);
    const result = await reversal.reverse({
      orderId: "order-app-lock",
      collectionEventId: "order-app-lock:collect-partial",
      amountMinor: 3000,
      reason: "محاولة تراجع مزدوج على مقفل",
      operationKey: "locked-op",
      alsoReverseAllocation: false,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("validation_error");
    const after = await orderSnapshot(store);
    expect(after).toEqual(before);
  });

  it("read-only review access keeps working while locked", async () => {
    const store = new MemoryLocalStore();
    const locked = await lockedDeliveredOrder(store);
    const fulfillment = new FulfillmentService(store, now);
    /* القراءة (عرض المراجعة والتدقيق) متاحة — القفل على الطفر المالي لا على
     * المعاينة؛ المخزن نفسه هو مصدر العرض. */
    const stored = await store.getOrder("order-app-lock");
    if (!stored.ok || !stored.value) throw new Error(stored.message);
    expect(stored.value.order.status).toBe(locked.order.status);
    expect(stored.value.order.events.some(event => event.type === "collection_recorded")).toBe(true);
    const mutation = await fulfillment.reverseCollection("order-app-lock", {
      collectionEventId: "order-app-lock:collect-partial",
      amountMinor: 1000,
      reason: "قراءة التحقق فقط",
    });
    expect(mutation.ok).toBe(false);
    const unchanged = await store.getOrder("order-app-lock");
    if (!unchanged.ok || !unchanged.value) throw new Error(unchanged.message);
    expect(unchanged.value.order.collectedMinor).toBe(3000);
  });
});
