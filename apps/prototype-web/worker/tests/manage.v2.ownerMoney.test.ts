/**
 * M2.7 acceptance (Manage v2 phase 2, wave G — spec §5 OP-OWNER-DEPOSIT /
 * OP-OWNER-WITHDRAWAL / OP-TRANSFER, §4 Q10–Q14, R-9, R-12, R-13, R-26;
 * tests S6, S9, T9, T10, T25 start state, T55): owner money movements and
 * transfers between boxes, with the borrowed-money case (a deposit that
 * creates a payable) exactly as §5 describes.
 *
 * Tests-first: this file was written before the operations existed and fails
 * with "Cannot find module … operations/ownerMoney.js".
 *
 * Scope notes (mirroring the M2.6/T29 precedent, documented in the report):
 *  - S6's SECOND half («سداده» — paying the borrowed line) is OP-PAY, owned
 *    by M2.8; this file owns the borrow half (cash +50, payable 50, profit 0).
 *  - T9/T10 are tested at the level M2.7 owns: the Q14 entry effects the
 *    merge (account→cash |b|) and split (cash→account a) are built on. The
 *    box-status transitions (`merged`/`active`) and the merge/split-specific
 *    validations (E-MERGE-UNKNOWN, E-SPLIT-AMOUNT…) are OP-MERGE-BOXES /
 *    OP-SPLIT-BOXES, owned by M4.1.
 *  - T25's write-off half is OP-WRITE-OFF, owned by M2.9; the lend half
 *    (cash −50, receivable 50, withdrawals and profit unchanged) is here.
 *
 * Posture: Miniflare over the per-file isolated PostgreSQL (migrations
 * 0001–0019). The planners run through the same composition the route
 * performs (runPlan) against the real database; the HTTP routes are exercised
 * end-to-end (signInAs + apiPost). Money is integer fils: "50" in the spec's
 * table is 50_000 fils. The domain has no clock — `today` is passed in.
 * Every acceptance path ends with assertLedgerCoreInvariants (INV-1 + INV-2).
 */
import type postgres from "postgres";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { apiPost, signInAs, startWorker, type WorkerInstance } from "./harness.ts";
import {
  accountTotal,
  boxBalance,
  boxIdOf,
  fileSqlUrl,
  ledgerState,
  linesWithOutstanding,
  operationRows,
  resultOf,
  runPlan,
  scopedClient,
  setupProject,
} from "./manage.v2.helpers.ts";
import {
  planOwnerDeposit,
  planOwnerWithdrawal,
  type OwnerDepositInput,
  type OwnerWithdrawalInput,
} from "../../../../src/domain/manage/operations/ownerMoney.js";
import { planTransfer, type TransferInput } from "../../../../src/domain/manage/operations/transfer.js";
import type { SetupBoxSlot } from "../../../../src/domain/manage/operations/setup.js";
import type { OperationPlan } from "../../../../src/domain/manage/operations/support.js";
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

/** A request-scoped single-connection client, always released. */
async function withSql<T>(run: (sql: postgres.Sql) => Promise<T>): Promise<T> {
  const sql = scopedClient(dbUrl);
  try {
    return await run(sql);
  } finally {
    await sql.end();
  }
}

/** A project set up through the real composition. Default: one cash box
 * with a KNOWN opening of 0 (the §13 default). */
async function newProject(boxes: SetupBoxSlot[] = [{ kind: "cash", opening: { openingFils: 0 } }]) {
  const projectId = crypto.randomUUID();
  const owner = `m27-owner-${suffix()}`;
  await withSql(sql => setupProject(sql, { projectId, owner, today: AMMAN_TODAY, boxes }));
  return { projectId, owner };
}

const PERSONAL: Record<string, unknown> = { type: "personal" };
const borrowed = (name: string): Record<string, unknown> => ({ type: "borrowed", name });
const loanGiven = (name: string): Record<string, unknown> => ({ type: "loan_given", name });

/** The planner inputs exactly as the routes build them from the bodies. */
function depositInput(
  ctx: { projectId: string; owner: string },
  requestId: string,
  input: { amountFils: number; box: string; source: Record<string, unknown>; effectiveOn?: string },
): OwnerDepositInput {
  return {
    projectId: ctx.projectId,
    createdByAccountId: ctx.owner,
    requestId,
    today: AMMAN_TODAY,
    amountFils: input.amountFils,
    box: input.box,
    source: input.source,
    ...(input.effectiveOn === undefined ? {} : { effectiveOn: input.effectiveOn }),
  };
}

function withdrawalInput(
  ctx: { projectId: string; owner: string },
  requestId: string,
  input: { amountFils: number; box: string; type: Record<string, unknown>; effectiveOn?: string },
): OwnerWithdrawalInput {
  return {
    projectId: ctx.projectId,
    createdByAccountId: ctx.owner,
    requestId,
    today: AMMAN_TODAY,
    amountFils: input.amountFils,
    box: input.box,
    type: input.type,
    ...(input.effectiveOn === undefined ? {} : { effectiveOn: input.effectiveOn }),
  };
}

function transferInput(
  ctx: { projectId: string; owner: string },
  requestId: string,
  input: { fromBox: string; toBox: string; amountFils: number; effectiveOn?: string },
): TransferInput {
  return {
    projectId: ctx.projectId,
    createdByAccountId: ctx.owner,
    requestId,
    today: AMMAN_TODAY,
    fromBox: input.fromBox,
    toBox: input.toBox,
    amountFils: input.amountFils,
    ...(input.effectiveOn === undefined ? {} : { effectiveOn: input.effectiveOn }),
  };
}

const depositPlan = (
  ctx: { projectId: string; owner: string },
  requestId: string,
  input: Parameters<typeof depositInput>[2],
): OperationPlan => planOwnerDeposit(depositInput(ctx, requestId, input));

const withdrawalPlan = (
  ctx: { projectId: string; owner: string },
  requestId: string,
  input: Parameters<typeof withdrawalInput>[2],
): OperationPlan => planOwnerWithdrawal(withdrawalInput(ctx, requestId, input));

const transferPlan = (
  ctx: { projectId: string; owner: string },
  requestId: string,
  input: Parameters<typeof transferInput>[2],
): OperationPlan => planTransfer(transferInput(ctx, requestId, input));

interface PostingRow {
  account: string;
  refId: string | null;
  category: string | null;
  deltaFils: number;
}

interface EntryRow {
  type: string;
  effectiveOn: string;
  postings: PostingRow[];
}

function byAccount(a: PostingRow, b: PostingRow): number {
  return a.account.localeCompare(b.account) || a.deltaFils - b.deltaFils;
}

/** The operation's entries in the order the handler wrote them
 * (result.entryIds); an entry's postings sorted by account. */
async function entriesInOrder(sql: postgres.Sql, projectId: string, entryIds: string[]): Promise<EntryRow[]> {
  const entries =
    await sql`SELECT id, entry_type, effective_on::text AS effective_on FROM ledger_entry WHERE project_id = ${projectId}`;
  const postings =
    await sql`SELECT entry_id, account, ref_id, category, delta_minor FROM ledger_posting WHERE project_id = ${projectId}`;
  return entryIds.map(id => {
    const entry = entries.find(e => e.id === id);
    if (entry === undefined) throw new Error(`entry ${id} not found`);
    return {
      type: String(entry.entry_type),
      effectiveOn: String(entry.effective_on),
      postings: postings
        .filter(p => p.entry_id === id)
        .map(p => ({
          account: String(p.account),
          refId: p.ref_id === null ? null : String(p.ref_id),
          category: p.category === null ? null : String(p.category),
          deltaFils: Number(p.delta_minor),
        }))
        .sort(byAccount),
    };
  });
}

async function ownerRows(sql: postgres.Sql, projectId: string) {
  return (await operationRows(sql, projectId)).filter(
    row =>
      row.kind === "OP-OWNER-DEPOSIT" || row.kind === "OP-OWNER-WITHDRAWAL" || row.kind === "OP-TRANSFER",
  );
}

/** Rows a refused plan must leave behind: none (the reservation rolls back
 * with the transaction — R-12). */
async function persistedWriteCount(sql: postgres.Sql, projectId: string): Promise<number> {
  const operations = await sql`SELECT count(*)::int AS n FROM operation
    WHERE project_id = ${projectId}
      AND kind IN ('OP-OWNER-DEPOSIT', 'OP-OWNER-WITHDRAWAL', 'OP-TRANSFER')`;
  const reservations =
    await sql`SELECT count(*)::int AS n FROM manage_v2_idempotency WHERE project_id = ${projectId} AND request_id LIKE 'req-%'`;
  return Number(operations[0]!.n) + Number(reservations[0]!.n);
}

/** Profit never moves on an owner movement or a transfer (INV-5): revenue
 * and expenses are exactly the opening values (0 in these projects). */
async function expectProfitUntouched(sql: postgres.Sql, projectId: string): Promise<void> {
  expect(await accountTotal(sql, projectId, "REV")).toBe(0);
  expect(await accountTotal(sql, projectId, "EXP")).toBe(0);
}

async function expectRejected(
  ctx: { projectId: string; owner: string },
  make: (requestId: string) => OperationPlan,
  code: RegExp,
): Promise<void> {
  await withSql(sql => expect(runPlan(sql, () => make(`req-${suffix()}`))).rejects.toThrow(code));
}

/* ── 1. S6 (borrow half): OP-OWNER-DEPOSIT borrowed ────────────────────── */

describe("M2.7 S6 — deposit 50 borrowed from أخي", () => {
  it("posts Q11: cash +50, payable 50 on a new borrowed line, profit 0", async () => {
    const ctx = await newProject();
    const result = resultOf(
      await withSql(sql =>
        runPlan(sql, () =>
          depositPlan(ctx, `req-${suffix()}`, { amountFils: 50_000, box: "cash", source: borrowed("أخي") }),
        ),
      ),
      "applied",
    );
    expect(result.kind).toBe("OP-OWNER-DEPOSIT");
    expect(result.amountFils).toBe(50_000);
    await withSql(async sql => {
      const cashId = await boxIdOf(sql, ctx.projectId, "cash");
      const lines = await linesWithOutstanding(sql, ctx.projectId);
      expect(lines).toHaveLength(1);
      const line = lines[0]!;
      expect(line).toMatchObject({
        direction: "by_me",
        kind: "borrowed",
        counterpartyName: "أخي",
        originOn: AMMAN_TODAY,
        outstanding: 50_000,
      });
      expect(await boxBalance(sql, ctx.projectId, "cash")).toBe(50_000);
      expect(await accountTotal(sql, ctx.projectId, "AP")).toBe(50_000);
      expect(await accountTotal(sql, ctx.projectId, "OWN_IN")).toBe(0);
      expect(await accountTotal(sql, ctx.projectId, "OWN_OUT")).toBe(0);
      await expectProfitUntouched(sql, ctx.projectId);
      expect(await entriesInOrder(sql, ctx.projectId, result.entryIds)).toEqual([
        {
          type: "Q11",
          effectiveOn: AMMAN_TODAY,
          postings: [
            { account: "AP", refId: line.id, category: null, deltaFils: 50_000 },
            { account: "BOX", refId: cashId, category: null, deltaFils: 50_000 },
          ],
        },
      ]);
      const rows = await ownerRows(sql, ctx.projectId);
      expect(rows).toHaveLength(1);
      expect(rows[0]).toMatchObject({
        kind: "OP-OWNER-DEPOSIT",
        status: "active",
        effectiveOn: AMMAN_TODAY,
        boxId: cashId,
        balanceLineId: line.id,
        counterpartyName: "أخي",
        amountMinor: 50_000,
      });
      assertLedgerCoreInvariants(await ledgerState(sql, ctx.projectId));
    });
  });

  it("personal deposit posts Q10 only: OWN_IN +a, no balance line", async () => {
    const ctx = await newProject();
    const result = resultOf(
      await withSql(sql =>
        runPlan(sql, () =>
          depositPlan(ctx, `req-${suffix()}`, { amountFils: 80_000, box: "cash", source: PERSONAL }),
        ),
      ),
      "applied",
    );
    expect(result.kind).toBe("OP-OWNER-DEPOSIT");
    await withSql(async sql => {
      const cashId = await boxIdOf(sql, ctx.projectId, "cash");
      expect(await boxBalance(sql, ctx.projectId, "cash")).toBe(80_000);
      expect(await accountTotal(sql, ctx.projectId, "OWN_IN")).toBe(80_000);
      expect(await accountTotal(sql, ctx.projectId, "AP")).toBe(0);
      expect(await linesWithOutstanding(sql, ctx.projectId)).toHaveLength(0);
      await expectProfitUntouched(sql, ctx.projectId);
      expect(await entriesInOrder(sql, ctx.projectId, result.entryIds)).toEqual([
        {
          type: "Q10",
          effectiveOn: AMMAN_TODAY,
          postings: [
            { account: "BOX", refId: cashId, category: null, deltaFils: 80_000 },
            { account: "OWN_IN", refId: null, category: null, deltaFils: 80_000 },
          ],
        },
      ]);
      assertLedgerCoreInvariants(await ledgerState(sql, ctx.projectId));
    });
  });
});

/* ── 2. S9: OP-OWNER-WITHDRAWAL personal ───────────────────────────────── */

describe("M2.7 S9 — withdrawal 200", () => {
  it("posts Q12: cash −200, OWN_OUT +200, profit unchanged", async () => {
    // The §13 default opening is 0 (known): the withdrawal leaves cash at
    // −200_000 — accepted (R-12: a negative BOX is never a rejection) and,
    // by the T8 box-state rule, warned about (w.negative_box). The S9 line
    // states the figures and does not negate the warning.
    const ctx = await newProject();
    const result = resultOf(
      await withSql(sql =>
        runPlan(sql, () =>
          withdrawalPlan(ctx, `req-${suffix()}`, { amountFils: 200_000, box: "cash", type: PERSONAL }),
        ),
      ),
      "applied",
    );
    expect(result.kind).toBe("OP-OWNER-WITHDRAWAL");
    expect(result.amountFils).toBe(200_000);
    expect(result.data).toEqual({ warnings: ["w.negative_box"] });
    await withSql(async sql => {
      const cashId = await boxIdOf(sql, ctx.projectId, "cash");
      expect(await boxBalance(sql, ctx.projectId, "cash")).toBe(-200_000);
      expect(await accountTotal(sql, ctx.projectId, "OWN_OUT")).toBe(200_000);
      expect(await accountTotal(sql, ctx.projectId, "OWN_IN")).toBe(0);
      expect(await linesWithOutstanding(sql, ctx.projectId)).toHaveLength(0);
      await expectProfitUntouched(sql, ctx.projectId);
      expect(await entriesInOrder(sql, ctx.projectId, result.entryIds)).toEqual([
        {
          type: "Q12",
          effectiveOn: AMMAN_TODAY,
          postings: [
            { account: "BOX", refId: cashId, category: null, deltaFils: -200_000 },
            { account: "OWN_OUT", refId: null, category: null, deltaFils: 200_000 },
          ],
        },
      ]);
      assertLedgerCoreInvariants(await ledgerState(sql, ctx.projectId));
    });
  });

  it("does not warn when the box stays non-negative", async () => {
    const ctx = await newProject([{ kind: "cash", opening: { openingFils: 500_000 } }]);
    const result = resultOf(
      await withSql(sql =>
        runPlan(sql, () =>
          withdrawalPlan(ctx, `req-${suffix()}`, { amountFils: 200_000, box: "cash", type: PERSONAL }),
        ),
      ),
      "applied",
    );
    expect(result.data).toBeUndefined();
    await withSql(async sql => {
      expect(await boxBalance(sql, ctx.projectId, "cash")).toBe(300_000);
      assertLedgerCoreInvariants(await ledgerState(sql, ctx.projectId));
    });
  });

  it("does not warn for a box whose opening is unknown (the balance is unknown, not negative)", async () => {
    const ctx = await newProject([{ kind: "cash", opening: { unknown: true } }]);
    const result = resultOf(
      await withSql(sql =>
        runPlan(sql, () =>
          withdrawalPlan(ctx, `req-${suffix()}`, { amountFils: 90_000, box: "cash", type: PERSONAL }),
        ),
      ),
      "applied",
    );
    expect(result.data).toBeUndefined();
    await withSql(async sql => {
      expect(await boxBalance(sql, ctx.projectId, "cash")).toBe(-90_000);
      assertLedgerCoreInvariants(await ledgerState(sql, ctx.projectId));
    });
  });
});

/* ── 3. T25 start: OP-OWNER-WITHDRAWAL loan_given ──────────────────────── */

describe("M2.7 T25 start — lend 50 to أخت", () => {
  it("posts Q13: cash −50, receivable 50 on a loan_given line; withdrawals and profit unchanged", async () => {
    // T25's write-off half («then write-off → withdrawals +50») is OP-WRITE-OFF,
    // owned by M2.9. Here: after the lend, withdrawals stay 0 — a loan given
    // never counts as a personal withdrawal unless written off (§5).
    const ctx = await newProject([{ kind: "cash", opening: { openingFils: 500_000 } }]);
    const result = resultOf(
      await withSql(sql =>
        runPlan(sql, () =>
          withdrawalPlan(ctx, `req-${suffix()}`, { amountFils: 50_000, box: "cash", type: loanGiven("أخت") }),
        ),
      ),
      "applied",
    );
    expect(result.kind).toBe("OP-OWNER-WITHDRAWAL");
    await withSql(async sql => {
      const cashId = await boxIdOf(sql, ctx.projectId, "cash");
      const lines = await linesWithOutstanding(sql, ctx.projectId);
      expect(lines).toHaveLength(1);
      const line = lines[0]!;
      expect(line).toMatchObject({
        direction: "to_me",
        kind: "loan_given",
        counterpartyName: "أخت",
        originOn: AMMAN_TODAY,
        outstanding: 50_000,
      });
      expect(await boxBalance(sql, ctx.projectId, "cash")).toBe(450_000);
      expect(await accountTotal(sql, ctx.projectId, "AR")).toBe(50_000);
      expect(await accountTotal(sql, ctx.projectId, "OWN_OUT")).toBe(0);
      await expectProfitUntouched(sql, ctx.projectId);
      expect(await entriesInOrder(sql, ctx.projectId, result.entryIds)).toEqual([
        {
          type: "Q13",
          effectiveOn: AMMAN_TODAY,
          postings: [
            { account: "AR", refId: line.id, category: null, deltaFils: 50_000 },
            { account: "BOX", refId: cashId, category: null, deltaFils: -50_000 },
          ],
        },
      ]);
      const rows = await ownerRows(sql, ctx.projectId);
      expect(rows).toHaveLength(1);
      expect(rows[0]).toMatchObject({
        kind: "OP-OWNER-WITHDRAWAL",
        balanceLineId: line.id,
        counterpartyName: "أخت",
        amountMinor: 50_000,
      });
      assertLedgerCoreInvariants(await ledgerState(sql, ctx.projectId));
    });
  });
});

/* ── 4. T9/T10: the Q14 transfer effects merge/split are built on ───────── */

describe("M2.7 T9/T10 — transfers keep totals and profit", () => {
  it("T9 — transfer account→cash 60: Q14, cash 160, account 0, totals and profit unchanged", async () => {
    // The merge of T9 posts exactly this Q14 (b > 0: account → cash b); the
    // `status = merged` transition itself is OP-MERGE-BOXES (M4.1).
    const ctx = await newProject([
      { kind: "cash", opening: { openingFils: 100_000 } },
      { kind: "account", opening: { openingFils: 60_000 } },
    ]);
    const result = resultOf(
      await withSql(sql =>
        runPlan(sql, () =>
          transferPlan(ctx, `req-${suffix()}`, { fromBox: "account", toBox: "cash", amountFils: 60_000 }),
        ),
      ),
      "applied",
    );
    expect(result.kind).toBe("OP-TRANSFER");
    expect(result.amountFils).toBe(60_000);
    await withSql(async sql => {
      const cashId = await boxIdOf(sql, ctx.projectId, "cash");
      const accountId = await boxIdOf(sql, ctx.projectId, "account");
      expect(await boxBalance(sql, ctx.projectId, "cash")).toBe(160_000);
      expect(await boxBalance(sql, ctx.projectId, "account")).toBe(0);
      // Transfers keep totals: 100 + 60 before, 160 + 0 after.
      expect(await accountTotal(sql, ctx.projectId, "BOX")).toBe(160_000);
      await expectProfitUntouched(sql, ctx.projectId);
      expect(await linesWithOutstanding(sql, ctx.projectId)).toHaveLength(0);
      expect(await entriesInOrder(sql, ctx.projectId, result.entryIds)).toEqual([
        {
          type: "Q14",
          effectiveOn: AMMAN_TODAY,
          postings: [
            { account: "BOX", refId: accountId, category: null, deltaFils: -60_000 },
            { account: "BOX", refId: cashId, category: null, deltaFils: 60_000 },
          ],
        },
      ]);
      const rows = await ownerRows(sql, ctx.projectId);
      expect(rows).toHaveLength(1);
      expect(rows[0]).toMatchObject({ kind: "OP-TRANSFER", boxId: accountId, amountMinor: 60_000 });
      assertLedgerCoreInvariants(await ledgerState(sql, ctx.projectId));
    });
  });

  it("T10 — after T9, transfer cash→account 40: Q14, cash 120, account 40, totals unchanged", async () => {
    // The split of T10 posts exactly this Q14 (cash → account, user amount);
    // the `status = active` transition and E-SPLIT-AMOUNT are OP-SPLIT-BOXES
    // (M4.1).
    const ctx = await newProject([
      { kind: "cash", opening: { openingFils: 100_000 } },
      { kind: "account", opening: { openingFils: 60_000 } },
    ]);
    await withSql(sql =>
      runPlan(sql, () =>
        transferPlan(ctx, `req-${suffix()}`, { fromBox: "account", toBox: "cash", amountFils: 60_000 }),
      ),
    );
    const result = resultOf(
      await withSql(sql =>
        runPlan(sql, () =>
          transferPlan(ctx, `req-${suffix()}`, { fromBox: "cash", toBox: "account", amountFils: 40_000 }),
        ),
      ),
      "applied",
    );
    expect(result.kind).toBe("OP-TRANSFER");
    await withSql(async sql => {
      expect(await boxBalance(sql, ctx.projectId, "cash")).toBe(120_000);
      expect(await boxBalance(sql, ctx.projectId, "account")).toBe(40_000);
      expect(await accountTotal(sql, ctx.projectId, "BOX")).toBe(160_000);
      await expectProfitUntouched(sql, ctx.projectId);
      assertLedgerCoreInvariants(await ledgerState(sql, ctx.projectId));
    });
  });

  it("warns w.negative_box when the from-box ends below zero", async () => {
    const ctx = await newProject([
      { kind: "cash", opening: { openingFils: 100_000 } },
      { kind: "account", opening: { openingFils: 0 } },
    ]);
    const result = resultOf(
      await withSql(sql =>
        runPlan(sql, () =>
          transferPlan(ctx, `req-${suffix()}`, { fromBox: "cash", toBox: "account", amountFils: 160_000 }),
        ),
      ),
      "applied",
    );
    expect(result.data).toEqual({ warnings: ["w.negative_box"] });
    await withSql(async sql => {
      expect(await boxBalance(sql, ctx.projectId, "cash")).toBe(-60_000);
      expect(await boxBalance(sql, ctx.projectId, "account")).toBe(160_000);
      expect(await accountTotal(sql, ctx.projectId, "BOX")).toBe(100_000);
      assertLedgerCoreInvariants(await ledgerState(sql, ctx.projectId));
    });
  });
});

/* ── 5. Validation: the §5 contract and §11 rejections ─────────────────── */

describe("M2.7 — validation and rejections", () => {
  it("rejects malformed amounts, sources, types and a self-transfer with E-AMOUNT", async () => {
    const ctx = await newProject([
      { kind: "cash", opening: { openingFils: 500_000 } },
      { kind: "account", opening: { openingFils: 0 } },
    ]);
    await expectRejected(
      ctx,
      id => depositPlan(ctx, id, { amountFils: 0, box: "cash", source: PERSONAL }),
      /E-AMOUNT/,
    );
    await expectRejected(
      ctx,
      id => depositPlan(ctx, id, { amountFils: -5_000, box: "cash", source: PERSONAL }),
      /E-AMOUNT/,
    );
    await expectRejected(
      ctx,
      id => depositPlan(ctx, id, { amountFils: 12.5, box: "cash", source: PERSONAL }),
      /E-AMOUNT/,
    );
    await expectRejected(
      ctx,
      id =>
        depositPlan(ctx, id, {
          amountFils: 5_000,
          box: "cash",
          source: "cash" as unknown as Record<string, unknown>,
        }),
      /E-AMOUNT/,
    );
    await expectRejected(
      ctx,
      id => depositPlan(ctx, id, { amountFils: 5_000, box: "cash", source: { type: "gift" } }),
      /E-AMOUNT/,
    );
    await expectRejected(
      ctx,
      id => withdrawalPlan(ctx, id, { amountFils: 0, box: "cash", type: PERSONAL }),
      /E-AMOUNT/,
    );
    // The box is a §5 input: a missing box is an input rejection, not a guess.
    await expectRejected(
      ctx,
      id =>
        depositPlan(ctx, id, { amountFils: 5_000, box: undefined as unknown as string, source: PERSONAL }),
      /E-AMOUNT/,
    );
    await expectRejected(
      ctx,
      id =>
        withdrawalPlan(ctx, id, { amountFils: 5_000, box: undefined as unknown as string, type: PERSONAL }),
      /E-AMOUNT/,
    );
    await expectRejected(
      ctx,
      id => withdrawalPlan(ctx, id, { amountFils: 5_000, box: "cash", type: { type: "gift", name: "سامي" } }),
      /E-AMOUNT/,
    );
    await expectRejected(
      ctx,
      id => transferPlan(ctx, id, { fromBox: "cash", toBox: "cash", amountFils: 5_000 }),
      /E-AMOUNT/,
    );
    await expectRejected(
      ctx,
      id => transferPlan(ctx, id, { fromBox: "cash", toBox: "account", amountFils: 0 }),
      /E-AMOUNT/,
    );
    await withSql(async sql => {
      expect(await persistedWriteCount(sql, ctx.projectId)).toBe(0);
      assertLedgerCoreInvariants(await ledgerState(sql, ctx.projectId));
    });
  });

  it("requires a name for borrowed and loan_given: E-NAME-REQUIRED", async () => {
    const ctx = await newProject();
    await expectRejected(
      ctx,
      id => depositPlan(ctx, id, { amountFils: 5_000, box: "cash", source: { type: "borrowed" } }),
      /E-NAME-REQUIRED/,
    );
    await expectRejected(
      ctx,
      id => depositPlan(ctx, id, { amountFils: 5_000, box: "cash", source: borrowed("   ") }),
      /E-NAME-REQUIRED/,
    );
    await expectRejected(
      ctx,
      id => withdrawalPlan(ctx, id, { amountFils: 5_000, box: "cash", type: { type: "loan_given" } }),
      /E-NAME-REQUIRED/,
    );
    await withSql(async sql => {
      expect(await persistedWriteCount(sql, ctx.projectId)).toBe(0);
    });
  });

  it("refuses a future effective_on: E-FUTURE-DATE (all three operations)", async () => {
    const ctx = await newProject([
      { kind: "cash", opening: { openingFils: 500_000 } },
      { kind: "account", opening: { openingFils: 0 } },
    ]);
    await expectRejected(
      ctx,
      id =>
        depositPlan(ctx, id, { amountFils: 5_000, box: "cash", source: PERSONAL, effectiveOn: "2026-11-28" }),
      /E-FUTURE-DATE/,
    );
    await expectRejected(
      ctx,
      id =>
        withdrawalPlan(ctx, id, {
          amountFils: 5_000,
          box: "cash",
          type: PERSONAL,
          effectiveOn: "2026-11-28",
        }),
      /E-FUTURE-DATE/,
    );
    await expectRejected(
      ctx,
      id =>
        transferPlan(ctx, id, {
          fromBox: "cash",
          toBox: "account",
          amountFils: 5_000,
          effectiveOn: "2026-11-28",
        }),
      /E-FUTURE-DATE/,
    );
    // A malformed date is an input rejection, not a future date.
    await expectRejected(
      ctx,
      id =>
        depositPlan(ctx, id, { amountFils: 5_000, box: "cash", source: PERSONAL, effectiveOn: "27-11-2026" }),
      /E-AMOUNT/,
    );
    await withSql(async sql => {
      expect(await persistedWriteCount(sql, ctx.projectId)).toBe(0);
    });
  });

  it("refuses a box of a kind the project does not have an active box of: E-BOX-STATE", async () => {
    const ctx = await newProject([{ kind: "cash", opening: { openingFils: 500_000 } }]);
    await expectRejected(
      ctx,
      id => depositPlan(ctx, id, { amountFils: 5_000, box: "account", source: PERSONAL }),
      /E-BOX-STATE/,
    );
    await expectRejected(
      ctx,
      id => withdrawalPlan(ctx, id, { amountFils: 5_000, box: "account", type: PERSONAL }),
      /E-BOX-STATE/,
    );
    await expectRejected(
      ctx,
      id => transferPlan(ctx, id, { fromBox: "cash", toBox: "account", amountFils: 5_000 }),
      /E-BOX-STATE/,
    );
    await withSql(async sql => {
      expect(await persistedWriteCount(sql, ctx.projectId)).toBe(0);
      assertLedgerCoreInvariants(await ledgerState(sql, ctx.projectId));
    });
  });

  it("carries a past effective_on onto the operation and its entries (R-26)", async () => {
    const ctx = await newProject([{ kind: "cash", opening: { openingFils: 500_000 } }]);
    const result = resultOf(
      await withSql(sql =>
        runPlan(sql, () =>
          depositPlan(ctx, `req-${suffix()}`, {
            amountFils: 25_000,
            box: "cash",
            source: PERSONAL,
            effectiveOn: "2026-11-20",
          }),
        ),
      ),
      "applied",
    );
    expect(result.effectiveOn).toBe("2026-11-20");
    await withSql(async sql => {
      const rows = await ownerRows(sql, ctx.projectId);
      expect(rows[0]).toMatchObject({ kind: "OP-OWNER-DEPOSIT", effectiveOn: "2026-11-20" });
      expect((await entriesInOrder(sql, ctx.projectId, result.entryIds))[0]).toMatchObject({
        type: "Q10",
        effectiveOn: "2026-11-20",
      });
      assertLedgerCoreInvariants(await ledgerState(sql, ctx.projectId));
    });
  });
});

/* ── 6. T55 / R-25: one request id → one operation ─────────────────────── */

describe("M2.7 T55 — retried owner money movements", () => {
  it("replays a borrowed deposit (fresh line id per planning) and answers a different body with a conflict", async () => {
    const ctx = await newProject();
    const requestId = `req-${suffix()}`;
    const input = { amountFils: 50_000, box: "cash", source: borrowed("أخي") };
    const first = resultOf(
      await withSql(sql => runPlan(sql, () => depositPlan(ctx, requestId, input))),
      "applied",
    );
    const again = resultOf(
      await withSql(sql => runPlan(sql, () => depositPlan(ctx, requestId, input))),
      "replay",
    );
    expect(again).toEqual(first);

    const conflict = await withSql(sql =>
      runPlan(sql, () =>
        depositPlan(ctx, requestId, { amountFils: 60_000, box: "cash", source: borrowed("أخي") }),
      ),
    );
    expect(conflict).toEqual({ outcome: "conflict", reason: "E-IDEMPOTENCY-CONFLICT" });

    await withSql(async sql => {
      const rows = await ownerRows(sql, ctx.projectId);
      expect(rows).toHaveLength(1);
      expect(await accountTotal(sql, ctx.projectId, "AP")).toBe(50_000);
      assertLedgerCoreInvariants(await ledgerState(sql, ctx.projectId));
    });
  });

  it("replays a transfer the same way", async () => {
    const ctx = await newProject([
      { kind: "cash", opening: { openingFils: 100_000 } },
      { kind: "account", opening: { openingFils: 0 } },
    ]);
    const requestId = `req-${suffix()}`;
    const input = { fromBox: "cash", toBox: "account", amountFils: 30_000 };
    const first = resultOf(
      await withSql(sql => runPlan(sql, () => transferPlan(ctx, requestId, input))),
      "applied",
    );
    const again = resultOf(
      await withSql(sql => runPlan(sql, () => transferPlan(ctx, requestId, input))),
      "replay",
    );
    expect(again).toEqual(first);
    await withSql(async sql => {
      expect(await boxBalance(sql, ctx.projectId, "cash")).toBe(70_000);
      expect(await boxBalance(sql, ctx.projectId, "account")).toBe(30_000);
      expect((await ownerRows(sql, ctx.projectId)).filter(r => r.kind === "OP-TRANSFER")).toHaveLength(1);
      assertLedgerCoreInvariants(await ledgerState(sql, ctx.projectId));
    });
  });
});

/* ── 7. The routes ─────────────────────────────────────────────────────── */

interface RouteResponse {
  outcome: string;
  result: { operationId: string; kind: string; amountFils: number; data?: unknown };
}

async function errorOf(response: Response): Promise<{ code: string; details: Record<string, unknown> }> {
  const body = (await response.json()) as { error: { code: string; details?: Record<string, unknown> } };
  return { code: body.error.code, details: body.error.details ?? {} };
}

describe("M2.7 — routes owner-deposit / owner-withdrawal / transfer", () => {
  it("apply, replay a retry and map §11 rejections end-to-end", async () => {
    const sub = `m27-route-${suffix()}`;
    const session = await signInAs(worker, { sub, email: `${sub}@example.com` });
    const setup = await apiPost(worker, session.cookieHeader, "/api/manage-v2/setup", {
      requestId: `route-${suffix()}`,
      projectName: "مشروع سامي",
      boxes: [
        { kind: "cash", opening: { openingFils: 20_000 } },
        { kind: "account", opening: { openingFils: 0 } },
      ],
    });
    expect(setup.status).toBe(200);
    const projectId = ((await setup.json()) as { projectId: string }).projectId;

    // S6 route half: a borrowed deposit.
    const depositBody = {
      requestId: `route-${suffix()}`,
      projectId,
      amountFils: 50_000,
      box: "cash",
      source: { type: "borrowed", name: "أخي" },
    };
    const deposit = await apiPost(worker, session.cookieHeader, "/api/manage-v2/owner-deposit", depositBody);
    expect(deposit.status).toBe(200);
    const depositBodyJson = (await deposit.json()) as RouteResponse;
    expect(depositBodyJson.outcome).toBe("applied");
    expect(depositBodyJson.result).toMatchObject({ kind: "OP-OWNER-DEPOSIT", amountFils: 50_000 });

    const depositRetry = await apiPost(
      worker,
      session.cookieHeader,
      "/api/manage-v2/owner-deposit",
      depositBody,
    );
    expect(depositRetry.status).toBe(200);
    expect(await depositRetry.json()).toMatchObject({ outcome: "replay", result: depositBodyJson.result });

    // S9 route: a personal withdrawal (cash 20 known → −180_000, warned).
    const withdrawal = await apiPost(worker, session.cookieHeader, "/api/manage-v2/owner-withdrawal", {
      requestId: `route-${suffix()}`,
      projectId,
      amountFils: 200_000,
      box: "cash",
      type: { type: "personal" },
    });
    expect(withdrawal.status).toBe(200);
    const withdrawalJson = (await withdrawal.json()) as RouteResponse;
    expect(withdrawalJson.result).toMatchObject({
      kind: "OP-OWNER-WITHDRAWAL",
      amountFils: 200_000,
      data: { warnings: ["w.negative_box"] },
    });

    // T9 route: the transfer.
    const transfer = await apiPost(worker, session.cookieHeader, "/api/manage-v2/transfer", {
      requestId: `route-${suffix()}`,
      projectId,
      fromBox: "account",
      toBox: "cash",
      amountFils: 10_000,
    });
    expect(transfer.status).toBe(200);
    expect(await transfer.json()).toMatchObject({
      outcome: "applied",
      result: { kind: "OP-TRANSFER", amountFils: 10_000 },
    });

    // §11 rejections end-to-end.
    const invalid = await apiPost(worker, session.cookieHeader, "/api/manage-v2/owner-deposit", {
      requestId: `route-${suffix()}`,
      projectId,
      amountFils: 0,
      box: "cash",
      source: { type: "personal" },
    });
    expect(invalid.status).toBe(400);
    expect((await errorOf(invalid)).details).toMatchObject({ code: "E-AMOUNT" });

    const unnamed = await apiPost(worker, session.cookieHeader, "/api/manage-v2/owner-withdrawal", {
      requestId: `route-${suffix()}`,
      projectId,
      amountFils: 5_000,
      box: "cash",
      type: { type: "loan_given", name: " " },
    });
    expect(unnamed.status).toBe(400);
    expect((await errorOf(unnamed)).details).toMatchObject({ code: "E-NAME-REQUIRED" });

    const badBox = await apiPost(worker, session.cookieHeader, "/api/manage-v2/transfer", {
      requestId: `route-${suffix()}`,
      projectId,
      fromBox: "cash",
      toBox: "cash",
      amountFils: 5_000,
    });
    expect(badBox.status).toBe(400);
    expect((await errorOf(badBox)).details).toMatchObject({ code: "E-AMOUNT" });

    // R-24: another account cannot write into this project, and the answer
    // does not differ from "you have no project".
    const otherSub = `m27-other-${suffix()}`;
    const other = await signInAs(worker, { sub: otherSub, email: `${otherSub}@example.com` });
    const foreign = await apiPost(worker, other.cookieHeader, "/api/manage-v2/owner-deposit", {
      requestId: `route-${suffix()}`,
      projectId,
      amountFils: 5_000,
      box: "cash",
      source: { type: "personal" },
    });
    expect(foreign.status).toBe(404);

    const anonymous = await apiPost(worker, null, "/api/manage-v2/transfer", {
      requestId: `route-${suffix()}`,
      fromBox: "cash",
      toBox: "account",
      amountFils: 5_000,
    });
    expect(anonymous.status).toBe(401);

    await withSql(async sql => {
      expect(await boxBalance(sql, projectId, "cash")).toBe(-120_000);
      expect(await boxBalance(sql, projectId, "account")).toBe(-10_000);
      expect(await accountTotal(sql, projectId, "AP")).toBe(50_000);
      expect(await accountTotal(sql, projectId, "OWN_OUT")).toBe(200_000);
      expect(await ownerRows(sql, projectId)).toHaveLength(3);
      assertLedgerCoreInvariants(await ledgerState(sql, projectId));
    });
  });
});
