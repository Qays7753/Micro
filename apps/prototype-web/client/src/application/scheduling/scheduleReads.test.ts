/**
 * S13 (DOC-022 / UNIT-006+012 — أمر 2158b0fc §6): إثبات القراءة النقية
 * لمجتمع المواعيد — لا كتابة أبدًا (U012-R16/U018-AC01)، والاكتمال يُشتق
 * من حالة الطلب عند القراءة، والطلب المؤكد بلا موعد لا يأخذ تاريخ اليوم
 * ولا 00:00، وطلب موعده معلوم بلا موعد مخزن يظهر «يحتاج جدولة» بصدق.
 */
import { describe, expect, it, vi } from "vitest";
import { readScheduleCommunity, windowOf, bucketOfDate } from "./scheduleReads";
import type { PrototypeLocalStore, StoredCraftOrder } from "@/storage/local/types";
import { MemoryLocalStore } from "@/storage/local/MemoryLocalStore";
import { calculateCostSnapshot, createCraftOrder } from "@micro-domain/craft-order/index.js";

const NOW = "2026-11-02T09:00:00.000Z";

function makeOrder(id: string, status: string, deliveryDate: string | null): StoredCraftOrder {
  const cost = calculateCostSnapshot(`${id}-cost`, {
    source: "draft",
    currency: "JOD",
    materialItems: [],
    time: { minutes: 60, hourlyRateMinor: 500, confidence: "known" },
    packagingMinor: 0,
    deliveryMinor: 0,
    wasteMinor: 0,
    safetyBufferMinor: 0,
    quantity: 1,
    createdAt: NOW,
    freshnessDays: null,
  });
  const order = createCraftOrder({
    id,
    customerName: "سارة",
    itemName: `طلب ${id}`,
    specifications: "اختبار",
    quantity: 1,
    agreedPriceMinor: 2000,
    costSnapshot: cost,
    createdAt: NOW,
  });
  return {
    id,
    order: { ...order, status: status as never },
    catalogItemId: null,
    deliveryDate,
    agreementSource: null,
    followUpSummary: null,
    followUpDate: null,
    followUpReason: null,
    followUpEvents: [],
    createdAt: NOW,
    updatedAt: NOW,
  };
}

function makeSchedule(id: string, orderId: string, date: string, time: string | null, status = "scheduled") {
  return {
    id,
    orderId,
    kind: "delivery" as const,
    scheduledFor: date,
    scheduledTime: time,
    durationMinutes: null,
    status: status as never,
    postponeReason: null,
    events: [],
    recurrenceId: null,
    recurrenceIndex: null,
    createdAt: NOW,
    updatedAt: NOW,
  };
}

describe("S13 — القراءة النقية لمجتمع المواعيد (scheduleReads)", () => {
  it("قراءة بلا أي كتابة: عدّاد الالتزامات صفر واللقطة بالبايت كما كانت", async () => {
    const real = new MemoryLocalStore();
    await real.saveOrder(makeOrder("order-a", "in_progress", "2026-11-10"));
    await real.saveSchedule(makeSchedule("schedule-a", "order-a", "2026-11-10", null));
    const commits = vi.fn();
    const store = new Proxy(real, {
      get(target, prop: string) {
        if (prop.startsWith("commit")) {
          const value = Reflect.get(target, prop, target) as unknown;
          return function wrapped(this: unknown, ...args: unknown[]) {
            commits();
            return (value as (...a: unknown[]) => unknown).apply(target, args);
          };
        }
        const value = Reflect.get(target, prop, target) as unknown;
        return typeof value === "function" ? (value as (...a: unknown[]) => unknown).bind(target) : value;
      },
    }) as unknown as PrototypeLocalStore;
    const before = await real.readSnapshot();
    const result = await readScheduleCommunity(store);
    expect(result.ok).toBe(true);
    expect(commits).toHaveBeenCalledTimes(0);
    const after = await real.readSnapshot();
    expect(after.ok && JSON.stringify(after.value)).toBe(before.ok ? JSON.stringify(before.value) : "");
  });

  it("الاكتمال مشتق قراءةً من تسليم الطلب — لا حدث مكتوب والموعد لا يظهر نشطًا", async () => {
    const store = new MemoryLocalStore();
    await store.saveOrder(makeOrder("order-b", "delivered", "2026-11-05"));
    await store.saveSchedule(makeSchedule("schedule-b", "order-b", "2026-11-05", "14:30"));
    const result = await readScheduleCommunity(store);
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error(result.message);
    expect(result.value.entries.find(entry => entry.schedule.id === "schedule-b")).toBeUndefined();
    expect(result.value.completedOrClosedCount).toBe(1);
    /* لا كتابة: الموعد المخزن ما زال بحالته الأصلية (scheduled) — الاشتقاق
     * قراءة فقط، والإصلاح الموثق عند مالكه. */
    const schedules = await store.listSchedules();
    expect(schedules.ok && schedules.value[0]?.status).toBe("scheduled");
  });

  it("ثلاث حقائق مختلفة: بلا موعد ≠ موعده معلوم بلا جدول ≠ فشل قراءة", async () => {
    const store = new MemoryLocalStore();
    await store.saveOrder(makeOrder("order-nodate", "in_progress", null));
    await store.saveOrder(makeOrder("order-dated", "in_progress", "2026-11-15"));
    const result = await readScheduleCommunity(store);
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error(result.message);
    expect(result.value.noDateOrders.map(order => order.id)).toEqual(["order-nodate"]);
    expect(result.value.datedUnscheduled.map(order => order.id)).toEqual(["order-dated"]);
  });

  it("S13-R4-F02: الموعد غير الصالح حقيقة رابعة — لا يُخلط بلا موعد ولا بموعد معلوم", async () => {
    const store = new MemoryLocalStore();
    await store.saveOrder(makeOrder("order-nodate", "in_progress", null));
    await store.saveOrder(makeOrder("order-dated", "in_progress", "2026-11-15"));
    /* قيمة فاسدة (شهر 13) — الكاتب يرفضها والاستيراد يرفضها قبل الكتابة؛
     * هذا التصنيف القرائي صدق العرض عند وجودها مهما كان مصدرها. */
    await store.saveOrder(makeOrder("order-invalid", "in_progress", "2026-13-45"));
    const result = await readScheduleCommunity(store);
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error(result.message);
    expect(result.value.noDateOrders.map(order => order.id)).toEqual(["order-nodate"]);
    expect(result.value.datedUnscheduled.map(order => order.id)).toEqual(["order-dated"]);
    expect(result.value.invalidDateOrders.map(order => order.id)).toEqual(["order-invalid"]);
  });

  it("نوافذ شهر/أسبوع/يوم من المجتمع نفسه — وقت بلا ساعة يبقى بلا 00:00", async () => {
    const store = new MemoryLocalStore();
    await store.saveOrder(makeOrder("order-c", "in_progress", "2026-11-10"));
    await store.saveOrder(makeOrder("order-d", "in_progress", "2026-11-12"));
    await store.saveSchedule(makeSchedule("schedule-c", "order-c", "2026-11-10", null));
    await store.saveSchedule(makeSchedule("schedule-d", "order-d", "2026-11-12", "09:00"));
    const result = await readScheduleCommunity(store);
    if (!result.ok) throw new Error(result.message);
    const month = windowOf(result.value, "2026-11-02", "month");
    expect(month.dates).toHaveLength(30);
    expect(month.byDate.get("2026-11-10")).toHaveLength(1);
    expect(month.byDate.get("2026-11-10")![0]!.schedule.scheduledTime).toBeNull();
    expect(month.byDate.get("2026-11-12")![0]!.schedule.scheduledTime).toBe("09:00");
    const week = windowOf(result.value, "2026-11-09", "week");
    expect(week.dates[0]).toBe("2026-11-09");
    expect(week.dates).toHaveLength(7);
    const day = windowOf(result.value, "2026-11-10", "day");
    expect(day.dates).toEqual(["2026-11-10"]);
  });

  it("تصنيف متأخر/اليوم/قادم تنظيم عرض — لا كتابة ولا مال (SDF-013)", () => {
    expect(bucketOfDate("2026-11-01", "2026-11-02")).toBe("overdue");
    expect(bucketOfDate("2026-11-02", "2026-11-02")).toBe("today");
    expect(bucketOfDate("2026-11-03", "2026-11-02")).toBe("upcoming");
  });
});
