/**
 * M2.5+ (Manage v2 phase 2, waves G/H — spec §5, §14.1): shared plumbing for
 * the §5 operation domain functions.
 *
 * Architecture (§14.3 / M1.6 boundary, enforced by the module-boundaries
 * guard): `src/domain/manage` imports only itself and `src/domain/shared`.
 * An operation is therefore a PURE PLANNER: it validates the §5 contract,
 * builds the entries with the M2.2 builder, and returns a PLAN — the write
 * intent plus the loadState/extraWrites hooks that the M2.4 operation
 * handler (worker side) runs INSIDE its single transaction. The worker-side
 * route composes plan + handler; the domain never imports worker code.
 *
 * Purity boundary: the planners compute INTENT (which entries, which lines,
 * which amounts) and validate §5 contracts; the per-entry financial equation
 * is already enforced by the M2.2 builder; §8 figures belong to M2.11's
 * read module alone. No clock: `today` is passed in by the caller (the
 * route layer reads worker/clock.ts Amman local date).
 *
 * Money is integer fils (MoneyFils) end to end; dates are YYYY-MM-DD Amman
 * local strings; ids are UUIDs (§3 PK).
 */

/** A §5 operation contract rejection. The code is the spec's literal §11
 * error id; the Arabic message is looked up by the route layer from the
 * strings catalog (no Arabic literals in domain code). */
export class OperationRejected extends Error {
  readonly code: string;
  constructor(code: string) {
    super(`OperationRejected:${code}`);
    this.code = code;
  }
}

/** Reject with a §11 error code. */
export function reject(code: string): never {
  throw new OperationRejected(code);
}

/** Trimmed non-empty name or E-NAME-REQUIRED (R-14: free text, trimmed). */
export function requireName(name: unknown, code = "E-NAME-REQUIRED"): string {
  if (typeof name !== "string") reject(code);
  const trimmed = name.trim();
  if (trimmed.length === 0) reject(code);
  return trimmed;
}

/** A positive integer fils amount or E-AMOUNT. */
export function requirePositiveFils(value: unknown, code = "E-AMOUNT"): number {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value <= 0) reject(code);
  return value;
}

/** A non-negative integer fils amount or E-AMOUNT. */
export function requireNonNegativeFils(value: unknown, code = "E-AMOUNT"): number {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 0) reject(code);
  return value;
}

/** A YYYY-MM-DD date string (or the generic input rejection — the routes
 * validate shape before the domain). */
export function requireDate(value: unknown): string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    reject("E-AMOUNT");
  }
  return value as string;
}

/** A client request id (R-25): non-empty string. */
export function requireRequestId(value: unknown): string {
  if (typeof value !== "string" || value.trim().length === 0 || value.length > 200) {
    reject("E-AMOUNT");
  }
  return value;
}

/** An opening input for OP-SETUP / OP-ADD-BOX: exactly one of a known
 * non-negative amount or `unknown` (the explicit §5 path — never guessed). */
export type OpeningInput =
  { openingFils: number; unknown?: false } | { unknown: true; openingFils?: undefined };

/** Validate an opening: non-negative integer when known; `unknown` must not
 * also carry an amount (ambiguous input is rejected, not guessed). */
export function validateOpening(opening: unknown): OpeningInput {
  if (opening === null || typeof opening !== "object") reject("E-AMOUNT");
  const o = opening as { openingFils?: unknown; unknown?: unknown };
  if (o.unknown === true) {
    if (o.openingFils !== undefined && o.openingFils !== null) reject("E-AMOUNT");
    return { unknown: true };
  }
  const fils = requireNonNegativeFils(o.openingFils);
  return { openingFils: fils };
}

/** The validated operation context (all fields confirmed). */
export interface OperationContext {
  projectId: string;
  createdByAccountId: string;
  requestId: string;
  /** Amman local today (YYYY-MM-DD) — passed by the route layer. */
  today: string;
}

/** The UNVALIDATED operation context as it arrives from the route layer —
 * every field `unknown` until requireContext checks it. Operation input
 * interfaces extend THIS shape (§14.1: validate input is the first step of
 * the domain function itself). */
export interface OperationContextInput {
  projectId?: unknown;
  createdByAccountId?: unknown;
  requestId?: unknown;
  today?: unknown;
}

/** Validate the shared operation context fields. */
export function requireContext(input: {
  projectId?: unknown;
  createdByAccountId?: unknown;
  requestId?: unknown;
  today?: unknown;
}): OperationContext {
  if (typeof input.projectId !== "string" || input.projectId.length === 0) reject("E-AMOUNT");
  if (typeof input.createdByAccountId !== "string" || input.createdByAccountId.length === 0) {
    reject("E-AMOUNT");
  }
  const requestId = requireRequestId(input.requestId);
  const today = requireDate(input.today);
  return { projectId: input.projectId, createdByAccountId: input.createdByAccountId, requestId, today };
}

/* ── The plan surface (composed with the M2.4 handler on the worker side) ── */

import type { BuiltLedgerEntry } from "../ledger/index.js";

/** A postgres.js-compatible tagged-template query surface — the STRUCTURAL
 * type of a transaction handle as the hooks see it. The real
 * postgres.TransactionSql the handler passes satisfies this shape (its
 * query helper is thenable); the domain carries no postgres dependency
 * (M1.6 boundary). The awaited value is `unknown`, so a hook narrows the
 * rows it reads with one cast at the read site (`as unknown[]`). */
export interface TxQuery {
  (...parts: unknown[]): unknown;
}

/** w.negative_box (the T8 box-state rule, shared by every operation that
 * can leave a box below zero — M2.6 OP-EXPENSE, M2.7 OP-OWNER-WITHDRAWAL /
 * OP-TRANSFER): read the box's RESULTING balance inside the operation's
 * transaction (call from `resultData`, after every write). A box whose
 * opening is unknown has an UNKNOWN balance — never a warning. Returns the
 * operation result data carrying the warning, or undefined. */
export async function negativeBoxWarning(
  tx: TxQuery,
  projectId: string,
  boxId: string,
): Promise<Record<string, unknown> | undefined> {
  const rows = (await tx`
    SELECT b.opening_status, COALESCE(SUM(p.delta_minor), 0)::bigint AS total
    FROM box b
    LEFT JOIN ledger_posting p ON p.account = 'BOX' AND p.ref_id = b.id AND p.project_id = b.project_id
    WHERE b.id = ${boxId} AND b.project_id = ${projectId}
    GROUP BY b.id`) as Array<{ opening_status: string; total: string | number }>;
  const row = rows[0];
  if (row === undefined || String(row.opening_status) !== "known" || Number(row.total) >= 0) return undefined;
  return { warnings: ["w.negative_box"] };
}

/** A balance_line the operation creates (§3.6) — the same shape the M2.4
 * handler persists, declared here so plans are self-contained. */
export interface PlanBalanceLine {
  id: string;
  direction: "to_me" | "by_me";
  kind: string;
  originOn: string;
  counterpartyName?: string;
  saleId?: string;
}

/** §3.7 operation kinds (the closed 0018 CHECK enumeration) — the domain's
 * own declaration so plans do not import worker code (M1.6 boundary);
 * structurally identical to the handler's ManageOperationKind. */
export type ManageOperationKind =
  | "OP-SETUP"
  | "OP-ADD-BOX"
  | "OP-ADD-PRIOR-BALANCE"
  | "OP-SALE-CREATE"
  | "OP-PREPAYMENT"
  | "OP-SALE-DELIVERY-COST"
  | "OP-DELIVER"
  | "OP-CANCEL-SALE"
  | "OP-RETURN"
  | "OP-PRICE-CORRECTION"
  | "OP-UNDO-DELIVERY"
  | "OP-COLLECT"
  | "OP-WRITE-OFF"
  | "OP-PAY"
  | "OP-EXPENSE"
  | "OP-OWNER-DEPOSIT"
  | "OP-OWNER-WITHDRAWAL"
  | "OP-TRANSFER"
  | "OP-MERGE-BOXES"
  | "OP-SPLIT-BOXES"
  | "OP-TRACKER-HIDE"
  | "OP-TRACKER-ADD"
  | "OP-RECONCILE"
  | "OP-RETURN-AFTER-ABSENCE"
  | "OP-CORRECT"
  | "OP-CANCEL-OPERATION";

/** The write intent for the M2.4 handler: the operation row's fields plus
 * its balance lines and BUILT entries (§3.7/§3.6/§3.8). Structurally the
 * handler's ManageOperationWrite — declared in the domain so planners do
 * not import worker code. */
export interface OperationWritePlan {
  projectId: string;
  createdByAccountId: string;
  requestId: string;
  kind: ManageOperationKind;
  effectiveOn: string;
  /** §3.7 display amount — null when the row shows no amount (§5.0). */
  amountFils: number | null;
  /** §3.7 corrects_operation_id — set on the replacement of a corrected
   * operation (M2.10 OP-CORRECT): the new version of the operation. */
  correctsOperationId?: string;
  counterpartyName?: string;
  boxId?: string;
  saleId?: string;
  /** §3.7 balance_line_id: the balance line the operation acts on or opens. */
  balanceLineId?: string;
  category?: string;
  deliveryCostFils?: number;
  note?: string;
  payload?: unknown;
  balanceLines?: PlanBalanceLine[];
  entries: BuiltLedgerEntry[];
  /** The client's validated INTENT — every input the plan was built from,
   * with NO server-generated id (boxes and balance lines the plan creates
   * get fresh ids on every planning). The M2.4 handler hashes it for the
   * idempotency reservation (R-25/T55): a retried request plans again and
   * must replay, not conflict. Every planner sets it. */
  intent?: unknown;
}

/** «Load state in the transaction» (§14.1): runs inside the handler's
 * transaction after the idempotency reservation, before any write. A plan
 * whose entries depend on live state (the box a payment leaves, the line a
 * payment settles…) fills `write.entries` / `write.boxId` / `write.balanceLineId`
 * here: the handler reads them after this hook. */
export type PlanLoadState = (tx: TxQuery) => Promise<unknown>;

/** Operation-specific writes (box rows, FK-ordered entries…) inside the
 * same transaction, after the standard writes; operationId/entryIds are
 * the handler's committed ids for THIS operation. */
export type PlanExtraWrites = (context: {
  tx: TxQuery;
  operationId: string;
  entryIds: string[];
}) => Promise<void>;

/** Operation-specific RESULT data (M2.6): computed inside the same
 * transaction AFTER every write of the operation — the resulting state is
 * visible — and stored by the handler WITH the idempotent response as
 * `result.data`, so a replayed request (R-25) returns it verbatim (e.g.
 * OP-EXPENSE's w.negative_box warning). */
export type PlanResultData = (context: {
  tx: TxQuery;
  operationId: string;
  entryIds: string[];
}) => Promise<Record<string, unknown> | undefined>;

/** M2.10 (OP-CORRECT): the correction's SECOND phase — runs inside the
 * same transaction after every standard write is visible (the Q20
 * reversals included), so the corrected operation's planner sees the
 * POST-REVERSAL state. The balance lines and entries returned here are
 * written by the M2.4 handler (single ledger writer) and their entry ids
 * join the result. */
export type PlanRevisionEntries = (context: {
  tx: TxQuery;
  operationId: string;
  entryIds: string[];
}) => Promise<{ entries: BuiltLedgerEntry[]; balanceLines?: PlanBalanceLine[] }>;

/** M3.4 (OP-DELIVER's immediate collection, §5): the companion operation —
 * a SECOND §5 plan (M2.8's OP-COLLECT) created together atomically in the
 * handler's one transaction. The factory runs after every primary write is
 * visible (the fresh remainder line exists). */
export type PlanCompanion = (primary: {
  write: OperationWritePlan;
  operationId: string;
  entryIds: string[];
}) => Promise<OperationPlan | undefined>;

/** A complete §5 operation plan: the handler composes it inside its one
 * transaction (SRV-03 reservation + writes + response). */
export interface OperationPlan {
  write: OperationWritePlan;
  loadState?: PlanLoadState | undefined;
  extraWrites?: PlanExtraWrites | undefined;
  resultData?: PlanResultData | undefined;
  revisionEntries?: PlanRevisionEntries | undefined;
  companion?: PlanCompanion | undefined;
}
