/**
 * M2.4 acceptance (Manage v2 phase 2, wave F — spec §14.1, R-11, R-12,
 * R-23, R-25, SRV-03, T55): the ONE server-side operation handler shape —
 * validate input → load state in the transaction → run the domain function →
 * write operation + entries + postings → commit — with the idempotency
 * reservation INSIDE the same transaction as the writes, a database
 * uniqueness constraint doing the arbitration, and a failure of any step
 * rolling back everything including the reservation.
 *
 * Everything runs on the repository's real test posture: the real embedded
 * PostgreSQL (pg-test-server.mjs + harness.ts per-file isolated database,
 * migrations 0001–0019 applied in order) — never a mock (SECURITY-EVIDENCE.md
 * SRV-03 §2: «لا يُقبل: mock بدل Postgres حقيقي»). The handler is exercised
 * through its exported function with request-scoped postgres clients exactly
 * as the route layer will call it from M2.5 on (the §14.1 application layer
 * owns the transaction; the route only adapts HTTP).
 *
 * Cases (tests-first; the file was written BEFORE the handler existed and
 * failed with "Cannot find module '../application/manage/operationHandler'"
 * — evidence §1):
 *  1. T55 — the same request id twice → ONE operation row, one set of
 *     entries, byte-identical stored response replayed the second time.
 *  2. Concurrency — two PARALLEL requests with the same id → exactly one
 *     applies; the loser gets the winner's response (replay) or an honest
 *     in-progress conflict, never a second application.
 *  3. Injected failure after the first write → no operation, no entries, NO
 *     reservation left behind (count = 0), and an honest retry re-executes.
 *  4. Same request id with a DIFFERENT body → explicit E-IDEMPOTENCY-CONFLICT
 *     (SRV-03 §2.5), no second application, no silent ignore.
 *  5. A reservation left by a crashed worker (reserved, no response) is
 *     taken over honestly after the TTL — and the takeover never
 *     double-applies.
 *  6. The arbitration is a DATABASE constraint on (project_id, request_id):
 *     a direct duplicate INSERT outside any handler code is rejected by
 *     PostgreSQL itself (SRV-03 §2.1 — no pre-check can provide this).
 *  7. R-12 atomic commit: operation + ledger_entry + ledger_posting commit
 *     together; the stored result names exactly the committed entry ids.
 *
 * Each test seeds its OWN project (UUID-per-test) so row-count assertions
 * are exact per case. The seeded write is a §5 OP-ADD-PRIOR-BALANCE-shaped
 * minimal operation (one Q2 entry: AR +a / OPEN +a — the T38 shape) whose
 * entry is BUILT by the M2.2 domain builder, never hand-rolled: M2.4 owns
 * only the handler shape and the idempotency core; §5 operation contracts
 * are M2.5+. Every acceptance test ends with the single INV-1/INV-2
 * assertion (assertLedgerCoreInvariants — §13 posture from M2.4 on).
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import postgres from "postgres";
import {
  applyManageOperation,
  type ManageOperationWrite,
  type StoredManageOperationResult,
} from "../application/manage/operationHandler.ts";
import { buildLedgerEntry } from "../../../../src/domain/manage/ledger/index.js";
import { assertLedgerCoreInvariants } from "../../../../src/domain/manage/invariants/index.js";
import type { LedgerCheckState } from "../../../../src/domain/manage/invariants/index.js";
import { startWorker, type WorkerInstance } from "./harness.ts";
import { fileSqlUrl } from "./manage.v2.helpers.ts";

/** The per-file harness database URL (migrations 0001–0019 applied). */
let fileDbUrl = "";
let worker: WorkerInstance;

/** A fresh request-scoped client — the production Db shape (max: 1). */
function scopedClient(): postgres.Sql {
  return postgres(fileDbUrl, { max: 1 });
}

beforeAll(async () => {
  worker = await startWorker();
  // The harness creates this file's isolated database (micro_tf_<tag>) and
  // applies every migration to it; resolve THAT database through the
  // harness handle (never a guess among the parallel suite's databases).
  fileDbUrl = await fileSqlUrl(worker);
});

afterAll(async () => {
  await worker.close();
});

/* ── Fixtures ─────────────────────────────────────────────────────────── */

/** Deterministic per-test UUIDv5-shaped ids so each case owns its project. */
function testIds(seed: number): { projectId: string; lineId: string; ownerId: string } {
  const hex = seed.toString(16).padStart(4, "0");
  const tail = `0000-4000-8000-${"0".repeat(8 - hex.length)}${hex}`;
  return {
    projectId: `bbbbbbbb-0000-4000-8000-${"0".repeat(12 - hex.length)}${hex}`.slice(0, 36),
    lineId: `cccccccc-0000-4000-8000-00000000${tail.slice(-4)}`,
    ownerId: `m24-owner-${seed}`,
  };
}

/** Seed the §3 FK graph for one isolated test project. */
async function seedProject(ids: { projectId: string; ownerId: string }): Promise<void> {
  const sql = scopedClient();
  try {
    await sql`INSERT INTO project (id, name, owner_account_id, created_at)
              VALUES (${ids.projectId}, ${"مشروع M2.4"}, ${ids.ownerId}, now())
              ON CONFLICT (id) DO NOTHING`;
  } finally {
    await sql.end();
  }
}

const AMMAN_TODAY = "2026-11-26";

/** One OP-ADD-PRIOR-BALANCE-shaped write: Q2 prior receivable (T38 shape),
 * entry built by the M2.2 builder; the balance line opens in the same
 * transaction (origin_operation_id = the committed operation). */
function priorReceivableWrite(
  ids: { projectId: string; lineId: string; ownerId: string },
  amountFils: number,
  requestId: string,
): ManageOperationWrite {
  return {
    projectId: ids.projectId,
    createdByAccountId: ids.ownerId,
    requestId,
    kind: "OP-ADD-PRIOR-BALANCE",
    effectiveOn: AMMAN_TODAY,
    amountFils,
    counterpartyName: "سامي",
    balanceLines: [
      {
        id: ids.lineId,
        direction: "to_me",
        kind: "prior_receivable",
        originOn: AMMAN_TODAY,
        counterpartyName: "سامي",
      },
    ],
    entries: [buildLedgerEntry({ type: "Q2", effectiveOn: AMMAN_TODAY, lineId: ids.lineId, amountFils })],
  };
}

async function countRows(sql: postgres.Sql, table: string, where: string): Promise<number> {
  const rows = await sql.unsafe(`SELECT count(*)::int AS n FROM ${table} WHERE ${where}`);
  return Number(rows[0]!.n);
}

/** Project one test project's rows into the M2.3 invariant state. */
async function ledgerState(ids: { projectId: string }): Promise<LedgerCheckState> {
  const sql = scopedClient();
  try {
    const boxes = await sql`SELECT id, status, opening_status FROM box WHERE project_id = ${ids.projectId}`;
    const lines = await sql`SELECT id, direction FROM balance_line WHERE project_id = ${ids.projectId}`;
    const entries = await sql`
      SELECT id, operation_id, entry_type, effective_on, reverses_entry_id
      FROM ledger_entry WHERE project_id = ${ids.projectId}`;
    const postings = await sql`
      SELECT entry_id, account, ref_id, category, rev_kind, delta_minor
      FROM ledger_posting WHERE project_id = ${ids.projectId}`;
    return {
      boxes: boxes.map(b => ({ id: b.id, status: b.status, openingStatus: b.opening_status })),
      balanceLines: lines.map(l => ({ id: l.id, direction: l.direction })),
      sales: [],
      saleLines: [],
      operations: [],
      entries: entries.map(e => ({
        id: e.id,
        operationId: e.operation_id,
        entryType: e.entry_type,
        effectiveOn: new Date(e.effective_on).toISOString().slice(0, 10),
        ...(e.reverses_entry_id ? { reversesEntryId: e.reverses_entry_id } : {}),
        postings: postings
          .filter(p => p.entry_id === e.id)
          .map(p => ({
            account: p.account,
            deltaFils: Number(p.delta_minor),
            ...(p.ref_id ? { refId: p.ref_id } : {}),
            ...(p.category ? { category: p.category } : {}),
            ...(p.rev_kind ? { revKind: p.rev_kind } : {}),
          })),
      })),
    };
  } finally {
    await sql.end();
  }
}

/* ── 1. T55: same request id twice → one application, identical response ── */

describe("M2.4 SRV-03 — T55 same request id twice", () => {
  it("applies once: one operation, one entry, byte-identical replay", async () => {
    const ids = testIds(1);
    await seedProject(ids);
    const write = priorReceivableWrite(ids, 40000, "req-t55");
    const first = await applyManageOperation(scopedClient(), write);
    expect(first.outcome).toBe("applied");
    const firstBody = JSON.stringify((first as { result: StoredManageOperationResult }).result);

    const second = await applyManageOperation(scopedClient(), write);
    expect(second.outcome).toBe("replay");
    const secondBody = JSON.stringify((second as { result: StoredManageOperationResult }).result);
    expect(secondBody).toBe(firstBody);

    const sql = scopedClient();
    try {
      expect(await countRows(sql, "operation", `project_id = '${ids.projectId}'`)).toBe(1);
      expect(await countRows(sql, "ledger_entry", `project_id = '${ids.projectId}'`)).toBe(1);
      expect(await countRows(sql, "ledger_posting", `project_id = '${ids.projectId}'`)).toBe(2);
    } finally {
      await sql.end();
    }

    // §13 posture: every acceptance test ends with the INV-1/INV-2 assertion.
    assertLedgerCoreInvariants(await ledgerState(ids));
  });
});

/* ── 2. Concurrency: two parallel requests, same id → exactly one applies ── */

describe("M2.4 SRV-03 — concurrent duplicate requests", () => {
  it("two parallel same-id requests → exactly one application", async () => {
    const ids = testIds(2);
    await seedProject(ids);
    const write = priorReceivableWrite(ids, 25000, "req-concurrent");
    const [a, b] = await Promise.all([
      applyManageOperation(scopedClient(), write),
      applyManageOperation(scopedClient(), write),
    ]);
    const outcomes = [a.outcome, b.outcome].sort();
    // Exactly one application; the other replays the winner's stored
    // response or gets an honest in-progress conflict — NEVER a second
    // application.
    expect(outcomes).toEqual(["applied", "replay"]);

    const sql = scopedClient();
    try {
      expect(await countRows(sql, "operation", `project_id = '${ids.projectId}'`)).toBe(1);
      expect(await countRows(sql, "ledger_entry", `project_id = '${ids.projectId}'`)).toBe(1);
      expect(await countRows(sql, "ledger_posting", `project_id = '${ids.projectId}'`)).toBe(2);
    } finally {
      await sql.end();
    }
    assertLedgerCoreInvariants(await ledgerState(ids));
  });
});

/* ── 3. Injected failure after the first write → full rollback ────────── */

describe("M2.4 SRV-03 — injected mid-transaction failure", () => {
  it("rolls back operation, entries AND the reservation; retry re-executes", async () => {
    const ids = testIds(3);
    await seedProject(ids);
    const write = priorReceivableWrite(ids, 10000, "req-failure");

    await expect(
      applyManageOperation(scopedClient(), write, { injectFailureAfterFirstWrite: true }),
    ).rejects.toThrow();

    const sql = scopedClient();
    try {
      expect(await countRows(sql, "operation", `project_id = '${ids.projectId}'`)).toBe(0);
      expect(await countRows(sql, "ledger_entry", `project_id = '${ids.projectId}'`)).toBe(0);
      expect(await countRows(sql, "manage_v2_idempotency", `project_id = '${ids.projectId}'`)).toBe(0);
    } finally {
      await sql.end();
    }

    // An honest retry with the same key after the failure re-executes
    // cleanly — the reservation did not survive to block it.
    const retry = await applyManageOperation(scopedClient(), write);
    expect(retry.outcome).toBe("applied");
    assertLedgerCoreInvariants(await ledgerState(ids));
  });
});

/* ── 4. Same id, different body → explicit conflict, no second apply ───── */

describe("M2.4 SRV-03 — same id, different body", () => {
  it("rejects with E-IDEMPOTENCY-CONFLICT and applies nothing new", async () => {
    const ids = testIds(4);
    await seedProject(ids);
    const write = priorReceivableWrite(ids, 5000, "req-conflict");
    const first = await applyManageOperation(scopedClient(), write);
    expect(first.outcome).toBe("applied");

    // Same request id, DIFFERENT intent (amount 9000 → different hash).
    const divergent = priorReceivableWrite(ids, 9000, write.requestId);
    const second = await applyManageOperation(scopedClient(), divergent);
    expect(second).toEqual({ outcome: "conflict", reason: "E-IDEMPOTENCY-CONFLICT" });

    const sql = scopedClient();
    try {
      // Exactly one operation for this project — the first application's.
      expect(await countRows(sql, "operation", `project_id = '${ids.projectId}'`)).toBe(1);
      expect(await countRows(sql, "ledger_entry", `project_id = '${ids.projectId}'`)).toBe(1);
    } finally {
      await sql.end();
    }
    assertLedgerCoreInvariants(await ledgerState(ids));
  });
});

/* ── 5. Dead reservation takeover (crashed worker) ─────────────────────── */

describe("M2.4 SRV-03 — dead reservation takeover", () => {
  it("a stale reserved row is taken over, never double-applied", async () => {
    const ids = testIds(5);
    await seedProject(ids);
    const write = priorReceivableWrite(ids, 15000, "req-dead");
    // Simulate a crashed worker: a reserved row with no stored response,
    // older than the takeover TTL.
    const sql = scopedClient();
    try {
      const stale = Date.now() - 6 * 60 * 1000;
      await sql`INSERT INTO manage_v2_idempotency
                (project_id, request_id, request_hash, response_status, response_body, created_at, reserved_at)
                VALUES (${ids.projectId}, ${write.requestId}, ${"deadbeef"}, 0, ${""}, ${stale}, ${stale})`;
    } finally {
      await sql.end();
    }
    const outcome = await applyManageOperation(scopedClient(), write);
    expect(outcome.outcome).toBe("applied");
    const again = await applyManageOperation(scopedClient(), write);
    expect(again.outcome).toBe("replay");

    const check = scopedClient();
    try {
      expect(await countRows(check, "operation", `project_id = '${ids.projectId}'`)).toBe(1);
    } finally {
      await check.end();
    }
    assertLedgerCoreInvariants(await ledgerState(ids));
  });
});

/* ── 6. The arbitration is a database constraint, not a pre-check ──────── */

describe("M2.4 SRV-03 — database-level uniqueness arbitration", () => {
  it("rejects a direct duplicate (project_id, request_id) INSERT at the database", async () => {
    const ids = testIds(6);
    await seedProject(ids);
    const sql = scopedClient();
    try {
      await sql`INSERT INTO manage_v2_idempotency
                (project_id, request_id, request_hash, response_status, response_body, created_at, reserved_at)
                VALUES (${ids.projectId}, ${"dup-probe"}, ${"h1"}, 0, ${""}, ${Date.now()}, ${Date.now()})`;
      // A second insert of the same key must be rejected by PostgreSQL's
      // constraint itself (SRV-03 §2.1) — no handler code involved.
      await expect(
        sql`INSERT INTO manage_v2_idempotency
            (project_id, request_id, request_hash, response_status, response_body, created_at, reserved_at)
            VALUES (${ids.projectId}, ${"dup-probe"}, ${"h2"}, 0, ${""}, ${Date.now()}, ${Date.now()})`,
      ).rejects.toThrow();
    } finally {
      await sql.end();
    }
  });
});

/* ── 8. The old outside-transaction shape double-applies (SRV-03 proof) ── */

describe("M2.4 SRV-03 — the pre-fix outside-transaction shape double-applies", () => {
  it("reserve-then-write on separate transactions loses the race", async () => {
    const ids = testIds(8);
    await seedProject(ids);
    const write = priorReceivableWrite(ids, 20000, "req-oldshape");

    // The OLD (vulnerable) shape the security audit found (SRV-03): the
    // idempotency lookup, the operation execution, and the response store
    // are THREE SEPARATE steps («قراءة المفتاح وتنفيذ العملية وحفظ الرد
    // خطوات منفصلة»). Two concurrent requests both read "not applied",
    // both execute the operation (each in its own transaction), and the
    // second store then fails on the unique constraint — swallowed, because
    // in the old shape the operation was already committed outside any
    // transaction that could roll it back with the store. This is the
    // failing-test proof SRV-03 §2.3 demands: the SAME race the handler
    // passes (case 2) double-applies here.
    const naiveApply = async (): Promise<void> => {
      const sql = scopedClient();
      try {
        // Step 1: the non-atomic lookup (outside every transaction).
        const existing =
          await sql`SELECT 1 FROM manage_v2_idempotency WHERE project_id = ${ids.projectId} AND request_id = ${write.requestId}`;
        if (existing.length > 0) return;
        // Both concurrent callers reach here — neither has stored yet.
        // Step 2: the operation commits in its OWN transaction, with no
        // reservation inside it.
        await sql.begin(async tx => {
          const operationId = crypto.randomUUID();
          await tx`INSERT INTO operation
                   (id, project_id, kind, effective_on, status, amount_minor, counterparty_name, created_by_account_id, created_at)
                   VALUES (${operationId}, ${ids.projectId}, ${write.kind}, ${write.effectiveOn}, ${"active"},
                           ${write.amountFils}, ${write.counterpartyName ?? null}, ${write.createdByAccountId}, now())`;
          for (const entry of write.entries) {
            const entryId = crypto.randomUUID();
            await tx`INSERT INTO ledger_entry (id, project_id, operation_id, entry_type, effective_on, created_at)
                     VALUES (${entryId}, ${ids.projectId}, ${operationId}, ${entry.entryType}, ${entry.effectiveOn}, now())`;
            for (const posting of entry.postings) {
              await tx`INSERT INTO ledger_posting (id, project_id, entry_id, account, ref_id, delta_minor)
                       VALUES (${crypto.randomUUID()}, ${ids.projectId}, ${entryId}, ${posting.account},
                               ${posting.refId ?? null}, ${posting.deltaFils})`;
            }
          }
        });
        // Step 3: the store, separate — the loser's constraint violation is
        // swallowed (the old code path had nothing left to roll back).
        await sql`INSERT INTO manage_v2_idempotency
                  (project_id, request_id, request_hash, response_status, response_body, created_at, reserved_at)
                  VALUES (${ids.projectId}, ${write.requestId}, ${"naive"}, 200, ${"{}"}, ${Date.now()}, ${Date.now()})
                  ON CONFLICT (project_id, request_id) DO NOTHING`.catch(() => undefined);
      } finally {
        await sql.end();
      }
    };

    // Race two naive requests. Under the interleaving the check-then-write
    // gap allows, both pass the empty-check phase. The test ASSERTS the
    // vulnerability is real: the naive shape double-applies (2 operations)
    // — which is exactly why the handler keeps the reservation inside the
    // transaction. If this ever reports 1, the race did not interleave on
    // this machine; the assertion documents the defect, not a guarantee.
    await Promise.all([naiveApply(), naiveApply()]);
    const sql = scopedClient();
    let ops = 0;
    try {
      ops = await countRows(sql, "operation", `project_id = '${ids.projectId}'`);
    } finally {
      await sql.end();
    }
    // The double-application is the documented pre-fix failure (evidence
    // §2). The committed handler (cases 1–2) passes the same race with
    // exactly one application.
    expect(ops).toBe(2);
  });
});

describe("M2.4 R-12 — one operation, one transaction", () => {
  it("commits operation + balance line + entry + postings together", async () => {
    const ids = testIds(7);
    await seedProject(ids);
    const write = priorReceivableWrite(ids, 33000, "req-atomic");
    const outcome = await applyManageOperation(scopedClient(), write);
    expect(outcome.outcome).toBe("applied");
    const { result } = outcome as { result: StoredManageOperationResult };

    const sql = scopedClient();
    try {
      const op =
        await sql`SELECT id, kind, status, amount_minor, counterparty_name, created_by_account_id FROM operation WHERE project_id = ${ids.projectId}`;
      expect(op.length).toBe(1);
      expect(op[0]!.id).toBe(result.operationId);
      expect(op[0]!.kind).toBe("OP-ADD-PRIOR-BALANCE");
      expect(op[0]!.status).toBe("active");
      expect(Number(op[0]!.amount_minor)).toBe(33000);
      expect(op[0]!.counterparty_name).toBe("سامي");
      expect(op[0]!.created_by_account_id).toBe(ids.ownerId);

      const line =
        await sql`SELECT id, direction, kind, origin_operation_id FROM balance_line WHERE project_id = ${ids.projectId}`;
      expect(line.length).toBe(1);
      expect(line[0]!.origin_operation_id).toBe(result.operationId);

      expect(result.entryIds.length).toBe(1);
      const entry =
        await sql`SELECT id, entry_type, effective_on FROM ledger_entry WHERE id = ${result.entryIds[0]!}`;
      expect(entry[0]!.entry_type).toBe("Q2");
      const postings =
        await sql`SELECT account, delta_minor FROM ledger_posting WHERE entry_id = ${result.entryIds[0]!} ORDER BY account`;
      expect(postings.map(p => [p.account, Number(p.delta_minor)])).toEqual([
        ["AR", 33000],
        ["OPEN", 33000],
      ]);
    } finally {
      await sql.end();
    }
    assertLedgerCoreInvariants(await ledgerState(ids));
  });
});
