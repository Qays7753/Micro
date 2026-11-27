/**
 * M2.5 (Manage v2 phase 2, wave G — spec §5 OP-SETUP, Q1): project setup.
 *
 * Contract (§5 OP-SETUP): inputs project_name; boxes cash_only |
 * cash_and_account; per box opening_minor or unknown. Validation: name
 * non-empty (E-NAME-REQUIRED); opening ≥ 0. Entries: Q1 per box with KNOWN
 * opening (effective today — §5); unknown → NO entry, opening_status =
 * 'unknown' (the explicit path; the first reconciliation fixes it via Q1
 * effective on the box's created_on, §7.3 — phase 4).
 *
 * R-9: OP-SETUP initializes a project — ANY box already present means the
 * project is initialized (E-BOX-LIMIT); the boxes themselves are one cash +
 * one account at most, also E-BOX-LIMIT.
 *
 * This is a PURE PLANNER (M1.6 boundary — the domain imports nothing from
 * the worker): it validates and returns an OperationPlan. Nothing persists
 * before it has validated. The route then creates the project row (R-24 —
 * it must exist before the operation's transaction because the handler's
 * idempotency reservation references it), and the M2.4 handler (composed by
 * the route) runs loadState (the R-9 live check, then the box rows) inside
 * its single transaction and persists the plan's Q1 entries exactly like
 * those of any other operation: the ledger has ONE writer (the handler),
 * no operation writes ledger rows itself.
 */
import { buildLedgerEntry } from "../ledger/index.js";
import {
  reject,
  requireName,
  requireContext,
  validateOpening,
  type OpeningInput,
  type OperationContextInput,
  type OperationPlan,
} from "./support.js";

/** One box in the OP-SETUP input: a kind + its own opening. The SETUP
 * carries a LIST of boxes (cash only, or cash + account — R-9); each list
 * entry names ONE box. */
export interface SetupBoxSlot {
  kind: "cash" | "account";
  opening: OpeningInput | unknown;
}

export interface SetupInput extends OperationContextInput {
  projectName: unknown;
  boxes: SetupBoxSlot[] | unknown;
}

/** Plan OP-SETUP: validate + build the Q1 entries + the box writes. */
export function planSetup(input: SetupInput): OperationPlan {
  const ctx = requireContext(input);
  const projectName = requireName(input.projectName);

  const slots = input.boxes;
  if (!Array.isArray(slots) || slots.length === 0) reject("E-BOX-LIMIT");
  const wanted: Array<{ kind: "cash" | "account"; opening: OpeningInput }> = [];
  for (const slot of slots as SetupBoxSlot[]) {
    if (slot?.kind !== "cash" && slot?.kind !== "account") reject("E-BOX-LIMIT");
    wanted.push({ kind: slot.kind, opening: validateOpening(slot.opening) });
  }
  // R-9 + E-BOX-LIMIT: at most one cash and one account box.
  const kinds = wanted.map(b => b.kind);
  if (kinds.filter(k => k === "cash").length > 1 || kinds.filter(k => k === "account").length > 1) {
    reject("E-BOX-LIMIT");
  }

  // Box ids are generated up front so the Q1 entries can reference them.
  const created = wanted.map(box => ({ ...box, id: crypto.randomUUID() }));

  // Q1 per box with a KNOWN opening (§5). Unknown → no entry.
  const entries = created.flatMap(box => {
    if (box.opening.unknown || box.opening.openingFils === 0) return [];
    return [
      buildLedgerEntry({
        type: "Q1",
        effectiveOn: ctx.today,
        boxId: box.id,
        amountFils: box.opening.openingFils,
      }),
    ];
  });

  return {
    write: {
      projectId: ctx.projectId,
      createdByAccountId: ctx.createdByAccountId,
      requestId: ctx.requestId,
      kind: "OP-SETUP",
      effectiveOn: ctx.today,
      amountFils: created.reduce((sum, box) => sum + (box.opening.unknown ? 0 : box.opening.openingFils), 0),
      payload: {
        projectName,
        boxes: created.map(box => ({
          kind: box.kind,
          openingStatus: box.opening.unknown ? "unknown" : "known",
          openingFils: box.opening.unknown ? null : box.opening.openingFils,
        })),
      },
      // Idempotency identity (R-25): the validated inputs only — the box
      // ids above are generated per planning.
      intent: {
        projectName,
        boxes: created.map(box => ({
          kind: box.kind,
          openingFils: box.opening.unknown ? null : box.opening.openingFils,
        })),
      },
      entries,
    },
    loadState: setupLoadState(ctx, created),
  };
}

/** Inside the transaction: the R-9 live check, then the box rows — before
 * the Q1 postings reference them. The project row itself already exists:
 * the route creates it after validation and before the transaction (the
 * handler's idempotency reservation carries an FK to it). */
function setupLoadState(
  ctx: { projectId: string; today: string },
  created: Array<{ id: string; kind: "cash" | "account"; opening: OpeningInput }>,
): OperationPlan["loadState"] {
  return async tx => {
    // Lock the project row: a concurrent first setup whose transaction is
    // already inserting this project's boxes holds FOR KEY SHARE on it (the
    // box FK), so this waits for that transaction to end, and the box check
    // below then sees its committed boxes.
    const project = (await tx`SELECT 1 FROM project WHERE id = ${ctx.projectId} FOR UPDATE`) as unknown[];
    if (project.length === 0) reject("E-BOX-STATE");

    // An idempotent retry never reaches here (the handler answers it from
    // the stored response before loading state), so ANY existing box means
    // the project is already initialized.
    const boxes = (await tx`SELECT 1 FROM box WHERE project_id = ${ctx.projectId} LIMIT 1`) as unknown[];
    if (boxes.length > 0) reject("E-BOX-LIMIT");

    for (const box of created) {
      await tx`INSERT INTO box (id, project_id, kind, status, opening_status, created_on, created_at)
                 VALUES (${box.id}, ${ctx.projectId}, ${box.kind}, ${"active"},
                         ${box.opening.unknown ? "unknown" : "known"}, ${ctx.today}, now())`;
    }
    return null;
  };
}
