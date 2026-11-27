/**
 * M2.5 (Manage v2 phase 2, wave G — spec §5 OP-ADD-PRIOR-BALANCE, Q2/Q3):
 * record a prior receivable/payable FOR TRACKING ONLY.
 *
 * Contract (§5): inputs direction (to_me | by_me), counterparty_name,
 * amount, origin_on (default today, ≤ today). Entries: Q2 (to_me) or Q3
 * (by_me) on a NEW balance_line (§3.6 kind prior_receivable /
 * prior_payable). NO money moves: no BOX posting, no REV/EXP — profit 0,
 * boxes unchanged (T38). The same line is later collected/paid via
 * OP-COLLECT / OP-PAY (M2.8).
 *
 * PURE PLANNER (M1.6 boundary): the M2.4 handler persists the balance
 * line and the Q2/Q3 entry inside its single transaction.
 */
import { buildLedgerEntry } from "../ledger/index.js";
import {
  reject,
  requireContext,
  requireName,
  requirePositiveFils,
  type OperationContextInput,
  type OperationPlan,
} from "./support.js";

export interface AddPriorBalanceInput extends OperationContextInput {
  direction: unknown;
  counterpartyName: unknown;
  amountFils: unknown;
  originOn?: unknown;
}

/** Plan OP-ADD-PRIOR-BALANCE: one tracking-only line and its Q2/Q3 entry. */
export function planAddPriorBalance(input: AddPriorBalanceInput): OperationPlan {
  const ctx = requireContext(input);
  if (input.direction !== "to_me" && input.direction !== "by_me") reject("E-AMOUNT");
  const direction = input.direction;
  const counterpartyName = requireName(input.counterpartyName);
  const amountFils = requirePositiveFils(input.amountFils);
  // origin_on: default today, ≤ today (§5; R-13).
  const originOn = input.originOn === undefined ? ctx.today : String(input.originOn);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(originOn) || originOn > ctx.today) reject("E-FUTURE-DATE");

  const lineId = crypto.randomUUID();
  const entries = [
    direction === "to_me"
      ? buildLedgerEntry({ type: "Q2", effectiveOn: originOn, lineId, amountFils })
      : buildLedgerEntry({ type: "Q3", effectiveOn: originOn, lineId, amountFils }),
  ];

  return {
    write: {
      projectId: ctx.projectId,
      createdByAccountId: ctx.createdByAccountId,
      requestId: ctx.requestId,
      kind: "OP-ADD-PRIOR-BALANCE",
      effectiveOn: originOn,
      amountFils,
      counterpartyName,
      balanceLines: [
        {
          id: lineId,
          direction,
          kind: direction === "to_me" ? "prior_receivable" : "prior_payable",
          originOn,
          counterpartyName,
        },
      ],
      payload: { direction, originOn },
      // Idempotency identity (R-25): the validated inputs only — the line
      // id is generated per planning.
      intent: { direction, counterpartyName, amountFils, originOn },
      entries,
    },
  };
}
