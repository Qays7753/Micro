/**
 * M4.1 acceptance (Manage v2 phase 4 — spec §5 OP-MERGE-BOXES /
 * OP-SPLIT-BOXES, §4 Q14, R-9, R-26; tests T9, T10, T41, T46, T47, T53,
 * T59): the two box-lifecycle operations.
 *
 * MERGE (§5): a Q14 that brings the ACCOUNT balance to zero (b > 0:
 * account → cash b; b < 0: cash → account |b|; b = 0: no entry), then the
 * account row `status = merged`. A merged box accepts no operations
 * (E-BOX-STATE). Not allowed while ANY box's opening balance is unknown
 * (E-MERGE-UNKNOWN — T47 account unknown, T53 cash unknown). Effective
 * today (R-26: no date input).
 *
 * SPLIT (§5): the merged account row `status = active` again (the SAME row
 * — R-9's UNIQUE constraint is total), plus a Q14 cash → account of the
 * user-entered amount. Validation: 0 ≤ amount ≤ cash balance
 * (E-SPLIT-AMOUNT — T41); amount 0 → no ledger entry (T59); not allowed
 * while the cash opening balance is unknown (E-MERGE-UNKNOWN).
 *
 * §5.0's row shape: amount moved (the Q14 amount; 0 for a zero-entry
 * merge/split); filter group `op.transfer`.
 *
 * Tests-first: this file was written before the two operations existed and
 * fails with "Cannot find module … operations/mergeBoxes.js".
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
import { planSetup, type SetupBoxSlot } from "../../../../src/domain/manage/operations/setup.js";
import { planExpense } from "../../../../src/domain/manage/operations/expense.js";
import { planTransfer } from "../../../../src/domain/manage/operations/transfer.js";
import { planMergeBoxes } from "../../../../src/domain/manage/operations/mergeBoxes.js";
import { planSplitBoxes } from "../../../../src/domain/manage/operations/splitBoxes.js";
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

async function newProject(boxes: SetupBoxSlot[]) {
  const projectId = crypto.randomUUID();
  const owner = `m41-owner-${suffix()}`;
  await withSql(sql => setupProject(sql, { projectId, owner, today: AMMAN_TODAY, boxes }));
  return { projectId, owner };
}

/** The project's two known boxes at the given openings. */
const TWO_KNOWN = (cash: number, account: number): SetupBoxSlot[] => [
  { kind: "cash", opening: { openingFils: cash } },
  { kind: "account", opening: { openingFils: account } },
];

async function merge(
  sql: postgres.Sql,
  ctx: { projectId: string; owner: string },
): Promise<ReturnType<typeof resultOf>> {
  return resultOf(
    await runPlan(sql, () =>
      planMergeBoxes({
        projectId: ctx.projectId,
        createdByAccountId: ctx.owner,
        requestId: `m41-${crypto.randomUUID()}`,
        today: AMMAN_TODAY,
      }),
    ),
    "applied",
  );
}

async function split(
  sql: postgres.Sql,
  ctx: { projectId: string; owner: string },
  amountFils: number,
): Promise<ReturnType<typeof resultOf>> {
  return resultOf(
    await runPlan(sql, () =>
      planSplitBoxes({
        projectId: ctx.projectId,
        createdByAccountId: ctx.owner,
        requestId: `m41-${crypto.randomUUID()}`,
        today: AMMAN_TODAY,
        amountFils,
      }),
    ),
    "applied",
  );
}

/** The account box's row (status) by direct read. */
async function accountRow(
  sql: postgres.Sql,
  ctx: { projectId: string },
): Promise<{ status: string } | undefined> {
  const rows = (await sql`SELECT status FROM box
                           WHERE project_id = ${ctx.projectId} AND kind = 'account'`) as Array<{
    status: string;
  }>;
  return rows[0];
}

/** An expense that drains the account box (payment full from it). */
async function expenseFromAccount(
  sql: postgres.Sql,
  ctx: { projectId: string; owner: string },
  amountFils: number,
): Promise<void> {
  await runPlan(sql, () =>
    planExpense({
      projectId: ctx.projectId,
      createdByAccountId: ctx.owner,
      requestId: `m41-${crypto.randomUUID()}`,
      today: AMMAN_TODAY,
      amountFils,
      category: "materials_packaging",
      payment: { type: "full" },
      source: "account",
    }),
  );
}

/* ── 1. T9: the merge with a positive account balance ─────────────────── */

describe("M4.1 T9 — cash 100, account 60; merge", () => {
  it("posts Q14 60 account→cash; cash 160; account merged; totals and profit unchanged", async () => {
    const ctx = await newProject(TWO_KNOWN(100_000, 60_000));
    await withSql(async sql => {
      const figuresBefore = await computeManageFigures(sql, ctx.projectId, AMMAN_TODAY, "since_start");
      const result = await merge(sql, ctx);

      // T9: Q14 60 — the operation's own entry, posted today (R-26).
      expect(result.entryIds).toHaveLength(1);
      const accountId = await boxIdOf(sql, ctx.projectId, "account");
      const cashId = await boxIdOf(sql, ctx.projectId, "cash");
      const entry = (await sql`SELECT entry_type, effective_on::text AS effective_on
                                 FROM ledger_entry WHERE id = ${result.entryIds[0]}`) as Array<{
        entry_type: string;
        effective_on: string;
      }>;
      expect(entry[0]).toMatchObject({ entry_type: "Q14", effective_on: AMMAN_TODAY });
      const postings = (await sql`SELECT account, ref_id, delta_minor
                                    FROM ledger_posting WHERE entry_id = ${result.entryIds[0]}`) as Array<{
        account: string;
        ref_id: string;
        delta_minor: string | number;
      }>;
      expect(postings).toHaveLength(2);
      const byBox = new Map(postings.map(p => [String(p.ref_id), Number(p.delta_minor)]));
      expect(byBox.get(accountId)).toBe(-60_000); // the account is drained
      expect(byBox.get(cashId)).toBe(60_000);

      expect(await boxBalance(sql, ctx.projectId, "cash")).toBe(160_000);
      expect(await boxBalance(sql, ctx.projectId, "account")).toBe(0);
      expect((await accountRow(sql, ctx))?.status).toBe("merged");

      // T9: totals and profit unchanged (§8) — the merged box keeps its
      // zero row and stays listed; the total counts ACTIVE boxes only.
      const figuresAfter = await computeManageFigures(sql, ctx.projectId, AMMAN_TODAY, "since_start");
      expect(figuresAfter.totalBalance.fils).toBe(figuresBefore.totalBalance.fils);
      expect(figuresAfter.netWorth.fils).toBe(figuresBefore.netWorth.fils);
      expect(figuresAfter.netProfit.fils).toBe(figuresBefore.netProfit.fils);
      const boxesAfter = new Map(figuresAfter.boxes.map(b => [b.kind, b]));
      expect(boxesAfter.get("cash")).toMatchObject({ status: "active", balanceFils: 160_000 });
      expect(boxesAfter.get("account")).toMatchObject({ status: "merged", balanceFils: 0 });

      await assertLedgerCoreInvariants(await ledgerState(sql, ctx.projectId));
    });
  });
});

/* ── 2. T10: the split reactivates the merged account ─────────────────── */

describe("M4.1 T10 — after T9: split with account 40", () => {
  it("posts Q14 40 cash→account; cash 120; account 40 active", async () => {
    const ctx = await newProject(TWO_KNOWN(100_000, 60_000));
    await withSql(async sql => {
      await merge(sql, ctx);
      const result = await split(sql, ctx, 40_000);

      // T10: Q14 40 cash → account, dated today.
      expect(result.entryIds).toHaveLength(1);
      const entry =
        (await sql`SELECT entry_type FROM ledger_entry WHERE id = ${result.entryIds[0]}`) as Array<{
          entry_type: string;
        }>;
      expect(entry[0]!.entry_type).toBe("Q14");
      const postings = (await sql`SELECT ref_id, delta_minor
                                    FROM ledger_posting WHERE entry_id = ${result.entryIds[0]}`) as Array<{
        ref_id: string;
        delta_minor: string | number;
      }>;
      const accountId = await boxIdOf(sql, ctx.projectId, "account");
      const cashId = await boxIdOf(sql, ctx.projectId, "cash");
      const byBox = new Map(postings.map(p => [String(p.ref_id), Number(p.delta_minor)]));
      expect(byBox.get(cashId)).toBe(-40_000);
      expect(byBox.get(accountId)).toBe(40_000);

      expect(await boxBalance(sql, ctx.projectId, "cash")).toBe(120_000);
      expect(await boxBalance(sql, ctx.projectId, "account")).toBe(40_000);
      expect((await accountRow(sql, ctx))?.status).toBe("active");

      await assertLedgerCoreInvariants(await ledgerState(sql, ctx.projectId));
    });
  });
});

/* ── 3. T46: the merge with a NEGATIVE account balance ────────────────── */

describe("M4.1 T46 — account −20 (known); merge", () => {
  it("posts Q14 cash→account 20; account 0, merged; total unchanged", async () => {
    const ctx = await newProject(TWO_KNOWN(50_000, 30_000));
    await withSql(async sql => {
      // Drain the account to −20 with a real expense paid from it.
      await expenseFromAccount(sql, ctx, 50_000);
      expect(await boxBalance(sql, ctx.projectId, "account")).toBe(-20_000);
      const totalBefore = 30_000; // cash 50 + account (−20)

      const result = await merge(sql, ctx);
      expect(result.entryIds).toHaveLength(1);
      const accountId = await boxIdOf(sql, ctx.projectId, "account");
      const cashId = await boxIdOf(sql, ctx.projectId, "cash");
      const postings = (await sql`SELECT ref_id, delta_minor
                                    FROM ledger_posting WHERE entry_id = ${result.entryIds[0]}`) as Array<{
        ref_id: string;
        delta_minor: string | number;
      }>;
      const byBox = new Map(postings.map(p => [String(p.ref_id), Number(p.delta_minor)]));
      expect(byBox.get(cashId)).toBe(-20_000); // cash covers the shortfall
      expect(byBox.get(accountId)).toBe(20_000);

      expect(await boxBalance(sql, ctx.projectId, "account")).toBe(0);
      expect(await boxBalance(sql, ctx.projectId, "cash")).toBe(30_000);
      expect((await accountRow(sql, ctx))?.status).toBe("merged");

      // Total unchanged by the merge.
      const figures = await computeManageFigures(sql, ctx.projectId, AMMAN_TODAY, "since_start");
      expect(figures.totalBalance.fils).toBe(totalBefore);

      await assertLedgerCoreInvariants(await ledgerState(sql, ctx.projectId));
    });
  });
});

/* ── 4. The b = 0 merge and T41/T59's split edges ─────────────────────── */

describe("M4.1 — b = 0 merge, T41 E-SPLIT-AMOUNT, T59 amount 0", () => {
  it("merges an empty account with NO entry; then split 80 > cash 50 is E-SPLIT-AMOUNT", async () => {
    const ctx = await newProject(TWO_KNOWN(50_000, 0));
    await withSql(async sql => {
      const entriesBefore = (await sql`SELECT count(*)::int AS n FROM ledger_entry
                                         WHERE project_id = ${ctx.projectId}`) as Array<{ n: number }>;
      const result = await merge(sql, ctx);

      // b = 0 → no Q14 at all; the account is merged on the row alone.
      expect(result.entryIds).toHaveLength(0);
      const entriesAfter = (await sql`SELECT count(*)::int AS n FROM ledger_entry
                                        WHERE project_id = ${ctx.projectId}`) as Array<{ n: number }>;
      expect(entriesAfter[0]!.n).toBe(entriesBefore[0]!.n);
      expect((await accountRow(sql, ctx))?.status).toBe("merged");

      // T41: split 80 on a cash of 50 → E-SPLIT-AMOUNT.
      await expect(split(sql, ctx, 80_000)).rejects.toMatchObject({ code: "E-SPLIT-AMOUNT" });

      await assertLedgerCoreInvariants(await ledgerState(sql, ctx.projectId));
    });
  });

  it("T59 — split with amount 0: account active, no ledger entry", async () => {
    const ctx = await newProject(TWO_KNOWN(70_000, 0));
    await withSql(async sql => {
      await merge(sql, ctx);
      const entriesBefore = (await sql`SELECT count(*)::int AS n FROM ledger_entry
                                         WHERE project_id = ${ctx.projectId}`) as Array<{ n: number }>;

      const result = await split(sql, ctx, 0);

      expect(result.entryIds).toHaveLength(0);
      const entriesAfter = (await sql`SELECT count(*)::int AS n FROM ledger_entry
                                        WHERE project_id = ${ctx.projectId}`) as Array<{ n: number }>;
      expect(entriesAfter[0]!.n).toBe(entriesBefore[0]!.n);
      expect((await accountRow(sql, ctx))?.status).toBe("active");
      expect(await boxBalance(sql, ctx.projectId, "cash")).toBe(70_000);

      await assertLedgerCoreInvariants(await ledgerState(sql, ctx.projectId));
    });
  });
});

/* ── 5. T47/T53: E-MERGE-UNKNOWN on both sides ────────────────────────── */

describe("M4.1 — the unknown-opening blocks", () => {
  it("T47 — account opening unknown: merge rejected E-MERGE-UNKNOWN", async () => {
    const ctx = await newProject([
      { kind: "cash", opening: { openingFils: 100_000 } },
      { kind: "account", opening: { unknown: true } },
    ]);
    await withSql(async sql => {
      await expect(merge(sql, ctx)).rejects.toMatchObject({ code: "E-MERGE-UNKNOWN" });
      expect((await accountRow(sql, ctx))?.status).toBe("active");
    });
  });

  it("T53 — cash opening unknown (two boxes): merge rejected E-MERGE-UNKNOWN", async () => {
    const ctx = await newProject([
      { kind: "cash", opening: { unknown: true } },
      { kind: "account", opening: { openingFils: 60_000 } },
    ]);
    await withSql(async sql => {
      await expect(merge(sql, ctx)).rejects.toMatchObject({ code: "E-MERGE-UNKNOWN" });
    });
  });

  it("split with a cash opening of unknown is E-MERGE-UNKNOWN too", async () => {
    // Cash unknown + account known → merge blocked, so build the merged
    // state directly: both known, merge, then flip the cash opening to
    // unknown (the §7.3 flag lives on the box row).
    const ctx = await newProject(TWO_KNOWN(70_000, 0));
    await withSql(async sql => {
      await merge(sql, ctx);
      await sql`UPDATE box SET opening_status = 'unknown'
                 WHERE project_id = ${ctx.projectId} AND kind = 'cash'`;
      await expect(split(sql, ctx, 10_000)).rejects.toMatchObject({ code: "E-MERGE-UNKNOWN" });
      expect((await accountRow(sql, ctx))?.status).toBe("merged");
    });
  });
});

/* ── 6. The state rejections and the merged box's closure ─────────────── */

describe("M4.1 — E-BOX-STATE and the merged box accepts no operations", () => {
  it("rejects a merge with no account row, a double merge, and a split on an active account", async () => {
    const cashOnly = await newProject([{ kind: "cash", opening: { openingFils: 50_000 } }]);
    await withSql(async sql => {
      await expect(merge(sql, cashOnly)).rejects.toMatchObject({ code: "E-BOX-STATE" });
      await expect(split(sql, cashOnly, 10_000)).rejects.toMatchObject({ code: "E-BOX-STATE" });
    });

    const two = await newProject(TWO_KNOWN(100_000, 60_000));
    await withSql(async sql => {
      await expect(split(sql, two, 10_000)).rejects.toMatchObject({ code: "E-BOX-STATE" });
      await merge(sql, two);
      // A second merge: the account is already merged.
      await expect(merge(sql, two)).rejects.toMatchObject({ code: "E-BOX-STATE" });
      // The merged account accepts no operations (§5): a transfer to it
      // is E-BOX-STATE.
      await expect(
        runPlan(sql, () =>
          planTransfer({
            projectId: two.projectId,
            createdByAccountId: two.owner,
            requestId: `m41-${crypto.randomUUID()}`,
            today: AMMAN_TODAY,
            fromBox: "cash",
            toBox: "account",
            amountFils: 10_000,
          }),
        ),
      ).rejects.toMatchObject({ code: "E-BOX-STATE" });
    });
  });

  it("rejects a negative split amount as malformed input (E-AMOUNT)", async () => {
    const ctx = await newProject(TWO_KNOWN(70_000, 0));
    await withSql(async sql => {
      await merge(sql, ctx);
      await expect(split(sql, ctx, -5_000)).rejects.toMatchObject({ code: "E-AMOUNT" });
    });
  });
});

/* ── 7. R-25 replay and the HTTP routes ───────────────────────────────── */

describe("M4.1 — R-25 replay and the routes", () => {
  it("replays a retried merge and a retried split byte-identically", async () => {
    const ctx = await newProject(TWO_KNOWN(100_000, 60_000));
    await withSql(async sql => {
      const mergeRequestId = `m41-merge-retry-${suffix()}`;
      const makeMerge = () =>
        planMergeBoxes({
          projectId: ctx.projectId,
          createdByAccountId: ctx.owner,
          requestId: mergeRequestId,
          today: AMMAN_TODAY,
        });
      const first = await runPlan(sql, makeMerge);
      const retry = await runPlan(sql, makeMerge);
      expect(first.outcome).toBe("applied");
      expect(retry.outcome).toBe("replay");
      expect((retry as { result: unknown }).result).toEqual((first as { result: unknown }).result);

      const splitRequestId = `m41-split-retry-${suffix()}`;
      const makeSplit = () =>
        planSplitBoxes({
          projectId: ctx.projectId,
          createdByAccountId: ctx.owner,
          requestId: splitRequestId,
          today: AMMAN_TODAY,
          amountFils: 20_000,
        });
      const firstSplit = await runPlan(sql, makeSplit);
      const retrySplit = await runPlan(sql, makeSplit);
      expect(firstSplit.outcome).toBe("applied");
      expect(retrySplit.outcome).toBe("replay");
      expect((retrySplit as { result: unknown }).result).toEqual((firstSplit as { result: unknown }).result);
      expect(await boxBalance(sql, ctx.projectId, "account")).toBe(20_000);

      await assertLedgerCoreInvariants(await ledgerState(sql, ctx.projectId));
    });
  });

  it("serves /merge-boxes and /split-boxes over HTTP: 200, and 400 with the code", async () => {
    const sub = `m41-route-${suffix()}`;
    const session = await signInAs(worker, { sub, email: `${sub}@example.com` });
    const setup = await apiPost(worker, session.cookieHeader, "/api/manage-v2/setup", {
      requestId: `m41-${crypto.randomUUID()}`,
      projectName: "مشروع الصناديق",
      boxes: TWO_KNOWN(100_000, 60_000),
    });
    expect(setup.status).toBe(200);
    const projectId = ((await setup.json()) as { projectId: string }).projectId;

    const merged = await apiPost(worker, session.cookieHeader, "/api/manage-v2/merge-boxes", {
      requestId: `m41-${crypto.randomUUID()}`,
      projectId,
    });
    expect(merged.status).toBe(200);
    const mergedBody = (await merged.json()) as { outcome: string; result: { data: unknown } };
    expect(mergedBody.outcome).toBe("applied");

    const over = await apiPost(worker, session.cookieHeader, "/api/manage-v2/split-boxes", {
      requestId: `m41-${crypto.randomUUID()}`,
      projectId,
      amountFils: 999_000,
    });
    expect(over.status).toBe(400);
    expect(((await over.json()) as { error: { details: { code: string } } }).error.details.code).toBe(
      "E-SPLIT-AMOUNT",
    );

    const split = await apiPost(worker, session.cookieHeader, "/api/manage-v2/split-boxes", {
      requestId: `m41-${crypto.randomUUID()}`,
      projectId,
      amountFils: 40_000,
    });
    expect(split.status).toBe(200);
    expect(((await split.json()) as { outcome: string }).outcome).toBe("applied");
  });
});
