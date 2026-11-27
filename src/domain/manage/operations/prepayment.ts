/**
 * M3.3 (Manage v2 phase 3 — spec §5 OP-PREPAYMENT, §4 Q4, R-13, R-26;
 * tests S1 prepayment slice, T1 prepayment half, T40 prepayment half): any
 * money received on an UNDELIVERED sale is a prepayment — Q4 posts
 * BOX[k] +a / PRE[s] +a and nothing else moves.
 *
 * Contract (§5): sale_id, amount (> 0), box, effective_on (default today,
 * ≤ today — a money operation, R-13). Validation: the sale is not delivered
 * and not cancelled (E-SALE-STATE). Entries: Q4. The «المبلغ كاملاً» UI
 * option (final price − PRE, only when a final price exists) is a FORM
 * concern — the operation takes the amount as given.
 *
 * PURE PLANNER whose entries need live state: the box is identified by its
 * kind (R-9: one box per kind per project) and the sale's state (delivered
 * iff it has a non-reversed Q5, §3.4; cancelled iff cancelled_on is set)
 * lives in the database — both resolve inside the handler's transaction
 * (`loadState`): the box row is locked FOR UPDATE (not active →
 * E-BOX-STATE), and a sale that is missing, delivered or cancelled answers
 * E-SALE-STATE. A rejection rolls back the reservation too.
 */
import { buildLedgerEntry } from "../ledger/index.js";
import {
  reject,
  requireContext,
  requireDate,
  requirePositiveFils,
  type OperationContextInput,
  type OperationPlan,
  type OperationWritePlan,
  type TxQuery,
} from "./support.js";

export interface PrepaymentInput extends OperationContextInput {
  saleId: unknown;
  amountFils: unknown;
  box: unknown;
  effectiveOn?: unknown;
}

/** Plan OP-PREPAYMENT: validate, then resolve the box and the sale's state
 * inside the handler's transaction and post Q4 there. */
export function planPrepayment(input: PrepaymentInput): OperationPlan {
  const ctx = requireContext(input);
  if (typeof input.saleId !== "string" || input.saleId.length === 0) reject("E-AMOUNT");
  const amountFils = requirePositiveFils(input.amountFils);
  if (input.box !== "cash" && input.box !== "account") reject("E-AMOUNT");
  // R-13/R-26: default today, never a future effective date.
  const effectiveOn = input.effectiveOn === undefined ? ctx.today : requireDate(input.effectiveOn);
  if (effectiveOn > ctx.today) reject("E-FUTURE-DATE");
  const intent = { saleId: input.saleId, amountFils, box: input.box, effectiveOn };
  const write: OperationWritePlan = {
    projectId: ctx.projectId,
    createdByAccountId: ctx.createdByAccountId,
    requestId: ctx.requestId,
    kind: "OP-PREPAYMENT",
    effectiveOn,
    amountFils,
    saleId: input.saleId,
    payload: intent,
    intent,
    // The box and the entry are resolved inside the transaction.
    entries: [],
  };
  return {
    write,
    loadState: prepaymentLoadState(ctx.projectId, input.saleId, amountFils, input.box, effectiveOn, write),
  };
}

/** «Load state in the transaction» (§14.1): lock the active box of the
 * given kind, verify the sale is neither delivered (a non-reversed Q5,
 * §3.4) nor cancelled (§3.4), and build Q4 against the resolved ids. */
function prepaymentLoadState(
  projectId: string,
  saleId: string,
  amountFils: number,
  box: "cash" | "account",
  effectiveOn: string,
  write: OperationWritePlan,
): (tx: TxQuery) => Promise<void> {
  return async (tx: TxQuery) => {
    const boxes = (await tx`
      SELECT id FROM box
      WHERE project_id = ${projectId} AND kind = ${box} AND status = 'active'
      FOR UPDATE`) as Array<{ id: string }>;
    if (boxes.length === 0) reject("E-BOX-STATE");
    const boxId = String(boxes[0]!.id);
    const sales = (await tx`
      SELECT cancelled_on::text AS cancelled_on FROM sale
      WHERE id = ${saleId} AND project_id = ${projectId}`) as Array<{ cancelled_on: string | null }>;
    const sale = sales[0];
    if (sale === undefined || sale.cancelled_on !== null) reject("E-SALE-STATE");
    const deliveries = (await tx`
      SELECT 1 FROM ledger_entry e
      JOIN operation o ON o.id = e.operation_id
      WHERE o.project_id = ${projectId} AND o.sale_id = ${saleId} AND e.entry_type = 'Q5'
        AND NOT EXISTS (SELECT 1 FROM ledger_entry r WHERE r.reverses_entry_id = e.id)`) as unknown[];
    if (deliveries.length > 0) reject("E-SALE-STATE");
    write.boxId = boxId;
    write.entries = [buildLedgerEntry({ type: "Q4", effectiveOn, boxId, saleId, amountFils })];
  };
}
