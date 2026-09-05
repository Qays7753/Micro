import { describe, expect, it } from "vitest";
import { InventoryMaterialService } from "./inventoryMaterialService";
import { MemoryLocalStore } from "@/storage/local/MemoryLocalStore";
import { calculateCostSnapshot, createCraftOrder } from "@micro-domain/craft-order/index.js";
import { createSupplierPurchase } from "@micro-domain/supplier-purchase/index.js";

describe("InventoryMaterialService", () => {
  it("keeps purchase cash semantics separate while receiving, consuming, wasting, and reversing stock", async () => {
    const store = new MemoryLocalStore();
    const service = new InventoryMaterialService(store, () => "2026-08-23T09:00:00.000Z");
    const opened = await service.openMaterial({
      name: "خشب",
      unit: "piece",
      tracking: "tracked",
      opening: {
        quantityState: "confirmed",
        quantityMilli: 10000,
        costState: "known",
        valueMinor: 4000,
        confirmedOn: "2026-08-01",
        sourceNote: null,
      },
      note: "افتتاح",
      operationKey: "material-1",
    });
    if (!opened.ok) throw new Error("material should open");
    const purchase = createSupplierPurchase({
      id: "purchase-1",
      supplierName: "المورد",
      note: "ألواح",
      purchasedOn: "2026-08-02",
      dueOn: null,
      totalMinor: 3000,
      initialPaidMinor: 0,
      recordedAt: "2026-08-23T09:00:00.000Z",
      idempotencyKey: "purchase-1",
    });
    await store.saveSupplierPurchase(purchase);
    await expect(
      service.receivePurchase({
        materialId: opened.value.material.id,
        purchaseId: purchase.id,
        quantityMilli: 5000,
        valueMinor: 3000,
        occurredOn: "2026-08-02",
        note: "استلام ألواح",
        operationKey: "receipt-1",
      }),
    ).resolves.toMatchObject({ ok: true, value: { type: "purchase_receipt", valueDeltaMinor: 3000 } });
    const cost = calculateCostSnapshot("cost", {
      currency: "JOD",
      materialItems: [],
      time: { minutes: 60, hourlyRateMinor: 500, confidence: "known" },
      packagingMinor: 0,
      deliveryMinor: 0,
      wasteMinor: 0,
      safetyBufferMinor: 0,
      quantity: 1,
      createdAt: "2026-08-23T09:00:00.000Z",
      freshnessDays: null,
    });
    const order = createCraftOrder({
      id: "order-1",
      customerName: "سارة",
      itemName: "قطعة",
      specifications: "طلب اختبار",
      quantity: 1,
      agreedPriceMinor: 2000,
      costSnapshot: cost,
      createdAt: "2026-08-23T09:00:00.000Z",
    });
    await store.saveOrder({
      id: order.id,
      order,
      deliveryDate: "2026-08-30",
      agreementSource: null,
      createdAt: "2026-08-23T09:00:00.000Z",
      updatedAt: "2026-08-23T09:00:00.000Z",
    });
    await expect(
      service.consume({
        materialId: opened.value.material.id,
        orderId: order.id,
        quantityMilli: 2000,
        occurredOn: "2026-08-23",
        note: "طلب سارة",
        operationKey: "consume-1",
      }),
    ).resolves.toMatchObject({
      ok: true,
      value: { type: "consumption", quantityDeltaMilli: -2000, orderId: order.id },
    });
    const waste = await service.waste({
      materialId: opened.value.material.id,
      quantityMilli: 1000,
      occurredOn: "2026-08-23",
      note: "لوح تالف",
      reason: "كسر",
      operationKey: "waste-1",
    });
    if (!waste.ok) throw new Error("waste should save");
    await expect(
      service.reverse({
        movementId: waste.value.id,
        occurredOn: "2026-08-23",
        reason: "سجل الهدر خاطئ",
        operationKey: "reverse-waste",
      }),
    ).resolves.toMatchObject({ ok: true, value: { type: "reversal", quantityDeltaMilli: 1000 } });
    const overview = await service.overview();
    expect(overview).toMatchObject({
      ok: true,
      value: {
        materials: [{ quantityMilli: 13000, valueMinor: 6067 }],
      },
    });
    await expect(store.listSupplierPurchases()).resolves.toMatchObject({
      ok: true,
      value: [{ id: purchase.id, paidMinor: 0, payableMinor: 3000 }],
    });
  });

  it("refuses an outbound movement greater than the quantity currently available", async () => {
    const service = new InventoryMaterialService(new MemoryLocalStore());
    const opened = await service.openMaterial({
      name: "خيط",
      unit: "meter",
      tracking: "tracked",
      opening: {
        quantityState: "confirmed",
        quantityMilli: 1000,
        costState: "known",
        valueMinor: 500,
        confirmedOn: "2026-08-01",
        sourceNote: null,
      },
      note: "افتتاح",
      operationKey: "thread",
    });
    if (!opened.ok) throw new Error("material should open");
    await expect(
      service.waste({
        materialId: opened.value.material.id,
        quantityMilli: 1001,
        occurredOn: "2026-08-23",
        note: "هدر",
        reason: "اختبار",
        operationKey: "too-much",
      }),
    ).resolves.toMatchObject({ ok: false, code: "validation_error" });
  });

  it("compares only active material consumption with the frozen planned material without rewriting the order", async () => {
    const store = new MemoryLocalStore();
    const service = new InventoryMaterialService(store, () => "2026-08-23T09:00:00.000Z");
    const opened = await service.openMaterial({
      name: "خشب",
      unit: "piece",
      tracking: "tracked",
      opening: {
        quantityState: "confirmed",
        quantityMilli: 10000,
        costState: "known",
        valueMinor: 4000,
        confirmedOn: "2026-08-01",
        sourceNote: null,
      },
      note: "افتتاح",
      operationKey: "actual-material-open",
    });
    if (!opened.ok) throw new Error("material should open");
    const cost = calculateCostSnapshot("actual-material-cost", {
      currency: "JOD",
      materialItems: [
        {
          name: "خشب",
          quantity: 1,
          unit: "قطعة",
          unitPriceMinor: 2000,
          priceDate: "2026-08-01",
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
      createdAt: "2026-08-01T09:00:00.000Z",
      freshnessDays: null,
    });
    const order = createCraftOrder({
      id: "actual-material-order",
      customerName: "ليان",
      itemName: "صندوق",
      specifications: "اختبار فرق المادة",
      quantity: 1,
      agreedPriceMinor: 5000,
      costSnapshot: cost,
      createdAt: "2026-08-01T09:00:00.000Z",
    });
    await store.saveOrder({
      id: order.id,
      order,
      deliveryDate: "2026-08-30",
      agreementSource: null,
      createdAt: "2026-08-01T09:00:00.000Z",
      updatedAt: "2026-08-01T09:00:00.000Z",
    });
    await expect(service.readOrderActualMaterialComparison(order.id)).resolves.toMatchObject({
      ok: true,
      value: {
        status: "not_recorded",
        plannedMaterialMinor: 2000,
        actualMaterialMinor: null,
        varianceMinor: null,
      },
    });
    const consumed = await service.consume({
      materialId: opened.value.material.id,
      orderId: order.id,
      quantityMilli: 2000,
      occurredOn: "2026-08-23",
      note: "تنفيذ صندوق ليان",
      operationKey: "actual-material-consume",
    });
    if (!consumed.ok) throw new Error("consumption should save");
    await expect(service.readOrderActualMaterialComparison(order.id)).resolves.toMatchObject({
      ok: true,
      value: {
        status: "recorded",
        plannedMaterialMinor: 2000,
        actualMaterialMinor: 800,
        actualQuantityMilli: 2000,
        varianceMinor: -1200,
        consumptionCount: 1,
      },
    });
    await expect(
      service.reverse({
        movementId: consumed.value.id,
        occurredOn: "2026-08-23",
        reason: "لم يستخدم الخشب",
        operationKey: "actual-material-reverse",
      }),
    ).resolves.toMatchObject({ ok: true });
    await expect(service.readOrderActualMaterialComparison(order.id)).resolves.toMatchObject({
      ok: true,
      value: { status: "not_recorded", actualMaterialMinor: null, varianceMinor: null, consumptionCount: 0 },
    });
    const stored = await store.getOrder(order.id);
    expect(stored).toMatchObject({
      ok: true,
      value: { order: { costSnapshot: { materialCostMinor: 2000 }, recognizedCostMinor: 0 } },
    });
  });
});

describe("InventoryMaterialService purchase receipt quota after a reversal (A-02)", () => {
  async function purchaseWithReversedReceipt() {
    const store = new MemoryLocalStore();
    const service = new InventoryMaterialService(store, () => "2026-08-23T09:00:00.000Z");
    const opened = await service.openMaterial({
      name: "قماش",
      unit: "meter",
      tracking: "tracked",
      opening: {
        quantityState: "unconfirmed",
        quantityMilli: null,
        costState: "unknown",
        valueMinor: null,
        confirmedOn: "2026-08-01",
        sourceNote: null,
      },
      note: "افتتاح",
      operationKey: "a02-material",
    });
    if (!opened.ok) throw new Error("material should open");
    const purchase = createSupplierPurchase({
      id: "a02-purchase",
      supplierName: "مورد القماش",
      note: "قماش",
      purchasedOn: "2026-08-01",
      dueOn: null,
      totalMinor: 10000,
      initialPaidMinor: 10000,
      recordedAt: "2026-08-23T09:00:00.000Z",
      idempotencyKey: "a02-purchase",
    });
    await store.saveSupplierPurchase(purchase);
    const receipt = await service.receivePurchase({
      materialId: opened.value.material.id,
      purchaseId: purchase.id,
      quantityMilli: 2000,
      valueMinor: 10000,
      occurredOn: "2026-08-02",
      note: "استلام كامل",
      operationKey: "a02-receipt",
    });
    if (!receipt.ok) throw new Error("receipt should save");
    const reversal = await service.reverse({
      movementId: receipt.value.id,
      reason: "استلام خاطئ",
      occurredOn: "2026-08-03",
      operationKey: "a02-reverse",
    });
    if (!reversal.ok) throw new Error("reversal should save");
    return { service, materialId: opened.value.material.id, purchaseId: purchase.id };
  }
  it("releases the full quota after the wrong receipt was reversed", async () => {
    const { service, materialId, purchaseId } = await purchaseWithReversedReceipt();
    const reReceipt = await service.receivePurchase({
      materialId,
      purchaseId,
      quantityMilli: 2000,
      valueMinor: 10000,
      occurredOn: "2026-08-04",
      note: "الاستلام الصحيح",
      operationKey: "a02-re-receipt",
    });
    expect(reReceipt).toMatchObject({ ok: true, value: { valueDeltaMinor: 10000 } });
  });
  it("still rejects receiving beyond the purchase total once the corrected receipt stands", async () => {
    const { service, materialId, purchaseId } = await purchaseWithReversedReceipt();
    await service.receivePurchase({
      materialId,
      purchaseId,
      quantityMilli: 2000,
      valueMinor: 10000,
      occurredOn: "2026-08-04",
      note: "الاستلام الصحيح",
      operationKey: "a02-re-receipt-2",
    });
    const beyond = await service.receivePurchase({
      materialId,
      purchaseId,
      quantityMilli: 100,
      valueMinor: 100,
      occurredOn: "2026-08-05",
      note: "تجاوز",
      operationKey: "a02-beyond",
    });
    expect(beyond).toMatchObject({ ok: false, code: "validation_error" });
  });
});

/* القرار ٩: تفعيل المخزون صريح مؤرّخ — الموضع غير نشط قبله، ولحظة التفعيل تُعرض،
 * والإرث الموجود يُقرأ من أقدم دليل لا من بوابة جديدة. */
describe("InventoryMaterialService activation (decision 9)", () => {
  it("reads an inactive position with an honest truth line when nothing was ever recorded", async () => {
    const service = new InventoryMaterialService(new MemoryLocalStore(), () => "2026-08-23T09:00:00.000Z");
    await expect(service.readActivation()).resolves.toMatchObject({
      ok: true,
      value: { activatedOn: null, source: null },
    });
  });

  it("activates explicitly with today's Amman date and keeps the moment idempotent", async () => {
    const store = new MemoryLocalStore();
    let timestamp = "2026-08-23T09:00:00.000Z";
    const service = new InventoryMaterialService(store, () => timestamp);
    const activated = await service.activate({ operationKey: "activation-1" });
    expect(activated).toMatchObject({
      ok: true,
      value: { activatedOn: "2026-08-23", operationKey: "activation-1" },
    });
    timestamp = "2026-08-24T09:00:00.000Z";
    const repeated = await service.activate({ operationKey: "activation-2" });
    expect(repeated).toMatchObject({ ok: true, reused: true, value: { activatedOn: "2026-08-23" } });
    await expect(service.readActivation()).resolves.toMatchObject({
      ok: true,
      value: { activatedOn: "2026-08-23", source: "declared" },
    });
  });

  it("derives an existing owner's management start from the earliest evidence instead of gating them", async () => {
    const store = new MemoryLocalStore();
    const service = new InventoryMaterialService(store, () => "2026-08-23T09:00:00.000Z");
    await service.openMaterial({
      name: "خشب",
      unit: "piece",
      tracking: "tracked",
      opening: {
        quantityState: "confirmed",
        quantityMilli: 10000,
        costState: "known",
        valueMinor: 4000,
        confirmedOn: "2026-08-01",
        sourceNote: null,
      },
      note: "افتتاح",
      operationKey: "material-legacy",
    });
    await expect(service.readActivation()).resolves.toMatchObject({
      ok: true,
      value: { activatedOn: "2026-08-01", source: "derived" },
    });
  });
});

describe("InventoryMaterialService extract remainder (decision 20, contract 11 amended)", () => {
  it("records the full remainder as a waste movement with its whole value and leaves an honest zero (acceptance #9)", async () => {
    const store = new MemoryLocalStore();
    const service = new InventoryMaterialService(store, () => "2026-08-30T09:00:00.000Z");
    const opened = await service.openMaterial({
      name: "فضة",
      unit: "kilogram",
      tracking: "tracked",
      opening: {
        quantityState: "confirmed",
        quantityMilli: 1000,
        costState: "known",
        valueMinor: 400,
        confirmedOn: "2026-08-01",
        sourceNote: null,
      },
      note: "افتتاح",
      operationKey: "silver-open",
    });
    if (!opened.ok) throw new Error("material should open");
    const extracted = await service.extractRemainder({
      materialId: opened.value.material.id,
      occurredOn: "2026-08-30",
      reason: "مادة تلفت بالكامل",
      operationKey: "extract-1",
    });
    expect(extracted).toMatchObject({
      ok: true,
      value: {
        type: "waste",
        quantityDeltaMilli: -1000,
        valueDeltaMinor: -400,
        reason: "مادة تلفت بالكامل",
        wasteContext: { kind: "general_project" },
      },
    });
    const overview = await service.overview();
    expect(overview).toMatchObject({
      ok: true,
      value: { materials: [{ quantityMilli: 0, valueMinor: 0 }] },
    });
    /* لا حذف: الحركات تحتفظ بالافتتاح والإخراج معًا. */
    const movements = await store.listInventoryMovements();
    if (!movements.ok) throw new Error("movements should read");
    expect(movements.value).toHaveLength(2);
  });

  it("serves the dust trap: after partial consumption the unrepresentable remainder leaves whole, never deleted", async () => {
    const store = new MemoryLocalStore();
    const service = new InventoryMaterialService(store, () => "2026-08-30T09:00:00.000Z");
    const opened = await service.openMaterial({
      name: "خيط",
      unit: "meter",
      tracking: "tracked",
      opening: {
        quantityState: "confirmed",
        quantityMilli: 1000,
        costState: "known",
        valueMinor: 300,
        confirmedOn: "2026-08-01",
        sourceNote: null,
      },
      note: "افتتاح",
      operationKey: "thread-open",
    });
    if (!opened.ok) throw new Error("material should open");
    const consumed = await service.waste({
      materialId: opened.value.material.id,
      quantityMilli: 990,
      occurredOn: "2026-08-30",
      note: "الجزء المستعمل",
      reason: "استعمال",
      operationKey: "thread-most",
    });
    if (!consumed.ok) throw new Error(consumed.message ?? "waste should save");
    /* الفتات: 10 أجزاء بـ3 فلسات — التوزيع الجزئي مرفوض والطريق المعلن إخراج المتبقي. */
    await expect(
      service.waste({
        materialId: opened.value.material.id,
        quantityMilli: 9,
        occurredOn: "2026-08-30",
        note: "فتات",
        reason: "اختبار الحد",
        operationKey: "thread-dust",
      }),
    ).resolves.toMatchObject({ ok: false, code: "validation_error" });
    const extracted = await service.extractRemainder({
      materialId: opened.value.material.id,
      occurredOn: "2026-08-30",
      reason: "فتات لا يمكن تمثيله",
      operationKey: "thread-extract",
    });
    expect(extracted).toMatchObject({
      ok: true,
      value: { type: "waste", quantityDeltaMilli: -10, valueDeltaMinor: -3 },
    });
    const overview = await service.overview();
    expect(overview).toMatchObject({
      ok: true,
      value: { materials: [{ quantityMilli: 0, valueMinor: 0 }] },
    });
  });

  it("requires a reason like any waste and refuses when nothing remains, and is idempotent by operation key", async () => {
    const store = new MemoryLocalStore();
    const service = new InventoryMaterialService(store, () => "2026-08-30T09:00:00.000Z");
    const opened = await service.openMaterial({
      name: "غراء",
      unit: "liter",
      tracking: "tracked",
      opening: {
        quantityState: "confirmed",
        quantityMilli: 500,
        costState: "known",
        valueMinor: 250,
        confirmedOn: "2026-08-01",
        sourceNote: null,
      },
      note: "افتتاح",
      operationKey: "glue-open",
    });
    if (!opened.ok) throw new Error("material should open");
    await expect(
      service.extractRemainder({
        materialId: opened.value.material.id,
        occurredOn: "2026-08-30",
        reason: "   ",
        operationKey: "glue-no-reason",
      }),
    ).resolves.toMatchObject({ ok: false, code: "validation_error" });
    const first = await service.extractRemainder({
      materialId: opened.value.material.id,
      occurredOn: "2026-08-30",
      reason: "جفّ بالكامل",
      operationKey: "glue-extract",
    });
    if (!first.ok) throw new Error(first.message ?? "extract should save");
    const repeated = await service.extractRemainder({
      materialId: opened.value.material.id,
      occurredOn: "2026-08-30",
      reason: "محاولة ثانية",
      operationKey: "glue-extract",
    });
    expect(repeated).toMatchObject({ ok: true, reused: true, value: { id: first.value.id } });
    await expect(
      service.extractRemainder({
        materialId: opened.value.material.id,
        occurredOn: "2026-08-30",
        reason: "لا متبقي",
        operationKey: "glue-empty",
      }),
    ).resolves.toMatchObject({ ok: false, code: "validation_error" });
  });
  it("SA-5 (F2): extracting the remainder refuses an untracked material — no balance to extract", async () => {
    const store = new MemoryLocalStore();
    const service = new InventoryMaterialService(store, () => "2026-09-06T09:00:00.000Z");
    const opened = await service.openMaterial({
      name: "أكياس",
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
      note: "للتكلفة فقط",
      operationKey: "f2-untracked-material",
    });
    if (!opened.ok) throw new Error("material should open");
    const extracted = await service.extractRemainder({
      materialId: opened.value.material.id,
      occurredOn: "2026-09-06",
      reason: "تلف",
      operationKey: "f2-extract",
    });
    expect(extracted).toMatchObject({ ok: false, code: "validation_error" });
    if (!extracted.ok) expect(extracted.message).toContain("غير متتبَّعة");
    /* لا حركة إطلاقًا على المادة غير المتتبَّعة. */
    const movements = await service.movements();
    if (!movements.ok) throw new Error(movements.message);
    expect(movements.value).toHaveLength(0);
  });
});

/* ── المجموعة ٢ (عقد ٢٨): المتابعة الانتقائية والاستلام والنقص — اختبارات الخدمة ── */
/* المجموعة ٢ (عقد ٢٨): مساعدات مشتركة لمجموعات الاختبار — على مستوى الوحدة. */
const NOW = () => "2026-09-06T09:00:00.000Z";
async function openTracked(
  service: InventoryMaterialService,
  input: {
    name: string;
    quantityMilli: number | null;
    valueMinor: number | null;
    confirmed: boolean;
    key: string;
  },
) {
  return service.openMaterial({
    name: input.name,
    unit: "kilogram",
    tracking: "tracked",
    opening: {
      quantityState: input.confirmed ? "confirmed" : "unconfirmed",
      quantityMilli: input.quantityMilli,
      costState: input.valueMinor !== null ? "known" : "unknown",
      valueMinor: input.valueMinor,
      confirmedOn: input.confirmed ? "2026-09-01" : null,
      sourceNote: "جرد",
    },
    note: "رصيد معلن",
    operationKey: input.key,
  });
}

describe("InventoryMaterialService — Group 2 selective tracking — cost-only materials (Scenario A)", () => {
  it("Scenario A: an untracked material keeps a reference identity with no balance and no hidden movement", async () => {
    const store = new MemoryLocalStore();
    const service = new InventoryMaterialService(store, NOW);
    const opened = await service.openMaterial({
      name: "أكياس تغليف",
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
      note: "مادة للتكلفة فقط",
      operationKey: "g2-scenario-a",
    });
    if (!opened.ok) throw new Error(opened.message);
    expect(opened.value.opening).toBeNull();
    const movements = await service.movements();
    if (!movements.ok) throw new Error(movements.message);
    expect(movements.value).toHaveLength(0);
    const overview = await service.overview();
    if (!overview.ok) throw new Error(overview.message);
    expect(overview.value.materials[0]?.tracking?.status).toBe("untracked");
    expect(overview.value.materials[0]?.quantityMilli).toBe(0);
    expect(overview.value.materials[0]?.quantityKnowledge).toBe("known");
  });
});

describe("InventoryMaterialService — Group 2 selective tracking — activation journeys (Scenarios A–C)", () => {
  it("Scenarios B & C: known opening writes a movement; unknown opening shows «unconfirmed», never zero", async () => {
    const store = new MemoryLocalStore();
    const service = new InventoryMaterialService(store, NOW);
    const known = await openTracked(service, {
      name: "سكر",
      quantityMilli: 20000,
      valueMinor: 12000,
      confirmed: true,
      key: "g2-known-opening",
    });
    if (!known.ok) throw new Error(known.message);
    expect(known.value.opening).not.toBeNull();
    expect(known.value.opening?.costKnowledge).toBe("known");
    const unknown = await openTracked(service, {
      name: "دقيق",
      quantityMilli: null,
      valueMinor: null,
      confirmed: false,
      key: "g2-unknown-opening",
    });
    if (!unknown.ok) throw new Error(unknown.message);
    expect(unknown.value.opening).toBeNull();
    const overview = await service.overview();
    if (!overview.ok) throw new Error(overview.message);
    const sugar = overview.value.materials.find(material => material.name === "سكر");
    const flour = overview.value.materials.find(material => material.name === "دقيق");
    expect(sugar?.quantityMilli).toBe(20000);
    expect(sugar?.quantityKnowledge).toBe("known");
    expect(flour?.quantityKnowledge).toBe("unconfirmed");
    expect(flour?.movementCount).toBe(0);
  });
  it("an unknown-cost opening writes a zero value marked unknown, and consuming it stays a marked zero", async () => {
    const store = new MemoryLocalStore();
    const service = new InventoryMaterialService(store, NOW);
    const opened = await openTracked(service, {
      name: "ملح",
      quantityMilli: 5000,
      valueMinor: null,
      confirmed: true,
      key: "g2-unknown-cost",
    });
    if (!opened.ok) throw new Error(opened.message);
    expect(opened.value.opening?.valueDeltaMinor).toBe(0);
    expect(opened.value.opening?.costKnowledge).toBe("unknown");
    const consumed = await service.consume({
      materialId: opened.value.material.id,
      orderId: null,
      reason: "تجربة وصفة",
      quantityMilli: 2000,
      occurredOn: "2026-09-03",
      note: "استهلاك بلا تكلفة معلومة",
      operationKey: "g2-consume-unknown",
    });
    if (!consumed.ok) throw new Error(consumed.message);
    expect(consumed.value.valueDeltaMinor).toBe(0);
    expect(consumed.value.costKnowledge).toBe("unknown");
    const overview = await service.overview();
    if (!overview.ok) throw new Error(overview.message);
    expect(overview.value.materials[0]?.costKnowledge).toBe("unknown");
  });
});

describe("InventoryMaterialService — Group 2 selective tracking — purchase-to-receipt bridge (Scenarios D–F)", () => {
  it("Scenario D & E & F: purchase stays financial; explicit receipt is prefilled and partial receipts reconcile", async () => {
    const store = new MemoryLocalStore();
    const service = new InventoryMaterialService(store, NOW);
    const opened = await openTracked(service, {
      name: "خشب",
      quantityMilli: 0,
      valueMinor: null,
      confirmed: true,
      key: "g2-bridge-material",
    });
    if (!opened.ok) throw new Error(opened.message);
    await store.saveSupplierPurchase(
      createSupplierPurchase({
        id: "g2-purchase",
        supplierName: "مورد الخشب",
        note: "خشب زان",
        purchasedOn: "2026-09-02",
        dueOn: null,
        totalMinor: 10000,
        initialPaidMinor: 5000,
        recordedAt: "2026-09-02T00:00:00.000Z",
        idempotencyKey: "g2-purchase-key",
        materialId: opened.value.material.id,
        expectedQuantityMilli: 10000,
      }),
    );
    /* D: الشراء وحده لا يزيد المخزون. */
    let overview = await service.overview();
    if (!overview.ok) throw new Error(overview.message);
    expect(overview.value.materials[0]?.quantityMilli).toBe(0);
    let status = await service.purchaseReceiptStatus("g2-purchase");
    if (!status.ok || !status.value) throw new Error("status should read");
    expect(status.value.receivedValueMinor).toBe(0);
    expect(status.value.remainingValueMinor).toBe(10000);
    expect(status.value.remainingQuantityMilli).toBe(10000);
    /* F: استلام جزئي متعمد. */
    const first = await service.receivePurchase({
      materialId: opened.value.material.id,
      purchaseId: "g2-purchase",
      quantityMilli: 4000,
      valueMinor: 4000,
      occurredOn: "2026-09-04",
      note: "استلام الجزء الأول",
      operationKey: "g2-receipt-1",
    });
    if (!first.ok) throw new Error(first.message);
    status = await service.purchaseReceiptStatus("g2-purchase");
    if (!status.ok || !status.value) throw new Error("status should read");
    expect(status.value.receivedValueMinor).toBe(4000);
    expect(status.value.remainingValueMinor).toBe(6000);
    expect(status.value.remainingQuantityMilli).toBe(6000);
    /* التجاوز فوق المتوقع مرفوض بصدق. */
    await expect(
      service.receivePurchase({
        materialId: opened.value.material.id,
        purchaseId: "g2-purchase",
        quantityMilli: 7000,
        valueMinor: 6000,
        occurredOn: "2026-09-05",
        note: "تجاوز",
        operationKey: "g2-receipt-over",
      }),
    ).resolves.toMatchObject({ ok: false, code: "validation_error" });
    /* الشراء المرتبط بمادة تُستلم عليها. */
    await store.saveSupplierPurchase(
      createSupplierPurchase({
        id: "g2-purchase-2",
        supplierName: "مورد آخر",
        note: "مادة أخرى",
        purchasedOn: "2026-09-02",
        dueOn: null,
        totalMinor: 3000,
        initialPaidMinor: 0,
        recordedAt: "2026-09-02T00:00:00.000Z",
        idempotencyKey: "g2-purchase-2-key",
        materialId: "material-other",
        expectedQuantityMilli: null,
      }),
    );
    await expect(
      service.receivePurchase({
        materialId: opened.value.material.id,
        purchaseId: "g2-purchase-2",
        quantityMilli: 1000,
        valueMinor: 1000,
        occurredOn: "2026-09-05",
        note: "مادة مختلفة",
        operationKey: "g2-receipt-wrong-material",
      }),
    ).resolves.toMatchObject({ ok: false, code: "validation_error" });
    /* بانتظار الاستلام يظهر على المادة (عقد ١١). */
    overview = await service.overview();
    if (!overview.ok) throw new Error(overview.message);
    expect(overview.value.materials[0]?.awaitingReceiptPurchaseCount).toBe(1);
    expect(overview.value.materials[0]?.awaitingReceiptRemainingMinor).toBe(6000);
  });
});

describe("InventoryMaterialService — Group 2 selective tracking — consumption without order (Scenario H)", () => {
  it("Scenario H: deliberate project consumption without an order carries a reason and idempotency", async () => {
    const store = new MemoryLocalStore();
    const service = new InventoryMaterialService(store, NOW);
    const opened = await openTracked(service, {
      name: "غراء",
      quantityMilli: 2000,
      valueMinor: 800,
      confirmed: true,
      key: "g2-project-material",
    });
    if (!opened.ok) throw new Error(opened.message);
    const consumed = await service.consume({
      materialId: opened.value.material.id,
      orderId: null,
      reason: "تجربة لون لطلب قادم",
      quantityMilli: 500,
      occurredOn: "2026-09-05",
      note: "استهلاك مشروع",
      operationKey: "g2-project-consume",
    });
    if (!consumed.ok) throw new Error(consumed.message);
    expect(consumed.value.orderId).toBeNull();
    expect(consumed.value.reason).toBe("تجربة لون لطلب قادم");
    const repeated = await service.consume({
      materialId: opened.value.material.id,
      orderId: null,
      reason: "تجربة لون لطلب قادم",
      quantityMilli: 500,
      occurredOn: "2026-09-05",
      note: "استهلاك مشروع",
      operationKey: "g2-project-consume",
    });
    expect(repeated).toMatchObject({ ok: true, reused: true });
    await expect(
      service.consume({
        materialId: opened.value.material.id,
        orderId: null,
        reason: "  ",
        quantityMilli: 100,
        occurredOn: "2026-09-05",
        note: "بلا بيان",
        operationKey: "g2-project-blank",
      }),
    ).resolves.toMatchObject({ ok: false, code: "validation_error" });
  });
});

describe("InventoryMaterialService — Group 2 selective tracking — shortage policy (Scenario I)", () => {
  it("Scenario I: shortage policy — record, partial-consume atomically, resolve explicitly, never negative", async () => {
    const store = new MemoryLocalStore();
    const service = new InventoryMaterialService(store, NOW);
    const opened = await openTracked(service, {
      name: "مسمار",
      quantityMilli: 6000,
      valueMinor: 2400,
      confirmed: true,
      key: "g2-shortage-material",
    });
    if (!opened.ok) throw new Error(opened.message);
    const materialId = opened.value.material.id;
    /* الاستهلاك فوق المتاح مرفوض (الدستور: لا رصيد سالب). */
    await expect(
      service.consume({
        materialId,
        orderId: null,
        reason: "طلب كبير",
        quantityMilli: 10000,
        occurredOn: "2026-09-06",
        note: "محاولة تجاوز",
        operationKey: "g2-over-consume",
      }),
    ).resolves.toMatchObject({ ok: false, code: "validation_error" });
    /* استهلاك المتاح + توثيق النقص في حفظ ذرّي واحد. */
    const partial = await service.consumeWithShortage({
      materialId,
      orderId: null,
      reason: "طلب كبير",
      quantityMilli: 10000,
      occurredOn: "2026-09-06",
      note: "استهلاك المتاح والباقي نقص",
      operationKey: "g2-partial",
    });
    if (!partial.ok) throw new Error(partial.message);
    expect(partial.value.movement?.quantityDeltaMilli).toBe(-6000);
    expect(partial.value.shortage.shortageQuantityMilli).toBe(4000);
    expect(partial.value.shortage.status).toBe("open");
    const overview = await service.overview();
    if (!overview.ok) throw new Error(overview.message);
    expect(overview.value.materials[0]?.quantityMilli).toBe(0);
    expect(overview.value.materials[0]?.openShortageCount).toBe(1);
    /* تكرار الإرسال آمن (SA-5): المفتاح نفسه يعيد الحركة والنقص كما هما — لا ازدواج. */
    const partialAgain = await service.consumeWithShortage({
      materialId,
      orderId: null,
      reason: "طلب كبير",
      quantityMilli: 10000,
      occurredOn: "2026-09-06",
      note: "إرسال مكرر",
      operationKey: "g2-partial",
    });
    expect(partialAgain).toMatchObject({
      ok: true,
      reused: true,
      value: { shortage: { id: partial.value.shortage.id } },
    });
    const shortagesAfter = await service.shortages();
    if (!shortagesAfter.ok) throw new Error(shortagesAfter.message);
    expect(shortagesAfter.value).toHaveLength(1);
    const movementsAfterRepeat = await service.movements();
    if (!movementsAfterRepeat.ok) throw new Error(movementsAfterRepeat.message);
    expect(
      movementsAfterRepeat.value.filter(movement => movement.operationKey === "g2-partial"),
    ).toHaveLength(1);
    /* الحل صريح، والتكرار idempotent. */
    const resolved = await service.resolveShortage({
      shortageId: partial.value.shortage.id,
      resolutionNote: "استلمت بديلًا من المورد",
      resolvedOn: "2026-09-08",
    });
    if (!resolved.ok) throw new Error(resolved.message);
    expect(resolved.value.status).toBe("resolved");
    const resolvedAgain = await service.resolveShortage({
      shortageId: partial.value.shortage.id,
      resolutionNote: "مرة أخرى",
      resolvedOn: "2026-09-09",
    });
    expect(resolvedAgain).toMatchObject({ ok: true, reused: true });
    /* سجل نقص لكمية متوفرة مرفوض — ليست نقصًا. */
    const replenished = await service.adjust({
      materialId,
      quantityDeltaMilli: 5000,
      valueMinorWhenIncrease: 2000,
      occurredOn: "2026-09-10",
      note: "استلام بديل",
      reason: "بديل النقص",
      operationKey: "g2-replenish",
    });
    if (!replenished.ok) throw new Error(replenished.message);
    await expect(
      service.recordShortage({
        materialId,
        requestedQuantityMilli: 3000,
        orderId: null,
        occurredOn: "2026-09-10",
        note: "متوفر فعلًا",
        operationKey: "g2-fake-shortage",
      }),
    ).resolves.toMatchObject({ ok: false, code: "validation_error" });
  });
});

describe("InventoryMaterialService — Group 2 selective tracking — untrack/retrack lifecycle (Scenario K)", () => {
  it("Scenario K: untracking states consequences, preserves history, and retrack returns unconfirmed", async () => {
    const store = new MemoryLocalStore();
    const service = new InventoryMaterialService(store, NOW);
    const opened = await openTracked(service, {
      name: "قماش",
      quantityMilli: 3000,
      valueMinor: 1500,
      confirmed: true,
      key: "g2-untrack-material",
    });
    if (!opened.ok) throw new Error(opened.message);
    const materialId = opened.value.material.id;
    const untracked = await service.untrackMaterial({ materialId, reason: null, operationKey: "g2-untrack" });
    if (!untracked.ok) throw new Error(untracked.message);
    expect(untracked.value.tracking?.status).toBe("untracked");
    /* التاريخ محفوظ — لا حذف. */
    const movements = await service.movements();
    if (!movements.ok) throw new Error(movements.message);
    expect(movements.value).toHaveLength(1);
    /* حركة جديدة على مادة غير متتبَّعة مرفوضة بصدق. */
    await expect(
      service.waste({
        materialId,
        quantityMilli: 500,
        occurredOn: "2026-09-07",
        note: "هدر بعد الإيقاف",
        reason: "تلف",
        operationKey: "g2-waste-after-untrack",
      }),
    ).resolves.toMatchObject({ ok: false, code: "validation_error" });
    const repeatedUntrack = await service.untrackMaterial({
      materialId,
      reason: null,
      operationKey: "g2-untrack-2",
    });
    expect(repeatedUntrack).toMatchObject({ ok: true, reused: true });
    /* إعادة التفعيل: الرصيد يعود «غير محدد بعد». */
    const retracked = await service.retrackMaterial({ materialId, operationKey: "g2-retrack" });
    if (!retracked.ok) throw new Error(retracked.message);
    expect(retracked.value.tracking?.status).toBe("tracked");
    expect(retracked.value.opening?.quantityState).toBe("unconfirmed");
    const overview = await service.overview();
    if (!overview.ok) throw new Error(overview.message);
    expect(overview.value.materials[0]?.quantityKnowledge).toBe("unconfirmed");
    expect(overview.value.materials[0]?.quantityMilli).toBe(3000);
  });
  it("confirmMaterialOpening: equal, increase-as-first-movement, and derived decrease branches", async () => {
    const store = new MemoryLocalStore();
    const service = new InventoryMaterialService(store, NOW);
    /* مادة غير محددة البداية ثم تأكيد رصيد معلوم — أول حركة بداية. */
    const opened = await service.openMaterial({
      name: "طلاء",
      unit: "liter",
      tracking: "tracked",
      opening: {
        quantityState: "unconfirmed",
        quantityMilli: null,
        costState: "unknown",
        valueMinor: null,
        confirmedOn: null,
        sourceNote: null,
      },
      note: "بلا رصيد معروف",
      operationKey: "g2-confirm-material",
    });
    if (!opened.ok) throw new Error(opened.message);
    const materialId = opened.value.material.id;
    const confirmed = await service.confirmMaterialOpening({
      materialId,
      actualQuantityMilli: 8000,
      costKnown: true,
      valueMinor: 3200,
      occurredOn: "2026-09-09",
      note: "تأكيد جرد",
      sourceNote: "جرد",
      operationKey: "g2-confirm-1",
    });
    if (!confirmed.ok) throw new Error(confirmed.message);
    expect(confirmed.value.movement?.type).toBe("opening");
    expect(confirmed.value.material.opening?.quantityState).toBe("confirmed");
    /* تأكيد نفس الرقم بلا فرق — بلا حركة. */
    const equal = await service.confirmMaterialOpening({
      materialId,
      actualQuantityMilli: 8000,
      costKnown: true,
      valueMinor: 3200,
      occurredOn: "2026-09-10",
      note: "لا فرق",
      sourceNote: "جرد ثانية",
      operationKey: "g2-confirm-equal",
    });
    if (!equal.ok) throw new Error(equal.message);
    expect(equal.value.movement).toBeNull();
    /* تأكيد أقل — ضبط مشتق القيمة. */
    const lower = await service.confirmMaterialOpening({
      materialId,
      actualQuantityMilli: 6000,
      costKnown: false,
      valueMinor: null,
      occurredOn: "2026-09-11",
      note: "جرد أقل",
      sourceNote: "جرد",
      operationKey: "g2-confirm-lower",
    });
    if (!lower.ok) throw new Error(lower.message);
    expect(lower.value.movement?.type).toBe("adjustment");
    expect(lower.value.movement?.quantityDeltaMilli).toBe(-2000);
    expect(lower.value.movement?.valueDeltaMinor).toBe(-800);
    const overview = await service.overview();
    if (!overview.ok) throw new Error(overview.message);
    expect(overview.value.materials[0]?.quantityMilli).toBe(6000);
  });
});

describe("InventoryMaterialService — Group 2 selective tracking — reads and effect-free surfaces", () => {
  it("Scenario J: waste stays non-cash and the period summary flags unknown cost honestly", async () => {
    const store = new MemoryLocalStore();
    const service = new InventoryMaterialService(store, NOW);
    const opened = await openTracked(service, {
      name: "خيط",
      quantityMilli: 4000,
      valueMinor: 1000,
      confirmed: true,
      key: "g2-waste-material",
    });
    if (!opened.ok) throw new Error(opened.message);
    const wasted = await service.waste({
      materialId: opened.value.material.id,
      quantityMilli: 1000,
      occurredOn: "2026-09-06",
      note: "هدر قص",
      reason: "قص خاطئ",
      operationKey: "g2-waste-1",
    });
    if (!wasted.ok) throw new Error(wasted.message);
    /* لا حدث مالي أبدًا من حركة الهدر. */
    const events = await store.listFinancialEvents();
    if (!events.ok) throw new Error(events.message);
    expect(events.value).toHaveLength(0);
    const summary = await service.readPeriodWaste("2026-09-01", "2026-09-30");
    if (!summary.ok) throw new Error(summary.message);
    expect(summary.value).toMatchObject({ count: 1, valueMinor: 250, hasUnknownCost: false });
    const emptyMonth = await service.readPeriodWaste("2026-08-01", "2026-08-31");
    if (!emptyMonth.ok) throw new Error(emptyMonth.message);
    expect(emptyMonth.value.count).toBe(0);
  });
  it("references serve only tracked materials for movement editors, and positions drive shortage warnings", async () => {
    const store = new MemoryLocalStore();
    const service = new InventoryMaterialService(store, NOW);
    const tracked = await openTracked(service, {
      name: "خشب",
      quantityMilli: 5000,
      valueMinor: 2000,
      confirmed: true,
      key: "g2-ref-tracked",
    });
    if (!tracked.ok) throw new Error(tracked.message);
    const untracked = await service.openMaterial({
      name: "أكياس",
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
      note: "للتكلفة",
      operationKey: "g2-ref-untracked",
    });
    if (!untracked.ok) throw new Error(untracked.message);
    const references = await service.references();
    if (!references.ok) throw new Error(references.message);
    expect(references.value.materials.map(material => material.name)).toEqual(["خشب"]);
    expect(references.value.allMaterials).toHaveLength(2);
    expect(references.value.materialPositions[0]).toMatchObject({
      materialId: tracked.value.material.id,
      quantityMilli: 5000,
      valueMinor: 2000,
      costKnowledge: "known",
    });
  });
});
