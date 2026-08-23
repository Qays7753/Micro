import { describe, expect, it } from "vitest";
import { ActualTimeService } from "./actualTimeService";
import { MemoryLocalStore } from "@/storage/local/MemoryLocalStore";
import { calculateCostSnapshot, createCraftOrder } from "@micro-domain/craft-order/index.js";

describe("ActualTimeService", () => {
  it("keeps work mode optional and records time only as an explanatory comparison", async () => {
    const store = new MemoryLocalStore();
    const cost = calculateCostSnapshot("time-cost", { currency: "JOD", materialItems: [], time: { minutes: 60, hourlyRateMinor: 500, confidence: "known" }, packagingMinor: 0, deliveryMinor: 0, wasteMinor: 0, safetyBufferMinor: 0, quantity: 1, createdAt: "2026-08-23T09:00:00.000Z", freshnessDays: null });
    const order = createCraftOrder({ id: "time-order", customerName: "سارة", itemName: "تغليف", specifications: "اختبار", quantity: 1, agreedPriceMinor: 2000, costSnapshot: cost, createdAt: "2026-08-23T09:00:00.000Z" });
    await store.saveOrder({ id: order.id, order, catalogItemId: null, deliveryDate: "2026-08-24", agreementSource: null, createdAt: "2026-08-23T09:00:00.000Z", updatedAt: "2026-08-23T09:00:00.000Z" });
    const service = new ActualTimeService(store, () => "2026-08-23T10:00:00.000Z");
    await expect(service.readOperatingMode()).resolves.toMatchObject({ ok: true, value: { workMode: null, actualTimeTrackingEnabled: false } });
    await expect(service.saveOperatingMode({ workMode: "time_focused", actualTimeTrackingEnabled: true })).resolves.toMatchObject({ ok: true, value: { workMode: "time_focused", actualTimeTrackingEnabled: true } });
    const recorded = await service.record({ orderId: order.id, minutes: 75, recordedOn: "2026-08-23", note: "تنفيذ", operationKey: "time-record" });
    expect(recorded).toMatchObject({ ok: true, value: { orderId: order.id, minutesDelta: 75 } });
    await expect(service.record({ orderId: order.id, minutes: 75, recordedOn: "2026-08-23", note: "تنفيذ", operationKey: "time-record" })).resolves.toMatchObject({ ok: true, reused: true });
    await expect(service.readOrderActualTimeComparison(order.id)).resolves.toMatchObject({ ok: true, value: { status: "recorded", plannedMinutes: 60, actualMinutes: 75, varianceMinutes: 15, recordCount: 1 } });
  });
});
