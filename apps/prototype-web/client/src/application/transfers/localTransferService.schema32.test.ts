import { describe, expect, it } from "vitest";
import { LocalTransferService } from "./localTransferService";
import { InventoryMaterialService } from "@/application/inventory/inventoryMaterialService";
import { MemoryLocalStore } from "@/storage/local/MemoryLocalStore";
import { localExportVersion, localSchemaVersion } from "@/storage/local/types";
import type { FinancialEvent } from "@micro-domain/financial-event/index.js";

const now = () => "2026-09-06T09:00:00.000Z";

/* المجموعة ٢ (عقد ٢٨ — المخزون الانتقائي): عقد التصدير ٢٤/مخطط ٣٢.
 * قرار المتابعة ومعرفة البداية ووسم التكلفة وسجلات النقص وربط الشراء تعبر دورة
 * التصدير-التحقق-الاستيراد كاملة؛ وملفات الموجة السابقة (٢٣/٣١) تُقبل وتُهاجر
 * بغياب الحقول (null/[]) بلا تعبئة افتراضية ولا اختراع حالة. */

describe("schema 32 export round-trip with selective inventory", () => {
  it("round-trips tracked, untracked, unknown-cost, shortage, and purchase-link records verbatim", async () => {
    const store = new MemoryLocalStore();
    const inventory = new InventoryMaterialService(store, now);
    /* مادة متتبَّعة برصيد معروف. */
    const sugar = await inventory.openMaterial({
      name: "سكر",
      unit: "kilogram",
      tracking: "tracked",
      opening: {
        quantityState: "confirmed",
        quantityMilli: 20000,
        costState: "known",
        valueMinor: 12000,
        confirmedOn: "2026-09-01",
        sourceNote: "فاتورة",
      },
      note: "رصيد معلن",
      operationKey: "g2-rt-sugar",
    });
    if (!sugar.ok) throw new Error(sugar.message);
    /* مادة متتبَّعة برصيد مجهول الكمية. */
    const flour = await inventory.openMaterial({
      name: "دقيق",
      unit: "kilogram",
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
      operationKey: "g2-rt-flour",
    });
    if (!flour.ok) throw new Error(flour.message);
    /* مادة غير متتبَّعة (للتكلفة فقط). */
    const bags = await inventory.openMaterial({
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
      note: "للتكلفة فقط",
      operationKey: "g2-rt-bags",
    });
    if (!bags.ok) throw new Error(bags.message);
    /* شراء مربوط بمادة وكمية متوقعة. */
    const purchase = await store.saveSupplierPurchase({
      id: "g2-rt-purchase",
      supplierName: "مورد السكر",
      note: "سكر أبيض",
      purchasedOn: "2026-09-02",
      dueOn: null,
      totalMinor: 9000,
      paidMinor: 0,
      payableMinor: 9000,
      status: "unpaid",
      idempotencyKey: "g2-rt-purchase-key",
      payments: [],
      materialId: sugar.value.material.id,
      expectedQuantityMilli: 15000,
      createdAt: "2026-09-02T00:00:00.000Z",
      updatedAt: "2026-09-02T00:00:00.000Z",
    });
    if (!purchase.ok) throw new Error(purchase.message);
    /* استلام بتكلفة معروفة + استهلاك مشروع + هدر — بتواريخ متسلسلة. */
    const receipt = await inventory.receivePurchase({
      materialId: sugar.value.material.id,
      purchaseId: "g2-rt-purchase",
      quantityMilli: 5000,
      valueMinor: 3000,
      occurredOn: "2026-09-03",
      note: "استلام أول",
      operationKey: "g2-rt-receipt",
    });
    if (!receipt.ok) throw new Error(receipt.message);
    const shortage = await inventory.recordShortage({
      materialId: sugar.value.material.id,
      requestedQuantityMilli: 30000,
      orderId: null,
      occurredOn: "2026-09-05",
      note: "نقص لتجربة طلبي",
      operationKey: "g2-rt-shortage",
    });
    if (!shortage.ok) throw new Error(shortage.message);
    const transfers = new LocalTransferService(store, now);
    const verified = await transfers.createVerifiedExport();
    if (!verified.ok) throw new Error(verified.message);
    expect(verified.value.file.version).toBe(localExportVersion);
    expect(verified.value.file.schemaVersion).toBe(localSchemaVersion);
    /* المجموعة ٣ (عقد D3): زوج الإصدار انتقل إلى ٢٥/٣٣ مع حقول ربط المنتج
     * بالبيع — السلوك المدقق نفسه يبقى على الزوج الحي. */
    expect(verified.value.file.version).toBe(25);
    expect(verified.value.file.schemaVersion).toBe(33);
    expect(verified.value.summary).toMatchObject({ materials: 3, inventoryShortages: 1 });

    const target = new MemoryLocalStore();
    const targetTransfers = new LocalTransferService(target, now);
    const prepared = targetTransfers.prepareImport(JSON.stringify(verified.value.file));
    if (!prepared.ok) throw new Error(prepared.message);
    const confirmed = await targetTransfers.confirmImport(prepared.value);
    if (!confirmed.ok) throw new Error(confirmed.message);
    const restored = new InventoryMaterialService(target, now);
    const overview = await restored.overview();
    if (!overview.ok) throw new Error(overview.message);
    const sugarBack = overview.value.materials.find(material => material.name === "سكر");
    const flourBack = overview.value.materials.find(material => material.name === "دقيق");
    const bagsBack = overview.value.materials.find(material => material.name === "أكياس تغليف");
    expect(sugarBack?.tracking?.status).toBe("tracked");
    expect(sugarBack?.quantityMilli).toBe(25000);
    expect(sugarBack?.quantityKnowledge).toBe("known");
    expect(flourBack?.quantityKnowledge).toBe("unconfirmed");
    expect(bagsBack?.tracking?.status).toBe("untracked");
    expect(bagsBack?.quantityKnowledge).toBe("known");
    const shortages = await restored.shortages();
    if (!shortages.ok) throw new Error(shortages.message);
    expect(shortages.value[0]).toMatchObject({
      status: "open",
      shortageQuantityMilli: 5000,
      note: "نقص لتجربة طلبي",
    });
    const purchases = await target.listSupplierPurchases();
    if (!purchases.ok) throw new Error(purchases.message);
    expect(purchases.value[0]).toMatchObject({
      materialId: sugar.value.material.id,
      expectedQuantityMilli: 15000,
    });
    const status = await restored.purchaseReceiptStatus("g2-rt-purchase");
    if (!status.ok || !status.value) throw new Error("receipt status should read");
    expect(status.value.remainingQuantityMilli).toBe(10000);
  });
  it("accepts and migrates a legacy 23/31 export: absent fields become null/[], never invented", async () => {
    const store = new MemoryLocalStore();
    const inventory = new InventoryMaterialService(store, now);
    const opened = await inventory.openMaterial({
      name: "خشب",
      unit: "piece",
      tracking: "tracked",
      opening: {
        quantityState: "confirmed",
        quantityMilli: 10000,
        costState: "known",
        valueMinor: 4000,
        confirmedOn: "2026-09-01",
        sourceNote: "جرد",
      },
      note: "رصيد",
      operationKey: "g2-legacy-material",
    });
    if (!opened.ok) throw new Error(opened.message);
    const consumed = await inventory.consume({
      materialId: opened.value.material.id,
      orderId: null,
      reason: "استهلاك مشروع",
      quantityMilli: 2000,
      occurredOn: "2026-09-04",
      note: "استهلاك",
      operationKey: "g2-legacy-consume",
    });
    if (!consumed.ok) throw new Error(consumed.message);
    const transfers = new LocalTransferService(store, now);
    const current = await transfers.createExport();
    if (!current.ok) throw new Error(current.message);
    /* محاكاة ملف الموجة السابقة: ٢٣/٣١ بلا حقول المجموعة ٢ أصلًا. */
    const legacyFile = JSON.parse(JSON.stringify(current.value)) as {
      version: number;
      schemaVersion: number;
      data: Record<string, unknown>;
    };
    legacyFile.version = 23;
    legacyFile.schemaVersion = 31;
    for (const material of legacyFile.data.materials as Record<string, unknown>[]) {
      delete material.tracking;
      delete material.opening;
    }
    for (const movement of legacyFile.data.inventoryMovements as Record<string, unknown>[]) {
      delete movement.costKnowledge;
    }
    delete legacyFile.data.inventoryShortages;
    const prepared = new LocalTransferService(new MemoryLocalStore(), now).prepareImport(
      JSON.stringify(legacyFile),
    );
    if (!prepared.ok) throw new Error(prepared.message);
    expect(prepared.value.file.version).toBe(localExportVersion);
    expect(prepared.value.file.schemaVersion).toBe(localSchemaVersion);
    const materials = prepared.value.file.data.materials;
    expect(materials?.[0]?.tracking).toBeNull();
    expect(materials?.[0]?.opening).toBeNull();
    const movements = prepared.value.file.data.inventoryMovements;
    expect(movements?.[0]?.costKnowledge).toBe("known");
    expect(prepared.value.file.data.inventoryShortages).toEqual([]);
    /* الإرث يقرأ متتبَّعًا ومعروفًا — لا إنذارات كاذبة ولا اختراع حالة. */
    const target = new MemoryLocalStore();
    const targetTransfers = new LocalTransferService(target, now);
    const confirmed = await targetTransfers.confirmImport(prepared.value);
    if (!confirmed.ok) throw new Error(confirmed.message);
    const overview = await new InventoryMaterialService(target, now).overview();
    if (!overview.ok) throw new Error(overview.message);
    expect(overview.value.materials[0]?.quantityKnowledge).toBe("known");
    expect(overview.value.materials[0]?.costKnowledge).toBe("known");
  });
  it("rejects contradictory knowledge state and dangling shortage references — store untouched", async () => {
    const store = new MemoryLocalStore();
    const inventory = new InventoryMaterialService(store, now);
    const opened = await inventory.openMaterial({
      name: "غراء",
      unit: "piece",
      tracking: "tracked",
      opening: {
        quantityState: "confirmed",
        quantityMilli: 1000,
        costState: "known",
        valueMinor: 500,
        confirmedOn: "2026-09-01",
        sourceNote: null,
      },
      note: "رصيد",
      operationKey: "g2-reject-material",
    });
    if (!opened.ok) throw new Error(opened.message);
    const consumed = await inventory.consume({
      materialId: opened.value.material.id,
      orderId: null,
      reason: "استهلاك مشروع",
      quantityMilli: 200,
      occurredOn: "2026-09-04",
      note: "استهلاك",
      operationKey: "g2-reject-consume",
    });
    if (!consumed.ok) throw new Error(consumed.message);
    await store.saveSupplierPurchase({
      id: "g2-reject-purchase",
      supplierName: "مورد",
      note: "شراء مربوط",
      purchasedOn: "2026-09-04",
      dueOn: null,
      totalMinor: 2000,
      paidMinor: 0,
      payableMinor: 2000,
      status: "unpaid",
      idempotencyKey: "g2-reject-purchase-key",
      payments: [],
      materialId: opened.value.material.id,
      expectedQuantityMilli: 500,
      createdAt: "2026-09-04T00:00:00.000Z",
      updatedAt: "2026-09-04T00:00:00.000Z",
    });
    const transfers = new LocalTransferService(store, now);
    const current = await transfers.createExport();
    if (!current.ok) throw new Error(current.message);
    /* قيمة صفرية بلا وسم «غير معروفة» — رفض (نستهدف حركة الاستهلاك بنوعها). */
    const zeroUnknown = JSON.parse(JSON.stringify(current.value));
    const zeroTarget = (zeroUnknown.data.inventoryMovements as Record<string, unknown>[]).find(
      movement => movement.type === "consumption",
    )!;
    zeroTarget.valueDeltaMinor = 0;
    expect(
      new LocalTransferService(new MemoryLocalStore(), now).prepareImport(JSON.stringify(zeroUnknown)).ok,
    ).toBe(false);
    /* سجل نقص لمادة غير موجودة — رفض. */
    const danglingShortage = JSON.parse(JSON.stringify(current.value));
    danglingShortage.data.inventoryShortages = [
      {
        id: "fake-shortage",
        materialId: "ghost-material",
        requestedQuantityMilli: 10,
        availableQuantityMilli: 0,
        shortageQuantityMilli: 10,
        occurredOn: "2026-09-05",
        recordedAt: "2026-09-05T00:00:00.000Z",
        note: "مادة وهمية",
        orderId: null,
        operationKey: "fake-shortage",
        status: "open",
        resolvedOn: null,
        resolutionNote: null,
      },
    ];
    expect(
      new LocalTransferService(new MemoryLocalStore(), now).prepareImport(JSON.stringify(danglingShortage))
        .ok,
    ).toBe(false);
    /* استهلاك بلا طلب ولا بيان — رفض. */
    const orderless = JSON.parse(JSON.stringify(current.value));
    const orderlessTarget = (orderless.data.inventoryMovements as Record<string, unknown>[]).find(
      movement => movement.type === "consumption",
    )!;
    orderlessTarget.reason = null;
    expect(
      new LocalTransferService(new MemoryLocalStore(), now).prepareImport(JSON.stringify(orderless)).ok,
    ).toBe(false);
    /* SA-5 (F8): طيّ سالب مرفوض — الاستيراد قوي كالكتابة. */
    const negativeFold = JSON.parse(JSON.stringify(current.value));
    const foldTarget = (negativeFold.data.inventoryMovements as Record<string, unknown>[]).find(
      movement => movement.type === "opening",
    )!;
    foldTarget.valueDeltaMinor = 600;
    const openingQty = foldTarget.quantityDeltaMilli as number;
    const consumeTarget2 = (negativeFold.data.inventoryMovements as Record<string, unknown>[]).find(
      movement => movement.type === "consumption",
    )!;
    consumeTarget2.quantityDeltaMilli = -(openingQty + 100);
    consumeTarget2.valueDeltaMinor = -600;
    expect(
      new LocalTransferService(new MemoryLocalStore(), now).prepareImport(JSON.stringify(negativeFold)).ok,
    ).toBe(false);
    /* SA-5 (F8): مرآة معرفة التكلفة في التراجع — وسم متناقض يُرفض. */
    const mirrorMismatch = JSON.parse(JSON.stringify(current.value));
    const mirrored = (mirrorMismatch.data.inventoryMovements as Record<string, unknown>[]).find(
      movement => movement.type === "consumption",
    )!;
    mirrored.costKnowledge = "unknown";
    expect(
      new LocalTransferService(new MemoryLocalStore(), now).prepareImport(JSON.stringify(mirrorMismatch)).ok,
    ).toBe(false);
    /* SA-5 (F8): شراء بمادة معلقة — رفض. */
    const danglingPurchase = JSON.parse(JSON.stringify(current.value));
    (danglingPurchase.data.supplierPurchases as Record<string, unknown>[])[0]!.materialId = "ghost-material";
    expect(
      new LocalTransferService(new MemoryLocalStore(), now).prepareImport(JSON.stringify(danglingPurchase)).ok,
    ).toBe(false);
    /* فشل التحضير لا يلمس بيانات المصدر. */
    const events = await store.listFinancialEvents();
    if (!events.ok) throw new Error(events.message);
    expect(events.value).toHaveLength(0);
    const materials = await store.listMaterials();
    if (!materials.ok) throw new Error(materials.message);
    expect(materials.value).toHaveLength(1);
  });
});
