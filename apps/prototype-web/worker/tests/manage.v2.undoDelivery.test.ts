/**
 * M3.9 acceptance (Manage v2 phase 3 — spec §5 OP-UNDO-DELIVERY, §4 Q20/Q4,
 * §6 transitions; tests T17, T37): undo the delivery — atomically reverse
 * the sale's active Q5 and every active Q6/Q17/Q18 tied to it, and for each
 * reversed Q6 AND Q18 post a Q4 with the same box, amount and effective
 * date (the money stays in the box as a prepayment). The sale returns to
 * scheduled/overdue; box balances are unchanged.
 *
 * Tests-first: this file was written before the operation existed and fails
 * with "Cannot find module … operations/undoDelivery.js".
 *
 * Posture: Miniflare over the per-file isolated PostgreSQL. Money is
 * integer fils. Every acceptance path ends with assertLedgerCoreInvariants
 * (INV-1 + INV-2).
 */
import type postgres from "postgres";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { startWorker, type WorkerInstance } from "./harness.ts";
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
import { planCollect } from "../../../../src/domain/manage/operations/collect.js";
import { planReturn } from "../../../../src/domain/manage/operations/saleReturn.js";
import { planPay } from "../../../../src/domain/manage/operations/pay.js";
import { planUndoDelivery } from "../../../../src/domain/manage/operations/undoDelivery.js";
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
  const owner = `m39-owner-${suffix()}`;
  await withSql(sql => setupProject(sql, { projectId, owner, today: AMMAN_TODAY, boxes }));
  return { projectId, owner };
}

interface Seed {
  priceFils: number;
  prepayFils?: number;
  collectFils?: number;
  customerName?: string;
}

/** A delivered sale with an optional prepayment and immediate collection. */
async function deliveredSale(
  sql: postgres.Sql,
  ctx: { projectId: string; owner: string },
  seed: Seed,
): Promise<string> {
  const outcome = await runPlan(sql, () =>
    planSaleCreate({
      projectId: ctx.projectId,
      createdByAccountId: ctx.owner,
      requestId: `m39-${crypto.randomUUID()}`,
      today: AMMAN_TODAY,
      lines: [{ description: "طلب", quantityMilli: 1000, unitPriceFils: seed.priceFils }],
      plannedDeliveryOn: "2026-12-01",
      finalPriceFils: seed.priceFils,
      ...(seed.customerName === undefined ? {} : { customerName: seed.customerName }),
    }),
  );
  const saleId = String((resultOf(outcome, "applied").data as { saleId: string }).saleId);
  if ((seed.prepayFils ?? 0) > 0) {
    await runPlan(sql, () =>
      planPrepayment({
        projectId: ctx.projectId,
        createdByAccountId: ctx.owner,
        requestId: `m39-${crypto.randomUUID()}`,
        today: AMMAN_TODAY,
        saleId,
        amountFils: seed.prepayFils!,
        box: "cash",
      }),
    );
  }
  await runPlan(sql, () =>
    planDeliver({
      projectId: ctx.projectId,
      createdByAccountId: ctx.owner,
      requestId: `m39-${crypto.randomUUID()}`,
      today: AMMAN_TODAY,
      saleId,
      ...(seed.collectFils === undefined
        ? {}
        : { collection: { amountFils: seed.collectFils, box: "cash" } }),
    }),
  );
  return saleId;
}

/** Undo through the real composition. */
async function undo(sql: postgres.Sql, ctx: { projectId: string; owner: string }, saleId: string) {
  return runPlan(sql, () =>
    planUndoDelivery({
      projectId: ctx.projectId,
      createdByAccountId: ctx.owner,
      requestId: `m39-${crypto.randomUUID()}`,
      today: AMMAN_TODAY,
      saleId,
    }),
  );
}

/* ── 1. T17: the full undo with a prepayment and a collection ─────────── */

describe("M3.9 T17 — sale 100, prepayment 20, deliver, collect 50, undo", () => {
  it("ends at REV 0, remainder 0, PRE 70, cash 70 (unchanged), scheduled, net worth 0", async () => {
    const ctx = await newProject();
    await withSql(async sql => {
      const saleId = await deliveredSale(sql, ctx, {
        priceFils: 100_000,
        prepayFils: 20_000,
        collectFils: 50_000,
        customerName: "سامي",
      });
      // Before the undo: cash 70, PRE 0, remainder 30.
      expect(await boxBalance(sql, ctx.projectId, "cash")).toBe(70_000);
      await undo(sql, ctx, saleId);

      expect(await accountTotal(sql, ctx.projectId, "REV")).toBe(0);
      expect(await accountTotal(sql, ctx.projectId, "AR")).toBe(0); // remainder 0
      expect(await accountTotal(sql, ctx.projectId, "PRE")).toBe(70_000); // 20 + the 50 as prepayment
      expect(await boxBalance(sql, ctx.projectId, "cash")).toBe(70_000); // unchanged by the undo
      const figures = await computeManageFigures(sql, ctx.projectId, AMMAN_TODAY, "since_start");
      expect(figures.salesList.find(s => s.id === saleId)).toMatchObject({
        status: "scheduled", // planned 1/12 is still ahead
        prepaymentFils: 70_000,
        paid: { paidFils: 70_000, ofFils: 100_000 },
      });
      expect(figures.netWorth.fils).toBe(0);
      expect(figures.payablesPrepayments.fils).toBe(70_000);

      await assertLedgerCoreInvariants(await ledgerState(sql, ctx.projectId));
    });
  });
});

/* ── 2. T37: the undo with a kept overpayment ─────────────────────────── */

describe("M3.9 T37 — deliver 50, collect 55 (Q6 50 + Q18 5), undo", () => {
  it("ends at REV 0, PRE 55, cash +55 unchanged, scheduled, net worth 0", async () => {
    const ctx = await newProject();
    await withSql(async sql => {
      const saleId = await deliveredSale(sql, ctx, {
        priceFils: 50_000,
        customerName: "سامي",
      });
      // Collect 55 against the remainder line: Q6 50 + Q18 5 (M2.8's rule).
      const remainder = await sql`SELECT id FROM balance_line
                                  WHERE project_id = ${ctx.projectId} AND sale_id = ${saleId} AND kind = 'sale_remainder'`;
      await runPlan(sql, () =>
        planCollect({
          projectId: ctx.projectId,
          createdByAccountId: ctx.owner,
          requestId: `m39-${crypto.randomUUID()}`,
          today: AMMAN_TODAY,
          amountFils: 55_000,
          box: "cash",
          balanceLineId: String(remainder[0]!.id),
        }),
      );
      expect(await boxBalance(sql, ctx.projectId, "cash")).toBe(55_000);
      await undo(sql, ctx, saleId);

      expect(await accountTotal(sql, ctx.projectId, "REV")).toBe(0);
      expect(await accountTotal(sql, ctx.projectId, "AR")).toBe(0);
      expect(await accountTotal(sql, ctx.projectId, "PRE")).toBe(55_000); // 50 + 5 both become prepayments
      expect(await boxBalance(sql, ctx.projectId, "cash")).toBe(55_000); // unchanged
      const figures = await computeManageFigures(sql, ctx.projectId, AMMAN_TODAY, "since_start");
      expect(figures.salesList.find(s => s.id === saleId)).toMatchObject({
        status: "scheduled",
        prepaymentFils: 55_000,
      });
      expect(figures.netWorth.fils).toBe(0);

      await assertLedgerCoreInvariants(await ledgerState(sql, ctx.projectId));
    });
  });
});

/* ── 3. The blocks (§5) and validations ───────────────────────────────── */

describe("M3.9 — the undo blocks (§5)", () => {
  it("blocks on an active return (E-UNDO-DELIVERY-BLOCKED)", async () => {
    const ctx = await newProject();
    await withSql(async sql => {
      const saleId = await deliveredSale(sql, ctx, {
        priceFils: 100_000,
        collectFils: 100_000,
        customerName: "سامي",
      });
      await runPlan(sql, () =>
        planReturn({
          projectId: ctx.projectId,
          createdByAccountId: ctx.owner,
          requestId: `m39-${crypto.randomUUID()}`,
          today: AMMAN_TODAY,
          saleId,
          amountFils: 20_000,
          refund: { mode: "now", box: "cash" },
        }),
      );
      await expect(undo(sql, ctx, saleId)).rejects.toMatchObject({
        code: "E-UNDO-DELIVERY-BLOCKED",
      });
    });
  });

  it("blocks when a customer_refund line of the sale was paid (E-UNDO-DELIVERY-BLOCKED)", async () => {
    const ctx = await newProject();
    await withSql(async sql => {
      // Prepayment 60 on a sale priced 50 → delivered → refund line 10 → pay it.
      const saleId = await deliveredSale(sql, ctx, {
        priceFils: 50_000,
        prepayFils: 60_000,
        customerName: "سامي",
      });
      const refund = await sql`SELECT id FROM balance_line
                               WHERE project_id = ${ctx.projectId} AND sale_id = ${saleId} AND kind = 'customer_refund'`;
      expect(refund).toHaveLength(1);
      await runPlan(sql, () =>
        planPay({
          projectId: ctx.projectId,
          createdByAccountId: ctx.owner,
          requestId: `m39-${crypto.randomUUID()}`,
          today: AMMAN_TODAY,
          balanceLineId: String(refund[0]!.id),
          amountFils: 10_000,
          box: "cash",
        }),
      );
      await expect(undo(sql, ctx, saleId)).rejects.toMatchObject({
        code: "E-UNDO-DELIVERY-BLOCKED",
      });
    });
  });

  it("rejects an undelivered or cancelled sale (E-SALE-STATE) and an unknown sale", async () => {
    const ctx = await newProject();
    await withSql(async sql => {
      const outcome = await runPlan(sql, () =>
        planSaleCreate({
          projectId: ctx.projectId,
          createdByAccountId: ctx.owner,
          requestId: `m39-${crypto.randomUUID()}`,
          today: AMMAN_TODAY,
          lines: [{ description: "طلب", unitPriceFils: 50_000 }],
          plannedDeliveryOn: "2026-12-01",
          finalPriceFils: 50_000,
          customerName: "سامي",
        }),
      );
      const saleId = String((resultOf(outcome, "applied").data as { saleId: string }).saleId);
      await expect(undo(sql, ctx, saleId)).rejects.toMatchObject({ code: "E-SALE-STATE" });
      const delivered = await deliveredSale(sql, ctx, { priceFils: 50_000, customerName: "سامي" });
      await sql`UPDATE sale SET cancelled_on = ${AMMAN_TODAY} WHERE id = ${delivered}`;
      await expect(undo(sql, ctx, delivered)).rejects.toMatchObject({ code: "E-SALE-STATE" });
      await expect(undo(sql, ctx, crypto.randomUUID())).rejects.toMatchObject({ code: "E-SALE-STATE" });
    });
  });
});

/* ── 4. Idempotency and the row states ────────────────────────────────── */

describe("M3.9 — idempotency and the corrected row states", () => {
  it("replays a retried undo byte-identically; the delivery and its collection are reversed rows", async () => {
    const ctx = await newProject();
    await withSql(async sql => {
      const saleId = await deliveredSale(sql, ctx, {
        priceFils: 80_000,
        collectFils: 80_000,
        customerName: "سامي",
      });
      const requestId = `m39-retry-${suffix()}`;
      const make = () =>
        planUndoDelivery({
          projectId: ctx.projectId,
          createdByAccountId: ctx.owner,
          requestId,
          today: AMMAN_TODAY,
          saleId,
        });
      const first = await runPlan(sql, make);
      const retry = await runPlan(sql, make);
      expect(first.outcome).toBe("applied");
      expect(retry.outcome).toBe("replay");
      expect((retry as { result: unknown }).result).toEqual((first as { result: unknown }).result);
      const rows = await sql`SELECT kind, status FROM operation
                             WHERE project_id = ${ctx.projectId} AND kind IN ('OP-DELIVER','OP-COLLECT','OP-UNDO-DELIVERY')`;
      const byKind = new Map(rows.map(r => [String(r.kind), String(r.status)]));
      expect(byKind.get("OP-DELIVER")).toBe("reversed");
      expect(byKind.get("OP-COLLECT")).toBe("reversed");
      expect(byKind.get("OP-UNDO-DELIVERY")).toBe("active");
      // The sale is scheduled again and can be delivered again — the undo's
      // Q4 holds the collected 80 as a prepayment that now covers the price
      // whole, so the re-delivery needs no collection (PRE consumed → completed).
      const again = await runPlan(sql, () =>
        planDeliver({
          projectId: ctx.projectId,
          createdByAccountId: ctx.owner,
          requestId: `m39-${crypto.randomUUID()}`,
          today: AMMAN_TODAY,
          saleId,
        }),
      );
      expect(resultOf(again, "applied").kind).toBe("OP-DELIVER");
      expect(await accountTotal(sql, ctx.projectId, "REV")).toBe(80_000);
      expect(await accountTotal(sql, ctx.projectId, "PRE")).toBe(0);
      await assertLedgerCoreInvariants(await ledgerState(sql, ctx.projectId));
    });
  });
});
