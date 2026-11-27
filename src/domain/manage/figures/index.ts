/**
 * M2.11 (Manage v2 phase 2, wave I — spec §8, §8.2, §14.2, R-2, R-20–R-22,
 * R-27; binding interpretation 4): the PURE helpers of the one server read
 * module — period boundaries, the per-10 ratio, expected profit and the
 * display dates. No database, no clock (dates are passed in as Amman local
 * strings); the worker-side readModel.ts owns the queries and the
 * composition, and these helpers own the arithmetic so it stays testable
 * pure.
 *
 * Money is integer fils end to end; the only fils→JOD conversion is
 * M1.7's jodTextFromFils (the money unit's job) — never a literal /1000.
 */

/** A §8 period: week, month, year or since start (Amman local dates). */
export type FigurePeriodKind = "week" | "month" | "year" | "since_start";

export interface PeriodRange {
  kind: FigurePeriodKind;
  from: string;
  to: string;
}

/* All calendar arithmetic goes through the canonical kernel
 * (src/domain/shared/numeric.ts — D-03): no Date object, no Date.parse, no
 * raw slicing in this module. Nulls are impossible for the validated dates
 * the read model passes in, and fail closed if they ever occur. */
import {
  localDateDayNumber,
  localDateMonthEnd,
  localDatePlusDays,
  localDatePlusMonthsClamped,
  localDateWeekdayIndex,
} from "../../shared/index.js";

function dayIndex(date: string): number {
  const day = localDateDayNumber(date);
  if (day === null) throw new Error(`تاريخ غير صالح لحساب الفترة: «${date}».`);
  return day;
}

function dateFromDayIndex(index: number): string {
  const date = localDatePlusDays("1970-01-01", index);
  if (date === null) throw new Error(`فترة خارج النطاق: يوم ${index}.`);
  return date;
}

/** R-21: dd/mm/yyyy everywhere. */
export function displayDate(date: string): string {
  const [y, m, d] = date.split("-");
  return `${d}/${m}/${y}`;
}

/** The period label (R-21): day `25/11/2026`; week `22/11/2026 – 28/11/2026`;
 * month `11/2026`; year `2026`; since start = the day itself. */
export function periodLabel(range: PeriodRange): string {
  switch (range.kind) {
    case "week":
      return `${displayDate(range.from)} \u2013 ${displayDate(range.to)}`;
    case "month":
      return `${range.from.slice(5, 7)}/${range.from.slice(0, 4)}`;
    case "year":
      return range.from.slice(0, 4);
    case "since_start":
      return displayDate(range.to);
  }
}

/** The boundaries of the selected period containing `today` — the week is
 * Sunday→Saturday (R-27's calendar convention). */
export function periodRangeOf(kind: FigurePeriodKind, today: string): PeriodRange {
  const [y, m] = [Number(today.slice(0, 4)), Number(today.slice(5, 7))];
  switch (kind) {
    case "week": {
      const weekday = localDateWeekdayIndex(today) ?? 0; // 0 = Sunday
      const from = dateFromDayIndex(dayIndex(today) - weekday);
      const to = dateFromDayIndex(dayIndex(today) + (6 - weekday));
      return { kind, from, to };
    }
    case "month":
      return { kind, from: `${today.slice(0, 8)}01`, to: localDateMonthEnd(today.slice(0, 7)) ?? today };
    case "year":
      return { kind, from: `${y}-01-01`, to: `${y}-12-31` };
    case "since_start":
      return { kind, from: "0001-01-01", to: today };
  }
}

export interface ProfitBar {
  label: string;
  from: string;
  to: string;
}

/** The profit bars' periods (§8): last 8 weeks (week) / last 12 months
 * (month) / each year since start (year and since start). */
export function profitBarsOf(kind: FigurePeriodKind, today: string, firstDate: string): ProfitBar[] {
  const bars: ProfitBar[] = [];
  if (kind === "week") {
    const current = periodRangeOf("week", today);
    for (let i = 7; i >= 0; i -= 1) {
      const from = dateFromDayIndex(dayIndex(current.from) - 7 * i);
      const to = dateFromDayIndex(dayIndex(from) + 6);
      bars.push({ label: `${displayDate(from)} \u2013 ${displayDate(to)}`, from, to });
    }
    return bars;
  }
  if (kind === "month") {
    for (let i = 11; i >= 0; i -= 1) {
      const from = localDatePlusMonthsClamped(`${today.slice(0, 8)}01`, -i);
      if (from === null) continue;
      bars.push({
        label: `${from.slice(5, 7)}/${from.slice(0, 4)}`,
        from,
        to: localDateMonthEnd(from.slice(0, 7)) ?? from,
      });
    }
    return bars;
  }
  const firstYear = Number(firstDate.slice(0, 4));
  const lastYear = Number(today.slice(0, 4));
  for (let y = firstYear; y <= lastYear; y += 1) {
    bars.push({ label: String(y), from: `${y}-01-01`, to: `${y}-12-31` });
  }
  return bars;
}

/** Whether [from, to] overlaps an absence event whose complete ≠ true
 * (§8 Incomplete flag — the events arrive already loaded). */
export function periodOverlapsIncompleteAbsence(
  range: PeriodRange,
  absences: Array<{ startedOn: string; endedOn: string; complete: boolean | null }>,
): boolean {
  return absences.some(a => a.complete !== true && a.startedOn <= range.to && a.endedOn >= range.from);
}

/** R-8: is the reconciliation due? ≥7 days since the LAST reconciliation
 * (or the project's creation) AND ≥1 money operation since the anchor —
 * a money operation = any operation with at least one BOX posting. The
 * 7-day check is DATE-granular (the rule's own granularity); "since" is
 * a TIMESTAMP comparison, so an operation created minutes after the
 * anchor counts while the anchor operation itself (the OP-SETUP that
 * completes the creation, or the reconciliation) never does — OP-SETUP
 * is excluded by kind as well (it IS the beginning, not activity since
 * it). Pure — the log surface feeds it the loaded values. */
export function reconciliationDue(input: {
  today: string;
  /** The anchor's DAY: the last reconciliation's performed_on, else the
   * project's creation day. */
  anchorDay: string;
  /** The anchor's MOMENT (a timestamptz text): the last reconciliation's
   * created_at, else the project's created_at. */
  anchorAt: string;
  /** created_at (timestamptz text) of every operation with ≥1 BOX
   * posting other than OP-SETUP. */
  moneyOperationAt: string[];
}): boolean {
  if (dayIndex(input.today) - dayIndex(input.anchorDay) < 7) return false;
  return input.moneyOperationAt.some(at => at > input.anchorAt);
}

/** The per-10 ratio (§8 + binding interpretation 4): round_half_up to one
 * decimal, ONCE, at display; hidden when net sales ≤ 0 (never a division by
 * a non-positive denominator, never ∞ or 0 as a ratio); net profit < 0
 * shows S-LOSS INSTEAD of the ratio sentence. Integer arithmetic (tenths). */
export type PerTenRatio =
  | { kind: "ratio"; tenths: number; text: string }
  | { kind: "loss"; labelKey: "S-LOSS" }
  | { kind: "hidden"; labelKey: "c.withdrawals_only" };

export function perTenRatio(netProfitFils: number, netSalesFils: number): PerTenRatio {
  if (netProfitFils < 0) return { kind: "loss", labelKey: "S-LOSS" };
  if (netSalesFils <= 0) return { kind: "hidden", labelKey: "c.withdrawals_only" };
  // ratio = netProfit × 10 / netSales rounded half-up to one decimal:
  // tenths = round_half_up(netProfit × 100 / netSales) — pure BigInt.
  const numerator = BigInt(netProfitFils) * 100n;
  const denominator = BigInt(netSalesFils);
  const tenths = Number((2n * numerator + denominator) / (2n * denominator));
  // Integer text split — no raw rounding (D-02/A-07); tenths ≥ 0 here.
  return { kind: "ratio", tenths, text: `${(tenths - (tenths % 10)) / 10}.${tenths % 10}` };
}

/** Expected profit of a sale (§8): final − Σ round_half_up(qty × unit_cost)
 * − Σ EXP[sale_delivery] linked to the sale; NULL when any line cost is
 * unknown or there is no final price. The per-line rounding is M1.7's
 * mulFilsByQuantityMilli (exactly one round_half_up per multiplication). */
export function expectedProfitFils(
  finalPriceFils: number | null,
  lines: Array<{ quantityMilli: number; unitCostFils: number | null }>,
  saleDeliveryCostFils: number,
  mulFilsByQuantityMilli: (fils: number, quantityMilli: number) => number,
): number | null {
  if (finalPriceFils === null) return null;
  let totalCost = 0;
  for (const line of lines) {
    if (line.unitCostFils === null) return null;
    totalCost += mulFilsByQuantityMilli(line.unitCostFils, line.quantityMilli);
  }
  return finalPriceFils - totalCost - saleDeliveryCostFils;
}
