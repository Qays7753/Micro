/**
 * M3.7 (Manage v2 phase 3 — spec §5 OP-RETURN, §4 Q16, §8
 * net_sale_revenue; tests S4, T2, T3): a return on a DELIVERED sale.
 *
 * Contract (§5): sale_id, amount r > 0, refund: `now(box)` | `later`,
 * effective_on (default today, ≤ today — R-13/R-26). Validation: the sale
 * is delivered (E-SALE-STATE — cancelled is not deliverable state either,
 * §6); r ≤ net_sale_revenue(s) = Σ REV[s] active (§8) → E-RETURN-AMOUNT.
 * Entries: Q16 (§4) — REV[s] −r (rev_kind return) on the return date;
 * x = min(r, outstanding of the sale's sale_remainder line) → AR[L] −x;
 * y = r − x → refund now: BOX[k] −y, or refund later: a new
 * customer_refund line with AP[L] +y.
 *
 * PURE PLANNER: the sale's state, its net revenue, the remainder line and
 * its outstanding live in the database — resolved inside the handler's
 * transaction (`loadState`) with the sale row locked FOR UPDATE; the
 * refund-now box resolves to the given kind's active box (R-9).
 */
import { buildLedgerEntry } from "../ledger/index.js";
import type { LedgerRefundChoice } from "../ledger/index.js";
import {
  reject,
  requireContext,
  requireDate,
  requirePositiveFils,
  type OperationContextInput,
  type OperationPlan,
  type OperationWritePlan,
  type PlanBalanceLine,
  type TxQuery,
} from "./support.js";

/** The refund choice as it arrives from the route layer. */
export type ReturnRefundInput = { mode: "now"; box: unknown } | { mode: "later" };

export interface ReturnInput extends OperationContextInput {
  saleId: unknown;
  amountFils: unknown;
  refund: ReturnRefundInput;
  effectiveOn?: unknown;
}

/** The parsed refund choice. */
interface RefundChoice {
  box: "cash" | "account" | undefined;
  later: boolean;
}

function parseRefundChoice(refund: ReturnRefundInput): RefundChoice {
  if (refund.mode === "now") {
    if (refund.box !== "cash" && refund.box !== "account") reject("E-AMOUNT");
    return { box: refund.box, later: false };
  }
  if (refund.mode === "later") return { box: undefined, later: true };
  reject("E-AMOUNT");
}

/** Plan OP-RETURN: validate, then resolve the sale's state, its net
 * revenue and the remainder inside the transaction, and post Q16 there. */
export function planReturn(input: ReturnInput): OperationPlan {
  const ctx = requireContext(input);
  if (typeof input.saleId !== "string" || input.saleId.length === 0) reject("E-AMOUNT");
  const amountFils = requirePositiveFils(input.amountFils);
  const refundChoice = parseRefundChoice(input.refund);
  const effectiveOn = input.effectiveOn === undefined ? ctx.today : requireDate(input.effectiveOn);
  if (effectiveOn > ctx.today) reject("E-FUTURE-DATE");
  const intent = {
    saleId: input.saleId,
    amountFils,
    ...(refundChoice.box === undefined
      ? { refund: { mode: "later" } }
      : { refund: { mode: "now", box: refundChoice.box } }),
    effectiveOn,
  };
  const write: OperationWritePlan = {
    projectId: ctx.projectId,
    createdByAccountId: ctx.createdByAccountId,
    requestId: ctx.requestId,
    kind: "OP-RETURN",
    effectiveOn,
    amountFils,
    saleId: input.saleId,
    payload: intent,
    intent,
    entries: [],
  };
  const resolved: { appliedFils: number; refundedFils: number } = { appliedFils: 0, refundedFils: 0 };
  return {
    write,
    loadState: returnLoadState(
      ctx.projectId,
      input.saleId,
      amountFils,
      refundChoice,
      effectiveOn,
      write,
      resolved,
    ),
    resultData: async () => ({
      saleId: input.saleId,
      appliedToRemainderFils: resolved.appliedFils,
      refundedFils: resolved.refundedFils,
    }),
  };
}

/** The sale's remainder line (its outstanding) — NULL when the sale has
 * none (fully collected or refunded at delivery). */
async function remainderLineOf(
  tx: TxQuery,
  projectId: string,
  saleId: string,
): Promise<{ id: string; outstandingFils: number } | null> {
  const rows = (await tx`
    SELECT l.id,
           COALESCE(SUM(p.delta_minor), 0)::bigint AS outstanding
    FROM balance_line l
    LEFT JOIN ledger_posting p
      ON p.project_id = l.project_id AND p.account = 'AR' AND p.ref_id = l.id
    WHERE l.project_id = ${projectId} AND l.sale_id = ${saleId} AND l.kind = 'sale_remainder'
    GROUP BY l.id`) as Array<{ id: string; outstanding: string | number }>;
  const row = rows[0];
  if (row === undefined) return null;
  return { id: String(row.id), outstandingFils: Number(row.outstanding) };
}

/** «Load state in the transaction» (§14.1): lock the sale (delivered, not
 * cancelled), read the net revenue (Σ REV[s] active) and the remainder's
 * outstanding, validate r ≤ net revenue, resolve the refund, build Q16. */
function returnLoadState(
  projectId: string,
  saleId: string,
  amountFils: number,
  refundChoice: RefundChoice,
  effectiveOn: string,
  write: OperationWritePlan,
  resolved: { appliedFils: number; refundedFils: number },
): (tx: TxQuery) => Promise<void> {
  return async (tx: TxQuery) => {
    const sales = (await tx`
      SELECT cancelled_on::text AS cancelled_on FROM sale
      WHERE id = ${saleId} AND project_id = ${projectId}
      FOR UPDATE`) as Array<{ cancelled_on: string | null }>;
    const sale = sales[0];
    if (sale === undefined || sale.cancelled_on !== null) reject("E-SALE-STATE");
    // §3.4: delivered iff a non-reversed Q5 exists.
    const deliveries = (await tx`
      SELECT 1 FROM ledger_entry e
      JOIN operation o ON o.id = e.operation_id
      WHERE o.project_id = ${projectId} AND o.sale_id = ${saleId} AND e.entry_type = 'Q5'
        AND NOT EXISTS (SELECT 1 FROM ledger_entry r WHERE r.reverses_entry_id = e.id)`) as unknown[];
    if (deliveries.length === 0) reject("E-SALE-STATE");
    // §8: net_sale_revenue(s) = Σ REV[s] of ACTIVE entries (the §8 read:
    // an entry reversed by a Q20 drops out and the Q20 itself nets it).
    const revenueRows = (await tx`
      SELECT COALESCE(SUM(p.delta_minor), 0)::bigint AS total
      FROM ledger_posting p
      JOIN ledger_entry e ON e.id = p.entry_id
      WHERE p.project_id = ${projectId} AND p.account = 'REV' AND p.ref_id = ${saleId}
        AND NOT EXISTS (SELECT 1 FROM ledger_entry r WHERE r.reverses_entry_id = e.id)`) as Array<{
      total: string | number;
    }>;
    const netRevenueFils = Number(revenueRows[0]!.total);
    if (amountFils > netRevenueFils) reject("E-RETURN-AMOUNT");
    // x = min(r, remainder outstanding); y = r − x; then Q16.
    const remainder = await remainderLineOf(tx, projectId, saleId);
    const q16 = await buildQ16WithRefund(
      tx,
      projectId,
      saleId,
      amountFils,
      remainder,
      refundChoice,
      effectiveOn,
      write,
    );
    resolved.appliedFils = q16.appliedFils;
    resolved.refundedFils = q16.refundedFils;
  };
}

/** Resolve the refund (the now-box locked, or the later line) and build
 * Q16 — returns the applied/refunded split for the response. */
async function buildQ16WithRefund(
  tx: TxQuery,
  projectId: string,
  saleId: string,
  amountFils: number,
  remainder: { id: string; outstandingFils: number } | null,
  refundChoice: RefundChoice,
  effectiveOn: string,
  write: OperationWritePlan,
): Promise<{ appliedFils: number; refundedFils: number }> {
  const remainderOutstanding = remainder?.outstandingFils ?? 0;
  const appliedFils = Math.min(amountFils, remainderOutstanding);
  const refundedFils = amountFils - appliedFils;
  let refund: LedgerRefundChoice = { mode: "none" };
  const balanceLines: PlanBalanceLine[] = [];
  if (refundedFils > 0) {
    if (refundChoice.box !== undefined) {
      const boxes = (await tx`
        SELECT id FROM box
        WHERE project_id = ${projectId} AND kind = ${refundChoice.box} AND status = 'active'
        FOR UPDATE`) as Array<{ id: string }>;
      if (boxes.length === 0) reject("E-BOX-STATE");
      write.boxId = String(boxes[0]!.id);
      refund = { mode: "now", boxId: write.boxId };
    } else if (refundChoice.later) {
      const refundLineId = crypto.randomUUID();
      balanceLines.push({
        id: refundLineId,
        direction: "by_me",
        kind: "customer_refund",
        originOn: effectiveOn,
        saleId,
      });
      write.balanceLineId = refundLineId;
      refund = { mode: "later", lineId: refundLineId };
    } else {
      reject("E-AMOUNT");
    }
  }
  write.balanceLines = balanceLines;
  write.entries = [
    buildLedgerEntry({
      type: "Q16",
      saleId,
      returnFils: amountFils,
      remainderOutstandingFils: remainderOutstanding,
      ...(remainder !== null ? { remainderLineId: remainder.id } : {}),
      refund,
      effectiveOn,
    }),
  ];
  return { appliedFils, refundedFils };
}
