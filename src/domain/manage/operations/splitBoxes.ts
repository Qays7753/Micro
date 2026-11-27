/**
 * M4.1 (Manage v2 phase 4 — spec §5 OP-SPLIT-BOXES, §4 Q14, R-9, R-26;
 * tests T10, T41, T59): split the boxes apart — reactivate the MERGED
 * account row (`status = active`; the same row — R-9's UNIQUE
 * (project_id, kind) is total, the merged row was never deleted) and post
 * a Q14 cash → account of the user-entered amount.
 *
 * Validation (§5): 0 ≤ amount ≤ cash balance (E-SPLIT-AMOUNT — T41);
 * amount 0 → NO ledger entry, the row flip alone (T59); not allowed while
 * the CASH opening balance is unknown (E-MERGE-UNKNOWN — the moved amount
 * would leave an unknowable cash balance behind). A malformed (negative)
 * amount is E-AMOUNT, the input-shape code of every operation.
 *
 * §5.0's row: amount moved (the entered amount), filter group
 * `op.transfer`, box_id = the account. Effective TODAY (R-26: no date
 * input).
 *
 * PURE PLANNER: the plan locks BOTH box rows FOR UPDATE inside the
 * handler's transaction, requires the account row to exist AND be merged
 * (E-BOX-STATE otherwise — P-40 offers the split only when «الحساب
 * مدموج»), computes the cash balance from the ledger there, and builds
 * the Q14. The status flip happens in `extraWrites` with a WHERE guard.
 */
import { buildLedgerEntry, type BuiltLedgerEntry } from "../ledger/index.js";
import {
  reject,
  requireContext,
  type OperationContextInput,
  type OperationPlan,
  type OperationWritePlan,
  type TxQuery,
} from "./support.js";

export interface SplitBoxesInput extends OperationContextInput {
  /** The amount that moves cash → account (0 allowed: no entry). */
  amountFils: unknown;
}

/** A locked box row as the split sees it. */
interface LockedBox {
  id: string;
  kind: string;
  status: string;
  openingStatus: string;
}

/** Lock BOTH box rows FOR UPDATE inside the transaction. */
async function lockBothBoxes(tx: TxQuery, projectId: string): Promise<LockedBox[]> {
  const boxes = (await tx`
    SELECT id, kind, status, opening_status AS opening_status
    FROM box
    WHERE project_id = ${projectId} AND kind IN ('cash', 'account')
    ORDER BY kind
    FOR UPDATE`) as Array<{ id: string; kind: string; status: string; opening_status: string }>;
  return boxes.map(b => ({
    id: String(b.id),
    kind: String(b.kind),
    status: String(b.status),
    openingStatus: String(b.opening_status),
  }));
}

/** §5/P-40's state gate: the account row must be MERGED (the split
 * reactivates it) and the cash active with a KNOWN opening (the moved
 * amount may not leave an unknowable cash balance). */
function requireSplittableBoxes(boxes: LockedBox[]): { cash: LockedBox; account: LockedBox } {
  const cash = boxes.find(b => b.kind === "cash");
  const account = boxes.find(b => b.kind === "account");
  if (cash === undefined || account === undefined) reject("E-BOX-STATE");
  if (cash.status !== "active" || account.status !== "merged") reject("E-BOX-STATE");
  if (cash.openingStatus !== "known") reject("E-MERGE-UNKNOWN");
  return { cash, account };
}

/** A box's balance from the ledger postings (the golden rule). */
async function boxLedgerBalance(tx: TxQuery, projectId: string, boxId: string): Promise<number> {
  const sums = (await tx`
    SELECT COALESCE(SUM(p.delta_minor), 0)::bigint AS total
    FROM ledger_posting p
    WHERE p.project_id = ${projectId} AND p.account = 'BOX' AND p.ref_id = ${boxId}`) as Array<{
    total: string | number;
  }>;
  return Number(sums[0]?.total ?? 0);
}

/** The split's Q14: cash → account of the entered amount; amount 0 → NO
 * entry (T59 — the row flip alone). */
function splitQ14(today: string, cashId: string, accountId: string, amountFils: number): BuiltLedgerEntry[] {
  if (amountFils === 0) return [];
  return [
    buildLedgerEntry({
      type: "Q14",
      effectiveOn: today,
      fromBoxId: cashId,
      toBoxId: accountId,
      amountFils,
    }),
  ];
}

/** Plan OP-SPLIT-BOXES: reactivate the merged account + Q14 cash→account. */
export function planSplitBoxes(input: SplitBoxesInput): OperationPlan {
  const ctx = requireContext(input);
  // Input shape first: an integer amount ≥ 0 (0 = reactivate only, T59).
  if (typeof input.amountFils !== "number" || !Number.isInteger(input.amountFils)) {
    reject("E-AMOUNT");
  }
  if (input.amountFils < 0) reject("E-AMOUNT");
  const amountFils = input.amountFils;

  // Idempotency identity (R-25): the validated inputs only.
  const intent = { amountFils };
  const write: OperationWritePlan = {
    projectId: ctx.projectId,
    createdByAccountId: ctx.createdByAccountId,
    requestId: ctx.requestId,
    kind: "OP-SPLIT-BOXES",
    effectiveOn: ctx.today,
    amountFils,
    payload: intent,
    intent,
    entries: [],
  };

  // The loadState → extraWrites handoff: the account row id.
  const resolved: { accountId: string } = { accountId: "" };

  return {
    write,
    loadState: async (tx: TxQuery): Promise<void> => {
      const { cash, account } = requireSplittableBoxes(await lockBothBoxes(tx, ctx.projectId));
      resolved.accountId = account.id;
      write.boxId = account.id;
      // The moved amount may not exceed the cash balance (T41).
      if (amountFils > (await boxLedgerBalance(tx, ctx.projectId, cash.id))) {
        reject("E-SPLIT-AMOUNT");
      }
      write.entries = splitQ14(ctx.today, cash.id, account.id, amountFils);
    },
    extraWrites: async context => {
      // §5: the account becomes active again — the same row, reactivated.
      // The WHERE guard arbitrates a concurrent double-split.
      const updated = (await context.tx`
        UPDATE box SET status = ${"active"}
        WHERE project_id = ${ctx.projectId} AND id = ${resolved.accountId}
          AND status = ${"merged"}
        RETURNING id`) as unknown[];
      if (updated.length === 0) reject("E-BOX-STATE");
    },
    resultData: async () => ({ accountStatus: "active" }),
  };
}
