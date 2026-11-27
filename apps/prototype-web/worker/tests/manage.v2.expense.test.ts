/**
 * M2.6 acceptance (Manage v2 phase 2, wave G — spec §5 OP-EXPENSE, §4
 * Q7/Q8/Q9/Q10, R-10, R-12, R-13, R-18, R-26; tests T8, T15, T16, T29 start
 * state, T30, T43): every expense variant the spec lists — full from a box,
 * full from personal money, credit, partial from a box, partial from personal
 * money — and the delivery-cost attribution.
 *
 * Tests-first: this file was written before the operation existed and failed
 * with "Cannot find module … operations/expense.js".
 *
 * Posture: Miniflare over the per-file isolated PostgreSQL (migrations
 * 0001–0019). The planner runs through the same composition the route
 * performs (runPlan) against the real database; the HTTP route is exercised
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
import { planExpense, type ExpenseInput } from "../../../../src/domain/manage/operations/expense.js";
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

const AMMAN_TODAY = "2026-11-26";

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
  const owner = `m26-owner-${suffix()}`;
  await withSql(sql => setupProject(sql, { projectId, owner, today: AMMAN_TODAY, boxes }));
  return { projectId, owner };
}

interface ExpenseCase {
  amountFils: number;
  category?: string;
  deliveryCostFils?: number;
  payment?: Record<string, unknown>;
  source?: string;
  supplierName?: string;
  effectiveOn?: string;
  note?: string;
}

const FULL: Record<string, unknown> = { type: "full" };
const CREDIT: Record<string, unknown> = { type: "credit" };
const partial = (paidFils: number): Record<string, unknown> => ({ type: "partial", paidFils });

/** The planner input exactly as the route would build it from the body. */
function expenseInput(
  ctx: { projectId: string; owner: string },
  requestId: string,
  input: ExpenseCase,
): ExpenseInput {
  const { projectId, owner } = ctx;
  return {
    projectId,
    createdByAccountId: owner,
    requestId,
    today: AMMAN_TODAY,
    amountFils: input.amountFils,
    category: input.category ?? "materials_packaging",
    ...(input.deliveryCostFils === undefined ? {} : { deliveryCostFils: input.deliveryCostFils }),
    payment: input.payment ?? FULL,
    ...(input.source === undefined ? {} : { source: input.source }),
    ...(input.supplierName === undefined ? {} : { supplierName: input.supplierName }),
    ...(input.effectiveOn === undefined ? {} : { effectiveOn: input.effectiveOn }),
    ...(input.note === undefined ? {} : { note: input.note }),
  };
}

/** OP-EXPENSE planned from that input (the plan runPlan composes). */
function expensePlan(
  ctx: { projectId: string; owner: string },
  requestId: string,
  input: ExpenseCase,
): OperationPlan {
  return planExpense(expenseInput(ctx, requestId, input));
}

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

async function expenseRows(sql: postgres.Sql, projectId: string) {
  return (await operationRows(sql, projectId)).filter(row => row.kind === "OP-EXPENSE");
}

/** Rows a refused plan must leave behind: none (the reservation rolls back
 * with the transaction — R-12). */
async function persistedWriteCount(sql: postgres.Sql, projectId: string): Promise<number> {
  const operations =
    await sql`SELECT count(*)::int AS n FROM operation WHERE project_id = ${projectId} AND kind = 'OP-EXPENSE'`;
  const reservations =
    await sql`SELECT count(*)::int AS n FROM manage_v2_idempotency WHERE project_id = ${projectId} AND request_id LIKE 'req-%'`;
  return Number(operations[0]!.n) + Number(reservations[0]!.n);
}

async function expectRejected(
  ctx: { projectId: string; owner: string },
  input: ExpenseCase,
  code: RegExp,
): Promise<void> {
  await withSql(sql =>
    expect(runPlan(sql, () => expensePlan(ctx, `req-${suffix()}`, input))).rejects.toThrow(code),
  );
}

/* ── 1. T8: full payment from a box ────────────────────────────────────── */

describe("M2.6 T8 — expense 50 from a 20 cash box", () => {
  it("is accepted, leaves cash −30 and returns the w.negative_box warning", async () => {
    const ctx = await newProject([{ kind: "cash", opening: { openingFils: 20_000 } }]);
    const result = resultOf(
      await withSql(sql =>
        runPlan(sql, () => expensePlan(ctx, `req-${suffix()}`, { amountFils: 50_000, source: "cash" })),
      ),
      "applied",
    );
    expect(result.kind).toBe("OP-EXPENSE");
    expect(result.amountFils).toBe(50_000);
    expect(result.data).toEqual({ warnings: ["w.negative_box"] });
    await withSql(async sql => {
      const cashId = await boxIdOf(sql, ctx.projectId, "cash");
      expect(await boxBalance(sql, ctx.projectId, "cash")).toBe(-30_000);
      expect(await accountTotal(sql, ctx.projectId, "EXP")).toBe(50_000);
      expect(await entriesInOrder(sql, ctx.projectId, result.entryIds)).toEqual([
        {
          type: "Q8",
          effectiveOn: AMMAN_TODAY,
          postings: [
            { account: "BOX", refId: cashId, category: null, deltaFils: -50_000 },
            { account: "EXP", refId: null, category: "materials_packaging", deltaFils: 50_000 },
          ],
        },
      ]);
      const rows = await expenseRows(sql, ctx.projectId);
      expect(rows).toHaveLength(1);
      expect(rows[0]).toMatchObject({
        status: "active",
        effectiveOn: AMMAN_TODAY,
        boxId: cashId,
        balanceLineId: null,
        category: "materials_packaging",
        amountMinor: 50_000,
        deliveryCostMinor: null,
      });
      assertLedgerCoreInvariants(await ledgerState(sql, ctx.projectId));
    });
  });

  it("does not warn when the box stays non-negative", async () => {
    const ctx = await newProject([{ kind: "cash", opening: { openingFils: 100_000 } }]);
    const result = resultOf(
      await withSql(sql =>
        runPlan(sql, () => expensePlan(ctx, `req-${suffix()}`, { amountFils: 50_000, source: "cash" })),
      ),
      "applied",
    );
    expect(result.data).toBeUndefined();
    await withSql(async sql => {
      expect(await boxBalance(sql, ctx.projectId, "cash")).toBe(50_000);
      assertLedgerCoreInvariants(await ledgerState(sql, ctx.projectId));
    });
  });

  it("does not warn for a box whose opening is unknown (the balance is unknown, not negative)", async () => {
    const ctx = await newProject([{ kind: "cash", opening: { unknown: true } }]);
    const result = resultOf(
      await withSql(sql =>
        runPlan(sql, () => expensePlan(ctx, `req-${suffix()}`, { amountFils: 40_000, source: "cash" })),
      ),
      "applied",
    );
    expect(result.data).toBeUndefined();
    await withSql(async sql => {
      // The postings alone sum below zero, but the opening is unknown.
      expect(await boxBalance(sql, ctx.projectId, "cash")).toBe(-40_000);
      assertLedgerCoreInvariants(await ledgerState(sql, ctx.projectId));
    });
  });
});

/* ── 2. T15 / T43: paid from the owner's personal money ─────────────────── */

describe("M2.6 T15 — expense gas 15 from personal money", () => {
  it("posts Q10 + Q8 on cash: EXP +15, OWN_IN +15, boxes unchanged, profit −15", async () => {
    const ctx = await newProject([{ kind: "cash", opening: { openingFils: 0 } }]);
    const result = resultOf(
      await withSql(sql =>
        runPlan(sql, () =>
          expensePlan(ctx, `req-${suffix()}`, { amountFils: 15_000, category: "gas", source: "personal" }),
        ),
      ),
      "applied",
    );
    expect(result.amountFils).toBe(15_000);
    await withSql(async sql => {
      const cashId = await boxIdOf(sql, ctx.projectId, "cash");
      expect(await accountTotal(sql, ctx.projectId, "EXP")).toBe(15_000);
      expect(await accountTotal(sql, ctx.projectId, "OWN_IN")).toBe(15_000);
      expect(await boxBalance(sql, ctx.projectId, "cash")).toBe(0);
      // Profit = ΣREV − ΣEXP (§8).
      const profit =
        (await accountTotal(sql, ctx.projectId, "REV")) - (await accountTotal(sql, ctx.projectId, "EXP"));
      expect(profit).toBe(-15_000);
      expect(await entriesInOrder(sql, ctx.projectId, result.entryIds)).toEqual([
        {
          type: "Q10",
          effectiveOn: AMMAN_TODAY,
          postings: [
            { account: "BOX", refId: cashId, category: null, deltaFils: 15_000 },
            { account: "OWN_IN", refId: null, category: null, deltaFils: 15_000 },
          ],
        },
        {
          type: "Q8",
          effectiveOn: AMMAN_TODAY,
          postings: [
            { account: "BOX", refId: cashId, category: null, deltaFils: -15_000 },
            { account: "EXP", refId: null, category: "gas", deltaFils: 15_000 },
          ],
        },
      ]);
      const rows = await expenseRows(sql, ctx.projectId);
      expect(rows[0]).toMatchObject({
        boxId: cashId,
        category: "gas",
        balanceLineId: null,
        amountMinor: 15_000,
      });
      assertLedgerCoreInvariants(await ledgerState(sql, ctx.projectId));
    });
  });

  it("T43 — with two boxes, posts on cash only: cash and account both unchanged", async () => {
    const ctx = await newProject([
      { kind: "cash", opening: { openingFils: 30_000 } },
      { kind: "account", opening: { openingFils: 80_000 } },
    ]);
    await withSql(sql =>
      runPlan(sql, () => expensePlan(ctx, `req-${suffix()}`, { amountFils: 15_000, source: "personal" })),
    );
    await withSql(async sql => {
      expect(await boxBalance(sql, ctx.projectId, "cash")).toBe(30_000);
      expect(await boxBalance(sql, ctx.projectId, "account")).toBe(80_000);
      expect(await accountTotal(sql, ctx.projectId, "OWN_IN")).toBe(15_000);
      assertLedgerCoreInvariants(await ledgerState(sql, ctx.projectId));
    });
  });

  it("refuses personal money (R-18 vehicle) when the project has no active cash box: E-BOX-STATE", async () => {
    const ctx = await newProject([{ kind: "account", opening: { openingFils: 80_000 } }]);
    await expectRejected(ctx, { amountFils: 15_000, source: "personal" }, /E-BOX-STATE/);
    await withSql(async sql => {
      expect(await persistedWriteCount(sql, ctx.projectId)).toBe(0);
      assertLedgerCoreInvariants(await ledgerState(sql, ctx.projectId));
    });
  });
});

/* ── 3. T16: partial payment from a box ─────────────────────────────────── */

describe("M2.6 T16 — expense materials 120, partial 50 cash", () => {
  it("posts Q9 + Q7: EXP +120, cash −50, supplier payable 70 (the T29 start state)", async () => {
    const ctx = await newProject();
    const result = resultOf(
      await withSql(sql =>
        runPlan(sql, () =>
          expensePlan(ctx, `req-${suffix()}`, {
            amountFils: 120_000,
            payment: partial(50_000),
            source: "cash",
            supplierName: "مؤسسة التغليف",
          }),
        ),
      ),
      "applied",
    );
    expect(result.amountFils).toBe(120_000);
    // The §13 default fixture opens cash at 0, so the box ends at −50: the
    // w.negative_box warning applies here exactly as in T8.
    expect(result.data).toEqual({ warnings: ["w.negative_box"] });
    await withSql(async sql => {
      const cashId = await boxIdOf(sql, ctx.projectId, "cash");
      const lines = await linesWithOutstanding(sql, ctx.projectId);
      expect(lines).toHaveLength(1);
      const line = lines[0]!;
      expect(line).toMatchObject({
        direction: "by_me",
        kind: "supplier",
        counterpartyName: "مؤسسة التغليف",
        originOn: AMMAN_TODAY,
        outstanding: 70_000,
      });
      expect(await accountTotal(sql, ctx.projectId, "EXP")).toBe(120_000);
      expect(await accountTotal(sql, ctx.projectId, "AP")).toBe(70_000);
      expect(await boxBalance(sql, ctx.projectId, "cash")).toBe(-50_000);
      expect(await entriesInOrder(sql, ctx.projectId, result.entryIds)).toEqual([
        {
          type: "Q9",
          effectiveOn: AMMAN_TODAY,
          postings: [
            { account: "AP", refId: line.id, category: null, deltaFils: 120_000 },
            { account: "EXP", refId: null, category: "materials_packaging", deltaFils: 120_000 },
          ],
        },
        {
          type: "Q7",
          effectiveOn: AMMAN_TODAY,
          postings: [
            { account: "AP", refId: line.id, category: null, deltaFils: -50_000 },
            { account: "BOX", refId: cashId, category: null, deltaFils: -50_000 },
          ],
        },
      ]);
      const rows = await expenseRows(sql, ctx.projectId);
      expect(rows[0]).toMatchObject({
        boxId: cashId,
        balanceLineId: line.id,
        counterpartyName: "مؤسسة التغليف",
        amountMinor: 120_000,
      });
      assertLedgerCoreInvariants(await ledgerState(sql, ctx.projectId));
    });
  });
});

/* ── 4. T30: the delivery-cost attribution ──────────────────────────────── */

describe("M2.6 T30 — expense materials 12 + delivery 2, paid cash", () => {
  it("posts one Q8 of 14 and keeps the delivery portion on the operation", async () => {
    const ctx = await newProject([{ kind: "cash", opening: { openingFils: 50_000 } }]);
    const result = resultOf(
      await withSql(sql =>
        runPlan(sql, () =>
          expensePlan(ctx, `req-${suffix()}`, {
            amountFils: 12_000,
            deliveryCostFils: 2_000,
            source: "cash",
          }),
        ),
      ),
      "applied",
    );
    expect(result.amountFils).toBe(14_000);
    await withSql(async sql => {
      const cashId = await boxIdOf(sql, ctx.projectId, "cash");
      expect(await boxBalance(sql, ctx.projectId, "cash")).toBe(36_000);
      expect(await entriesInOrder(sql, ctx.projectId, result.entryIds)).toEqual([
        {
          type: "Q8",
          effectiveOn: AMMAN_TODAY,
          postings: [
            { account: "BOX", refId: cashId, category: null, deltaFils: -14_000 },
            { account: "EXP", refId: null, category: "materials_packaging", deltaFils: 14_000 },
          ],
        },
      ]);
      const rows = await expenseRows(sql, ctx.projectId);
      expect(rows[0]).toMatchObject({ amountMinor: 14_000, deliveryCostMinor: 2_000 });
      assertLedgerCoreInvariants(await ledgerState(sql, ctx.projectId));
    });
  });
});

/* ── 5. Credit ──────────────────────────────────────────────────────────── */

describe("M2.6 — expense on credit", () => {
  it("posts Q9 on a new supplier line and moves no money", async () => {
    const ctx = await newProject([{ kind: "cash", opening: { openingFils: 25_000 } }]);
    const result = resultOf(
      await withSql(sql =>
        runPlan(sql, () =>
          expensePlan(ctx, `req-${suffix()}`, {
            amountFils: 300_000,
            deliveryCostFils: 5_000,
            category: "equipment",
            payment: CREDIT,
            supplierName: "مكتب الأدوات",
          }),
        ),
      ),
      "applied",
    );
    await withSql(async sql => {
      const lines = await linesWithOutstanding(sql, ctx.projectId);
      expect(lines).toHaveLength(1);
      expect(lines[0]).toMatchObject({
        kind: "supplier",
        counterpartyName: "مكتب الأدوات",
        outstanding: 305_000,
      });
      expect(await accountTotal(sql, ctx.projectId, "EXP")).toBe(305_000);
      expect(await boxBalance(sql, ctx.projectId, "cash")).toBe(25_000);
      expect(await entriesInOrder(sql, ctx.projectId, result.entryIds)).toEqual([
        {
          type: "Q9",
          effectiveOn: AMMAN_TODAY,
          postings: [
            { account: "AP", refId: lines[0]!.id, category: null, deltaFils: 305_000 },
            { account: "EXP", refId: null, category: "equipment", deltaFils: 305_000 },
          ],
        },
      ]);
      const rows = await expenseRows(sql, ctx.projectId);
      expect(rows[0]).toMatchObject({
        boxId: null,
        balanceLineId: lines[0]!.id,
        amountMinor: 305_000,
        deliveryCostMinor: 5_000,
      });
      assertLedgerCoreInvariants(await ledgerState(sql, ctx.projectId));
    });
  });

  it("partial from personal money posts Q9 + Q10 + Q7 on cash: the box nets to zero", async () => {
    const ctx = await newProject([{ kind: "cash", opening: { openingFils: 10_000 } }]);
    const result = resultOf(
      await withSql(sql =>
        runPlan(sql, () =>
          expensePlan(ctx, `req-${suffix()}`, {
            amountFils: 120_000,
            payment: partial(50_000),
            source: "personal",
            supplierName: "مؤسسة التغليف",
          }),
        ),
      ),
      "applied",
    );
    await withSql(async sql => {
      const cashId = await boxIdOf(sql, ctx.projectId, "cash");
      const lines = await linesWithOutstanding(sql, ctx.projectId);
      expect(lines[0]!.outstanding).toBe(70_000);
      expect(await accountTotal(sql, ctx.projectId, "EXP")).toBe(120_000);
      expect(await accountTotal(sql, ctx.projectId, "OWN_IN")).toBe(50_000);
      expect(await boxBalance(sql, ctx.projectId, "cash")).toBe(10_000);
      expect(
        (await entriesInOrder(sql, ctx.projectId, result.entryIds)).map(e => [e.type, e.postings.length]),
      ).toEqual([
        ["Q9", 2],
        ["Q10", 2],
        ["Q7", 2],
      ]);
      const [q9, q10, q7] = await entriesInOrder(sql, ctx.projectId, result.entryIds);
      expect(q9!.postings).toEqual([
        { account: "AP", refId: lines[0]!.id, category: null, deltaFils: 120_000 },
        { account: "EXP", refId: null, category: "materials_packaging", deltaFils: 120_000 },
      ]);
      expect(q10!.postings).toEqual([
        { account: "BOX", refId: cashId, category: null, deltaFils: 50_000 },
        { account: "OWN_IN", refId: null, category: null, deltaFils: 50_000 },
      ]);
      expect(q7!.postings).toEqual([
        { account: "AP", refId: lines[0]!.id, category: null, deltaFils: -50_000 },
        { account: "BOX", refId: cashId, category: null, deltaFils: -50_000 },
      ]);
      assertLedgerCoreInvariants(await ledgerState(sql, ctx.projectId));
    });
  });
});

/* ── 6. effective_on (R-13 / R-26) ──────────────────────────────────────── */

describe("M2.6 — effective_on", () => {
  it("carries a past date onto the operation and its entries (the T5 precondition)", async () => {
    const ctx = await newProject([{ kind: "cash", opening: { openingFils: 80_000 } }]);
    const result = resultOf(
      await withSql(sql =>
        runPlan(sql, () =>
          expensePlan(ctx, `req-${suffix()}`, {
            amountFils: 50_000,
            source: "cash",
            effectiveOn: "2026-10-15",
          }),
        ),
      ),
      "applied",
    );
    expect(result.effectiveOn).toBe("2026-10-15");
    await withSql(async sql => {
      expect((await entriesInOrder(sql, ctx.projectId, result.entryIds)).map(e => e.effectiveOn)).toEqual([
        "2026-10-15",
      ]);
      expect((await expenseRows(sql, ctx.projectId))[0]!.effectiveOn).toBe("2026-10-15");
      assertLedgerCoreInvariants(await ledgerState(sql, ctx.projectId));
    });
  });
});

/* ── 7. §5 validation ───────────────────────────────────────────────────── */

describe("M2.6 — OP-EXPENSE validation", () => {
  it("rejects malformed money, category, payment and source with E-AMOUNT", async () => {
    const ctx = await newProject([{ kind: "cash", opening: { openingFils: 500_000 } }]);
    await expectRejected(ctx, { amountFils: 0, source: "cash" }, /E-AMOUNT/);
    await expectRejected(ctx, { amountFils: -5_000, source: "cash" }, /E-AMOUNT/);
    await expectRejected(ctx, { amountFils: 12_000, deliveryCostFils: -1, source: "cash" }, /E-AMOUNT/);
    // sale_delivery is a sale operation's category (OP-SALE-DELIVERY-COST), never the expense form's (R-10).
    await expectRejected(ctx, { amountFils: 12_000, category: "sale_delivery", source: "cash" }, /E-AMOUNT/);
    await expectRejected(ctx, { amountFils: 12_000, category: "coffee", source: "cash" }, /E-AMOUNT/);
    // Partial: 0 < m < t.
    await expectRejected(
      ctx,
      { amountFils: 120_000, payment: partial(0), source: "cash", supplierName: "س" },
      /E-AMOUNT/,
    );
    await expectRejected(
      ctx,
      {
        amountFils: 120_000,
        deliveryCostFils: 2_000,
        payment: partial(122_000),
        source: "cash",
        supplierName: "س",
      },
      /E-AMOUNT/,
    );
    await expectRejected(ctx, { amountFils: 120_000, payment: { type: "installments" } }, /E-AMOUNT/);
    // A source is required when something is paid, and only then.
    await expectRejected(ctx, { amountFils: 12_000 }, /E-AMOUNT/);
    await expectRejected(
      ctx,
      { amountFils: 120_000, payment: partial(50_000), supplierName: "س" },
      /E-AMOUNT/,
    );
    await expectRejected(ctx, { amountFils: 12_000, source: "visa" }, /E-AMOUNT/);
    await expectRejected(
      ctx,
      { amountFils: 12_000, payment: CREDIT, source: "cash", supplierName: "س" },
      /E-AMOUNT/,
    );
    await withSql(async sql => {
      expect(await persistedWriteCount(sql, ctx.projectId)).toBe(0);
      assertLedgerCoreInvariants(await ledgerState(sql, ctx.projectId));
    });
  });

  it("requires a supplier name whenever something is on credit: E-NAME-REQUIRED", async () => {
    const ctx = await newProject([{ kind: "cash", opening: { openingFils: 500_000 } }]);
    await expectRejected(ctx, { amountFils: 120_000, payment: CREDIT }, /E-NAME-REQUIRED/);
    await expectRejected(
      ctx,
      { amountFils: 120_000, payment: CREDIT, supplierName: "   " },
      /E-NAME-REQUIRED/,
    );
    await expectRejected(
      ctx,
      { amountFils: 120_000, payment: partial(50_000), source: "cash" },
      /E-NAME-REQUIRED/,
    );
    await withSql(async sql => {
      expect(await persistedWriteCount(sql, ctx.projectId)).toBe(0);
    });
  });

  it("refuses a future effective_on: E-FUTURE-DATE", async () => {
    const ctx = await newProject();
    await expectRejected(
      ctx,
      { amountFils: 12_000, source: "cash", effectiveOn: "2026-11-27" },
      /E-FUTURE-DATE/,
    );
    await expectRejected(ctx, { amountFils: 12_000, source: "cash", effectiveOn: "15-10-2026" }, /E-AMOUNT/);
    await withSql(async sql => {
      expect(await persistedWriteCount(sql, ctx.projectId)).toBe(0);
    });
  });

  it("refuses a box of a kind the project does not have an active box of: E-BOX-STATE", async () => {
    const ctx = await newProject([{ kind: "cash", opening: { openingFils: 500_000 } }]);
    await expectRejected(ctx, { amountFils: 12_000, source: "account" }, /E-BOX-STATE/);
    await withSql(async sql => {
      expect(await persistedWriteCount(sql, ctx.projectId)).toBe(0);
      assertLedgerCoreInvariants(await ledgerState(sql, ctx.projectId));
    });
  });
});

/* ── 8. T55 / R-25: one request id → one operation ──────────────────────── */

describe("M2.6 T55 — a retried expense", () => {
  it("replays the first operation, its warning included, and writes nothing twice", async () => {
    const ctx = await newProject([{ kind: "cash", opening: { openingFils: 20_000 } }]);
    const requestId = `req-${suffix()}`;
    const input = { amountFils: 50_000, source: "cash" };
    const first = resultOf(
      await withSql(sql => runPlan(sql, () => expensePlan(ctx, requestId, input))),
      "applied",
    );
    const again = resultOf(
      await withSql(sql => runPlan(sql, () => expensePlan(ctx, requestId, input))),
      "replay",
    );
    expect(again).toEqual(first);

    // The same request id with a different body is a conflict, never a success.
    const conflict = await withSql(sql =>
      runPlan(sql, () => expensePlan(ctx, requestId, { amountFils: 60_000, source: "cash" })),
    );
    expect(conflict).toEqual({ outcome: "conflict", reason: "E-IDEMPOTENCY-CONFLICT" });

    // A credit expense plans a fresh supplier line id on every attempt: the
    // intent, not the generated ids, is the request's identity.
    const creditId = `req-${suffix()}`;
    const credit = { amountFils: 90_000, payment: CREDIT, supplierName: "مكتب الأدوات" };
    const creditFirst = resultOf(
      await withSql(sql => runPlan(sql, () => expensePlan(ctx, creditId, credit))),
      "applied",
    );
    const creditAgain = resultOf(
      await withSql(sql => runPlan(sql, () => expensePlan(ctx, creditId, credit))),
      "replay",
    );
    expect(creditAgain).toEqual(creditFirst);

    await withSql(async sql => {
      const rows = await expenseRows(sql, ctx.projectId);
      expect(rows.map(r => [r.amountMinor, r.balanceLineId === null])).toEqual([
        [50_000, true],
        [90_000, false],
      ]);
      expect(await accountTotal(sql, ctx.projectId, "AP")).toBe(90_000);
      assertLedgerCoreInvariants(await ledgerState(sql, ctx.projectId));
    });
  });
});

/* ── 9. The route ───────────────────────────────────────────────────────── */

interface RouteResponse {
  outcome: string;
  result: { operationId: string; kind: string; amountFils: number; data?: unknown };
}

async function errorOf(response: Response): Promise<{ code: string; details: Record<string, unknown> }> {
  const body = (await response.json()) as { error: { code: string; details?: Record<string, unknown> } };
  return { code: body.error.code, details: body.error.details ?? {} };
}

describe("M2.6 — route POST /api/manage-v2/expense", () => {
  it("applies, replays a retry and maps §11 rejections end-to-end", async () => {
    const sub = `m26-route-${suffix()}`;
    const session = await signInAs(worker, { sub, email: `${sub}@example.com` });
    const setup = await apiPost(worker, session.cookieHeader, "/api/manage-v2/setup", {
      requestId: `route-${suffix()}`,
      projectName: "مشروع سامي",
      boxes: [{ kind: "cash", opening: { openingFils: 20_000 } }],
    });
    expect(setup.status).toBe(200);
    const projectId = ((await setup.json()) as { projectId: string }).projectId;

    const body = {
      requestId: `route-${suffix()}`,
      projectId,
      amountFils: 50_000,
      category: "materials_packaging",
      payment: { type: "full" },
      source: "cash",
    };
    const first = await apiPost(worker, session.cookieHeader, "/api/manage-v2/expense", body);
    expect(first.status).toBe(200);
    const firstBody = (await first.json()) as RouteResponse;
    expect(firstBody.outcome).toBe("applied");
    expect(firstBody.result).toMatchObject({
      kind: "OP-EXPENSE",
      amountFils: 50_000,
      data: { warnings: ["w.negative_box"] },
    });

    const retry = await apiPost(worker, session.cookieHeader, "/api/manage-v2/expense", body);
    expect(retry.status).toBe(200);
    expect(await retry.json()).toMatchObject({ outcome: "replay", result: firstBody.result });

    const invalid = await apiPost(worker, session.cookieHeader, "/api/manage-v2/expense", {
      requestId: `route-${suffix()}`,
      projectId,
      amountFils: 0,
      category: "gas",
      payment: { type: "full" },
      source: "cash",
    });
    expect(invalid.status).toBe(400);
    expect((await errorOf(invalid)).details).toMatchObject({ code: "E-AMOUNT" });

    // R-24: another account cannot write into this project, and the answer
    // does not differ from "you have no project".
    const otherSub = `m26-other-${suffix()}`;
    const other = await signInAs(worker, { sub: otherSub, email: `${otherSub}@example.com` });
    const foreign = await apiPost(worker, other.cookieHeader, "/api/manage-v2/expense", {
      requestId: `route-${suffix()}`,
      projectId,
      amountFils: 5_000,
      category: "gas",
      payment: { type: "full" },
      source: "cash",
    });
    expect(foreign.status).toBe(404);

    const anonymous = await apiPost(worker, null, "/api/manage-v2/expense", body);
    expect(anonymous.status).toBe(401);

    await withSql(async sql => {
      expect(await boxBalance(sql, projectId, "cash")).toBe(-30_000);
      expect(await accountTotal(sql, projectId, "EXP")).toBe(50_000);
      expect(await expenseRows(sql, projectId)).toHaveLength(1);
      assertLedgerCoreInvariants(await ledgerState(sql, projectId));
    });
  });
});
