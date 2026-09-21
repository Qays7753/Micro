/**
 * OPS-003 (عقد ٤١ §٨/§٩): اختبارات خدمة المصروف المتكرر — مسار التطبيق فوق
 * المخازن المحروسة. تحرس هذه الاختبارات وعود التحكم الصريح للمستخدم:
 * لا تسجيل تلقائي عند الاستحقاق، ولا دينًا من التأخر، ولا صفرًا من التخطي،
 * ولا حدثًا ثانيًا من التأكيد المزدوج، ولا نجاحًا مدّعًى من نتيجة مجهولة،
 * والتراجع يحفظ الأصل ولا يفتح الفترة.
 */
import { describe, expect, it } from "vitest";
import { createFinancialEvent, reversedEventIds } from "@micro-domain/financial-event/index.js";
import {
  markRecurringExpenseConfirmAttempted,
  type RecurringExpenseRuleDraft,
} from "@micro-domain/recurring-expense/index.js";
import { MemoryLocalStore } from "@/storage/local/MemoryLocalStore";
import { RecurringExpenseService, type RecurringExpenseReview } from "./recurringExpenseService";
import { ProjectFinancialService } from "./projectFinancialService";

const SEPTEMBER = "2026-09-21T08:00:00.000Z"; /* عمّان +03: اليوم 2026-09-21 */
const DECEMBER = "2026-12-15T08:00:00.000Z"; /* عمّان +03: اليوم 2026-12-15 */

const baseRule = (overrides: Partial<RecurringExpenseRuleDraft> = {}): RecurringExpenseRuleDraft => ({
  effectiveFromPeriod: "2026-09",
  frequency: "monthly",
  interval: 1,
  anchorDate: "2026-09-01",
  dueDay: 5,
  monthEndPolicy: "last_valid_day",
  timezone: "Asia/Amman",
  amountMode: "suggested",
  suggestedAmountMinor: 25_000,
  suggestedWalletId: null,
  categoryLabel: "إيجار",
  changeReason: null,
  ...overrides,
});

const review = (overrides: Partial<RecurringExpenseReview> = {}): RecurringExpenseReview => ({
  type: "operating_expense_cash",
  amountMinor: 25_000,
  occurredOn: "2026-09-21",
  note: "إيجار سبتمبر",
  counterparty: "صاحب العقار",
  expenseContext: { relationship: "project", behavior: "fixed", purpose: "period", knowledge: "known" },
  ...overrides,
});

async function activatedSeries(
  service: RecurringExpenseService,
  rule: RecurringExpenseRuleDraft = baseRule(),
  title = "إيجار المحل الشهري",
) {
  const created = await service.createDraft({ title, rule });
  if (!created.ok) throw new Error(created.message);
  const activated = await service.activate(created.value.series.id);
  if (!activated.ok) throw new Error(activated.message);
  return created.value.series.id;
}

async function occurrenceByPeriod(service: RecurringExpenseService, seriesId: string, periodKey: string) {
  const detail = await service.readDetail(seriesId);
  if (!detail.ok) throw new Error(detail.message);
  const reading = detail.value.occurrences.find(candidate => candidate.occurrence.periodKey === periodKey);
  if (!reading) throw new Error(`لا فترة ${periodKey}`);
  return reading;
}

async function eventsOf(store: MemoryLocalStore) {
  const events = await store.listFinancialEvents();
  if (!events.ok) throw new Error(events.message);
  return events.value;
}

describe("RecurringExpenseService OPS-003 (عقد ٤١)", () => {
  it("دورة السلسلة كاملة عبر الخدمة بلا أي كتابة مالية، والإلغاء يتطلب سببًا", async () => {
    const store = new MemoryLocalStore();
    const service = new RecurringExpenseService(store, () => SEPTEMBER);
    const seriesId = await activatedSeries(service);

    const paused = await service.pause(seriesId);
    expect(paused.ok && paused.value.status).toBe("paused");
    const resumed = await service.resume(seriesId);
    expect(resumed.ok && resumed.value.status).toBe("active");
    expect(resumed.ok && resumed.value.resumedFromPeriod).toBe("2026-09");
    const archived = await service.archive(seriesId);
    expect(archived.ok && archived.value.status).toBe("archived");
    expect(archived.ok && archived.value.archivedAt).toBeTruthy();
    const restored = await service.restore(seriesId);
    expect(restored.ok && restored.value.status).toBe("active");
    expect(restored.ok && restored.value.archivedAt).toBeNull();

    const noReason = await service.cancel(seriesId, "   ");
    expect(noReason.ok).toBe(false);
    const cancelled = await service.cancel(seriesId, "أغلقت المحل");
    expect(cancelled.ok && cancelled.value.status).toBe("cancelled");
    expect(cancelled.ok && cancelled.value.cancelReason).toBe("أغلقت المحل");

    expect(await eventsOf(store)).toEqual([]);
  });

  it("التوليد الأمامي حتمي بالإضافة فقط: الفترة الحالية + التالية، والقراءة المتكررة لا تكرر", async () => {
    const store = new MemoryLocalStore();
    const service = new RecurringExpenseService(store, () => SEPTEMBER);
    const seriesId = await activatedSeries(service);

    const first = await service.readDetail(seriesId);
    expect(first.ok && first.value.occurrences.map(r => r.occurrence.periodKey)).toEqual([
      "2026-09",
      "2026-10",
    ]);
    const second = await service.readDetail(seriesId);
    expect(second.ok && second.value.occurrences.length).toBe(2);
    expect(second.ok && second.value.occurrences.map(r => r.occurrence.id)).toEqual(
      first.ok ? first.value.occurrences.map(r => r.occurrence.id) : [],
    );
  });

  it("المسودة لا تولّد فترات، والموقوفة/المؤرشفة لا تولّد جديدًا، والاستئناف نشاط مستقبلي فقط بلا استكمال بأثر رجعي", async () => {
    const store = new MemoryLocalStore();
    let clock = SEPTEMBER;
    const service = new RecurringExpenseService(store, () => clock);

    /* المسودة: بلا فترات. */
    const draft = await service.createDraft({ title: "مسودة", rule: baseRule() });
    expect(draft.ok).toBe(true);
    const draftDetail = await service.readDetail(draft.ok ? draft.value.series.id : "");
    expect(draftDetail.ok && draftDetail.value.occurrences).toEqual([]);

    const seriesId = await activatedSeries(service);
    let detail = await service.readDetail(seriesId);
    expect(detail.ok && detail.value.occurrences.map(r => r.occurrence.periodKey)).toEqual([
      "2026-09",
      "2026-10",
    ]);

    /* إيقاف ثم مرور الوقت: لا توليد جديد أثناء التوقيف. */
    expect((await service.pause(seriesId)).ok).toBe(true);
    clock = DECEMBER;
    detail = await service.readDetail(seriesId);
    expect(detail.ok && detail.value.occurrences.map(r => r.occurrence.periodKey)).toEqual([
      "2026-09",
      "2026-10",
    ]);

    /* الاستئناف: الحد على الفترة الحالية (2026-12) — لا تُستكمل فترات التوقيف
     * (2026-11 لا تُخلق أبدًا)، والتوليد من الحد إلى الأفق فقط. */
    const resumed = await service.resume(seriesId);
    expect(resumed.ok && resumed.value.resumedFromPeriod).toBe("2026-12");
    detail = await service.readDetail(seriesId);
    expect(detail.ok && detail.value.occurrences.map(r => r.occurrence.periodKey)).toEqual([
      "2026-09",
      "2026-10",
      "2026-12",
      "2027-01",
    ]);
  });

  it("التأكيد الصريح يسجل حدثًا واحدًا بالكاتب الكنوني، والتواريخ الثلاثة متمايزة", async () => {
    const store = new MemoryLocalStore();
    const service = new RecurringExpenseService(store, () => SEPTEMBER);
    const seriesId = await activatedSeries(service);
    const occurrence = await occurrenceByPeriod(service, seriesId, "2026-09");

    const confirmed = await service.confirm(occurrence.occurrence.id, review({ occurredOn: "2026-09-04" }));
    expect(confirmed.ok).toBe(true);
    if (!confirmed.ok) return;

    expect(confirmed.value.status).toBe("recorded");
    expect(confirmed.value.event.type).toBe("operating_expense_cash");
    expect(confirmed.value.event.amountMinor).toBe(25_000);
    expect(confirmed.value.event.idempotencyKey).toBe(occurrence.occurrence.recordingIdempotencyKey);

    /* dueOn المجدول (2026-09-05) ≠ occurredOn المعلن (2026-09-04) ≠ وقت التأكيد. */
    expect(occurrence.occurrence.dueOn).toBe("2026-09-05");
    expect(confirmed.value.event.occurredOn).toBe("2026-09-04");
    expect(confirmed.value.event.recordedAt).toBe(SEPTEMBER);
    expect(confirmed.value.occurrence.status).toBe("recorded");
    expect(confirmed.value.occurrence.recordedFinancialEventId).toBe(confirmed.value.event.id);

    const events = await eventsOf(store);
    expect(events.length).toBe(1);
  });

  it("التأكيد المتتابع الثاني = إعادة استخدام صادقة: لا حدث ثانٍ ولا كتابة", async () => {
    const store = new MemoryLocalStore();
    const service = new RecurringExpenseService(store, () => SEPTEMBER);
    const seriesId = await activatedSeries(service);
    const occurrence = await occurrenceByPeriod(service, seriesId, "2026-09");

    const first = await service.confirm(occurrence.occurrence.id, review());
    expect(first.ok && first.value.status).toBe("recorded");
    const second = await service.confirm(occurrence.occurrence.id, review());
    expect(second.ok && second.value.status).toBe("reused");
    expect(second.ok && second.value.event.id).toBe(first.ok ? first.value.event.id : "");

    const events = await eventsOf(store);
    expect(events.length).toBe(1);
  });

  it("التأكيد المتزامن (Promise.all) = حدث واحد لا أكثر، وكل نجاح صادق", async () => {
    const store = new MemoryLocalStore();
    const service = new RecurringExpenseService(store, () => SEPTEMBER);
    const seriesId = await activatedSeries(service);
    const occurrence = await occurrenceByPeriod(service, seriesId, "2026-09");

    const results = await Promise.all([
      service.confirm(occurrence.occurrence.id, review()),
      service.confirm(occurrence.occurrence.id, review()),
    ]);
    /* العبرة بالثابت المالي: نجاح واحد على الأقل، وكل نتيجة ناجحة صادقة
     * (recorded أو reused لا ثالث)، وحدث واحد بالمفتاح لا أكثر. */
    const successes = results.flatMap(result => (result.ok ? [result.value.status] : []));
    expect(successes.length).toBeGreaterThanOrEqual(1);
    expect(successes.every(status => status === "recorded" || status === "reused")).toBe(true);
    expect(successes.filter(status => status === "recorded").length).toBeLessThanOrEqual(1);
    const events = await eventsOf(store);
    expect(
      events.filter(event => event.idempotencyKey === occurrence.occurrence.recordingIdempotencyKey).length,
    ).toBe(1);
  });

  it("التخطي قرار محفوظ: لا يكتب صفرًا ولا حدثًا ولا أي أثر مالي", async () => {
    const store = new MemoryLocalStore();
    const service = new RecurringExpenseService(store, () => SEPTEMBER);
    const seriesId = await activatedSeries(service);
    const occurrence = await occurrenceByPeriod(service, seriesId, "2026-09");

    const before = await eventsOf(store);
    const skipped = await service.skipOccurrence(occurrence.occurrence.id, "دفعته نقدًا خارج التطبيق");
    expect(skipped.ok && skipped.value.status).toBe("skipped");
    expect(skipped.ok && skipped.value.skipReason).toBe("دفعته نقدًا خارج التطبيق");
    expect(await eventsOf(store)).toEqual(before);
    expect(skipped.ok && skipped.value.recordedFinancialEventId).toBeNull();
  });

  it("التأجيل انتباه فقط: dueOn لا يتغير والانتباه يصير قادمًا، والماضي مرفوض", async () => {
    const store = new MemoryLocalStore();
    const service = new RecurringExpenseService(store, () => SEPTEMBER);
    const seriesId = await activatedSeries(service);
    const overdue = await occurrenceByPeriod(service, seriesId, "2026-09");
    expect(overdue.attention).toBe("overdue");

    const snoozed = await service.snooze(overdue.occurrence.id, "2026-09-28");
    expect(snoozed.ok && snoozed.value.status).toBe("snoozed");
    expect(snoozed.ok && snoozed.value.dueOn).toBe("2026-09-05");
    expect(snoozed.ok && snoozed.value.snoozedUntil).toBe("2026-09-28");

    const reading = await occurrenceByPeriod(service, seriesId, "2026-09");
    expect(reading.attention).toBe("upcoming");

    const past = await service.snooze(overdue.occurrence.id, "2026-01-01");
    expect(past.ok).toBe(false);
  });

  it("متأخر = انتباه لا دين: لا حدث ولا كتابة من مجرد التأخر", async () => {
    const store = new MemoryLocalStore();
    const service = new RecurringExpenseService(store, () => SEPTEMBER);
    const seriesId = await activatedSeries(service);
    const reading = await occurrenceByPeriod(service, seriesId, "2026-09");
    expect(reading.attention).toBe("overdue");
    expect(reading.displayState).toBe("planned");
    expect(await eventsOf(store)).toEqual([]);
  });

  it("غياب المبلغ رفض صادر بلا أي كتابة (amountMode لا يقترح حدثًا)", async () => {
    const store = new MemoryLocalStore();
    const service = new RecurringExpenseService(store, () => SEPTEMBER);
    const seriesId = await activatedSeries(
      service,
      baseRule({ amountMode: "manual", suggestedAmountMinor: null }),
    );
    const occurrence = await occurrenceByPeriod(service, seriesId, "2026-09");

    const missing = await service.confirm(occurrence.occurrence.id, review({ amountMinor: undefined }));
    expect(missing.ok).toBe(false);
    expect(!missing.ok && missing.code).toBe("validation_error");
    expect(await eventsOf(store)).toEqual([]);
  });

  it("نتيجة غير معروفة: الفحص بالقراءة لا التقديم الأعمى، وإعادة المحاولة تسجل مرة واحدة", async () => {
    const store = new MemoryLocalStore();
    const service = new RecurringExpenseService(store, () => SEPTEMBER);
    const seriesId = await activatedSeries(service);
    const occurrence = await occurrenceByPeriod(service, seriesId, "2026-09");

    /* محاكاة نتيجة غير معروفة: علامة المحاولة التزمت ثم ضاع ناتج الالتزام
     * (لا حدث موجود) — القراءة تُظهر «نتيجة غير معروفة» لا نجاحًا. */
    const attempted = markRecurringExpenseConfirmAttempted(occurrence.occurrence, SEPTEMBER);
    const marker = await store.commitRecurringExpenseOccurrenceDecision(occurrence.occurrence, attempted);
    expect(marker.ok).toBe(true);

    const unknown = await occurrenceByPeriod(service, seriesId, "2026-09");
    expect(unknown.displayState).toBe("result_unknown");
    expect(unknown.resultUnknown).toBe(true);

    /* الفحص الحتمي: لا حدث بالمفتاح => لم يُسجل (صدقًا). */
    const checked = await service.checkResult(occurrence.occurrence.id);
    expect(checked.ok && checked.value.recorded).toBe(false);
    expect(checked.ok && checked.value.event).toBeNull();

    /* إعادة المحاولة بعد المجهولة: تسجيل واحد فقط. */
    const retried = await service.confirm(occurrence.occurrence.id, review());
    expect(retried.ok && retried.value.status).toBe("recorded");
    const events = await eventsOf(store);
    expect(events.length).toBe(1);
  });

  it("الفحص يصالح حدثًا يتيمًا بمفتاح الفترة: ربط موثق لا إعادة تقديم", async () => {
    const store = new MemoryLocalStore();
    const service = new RecurringExpenseService(store, () => SEPTEMBER);
    const seriesId = await activatedSeries(service);
    const occurrence = await occurrenceByPeriod(service, seriesId, "2026-09");

    /* محاكاة التزام نجح وضاع ناتجه المرصود: الحدث موجود بالفعل بالفترة
     * نفسها والفترة ما زالت في recording. */
    const attempted = markRecurringExpenseConfirmAttempted(occurrence.occurrence, SEPTEMBER);
    const marker = await store.commitRecurringExpenseOccurrenceDecision(occurrence.occurrence, attempted);
    expect(marker.ok).toBe(true);
    const orphan = createFinancialEvent({
      id: "orphan-event-1",
      type: "operating_expense_cash",
      amountMinor: 25_000,
      occurredOn: "2026-09-04",
      recordedAt: SEPTEMBER,
      idempotencyKey: occurrence.occurrence.recordingIdempotencyKey,
      note: "إيجار سبتمبر",
      counterparty: "صاحب العقار",
      relatedEventId: null,
      expenseContext: { relationship: "project", behavior: "fixed", purpose: "period", knowledge: "known" },
    });
    const saved = await store.saveFinancialEvent(orphan);
    expect(saved.ok).toBe(true);

    const checked = await service.checkResult(occurrence.occurrence.id);
    expect(checked.ok && checked.value.recorded).toBe(true);
    expect(checked.ok && checked.value.event?.id).toBe("orphan-event-1");

    const reading = await occurrenceByPeriod(service, seriesId, "2026-09");
    expect(reading.occurrence.status).toBe("recorded");
    expect(reading.occurrence.recordedFinancialEventId).toBe("orphan-event-1");

    /* لا حدث ثانٍ من المصالحة. */
    const events = await eventsOf(store);
    expect(events.length).toBe(1);
  });

  it("إنهاء صريح من نتيجة غير معروفة (تخطٍ/إلغاء) قانوني وموثق", async () => {
    const store = new MemoryLocalStore();
    const service = new RecurringExpenseService(store, () => SEPTEMBER);
    const seriesId = await activatedSeries(service);
    const occurrence = await occurrenceByPeriod(service, seriesId, "2026-09");

    const attempted = markRecurringExpenseConfirmAttempted(occurrence.occurrence, SEPTEMBER);
    await store.commitRecurringExpenseOccurrenceDecision(occurrence.occurrence, attempted);

    const skipped = await service.skipOccurrence(occurrence.occurrence.id, "قررت عدم تسجيله");
    expect(skipped.ok && skipped.value.status).toBe("skipped");
    expect(await eventsOf(store)).toEqual([]);
  });

  it("المراجعة الخلف تحمي فترة مقَرَّرة سابقًا وتعيد اشتقاق planned المستقبلية فقط", async () => {
    const store = new MemoryLocalStore();
    const service = new RecurringExpenseService(store, () => SEPTEMBER);
    const seriesId = await activatedSeries(
      service,
      baseRule({ effectiveFromPeriod: "2026-08", anchorDate: "2026-08-05" }),
    );
    const september = await occurrenceByPeriod(service, seriesId, "2026-09");
    expect(september.occurrence.revision).toBe(1);

    const confirmed = await service.confirm(september.occurrence.id, review());
    expect(confirmed.ok && confirmed.value.status).toBe("recorded");

    const succeeded = await service.succeedRule(
      seriesId,
      baseRule({ effectiveFromPeriod: "2026-10", dueDay: 20, changeReason: "توعدت بدفع يوم ٢٠" }),
    );
    expect(succeeded.ok && succeeded.value.successor.revision).toBe(2);

    /* المقَرَّرة (2026-09) تبقى بمراجعتها الأصلية؛ المستقبلية (2026-10) تُشتق
     * من جديد بمراجعتها الجديدة ويومها الجديد. */
    const septemberAfter = await occurrenceByPeriod(service, seriesId, "2026-09");
    expect(septemberAfter.occurrence.status).toBe("recorded");
    expect(septemberAfter.occurrence.revision).toBe(1);
    const octoberAfter = await occurrenceByPeriod(service, seriesId, "2026-10");
    expect(octoberAfter.occurrence.status).toBe("planned");
    expect(octoberAfter.occurrence.revision).toBe(2);
    expect(octoberAfter.occurrence.dueOn).toBe("2026-10-20");
  });

  it("سياسة «اسأل» للشهر القصير: سؤال صريح بلا تخمين، وكلا الجوابين موثق", async () => {
    /* يوم ٣١ مع سياسة سؤال: سبتمبر (٣٠ يومًا) يسأل — آخر يوم صالح أو تخطي. */
    const store = new MemoryLocalStore();
    const service = new RecurringExpenseService(store, () => SEPTEMBER);
    const seriesId = await activatedSeries(
      service,
      baseRule({
        effectiveFromPeriod: "2026-08",
        anchorDate: "2026-08-31",
        dueDay: 31,
        monthEndPolicy: "ask",
      }),
    );

    const detail = await service.readDetail(seriesId);
    expect(detail.ok && detail.value.pendingDueDecisions.map(candidate => candidate.periodKey)).toEqual([
      "2026-09",
    ]);
    expect(detail.ok && detail.value.pendingDueDecisions[0]!.lastValidDay).toBe(30);
    /* الشهر القصير بلا قرار لا يولّد فترة تلقائيًا. */
    expect(detail.ok && detail.value.occurrences.map(r => r.occurrence.periodKey)).toEqual([
      "2026-08",
      "2026-10",
    ]);

    const resolved = await service.resolveDueDecision(seriesId, "2026-09", "last_valid_day");
    expect(resolved.ok && resolved.value?.status).toBe("planned");
    expect(resolved.ok && resolved.value?.dueOn).toBe("2026-09-30");

    /* التخطي على سلسلة ثانية بالسياسة نفسها: قرار محفوظ بلا أي أثر مالي. */
    const store2 = new MemoryLocalStore();
    const service2 = new RecurringExpenseService(store2, () => SEPTEMBER);
    const seriesId2 = await activatedSeries(
      service2,
      baseRule({
        effectiveFromPeriod: "2026-08",
        anchorDate: "2026-08-31",
        dueDay: 31,
        monthEndPolicy: "ask",
      }),
    );
    const skipped = await service2.resolveDueDecision(seriesId2, "2026-09", "skip");
    expect(skipped.ok && skipped.value?.status).toBe("skipped");
    expect(await eventsOf(store2)).toEqual([]);

    /* الجواب عن غير المعلق رفض صادر. */
    const none = await service.resolveDueDecision(seriesId, "2026-10", "last_valid_day");
    expect(none.ok).toBe(false);
  });

  it("إلغاء السلسلة يلغي الفترات المستقبلية غير المقَرَّرة فقط ولا يمس المقَرَّرة ولا الماضية", async () => {
    const store = new MemoryLocalStore();
    const service = new RecurringExpenseService(store, () => SEPTEMBER);
    const seriesId = await activatedSeries(
      service,
      baseRule({ effectiveFromPeriod: "2026-08", anchorDate: "2026-08-05" }),
    );

    /* 2026-08 متأخرة (ماضية غير مقَرَّرة)؛ 2026-09 حالية غير مقَرَّرة؛
     * 2026-10 مستقبلية غير مقَرَّرة. */
    const september = await occurrenceByPeriod(service, seriesId, "2026-09");
    const confirmed = await service.confirm(september.occurrence.id, review());
    expect(confirmed.ok && confirmed.value.status).toBe("recorded");

    const cancelled = await service.cancel(seriesId, "أغلقت المحل");
    expect(cancelled.ok && cancelled.value.status).toBe("cancelled");

    const after = await service.readDetail(seriesId);
    expect(after.ok).toBe(true);
    if (!after.ok) return;
    const byPeriod = new Map(after.value.occurrences.map(r => [r.occurrence.periodKey, r.occurrence]));
    expect(byPeriod.get("2026-08")!.status).toBe("planned"); /* ماضية: قرارها على المستخدم */
    expect(byPeriod.get("2026-09")!.status).toBe("recorded"); /* مقَرَّرة: لا تُمس */
    expect(byPeriod.get("2026-10")!.status).toBe("cancelled"); /* مستقبلية: تُلغى موثقة */
    expect(byPeriod.get("2026-10")!.actionHistory.at(-1)?.reason).toBe("إلغاء السلسلة: أغلقت المحل");
    expect(await eventsOf(store)).toHaveLength(1);
  });

  it("التراجع عبر الكاتب الكنوني: الأصل محفوظ، الفترة لا تُفتح، والعرض مشتق «معكوس»", async () => {
    const store = new MemoryLocalStore();
    const finance = new ProjectFinancialService(store, () => SEPTEMBER);
    const service = new RecurringExpenseService(store, () => SEPTEMBER);
    const seriesId = await activatedSeries(service);
    const occurrence = await occurrenceByPeriod(service, seriesId, "2026-09");

    const confirmed = await service.confirm(occurrence.occurrence.id, review());
    if (!confirmed.ok) throw new Error(confirmed.message);
    const sourceEventId = confirmed.value.event.id;

    const reversed = await finance.reverse({
      sourceEventId,
      occurredOn: "2026-09-22",
      reason: "دخل مزدوج بالخطأ",
      idempotencyKey: "reverse-september-1",
    });
    expect(reversed.ok).toBe(true);

    /* الفترة تبقى مقَرَّرة (لا تُفتح تلقائيًا) والعرض مشتق «معكوس». */
    const reading = await occurrenceByPeriod(service, seriesId, "2026-09");
    expect(reading.occurrence.status).toBe("recorded");
    expect(reading.displayState).toBe("reversed");
    expect(reading.reversed).toBe(true);

    /* الأصل محفوظ كما هو + حدث التراجع المستقل؛ لا تراجع ثانٍ. */
    const events = await eventsOf(store);
    expect(events.find(event => event.id === sourceEventId)?.correctionType ?? null).toBeNull();
    expect(reversedEventIds(events).has(sourceEventId)).toBe(true);
    const secondReverse = await finance.reverse({
      sourceEventId,
      occurredOn: "2026-09-23",
      reason: "محاولة ثانية",
      idempotencyKey: "reverse-september-2",
    });
    expect(secondReverse.ok).toBe(false);
    const retrySameKey = await finance.reverse({
      sourceEventId,
      occurredOn: "2026-09-22",
      reason: "دخل مزدوج بالخطأ",
      idempotencyKey: "reverse-september-1",
    });
    expect(retrySameKey.ok && retrySameKey.reused).toBe(true);
  });

  it("تخصيص المحفظة خطوة لاحقة مستقلة: فشلها غير مالي ولا يغير حالة الفترة", async () => {
    const store = new MemoryLocalStore();
    const service = new RecurringExpenseService(store, () => SEPTEMBER, {
      distributeUnallocated: async () => ({ ok: false, message: "المحفظة غير موجودة" }),
    });
    const seriesId = await activatedSeries(service);
    const occurrence = await occurrenceByPeriod(service, seriesId, "2026-09");

    const confirmed = await service.confirm(occurrence.occurrence.id, review({ walletId: "wallet-1" }));
    expect(confirmed.ok && confirmed.value.status).toBe("recorded");
    expect(confirmed.ok && confirmed.value.attributionNote).toBe("المحفظة غير موجودة");
    expect(confirmed.ok && confirmed.value.occurrence.status).toBe("recorded");
  });

  it("المصروف اليدوي المتزامن يحذَّر لا يحجب: تحذير ظاهر لفترة غير معالجة فقط", async () => {
    const store = new MemoryLocalStore();
    const service = new RecurringExpenseService(store, () => SEPTEMBER);
    const seriesId = await activatedSeries(service);

    const warned = await service.findUnhandledOccurrenceForDate("2026-09-15");
    expect(warned.ok && warned.value?.seriesTitle).toBe("إيجار المحل الشهري");
    expect(warned.ok && warned.value?.periodKey).toBe("2026-09");

    const otherMonth = await service.findUnhandledOccurrenceForDate("2026-07-15");
    expect(otherMonth.ok && otherMonth.value).toBeNull();

    /* بعد التسجيل يختفي التحذير لهذه الفترة. */
    const occurrence = await occurrenceByPeriod(service, seriesId, "2026-09");
    const confirmed = await service.confirm(occurrence.occurrence.id, review());
    expect(confirmed.ok).toBe(true);
    const after = await service.findUnhandledOccurrenceForDate("2026-09-15");
    expect(after.ok && after.value).toBeNull();
  });

  it("بطاقة القائمة تشتق العد والاستحقاق القادم من القرارات لا من وجود أحداث", async () => {
    const store = new MemoryLocalStore();
    const service = new RecurringExpenseService(store, () => SEPTEMBER);
    const seriesId = await activatedSeries(service);

    const overview = await service.readOverview();
    const card = overview.ok ? overview.value.find(candidate => candidate.series.id === seriesId) : undefined;
    expect(card?.openCount).toBe(2);
    expect(card?.handledCount).toBe(0);
    expect(card?.nextDueOn).toBe("2026-09-05");

    const september = await occurrenceByPeriod(service, seriesId, "2026-09");
    await service.confirm(september.occurrence.id, review());
    await service.skipOccurrence(
      (await occurrenceByPeriod(service, seriesId, "2026-10")).occurrence.id,
      null,
    );

    const refreshed = await service.readOverview();
    const refreshedCard = refreshed.ok
      ? refreshed.value.find(candidate => candidate.series.id === seriesId)
      : undefined;
    expect(refreshedCard?.openCount).toBe(0);
    expect(refreshedCard?.handledCount).toBe(2);
    expect(refreshedCard?.nextDueOn).toBeNull();
  });
});
