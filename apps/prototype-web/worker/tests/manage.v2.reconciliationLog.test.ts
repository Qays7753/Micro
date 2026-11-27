/**
 * M4.5 acceptance (Manage v2 phase 4 — spec §3.10 the reconciliation log,
 * R-8 the reconciliation-due rule): the reconciliation LOG read surface —
 * the history of every saved reconciliation with its per-box
 * recorded/counted, newest first, plus R-8's `due` flag computed
 * server-side (the screens consume the response as-is):
 *
 * R-8: "Reconciliation due: ≥7 days since last reconciliation (or project
 * creation) and ≥1 money operation since then. A money operation = any
 * operation with at least one BOX posting."
 *
 * The anchor = the last reconciliation's performed_on, else the project's
 * creation day. "Since then" is DATE-granular (the rule's own granularity):
 * an operation created the anchor's own day is not "since" — which
 * naturally excludes the OP-SETUP at project creation and the
 * reconciliation operation itself.
 *
 * The log covers the three contexts (§3.10's CHECK): routine
 * (M4.2), return_after_absence (M4.3), first_unknown_opening (M4.4) —
 * including the unknown box's server-computed recorded value.
 *
 * Tests-first: the first run fails on the not-yet-existing module.
 *
 * Posture: Miniflare over the per-file isolated PostgreSQL. Money is
 * integer fils. Every path that builds a live state ends with
 * assertLedgerCoreInvariants (INV-1 + INV-2).
 */
import type postgres from "postgres";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { apiGet, apiPost, signInAs, startWorker, type WorkerInstance } from "./harness.ts";
import {
  fileSqlUrl,
  ledgerState,
  resultOf,
  runPlan,
  scopedClient,
  setupProject,
} from "./manage.v2.helpers.ts";
import { planExpense } from "../../../../src/domain/manage/operations/expense.js";
import { planSaleCreate } from "../../../../src/domain/manage/operations/saleCreate.js";
import { planReconcile } from "../../../../src/domain/manage/operations/reconcile.js";
import { readReconciliationLog } from "../application/manage/reconciliationLog.js";
import { assertLedgerCoreInvariants } from "../../../../src/domain/manage/invariants/index.js";

let worker: WorkerInstance;
let dbUrl = "";

beforeAll(async () => {
  worker = await startWorker();
  dbUrl = await fileSqlUrl(worker);
});

afterAll(async () => {
  await worker.close();
});

const AMMAN_TODAY = "2026-11-27";
/** A "today" 8 days later — past R-8's 7-day threshold. */
const EIGHT_DAYS_LATER = "2026-12-05";

function suffix(): string {
  return Math.random().toString(36).slice(2, 10);
}

/** date + n days (both 'YYYY-MM-DD'). */
function datePlus(date: string, days: number): string {
  const day = 86_400_000;
  return new Date(Date.parse(`${date}T00:00:00Z`) + days * day).toISOString().slice(0, 10);
}

/** The project's actual creation day (created_at is the REAL clock — the
 * due dates must be relative to it, never to the test's fixed today). */
async function createdDay(sql: postgres.Sql, projectId: string): Promise<string> {
  const rows = (await sql`SELECT created_at::text AS created_at FROM project
                            WHERE id = ${projectId}`) as Array<{ created_at: string }>;
  return String(rows[0]!.created_at).slice(0, 10);
}

async function withSql<T>(run: (sql: postgres.Sql) => Promise<T>): Promise<T> {
  const sql = scopedClient(dbUrl);
  try {
    return await run(sql);
  } finally {
    await sql.end();
  }
}

interface Ctx {
  projectId: string;
  owner: string;
}

async function newProject(openingFils: number, owner = "m45"): Promise<Ctx> {
  const projectId = crypto.randomUUID();
  const account = `${owner}-owner-${suffix()}`;
  await withSql(sql =>
    setupProject(sql, {
      projectId,
      owner: account,
      today: AMMAN_TODAY,
      boxes: [{ kind: "cash", opening: { openingFils } }],
    }),
  );
  return { projectId, owner: account };
}

async function routineReconcile(
  sql: postgres.Sql,
  ctx: Ctx,
  counted: number,
  recorded: number,
): Promise<void> {
  await runPlan(sql, () =>
    planReconcile({
      projectId: ctx.projectId,
      createdByAccountId: ctx.owner,
      requestId: `m45-${crypto.randomUUID()}`,
      today: AMMAN_TODAY,
      context: "routine",
      boxes: [{ box: "cash", countedFils: counted, recordedAtStartFils: recorded }],
    }),
  );
}

/* ── 1. The log's shape across the contexts ───────────────────────────── */

describe("M4.5 — the reconciliation log", () => {
  it("lists the reconciliations newest first with their per-box recorded/counted", async () => {
    const ctx = await newProject(340_000);
    await withSql(async sql => {
      // Two routine reconciliations (S7-like then a clean one).
      await runPlan(sql, () =>
        planExpense({
          projectId: ctx.projectId,
          createdByAccountId: ctx.owner,
          requestId: `m45-${crypto.randomUUID()}`,
          today: AMMAN_TODAY,
          amountFils: 25_000,
          category: "utilities",
          payment: { type: "full" },
          source: "cash",
        }),
      );
      await routineReconcile(sql, ctx, 300_000, 340_000); // Q19 −15… no: −15? (305 → 300)
      await routineReconcile(sql, ctx, 300_000, 300_000); // clean, no Q19

      const log = await readReconciliationLog(sql, ctx.projectId, AMMAN_TODAY);
      expect(log.reconciliations).toHaveLength(2);
      // Newest first: the clean one is the latest.
      expect(log.reconciliations[0]).toMatchObject({
        performedOn: AMMAN_TODAY,
        context: "routine",
      });
      expect(log.reconciliations[0]!.boxes).toHaveLength(1);
      expect(log.reconciliations[0]!.boxes[0]).toMatchObject({
        kind: "cash",
        recordedFils: 300_000,
        countedFils: 300_000,
      });
      expect(log.reconciliations[1]!.boxes[0]).toMatchObject({
        kind: "cash",
        recordedFils: 340_000,
        countedFils: 300_000,
      });

      await assertLedgerCoreInvariants(await ledgerState(sql, ctx.projectId));
    });
  });

  it("carries the first_unknown_opening context and the server-computed recorded (T4's shape)", async () => {
    const projectId = crypto.randomUUID();
    const owner = `m45-unk-${suffix()}`;
    await withSql(sql =>
      setupProject(sql, {
        projectId,
        owner,
        today: AMMAN_TODAY,
        boxes: [{ kind: "cash", opening: { unknown: true } }],
      }),
    );
    await withSql(async sql => {
      // A money operation so the box has postings, then the first
      // reconciliation (T4-like: postings +100, counted 300 → Q1 200).
      await runPlan(sql, () =>
        planExpense({
          projectId,
          createdByAccountId: owner,
          requestId: `m45-${crypto.randomUUID()}`,
          today: AMMAN_TODAY,
          amountFils: 100_000,
          category: "materials_packaging",
          payment: { type: "full" },
          source: "cash",
        }),
      );
      await runPlan(sql, () =>
        planReconcile({
          projectId,
          createdByAccountId: owner,
          requestId: `m45-${crypto.randomUUID()}`,
          today: AMMAN_TODAY,
          context: "first_unknown_opening",
          boxes: [{ box: "cash", countedFils: 0, recordedAtStartFils: null }],
        }),
      );

      const log = await readReconciliationLog(sql, projectId, AMMAN_TODAY);
      expect(log.reconciliations).toHaveLength(1);
      expect(log.reconciliations[0]).toMatchObject({
        context: "first_unknown_opening",
        performedOn: AMMAN_TODAY,
      });
      // The unknown box's recorded = the server's pre-operation Σ postings
      // (−100: the expense's BOX posting) — not any client claim.
      expect(log.reconciliations[0]!.boxes[0]).toMatchObject({
        kind: "cash",
        recordedFils: -100_000,
        countedFils: 0,
      });

      await assertLedgerCoreInvariants(await ledgerState(sql, projectId));
    });
  });
});

/* ── 2. R-8's due rule ────────────────────────────────────────────────── */

describe("M4.5 — R-8's reconciliation-due rule", () => {
  it("is not due on a fresh project, nor without a money operation, nor before 7 days", async () => {
    const ctx = await newProject(100_000);
    await withSql(async sql => {
      // Same day: not due (0 days).
      const day0 = await readReconciliationLog(sql, ctx.projectId, AMMAN_TODAY);
      expect(day0.due).toBe(false);
      // 8 days later, still no money operation (the setup is ON the
      // project's creation day — not "since"): not due.
      const day8 = await readReconciliationLog(sql, ctx.projectId, EIGHT_DAYS_LATER);
      expect(day8.due).toBe(false);

      // A NON-money operation (a sale create posts nothing to BOX) does
      // not arm the reminder either.
      await runPlan(sql, () =>
        planSaleCreate({
          projectId: ctx.projectId,
          createdByAccountId: ctx.owner,
          requestId: `m45-${crypto.randomUUID()}`,
          today: AMMAN_TODAY,
          lines: [{ description: "طلب", quantityMilli: 1000, unitPriceFils: 50_000 }],
          plannedDeliveryOn: "2026-12-01",
          finalPriceFils: 50_000,
          customerName: "سامي",
        }),
      );
      const withSale = await readReconciliationLog(sql, ctx.projectId, EIGHT_DAYS_LATER);
      expect(withSale.due).toBe(false);
    });
  });

  it("is due 7+ days after the project creation once a money operation exists", async () => {
    const ctx = await newProject(100_000);
    await withSql(async sql => {
      await runPlan(sql, () =>
        planExpense({
          projectId: ctx.projectId,
          createdByAccountId: ctx.owner,
          requestId: `m45-${crypto.randomUUID()}`,
          today: AMMAN_TODAY,
          amountFils: 20_000,
          category: "gas",
          payment: { type: "full" },
          source: "cash",
        }),
      );
      const created = await createdDay(sql, ctx.projectId);
      const day3 = await readReconciliationLog(sql, ctx.projectId, datePlus(created, 3));
      expect(day3.due).toBe(false); // 3 days < 7
      const day7 = await readReconciliationLog(sql, ctx.projectId, datePlus(created, 7));
      expect(day7.due).toBe(true); // 7 days + a money operation

      await assertLedgerCoreInvariants(await ledgerState(sql, ctx.projectId));
    });
  });

  it("resets on the reconciliation and re-arms only with 7 days AND a new money operation", async () => {
    const ctx = await newProject(340_000);
    await withSql(async sql => {
      // A money operation, then a reconciliation (the anchor moves to it).
      await runPlan(sql, () =>
        planExpense({
          projectId: ctx.projectId,
          createdByAccountId: ctx.owner,
          requestId: `m45-${crypto.randomUUID()}`,
          today: AMMAN_TODAY,
          amountFils: 40_000,
          category: "gas",
          payment: { type: "full" },
          source: "cash",
        }),
      );
      await routineReconcile(sql, ctx, 300_000, 300_000);

      // 8 days after the reconciliation, but NO money operation since it
      // (the earlier expense was created BEFORE the reconciliation): not due.
      const noOp = await readReconciliationLog(sql, ctx.projectId, EIGHT_DAYS_LATER);
      expect(noOp.due).toBe(false);

      // A new money operation arms it again — but only after 7 days.
      await runPlan(sql, () =>
        planExpense({
          projectId: ctx.projectId,
          createdByAccountId: ctx.owner,
          requestId: `m45-${crypto.randomUUID()}`,
          today: "2026-12-01",
          amountFils: 10_000,
          category: "gas",
          payment: { type: "full" },
          source: "cash",
        }),
      );
      const day5 = await readReconciliationLog(sql, ctx.projectId, "2026-12-02");
      expect(day5.due).toBe(false); // 5 days after the reconciliation
      const day8 = await readReconciliationLog(sql, ctx.projectId, EIGHT_DAYS_LATER);
      expect(day8.due).toBe(true); // 8 days + a money operation since

      await assertLedgerCoreInvariants(await ledgerState(sql, ctx.projectId));
    });
  });
});

/* ── 3. The route ─────────────────────────────────────────────────────── */

describe("M4.5 — GET /api/manage-v2/reconciliations", () => {
  it("serves the log project-scoped (200; a foreign account gets the unified 404)", async () => {
    const sub = `m45-route-${suffix()}`;
    const session = await signInAs(worker, { sub, email: `${sub}@example.com` });
    const setup = await apiPost(worker, session.cookieHeader, "/api/manage-v2/setup", {
      requestId: `m45-${crypto.randomUUID()}`,
      projectName: "مشروع السجل",
      boxes: [{ kind: "cash", opening: { openingFils: 340_000 } }],
    });
    expect(setup.status).toBe(200);
    const projectId = ((await setup.json()) as { projectId: string }).projectId;

    const response = await apiGet(worker, session.cookieHeader, "/api/manage-v2/reconciliations");
    expect(response.status).toBe(200);
    const body = (await response.json()) as {
      due: boolean;
      reconciliations: unknown[];
    };
    expect(typeof body.due).toBe("boolean");
    expect(body.reconciliations).toEqual([]);

    // R-24: a signed-in account without a project is indistinguishable
    // from "no such project".
    const otherSub = `m45-other-${suffix()}`;
    const other = await signInAs(worker, { sub: otherSub, email: `${otherSub}@example.com` });
    const foreign = await apiGet(worker, other.cookieHeader, "/api/manage-v2/reconciliations");
    expect(foreign.status).toBe(404);
  });
});
