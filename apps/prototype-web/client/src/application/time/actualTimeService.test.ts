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

describe("Stage 2 — OPS-008: صدق مقارنة الوقت — السبب من مصدر الوقت لا من حالة اللقطة الكلية", () => {
  async function seedOrder(options: {
    materialConfidence: "known" | "estimated";
    time: { minutes: number | null; hourlyRateMinor: number; confidence: "known" | "estimated" } | null;
  }) {
    const store = new MemoryLocalStore();
    const cost = calculateCostSnapshot("ops8-cost", {
      currency: "JOD",
      materialItems:
        options.materialConfidence === "known"
          ? []
          : [
              {
                name: "خيط",
                quantity: 1,
                unit: "قطعة",
                unitPriceMinor: 1000,
                priceDate: "2026-08-01",
                source: "estimate",
                confidence: "estimated",
              },
            ],
      time: options.time,
      packagingMinor: 0,
      deliveryMinor: 0,
      wasteMinor: 0,
      safetyBufferMinor: 0,
      quantity: 1,
      createdAt: "2026-08-23T09:00:00.000Z",
      freshnessDays: null,
    });
    const order = createCraftOrder({
      id: "ops8-order",
      customerName: "سارة",
      itemName: "طرحة",
      specifications: "اختبار صدق الوقت",
      quantity: 1,
      agreedPriceMinor: 3000,
      costSnapshot: cost,
      createdAt: "2026-08-23T09:00:00.000Z",
    });
    await store.saveOrder({
      id: order.id,
      order,
      catalogItemId: null,
      deliveryDate: "2026-09-01",
      agreementSource: null,
      createdAt: "2026-08-23T09:00:00.000Z",
      updatedAt: "2026-08-23T09:00:00.000Z",
    });
    const service = new ActualTimeService(store, () => "2026-08-23T10:00:00.000Z");
    return { store, service, orderId: order.id };
  }

  it("مواد تقديرية مع وقت معروف: المقارنة «مسجلة» — المعرفة من مصدر الوقت نفسه (عقد ١٦ §٤)", async () => {
    const { service, orderId } = await seedOrder({
      materialConfidence: "estimated",
      time: { minutes: 60, hourlyRateMinor: 500, confidence: "known" },
    });
    await service.record({
      orderId,
      minutes: 75,
      recordedOn: "2026-08-23",
      note: "تنفيذ",
      operationKey: "ops8-record-a",
    });
    await expect(service.readOrderActualTimeComparison(orderId)).resolves.toMatchObject({
      ok: true,
      value: { status: "recorded", plannedMinutes: 60, actualMinutes: 75, varianceMinutes: 15 },
    });
  });

  it("وقت فعلي أقل من المخطط: فرق سالب صادق", async () => {
    const { service, orderId } = await seedOrder({
      materialConfidence: "known",
      time: { minutes: 60, hourlyRateMinor: 500, confidence: "known" },
    });
    await service.record({
      orderId,
      minutes: 30,
      recordedOn: "2026-08-23",
      note: "تنفيذ أسرع",
      operationKey: "ops8-record-b",
    });
    await expect(service.readOrderActualTimeComparison(orderId)).resolves.toMatchObject({
      ok: true,
      value: { status: "recorded", plannedMinutes: 60, actualMinutes: 30, varianceMinutes: -30 },
    });
  });

  it("دقائق مخططة صفرية: المخطط غير متاح لا صفر واثق، والفرق غير متاح", async () => {
    const { service, orderId } = await seedOrder({
      materialConfidence: "known",
      time: { minutes: 0, hourlyRateMinor: 500, confidence: "known" },
    });
    await service.record({
      orderId,
      minutes: 45,
      recordedOn: "2026-08-23",
      note: "تنفيذ بلا خطة وقت",
      operationKey: "ops8-record-c",
    });
    await expect(service.readOrderActualTimeComparison(orderId)).resolves.toMatchObject({
      ok: true,
      value: {
        status: "needs_review",
        plannedMinutes: null,
        actualMinutes: 45,
        varianceMinutes: null,
      },
    });
  });

  it("القراءة المتكررة لا تكتب شيئًا — مطابقة لقطة المخزن الكاملة", async () => {
    const { store, service, orderId } = await seedOrder({
      materialConfidence: "known",
      time: { minutes: 60, hourlyRateMinor: 500, confidence: "known" },
    });
    await service.record({
      orderId,
      minutes: 75,
      recordedOn: "2026-08-23",
      note: "تنفيذ",
      operationKey: "ops8-record-d",
    });
    const before = await store.readSnapshot();
    const first = await service.readOrderActualTimeComparison(orderId);
    const second = await service.readOrderActualTimeComparison(orderId);
    const after = await store.readSnapshot();
    expect(first.ok && second.ok).toBe(true);
    if (!first.ok || !second.ok) return;
    expect(second.value).toEqual(first.value);
    expect(after.ok && before.ok ? after.value : after).toEqual(before.ok ? before.value : before);
  });
});
