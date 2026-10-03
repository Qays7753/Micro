/**
 * Wave C (بطاقة ADR-015 مجموعة 2): عقد قدرة «الميزانيات» — الاستخراج
 * الثاني بترتيب ADR-15. ثلاث طبقات إثبات، بلا أي تعديل إنتاج:
 *
 *  1) العضوية: المحوّلان يكشفان طرق القدرة الثلاث كلها كدوال — والقائمة
 *     نفسها محكومة النوع (Pick من الواجهة التوافقية) فلا تزد ولا تنقص
 *     بصمت.
 *  2) السلوك عبر عدسة القدرة: نفس عقود الالتزام المحروس للمحوّلين
 *     (الذاكرة وIndexedDB/fake-indexeddb) — الحفظ الحتمي وإعادة الاستخدام
 *     الصادقة، والتعارض storage_stale بلا كتابة، وCAS الانتقالات الموثقة
 *     عبر expected، وزوج المراجعة الذرّي (خلف وسابقة معًا أو لا شيء؛
 *     إعادة التشغيل إعادةُ استخدام؛ والزوج المكسور أو النصفي أو اليتيم
 *     رفض صادر بلا كتابة). السيناريو يستقبل النوع الضيق `ExpenseBudgetStore`
 *     حصرًا — أي ما يستطيع مستهلك القدرة ملاحظته، لا أكثر؛ الآثار العابرة
 *     للحدود (اللقطة والاستعادة) تبقى محروسة في مصفوفة المطابقة الكاملة
 *     (adapterConformance.expenseBudget.test.ts).
 *  3) الأنواع: tsc على ملف المراسي زمن التشغيل بامتداد tsconfig الـapp
 *     نفسه (نمط مراسي Wave 3B/4C) — إثبات أن المحوّلين والواجهة
 *     التوافقية ما زالوا يحققون القدرة.
 */
import "fake-indexeddb/auto";
import { execFileSync } from "node:child_process";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it } from "vitest";
import {
  closeExpenseBudget,
  createExpenseBudget,
  reviseExpenseBudget,
} from "@micro-domain/budget/index.js";
import type { ExpenseBudgetRecord } from "@micro-domain/budget/index.js";
import { IndexedDbLocalStore } from "../IndexedDbLocalStore";
import { MemoryLocalStore } from "../MemoryLocalStore";
import {
  expenseBudgetStoreMethods,
  type ExpenseBudgetStore,
} from "./expenseBudgetStore";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(HERE, "../../../../../../../");
const ANCHORS_FILE = path.join(HERE, "expenseBudgetCapabilityAnchors.ts");
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

function makeBudget(id: string, periodKey: string, operationKey: string): ExpenseBudgetRecord {
  return createExpenseBudget(
    {
      id,
      periodKind: "month",
      periodKey,
      scope: { kind: "general_expense" },
      amountMinor: 20_000,
      knowledge: "known",
      note: "خطة شهرية صريحة",
      operationKey,
      createdAt: AT,
    },
    [],
  );
}

function makeCategoryBudget(id: string, periodKey: string, operationKey: string): ExpenseBudgetRecord {
  return createExpenseBudget(
    {
      id,
      periodKind: "month",
      periodKey,
      scope: { kind: "category", categoryLabel: "بنزين" },
      amountMinor: 8_000,
      knowledge: "estimated",
      note: null,
      operationKey,
      createdAt: AT,
    },
    [],
  );
}

/** السيناريو يستقبل النوع الضيق حصرًا — عدسة مستهلك القدرة لا أوسع. */
async function runCapabilityScenario(store: ExpenseBudgetStore) {
  /* ١) الحفظ الحتمي: الإنشاء ثم إعادة إرسال نفس السجل = إعادة استخدام صادقة. */
  const general = makeBudget("budget-cap-general", "2026-10", "op-cap-create-general");
  const created = await store.saveExpenseBudget(general);
  expect(created.ok).toBe(true);
  if (!created.ok) throw new Error(created.message);
  expect(created.value.reused).toBe(false);
  const replayed = await store.saveExpenseBudget(general);
  expect(replayed.ok).toBe(true);
  if (!replayed.ok) throw new Error(replayed.message);
  expect(replayed.value.reused).toBe(true);

  /* ٢) القراءة: السجلات كما كُتبت حرفيًا، مرتبة زمنيًا (فترة ثم معرف). */
  const october = makeCategoryBudget("budget-cap-fuel-10", "2026-10", "op-cap-create-fuel-10");
  const november = makeCategoryBudget("budget-cap-fuel-11", "2026-11", "op-cap-create-fuel-11");
  for (const budget of [november, october]) {
    const saved = await store.saveExpenseBudget(budget);
    expect(saved.ok).toBe(true);
  }
  const listed = await store.listExpenseBudgets();
  expect(listed.ok && listed.value).toHaveLength(3);
  expect(listed.ok && listed.value.map(budget => budget.periodKey)).toEqual([
    "2026-10",
    "2026-10",
    "2026-11",
  ]);

  /* ٣) التعارض: مضمون مختلف على المعرّف نفسه — رفض صادر بلا كتابة. */
  const conflict = await store.saveExpenseBudget({ ...october, amountMinor: 123_456 });
  expect(conflict.ok).toBe(false);
  if (!conflict.ok) expect(conflict.code).toBe("storage_stale");
  const afterConflict = await store.listExpenseBudgets();
  expect(
    afterConflict.ok &&
      afterConflict.value.find(budget => budget.id === "budget-cap-fuel-10")?.amountMinor === 8_000,
  ).toBe(true);

  /* ٤) CAS الانتقالات الموثقة: الإغلاق عبر expected المقروءة يُقبل؛
   *    وإعادة إرسال الانتقال نفسه إعادةُ استخدام صادقة (الحتمية)؛ أما
   *    المضمون المختلف بمتوقعة قديمة بعد تغيّر المخزون فيُرفض بلا كتابة. */
  const closed = closeExpenseBudget(october, { reason: "توقف خطة الوقود", at: AT });
  const transition = await store.saveExpenseBudget(closed, october);
  expect(transition.ok).toBe(true);
  if (!transition.ok) throw new Error(transition.message);
  const transitionReplay = await store.saveExpenseBudget(closed, october);
  expect(transitionReplay.ok).toBe(true);
  if (!transitionReplay.ok) throw new Error(transitionReplay.message);
  expect(transitionReplay.value.reused).toBe(true);
  const staleTransition = await store.saveExpenseBudget({ ...closed, amountMinor: 7_777 }, october);
  expect(staleTransition.ok).toBe(false);
  if (!staleTransition.ok) expect(staleTransition.code).toBe("storage_stale");
  const afterStaleTransition = await store.listExpenseBudgets();
  expect(
    afterStaleTransition.ok &&
      afterStaleTransition.value.find(budget => budget.id === "budget-cap-fuel-10")?.amountMinor ===
        8_000,
  ).toBe(true);

  /* ٥) زوج المراجعة الذرّي: الخلف والسابقة معًا أو لا شيء (القاعدة نافذة). */
  const pair = reviseExpenseBudget(november, {
    successorId: "budget-cap-fuel-11-r2",
    amountMinor: 9_500,
    knowledge: "known",
    note: "مراجعة بعد قياس الاستهلاك",
    operationKey: "op-cap-revise-fuel-11",
    at: AT,
  });
  const committed = await store.saveExpenseBudgetRevisionPair(pair.successor, pair.supersededPrevious);
  expect(committed.ok).toBe(true);
  if (!committed.ok) throw new Error(committed.message);
  expect(committed.value.reused).toBe(false);
  const afterPair = await store.listExpenseBudgets();
  expect(afterPair.ok && afterPair.value).toHaveLength(4);
  const superseded = afterPair.ok
    ? afterPair.value.find(budget => budget.id === "budget-cap-fuel-11")
    : undefined;
  expect(superseded?.status).toBe("superseded");
  expect(superseded?.supersededById).toBe("budget-cap-fuel-11-r2");
  expect(superseded?.amountMinor).toBe(8_000);

  /* ٦) إعادة تشغيل الزوج كاملًا: إعادة استخدام صادقة — لا زوج ثانٍ. */
  const replayPair = await store.saveExpenseBudgetRevisionPair(pair.successor, pair.supersededPrevious);
  expect(replayPair.ok && replayPair.value.reused).toBe(true);
  const afterReplayPair = await store.listExpenseBudgets();
  expect(afterReplayPair.ok && afterReplayPair.value).toHaveLength(4);

  /* ٧) الزوج المكسور: السابقة لا تربط بخلفها — رفض صادر بلا كتابة. */
  const broken = await store.saveExpenseBudgetRevisionPair(pair.successor, {
    ...pair.supersededPrevious,
    supersededById: "not-the-successor",
  });
  expect(broken.ok).toBe(false);
  if (!broken.ok) expect(broken.code).toBe("storage_stale");
  const afterBroken = await store.listExpenseBudgets();
  expect(afterBroken.ok && afterBroken.value).toHaveLength(4);

  /* ٨) نصف زوج: السابقة بهوية وهمية — لا حالة بينية أبدًا ولا شبح يُخزَّن. */
  const half = await store.saveExpenseBudgetRevisionPair(pair.successor, {
    ...pair.supersededPrevious,
    id: "budget-cap-phantom",
  });
  expect(half.ok).toBe(false);
  if (!half.ok) expect(half.code).toBe("storage_stale");
  const phantom = await store.listExpenseBudgets();
  expect(phantom.ok && phantom.value.some(budget => budget.id === "budget-cap-phantom")).toBe(false);

  /* ٩) زوج بلا أصل: السابقة النافذة لم تُخزَّن قط — لا زوج مراجعة بلا أصل. */
  const unsavedPrevious = makeBudget("budget-cap-unsaved", "2027-01", "op-cap-create-unsaved");
  const unsavedPair = reviseExpenseBudget(unsavedPrevious, {
    successorId: "budget-cap-unsaved-r2",
    amountMinor: 15_000,
    knowledge: "known",
    note: null,
    operationKey: "op-cap-revise-unsaved",
    at: AT,
  });
  const orphanPair = await store.saveExpenseBudgetRevisionPair(
    unsavedPair.successor,
    unsavedPair.supersededPrevious,
  );
  expect(orphanPair.ok).toBe(false);
  if (!orphanPair.ok) expect(orphanPair.code).toBe("storage_stale");
  const afterOrphan = await store.listExpenseBudgets();
  expect(
    afterOrphan.ok && afterOrphan.value.some(budget => budget.id === "budget-cap-unsaved"),
  ).toBe(false);
}

describe("Wave C — قدرة الميزانيات (ADR-015 مجموعة 2): العضوية", () => {
  it("قائمة الطرق هي نطاق المجموعة بالضبط: 3 أسماء فريدة", () => {
    expect(expenseBudgetStoreMethods).toHaveLength(3);
    expect(new Set(expenseBudgetStoreMethods).size).toBe(3);
  });

  for (const [label, makeStore] of [
    ["MemoryLocalStore", () => new MemoryLocalStore()],
    ["IndexedDbLocalStore", () => new IndexedDbLocalStore()],
  ] as const) {
    it(`${label} يكشف كل طريقة قدرة كدالة`, () => {
      const store = makeStore();
      for (const method of expenseBudgetStoreMethods) {
        expect(
          typeof (store as unknown as Record<string, unknown>)[method],
          `${label}: طريقة القدرة مفقودة: ${method}`,
        ).toBe("function");
      }
    });
  }
});

describe("Wave C — قدرة الميزانيات: العقود السلوكية عبر العدسة الضيقة", () => {
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

describe("Wave C — قدرة الميزانيات: طبقة الأنواع", () => {
  it(
    "المحوّلان والواجهة التوافقية ما زالوا يحققون القدرة (tsc على ملف المراسي)",
    { timeout: 120_000 },
    () => {
      /* ملفات الاختبار مستثناة من فحص أنواع الـapp — لذا يُفرض هنا فحص المراسي
       * وحدها بامتداد tsconfig الـapp نفسه (نمط مراسي Wave 3B/4C). أي كسر
       * للتحقيق (توقيع/إسقاط implements/انحراف الواجهة) يفشل هنا فورًا. */
      const tmp = mkdtempSync(path.join(tmpdir(), "micro-budget-capability-"));
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
