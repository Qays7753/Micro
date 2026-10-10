/** R7 / R6-F17-P06 (2026-10-10): عقد سطح استعلام صفحة الجدول — الترتيب
 * وأسبقية الرسائل ومعامل طبقة السعة. */
import { describe, expect, it } from "vitest";
import { capacityLayerParam, readSchedulePage } from "./scheduleViewModel";
import type { ScheduleService } from "./scheduleService";
import type { ScheduleRecurrenceService } from "./recurrenceService";

const ok = <T>(value: T) => ({ ok: true as const, value });

describe("R7/P06 — القراءة الثلاثية", () => {
  it("نجاحها معًا: ready بكل القيم", async () => {
    const deps = {
      schedules: {
        overview: async () => ok({ marker: "overview" }),
        monthOverview: async () => ok({ marker: "month" }),
      } as unknown as ScheduleService,
      recurrences: { list: async () => ok([]) } as unknown as ScheduleRecurrenceService,
    };
    const state = await readSchedulePage(deps, "2026-09");
    expect(state.phase).toBe("ready");
  });

  it("فشل أي قراءة: رسالة الأولى الفاشلة بترتيبها الأصلي؛ والرفض بنص الاحتياط", async () => {
    const fail = (message: string) => ({ ok: false as const, message });
    const base = {
      recurrences: { list: async () => ok([]) } as unknown as ScheduleRecurrenceService,
    };
    const monthFail = await readSchedulePage(
      {
        ...base,
        schedules: {
          overview: async () => ok({}),
          monthOverview: async () => fail("رسالة الشهر"),
        } as unknown as ScheduleService,
      },
      "2026-09",
    );
    expect(monthFail).toEqual({ phase: "error", message: "رسالة الشهر" });
    const rejected = await readSchedulePage(
      {
        ...base,
        schedules: {
          overview: () => Promise.reject(new Error("x")),
          monthOverview: async () => ok({}),
        } as unknown as ScheduleService,
      },
      "2026-09",
    );
    expect(rejected).toEqual({ phase: "error", message: "تعذر قراءة جدول المواعيد المحلي." });
  });
});

describe("R7/P06 — معامل طبقة السعة", () => {
  it("focus=capacity|recurrence يفتح الطبقة؛ وغيرهما يُهمل بهدوء", () => {
    expect(capacityLayerParam("?focus=capacity")).toBe(true);
    expect(capacityLayerParam("?focus=recurrence")).toBe(true);
    expect(capacityLayerParam("?focus=other")).toBe(false);
    expect(capacityLayerParam(null)).toBe(false);
  });
});
