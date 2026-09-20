import { describe, expect, it } from "vitest";
import { AgreementService } from "@/application/agreements/agreementService";
import { CostService, type CostEditorInput } from "@/application/cost/costService";
import { DraftService } from "@/application/drafts/draftService";
import { FulfillmentService } from "@/application/fulfillment/fulfillmentService";
import { DeliveryReviewService } from "@/application/fulfillment/deliveryReviewService";
import { InventoryMaterialService } from "@/application/inventory/inventoryMaterialService";
import { MemoryLocalStore } from "@/storage/local/MemoryLocalStore";
import { createInventoryMovement } from "@micro-domain/inventory-material/index.js";

/* G-001 (تدقيق الإدارة المالية المتدرجة 2026-09-19): فخ الاستهلاك المزدوج عند
 * التسليم — الاستهلاك اليدوي السابق المرتبط بنفس الطلب يجب أن يظهر ويُخصم من
 * المخطط، على مستوى العرض (بنية المراجعة) وحد الكتابة (رفض صريح لا خفض صامت)،
 * بلا نقص كاذب وبلا استهلاك مزدوج وبلا تكلفة مزدوجة وبلا تغيير في تعريف
 * الإيراد أو COGS أو أي لقطة تاريخية. */

async function readyOrderWithLinkedMaterials() {
  const store = new MemoryLocalStore();
  const inventory = new InventoryMaterialService(store, () => "2026-08-22T00:00:30.000Z");
  /* مادتان متتبعتان برصيد معلوم: ٢٠ مترًا لكل واحدة بقيمة ١٠٠٠٠ (٥٠٠ للمتر). */
  const first = await inventory.openMaterial({
    name: "قماش قطنية",
    unit: "meter",
    tracking: "tracked",
    opening: {
      quantityState: "confirmed",
      quantityMilli: 20_000,
      costState: "known",
      valueMinor: 10_000,
      confirmedOn: "2026-08-01",
      sourceNote: "جرد أول المدة",
    },
    note: "افتتاح مادة التسليم",
    operationKey: "open-material-g001-a",
  });
  if (!first.ok) throw new Error("tracked material a should open");
  const second = await inventory.openMaterial({
    name: "قماش كتان",
    unit: "meter",
    tracking: "tracked",
    opening: {
      quantityState: "confirmed",
      quantityMilli: 20_000,
      costState: "known",
      valueMinor: 10_000,
      confirmedOn: "2026-08-01",
      sourceNote: "جرد أول المدة",
    },
    note: "افتتاح مادة التسليم الثانية",
    operationKey: "open-material-g001-b",
  });
  if (!second.ok) throw new Error("tracked material b should open");

  const costInput: CostEditorInput = {
    materialItems: [
      {
        name: "قماش قطنية",
        quantity: 10,
        unit: "متر",
        unitPriceMinor: 500,
        confidence: "known",
        materialId: first.value.material.id,
      },
      {
        name: "قماش كتان",
        quantity: 10,
        unit: "متر",
        unitPriceMinor: 500,
        confidence: "known",
        materialId: second.value.material.id,
      },
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
    agreedPriceMinor: 20_000,
    deliveryDate: "2026-08-30",
    depositMinor: 0,
    agreementSource: null,
  });
  if (!agreed.ok) throw new Error("agreement should save");
  const executing = await agreements.startExecution(agreed.stored.id);
  if (!executing.ok) throw new Error("execution should start");
  const fulfillment = new FulfillmentService(store, () => "2026-08-22T02:00:00.000Z");
  await fulfillment.markReady(agreed.stored.id);
  return {
    store,
    orderId: agreed.stored.id,
    firstId: first.value.material.id,
    secondId: second.value.material.id,
    inventory,
  };
}

async function manualConsume(
  store: MemoryLocalStore,
  input: Parameters<InventoryMaterialService["consume"]>[0],
) {
  const inventory = new InventoryMaterialService(store, () => "2026-08-23T00:00:00.000Z");
  const result = await inventory.consume(input);
  if (!result.ok) throw new Error(result.message);
  return result;
}

describe("G-001 — buildReview shows prior order-linked consumption", () => {
  it("full prior consumption: remaining is zero and the suggested action is skip", async () => {
    const { store, orderId, firstId } = await readyOrderWithLinkedMaterials();
    await manualConsume(store, {
      materialId: firstId,
      orderId,
      reason: "قصّ مبدئي لهذا الطلب",
      quantityMilli: 10_000,
      occurredOn: "2026-08-25",
      note: "استهلاك يدوي كامل",
      operationKey: "g001-full-consume",
    });
    const service = new DeliveryReviewService(store, () => "2026-08-22T03:00:00.000Z");
    const review = await service.buildReview(orderId);
    if (!review.ok) throw new Error(review.message);
    const row = review.value.consumption.rows.find(candidate => candidate.materialId === firstId);
    expect(row).toMatchObject({
      plannedQuantityMilli: 10_000,
      alreadyConsumedForOrderMilli: 10_000,
      remainingToConsumeMilli: 0,
      availableQuantityMilli: 10_000,
      shortageQuantityMilli: 0,
      suggestedAction: "skip",
    });
    expect(review.value.warnings.some(warning => warning.includes("استُهلك لهذا الطلب"))).toBe(true);
  });

  it("partial prior consumption: suggestion equals the remaining quantity only", async () => {
    const { store, orderId, firstId } = await readyOrderWithLinkedMaterials();
    await manualConsume(store, {
      materialId: firstId,
      orderId,
      reason: "قصّ جزئي لهذا الطلب",
      quantityMilli: 4_000,
      occurredOn: "2026-08-25",
      note: "استهلاك يدوي جزئي",
      operationKey: "g001-partial-consume",
    });
    const service = new DeliveryReviewService(store, () => "2026-08-22T03:00:00.000Z");
    const review = await service.buildReview(orderId);
    if (!review.ok) throw new Error(review.message);
    const row = review.value.consumption.rows.find(candidate => candidate.materialId === firstId);
    expect(row).toMatchObject({
      plannedQuantityMilli: 10_000,
      alreadyConsumedForOrderMilli: 4_000,
      remainingToConsumeMilli: 6_000,
      availableQuantityMilli: 16_000,
      shortageQuantityMilli: 0,
      suggestedAction: "consume",
    });
  });

  it("no prior consumption: remaining equals the planned quantity exactly (legacy behavior)", async () => {
    const { store, orderId, firstId } = await readyOrderWithLinkedMaterials();
    const service = new DeliveryReviewService(store, () => "2026-08-22T03:00:00.000Z");
    const review = await service.buildReview(orderId);
    if (!review.ok) throw new Error(review.message);
    const row = review.value.consumption.rows.find(candidate => candidate.materialId === firstId);
    expect(row).toMatchObject({
      plannedQuantityMilli: 10_000,
      alreadyConsumedForOrderMilli: 0,
      remainingToConsumeMilli: 10_000,
      suggestedAction: "consume",
    });
  });

  it("multiple materials: per-material remaining is computed independently (mixed full/partial)", async () => {
    const { store, orderId, firstId, secondId } = await readyOrderWithLinkedMaterials();
    await manualConsume(store, {
      materialId: firstId,
      orderId,
      reason: "قصّ كامل",
      quantityMilli: 10_000,
      occurredOn: "2026-08-25",
      note: "استهلاك يدوي كامل",
      operationKey: "g001-mixed-a",
    });
    await manualConsume(store, {
      materialId: secondId,
      orderId,
      reason: "قصّ جزئي",
      quantityMilli: 2_500,
      occurredOn: "2026-08-25",
      note: "استهلاك يدوي جزئي",
      operationKey: "g001-mixed-b",
    });
    const service = new DeliveryReviewService(store, () => "2026-08-22T03:00:00.000Z");
    const review = await service.buildReview(orderId);
    if (!review.ok) throw new Error(review.message);
    const firstRow = review.value.consumption.rows.find(candidate => candidate.materialId === firstId);
    const secondRow = review.value.consumption.rows.find(candidate => candidate.materialId === secondId);
    expect(firstRow).toMatchObject({ remainingToConsumeMilli: 0, suggestedAction: "skip" });
    expect(secondRow).toMatchObject({
      alreadyConsumedForOrderMilli: 2_500,
      remainingToConsumeMilli: 7_500,
      suggestedAction: "consume",
    });
  });

  it("no false shortage: shortage is remaining minus available, not planned minus available", async () => {
    const { store, orderId, firstId } = await readyOrderWithLinkedMaterials();
    /* مخزون ١٠ بعد استهلاك يدوي ١٠ من ٢٠: المتبقي ١٠ والمتاح ١٠ — لا نقص،
     * بينما الحساب القديم (المخطط ١٠ - المتاح ١٠) كان سيسجل نقصًا كاذبًا لو
     * كان المتاح أقل من المخطط بفعل الاستهلاك السابق نفسه. */
    await manualConsume(store, {
      materialId: firstId,
      orderId,
      reason: "قصّ مبدئي",
      quantityMilli: 10_000,
      occurredOn: "2026-08-25",
      note: "استهلاك يدوي",
      operationKey: "g001-no-false-shortage",
    });
    const service = new DeliveryReviewService(store, () => "2026-08-22T03:00:00.000Z");
    const review = await service.buildReview(orderId);
    if (!review.ok) throw new Error(review.message);
    const row = review.value.consumption.rows.find(candidate => candidate.materialId === firstId);
    expect(row).toMatchObject({ remainingToConsumeMilli: 0, shortageQuantityMilli: 0 });
    /* والنقص الحقيقي يبقى صادقًا على المتبقي: متبقٍ ١٠ ومتاح ٤ = نقص ٦. */
    await manualConsume(store, {
      materialId: firstId,
      orderId: null,
      reason: "مشروع آخر",
      quantityMilli: 6_000,
      occurredOn: "2026-08-26",
      note: "استهلاك طلب آخر",
      operationKey: "g001-other-order-consume",
    });
    const reread = await service.buildReview(orderId);
    if (!reread.ok) throw new Error(reread.message);
    const rowAfter = reread.value.consumption.rows.find(candidate => candidate.materialId === firstId);
    expect(rowAfter).toMatchObject({
      remainingToConsumeMilli: 0,
      availableQuantityMilli: 4_000,
      shortageQuantityMilli: 0,
      suggestedAction: "skip",
    });
  });

  it("insufficient stock: shortage equals remaining minus available", async () => {
    const { store, orderId, firstId } = await readyOrderWithLinkedMaterials();
    await manualConsume(store, {
      materialId: firstId,
      orderId: null,
      reason: "مشروع آخر",
      quantityMilli: 15_000,
      occurredOn: "2026-08-26",
      note: "استهلاك طلب آخر",
      operationKey: "g001-drain-stock",
    });
    await manualConsume(store, {
      materialId: firstId,
      orderId,
      reason: "قصّ جزئي لهذا الطلب",
      quantityMilli: 4_000,
      occurredOn: "2026-08-27",
      note: "استهلاك يدوي جزئي",
      operationKey: "g001-partial-then-shortage",
    });
    const service = new DeliveryReviewService(store, () => "2026-08-22T03:00:00.000Z");
    const review = await service.buildReview(orderId);
    if (!review.ok) throw new Error(review.message);
    const row = review.value.consumption.rows.find(candidate => candidate.materialId === firstId);
    /* المتبقي ٦ والمتاح ١ (٢٠ - ١٥ - ٤): نقص ٥ لا ٩ (المخطط ١٠ - المتاح ١). */
    expect(row).toMatchObject({
      remainingToConsumeMilli: 6_000,
      availableQuantityMilli: 1_000,
      shortageQuantityMilli: 5_000,
      suggestedAction: "consume_with_shortage",
    });
  });

  it("reversed manual consumption is excluded from already-consumed (contract 13 rule)", async () => {
    const { store, orderId, firstId } = await readyOrderWithLinkedMaterials();
    const consumed = await manualConsume(store, {
      materialId: firstId,
      orderId,
      reason: "قصّ مبدئي",
      quantityMilli: 10_000,
      occurredOn: "2026-08-25",
      note: "استهلاك يدوي",
      operationKey: "g001-reversible-consume",
    });
    /* مرآة عكس موثقة للحركة اليدوية نفسها (عقد ١١/١٣) — ترجع الكمية والقيمة. */
    const reversal = await store.commitInventory(null, [
      createInventoryMovement({
        id: "g001-reversal-movement",
        materialId: firstId,
        type: "reversal",
        occurredOn: "2026-08-25",
        recordedAt: "2026-08-24T00:00:00.000Z",
        quantityDeltaMilli: 10_000,
        valueDeltaMinor: 5_000,
        note: "عكس استهلاك يدوي خاطئ",
        reason: "خطأ إدخال",
        operationKey: "g001-reverse-consume",
        reversesMovementId: consumed.value.id,
      }),
    ]);
    expect(reversal.ok).toBe(true);
    const service = new DeliveryReviewService(store, () => "2026-08-22T03:00:00.000Z");
    const review = await service.buildReview(orderId);
    if (!review.ok) throw new Error(review.message);
    const row = review.value.consumption.rows.find(candidate => candidate.materialId === firstId);
    expect(row).toMatchObject({
      alreadyConsumedForOrderMilli: 0,
      remainingToConsumeMilli: 10_000,
      suggestedAction: "consume",
    });
  });
});

describe("G-001 — commitDelivery write boundary", () => {
  it("rejects a row exceeding the remaining quantity with validation_error and writes nothing", async () => {
    const { store, orderId, firstId } = await readyOrderWithLinkedMaterials();
    await manualConsume(store, {
      materialId: firstId,
      orderId,
      reason: "قصّ كامل لهذا الطلب",
      quantityMilli: 10_000,
      occurredOn: "2026-08-25",
      note: "استهلاك يدوي كامل",
      operationKey: "g001-boundary-full",
    });
    const service = new DeliveryReviewService(store, () => "2026-08-22T03:00:00.000Z");
    /* حمولة قديمة كما لو بُنيت قبل الاستهلاك اليدوي: المخطط كاملًا. */
    const committed = await service.commitDelivery(orderId, {
      rows: [{ materialId: firstId, quantityMilli: 10_000, action: "consume" }],
      operationKey: "g001-over-consume-attempt",
    });
    expect(committed).toMatchObject({ ok: false, code: "validation_error" });
    if (!committed.ok) expect(committed.message).toContain("المتبقي للاستهلاك");
    /* لا كتابة إطلاقًا: الطلب ما زال جاهزًا ولا حركة تسليم جديدة — حركة
     * الاستهلاك اليدوي السابقة نفسها هي الوحيدة المرتبطة بالطلب. */
    const order = await store.getOrder(orderId);
    if (!order.ok || !order.value) throw new Error("order should read");
    expect(order.value.order.status).toBe("ready");
    const movements = await store.listInventoryMovements();
    if (!movements.ok) throw new Error(movements.message);
    const orderLinked = movements.value.filter(movement => movement.orderId === orderId);
    expect(orderLinked).toHaveLength(1);
    expect(orderLinked[0]).toMatchObject({ type: "consumption", quantityDeltaMilli: -10_000 });
  });

  it("committing only the remaining quantity succeeds and records exactly one movement", async () => {
    const { store, orderId, firstId, secondId } = await readyOrderWithLinkedMaterials();
    await manualConsume(store, {
      materialId: firstId,
      orderId,
      reason: "قصّ جزئي لهذا الطلب",
      quantityMilli: 4_000,
      occurredOn: "2026-08-25",
      note: "استهلاك يدوي جزئي",
      operationKey: "g001-commit-partial",
    });
    const service = new DeliveryReviewService(store, () => "2026-08-22T03:00:00.000Z");
    const committed = await service.commitDelivery(orderId, {
      rows: [
        { materialId: firstId, quantityMilli: 6_000, action: "consume" },
        { materialId: secondId, quantityMilli: 10_000, action: "consume" },
      ],
      operationKey: "g001-commit-remaining",
    });
    expect(committed.ok).toBe(true);
    const movements = await store.listInventoryMovements();
    if (!movements.ok) throw new Error(movements.message);
    const orderLinked = movements.value.filter(movement => movement.orderId === orderId);
    /* حركتا التسليم فقط (المتبقي ٦ للمادة الأولى + ١٠ للثانية) فوق حركة
     * الاستهلاك اليدوي السابقة — لا استهلاك مزدوج للمخطط. */
    expect(orderLinked.filter(movement => movement.type === "consumption")).toHaveLength(3);
    expect(orderLinked.filter(movement => movement.type === "consumption")[0]).toMatchObject({
      quantityDeltaMilli: -4_000,
    });
    const order = await store.getOrder(orderId);
    if (!order.ok || !order.value) throw new Error("order should read");
    expect(order.value.order.status).toBe("delivered");
  });

  it("retry after commit returns reused with no second movement (idempotent delivery)", async () => {
    const { store, orderId, firstId } = await readyOrderWithLinkedMaterials();
    await manualConsume(store, {
      materialId: firstId,
      orderId,
      reason: "قصّ جزئي",
      quantityMilli: 4_000,
      occurredOn: "2026-08-25",
      note: "استهلاك يدوي جزئي",
      operationKey: "g001-retry-prior",
    });
    const service = new DeliveryReviewService(store, () => "2026-08-22T03:00:00.000Z");
    const first = await service.commitDelivery(orderId, {
      rows: [{ materialId: firstId, quantityMilli: 6_000, action: "consume" }],
      operationKey: "g001-retry-commit",
    });
    expect(first.ok).toBe(true);
    const second = await service.commitDelivery(orderId, {
      rows: [{ materialId: firstId, quantityMilli: 6_000, action: "consume" }],
      operationKey: "g001-retry-commit",
    });
    expect(second).toMatchObject({ ok: true });
    if (second.ok) expect(second.value.reused).toBe(true);
    const movements = await store.listInventoryMovements();
    if (!movements.ok) throw new Error(movements.message);
    expect(movements.value.filter(movement => movement.orderId === orderId)).toHaveLength(2);
  });

  it("no double cost: order result fields stay snapshot-derived and unchanged", async () => {
    const { store, orderId, firstId } = await readyOrderWithLinkedMaterials();
    const before = await store.getOrder(orderId);
    if (!before.ok || !before.value) throw new Error("order should read");
    await manualConsume(store, {
      materialId: firstId,
      orderId,
      reason: "قصّ جزئي",
      quantityMilli: 4_000,
      occurredOn: "2026-08-25",
      note: "استهلاك يدوي جزئي",
      operationKey: "g001-cost-prior",
    });
    const service = new DeliveryReviewService(store, () => "2026-08-22T03:00:00.000Z");
    const committed = await service.commitDelivery(orderId, {
      rows: [{ materialId: firstId, quantityMilli: 6_000, action: "consume" }],
      operationKey: "g001-cost-commit",
    });
    expect(committed.ok).toBe(true);
    const after = await store.getOrder(orderId);
    if (!after.ok || !after.value) throw new Error("order should read");
    /* الإيراد يُعرف مرة واحدة عند التسليم بقيمة الاتفاق، والتكلفة المعترف بها
     * من نسخة التكلفة المجمدة — لا من حركات الاستهلاك ولا من عدد الحركات. */
    expect(after.value.order.recognizedRevenueMinor).toBe(before.value.order.agreedPriceMinor);
    expect(after.value.order.recognizedCostMinor).toBe(before.value.order.costSnapshot.plannedCostMinor);
    expect(after.value.order.collectedMinor).toBe(before.value.order.collectedMinor);
  });
});
