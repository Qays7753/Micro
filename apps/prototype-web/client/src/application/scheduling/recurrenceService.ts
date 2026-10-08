/**
 * G6-B local recurrence: creates a bounded set of independent delivery schedules.
 * It never creates orders, agreements, reminders, or financial effects.
 */
import { localDateInAmman } from "@micro-domain/shared/index.js";
import type {
  PrototypeLocalStore,
  ScheduleEntry,
  ScheduleRecurrence,
  ScheduleRecurrenceFrequency,
  StoredCraftOrder,
} from "@/storage/local/types";
import type { ScheduleStore } from "@/storage/local/capabilities/scheduleStore";

/** R3 (R3-SC-08): عدسة الخدمة — التكرارات مع جدولاتها وقراءة الطلبات. */
export type RecurrenceServiceStore = Pick<
  ScheduleStore,
  "listSchedules" | "getSchedule" | "listRecurrences" | "getRecurrence" | "commitRecurrence"
> &
  Pick<PrototypeLocalStore, "listOrders">;
import { storageFailureCode } from "@/storage/local/types";
import {
  NOT_FOUND,
  STORAGE_ERROR,
  VALIDATION_ERROR,
  notFoundFailure,
  storageFailure,
  validationFailure,
} from "@/application/resultCodes";
import { systemClock, type Clock } from "@/application/time/clock";
import {
  isValidLocalDate,
  localDatePlusDays,
  localDatePlusMonthsClamped,
} from "@micro-domain/shared/index.js";

export type RecurrenceInput = {
  sourceScheduleId: string;
  frequency: ScheduleRecurrenceFrequency;
  occurrenceCount: number;
};
export type RecurrenceSkip = { date: string; reason: "existing_schedule" };
export type RecurrenceCreateResult = {
  recurrence: ScheduleRecurrence;
  created: readonly ScheduleEntry[];
  skipped: readonly RecurrenceSkip[];
};
export type RecurrenceView = {
  recurrence: ScheduleRecurrence;
  source: ScheduleEntry | null;
  order: StoredCraftOrder | null;
  appearances: readonly ScheduleEntry[];
};
export type RecurrenceResult<T> =
  | { ok: true; value: T }
  | {
      ok: false;
      code: "validation_error" | "storage_error" | "storage_stale" | "not_found";
      message: string;
    };

/* رقعة إغلاق المجموعة ٢ (مراجعة مستقلة): تعارض التكرار/الإيقاف يصل كودًا
 * مطبوعًا storage_stale (أعد الفتح ثم أعد المحاولة) والفشل الحقيقي يبقى
 * storage_error — بلا تفسير نصوص عربية من المستدعين. التصنيف المشترك في
 * طبقة التخزين (`storageFailureCode`). */

const isActiveSchedule = (schedule: ScheduleEntry) =>
  schedule.status === "scheduled" || schedule.status === "postponed";
const isActiveOrder = (order: StoredCraftOrder) =>
  !["delivered", "settled", "cancelled"].includes(order.order.status);
/* المجموعة ٩ (STR-029): مفتاح اليوم من وحدة وقت الأعمال الكنسية —
 * كانت نسخة محلية بلا حارس مدخل؛ متغيّر الرمي لمدخلات موثوقة الإنشاء. */
const localDateKey = localDateInAmman;
/* R2 (M-02/X1، 2026-10-08): الصلاحية من نواة المجال الكنسية — كانت مرساة
 * ظهر مكررة (HOSTILE-01: addMonthsClamped العددية كانت تعيد السنوات < 0100
 * إلى 1950+ فتخزّن تواريخ مولّدة خاطئة). */
const validDate = (value: string) => isValidLocalDate(value);
const validFrequency = (value: string): value is ScheduleRecurrenceFrequency =>
  value === "weekly" || value === "monthly";
const validCount = (value: number) => Number.isInteger(value) && value >= 1 && value <= 12;

/* R2 (M-02/X1، 2026-10-08): إزاحة الأيام والشهور من نواة الحساب الخالص.
 * المدخل مُتحقق مسبقًا (validDate قبل التوليد)؛ حد التمثيل خارج 0000–9999
 * يعود null فيرفض التوليد الصادق بدل تخزين سلسلة موسعة مهملة. */
function nextDate(source: string, frequency: ScheduleRecurrenceFrequency, index: number): string | null {
  return frequency === "weekly"
    ? localDatePlusDays(source, index * 7)
    : localDatePlusMonthsClamped(source, index);
}

function buildAppearance(
  recurrence: ScheduleRecurrence,
  source: ScheduleEntry,
  index: number,
  timestamp: string,
): ScheduleEntry {
  const scheduledFor = nextDate(source.scheduledFor, recurrence.frequency, index);
  if (scheduledFor === null)
    throw new Error("تاريخ الموعد المولّد خارج النطاق القابل للتمثيل؛ راجع تاريخ المصدر.");
  return {
    id: `${recurrence.id}:${index}`,
    orderId: recurrence.orderId,
    kind: "delivery",
    scheduledFor,
    scheduledTime: source.scheduledTime,
    durationMinutes: source.durationMinutes,
    status: "scheduled",
    postponeReason: null,
    events: [
      {
        id: `${recurrence.id}:${index}:created`,
        type: "created",
        idempotencyKey: `${recurrence.id}:${index}:${scheduledFor}`,
        createdAt: timestamp,
        previousScheduledFor: null,
        scheduledFor,
        previousScheduledTime: null,
        scheduledTime: source.scheduledTime,
        previousDurationMinutes: null,
        durationMinutes: source.durationMinutes,
        reason: "موعد قادم من قالب تكرار محلي",
      },
    ],
    recurrenceId: recurrence.id,
    recurrenceIndex: index,
    createdAt: timestamp,
    updatedAt: timestamp,
  };
}

export class ScheduleRecurrenceService {
  constructor(
    private readonly store: RecurrenceServiceStore,
    private readonly now: Clock = systemClock,
  ) {}

  async list(): Promise<RecurrenceResult<readonly RecurrenceView[]>> {
    const [recurrences, schedules, orders] = await Promise.all([
      this.store.listRecurrences(),
      this.store.listSchedules(),
      this.store.listOrders(),
    ]);
    if (!recurrences.ok || !schedules.ok || !orders.ok)
      return storageFailure("تعذر قراءة قوالب التكرار المحلية.");
    const scheduleById = new Map(schedules.value.map(schedule => [schedule.id, schedule]));
    const orderById = new Map(orders.value.map(order => [order.id, order]));
    return {
      ok: true,
      value: recurrences.value.map(recurrence => ({
        recurrence,
        source: scheduleById.get(recurrence.sourceScheduleId) ?? null,
        order: orderById.get(recurrence.orderId) ?? null,
        appearances: schedules.value
          .filter(schedule => schedule.recurrenceId === recurrence.id)
          .sort((left, right) => (left.recurrenceIndex ?? 0) - (right.recurrenceIndex ?? 0)),
      })),
    };
  }

  async create(input: RecurrenceInput): Promise<RecurrenceResult<RecurrenceCreateResult>> {
    if (
      !input.sourceScheduleId.trim() ||
      !validFrequency(input.frequency) ||
      !validCount(input.occurrenceCount)
    )
      return validationFailure(
        "اختر موعدًا قائمًا، وتكرارًا أسبوعيًا أو شهريًا، وعدد مواعيد قادمة من 1 إلى 12.",
      );
    const [sourceResult, schedulesResult, ordersResult, recurrencesResult] = await Promise.all([
      this.store.getSchedule(input.sourceScheduleId),
      this.store.listSchedules(),
      this.store.listOrders(),
      this.store.listRecurrences(),
    ]);
    if (!sourceResult.ok || !schedulesResult.ok || !ordersResult.ok || !recurrencesResult.ok)
      return storageFailure("تعذر قراءة بيانات التكرار المحلية.");
    if (!sourceResult.value) return notFoundFailure("الموعد المصدر غير متاح محليًا؛ لم يُنشأ قالب.");
    const source = sourceResult.value;
    const order = ordersResult.value.find(candidate => candidate.id === source.orderId);
    if (!order) return notFoundFailure("الطلب المرتبط بالموعد غير متاح؛ لم يُنشأ قالب.");
    /* المجموعة ٩ (STR-029): مفتاح اليوم الحالي من وحدة وقت الأعمال الكنسية. */
    const todayKey = localDateInAmman(this.now());
    if (!validDate(source.scheduledFor) || source.scheduledFor < todayKey)
      return validationFailure("لا يمكن إنشاء تكرار من موعد ماضٍ؛ راجع الموعد أولًا.");
    if (!isActiveSchedule(source) || !isActiveOrder(order))
      return validationFailure("لا يمكن تكرار موعد غير نشط أو طلب مغلق؛ لم يتغير أي سجل.");
    const id = `recurrence-${source.id}-${input.frequency}-${input.occurrenceCount}`;
    const existing = recurrencesResult.value.find(recurrence => recurrence.id === id);
    if (existing) {
      return {
        ok: true,
        value: {
          recurrence: existing,
          created: [],
          skipped: Array.from({ length: existing.occurrenceCount }, (_, index) => ({
            date: nextDate(source.scheduledFor, existing.frequency, index + 1) ?? source.scheduledFor,
            reason: "existing_schedule" as const,
          })),
        },
      };
    }
    const timestamp = this.now();
    const recurrence: ScheduleRecurrence = {
      id,
      sourceScheduleId: source.id,
      orderId: source.orderId,
      frequency: input.frequency,
      occurrenceCount: input.occurrenceCount,
      status: "active",
      idempotencyKey: id,
      cancelledAt: null,
      cancellationReason: null,
      createdAt: timestamp,
      updatedAt: timestamp,
    };
    const existingDates = new Set(
      schedulesResult.value
        .filter(schedule => schedule.orderId === source.orderId)
        .map(schedule => schedule.scheduledFor),
    );
    const created: ScheduleEntry[] = [];
    const skipped: RecurrenceSkip[] = [];
    for (let index = 1; index <= input.occurrenceCount; index += 1) {
      const date = nextDate(source.scheduledFor, input.frequency, index);
      if (date === null)
        return validationFailure("تاريخ موعد مولّد خارج النطاق القابل للتمثيل؛ قلّل عدد التكرارات.");
      if (existingDates.has(date)) {
        skipped.push({ date, reason: "existing_schedule" });
        continue;
      }
      const appearance = buildAppearance(recurrence, source, index, timestamp);
      created.push(appearance);
      existingDates.add(date);
    }
    const committed = await this.store.commitRecurrence(recurrence, created);
    if (!committed.ok)
      return {
        ok: false,
        code: storageFailureCode(committed.code),
        /* رسالة المتجر الصادقة كما هي — عقد الفشل يوجب رسالة غير فارغة. */
        message: committed.message,
      };
    return {
      ok: true,
      value: { recurrence: committed.value.recurrence, created: committed.value.schedules, skipped },
    };
  }

  async cancel(id: string, reason: string): Promise<RecurrenceResult<ScheduleRecurrence>> {
    if (!reason.trim()) return validationFailure("اكتب سببًا مختصرًا لإيقاف المواعيد القادمة.");
    const current = await this.store.getRecurrence(id);
    if (!current.ok) return storageFailure("تعذر قراءة قالب التكرار المحلي.");
    if (!current.value) return notFoundFailure("قالب التكرار غير متاح محليًا.");
    if (current.value.status === "cancelled") return { ok: true, value: current.value };
    const timestamp = this.now();
    const cancellationReason = reason.trim();
    const today = localDateKey(timestamp);
    const schedules = await this.store.listSchedules();
    if (!schedules.ok) return storageFailure("تعذر قراءة مواعيد التكرار القادمة محليًا.");
    /* المجموعة ٢ (التحصين الكامل — HIGH-001): تُمرَّر المواعيد المتأثرة
     * وحدها — لا الجدول كاملًا — فيتحقق الالتزام من كل واحد على حالته الحية
     * ولا يعيد كتابة مواعيد لم يمسها القرار فوق تغييرات مسار آخر. */
    const affected = schedules.value
      .filter(
        schedule =>
          schedule.recurrenceId === id &&
          schedule.scheduledFor > today &&
          isActiveSchedule(schedule) &&
          !schedule.events.some(event => event.idempotencyKey === `${schedule.id}:cancelled:${id}`),
      )
      .map(schedule => ({
        ...schedule,
        status: "cancelled" as const,
        postponeReason: cancellationReason,
        updatedAt: timestamp,
        events: [
          ...schedule.events,
          {
            id: `${schedule.id}:cancelled:${schedule.events.length + 1}`,
            type: "cancelled" as const,
            idempotencyKey: `${schedule.id}:cancelled:${id}`,
            createdAt: timestamp,
            previousScheduledFor: schedule.scheduledFor,
            scheduledFor: schedule.scheduledFor,
            previousScheduledTime: schedule.scheduledTime,
            scheduledTime: schedule.scheduledTime,
            previousDurationMinutes: schedule.durationMinutes,
            durationMinutes: schedule.durationMinutes,
            reason: `إلغاء قالب التكرار: ${cancellationReason}`,
          },
        ],
      }));
    const cancelled: ScheduleRecurrence = {
      ...current.value,
      status: "cancelled",
      cancelledAt: timestamp,
      cancellationReason,
      updatedAt: timestamp,
    };
    const saved = await this.store.commitRecurrence(cancelled, affected);
    return saved.ok
      ? { ok: true, value: saved.value.recurrence }
      : {
          ok: false,
          code: storageFailureCode(saved.code),
          /* رسالة المتجر الصادقة كما هي — عقد الفشل يوجب رسالة غير فارغة. */
          message: saved.message,
        };
  }
}
