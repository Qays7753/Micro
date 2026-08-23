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
});
