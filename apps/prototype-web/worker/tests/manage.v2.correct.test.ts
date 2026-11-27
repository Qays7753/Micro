/**
 * M2.10 acceptance (Manage v2 phase 2, wave H — spec §5 OP-CORRECT /
 * OP-CANCEL-OPERATION, §4 Q20, §9 INV-2, R-11, R-12; tests T5, T29, T35,
 * T52): correction by reversal-and-repost and the cancellation, with the
 * settled-figure validation (E-CORRECTION-BREAKS-BALANCES) and the
 * never-reverse-a-reversal rule (E-REVERSE-REVERSAL).
 *
 * Tests-first: this file was written before the operations existed and
 * fails with "Cannot find module … operations/correct.js".
 *
 * Given-state seeding: T35 needs a prepayment of a DELIVERED sale — both
 * phase-3 operations (OP-PREPAYMENT M3.3, OP-DELIVER M3.4). The GIVEN
 * state is seeded directly (the Q4 + Q5 entries and their operations, the
 * rows those operations will write), exactly like M2.8/M2.9's delivered
 * sales; the correction/cancellation under test still goes exclusively
 * through the real composition.
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
  linesWithOutstanding,
  resultOf,
  runPlan,
  scopedClient,
  setupProject,
} from "./manage.v2.helpers.ts";
import { planCorrect, type CorrectInput } from "../../../../src/domain/manage/operations/correct.js";
import {
  planCancelOperation,
  type CancelOperationInput,
} from "../../../../src/domain/manage/operations/cancelOperation.js";
import { planExpense } from "../../../../src/domain/manage/operations/expense.js";
import { planCollect } from "../../../../src/domain/manage/operations/collect.js";
import { planPay } from "../../../../src/domain/manage/operations/pay.js";
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

async function withSql<T>(run: (sql: postgres.Sql) => Promise<T>): Promise<T> {
  const sql = scopedClient(dbUrl);
  try {
    return await run(sql);
  } finally {
    await sql.end();
  }
}

async function newProject(boxes: SetupBoxSlot[] = [{ kind: "cash", opening: { openingFils: 0 } }]) {
  const projectId = crypto.randomUUID();
  const owner = `m210-owner-${suffix()}`;
  await withSql(sql => setupProject(sql, { projectId, owner, today: AMMAN_TODAY, boxes }));
  return { projectId, owner };
}

/** A real expense through the composition (the correction target). */
async function addExpense(
  sql: postgres.Sql,
  ctx: { projectId: string; owner: string },
  input: {
    amountFils: number;
    effectiveOn?: string;
    payment?: Record<string, unknown>;
    supplierName?: string;
    source?: string;
  },
): Promise<string> {
  const result = resultOf(
    await runPlan(sql, () =>
      planExpense({
        projectId: ctx.projectId,
        createdByAccountId: ctx.owner,
        requestId: `req-${suffix()}`,
        today: AMMAN_TODAY,
        amountFils: input.amountFils,
        category: "materials_packaging",
        ...(input.effectiveOn === undefined ? {} : { effectiveOn: input.effectiveOn }),
        payment: input.payment ?? { type: "full" },
        ...(input.source === undefined ? {} : { source: input.source }),
        ...(input.supplierName === undefined ? {} : { supplierName: input.supplierName }),
      }),
    ),
    "applied",
  );
  return result.operationId;
}

function correctPlan(
  ctx: { projectId: string; owner: string },
  requestId: string,
  operationId: string,
  inputs: Record<string, unknown>,
): OperationPlan {
  return planCorrect({
    projectId: ctx.projectId,
    createdByAccountId: ctx.owner,
    requestId,
    today: AMMAN_TODAY,
    operationId,
    inputs,
  } as CorrectInput);
}

function cancelPlan(
  ctx: { projectId: string; owner: string },
  requestId: string,
  operationId: string,
): OperationPlan {
  return planCancelOperation({
    projectId: ctx.projectId,
    createdByAccountId: ctx.owner,
    requestId,
    today: AMMAN_TODAY,
    operationId,
  } as CancelOperationInput);
}

/** One operation's entries IN THE HANDLER'S WRITE ORDER (entryIds), each
 * with its postings in account order. */
interface OperationEntry {
  type: string;
  effectiveOn: string;
  reversesEntryId?: string;
  postings: Array<{ account: string; deltaFils: number }>;
}

async function entriesOfOperation(
  sql: postgres.Sql,
  projectId: string,
  entryIds: string[],
): Promise<OperationEntry[]> {
  const entries = (await sql`SELECT id, entry_type, effective_on::text AS effective_on, reverses_entry_id
    FROM ledger_entry WHERE project_id = ${projectId}`) as Array<{
    id: string;
    entry_type: string;
    effective_on: string;
    reverses_entry_id: string | null;
  }>;
  const postings = (await sql`SELECT entry_id, account, delta_minor FROM ledger_posting
    WHERE project_id = ${projectId}`) as Array<{ entry_id: string; account: string; delta_minor: string }>;
  return entryIds.map(id => {
    const entry = entries.find(e => e.id === id);
    if (entry === undefined) throw new Error(`entry ${id} not found`);
    return {
      type: String(entry.entry_type),
      effectiveOn: String(entry.effective_on),
      ...(entry.reverses_entry_id !== null ? { reversesEntryId: String(entry.reverses_entry_id) } : {}),
      postings: postings
        .filter(p => p.entry_id === id)
        .map(p => ({ account: String(p.account), deltaFils: Number(p.delta_minor) }))
        .sort((a, b) => a.account.localeCompare(b.account) || a.deltaFils - b.deltaFils),
    };
  });
}

/** Seed a prepayment (Q4) of a DELIVERED sale (Q5) — the rows OP-PREPAYMENT
 * (M3.3) and OP-DELIVER (M3.4) will write. Returns the prepayment
 * operation id (the correction target of T35). */
async function seedDeliveredSaleWithPrepayment(
  sql: postgres.Sql,
  projectId: string,
  input: { priceFils: number; prepaymentFils: number },
): Promise<{ prepayOperationId: string; saleId: string; remainderLineId: string }> {
  const saleId = crypto.randomUUID();
  const remainderLineId = crypto.randomUUID();
  const createdAt = "2026-11-20T12:00:00.000Z";
  const cashBox = String(
    (await sql`SELECT id FROM box WHERE project_id = ${projectId} AND kind = 'cash' LIMIT 1`)[0]!.id,
  );
  const prepayOp = crypto.randomUUID();
  const prepayEntry = crypto.randomUUID();
  const deliverOp = crypto.randomUUID();
  const deliverEntry = crypto.randomUUID();
  await sql`INSERT INTO sale (id, project_id, customer_name, registered_on, planned_delivery_on,
                              final_price_minor, tracked, hidden_from_tracker, created_at, updated_at)
            VALUES (${saleId}, ${projectId}, ${"ليلى"}, ${"2026-11-20"}, ${"2026-11-20"},
                    ${input.priceFils}, ${false}, ${false}, ${createdAt}, ${createdAt})`;
  await sql`INSERT INTO operation (id, project_id, kind, effective_on, status, sale_id, amount_minor, payload,
                                   created_by_account_id, created_at)
            VALUES (${prepayOp}, ${projectId}, ${"OP-PREPAYMENT"}, ${"2026-11-20"}, ${"active"}, ${saleId},
                    ${input.prepaymentFils}, ${"{}"}, ${"seed"}, ${createdAt})`;
  await sql`INSERT INTO ledger_entry (id, project_id, operation_id, entry_type, effective_on, created_at)
            VALUES (${prepayEntry}, ${projectId}, ${prepayOp}, ${"Q4"}, ${"2026-11-20"}, ${createdAt})`;
  await sql`INSERT INTO ledger_posting (id, project_id, entry_id, account, ref_id, delta_minor)
            VALUES (${crypto.randomUUID()}, ${projectId}, ${prepayEntry}, ${"BOX"}, ${cashBox}, ${input.prepaymentFils}),
                   (${crypto.randomUUID()}, ${projectId}, ${prepayEntry}, ${"PRE"}, ${saleId}, ${input.prepaymentFils})`;
  await sql`INSERT INTO operation (id, project_id, kind, effective_on, status, sale_id, balance_line_id, amount_minor,
                                   payload, created_by_account_id, created_at)
            VALUES (${deliverOp}, ${projectId}, ${"OP-DELIVER"}, ${"2026-11-20"}, ${"active"}, ${saleId},
                    ${remainderLineId}, ${input.priceFils}, ${"{}"}, ${"seed"}, ${createdAt})`;
  await sql`INSERT INTO balance_line (id, project_id, direction, kind, counterparty_name, origin_on, sale_id,
                                      origin_operation_id)
            VALUES (${remainderLineId}, ${projectId}, ${"to_me"}, ${"sale_remainder"}, ${"ليلى"},
                    ${"2026-11-20"}, ${saleId}, ${deliverOp})`;
  await sql`INSERT INTO ledger_entry (id, project_id, operation_id, entry_type, effective_on, created_at)
            VALUES (${deliverEntry}, ${projectId}, ${deliverOp}, ${"Q5"}, ${"2026-11-20"}, ${createdAt})`;
  await sql`INSERT INTO ledger_posting (id, project_id, entry_id, account, ref_id, rev_kind, delta_minor)
            VALUES (${crypto.randomUUID()}, ${projectId}, ${deliverEntry}, ${"REV"}, ${saleId}, ${"delivery"}, ${input.priceFils}),
                   (${crypto.randomUUID()}, ${projectId}, ${deliverEntry}, ${"PRE"}, ${saleId}, ${null}, ${-input.prepaymentFils}),
                   (${crypto.randomUUID()}, ${projectId}, ${deliverEntry}, ${"AR"}, ${remainderLineId}, ${null}, ${input.priceFils - input.prepaymentFils})`;
  return { prepayOperationId: prepayOp, saleId, remainderLineId };
}

/** Σ EXP over entries effective in a date range (period profit driver). */
async function expensesOfPeriod(
  sql: postgres.Sql,
  projectId: string,
  from: string,
  to: string,
): Promise<number> {
  const rows = await sql`
    SELECT COALESCE(SUM(p.delta_minor), 0)::bigint AS total
    FROM ledger_posting p JOIN ledger_entry e ON e.id = p.entry_id
    WHERE p.project_id = ${projectId} AND p.account = 'EXP'
      AND e.effective_on BETWEEN ${from} AND ${to}`;
  return Number(rows[0]!.total);
}

/* ── 1. T5: the corrected operation keeps the ORIGINAL effective date ──── */

describe("M2.10 T5 — October expense 50 corrected to 5 in November", () => {
  it("reverses (Q20) and reposts at the ORIGINAL date: October profit +45, November unchanged", async () => {
    const ctx = await newProject([{ kind: "cash", opening: { openingFils: 500_000 } }]);
    const originalId = await withSql(sql =>
      addExpense(sql, ctx, { amountFils: 50_000, effectiveOn: "2026-10-15", source: "cash" }),
    );
    const before = await withSql(sql => expensesOfPeriod(sql, ctx.projectId, "2026-10-01", "2026-10-31"));
    expect(before).toBe(50_000);

    const result = resultOf(
      await withSql(sql =>
        runPlan(sql, () =>
          correctPlan(ctx, `attempt-${suffix()}`, originalId, {
            amountFils: 5_000,
            category: "materials_packaging",
            payment: { type: "full" },
            source: "cash",
          }),
        ),
      ),
      "applied",
    );
    expect(result.kind).toBe("OP-EXPENSE");
    expect(result.amountFils).toBe(5_000);
    expect(result.effectiveOn).toBe("2026-10-15");

    await withSql(async sql => {
      // October: EXP was 50_000, now 5_000 — profit +45 vs before (T5).
      const after = await expensesOfPeriod(sql, ctx.projectId, "2026-10-01", "2026-10-31");
      expect(after).toBe(5_000);
      expect(before - after).toBe(45_000);
      // November (the correction month): nothing moved there.
      expect(await expensesOfPeriod(sql, ctx.projectId, "2026-11-01", "2026-11-30")).toBe(0);

      // The reversal chain is visible: Q20 mirrors the original Q8 with the
      // ORIGINAL date, and the original operation row is reversed.
      const entries = await entriesOfOperation(sql, ctx.projectId, result.entryIds);
      expect(
        entries.map(e => [e.type, e.effectiveOn, ...e.postings.map(p => [p.account, p.deltaFils])]),
      ).toEqual([
        ["Q20", "2026-10-15", ["BOX", 50_000], ["EXP", -50_000]],
        ["Q8", "2026-10-15", ["BOX", -5_000], ["EXP", 5_000]],
      ]);
      expect(entries[0]!.reversesEntryId).not.toBeNull();

      const original =
        (await sql`SELECT status, reversed_by_operation_id, corrects_operation_id FROM operation
        WHERE project_id = ${ctx.projectId} AND id = ${originalId}`) as Array<{
          status: string;
          reversed_by_operation_id: string | null;
          corrects_operation_id: string | null;
        }>;
      expect(original[0]).toEqual({
        status: "reversed",
        reversed_by_operation_id: result.operationId,
        corrects_operation_id: null,
      });
      const correctionRow = (await sql`SELECT kind, corrects_operation_id, effective_on::text AS effective_on
        FROM operation WHERE project_id = ${ctx.projectId} AND id = ${result.operationId}`) as Array<{
        kind: string;
        corrects_operation_id: string | null;
        effective_on: string;
      }>;
      expect(correctionRow[0]).toEqual({
        kind: "OP-EXPENSE",
        corrects_operation_id: originalId,
        effective_on: "2026-10-15",
      });
      assertLedgerCoreInvariants(await ledgerState(sql, ctx.projectId));
    });
  });

  it("the current version can itself be corrected again (the first correction's Q20s are never reversed)", async () => {
    const ctx = await newProject([{ kind: "cash", opening: { openingFils: 500_000 } }]);
    const originalId = await withSql(sql =>
      addExpense(sql, ctx, { amountFils: 50_000, effectiveOn: "2026-10-15", source: "cash" }),
    );
    const v2 = resultOf(
      await withSql(sql =>
        runPlan(sql, () =>
          correctPlan(ctx, `attempt-${suffix()}`, originalId, {
            amountFils: 5_000,
            category: "materials_packaging",
            payment: { type: "full" },
            source: "cash",
          }),
        ),
      ),
      "applied",
    );
    const v3 = resultOf(
      await withSql(sql =>
        runPlan(sql, () =>
          correctPlan(ctx, `attempt-${suffix()}`, v2.operationId, {
            amountFils: 8_000,
            category: "materials_packaging",
            payment: { type: "full" },
            source: "cash",
          }),
        ),
      ),
      "applied",
    );
    await withSql(async sql => {
      // Final EXP = 8; the chain v1 ← v2 ← v3 is visible; v2's own Q20 (of
      // v1's Q8) still stands (nothing reverses a reversal).
      expect(await accountTotal(sql, ctx.projectId, "EXP")).toBe(8_000);
      const rows = (await sql`SELECT id, status, reversed_by_operation_id, corrects_operation_id
        FROM operation WHERE project_id = ${ctx.projectId} AND id IN (${originalId}, ${v2.operationId}, ${v3.operationId})`) as Array<{
        id: string;
        status: string;
        reversed_by_operation_id: string | null;
        corrects_operation_id: string | null;
      }>;
      const byId = new Map(rows.map(r => [r.id, r]));
      expect(byId.get(originalId)).toMatchObject({
        status: "reversed",
        reversed_by_operation_id: v2.operationId,
      });
      expect(byId.get(v2.operationId)).toMatchObject({
        status: "reversed",
        reversed_by_operation_id: v3.operationId,
      });
      expect(byId.get(v3.operationId)).toMatchObject({
        status: "active",
        corrects_operation_id: v2.operationId,
      });
      const v2Q20 = (await sql`SELECT e.id FROM ledger_entry e
        WHERE e.project_id = ${ctx.projectId} AND e.operation_id = ${v2.operationId} AND e.entry_type = 'Q20'`) as Array<{
        id: string;
      }>;
      const reversedBack = (await sql`SELECT count(*)::int AS n FROM ledger_entry
        WHERE project_id = ${ctx.projectId} AND reverses_entry_id = ${v2Q20[0]!.id}`) as Array<{ n: number }>;
      expect(Number(reversedBack[0]!.n)).toBe(0);
      assertLedgerCoreInvariants(await ledgerState(sql, ctx.projectId));
    });
  });
});

/* ── 2. T29: the settled-figure rejection ──────────────────────────────── */

describe("M2.10 T29 — credit expense 120, paid 50, correct to 40", () => {
  it("is rejected with E-CORRECTION-BREAKS-BALANCES and leaves everything untouched", async () => {
    const ctx = await newProject([{ kind: "cash", opening: { openingFils: 500_000 } }]);
    const originalId = await withSql(sql =>
      addExpense(sql, ctx, {
        amountFils: 120_000,
        payment: { type: "credit" },
        supplierName: "مكتب الأدوات",
      }),
    );
    // Pay 50 against the supplier line (the settled figure) — OP-PAY.
    await withSql(sql =>
      runPlan(sql, () =>
        planPay({
          projectId: ctx.projectId,
          createdByAccountId: ctx.owner,
          requestId: `req-${suffix()}`,
          today: AMMAN_TODAY,
          amountFils: 50_000,
          box: "cash",
          counterpartyName: "مكتب الأدوات",
        }),
      ),
    );
    await expect(() =>
      withSql(sql =>
        runPlan(sql, () =>
          correctPlan(ctx, `attempt-${suffix()}`, originalId, {
            amountFils: 40_000,
            category: "materials_packaging",
            payment: { type: "credit" },
            supplierName: "مكتب الأدوات",
          }),
        ),
      ),
    ).rejects.toThrow(/E-CORRECTION-BREAKS-BALANCES/);
    await withSql(async sql => {
      // The original is untouched: still active, EXP still 120, the line
      // still 70 outstanding, and no Q20 anywhere.
      const original =
        (await sql`SELECT status FROM operation WHERE project_id = ${ctx.projectId} AND id = ${originalId}`) as Array<{
          status: string;
        }>;
      expect(original[0]!.status).toBe("active");
      expect(await accountTotal(sql, ctx.projectId, "EXP")).toBe(120_000);
      const lines = await linesWithOutstanding(sql, ctx.projectId);
      expect(lines.find(l => l.kind === "supplier")?.outstanding).toBe(70_000);
      const q20 = (await sql`SELECT count(*)::int AS n FROM ledger_entry
        WHERE project_id = ${ctx.projectId} AND entry_type = 'Q20'`) as Array<{ n: number }>;
      expect(Number(q20[0]!.n)).toBe(0);
      assertLedgerCoreInvariants(await ledgerState(sql, ctx.projectId));
    });
  });
});

/* ── 3. T35: a prepayment of a delivered sale ──────────────────────────── */

describe("M2.10 T35 — correct/cancel a prepayment of a delivered sale", () => {
  it("correcting it is rejected with E-CORRECTION-BREAKS-BALANCES (undo delivery first)", async () => {
    const ctx = await newProject([{ kind: "cash", opening: { openingFils: 500_000 } }]);
    const seeded = await withSql(sql =>
      seedDeliveredSaleWithPrepayment(sql, ctx.projectId, { priceFils: 50_000, prepaymentFils: 30_000 }),
    );
    await expect(() =>
      withSql(sql =>
        runPlan(sql, () =>
          correctPlan(ctx, `attempt-${suffix()}`, seeded.prepayOperationId, {
            amountFils: 20_000,
            box: "cash",
          }),
        ),
      ),
    ).rejects.toThrow(/E-CORRECTION-BREAKS-BALANCES/);
    await withSql(async sql => {
      const q20 = (await sql`SELECT count(*)::int AS n FROM ledger_entry
        WHERE project_id = ${ctx.projectId} AND entry_type = 'Q20'`) as Array<{ n: number }>;
      expect(Number(q20[0]!.n)).toBe(0);
      assertLedgerCoreInvariants(await ledgerState(sql, ctx.projectId));
    });
  });

  it("cancelling it is rejected the same way (PRE would go negative)", async () => {
    const ctx = await newProject([{ kind: "cash", opening: { openingFils: 500_000 } }]);
    const seeded = await withSql(sql =>
      seedDeliveredSaleWithPrepayment(sql, ctx.projectId, { priceFils: 50_000, prepaymentFils: 30_000 }),
    );
    await expect(() =>
      withSql(sql => runPlan(sql, () => cancelPlan(ctx, `attempt-${suffix()}`, seeded.prepayOperationId))),
    ).rejects.toThrow(/E-CORRECTION-BREAKS-BALANCES/);
    await withSql(async sql => {
      const q20 = (await sql`SELECT count(*)::int AS n FROM ledger_entry
        WHERE project_id = ${ctx.projectId} AND entry_type = 'Q20'`) as Array<{ n: number }>;
      expect(Number(q20[0]!.n)).toBe(0);
      assertLedgerCoreInvariants(await ledgerState(sql, ctx.projectId));
    });
  });
});

/* ── 4. T52: correcting a collection re-applies OP-COLLECT ─────────────── */

describe("M2.10 T52 — deliver 25, collect 22 + write off 3, correct the collection to 25", () => {
  it("reverses the Q6 22 and the Q17 3, then posts the new Q6 25", async () => {
    const ctx = await newProject();
    // A delivered sale of 25 with its remainder line (M3.4's rows, seeded).
    const saleId = crypto.randomUUID();
    const lineId = crypto.randomUUID();
    const deliverOp = crypto.randomUUID();
    const createdAt = "2026-11-25T12:00:00.000Z";
    await withSql(async sql => {
      await sql`INSERT INTO sale (id, project_id, customer_name, registered_on, planned_delivery_on,
                                  final_price_minor, tracked, hidden_from_tracker, created_at, updated_at)
                VALUES (${saleId}, ${ctx.projectId}, ${"ليلى"}, ${"2026-11-25"}, ${"2026-11-25"},
                        ${25_000}, ${false}, ${false}, ${createdAt}, ${createdAt})`;
      await sql`INSERT INTO operation (id, project_id, kind, effective_on, status, sale_id, balance_line_id,
                                       amount_minor, payload, created_by_account_id, created_at)
                VALUES (${deliverOp}, ${ctx.projectId}, ${"OP-DELIVER"}, ${"2026-11-25"}, ${"active"}, ${saleId},
                        ${lineId}, ${25_000}, ${"{}"}, ${"seed"}, ${createdAt})`;
      await sql`INSERT INTO balance_line (id, project_id, direction, kind, counterparty_name, origin_on, sale_id,
                                          origin_operation_id)
                VALUES (${lineId}, ${ctx.projectId}, ${"to_me"}, ${"sale_remainder"}, ${"ليلى"},
                        ${"2026-11-25"}, ${saleId}, ${deliverOp})`;
      await sql`INSERT INTO ledger_entry (id, project_id, operation_id, entry_type, effective_on, created_at)
                VALUES (${crypto.randomUUID()}, ${ctx.projectId}, ${deliverOp}, ${"Q5"}, ${"2026-11-25"}, ${createdAt})`;
      await sql`INSERT INTO ledger_posting (id, project_id, entry_id, account, ref_id, rev_kind, delta_minor)
                VALUES (${crypto.randomUUID()}, ${ctx.projectId}, (SELECT id FROM ledger_entry WHERE operation_id = ${deliverOp} LIMIT 1),
                        ${"REV"}, ${saleId}, ${"delivery"}, ${25_000}),
                       (${crypto.randomUUID()}, ${ctx.projectId}, (SELECT id FROM ledger_entry WHERE operation_id = ${deliverOp} LIMIT 1),
                        ${"AR"}, ${lineId}, ${null}, ${25_000})`;
    });
    // The original collection: 22 + write off 3 (M2.8's shortfall answer).
    const collect = resultOf(
      await withSql(sql =>
        runPlan(sql, () =>
          planCollect({
            projectId: ctx.projectId,
            createdByAccountId: ctx.owner,
            requestId: `req-${suffix()}`,
            today: AMMAN_TODAY,
            amountFils: 22_000,
            box: "cash",
            balanceLineId: lineId,
            shortfall: "write_off",
          }),
        ),
      ),
      "applied",
    );

    const correction = resultOf(
      await withSql(sql =>
        runPlan(sql, () =>
          correctPlan(ctx, `attempt-${suffix()}`, collect.operationId, {
            amountFils: 25_000,
            box: "cash",
            balanceLineId: lineId,
          }),
        ),
      ),
      "applied",
    );
    expect(correction.kind).toBe("OP-COLLECT");
    expect(correction.amountFils).toBe(25_000);

    await withSql(async sql => {
      // T52 end state: Q6 22 and Q17 3 reversed; new Q6 25; REV 25
      // (delivery 25 − write-off 3 + its reversal 3); remainder 0.
      expect(await accountTotal(sql, ctx.projectId, "REV")).toBe(25_000);
      expect(await boxBalance(sql, ctx.projectId, "cash")).toBe(25_000);
      expect((await linesWithOutstanding(sql, ctx.projectId)).find(l => l.id === lineId)?.outstanding).toBe(
        0,
      );
      const entries = await entriesOfOperation(sql, ctx.projectId, correction.entryIds);
      // §5 does not fix the order among the Q20 reversals (the original's
      // entries share one created_at and their ids are random) — only that
      // they all precede the corrected operation's entries. Sort the
      // reversals; the new Q6 stays last.
      const reversals = entries
        .filter(e => e.type === "Q20")
        .map(e => [e.type, true, ...e.postings.map(p => [p.account, p.deltaFils])] as unknown[])
        .sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b)));
      const reposts = entries
        .filter(e => e.type !== "Q20")
        .map(e => [
          e.type,
          e.reversesEntryId !== undefined,
          ...e.postings.map(p => [p.account, p.deltaFils]),
        ]);
      expect([...reversals, ...reposts]).toEqual([
        ["Q20", true, ["AR", 22_000], ["BOX", -22_000]],
        ["Q20", true, ["AR", 3_000], ["REV", 3_000]],
        ["Q6", false, ["AR", -25_000], ["BOX", 25_000]],
      ]);
      assertLedgerCoreInvariants(await ledgerState(sql, ctx.projectId));
    });
  });
});

/* ── 5. OP-CANCEL-OPERATION ────────────────────────────────────────────── */

describe("M2.10 — OP-CANCEL-OPERATION", () => {
  it("cancels an expense: Q20 for every entry, box restored, and the cancellation is final", async () => {
    const ctx = await newProject([{ kind: "cash", opening: { openingFils: 500_000 } }]);
    const originalId = await withSql(sql => addExpense(sql, ctx, { amountFils: 50_000, source: "cash" }));
    const cancel = resultOf(
      await withSql(sql => runPlan(sql, () => cancelPlan(ctx, `attempt-${suffix()}`, originalId))),
      "applied",
    );
    expect(cancel.kind).toBe("OP-CANCEL-OPERATION");
    await withSql(async sql => {
      expect(await accountTotal(sql, ctx.projectId, "EXP")).toBe(0);
      expect(await boxBalance(sql, ctx.projectId, "cash")).toBe(500_000);
      const original = (await sql`SELECT status, reversed_by_operation_id FROM operation
        WHERE project_id = ${ctx.projectId} AND id = ${originalId}`) as Array<{
        status: string;
        reversed_by_operation_id: string | null;
      }>;
      expect(original[0]).toEqual({ status: "reversed", reversed_by_operation_id: cancel.operationId });
      // The cancellation is final: cancelling IT (a pure reversal) is
      // E-REVERSE-REVERSAL.
      await expect(
        withSql(sql => runPlan(sql, () => cancelPlan(ctx, `attempt-${suffix()}`, cancel.operationId))),
      ).rejects.toThrow(/E-REVERSE-REVERSAL/);
      assertLedgerCoreInvariants(await ledgerState(sql, ctx.projectId));
    });
  });

  it("rejects an unknown or already-reversed target, and a non-cancellable kind", async () => {
    const ctx = await newProject([{ kind: "cash", opening: { openingFils: 500_000 } }]);
    const originalId = await withSql(sql => addExpense(sql, ctx, { amountFils: 50_000, source: "cash" }));
    await expect(
      withSql(sql => runPlan(sql, () => cancelPlan(ctx, `attempt-${suffix()}`, crypto.randomUUID()))),
    ).rejects.toThrow(/E-AMOUNT/);
    const setupOp = (await withSql(
      sql => sql`SELECT id FROM operation WHERE project_id = ${ctx.projectId} AND kind = 'OP-SETUP' LIMIT 1`,
    )) as Array<{ id: string }>;
    await expect(
      withSql(sql => runPlan(sql, () => cancelPlan(ctx, `attempt-${suffix()}`, String(setupOp[0]!.id)))),
    ).rejects.toThrow(/E-AMOUNT/);
    // Cancel the expense, then cancelling it AGAIN is rejected.
    await withSql(sql => runPlan(sql, () => cancelPlan(ctx, `attempt-${suffix()}`, originalId)));
    await expect(
      withSql(sql => runPlan(sql, () => cancelPlan(ctx, `attempt-${suffix()}`, originalId))),
    ).rejects.toThrow(/E-AMOUNT/);
    await withSql(async sql => {
      assertLedgerCoreInvariants(await ledgerState(sql, ctx.projectId));
    });
  });
});

/* ── 6. T55: one request id → one operation ────────────────────────────── */

describe("M2.10 T55 — a retried correction", () => {
  it("replays the correction and answers a different body with a conflict", async () => {
    const ctx = await newProject([{ kind: "cash", opening: { openingFils: 500_000 } }]);
    const originalId = await withSql(sql => addExpense(sql, ctx, { amountFils: 50_000, source: "cash" }));
    const requestId = `attempt-${suffix()}`;
    const inputs = {
      amountFils: 5_000,
      category: "materials_packaging",
      payment: { type: "full" },
      source: "cash",
    };
    const first = resultOf(
      await withSql(sql => runPlan(sql, () => correctPlan(ctx, requestId, originalId, inputs))),
      "applied",
    );
    const again = resultOf(
      await withSql(sql => runPlan(sql, () => correctPlan(ctx, requestId, originalId, inputs))),
      "replay",
    );
    expect(again).toEqual(first);
    const conflict = await withSql(sql =>
      runPlan(sql, () => correctPlan(ctx, requestId, originalId, { ...inputs, amountFils: 8_000 })),
    );
    expect(conflict).toEqual({ outcome: "conflict", reason: "E-IDEMPOTENCY-CONFLICT" });
    await withSql(async sql => {
      // The original is reversed once; EXP = 5; two OP-EXPENSE rows total.
      expect(await accountTotal(sql, ctx.projectId, "EXP")).toBe(5_000);
      const ops = (await sql`SELECT count(*)::int AS n FROM operation
        WHERE project_id = ${ctx.projectId} AND kind = 'OP-EXPENSE'`) as Array<{ n: number }>;
      expect(Number(ops[0]!.n)).toBe(2);
      assertLedgerCoreInvariants(await ledgerState(sql, ctx.projectId));
    });
  });
});

/* ── 7. The routes ─────────────────────────────────────────────────────── */

interface RouteResponse {
  outcome: string;
  result: { operationId: string; kind: string; amountFils: number };
}

async function errorOf(response: Response): Promise<{ code: string; details: Record<string, unknown> }> {
  const body = (await response.json()) as { error: { code: string; details?: Record<string, unknown> } };
  return { code: body.error.code, details: body.error.details ?? {} };
}

describe("M2.10 — routes correct / cancel-operation", () => {
  it("apply, replay a retry and map §11 rejections end-to-end", async () => {
    const sub = `m210-route-${suffix()}`;
    const session = await signInAs(worker, { sub, email: `${sub}@example.com` });
    const setup = await apiPost(worker, session.cookieHeader, "/api/manage-v2/setup", {
      requestId: `route-${suffix()}`,
      projectName: "مشروع الطريق",
      boxes: [{ kind: "cash", opening: { openingFils: 500_000 } }],
    });
    expect(setup.status).toBe(200);
    const projectId = ((await setup.json()) as { projectId: string }).projectId;

    const expense = await apiPost(worker, session.cookieHeader, "/api/manage-v2/expense", {
      requestId: `route-${suffix()}`,
      projectId,
      amountFils: 50_000,
      category: "materials_packaging",
      payment: { type: "full" },
      source: "cash",
    });
    expect(expense.status).toBe(200);
    const expenseOperationId = ((await expense.json()) as RouteResponse).result.operationId;

    const body = {
      requestId: `route-${suffix()}`,
      projectId,
      operationId: expenseOperationId,
      inputs: {
        amountFils: 5_000,
        category: "materials_packaging",
        payment: { type: "full" },
        source: "cash",
      },
    };
    const first = await apiPost(worker, session.cookieHeader, "/api/manage-v2/correct", body);
    expect(first.status).toBe(200);
    const firstJson = (await first.json()) as RouteResponse;
    expect(firstJson.outcome).toBe("applied");
    expect(firstJson.result).toMatchObject({ kind: "OP-EXPENSE", amountFils: 5_000 });

    const retry = await apiPost(worker, session.cookieHeader, "/api/manage-v2/correct", body);
    expect(retry.status).toBe(200);
    expect(await retry.json()).toMatchObject({ outcome: "replay", result: firstJson.result });

    // Cancelling the already-reversed original is a §11 rejection.
    const cancelled = await apiPost(worker, session.cookieHeader, "/api/manage-v2/cancel-operation", {
      requestId: `route-${suffix()}`,
      projectId,
      operationId: expenseOperationId,
    });
    expect(cancelled.status).toBe(400);
    expect((await errorOf(cancelled)).details).toMatchObject({ code: "E-AMOUNT" });

    // Cancel the CURRENT version, then cancelling the cancellation is
    // E-REVERSE-REVERSAL.
    const cancelCurrent = await apiPost(worker, session.cookieHeader, "/api/manage-v2/cancel-operation", {
      requestId: `route-${suffix()}`,
      projectId,
      operationId: firstJson.result.operationId,
    });
    expect(cancelCurrent.status).toBe(200);
    const cancelId = ((await cancelCurrent.json()) as RouteResponse).result.operationId;
    const cancelTwice = await apiPost(worker, session.cookieHeader, "/api/manage-v2/cancel-operation", {
      requestId: `route-${suffix()}`,
      projectId,
      operationId: cancelId,
    });
    expect(cancelTwice.status).toBe(400);
    expect((await errorOf(cancelTwice)).details).toMatchObject({ code: "E-REVERSE-REVERSAL" });

    // R-24 + anonymous.
    const otherSub = `m210-other-${suffix()}`;
    const other = await signInAs(worker, { sub: otherSub, email: `${otherSub}@example.com` });
    const foreign = await apiPost(worker, other.cookieHeader, "/api/manage-v2/correct", body);
    expect(foreign.status).toBe(404);
    const anonymous = await apiPost(worker, null, "/api/manage-v2/cancel-operation", body);
    expect(anonymous.status).toBe(401);

    await withSql(async sql => {
      expect(await accountTotal(sql, projectId, "EXP")).toBe(0);
      expect(await boxBalance(sql, projectId, "cash")).toBe(500_000);
      assertLedgerCoreInvariants(await ledgerState(sql, projectId));
    });
  });
});
