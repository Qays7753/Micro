import { describe, expect, it } from "vitest";
import { buildCapacityDecisionViewModel } from "./capacityDecisionViewModel";
import type { ScheduleDay } from "./scheduleService";

const baseDay = (overrides: Partial<ScheduleDay> = {}): ScheduleDay => ({
  date: "2026-08-24",
  items: [],
  scheduledMinutes: 90,
  unknownTimingCount: 0,
  conflictCount: 0,
  overCapacity: false,
  ...overrides,
});

describe("buildCapacityDecisionViewModel", () => {
  it("connects unknown capacity to honest copy and a manual next action", () => {
    const model = buildCapacityDecisionViewModel(baseDay(), null);
    expect(model).toMatchObject({ status: "unknown", label: "سعة اليوم غير محددة", tone: "support" });
    expect(model.truth).toContain("لا يعرض Micro رفضًا أو سعة صفرية");
    expect(model.nextAction).toContain("حدد سعة يومية");
  });

  it.each([
    ["needs_review", baseDay({ unknownTimingCount: 1 }), 120, "لم تحول البيانات الناقصة إلى صفر"],
    ["within_limit", baseDay(), 120, "لا يعني ذلك ضمان توفر كامل"],
    ["over_limit", baseDay({ overCapacity: true }), 60, "يتجاوز القيد اليومي المعلن"],
  ] as const)("connects %s to its canonical truth and next action", (status, day, capacity, truth) => {
    const model = buildCapacityDecisionViewModel(day, capacity);
    expect(model.status).toBe(status);
    expect(model.truth).toContain(truth);
    expect(model.nextAction.length).toBeGreaterThan(0);
  });

  it("keeps a conflict visible as a separate decision field", () => {
    const model = buildCapacityDecisionViewModel(baseDay({ conflictCount: 2 }), 120);
    expect(model.status).toBe("within_limit");
    expect(model.conflictCount).toBe(2);
    expect(model.truth).toContain("لا يعني ذلك ضمان توفر كامل");
  });
});
