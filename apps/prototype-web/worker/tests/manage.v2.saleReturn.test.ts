/**
 * M3.7 acceptance (Manage v2 phase 3 — spec §5 OP-RETURN, §4 Q16, §8
 * net_sale_revenue; tests S4, T2, T3): a return on a DELIVERED sale — Q16
 * posts REV −r (rev_kind return) on the return date, deducts
 * x = min(r, remainder outstanding) from the sale's remainder line, and
 * refunds y = r − x now (box) or later (a customer_refund line).
 *
 * Tests-first: this file was written before the operation existed and fails
 * with "Cannot find module … operations/saleReturn.js".
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
  const owner = `m37-owner-${suffix()}`;
  await withSql(sql => setupProject(sql, { projectId, owner, today: AMMAN_TODAY, boxes }));
  return { projectId, owner };
}

/** A delivered sale (+ optional immediate collection), through the real
 * operations — returns the sale id. */
async function deliveredSale(
  sql: postgres.Sql,
  ctx: { projectId: string; owner: string },
  input: { priceFils: number; collectFils?: number; customerName?: string },
): Promise<string> {
  const outcome = await runPlan(sql, () =>
    planSaleCreate({
      projectId: ctx.projectId,
      createdByAccountId: ctx.owner,
      requestId: `m37-${crypto.randomUUID()}`,
      today: AMMAN_TODAY,
      lines: [{ description: "طلب", quantityMilli: 1000, unitPriceFils: input.priceFils }],
      plannedDeliveryOn: AMMAN_TODAY,
      finalPriceFils: input.priceFils,
      ...(input.customerName === undefined ? {} : { customerName: input.customerName }),
    }),
  );
  const saleId = String((resultOf(outcome, "applied").data as { saleId: string }).saleId);
  await runPlan(sql, () =>
    planDeliver({
      projectId: ctx.projectId,
      createdByAccountId: ctx.owner,
      requestId: `m37-${crypto.randomUUID()}`,
      today: AMMAN_TODAY,
      saleId,
      ...(input.collectFils === undefined
        ? {}
        : { collection: { amountFils: input.collectFils, box: "cash" } }),
    }),
  );
  return saleId;
}

/** A return through the real composition. */
async function returnGoods(
  sql: postgres.Sql,
  ctx: { projectId: string; owner: string },
  input: { saleId: string; amountFils: number; refund: "now" | "later"; effectiveOn?: string },
) {
  return runPlan(sql, () =>
    planReturn({
      projectId: ctx.projectId,
      createdByAccountId: ctx.owner,
      requestId: `m37-${crypto.randomUUID()}`,
      today: AMMAN_TODAY,
      saleId: input.saleId,
      amountFils: input.amountFils,
      refund: input.refund === "now" ? { mode: "now", box: "cash" } : { mode: "later" },
      ...(input.effectiveOn === undefined ? {} : { effectiveOn: input.effectiveOn }),
    }),
  );
}

/* ── 1. S4: the full return ───────────────────────────────────────────── */

describe("M3.7 S4 — direct sale 80 collected, return 80 refund now", () => {
  it("nets the revenue and the cash to zero", async () => {
    const ctx = await newProject();
    await withSql(async sql => {
      const saleId = await deliveredSale(sql, ctx, { priceFils: 80_000, collectFils: 80_000 });
      await returnGoods(sql, ctx, { saleId, amountFils: 80_000, refund: "now" });
      // Net revenue 0, net cash 0.
      expect(await accountTotal(sql, ctx.projectId, "REV")).toBe(0);
      expect(await boxBalance(sql, ctx.projectId, "cash")).toBe(0);
      const figures = await computeManageFigures(sql, ctx.projectId, AMMAN_TODAY, "since_start");
      expect(figures.netSales.fils).toBe(0);
      expect(figures.salesList.find(s => s.id === saleId)?.netSaleRevenueFils).toBe(0);
      await assertLedgerCoreInvariants(await ledgerState(sql, ctx.projectId));
    });
  });
});

/* ── 2. T2: the return against the remainder, refund later ────────────── */

describe("M3.7 T2 — deliver 100, collect 30, return 50 refund later", () => {
  it("leaves remainder 20, net revenue 50, and the box unchanged by the return", async () => {
    const ctx = await newProject();
    await withSql(async sql => {
      const saleId = await deliveredSale(sql, ctx, {
        priceFils: 100_000,
        collectFils: 30_000,
        customerName: "سامي",
      });
      await returnGoods(sql, ctx, { saleId, amountFils: 50_000, refund: "later" });
      // x = 50 off the remainder: 70 − 50 = 20; y = 0 → nothing refunded.
      expect(await accountTotal(sql, ctx.projectId, "AR")).toBe(20_000);
      expect(await accountTotal(sql, ctx.projectId, "AP")).toBe(0);
      // Box unchanged BY THE RETURN (the 30 collected stays).
      expect(await boxBalance(sql, ctx.projectId, "cash")).toBe(30_000);
      // Net revenue 50 = 100 − 50.
      expect(await accountTotal(sql, ctx.projectId, "REV")).toBe(50_000);
      const figures = await computeManageFigures(sql, ctx.projectId, AMMAN_TODAY, "since_start");
      expect(figures.salesList.find(s => s.id === saleId)?.netSaleRevenueFils).toBe(50_000);
      // The sale with an active return is excluded from top sellers (§8).
      expect(figures.topSellers).toEqual([]);
      await assertLedgerCoreInvariants(await ledgerState(sql, ctx.projectId));
    });
  });
});

/* ── 3. T3: the return exceeding the remainder ────────────────────────── */

describe("M3.7 T3 — deliver 100, collect 30 cash, return 80 refund now cash", () => {
  it("leaves remainder 0, refunds 10 now, net cash from the sale 20, net revenue 20", async () => {
    const ctx = await newProject();
    await withSql(async sql => {
      const saleId = await deliveredSale(sql, ctx, {
        priceFils: 100_000,
        collectFils: 30_000,
        customerName: "سامي",
      });
      await returnGoods(sql, ctx, { saleId, amountFils: 80_000, refund: "now" });
      // x = 70 (the whole remainder) → 0; y = 10 refunded now.
      expect(await accountTotal(sql, ctx.projectId, "AR")).toBe(0);
      // Net cash from the sale: 30 collected − 10 refunded = 20.
      expect(await boxBalance(sql, ctx.projectId, "cash")).toBe(20_000);
      // Net revenue 20 = 100 − 80.
      expect(await accountTotal(sql, ctx.projectId, "REV")).toBe(20_000);
      const figures = await computeManageFigures(sql, ctx.projectId, AMMAN_TODAY, "since_start");
      expect(figures.salesList.find(s => s.id === saleId)).toMatchObject({
        netSaleRevenueFils: 20_000,
        status: "completed", // remainder 0 (§6)
      });
      await assertLedgerCoreInvariants(await ledgerState(sql, ctx.projectId));
    });
  });
});

/* ── 4. The §5 validations and idempotency ────────────────────────────── */

describe("M3.7 — OP-RETURN validations (§5)", () => {
  it("rejects an undelivered sale (E-SALE-STATE) and r above the net revenue (E-RETURN-AMOUNT)", async () => {
    const ctx = await newProject();
    await withSql(async sql => {
      const undelivered = await runPlan(sql, () =>
        planSaleCreate({
          projectId: ctx.projectId,
          createdByAccountId: ctx.owner,
          requestId: `m37-${crypto.randomUUID()}`,
          today: AMMAN_TODAY,
          lines: [{ description: "طلب", unitPriceFils: 50_000 }],
          plannedDeliveryOn: "2026-11-30",
          finalPriceFils: 50_000,
          customerName: "سامي",
        }),
      );
      const undeliveredId = String((resultOf(undelivered, "applied").data as { saleId: string }).saleId);
      await expect(
        returnGoods(sql, ctx, { saleId: undeliveredId, amountFils: 10_000, refund: "now" }),
      ).rejects.toMatchObject({ code: "E-SALE-STATE" });

      const saleId = await deliveredSale(sql, ctx, { priceFils: 50_000, customerName: "سامي" });
      await expect(
        returnGoods(sql, ctx, { saleId, amountFils: 60_000, refund: "now" }),
      ).rejects.toMatchObject({ code: "E-RETURN-AMOUNT" });
      // A cancelled sale is not returnable either (§6: delivered_* only).
      await sql`UPDATE sale SET cancelled_on = ${AMMAN_TODAY} WHERE id = ${saleId}`;
      await expect(
        returnGoods(sql, ctx, { saleId, amountFils: 10_000, refund: "now" }),
      ).rejects.toMatchObject({ code: "E-SALE-STATE" });
    });
  });

  it("rejects a non-positive amount and a future date; the return date is honored", async () => {
    const ctx = await newProject();
    await withSql(async sql => {
      const saleId = await deliveredSale(sql, ctx, { priceFils: 50_000, customerName: "سامي" });
      await expect(
        runPlan(sql, () =>
          planReturn({
            projectId: ctx.projectId,
            createdByAccountId: ctx.owner,
            requestId: `m37-${crypto.randomUUID()}`,
            today: AMMAN_TODAY,
            saleId,
            amountFils: 0,
            refund: { mode: "now", box: "cash" },
          }),
        ),
      ).rejects.toMatchObject({ code: "E-AMOUNT" });
      await expect(
        returnGoods(sql, ctx, { saleId, amountFils: 5_000, refund: "now", effectiveOn: "2026-11-28" }),
      ).rejects.toMatchObject({ code: "E-FUTURE-DATE" });
      // A past return date is honored on the REV posting.
      await returnGoods(sql, ctx, { saleId, amountFils: 5_000, refund: "now", effectiveOn: "2026-11-20" });
      const entry = await sql`SELECT effective_on::text AS effective_on FROM ledger_entry
                              WHERE project_id = ${ctx.projectId} AND entry_type = 'Q16'`;
      expect(entry[0]!.effective_on).toBe("2026-11-20");
    });
  });

  it("replays a retried return byte-identically (one operation, one entry)", async () => {
    const ctx = await newProject();
    await withSql(async sql => {
      const saleId = await deliveredSale(sql, ctx, { priceFils: 50_000, customerName: "سامي" });
      const requestId = `m37-retry-${suffix()}`;
      const make = () =>
        planReturn({
          projectId: ctx.projectId,
          createdByAccountId: ctx.owner,
          requestId,
          today: AMMAN_TODAY,
          saleId,
          amountFils: 20_000,
          refund: { mode: "now", box: "cash" },
        });
      const first = await runPlan(sql, make);
      const retry = await runPlan(sql, make);
      expect(first.outcome).toBe("applied");
      expect(retry.outcome).toBe("replay");
      expect((retry as { result: unknown }).result).toEqual((first as { result: unknown }).result);
      expect(await accountTotal(sql, ctx.projectId, "REV")).toBe(30_000);
    });
  });
});

/* ── 5. The HTTP surface ──────────────────────────────────────────────── */

describe("M3.7 — route POST /api/manage-v2/return", () => {
  it("applies end-to-end; §11 rejections map to 400", async () => {
    const sub = `m37-route-${suffix()}`;
    const session = await signInAs(worker, { sub, email: `${sub}@example.com` });
    const setup = await apiPost(worker, session.cookieHeader, "/api/manage-v2/setup", {
      requestId: `route-${suffix()}`,
      projectName: "مشروع المرتجع",
      boxes: [{ kind: "cash", opening: { openingFils: 0 } }],
    });
    expect(setup.status).toBe(200);
    const projectId = ((await setup.json()) as { projectId: string }).projectId;
    const created = await apiPost(worker, session.cookieHeader, "/api/manage-v2/sale-create", {
      requestId: `route-${suffix()}`,
      projectId,
      lines: [{ description: "طلب", unitPriceFils: 60_000 }],
      plannedDeliveryOn: AMMAN_TODAY,
      finalPriceFils: 60_000,
      customerName: "سامي",
    });
    const saleId = ((await created.json()) as { result: { data: { saleId: string } } }).result.data.saleId;
    await apiPost(worker, session.cookieHeader, "/api/manage-v2/deliver", {
      requestId: `route-${suffix()}`,
      projectId,
      saleId,
      collection: { amountFils: 60_000, box: "cash" },
    });

    const returned = await apiPost(worker, session.cookieHeader, "/api/manage-v2/return", {
      requestId: `route-${suffix()}`,
      projectId,
      saleId,
      amountFils: 20_000,
      refund: { mode: "now", box: "cash" },
    });
    expect(returned.status).toBe(200);
    expect((await returned.json()) as { outcome: string; result: { kind: string } }).toMatchObject({
      outcome: "applied",
      result: { kind: "OP-RETURN" },
    });

    const invalid = await apiPost(worker, session.cookieHeader, "/api/manage-v2/return", {
      requestId: `route-${suffix()}`,
      projectId,
      saleId,
      amountFils: 100_000,
      refund: { mode: "now", box: "cash" },
    });
    expect(invalid.status).toBe(400);
    expect(((await invalid.json()) as { error: { details: { code: string } } }).error.details.code).toBe(
      "E-RETURN-AMOUNT",
    );
  });
});
