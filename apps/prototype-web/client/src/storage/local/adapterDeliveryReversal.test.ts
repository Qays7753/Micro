import "fake-indexeddb/auto";
import { afterEach, describe, expect, it, vi } from "vitest";
import { IndexedDbLocalStore } from "./IndexedDbLocalStore";
import { MemoryLocalStore } from "./MemoryLocalStore";
import type { PrototypeLocalStore, StoredCraftOrder } from "./types";
import {
  calculateCostSnapshot,
  collectRemaining,
  createCraftOrder,
  reverseDelivery,
  transitionOrder,
} from "@micro-domain/craft-order/index.js";
import { createInventoryMovement, type InventoryMovement } from "@micro-domain/inventory-material/index.js";

/* رقعة إغلاق المجموعة ٣ (D-031): مطابقة المحوّلين (الذاكرة وIndexedDB/
 * fake-indexeddb) على عقد التزام عكس التسليم المحصّن — التعارض بلا كتابة،
 * إعادة الاستخدام بلا كتابة، ولا علاقة/حركة ثانية للتسليم نفسه أبدًا.
 * البرهان بإعادة القراءة من المخزن بعد كل محاولة (لا الاكتفاء بالقيمة
 * المرجعة). حتمي بالكامل: تواريخ ثابتة وسباقات تُحقن عند حد الالتزام. */

const databaseName = "micro-prototype-local";
function clearDatabase() {
  return new Promise<void>((resolve, reject) => {
    const request = indexedDB.deleteDatabase(databaseName);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}
afterEach(clearDatabase);

const CREATED_AT = "2026-09-04T08:00:00.000Z";
const REVERSAL_AT = "2026-09-04T10:00:00.000Z";

function deliveredStored(id: string): StoredCraftOrder {
  const snapshot = calculateCostSnapshot(`snap-${id}`, {
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
    createdAt: CREATED_AT,
    source: "draft",
  });
  let order = createCraftOrder({
    id,
    customerName: "سارة",
    itemName: "فستان",
    specifications: "تطريز",
    quantity: 1,
    agreedPriceMinor: 5000,
    costSnapshot: snapshot,
    createdAt: CREATED_AT,
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
    order = transitionOrder(order, { to, idempotencyKey: key, createdAt: "2026-09-04T08:30:00.000Z" });
  }
  return {
    id,
    order,
    catalogItemId: null,
    deliveryDate: "2026-09-10",
    agreementSource: null,
    createdAt: CREATED_AT,
    updatedAt: "2026-09-04T09:00:00.000Z",
  };
}

function lockedStored(id: string): StoredCraftOrder {
  const delivered = deliveredStored(id);
  const locked = transitionOrder(delivered.order, {
    to: "needs_review",
    idempotencyKey: `${id}:review-lock`,
    createdAt: "2026-09-04T09:30:00.000Z",
    note: "تعارض يستوجب المراجعة",
  });
  return { ...delivered, order: locked, updatedAt: "2026-09-04T09:30:00.000Z" };
}

function lastDeliveryEventId(stored: StoredCraftOrder): string {
  return [...stored.order.events]
    .reverse()
    .find(event => event.type === "status_changed" && event.toStatus === "delivered")!.id;
}

function consumption(stored: StoredCraftOrder): InventoryMovement {
  return createInventoryMovement({
    id: `mv-${stored.id}`,
    materialId: "mat-1",
    type: "consumption",
    occurredOn: "2026-09-04",
    recordedAt: "2026-09-04T09:00:00.000Z",
    quantityDeltaMilli: -2000,
    valueDeltaMinor: -1000,
    note: "استهلاك تسليم الطلب: فستان",
    operationKey: `${stored.id}:deliver:${lastDeliveryEventId(stored)}:mat-1`,
    orderId: stored.id,
    costKnowledge: "known",
  });
}

function mirror(target: InventoryMovement): InventoryMovement {
  return createInventoryMovement({
    id: `delivery-reversal-${target.id}`,
    materialId: target.materialId,
    type: "reversal",
    occurredOn: "2026-09-04",
    recordedAt: REVERSAL_AT,
    quantityDeltaMilli: -target.quantityDeltaMilli,
    valueDeltaMinor: -target.valueDeltaMinor,
    note: `تراجع موثق عن التسليم: ${target.note}`,
    reason: "سُلّم للزبون الخطأ",
    operationKey: `${target.operationKey}:reversal`,
    reversesMovementId: target.id,
    costKnowledge: "known",
  });
}

function reversalPayload(base: StoredCraftOrder, key: string): StoredCraftOrder {
  const order = reverseDelivery(base.order, {
    reason: "سُلّم للزبون الخطأ",
    idempotencyKey: key,
    createdAt: REVERSAL_AT,
  });
  return { ...base, order, updatedAt: REVERSAL_AT };
}

async function seed(
  store: PrototypeLocalStore,
  stored: StoredCraftOrder,
  movements: readonly InventoryMovement[] = [],
): Promise<void> {
  const saved = await store.saveOrder(stored);
  if (!saved.ok) throw new Error(saved.message);
  const committed = await store.commitInventory(null, movements);
  if (!committed.ok) throw new Error(committed.message);
}

async function readOrder(store: PrototypeLocalStore, id: string): Promise<StoredCraftOrder> {
  const read = await store.getOrder(id);
  if (!read.ok || !read.value) throw new Error("order should read");
  return read.value;
}

async function readMovements(store: PrototypeLocalStore): Promise<readonly InventoryMovement[]> {
  const read = await store.listInventoryMovements();
  if (!read.ok) throw new Error("movements should list");
  return read.value;
}

async function runConformanceScenarios(store: PrototypeLocalStore): Promise<void> {
  /* ١. تعارض تحصيل متزامن: العكس يُرفض بـ storage_stale ولا يُكتب شيء —
   * التحصيل الحي باقٍ (برهان إعادة القراءة لا القيمة المرجعة). */
  {
    const id = "conf-reversal-1";
    const base = deliveredStored(id);
    await seed(store, base, [consumption(base)]);
    const stalePayload = reversalPayload(base, `${id}:reverse`);
    const concurrentlyCollected = collectRemaining(
      base.order,
      2000,
      `${id}:concurrent`,
      "2026-09-04T09:30:00.000Z",
    );
    const concurrentSave = await store.saveOrder({
      ...base,
      order: concurrentlyCollected,
      updatedAt: "2026-09-04T09:30:00.000Z",
    });
    if (!concurrentSave.ok) throw new Error(concurrentSave.message);
    const committed = await store.commitOrderDeliveryReversal(stalePayload, [mirror(consumption(base))]);
    expect(committed.ok).toBe(false);
    if (!committed.ok) {
      expect(committed.code).toBe("storage_stale");
      expect(committed.code).not.toBe("storage_error");
      expect(committed.message.trim().length).toBeGreaterThan(0);
    }
    const after = await readOrder(store, id);
    expect(after.order.events.some(event => event.type === "delivery_reversed")).toBe(false);
    expect(after.order.events.some(event => event.type === "collection_recorded")).toBe(true);
    expect(after.order.collectedMinor).toBe(2000);
    expect(after.order.status).toBe("delivered");
    const movementsAfter = await readMovements(store);
    expect(movementsAfter.filter(movement => movement.type === "reversal")).toHaveLength(0);
  }

  /* ٢. تعارض تعديل غلاف متزامن (متابعة) — المسار الذي لا يغير الأحداث. */
  {
    const id = "conf-reversal-2";
    const base = deliveredStored(id);
    await seed(store, base, [consumption(base)]);
    const stalePayload = reversalPayload(base, `${id}:reverse`);
    const concurrentSave = await store.saveOrder({
      ...base,
      followUpDate: "2026-09-20",
      followUpSummary: "متابعة",
    });
    if (!concurrentSave.ok) throw new Error(concurrentSave.message);
    const committed = await store.commitOrderDeliveryReversal(stalePayload, [mirror(consumption(base))]);
    expect(committed.ok).toBe(false);
    if (!committed.ok) expect(committed.code).toBe("storage_stale");
    const after = await readOrder(store, id);
    expect(after.followUpDate).toBe("2026-09-20");
    expect(after.order.events.some(event => event.type === "delivery_reversed")).toBe(false);
    const movementsAfter = await readMovements(store);
    expect(movementsAfter.filter(movement => movement.type === "reversal")).toHaveLength(0);
  }

  /* ٣. مفتاحان مختلفان لتسليم واحد: علاقة واحدة، حركة مرآة واحدة، إعادة
   * استخدام صادقة للسجل المخزّن — لا إعادة كتابة تاريخ. */
  {
    const id = "conf-reversal-3";
    const base = deliveredStored(id);
    const target = consumption(base);
    await seed(store, base, [target]);
    const first = await store.commitOrderDeliveryReversal(reversalPayload(base, `${id}:key-1`), [
      mirror(target),
    ]);
    expect(first.ok).toBe(true);
    const second = await store.commitOrderDeliveryReversal(reversalPayload(base, `${id}:key-2`), [
      mirror(target),
    ]);
    expect(second.ok).toBe(true);
    if (second.ok) expect(second.value.reused).toBe(true);
    const after = await readOrder(store, id);
    const relations = after.order.events.filter(event => event.type === "delivery_reversed");
    expect(relations).toHaveLength(1);
    expect(relations[0]!.idempotencyKey).toBe(`${id}:key-1`);
    const movementsAfter = await readMovements(store);
    const orderMirrors = movementsAfter.filter(
      movement => movement.type === "reversal" && movement.operationKey.startsWith(`${id}:deliver:`),
    );
    expect(orderMirrors).toHaveLength(1);
    if (second.ok) {
      /* النتيجة المرجعة هي السجل المخزّن نفسه (عكس key-1) لا الواردة. */
      expect(second.value.order.order.events.at(-1)!.idempotencyKey).toBe(`${id}:key-1`);
      expect(second.value.reversalMovements.map(movement => movement.operationKey)).toEqual([
        `${target.operationKey}:reversal`,
      ]);
    }
  }

  /* ٤. إعادة التشغيل بالمفتاح نفسه: إعادة استخدام بلا حدث/حركة إضافية وبلا
   * مساس بالكاش أو المحافظ أو اللقطات. */
  {
    const id = "conf-reversal-4";
    const base = deliveredStored(id);
    const target = consumption(base);
    await seed(store, base, [target]);
    const payload = reversalPayload(base, `${id}:reverse`);
    const first = await store.commitOrderDeliveryReversal(payload, [mirror(target)]);
    expect(first.ok).toBe(true);
    const beforeOrder = await readOrder(store, id);
    const beforeMovements = await readMovements(store);
    const beforeCash = await store.listCashContinuityEntries();
    const beforeWallets = await store.listCashWallets();
    const replay = await store.commitOrderDeliveryReversal(payload, [mirror(target)]);
    expect(replay.ok).toBe(true);
    if (replay.ok) expect(replay.value.reused).toBe(true);
    const afterOrder = await readOrder(store, id);
    const afterMovements = await readMovements(store);
    expect(afterOrder).toEqual(beforeOrder);
    expect(afterMovements).toEqual(beforeMovements);
    expect(await store.listCashContinuityEntries()).toEqual(beforeCash);
    expect(await store.listCashWallets()).toEqual(beforeWallets);
  }

  /* ٥. الحمولة نفسها بمفتاح آخر بعد انحراف المخزن (استئناف موثق): قدم بلا كتابة. */
  {
    const id = "conf-reversal-5";
    const base = deliveredStored(id);
    const target = consumption(base);
    await seed(store, base, [target]);
    const committedPayload = reversalPayload(base, `${id}:key-1`);
    const first = await store.commitOrderDeliveryReversal(committedPayload, [mirror(target)]);
    expect(first.ok).toBe(true);
    const resumed = transitionOrder(committedPayload.order, {
      to: "confirmed",
      idempotencyKey: `${id}:resume`,
      createdAt: "2026-09-04T11:00:00.000Z",
    });
    const resumeSave = await store.saveOrder({
      ...committedPayload,
      order: resumed,
      updatedAt: "2026-09-04T11:00:00.000Z",
    });
    if (!resumeSave.ok) throw new Error(resumeSave.message);
    const racing = await store.commitOrderDeliveryReversal(reversalPayload(base, `${id}:key-2`), [
      mirror(target),
    ]);
    expect(racing.ok).toBe(false);
    if (!racing.ok) expect(racing.code).toBe("storage_stale");
    const after = await readOrder(store, id);
    const relations = after.order.events.filter(event => event.type === "delivery_reversed");
    expect(relations).toHaveLength(1);
    expect(after.order.status).toBe("confirmed");
    const movementsAfter = await readMovements(store);
    const orderMirrors = movementsAfter.filter(
      movement => movement.type === "reversal" && movement.operationKey.startsWith(`${id}:deliver:`),
    );
    expect(orderMirrors).toHaveLength(1);
  }

  /* ٦. الحالة المقفلة (ذيل حدث واحد): العكس الأول يلتزم كما في D-031. */
  {
    const id = "conf-reversal-6";
    const base = lockedStored(id);
    const target = consumption(base);
    await seed(store, base, [target]);
    const committed = await store.commitOrderDeliveryReversal(reversalPayload(base, `${id}:reverse`), [
      mirror(target),
    ]);
    expect(committed.ok).toBe(true);
    if (committed.ok) expect(committed.value.reused).toBe(false);
    const after = await readOrder(store, id);
    expect(after.order.status).toBe("needs_review");
    expect(after.order.events.filter(event => event.type === "delivery_reversed")).toHaveLength(1);
    const movementsAfter = await readMovements(store);
    const orderMirrors = movementsAfter.filter(
      movement => movement.type === "reversal" && movement.operationKey.startsWith(`${id}:deliver:`),
    );
    expect(orderMirrors).toHaveLength(1);
  }

  /* ٧. سجل غائب: storage_error مطبوع (وليس تعارضًا). */
  {
    const ghost = deliveredStored("conf-reversal-ghost");
    const committed = await store.commitOrderDeliveryReversal(reversalPayload(ghost, "ghost:reverse"), []);
    expect(committed.ok).toBe(false);
    if (!committed.ok) expect(committed.code).toBe("storage_error");
  }
}

describe("adapter conformance — guarded delivery reversal commit (D-031 closure)", () => {
  it("MemoryLocalStore satisfies the guarded delivery reversal contract", async () => {
    await runConformanceScenarios(new MemoryLocalStore());
  });

  it("IndexedDbLocalStore (fake-indexeddb) satisfies the same guarded delivery reversal contract", async () => {
    try {
      await clearDatabase();
      await runConformanceScenarios(new IndexedDbLocalStore());
    } finally {
      await clearDatabase();
    }
  });

  it("IndexedDB atomicity: aborting mid-transaction rolls back the order and movements together", async () => {
    const store = new IndexedDbLocalStore();
    try {
      const id = "conf-reversal-atomic";
      const base = deliveredStored(id);
      const target = consumption(base);
      await seed(store, base, [target]);
      const orderBefore = await readOrder(store, id);
      const movementsBefore = await readMovements(store);
      /* إجهاد المعاملة عند أول حركة مرآة — بعد كتابة الطلب: الإجهاض يجب أن
       * يلغي كتابة الطلب أيضًا (الذرّية) والنتيجة فشل لا نجاح كاذب. */
      const putSpy = vi.spyOn(IDBObjectStore.prototype, "put");
      putSpy.mockImplementation(function (this: IDBObjectStore, value: unknown) {
        if (this.name === "inventory-movements") {
          this.transaction?.abort();
        }
        return IDBObjectStore.prototype.put.call(this, value as never) as IDBRequest;
      });
      const committed = await store.commitOrderDeliveryReversal(reversalPayload(base, `${id}:reverse`), [
        mirror(target),
      ]);
      putSpy.mockRestore();
      expect(committed.ok).toBe(false);
      const orderAfter = await readOrder(store, id);
      const movementsAfter = await readMovements(store);
      expect(orderAfter).toEqual(orderBefore);
      expect(movementsAfter).toEqual(movementsBefore);
    } finally {
      await clearDatabase();
    }
  });
});
