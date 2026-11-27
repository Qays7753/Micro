/**
 * Shared plumbing for the Manage v2 operation test files (the M2.5 route
 * correction and every M2.6+ task). NOT a test file: vitest runs
 * `*.test.ts` only, the same convention as `delivery.helpers.ts`.
 *
 *  - fileSqlUrl(): THIS file's isolated database, resolved deterministically
 *    through the harness handle (`current_database()` on the very Db the
 *    worker uses) — never by guessing among the parallel suite's databases.
 *  - runPlan(): the route's composition (domain planner → the M2.4 handler,
 *    the ONE transaction).
 *  - ledgerState(): projects the §3 rows into the LedgerCheckState the
 *    INV-1/INV-2 closing assertion needs (§13: every acceptance test ends
 *    with assertLedgerCoreInvariants).
 *  - accountTotal / boxBalance / lineOutstanding: sums read straight from
 *    ledger_posting — integer fils, no unit conversion anywhere.
 */
import postgres from "postgres";
import { rawDb, type WorkerInstance } from "./harness.ts";
import {
  applyManageOperation,
  type ManageOperationOutcome,
  type StoredManageOperationResult,
} from "../application/manage/operationHandler.ts";
import { planSetup, type SetupBoxSlot } from "../../../../src/domain/manage/operations/setup.js";
import type { OperationPlan } from "../../../../src/domain/manage/operations/support.js";
import type { LedgerCheckState } from "../../../../src/domain/manage/invariants/index.js";

/** Connection URL of THIS test file's isolated database (micro_tf_<tag>). */
export async function fileSqlUrl(worker: WorkerInstance): Promise<string> {
  const base = process.env.MICRO_TEST_PG_CONNECTION;
  if (!base) throw new Error("MICRO_TEST_PG_CONNECTION is not set");
  const db = await rawDb(worker);
  // The Postgres adapter of Db ignores first()'s column-name argument and
  // returns the row — read the field explicitly.
  const row = await db.prepare("select current_database() as name").first<{ name: string }>();
  const name = row?.name ?? "";
  if (name.length === 0) {
    throw new Error("could not resolve this file's harness database");
  }
  return `${base.replace(/\/[^/]*$/, "")}/${name}`;
}

/** A single-connection client (one transaction at a time, released by the
 * caller with `await sql.end()`). */
export function scopedClient(url: string): postgres.Sql {
  return postgres(url, { max: 1 });
}

/** Compose a domain plan with the M2.4 handler — the route's composition.
 * Takes a plan FACTORY: a planner's synchronous validation throw (e.g.
 * E-AMOUNT on bad input) becomes a rejected promise here, so every path is
 * assertable with .rejects. */
export async function runPlan(sql: postgres.Sql, make: () => OperationPlan): Promise<ManageOperationOutcome> {
  const plan = make();
  return applyManageOperation(sql, plan.write, {
    ...(plan.loadState !== undefined ? { loadState: plan.loadState } : {}),
    ...(plan.extraWrites !== undefined ? { extraWrites: plan.extraWrites } : {}),
    ...(plan.resultData !== undefined ? { resultData: plan.resultData } : {}),
    ...(plan.revisionEntries !== undefined ? { revisionEntries: plan.revisionEntries } : {}),
    ...(plan.companion !== undefined ? { companion: plan.companion } : {}),
  });
}

/** The stored result of an outcome, asserting its kind first — the
 * narrowing that lets a test read `.result` type-safely. */
export function resultOf(
  outcome: ManageOperationOutcome,
  expected: "applied" | "replay",
): StoredManageOperationResult {
  if (outcome.outcome !== expected) throw new Error(`expected ${expected}, got ${outcome.outcome}`);
  return outcome.result;
}

/** The §3 rows of one project, projected for INV-1/INV-2. */
export async function ledgerState(sql: postgres.Sql, projectId: string): Promise<LedgerCheckState> {
  const boxes = await sql`SELECT id, status, opening_status FROM box WHERE project_id = ${projectId}`;
  const lines = await sql`SELECT id, direction FROM balance_line WHERE project_id = ${projectId}`;
  const sales =
    await sql`SELECT id, registered_on::text AS registered_on, planned_delivery_on::text AS planned_delivery_on
              FROM sale WHERE project_id = ${projectId}`;
  const saleLines =
    await sql`SELECT id, sale_id, position, product_id, description, quantity_milli, unit_price_minor, unit_cost_minor
              FROM sale_line WHERE project_id = ${projectId}`;
  const operations = await sql`SELECT id, kind, status, corrects_operation_id, reversed_by_operation_id
              FROM operation WHERE project_id = ${projectId}`;
  const entries =
    await sql`SELECT id, operation_id, entry_type, effective_on::text AS effective_on, reverses_entry_id
              FROM ledger_entry WHERE project_id = ${projectId}`;
  const postings = await sql`SELECT entry_id, account, ref_id, category, rev_kind, delta_minor
              FROM ledger_posting WHERE project_id = ${projectId}`;
  return {
    boxes: boxes.map(b => ({ id: b.id, status: b.status, openingStatus: b.opening_status })),
    balanceLines: lines.map(l => ({ id: l.id, direction: l.direction })),
    sales: sales.map(s => ({
      id: s.id,
      registeredOn: s.registered_on,
      plannedDeliveryOn: s.planned_delivery_on,
    })),
    saleLines: saleLines.map(l => ({
      id: l.id,
      saleId: l.sale_id,
      position: l.position,
      productId: l.product_id,
      description: l.description,
      quantityMilli: l.quantity_milli,
      unitPriceFils: l.unit_price_minor === null ? null : Number(l.unit_price_minor),
      unitCostFils: l.unit_cost_minor === null ? null : Number(l.unit_cost_minor),
    })),
    operations: operations.map(o => ({
      id: o.id,
      kind: o.kind,
      status: o.status,
      ...(o.corrects_operation_id ? { correctsOperationId: o.corrects_operation_id } : {}),
      ...(o.reversed_by_operation_id ? { reversedByOperationId: o.reversed_by_operation_id } : {}),
    })),
    entries: entries.map(e => ({
      id: e.id,
      operationId: e.operation_id,
      entryType: e.entry_type,
      effectiveOn: e.effective_on,
      ...(e.reverses_entry_id ? { reversesEntryId: e.reverses_entry_id } : {}),
      postings: postings
        .filter(p => p.entry_id === e.id)
        .map(p => ({
          account: p.account,
          deltaFils: Number(p.delta_minor),
          ...(p.ref_id ? { refId: p.ref_id } : {}),
          ...(p.category ? { category: p.category } : {}),
          ...(p.rev_kind ? { revKind: p.rev_kind } : {}),
        })),
    })),
  };
}

/** Σ of one account over the whole project (fils). */
export async function accountTotal(sql: postgres.Sql, projectId: string, account: string): Promise<number> {
  const rows = await sql`
    SELECT COALESCE(SUM(delta_minor), 0)::bigint AS total
    FROM ledger_posting WHERE project_id = ${projectId} AND account = ${account}`;
  return Number(rows[0]!.total);
}

/** BOX[k] of the project's box of that kind (fils). */
export async function boxBalance(
  sql: postgres.Sql,
  projectId: string,
  kind: "cash" | "account",
): Promise<number> {
  const rows = await sql`
    SELECT COALESCE(SUM(p.delta_minor), 0)::bigint AS total
    FROM ledger_posting p
    JOIN box b ON b.id = p.ref_id AND b.project_id = ${projectId} AND b.kind = ${kind}
    WHERE p.account = 'BOX'`;
  return Number(rows[0]!.total);
}

/** The id of the project's box of that kind. */
export async function boxIdOf(
  sql: postgres.Sql,
  projectId: string,
  kind: "cash" | "account",
): Promise<string> {
  const rows = await sql`SELECT id FROM box WHERE project_id = ${projectId} AND kind = ${kind}`;
  if (rows.length === 0) throw new Error(`no ${kind} box in project`);
  return String(rows[0]!.id);
}

export interface LineRow {
  id: string;
  direction: "to_me" | "by_me";
  kind: string;
  counterpartyName: string | null;
  originOn: string;
  saleId: string | null;
  /** Σ AR[L] or Σ AP[L] (§8.2) — what is still open on the line. */
  outstanding: number;
}

/** Every balance line with its outstanding (computed from the postings). */
export async function linesWithOutstanding(sql: postgres.Sql, projectId: string): Promise<LineRow[]> {
  const rows = await sql`
    SELECT l.id, l.direction, l.kind, l.counterparty_name, l.origin_on::text AS origin_on, l.sale_id,
           COALESCE(SUM(p.delta_minor), 0)::bigint AS outstanding
    FROM balance_line l
    LEFT JOIN ledger_posting p
      ON p.project_id = l.project_id AND p.account IN ('AR', 'AP') AND p.ref_id = l.id
    WHERE l.project_id = ${projectId}
    GROUP BY l.id
    ORDER BY l.origin_on, l.counterparty_name`;
  return rows.map(r => ({
    id: r.id,
    direction: r.direction,
    kind: r.kind,
    counterpartyName: r.counterparty_name,
    originOn: r.origin_on,
    saleId: r.sale_id,
    outstanding: Number(r.outstanding),
  }));
}

export interface OperationRow {
  id: string;
  kind: string;
  status: string;
  effectiveOn: string;
  boxId: string | null;
  balanceLineId: string | null;
  counterpartyName: string | null;
  category: string | null;
  amountMinor: number | null;
  deliveryCostMinor: number | null;
  correctsOperationId: string | null;
  reversedByOperationId: string | null;
}

/** The project's operation rows in creation order. */
export async function operationRows(sql: postgres.Sql, projectId: string): Promise<OperationRow[]> {
  const rows = await sql`
    SELECT id, kind, status, effective_on::text AS effective_on, box_id, balance_line_id, counterparty_name,
           category, amount_minor, delivery_cost_minor, corrects_operation_id, reversed_by_operation_id
    FROM operation WHERE project_id = ${projectId} ORDER BY created_at, id`;
  return rows.map(r => ({
    id: r.id,
    kind: r.kind,
    status: r.status,
    effectiveOn: r.effective_on,
    boxId: r.box_id,
    balanceLineId: r.balance_line_id,
    counterpartyName: r.counterparty_name,
    category: r.category,
    amountMinor: r.amount_minor === null ? null : Number(r.amount_minor),
    deliveryCostMinor: r.delivery_cost_minor === null ? null : Number(r.delivery_cost_minor),
    correctsOperationId: r.corrects_operation_id,
    reversedByOperationId: r.reversed_by_operation_id,
  }));
}

/** A project row with no boxes (the handler's OP-SETUP normally creates it
 * inside its own transaction — used to seed projects for planner tests). */
export async function seedProjectRow(
  sql: postgres.Sql,
  projectId: string,
  ownerAccountId: string,
): Promise<void> {
  await sql`INSERT INTO project (id, name, owner_account_id, created_at)
            VALUES (${projectId}, ${"مشروع اختبار"}, ${ownerAccountId}, now())
            ON CONFLICT (id) DO NOTHING`;
}

/** OP-SETUP through the real composition, on a freshly seeded project. */
export async function setupProject(
  sql: postgres.Sql,
  input: { projectId: string; owner: string; today: string; boxes: SetupBoxSlot[] },
): Promise<ManageOperationOutcome> {
  await seedProjectRow(sql, input.projectId, input.owner);
  return runPlan(sql, () =>
    planSetup({
      projectId: input.projectId,
      createdByAccountId: input.owner,
      requestId: `setup-${crypto.randomUUID()}`,
      projectName: "مشروع اختبار",
      today: input.today,
      boxes: input.boxes,
    }),
  );
}
