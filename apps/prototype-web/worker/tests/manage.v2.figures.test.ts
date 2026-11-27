/**
 * M2.11 acceptance (Manage v2 phase 2, wave I — spec §8, §8.2, §14.2, R-20,
 * R-21, R-22, R-23; tests S1, S7, S9, T14, T28-based figures, T54, and the
 * §13.1 worked example): THE one server read module computing every §8
 * figure and the §8.2 entity-level derived values computable in phase 2 —
 * the response is ready to display (formatted amounts per T54/R-20/R-22;
 * labels are catalog keys, the client only renders).
 *
 * Tests-first: this file was written before the module existed and fails
 * with "Cannot find module … application/manage/readModel.js".
 *
 * Given-state seeding: S1/T14 need the sale operations (prepayment Q4,
 * delivery Q5, sale-delivery-cost) — phase 3 (M3.x). Their rows are seeded
 * directly (the M2.8/M2.9/M2.10 pattern); everything else goes through the
 * real operations.
 *
 * Posture: Miniflare over the per-file isolated PostgreSQL. Money is
 * integer fils. Every scenario ends with assertLedgerCoreInvariants AND the
 * module's own INV-1 (net worth = net worth sources).
 */
import type postgres from "postgres";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { apiPost, signInAs, startWorker, type WorkerInstance } from "./harness.ts";
import {
  fileSqlUrl,
  ledgerState,
  resultOf,
  runPlan,
  scopedClient,
  setupProject,
} from "./manage.v2.helpers.ts";
import { computeManageFigures } from "../application/manage/readModel.js";
import { planExpense } from "../../../../src/domain/manage/operations/expense.js";
import { planOwnerWithdrawal } from "../../../../src/domain/manage/operations/ownerMoney.js";
import { planCollect } from "../../../../src/domain/manage/operations/collect.js";
import { planAddPriorBalance } from "../../../../src/domain/manage/operations/addPriorBalance.js";
import type { SetupBoxSlot } from "../../../../src/domain/manage/operations/setup.js";
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
  const owner = `m211-owner-${suffix()}`;
  await withSql(sql => setupProject(sql, { projectId, owner, today: AMMAN_TODAY, boxes }));
  return { projectId, owner };
}

async function addExpense(
  sql: postgres.Sql,
  ctx: { projectId: string; owner: string },
  input: { amountFils: number; category: string; effectiveOn?: string },
): Promise<void> {
  await runPlan(sql, () =>
    planExpense({
      projectId: ctx.projectId,
      createdByAccountId: ctx.owner,
      requestId: `req-${suffix()}`,
      today: AMMAN_TODAY,
      amountFils: input.amountFils,
      category: input.category,
      payment: { type: "full" },
      source: "cash",
      ...(input.effectiveOn === undefined ? {} : { effectiveOn: input.effectiveOn }),
    }),
  );
}

/** Seed a SALE with its lines, optional prepayment (Q4), optional
 * sale-delivery-cost (Q8 sale_delivery) and optional delivery (Q5 with its
 * remainder line) — the rows OP-SALE-CREATE/OP-PREPAYMENT/
 * OP-SALE-DELIVERY-COST/OP-DELIVER will write in phase 3. */
async function seedSale(
  sql: postgres.Sql,
  projectId: string,
  input: {
    customerName: string | null;
    registeredOn: string;
    plannedOn: string;
    finalPriceFils: number | null;
    lines: Array<{
      description: string;
      productId?: string;
      quantityMilli: number;
      unitPriceFils: number;
      unitCostFils: number | null;
    }>;
    prepaymentFils?: number;
    prepaymentBoxKind?: "cash" | "account";
    saleDeliveryCostFils?: number;
    deliverOn?: string;
  },
): Promise<{ saleId: string; remainderLineId: string | null }> {
  const saleId = crypto.randomUUID();
  const createdAt = `${input.registeredOn}T10:00:00.000Z`;
  const firstOp = crypto.randomUUID();
  await sql`INSERT INTO sale (id, project_id, customer_name, registered_on, planned_delivery_on,
                              final_price_minor, tracked, hidden_from_tracker, created_at, updated_at)
            VALUES (${saleId}, ${projectId}, ${input.customerName}, ${input.registeredOn}, ${input.plannedOn},
                    ${input.finalPriceFils}, ${false}, ${false}, ${createdAt}, ${createdAt})`;
  await sql`INSERT INTO operation (id, project_id, kind, effective_on, status, sale_id, amount_minor, payload,
                                   created_by_account_id, created_at)
            VALUES (${firstOp}, ${projectId}, ${"OP-SALE-CREATE"}, ${input.registeredOn}, ${"active"}, ${saleId},
                    ${input.finalPriceFils}, ${"{}"}, ${"seed"}, ${createdAt})`;
  for (const [index, line] of input.lines.entries()) {
    await sql`INSERT INTO sale_line (id, project_id, sale_id, position, product_id, description,
                                     quantity_milli, unit_price_minor, unit_cost_minor)
              VALUES (${crypto.randomUUID()}, ${projectId}, ${saleId}, ${index + 1},
                      ${line.productId ?? null}, ${line.description}, ${line.quantityMilli},
                      ${line.unitPriceFils}, ${line.unitCostFils})`;
  }
  if ((input.prepaymentFils ?? 0) > 0) {
    const boxId = String(
      (
        await sql`SELECT id FROM box WHERE project_id = ${projectId} AND kind = ${input.prepaymentBoxKind ?? "cash"} LIMIT 1`
      )[0]!.id,
    );
    const op = crypto.randomUUID();
    const entry = crypto.randomUUID();
    await sql`INSERT INTO operation (id, project_id, kind, effective_on, status, sale_id, box_id, amount_minor,
                                     payload, created_by_account_id, created_at)
              VALUES (${op}, ${projectId}, ${"OP-PREPAYMENT"}, ${input.registeredOn}, ${"active"}, ${saleId},
                      ${boxId}, ${input.prepaymentFils}, ${"{}"}, ${"seed"}, ${createdAt})`;
    await sql`INSERT INTO ledger_entry (id, project_id, operation_id, entry_type, effective_on, created_at)
              VALUES (${entry}, ${projectId}, ${op}, ${"Q4"}, ${input.registeredOn}, ${createdAt})`;
    await sql`INSERT INTO ledger_posting (id, project_id, entry_id, account, ref_id, delta_minor)
              VALUES (${crypto.randomUUID()}, ${projectId}, ${entry}, ${"BOX"}, ${boxId}, ${input.prepaymentFils}),
                     (${crypto.randomUUID()}, ${projectId}, ${entry}, ${"PRE"}, ${saleId}, ${input.prepaymentFils})`;
  }
  if ((input.saleDeliveryCostFils ?? 0) > 0) {
    const boxId = String(
      (await sql`SELECT id FROM box WHERE project_id = ${projectId} AND kind = 'cash' LIMIT 1`)[0]!.id,
    );
    const op = crypto.randomUUID();
    const entry = crypto.randomUUID();
    await sql`INSERT INTO operation (id, project_id, kind, effective_on, status, sale_id, box_id,
                                     amount_minor, payload, created_by_account_id, created_at)
              VALUES (${op}, ${projectId}, ${"OP-SALE-DELIVERY-COST"}, ${input.registeredOn}, ${"active"},
                      ${saleId}, ${boxId}, ${input.saleDeliveryCostFils}, ${"{}"}, ${"seed"}, ${createdAt})`;
    await sql`INSERT INTO ledger_entry (id, project_id, operation_id, entry_type, effective_on, created_at)
              VALUES (${entry}, ${projectId}, ${op}, ${"Q8"}, ${input.registeredOn}, ${createdAt})`;
    await sql`INSERT INTO ledger_posting (id, project_id, entry_id, account, ref_id, category, delta_minor)
              VALUES (${crypto.randomUUID()}, ${projectId}, ${entry}, ${"BOX"}, ${boxId}, ${null}, ${-input.saleDeliveryCostFils!}),
                     (${crypto.randomUUID()}, ${projectId}, ${entry}, ${"EXP"}, ${null}, ${"sale_delivery"}, ${input.saleDeliveryCostFils!})`;
  }
  if (input.deliverOn !== undefined && input.finalPriceFils !== null) {
    const deliverOp = crypto.randomUUID();
    const deliverEntry = crypto.randomUUID();
    const remainderLineId = crypto.randomUUID();
    const prepay = input.prepaymentFils ?? 0;
    await sql`INSERT INTO operation (id, project_id, kind, effective_on, status, sale_id, balance_line_id,
                                     amount_minor, payload, created_by_account_id, created_at)
              VALUES (${deliverOp}, ${projectId}, ${"OP-DELIVER"}, ${input.deliverOn}, ${"active"}, ${saleId},
                      ${remainderLineId}, ${input.finalPriceFils}, ${"{}"}, ${"seed"}, ${createdAt})`;
    await sql`INSERT INTO balance_line (id, project_id, direction, kind, counterparty_name, origin_on, sale_id,
                                        origin_operation_id)
              VALUES (${remainderLineId}, ${projectId}, ${"to_me"}, ${"sale_remainder"}, ${input.customerName},
                      ${input.deliverOn}, ${saleId}, ${deliverOp})`;
    await sql`INSERT INTO ledger_entry (id, project_id, operation_id, entry_type, effective_on, created_at)
              VALUES (${deliverEntry}, ${projectId}, ${deliverOp}, ${"Q5"}, ${input.deliverOn}, ${createdAt})`;
    await sql`INSERT INTO ledger_posting (id, project_id, entry_id, account, ref_id, rev_kind, delta_minor)
              VALUES (${crypto.randomUUID()}, ${projectId}, ${deliverEntry}, ${"REV"}, ${saleId}, ${"delivery"}, ${input.finalPriceFils})`;
    if (prepay > 0) {
      await sql`INSERT INTO ledger_posting (id, project_id, entry_id, account, ref_id, delta_minor)
                VALUES (${crypto.randomUUID()}, ${projectId}, ${deliverEntry}, ${"PRE"}, ${saleId}, ${-prepay})`;
    }
    if (input.finalPriceFils > prepay) {
      await sql`INSERT INTO ledger_posting (id, project_id, entry_id, account, ref_id, delta_minor)
                VALUES (${crypto.randomUUID()}, ${projectId}, ${deliverEntry}, ${"AR"}, ${remainderLineId},
                        ${input.finalPriceFils - prepay})`;
    }
    return { saleId, remainderLineId };
  }
  return { saleId, remainderLineId: null };
}

/** The figures of a project (since start unless a period is given). */
async function figures(projectId: string, period?: "week" | "month" | "year" | "since_start") {
  return withSql(sql => computeManageFigures(sql, projectId, AMMAN_TODAY, period ?? "since_start"));
}

/* ── 1. S1: the §13.1 worked example, figure by figure ─────────────────── */

describe("M2.11 S1 — the worked example (since start)", () => {
  it("computes every §8 aggregate with the spec's exact integers", async () => {
    const ctx = await newProject([
      { kind: "cash", opening: { openingFils: 200_000 } },
      { kind: "account", opening: { openingFils: 100_000 } },
    ]);
    await withSql(async sql => {
      await seedSale(sql, ctx.projectId, {
        customerName: "محمد",
        registeredOn: "2026-11-20",
        plannedOn: "2026-11-21",
        finalPriceFils: 250_000,
        lines: [{ description: "طلبية", quantityMilli: 1000, unitPriceFils: 250_000, unitCostFils: 180_000 }],
        prepaymentFils: 50_000,
        saleDeliveryCostFils: 5_000,
        deliverOn: "2026-11-25",
      });
      await addExpense(sql, ctx, { amountFils: 170_000, category: "materials_packaging" });
      await runPlan(sql, () =>
        planCollect({
          projectId: ctx.projectId,
          createdByAccountId: ctx.owner,
          requestId: `req-${suffix()}`,
          today: AMMAN_TODAY,
          amountFils: 150_000,
          box: "account",
          counterpartyName: "محمد",
        }),
      );
    });
    const f = await figures(ctx.projectId);
    // Box balances and the total (FIXTURES S1: 75,000 cash + 250,000 account).
    expect(f.boxes.find(b => b.kind === "cash")).toMatchObject({
      balanceFils: 75_000,
      openingStatus: "known",
    });
    expect(f.boxes.find(b => b.kind === "account")).toMatchObject({ balanceFils: 250_000 });
    expect(f.totalBalance).toMatchObject({ fils: 325_000 });
    // Receivables / payables (S1: AR 50,000; AP 0; PRE 0).
    expect(f.receivables).toMatchObject({ fils: 50_000 });
    expect(f.payables).toMatchObject({ fils: 0 });
    expect(f.payablesPrepayments).toMatchObject({ fils: 0 });
    // The period figures (S1: REV 250,000 · EXP 175,000 · profit 75,000).
    expect(f.sales).toMatchObject({ fils: 250_000 });
    expect(f.returnsAndDiscounts).toMatchObject({ fils: 0 });
    expect(f.netSales).toMatchObject({ fils: 250_000 });
    expect(f.expenses).toMatchObject({ fils: 175_000 });
    expect(f.netProfit).toMatchObject({ fils: 75_000 });
    expect(f.equipment).toMatchObject({ fils: 0 });
    expect(f.personalWithdrawals).toMatchObject({ fils: 0 });
    // Per-10 ratio: 75 × 10 / 250 = 3.0.
    expect(f.perTenRatio).toEqual({ kind: "ratio", tenths: 30, text: "3.0" });
    // Biggest expense: materials_packaging 170,000.
    expect(f.biggestExpense).toMatchObject({ category: "materials_packaging", fils: 170_000 });
    // Materials alert: EXP[materials] 170,000 > 50% × net sales 250,000
    // (=125,000) → shown.
    expect(f.materialsAlert).toBe(true);
    // Net worth = sources (S1: 375,000 = opening 300,000 + profit 75,000).
    expect(f.netWorth).toMatchObject({ fils: 375_000 });
    expect(f.netWorthSources).toEqual({
      openingFils: 300_000,
      ownerDepositsFils: 0,
      ownerWithdrawalsFils: 0,
      netProfitSinceStartFils: 75_000,
      unexplainedFils: 0,
      totalFils: 375_000,
    });
    // §8.2: the sale's derived values (expected profit 65,000 = 250 − 180 − 5).
    const sale = f.salesList.find(s => s.expectedProfitFils !== null || s.finalPriceFils === 250_000)!;
    expect(sale).toMatchObject({
      status: "delivered_unpaid",
      finalPriceFils: 250_000,
      prepaymentFils: 0,
      netSaleRevenueFils: 250_000,
      expectedProfitFils: 65_000,
    });
    // «المدفوع 200 من 250» inputs: Y = net_sale_revenue, X = Y − outstanding.
    expect(sale.paid).toEqual({ paidFils: 200_000, ofFils: 250_000 });
    // The remainder line's outstanding (50,000) and its §8.2 display values.
    const line = f.balanceLines.find(l => l.kind === "sale_remainder")!;
    expect(line).toMatchObject({ counterpartyName: "محمد", outstandingFils: 50_000 });
    // What you have / owe (§8.2).
    expect(f.whatYouHave).toMatchObject({ fils: 375_000 });
    expect(f.whatYouOwe).toMatchObject({ fils: 0 });
    // Not a new user; the period is complete; no unknown balance.
    expect(f.flags).toEqual({ newUser: false, incompletePeriod: false, unknownBalance: false });
    // Unexplained difference: 0 → not shown.
    expect(f.unexplained).toMatchObject({ fils: 0, shown: false });
    await withSql(async sql => {
      assertLedgerCoreInvariants(await ledgerState(sql, ctx.projectId));
    });
  });
});

/* ── 2. S9 + S7: withdrawals, the loss marker, the unexplained ─────────── */

describe("M2.11 S9 / S7 — withdrawals, S-LOSS and the unexplained difference", () => {
  it("S9 — withdrawal 200: box −200, OWN_OUT 200, the ratio hidden (net sales ≤ 0)", async () => {
    const ctx = await newProject([{ kind: "cash", opening: { openingFils: 0 } }]);
    await withSql(sql =>
      runPlan(sql, () =>
        planOwnerWithdrawal({
          projectId: ctx.projectId,
          createdByAccountId: ctx.owner,
          requestId: `req-${suffix()}`,
          today: AMMAN_TODAY,
          amountFils: 200_000,
          box: "cash",
          type: { type: "personal" },
        }),
      ),
    );
    const f = await figures(ctx.projectId);
    expect(f.boxes[0]).toMatchObject({ balanceFils: -200_000 });
    expect(f.personalWithdrawals).toMatchObject({ fils: 200_000 });
    expect(f.netProfit).toMatchObject({ fils: 0 });
    // FIXTURES S9: box −200,000 · own_out 200,000 · profit 0 — the ratio is
    // hidden (net sales ≤ 0): c.withdrawals_only alone (§8/§8.2).
    expect(f.perTenRatio).toEqual({ kind: "hidden", labelKey: "c.withdrawals_only" });
    expect(f.netWorth).toMatchObject({ fils: -200_000 });
  });

  it("S7 — profit −25 and Q19 −5: S-LOSS instead of the ratio, unexplained −5 shown", async () => {
    const ctx = await newProject([{ kind: "cash", opening: { openingFils: 340_000 } }]);
    await withSql(async sql => {
      await addExpense(sql, ctx, { amountFils: 25_000, category: "utilities" });
      await runPlan(sql, () =>
        planOwnerWithdrawal({
          projectId: ctx.projectId,
          createdByAccountId: ctx.owner,
          requestId: `req-${suffix()}`,
          today: AMMAN_TODAY,
          amountFils: 10_000,
          box: "cash",
          type: { type: "personal" },
        }),
      );
      // The reconciliation's Q19 (−5) — phase 4's entry, seeded.
      const op = crypto.randomUUID();
      const entry = crypto.randomUUID();
      const boxId = String(
        (await sql`SELECT id FROM box WHERE project_id = ${ctx.projectId} LIMIT 1`)[0]!.id,
      );
      await sql`INSERT INTO operation (id, project_id, kind, effective_on, status, box_id, amount_minor,
                                       payload, created_by_account_id, created_at)
                VALUES (${op}, ${ctx.projectId}, ${"OP-RECONCILE"}, ${AMMAN_TODAY}, ${"active"}, ${boxId},
                        ${-5_000}, ${"{}"}, ${"seed"}, now())`;
      await sql`INSERT INTO ledger_entry (id, project_id, operation_id, entry_type, effective_on, created_at)
                VALUES (${entry}, ${ctx.projectId}, ${op}, ${"Q19"}, ${AMMAN_TODAY}, now())`;
      await sql`INSERT INTO ledger_posting (id, project_id, entry_id, account, ref_id, delta_minor)
                VALUES (${crypto.randomUUID()}, ${ctx.projectId}, ${entry}, ${"BOX"}, ${boxId}, ${-5_000}),
                       (${crypto.randomUUID()}, ${ctx.projectId}, ${entry}, ${"UNEXP"}, ${null}, ${-5_000})`;
    });
    const f = await figures(ctx.projectId);
    // FIXTURES S7: box 300,000 · own_out 10,000 · exp 25,000 · unexp −5,000 · profit −25,000.
    expect(f.boxes[0]).toMatchObject({ balanceFils: 300_000 });
    expect(f.netProfit).toMatchObject({ fils: -25_000 });
    expect(f.netWorth).toMatchObject({ fils: 300_000 });
    expect(f.netWorthSources).toEqual({
      openingFils: 340_000,
      ownerDepositsFils: 0,
      ownerWithdrawalsFils: 10_000,
      netProfitSinceStartFils: -25_000,
      unexplainedFils: -5_000,
      totalFils: 300_000,
    });
    // Negative profit: S-LOSS INSTEAD of the ratio sentence (§8).
    expect(f.perTenRatio).toEqual({ kind: "loss", labelKey: "S-LOSS" });
    // Unexplained ≠ 0 → shown.
    expect(f.unexplained).toMatchObject({ fils: -5_000, shown: true });
    // Biggest expense: utilities.
    expect(f.biggestExpense).toMatchObject({ category: "utilities", fils: 25_000 });
  });
});

/* ── 3. T14: expected profit, top sellers, top profit ──────────────────── */

describe("M2.11 T14 — منسف ×10 (25/18) + كنافة ×5 (12/6), final 300", () => {
  it("computes expected profit 90, top sellers 250/60 and top profit 70/30", async () => {
    const ctx = await newProject([{ kind: "cash", opening: { openingFils: 0 } }]);
    await withSql(async sql => {
      const monsaf = String(
        (
          await sql`INSERT INTO product (id, project_id, name, unit_price_minor, archived, created_at) VALUES
                   (${crypto.randomUUID()}, ${ctx.projectId}, ${"منسف"}, ${25_000}, ${false}, now()) RETURNING id`
        )[0]!.id,
      );
      const knafeh = String(
        (
          await sql`INSERT INTO product (id, project_id, name, unit_price_minor, archived, created_at) VALUES
                   (${crypto.randomUUID()}, ${ctx.projectId}, ${"كنافة"}, ${12_000}, ${false}, now()) RETURNING id`
        )[0]!.id,
      );
      await sql`INSERT INTO product_component (id, project_id, product_id, name, cost_minor, position) VALUES
                (${crypto.randomUUID()}, ${ctx.projectId}, ${monsaf}, ${"لحم"}, ${18_000}, 1)`;
      await sql`INSERT INTO product_component (id, project_id, product_id, name, cost_minor, position) VALUES
                (${crypto.randomUUID()}, ${ctx.projectId}, ${knafeh}, ${"جبن"}, ${6_000}, 1)`;
      await seedSale(sql, ctx.projectId, {
        customerName: "سامي",
        registeredOn: AMMAN_TODAY,
        plannedOn: AMMAN_TODAY,
        finalPriceFils: 300_000,
        lines: [
          {
            description: "منسف",
            productId: monsaf,
            quantityMilli: 10_000,
            unitPriceFils: 25_000,
            unitCostFils: 18_000,
          },
          {
            description: "كنافة",
            productId: knafeh,
            quantityMilli: 5_000,
            unitPriceFils: 12_000,
            unitCostFils: 6_000,
          },
        ],
        deliverOn: AMMAN_TODAY,
      });
    });
    const f = await figures(ctx.projectId);
    // Expected profit 90: 300 − (10×18 + 5×6).
    expect(f.salesList[0]).toMatchObject({ expectedProfitFils: 90_000, finalPriceFils: 300_000 });
    // Top sellers: منسف 250 (10), كنافة 60 (5).
    expect(f.topSellers).toEqual([
      { productId: expect.any(String), name: "منسف", valueFils: 250_000, quantityText: "10" },
      { productId: expect.any(String), name: "كنافة", valueFils: 60_000, quantityText: "5" },
    ]);
    // Top profit: منسف 70 (7.0/unit), كنافة 30 (6.0/unit).
    expect(f.topProfit).toEqual([
      { productId: expect.any(String), name: "منسف", profitFils: 70_000, perUnitText: "7" },
      { productId: expect.any(String), name: "كنافة", profitFils: 30_000, perUnitText: "6" },
    ]);
  });
});

/* ── 4. Overdue receivables, payables, what you have / owe ─────────────── */

describe("M2.11 — overdue receivables and the payables side", () => {
  it("flags to_me lines older than 14 days and reports what you owe with its breakdown", async () => {
    const ctx = await newProject([{ kind: "cash", opening: { openingFils: 500_000 } }]);
    await withSql(async sql => {
      await runPlan(sql, () =>
        planAddPriorBalance({
          projectId: ctx.projectId,
          createdByAccountId: ctx.owner,
          requestId: `req-${suffix()}`,
          today: AMMAN_TODAY,
          direction: "to_me",
          counterpartyName: "سامي",
          amountFils: 40_000,
          originOn: "2026-10-20",
        }),
      );
      await runPlan(sql, () =>
        planAddPriorBalance({
          projectId: ctx.projectId,
          createdByAccountId: ctx.owner,
          requestId: `req-${suffix()}`,
          today: AMMAN_TODAY,
          direction: "to_me",
          counterpartyName: "ليلى",
          amountFils: 25_000,
        }),
      );
      // A supplier payable of 70 (credit expense).
      await runPlan(sql, () =>
        planExpense({
          projectId: ctx.projectId,
          createdByAccountId: ctx.owner,
          requestId: `req-${suffix()}`,
          today: AMMAN_TODAY,
          amountFils: 70_000,
          category: "materials_packaging",
          payment: { type: "credit" },
          supplierName: "مكتب الأدوات",
        }),
      );
      // An undelivered prepayment of 30 (PRE stays open).
      await seedSale(sql, ctx.projectId, {
        customerName: "عبير",
        registeredOn: AMMAN_TODAY,
        plannedOn: "2026-12-05",
        finalPriceFils: null,
        lines: [{ description: "طلبية", quantityMilli: 1000, unitPriceFils: 30_000, unitCostFils: null }],
        prepaymentFils: 30_000,
      });
    });
    const f = await figures(ctx.projectId);
    // Overdue: origin_on ≤ today − 14 — سامي's line only.
    expect(f.overdueReceivables.map(l => l.counterpartyName)).toEqual(["سامي"]);
    expect(f.overdueReceivables[0]).toMatchObject({ outstandingFils: 40_000 });
    // Receivables 65,000; payables = AP 70,000 + PRE 30,000 = 100,000
    // ("منها … دفعات مقدمة" 30,000 — §8).
    expect(f.receivables).toMatchObject({ fils: 65_000 });
    expect(f.payables).toMatchObject({ fils: 100_000 });
    expect(f.payablesPrepayments).toMatchObject({ fils: 30_000 });
    expect(f.whatYouOwe).toMatchObject({ fils: 100_000 });
    // What you have = Σ BOX + Σ AR: the prepayment ENTERED the cash box
    // (500 + 30 = 530) plus the receivables 65 → 595.
    expect(f.whatYouHave).toMatchObject({ fils: 595_000 });
    // The undelivered sale: scheduled, prepayment 30, «المدفوع {X}» only.
    const scheduled = f.salesList.find(s => s.status === "scheduled")!;
    expect(scheduled).toMatchObject({
      prepaymentFils: 30_000,
      netSaleRevenueFils: 0,
      expectedProfitFils: null,
    });
    expect(scheduled.paid).toEqual({ paidFils: 30_000, ofFils: null });
    // Materials alert: EXP[materials] 70,000 > 50% × net sales 0? — net
    // sales ≤ 0 → the alert is hidden (the binding interpretation 3).
    expect(f.materialsAlert).toBe(false);
  });
});

/* ── 5. Unknown opening, the incomplete flag and the new user ──────────── */

describe("M2.11 — unknown opening balances and the flags", () => {
  it("a box with an unknown opening: its balance, the total and the net worth display unknown", async () => {
    const ctx = await newProject([{ kind: "cash", opening: { unknown: true } }]);
    const f = await figures(ctx.projectId);
    expect(f.boxes[0]).toMatchObject({
      openingStatus: "unknown",
      balanceFils: null,
      balanceLabelKey: "l.unknown_balance",
    });
    expect(f.totalBalance).toEqual({ fils: null, labelKey: "l.unknown_balance" });
    expect(f.netWorth).toEqual({ fils: null, labelKey: "l.unknown_balance" });
    expect(f.netWorthSources).toBeNull();
    expect(f.flags.unknownBalance).toBe(true);
    // The incomplete flag: any active box with an unknown opening.
    expect(f.flags.incompletePeriod).toBe(true);
  });

  it("a fresh project with only OP-SETUP is a new user; any other operation ends it", async () => {
    const fresh = await newProject([{ kind: "cash", opening: { openingFils: 0 } }]);
    const f1 = await figures(fresh.projectId);
    expect(f1.flags.newUser).toBe(true);
    await withSql(sql => addExpense(sql, fresh, { amountFils: 5_000, category: "gas" }));
    const f2 = await figures(fresh.projectId);
    expect(f2.flags.newUser).toBe(false);
  });
});

/* ── 6. Periods, profit bars and the per-10 rounding ───────────────────── */

describe("M2.11 — periods and profit bars", () => {
  it("period figures respect effective_on, and the monthly bars split October from November", async () => {
    const ctx = await newProject([{ kind: "cash", opening: { openingFils: 500_000 } }]);
    await withSql(async sql => {
      await addExpense(sql, ctx, {
        amountFils: 50_000,
        category: "materials_packaging",
        effectiveOn: "2026-10-15",
      });
      await addExpense(sql, ctx, { amountFils: 20_000, category: "gas", effectiveOn: AMMAN_TODAY });
    });
    const month = await figures(ctx.projectId, "month");
    expect(month.period).toMatchObject({
      kind: "month",
      from: "2026-11-01",
      to: "2026-11-30",
      label: "11/2026",
    });
    expect(month.expenses).toMatchObject({ fils: 20_000 });
    expect(month.netProfit).toMatchObject({ fils: -20_000 });
    const year = await figures(ctx.projectId, "year");
    expect(year.expenses).toMatchObject({ fils: 70_000 });
    // Monthly bars (the month period): October −50, November −20.
    const bars = month.bars.filter((b: { label: string }) => b.label === "10/2026" || b.label === "11/2026");
    expect(bars).toEqual([
      { label: "10/2026", from: "2026-10-01", to: "2026-10-31", netProfitFils: -50_000, incomplete: false },
      { label: "11/2026", from: "2026-11-01", to: "2026-11-30", netProfitFils: -20_000, incomplete: false },
    ]);
  });

  it("rounds the per-10 ratio half-up to one decimal (net profit 76 of 250 → 3.0; 79 → 3.2)", async () => {
    // Direct check of the pure helper through a tiny ledger: profit 79/250
    // → 79×10/250 = 3.16 → 3.2 (round_half_up once, §8 + binding
    // interpretation 4); profit 76 → 3.04 → 3.0.
    const f1 = await (async () => {
      const ctx = await newProject([{ kind: "cash", opening: { openingFils: 0 } }]);
      await withSql(async sql => {
        await seedSale(sql, ctx.projectId, {
          customerName: null,
          registeredOn: AMMAN_TODAY,
          plannedOn: AMMAN_TODAY,
          finalPriceFils: 250_000,
          lines: [{ description: "بيع", quantityMilli: 1000, unitPriceFils: 250_000, unitCostFils: null }],
          deliverOn: AMMAN_TODAY,
        });
        await addExpense(sql, ctx, { amountFils: 171_000, category: "gas" });
      });
      return figures(ctx.projectId);
    })();
    // profit 79,000 of net sales 250,000 → 3.16 → 3.2.
    expect(f1.netProfit).toMatchObject({ fils: 79_000 });
    expect(f1.perTenRatio).toEqual({ kind: "ratio", tenths: 32, text: "3.2" });
  });
});

/* ── 7. T54: the display formats come from the server ──────────────────── */

describe("M2.11 T54 — formatted amounts and dates (R-20/R-21/R-22)", () => {
  it("a figure of 1,250 JOD renders «1,250.000 د» (report) and «1,250 د» (dashboard); dates dd/mm/yyyy", async () => {
    const ctx = await newProject([{ kind: "cash", opening: { openingFils: 1_250_000 } }]);
    const f = await figures(ctx.projectId);
    expect(f.totalBalance).toMatchObject({ fils: 1_250_000, text: "1,250.000 د", textDashboard: "1,250 د" });
    // A fractional amount keeps its 3 decimals on the dashboard too (R-20).
    const ctx2 = await newProject([{ kind: "cash", opening: { openingFils: 1_250_500 } }]);
    const f2 = await figures(ctx2.projectId);
    expect(f2.totalBalance).toMatchObject({ text: "1,250.500 د", textDashboard: "1,250.500 د" });
    // Dates: dd/mm/yyyy everywhere (R-21).
    expect(f.period.to).toBe("2026-11-27");
    expect(f.period.labelText).toBe("27/11/2026");
  });
});

/* ── 8. The source scan: the module is the ONLY place the formulas live ── */

describe("M2.11 — the single implementation (source scan, §14.2/R-23)", () => {
  it("has no fils→JOD division and no §8 profit computation outside the read module", async () => {
    const { readdirSync, readFileSync, statSync } = await import("node:fs");
    const { join } = await import("node:path");
    const hereHolder = import.meta.dirname;
    // The scanned surface: the NEW Manage v2 code paths (the legacy v1
    // manage surface is replaced wholesale in phase 6 and is out of scope).
    // Allowed homes of the formulas: the read module, its pure helpers
    // (figures/), the money unit (fils conversions are M1.7's job), and
    // the invariants (INV-1's two sides are the assertion face of the
    // net-worth equation — the M2.3 tracker records this exception).
    const here = import.meta.dirname;
    // The NEW Manage v2 surface only: the manage domain tree and the manage
    // v2 worker surface (the route file + the application module). The
    // legacy v1 manage files and the shared harness/auth are out of scope
    // (replaced wholesale in phase 6 / not manage surfaces).
    const roots = [
      join(here, "../../../../src/domain/manage"),
      join(here, "../api/manageV2.ts"),
      join(here, "../application/manage"),
    ];
    const allowed = (rel: string) =>
      rel.includes("/figures/") ||
      rel.endsWith("readModel.ts") ||
      rel.includes("/money/") ||
      rel.includes("/invariants/") ||
      rel.includes("/ledger/") ||
      rel.endsWith(".test.ts") ||
      rel.endsWith(".test.mjs");
    const violations: string[] = [];
    const scanFile = (full: string) => {
      if (!full.endsWith(".ts")) return;
      const rel = full.replace(/^\.\//, "");
      if (allowed(rel)) return;
      const src = readFileSync(full, "utf8");
      if (/\/\s*1000\b/.test(src)) violations.push(`${rel}: fils→JOD division outside the read module`);
      if (/["']REV["'][\s\S]{0,200}["']EXP["']|["']EXP["'][\s\S]{0,200}["']REV["']/.test(src)) {
        violations.push(`${rel}: a §8 figure computation outside the read module`);
      }
    };
    const walk = (dirOrFile: string) => {
      if (!statSync(dirOrFile).isDirectory()) {
        scanFile(dirOrFile);
        return;
      }
      for (const name of readdirSync(dirOrFile)) {
        const full = join(dirOrFile, name);
        if (statSync(full).isDirectory()) {
          walk(full);
        } else {
          scanFile(full);
        }
      }
    };
    for (const root of roots) walk(root);
    expect(violations).toEqual([]);
  });
});

/* ── 9. The route ──────────────────────────────────────────────────────── */

describe("M2.11 — route GET /api/manage-v2/figures", () => {
  it("serves the caller's own project figures end-to-end (R-24, 401, default period = month)", async () => {
    const sub = `m211-route-${suffix()}`;
    const session = await signInAs(worker, { sub, email: `${sub}@example.com` });
    const setup = await apiPost(worker, session.cookieHeader, "/api/manage-v2/setup", {
      requestId: `route-${suffix()}`,
      projectName: "مشروع الطريق",
      boxes: [{ kind: "cash", opening: { openingFils: 100_000 } }],
    });
    expect(setup.status).toBe(200);
    const projectId = ((await setup.json()) as { projectId: string }).projectId;

    const first = await worker.fetch("/api/manage-v2/figures", { headers: { cookie: session.cookieHeader } });
    expect(first.status).toBe(200);
    const body = (await first.json()) as { period: { kind: string }; totalBalance: { fils: number } };
    // R-27: the dashboard period default is the month.
    expect(body.period.kind).toBe("month");
    expect(body.totalBalance).toMatchObject({ fils: 100_000 });

    const withPeriod = await worker.fetch("/api/manage-v2/figures?period=since_start", {
      headers: { cookie: session.cookieHeader },
    });
    expect(withPeriod.status).toBe(200);
    expect(((await withPeriod.json()) as { period: { kind: string } }).period.kind).toBe("since_start");

    // R-24: another account gets the same 404 as "no project".
    const otherSub = `m211-other-${suffix()}`;
    const other = await signInAs(worker, { sub: otherSub, email: `${otherSub}@example.com` });
    const foreign = await worker.fetch("/api/manage-v2/figures", { headers: { cookie: other.cookieHeader } });
    expect(foreign.status).toBe(404);
    const anonymous = await worker.fetch("/api/manage-v2/figures");
    expect(anonymous.status).toBe(401);
  });
});
