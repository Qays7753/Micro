/**
 * M3.3 acceptance (Manage v2 phase 3 — spec §5 OP-PREPAYMENT, §4 Q4, R-13,
 * R-26, §8/§8.2 figures; tests S1 prepayment slice, T1 prepayment half,
 * T40 prepayment half): any money received on an UNDELIVERED sale is a
 * prepayment — Q4 posts BOX +a / PRE +a; nothing else moves.
 *
 * Tests-first: this file was written before the operation existed and fails
 * with "Cannot find module … operations/prepayment.js".
 *
 * Slices owned later: T1's deliver-at-50 half and T40's E-DATE-ORDER belong
 * to M3.4 (OP-DELIVER); S1's expense/delivery/collect halves to
 * M3.5/M3.4. Here the sale is created through the REAL M3.2 operation.
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

async function newProject(boxes: SetupBoxSlot[] = [{ kind: "cash", opening: { openingFils: 0 } }]) {
  const projectId = crypto.randomUUID();
  const owner = `m33-owner-${suffix()}`;
  await withSql(sql => setupProject(sql, { projectId, owner, today: AMMAN_TODAY, boxes }));
  return { projectId, owner };
}

/** A sale created through the real M3.2 operation. */
async function createSale(
  sql: postgres.Sql,
  ctx: { projectId: string; owner: string },
  input: {
    plannedDeliveryOn: string;
    finalPriceFils?: number;
    customerName?: string;
    registeredOn?: string;
    /** A real product line (منسف: price 25, cost 18) when given. */
    monsafProductId?: string;
  },
): Promise<string> {
  const outcome = await runPlan(sql, () =>
    planSaleCreate({
      projectId: ctx.projectId,
      createdByAccountId: ctx.owner,
      requestId: `m33-${crypto.randomUUID()}`,
      today: AMMAN_TODAY,
      lines: [
        input.monsafProductId === undefined
          ? { description: "طلب", quantityMilli: 1000, unitPriceFils: input.finalPriceFils ?? 10_000 }
          : { productId: input.monsafProductId, quantityMilli: 10_000 },
      ],
      plannedDeliveryOn: input.plannedDeliveryOn,
      ...(input.finalPriceFils === undefined ? {} : { finalPriceFils: input.finalPriceFils }),
      ...(input.customerName === undefined ? {} : { customerName: input.customerName }),
      ...(input.registeredOn === undefined ? {} : { registeredOn: input.registeredOn }),
    }),
  );
  return String((resultOf(outcome, "applied").data as { saleId: string }).saleId);
}

/** A prepayment through the real composition. */
async function prepay(
  sql: postgres.Sql,
  ctx: { projectId: string; owner: string },
  input: { saleId: string; amountFils: number; box?: "cash" | "account"; effectiveOn?: string },
) {
  return runPlan(sql, () =>
    planPrepayment({
      projectId: ctx.projectId,
      createdByAccountId: ctx.owner,
      requestId: `m33-${crypto.randomUUID()}`,
      today: AMMAN_TODAY,
      saleId: input.saleId,
      amountFils: input.amountFils,
      box: input.box ?? "cash",
      ...(input.effectiveOn === undefined ? {} : { effectiveOn: input.effectiveOn }),
    }),
  );
}

/* ── 1. S1's prepayment slice: 50 cash on day 1 ────────────────────────── */

describe("M3.3 S1 (prepayment slice) — prepayment 50 cash on محمد's order", () => {
  it("posts Q4, shows in the payables «منها دفعات مقدمة» and the paid indicator", async () => {
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
      return createSale(sql, ctx, {
        plannedDeliveryOn: "2026-11-30",
        finalPriceFils: 250_000,
        customerName: "محمد",
        registeredOn: "2026-11-24", // day 1
        monsafProductId: monsaf,
      });
    });
    await withSql(sql => prepay(sql, ctx, { saleId, amountFils: 50_000, effectiveOn: "2026-11-24" }));

    // Q4 moved exactly the box and PRE.
    expect(await withSql(sql => boxBalance(sql, ctx.projectId, "cash"))).toBe(250_000);
    expect(await withSql(sql => accountTotal(sql, ctx.projectId, "PRE"))).toBe(50_000);

    const figures = await withSql(sql =>
      computeManageFigures(sql, ctx.projectId, AMMAN_TODAY, "since_start"),
    );
    // Payables = Σ AP + Σ PRE — shown with the prepayments breakdown (§8).
    expect(figures.payables.fils).toBe(50_000);
    expect(figures.payablesPrepayments.fils).toBe(50_000);
    // The paid indicator before delivery: X = PRE, Y = final price (§6).
    expect(figures.salesList.find(s => s.id === saleId)).toMatchObject({
      status: "scheduled",
      prepaymentFils: 50_000,
      finalPriceFils: 250_000,
      fullAmountFils: 200_000,
      paid: { paidFils: 50_000, ofFils: 250_000 },
    });
    // Net worth: Σ BOX − Σ PRE = 350 − 50 = 300 (nothing else moved).
    expect(figures.netWorth.fils).toBe(300_000);
    // Expected profit is untouched by money received (R-15): 250 − 180 = 70.
    expect(figures.salesList.find(s => s.id === saleId)?.expectedProfitFils).toBe(70_000);

    await withSql(async sql => assertLedgerCoreInvariants(await ledgerState(sql, ctx.projectId)));
  });
});

/* ── 2. The §5 contract: state, box and date validations ──────────────── */

describe("M3.3 — OP-PREPAYMENT validations (§5)", () => {
  it("rejects a prepayment on a delivered sale with E-SALE-STATE", async () => {
    const ctx = await newProject();
    await withSql(async sql => {
      const saleId = await createSale(sql, ctx, {
        plannedDeliveryOn: AMMAN_TODAY,
        finalPriceFils: 30_000,
      });
      // Seed an active delivery (M3.4 owns OP-DELIVER): the sale is
      // delivered iff it has a non-reversed Q5 (§3.4).
      const deliverOp = crypto.randomUUID();
      const deliverEntry = crypto.randomUUID();
      await sql`INSERT INTO operation (id, project_id, kind, effective_on, status, sale_id, amount_minor,
                                       payload, created_by_account_id, created_at)
                VALUES (${deliverOp}, ${ctx.projectId}, ${"OP-DELIVER"}, ${AMMAN_TODAY}, ${"active"}, ${saleId},
                        ${30_000}, ${"{}"}, ${"seed"}, now())`;
      await sql`INSERT INTO ledger_entry (id, project_id, operation_id, entry_type, effective_on, created_at)
                VALUES (${deliverEntry}, ${ctx.projectId}, ${deliverOp}, ${"Q5"}, ${AMMAN_TODAY}, now())`;
      await sql`INSERT INTO ledger_posting (id, project_id, entry_id, account, ref_id, rev_kind, delta_minor)
                VALUES (${crypto.randomUUID()}, ${ctx.projectId}, ${deliverEntry}, ${"REV"}, ${saleId}, ${"delivery"}, ${30_000})`;
      await expect(prepay(sql, ctx, { saleId, amountFils: 5_000 })).rejects.toMatchObject({
        code: "E-SALE-STATE",
      });
    });
  });

  it("rejects a prepayment on a cancelled sale with E-SALE-STATE", async () => {
    const ctx = await newProject();
    await withSql(async sql => {
      const saleId = await createSale(sql, ctx, {
        plannedDeliveryOn: "2026-11-30",
        finalPriceFils: 30_000,
        customerName: "سامي",
      });
      // cancelled_on is set by OP-CANCEL-SALE (M3.6) — seeded here.
      await sql`UPDATE sale SET cancelled_on = ${AMMAN_TODAY} WHERE id = ${saleId}`;
      await expect(prepay(sql, ctx, { saleId, amountFils: 5_000 })).rejects.toMatchObject({
        code: "E-SALE-STATE",
      });
    });
  });

  it("rejects an unknown sale, a non-positive amount, a bad box and a future date", async () => {
    const ctx = await newProject();
    await withSql(async sql => {
      const saleId = await createSale(sql, ctx, { plannedDeliveryOn: AMMAN_TODAY, finalPriceFils: 30_000 });
      await expect(
        prepay(sql, ctx, { saleId: crypto.randomUUID(), amountFils: 5_000 }),
      ).rejects.toMatchObject({
        code: "E-SALE-STATE",
      });
      await expect(prepay(sql, ctx, { saleId, amountFils: 0 })).rejects.toMatchObject({ code: "E-AMOUNT" });
      await expect(prepay(sql, ctx, { saleId, amountFils: -5 })).rejects.toMatchObject({ code: "E-AMOUNT" });
      await expect(
        runPlan(sql, () =>
          planPrepayment({
            projectId: ctx.projectId,
            createdByAccountId: ctx.owner,
            requestId: `m33-${crypto.randomUUID()}`,
            today: AMMAN_TODAY,
            saleId,
            amountFils: 5_000,
            box: "vault",
          }),
        ),
      ).rejects.toMatchObject({ code: "E-AMOUNT" });
      // A single-box project: the account box does not exist → E-BOX-STATE.
      await expect(prepay(sql, ctx, { saleId, amountFils: 5_000, box: "account" })).rejects.toMatchObject({
        code: "E-BOX-STATE",
      });
      // R-13: a money operation cannot carry a future effective date.
      await expect(
        prepay(sql, ctx, { saleId, amountFils: 5_000, effectiveOn: "2026-11-28" }),
      ).rejects.toMatchObject({ code: "E-FUTURE-DATE" });
    });
  });

  it("defaults the effective date to today and accepts a past date (T40's start)", async () => {
    const ctx = await newProject([{ kind: "cash", opening: { openingFils: 0 } }]);
    await withSql(async sql => {
      const saleId = await createSale(sql, ctx, {
        plannedDeliveryOn: "2026-11-30",
        finalPriceFils: 30_000,
        customerName: "سامي",
      });
      // T40's prepayment half: dated 5/11 — accepted, dated as given.
      const dated = await prepay(sql, ctx, { saleId, amountFils: 10_000, effectiveOn: "2026-11-05" });
      expect(resultOf(dated, "applied").effectiveOn).toBe("2026-11-05");
      const entryRow = await withSql(
        innerSql => innerSql`SELECT effective_on::text AS effective_on FROM ledger_entry
                             WHERE project_id = ${ctx.projectId} AND entry_type = 'Q4'`,
      );
      expect(entryRow[0]!.effective_on).toBe("2026-11-05");
      // Default: today.
      const defaulted = await prepay(sql, ctx, { saleId, amountFils: 5_000 });
      expect(resultOf(defaulted, "applied").effectiveOn).toBe(AMMAN_TODAY);

      assertLedgerCoreInvariants(await ledgerState(sql, ctx.projectId));
    });
  });
});

/* ── 3. T1's prepayment half: 60 on a sale priced 50 ───────────────────── */

describe("M3.3 T1 (prepayment half) — 60 received on the future sale", () => {
  it("PRE reaches 60 while the sale stays scheduled (the refund comes at delivery, M3.4)", async () => {
    const ctx = await newProject();
    await withSql(async sql => {
      const saleId = await createSale(sql, ctx, {
        plannedDeliveryOn: "2026-11-30",
        finalPriceFils: 50_000,
        customerName: "سامي",
      });
      await prepay(sql, ctx, { saleId, amountFils: 60_000 });
      expect(await accountTotal(sql, ctx.projectId, "PRE")).toBe(60_000);
      const figures = await computeManageFigures(sql, ctx.projectId, AMMAN_TODAY, "since_start");
      expect(figures.salesList.find(s => s.id === saleId)).toMatchObject({
        status: "scheduled",
        prepaymentFils: 60_000,
        paid: { paidFils: 60_000, ofFils: 50_000 },
      });
      assertLedgerCoreInvariants(await ledgerState(sql, ctx.projectId));
    });
  });
});

/* ── 4. Idempotency and the HTTP surface ──────────────────────────────── */

describe("M3.3 — idempotency and route", () => {
  it("replays a retried prepayment byte-identically (one operation, one entry)", async () => {
    const ctx = await newProject();
    await withSql(async sql => {
      const saleId = await createSale(sql, ctx, { plannedDeliveryOn: AMMAN_TODAY, finalPriceFils: 30_000 });
      const requestId = `m33-retry-${suffix()}`;
      const make = () =>
        planPrepayment({
          projectId: ctx.projectId,
          createdByAccountId: ctx.owner,
          requestId,
          today: AMMAN_TODAY,
          saleId,
          amountFils: 20_000,
          box: "cash",
        });
      const first = await runPlan(sql, make);
      const retry = await runPlan(sql, make);
      expect(first.outcome).toBe("applied");
      expect(retry.outcome).toBe("replay");
      expect((retry as { result: unknown }).result).toEqual((first as { result: unknown }).result);
      expect(await accountTotal(sql, ctx.projectId, "PRE")).toBe(20_000);
      const ops = await withSql(
        innerSql =>
          innerSql`SELECT id FROM operation WHERE project_id = ${ctx.projectId} AND kind = 'OP-PREPAYMENT'`,
      );
      expect(ops).toHaveLength(1);
    });
  });

  it("applies end-to-end through the route with the §11 mapping", async () => {
    const sub = `m33-route-${suffix()}`;
    const session = await signInAs(worker, { sub, email: `${sub}@example.com` });
    const setup = await apiPost(worker, session.cookieHeader, "/api/manage-v2/setup", {
      requestId: `route-${suffix()}`,
      projectName: "مشروع العرابين",
      boxes: [{ kind: "cash", opening: { openingFils: 0 } }],
    });
    expect(setup.status).toBe(200);
    const projectId = ((await setup.json()) as { projectId: string }).projectId;
    const created = await apiPost(worker, session.cookieHeader, "/api/manage-v2/sale-create", {
      requestId: `route-${suffix()}`,
      projectId,
      lines: [{ description: "طلب", unitPriceFils: 30_000 }],
      plannedDeliveryOn: "2026-11-30",
      finalPriceFils: 30_000,
      customerName: "سامي",
    });
    const saleId = ((await created.json()) as { result: { data: { saleId: string } } }).result.data.saleId;

    const prepay = await apiPost(worker, session.cookieHeader, "/api/manage-v2/prepayment", {
      requestId: `route-${suffix()}`,
      projectId,
      saleId,
      amountFils: 10_000,
      box: "cash",
    });
    expect(prepay.status).toBe(200);
    expect((await prepay.json()) as { outcome: string; result: { kind: string } }).toMatchObject({
      outcome: "applied",
      result: { kind: "OP-PREPAYMENT" },
    });

    const invalid = await apiPost(worker, session.cookieHeader, "/api/manage-v2/prepayment", {
      requestId: `route-${suffix()}`,
      projectId,
      saleId,
      amountFils: 0,
      box: "cash",
    });
    expect(invalid.status).toBe(400);
    expect(((await invalid.json()) as { error: { details: { code: string } } }).error.details.code).toBe(
      "E-AMOUNT",
    );
  });
});
