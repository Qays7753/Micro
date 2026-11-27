/**
 * M4.4 acceptance (Manage v2 phase 4 — spec §7.3 unknown opening balance;
 * tests T4, T28): the FIRST reconciliation of a box with an unknown
 * opening, through the real operations.
 *
 * §7.3: `computed_opening = counted − Σ(BOX[k] postings since start)`
 * (= counted − the current balance — the whole history is the box's).
 *  - > 0 → Q1(computed_opening) effective on the box's created_on; no
 *    questions; no Q19 (the Q1 lifts the balance exactly to the count).
 *  - = 0 → nothing at all (a zero posting is forbidden by §3.8 — the
 *    setup precedent: an opening of 0 posts no Q1 row).
 *  - < 0 → the opening is 0 (no Q1 row) and the remaining negative Δ
 *    flows through §7.1's questions and Q19 — computing at the finish
 *    (after the answers) yields the IDENTICAL final state to computing
 *    at «التالي»: the opening is 0 either way, and the answer operations
 *    only shift the split between UNEXP and their own accounts (T28:
 *    computed −400 pre-answer or −100 post-answer both end at opening 0,
 *    Q12 300, Q19 −100, cash 40).
 * Then `opening_status = known` — the unknown display and the incomplete
 * flag clear (T4).
 *
 * T4 — setup cash unknown; sale 100 collected; expense 40; counted 260 →
 * Q1 = 200 on created_on; profit 60; net worth 260; flag cleared; UNEXP 0.
 * T28 — setup cash unknown; sale 500; expense 60; counted 40; answer
 * «withdrawal 300»; finish → Q1 0 (no row); Q12 300; Q19 −100; profit
 * 440; net worth 40.
 *
 * Input contract (M4.4): a box with an unknown opening has NO recorded
 * value to pass — `recordedAtStartFils` must be NULL for it (and a
 * number for every known box); the server stores its own honest
 * pre-operation Σ postings as that box's recorded_minor.
 *
 * Tests-first: the first run fails on the not-yet-extended planner.
 *
 * Posture: Miniflare over the per-file isolated PostgreSQL. Money is
 * integer fils. Every acceptance path ends with assertLedgerCoreInvariants
 * (INV-1 + INV-2).
 */
import type postgres from "postgres";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { apiPost, signInAs, startWorker, type WorkerInstance } from "./harness.ts";
import {
  accountTotal,
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
import { planOwnerWithdrawal } from "../../../../src/domain/manage/operations/ownerMoney.js";
import { planReconcile } from "../../../../src/domain/manage/operations/reconcile.js";
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

async function newProject(
  boxes: Array<{ kind: "cash" | "account"; unknown?: boolean; openingFils?: number }>,
) {
  const projectId = crypto.randomUUID();
  const owner = `m44-owner-${suffix()}`;
  await withSql(sql =>
    setupProject(sql, {
      projectId,
      owner,
      today: AMMAN_TODAY,
      boxes: boxes.map(b => ({
        kind: b.kind,
        opening: b.unknown === true ? { unknown: true } : { openingFils: b.openingFils ?? 0 },
      })),
    }),
  );
  return { projectId, owner };
}

interface Ctx {
  projectId: string;
  owner: string;
}

/** A direct same-day sale, delivered and collected in cash (the §13 flow). */
async function cashSale(
  sql: postgres.Sql,
  ctx: Ctx,
  priceFils: number,
  customerName = "سامي",
): Promise<void> {
  const outcome = await runPlan(sql, () =>
    planSaleCreate({
      projectId: ctx.projectId,
      createdByAccountId: ctx.owner,
      requestId: `m44-${crypto.randomUUID()}`,
      today: AMMAN_TODAY,
      lines: [{ description: "طلب", quantityMilli: 1000, unitPriceFils: priceFils }],
      plannedDeliveryOn: AMMAN_TODAY,
      finalPriceFils: priceFils,
      customerName,
    }),
  );
  const saleId = String((resultOf(outcome, "applied").data as { saleId: string }).saleId);
  await runPlan(sql, () =>
    planDeliver({
      projectId: ctx.projectId,
      createdByAccountId: ctx.owner,
      requestId: `m44-${crypto.randomUUID()}`,
      today: AMMAN_TODAY,
      saleId,
      collection: { amountFils: priceFils, box: "cash" },
    }),
  );
}

async function cashExpense(sql: postgres.Sql, ctx: Ctx, amountFils: number): Promise<void> {
  await runPlan(sql, () =>
    planExpense({
      projectId: ctx.projectId,
      createdByAccountId: ctx.owner,
      requestId: `m44-${crypto.randomUUID()}`,
      today: AMMAN_TODAY,
      amountFils,
      category: "materials_packaging",
      payment: { type: "full" },
      source: "cash",
    }),
  );
}

/** The first reconciliation of the unknown box (counted per box). */
async function firstReconcile(
  sql: postgres.Sql,
  ctx: Ctx,
  boxes: Array<{ box: "cash" | "account"; countedFils: number; recordedAtStartFils: number | null }>,
): Promise<ReturnType<typeof resultOf>> {
  return resultOf(
    await runPlan(sql, () =>
      planReconcile({
        projectId: ctx.projectId,
        createdByAccountId: ctx.owner,
        requestId: `m44-${crypto.randomUUID()}`,
        today: AMMAN_TODAY,
        context: "first_unknown_opening",
        boxes,
      }),
    ),
    "applied",
  );
}

/* ── 1. T4: the positive computed opening ─────────────────────────────── */

describe("M4.4 T4 — unknown cash; sale 100 collected; expense 40; counted 260", () => {
  it("posts Q1 = 200 on created_on; profit 60; net worth 260; flag cleared; UNEXP 0", async () => {
    const ctx = await newProject([{ kind: "cash", unknown: true }]);
    await withSql(async sql => {
      await cashSale(sql, ctx, 100_000);
      await cashExpense(sql, ctx, 40_000);
      expect(await boxBalance(sql, ctx.projectId, "cash")).toBe(60_000);

      // Before: the unknown opening marks everything unknown/incomplete.
      const before = await computeManageFigures(sql, ctx.projectId, AMMAN_TODAY, "since_start");
      expect(before.flags.unknownBalance).toBe(true);
      expect(before.flags.incompletePeriod).toBe(true);

      const result = await firstReconcile(sql, ctx, [
        { box: "cash", countedFils: 260_000, recordedAtStartFils: null },
      ]);

      // T4: Q1 = 200 effective on the box's created_on (the setup day).
      expect(result.entryIds).toHaveLength(1);
      const entry = (await sql`SELECT entry_type, effective_on::text AS effective_on
                                 FROM ledger_entry WHERE id = ${result.entryIds[0]}`) as Array<{
        entry_type: string;
        effective_on: string;
      }>;
      const box = (await sql`SELECT created_on::text AS created_on FROM box
                               WHERE project_id = ${ctx.projectId} AND kind = 'cash'`) as Array<{
        created_on: string;
      }>;
      expect(entry[0]).toMatchObject({ entry_type: "Q1", effective_on: box[0]!.created_on });
      const postings = (await sql`SELECT account, delta_minor
                                    FROM ledger_posting WHERE entry_id = ${result.entryIds[0]}`) as Array<{
        account: string;
        delta_minor: string | number;
      }>;
      const byAccount = new Map(postings.map(p => [String(p.account), Number(p.delta_minor)]));
      expect(byAccount.get("BOX")).toBe(200_000);
      expect(byAccount.get("OPEN")).toBe(200_000);

      // T4's figures: cash 260; profit 60 (100 − 40); net worth 260;
      // UNEXP 0 (no Q19); the flag cleared.
      expect(await boxBalance(sql, ctx.projectId, "cash")).toBe(260_000);
      expect(await accountTotal(sql, ctx.projectId, "OPEN")).toBe(200_000);
      const figures = await computeManageFigures(sql, ctx.projectId, AMMAN_TODAY, "since_start");
      expect(figures.netProfit.fils).toBe(60_000);
      expect(figures.netWorth.fils).toBe(260_000);
      expect(figures.unexplained.fils).toBe(0);
      expect(figures.unexplained.shown).toBe(false);
      expect(figures.flags.unknownBalance).toBe(false);
      expect(figures.flags.incompletePeriod).toBe(false);

      // opening_status flipped; the §3.10 rows carry the context.
      const status = (await sql`SELECT opening_status FROM box
                                  WHERE project_id = ${ctx.projectId} AND kind = 'cash'`) as Array<{
        opening_status: string;
      }>;
      expect(status[0]!.opening_status).toBe("known");
      const recon = (await sql`SELECT context, performed_on::text AS performed_on
                                 FROM reconciliation WHERE project_id = ${ctx.projectId}`) as Array<{
        context: string;
        performed_on: string;
      }>;
      expect(recon[0]).toMatchObject({ context: "first_unknown_opening", performed_on: AMMAN_TODAY });
      const reconBox = (await sql`SELECT recorded_minor, counted_minor
                                    FROM reconciliation_box rb
                                    JOIN reconciliation r ON r.id = rb.reconciliation_id
                                    WHERE r.project_id = ${ctx.projectId}`) as Array<{
        recorded_minor: string;
        counted_minor: string;
      }>;
      expect(reconBox[0]).toMatchObject({ recorded_minor: "60000", counted_minor: "260000" });

      await assertLedgerCoreInvariants(await ledgerState(sql, ctx.projectId));
    });
  });
});

/* ── 2. T28: the negative computed opening with an answer ─────────────── */

describe("M4.4 T28 — unknown cash; sale 500; expense 60; counted 40; withdrawal 300", () => {
  it("posts Q12 300 and Q19 −100 with the opening 0; profit 440; net worth 40", async () => {
    const ctx = await newProject([{ kind: "cash", unknown: true }]);
    await withSql(async sql => {
      await cashSale(sql, ctx, 500_000);
      await cashExpense(sql, ctx, 60_000);
      expect(await boxBalance(sql, ctx.projectId, "cash")).toBe(440_000);

      // The flow: counted 40 → computed −400 < 0 → opening 0, the "less"
      // questions; the user answers «سحب 300» (its own operation).
      await runPlan(sql, () =>
        planOwnerWithdrawal({
          projectId: ctx.projectId,
          createdByAccountId: ctx.owner,
          requestId: `m44-${crypto.randomUUID()}`,
          today: AMMAN_TODAY,
          amountFils: 300_000,
          box: "cash",
          type: { type: "personal" },
        }),
      );
      expect(await boxBalance(sql, ctx.projectId, "cash")).toBe(140_000);

      // Finish: Q19 = 40 − 140 = −100; the opening is 0 (NO Q1 row).
      const result = await firstReconcile(sql, ctx, [
        { box: "cash", countedFils: 40_000, recordedAtStartFils: null },
      ]);
      expect(result.entryIds).toHaveLength(1);
      const entry = (await sql`SELECT entry_type FROM ledger_entry
                                 WHERE id = ${result.entryIds[0]}`) as Array<{ entry_type: string }>;
      expect(entry[0]!.entry_type).toBe("Q19");
      const postings = (await sql`SELECT account, delta_minor
                                    FROM ledger_posting WHERE entry_id = ${result.entryIds[0]}`) as Array<{
        account: string;
        delta_minor: string | number;
      }>;
      const byAccount = new Map(postings.map(p => [String(p.account), Number(p.delta_minor)]));
      expect(byAccount.get("BOX")).toBe(-100_000);
      expect(byAccount.get("UNEXP")).toBe(-100_000);

      // T28's figures: Q1 0 (no row — count the Q1s); Q12 300; cash 40;
      // profit 440; net worth 40; OPEN 0.
      const q1Count = (await sql`SELECT count(*)::int AS n FROM ledger_entry e
                                   WHERE e.project_id = ${ctx.projectId} AND e.entry_type = 'Q1'`) as Array<{
        n: number;
      }>;
      expect(q1Count[0]!.n).toBe(0);
      expect(await accountTotal(sql, ctx.projectId, "OWN_OUT")).toBe(300_000);
      expect(await boxBalance(sql, ctx.projectId, "cash")).toBe(40_000);
      expect(await accountTotal(sql, ctx.projectId, "OPEN")).toBe(0);
      const figures = await computeManageFigures(sql, ctx.projectId, AMMAN_TODAY, "since_start");
      expect(figures.netProfit.fils).toBe(440_000);
      expect(figures.netWorth.fils).toBe(40_000);
      expect(figures.unexplained.fils).toBe(-100_000);

      // The opening flipped to known even in the negative branch.
      const status = (await sql`SELECT opening_status FROM box
                                  WHERE project_id = ${ctx.projectId} AND kind = 'cash'`) as Array<{
        opening_status: string;
      }>;
      expect(status[0]!.opening_status).toBe("known");

      await assertLedgerCoreInvariants(await ledgerState(sql, ctx.projectId));
    });
  });
});

/* ── 3. The zero boundary and the mixed boxes ─────────────────────────── */

describe("M4.4 — the computed = 0 boundary and mixed boxes", () => {
  it("counted exactly the postings: no Q1, no Q19, the opening flips to 0/known", async () => {
    const ctx = await newProject([{ kind: "cash", unknown: true }]);
    await withSql(async sql => {
      await cashSale(sql, ctx, 70_000);
      expect(await boxBalance(sql, ctx.projectId, "cash")).toBe(70_000);

      const result = await firstReconcile(sql, ctx, [
        { box: "cash", countedFils: 70_000, recordedAtStartFils: null },
      ]);
      expect(result.entryIds).toHaveLength(0);
      expect(await accountTotal(sql, ctx.projectId, "OPEN")).toBe(0);
      expect(await boxBalance(sql, ctx.projectId, "cash")).toBe(70_000);
      const figures = await computeManageFigures(sql, ctx.projectId, AMMAN_TODAY, "since_start");
      expect(figures.flags.unknownBalance).toBe(false);
      expect(figures.netWorth.fils).toBe(70_000);

      await assertLedgerCoreInvariants(await ledgerState(sql, ctx.projectId));
    });
  });

  it("mixed boxes: the unknown cash gets the §7.3 path, the known account gets §7.1's Q19", async () => {
    const ctx = await newProject([
      { kind: "cash", unknown: true },
      { kind: "account", openingFils: 50_000 },
    ]);
    await withSql(async sql => {
      await cashSale(sql, ctx, 100_000); // cash postings +100
      // counted cash 300 → computed opening 200 (Q1); counted account 60
      // → Δ +10 (Q19, §7.1).
      const result = await firstReconcile(sql, ctx, [
        { box: "cash", countedFils: 300_000, recordedAtStartFils: null },
        { box: "account", countedFils: 60_000, recordedAtStartFils: 50_000 },
      ]);
      expect(result.entryIds).toHaveLength(2);
      const entries = (await sql`SELECT e.entry_type, e.effective_on::text AS effective_on
                                   FROM ledger_entry e
                                   WHERE e.id IN ${sql(result.entryIds)}
                                   ORDER BY e.entry_type`) as Array<{
        entry_type: string;
        effective_on: string;
      }>;
      expect(entries.map(e => String(e.entry_type)).sort()).toEqual(["Q1", "Q19"]);

      expect(await boxBalance(sql, ctx.projectId, "cash")).toBe(300_000);
      expect(await boxBalance(sql, ctx.projectId, "account")).toBe(60_000);
      // OPEN = the account's setup opening (50) + the cash's computed opening (200).
      expect(await accountTotal(sql, ctx.projectId, "OPEN")).toBe(250_000);
      const figures = await computeManageFigures(sql, ctx.projectId, AMMAN_TODAY, "since_start");
      expect(figures.netWorth.fils).toBe(360_000);
      expect(figures.unexplained.fils).toBe(10_000);

      await assertLedgerCoreInvariants(await ledgerState(sql, ctx.projectId));
    });
  });
});

/* ── 4. The validations ───────────────────────────────────────────────── */

describe("M4.4 — the first_unknown_opening validations", () => {
  it("rejects the context without an unknown box, a recorded passed for an unknown box,", async () => {
    const known = await newProject([{ kind: "cash", openingFils: 100_000 }]);
    await withSql(async sql => {
      // No unknown box → the context is malformed (P-37 derives it only
      // when an unknown box exists).
      await expect(
        runPlan(sql, () =>
          planReconcile({
            projectId: known.projectId,
            createdByAccountId: known.owner,
            requestId: `m44-${crypto.randomUUID()}`,
            today: AMMAN_TODAY,
            context: "first_unknown_opening",
            boxes: [{ box: "cash", countedFils: 100_000, recordedAtStartFils: 100_000 }],
          }),
        ),
      ).rejects.toMatchObject({ code: "E-AMOUNT" });
    });

    const unknown = await newProject([{ kind: "cash", unknown: true }]);
    await withSql(async sql => {
      // A recorded value claimed for an UNKNOWN box is malformed (the
      // client had nothing to read).
      await expect(
        runPlan(sql, () =>
          planReconcile({
            projectId: unknown.projectId,
            createdByAccountId: unknown.owner,
            requestId: `m44-${crypto.randomUUID()}`,
            today: AMMAN_TODAY,
            context: "first_unknown_opening",
            boxes: [{ box: "cash", countedFils: 50_000, recordedAtStartFils: 0 }],
          }),
        ),
      ).rejects.toMatchObject({ code: "E-AMOUNT" });

      // return_after_absence with an unknown box: undefined in the spec —
      // the contexts stay exclusive (documented reading).
      await expect(
        runPlan(sql, () =>
          planReconcile({
            projectId: unknown.projectId,
            createdByAccountId: unknown.owner,
            requestId: `m44-${crypto.randomUUID()}`,
            today: AMMAN_TODAY,
            context: "return_after_absence",
            boxes: [{ box: "cash", countedFils: 50_000, recordedAtStartFils: 50_000 }],
          }),
        ),
      ).rejects.toMatchObject({ code: "E-AMOUNT" });
    });
  });
});

/* ── 5. R-25 replay and the HTTP route ────────────────────────────────── */

describe("M4.4 — R-25 replay and the route", () => {
  it("replays a retried first reconciliation byte-identically (one Q1, one flip)", async () => {
    const ctx = await newProject([{ kind: "cash", unknown: true }]);
    await withSql(async sql => {
      await cashSale(sql, ctx, 100_000);
      const requestId = `m44-retry-${suffix()}`;
      const make = () =>
        planReconcile({
          projectId: ctx.projectId,
          createdByAccountId: ctx.owner,
          requestId,
          today: AMMAN_TODAY,
          context: "first_unknown_opening",
          boxes: [{ box: "cash", countedFils: 260_000, recordedAtStartFils: null }],
        });
      const first = await runPlan(sql, make);
      const retry = await runPlan(sql, make);
      expect(first.outcome).toBe("applied");
      expect(retry.outcome).toBe("replay");
      expect((retry as { result: unknown }).result).toEqual((first as { result: unknown }).result);
      const q1 = (await sql`SELECT count(*)::int AS n FROM ledger_entry e
                              WHERE e.project_id = ${ctx.projectId} AND e.entry_type = 'Q1'`) as Array<{
        n: number;
      }>;
      expect(q1[0]!.n).toBe(1);
      expect(await boxBalance(sql, ctx.projectId, "cash")).toBe(260_000);

      await assertLedgerCoreInvariants(await ledgerState(sql, ctx.projectId));
    });
  });

  it("serves the first_unknown_opening context over HTTP", async () => {
    const sub = `m44-route-${suffix()}`;
    const session = await signInAs(worker, { sub, email: `${sub}@example.com` });
    const setup = await apiPost(worker, session.cookieHeader, "/api/manage-v2/setup", {
      requestId: `m44-${crypto.randomUUID()}`,
      projectName: "مشروع الافتتاح المجهول",
      boxes: [{ kind: "cash", opening: { unknown: true } }],
    });
    expect(setup.status).toBe(200);
    const projectId = ((await setup.json()) as { projectId: string }).projectId;

    const done = await apiPost(worker, session.cookieHeader, "/api/manage-v2/reconcile", {
      requestId: `m44-${crypto.randomUUID()}`,
      projectId,
      context: "first_unknown_opening",
      boxes: [{ box: "cash", countedFils: 0, recordedAtStartFils: null }],
    });
    expect(done.status).toBe(200);
    const body = (await done.json()) as { outcome: string; result: { data: { boxes: unknown[] } } };
    expect(body.outcome).toBe("applied");
    expect(body.result.data.boxes).toHaveLength(1);
  });
});
