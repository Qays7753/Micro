import { describe, expect, it } from "vitest";
import { AgreementService } from "@/application/agreements/agreementService";
import { CostService, type CostEditorInput } from "@/application/cost/costService";
import { DraftService } from "@/application/drafts/draftService";
import { FulfillmentService } from "@/application/fulfillment/fulfillmentService";
import { DeliveryReviewService } from "@/application/fulfillment/deliveryReviewService";
import { InventoryMaterialService } from "@/application/inventory/inventoryMaterialService";
import { MemoryLocalStore } from "@/storage/local/MemoryLocalStore";

/* المجموعة ٣ (عقد D4/D7): اختبارات مراجعة التسليم وتنفيذه وعكسه — الذرّية
 * والهلمة (idempotency) وفصل الإيراد عن القبض وعدم الخصم الخفي للمخزون. */

async function readyOrderWithLinkedMaterials() {
  const store = new MemoryLocalStore();
  const inventory = new InventoryMaterialService(store, () => "2026-08-22T00:00:30.000Z");
  /* مادة متتبَّعة برصيد معلوم: ١٠ قطع بقيمة ٥٠٠٠ (٥٠٠ للقطعة). */
  const opened = await inventory.openMaterial({
    name: "قماش قطنية",
    unit: "meter",
    tracking: "tracked",
    opening: {
      quantityState: "confirmed",
      quantityMilli: 10_000,
      costState: "known",
      valueMinor: 5_000,
      confirmedOn: "2026-08-01",
      sourceNote: "جرد أول المدة",
    },
    note: "افتتاح مادة التسليم",
    operationKey: "open-material-delivery-test",
  });
  if (!opened.ok) throw new Error("tracked material should open");
  const trackedId = opened.value.material.id;
  /* مادة غير متتبَّعة: مرجع تكلفة فقط — لا حركة كمية أبدًا (عقد ٢٨). */
  const untracked = await inventory.openMaterial({
    name: "خيط حريري",
    unit: "piece",
    tracking: "untracked",
    opening: {
      quantityState: "unconfirmed",
      quantityMilli: null,
      costState: "unknown",
      valueMinor: null,
      confirmedOn: null,
      sourceNote: null,
    },
    note: "مادة مرجع تكلفة",
    operationKey: "open-untracked-delivery-test",
  });
  if (!untracked.ok) throw new Error("untracked material should open");

  const costInput: CostEditorInput = {
    materialItems: [
      {
        name: "قماش قطنية",
        quantity: 4,
        unit: "متر",
        unitPriceMinor: 500,
        confidence: "known",
        materialId: trackedId,
      },
      {
        name: "خيط حريري",
        quantity: 1,
        unit: "قطعة",
        unitPriceMinor: 300,
        confidence: "known",
        materialId: untracked.value.material.id,
      },
      { name: "علبة تغليف يدوية", quantity: 1, unit: "قطعة", unitPriceMinor: 200, confidence: "estimated" },
    ],
    time: { minutes: 60, hourlyRateMinor: 500, confidence: "known" },
    packagingMinor: 0,
    deliveryMinor: 0,
    wasteMinor: 0,
    safetyBufferMinor: 100,
    quantity: 1,
  };
  const drafts = new DraftService(store, () => "2026-08-22T00:00:00.000Z");
  const created = await drafts.create("customer_order");
  if (!created.ok) throw new Error("draft should create");
  const saved = await drafts.save({
    ...created.draft,
    customerName: "سارة",
    itemName: "فستان مطرز",
    specifications: "تطريز يدوي",
    quantity: 1,
  });
  if (!saved.ok) throw new Error("draft should save");
  const costs = new CostService(store, () => "2026-08-22T00:01:00.000Z");
  const withCost = await costs.saveSnapshot(saved.draft, costInput);
  if (!withCost.ok) throw new Error("cost should save");
  const agreements = new AgreementService(store, costs, () => "2026-08-22T01:00:00.000Z");
  const agreed = await agreements.createFromDraft(withCost.draft, {
    agreedPriceMinor: 6_000,
    deliveryDate: "2026-08-30",
    depositMinor: 1_000,
    agreementSource: null,
  });
  if (!agreed.ok) throw new Error("agreement should save");
  const executing = await agreements.startExecution(agreed.stored.id);
  if (!executing.ok) throw new Error("execution should start");
  const fulfillment = new FulfillmentService(store, () => "2026-08-22T02:00:00.000Z");
  await fulfillment.markReady(agreed.stored.id);
  return { store, orderId: agreed.stored.id, trackedId, untrackedId: untracked.value.material.id };
}

describe("DeliveryReviewService — buildReview", () => {
  it("previews money and proposes consumption only for tracked linked materials", async () => {
    const { store, orderId, trackedId, untrackedId } = await readyOrderWithLinkedMaterials();
    const service = new DeliveryReviewService(store, () => "2026-08-22T03:00:00.000Z");
    const review = await service.buildReview(orderId);
    expect(review).toMatchObject({ ok: true });
    if (!review.ok) return;
    expect(review.value.money).toMatchObject({
      agreedPriceMinor: 6_000,
      collectedMinor: 1_000,
      depositCollectedMinor: 1_000,
      receivableMinor: 5_000,
    });
    expect(review.value.consumption.hasLinkedMaterials).toBe(true);
    const trackedRow = review.value.consumption.rows.find(row => row.materialId === trackedId);
    expect(trackedRow).toMatchObject({
      tracked: true,
      plannedQuantityMilli: 4_000,
      availableQuantityMilli: 10_000,
      suggestedAction: "consume",
      costKnowledge: "known",
    });
    const untrackedRow = review.value.consumption.rows.find(row => row.materialId === untrackedId);
    expect(untrackedRow).toMatchObject({ tracked: false, suggestedAction: "skip" });
    /* البند الحر (بلا مادة) يبقى ظاهرًا بلا حركة — لا يختفي ولا يُخترع له مخزون. */
    expect(review.value.consumption.unlinkedItems).toEqual([
      { name: "علبة تغليف يدوية", quantity: 1, unit: "قطعة" },
    ]);
  });

  it("refuses review for an order that is not ready", async () => {
    const { store, orderId } = await readyOrderWithLinkedMaterials();
    const service = new DeliveryReviewService(store, () => "2026-08-22T03:00:00.000Z");
    const committed = await service.commitDelivery(orderId, { rows: [], operationKey: "op-1" });
    expect(committed.ok).toBe(true);
    const after = await service.buildReview(orderId);
    expect(after).toMatchObject({ ok: false, code: "invalid_state" });
  });

  it("shows the shortage honestly when the planned quantity exceeds availability", async () => {
    const { store, orderId, trackedId } = await readyOrderWithLinkedMaterials();
    const inventory = new InventoryMaterialService(store, () => "2026-08-22T02:30:00.000Z");
    /* استهلاك يدوي ٩ أمتار قبل التسليم — يبقى متر واحد فقط. */
    const consumed = await inventory.consume({
      materialId: trackedId,
      orderId: null,
      reason: "تجربة قصّ قبل الطلب",
      quantityMilli: 9_000,
      occurredOn: "2026-08-25",
      note: "استهلاك تجربة",
      operationKey: "manual-consume-before-delivery",
    });
    expect(consumed.ok).toBe(true);
    const service = new DeliveryReviewService(store, () => "2026-08-22T03:00:00.000Z");
    const review = await service.buildReview(orderId);
    if (!review.ok) throw new Error("review should build");
    const row = review.value.consumption.rows.find(candidate => candidate.materialId === trackedId);
    expect(row).toMatchObject({
      plannedQuantityMilli: 4_000,
      availableQuantityMilli: 1_000,
      shortageQuantityMilli: 3_000,
      suggestedAction: "consume_with_shortage",
    });
    expect(review.value.warnings.some(warning => warning.includes("النقص"))).toBe(true);
  });
});

describe("DeliveryReviewService — commitDelivery", () => {
  it("delivers atomically: one revenue, order-linked movement, consumption note, and no hidden deduction for untracked or free items", async () => {
    const { store, orderId, trackedId, untrackedId } = await readyOrderWithLinkedMaterials();
    const service = new DeliveryReviewService(store, () => "2026-08-22T03:00:00.000Z");
    const committed = await service.commitDelivery(orderId, {
      rows: [
        { materialId: trackedId, quantityMilli: 4_000, action: "consume" },
        { materialId: untrackedId, quantityMilli: 1_000, action: "skip" },
      ],
      operationKey: "deliver-op-1",
    });
    expect(committed).toMatchObject({ ok: true });
    if (!committed.ok) return;
    expect(committed.value.stored.order).toMatchObject({
      status: "delivered",
      recognizedRevenueMinor: 6_000,
      recognizedCostMinor: 3_000,
      collectedMinor: 1_000,
      receivableMinor: 5_000,
    });
    expect(committed.value.movements).toHaveLength(1);
    const movement = committed.value.movements[0]!;
    expect(movement).toMatchObject({
      materialId: trackedId,
      type: "consumption",
      orderId,
      quantityDeltaMilli: -4_000,
      valueDeltaMinor: -2_000,
      costKnowledge: "known",
    });
    /* الموضع بعد التسليم: ٦ أمتار بقيمة ٣٠٠٠ — لا خصم خفي ولا رصيد سالب. */
    const inventory = new InventoryMaterialService(store);
    const position = await inventory.movements();
    if (!position.ok) throw new Error("movements should list");
    const trackedDeltas = position.value
      .filter(candidate => candidate.materialId === trackedId)
      .reduce((sum, candidate) => sum + candidate.quantityDeltaMilli, 0);
    expect(trackedDeltas).toBe(6_000);
    const untrackedMovements = position.value.filter(candidate => candidate.materialId === untrackedId);
    expect(untrackedMovements).toHaveLength(0);
    expect(committed.value.stored.order.events.some(event => event.type === "delivery_consumed")).toBe(true);
  });

  it("is idempotent: retrying the same delivery reuses it without duplicate revenue or movements", async () => {
    const { store, orderId, trackedId } = await readyOrderWithLinkedMaterials();
    const service = new DeliveryReviewService(store, () => "2026-08-22T03:00:00.000Z");
    const first = await service.commitDelivery(orderId, {
      rows: [{ materialId: trackedId, quantityMilli: 4_000, action: "consume" }],
      operationKey: "deliver-op-retry",
    });
    expect(first.ok).toBe(true);
    const second = await service.commitDelivery(orderId, {
      rows: [{ materialId: trackedId, quantityMilli: 4_000, action: "consume" }],
      operationKey: "deliver-op-retry-2",
    });
    expect(second).toMatchObject({ ok: true, value: { reused: true } });
    const inventory = new InventoryMaterialService(store);
    const movements = await inventory.movements();
    if (!movements.ok) throw new Error("movements should list");
    expect(movements.value.filter(movement => movement.orderId === orderId)).toHaveLength(1);
    const order = second.ok ? second.value.stored.order : null;
    expect(order?.recognizedRevenueMinor).toBe(6_000);
    expect(order?.collectedMinor).toBe(1_000);
  });

  it("records a shortage explicitly instead of allowing negative stock when availability is insufficient", async () => {
    const { store, orderId, trackedId } = await readyOrderWithLinkedMaterials();
    const inventory = new InventoryMaterialService(store, () => "2026-08-22T02:30:00.000Z");
    await inventory.consume({
      materialId: trackedId,
      orderId: null,
      reason: "استهلاك مسبق",
      quantityMilli: 8_000,
      occurredOn: "2026-08-25",
      note: "استهلاك قبل التسليم",
      operationKey: "manual-consume-shortage-test",
    });
    const service = new DeliveryReviewService(store, () => "2026-08-22T03:00:00.000Z");
    const committed = await service.commitDelivery(orderId, {
      rows: [{ materialId: trackedId, quantityMilli: 4_000, action: "consume_with_shortage" }],
      operationKey: "deliver-op-shortage",
    });
    expect(committed.ok).toBe(true);
    if (!committed.ok) return;
    expect(committed.value.movements).toHaveLength(1);
    expect(committed.value.movements[0]).toMatchObject({ quantityDeltaMilli: -2_000 });
    expect(committed.value.shortages).toHaveLength(1);
    expect(committed.value.shortages[0]).toMatchObject({
      materialId: trackedId,
      requestedQuantityMilli: 4_000,
      availableQuantityMilli: 2_000,
      shortageQuantityMilli: 2_000,
      orderId,
    });
  });

  it("refuses consuming an untracked material — it stays a cost reference with no quantity movement", async () => {
    const { store, orderId, untrackedId } = await readyOrderWithLinkedMaterials();
    const service = new DeliveryReviewService(store, () => "2026-08-22T03:00:00.000Z");
    const committed = await service.commitDelivery(orderId, {
      rows: [{ materialId: untrackedId, quantityMilli: 1_000, action: "consume" }],
      operationKey: "deliver-op-untracked",
    });
    expect(committed).toMatchObject({ ok: false, code: "validation_error" });
  });

  it("collects at delivery once with wallet attribution and never counts the deposit as profit twice", async () => {
    const { store, orderId, trackedId } = await readyOrderWithLinkedMaterials();
    const service = new DeliveryReviewService(store, () => "2026-08-22T03:00:00.000Z");
    const committed = await service.commitDelivery(orderId, {
      rows: [{ materialId: trackedId, quantityMilli: 4_000, action: "consume" }],
      collectNow: { amountMinor: 5_000, walletId: null },
      operationKey: "deliver-op-collect",
    });
    expect(committed.ok).toBe(true);
    if (!committed.ok) return;
    expect(committed.value.stored.order).toMatchObject({
      status: "settled",
      settlementStatus: "paid",
      collectedMinor: 6_000,
      receivableMinor: 0,
      /* الإيراد مرة واحدة: ٦٠٠٠ لا ٧٠٠٠ — القبض ليس إيرادًا والعربون محسوب ضمنًا. */
      recognizedRevenueMinor: 6_000,
    });
  });

  it("applies an explicit final-price correction at delivery with a required reason", async () => {
    const { store, orderId, trackedId } = await readyOrderWithLinkedMaterials();
    const service = new DeliveryReviewService(store, () => "2026-08-22T03:00:00.000Z");
    const withoutReason = await service.commitDelivery(orderId, {
      rows: [],
      finalPriceMinor: 7_000,
      operationKey: "deliver-op-price-1",
    });
    expect(withoutReason).toMatchObject({ ok: false, code: "validation_error" });
    const committed = await service.commitDelivery(orderId, {
      rows: [{ materialId: trackedId, quantityMilli: 4_000, action: "consume" }],
      finalPriceMinor: 7_000,
      priceRevisionReason: "أضاف الزبون تطريزًا إضافيًا عند الاستلام",
      operationKey: "deliver-op-price-2",
    });
    expect(committed.ok).toBe(true);
    if (!committed.ok) return;
    expect(committed.value.stored.order).toMatchObject({
      agreedPriceMinor: 7_000,
      recognizedRevenueMinor: 7_000,
      receivableMinor: 6_000,
    });
    const priceEvent = committed.value.stored.order.events.find(event => event.type === "price_revised");
    expect(priceEvent).toMatchObject({ fromPriceMinor: 6_000, toPriceMinor: 7_000 });
  });
});

describe("DeliveryReviewService — reverseDelivery", () => {
  it("neutralizes revenue, mirrors consumption movements, and moves the order to explicit review without touching collected cash", async () => {
    const { store, orderId, trackedId } = await readyOrderWithLinkedMaterials();
    const service = new DeliveryReviewService(store, () => "2026-08-22T03:00:00.000Z");
    const committed = await service.commitDelivery(orderId, {
      rows: [{ materialId: trackedId, quantityMilli: 4_000, action: "consume" }],
      operationKey: "deliver-op-reverse",
    });
    expect(committed.ok).toBe(true);
    const reversed = await service.reverseDelivery(orderId, { reason: "سُلّم الطلب للزبون الخطأ" });
    expect(reversed).toMatchObject({ ok: true });
    if (!reversed.ok) return;
    expect(reversed.value.stored.order).toMatchObject({
      status: "needs_review",
      resultStatus: "review_required",
      recognizedRevenueMinor: 0,
      recognizedCostMinor: 0,
      profitIndicatorMinor: null,
      /* الكاش المقبوض (العربون) لا يُمس — له مسار تراجع/تسوية خاص. */
      collectedMinor: 1_000,
    });
    expect(reversed.value.reversalMovements).toHaveLength(1);
    expect(reversed.value.reversalMovements[0]).toMatchObject({
      type: "reversal",
      quantityDeltaMilli: 4_000,
      valueDeltaMinor: 2_000,
      reversesMovementId: committed.ok ? committed.value.movements[0]!.id : "",
    });
    const inventory = new InventoryMaterialService(store);
    const movements = await inventory.movements();
    if (!movements.ok) throw new Error("movements should list");
    const net = movements.value
      .filter(movement => movement.materialId === trackedId)
      .reduce((sum, movement) => sum + movement.quantityDeltaMilli, 0);
    expect(net).toBe(10_000);
  });

  it("refuses reversing the same delivery twice and supports honest re-delivery after re-execution", async () => {
    const { store, orderId, trackedId } = await readyOrderWithLinkedMaterials();
    const service = new DeliveryReviewService(store, () => "2026-08-22T03:00:00.000Z");
    await service.commitDelivery(orderId, {
      rows: [{ materialId: trackedId, quantityMilli: 4_000, action: "consume" }],
      operationKey: "deliver-op-twice-1",
    });
    const first = await service.reverseDelivery(orderId, { reason: "خطأ في التسليم" });
    expect(first.ok).toBe(true);
    const second = await service.reverseDelivery(orderId, { reason: "محاولة عكس مكررة" });
    expect(second).toMatchObject({ ok: false, code: "invalid_state" });
    /* إعادة التنفيذ الموثقة عبر مسار الخدمة: استئناف بعد المراجعة ← جاهز ←
     * تسليم جديد — انتقالات النطاق نفسها، لا مسار خاص بالعكس. */
    const fulfillment = new FulfillmentService(store, () => "2026-08-22T04:00:00.000Z");
    const resumed = await fulfillment.resumeAfterReview(orderId);
    expect(resumed).toMatchObject({ ok: true, stored: { order: { status: "in_progress" } } });
    await fulfillment.markReady(orderId);
    const redelivered = await service.commitDelivery(orderId, {
      rows: [{ materialId: trackedId, quantityMilli: 4_000, action: "consume" }],
      operationKey: "deliver-op-twice-2",
    });
    expect(redelivered).toMatchObject({ ok: true });
    if (!redelivered.ok) return;
    /* التسليم الثاني إيراده معترف مرة أخرى (صافي الأثر: إيراد تسليم واحد قائم)
     * وحركاته غير مكررة لأن مفتاح المحاولة الثانية جديد. */
    expect(redelivered.value.stored.order).toMatchObject({
      status: "delivered",
      recognizedRevenueMinor: 6_000,
    });
    const inventory = new InventoryMaterialService(store);
    const movements = await inventory.movements();
    if (!movements.ok) throw new Error("movements should list");
    const consumptions = movements.value.filter(
      movement => movement.type === "consumption" && movement.orderId === orderId,
    );
    expect(consumptions).toHaveLength(2);
    const reversals = movements.value.filter(
      movement => movement.type === "reversal" && movement.note.includes("عكس تسليم"),
    );
    expect(reversals).toHaveLength(1);
  });
});
