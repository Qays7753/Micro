import "fake-indexeddb/auto";
import { afterEach, describe, expect, it } from "vitest";
import { IndexedDbLocalStore } from "./IndexedDbLocalStore";
import { createCashContinuityEntry, createCashWallet } from "@micro-domain/cash-continuity/index.js";
import {
  createInventoryMovement,
  createInventoryShortage,
  type InventoryMovement,
} from "@micro-domain/inventory-material/index.js";
import type { StoredCraftOrder } from "./types";
import {
  calculateCostSnapshot,
  createCraftOrder,
  noteDeliveryConsumption,
  transitionOrder,
} from "@micro-domain/craft-order/index.js";
import { localDateInAmman } from "@/presentation/formatters";

/* المجموعة ٣ (عقد D4/D7 — SA-5 R2d): معاملتا التسليم وحدة على مستوى IndexedDB
 * نفسه — الكتابة الكاملة، وعدم التكرار عند إعادة المحاولة، وإكمال الحالة
 * النصفية بعد انقطاع بمفاتيح حتمية. */

const databaseName = "micro-prototype-local";
function clearDatabase() {
  return new Promise<void>((resolve, reject) => {
    const request = indexedDB.deleteDatabase(databaseName);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}
afterEach(clearDatabase);

function deliveredOrder(): StoredCraftOrder {
  const snapshot = calculateCostSnapshot("snap-1", {
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
    createdAt: "2026-09-04T08:00:00.000Z",
    source: "draft",
  });
  const order = createCraftOrder({
    id: "order-1",
    customerName: "سارة",
    itemName: "فستان",
    specifications: "تطريز",
    quantity: 1,
    agreedPriceMinor: 5000,
    costSnapshot: snapshot,
    createdAt: "2026-09-04T08:00:00.000Z",
  });
  const delivered = transitionOrder(
    transitionOrder(
      transitionOrder(
        transitionOrder(order, {
          to: "provisional_agreement",
          idempotencyKey: "k-agree",
          createdAt: "2026-09-04T08:01:00.000Z",
        }),
        { to: "confirmed", idempotencyKey: "k-confirm", createdAt: "2026-09-04T08:02:00.000Z" },
      ),
      { to: "in_progress", idempotencyKey: "k-start", createdAt: "2026-09-04T08:03:00.000Z" },
    ),
    { to: "ready", idempotencyKey: "k-ready", createdAt: "2026-09-04T08:04:00.000Z" },
  );
  const withDelivery = transitionOrder(delivered, {
    to: "delivered",
    idempotencyKey: "order-1:deliver",
    createdAt: "2026-09-04T09:00:00.000Z",
  });
  return {
    id: "order-1",
    order: noteDeliveryConsumption(withDelivery, {
      note: "مواد مستهلكة عند التسليم: قماش (2 متر)",
      reversesEventId: withDelivery.events.find(
        event => event.type === "status_changed" && event.toStatus === "delivered",
      )!.id,
      idempotencyKey: "order-1:deliver-consumed",
      createdAt: "2026-09-04T09:00:00.000Z",
    }),
    catalogItemId: null,
    deliveryDate: "2026-09-10",
    agreementSource: null,
    updatedAt: "2026-09-04T09:00:00.000Z",
  };
}

describe("IndexedDbLocalStore — Group 3 atomic delivery commits", () => {
  it("commitOrderDelivery writes order, movements, shortages, and cash entry together", async () => {
    const store = new IndexedDbLocalStore(() => "2026-09-04T09:00:00.000Z");
    /* المخزون قبل التسليم: الطلب جاهز — والنسخة الواردة للتسليم هي المسلّمة. */
    const delivered = deliveredOrder();
    const readyVersion: StoredCraftOrder = {
      ...delivered,
      order: {
        ...delivered.order,
        status: "ready",
        recognizedRevenueMinor: 0,
        recognizedCostMinor: 0,
        profitIndicatorMinor: null,
        events: delivered.order.events.filter(
          event =>
            !(event.type === "status_changed" && event.toStatus === "delivered") &&
            event.type !== "delivery_consumed",
        ),
      },
      updatedAt: "2026-09-04T08:59:00.000Z",
    };
    await store.saveOrder(readyVersion);
    const stored = delivered;
    const movement = createInventoryMovement({
      id: "mv-1",
      materialId: "mat-1",
      type: "consumption",
      occurredOn: localDateInAmman("2026-09-04T09:00:00.000Z"),
      recordedAt: "2026-09-04T09:00:00.000Z",
      quantityDeltaMilli: -2000,
      valueDeltaMinor: -1000,
      note: "استهلاك تسليم الطلب: فستان",
      operationKey: "order-1:deliver:order-1:order-1:deliver:mat-1",
      orderId: "order-1",
      costKnowledge: "known",
    });
    const shortage = createInventoryShortage({
      id: "sh-1",
      materialId: "mat-2",
      requestedQuantityMilli: 3000,
      availableQuantityMilli: 1000,
      shortageQuantityMilli: 2000,
      occurredOn: "2026-09-04",
      recordedAt: "2026-09-04T09:00:00.000Z",
      note: "نقص عند تسليم الطلب: فستان",
      orderId: "order-1",
      operationKey: "order-1:deliver:x:mat-2:shortage",
    });
    const wallet = createCashWallet({
      id: "wallet-1",
      name: "الدرج",
      kind: "cash_drawer",
      createdAt: "2026-09-01T00:00:00.000Z",
      createdOperationKey: "wallet-open",
    });
    const cashEntry = createCashContinuityEntry({
      id: "cash-1",
      walletId: "wallet-1",
      type: "allocation",
      occurredOn: "2026-09-04",
      recordedAt: "2026-09-04T09:00:00.000Z",
      cashDeltaMinor: 4000,
      note: "قبض عند تسليم الطلب: فستان",
      operationKey: "order-1:deliver-cash:x",
      sourceRefId: "order-1",
      sourceRefKind: "order",
      sourceRefLineId: "evt-delivery",
    });
    const committed = await store.commitOrderDelivery(stored, [movement], [shortage], wallet, cashEntry);
    expect(committed).toMatchObject({ ok: true, value: { reused: false } });
    const [orders, movements, shortages, entries] = await Promise.all([
      store.getOrder("order-1"),
      store.listInventoryMovements(),
      store.listInventoryShortages(),
      store.listCashContinuityEntries(),
    ]);
    if (!orders.ok || !movements.ok || !shortages.ok || !entries.ok) throw new Error("reads should succeed");
    expect(orders.value?.order.status).toBe("delivered");
    expect(movements.value).toHaveLength(1);
    expect(shortages.value).toHaveLength(1);
    expect(entries.value).toHaveLength(1);

    /* إعادة المحاولة بالطلب نفسه: لا كتابة مكررة — مفاتيح حتمية تُكتشف. */
    const retried = await store.commitOrderDelivery(stored, [movement], [shortage], wallet, cashEntry);
    expect(retried).toMatchObject({ ok: true, value: { reused: true } });
    const movementsAfter = await store.listInventoryMovements();
    const entriesAfter = await store.listCashContinuityEntries();
    if (!movementsAfter.ok || !entriesAfter.ok) throw new Error("re-reads should succeed");
    expect(movementsAfter.value).toHaveLength(1);
    expect(entriesAfter.value).toHaveLength(1);
  });

  it("commitOrderDeliveryReversal writes the reversed order and mirrored movements, refusing duplicates", async () => {
    const store = new IndexedDbLocalStore(() => "2026-09-04T10:00:00.000Z");
    const stored = deliveredOrder();
    await store.saveOrder(stored);
    const original: InventoryMovement = createInventoryMovement({
      id: "mv-2",
      materialId: "mat-1",
      type: "consumption",
      occurredOn: "2026-09-04",
      recordedAt: "2026-09-04T09:00:00.000Z",
      quantityDeltaMilli: -2000,
      valueDeltaMinor: -1000,
      note: "استهلاك تسليم الطلب: فستان",
      operationKey: "order-1:deliver:evt-1:mat-1",
      orderId: "order-1",
      costKnowledge: "known",
    });
    await store.commitInventory(null, [original]);
    const reversedStored: StoredCraftOrder = {
      ...stored,
      order: {
        ...stored.order,
        status: "needs_review",
        recognizedRevenueMinor: 0,
        recognizedCostMinor: 0,
        resultStatus: "review_required",
        events: [
          ...stored.order.events,
          {
            id: "order-1:rev-1",
            type: "delivery_reversed",
            idempotencyKey: "order-1:reverse-delivery",
            createdAt: "2026-09-04T10:00:00.000Z",
            note: "سُلّم للزبون الخطأ",
            reversesEventId: stored.order.events.find(
              event => event.type === "status_changed" && event.toStatus === "delivered",
            )!.id,
          },
        ],
      },
      updatedAt: "2026-09-04T10:00:00.000Z",
    };
    const mirror = createInventoryMovement({
      id: "mv-2-rev",
      materialId: "mat-1",
      type: "reversal",
      occurredOn: "2026-09-04",
      recordedAt: "2026-09-04T10:00:00.000Z",
      quantityDeltaMilli: 2000,
      valueDeltaMinor: 1000,
      note: "عكس تسليم: استهلاك تسليم الطلب: فستان",
      reason: "سُلّم للزبون الخطأ",
      operationKey: "order-1:deliver:evt-1:mat-1:reversal",
      reversesMovementId: "mv-2",
      costKnowledge: "known",
    });
    const committed = await store.commitOrderDeliveryReversal(reversedStored, [mirror]);
    expect(committed).toMatchObject({ ok: true, value: { reused: false } });
    const [order, movements] = await Promise.all([store.getOrder("order-1"), store.listInventoryMovements()]);
    if (!order.ok || !movements.ok) throw new Error("reads should succeed");
    expect(order.value?.order.status).toBe("needs_review");
    expect(movements.value).toHaveLength(2);
    /* إعادة المحاولة: العكس حاصل سلفًا — لا كتابة ثانية. */
    const retried = await store.commitOrderDeliveryReversal(reversedStored, [mirror]);
    expect(retried).toMatchObject({ ok: true, value: { reused: true } });
    const movementsAfter = await store.listInventoryMovements();
    if (!movementsAfter.ok) throw new Error("re-read should succeed");
    expect(movementsAfter.value).toHaveLength(2);
  });
});
