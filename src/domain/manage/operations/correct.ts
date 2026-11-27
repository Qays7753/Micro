/**
 * M2.10 (Manage v2 phase 2, wave H — spec §5 OP-CORRECT, §4 Q20, §9 INV-2,
 * R-11, R-12; tests T5, T29, T35, T52): correction by REVERSAL-AND-REPOST —
 * the generic edit of a past operation.
 *
 * Contract (§5 OP-CORRECT): inputs operation_id + the corrected inputs (the
 * same shape as the original operation's request body). One atomic
 * operation: Q20 for every ACTIVE entry of the original (its own Q20s
 * excluded — a reversal is never reversed: E-REVERSE-REVERSAL), then the
 * corrected operation's entries WITH THE ORIGINAL EFFECTIVE DATE (unless
 * the corrected inputs change the date itself). The original operation row
 * becomes `reversed` with `reversed_by_operation_id` pointing at the
 * correction; the correction row (the operation's CURRENT VERSION, same
 * kind) carries `corrects_operation_id` and can itself be corrected again.
 *
 * The final state must satisfy INV-2 (every balance line and prepayment
 * ≥ 0): T29 — a credit expense a payment already settled against cannot be
 * corrected down (the supplier line would go negative) →
 * E-CORRECTION-BREAKS-BALANCES; T35 — a prepayment of a delivered sale
 * cannot be corrected directly (PRE would go negative; undo delivery
 * first) → E-CORRECTION-BREAKS-BALANCES. The check runs inside the same
 * transaction AFTER every write: a rejection rolls back the reversals too
 * (R-12) — the original stays untouched.
 *
 * Correcting a collection re-applies OP-COLLECT rules to the new inputs
 * (T52: the Q6/Q17 of the old collection reverse first — the line's
 * outstanding is restored — then the new allocation decides). The corrected
 * operation is planned by ITS OWN planner (the phase-2 kinds whose planners
 * exist: EXPENSE, COLLECT, PAY, OWNER-DEPOSIT, OWNER-WITHDRAWAL, TRANSFER,
 * WRITE-OFF, ADD-PRIOR-BALANCE); PREPAYMENT/SALE-DELIVERY-COST/RETURN join
 * when their operations exist (phase 3) — a prepayment of a delivered sale
 * is already rejected here by the §5 rule.
 *
 * PURE PLANNER (M1.6 boundary) with the M2.10 revision phase: the Q20
 * mirrors build in `loadState` (from the DB snapshot, inside the
 * transaction); the corrected operation's planner runs in
 * `revisionEntries` — AFTER the handler has written the reversals, so its
 * state reads see the POST-REVERSAL balances. The handler stays the single
 * ledger writer.
 */
import { buildLedgerEntry } from "../ledger/index.js";
import { buildReversalEntry } from "../ledger/buildReversalEntry.js";
import type { BuiltLedgerEntry, ReversedLedgerEntry } from "../ledger/index.js";
import { planExpense } from "./expense.js";
import { planCollect } from "./collect.js";
import { planPay } from "./pay.js";
import { planOwnerDeposit, planOwnerWithdrawal } from "./ownerMoney.js";
import { planTransfer } from "./transfer.js";
import { planWriteOff } from "./writeOff.js";
import { planAddPriorBalance } from "./addPriorBalance.js";
import {
  reject,
  requireContext,
  type OperationContextInput,
  type OperationPlan,
  type OperationWritePlan,
  type PlanBalanceLine,
  type TxQuery,
} from "./support.js";

export interface CorrectInput extends OperationContextInput {
  /** The operation to correct (its CURRENT version). */
  operationId: unknown;
  /** The corrected inputs — the same shape as the original operation's
   * request body (the kind's fields, optionally effectiveOn to move the
   * date itself). */
  inputs: unknown;
}

/** The original operation row as the correction loads it. */
interface OriginalOperation {
  id: string;
  kind: string;
  effectiveOn: string;
  boxId: string | null;
  saleId: string | null;
  balanceLineId: string | null;
  counterpartyName: string | null;
  category: string | null;
}

/** §5's correctable kinds whose planners exist in phase 2 — the corrected
 * operation is REBUILT by its own planner. OP-CORRECT itself never appears
 * as a row kind here: the correction row keeps the ORIGINAL's kind (it is
 * the current version of that operation). */
const CORRECTABLE_PLANNERS: Readonly<Record<string, (input: never) => OperationPlan>> = {
  "OP-EXPENSE": planExpense,
  "OP-COLLECT": planCollect,
  "OP-PAY": planPay,
  "OP-OWNER-DEPOSIT": planOwnerDeposit,
  "OP-OWNER-WITHDRAWAL": planOwnerWithdrawal,
  "OP-TRANSFER": planTransfer,
  "OP-WRITE-OFF": planWriteOff,
  "OP-ADD-PRIOR-BALANCE": planAddPriorBalance,
};

/** Load the original operation (project-scoped, ACTIVE, not already
 * replaced) — the correction target. */
async function loadOriginal(tx: TxQuery, projectId: string, operationId: string): Promise<OriginalOperation> {
  const rows = (await tx`
    SELECT id, kind, effective_on::text AS effective_on, box_id, sale_id, balance_line_id,
           counterparty_name, category, status, reversed_by_operation_id
    FROM operation WHERE project_id = ${projectId} AND id = ${operationId}`) as Array<{
    id: string;
    kind: string;
    effective_on: string;
    box_id: string | null;
    sale_id: string | null;
    balance_line_id: string | null;
    counterparty_name: string | null;
    category: string | null;
    status: string;
    reversed_by_operation_id: string | null;
  }>;
  const row = rows[0];
  // An unknown id, an already-reversed version or an already-replaced
  // operation is not a correctable CURRENT version (§5: the log's current
  // version is what gets corrected).
  if (row === undefined || row.status !== "active" || row.reversed_by_operation_id !== null) {
    reject("E-AMOUNT");
  }
  return {
    id: String(row!.id),
    kind: String(row!.kind),
    effectiveOn: String(row!.effective_on),
    boxId: row!.box_id,
    saleId: row!.sale_id,
    balanceLineId: row!.balance_line_id,
    counterpartyName: row!.counterparty_name,
    category: row!.category,
  };
}

/** The original's ACTIVE, REVERSIBLE entries (§5: every active entry — with
 * its own Q20s excluded, a reversal is never reversed). */
export async function loadActiveReversibleEntries(
  tx: TxQuery,
  projectId: string,
  operationId: string,
): Promise<ReversedLedgerEntry[]> {
  const entries = (await tx`
    SELECT e.id, e.entry_type, e.effective_on::text AS effective_on
    FROM ledger_entry e
    WHERE e.project_id = ${projectId} AND e.operation_id = ${operationId}
      AND e.entry_type <> 'Q20'
      AND NOT EXISTS (SELECT 1 FROM ledger_entry r WHERE r.reverses_entry_id = e.id)
    ORDER BY e.created_at, e.id`) as Array<{ id: string; entry_type: string; effective_on: string }>;
  if (entries.length === 0) return [];
  const postings = (await tx`
    SELECT entry_id, account, ref_id, category, rev_kind, delta_minor
    FROM ledger_posting WHERE project_id = ${projectId}`) as Array<{
    entry_id: string;
    account: string;
    ref_id: string | null;
    category: string | null;
    rev_kind: string | null;
    delta_minor: string | number;
  }>;
  return entries.map(entry => ({
    id: String(entry.id),
    entryType: String(entry.entry_type),
    effectiveOn: String(entry.effective_on),
    postings: postings
      .filter(p => p.entry_id === entry.id)
      .map(p => ({
        account: String(p.account),
        ...(p.ref_id !== null ? { refId: String(p.ref_id) } : {}),
        ...(p.category !== null ? { category: String(p.category) } : {}),
        ...(p.rev_kind !== null ? { revKind: String(p.rev_kind) } : {}),
        deltaFils: Number(p.delta_minor),
      })),
  })) as ReversedLedgerEntry[];
}

/** The Q20 mirrors of the original's active reversible entries (§4: every
 * posting negated, the original's effective date, reverses_entry_id set). */
export function reversalEntriesOf(originals: ReversedLedgerEntry[]): BuiltLedgerEntry[] {
  return originals.map(reversed => buildReversalEntry({ type: "Q20", reversed }));
}

/** §5's settled-figure validation: the FINAL state (reversals + repost)
 * must satisfy INV-2 — every balance line and every prepayment ≥ 0. Runs
 * inside the transaction after every write; a violation is
 * E-CORRECTION-BREAKS-BALANCES (T29: a payment already settled against the
 * line; T35's PRE) and rolls the whole correction back. */
export async function assertCorrectionKeepsBalances(tx: TxQuery, projectId: string): Promise<void> {
  const negative = (await tx`
    SELECT p.account, p.ref_id FROM ledger_posting p
    WHERE p.project_id = ${projectId} AND p.account IN ('AR', 'AP', 'PRE') AND p.ref_id IS NOT NULL
    GROUP BY p.account, p.ref_id
    HAVING SUM(p.delta_minor) < 0`) as unknown[];
  if (negative.length > 0) reject("E-CORRECTION-BREAKS-BALANCES");
}

/** T35: a prepayment whose sale is already delivered cannot be corrected
 * directly (PRE would go negative — undo delivery first). */
async function assertPrepaymentNotDelivered(
  tx: TxQuery,
  projectId: string,
  saleId: string | null,
): Promise<void> {
  if (saleId === null) return;
  const delivered = (await tx`
    SELECT 1 FROM ledger_entry e
    JOIN ledger_posting p ON p.entry_id = e.id AND p.account = 'REV' AND p.ref_id = ${saleId}
    WHERE e.project_id = ${projectId} AND e.entry_type = 'Q5'
      AND NOT EXISTS (SELECT 1 FROM ledger_entry r WHERE r.reverses_entry_id = e.id)
    LIMIT 1`) as unknown[];
  if (delivered.length > 0) reject("E-CORRECTION-BREAKS-BALANCES");
}

/** The correction's FIRST phase, inside the transaction: the kind gate
 * (with T35's prepayment rule), the Q20 mirrors of the original's active
 * reversible entries, and the corrected operation's plan (its own loadState
 * is deferred to the revision phase — the post-reversal state). Fills the
 * correction's write and returns the sub-plan. */
async function buildCorrection(
  tx: TxQuery,
  ctx: { projectId: string; createdByAccountId: string; requestId: string; today: string },
  operationId: string,
  inputs: Record<string, unknown>,
  write: OperationWritePlan,
): Promise<OperationPlan> {
  const original = await loadOriginal(tx, ctx.projectId, operationId);
  // Kind routing + the T35 prepayment rule.
  if (original.kind === "OP-PREPAYMENT") {
    await assertPrepaymentNotDelivered(tx, ctx.projectId, original.saleId);
    // Undelivered: the correction needs the phase-3 prepayment planner.
    reject("E-AMOUNT");
  }
  if (original.kind === "OP-CANCEL-OPERATION") reject("E-REVERSE-REVERSAL");
  const planner = CORRECTABLE_PLANNERS[original.kind];
  if (planner === undefined) reject("E-AMOUNT");

  // The Q20 mirrors of the original's active reversible entries.
  write.entries = reversalEntriesOf(await loadActiveReversibleEntries(tx, ctx.projectId, operationId));

  // The corrected operation: its OWN planner, the ORIGINAL effective date
  // unless the corrected inputs move the date itself (§5). A corrected
  // WRITE-OFF states its amount explicitly (its default resolves only
  // against the post-reversal outstanding, which the operation row —
  // written before the revision phase — could not carry).
  const subInputs: Record<string, unknown> = {
    ...inputs,
    projectId: ctx.projectId,
    createdByAccountId: ctx.createdByAccountId,
    requestId: ctx.requestId,
    today: ctx.today,
    effectiveOn: inputs.effectiveOn ?? original.effectiveOn,
  };
  if (original.kind === "OP-WRITE-OFF" && inputs.amountFils === undefined) reject("E-AMOUNT");
  const subPlan = planner(subInputs as never);

  // The correction row: the operation's CURRENT VERSION — same kind, same
  // context references (the entries are the financial truth), the corrected
  // amount and date.
  write.kind = subPlan.write.kind;
  write.effectiveOn = subPlan.write.effectiveOn;
  write.amountFils = subPlan.write.amountFils;
  if (original.boxId !== null) write.boxId = original.boxId;
  if (original.saleId !== null) write.saleId = original.saleId;
  if (original.balanceLineId !== null) write.balanceLineId = original.balanceLineId;
  if (original.counterpartyName !== null) write.counterpartyName = original.counterpartyName;
  if (original.category !== null) write.category = original.category;
  return subPlan;
}

/** Validate the correction request's own shape: a target operation id and
 * a corrected-inputs object. */
function requireCorrectionTarget(input: CorrectInput): {
  operationId: string;
  inputs: Record<string, unknown>;
} {
  if (typeof input.operationId !== "string" || input.operationId.length === 0) reject("E-AMOUNT");
  if (input.inputs === null || typeof input.inputs !== "object" || Array.isArray(input.inputs))
    reject("E-AMOUNT");
  return { operationId: input.operationId, inputs: input.inputs as Record<string, unknown> };
}

/** Plan OP-CORRECT (the generic edit): reversal-and-repost in ONE atomic
 * operation over the M2.4 handler. */
export function planCorrect(input: CorrectInput): OperationPlan {
  const ctx = requireContext(input);
  const { operationId, inputs } = requireCorrectionTarget(input);

  // Idempotency identity (R-25): the target + the corrected inputs.
  const intent = { operationId, inputs };
  // Filled by loadState — the handler reads them after the hook.
  const write: OperationWritePlan = {
    projectId: ctx.projectId,
    createdByAccountId: ctx.createdByAccountId,
    requestId: ctx.requestId,
    kind: "OP-EXPENSE",
    effectiveOn: ctx.today,
    amountFils: 0,
    correctsOperationId: operationId,
    entries: [] as BuiltLedgerEntry[],
    payload: intent,
    intent,
  };

  // The corrected operation's plan — built in loadState (kind known there),
  // its loadState deferred to revisionEntries (post-reversal state).
  let subPlan: OperationPlan | undefined;

  return {
    write,
    loadState: async (tx: TxQuery): Promise<void> => {
      subPlan = await buildCorrection(tx, ctx, operationId, inputs, write);
    },
    extraWrites: async ({ tx, operationId: correctionId }): Promise<void> => {
      // §5: the original becomes reversed, pointed at its replacement. The
      // WHERE clause arbitrates a concurrent double-correction.
      const updated = (await tx`
        UPDATE operation SET status = ${"reversed"}, reversed_by_operation_id = ${correctionId}
        WHERE project_id = ${ctx.projectId} AND id = ${operationId}
          AND status = ${"active"} AND reversed_by_operation_id IS NULL
        RETURNING id`) as unknown[];
      if (updated.length === 0) reject("E-AMOUNT");
    },
    // The correction's SECOND phase: the corrected operation's planner sees
    // the POST-REVERSAL state (T52); the handler writes what it returns.
    revisionEntries: async ({ tx }: { tx: TxQuery; operationId: string; entryIds: string[] }) => {
      if (subPlan?.loadState === undefined) {
        return { entries: subPlan?.write.entries ?? [] };
      }
      await subPlan.loadState(tx);
      return {
        entries: subPlan.write.entries,
        ...(subPlan.write.balanceLines === undefined
          ? {}
          : { balanceLines: subPlan.write.balanceLines as PlanBalanceLine[] }),
      };
    },
    // The settled-figure validation (INV-2 on the final state), then the
    // corrected operation's own result data (warnings / messages) — both
    // inside the same transaction.
    resultData: async ({
      tx,
      operationId: correctionId,
      entryIds,
    }: {
      tx: TxQuery;
      operationId: string;
      entryIds: string[];
    }): Promise<Record<string, unknown> | undefined> => {
      await assertCorrectionKeepsBalances(tx, ctx.projectId);
      return subPlan?.resultData === undefined
        ? undefined
        : subPlan.resultData({ tx, operationId: correctionId, entryIds });
    },
  };
}
