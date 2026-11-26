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
 * R-9: at most one cash + one account box; a duplicate kind is E-BOX-LIMIT.
 *
 * This is a PURE PLANNER (M1.6 boundary — the domain imports nothing from
 * the worker): it validates and returns an OperationPlan; the M2.4 handler
 * (composed by the route) runs loadState (project + boxes INSERT, before
 * the entries' postings reference the boxes) and extraWrites (the Q1
 * entries after the boxes exist) inside its single transaction.
 */
import { buildLedgerEntry } from "../ledger/index.js";
import type { BuiltLedgerEntry } from "../ledger/index.js";
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
      entries: [],
    },
    loadState: setupLoadState(ctx, created, projectName),
    extraWrites: setupExtraWrites(ctx, entries),
  };
}

/** Inside the transaction: project row (R-24), R-9 live check, box rows
 * (before any posting references them — FK order). */
function setupLoadState(
  ctx: { projectId: string; createdByAccountId: string; today: string },
  created: Array<{ id: string; kind: "cash" | "account"; opening: OpeningInput }>,
  projectName: string,
): OperationPlan["loadState"] {
  return async tx => {
    const existing =
      (await (tx`SELECT kind FROM box WHERE project_id = ${ctx.projectId}` as unknown as Promise<
        Array<Record<string, unknown>>
      >)) as Array<Record<string, unknown>>;
    const existingKinds = new Set(existing.map(b => String(b.kind)));
    for (const box of created) {
      if (existingKinds.has(box.kind)) reject("E-BOX-LIMIT");
    }
    await tx`INSERT INTO project (id, name, owner_account_id, created_at)
               VALUES (${ctx.projectId}, ${projectName}, ${ctx.createdByAccountId}, now())
               ON CONFLICT (id) DO NOTHING`;
    for (const box of created) {
      await tx`INSERT INTO box (id, project_id, kind, status, opening_status, created_on, created_at)
                 VALUES (${box.id}, ${ctx.projectId}, ${box.kind}, ${"active"},
                         ${box.opening.unknown ? "unknown" : "known"}, ${ctx.today}, now())`;
    }
    return null;
  };
}

/** The Q1 entries AFTER the boxes exist, linked to THIS operation's row. */
function setupExtraWrites(
  ctx: { projectId: string },
  entries: BuiltLedgerEntry[],
): OperationPlan["extraWrites"] {
  return async ({ tx, operationId }) => {
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
  };
}
