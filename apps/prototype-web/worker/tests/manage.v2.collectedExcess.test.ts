/**
 * M3.10 acceptance (Manage v2 phase 3 — spec §5 OP-COLLECT's kept-excess
 * rule, §4 Q18, §8's figures; test T23): the collected excess through the
 * REAL phase-3 operations — no seeded rows. A delivered 50 sale collected
 * at 55 posts Q6 50 against the remainder line + Q18 5 on the sale
 * (rev_kind `overpayment`), returns the S-OVERPAY-KEPT message (stored with
 * the idempotent response), and the §8 view counts the kept excess in the
 * sale's net revenue and in Sales(f) («مدفوع 55 من 55»).
 *
 * Also proves the same rule through the deliver companion — R-28's grouped
 * «delivery with collection (+ overpayment)» — where M2.8's planner runs
 * inside the delivery's own transaction against the fresh remainder line.
 *
 * Tests-first: the file was written before the acceptance chain existed;
 * M2.8 proved the mechanism on seeded rows — this file replaces the seed
 * with the real operations (the phase-3 pattern).
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
  boxIdOf,
  fileSqlUrl,
  ledgerState,
  resultOf,
  runPlan,
  scopedClient,
  setupProject,
} from "./manage.v2.helpers.ts";
import { planSaleCreate } from "../../../../src/domain/manage/operations/saleCreate.js";
import { planDeliver } from "../../../../src/domain/manage/operations/deliver.js";
import { planCollect } from "../../../../src/domain/manage/operations/collect.js";
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
  const owner = `m310-owner-${suffix()}`;
  await withSql(sql => setupProject(sql, { projectId, owner, today: AMMAN_TODAY, boxes }));
  return { projectId, owner };
}

interface Ctx {
  projectId: string;
  owner: string;
}

/** Create + deliver a NAMED 50 sale with no money moved yet (T23's given). */
async function deliveredSale(sql: postgres.Sql, ctx: Ctx, priceFils: number): Promise<string> {
  const outcome = await runPlan(sql, () =>
    planSaleCreate({
      projectId: ctx.projectId,
      createdByAccountId: ctx.owner,
      requestId: `m310-${crypto.randomUUID()}`,
      today: AMMAN_TODAY,
      lines: [{ description: "طلب", quantityMilli: 1000, unitPriceFils: priceFils }],
      plannedDeliveryOn: "2026-12-01",
      finalPriceFils: priceFils,
      customerName: "سامي",
    }),
  );
  const saleId = String((resultOf(outcome, "applied").data as { saleId: string }).saleId);
  await runPlan(sql, () =>
    planDeliver({
      projectId: ctx.projectId,
      createdByAccountId: ctx.owner,
      requestId: `m310-${crypto.randomUUID()}`,
      today: AMMAN_TODAY,
      saleId,
    }),
  );
  return saleId;
}

/** The sale's remainder line id. */
async function remainderLineOf(sql: postgres.Sql, ctx: Ctx, saleId: string): Promise<string> {
  const rows = await sql`SELECT id FROM balance_line
                          WHERE project_id = ${ctx.projectId} AND sale_id = ${saleId} AND kind = 'sale_remainder'`;
  return String(rows[0]!.id);
}

/* ── 1. T23: the kept excess through the real operations ──────────────── */

describe("M3.10 T23 — deliver 50, collect 55: Q6 50 + Q18 5, REV 55, S-OVERPAY-KEPT", () => {
  it("posts the pair on the sale, returns the message, and the §8 view counts the excess", async () => {
    const ctx = await newProject();
    await withSql(async sql => {
      const saleId = await deliveredSale(sql, ctx, 50_000);
      const lineId = await remainderLineOf(sql, ctx, saleId);
      const cashId = await boxIdOf(sql, ctx.projectId, "cash");

      const result = resultOf(
        await runPlan(sql, () =>
          planCollect({
            projectId: ctx.projectId,
            createdByAccountId: ctx.owner,
            requestId: `m310-${crypto.randomUUID()}`,
            today: AMMAN_TODAY,
            amountFils: 55_000,
            box: "cash",
            balanceLineId: lineId,
          }),
        ),
        "applied",
      );
      // T23's message — stored with the idempotent response.
      expect(result.data).toEqual({ messages: ["S-OVERPAY-KEPT"] });

      // T23: Q6 50 + Q18 5, in the handler's write order (result.entryIds),
      // exact postings.
      const entries = await sql`
        SELECT id, entry_type, effective_on::text AS effective_on
        FROM ledger_entry e WHERE e.project_id = ${ctx.projectId} AND e.id IN ${sql(result.entryIds)}`;
      const byId = new Map(entries.map(e => [String(e.id), e]));
      const ordered = result.entryIds.map(id => byId.get(id)!);
      expect(ordered.map(e => String(e.entry_type))).toEqual(["Q6", "Q18"]);
      const postings = await sql`
        SELECT p.entry_id, p.account, p.ref_id, p.category, p.rev_kind, p.delta_minor
        FROM ledger_posting p WHERE p.project_id = ${ctx.projectId} AND p.entry_id IN ${sql(result.entryIds)}`;
      const of = (entryId: string) =>
        postings
          .filter(p => String(p.entry_id) === entryId)
          .map(p => ({
            account: String(p.account),
            refId: p.ref_id === null ? null : String(p.ref_id),
            category: p.category === null ? null : String(p.category),
            revKind: p.rev_kind === null ? null : String(p.rev_kind),
            deltaFils: Number(p.delta_minor),
          }))
          .sort((a, b) => a.account.localeCompare(b.account));
      const q6Id = ordered[0]!.id;
      const q18Id = ordered[1]!.id;
      expect(of(q6Id)).toEqual([
        { account: "AR", refId: lineId, category: null, revKind: null, deltaFils: -50_000 },
        { account: "BOX", refId: cashId, category: null, revKind: null, deltaFils: 50_000 },
      ]);
      expect(of(q18Id)).toEqual([
        { account: "BOX", refId: cashId, category: null, revKind: null, deltaFils: 5_000 },
        { account: "REV", refId: saleId, category: null, revKind: "overpayment", deltaFils: 5_000 },
      ]);

      // T23: REV 55 (delivery 50 + kept excess 5); the remainder is dead.
      expect(await accountTotal(sql, ctx.projectId, "REV")).toBe(55_000);
      expect(await accountTotal(sql, ctx.projectId, "AR")).toBe(0);
      expect(await boxBalance(sql, ctx.projectId, "cash")).toBe(55_000);

      // §8's view: the excess counts in the sale's net revenue and paid,
      // the sale is completed, and Sales(f)/net profit include it.
      const figures = await computeManageFigures(sql, ctx.projectId, AMMAN_TODAY, "since_start");
      expect(figures.salesList.find(s => s.id === saleId)).toMatchObject({
        status: "completed",
        netSaleRevenueFils: 55_000,
        paid: { paidFils: 55_000, ofFils: 55_000 },
      });
      expect(figures.sales.fils).toBe(55_000);
      expect(figures.netSales.fils).toBe(55_000);
      expect(figures.netProfit.fils).toBe(55_000);
      expect(figures.netWorth.fils).toBe(55_000);

      await assertLedgerCoreInvariants(await ledgerState(sql, ctx.projectId));
    });
  });
});

/* ── 2. R-25: the message survives a retried collect verbatim ─────────── */

describe("M3.10 — R-25 replay of the kept-excess collect", () => {
  it("replays byte-identically with the S-OVERPAY-KEPT message", async () => {
    const ctx = await newProject();
    await withSql(async sql => {
      const saleId = await deliveredSale(sql, ctx, 50_000);
      const lineId = await remainderLineOf(sql, ctx, saleId);
      const requestId = `m310-retry-${suffix()}`;
      const make = () =>
        planCollect({
          projectId: ctx.projectId,
          createdByAccountId: ctx.owner,
          requestId,
          today: AMMAN_TODAY,
          amountFils: 55_000,
          box: "cash",
          balanceLineId: lineId,
        });
      const first = await runPlan(sql, make);
      const retry = await runPlan(sql, make);
      expect(first.outcome).toBe("applied");
      expect(retry.outcome).toBe("replay");
      expect((retry as { result: unknown }).result).toEqual((first as { result: unknown }).result);
      expect((resultOf(first, "applied").data as { messages: string[] }).messages).toEqual([
        "S-OVERPAY-KEPT",
      ]);
      // One collect row only — the retry wrote nothing.
      expect(await boxBalance(sql, ctx.projectId, "cash")).toBe(55_000);

      await assertLedgerCoreInvariants(await ledgerState(sql, ctx.projectId));
    });
  });
});

/* ── 3. The same rule through the deliver companion (R-28's grouped
 *      «delivery with collection (+ overpayment)») ─────────────────────── */

describe("M3.10 — the immediate collection at delivery may keep an excess", () => {
  it("delivers 50 and collects 55 in one atomic action: Q5 + Q6 50 + Q18 5, completed, cash 55", async () => {
    const ctx = await newProject();
    await withSql(async sql => {
      const outcome = await runPlan(sql, () =>
        planSaleCreate({
          projectId: ctx.projectId,
          createdByAccountId: ctx.owner,
          requestId: `m310-${crypto.randomUUID()}`,
          today: AMMAN_TODAY,
          lines: [{ description: "طلب", quantityMilli: 1000, unitPriceFils: 50_000 }],
          plannedDeliveryOn: "2026-12-01",
          finalPriceFils: 50_000,
          customerName: "سامي",
        }),
      );
      const saleId = String((resultOf(outcome, "applied").data as { saleId: string }).saleId);
      const both = await runPlan(sql, () =>
        planDeliver({
          projectId: ctx.projectId,
          createdByAccountId: ctx.owner,
          requestId: `m310-${crypto.randomUUID()}`,
          today: AMMAN_TODAY,
          saleId,
          collection: { amountFils: 55_000, box: "cash" },
        }),
      );
      expect(resultOf(both, "applied").kind).toBe("OP-DELIVER");

      expect(await accountTotal(sql, ctx.projectId, "REV")).toBe(55_000);
      expect(await accountTotal(sql, ctx.projectId, "AR")).toBe(0);
      expect(await boxBalance(sql, ctx.projectId, "cash")).toBe(55_000);

      // The grouped shape (R-28): two separate operations, one user action —
      // the collect's Q18 keeps the excess ON the sale.
      const rows = await sql`SELECT kind FROM operation
                              WHERE project_id = ${ctx.projectId} AND kind IN ('OP-DELIVER','OP-COLLECT')`;
      expect(rows.map(r => String(r.kind)).sort()).toEqual(["OP-COLLECT", "OP-DELIVER"]);

      const figures = await computeManageFigures(sql, ctx.projectId, AMMAN_TODAY, "since_start");
      expect(figures.salesList.find(s => s.id === saleId)).toMatchObject({
        status: "completed",
        netSaleRevenueFils: 55_000,
        paid: { paidFils: 55_000, ofFils: 55_000 },
      });

      await assertLedgerCoreInvariants(await ledgerState(sql, ctx.projectId));
    });
  });
});
