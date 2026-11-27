/**
 * M3.8 acceptance (Manage v2 phase 3 — spec §5 OP-PRICE-CORRECTION, §4
 * Q20+Q5, §3.8 balance; test T18): correct the final price AFTER delivery —
 * a recording mistake fix, atomic: Q20 of the active Q5, then a new Q5 at
 * the new price with the SAME effective date as the original delivery; when
 * the remainder line's outstanding would go negative (−x), the entry adds
 * AR[L_rem] +x and opens a customer_refund line with AP +x (same entry,
 * balanced). Discounts after delivery are NOT price corrections (§5).
 *
 * Tests-first: this file was written before the operation existed and fails
 * with "Cannot find module … operations/priceCorrection.js".
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
import { planPriceCorrection } from "../../../../src/domain/manage/operations/priceCorrection.js";
import { planPrepayment } from "../../../../src/domain/manage/operations/prepayment.js";
import { planReturn } from "../../../../src/domain/manage/operations/saleReturn.js";
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
  const owner = `m38-owner-${suffix()}`;
  await withSql(sql => setupProject(sql, { projectId, owner, today: AMMAN_TODAY, boxes }));
  return { projectId, owner };
}

/** A delivered sale (+ optional immediate collection) through the real
 * operations; returns the sale id. */
async function deliveredSale(
  sql: postgres.Sql,
  ctx: { projectId: string; owner: string },
  input: { priceFils: number; collectFils?: number; customerName?: string; deliverOn?: string },
): Promise<string> {
  const outcome = await runPlan(sql, () =>
    planSaleCreate({
      projectId: ctx.projectId,
      createdByAccountId: ctx.owner,
      requestId: `m38-${crypto.randomUUID()}`,
      today: AMMAN_TODAY,
      lines: [{ description: "طلب", quantityMilli: 1000, unitPriceFils: input.priceFils }],
      plannedDeliveryOn: "2026-11-25",
      finalPriceFils: input.priceFils,
      ...(input.customerName === undefined ? {} : { customerName: input.customerName }),
    }),
  );
  const saleId = String((resultOf(outcome, "applied").data as { saleId: string }).saleId);
  await runPlan(sql, () =>
    planDeliver({
      projectId: ctx.projectId,
      createdByAccountId: ctx.owner,
      requestId: `m38-${crypto.randomUUID()}`,
      today: AMMAN_TODAY,
      saleId,
      actualDeliveryOn: input.deliverOn ?? "2026-11-25",
      ...(input.collectFils === undefined
        ? {}
        : { collection: { amountFils: input.collectFils, box: "cash" } }),
    }),
  );
  return saleId;
}

/* ── 1. T18: the correction down with a fully collected sale ──────────── */

describe("M3.8 T18 — deliver 100, collect 100, price correction to 90", () => {
  it("posts REV 90 on the delivery date and opens a customer_refund of 10", async () => {
    const ctx = await newProject();
    await withSql(async sql => {
      const saleId = await deliveredSale(sql, ctx, {
        priceFils: 100_000,
        collectFils: 100_000,
        customerName: "سامي",
        deliverOn: "2026-11-20",
      });
      await runPlan(sql, () =>
        planPriceCorrection({
          projectId: ctx.projectId,
          createdByAccountId: ctx.owner,
          requestId: `m38-${crypto.randomUUID()}`,
          today: AMMAN_TODAY,
          saleId,
          newPriceFils: 90_000,
        }),
      );

      // REV 90 on the DELIVERY date (the new Q5 keeps 20/11).
      expect(await accountTotal(sql, ctx.projectId, "REV")).toBe(90_000);
      const q5dates = await sql`SELECT e.effective_on::text AS effective_on FROM ledger_entry e
                                WHERE project_id = ${ctx.projectId} AND e.entry_type = 'Q5'`;
      expect(q5dates.map(r => r.effective_on).sort()).toEqual(["2026-11-20", "2026-11-20"]);
      // The customer_refund line carries 10; the remainder line nets to 0.
      expect(await accountTotal(sql, ctx.projectId, "AP")).toBe(10_000);
      expect(await accountTotal(sql, ctx.projectId, "AR")).toBe(0);
      const refund = await sql`SELECT kind, counterparty_name FROM balance_line
                               WHERE project_id = ${ctx.projectId} AND kind = 'customer_refund'`;
      expect(refund[0]).toMatchObject({ kind: "customer_refund", counterparty_name: null });
      // The sale's final price is the corrected one (§3.4).
      const sale = await sql`SELECT final_price_minor FROM sale WHERE id = ${saleId}`;
      expect(sale[0]!.final_price_minor).toBe("90000");
      // The figures agree: net revenue 90, refund due shown.
      const figures = await computeManageFigures(sql, ctx.projectId, AMMAN_TODAY, "since_start");
      expect(figures.salesList.find(s => s.id === saleId)).toMatchObject({
        netSaleRevenueFils: 90_000,
        status: "completed", // §6: remainder outstanding 0 (the refund line is a separate display)
        paid: { paidFils: 90_000, ofFils: 90_000 },
      });
      expect(figures.payables.fils).toBe(10_000);

      await assertLedgerCoreInvariants(await ledgerState(sql, ctx.projectId));
    });
  });
});

/* ── 2. The correction mechanics ──────────────────────────────────────── */

describe("M3.8 — the correction mechanics (§5)", () => {
  it("corrects UP: the remainder reopens at the difference, still on the delivery date", async () => {
    const ctx = await newProject();
    await withSql(async sql => {
      const saleId = await deliveredSale(sql, ctx, {
        priceFils: 90_000,
        collectFils: 90_000,
        customerName: "سامي",
        deliverOn: "2026-11-20",
      });
      await runPlan(sql, () =>
        planPriceCorrection({
          projectId: ctx.projectId,
          createdByAccountId: ctx.owner,
          requestId: `m38-${crypto.randomUUID()}`,
          today: AMMAN_TODAY,
          saleId,
          newPriceFils: 110_000,
        }),
      );
      // REV 110; the remainder reopens at 20 (nothing negative).
      expect(await accountTotal(sql, ctx.projectId, "REV")).toBe(110_000);
      expect(await accountTotal(sql, ctx.projectId, "AR")).toBe(20_000);
      expect(await accountTotal(sql, ctx.projectId, "AP")).toBe(0);
      expect(await boxBalance(sql, ctx.projectId, "cash")).toBe(90_000); // nothing moved
      const figures = await computeManageFigures(sql, ctx.projectId, AMMAN_TODAY, "since_start");
      expect(figures.salesList.find(s => s.id === saleId)).toMatchObject({
        status: "delivered_unpaid",
        paid: { paidFils: 90_000, ofFils: 110_000 },
      });
      await assertLedgerCoreInvariants(await ledgerState(sql, ctx.projectId));
    });
  });

  it("keeps the prepayment consumed: correction with p = 20 on a delivered sale", async () => {
    const ctx = await newProject();
    await withSql(async sql => {
      // Sale 100 with prepayment 20, delivered (remainder 80), nothing collected.
      const outcome = await runPlan(sql, () =>
        planSaleCreate({
          projectId: ctx.projectId,
          createdByAccountId: ctx.owner,
          requestId: `m38-${crypto.randomUUID()}`,
          today: AMMAN_TODAY,
          lines: [{ description: "طلب", unitPriceFils: 100_000 }],
          plannedDeliveryOn: "2026-11-25",
          finalPriceFils: 100_000,
          customerName: "سامي",
        }),
      );
      const saleId = String((resultOf(outcome, "applied").data as { saleId: string }).saleId);
      await runPlan(sql, () =>
        planPrepayment({
          projectId: ctx.projectId,
          createdByAccountId: ctx.owner,
          requestId: `m38-${crypto.randomUUID()}`,
          today: AMMAN_TODAY,
          saleId,
          amountFils: 20_000,
          box: "cash",
          effectiveOn: "2026-11-24",
        }),
      );
      await runPlan(sql, () =>
        planDeliver({
          projectId: ctx.projectId,
          createdByAccountId: ctx.owner,
          requestId: `m38-${crypto.randomUUID()}`,
          today: AMMAN_TODAY,
          saleId,
          actualDeliveryOn: "2026-11-25",
        }),
      );
      // Correct to 50 (< prepayment 20? no: 50 > 20): REV 50, PRE 0, remainder 30.
      await runPlan(sql, () =>
        planPriceCorrection({
          projectId: ctx.projectId,
          createdByAccountId: ctx.owner,
          requestId: `m38-${crypto.randomUUID()}`,
          today: AMMAN_TODAY,
          saleId,
          newPriceFils: 50_000,
        }),
      );
      expect(await accountTotal(sql, ctx.projectId, "REV")).toBe(50_000);
      expect(await accountTotal(sql, ctx.projectId, "PRE")).toBe(0);
      expect(await accountTotal(sql, ctx.projectId, "AR")).toBe(30_000);
      await assertLedgerCoreInvariants(await ledgerState(sql, ctx.projectId));
    });
  });

  it("marks the corrected delivery reversed and carries corrects_operation_id (§5 OP-CORRECT shape)", async () => {
    const ctx = await newProject();
    await withSql(async sql => {
      const saleId = await deliveredSale(sql, ctx, { priceFils: 100_000, customerName: "سامي" });
      const deliverRow = await sql`SELECT id FROM operation
                                   WHERE project_id = ${ctx.projectId} AND kind = 'OP-DELIVER' AND sale_id = ${saleId}`;
      const deliverId = String(deliverRow[0]!.id);
      await runPlan(sql, () =>
        planPriceCorrection({
          projectId: ctx.projectId,
          createdByAccountId: ctx.owner,
          requestId: `m38-${crypto.randomUUID()}`,
          today: AMMAN_TODAY,
          saleId,
          newPriceFils: 90_000,
        }),
      );
      const corrected =
        await sql`SELECT status, reversed_by_operation_id FROM operation WHERE id = ${deliverId}`;
      expect(corrected[0]!.status).toBe("reversed");
      expect(corrected[0]!.reversed_by_operation_id).not.toBeNull();
      const correction = await sql`SELECT corrects_operation_id FROM operation
                                   WHERE project_id = ${ctx.projectId} AND kind = 'OP-PRICE-CORRECTION'`;
      expect(String(correction[0]!.corrects_operation_id)).toBe(deliverId);
      // A second correction corrects the CURRENT version (the first correction).
      await runPlan(sql, () =>
        planPriceCorrection({
          projectId: ctx.projectId,
          createdByAccountId: ctx.owner,
          requestId: `m38-${crypto.randomUUID()}`,
          today: AMMAN_TODAY,
          saleId,
          newPriceFils: 95_000,
        }),
      );
      expect(await accountTotal(sql, ctx.projectId, "REV")).toBe(95_000);
      const corrections = await sql`SELECT id, status, corrects_operation_id FROM operation
                                    WHERE project_id = ${ctx.projectId} AND kind = 'OP-PRICE-CORRECTION'
                                    ORDER BY created_at`;
      expect(corrections[0]!.status).toBe("reversed");
      expect(String(corrections[1]!.corrects_operation_id)).toBe(String(corrections[0]!.id));
      await assertLedgerCoreInvariants(await ledgerState(sql, ctx.projectId));
    });
  });
});

/* ── 3. Validations and idempotency ──────────────────────────────────── */

describe("M3.8 — validations (§5)", () => {
  it("rejects an undelivered sale (E-SALE-STATE) and a price below the total returns (E-RETURN-AMOUNT)", async () => {
    const ctx = await newProject();
    await withSql(async sql => {
      const undelivered = await runPlan(sql, () =>
        planSaleCreate({
          projectId: ctx.projectId,
          createdByAccountId: ctx.owner,
          requestId: `m38-${crypto.randomUUID()}`,
          today: AMMAN_TODAY,
          lines: [{ description: "طلب", unitPriceFils: 100_000 }],
          plannedDeliveryOn: "2026-11-30",
          finalPriceFils: 100_000,
          customerName: "سامي",
        }),
      );
      const undeliveredId = String((resultOf(undelivered, "applied").data as { saleId: string }).saleId);
      const correct = (saleId: string, newPriceFils: number) =>
        planPriceCorrection({
          projectId: ctx.projectId,
          createdByAccountId: ctx.owner,
          requestId: `m38-${crypto.randomUUID()}`,
          today: AMMAN_TODAY,
          saleId,
          newPriceFils,
        });
      await expect(runPlan(sql, () => correct(undeliveredId, 90_000))).rejects.toMatchObject({
        code: "E-SALE-STATE",
      });
      // Delivered with a return of 30: correcting below 30 is rejected.
      const saleId = await deliveredSale(sql, ctx, {
        priceFils: 100_000,
        collectFils: 100_000,
        customerName: "سامي",
      });
      await runPlan(sql, () =>
        planReturn({
          projectId: ctx.projectId,
          createdByAccountId: ctx.owner,
          requestId: `m38-${crypto.randomUUID()}`,
          today: AMMAN_TODAY,
          saleId,
          amountFils: 30_000,
          refund: { mode: "now", box: "cash" },
        }),
      );
      await expect(runPlan(sql, () => correct(saleId, 25_000))).rejects.toMatchObject({
        code: "E-RETURN-AMOUNT",
      });
      await expect(runPlan(sql, () => correct(saleId, 0))).rejects.toMatchObject({ code: "E-AMOUNT" });
      // 30 exactly is allowed (≥).
      const ok = await runPlan(sql, () => correct(saleId, 30_000));
      expect(resultOf(ok, "applied").kind).toBe("OP-PRICE-CORRECTION");
    });
  });

  it("replays a retried correction byte-identically", async () => {
    const ctx = await newProject();
    await withSql(async sql => {
      const saleId = await deliveredSale(sql, ctx, { priceFils: 100_000, customerName: "سامي" });
      const requestId = `m38-retry-${suffix()}`;
      const make = () =>
        planPriceCorrection({
          projectId: ctx.projectId,
          createdByAccountId: ctx.owner,
          requestId,
          today: AMMAN_TODAY,
          saleId,
          newPriceFils: 90_000,
        });
      const first = await runPlan(sql, make);
      const retry = await runPlan(sql, make);
      expect(first.outcome).toBe("applied");
      expect(retry.outcome).toBe("replay");
      expect((retry as { result: unknown }).result).toEqual((first as { result: unknown }).result);
      expect(await accountTotal(sql, ctx.projectId, "REV")).toBe(90_000);
    });
  });
});

/* ── 4. The HTTP surface ──────────────────────────────────────────────── */

describe("M3.8 — route POST /api/manage-v2/price-correction", () => {
  it("applies end-to-end; §11 rejections map to 400", async () => {
    const sub = `m38-route-${suffix()}`;
    const session = await signInAs(worker, { sub, email: `${sub}@example.com` });
    const setup = await apiPost(worker, session.cookieHeader, "/api/manage-v2/setup", {
      requestId: `route-${suffix()}`,
      projectName: "مشروع تصحيح السعر",
      boxes: [{ kind: "cash", opening: { openingFils: 0 } }],
    });
    expect(setup.status).toBe(200);
    const projectId = ((await setup.json()) as { projectId: string }).projectId;
    const created = await apiPost(worker, session.cookieHeader, "/api/manage-v2/sale-create", {
      requestId: `route-${suffix()}`,
      projectId,
      lines: [{ description: "طلب", unitPriceFils: 70_000 }],
      plannedDeliveryOn: AMMAN_TODAY,
      finalPriceFils: 70_000,
      customerName: "سامي",
    });
    const saleId = ((await created.json()) as { result: { data: { saleId: string } } }).result.data.saleId;
    await apiPost(worker, session.cookieHeader, "/api/manage-v2/deliver", {
      requestId: `route-${suffix()}`,
      projectId,
      saleId,
      collection: { amountFils: 70_000, box: "cash" },
    });

    const corrected = await apiPost(worker, session.cookieHeader, "/api/manage-v2/price-correction", {
      requestId: `route-${suffix()}`,
      projectId,
      saleId,
      newPriceFils: 60_000,
    });
    expect(corrected.status).toBe(200);
    expect((await corrected.json()) as { outcome: string; result: { kind: string } }).toMatchObject({
      outcome: "applied",
      result: { kind: "OP-PRICE-CORRECTION" },
    });

    const invalid = await apiPost(worker, session.cookieHeader, "/api/manage-v2/price-correction", {
      requestId: `route-${suffix()}`,
      projectId,
      saleId,
      newPriceFils: 0,
    });
    expect(invalid.status).toBe(400);
    expect(((await invalid.json()) as { error: { details: { code: string } } }).error.details.code).toBe(
      "E-AMOUNT",
    );
  });
});
