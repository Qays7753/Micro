/**
 * M4.2 acceptance (Manage v2 phase 4 — spec §7.1 OP-RECONCILE, §4 Q19,
 * §8.2's Δ; tests S7, S8, T34, T42, T45): the reconciliation flow's
 * server surfaces, all through the real operations:
 *
 *  - P-50's counted amounts and P-51's OPPOSITE-DIFFERENCES transfer
 *    proposal (§7.1-2): a Q14 of min(|Δ1|, |Δ2|) from the negative box to
 *    the positive — a NORMAL OP-TRANSFER (its Q14 already exists); the
 *    PROPOSAL RULE is a pure helper (S8/T34).
 *  - P-52's answers: each runs its OWN operation (expense, withdrawal…)
 *    on the box, effective on the reconciliation date (today — R-26) —
 *    they already exist and are not rebuilt here.
 *  - P-52's «إنهاء» / P-50's all-zero «التالي» = OP-RECONCILE (this
 *    task's operation): Q19 per box with the REMAINING Δ (counted − the
 *    CURRENT recorded, computed from the ledger inside the transaction —
 *    never from the client's numbers), then the reconciliation +
 *    reconciliation_box rows (§3.10) persisted in the same transaction.
 *
 * S7 — recorded 340, counted 300; answers utilities 25 + withdrawal 10 →
 * Q19 −5; profit −25 ONLY; unexplained «نقص 5».
 * S8 — opposite diffs → proposal 50 cash→account → both Δ 0 → finish with
 * NO Q19; profit unchanged.
 * T34 — Δcash −50 / Δaccount +10 → proposal 10 cash→account; the
 * remaining Δcash −40 goes to the "less" questions (Q19 −40 at finish).
 * T42 — an answer's operation cancelled later: reversed on its date, the
 * box moves back, and the reconciliation rows are NOT reopened.
 * T45 — Δ −40 answered with an expense of 50 (editable amount): Δ flips
 * to +10 → the "more" set; Q19 +10 at finish.
 *
 * Tests-first: this file was written before the operation existed and
 * fails with "Cannot find module …operations/reconcile.js".
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
  boxIdOf,
  fileSqlUrl,
  ledgerState,
  resultOf,
  runPlan,
  scopedClient,
  setupProject,
} from "./manage.v2.helpers.ts";
import { planExpense } from "../../../../src/domain/manage/operations/expense.js";
import { planOwnerWithdrawal } from "../../../../src/domain/manage/operations/ownerMoney.js";
import { planTransfer } from "../../../../src/domain/manage/operations/transfer.js";
import { planCancelOperation } from "../../../../src/domain/manage/operations/cancelOperation.js";
import {
  planReconcile,
  transferProposalOf,
  type ReconcileBoxInput,
} from "../../../../src/domain/manage/operations/reconcile.js";
import { computeManageFigures } from "../application/manage/readModel.js";
import { assertLedgerCoreInvariants } from "../../../../src/domain/manage/invariants/index.js";
import type { SetupBoxSlot } from "../../../../src/domain/manage/operations/setup.js";

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

async function newProject(boxes: SetupBoxSlot[]) {
  const projectId = crypto.randomUUID();
  const owner = `m42-owner-${suffix()}`;
  await withSql(sql => setupProject(sql, { projectId, owner, today: AMMAN_TODAY, boxes }));
  return { projectId, owner };
}

/** An answer's expense (P-52's «مصروف»): on the box, dated today. */
async function answerExpense(
  sql: postgres.Sql,
  ctx: { projectId: string; owner: string },
  amountFils: number,
  category = "utilities",
): Promise<string> {
  const outcome = await runPlan(sql, () =>
    planExpense({
      projectId: ctx.projectId,
      createdByAccountId: ctx.owner,
      requestId: `m42-${crypto.randomUUID()}`,
      today: AMMAN_TODAY,
      amountFils,
      category,
      payment: { type: "full" },
      source: "cash",
    }),
  );
  return resultOf(outcome, "applied").operationId;
}

/** An answer's withdrawal (P-52's «سحب»): on the box, dated today. */
async function answerWithdrawal(
  sql: postgres.Sql,
  ctx: { projectId: string; owner: string },
  amountFils: number,
): Promise<void> {
  await runPlan(sql, () =>
    planOwnerWithdrawal({
      projectId: ctx.projectId,
      createdByAccountId: ctx.owner,
      requestId: `m42-${crypto.randomUUID()}`,
      today: AMMAN_TODAY,
      amountFils,
      box: "cash",
      type: { type: "personal" },
    }),
  );
}

/** The finish (P-52's «إنهاء»): OP-RECONCILE with the counted amounts. */
async function finish(
  sql: postgres.Sql,
  ctx: { projectId: string; owner: string },
  boxes: ReconcileBoxInput[],
): Promise<ReturnType<typeof resultOf>> {
  return resultOf(
    await runPlan(sql, () =>
      planReconcile({
        projectId: ctx.projectId,
        createdByAccountId: ctx.owner,
        requestId: `m42-${crypto.randomUUID()}`,
        today: AMMAN_TODAY,
        context: "routine",
        boxes,
      }),
    ),
    "applied",
  );
}

/** The persisted reconciliation rows (§3.10). */
async function reconciliationRows(sql: postgres.Sql, ctx: { projectId: string }) {
  return (await sql`
    SELECT r.id, r.performed_on::text AS performed_on, r.context,
           b.box_id, b.recorded_minor, b.counted_minor
    FROM reconciliation r
    JOIN reconciliation_box b ON b.reconciliation_id = r.id AND b.project_id = r.project_id
    WHERE r.project_id = ${ctx.projectId}
    ORDER BY r.created_at, b.box_id`) as Array<{
    id: string;
    performed_on: string;
    context: string;
    box_id: string;
    recorded_minor: string;
    counted_minor: string;
  }>;
}

/* ── 1. S7: the reconciliation with answers and a remaining difference ── */

describe("M4.2 S7 — recorded 340, counted 300; answers 25 + 10; finish", () => {
  it("posts Q19 −5; profit −25 ONLY; unexplained «نقص 5»", async () => {
    const ctx = await newProject([{ kind: "cash", opening: { openingFils: 340_000 } }]);
    await withSql(async sql => {
      const counted = 300_000;
      const recordedAtStart = 340_000;
      // P-52's answers: utilities 25 (P-64) and a withdrawal 10 (P-65).
      await answerExpense(sql, ctx, 25_000, "utilities");
      await answerWithdrawal(sql, ctx, 10_000);
      expect(await boxBalance(sql, ctx.projectId, "cash")).toBe(305_000);

      const result = await finish(sql, ctx, [
        { box: "cash", countedFils: counted, recordedAtStartFils: recordedAtStart },
      ]);

      // S7: Q19 −5 — the ONE remaining difference, dated today.
      expect(result.entryIds).toHaveLength(1);
      const cashId = await boxIdOf(sql, ctx.projectId, "cash");
      const entry = (await sql`SELECT entry_type, effective_on::text AS effective_on
                                 FROM ledger_entry WHERE id = ${result.entryIds[0]}`) as Array<{
        entry_type: string;
        effective_on: string;
      }>;
      expect(entry[0]).toMatchObject({ entry_type: "Q19", effective_on: AMMAN_TODAY });
      const postings = (await sql`SELECT account, ref_id, delta_minor
                                    FROM ledger_posting WHERE entry_id = ${result.entryIds[0]}`) as Array<{
        account: string;
        ref_id: string | null;
        delta_minor: string | number;
      }>;
      expect(postings).toHaveLength(2);
      const byAccount = new Map(postings.map(p => [String(p.account), p]));
      expect(Number(byAccount.get("BOX")?.delta_minor)).toBe(-5_000);
      expect(byAccount.get("BOX")?.ref_id).toBe(cashId);
      expect(Number(byAccount.get("UNEXP")?.delta_minor)).toBe(-5_000);
      expect(byAccount.get("UNEXP")?.ref_id).toBeNull();

      // The counted is now the truth: cash 300.
      expect(await boxBalance(sql, ctx.projectId, "cash")).toBe(300_000);

      // S7: profit −25 ONLY (the withdrawal and the Q19 never touch it);
      // unexplained −5 («نقص 5»); net worth 300 = 340 − 25 − 10 − 5.
      const figures = await computeManageFigures(sql, ctx.projectId, AMMAN_TODAY, "since_start");
      expect(figures.netProfit.fils).toBe(-25_000);
      expect(figures.unexplained.fils).toBe(-5_000);
      expect(figures.unexplained.shown).toBe(true);
      expect(figures.netWorth.fils).toBe(300_000);
      expect(figures.personalWithdrawals.fils).toBe(10_000);

      // §3.10: the rows persisted in the same transaction.
      const rows = await reconciliationRows(sql, ctx);
      expect(rows).toHaveLength(1);
      expect(rows[0]).toMatchObject({
        performed_on: AMMAN_TODAY,
        context: "routine",
        box_id: cashId,
        recorded_minor: "340000",
        counted_minor: "300000",
      });

      await assertLedgerCoreInvariants(await ledgerState(sql, ctx.projectId));
    });
  });
});

/* ── 2. S8: opposite differences → the transfer proposal closes both ──── */

describe("M4.2 S8 — recorded 200/100, counted 150/150; proposal 50", () => {
  it("applies the proposed transfer, finishes with NO Q19, profit unchanged", async () => {
    const ctx = await newProject([
      { kind: "cash", opening: { openingFils: 200_000 } },
      { kind: "account", opening: { openingFils: 100_000 } },
    ]);
    await withSql(async sql => {
      // §7.1-2: Δcash −50, Δaccount +50 → the proposal.
      const deltas = [
        { box: "cash" as const, countedFils: 150_000, recordedFils: 200_000 },
        { box: "account" as const, countedFils: 150_000, recordedFils: 100_000 },
      ];
      const proposal = transferProposalOf(deltas);
      expect(proposal).toEqual({ fromBox: "cash", toBox: "account", amountFils: 50_000 });

      // On confirm: a normal OP-TRANSFER (its Q14), dated today.
      await runPlan(sql, () =>
        planTransfer({
          projectId: ctx.projectId,
          createdByAccountId: ctx.owner,
          requestId: `m42-${crypto.randomUUID()}`,
          today: AMMAN_TODAY,
          fromBox: "cash",
          toBox: "account",
          amountFils: 50_000,
        }),
      );
      expect(await boxBalance(sql, ctx.projectId, "cash")).toBe(150_000);
      expect(await boxBalance(sql, ctx.projectId, "account")).toBe(150_000);

      // Both Δ are now 0 → the finish posts NO Q19 at all.
      const result = await finish(sql, ctx, [
        { box: "cash", countedFils: 150_000, recordedAtStartFils: 200_000 },
        { box: "account", countedFils: 150_000, recordedAtStartFils: 100_000 },
      ]);
      expect(result.entryIds).toHaveLength(0);

      // S8: profit unchanged (a transfer never touches it); both rows kept.
      const figures = await computeManageFigures(sql, ctx.projectId, AMMAN_TODAY, "since_start");
      expect(figures.netProfit.fils).toBe(0);
      expect(figures.unexplained.shown).toBe(false);
      const rows = await reconciliationRows(sql, ctx);
      expect(rows).toHaveLength(2);

      await assertLedgerCoreInvariants(await ledgerState(sql, ctx.projectId));
    });
  });
});

/* ── 3. T34: the partial proposal and the remaining "less" difference ─── */

describe("M4.2 T34 — Δcash −50, Δaccount +10", () => {
  it("proposes 10 cash→account; the remaining Δcash −40 becomes Q19 at finish", async () => {
    const ctx = await newProject([
      { kind: "cash", opening: { openingFils: 200_000 } },
      { kind: "account", opening: { openingFils: 100_000 } },
    ]);
    await withSql(async sql => {
      // T34: counted cash 150 (Δ −50), counted account 110 (Δ +10).
      const deltas = [
        { box: "cash" as const, countedFils: 150_000, recordedFils: 200_000 },
        { box: "account" as const, countedFils: 110_000, recordedFils: 100_000 },
      ];
      const proposal = transferProposalOf(deltas);
      expect(proposal).toEqual({ fromBox: "cash", toBox: "account", amountFils: 10_000 });

      // Confirm → the transfer; Δ recomputed: cash −40, account 0.
      await runPlan(sql, () =>
        planTransfer({
          projectId: ctx.projectId,
          createdByAccountId: ctx.owner,
          requestId: `m42-${crypto.randomUUID()}`,
          today: AMMAN_TODAY,
          fromBox: "cash",
          toBox: "account",
          amountFils: 10_000,
        }),
      );
      const recomputed = transferProposalOf([
        { box: "cash", countedFils: 150_000, recordedFils: 190_000 },
        { box: "account", countedFils: 110_000, recordedFils: 110_000 },
      ]);
      expect(recomputed).toBeNull(); // no opposite pair anymore
      // The remaining Δcash −40 goes to the "less" questions; unanswered,
      // the finish posts Q19 −40 on cash and 0 on account.
      const result = await finish(sql, ctx, [
        { box: "cash", countedFils: 150_000, recordedAtStartFils: 200_000 },
        { box: "account", countedFils: 110_000, recordedAtStartFils: 100_000 },
      ]);
      expect(result.entryIds).toHaveLength(1);
      const postings = (await sql`SELECT account, delta_minor
                                    FROM ledger_posting WHERE entry_id = ${result.entryIds[0]}`) as Array<{
        account: string;
        delta_minor: string | number;
      }>;
      const byAccount = new Map(postings.map(p => [String(p.account), Number(p.delta_minor)]));
      expect(byAccount.get("BOX")).toBe(-40_000);
      expect(byAccount.get("UNEXP")).toBe(-40_000);
      expect(await boxBalance(sql, ctx.projectId, "cash")).toBe(150_000);
      expect(await boxBalance(sql, ctx.projectId, "account")).toBe(110_000);

      const figures = await computeManageFigures(sql, ctx.projectId, AMMAN_TODAY, "since_start");
      expect(figures.unexplained.fils).toBe(-40_000);

      await assertLedgerCoreInvariants(await ledgerState(sql, ctx.projectId));
    });
  });
});

/* ── 4. T45: an answer that flips the difference's sign ───────────────── */

describe("M4.2 T45 — Δ −40 answered with an expense of 50", () => {
  it("flips Δ to +10; the finish posts Q19 +10", async () => {
    const ctx = await newProject([{ kind: "cash", opening: { openingFils: 340_000 } }]);
    await withSql(async sql => {
      // The prefilled |Δ| is editable: the user answers 50, not 40.
      await answerExpense(sql, ctx, 50_000, "utilities");
      expect(await boxBalance(sql, ctx.projectId, "cash")).toBe(290_000);

      // Δ recomputed: 300 − 290 = +10 → the "more" question set (client);
      // unanswered, the finish posts Q19 +10 (BOX +10 / UNEXP +10).
      const result = await finish(sql, ctx, [
        { box: "cash", countedFils: 300_000, recordedAtStartFils: 340_000 },
      ]);
      expect(result.entryIds).toHaveLength(1);
      const postings = (await sql`SELECT account, delta_minor
                                    FROM ledger_posting WHERE entry_id = ${result.entryIds[0]}`) as Array<{
        account: string;
        delta_minor: string | number;
      }>;
      const byAccount = new Map(postings.map(p => [String(p.account), Number(p.delta_minor)]));
      expect(byAccount.get("BOX")).toBe(10_000);
      expect(byAccount.get("UNEXP")).toBe(10_000);
      expect(await boxBalance(sql, ctx.projectId, "cash")).toBe(300_000);

      const figures = await computeManageFigures(sql, ctx.projectId, AMMAN_TODAY, "since_start");
      expect(figures.netProfit.fils).toBe(-50_000);
      expect(figures.unexplained.fils).toBe(10_000);

      await assertLedgerCoreInvariants(await ledgerState(sql, ctx.projectId));
    });
  });
});

/* ── 5. T42: cancelling an answer later does not reopen the reconcili. ── */

describe("M4.2 T42 — the answer's expense is cancelled later", () => {
  it("reverses the expense on its date, moves the box back, leaves the rows untouched", async () => {
    const ctx = await newProject([{ kind: "cash", opening: { openingFils: 340_000 } }]);
    await withSql(async sql => {
      // A reconciliation whose answer closes the difference whole.
      const expenseOperationId = await answerExpense(sql, ctx, 25_000, "utilities");
      expect(await boxBalance(sql, ctx.projectId, "cash")).toBe(315_000);
      const result = await finish(sql, ctx, [
        { box: "cash", countedFils: 315_000, recordedAtStartFils: 340_000 },
      ]);
      expect(result.entryIds).toHaveLength(0); // Δ 0 → no Q19
      const rowsBefore = await reconciliationRows(sql, ctx);
      expect(rowsBefore).toHaveLength(1);

      // Later: the answer's expense is cancelled (OP-CANCEL-OPERATION).
      await runPlan(sql, () =>
        planCancelOperation({
          projectId: ctx.projectId,
          createdByAccountId: ctx.owner,
          requestId: `m42-${crypto.randomUUID()}`,
          today: AMMAN_TODAY,
          operationId: expenseOperationId,
        }),
      );

      // T42: the expense reversed ON ITS DATE (today); the box moved back.
      expect(await boxBalance(sql, ctx.projectId, "cash")).toBe(340_000);
      const reversed = (await sql`SELECT e.entry_type, e.effective_on::text AS effective_on
                                    FROM ledger_entry e
                                    WHERE e.project_id = ${ctx.projectId} AND e.entry_type = 'Q20'`) as Array<{
        entry_type: string;
        effective_on: string;
      }>;
      expect(reversed[0]).toMatchObject({ entry_type: "Q20", effective_on: AMMAN_TODAY });

      // T42: the reconciliation is NOT reopened — the rows are untouched
      // and no new reconciliation appeared (the next one will reflect it).
      const rowsAfter = await reconciliationRows(sql, ctx);
      expect(rowsAfter).toEqual(rowsBefore);
      const count = (await sql`SELECT count(*)::int AS n FROM reconciliation
                                 WHERE project_id = ${ctx.projectId}`) as Array<{ n: number }>;
      expect(count[0]!.n).toBe(1);

      await assertLedgerCoreInvariants(await ledgerState(sql, ctx.projectId));
    });
  });
});

/* ── 6. The validations ───────────────────────────────────────────────── */

describe("M4.2 — the routine-reconcile validations", () => {
  it("rejects a wrong context, a missing/extra/duplicate box, a bad counted, an unknown opening", async () => {
    const ctx = await newProject([{ kind: "cash", opening: { openingFils: 100_000 } }]);
    await withSql(async sql => {
      const good = [{ box: "cash", countedFils: 100_000, recordedAtStartFils: 100_000 }];
      const make = (context: unknown, boxes: unknown) =>
        runPlan(sql, () =>
          planReconcile({
            projectId: ctx.projectId,
            createdByAccountId: ctx.owner,
            requestId: `m42-${crypto.randomUUID()}`,
            today: AMMAN_TODAY,
            context,
            boxes,
          }),
        );
      // M4.2 owns `routine`; `return_after_absence` arrived with M4.3
      // (its own acceptance file) — `first_unknown_opening` with M4.4.
      await expect(make("first_unknown_opening", good)).rejects.toMatchObject({ code: "E-AMOUNT" });
      await expect(make("nonsense", good)).rejects.toMatchObject({ code: "E-AMOUNT" });
      // Every ACTIVE box must be counted exactly once.
      await expect(make("routine", [])).rejects.toMatchObject({ code: "E-AMOUNT" });
      await expect(
        make("routine", [
          { box: "cash", countedFils: 100_000, recordedAtStartFils: 100_000 },
          { box: "account", countedFils: 0, recordedAtStartFils: 0 },
        ]),
      ).rejects.toMatchObject({ code: "E-AMOUNT" }); // account is not active
      await expect(
        make("routine", [
          { box: "cash", countedFils: 100_000, recordedAtStartFils: 100_000 },
          { box: "cash", countedFils: 90_000, recordedAtStartFils: 100_000 },
        ]),
      ).rejects.toMatchObject({ code: "E-AMOUNT" }); // duplicate
      await expect(
        make("routine", [{ box: "cash", countedFils: -1, recordedAtStartFils: 100_000 }]),
      ).rejects.toMatchObject({ code: "E-AMOUNT" }); // a count is ≥ 0
      await expect(
        make("routine", [{ box: "cash", countedFils: 100.5, recordedAtStartFils: 100_000 }]),
      ).rejects.toMatchObject({ code: "E-AMOUNT" }); // integer fils only
    });

    // An unknown opening with the routine context: §7.3's own flow (M4.4).
    const unknown = await newProject([{ kind: "cash", opening: { unknown: true } }]);
    await withSql(async sql => {
      await expect(
        runPlan(sql, () =>
          planReconcile({
            projectId: unknown.projectId,
            createdByAccountId: unknown.owner,
            requestId: `m42-${crypto.randomUUID()}`,
            today: AMMAN_TODAY,
            context: "routine",
            boxes: [{ box: "cash", countedFils: 50_000, recordedAtStartFils: 0 }],
          }),
        ),
      ).rejects.toMatchObject({ code: "E-AMOUNT" });
    });
  });
});

/* ── 7. R-25 replay and the HTTP route ────────────────────────────────── */

describe("M4.2 — R-25 replay and the route", () => {
  it("replays a retried finish byte-identically (one reconciliation, one Q19)", async () => {
    const ctx = await newProject([{ kind: "cash", opening: { openingFils: 340_000 } }]);
    await withSql(async sql => {
      await answerExpense(sql, ctx, 25_000, "utilities");
      const requestId = `m42-retry-${suffix()}`;
      const make = () =>
        planReconcile({
          projectId: ctx.projectId,
          createdByAccountId: ctx.owner,
          requestId,
          today: AMMAN_TODAY,
          context: "routine",
          boxes: [{ box: "cash", countedFils: 300_000, recordedAtStartFils: 340_000 }],
        });
      const first = await runPlan(sql, make);
      const retry = await runPlan(sql, make);
      expect(first.outcome).toBe("applied");
      expect(retry.outcome).toBe("replay");
      expect((retry as { result: unknown }).result).toEqual((first as { result: unknown }).result);
      const count = (await sql`SELECT count(*)::int AS n FROM reconciliation
                                 WHERE project_id = ${ctx.projectId}`) as Array<{ n: number }>;
      expect(count[0]!.n).toBe(1);
      const q19 = (await sql`SELECT count(*)::int AS n FROM ledger_entry e
                                WHERE e.project_id = ${ctx.projectId} AND e.entry_type = 'Q19'`) as Array<{
        n: number;
      }>;
      expect(q19[0]!.n).toBe(1);

      await assertLedgerCoreInvariants(await ledgerState(sql, ctx.projectId));
    });
  });

  it("serves /reconcile over HTTP: 200 with the result, 400 with the code", async () => {
    const sub = `m42-route-${suffix()}`;
    const session = await signInAs(worker, { sub, email: `${sub}@example.com` });
    const setup = await apiPost(worker, session.cookieHeader, "/api/manage-v2/setup", {
      requestId: `m42-${crypto.randomUUID()}`,
      projectName: "مشروع المطابقة",
      boxes: [{ kind: "cash", opening: { openingFils: 340_000 } }],
    });
    expect(setup.status).toBe(200);
    const projectId = ((await setup.json()) as { projectId: string }).projectId;

    const bad = await apiPost(worker, session.cookieHeader, "/api/manage-v2/reconcile", {
      requestId: `m42-${crypto.randomUUID()}`,
      projectId,
      context: "routine",
      boxes: [],
    });
    expect(bad.status).toBe(400);
    expect(((await bad.json()) as { error: { details: { code: string } } }).error.details.code).toBe(
      "E-AMOUNT",
    );

    const done = await apiPost(worker, session.cookieHeader, "/api/manage-v2/reconcile", {
      requestId: `m42-${crypto.randomUUID()}`,
      projectId,
      context: "routine",
      boxes: [{ box: "cash", countedFils: 340_000, recordedAtStartFils: 340_000 }],
    });
    expect(done.status).toBe(200);
    expect(((await done.json()) as { outcome: string }).outcome).toBe("applied");
  });
});
