/**
 * S12-TRANSFER-001 (أمر S13 2158b0fc §5 — موجدة المراجعة المستقلة عند
 * ac4429ef): القيمة الحاضرة المشوهة في followUpEvents لم تعد تُمحى بصمت —
 * ملف تصدير سليم المظروف (بصمة sha256 معاد حسابها وعدادات صحيحة) يحمل
 * طلبًا واحدًا صالحًا كاملًا قُلب حقل أحداث متابعته إلى قيمة مشوهة حاضرة
 * (نص/كائن/null) يُرفض قبل المعاينة والكتابة على الزوج الحالي 33/40 وعلى
 * الزوج الموروث المدعوم 32/40 معًا، ويبقى المخزن الهدف بالبايت/السجل كما
 * كان — لا محو بيانات حاضرة ولا استيراد نصف نجاح.
 *
 * S12-TRANSFER-001 (أمر S14 ba2ce7b4 §3 — إغلاقا شهادة الاختبار): الهدف
 * غير الفارغ المزروع (سجلات قائمة قبل المحاولة) يُضاف لكل زوج — مساواة
 * اللقطة الكاملة قبل/بعد بالبايت/السجل تثبت أن الرفض لا يمس البيانات
 * القائمة أصلًا؛ وحالة IndexedDB حقيقية (fake-indexeddb) للاستعادة
 * والتحقق معًا تُغلق فجوة المهايئ — الرفض عند المهايئين لا الذاكرة وحدها.
 */
import "fake-indexeddb/auto";
import { afterEach, describe, expect, it } from "vitest";
import { LocalTransferService } from "./localTransferService";
import { MemoryLocalStore } from "@/storage/local/MemoryLocalStore";
import { IndexedDbLocalStore } from "@/storage/local/IndexedDbLocalStore";
import { syncSha256Hex } from "@/lib/syncSha256";
import { calculateCostSnapshot, createCraftOrder } from "@micro-domain/craft-order/index.js";

const NOW = "2026-11-01T09:00:00.000Z";
const now = () => NOW;

const DATABASE_NAME = "micro-prototype-local";
function clearDatabase(): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    const request = indexedDB.deleteDatabase(DATABASE_NAME);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}
afterEach(clearDatabase);

/** ملف تصدير حقيقي كامل: طلب واحد صالح (بمواعيد متابعة فارغة سليمة) من
 * * مصدر حقيقي عبر المهايئ — لا شكل ملف يدوي. */
async function realExportFile(): Promise<Record<string, unknown>> {
  const store = new MemoryLocalStore();
  const cost = calculateCostSnapshot("s12t-cost", {
    source: "draft",
    currency: "JOD",
    materialItems: [],
    time: { minutes: 60, hourlyRateMinor: 500, confidence: "known" },
    packagingMinor: 0,
    deliveryMinor: 0,
    wasteMinor: 0,
    safetyBufferMinor: 0,
    quantity: 1,
    createdAt: NOW,
    freshnessDays: null,
  });
  const order = createCraftOrder({
    id: "s12t-order",
    customerName: "سارة",
    itemName: "صندوق فحص الأحداث المشوهة",
    specifications: "اختبار",
    quantity: 1,
    agreedPriceMinor: 2000,
    costSnapshot: cost,
    createdAt: NOW,
  });
  const saved = await store.saveOrder({
    catalogItemId: null,
    id: order.id,
    order,
    deliveryDate: "2026-11-20",
    agreementSource: null,
    followUpSummary: null,
    followUpDate: null,
    followUpReason: null,
    followUpEvents: [],
    createdAt: NOW,
    updatedAt: NOW,
  });
  if (!saved.ok) throw new Error(saved.message);
  const exported = await new LocalTransferService(store, now).createExport();
  if (!exported.ok) throw new Error(exported.message);
  return structuredClone(exported.value) as unknown as Record<string, unknown>;
}

/** بذل القيمة المشوهة الحاضرة مع إعادة إحكام المظروف — البصمة تُعاد على
 * البيانات المتغيرة والعدادات صادقة (طلب واحد كما هو). */
function tamperedFollowUpEvents(
  file: Record<string, unknown>,
  malformed: unknown,
  version: number,
  schemaVersion: number,
): string {
  const data = file.data as { orders: Array<Record<string, unknown>> };
  data.orders[0]!.followUpEvents = malformed;
  file.version = version;
  file.schemaVersion = schemaVersion;
  file.integrity = { algorithm: "sha256", digest: syncSha256Hex(JSON.stringify(data)) };
  return JSON.stringify(file);
}

const PAIRS: ReadonlyArray<readonly [number, number, string]> = [
  [33, 40, "الزوج الحالي 33/40"],
  [32, 40, "الزوج الموروث 32/40"],
];

const MALFORMED: ReadonlyArray<readonly [string, unknown]> = [
  ["نص", "حدث مشوه"],
  ["كائن", { id: "ليس حدثًا", type: 1 }],
  ["null", null],
];

/** S12-TRANSFER-001 (أمر ba2ce7b4 §3): هدف غير فارغ مزروع — طلب قائم بمعرف
 * مختلف عن ملف التصدير وبيع مباشر قائم، عبر حدود الكتابة الحقيقية للمهايئ
 * نفسه (لا بذر لقطة خام)؛ يثبت أن الرفض لا يمس السجلات القائمة أصلًا. */
async function seededTarget<
  T extends import("@/storage/local/types").PrototypeLocalStore,
>(store: T): Promise<T> {
  const cost = calculateCostSnapshot("s12t-target-cost", {
    source: "draft",
    currency: "JOD",
    materialItems: [],
    time: { minutes: 30, hourlyRateMinor: 400, confidence: "known" },
    packagingMinor: 0,
    deliveryMinor: 0,
    wasteMinor: 0,
    safetyBufferMinor: 0,
    quantity: 1,
    createdAt: NOW,
    freshnessDays: null,
  });
  const order = createCraftOrder({
    id: "s12t-target-order",
    customerName: "ليلى",
    itemName: "طلب قائم في الهدف",
    specifications: "بيانات قائمة قبل المحاولة",
    quantity: 1,
    agreedPriceMinor: 3000,
    costSnapshot: cost,
    createdAt: NOW,
  });
  const saved = await store.saveOrder({
    catalogItemId: null,
    id: order.id,
    order,
    deliveryDate: "2026-11-15",
    agreementSource: null,
    followUpSummary: null,
    followUpDate: null,
    followUpReason: null,
    followUpEvents: [],
    createdAt: NOW,
    updatedAt: NOW,
  });
  if (!saved.ok) throw new Error(saved.message);
  const saleSaved = await store.saveDirectSale({
    id: "s12t-target-sale",
    itemName: "بيع قائم في الهدف",
    quantity: 1,
    currency: "JOD",
    revenueMinor: 1500,
    collectedMinor: 1500,
    collectionStatus: "collected_in_full",
    catalogItemId: null,
    customerName: null,
    customerPartyId: null,
    costMinor: null,
    profitMinor: null,
    occurredOn: "2026-11-01",
    recordedAt: NOW,
    note: "بيانات قائمة قبل المحاولة",
    idempotencyKey: "s12t-target-sale-key",
    status: "active",
    cancelledAt: null,
    cancellationReason: null,
    revisions: [],
  });
  if (!saleSaved.ok) throw new Error(saleSaved.message);
  return store;
}

describe("S12-TRANSFER-001 — الأحداث الحاضرة المشوهة لا تُمحى: رفض صادق قبل المعاينة والكتابة", () => {
  for (const [version, schemaVersion, pairLabel] of PAIRS) {
    for (const [kind, value] of MALFORMED) {
      it(`${pairLabel}: followUpEvents حاضر مشوه (${kind}) — مظروف سليم والرفض قبل أي كتابة`, async () => {
        const file = await realExportFile();
        const text = tamperedFollowUpEvents(file, value, version, schemaVersion);
        const target = new MemoryLocalStore();
        const before = await target.readSnapshot();
        if (!before.ok) throw new Error("before read failed");
        const transfers = new LocalTransferService(target, now);

        /* الرفض عند التحقق قبل المعاينة — لا قيمة معاينة تُنتج أصلًا. */
        const importResult = transfers.prepareImport(text);
        expect(importResult).toMatchObject({ ok: false, code: "validation_error" });
        const restoreResult = await transfers.prepareRestore(text);
        expect(restoreResult).toMatchObject({ ok: false, code: "validation_error" });

        /* المخزن الهدف بالبايت/السجل كما كان — لم تمسه أي كتابة. */
        const after = await target.readSnapshot();
        if (!after.ok) throw new Error("after read failed");
        expect(after.value).toEqual(before.value);
      });
    }
  }

  /* ── S12-TRANSFER-001 (أمر ba2ce7b4 §3): الهدف غير الفارغ المزروع ── */

  for (const [version, schemaVersion, pairLabel] of PAIRS) {
    it(`${pairLabel}: هدف مزروع غير فارغ — الرفض لا يمس السجلات القائمة أصلًا`, async () => {
      const file = await realExportFile();
      const text = tamperedFollowUpEvents(file, { id: "ليس حدثًا", type: 1 }, version, schemaVersion);
      const target = await seededTarget(new MemoryLocalStore());
      const before = await target.readSnapshot();
      if (!before.ok) throw new Error("before read failed");
      /* البيانات المزروعة قائمة فعلًا قبل المحاولة — اللقطة ليست فارغة. */
      if (
        (before.value.orders ?? []).length !== 1 ||
        (before.value.directSales ?? []).length !== 1
      )
        throw new Error("seeded target must carry an order and a direct sale");
      const transfers = new LocalTransferService(target, now);

      const importResult = transfers.prepareImport(text);
      expect(importResult).toMatchObject({ ok: false, code: "validation_error" });
      const restoreResult = await transfers.prepareRestore(text);
      expect(restoreResult).toMatchObject({ ok: false, code: "validation_error" });

      /* مساواة اللقطة الكاملة قبل/بعد — لا محو ولا تعديل ولا سجل يتيم. */
      const after = await target.readSnapshot();
      if (!after.ok) throw new Error("after read failed");
      expect(after.value).toEqual(before.value);
    });
  }

  /* ── S12-TRANSFER-001 (أمر ba2ce7b4 §3): حالة IndexedDB حقيقية ── */

  it("IndexedDB (fake-indexeddb): prepareRestore وprepareImport معًا يرفضان المشوه الحاضر والقاعدة بالبايت كما هي", async () => {
    await clearDatabase();
    const file = await realExportFile();
    const text = tamperedFollowUpEvents(file, "حدث مشوه", 33, 40);
    const target = new IndexedDbLocalStore();
    const seeded = await seededTarget(target);
    const before = await seeded.readSnapshot();
    if (!before.ok) throw new Error("before read failed");
    if (
      (before.value.orders ?? []).length !== 1 ||
      (before.value.directSales ?? []).length !== 1
    )
      throw new Error("seeded IndexedDB target must carry an order and a direct sale");
    const transfers = new LocalTransferService(seeded, now);

    const importResult = transfers.prepareImport(text);
    expect(importResult).toMatchObject({ ok: false, code: "validation_error" });
    const restoreResult = await transfers.prepareRestore(text);
    expect(restoreResult).toMatchObject({ ok: false, code: "validation_error" });

    /* القاعدة بالبايت/السجل كما كانت — الرفض عند المهايئ الحقيقي لا الذاكرة وحدها. */
    const after = await seeded.readSnapshot();
    if (!after.ok) throw new Error("after read failed");
    expect(after.value).toEqual(before.value);
  });

  it("الغياب الحقيقي للحقل يبقى قيمة افتراضية مشروعة — لا يوسّع الرفض إلى الغائب", async () => {
    /* حذف الحقل كليًا (غياب حقيقي) = افتراض [] عند الترحيل كما كان — التمييز
     * بين الغياب والحضور المشوه هو عقد الإصلاح نفسه. */
    const file = await realExportFile();
    const data = file.data as { orders: Array<Record<string, unknown>> };
    delete data.orders[0]!.followUpEvents;
    file.integrity = { algorithm: "sha256", digest: syncSha256Hex(JSON.stringify(data)) };
    const prepared = new LocalTransferService(new MemoryLocalStore(), now).prepareImport(
      JSON.stringify(file),
    );
    expect(prepared).toMatchObject({ ok: true });
    if (!prepared.ok) throw new Error(prepared.message);
    expect(prepared.value.file.data.orders[0]?.followUpEvents).toEqual([]);
  });

  it("مصفوفة سليمة من الأحداث تعبر كما هي — الإصلاح لا يضيّق الصالح القائم", async () => {
    const file = await realExportFile();
    const data = file.data as { orders: Array<Record<string, unknown>> };
    data.orders[0]!.followUpEvents = [
      {
        id: "s12t-followup-1",
        type: "created",
        idempotencyKey: "s12t-followup-1",
        createdAt: NOW,
        previousDate: null,
        followUpDate: "2026-11-25",
        reason: "مراجعة بعد التسليم",
      },
    ];
    file.integrity = { algorithm: "sha256", digest: syncSha256Hex(JSON.stringify(data)) };
    const prepared = new LocalTransferService(new MemoryLocalStore(), now).prepareImport(
      JSON.stringify(file),
    );
    expect(prepared).toMatchObject({ ok: true });
  });
});
