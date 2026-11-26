/**
 * M2.5 acceptance (Manage v2 phase 2, wave G — spec §5 OP-SETUP /
 * OP-ADD-BOX / OP-ADD-PRIOR-BALANCE, §4 Q1/Q2/Q3, tests S1-open, T4, T38):
 * the three opening-state operations as pure domain planners + their HTTP
 * routes, composed with the M2.4 handler (the ONE transaction).
 *
 * Real test posture: Miniflare over the per-file isolated PostgreSQL
 * (migrations 0001–0019). Domain planners are exercised through the same
 * composition the route performs (runPlan) against the real database; the
 * HTTP surface is exercised end-to-end (signInAs + apiPost).
 *
 * Cases (tests-first — this file was written before the operations existed
 * and failed with "Cannot find module"):
 *  1. S1-opening — OP-SETUP cash 200 + account 100: Q1 per box, OPEN 300.
 *  2. OP-SETUP unknown opening → no Q1, opening_status 'unknown' (T4 setup).
 *  3. T4 — the Q1 fix entry builds with effective_on = box created_on.
 *  4. T38 — prior receivable 40: AR 40 / OPEN +40, no BOX, profit 0.
 *  5. T13 setup half — prior payable 70: AP 70 / OPEN −70.
 *  6. OP-ADD-BOX known opening → Q1; duplicate kind → E-BOX-LIMIT.
 *  7. OP-SETUP validation: empty name; negative opening; ambiguous unknown.
 *  8. Routes /api/manage-v2/* end-to-end (OP-SETUP creates the project).
 * Every acceptance path ends with assertLedgerCoreInvariants (INV-1+INV-2).
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import postgres from "postgres";
import { startWorker, signInAs, apiPost, type WorkerInstance } from "./harness.ts";
import { planSetup } from "../../../../src/domain/manage/operations/setup.js";
import { planAddBox } from "../../../../src/domain/manage/operations/addBox.js";
import { planAddPriorBalance } from "../../../../src/domain/manage/operations/addPriorBalance.js";
import type { OperationPlan } from "../../../../src/domain/manage/operations/support.js";
import { applyManageOperation } from "../application/manage/operationHandler.ts";
import { buildLedgerEntry } from "../../../../src/domain/manage/ledger/index.js";
import { assertLedgerCoreInvariants } from "../../../../src/domain/manage/invariants/index.js";
import type { LedgerCheckState } from "../../../../src/domain/manage/invariants/index.js";

let worker: WorkerInstance;
let fileDbUrl = "";
let ownerSeq = 0;

function scopedClient(): postgres.Sql {
  return postgres(fileDbUrl, { max: 1 });
}

/** Compose a domain plan with the M2.4 handler — the route's composition.
 * Takes a plan FACTORY: a planner's synchronous validation throw (e.g.
 * E-AMOUNT on bad input) becomes a rejected promise here, so every path is
 * assertable with .rejects. */
async function runPlan(sql: postgres.Sql, make: () => OperationPlan) {
  const plan = make();
  return applyManageOperation(sql, plan.write, {
    ...(plan.loadState !== undefined ? { loadState: plan.loadState } : {}),
    ...(plan.extraWrites !== undefined ? { extraWrites: plan.extraWrites } : {}),
  });
}

beforeAll(async () => {
  worker = await startWorker();
  const base = process.env.MICRO_TEST_PG_CONNECTION;
  if (!base) throw new Error("MICRO_TEST_PG_CONNECTION is not set");
  // Resolve THIS file's database deterministically: sign a probe account in
  // through the real flow, then find the candidate database whose project
  // table contains that account. (Picking the largest micro_tf_* database
  // raced the parallel suite — every test FILE gets its own database.)
  const probeAccount = `m25-dbprobe-${crypto.randomUUID()}`;
  await signInAs(worker, { sub: probeAccount, email: `${probeAccount}@example.com` });
  const admin = postgres(base, { max: 1 });
  const candidates = await admin`select datname from pg_database where datname like 'micro_tf_%'`;
  await admin.end();
  if (candidates.length === 0) throw new Error("no harness micro_tf_* database found");
  const stem = base.replace(/\/[^/]*$/, "");
  let found = "";
  for (const row of candidates) {
    const probe = postgres(`${stem}/${row.datname}`, { max: 1 });
    try {
      // Sign-in creates a network_identity row (not a project) — that row
      // lives only in THIS file's database; its id is what projects use as
      // owner_account_id.
      const hit = await probe`SELECT id FROM network_identity WHERE google_sub = ${probeAccount}`;
      if (hit.length > 0) {
        found = String(row.datname);
        break;
      }
    } catch {
      // No project table here (not this harness database) — next.
    } finally {
      await probe.end({ timeout: 1 }).catch(() => undefined);
    }
  }
  if (found === "") throw new Error("could not locate this file's harness database");
  fileDbUrl = `${stem}/${found}`;
});

afterAll(async () => {
  await worker.close();
});

const AMMAN_TODAY = "2026-11-26";

function freshProjectId(): string {
  return crypto.randomUUID();
}

/** Per-test unique owner (0018: UNIQUE (owner_account_id), R-24). */
function nextOwner(): string {
  ownerSeq += 1;
  return `m25-owner-${ownerSeq}-${Math.random().toString(36).slice(2, 8)}`;
}

async function seedProjectRow(projectId: string, ownerAccountId: string): Promise<void> {
  const sql = scopedClient();
  try {
    await sql`INSERT INTO project (id, name, owner_account_id, created_at)
              VALUES (${projectId}, ${"مشروع M2.5"}, ${ownerAccountId}, now())
              ON CONFLICT (id) DO NOTHING`;
  } finally {
    await sql.end();
  }
}

async function ledgerState(projectId: string): Promise<LedgerCheckState> {
  const sql = scopedClient();
  try {
    const boxes = await sql`SELECT id, status, opening_status FROM box WHERE project_id = ${projectId}`;
    const lines = await sql`SELECT id, direction FROM balance_line WHERE project_id = ${projectId}`;
    const entries = await sql`
      SELECT id, operation_id, entry_type, effective_on, reverses_entry_id
      FROM ledger_entry WHERE project_id = ${projectId}`;
    const postings = await sql`
      SELECT entry_id, account, ref_id, category, rev_kind, delta_minor
      FROM ledger_posting WHERE project_id = ${projectId}`;
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

async function boxBalance(projectId: string, kind: "cash" | "account"): Promise<number> {
  const sql = scopedClient();
  try {
    const rows = await sql`
      SELECT COALESCE(SUM(p.delta_minor), 0)::bigint AS total
      FROM ledger_posting p
      JOIN box b ON b.id = p.ref_id AND b.project_id = ${projectId} AND b.kind = ${kind}
      WHERE p.account = 'BOX'`;
    return Number(rows[0]!.total);
  } finally {
    await sql.end();
  }
}

async function accountTotal(projectId: string, account: string): Promise<number> {
  const sql = scopedClient();
  try {
    const rows = await sql`
      SELECT COALESCE(SUM(delta_minor), 0)::bigint AS total
      FROM ledger_posting WHERE project_id = ${projectId} AND account = ${account}`;
    return Number(rows[0]!.total);
  } finally {
    await sql.end();
  }
}

/* ── 1. S1-opening ─────────────────────────────────────────────────────── */

describe("M2.5 S1-opening — OP-SETUP cash 200 + account 100", () => {
  it("writes Q1 per box with known openings", async () => {
    const projectId = freshProjectId();
    const owner = nextOwner();
    await seedProjectRow(projectId, owner);
    const result = await runPlan(scopedClient(), () =>
      planSetup({
        projectId,
        createdByAccountId: owner,
        requestId: `req-${crypto.randomUUID()}`,
        projectName: "مشروع سامي",
        today: AMMAN_TODAY,
        boxes: [
          { kind: "cash", opening: { openingFils: 200_000 } },
          { kind: "account", opening: { openingFils: 100_000 } },
        ],
      }),
    );
    expect(result.outcome).toBe("applied");
    expect(await boxBalance(projectId, "cash")).toBe(200_000);
    expect(await boxBalance(projectId, "account")).toBe(100_000);
    expect(await accountTotal(projectId, "OPEN")).toBe(300_000);
    expect(await accountTotal(projectId, "REV")).toBe(0);
    expect(await accountTotal(projectId, "EXP")).toBe(0);
    // A second setup with a NEW request id on the same project hits R-9.
    await expect(
      runPlan(scopedClient(), () =>
        planSetup({
          projectId,
          createdByAccountId: owner,
          requestId: `req-${crypto.randomUUID()}`,
          projectName: "مشروع سامي",
          today: AMMAN_TODAY,
          boxes: [{ kind: "cash", opening: { openingFils: 5000 } }],
        }),
      ),
    ).rejects.toThrow(/E-BOX-LIMIT/);
    assertLedgerCoreInvariants(await ledgerState(projectId));
  });
});

/* ── 2. Unknown opening ────────────────────────────────────────────────── */

describe("M2.5 T4-setup — OP-SETUP unknown opening", () => {
  it("creates the box with opening_status unknown and NO Q1 entry", async () => {
    const projectId = freshProjectId();
    const owner = nextOwner();
    await seedProjectRow(projectId, owner);
    const result = await runPlan(scopedClient(), () =>
      planSetup({
        projectId,
        createdByAccountId: owner,
        requestId: `req-${crypto.randomUUID()}`,
        projectName: "مشروع سامي",
        today: AMMAN_TODAY,
        boxes: [{ kind: "cash", opening: { unknown: true } }],
      }),
    );
    expect(result.outcome).toBe("applied");
    const sql = scopedClient();
    try {
      const boxes = await sql`SELECT kind, opening_status FROM box WHERE project_id = ${projectId}`;
      expect(boxes.length).toBe(1);
      expect(boxes[0]!.kind).toBe("cash");
      expect(boxes[0]!.opening_status).toBe("unknown");
      const entries = await sql`SELECT count(*)::int AS n FROM ledger_entry WHERE project_id = ${projectId}`;
      expect(Number(entries[0]!.n)).toBe(0);
    } finally {
      await sql.end();
    }
    assertLedgerCoreInvariants(await ledgerState(projectId));
  });

  it("a duplicate explicit amount with unknown is rejected as ambiguous", async () => {
    const projectId = freshProjectId();
    const owner = nextOwner();
    await seedProjectRow(projectId, owner);
    await expect(
      runPlan(scopedClient(), () =>
        planSetup({
          projectId,
          createdByAccountId: owner,
          requestId: `req-${crypto.randomUUID()}`,
          projectName: "مشروع",
          today: AMMAN_TODAY,
          boxes: [{ kind: "cash", opening: { unknown: true, openingFils: 5000 } }],
        }),
      ),
    ).rejects.toThrow(/E-AMOUNT/);
  });
});

/* ── 3. T4: Q1 fix path ────────────────────────────────────────────────── */

describe("M2.5 T4 — Q1 on first reconciliation effective on box created_on", () => {
  it("builds Q1(200) effective on the box's created_on (domain-level)", () => {
    const boxId = crypto.randomUUID();
    const entry = buildLedgerEntry({
      type: "Q1",
      effectiveOn: "2026-11-20",
      boxId,
      amountFils: 200_000,
    });
    expect(entry.postings.map(p => [p.account, p.deltaFils])).toEqual([
      ["BOX", 200_000],
      ["OPEN", 200_000],
    ]);
  });
});

/* ── 4. T38 ────────────────────────────────────────────────────────────── */

describe("M2.5 T38 — prior receivable 40 for tracking only", () => {
  it("AR 40; OPEN +40; box unchanged; profit 0", async () => {
    const projectId = freshProjectId();
    const owner = nextOwner();
    await seedProjectRow(projectId, owner);
    await runPlan(scopedClient(), () =>
      planSetup({
        projectId,
        createdByAccountId: owner,
        requestId: `req-${crypto.randomUUID()}`,
        projectName: "مشروع",
        today: AMMAN_TODAY,
        boxes: [{ kind: "cash", opening: { unknown: true } }],
      }),
    );
    const result = await runPlan(scopedClient(), () =>
      planAddPriorBalance({
        projectId,
        createdByAccountId: owner,
        requestId: `req-${crypto.randomUUID()}`,
        today: AMMAN_TODAY,
        direction: "to_me",
        counterpartyName: "سامي",
        amountFils: 40_000,
        originOn: AMMAN_TODAY,
      }),
    );
    expect(result.outcome).toBe("applied");
    expect(await accountTotal(projectId, "AR")).toBe(40_000);
    expect(await accountTotal(projectId, "OPEN")).toBe(40_000);
    expect(await accountTotal(projectId, "BOX")).toBe(0);
    expect(await accountTotal(projectId, "REV")).toBe(0);
    expect(await accountTotal(projectId, "EXP")).toBe(0);
    const sql = scopedClient();
    try {
      const lines =
        await sql`SELECT direction, kind, counterparty_name FROM balance_line WHERE project_id = ${projectId}`;
      expect(lines.length).toBe(1);
      expect(lines[0]!.direction).toBe("to_me");
      expect(lines[0]!.kind).toBe("prior_receivable");
      expect(lines[0]!.counterparty_name).toBe("سامي");
    } finally {
      await sql.end();
    }
    assertLedgerCoreInvariants(await ledgerState(projectId));
  });
});

/* ── 5. T13 setup half ─────────────────────────────────────────────────── */

describe("M2.5 — prior payable 70 (T13 setup)", () => {
  it("AP 70; OPEN −70; no money moves", async () => {
    const projectId = freshProjectId();
    const owner = nextOwner();
    await seedProjectRow(projectId, owner);
    await runPlan(scopedClient(), () =>
      planSetup({
        projectId,
        createdByAccountId: owner,
        requestId: `req-${crypto.randomUUID()}`,
        projectName: "مشروع",
        today: AMMAN_TODAY,
        boxes: [{ kind: "cash", opening: { openingFils: 0 } }],
      }),
    );
    const result = await runPlan(scopedClient(), () =>
      planAddPriorBalance({
        projectId,
        createdByAccountId: owner,
        requestId: `req-${crypto.randomUUID()}`,
        today: AMMAN_TODAY,
        direction: "by_me",
        counterpartyName: "مورد الأكواب",
        amountFils: 70_000,
        originOn: AMMAN_TODAY,
      }),
    );
    expect(result.outcome).toBe("applied");
    expect(await accountTotal(projectId, "AP")).toBe(70_000);
    expect(await accountTotal(projectId, "OPEN")).toBe(-70_000);
    expect(await accountTotal(projectId, "BOX")).toBe(0);
    assertLedgerCoreInvariants(await ledgerState(projectId));
  });
});

/* ── 6. OP-ADD-BOX ─────────────────────────────────────────────────────── */

describe("M2.5 — OP-ADD-BOX", () => {
  it("adds the account box with a known opening → Q1", async () => {
    const projectId = freshProjectId();
    const owner = nextOwner();
    await seedProjectRow(projectId, owner);
    await runPlan(scopedClient(), () =>
      planSetup({
        projectId,
        createdByAccountId: owner,
        requestId: `req-${crypto.randomUUID()}`,
        projectName: "مشروع",
        today: AMMAN_TODAY,
        boxes: [{ kind: "cash", opening: { openingFils: 50_000 } }],
      }),
    );
    const result = await runPlan(scopedClient(), () =>
      planAddBox({
        projectId,
        createdByAccountId: owner,
        requestId: `req-${crypto.randomUUID()}`,
        today: AMMAN_TODAY,
        kind: "account",
        opening: { openingFils: 25_000 },
      }),
    );
    expect(result.outcome).toBe("applied");
    expect(await boxBalance(projectId, "cash")).toBe(50_000);
    expect(await boxBalance(projectId, "account")).toBe(25_000);
    assertLedgerCoreInvariants(await ledgerState(projectId));
  });

  it("rejects a duplicate kind with E-BOX-LIMIT", async () => {
    const projectId = freshProjectId();
    const owner = nextOwner();
    await seedProjectRow(projectId, owner);
    await runPlan(scopedClient(), () =>
      planSetup({
        projectId,
        createdByAccountId: owner,
        requestId: `req-${crypto.randomUUID()}`,
        projectName: "مشروع",
        today: AMMAN_TODAY,
        boxes: [{ kind: "cash", opening: { openingFils: 0 } }],
      }),
    );
    await expect(
      runPlan(scopedClient(), () =>
        planAddBox({
          projectId,
          createdByAccountId: owner,
          requestId: `req-${crypto.randomUUID()}`,
          today: AMMAN_TODAY,
          kind: "cash",
          opening: { openingFils: 10_000 },
        }),
      ),
    ).rejects.toThrow(/E-BOX-LIMIT/);
  });
});

/* ── 7. Validation ─────────────────────────────────────────────────────── */

describe("M2.5 — OP-SETUP validation", () => {
  it("rejects an empty name and a negative opening", async () => {
    const projectId = freshProjectId();
    const owner = nextOwner();
    await seedProjectRow(projectId, owner);
    await expect(
      runPlan(scopedClient(), () =>
        planSetup({
          projectId,
          createdByAccountId: owner,
          requestId: `req-${crypto.randomUUID()}`,
          projectName: "   ",
          today: AMMAN_TODAY,
          boxes: [{ kind: "cash", opening: { openingFils: 0 } }],
        }),
      ),
    ).rejects.toThrow(/E-NAME-REQUIRED/);
    await expect(
      runPlan(scopedClient(), () =>
        planSetup({
          projectId,
          createdByAccountId: owner,
          requestId: `req-${crypto.randomUUID()}`,
          projectName: "مشروع",
          today: AMMAN_TODAY,
          boxes: [{ kind: "cash", opening: { openingFils: -5 } }],
        }),
      ),
    ).rejects.toThrow(/E-AMOUNT/);
  });
});

/* ── 8. Routes end-to-end ──────────────────────────────────────────────── */

describe("M2.5 — routes /api/manage-v2/*", () => {
  it("OP-SETUP then OP-ADD-PRIOR-BALANCE through the HTTP API", async () => {
    const routeAccount = await signInAs(worker, {
      sub: `m25-route-${Math.random().toString(36).slice(2, 8)}`,
      email: `m25-route-${Math.random().toString(36).slice(2, 8)}@example.com`,
    });
    const setupResponse = await apiPost(worker, routeAccount.cookieHeader, "/api/manage-v2/setup", {
      requestId: `route-${crypto.randomUUID()}`,
      projectName: "مشروع الطريق",
      boxes: [{ kind: "cash", opening: { openingFils: 30_000 } }],
    });
    expect(setupResponse.status).toBe(200);
    const setupBody = (await setupResponse.json()) as { outcome: string };
    expect(setupBody.outcome).toBe("applied");

    const sql = scopedClient();
    let projectId = "";
    try {
      const rows =
        await sql`SELECT id FROM project WHERE name = ${"مشروع الطريق"} ORDER BY created_at DESC LIMIT 1`;
      projectId = String((rows[0] as { id: string }).id);
    } finally {
      await sql.end();
    }
    expect(projectId.length).toBeGreaterThan(0);

    const priorResponse = await apiPost(
      worker,
      routeAccount.cookieHeader,
      "/api/manage-v2/add-prior-balance",
      {
        requestId: `route-${crypto.randomUUID()}`,
        direction: "to_me",
        counterpartyName: "خالد",
        amountFils: 40_000,
      },
    );
    expect(priorResponse.status).toBe(200);
    const priorBody = (await priorResponse.json()) as { outcome: string };
    expect(priorBody.outcome).toBe("applied");

    expect(await accountTotal(projectId, "AR")).toBe(40_000);
    assertLedgerCoreInvariants(await ledgerState(projectId));
  });
});
