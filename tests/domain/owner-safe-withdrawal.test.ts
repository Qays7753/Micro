import { describe, expect, it } from "vitest";
import { calculateSafeWithdrawal } from "../../src/domain/owner-safe-withdrawal/index.js";
import type { ShortCashResult } from "../../src/domain/g5/index.js";

/* FIN-004 (WS-176 — Wave 4): سياسة السحب الآمن الاستشاري — الفائض =
 * توقع الكاش − الاحتياطي الصريح؛ لا رقم بلا احتياطي/كاش/توقع مكتمل؛
 * السالب ظاهر؛ الربح المتوقع ليس كاشًا أبدًا؛ القروض إفصاح لا حساب. */
function shortCash(overrides: Partial<ShortCashResult>): ShortCashResult {
  return {
    status: "available",
    from: "2026-09-23",
    to: "2026-10-22",
    recordedCashMinor: 10000,
    declaredCollectionsMinor: 4000,
    declaredCommitmentsMinor: 2000,
    undatedReceivablesMinor: 0,
    undatedPayablesMinor: 0,
    projectedCashMinor: 12000,
    activeDeclarationCount: 2,
    sources: ["قبض متوقع: عميلة في 2026-10-01"],
    assumptions: [],
    reasons: [],
    nextAction: "راجع مواعيد التحصيل والالتزامات إذا تغيرت الوقائع.",
    ...overrides,
  };
}

const horizon = { horizonDays: 30 as const, from: "2026-09-23", to: "2026-10-22" };
const input = (overrides: Partial<Parameters<typeof calculateSafeWithdrawal>[0]> = {}) => ({
  horizon,
  shortCash: shortCash({}),
  cashRecorded: true,
  reserve: { mode: "enabled" as const, amountMinor: 3000 },
  loansOutstandingMinor: 0,
  ...overrides,
});

describe("calculateSafeWithdrawal — derivation and statuses (FIN-004 — WS-176)", () => {
  it("derives headroom as projected cash minus the explicit reserve with honest statuses", () => {
    const reading = calculateSafeWithdrawal(input());
    expect(reading).toMatchObject({
      status: "available",
      recordedCashMinor: 10000,
      projectedCashMinor: 12000,
      reserveMinor: 3000,
      headroomMinor: 9000,
    });
    expect(reading.assumptions[0]).toContain("ليس كاشًا");
  });

  it("propagates needs_review from an estimated short-cash forecast without hiding the number", () => {
    const reading = calculateSafeWithdrawal(
      input({
        shortCash: shortCash({
          status: "needs_review",
          assumptions: ["تحصيل عميلة: تقدير معلن."],
        }),
      }),
    );
    expect(reading.status).toBe("needs_review");
    expect(reading.headroomMinor).toBe(9000);
    expect(reading.assumptions).toContain("تحصيل عميلة: تقدير معلن.");
  });

  it("shows a negative headroom explicitly with its reason — never clamped, never blocked", () => {
    const reading = calculateSafeWithdrawal(
      input({ shortCash: shortCash({ projectedCashMinor: 2000, declaredCommitmentsMinor: 12000 }) }),
    );
    expect(reading.status).toBe("available");
    expect(reading.headroomMinor).toBe(-1000);
    expect(reading.reasons[0]).toContain("سالب");
  });
});

describe("calculateSafeWithdrawal — honesty and no invented numbers (FIN-004 — WS-176)", () => {
  it("returns no number when the reserve is unset — no invented percentage or months rule", () => {
    const reading = calculateSafeWithdrawal(input({ reserve: { mode: "unset" } }));
    expect(reading).toMatchObject({ status: "incomplete", headroomMinor: null, reserveMinor: null });
    expect(reading.reasons[0]).toContain("لا يخترع");
  });

  it("returns no number when the reading is disabled by the owner's own choice", () => {
    const reading = calculateSafeWithdrawal(input({ reserve: { mode: "disabled" } }));
    expect(reading).toMatchObject({ status: "incomplete", headroomMinor: null });
    expect(reading.reasons[0]).toContain("عطّلت");
  });

  it("returns no number when recorded cash itself is not recorded", () => {
    const reading = calculateSafeWithdrawal(input({ cashRecorded: false }));
    expect(reading).toMatchObject({ status: "incomplete", headroomMinor: null });
    expect(reading.reasons[0]).toContain("غير مسجل");
  });

  it("inherits the short-cash incompleteness with its visible reasons instead of inventing a forecast", () => {
    const reading = calculateSafeWithdrawal(
      input({
        shortCash: shortCash({
          status: "incomplete",
          projectedCashMinor: null,
          undatedPayablesMinor: 5000,
          reasons: ["التزام بلا تاريخ كافٍ: مورد."],
        }),
      }),
    );
    expect(reading).toMatchObject({ status: "incomplete", headroomMinor: null });
    expect(reading.reasons).toContain("التزام بلا تاريخ كافٍ: مورد.");
    expect(reading.reasons[0]).toContain("ناقص");
  });

  it("treats invalid short-cash readings as incomplete advisories, never as a zero headroom", () => {
    const reading = calculateSafeWithdrawal(
      input({
        shortCash: shortCash({ status: "invalid", projectedCashMinor: null, reasons: ["مبلغ غير صالح."] }),
      }),
    );
    expect(reading).toMatchObject({ status: "incomplete", headroomMinor: null });
    expect(reading.reasons).toContain("مبلغ غير صالح.");
  });

  it("discloses outstanding outgoing loans as context only — never inflow, never math", () => {
    const reading = calculateSafeWithdrawal(input({ loansOutstandingMinor: 7000 }));
    expect(reading.headroomMinor).toBe(9000);
    expect(reading.loansOutstandingMinor).toBe(7000);
    expect(reading.assumptions.some(entry => entry.includes("قروض صادرة"))).toBe(true);
    /* لا مصدر ربح إطلاقًا — الفصل عن الربح افتراض دائم. */
    expect(reading.sources.every(source => !source.includes("ربح"))).toBe(true);
  });
});

describe("calculateSafeWithdrawal — advisory wording and loans context (FIN-004 — WS-176)", () => {
  it("keeps zero outstanding loans as plain context without a disclosure line", () => {
    const reading = calculateSafeWithdrawal(input({ loansOutstandingMinor: 0 }));
    expect(reading.assumptions.some(entry => entry.includes("قروض صادرة"))).toBe(false);
  });

  it("never carries a withdrawal command, block, or guarantee in its next actions", () => {
    for (const reserve of [
      { mode: "enabled" as const, amountMinor: 3000 },
      { mode: "unset" as const },
      { mode: "disabled" as const },
    ]) {
      const reading = calculateSafeWithdrawal(input({ reserve }));
      /* حين يوجد رقم (احتياطي مفعّل) تكون الصيغة استشارية صريحة؛ وفي كل الحالات لا أمر سحب ولا ضمان. */
      if (reserve.mode === "enabled") expect(reading.nextAction).toContain("استشار");
      expect(reading.nextAction).not.toContain("اسحب");
      expect(reading.nextAction).not.toContain("يضمن");
    }
  });
});
