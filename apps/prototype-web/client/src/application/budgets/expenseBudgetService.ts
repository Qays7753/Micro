/**
 * FIN-002 (عقد ٤٢ — WS-174/Wave 2): خدمة الميزانيات الاختيارية — طبقة تطبيق
 * فوق الدومين النقي والمخزن المحروس. قراءة وسجلات ميزانية حصرًا: لا
 * FinancialEvent يُكتب من هنا أبدًا (الخطة ليست حدثًا ماليًا)، والمنصرف
 * يُقرأ من الأحداث المسجلة قراءةً صرفًا وقت القراءة ولا يُخزن على أي سجل.
 * هذه الخدمة تُحمَّل ديناميكيًا عند أول فتح (سابقة EXE-014/D-034 كما في
 * OPS-003) فلا تُسجَّل في سياق الخدمات ولا تدخل كومة الإقلاع.
 *
 * ─── قاعدة تجميع spentMinor — القرار المالك المؤجل من عقد ٤٢ §٦، موثَّق هنا ───
 * ١) المصدر: أحداث المخزن المالية نفسها التي يقرؤها القارئ الكنوني
 *    (`ProjectFinancialService.readRecordedPeriodResult`) — قراءة واحدة عبر
 *    `listFinancialEvents`؛ لا مصدر ثانٍ ولا حالة مخزنة ولا اشتقاق من الخطة.
 * ٢) الاحتواء الزمني: `occurredOn` داخل حدود شهر الميزانية نفسه (من
 *    `YYYY-MM-01` إلى آخر يوم فيه) بمقارنة نصية — مطابقة لقاعدة `inPeriod`
 *    عند القارئ حرفيًا؛ المنصرف يُحسب على فترة الميزانية (شهرها) لا على
 *    نطاق القراءة المعروض كله.
 * ٣) الأحداث المحتسبة: أحداث المصروف التشغيلي وحدها —
 *    `operatingExpenseDeltaMinor !== 0` (نفس `isRecordedOperatingExpense`
 *    عند القارئ)؛ أحداث التراجع (المعكوسات) تحمل دلتا سالبة فتُخصم داخل
 *    المجموع صافيًا كما عند القارئ تمامًا — صافٍ لا إقصاء.
 * ٤) نطاق «مصروف عام» (`general_expense`): مجموع دلتا كل الأحداث التشغيلية
 *    في الشهر = `recordedOperatingExpenseMinor` عند القارئ الكنوني بالضبط.
 * ٥) نطاق «فئة» (`category`): مطابقة نصية صريحة —
 *    `event.expenseContext?.categoryLabel === scope.categoryLabel` (لوازم
 *    النطاق بعد تشذيب الدومين، ووسم الحدث كما خُزِّن بلا تطبيع) — لا تطبيع
 *    أحرف ولا مرادفات ولا مطابقة ضبابية؛ وتراجعٌ لا يحمل الفئة الصريحة
 *    نفسها لا يُخصم من فئة (نتيجة معلنة لقاعدة المطابقة الصريحة نفسها).
 * ٦) المجهول لا يصير صفرًا (عقد ٤٢ §٦ + قرار FIN-001): شهرٌ بلا أي حدث
 *    مصروف تشغيلي مسجل → `spentMinor = null` → `under_review` («المنصرف
 *    غير معلوم بعد»)؛ وما دام في الشهر حدثٌ تشغيلي واحد فالرقم صافي
 *    الأحداث المسجلة (وصفرُ الفئة المعنية رقمٌ صادق حين توجد أحداث أخرى
 *    في الشهر).
 *
 * الحتمية: الإنشاء والمراجعة يقبلان operationKey من المستدعي — إعادة
 * الإرسال بالمفتاح نفسه تعيد السجل نفسه (reused) لا نسخة ثانية؛ والإغلاق
 * المُعاد على سجل مغلق يعيد السجل نفسه بعله الموثقة كما هي (دومين + حارس
 * المخزن). كل رفض (تحقق أو تداخل) يقع قبل أي كتابة.
 */
import {
  closeExpenseBudget,
  createExpenseBudget,
  dismissGoal,
  evaluateBudgetStatus,
  isValidBudgetPeriodKey,
  restoreGoal,
  reviseExpenseBudget,
  type BudgetScope,
  type ExpenseBudgetKnowledge,
  type ExpenseBudgetRecord,
  type ExpenseBudgetRevisionPair,
  type ExpenseBudgetStatusReading,
} from "@micro-domain/budget/index.js";
import type { FinancialEvent } from "@micro-domain/financial-event/index.js";
import type { PrototypeLocalStore, StorageFailure } from "@/storage/local/types";

export type ExpenseBudgetResult<T> =
  | { ok: true; value: T; reused?: boolean }
  | { ok: false; code: "validation_error" | "storage_error" | "storage_stale"; message: string };

/** قراءة شهر واحد: سجلات الدومين كما خُزِّنت حرفيًا، مفروزة بحالتها. */
export type ExpenseBudgetMonthList = {
  periodKey: string;
  active: readonly ExpenseBudgetRecord[];
  superseded: readonly ExpenseBudgetRecord[];
  closed: readonly ExpenseBudgetRecord[];
};

export type CreateExpenseBudgetServiceInput = {
  periodKey: string;
  scope: BudgetScope;
  amountMinor: number;
  knowledge?: ExpenseBudgetKnowledge;
  note?: string | null;
  operationKey?: string;
};

/** المراجعة: مضمون جديد فقط — الحد (الفترة × النطاق) محفوظ من السابقة (عقد ٤٢ §٤). */
export type ReviseExpenseBudgetServiceInput = {
  amountMinor: number;
  knowledge?: ExpenseBudgetKnowledge;
  note?: string | null;
  operationKey?: string;
};

export type ExpenseBudgetStatusLine = {
  budget: ExpenseBudgetRecord;
  spentMinor: number | null;
  reading: ExpenseBudgetStatusReading;
};

/** قراءة مشتقة وقت الطلب — لا تُخزن أبدًا؛ النافذة وحدها تُقرأ حالتها. */
export type ExpenseBudgetStatusesReading = {
  from: string;
  to: string;
  lines: readonly ExpenseBudgetStatusLine[];
};

const newId = (): string =>
  globalThis.crypto?.randomUUID?.() ?? `budget-${Date.now()}-${Math.random().toString(36).slice(2)}`;

/** حد أقصى دفاعي لعدد الأشهر بين طرفي القراءة — لا حلقة بلا سقف أبدًا. */
const MAX_MONTHS_SPAN = 240;

/** حدود شهر YYYY-MM كتواريخ محلية (نمط monthBounds عند السطح — نفس الحساب). */
function monthBounds(periodKey: string): { from: string; to: string } {
  const [year, month] = periodKey.split("-").map(Number);
  const lastDay = new Date(Date.UTC(year!, month!, 0)).getUTCDate();
  return { from: `${periodKey}-01`, to: `${periodKey}-${String(lastDay).padStart(2, "0")}` };
}

/** مفاتيح الأشهر من from إلى to ضمنًا — رفض صادر إن كان النطاق معكوسًا. */
function monthKeysBetween(from: string, to: string): string[] {
  const months: string[] = [];
  let cursor = from;
  for (let guard = 0; guard <= MAX_MONTHS_SPAN; guard += 1) {
    months.push(cursor);
    if (cursor >= to) return months;
    const [year, month] = cursor.split("-").map(Number);
    const nextMonth = month === 12 ? 1 : month! + 1;
    const nextYear = month === 12 ? year! + 1 : year!;
    cursor = `${nextYear}-${String(nextMonth).padStart(2, "0")}`;
  }
  return months;
}

/** نفس قاعدة القارئ الكنوني: حدث مصروف تشغيلي = دلتا تشغيلية غير صفرية. */
const isRecordedOperatingExpense = (event: FinancialEvent): boolean => event.operatingExpenseDeltaMinor !== 0;

export class ExpenseBudgetService {
  constructor(
    private readonly store: PrototypeLocalStore,
    private readonly now: () => string = () => new Date().toISOString(),
  ) {}

  /* ─── القراءة ─── */

  private async readRecords(): Promise<ExpenseBudgetResult<readonly ExpenseBudgetRecord[]>> {
    const list = await this.store.listExpenseBudgets();
    if (!list.ok) return { ok: false, code: "storage_error", message: "تعذر قراءة سجل الميزانيات." };
    return { ok: true, value: list.value };
  }

  private static byCreation(left: ExpenseBudgetRecord, right: ExpenseBudgetRecord): number {
    return left.createdAt.localeCompare(right.createdAt) || left.id.localeCompare(right.id);
  }

  /** سجلات الشهر كما خُزِّنت — active/superseded/closed مفروزة (عقد ٤٢ §٢). */
  async listBudgets(periodKey: string): Promise<ExpenseBudgetResult<ExpenseBudgetMonthList>> {
    if (!isValidBudgetPeriodKey(periodKey))
      return {
        ok: false,
        code: "validation_error",
        message: "مفتاح فترة الميزانية غير صالح (متوقع YYYY-MM).",
      };
    const read = await this.readRecords();
    if (!read.ok) return read;
    const records = read.value.filter(record => record.periodKey === periodKey);
    return {
      ok: true,
      value: {
        periodKey,
        active: records.filter(record => record.status === "active").sort(ExpenseBudgetService.byCreation),
        superseded: records
          .filter(record => record.status === "superseded")
          .sort(ExpenseBudgetService.byCreation),
        closed: records.filter(record => record.status === "closed").sort(ExpenseBudgetService.byCreation),
      },
    };
  }

  /**
   * حالة القراءة المشتقة لكل ميزانية نافذة في الأشهر المغطاة — قراءة فقط
   * بلا أي كتابة: spentMinor لكل ميزانية على شهرها هي بالقاعدة الموثقة
   * أعلى الملف، ثم evaluateBudgetStatus الدوميني النقي.
   */
  async readBudgetStatuses(range: {
    from: string;
    to: string;
  }): Promise<ExpenseBudgetResult<ExpenseBudgetStatusesReading>> {
    if (!isValidBudgetPeriodKey(range.from) || !isValidBudgetPeriodKey(range.to))
      return {
        ok: false,
        code: "validation_error",
        message: "مفتاحا نطاق قراءة الميزانيات غير صالحين (متوقع YYYY-MM).",
      };
    const [recordsRead, eventsRead] = await Promise.all([
      this.readRecords(),
      this.store.listFinancialEvents(),
    ]);
    if (!recordsRead.ok) return recordsRead;
    if (!eventsRead.ok)
      return { ok: false, code: "storage_error", message: "تعذر قراءة أحداث المصروف لاحتساب المنصرف." };
    const months = new Set(monthKeysBetween(range.from, range.to));
    const events = eventsRead.value;
    const lines: ExpenseBudgetStatusLine[] = recordsRead.value
      .filter(record => record.status === "active" && months.has(record.periodKey))
      .sort(ExpenseBudgetService.byCreation)
      .map(budget => {
        const bounds = monthBounds(budget.periodKey);
        const inMonth = (date: string) => date >= bounds.from && date <= bounds.to;
        const operatingEvents = events.filter(
          event => inMonth(event.occurredOn) && isRecordedOperatingExpense(event),
        );
        /* القاعدة ٦: شهر بلا أي حدث تشغيلي مسجل → مجهول لا صفر زائف. */
        const spentKnown = operatingEvents.length > 0;
        /* تضييق النقابة خارج رد النداء — narrowing لا يعبر دالات الترشيح. */
        const categoryLabel = budget.scope.kind === "category" ? budget.scope.categoryLabel : null;
        const scopedEvents =
          budget.scope.kind === "general_expense"
            ? operatingEvents
            : categoryLabel !== null
              ? operatingEvents.filter(event => event.expenseContext?.categoryLabel === categoryLabel)
              : operatingEvents;
        const spentMinor = spentKnown
          ? scopedEvents.reduce((total, event) => total + event.operatingExpenseDeltaMinor, 0)
          : null;
        return { budget, spentMinor, reading: evaluateBudgetStatus(budget, spentMinor) };
      });
    return { ok: true, value: { from: range.from, to: range.to, lines } };
  }

  /* ─── الكتابة (سجلات ميزانية فقط — لا حدث مالي أبدًا) ─── */

  private static storageFailure(failure: StorageFailure): {
    ok: false;
    code: "storage_error" | "storage_stale";
    message: string;
  } {
    return {
      ok: false,
      code: failure.code === "storage_stale" ? "storage_stale" : "storage_error",
      message: failure.message,
    };
  }

  /**
   * إنشاء ميزانية نافذة — خطة لا حدثًا ماليًا: لا كاش ولا نتيجة ولا دين
   * يتحرك. التداخل والتحقق يُرفضان صادرين قبل أي كتابة (رسالة الدومين
   * حرفيًا)؛ وإعادة الإرسال بعملية الإنشاء نفسها تعيد السجل نفسه.
   */
  async createBudget(
    input: CreateExpenseBudgetServiceInput,
  ): Promise<ExpenseBudgetResult<ExpenseBudgetRecord>> {
    const read = await this.readRecords();
    if (!read.ok) return read;
    try {
      /* الحتمية على مستوى عملية الإنشاء: مفتاح العملية المخزن على السجل. */
      if (input.operationKey) {
        const replay = read.value.find(record => record.operationKey === input.operationKey);
        if (replay) return { ok: true, value: replay, reused: true };
      }
      const record = createExpenseBudget(
        {
          id: newId(),
          periodKind: "month",
          periodKey: input.periodKey,
          scope: input.scope,
          amountMinor: input.amountMinor,
          knowledge: input.knowledge ?? "known",
          note: input.note ?? null,
          operationKey: input.operationKey ?? newId(),
          createdAt: this.now(),
        },
        read.value.filter(record => record.status === "active"),
      );
      const saved = await this.store.saveExpenseBudget(record);
      if (!saved.ok) return ExpenseBudgetService.storageFailure(saved);
      return { ok: true, value: saved.value.record, reused: saved.value.reused };
    } catch (error) {
      return {
        ok: false,
        code: "validation_error",
        message: error instanceof Error ? error.message : "بيانات الميزانية غير صالحة.",
      };
    }
  }

  /** مراجعة بنسخة خلف: زوج ذرّي واحد — الخلف النافذ والسابقة المستبدلة معًا. */
  async reviseBudget(
    id: string,
    input: ReviseExpenseBudgetServiceInput,
  ): Promise<ExpenseBudgetResult<ExpenseBudgetRevisionPair>> {
    const read = await this.readRecords();
    if (!read.ok) return read;
    const previous = read.value.find(record => record.id === id);
    if (!previous) return { ok: false, code: "validation_error", message: "الميزانية المطلوبة غير موجودة." };
    try {
      if (input.operationKey) {
        /* إعادة إرسال المراجعة نفسها: خلفها المخزن بمفتاحها يعاد مع سابقته
         * المستبدلة كما هي — لا زوج ثانٍ ولا تاريخ يُلمس. */
        const replay = read.value.find(record => record.operationKey === input.operationKey);
        if (replay && previous.status === "superseded" && previous.supersededById === replay.id)
          return { ok: true, value: { successor: replay, supersededPrevious: previous }, reused: true };
      }
      const pair = reviseExpenseBudget(previous, {
        successorId: newId(),
        amountMinor: input.amountMinor,
        knowledge: input.knowledge ?? "known",
        note: input.note ?? null,
        operationKey: input.operationKey ?? newId(),
        at: this.now(),
      });
      const saved = await this.store.saveExpenseBudgetRevisionPair(pair.successor, pair.supersededPrevious);
      if (!saved.ok) return ExpenseBudgetService.storageFailure(saved);
      return {
        ok: true,
        value: { successor: saved.value.successor, supersededPrevious: saved.value.supersededPrevious },
        reused: saved.value.reused,
      };
    } catch (error) {
      return {
        ok: false,
        code: "validation_error",
        message: error instanceof Error ? error.message : "بيانات مراجعة الميزانية غير صالحة.",
      };
    }
  }

  /** إغلاق موثق بعلة إلزامية — إعادة الإرسال تعيد السجل نفسه بعله الأصلية. */
  async closeBudget(id: string, reason: string): Promise<ExpenseBudgetResult<ExpenseBudgetRecord>> {
    const read = await this.readRecords();
    if (!read.ok) return read;
    const record = read.value.find(candidate => candidate.id === id);
    if (!record) return { ok: false, code: "validation_error", message: "الميزانية المطلوبة غير موجودة." };
    try {
      const closed = closeExpenseBudget(record, { reason, at: this.now() });
      const saved = await this.store.saveExpenseBudget(closed, record);
      if (!saved.ok) return ExpenseBudgetService.storageFailure(saved);
      return { ok: true, value: saved.value.record, reused: saved.value.reused };
    } catch (error) {
      return {
        ok: false,
        code: "validation_error",
        message: error instanceof Error ? error.message : "بيانات إغلاق الميزانية غير صالحة.",
      };
    }
  }

  /** إخفاء الهدف الاختياري — انقلاب علم خالص بدلالة خطة بلا أي أثر مالي. */
  async dismissGoal(id: string): Promise<ExpenseBudgetResult<ExpenseBudgetRecord>> {
    return this.flipGoal(id, dismissGoal);
  }

  /** استعادة الهدف المخفي — الانقلاب الصريح نفسه في الاتجاه المعاكس. */
  async restoreGoal(id: string): Promise<ExpenseBudgetResult<ExpenseBudgetRecord>> {
    return this.flipGoal(id, restoreGoal);
  }

  private async flipGoal(
    id: string,
    flip: (record: ExpenseBudgetRecord) => ExpenseBudgetRecord,
  ): Promise<ExpenseBudgetResult<ExpenseBudgetRecord>> {
    const read = await this.readRecords();
    if (!read.ok) return read;
    const record = read.value.find(candidate => candidate.id === id);
    if (!record) return { ok: false, code: "validation_error", message: "الميزانية المطلوبة غير موجودة." };
    try {
      const flipped = flip(record);
      const saved = await this.store.saveExpenseBudget(flipped, record);
      if (!saved.ok) return ExpenseBudgetService.storageFailure(saved);
      return { ok: true, value: saved.value.record, reused: saved.value.reused };
    } catch (error) {
      return {
        ok: false,
        code: "validation_error",
        message: error instanceof Error ? error.message : "بيانات هدف الميزانية غير صالحة.",
      };
    }
  }
}
