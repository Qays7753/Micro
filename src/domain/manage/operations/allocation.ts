/**
 * M2.8 (Manage v2 phase 2, wave H — spec §5 OP-COLLECT / OP-PAY): the shared
 * allocation of a collection/payment across open balance lines BY NAME,
 * oldest first — the one place the §5 allocation rule lives.
 *
 * Rule (§5 OP-COLLECT, identical for OP-PAY on `by_me` lines): open lines
 * with that exact name, ordered by `origin_on`, then `created_at` (the
 * origin OPERATION's created_at — balance_line has no created_at column,
 * §3.6), oldest first. The handler's balance-line inserts carry no
 * created_at of their own; a line's birth time IS its origin operation's
 * commit time.
 *
 * Determinism guard beyond the spec's two keys: lines with the SAME
 * origin_on AND origin-operation created_at (two lines born of one
 * operation — impossible for same-name same-direction lines today) are
 * ordered by id, so a test can always predict the order (the phase-2
 * binding interpretation 5 spirit).
 *
 * PURE: no database, no clock, no §8 figures — the caller loads the open
 * lines inside the operation's transaction and passes them in. The loaders
 * at the bottom run INSIDE that transaction (§14.1 load-state) and stay
 * here because "which lines an allocation may fill" is this module's
 * question.
 */
import { reject, type TxQuery } from "./support.js";

/** One open balance line an allocation may fill (loaded by the planner's
 * loadState inside the transaction — the outstanding is Σ AR/AP postings
 * on the line, §3.6: never stored). */
export interface OpenBalanceLine {
  id: string;
  direction: "to_me" | "by_me";
  kind: string;
  /** The line's own name, or its SALE's customer name for
   * sale_remainder/customer_refund lines (§3.6) — already resolved by the
   * loader. */
  counterpartyName: string | null;
  originOn: string;
  saleId: string | null;
  outstandingFils: number;
  /** The origin operation's created_at (epoch ms) — the tiebreak key. */
  originOperationCreatedAtMs: number;
}

/** One line's share of the allocated amount. */
export interface LineAllocation {
  line: OpenBalanceLine;
  amountFils: number;
}

export interface AllocationResult {
  /** The allocations in application order (oldest line first). */
  allocations: LineAllocation[];
  /** What remains of the amount after every line is filled: the EXCESS
   * (§5 OP-COLLECT: > 0 only allowed when the last allocated line is a
   * sale_remainder → Q18; otherwise E-OVERPAY). */
  excessFils: number;
  /** Σ outstanding of the open lines before allocating. */
  totalOutstandingFils: number;
}

/** §5 allocation: oldest first, each line filled up to its outstanding. */
export function allocateOldestFirst(lines: OpenBalanceLine[], amountFils: number): AllocationResult {
  const ordered = [...lines].sort(
    (a, b) =>
      a.originOn.localeCompare(b.originOn) ||
      a.originOperationCreatedAtMs - b.originOperationCreatedAtMs ||
      a.id.localeCompare(b.id),
  );
  const totalOutstandingFils = ordered.reduce((sum, line) => sum + line.outstandingFils, 0);
  let remaining = amountFils;
  const allocations: LineAllocation[] = [];
  for (const line of ordered) {
    if (remaining <= 0) break;
    const amount = Math.min(remaining, line.outstandingFils);
    allocations.push({ line, amountFils: amount });
    remaining -= amount;
  }
  return { allocations, excessFils: remaining, totalOutstandingFils };
}

/** The LAST allocated line (§5 OP-COLLECT: the only line an excess may be
 * kept against — when it is a sale_remainder). */
export function lastAllocatedLine(allocations: LineAllocation[]): OpenBalanceLine | undefined {
  return allocations.length === 0 ? undefined : allocations[allocations.length - 1]!.line;
}

/* ── Loading the allocatable open lines (inside the transaction) ────────── */

/** The raw shape both loaders return (before the OpenBalanceLine mapping). */
interface OpenLineRow {
  id: string;
  kind: string;
  counterparty_name: string | null;
  origin_on: string;
  sale_id: string | null;
  name: string | null;
  origin_created_at: string | number;
  outstanding: string | number;
}

function toOpenLine(row: OpenLineRow, direction: "to_me" | "by_me"): OpenBalanceLine {
  return {
    id: String(row.id),
    direction,
    kind: String(row.kind),
    counterpartyName: row.name === null ? null : String(row.name),
    originOn: String(row.origin_on),
    saleId: row.sale_id === null ? null : String(row.sale_id),
    outstandingFils: Number(row.outstanding),
    originOperationCreatedAtMs: Number(row.origin_created_at),
  };
}

/** Open lines of one direction with that EXACT trimmed name (R-14), oldest
 * first — sale_remainder/customer_refund lines resolve their name through
 * the sale (§3.6). Runs inside the operation's transaction. */
export async function loadOpenLinesByName(
  tx: TxQuery,
  projectId: string,
  direction: "to_me" | "by_me",
  account: "AR" | "AP",
  name: string,
): Promise<OpenBalanceLine[]> {
  const rows = (await tx`
    SELECT l.id, l.kind, l.counterparty_name, l.origin_on::text AS origin_on, l.sale_id,
           COALESCE(l.counterparty_name, s.customer_name) AS name,
           op.created_at AS origin_created_at,
           COALESCE(SUM(p.delta_minor), 0)::bigint AS outstanding
    FROM balance_line l
    LEFT JOIN sale s ON s.id = l.sale_id
    JOIN operation op ON op.id = l.origin_operation_id
    LEFT JOIN ledger_posting p ON p.project_id = l.project_id AND p.account = ${account} AND p.ref_id = l.id
    WHERE l.project_id = ${projectId} AND l.direction = ${direction}
      AND COALESCE(l.counterparty_name, s.customer_name) = ${name}
    GROUP BY l.id, s.customer_name, op.created_at
    ORDER BY l.origin_on, op.created_at, l.id`) as OpenLineRow[];
  return rows.filter(row => Number(row.outstanding) > 0).map(row => toOpenLine(row, direction));
}

/** One explicit open line of one direction by id — null when it does not
 * exist, has the other direction, or nothing is outstanding on it (§11
 * E-NO-OPEN-BALANCE: it is not an open balance). Runs inside the
 * transaction. */
export async function loadOpenLineById(
  tx: TxQuery,
  projectId: string,
  direction: "to_me" | "by_me",
  account: "AR" | "AP",
  lineId: string,
): Promise<OpenBalanceLine | null> {
  const rows = (await tx`
    SELECT l.id, l.kind, l.counterparty_name, l.origin_on::text AS origin_on, l.sale_id,
           COALESCE(l.counterparty_name, s.customer_name) AS name,
           op.created_at AS origin_created_at,
           COALESCE(SUM(p.delta_minor), 0)::bigint AS outstanding
    FROM balance_line l
    LEFT JOIN sale s ON s.id = l.sale_id
    JOIN operation op ON op.id = l.origin_operation_id
    LEFT JOIN ledger_posting p ON p.project_id = l.project_id AND p.account = ${account} AND p.ref_id = l.id
    WHERE l.project_id = ${projectId} AND l.id = ${lineId} AND l.direction = ${direction}
    GROUP BY l.id, s.customer_name, op.created_at`) as OpenLineRow[];
  const row = rows[0];
  if (row === undefined || Number(row.outstanding) <= 0) return null;
  return toOpenLine(row, direction);
}

/** Lock the box of one kind (active only — §5 E-BOX-STATE) inside the
 * transaction; returns its id. Shared by every money-in/out operation. */
export async function lockActiveBox(
  tx: TxQuery,
  projectId: string,
  kind: "cash" | "account",
): Promise<string> {
  const boxes = (await tx`
    SELECT id FROM box
    WHERE project_id = ${projectId} AND kind = ${kind} AND status = 'active'
    FOR UPDATE`) as Array<{ id: string }>;
  if (boxes.length === 0) reject("E-BOX-STATE");
  return String(boxes[0]?.id);
}

/** The in-memory image of a just-planned prior line («مستحق سابق» / «التزام
 * سابق»): its outstanding IS the collected/paid amount — the Q2/Q3 entry
 * of the same operation posts exactly that, so the allocation fills it
 * fully. Used before any row exists, inside the transaction. */
export function openLineOfPrior(
  priorLine: {
    id: string;
    direction: "to_me" | "by_me";
    kind: string;
    counterpartyName?: string;
    originOn: string;
  },
  amountFils: number,
): OpenBalanceLine {
  return {
    id: priorLine.id,
    direction: priorLine.direction,
    kind: priorLine.kind,
    counterpartyName: priorLine.counterpartyName ?? null,
    originOn: priorLine.originOn,
    saleId: null,
    outstandingFils: amountFils,
    originOperationCreatedAtMs: Date.now(),
  };
}
