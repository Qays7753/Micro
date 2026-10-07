import { describe, expect, it } from "vitest";
import {
  formatMoneyMinor,
  formatMoneyWithUnit,
  formatInteger,
  formatQuantityMilli,
  formatQuantityMilliFixed3,
  formatArabicPlural,
  formatLocalDate,
  formatMonthLabel,
  formatTime,
  businessDateFromTimestamp,
} from "./formatters";
/* واجهة التوافق المجمدة تعيد تصدير السطح نفسه — إثبات المساواة بالمراجع
 * جزء من التوصيف (البيت الكنوني واحد لا نسختان). */
import * as presentationFacade from "../../presentation/formatters";

/*
 * R2 (WS-216/ARCH-007 — بطاقة R2-MF-02): أول اختبار مباشر للبيت الكنوني
 * للتنسيق (`application/formatting/formatters.ts`). التغطية السابقة كلها كانت
 * عبر واجهة العرض (`presentation/formatters.test.ts`) — هذا الملف يستورد
 * المسار الكنوني نفسه ويثبّت الذهبيات، ويثبت أن الواجهة تعيد تصدير الدوال
 * ذاتها (لا نسخة ثانية).
 *
 * توصيف لا مواصفة: أي تغيير في هذه المخرجات نص مرئي يتطلب قرارًا (بطاقات R2).
 */

describe("R2 characterization — canonical formatting kernel money goldens", () => {
  it("formatMoneyMinor: two decimals + en-US grouping", () => {
    expect(formatMoneyMinor(123456)).toBe("1,234.56");
    expect(formatMoneyMinor(5)).toBe("0.05");
    expect(formatMoneyMinor(100)).toBe("1.00");
    expect(formatMoneyMinor(0)).toBe("0.00");
    expect(formatMoneyMinor(-250)).toBe("-2.50");
  });

  it("formatMoneyMinor: absent values render the em-dash placeholder", () => {
    expect(formatMoneyMinor(null)).toBe("—");
    expect(formatMoneyMinor(undefined)).toBe("—");
    expect(formatMoneyMinor(Number.NaN)).toBe("—");
  });

  it("formatMoneyWithUnit appends the JOD unit after one space (S4-06)", () => {
    expect(formatMoneyWithUnit(123456)).toBe("1,234.56 د.أ");
    expect(formatMoneyWithUnit(null)).toBe("—");
  });

  it("formatInteger groups without decimals", () => {
    expect(formatInteger(1234567)).toBe("1,234,567");
    expect(formatInteger(null)).toBe("—");
  });
});

describe("R2 characterization — quantity milli formatting (trim vs fixed3)", () => {
  it("formatQuantityMilli trims ALL trailing zeros (1.500 => 1.5)", () => {
    expect(formatQuantityMilli(1500)).toBe("1.5");
    expect(formatQuantityMilli(1000)).toBe("1");
    expect(formatQuantityMilli(1234)).toBe("1.234");
    expect(formatQuantityMilli(0)).toBe("0");
    expect(formatQuantityMilli(null)).toBe("—");
  });

  it("formatQuantityMilliFixed3 keeps exactly three decimals (1.500 stays 1.500)", () => {
    expect(formatQuantityMilliFixed3(1500)).toBe("1.500");
    expect(formatQuantityMilliFixed3(1000)).toBe("1.000");
    expect(formatQuantityMilliFixed3(1234)).toBe("1.234");
  });

  it("the input-layer echo trims only whole-fraction zeros — documented divergence (R2-D14)", () => {
    /* EnglishQuantityInput.tsx formatMilli المحلي يعطي "1.500" للقيمة نفسها
     * التي تعطيها النواة "1.5" — التباعد موثق كقرار R2-D14 لا يُوحَّد صمتًا. */
    expect(formatQuantityMilli(1500)).toBe("1.5");
  });
});

describe("R2 characterization — date/time display goldens", () => {
  it("formatLocalDate: DD/MM/YYYY from a valid date-only; null otherwise (no month names)", () => {
    expect(formatLocalDate("2026-01-05")).toBe("05/01/2026");
    expect(formatLocalDate("2024-02-29")).toBe("29/02/2024");
    expect(formatLocalDate("2023-02-29")).toBeNull();
    expect(formatLocalDate(null)).toBeNull();
    expect(formatLocalDate("garbage")).toBeNull();
  });

  it("formatMonthLabel: MM/YYYY from YYYY-MM", () => {
    expect(formatMonthLabel("2026-10")).toBe("10/2026");
    expect(formatMonthLabel("bad")).toBe("bad");
  });

  it("formatTime: 12-hour Arabic day-period with leading zero", () => {
    expect(formatTime("15:30")).toBe("03:30 م");
    expect(formatTime("00:05")).toBe("12:05 ص");
    expect(formatTime("12:00")).toBe("12:00 م");
    expect(formatTime("25:00")).toBeNull();
  });

  it("businessDateFromTimestamp: date-only passes through; instants derive the Amman business date", () => {
    expect(businessDateFromTimestamp("2026-10-07")).toBe("2026-10-07");
    expect(businessDateFromTimestamp("2026-10-07T21:30:00.000Z")).toBe("2026-10-08");
    expect(businessDateFromTimestamp(null)).toBeNull();
    expect(businessDateFromTimestamp("ليس تاريخًا")).toBeNull();
  });
});

describe("R2 characterization — Arabic plural rules", () => {
  it("follows the grammatical classes (0, 1, 2, 3-10, 11-99, 100+)", () => {
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
    expect(formatArabicPlural(5, forms)).toBe("5 طلبات");
    expect(formatArabicPlural(11, forms)).toBe("11 طلبًا");
    expect(formatArabicPlural(99, forms)).toBe("99 طلبًا");
    expect(formatArabicPlural(100, forms)).toBe("100 طلب");
    /* القاعدة تعتمد على آخر خانتين: 103 → 3 (قلة) لا «100+» — توصيف للسلوك الفعلي. */
    expect(formatArabicPlural(103, forms)).toBe("103 طلبات");
    expect(formatArabicPlural(111, forms)).toBe("111 طلبًا");
    expect(formatArabicPlural(null, forms)).toBe("—");
  });
});

describe("R2 characterization — presentation facade re-exports the canonical house (same references)", () => {
  it("the frozen compatibility facade exposes the identical kernel functions", () => {
    expect(presentationFacade.formatMoneyMinor).toBe(formatMoneyMinor);
    expect(presentationFacade.formatMoneyWithUnit).toBe(formatMoneyWithUnit);
    expect(presentationFacade.formatQuantityMilli).toBe(formatQuantityMilli);
    expect(presentationFacade.formatLocalDate).toBe(formatLocalDate);
    expect(presentationFacade.formatArabicPlural).toBe(formatArabicPlural);
  });
});
