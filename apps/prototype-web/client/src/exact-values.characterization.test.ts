import { describe, expect, it } from "vitest";
import {
  allowsEnglishNumericText,
  formatEnglishNumericValue,
  parseEnglishNumericText,
  parseEnglishQuantityText,
} from "@/application/input/englishNumeric";
import { blurQuantityText } from "@/components/forms/EnglishQuantityInput";
import { formatMoneyMinor, formatMoneyWithUnit, formatQuantityMilli } from "@/presentation/formatters";

/**
 * المجموعة ١١ (المرحلة 11-0): تجميد القيم الدقيقة عبر أسطح الإدخال والعرض —
 * نفس القيمة الدلالية تظهر في الإدخال والقراءة والعرض بلا تغيير رقمي، ولا
 * تدوين علمي ولا شوائب ثنائية (0.30000000000000004) ولا تقريب صامت. الدقة
 * غير المدعومة تُرفض عند حد الإدخال (fail closed) لا أن تُقرَّب.
 */
describe("exact-values freeze — input boundary keeps the owner examples exact", () => {
  it("parses the owner's literal quantity examples to their exact milli", () => {
    expect(parseEnglishQuantityText("2.7")).toBe(2700);
    expect(parseEnglishQuantityText("8.9")).toBe(8900);
    expect(parseEnglishQuantityText("6.3")).toBe(6300);
    expect(parseEnglishQuantityText("1520.4")).toBe(1520400);
    expect(parseEnglishQuantityText("1783.9")).toBe(1783900);
    expect(parseEnglishQuantityText("1.001")).toBe(1001);
  });

  it("rejects unsupported four-decimal quantity text at the boundary", () => {
    /* حد الإدخال الكمي يرفض المنزلة الرابعة عند التحليل (النمط الجزئي يسمح
     * مؤقتًا بالكتابة لكن الالتزام لا يحدث إلا بتحليل صحيح — fail closed). */
    expect(parseEnglishQuantityText("1.0001")).toBeNull();
    expect(parseEnglishQuantityText("2.70001")).toBeNull();
    expect(parseEnglishQuantityText("0.0009")).toBeNull();
  });

  it("parses money text to exact minor units and rejects sub-qirsh precision", () => {
    expect(parseEnglishNumericText("10.01", "money")).toBe(1001);
    expect(parseEnglishNumericText("1520.4", "money")).toBe(152040);
    expect(parseEnglishNumericText("0.1", "money")).toBe(10);
    expect(parseEnglishNumericText("12.345", "money")).toBeNull();
  });

  it("parses percentage text to whole basis points exactly and rejects finer precision", () => {
    /* النسبة المخزنة أساس نقطة صحيح (bps) — منزلتا النسبة المئوية هما الحد
     * الممثل؛ الأدق يُرفض عند الإدخال بلا تقريب صامت (سياسة القيم الدقيقة). */
    expect(parseEnglishNumericText("33.35", "percentage")).toBe(3335);
    expect(parseEnglishNumericText("0.01", "percentage")).toBe(1);
    expect(parseEnglishNumericText("100", "percentage")).toBe(10000);
    expect(parseEnglishNumericText("33.335", "percentage")).toBeNull();
    expect(allowsEnglishNumericText("33.335", "percentage")).toBe(false);
  });

  it("money and percentage input echo round-trips without value mutation", () => {
    expect(formatEnglishNumericValue(1001, "money")).toBe("10.01");
    expect(formatEnglishNumericValue(1001, "percentage")).toBe("10.01");
    expect(parseEnglishNumericText(formatEnglishNumericValue(152040, "money"), "money")).toBe(152040);
    expect(parseEnglishNumericText(formatEnglishNumericValue(3335, "percentage"), "percentage")).toBe(3335);
  });

  it("quantity input echo keeps the same milli value through blur re-formatting", () => {
    /* إدخال 2.7 ثم إعادة التنسيق عند الخروج تعرض «2.700» (سياسة صدى
     * الإدخال) — القيمة الملتزمة تبقى 2700 مليًا بلا أي تغيير رقمي. */
    const first = blurQuantityText("2.7", null);
    expect(first).toMatchObject({ committed: 2700, valid: true });
    const second = blurQuantityText(first.text, first.committed);
    expect(second.committed).toBe(2700);
    const third = blurQuantityText(second.text, second.committed);
    expect(third.committed).toBe(2700);
  });
});

describe("exact-values freeze — canonical display formatters keep values exact", () => {
  it("formats the owner's quantity examples without mutation or binary artifacts", () => {
    expect(formatQuantityMilli(2700)).toBe("2.7");
    expect(formatQuantityMilli(8900)).toBe("8.9");
    expect(formatQuantityMilli(6300)).toBe("6.3");
    expect(formatQuantityMilli(1520400)).toBe("1520.4");
    expect(formatQuantityMilli(1783900)).toBe("1783.9");
    expect(formatQuantityMilli(1001)).toBe("1.001");
    expect(formatQuantityMilli(0)).toBe("0");
    expect(formatQuantityMilli(300)).toBe("0.3");
    expect(formatQuantityMilli(500)).toBe("0.5");
  });

  it("formats money in canonical 2-decimal form without value mutation", () => {
    expect(formatMoneyMinor(1001)).toBe("10.01");
    expect(formatMoneyMinor(500)).toBe("5.00");
    expect(formatMoneyMinor(271)).toBe("2.71");
    expect(formatMoneyMinor(152040)).toBe("1,520.40");
    expect(formatMoneyMinor(178390)).toBe("1,783.90");
    expect(formatMoneyWithUnit(1001)).toBe("10.01 د.أ");
  });

  it("quantity display text parses back to the identical milli (display never mutates value)", () => {
    for (const milli of [2700, 8900, 6300, 1520400, 1783900, 1001, 300, 0]) {
      const displayed = formatQuantityMilli(milli);
      expect(parseEnglishQuantityText(displayed === "0" ? "0" : displayed)).toBe(milli);
    }
  });
});
