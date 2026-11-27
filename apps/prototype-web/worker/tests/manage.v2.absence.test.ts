/**
 * M4.3 acceptance (Manage v2 phase 4 — spec §7.2 OP-RETURN-AFTER-ABSENCE;
 * tests T33, T58): the absence detection, the return flow's reconcile
 * context, and the completeness rule.
 *
 * §7.2-1 (detection): on app open, if the last operation's created_at is
 * ≥ 14 days before today, record `absence_event` (started_on = the last
 * operation's date, ended_on = today, complete NULL). An already-open
 * event EXTENDS (ended_on = today) instead of duplicating — the card
 * stays until the flow is finished.
 *
 * §7.2-4/5 (the return reconcile): OP-RECONCILE with context
 * `return_after_absence` — same Q19 computation, and the open event's
 * `complete` is set by the rule: true iff the reconciliation ended with
 * all Δ = 0 at step 1 (counted = recorded at start for every box) AND no
 * Q19 was posted; else false. Deliveries, cancellations and collections
 * answered in steps 2–3 run BEFORE the recorded is read, so they never
 * break completeness (proven below with a real step-2 delivery).
 *
 * T33 — absence 20 days; return reconciliation all matched, no answers →
 * complete = true; no incomplete flag.
 * T58 — absence detected, the card left unstarted / «لاحقاً» → periods
 * overlapping the absence show «بيانات غير مكتملة» (flags.incompletePeriod
 * and the overlapping profit bars).
 *
 * Given-state seeding (the documented pattern): the 14-day condition
 * reads created_at, which no operation sets explicitly — the "absence"
 * given-state seeds the last operation's created_at directly.
 *
 * Tests-first: this file was written before the surfaces existed and
 * fails with "detectAbsence is not a function".
 *
 * Posture: Miniflare over the per-file isolated PostgreSQL. Money is
 * integer fils. Every acceptance path ends with assertLedgerCoreInvariants
 * (INV-1 + INV-2).
 */
import type postgres from "postgres";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { apiPost, signInAs, startWorker, type WorkerInstance } from "./harness.ts";
import {
  boxBalance,
  fileSqlUrl,
  ledgerState,
  resultOf,
  runPlan,
  scopedClient,
  setupProject,
} from "./manage.v2.helpers.ts";
import { planSaleCreate } from "../../../../src/domain/manage/operations/saleCreate.js";
import { planDeliver } from "../../../../src/domain/manage/operations/deliver.js";
import { planExpense } from "../../../../src/domain/manage/operations/expense.js";
import { planReconcile } from "../../../../src/domain/manage/operations/reconcile.js";
import { detectAbsence } from "../application/manage/absence.js";
import { computeManageFigures } from "../application/manage/readModel.js";
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
/** The last operation's seeded day: 20 days of absence (T33). */
const LAST_OP_DAY = "2026-11-07";

function suffix(): string {
  return Math.random().toString(36).slice(2, 10);
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

/** A one-cash-box project, then the absence given-state: the LAST
 * operation's created_at moved back (no operation sets created_at). */
async function absentProject(openingFils = 100_000): Promise<Ctx> {
  const projectId = crypto.randomUUID();
  const owner = `m43-owner-${suffix()}`;
  await withSql(sql =>
    setupProject(sql, {
      projectId,
      owner,
      today: AMMAN_TODAY,
      boxes: [{ kind: "cash", opening: { openingFils } }],
    }),
  );
  await withSql(
    sql =>
      sql`UPDATE operation SET created_at = ${`${LAST_OP_DAY} 10:00:00+00`}::timestamptz
         WHERE project_id = ${projectId}`,
  );
  return { projectId, owner };
}

/** The return flow's reconcile (context return_after_absence). */
async function returnReconcile(
  sql: postgres.Sql,
  ctx: Ctx,
  boxes: Array<{ box: "cash" | "account"; countedFils: number; recordedAtStartFils: number }>,
): Promise<ReturnType<typeof resultOf>> {
  return resultOf(
    await runPlan(sql, () =>
      planReconcile({
        projectId: ctx.projectId,
        createdByAccountId: ctx.owner,
        requestId: `m43-${crypto.randomUUID()}`,
        today: AMMAN_TODAY,
        context: "return_after_absence",
        boxes,
      }),
    ),
    "applied",
  );
}

async function absenceRows(sql: postgres.Sql, ctx: Ctx) {
  return (await sql`SELECT id, started_on::text AS started_on, ended_on::text AS ended_on, complete
                      FROM absence_event WHERE project_id = ${ctx.projectId}
                      ORDER BY started_on`) as Array<{
    id: string;
    started_on: string;
    ended_on: string;
    complete: boolean | null;
  }>;
}

/* ── 1. T33: the matched return reconciliation completes the absence ──── */

describe("M4.3 T33 — absence 20 days; return reconciliation all matched", () => {
  it("detects the event, completes it true, and clears the incomplete flag", async () => {
    const ctx = await absentProject(100_000);
    await withSql(async sql => {
      // §7.2-1: the detection records the absence.
      const detected = await detectAbsence(sql, { projectId: ctx.projectId, today: AMMAN_TODAY });
      expect(detected).toMatchObject({
        startedOn: LAST_OP_DAY,
        endedOn: AMMAN_TODAY,
        complete: null,
      });

      // T58's first half: while the card sits unstarted, the overlapping
      // periods are marked incomplete.
      const before = await computeManageFigures(sql, ctx.projectId, AMMAN_TODAY, "since_start");
      expect(before.flags.incompletePeriod).toBe(true);

      // The return flow: no overdue sales, no open lines → P-50 → all
      // matched → «التالي» saves the reconciliation (no Q19, no answers).
      const result = await returnReconcile(sql, ctx, [
        { box: "cash", countedFils: 100_000, recordedAtStartFils: 100_000 },
      ]);
      expect(result.entryIds).toHaveLength(0);

      // T33: complete = true; no incomplete flag.
      const events = await absenceRows(sql, ctx);
      expect(events).toHaveLength(1);
      expect(events[0]).toMatchObject({ complete: true, started_on: LAST_OP_DAY, ended_on: AMMAN_TODAY });
      const after = await computeManageFigures(sql, ctx.projectId, AMMAN_TODAY, "since_start");
      expect(after.flags.incompletePeriod).toBe(false);

      // The reconciliation row carries the return context.
      const recon = (await sql`SELECT context, performed_on::text AS performed_on
                                 FROM reconciliation WHERE project_id = ${ctx.projectId}`) as Array<{
        context: string;
        performed_on: string;
      }>;
      expect(recon[0]).toMatchObject({ context: "return_after_absence", performed_on: AMMAN_TODAY });

      await assertLedgerCoreInvariants(await ledgerState(sql, ctx.projectId));
    });
  });

  it("a step-2 delivery answered in the flow does NOT break completeness", async () => {
    const ctx = await absentProject(100_000);
    await withSql(async sql => {
      // An overdue sale created before the absence (planned 20/11).
      const outcome = await runPlan(sql, () =>
        planSaleCreate({
          projectId: ctx.projectId,
          createdByAccountId: ctx.owner,
          requestId: `m43-${crypto.randomUUID()}`,
          today: "2026-11-07",
          lines: [{ description: "طلب", quantityMilli: 1000, unitPriceFils: 50_000 }],
          plannedDeliveryOn: "2026-11-20",
          finalPriceFils: 50_000,
          customerName: "سامي",
        }),
      );
      const saleId = String((resultOf(outcome, "applied").data as { saleId: string }).saleId);
      // The sale's operation is now the last one — keep the absence state.
      await sql`UPDATE operation SET created_at = ${`${LAST_OP_DAY} 11:00:00+00`}::timestamptz
                 WHERE project_id = ${ctx.projectId} AND kind = 'OP-SALE-CREATE'`;

      const detected = await detectAbsence(sql, { projectId: ctx.projectId, today: AMMAN_TODAY });
      expect(detected).not.toBeNull();

      // Step 2 (P-12): [تم التسليم] — a real OP-DELIVER, no collection.
      await runPlan(sql, () =>
        planDeliver({
          projectId: ctx.projectId,
          createdByAccountId: ctx.owner,
          requestId: `m43-${crypto.randomUUID()}`,
          today: AMMAN_TODAY,
          saleId,
        }),
      );
      // The recorded read at P-50 already includes the delivery's effect
      // (cash unchanged by this delivery; the remainder is a receivable).
      expect(await boxBalance(sql, ctx.projectId, "cash")).toBe(100_000);

      // All matched → complete = true (§7.2-5: steps 2–3 never break it).
      await returnReconcile(sql, ctx, [{ box: "cash", countedFils: 100_000, recordedAtStartFils: 100_000 }]);
      const events = await absenceRows(sql, ctx);
      expect(events[0]!.complete).toBe(true);

      await assertLedgerCoreInvariants(await ledgerState(sql, ctx.projectId));
    });
  });
});

/* ── 2. T58: the unstarted card keeps the period incomplete ───────────── */

describe("M4.3 T58 — the card left unstarted / «لاحقاً»", () => {
  it("keeps complete NULL and marks every overlapping period incomplete", async () => {
    const ctx = await absentProject(100_000);
    await withSql(async sql => {
      await detectAbsence(sql, { projectId: ctx.projectId, today: AMMAN_TODAY });
      // The user leaves the card unstarted (or taps «لاحقاً») — the event
      // stays open and the overlapping periods show «بيانات غير مكتملة».
      const events = await absenceRows(sql, ctx);
      expect(events[0]!.complete).toBeNull();

      const since = await computeManageFigures(sql, ctx.projectId, AMMAN_TODAY, "since_start");
      expect(since.flags.incompletePeriod).toBe(true);
      const month = await computeManageFigures(sql, ctx.projectId, AMMAN_TODAY, "month");
      expect(month.flags.incompletePeriod).toBe(true);
      // The overlapping profit bars carry the flag too (§8 profit bars).
      expect(since.bars.some(bar => bar.incomplete)).toBe(true);

      // A re-detection the same day is a no-op (one event, no duplicate).
      const again = await detectAbsence(sql, { projectId: ctx.projectId, today: AMMAN_TODAY });
      expect(await absenceRows(sql, ctx)).toHaveLength(1);
      expect(again?.endedOn).toBe(AMMAN_TODAY);

      // A later re-detection EXTENDS the open event (ended_on = the new
      // today) instead of duplicating it.
      const extended = await detectAbsence(sql, { projectId: ctx.projectId, today: "2026-11-28" });
      expect(extended).toMatchObject({ startedOn: LAST_OP_DAY, endedOn: "2026-11-28", complete: null });
      expect(await absenceRows(sql, ctx)).toHaveLength(1);

      await assertLedgerCoreInvariants(await ledgerState(sql, ctx.projectId));
    });
  });

  it("does not detect an absence when the user was recently active", async () => {
    const projectId = crypto.randomUUID();
    const owner = `m43-active-${suffix()}`;
    await withSql(sql =>
      setupProject(sql, {
        projectId,
        owner,
        today: AMMAN_TODAY,
        boxes: [{ kind: "cash", opening: { openingFils: 50_000 } }],
      }),
    );
    await withSql(async sql => {
      const detected = await detectAbsence(sql, { projectId, today: AMMAN_TODAY });
      expect(detected).toBeNull();
      const events = (await sql`SELECT 1 FROM absence_event WHERE project_id = ${projectId}`) as unknown[];
      expect(events).toHaveLength(0);
    });
  });
});

/* ── 3. The completeness rule's false branches ────────────────────────── */

describe("M4.3 — complete = false branches", () => {
  it("a Q19 posted at the finish makes it false", async () => {
    const ctx = await absentProject(340_000);
    await withSql(async sql => {
      await detectAbsence(sql, { projectId: ctx.projectId, today: AMMAN_TODAY });
      // Counted 300 against a recorded 340, no answers → Q19 −40.
      const result = await returnReconcile(sql, ctx, [
        { box: "cash", countedFils: 300_000, recordedAtStartFils: 340_000 },
      ]);
      expect(result.entryIds).toHaveLength(1);
      const events = await absenceRows(sql, ctx);
      expect(events[0]!.complete).toBe(false);
      // The period stays marked incomplete (complete !== true).
      const figures = await computeManageFigures(sql, ctx.projectId, AMMAN_TODAY, "since_start");
      expect(figures.flags.incompletePeriod).toBe(true);

      await assertLedgerCoreInvariants(await ledgerState(sql, ctx.projectId));
    });
  });

  it("answers that close the difference exactly still make it false (no Q19)", async () => {
    const ctx = await absentProject(340_000);
    await withSql(async sql => {
      await detectAbsence(sql, { projectId: ctx.projectId, today: AMMAN_TODAY });
      // Δ −40 answered with an expense of 40 (a difference-question
      // answer): the finish posts NO Q19, but counted ≠ recorded-at-start.
      await runPlan(sql, () =>
        planExpense({
          projectId: ctx.projectId,
          createdByAccountId: ctx.owner,
          requestId: `m43-${crypto.randomUUID()}`,
          today: AMMAN_TODAY,
          amountFils: 40_000,
          category: "utilities",
          payment: { type: "full" },
          source: "cash",
        }),
      );
      expect(await boxBalance(sql, ctx.projectId, "cash")).toBe(300_000);
      const result = await returnReconcile(sql, ctx, [
        { box: "cash", countedFils: 300_000, recordedAtStartFils: 340_000 },
      ]);
      expect(result.entryIds).toHaveLength(0);
      const events = await absenceRows(sql, ctx);
      expect(events[0]!.complete).toBe(false);

      await assertLedgerCoreInvariants(await ledgerState(sql, ctx.projectId));
    });
  });

  it("rejects the return context when no open absence event exists (E-AMOUNT)", async () => {
    const projectId = crypto.randomUUID();
    const owner = `m43-noevent-${suffix()}`;
    await withSql(sql =>
      setupProject(sql, {
        projectId,
        owner,
        today: AMMAN_TODAY,
        boxes: [{ kind: "cash", opening: { openingFils: 50_000 } }],
      }),
    );
    await withSql(async sql => {
      await expect(
        runPlan(sql, () =>
          planReconcile({
            projectId,
            createdByAccountId: owner,
            requestId: `m43-${crypto.randomUUID()}`,
            today: AMMAN_TODAY,
            context: "return_after_absence",
            boxes: [{ box: "cash", countedFils: 50_000, recordedAtStartFils: 50_000 }],
          }),
        ),
      ).rejects.toMatchObject({ code: "E-AMOUNT" });
    });
  });
});

/* ── 4. R-25 replay and the HTTP route ────────────────────────────────── */

describe("M4.3 — R-25 replay and the absence-detect route", () => {
  it("replays a retried return reconcile byte-identically (one event, complete set once)", async () => {
    const ctx = await absentProject(100_000);
    await withSql(async sql => {
      await detectAbsence(sql, { projectId: ctx.projectId, today: AMMAN_TODAY });
      const requestId = `m43-retry-${suffix()}`;
      const make = () =>
        planReconcile({
          projectId: ctx.projectId,
          createdByAccountId: ctx.owner,
          requestId,
          today: AMMAN_TODAY,
          context: "return_after_absence",
          boxes: [{ box: "cash", countedFils: 100_000, recordedAtStartFils: 100_000 }],
        });
      const first = await runPlan(sql, make);
      const retry = await runPlan(sql, make);
      expect(first.outcome).toBe("applied");
      expect(retry.outcome).toBe("replay");
      expect((retry as { result: unknown }).result).toEqual((first as { result: unknown }).result);
      const events = await absenceRows(sql, ctx);
      expect(events).toHaveLength(1);
      expect(events[0]!.complete).toBe(true);

      await assertLedgerCoreInvariants(await ledgerState(sql, ctx.projectId));
    });
  });

  it("serves /absence-detect over HTTP: 200 with the event (or null)", async () => {
    const sub = `m43-route-${suffix()}`;
    const session = await signInAs(worker, { sub, email: `${sub}@example.com` });
    const setup = await apiPost(worker, session.cookieHeader, "/api/manage-v2/setup", {
      requestId: `m43-${crypto.randomUUID()}`,
      projectName: "مشروع الانقطاع",
      boxes: [{ kind: "cash", opening: { openingFils: 100_000 } }],
    });
    expect(setup.status).toBe(200);
    const projectId = ((await setup.json()) as { projectId: string }).projectId;

    // Recently active → null.
    const none = await apiPost(worker, session.cookieHeader, "/api/manage-v2/absence-detect", {
      requestId: `m43-${crypto.randomUUID()}`,
      projectId,
    });
    expect(none.status).toBe(200);
    expect(((await none.json()) as { absence: unknown }).absence).toBeNull();

    // Seed the absence given-state through the worker's DB, then detect.
    await withSql(async sql => {
      await sql`UPDATE operation SET created_at = ${`${LAST_OP_DAY} 10:00:00+00`}::timestamptz
                 WHERE project_id = ${projectId}`;
    });
    const detected = await apiPost(worker, session.cookieHeader, "/api/manage-v2/absence-detect", {
      requestId: `m43-${crypto.randomUUID()}`,
      projectId,
    });
    expect(detected.status).toBe(200);
    expect(((await detected.json()) as { absence: { startedOn: string } }).absence).toMatchObject({
      startedOn: LAST_OP_DAY,
      endedOn: expect.any(String),
    });
  });
});
