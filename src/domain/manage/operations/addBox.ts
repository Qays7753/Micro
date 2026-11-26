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
 * live check + the box row before the postings reference it) and
 * extraWrites (the Q1 entry) inside its single transaction.
 */
import { buildLedgerEntry } from "../ledger/index.js";
import type { BuiltLedgerEntry } from "../ledger/index.js";
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
  const entries: BuiltLedgerEntry[] = [];
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
      entries: [],
    },
    // R-9 live check + the box row, inside the transaction before the
    // postings reference the box.
    loadState: async tx => {
      const existing =
        (await (tx`SELECT kind FROM box WHERE project_id = ${ctx.projectId} AND kind = ${kind}` as unknown as Promise<
          Array<Record<string, unknown>>
        >)) as Array<Record<string, unknown>>;
      if (existing.length > 0) reject("E-BOX-LIMIT");
      await tx`INSERT INTO box (id, project_id, kind, status, opening_status, created_on, created_at)
               VALUES (${boxId}, ${ctx.projectId}, ${kind}, ${"active"},
                       ${opening.unknown ? "unknown" : "known"}, ${ctx.today}, now())`;
      return null;
    },
    extraWrites: async ({ tx, operationId }) => {
      for (const entry of entries) {
        const entryId = crypto.randomUUID();
        await tx`INSERT INTO ledger_entry (id, project_id, operation_id, entry_type, effective_on, created_at)
                 VALUES (${entryId}, ${ctx.projectId}, ${operationId}, ${entry.entryType}, ${entry.effectiveOn}, now())`;
        for (const posting of entry.postings) {
          await tx`INSERT INTO ledger_posting (id, project_id, entry_id, account, ref_id, category, rev_kind, delta_minor)
                   VALUES (${crypto.randomUUID()}, ${ctx.projectId}, ${entryId}, ${posting.account},
                           ${posting.refId ?? null}, ${posting.category ?? null}, ${posting.revKind ?? null},
                           ${posting.deltaFils})`;
        }
      }
    },
  };
}
