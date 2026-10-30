import "fake-indexeddb/auto";
import { afterEach, describe, expect, it } from "vitest";
import { DraftService } from "./draftService";
import { CostService, type GroupedCostEditorInput } from "@/application/cost/costService";
import { LocalTransferService } from "@/application/transfers/localTransferService";
import { exportCountsOf } from "@/application/transfers/transferCounters";
import { MemoryLocalStore } from "@/storage/local/MemoryLocalStore";
import { IndexedDbLocalStore } from "@/storage/local/IndexedDbLocalStore";
import type { PrototypeLocalStore } from "@/storage/local/types";
import { syncSha256Hex } from "@/lib/syncSha256";

/* S09 (UNIT-007/008/029 — أمر التنفيذ المتصل ad133bae القسم ٢): اختبارات
 * الشريحة المركزة — تحقق حقول المسودة الجديدة قبل أي كتابة (المجموعات
 * والمرجع الموسوم والسعر المقترح)، ومسار التكلفة المجمعة عبر النواة الواحدة
 * بعد التوسيع (الضرب مرة واحدة)، ودورة النقل للحقول الجديدة على المهايئين
 * مع رفض المرجع المعلق قبل المعاينة (نمط S05-MR-001 نفسه). */

const NOW = "2026-10-30T16:00:00.000Z";
const DATABASE_NAME = "micro-prototype-local";

function clearDatabase(): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    const request = indexedDB.deleteDatabase(DATABASE_NAME);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
    request.onblocked = () => resolve();
  });
}

const stores: ReadonlyArray<{
  label: string;
  make: () => PrototypeLocalStore | Promise<PrototypeLocalStore>;
}> = [
  { label: "Memory", make: () => new MemoryLocalStore() },
  {
    label: "IndexedDB",
    make: async () => {
      await clearDatabase();
      return new IndexedDbLocalStore();
    },
  },
];

const validRef = {
  catalogItemId: "cat-1",
  templateId: null as string | null,
  revision: null as number | null,
  nameSnapshot: "صندوق هدايا",
  takenAt: NOW,
};

describe.each(stores)("S09 draft fields + grouped cost + transfer ($label)", ({ make }) => {
  afterEach(async () => {
    await clearDatabase();
  });

  it("saves a draft with groups, a stamped offering ref, and a suggested price; recovery keeps them", async () => {
    const store = await make();
    const drafts = new DraftService(store, () => NOW);
    const created = await drafts.create("customer_order", {
      itemName: "صندوق هدايا",
      customerName: "سامي",
      quantity: 13,
      offeringRef: validRef,
      suggestedPriceMinor: 25000,
      groups: [
        {
          id: "g1",
          label: "صندوق بشوكولاتتين",
          repeatQuantity: 10,
          offeringType: "product",
          offeringRef: validRef,
          note: "مكونات صندوق واحد",
        },
        {
          id: "g2",
          label: "مجموعة ثانية",
          repeatQuantity: 3,
          offeringType: "service",
          offeringRef: null,
          note: null,
        },
      ],
    });
    if (!created.ok) throw new Error(created.message);
    expect(created.draft.groups?.map(group => [group.label, group.repeatQuantity])).toEqual([
      ["صندوق بشوكولاتتين", 10],
      ["مجموعة ثانية", 3],
    ]);
    expect(created.draft.offeringRef).toEqual(validRef);
    expect(created.draft.suggestedPriceMinor).toBe(25000);
    /* الاستعادة تقرأ السجل الحي كما حُفظ — هوية واحدة بلا تكرار. */
    const reread = await drafts.get(created.draft.id);
    expect(reread.ok && reread.value?.groups).toHaveLength(2);
    expect(reread.ok && reread.value?.suggestedPriceMinor).toBe(25000);
    /* قائمة فارغة من المجموعات تُطبع null (بلا مجموعات كما كان). */
    const { updatedAt: _ignored, ...rest } = created.draft;
    const emptied = await drafts.save({ ...rest, groups: [] });
    if (!emptied.ok) throw new Error(emptied.message);
    expect(emptied.draft.groups ?? null).toBeNull();
  });

  it("rejects invalid groups, refs, and suggested prices before any write", async () => {
    const store = await make();
    const drafts = new DraftService(store, () => NOW);
    const cases: ReadonlyArray<Partial<Parameters<DraftService["create"]>[1]>> = [
      {
        groups: [
          {
            id: "g1",
            label: "مجموعة",
            repeatQuantity: 0,
            offeringType: "product",
            offeringRef: null,
            note: null,
          },
        ],
      },
      {
        groups: [
          {
            id: "g1",
            label: "مجموعة",
            repeatQuantity: 1.5,
            offeringType: "product",
            offeringRef: null,
            note: null,
          },
        ],
      },
      {
        groups: [
          {
            id: "",
            label: "مجموعة",
            repeatQuantity: 2,
            offeringType: "product",
            offeringRef: null,
            note: null,
          },
        ],
      },
      {
        groups: [
          { id: "g1", label: "", repeatQuantity: 2, offeringType: "product", offeringRef: null, note: null },
        ],
      },
      {
        groups: [
          { id: "g1", label: "أ", repeatQuantity: 2, offeringType: "product", offeringRef: null, note: null },
          { id: "g1", label: "ب", repeatQuantity: 2, offeringType: "product", offeringRef: null, note: null },
        ],
      },
      {
        groups: [
          {
            id: "g1",
            label: "مجموعة",
            repeatQuantity: 2,
            offeringType: "widget" as "product",
            offeringRef: null,
            note: null,
          },
        ],
      },
      { offeringRef: { ...validRef, catalogItemId: "   " } },
      { offeringRef: { ...validRef, nameSnapshot: "" } },
      { suggestedPriceMinor: -1 },
      { suggestedPriceMinor: 12.5 },
    ];
    for (const patch of cases) {
      const result = await drafts.create("customer_order", patch);
      expect(result.ok, JSON.stringify(patch)).toBe(false);
      if (!result.ok) expect(result.code).toBe("validation_error");
    }
    const lists = await drafts.list();
    expect(lists.ok && lists.value).toHaveLength(0);
    /* الصريح 0 للسعر المقترح صحيح (لا حد أدنى — CONS-DEC07). */
    const zeroPrice = await drafts.create("customer_order", {
      itemName: "اقتراح بلا حد",
      suggestedPriceMinor: 0,
    });
    expect(zeroPrice.ok && zeroPrice.draft.suggestedPriceMinor).toBe(0);
  });

  it("saves a grouped cost snapshot through the one kernel with multiply-once and documented basis", async () => {
    const store = await make();
    const drafts = new DraftService(store, () => NOW);
    const created = await drafts.create("customer_order", {
      itemName: "صندوق هدايا",
      quantity: 13,
      groups: [
        {
          id: "g1",
          label: "صندوق بشوكولاتتين",
          repeatQuantity: 10,
          offeringType: "product",
          offeringRef: null,
          note: null,
        },
        {
          id: "g2",
          label: "كيس مكسرات",
          repeatQuantity: 3,
          offeringType: "product",
          offeringRef: null,
          note: null,
        },
      ],
    });
    if (!created.ok) throw new Error(created.message);
    const costs = new CostService(store, () => NOW);
    const input: GroupedCostEditorInput = {
      groupBasis: [
        {
          groupId: "g1",
          label: "صندوق بشوكولاتتين",
          repeatQuantity: 10,
          unitMaterialItems: [
            { name: "شوكولاتة فاخرة", quantity: 0.2, unit: "قطعة", unitPriceMinor: 150, confidence: "known" },
            { name: "شوكولاتة عادية", quantity: 0.1, unit: "قطعة", unitPriceMinor: 250, confidence: "known" },
          ],
        },
        {
          groupId: "g2",
          label: "كيس مكسرات",
          repeatQuantity: 3,
          unitMaterialItems: [
            { name: "مكسرات", quantity: 0.5, unit: "كيس", unitPriceMinor: 400, confidence: "known" },
          ],
        },
      ],
      time: { minutes: 30, hourlyRateMinor: 600, confidence: "known" },
      packagingMinor: 200,
      deliveryMinor: 300,
      wasteMinor: 100,
      safetyBufferMinor: 50,
    };
    const saved = await costs.saveGroupedSnapshot(created.draft, input);
    if (!saved.ok) throw new Error(saved.message);
    /* SDF-034: مواد 1150 + وقت 300 + تغليف 200 + توصيل 300 (مرة واحدة) + هدر 100 = 2050. */
    expect(saved.snapshot.plannedCostMinor).toBe(2050);
    expect(saved.snapshot.quantity).toBe(13);
    expect(saved.snapshot.unitCostMinor).toBe(158);
    /* السجل يحمل المدخل الموسع + الأساس الموثق قبل التوسيع. */
    const reread = await drafts.get(created.draft.id);
    if (!reread.ok || !reread.value) throw new Error("draft should read");
    const record = reread.value.costSnapshots[0]!;
    expect(record.groupBasis?.map(group => [group.groupId, group.repeatQuantity])).toEqual([
      ["g1", 10],
      ["g2", 3],
    ]);
    expect(record.materialItems.map(item => [item.name, item.quantity])).toEqual([
      ["شوكولاتة فاخرة", 2],
      ["شوكولاتة عادية", 1],
      ["مكسرات", 1.5],
    ]);
    expect(reread.value.activeCostSnapshotId).toBe(record.id);
    /* المعاينة الحية تساوي المحفوظ — نواة واحدة لا محركين. */
    const preview = costs.previewGrouped(input);
    expect(preview.ok && preview.snapshot.plannedCostMinor).toBe(saved.snapshot.plannedCostMinor);
  });

  it("round-trips the new draft fields through export/restore and rejects a dangling offering ref before preview", async () => {
    const store = await make();
    const drafts = new DraftService(store, () => NOW);
    const created = await drafts.create("customer_order", {
      itemName: "صندوق هدايا",
      quantity: 13,
      offeringRef: validRef,
      suggestedPriceMinor: 25000,
      groups: [
        {
          id: "g1",
          label: "صندوق",
          repeatQuantity: 10,
          offeringType: "product",
          offeringRef: validRef,
          note: null,
        },
        {
          id: "g2",
          label: "ثانية",
          repeatQuantity: 3,
          offeringType: "service",
          offeringRef: null,
          note: null,
        },
      ],
    });
    if (!created.ok) throw new Error(created.message);
    const costs = new CostService(store, () => NOW);
    const saved = await costs.saveGroupedSnapshot(created.draft, {
      groupBasis: [
        {
          groupId: "g1",
          label: "صندوق",
          repeatQuantity: 10,
          unitMaterialItems: [
            { name: "شوكولاتة", quantity: 0.2, unit: "قطعة", unitPriceMinor: 150, confidence: "known" },
          ],
        },
        {
          groupId: "g2",
          label: "ثانية",
          repeatQuantity: 3,
          unitMaterialItems: [
            { name: "خدمة", quantity: 1, unit: "مرة", unitPriceMinor: 400, confidence: "known" },
          ],
        },
      ],
      time: null,
      packagingMinor: 0,
      deliveryMinor: 300,
      wasteMinor: 0,
      safetyBufferMinor: 0,
    });
    if (!saved.ok) throw new Error(saved.message);
    /* التصدير يتطلب عائلة الكتالوج الحاضرة للمرجع الموسوم — زرع عرض واحد صالح. */
    const seeded = await seedOneCatalogItem(store);
    const service = new LocalTransferService(store, () => NOW);
    const exported = await service.createVerifiedExport();
    if (!exported.ok) throw new Error(exported.message);
    expect(exported.value.file.data.drafts?.[0]?.offeringRef).toEqual(validRef);
    expect(exported.value.file.data.drafts?.[0]?.groups).toHaveLength(2);
    expect(exported.value.file.data.drafts?.[0]?.suggestedPriceMinor).toBe(25000);
    expect(exported.value.file.data.drafts?.[0]?.costSnapshots[0]?.groupBasis).toHaveLength(2);
    /* دورة كاملة على هدف نظيف. */
    const target = new MemoryLocalStore();
    const targetService = new LocalTransferService(target, () => NOW);
    const text = JSON.stringify(exported.value.file);
    expect(targetService.prepareImport(text).ok).toBe(true);
    const restored = await targetService.prepareRestore(text);
    expect(restored.ok).toBe(true);
    if (!restored.ok) throw new Error(restored.message);
    const applied = await targetService.confirmImport(restored.value);
    if (!applied.ok) throw new Error(applied.message);
    const reread = await new DraftService(target, () => NOW).list();
    expect(reread.ok && reread.value[0]?.offeringRef).toEqual(validRef);
    expect(reread.ok && reread.value[0]?.groups).toHaveLength(2);
    expect(reread.ok && reread.value[0]?.suggestedPriceMinor).toBe(25000);
    expect(reread.ok && reread.value[0]?.costSnapshots[0]?.groupBasis).toHaveLength(2);
    expect(seeded).toBeTruthy();
    /* المرجع المعلق يُرفض قبل المعاينة وقبل أي كتابة هدف (نمط S05-MR-001). */
    const before = await target.readSnapshot();
    if (!before.ok) throw new Error(before.message);
    const tampered = JSON.parse(JSON.stringify(exported.value.file)) as Record<string, unknown>;
    const data = tampered.data as Record<string, unknown>;
    (data.drafts as Record<string, unknown>[])[0]!.offeringRef = {
      ...validRef,
      catalogItemId: "cat-missing",
    };
    tampered.integrity = { algorithm: "sha256", digest: syncSha256Hex(JSON.stringify(data)) };
    tampered.counts = exportCountsOf(data as Parameters<typeof exportCountsOf>[0]);
    expect(targetService.prepareImport(JSON.stringify(tampered)).ok).toBe(false);
    expect((await targetService.prepareRestore(JSON.stringify(tampered))).ok).toBe(false);
    const after = await target.readSnapshot();
    if (!after.ok) throw new Error(after.message);
    expect(after.value).toEqual(JSON.parse(JSON.stringify(before.value)));
    /* والغياب التام للحقول الجديدة (ملف ما قبل S09) يبقى مقبولًا كما كان. */
    const legacy = JSON.parse(JSON.stringify(exported.value.file)) as Record<string, unknown>;
    const legacyData = legacy.data as Record<string, unknown>;
    for (const draft of legacyData.drafts as Record<string, unknown>[]) {
      delete draft.offeringRef;
      delete draft.groups;
      delete draft.suggestedPriceMinor;
      for (const snapshot of draft.costSnapshots as Record<string, unknown>[]) delete snapshot.groupBasis;
    }
    legacy.integrity = { algorithm: "sha256", digest: syncSha256Hex(JSON.stringify(legacyData)) };
    legacy.counts = exportCountsOf(legacyData as Parameters<typeof exportCountsOf>[0]);
    expect(targetService.prepareImport(JSON.stringify(legacy)).ok).toBe(true);
  });
});

/** زرع عرض واحد صالح في عائلة الكتالوج — المرجع الموسوم يجب أن يحلّ داخلها. */
async function seedOneCatalogItem(store: PrototypeLocalStore): Promise<boolean> {
  const storeAsAny = store as unknown as {
    saveCatalogItem: (item: unknown) => Promise<{ ok: boolean }>;
  };
  const saved = await storeAsAny.saveCatalogItem({
    id: "cat-1",
    kind: "product",
    name: "صندوق هدايا",
    unitLabel: "صندوق",
    unitId: null,
    defaultPriceMinor: null,
    defaultUnitCostMinor: null,
    active: true,
    createdAt: NOW,
    updatedAt: NOW,
    createdOperationKey: "cat-1:create",
  });
  return saved.ok;
}
