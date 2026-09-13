import { describe, expect, it } from "vitest";
import { ammanDateOrNull, localDateInAmman } from "../../src/domain/shared/index.js";

/* المجموعة ٩ (STR-029/STR-031): عقد وحدة وقت الأعمال الكنسية — نفس
 * متجهات توصيف المجموعة ٩ تُثبت أن النقل من طبقة العرض لم يغير أي سلوك،
 * مع تغطية متغيّرَي العقد: الرمي والفارغ. */

const fixedInstants: ReadonlyArray<[string, string]> = [
  /* حدود اليوم المحلي (عمّان UTC+3 دائمًا في ICU وقت التشغيل: 21:00Z). */
  ["2026-07-14T20:59:59.999Z", "2026-07-14"],
  ["2026-07-14T21:00:00.000Z", "2026-07-15"],
  ["2026-01-14T21:59:59.999Z", "2026-01-15"],
  /* حدود الشهر. */
  ["2026-08-31T20:59:59.999Z", "2026-08-31"],
  ["2026-08-31T21:00:00.000Z", "2026-09-01"],
  ["2026-01-31T21:59:59.999Z", "2026-02-01"],
  /* حد السنة. */
  ["2025-12-31T21:59:59.999Z", "2026-01-01"],
  /* مواضع تقويم التوقيت الصيفي الأردني التاريخية (تمثيلية تحت +3 الثابتة). */
  ["2026-02-26T21:59:59.999Z", "2026-02-27"],
  ["2026-02-27T21:00:00.000Z", "2026-02-28"],
  ["2026-10-29T21:00:00.000Z", "2026-10-30"],
  ["2026-10-29T23:00:00.000Z", "2026-10-30"],
  /* لحظات عمل تمثيلية. */
  ["2026-09-10T08:30:00.000Z", "2026-09-10"],
  ["2026-03-15T05:00:00.000Z", "2026-03-15"],
  ["2026-12-01T12:00:00.000Z", "2026-12-01"],
];

describe("Business Time canonical module (Group 9, STR-029/031)", () => {
  it("localDateInAmman derives the Amman business date on every fixed instant", () => {
    for (const [instant, expected] of fixedInstants) {
      expect(localDateInAmman(instant), instant).toBe(expected);
      expect(localDateInAmman(new Date(instant)), instant).toBe(expected);
    }
  });

  it("ammanDateOrNull agrees with the throw variant on every valid instant", () => {
    for (const [instant, expected] of fixedInstants) {
      expect(ammanDateOrNull(instant), instant).toBe(expected);
      expect(ammanDateOrNull(new Date(instant)), instant).toBe(expected);
    }
  });

  it("keeps the two documented invalid-input variants distinct", () => {
    for (const invalid of ["garbage", "", "not-a-date", "2026-13-45T99:99:99.999Z"]) {
      expect(() => localDateInAmman(invalid), invalid).toThrowError("Invalid instant");
      expect(ammanDateOrNull(invalid), invalid).toBeNull();
    }
  });

  it("derives month keys as the first seven characters of the business date (no separate algorithm)", () => {
    expect(localDateInAmman("2026-08-31T21:00:00.000Z").slice(0, 7)).toBe("2026-09");
    expect(localDateInAmman("2025-12-31T21:59:59.999Z").slice(0, 7)).toBe("2026-01");
    expect(ammanDateOrNull("2026-07-14T21:00:00.000Z")!.slice(0, 7)).toBe("2026-07");
  });

  it("defaults the throw variant to now and yields a well-formed business date", () => {
    const today = localDateInAmman();
    expect(today).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(ammanDateOrNull(new Date())).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});
