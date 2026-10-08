import { describe, expect, it } from "vitest";
import { localDateInAmman, isValidLocalDate } from "@micro-domain/shared/index.js";
import { systemClock, todayInAmman } from "./clock";

/*
 * R2 (M-11/D13، 2026-10-08): عقد حد «اليوم» المسماى الوحيد في طبقة
 * التطبيق. أربعة أقفال:
 *  1) حدود يوم عمّان عبر ساعة محقونة (20:59:59.999Z نفس اليوم؛
 *     21:00:00.000Z اليوم التالي) — نفس عقد localDateInAmman الصريح.
 *  2) الهوية: todayInAmman(clock) === localDateInAmman(clock()) — لا
 *     اشتقاق «اليوم» ثانٍ في أي طبقة.
 *  3) الافتراضي = systemClock (الحد الوحيد للزمن المحيط النشط) — يقبل
 *     قيمة wall-clock صحيحة البنية بغض النظر عن لحظة القراءة.
 *  4) سلوك المدخل غير الصالح محفوظ: رمي الهوية المعتمدة (لا كتم ولا
 *     قيمة بديلة) — نفس عقد الدالة المجالية.
 */

describe("R2 (M-11/D13) — todayInAmman: the one named today boundary over systemClock", () => {
  it("derives the Amman business date across the 21:00Z day boundary from an injected clock", () => {
    expect(todayInAmman(() => "2026-07-14T20:59:59.999Z")).toBe("2026-07-14");
    expect(todayInAmman(() => "2026-07-14T21:00:00.000Z")).toBe("2026-07-15");
    /* حدود الشهر والسنة بنفس النافذة. */
    expect(todayInAmman(() => "2026-08-31T21:30:00.000Z")).toBe("2026-09-01");
    expect(todayInAmman(() => "2025-12-31T22:00:00.000Z")).toBe("2026-01-01");
  });

  it("is the identity localDateInAmman(clock()) — no second today derivation anywhere", () => {
    for (const instant of [
      "2026-07-14T20:59:59.999Z",
      "2026-07-14T21:00:00.000Z",
      "2026-01-01T00:00:00.000Z",
    ]) {
      const clock = () => instant;
      expect(todayInAmman(clock)).toBe(localDateInAmman(clock()));
    }
  });

  it("defaults to systemClock — the only active ambient clock — and yields a well-formed business date", () => {
    /* قراءة الجدار قد تعبر حد اليوم بين القيمتين: نقبل أيًّا منهما مع
     * صحة البنية — القفل هو أن الافتراضي يمر عبر systemClock فعليًا. */
    const before = localDateInAmman(systemClock());
    const value = todayInAmman();
    const after = localDateInAmman(systemClock());
    expect([before, after]).toContain(value);
    expect(value).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(isValidLocalDate(value)).toBe(true);
  });

  it("preserves the invalid-instant throw contract of the domain function (no silent fallback)", () => {
    expect(() => todayInAmman(() => "garbage")).toThrowError("Invalid instant");
    expect(() => todayInAmman(() => "")).toThrowError("Invalid instant");
  });
});
