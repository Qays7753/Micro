import { describe, expect, it } from "vitest";
import { deriveCapacityDecision } from "./capacityDecisionService";
import type { ScheduleDay } from "./scheduleService";

const day = (overrides: Partial<ScheduleDay> = {}): ScheduleDay => ({
  date: "2026-08-24",
  items: [],
  scheduledMinutes: 90,
  unknownTimingCount: 0,
  conflictCount: 0,
  overCapacity: false,
  ...overrides,
});

describe("deriveCapacityDecision", () => {
  it.each([
    [null, "unknown"],
    [120, "within_limit"],
    [60, "over_limit"],
  ] as const)("returns %s as %s", (capacity, status) => {
    const result = deriveCapacityDecision(day({ overCapacity: capacity === 60 }), capacity);
    expect(result.status).toBe(status);
    expect(result.truth).not.toContain("ربح");
  });
  it("keeps missing timing as needs_review, not zero", () =>
    expect(deriveCapacityDecision(day({ scheduledMinutes: 0, unknownTimingCount: 1 }), 120)).toMatchObject({
      status: "needs_review",
      scheduledMinutes: 0,
      unknownTimingCount: 1,
    }));
  it("preserves conflicts as a separate warning", () =>
    expect(deriveCapacityDecision(day({ conflictCount: 2 }), 120)).toMatchObject({
      status: "within_limit",
      conflictCount: 2,
    }));
});
