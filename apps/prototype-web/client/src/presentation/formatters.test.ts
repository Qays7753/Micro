import { describe, expect, it } from "vitest";
import {
  formatArabicPlural,
  formatBreakEvenDisplay,
  formatLocalDate,
  formatLocalDateLong,
  formatLocalDateTime,
  formatMoneyMinor,
  formatMonthLabel,
  localDateInAmman,
} from "./formatters";

describe("presentation formatters", () => {
  it("formats positive, negative, and zero JOD minor units with ASCII digits", () => {
    expect(formatMoneyMinor(123456)).toBe("1,234.56");
    expect(formatMoneyMinor(-1250)).toBe("-12.50");
    expect(formatMoneyMinor(0)).toBe("0.00");
    expect(/[٠-٩]/.test(formatMoneyMinor(123456))).toBe(false);
  });

  it("uses Arabic plural forms for the boundary counts called out in M-22", () => {
    const forms = {
      zero: "لا طلبات",
      one: "طلب واحد",
      two: "طلبان",
      few: "طلبات",
      many: "طلبًا",
      other: "طلب",
    };
    expect(formatArabicPlural(0, forms)).toBe("لا طلبات");
    expect(formatArabicPlural(1, forms)).toBe("طلب واحد");
    expect(formatArabicPlural(2, forms)).toBe("طلبان");
    expect(formatArabicPlural(3, forms)).toBe("3 طلبات");
    expect(formatArabicPlural(10, forms)).toBe("10 طلبات");
    expect(formatArabicPlural(11, forms)).toBe("11 طلبًا");
    expect(formatArabicPlural(100, forms)).toBe("100 طلب");
  });

  it("formats known local dates without letting RTL reorder the date", () => {
    expect(formatLocalDate("2026-08-24")).toBe("24/08/2026");
    expect(formatLocalDate("2026-02-30")).toBeNull();
    expect(formatLocalDate(null)).toBeNull();
  });

  it("renders a selected local date as a readable Arabic date without changing ISO storage", () => {
    const display = formatLocalDateLong("2026-09-05");
    expect(display).toContain("2026");
    expect(display).toContain("5");
    expect(display).not.toContain("09/05/2026");
    expect(formatLocalDateLong("2026-02-30")).toBeNull();
    expect(formatLocalDateLong(null)).toBeNull();
  });

  it("keeps a UTC instant on the correct Amman calendar date", () => {
    expect(localDateInAmman("2026-08-23T22:30:00.000Z")).toBe("2026-08-24");
    expect(formatLocalDateTime("2026-08-23T22:30:00.000Z")).toBe("24/08/2026 01:30");
  });

  it("renders month context in Arabic while preserving the underlying YYYY-MM value elsewhere", () => {
    expect(formatMonthLabel("2026-08")).toContain("2026");
    expect(formatMonthLabel("not-a-month")).toBe("not-a-month");
  });

  it("labels break-even with the organized unit instead of generic وحدة", () => {
    expect(formatBreakEvenDisplay(3, "dozen", "دزينة")).toEqual({ number: "3", scale: "دزينة" });
    expect(formatBreakEvenDisplay(3, "piece", " قطعة ")).toEqual({ number: "3", scale: "قطعة" });
  });

  it("labels legacy recorded mix explicitly and never falls back to generic وحدة", () => {
    const display = formatBreakEvenDisplay(3, "legacy:recorded-mix", "قطعة");
    expect(display).toEqual({ number: "3", scale: "من المزيج المسجل" });
    expect(display?.scale).not.toBe("وحدة");
    expect(formatBreakEvenDisplay(3, null, null)?.scale).toBe("من المزيج المسجل");
    expect(formatBreakEvenDisplay(3, null, "دزينة")?.scale).toBe("من المزيج المسجل");
  });

  it("keeps unavailable break-even as null so the UI can show غير متاحة with its reason", () => {
    expect(formatBreakEvenDisplay(null, "piece", "قطعة")).toBeNull();
    expect(formatBreakEvenDisplay(0, "piece", "قطعة")).toBeNull();
  });
});
