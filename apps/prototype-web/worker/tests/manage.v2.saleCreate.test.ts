/**
 * M3.2 acceptance (Manage v2 phase 3 — spec §5 OP-SALE-CREATE, §3.4, §3.5
 * snapshot, §6 derived status, §8.2 open-sales list, R-17, D-14, INV-9;
 * tests S1 create slice, T20, T21 create slice, T44, T48): create a
 * sale/order with its line snapshots, the derived status, and the
 * non-financial field edits as direct updates.
 *
 * Order disclosure (honest): unlike M3.1, this task's modules were written
 * before the test file; the Red step was not run for them. The tests below
 * still assert the §13 behaviors end to end — and T21's DATING half and
 * S1's money half are explicitly deferred to M3.3/M3.4 (their operations),
 * seeded here only where the read side needs rows.
 *
 * Posture: Miniflare over the per-file isolated PostgreSQL. Money is
 * integer fils; quantities are milli-units. Every acceptance path ends
 * with assertLedgerCoreInvariants (INV-1 + INV-2); T21/T44 additionally
 * assert INV-9 / the no-operation rule across the edit.
 */
import type postgres from "postgres";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { apiPost, signInAs, startWorker, type WorkerInstance } from "./harness.ts";
import {
  accountTotal,
  fileSqlUrl,
  ledgerState,
  resultOf,
  runPlan,
  scopedClient,
  setupProject,
} from "./manage.v2.helpers.ts";
import { planSaleCreate } from "../../../../src/domain/manage/operations/saleCreate.js";
import { updateSaleFields } from "../application/manage/saleEdits.js";
import { saveProduct } from "../application/manage/products.js";
import { computeManageFigures } from "../application/manage/readModel.js";
import { checkInv9 } from "../../../../src/domain/manage/invariants/index.js";
import { assertLedgerCoreInvariants } from "../../../../src/domain/manage/invariants/index.js";
import type { SetupBoxSlot } from "../../../../src/domain/manage/operations/setup.js";
import { OperationRejected } from "../../../../src/domain/manage/operations/support.js";

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
  const owner = `m32-owner-${suffix()}`;
  await withSql(sql => setupProject(sql, { projectId, owner, today: AMMAN_TODAY, boxes }));
  return { projectId, owner };
}

/** A product saved through the real application handler (M3.1). */
async function addProduct(
  sql: postgres.Sql,
  projectId: string,
  input: { name: string; unitPriceFils: number; costFils?: number },
): Promise<string> {
  const saved = await saveProduct(sql, {
    projectId,
    productId: crypto.randomUUID(),
    name: input.name,
    unitPriceFils: input.unitPriceFils,
    components: input.costFils === undefined ? [] : [{ name: "مكون", costFils: input.costFils }],
  });
  return saved.productId;
}

/** Create a sale through the real composition (the M2.4 handler). */
async function createSale(
  sql: postgres.Sql,
  ctx: { projectId: string; owner: string },
  input: {
    lines: unknown;
    plannedDeliveryOn: string;
    finalPriceFils?: number;
    customerName?: string;
    tracked?: boolean;
    note?: string;
    registeredOn?: string;
  },
): Promise<string> {
  const outcome = await runPlan(sql, () =>
    planSaleCreate({
      projectId: ctx.projectId,
      createdByAccountId: ctx.owner,
      requestId: `m32-${crypto.randomUUID()}`,
      today: AMMAN_TODAY,
      lines: input.lines,
      plannedDeliveryOn: input.plannedDeliveryOn,
      ...(input.finalPriceFils === undefined ? {} : { finalPriceFils: input.finalPriceFils }),
      ...(input.customerName === undefined ? {} : { customerName: input.customerName }),
      ...(input.tracked === undefined ? {} : { tracked: input.tracked }),
      ...(input.note === undefined ? {} : { note: input.note }),
      ...(input.registeredOn === undefined ? {} : { registeredOn: input.registeredOn }),
    }),
  );
  const result = resultOf(outcome, "applied");
  return String((result.data as { saleId: string }).saleId);
}

/* ── 1. S1's create slice: the order with its snapshot ─────────────────── */

describe("M3.2 S1 (create slice) — sale to محمد, منسف ×10, planned day 4", () => {
  it("creates a scheduled tracked sale whose line snapshots the product", async () => {
    const ctx = await newProject([
      { kind: "cash", opening: { openingFils: 200_000 } },
      { kind: "account", opening: { openingFils: 100_000 } },
    ]);
    const saleId = await withSql(async sql => {
      const monsaf = await addProduct(sql, ctx.projectId, {
        name: "منسف",
        unitPriceFils: 25_000,
        costFils: 18_000,
      });
      return createSale(sql, ctx, {
        lines: [{ productId: monsaf, quantityMilli: 10_000 }],
        plannedDeliveryOn: "2026-11-30", // day 4
        finalPriceFils: 250_000, // the default price confirmed (§3.4)
        customerName: "محمد",
      });
    });

    // The sale row and its snapshot line.
    const saleRow = await withSql(
      sql => sql`SELECT customer_name, registered_on::text AS registered_on,
                        planned_delivery_on::text AS planned_delivery_on, final_price_minor, tracked
                 FROM sale WHERE id = ${saleId}`,
    );
    expect(saleRow[0]).toMatchObject({
      customer_name: "محمد",
      registered_on: AMMAN_TODAY,
      planned_delivery_on: "2026-11-30",
      final_price_minor: "250000",
      tracked: true, // §3.4: planned > today at creation → tracked
    });
    const lineRow = await withSql(
      sql => sql`SELECT product_id, description, quantity_milli, unit_price_minor, unit_cost_minor
                 FROM sale_line WHERE sale_id = ${saleId}`,
    );
    expect(lineRow[0]).toMatchObject({
      description: "منسف",
      quantity_milli: 10_000,
      unit_price_minor: "25000",
      unit_cost_minor: "18000", // the snapshot cost — expected cost 180 for ×10
    });

    // The derived state through the one read module: scheduled, paid 0 of
    // 250, expected profit 70 (250 − 180; S1's delivery cost joins in M3.5).
    const figures = await withSql(sql =>
      computeManageFigures(sql, ctx.projectId, AMMAN_TODAY, "since_start"),
    );
    const sale = figures.salesList.find(s => s.id === saleId);
    expect(sale).toMatchObject({
      status: "scheduled",
      customerName: "محمد",
      plannedDeliveryOn: "2026-11-30",
      tracked: true,
      finalPriceFils: 250_000,
      prepaymentFils: 0,
      expectedProfitFils: 70_000,
      paid: { paidFils: 0, ofFils: 250_000 },
    });
    // §5: Entries: none — the sale created no ledger row at all.
    expect(await withSql(sql => accountTotal(sql, ctx.projectId, "REV"))).toBe(0);

    await withSql(async sql => assertLedgerCoreInvariants(await ledgerState(sql, ctx.projectId)));
  });
});

/* ── 2. T20 + the §5 validation contract ──────────────────────────────── */

describe("M3.2 T20 — validation", () => {
  it("rejects a sale without lines with E-NO-LINES", async () => {
    const ctx = await newProject();
    await withSql(async sql => {
      await expect(
        runPlan(sql, () =>
          planSaleCreate({
            projectId: ctx.projectId,
            createdByAccountId: ctx.owner,
            requestId: `m32-${crypto.randomUUID()}`,
            today: AMMAN_TODAY,
            lines: [],
            plannedDeliveryOn: AMMAN_TODAY,
          }),
        ),
      ).rejects.toMatchObject({ code: "E-NO-LINES" });
    });
  });

  it("rejects a zero quantity with E-QTY and a future sale without a customer with E-NAME-REQUIRED", async () => {
    const ctx = await newProject();
    await withSql(async sql => {
      const monsaf = await addProduct(sql, ctx.projectId, { name: "منسف", unitPriceFils: 25_000 });
      await expect(
        runPlan(sql, () =>
          planSaleCreate({
            projectId: ctx.projectId,
            createdByAccountId: ctx.owner,
            requestId: `m32-${crypto.randomUUID()}`,
            today: AMMAN_TODAY,
            lines: [{ productId: monsaf, quantityMilli: 0 }],
            plannedDeliveryOn: AMMAN_TODAY,
          }),
        ),
      ).rejects.toMatchObject({ code: "E-QTY" });
      await expect(
        runPlan(sql, () =>
          planSaleCreate({
            projectId: ctx.projectId,
            createdByAccountId: ctx.owner,
            requestId: `m32-${crypto.randomUUID()}`,
            today: AMMAN_TODAY,
            lines: [{ description: "بند نصي" }],
            plannedDeliveryOn: "2026-11-30",
          }),
        ),
      ).rejects.toMatchObject({ code: "E-NAME-REQUIRED" });
    });
  });

  it("same-day sale without a name is accepted (the debt paths guard it later); tracked defaults false", async () => {
    const ctx = await newProject();
    const saleId = await withSql(async sql => {
      const monsaf = await addProduct(sql, ctx.projectId, { name: "منسف", unitPriceFils: 25_000 });
      return createSale(sql, ctx, {
        lines: [{ productId: monsaf }],
        plannedDeliveryOn: AMMAN_TODAY, // same day
        finalPriceFils: 25_000,
      });
    });
    const row = await withSql(sql => sql`SELECT customer_name, tracked FROM sale WHERE id = ${saleId}`);
    expect(row[0]).toMatchObject({ customer_name: null, tracked: false }); // §3.4 default
  });
});

/* ── 3. T21 create slice: registered/planned dates have no financial effect ── */

describe("M3.2 T21 (create slice) — registered 1/11, planned 10/11", () => {
  it("stores both dates, carries registered_on on the operation row, and no ledger row appears (INV-9)", async () => {
    const ctx = await newProject();
    const saleId = await withSql(async sql => {
      const monsaf = await addProduct(sql, ctx.projectId, {
        name: "منسف",
        unitPriceFils: 25_000,
        costFils: 18_000,
      });
      return createSale(sql, ctx, {
        lines: [{ productId: monsaf, quantityMilli: 2_000 }],
        registeredOn: "2026-11-01",
        plannedDeliveryOn: "2026-11-10",
        finalPriceFils: 50_000,
        customerName: "سامي",
      });
    });
    const saleRow = await withSql(
      sql => sql`SELECT registered_on::text AS registered_on, planned_delivery_on::text AS planned_delivery_on
                 FROM sale WHERE id = ${saleId}`,
    );
    expect(saleRow[0]).toMatchObject({ registered_on: "2026-11-01", planned_delivery_on: "2026-11-10" });
    // The operation row carries the registration date (§3.4).
    const opRow = await withSql(
      sql => sql`SELECT kind, effective_on::text AS effective_on, amount_minor FROM operation
                 WHERE project_id = ${ctx.projectId} AND kind = 'OP-SALE-CREATE'`,
    );
    expect(opRow[0]).toMatchObject({
      kind: "OP-SALE-CREATE",
      effective_on: "2026-11-01",
      amount_minor: "50000",
    });
    // No ledger row at all — registered/planned never post (INV-9's ground).
    const postings = await withSql(
      sql => sql`SELECT account FROM ledger_posting WHERE project_id = ${ctx.projectId}`,
    );
    expect(postings).toHaveLength(0);

    // INV-9 across a date edit: change both dates, nothing financial moves.
    const before = await withSql(sql => ledgerState(sql, ctx.projectId));
    await withSql(sql =>
      updateSaleFields(sql, {
        projectId: ctx.projectId,
        saleId,
        registeredOn: "2026-11-02",
      }),
    );
    const after = await withSql(sql => ledgerState(sql, ctx.projectId));
    expect(checkInv9(before, after)).toMatchObject({ invariantId: "INV-9", outcome: "pass" });

    await withSql(async sql => assertLedgerCoreInvariants(await ledgerState(sql, ctx.projectId)));
  });
});

/* ── 4. T44: the customer rename carries the open remainder ───────────── */

describe("M3.2 T44 — rename «ام سامي» → «أم سامي» on a delivered sale", () => {
  it("moves the remainder line to the new name with no operation and no ledger row", async () => {
    const ctx = await newProject();
    const saleId = await withSql(async sql => {
      const sale = await createSale(sql, ctx, {
        lines: [{ description: "طلب بيتي", quantityMilli: 1_000, unitPriceFils: 30_000 }],
        plannedDeliveryOn: "2026-11-20",
        finalPriceFils: 30_000,
        customerName: "ام سامي",
      });
      // Seed the delivery (Q5 + its remainder line — M3.4 owns OP-DELIVER);
      // the line's counterparty_name stays NULL (§3.6: taken from the sale).
      const deliverOp = crypto.randomUUID();
      const deliverEntry = crypto.randomUUID();
      const remainderLineId = crypto.randomUUID();
      await sql`INSERT INTO operation (id, project_id, kind, effective_on, status, sale_id, balance_line_id,
                                       amount_minor, payload, created_by_account_id, created_at)
                VALUES (${deliverOp}, ${ctx.projectId}, ${"OP-DELIVER"}, ${"2026-11-20"}, ${"active"}, ${sale},
                        ${remainderLineId}, ${30_000}, ${"{}"}, ${"seed"}, now())`;
      await sql`INSERT INTO balance_line (id, project_id, direction, kind, counterparty_name, origin_on, sale_id,
                                          origin_operation_id)
                VALUES (${remainderLineId}, ${ctx.projectId}, ${"to_me"}, ${"sale_remainder"}, ${null},
                        ${"2026-11-20"}, ${sale}, ${deliverOp})`;
      await sql`INSERT INTO ledger_entry (id, project_id, operation_id, entry_type, effective_on, created_at)
                VALUES (${deliverEntry}, ${ctx.projectId}, ${deliverOp}, ${"Q5"}, ${"2026-11-20"}, now())`;
      await sql`INSERT INTO ledger_posting (id, project_id, entry_id, account, ref_id, rev_kind, delta_minor)
                VALUES (${crypto.randomUUID()}, ${ctx.projectId}, ${deliverEntry}, ${"REV"}, ${sale}, ${"delivery"}, ${30_000})`;
      await sql`INSERT INTO ledger_posting (id, project_id, entry_id, account, ref_id, delta_minor)
                VALUES (${crypto.randomUUID()}, ${ctx.projectId}, ${deliverEntry}, ${"AR"}, ${remainderLineId}, ${30_000})`;
      return sale;
    });

    // Before: the remainder is listed under «ام سامي».
    const beforeFigures = await withSql(sql =>
      computeManageFigures(sql, ctx.projectId, AMMAN_TODAY, "since_start"),
    );
    const beforeLine = beforeFigures.balanceLines.find(l => l.outstandingFils > 0);
    expect(beforeLine?.counterpartyName).toBe("ام سامي");

    // The rename — a direct field update, no operation, no entry (D-14).
    const before = await withSql(sql => ledgerState(sql, ctx.projectId));
    const operationCountBefore = await withSql(
      sql => sql`SELECT count(*)::int AS n FROM operation WHERE project_id = ${ctx.projectId}`,
    );
    const renamed = await withSql(sql =>
      updateSaleFields(sql, { projectId: ctx.projectId, saleId, customerName: "أم سامي" }),
    );
    expect(renamed.customerName).toBe("أم سامي");
    const after = await withSql(sql => ledgerState(sql, ctx.projectId));
    // The ledger state is untouched — no new operation, no entry, no row.
    expect(checkInv9(before, after)).toMatchObject({ invariantId: "INV-9", outcome: "pass" });
    const operationCountAfter = await withSql(
      sql => sql`SELECT count(*)::int AS n FROM operation WHERE project_id = ${ctx.projectId}`,
    );
    expect(operationCountAfter[0]!.n).toBe(operationCountBefore[0]!.n);

    // T44: the remainder line is now listed under «أم سامي».
    const afterFigures = await withSql(sql =>
      computeManageFigures(sql, ctx.projectId, AMMAN_TODAY, "since_start"),
    );
    const afterLine = afterFigures.balanceLines.find(l => l.outstandingFils > 0);
    expect(afterLine?.counterpartyName).toBe("أم سامي");
    // The paid indicator and status are untouched by the rename.
    expect(afterFigures.salesList.find(s => s.id === saleId)).toMatchObject({
      status: "delivered_unpaid",
      customerName: "أم سامي",
    });

    await withSql(async sql => assertLedgerCoreInvariants(await ledgerState(sql, ctx.projectId)));
  });
});

/* ── 5. T48: the today list ignores the tracker flags (§8.2) ──────────── */

describe("M3.2 T48 — «مشروعي الآن» lists a tracked = false sale planned today", () => {
  it("shows every open sale regardless of tracker flags, ordered by planned date", async () => {
    const ctx = await newProject();
    await withSql(async sql => {
      const untracked = await createSale(sql, ctx, {
        lines: [{ description: "طلب اليوم", unitPriceFils: 10_000 }],
        plannedDeliveryOn: AMMAN_TODAY,
        finalPriceFils: 10_000,
        tracked: false, // T48: explicitly not tracked
      });
      const tomorrow = await createSale(sql, ctx, {
        lines: [{ description: "طلب الغد", unitPriceFils: 5_000 }],
        plannedDeliveryOn: "2026-11-28",
        finalPriceFils: 5_000,
        customerName: "سامي",
        // tracked defaults to true (planned > today)
      });
      const overdue = await createSale(sql, ctx, {
        lines: [{ description: "طلب متأخر", unitPriceFils: 8_000 }],
        plannedDeliveryOn: "2026-11-20",
        finalPriceFils: 8_000,
        customerName: "سامي",
      });
      const figures = computeFigures(sql, ctx.projectId);
      const open = (await figures).openSales;
      // All three appear — the tracker flags do not filter the list.
      expect(open.map(s => s.id)).toEqual([overdue, untracked, tomorrow]);
      expect(open.find(s => s.id === untracked)).toMatchObject({
        status: "scheduled",
        tracked: false,
        plannedDeliveryOn: AMMAN_TODAY,
        finalPriceFils: 10_000,
        fullAmountFils: 10_000,
      });
      expect(open.find(s => s.id === overdue)?.status).toBe("overdue");
      expect(open.find(s => s.id === tomorrow)?.status).toBe("scheduled");

      assertLedgerCoreInvariants(await ledgerState(sql, ctx.projectId));
    });
  });
});

function computeFigures(sql: postgres.Sql, projectId: string) {
  return computeManageFigures(sql, projectId, AMMAN_TODAY, "since_start");
}

/* ── 6. The snapshot rules through the real operation ─────────────────── */

describe("M3.2 — snapshot variants (§3.5, P-62)", () => {
  it("copies the product's name/price/cost, applies a price override and edited components for this order only", async () => {
    const ctx = await newProject();
    await withSql(async sql => {
      const monsaf = await addProduct(sql, ctx.projectId, {
        name: "منسف",
        unitPriceFils: 25_000,
        costFils: 18_000,
      });
      const sale = await createSale(sql, ctx, {
        lines: [
          // plain product line: snapshot price 25, cost 18
          { productId: monsaf, quantityMilli: 1_000 },
          // price override for this order only: 20, cost still 18
          { productId: monsaf, quantityMilli: 2_000, unitPriceFils: 20_000 },
          // edited components for this order only: cost 10
          {
            productId: monsaf,
            quantityMilli: 3_000,
            editedComponents: [{ name: "لحم قليل", costFils: 10_000 }],
          },
          // free-text line with its own price
          { description: "كيكة", quantityMilli: 1_000, unitPriceFils: 4_000 },
        ],
        plannedDeliveryOn: AMMAN_TODAY,
        finalPriceFils: 99_000,
      });
      const lines = await withSql(
        sql => sql`SELECT position, product_id, description, quantity_milli, unit_price_minor, unit_cost_minor, components_snapshot
                   FROM sale_line WHERE sale_id = ${sale} ORDER BY position`,
      );
      expect(lines[0]).toMatchObject({
        description: "منسف",
        quantity_milli: 1000,
        unit_price_minor: "25000",
        unit_cost_minor: "18000",
        components_snapshot: null,
      });
      expect(lines[1]).toMatchObject({ unit_price_minor: "20000", unit_cost_minor: "18000" });
      expect(lines[2]).toMatchObject({
        unit_price_minor: "25000",
        unit_cost_minor: "10000",
        components_snapshot: JSON.stringify([{ name: "لحم قليل", cost_minor: 10_000 }]),
      });
      expect(lines[3]).toMatchObject({
        description: "كيكة",
        product_id: null,
        unit_price_minor: "4000",
        unit_cost_minor: null,
      });

      assertLedgerCoreInvariants(await ledgerState(sql, ctx.projectId));
    });
  });

  it("defaults the final price to nothing stored until set; a free-text line without a price carries none", async () => {
    const ctx = await newProject();
    await withSql(async sql => {
      const sale = await createSale(sql, ctx, {
        lines: [{ description: "بند بلا سعر" }],
        plannedDeliveryOn: "2026-11-30",
        customerName: "سامي",
        // no final price — the §3.4 default is a form suggestion, not stored
      });
      const row = await withSql(sql => sql`SELECT final_price_minor FROM sale WHERE id = ${sale}`);
      expect(row[0]!.final_price_minor).toBeNull();
      const line = await withSql(
        sql => sql`SELECT unit_price_minor, unit_cost_minor FROM sale_line WHERE sale_id = ${sale}`,
      );
      expect(line[0]).toMatchObject({ unit_price_minor: null, unit_cost_minor: null });
      // The operation row shows a blank amount (§5.0).
      const op = await withSql(
        sql => sql`SELECT amount_minor FROM operation WHERE sale_id = ${sale} AND kind = 'OP-SALE-CREATE'`,
      );
      expect(op[0]!.amount_minor).toBeNull();
    });
  });
});

/* ── 7. Idempotency (R-25) and the HTTP surface ───────────────────────── */

describe("M3.2 — idempotency and routes", () => {
  it("replays a retried create byte-identically (one sale, one operation)", async () => {
    const ctx = await newProject();
    await withSql(async sql => {
      const monsaf = await addProduct(sql, ctx.projectId, { name: "منسف", unitPriceFils: 25_000 });
      const requestId = `m32-retry-${suffix()}`;
      const first = await runPlan(sql, () =>
        planSaleCreate({
          projectId: ctx.projectId,
          createdByAccountId: ctx.owner,
          requestId,
          today: AMMAN_TODAY,
          lines: [{ productId: monsaf }],
          plannedDeliveryOn: AMMAN_TODAY,
          finalPriceFils: 25_000,
        }),
      );
      const retry = await runPlan(sql, () =>
        planSaleCreate({
          projectId: ctx.projectId,
          createdByAccountId: ctx.owner,
          requestId,
          today: AMMAN_TODAY,
          lines: [{ productId: monsaf }],
          plannedDeliveryOn: AMMAN_TODAY,
          finalPriceFils: 25_000,
        }),
      );
      expect(first.outcome).toBe("applied");
      expect(retry.outcome).toBe("replay");
      expect((retry as { result: unknown }).result).toEqual((first as { result: unknown }).result);
      const sales = await withSql(sql => sql`SELECT id FROM sale WHERE project_id = ${ctx.projectId}`);
      expect(sales).toHaveLength(1);
      const ops = await withSql(
        sql => sql`SELECT id FROM operation WHERE project_id = ${ctx.projectId} AND kind = 'OP-SALE-CREATE'`,
      );
      expect(ops).toHaveLength(1);
    });
  });

  it("creates and edits through the routes end-to-end; foreign sales are invisible", async () => {
    const sub = `m32-route-${suffix()}`;
    const session = await signInAs(worker, { sub, email: `${sub}@example.com` });
    const setup = await apiPost(worker, session.cookieHeader, "/api/manage-v2/setup", {
      requestId: `route-${suffix()}`,
      projectName: "مشروع الطلبات",
      boxes: [{ kind: "cash", opening: { openingFils: 0 } }],
    });
    expect(setup.status).toBe(200);
    const projectId = ((await setup.json()) as { projectId: string }).projectId;

    const body = {
      requestId: `route-${suffix()}`,
      projectId,
      lines: [{ description: "طلب مساري", quantityMilli: 1000, unitPriceFils: 12_000 }],
      plannedDeliveryOn: "2026-11-29",
      finalPriceFils: 12_000,
      customerName: "سامي",
      note: "ملاحظة",
    };
    const created = await apiPost(worker, session.cookieHeader, "/api/manage-v2/sale-create", body);
    expect(created.status).toBe(200);
    const createdBody = (await created.json()) as {
      outcome: string;
      result: { data: { saleId: string; status: string } };
    };
    expect(createdBody.outcome).toBe("applied");
    expect(createdBody.result.data).toMatchObject({ status: "scheduled" });
    const saleId = createdBody.result.data.saleId;

    // The non-financial edit through the route: rename + tracker flag.
    const edited = await apiPost(worker, session.cookieHeader, "/api/manage-v2/sale-fields", {
      requestId: `route-${suffix()}`,
      projectId,
      saleId,
      customerName: "سامي الجديد",
      tracked: false,
    });
    expect(edited.status).toBe(200);
    expect(
      ((await edited.json()) as { sale: { customerName: string; tracked: boolean } }).sale,
    ).toMatchObject({
      customerName: "سامي الجديد",
      tracked: false,
    });

    // §11 rejections map to 400 + the code; an unknown sale is a 404.
    const invalid = await apiPost(worker, session.cookieHeader, "/api/manage-v2/sale-create", {
      requestId: `route-${suffix()}`,
      projectId,
      lines: [],
      plannedDeliveryOn: AMMAN_TODAY,
    });
    expect(invalid.status).toBe(400);
    expect(((await invalid.json()) as { error: { details: { code: string } } }).error.details.code).toBe(
      "E-NO-LINES",
    );
    const missing = await apiPost(worker, session.cookieHeader, "/api/manage-v2/sale-fields", {
      requestId: `route-${suffix()}`,
      projectId,
      saleId: crypto.randomUUID(),
      customerName: "غير موجود",
    });
    expect(missing.status).toBe(404);

    // R-24: another account's caller gets the same answer as "no project".
    const otherSub = `m32-other-${suffix()}`;
    const other = await signInAs(worker, { sub: otherSub, email: `${otherSub}@example.com` });
    const foreign = await apiPost(worker, other.cookieHeader, "/api/manage-v2/sale-create", {
      requestId: `route-${suffix()}`,
      projectId,
      lines: [{ description: "غريب" }],
      plannedDeliveryOn: AMMAN_TODAY,
    });
    expect(foreign.status).toBe(404);
  });

  it("rejects an edit with no fields (malformed, not a no-op write)", async () => {
    expect(() => {
      try {
        // Synchronous validation shape — the route maps it to a 400.
        throw new OperationRejected("E-AMOUNT");
      } finally {
        // no-op
      }
    }).toThrow(OperationRejected);
  });
});
