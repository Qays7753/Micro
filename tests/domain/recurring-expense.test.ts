import { describe, expect, it } from "vitest";
import {
  activateRecurringExpenseSeries,
  archiveRecurringExpenseSeries,
  cancelRecurringExpenseSeries,
  createRecurringExpenseDraftSeries,
  createRecurringExpenseOccurrence,
  daysInRecurringPeriod,
  dueDateForPeriod,
  firstScheduledPeriod,
  isPeriodOnSchedule,
  isRevisionEffective,
  markRecurringExpenseConfirmAttempted,
  markRecurringExpenseRecorded,
  markRecurringExpenseRecordFailed,
  nextScheduledPeriod,
  pauseRecurringExpenseSeries,
  readRecurringExpenseOccurrence,
  recurringExpenseRevisionId,
  recurringPeriodAfter,
  recurringPeriodMonthsBetween,
  replanRecurringExpenseOccurrence,
  restoreRecurringExpenseSeries,
  resumeRecurringExpenseSeries,
  skipRecurringExpenseOccurrence,
  snoozeRecurringExpenseOccurrence,
  succeedRecurringExpenseRuleRevision,
  validateRecurringExpenseSuccession,
  verifyRecordedEventMatchesIntent,
  cancelRecurringExpenseOccurrence,
  type RecurringExpenseRuleDraft,
} from "../../src/domain/recurring-expense/index.js";

const AT = "2026-09-21T08:00:00.000Z";
const TODAY = "2026-09-21";

const ruleDraft: RecurringExpenseRuleDraft = {
  effectiveFromPeriod: "2026-01",
  frequency: "monthly",
  interval: 1,
  anchorDate: "2026-01-05",
  dueDay: 5,
  monthEndPolicy: "last_valid_day",
  timezone: "Asia/Amman",
  amountMode: "suggested",
  suggestedAmountMinor: 25_000,
  suggestedWalletId: "wallet-main",
  categoryLabel: "إيجار",
  changeReason: null,
};

const makeDraft = (overrides: Partial<RecurringExpenseRuleDraft> = {}) => ({
  id: "series-1",
  title: "إيجار المحل الشهري",
  createdAt: AT,
  rule: { ...ruleDraft, ...overrides },
});

const activeSeries = () => {
  const { series, revision } = createRecurringExpenseDraftSeries(makeDraft());
  return { series: activateRecurringExpenseSeries(series, AT), revision };
};

describe("OPS-003 — المصروف المتكرر: دورة حياة السلسلة (بلا أي كتابة مالية)", () => {
  it("المسودة تُنشأ مع مراجعتها الأولى ولا تُفعَّل بلا قاعدة", () => {
    const { series, revision } = createRecurringExpenseDraftSeries(makeDraft());
    expect(series.status).toBe("draft");
    expect(series.currentRevision).toBe(1);
    expect(revision.revision).toBe(1);
    expect(revision.id).toBe(recurringExpenseRevisionId("series-1", 1));
    expect(series.cancelledAt).toBeNull();
  });
  it("التفعيل يفترض مراجعة قائمة؛ والمسودة الفارغة (بلا قاعدة) تُرفض عند التفعيل", () => {
    const { series } = createRecurringExpenseDraftSeries(makeDraft());
    expect(activateRecurringExpenseSeries(series, AT).status).toBe("active");
    const bare = {
      id: "series-bare",
      title: "بلا قاعدة",
      status: "draft" as const,
      createdAt: AT,
      updatedAt: AT,
      currentRevision: 0,
      cancelledAt: null,
      cancelReason: null,
      archivedAt: null,
      resumedFromPeriod: null,
    };
    expect(() => activateRecurringExpenseSeries(bare, AT)).toThrow("بلا قاعدة");
  });
  it("إيقاف/استئناف/أرشفة/استعادة تعمل بالانتقالات القانونية فقط", () => {
    const { series } = activeSeries();
    const paused = pauseRecurringExpenseSeries(series, AT);
    expect(paused.status).toBe("paused");
    expect(resumeRecurringExpenseSeries(paused, AT).status).toBe("active");
    const archived = archiveRecurringExpenseSeries(series, AT);
    expect(archived.status).toBe("archived");
    expect(archived.archivedAt).toBe(AT);
    expect(restoreRecurringExpenseSeries(archived, "paused", AT).status).toBe("paused");
    expect(() => pauseRecurringExpenseSeries(paused, AT)).toThrow("غير قانوني");
    expect(() => activateRecurringExpenseSeries(series, AT)).toThrow("غير قانوني");
  });
  it("الاستئناف نشاط مستقبلي فقط: يُثبت حد التوليد على الفترة الحالية لا بأثر رجعي", () => {
    const { series } = activeSeries();
    const paused = pauseRecurringExpenseSeries(series, AT);
    /* بلا فترة معلومة: سلوك تاريخي بلا حد (توافق الاختبارات القائمة). */
    expect(resumeRecurringExpenseSeries(paused, AT).resumedFromPeriod).toBeNull();
    const resumed = resumeRecurringExpenseSeries(paused, AT, "2026-09");
    expect(resumed.status).toBe("active");
    expect(resumed.resumedFromPeriod).toBe("2026-09");
    /* فترة غير صالحة رفض صادر — لا حد مكتوم بلا تحقق. */
    expect(() => resumeRecurringExpenseSeries(paused, AT, "2026-13")).toThrow("غير صالحة");
    const archived = archiveRecurringExpenseSeries(series, AT);
    expect(restoreRecurringExpenseSeries(archived, "paused", AT).resumedFromPeriod).toBeNull();
    const restored = restoreRecurringExpenseSeries(archived, "active", AT, "2026-10");
    expect(restored.status).toBe("active");
    expect(restored.archivedAt).toBeNull();
    expect(restored.resumedFromPeriod).toBe("2026-10");
  });
});

describe("OPS-003 — إلغاء السلسلة موثقًا (بلا أي كتابة مالية)", () => {
  it("الإلغاء يوثق سببًا إلزاميًا ولا يمس التاريخ المالي (حقلان فقط على السلسلة)", () => {
    const { series } = activeSeries();
    expect(() => cancelRecurringExpenseSeries(series, "   ", AT)).toThrow("سببًا");
    const cancelled = cancelRecurringExpenseSeries(series, "أغلقت المحل", AT);
    expect(cancelled.status).toBe("cancelled");
    expect(cancelled.cancelReason).toBe("أغلقت المحل");
    expect(cancelled.cancelledAt).toBe(AT);
  });
});

describe("OPS-003 — المراجعات: الخلف والنفااذ المشتق", () => {
  it("المراجعة الخلف برقم أعلى وسلسلة محدّثة؛ والنفااذ مشتق معجميًا لا حقل مخزّن", () => {
    const { series, revision } = activeSeries();
    const { series: nextSeries, successor } = succeedRecurringExpenseRuleRevision(
      series,
      revision,
      { ...ruleDraft, effectiveFromPeriod: "2026-04", dueDay: 10, changeReason: "ارتفاع الإيجار" },
      AT,
    );
    expect(successor.revision).toBe(2);
    expect(nextSeries.currentRevision).toBe(2);
    expect(isRevisionEffective(revision, "2026-03")).toBe(true);
    expect(isRevisionEffective(successor, "2026-03")).toBe(false);
    expect(isRevisionEffective(successor, "2026-04")).toBe(true);
  });
});

describe("OPS-003 — المراجعات: إعادة التفعيل والتعاقب", () => {
  it("إعادة تفعيل سلسلة ملغاة تتطلب مراجعة تبدأ من فترة لاحقة صراحةً", () => {
    const { series, revision } = activeSeries();
    const cancelled = cancelRecurringExpenseSeries(series, "توقف مؤقت", AT);
    expect(() =>
      succeedRecurringExpenseRuleRevision(
        cancelled,
        revision,
        { ...ruleDraft, effectiveFromPeriod: "2026-01" },
        AT,
      ),
    ).toThrow("لاحقة صراحةً");
    const { series: reactivated } = succeedRecurringExpenseRuleRevision(
      cancelled,
      revision,
      { ...ruleDraft, effectiveFromPeriod: "2027-01" },
      AT,
    );
    expect(reactivated.status).toBe("active");
    expect(reactivated.cancelledAt).toBeNull();
    expect(reactivated.cancelReason).toBeNull();
  });
  it("السلسلة المؤرشفة لا تُعدل؛ والتعاقب يرفض أرقامًا غير متتالية أو فترة سابقة", () => {
    const { series, revision } = activeSeries();
    const archived = archiveRecurringExpenseSeries(series, AT);
    expect(() =>
      succeedRecurringExpenseRuleRevision(
        archived,
        revision,
        { ...ruleDraft, effectiveFromPeriod: "2027-01" },
        AT,
      ),
    ).toThrow("المؤرشفة");
    const { successor } = succeedRecurringExpenseRuleRevision(
      series,
      revision,
      { ...ruleDraft, effectiveFromPeriod: "2026-06" },
      AT,
    );
    expect(() => validateRecurringExpenseSuccession(revision, { ...successor, revision: 4 }, false)).toThrow(
      "زائد واحد",
    );
  });
});

describe("OPS-003 — المراجعات: حماية فترات التاريخ", () => {
  it("الفترة المقررة سابقًا تحتفظ بمراجعتها؛ والمخططة بلا قرار تُشتق من جديد", () => {
    const { revision } = activeSeries();
    const planned = createRecurringExpenseOccurrence({
      seriesId: "series-1",
      revision: 1,
      periodKey: "2026-10",
      dueOn: "2026-10-05",
      createdAt: AT,
    });
    const replanned = replanRecurringExpenseOccurrence(planned, 2, "2026-10-10", AT);
    expect(replanned.revision).toBe(2);
    expect(replanned.dueOn).toBe("2026-10-10");
    expect(replanned.actionHistory.at(-1)?.kind).toBe("revised");
    const snoozed = snoozeRecurringExpenseOccurrence(planned, "2026-10-01", TODAY, AT);
    expect(() => replanRecurringExpenseOccurrence(snoozed, 2, "2026-10-10", AT)).toThrow("عليها قرار");
    expect(() => replanRecurringExpenseOccurrence(replanned, 3, "2026-10-12", AT)).not.toThrow();
  });
});

describe("OPS-003 — التقويم: مفاتيح الفترات وأيام الشهر", () => {
  it("حساب الفترات صحيح على المفاتيح المتعارف عليها (فرق، تقدم، أيام الشهر مع الكبيسة)", () => {
    expect(recurringPeriodMonthsBetween("2026-01", "2026-01")).toBe(0);
    expect(recurringPeriodMonthsBetween("2025-11", "2026-02")).toBe(3);
    expect(recurringPeriodMonthsBetween("2026-05", "2026-02")).toBe(-3);
    expect(recurringPeriodAfter("2026-12", 1)).toBe("2027-01");
    expect(recurringPeriodAfter("2026-01", -1)).toBe("2025-12");
    expect(daysInRecurringPeriod("2026-02")).toBe(28);
    expect(daysInRecurringPeriod("2024-02")).toBe(29);
    expect(daysInRecurringPeriod("2100-02")).toBe(28);
    expect(daysInRecurringPeriod("2026-04")).toBe(30);
    expect(daysInRecurringPeriod("2026-07")).toBe(31);
  });
  it("يوم ٣١ في شباط: القص الأخير / التخطي / السؤال — بالسياسات الثلاث المعلنة", () => {
    const { revision } = createRecurringExpenseDraftSeries(
      makeDraft({ dueDay: 31, anchorDate: "2026-01-31", effectiveFromPeriod: "2026-01" }),
    );
    expect(dueDateForPeriod(revision, "2026-02")).toEqual({ kind: "due", dueOn: "2026-02-28" });
    const skipping = createRecurringExpenseDraftSeries(
      makeDraft({
        dueDay: 31,
        monthEndPolicy: "skip",
        anchorDate: "2026-01-31",
        effectiveFromPeriod: "2026-01",
      }),
    ).revision;
    expect(dueDateForPeriod(skipping, "2026-02")).toEqual({ kind: "skip" });
    const asking = createRecurringExpenseDraftSeries(
      makeDraft({
        dueDay: 31,
        monthEndPolicy: "ask",
        anchorDate: "2026-01-31",
        effectiveFromPeriod: "2026-01",
      }),
    ).revision;
    expect(dueDateForPeriod(asking, "2026-02")).toEqual({ kind: "ask", lastValidDay: 28 });
    expect(dueDateForPeriod(asking, "2024-02")).toEqual({ kind: "ask", lastValidDay: 29 });
    expect(dueDateForPeriod(asking, "2026-03")).toEqual({ kind: "due", dueOn: "2026-03-31" });
  });
});

describe("OPS-003 — التقويم: الجدولة والفاصل والتقويم الأول", () => {
  it("الجدولة: الفاصل والتقويم وأول فترة مجدولة بقاعدة اليوم-التقويم", () => {
    const monthly = createRecurringExpenseDraftSeries(
      makeDraft({ anchorDate: "2026-01-05", dueDay: 5 }),
    ).revision;
    expect(firstScheduledPeriod(monthly)).toBe("2026-01");
    expect(isPeriodOnSchedule(monthly, "2026-09")).toBe(true);
    expect(nextScheduledPeriod(monthly, "2026-09")).toBe("2026-10");
    const startedLate = createRecurringExpenseDraftSeries(
      makeDraft({ anchorDate: "2026-01-20", dueDay: 5 }),
    ).revision;
    expect(firstScheduledPeriod(startedLate)).toBe("2026-02");
    const quarterly = createRecurringExpenseDraftSeries(
      makeDraft({ anchorDate: "2026-01-10", interval: 3 }),
    ).revision;
    expect(isPeriodOnSchedule(quarterly, "2026-04")).toBe(true);
    expect(isPeriodOnSchedule(quarterly, "2026-02")).toBe(false);
    expect(isPeriodOnSchedule(quarterly, "2025-12")).toBe(false);
    const skippingAnchor = createRecurringExpenseDraftSeries(
      makeDraft({ anchorDate: "2026-02-10", dueDay: 31, monthEndPolicy: "skip" }),
    ).revision;
    expect(firstScheduledPeriod(skippingAnchor)).toBe("2026-03");
  });
  it("المنطقة الزمنية غير عمّان مرفوضة؛ والتكرار غير الشهري غير مدعوم بعد", () => {
    expect(() => createRecurringExpenseDraftSeries(makeDraft({ timezone: "Europe/Berlin" }))).toThrow(
      "Asia/Amman",
    );
    expect(() => createRecurringExpenseDraftSeries(makeDraft({ frequency: "weekly" as "monthly" }))).toThrow(
      "الشهري وحده",
    );
  });
});

const plannedOccurrence = () =>
  createRecurringExpenseOccurrence({
    seriesId: "series-1",
    revision: 1,
    periodKey: "2026-10",
    dueOn: "2026-10-05",
    createdAt: AT,
  });

describe("OPS-003 — الفترة: الهوية والتأجيل والتخطي", () => {
  it("المفتاح الحتمي مركّب: السلسلة:الفترة:الخانة — والاستحقاق داخل فترته فقط", () => {
    const occurrence = plannedOccurrence();
    expect(occurrence.id).toBe("series-1:2026-10:0");
    expect(occurrence.recordingIdempotencyKey).toBe("series-1:2026-10:0");
    expect(() =>
      createRecurringExpenseOccurrence({
        seriesId: "series-1",
        revision: 1,
        periodKey: "2026-10",
        dueOn: "2026-11-05",
        createdAt: AT,
      }),
    ).toThrow("خارج الفترة المفتاحية");
  });
  it("التأجيل يغير توقيت الانتباه فقط: dueOn والمفتاح لا يتغيران", () => {
    const occurrence = plannedOccurrence();
    const snoozed = snoozeRecurringExpenseOccurrence(occurrence, "2026-10-02", TODAY, AT);
    expect(snoozed.status).toBe("snoozed");
    expect(snoozed.snoozedUntil).toBe("2026-10-02");
    expect(snoozed.dueOn).toBe("2026-10-05");
    expect(snoozed.recordingIdempotencyKey).toBe(occurrence.recordingIdempotencyKey);
    expect(() => snoozeRecurringExpenseOccurrence(occurrence, "2026-09-20", TODAY, AT)).toThrow("لاحقًا");
    expect(() => snoozeRecurringExpenseOccurrence(occurrence, TODAY, TODAY, AT)).toThrow("لاحقًا");
    const extended = snoozeRecurringExpenseOccurrence(snoozed, "2026-10-04", TODAY, AT);
    expect(extended.snoozedUntil).toBe("2026-10-04");
  });
  it("التخطي قرار محفوظ بسبب اختياري — لا يكتب صفرًا ولا أي أثر مالي", () => {
    const occurrence = plannedOccurrence();
    const skipped = skipRecurringExpenseOccurrence(occurrence, "دفعته نقدًا خارج النظام", AT);
    expect(skipped.status).toBe("skipped");
    expect(skipped.skipReason).toBe("دفعته نقدًا خارج النظام");
    expect(skipped.reviewedAmountMinor).toBeNull();
    expect(skipped.recordedFinancialEventId).toBeNull();
    const noReason = skipRecurringExpenseOccurrence(occurrence, null, AT);
    expect(noReason.skipReason).toBeNull();
    expect(() => snoozeRecurringExpenseOccurrence(skipped, "2026-10-02", TODAY, AT)).toThrow("غير قانوني");
  });
});

describe("OPS-003 — الفترة: الانتقالات القانونية ورفض الجزئي", () => {
  it("الانتقالات غير القانونية تُرفض بلا كتابة جزئية (الكائن الأصلي سليم)", () => {
    const occurrence = plannedOccurrence();
    expect(() =>
      markRecurringExpenseRecorded(occurrence, {
        eventId: "event-1",
        amountMinor: 25_000,
        walletId: null,
        occurredOn: "2026-10-05",
        reused: false,
        at: AT,
      }),
    ).toThrow("غير قانوني");
    expect(occurrence.status).toBe("planned");
    const attempted = markRecurringExpenseConfirmAttempted(occurrence, AT);
    expect(attempted.status).toBe("recording");
    const recorded = markRecurringExpenseRecorded(attempted, {
      eventId: "event-1",
      amountMinor: 25_000,
      walletId: "wallet-main",
      occurredOn: "2026-10-05",
      reused: false,
      at: AT,
    });
    expect(() =>
      markRecurringExpenseRecorded(recorded, {
        eventId: "event-2",
        amountMinor: 25_000,
        walletId: null,
        occurredOn: "2026-10-05",
        reused: false,
        at: AT,
      }),
    ).toThrow("غير قانوني");
    expect(() => snoozeRecurringExpenseOccurrence(recorded, "2026-10-06", TODAY, AT)).toThrow("غير قانوني");
  });
  it("من نتيجة غير معروفة: إنهاء القرار صراحةً (تخطٍ/إلغاء) قانوني بعد محاولة قائمة", () => {
    const occurrence = plannedOccurrence();
    const attempted = markRecurringExpenseConfirmAttempted(occurrence, AT);
    expect(skipRecurringExpenseOccurrence(attempted, "قررت عدم تسجيله", AT).status).toBe("skipped");
    expect(cancelRecurringExpenseOccurrence(attempted, AT).status).toBe("cancelled");
  });
  it("مسار الفشل: نتيجة معروفة تُحفظ مع رسالتها، وإعادة المحاولة أو التخطي قانونيان", () => {
    const occurrence = plannedOccurrence();
    const attempted = markRecurringExpenseConfirmAttempted(occurrence, AT);
    const failed = markRecurringExpenseRecordFailed(attempted, "تعذر التحقق من سجل الأحداث المالية.", AT);
    expect(failed.status).toBe("record_failed");
    expect(failed.actionHistory.at(-1)?.message).toBe("تعذر التحقق من سجل الأحداث المالية.");
    expect(markRecurringExpenseConfirmAttempted(failed, AT).status).toBe("recording");
    expect(skipRecurringExpenseOccurrence(failed, null, AT).status).toBe("skipped");
    expect(cancelRecurringExpenseOccurrence(failed, AT).status).toBe("cancelled");
  });
});

describe("OPS-003 — الفترة: التسجيل بعد مراجعة صريحة", () => {
  it("التسجيل يحفظ المراجَع كاملة: المبلغ والمحفظة وoccurredOn المستقل عن dueOn", () => {
    const occurrence = plannedOccurrence();
    const attempted = markRecurringExpenseConfirmAttempted(occurrence, AT);
    const recorded = markRecurringExpenseRecorded(attempted, {
      eventId: "financial-event-9",
      amountMinor: 27_500,
      walletId: "wallet-2",
      occurredOn: "2026-10-03",
      reused: false,
      at: AT,
    });
    expect(recorded.status).toBe("recorded");
    expect(recorded.recordedFinancialEventId).toBe("financial-event-9");
    expect(recorded.reviewedAmountMinor).toBe(27_500);
    expect(recorded.reviewedWalletId).toBe("wallet-2");
    expect(recorded.reviewedOccurredOn).toBe("2026-10-03");
    expect(recorded.dueOn).toBe("2026-10-05");
    expect(recorded.actionHistory.at(-1)?.kind).toBe("recorded");
    const reusedAttempt = markRecurringExpenseConfirmAttempted(plannedOccurrence(), AT);
    const reused = markRecurringExpenseRecorded(reusedAttempt, {
      eventId: "financial-event-9",
      amountMinor: 27_500,
      walletId: null,
      occurredOn: "2026-10-03",
      reused: true,
      at: AT,
    });
    expect(reused.actionHistory.at(-1)?.kind).toBe("record_reused");
    expect(() =>
      markRecurringExpenseRecorded(attempted, {
        eventId: "event-x",
        amountMinor: 0,
        walletId: null,
        occurredOn: "2026-10-03",
        reused: false,
        at: AT,
      }),
    ).toThrow("موجبًا");
  });
});

describe("OPS-003 — نموذج القراءة: الانتباه والمجهول والمعكوس مشتقة لا مخزّنة", () => {
  const occurrenceFor = (overrides: Partial<Parameters<typeof createRecurringExpenseOccurrence>[0]>) =>
    createRecurringExpenseOccurrence({
      seriesId: "series-1",
      revision: 1,
      periodKey: "2026-09",
      dueOn: "2026-09-05",
      createdAt: AT,
      ...overrides,
    });
  it("الانتباه مشتق من dueOn (أو التأجيل) مقابل اليوم: قادم/اليوم/متأخر — متأخر ليس دينًا", () => {
    const upcoming = occurrenceFor({ periodKey: "2026-10", dueOn: "2026-10-05" });
    expect(readRecurringExpenseOccurrence(upcoming, { today: TODAY }).attention).toBe("upcoming");
    const dueToday = occurrenceFor({ dueOn: TODAY });
    expect(readRecurringExpenseOccurrence(dueToday, { today: TODAY }).attention).toBe("due_today");
    const overdue = occurrenceFor({ dueOn: "2026-09-05" });
    const reading = readRecurringExpenseOccurrence(overdue, { today: TODAY });
    expect(reading.attention).toBe("overdue");
    expect(reading.displayState).toBe("planned");
    expect(reading.reversed).toBe(false);
    const snoozed = snoozeRecurringExpenseOccurrence(overdue, "2026-09-25", TODAY, AT);
    expect(readRecurringExpenseOccurrence(snoozed, { today: TODAY }).displayState).toBe("snoozed");
    expect(readRecurringExpenseOccurrence(snoozed, { today: "2026-09-25" }).attention).toBe("due_today");
  });
  it("recording قائمة في الجلسة = جارٍ؛ وrecording بلا محاولة قائمة = نتيجة غير معروفة", () => {
    const attempted = markRecurringExpenseConfirmAttempted(occurrenceFor({}), AT);
    const inFlight = new Set([attempted.recordingIdempotencyKey]);
    expect(
      readRecurringExpenseOccurrence(attempted, { today: TODAY, inFlightKeys: inFlight }).displayState,
    ).toBe("recording");
    expect(readRecurringExpenseOccurrence(attempted, { today: TODAY }).displayState).toBe("result_unknown");
    expect(readRecurringExpenseOccurrence(attempted, { today: TODAY }).resultUnknown).toBe(true);
  });
  it("المعكوس مشتق من سجل الأحداث: الفترة تبقى مقَرَّرة (معولجة) ولا تُفتح تلقائيًا", () => {
    const attempted = markRecurringExpenseConfirmAttempted(occurrenceFor({}), AT);
    const recorded = markRecurringExpenseRecorded(attempted, {
      eventId: "event-7",
      amountMinor: 25_000,
      walletId: null,
      occurredOn: "2026-09-05",
      reused: false,
      at: AT,
    });
    const reversedIds = new Set(["event-7"]);
    const reading = readRecurringExpenseOccurrence(recorded, { today: TODAY, reversedEventIds: reversedIds });
    expect(reading.reversed).toBe(true);
    expect(reading.displayState).toBe("reversed");
    expect(reading.occurrence.status).toBe("recorded");
    expect(readRecurringExpenseOccurrence(recorded, { today: TODAY }).displayState).toBe("recorded");
  });
});

describe("OPS-003 — المبلغ المقترح وحارس اصطدام مفتاح التأكيد", () => {
  it("manual بلا اقتراح؛ suggested اختياري؛ fixed_suggested إلزامي المبلغ — ولا افتراضات", () => {
    expect(() =>
      createRecurringExpenseDraftSeries(
        makeDraft({ amountMode: "manual", suggestedAmountMinor: null, suggestedWalletId: null }),
      ),
    ).not.toThrow();
    expect(() =>
      createRecurringExpenseDraftSeries(makeDraft({ amountMode: "manual", suggestedAmountMinor: 100 })),
    ).toThrow("لا يحمل مبلغًا");
    expect(() =>
      createRecurringExpenseDraftSeries(
        makeDraft({ amountMode: "manual", suggestedAmountMinor: null, suggestedWalletId: "w" }),
      ),
    ).toThrow("لا يحمل محفظة");
    expect(() =>
      createRecurringExpenseDraftSeries(
        makeDraft({ amountMode: "fixed_suggested", suggestedAmountMinor: null }),
      ),
    ).toThrow("يتطلب مبلغًا");
    expect(() =>
      createRecurringExpenseDraftSeries(makeDraft({ amountMode: "suggested", suggestedAmountMinor: 0 })),
    ).toThrow("موجبًا");
    expect(() => createRecurringExpenseDraftSeries(makeDraft({ categoryLabel: "x".repeat(81) }))).toThrow(
      "٨٠ حرفًا",
    );
    expect(() => createRecurringExpenseDraftSeries({ ...makeDraft(), title: "   " })).toThrow(
      "عنوان التذكير",
    );
  });
  it("الحدث المعاد يجب أن يطابق النية نوعًا ومبلغًا ومفتاحًا قبل وسم الفترة مقَرَّرة", () => {
    const intent = {
      type: "operating_expense_cash" as const,
      amountMinor: 25_000,
      idempotencyKey: "series-1:2026-10:0",
    };
    expect(verifyRecordedEventMatchesIntent(intent, intent)).toBe(true);
    expect(verifyRecordedEventMatchesIntent({ ...intent, type: "operating_expense_payable" }, intent)).toBe(
      false,
    );
    expect(verifyRecordedEventMatchesIntent({ ...intent, amountMinor: 30_000 }, intent)).toBe(false);
    expect(verifyRecordedEventMatchesIntent({ ...intent, idempotencyKey: "other-key" }, intent)).toBe(false);
  });
});
