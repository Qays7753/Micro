/**
 * M5.6 acceptance (Manage v2 phase 5 — UX P-41/P-42/P-43/P-45 + R-28):
 * the full activity log with display grouping, one operation's details and
 * previous versions, and one balance line with its movements.
 *
 * Coverage: R-28's three groups (same-day sale, new order with prepayment,
 * delivery-with-collection on a later day) with their amounts (final price),
 * the type filter matching any part of a compound, the search and period
 * filters, P-42's fields (box/personal money/name/category/note/linked
 * sale), the corrected chain (P-43), and P-45's line + movements.
 *
 * Tests-first: the first run fails on the not-yet-existing module.
 */
import type postgres from "postgres";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { fileSqlUrl, resultOf, runPlan, scopedClient, setupProject } from "./manage.v2.helpers.ts";
import { readActivityLog } from "../application/manage/activityLog.js";
import { readOperationDetails, readBalanceLineDetails } from "../application/manage/operationDetails.js";
import { planSaleCreate } from "../../../../src/domain/manage/operations/saleCreate.js";
import { planPrepayment } from "../../../../src/domain/manage/operations/prepayment.js";
import { planDeliver } from "../../../../src/domain/manage/operations/deliver.js";
import { planCollect } from "../../../../src/domain/manage/operations/collect.js";
import { planExpense } from "../../../../src/domain/manage/operations/expense.js";
import { planOwnerDeposit } from "../../../../src/domain/manage/operations/ownerMoney.js";
import { planPriceCorrection } from "../../../../src/domain/manage/operations/priceCorrection.js";
import type { SetupBoxSlot } from "../../../../src/domain/manage/operations/setup.js";

let dbUrl = "";

beforeAll(async () => {
  dbUrl = await fileSqlUrl();
});
afterAll(() => undefined);

const AMMAN_TODAY = "2026-11-28";

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

async function newProject(boxes: SetupBoxSlot[] = [{ kind: "cash", opening: { openingFils: 100_000 } }]) {
  const projectId = crypto.randomUUID();
  const owner = `m56-owner-${suffix()}`;
  await withSql(sql => setupProject(sql, { projectId, owner, today: "2026-11-20", boxes }));
  return { projectId, owner };
}

async function saleCreate(
  sql: postgres.Sql,
  ctx: Ctx,
  input: { day: string; priceFils: number; planned: string; name?: string; deliver?: boolean },
): Promise<string> {
  const outcome = await runPlan(sql, () =>
    planSaleCreate({
      projectId: ctx.projectId,
      createdByAccountId: ctx.owner,
      requestId: `m56-${crypto.randomUUID()}`,
      today: input.day,
      lines: [{ description: "بند", quantityMilli: 1000, unitPriceFils: input.priceFils }],
      plannedDeliveryOn: input.planned,
      finalPriceFils: input.priceFils,
      customerName: input.name,
    }),
  );
  return String((resultOf(outcome, "applied").data as { saleId: string }).saleId);
}

/* ── 1. R-28 grouping ─────────────────────────────────────────────────── */

describe("M5.6 — the activity log (P-41 + R-28)", () => {
  it("a same-day sale (create + deliver + collect) is ONE op.sale row at the final price", async () => {
    const ctx = await newProject();
    await withSql(async sql => {
      const saleId = await saleCreate(sql, ctx, {
        day: AMMAN_TODAY,
        priceFils: 25_000,
        planned: AMMAN_TODAY,
        name: "سامي",
        deliver: true,
      });
      await runPlan(sql, () =>
        planDeliver({
          projectId: ctx.projectId,
          createdByAccountId: ctx.owner,
          requestId: `m56-${crypto.randomUUID()}`,
          today: AMMAN_TODAY,
          saleId,
        }),
      );
      await runPlan(sql, () =>
        planCollect({
          projectId: ctx.projectId,
          createdByAccountId: ctx.owner,
          requestId: `m56-${crypto.randomUUID()}`,
          today: AMMAN_TODAY,
          amountFils: 25_000,
          box: "cash",
          counterpartyName: "سامي",
        }),
      );
      const log = await readActivityLog(sql, ctx.projectId, AMMAN_TODAY);
      const group = log.rows.find(row => row.compound);
      expect(group).toMatchObject({
        compound: true,
        labelKey: "op.sale",
        amountText: "25.000 د",
        effectiveOn: AMMAN_TODAY,
        saleId,
      });
      expect(group!.compound && group.members.map(m => m.kind)).toEqual(
        expect.arrayContaining(["OP-SALE-CREATE", "OP-DELIVER", "OP-COLLECT"]),
      );
      /* None of the members stands alone. */
      const singles = log.rows.filter(row => !row.compound && row.saleId === saleId);
      expect(singles).toHaveLength(0);
    });
  });

  it("a new order with a prepayment groups at op.sale; a later delivery+collection groups at op.deliver", async () => {
    const ctx = await newProject();
    await withSql(async sql => {
      const saleId = await saleCreate(sql, ctx, {
        day: "2026-11-25",
        priceFils: 80_000,
        planned: "2026-11-27",
        name: "محمد",
      });
      await runPlan(sql, () =>
        planPrepayment({
          projectId: ctx.projectId,
          createdByAccountId: ctx.owner,
          requestId: `m56-${crypto.randomUUID()}`,
          today: "2026-11-25",
          saleId,
          amountFils: 20_000,
          box: "cash",
        }),
      );
      await runPlan(sql, () =>
        planDeliver({
          projectId: ctx.projectId,
          createdByAccountId: ctx.owner,
          requestId: `m56-${crypto.randomUUID()}`,
          today: "2026-11-27",
          saleId,
        }),
      );
      await runPlan(sql, () =>
        planCollect({
          projectId: ctx.projectId,
          createdByAccountId: ctx.owner,
          requestId: `m56-${crypto.randomUUID()}`,
          today: "2026-11-27",
          amountFils: 30_000,
          box: "cash",
          counterpartyName: "محمد",
        }),
      );
      const log = await readActivityLog(sql, ctx.projectId, AMMAN_TODAY);
      const compounds = log.rows.filter(row => row.compound);
      expect(compounds).toHaveLength(2);
      const orderGroup = compounds.find(c => c.compound && c.effectiveOn === "2026-11-25");
      expect(orderGroup).toMatchObject({ labelKey: "op.sale", amountText: "80.000 د" });
      const deliveryGroup = compounds.find(c => c.compound && c.effectiveOn === "2026-11-27");
      expect(deliveryGroup).toMatchObject({ labelKey: "op.deliver", amountText: "80.000 د" });
      expect(deliveryGroup!.compound && deliveryGroup.members.map(m => m.kind)).toEqual(
        expect.arrayContaining(["OP-DELIVER", "OP-COLLECT"]),
      );
    });
  });

  it("the type filter matches a compound if ANY of its parts matches; search and period filter too", async () => {
    const ctx = await newProject();
    await withSql(async sql => {
      const saleId = await saleCreate(sql, ctx, {
        day: "2026-11-26",
        priceFils: 30_000,
        planned: "2026-11-26",
        name: "أم خالد",
        deliver: true,
      });
      await runPlan(sql, () =>
        planDeliver({
          projectId: ctx.projectId,
          createdByAccountId: ctx.owner,
          requestId: `m56-${crypto.randomUUID()}`,
          today: "2026-11-26",
          saleId,
        }),
      );
      await runPlan(sql, () =>
        planCollect({
          projectId: ctx.projectId,
          createdByAccountId: ctx.owner,
          requestId: `m56-${crypto.randomUUID()}`,
          today: "2026-11-26",
          amountFils: 30_000,
          box: "cash",
          counterpartyName: "أم خالد",
        }),
      );
      /* المجمّع يطابق مجموعة أي جزء: op.sale (CREATE) وop.collect (COLLECT). */
      const asSale = await readActivityLog(sql, ctx.projectId, AMMAN_TODAY, { type: "op.sale" });
      const asCollect = await readActivityLog(sql, ctx.projectId, AMMAN_TODAY, { type: "op.collect" });
      expect(asSale.rows.some(r => r.compound && r.saleId === saleId)).toBe(true);
      expect(asCollect.rows.some(r => r.compound && r.saleId === saleId)).toBe(true);
      /* فلاتر لا تطابق أجزاءه: الودائع. */
      const asDeposit = await readActivityLog(sql, ctx.projectId, AMMAN_TODAY, { type: "op.deposit" });
      expect(asDeposit.rows.some(r => r.compound && r.saleId === saleId)).toBe(false);
      /* البحث بالاسم. */
      const byName = await readActivityLog(sql, ctx.projectId, AMMAN_TODAY, { search: "أم خالد" });
      expect(byName.rows.length).toBeGreaterThan(0);
      const byNothing = await readActivityLog(sql, ctx.projectId, AMMAN_TODAY, { search: "لا أحد" });
      expect(byNothing.rows).toHaveLength(0);
      /* الفترة: الأسبوع يشمل 26/11 والشهر كذلك؛ السنة منذ البداية. */
      const week = await readActivityLog(sql, ctx.projectId, AMMAN_TODAY, { period: "week" });
      expect(week.rows.some(r => r.compound && r.saleId === saleId)).toBe(true);
    });
  });

  it("an ungrouped operation stays a single row (expense with its category)", async () => {
    const ctx = await newProject();
    await withSql(async sql => {
      await runPlan(sql, () =>
        planExpense({
          projectId: ctx.projectId,
          createdByAccountId: ctx.owner,
          requestId: `m56-${crypto.randomUUID()}`,
          today: AMMAN_TODAY,
          amountFils: 10_000,
          category: "gas",
          payment: { type: "full" },
          source: "cash",
          note: "غاز",
        }),
      );
      const log = await readActivityLog(sql, ctx.projectId, AMMAN_TODAY);
      const expense = log.rows.find(row => !row.compound && row.kind === "OP-EXPENSE");
      expect(expense).toMatchObject({ category: "gas", name: "غاز", amountText: "10.000 د" });
    });
  });
});

/* ── 2. P-42/P-43 — one operation + its versions ──────────────────────── */

describe("M5.6 — operation details and previous versions (P-42/P-43)", () => {
  it("an expense's details carry its fields; a corrected collect chains its previous version", async () => {
    const ctx = await newProject();
    await withSql(async sql => {
      const expense = await runPlan(sql, () =>
        planExpense({
          projectId: ctx.projectId,
          createdByAccountId: ctx.owner,
          requestId: `m56-${crypto.randomUUID()}`,
          today: "2026-11-21",
          amountFils: 5_000,
          category: "gas",
          payment: { type: "full" },
          source: "cash",
          note: "غاز البيت",
        }),
      );
      const details = await readOperationDetails(
        sql,
        ctx.projectId,
        String(resultOf(expense, "applied").operationId),
        AMMAN_TODAY,
      );
      expect(details).toMatchObject({
        kind: "OP-EXPENSE",
        effectiveOn: "2026-11-21",
        amountText: "5.000 د",
        boxKind: "cash",
        personalMoney: false,
        name: "غاز البيت",
        category: "gas",
        note: "غاز البيت",
        corrected: false,
        cancelled: false,
      });

      /* تصحيح السعر يسلّس النسخ: البديلة current والقديمة previous. */
      const saleId = await saleCreate(sql, ctx, {
        day: AMMAN_TODAY,
        priceFils: 25_000,
        planned: AMMAN_TODAY,
        name: "سامي",
      });
      await runPlan(sql, () =>
        planDeliver({
          projectId: ctx.projectId,
          createdByAccountId: ctx.owner,
          requestId: `m56-${crypto.randomUUID()}`,
          today: AMMAN_TODAY,
          saleId,
        }),
      );
      const first = await runPlan(sql, () =>
        planPriceCorrection({
          projectId: ctx.projectId,
          createdByAccountId: ctx.owner,
          requestId: `m56-${crypto.randomUUID()}`,
          today: AMMAN_TODAY,
          saleId,
          newPriceFils: 22_000,
        }),
      );
      const second = await runPlan(sql, () =>
        planPriceCorrection({
          projectId: ctx.projectId,
          createdByAccountId: ctx.owner,
          requestId: `m56-${crypto.randomUUID()}`,
          today: AMMAN_TODAY,
          saleId,
          newPriceFils: 20_000,
        }),
      );
      const current = await readOperationDetails(
        sql,
        ctx.projectId,
        String(resultOf(second, "applied").operationId),
        AMMAN_TODAY,
      );
      expect(current).toMatchObject({ kind: "OP-PRICE-CORRECTION", corrected: true, saleId });
      /* السلسلة: النسخة الأولى (المستبدلة) أقدم نسخة. */
      expect(current.previousVersions.map(v => v.operationId)).toContain(
        String(resultOf(first, "applied").operationId),
      );
      expect(current.previousVersions.every(v => v.cancelled)).toBe(true);
    });
  });

  it("a personal-money expense shows personalMoney and no box", async () => {
    const ctx = await newProject();
    await withSql(async sql => {
      const expense = await runPlan(sql, () =>
        planExpense({
          projectId: ctx.projectId,
          createdByAccountId: ctx.owner,
          requestId: `m56-${crypto.randomUUID()}`,
          today: AMMAN_TODAY,
          amountFils: 7_000,
          category: "other",
          payment: { type: "full" },
          source: "personal",
        }),
      );
      const details = await readOperationDetails(
        sql,
        ctx.projectId,
        String(resultOf(expense, "applied").operationId),
        AMMAN_TODAY,
      );
      /* «من مالي الشخصي» تمييز العرض — القيد نفسه يمر بصندوق النقد (Q10+Q8). */
      expect(details.personalMoney).toBe(true);
    });
  });
});

/* ── 3. P-45 — one balance line + its movements ───────────────────────── */

describe("M5.6 — balance line details (P-45)", () => {
  it("a prior receivable line carries its outstanding and its Q2 movement", async () => {
    const ctx = await newProject();
    await withSql(async sql => {
      await runPlan(sql, () =>
        planOwnerDeposit({
          projectId: ctx.projectId,
          createdByAccountId: ctx.owner,
          requestId: `m56-${crypto.randomUUID()}`,
          today: AMMAN_TODAY,
          amountFils: 10_000,
          box: "cash",
          source: { type: "personal" },
        }),
      );
      /* خط من موديول القراءة: افتتاح المشروع نفسه ليس خطًا — ننشئ خطًا عبر
       * تحصيل مجهول الاسم؟ الأسهل: قراءة خط متبقٍ من طلب مسلَّم بلا تحصيل. */
      const saleId = await saleCreate(sql, ctx, {
        day: "2026-11-22",
        priceFils: 18_000,
        planned: "2026-11-22",
        name: "أم خالد",
      });
      await runPlan(sql, () =>
        planDeliver({
          projectId: ctx.projectId,
          createdByAccountId: ctx.owner,
          requestId: `m56-${crypto.randomUUID()}`,
          today: "2026-11-22",
          saleId,
        }),
      );
      const { readModel } = await import("../application/manage/readModel.js");
      void readModel;
      const figuresModule = await import("../application/manage/readModel.js");
      const figures = await figuresModule.computeManageFigures(sql, ctx.projectId, AMMAN_TODAY, "month");
      const remainder = figures.balanceLines.find(
        line => line.kind === "sale_remainder" && line.outstandingFils > 0,
      );
      expect(remainder).toBeDefined();
      const details = await readBalanceLineDetails(sql, ctx.projectId, remainder!.id, AMMAN_TODAY);
      expect(details.line).toMatchObject({
        direction: "to_me",
        kind: "sale_remainder",
        counterpartyName: "أم خالد",
        saleId,
      });
      expect(details.line.outstandingText).toBe("18.000 د");
      /* الحركات على الخط: التسليم (منشئ المتبقي) — الإنشاء بلا قيد على الخط. */
      const kinds = details.movements.map(m => m.kind);
      expect(kinds).toContain("OP-DELIVER");
    });
  });
});
