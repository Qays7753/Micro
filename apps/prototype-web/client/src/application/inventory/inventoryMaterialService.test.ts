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
      openingQuantityMilli: 10000,
      openingValueMinor: 4000,
      occurredOn: "2026-08-01",
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
        truth: expect.stringContaining("ليست مصروفًا"),
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
      openingQuantityMilli: 1000,
      openingValueMinor: 500,
      occurredOn: "2026-08-01",
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
      openingQuantityMilli: 10000,
      openingValueMinor: 4000,
      occurredOn: "2026-08-01",
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
      openingQuantityMilli: 0,
      openingValueMinor: 0,
      occurredOn: "2026-08-01",
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
      openingQuantityMilli: 10000,
      openingValueMinor: 4000,
      occurredOn: "2026-08-01",
      note: "افتتاح",
      operationKey: "material-legacy",
    });
    await expect(service.readActivation()).resolves.toMatchObject({
      ok: true,
      value: { activatedOn: "2026-08-01", source: "derived" },
    });
  });
});
