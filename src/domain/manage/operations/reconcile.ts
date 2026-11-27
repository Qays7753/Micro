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

/** §7.1/§7.2/§7.3's reconciliation contexts (§3.10's CHECK constraint). */
export type ReconcileContext = "routine" | "return_after_absence" | "first_unknown_opening";

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
  /** NULL for a box with an unknown opening (M4.4: the client had
   * nothing to read — the server stores its own honest pre-operation
   * Σ postings for the §3.10 row); a number for every known box. */
  recordedAtStartFils: number | null;
}

/** One box entry's shape: a known kind, a count ≥ 0 in integer fils, and
 * an integer at-start recorded — or NULL (an unknown opening has no
 * recorded to pass, M4.4). */
function requireBoxEntry(entry: unknown): ValidBox {
  if (typeof entry !== "object" || entry === null) reject("E-AMOUNT");
  const box = (entry as { box?: unknown }).box;
  if (box !== "cash" && box !== "account") reject("E-AMOUNT");
  const countedFils = (entry as { countedFils?: unknown }).countedFils;
  if (typeof countedFils !== "number" || !Number.isInteger(countedFils) || countedFils < 0) {
    reject("E-AMOUNT");
  }
  const raw = (entry as { recordedAtStartFils?: unknown }).recordedAtStartFils;
  if (raw === null || raw === undefined) return { box, countedFils, recordedAtStartFils: null };
  if (typeof raw !== "number" || !Number.isInteger(raw)) reject("E-AMOUNT");
  return { box, countedFils, recordedAtStartFils: raw };
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

/** §7.2 (the return flow): an OPEN absence event must exist — the flow
 * starts from the detected card; none is malformed input. */
async function requireOpenAbsence(tx: TxQuery, projectId: string): Promise<void> {
  const open = (await tx`
    SELECT 1 FROM absence_event
    WHERE project_id = ${projectId} AND complete IS NULL
    LIMIT 1`) as unknown[];
  if (open.length === 0) reject("E-AMOUNT");
}

/** «Load state in the transaction» (§14.1): lock the active boxes, match
 * the input's set, compute each box's current balance from the ledger,
 * and build the entries. The return flow requires an OPEN absence event
 * (§7.2); the first_unknown_opening flow requires at least one unknown
 * box and takes §7.3's path for it (the Q1 of the computed opening)
 * while every known box keeps §7.1's path (the Q19). */
function reconcileLoadState(
  ctx: { projectId: string; today: string },
  context: ReconcileContext,
  boxes: ValidBox[],
  write: OperationWritePlan,
  resolved: {
    rows: Array<{ id: string; countedFils: number; recordedAtStartFils: number }>;
    unknownIds: string[];
  },
): (tx: TxQuery) => Promise<void> {
  return async (tx: TxQuery) => {
    if (context === "return_after_absence") await requireOpenAbsence(tx, ctx.projectId);
    const active = (await tx`
      SELECT id, kind, opening_status, created_on::text AS created_on FROM box
      WHERE project_id = ${ctx.projectId} AND status = 'active'
      ORDER BY kind
      FOR UPDATE`) as Array<{
      id: string;
      kind: string;
      opening_status: string;
      created_on: string;
    }>;
    // §7.1-1: every ACTIVE box is counted — exactly the input's set.
    const inputKinds = new Set(boxes.map(b => b.box));
    const activeKinds: Set<"cash" | "account"> = new Set(
      active.map(b => (String(b.kind) === "account" ? "account" : "cash")),
    );
    if (activeKinds.size !== inputKinds.size || [...activeKinds].some(k => !inputKinds.has(k))) {
      reject("E-AMOUNT");
    }
    const unknowns = active.filter(b => String(b.opening_status) !== "known");
    if (context === "first_unknown_opening") {
      // §7.3/P-37: this context exists only when an unknown box does.
      if (unknowns.length === 0) reject("E-AMOUNT");
    } else {
      // routine / return_after_absence: a known opening on every side —
      // an unknown box is §7.3's own flow. (An unknown opening inside the
      // return flow is undefined in the spec; the contexts stay
      // exclusive — a documented reading.)
      if (unknowns.length > 0) reject("E-AMOUNT");
    }

    const entries: BuiltLedgerEntry[] = [];
    for (const box of boxes) {
      const row = active.find(b => String(b.kind) === box.box)!;
      const id = String(row.id);
      const currentFils = await boxLedgerBalance(tx, ctx.projectId, id);
      const isUnknown = unknowns.some(u => String(u.id) === id);
      const built = boxReconcileEntries(ctx.today, box, isUnknown, id, String(row.created_on), currentFils);
      resolved.rows.push({
        id,
        countedFils: box.countedFils,
        recordedAtStartFils: built.recordedAtStartFils,
      });
      if (isUnknown) resolved.unknownIds.push(id);
      entries.push(...built.entries);
    }
    write.entries = entries;
    // §5.0's row amount: the ADJUSTMENT (the Q19s only) — a first
    // unknown opening's Q1 is the opening's discovery, not an adjustment.
    write.amountFils = entries.reduce(
      (sum, e) => sum + (e.entryType === "Q19" ? Math.abs(e.postings[0]!.deltaFils) : 0),
      0,
    );
  };
}

/** One box's §7.1/§7.3 decision (inside the transaction): the §3.10 row's
 * recorded value and the box's entry — a known box's Q19 of the remaining
 * difference; an unknown box's Q1 of the computed opening, or its
 * negative remainder as a Q19. */
function boxReconcileEntries(
  today: string,
  box: ValidBox,
  isUnknown: boolean,
  boxId: string,
  createdOn: string,
  currentFils: number,
): { recordedAtStartFils: number; entries: BuiltLedgerEntry[] } {
  // The input's discrimination: a KNOWN box must carry its at-start read;
  // an UNKNOWN box must not claim one (the client had nothing to read —
  // P-50 shows l.unknown_balance).
  if (isUnknown !== (box.recordedAtStartFils === null)) reject("E-AMOUNT");
  if (!isUnknown) {
    // §7.1: the remaining difference → Q19 (dated today).
    const diff = box.countedFils - currentFils;
    return {
      recordedAtStartFils: box.recordedAtStartFils!,
      entries:
        diff === 0
          ? []
          : [buildLedgerEntry({ type: "Q19", effectiveOn: today, boxId, differenceFils: diff })],
    };
  }
  // §7.3: computed_opening = counted − Σ postings. > 0 → the Q1 on the
  // box's created_on (no questions, no Q19 — the Q1 lifts the balance
  // exactly to the count); ≤ 0 → the opening is 0 (a zero posting is
  // forbidden by §3.8 — the setup precedent posts no row for a zero
  // opening) and the remaining negative Δ flows to Q19 like §7.1.
  // Computing at the finish (after the answers) yields the identical
  // final state — the opening is 0 either way, and the answer operations
  // only shift the split between UNEXP and their own accounts. The
  // §3.10 row's recorded value for an unknown box is the server's own
  // pre-operation Σ postings (the honest computable value).
  const computedOpening = box.countedFils - currentFils;
  const entry =
    computedOpening > 0
      ? buildLedgerEntry({ type: "Q1", effectiveOn: createdOn, boxId, amountFils: computedOpening })
      : computedOpening < 0
        ? buildLedgerEntry({ type: "Q19", effectiveOn: today, boxId, differenceFils: computedOpening })
        : undefined;
  return { recordedAtStartFils: currentFils, entries: entry === undefined ? [] : [entry] };
}

/** Plan OP-RECONCILE: the finish — Q19 per remaining Δ + the §3.10 rows. */
export function planReconcile(input: ReconcileInput): OperationPlan {
  const ctx = requireContext(input);
  // M4.2 owns `routine`; M4.3 adds `return_after_absence` (the open
  // absence event is completed by §7.2-5's rule); M4.4 adds
  // `first_unknown_opening` (§7.3's computed opening). Any other value is
  // malformed input.
  if (
    input.context !== "routine" &&
    input.context !== "return_after_absence" &&
    input.context !== "first_unknown_opening"
  ) {
    reject("E-AMOUNT");
  }
  const context: ReconcileContext = input.context;
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

  // The loadState → extraWrites handoff: the per-box rows to persist and
  // the unknown boxes whose opening flips to known (§7.3).
  const resolved: {
    rows: Array<{ id: string; countedFils: number; recordedAtStartFils: number }>;
    unknownIds: string[];
  } = { rows: [], unknownIds: [] };

  return {
    write,
    loadState: reconcileLoadState(ctx, context, boxes, write, resolved),
    extraWrites: reconcileExtraWrites(ctx, context, write, boxes, resolved),
    resultData: async () => ({
      context,
      performedOn: ctx.today,
      boxes: resolved.rows.map(r => ({ boxId: r.id, countedFils: r.countedFils })),
    }),
  };
}

/** The operation's own writes beyond the ledger: the §3.10 rows, §7.3's
 * opening flip, and §7.2-5's absence completion — all in the one
 * transaction. */
function reconcileExtraWrites(
  ctx: { projectId: string; today: string },
  context: ReconcileContext,
  write: OperationWritePlan,
  boxes: ValidBox[],
  resolved: {
    rows: Array<{ id: string; countedFils: number; recordedAtStartFils: number }>;
    unknownIds: string[];
  },
): (writeContext: { tx: TxQuery; operationId: string; entryIds: string[] }) => Promise<void> {
  return async writeContext => {
    // §3.10: the reconciliation (id = the operation id — 1:1) and one row
    // per box, in the same transaction.
    await writeContext.tx`
      INSERT INTO reconciliation (id, project_id, performed_on, context, created_at)
      VALUES (${writeContext.operationId}, ${ctx.projectId}, ${ctx.today}, ${context}, now())`;
    for (const row of resolved.rows) {
      await writeContext.tx`
          INSERT INTO reconciliation_box (reconciliation_id, box_id, project_id, recorded_minor, counted_minor)
          VALUES (${writeContext.operationId}, ${row.id}, ${ctx.projectId}, ${row.recordedAtStartFils}, ${row.countedFils})`;
    }
    // §7.3: the unknown openings flip to known — the whole §8 unknown
    // display and the incomplete flag clear with this one UPDATE.
    if (resolved.unknownIds.length > 0) {
      const flipped = (await writeContext.tx`
          UPDATE box SET opening_status = ${"known"}
          WHERE project_id = ${ctx.projectId}
            AND id IN ${writeContext.tx(resolved.unknownIds)}
            AND opening_status = ${"unknown"}
          RETURNING id`) as unknown[];
      if (flipped.length !== resolved.unknownIds.length) reject("E-AMOUNT");
    }
    // §7.2-4/5 (the return flow): the open absence event is completed —
    // true iff the reconciliation ended with all Δ = 0 at step 1 (counted
    // = recorded at start for every box) AND no Q19 was posted. Steps
    // 2–3's operations ran BEFORE the recorded was read, so they never
    // break completeness; an answer that closes the difference exactly
    // leaves counted ≠ recorded-at-start → false.
    if (context === "return_after_absence") {
      const complete =
        write.entries.length === 0 && boxes.every(b => b.countedFils === b.recordedAtStartFils);
      const updated = (await writeContext.tx`
          UPDATE absence_event SET complete = ${complete}
          WHERE project_id = ${ctx.projectId} AND complete IS NULL
          RETURNING id`) as unknown[];
      if (updated.length === 0) reject("E-AMOUNT");
    }
  };
}
