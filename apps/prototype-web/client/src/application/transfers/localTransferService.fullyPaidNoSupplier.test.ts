import "fake-indexeddb/auto";
import { afterEach, describe, expect, it } from "vitest";
import { LocalTransferService } from "./localTransferService";
import { exportCountsOf } from "./transferCounters";
import { MemoryLocalStore } from "@/storage/local/MemoryLocalStore";
import { IndexedDbLocalStore } from "@/storage/local/IndexedDbLocalStore";
import type { PrototypeLocalStore } from "@/storage/local/types";
import { createSupplierPurchase } from "@micro-domain/supplier-purchase/index.js";
import { localExportVersion, localSchemaVersion } from "@/storage/local/types";
import { syncSha256Hex } from "@/lib/syncSha256";

/* S05-MR-002 (أمر S06 — إصلاح عقد S05 المؤكد): الشراء المسدد كاملًا بلا
 * مورد سجل عقد صحيح — سياسة المجال الحية (createSupplierPurchase تقبل
 * supplierName=null حين initialPaidMinor === totalMinor) وعقد UNIT-037/SDF-010
 * يسمحانه، لكن validSupplierPurchase كان يوجب اسمًا غير فارغ دائمًا فيرفض
 * الملف الصحيح عند prepareImport — وبهذا يفشل createVerifiedExport والدورة
 * الكاملة لقيمة عقدية صحيحة. الإصلاح الجذري: null/null صحيحان للمسدد
 * كاملًا حصرًا؛ الاستحقاق القائم يوجب تعريفًا (اسم أو رابط محفوظ يحمل
 * لقطة اسمه)؛ لا يتغير مفتاح سلك ولا مبلغ ولا تاريخ ولا لقطة. الإثبات
 * دائم على المهايئين معًا. */

const NOW = "2026-10-29T08:00:00.000Z";
const DATABASE_NAME = "micro-prototype-local";

/** شراء مسدد كاملًا بلا مورد — يُبنى بكاتب المجال الحي نفسه لا بصناعة يدوية. */
function fullyPaidNoSupplierPurchase() {
  return createSupplierPurchase({
    id: "purchase-paid-nosupplier",
    supplierName: null,
    supplierPartyId: null,
    note: "أدوات مكتبية دُفعت كاملة نقديًا",
    purchasedOn: "2026-10-20",
    dueOn: null,
    totalMinor: 4_500,
    initialPaidMinor: 4_500,
    recordedAt: NOW,
    idempotencyKey: "purchase-paid-nosupplier-key",
    materialId: null,
    expectedQuantityMilli: null,
  });
}

function baseData(): Record<string, unknown> {
  return {
    profile: null,
    preferences: null,
    drafts: [],
    orders: [],
    directSales: [],
    schedules: [],
    recurrences: [],
    financialEvents: [],
    supplierPurchases: [],
    cashWallets: [],
    cashContinuityEntries: [],
    materials: [],
    inventoryMovements: [],
    inventoryShortages: [],
    inventoryActivation: null,
    catalogItems: [],
    measurementUnits: [],
    directConversions: [],
    catalogTemplates: [],
    actualTimeRecords: [],
    shortCashDeclarations: [],
    ownerEntitlementPolicies: [],
    ownerEntitlementRecords: [],
    ownerEntitlementOpeningBalances: [],
    ownerMovements: [],
    allocationPolicies: [],
    costEstimates: [],
    assets: [],
    loans: [],
    receivedLoans: [],
    recurringExpenseSeries: [],
    recurringExpenseRevisions: [],
    recurringExpenseOccurrences: [],
    expenseBudgets: [],
    balanceObservations: [],
    counterparties: [],
  };
}

function currentPairFile(purchases: readonly unknown[]): Record<string, unknown> {
  const data = baseData();
  data.supplierPurchases = [...purchases];
  const counts = exportCountsOf(data as Parameters<typeof exportCountsOf>[0]);
  const file: Record<string, unknown> = {
    format: "micro-prototype-local-export",
    version: localExportVersion,
    schemaVersion: localSchemaVersion,
    exportedAt: NOW,
    data,
  };
  file.integrity = { algorithm: "sha256", digest: syncSha256Hex(JSON.stringify(data)) };
  file.counts = counts;
  return file;
}

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

async function commitPurchase(
  store: PrototypeLocalStore,
  purchase: ReturnType<typeof fullyPaidNoSupplierPurchase>,
) {
  const committed = await store.commitSupplierPurchase({
    kind: "create",
    purchase,
    idempotencyKey: purchase.idempotencyKey,
  });
  if (!committed.ok) throw new Error(committed.message);
  return committed.value.purchase;
}

for (const adapter of adapters) {
  describe(`S05-MR-002 — الشراء المسدد كاملًا بلا مورد يعبر النقل (${adapter.label})`, () => {
    afterEach(async () => {
      if (adapter.label === "IndexedDB") await clearDatabase();
    });

    it("export → prepareImport → restore لدورة كاملة لشراء مسدد كاملًا بلا مورد", async () => {
      const source = await adapter.make();
      const purchase = await commitPurchase(source, fullyPaidNoSupplierPurchase());
      expect(purchase.supplierName).toBe(null);
      expect(purchase.supplierPartyId ?? null).toBe(null);
      expect(purchase.status).toBe("paid");

      const service = new LocalTransferService(source, () => NOW);
      const verified = await service.createVerifiedExport();
      if (!verified.ok) throw new Error(verified.message);
      expect(verified.value.file.version).toBe(localExportVersion);
      expect(verified.value.file.data.supplierPurchases ?? []).toHaveLength(1);
      expect(verified.value.file.data.supplierPurchases?.[0]?.supplierName).toBe(null);

      const target = await adapter.make();
      const targetService = new LocalTransferService(target, () => NOW);
      const restored = await targetService.prepareRestore(
        JSON.stringify({ ...verified.value.file, exportedAt: NOW }),
      );
      expect(restored.ok).toBe(true);
      if (!restored.ok) throw new Error(restored.message);
      const applied = await targetService.confirmImport(restored.value);
      if (!applied.ok) throw new Error(applied.message);
      const purchases = await target.listSupplierPurchases();
      expect(purchases.ok && purchases.value).toHaveLength(1);
      expect(purchases.ok && purchases.value[0]?.supplierName).toBe(null);
      expect(purchases.ok ? (purchases.value[0]?.supplierPartyId ?? null) : undefined).toBe(null);
      expect(purchases.ok && purchases.value[0]?.paidMinor).toBe(4_500);
      expect(purchases.ok && purchases.value[0]?.status).toBe("paid");

      /* إعادة التصدير من الهدف تحمل القيمة كما هي — لا ترقية صامتة لمورد ولا غسل. */
      const reExport = await targetService.createVerifiedExport();
      if (!reExport.ok) throw new Error(reExport.message);
      expect(reExport.value.file.data.supplierPurchases?.[0]?.supplierName).toBe(null);
    });

    it("createVerifiedExport ينجح للمخزن الذي فيه شراء مسدد بلا مورد — بلا تخفيض تحقق", async () => {
      const store = await adapter.make();
      await commitPurchase(store, fullyPaidNoSupplierPurchase());
      const service = new LocalTransferService(store, () => NOW);
      const verified = await service.createVerifiedExport();
      expect(verified.ok).toBe(true);
      if (!verified.ok) throw new Error(verified.message);
      /* التحقق لم يُخفَّض: نفس الملف يُعاد تحضيره فينجح، والملف المكسور لا يزال يُرفض. */
      const rePrepared = service.prepareImport(JSON.stringify(verified.value.file));
      expect(rePrepared.ok).toBe(true);
      const brokenFile = currentPairFile([{ ...fullyPaidNoSupplierPurchase(), note: "" }]);
      expect(service.prepareImport(JSON.stringify(brokenFile)).ok).toBe(false);
    });

    it("الاستحقاق القائم بلا تعريف جهة يبقى مرفوضًا — لا يُضعَّف التحقق للمسدد", async () => {
      const target = await adapter.make();
      const service = new LocalTransferService(target, () => NOW);
      const unpaidNoSupplier = currentPairFile([
        {
          ...fullyPaidNoSupplierPurchase(),
          id: "purchase-unpaid-nosupplier",
          idempotencyKey: "purchase-unpaid-nosupplier-key",
          totalMinor: 9_000,
          paidMinor: 4_000,
          payableMinor: 5_000,
          status: "partially_paid",
          payments: [
            {
              id: "purchase-unpaid-nosupplier:initial",
              amountMinor: 4_000,
              occurredOn: "2026-10-20",
              recordedAt: NOW,
              idempotencyKey: "purchase-unpaid-nosupplier-key:initial",
              note: "دفعة عند تسجيل الشراء",
              walletId: null,
            },
          ],
        },
      ]);
      expect(service.prepareImport(JSON.stringify(unpaidNoSupplier)).ok).toBe(false);
      const before = await target.readSnapshot();
      if (!before.ok) throw new Error(before.message);
      const restored = await service.prepareRestore(JSON.stringify(unpaidNoSupplier));
      expect(restored.ok).toBe(false);
      const after = await target.readSnapshot();
      if (!after.ok) throw new Error(after.message);
      expect(after.value).toEqual(JSON.parse(JSON.stringify(before.value)));

      /* المدفوع كاملًا بحسم استحقاق سابق (تراجع موثق) مع بقاء الاستحقاق يوجب التعريف:
       * تراجع كامل الدفعة يجعل المدفوع الفعلي صفرًا مع supplierName=null — يُرفض. */
      const reversedToUnpaid = currentPairFile([
        {
          ...fullyPaidNoSupplierPurchase(),
          id: "purchase-reversed-nosupplier",
          idempotencyKey: "purchase-reversed-nosupplier-key",
          paidMinor: 0,
          payableMinor: 4_500,
          status: "unpaid",
          payments: [],
        },
      ]);
      expect(service.prepareImport(JSON.stringify(reversedToUnpaid)).ok).toBe(false);
    });

    it("ربط مورد محفوظ بلا لقطة اسم يبقى مكسورًا — الرابط يحمل تسميته معه دائمًا", async () => {
      const store = await adapter.make();
      const service = new LocalTransferService(store, () => NOW);
      const linkedWithoutName = currentPairFile([
        {
          ...fullyPaidNoSupplierPurchase(),
          supplierPartyId: "party-ghost",
        },
      ]);
      expect(service.prepareImport(JSON.stringify(linkedWithoutName)).ok).toBe(false);
    });

    it("مفتاح السلك والمبالغ والتواريخ واللقطات لا تتغير للقيمة الصحيحة", async () => {
      const source = await adapter.make();
      await commitPurchase(source, fullyPaidNoSupplierPurchase());
      const service = new LocalTransferService(source, () => NOW);
      const verified = await service.createVerifiedExport();
      if (!verified.ok) throw new Error(verified.message);
      const record = (verified.value.file.data.supplierPurchases ?? [])[0] as Record<string, unknown>;
      expect(record.id).toBe("purchase-paid-nosupplier");
      expect(record.supplierName).toBe(null);
      expect(record.totalMinor).toBe(4_500);
      expect(record.paidMinor).toBe(4_500);
      expect(record.payableMinor).toBe(0);
      expect(record.status).toBe("paid");
      expect(record.purchasedOn).toBe("2026-10-20");
      expect(record.idempotencyKey).toBe("purchase-paid-nosupplier-key");
      expect(Array.isArray(record.payments)).toBe(true);
      expect((record.payments as unknown[]).length).toBe(1);
    });
  });
}
