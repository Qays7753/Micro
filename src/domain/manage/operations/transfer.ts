/**
 * M2.7 (Manage v2 phase 2, wave G — spec §5 OP-TRANSFER, §4 Q14, R-9, R-12,
 * R-13, R-26; tests T9, T10): transfer an amount from one box to another.
 *
 * Contract (§5): inputs from box, to box, amount. Validation: both boxes
 * active (`E-BOX-STATE`). Entries: Q14(from, to, a) — `BOX[from] −a`,
 * `BOX[to] +a`. Transfers keep totals (T9/T10) and never touch profit
 * (INV-5). OP-TRANSFER accepts effective_on (default today, ≤ today —
 * R-26/R-13).
 *
 * The Q14 entry this operation posts is the same one OP-MERGE-BOXES /
 * OP-SPLIT-BOXES are built on (§5: merge posts Q14 that zeroes the account
 * balance; split posts Q14 cash → account). Those operations — the box
 * status transitions and their specific validations — are M4.1; the Q14
 * semantics are exercised here through OP-TRANSFER (T9/T10's figures).
 *
 * PURE PLANNER (M1.6 boundary): both boxes are identified by their kinds
 * (R-9: one box per kind per project) and only exist in the database. The
 * plan resolves and locks both rows inside the handler's transaction
 * (`loadState`, FOR UPDATE — a transfer's two sides must be arbitrated
 * against concurrent movements of the SAME boxes), refuses a box that is
 * not active with E-BOX-STATE, and refuses a transfer of a box to itself
 * (a no-op movement is not a transfer — invalid input, E-AMOUNT). The
 * entries are built there against the resolved ids.
 *
 * w.negative_box (the T8 box-state rule): the FROM box can end below zero —
 * a WARNING, never a rejection (R-12), decided inside the same transaction
 * after the writes from the box's resulting balance. A box whose opening is
 * unknown has an unknown balance: it never warns.
 */
import { buildLedgerEntry } from "../ledger/index.js";
import {
  negativeBoxWarning,
  reject,
  requireContext,
  requireDate,
  requirePositiveFils,
  type OperationContextInput,
  type OperationPlan,
  type OperationWritePlan,
  type TxQuery,
} from "./support.js";

export interface TransferInput extends OperationContextInput {
  fromBox: unknown;
  toBox: unknown;
  amountFils: unknown;
  effectiveOn?: unknown;
}

/** A box kind (R-9): "cash" | "account". */
function requireBoxKind(box: unknown): "cash" | "account" {
  if (box !== "cash" && box !== "account") reject("E-AMOUNT");
  return box;
}

/** effective_on: default today, never in the future (R-26 / R-13). */
function requireEffectiveOn(effectiveOn: unknown, today: string): string {
  if (effectiveOn === undefined) return today;
  const date = requireDate(effectiveOn);
  if (date > today) reject("E-FUTURE-DATE");
  return date;
}

/** Plan OP-TRANSFER: Q14 between two different active boxes. */
export function planTransfer(input: TransferInput): OperationPlan {
  const ctx = requireContext(input);
  const fromBox = requireBoxKind(input.fromBox);
  const toBox = requireBoxKind(input.toBox);
  const amountFils = requirePositiveFils(input.amountFils);
  const effectiveOn = requireEffectiveOn(input.effectiveOn, ctx.today);
  // A transfer of a box to itself moves nothing — invalid input, not a
  // movement (§5 names two boxes; with R-9 the kinds are the boxes).
  if (fromBox === toBox) reject("E-AMOUNT");

  // Idempotency identity (R-25): the validated inputs — no generated ids.
  const intent = { amountFils, fromBox, toBox, effectiveOn };
  const write: OperationWritePlan = {
    projectId: ctx.projectId,
    createdByAccountId: ctx.createdByAccountId,
    requestId: ctx.requestId,
    kind: "OP-TRANSFER",
    effectiveOn,
    amountFils,
    payload: intent,
    intent,
    // Both boxes are resolved inside the transaction.
    entries: [],
  };

  return {
    write,
    loadState: async (tx: TxQuery): Promise<void> => {
      const boxes = (await tx`
        SELECT id, kind FROM box
        WHERE project_id = ${ctx.projectId} AND status = 'active' AND kind IN (${fromBox}, ${toBox})
        ORDER BY kind
        FOR UPDATE`) as Array<{ id: string; kind: string }>;
      const from = boxes.find(b => b.kind === fromBox);
      const to = boxes.find(b => b.kind === toBox);
      // §5: both boxes must be active — E-BOX-STATE otherwise.
      if (from === undefined || to === undefined) reject("E-BOX-STATE");
      const fromId = String(from?.id);
      const toId = String(to?.id);
      // The box the money leaves is the operation's box (§3.7 box_id).
      write.boxId = fromId;
      write.entries = [
        buildLedgerEntry({ type: "Q14", effectiveOn, fromBoxId: fromId, toBoxId: toId, amountFils }),
      ];
    },
    // w.negative_box: the FROM box may end below zero.
    resultData: async ({ tx }: { tx: TxQuery }) => {
      const boxId = write.boxId;
      return boxId === undefined ? undefined : negativeBoxWarning(tx, ctx.projectId, boxId);
    },
  };
}
