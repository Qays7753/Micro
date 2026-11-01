/**
 * S13 (DOC-022 / UNIT-018 + UNIT-012 — أمر 2158b0fc §6): المتابعة الموحدة
 * «012/018» — قارئ واحد خالص فوق أصحاب المصادر، بلا كاتب ثانٍ ولا مخزن
 * جديد ولا كتابة من الفتح أبدًا (U018-R01/R02/R24، U012-R16، SDF-013):
 *
 *  • مواعيد التسليم — من قراءة المواعيد النقية (scheduleReads) بمصدرها
 *    ونوعها ونسختها؛ لا 00:00 لموعد بلا وقت، ولا تاريخ اليوم للمجهول.
 *  • متابعة العميل — من followUpDate الملوك عند 010 (يُقرأ من سجل الطلب)،
 *    نوع مستقل لا يندمج مع تسليم ولا دفع.
 *  • تحصيل (بيع/طلب) — من CollectionService.listReceivableSources
 *    (005/010) بأهليتها وتوصيفها؛ المبلغ من قراءة مالكه الحية.
 *  • دفعة مورد — من DueDatesService.readPayablesAging (027) بموعد
 *    الاستحقاق المخزن؛ المدفوع جزئيًا يبقى بمتبقيه وتاريخه المسجل.
 *  • سداد مصروف — من ProjectFinancialService.listSettleablePayables (015).
 *  • مراجعة مصروف متكرر — قراءة نقية من سلاسل/دورات 019 المخزنة (بلا
 *    توليد دورات عند القراءة)؛ الدورة غير المؤكدة تذكير لا دينًا (U018-R21)
 *    ومبلغها المقترح موسوم «مقترح».
 *
 * كل مصدر بحالته المستقلة (ready/error) — الفشل يعزل نفسه ولا يخفي السليم
 * ولا يُعرض فراغًا شاملًا (U018-R17/R18)؛ الهوية نوع مصدر+معرف+نوع فعل+
 * معرف موعد/دورة (U018-F01)؛ التصفية والترتيب على المجتمع كله قبل حد
 * العرض مع عدد صادق عند القراءة الجزئية (U018-R16/F14).
 */
import type { PrototypeLocalStore, StoredCraftOrder } from "@/storage/local/types";
/* S13 (حدود OD-10): القارئ فوق أصحاب المصادر يستقبلهم بنيويًا (عدسات قراءة
 * صرفة) — لا زوج بيوت جديد ولا استيراد بين الأبواب؛ الصفحة تركّب العدسات
 * الحية نفسها من أبواب بيوت أصحاب المصادر (U018-B3/B5: تفويض مجرد فوق
 * قرّاء قائمة) — عدسة التسليمات النشطة يركّبها المستدعي من باب الجدولة
 * (activeDeliveryLens) فلا يعرف هذا البيت شيئًا عن بيت الجدولة. */
import { localDateInAmman, isValidLocalDate } from "@micro-domain/shared/index.js";
import { systemClock, type Clock } from "@/application/time/clock";

/** أداة تاريخية صادقة: تاريخ اليوم المحلي (عمّان) يمرر صراحة من المستدعي. */
export type UnifiedToday = string;

export type FollowUpTaskKind =
  | "delivery"
  | "customer_followup"
  | "receivable"
  | "supplier_payable"
  | "expense_payable"
  | "recurring_review";

export type FollowUpTask = {
  /** هوية قراءة ثابتة: نوع مصدر + معرف سجل + نوع فعل + معرف موعد/دورة. */
  itemKey: string;
  taskKind: FollowUpTaskKind;
  /** عنوان الصف من سجل مصدره. */
  title: string;
  party: string | null;
  /** مبلغ بمعناه ودوره — null حين لا معنى نقديًا للصف؛ المقترح موسوم. */
  amountMinor: number | null;
  amountRole: string | null;
  amountProposed: boolean;
  /** موعد المهمة من نوعها — null = «لم يحدد موعدها»؛ التالف يُعلن لا يُبدل. */
  dueOn: string | null;
  dateState: "overdue" | "today" | "upcoming" | "none" | "invalid";
  /** وقت معلوم من 012 حيث وجد — بلا افتراض 00:00. */
  scheduledTime: string | null;
  /** يفتح صاحب الفعل بمصدره — لا يكتب شيئًا. */
  sourceHref: string;
  sourceKind: "schedule" | "order" | "direct_sale" | "supplier_purchase" | "financial_event" | "recurring";
  sourceId: string;
  /** معرف الموعد/الدورة حيث ينطبق — يميز المهام المتعددة للسجل نفسه. */
  occurrenceId: string | null;
};

export type FollowUpSourceState =
  { state: "ready"; tasks: readonly FollowUpTask[] } | { state: "error"; message: string };

export type UnifiedFollowUpReading = {
  sources: Readonly<Record<FollowUpSourceKey, FollowUpSourceState>>;
  /** يوم المرجع المحلي المعلن للقراءة — يعاد التصنيف عنده لا عندها. */
  asOf: UnifiedToday;
};

export type FollowUpSourceKey =
  | "schedules"
  | "customerFollowUps"
  | "receivables"
  | "supplierPayables"
  | "expensePayables"
  | "recurringReviews";

export type UnifiedFollowUpResult =
  { ok: true; value: UnifiedFollowUpReading } | { ok: false; code: "storage_error"; message: string };

/** عدسة القراءة — قائمة الطلبات النقية لمتابعة العميل (010)؛ التسليمات
 * تصل عبر عدستها البنيوية أعلاه لا عبر تعدية بيوت. */
export type UnifiedFollowUpStore = Pick<PrototypeLocalStore, "listOrders">;

/** عدسات القراءة البنيوية فوق أصحاب المصادر — لا أزواج بيوت جديدة. */

/** صف تسليم نشط كما يستقبله هذا القارئ — حقول محايدة يشبعها باب الجدولة. */
export type ActiveDeliveryRow = {
  scheduleId: string;
  orderId: string;
  itemName: string;
  customerName: string | null;
  scheduledFor: string;
  scheduledTime: string | null;
};

/** عدسة مواعيد التسليم النشطة (012/010) — قراءة خالصة بلا كتابة أبدًا. */
export type ActiveDeliveriesReader = {
  listActiveDeliveries: () => Promise<
    { ok: true; value: readonly ActiveDeliveryRow[] } | { ok: false; message: string }
  >;
};

export type ReceivablesReader = {
  listReceivableSources: () => Promise<
    { ok: true; value: readonly ReceivableSourceLike[] } | { ok: false; message: string }
  >;
};
export type PayablesAgingReader = {
  readPayablesAging: () => Promise<
    { ok: true; value: { rows: readonly PayableRowLike[] } } | { ok: false; message: string }
  >;
};
export type SettleablePayablesReader = {
  listSettleablePayables: () => Promise<
    | { ok: true; value: readonly { event: SettleableEventLike; remainingMinor: number }[] }
    | { ok: false; message: string }
  >;
};

export class UnifiedFollowUpService {
  constructor(
    private readonly deliveries: ActiveDeliveriesReader,
    private readonly store: UnifiedFollowUpStore,
    private readonly collections: ReceivablesReader,
    private readonly dueDates: PayablesAgingReader,
    private readonly projectFinance: SettleablePayablesReader,
    private readonly recurringStore: Pick<
      PrototypeLocalStore,
      "listRecurringExpenseSeries" | "listRecurringExpenseRevisions" | "listRecurringExpenseOccurrences"
    >,
    private readonly now: Clock = systemClock,
  ) {}

  /** القراءة الموحدة — كل مصدر مستقل؛ فشله يعزل نفسه ولا يمس البقية. */
  async read(): Promise<UnifiedFollowUpResult> {
    const asOf = localDateInAmman(this.now());
    const [schedules, customerFollowUps, receivables, supplierPayables, expensePayables, recurring] =
      await Promise.all([
        this.deliveries.listActiveDeliveries().then(result =>
          result.ok
            ? ({
                state: "ready",
                tasks: result.value.map(row => deliveryTask(row, asOf)),
              } as FollowUpSourceState)
            : ({ state: "error", message: result.message } as FollowUpSourceState),
        ),
        this.store
          .listOrders()
          .then(result =>
            result.ok
              ? ({ state: "ready", tasks: followUpTasks(result.value, asOf) } as FollowUpSourceState)
              : ({ state: "error", message: result.message } as FollowUpSourceState),
          ),
        this.collections
          .listReceivableSources()
          .then(result =>
            result.ok
              ? ({ state: "ready", tasks: result.value.map(receivableTask) } as FollowUpSourceState)
              : ({ state: "error", message: result.message } as FollowUpSourceState),
          ),
        this.dueDates.readPayablesAging().then(result =>
          result.ok
            ? ({
                state: "ready",
                tasks: result.value.rows.map(row => supplierPayableTask(row, asOf)),
              } as FollowUpSourceState)
            : ({ state: "error", message: result.message } as FollowUpSourceState),
        ),
        this.projectFinance.listSettleablePayables().then(result =>
          result.ok
            ? ({
                state: "ready",
                tasks: result.value.map(({ event, remainingMinor }) =>
                  expensePayableTask(event, remainingMinor),
                ),
              } as FollowUpSourceState)
            : ({ state: "error", message: result.message } as FollowUpSourceState),
        ),
        readRecurringReviews(this.recurringStore, asOf),
      ]);
    return {
      ok: true,
      value: {
        asOf,
        sources: {
          schedules,
          customerFollowUps,
          receivables,
          supplierPayables,
          expensePayables,
          recurringReviews: recurring,
        },
      },
    };
  }
}

/* ─── إسقاطات المصادر — قراءة فقط، بلا أي كتابة ─── */

function deliveryTask(row: ActiveDeliveryRow, today: UnifiedToday): FollowUpTask {
  return {
    itemKey: `schedule:${row.scheduleId}:delivery`,
    taskKind: "delivery",
    title: row.itemName || "موعد تسليم",
    party: row.customerName,
    amountMinor: null,
    amountRole: null,
    amountProposed: false,
    dueOn: row.scheduledFor,
    dateState: isValidLocalDate(row.scheduledFor) ? bucketOf(row.scheduledFor, today) : ("invalid" as const),
    scheduledTime: row.scheduledTime,
    sourceHref: `/orders/${row.orderId}`,
    sourceKind: "schedule",
    sourceId: row.orderId,
    occurrenceId: row.scheduleId,
  };
}

function followUpTasks(orders: readonly StoredCraftOrder[], today: UnifiedToday): readonly FollowUpTask[] {
  const tasks: FollowUpTask[] = [];
  for (const stored of orders) {
    if (["cancelled"].includes(stored.order.status)) continue;
    if (!stored.followUpDate) continue;
    tasks.push({
      itemKey: `order:${stored.id}:customer_followup`,
      taskKind: "customer_followup",
      title: stored.order.itemName || "متابعة عميل",
      party: stored.order.customerName || null,
      amountMinor: null,
      amountRole: null,
      amountProposed: false,
      dueOn: stored.followUpDate,
      dateState: isValidLocalDate(stored.followUpDate)
        ? bucketOf(stored.followUpDate, today)
        : ("invalid" as const),
      scheduledTime: null,
      sourceHref: `/orders/${stored.id}`,
      sourceKind: "order",
      sourceId: stored.id,
      occurrenceId: null,
    });
  }
  return tasks;
}

type ReceivableSourceLike = {
  id: string;
  kind: "order" | "direct_sale";
  personName: string;
  itemName: string;
  outstandingMinor: number;
  qualifier: string | null;
  sourceHref: string;
};

function receivableTask(source: ReceivableSourceLike): FollowUpTask {
  return {
    itemKey: `${source.kind}:${source.id}:receivable`,
    taskKind: "receivable",
    title: source.itemName || "تحصيل مستحق",
    party: source.personName,
    amountMinor: source.outstandingMinor,
    amountRole: "المتبقي على العميل",
    amountProposed: false,
    dueOn: null,
    dateState: "none",
    scheduledTime: null,
    sourceHref: source.sourceHref,
    sourceKind: source.kind,
    sourceId: source.id,
    occurrenceId: null,
  };
}

type PayableRowLike = {
  purchaseId: string;
  supplierName: string | null;
  payableMinor: number;
  dueOn: string | null;
  /** حالة التاريخ من مالكها (DueDatesService) — تصنيف المصدر لا إعادة حساب. */
  dueState: "overdue" | "today" | "upcoming" | "none" | "invalid";
};

function supplierPayableTask(row: PayableRowLike, today: UnifiedToday): FollowUpTask {
  return {
    itemKey: `supplier_purchase:${row.purchaseId}:payable`,
    taskKind: "supplier_payable",
    title: "دفعة لمورد",
    party: row.supplierName,
    amountMinor: row.payableMinor,
    amountRole: "المتبقي للمورد",
    amountProposed: false,
    dueOn: row.dueOn,
    dateState:
      row.dueOn !== null && !isValidLocalDate(row.dueOn)
        ? ("invalid" as const)
        : row.dueState === "none" && row.dueOn !== null
          ? bucketOf(row.dueOn, today)
          : row.dueState,
    scheduledTime: null,
    sourceHref: `/suppliers/purchase/${row.purchaseId}`,
    sourceKind: "supplier_purchase",
    sourceId: row.purchaseId,
    occurrenceId: null,
  };
}

type SettleableEventLike = { id: string; note: string | null };

function expensePayableTask(event: SettleableEventLike, remainingMinor: number): FollowUpTask {
  return {
    itemKey: `financial_event:${event.id}:expense_payable`,
    taskKind: "expense_payable",
    title: event.note || "سداد مصروف مستحق",
    party: null,
    amountMinor: remainingMinor,
    amountRole: "المتبقي من المصروف",
    amountProposed: false,
    dueOn: null,
    dateState: "none",
    scheduledTime: null,
    sourceHref: `/finance?event=${event.id}`,
    sourceKind: "financial_event",
    sourceId: event.id,
    occurrenceId: null,
  };
}

type RecurringExpenseRuleRevisionLike = {
  seriesId: string;
  revision: number;
  /** المبلغ المقترح للدورة (fixed_suggested إلزامي؛ suggested اختياري؛ manual محظور null). */
  suggestedAmountMinor?: number | null;
};

/* قراءة نقية لتذكيرات 019: السلاسل المخزنة ودوراتها المفتوحة فقط — بلا
 * توليد دورات عند القراءة (المرشحات تُشتق عند مالكها بفعله الصريح)؛
 * الدورة غير المؤكدة تذكير بمبلغ مقترح موسوم لا دينًا (U018-R21/F05). */
async function readRecurringReviews(
  store: Pick<
    PrototypeLocalStore,
    "listRecurringExpenseSeries" | "listRecurringExpenseRevisions" | "listRecurringExpenseOccurrences"
  >,
  today: UnifiedToday,
): Promise<FollowUpSourceState> {
  try {
    const [seriesResult, revisionsResult, occurrencesResult] = await Promise.all([
      store.listRecurringExpenseSeries(),
      store.listRecurringExpenseRevisions(),
      store.listRecurringExpenseOccurrences(),
    ]);
    if (!seriesResult.ok) return { state: "error", message: seriesResult.message };
    if (!revisionsResult.ok) return { state: "error", message: revisionsResult.message };
    if (!occurrencesResult.ok) return { state: "error", message: occurrencesResult.message };
    const latestRevision = new Map<string, RecurringExpenseRuleRevisionLike>();
    for (const revision of revisionsResult.value) {
      const current = latestRevision.get(revision.seriesId);
      if (current === undefined || revision.revision > current.revision)
        latestRevision.set(revision.seriesId, revision);
    }
    const tasks: FollowUpTask[] = [];
    for (const series of seriesResult.value) {
      const open = occurrencesResult.value.filter(
        occurrence =>
          occurrence.seriesId === series.id &&
          (occurrence.status === "planned" ||
            occurrence.status === "snoozed" ||
            occurrence.status === "recording"),
      );
      if (open.length === 0) continue;
      const revision = latestRevision.get(series.id);
      const proposedMinor = revision?.suggestedAmountMinor ?? null;
      open.sort((left, right) =>
        (left.snoozedUntil ?? left.dueOn).localeCompare(right.snoozedUntil ?? right.dueOn),
      );
      const earliest = open[0]!;
      tasks.push({
        itemKey: `recurring:${series.id}:review:${earliest.id}`,
        taskKind: "recurring_review",
        title: "مراجعة مصروف متكرر",
        party: null,
        amountMinor: proposedMinor,
        amountRole: proposedMinor !== null ? "مقترح الدورة — ليس دينًا" : null,
        amountProposed: true,
        dueOn: isValidLocalDate(earliest.snoozedUntil ?? earliest.dueOn)
          ? (earliest.snoozedUntil ?? earliest.dueOn)
          : null,
        dateState: isValidLocalDate(earliest.snoozedUntil ?? earliest.dueOn)
          ? bucketOf(earliest.snoozedUntil ?? earliest.dueOn, today)
          : ("invalid" as const),
        scheduledTime: null,
        sourceHref: `/finance/recurring/${series.id}`,
        sourceKind: "recurring",
        sourceId: series.id,
        occurrenceId: earliest.id,
      });
    }
    return { state: "ready", tasks };
  } catch (error) {
    return { state: "error", message: error instanceof Error ? error.message : "تعذرت قراءة الدورات." };
  }
}

function bucketOf(date: string, today: UnifiedToday): "overdue" | "today" | "upcoming" {
  if (date < today) return "overdue";
  if (date === today) return "today";
  return "upcoming";
}

/* ─── الإسقاط المشترك: التجميع والتصفية والترتيب — فوق المجتمع كله ─── */

export type FollowUpGroup = "overdue" | "today" | "upcoming" | "undated" | "invalid";

export type FollowUpFilter = {
  /** الكل، أو نوع مهمة واحدة — تقنية العائلات لا تُعرض للمستخدم. */
  taskKind: FollowUpTaskKind | "all";
  /** فترة مخصصة على موعد المهمة (from ≤ to)؛ null = الكل. */
  period: { from: string; to: string } | null;
};

export type FollowUpProjection = {
  groups: ReadonlyArray<{ group: FollowUpGroup; tasks: readonly FollowUpTask[] }>;
  /** عدد المهام الجاهزة المقروءة قبل حد العرض — صادق عند القراءة الجزئية. */
  readyTaskCount: number;
  errorSources: ReadonlyArray<{ key: FollowUpSourceKey; message: string }>;
};

/** التجميع والتصفية والترتيب على المجتمع كله قبل أي حد عرض (U018-R14/R16). */
export function projectFollowUp(reading: UnifiedFollowUpReading, filter: FollowUpFilter): FollowUpProjection {
  const overdue: FollowUpTask[] = [];
  const today: FollowUpTask[] = [];
  const upcoming: FollowUpTask[] = [];
  const undated: FollowUpTask[] = [];
  const invalid: FollowUpTask[] = [];
  const errorSources: Array<{ key: FollowUpSourceKey; message: string }> = [];
  let readyTaskCount = 0;
  const today2 = reading.asOf;
  for (const key of Object.keys(reading.sources) as FollowUpSourceKey[]) {
    const source = reading.sources[key];
    if (source.state === "error") {
      errorSources.push({ key, message: source.message });
      continue;
    }
    for (const task of source.tasks) {
      readyTaskCount += 1;
      if (filter.taskKind !== "all" && task.taskKind !== filter.taskKind) continue;
      if (filter.period !== null) {
        /* بلا موعد لا يدخل فترة مخصصة خفية — مدخله المستقل يبقى ظاهرًا. */
        if (task.dueOn === null || !isValidLocalDate(task.dueOn)) continue;
        if (task.dueOn < filter.period.from || task.dueOn > filter.period.to) continue;
      }
      if (task.dateState === "invalid") invalid.push(task);
      else if (task.dueOn === null) undated.push(task);
      else if (task.dueOn < today2) overdue.push(task);
      else if (task.dueOn === today2) today.push(task);
      else upcoming.push(task);
    }
  }
  const byDateThenTimeThenKey = (left: FollowUpTask, right: FollowUpTask) => {
    const date = (left.dueOn ?? "").localeCompare(right.dueOn ?? "");
    if (date !== 0) return date;
    const time = (left.scheduledTime ?? "9999").localeCompare(right.scheduledTime ?? "9999");
    if (time !== 0) return time;
    return left.itemKey.localeCompare(right.itemKey);
  };
  overdue.sort(byDateThenTimeThenKey);
  today.sort(byDateThenTimeThenKey);
  upcoming.sort(byDateThenTimeThenKey);
  undated.sort((left, right) => left.itemKey.localeCompare(right.itemKey));
  invalid.sort((left, right) => left.itemKey.localeCompare(right.itemKey));
  return {
    groups: [
      { group: "overdue", tasks: overdue },
      { group: "today", tasks: today },
      { group: "upcoming", tasks: upcoming },
      { group: "undated", tasks: undated },
      { group: "invalid", tasks: invalid },
    ],
    readyTaskCount,
    errorSources,
  };
}
