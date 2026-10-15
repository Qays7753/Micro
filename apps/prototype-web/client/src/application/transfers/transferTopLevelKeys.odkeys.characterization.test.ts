/**
 * R11 W2a / OD-KEYS (موجة المتابعة 2026-10-15): توصيف مفاتيح data العلوية
 * للزوج الحالي (Schema 38, Export 30) — مرحلة الأدلة قبل أي تغيير سلوك.
 *
 * يثبت هذا الملف (اختباريًا فقط — لا تغيير إنتاجي):
 *  1) اشتقاق مجموعة المفاتيح المسموحة من سجل العائلات الـ31 الكنوني زائد
 *     المفاتيح غير العائلية التي يصدرها المصدّر نفسه (35 مفتاحًا) لا من
 *     قائمة يدوية عامة.
 *  2) كامل جسد مصدّر الزوج الحالي (ذهبيا 30/38 + تصدير حي فوق المهايئين)
 *     لا ينتج أي مفتاح خارج المجموعة المسموحة — شرط W2-2 الأول.
 *  3) توصيف السلوك الحالي بالضبط: مفتاح data علوي مجهول في ملف حالٍ
 *     يُقبل اليوم (يظهر في معاينة الاستيراد) لكنه يُسقط عند الاستبدال
 *     (replaceSnapshot لا يكتبه) ولا يُحفظ عبر جولة إعادة التصدير — لا
 *     حفظ دوري للمفاتيح المجهولة في السلوك القائم.
 *  4) الزوج الموروث (8/17) بمفتاح مجهول: مقبول كما هو — الإرث لا يتغير.
 *  5) مفتاح مجهول داخل كتلة counts (الملف الحالي): مرفوض أصلًا (MED-002).
 *  6) مصفوفة أسبقية الرفض المتعددة الأعطال: مع مفتاح مجهول حاضر، كل عطل
 *     قائم يظل يُرفض برسالته الأصلية وبترتيبه الأول نفسه — المفتاح المجهول
 *     لا يغير أسبقية الرفض ولا يتقدم عليها (شرط W2-2 الثالث).
 *
 * قرار W2-2 (الرفض الصارم للزوج الحالي وحده) لا يُفعَّل هنا — ينتظر
 * اعتماد حمولة الخطأ الدقيقة (رمز الخطأ والنص العربي) من المالك: البوابة
 * مسجلة OWNER_PAYLOAD_GATE_REQUIRED في تقرير الموجة.
 */
import "fake-indexeddb/auto";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { syncSha256Hex } from "@/lib/syncSha256";
import { IndexedDbLocalStore } from "@/storage/local/IndexedDbLocalStore";
import { MemoryLocalStore } from "@/storage/local/MemoryLocalStore";
import type { LocalStoreSnapshot } from "@/storage/local/types";
import { LocalTransferService } from "./localTransferService";
import { TRANSFER_ARRAY_FAMILY_ROLES } from "./transferArrayFamilyRoles";
import { file817 } from "./historical817.fixture";

const GOLDEN_DIR = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../../../../../docs/fixtures/export-goldens",
);
const currentPairGolden = JSON.parse(
  readFileSync(path.join(GOLDEN_DIR, "current-pair.golden.json"), "utf8"),
) as Record<string, unknown>;
const supplementGolden = JSON.parse(
  readFileSync(path.join(GOLDEN_DIR, "current-pair-supplement.golden.json"), "utf8"),
) as Record<string, unknown>;

const NOW = () => "2026-10-15T00:00:00.000Z";
const ROGUE_KEY = "rogueUnknownSection";

const databaseName = "micro-prototype-local";
function clearDatabase() {
  return new Promise<void>((resolve, reject) => {
    const request = indexedDB.deleteDatabase(databaseName);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

afterEach(clearDatabase);

/** المجموعة المسموحة المشتقة: سجل الـ31 + كل مفتاح غير عائلي يصدره
 * المصدّر الفعلي (من جسد الذهبي الحالي نفسه) — لا قائمة يدوية. */
const registryKeys = new Set(Object.keys(TRANSFER_ARRAY_FAMILY_ROLES));
function deriveNonFamilyEmittedKeys(corpus: Array<Record<string, unknown>>): string[] {
  const nonFamily = new Set<string>();
  for (const file of corpus) {
    const data = file.data as Record<string, unknown>;
    for (const key of Object.keys(data)) {
      if (!registryKeys.has(key)) nonFamily.add(key);
    }
  }
  return [...nonFamily].sort();
}
const exporterCorpus = [currentPairGolden, supplementGolden];
const allowedDataKeys = new Set<string>([...registryKeys, ...deriveNonFamilyEmittedKeys(exporterCorpus)]);

type ExportFileShape = {
  format: string;
  version: number;
  schemaVersion: number;
  exportedAt: string;
  data: Record<string, unknown>;
  integrity?: { algorithm: string; digest: string };
  counts?: Record<string, number>;
  appVersion?: string;
};

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

/** إعادة ختم بصمة التكامل بعد أي تعديل على data — حتى يكون العطل الوحيد
 * هو العطل المقصود بالضبط (نفس ما يفعله الملف المُعاد ختمه). */
function restamp(file: ExportFileShape): ExportFileShape {
  const next = clone(file);
  next.integrity = { algorithm: "sha256", digest: syncSha256Hex(JSON.stringify(next.data)) };
  return next;
}

describe("OD-KEYS — allowed-set derivation from the registry plus exporter-emitted non-family keys", () => {
  it("the exporter emits exactly four non-family top-level data keys (35 allowed total)", () => {
    expect(deriveNonFamilyEmittedKeys(exporterCorpus)).toEqual([
      "inventoryActivation",
      "ownerProfile",
      "preferences",
      "profile",
    ]);
    expect(allowedDataKeys.size).toBe(35);
  });

  it("the complete Current exporter corpus produces no key outside the allowed set (W2-2 precondition 1)", async () => {
    for (const file of exporterCorpus) {
      for (const key of Object.keys(file.data as Record<string, unknown>)) {
        expect(allowedDataKeys.has(key)).toBe(true);
      }
    }
    /* التصدير الحي فوق المهايئين — فارغ ومزروعًا */
    for (const makeStore of [() => new MemoryLocalStore(), () => new IndexedDbLocalStore()]) {
      const store = makeStore();
      const seeded = await store.replaceSnapshot(supplementGolden.data as LocalStoreSnapshot);
      expect(seeded.ok).toBe(true);
      for (const source of [store, makeStore()]) {
        const transfers = new LocalTransferService(source, NOW);
        const exported = await transfers.createExport();
        if (!exported.ok) throw new Error(exported.message);
        for (const key of Object.keys(exported.value.data as Record<string, unknown>)) {
          expect(allowedDataKeys.has(key)).toBe(true);
        }
      }
    }
  });

  it("the current envelope's top-level keys are pinned exactly (eight keys)", async () => {
    const transfers = new LocalTransferService(new MemoryLocalStore(), NOW);
    const exported = await transfers.createExport();
    if (!exported.ok) throw new Error(exported.message);
    expect(exported.ok).toBe(true);
    expect(Object.keys(exported.value).sort()).toEqual([
      "appVersion",
      "counts",
      "data",
      "exportedAt",
      "format",
      "integrity",
      "schemaVersion",
      "version",
    ]);
  });
});

describe("OD-KEYS — current behavior characterization: an unknown top-level data key on the Current pair", () => {
  it("is ACCEPTED today (prepareImport ok) and survives into the prepared preview data", async () => {
    const transfers = new LocalTransferService(new MemoryLocalStore(), NOW);
    const exported = await transfers.createExport();
    if (!exported.ok) throw new Error(exported.message);
    const base = clone(exported.value as unknown as ExportFileShape);
    (base.data as Record<string, unknown>)[ROGUE_KEY] = { not: "a micro family" };
    const tampered = restamp(base);

    const prepared = transfers.prepareImport(JSON.stringify(tampered));
    if (!prepared.ok) throw new Error(prepared.message);
    expect(ROGUE_KEY in (prepared.value.file.data as unknown as Record<string, unknown>)).toBe(true);
  });

  it.each([
    ["memory", () => new MemoryLocalStore()],
    ["indexeddb", () => new IndexedDbLocalStore()],
  ] as const)(
    "over %s: confirmImport drops the unknown key at persistence — no round-trip preservation (current pinned behavior)",
    async (_name, makeStore) => {
      const store = makeStore();
      const transfers = new LocalTransferService(store, NOW);
      const seeded = await store.replaceSnapshot(supplementGolden.data as LocalStoreSnapshot);
      expect(seeded.ok).toBe(true);
      const exported = await transfers.createExport();
      if (!exported.ok) throw new Error(exported.message);
      const base = clone(exported.value as unknown as ExportFileShape);
      (base.data as Record<string, unknown>)[ROGUE_KEY] = [1, 2, 3];
      const tampered = restamp(base);

      const prepared = transfers.prepareImport(JSON.stringify(tampered));
      if (!prepared.ok) throw new Error(prepared.message);
      const confirmed = await transfers.confirmImport(prepared.value);
      if (!confirmed.ok) throw new Error(confirmed.message);

      const read = await store.readSnapshot();
      if (!read.ok) throw new Error(read.message);
      expect(ROGUE_KEY in (read.value as unknown as Record<string, unknown>)).toBe(false);

      const reExported = await transfers.createExport();
      if (!reExported.ok) throw new Error(reExported.message);
      expect(ROGUE_KEY in (reExported.value.data as unknown as Record<string, unknown>)).toBe(false);
      /* البيانات المعروفة نجت كاملة — الإسقاط لا يمس العائلات القائمة */
      expect((reExported.value.data as unknown as Record<string, unknown>).financialEvents).toHaveLength(
        (supplementGolden.data as unknown as Record<string, unknown[]>).financialEvents.length,
      );
    },
  );
});

describe("OD-KEYS — legacy pair (8/17) behavior characterization: unchanged", () => {
  it("a legacy file with an unknown top-level data key is accepted exactly as before", () => {
    const transfers = new LocalTransferService(new MemoryLocalStore(), NOW);
    const legacy = clone(file817 as unknown as ExportFileShape);
    (legacy.data as Record<string, unknown>)[ROGUE_KEY] = "legacy extra";

    const prepared = transfers.prepareImport(JSON.stringify(legacy));
    if (!prepared.ok) throw new Error(prepared.message);
    expect(prepared.value.file.version).toBe(30);
    expect(prepared.value.file.schemaVersion).toBe(38);
  });

  it("legacy unknown keys are likewise dropped at persistence (Memory)", async () => {
    const store = new MemoryLocalStore();
    const transfers = new LocalTransferService(store, NOW);
    const legacy = clone(file817 as unknown as ExportFileShape);
    (legacy.data as Record<string, unknown>)[ROGUE_KEY] = "legacy extra";
    const prepared = transfers.prepareImport(JSON.stringify(legacy));
    if (!prepared.ok) throw new Error(prepared.message);
    const confirmed = await transfers.confirmImport(prepared.value);
    if (!confirmed.ok) throw new Error(confirmed.message);
    const read = await store.readSnapshot();
    if (!read.ok) throw new Error(read.message);
    expect(ROGUE_KEY in (read.value as unknown as Record<string, unknown>)).toBe(false);
  });
});

describe("OD-KEYS — counts-block unknown key on the Current pair (existing MED-002 rejection, pinned)", () => {
  it("an extra key inside counts is rejected with the exact current message", async () => {
    const transfers = new LocalTransferService(new MemoryLocalStore(), NOW);
    const exported = await transfers.createExport();
    if (!exported.ok) throw new Error(exported.message);
    expect(exported.ok).toBe(true);
    const tampered = restamp(exported.value as unknown as ExportFileShape);
    (tampered.counts as Record<string, number>).rogueExtraCount = 7;

    const prepared = transfers.prepareImport(JSON.stringify(tampered));
    expect(prepared.ok).toBe(false);
    expect((prepared as { ok: false; message: string }).message).toBe(
      "عدادات الملف لا تطابق بياناته بعد الترحيل — يبدو أن الملف تغيّر أو نقص بعد إنشائه؛ لا يعتمد عليه. بقيت بيانات هذا الجهاز دون تغيير.",
    );
  });
});

describe("OD-KEYS — first-rejection precedence matrix with an unknown data key present (W2-2 precondition 3)", () => {
  /** كل حالة: ملف حالٍ يحمل المفتاح المجهول + عطلًا قائمًا واحدًا —
   * الرفض يجب أن يظل برسالة العطل الأصلي نفسها (المفتاح المجهول لا
   * يشارك في الرفض ولا يقدم عليه). */
  it("bad format wins first (unknown key present)", () => {
    const transfers = new LocalTransferService(new MemoryLocalStore(), NOW);
    const file = restamp({
      format: "not-micro",
      version: 30,
      schemaVersion: 38,
      exportedAt: NOW(),
      data: { [ROGUE_KEY]: 1 },
    });
    const prepared = transfers.prepareImport(JSON.stringify(file));
    expect(prepared.ok).toBe(false);
    expect((prepared as { ok: false; message: string }).message).toBe(
      "هذا ليس ملف تصدير Micro المحلي. بقيت بيانات هذا الجهاز دون تغيير.",
    );
  });

  it("unsupported version wins before any data inspection (unknown key present)", () => {
    const transfers = new LocalTransferService(new MemoryLocalStore(), NOW);
    const file = restamp({
      format: "micro-prototype-local-export",
      version: 99,
      schemaVersion: 99,
      exportedAt: NOW(),
      data: { [ROGUE_KEY]: 1 },
    });
    const prepared = transfers.prepareImport(JSON.stringify(file));
    expect(prepared.ok).toBe(false);
    expect((prepared as { ok: false; message: string }).message).toBe(
      "إصدار الملف غير مدعوم في هذا الإصدار من التطبيق؛ بقيت بيانات هذا الجهاز دون تغيير.",
    );
  });

  it("missing exportedAt wins at the structure gate (unknown key present)", () => {
    const transfers = new LocalTransferService(new MemoryLocalStore(), NOW);
    const file = {
      format: "micro-prototype-local-export",
      version: 30,
      schemaVersion: 38,
      data: { [ROGUE_KEY]: 1 },
    };
    const prepared = transfers.prepareImport(JSON.stringify(file));
    expect(prepared.ok).toBe(false);
    expect((prepared as { ok: false; message: string }).message).toBe(
      "الملف ناقص أو لا يطابق بنية Micro المطلوبة. بقيت بيانات هذا الجهاز دون تغيير.",
    );
  });

  it("a corrupted integrity digest wins before structure/validation/counts (unknown key present)", async () => {
    const transfers = new LocalTransferService(new MemoryLocalStore(), NOW);
    const exported = await transfers.createExport();
    if (!exported.ok) throw new Error(exported.message);
    expect(exported.ok).toBe(true);
    const tampered = clone(exported.value as unknown as ExportFileShape);
    (tampered.data as Record<string, unknown>)[ROGUE_KEY] = { evil: true };
    /* بصمة متعبة عن قصد — لا إعادة ختم */

    const prepared = transfers.prepareImport(JSON.stringify(tampered));
    expect(prepared.ok).toBe(false);
    expect((prepared as { ok: false; message: string }).message).toBe(
      "تُغيّر الملف بعد إنشائه فبصمة التكامل لا تطابقه؛ لا تعتمد عليه. بقيت بيانات هذا الجهاز دون تغيير.",
    );
  });

  it("a non-array family wins at the raw-structure gate (unknown key present)", async () => {
    const transfers = new LocalTransferService(new MemoryLocalStore(), NOW);
    const exported = await transfers.createExport();
    if (!exported.ok) throw new Error(exported.message);
    const base = clone(exported.value as unknown as ExportFileShape);
    (base.data as Record<string, unknown>)[ROGUE_KEY] = 1;
    (base.data as Record<string, unknown>).materials = { not: "an array" };
    const tampered = restamp(base);

    const prepared = transfers.prepareImport(JSON.stringify(tampered));
    expect(prepared.ok).toBe(false);
    expect((prepared as { ok: false; message: string }).message).toBe(
      "بنية الملف غير سليمة — قيمة عائلة «المواد» ليست مصفوفة كما تقتضي بنية Micro؛ لا يعتمد عليه. بقيت بيانات هذا الجهاز دون تغيير.",
    );
  });

  it("an invalid family record wins at validation (unknown key present)", async () => {
    const transfers = new LocalTransferService(new MemoryLocalStore(), NOW);
    const exported = await transfers.createExport();
    if (!exported.ok) throw new Error(exported.message);
    const base = clone(exported.value as unknown as ExportFileShape);
    (base.data as Record<string, unknown>)[ROGUE_KEY] = 1;
    (base.data as Record<string, unknown>).drafts = [{ id: 42, definitelyNot: "a valid draft" }];
    const tampered = restamp(base);

    const prepared = transfers.prepareImport(JSON.stringify(tampered));
    expect(prepared.ok).toBe(false);
    expect((prepared as { ok: false; message: string }).message).toBe(
      "الملف ناقص أو لا يطابق بنية Micro المطلوبة. بقيت بيانات هذا الجهاز دون تغيير.",
    );
  });

  it("mismatched counts win last (unknown key present)", async () => {
    const store = new MemoryLocalStore();
    const seeded = await store.replaceSnapshot(supplementGolden.data as LocalStoreSnapshot);
    expect(seeded.ok).toBe(true);
    const transfers = new LocalTransferService(store, NOW);
    const exported = await transfers.createExport();
    if (!exported.ok) throw new Error(exported.message);
    const base = clone(exported.value as unknown as ExportFileShape);
    (base.data as Record<string, unknown>)[ROGUE_KEY] = 1;
    const tampered = restamp(base);
    (tampered.counts as Record<string, number>).financialEvents =
      (tampered.counts as Record<string, number>).financialEvents + 1;

    const prepared = transfers.prepareImport(JSON.stringify(tampered));
    expect(prepared.ok).toBe(false);
    expect((prepared as { ok: false; message: string }).message).toBe(
      "عدادات الملف لا تطابق بياناته بعد الترحيل — يبدو أن الملف تغيّر أو نقص بعد إنشائه؛ لا يعتمد عليه. بقيت بيانات هذا الجهاز دون تغيير.",
    );
  });
});
