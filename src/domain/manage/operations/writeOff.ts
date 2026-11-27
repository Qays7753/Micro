/**
 * M2.9 (Manage v2 phase 2, wave H — spec §5 OP-WRITE-OFF, §4 Q17, R-12,
 * R-26; tests T22, T25, T39): the standalone write-off — available on any
 * open `to_me` line (sale_remainder, prior_receivable, loan_given).
 *
 * Contract (§5 OP-WRITE-OFF): inputs balance_line_id, amount (DEFAULT full
 * outstanding). Validation: 0 < amount ≤ outstanding (`E-OVERPAY`) — a
 * PARTIAL write-off is allowed (any amount in that range). Entries: Q17 —
 * `AR[L] −a`, then by L.kind: sale_remainder → `REV[s] −a` (rev_kind
 * `write_off`, effective today per §4); prior_receivable → `OPEN −a`;
 * loan_given → `OWN_OUT +a` (the owner-withdrawal treatment: a written-off
 * loan becomes a withdrawal — T25 — and a loan given never counted as one
 * before that).
 *
 * Write-off never touches profit (acceptance): REV moves only for a
 * sale_remainder (a revenue reversal, not an expense), EXP never. No box
 * moves — no BOX posting, no w.negative_box.
 *
 * effective_on (R-26): accepted, default today, ≤ today; the Q17 entry
 * follows it EXCEPT on a sale_remainder, which §4 fixes to today — the same
 * reading M2.8 applied to the shortfall write-off inside OP-COLLECT.
 *
 * PURE PLANNER (M1.6 boundary): the line and its outstanding load inside
 * the handler's transaction (`loadState`) after the reservation, before any
 * write; a rejection (E-OVERPAY, E-NO-OPEN-BALANCE for a line that is not
 * an OPEN to_me balance, E-FUTURE-DATE, E-AMOUNT) rolls the reservation
 * back (R-12).
 */
import { buildLedgerEntry } from "../ledger/index.js";
import type { LedgerWriteOffLineKind } from "../ledger/index.js";
import { loadOpenLineById } from "./allocation.js";
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

export interface WriteOffInput extends OperationContextInput {
  balanceLineId: unknown;
  amountFils?: unknown;
  effectiveOn?: unknown;
}

/** The three to_me line kinds §5/§4 allow to write off. */
function isWriteOffLineKind(kind: string): kind is LedgerWriteOffLineKind {
  return kind === "sale_remainder" || kind === "prior_receivable" || kind === "loan_given";
}

function requireEffectiveOn(effectiveOn: unknown, today: string): string {
  if (effectiveOn === undefined) return today;
  const date = requireDate(effectiveOn);
  if (date > today) reject("E-FUTURE-DATE");
  return date;
}

/** Plan OP-WRITE-OFF. */
export function planWriteOff(input: WriteOffInput): OperationPlan {
  const ctx = requireContext(input);
  if (typeof input.balanceLineId !== "string" || input.balanceLineId.length === 0) reject("E-AMOUNT");
  const balanceLineId = input.balanceLineId;
  // amount: default = the line's FULL outstanding (resolved in the
  // transaction); when sent it must be a positive integer fils amount.
  const amountSent = input.amountFils === undefined ? undefined : requirePositiveFils(input.amountFils);
  const effectiveOn = requireEffectiveOn(input.effectiveOn, ctx.today);

  // Idempotency identity (R-25): the validated inputs only — the defaulted
  // amount is recomputed identically on a retry.
  const intent = {
    balanceLineId,
    ...(amountSent === undefined ? {} : { amountFils: amountSent }),
    effectiveOn,
  };
  const write: OperationWritePlan = {
    projectId: ctx.projectId,
    createdByAccountId: ctx.createdByAccountId,
    requestId: ctx.requestId,
    kind: "OP-WRITE-OFF",
    effectiveOn,
    amountFils: amountSent ?? 0,
    payload: intent,
    intent,
    // The line (and the defaulted amount) resolve inside the transaction.
    entries: [],
  };

  return {
    write,
    loadState: async (tx: TxQuery): Promise<void> => {
      // The target line: an OPEN to_me balance — E-NO-OPEN-BALANCE
      // otherwise (a by_me line, a closed line or an unknown id is not an
      // open balance; §5 makes write-off a to_me-only surface).
      const line = await loadOpenLineById(tx, ctx.projectId, "to_me", "AR", balanceLineId);
      if (line === null) reject("E-NO-OPEN-BALANCE");
      const target = line;
      if (!isWriteOffLineKind(target.kind)) reject("E-NO-OPEN-BALANCE");
      const amountFils = amountSent ?? target.outstandingFils;
      // §5: 0 < amount ≤ outstanding (E-OVERPAY — T39).
      if (amountFils > target.outstandingFils) reject("E-OVERPAY");
      write.amountFils = amountFils;

      write.balanceLineId = target.id;
      if (target.kind === "sale_remainder" && target.saleId !== null) {
        write.saleId = target.saleId;
      }
      write.entries = [
        buildLedgerEntry({
          type: "Q17",
          // §4: a sale_remainder write-off is effective today; the other
          // kinds follow the operation's effective date.
          effectiveOn: target.kind === "sale_remainder" ? ctx.today : effectiveOn,
          lineId: target.id,
          lineKind: target.kind,
          amountFils,
          ...(target.kind === "sale_remainder" && target.saleId !== null ? { saleId: target.saleId } : {}),
        }),
      ];
    },
  };
}
