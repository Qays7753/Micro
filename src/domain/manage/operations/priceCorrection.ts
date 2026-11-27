/**
 * M3.8 (Manage v2 phase 3 — spec §5 OP-PRICE-CORRECTION, §4 Q20+Q5, §3.8
 * balance; test T18): correct the FINAL PRICE after delivery — a recording
 * mistake fix. Atomic: Q20 of the active Q5, then a new Q5 at the new
 * price with the SAME effective date as the original delivery; when the
 * sale-remainder line's outstanding would become negative (−x), the new
 * entry adds AR[L_rem] +x and opens a customer_refund line with AP +x
 * (same entry, balanced — the §3.8 equation holds: +x − x = 0).
 *
 * Contract (§5): sale_id, new final price (> 0). Validation: delivered
 * (E-SALE-STATE — cancelled is not deliverable state either, §6); new
 * price ≥ the sale's total ACTIVE returns (E-RETURN-AMOUNT). Discounts
 * after delivery are NOT price corrections (§5's pointer: OP-WRITE-OFF /
 * OP-RETURN) — nothing here implements a discount.
 *
 * Correction semantics (§5 OP-CORRECT's shape, specialized): the operation
 * owning the CURRENT active Q5 (the delivery, or a previous price
 * correction — "the current version can itself be corrected again")
 * becomes `reversed`; this row carries `corrects_operation_id`. The sale's
 * final_price_minor is updated (§3.4: price changes only through this
 * operation).
 *
 * PURE PLANNER: the sale's state, the active Q5 (its operation, effective
 * date, price, consumed prepayment, remainder/refund line), the remainder's
 * outstanding and the total returns live in the database — resolved inside
 * the handler's transaction (`loadState`) with the sale row locked
 * FOR UPDATE.
 */
import { buildLedgerEntry, validateLedgerEntry } from "../ledger/index.js";
import type { BuiltLedgerEntry, LedgerPosting } from "../ledger/index.js";
import { loadActiveReversibleEntries, reversalEntriesOf } from "./correct.js";
import {
  reject,
  requireContext,
  requirePositiveFils,
  type OperationContextInput,
  type OperationPlan,
  type OperationWritePlan,
  type PlanBalanceLine,
  type TxQuery,
} from "./support.js";

export interface PriceCorrectionInput extends OperationContextInput {
  saleId: unknown;
  newPriceFils: unknown;
}

/** The active Q5's facts, read inside the transaction. */
interface ActiveQ5 {
  entryId: string;
  operationId: string;
  effectiveOn: string;
  priceFils: number;
  prepaymentFils: number;
  /** The remainder line the Q5 opened (null when it opened a refund). */
  remainderLineId: string | null;
}

/** Plan OP-PRICE-CORRECTION: validate, then reverse the active Q5 and post
 * the new one (same date, extra refund pair when needed) atomically. */
export function planPriceCorrection(input: PriceCorrectionInput): OperationPlan {
  const ctx = requireContext(input);
  if (typeof input.saleId !== "string" || input.saleId.length === 0) reject("E-AMOUNT");
  const newPriceFils = requirePositiveFils(input.newPriceFils);
  const intent = { saleId: input.saleId, newPriceFils };
  const write: OperationWritePlan = {
    projectId: ctx.projectId,
    createdByAccountId: ctx.createdByAccountId,
    requestId: ctx.requestId,
    kind: "OP-PRICE-CORRECTION",
    effectiveOn: ctx.today,
    amountFils: newPriceFils,
    saleId: input.saleId,
    payload: intent,
    intent,
    entries: [],
  };
  const resolved: { oldPriceFils: number; correctedOperationId: string } = {
    oldPriceFils: 0,
    correctedOperationId: "",
  };
  return {
    write,
    loadState: priceCorrectionLoadState(ctx.projectId, input.saleId, newPriceFils, write, resolved),
    extraWrites: async context => {
      // §5 OP-CORRECT's shape: the corrected current version becomes
      // reversed, pointed at this correction.
      const corrected = (await context.tx`
        UPDATE operation SET status = ${"reversed"}, reversed_by_operation_id = ${context.operationId}
        WHERE project_id = ${ctx.projectId} AND id = ${resolved.correctedOperationId}
          AND status = ${"active"} AND reversed_by_operation_id IS NULL
        RETURNING id`) as unknown[];
      if (corrected.length === 0) reject("E-AMOUNT");
      // §3.4: the corrected final price lands on the sale row.
      await context.tx`
        UPDATE sale SET final_price_minor = ${newPriceFils}, updated_at = now()
        WHERE id = ${input.saleId} AND project_id = ${ctx.projectId}`;
    },
    resultData: async () => ({
      saleId: input.saleId,
      oldPriceFils: resolved.oldPriceFils,
      newPriceFils,
    }),
  };
}

/** Read the sale's ACTIVE Q5 with all its facts. */
async function activeQ5Of(tx: TxQuery, projectId: string, saleId: string): Promise<ActiveQ5 | null> {
  const rows = (await tx`
    SELECT e.id AS entry_id, e.operation_id, e.effective_on::text AS effective_on,
           COALESCE(SUM(CASE WHEN p.account = 'PRE' THEN -p.delta_minor ELSE 0 END), 0)::bigint AS prepayment,
           MAX(CASE WHEN p.account = 'REV' THEN p.delta_minor END) AS price,
           MAX(CASE WHEN p.account = 'AR' THEN p.ref_id::text END) AS remainder_line_id
    FROM ledger_entry e
    JOIN operation o ON o.id = e.operation_id
    JOIN ledger_posting p ON p.entry_id = e.id
    WHERE o.project_id = ${projectId} AND o.sale_id = ${saleId} AND e.entry_type = 'Q5'
      AND NOT EXISTS (SELECT 1 FROM ledger_entry r WHERE r.reverses_entry_id = e.id)
    GROUP BY e.id, e.operation_id, e.effective_on`) as Array<{
    entry_id: string;
    operation_id: string;
    effective_on: string;
    prepayment: string | number;
    price: string | number | null;
    remainder_line_id: string | null;
  }>;
  const row = rows[0];
  if (row === undefined || row.price === null) return null;
  return {
    entryId: String(row.entry_id),
    operationId: String(row.operation_id),
    effectiveOn: row.effective_on,
    priceFils: Number(row.price),
    prepaymentFils: Number(row.prepayment),
    remainderLineId: row.remainder_line_id === null ? null : String(row.remainder_line_id),
  };
}

/** The sale's total ACTIVE returns (§5's validation term). */
async function totalActiveReturnsFils(tx: TxQuery, projectId: string, saleId: string): Promise<number> {
  const rows = (await tx`
    SELECT COALESCE(SUM(-p.delta_minor), 0)::bigint AS total
    FROM ledger_posting p
    JOIN ledger_entry e ON e.id = p.entry_id
    JOIN operation o ON o.id = e.operation_id
    WHERE p.project_id = ${projectId} AND p.account = 'REV' AND p.ref_id = ${saleId}
      AND p.rev_kind = 'return'
      AND NOT EXISTS (SELECT 1 FROM ledger_entry r WHERE r.reverses_entry_id = e.id)`) as Array<{
    total: string | number;
  }>;
  return Number(rows[0]!.total);
}

/** The remainder line's CURRENT outstanding (0 when the sale has none). */
async function remainderOutstandingFils(
  tx: TxQuery,
  projectId: string,
  remainderLineId: string | null,
): Promise<number> {
  if (remainderLineId === null) return 0;
  const rows = (await tx`
    SELECT COALESCE(SUM(p.delta_minor), 0)::bigint AS outstanding
    FROM ledger_posting p
    WHERE p.project_id = ${projectId} AND p.account = 'AR' AND p.ref_id = ${remainderLineId}`) as Array<{
    outstanding: string | number;
  }>;
  return Number(rows[0]!.outstanding);
}

/** Build the NEW Q5 at the corrected price — same effective date, same
 * prepayment consumed — with §5's extra balanced pair when the remainder
 * outstanding would go negative (−x): AR[L_rem] +x + a customer_refund
 * line AP +x (same entry; the §3.8 equation re-proven on the final shape). */
function buildCorrectedQ5(
  saleId: string,
  active: ActiveQ5,
  newPriceFils: number,
  remainderOutstanding: number,
): { entry: BuiltLedgerEntry; balanceLines: PlanBalanceLine[] } {
  const balanceLines: PlanBalanceLine[] = [];
  const extraPostings: LedgerPosting[] = [];
  let refundLineId: string | null = null;
  // A FRESH refund line when the prepayment exceeds the new price (the old
  // one's posting is reversed by the Q20).
  if (active.prepaymentFils > newPriceFils) {
    refundLineId = crypto.randomUUID();
    balanceLines.push({
      id: refundLineId,
      direction: "by_me",
      kind: "customer_refund",
      originOn: active.effectiveOn,
      saleId,
    });
  }
  const newQ5 = buildLedgerEntry({
    type: "Q5",
    effectiveOn: active.effectiveOn,
    saleId,
    priceFils: newPriceFils,
    prepaymentFils: active.prepaymentFils,
    ...(active.remainderLineId !== null ? { remainderLineId: active.remainderLineId } : {}),
    ...(refundLineId !== null ? { refundLineId } : {}),
  });
  // x = old price − new price − current outstanding (the negative dip).
  const shortfall = active.priceFils - newPriceFils - remainderOutstanding;
  if (active.remainderLineId !== null && shortfall > 0) {
    const extraRefundLineId = crypto.randomUUID();
    balanceLines.push({
      id: extraRefundLineId,
      direction: "by_me",
      kind: "customer_refund",
      originOn: active.effectiveOn,
      saleId,
    });
    extraPostings.push(
      { account: "AR", refId: active.remainderLineId, deltaFils: shortfall },
      { account: "AP", refId: extraRefundLineId, deltaFils: shortfall },
    );
  }
  const entry: BuiltLedgerEntry = { ...newQ5, postings: [...newQ5.postings, ...extraPostings] };
  validateLedgerEntry(entry);
  return { entry, balanceLines };
}

/** «Load state in the transaction» (§14.1): lock the sale, read the active
 * Q5 and the totals, validate, and build the atomic Q20 + new Q5. */
function priceCorrectionLoadState(
  projectId: string,
  saleId: string,
  newPriceFils: number,
  write: OperationWritePlan,
  resolved: { oldPriceFils: number; correctedOperationId: string },
): (tx: TxQuery) => Promise<void> {
  return async (tx: TxQuery) => {
    const sales = (await tx`
      SELECT cancelled_on::text AS cancelled_on FROM sale
      WHERE id = ${saleId} AND project_id = ${projectId}
      FOR UPDATE`) as Array<{ cancelled_on: string | null }>;
    const sale = sales[0];
    if (sale === undefined || sale.cancelled_on !== null) reject("E-SALE-STATE");
    const active = await activeQ5Of(tx, projectId, saleId);
    if (active === null) reject("E-SALE-STATE");
    // §5: the new price must cover the sale's total ACTIVE returns.
    if (newPriceFils < (await totalActiveReturnsFils(tx, projectId, saleId))) reject("E-RETURN-AMOUNT");
    const remainderOutstanding = await remainderOutstandingFils(tx, projectId, active.remainderLineId);
    const corrected = buildCorrectedQ5(saleId, active, newPriceFils, remainderOutstanding);
    // The Q20 of the active Q5 (M2.10's mirror builder, original date).
    const mirrors = reversalEntriesOf(await loadActiveReversibleEntries(tx, projectId, active.operationId));
    const q20 = mirrors.find(m => m.entryType === "Q20" && m.reversesEntryId === active.entryId);
    if (q20 === undefined) reject("E-SALE-STATE");
    write.effectiveOn = active.effectiveOn;
    write.balanceLines = corrected.balanceLines;
    const lineId = active.remainderLineId;
    if (lineId !== null) write.balanceLineId = lineId;
    write.correctsOperationId = active.operationId;
    write.entries = [q20, corrected.entry];
    resolved.oldPriceFils = active.priceFils;
    resolved.correctedOperationId = active.operationId;
  };
}
