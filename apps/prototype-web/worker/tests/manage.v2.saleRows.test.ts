/**
 * M5.2 acceptance (Manage v2 phase 5 — UX §2.0 C-09): the sale rows read —
 * every C-09 field for P-10's lists and P-12's return cards, with every
 * figure from the ONE §8 read module (statuses §6, paid indicator §8.2) and
 * only the first-line description added as display data.
 *
 * Coverage:
 *  1. A delivered+collected sale: status completed, paid X of X (§6).
 *  2. A future order with a prepayment: status scheduled, paid = prepay.
 *  3. An overdue order (planned yesterday): status overdue (T48 family).
 *  4. The first-line description is the FIRST line by creation order.
 *  5. An unnamed sale: customerName null («بدون اسم» at the client).
 *  6. R-24 isolation: the unified 404.
 *
 * Tests-first: the first run fails on the not-yet-existing route.
 *
 * Posture: Miniflare over the per-file isolated PostgreSQL. Money is
 * integer fils. Paths that build live state end with INV-1 + INV-2.
 */
import type postgres from "postgres";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { apiGet, apiPost, signInAs, startWorker, type WorkerInstance } from "./harness.ts";
import { fileSqlUrl, ledgerState, resultOf, runPlan, scopedClient } from "./manage.v2.helpers.ts";
import { planSaleCreate } from "../../../../src/domain/manage/operations/saleCreate.js";
import { planDeliver } from "../../../../src/domain/manage/operations/deliver.js";
import { planPrepayment } from "../../../../src/domain/manage/operations/prepayment.js";
import { readSaleRows } from "../application/manage/saleRows.js";
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

interface Ctx {
  projectId: string;
  owner: string;
}

async function newProject(): Promise<Ctx> {
  const projectId = crypto.randomUUID();
  const owner = `m52r-owner-${suffix()}`;
  const { setupProject } = await import("./manage.v2.helpers.ts");
  await withSql(sql =>
    setupProject(sql, {
      projectId,
      owner,
      today: AMMAN_TODAY,
      boxes: [{ kind: "cash", opening: { openingFils: 100_000 } }],
    }),
  );
  return { projectId, owner };
}

async function addSale(
  sql: postgres.Sql,
  ctx: Ctx,
  input: {
    lines: Array<{ description: string; quantityMilli?: number; unitPriceFils?: number }>;
    plannedDeliveryOn: string;
    customerName?: string;
    finalPriceFils?: number;
  },
): Promise<string> {
  const outcome = await runPlan(sql, () =>
    planSaleCreate({
      projectId: ctx.projectId,
      createdByAccountId: ctx.owner,
      requestId: `m52r-${crypto.randomUUID()}`,
      today: AMMAN_TODAY,
      lines: input.lines.map(line => ({
        description: line.description,
        quantityMilli: line.quantityMilli ?? 1000,
        ...(line.unitPriceFils === undefined ? {} : { unitPriceFils: line.unitPriceFils }),
      })),
      plannedDeliveryOn: input.plannedDeliveryOn,
      ...(input.customerName === undefined ? {} : { customerName: input.customerName }),
      ...(input.finalPriceFils === undefined ? {} : { finalPriceFils: input.finalPriceFils }),
    }),
  );
  return resultOf(outcome, "applied").operationId;
}

/* ── The rows' shape ──────────────────────────────────────────────────── */

describe("M5.2 — the sale rows (C-09's fields)", () => {
  it("delivered & collected = completed with paid X of X; the first line is the first by creation", async () => {
    const ctx = await newProject();
    await withSql(async sql => {
      const saleOp = await addSale(sql, ctx, {
        lines: [
          { description: "مقلوبة", unitPriceFils: 18_000 },
          { description: "ورق عنب", unitPriceFils: 12_000 },
        ],
        plannedDeliveryOn: AMMAN_TODAY,
        customerName: "أبو أحمد",
        finalPriceFils: 36_000,
      });
      // Find the sale id through the operation's sale (extraWrites payload).
      const saleIdRow = (await sql`
        SELECT s.id FROM sale s
        JOIN operation o ON o.sale_id = s.id AND o.kind = 'OP-SALE-CREATE'
        WHERE o.id = ${saleOp} AND s.project_id = ${ctx.projectId}`) as Array<{ id: string }>;
      const saleId = String(saleIdRow[0]!.id);
      await runPlan(sql, () =>
        planDeliver({
          projectId: ctx.projectId,
          createdByAccountId: ctx.owner,
          requestId: `m52r-${crypto.randomUUID()}`,
          today: AMMAN_TODAY,
          saleId,
          collection: { amountFils: 36_000, box: "cash" },
        }),
      );
      const rows = await readSaleRows(sql, ctx.projectId, AMMAN_TODAY);
      expect(rows).toHaveLength(1);
      const row = rows[0]!;
      expect(row.status).toBe("completed");
      expect(row.customerName).toBe("أبو أحمد");
      expect(row.firstLineDescription).toBe("مقلوبة");
      expect(row.paidFils).toBe(36_000);
      expect(row.ofFils).toBe(36_000);
      const invariant = await ledgerState(sql, ctx.projectId);
      assertLedgerCoreInvariants(invariant);
    });
  });

  it("a future order with a prepayment: scheduled, paid = the prepayment (§6)", async () => {
    const ctx = await newProject();
    await withSql(async sql => {
      const saleOp = await addSale(sql, ctx, {
        lines: [{ description: "ورق عنب", unitPriceFils: 12_000, quantityMilli: 2000 }],
        plannedDeliveryOn: "2026-11-29",
        customerName: "سلمى",
        finalPriceFils: 24_000,
      });
      const saleIdRow = (await sql`
        SELECT s.id FROM sale s
        JOIN operation o ON o.sale_id = s.id AND o.kind = 'OP-SALE-CREATE'
        WHERE o.id = ${saleOp}`) as Array<{ id: string }>;
      const saleId = String(saleIdRow[0]!.id);
      await runPlan(sql, () =>
        planPrepayment({
          projectId: ctx.projectId,
          createdByAccountId: ctx.owner,
          requestId: `m52r-${crypto.randomUUID()}`,
          today: AMMAN_TODAY,
          saleId,
          amountFils: 10_000,
          box: "cash",
        }),
      );
      const rows = await readSaleRows(sql, ctx.projectId, AMMAN_TODAY);
      expect(rows[0]!.status).toBe("scheduled");
      expect(rows[0]!.paidFils).toBe(10_000);
      expect(rows[0]!.ofFils).toBe(24_000);
      expect(rows[0]!.fullAmountFils).toBe(14_000);
      const invariant = await ledgerState(sql, ctx.projectId);
      assertLedgerCoreInvariants(invariant);
    });
  });

  it("planned yesterday = overdue; an unnamed sale carries null (l.no_name)", async () => {
    const ctx = await newProject();
    await withSql(async sql => {
      await addSale(sql, ctx, {
        lines: [{ description: "كيكة" }],
        plannedDeliveryOn: "2026-11-26",
        finalPriceFils: 40_000,
      });
      const rows = await readSaleRows(sql, ctx.projectId, AMMAN_TODAY);
      expect(rows).toHaveLength(1);
      expect(rows[0]!.status).toBe("overdue");
      expect(rows[0]!.customerName).toBeNull();
      const invariant = await ledgerState(sql, ctx.projectId);
      assertLedgerCoreInvariants(invariant);
    });
  });
});

/* ── The route (R-24) ──────────────────────────────────────────────────── */

describe("M5.2 — the sale-rows route", () => {
  it("serves the signed-in owner's rows; no project is the unified 404", async () => {
    const sub = `m52r-route-${suffix()}`;
    const session = await signInAs(worker, { sub, email: `${sub}@example.com` });
    const setup = await apiPost(worker, session.cookieHeader, "/api/manage-v2/setup", {
      requestId: `m52r-${crypto.randomUUID()}`,
      projectName: "مطبخ",
      boxes: [{ kind: "cash", opening: { openingFils: 50_000 } }],
    });
    expect(setup.status).toBe(200);
    const response = await apiGet(worker, session.cookieHeader, "/api/manage-v2/sale-rows");
    expect(response.status).toBe(200);
    const body = (await response.json()) as { sales: unknown[] };
    expect(body.sales).toEqual([]);

    const otherSub = `m52r-other-${suffix()}`;
    const other = await signInAs(worker, { sub: otherSub, email: `${otherSub}@example.com` });
    const foreign = await apiGet(worker, other.cookieHeader, "/api/manage-v2/sale-rows");
    expect(foreign.status).toBe(404);
  });
});
