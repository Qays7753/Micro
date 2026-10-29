import "fake-indexeddb/auto";
import { afterEach, describe, expect, it } from "vitest";
import { MemoryLocalStore } from "@/storage/local/MemoryLocalStore";
import { IndexedDbLocalStore } from "@/storage/local/IndexedDbLocalStore";
import type { PrototypeLocalStore } from "@/storage/local/types";
import { ProjectFinancialService } from "./projectFinancialService";
import { SupplierPurchaseService } from "@/application/suppliers/supplierPurchaseService";
import { DirectSaleService } from "@/application/direct-sales/directSaleService";
import type { SupplierPurchaseLine } from "@micro-domain/supplier-purchase/index.js";

/* S07 (UNIT-028 / D02 المعتمد / SDF-031): اعتراف تكلفة مواد الفترة من بنود
 * period_material عند قارئ الفترة الكنوني نفسه — مرة على فترة تاريخ الشراء،
 * بلا حدث مالي ثانٍ؛ والتقدير للتسعير لا يخصم ثانية؛ والمجهولة القيمة تُعلن
 * وتمنع رقم نتيجة نهائيًا كاذبًا. الإرث بلا بنود لا يُعترف أبدًا (لا إعادة
 * تصنيف رجعية). */

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

const periodLine = (valueMinor: number): SupplierPurchaseLine => ({
  lineId: "pl-1",
  materialId: null,
  expectedQuantityMilli: null,
  valueMinor,
  costKnowledge: "known",
  treatment: "period_material",
});

for (const adapter of adapters) {
  describe(`S07 — SDF-031: اعتراف مواد الفترة عند قارئ الفترة (${adapter.label})`, () => {
    afterEach(async () => {
      if (adapter.label === "IndexedDB") await clearDatabase();
    });

    it("شراء طحين 10 دون متابعة وبيع 25 بتكلفة جديدة 2 وتقدير تسعير 4: تكلفة الفترة 12 والمساهمة 13 — لا خصم 4 ثانية", async () => {
      const store = await adapter.make();
      const suppliers = new SupplierPurchaseService(store, () => NOW);
      const directSales = new DirectSaleService(store, () => NOW);
      const finance = new ProjectFinancialService(store, () => NOW);
      /* شراء طحين 10 دون متابعة — بند فترة معلوم القيمة. */
      const purchase = await suppliers.recordPurchase({
        supplierName: null,
        supplierPartyId: null,
        note: "طحين للمخبز",
        purchasedOn: "2026-10-05",
        dueOn: null,
        totalMinor: 10_000,
        initialPaidMinor: 10_000,
        idempotencyKey: "sdf031-purchase",
        materialId: null,
        expectedQuantityMilli: null,
        lines: [periodLine(10_000)],
      });
      if (!purchase.ok) throw new Error(purchase.message);
      /* بيع مباشر 25 بتكلفة معلومة 2 (كلفة جديدة) — وتقدير مادة للتسعير 4
       * لا يُخصم ثانية: التسعير تقدير لا مصروفًا فعليًا. */
      const sale = await directSales.record({
        itemName: "خبز فرن",
        quantity: 1,
        revenueMinor: 25_000,
        collectedMinor: 25_000,
        collectionStatus: "collected_in_full",
        catalogItemId: null,
        customerName: null,
        costMinor: 2_000,
        occurredOn: "2026-10-12",
        note: "بيع مباشر بتكلفة معلومة",
        idempotencyKey: "sdf031-sale",
      });
      if (!sale.ok) throw new Error(sale.message);
      /* التكلفة التقديرية 4 للتسعير: تعريف مرجعي محفوظ لا يخصم — نمثّله
       * بأثر شرائي غير موجود أصلًا (تقدير منشأة للتسعير ليست شراءً ولا
       * استهلاكًا) فلا يدخل القراءة إطلاقًا. */
      const result = await finance.readRecordedPeriodResult("2026-10-01", "2026-10-31");
      if (!result.ok) throw new Error(result.message);
      expect(result.value.untrackedMaterialPurchaseCostMinor).toBe(10_000);
      expect(result.value.directSaleCostKnownMinor).toBe(2_000);
      expect(result.value.directSaleRevenueMinor).toBe(25_000);
      /* تكلفة الفترة 12 = 10 (مواد فترة) + 2 (كلفة البيع الجديدة)؛ والمساهمة
       * 13 = 25 − 12 — والتقدير 4 لا يُخصم ثانية أبدًا. */
      expect(result.value.resultMinor).toBe(25_000 - 10_000 - 2_000);
      expect(result.value.resultMinor).toBe(13_000);
      /* الحساب مرة واحدة: لا مصروف تشغيلي ثانٍ من الدفع ولا خصم وصفة. */
      expect(result.value.recordedOperatingExpenseMinor).toBe(0);
    });

    it("الإرث بلا بنود لا يُعترف عند الشراء — لا إعادة تصنيف رجعية (حد D02)", async () => {
      const store = await adapter.make();
      const suppliers = new SupplierPurchaseService(store, () => NOW);
      const finance = new ProjectFinancialService(store, () => NOW);
      const legacy = await suppliers.recordPurchase({
        supplierName: "مؤسسة النسيج",
        supplierPartyId: null,
        note: "شراء إرثي بلا بنود",
        purchasedOn: "2026-10-05",
        dueOn: null,
        totalMinor: 7_000,
        initialPaidMinor: 7_000,
        idempotencyKey: "sdf031-legacy",
        materialId: null,
        expectedQuantityMilli: null,
        lines: null,
      });
      if (!legacy.ok) throw new Error(legacy.message);
      const result = await finance.readRecordedPeriodResult("2026-10-01", "2026-10-31");
      if (!result.ok) throw new Error(result.message);
      expect(result.value.untrackedMaterialPurchaseCostMinor).toBe(0);
      expect(result.value.resultMinor).toBe(0);
    });

    it("بند فترة مجهول القيمة يُعلن ويمنع رقم نتيجة نهائيًا كاذبًا — لا صفرًا معلومًا", async () => {
      const store = await adapter.make();
      const suppliers = new SupplierPurchaseService(store, () => NOW);
      const finance = new ProjectFinancialService(store, () => NOW);
      const unknown = await suppliers.recordPurchase({
        supplierName: null,
        supplierPartyId: null,
        note: "أدوات متنوعة قيمتها غير معروفة",
        purchasedOn: "2026-10-05",
        dueOn: null,
        totalMinor: 9_000,
        initialPaidMinor: 9_000,
        idempotencyKey: "sdf031-unknown",
        materialId: null,
        expectedQuantityMilli: null,
        lines: [
          {
            lineId: "pl-1",
            materialId: null,
            expectedQuantityMilli: null,
            valueMinor: null,
            costKnowledge: "unknown",
            treatment: "period_material",
          },
        ],
      });
      if (!unknown.ok) throw new Error(unknown.message);
      const result = await finance.readRecordedPeriodResult("2026-10-01", "2026-10-31");
      if (!result.ok) throw new Error(result.message);
      expect(result.value.untrackedMaterialPurchaseCostUnknownCount).toBe(1);
      expect(result.value.untrackedMaterialPurchaseCostMinor).toBe(0);
      expect(result.value.resultMinor).toBeNull();
      expect(result.value.reasons).toContain("مواد فترة بقيمة غير معروفة");
    });

    it("الاعتراف بتاريخ الشراء لا بتاريخ الدفع اللاحق — والفترات المنفصلة لا تتسرب", async () => {
      const store = await adapter.make();
      const suppliers = new SupplierPurchaseService(store, () => NOW);
      const finance = new ProjectFinancialService(store, () => NOW);
      const created = await suppliers.recordPurchase({
        supplierName: "مؤسسة النسيج",
        supplierPartyId: null,
        note: "شراء سبتمبر مدفوع لاحقًا في أكتوبر",
        purchasedOn: "2026-09-10",
        dueOn: null,
        totalMinor: 12_000,
        initialPaidMinor: 0,
        idempotencyKey: "sdf031-periods",
        materialId: null,
        expectedQuantityMilli: null,
        lines: [periodLine(12_000)],
      });
      if (!created.ok) throw new Error(created.message);
      const laterPaid = await suppliers.recordPayment({
        purchaseId: created.value.id,
        amountMinor: 6_000,
        occurredOn: "2026-10-20",
        note: "دفعة لاحقة",
        idempotencyKey: "sdf031-pay",
        walletId: null,
      });
      if (!laterPaid.ok) throw new Error(laterPaid.message);
      const september = await finance.readRecordedPeriodResult("2026-09-01", "2026-09-30");
      if (!september.ok) throw new Error(september.message);
      expect(september.value.untrackedMaterialPurchaseCostMinor).toBe(12_000);
      const october = await finance.readRecordedPeriodResult("2026-10-01", "2026-10-31");
      if (!october.ok) throw new Error(october.message);
      expect(october.value.untrackedMaterialPurchaseCostMinor).toBe(0);
      expect(october.value.resultMinor).toBe(0);
    });
  });
}
