/**
 * Wave C (بطاقة ADR-015 مجموعة 1): عقد قدرة «المصروف المتكرر» — أول
 * استخراج بعد الطيار. ثلاث طبقات إثبات، بلا أي تعديل إنتاج:
 *
 *  1) العضوية: المحوّلان يكشفان طرق القدرة العشر كلها كدوال — والقائمة
 *     نفسها محكومة النوع (Pick من الواجهة التوافقية) فلا تزد ولا تنقص
 *     بصمت.
 *  2) السلوك عبر عدسة القدرة: نفس عقود الالتزام المحروس للمحوّلين
 *     (الذاكرة وIndexedDB/fake-indexeddb) — إنشاء وإعادة استخدام صادقة،
 *     تفعيل محروس، توليد فترات (إضافة فقط) والتعارض storage_stale بلا
 *     كتابة، قرارات محروسة، والتسجيل الذرّي بنتائجه عبر قيم الإرجاع
 *     نفسها. السيناريو يستقبل النوع الضيق `RecurringExpenseStore` حصرًا —
 *     أي ما يستطيع مستهلك القدرة ملاحظته، لا أكثر؛ الآثار العابرة للحدود
 *     (الحدث المالي المرافق) تبقى محروسة في مصفوفة المطابقة الكاملة
 *     (adapterConformance.recurringExpense.test.ts).
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
  activateRecurringExpenseSeries,
  createRecurringExpenseDraftSeries,
  createRecurringExpenseOccurrence,
  markRecurringExpenseConfirmAttempted,
  markRecurringExpenseRecorded,
  snoozeRecurringExpenseOccurrence,
} from "@micro-domain/recurring-expense/index.js";
import type { RecurringExpenseOccurrence } from "@micro-domain/recurring-expense/index.js";
import type { FinancialEvent } from "@micro-domain/financial-event/index.js";
import { IndexedDbLocalStore } from "../IndexedDbLocalStore";
import { MemoryLocalStore } from "../MemoryLocalStore";
import { recurringExpenseStoreMethods, type RecurringExpenseStore } from "./recurringExpenseStore";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(HERE, "../../../../../../../");
const ANCHORS_FILE = path.join(HERE, "recurringExpenseCapabilityAnchors.ts");
const APP_TSCONFIG = path.join(REPO_ROOT, "apps", "prototype-web", "tsconfig.json");

const databaseName = "micro-prototype-local";
function clearDatabase() {
  return new Promise<void>((resolve, reject) => {
    const request = indexedDB.deleteDatabase(databaseName);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

const AT = "2026-09-21T08:00:00.000Z";
const TODAY = "2026-09-21";

function makeDraft() {
  return createRecurringExpenseDraftSeries({
    id: "series-cap-1",
    title: "إيجار المحل الشهري",
    createdAt: AT,
    rule: {
      effectiveFromPeriod: "2026-01",
      frequency: "monthly",
      interval: 1,
      anchorDate: "2026-01-05",
      dueDay: 5,
      monthEndPolicy: "last_valid_day",
      timezone: "Asia/Amman",
      amountMode: "suggested",
      suggestedAmountMinor: 25_000,
      suggestedWalletId: null,
      categoryLabel: "إيجار",
      changeReason: null,
    },
  });
}

function makeOccurrence(periodKey: string, dueOn: string): RecurringExpenseOccurrence {
  return createRecurringExpenseOccurrence({
    seriesId: "series-cap-1",
    revision: 1,
    periodKey,
    dueOn,
    createdAt: AT,
  });
}

function makeEvent(id: string, key: string): FinancialEvent {
  return {
    id,
    type: "operating_expense_cash",
    currency: "JOD",
    amountMinor: 25_000,
    occurredOn: "2026-09-05",
    recordedAt: AT,
    idempotencyKey: key,
    note: "إيجار المحل",
    counterparty: null,
    relatedEventId: null,
    expenseContext: {
      relationship: "project",
      behavior: "fixed",
      purpose: "period",
      knowledge: "known",
    },
    correctionType: null,
    correctionOfEventId: null,
    correctionReason: null,
  };
}

async function commitDecision(
  store: RecurringExpenseStore,
  base: RecurringExpenseOccurrence,
  next: RecurringExpenseOccurrence,
) {
  const result = await store.commitRecurringExpenseOccurrenceDecision(base, next);
  if (!result.ok) throw new Error(result.message);
  return result.value;
}

/** السيناريو يستقبل النوع الضيق حصرًا — عدسة مستهلك القدرة لا أوسع. */
async function runCapabilityScenario(store: RecurringExpenseStore) {
  /* ١) الإنشاء وإعادة الاستخدام الصادقة. */
  const { series, revision } = makeDraft();
  const created = await store.commitRecurringExpenseDraft(series, revision);
  expect(created.ok).toBe(true);
  if (!created.ok) throw new Error(created.message);
  expect(created.value.reused).toBe(false);
  const replayed = await store.commitRecurringExpenseDraft(series, revision);
  expect(replayed.ok).toBe(true);
  if (!replayed.ok) throw new Error(replayed.message);
  expect(replayed.value.reused).toBe(true);

  /* ٢) التفعيل عبر تغيير محروس. */
  const active = activateRecurringExpenseSeries(series, AT);
  const activation = await store.commitRecurringExpenseSeriesChange(series, active, null, []);
  expect(activation.ok).toBe(true);
  if (!activation.ok) throw new Error(activation.message);
  expect(activation.value.series.status).toBe("active");

  /* ٣) القراءات الخمس عبر العدسة الضيقة. */
  const seriesList = await store.listRecurringExpenseSeries();
  expect(seriesList.ok && seriesList.value).toHaveLength(1);
  const revisionList = await store.listRecurringExpenseRevisions();
  expect(revisionList.ok && revisionList.value).toHaveLength(1);
  const fetched = await store.getRecurringExpenseSeries("series-cap-1");
  expect(fetched.ok && fetched.value?.title).toBe("إيجار المحل الشهري");
  const missing = await store.getRecurringExpenseSeries("غير-موجود");
  expect(missing.ok && missing.value).toBeNull();

  /* ٤) توليد الفترات (إضافة فقط)؛ التعارض storage_stale بلا كتابة. */
  const september = makeOccurrence("2026-09", "2026-09-05");
  const august = makeOccurrence("2026-08", "2026-08-05");
  const materialized = await store.commitRecurringExpenseOccurrences([september, august]);
  expect(materialized.ok).toBe(true);
  if (!materialized.ok) throw new Error(materialized.message);
  expect(materialized.value).toEqual({ created: 2, skipped: 0 });
  const rematerialized = await store.commitRecurringExpenseOccurrences([september, august]);
  expect(rematerialized.ok && rematerialized.value).toEqual({ created: 0, skipped: 2 });
  const diverged = await store.commitRecurringExpenseOccurrences([{ ...september, dueOn: "2026-09-06" }]);
  expect(diverged.ok).toBe(false);
  if (!diverged.ok) expect(diverged.code).toBe("storage_stale");
  const occurrenceList = await store.listRecurringExpenseOccurrences();
  expect(occurrenceList.ok && occurrenceList.value).toHaveLength(2);
  const oneOccurrence = await store.getRecurringExpenseOccurrence(september.id);
  expect(oneOccurrence.ok && oneOccurrence.value?.periodKey).toBe("2026-09");

  /* ٥) قرار (تأجيل) عبر الالتزام المحروس؛ والقرار على قاعدة قديمة يُرفض. */
  const snoozed = snoozeRecurringExpenseOccurrence(september, "2026-09-25", TODAY, AT);
  const snoozeResult = await commitDecision(store, september, snoozed);
  expect(snoozeResult.occurrence.status).toBe("snoozed");
  const staleDecision = await store.commitRecurringExpenseOccurrenceDecision(september, {
    ...snoozed,
    dueOn: "2026-09-26",
  });
  expect(staleDecision.ok).toBe(false);
  if (!staleDecision.ok) expect(staleDecision.code).toBe("storage_stale");

  /* ٦) علامة المحاولة ثم التسجيل الذرّي — عبر قيم الإرجاع نفسها. */
  const attempted = markRecurringExpenseConfirmAttempted(snoozed, AT);
  await commitDecision(store, snoozed, attempted);
  const recorded = markRecurringExpenseRecorded(attempted, {
    eventId: "event-cap-rent-09",
    amountMinor: 25_000,
    walletId: null,
    occurredOn: "2026-09-05",
    reused: false,
    at: AT,
  });
  const committed = await store.commitRecurringExpenseOccurrenceRecord(
    attempted,
    recorded,
    makeEvent("event-cap-rent-09", recorded.recordingIdempotencyKey),
  );
  expect(committed.ok).toBe(true);
  if (!committed.ok) throw new Error(committed.message);
  expect(committed.value.reused).toBe(false);

  /* ٧) إعادة التأكيد بنفس المدخلات: إعادة استخدام صادقة. */
  const replay = await store.commitRecurringExpenseOccurrenceRecord(
    attempted,
    recorded,
    makeEvent("event-cap-rent-09", recorded.recordingIdempotencyKey),
  );
  expect(replay.ok).toBe(true);
  if (!replay.ok) throw new Error(replay.message);
  expect(replay.value.reused).toBe(true);

  /* ٨) السباق: تسجيلان متزامنان — أحدهما يفوز والآخر إعادة استخدام. */
  const october = makeOccurrence("2026-10", "2026-10-05");
  await store.commitRecurringExpenseOccurrences([october]);
  const attemptedOctober = markRecurringExpenseConfirmAttempted(october, AT);
  await commitDecision(store, october, attemptedOctober);
  const recordedOctober = markRecurringExpenseRecorded(attemptedOctober, {
    eventId: "event-cap-rent-10",
    amountMinor: 25_000,
    walletId: null,
    occurredOn: "2026-10-05",
    reused: false,
    at: AT,
  });
  const raced = await Promise.all([
    store.commitRecurringExpenseOccurrenceRecord(
      attemptedOctober,
      recordedOctober,
      makeEvent("event-cap-rent-10", recordedOctober.recordingIdempotencyKey),
    ),
    store.commitRecurringExpenseOccurrenceRecord(
      attemptedOctober,
      recordedOctober,
      makeEvent("event-cap-rent-10", recordedOctober.recordingIdempotencyKey),
    ),
  ]);
  expect(raced.every(r => r.ok)).toBe(true);
  expect(raced.filter(r => r.ok && r.value.reused)).toHaveLength(1);
}

describe("Wave C — قدرة المصروف المتكرر (ADR-015 مجموعة 1): العضوية", () => {
  it("قائمة الطرق هي نطاق المجموعة بالضبط: 10 أسماء فريدة", () => {
    expect(recurringExpenseStoreMethods).toHaveLength(10);
    expect(new Set(recurringExpenseStoreMethods).size).toBe(10);
  });

  for (const [label, makeStore] of [
    ["MemoryLocalStore", () => new MemoryLocalStore()],
    ["IndexedDbLocalStore", () => new IndexedDbLocalStore()],
  ] as const) {
    it(`${label} يكشف كل طريقة قدرة كدالة`, () => {
      const store = makeStore();
      for (const method of recurringExpenseStoreMethods) {
        expect(
          typeof (store as unknown as Record<string, unknown>)[method],
          `${label}: طريقة القدرة مفقودة: ${method}`,
        ).toBe("function");
      }
    });
  }
});

describe("Wave C — قدرة المصروف المتكرر: العقود السلوكية عبر العدسة الضيقة", () => {
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

describe("Wave C — قدرة المصروف المتكرر: طبقة الأنواع", () => {
  it(
    "المحوّلان والواجهة التوافقية ما زالوا يحققون القدرة (tsc على ملف المراسي)",
    { timeout: 120_000 },
    () => {
      /* ملفات الاختبار مستثناة من فحص أنواع الـapp — لذا يُفرض هنا فحص المراسي
       * وحدها بامتداد tsconfig الـapp نفسه (نمط مراسي Wave 3B/4C). أي كسر
       * للتحقيق (توقيع/إسقاط implements/انحراف الواجهة) يفشل هنا فورًا. */
      const tmp = mkdtempSync(path.join(tmpdir(), "micro-recurring-capability-"));
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
