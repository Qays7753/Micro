import "fake-indexeddb/auto";
import { afterEach, describe, expect, it } from "vitest";
import {
  activateRecurringExpenseSeries,
  createRecurringExpenseDraftSeries,
  createRecurringExpenseOccurrence,
  markRecurringExpenseConfirmAttempted,
  markRecurringExpenseRecorded,
  replanRecurringExpenseOccurrence,
  skipRecurringExpenseOccurrence,
  snoozeRecurringExpenseOccurrence,
} from "@micro-domain/recurring-expense/index.js";
import type {
  RecurringExpenseOccurrence,
  RecurringExpenseSeries,
} from "@micro-domain/recurring-expense/index.js";
import type { FinancialEvent } from "@micro-domain/financial-event/index.js";
import { IndexedDbLocalStore } from "./IndexedDbLocalStore";
import { MemoryLocalStore } from "./MemoryLocalStore";
import type { PrototypeLocalStore } from "./types";

/* OPS-003 (عقد ٤١): مطابقة المحوّلين على عائلة المصروف المتكرر — نفس عقد
 * الالتزام المحروس، نفس نتائج الإعادة والتعارض والاصطدام، نفس الحتمية
 * داخل حد الكتابة؛ لا انفصام سلوكي بين بيئة الاختبار والبيئة الحية. */

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
    id: "series-1",
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
    seriesId: "series-1",
    revision: 1,
    periodKey,
    dueOn,
    createdAt: AT,
  });
}

function makeEvent(id: string, key: string, amountMinor = 25_000): FinancialEvent {
  return {
    id,
    type: "operating_expense_cash",
    currency: "JOD",
    amountMinor,
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
    cashDeltaMinor: -amountMinor,
    payableDeltaMinor: 0,
    ownerCapitalDeltaMinor: 0,
    operatingExpenseDeltaMinor: amountMinor,
  };
}

async function commitDecision(
  store: PrototypeLocalStore,
  base: RecurringExpenseOccurrence,
  next: RecurringExpenseOccurrence,
) {
  const result = await store.commitRecurringExpenseOccurrenceDecision(base, next);
  if (!result.ok) throw new Error(result.message);
  return result.value;
}

async function runConformanceScenarios(store: PrototypeLocalStore) {
  /* ١) إنشاء المسودة: سلسلة + مراجعة أولى — والإنشاء المكرر إعادة استخدام. */
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

  /* ٣) قراءة العائلات الثلاث. */
  const seriesList = await store.listRecurringExpenseSeries();
  expect(seriesList.ok && seriesList.value).toHaveLength(1);
  const revisionList = await store.listRecurringExpenseRevisions();
  expect(revisionList.ok && revisionList.value).toHaveLength(1);
  const fetched = await store.getRecurringExpenseSeries("series-1");
  expect(fetched.ok && fetched.value?.title).toBe("إيجار المحل الشهري");

  /* ٤) توليد الفترات (إضافة فقط) ثم قراراتها: تأجيل وتخطٍ — قرارات محفوظة لا أحداث. */
  const september = makeOccurrence("2026-09", "2026-09-05");
  const august = makeOccurrence("2026-08", "2026-08-05");
  const materialized = await store.commitRecurringExpenseOccurrences([september, august]);
  expect(materialized.ok).toBe(true);
  if (!materialized.ok) throw new Error(materialized.message);
  expect(materialized.value).toEqual({ created: 2, skipped: 0 });
  const rematerialized = await store.commitRecurringExpenseOccurrences([september, august]);
  expect(rematerialized.ok && rematerialized.value).toEqual({ created: 0, skipped: 2 });
  const divergedMaterialization = await store.commitRecurringExpenseOccurrences([
    { ...september, dueOn: "2026-09-06" },
  ]);
  expect(divergedMaterialization.ok).toBe(false);
  if (!divergedMaterialization.ok) expect(divergedMaterialization.code).toBe("storage_stale");
  const snoozed = snoozeRecurringExpenseOccurrence(september, "2026-09-25", TODAY, AT);
  const snoozeResult = await commitDecision(store, september, snoozed);
  expect(snoozeResult.occurrence.status).toBe("snoozed");
  const skipped = skipRecurringExpenseOccurrence(august, "دفع نقدًا خارج النظام", AT);
  await commitDecision(store, august, skipped);

  /* ٥) علامة المحاولة قبل الالتزام الذرّي. */
  const attempted = markRecurringExpenseConfirmAttempted(snoozed, AT);
  await commitDecision(store, snoozed, attempted);

  /* ٦) التسجيل الذرّي: الفترة والحدث معًا — حدث واحد بالضبط. */
  const recorded = markRecurringExpenseRecorded(attempted, {
    eventId: "event-rent-09",
    amountMinor: 25_000,
    walletId: null,
    occurredOn: "2026-09-05",
    reused: false,
    at: AT,
  });
  const event = makeEvent("event-rent-09", recorded.recordingIdempotencyKey);
  const committed = await store.commitRecurringExpenseOccurrenceRecord(attempted, recorded, event);
  expect(committed.ok).toBe(true);
  if (!committed.ok) throw new Error(committed.message);
  expect(committed.value.reused).toBe(false);
  const eventsAfterCommit = await store.listFinancialEvents();
  expect(eventsAfterCommit.ok && eventsAfterCommit.value).toHaveLength(1);

  /* ٧) إعادة التأكيد بنفس المفتاح: إعادة استخدام صادقة لا حدث ثانٍ. */
  const replay = await store.commitRecurringExpenseOccurrenceRecord(attempted, recorded, event);
  expect(replay.ok).toBe(true);
  if (!replay.ok) throw new Error(replay.message);
  expect(replay.value.reused).toBe(true);
  const eventsAfterReplay = await store.listFinancialEvents();
  expect(eventsAfterReplay.ok && eventsAfterReplay.value).toHaveLength(1);

  /* ٨) السباق: تأكيدان متزامنان بمفتاح واحد — حدث واحد وreused. */
  const october = makeOccurrence("2026-10", "2026-10-05");
  await store.commitRecurringExpenseOccurrences([october]);
  const attemptedOctober = markRecurringExpenseConfirmAttempted(october, AT);
  await commitDecision(store, october, attemptedOctober);
  const recordedOctober = markRecurringExpenseRecorded(attemptedOctober, {
    eventId: "event-rent-10",
    amountMinor: 25_000,
    walletId: null,
    occurredOn: "2026-10-05",
    reused: false,
    at: AT,
  });
  const eventOctober = makeEvent("event-rent-10", recordedOctober.recordingIdempotencyKey);
  const raced = await Promise.all([
    store.commitRecurringExpenseOccurrenceRecord(attemptedOctober, recordedOctober, eventOctober),
    store.commitRecurringExpenseOccurrenceRecord(attemptedOctober, recordedOctober, eventOctober),
  ]);
  expect(raced.every(result => result.ok)).toBe(true);
  const eventsAfterRace = await store.listFinancialEvents();
  expect(eventsAfterRace.ok && eventsAfterRace.value).toHaveLength(2);
  const reusedCount = raced.filter(result => result.ok && result.value.reused).length;
  expect(reusedCount).toBeGreaterThanOrEqual(1);

  /* ٩) التعارض: أساس قديم بعد كتابة أخرى — رفض بلا كتابة (storage_stale). */
  const staleAttempt = await store.commitRecurringExpenseOccurrenceDecision(
    october,
    attemptedOctober,
    snoozeRecurringExpenseOccurrence(october, "2026-10-01", TODAY, AT),
  );
  expect(staleAttempt.ok).toBe(false);
  if (!staleAttempt.ok) expect(staleAttempt.code).toBe("storage_stale");

  /* ١٠) اصطدام المفتاح عبر الأنواع: حدث قائم بنفس المفتاح ونوع مختلف — رفض
   * صادر بلا كتابة (عقد ٤١ §٨). */
  const november = makeOccurrence("2026-11", "2026-11-05");
  await store.commitRecurringExpenseOccurrences([november]);
  const attemptedNovember = markRecurringExpenseConfirmAttempted(november, AT);
  await commitDecision(store, november, attemptedNovember);
  const recordedNovember = markRecurringExpenseRecorded(attemptedNovember, {
    eventId: "event-rent-11",
    amountMinor: 25_000,
    walletId: null,
    occurredOn: "2026-11-05",
    reused: false,
    at: AT,
  });
  const foreignEvent = makeEvent("event-foreign", recordedNovember.recordingIdempotencyKey);
  foreignEvent.type = "operating_expense_payable";
  foreignEvent.payableDeltaMinor = 25_000;
  foreignEvent.cashDeltaMinor = 0;
  const collision = await store.commitRecurringExpenseOccurrenceRecord(
    attemptedNovember,
    recordedNovember,
    foreignEvent,
  );
  expect(collision.ok).toBe(false);
  if (!collision.ok) expect(collision.code).toBe("storage_stale");
  const eventsAfterCollision = await store.listFinancialEvents();
  expect(eventsAfterCollision.ok && eventsAfterCollision.value).toHaveLength(2);
  const novemberAfter = await store.getRecurringExpenseOccurrence("series-1:2026-11:0");
  expect(novemberAfter.ok && novemberAfter.value?.status).toBe("recording");

  /* ١١) التعاقب مع إعادة اشتقاق فترة planned بلا قرار — كله أو لا شيء. */
  const december = makeOccurrence("2026-12", "2026-12-05");
  await store.commitRecurringExpenseOccurrences([december]);
  const replannedDecember = replanRecurringExpenseOccurrence(december, 2, "2026-12-10", AT);
  const successor = {
    ...revision,
    id: "series-1:r2",
    revision: 2,
    effectiveFromPeriod: "2026-12",
    dueDay: 10,
    createdAt: AT,
  };
  const succession = await store.commitRecurringExpenseSeriesChange(
    active,
    { ...active, currentRevision: 2, updatedAt: AT },
    successor,
    [{ base: december, next: replannedDecember }],
  );
  expect(succession.ok).toBe(true);
  if (!succession.ok) throw new Error(succession.message);
  const decemberAfter = await store.getRecurringExpenseOccurrence("series-1:2026-12:0");
  expect(decemberAfter.ok && decemberAfter.value?.dueOn).toBe("2026-12-10");
  expect(decemberAfter.ok && decemberAfter.value?.revision).toBe(2);
  const revisionListAfter = await store.listRecurringExpenseRevisions();
  expect(revisionListAfter.ok && revisionListAfter.value).toHaveLength(2);

  /* ١٢) اللقطة: العائلات الثلاث داخلها كما كُتبت — والاستعادة ذهابًا وإيابًا. */
  const snapshot = await store.readSnapshot();
  expect(snapshot.ok).toBe(true);
  if (!snapshot.ok) throw new Error(snapshot.message);
  expect(snapshot.value.recurringExpenseSeries).toHaveLength(1);
  expect(snapshot.value.recurringExpenseRevisions).toHaveLength(2);
  expect(snapshot.value.recurringExpenseOccurrences).toHaveLength(5);
  const backup = structuredClone(snapshot.value);
  const replaced = await store.replaceSnapshot(backup);
  expect(replaced.ok).toBe(true);
  const reread = await store.readSnapshot();
  expect(reread.ok).toBe(true);
  if (!reread.ok) throw new Error(reread.message);
  expect(reread.value.recurringExpenseSeries).toEqual(backup.recurringExpenseSeries);
  expect(reread.value.recurringExpenseRevisions).toEqual(backup.recurringExpenseRevisions);
  expect(reread.value.recurringExpenseOccurrences).toEqual(backup.recurringExpenseOccurrences);
}

describe("OPS-003 — توائم المحوّلين لعائلة المصروف المتكرر (عقد ٤١)", () => {
  afterEach(async () => {
    await clearDatabase();
  });

  it("الذاكرة: نفس عقد الالتزام المحروس كاملًا", async () => {
    await runConformanceScenarios(new MemoryLocalStore());
  });

  it("IndexedDB (fake-indexeddb): نفس عقد الالتزام المحروس كاملًا", async () => {
    await clearDatabase();
    await runConformanceScenarios(new IndexedDbLocalStore());
  });

  it("لا كتابة إطلاقًا عند الفتح للقراءة فقط — لقطة قبل/بعد متطابقة", async () => {
    const store = new MemoryLocalStore();
    const { series, revision } = makeDraft();
    const created = await store.commitRecurringExpenseDraft(series, revision);
    expect(created.ok).toBe(true);
    const before = await store.readSnapshot();
    expect(before.ok).toBe(true);
    await store.listRecurringExpenseSeries();
    await store.listRecurringExpenseOccurrences();
    await store.getRecurringExpenseSeries("series-1");
    const after = await store.readSnapshot();
    expect(after.ok).toBe(true);
    if (!before.ok || !after.ok) throw new Error("snapshot read failed");
    expect(after.value).toEqual(before.value);
  });
});

export type __SeriesShape = RecurringExpenseSeries;
