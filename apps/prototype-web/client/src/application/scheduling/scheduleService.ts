/**
 * Operational timing Application layer. Schedule changes never alter order money, settlement, cost, or result.
 * Style: the seven-day view is decision-first; known time enables warnings, unknown time stays visibly unknown.
 */
import type { PrototypeLocalStore, ScheduleEntry, ScheduleStatus, StoredCraftOrder } from "@/storage/local/types";

export type ScheduledOrder = { schedule: ScheduleEntry; order: StoredCraftOrder; bucket: "overdue" | "today" | "upcoming" };
export type ScheduleDay = { date: string; items: readonly ScheduledOrder[]; scheduledMinutes: number; unknownTimingCount: number; conflictCount: number; overCapacity: boolean };
export type ScheduleOverview = { overdue: readonly ScheduledOrder[]; today: readonly ScheduledOrder[]; upcoming: readonly ScheduledOrder[]; week: readonly ScheduleDay[]; dailyCapacityMinutes: number | null; completedOrClosed: number };
export type ScheduleTimingInput = { scheduledFor: string; scheduledTime: string | null; durationMinutes: number | null; reason: string };
export type ScheduleResult<T> = { ok: true; value: T } | { ok: false; code: "validation_error" | "storage_error" | "not_found"; message: string };

const activeScheduleStatus = (status: ScheduleStatus) => status === "scheduled" || status === "postponed";
const orderCanAppear = (stored: StoredCraftOrder) => !["delivered", "settled", "cancelled"].includes(stored.order.status);
const validDate = (value: string) => /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(new Date(`${value}T12:00:00.000Z`).valueOf());
const validTime = (value: string) => /^([01]\d|2[0-3]):[0-5]\d$/.test(value);
const validDuration = (value: number) => Number.isInteger(value) && value >= 15 && value <= 720 && value % 15 === 0;
const localDateKey = (iso: string) => { const parts = new Intl.DateTimeFormat("en", { timeZone: "Asia/Amman", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date(iso)); const part = (type: Intl.DateTimeFormatPartTypes) => parts.find((item) => item.type === type)?.value ?? ""; return `${part("year")}-${part("month")}-${part("day")}`; };
const timeMinutes = (time: string) => { const [hours, minutes] = time.split(":").map(Number); return hours * 60 + minutes; };
const plusDays = (date: string, days: number) => { const start = new Date(`${date}T12:00:00.000Z`); start.setUTCDate(start.getUTCDate() + days); return start.toISOString().slice(0, 10); };
const activeForOrder = (schedule: ScheduleEntry, order: StoredCraftOrder) => activeScheduleStatus(schedule.status) && orderCanAppear(order);

function initialSchedule(order: StoredCraftOrder): ScheduleEntry {
  const timestamp = order.updatedAt;
  return { id: `schedule-${order.id}`, orderId: order.id, kind: "delivery", scheduledFor: order.deliveryDate, scheduledTime: null, durationMinutes: null, status: "scheduled", postponeReason: null, events: [{ id: `${order.id}:schedule-created`, type: "created", idempotencyKey: `${order.id}:schedule-created`, createdAt: timestamp, previousScheduledFor: null, scheduledFor: order.deliveryDate, previousScheduledTime: null, scheduledTime: null, previousDurationMinutes: null, durationMinutes: null, reason: null }], createdAt: order.createdAt, updatedAt: timestamp };
}

function scheduleSort(a: ScheduledOrder, b: ScheduledOrder) { return a.schedule.scheduledFor.localeCompare(b.schedule.scheduledFor) || (a.schedule.scheduledTime ?? "99:99").localeCompare(b.schedule.scheduledTime ?? "99:99") || b.order.updatedAt.localeCompare(a.order.updatedAt); }

export class ScheduleService {
  constructor(private readonly store: PrototypeLocalStore, private readonly now: () => string = () => new Date().toISOString()) {}

  private async all(): Promise<ScheduleResult<{ schedules: readonly ScheduleEntry[]; orders: readonly StoredCraftOrder[] }>> {
    const [schedulesResult, ordersResult] = await Promise.all([this.store.listSchedules(), this.store.listOrders()]);
    if (!schedulesResult.ok || !ordersResult.ok) return { ok: false, code: "storage_error", message: "تعذر قراءة جدول المواعيد المحلي." };
    const schedulesByOrder = new Map(schedulesResult.value.map((schedule) => [schedule.orderId, schedule]));
    const missing = ordersResult.value.filter((order) => !schedulesByOrder.has(order.id)).map(initialSchedule);
    for (const schedule of missing) { const saved = await this.store.saveSchedule(schedule); if (!saved.ok) return { ok: false, code: "storage_error", message: "تعذر تجهيز موعد محفوظ للطلب السابق." }; schedulesByOrder.set(schedule.orderId, saved.value); }
    return { ok: true, value: { schedules: Array.from(schedulesByOrder.values()), orders: ordersResult.value } };
  }

  private async reconciled(): Promise<ScheduleResult<{ schedules: readonly ScheduleEntry[]; orders: readonly StoredCraftOrder[] }>> {
    const records = await this.all(); if (!records.ok) return records;
    const schedules = new Map(records.value.schedules.map((schedule) => [schedule.orderId, schedule]));
    for (const order of records.value.orders) {
      if (!["delivered", "settled"].includes(order.order.status)) continue;
      const schedule = schedules.get(order.id); if (!schedule || !activeScheduleStatus(schedule.status)) continue;
      const delivery = order.order.events.find((event) => event.type === "status_changed" && event.toStatus === "delivered");
      if (!delivery) continue;
      const idempotencyKey = `${schedule.id}:completed:${delivery.id}`;
      const completed = schedule.events.some((event) => event.idempotencyKey === idempotencyKey) ? schedule : { ...schedule, status: "completed" as const, updatedAt: delivery.createdAt, events: [...schedule.events, { id: `${schedule.id}:completed:${schedule.events.length + 1}`, type: "completed" as const, idempotencyKey, createdAt: delivery.createdAt, previousScheduledFor: schedule.scheduledFor, scheduledFor: schedule.scheduledFor, previousScheduledTime: schedule.scheduledTime, scheduledTime: schedule.scheduledTime, previousDurationMinutes: schedule.durationMinutes, durationMinutes: schedule.durationMinutes, reason: "اكتمل عند تسجيل التسليم" }] };
      if (completed !== schedule) { const saved = await this.store.saveSchedule(completed); if (!saved.ok) return { ok: false, code: "storage_error", message: "تم تسجيل التسليم، لكن تعذر تحديث متابعة الموعد محليًا. افتح جدول المواعيد للمحاولة مجددًا." }; schedules.set(order.id, saved.value); }
    }
    return { ok: true, value: { schedules: Array.from(schedules.values()), orders: records.value.orders } };
  }

  private async dailyCapacity(): Promise<ScheduleResult<number | null>> { const result = await this.store.getPreferences(); return result.ok ? { ok: true, value: result.value?.dailyScheduleCapacityMinutes ?? null } : { ok: false, code: "storage_error", message: "تعذر قراءة سعة اليوم المحلية." }; }

  async setDailyCapacity(minutes: number | null): Promise<ScheduleResult<number | null>> {
    if (minutes !== null && !validDuration(minutes)) return { ok: false, code: "validation_error", message: "سعة اليوم تكون مضاعف 15 دقيقة بين 15 و720." };
    const current = await this.store.getPreferences(); if (!current.ok) return { ok: false, code: "storage_error", message: "تعذر قراءة تفضيلات الجدول المحلية." };
    const saved = await this.store.savePreferences({ id: "local-preferences", theme: current.value?.theme ?? "system", dailyScheduleCapacityMinutes: minutes, updatedAt: this.now() });
    return saved.ok ? { ok: true, value: saved.value.dailyScheduleCapacityMinutes } : { ok: false, code: "storage_error", message: "تعذر حفظ سعة اليوم محليًا. لم يتم تأكيد نجاح العملية." };
  }

  async overview(): Promise<ScheduleResult<ScheduleOverview>> {
    const [records, capacity] = await Promise.all([this.reconciled(), this.dailyCapacity()]); if (!records.ok) return records; if (!capacity.ok) return capacity;
    const today = localDateKey(this.now()); const byId = new Map(records.value.orders.map((order) => [order.id, order])); const overdue: ScheduledOrder[] = []; const day: ScheduledOrder[] = []; const upcoming: ScheduledOrder[] = []; let completedOrClosed = 0;
    for (const schedule of records.value.schedules) { const order = byId.get(schedule.orderId); if (!order) continue; if (!activeForOrder(schedule, order)) { completedOrClosed += 1; continue; } const item: ScheduledOrder = { schedule, order, bucket: schedule.scheduledFor < today ? "overdue" : schedule.scheduledFor === today ? "today" : "upcoming" }; if (item.bucket === "overdue") overdue.push(item); else if (item.bucket === "today") day.push(item); else upcoming.push(item); }
    const active = [...day, ...upcoming].sort(scheduleSort); const week = Array.from({ length: 7 }, (_, index) => { const date = plusDays(today, index); const items = active.filter((item) => item.schedule.scheduledFor === date); const timed = items.filter((item) => item.schedule.scheduledTime !== null && item.schedule.durationMinutes !== null); const conflicts = new Set<string>(); for (let left = 0; left < timed.length; left += 1) for (let right = left + 1; right < timed.length; right += 1) { const a = timed[left]!.schedule; const b = timed[right]!.schedule; const aStart = timeMinutes(a.scheduledTime!); const bStart = timeMinutes(b.scheduledTime!); if (aStart < bStart + b.durationMinutes! && bStart < aStart + a.durationMinutes!) { conflicts.add(a.id); conflicts.add(b.id); } } const scheduledMinutes = timed.reduce((total, item) => total + item.schedule.durationMinutes!, 0); return { date, items, scheduledMinutes, unknownTimingCount: items.length - timed.length, conflictCount: conflicts.size, overCapacity: capacity.value !== null && scheduledMinutes > capacity.value }; });
    return { ok: true, value: { overdue: overdue.sort(scheduleSort), today: day.sort(scheduleSort), upcoming: upcoming.sort(scheduleSort), week, dailyCapacityMinutes: capacity.value, completedOrClosed } };
  }

  async reconcileDelivery(orderId: string): Promise<ScheduleResult<ScheduleEntry>> { const records = await this.reconciled(); if (!records.ok) return records; const schedule = records.value.schedules.find((candidate) => candidate.orderId === orderId); return schedule ? { ok: true, value: schedule } : { ok: false, code: "not_found", message: "لا يوجد موعد محلي لهذا الطلب." }; }

  async get(id: string): Promise<ScheduleResult<ScheduleEntry>> { const records = await this.reconciled(); if (!records.ok) return records; const found = records.value.schedules.find((schedule) => schedule.id === id); return found ? { ok: true, value: found } : { ok: false, code: "not_found", message: "الموعد غير متاح محليًا." }; }

  async updateTiming(id: string, input: ScheduleTimingInput): Promise<ScheduleResult<ScheduleEntry>> {
    if (!validDate(input.scheduledFor)) return { ok: false, code: "validation_error", message: "أدخل تاريخًا صحيحًا للموعد." };
    if (input.scheduledFor < localDateKey(this.now())) return { ok: false, code: "validation_error", message: "لا يمكن ضبط موعد نشط في يوم مضى." };
    if ((input.scheduledTime === null) !== (input.durationMinutes === null)) return { ok: false, code: "validation_error", message: "أدخل الوقت والمدة معًا، أو اتركهما غير محددين." };
    if (input.scheduledTime !== null && (!validTime(input.scheduledTime) || !validDuration(input.durationMinutes!))) return { ok: false, code: "validation_error", message: "الوقت أو المدة غير صالحين. اختر مدة من مضاعفات 15 دقيقة." };
    const current = await this.get(id); if (!current.ok) return current; if (!activeScheduleStatus(current.value.status)) return { ok: false, code: "validation_error", message: "لا يمكن تعديل موعد غير نشط." };
    const changedDate = current.value.scheduledFor !== input.scheduledFor; const changedTiming = current.value.scheduledTime !== input.scheduledTime || current.value.durationMinutes !== input.durationMinutes;
    if (!changedDate && !changedTiming) return { ok: true, value: current.value };
    if (changedDate && !input.reason.trim()) return { ok: false, code: "validation_error", message: "اذكر سبب التأجيل باختصار عند تغيير يوم الموعد." };
    const type = changedDate ? "postponed" as const : "timing_changed" as const; const idempotencyKey = `${id}:${type}:${input.scheduledFor}:${input.scheduledTime ?? "unknown"}:${input.durationMinutes ?? "unknown"}`;
    if (current.value.events.some((event) => event.idempotencyKey === idempotencyKey)) return { ok: true, value: current.value };
    const timestamp = this.now(); const reason = input.reason.trim() || null; const next: ScheduleEntry = { ...current.value, scheduledFor: input.scheduledFor, scheduledTime: input.scheduledTime, durationMinutes: input.durationMinutes, status: changedDate ? "postponed" : current.value.status, postponeReason: changedDate ? reason : current.value.postponeReason, updatedAt: timestamp, events: [...current.value.events, { id: `${id}:${type}:${current.value.events.length + 1}`, type, idempotencyKey, createdAt: timestamp, previousScheduledFor: current.value.scheduledFor, scheduledFor: input.scheduledFor, previousScheduledTime: current.value.scheduledTime, scheduledTime: input.scheduledTime, previousDurationMinutes: current.value.durationMinutes, durationMinutes: input.durationMinutes, reason }] };
    const saved = await this.store.saveSchedule(next); return saved.ok ? { ok: true, value: saved.value } : { ok: false, code: "storage_error", message: "تعذر حفظ الموعد محليًا. لم يتم تأكيد نجاح العملية." };
  }

  async postpone(id: string, scheduledFor: string, reason: string): Promise<ScheduleResult<ScheduleEntry>> { const current = await this.get(id); if (!current.ok) return current; return this.updateTiming(id, { scheduledFor, scheduledTime: current.value.scheduledTime, durationMinutes: current.value.durationMinutes, reason }); }
}
