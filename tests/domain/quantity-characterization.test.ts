import { describe, expect, it } from "vitest";
import { quantityMilliExact } from "../../src/domain/shared/index.js";

/* المجموعة ٩ (STR-006): توصيف عقد الكمية الدقيق قبل توحيد مصدر الحقيقة —
 * يثبت هذا الملف سلوك `quantityMilliExact` الكنسي (D-02) كما هو حيًا على
 * رأس المجموعة ٨، بحدود القبول/الرفض كلها، قبل استبدال النسخ الثلاث في
 * طبقة التطبيق (g5/deliveryReview/recurringWork) بالمرجع نفسه.
 *
 * القاعدة المثبتة: القيمة تُقبل إذا وفقط إذا كانت موجبة ونهائية وقابلة
 * لتمثيل ملي داخل تسامح EPSILON واحد (أثر الفاصلة العائمة المتعمد)،
 * ونتاجها آمن عددًا صحيحًا. */

describe("quantityMilliExact characterization (A-04 / D-02 / STR-006)", () => {
  it("accepts integers and whole units exactly", () => {
    expect(quantityMilliExact(1)).toBe(1000);
    expect(quantityMilliExact(2)).toBe(2000);
    expect(quantityMilliExact(999)).toBe(999000);
  });

  it("accepts one-, two-, and three-decimal values at their exact milli result", () => {
    expect(quantityMilliExact(0.5)).toBe(500);
    expect(quantityMilliExact(0.25)).toBe(250);
    expect(quantityMilliExact(0.125)).toBe(125);
    expect(quantityMilliExact(1.5)).toBe(1500);
    expect(quantityMilliExact(1.25)).toBe(1250);
    expect(quantityMilliExact(0.001)).toBe(1);
    expect(quantityMilliExact(0.01)).toBe(10);
    expect(quantityMilliExact(0.1)).toBe(100);
    expect(quantityMilliExact(0.2)).toBe(200);
    expect(quantityMilliExact(0.3)).toBe(300);
    expect(quantityMilliExact(0.333)).toBe(333);
    expect(quantityMilliExact(0.334)).toBe(334);
    expect(quantityMilliExact(0.725)).toBe(725);
    expect(quantityMilliExact(0.735)).toBe(735);
    expect(quantityMilliExact(2.005)).toBe(2005);
    expect(quantityMilliExact(12.345)).toBe(12345);
    expect(quantityMilliExact(0.999)).toBe(999);
    expect(quantityMilliExact(999.999)).toBe(999999);
    expect(quantityMilliExact(12345.678)).toBe(12345678);
  });

  it("accepts floating-point artifacts within one EPSILON deliberately (0.1 + 0.2 family)", () => {
    expect(quantityMilliExact(0.30000000000000004)).toBe(300);
    expect(quantityMilliExact(0.1 + 0.2)).toBe(300);
    expect(quantityMilliExact(1.001)).toBe(1001);
    expect(quantityMilliExact(2.002)).toBe(2002);
  });

  it("rejects sub-milli and beyond-three-decimal values (no silent inflation)", () => {
    expect(quantityMilliExact(0.0005)).toBeNull();
    expect(quantityMilliExact(0.0004)).toBeNull();
    expect(quantityMilliExact(0.0015)).toBeNull();
    expect(quantityMilliExact(1.0005)).toBeNull();
    expect(quantityMilliExact(0.0001)).toBeNull();
    expect(quantityMilliExact(1e-7)).toBeNull();
  });

  it("rejects zero, negatives, and non-finite values", () => {
    expect(quantityMilliExact(0)).toBeNull();
    expect(quantityMilliExact(-1)).toBeNull();
    expect(quantityMilliExact(-0.5)).toBeNull();
    expect(quantityMilliExact(Number.NaN)).toBeNull();
    expect(quantityMilliExact(Number.POSITIVE_INFINITY)).toBeNull();
    expect(quantityMilliExact(Number.NEGATIVE_INFINITY)).toBeNull();
  });

  it("accepts exact-binary values at large magnitudes and rejects decimal magnitudes beyond the absolute EPSILON tolerance", () => {
    /* التسامح EPSILON مطلق لا نسبي: 10^9 سلسلة ثنائية تامة تُقبل كما هي،
     * أما القيم العشرية الكبيرة (خطأ تمثيلها النسبي يتجاوز EPSILON المطلق)
     * فتُرفض — حد القبول الفعلي دقة تمثيل لا حد الأعداد الآمنة. */
    expect(quantityMilliExact(1000000000)).toBe(1000000000000);
    expect(quantityMilliExact(9007199.254740993)).toBeNull();
  });

  it("documents why delivery-review aggregates in milli space: FP sums of individually-valid quantities can exceed the EPSILON tolerance", () => {
    /* كل قيمة منفردة مقبولة، لكن جمعها العشري يحمل خطأ فاصلة عائمة أكبر من
     * EPSILON — لهذا يجمع مسار مراجعة التسليم بنود المادة في فضاء الملي
     * الصحيح (مجموع المليات) لا جمع الكسور ثم التدوير. */
    expect(quantityMilliExact(1.001)).toBe(1001);
    expect(quantityMilliExact(1.001 + 1.001 + 1.001)).toBeNull();
    expect(quantityMilliExact(0.002 + 2.001)).toBeNull();
  });
});
