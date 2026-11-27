/**
 * M2.5 acceptance (Manage v2 phase 2, wave G — spec §5 OP-SETUP /
 * OP-ADD-BOX / OP-ADD-PRIOR-BALANCE, §4 Q1/Q2/Q3, tests S1-open, T4, T38):
 * the three opening-state operations as pure domain planners + their HTTP
 * routes, composed with the M2.4 handler (the ONE transaction).
 *
 * Real test posture: Miniflare over the per-file isolated PostgreSQL
 * (migrations 0001–0019), resolved through the harness handle (see
 * manage.v2.helpers.ts). Domain planners are exercised through the same
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
 *  8. R-25/T55 — a repeated plan (same request id) replays; R-9 live —
 *     a setup on a project that already has ANY box is E-BOX-LIMIT.
 *  9. Routes /api/manage-v2/* end-to-end (OP-SETUP creates the project and
 *     returns its id; the next operation uses it).
 * Every acceptance path ends with assertLedgerCoreInvariants (INV-1+INV-2).
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { startWorker, apiPost, signInAs, type WorkerInstance } from "./harness.ts";
import {
  accountTotal,
  boxBalance,
  fileSqlUrl,
  ledgerState,
  resultOf,
  runPlan,
  scopedClient,
  seedProjectRow,
} from "./manage.v2.helpers.ts";
import { planSetup } from "../../../../src/domain/manage/operations/setup.js";
import { planAddBox } from "../../../../src/domain/manage/operations/addBox.js";
import { planAddPriorBalance } from "../../../../src/domain/manage/operations/addPriorBalance.js";
import { buildLedgerEntry } from "../../../../src/domain/manage/ledger/index.js";
import { assertLedgerCoreInvariants } from "../../../../src/domain/manage/invariants/index.js";

let worker: WorkerInstance;
let dbUrl = "";
let ownerSeq = 0;

beforeAll(async () => {
  worker = await startWorker();
  dbUrl = await fileSqlUrl(worker);
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

/** A seeded project + the OP-SETUP input every case below starts from. */
async function newProject(boxes: Array<{ kind: "cash" | "account"; opening: Record<string, unknown> }>) {
  const projectId = freshProjectId();
  const owner = nextOwner();
  const sql = scopedClient(dbUrl);
  try {
    await seedProjectRow(sql, projectId, owner);
  } finally {
    await sql.end();
  }
  const setup = () =>
    planSetup({
      projectId,
      createdByAccountId: owner,
      requestId: `setup-${crypto.randomUUID()}`,
      projectName: "مشروع سامي",
      today: AMMAN_TODAY,
      boxes,
    });
  return { projectId, owner, setup };
}

/* ── 1. S1-opening ─────────────────────────────────────────────────────── */

describe("M2.5 S1-opening — OP-SETUP cash 200 + account 100", () => {
  it("writes Q1 per box with known openings, and lists them in the result", async () => {
    const { projectId, setup } = await newProject([
      { kind: "cash", opening: { openingFils: 200_000 } },
      { kind: "account", opening: { openingFils: 100_000 } },
    ]);
    const result = await runPlan(scopedClient(dbUrl), setup);
    expect(resultOf(result, "applied").entryIds.length).toBe(2);
    const sql = scopedClient(dbUrl);
    try {
      expect(await boxBalance(sql, projectId, "cash")).toBe(200_000);
      expect(await boxBalance(sql, projectId, "account")).toBe(100_000);
      expect(await accountTotal(sql, projectId, "OPEN")).toBe(300_000);
      expect(await accountTotal(sql, projectId, "REV")).toBe(0);
      expect(await accountTotal(sql, projectId, "EXP")).toBe(0);
      assertLedgerCoreInvariants(await ledgerState(sql, projectId));
    } finally {
      await sql.end();
    }
  });
});

/* ── 2. Unknown opening ────────────────────────────────────────────────── */

describe("M2.5 T4-setup — OP-SETUP unknown opening", () => {
  it("creates the box with opening_status unknown and NO Q1 entry", async () => {
    const { projectId, setup } = await newProject([{ kind: "cash", opening: { unknown: true } }]);
    const result = await runPlan(scopedClient(dbUrl), setup);
    expect(result.outcome).toBe("applied");
    const sql = scopedClient(dbUrl);
    try {
      const boxes = await sql`SELECT kind, opening_status FROM box WHERE project_id = ${projectId}`;
      expect(boxes.length).toBe(1);
      expect(boxes[0]!.kind).toBe("cash");
      expect(boxes[0]!.opening_status).toBe("unknown");
      const entries = await sql`SELECT count(*)::int AS n FROM ledger_entry WHERE project_id = ${projectId}`;
      expect(Number(entries[0]!.n)).toBe(0);
      assertLedgerCoreInvariants(await ledgerState(sql, projectId));
    } finally {
      await sql.end();
    }
  });

  it("a duplicate explicit amount with unknown is rejected as ambiguous", async () => {
    const { projectId, owner } = await newProject([]);
    await expect(
      runPlan(scopedClient(dbUrl), () =>
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
    const { projectId, owner, setup } = await newProject([{ kind: "cash", opening: { unknown: true } }]);
    await runPlan(scopedClient(dbUrl), setup);
    const result = await runPlan(scopedClient(dbUrl), () =>
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
    const sql = scopedClient(dbUrl);
    try {
      expect(await accountTotal(sql, projectId, "AR")).toBe(40_000);
      expect(await accountTotal(sql, projectId, "OPEN")).toBe(40_000);
      expect(await accountTotal(sql, projectId, "BOX")).toBe(0);
      expect(await accountTotal(sql, projectId, "REV")).toBe(0);
      expect(await accountTotal(sql, projectId, "EXP")).toBe(0);
      const lines =
        await sql`SELECT direction, kind, counterparty_name FROM balance_line WHERE project_id = ${projectId}`;
      expect(lines.length).toBe(1);
      expect(lines[0]!.direction).toBe("to_me");
      expect(lines[0]!.kind).toBe("prior_receivable");
      expect(lines[0]!.counterparty_name).toBe("سامي");
      assertLedgerCoreInvariants(await ledgerState(sql, projectId));
    } finally {
      await sql.end();
    }
  });
});

/* ── 5. T13 setup half ─────────────────────────────────────────────────── */

describe("M2.5 — prior payable 70 (T13 setup)", () => {
  it("AP 70; OPEN −70; no money moves", async () => {
    const { projectId, owner, setup } = await newProject([{ kind: "cash", opening: { openingFils: 0 } }]);
    await runPlan(scopedClient(dbUrl), setup);
    const result = await runPlan(scopedClient(dbUrl), () =>
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
    const sql = scopedClient(dbUrl);
    try {
      expect(await accountTotal(sql, projectId, "AP")).toBe(70_000);
      expect(await accountTotal(sql, projectId, "OPEN")).toBe(-70_000);
      expect(await accountTotal(sql, projectId, "BOX")).toBe(0);
      assertLedgerCoreInvariants(await ledgerState(sql, projectId));
    } finally {
      await sql.end();
    }
  });
});

/* ── 6. OP-ADD-BOX ─────────────────────────────────────────────────────── */

describe("M2.5 — OP-ADD-BOX", () => {
  it("adds the account box with a known opening → Q1", async () => {
    const { projectId, owner, setup } = await newProject([
      { kind: "cash", opening: { openingFils: 50_000 } },
    ]);
    await runPlan(scopedClient(dbUrl), setup);
    const result = await runPlan(scopedClient(dbUrl), () =>
      planAddBox({
        projectId,
        createdByAccountId: owner,
        requestId: `req-${crypto.randomUUID()}`,
        today: AMMAN_TODAY,
        kind: "account",
        opening: { openingFils: 25_000 },
      }),
    );
    expect(resultOf(result, "applied").entryIds.length).toBe(1);
    const sql = scopedClient(dbUrl);
    try {
      expect(await boxBalance(sql, projectId, "cash")).toBe(50_000);
      expect(await boxBalance(sql, projectId, "account")).toBe(25_000);
      assertLedgerCoreInvariants(await ledgerState(sql, projectId));
    } finally {
      await sql.end();
    }
  });

  it("rejects a duplicate kind with E-BOX-LIMIT", async () => {
    const { projectId, owner, setup } = await newProject([{ kind: "cash", opening: { openingFils: 0 } }]);
    await runPlan(scopedClient(dbUrl), setup);
    await expect(
      runPlan(scopedClient(dbUrl), () =>
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
    const { projectId, owner } = await newProject([]);
    await expect(
      runPlan(scopedClient(dbUrl), () =>
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
      runPlan(scopedClient(dbUrl), () =>
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

/* ── 8. T55 / R-9 ──────────────────────────────────────────────────────── */

describe("M2.5 — a repeated setup and the R-9 live check", () => {
  it("replays the first operation when the same request id is planned again", async () => {
    const { projectId, owner } = await newProject([]);
    const requestId = `setup-${crypto.randomUUID()}`;
    const plan = () =>
      planSetup({
        projectId,
        createdByAccountId: owner,
        requestId,
        projectName: "مشروع سامي",
        today: AMMAN_TODAY,
        boxes: [{ kind: "cash", opening: { openingFils: 30_000 } }],
      });
    const first = resultOf(await runPlan(scopedClient(dbUrl), plan), "applied");
    // The second planning generates a different box id; the intent is the
    // same request.
    const again = resultOf(await runPlan(scopedClient(dbUrl), plan), "replay");
    expect(again.operationId).toBe(first.operationId);
    const sql = scopedClient(dbUrl);
    try {
      const ops = await sql`SELECT count(*)::int AS n FROM operation WHERE project_id = ${projectId}`;
      expect(Number(ops[0]!.n)).toBe(1);
      assertLedgerCoreInvariants(await ledgerState(sql, projectId));
    } finally {
      await sql.end();
    }
  });

  it("rejects a setup on a project that already has any box (E-BOX-LIMIT)", async () => {
    const { projectId, owner, setup } = await newProject([
      { kind: "cash", opening: { openingFils: 20_000 } },
    ]);
    await runPlan(scopedClient(dbUrl), setup);
    // Even a setup asking only for the MISSING kind: a project with a box
    // is initialized, and OP-ADD-BOX is the operation that adds a box.
    await expect(
      runPlan(scopedClient(dbUrl), () =>
        planSetup({
          projectId,
          createdByAccountId: owner,
          requestId: `req-${crypto.randomUUID()}`,
          projectName: "مشروع سامي",
          today: AMMAN_TODAY,
          boxes: [{ kind: "account", opening: { openingFils: 10_000 } }],
        }),
      ),
    ).rejects.toThrow(/E-BOX-LIMIT/);
    const sql = scopedClient(dbUrl);
    try {
      const boxes = await sql`SELECT kind FROM box WHERE project_id = ${projectId}`;
      expect(boxes.map(b => b.kind)).toEqual(["cash"]);
    } finally {
      await sql.end();
    }
  });
});

/* ── 9. Routes end-to-end ──────────────────────────────────────────────── */

describe("M2.5 — routes /api/manage-v2/*", () => {
  it("OP-SETUP then OP-ADD-PRIOR-BALANCE through the HTTP API", async () => {
    const session = await signInAs(worker, {
      sub: `m25-route-${Math.random().toString(36).slice(2, 8)}`,
      email: `m25-route-${Math.random().toString(36).slice(2, 8)}@example.com`,
    });
    const setupResponse = await apiPost(worker, session.cookieHeader, "/api/manage-v2/setup", {
      requestId: `route-${crypto.randomUUID()}`,
      projectName: "مشروع الطريق",
      boxes: [{ kind: "cash", opening: { openingFils: 30_000 } }],
    });
    expect(setupResponse.status).toBe(200);
    // The setup response carries the project id the account now owns.
    const setupBody = (await setupResponse.json()) as { outcome: string; projectId: string };
    expect(setupBody.outcome).toBe("applied");
    const projectId = setupBody.projectId;
    expect(projectId.length).toBeGreaterThan(0);

    const priorResponse = await apiPost(worker, session.cookieHeader, "/api/manage-v2/add-prior-balance", {
      requestId: `route-${crypto.randomUUID()}`,
      direction: "to_me",
      counterpartyName: "خالد",
      amountFils: 40_000,
    });
    expect(priorResponse.status).toBe(200);
    const priorBody = (await priorResponse.json()) as { outcome: string };
    expect(priorBody.outcome).toBe("applied");

    const sql = scopedClient(dbUrl);
    try {
      expect(await accountTotal(sql, projectId, "AR")).toBe(40_000);
      const owners = await sql`SELECT owner_account_id FROM project WHERE id = ${projectId}`;
      expect(owners.length).toBe(1);
      assertLedgerCoreInvariants(await ledgerState(sql, projectId));
    } finally {
      await sql.end();
    }
  });
});
