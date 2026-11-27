/**
 * M4.2 (Manage v2 phase 4 — spec §7.1 OP-RECONCILE, §4 Q19, §3.10, R-26;
 * tests S7, S8, T34, T42, T45): the reconciliation FINISH — the operation
 * behind P-52's «إنهاء» and P-50's all-zero «التالي».
 *
 * The flow's other steps are NOT new operations (§5: "Operations created
 * by reconciliation answers keep their own kind"): P-51's proposal is a
 * normal OP-TRANSFER (the pure PROPOSAL RULE is exported below for the
 * route/client — §8.2 allows the Δ in the UI), and P-52's answers are the
 * existing operations (expense, withdrawal, collect…) on the box, dated
 * the reconciliation date.
 *
 * THIS operation, atomically in the handler's one transaction:
 *   1. locks every ACTIVE box FOR UPDATE and requires the input to count
 *      each exactly once (a missing/extra/duplicate box is E-AMOUNT);
 *   2. computes each box's CURRENT recorded balance from the ledger (the
 *      answers already ran — the golden rule, never the client's numbers)
 *      and Δ = counted − recorded;
 *   3. posts Q19 per box with Δ ≠ 0 (§4: BOX[k] +diff, UNEXP +diff —
 *      INV-1's sources side moves with the boxes), effective TODAY
 *      (R-26: OP-RECONCILE is an exception to effective_on input);
 *   4. persists the §3.10 rows: reconciliation (id = the operation id,
 *      performed_on today, context) + one reconciliation_box per box
 *      (recorded_minor = the client's at-start read — DISPLAY HISTORY
 *      for the log, never a financial input; counted_minor).
 *
 * Scope (M4.2): the `routine` context with KNOWN openings. An unknown
 * opening is §7.3's own flow (`first_unknown_opening`, M4.4) and the
 * return flow's context arrives with M4.3 — both are rejected here with
 * E-AMOUNT (a malformed routine request) until their tasks extend this
 * same planner.
 *
 * §5.0's row: amount = Σ|Δ| (the total adjusted — never hides a box's
 * difference behind a net), filter group `op.reconcile`, no box_id (the
 * operation spans every active box).
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

/** One box's counted amount as the route passes it (P-50). */
export interface ReconcileBoxInput {
  box: "cash" | "account";
  /** The physical count — an integer ≥ 0 (a count is never negative). */
  countedFils: number;
  /** The recorded balance the client read at the flow's start — display
   * history for the §3.10 log only; every financial figure is computed
   * from the ledger inside the transaction. */
  recordedAtStartFils: number;
}

export interface ReconcileInput extends OperationContextInput {
  context: unknown;
  boxes: unknown;
}

/** §7.1-2's opposite-differences transfer proposal: min(|Δ1|, |Δ2|) from
 * the NEGATIVE box to the POSITIVE one; null when the diffs are not one
 * positive and one negative. Pure — the route/client feeds it the §8.2
 * Δs (S8: 50; T34: 10). */
export function transferProposalOf(
  deltas: Array<{ box: "cash" | "account"; countedFils: number; recordedFils: number }>,
): { fromBox: "cash" | "account"; toBox: "cash" | "account"; amountFils: number } | null {
  if (deltas.length !== 2) return null;
  const diffOf = (d: { countedFils: number; recordedFils: number }): number => d.countedFils - d.recordedFils;
  const first = deltas[0]!;
  const second = deltas[1]!;
  const d1 = diffOf(first);
  const d2 = diffOf(second);
  if (d1 === 0 || d2 === 0 || d1 > 0 === d2 > 0) return null;
  const negative = d1 < 0 ? first : second;
  const positive = d1 < 0 ? second : first;
  return {
    fromBox: negative.box,
    toBox: positive.box,
    amountFils: Math.min(Math.abs(d1), Math.abs(d2)),
  };
}

/** The validated per-box input (the planner's shape check fills it). */
interface ValidBox {
  box: "cash" | "account";
  countedFils: number;
  recordedAtStartFils: number;
}

/** One box entry's shape: a known kind, a count ≥ 0 in integer fils, an
 * integer at-start recorded (display history). */
function requireBoxEntry(entry: unknown): ValidBox {
  if (typeof entry !== "object" || entry === null) reject("E-AMOUNT");
  const box = (entry as { box?: unknown }).box;
  if (box !== "cash" && box !== "account") reject("E-AMOUNT");
  const countedFils = (entry as { countedFils?: unknown }).countedFils;
  const recordedAtStartFils = (entry as { recordedAtStartFils?: unknown }).recordedAtStartFils;
  if (
    typeof countedFils !== "number" ||
    !Number.isInteger(countedFils) ||
    countedFils < 0 ||
    typeof recordedAtStartFils !== "number" ||
    !Number.isInteger(recordedAtStartFils)
  ) {
    reject("E-AMOUNT");
  }
  return { box, countedFils, recordedAtStartFils };
}

/** The input shape: a non-empty array, one entry per box kind, no
 * duplicates. */
function requireBoxes(boxes: unknown): ValidBox[] {
  if (!Array.isArray(boxes) || boxes.length === 0) reject("E-AMOUNT");
  const seen = new Set<string>();
  const valid: ValidBox[] = [];
  for (const entry of boxes) {
    const box = requireBoxEntry(entry);
    if (seen.has(box.box)) reject("E-AMOUNT");
    seen.add(box.box);
    valid.push(box);
  }
  return valid;
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

/** The Q19s of the remaining differences (§7.1-4): one per box with
 * Δ ≠ 0, dated today. */
function adjustmentQ19s(
  today: string,
  boxes: Array<{ id: string; countedFils: number; currentFils: number }>,
): BuiltLedgerEntry[] {
  const entries: BuiltLedgerEntry[] = [];
  for (const box of boxes) {
    const diff = box.countedFils - box.currentFils;
    if (diff === 0) continue;
    entries.push(
      buildLedgerEntry({
        type: "Q19",
        effectiveOn: today,
        boxId: box.id,
        differenceFils: diff,
      }),
    );
  }
  return entries;
}

/** «Load state in the transaction» (§14.1): lock the active boxes, match
 * the input's set, compute each box's current balance from the ledger,
 * and build the Q19s (filling the §3.10 rows to persist). The return
 * flow additionally requires an OPEN absence event (§7.2: the flow
 * starts from the detected card — none is malformed input). */
function reconcileLoadState(
  ctx: { projectId: string; today: string },
  context: "routine" | "return_after_absence",
  boxes: ValidBox[],
  write: OperationWritePlan,
  resolved: { rows: Array<{ id: string; countedFils: number; recordedAtStartFils: number }> },
): (tx: TxQuery) => Promise<void> {
  return async (tx: TxQuery) => {
    if (context === "return_after_absence") {
      const open = (await tx`
        SELECT 1 FROM absence_event
        WHERE project_id = ${ctx.projectId} AND complete IS NULL
        LIMIT 1`) as unknown[];
      if (open.length === 0) reject("E-AMOUNT");
    }
    const active = (await tx`
      SELECT id, kind, opening_status FROM box
      WHERE project_id = ${ctx.projectId} AND status = 'active'
      ORDER BY kind
      FOR UPDATE`) as Array<{ id: string; kind: string; opening_status: string }>;
    // §7.1-1: every ACTIVE box is counted — exactly the input's set.
    const inputKinds = new Set(boxes.map(b => b.box));
    const activeKinds: Set<"cash" | "account"> = new Set(
      active.map(b => (String(b.kind) === "account" ? "account" : "cash")),
    );
    if (activeKinds.size !== inputKinds.size || [...activeKinds].some(k => !inputKinds.has(k))) {
      reject("E-AMOUNT");
    }
    // M4.2 (routine): a known opening on every side — an unknown box
    // is §7.3's own flow (first_unknown_opening, M4.4).
    if (active.some(b => String(b.opening_status) !== "known")) reject("E-AMOUNT");

    const withCurrent: Array<{ id: string; countedFils: number; currentFils: number }> = [];
    for (const box of boxes) {
      const row = active.find(b => String(b.kind) === box.box)!;
      const id = String(row.id);
      withCurrent.push({
        id,
        countedFils: box.countedFils,
        currentFils: await boxLedgerBalance(tx, ctx.projectId, id),
      });
      resolved.rows.push({
        id,
        countedFils: box.countedFils,
        recordedAtStartFils: box.recordedAtStartFils,
      });
    }
    write.entries = adjustmentQ19s(ctx.today, withCurrent);
    write.amountFils = withCurrent.reduce((sum, b) => sum + Math.abs(b.countedFils - b.currentFils), 0);
  };
}

/** Plan OP-RECONCILE: the finish — Q19 per remaining Δ + the §3.10 rows. */
export function planReconcile(input: ReconcileInput): OperationPlan {
  const ctx = requireContext(input);
  // M4.2 owns `routine`; M4.3 adds `return_after_absence` (the open
  // absence event is completed by §7.2-5's rule); M4.4 adds
  // `first_unknown_opening`. Any other value is malformed input.
  if (input.context !== "routine" && input.context !== "return_after_absence") {
    reject("E-AMOUNT");
  }
  const context: "routine" | "return_after_absence" = input.context;
  const boxes = requireBoxes(input.boxes);

  // Idempotency identity (R-25): the validated inputs only.
  const intent = {
    context,
    boxes: boxes.map(b => ({
      box: b.box,
      countedFils: b.countedFils,
      recordedAtStartFils: b.recordedAtStartFils,
    })),
  };
  const write: OperationWritePlan = {
    projectId: ctx.projectId,
    createdByAccountId: ctx.createdByAccountId,
    requestId: ctx.requestId,
    kind: "OP-RECONCILE",
    effectiveOn: ctx.today,
    // Resolved inside the transaction (Σ|Δ|).
    amountFils: 0,
    payload: intent,
    intent,
    entries: [],
  };

  // The loadState → extraWrites handoff: the per-box rows to persist.
  const resolved: { rows: Array<{ id: string; countedFils: number; recordedAtStartFils: number }> } = {
    rows: [],
  };

  return {
    write,
    loadState: reconcileLoadState(ctx, context, boxes, write, resolved),
    extraWrites: async context2 => {
      // §3.10: the reconciliation (id = the operation id — 1:1) and one
      // row per box, in the same transaction.
      await context2.tx`
        INSERT INTO reconciliation (id, project_id, performed_on, context, created_at)
        VALUES (${context2.operationId}, ${ctx.projectId}, ${ctx.today}, ${context}, now())`;
      for (const row of resolved.rows) {
        await context2.tx`
          INSERT INTO reconciliation_box (reconciliation_id, box_id, project_id, recorded_minor, counted_minor)
          VALUES (${context2.operationId}, ${row.id}, ${ctx.projectId}, ${row.recordedAtStartFils}, ${row.countedFils})`;
      }
      // §7.2-4/5 (the return flow): the open absence event is completed —
      // true iff the reconciliation ended with all Δ = 0 at step 1
      // (counted = recorded at start for every box) AND no Q19 was
      // posted. Steps 2–3's operations ran BEFORE the recorded was read,
      // so they never break completeness; an answer that closes the
      // difference exactly leaves counted ≠ recorded-at-start → false.
      if (context === "return_after_absence") {
        const complete =
          write.entries.length === 0 && boxes.every(b => b.countedFils === b.recordedAtStartFils);
        const updated = (await context2.tx`
          UPDATE absence_event SET complete = ${complete}
          WHERE project_id = ${ctx.projectId} AND complete IS NULL
          RETURNING id`) as unknown[];
        if (updated.length === 0) reject("E-AMOUNT");
      }
    },
    resultData: async () => ({
      context,
      performedOn: ctx.today,
      boxes: resolved.rows.map(r => ({ boxId: r.id, countedFils: r.countedFils })),
    }),
  };
}
