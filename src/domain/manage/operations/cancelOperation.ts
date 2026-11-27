/**
 * M2.10 (Manage v2 phase 2, wave H — spec §5 OP-CANCEL-OPERATION, §4 Q20,
 * §9 INV-2, R-11, R-12; test T35's cancel-side twin): cancel a past
 * operation — Q20 for every ACTIVE entry, no repost.
 *
 * Contract (§5): same validation as OP-CORRECT (the final state must
 * satisfy INV-2 — a cancellation that would drive a balance line or a
 * prepayment negative is E-CORRECTION-BREAKS-BALANCES, e.g. cancelling a
 * prepayment of a delivered sale: PRE would go negative — undo delivery
 * first). Q20 entries cannot be reversed (E-REVERSE-REVERSAL): a
 * cancellation (or any pure-reversal operation) is final, and its own row
 * — kind OP-CANCEL-OPERATION — stays in the log with the cancelled
 * operation it reversed.
 *
 * Cancellable kinds: §5's correctable list. Cancelling a SALE_CREATE runs
 * OP-CANCEL-SALE (with its prepayment questions) — phase 3 (M3.6); DELIVER
 * has OP-UNDO-DELIVERY; until then both answer the generic input rejection
 * here. The phase-2 cancellable kinds are the planner-backed ones plus
 * PREPAYMENT (cancelling needs NO planner — pure reversal — and the INV-2
 * check guards the delivered case).
 *
 * PURE PLANNER (M1.6 boundary): the Q20 mirrors build in `loadState` from
 * the DB snapshot inside the transaction; the original's row becomes
 * `reversed` with `reversed_by_operation_id` in `extraWrites`; the INV-2
 * check runs in `resultData` after every write — a rejection rolls
 * everything back (R-12).
 */
import type { BuiltLedgerEntry } from "../ledger/index.js";
import { assertCorrectionKeepsBalances, loadActiveReversibleEntries, reversalEntriesOf } from "./correct.js";
import {
  reject,
  requireContext,
  type OperationContextInput,
  type OperationPlan,
  type TxQuery,
} from "./support.js";

export interface CancelOperationInput extends OperationContextInput {
  /** The operation to cancel (its CURRENT version). */
  operationId: unknown;
}

/** §5's cancellable kinds in phase 2: the planner-backed correctable kinds
 * plus PREPAYMENT (a pure reversal needs no planner; the INV-2 check
 * guards the delivered-sale case). SALE_CREATE (OP-CANCEL-SALE) and DELIVER
 * (OP-UNDO-DELIVERY) join in phase 3. */
const CANCELLABLE_KINDS: readonly string[] = [
  "OP-EXPENSE",
  "OP-COLLECT",
  "OP-PAY",
  "OP-OWNER-DEPOSIT",
  "OP-OWNER-WITHDRAWAL",
  "OP-TRANSFER",
  "OP-WRITE-OFF",
  "OP-ADD-PRIOR-BALANCE",
  "OP-PREPAYMENT",
];

/** Plan OP-CANCEL-OPERATION: reversal-only, atomic, final. */
export function planCancelOperation(input: CancelOperationInput): OperationPlan {
  const ctx = requireContext(input);
  if (typeof input.operationId !== "string" || input.operationId.length === 0) reject("E-AMOUNT");
  const operationId = input.operationId;

  // Idempotency identity (R-25): the target of the cancellation.
  const intent = { operationId };
  const write = {
    projectId: ctx.projectId,
    createdByAccountId: ctx.createdByAccountId,
    requestId: ctx.requestId,
    kind: "OP-CANCEL-OPERATION" as const,
    effectiveOn: ctx.today,
    amountFils: 0,
    entries: [] as BuiltLedgerEntry[],
    payload: intent,
    intent,
  };

  return {
    write,
    loadState: async (tx: TxQuery): Promise<void> => {
      const rows = (await tx`
        SELECT kind, status, reversed_by_operation_id, effective_on::text AS effective_on
        FROM operation WHERE project_id = ${ctx.projectId} AND id = ${operationId}`) as Array<{
        kind: string;
        status: string;
        reversed_by_operation_id: string | null;
        effective_on: string;
      }>;
      const original = rows[0];
      // An unknown id or an already-reversed version is not cancellable
      // (the log's current version is what gets cancelled).
      if (
        original === undefined ||
        original.status !== "active" ||
        original.reversed_by_operation_id !== null
      ) {
        reject("E-AMOUNT");
      }
      const kind = String(original!.kind);
      // A pure-reversal operation (OP-CANCEL-OPERATION) cannot be
      // cancelled: its entries are Q20s (E-REVERSE-REVERSAL, §5).
      if (kind === "OP-CANCEL-OPERATION") reject("E-REVERSE-REVERSAL");
      if (!CANCELLABLE_KINDS.includes(kind)) reject("E-AMOUNT");

      // The Q20 mirrors of every active reversible entry, with the
      // ORIGINAL effective dates (§4) — the cancellation is dated by its
      // entries' own dates, so no period moves (R-26).
      write.entries = reversalEntriesOf(await loadActiveReversibleEntries(tx, ctx.projectId, operationId));
      if (write.entries.length === 0) {
        // Nothing reversible: the operation is already a pure reversal or
        // has no active entries — E-REVERSE-REVERSAL for the reversal case.
        reject("E-REVERSE-REVERSAL");
      }
      write.effectiveOn = String(original!.effective_on);
    },
    extraWrites: async ({ tx, operationId: cancelId }): Promise<void> => {
      // §5: the cancelled operation becomes reversed, pointed at the
      // cancellation. The WHERE clause arbitrates a concurrent double-hit.
      const updated = (await tx`
        UPDATE operation SET status = ${"reversed"}, reversed_by_operation_id = ${cancelId}
        WHERE project_id = ${ctx.projectId} AND id = ${operationId}
          AND status = ${"active"} AND reversed_by_operation_id IS NULL
        RETURNING id`) as unknown[];
      if (updated.length === 0) reject("E-AMOUNT");
    },
    // The settled-figure validation on the FINAL state (INV-2) — a
    // cancellation that would break a settled figure rolls back entirely.
    resultData: async ({ tx }: { tx: TxQuery; operationId: string; entryIds: string[] }) => {
      await assertCorrectionKeepsBalances(tx, ctx.projectId);
      return undefined;
    },
  };
}
