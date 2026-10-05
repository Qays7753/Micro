/**
 * Wave C (بطاقة ADR-015 مجموعة 5): عقد قدرة «تصريحات الكاش القصير» —
 * الاستخراج الخامس بترتيب ADR-15. ثلاث طبقات إثبات، بلا أي تعديل إنتاج:
 *
 *  1) العضوية: المحوّلان يكشفان طرق القدرة الأربع كلها كدوال — والقائمة
 *     نفسها محكومة النوع (Pick من الواجهة التوافقية) فلا تزد ولا تنقص
 *     بصمت.
 *  2) السلوك عبر عدسة القدرة: نفس عقود الالتزام للمحوّلين (الذاكرة
 *     وIndexedDB/fake-indexeddb) — الحفظ الحتمي (نفس المفتاح والنوع =
 *     السجل المخزن نفسه)، والقراءة الحرفية والقراءة الفردية (والغائب
 *     null)، وتراجع محروس واحد لكل سجل متوقع (إعادة التراجع بمفتاحه
 *     تعيد المخزن؛ والمفتاح المختلف على سجل متراجع سابقًا رفض صادر
 *     بهوية الأخطاء المحفوظة؛ والتراجع على أصل مفقود رفض صادر) — سجل
 *     مخزّن لا read model (قيد 4A). السيناريو يستقبل النوع الضيق
 *     `ShortCashDeclarationStore` حصرًا؛ الآثار العابرة للحدود (اللقطة
 *     والاستعادة وقراءات النماذج المالية المشتقة) تبقى في مصفوفة
 *     المطابقة الكاملة (adapterConformance.group10) وعند القارئ الكنوني.
 *  3) الأنواع: tsc على ملف المراسي زمن التشغيل بامتداد tsconfig الـapp
 *     نفسه (نمط مراسي Wave 3B/4C).
 */
import "fake-indexeddb/auto";
import { execFileSync } from "node:child_process";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it } from "vitest";
import {
  createShortCashDeclaration,
  createShortCashReversal,
} from "@micro-domain/financial-analysis/index.js";
import type { ShortCashDeclaration } from "@micro-domain/financial-analysis/index.js";
import { IndexedDbLocalStore } from "../IndexedDbLocalStore";
import { MemoryLocalStore } from "../MemoryLocalStore";
import {
  shortCashDeclarationStoreMethods,
  type ShortCashDeclarationStore,
} from "./shortCashDeclarationStore";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(HERE, "../../../../../../../");
const ANCHORS_FILE = path.join(HERE, "shortCashDeclarationCapabilityAnchors.ts");
const APP_TSCONFIG = path.join(REPO_ROOT, "apps", "prototype-web", "tsconfig.json");

const databaseName = "micro-prototype-local";
function clearDatabase() {
  return new Promise<void>((resolve, reject) => {
    const request = indexedDB.deleteDatabase(databaseName);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

const AT = "2026-10-04T08:00:00.000Z";
const LATER = "2026-10-04T09:00:00.000Z";

function makeDeclaration(id: string, amountMinor: number, createdAt: string): ShortCashDeclaration {
  return createShortCashDeclaration({
    id,
    direction: "collection",
    amountMinor,
    dueOn: "2026-09-10",
    source: "جرد",
    note: "عجز صندوق",
    idempotencyKey: id,
    knowledge: "estimated",
    createdAt,
  });
}

/** السيناريو يستقبل النوع الضيق حصرًا — عدسة مستهلك القدرة لا أوسع. */
async function runCapabilityScenario(store: ShortCashDeclarationStore) {
  /* ١) الحفظ الحتمي: نفس المفتاح والنوع يعيد السجل المخزن نفسه. */
  const first = makeDeclaration("short-cap-1", 500, AT);
  const saved = await store.saveShortCashDeclaration(first);
  expect(saved.ok).toBe(true);
  if (!saved.ok) throw new Error(saved.message);
  expect(saved.value).toEqual(first);
  const replayed = await store.saveShortCashDeclaration(first);
  expect(replayed.ok && replayed.value).toEqual(first);

  /* ٢) القراءة: السجل كما كُتب؛ والفردية حرفية؛ والغائب null. */
  const second = makeDeclaration("short-cap-2", 300, LATER);
  const savedSecond = await store.saveShortCashDeclaration(second);
  expect(savedSecond.ok).toBe(true);
  const listed = await store.listShortCashDeclarations();
  expect(listed.ok && listed.value.map(entry => entry.id)).toEqual(["short-cap-2", "short-cap-1"]);
  const fetched = await store.getShortCashDeclaration("short-cap-1");
  expect(fetched.ok && fetched.value).toEqual(first);
  const missing = await store.getShortCashDeclaration("short-cap-void");
  expect(missing.ok && missing.value).toBeNull();

  /* ٣) التراجع المحروس: تراجع واحد لكل سجل متوقع — الالتزام ثم إعادة
   *    التشغيل بمفتاحه تعيد المخزن. */
  const reversal = createShortCashReversal({
    id: "short-cap-1-rev",
    original: first,
    idempotencyKey: "short-cap-rev-1",
    createdAt: LATER,
    note: "تراجع",
  });
  const commit = await store.commitShortCashDeclarationReversal("short-cap-1", reversal);
  expect(commit.ok).toBe(true);
  if (!commit.ok) throw new Error(commit.message);
  const replay = await store.commitShortCashDeclarationReversal("short-cap-1", reversal);
  expect(replay.ok && replay.value).toEqual(reversal);
  const afterReversal = await store.listShortCashDeclarations();
  expect(afterReversal.ok && afterReversal.value.find(entry => entry.id === "short-cap-1")?.kind).toBe(
    "declaration",
  );
  expect(afterReversal.ok && afterReversal.value.find(entry => entry.id === "short-cap-1-rev")?.kind).toBe(
    "reversal",
  );

  /* ٤) الرفض الصادر: مفتاح مختلف على سجل متراجع سابقًا — هوية الخطأ
   *    المحفوظة (storage_error) وبلا كتابة. */
  const divergentReversal = createShortCashReversal({
    id: "short-cap-1-rev-2",
    original: first,
    idempotencyKey: "short-cap-rev-2",
    createdAt: LATER,
    note: "تراجع ثانٍ مختلف",
  });
  const divergent = await store.commitShortCashDeclarationReversal("short-cap-1", divergentReversal);
  expect(divergent.ok).toBe(false);
  if (!divergent.ok) expect(divergent.code).toBe("storage_error");
  const afterDivergent = await store.getShortCashDeclaration("short-cap-1-rev-2");
  expect(afterDivergent.ok && afterDivergent.value).toBeNull();

  /* ٥) الرفض الصادر: تراجع على أصل مفقود — لا تراجع بلا أصل. */
  const orphan = await store.commitShortCashDeclarationReversal("short-cap-void", reversal);
  expect(orphan.ok).toBe(false);
  if (!orphan.ok) expect(orphan.code).toBe("storage_error");

  /* ٦) الرفض الصادر: تعارض هوية التراجع — معرف تراجع قائم بالفعل. */
  const conflictingReversal = createShortCashReversal({
    id: "short-cap-1-rev",
    original: second,
    idempotencyKey: "short-cap-rev-3",
    createdAt: LATER,
    note: "تعارض هوية",
  });
  const conflict = await store.commitShortCashDeclarationReversal("short-cap-2", conflictingReversal);
  expect(conflict.ok).toBe(false);
  if (!conflict.ok) expect(conflict.code).toBe("storage_error");
  const afterConflict = await store.getShortCashDeclaration("short-cap-2");
  expect(afterConflict.ok && afterConflict.value?.kind).toBe("declaration");
}

describe("Wave C — قدرة تصريحات الكاش القصير (ADR-015 مجموعة 5): العضوية", () => {
  it("قائمة الطرق هي نطاق المجموعة بالضبط: 4 أسماء فريدة", () => {
    expect(shortCashDeclarationStoreMethods).toHaveLength(4);
    expect(new Set(shortCashDeclarationStoreMethods).size).toBe(4);
  });

  for (const [label, makeStore] of [
    ["MemoryLocalStore", () => new MemoryLocalStore()],
    ["IndexedDbLocalStore", () => new IndexedDbLocalStore()],
  ] as const) {
    it(`${label} يكشف كل طريقة قدرة كدالة`, () => {
      const store = makeStore();
      for (const method of shortCashDeclarationStoreMethods) {
        expect(
          typeof (store as unknown as Record<string, unknown>)[method],
          `${label}: طريقة القدرة مفقودة: ${method}`,
        ).toBe("function");
      }
    });
  }
});

describe("Wave C — قدرة تصريحات الكاش القصير: العقود السلوكية عبر العدسة الضيقة", () => {
  afterEach(async () => {
    await clearDatabase();
  });

  it("الذاكرة: عقد القدرة كاملًا", async () => {
    await runCapabilityScenario(new MemoryLocalStore());
  });

  it("IndexedDB (fake-indexeddb): عقد القدرة نفسه", async () => {
    await clearDatabase();
    try {
      await runCapabilityScenario(new IndexedDbLocalStore());
    } finally {
      await clearDatabase();
    }
  });
});

describe("Wave C — قدرة تصريحات الكاش القصير: طبقة الأنواع", () => {
  it(
    "المحوّلان والواجهة التوافقية ما زالوا يحققون القدرة (tsc على ملف المراسي)",
    { timeout: 120_000 },
    () => {
      /* ملفات الاختبار مستثناة من فحص أنواع الـapp — لذا يُفرض هنا فحص المراسي
       * وحدها بامتداد tsconfig الـapp نفسه (نمط مراسي Wave 3B/4C). أي كسر
       * للتحقيق (توقيع/إسقاط implements/انحراف الواجهة) يفشل هنا فورًا. */
      const tmp = mkdtempSync(path.join(tmpdir(), "micro-shortcash-capability-"));
      try {
        const tmpConfig = path.join(tmp, "tsconfig.capability.json");
        writeFileSync(
          tmpConfig,
          JSON.stringify({
            extends: APP_TSCONFIG,
            include: [ANCHORS_FILE],
            exclude: [],
            compilerOptions: { types: [] },
          }),
          "utf8",
        );
        const tscEntry = path.join(REPO_ROOT, "node_modules", "typescript", "bin", "tsc");
        execFileSync(process.execPath, [tscEntry, "--noEmit", "--project", tmpConfig], {
          cwd: REPO_ROOT,
          encoding: "utf8",
          stdio: ["ignore", "pipe", "pipe"],
        });
      } finally {
        rmSync(tmp, { recursive: true, force: true });
      }
      expect(true).toBe(true);
    },
  );
});
