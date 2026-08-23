/**
 * Schedule Application service: delivery timing is operational state only.
 * It never changes CraftOrder money, settlement, cost, or result semantics.
 */
import type { PrototypeLocalStore, ScheduleEntry, ScheduleStatus, StoredCraftOrder } from "@/storage/local/types";

export type ScheduledOrder = { schedule: ScheduleEntry; order: StoredCraftOrder; bucket: "overdue" | "today" | "upcoming" };
export type ScheduleOverview = { overdue: readonly ScheduledOrder[]; today: readonly ScheduledOrder[]; upcoming: readonly ScheduledOrder[]; completedOrClosed: number };
export type ScheduleResult<T> = { ok: true; value: T } | { ok: false; code: "validation_error" | "storage_error" | "not_found"; message: string };

const activeScheduleStatus = (status: ScheduleStatus) => status === "scheduled" || status === "postponed";
const orderCanAppear = (stored: StoredCraftOrder) => !["delivered", "settled", "cancelled"].includes(stored.order.status);
const validDate = (value: string) => /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(new Date(`${value}T12:00:00.000Z`).valueOf());
const localDateKey = (iso: string) => {
  const parts = new Intl.DateTimeFormat("en", { timeZone: "Asia/Amman", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date(iso));
  const part = (type: Intl.DateTimeFormatPartTypes) => parts.find((item) => item.type === type)?.value ?? "";
  return `${part("year")}-${part("month")}-${part("day")}`;
};

function initialSchedule(order: StoredCraftOrder): ScheduleEntry {
  const timestamp = order.updatedAt;
  return { id: `schedule-${order.id}`, orderId: order.id, kind: "delivery", scheduledFor: order.deliveryDate, status: "scheduled", postponeReason: null, events: [{ id: `${order.id}:schedule-created`, type: "created", idempotencyKey: `${order.id}:schedule-created`, createdAt: timestamp, previousScheduledFor: null, scheduledFor: order.deliveryDate, reason: null }], createdAt: order.createdAt, updatedAt: timestamp };
}

export class ScheduleService {
  constructor(private readonly store: PrototypeLocalStore, private readonly now: () => string = () => new Date().toISOString()) {}

  private async all(): Promise<ScheduleResult<{ schedules: readonly ScheduleEntry[]; orders: readonly StoredCraftOrder[] }>> {
    const [schedulesResult, ordersResult] = await Promise.all([this.store.listSchedules(), this.store.listOrders()]);
    if (!schedulesResult.ok || !ordersResult.ok) return { ok: false, code: "storage_error", message: "تعذر قراءة جدول المواعيد المحلي." };
    const schedulesByOrder = new Map(schedulesResult.value.map((schedule) => [schedule.orderId, schedule]));
    const missing = ordersResult.value.filter((order) => !schedulesByOrder.has(order.id)).map(initialSchedule);
    for (const schedule of missing) {
      const saved = await this.store.saveSchedule(schedule);
      if (!saved.ok) return { ok: false, code: "storage_error", message: "تعذر تجهيز موعد محفوظ للطلب السابق." };
      schedulesByOrder.set(schedule.orderId, saved.value);
    }
    return { ok: true, value: { schedules: Array.from(schedulesByOrder.values()), orders: ordersResult.value } };
  }

  async overview(): Promise<ScheduleResult<ScheduleOverview>> {
    const records = await this.all(); if (!records.ok) return records;
    const today = localDateKey(this.now()); const byId = new Map(records.value.orders.map((order) => [order.id, order]));
    const overdue: ScheduledOrder[] = []; const day: ScheduledOrder[] = []; const upcoming: ScheduledOrder[] = []; let completedOrClosed = 0;
    for (const schedule of records.value.schedules) {
      const order = byId.get(schedule.orderId); if (!order) continue;
      if (!activeScheduleStatus(schedule.status) || !orderCanAppear(order)) { completedOrClosed += 1; continue; }
      const item: ScheduledOrder = { schedule, order, bucket: schedule.scheduledFor < today ? "overdue" : schedule.scheduledFor === today ? "today" : "upcoming" };
      if (item.bucket === "overdue") overdue.push(item); else if (item.bucket === "today") day.push(item); else upcoming.push(item);
    }
    const sort = (a: ScheduledOrder, b: ScheduledOrder) => a.schedule.scheduledFor.localeCompare(b.schedule.scheduledFor) || b.order.updatedAt.localeCompare(a.order.updatedAt);
    return { ok: true, value: { overdue: overdue.sort(sort), today: day.sort(sort), upcoming: upcoming.sort(sort), completedOrClosed } };
  }

  async get(id: string): Promise<ScheduleResult<ScheduleEntry>> {
    const records = await this.all(); if (!records.ok) return records;
    const found = records.value.schedules.find((schedule) => schedule.id === id);
    return found ? { ok: true, value: found } : { ok: false, code: "not_found", message: "الموعد غير متاح محليًا." };
  }

  async postpone(id: string, scheduledFor: string, reason: string): Promise<ScheduleResult<ScheduleEntry>> {
    if (!validDate(scheduledFor)) return { ok: false, code: "validation_error", message: "أدخل تاريخًا صحيحًا للتأجيل." };
    if (scheduledFor < localDateKey(this.now())) return { ok: false, code: "validation_error", message: "لا يمكن تأجيل الموعد إلى يوم مضى." };
    if (!reason.trim()) return { ok: false, code: "validation_error", message: "اذكر سبب التأجيل باختصار قبل الحفظ." };
    const current = await this.get(id); if (!current.ok) return current;
    if (!activeScheduleStatus(current.value.status)) return { ok: false, code: "validation_error", message: "لا يمكن تأجيل موعد غير نشط." };
    const idempotencyKey = `${id}:postpone:${scheduledFor}`;
    if (current.value.events.some((event) => event.idempotencyKey === idempotencyKey)) return { ok: true, value: current.value };
    const timestamp = this.now();
    const next: ScheduleEntry = { ...current.value, scheduledFor, status: "postponed", postponeReason: reason.trim(), updatedAt: timestamp, events: [...current.value.events, { id: `${id}:postpone:${current.value.events.length + 1}`, type: "postponed", idempotencyKey, createdAt: timestamp, previousScheduledFor: current.value.scheduledFor, scheduledFor, reason: reason.trim() }] };
    const saved = await this.store.saveSchedule(next);
    return saved.ok ? { ok: true, value: saved.value } : { ok: false, code: "storage_error", message: "تعذر حفظ التأجيل محليًا. لم يتم تأكيد نجاح العملية." };
  }
}
