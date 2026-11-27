/**
 * PHASE-2 GATE completion (the final regression's missing §12 scenarios):
 * the phase-2 prompt's gate list — S2, S5, S6, S9, T5, T7, T8, T13, T15,
 * T16, T25, T26, T27, T29, T30 (+ T55/T38/T35/T36/T6 where their owning
 * task lives here) — was audited at the gate. Every scenario had a passing
 * test EXCEPT these two, whose halves all live in phase 2:
 *
 *  - S2 (equipment on credit): the expense halves are M2.6-tested and the
 *    pay half M2.8-tested, but the SCENARIO with the spec's own integers
 *    (FIXTURES S2) had no test — its direct-sale 120 part is phase-3-owned
 *    (M3.2/M3.4) and is seeded exactly the way M2.11's figures suite seeds
 *    S1's sale rows (OP-SALE-CREATE + OP-DELIVER Q5 opening the remainder
 *    line + OP-COLLECT Q6 closing it — the §4 shape of a same-day sale
 *    collected in full).
 *  - T26 (lend 50; collect 50): the lend half is M2.7's T25 start and the
 *    collect half is M2.8's by-name allocation over to_me lines — the
 *    loan_given kind is supported (collect.ts) but no test exercised the
 *    pair.
 *
 * Both end with the §13 core assertions (INV-1/INV-2) — the phase gate's
 * own requirement. The implementations already existed; these are the
 * gate's missing proofs, not new behavior.
 */
import type postgres from "postgres";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { startWorker, type WorkerInstance } from "./harness.ts";
import { fileSqlUrl, runPlan, scopedClient, setupProject } from "./manage.v2.helpers.ts";
import { computeManageFigures } from "../application/manage/readModel.js";
import { planExpense } from "../../../../src/domain/manage/operations/expense.js";
import { planPay } from "../../../../src/domain/manage/operations/pay.js";
import { planCollect } from "../../../../src/domain/manage/operations/collect.js";
import { planOwnerWithdrawal } from "../../../../src/domain/manage/operations/ownerMoney.js";
import { assertLedgerCoreInvariants } from "../../../../src/domain/manage/invariants/index.js";
import { accountTotal, boxBalance, ledgerState, linesWithOutstanding } from "./manage.v2.helpers.ts";

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

/* ── S2: equipment on credit (FIXTURES row, the spec's own integers) ────── */

describe("PHASE-2 GATE — S2 equipment on credit", () => {
  it("equipment 300 partial 100 · direct sale 120 (seeded, phase-3-owned) · materials 40 → profit −220, cash 480, payable 200; pay 200 → cash 280, payable 0, profit unchanged", async () => {
    const projectId = crypto.randomUUID();
    const owner = `gate-s2-${suffix()}`;
    await withSql(sql =>
      setupProject(sql, {
        projectId,
        owner,
        today: AMMAN_TODAY,
        boxes: [{ kind: "cash", opening: { openingFils: 500_000 } }],
      }),
    );
    const ctx = { projectId, owner };
    // 1. Expense equipment 300, partial 100 cash (M2.6) — the S2 opener.
    await withSql(sql =>
      runPlan(sql, () =>
        planExpense({
          projectId: ctx.projectId,
          createdByAccountId: ctx.owner,
          requestId: `gate-${suffix()}`,
          today: AMMAN_TODAY,
          amountFils: 300_000,
          category: "equipment",
          payment: { type: "partial", paidFils: 100_000 },
          source: "cash",
          supplierName: "مكتب الأدوات",
        }),
      ),
    );
    // 2. Direct sale 120 cash, collected in full at delivery — the §4
    //    shape: Q5 (REV +120, AR[L] +120 on the remainder line) then the
    //    immediate collection Q6 (BOX +120, AR[L] −120). Seeded exactly the
    //    way M2.11's figures suite seeds S1's sale rows (phase 3 owns the
    //    operations; phase 2 owns the figures they produce).
    await withSql(async sql => {
      const saleId = crypto.randomUUID();
      const createdAt = `${AMMAN_TODAY}T10:00:00.000Z`;
      const createOp = crypto.randomUUID();
      await sql`INSERT INTO sale (id, project_id, customer_name, registered_on, planned_delivery_on,
                                  final_price_minor, tracked, created_at)
                VALUES (${saleId}, ${ctx.projectId}, ${null}, ${AMMAN_TODAY}, ${AMMAN_TODAY},
                        ${120_000}, ${true}, ${createdAt})`;
      await sql`INSERT INTO operation (id, project_id, kind, effective_on, status, sale_id, amount_minor,
                                       payload, created_by_account_id, created_at)
                VALUES (${createOp}, ${ctx.projectId}, ${"OP-SALE-CREATE"}, ${AMMAN_TODAY}, ${"active"},
                        ${saleId}, ${120_000}, ${"{}"}, ${"seed"}, ${createdAt})`;
      const deliverOp = crypto.randomUUID();
      const deliverEntry = crypto.randomUUID();
      const remainderLine = crypto.randomUUID();
      await sql`INSERT INTO operation (id, project_id, kind, effective_on, status, sale_id, balance_line_id,
                                       amount_minor, payload, created_by_account_id, created_at)
                VALUES (${deliverOp}, ${ctx.projectId}, ${"OP-DELIVER"}, ${AMMAN_TODAY}, ${"active"}, ${saleId},
                        ${remainderLine}, ${120_000}, ${"{}"}, ${"seed"}, ${createdAt})`;
      await sql`INSERT INTO balance_line (id, project_id, direction, kind, origin_on, sale_id,
                                          origin_operation_id)
                VALUES (${remainderLine}, ${ctx.projectId}, ${"to_me"}, ${"sale_remainder"}, ${AMMAN_TODAY},
                        ${saleId}, ${deliverOp})`;
      await sql`INSERT INTO ledger_entry (id, project_id, operation_id, entry_type, effective_on, created_at)
                VALUES (${deliverEntry}, ${ctx.projectId}, ${deliverOp}, ${"Q5"}, ${AMMAN_TODAY}, ${createdAt})`;
      await sql`INSERT INTO ledger_posting (id, project_id, entry_id, account, ref_id, rev_kind, delta_minor)
                VALUES (${crypto.randomUUID()}, ${ctx.projectId}, ${deliverEntry}, ${"REV"}, ${saleId},
                        ${"delivery"}, ${120_000}),
                       (${crypto.randomUUID()}, ${ctx.projectId}, ${deliverEntry}, ${"AR"}, ${remainderLine},
                        ${null}, ${120_000})`;
      const collectOp = crypto.randomUUID();
      const collectEntry = crypto.randomUUID();
      await sql`INSERT INTO operation (id, project_id, kind, effective_on, status, sale_id, balance_line_id,
                                       amount_minor, payload, created_by_account_id, created_at)
                VALUES (${collectOp}, ${ctx.projectId}, ${"OP-COLLECT"}, ${AMMAN_TODAY}, ${"active"}, ${saleId},
                        ${remainderLine}, ${120_000}, ${"{}"}, ${"seed"}, ${createdAt})`;
      await sql`INSERT INTO ledger_entry (id, project_id, operation_id, entry_type, effective_on, created_at)
                VALUES (${collectEntry}, ${ctx.projectId}, ${collectOp}, ${"Q6"}, ${AMMAN_TODAY}, ${createdAt})`;
      const cashBox = await sql`SELECT id FROM box WHERE project_id = ${ctx.projectId} AND kind = 'cash'`;
      await sql`INSERT INTO ledger_posting (id, project_id, entry_id, account, ref_id, delta_minor)
                VALUES (${crypto.randomUUID()}, ${ctx.projectId}, ${collectEntry}, ${"BOX"}, ${cashBox[0]!.id},
                        ${120_000}),
                       (${crypto.randomUUID()}, ${ctx.projectId}, ${collectEntry}, ${"AR"}, ${remainderLine},
                        ${-120_000})`;
    });
    // 3. Expense materials 40 cash (M2.6).
    await withSql(sql =>
      runPlan(sql, () =>
        planExpense({
          projectId: ctx.projectId,
          createdByAccountId: ctx.owner,
          requestId: `gate-${suffix()}`,
          today: AMMAN_TODAY,
          amountFils: 40_000,
          category: "materials_packaging",
          payment: { type: "full" },
          source: "cash",
        }),
      ),
    );

    // The S2 figures (FIXTURES row, before the pay): profit −220, cash 480,
    // payable 200, equipment 300, sales 120, expenses 340.
    await withSql(async sql => {
      const figures = await computeManageFigures(sql, ctx.projectId, AMMAN_TODAY, "since_start");
      expect(figures.netProfit.fils).toBe(-220_000);
      expect(figures.totalBalance.fils).toBe(480_000);
      expect(figures.payables.fils).toBe(200_000);
      expect(figures.sales.fils).toBe(120_000);
      expect(figures.expenses.fils).toBe(340_000);
      expect(figures.equipment.fils).toBe(300_000);
      expect(await boxBalance(sql, ctx.projectId, "cash")).toBe(480_000);
      expect(await accountTotal(sql, ctx.projectId, "AP")).toBe(200_000);
      expect(await accountTotal(sql, ctx.projectId, "REV")).toBe(120_000);
      expect(await accountTotal(sql, ctx.projectId, "EXP")).toBe(340_000);
      expect(await accountTotal(sql, ctx.projectId, "AR")).toBe(0);
    });

    // 4. Pay 200 (M2.8) → cash 280, payable 0, profit unchanged (S2's tail).
    await withSql(sql =>
      runPlan(sql, () =>
        planPay({
          projectId: ctx.projectId,
          createdByAccountId: ctx.owner,
          requestId: `gate-${suffix()}`,
          today: AMMAN_TODAY,
          amountFils: 200_000,
          box: "cash",
          counterpartyName: "مكتب الأدوات",
        }),
      ),
    );
    await withSql(async sql => {
      expect(await boxBalance(sql, ctx.projectId, "cash")).toBe(280_000);
      expect(await accountTotal(sql, ctx.projectId, "AP")).toBe(0);
      const figures = await computeManageFigures(sql, ctx.projectId, AMMAN_TODAY, "since_start");
      expect(figures.netProfit.fils).toBe(-220_000);
      expect(figures.totalBalance.fils).toBe(280_000);
      expect(figures.payables.fils).toBe(0);
      // §13: the acceptance test ends with the core assertions.
      const core = assertLedgerCoreInvariants(await ledgerState(sql, ctx.projectId));
      expect(core.inv1.outcome).not.toBe("violation");
      expect(core.inv2.outcome).toBe("pass");
    });
  });
});

/* ── T26: lend 50; collect 50 ──────────────────────────────────────────── */

describe("PHASE-2 GATE — T26 lend then collect", () => {
  it("lend 50 to أخت then collect 50: cash back to original; withdrawals unaffected; profit unchanged", async () => {
    const projectId = crypto.randomUUID();
    const owner = `gate-t26-${suffix()}`;
    await withSql(sql =>
      setupProject(sql, {
        projectId,
        owner,
        today: AMMAN_TODAY,
        boxes: [{ kind: "cash", opening: { openingFils: 100_000 } }],
      }),
    );
    const ctx = { projectId, owner };
    // The lend (M2.7, T25's start): Q13 on a loan_given line.
    await withSql(sql =>
      runPlan(sql, () =>
        planOwnerWithdrawal({
          projectId: ctx.projectId,
          createdByAccountId: ctx.owner,
          requestId: `gate-${suffix()}`,
          today: AMMAN_TODAY,
          amountFils: 50_000,
          box: "cash",
          type: { type: "loan_given", name: "أخت" },
        }),
      ),
    );
    await withSql(async sql => {
      expect(await boxBalance(sql, ctx.projectId, "cash")).toBe(50_000);
      expect(await accountTotal(sql, ctx.projectId, "AR")).toBe(50_000);
      expect(await accountTotal(sql, ctx.projectId, "OWN_OUT")).toBe(0);
    });
    // The collect (M2.8, by name over the loan_given to_me line): Q6.
    await withSql(sql =>
      runPlan(sql, () =>
        planCollect({
          projectId: ctx.projectId,
          createdByAccountId: ctx.owner,
          requestId: `gate-${suffix()}`,
          today: AMMAN_TODAY,
          amountFils: 50_000,
          box: "cash",
          counterpartyName: "أخت",
        }),
      ),
    );
    await withSql(async sql => {
      // Cash back to the original 100; the loan line settled; withdrawals
      // and profit never moved (T26 verbatim).
      expect(await boxBalance(sql, ctx.projectId, "cash")).toBe(100_000);
      expect(await accountTotal(sql, ctx.projectId, "AR")).toBe(0);
      expect(await accountTotal(sql, ctx.projectId, "OWN_OUT")).toBe(0);
      expect(await accountTotal(sql, ctx.projectId, "EXP")).toBe(0);
      const lines = await linesWithOutstanding(sql, ctx.projectId);
      expect(lines).toHaveLength(1);
      expect(lines[0]!.outstanding).toBe(0);
      const figures = await computeManageFigures(sql, ctx.projectId, AMMAN_TODAY, "since_start");
      expect(figures.netProfit.fils).toBe(0);
      expect(figures.personalWithdrawals.fils).toBe(0);
      // §13: the acceptance test ends with the core assertions.
      const core = assertLedgerCoreInvariants(await ledgerState(sql, ctx.projectId));
      expect(core.inv1.outcome).not.toBe("violation");
      expect(core.inv2.outcome).toBe("pass");
    });
  });
});
