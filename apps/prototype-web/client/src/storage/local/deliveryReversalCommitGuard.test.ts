import { describe, expect, it } from "vitest";
import {
  committedReversalMovements,
  storedReversalMovementsFor,
  validateDeliveryReversalCommit,
  validateDeliveryReversalMovements,
} from "./deliveryReversalCommitGuard";
import type { StoredCraftOrder } from "./types";
import {
  calculateCostSnapshot,
  collectRemaining,
  createCraftOrder,
  noteDeliveryConsumption,
  reverseDelivery,
  transitionOrder,
} from "@micro-domain/craft-order/index.js";
import { createInventoryMovement, type InventoryMovement } from "@micro-domain/inventory-material/index.js";

/* رقعة إغلاق المجموعة ٣ (D-031): اختبار الحارس النقي لعلاقة التزام عكس
 * التسليم — كل الحالات تُبنى بدوال النطاق الحقيقية (reverseDelivery هي
 * منشئ الحمولة الوحيد) فلا ينفصل الاختبار عن الحقيقة أبدًا. حتمي بالكامل:
 * تواريخ ثابتة، لا نوم ولا شبكة ولا عشوائية. */

const CREATED_AT = "2026-09-04T08:00:00.000Z";
const REVERSAL_AT = "2026-09-04T10:00:00.000Z";
const REVERSAL_KEY = "d031-guard:reverse-delivery";

function deliveredStored(id = "d031-guard-order"): StoredCraftOrder {
  const snapshot = calculateCostSnapshot("d031-guard-snap", {
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
  const deliveryEventId = [...order.events]
    .reverse()
    .find(event => event.type === "status_changed" && event.toStatus === "delivered")!.id;
  const stored: StoredCraftOrder = {
    id,
    order: noteDeliveryConsumption(order, {
      note: "مواد مستهلكة عند التسليم: قماش (2 متر)",
      reversesEventId: deliveryEventId,
      idempotencyKey: "d031-guard:deliver-consumed",
      createdAt: "2026-09-04T09:00:00.000Z",
    }),
    catalogItemId: null,
    deliveryDate: "2026-09-10",
    agreementSource: null,
    createdAt: CREATED_AT,
    updatedAt: "2026-09-04T09:00:00.000Z",
  };
  return stored;
}

function lockedStored(id = "d031-guard-order"): StoredCraftOrder {
  const delivered = deliveredStored(id);
  const locked = transitionOrder(delivered.order, {
    to: "needs_review",
    idempotencyKey: "d031-guard:review-lock",
    createdAt: "2026-09-04T09:30:00.000Z",
    note: "تعارض مالي يستوجب المراجعة",
  });
  return { ...delivered, order: locked, updatedAt: "2026-09-04T09:30:00.000Z" };
}

function reversalPayload(base: StoredCraftOrder, key = REVERSAL_KEY): StoredCraftOrder {
  const order = reverseDelivery(base.order, {
    reason: "سُلّم للزبون الخطأ",
    idempotencyKey: key,
    createdAt: REVERSAL_AT,
  });
  return { ...base, order, updatedAt: REVERSAL_AT };
}

function consumptionMovement(stored: StoredCraftOrder): InventoryMovement {
  const deliveryEventId = [...stored.order.events]
    .reverse()
    .find(event => event.type === "status_changed" && event.toStatus === "delivered")!.id;
  return createInventoryMovement({
    id: "d031-guard-mv-1",
    materialId: "mat-1",
    type: "consumption",
    occurredOn: "2026-09-04",
    recordedAt: "2026-09-04T09:00:00.000Z",
    quantityDeltaMilli: -2000,
    valueDeltaMinor: -1000,
    note: "استهلاك تسليم الطلب: فستان",
    operationKey: `${stored.id}:deliver:${deliveryEventId}:mat-1`,
    orderId: stored.id,
    costKnowledge: "known",
  });
}

function mirrorMovement(consumption: InventoryMovement): InventoryMovement {
  return createInventoryMovement({
    id: `delivery-reversal-${consumption.id}`,
    materialId: consumption.materialId,
    type: "reversal",
    occurredOn: "2026-09-04",
    recordedAt: REVERSAL_AT,
    quantityDeltaMilli: -consumption.quantityDeltaMilli,
    valueDeltaMinor: -consumption.valueDeltaMinor,
    note: `تراجع موثق عن التسليم: ${consumption.note}`,
    reason: "سُلّم للزبون الخطأ",
    operationKey: `${consumption.operationKey}:reversal`,
    reversesMovementId: consumption.id,
    costKnowledge: "known",
  });
}

describe("deliveryReversalCommitGuard — order relation", () => {
  it("accepts a valid first reversal from a delivered base (two-event tail)", () => {
    const stored = deliveredStored();
    const guard = validateDeliveryReversalCommit(stored, reversalPayload(stored));
    expect(guard).toMatchObject({ ok: true, reused: false });
  });

  it("accepts a valid first reversal from a locked needs_review base (one-event tail)", () => {
    const stored = lockedStored();
    const guard = validateDeliveryReversalCommit(stored, reversalPayload(stored));
    expect(guard).toMatchObject({ ok: true, reused: false });
  });

  it("returns the corrected delivery event id for movement validation", () => {
    const stored = deliveredStored();
    const guard = validateDeliveryReversalCommit(stored, reversalPayload(stored));
    if (!guard.ok) throw new Error(guard.message);
    const deliveryEventId = [...stored.order.events]
      .reverse()
      .find(event => event.type === "status_changed" && event.toStatus === "delivered")!.id;
    expect(guard.deliveryEventId).toBe(deliveryEventId);
  });

  it("replays the same operation key as reused without field comparison", () => {
    const stored = reversalPayload(deliveredStored());
    /* إعادة تشغيل بمفتاح العملية نفسه — حتى لو اختلفت بقية الحمولة لا كتابة. */
    const replayBase = { ...stored, order: { ...stored.order, nextAction: "نص آخر" } };
    const guard = validateDeliveryReversalCommit(replayBase, stored);
    expect(guard).toMatchObject({ ok: true, reused: true });
  });

  it("reuses a different-key racing reversal of the same delivery event when stored is exactly base + one committed reversal", () => {
    const base = deliveredStored();
    const committed = reversalPayload(base, "d031-guard:key-1");
    const racing = reversalPayload(base, "d031-guard:key-2");
    const guard = validateDeliveryReversalCommit(committed, racing);
    expect(guard).toMatchObject({ ok: true, reused: true });
  });

  it("reuses a different-key racing reversal from the locked one-event tail", () => {
    const base = lockedStored();
    const committed = reversalPayload(base, "d031-guard:key-1");
    const racing = reversalPayload(base, "d031-guard:key-2");
    const guard = validateDeliveryReversalCommit(committed, racing);
    expect(guard).toMatchObject({ ok: true, reused: true });
  });

  it("rejects the same-target payload when the stored record drifted after the committed reversal", () => {
    const base = deliveredStored();
    const committed = reversalPayload(base, "d031-guard:key-1");
    /* استئناف موثق بعد المراجعة — حدث إضافي بعد العكس الملتزم. */
    const drifted = {
      ...committed,
      order: transitionOrder(committed.order, {
        to: "confirmed",
        idempotencyKey: "d031-guard:resume",
        createdAt: "2026-09-04T11:00:00.000Z",
      }),
    };
    const racing = reversalPayload(base, "d031-guard:key-2");
    const guard = validateDeliveryReversalCommit(drifted, racing);
    expect(guard).toMatchObject({ ok: false });
  });

  it("rejects a stale reversal after a concurrent collection event (lost-update proof)", () => {
    const base = deliveredStored();
    const stalePayload = reversalPayload(base);
    const concurrent = {
      ...base,
      order: collectRemaining(base.order, 2000, "d031-guard:concurrent", "2026-09-04T09:30:00.000Z"),
      updatedAt: "2026-09-04T09:30:00.000Z",
    };
    const guard = validateDeliveryReversalCommit(concurrent, stalePayload);
    expect(guard).toMatchObject({ ok: false });
  });

  it("rejects a stale reversal after a concurrent order-field change with no event", () => {
    const base = deliveredStored();
    const stalePayload = reversalPayload(base);
    const concurrent = { ...base, order: { ...base.order, specifications: "مواصفات معدلة متزامنة" } };
    const guard = validateDeliveryReversalCommit(concurrent, stalePayload);
    expect(guard).toMatchObject({ ok: false });
  });

  it("rejects a stale reversal after a concurrent wrapper-only follow-up change", () => {
    const base = deliveredStored();
    const stalePayload = reversalPayload(base);
    const concurrent = { ...base, followUpDate: "2026-09-20", followUpSummary: "متابعة متزامنة" };
    const guard = validateDeliveryReversalCommit(concurrent, stalePayload);
    expect(guard).toMatchObject({ ok: false });
  });

  it("rejects a forged reversal with nonzero recognized revenue", () => {
    const base = deliveredStored();
    const payload = reversalPayload(base);
    const forged = { ...payload, order: { ...payload.order, recognizedRevenueMinor: 999 } };
    const guard = validateDeliveryReversalCommit(base, forged);
    expect(guard).toMatchObject({ ok: false });
  });

  it("rejects a forged reversal whose nextAction drifted from the domain literal", () => {
    const base = deliveredStored();
    const payload = reversalPayload(base);
    const forged = { ...payload, order: { ...payload.order, nextAction: "نص مختلف" } };
    const guard = validateDeliveryReversalCommit(base, forged);
    expect(guard).toMatchObject({ ok: false });
  });

  it("rejects a payload whose trailing event is not a delivery_reversed", () => {
    const base = deliveredStored();
    const payload = { ...reversalPayload(base), order: { ...base.order } };
    const guard = validateDeliveryReversalCommit(base, payload);
    expect(guard).toMatchObject({ ok: false });
  });

  it("rejects a forged one-event tail from a delivered base (status event skipped)", () => {
    const base = deliveredStored();
    const twoEvent = reversalPayload(base);
    /* حذف حدث الحالة من الذيل — قاعدة مسلّمة تتطلب حدثين. */
    const forged: StoredCraftOrder = {
      ...twoEvent,
      order: {
        ...twoEvent.order,
        events: [...base.order.events, twoEvent.order.events[twoEvent.order.events.length - 1]!],
      },
    };
    const guard = validateDeliveryReversalCommit(base, forged);
    expect(guard).toMatchObject({ ok: false });
  });

  it("rejects a forged two-event tail from a locked base (impossible status transition)", () => {
    const base = lockedStored();
    const oneEvent = reversalPayload(base);
    const deliveredPayload = reversalPayload(deliveredStored());
    /* قاعدة مقفلة + ذيل من مسلّمة: حدث الحالة يقول fromStatus=delivered لكن المخزّن needs_review. */
    const forged: StoredCraftOrder = {
      ...oneEvent,
      order: deliveredPayload.order,
    };
    const guard = validateDeliveryReversalCommit(base, forged);
    expect(guard).toMatchObject({ ok: false });
  });

  it("rejects a payload targeting a delivery event that is not the last live one", () => {
    const base = deliveredStored();
    const payload = reversalPayload(base);
    const forged: StoredCraftOrder = {
      ...payload,
      order: {
        ...payload.order,
        events: payload.order.events.map(event =>
          event.type === "delivery_reversed" ? { ...event, reversesEventId: "fake-event" } : event,
        ),
      },
    };
    const guard = validateDeliveryReversalCommit(base, forged);
    expect(guard).toMatchObject({ ok: false });
  });

  it("a different key never opens a write path for the same delivery event — reuse or stale, never a second relation", () => {
    const base = deliveredStored();
    const committed = reversalPayload(base, "d031-guard:key-1");
    const racing = reversalPayload(base, "d031-guard:key-2");
    /* سباق نظيف من القاعدة نفسها: إعادة استخدام بلا كتابة. */
    const cleanRace = validateDeliveryReversalCommit(committed, racing);
    expect(cleanRace).toMatchObject({ ok: true, reused: true });
    /* قاعدة منحرفة بعد العكس الملتزم: قدمٌ بلا كتابة. */
    const divergentBase = {
      ...committed,
      order: noteDeliveryConsumption(committed.order, {
        note: "بيان متزامن",
        reversesEventId: [...committed.order.events]
          .reverse()
          .find(event => event.type === "status_changed" && event.toStatus === "delivered")!.id,
        idempotencyKey: "d031-guard:divergent",
        createdAt: "2026-09-04T11:00:00.000Z",
      }),
    };
    const divergent = validateDeliveryReversalCommit(divergentBase, racing);
    expect(divergent).toMatchObject({ ok: false });
  });

  it("fails closed when the stored record is missing", () => {
    const payload = reversalPayload(deliveredStored());
    const guard = validateDeliveryReversalCommit(undefined, payload);
    expect(guard).toMatchObject({ ok: false });
  });
});

describe("deliveryReversalCommitGuard — mirror movement relation", () => {
  it("accepts exact mirrors of live delivery consumption movements", () => {
    const stored = deliveredStored();
    const guard = validateDeliveryReversalCommit(stored, reversalPayload(stored));
    if (!guard.ok) throw new Error(guard.message);
    const consumption = consumptionMovement(stored);
    const verdict = validateDeliveryReversalMovements(
      stored.id,
      guard.deliveryEventId,
      [mirrorMovement(consumption)],
      [consumption],
    );
    expect(verdict).toMatchObject({ ok: true });
  });

  it("rejects a mirror with wrong quantity deltas", () => {
    const stored = deliveredStored();
    const guard = validateDeliveryReversalCommit(stored, reversalPayload(stored));
    if (!guard.ok) throw new Error(guard.message);
    const consumption = consumptionMovement(stored);
    const forged = {
      ...mirrorMovement(consumption),
      quantityDeltaMilli: 999,
    };
    const verdict = validateDeliveryReversalMovements(
      stored.id,
      guard.deliveryEventId,
      [forged],
      [consumption],
    );
    expect(verdict).toMatchObject({ ok: false });
  });

  it("rejects a mirror with a non-derived operation key", () => {
    const stored = deliveredStored();
    const guard = validateDeliveryReversalCommit(stored, reversalPayload(stored));
    if (!guard.ok) throw new Error(guard.message);
    const consumption = consumptionMovement(stored);
    const forged = {
      ...mirrorMovement(consumption),
      operationKey: "forged-key:reversal",
    };
    const verdict = validateDeliveryReversalMovements(
      stored.id,
      guard.deliveryEventId,
      [forged],
      [consumption],
    );
    expect(verdict).toMatchObject({ ok: false });
  });

  it("rejects a mirror whose target consumption no longer exists (stale movements)", () => {
    const stored = deliveredStored();
    const guard = validateDeliveryReversalCommit(stored, reversalPayload(stored));
    if (!guard.ok) throw new Error(guard.message);
    const mirror = mirrorMovement(consumptionMovement(stored));
    const verdict = validateDeliveryReversalMovements(stored.id, guard.deliveryEventId, [mirror], []);
    expect(verdict).toMatchObject({ ok: false });
  });

  it("rejects a mirror targeting a consumption of a different delivery event", () => {
    const stored = deliveredStored();
    const guard = validateDeliveryReversalCommit(stored, reversalPayload(stored));
    if (!guard.ok) throw new Error(guard.message);
    const otherDelivery = {
      ...consumptionMovement(stored),
      operationKey: `${stored.id}:deliver:other-event:mat-1`,
    };
    const mirror = {
      ...mirrorMovement(otherDelivery),
      operationKey: `${otherDelivery.operationKey}:reversal`,
    };
    const verdict = validateDeliveryReversalMovements(
      stored.id,
      guard.deliveryEventId,
      [mirror],
      [otherDelivery],
    );
    expect(verdict).toMatchObject({ ok: false });
  });

  it("rejects a non-reversal movement smuggled into the payload", () => {
    const stored = deliveredStored();
    const guard = validateDeliveryReversalCommit(stored, reversalPayload(stored));
    if (!guard.ok) throw new Error(guard.message);
    const consumption = consumptionMovement(stored);
    const smuggled = { ...mirrorMovement(consumption), type: "consumption" };
    const verdict = validateDeliveryReversalMovements(
      stored.id,
      guard.deliveryEventId,
      [smuggled],
      [consumption],
    );
    expect(verdict).toMatchObject({ ok: false });
  });

  it("rejects duplicate operation keys inside one payload", () => {
    const stored = deliveredStored();
    const guard = validateDeliveryReversalCommit(stored, reversalPayload(stored));
    if (!guard.ok) throw new Error(guard.message);
    const consumption = consumptionMovement(stored);
    const mirror = mirrorMovement(consumption);
    const verdict = validateDeliveryReversalMovements(
      stored.id,
      guard.deliveryEventId,
      [mirror, mirror],
      [consumption],
    );
    expect(verdict).toMatchObject({ ok: false });
  });

  it("shape helpers: committed mirrors map through the store, reuse reports stored only", () => {
    const stored = deliveredStored();
    const consumption = consumptionMovement(stored);
    const mirror = mirrorMovement(consumption);
    const storedMirror = { ...mirror, recordedAt: "2026-09-04T10:05:00.000Z" };
    expect(committedReversalMovements([mirror], [storedMirror])).toEqual([storedMirror]);
    expect(committedReversalMovements([mirror], [])).toEqual([mirror]);
    expect(storedReversalMovementsFor([mirror], [storedMirror])).toEqual([storedMirror]);
    expect(storedReversalMovementsFor([mirror], [])).toEqual([]);
  });
});
