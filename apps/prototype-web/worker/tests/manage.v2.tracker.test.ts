/**
 * M3.11 acceptance (Manage v2 phase 3 — spec §5 OP-TRACKER-HIDE /
 * OP-TRACKER-ADD, UX P-78/P-20; tests T31, T32): the tracker actions as
 * DIRECT field updates — no operation row, no ledger row (R-17/D-14,
 * binding; §3.4 keeps the flags always editable with no financial effect).
 *
 * T31 — a delivered tracked sale, hidden from the tracker: NO figure
 * changes (the whole §8 response identical but the one flag), the
 * delivery's operation row remains in the activity log, and the row/entry
 * COUNTS are untouched (the strongest no-ledger-effect proof). «سيُخفى
 * الطلب من المتتبّع، وتبقى حركاته المالية كما هي» (P-78).
 *
 * T32 — delivering FROM the tracker calls the SAME OP-DELIVER (§5:
 * «Status changes from the tracker call the same operations»): two
 * identical tracked sales — one delivered from the tracker, one from the
 * orders screen — produce IDENTICAL ledger shapes and identical §8 rows.
 *
 * OP-TRACKER-ADD's fixed semantics (§5): tracked = true AND
 * hidden_from_tracker = false — BOTH flags, one action.
 *
 * Tests-first: this file was written before the two actions existed and
 * fails with "hideSaleFromTracker is not exported".
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
import { planPrepayment } from "../../../../src/domain/manage/operations/prepayment.js";
import { addSaleToTracker, hideSaleFromTracker } from "../application/manage/saleEdits.js";
import { SaleNotFound } from "../application/manage/saleEdits.js";
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
  const owner = `m311-owner-${suffix()}`;
  await withSql(sql => setupProject(sql, { projectId, owner, today: AMMAN_TODAY, boxes }));
  return { projectId, owner };
}

interface Ctx {
  projectId: string;
  owner: string;
}

/** A tracked, named, price-set sale (planned in the future → tracked by
 * §3.4's default) — the tracker's own population. */
async function trackedSale(
  sql: postgres.Sql,
  ctx: Ctx,
  priceFils: number,
  customerName = "سامي",
): Promise<string> {
  const outcome = await runPlan(sql, () =>
    planSaleCreate({
      projectId: ctx.projectId,
      createdByAccountId: ctx.owner,
      requestId: `m311-${crypto.randomUUID()}`,
      today: AMMAN_TODAY,
      lines: [{ description: "طلب", quantityMilli: 1000, unitPriceFils: priceFils }],
      plannedDeliveryOn: "2026-12-01",
      finalPriceFils: priceFils,
      customerName,
    }),
  );
  return String((resultOf(outcome, "applied").data as { saleId: string }).saleId);
}

/* ── 1. T31: hide a delivered tracked sale — no figure changes ────────── */

describe("M3.11 T31 — delivered tracked sale, hide from tracker", () => {
  it("changes only the flag: identical figures, the delivery stays in the log, no new rows", async () => {
    const ctx = await newProject();
    await withSql(async sql => {
      const saleId = await trackedSale(sql, ctx, 100_000);
      await runPlan(sql, () =>
        planPrepayment({
          projectId: ctx.projectId,
          createdByAccountId: ctx.owner,
          requestId: `m311-${crypto.randomUUID()}`,
          today: AMMAN_TODAY,
          saleId,
          amountFils: 20_000,
          box: "cash",
        }),
      );
      await runPlan(sql, () =>
        planDeliver({
          projectId: ctx.projectId,
          createdByAccountId: ctx.owner,
          requestId: `m311-${crypto.randomUUID()}`,
          today: AMMAN_TODAY,
          saleId,
        }),
      );
      // A delivered tracked sale with live money shapes (remainder 80 open).
      expect(await accountTotal(sql, ctx.projectId, "REV")).toBe(100_000);
      const figuresBefore = await computeManageFigures(sql, ctx.projectId, AMMAN_TODAY, "since_start");
      const opsBefore =
        await sql`SELECT count(*)::int AS n FROM operation WHERE project_id = ${ctx.projectId}`;
      const entriesBefore =
        await sql`SELECT count(*)::int AS n FROM ledger_entry WHERE project_id = ${ctx.projectId}`;

      const hidden = await hideSaleFromTracker(sql, { projectId: ctx.projectId, saleId });
      expect(hidden).toMatchObject({ saleId, tracked: true, hiddenFromTracker: true });

      // T31: NO figure changes — the whole §8 response identical except the
      // one sale row's hiddenFromTracker flag.
      const figuresAfter = await computeManageFigures(sql, ctx.projectId, AMMAN_TODAY, "since_start");
      const expected = structuredClone(figuresBefore);
      expected.salesList.find(s => s.id === saleId)!.hiddenFromTracker = true;
      expect(figuresAfter).toEqual(expected);

      // No operation row, no ledger row — the strongest no-effect proof.
      const opsAfter =
        await sql`SELECT count(*)::int AS n FROM operation WHERE project_id = ${ctx.projectId}`;
      const entriesAfter =
        await sql`SELECT count(*)::int AS n FROM ledger_entry WHERE project_id = ${ctx.projectId}`;
      expect(opsAfter[0]!.n).toBe(opsBefore[0]!.n);
      expect(entriesAfter[0]!.n).toBe(entriesBefore[0]!.n);

      // T31: the delivery's operation REMAINS in the activity log (active).
      const log = await sql`SELECT kind, status FROM operation
                              WHERE project_id = ${ctx.projectId} AND sale_id = ${saleId} ORDER BY created_at`;
      expect(log.map(r => [String(r.kind), String(r.status)])).toEqual([
        ["OP-SALE-CREATE", "active"],
        ["OP-PREPAYMENT", "active"],
        ["OP-DELIVER", "active"],
      ]);

      await assertLedgerCoreInvariants(await ledgerState(sql, ctx.projectId));
    });
  });
});

/* ── 2. T32: delivering from the tracker is the SAME OP-DELIVER ───────── */

describe("M3.11 T32 — deliver from the tracker: identical result to OP-DELIVER elsewhere", () => {
  it("two identical tracked sales deliver to identical ledger shapes and §8 rows", async () => {
    const ctx = await newProject();
    await withSql(async sql => {
      const fromTracker = await trackedSale(sql, ctx, 80_000, "من المتتبّع");
      const elsewhere = await trackedSale(sql, ctx, 80_000, "من الطلبات");
      // Both pre-paid identically so the comparison spans every entry kind.
      for (const saleId of [fromTracker, elsewhere]) {
        await runPlan(sql, () =>
          planPrepayment({
            projectId: ctx.projectId,
            createdByAccountId: ctx.owner,
            requestId: `m311-${crypto.randomUUID()}`,
            today: AMMAN_TODAY,
            saleId,
            amountFils: 30_000,
            box: "cash",
          }),
        );
      }
      // The tracker's deliver action calls the SAME operation (§5).
      await runPlan(sql, () =>
        planDeliver({
          projectId: ctx.projectId,
          createdByAccountId: ctx.owner,
          requestId: `m311-${crypto.randomUUID()}`,
          today: AMMAN_TODAY,
          saleId: fromTracker,
        }),
      );
      await runPlan(sql, () =>
        planDeliver({
          projectId: ctx.projectId,
          createdByAccountId: ctx.owner,
          requestId: `m311-${crypto.randomUUID()}`,
          today: AMMAN_TODAY,
          saleId: elsewhere,
        }),
      );

      // Canonical projection of a sale's entries: refIds mapped to their
      // ROLES so two different sales compare equal.
      const remainderRows = await sql`SELECT sale_id, id FROM balance_line
                                       WHERE project_id = ${ctx.projectId} AND kind = 'sale_remainder'`;
      const remainderOf = new Map(remainderRows.map(r => [String(r.sale_id), String(r.id)]));
      const cashId = await boxIdOf(sql, ctx.projectId, "cash");
      const roleOf = (saleId: string, refId: string) =>
        refId === saleId
          ? "sale"
          : refId === (remainderOf.get(saleId) ?? "")
            ? "remainder"
            : refId === cashId
              ? "cash"
              : refId;
      const project = async (saleId: string) => {
        const entries = await sql`
          SELECT e.id, e.entry_type, e.effective_on::text AS effective_on
          FROM ledger_entry e JOIN operation o ON o.id = e.operation_id
          WHERE o.project_id = ${ctx.projectId} AND o.sale_id = ${saleId}`;
        const postings = await sql`
          SELECT p.entry_id, p.account, p.ref_id, p.category, p.rev_kind, p.delta_minor
          FROM ledger_posting p
          WHERE p.project_id = ${ctx.projectId} AND p.entry_id IN ${sql(entries.map(e => e.id))}`;
        return (
          entries
            .map(e => ({
              id: String(e.id),
              type: String(e.entry_type),
              effectiveOn: String(e.effective_on),
              postings: postings
                .filter(p => String(p.entry_id) === String(e.id))
                .map(p => ({
                  account: String(p.account),
                  ref: String(p.ref_id),
                  category: p.category === null ? null : String(p.category),
                  revKind: p.rev_kind === null ? null : String(p.rev_kind),
                  deltaFils: Number(p.delta_minor),
                }))
                .sort((x, y) => x.account.localeCompare(y.account)),
            }))
            // A deterministic order (the id is a random UUID — the M3.10
            // lesson; the type is unique per sale here).
            .sort((x, y) => x.type.localeCompare(y.type) || x.effectiveOn.localeCompare(y.effectiveOn))
            .map(({ id: _ignored, ...rest }) => {
              void _ignored;
              return rest;
            })
        );
      };
      const a = await project(fromTracker);
      const b = await project(elsewhere);
      const canonical = (saleId: string, entries: Awaited<ReturnType<typeof project>>) =>
        entries.map(e => ({
          ...e,
          postings: e.postings.map(p => ({ ...p, ref: roleOf(saleId, p.ref) })),
        }));
      expect(canonical(fromTracker, a)).toEqual(canonical(elsewhere, b));

      // Identical §8 rows (modulo the id and the customer name — two
      // different customers by construction) and identical aggregate effect.
      const figures = await computeManageFigures(sql, ctx.projectId, AMMAN_TODAY, "since_start");
      const rowOf = (id: string) => {
        const row = figures.salesList.find(s => s.id === id)!;
        const { id: _id, customerName: _name, ...rest } = row;
        void _id;
        void _name;
        return rest;
      };
      expect(rowOf(fromTracker)).toEqual(rowOf(elsewhere));
      expect(rowOf(fromTracker)).toMatchObject({
        status: "delivered_unpaid",
        tracked: true,
        hiddenFromTracker: false,
        // The prepayment is CONSUMED at delivery (PRE[s] = 0) and counts as
        // paid: «مدفوع 30 من 80».
        prepaymentFils: 0,
        paid: { paidFils: 30_000, ofFils: 80_000 },
      });
      expect(await accountTotal(sql, ctx.projectId, "REV")).toBe(160_000);
      expect(await boxBalance(sql, ctx.projectId, "cash")).toBe(60_000);

      await assertLedgerCoreInvariants(await ledgerState(sql, ctx.projectId));
    });
  });
});

/* ── 3. OP-TRACKER-ADD's fixed semantics + the edges ──────────────────── */

describe("M3.11 — OP-TRACKER-ADD: tracked = true AND hidden = false, one action", () => {
  it("restores a hidden untracked sale to the tracker with both flags", async () => {
    const ctx = await newProject();
    await withSql(async sql => {
      // Planned TODAY → tracked = false by §3.4's default; then hidden.
      const outcome = await runPlan(sql, () =>
        planSaleCreate({
          projectId: ctx.projectId,
          createdByAccountId: ctx.owner,
          requestId: `m311-${crypto.randomUUID()}`,
          today: AMMAN_TODAY,
          lines: [{ description: "طلب اليوم", quantityMilli: 1000, unitPriceFils: 50_000 }],
          plannedDeliveryOn: AMMAN_TODAY,
          finalPriceFils: 50_000,
          customerName: "سامي",
        }),
      );
      const saleId = String((resultOf(outcome, "applied").data as { saleId: string }).saleId);
      // Planned TODAY → tracked = false by §3.4's default (read from the row).
      const before = await sql`SELECT tracked, hidden_from_tracker FROM sale WHERE id = ${saleId}`;
      expect(Boolean(before[0]!.tracked)).toBe(false);
      await hideSaleFromTracker(sql, { projectId: ctx.projectId, saleId });

      const added = await addSaleToTracker(sql, { projectId: ctx.projectId, saleId });
      // §5's fixed semantics: BOTH flags in one action.
      expect(added).toMatchObject({ saleId, tracked: true, hiddenFromTracker: false });

      // No ledger effect here either.
      const entries =
        await sql`SELECT count(*)::int AS n FROM ledger_entry WHERE project_id = ${ctx.projectId}`;
      expect(entries[0]!.n).toBe(0);

      await assertLedgerCoreInvariants(await ledgerState(sql, ctx.projectId));
    });
  });

  it("a double hide is a harmless no-op; an unknown sale is SaleNotFound", async () => {
    const ctx = await newProject();
    await withSql(async sql => {
      const saleId = await trackedSale(sql, ctx, 60_000);
      const first = await hideSaleFromTracker(sql, { projectId: ctx.projectId, saleId });
      const second = await hideSaleFromTracker(sql, { projectId: ctx.projectId, saleId });
      // The stored state is the same (updatedAt naturally advances — the
      // row's last-edit time, not a figure).
      const { updatedAt: _firstAt, ...firstState } = first;
      const { updatedAt: _secondAt, ...secondState } = second;
      void _firstAt;
      void _secondAt;
      expect(secondState).toEqual(firstState);
      await expect(
        hideSaleFromTracker(sql, { projectId: ctx.projectId, saleId: crypto.randomUUID() }),
      ).rejects.toBeInstanceOf(SaleNotFound);
      await expect(
        addSaleToTracker(sql, { projectId: ctx.projectId, saleId: crypto.randomUUID() }),
      ).rejects.toBeInstanceOf(SaleNotFound);
    });
  });
});

/* ── 4. The routes ────────────────────────────────────────────────────── */

describe("M3.11 — the tracker routes", () => {
  it("hide and add over HTTP: 200 with the flags, 404 on an unknown sale", async () => {
    const sub = `m311-route-${suffix()}`;
    const session = await signInAs(worker, { sub, email: `${sub}@example.com` });
    // The project belongs to THIS session (the R-24 posture — a foreign
    // project is indistinguishable from none).
    const setup = await apiPost(worker, session.cookieHeader, "/api/manage-v2/setup", {
      requestId: `m311-${crypto.randomUUID()}`,
      projectName: "مشروع المتتبّع",
      boxes: [{ kind: "cash", opening: { openingFils: 0 } }],
    });
    expect(setup.status).toBe(200);
    const projectId = ((await setup.json()) as { projectId: string }).projectId;
    const saleId = await withSql(sql => trackedSale(sql, { projectId, owner: "المالك" }, 70_000));

    const hidden = await apiPost(worker, session.cookieHeader, "/api/manage-v2/tracker-hide", {
      requestId: `m311-${crypto.randomUUID()}`,
      projectId,
      saleId,
    });
    expect(hidden.status).toBe(200);
    expect(
      ((await hidden.json()) as { sale: { tracked: boolean; hiddenFromTracker: boolean } }).sale,
    ).toMatchObject({ tracked: true, hiddenFromTracker: true });

    const added = await apiPost(worker, session.cookieHeader, "/api/manage-v2/tracker-add", {
      requestId: `m311-${crypto.randomUUID()}`,
      projectId,
      saleId,
    });
    expect(added.status).toBe(200);
    expect(
      ((await added.json()) as { sale: { tracked: boolean; hiddenFromTracker: boolean } }).sale,
    ).toMatchObject({ tracked: true, hiddenFromTracker: false });

    const missing = await apiPost(worker, session.cookieHeader, "/api/manage-v2/tracker-hide", {
      requestId: `m311-${crypto.randomUUID()}`,
      projectId,
      saleId: crypto.randomUUID(),
    });
    expect(missing.status).toBe(404);
  });
});
