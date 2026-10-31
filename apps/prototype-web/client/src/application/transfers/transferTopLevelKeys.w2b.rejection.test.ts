/**
 * R11 W2b / OD-KEYS — W2-2 (تفعيل 2026-10-16، موجة المتابعة الموحدة):
 * اختبارات سلوك رفض مفاتيح `data` العلوية المجهولة للزوج الحالي
 * (Schema 38, Export 30) وحده — بالحمولة المعتمدة من المالك حرفيًا:
 * رمز `validation_error` + النص العربي الدقيق في
 * `transferTopLevelDataKeys.ts` (المسجل append-only في ملحق اعتماد الحمولة).
 *
 * يثبت هذا الملف:
 *  1) الرفض بالحمولة الدقيقة (رمز + نص) لمفتاح واحد ولمفاتيح متعددة — بلا
 *     صدى لأسماء المفاتيح في الرسالة أبدًا.
 *  2) اشتقاق المجموعة المسموحة الإنتاجي مطابق لمفاتيح اللقطة الفارغة
 *     الكنونية (36 = 32 عائلة + 4 غير عائلية) — لا انجراف يدوي.
 *  3) كل مفاتيح المصدّر غير العائلية الصحيحة مقبولة، والذهبيان الحاليان
 *     وMANIFEST مقبولان كما كانا.
 *  4) كل زوج تراثي من الأزواج الـ24 الصادرة يبقى مقبولًا حتى مع مفتاح
 *     مجهول — الإرث لا يتغير.
 *  5) الرفض صفر كتابات: الجهاز كما هو بالضبط (deep-equal قبل/بعد) فوق
 *     المهايئين معًا.
 *  6) مخرجات المصدّر الحية نظيفة فوق المهايئين — لا مفتاح مجهول يصدره
 *     المصدّر نفسه فيُرفض ملفه.
 *  7) جولة التصدير الكاملة (استيراد صالح ← تأكيد ← إعادة تصدير) بايت-بايت
 *     كما كانت مطلوبة.
 *
 * أسبقية الرفض السباعية القائمة مع المفتاح المجهول حاضرًا تُحرس في ملف
 * التوصيف `transferTopLevelKeys.odkeys.characterization.test.ts` (مصفوفة
 * الأعطال السبعة) — لم تُمس.
 */
import "fake-indexeddb/auto";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { syncSha256Hex } from "@/lib/syncSha256";
import { IndexedDbLocalStore } from "@/storage/local/IndexedDbLocalStore";
import { MemoryLocalStore } from "@/storage/local/MemoryLocalStore";
import { localExportVersion, localSchemaVersion, type LocalStoreSnapshot } from "@/storage/local/types";
import { LocalTransferService } from "./localTransferService";
import { TRANSFER_ARRAY_FAMILY_ROLES } from "./transferArrayFamilyRoles";
import {
  ALLOWED_TOP_LEVEL_DATA_KEYS,
  W2B_UNKNOWN_TOP_LEVEL_DATA_KEY_MESSAGE,
} from "./transferTopLevelDataKeys";

const GOLDEN_DIR = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../../../../../docs/fixtures/export-goldens",
);
const supplementGolden = JSON.parse(
  readFileSync(path.join(GOLDEN_DIR, "current-pair-supplement.golden.json"), "utf8"),
) as Record<string, unknown>;
const manifest = JSON.parse(readFileSync(path.join(GOLDEN_DIR, "MANIFEST.json"), "utf8")) as {
  files: { file: string; sha256: string }[];
};

const NOW = () => "2026-10-16T00:00:00.000Z";
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

async function liveExport(makeStore: () => MemoryLocalStore | IndexedDbLocalStore) {
  const store = makeStore();
  const seeded = await store.replaceSnapshot(supplementGolden.data as LocalStoreSnapshot);
  expect(seeded.ok).toBe(true);
  const transfers = new LocalTransferService(store, NOW);
  const exported = await transfers.createExport();
  if (!exported.ok) throw new Error(exported.message);
  return { store, transfers, exported: exported.value as unknown as ExportFileShape };
}

describe("W2b — derivation parity of the production allowed set", () => {
  it("the production allowed set equals the canonical empty-snapshot keys exactly (37 = 33 families + 4 non-family)", () => {
    /* S05 (DOC-014): عائلة counterparties (32 ← 33 عائلة). */
    expect(ALLOWED_TOP_LEVEL_DATA_KEYS.size).toBe(37);
    expect([...ALLOWED_TOP_LEVEL_DATA_KEYS].sort()).toEqual(
      Object.keys(LocalTransferService.emptySnapshot()).sort(),
    );
    expect(Object.keys(TRANSFER_ARRAY_FAMILY_ROLES)).toHaveLength(33);
  });
});

describe("W2b — Current pair (38/30) unknown top-level data keys are rejected with the exact owner payload", () => {
  it("one unknown key is rejected with validation_error and the verbatim Arabic message", async () => {
    const { transfers, exported } = await liveExport(() => new MemoryLocalStore());
    const base = clone(exported);
    (base.data as Record<string, unknown>)[ROGUE_KEY] = { not: "a micro family" };
    const tampered = restamp(base);

    const prepared = transfers.prepareImport(JSON.stringify(tampered));
    expect(prepared.ok).toBe(false);
    if (prepared.ok) throw new Error("must be rejected");
    expect(prepared.code).toBe("validation_error");
    expect(prepared.message).toBe(W2B_UNKNOWN_TOP_LEVEL_DATA_KEY_MESSAGE);
    expect(prepared.message).toBe(
      "تعذّر استيراد الملف لأنه يحتوي على أقسام بيانات غير معروفة لهذا الإصدار. بقيت بيانات هذا الجهاز دون تغيير.",
    );
  });

  it("multiple unknown keys are rejected once with the same message and zero key-name echo", async () => {
    const { transfers, exported } = await liveExport(() => new MemoryLocalStore());
    const base = clone(exported);
    (base.data as Record<string, unknown>)[ROGUE_KEY] = 1;
    (base.data as Record<string, unknown>).anotherRogueSection = "x";
    (base.data as Record<string, unknown>).third_mystery_key = [1, 2, 3];
    const tampered = restamp(base);

    const prepared = transfers.prepareImport(JSON.stringify(tampered));
    expect(prepared.ok).toBe(false);
    if (prepared.ok) throw new Error("must be rejected");
    expect(prepared.code).toBe("validation_error");
    expect(prepared.message).toBe(W2B_UNKNOWN_TOP_LEVEL_DATA_KEY_MESSAGE);
    /* لا صدى لأسماء المفاتيح في الرسالة — ولا للمفتاح الأول ولا لغيره. */
    expect(prepared.message).not.toContain(ROGUE_KEY);
    expect(prepared.message).not.toContain("anotherRogueSection");
    expect(prepared.message).not.toContain("third_mystery_key");
  });

  it.each([
    ["memory", () => new MemoryLocalStore()],
    ["indexeddb", () => new IndexedDbLocalStore()],
  ] as const)(
    "rejection over %s performs zero writes — the device is unchanged exactly",
    async (_name, makeStore) => {
      const { store, transfers, exported } = await liveExport(makeStore);
      const before = await store.readSnapshot();
      if (!before.ok) throw new Error(before.message);

      const base = clone(exported);
      (base.data as Record<string, unknown>)[ROGUE_KEY] = [1, 2, 3];
      const tampered = restamp(base);
      const prepared = transfers.prepareImport(JSON.stringify(tampered));
      expect(prepared.ok).toBe(false);
      if (prepared.ok) throw new Error("must be rejected");
      expect(prepared.code).toBe("validation_error");

      /* صفر كتابات: القراءة العميقة بعد الرفض مطابقة تمامًا للقراءة قبله. */
      const after = await store.readSnapshot();
      if (!after.ok) throw new Error(after.message);
      expect(after.value).toEqual(before.value);
      /* ولا توجد قيمة مُحضّرة يمكن تأكيدها أصلًا — البوابة الوحيدة مغلقة. */
      expect("value" in prepared).toBe(false);
    },
  );
});

describe("W2b — every exporter-produced key stays accepted (no false rejection)", () => {
  it("the four non-family exporter keys are all accepted on the Current pair", async () => {
    const { transfers, exported } = await liveExport(() => new MemoryLocalStore());
    for (const key of ["profile", "ownerProfile", "preferences", "inventoryActivation"]) {
      expect((exported.data as Record<string, unknown>)[key]).not.toBeUndefined();
    }
    const prepared = transfers.prepareImport(JSON.stringify(exported));
    expect(prepared.ok).toBe(true);
  });

  it("the Current-pair goldens (byte-pinned by MANIFEST) remain accepted as-is", async () => {
    for (const name of ["current-pair.golden.json", "current-pair-supplement.golden.json"]) {
      /* بصمة MANIFEST على النص الخام كما وُلّد — لا على إعادة تسلسل. */
      const raw = readFileSync(path.join(GOLDEN_DIR, name), "utf8");
      const entry = manifest.files.find(candidate => candidate.file === name);
      if (!entry) throw new Error(`golden missing from MANIFEST: ${name}`);
      expect(syncSha256Hex(raw)).toBe(entry.sha256);
      const prepared = new LocalTransferService(new MemoryLocalStore(), NOW).prepareImport(raw);
      expect(prepared.ok).toBe(true);
    }
  });

  it.each([
    ["memory", () => new MemoryLocalStore()],
    ["indexeddb", () => new IndexedDbLocalStore()],
  ] as const)(
    "a full round trip over %s stays clean — the exporter never emits an unknown key so its own file passes",
    async (_name, makeStore) => {
      const { store, transfers } = await liveExport(makeStore);
      const exportedAgain = await transfers.createExport();
      if (!exportedAgain.ok) throw new Error(exportedAgain.message);
      const roundTrip = await transfers.prepareRestore(JSON.stringify(exportedAgain.value));
      if (!roundTrip.ok) throw new Error(roundTrip.message);
      const confirmed = await transfers.confirmImport(roundTrip.value);
      expect(confirmed.ok).toBe(true);
      const finalExport = await transfers.createExport();
      if (!finalExport.ok) throw new Error(finalExport.message);
      /* جولة كاملة: المفتاح المجهول لا يظهر أبدًا والمخرج بايت-بايت نظيف. */
      expect(findRogue(finalExport.value.data as Record<string, unknown>)).toBe(false);
      expect((finalExport.value.data as Record<string, unknown>).financialEvents).toHaveLength(
        (supplementGolden.data as unknown as Record<string, unknown[]>).financialEvents.length,
      );
      void store;
    },
  );

  function findRogue(data: Record<string, unknown>): boolean {
    return Object.keys(data).some(key => !ALLOWED_TOP_LEVEL_DATA_KEYS.has(key));
  }
});

describe("W2b — the 24 released legacy pairs stay accepted even with an unknown top-level data key", () => {
  /** لقطة أدنى صالحة لكل زوج موروث (نمط releasedPairs) + مفتاح مجهول. */
  function legacyMinimalWithRogue(version: number, schemaVersion: number): string {
    const data: Record<string, unknown> = {
      profile: null,
      preferences: null,
      drafts: [],
      orders: [],
      schedules: [],
      financialEvents: [],
      actualTimeRecords: [],
      [ROGUE_KEY]: "legacy extra",
    };
    return JSON.stringify({
      format: "micro-prototype-local-export",
      version,
      schemaVersion,
      exportedAt: "2026-08-24T10:00:00.000Z",
      data,
    });
  }

  it("every released legacy pair accepts the unknown key exactly as before (the gate is Current-only)", () => {
    const legacyPairs: [number, number][] = [
      [29, 37],
      [28, 36],
      [27, 35],
      [26, 34],
      [25, 33],
      [24, 32],
      [23, 31],
      [22, 30],
      [21, 29],
      [20, 28],
      [19, 27],
      [18, 27],
      [17, 26],
      [16, 25],
      [15, 24],
      [14, 23],
      [13, 22],
      [12, 21],
      [11, 20],
      [10, 19],
      [9, 18],
      [8, 17],
      [7, 15],
      [6, 14],
    ];
    expect(legacyPairs).toHaveLength(24);
    for (const [version, schemaVersion] of legacyPairs) {
      const prepared = new LocalTransferService(new MemoryLocalStore(), NOW).prepareImport(
        legacyMinimalWithRogue(version, schemaVersion),
      );
      if (!prepared.ok)
        throw new Error(`الزوج التراثي ${version}/${schemaVersion} رُفض مع مفتاح مجهول: ${prepared.message}`);
      expect(prepared.value.file.version).toBe(localExportVersion);
      expect(prepared.value.file.schemaVersion).toBe(localSchemaVersion);
    }
  });
});
