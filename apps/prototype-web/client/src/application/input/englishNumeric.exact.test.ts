import { describe, expect, it } from "vitest";
import { echoQuantityMilli, percentToBpsExact } from "./englishNumeric";

/**
 * المجموعة ١١ (المرحلة 11-0 — سياسة EXACT_VALUES_NO_SILENT_ROUNDING):
 * حدود الدقة للنسبة والكمية — التحويل الدقيق فقط، والدقة غير المدعومة
 * تُرفض بنتيجة null (fail closed) لا أن تُقرَّب صامتة.
 */
describe("percentToBpsExact — exact percent → basis points", () => {
  it("keeps two-decimal percentages exactly as whole basis points", () => {
    expect(percentToBpsExact(33.35)).toBe(3335);
    expect(percentToBpsExact(0.01)).toBe(1);
    expect(percentToBpsExact(100)).toBe(10000);
    expect(percentToBpsExact(12.5)).toBe(1250);
    expect(percentToBpsExact(33.5)).toBe(3350);
    expect(percentToBpsExact(0)).toBe(0);
    /* نص «0.3» يُحلَّل 0.3 (أقرب مضاعف) فيقبل 30 bps بالضبط. */
    expect(percentToBpsExact(Number("0.3"))).toBe(30);
  });

  it("rejects precision finer than a whole basis point instead of rounding it", () => {
    /* 33.335% = 3333.5 bps — ليست أساس نقطة صحيحًا فترفض لا تُقرَّب إلى 3334. */
    expect(percentToBpsExact(33.335)).toBeNull();
    expect(percentToBpsExact(0.005)).toBeNull();
    expect(percentToBpsExact(0.0049)).toBeNull();
    expect(percentToBpsExact(2.675)).toBeNull();
    expect(percentToBpsExact(66.667)).toBeNull();
  });

  it("fails closed on invalid magnitudes", () => {
    expect(percentToBpsExact(-1)).toBeNull();
    expect(percentToBpsExact(Number.NaN)).toBeNull();
    expect(percentToBpsExact(Number.POSITIVE_INFINITY)).toBeNull();
    expect(percentToBpsExact(1e15)).toBeNull();
  });
});

describe("echoQuantityMilli — display/input echo to whole milli", () => {
  it("keeps the owner's exact examples", () => {
    expect(echoQuantityMilli(0)).toBe(0);
    expect(echoQuantityMilli(2.7)).toBe(2700);
    expect(echoQuantityMilli(8.9)).toBe(8900);
    expect(echoQuantityMilli(6.3)).toBe(6300);
    expect(echoQuantityMilli(1520.4)).toBe(1520400);
    expect(echoQuantityMilli(1783.9)).toBe(1783900);
    expect(echoQuantityMilli(1.001)).toBe(1001);
    expect(echoQuantityMilli(0.1 + 0.2)).toBe(300);
  });

  it("rejects non-milli-representable values instead of silently rounding them", () => {
    expect(echoQuantityMilli(1.0001)).toBeNull();
    expect(echoQuantityMilli(0.0009)).toBeNull();
    expect(echoQuantityMilli(-2.7)).toBeNull();
    expect(echoQuantityMilli(Number.NaN)).toBeNull();
    expect(echoQuantityMilli(1e13)).toBeNull();
  });
});
