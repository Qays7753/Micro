import { describe, expect, it } from "vitest";
import { ActualTimeService } from "./actualTimeService";
import { MemoryLocalStore } from "@/storage/local/MemoryLocalStore";
import { calculateCostSnapshot, createCraftOrder } from "@micro-domain/craft-order/index.js";

describe("ActualTimeService", () => {
  it("keeps work mode optional and records time only as an explanatory comparison", async () => {
    const store = new MemoryLocalStore();
    const cost = calculateCostSnapshot("time-cost", {
      currency: "JOD",
      materialItems: [],
      time: { minutes: 60, hourlyRateMinor: 500, confidence: "known" },
      packagingMinor: 0,
      deliveryMinor: 0,
      wasteMinor: 0,
      safetyBufferMinor: 0,
      quantity: 1,
      createdAt: "2026-08-23T09:00:00.000Z",
      freshnessDays: null,
    });
    const order = createCraftOrder({
      id: "time-order",
      customerName: "سارة",
      itemName: "تغليف",
      specifications: "اختبار",
      quantity: 1,
      agreedPriceMinor: 2000,
      costSnapshot: cost,
      createdAt: "2026-08-23T09:00:00.000Z",
    });
    await store.saveOrder({
      id: order.id,
      order,
      catalogItemId: null,
      deliveryDate: "2026-08-24",
      agreementSource: null,
      createdAt: "2026-08-23T09:00:00.000Z",
      updatedAt: "2026-08-23T09:00:00.000Z",
    });
    const service = new ActualTimeService(store, () => "2026-08-23T10:00:00.000Z");
    await expect(service.readOperatingMode()).resolves.toMatchObject({
      ok: true,
      value: { workMode: null, actualTimeTrackingEnabled: false },
    });
    await expect(
      service.saveOperatingMode({ workMode: "time_focused", actualTimeTrackingEnabled: true }),
    ).resolves.toMatchObject({
      ok: true,
      value: { workMode: "time_focused", actualTimeTrackingEnabled: true },
    });
    const recorded = await service.record({
      orderId: order.id,
      minutes: 75,
      recordedOn: "2026-08-23",
      note: "تنفيذ",
      operationKey: "time-record",
    });
    expect(recorded).toMatchObject({ ok: true, value: { orderId: order.id, minutesDelta: 75 } });
    await expect(
      service.record({
        orderId: order.id,
        minutes: 75,
        recordedOn: "2026-08-23",
        note: "تنفيذ",
        operationKey: "time-record",
      }),
    ).resolves.toMatchObject({ ok: true, reused: true });
    await expect(service.readOrderActualTimeComparison(order.id)).resolves.toMatchObject({
      ok: true,
      value: {
        status: "recorded",
        plannedMinutes: 60,
        actualMinutes: 75,
        varianceMinutes: 15,
        recordCount: 1,
      },
    });
  });

  it("lists order records, reverses once with a reason, and reuses the reverse operation", async () => {
    const store = new MemoryLocalStore();
    const cost = calculateCostSnapshot("reverse-cost", {
      currency: "JOD",
      materialItems: [],
      time: { minutes: 60, hourlyRateMinor: 500, confidence: "known" },
      packagingMinor: 0,
      deliveryMinor: 0,
      wasteMinor: 0,
      safetyBufferMinor: 0,
      quantity: 1,
      createdAt: "2026-08-23T09:00:00.000Z",
      freshnessDays: null,
    });
    const order = createCraftOrder({
      id: "reverse-order",
      customerName: "ليان",
      itemName: "خدمة",
      specifications: "اختبار عكس",
      quantity: 1,
      agreedPriceMinor: 3000,
      costSnapshot: cost,
      createdAt: "2026-08-23T09:00:00.000Z",
    });
    await store.saveOrder({
      id: order.id,
      order,
      catalogItemId: null,
      deliveryDate: "2026-08-24",
      agreementSource: null,
      createdAt: "2026-08-23T09:00:00.000Z",
      updatedAt: "2026-08-23T09:00:00.000Z",
    });
    const service = new ActualTimeService(store, () => "2026-08-23T10:00:00.000Z");
    const recorded = await service.record({
      orderId: order.id,
      minutes: 75,
      recordedOn: "2026-08-23",
      note: "تنفيذ",
      operationKey: "reverse-record",
    });
    expect(recorded).toMatchObject({ ok: true, value: { minutesDelta: 75 } });
    if (!recorded.ok) return;
    await expect(service.readOrderActualTimeRecords(order.id)).resolves.toMatchObject({
      ok: true,
      value: [{ id: recorded.value.id, minutesDelta: 75 }],
    });
    const reversed = await service.reverse({
      targetId: recorded.value.id,
      recordedOn: "2026-08-24",
      reason: "سجلت بالخطأ",
      operationKey: "reverse-operation",
    });
    expect(reversed).toMatchObject({
      ok: true,
      value: {
        orderId: order.id,
        minutesDelta: -75,
        reversalOfId: recorded.value.id,
        reversalReason: "سجلت بالخطأ",
      },
    });
    await expect(
      service.reverse({
        targetId: recorded.value.id,
        recordedOn: "2026-08-24",
        reason: "سجلت بالخطأ",
        operationKey: "reverse-operation",
      }),
    ).resolves.toMatchObject({ ok: true, reused: true });
    await expect(service.readOrderActualTimeComparison(order.id)).resolves.toMatchObject({
      ok: true,
      value: { status: "not_recorded", actualMinutes: null, varianceMinutes: null, reversedRecordCount: 1 },
    });
  });

  it("marks an estimated planned time as needs_review while retaining the explanatory variance", async () => {
    const store = new MemoryLocalStore();
    const cost = calculateCostSnapshot("estimated-cost", {
      currency: "JOD",
      materialItems: [],
      time: { minutes: 60, hourlyRateMinor: 500, confidence: "estimated" },
      packagingMinor: 0,
      deliveryMinor: 0,
      wasteMinor: 0,
      safetyBufferMinor: 0,
      quantity: 1,
      createdAt: "2026-08-23T09:00:00.000Z",
      freshnessDays: null,
    });
    const order = createCraftOrder({
      id: "estimated-order",
      customerName: "اختبار",
      itemName: "خدمة تقديرية",
      specifications: "اختبار",
      quantity: 1,
      agreedPriceMinor: 3000,
      costSnapshot: cost,
      createdAt: "2026-08-23T09:00:00.000Z",
    });
    await store.saveOrder({
      id: order.id,
      order,
      catalogItemId: null,
      deliveryDate: "2026-08-24",
      agreementSource: null,
      createdAt: "2026-08-23T09:00:00.000Z",
      updatedAt: "2026-08-23T09:00:00.000Z",
    });
    const service = new ActualTimeService(store, () => "2026-08-23T10:00:00.000Z");
    await service.record({
      orderId: order.id,
      minutes: 75,
      recordedOn: "2026-08-23",
      note: null,
      operationKey: "estimated-record",
    });
    await expect(service.readOrderActualTimeComparison(order.id)).resolves.toMatchObject({
      ok: true,
      value: { status: "needs_review", plannedMinutes: 60, actualMinutes: 75, varianceMinutes: 15 },
    });
  });

  it("keeps missing planned time explicit when actual time exists", async () => {
    const store = new MemoryLocalStore();
    const cost = calculateCostSnapshot("missing-cost", {
      currency: "JOD",
      materialItems: [],
      time: null,
      packagingMinor: 0,
      deliveryMinor: 0,
      wasteMinor: 0,
      safetyBufferMinor: 0,
      quantity: 1,
      createdAt: "2026-08-23T09:00:00.000Z",
      freshnessDays: null,
    });
    const order = createCraftOrder({
      id: "missing-order",
      customerName: "اختبار",
      itemName: "خدمة ناقصة",
      specifications: "اختبار",
      quantity: 1,
      agreedPriceMinor: 3000,
      costSnapshot: cost,
      createdAt: "2026-08-23T09:00:00.000Z",
    });
    await store.saveOrder({
      id: order.id,
      order,
      catalogItemId: null,
      deliveryDate: "2026-08-24",
      agreementSource: null,
      createdAt: "2026-08-23T09:00:00.000Z",
      updatedAt: "2026-08-23T09:00:00.000Z",
    });
    const service = new ActualTimeService(store, () => "2026-08-23T10:00:00.000Z");
    await service.record({
      orderId: order.id,
      minutes: 75,
      recordedOn: "2026-08-23",
      note: null,
      operationKey: "missing-record",
    });
    await expect(service.readOrderActualTimeComparison(order.id)).resolves.toMatchObject({
      ok: true,
      value: { status: "needs_review", plannedMinutes: null, actualMinutes: 75, varianceMinutes: null },
    });
  });
});
