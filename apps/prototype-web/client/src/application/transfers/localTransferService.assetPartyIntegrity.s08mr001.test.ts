import "fake-indexeddb/auto";
import { afterEach, describe, expect, it } from "vitest";
import { LocalTransferService } from "./localTransferService";
import { exportCountsOf } from "./transferCounters";
import { MemoryLocalStore } from "@/storage/local/MemoryLocalStore";
import { IndexedDbLocalStore } from "@/storage/local/IndexedDbLocalStore";
import type { PrototypeLocalStore } from "@/storage/local/types";
import { AssetService } from "@/application/assets/assetService";
import { PartyDirectoryService } from "@/application/parties/partyLedgerService";
import { syncSha256Hex } from "@/lib/syncSha256";

/* S08-MR-001 (أمر التنفيذ المتصل S08→S09 المنشور في ad133bae — القسم ١؛
 * تعريف الملاحظة من أمر الإصلاح المركز 2602a03d): الثابت المرجعي لطرف
 * الاقتناء المحفوظ على سجل الأصل عند الاستيراد/الاستعادة — المرجع غير الفارغ
 * (acquisitionParty.partyId) يجب أن يحلّ لطرف محفوظ داخل عائلة counterparties
 * في الملف نفسه (امتداد نمط S05-MR-001 للبيع المباشر/شراء المورد إلى عائلة
 * الأصول). null/الغياب يبقيان صحيحين حيث يسمح عقد الأصل، والطرف المؤرشف
 * حاضرًا في العائلة هوية مرجعية صالحة. لا اشتقاق طرف من لقطة التسمية/الاسم/
 * الهاتف ولا دمج بالاسم أبدًا؛ الرفض في prepareImport قبل المعاينة وفي
 * prepareRestore قبل أي كتابة على بيانات الجهاز الهدف.
 * الإثبات عبر الاقتران المتقاطع (Memory→IndexedDB وIndexedDB→Memory):
 * التجهيز/التحقق نقي مستقل عن المهايئ، والزوجان يثبتان تكافؤ الثبات والدورة
 * عبر المهايئين معًا لا نسخة لكل مهايئ. الملف المعدل يعاد حساب بصمته
 * وعداداته ليصل إلى validateSnapshot فعلًا (نمط S05-MR-001 نفسه). */

const NOW = "2026-10-30T14:00:00.000Z";
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

const pairs: ReadonlyArray<{
  readonly label: string;
  readonly source: StoreFactory;
  readonly target: StoreFactory;
}> = [
  {
    label: "Memory→IndexedDB",
    source: () => new MemoryLocalStore(),
    target: async () => {
      await clearDatabase();
      return new IndexedDbLocalStore();
    },
  },
  {
    label: "IndexedDB→Memory",
    source: async () => {
      await clearDatabase();
      return new IndexedDbLocalStore();
    },
    target: () => new MemoryLocalStore(),
  },
];

type SeededSource = {
  readonly activePartyId: string;
  readonly activePartyLabel: string;
  readonly archivedPartyId: string;
  readonly archivedPartyArchivedAt: string;
  readonly partialAssetId: string;
  readonly archivedRefAssetId: string;
  readonly bareAssetId: string;
};

/** المصدر يُبنى بالمسار التطبيقي الحقيقي فقط (لا سجلات مصنوعة يدويًا). */
async function seedSource(store: PrototypeLocalStore): Promise<SeededSource> {
  const parties = new PartyDirectoryService(store, () => NOW);
  const active = await parties.save({
    label: "مؤسسة المعدات",
    phone: null,
    note: null,
    operationKey: "party-active:create",
  });
  if (!active.ok) throw new Error(active.message ?? "party should save");
  const preArchive = await parties.save({
    label: "ورشة الصيانة",
    phone: null,
    note: null,
    operationKey: "party-archived:create",
  });
  if (!preArchive.ok) throw new Error(preArchive.message ?? "party should save");
  const archived = await parties.setArchived({
    partyId: preArchive.value.party.id,
    archived: true,
    expectedUpdatedAt: preArchive.value.party.updatedAt,
    operationKey: "party-archived:archive",
  });
  if (!archived.ok) throw new Error(archived.message ?? "party should archive");
  const assets = new AssetService(store, () => NOW);
  const partial = await assets.create({
    name: "عجانة",
    acquisitionAmountMinor: 10000,
    acquisitionKind: "payable",
    purchaseDate: "2026-10-05",
    paidAtCreationMinor: 4000,
    acquisitionPartyId: active.value.party.id,
    note: null,
  });
  if (!partial.ok) throw new Error(partial.message);
  const archivedRef = await assets.create({
    name: "مكيف صناعي",
    acquisitionAmountMinor: 3000,
    acquisitionKind: "cash",
    purchaseDate: "2026-10-06",
    acquisitionPartyId: archived.value.party.id,
    note: null,
  });
  if (!archivedRef.ok) throw new Error(archivedRef.message);
  const bare = await assets.create({
    name: "ثلاجة عرض",
    acquisitionAmountMinor: 5000,
    acquisitionKind: "cash",
    purchaseDate: "2026-10-07",
    note: null,
  });
  if (!bare.ok) throw new Error(bare.message);
  return {
    activePartyId: active.value.party.id,
    activePartyLabel: active.value.party.label,
    archivedPartyId: archived.value.party.id,
    archivedPartyArchivedAt: archived.value.party.archivedAt ?? NOW,
    partialAssetId: partial.value.asset.id,
    archivedRefAssetId: archivedRef.value.asset.id,
    bareAssetId: bare.value.asset.id,
  };
}

/** بيانات قائمة على الهدف قبل المحاولة — إثبات «لا كتابة بعد الرفض» يقارن ضدها. */
async function seedTarget(store: PrototypeLocalStore) {
  const parties = new PartyDirectoryService(store, () => NOW);
  const resident = await parties.save({
    label: "طرف الهدف المقيم",
    phone: null,
    note: null,
    operationKey: "target-party:create",
  });
  if (!resident.ok) throw new Error(resident.message ?? "target party should save");
  const assets = new AssetService(store, () => NOW);
  const residentAsset = await assets.create({
    name: "أصل الهدف المقيم",
    acquisitionAmountMinor: 7000,
    acquisitionKind: "cash",
    purchaseDate: "2026-10-08",
    note: null,
  });
  if (!residentAsset.ok) throw new Error(residentAsset.message);
}

/** نسخة معدلة ببصمة وعدادات معاد حسابها — تصل إلى validateSnapshot فعلًا لا تُرفض عند البصمة/العدادات. */
function mutated(file: unknown, mutate: (data: Record<string, unknown>) => void): string {
  const copy = JSON.parse(JSON.stringify(file)) as Record<string, unknown>;
  const data = copy.data as Record<string, unknown>;
  mutate(data);
  copy.integrity = { algorithm: "sha256", digest: syncSha256Hex(JSON.stringify(data)) };
  copy.counts = exportCountsOf(data as Parameters<typeof exportCountsOf>[0]);
  return JSON.stringify(copy);
}

function withAsset(data: Record<string, unknown>, assetId: string, patch: Record<string, unknown>) {
  data.assets = (data.assets as Record<string, unknown>[]).map(asset =>
    (asset as Record<string, unknown>).id === assetId ? { ...asset, ...patch } : asset,
  );
}

async function verifiedFileOf(store: PrototypeLocalStore) {
  const service = new LocalTransferService(store, () => NOW);
  const exported = await service.createVerifiedExport();
  if (!exported.ok) throw new Error(exported.message);
  return exported.value.file;
}

for (const pair of pairs) {
  describe(`S08-MR-001 — الثابت المرجعي لطرف الاقتناء المحفوظ عند الاستيراد (${pair.label})`, () => {
    afterEach(async () => {
      await clearDatabase();
    });

    it("case 1: أصل بمعرف طرف محفوظ غائب عن عائلة الملف يُرفض قبل المعاينة وقبل أي كتابة على الهدف", async () => {
      const source = await pair.source();
      const seeded = await seedSource(source);
      const file = await verifiedFileOf(source);
      const target = await pair.target();
      await seedTarget(target);
      const before = await target.readSnapshot();
      if (!before.ok) throw new Error(before.message);
      const service = new LocalTransferService(target, () => NOW);
      const dangling = mutated(file, data => {
        withAsset(data, seeded.partialAssetId, {
          acquisitionParty: { partyId: "party-missing", labelSnapshot: seeded.activePartyLabel },
        });
      });
      const prepared = service.prepareImport(dangling);
      expect(prepared.ok).toBe(false);
      /* الرفض قبل أي كتابة: الاستعادة ترفض بدورها والهدف كما كان بالضبط. */
      const restored = await service.prepareRestore(dangling);
      expect(restored.ok).toBe(false);
      const after = await target.readSnapshot();
      if (!after.ok) throw new Error(after.message);
      expect(after.value).toEqual(JSON.parse(JSON.stringify(before.value)));
      const parties = await target.listCounterparties();
      expect(parties.ok && parties.value).toHaveLength(1);
      const assets = await target.listAssets();
      expect(assets.ok && assets.value).toHaveLength(1);
    });

    it("case 2: المراجع الصحيحة (نشط ومؤرشف) تجتاز الدورة الكاملة وتعبر بالمرجع عبر إعادة التصدير بلا إعادة بناء بالاسم", async () => {
      const source = await pair.source();
      const seeded = await seedSource(source);
      const file = await verifiedFileOf(source);
      const text = JSON.stringify(file);
      const target = await pair.target();
      await seedTarget(target);
      const service = new LocalTransferService(target, () => NOW);
      const prepared = service.prepareImport(text);
      expect(prepared.ok).toBe(true);
      const restored = await service.prepareRestore(text);
      expect(restored.ok).toBe(true);
      if (!restored.ok) throw new Error(restored.message);
      const applied = await service.confirmImport(restored.value);
      if (!applied.ok) throw new Error(applied.message);
      /* الاستبدال يحمل ملف المصدر كما هو: طرفان (النشط والمؤرشف) لا ثالث مبتدأ بالاسم. */
      const parties = await target.listCounterparties();
      expect(parties.ok && parties.value).toHaveLength(2);
      const archivedParty = parties.ok ? parties.value.find(p => p.id === seeded.archivedPartyId) : undefined;
      expect(archivedParty?.archivedAt).toBe(seeded.archivedPartyArchivedAt);
      const assets = await target.listAssets();
      if (!assets.ok) throw new Error(assets.message);
      const partial = assets.value.find(asset => asset.id === seeded.partialAssetId);
      expect(partial?.acquisitionParty).toEqual({
        partyId: seeded.activePartyId,
        labelSnapshot: seeded.activePartyLabel,
      });
      /* الطرف المؤرشف حاضرًا في العائلة هوية مرجعية صالحة — مرجعه التاريخي يعبر كما هو. */
      const archivedRef = assets.value.find(asset => asset.id === seeded.archivedRefAssetId);
      expect(archivedRef?.acquisitionParty?.partyId).toBe(seeded.archivedPartyId);
      /* إعادة التصدير الموثقة من الهدف تحمل المرجع كما هو — لا غسل ولا فقد. */
      const reExport = await service.createVerifiedExport();
      if (!reExport.ok) throw new Error(reExport.message);
      const reExportedPartial = reExport.value.file.data.assets?.find(
        asset => asset.id === seeded.partialAssetId,
      );
      expect(reExportedPartial?.acquisitionParty).toEqual({
        partyId: seeded.activePartyId,
        labelSnapshot: seeded.activePartyLabel,
      });
      expect(reExport.value.file.data.counterparties).toHaveLength(2);
    });

    it("case 3: null الصريح وغياب الرابط تمامًا يبقيان صحيحين حيث يسمح عقد الأصل", async () => {
      const source = await pair.source();
      const seeded = await seedSource(source);
      const file = await verifiedFileOf(source);
      const target = await pair.target();
      const service = new LocalTransferService(target, () => NOW);
      const nullVariant = mutated(file, data => {
        withAsset(data, seeded.partialAssetId, { acquisitionParty: null });
      });
      expect(service.prepareImport(nullVariant).ok).toBe(true);
      /* الغياب التام للحقل (أصل ما قبل S08) يُقبل كما كان؛ الترحيل يطبع الغياب null. */
      const absentVariant = mutated(file, data => {
        data.assets = (data.assets as Record<string, unknown>[]).map(asset => {
          if ((asset as Record<string, unknown>).id !== seeded.partialAssetId) return asset;
          const rest = { ...(asset as Record<string, unknown>) };
          delete rest.acquisitionParty;
          return rest;
        });
      });
      const preparedAbsent = service.prepareImport(absentVariant);
      expect(preparedAbsent.ok).toBe(true);
      const restored = await service.prepareRestore(nullVariant);
      expect(restored.ok).toBe(true);
      if (!restored.ok) throw new Error(restored.message);
      const applied = await service.confirmImport(restored.value);
      if (!applied.ok) throw new Error(applied.message);
      const assets = await target.listAssets();
      if (!assets.ok) throw new Error(assets.message);
      const partial = assets.value.find(asset => asset.id === seeded.partialAssetId);
      expect(partial?.acquisitionParty ?? null).toBeNull();
    });

    it("case 4: شكل المرجع المكسور نفسه يُرفض عند الباب — معرف غير نصي أو نص فارغ أو بلا لقطة تسمية", async () => {
      const source = await pair.source();
      const seeded = await seedSource(source);
      const file = await verifiedFileOf(source);
      const target = await pair.target();
      const service = new LocalTransferService(target, () => NOW);
      const nonStringId = mutated(file, data => {
        withAsset(data, seeded.partialAssetId, {
          acquisitionParty: { partyId: 42, labelSnapshot: seeded.activePartyLabel },
        });
      });
      expect(service.prepareImport(nonStringId).ok).toBe(false);
      const emptyId = mutated(file, data => {
        withAsset(data, seeded.partialAssetId, {
          acquisitionParty: { partyId: "   ", labelSnapshot: seeded.activePartyLabel },
        });
      });
      expect(service.prepareImport(emptyId).ok).toBe(false);
      const missingSnapshot = mutated(file, data => {
        withAsset(data, seeded.partialAssetId, {
          acquisitionParty: { partyId: seeded.activePartyId, labelSnapshot: "" },
        });
      });
      expect(service.prepareImport(missingSnapshot).ok).toBe(false);
    });
  });
}
