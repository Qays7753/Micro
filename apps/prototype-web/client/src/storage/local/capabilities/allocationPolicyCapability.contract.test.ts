/**
 * Wave C (بطاقة ADR-015 مجموعة 4): عقد قدرة «سياسات التوزيع» — الاستخراج
 * الرابع بترتيب ADR-15. ثلاث طبقات إثبات، بلا أي تعديل إنتاج:
 *
 *  1) العضوية: المحوّلان يكشفان طرق القدرة الأربع كلها كدوال — والقائمة
 *     نفسها محكومة النوع (Pick من الواجهة التوافقية) فلا تزد ولا تنقص
 *     بصمت.
 *  2) السلوك عبر عدسة القدرة: نفس عقود الالتزام للمحوّلين (الذاكرة
 *     وIndexedDB/fake-indexeddb) — الحفظ والقراءة الحرفية بترتيبها
 *     (startsOn تنازليًا ثم الإصدار)، ومرشح الكتالوج، والغائب null،
 *     وزوج الخلافة الذرّي (السابقة معطلة + الخلف النافذ معًا أو لا
 *     شيء) بعهدة الحتمية على مفتاح السياسة، ورفض الخلافة على أصل غير
 *     فعال أو مفقود، ورفض تعارض هوية الخلف — كلها رفض صادر بهوية
 *     الأخطاء نفسها المحفوظة داخل المحوّلين. السيناريو يستقبل النوع
 *     الضيق `AllocationPolicyStore` حصرًا؛ الآثار العابرة للحدود (اللقطة
 *     والاستعادة وتسوية التوزيع المالي) تبقى في مصفوفة المطابقة
 *     الكاملة (adapterConformance.group10) وقفل exe017.
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
  createAllocationPolicy,
  createAllocationPolicySuccessor,
} from "@micro-domain/recurring-margin/index.js";
import type { AllocationPolicy } from "@micro-domain/recurring-margin/index.js";
import { IndexedDbLocalStore } from "../IndexedDbLocalStore";
import { MemoryLocalStore } from "../MemoryLocalStore";
import {
  allocationPolicyStoreMethods,
  type AllocationPolicyStore,
} from "./allocationPolicyStore";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(HERE, "../../../../../../../");
const ANCHORS_FILE = path.join(HERE, "allocationPolicyCapabilityAnchors.ts");
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

function makePolicy(
  id: string,
  version: number,
  month: string,
  rate: number,
  status: "active" | "inactive" = "active",
): AllocationPolicy {
  /* حدود شهر YYYY-MM سليمة: periodFrom/periodTo/startsOn/endsOn مرتبة
   * كما يطلب الدومين (نهاية السياسة لا تسبق نطاق العمل). */
  const [year, monthNumber] = month.split("-").map(Number);
  const lastDay = new Date(Date.UTC(year!, monthNumber!, 0)).getUTCDate();
  const from = `${month}-01`;
  const to = `${month}-${String(lastDay).padStart(2, "0")}`;
  return createAllocationPolicy({
    id,
    seriesId: "series-cap",
    successorOfPolicyId: null,
    version,
    catalogItemId: "catalog-cap",
    periodFrom: from,
    periodTo: to,
    startsOn: from,
    endsOn: to,
    source: "اختبار القدرة",
    reason: "سياسة",
    note: "عقد القدرة",
    status,
    idempotencyKey: id,
    createdAt: AT,
    updatedAt: AT,
    kind: "per_output_unit",
    amountMinor: null,
    rateMinor: null,
    rateMinorPerWholeUnit: rate,
    percentageBps: null,
    unitId: "unit-piece",
  });
}

/** السيناريو يستقبل النوع الضيق حصرًا — عدسة مستهلك القدرة لا أوسع. */
async function runCapabilityScenario(store: AllocationPolicyStore) {
  /* ١) الحفظ والقراءة الحرفية؛ والغائب null. */
  const august = makePolicy("alloc-cap-1", 1, "2026-08", 50);
  const saved = await store.saveAllocationPolicy(august);
  expect(saved.ok).toBe(true);
  if (!saved.ok) throw new Error(saved.message);
  expect(saved.value).toEqual(august);
  const fetched = await store.getAllocationPolicy("alloc-cap-1");
  expect(fetched.ok && fetched.value).toEqual(august);
  const missing = await store.getAllocationPolicy("alloc-cap-void");
  expect(missing.ok && missing.value).toBeNull();

  /* ٢) القراءة المرتبة: startsOn تنازليًا ثم الإصدار؛ ومرشح الكتالوج. */
  const july = makePolicy("alloc-cap-0", 1, "2026-07", 40);
  const savedJuly = await store.saveAllocationPolicy(july);
  expect(savedJuly.ok).toBe(true);
  const listed = await store.listAllocationPolicies();
  expect(listed.ok && listed.value.map(policy => policy.id)).toEqual(["alloc-cap-1", "alloc-cap-0"]);
  const filtered = await store.listAllocationPolicies("catalog-cap");
  expect(filtered.ok && filtered.value).toHaveLength(2);
  const otherCatalog = await store.listAllocationPolicies("catalog-other");
  expect(otherCatalog.ok && otherCatalog.value).toHaveLength(0);

  /* ٣) زوج الخلافة الذرّي: السابقة معطلة + الخلف النافذ معًا. */
  const successor = createAllocationPolicySuccessor(august, {
    id: "alloc-cap-2",
    seriesId: "series-cap",
    successorOfPolicyId: "alloc-cap-1",
    version: 2,
    catalogItemId: "catalog-cap",
    periodFrom: "2026-09-01",
    periodTo: "2026-09-30",
    startsOn: "2026-09-01",
    endsOn: "2026-09-30",
    source: "اختبار القدرة",
    reason: "سياسة محدثة",
    note: "عقد القدرة",
    status: "active",
    idempotencyKey: "alloc-cap-2",
    createdAt: AT,
    updatedAt: AT,
    kind: "per_output_unit",
    amountMinor: null,
    rateMinor: null,
    rateMinorPerWholeUnit: 60,
    percentageBps: null,
    unitId: "unit-piece",
  });
  const inactivePrevious = makePolicy("alloc-cap-1", 1, "2026-08", 50, "inactive");
  const commit = await store.commitAllocationPolicySuccessor(inactivePrevious, successor);
  expect(commit.ok).toBe(true);
  if (!commit.ok) throw new Error(commit.message);
  const afterPair = await store.listAllocationPolicies();
  expect(afterPair.ok && afterPair.value).toHaveLength(3);
  const storedPrevious = await store.getAllocationPolicy("alloc-cap-1");
  expect(storedPrevious.ok && storedPrevious.value?.status).toBe("inactive");
  const storedSuccessor = await store.getAllocationPolicy("alloc-cap-2");
  expect(storedSuccessor.ok && storedSuccessor.value?.rateMinorPerWholeUnit).toBe(60);

  /* ٤) عهدة الحتمية: إعادة تشغيل الخلافة بمفتاح الخلف نفسه تعيد الزوج
   *    المخزن كما هو — لا نسخة ثالثة. */
  const replay = await store.commitAllocationPolicySuccessor(inactivePrevious, successor);
  expect(replay.ok).toBe(true);
  if (!replay.ok) throw new Error(replay.message);
  const afterReplay = await store.listAllocationPolicies();
  expect(afterReplay.ok && afterReplay.value).toHaveLength(3);

  /* ٥) الرفض الصادر: خلافة على أصل غير فعال — هوية الخطأ المحفوظة
   *    (storage_error) وبلا كتابة. */
  const staleOrigin = await store.commitAllocationPolicySuccessor(
    inactivePrevious,
    createAllocationPolicySuccessor(august, {
      id: "alloc-cap-3",
      seriesId: "series-cap",
      successorOfPolicyId: "alloc-cap-1",
      version: 2,
      catalogItemId: "catalog-cap",
      periodFrom: "2026-09-01",
      periodTo: "2026-09-30",
      startsOn: "2026-09-01",
      endsOn: "2026-09-30",
      source: "اختبار القدرة",
      reason: "خلافة على أصل معطل",
      note: "عقد القدرة",
      status: "active",
      idempotencyKey: "alloc-cap-3",
      createdAt: AT,
      updatedAt: AT,
      kind: "per_output_unit",
      amountMinor: null,
      rateMinor: null,
      rateMinorPerWholeUnit: 70,
      percentageBps: null,
      unitId: "unit-piece",
    }),
  );
  expect(staleOrigin.ok).toBe(false);
  if (!staleOrigin.ok) expect(staleOrigin.code).toBe("storage_error");
  const afterStaleOrigin = await store.listAllocationPolicies();
  expect(afterStaleOrigin.ok && afterStaleOrigin.value).toHaveLength(3);

  /* ٦) الرفض الصادر: تعارض هوية الخلف — سجل قائم بالمعرف نفسه. */
  const conflictSuccessor = createAllocationPolicySuccessor(july, {
    id: "alloc-cap-2",
    seriesId: "series-cap",
    successorOfPolicyId: "alloc-cap-0",
    version: 2,
    catalogItemId: "catalog-cap",
    periodFrom: "2026-08-01",
    periodTo: "2026-08-31",
    startsOn: "2026-08-01",
    endsOn: "2026-08-31",
    source: "اختبار القدرة",
    reason: "تعارض هوية",
    note: "عقد القدرة",
    status: "active",
    idempotencyKey: "alloc-cap-2-conflict",
    createdAt: AT,
    updatedAt: AT,
    kind: "per_output_unit",
    amountMinor: null,
    rateMinor: null,
    rateMinorPerWholeUnit: 80,
    percentageBps: null,
    unitId: "unit-piece",
  });
  const conflict = await store.commitAllocationPolicySuccessor(
    makePolicy("alloc-cap-0", 1, "2026-07", 40, "inactive"),
    conflictSuccessor,
  );
  expect(conflict.ok).toBe(false);
  if (!conflict.ok) expect(conflict.code).toBe("storage_error");
  const afterConflict = await store.listAllocationPolicies();
  expect(afterConflict.ok && afterConflict.value).toHaveLength(3);

  /* ٧) الرفض الصادر: أصل لم يُخزَّن قط — لا خلافة بلا أصل. */
  const orphanOrigin = await store.commitAllocationPolicySuccessor(
    makePolicy("alloc-cap-never", 1, "2026-07", 40, "inactive"),
    createAllocationPolicySuccessor(makePolicy("alloc-cap-never", 1, "2026-07", 40), {
      id: "alloc-cap-4",
      seriesId: "series-cap",
      successorOfPolicyId: "alloc-cap-never",
      version: 2,
      catalogItemId: "catalog-cap",
      periodFrom: "2026-08-01",
      periodTo: "2026-08-31",
      startsOn: "2026-08-01",
      endsOn: "2026-08-31",
      source: "اختبار القدرة",
      reason: "خلافة يتيمة",
      note: "عقد القدرة",
      status: "active",
      idempotencyKey: "alloc-cap-4",
      createdAt: AT,
      updatedAt: AT,
      kind: "per_output_unit",
      amountMinor: null,
      rateMinor: null,
      rateMinorPerWholeUnit: 90,
      percentageBps: null,
      unitId: "unit-piece",
    }),
  );
  expect(orphanOrigin.ok).toBe(false);
  if (!orphanOrigin.ok) expect(orphanOrigin.code).toBe("storage_error");
  const orphan = await store.getAllocationPolicy("alloc-cap-4");
  expect(orphan.ok && orphan.value).toBeNull();
}

describe("Wave C — قدرة سياسات التوزيع (ADR-015 مجموعة 4): العضوية", () => {
  it("قائمة الطرق هي نطاق المجموعة بالضبط: 4 أسماء فريدة", () => {
    expect(allocationPolicyStoreMethods).toHaveLength(4);
    expect(new Set(allocationPolicyStoreMethods).size).toBe(4);
  });

  for (const [label, makeStore] of [
    ["MemoryLocalStore", () => new MemoryLocalStore()],
    ["IndexedDbLocalStore", () => new IndexedDbLocalStore()],
  ] as const) {
    it(`${label} يكشف كل طريقة قدرة كدالة`, () => {
      const store = makeStore();
      for (const method of allocationPolicyStoreMethods) {
        expect(
          typeof (store as unknown as Record<string, unknown>)[method],
          `${label}: طريقة القدرة مفقودة: ${method}`,
        ).toBe("function");
      }
    });
  }
});

describe("Wave C — قدرة سياسات التوزيع: العقود السلوكية عبر العدسة الضيقة", () => {
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

describe("Wave C — قدرة سياسات التوزيع: طبقة الأنواع", () => {
  it(
    "المحوّلان والواجهة التوافقية ما زالوا يحققون القدرة (tsc على ملف المراسي)",
    { timeout: 120_000 },
    () => {
      /* ملفات الاختبار مستثناة من فحص أنواع الـapp — لذا يُفرض هنا فحص المراسي
       * وحدها بامتداد tsconfig الـapp نفسه (نمط مراسي Wave 3B/4C). أي كسر
       * للتحقيق (توقيع/إسقاط implements/انحراف الواجهة) يفشل هنا فورًا. */
      const tmp = mkdtempSync(path.join(tmpdir(), "micro-allocation-capability-"));
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
