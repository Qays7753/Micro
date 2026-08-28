import { describe, expect, it } from "vitest";
import {
  MIN_INTERACTIVE_DAY_TARGET_PX,
  MONTH_GRID_MIN_WIDTH_PX,
  monthGridColumnWidth,
} from "./scheduleLayout";

describe("phone-safe monthly schedule layout", () => {
  it("keeps the seven-day grid at or above the 44px touch target width", () => {
    expect(MONTH_GRID_MIN_WIDTH_PX).toBe(332);
    expect(MONTH_GRID_MIN_WIDTH_PX).toBe(7 * MIN_INTERACTIVE_DAY_TARGET_PX + 6 * 4);
  });

  it("identifies the narrow viewports that need the bounded scroll surface", () => {
    expect(monthGridColumnWidth(360, 12)).toBeLessThan(MIN_INTERACTIVE_DAY_TARGET_PX);
    expect(monthGridColumnWidth(390, 16)).toBeLessThan(MIN_INTERACTIVE_DAY_TARGET_PX);
    expect(monthGridColumnWidth(430, 16)).toBeGreaterThanOrEqual(MIN_INTERACTIVE_DAY_TARGET_PX);
  });
});
