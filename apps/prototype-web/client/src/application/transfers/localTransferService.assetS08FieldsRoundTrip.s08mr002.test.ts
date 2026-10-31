import "fake-indexeddb/auto";
import { afterEach, describe, expect, it } from "vitest";
import { LocalTransferService } from "./localTransferService";
import { exportCountsOf } from "./transferCounters";
import { MemoryLocalStore } from "@/storage/local/MemoryLocalStore";
import { IndexedDbLocalStore } from "@/storage/local/IndexedDbLocalStore";
import type { PrototypeLocalStore } from "@/storage/local/types";
import { localExportVersion, localSchemaVersion } from "@/storage/local/types";
import { AssetService } from "@/application/assets/assetService";
import { PartyDirectoryService } from "@/application/parties/partyLedgerService";
import { summarizeFinancialEvents } from "@micro-domain/financial-event/index.js";
import { syncSha256Hex } from "@/lib/syncSha256";

/* S08-MR-002 (أمر التنفيذ المتصل S08→S09 المنشور في ad133bae — القسم ١):
 * الانحدار الدائم end-to-end لحقلي S08 الجديدين (acquisitionParty و
 * paidAtCreationMinor) على المسار التطبيقي الحقيقي — إنشاء الأصل عبر الخدمة
 * الحقيقية (PartyDirectoryService ثم AssetService بدفع جزئي وطرف محفوظ)
 * ثم createVerifiedExport ← prepareImport للتصدير نفسه ← prepareRestore على
 * هدف نظيف ← confirmImport ← إعادة التصدير من الهدف؛ المساواة العميقة
 * لهوية الأصل ومرجع الطرف ولقطة الاسم التاريخية والمدفوع لحظة الإنشاء
 * وروابط الأحداث والتواريخ والأحداث المالية كلها — بلا إعادة تشغيل أي أثر
 * نقدي/أصولي (الاستعادة استبدال لا إعادة تشغيل). توصيف المرحّل/المُدقق
 * ليس دورة؛ هذا الاختبار هو الدورة.
 * الزوج 40/32 كما هو بلا ترقية؛ أصل قديم بلا الحقلين يعطي الترحيل null
 * الموثقة (لا اختراع طرف ولا دفع)، والمسار النقدي الكامل (المسدد كاملًا
 * عند الإنشاء) مسار صحيح لا يُرفض لوجود مثال الدفع الجزئي.
 * الإثبات عبر الاقتران المتقاطع (Memory→IndexedDB وIndexedDB→Memory):
 * التجهيز نقي مستقل عن المهايئ؛ الزوجان يثبتان تكافؤ الثبات والدورة عبر
 * المهايئين معًا (تكافؤ التخزين/التطبيق لا نسخة محلقة لكل مهايئ). */

const NOW = "2026-10-30T14:00:00.000Z";
const NOW_MS = Date.parse(NOW);
const DATABASE_NAME = "micro-prototype-local";

/** ساعة متقدمة: كل قراءة تختلف عن سابقتها. listFinancialEvents مرتبة بـ
 * recordedAt تنازليًا؛ لو تشابكت القيم تمامًا (ساعة ثابتة) صار الترتيب
 * بين المهايئين غير حتمي — الكتابات الحقيقية دائمًا بساعة متقدمة. */
function advancingClock() {
  let tick = 0;
  return () => new Date(NOW_MS + tick++ * 1000).toISOString();
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
  readonly partialAssetId: string;
  readonly archivedRefAssetId: string;
  readonly bareAssetId: string;
};

/** المصدر بالمسار الحقيقي: طرف نشط + طرف مؤرشف + ثلاثة أصول
 * (جزئي بطرف، نقدي كامل بطرف مؤرشف، نقدي كامل بلا طرف — المسار
 * النقدي الكامل صحيح ولا يُرفض لمجرد وجود مثال الدفع الجزئي). */
async function seedSource(store: PrototypeLocalStore): Promise<SeededSource> {
  const clock = advancingClock();
  const parties = new PartyDirectoryService(store, clock);
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
  const assets = new AssetService(store, clock);
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
    partialAssetId: partial.value.asset.id,
    archivedRefAssetId: archivedRef.value.asset.id,
    bareAssetId: bare.value.asset.id,
  };
}

async function seedTarget(store: PrototypeLocalStore) {
  const clock = advancingClock();
  const parties = new PartyDirectoryService(store, clock);
  const resident = await parties.save({
    label: "طرف الهدف المقيم",
    phone: null,
    note: null,
    operationKey: "target-party:create",
  });
  if (!resident.ok) throw new Error(resident.message ?? "target party should save");
  const assets = new AssetService(store, clock);
  const residentAsset = await assets.create({
    name: "أصل الهدف المقيم",
    acquisitionAmountMinor: 7000,
    acquisitionKind: "cash",
    purchaseDate: "2026-10-08",
    note: null,
  });
  if (!residentAsset.ok) throw new Error(residentAsset.message);
}

/** نسخة معدلة ببصمة وعدادات معاد حسابها — تصل إلى validateSnapshot فعلًا. */
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

/** مقارنة محتوى لا ترتيب: قوائم المتجر (listAssets/listFinancialEvents)
 * مرتبة بحدودها الداخلية وقد تُفضّل تارات متساوية التسجيل بترتيب المهايئ —
 * ترتيب القائمة ليس جزءًا من ادعاء الدورة؛ ادعاء الدورة هو بقاء المحتوى
 * نفسه بلا زيادة ولا فقد، ومصفوفات اللقطة نفسها تُقارن بترتيبها الحرفي أدناه. */
const byId = <T extends { id: string }>(left: T, right: T) =>
  left.id < right.id ? -1 : left.id > right.id ? 1 : 0;

for (const pair of pairs) {
  describe(`S08-MR-002 — دورة النقل الكاملة لحقلي S08 على المسار الحقيقي (${pair.label})`, () => {
    afterEach(async () => {
      await clearDatabase();
    });

    it("journey: إنشاء ← تصدير موثق ← prepareImport ← prepareRestore على هدف نظيف ← confirmImport ← إعادة تصدير (مساواة عميقة)", async () => {
      const source = await pair.source();
      const seeded = await seedSource(source);
      /* لقطات المصدر قبل التصدير — الدليل الذي تُقاس عليه المساواة العميقة. */
      const sourceAssets = await source.listAssets();
      if (!sourceAssets.ok) throw new Error(sourceAssets.message);
      const sourceEvents = await source.listFinancialEvents();
      if (!sourceEvents.ok) throw new Error(sourceEvents.message);
      const sourceSummaries = summarizeFinancialEvents(sourceEvents.value);

      const sourceService = new LocalTransferService(source, () => NOW);
      const exported = await sourceService.createVerifiedExport();
      if (!exported.ok) throw new Error(exported.message);
      /* الزوج الحي 40/32 كما هو — لا ترقية سلكية لأجل الإصلاح. */
      expect(exported.value.file.version).toBe(localExportVersion);
      expect(exported.value.file.schemaVersion).toBe(localSchemaVersion);
      const exportedPartial = exported.value.file.data.assets?.find(
        asset => asset.id === seeded.partialAssetId,
      );
      expect(exportedPartial?.acquisitionParty).toEqual({
        partyId: seeded.activePartyId,
        labelSnapshot: seeded.activePartyLabel,
      });
      expect(exportedPartial?.paidAtCreationMinor).toBe(4000);

      /* التصدير نفسه عبر prepareImport ثم prepareRestore على هدف نظيف ثم confirmImport. */
      const target = await pair.target();
      await seedTarget(target);
      const targetService = new LocalTransferService(target, () => NOW);
      const text = JSON.stringify(exported.value.file);
      const prepared = targetService.prepareImport(text);
      expect(prepared.ok).toBe(true);
      const restored = await targetService.prepareRestore(text);
      expect(restored.ok).toBe(true);
      if (!restored.ok) throw new Error(restored.message);
      const applied = await targetService.confirmImport(restored.value);
      if (!applied.ok) throw new Error(applied.message);

      /* السجلات: مساواة عميقة للمحتوى — الهوية والمرجع واللقطة والمدفوع وروابط
       * الأحداث والتواريخ؛ لا حقول مبتدأة ولا قيم مغسولة (بالمحتوى لا بالترتيب —
       * ترتيب القائمة ليس جزءًا من الدورة؛ مصفوفة اللقطة تُقارن حرفيًا أدناه). */
      const targetAssets = await target.listAssets();
      if (!targetAssets.ok) throw new Error(targetAssets.message);
      expect([...targetAssets.value].sort(byId)).toEqual([...sourceAssets.value].sort(byId));
      const targetPartial = targetAssets.value.find(asset => asset.id === seeded.partialAssetId);
      expect(targetPartial?.acquisitionParty).toEqual({
        partyId: seeded.activePartyId,
        labelSnapshot: seeded.activePartyLabel,
      });
      expect(targetPartial?.paidAtCreationMinor).toBe(4000);
      expect(targetPartial?.acquisitionEventId).toBe(
        sourceAssets.value.find(asset => asset.id === seeded.partialAssetId)?.acquisitionEventId,
      );

      /* الأحداث المالية: الاستعادة استبدال لا إعادة تشغيل — أحداث الهدف هي
       * أحداث المصدر نفسها بالضبط؛ لا أثر نقدي/أصولي/ذمم مُعاد ولا حدث زائد
       * (بالمحتوى؛ حدثا الاقتناء الجزئي يتشاركان لحظة تسجيل واحدة بتصميم
       * المعاملة الذرية فترتيب القائمة بين المهايئين ليس جزءًا من الدورة). */
      const targetEvents = await target.listFinancialEvents();
      if (!targetEvents.ok) throw new Error(targetEvents.message);
      expect([...targetEvents.value].sort(byId)).toEqual([...sourceEvents.value].sort(byId));
      expect(summarizeFinancialEvents(targetEvents.value)).toEqual(sourceSummaries);
      expect(targetEvents.value).toHaveLength(4);

      /* الأطراف: الطرف المؤرشف يعبر بأرشفته التاريخية — هوية مرجعية صالحة
       * حاضرة في العائلة؛ لا إعادة بناء بالاسم ولا طرف ثالث مبتدأ. */
      const targetParties = await target.listCounterparties();
      if (!targetParties.ok) throw new Error(targetParties.message);
      expect(targetParties.value).toHaveLength(2);
      expect(targetParties.value.find(party => party.id === seeded.archivedPartyId)?.archivedAt).toBeTruthy();

      /* إعادة التصدير من الهدف تحمل كل شيء كما خرج أولًا (بالمحتوى — مصفوفات
       * اللقطة بين المهايئين تختلف في الترتيب بحكم قراءة المفتاح الأساسي في
       * IndexedDB مقابل ترتيب الإدراج في الذاكرة؛ الترتيب ليس جزءًا من عقد
       * البيانات، والمحتوى هو ادعاء الدورة). */
      const reExport = await targetService.createVerifiedExport();
      if (!reExport.ok) throw new Error(reExport.message);
      expect([...(reExport.value.file.data.assets ?? [])].sort(byId)).toEqual(
        [...(exported.value.file.data.assets ?? [])].sort(byId),
      );
      expect([...reExport.value.file.data.financialEvents].sort(byId)).toEqual(
        [...exported.value.file.data.financialEvents].sort(byId),
      );
      expect([...(reExport.value.file.data.counterparties ?? [])].sort(byId)).toEqual(
        [...(exported.value.file.data.counterparties ?? [])].sort(byId),
      );
    });

    it("legacy: أصل بلا الحقلين على الزوج 40/32 — الترحيل يعطي null الموثقة بلا اختراع طرف أو دفع أو تاريخ", async () => {
      const source = await pair.source();
      const seeded = await seedSource(source);
      const sourceService = new LocalTransferService(source, () => NOW);
      const exported = await sourceService.createVerifiedExport();
      if (!exported.ok) throw new Error(exported.message);
      /* حذف الحقلين تمامًا من ملف حي (شكل ما قبل S08) ثم إعادة ختم البصمة والعدادات. */
      const legacyText = mutated(exported.value.file, data => {
        data.assets = (data.assets as Record<string, unknown>[]).map(asset => {
          if ((asset as Record<string, unknown>).id !== seeded.bareAssetId) return asset;
          const rest = { ...(asset as Record<string, unknown>) };
          delete rest.acquisitionParty;
          delete rest.paidAtCreationMinor;
          return rest;
        });
      });
      const target = await pair.target();
      const targetService = new LocalTransferService(target, () => NOW);
      const prepared = targetService.prepareImport(legacyText);
      expect(prepared.ok).toBe(true);
      const restored = await targetService.prepareRestore(legacyText);
      expect(restored.ok).toBe(true);
      if (!restored.ok) throw new Error(restored.message);
      const applied = await targetService.confirmImport(restored.value);
      if (!applied.ok) throw new Error(applied.message);
      const targetAssets = await target.listAssets();
      if (!targetAssets.ok) throw new Error(targetAssets.message);
      const legacy = targetAssets.value.find(asset => asset.id === seeded.bareAssetId);
      /* الترحيل: الغياب = null الموثقة — لا طرف مبتدأ ولا دفع مختلق (null لا 0). */
      expect(legacy?.acquisitionParty ?? null).toBeNull();
      expect(legacy?.paidAtCreationMinor ?? null).toBeNull();
      /* معنى الاقتناء الأصلي يبقى مقروءًا كما هو: القيمة وحدثها ورابطه. */
      expect(legacy?.acquisitionAmountMinor).toBe(5000);
      expect(legacy?.acquisitionEventId).toBeTruthy();
      const targetEvents = await target.listFinancialEvents();
      if (!targetEvents.ok) throw new Error(targetEvents.message);
      const legacyEvents = targetEvents.value.filter(
        event => event.assetContext?.assetId === seeded.bareAssetId,
      );
      expect(legacyEvents).toHaveLength(1);
      expect(legacyEvents[0]?.cashDeltaMinor).toBe(-5000);
      const targetParties = await target.listCounterparties();
      expect(targetParties.ok && targetParties.value).toHaveLength(2);
    });

    it("malformed: المراجع المكسورة تُرفض قبل المعاينة والهدف لا يُمس (معرف معلق وpaidAtCreationMinor غير صالحة)", async () => {
      const source = await pair.source();
      const seeded = await seedSource(source);
      const sourceService = new LocalTransferService(source, () => NOW);
      const exported = await sourceService.createVerifiedExport();
      if (!exported.ok) throw new Error(exported.message);
      const target = await pair.target();
      await seedTarget(target);
      const before = await target.readSnapshot();
      if (!before.ok) throw new Error(before.message);
      const targetService = new LocalTransferService(target, () => NOW);
      const mutations: ReadonlyArray<[string, (data: Record<string, unknown>) => void]> = [
        [
          "dangling saved-party id",
          data => {
            withAsset(data, seeded.partialAssetId, {
              acquisitionParty: { partyId: "party-missing", labelSnapshot: seeded.activePartyLabel },
            });
          },
        ],
        [
          "paidAtCreationMinor zero",
          data => {
            withAsset(data, seeded.partialAssetId, { paidAtCreationMinor: 0 });
          },
        ],
        [
          "paidAtCreationMinor negative",
          data => {
            withAsset(data, seeded.partialAssetId, { paidAtCreationMinor: -1 });
          },
        ],
        [
          "paidAtCreationMinor not strictly below the acquisition amount",
          data => {
            withAsset(data, seeded.partialAssetId, { paidAtCreationMinor: 10000 });
          },
        ],
        [
          "paidAtCreationMinor non-integer",
          data => {
            withAsset(data, seeded.partialAssetId, { paidAtCreationMinor: 1.5 });
          },
        ],
        [
          "paidAtCreationMinor unsafe",
          data => {
            withAsset(data, seeded.partialAssetId, { paidAtCreationMinor: 2 ** 53 });
          },
        ],
      ];
      for (const [label, mutate] of mutations) {
        const text = mutated(exported.value.file, mutate);
        const rejected = targetService.prepareImport(text);
        expect(rejected.ok, label).toBe(false);
        const restoreRejected = await targetService.prepareRestore(text);
        expect(restoreRejected.ok, label).toBe(false);
      }
      /* لا استبدال حدث — اللقطة المحلية كما كانت بالضبط بعد كل رفض. */
      const after = await target.readSnapshot();
      if (!after.ok) throw new Error(after.message);
      expect(after.value).toEqual(JSON.parse(JSON.stringify(before.value)));
      const parties = await target.listCounterparties();
      expect(parties.ok && parties.value).toHaveLength(1);
      const assets = await target.listAssets();
      expect(assets.ok && assets.value).toHaveLength(1);
    });
  });
}
