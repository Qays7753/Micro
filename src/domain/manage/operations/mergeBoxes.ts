/**
 * M4.1 (Manage v2 phase 4 — spec §5 OP-MERGE-BOXES, §4 Q14, R-9, R-26;
 * tests T9, T46, T47, T53): merge the account box into cash — one atomic
 * operation:
 *   1. a Q14 that brings the ACCOUNT balance to zero (b > 0: account →
 *      cash b; b < 0: cash → account |b|; b = 0: no entry at all);
 *   2. the account row `status = merged` (the SAME row is reactivated by
 *      OP-SPLIT-BOXES — R-9's UNIQUE (project_id, kind) is total).
 *
 * A merged box accepts no operations (E-BOX-STATE — every operation locks
 * its boxes with `status = 'active'`). Not allowed while ANY active box's
 * opening balance is unknown (E-MERGE-UNKNOWN — T47 the account, T53 the
 * cash): the Q14 would move a balance the project cannot yet state.
 *
 * §5.0's row: amount moved (the Q14 amount; 0 when b = 0), filter group
 * `op.transfer`, box_id = the account (the box whose lifecycle changes).
 * Effective TODAY (R-26: no date input).
 *
 * PURE PLANNER (M1.6 boundary): the boxes exist only in the database. The
 * plan locks BOTH box rows FOR UPDATE inside the handler's transaction
 * (`loadState`), computes b from the ledger postings there, and builds the
 * Q14 (or none). The status flip happens in `extraWrites` with a WHERE
 * guard (the concurrency arbitration pattern of the reversed-owner flips).
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

export interface MergeBoxesInput extends OperationContextInput {}

/** A locked box row as the merge sees it. */
interface LockedBox {
  id: string;
  kind: string;
  status: string;
  openingStatus: string;
}

/** Lock BOTH box rows FOR UPDATE inside the transaction (a merge's two
 * sides must be arbitrated against concurrent movements of the same
 * boxes — the transfer posture). */
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

/** §5/P-39's state gate: the merge needs TWO ACTIVE boxes (the UX offers
 * it only then) and NO unknown opening on either side (T47/T53). */
function requireMergeableBoxes(boxes: LockedBox[]): { cash: LockedBox; account: LockedBox } {
  const cash = boxes.find(b => b.kind === "cash");
  const account = boxes.find(b => b.kind === "account");
  if (cash === undefined || account === undefined) reject("E-BOX-STATE");
  if (cash.status !== "active" || account.status !== "active") reject("E-BOX-STATE");
  if (cash.openingStatus !== "known" || account.openingStatus !== "known") {
    reject("E-MERGE-UNKNOWN");
  }
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

/** The Q14 that zeroes the account (§5): b > 0 account→cash, b < 0
 * cash→account |b|, b = 0 NO entry at all. */
function zeroingQ14(
  today: string,
  cashId: string,
  accountId: string,
  accountBalance: number,
): BuiltLedgerEntry[] {
  if (accountBalance > 0) {
    return [
      buildLedgerEntry({
        type: "Q14",
        effectiveOn: today,
        fromBoxId: accountId,
        toBoxId: cashId,
        amountFils: accountBalance,
      }),
    ];
  }
  if (accountBalance < 0) {
    return [
      buildLedgerEntry({
        type: "Q14",
        effectiveOn: today,
        fromBoxId: cashId,
        toBoxId: accountId,
        amountFils: -accountBalance,
      }),
    ];
  }
  return [];
}

/** Plan OP-MERGE-BOXES: zero the account into cash, then mark it merged. */
export function planMergeBoxes(input: MergeBoxesInput): OperationPlan {
  const ctx = requireContext(input);

  // Idempotency identity (R-25): a merge has no user inputs — the intent
  // is the action itself (a retried request must replay, not conflict).
  const intent = { action: "merge" };
  const write: OperationWritePlan = {
    projectId: ctx.projectId,
    createdByAccountId: ctx.createdByAccountId,
    requestId: ctx.requestId,
    kind: "OP-MERGE-BOXES",
    effectiveOn: ctx.today,
    // Resolved inside the transaction (the moved amount).
    amountFils: 0,
    payload: intent,
    intent,
    entries: [],
  };

  // The loadState → extraWrites handoff: the account row id (the box whose
  // status flips) — this plan's own closure slot.
  const resolved: { accountId: string } = { accountId: "" };

  return {
    write,
    loadState: async (tx: TxQuery): Promise<void> => {
      const { cash, account } = requireMergeableBoxes(await lockBothBoxes(tx, ctx.projectId));
      resolved.accountId = account.id;
      write.boxId = account.id;
      const b = await boxLedgerBalance(tx, ctx.projectId, account.id);
      write.entries = zeroingQ14(ctx.today, cash.id, account.id, b);
      write.amountFils = Math.abs(b);
      write.payload = { ...intent, accountBalanceFils: b };
    },
    extraWrites: async context => {
      // §5: the account becomes merged. The WHERE guard arbitrates a
      // concurrent double-merge (the row was locked FOR UPDATE in
      // loadState; this is the belt-and-suspenders owner-flip pattern).
      const updated = (await context.tx`
        UPDATE box SET status = ${"merged"}
        WHERE project_id = ${ctx.projectId} AND id = ${resolved.accountId}
          AND status = ${"active"}
        RETURNING id`) as unknown[];
      if (updated.length === 0) reject("E-BOX-STATE");
    },
    resultData: async () => ({ accountStatus: "merged" }),
  };
}
