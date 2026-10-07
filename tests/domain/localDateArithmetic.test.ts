import { describe, expect, it } from "vitest";
import {
  daysInMonthOf,
  isValidLocalDate,
  localDateMonthEnd,
  localDatePlusDays,
  localDatePlusMonthsClamped,
  localDateWeekdayIndex,
  localDateDayNumber,
  sumSafeIntegers,
  addSafe,
} from "../../src/domain/shared/index.js";

/*
 * R2 (WS-216/ARCH-007 — M-01/M-02، 2026-10-08): انحدار نواة التاريخ المحلي
 * الكنسية بعد إعادة كتابتها حسابًا صحيحًا خالصًا. يثبّت:
 *  1) سياسة السنوات الصريحة (ISO 0000–9999، غريغوري استباقي)؛
 *  2) تكافؤ الحساب الجديد مع الخوارزميات التاريخية (Date.UTC/المرساة) على
 *     المدى الذي كانت فيه صحيحة (السنوات ≥ 0100) — فلا انجراف صامت؛
 *  3) عقود الحدود: null صريحًا خارج النطاق القابل للتمثيل بدل سلاسل موسعة؛
 *  4) المجموع الآمن (طيّ addSafe) بفيض الاتجاهين.
 */

/** الخوارزمية التاريخية للنواة (قبل R2) — تُعاد هنا حرفيًا للمقارنة فقط. */
function legacyDateUtcRoundTrip(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year!, month! - 1, day!));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month! - 1 && date.getUTCDate() === day;
}

/** خوارزمية المرساة التاريخية (± أيام) — للمقارنة على السنوات ≥ 0100. */
function legacyAnchorPlusDays(value: string, days: number): string {
  const date = new Date(`${value}T12:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

const LEGACY_EQUIVALENCE_DATES = [
  "2026-01-01",
  "2024-02-28",
  "2024-02-29",
  "2023-02-28",
  "2000-02-29",
  "1900-02-28",
  "2100-02-28",
  "2400-02-29",
  "0100-01-01",
  "1970-01-01",
  "9999-12-31",
  "2026-12-31",
  "2026-03-01",
  "1600-03-01",
];

describe("R2 kernel — isValidLocalDate explicit ISO policy (0000–9999)", () => {
  it("accepts the full four-digit range including years 0000–0099", () => {
    for (const value of ["0000-01-01", "0000-02-29", "0050-01-01", "0099-12-31", "0100-01-01", "9999-12-31"])
      expect(isValidLocalDate(value)).toBe(true);
  });

  it("accepts real leap days and rejects phantom ones per proleptic Gregorian", () => {
    for (const value of ["2024-02-29", "2000-02-29", "1600-02-29", "2400-02-29", "0000-02-29"])
      expect(isValidLocalDate(value)).toBe(true);
    for (const value of ["2023-02-29", "1900-02-29", "2100-02-29", "2026-02-30", "2026-04-31", "2026-13-01"])
      expect(isValidLocalDate(value)).toBe(false);
  });

  it("rejects grammar violations, timestamps, and empties without throwing", () => {
    for (const value of [
      "2026-1-5",
      "2026-01-5",
      "26-01-05",
      "2026-00-10",
      "2026-01-00",
      "2026-01-32",
      "2026-01-05T10:00:00Z",
      "2026-01-05 10:00",
      "",
      "not-a-date",
    ])
      expect(isValidLocalDate(value)).toBe(false);
  });

  it("matches the legacy Date.UTC kernel byte-for-byte for years ≥ 0100 (no drift)", () => {
    for (let year = 100; year <= 9999; year += 37) {
      for (const month of [1, 2, 4, 12]) {
        for (const day of [1, 15, 28]) {
          const value = `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
          expect(isValidLocalDate(value)).toBe(legacyDateUtcRoundTrip(value));
        }
      }
    }
  });
});

describe("R2 kernel — localDatePlusDays pure-integer day arithmetic", () => {
  it("shifts across leap days, month and year boundaries exactly", () => {
    expect(localDatePlusDays("2024-02-28", 1)).toBe("2024-02-29");
    expect(localDatePlusDays("2024-02-29", 1)).toBe("2024-03-01");
    expect(localDatePlusDays("2023-02-28", 1)).toBe("2023-03-01");
    expect(localDatePlusDays("2026-12-31", 1)).toBe("2027-01-01");
    expect(localDatePlusDays("2027-01-01", -1)).toBe("2026-12-31");
    expect(localDatePlusDays("2026-10-07", 84)).toBe("2026-12-30");
  });

  it("returns null for invalid input and for results outside 0000–9999", () => {
    expect(localDatePlusDays("2026-13-01", 1)).toBeNull();
    expect(localDatePlusDays("garbage", 1)).toBeNull();
    expect(localDatePlusDays("9999-12-31", 1)).toBeNull();
    expect(localDatePlusDays("0000-01-01", -1)).toBeNull();
    expect(localDatePlusDays("0050-01-01", 5)).toBe("0050-01-06");
  });

  it("matches the legacy noon-anchor arithmetic for years ≥ 0100 (no drift)", () => {
    /* حدود التمثيل (9999+400 يوم) مستثناة من التكافؤ — عقدها الجديد null
     * الصريح، وهو المثبت في حالة الحدود أعلاه (القديم أنتج "+010000-01"). */
    for (const date of LEGACY_EQUIVALENCE_DATES.slice(0, 10)) {
      for (const days of [-400, -30, -1, 0, 1, 7, 30, 400]) {
        expect(localDatePlusDays(date, days)).toBe(legacyAnchorPlusDays(date, days));
      }
    }
  });
});

describe("R2 kernel — localDatePlusMonthsClamped calendar month shift", () => {
  it("clamps the day to the target month's last day", () => {
    expect(localDatePlusMonthsClamped("2026-01-31", 1)).toBe("2026-02-28");
    expect(localDatePlusMonthsClamped("2024-01-31", 1)).toBe("2024-02-29");
    expect(localDatePlusMonthsClamped("2026-03-31", -1)).toBe("2026-02-28");
    expect(localDatePlusMonthsClamped("2026-12-15", 3)).toBe("2027-03-15");
  });

  it("rejects invalid input and out-of-range results with null", () => {
    expect(localDatePlusMonthsClamped("2026-13-01", 1)).toBeNull();
    expect(localDatePlusMonthsClamped("9999-12-01", 1)).toBeNull();
    expect(localDatePlusMonthsClamped("0000-01-01", -1)).toBeNull();
  });
});

describe("R2 kernel — weekday, day-number, month-end primitives", () => {
  it("weekday index matches getUTCDay semantics (0 = Sunday; 1970-01-01 = Thursday)", () => {
    expect(localDateWeekdayIndex("1970-01-01")).toBe(4);
    expect(localDateWeekdayIndex("2026-10-07")).toBe(new Date("2026-10-07T12:00:00.000Z").getUTCDay());
    for (const date of LEGACY_EQUIVALENCE_DATES)
      expect(localDateWeekdayIndex(date)).toBe(new Date(`${date}T12:00:00.000Z`).getUTCDay());
    expect(localDateWeekdayIndex("bad")).toBeNull();
  });

  it("day numbers match the historical Date.UTC/86400000 axis for years ≥ 0100", () => {
    expect(localDateDayNumber("1970-01-01")).toBe(0);
    for (const date of LEGACY_EQUIVALENCE_DATES)
      expect(localDateDayNumber(date)).toBe(
        Date.UTC(Number(date.slice(0, 4)), Number(date.slice(5, 7)) - 1, Number(date.slice(8, 10))) / 86_400_000,
      );
    expect(localDateDayNumber("bad")).toBeNull();
  });

  it("month-end resolves leap February and rejects malformed keys", () => {
    expect(localDateMonthEnd("2026-02")).toBe("2026-02-28");
    expect(localDateMonthEnd("2024-02")).toBe("2024-02-29");
    expect(localDateMonthEnd("0000-02")).toBe("0000-02-29");
    expect(localDateMonthEnd("2026-12")).toBe("2026-12-31");
    expect(localDateMonthEnd("2026-13")).toBeNull();
    expect(localDateMonthEnd("2026-2")).toBeNull();
  });

  it("daysInMonthOf returns the calendar table (precondition: month 1–12)", () => {
    expect(daysInMonthOf(2026, 2)).toBe(28);
    expect(daysInMonthOf(2024, 2)).toBe(29);
    expect(daysInMonthOf(1900, 2)).toBe(28);
    expect(daysInMonthOf(2000, 2)).toBe(29);
    expect(daysInMonthOf(2026, 4)).toBe(30);
    expect(daysInMonthOf(2026, 12)).toBe(31);
  });
});

describe("R2 kernel — sumSafeIntegers folds addSafe with both-direction overflow guard", () => {
  it("sums empty to zero and plain integers exactly", () => {
    expect(sumSafeIntegers([])).toBe(0);
    expect(sumSafeIntegers([1, 2, 3])).toBe(6);
    expect(sumSafeIntegers([-5, 12])).toBe(7);
  });

  it("returns null on overflow in either direction or any non-safe integer", () => {
    const max = Number.MAX_SAFE_INTEGER;
    expect(sumSafeIntegers([max, 1])).toBeNull();
    expect(sumSafeIntegers([-max, -1])).toBeNull();
    expect(sumSafeIntegers([1.5, 2])).toBeNull();
    expect(sumSafeIntegers([Number.NaN])).toBeNull();
  });

  it("is exactly the fold of addSafe over its inputs", () => {
    const values = [7, -3, 1000, 0, 999];
    let folded: number | null = 0;
    for (const value of values) folded = folded === null ? null : addSafe(folded, value);
    expect(sumSafeIntegers(values)).toBe(folded);
  });
});
