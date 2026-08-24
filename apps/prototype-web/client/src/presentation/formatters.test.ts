import { describe, expect, it } from "vitest";
import { formatLocalDate, formatLocalDateTime, formatMoneyMinor, formatMonthLabel, localDateInAmman } from "./formatters";

describe("presentation formatters", () => {
  it("formats positive, negative, and zero JOD minor units with ASCII digits", () => {
    expect(formatMoneyMinor(123456)).toBe("1,234.56");
    expect(formatMoneyMinor(-1250)).toBe("-12.50");
    expect(formatMoneyMinor(0)).toBe("0.00");
    expect(/[٠-٩]/.test(formatMoneyMinor(123456))).toBe(false);
  });

  it("formats known local dates without letting RTL reorder the date", () => {
    expect(formatLocalDate("2026-08-24")).toBe("24/08/2026");
    expect(formatLocalDate("2026-02-30")).toBeNull();
    expect(formatLocalDate(null)).toBeNull();
  });

  it("keeps a UTC instant on the correct Amman calendar date", () => {
    expect(localDateInAmman("2026-08-23T22:30:00.000Z")).toBe("2026-08-24");
    expect(formatLocalDateTime("2026-08-23T22:30:00.000Z")).toBe("24/08/2026 01:30");
  });

  it("renders month context in Arabic while preserving the underlying YYYY-MM value elsewhere", () => {
    expect(formatMonthLabel("2026-08")).toContain("2026");
    expect(formatMonthLabel("not-a-month")).toBe("not-a-month");
  });
});
