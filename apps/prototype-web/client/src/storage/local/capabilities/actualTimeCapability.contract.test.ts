/**
 * R3 (بطاقة R3-SC-10): عقد قدرة «الوقت الفعلي». ثلاث طبقات إثبات، بلا أي تعديل إنتاج:
 * عضوية المحوّلين، السلوك عبر العدسة الضيقة (الذاكرة وIndexedDB/fake-indexeddb)،
 * ومراسي الأنواع زمن التشغيل (نمط Wave 3B/4C).
 */
import "fake-indexeddb/auto";
import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it } from "vitest";
import { IndexedDbLocalStore } from "../IndexedDbLocalStore";
import { MemoryLocalStore } from "../MemoryLocalStore";
import { actualTimeStoreMethods, type ActualTimeStore } from "./actualTimeStore";
const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(HERE, "../../../../../../../");
const ANCHORS_FILE = path.join(HERE, "actualTimeCapabilityAnchors.ts");
const APP_TSCONFIG = path.join(REPO_ROOT, "apps", "prototype-web", "tsconfig.json");

const databaseName = "micro-prototype-local";
function clearDatabase() {
  return new Promise<void>((resolve, reject) => {
    const request = indexedDB.deleteDatabase(databaseName);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

const TS = "2026-10-08T09:00:00.000Z";

function timeRecordFixture(id: string, operationKey: string) {
  return Object.freeze({
    id,
    orderId: "order-cap-time",
    minutesDelta: 45,
    recordedOn: "2026-10-07",
    createdAt: TS,
    note: "وقت تنفيذ فعلي",
    operationKey,
    reversalOfId: null,
    reversalReason: null,
  });
}
/** السيناريو يستقبل النوع الضيق حصرًا — عدسة مستهلك القدرة لا أوسع. */
async function runCapabilityScenario(store: ActualTimeStore) {
  /* ١) الحفظ والقراءة كما كُتبت (سطح بلا حارس كتابة مستقل — الحدود
   *    داخل المحوّلين كما وثّقت البطاقة). */
  const saved = await store.saveActualTimeRecord(timeRecordFixture("time-cap-1", "op-time-cap-1"));
  expect(saved.ok && saved.value.minutesDelta).toBe(45);
  const listed = await store.listActualTimeRecords();
  expect(listed.ok && listed.value.map(record => record.id)).toEqual(["time-cap-1"]);

  /* ٢) سجل ثانٍ يعمل جنبًا إلى جنب — الترتيب زمني إنشائي. */
  await store.saveActualTimeRecord(timeRecordFixture("time-cap-2", "op-time-cap-2"));
  const afterSecond = await store.listActualTimeRecords();
  expect(afterSecond.ok && afterSecond.value).toHaveLength(2);
}

/* R4-A5 (إغلاق HAF-1 — جناح العمق عند مستوى العدسة): القدرة سطح حفظ حتمي
 * بلا رفض كتابة **بالتصميم الموثق** (بطاقة R3-SC-10: بلا حارس مستقل — الرفض
 * والدلالة عند كتاب الوقت في طبقة التطبيق). ما يُثبت هنا هو العقد الحي
 * الفعلي: الاستبدال الحتمي بالمعرّف — إعادة الحفظ بالمعرّف نفسه تستبدل
 * المحتوى ولا تكرر السجل، فلا يظهر سجلان لمعرّف واحد أبدًا. */
async function runDeterminismWing(store: ActualTimeStore) {
  const first = timeRecordFixture("time-det-1", "op-time-det-1");
  await store.saveActualTimeRecord(first);
  const replacement = Object.freeze({ ...first, minutesDelta: 90, note: "تصحيح المدة" });
  const resaved = await store.saveActualTimeRecord(replacement);
  expect(resaved.ok).toBe(true);
  const listed = await store.listActualTimeRecords();
  expect(listed.ok && listed.value).toHaveLength(1);
  expect(listed.ok && listed.value[0]?.minutesDelta).toBe(90);
  expect(listed.ok && listed.value[0]?.note).toBe("تصحيح المدة");
}
describe("R4-A5/HAF-1 — قدرة الوقت الفعلي: عمق العدسة", () => {
  afterEach(async () => {
    await clearDatabase();
  });

  it("الذاكرة: الاستبدال الحتمي بالمعرّف — لا تكرار ولا حارس مخترع", async () => {
    await runDeterminismWing(new MemoryLocalStore());
  });

  it("IndexedDB (fake-indexeddb): الاستبدال الحتمي نفسه", async () => {
    await clearDatabase();
    try {
      await runDeterminismWing(new IndexedDbLocalStore());
    } finally {
      await clearDatabase();
    }
  });
});
describe("R3 — قدرة الوقت الفعلي (بطاقة R3-SC-10): العضوية", () => {
  it("قائمة الطرق هي نطاق المجموعة بالضبط: 2 أسماء فريدة", () => {
    expect(actualTimeStoreMethods).toHaveLength(2);
    expect(new Set(actualTimeStoreMethods).size).toBe(2);
  });

  describe.each([
    ["MemoryLocalStore", () => new MemoryLocalStore()],
    ["IndexedDbLocalStore", () => new IndexedDbLocalStore()],
  ] as const)("%s يكشف كل طريقة قدرة كدالة", (_label, makeStore) => {
    it("العضوية كاملة", () => {
      const store = makeStore();
      for (const method of actualTimeStoreMethods) {
        expect(typeof (store as unknown as ActualTimeStore)[method]).toBe("function");
      }
    });
  });
});

describe("R3 — قدرة الوقت الفعلي: العقود السلوكية عبر العدسة الضيقة", () => {
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

describe("R3 — قدرة الوقت الفعلي: طبقة الأنواع", () => {
  it(
    "المحوّلان والواجهة التوافقية ما زالوا يحققون القدرة (tsc على ملف المراسي)",
    { timeout: 120_000 },
    () => {
      const tmp = mkdtempSync(path.join(tmpdir(), "micro-actualTime-capability-"));
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
          encoding: "utf-8",
          stdio: ["ignore", "pipe", "pipe"],
        });
      } finally {
        rmSync(tmp, { recursive: true, force: true });
      }
      expect(true).toBe(true);
    },
  );
});
