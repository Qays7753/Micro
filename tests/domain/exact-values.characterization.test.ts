import { describe, expect, it } from "vitest";
import {
  ceilRatio,
  floorRatio,
  quantityMilliExact,
  roundHalfUp,
} from "../../src/domain/shared/index.js";

/**
 * المجموعة ١١ (المرحلة 11-0): تجميد القيم الدقيقة المعتمدة من المالك —
 * سياسة EXACT_VALUES_NO_SILENT_ROUNDING. كل مثال هنا عينات المالك الحرفية:
 * القيم تبقى كما هي عبر الإدخال والتخزين والقراءة والعرض، والكمية 1.001
 * تُقرأ بمليها 1001 (تصحيح المجموعة ٩ المعتمد — عقد مستقل لا يُفتح).
 * الدقة غير المدعومة تُرفض (null) ولا تُقرَّب أبدًا.
 */
describe("exact-values freeze — owner-approved quantity examples", () => {
  it("keeps the owner's literal examples exactly in milli", () => {
    expect(quantityMilliExact(2.7)).toBe(2700);
    expect(quantityMilliExact(8.9)).toBe(8900);
    expect(quantityMilliExact(6.3)).toBe(6300);
    expect(quantityMilliExact(1520.4)).toBe(1520400);
    expect(quantityMilliExact(1783.9)).toBe(1783900);
    expect(quantityMilliExact(1.001)).toBe(1001);
  });

  it("rejects sub-milli precision instead of silently rounding it", () => {
    expect(quantityMilliExact(0.0009)).toBeNull();
    expect(quantityMilliExact(1.0005)).toBeNull();
    expect(quantityMilliExact(2.70001)).toBeNull();
  });

  it("accepts floating-point sum artifacts at their intended milli value", () => {
    /* 0.1 + 0.2 = 0.30000000000000004 في الفاصلة العائمة — القصد العشري
     * 0.300 بالضبط، والمرجع الكنسي يقرؤه 300 مليًا لا يزيده ولا ينقصه. */
    expect(quantityMilliExact(0.1 + 0.2)).toBe(300);
    expect(quantityMilliExact(0.2 + 0.4)).toBe(600);
    expect(quantityMilliExact(3 * 0.1)).toBe(300);
  });

  it("fails closed on non-positive, non-finite, and out-of-safe-range quantities", () => {
    expect(quantityMilliExact(0)).toBeNull();
    expect(quantityMilliExact(-2.7)).toBeNull();
    expect(quantityMilliExact(Number.NaN)).toBeNull();
    expect(quantityMilliExact(Number.POSITIVE_INFINITY)).toBeNull();
    expect(quantityMilliExact(1e13)).toBeNull();
  });

  it("keeps large safe values exact", () => {
    expect(quantityMilliExact(1520400)).toBe(1520400000);
    expect(quantityMilliExact(1000000)).toBe(1000000000);
  });
});

describe("exact-values freeze — money division contracts stay integer-exact", () => {
  it("roundHalfUp keeps half-away-from-zero on exact halves of both signs", () => {
    expect(roundHalfUp(15, 10)).toBe(2);
    expect(roundHalfUp(5, 10)).toBe(1);
    expect(roundHalfUp(-15, 10)).toBe(-2);
    expect(roundHalfUp(-5, 10)).toBe(-1);
    expect(roundHalfUp(4, 10)).toBe(0);
    expect(roundHalfUp(6, 10)).toBe(1);
  });

  it("roundHalfUp keeps the owner examples at their exact unit prices", () => {
    /* 10.01 د.أ لكل 2.000 وحدة: 1001 minor على 2000 ملي = 500.5 بالضبط
     * → نصف-أعلى بعيدًا عن الصفر يعطي 501 (لا 500 كالفاصلة العائمة). */
    expect(roundHalfUp(1001 * 1000, 2000)).toBe(501);
    /* 1520.4 د.أ على 1.000 وحدة = 152040 minor بالضبط. */
    expect(roundHalfUp(152040 * 1000, 1000)).toBe(152040);
  });

  it("directed ratios keep their named contracts (asset floor, break-even ceil)", () => {
    expect(floorRatio(100, 3)).toBe(33);
    expect(ceilRatio(1000, 3)).toBe(334);
    expect(ceilRatio(-1, 10)).toBeNull();
  });

  it("refuses unsafe integers and non-positive denominators (fail closed)", () => {
    expect(roundHalfUp(Number.MAX_SAFE_INTEGER + 2, 10)).toBeNull();
    expect(roundHalfUp(10, 0)).toBeNull();
    expect(floorRatio(0.5, 1)).toBeNull();
    expect(ceilRatio(10.5, 1)).toBeNull();
  });
});
