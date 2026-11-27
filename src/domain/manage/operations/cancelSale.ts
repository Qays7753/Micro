/**
 * M3.6 (Manage v2 phase 3 — spec §5 OP-CANCEL-SALE, §4 Q15, §3.4, §6,
 * R-26; tests S3, T11, T24, T50): cancel a sale — FINAL, there is no undo
 * (to restore the order the user creates a new sale).
 *
 * Contract (§5): sale_id; when PRE[s] > 0: the kept amount m (default =
 * PRE[s]) and, when something is refunded (r = p − m > 0), the refund
 * choice `now(box)` | `later`. Validation: not delivered
 * (E-CANCEL-DELIVERED); not already cancelled; 0 ≤ m ≤ PRE[s] (E-OVERPAY,
 * T50). Effective on the cancellation date — TODAY (R-26's explicit
 * exception list). Entries: PRE = 0 → none; else Q15 (§4): m > 0 →
 * PRE −m + REV +m (kept_prepayment) on the cancel date; r > 0 now →
 * BOX −r + PRE −r; r > 0 later → PRE −r + a new customer_refund line with
 * AP +r (T11). The sale row's cancelled_on is set (§3.4) and the §6 status
 * becomes cancelled.
 *
 * Cancelling the SALE_CREATE operation from the activity log runs THIS
 * operation (§5 OP-CANCEL-OPERATION) — wired in cancelOperation.ts.
 *
 * PURE PLANNER: the sale's state and the prepayment total live in the
 * database — resolved inside the handler's transaction (`loadState`) with
 * the sale row locked FOR UPDATE; the refund-now box resolves to the given
 * kind's active box (R-9). A missing refund choice with r > 0 is malformed
 * (E-AMOUNT — §5 asks the question; m defaults to the full prepayment so a
 * silent choice is never guessed).
 */
import { buildLedgerEntry } from "../ledger/index.js";
import type { LedgerRefundChoice } from "../ledger/index.js";
import {
  reject,
  requireContext,
  requireNonNegativeFils,
  type OperationContextInput,
  type OperationPlan,
  type OperationWritePlan,
  type PlanBalanceLine,
  type TxQuery,
} from "./support.js";

/** The refund choice as it arrives from the route layer. */
export type CancelSaleRefundInput = { mode: "now"; box: unknown } | { mode: "later" };

export interface CancelSaleInput extends OperationContextInput {
  saleId: unknown;
  keptFils?: unknown;
  refund?: CancelSaleRefundInput;
}

/** Plan OP-CANCEL-SALE: validate, then resolve the sale's state and the
 * prepayment inside the transaction, post Q15 there, and set cancelled_on. */
export function planCancelSale(input: CancelSaleInput): OperationPlan {
  const ctx = requireContext(input);
  if (typeof input.saleId !== "string" || input.saleId.length === 0) reject("E-AMOUNT");
  const keptFils = input.keptFils === undefined ? undefined : requireNonNegativeFils(input.keptFils);
  const refundChoice = parseRefundChoice(input.refund);
  const intent = {
    saleId: input.saleId,
    ...(keptFils === undefined ? {} : { keptFils }),
    ...(input.refund === undefined
      ? {}
      : input.refund.mode === "now"
        ? { refund: { mode: "now", box: refundChoice.box } }
        : { refund: { mode: "later" } }),
  };
  const write: OperationWritePlan = {
    projectId: ctx.projectId,
    createdByAccountId: ctx.createdByAccountId,
    requestId: ctx.requestId,
    kind: "OP-CANCEL-SALE",
    // R-26: the cancellation uses today.
    effectiveOn: ctx.today,
    amountFils: keptFils ?? 0, // §5.0: the kept amount, blank if none
    saleId: input.saleId,
    payload: intent,
    intent,
    entries: [],
  };
  const resolved: {
    keptFils: number;
    refundedFils: number;
  } = { keptFils: 0, refundedFils: 0 };
  return {
    write,
    loadState: cancelSaleLoadState(
      ctx.projectId,
      ctx.today,
      input.saleId,
      keptFils,
      refundChoice,
      write,
      resolved,
    ),
    extraWrites: async context => {
      // §3.4: cancelled_on — the §6 status derives from it.
      await context.tx`
        UPDATE sale SET cancelled_on = ${ctx.today}, updated_at = now()
        WHERE id = ${input.saleId} AND project_id = ${ctx.projectId}`;
    },
    resultData: async () => ({
      saleId: input.saleId,
      status: "cancelled",
      keptFils: resolved.keptFils,
      refundedFils: resolved.refundedFils,
    }),
  };
}

/** «Load state in the transaction» (§14.1): lock the sale (not delivered,
 * not cancelled), read p = PRE[s], validate 0 ≤ m ≤ p, resolve the refund
 * box or line, and build Q15. */
function cancelSaleLoadState(
  projectId: string,
  today: string,
  saleId: string,
  keptFils: number | undefined,
  refundChoice: RefundChoice,
  write: OperationWritePlan,
  resolved: { keptFils: number; refundedFils: number },
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
    if (deliveries.length > 0) reject("E-CANCEL-DELIVERED");
    // p = PRE[s] (the net of every PRE posting).
    const prepayRows = (await tx`
      SELECT COALESCE(SUM(p.delta_minor), 0)::bigint AS total
      FROM ledger_posting p WHERE p.project_id = ${projectId} AND p.account = 'PRE' AND p.ref_id = ${saleId}`) as Array<{
      total: string | number;
    }>;
    const prepaymentFils = Number(prepayRows[0]!.total);
    // §5: m defaults to the whole prepayment; 0 ≤ m ≤ p (T50).
    const kept = keptFils ?? prepaymentFils;
    if (kept > prepaymentFils) reject("E-OVERPAY");
    const refundFils = prepaymentFils - kept;
    if (prepaymentFils === 0) {
      // §5: no entries at all — just the cancelled_on update.
      write.amountFils = null;
      resolved.keptFils = 0;
      resolved.refundedFils = 0;
      return;
    }
    write.amountFils = kept;
    const refund = await resolveRefund(tx, projectId, today, saleId, refundFils, refundChoice, write);
    write.balanceLines = write.balanceLines ?? [];
    write.entries = [
      // The M2.2 single door: buildLedgerEntry dispatches Q15 to its
      // compound builder (the registry owns the wiring).
      buildLedgerEntry({
        type: "Q15",
        saleId,
        prepaymentFils,
        keptFils: kept,
        refund,
        effectiveOn: today,
      }),
    ];
    resolved.keptFils = kept;
    resolved.refundedFils = refundFils;
  };
}

/** The parsed refund choice: which box kind, or the later line. */
interface RefundChoice {
  box: "cash" | "account" | undefined;
  later: boolean;
}

function parseRefundChoice(refund: CancelSaleRefundInput | undefined): RefundChoice {
  if (refund === undefined) return { box: undefined, later: false };
  if (refund.mode === "now") {
    if (refund.box !== "cash" && refund.box !== "account") reject("E-AMOUNT");
    return { box: refund.box, later: false };
  }
  if (refund.mode === "later") return { box: undefined, later: true };
  reject("E-AMOUNT");
}

/** Resolve the refund choice inside the transaction: the now-box (locked)
 * or the later customer_refund line; fills write.balanceLines/
 * write.balanceLineId/boxId and returns the Q15 refund shape. */
async function resolveRefund(
  tx: TxQuery,
  projectId: string,
  today: string,
  saleId: string,
  refundFils: number,
  choice: RefundChoice,
  write: OperationWritePlan,
): Promise<LedgerRefundChoice> {
  if (refundFils <= 0) return { mode: "none" };
  if (choice.box !== undefined) {
    // Refund now: the given kind's active box, locked.
    const boxes = (await tx`
      SELECT id FROM box
      WHERE project_id = ${projectId} AND kind = ${choice.box} AND status = 'active'
      FOR UPDATE`) as Array<{ id: string }>;
    if (boxes.length === 0) reject("E-BOX-STATE");
    write.boxId = String(boxes[0]!.id);
    return { mode: "now", boxId: write.boxId };
  }
  if (choice.later) {
    const refundLineId = crypto.randomUUID();
    write.balanceLines = [
      { id: refundLineId, direction: "by_me", kind: "customer_refund", originOn: today, saleId },
    ];
    write.balanceLineId = refundLineId;
    return { mode: "later", lineId: refundLineId };
  }
  // §5 asks the refund question; a silent choice is never guessed.
  reject("E-AMOUNT");
}
