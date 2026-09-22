import { describe, expect, it } from "vitest";
import {
  DEFAULT_SHORT_CASH_HORIZON_DAYS,
  SHORT_CASH_HORIZON_DAYS,
  SHORT_CASH_HORIZON_LABELS_AR,
  resolveShortCashHorizon,
} from "./shortCashHorizon";

/* FIN-005 (WS-175 — Wave 3): الأفق = [اليوم، اليوم+N−1] شاملًا بالتاريخ
 * المحلي — سبعة أيام تعني اليوم وستة بعده. الحساب UTC-millis على منتصف
 * ليل التاريخ المحلي (نمط periodPresets) — حدو شهر وسنة مغطاة صراحة. */
describe("ShortCashHorizon pure resolver (FIN-005)", () => {
  it("offers exactly the approved family 7/30/90 with 30 as the default", () => {
    expect([...SHORT_CASH_HORIZON_DAYS]).toEqual([7, 30, 90]);
    expect(DEFAULT_SHORT_CASH_HORIZON_DAYS).toBe(30);
    expect(Object.keys(SHORT_CASH_HORIZON_LABELS_AR).sort()).toEqual(["30", "7", "90"]);
  });

  it("resolves a 7-day horizon as today plus six days inclusive", () => {
    expect(resolveShortCashHorizon(7, "2026-09-23")).toEqual({
      ok: true,
      value: { horizonDays: 7, from: "2026-09-23", to: "2026-09-29" },
    });
  });

  it("resolves a 30-day horizon as today plus twenty-nine days across a month boundary", () => {
    expect(resolveShortCashHorizon(30, "2026-09-23")).toEqual({
      ok: true,
      value: { horizonDays: 30, from: "2026-09-23", to: "2026-10-22" },
    });
  });

  it("resolves a 90-day horizon across month and year boundaries", () => {
    expect(resolveShortCashHorizon(90, "2026-11-15")).toEqual({
      ok: true,
      value: { horizonDays: 90, from: "2026-11-15", to: "2027-02-12" },
    });
    /* سنة كبيسة قبل المرساة لا تغيّر النهاية: يوم ٢٩ شباء ٢٠٢٤ قبل الأفق. */
    expect(resolveShortCashHorizon(90, "2024-11-15")).toEqual({
      ok: true,
      value: { horizonDays: 90, from: "2024-11-15", to: "2025-02-12" },
    });
  });

  it("resolves year-end and leap-day anchors exactly", () => {
    expect(resolveShortCashHorizon(7, "2026-12-28")).toEqual({
      ok: true,
      value: { horizonDays: 7, from: "2026-12-28", to: "2027-01-03" },
    });
    /* مرساة كانون الثاني: السنة الكبيسة تُنهي الأفق في ٢٩ شباط، وغير الكبيسة في ١ آذار. */
    expect(resolveShortCashHorizon(30, "2028-01-31")).toEqual({
      ok: true,
      value: { horizonDays: 30, from: "2028-01-31", to: "2028-02-29" },
    });
    expect(resolveShortCashHorizon(30, "2027-01-31")).toEqual({
      ok: true,
      value: { horizonDays: 30, from: "2027-01-31", to: "2027-03-01" },
    });
  });

  it("rejects an invalid today with a typed resolution and no invented values", () => {
    const rejected = resolveShortCashHorizon(30, "2026-9-23");
    expect(rejected).toEqual({ ok: false, code: "invalid_horizon", message: expect.any(String) });
    expect(resolveShortCashHorizon(30, "not-a-date")).toMatchObject({ ok: false });
    expect(resolveShortCashHorizon(30, "2026-02-30")).toMatchObject({ ok: false });
  });

  it("rejects a horizon outside the approved family at the type edge", () => {
    // عائلة مغلقة: قيمة خارج {7,30,90} تُرفض مُنمّطةً لا تُقرَّب إلى أفق آخر.
    expect(resolveShortCashHorizon(14 as never, "2026-09-23")).toMatchObject({ ok: false });
    expect(resolveShortCashHorizon(60 as never, "2026-09-23")).toMatchObject({ ok: false });
    expect(resolveShortCashHorizon(1 as never, "2026-09-23")).toMatchObject({ ok: false });
  });

  it("is pure: the input date string is never mutated", () => {
    const today = "2026-09-23";
    resolveShortCashHorizon(30, today);
    expect(today).toBe("2026-09-23");
  });
});
