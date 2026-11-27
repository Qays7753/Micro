/**
 * M2.11 (Manage v2 phase 2, wave I — spec §8, §8.2, §14.2, R-20–R-23; tests
 * S1, S7, S9, T14, T54): THE one server read module — every §8 figure and
 * the §8.2 entity-level derived values computable in phase 2, over the §3
 * tables, in ONE response ready to display.
 *
 * THE SINGLE IMPLEMENTATION (§14.2): the §8/§8.2 formulas live HERE (with
 * their pure helpers in src/domain/manage/figures/) and nowhere else — the
 * acceptance test source-scans the new Manage surfaces for a second
 * implementation (a fils→JOD division or a REV/EXP figure computation
 * outside this module). The client only renders (R-23): it receives raw
 * fils AND the formatted text (T54: report «1,250.000 د», dashboard
 * «1,250 د», dates dd/mm/yyyy — R-20/R-21/R-22) plus catalog KEYS for
 * labels (S-LOSS, c.withdrawals_only, l.unknown_balance) — no Arabic UI
 * literal is produced here beyond R-22's currency symbol «د» that is part
 * of every formatted amount.
 *
 * Posture: pure SQL reads (one snapshot per request — INV-3: no cache), all
 * sums over ledger_posting with integer fils; "active entries and their
 * reversals both count" (§8) — an entry reversed by a Q20 drops out and
 * the Q20 itself stays, so they net to zero (the binding interpretation 2).
 * The per-entry equation, invariants and every write stay where they are;
 * this module only READS.
 */
import type postgres from "postgres";
import {
  displayDate,
  expectedProfitFils,
  perTenRatio,
  periodLabel,
  periodOverlapsIncompleteAbsence,
  periodRangeOf,
  profitBarsOf,
  type FigurePeriodKind,
  type PerTenRatio,
  type PeriodRange,
} from "../../../../../src/domain/manage/figures/index.js";
import { jodTextFromFils, mulFilsByQuantityMilli } from "../../../../../src/domain/manage/money/index.js";

/** A money figure: raw fils + the formatted texts (T54/R-20/R-22). */
export interface MoneyFigure {
  fils: number;
  /** Report style: always 3 decimals («75.000 د»). */
  text: string;
  /** Dashboard style: whole amounts without decimals, fractional with 3. */
  textDashboard: string;
}

/** An unknown figure (an active box has an unknown opening — §8). */
export interface UnknownFigure {
  fils: null;
  labelKey: "l.unknown_balance";
}

export type Figure = MoneyFigure | UnknownFigure;

/** «د» — R-22's currency symbol, part of every formatted amount. */
const CURRENCY = "\u062f";

function wholeText(fils: number): string {
  const sign = fils < 0 ? "-" : "";
  const absolute = Math.abs(fils);
  const whole = Math.floor(absolute / 1000);
  const groups: string[] = [];
  let remaining = String(whole);
  while (remaining.length > 3) {
    groups.unshift(remaining.slice(-3));
    remaining = remaining.slice(0, -3);
  }
  groups.unshift(remaining);
  return `${sign}${groups.join(",")}`;
}

/** T54: report always 3 decimals; dashboard whole-or-3 (R-20). */
function money(fils: number): MoneyFigure {
  return {
    fils,
    text: `${jodTextFromFils(fils)} ${CURRENCY}`,
    textDashboard: `${fils % 1000 === 0 ? wholeText(fils) : jodTextFromFils(fils)} ${CURRENCY}`,
  };
}

function unknown(): UnknownFigure {
  return { fils: null, labelKey: "l.unknown_balance" };
}

/** A quantity in milli: whole units, or 3 decimals (R-20's number shape). */
function quantityText(quantityMilli: number): string {
  return quantityMilli % 1000 === 0 ? String(quantityMilli / 1000) : jodTextFromFils(quantityMilli);
}

/** round_half_up(a × 1000 / b) in BigInt — a per-unit fils value. */
function perUnitFils(totalFils: number, quantityMilli: number): number {
  const numerator = BigInt(totalFils) * 1000n;
  const denominator = BigInt(quantityMilli);
  return Number((2n * numerator + denominator) / (2n * denominator));
}

/* ── The loaded snapshot (one query round per request — INV-3) ─────────── */

interface PostingRow {
  account: string;
  ref_id: string | null;
  category: string | null;
  rev_kind: string | null;
  delta_minor: string | number;
  effective_on: string;
  entry_type: string;
  /** The owning operation's kind and sale (§3.7): EXP postings carry no
   * ref_id, so a sale_delivery expense links to its sale through the
   * OP-SALE-DELIVERY-COST operation. */
  operation_kind: string;
  operation_sale_id: string | null;
}

interface BoxRow {
  id: string;
  kind: string;
  status: string;
  opening_status: string;
}

interface LineRow {
  id: string;
  direction: string;
  kind: string;
  counterparty_name: string | null;
  origin_on: string;
  sale_id: string | null;
}

interface SaleRow {
  id: string;
  customer_name: string | null;
  registered_on: string;
  planned_delivery_on: string;
  final_price_minor: string | number | null;
  cancelled_on: string | null;
}

interface SaleLineRow {
  id: string;
  sale_id: string;
  product_id: string | null;
  description: string;
  quantity_milli: number;
  unit_price_minor: number | null;
  unit_cost_minor: number | null;
}

interface Snapshot {
  postings: PostingRow[];
  boxes: BoxRow[];
  lines: LineRow[];
  sales: SaleRow[];
  saleLines: SaleLineRow[];
  absences: Array<{ startedOn: string; endedOn: string; complete: boolean | null }>;
  hasNonSetupOperation: boolean;
  firstDate: string;
}

async function loadSnapshot(sql: postgres.Sql, projectId: string, today: string): Promise<Snapshot> {
  const postings = (await sql`
    SELECT p.account, p.ref_id, p.category, p.rev_kind, p.delta_minor, e.effective_on::text AS effective_on,
           e.entry_type, o.kind AS operation_kind, o.sale_id AS operation_sale_id
    FROM ledger_posting p
    JOIN ledger_entry e ON e.id = p.entry_id
    JOIN operation o ON o.id = e.operation_id
    WHERE p.project_id = ${projectId}
      AND NOT EXISTS (SELECT 1 FROM ledger_entry r WHERE r.reverses_entry_id = e.id)`) as unknown as PostingRow[];
  const boxes = (await sql`
    SELECT id, kind, status, opening_status FROM box WHERE project_id = ${projectId}`) as unknown as BoxRow[];
  const lines = (await sql`
    SELECT id, direction, kind, counterparty_name, origin_on::text AS origin_on, sale_id
    FROM balance_line WHERE project_id = ${projectId}`) as unknown as LineRow[];
  const sales = (await sql`
    SELECT id, customer_name, registered_on::text AS registered_on,
           planned_delivery_on::text AS planned_delivery_on, final_price_minor, cancelled_on::text AS cancelled_on
    FROM sale WHERE project_id = ${projectId}`) as unknown as SaleRow[];
  const saleLineRows = (await sql`
    SELECT id, sale_id, product_id, description, quantity_milli, unit_price_minor, unit_cost_minor
    FROM sale_line WHERE project_id = ${projectId}`) as Array<{
    id: string;
    sale_id: string;
    product_id: string | null;
    description: string;
    quantity_milli: number;
    unit_price_minor: string | number | null;
    unit_cost_minor: string | number | null;
  }>;
  const saleLines: SaleLineRow[] = saleLineRows.map(l => ({
    id: l.id,
    sale_id: l.sale_id,
    product_id: l.product_id,
    description: l.description,
    quantity_milli: Number(l.quantity_milli),
    unit_price_minor: l.unit_price_minor === null ? null : Number(l.unit_price_minor),
    unit_cost_minor: l.unit_cost_minor === null ? null : Number(l.unit_cost_minor),
  }));
  const absenceRows = (await sql`
    SELECT started_on::text AS started_on, ended_on::text AS ended_on, complete
    FROM absence_event WHERE project_id = ${projectId}`) as Array<{
    started_on: string;
    ended_on: string;
    complete: boolean | null;
  }>;
  const absences = absenceRows.map(a => ({
    startedOn: a.started_on,
    endedOn: a.ended_on,
    complete: a.complete,
  }));
  const nonSetup = await sql`
    SELECT 1 FROM operation WHERE project_id = ${projectId}
      AND kind NOT IN ('OP-SETUP', 'OP-ADD-BOX') LIMIT 1`;
  const dates = postings.map(p => p.effective_on).sort();
  return {
    postings,
    boxes,
    lines,
    sales,
    saleLines,
    absences,
    hasNonSetupOperation: nonSetup.length > 0,
    firstDate: dates[0] ?? today,
  };
}

/* ── The sums (§8: integer fils over the posting snapshot) ─────────────── */

function inPeriod(row: { effective_on: string }, range: PeriodRange): boolean {
  return row.effective_on >= range.from && row.effective_on <= range.to;
}

function sumAccount(s: Snapshot, account: string, range?: PeriodRange): number {
  return s.postings
    .filter(p => p.account === account && (range === undefined || inPeriod(p, range)))
    .reduce((sum, p) => sum + Number(p.delta_minor), 0);
}

/** Σ of an account over rows matching a predicate. */
function sumWhere(
  s: Snapshot,
  account: string,
  predicate: (p: PostingRow) => boolean,
  range?: PeriodRange,
): number {
  return s.postings
    .filter(p => p.account === account && predicate(p) && (range === undefined || inPeriod(p, range)))
    .reduce((sum, p) => sum + Number(p.delta_minor), 0);
}

function boxBalanceFils(s: Snapshot, boxId: string): number {
  return s.postings
    .filter(p => p.account === "BOX" && p.ref_id === boxId)
    .reduce((sum, p) => sum + Number(p.delta_minor), 0);
}

function lineOutstandingFils(s: Snapshot, lineId: string, direction: "to_me" | "by_me"): number {
  const account = direction === "to_me" ? "AR" : "AP";
  return s.postings
    .filter(p => p.account === account && p.ref_id === lineId)
    .reduce((sum, p) => sum + Number(p.delta_minor), 0);
}

/** The sale's delivered_on: the effective date of its active Q5 (§3.4). */
function deliveredOn(s: Snapshot, saleId: string): string | null {
  const delivery = s.postings.find(
    p => p.entry_type === "Q5" && p.account === "REV" && p.ref_id === saleId && p.rev_kind === "delivery",
  );
  return delivery === undefined ? null : delivery.effective_on;
}

/** The sale's active Q16 (return) — excludes it from top sellers (§8). */
function hasActiveReturn(s: Snapshot, saleId: string): boolean {
  return s.postings.some(p => p.entry_type === "Q16" && p.account === "REV" && p.ref_id === saleId);
}

/** Σ EXP[sale_delivery] linked to the sale (the §8 expected-profit term). */
function saleDeliveryCostFils(s: Snapshot, saleId: string): number {
  return s.postings
    .filter(
      p =>
        p.operation_kind === "OP-SALE-DELIVERY-COST" &&
        p.operation_sale_id === saleId &&
        p.account === "EXP" &&
        p.category === "sale_delivery",
    )
    .reduce((sum, p) => sum + Number(p.delta_minor), 0);
}

/** §6 sale status, derived from the ledger state. */
function saleStatus(
  s: Snapshot,
  sale: SaleRow,
  delivered: string | null,
  remainderOutstanding: number,
  today: string,
): "cancelled" | "scheduled" | "overdue" | "delivered_unpaid" | "completed" {
  if (sale.cancelled_on !== null) return "cancelled";
  if (delivered === null) return sale.planned_delivery_on >= today ? "scheduled" : "overdue";
  return remainderOutstanding > 0 ? "delivered_unpaid" : "completed";
}

/* ── The response ──────────────────────────────────────────────────────── */

export interface ManageFiguresResponse {
  period: { kind: FigurePeriodKind; from: string; to: string; label: string; labelText: string };
  boxes: Array<{
    id: string;
    kind: string;
    status: string;
    openingStatus: string;
    balanceFils: number | null;
    balanceLabelKey?: "l.unknown_balance";
    text?: string;
    textDashboard?: string;
  }>;
  totalBalance: Figure;
  receivables: Figure;
  payables: Figure;
  payablesPrepayments: Figure;
  whatYouHave: Figure;
  whatYouOwe: Figure;
  whatYouOweBreakdown: Array<{ kind: string; fils: number; text: string }>;
  sales: Figure;
  returnsAndDiscounts: Figure;
  netSales: Figure;
  expenses: Figure;
  equipment: Figure;
  personalWithdrawals: Figure;
  ownerDeposits: Figure;
  perTenRatio: PerTenRatio;
  biggestExpense: { category: string; fils: number; text: string } | null;
  expensesByCategory: Array<{ category: string; fils: number; text: string }>;
  materialsAlert: boolean;
  unexplained: { fils: number; shown: boolean; text: string };
  netWorth: Figure;
  netWorthSources: {
    openingFils: number;
    ownerDepositsFils: number;
    ownerWithdrawalsFils: number;
    netProfitSinceStartFils: number;
    unexplainedFils: number;
    totalFils: number;
  } | null;
  overdueReceivables: Array<{
    lineId: string;
    counterpartyName: string | null;
    outstandingFils: number;
    originOn: string;
    text: string;
  }>;
  balanceLines: Array<{
    id: string;
    direction: string;
    kind: string;
    counterpartyName: string | null;
    originOn: string;
    outstandingFils: number;
    overdue: boolean;
    text: string;
  }>;
  salesList: Array<{
    id: string;
    status: string;
    finalPriceFils: number | null;
    prepaymentFils: number;
    netSaleRevenueFils: number;
    expectedProfitFils: number | null;
    fullAmountFils: number | null;
    paid: { paidFils: number; ofFils: number | null };
  }>;
  topSellers: Array<{ productId: string; name: string; valueFils: number; quantityText: string }>;
  topProfit: Array<{ productId: string; name: string; profitFils: number; perUnitText: string }>;
  bars: Array<{ label: string; from: string; to: string; netProfitFils: number; incomplete: boolean }>;
  flags: { newUser: boolean; incompletePeriod: boolean; unknownBalance: boolean };
}

interface TopSellerEntry {
  productId: string;
  name: string;
  valueFils: number;
  quantityMilli: number;
  costKnown: boolean;
  profitFils: number;
}

/** The §8 top-sellers/top-profit set: product lines of sales delivered in
 * the period, excluding sales with any active return (§8). */
function topProductEntries(s: Snapshot, range: PeriodRange): TopSellerEntry[] {
  const byProduct = new Map<string, TopSellerEntry>();
  for (const sale of s.sales) {
    const delivered = deliveredOn(s, sale.id);
    if (delivered === null || delivered < range.from || delivered > range.to) continue;
    if (hasActiveReturn(s, sale.id)) continue;
    for (const line of s.saleLines.filter(l => l.sale_id === sale.id && l.product_id !== null)) {
      const value =
        line.unit_price_minor === null
          ? 0
          : mulFilsByQuantityMilli(line.unit_price_minor, line.quantity_milli);
      const entry = byProduct.get(line.product_id!) ?? {
        productId: line.product_id!,
        name: line.description,
        valueFils: 0,
        quantityMilli: 0,
        costKnown: true,
        profitFils: 0,
      };
      entry.valueFils += value;
      entry.quantityMilli += line.quantity_milli;
      if (line.unit_cost_minor !== null) {
        entry.profitFils += value - mulFilsByQuantityMilli(line.unit_cost_minor, line.quantity_milli);
      } else {
        entry.costKnown = false;
      }
      byProduct.set(line.product_id!, entry);
    }
  }
  return [...byProduct.values()];
}

/** The period's expenses per category (§8.2), the biggest (§8, ties by
 * descending amount then category ascending — binding interpretation 5). */
function expenseCategories(
  s: Snapshot,
  range: PeriodRange,
): {
  byCategory: Array<{ category: string; fils: number; text: string }>;
  biggest: { category: string; fils: number; text: string } | null;
} {
  const sums = new Map<string, number>();
  for (const p of s.postings) {
    if (p.account !== "EXP" || !inPeriod(p, range)) continue;
    const category = p.category ?? "";
    sums.set(category, (sums.get(category) ?? 0) + Number(p.delta_minor));
  }
  const byCategory = [...sums.entries()]
    .map(([category, fils]) => ({ category, fils, text: money(fils).text }))
    .sort((a, b) => a.category.localeCompare(b.category));
  const biggest =
    byCategory.length === 0
      ? null
      : [...byCategory].sort((a, b) => b.fils - a.fils || a.category.localeCompare(b.category))[0]!;
  return { byCategory, biggest };
}

/** The per-sale derived values (§8.2/§6): status, prepayment, net sale
 * revenue, expected profit, «المبلغ كاملاً» and the paid indicator. */
function salesListRows(
  s: Snapshot,
  today: string,
  lineFigures: Array<{ line: LineRow; outstanding: number }>,
): ManageFiguresResponse["salesList"] {
  return s.sales.map(sale => {
    const delivered = deliveredOn(s, sale.id);
    const remainder = lineFigures.find(l => l.line.sale_id === sale.id && l.line.kind === "sale_remainder");
    const remainderOutstanding = remainder === undefined ? 0 : Math.max(remainder.outstanding, 0);
    const prepay = Math.max(
      s.postings
        .filter(p => p.account === "PRE" && p.ref_id === sale.id)
        .reduce((sum, p) => sum + Number(p.delta_minor), 0),
      0,
    );
    const finalPrice = sale.final_price_minor === null ? null : Number(sale.final_price_minor);
    const netSaleRevenue = s.postings
      .filter(p => p.account === "REV" && p.ref_id === sale.id)
      .reduce((sum, p) => sum + Number(p.delta_minor), 0);
    const lines = s.saleLines
      .filter(l => l.sale_id === sale.id)
      .map(l => ({ quantityMilli: l.quantity_milli, unitCostFils: l.unit_cost_minor }));
    const expected = expectedProfitFils(
      finalPrice,
      lines,
      saleDeliveryCostFils(s, sale.id),
      mulFilsByQuantityMilli,
    );
    const status = saleStatus(s, sale, delivered, remainderOutstanding, today);
    const paid =
      delivered === null
        ? { paidFils: prepay, ofFils: finalPrice }
        : { paidFils: netSaleRevenue - remainderOutstanding, ofFils: netSaleRevenue };
    return {
      id: sale.id,
      status,
      finalPriceFils: finalPrice,
      prepaymentFils: prepay,
      netSaleRevenueFils: netSaleRevenue,
      expectedProfitFils: expected,
      fullAmountFils: finalPrice === null ? null : finalPrice - prepay,
      paid,
    };
  });
}

/** Compute every §8/§8.2 figure of one project for one period. */
export async function computeManageFigures(
  sql: postgres.Sql,
  projectId: string,
  today: string,
  periodKind: FigurePeriodKind = "month",
): Promise<ManageFiguresResponse> {
  const s = await loadSnapshot(sql, projectId, today);
  const range = periodRangeOf(periodKind, today);
  const sinceStart = periodRangeOf("since_start", today);

  // Boxes and balances (§8: unknown opening → unknown display, never partial).
  const activeBoxes = s.boxes.filter(b => b.status === "active");
  const unknownBalance = activeBoxes.some(b => b.opening_status === "unknown");
  const boxes = s.boxes.map(box => {
    if (box.opening_status === "unknown") {
      return {
        id: box.id,
        kind: box.kind,
        status: box.status,
        openingStatus: box.opening_status,
        balanceFils: null,
        balanceLabelKey: "l.unknown_balance" as const,
      };
    }
    const figure = money(boxBalanceFils(s, box.id));
    return {
      id: box.id,
      kind: box.kind,
      status: box.status,
      openingStatus: box.opening_status,
      balanceFils: figure.fils,
      text: figure.text,
      textDashboard: figure.textDashboard,
    };
  });
  const activeKnownTotal = activeBoxes
    .filter(b => b.opening_status === "known")
    .reduce((sum, b) => sum + boxBalanceFils(s, b.id), 0);

  // Lines and their outstanding (§8.2) — shared by the aggregates and the
  // per-sale derivations.
  const lineFigures = s.lines.map(line => ({
    line,
    outstanding: lineOutstandingFils(s, line.id, line.direction === "to_me" ? "to_me" : "by_me"),
  }));
  const receivablesFils = lineFigures
    .filter(l => l.line.direction === "to_me")
    .reduce((sum, l) => sum + Math.max(l.outstanding, 0), 0);
  const payablesLinesFils = lineFigures
    .filter(l => l.line.direction === "by_me")
    .reduce((sum, l) => sum + Math.max(l.outstanding, 0), 0);
  const prepaymentsFils = Math.max(sumAccount(s, "PRE"), 0);
  const overdueBefore = (() => {
    const d = new Date(`${today}T00:00:00Z`);
    return new Date(d.getTime() - 14 * 86_400_000).toISOString().slice(0, 10);
  })();

  // The period figures (§8).
  const salesFils = sumWhere(
    s,
    "REV",
    p => p.rev_kind === "delivery" || p.rev_kind === "kept_prepayment" || p.rev_kind === "overpayment",
    range,
  );
  const returnsFils =
    -sumWhere(s, "REV", p => p.rev_kind === "return" || p.rev_kind === "write_off", range) + 0;
  const netSalesFils = salesFils - returnsFils;
  const expensesFils = sumAccount(s, "EXP", range);
  const netProfitFils = netSalesFils - expensesFils;
  const equipmentFils = sumWhere(s, "EXP", p => p.category === "equipment", range);
  const withdrawalsFils = sumAccount(s, "OWN_OUT", range);
  const depositsFils = sumAccount(s, "OWN_IN", range);
  const unexplainedFils = sumAccount(s, "UNEXP", range);
  const materialsFils = sumWhere(s, "EXP", p => p.category === "materials_packaging", range);

  // Net worth and its sources (§8, INV-1).
  const netWorthFils =
    sumAccount(s, "BOX") +
    lineFigures.reduce((sum, l) => sum + l.outstanding * (l.line.direction === "to_me" ? 1 : -1), 0) -
    Math.max(sumAccount(s, "PRE"), 0);
  const netProfitSinceStart =
    sumWhere(
      s,
      "REV",
      p => p.rev_kind === "delivery" || p.rev_kind === "kept_prepayment" || p.rev_kind === "overpayment",
      sinceStart,
    ) +
    sumWhere(s, "REV", p => p.rev_kind === "return" || p.rev_kind === "write_off", sinceStart) -
    sumAccount(s, "EXP", sinceStart);
  const sources = unknownBalance
    ? null
    : {
        openingFils: sumAccount(s, "OPEN"),
        ownerDepositsFils: sumAccount(s, "OWN_IN"),
        ownerWithdrawalsFils: sumAccount(s, "OWN_OUT"),
        netProfitSinceStartFils: netProfitSinceStart,
        unexplainedFils: sumAccount(s, "UNEXP"),
      };

  const salesList = salesListRows(s, today, lineFigures);

  // Top sellers / top profit (§8, binding interpretation 5 for the order).
  const products = topProductEntries(s, range);
  const topSellers = [...products]
    .sort((a, b) => b.valueFils - a.valueFils || a.productId.localeCompare(b.productId))
    .map(e => ({
      productId: e.productId,
      name: e.name,
      valueFils: e.valueFils,
      quantityText: quantityText(e.quantityMilli),
    }));
  const topProfit = [...products]
    .filter(e => e.costKnown)
    .sort((a, b) => b.profitFils - a.profitFils || a.productId.localeCompare(b.productId))
    .map(e => ({
      productId: e.productId,
      name: e.name,
      profitFils: e.profitFils,
      perUnitText: quantityText(perUnitFils(e.profitFils, e.quantityMilli)),
    }));

  // Expenses by category, the biggest, the materials alert (§8/§8.2).
  const { byCategory, biggest } = expenseCategories(s, range);
  const materialsAlert = netSalesFils > 0 && materialsFils > netSalesFils / 2;

  // The profit bars (§8) with the incomplete marking (§8).
  const bars = profitBarsOf(periodKind, today, s.firstDate).map(bar => {
    const barRange: PeriodRange = { kind: range.kind, from: bar.from, to: bar.to };
    const barSales = sumWhere(
      s,
      "REV",
      p => p.rev_kind === "delivery" || p.rev_kind === "kept_prepayment" || p.rev_kind === "overpayment",
      barRange,
    );
    const barReturns = -sumWhere(
      s,
      "REV",
      p => p.rev_kind === "return" || p.rev_kind === "write_off",
      barRange,
    );
    return {
      label: bar.label,
      from: bar.from,
      to: bar.to,
      netProfitFils: barSales - barReturns - sumAccount(s, "EXP", barRange),
      incomplete: unknownBalance || periodOverlapsIncompleteAbsence(barRange, s.absences),
    };
  });

  const payablesBreakdown = lineFigures
    .filter(l => l.line.direction === "by_me" && l.outstanding > 0)
    .reduce<Map<string, number>>((map, l) => {
      map.set(l.line.kind, (map.get(l.line.kind) ?? 0) + l.outstanding);
      return map;
    }, new Map());

  return {
    period: {
      kind: periodKind,
      from: range.kind === "since_start" ? s.firstDate : range.from,
      to: range.to,
      label: periodLabel(range),
      labelText: periodLabel(range),
    },
    boxes,
    totalBalance: unknownBalance ? unknown() : money(activeKnownTotal),
    receivables: money(receivablesFils),
    payables: money(payablesLinesFils + prepaymentsFils),
    payablesPrepayments: money(prepaymentsFils),
    whatYouHave: unknownBalance ? unknown() : money(sumAccount(s, "BOX") + receivablesFils),
    whatYouOwe: money(payablesLinesFils + prepaymentsFils),
    whatYouOweBreakdown: [...payablesBreakdown.entries()]
      .map(([kind, fils]) => ({ kind, fils, text: money(fils).text }))
      .sort((a, b) => a.kind.localeCompare(b.kind)),
    sales: money(salesFils),
    returnsAndDiscounts: money(returnsFils),
    netSales: money(netSalesFils),
    expenses: money(expensesFils),
    netProfit: money(netProfitFils),
    equipment: money(equipmentFils),
    personalWithdrawals: money(withdrawalsFils),
    ownerDeposits: money(depositsFils),
    perTenRatio: perTenRatio(netProfitFils, netSalesFils),
    biggestExpense: biggest,
    expensesByCategory: byCategory,
    materialsAlert,
    unexplained: { fils: unexplainedFils, shown: unexplainedFils !== 0, text: money(unexplainedFils).text },
    netWorth: unknownBalance ? unknown() : money(netWorthFils),
    netWorthSources:
      sources === null
        ? null
        : {
            ...sources,
            totalFils:
              sources.openingFils +
              sources.ownerDepositsFils -
              sources.ownerWithdrawalsFils +
              sources.netProfitSinceStartFils +
              sources.unexplainedFils,
          },
    overdueReceivables: lineFigures
      .filter(l => l.line.direction === "to_me" && l.outstanding > 0 && l.line.origin_on <= overdueBefore)
      .map(l => ({
        lineId: l.line.id,
        counterpartyName: l.line.counterparty_name,
        outstandingFils: l.outstanding,
        originOn: l.line.origin_on,
        text: money(l.outstanding).text,
      })),
    balanceLines: lineFigures.map(l => ({
      id: l.line.id,
      direction: l.line.direction,
      kind: l.line.kind,
      counterpartyName: l.line.counterparty_name,
      originOn: l.line.origin_on,
      outstandingFils: l.outstanding,
      overdue: l.line.direction === "to_me" && l.outstanding > 0 && l.line.origin_on <= overdueBefore,
      text: money(l.outstanding).text,
    })),
    salesList,
    topSellers,
    topProfit,
    bars,
    flags: {
      newUser: !s.hasNonSetupOperation,
      incompletePeriod: unknownBalance || periodOverlapsIncompleteAbsence(range, s.absences),
      unknownBalance,
    },
  };
}
