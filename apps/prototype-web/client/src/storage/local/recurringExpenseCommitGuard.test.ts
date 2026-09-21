import { describe, expect, it } from "vitest";
import {
  validateRecurringExpenseDraftCommit,
  validateRecurringExpenseKeyEventCollision,
  validateRecurringExpenseOccurrenceDecision,
  validateRecurringExpenseOccurrenceRecordCommit,
  validateRecurringExpenseSeriesChange,
} from "./recurringExpenseCommitGuard";
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

const AT = "2026-09-21T08:00:00.000Z";
const TODAY = "2026-09-21";

const draft = () =>
  createRecurringExpenseDraftSeries({
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

const occurrenceFor = (periodKey: string, dueOn: string): RecurringExpenseOccurrence =>
  createRecurringExpenseOccurrence({
    seriesId: "series-1",
    revision: 1,
    periodKey,
    dueOn,
    createdAt: AT,
  });

const eventFixture = (id: string, key: string): FinancialEvent => ({
  id,
  type: "operating_expense_cash",
  currency: "JOD",
  amountMinor: 25_000,
  occurredOn: "2026-09-05",
  recordedAt: AT,
  idempotencyKey: key,
  note: "إيجار المحل — فترة 2026-09",
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
  cashDeltaMinor: -25_000,
  payableDeltaMinor: 0,
  ownerCapitalDeltaMinor: 0,
  operatingExpenseDeltaMinor: 25_000,
});

describe("OPS-003 — حارس التزام المصروف المتكرر (نقي، عقد ٤١ §٨)", () => {
  it("إنشاء المسودة: الغياب التام مقبول؛ والتطابق الحرفي إعادة استخدام؛ والانحراف تعارض", () => {
    const { series, revision } = draft();
    expect(validateRecurringExpenseDraftCommit(undefined, undefined, series, revision)).toEqual({ ok: true });
    expect(validateRecurringExpenseDraftCommit(series, revision, series, revision)).toEqual({
      ok: true,
      reused: true,
    });
    expect(validateRecurringExpenseDraftCommit(series, undefined, series, revision).ok).toBe(false);
    const diverged = { ...series, title: "عنوان آخر" };
    expect(validateRecurringExpenseDraftCommit(series, revision, diverged, revision).ok).toBe(false);
  });
  it("تغيير السلسلة: الأساس الحي شرط؛ والمراجعة الخلف جديدة؛ وأرقامها تطابق رأس السلسلة", () => {
    const { series, revision } = draft();
    const active = activateRecurringExpenseSeries(series, AT);
    const successor = {
      ...revision,
      id: "series-1:r2",
      revision: 2,
      effectiveFromPeriod: "2026-06",
      dueDay: 10,
    };
    const nextSeries = { ...active, currentRevision: 2, updatedAt: AT };
    expect(
      validateRecurringExpenseSeriesChange(active, [revision], [], active, nextSeries, successor, []),
    ).toEqual({ ok: true });
    const divergedBase = { ...active, title: "عنوان آخر" };
    expect(
      validateRecurringExpenseSeriesChange(active, [revision], [], divergedBase, nextSeries, successor, [])
        .ok,
    ).toBe(false);
    expect(
      validateRecurringExpenseSeriesChange(
        active,
        [revision, successor],
        [],
        active,
        nextSeries,
        successor,
        [],
      ).ok,
    ).toBe(false);
    const wrongHead = { ...nextSeries, currentRevision: 3 };
    expect(
      validateRecurringExpenseSeriesChange(active, [revision], [], active, wrongHead, successor, []).ok,
    ).toBe(false);
  });
  it("قرار الفترة: الغياب تعارض؛ والتطابق مع النتيجة إعادة استخدام؛ والانحراف تعارض", () => {
    const planned = occurrenceFor("2026-10", "2026-10-05");
    expect(validateRecurringExpenseOccurrenceDecision(undefined, planned, planned).ok).toBe(false);
    const snoozed = snoozeRecurringExpenseOccurrence(planned, "2026-10-01", TODAY, AT);
    expect(validateRecurringExpenseOccurrenceDecision(snoozed, planned, snoozed)).toEqual({
      ok: true,
      reused: true,
    });
    expect(validateRecurringExpenseOccurrenceDecision(snoozed, snoozed, snoozed)).toEqual({
      ok: true,
      reused: true,
    });
    expect(validateRecurringExpenseOccurrenceDecision(snoozed, planned, planned).ok).toBe(false);
    /* الحارس يفحص التقادم فقط — شرعية الانتقال نفسها مسؤولية سياسات الدومين
     * النقية قبل الالتزام؛ الأساس المطابق يمر أياً كانت النتيجة. */
    const other = { ...planned, dueOn: "2026-10-06" };
    expect(validateRecurringExpenseOccurrenceDecision(snoozed, snoozed, other)).toEqual({ ok: true });
  });
  it("حارس الاصطدام: المفتاح المشترك بحدث مختلف النوع أو المبلغ يُرفض صادرًا", () => {
    const event = eventFixture("event-1", "series-1:2026-10:0");
    expect(validateRecurringExpenseKeyEventCollision(event, "operating_expense_cash", 25_000)).toEqual({
      ok: true,
      reused: true,
    });
    expect(validateRecurringExpenseKeyEventCollision(event, "operating_expense_payable", 25_000).ok).toBe(
      false,
    );
    expect(validateRecurringExpenseKeyEventCollision(event, "operating_expense_cash", 30_000).ok).toBe(false);
  });
  it("التسجيل الذرّي: الإعادة إعادة استخدام؛ والفترة المقَرَّرة بحدث آخر رفض صادر", () => {
    const planned = occurrenceFor("2026-10", "2026-10-05");
    const attempted = markRecurringExpenseConfirmAttempted(planned, AT);
    const recorded = markRecurringExpenseRecorded(attempted, {
      eventId: "event-1",
      amountMinor: 25_000,
      walletId: null,
      occurredOn: "2026-10-05",
      reused: false,
      at: AT,
    });
    const event = eventFixture("event-1", recorded.recordingIdempotencyKey);
    expect(
      validateRecurringExpenseOccurrenceRecordCommit(recorded, attempted, recorded, event, event.id),
    ).toEqual({ ok: true, reused: true });
    expect(
      validateRecurringExpenseOccurrenceRecordCommit(undefined, attempted, recorded, event, event.id).ok,
    ).toBe(false);
    const diverged = { ...attempted, dueOn: "2026-10-06" };
    expect(
      validateRecurringExpenseOccurrenceRecordCommit(attempted, diverged, recorded, undefined, event.id).ok,
    ).toBe(false);
    const alreadyLinked = {
      ...attempted,
      recordedFinancialEventId: "event-other",
    } as RecurringExpenseOccurrence;
    expect(
      validateRecurringExpenseOccurrenceRecordCommit(attempted, attempted, alreadyLinked, undefined, event.id)
        .ok,
    ).toBe(false);
    const unlinked = { ...recorded, recordedFinancialEventId: null } as RecurringExpenseOccurrence;
    expect(
      validateRecurringExpenseOccurrenceRecordCommit(attempted, attempted, unlinked, undefined, event.id).ok,
    ).toBe(false);
    expect(
      validateRecurringExpenseOccurrenceRecordCommit(attempted, attempted, recorded, undefined, event.id),
    ).toEqual({ ok: true });
  });
});
