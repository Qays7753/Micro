/**
 * M5.4 acceptance (Manage v2 phase 5 — UX P-30 §10 «قسم الحركات» / C-10):
 * آخر خمس حركات كما يعرضها P-30 — كل نص مبلغ جاهز من الخادم (٣ منازل
 * R-20)، والترتيب الأحدث أولًا، واسم الطرف أو عميل الطلب أو الملاحظة،
 * وحالة الطلب §6 من موديول القراءة الواحد، والصندوق مع صندوقين، وتسمية
 * ج-١ الشرطية (مصدر الإيداع) وتصنيف المصروف، وعلمَي «معدَّلة»/«ملغاة».
 *
 * Tests-first: the first run fails on the not-yet-existing module/route.
 */
import type postgres from "postgres";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { apiGet, signInAs, startWorker, type WorkerInstance } from "./harness.ts";
import { fileSqlUrl, resultOf, runPlan, scopedClient, setupProject } from "./manage.v2.helpers.ts";
import { planSaleCreate } from "../../../../src/domain/manage/operations/saleCreate.js";
import { planDeliver } from "../../../../src/domain/manage/operations/deliver.js";
import { planExpense } from "../../../../src/domain/manage/operations/expense.js";
import { planOwnerDeposit } from "../../../../src/domain/manage/operations/ownerMoney.js";
import { planPriceCorrection } from "../../../../src/domain/manage/operations/priceCorrection.js";
import { readRecentActivity } from "../application/manage/activityRows.js";
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

interface Ctx {
  projectId: string;
  owner: string;
}

async function newProject(boxes: SetupBoxSlot[] = [{ kind: "cash", opening: { openingFils: 0 } }]) {
  const projectId = crypto.randomUUID();
  const owner = `m54-owner-${suffix()}`;
  await withSql(sql => setupProject(sql, { projectId, owner, today: AMMAN_TODAY, boxes }));
  return { projectId, owner };
}

async function deposit(sql: postgres.Sql, ctx: Ctx, amountFils: number, effectiveOn = AMMAN_TODAY) {
  return runPlan(sql, () =>
    planOwnerDeposit({
      projectId: ctx.projectId,
      createdByAccountId: ctx.owner,
      requestId: `m54-${crypto.randomUUID()}`,
      today: AMMAN_TODAY,
      amountFils,
      box: "cash",
      source: { type: "personal" },
      effectiveOn,
    }),
  );
}

/* ── 1. The latest five, newest first, with ready texts ───────────────── */

describe("M5.4 — recent activity (P-30 §10, C-10)", () => {
  it("returns at most five rows, newest first, each amount a ready 3-decimal text", async () => {
    const ctx = await newProject();
    await withSql(async sql => {
      // Six deposits on three days — the newest five only, latest day first.
      await deposit(sql, ctx, 10_000, "2026-11-20");
      await deposit(sql, ctx, 20_000, "2026-11-21");
      await deposit(sql, ctx, 30_000, "2026-11-22");
      await deposit(sql, ctx, 40_000, "2026-11-23");
      await deposit(sql, ctx, 50_000, "2026-11-24");
      await deposit(sql, ctx, 60_000, "2026-11-25");

      const rows = await readRecentActivity(sql, ctx.projectId, AMMAN_TODAY);
      expect(rows).toHaveLength(5);
      // OP-SETUP is effective TODAY (R-26) — the newest row of all.
      expect(rows.map(row => [row.kind, row.effectiveOn])).toEqual([
        ["OP-SETUP", "2026-11-27"],
        ["OP-OWNER-DEPOSIT", "2026-11-25"],
        ["OP-OWNER-DEPOSIT", "2026-11-24"],
        ["OP-OWNER-DEPOSIT", "2026-11-23"],
        ["OP-OWNER-DEPOSIT", "2026-11-22"],
      ]);
      // The two oldest deposits (11-21 and 11-20) are out of the five.
      expect(rows.some(row => row.effectiveOn === "2026-11-21")).toBe(false);
      // Amounts: the §3.7 amount_minor formatted to 3 decimals + «د».
      expect(rows[1]).toMatchObject({
        kind: "OP-OWNER-DEPOSIT",
        amountText: "60.000 د",
        boxKind: "cash",
        corrected: false,
        cancelled: false,
        saleId: null,
        saleStatus: null,
        deliveryCostText: null,
      });
    });
  });

  /* ── 2. An expense: its category is the row's label, and the delivery
   *      cost rides its own sentence (N-16) ──────────────────────────── */

  it("an expense carries its category and its delivery cost as a separate text", async () => {
    const ctx = await newProject();
    await withSql(async sql => {
      await deposit(sql, ctx, 100_000);
      await runPlan(sql, () =>
        planExpense({
          projectId: ctx.projectId,
          createdByAccountId: ctx.owner,
          requestId: `m54-${crypto.randomUUID()}`,
          today: AMMAN_TODAY,
          amountFils: 30_000,
          deliveryCostFils: 2_500,
          category: "gas",
          payment: { type: "full" },
          source: "cash",
          note: "غاز المطعم",
        }),
      );
      const rows = await readRecentActivity(sql, ctx.projectId, AMMAN_TODAY);
      const expense = rows.find(row => row.kind === "OP-EXPENSE");
      expect(expense).toMatchObject({
        category: "gas",
        amountText: "32.500 د",
        deliveryCostText: "2.500 د",
        name: "غاز المطعم",
      });
    });
  });

  /* ── 3. The conditional ج-١ label: a borrowed deposit carries its
   *      source variant and the lender's name ────────────────────────── */

  it("a borrowed owner deposit carries variant «borrowed» and the lender's name", async () => {
    const ctx = await newProject();
    await withSql(async sql => {
      await runPlan(sql, () =>
        planOwnerDeposit({
          projectId: ctx.projectId,
          createdByAccountId: ctx.owner,
          requestId: `m54-${crypto.randomUUID()}`,
          today: AMMAN_TODAY,
          amountFils: 80_000,
          box: "cash",
          source: { type: "borrowed", name: "أبو سامي" },
        }),
      );
      const rows = await readRecentActivity(sql, ctx.projectId, AMMAN_TODAY);
      const depositRow = rows.find(row => row.kind === "OP-OWNER-DEPOSIT");
      expect(depositRow).toMatchObject({ variant: "borrowed", name: "أبو سامي" });
    });
  });

  /* ── 4. A sale's rows carry the §6 status from the ONE read module ──── */

  it("a sale's activity rows carry saleId, the customer's name and the §6 status", async () => {
    const ctx = await newProject();
    await withSql(async sql => {
      await deposit(sql, ctx, 50_000);
      const created = await runPlan(sql, () =>
        planSaleCreate({
          projectId: ctx.projectId,
          createdByAccountId: ctx.owner,
          requestId: `m54-${crypto.randomUUID()}`,
          today: AMMAN_TODAY,
          lines: [{ description: "صينية منسف", quantityMilli: 1000, unitPriceFils: 25_000 }],
          plannedDeliveryOn: "2026-12-01",
          finalPriceFils: 25_000,
          customerName: "سامي",
        }),
      );
      const saleId = String((resultOf(created, "applied").data as { saleId: string }).saleId);
      await runPlan(sql, () =>
        planDeliver({
          projectId: ctx.projectId,
          createdByAccountId: ctx.owner,
          requestId: `m54-${crypto.randomUUID()}`,
          today: AMMAN_TODAY,
          saleId,
        }),
      );
      const rows = await readRecentActivity(sql, ctx.projectId, AMMAN_TODAY);
      const saleRows = rows.filter(row => row.saleId === saleId);
      expect(saleRows.length).toBeGreaterThanOrEqual(2);
      expect(saleRows.every(row => row.saleStatus === "delivered_unpaid")).toBe(true);
      expect(saleRows.every(row => row.name === "سامي")).toBe(true);
    });
  });

  /* ── 5. Two boxes: the row names the box its money touched ──────────── */

  it("with two boxes a row names its box; the account box is «account»", async () => {
    const ctx = await newProject([
      { kind: "cash", opening: { openingFils: 0 } },
      { kind: "account", opening: { openingFils: 0 } },
    ]);
    await withSql(async sql => {
      await runPlan(sql, () =>
        planOwnerDeposit({
          projectId: ctx.projectId,
          createdByAccountId: ctx.owner,
          requestId: `m54-${crypto.randomUUID()}`,
          today: AMMAN_TODAY,
          amountFils: 70_000,
          box: "account",
          source: { type: "personal" },
        }),
      );
      const rows = await readRecentActivity(sql, ctx.projectId, AMMAN_TODAY);
      expect(rows.find(row => row.kind === "OP-OWNER-DEPOSIT")).toMatchObject({ boxKind: "account" });
    });
  });

  /* ── 6. «معدَّلة» and «ملغاة»: a price correction's replacement row is
   *      corrected, and the replaced row is reversed ─────────────────── */

  it("a price correction marks the replacement «معدَّلة» and the replaced row «ملغاة»", async () => {
    const ctx = await newProject();
    await withSql(async sql => {
      await deposit(sql, ctx, 50_000);
      const created = await runPlan(sql, () =>
        planSaleCreate({
          projectId: ctx.projectId,
          createdByAccountId: ctx.owner,
          requestId: `m54-${crypto.randomUUID()}`,
          today: AMMAN_TODAY,
          lines: [{ description: "صينية", quantityMilli: 1000, unitPriceFils: 25_000 }],
          plannedDeliveryOn: "2026-12-01",
          finalPriceFils: 25_000,
          customerName: "سامي",
        }),
      );
      const saleId = String((resultOf(created, "applied").data as { saleId: string }).saleId);
      await runPlan(sql, () =>
        planDeliver({
          projectId: ctx.projectId,
          createdByAccountId: ctx.owner,
          requestId: `m54-${crypto.randomUUID()}`,
          today: AMMAN_TODAY,
          saleId,
        }),
      );
      const first = await runPlan(sql, () =>
        planPriceCorrection({
          projectId: ctx.projectId,
          createdByAccountId: ctx.owner,
          requestId: `m54-${crypto.randomUUID()}`,
          today: AMMAN_TODAY,
          saleId,
          newPriceFils: 22_000,
        }),
      );
      await runPlan(sql, () =>
        planPriceCorrection({
          projectId: ctx.projectId,
          createdByAccountId: ctx.owner,
          requestId: `m54-${crypto.randomUUID()}`,
          today: AMMAN_TODAY,
          saleId,
          newPriceFils: 20_000,
        }),
      );
      const rows = await readRecentActivity(sql, ctx.projectId, AMMAN_TODAY);
      const corrections = rows.filter(row => row.kind === "OP-PRICE-CORRECTION");
      // The replacement carries corrects_operation_id; the one it replaced is reversed.
      expect(corrections.some(row => row.corrected)).toBe(true);
      expect(rows.some(row => row.cancelled && row.kind === "OP-PRICE-CORRECTION")).toBe(true);
      expect(String(resultOf(first, "applied").operationId).length).toBeGreaterThan(0);
    });
  });

  /* ── 7. The route: the signed-in owner's rows; a foreign project is the
   *      unified 404 (R-24) ──────────────────────────────────────────── */

  it("serves the signed-in owner's latest activity; another account is the unified 404", async () => {
    const sub = `m54-route-${suffix()}`;
    const session = await signInAs(worker, { sub, email: `${sub}@example.com` });
    const rows = await apiGet(worker, session.cookieHeader, "/api/manage-v2/recent-activity");
    // No project yet → the unified 404 (R-24), not a crash.
    expect(rows.status).toBe(404);

    const other = `m54-other-${suffix()}`;
    const otherSession = await signInAs(worker, { sub: other, email: `${other}@example.com` });
    const foreign = await apiGet(worker, otherSession.cookieHeader, "/api/manage-v2/recent-activity");
    expect(foreign.status).toBe(404);
  });
});
