/**
 * R3 (بطاقة R3-SC-02): عقد قدرة «الأحداث المالية». ثلاث طبقات إثبات،
 * بلا أي تعديل إنتاج:
 *
 *  1) العضوية: المحوّلان يكشفان طرق القدرة الخمس كلها كدوال — والقائمة
 *     نفسها محكومة النوع (Pick من الواجهة التوافقية) فلا تزد ولا تنقص
 *     بصمت.
 *  2) السلوك عبر عدسة القدرة: نفس عقود الالتزام المحروس للمحوّلين
 *     (الذاكرة وIndexedDB/fake-indexeddb) — الحفظ الحتمي (نفس
 *     idempotencyKey يعيد السجل كما هو فلا يتكرر الأثر المالي)، والقراءة
 *     كما كُتبت (قائمة ومفردة)، والتراجع الذرّي الموثق (وإعادته حتمية،
 *     والتراجع عن تراجع مرفوض، والمصدر المفقود رفض صادر بلا كتابة)،
 *     والتعديل الذرّي (تراجع + بديل معًا أو لا شيء؛ إعادته حتمية؛
 *     والمصدر المفقود رفض بلا كتابة). السيناريو يستقبل النوع الضيق
 *     `FinancialEventStore` حصرًا — أي ما يستطيع مستهلك القدرة ملاحظته.
 *  3) الأنواع: tsc على ملف المراسي زمن التشغيل بامتداد tsconfig الـapp
 *     نفسه (نمط مراسي Wave 3B/4C) — إثبات أن المحوّلين والواجهة
 *     التوافقية ما زالوا يحققون القدرة.
 */
import "fake-indexeddb/auto";
import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it } from "vitest";
import { createFinancialEvent, createFinancialReversal } from "@micro-domain/financial-event/index.js";
import type { FinancialEvent } from "@micro-domain/financial-event/index.js";
import { IndexedDbLocalStore } from "../IndexedDbLocalStore";
import { MemoryLocalStore } from "../MemoryLocalStore";
import { financialEventStoreMethods, type FinancialEventStore } from "./financialEventStore";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(HERE, "../../../../../../../");
const ANCHORS_FILE = path.join(HERE, "financialEventCapabilityAnchors.ts");
const APP_TSCONFIG = path.join(REPO_ROOT, "apps", "prototype-web", "tsconfig.json");

const databaseName = "micro-prototype-local";
function clearDatabase() {
  return new Promise<void>((resolve, reject) => {
    const request = indexedDB.deleteDatabase(databaseName);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

const AT = "2026-10-08T08:00:00.000Z";

function makeExpense(id: string, idempotencyKey: string): FinancialEvent {
  return createFinancialEvent({
    id,
    type: "operating_expense_cash",
    amountMinor: 12_500,
    occurredOn: "2026-10-07",
    recordedAt: AT,
    idempotencyKey,
    note: "مصروف تشغيلي نقدي لعقد القدرة",
    counterparty: null,
  });
}

/** السيناريو يستقبل النوع الضيق حصرًا — عدسة مستهلك القدرة لا أوسع. */
async function runCapabilityScenario(store: FinancialEventStore) {
  /* ١) الحفظ الحتمي: الإنشاء ثم حدث آخر بنفس idempotencyKey = إعادة
   *    السجل الأول كما هو — لا يتكرر الأثر المالي أبدًا. */
  const first = makeExpense("fin-cap-expense-1", "op-fin-cap-1");
  const saved = await store.saveFinancialEvent(first);
  expect(saved.ok).toBe(true);
  if (!saved.ok) throw new Error(saved.message);
  const duplicateKey = makeExpense("fin-cap-expense-1-dup", "op-fin-cap-1");
  const deduped = await store.saveFinancialEvent(duplicateKey);
  expect(deduped.ok).toBe(true);
  if (!deduped.ok) throw new Error(deduped.message);
  expect(deduped.value.id).toBe("fin-cap-expense-1");

  /* ٢) القراءة كما كُتبت: القائمة والمفردة، والمفقود null لا خطأ. */
  const second = makeExpense("fin-cap-expense-2", "op-fin-cap-2");
  await store.saveFinancialEvent(second);
  const listed = await store.listFinancialEvents();
  expect(listed.ok && listed.value.map(event => event.id).sort()).toEqual([
    "fin-cap-expense-1",
    "fin-cap-expense-2",
  ]);
  const single = await store.getFinancialEvent("fin-cap-expense-2");
  expect(single.ok && single.value?.amountMinor).toBe(12_500);
  const missing = await store.getFinancialEvent("fin-cap-no-such");
  expect(missing.ok && missing.value).toBeNull();

  /* ٣) التراجع الذرّي الموثق: يُقبل مرة، وإعادته حتمية (نفس
   *    idempotencyKey يعيد التراجع المخزن)، والتراجع عن تراجع مرفوض. */
  const reversal = createFinancialReversal({
    id: "fin-cap-reversal-1",
    idempotencyKey: "op-fin-cap-reverse-1",
    reason: "خطأ في المبلغ — تراجع موثق",
    occurredOn: "2026-10-08",
    recordedAt: AT,
    sourceEvent: first,
  });
  const corrected = await store.commitFinancialEventCorrection("fin-cap-expense-1", reversal);
  expect(corrected.ok).toBe(true);
  if (!corrected.ok) throw new Error(corrected.message);
  const replayedCorrection = await store.commitFinancialEventCorrection("fin-cap-expense-1", reversal);
  expect(replayedCorrection.ok).toBe(true);
  if (!replayedCorrection.ok) throw new Error(replayedCorrection.message);
  expect(replayedCorrection.value.id).toBe("fin-cap-reversal-1");
  /* حارس المحوّل نفسه: تصحيح ثانٍ مختلف (idempotencyKey آخر) للمصدر
   * نفسه — رفض صادر بلا كتابة (الحماية داخل المحوّلين لا في المصنع
   * المجالي وحده: «لا يمكن التراجع عن سجل تراجع سابق» يُفرض هنا عبر
   * كشف التراجع القائم). */
  const secondCorrection = createFinancialReversal({
    id: "fin-cap-reversal-dup",
    idempotencyKey: "op-fin-cap-reverse-dup",
    reason: "تصحيح ثانٍ مختلف — يجب أن يُرفض",
    occurredOn: "2026-10-08",
    recordedAt: AT,
    sourceEvent: first,
  });
  const rejectedSecond = await store.commitFinancialEventCorrection("fin-cap-expense-1", secondCorrection);
  expect(rejectedSecond.ok).toBe(false);
  const afterDouble = await store.listFinancialEvents();
  expect(
    afterDouble.ok && afterDouble.value.some(event => event.id === "fin-cap-reversal-dup"),
  ).toBe(false);

  /* ٤) المصدر المفقود: رفض صادر بلا كتابة — لا شبح يُخزَّن. */
  const ghost = createFinancialReversal({
    id: "fin-cap-reversal-ghost",
    idempotencyKey: "op-fin-cap-reverse-ghost",
    reason: "مصدر غير موجود",
    occurredOn: "2026-10-08",
    recordedAt: AT,
    sourceEvent: makeExpense("fin-cap-never-saved", "op-fin-cap-never"),
  });
  const rejectedGhost = await store.commitFinancialEventCorrection("fin-cap-never-saved", ghost);
  expect(rejectedGhost.ok).toBe(false);
  const afterGhost = await store.listFinancialEvents();
  expect(
    afterGhost.ok && afterGhost.value.some(event => event.id === "fin-cap-reversal-ghost"),
  ).toBe(false);

  /* ٥) التعديل الذرّي: التراجع والبديل معًا في معاملة واحدة — لا أثر
   *    معلّق بينهما أبدًا؛ وإعادته حتمية؛ والمصدر المفقود رفض بلا كتابة. */
  const editReversal = createFinancialReversal({
    id: "fin-cap-edit-rev",
    idempotencyKey: "op-fin-cap-edit-rev",
    reason: "تصحيح الفئة — تراجع وبديل",
    occurredOn: "2026-10-08",
    recordedAt: AT,
    sourceEvent: second,
  });
  const replacement = makeExpense("fin-cap-expense-2-new", "op-fin-cap-2-new");
  const replaced = await store.commitFinancialEventReplacement(
    "fin-cap-expense-2",
    editReversal,
    replacement,
  );
  expect(replaced.ok).toBe(true);
  if (!replaced.ok) throw new Error(replaced.message);
  expect(replaced.value.replacement.id).toBe("fin-cap-expense-2-new");
  const replayedReplacement = await store.commitFinancialEventReplacement(
    "fin-cap-expense-2",
    editReversal,
    replacement,
  );
  expect(replayedReplacement.ok).toBe(true);
  if (!replayedReplacement.ok) throw new Error(replayedReplacement.message);
  expect(replayedReplacement.value.replacement.id).toBe("fin-cap-expense-2-new");
  const afterReplacement = await store.listFinancialEvents();
  const ids = new Set((afterReplacement.ok ? afterReplacement.value : []).map(event => event.id));
  /* الذرية المرئية للمستهلك: الأصل استُبدل (بقي بتراجعه) والبديل موجود،
   * ولا نسخة بديلة ثانية من إعادة الإرسال. */
  expect(ids.has("fin-cap-expense-2")).toBe(true);
  expect(ids.has("fin-cap-expense-2-new")).toBe(true);
  expect(
    afterReplacement.ok &&
      afterReplacement.value.filter(event => event.id === "fin-cap-expense-2-new").length,
  ).toBe(1);
  const orphanReplacement = await store.commitFinancialEventReplacement(
    "fin-cap-never-saved",
    editReversal,
    replacement,
  );
  expect(orphanReplacement.ok).toBe(false);
}

describe("R3 — قدرة الأحداث المالية (بطاقة R3-SC-02): العضوية", () => {
  it("قائمة الطرق هي نطاق المجموعة بالضبط: 5 أسماء فريدة", () => {
    expect(financialEventStoreMethods).toHaveLength(5);
    expect(new Set(financialEventStoreMethods).size).toBe(5);
  });

  describe.each([
    ["MemoryLocalStore", () => new MemoryLocalStore()],
    ["IndexedDbLocalStore", () => new IndexedDbLocalStore()],
  ] as const)("%s يكشف كل طريقة قدرة كدالة", (_label, makeStore) => {
    it("العضوية كاملة", () => {
      const store = makeStore();
      for (const method of financialEventStoreMethods) {
        expect(typeof (store as unknown as FinancialEventStore)[method]).toBe("function");
      }
    });
  });
});

describe("R3 — قدرة الأحداث المالية: العقود السلوكية عبر العدسة الضيقة", () => {
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

describe("R3 — قدرة الأحداث المالية: طبقة الأنواع", () => {
  it(
    "المحوّلان والواجهة التوافقية ما زالوا يحققون القدرة (tsc على ملف المراسي)",
    { timeout: 120_000 },
    () => {
      /* ملفات الاختبار مستثناة من فحص أنواع الـapp — لذا يُفرض هنا فحص المراسي
       * وحدها بامتداد tsconfig الـapp نفسه (نمط مراسي Wave 3B/4C). أي كسر
       * للتحقيق (توقيع/إسقاط implements/انحراف الواجهة) يفشل هنا فورًا. */
      const tmp = mkdtempSync(path.join(tmpdir(), "micro-financial-event-capability-"));
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
