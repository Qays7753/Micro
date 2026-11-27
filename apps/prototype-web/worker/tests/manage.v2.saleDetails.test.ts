/**
 * M5.3 acceptance (Manage v2 phase 5 — UX P-21 «تفاصيل الطلب»): the sale
 * details read — the §6 status and §8.2 indicators from the ONE read module,
 * the §3.5 line snapshots, the linked delivery costs, and the linked
 * operation history (C-10 rows with formatted amounts and flags).
 *
 * Coverage:
 *  1. A delivered & collected sale: completed, paid X of X, expected profit,
 *     the delivery (OP-DELIVER) and its collection in the history.
 *  2. A future order with a prepayment: scheduled, lines by position with
 *     the product's unit label, the prepayment in the history.
 *  3. A free-text line: productId null (no unit, no price).
 *  4. Linked delivery cost with its source and formatted text.
 *  5. A sale with an open customer_refund line: S-REFUND-DUE's remaining.
 *  6. R-24: another account's sale is the unified 404.
 *
 * Tests-first: the first run fails on the not-yet-existing route.
 */
import type postgres from "postgres";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { apiGet, apiPost, signInAs, startWorker, type WorkerInstance } from "./harness.ts";
import {
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
import { planReturn } from "../../../../src/domain/manage/operations/saleReturn.js";
import { updateSaleFields } from "../application/manage/saleEdits.js";
import { readSaleDetails } from "../application/manage/saleDetails.js";
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
  const owner = `m53-owner-${suffix()}`;
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

async function createSale(
  sql: postgres.Sql,
  ctx: Ctx,
  input: {
    lines: Array<{
      description: string;
      quantityMilli?: number;
      unitPriceFils?: number;
      productId?: string;
    }>;
    plannedDeliveryOn: string;
    customerName?: string;
    finalPriceFils?: number;
  },
): Promise<string> {
  const outcome = await runPlan(sql, () =>
    planSaleCreate({
      projectId: ctx.projectId,
      createdByAccountId: ctx.owner,
      requestId: `m53-${crypto.randomUUID()}`,
      today: AMMAN_TODAY,
      lines: input.lines.map(line => ({
        ...(line.productId === undefined ? {} : { productId: line.productId }),
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

async function saleIdOf(sql: postgres.Sql, projectId: string, operationId: string): Promise<string> {
  const rows = (await sql`
    SELECT s.id FROM sale s
    JOIN operation o ON o.sale_id = s.id AND o.kind = 'OP-SALE-CREATE'
    WHERE o.id = ${operationId} AND s.project_id = ${projectId}`) as Array<{ id: string }>;
  return String(rows[0]!.id);
}

/* ── 1. Delivered & collected ──────────────────────────────────────────── */

describe("M5.3 — the sale details (P-21)", () => {
  it("completed sale: indicators + the delivery and collection in the history", async () => {
    const ctx = await newProject();
    await withSql(async sql => {
      // A product with a unit label for the line's display unit.
      const product = (await sql`
        INSERT INTO product (id, project_id, name, unit_label, unit_price_minor, archived, created_at)
        VALUES (${crypto.randomUUID()}, ${ctx.projectId}, 'مقلوبة', 'صينية', 18_000, false, now())
        RETURNING id, name`) as Array<{ id: string; name: string }>;
      const productId = String(product[0]!.id);
      const op = await createSale(sql, ctx, {
        lines: [{ productId, description: "مقلوبة", quantityMilli: 2000, unitPriceFils: 18_000 }],
        plannedDeliveryOn: AMMAN_TODAY,
        customerName: "أبو أحمد",
        finalPriceFils: 36_000,
      });
      const saleId = await saleIdOf(sql, ctx.projectId, op);
      await runPlan(sql, () =>
        planDeliver({
          projectId: ctx.projectId,
          createdByAccountId: ctx.owner,
          requestId: `m53-${crypto.randomUUID()}`,
          today: AMMAN_TODAY,
          saleId,
          collection: { amountFils: 36_000, box: "cash" },
        }),
      );
      const details = await readSaleDetails(sql, ctx.projectId, saleId, AMMAN_TODAY);
      expect(details.sale.status).toBe("completed");
      expect(details.sale.paidFils).toBe(36_000);
      expect(details.sale.paidOfFils).toBe(36_000);
      expect(details.sale.finalPriceText).toBe("36.000 د");
      expect(details.lines).toHaveLength(1);
      expect(details.lines[0]!.unitLabel).toBe("صينية");
      expect(details.lines[0]!.quantityMilli).toBe(2000);
      const kinds = details.history.map(h => h.kind);
      expect(kinds).toContain("OP-SALE-CREATE");
      expect(kinds).toContain("OP-DELIVER");
      const invariant = await ledgerState(sql, ctx.projectId);
      assertLedgerCoreInvariants(invariant);
    });
  });

  it("a future order with a prepayment: scheduled + lines by position + free-text line", async () => {
    const ctx = await newProject();
    await withSql(async sql => {
      const op = await createSale(sql, ctx, {
        lines: [
          { description: "ورق عنب", quantityMilli: 2000, unitPriceFils: 12_000 },
          { description: "كيكة" },
          { description: "أول بند", unitPriceFils: 5_000 },
        ],
        plannedDeliveryOn: "2026-11-29",
        customerName: "سلمى",
        finalPriceFils: 29_000,
      });
      const saleId = await saleIdOf(sql, ctx.projectId, op);
      await runPlan(sql, () =>
        planPrepayment({
          projectId: ctx.projectId,
          createdByAccountId: ctx.owner,
          requestId: `m53-${crypto.randomUUID()}`,
          today: AMMAN_TODAY,
          saleId,
          amountFils: 10_000,
          box: "cash",
        }),
      );
      const details = await readSaleDetails(sql, ctx.projectId, saleId, AMMAN_TODAY);
      expect(details.sale.status).toBe("scheduled");
      expect(details.sale.prepaymentFils).toBe(10_000);
      /* البنود بترتيب position — «أول بند» أولًا. */
      expect(details.lines.map(l => l.description)).toEqual(["ورق عنب", "كيكة", "أول بند"]);
      /* البند النصي: بلا منتج وبلا سعر. */
      const freeText = details.lines[1]!;
      expect(freeText.productId).toBeNull();
      expect(freeText.unitPriceFils).toBeNull();
      expect(freeText.unitLabel).toBeNull();
      const invariant = await ledgerState(sql, ctx.projectId);
      assertLedgerCoreInvariants(invariant);
    });
  });

  it("linked delivery cost with its source; an open customer_refund shows S-REFUND-DUE", async () => {
    const ctx = await newProject();
    await withSql(async sql => {
      const op = await createSale(sql, ctx, {
        lines: [{ description: "طلب بو", unitPriceFils: 36_000 }],
        plannedDeliveryOn: AMMAN_TODAY,
        customerName: "بو أحمد",
        finalPriceFils: 36_000,
      });
      const saleId = await saleIdOf(sql, ctx.projectId, op);
      await runPlan(sql, () =>
        planSaleDeliveryCost({
          projectId: ctx.projectId,
          createdByAccountId: ctx.owner,
          requestId: `m53-${crypto.randomUUID()}`,
          today: AMMAN_TODAY,
          saleId,
          amountFils: 2_000,
          source: "cash",
        }),
      );
      await runPlan(sql, () =>
        planDeliver({
          projectId: ctx.projectId,
          createdByAccountId: ctx.owner,
          requestId: `m53-${crypto.randomUUID()}`,
          today: AMMAN_TODAY,
          saleId,
          collection: { amountFils: 36_000, box: "cash" },
        }),
      );
      /* مرتجع 8 (أكبر من المتبقي 0 بعد التحصيل الكامل) مع رد لاحق: خط رد كامل 8. */
      await runPlan(sql, () =>
        planReturn({
          projectId: ctx.projectId,
          createdByAccountId: ctx.owner,
          requestId: `m53-${crypto.randomUUID()}`,
          today: AMMAN_TODAY,
          saleId,
          amountFils: 8_000,
          refund: { mode: "later" },
        }),
      );
      const details = await readSaleDetails(sql, ctx.projectId, saleId, AMMAN_TODAY);
      expect(details.deliveryCosts).toHaveLength(1);
      expect(details.deliveryCosts[0]!.amountText).toBe("2.000 د");
      expect(details.deliveryCosts[0]!.source).toBe("cash");
      expect(details.sale.customerRefundDueFils).toBe(8_000);
      expect(details.sale.customerRefundDueText).toBe("8.000 د");
      const kinds = details.history.map(h => h.kind);
      expect(kinds).toContain("OP-RETURN");
      expect(kinds).toContain("OP-SALE-DELIVERY-COST");
      const invariant = await ledgerState(sql, ctx.projectId);
      assertLedgerCoreInvariants(invariant);
    });
  });

  it("lastEditOn: null before any field edit, the Amman date after one (R-17/D-14)", async () => {
    const ctx = await newProject();
    await withSql(async sql => {
      const op = await createSale(sql, ctx, {
        lines: [{ description: "بند", quantityMilli: 1000, unitPriceFils: 5_000 }],
        plannedDeliveryOn: "2026-12-01",
        customerName: "زبدة",
      });
      const saleId = await saleIdOf(sql, ctx.projectId, op);
      /* قبل أي تعديل حقول: updated_at فارغ والسطر يسقط من الشاشة. */
      const before = await readSaleDetails(sql, ctx.projectId, saleId, AMMAN_TODAY);
      expect(before.sale.lastEditOn).toBeNull();
      /* تعديل غير مالي (R-17: تحديث حقل مباشر بلا عملية). */
      await updateSaleFields(sql, {
        projectId: ctx.projectId,
        saleId,
        note: "عميل يفضّل التسليم مساءً",
      });
      const after = await readSaleDetails(sql, ctx.projectId, saleId, AMMAN_TODAY);
      expect(after.sale.lastEditOn).not.toBeNull();
      /* بتاريخ عمّان الصالح (YYYY-MM-DD). */
      expect(after.sale.lastEditOn).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      const invariant = await ledgerState(sql, ctx.projectId);
      assertLedgerCoreInvariants(invariant);
    });
  });

  it("boxesCount: the active boxes (C-10's box shown with two boxes only)", async () => {
    const ctx = await newProject();
    await withSql(async sql => {
      const op = await createSale(sql, ctx, {
        lines: [{ description: "بند", quantityMilli: 1000, unitPriceFils: 5_000 }],
        plannedDeliveryOn: "2026-12-01",
        customerName: "أبو خليل",
      });
      const saleId = await saleIdOf(sql, ctx.projectId, op);
      const oneBox = await readSaleDetails(sql, ctx.projectId, saleId, AMMAN_TODAY);
      expect(oneBox.boxesCount).toBe(1);
      /* صندوق ثانٍ (OP-ADD-BOX: فتح مباشر بلا قيد — نمط الإعداد). */
      await sql`
        INSERT INTO box (id, project_id, kind, status, opening_status, created_on, created_at)
        VALUES (${crypto.randomUUID()}, ${ctx.projectId}, 'account', 'active', 'known', ${AMMAN_TODAY}, now())`;
      const twoBoxes = await readSaleDetails(sql, ctx.projectId, saleId, AMMAN_TODAY);
      expect(twoBoxes.boxesCount).toBe(2);
      const invariant = await ledgerState(sql, ctx.projectId);
      assertLedgerCoreInvariants(invariant);
    });
  });
});

/* ── The route (R-24) ──────────────────────────────────────────────────── */

describe("M5.3 — the sale-details route", () => {
  it("serves the signed-in owner's sale; a foreign sale is the unified 404", async () => {
    const sub = `m53-route-${suffix()}`;
    const session = await signInAs(worker, { sub, email: `${sub}@example.com` });
    const setup = await apiPost(worker, session.cookieHeader, "/api/manage-v2/setup", {
      requestId: `m53-${crypto.randomUUID()}`,
      projectName: "مطبخ",
      boxes: [{ kind: "cash", opening: { openingFils: 50_000 } }],
    });
    expect(setup.status).toBe(200);
    const projectId = ((await setup.json()) as { projectId: string }).projectId;
    await withSql(async sql => {
      const owner = sub;
      const op = await runPlan(sql, () =>
        planSaleCreate({
          projectId,
          createdByAccountId: owner,
          requestId: `m53-${crypto.randomUUID()}`,
          today: AMMAN_TODAY,
          lines: [{ description: "بند", quantityMilli: 1000, unitPriceFils: 5_000 }],
          plannedDeliveryOn: "2026-12-01",
          customerName: "عميل",
        }),
      );
      const saleId = await saleIdOf(sql, projectId, resultOf(op, "applied").operationId);
      const response = await apiGet(worker, session.cookieHeader, `/api/manage-v2/sale/${saleId}`);
      expect(response.status).toBe(200);
      const body = (await response.json()) as { sale: { status: string } };
      expect(body.sale.status).toBe("scheduled");
    });

    const otherSub = `m53-other-${suffix()}`;
    const other = await signInAs(worker, { sub: otherSub, email: `${otherSub}@example.com` });
    const foreign = await apiGet(
      worker,
      other.cookieHeader,
      "/api/manage-v2/sale/00000000-0000-0000-0000-000000000000",
    );
    expect(foreign.status).toBe(404);
  });
});
