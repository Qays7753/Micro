import { describe, expect, it } from "vitest";
import { isLocalDate } from "./transferFamilyValidators";
import { isValidLocalDate } from "@micro-domain/shared/index.js";

/*
 * R2 (WS-216/ARCH-007): توصيف تباعد متغير النقل (الصنف B — transferFamilyValidators.isLocalDate)
 * عن نواة المجال (الصنف A — domain/shared/numeric.isValidLocalDate) كما هو اليوم.
 *
 * الجرد (بطاقات R2 §5) اكتشف مثبتًا بالتشغيل أن الصنفين يختلفان عند حدّين:
 *  1) السنوات 0000–0099: النواة ترفضها (Date.UTC يعيد 0–99 إلى 1900+) بينما
 *     مرساة الظهر ISO للصنف B تقرؤها كما هي فيقبلها.
 *  2) المكونات خارج النحو (شهر 13/00، يوم 32/00): النواة ترجع false بينما
 *     الصنف B يرمي RangeError (toISOString على تاريخ غير صالح بلا حارس NaN)
 *     عبر مسار استيراد غير محموم — رسالة «تعذر قراءة الملف» المضللة (R2-D2).
 *
 * هذا توصيف لا مواصفة: يثبّت العيب نفسه كي لا يُصلَح صمتًا. التوحيد قرار
 * مالك محمي (R2-D1/D2 في بطاقات R2 — SEMANTIC_CHANGE_MANIFEST).
 */

describe("R2 characterization — transfer isLocalDate (Class B) boundaries", () => {
  it("agrees with the domain kernel on ordinary valid and rollover dates", () => {
    for (const value of ["2026-01-05", "2024-02-29", "2000-02-29", "0100-01-01"]) {
      expect(isLocalDate(value)).toBe(true);
      expect(isValidLocalDate(value)).toBe(true);
    }
    for (const value of ["2023-02-29", "2026-02-30", "2026-04-31", "2026-1-5", "2026-01-05T10:00:00Z", ""]) {
      expect(isLocalDate(value)).toBe(false);
      expect(isValidLocalDate(value)).toBe(false);
    }
  });

  it("ACCEPTS years 0000–0099 while the domain kernel REJECTS them (R2-D1 divergence)", () => {
    /* مثبت تشغيلًا في الجرد (Node v24): new Date("0050-01-01T12:00:00.000Z")
     * .toISOString().slice(0,10) === "0050-01-01" فيمر الفحص، بينما
     * Date.UTC(50, 0, 1).getUTCFullYear() === 1950 فتُرفض في النواة. */
    expect(isLocalDate("0050-01-01")).toBe(true);
    expect(isLocalDate("0000-01-01")).toBe(true);
    expect(isLocalDate("0099-12-31")).toBe(true);
    expect(isValidLocalDate("0050-01-01")).toBe(false);
    expect(isValidLocalDate("0000-01-01")).toBe(false);
    expect(isValidLocalDate("0099-12-31")).toBe(false);
  });

  it("THROWS RangeError for out-of-grammar components while the kernel returns false (R2-D2 hazard)", () => {
    /* الخوارزمية: regex يمرّ ← new Date("2026-13-01T12:00:00.000Z") تاريخ
     * غير صالح ← .toISOString() يرمي RangeError (لا حارس NaN قبلها). النواة
     * ترجع false بلا رمي. مسار prepareImport لا يحرس هذا الرمي (يحرس JSON.parse
     * فقط) فتظهر رسالة «تعذر قراءة الملف» المضللة في الواجهة. */
    for (const value of ["2026-13-01", "2026-00-10", "2026-01-32", "2026-01-00"]) {
      expect(() => isLocalDate(value)).toThrow(RangeError);
      expect(isValidLocalDate(value)).toBe(false);
    }
  });
});
