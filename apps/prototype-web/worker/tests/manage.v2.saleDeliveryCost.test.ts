/**
 * M3.5 acceptance (Manage v2 phase 3 — spec §5 OP-SALE-DELIVERY-COST, §4
 * Q8/Q10, R-18; tests S1 COMPLETE, T30's delivery-portion shape, T43): the
 * sale's delivery cost — a paid expense of the internal-only category
 * `sale_delivery` (R-10: created only from a sale's delivery-cost field),
 * from a box or from the owner's personal money (which passes through the
 * cash box, R-18). Allowed in ANY sale state except cancelled; multiple
 * entries per sale are allowed.
 *
 * Tests-first: this file was written before the operation existed and fails
 * with "Cannot find module … operations/saleDeliveryCost.js".
 *
 * S1 runs COMPLETE here for the first time — every operation of the
 * scenario is now real: OP-SALE-CREATE + OP-PREPAYMENT (M3.2/M3.3),
 * OP-EXPENSE (M2.6), OP-SALE-DELIVERY-COST (this task), OP-DELIVER +
 * OP-COLLECT (M3.4).
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
import { planPrepayment } from "../../../../src/domain/manage/operations/prepayment.js";
import { planDeliver } from "../../../../src/domain/manage/operations/deliver.js";
import { planSaleDeliveryCost } from "../../../../src/domain/manage/operations/saleDeliveryCost.js";
import { planExpense } from "../../../../src/domain/manage/operations/expense.js";
import { saveProduct } from "../application/manage/products.js";
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
  const owner = `m35-owner-${suffix()}`;
  await withSql(sql => setupProject(sql, { projectId, owner, today: AMMAN_TODAY, boxes }));
  return { projectId, owner };
}

/** A sale (+ optional prepayment) through the real operations. */
async function createSale(
  sql: postgres.Sql,
  ctx: { projectId: string; owner: string },
  seed: {
    plannedDeliveryOn: string;
    finalPriceFils: number;
    customerName?: string;
    registeredOn?: string;
    prepaymentFils?: number;
    prepaymentOn?: string;
  },
): Promise<string> {
  // A product line with a KNOWN cost (one 0-cost component — an explicit 0
  // is a value, §3.3) so the expected-profit assertions are meaningful.
  const productId = (
    await saveProduct(sql, {
      projectId: ctx.projectId,
      productId: crypto.randomUUID(),
      name: "طلب جاهز",
      unitPriceFils: seed.finalPriceFils,
      components: [{ name: "لا تكلفة", costFils: 0 }],
    })
  ).productId;
  const outcome = await runPlan(sql, () =>
    planSaleCreate({
      projectId: ctx.projectId,
      createdByAccountId: ctx.owner,
      requestId: `m35-${crypto.randomUUID()}`,
      today: AMMAN_TODAY,
      lines: [{ productId, quantityMilli: 1000 }],
      plannedDeliveryOn: seed.plannedDeliveryOn,
      finalPriceFils: seed.finalPriceFils,
      ...(seed.customerName === undefined ? {} : { customerName: seed.customerName }),
      ...(seed.registeredOn === undefined ? {} : { registeredOn: seed.registeredOn }),
    }),
  );
  const saleId = String((resultOf(outcome, "applied").data as { saleId: string }).saleId);
  if ((seed.prepaymentFils ?? 0) > 0) {
    await runPlan(sql, () =>
      planPrepayment({
        projectId: ctx.projectId,
        createdByAccountId: ctx.owner,
        requestId: `m35-${crypto.randomUUID()}`,
        today: AMMAN_TODAY,
        saleId,
        amountFils: seed.prepaymentFils!,
        box: "cash",
        ...(seed.prepaymentOn === undefined ? {} : { effectiveOn: seed.prepaymentOn }),
      }),
    );
  }
  return saleId;
}

/* ── 1. S1 COMPLETE — the whole scenario with real operations ─────────── */

describe("M3.5 S1 (complete) — the full order, every operation real", () => {
  it("reaches the spec's exact integers: profit 75, expected 65, cash 75, account 250, receivable 50", async () => {
    const ctx = await newProject([
      { kind: "cash", opening: { openingFils: 200_000 } },
      { kind: "account", opening: { openingFils: 100_000 } },
    ]);
    const saleId = await withSql(async sql => {
      const monsaf = (
        await saveProduct(sql, {
          projectId: ctx.projectId,
          productId: crypto.randomUUID(),
          name: "منسف",
          unitPriceFils: 25_000,
          components: [{ name: "لحم", costFils: 18_000 }],
        })
      ).productId;
      // Day 1: the sale (منسف ×10 = 250, cost 180), planned day 4, and the
      // prepayment 50 cash.
      const outcome = await runPlan(sql, () =>
        planSaleCreate({
          projectId: ctx.projectId,
          createdByAccountId: ctx.owner,
          requestId: `m35-${crypto.randomUUID()}`,
          today: "2026-11-24",
          lines: [{ productId: monsaf, quantityMilli: 10_000 }],
          plannedDeliveryOn: "2026-11-27",
          finalPriceFils: 250_000,
          customerName: "محمد",
          registeredOn: "2026-11-24",
        }),
      );
      const sale = String((resultOf(outcome, "applied").data as { saleId: string }).saleId);
      await runPlan(sql, () =>
        planPrepayment({
          projectId: ctx.projectId,
          createdByAccountId: ctx.owner,
          requestId: `m35-${crypto.randomUUID()}`,
          today: "2026-11-24",
          saleId: sale,
          amountFils: 50_000,
          box: "cash",
          effectiveOn: "2026-11-24",
        }),
      );
      // Day 2: expense materials_packaging 170 cash (M2.6).
      await runPlan(sql, () =>
        planExpense({
          projectId: ctx.projectId,
          createdByAccountId: ctx.owner,
          requestId: `m35-${crypto.randomUUID()}`,
          today: "2026-11-25",
          amountFils: 170_000,
          category: "materials_packaging",
          payment: { type: "full" },
          source: "cash",
          effectiveOn: "2026-11-25",
        }),
      );
      // Day 4: the sale's delivery cost 5 cash (THIS task), deliver, and
      // collect 150 account.
      await runPlan(sql, () =>
        planSaleDeliveryCost({
          projectId: ctx.projectId,
          createdByAccountId: ctx.owner,
          requestId: `m35-${crypto.randomUUID()}`,
          today: "2026-11-27",
          saleId: sale,
          amountFils: 5_000,
          source: "cash",
          effectiveOn: "2026-11-27",
        }),
      );
      await runPlan(sql, () =>
        planDeliver({
          projectId: ctx.projectId,
          createdByAccountId: ctx.owner,
          requestId: `m35-${crypto.randomUUID()}`,
          today: "2026-11-27",
          saleId: sale,
          collection: { amountFils: 150_000, box: "account" },
        }),
      );
      return sale;
    });

    const figures = await withSql(sql =>
      computeManageFigures(sql, ctx.projectId, AMMAN_TODAY, "since_start"),
    );
    // Net profit 75 (REV 250, EXP 175).
    expect(figures.netSales.fils).toBe(250_000);
    expect(figures.expenses.fils).toBe(175_000);
    expect(figures.netProfit.fils).toBe(75_000);
    // Expected profit 65: 250 − 180 − 5 (§8: Σ EXP[sale_delivery] of the sale).
    expect(figures.salesList.find(s => s.id === saleId)?.expectedProfitFils).toBe(65_000);
    // Cash 75, account 250.
    expect(await withSql(sql => boxBalance(sql, ctx.projectId, "cash"))).toBe(75_000);
    expect(await withSql(sql => boxBalance(sql, ctx.projectId, "account"))).toBe(250_000);
    // Receivable محمد 50; status delivered_unpaid; paid "200 of 250".
    expect(figures.receivables.fils).toBe(50_000);
    expect(figures.balanceLines.find(l => l.outstandingFils > 0)?.counterpartyName).toBe("محمد");
    expect(figures.salesList.find(s => s.id === saleId)).toMatchObject({
      status: "delivered_unpaid",
      paid: { paidFils: 200_000, ofFils: 250_000 },
    });
    // Net worth 375 = opening 300 + profit 75.
    expect(figures.netWorth.fils).toBe(375_000);

    await withSql(async sql => assertLedgerCoreInvariants(await ledgerState(sql, ctx.projectId)));
  });
});

/* ── 2. The §5 contract: Q8 from a box, personal through cash, states ─── */

describe("M3.5 — OP-SALE-DELIVERY-COST (§5)", () => {
  it("posts Q8 category sale_delivery from the box; the operation shows the delivery portion (T30's shape)", async () => {
    const ctx = await newProject([{ kind: "cash", opening: { openingFils: 20_000 } }]);
    await withSql(async sql => {
      const saleId = await createSale(sql, ctx, {
        plannedDeliveryOn: "2026-11-30",
        finalPriceFils: 50_000,
        customerName: "سامي",
      });
      const outcome = await runPlan(sql, () =>
        planSaleDeliveryCost({
          projectId: ctx.projectId,
          createdByAccountId: ctx.owner,
          requestId: `m35-${crypto.randomUUID()}`,
          today: AMMAN_TODAY,
          saleId,
          amountFils: 2_000,
          source: "cash",
        }),
      );
      expect(resultOf(outcome, "applied").kind).toBe("OP-SALE-DELIVERY-COST");
      // EXP[sale_delivery] 2; cash −2.
      expect(await accountTotal(sql, ctx.projectId, "EXP")).toBe(2_000);
      expect(await boxBalance(sql, ctx.projectId, "cash")).toBe(18_000);
      // The operation row carries the category and the delivery portion.
      const op = await sql`SELECT category, delivery_cost_minor, sale_id FROM operation
                           WHERE project_id = ${ctx.projectId} AND kind = 'OP-SALE-DELIVERY-COST'`;
      expect(op[0]).toMatchObject({
        category: "sale_delivery",
        delivery_cost_minor: "2000",
        sale_id: saleId,
      });
      // The expected profit drops by the sale's delivery cost (§8).
      const figures = await computeManageFigures(sql, ctx.projectId, AMMAN_TODAY, "since_start");
      expect(figures.salesList.find(s => s.id === saleId)?.expectedProfitFils).toBe(48_000);
      await assertLedgerCoreInvariants(await ledgerState(sql, ctx.projectId));
    });
  });

  it("T43: personal money passes through cash — both boxes unchanged, profit −15", async () => {
    const ctx = await newProject([
      { kind: "cash", opening: { openingFils: 30_000 } },
      { kind: "account", opening: { openingFils: 40_000 } },
    ]);
    await withSql(async sql => {
      const saleId = await createSale(sql, ctx, {
        plannedDeliveryOn: "2026-11-30",
        finalPriceFils: 50_000,
        customerName: "سامي",
      });
      await runPlan(sql, () =>
        planSaleDeliveryCost({
          projectId: ctx.projectId,
          createdByAccountId: ctx.owner,
          requestId: `m35-${crypto.randomUUID()}`,
          today: AMMAN_TODAY,
          saleId,
          amountFils: 15_000,
          source: "personal",
        }),
      );
      // Q10 + Q8 on cash: net zero (R-18).
      expect(await boxBalance(sql, ctx.projectId, "cash")).toBe(30_000);
      expect(await boxBalance(sql, ctx.projectId, "account")).toBe(40_000);
      expect(await accountTotal(sql, ctx.projectId, "EXP")).toBe(15_000);
      expect(await accountTotal(sql, ctx.projectId, "OWN_IN")).toBe(15_000);
      const figures = await computeManageFigures(sql, ctx.projectId, AMMAN_TODAY, "since_start");
      expect(figures.netProfit.fils).toBe(-15_000);
      await assertLedgerCoreInvariants(await ledgerState(sql, ctx.projectId));
    });
  });

  it("allowed on a DELIVERED sale; multiple entries per sale accumulate", async () => {
    const ctx = await newProject([{ kind: "cash", opening: { openingFils: 0 } }]);
    await withSql(async sql => {
      const saleId = await createSale(sql, ctx, {
        plannedDeliveryOn: AMMAN_TODAY,
        finalPriceFils: 50_000,
        customerName: "سامي",
      });
      await runPlan(sql, () =>
        planDeliver({
          projectId: ctx.projectId,
          createdByAccountId: ctx.owner,
          requestId: `m35-${crypto.randomUUID()}`,
          today: AMMAN_TODAY,
          saleId,
        }),
      );
      // Delivered — still allowed (§5: any state except cancelled).
      await runPlan(sql, () =>
        planSaleDeliveryCost({
          projectId: ctx.projectId,
          createdByAccountId: ctx.owner,
          requestId: `m35-${crypto.randomUUID()}`,
          today: AMMAN_TODAY,
          saleId,
          amountFils: 3_000,
          source: "cash",
        }),
      );
      await runPlan(sql, () =>
        planSaleDeliveryCost({
          projectId: ctx.projectId,
          createdByAccountId: ctx.owner,
          requestId: `m35-${crypto.randomUUID()}`,
          today: AMMAN_TODAY,
          saleId,
          amountFils: 2_000,
          source: "cash",
        }),
      );
      expect(await accountTotal(sql, ctx.projectId, "EXP")).toBe(5_000);
      const figures = await computeManageFigures(sql, ctx.projectId, AMMAN_TODAY, "since_start");
      expect(figures.salesList.find(s => s.id === saleId)?.expectedProfitFils).toBe(45_000);
      await assertLedgerCoreInvariants(await ledgerState(sql, ctx.projectId));
    });
  });

  it("rejects a cancelled sale (E-SALE-STATE), a bad amount/source, a future date and an unknown sale", async () => {
    const ctx = await newProject([{ kind: "cash", opening: { openingFils: 0 } }]);
    await withSql(async sql => {
      const saleId = await createSale(sql, ctx, {
        plannedDeliveryOn: "2026-11-30",
        finalPriceFils: 50_000,
        customerName: "سامي",
      });
      const make = (over: Record<string, unknown>) =>
        planSaleDeliveryCost({
          projectId: ctx.projectId,
          createdByAccountId: ctx.owner,
          requestId: `m35-${crypto.randomUUID()}`,
          today: AMMAN_TODAY,
          saleId,
          amountFils: 5_000,
          source: "cash",
          ...over,
        });
      await expect(runPlan(sql, () => make({ amountFils: 0 }))).rejects.toMatchObject({ code: "E-AMOUNT" });
      await expect(runPlan(sql, () => make({ source: "vault" }))).rejects.toMatchObject({ code: "E-AMOUNT" });
      await expect(runPlan(sql, () => make({ effectiveOn: "2026-11-28" }))).rejects.toMatchObject({
        code: "E-FUTURE-DATE",
      });
      await expect(
        runPlan(sql, () =>
          planSaleDeliveryCost({
            projectId: ctx.projectId,
            createdByAccountId: ctx.owner,
            requestId: `m35-${crypto.randomUUID()}`,
            today: AMMAN_TODAY,
            saleId: crypto.randomUUID(),
            amountFils: 5_000,
            source: "cash",
          }),
        ),
      ).rejects.toMatchObject({ code: "E-SALE-STATE" });
      await sql`UPDATE sale SET cancelled_on = ${AMMAN_TODAY} WHERE id = ${saleId}`;
      await expect(runPlan(sql, () => make({}))).rejects.toMatchObject({ code: "E-SALE-STATE" });
    });
  });

  it("replays a retried delivery cost byte-identically", async () => {
    const ctx = await newProject([{ kind: "cash", opening: { openingFils: 0 } }]);
    await withSql(async sql => {
      const saleId = await createSale(sql, ctx, {
        plannedDeliveryOn: "2026-11-30",
        finalPriceFils: 50_000,
        customerName: "سامي",
      });
      const requestId = `m35-retry-${suffix()}`;
      const make = () =>
        planSaleDeliveryCost({
          projectId: ctx.projectId,
          createdByAccountId: ctx.owner,
          requestId,
          today: AMMAN_TODAY,
          saleId,
          amountFils: 5_000,
          source: "cash",
        });
      const first = await runPlan(sql, make);
      const retry = await runPlan(sql, make);
      expect(first.outcome).toBe("applied");
      expect(retry.outcome).toBe("replay");
      expect(await accountTotal(sql, ctx.projectId, "EXP")).toBe(5_000);
    });
  });
});

/* ── 3. The HTTP surface ──────────────────────────────────────────────── */

describe("M3.5 — route POST /api/manage-v2/sale-delivery-cost", () => {
  it("applies end-to-end; §11 rejections map to 400", async () => {
    const sub = `m35-route-${suffix()}`;
    const session = await signInAs(worker, { sub, email: `${sub}@example.com` });
    const setup = await apiPost(worker, session.cookieHeader, "/api/manage-v2/setup", {
      requestId: `route-${suffix()}`,
      projectName: "مشروع التوصيل",
      boxes: [{ kind: "cash", opening: { openingFils: 0 } }],
    });
    expect(setup.status).toBe(200);
    const projectId = ((await setup.json()) as { projectId: string }).projectId;
    const created = await apiPost(worker, session.cookieHeader, "/api/manage-v2/sale-create", {
      requestId: `route-${suffix()}`,
      projectId,
      lines: [{ description: "طلب", unitPriceFils: 40_000 }],
      plannedDeliveryOn: "2026-11-30",
      finalPriceFils: 40_000,
      customerName: "سامي",
    });
    const saleId = ((await created.json()) as { result: { data: { saleId: string } } }).result.data.saleId;

    const applied = await apiPost(worker, session.cookieHeader, "/api/manage-v2/sale-delivery-cost", {
      requestId: `route-${suffix()}`,
      projectId,
      saleId,
      amountFils: 3_000,
      source: "cash",
    });
    expect(applied.status).toBe(200);
    expect((await applied.json()) as { outcome: string; result: { kind: string } }).toMatchObject({
      outcome: "applied",
      result: { kind: "OP-SALE-DELIVERY-COST" },
    });

    const invalid = await apiPost(worker, session.cookieHeader, "/api/manage-v2/sale-delivery-cost", {
      requestId: `route-${suffix()}`,
      projectId,
      saleId,
      amountFils: 0,
      source: "cash",
    });
    expect(invalid.status).toBe(400);
    expect(((await invalid.json()) as { error: { details: { code: string } } }).error.details.code).toBe(
      "E-AMOUNT",
    );
  });
});
