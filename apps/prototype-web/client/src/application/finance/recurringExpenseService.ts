/**
 * OPS-003 (عقد ٤١): خدمة المصروف المتكرر — طبقة التطبيق فوق الدومين النقي
 * والمخازن المحروسة. كل الأفعال هنا قرار صريح للمستخدم: لا تسجيل تلقائي عند
 * الاستحقاق، ولا دينًا من التأخر، ولا صفرًا من التخطي، ولا نجاحًا من مجهول.
 *
 * مسار التأكيد (عقد ٤١ §٨): بناء الحدث بالتوسيع النقي نفسه الذي يستعمله
 * `ProjectFinancialService.record` (`expandExpenseRecordIntent`) — تحقق أول
 * بلا كتابة، ثم علامة المحاولة، ثم الالتزام الذرّي (الفترة + الحدث معًا)،
 * ثم تخصيص المحفظة بخطوة لاحقة حتمية مستقلة فشلها غير مالي (عقد ٢٧ §3).
 * الإعادة بنفس المفتاح = `reused` صادقة؛ والاصطدام بحدث مختلف رفض صادر.
 */
import {
  activateRecurringExpenseSeries,
  archiveRecurringExpenseSeries,
  cancelRecurringExpenseSeries,
  cancelRecurringExpenseOccurrence,
  createRecurringExpenseDraftSeries,
  createRecurringExpenseOccurrence,
  dueDateForPeriod,
  firstScheduledPeriod,
  isPeriodOnSchedule,
  markRecurringExpenseConfirmAttempted,
  markRecurringExpenseRecorded,
  markRecurringExpenseRecordFailed,
  pauseRecurringExpenseSeries,
  readRecurringExpenseOccurrence,
  recurringPeriodAfter,
  replanRecurringExpenseOccurrence,
  restoreRecurringExpenseSeries,
  resumeRecurringExpenseSeries,
  skipRecurringExpenseOccurrence,
  snoozeRecurringExpenseOccurrence,
  succeedRecurringExpenseRuleRevision,
  type RecurringExpenseOccurrence,
  type RecurringExpenseOccurrenceReading,
  type RecurringExpenseRuleDraft,
  type RecurringExpenseRuleRevision,
  type RecurringExpenseSeries,
} from "@micro-domain/recurring-expense/index.js";
import { reversedEventIds } from "@micro-domain/financial-event/index.js";
import { createFinancialEvent } from "@micro-domain/financial-event/index.js";
import type { FinancialEvent, OperatingExpenseContext } from "@micro-domain/financial-event/index.js";
import { localDateInAmman } from "@micro-domain/shared/index.js";
import { expandExpenseRecordIntent, type SharedExpenseRecordInput } from "./expenseRecordIntent";
import type { ProjectFinancialService } from "./projectFinancialService";
import type { PrototypeLocalStore } from "@/storage/local/types";

export type RecurringExpenseServiceResult<T> =
  | { ok: true; value: T }
  | { ok: false; code: "validation_error" | "storage_error" | "storage_stale"; message: string };

export type RecurringExpenseReview = {
  type: "operating_expense_cash" | "operating_expense_payable";
  amountMinor: number;
  occurredOn: string;
  note: string;
  counterparty?: string | null;
  expenseContext: OperatingExpenseContext;
  sharedExpense?: SharedExpenseRecordInput;
  walletId?: string | null;
};

export type RecurringConfirmOutcome =
  | {
      status: "recorded" | "reused";
      occurrence: RecurringExpenseOccurrence;
      event: FinancialEvent;
      attributionNote: string | null;
    }
  | { status: "record_failed"; occurrence: RecurringExpenseOccurrence; message: string };

export type RecurringExpenseSeriesCardReading = {
  series: RecurringExpenseSeries;
  revision: RecurringExpenseRuleRevision;
  openCount: number;
  nextDueOn: string | null;
  handledCount: number;
};

export type RecurringExpensePendingDueDecision = {
  periodKey: string;
  dueDay: number;
  lastValidDay: number;
};

export type RecurringExpenseDetailReading = {
  series: RecurringExpenseSeries;
  revisions: readonly RecurringExpenseRuleRevision[];
  occurrences: readonly RecurringExpenseOccurrenceReading[];
  pendingDueDecisions: readonly RecurringExpensePendingDueDecision[];
};

const newId = (): string =>
  globalThis.crypto?.randomUUID?.() ?? `recurring-${Date.now()}-${Math.random().toString(36).slice(2)}`;

const HORIZON_PERIODS_AHEAD = 1;

export class RecurringExpenseService {
  constructor(
    private readonly store: PrototypeLocalStore,
    private readonly now: () => string = () => new Date().toISOString(),
    private readonly projectFinance?: Pick<ProjectFinancialService, "distributeUnallocated">,
  ) {}

  private readonly inFlightKeys = new Set<string>();

  private today(): string {
    return localDateInAmman(this.now());
  }

  /* ─── القراءة مع التوليد الأمامي الحتمي (إضافة فقط) ─── */

  private async readAll(): Promise<
    RecurringExpenseServiceResult<{
      seriesList: readonly RecurringExpenseSeries[];
      revisions: readonly RecurringExpenseRuleRevision[];
      occurrences: readonly RecurringExpenseOccurrence[];
      events: readonly FinancialEvent[];
    }>
  > {
    const [seriesList, revisions, occurrences, events] = await Promise.all([
      this.store.listRecurringExpenseSeries(),
      this.store.listRecurringExpenseRevisions(),
      this.store.listRecurringExpenseOccurrences(),
      this.store.listFinancialEvents(),
    ]);
    if (!seriesList.ok || !revisions.ok || !occurrences.ok || !events.ok)
      return { ok: false, code: "storage_error", message: "تعذر قراءة سجل المصروف المتكرر." };
    return {
      ok: true,
      value: {
        seriesList: seriesList.value,
        revisions: revisions.value,
        occurrences: occurrences.value,
        events: events.value,
      },
    };
  }

  private async ensureOccurrences(
    series: RecurringExpenseSeries,
    revisions: readonly RecurringExpenseRuleRevision[],
    existingOccurrences: readonly RecurringExpenseOccurrence[],
  ): Promise<RecurringExpenseServiceResult<null>> {
    /* التوليد الأمامي للفترات نشاط تشغيلي للسلسلة النشطة حصرًا: المسودة بلا
     * قاعدة نافذة، والموقوفة/المؤرشفة/الملغاة لا تولّد فترات جديدة (عقد ٤١ §٣). */
    if (series.status !== "active") return { ok: true, value: null };
    const seriesRevisions = revisions
      .filter(revision => revision.seriesId === series.id)
      .sort((left, right) => left.revision - right.revision);
    const first = seriesRevisions[0];
    if (!first) return { ok: true, value: null };
    const today = this.today();
    const currentPeriod = today.slice(0, 7);
    const horizon = recurringPeriodAfter(currentPeriod, HORIZON_PERIODS_AHEAD);
    /* التوليد إنشاءٌ للفترات غير الموجودة فقط: الفترة القائمة بسجلها وقراراتها
     * لا تُمس أبدًا — إعادة إنشائها فوق قرار محفوظ تعارض ترفضه الحارس (عقد ٤١ §٥). */
    const existingPeriods = new Set(
      existingOccurrences
        .filter(occurrence => occurrence.seriesId === series.id)
        .map(occurrence => occurrence.periodKey),
    );
    const materialized: RecurringExpenseOccurrence[] = [];
    /* الاستئناف/الاستعادة نشاط مستقبلي فقط: لا تُستكمل فترات التوقيف/الأرشفة
     * بأثر رجعي — الحد المحفوظ يسبق البدء (عقد ٤١ §٣). */
    let period = firstScheduledPeriod(first);
    if (series.resumedFromPeriod && series.resumedFromPeriod > period) period = series.resumedFromPeriod;
    /* التكرار محدود بالأفق المعلن (الفترة الحالية + ١) — عقد ٤١ §٥. */
    for (let guard = 0; period <= horizon && guard < 1_200; guard += 1) {
      if (!existingPeriods.has(period)) {
        const effective = seriesRevisions
          .filter(revision => revision.effectiveFromPeriod <= period)
          .reduce<RecurringExpenseRuleRevision | undefined>(
            (latest, revision) =>
              latest === undefined || revision.revision > latest.revision ? revision : latest,
            undefined,
          );
        if (effective && isPeriodOnSchedule(effective, period)) {
          const resolution = dueDateForPeriod(effective, period);
          if (resolution.kind === "due") {
            materialized.push(
              createRecurringExpenseOccurrence({
                seriesId: series.id,
                revision: effective.revision,
                periodKey: period,
                dueOn: resolution.dueOn,
                createdAt: this.now(),
              }),
            );
          }
        }
      }
      period = recurringPeriodAfter(period, 1);
    }
    if (materialized.length > 0) {
      const committed = await this.store.commitRecurringExpenseOccurrences(materialized);
      if (!committed.ok)
        return {
          ok: false,
          code: committed.code === "storage_stale" ? "storage_stale" : "storage_error",
          message: committed.message,
        };
    }
    return { ok: true, value: null };
  }

  async readOverview(): Promise<RecurringExpenseServiceResult<readonly RecurringExpenseSeriesCardReading[]>> {
    const read = await this.readAll();
    if (!read.ok) return read;
    for (const series of read.value.seriesList) {
      const ensured = await this.ensureOccurrences(series, read.value.revisions, read.value.occurrences);
      if (!ensured.ok) return ensured;
    }
    const refreshed = await this.readAll();
    if (!refreshed.ok) return refreshed;
    const { seriesList, revisions, occurrences } = refreshed.value;
    const latestRevision = new Map<string, RecurringExpenseRuleRevision>();
    for (const revision of revisions) {
      const current = latestRevision.get(revision.seriesId);
      if (current === undefined || revision.revision > current.revision)
        latestRevision.set(revision.seriesId, revision);
    }
    const cards: RecurringExpenseSeriesCardReading[] = [];
    for (const series of seriesList) {
      const revision = latestRevision.get(series.id);
      if (!revision) continue;
      const seriesOccurrences = occurrences.filter(occurrence => occurrence.seriesId === series.id);
      const open = seriesOccurrences.filter(
        occurrence =>
          occurrence.status === "planned" ||
          occurrence.status === "snoozed" ||
          occurrence.status === "recording",
      );
      const handled = seriesOccurrences.filter(
        occurrence => occurrence.status === "recorded" || occurrence.status === "skipped",
      );
      const nextDueOn =
        open
          .map(occurrence => occurrence.snoozedUntil ?? occurrence.dueOn)
          .sort((left, right) => left.localeCompare(right))[0] ?? null;
      cards.push({ series, revision, openCount: open.length, nextDueOn, handledCount: handled.length });
    }
    return { ok: true, value: cards };
  }

  async readDetail(seriesId: string): Promise<RecurringExpenseServiceResult<RecurringExpenseDetailReading>> {
    const read = await this.readAll();
    if (!read.ok) return read;
    const series = read.value.seriesList.find(candidate => candidate.id === seriesId);
    if (!series) return { ok: false, code: "validation_error", message: "سلسلة المصروف المتكرر غير موجودة." };
    const ensured = await this.ensureOccurrences(series, read.value.revisions, read.value.occurrences);
    if (!ensured.ok) return ensured;
    const refreshed = await this.readAll();
    if (!refreshed.ok) return refreshed;
    const revisions = refreshed.value.revisions
      .filter(revision => revision.seriesId === seriesId)
      .sort((left, right) => left.revision - right.revision);
    const seriesOccurrences = refreshed.value.occurrences
      .filter(occurrence => occurrence.seriesId === seriesId)
      .sort((left, right) => left.periodKey.localeCompare(right.periodKey));
    const today = this.today();
    const reversedIds = reversedEventIds(refreshed.value.events);
    const readings = seriesOccurrences.map(occurrence =>
      readRecurringExpenseOccurrence(occurrence, {
        today,
        reversedEventIds: reversedIds,
        /* مفاتيح قيد التنفيذ الآن: تميّز «قيد التأكيد الآن» عن «نتيجة غير معروفة». */
        inFlightKeys: this.inFlightKeys,
      }),
    );
    /* فترات سياسة «اسأل» غير المقَرَّرة بعد: سؤال صريح لا تخمين (عقد ٤١ §٥) —
     * للسلسلة النشطة حصرًا ومن حد الاستئناف/الاستعادة لا من أول التاريخ. */
    const latest = revisions.at(-1);
    const pendingDueDecisions: RecurringExpensePendingDueDecision[] = [];
    if (latest && series.status === "active") {
      const currentPeriod = today.slice(0, 7);
      const horizon = recurringPeriodAfter(currentPeriod, HORIZON_PERIODS_AHEAD);
      let period = firstScheduledPeriod(latest);
      if (series.resumedFromPeriod && series.resumedFromPeriod > period) period = series.resumedFromPeriod;
      for (let guard = 0; period <= horizon && guard < 1_200; guard += 1) {
        const effective = revisions
          .filter(revision => revision.effectiveFromPeriod <= period)
          .reduce<RecurringExpenseRuleRevision | undefined>(
            (candidate, revision) =>
              candidate === undefined || revision.revision > candidate.revision ? revision : candidate,
            undefined,
          );
        if (effective && isPeriodOnSchedule(effective, period)) {
          const resolution = dueDateForPeriod(effective, period);
          const exists = seriesOccurrences.some(occurrence => occurrence.periodKey === period);
          if (resolution.kind === "ask" && !exists)
            pendingDueDecisions.push({
              periodKey: period,
              dueDay: effective.dueDay,
              lastValidDay: resolution.lastValidDay,
            });
        }
        period = recurringPeriodAfter(period, 1);
      }
    }
    return {
      ok: true,
      value: { series, revisions, occurrences: readings, pendingDueDecisions },
    };
  }

  /* ─── أفعال السلسلة ─── */

  async createDraft(input: {
    title: string;
    rule: RecurringExpenseRuleDraft;
  }): Promise<
    RecurringExpenseServiceResult<{ series: RecurringExpenseSeries; revision: RecurringExpenseRuleRevision }>
  > {
    try {
      const draft = createRecurringExpenseDraftSeries({ id: newId(), ...input, createdAt: this.now() });
      const committed = await this.store.commitRecurringExpenseDraft(draft.series, draft.revision);
      if (!committed.ok)
        return {
          ok: false,
          code: committed.code === "storage_stale" ? "storage_stale" : "storage_error",
          message: committed.message,
        };
      return { ok: true, value: { series: committed.value.series, revision: committed.value.revision } };
    } catch (error) {
      return {
        ok: false,
        code: "validation_error",
        message: error instanceof Error ? error.message : "بيانات التذكير غير صالحة.",
      };
    }
  }

  private async changeSeries(
    seriesId: string,
    transform: (series: RecurringExpenseSeries) => RecurringExpenseSeries,
  ): Promise<RecurringExpenseServiceResult<RecurringExpenseSeries>> {
    const existing = await this.store.getRecurringExpenseSeries(seriesId);
    if (!existing.ok) return { ok: false, code: "storage_error", message: existing.message };
    if (!existing.value)
      return { ok: false, code: "validation_error", message: "سلسلة المصروف المتكرر غير موجودة." };
    try {
      const next = transform(existing.value);
      const committed = await this.store.commitRecurringExpenseSeriesChange(existing.value, next, null, []);
      if (!committed.ok)
        return {
          ok: false,
          code: committed.code === "storage_stale" ? "storage_stale" : "storage_error",
          message: committed.message,
        };
      return { ok: true, value: committed.value.series };
    } catch (error) {
      return {
        ok: false,
        code: "validation_error",
        message: error instanceof Error ? error.message : "انتقال غير قانوني.",
      };
    }
  }

  activate(seriesId: string) {
    return this.changeSeries(seriesId, series => activateRecurringExpenseSeries(series, this.now()));
  }
  pause(seriesId: string) {
    return this.changeSeries(seriesId, series => pauseRecurringExpenseSeries(series, this.now()));
  }
  resume(seriesId: string) {
    return this.changeSeries(seriesId, series =>
      resumeRecurringExpenseSeries(series, this.now(), this.today().slice(0, 7)),
    );
  }
  archive(seriesId: string) {
    return this.changeSeries(seriesId, series => archiveRecurringExpenseSeries(series, this.now()));
  }
  restore(seriesId: string, to: "active" | "paused" = "active") {
    return this.changeSeries(seriesId, series =>
      restoreRecurringExpenseSeries(series, to, this.now(), this.today().slice(0, 7)),
    );
  }

  /** إلغاء السلسلة بسبب موثق — الفترات المستقبلية غير المقَرَّرة فقط تُلغى معها
   * (استحقاقها لم يحن بعد)؛ فترات اليوم والماضي غير المقَرَّرة تبقى قرارًا صريحًا
   * للمستخدم؛ لا حذف ولا عكس ولا مس للتاريخ المالي (عقد ٤١ §٣). */
  async cancel(
    seriesId: string,
    reason: string,
  ): Promise<RecurringExpenseServiceResult<RecurringExpenseSeries>> {
    const read = await this.readAll();
    if (!read.ok) return read;
    const series = read.value.seriesList.find(candidate => candidate.id === seriesId);
    if (!series) return { ok: false, code: "validation_error", message: "سلسلة المصروف المتكرر غير موجودة." };
    try {
      const cancelled = cancelRecurringExpenseSeries(series, reason, this.now());
      const at = this.now();
      const today = this.today();
      const occurrenceUpdates = read.value.occurrences
        .filter(
          occurrence =>
            occurrence.seriesId === seriesId &&
            (occurrence.status === "planned" || occurrence.status === "snoozed") &&
            occurrence.dueOn > today,
        )
        .map(occurrence => ({
          base: occurrence,
          next: cancelRecurringExpenseOccurrence(occurrence, at, `إلغاء السلسلة: ${reason}`),
        }));
      const committed = await this.store.commitRecurringExpenseSeriesChange(
        series,
        cancelled,
        null,
        occurrenceUpdates,
      );
      if (!committed.ok)
        return {
          ok: false,
          code: committed.code === "storage_stale" ? "storage_stale" : "storage_error",
          message: committed.message,
        };
      return { ok: true, value: committed.value.series };
    } catch (error) {
      return {
        ok: false,
        code: "validation_error",
        message: error instanceof Error ? error.message : "إلغاء غير قانوني.",
      };
    }
  }

  /** تعديل مستقبلي: مراجعة خلف جديدة — الفترات المخططة بلا قرار تُشتق من
   * جديد، وخارج الجدول الجديد يُلغى بتوثيق؛ القرارات المحفوظة لا تُمس. */
  async succeedRule(
    seriesId: string,
    draft: RecurringExpenseRuleDraft,
  ): Promise<
    RecurringExpenseServiceResult<{ series: RecurringExpenseSeries; successor: RecurringExpenseRuleRevision }>
  > {
    const read = await this.readAll();
    if (!read.ok) return read;
    const series = read.value.seriesList.find(candidate => candidate.id === seriesId);
    if (!series) return { ok: false, code: "validation_error", message: "سلسلة المصروف المتكرر غير موجودة." };
    const seriesRevisions = read.value.revisions
      .filter(revision => revision.seriesId === seriesId)
      .sort((left, right) => left.revision - right.revision);
    const current = seriesRevisions.at(-1);
    if (!current)
      return { ok: false, code: "validation_error", message: "السلسلة بلا قاعدة — لا تعديل مستقبلي." };
    try {
      const { series: nextSeries, successor } = succeedRecurringExpenseRuleRevision(
        series,
        current,
        draft,
        this.now(),
      );
      const at = this.now();
      const occurrenceUpdates: { base: RecurringExpenseOccurrence; next: RecurringExpenseOccurrence }[] = [];
      for (const occurrence of read.value.occurrences) {
        if (occurrence.seriesId !== seriesId || occurrence.periodKey < successor.effectiveFromPeriod)
          continue;
        if (occurrence.status !== "planned") continue;
        if (occurrence.actionHistory.some(action => action.kind !== "created" && action.kind !== "revised"))
          continue;
        if (isPeriodOnSchedule(successor, occurrence.periodKey)) {
          const resolution = dueDateForPeriod(successor, occurrence.periodKey);
          if (resolution.kind === "due") {
            occurrenceUpdates.push({
              base: occurrence,
              next: replanRecurringExpenseOccurrence(occurrence, successor.revision, resolution.dueOn, at),
            });
          } else {
            occurrenceUpdates.push({
              base: occurrence,
              next: cancelRecurringExpenseOccurrence(
                occurrence,
                at,
                "المراجعة الجديدة لا تنشئ استحقاقًا لهذه الفترة",
              ),
            });
          }
        } else {
          occurrenceUpdates.push({
            base: occurrence,
            next: cancelRecurringExpenseOccurrence(occurrence, at, "خارج جدول المراجعة الجديدة"),
          });
        }
      }
      const committed = await this.store.commitRecurringExpenseSeriesChange(
        series,
        nextSeries,
        successor,
        occurrenceUpdates,
      );
      if (!committed.ok)
        return {
          ok: false,
          code: committed.code === "storage_stale" ? "storage_stale" : "storage_error",
          message: committed.message,
        };
      return { ok: true, value: { series: committed.value.series, successor: committed.value.revision! } };
    } catch (error) {
      return {
        ok: false,
        code: "validation_error",
        message: error instanceof Error ? error.message : "تعديل غير قانوني.",
      };
    }
  }

  /* ─── أفعال الفترة ─── */

  private async changeOccurrence(
    occurrenceId: string,
    transform: (occurrence: RecurringExpenseOccurrence) => RecurringExpenseOccurrence,
  ): Promise<RecurringExpenseServiceResult<RecurringExpenseOccurrence>> {
    const existing = await this.store.getRecurringExpenseOccurrence(occurrenceId);
    if (!existing.ok) return { ok: false, code: "storage_error", message: existing.message };
    if (!existing.value)
      return { ok: false, code: "validation_error", message: "فترة المصروف المتكرر غير موجودة." };
    try {
      const next = transform(existing.value);
      const committed = await this.store.commitRecurringExpenseOccurrenceDecision(existing.value, next);
      if (!committed.ok)
        return {
          ok: false,
          code: committed.code === "storage_stale" ? "storage_stale" : "storage_error",
          message: committed.message,
        };
      return { ok: true, value: committed.value.occurrence };
    } catch (error) {
      return {
        ok: false,
        code: "validation_error",
        message: error instanceof Error ? error.message : "قرار غير قانوني.",
      };
    }
  }

  snooze(occurrenceId: string, until: string) {
    return this.changeOccurrence(occurrenceId, occurrence =>
      snoozeRecurringExpenseOccurrence(occurrence, until, this.today(), this.now()),
    );
  }

  /* اسم الطريقة «skipOccurrence» لا «skip»: اصطدام اسم قصير مع معدّلات
   * الاختبار المعيارية يُصطاد بحارس التركيز الصارم — الشكل الصريح أوضح وأأمن. */
  skipOccurrence(occurrenceId: string, reason: string | null) {
    return this.changeOccurrence(occurrenceId, occurrence =>
      skipRecurringExpenseOccurrence(occurrence, reason, this.now()),
    );
  }

  /** قرار فترة سياسة «اسأل» (شهر قصير): آخر يوم صالح أو تخطي الشهر — موثق.
   * المرجع هو المراجعة النافذة لتلك الفترة لا آخر مراجعة في السلسلة (عقد ٤١ §٤). */
  async resolveDueDecision(
    seriesId: string,
    periodKey: string,
    decision: "last_valid_day" | "skip",
  ): Promise<RecurringExpenseServiceResult<RecurringExpenseOccurrence | null>> {
    const detail = await this.readDetail(seriesId);
    if (!detail.ok) return detail;
    const pending = detail.value.pendingDueDecisions.find(candidate => candidate.periodKey === periodKey);
    if (!pending)
      return { ok: false, code: "validation_error", message: "لا سؤال استحقاق معلقًا لهذه الفترة." };
    const effective = detail.value.revisions
      .filter(revision => revision.effectiveFromPeriod <= periodKey)
      .reduce<RecurringExpenseRuleRevision | undefined>(
        (candidate, revision) =>
          candidate === undefined || revision.revision > candidate.revision ? revision : candidate,
        undefined,
      );
    if (!effective) return { ok: false, code: "validation_error", message: "لا مراجعة نافذة لهذه الفترة." };
    if (decision === "last_valid_day") {
      const dueOn = `${periodKey}-${String(pending.lastValidDay).padStart(2, "0")}`;
      const occurrence = createRecurringExpenseOccurrence({
        seriesId,
        revision: effective.revision,
        periodKey,
        dueOn,
        createdAt: this.now(),
      });
      const committed = await this.store.commitRecurringExpenseOccurrences([occurrence]);
      if (!committed.ok)
        return {
          ok: false,
          code: committed.code === "storage_stale" ? "storage_stale" : "storage_error",
          message: committed.message,
        };
      return { ok: true, value: occurrence };
    }
    /* قرار «تخطي الشهر»: تُنشأ الفترة ثم يُحفظ قرار تخطيها الموثق — لا حدث ولا صفر. */
    const skipped = createRecurringExpenseOccurrence({
      seriesId,
      revision: effective.revision,
      periodKey,
      dueOn: `${periodKey}-${String(pending.lastValidDay).padStart(2, "0")}`,
      createdAt: this.now(),
    });
    const created = await this.store.commitRecurringExpenseOccurrences([skipped]);
    if (!created.ok)
      return {
        ok: false,
        code: created.code === "storage_stale" ? "storage_stale" : "storage_error",
        message: created.message,
      };
    return this.changeOccurrence(skipped.id, () =>
      skipRecurringExpenseOccurrence(skipped, "يوم الاستحقاق غير موجود في هذا الشهر — تخطي", this.now()),
    );
  }

  /* ─── التأكيد (عقد ٤١ §٨) ─── */

  /** التحقق من نتيجة مجهولة: يقرأ الحدث بمفتاح الفترة لا بإعادة تقديم عمياء. */
  async checkResult(
    occurrenceId: string,
  ): Promise<RecurringExpenseServiceResult<{ recorded: boolean; event: FinancialEvent | null }>> {
    const existing = await this.store.getRecurringExpenseOccurrence(occurrenceId);
    if (!existing.ok) return { ok: false, code: "storage_error", message: existing.message };
    if (!existing.value)
      return { ok: false, code: "validation_error", message: "فترة المصروف المتكرر غير موجودة." };
    if (existing.value.status === "recorded" && existing.value.recordedFinancialEventId) {
      const event = await this.store.getFinancialEvent(existing.value.recordedFinancialEventId);
      if (event.ok && event.value) return { ok: true, value: { recorded: true, event: event.value } };
    }
    const events = await this.store.listFinancialEvents();
    if (!events.ok) return { ok: false, code: "storage_error", message: events.message };
    const replay = events.value.find(
      event => event.idempotencyKey === existing.value!.recordingIdempotencyKey,
    );
    if (!replay) return { ok: true, value: { recorded: false, event: null } };
    /* حدث موجود بلا فترة مقَرَّرة (حالة شاذة خارج الالتزام الذرّي) — تُصالح
     * صراحةً بقرار موثق لا بصمت. */
    const at = this.now();
    const recorded = markRecurringExpenseRecorded(existing.value, {
      eventId: replay.id,
      amountMinor: replay.amountMinor,
      walletId: null,
      occurredOn: replay.occurredOn,
      reused: true,
      at,
    });
    const committed = await this.store.commitRecurringExpenseOccurrenceDecision(existing.value, recorded);
    if (!committed.ok)
      return {
        ok: false,
        code: committed.code === "storage_stale" ? "storage_stale" : "storage_error",
        message: committed.message,
      };
    return { ok: true, value: { recorded: true, event: replay } };
  }

  async confirm(
    occurrenceId: string,
    review: RecurringExpenseReview,
  ): Promise<RecurringExpenseServiceResult<RecurringConfirmOutcome>> {
    const existing = await this.store.getRecurringExpenseOccurrence(occurrenceId);
    if (!existing.ok) return { ok: false, code: "storage_error", message: existing.message };
    const occurrence = existing.value;
    if (!occurrence)
      return { ok: false, code: "validation_error", message: "فترة المصروف المتكرر غير موجودة." };

    /* مقَرَّرة سلفًا: «المصروف مسجل مسبقًا لهذه الفترة» — بلا أي كتابة. */
    if (occurrence.status === "recorded" && occurrence.recordedFinancialEventId) {
      const event = await this.store.getFinancialEvent(occurrence.recordedFinancialEventId);
      if (event.ok && event.value)
        return {
          ok: true,
          value: { status: "reused", occurrence, event: event.value, attributionNote: null },
        };
    }

    /* بناء الحدث بالتوسيع النقي نفسه — تحقق أول بلا أي كتابة. */
    let event: FinancialEvent;
    try {
      const expanded = expandExpenseRecordIntent({
        type: review.type,
        amountMinor: review.amountMinor,
        expenseContext: review.expenseContext,
        sharedExpense: review.sharedExpense,
      });
      if (!expanded.ok) return { ok: false, code: "validation_error", message: expanded.message };
      event = createFinancialEvent({
        id: newId(),
        type: review.type,
        amountMinor: expanded.amountMinor,
        occurredOn: review.occurredOn,
        recordedAt: this.now(),
        idempotencyKey: occurrence.recordingIdempotencyKey,
        note: review.note,
        counterparty: review.counterparty ?? null,
        relatedEventId: null,
        expenseContext: expanded.expenseContext,
      });
    } catch (error) {
      return {
        ok: false,
        code: "validation_error",
        message: error instanceof Error ? error.message : "بيانات التأكيد غير صالحة.",
      };
    }

    /* علامة المحاولة (planned|snoozed|record_failed → recording)؛ الفترة
     * القائمة في recording (نتيجة غير معروفة سابقًة) تلتزم مباشرة. مفتاحها
     * يُعلَّم «قيد التنفيذ الآن» فيُقرأ في الطريق كذلك لا كمجهولة. */
    let base = occurrence;
    if (occurrence.status !== "recording") {
      const attempted = markRecurringExpenseConfirmAttempted(occurrence, this.now());
      const marker = await this.store.commitRecurringExpenseOccurrenceDecision(occurrence, attempted);
      if (!marker.ok)
        return {
          ok: false,
          code: marker.code === "storage_stale" ? "storage_stale" : "storage_error",
          message: marker.message,
        };
      base = marker.value.occurrence;
    }
    this.inFlightKeys.add(occurrence.recordingIdempotencyKey);
    try {
      return await this.commitRecordedOccurrence(occurrence, base, event, review);
    } finally {
      this.inFlightKeys.delete(occurrence.recordingIdempotencyKey);
    }
  }

  private async commitRecordedOccurrence(
    occurrence: RecurringExpenseOccurrence,
    base: RecurringExpenseOccurrence,
    event: FinancialEvent,
    review: RecurringExpenseReview,
  ): Promise<RecurringExpenseServiceResult<RecurringConfirmOutcome>> {
    const recorded = markRecurringExpenseRecorded(base, {
      eventId: event.id,
      amountMinor: event.amountMinor,
      walletId: review.walletId?.trim() || null,
      occurredOn: review.occurredOn,
      reused: false,
      at: this.now(),
    });
    const committed = await this.store.commitRecurringExpenseOccurrenceRecord(base, recorded, event);
    if (!committed.ok) {
      /* فشل معروف: الالتزام لم يكتمل — يُحفظ القرار برسالة صادقة ويبقى
       * المسار قابلًا لإعادة المحاولة بنفس المفتاح. */
      const failureMessage =
        committed.code === "storage_stale"
          ? committed.message
          : "تعذر حفظ الحدث المالي محليًا — بياناتك كما هي؛ أعد المحاولة.";
      const failed = markRecurringExpenseRecordFailed(base, failureMessage, this.now());
      const failureWrite = await this.store.commitRecurringExpenseOccurrenceDecision(base, failed);
      if (failureWrite.ok)
        return {
          ok: true,
          value: {
            status: "record_failed",
            occurrence: failureWrite.value.occurrence,
            message: failureMessage,
          },
        };
      return {
        ok: false,
        code: committed.code === "storage_stale" ? "storage_stale" : "storage_error",
        message: failureMessage,
      };
    }

    const outcomeOccurrence = committed.value.occurrence;
    const outcomeEvent = committed.value.event;
    /* تخصيص المحفظة: خطوة لاحقة حتمية مستقلة — فشلها غير مالي (المال في
     * غير الموزع) ولا يغير حالة الفترة (عقد ٢٧ §3). */
    let attributionNote: string | null = null;
    const walletId = review.walletId?.trim() || null;
    if (walletId && this.projectFinance && !committed.value.reused) {
      const attribution = await this.projectFinance.distributeUnallocated({
        walletId,
        deltaMinor: -event.amountMinor,
        note: "تغطية مصروف متكرر من رصيد المحفظة",
        sourceRefId: outcomeEvent.id,
        sourceRefKind: "expense",
        operationKey: `${occurrence.recordingIdempotencyKey}:attribute`,
      });
      attributionNote = attribution.ok ? null : attribution.message;
    }
    return {
      ok: true,
      value: {
        status: committed.value.reused ? "reused" : "recorded",
        occurrence: outcomeOccurrence,
        event: outcomeEvent,
        attributionNote,
      },
    };
  }

  /* ─── تحذير الإدخال اليدوي المتزامن (عقد ٤١ §٨) ─── */

  /** مصروف يدوي في فترة تذكير غير معالجة: تحذير ظاهر لا حظر صامت. */
  async findUnhandledOccurrenceForDate(
    occurredOn: string,
  ): Promise<
    RecurringExpenseServiceResult<{ seriesTitle: string; periodKey: string; dueOn: string } | null>
  > {
    const overview = await this.readOverview();
    if (!overview.ok) return overview;
    const periodKey = occurredOn.slice(0, 7);
    const read = await this.readAll();
    if (!read.ok) return read;
    const match = read.value.occurrences.find(
      occurrence =>
        occurrence.periodKey === periodKey &&
        (occurrence.status === "planned" ||
          occurrence.status === "snoozed" ||
          occurrence.status === "recording"),
    );
    if (!match) return { ok: true, value: null };
    const series = read.value.seriesList.find(candidate => candidate.id === match.seriesId);
    return {
      ok: true,
      value: series ? { seriesTitle: series.title, periodKey: match.periodKey, dueOn: match.dueOn } : null,
    };
  }
}
