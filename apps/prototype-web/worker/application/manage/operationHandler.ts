/**
 * M2.4 (Manage v2 phase 2, wave F — spec §14.1, R-11, R-12, R-23, R-25,
 * SRV-03, T55): THE single server-side operation handler every §5 operation
 * goes through from M2.5 on. Shape (task text, binding):
 *
 *   validate input → load state in the transaction → run the domain
 *   function → write operation + entries + postings → commit.
 *
 * Atomic idempotency (SRV-03 — the security-critical core): the request id
 * reservation happens INSIDE the same transaction as the writes, with the
 * `manage_v2_idempotency` UNIQUE (project_id, request_id) constraint doing
 * the arbitration (migration 0019). There is NO idempotency read outside the
 * transaction: a concurrent duplicate loses the INSERT race inside its own
 * transaction and rolls back completely (R-12) — the same request can never
 * apply twice and never half-apply. A failure of ANY step rolls back
 * everything INCLUDING the reservation, so an honest retry re-executes.
 *
 * Why this is NOT the network-layer `idempotency` table (worker/idempotency.ts):
 * that surface is HTTP-shaped (key scoped to a session cookie, response
 * stored AFTER the handler returns — outside the operation's transaction).
 * Manage v2 owns its reservation at the operation boundary (R-25: "every
 * save carries a client-generated request id"), scoped to the PROJECT not
 * the session, committed atomically WITH the operation rows. The route layer
 * (M2.5+) may still wrap with `command()` for transport idempotency; this
 * handler is the source of truth for "applied at most once per (project,
 * request id)".
 *
 * Purity boundary (§14.1): this module contains NO financial calculation.
 * Entries arrive BUILT and VALIDATED from the M2.2 domain builder
 * (buildLedgerEntry — the per-entry §3.8 equation already checked there,
 * INV-10); the handler only persists them. §8 figures are M2.11's read
 * module alone. The client never computes or decides a figure (R-23): it
 * sends intent (the write below) and receives the result.
 *
 * Money is MoneyFils (integer fils, M1.7) end to end — no number decimals,
 * no /100, no *100. Quantities are milli-integers. Dates are Amman local
 * date strings (YYYY-MM-DD) passed by the caller (the domain owns no clock;
 * the operation layer above passes today from worker/clock.ts).
 *
 * Injected-failure test hook: `injectFailureAfterFirstWrite` exists ONLY for
 * the M2.4 acceptance test that proves a mid-transaction failure leaves no
 * operation, no entries and NO reservation behind. It fails the transaction
 * deterministically after the first write, exactly as a real constraint
 * violation or crash would.
 */
import type postgres from "postgres";
import type { BuiltLedgerEntry } from "../../../../../src/domain/manage/ledger/index.js";

/** §3.7 operation kinds (the closed 0018 CHECK enumeration). */
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

/** A balance_line the operation creates (§3.6) — its origin_operation_id is
 * the operation this write commits. */
export interface ManageBalanceLineWrite {
  id: string;
  direction: "to_me" | "by_me";
  kind: string;
  originOn: string;
  counterpartyName?: string;
  saleId?: string;
}

/** One §5 operation's write intent: everything the transaction persists. */
export interface ManageOperationWrite {
  projectId: string;
  createdByAccountId: string;
  /** R-25: the client-generated request id; the atomic reservation key. */
  requestId: string;
  kind: ManageOperationKind;
  effectiveOn: string;
  /** §3.7 display amount (fils; null = the row shows no amount, §5.0) — the entries are the financial truth. */
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
  /** §3.7 payload — operation-specific inputs, persisted verbatim. */
  payload?: unknown;
  /** Balance lines this operation opens (§3.6); origin_operation_id is set
   * by the handler to the committed operation's id. */
  balanceLines?: ManageBalanceLineWrite[];
  /** Entries BUILT AND VALIDATED by the M2.2 domain builder (never raw
   * postings): the §3.8 per-entry equation is already enforced there. A
   * plan whose entries depend on live state fills this array in its
   * `loadState` hook (the handler reads it after the hook). */
  entries: BuiltLedgerEntry[];
  /** The client's validated INTENT — every input the plan was built from
   * and NO server-generated id. It is what the idempotency request hash
   * covers (R-25/T55): a retried request builds a fresh plan whose
   * generated ids (boxes, balance lines…) differ and must still replay, so
   * the hash covers the intent, never the derived entries and lines.
   * Planners set it; without it the whole write minus the request id is
   * hashed (the M2.4 default). */
  intent?: unknown;
}

/** The stored result replayed verbatim on a duplicate request. */
export interface StoredManageOperationResult {
  operationId: string;
  kind: ManageOperationKind;
  effectiveOn: string;
  amountFils: number | null;
  entryIds: string[];
  /** Operation-specific result (M2.6 — e.g. OP-EXPENSE's warnings),
   * computed inside the transaction by the plan's `resultData` hook and
   * stored WITH the response: a replay returns it verbatim. */
  data?: Record<string, unknown>;
}

export type ManageOperationOutcome =
  | { outcome: "applied"; result: StoredManageOperationResult }
  | { outcome: "replay"; result: StoredManageOperationResult }
  | { outcome: "conflict"; reason: string };

/** M2.5+ operation hooks — everything an operation needs INSIDE the
 * handler's single transaction (§14.1 / SRV-03). */
export interface ManageOperationOptions {
  injectFailureAfterFirstWrite?: boolean;
  /**
   * «Load state in the transaction»: runs inside the operation's
   * transaction right after the idempotency reservation is secured, BEFORE
   * any write. The §14.1 shape (validate input → LOAD STATE in the
   * transaction → domain → write) lives here: the operation loads its
   * boxes/lines/sales and makes its domain decision on the consistent
   * snapshot. A rejection thrown here rolls back the reservation too.
   */
  loadState?: (tx: postgres.TransactionSql<Record<string, unknown>>) => Promise<unknown>;
  /**
   * Operation-specific writes (box rows, sale rows, entries that must
   * follow their FK targets…) in the SAME transaction: called after the
   * operation row + balance lines + entries + postings are written — a
   * failure anywhere rolls back everything (R-12). `operationId` is THIS
   * operation's row id (never re-queried) and `entryIds` the ids of the
   * entries already written for it.
   */
  extraWrites?: (context: {
    tx: postgres.TransactionSql<Record<string, unknown>>;
    operationId: string;
    entryIds: string[];
  }) => Promise<void>;
  /**
   * Operation-specific RESULT data (M2.6): called inside the same
   * transaction AFTER every write (standard rows + extraWrites) — the
   * resulting state is visible. What it returns is stored with the
   * idempotent response as `result.data`, so a replayed request (R-25)
   * returns it verbatim. `undefined` stores nothing. Still NO financial
   * calculation here: the plan's hook decides (e.g. a warning); the handler
   * only persists its answer.
   */
  resultData?: (context: {
    tx: postgres.TransactionSql<Record<string, unknown>>;
    operationId: string;
    entryIds: string[];
  }) => Promise<Record<string, unknown> | undefined>;
  /**
   * M2.10 (OP-CORRECT / OP-CANCEL-OPERATION): the correction's SECOND
   * phase — runs inside the same transaction AFTER every standard write is
   * visible (the Q20 reversals of `write.entries` included), so the
   * corrected operation's planner sees the POST-REVERSAL state (T52: the
   * collection's line outstanding restored before the new allocation).
   * The balance lines and entries it returns are written BY THE HANDLER
   * (one ledger writer) and their entry ids join `result.entryIds`. A
   * rejection anywhere rolls back everything including the reversals
   * (R-12).
   */
  revisionEntries?: (context: {
    tx: postgres.TransactionSql<Record<string, unknown>>;
    operationId: string;
    entryIds: string[];
  }) => Promise<{ entries: BuiltLedgerEntry[]; balanceLines?: ManageBalanceLineWrite[] }>;
}

/** A reserved-but-never-stored row older than this is a dead reservation
 * (crashed worker between write and commit — impossible when the reservation
 * is inside the transaction, kept honest for takeover anyway): the next
 * attempt takes it over instead of blocking forever. 5 minutes, the same
 * order as the network layer's RESERVATION_TTL_MS. */
const RESERVATION_TAKEOVER_MS = 5 * 60 * 1000;

const RESERVED_STATUS = 0;

interface ReservationRow {
  request_hash: string;
  response_status: number;
  response_body: string;
  created_at: string | number;
  reserved_at: string | number;
}

/** Operation ids are UUIDs (§3 PK); crypto.randomUUID is available in the
 * worker runtime and in Node ≥ 19 (the test harness). */
function operationUuid(): string {
  return crypto.randomUUID();
}

/** Timestamp parameter: postgres.js sends Date objects through its own
 * serialization only when typed as parameters in certain modes; an ISO
 * string is the unambiguous TIMESTAMPTZ input form. */
function timestamptz(ms: number): string {
  return new Date(ms).toISOString();
}

/** Write one BUILT entry and its postings — the SINGLE ledger writer's
 * insert, shared by the standard phase and the revision phase (M2.10).
 * Returns the entry id. */
async function writeEntry(
  tx: postgres.TransactionSql<Record<string, unknown>>,
  projectId: string,
  operationId: string,
  entry: BuiltLedgerEntry,
  createdAt: string,
): Promise<string> {
  const entryId = operationUuid();
  await tx`
    INSERT INTO ledger_entry (id, project_id, operation_id, entry_type, effective_on, reverses_entry_id, created_at)
    VALUES (${entryId}, ${projectId}, ${operationId}, ${entry.entryType}, ${entry.effectiveOn},
            ${entry.reversesEntryId ?? null}, ${createdAt})`;
  for (const posting of entry.postings) {
    await tx`
      INSERT INTO ledger_posting (id, project_id, entry_id, account, ref_id, category, rev_kind, delta_minor)
      VALUES (${operationUuid()}, ${projectId}, ${entryId}, ${posting.account},
              ${posting.refId ?? null}, ${posting.category ?? null}, ${posting.revKind ?? null},
              ${posting.deltaFils})`;
  }
  return entryId;
}

/** Canonical request hash: the request's INTENT — who asks, for which
 * project, which operation with which effective date, and the planner's
 * validated inputs (`write.intent`). A different intent under the same key
 * is the explicit E-IDEMPOTENCY-CONFLICT (SRV-03 §2.5). The plan's entries
 * and balance lines are deliberately NOT hashed: the domain derives them
 * from the intent, and they carry server-generated ids — a retried request
 * plans again with fresh ids and must replay, not conflict. A write without
 * an intent (the M2.4 default) hashes everything but the request id.
 * JSON with sorted keys would be over-engineering here: the intent is
 * built in one place (the planner), so its serialization is stable for
 * identical requests. */
async function requestHashOf(write: ManageOperationWrite): Promise<string> {
  let basis: unknown;
  if (write.intent !== undefined) {
    basis = {
      projectId: write.projectId,
      createdByAccountId: write.createdByAccountId,
      kind: write.kind,
      effectiveOn: write.effectiveOn,
      intent: write.intent,
    };
  } else {
    const { requestId: ignored, ...rest } = write;
    void ignored;
    basis = rest;
  }
  const serialized = JSON.stringify(basis);
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(serialized));
  return Array.from(new Uint8Array(digest))
    .map(byte => byte.toString(16).padStart(2, "0"))
    .join("");
}

/**
 * Apply one §5 operation atomically. The caller passes a REQUEST-SCOPED
 * postgres client (the production Db shape: one connection per request —
 * workerd forbids cross-request socket reuse); the whole handler runs inside
 * `sql.begin`, one transaction: reservation + operation + balance lines +
 * entries + postings, commit or nothing (R-12).
 */
export async function applyManageOperation(
  sql: postgres.Sql,
  write: ManageOperationWrite,
  options: ManageOperationOptions = {},
): Promise<ManageOperationOutcome> {
  const requestHash = await requestHashOf(write);
  const now = Date.now();

  return sql.begin(async tx => {
    // ── Reservation INSIDE the transaction (SRV-03) ─────────────────────
    // INSERT ... ON CONFLICT DO NOTHING + re-read: the winner owns the key
    // and continues in THIS transaction; a live loser gets a definitive
    // answer below. No idempotency read happens outside this transaction.
    const inserted = await tx`
      INSERT INTO manage_v2_idempotency
        (project_id, request_id, request_hash, response_status, response_body, created_at, reserved_at)
      VALUES (${write.projectId}, ${write.requestId}, ${requestHash}, ${RESERVED_STATUS}, ${""}, ${now}, ${now})
      ON CONFLICT (project_id, request_id) DO NOTHING
      RETURNING request_hash`;
    if (inserted.length === 0) {
      // Someone holds the key: a completed response (same body → replay the
      // stored result verbatim; different body → explicit conflict), or an
      // in-flight reservation (live → in-progress conflict; dead → takeover).
      const existing = (
        await tx`
        SELECT request_hash, response_status, response_body, created_at, reserved_at
        FROM manage_v2_idempotency
        WHERE project_id = ${write.projectId} AND request_id = ${write.requestId}`
      )[0] as ReservationRow | undefined;
      if (existing === undefined) {
        // Raced a concurrent takeover delete/insert — surface the conflict,
        // never a second application.
        return { outcome: "conflict", reason: "idempotency_reservation_race" };
      }
      if (Number(existing.response_status) !== RESERVED_STATUS) {
        if (String(existing.request_hash) !== requestHash) {
          return { outcome: "conflict", reason: "E-IDEMPOTENCY-CONFLICT" };
        }
        return {
          outcome: "replay",
          result: JSON.parse(existing.response_body) as StoredManageOperationResult,
        };
      }
      const reservedAt = Number(existing.reserved_at);
      if (now - reservedAt <= RESERVATION_TAKEOVER_MS) {
        // Live in-flight duplicate. The loser's whole transaction rolls back
        // below (nothing was written by it); an honest retry re-executes.
        return { outcome: "conflict", reason: "idempotency_key_in_progress" };
      }
      // Dead reservation (crashed worker outside this design; kept honest):
      // take it over inside the same transaction.
      const taken = await tx`
        UPDATE manage_v2_idempotency
        SET request_hash = ${requestHash}, reserved_at = ${now}, created_at = ${now},
            response_status = ${RESERVED_STATUS}, response_body = ${""}
        WHERE project_id = ${write.projectId} AND request_id = ${write.requestId}
          AND response_status = ${RESERVED_STATUS} AND reserved_at = ${reservedAt}
        RETURNING reserved_at`;
      if (taken.length === 0) {
        return { outcome: "conflict", reason: "idempotency_reservation_race" };
      }
    }

    // ── Load state IN the transaction (§14.1) — after the reservation is
    // secured, before any write. The operation's domain decision runs here
    // on a consistent snapshot; a rejection rolls back the reservation.
    if (options.loadState !== undefined) {
      await options.loadState(tx);
    }

    // ── The operation row (§3.7) ────────────────────────────────────────
    const operationId = operationUuid();
    // The FIRST write inside the transaction after the reservation — the
    // injected-failure hook fails right after it to prove full rollback.
    await tx`
      INSERT INTO operation
        (id, project_id, kind, effective_on, status, corrects_operation_id, box_id, sale_id, balance_line_id, counterparty_name,
         category, amount_minor, delivery_cost_minor, payload, note, created_by_account_id, created_at)
      VALUES (${operationId}, ${write.projectId}, ${write.kind}, ${write.effectiveOn}, ${"active"},
              ${write.correctsOperationId ?? null},
              ${write.boxId ?? null}, ${write.saleId ?? null}, ${write.balanceLineId ?? null},
              ${write.counterpartyName ?? null},
              ${write.category ?? null}, ${write.amountFils}, ${write.deliveryCostFils ?? null},
              ${write.payload === undefined ? null : JSON.stringify(write.payload)},
              ${write.note ?? null}, ${write.createdByAccountId}, ${timestamptz(now)})`;

    if (options.injectFailureAfterFirstWrite === true) {
      throw new Error("M2.4 injected failure after the first write — transaction must roll back");
    }

    // ── Balance lines this operation opens (§3.6) ───────────────────────
    for (const line of write.balanceLines ?? []) {
      await tx`
        INSERT INTO balance_line
          (id, project_id, direction, kind, counterparty_name, origin_on, sale_id, origin_operation_id)
        VALUES (${line.id}, ${write.projectId}, ${line.direction}, ${line.kind},
                ${line.counterpartyName ?? null}, ${line.originOn}, ${line.saleId ?? null}, ${operationId})`;
    }

    // ── Entries + postings (§3.8, append-only inserts) ──────────────────
    const entryIds: string[] = [];
    for (const entry of write.entries) {
      entryIds.push(await writeEntry(tx, write.projectId, operationId, entry, timestamptz(now)));
    }

    // ── Store the response INSIDE the same transaction, then commit ─────
    const result: StoredManageOperationResult = {
      operationId,
      kind: write.kind,
      effectiveOn: write.effectiveOn,
      amountFils: write.amountFils,
      entryIds,
    };
    // Operation-specific writes (box/sale rows…), same transaction (R-12).
    if (options.extraWrites !== undefined) {
      await options.extraWrites({ tx, operationId, entryIds });
    }
    // The correction's second phase (M2.10): the corrected operation's
    // planner runs against the POST-REVERSAL state; the handler stays the
    // single ledger writer and the ids join the result.
    if (options.revisionEntries !== undefined) {
      const revision = await options.revisionEntries({ tx, operationId, entryIds });
      for (const line of revision.balanceLines ?? []) {
        await tx`
          INSERT INTO balance_line
            (id, project_id, direction, kind, counterparty_name, origin_on, sale_id, origin_operation_id)
          VALUES (${line.id}, ${write.projectId}, ${line.direction}, ${line.kind},
                  ${line.counterpartyName ?? null}, ${line.originOn}, ${line.saleId ?? null}, ${operationId})`;
      }
      for (const entry of revision.entries) {
        entryIds.push(await writeEntry(tx, write.projectId, operationId, entry, timestamptz(now)));
      }
    }
    // Operation-specific result data (e.g. a warning about the resulting
    // state), decided by the plan now that every write is visible.
    if (options.resultData !== undefined) {
      const data = await options.resultData({ tx, operationId, entryIds });
      if (data !== undefined) result.data = data;
    }
    await tx`
      UPDATE manage_v2_idempotency
      SET response_status = ${200}, response_body = ${JSON.stringify(result)}
      WHERE project_id = ${write.projectId} AND request_id = ${write.requestId}
        AND response_status = ${RESERVED_STATUS}`;
    return { outcome: "applied", result };
  });
}
