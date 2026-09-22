import { describe, expect, it } from "vitest";
import {
  PERIOD_PRESET_IDS,
  PERIOD_PRESET_LABELS_AR,
  isPeriodActive,
  previousEqualPeriod,
  resolvePeriodPreset,
} from "./periodPresets";

/* FIN-007 (WS-173): نموذج اختيار الفترة النقي — القوالب بحساب تواريخ محلية
 * صحيحة بدلالة Asia/Amman (الأسبوع من الأحد إلى السبت مطابقًا للسطح الحي)،
 * والفترة السابقة المكافئة، وحالة الفترة الجارية، ورفض النطاق المعكوس برفض
 * مُنمّط، وعدم تعديل المدخلات أبدًا. لا مخزن ولا React هنا — دوال نقية. */

describe("periodPresets — resolvePeriodPreset", () => {
  it("resolves this_week and last_week on the repo's Sunday→Saturday convention", () => {
    /* 2026-09-16 = الأربعاء؛ الأحد 2026-09-13 والسبت 2026-09-19. */
    const thisWeek = resolvePeriodPreset("this_week", "2026-09-16");
    expect(thisWeek).toEqual({ ok: true, value: { from: "2026-09-13", to: "2026-09-19" } });
    const lastWeek = resolvePeriodPreset("last_week", "2026-09-16");
    expect(lastWeek).toEqual({ ok: true, value: { from: "2026-09-06", to: "2026-09-12" } });
  });

  it("resolves a week that spans a month change (Amman local, no UTC slicing)", () => {
    /* 2026-09-01 = الثلاثاء؛ أسبوعها يبدأ الأحد 2026-08-30 — عبر حدود الشهر. */
    const spanning = resolvePeriodPreset("this_week", "2026-09-01");
    expect(spanning).toEqual({ ok: true, value: { from: "2026-08-30", to: "2026-09-05" } });
  });

  it("resolves this_month and last_month including August's 31 days", () => {
    expect(resolvePeriodPreset("this_month", "2026-09-16")).toEqual({
      ok: true,
      value: { from: "2026-09-01", to: "2026-09-30" },
    });
    expect(resolvePeriodPreset("last_month", "2026-09-16")).toEqual({
      ok: true,
      value: { from: "2026-08-01", to: "2026-08-31" },
    });
    /* لف السنة: الشهر السابق لكانون الثاني 2026 هو كانون الأول 2025. */
    expect(resolvePeriodPreset("last_month", "2026-01-15")).toEqual({
      ok: true,
      value: { from: "2025-12-01", to: "2025-12-31" },
    });
  });

  it("resolves calendar quarters and wraps the year at Q1→Q4", () => {
    expect(resolvePeriodPreset("this_quarter", "2026-09-16")).toEqual({
      ok: true,
      value: { from: "2026-07-01", to: "2026-09-30" },
    });
    expect(resolvePeriodPreset("last_quarter", "2026-09-16")).toEqual({
      ok: true,
      value: { from: "2026-04-01", to: "2026-06-30" },
    });
    expect(resolvePeriodPreset("this_quarter", "2026-01-15")).toEqual({
      ok: true,
      value: { from: "2026-01-01", to: "2026-03-31" },
    });
    expect(resolvePeriodPreset("last_quarter", "2026-01-15")).toEqual({
      ok: true,
      value: { from: "2025-10-01", to: "2025-12-31" },
    });
    expect(resolvePeriodPreset("this_quarter", "2026-12-10")).toEqual({
      ok: true,
      value: { from: "2026-10-01", to: "2026-12-31" },
    });
    expect(resolvePeriodPreset("last_quarter", "2026-12-10")).toEqual({
      ok: true,
      value: { from: "2026-07-01", to: "2026-09-30" },
    });
  });

  it("resolves custom from explicit bounds and rejects reversed ranges with a typed error", () => {
    expect(resolvePeriodPreset("custom", "2026-09-16", { from: "2026-09-02", to: "2026-09-11" })).toEqual({
      ok: true,
      value: { from: "2026-09-02", to: "2026-09-11" },
    });
    const reversed = resolvePeriodPreset("custom", "2026-09-16", { from: "2026-09-10", to: "2026-09-01" });
    expect(reversed.ok).toBe(false);
    if (reversed.ok) return;
    expect(reversed.code).toBe("invalid_period");
    expect(reversed.message).toContain("بداية");
    /* تاريخ غير صالح (30 شباط) يُرفض أيضًا — لا قيمة مُختلقة. */
    const malformed = resolvePeriodPreset("custom", "2026-09-16", { from: "2026-02-30", to: "2026-03-05" });
    expect(malformed.ok).toBe(false);
    if (malformed.ok) return;
    expect(malformed.code).toBe("invalid_period");
  });

  it("rejects an invalid today with the same typed error instead of guessing", () => {
    const result = resolvePeriodPreset("this_week", "not-a-date");
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe("invalid_period");
  });

  it("exposes exactly the seven preset ids with non-empty Arabic labels", () => {
    expect(PERIOD_PRESET_IDS).toEqual([
      "this_week",
      "last_week",
      "this_month",
      "last_month",
      "this_quarter",
      "last_quarter",
      "custom",
    ]);
    for (const id of PERIOD_PRESET_IDS) {
      expect(PERIOD_PRESET_LABELS_AR[id].trim().length).toBeGreaterThan(0);
    }
    expect(PERIOD_PRESET_LABELS_AR.this_week).toBe("هذا الأسبوع");
    expect(PERIOD_PRESET_LABELS_AR.custom).toBe("نطاق مخصص");
  });
});

describe("periodPresets — previousEqualPeriod", () => {
  it("returns the immediately preceding period of identical length across month lengths", () => {
    /* شباط غير الكبيس (28 يومًا) → كانون الثاني 2026 كاملة. */
    expect(previousEqualPeriod({ from: "2026-02-01", to: "2026-02-28" })).toEqual({
      from: "2026-01-04",
      to: "2026-01-31",
    });
    /* شباط الكبيس (29 يومًا) → 29 يومًا تنتهي بآخر يوم من كانون الثاني 2024. */
    expect(previousEqualPeriod({ from: "2024-02-01", to: "2024-02-29" })).toEqual({
      from: "2024-01-03",
      to: "2024-01-31",
    });
    /* نيسان (30 يومًا) → آخر 30 يومًا من آذار. */
    expect(previousEqualPeriod({ from: "2026-04-01", to: "2026-04-30" })).toEqual({
      from: "2026-03-02",
      to: "2026-03-31",
    });
    /* كانون الثاني (31 يومًا) → كانون الأول 2025 كاملًا. */
    expect(previousEqualPeriod({ from: "2026-01-01", to: "2026-01-31" })).toEqual({
      from: "2025-12-01",
      to: "2025-12-31",
    });
  });

  it("handles custom lengths, a single day, and never mutates the input range", () => {
    const range = { from: "2026-09-10", to: "2026-09-13" };
    const snapshot = { ...range };
    expect(previousEqualPeriod(range)).toEqual({ from: "2026-09-06", to: "2026-09-09" });
    expect(range).toEqual(snapshot);
    expect(previousEqualPeriod({ from: "2026-09-10", to: "2026-09-10" })).toEqual({
      from: "2026-09-09",
      to: "2026-09-09",
    });
  });

  it("composes with the presets: last_month is the previous equal period when months share a length", () => {
    /* آب 2026 (31 يومًا) يسبقه تموز (31 يومًا): الفترة السابقة المكافئة = «الشهر الماضي» نفسه. */
    const thisMonth = resolvePeriodPreset("this_month", "2026-08-16");
    if (!thisMonth.ok) throw new Error("this_month should resolve");
    const lastMonth = resolvePeriodPreset("last_month", "2026-08-16");
    if (!lastMonth.ok) throw new Error("last_month should resolve");
    expect(previousEqualPeriod(thisMonth.value)).toEqual(lastMonth.value);
  });

  it("keeps identical length for a 30-day month even when the calendar month before it is longer", () => {
    /* أيلول (30 يومًا): الفترة السابقة المكافئة 30 يومًا تنتهي بآخر يوم من آب —
     * ليست «آب التقويمي» (31 يومًا)؛ التكافؤ بالطول لا بالتقويم. */
    expect(previousEqualPeriod({ from: "2026-09-01", to: "2026-09-30" })).toEqual({
      from: "2026-08-02",
      to: "2026-08-31",
    });
  });
});

describe("periodPresets — isPeriodActive", () => {
  const range = { from: "2026-09-01", to: "2026-09-30" };

  it("is true on both inclusive edges and inside, false outside", () => {
    expect(isPeriodActive(range, "2026-09-01")).toBe(true);
    expect(isPeriodActive(range, "2026-09-30")).toBe(true);
    expect(isPeriodActive(range, "2026-09-16")).toBe(true);
    expect(isPeriodActive(range, "2026-08-31")).toBe(false);
    expect(isPeriodActive(range, "2026-10-01")).toBe(false);
  });

  it("does not mutate the range it inspects", () => {
    const snapshot = { ...range };
    isPeriodActive(range, "2026-09-16");
    expect(range).toEqual(snapshot);
  });
});
