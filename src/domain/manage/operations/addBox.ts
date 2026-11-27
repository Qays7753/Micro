/**
 * M2.5 (Manage v2 phase 2, wave G — spec §5 OP-ADD-BOX, Q1): add the
 * missing box kind to an existing project.
 *
 * Contract (§5 OP-ADD-BOX): inputs kind (the missing kind), opening_minor
 * or unknown. Validation: R-9 — at most one cash + one account box; a
 * duplicate kind is E-BOX-LIMIT. Entries: as OP-SETUP for that box (Q1
 * with a known opening, effective TODAY — R-26 exception; unknown → no
 * entry, opening_status = 'unknown').
 *
 * PURE PLANNER (M1.6 boundary): the M2.4 handler runs loadState (the R-9
 * live check + the box row before the postings reference it) inside its
 * single transaction, then persists the plan's Q1 entry like those of any
 * other operation.
 */
import { buildLedgerEntry } from "../ledger/index.js";
import {
  reject,
  requireContext,
  validateOpening,
  type OperationContextInput,
  type OperationPlan,
} from "./support.js";

export interface AddBoxInput extends OperationContextInput {
  kind: unknown;
  opening: unknown;
}

/** Plan OP-ADD-BOX: one box, its opening, and (when known) its Q1 entry. */
export function planAddBox(input: AddBoxInput): OperationPlan {
  const ctx = requireContext(input);
  if (input.kind !== "cash" && input.kind !== "account") reject("E-BOX-LIMIT");
  const kind = input.kind;
  const opening = validateOpening(input.opening);

  const boxId = crypto.randomUUID();
  const entries = [];
  if (!opening.unknown && opening.openingFils > 0) {
    entries.push(
      buildLedgerEntry({
        type: "Q1",
        effectiveOn: ctx.today,
        boxId,
        amountFils: opening.openingFils,
      }),
    );
  }

  return {
    write: {
      projectId: ctx.projectId,
      createdByAccountId: ctx.createdByAccountId,
      requestId: ctx.requestId,
      kind: "OP-ADD-BOX",
      effectiveOn: ctx.today,
      amountFils: opening.unknown ? 0 : opening.openingFils,
      boxId,
      payload: {
        boxKind: kind,
        openingStatus: opening.unknown ? "unknown" : "known",
        openingFils: opening.unknown ? null : opening.openingFils,
      },
      // Idempotency identity (R-25): the validated inputs only — boxId is
      // generated per planning.
      intent: {
        kind,
        openingFils: opening.unknown ? null : opening.openingFils,
      },
      entries,
    },
    // R-9 live check + the box row, inside the transaction before the
    // postings reference the box.
    loadState: async tx => {
      const existing = (await tx`SELECT 1 FROM box
                                   WHERE project_id = ${ctx.projectId} AND kind = ${kind} LIMIT 1`) as unknown[];
      if (existing.length > 0) reject("E-BOX-LIMIT");
      await tx`INSERT INTO box (id, project_id, kind, status, opening_status, created_on, created_at)
               VALUES (${boxId}, ${ctx.projectId}, ${kind}, ${"active"},
                       ${opening.unknown ? "unknown" : "known"}, ${ctx.today}, now())`;
      return null;
    },
  };
}
