import { describe, expect, it } from "vitest";
import { isLocalDate } from "./transferFamilyValidators";
import { isValidLocalDate } from "@micro-domain/shared/index.js";

/*
 * R2 (WS-216/ARCH-007): كان هذا الملف يوثّق تباعد متغير النقل (الصنف B —
 * transferFamilyValidators.isLocalDate) عن نواة المجال (الصنف A —
 * domain/shared/numeric.isValidLocalDate) عند حدّين: السنوات 0000–0099
 * (النواة ترفضها صدفةً؛ B تقبلها) والمكونات خارج النحو (B ترمي RangeError
 * عبر مسار استيراد غير محموم).
 *
 * تحديث مؤرخ 2026-10-08 (الإصلاح الجذري — M-01/M-03): التباعد زال — مدقق
 * النقل يفوّض الآن إلى النواة الكنسية (حساب خالص، سياسة ISO صريحة 0000–9999،
 * لا رمي أبدًا). الملف يثبّت الآن **اتحاد** المتغيرين عند كل الحدود الحرجة
 * (انحدار التوحيد) بدل تباعدهما: أي انفصال مستقبلي بينهما يكسر هذه
 * الاختبارات بوعي.
 */

describe("R2 regression — transfer isLocalDate delegates to the domain kernel (unified 2026-10-08)", () => {
  it("agrees with the domain kernel on valid, rollover, and out-of-grammar dates", () => {
    for (const value of ["2026-01-05", "2024-02-29", "2000-02-29", "0100-01-01", "0000-01-01"]) {
      expect(isLocalDate(value)).toBe(true);
      expect(isValidLocalDate(value)).toBe(true);
    }
    for (const value of ["2023-02-29", "2026-02-30", "2026-04-31", "2026-1-5", "2026-01-05T10:00:00Z", ""]) {
      expect(isLocalDate(value)).toBe(false);
      expect(isValidLocalDate(value)).toBe(false);
    }
  });

  it("ACCEPTS years 0000–0099 under the explicit ISO policy (M-01 flip)", () => {
    /* القلب الموثق: النواة كانت ترفضها صدفةً (Date.UTC يعيد 0–99 إلى 1900+)
     * بينما يقبلها صنف النقل — الآن السياسة واحدة صريحة: نطاق ISO كامل. */
    expect(isLocalDate("0050-01-01")).toBe(true);
    expect(isLocalDate("0000-01-01")).toBe(true);
    expect(isLocalDate("0099-12-31")).toBe(true);
    expect(isValidLocalDate("0050-01-01")).toBe(true);
    expect(isValidLocalDate("0000-01-01")).toBe(true);
    expect(isValidLocalDate("0099-12-31")).toBe(true);
  });

  it("returns false for out-of-grammar components WITHOUT throwing (M-03/D2 fix — was RangeError)", () => {
    /* العقد الجديد: لا رمي أبدًا — كانت toISOString بلا حارس NaN ترمي
     * RangeError عبر مسار استيراد غير محموم فتظهر «تعذر قراءة الملف»
     * المضللة؛ الآن رفض صريح صامت وprepareImport محروس برمي مهيكل. */
    for (const value of ["2026-13-01", "2026-00-10", "2026-01-32", "2026-01-00"]) {
      expect(() => isLocalDate(value)).not.toThrow();
      expect(isLocalDate(value)).toBe(false);
      expect(isValidLocalDate(value)).toBe(false);
    }
  });
});
