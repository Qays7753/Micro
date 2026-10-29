import "fake-indexeddb/auto";
import { afterEach, describe, expect, it } from "vitest";
import { LocalTransferService } from "./localTransferService";
import { exportCountsOf } from "./transferCounters";
import { MemoryLocalStore } from "@/storage/local/MemoryLocalStore";
import { IndexedDbLocalStore } from "@/storage/local/IndexedDbLocalStore";
import type { PrototypeLocalStore } from "@/storage/local/types";
import { createSavedParty, setSavedPartyArchive } from "@micro-domain/party/index.js";
import { localExportVersion, localSchemaVersion } from "@/storage/local/types";
import { syncSha256Hex } from "@/lib/syncSha256";

/* S05-MR-001 (أمر S06 — إصلاح عقد مؤكد من مراجعة S05 المستقلة): الثابت
 * المرجعي للأطراف المحفوظة عند الاستيراد/الاستعادة — ربط صريح بمعرف طرف
 * على البيع المباشر (customerPartyId) أو شراء المورد (supplierPartyId)
 * يجب أن يحلّ لطرف محفوظ داخل عائلة counterparties في الملف نفسه؛ الملف
 * الذي يهرّب مرجعًا مكسورًا يُرفض قبل أي معاينة وبلا أي كتابة على بيانات
 * الجهاز الهدف. null/الغياب يبقيان صحيحين حيث يسمح عقد المصدر، والطرف
 * المؤرشف حاضرًا في العائلة هوية صالحة. لا اشتقاق طرف من اسم/هاتف/مبلغ.
 * الإثبات دائم على المهايئين معًا: Memory وIndexedDB. */

const NOW = "2026-10-29T08:00:00.000Z";
const DATABASE_NAME = "micro-prototype-local";

function activeParty() {
  return createSavedParty({
    id: "party-1",
    label: "محمد الزهور",
    phone: null,
    note: null,
    operationKey: "party-1:create",
    recordedAt: NOW,
  });
}

function archivedParty() {
  const base = createSavedParty({
    id: "party-2",
    label: "سامي — مورد التغليف",
    phone: null,
    note: null,
    operationKey: "party-2:create",
    recordedAt: NOW,
  });
  return setSavedPartyArchive(base, {
    archived: true,
    operationKey: "party-2:archive",
    recordedAt: "2026-10-29T09:00:00.000Z",
  });
}

/** بيع مباشر صالح الشكل؛ الرابط الاختياري هو المتغير تحت الاختبار. */
function directSale(partyId: string | null | undefined): Record<string, unknown> {
  return {
    id: "sale-1",
    itemName: "إطار خشبي",
    quantity: 1,
    currency: "JOD",
    revenueMinor: 12_000,
    collectedMinor: 12_000,
    collectionStatus: "collected_in_full",
    customerName: "محمد الزهور",
    ...(partyId !== undefined ? { customerPartyId: partyId } : {}),
    catalogItemId: null,
    costMinor: null,
    profitMinor: null,
    occurredOn: "2026-10-20",
    recordedAt: NOW,
    note: "بيع مباشر مرتبط بطرف محفوظ",
    idempotencyKey: "sale-1-key",
    status: "active",
    cancelledAt: null,
    cancellationReason: null,
    revisions: [],
  };
}

/** شراء مورد صالح الشكل مسدد كاملًا؛ الرابط الاختياري هو المتغير تحت الاختبار. */
function supplierPurchase(partyId: string | null | undefined): Record<string, unknown> {
  return {
    id: "purchase-1",
    supplierName: "سامي — مورد التغليف",
    ...(partyId !== undefined ? { supplierPartyId: partyId } : {}),
    note: "شراء مواد مرتبط بمورد محفوظ",
    purchasedOn: "2026-10-20",
    dueOn: null,
    totalMinor: 9_000,
    paidMinor: 9_000,
    payableMinor: 0,
    status: "paid",
    idempotencyKey: "purchase-1-key",
    payments: [
      {
        id: "purchase-1:initial",
        amountMinor: 9_000,
        occurredOn: "2026-10-20",
        recordedAt: NOW,
        idempotencyKey: "purchase-1-key:initial",
        note: "دفعة عند تسجيل الشراء",
        walletId: null,
      },
    ],
    materialId: null,
    expectedQuantityMilli: null,
    createdAt: NOW,
    updatedAt: NOW,
  };
}

/** لقحة بيانات كاملة الأسر الأساسية على الزوج الحالي 40/32. */
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

type PartyFileInput = {
  readonly parties: readonly unknown[];
  readonly sale?: Record<string, unknown>;
  readonly purchase?: Record<string, unknown>;
};

/** ملف 40/32 كامل العدادات والبصمة — يصل إلى validateSnapshot فعلًا لا يُرفض عند العدادات. */
function currentPairFile({ parties, sale, purchase }: PartyFileInput): Record<string, unknown> {
  const data = baseData();
  data.counterparties = [...parties];
  if (sale) data.directSales = [sale];
  if (purchase) data.supplierPurchases = [purchase];
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

/** بيانات قائمة على الجهاز الهدف قبل المحاولة — إثبات «لا كتابة بعد الرفض» يقارن ضدها. */
async function seedTargetParty(store: PrototypeLocalStore) {
  const party = activeParty();
  const committed = await store.commitCounterpartyWrite({
    kind: "create",
    baseUpdatedAt: null,
    next: party,
    operationKey: party.operationKey,
  });
  if (!committed.ok) throw new Error(committed.message);
}

for (const adapter of adapters) {
  describe(`S05-MR-001 — الثابت المرجعي للأطراف عند الاستيراد (${adapter.label})`, () => {
    afterEach(async () => {
      if (adapter.label === "IndexedDB") await clearDatabase();
    });

    it("case 1: بيع مباشر بمعرف طرف غائب عن العائلة يُرفض قبل المعاينة", async () => {
      const target = await adapter.make();
      await seedTargetParty(target);
      const before = await target.readSnapshot();
      if (!before.ok) throw new Error(before.message);
      const file = currentPairFile({
        parties: [activeParty()],
        sale: directSale("party-missing"),
      });
      const service = new LocalTransferService(target, () => NOW);
      const prepared = service.prepareImport(JSON.stringify(file));
      expect(prepared.ok).toBe(false);
      /* الرفض قبل المعاينة ولا كتابة بعده: الاستعادة ترفض بدورها والهدف كما هو. */
      const restored = await service.prepareRestore(JSON.stringify(file));
      expect(restored.ok).toBe(false);
      const after = await target.readSnapshot();
      if (!after.ok) throw new Error(after.message);
      expect(after.value).toEqual(JSON.parse(JSON.stringify(before.value)));
    });

    it("case 2: شراء مورد بمعرف طرف غائب عن العائلة يُرفض قبل المعاينة", async () => {
      const target = await adapter.make();
      await seedTargetParty(target);
      const before = await target.readSnapshot();
      if (!before.ok) throw new Error(before.message);
      const file = currentPairFile({
        parties: [activeParty()],
        purchase: supplierPurchase("party-missing"),
      });
      const service = new LocalTransferService(target, () => NOW);
      const prepared = service.prepareImport(JSON.stringify(file));
      expect(prepared.ok).toBe(false);
      const restored = await service.prepareRestore(JSON.stringify(file));
      expect(restored.ok).toBe(false);
      const after = await target.readSnapshot();
      if (!after.ok) throw new Error(after.message);
      expect(after.value).toEqual(JSON.parse(JSON.stringify(before.value)));
    });

    it("case 3: رفض ملف مراجعه مكسورة لا يكتب شيئًا بعد محاولة تأكيد — الهدف untouched", async () => {
      const target = await adapter.make();
      await seedTargetParty(target);
      const before = await target.readSnapshot();
      if (!before.ok) throw new Error(before.message);
      const broken = currentPairFile({
        parties: [activeParty()],
        sale: directSale("ghost-party"),
        purchase: supplierPurchase("ghost-party"),
      });
      const service = new LocalTransferService(target, () => NOW);
      /* المحاولة الكاملة: تجهيز ← معاينة ← تأكيد؛ التجهيز يرفض فلا سكّة تأكيد أصلًا. */
      const prepared = service.prepareImport(JSON.stringify(broken));
      expect(prepared.ok).toBe(false);
      const restoreAttempt = await service.prepareRestore(JSON.stringify(broken));
      expect(restoreAttempt.ok).toBe(false);
      /* حتى مسار التأكيد المباشر على نص مرفوض لا يملك نية مربوطة — لا كتابة. */
      const after = await target.readSnapshot();
      if (!after.ok) throw new Error(after.message);
      expect(after.value).toEqual(JSON.parse(JSON.stringify(before.value)));
      const parties = await target.listCounterparties();
      expect(parties.ok && parties.value).toHaveLength(1);
    });

    it("case 4: بيع وشراء برابط صحيح لطرف نشط يجتازان الدورة الكاملة ويعبران بالمرجع", async () => {
      const target = await adapter.make();
      const party = activeParty();
      const file = currentPairFile({
        parties: [party],
        sale: directSale("party-1"),
        purchase: supplierPurchase("party-1"),
      });
      const service = new LocalTransferService(target, () => NOW);
      const prepared = service.prepareImport(JSON.stringify(file));
      expect(prepared.ok).toBe(true);
      const restored = await service.prepareRestore(JSON.stringify(file));
      expect(restored.ok).toBe(true);
      if (!restored.ok) throw new Error(restored.message);
      const applied = await service.confirmImport(restored.value);
      if (!applied.ok) throw new Error(applied.message);
      const sales = await target.listDirectSales();
      expect(sales.ok && sales.value).toHaveLength(1);
      expect(sales.ok && sales.value[0]?.customerPartyId).toBe("party-1");
      const purchases = await target.listSupplierPurchases();
      expect(purchases.ok && purchases.value).toHaveLength(1);
      expect(purchases.ok && purchases.value[0]?.supplierPartyId).toBe("party-1");
      /* إعادة التصدير الموثق تحمل المرجع كما هو — لا غسل ولا فقد. */
      const reExport = await service.createVerifiedExport();
      if (!reExport.ok) throw new Error(reExport.message);
      expect(reExport.value.file.data.directSales?.[0]?.customerPartyId).toBe("party-1");
      expect(reExport.value.file.data.supplierPurchases?.[0]?.supplierPartyId).toBe("party-1");
      expect(reExport.value.file.data.counterparties).toHaveLength(1);
    });

    it("case 5: الرابط بطرف مؤرشف حاضر في العائلة هوية صالحة — لا يُرفض الملف", async () => {
      const target = await adapter.make();
      const file = currentPairFile({
        parties: [archivedParty()],
        sale: directSale("party-2"),
        purchase: supplierPurchase("party-2"),
      });
      const service = new LocalTransferService(target, () => NOW);
      const prepared = service.prepareImport(JSON.stringify(file));
      expect(prepared.ok).toBe(true);
      const restored = await service.prepareRestore(JSON.stringify(file));
      expect(restored.ok).toBe(true);
      if (!restored.ok) throw new Error(restored.message);
      const applied = await service.confirmImport(restored.value);
      if (!applied.ok) throw new Error(applied.message);
      const parties = await target.listCounterparties();
      expect(parties.ok && parties.value).toHaveLength(1);
      expect(parties.ok && parties.value[0]?.archivedAt).toBe("2026-10-29T09:00:00.000Z");
      const sales = await target.listDirectSales();
      expect(sales.ok && sales.value[0]?.customerPartyId).toBe("party-2");
    });

    it("case 6: null الصريح وغياب الرابط يبقيان صحيحين حيث يسمح عقد المصدر", async () => {
      const target = await adapter.make();
      const file = currentPairFile({
        parties: [activeParty()],
        sale: directSale(null),
        purchase: supplierPurchase(null),
      });
      const service = new LocalTransferService(target, () => NOW);
      const prepared = service.prepareImport(JSON.stringify(file));
      expect(prepared.ok).toBe(true);
      const restored = await service.prepareRestore(JSON.stringify(file));
      expect(restored.ok).toBe(true);
      if (!restored.ok) throw new Error(restored.message);
      const applied = await service.confirmImport(restored.value);
      if (!applied.ok) throw new Error(applied.message);
      const sales = await target.listDirectSales();
      expect(sales.ok && sales.value[0]?.customerPartyId).toBe(null);
      const purchases = await target.listSupplierPurchases();
      expect(purchases.ok && purchases.value[0]?.supplierPartyId).toBe(null);

      /* الغياب التام للحقل (سجلات ما قبل S05) يبقى مقبولًا كما كان. */
      const absentFile = currentPairFile({
        parties: [activeParty()],
        sale: directSale(undefined),
        purchase: supplierPurchase(undefined),
      });
      const preparedAbsent = service.prepareImport(JSON.stringify(absentFile));
      expect(preparedAbsent.ok).toBe(true);
    });

    it("R2-F03: رابط طرف بلا لقطة تسميته على البيع مكسور — يُرفض عند الباب (مرآة جانب المورد)", async () => {
      const target = await adapter.make();
      const service = new LocalTransferService(target, () => NOW);
      const party = activeParty();
      const linkWithoutName = currentPairFile({
        parties: [party],
        sale: { ...directSale("party-1"), customerName: null },
      });
      expect(service.prepareImport(JSON.stringify(linkWithoutName)).ok).toBe(false);
      /* السليم (رابط + لقطة تسمية) يمر كما كان. */
      const healthy = currentPairFile({
        parties: [party],
        sale: directSale("party-1"),
      });
      expect(service.prepareImport(JSON.stringify(healthy)).ok).toBe(true);
    });

    it("شكل الرابط المكسور نفسه يُرفض: معرف غير نصي أو نص فارغ على البيع والشراء", async () => {
      const target = await adapter.make();
      const service = new LocalTransferService(target, () => NOW);
      const nonStringSale = currentPairFile({
        parties: [activeParty()],
        sale: { ...directSale(null), customerPartyId: 42 },
      });
      expect(service.prepareImport(JSON.stringify(nonStringSale)).ok).toBe(false);
      const emptySale = currentPairFile({
        parties: [activeParty()],
        sale: directSale("   "),
      });
      expect(service.prepareImport(JSON.stringify(emptySale)).ok).toBe(false);
      const nonStringPurchase = currentPairFile({
        parties: [activeParty()],
        purchase: { ...supplierPurchase(null), supplierPartyId: false },
      });
      expect(service.prepareImport(JSON.stringify(nonStringPurchase)).ok).toBe(false);
      const emptyPurchase = currentPairFile({
        parties: [activeParty()],
        purchase: supplierPurchase(""),
      });
      expect(service.prepareImport(JSON.stringify(emptyPurchase)).ok).toBe(false);
    });
  });
}
