import { describe, expect, it } from "vitest";
import { isValidLocalDate, localDateInAmman } from "./formatters";

/* المجموعة ٩ (STR-029/STR-031): توصيف وقت الأعمال قبل استخراجه من طبقة
 * العرض — يثبت هذا الملف سلوك `localDateInAmman` الحي على متجهات لحظات
 * ثابتة تغطي حدود اليوم والشهر والسنة بتوقيت عمّان، ومدخلات غير الصالحة.
 *
 * العقد الموصّف (يتجمد في المجموعة ٩):
 * 1) الخوارزمية: أجزاء Intl بتوقيت Asia/Amman (سنة رقمية، شهر ويوم بمنزلتين)
 *    بصيغة YYYY-MM-DD.
 * 2) التوقيت: عمّان UTC+3 طول العام في ICU وقت التشغيل (توقيت صيفي دائم منذ
 *    2022) — حدّ اليوم المحلي 21:00:00Z.
 * 3) المدخل: Date أو نص ISO؛ الافتراضي «الآن».
 * 4) المدخل غير الصالح: خطأ صريح «Invalid instant» (متغيّر الرمي المعتمد)؛
 *    المتغيّر الآخر الآمن (null) لحالات القراءة الاحتياطية يوثَّق في وحدة
 *    وقت الأعمال الكنسية عند استخراجها.
 *
 * هذا الملف يبقى كما هو عبر الاستخراج (formatters يعيد تصدير الوحدة الكنسية)
 * فيثبت أن النقل لا يغير السلوك. */

describe("localDateInAmman fixed-instant characterization (STR-029/STR-031)", () => {
  it("derives the Amman calendar day across the 21:00Z boundary", () => {
    /* حد اليوم المحلي: 21:00:00Z على مدار العام (UTC+3 دائم). */
    expect(localDateInAmman("2026-07-14T20:59:59.999Z")).toBe("2026-07-14");
    expect(localDateInAmman("2026-07-14T21:00:00.000Z")).toBe("2026-07-15");
    expect(localDateInAmman("2026-01-14T21:59:59.999Z")).toBe("2026-01-15");
  });

  it("derives the local month at the month boundary (no period drift at midnight)", () => {
    expect(localDateInAmman("2026-08-31T20:59:59.999Z")).toBe("2026-08-31");
    expect(localDateInAmman("2026-08-31T21:00:00.000Z")).toBe("2026-09-01");
    expect(localDateInAmman("2026-01-31T21:59:59.999Z")).toBe("2026-02-01");
  });

  it("derives the local year at the year boundary", () => {
    expect(localDateInAmman("2025-12-31T21:59:59.999Z")).toBe("2026-01-01");
  });

  it("agrees around the Jordan DST calendar positions (permanent +3 in the runtime ICU)", () => {
    /* مواضع تقويم التوقيت الصيفي الأردني التاريخية — تظل لحظات تمثيلية
     * سليمة لأن عمّان +3 ثابتة في ICU الحالي. */
    expect(localDateInAmman("2026-02-26T21:59:59.999Z")).toBe("2026-02-27");
    expect(localDateInAmman("2026-02-27T21:00:00.000Z")).toBe("2026-02-28");
    expect(localDateInAmman("2026-10-29T21:00:00.000Z")).toBe("2026-10-30");
    expect(localDateInAmman("2026-10-29T23:00:00.000Z")).toBe("2026-10-30");
  });

  it("formats representative working instants", () => {
    expect(localDateInAmman("2026-09-10T08:30:00.000Z")).toBe("2026-09-10");
    expect(localDateInAmman("2026-03-15T05:00:00.000Z")).toBe("2026-03-15");
    expect(localDateInAmman("2026-12-01T12:00:00.000Z")).toBe("2026-12-01");
  });

  it("accepts Date instances and ISO strings identically", () => {
    expect(localDateInAmman(new Date("2026-06-15T09:00:00.000Z"))).toBe("2026-06-15");
    expect(localDateInAmman("2026-06-15T09:00:00.000Z")).toBe("2026-06-15");
  });

  it("derives month keys as the first seven characters of the business date (no separate algorithm)", () => {
    expect(localDateInAmman("2026-08-31T21:00:00.000Z").slice(0, 7)).toBe("2026-09");
    expect(localDateInAmman("2025-12-31T21:59:59.999Z").slice(0, 7)).toBe("2026-01");
  });

  it("returns a valid business date for the default now input", () => {
    const today = localDateInAmman();
    expect(today).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(isValidLocalDate(today)).toBe(true);
  });

  it("throws the explicit invalid-instant error for unparseable inputs (throw variant contract)", () => {
    expect(() => localDateInAmman("garbage")).toThrowError("Invalid instant");
    expect(() => localDateInAmman("")).toThrowError("Invalid instant");
    expect(() => localDateInAmman("2026-13-45T99:99:99.999Z")).toThrowError("Invalid instant");
    expect(() => localDateInAmman("not-a-date")).toThrowError("Invalid instant");
  });
});
