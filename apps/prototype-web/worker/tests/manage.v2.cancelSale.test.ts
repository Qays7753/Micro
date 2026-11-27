/**
 * M3.6 acceptance (Manage v2 phase 3 — spec §5 OP-CANCEL-SALE, §4 Q15, §6
 * transition, R-26; tests S3, T11, T24, T50): cancel a sale — final, no
 * undo. With prepayments: the kept part m posts REV (kept_prepayment) on
 * the cancel date; the rest r = p − m leaves either now (box) or later (a
 * customer_refund line). A cancellation sets sale.cancelled_on (§3.4) and
 * moves the §6 status to cancelled. Cancelling a SALE_CREATE operation
 * from the activity log runs THIS operation (§5 OP-CANCEL-OPERATION).
 *
 * Tests-first: this file was written before the operation existed and fails
 * with "Cannot find module … operations/cancelSale.js".
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
import { planCancelSale } from "../../../../src/domain/manage/operations/cancelSale.js";
import { planPay } from "../../../../src/domain/manage/operations/pay.js";
import { planCancelOperation } from "../../../../src/domain/manage/operations/cancelOperation.js";
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
  const owner = `m36-owner-${suffix()}`;
  await withSql(sql => setupProject(sql, { projectId, owner, today: AMMAN_TODAY, boxes }));
  return { projectId, owner };
}

/** A sale with a prepayment, through the real operations. */
async function saleWithPrepayment(
  sql: postgres.Sql,
  ctx: { projectId: string; owner: string },
  prepaymentFils: number,
): Promise<string> {
  const outcome = await runPlan(sql, () =>
    planSaleCreate({
      projectId: ctx.projectId,
      createdByAccountId: ctx.owner,
      requestId: `m36-${crypto.randomUUID()}`,
      today: AMMAN_TODAY,
      lines: [{ description: "طلب", quantityMilli: 1000, unitPriceFils: 30_000 }],
      plannedDeliveryOn: "2026-11-30",
      finalPriceFils: 30_000,
      customerName: "سامي",
    }),
  );
  const saleId = String((resultOf(outcome, "applied").data as { saleId: string }).saleId);
  if (prepaymentFils > 0) {
    await runPlan(sql, () =>
      planPrepayment({
        projectId: ctx.projectId,
        createdByAccountId: ctx.owner,
        requestId: `m36-${crypto.randomUUID()}`,
        today: AMMAN_TODAY,
        saleId,
        amountFils: prepaymentFils,
        box: "cash",
      }),
    );
  }
  return saleId;
}

/** Cancel through the real composition. */
async function cancel(
  sql: postgres.Sql,
  ctx: { projectId: string; owner: string },
  input: { saleId: string; keptFils?: number; refund?: "now" | "later"; refundBox?: "cash" | "account" },
) {
  return runPlan(sql, () =>
    planCancelSale({
      projectId: ctx.projectId,
      createdByAccountId: ctx.owner,
      requestId: `m36-${crypto.randomUUID()}`,
      today: AMMAN_TODAY,
      saleId: input.saleId,
      ...(input.keptFils === undefined ? {} : { keptFils: input.keptFils }),
      ...(input.refund === undefined
        ? {}
        : input.refund === "now"
          ? { refund: { mode: "now", box: input.refundBox ?? "cash" } }
          : { refund: { mode: "later" } }),
    }),
  );
}

/* ── 1. S3: the two cancellation shapes ───────────────────────────────── */

describe("M3.6 S3 — cancel with prepayment 30", () => {
  it("(a) keep all 30: profit +30 on the cancel date, cash unchanged", async () => {
    const ctx = await newProject([{ kind: "cash", opening: { openingFils: 0 } }]);
    await withSql(async sql => {
      const saleId = await saleWithPrepayment(sql, ctx, 30_000);
      await cancel(sql, ctx, { saleId, keptFils: 30_000 });
      // Q15 with m = 30: PRE −30, REV +30 (kept_prepayment); no refund part.
      expect(await accountTotal(sql, ctx.projectId, "PRE")).toBe(0);
      expect(await accountTotal(sql, ctx.projectId, "REV")).toBe(30_000);
      expect(await boxBalance(sql, ctx.projectId, "cash")).toBe(30_000); // unchanged
      const figures = await computeManageFigures(sql, ctx.projectId, AMMAN_TODAY, "since_start");
      expect(figures.netProfit.fils).toBe(30_000);
      expect(figures.salesList.find(s => s.id === saleId)?.status).toBe("cancelled");
      // cancelled_on is set (§3.4).
      const row = await sql`SELECT cancelled_on::text AS cancelled_on FROM sale WHERE id = ${saleId}`;
      expect(row[0]!.cancelled_on).toBe(AMMAN_TODAY);
      await assertLedgerCoreInvariants(await ledgerState(sql, ctx.projectId));
    });
  });

  it("(b) keep 0, refund now: cash −30, profit 0", async () => {
    const ctx = await newProject([{ kind: "cash", opening: { openingFils: 50_000 } }]);
    await withSql(async sql => {
      const saleId = await saleWithPrepayment(sql, ctx, 30_000);
      await cancel(sql, ctx, { saleId, keptFils: 0, refund: "now" });
      expect(await accountTotal(sql, ctx.projectId, "REV")).toBe(0);
      // S3(b): cash −30 across the CANCEL — 50 + 30 prepay = 80, − 30 refund = 50.
      expect(await boxBalance(sql, ctx.projectId, "cash")).toBe(50_000);
      expect(await accountTotal(sql, ctx.projectId, "PRE")).toBe(0);
      const figures = await computeManageFigures(sql, ctx.projectId, AMMAN_TODAY, "since_start");
      expect(figures.netProfit.fils).toBe(0);
      expect(figures.salesList.find(s => s.id === saleId)?.status).toBe("cancelled");
      await assertLedgerCoreInvariants(await ledgerState(sql, ctx.projectId));
    });
  });
});

/* ── 2. T11 + T24: the refund-later line and the split ────────────────── */

describe("M3.6 T11 — prepayment 30, cancel m = 0 refund later, then pay the refund", () => {
  it("opens a customer_refund line (PRE 0, payable 30, profit 0), then OP-PAY settles it", async () => {
    const ctx = await newProject([{ kind: "cash", opening: { openingFils: 50_000 } }]);
    await withSql(async sql => {
      const saleId = await saleWithPrepayment(sql, ctx, 30_000);
      await cancel(sql, ctx, { saleId, keptFils: 0, refund: "later" });
      // After Q15: PRE 0, payable 30, profit 0.
      expect(await accountTotal(sql, ctx.projectId, "PRE")).toBe(0);
      expect(await accountTotal(sql, ctx.projectId, "AP")).toBe(30_000);
      expect(await accountTotal(sql, ctx.projectId, "REV")).toBe(0);
      const figures = await computeManageFigures(sql, ctx.projectId, AMMAN_TODAY, "since_start");
      expect(figures.netProfit.fils).toBe(0);
      expect(figures.payables.fils).toBe(30_000);

      // Then OP-PAY settles the refund line (M2.8): cash −30, payable 0.
      const line = await sql`SELECT id, counterparty_name FROM balance_line
                             WHERE project_id = ${ctx.projectId} AND kind = 'customer_refund'`;
      expect(line[0]!.counterparty_name).toBeNull(); // §3.6: taken from the sale
      await runPlan(sql, () =>
        planPay({
          projectId: ctx.projectId,
          createdByAccountId: ctx.owner,
          requestId: `m36-${crypto.randomUUID()}`,
          today: AMMAN_TODAY,
          balanceLineId: String(line[0]!.id),
          amountFils: 30_000,
          box: "cash",
        }),
      );
      expect(await accountTotal(sql, ctx.projectId, "AP")).toBe(0);
      // 50 + 30 prepay = 80, − 30 paid refund = 50.
      expect(await boxBalance(sql, ctx.projectId, "cash")).toBe(50_000);
      await assertLedgerCoreInvariants(await ledgerState(sql, ctx.projectId));
    });
  });
});

describe("M3.6 T24 — prepayment 20, cancel m = 12, refund 8 now cash", () => {
  it("posts REV +12 and cash −8 with PRE 0", async () => {
    const ctx = await newProject([{ kind: "cash", opening: { openingFils: 40_000 } }]);
    await withSql(async sql => {
      const saleId = await saleWithPrepayment(sql, ctx, 20_000);
      await cancel(sql, ctx, { saleId, keptFils: 12_000, refund: "now" });
      expect(await accountTotal(sql, ctx.projectId, "REV")).toBe(12_000);
      expect(await boxBalance(sql, ctx.projectId, "cash")).toBe(52_000); // 40 + 20 prepay − 8 refund
      expect(await accountTotal(sql, ctx.projectId, "PRE")).toBe(0);
      await assertLedgerCoreInvariants(await ledgerState(sql, ctx.projectId));
    });
  });
});

/* ── 3. T50 + the §5 validations ──────────────────────────────────────── */

describe("M3.6 T50 + validations", () => {
  it("rejects keeping more than the prepayment (E-OVERPAY)", async () => {
    const ctx = await newProject();
    await withSql(async sql => {
      const saleId = await saleWithPrepayment(sql, ctx, 20_000);
      await expect(cancel(sql, ctx, { saleId, keptFils: 25_000 })).rejects.toMatchObject({
        code: "E-OVERPAY",
      });
    });
  });

  it("rejects a delivered sale (E-CANCEL-DELIVERED), a cancelled sale, an unknown sale, and a missing refund choice", async () => {
    const ctx = await newProject();
    await withSql(async sql => {
      const delivered = await runPlan(sql, () =>
        planSaleCreate({
          projectId: ctx.projectId,
          createdByAccountId: ctx.owner,
          requestId: `m36-${crypto.randomUUID()}`,
          today: AMMAN_TODAY,
          lines: [{ description: "طلب اليوم", unitPriceFils: 10_000 }],
          plannedDeliveryOn: AMMAN_TODAY,
          finalPriceFils: 10_000,
        }),
      );
      const deliveredId = String((resultOf(delivered, "applied").data as { saleId: string }).saleId);
      // Deliver it through a seeded active Q5 (the same-day path needs the
      // full collection; simpler to seed the Q5 directly).
      const deliverOp = crypto.randomUUID();
      const deliverEntry = crypto.randomUUID();
      await sql`INSERT INTO operation (id, project_id, kind, effective_on, status, sale_id, amount_minor,
                                       payload, created_by_account_id, created_at)
                VALUES (${deliverOp}, ${ctx.projectId}, ${"OP-DELIVER"}, ${AMMAN_TODAY}, ${"active"}, ${deliveredId},
                        ${10_000}, ${"{}"}, ${"seed"}, now())`;
      await sql`INSERT INTO ledger_entry (id, project_id, operation_id, entry_type, effective_on, created_at)
                VALUES (${deliverEntry}, ${ctx.projectId}, ${deliverOp}, ${"Q5"}, ${AMMAN_TODAY}, now())`;
      await sql`INSERT INTO ledger_posting (id, project_id, entry_id, account, ref_id, rev_kind, delta_minor)
                VALUES (${crypto.randomUUID()}, ${ctx.projectId}, ${deliverEntry}, ${"REV"}, ${deliveredId}, ${"delivery"}, ${10_000})`;
      await expect(cancel(sql, ctx, { saleId: deliveredId })).rejects.toMatchObject({
        code: "E-CANCEL-DELIVERED",
      });

      const cancelledSale = await saleWithPrepayment(sql, ctx, 5_000);
      await cancel(sql, ctx, { saleId: cancelledSale, keptFils: 5_000 });
      await expect(cancel(sql, ctx, { saleId: cancelledSale })).rejects.toMatchObject({
        code: "E-SALE-STATE",
      });
      await expect(cancel(sql, ctx, { saleId: crypto.randomUUID() })).rejects.toMatchObject({
        code: "E-SALE-STATE",
      });
      // m < p without a refund choice is malformed (§5 asks the question).
      const open = await saleWithPrepayment(sql, ctx, 20_000);
      await expect(cancel(sql, ctx, { saleId: open, keptFils: 5_000 })).rejects.toMatchObject({
        code: "E-AMOUNT",
      });
    });
  });

  it("cancelling a sale with PRE = 0 posts no entry, just sets cancelled_on", async () => {
    const ctx = await newProject();
    await withSql(async sql => {
      const saleId = await saleWithPrepayment(sql, ctx, 0);
      await cancel(sql, ctx, { saleId });
      const postings = await sql`SELECT account FROM ledger_posting WHERE project_id = ${ctx.projectId}`;
      expect(postings).toHaveLength(0);
      const row = await sql`SELECT cancelled_on::text AS cancelled_on FROM sale WHERE id = ${saleId}`;
      expect(row[0]!.cancelled_on).toBe(AMMAN_TODAY);
      const figures = await computeManageFigures(sql, ctx.projectId, AMMAN_TODAY, "since_start");
      expect(figures.salesList.find(s => s.id === saleId)?.status).toBe("cancelled");
    });
  });
});

/* ── 4. Cancelling the SALE_CREATE operation runs OP-CANCEL-SALE (§5) ─── */

describe("M3.6 — OP-CANCEL-OPERATION on a SALE_CREATE runs the cancel-sale", () => {
  it("routes the activity-log cancellation into OP-CANCEL-SALE with its prepayment questions", async () => {
    const ctx = await newProject();
    await withSql(async sql => {
      const saleId = await saleWithPrepayment(sql, ctx, 30_000);
      const createOp = await sql`SELECT id FROM operation
                                 WHERE project_id = ${ctx.projectId} AND kind = 'OP-SALE-CREATE' AND sale_id = ${saleId}`;
      const outcome = await runPlan(sql, () =>
        planCancelOperation({
          projectId: ctx.projectId,
          createdByAccountId: ctx.owner,
          requestId: `m36-${crypto.randomUUID()}`,
          today: AMMAN_TODAY,
          operationId: String(createOp[0]!.id),
        }),
      );
      // The result is an OP-CANCEL-SALE (kept 30 by default).
      expect(resultOf(outcome, "applied").kind).toBe("OP-CANCEL-SALE");
      expect(await accountTotal(sql, ctx.projectId, "REV")).toBe(30_000);
      expect(await accountTotal(sql, ctx.projectId, "PRE")).toBe(0);
      const row = await sql`SELECT cancelled_on::text AS cancelled_on FROM sale WHERE id = ${saleId}`;
      expect(row[0]!.cancelled_on).toBe(AMMAN_TODAY);
      await assertLedgerCoreInvariants(await ledgerState(sql, ctx.projectId));
    });
  });
});

/* ── 5. Idempotency and the HTTP surface ─────────────────────────────── */

describe("M3.6 — idempotency and route", () => {
  it("replays a retried cancellation byte-identically; the sale stays cancelled once", async () => {
    const ctx = await newProject();
    await withSql(async sql => {
      const saleId = await saleWithPrepayment(sql, ctx, 20_000);
      const requestId = `m36-retry-${suffix()}`;
      const make = () =>
        planCancelSale({
          projectId: ctx.projectId,
          createdByAccountId: ctx.owner,
          requestId,
          today: AMMAN_TODAY,
          saleId,
          keptFils: 20_000,
        });
      const first = await runPlan(sql, make);
      const retry = await runPlan(sql, make);
      expect(first.outcome).toBe("applied");
      expect(retry.outcome).toBe("replay");
      const cancels = await sql`SELECT id FROM operation
                                WHERE project_id = ${ctx.projectId} AND kind = 'OP-CANCEL-SALE'`;
      expect(cancels).toHaveLength(1);
    });
  });

  it("applies end-to-end through the route with the §11 mapping", async () => {
    const sub = `m36-route-${suffix()}`;
    const session = await signInAs(worker, { sub, email: `${sub}@example.com` });
    const setup = await apiPost(worker, session.cookieHeader, "/api/manage-v2/setup", {
      requestId: `route-${suffix()}`,
      projectName: "مشروع الإلغاء",
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
    await apiPost(worker, session.cookieHeader, "/api/manage-v2/prepayment", {
      requestId: `route-${suffix()}`,
      projectId,
      saleId,
      amountFils: 10_000,
      box: "cash",
    });

    const cancelled = await apiPost(worker, session.cookieHeader, "/api/manage-v2/cancel-sale", {
      requestId: `route-${suffix()}`,
      projectId,
      saleId,
      keptFils: 4_000,
      refund: { mode: "later" },
    });
    expect(cancelled.status).toBe(200);
    expect((await cancelled.json()) as { outcome: string; result: { kind: string } }).toMatchObject({
      outcome: "applied",
      result: { kind: "OP-CANCEL-SALE" },
    });

    const invalid = await apiPost(worker, session.cookieHeader, "/api/manage-v2/cancel-sale", {
      requestId: `route-${suffix()}`,
      projectId,
      saleId,
    });
    expect(invalid.status).toBe(400);
    expect(((await invalid.json()) as { error: { details: { code: string } } }).error.details.code).toBe(
      "E-SALE-STATE",
    );
  });
});
