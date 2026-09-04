import { describe, expect, it } from "vitest";
import { SupplierPurchaseService } from "./supplierPurchaseService";
import { ProjectFinancialService } from "@/application/finance/projectFinancialService";
import { MemoryLocalStore } from "@/storage/local/MemoryLocalStore";
import { InventoryMaterialService } from "@/application/inventory/inventoryMaterialService";

const now = () => "2026-08-23T09:00:00.000Z";
describe("SupplierPurchaseService", () => {
  it("records a partly paid material purchase in cash and payables without operating expense", async () => {
    const store = new MemoryLocalStore();
    const purchases = new SupplierPurchaseService(store, now);
    const finance = new ProjectFinancialService(store, now);
    const purchase = await purchases.recordPurchase({
      supplierName: "مورد الخشب",
      note: "مواد لطلبات قادمة",
      purchasedOn: "2026-08-23",
      dueOn: "2026-08-30",
      totalMinor: 4000,
      initialPaidMinor: 1500,
      idempotencyKey: "purchase-1",
    });
    if (!purchase.ok) throw new Error("purchase should save");
    expect(purchase.value).toMatchObject({ paidMinor: 1500, payableMinor: 2500, status: "partially_paid" });
    await expect(finance.readPosition()).resolves.toMatchObject({
      ok: true,
      value: { recordedCashMinor: -1500, supplierPayablesMinor: 2500, operatingExpensesRecordedMinor: 0 },
    });
    await expect(finance.readRecordedPeriodResult("2026-08-01", "2026-08-31")).resolves.toMatchObject({
      ok: true,
      value: { recordedOperatingExpenseMinor: 0, resultMinor: 0, status: "recorded_only" },
    });
  });

  it("settles a purchase by partial payments once and rejects overpayment", async () => {
    const store = new MemoryLocalStore();
    const purchases = new SupplierPurchaseService(store, now);
    const finance = new ProjectFinancialService(store, now);
    const purchase = await purchases.recordPurchase({
      supplierName: "مورد القماش",
      note: "مواد",
      purchasedOn: "2026-08-20",
      dueOn: null,
      totalMinor: 2500,
      initialPaidMinor: 0,
      idempotencyKey: "purchase-2",
    });
    if (!purchase.ok) throw new Error("purchase should save");
    await expect(
      purchases.recordPayment({
        purchaseId: purchase.value.id,
        amountMinor: 1000,
        occurredOn: "2026-08-21",
        note: "دفعة أولى",
        idempotencyKey: "payment-1",
      }),
    ).resolves.toMatchObject({ ok: true, value: { payableMinor: 1500, status: "partially_paid" } });
    await expect(
      purchases.recordPayment({
        purchaseId: purchase.value.id,
        amountMinor: 1000,
        occurredOn: "2026-08-21",
        note: "إعادة",
        idempotencyKey: "payment-1",
      }),
    ).resolves.toMatchObject({ ok: true, reused: true });
    await expect(
      purchases.recordPayment({
        purchaseId: purchase.value.id,
        amountMinor: 1600,
        occurredOn: "2026-08-22",
        note: "زائد",
        idempotencyKey: "payment-too-much",
      }),
    ).resolves.toMatchObject({ ok: false, code: "validation_error" });
    await expect(
      purchases.recordPayment({
        purchaseId: purchase.value.id,
        amountMinor: 1500,
        occurredOn: "2026-08-22",
        note: "الدفعة الأخيرة",
        idempotencyKey: "payment-2",
      }),
    ).resolves.toMatchObject({ ok: true, value: { payableMinor: 0, status: "paid" } });
    await expect(finance.readPosition()).resolves.toMatchObject({
      ok: true,
      value: { recordedCashMinor: -2500, supplierPayablesMinor: 0, operatingExpensesRecordedMinor: 0 },
    });
  });
});

/* ── المجموعة ٢ (عقد ٢٨ / SA-5 F4): حارسا تعديل الشراء مقابل الاستلام ── */
describe("SupplierPurchaseService — Group 2 material link and receipt guards", () => {
  const NOW = () => "2026-09-06T09:00:00.000Z";
  it("records the material link and expected quantity on create, and the before-values in the edit revision", async () => {
    const store = new MemoryLocalStore();
    const service = new SupplierPurchaseService(store, NOW);
    const created = await service.recordPurchase({
      supplierName: "مورد الخشب",
      note: "خشب زان",
      purchasedOn: "2026-09-02",
      dueOn: null,
      totalMinor: 10000,
      initialPaidMinor: 0,
      idempotencyKey: "g2-link-create",
      materialId: "material-wood",
      expectedQuantityMilli: 10000,
    });
    if (!created.ok) throw new Error(created.message);
    expect(created.value.materialId).toBe("material-wood");
    expect(created.value.expectedQuantityMilli).toBe(10000);
    const edited = await service.editPurchase({
      purchaseId: created.value.id,
      supplierName: "مورد الخشب",
      note: "خشب زان — فاتورة مصححة",
      purchasedOn: "2026-09-02",
      dueOn: null,
      totalMinor: 12000,
      initialPaidMinor: 0,
      reason: "فاتورة مصححة",
      idempotencyKey: "g2-link-edit",
      materialId: "material-wood",
      expectedQuantityMilli: 12000,
    });
    if (!edited.ok) throw new Error(edited.message);
    const revision = edited.value.revisions?.[0];
    expect(revision?.beforeMaterialId).toBe("material-wood");
    expect(revision?.beforeExpectedQuantityMilli).toBe(10000);
    expect(edited.value.expectedQuantityMilli).toBe(12000);
    const repeated = await service.editPurchase({
      purchaseId: created.value.id,
      supplierName: "مورد الخشب",
      note: "مرة أخرى",
      purchasedOn: "2026-09-02",
      dueOn: null,
      totalMinor: 12000,
      initialPaidMinor: 0,
      reason: "تكرار",
      idempotencyKey: "g2-link-edit",
      materialId: "material-wood",
      expectedQuantityMilli: 12000,
    });
    expect(repeated).toMatchObject({ ok: true, reused: true });
  });
  it("rejects editing the total below the documented received value (R7)", async () => {
    const store = new MemoryLocalStore();
    const service = new SupplierPurchaseService(store, NOW);
    const inventory = new InventoryMaterialService(store, NOW);
    const opened = await inventory.openMaterial({
      name: "خشب",
      unit: "piece",
      tracking: "tracked",
      opening: {
        quantityState: "unconfirmed",
        quantityMilli: null,
        costState: "unknown",
        valueMinor: null,
        confirmedOn: null,
        sourceNote: null,
      },
      note: "بلا رصيد",
      operationKey: "g2-guard-material",
    });
    if (!opened.ok) throw new Error(opened.message);
    const created = await service.recordPurchase({
      supplierName: "مورد",
      note: "شراء",
      purchasedOn: "2026-09-02",
      dueOn: null,
      totalMinor: 10000,
      initialPaidMinor: 0,
      idempotencyKey: "g2-guard-create",
      materialId: opened.value.material.id,
      expectedQuantityMilli: 10000,
    });
    if (!created.ok) throw new Error(created.message);
    const received = await inventory.receivePurchase({
      materialId: opened.value.material.id,
      purchaseId: created.value.id,
      quantityMilli: 5000,
      valueMinor: 4000,
      occurredOn: "2026-09-03",
      note: "استلام جزئي",
      operationKey: "g2-guard-receipt",
    });
    if (!received.ok) throw new Error(received.message);
    await expect(
      service.editPurchase({
        purchaseId: created.value.id,
        supplierName: "مورد",
        note: "أقل من المستلم",
        purchasedOn: "2026-09-02",
        dueOn: null,
        totalMinor: 3000,
        initialPaidMinor: 0,
        reason: "خطأ",
        idempotencyKey: "g2-guard-low-total",
        materialId: opened.value.material.id,
        expectedQuantityMilli: 10000,
      }),
    ).resolves.toMatchObject({ ok: false, code: "validation_error" });
    await expect(
      service.editPurchase({
        purchaseId: created.value.id,
        supplierName: "مورد",
        note: "أقل كمية",
        purchasedOn: "2026-09-02",
        dueOn: null,
        totalMinor: 10000,
        initialPaidMinor: 0,
        reason: "خطأ كمية",
        idempotencyKey: "g2-guard-low-qty",
        materialId: opened.value.material.id,
        expectedQuantityMilli: 4000,
      }),
    ).resolves.toMatchObject({ ok: false, code: "validation_error" });
  });
  it("rejects changing or clearing the material link while receipts stand on it (SA-5 F3)", async () => {
    const store = new MemoryLocalStore();
    const service = new SupplierPurchaseService(store, NOW);
    const inventory = new InventoryMaterialService(store, NOW);
    const opened = await inventory.openMaterial({
      name: "خيط",
      unit: "meter",
      tracking: "tracked",
      opening: {
        quantityState: "unconfirmed",
        quantityMilli: null,
        costState: "unknown",
        valueMinor: null,
        confirmedOn: null,
        sourceNote: null,
      },
      note: "بلا رصيد",
      operationKey: "g2-f3-material",
    });
    if (!opened.ok) throw new Error(opened.message);
    const created = await service.recordPurchase({
      supplierName: "مورد الخيط",
      note: "خيط",
      purchasedOn: "2026-09-02",
      dueOn: null,
      totalMinor: 5000,
      initialPaidMinor: 0,
      idempotencyKey: "g2-f3-create",
      materialId: opened.value.material.id,
      expectedQuantityMilli: 2000,
    });
    if (!created.ok) throw new Error(created.message);
    const received = await inventory.receivePurchase({
      materialId: opened.value.material.id,
      purchaseId: created.value.id,
      quantityMilli: 1000,
      valueMinor: 2500,
      occurredOn: "2026-09-03",
      note: "استلام",
      operationKey: "g2-f3-receipt",
    });
    if (!received.ok) throw new Error(received.message);
    await expect(
      service.editPurchase({
        purchaseId: created.value.id,
        supplierName: "مورد الخيط",
        note: "ربط آخر",
        purchasedOn: "2026-09-02",
        dueOn: null,
        totalMinor: 5000,
        initialPaidMinor: 0,
        reason: "تغيير الربط",
        idempotencyKey: "g2-f3-relink",
        materialId: "material-other",
        expectedQuantityMilli: 2000,
      }),
    ).resolves.toMatchObject({ ok: false, code: "validation_error" });
    await expect(
      service.editPurchase({
        purchaseId: created.value.id,
        supplierName: "مورد الخيط",
        note: "إفراغ الربط",
        purchasedOn: "2026-09-02",
        dueOn: null,
        totalMinor: 5000,
        initialPaidMinor: 0,
        reason: "إفراغ",
        idempotencyKey: "g2-f3-unlink",
        materialId: null,
        expectedQuantityMilli: 2000,
      }),
    ).resolves.toMatchObject({ ok: false, code: "validation_error" });
    /* بلا إيصالات: تغيير الربط مسموح. */
    const created2 = await service.recordPurchase({
      supplierName: "مورد آخر",
      note: "شراء ثانٍ",
      purchasedOn: "2026-09-04",
      dueOn: null,
      totalMinor: 3000,
      initialPaidMinor: 0,
      idempotencyKey: "g2-f3-create-2",
      materialId: "material-other",
      expectedQuantityMilli: null,
    });
    if (!created2.ok) throw new Error(created2.message);
    const relinked = await service.editPurchase({
      purchaseId: created2.value.id,
      supplierName: "مورد آخر",
      note: "ربط جديد",
      purchasedOn: "2026-09-04",
      dueOn: null,
      totalMinor: 3000,
      initialPaidMinor: 0,
      reason: "ربط",
      idempotencyKey: "g2-f3-relink-2",
      materialId: opened.value.material.id,
      expectedQuantityMilli: 1000,
    });
    if (!relinked.ok) throw new Error(relinked.message);
    expect(relinked.value.materialId).toBe(opened.value.material.id);
  });
});
