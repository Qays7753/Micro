import { describe, expect, it } from "vitest";
import { ScheduleService } from "./scheduleService";
import { MemoryLocalStore } from "@/storage/local/MemoryLocalStore";
import { calculateCostSnapshot, createCraftOrder } from "@micro-domain/craft-order/index.js";

async function storedOrder(id: string, deliveryDate: string) {
  const store = new MemoryLocalStore();
  const cost = calculateCostSnapshot(`${id}-cost`, { currency: "JOD", materialItems: [], time: { minutes: 60, hourlyRateMinor: 500, confidence: "known" }, packagingMinor: 0, deliveryMinor: 0, wasteMinor: 0, safetyBufferMinor: 0, quantity: 1, createdAt: "2026-08-22T00:00:00.000Z", freshnessDays: null });
  const order = createCraftOrder({ id, customerName: "سارة", itemName: `طلب ${id}`, specifications: "اختبار", quantity: 1, agreedPriceMinor: 2000, costSnapshot: cost, createdAt: "2026-08-22T00:00:00.000Z" });
  await store.saveOrder({ id, order: { ...order, status: "in_progress", nextAction: "أكمل التنفيذ" }, deliveryDate, agreementSource: null, createdAt: "2026-08-22T00:00:00.000Z", updatedAt: "2026-08-22T00:00:00.000Z" });
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
    const cost = calculateCostSnapshot("order-second-cost", { currency: "JOD", materialItems: [], time: { minutes: 60, hourlyRateMinor: 500, confidence: "known" }, packagingMinor: 0, deliveryMinor: 0, wasteMinor: 0, safetyBufferMinor: 0, quantity: 1, createdAt: "2026-08-22T00:00:00.000Z", freshnessDays: null });
    const second = createCraftOrder({ id: "order-second", customerName: "ريم", itemName: "طلب ثانٍ", specifications: "اختبار", quantity: 1, agreedPriceMinor: 2000, costSnapshot: cost, createdAt: "2026-08-22T00:00:00.000Z" });
    await store.saveOrder({ id: second.id, order: { ...second, status: "in_progress", nextAction: "أكمل التنفيذ" }, deliveryDate: "2026-08-23", agreementSource: null, createdAt: "2026-08-22T00:00:00.000Z", updatedAt: "2026-08-22T00:00:00.000Z" });
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

  it("reconciles the operational schedule to completed when a delivery event exists", async () => {
    const store = await storedOrder("order-delivered", "2026-08-23"); const service = new ScheduleService(store, () => "2026-08-23T08:00:00.000Z"); const before = await service.overview(); if (!before.ok) throw new Error("overview should load"); const stored = await store.getOrder("order-delivered"); if (!stored.ok || !stored.value) throw new Error("order should load");
    await store.saveOrder({ ...stored.value, order: { ...stored.value.order, status: "delivered", events: [...stored.value.order.events, { id: "delivered-event", type: "status_changed", idempotencyKey: "delivered-event", createdAt: "2026-08-23T09:00:00.000Z", fromStatus: "ready", toStatus: "delivered" }] }, updatedAt: "2026-08-23T09:00:00.000Z" });
    await expect(service.overview()).resolves.toMatchObject({ ok: true, value: { completedOrClosed: 1, today: [] } });
    await expect(service.get(before.value.today[0]!.schedule.id)).resolves.toMatchObject({ ok: true, value: { status: "completed", events: [{ type: "created" }, { type: "completed", reason: "اكتمل عند تسجيل التسليم" }] } });
  });
});
