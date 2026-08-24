import { describe, expect, it } from "vitest";
import { ScheduleService } from "./scheduleService";
import { MemoryLocalStore } from "@/storage/local/MemoryLocalStore";
import { calculateCostSnapshot, createCraftOrder } from "@micro-domain/craft-order/index.js";

async function saveOrder(store: MemoryLocalStore, id: string, deliveryDate: string) {
  const cost = calculateCostSnapshot(`${id}-cost`, { currency: "JOD", materialItems: [], time: { minutes: 60, hourlyRateMinor: 500, confidence: "known" }, packagingMinor: 0, deliveryMinor: 0, wasteMinor: 0, safetyBufferMinor: 0, quantity: 1, createdAt: "2026-08-22T00:00:00.000Z", freshnessDays: null });
  const order = createCraftOrder({ id, customerName: "سارة", itemName: `طلب ${id}`, specifications: "اختبار", quantity: 1, agreedPriceMinor: 2000, costSnapshot: cost, createdAt: "2026-08-22T00:00:00.000Z" });
  await store.saveOrder({ id, order: { ...order, status: "in_progress", nextAction: "أكمل التنفيذ" }, deliveryDate, agreementSource: null, createdAt: "2026-08-22T00:00:00.000Z", updatedAt: "2026-08-22T00:00:00.000Z" });
}

async function storedOrder(id: string, deliveryDate: string) {
  const store = new MemoryLocalStore();
  await saveOrder(store, id, deliveryDate);
  return store;
}

describe("ScheduleService", () => {
  it("backfills an operational schedule for an existing order and groups it by Amman day", async () => {
    const store = await storedOrder("order-today", "2026-08-23"); const service = new ScheduleService(store, () => "2026-08-23T08:00:00.000Z");
    await expect(service.overview()).resolves.toMatchObject({ ok: true, value: { today: [{ schedule: { orderId: "order-today", status: "scheduled" } }] } });
  });

  it("requires a future-or-today date and a reason when postponing, while retaining history", async () => {
    const store = await storedOrder("order-upcoming", "2026-08-24"); const service = new ScheduleService(store, () => "2026-08-23T08:00:00.000Z"); const overview = await service.overview(); if (!overview.ok) throw new Error("overview should load"); const id = overview.value.upcoming[0]?.schedule.id; if (!id) throw new Error("schedule should exist");
    await expect(service.postpone(id, "2026-08-22", "تأخر العميل")).resolves.toMatchObject({ ok: false, code: "validation_error" });
    await expect(service.postpone(id, "2026-08-26", "تأخر العميل في التأكيد")).resolves.toMatchObject({ ok: true, value: { status: "postponed", scheduledFor: "2026-08-26", postponeReason: "تأخر العميل في التأكيد", events: [{ type: "created" }, { type: "postponed", previousScheduledFor: "2026-08-24" }] } });
  });

  it("warns about overlapping known time and a user-declared daily capacity without blocking either order", async () => {
    const store = await storedOrder("order-first", "2026-08-23");
    await saveOrder(store, "order-second", "2026-08-23");
    const service = new ScheduleService(store, () => "2026-08-23T08:00:00.000Z"); const initial = await service.overview(); if (!initial.ok) throw new Error("overview should load");
    await expect(service.setDailyCapacity(90)).resolves.toMatchObject({ ok: true, value: 90 });
    await expect(service.updateTiming(initial.value.today[0]!.schedule.id, { scheduledFor: "2026-08-23", scheduledTime: "09:00", durationMinutes: 60, reason: "" })).resolves.toMatchObject({ ok: true, value: { scheduledTime: "09:00", durationMinutes: 60, events: [{ type: "created" }, { type: "timing_changed" }] } });
    await expect(service.updateTiming(initial.value.today[1]!.schedule.id, { scheduledFor: "2026-08-23", scheduledTime: "09:30", durationMinutes: 60, reason: "" })).resolves.toMatchObject({ ok: true, value: { scheduledTime: "09:30", durationMinutes: 60 } });
    const after = await service.overview(); if (!after.ok) throw new Error("overview should load"); expect(after.value.dailyCapacityMinutes).toBe(90); expect(after.value.week[0]).toMatchObject({ date: "2026-08-23", scheduledMinutes: 120, unknownTimingCount: 0, conflictCount: 2, overCapacity: true });
  });

  it("keeps an unknown time visible instead of treating it as zero workload or an available slot", async () => {
    const store = await storedOrder("order-unknown", "2026-08-23"); const service = new ScheduleService(store, () => "2026-08-23T08:00:00.000Z");
    const overview = await service.overview(); if (!overview.ok) throw new Error("overview should load"); expect(overview.value.week[0]).toMatchObject({ date: "2026-08-23", scheduledMinutes: 0, unknownTimingCount: 1, conflictCount: 0, overCapacity: false });
  });

  it("derives a local month with known and unknown timing and counts overdue active orders", async () => {
    const store = await storedOrder("order-known-month", "2026-08-20"); await saveOrder(store, "order-unknown-month", "2026-08-05"); const service = new ScheduleService(store, () => "2026-08-10T08:00:00.000Z");
    const initial = await service.monthOverview("2026-08"); if (!initial.ok) throw new Error("month overview should load");
    const knownSchedule = await store.getSchedule("schedule-order-known-month"); if (!knownSchedule.ok || !knownSchedule.value) throw new Error("known schedule should exist");
    await expect(service.updateTiming(knownSchedule.value.id, { scheduledFor: "2026-08-20", scheduledTime: "10:00", durationMinutes: 60, reason: "تسجيل وقت معروف للاختبار" })).resolves.toMatchObject({ ok: true });
    const month = await service.monthOverview("2026-08"); if (!month.ok) throw new Error("month overview should load");
    expect(month.value).toMatchObject({ month: "2026-08", scheduledCount: 2, overdueCount: 1, scheduledMinutes: 60, unknownTimingCount: 1 });
    expect(month.value.days.find((day) => day.date === "2026-08-20")).toMatchObject({ scheduledMinutes: 60, unknownTimingCount: 0, items: [{ schedule: { scheduledTime: "10:00", durationMinutes: 60 } }] });
    expect(month.value.days.find((day) => day.date === "2026-08-05")).toMatchObject({ scheduledMinutes: 0, unknownTimingCount: 1, items: [{ schedule: { scheduledTime: null, durationMinutes: null } }] });
    expect(initial.value.days).toHaveLength(31);
  });

  it("derives monthly overlap and capacity warnings without changing the schedule records", async () => {
    const store = await storedOrder("order-month-first", "2026-08-12"); await saveOrder(store, "order-month-second", "2026-08-12"); const service = new ScheduleService(store, () => "2026-08-01T08:00:00.000Z");
    const before = await service.monthOverview("2026-08"); if (!before.ok) throw new Error("month overview should load");
    await service.setDailyCapacity(90);
    const first = await store.getSchedule("schedule-order-month-first"); const second = await store.getSchedule("schedule-order-month-second"); if (!first.ok || !first.value || !second.ok || !second.value) throw new Error("schedules should exist");
    await service.updateTiming(first.value.id, { scheduledFor: "2026-08-12", scheduledTime: "09:00", durationMinutes: 60, reason: "وقت اختبار" });
    await service.updateTiming(second.value.id, { scheduledFor: "2026-08-12", scheduledTime: "09:30", durationMinutes: 60, reason: "وقت اختبار" });
    const month = await service.monthOverview("2026-08"); if (!month.ok) throw new Error("month overview should load"); const day = month.value.days.find((candidate) => candidate.date === "2026-08-12");
    expect(day).toMatchObject({ scheduledMinutes: 120, unknownTimingCount: 0, conflictCount: 2, overCapacity: true });
    expect(before.value.scheduledCount).toBe(2);
    expect((await store.getSchedule(first.value.id)).ok).toBe(true);
  });

  it("returns an explicit empty month without implying availability", async () => {
    const service = new ScheduleService(new MemoryLocalStore(), () => "2026-08-01T08:00:00.000Z");
    await expect(service.monthOverview("2026-08")).resolves.toMatchObject({ ok: true, value: { month: "2026-08", days: expect.any(Array), scheduledCount: 0, overdueCount: 0, scheduledMinutes: 0, unknownTimingCount: 0 } });
    const result = await service.monthOverview("2026-13");
    expect(result).toMatchObject({ ok: false, code: "validation_error" });
  });

  it("reconciles the operational schedule to completed when a delivery event exists", async () => {
    const store = await storedOrder("order-delivered", "2026-08-23"); const service = new ScheduleService(store, () => "2026-08-23T08:00:00.000Z"); const before = await service.overview(); if (!before.ok) throw new Error("overview should load"); const stored = await store.getOrder("order-delivered"); if (!stored.ok || !stored.value) throw new Error("order should load");
    await store.saveOrder({ ...stored.value, order: { ...stored.value.order, status: "delivered", events: [...stored.value.order.events, { id: "delivered-event", type: "status_changed", idempotencyKey: "delivered-event", createdAt: "2026-08-23T09:00:00.000Z", fromStatus: "ready", toStatus: "delivered" }] }, updatedAt: "2026-08-23T09:00:00.000Z" });
    await expect(service.overview()).resolves.toMatchObject({ ok: true, value: { completedOrClosed: 1, today: [] } });
    await expect(service.get(before.value.today[0]!.schedule.id)).resolves.toMatchObject({ ok: true, value: { status: "completed", events: [{ type: "created" }, { type: "completed", reason: "اكتمل عند تسجيل التسليم" }] } });
  });
});


describe("ScheduleRecurrenceService", () => {
  it("creates exactly three independent weekly appearances", async () => {
    const store = await storedOrder("recurring-weekly", "2026-08-10");
    const scheduleService = new ScheduleService(store, () => "2026-08-01T08:00:00.000Z"); await scheduleService.overview();
    const source = await store.getSchedule("schedule-recurring-weekly"); if (!source.ok || !source.value) throw new Error("source schedule should exist");
    const { ScheduleRecurrenceService } = await import("./recurrenceService");
    const recurrenceService = new ScheduleRecurrenceService(store, () => "2026-08-01T08:00:00.000Z");
    const created = await recurrenceService.create({ sourceScheduleId: source.value.id, frequency: "weekly", occurrenceCount: 3 });
    expect(created).toMatchObject({ ok: true, value: { created: [{ scheduledFor: "2026-08-17", recurrenceIndex: 1 }, { scheduledFor: "2026-08-24", recurrenceIndex: 2 }, { scheduledFor: "2026-08-31", recurrenceIndex: 3 }] } });
    const schedules = await store.listSchedules(); if (!schedules.ok) throw new Error("schedules should load"); expect(schedules.value).toHaveLength(4); expect(schedules.value.filter((schedule) => schedule.recurrenceId !== null)).toHaveLength(3); expect(schedules.value.map((schedule) => schedule.recurrenceIndex)).toEqual(expect.arrayContaining([null, 1, 2, 3]));
    await expect(scheduleService.monthOverview("2026-08")).resolves.toMatchObject({ ok: true, value: { scheduledCount: 4 } });
  });

  it("does not duplicate appearances when the same recurrence is executed again", async () => {
    const store = await storedOrder("recurring-idempotent", "2026-08-10"); await new ScheduleService(store, () => "2026-08-01T08:00:00.000Z").overview(); const { ScheduleRecurrenceService } = await import("./recurrenceService"); const service = new ScheduleRecurrenceService(store, () => "2026-08-01T08:00:00.000Z");
    const source = await store.getSchedule("schedule-recurring-idempotent"); if (!source.ok || !source.value) throw new Error("source schedule should exist");
    const first = await service.create({ sourceScheduleId: source.value.id, frequency: "monthly", occurrenceCount: 2 }); if (!first.ok) throw new Error("recurrence should save");
    const second = await service.create({ sourceScheduleId: source.value.id, frequency: "monthly", occurrenceCount: 2 });
    expect(second).toMatchObject({ ok: true, value: { created: [], skipped: [{ reason: "existing_schedule" }, { reason: "existing_schedule" }] } });
    const schedules = await store.listSchedules(); if (!schedules.ok) throw new Error("schedules should load"); expect(schedules.value.filter((schedule) => schedule.recurrenceId !== null)).toHaveLength(2); expect(schedules.value.map((schedule) => schedule.recurrenceIndex)).toEqual(expect.arrayContaining([null, 1, 2]));
    const listed = await service.list(); expect(listed).toMatchObject({ ok: true, value: [{ appearances: [{ recurrenceIndex: 1 }, { recurrenceIndex: 2 }] }] });
  });

  it("keeps unknown timing visible for a bounded monthly recurrence", async () => {
    const store = await storedOrder("recurring-unknown", "2026-01-31"); await new ScheduleService(store, () => "2026-01-01T08:00:00.000Z").overview(); const { ScheduleRecurrenceService } = await import("./recurrenceService"); const service = new ScheduleRecurrenceService(store, () => "2026-01-01T08:00:00.000Z");
    const source = await store.getSchedule("schedule-recurring-unknown"); if (!source.ok || !source.value) throw new Error("source schedule should exist");
    const result = await service.create({ sourceScheduleId: source.value.id, frequency: "monthly", occurrenceCount: 2 }); if (!result.ok) throw new Error("recurrence should save");
    expect(result.value.created.map((item) => item.scheduledFor)).toEqual(["2026-02-28", "2026-03-31"]);
    const month = await new ScheduleService(store, () => "2026-02-01T08:00:00.000Z").monthOverview("2026-02"); if (!month.ok) throw new Error("month should load");
    expect(month.value).toMatchObject({ scheduledCount: 1, scheduledMinutes: 0, unknownTimingCount: 1 });
    expect(month.value.days.find((day) => day.date === "2026-02-28")).toMatchObject({ unknownTimingCount: 1, scheduledMinutes: 0 });
  });

  it("keeps conflict and capacity as warnings without changing order money", async () => {
    const store = await storedOrder("recurring-warning", "2026-08-12"); await saveOrder(store, "existing-warning", "2026-08-19"); await new ScheduleService(store, () => "2026-08-01T08:00:00.000Z").overview(); const { ScheduleRecurrenceService } = await import("./recurrenceService"); const service = new ScheduleRecurrenceService(store, () => "2026-08-01T08:00:00.000Z");
    const source = await store.getSchedule("schedule-recurring-warning"); const other = await store.getSchedule("schedule-existing-warning"); if (!source.ok || !source.value || !other.ok || !other.value) throw new Error("schedules should exist");
    const scheduleService = new ScheduleService(store, () => "2026-08-01T08:00:00.000Z"); await scheduleService.updateTiming(source.value.id, { scheduledFor: "2026-08-12", scheduledTime: "09:00", durationMinutes: 60, reason: "وقت معروف" }); await scheduleService.updateTiming(other.value.id, { scheduledFor: "2026-08-19", scheduledTime: "09:30", durationMinutes: 60, reason: "وقت معروف" }); await scheduleService.setDailyCapacity(90);
    const before = await store.getOrder("recurring-warning"); if (!before.ok || !before.value) throw new Error("order should exist");
    const recurrence = await service.create({ sourceScheduleId: source.value.id, frequency: "weekly", occurrenceCount: 1 }); if (!recurrence.ok) throw new Error("recurrence should save");
    const month = await scheduleService.monthOverview("2026-08"); if (!month.ok) throw new Error("month should load"); expect(month.value.days.find((day) => day.date === "2026-08-19")).toMatchObject({ scheduledMinutes: 120, conflictCount: 2, overCapacity: true });
    await expect(store.getOrder("recurring-warning")).resolves.toMatchObject({ ok: true, value: { order: { agreedPriceMinor: before.value.order.agreedPriceMinor, collectedMinor: before.value.order.collectedMinor } } });
  });

  it("cancels only active future derived appearances and preserves source, past, and unrelated schedules", async () => {
    const createNow = () => "2026-08-01T08:00:00.000Z"; const cancelNow = () => "2026-08-23T08:00:00.000Z";
    const store = await storedOrder("recurring-cancel", "2026-08-10"); const scheduleService = new ScheduleService(store, createNow); await scheduleService.overview(); await saveOrder(store, "recurring-cancel-unrelated", "2026-08-30"); await scheduleService.overview();
    const { ScheduleRecurrenceService } = await import("./recurrenceService"); const service = new ScheduleRecurrenceService(store, createNow); const cancellationService = new ScheduleRecurrenceService(store, cancelNow); const source = await store.getSchedule("schedule-recurring-cancel"); const unrelated = await store.getSchedule("schedule-recurring-cancel-unrelated"); if (!source.ok || !source.value || !unrelated.ok || !unrelated.value) throw new Error("source and unrelated schedules should exist");
    const created = await service.create({ sourceScheduleId: source.value.id, frequency: "weekly", occurrenceCount: 3 }); if (!created.ok) throw new Error("recurrence should save");
    await expect(cancellationService.cancel(created.value.recurrence.id, "توقف النمط نهائيًا")).resolves.toMatchObject({ ok: true, value: { status: "cancelled", cancellationReason: "توقف النمط نهائيًا" } });
    await expect(service.create({ sourceScheduleId: source.value.id, frequency: "weekly", occurrenceCount: 3 })).resolves.toMatchObject({ ok: true, value: { created: [] } });
    const listed = await service.list(); expect(listed).toMatchObject({ ok: true, value: [{ recurrence: { status: "cancelled" }, appearances: [{ recurrenceIndex: 1, scheduledFor: "2026-08-17", status: "scheduled" }, { recurrenceIndex: 2, scheduledFor: "2026-08-24", status: "cancelled" }, { recurrenceIndex: 3, scheduledFor: "2026-08-31", status: "cancelled" }] }] });
    expect(listed.ok && listed.value[0]?.appearances[1]?.events.at(-1)).toMatchObject({ type: "cancelled", reason: "إلغاء قالب التكرار: توقف النمط نهائيًا" });
    expect(listed.ok && listed.value[0]?.appearances[2]?.events.at(-1)).toMatchObject({ type: "cancelled", reason: "إلغاء قالب التكرار: توقف النمط نهائيًا" });
    await expect(store.getSchedule(source.value.id)).resolves.toMatchObject({ ok: true, value: { status: "scheduled", recurrenceId: null, events: [{ type: "created" }] } });
    await expect(store.getSchedule(unrelated.value.id)).resolves.toMatchObject({ ok: true, value: { status: "scheduled", recurrenceId: null, events: [{ type: "created" }] } });
  });
});
