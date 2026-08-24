/**
 * G6-B local recurrence: creates a bounded set of independent delivery schedules.
 * It never creates orders, agreements, reminders, or financial effects.
 */
import type { PrototypeLocalStore, ScheduleEntry, ScheduleRecurrence, ScheduleRecurrenceFrequency, StoredCraftOrder } from "@/storage/local/types";

export type RecurrenceInput = { sourceScheduleId: string; frequency: ScheduleRecurrenceFrequency; occurrenceCount: number };
export type RecurrenceSkip = { date: string; reason: "existing_schedule" };
export type RecurrenceCreateResult = { recurrence: ScheduleRecurrence; created: readonly ScheduleEntry[]; skipped: readonly RecurrenceSkip[] };
export type RecurrenceView = { recurrence: ScheduleRecurrence; source: ScheduleEntry | null; order: StoredCraftOrder | null; appearances: readonly ScheduleEntry[] };
export type RecurrenceResult<T> = { ok: true; value: T } | { ok: false; code: "validation_error" | "storage_error" | "not_found"; message: string };

const isActiveSchedule = (schedule: ScheduleEntry) => schedule.status === "scheduled" || schedule.status === "postponed";
const isActiveOrder = (order: StoredCraftOrder) => !["delivered", "settled", "cancelled"].includes(order.order.status);
const localDateKey = (iso: string) => {
  const parts = new Intl.DateTimeFormat("en", { timeZone: "Asia/Amman", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date(iso));
  const value = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value ?? "";
  return `${value("year")}-${value("month")}-${value("day")}`;
};
const validDate = (value: string) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T12:00:00.000Z`);
  return !Number.isNaN(parsed.valueOf()) && parsed.toISOString().slice(0, 10) === value;
};
const validFrequency = (value: string): value is ScheduleRecurrenceFrequency => value === "weekly" || value === "monthly";
const validCount = (value: number) => Number.isInteger(value) && value >= 1 && value <= 12;

function addDays(date: string, days: number) {
  const result = new Date(`${date}T12:00:00.000Z`);
  result.setUTCDate(result.getUTCDate() + days);
  return result.toISOString().slice(0, 10);
}

function addMonthsClamped(date: string, months: number) {
  const original = new Date(`${date}T12:00:00.000Z`);
  const year = original.getUTCFullYear();
  const month = original.getUTCMonth() + months;
  const day = original.getUTCDate();
  const lastDay = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  return new Date(Date.UTC(year, month, Math.min(day, lastDay))).toISOString().slice(0, 10);
}

function nextDate(source: string, frequency: ScheduleRecurrenceFrequency, index: number) {
  return frequency === "weekly" ? addDays(source, index * 7) : addMonthsClamped(source, index);
}

function buildAppearance(recurrence: ScheduleRecurrence, source: ScheduleEntry, index: number, timestamp: string): ScheduleEntry {
  const scheduledFor = nextDate(source.scheduledFor, recurrence.frequency, index);
  return {
    id: `${recurrence.id}:${index}`,
    orderId: recurrence.orderId,
    kind: "delivery",
    scheduledFor,
    scheduledTime: source.scheduledTime,
    durationMinutes: source.durationMinutes,
    status: "scheduled",
    postponeReason: null,
    events: [{ id: `${recurrence.id}:${index}:created`, type: "created", idempotencyKey: `${recurrence.id}:${index}:${scheduledFor}`, createdAt: timestamp, previousScheduledFor: null, scheduledFor, previousScheduledTime: null, scheduledTime: source.scheduledTime, previousDurationMinutes: null, durationMinutes: source.durationMinutes, reason: "ظهور من قالب تكرار محلي" }],
    recurrenceId: recurrence.id,
    recurrenceIndex: index,
    createdAt: timestamp,
    updatedAt: timestamp,
  };
}

export class ScheduleRecurrenceService {
  constructor(private readonly store: PrototypeLocalStore, private readonly now: () => string = () => new Date().toISOString()) {}

  async list(): Promise<RecurrenceResult<readonly RecurrenceView[]>> {
    const [recurrences, schedules, orders] = await Promise.all([this.store.listRecurrences(), this.store.listSchedules(), this.store.listOrders()]);
    if (!recurrences.ok || !schedules.ok || !orders.ok) return { ok: false, code: "storage_error", message: "تعذر قراءة قوالب التكرار المحلية." };
    const scheduleById = new Map(schedules.value.map((schedule) => [schedule.id, schedule]));
    const orderById = new Map(orders.value.map((order) => [order.id, order]));
    return { ok: true, value: recurrences.value.map((recurrence) => ({ recurrence, source: scheduleById.get(recurrence.sourceScheduleId) ?? null, order: orderById.get(recurrence.orderId) ?? null, appearances: schedules.value.filter((schedule) => schedule.recurrenceId === recurrence.id).sort((left, right) => (left.recurrenceIndex ?? 0) - (right.recurrenceIndex ?? 0)) })) };
  }

  async create(input: RecurrenceInput): Promise<RecurrenceResult<RecurrenceCreateResult>> {
    if (!input.sourceScheduleId.trim() || !validFrequency(input.frequency) || !validCount(input.occurrenceCount)) return { ok: false, code: "validation_error", message: "اختر موعدًا قائمًا، وتكرارًا أسبوعيًا أو شهريًا، وعدد ظهورات من 1 إلى 12." };
    const [sourceResult, schedulesResult, ordersResult, recurrencesResult] = await Promise.all([this.store.getSchedule(input.sourceScheduleId), this.store.listSchedules(), this.store.listOrders(), this.store.listRecurrences()]);
    if (!sourceResult.ok || !schedulesResult.ok || !ordersResult.ok || !recurrencesResult.ok) return { ok: false, code: "storage_error", message: "تعذر قراءة بيانات التكرار المحلية." };
    if (!sourceResult.value) return { ok: false, code: "not_found", message: "الموعد المصدر غير متاح محليًا؛ لم يُنشأ قالب." };
    const source = sourceResult.value;
    const order = ordersResult.value.find((candidate) => candidate.id === source.orderId);
    if (!order) return { ok: false, code: "not_found", message: "الطلب المرتبط بالموعد غير متاح؛ لم يُنشأ قالب." };
    const today = new Intl.DateTimeFormat("en", { timeZone: "Asia/Amman", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date(this.now())).reduce<Record<string, string>>((result, part) => { result[part.type] = part.value; return result; }, {});
    const todayKey = `${today.year}-${today.month}-${today.day}`;
    if (!validDate(source.scheduledFor) || source.scheduledFor < todayKey) return { ok: false, code: "validation_error", message: "لا يمكن إنشاء تكرار من موعد ماضٍ؛ راجع الموعد أولًا." };
    if (!isActiveSchedule(source) || !isActiveOrder(order)) return { ok: false, code: "validation_error", message: "لا يمكن تكرار موعد غير نشط أو طلب مغلق؛ لم يتغير أي سجل." };
    const id = `recurrence-${source.id}-${input.frequency}-${input.occurrenceCount}`;
    const existing = recurrencesResult.value.find((recurrence) => recurrence.id === id);
    if (existing) {
      return { ok: true, value: { recurrence: existing, created: [], skipped: Array.from({ length: existing.occurrenceCount }, (_, index) => ({ date: nextDate(source.scheduledFor, existing.frequency, index + 1), reason: "existing_schedule" as const })) } };
    }
    const timestamp = this.now();
    const recurrence: ScheduleRecurrence = { id, sourceScheduleId: source.id, orderId: source.orderId, frequency: input.frequency, occurrenceCount: input.occurrenceCount, status: "active", idempotencyKey: id, cancelledAt: null, cancellationReason: null, createdAt: timestamp, updatedAt: timestamp };
    const existingDates = new Set(schedulesResult.value.filter((schedule) => schedule.orderId === source.orderId).map((schedule) => schedule.scheduledFor));
    const created: ScheduleEntry[] = [];
    const skipped: RecurrenceSkip[] = [];
    for (let index = 1; index <= input.occurrenceCount; index += 1) {
      const date = nextDate(source.scheduledFor, input.frequency, index);
      if (existingDates.has(date)) { skipped.push({ date, reason: "existing_schedule" }); continue; }
      const appearance = buildAppearance(recurrence, source, index, timestamp);
      created.push(appearance);
      existingDates.add(date);
    }
    const committed = await this.store.commitRecurrence(recurrence, created);
    if (!committed.ok) return { ok: false, code: "storage_error", message: "تعذر حفظ قالب التكرار وظهوراته محليًا. لم يتم تأكيد نجاح العملية." };
    return { ok: true, value: { recurrence: committed.value.recurrence, created: committed.value.schedules, skipped } };
  }

  async cancel(id: string, reason: string): Promise<RecurrenceResult<ScheduleRecurrence>> {
    if (!reason.trim()) return { ok: false, code: "validation_error", message: "اكتب سببًا مختصرًا لإيقاف الظهورات المستقبلية." };
    const current = await this.store.getRecurrence(id);
    if (!current.ok) return { ok: false, code: "storage_error", message: "تعذر قراءة قالب التكرار المحلي." };
    if (!current.value) return { ok: false, code: "not_found", message: "قالب التكرار غير متاح محليًا." };
    if (current.value.status === "cancelled") return { ok: true, value: current.value };
    const timestamp = this.now();
    const cancellationReason = reason.trim();
    const today = localDateKey(timestamp);
    const schedules = await this.store.listSchedules();
    if (!schedules.ok) return { ok: false, code: "storage_error", message: "تعذر قراءة ظهورات التكرار المحلية." };
    const affected = schedules.value.map((schedule) => {
      const isFutureDerived = schedule.recurrenceId === id && schedule.scheduledFor > today && isActiveSchedule(schedule);
      if (!isFutureDerived) return schedule;
      const idempotencyKey = `${schedule.id}:cancelled:${id}`;
      if (schedule.events.some((event) => event.idempotencyKey === idempotencyKey)) return schedule;
      return { ...schedule, status: "cancelled" as const, postponeReason: cancellationReason, updatedAt: timestamp, events: [...schedule.events, { id: `${schedule.id}:cancelled:${schedule.events.length + 1}`, type: "cancelled" as const, idempotencyKey, createdAt: timestamp, previousScheduledFor: schedule.scheduledFor, scheduledFor: schedule.scheduledFor, previousScheduledTime: schedule.scheduledTime, scheduledTime: schedule.scheduledTime, previousDurationMinutes: schedule.durationMinutes, durationMinutes: schedule.durationMinutes, reason: `إلغاء قالب التكرار: ${cancellationReason}` }] };
    });
    const cancelled: ScheduleRecurrence = { ...current.value, status: "cancelled", cancelledAt: timestamp, cancellationReason, updatedAt: timestamp };
    const saved = await this.store.commitRecurrence(cancelled, affected);
    return saved.ok ? { ok: true, value: saved.value.recurrence } : { ok: false, code: "storage_error", message: "تعذر إيقاف قالب التكرار وظهوراته المستقبلية محليًا. لم يتم تأكيد نجاح العملية." };
  }
}
