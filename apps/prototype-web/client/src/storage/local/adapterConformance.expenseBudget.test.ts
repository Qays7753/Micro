import "fake-indexeddb/auto";
import { afterEach, describe, expect, it } from "vitest";
import { createExpenseBudget, reviseExpenseBudget } from "@micro-domain/budget/index.js";
import type { ExpenseBudgetRecord } from "@micro-domain/budget/index.js";
import { IndexedDbLocalStore } from "./IndexedDbLocalStore";
import { MemoryLocalStore } from "./MemoryLocalStore";
import type { PrototypeLocalStore } from "./types";

/* FIN-002 (عقد ٤٢): مطابقة المحوّلين على عائلة الميزانيات — نفس عقد الحفظ
 * الحتمي والرفض الصادر والزوج الذرّي، ونفس اللقطة/الاستعادة؛ لا انفصام
 * سلوكي بين بيئة الاختبار والبيئة الحية (نمط adapterConformance.recurringExpense). */

const databaseName = "micro-prototype-local";
function clearDatabase() {
  return new Promise<void>((resolve, reject) => {
    const request = indexedDB.deleteDatabase(databaseName);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

const AT = "2026-09-22T08:00:00.000Z";

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

async function runConformanceScenarios(store: PrototypeLocalStore) {
  /* ١) الحفظ الحتمي: الإنشاء ثم إعادة إرسال نفس السجل = إعادة استخدام. */
  const general = makeBudget("budget-general", "2026-10", "op-create-general");
  const created = await store.saveExpenseBudget(general);
  expect(created.ok).toBe(true);
  if (!created.ok) throw new Error(created.message);
  expect(created.value.reused).toBe(false);
  const replayed = await store.saveExpenseBudget(general);
  expect(replayed.ok).toBe(true);
  if (!replayed.ok) throw new Error(replayed.message);
  expect(replayed.value.reused).toBe(true);

  /* ٢) القراءة: مرتبة زمنيًا (فترة ثم معرف)، والسجل كما كُتب حرفيًا. */
  const october = makeCategoryBudget("budget-fuel-10", "2026-10", "op-create-fuel-10");
  const november = makeCategoryBudget("budget-fuel-11", "2026-11", "op-create-fuel-11");
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
      afterConflict.value.find(budget => budget.id === "budget-fuel-10")?.amountMinor === 8_000,
  ).toBe(true);

  /* ٤) زوج المراجعة الذرّي: الخلف والسابقة معًا أو لا شيء. */
  const pair = reviseExpenseBudget(october, {
    successorId: "budget-fuel-10-r2",
    amountMinor: 9_500,
    knowledge: "known",
    note: "مراجعة بعد قياس الاستهلاك",
    operationKey: "op-revise-fuel-10",
    at: AT,
  });
  const committed = await store.saveExpenseBudgetRevisionPair(pair.successor, pair.supersededPrevious);
  expect(committed.ok).toBe(true);
  if (!committed.ok) throw new Error(committed.message);
  expect(committed.value.reused).toBe(false);
  const afterPair = await store.listExpenseBudgets();
  expect(afterPair.ok && afterPair.value).toHaveLength(4);
  const superseded = afterPair.ok
    ? afterPair.value.find(budget => budget.id === "budget-fuel-10")
    : undefined;
  expect(superseded?.status).toBe("superseded");
  expect(superseded?.supersededById).toBe("budget-fuel-10-r2");
  expect(superseded?.amountMinor).toBe(8_000);

  /* ٥) إعادة تشغيل الزوج كاملًا: إعادة استخدام صادقة. */
  const replayPair = await store.saveExpenseBudgetRevisionPair(pair.successor, pair.supersededPrevious);
  expect(replayPair.ok && replayPair.value.reused).toBe(true);
  const afterReplayPair = await store.listExpenseBudgets();
  expect(afterReplayPair.ok && afterReplayPair.value).toHaveLength(4);

  /* ٦) الزوج المكسور: السابقة لا تربط بخلفها — رفض صادر بلا كتابة. */
  const broken = await store.saveExpenseBudgetRevisionPair(pair.successor, {
    ...pair.supersededPrevious,
    supersededById: "not-the-successor",
  });
  expect(broken.ok).toBe(false);
  if (!broken.ok) expect(broken.code).toBe("storage_stale");
  const afterBroken = await store.listExpenseBudgets();
  expect(afterBroken.ok && afterBroken.value).toHaveLength(4);

  /* ٧) نصف زوج: الخلف قائم وحده — لا حالة بينية أبدًا. */
  const half = await store.saveExpenseBudgetRevisionPair(pair.successor, {
    ...pair.supersededPrevious,
    id: "budget-phantom",
  });
  expect(half.ok).toBe(false);
  if (!half.ok) expect(half.code).toBe("storage_stale");
  const phantom = await store.listExpenseBudgets();
  expect(phantom.ok && phantom.value.some(budget => budget.id === "budget-phantom")).toBe(false);

  /* ٧-ب) زوج بلا أصل: السابقة النافذة لم تُخزَّن قط — لا زوج مراجعة بلا أصل. */
  const unsavedPrevious = makeBudget("budget-unsaved", "2027-01", "op-create-unsaved");
  const unsavedPair = reviseExpenseBudget(unsavedPrevious, {
    successorId: "budget-unsaved-r2",
    amountMinor: 15_000,
    knowledge: "known",
    note: null,
    operationKey: "op-revise-unsaved",
    at: AT,
  });
  const orphanPair = await store.saveExpenseBudgetRevisionPair(
    unsavedPair.successor,
    unsavedPair.supersededPrevious,
  );
  expect(orphanPair.ok).toBe(false);
  if (!orphanPair.ok) expect(orphanPair.code).toBe("storage_stale");
  const afterOrphan = await store.listExpenseBudgets();
  expect(afterOrphan.ok && afterOrphan.value.some(budget => budget.id === "budget-unsaved")).toBe(false);

  /* ٨) اللقطة: العائلة داخلها كما كُتبت — والاستعادة ذهابًا وإيابًا. */
  const snapshot = await store.readSnapshot();
  expect(snapshot.ok).toBe(true);
  if (!snapshot.ok) throw new Error(snapshot.message);
  expect(snapshot.value.expenseBudgets).toHaveLength(4);
  const backup = structuredClone(snapshot.value);
  const replaced = await store.replaceSnapshot(backup);
  expect(replaced.ok).toBe(true);
  const reread = await store.readSnapshot();
  expect(reread.ok).toBe(true);
  if (!reread.ok) throw new Error(reread.message);
  expect(reread.value.expenseBudgets).toEqual(backup.expenseBudgets);

  /* ٩) استبدال بقائمة فارغة: الاستعادة تمسح العائلة كاملة لا جزئيًا. */
  const emptied = await store.replaceSnapshot({ ...backup, expenseBudgets: [] });
  expect(emptied.ok).toBe(true);
  const afterEmpty = await store.listExpenseBudgets();
  expect(afterEmpty.ok && afterEmpty.value).toHaveLength(0);
}

describe("FIN-002 — توائم المحوّلين لعائلة الميزانيات (عقد ٤٢)", () => {
  afterEach(async () => {
    await clearDatabase();
  });

  it("الذاكرة: نفس عقد الحفظ الحتمي والزوج الذرّي كاملًا", async () => {
    await runConformanceScenarios(new MemoryLocalStore());
  });

  it("IndexedDB (fake-indexeddb): نفس عقد الحفظ الحتمي والزوج الذرّي كاملًا", async () => {
    await clearDatabase();
    await runConformanceScenarios(new IndexedDbLocalStore());
  });

  it("لا كتابة إطلاقًا عند الفتح للقراءة فقط — لقطة قبل/بعد متطابقة", async () => {
    const store = new MemoryLocalStore();
    const budget = makeBudget("budget-read-only", "2026-10", "op-create-read-only");
    const created = await store.saveExpenseBudget(budget);
    expect(created.ok).toBe(true);
    const before = await store.readSnapshot();
    expect(before.ok).toBe(true);
    await store.listExpenseBudgets();
    const after = await store.readSnapshot();
    expect(after.ok).toBe(true);
    if (!before.ok || !after.ok) throw new Error("snapshot read failed");
    expect(after.value).toEqual(before.value);
  });
});

export type __BudgetShape = ExpenseBudgetRecord;
