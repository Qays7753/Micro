import "fake-indexeddb/auto";
import { afterEach, describe, expect, it } from "vitest";
import { MemoryLocalStore } from "@/storage/local/MemoryLocalStore";
import { IndexedDbLocalStore } from "@/storage/local/IndexedDbLocalStore";
import type { PrototypeLocalStore } from "@/storage/local/types";
import { SupplierPurchaseService } from "./supplierPurchaseService";
import { InventoryMaterialService } from "@/application/inventory/inventoryMaterialService";
import { LocalTransferService } from "@/application/transfers/localTransferService";
import { summarizeCashContinuity } from "@micro-domain/cash-continuity/index.js";
import type { SupplierPurchaseLine } from "@micro-domain/supplier-purchase/index.js";

/* S07 (UNIT-027/UNIT-028 — DOC-016): سلوك بنود الشراء ومعالجة الاعتراف على
 * المهايئين معًا — شراء واحد بغرض واحد، ودفع لا يثبت استلامًا واستلام لا
 * يثبت دفعًا، وحدود البنود حية داخل حد الكتابة، وترحيل الإرث متوافق بلا
 * إعادة تصنيف رجعية، وتصحيح فوق توابع قائمة يُرفض بسبب صادق. */

const NOW = "2026-10-30T08:00:00.000Z";
const DATABASE_NAME = "micro-prototype-local";

function clearDatabase(): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    const request = indexedDB.deleteDatabase(DATABASE_NAME);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
    request.onblocked = () => resolve();
  });
}

type StoreFactory = () => Promise<PrototypeLocalStore> | PrototypeLocalStore;

const adapters: ReadonlyArray<{ readonly label: string; readonly make: StoreFactory }> = [
  { label: "Memory", make: () => new MemoryLocalStore() },
  {
    label: "IndexedDB",
    make: async () => {
      await clearDatabase();
      return new IndexedDbLocalStore();
    },
  },
];

async function seedTrackedMaterial(store: PrototypeLocalStore, id: string) {
  const inventory = new InventoryMaterialService(store, () => NOW);
  const created = await inventory.openMaterial({
    name: "قماش قطني",
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
    note: "مادة متتبعة للاختبار",
    operationKey: `material-${id}-open`,
  });
  if (!created.ok) throw new Error(created.message);
  return created.value.material;
}

async function openWalletForTests(store: PrototypeLocalStore, id: string, openingMinor: number) {
  const { CashContinuityService } = await import("@/application/cash/cashContinuityService");
  const cash = new CashContinuityService(store, () => NOW);
  const opened = await cash.openWallet({
    name: `محفظة ${id}`,
    kind: "cash_drawer",
    openingMinor,
    occurredOn: "2026-10-01",
    note: "افتتاح للاختبار",
    operationKey: `wallet-${id}-open`,
  });
  if (!opened.ok) throw new Error(opened.message);
  return { walletId: opened.value.wallet.id };
}

const periodLine = (overrides: Partial<SupplierPurchaseLine> = {}): SupplierPurchaseLine => ({
  lineId: "pl-1",
  materialId: null,
  expectedQuantityMilli: null,
  valueMinor: 10_000,
  costKnowledge: "known",
  treatment: "period_material",
  ...overrides,
});

for (const adapter of adapters) {
  describe(`S07 — بنود الشراء ومعالجة الاعتراف (${adapter.label})`, () => {
    afterEach(async () => {
      if (adapter.label === "IndexedDB") await clearDatabase();
    });

    it("أبسط شراء مدفوع بلا مورد يُسجَّل ببند فترة ضمني واحد — تكلفة الفترة مرة على فترة الشراء لا من الدفع", async () => {
      const store = await adapter.make();
      const service = new SupplierPurchaseService(store, () => NOW);
      const result = await service.recordPurchase({
        supplierName: null,
        supplierPartyId: null,
        note: "طحين للمخبز",
        purchasedOn: "2026-10-10",
        dueOn: null,
        totalMinor: 10_000,
        initialPaidMinor: 10_000,
        idempotencyKey: "s7-simple-1",
        materialId: null,
        expectedQuantityMilli: null,
        lines: [periodLine()],
      });
      if (!result.ok) throw new Error(result.message);
      expect(result.value.status).toBe("paid");
      expect(result.value.lines?.length).toBe(1);
      expect(result.value.lines?.[0]?.treatment).toBe("period_material");
      expect(result.value.lines?.[0]?.valueMinor).toBe(10_000);
      /* الدفع يخفض كاش المحفظة مرة (تخصيص واحد سالب) ولا ينشئ مصروفًا ثانيًا. */
      const cash = await openWalletForTests(store, "s7-simple", 20_000);
      const walletPaid = await service.recordPurchase({
        supplierName: null,
        supplierPartyId: null,
        note: "شراء من المحفظة",
        purchasedOn: "2026-10-11",
        dueOn: null,
        totalMinor: 6_000,
        initialPaidMinor: 6_000,
        idempotencyKey: "s7-simple-2",
        materialId: null,
        expectedQuantityMilli: null,
        lines: [periodLine({ valueMinor: 6_000 })],
        initialPaymentWalletId: cash.walletId,
      });
      if (!walletPaid.ok) throw new Error(walletPaid.message);
      const entries = await store.listCashContinuityEntries();
      if (!entries.ok) throw new Error(entries.message);
      expect(summarizeCashContinuity(entries.value.filter(entry => entry.walletId === cash.walletId))).toBe(
        20_000 - 6_000,
      );
    });

    it("شراء متتبع 12 دفع 4: نقد −4 والتزام 8، ولا تكلفة فترة من الشراء وحده (SDF-033)", async () => {
      const store = await adapter.make();
      const material = await seedTrackedMaterial(store, "s7-tracked");
      const service = new SupplierPurchaseService(store, () => NOW);
      const result = await service.recordPurchase({
        supplierName: "مؤسسة النسيج",
        supplierPartyId: null,
        note: "قماش قطني",
        purchasedOn: "2026-10-10",
        dueOn: null,
        totalMinor: 12_000,
        initialPaidMinor: 4_000,
        idempotencyKey: "s7-tracked-1",
        materialId: material.id,
        expectedQuantityMilli: 6_000,
        lines: [
          {
            lineId: "pl-1",
            materialId: material.id,
            expectedQuantityMilli: 6_000,
            valueMinor: 12_000,
            costKnowledge: "known",
            treatment: "tracked_material",
          },
        ],
      });
      if (!result.ok) throw new Error(result.message);
      expect(result.value.status).toBe("partially_paid");
      expect(result.value.payableMinor).toBe(8_000);
      expect(result.value.lines?.[0]?.treatment).toBe("tracked_material");
      /* نقد −4 من محفظة معلومة (تخصيص واحد) — والالتزام 8. */
      const cash = await openWalletForTests(store, "s7-tracked", 20_000);
      const walletPaid = await service.recordPurchase({
        supplierName: "مؤسسة النسيج",
        supplierPartyId: null,
        note: "قماش قطني",
        purchasedOn: "2026-10-10",
        dueOn: null,
        totalMinor: 12_000,
        initialPaidMinor: 4_000,
        idempotencyKey: "s7-tracked-2",
        materialId: material.id,
        expectedQuantityMilli: 6_000,
        lines: [
          {
            lineId: "pl-1",
            materialId: material.id,
            expectedQuantityMilli: 6_000,
            valueMinor: 12_000,
            costKnowledge: "known",
            treatment: "tracked_material",
          },
        ],
        initialPaymentWalletId: cash.walletId,
      });
      if (!walletPaid.ok) throw new Error(walletPaid.message);
      const entries = await store.listCashContinuityEntries();
      if (!entries.ok) throw new Error(entries.message);
      expect(summarizeCashContinuity(entries.value.filter(entry => entry.walletId === cash.walletId))).toBe(
        20_000 - 4_000,
      );
    });

    it("بند متتبع بمادة غير متتبعة يُرفض عند حد الكتابة — لا جسر استلام فوقه ولا ازدواج اعتراف", async () => {
      const store = await adapter.make();
      const service = new SupplierPurchaseService(store, () => NOW);
      const untrackedMaterial = await new InventoryMaterialService(store, () => NOW).openMaterial({
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
        note: "مادة غير متتبعة",
        operationKey: "material-s7-untracked-open",
      });
      if (!untrackedMaterial.ok) throw new Error(untrackedMaterial.message);
      const rejected = await service.recordPurchase({
        supplierName: null,
        supplierPartyId: null,
        note: "بند متتبع فوق مادة غير متتبعة",
        purchasedOn: "2026-10-10",
        dueOn: null,
        totalMinor: 5_000,
        initialPaidMinor: 0,
        idempotencyKey: "s7-mismatch-1",
        materialId: null,
        expectedQuantityMilli: null,
        lines: [
          {
            lineId: "pl-1",
            materialId: untrackedMaterial.value.material.id,
            expectedQuantityMilli: null,
            valueMinor: 5_000,
            costKnowledge: "known",
            treatment: "tracked_material",
          },
        ],
      });
      expect(rejected.ok).toBe(false);
      if (!rejected.ok) expect(rejected.message).toContain("المادة غير متتبَّعة");
      const purchases = await store.listSupplierPurchases();
      if (!purchases.ok) throw new Error(purchases.message);
      expect(purchases.value).toHaveLength(0);
      /* والعكس: بند فترة فوق مادة متتبعة يُرفض (ازدواج اعتراف). */
      const tracked = await seedTrackedMaterial(store, "s7-tracked-2");
      const rejectedReverse = await service.recordPurchase({
        supplierName: null,
        supplierPartyId: null,
        note: "بند فترة فوق مادة متتبعة",
        purchasedOn: "2026-10-10",
        dueOn: null,
        totalMinor: 5_000,
        initialPaidMinor: 0,
        idempotencyKey: "s7-mismatch-2",
        materialId: null,
        expectedQuantityMilli: null,
        lines: [
          {
            lineId: "pl-1",
            materialId: tracked.id,
            expectedQuantityMilli: null,
            valueMinor: 5_000,
            costKnowledge: "known",
            treatment: "period_material",
          },
        ],
      });
      expect(rejectedReverse.ok).toBe(false);
      if (!rejectedReverse.ok) expect(rejectedReverse.message).toContain("المادة متتبَّعة");
    });

    it("فاتورة 30 ببندين (10 فترة + 20 متتبع): رأس واحد وحدود بنود حية داخل حد الكتابة (SDF-067)", async () => {
      const store = await adapter.make();
      const material = await seedTrackedMaterial(store, "s7-mixed");
      const service = new SupplierPurchaseService(store, () => NOW);
      const result = await service.recordPurchase({
        supplierName: null,
        supplierPartyId: null,
        note: "فاتورة بندىن",
        supplierName: "مؤسسة النسيج",
        purchasedOn: "2026-10-10",
        dueOn: null,
        totalMinor: 30_000,
        initialPaidMinor: 0,
        idempotencyKey: "s7-mixed-1",
        materialId: null,
        expectedQuantityMilli: null,
        lines: [
          {
            lineId: "pl-1",
            materialId: null,
            expectedQuantityMilli: null,
            valueMinor: 10_000,
            costKnowledge: "known",
            treatment: "period_material",
          },
          {
            lineId: "pl-2",
            materialId: material.id,
            expectedQuantityMilli: 5_000,
            valueMinor: 20_000,
            costKnowledge: "known",
            treatment: "tracked_material",
          },
        ],
      });
      if (!result.ok) throw new Error(result.message);
      expect(result.value.lines?.length).toBe(2);
      expect(result.value.status).toBe("unpaid");
      /* القيم المعلومة لا تتجاوز الإجمالي؛ والتجاوز يُرفض قبل أي كتابة. */
      const over = await service.recordPurchase({
        supplierName: null,
        supplierPartyId: null,
        note: "بنود فوق الإجمالي",
        supplierName: "مؤسسة النسيج",
        purchasedOn: "2026-10-10",
        dueOn: null,
        totalMinor: 25_000,
        initialPaidMinor: 0,
        idempotencyKey: "s7-over-1",
        materialId: null,
        expectedQuantityMilli: null,
        lines: [
          {
            lineId: "pl-1",
            materialId: null,
            expectedQuantityMilli: null,
            valueMinor: 20_000,
            costKnowledge: "known",
            treatment: "period_material",
          },
          {
            lineId: "pl-2",
            materialId: null,
            expectedQuantityMilli: null,
            valueMinor: 20_000,
            costKnowledge: "known",
            treatment: "period_material",
          },
        ],
      });
      expect(over.ok).toBe(false);
      if (!over.ok) expect(over.message).toContain("يتجاوز إجمالي الشراء");
    });

    it("الدفع لا يثبت الاستلام والاستلام لا يثبت الدفع — والاستلام مقيد ببند حي بحدوده", async () => {
      const store = await adapter.make();
      const material = await seedTrackedMaterial(store, "s7-receipt");
      const suppliers = new SupplierPurchaseService(store, () => NOW);
      const inventory = new InventoryMaterialService(store, () => NOW);
      const purchase = await suppliers.recordPurchase({
        supplierName: null,
        supplierPartyId: null,
        note: "قماش للستائر",
        supplierName: "مؤسسة النسيج",
        purchasedOn: "2026-10-10",
        dueOn: null,
        /* فاتورة 20: بند متتبع بقيمة 10 معلومة + جزء غير موزّع ليس تكلفة. */
        totalMinor: 20_000,
        initialPaidMinor: 5_000,
        idempotencyKey: "s7-receipt-1",
        materialId: material.id,
        expectedQuantityMilli: 4_000,
        lines: [
          {
            lineId: "pl-1",
            materialId: material.id,
            expectedQuantityMilli: 4_000,
            valueMinor: 10_000,
            costKnowledge: "known",
            treatment: "tracked_material",
          },
        ],
      });
      if (!purchase.ok) throw new Error(purchase.message);
      /* الشراء بلا بنود مرجع بند: رفض صريح قبل أي كتابة. */
      const noLine = await inventory.receivePurchase({
        materialId: material.id,
        purchaseId: purchase.value.id,
        purchaseLineId: null,
        quantityMilli: 1_000,
        valueMinor: 5_000,
        occurredOn: "2026-10-11",
        note: "استلام بلا بند",
        operationKey: "s7-receipt-noline",
      });
      expect(noLine.ok).toBe(false);
      if (!noLine.ok) expect(noLine.ok ? "" : noLine.message).toContain("اختر البند الذي تستلم عليه");
      /* الاستلام الصريح على البند بحدوده. */
      const receipt = await inventory.receivePurchase({
        materialId: material.id,
        purchaseId: purchase.value.id,
        purchaseLineId: "pl-1",
        quantityMilli: 1_500,
        valueMinor: 5_000,
        occurredOn: "2026-10-11",
        note: "استلام أولية",
        operationKey: "s7-receipt-ok",
      });
      if (!receipt.ok) throw new Error(receipt.message);
      /* الاستلام لم يسدد ولم يغير الدفع: الحالة المالية كما هي. */
      const after = await store.getSupplierPurchase(purchase.value.id);
      if (!after.ok || !after.value) throw new Error("شراء مفقود");
      expect(after.value.paidMinor).toBe(5_000);
      expect(after.value.status).toBe("partially_paid");
      /* الحدود الحية: قيمة فوق قيمة البند وكمية فوق متوقعه تُرفض. */
      const overValue = await inventory.receivePurchase({
        materialId: material.id,
        purchaseId: purchase.value.id,
        purchaseLineId: "pl-1",
        quantityMilli: 500,
        valueMinor: 6_000,
        occurredOn: "2026-10-12",
        note: "قيمة فوق البند",
        operationKey: "s7-receipt-over-value",
      });
      expect(overValue.ok).toBe(false);
      if (!overValue.ok) expect(overValue.message).toContain("تتجاوز قيمة البند المعلومة");
      const overQuantity = await inventory.receivePurchase({
        materialId: material.id,
        purchaseId: purchase.value.id,
        purchaseLineId: "pl-1",
        quantityMilli: 3_500,
        valueMinor: 1_000,
        occurredOn: "2026-10-12",
        note: "كمية فوق المتوقع",
        operationKey: "s7-receipt-over-quantity",
      });
      expect(overQuantity.ok).toBe(false);
      if (!overQuantity.ok) expect(overQuantity.message).toContain("الكمية المتوقعة لهذا البند");
      /* بند فترة لا يستلم مخزونًا فوق تكلفة قائمة (§10.3): المادة غير
       * المتتبعة سُجلت بند فترة، ثم فعّل المالك متابعتها لاحقًا — البند
       * بقي قراره المؤرخ (فترة) فلا يُستلم فوق تكلفة قائمة بلا تصحيح
       * اعتراف موثق. */
      const untrackedMaterial = await new InventoryMaterialService(store, () => NOW).openMaterial({
        name: "طحين الخبز",
        unit: "kilogram",
        tracking: "untracked",
        opening: {
          quantityState: "unconfirmed",
          quantityMilli: null,
          costState: "unknown",
          valueMinor: null,
          confirmedOn: null,
          sourceNote: null,
        },
        note: "طحين غير متتبع",
        operationKey: "material-s7-period-open",
      });
      if (!untrackedMaterial.ok) throw new Error(untrackedMaterial.message);
      const periodPurchase = await suppliers.recordPurchase({
        supplierName: null,
        supplierPartyId: null,
        note: "طحين فترة",
        purchasedOn: "2026-10-10",
        dueOn: null,
        totalMinor: 10_000,
        initialPaidMinor: 10_000,
        idempotencyKey: "s7-period-1",
        materialId: untrackedMaterial.value.material.id,
        expectedQuantityMilli: null,
        lines: [
          {
            lineId: "pl-1",
            materialId: untrackedMaterial.value.material.id,
            expectedQuantityMilli: null,
            valueMinor: 10_000,
            costKnowledge: "known",
            treatment: "period_material",
          },
        ],
      });
      if (!periodPurchase.ok) throw new Error(periodPurchase.message);
      const retracked = await inventory.retrackMaterial({
        materialId: untrackedMaterial.value.material.id,
        note: "تفعيل المتابعة لاحقًا",
        operationKey: "material-s7-period-retrack",
      });
      if (!retracked.ok) throw new Error(retracked.message);
      const periodReceipt = await inventory.receivePurchase({
        materialId: untrackedMaterial.value.material.id,
        purchaseId: periodPurchase.value.id,
        purchaseLineId: "pl-1",
        quantityMilli: 100,
        valueMinor: 500,
        occurredOn: "2026-10-11",
        note: "استلام فوق بند فترة",
        operationKey: "s7-receipt-period",
      });
      expect(periodReceipt.ok).toBe(false);
      if (!periodReceipt.ok) expect(periodReceipt.message).toContain("محمّل تكلفته على فترة الشراء");
    });

    it("تصحيح شراء له استلام قائم على بنوده يُرفض بسبب صادق — لا كتابة جزئية (SDF-071)", async () => {
      const store = await adapter.make();
      const material = await seedTrackedMaterial(store, "s7-edit");
      const suppliers = new SupplierPurchaseService(store, () => NOW);
      const inventory = new InventoryMaterialService(store, () => NOW);
      const purchase = await suppliers.recordPurchase({
        supplierName: null,
        supplierPartyId: null,
        note: "قماش",
        supplierName: "مؤسسة النسيج",
        purchasedOn: "2026-10-10",
        dueOn: null,
        totalMinor: 20_000,
        initialPaidMinor: 0,
        idempotencyKey: "s7-edit-1",
        materialId: material.id,
        expectedQuantityMilli: 4_000,
        lines: [
          {
            lineId: "pl-1",
            materialId: material.id,
            expectedQuantityMilli: 4_000,
            valueMinor: 20_000,
            costKnowledge: "known",
            treatment: "tracked_material",
          },
        ],
      });
      if (!purchase.ok) throw new Error(purchase.message);
      const receipt = await inventory.receivePurchase({
        materialId: material.id,
        purchaseId: purchase.value.id,
        purchaseLineId: "pl-1",
        quantityMilli: 1_000,
        valueMinor: 5_000,
        occurredOn: "2026-10-11",
        note: "استلام قائم",
        operationKey: "s7-edit-receipt",
      });
      if (!receipt.ok) throw new Error(receipt.message);
      const edit = await suppliers.editPurchase({
        purchaseId: purchase.value.id,
        supplierName: null,
        supplierPartyId: null,
        note: "قماش معدل",
        purchasedOn: "2026-10-10",
        dueOn: null,
        totalMinor: 25_000,
        initialPaidMinor: 0,
        reason: "تصحيح الإجمالي",
        idempotencyKey: "s7-edit-2",
        materialId: material.id,
        expectedQuantityMilli: 4_000,
        lines: [
          {
            lineId: "pl-1",
            materialId: material.id,
            expectedQuantityMilli: 4_000,
            valueMinor: 25_000,
            costKnowledge: "known",
            treatment: "tracked_material",
          },
        ],
      });
      expect(edit.ok).toBe(false);
      if (!edit.ok) expect(edit.message).toContain("إيصالات استلام قائمة");
    });

    it("ترحيل شراء إرثي أحادي البند وله دفعتان: نفس الهوية والدفعات بلا حدث جديد (SDF-044)", async () => {
      const store = await adapter.make();
      const suppliers = new SupplierPurchaseService(store, () => NOW);
      const legacyMaterial = await seedTrackedMaterial(store, "s7-legacy-material");
      const created = await suppliers.recordPurchase({
        supplierName: "مؤسسة النسيج",
        supplierPartyId: null,
        note: "قماش إرثي",
        purchasedOn: "2026-09-10",
        dueOn: null,
        totalMinor: 30_000,
        initialPaidMinor: 10_000,
        idempotencyKey: "s7-legacy-1",
        materialId: legacyMaterial.id,
        expectedQuantityMilli: 3_000,
        /* الإرث بلا بنود — ربط رأس فقط. */
        lines: null,
      });
      if (!created.ok) throw new Error(created.message);
      const paid = await suppliers.recordPayment({
        purchaseId: created.value.id,
        amountMinor: 20_000,
        occurredOn: "2026-09-25",
        note: "دفعة لاحقة",
        idempotencyKey: "s7-legacy-pay-1",
        walletId: null,
      });
      if (!paid.ok) throw new Error(paid.message);
      expect(paid.value.payments.length).toBe(2);
      /* دورة كاملة: التصدير الموثق → الوارد → الاستعادة → إعادة التصدير. */
      const transfers = new LocalTransferService(store, () => NOW);
      const exported = await transfers.createVerifiedExport();
      if (!exported.ok) throw new Error(exported.message);
      const target = new MemoryLocalStore();
      const targetTransfers = new LocalTransferService(target, () => NOW);
      const prepared = await targetTransfers.prepareRestore(JSON.stringify(exported.value.file));
      if (!prepared.ok) throw new Error(prepared.message);
      const confirmed = await targetTransfers.confirmImport(prepared.value);
      if (!confirmed.ok) throw new Error(confirmed.message);
      const reExported = await targetTransfers.createExport();
      if (!reExported.ok) throw new Error(reExported.message);
      const roundTripped = reExported.value.data.supplierPurchases.find(p => p.id === created.value.id);
      if (!roundTripped) throw new Error("الشراء لم يعبر الدورة");
      /* الهوية والدفعات والتواريخ كما هي؛ لا شراء أو دفع أو استلام جديد. */
      expect(roundTripped.payments.length).toBe(2);
      /* المقارنة على السجل بعد الدفعة اللاحقة (paid.value) — created.value
       * لقطة قبلها. */
      expect(roundTripped.payments.map(p => p.id)).toEqual(paid.value.payments.map(p => p.id));
      expect(roundTripped.payments.map(p => p.occurredOn)).toEqual(
        paid.value.payments.map(p => p.occurredOn),
      );
      expect(roundTripped.materialId).toBe(legacyMaterial.id);
      expect(roundTripped.expectedQuantityMilli).toBe(3_000);
      /* الإرث بلا بنود يبقى بلا بنود (لا يُخترع بند من فراغ ولا يُعاد تصنيفه). */
      expect(roundTripped.lines ?? null).toBeNull();
      expect(reExported.value.data.supplierPurchases.filter(p => p.id !== created.value.id)).toHaveLength(0);
      const events = await target.listFinancialEvents();
      if (!events.ok) throw new Error(events.message);
      expect(events.value.filter(event => event.correctionType === null)).toHaveLength(0);
    });

    it("المسدد كاملًا بلا مورد ببند فترة يعبر الدورة الكاملة — وغير المسدد بلا تعريف يُرفض بالأسبقية (SDF-010)", async () => {
      const store = await adapter.make();
      const suppliers = new SupplierPurchaseService(store, () => NOW);
      const paid = await suppliers.recordPurchase({
        supplierName: null,
        supplierPartyId: null,
        note: "أدوات تغليف",
        purchasedOn: "2026-10-10",
        dueOn: null,
        totalMinor: 8_000,
        initialPaidMinor: 8_000,
        idempotencyKey: "s7-nosupplier-1",
        materialId: null,
        expectedQuantityMilli: null,
        lines: [periodLine({ valueMinor: 8_000 })],
      });
      if (!paid.ok) throw new Error(paid.message);
      expect(paid.value.supplierName).toBeNull();
      const transfers = new LocalTransferService(store, () => NOW);
      const exported = await transfers.createVerifiedExport();
      if (!exported.ok) throw new Error(exported.message);
      const target = new MemoryLocalStore();
      const targetTransfers = new LocalTransferService(target, () => NOW);
      const prepared = await targetTransfers.prepareRestore(JSON.stringify(exported.value.file));
      if (!prepared.ok) throw new Error(prepared.message);
      const confirmed = await targetTransfers.confirmImport(prepared.value);
      if (!confirmed.ok) throw new Error(confirmed.message);
      const restored = await target.listSupplierPurchases();
      if (!restored.ok) throw new Error(restored.message);
      expect(restored.value.find(p => p.id === paid.value.id)?.supplierName).toBeNull();
      /* غير المسدد بلا تعريف يُرفض قبل أي كتابة. */
      const unpaid = await suppliers.recordPurchase({
        supplierName: null,
        supplierPartyId: null,
        note: "دين بلا جهة",
        purchasedOn: "2026-10-10",
        dueOn: null,
        totalMinor: 8_000,
        initialPaidMinor: 0,
        idempotencyKey: "s7-nosupplier-2",
        materialId: null,
        expectedQuantityMilli: null,
        lines: [periodLine({ valueMinor: 8_000 })],
      });
      expect(unpaid.ok).toBe(false);
      if (!unpaid.ok) expect(unpaid.message).toContain("تعريف");
    });
  });
}
