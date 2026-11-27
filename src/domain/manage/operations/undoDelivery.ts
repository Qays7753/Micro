/**
 * M3.9 (Manage v2 phase 3 — spec §5 OP-UNDO-DELIVERY, §4 Q20/Q4, §6
 * transitions; tests T17, T37): undo the delivery — atomically:
 *   Q20 of the sale's active Q5; Q20 of every active Q6, Q17, Q18 tied to
 *   the sale; and for each reversed Q6 AND each reversed Q18 a Q4 with the
 *   SAME box, amount and effective date (the money stays in the box as a
 *   prepayment — T17's PRE 70, T37's PRE 55).
 * Result: the sale is back to scheduled/overdue (§6 — the derived state
 * simply loses its active Q5); box balances are unchanged; lines unlocked
 * (§3.4 — the edit surface owns the lock).
 *
 * Validation (§5): no ACTIVE returns on the sale and no payments on its
 * customer_refund lines (E-UNDO-DELIVERY-BLOCKED); delivered and not
 * cancelled (E-SALE-STATE).
 *
 * Row states: the reversed entries' OWNERS (the delivery — or the price
 * correction that currently owns the Q5 — and the tied collections /
 * write-offs / overpayments) become `reversed`, pointed at the undo; an
 * owner whose operation still has OTHER active entries after the undo
 * (a by-name collection spanning several sales) keeps its row — the
 * reversal entries net its this-sale part to zero either way.
 *
 * PURE PLANNER: everything lives in the database — resolved inside the
 * handler's transaction (`loadState`) with the sale row locked FOR UPDATE.
 */
import { buildLedgerEntry } from "../ledger/index.js";
import type { BuiltLedgerEntry, LedgerPosting } from "../ledger/index.js";
import { reversalEntriesOf } from "./correct.js";
import type { ReversedLedgerEntry } from "../ledger/index.js";
import {
  reject,
  requireContext,
  type OperationContextInput,
  type OperationPlan,
  type OperationWritePlan,
  type TxQuery,
} from "./support.js";

export interface UndoDeliveryInput extends OperationContextInput {
  saleId: unknown;
}

/** One tied entry with its owner operation (the Q20 mirror's target). */
interface TiedEntry {
  id: string;
  operationId: string;
  entryType: string;
  effectiveOn: string;
  postings: LedgerPosting[];
}

/** Plan OP-UNDO-DELIVERY: resolve the tied entries inside the transaction,
 * build their Q20 mirrors + the prepayment Q4s, and reverse the owners. */
export function planUndoDelivery(input: UndoDeliveryInput): OperationPlan {
  const ctx = requireContext(input);
  if (typeof input.saleId !== "string" || input.saleId.length === 0) reject("E-AMOUNT");
  const intent = { saleId: input.saleId };
  const write: OperationWritePlan = {
    projectId: ctx.projectId,
    createdByAccountId: ctx.createdByAccountId,
    requestId: ctx.requestId,
    kind: "OP-UNDO-DELIVERY",
    effectiveOn: ctx.today,
    amountFils: null,
    saleId: input.saleId,
    payload: intent,
    intent,
    entries: [],
  };
  // The loadState → extraWrites handoff (this plan's own closure slot).
  const resolved: { ownersToReverse: string[] } = { ownersToReverse: [] };
  return {
    write,
    loadState: undoLoadState(ctx.projectId, input.saleId, write, resolved),
    extraWrites: async context => {
      // §5/M2.10's shape: every owner whose tied entries this undo reversed
      // fully becomes `reversed`, pointed at the undo (the WHERE arbitrates
      // concurrent double-hits; an owner with remaining active entries was
      // excluded from the list in loadState).
      for (const ownerId of resolved.ownersToReverse) {
        const updated = (await context.tx`
          UPDATE operation SET status = ${"reversed"}, reversed_by_operation_id = ${context.operationId}
          WHERE project_id = ${ctx.projectId} AND id = ${ownerId}
            AND status = ${"active"} AND reversed_by_operation_id IS NULL
          RETURNING id`) as unknown[];
        if (updated.length === 0) reject("E-AMOUNT");
      }
    },
    resultData: async () => ({ saleId: input.saleId, status: "undone" }),
  };
}

/** Load every ACTIVE entry of the given ids with its postings. */
async function loadEntries(tx: TxQuery, projectId: string, entryIds: string[]): Promise<TiedEntry[]> {
  if (entryIds.length === 0) return [];
  const entries = (await tx`
    SELECT e.id, e.operation_id, e.entry_type, e.effective_on::text AS effective_on
    FROM ledger_entry e
    WHERE e.project_id = ${projectId} AND e.id IN ${tx(entryIds)}
      AND NOT EXISTS (SELECT 1 FROM ledger_entry r WHERE r.reverses_entry_id = e.id)`) as Array<{
    id: string;
    operation_id: string;
    entry_type: string;
    effective_on: string;
  }>;
  const postings = (await tx`
    SELECT entry_id, account, ref_id, category, rev_kind, delta_minor
    FROM ledger_posting WHERE project_id = ${projectId} AND entry_id IN ${tx(entryIds)}`) as Array<{
    entry_id: string;
    account: string;
    ref_id: string | null;
    category: string | null;
    rev_kind: string | null;
    delta_minor: string | number;
  }>;
  return entries.map(entry => ({
    id: String(entry.id),
    operationId: String(entry.operation_id),
    entryType: String(entry.entry_type),
    effectiveOn: String(entry.effective_on),
    // The DB's own CHECK constraints guarantee the account/category shapes
    // (same cast boundary as correct.ts's loadActiveReversibleEntries).
    postings: postings
      .filter(p => p.entry_id === entry.id)
      .map(p => ({
        account: String(p.account),
        deltaFils: Number(p.delta_minor),
        ...(p.ref_id !== null ? { refId: String(p.ref_id) } : {}),
        ...(p.category !== null ? { category: String(p.category) } : {}),
        ...(p.rev_kind !== null ? { revKind: String(p.rev_kind) } : {}),
      })) as LedgerPosting[],
  }));
}

/** Lock the sale row FOR UPDATE and return its ACTIVE Q5 (§3.4: delivered
 * iff a non-reversed Q5 exists — the undo's primary target). E-SALE-STATE
 * on an unknown, undelivered, or cancelled sale. */
async function lockSaleAndActiveQ5(
  tx: TxQuery,
  projectId: string,
  saleId: string,
): Promise<{ id: string; operation_id: string; effective_on: string }> {
  const sales = (await tx`
      SELECT cancelled_on::text AS cancelled_on FROM sale
      WHERE id = ${saleId} AND project_id = ${projectId}
      FOR UPDATE`) as Array<{ cancelled_on: string | null }>;
  const sale = sales[0];
  if (sale === undefined || sale.cancelled_on !== null) reject("E-SALE-STATE");
  const q5Rows = (await tx`
      SELECT e.id, e.operation_id, e.effective_on::text AS effective_on
      FROM ledger_entry e
      JOIN operation o ON o.id = e.operation_id
      WHERE o.project_id = ${projectId} AND o.sale_id = ${saleId} AND e.entry_type = 'Q5'
        AND NOT EXISTS (SELECT 1 FROM ledger_entry r WHERE r.reverses_entry_id = e.id)`) as Array<{
    id: string;
    operation_id: string;
    effective_on: string;
  }>;
  const q5 = q5Rows[0];
  if (q5 === undefined) reject("E-SALE-STATE");
  return q5;
}

/** The two §5 blocks (E-UNDO-DELIVERY-BLOCKED): an ACTIVE return on the
 * sale, or a payment on one of its customer_refund lines (an active Q7
 * whose AP posting references the line). */
async function assertUndoNotBlocked(tx: TxQuery, projectId: string, saleId: string): Promise<void> {
  const activeReturns = (await tx`
      SELECT 1 FROM ledger_entry e
      JOIN operation o ON o.id = e.operation_id
      WHERE o.project_id = ${projectId} AND o.sale_id = ${saleId} AND e.entry_type = 'Q16'
        AND NOT EXISTS (SELECT 1 FROM ledger_entry r WHERE r.reverses_entry_id = e.id)`) as unknown[];
  if (activeReturns.length > 0) reject("E-UNDO-DELIVERY-BLOCKED");
  const paidRefunds = (await tx`
      SELECT 1 FROM ledger_posting p
      JOIN ledger_entry e ON e.id = p.entry_id
      JOIN balance_line l ON l.id = p.ref_id AND l.project_id = p.project_id
      WHERE p.project_id = ${projectId} AND p.account = 'AP' AND l.sale_id = ${saleId}
        AND l.kind = 'customer_refund' AND e.entry_type = 'Q7'
        AND NOT EXISTS (SELECT 1 FROM ledger_entry r WHERE r.reverses_entry_id = e.id)`) as unknown[];
  if (paidRefunds.length > 0) reject("E-UNDO-DELIVERY-BLOCKED");
}

/** The tied entries (§5): every ACTIVE Q6/Q17 posted against the sale's
 * remainder line, plus every ACTIVE Q18 whose REV posting references the
 * sale. */
async function loadTiedEntryIds(tx: TxQuery, projectId: string, saleId: string): Promise<string[]> {
  const tiedIds: string[] = [];
  const remainderRows = (await tx`
      SELECT id FROM balance_line
      WHERE project_id = ${projectId} AND sale_id = ${saleId} AND kind = 'sale_remainder'`) as Array<{
    id: string;
  }>;
  const remainderLineId = remainderRows[0] === undefined ? null : String(remainderRows[0]!.id);
  if (remainderLineId !== null) {
    const tied = (await tx`
        SELECT e.id FROM ledger_entry e
        JOIN ledger_posting p ON p.entry_id = e.id
        WHERE p.project_id = ${projectId} AND e.entry_type IN ('Q6','Q17') AND p.account = 'AR'
          AND p.ref_id = ${remainderLineId}
          AND NOT EXISTS (SELECT 1 FROM ledger_entry r WHERE r.reverses_entry_id = e.id)`) as Array<{
      id: string;
    }>;
    tiedIds.push(...tied.map(t => String(t.id)));
  }
  const overpayments = (await tx`
      SELECT e.id FROM ledger_entry e
      JOIN ledger_posting p ON p.entry_id = e.id
      WHERE p.project_id = ${projectId} AND e.entry_type = 'Q18' AND p.account = 'REV' AND p.ref_id = ${saleId}
        AND NOT EXISTS (SELECT 1 FROM ledger_entry r WHERE r.reverses_entry_id = e.id)`) as Array<{
    id: string;
  }>;
  tiedIds.push(...overpayments.map(t => String(t.id)));
  return tiedIds;
}

/** The Q4s (§5): for each reversed Q6 and Q18 a prepayment with the SAME
 * box, amount and effective date as its BOX posting — the money stays in
 * the box, now as a prepayment (T17's PRE 70, T37's PRE 55). */
function prepaymentMirrorsOf(saleId: string, entries: TiedEntry[]): BuiltLedgerEntry[] {
  const q4s: BuiltLedgerEntry[] = [];
  for (const entry of entries) {
    if (entry.entryType !== "Q6" && entry.entryType !== "Q18") continue;
    const boxPosting = entry.postings.find(p => p.account === "BOX");
    if (boxPosting === undefined || boxPosting.refId === undefined) continue;
    q4s.push(
      buildLedgerEntry({
        type: "Q4",
        effectiveOn: entry.effectiveOn,
        boxId: boxPosting.refId,
        saleId,
        amountFils: boxPosting.deltaFils,
      }),
    );
  }
  return q4s;
}

/** The owners to reverse: the Q5's owner, plus every tied entry's owner
 * whose operation has NO other active entries outside this undo set (a
 * by-name collection spanning other sales keeps its row — the mirrors
 * still net this sale's part to zero). */
async function resolveOwnersToReverse(
  tx: TxQuery,
  projectId: string,
  q5Entry: TiedEntry,
  tiedEntries: TiedEntry[],
): Promise<string[]> {
  const owners = new Set<string>([q5Entry.operationId]);
  for (const entry of tiedEntries) owners.add(entry.operationId);
  const ownerList = [...owners];
  const reversedIds = [q5Entry.id, ...tiedEntries.map(t => t.id)];
  const otherActive = (await tx`
      SELECT DISTINCT e.operation_id FROM ledger_entry e
      WHERE e.project_id = ${projectId} AND e.operation_id IN ${tx(ownerList)}
        AND e.id NOT IN ${tx(reversedIds)}
        AND NOT EXISTS (SELECT 1 FROM ledger_entry r WHERE r.reverses_entry_id = e.id)`) as Array<{
    operation_id: string;
  }>;
  const stillActive = new Set(otherActive.map(o => String(o.operation_id)));
  return ownerList.filter(id => !stillActive.has(id));
}

/** «Load state in the transaction» (§14.1): lock the sale, apply the §5
 * blocks, load the tied entries, and build the Q20 mirrors + the Q4s. */
function undoLoadState(
  projectId: string,
  saleId: string,
  write: OperationWritePlan,
  resolved: { ownersToReverse: string[] },
): (tx: TxQuery) => Promise<void> {
  return async (tx: TxQuery) => {
    const q5 = await lockSaleAndActiveQ5(tx, projectId, saleId);
    await assertUndoNotBlocked(tx, projectId, saleId);
    const tiedIds = await loadTiedEntryIds(tx, projectId, saleId);
    // Load the Q5 and the tied entries, mirror them (Q20s at their own
    // dates), and rebuild the Q4s for the reversed Q6/Q18 money.
    const all = await loadEntries(tx, projectId, [String(q5.id), ...tiedIds]);
    const q5Entry = all.find(e => e.id === String(q5.id))!;
    const tiedEntries = all.filter(e => e.id !== String(q5.id));
    const mirrors = reversalEntriesOf(
      [q5Entry, ...tiedEntries].map(e => ({
        id: e.id,
        entryType: e.entryType,
        effectiveOn: e.effectiveOn,
        postings: e.postings,
      })) as ReversedLedgerEntry[],
    );
    write.effectiveOn = q5.effective_on;
    write.entries = [...mirrors, ...prepaymentMirrorsOf(saleId, [q5Entry, ...tiedEntries])];
    resolved.ownersToReverse = await resolveOwnersToReverse(tx, projectId, q5Entry, tiedEntries);
  };
}
