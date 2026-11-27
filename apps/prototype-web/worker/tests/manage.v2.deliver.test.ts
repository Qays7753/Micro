/**
 * M3.4 acceptance (Manage v2 phase 3 — spec §5 OP-DELIVER, §4 Q5, §6
 * transitions, R-13/R-26/R-28; tests S1 delivery slice, T1 delivery half,
 * T2/T3 delivery+collect slices, T17 pre-undo slice, T40 E-DATE-ORDER,
 * T49 backdated default, T57 prepayment-constrained default): deliver the
 * sale at its final price — Q5 posts REV +P (dated the actual delivery
 * date), consumes PRE, and opens the remainder or the customer_refund
 * line; the optional immediate collection is a SEPARATE OP-COLLECT
 * operation created together atomically (one transaction, one reservation,
 * R-28's grouped row).
 *
 * Tests-first: this file was written before the operation existed and fails
 * with "Cannot find module … operations/deliver.js".
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
  const owner = `m34-owner-${suffix()}`;
  await withSql(sql => setupProject(sql, { projectId, owner, today: AMMAN_TODAY, boxes }));
  return { projectId, owner };
}

interface SaleSeed {
  plannedDeliveryOn: string;
  finalPriceFils: number;
  customerName?: string;
  registeredOn?: string;
  monsaf?: boolean;
  prepaymentFils?: number;
  prepaymentOn?: string;
}

/** A sale (+ optional prepayment) through the real M3.2/M3.3 operations. */
async function createSale(
  sql: postgres.Sql,
  ctx: { projectId: string; owner: string },
  seed: SaleSeed,
): Promise<string> {
  let productId: string | undefined;
  if (seed.monsaf === true) {
    productId = (
      await saveProduct(sql, {
        projectId: ctx.projectId,
        productId: crypto.randomUUID(),
        name: "منسف",
        unitPriceFils: 25_000,
        components: [{ name: "لحم", costFils: 18_000 }],
      })
    ).productId;
  }
  const outcome = await runPlan(sql, () =>
    planSaleCreate({
      projectId: ctx.projectId,
      createdByAccountId: ctx.owner,
      requestId: `m34-${crypto.randomUUID()}`,
      today: AMMAN_TODAY,
      lines: [
        productId === undefined
          ? { description: "طلب", quantityMilli: 1000, unitPriceFils: seed.finalPriceFils }
          : { productId, quantityMilli: 10_000 },
      ],
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
        requestId: `m34-${crypto.randomUUID()}`,
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

/** Deliver through the real composition. */
async function deliver(
  sql: postgres.Sql,
  ctx: { projectId: string; owner: string },
  input: { saleId: string; actualOn?: string; collectFils?: number; collectBox?: "cash" | "account" },
) {
  return runPlan(sql, () =>
    planDeliver({
      projectId: ctx.projectId,
      createdByAccountId: ctx.owner,
      requestId: `m34-${crypto.randomUUID()}`,
      today: AMMAN_TODAY,
      saleId: input.saleId,
      ...(input.actualOn === undefined ? {} : { actualDeliveryOn: input.actualOn }),
      ...(input.collectFils === undefined
        ? {}
        : { collection: { amountFils: input.collectFils, box: input.collectBox ?? "cash" } }),
    }),
  );
}

/* ── 1. The plain delivery: Q5, remainder, status, dating ─────────────── */

describe("M3.4 — OP-DELIVER posts Q5 and opens the remainder (§4/§6)", () => {
  it("delivers at the final price: REV dated the actual date, remainder open, status delivered_unpaid", async () => {
    const ctx = await newProject();
    const saleId = await withSql(sql =>
      createSale(sql, ctx, {
        plannedDeliveryOn: "2026-11-25",
        finalPriceFils: 100_000,
        customerName: "سامي",
      }),
    );
    const outcome = await withSql(sql => deliver(sql, ctx, { saleId, actualOn: "2026-11-26" }));
    const result = resultOf(outcome, "applied");
    expect(result.kind).toBe("OP-DELIVER");
    expect((result.data as { status: string }).status).toBe("delivered_unpaid");

    // Q5: REV +100 dated 26/11; the remainder line carries 100.
    expect(await withSql(sql => accountTotal(sql, ctx.projectId, "REV"))).toBe(100_000);
    const revRow = await withSql(
      sql => sql`SELECT effective_on::text AS effective_on FROM ledger_entry
                 WHERE project_id = ${ctx.projectId} AND entry_type = 'Q5'`,
    );
    expect(revRow[0]!.effective_on).toBe("2026-11-26");
    const remainder = await withSql(
      sql => sql`SELECT kind, direction, counterparty_name FROM balance_line
                 WHERE project_id = ${ctx.projectId} AND sale_id = ${saleId}`,
    );
    expect(remainder[0]).toMatchObject({
      kind: "sale_remainder",
      direction: "to_me",
      counterparty_name: null,
    });
    expect(await withSql(sql => accountTotal(sql, ctx.projectId, "AR"))).toBe(100_000);

    const figures = await withSql(sql =>
      computeManageFigures(sql, ctx.projectId, AMMAN_TODAY, "since_start"),
    );
    expect(figures.salesList.find(s => s.id === saleId)).toMatchObject({
      status: "delivered_unpaid",
      deliveredOn: "2026-11-26",
      netSaleRevenueFils: 100_000,
      paid: { paidFils: 0, ofFils: 100_000 },
    });
    expect(figures.receivables.fils).toBe(100_000);

    await withSql(async sql => assertLedgerCoreInvariants(await ledgerState(sql, ctx.projectId)));
  });

  it("consumes the prepayment: P 250 with p 50 → remainder 200 and PRE 0 (S1's figures at delivery)", async () => {
    const ctx = await newProject([
      { kind: "cash", opening: { openingFils: 200_000 } },
      { kind: "account", opening: { openingFils: 100_000 } },
    ]);
    const saleId = await withSql(sql =>
      createSale(sql, ctx, {
        plannedDeliveryOn: "2026-11-27",
        finalPriceFils: 250_000,
        customerName: "محمد",
        registeredOn: "2026-11-24",
        prepaymentFils: 50_000,
        prepaymentOn: "2026-11-24",
      }),
    );
    await withSql(sql => deliver(sql, ctx, { saleId, actualOn: "2026-11-27" }));

    expect(await withSql(sql => accountTotal(sql, ctx.projectId, "PRE"))).toBe(0);
    expect(await withSql(sql => accountTotal(sql, ctx.projectId, "AR"))).toBe(200_000);
    const figures = await withSql(sql =>
      computeManageFigures(sql, ctx.projectId, AMMAN_TODAY, "since_start"),
    );
    expect(figures.salesList.find(s => s.id === saleId)).toMatchObject({
      status: "delivered_unpaid",
      paid: { paidFils: 50_000, ofFils: 250_000 },
    });

    await withSql(async sql => assertLedgerCoreInvariants(await ledgerState(sql, ctx.projectId)));
  });
});

/* ── 2. T1's delivery half: prepayment 60, price 50 → customer_refund 10 ── */

describe("M3.4 T1 (delivery half) — deliver at 50 with PRE 60", () => {
  it("posts REV +50, opens a customer_refund line of 10; profit +50", async () => {
    const ctx = await newProject();
    const saleId = await withSql(sql =>
      createSale(sql, ctx, {
        plannedDeliveryOn: AMMAN_TODAY,
        finalPriceFils: 50_000,
        prepaymentFils: 60_000,
      }),
    );
    await withSql(sql => deliver(sql, ctx, { saleId, actualOn: AMMAN_TODAY }));

    expect(await withSql(sql => accountTotal(sql, ctx.projectId, "REV"))).toBe(50_000);
    expect(await withSql(sql => accountTotal(sql, ctx.projectId, "PRE"))).toBe(0);
    expect(await withSql(sql => accountTotal(sql, ctx.projectId, "AP"))).toBe(10_000);
    const refund = await withSql(
      sql =>
        sql`SELECT kind, direction FROM balance_line WHERE project_id = ${ctx.projectId} AND sale_id = ${saleId}`,
    );
    expect(refund[0]).toMatchObject({ kind: "customer_refund", direction: "by_me" });
    const figures = await withSql(sql =>
      computeManageFigures(sql, ctx.projectId, AMMAN_TODAY, "since_start"),
    );
    expect(figures.netProfit.fils).toBe(50_000); // profit +50
    expect(figures.payables.fils).toBe(10_000);

    await withSql(async sql => assertLedgerCoreInvariants(await ledgerState(sql, ctx.projectId)));
  });
});

/* ── 3. The immediate collection: two operations, one transaction ─────── */

describe("M3.4 — the immediate collection (§5, R-28's two operations)", () => {
  it("creates OP-DELIVER and OP-COLLECT together; both correctable rows, one atomic request", async () => {
    const ctx = await newProject([{ kind: "cash", opening: { openingFils: 0 } }]);
    const saleId = await withSql(sql =>
      createSale(sql, ctx, {
        plannedDeliveryOn: AMMAN_TODAY,
        finalPriceFils: 100_000,
        customerName: "سامي",
      }),
    );
    const outcome = await withSql(sql =>
      deliver(sql, ctx, { saleId, collectFils: 30_000, collectBox: "cash" }),
    );
    const result = resultOf(outcome, "applied");
    // The response names BOTH operations (the request's whole effect).
    const data = result.data as { companion: { kind: string } };
    expect(data.companion).toMatchObject({ kind: "OP-COLLECT" });

    // T2/T3's delivery slices: remainder 70 after collecting 30.
    expect(await withSql(sql => accountTotal(sql, ctx.projectId, "AR"))).toBe(70_000);
    expect(await withSql(sql => boxBalance(sql, ctx.projectId, "cash"))).toBe(30_000);
    const ops = await withSql(
      sql =>
        sql`SELECT kind FROM operation WHERE project_id = ${ctx.projectId} AND kind IN ('OP-DELIVER','OP-COLLECT')`,
    );
    // Both rows exist — one of each (the same-transaction timestamps make
    // the created_at order non-deterministic; the pair is the assertion).
    expect(ops.map(o => o.kind).sort()).toEqual(["OP-COLLECT", "OP-DELIVER"]);
    // The collection is dated the actual delivery date (R-26).
    const collectEntry = await withSql(
      sql => sql`SELECT e.effective_on::text AS effective_on FROM ledger_entry e
                 JOIN operation o ON o.id = e.operation_id
                 WHERE o.project_id = ${ctx.projectId} AND o.kind = 'OP-COLLECT'`,
    );
    expect(collectEntry[0]!.effective_on).toBe(AMMAN_TODAY);

    const figures = await withSql(sql =>
      computeManageFigures(sql, ctx.projectId, AMMAN_TODAY, "since_start"),
    );
    expect(figures.salesList.find(s => s.id === saleId)).toMatchObject({
      status: "delivered_unpaid",
      paid: { paidFils: 30_000, ofFils: 100_000 },
    });

    await withSql(async sql => assertLedgerCoreInvariants(await ledgerState(sql, ctx.projectId)));
  });

  it("replays a retried deliver+collect byte-identically (one of each operation)", async () => {
    const ctx = await newProject();
    await withSql(async sql => {
      const saleId = await createSale(sql, ctx, {
        plannedDeliveryOn: AMMAN_TODAY,
        finalPriceFils: 80_000,
        customerName: "سامي",
      });
      const requestId = `m34-retry-${suffix()}`;
      const make = () =>
        planDeliver({
          projectId: ctx.projectId,
          createdByAccountId: ctx.owner,
          requestId,
          today: AMMAN_TODAY,
          saleId,
          collection: { amountFils: 80_000, box: "cash" },
        });
      const first = await runPlan(sql, make);
      const retry = await runPlan(sql, make);
      expect(first.outcome).toBe("applied");
      expect(retry.outcome).toBe("replay");
      expect((retry as { result: unknown }).result).toEqual((first as { result: unknown }).result);
      const counts = await sql`SELECT kind, count(*)::int AS n FROM operation
                               WHERE project_id = ${ctx.projectId} AND kind IN ('OP-DELIVER','OP-COLLECT')
                               GROUP BY kind`;
      expect(counts).toEqual([
        { kind: "OP-COLLECT", n: 1 },
        { kind: "OP-DELIVER", n: 1 },
      ]);
      // Fully collected → completed (§6).
      const figures = await computeManageFigures(sql, ctx.projectId, AMMAN_TODAY, "since_start");
      expect(figures.salesList.find(s => s.id === saleId)?.status).toBe("completed");
    });
  });
});

/* ── 4. T17's pre-undo slice + the full collected path ────────────────── */

describe("M3.4 T17 (pre-undo slice) — sale 100, prepay 20, deliver, collect 50", () => {
  it("leaves REV 100, remainder 30, cash 70, status delivered_unpaid (the undo is M3.9)", async () => {
    const ctx = await newProject();
    const saleId = await withSql(sql =>
      createSale(sql, ctx, {
        plannedDeliveryOn: "2026-11-25",
        finalPriceFils: 100_000,
        customerName: "سامي",
        prepaymentFils: 20_000,
      }),
    );
    await withSql(sql => deliver(sql, ctx, { saleId, collectFils: 50_000 }));

    expect(await withSql(sql => accountTotal(sql, ctx.projectId, "REV"))).toBe(100_000);
    expect(await withSql(sql => accountTotal(sql, ctx.projectId, "PRE"))).toBe(0);
    expect(await withSql(sql => accountTotal(sql, ctx.projectId, "AR"))).toBe(30_000);
    expect(await withSql(sql => boxBalance(sql, ctx.projectId, "cash"))).toBe(70_000);
    const figures = await withSql(sql =>
      computeManageFigures(sql, ctx.projectId, AMMAN_TODAY, "since_start"),
    );
    expect(figures.salesList.find(s => s.id === saleId)).toMatchObject({
      status: "delivered_unpaid",
      paid: { paidFils: 70_000, ofFils: 100_000 },
    });

    await withSql(async sql => assertLedgerCoreInvariants(await ledgerState(sql, ctx.projectId)));
  });
});

/* ── 5. T49 + T57: the default actual date; T40: E-DATE-ORDER ─────────── */

describe("M3.4 T49/T57/T40 — the actual delivery date rules", () => {
  it("T49: planned yesterday, no prepayments → default actual = yesterday; REV dated yesterday", async () => {
    const ctx = await newProject();
    const saleId = await withSql(sql =>
      createSale(sql, ctx, {
        plannedDeliveryOn: "2026-11-26", // yesterday
        finalPriceFils: 50_000,
        customerName: "سامي",
      }),
    );
    await withSql(sql => deliver(sql, ctx, { saleId })); // no explicit date
    const revRow = await withSql(
      sql => sql`SELECT effective_on::text AS effective_on FROM ledger_entry
                 WHERE project_id = ${ctx.projectId} AND entry_type = 'Q5'`,
    );
    expect(revRow[0]!.effective_on).toBe("2026-11-26");
    const figures = await withSql(sql =>
      computeManageFigures(sql, ctx.projectId, AMMAN_TODAY, "since_start"),
    );
    expect(figures.salesList.find(s => s.id === saleId)?.deliveredOn).toBe("2026-11-26");
  });

  it("T57: planned 20/11, prepayment dated 22/11 → default actual 22/11; no E-DATE-ORDER", async () => {
    const ctx = await newProject();
    const saleId = await withSql(sql =>
      createSale(sql, ctx, {
        plannedDeliveryOn: "2026-11-20",
        finalPriceFils: 60_000,
        customerName: "سامي",
        prepaymentFils: 10_000,
        prepaymentOn: "2026-11-22",
      }),
    );
    await withSql(sql => deliver(sql, ctx, { saleId }));
    const revRow = await withSql(
      sql => sql`SELECT effective_on::text AS effective_on FROM ledger_entry
                 WHERE project_id = ${ctx.projectId} AND entry_type = 'Q5'`,
    );
    expect(revRow[0]!.effective_on).toBe("2026-11-22");
  });

  it("T40: prepayment dated 5/11, deliver at 3/11 → rejected E-DATE-ORDER", async () => {
    const ctx = await newProject();
    await withSql(async sql => {
      const saleId = await createSale(sql, ctx, {
        plannedDeliveryOn: "2026-11-04",
        finalPriceFils: 50_000,
        customerName: "سامي",
        prepaymentFils: 10_000,
        prepaymentOn: "2026-11-05",
      });
      await expect(deliver(sql, ctx, { saleId, actualOn: "2026-11-03" })).rejects.toMatchObject({
        code: "E-DATE-ORDER",
      });
    });
  });

  it("rejects an explicit future actual date with E-FUTURE-DATE", async () => {
    const ctx = await newProject();
    await withSql(async sql => {
      const saleId = await createSale(sql, ctx, {
        plannedDeliveryOn: AMMAN_TODAY,
        finalPriceFils: 50_000,
        customerName: "سامي",
      });
      await expect(deliver(sql, ctx, { saleId, actualOn: "2026-11-28" })).rejects.toMatchObject({
        code: "E-FUTURE-DATE",
      });
    });
  });
});

/* ── 6. The §5 validations: price, state, the nameless same-day rule ──── */

describe("M3.4 — OP-DELIVER validations (§5)", () => {
  it("rejects without a final price (E-PRICE-REQUIRED), twice-delivered and cancelled (E-SALE-STATE)", async () => {
    const ctx = await newProject();
    await withSql(async sql => {
      // A sale created WITHOUT a final price (§3.4: NULL until set).
      const unpriced = await runPlan(sql, () =>
        planSaleCreate({
          projectId: ctx.projectId,
          createdByAccountId: ctx.owner,
          requestId: `m34-${crypto.randomUUID()}`,
          today: AMMAN_TODAY,
          lines: [{ description: "طلب بلا سعر" }],
          plannedDeliveryOn: AMMAN_TODAY,
        }),
      );
      const unpricedId = String((resultOf(unpriced, "applied").data as { saleId: string }).saleId);
      await expect(deliver(sql, ctx, { saleId: unpricedId })).rejects.toMatchObject({
        code: "E-PRICE-REQUIRED",
      });
      const saleId = await createSale(sql, ctx, {
        plannedDeliveryOn: AMMAN_TODAY,
        finalPriceFils: 50_000,
        customerName: "سامي",
      });
      await deliver(sql, ctx, { saleId });
      await expect(deliver(sql, ctx, { saleId })).rejects.toMatchObject({ code: "E-SALE-STATE" });
      const other = await createSale(sql, ctx, {
        plannedDeliveryOn: "2026-11-30",
        finalPriceFils: 30_000,
        customerName: "سامي",
      });
      await sql`UPDATE sale SET cancelled_on = ${AMMAN_TODAY} WHERE id = ${other}`;
      await expect(deliver(sql, ctx, { saleId: other })).rejects.toMatchObject({ code: "E-SALE-STATE" });
      await expect(deliver(sql, ctx, { saleId: crypto.randomUUID() })).rejects.toMatchObject({
        code: "E-SALE-STATE",
      });
    });
  });

  it("a nameless same-day sale must collect the full remaining (E-NAME-REQUIRED-FOR-DEBT)", async () => {
    const ctx = await newProject();
    await withSql(async sql => {
      const saleId = await createSale(sql, ctx, { plannedDeliveryOn: AMMAN_TODAY, finalPriceFils: 30_000 });
      // Partial collection on a nameless sale → rejected.
      await expect(deliver(sql, ctx, { saleId, collectFils: 10_000 })).rejects.toMatchObject({
        code: "E-NAME-REQUIRED-FOR-DEBT",
      });
      // No collection at all → rejected too (the whole remainder stays open).
      await expect(deliver(sql, ctx, { saleId })).rejects.toMatchObject({
        code: "E-NAME-REQUIRED-FOR-DEBT",
      });
      // The full remaining → accepted and completed (T60's shape).
      const outcome = await deliver(sql, ctx, { saleId, collectFils: 30_000 });
      expect(resultOf(outcome, "applied").kind).toBe("OP-DELIVER");
      const figures = await computeManageFigures(sql, ctx.projectId, AMMAN_TODAY, "since_start");
      expect(figures.salesList.find(s => s.id === saleId)?.status).toBe("completed");
    });
  });

  it("a named sale may leave the remainder open; an immediate collection on a refund sale is rejected", async () => {
    const ctx = await newProject();
    await withSql(async sql => {
      const named = await createSale(sql, ctx, {
        plannedDeliveryOn: AMMAN_TODAY,
        finalPriceFils: 30_000,
        customerName: "سامي",
      });
      await deliver(sql, ctx, { saleId: named });
      const figures = await computeManageFigures(sql, ctx.projectId, AMMAN_TODAY, "since_start");
      expect(figures.salesList.find(s => s.id === named)?.status).toBe("delivered_unpaid");

      const refundSale = await createSale(sql, ctx, {
        plannedDeliveryOn: AMMAN_TODAY,
        finalPriceFils: 50_000,
        prepaymentFils: 60_000,
      });
      await expect(deliver(sql, ctx, { saleId: refundSale, collectFils: 5_000 })).rejects.toMatchObject({
        code: "E-AMOUNT",
      });
    });
  });
});

/* ── 7. The HTTP surface ──────────────────────────────────────────────── */

describe("M3.4 — route POST /api/manage-v2/deliver", () => {
  it("delivers (with the immediate collection) end-to-end; §11 rejections map to 400", async () => {
    const sub = `m34-route-${suffix()}`;
    const session = await signInAs(worker, { sub, email: `${sub}@example.com` });
    const setup = await apiPost(worker, session.cookieHeader, "/api/manage-v2/setup", {
      requestId: `route-${suffix()}`,
      projectName: "مشروع التسليم",
      boxes: [{ kind: "cash", opening: { openingFils: 0 } }],
    });
    expect(setup.status).toBe(200);
    const projectId = ((await setup.json()) as { projectId: string }).projectId;
    const created = await apiPost(worker, session.cookieHeader, "/api/manage-v2/sale-create", {
      requestId: `route-${suffix()}`,
      projectId,
      lines: [{ description: "طلب", unitPriceFils: 90_000 }],
      plannedDeliveryOn: AMMAN_TODAY,
      finalPriceFils: 90_000,
      customerName: "سامي",
    });
    const saleId = ((await created.json()) as { result: { data: { saleId: string } } }).result.data.saleId;

    const delivered = await apiPost(worker, session.cookieHeader, "/api/manage-v2/deliver", {
      requestId: `route-${suffix()}`,
      projectId,
      saleId,
      collection: { amountFils: 40_000, box: "cash" },
    });
    expect(delivered.status).toBe(200);
    const body = (await delivered.json()) as {
      outcome: string;
      result: { kind: string; data: { status: string; companion: { kind: string } } };
    };
    expect(body).toMatchObject({
      outcome: "applied",
      result: { kind: "OP-DELIVER", data: { status: "delivered_unpaid", companion: { kind: "OP-COLLECT" } } },
    });

    const invalid = await apiPost(worker, session.cookieHeader, "/api/manage-v2/deliver", {
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
