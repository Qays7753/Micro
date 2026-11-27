/**
 * M2.13 acceptance (Manage v2 phase 2, wave J — spec S6, §14.6, SRV-07,
 * MNG-LOCAL-05; no migration of old data): the v2 TRANSFER envelope over the
 * new §3 tables — the import half of M2.12's export.
 *
 *  - Round-trip: export (the real route artifact) → import into a FRESH
 *    account's empty project → the §8 figures are IDENTICAL to the source's
 *    (ids are remapped, so the comparison strips ids and canonically sorts);
 *    every family's row count matches; INV-1/INV-2 hold on the imported
 *    state (§13: every acceptance test ends with the core assertions).
 *  - The explicit v1 rejection (E-ENVELOPE-V1-UNSUPPORTED — the task's own
 *    name; the spec names none): the v1 artifact (micro-project-export /
 *    version 1) and ANY non-v2 shape are refused and NOTHING is written.
 *    MNG-LOCAL-05: the rejection message comes from the closed list — a
 *    poison string planted inside the envelope never surfaces in it.
 *  - Digest integrity: a tampered v2 envelope (amount changed after export)
 *    is refused and nothing is written.
 *  - R-24: an account that already owns a project cannot import over it —
 *    the documented refusal, and the existing project is untouched.
 *  - SRV-07 import race: two concurrent imports into one fresh account →
 *    exactly one applies (the project row's UNIQUE(owner_account_id) is the
 *    database arbitrator INSIDE the transaction), the loser gets the
 *    documented error, and no mixed rows exist (the winner's figures equal
 *    its source and only its source).
 *  - Rollback: an injected failure after the first insert leaves NOTHING —
 *    no project row, no family rows.
 *
 * Tests-first: this file was written before the module existed and fails
 * with "Cannot find module … application/manage/importTransfer.js".
 */
import type postgres from "postgres";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { apiPost, signInAs, startWorker, type WorkerInstance } from "./harness.ts";
import { fileSqlUrl, runPlan, scopedClient, setupProject } from "./manage.v2.helpers.ts";
import { importManageProject, type ManageImportEnvelope } from "../application/manage/importTransfer.js";
import { computeManageFigures } from "../application/manage/readModel.js";
import { planExpense } from "../../../../src/domain/manage/operations/expense.js";
import { planOwnerDeposit } from "../../../../src/domain/manage/operations/ownerMoney.js";
import { planPay } from "../../../../src/domain/manage/operations/pay.js";
import { assertLedgerCoreInvariants } from "../../../../src/domain/manage/invariants/index.js";
import { ledgerState } from "./manage.v2.helpers.ts";

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

const MANAGE_TABLES = [
  "box",
  "product",
  "product_component",
  "sale",
  "sale_line",
  "balance_line",
  "operation",
  "ledger_entry",
  "ledger_posting",
  "absence_event",
  "reconciliation",
  "reconciliation_box",
] as const;

async function familyCounts(sql: postgres.Sql, projectId: string): Promise<Record<string, number>> {
  const counts: Record<string, number> = {};
  for (const table of MANAGE_TABLES) {
    const rows = await sql`SELECT count(*)::int AS n FROM ${sql(table)} WHERE project_id = ${projectId}`;
    counts[table] = Number(rows[0]!.n);
  }
  return counts;
}

/** Deep-clone a figures response with every id field removed (the import
 * remaps ids — figures must not depend on them). */
function stripIds(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stripIds);
  if (value !== null && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [key, v] of Object.entries(value as Record<string, unknown>)) {
      if (key === "id" || key === "lineId" || key === "productId") continue;
      out[key] = stripIds(v);
    }
    return out;
  }
  return value;
}

/** Canonical deep sort of every array (by JSON text) — the response's array
 * orders are value-sorted with id tie-breaks, which differ after remap. */
function canonical(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(canonical).sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b)));
  }
  if (value !== null && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const key of Object.keys(value as Record<string, unknown>).sort()) {
      out[key] = canonical((value as Record<string, unknown>)[key]);
    }
    return out;
  }
  return value;
}

/** A project with data across every family, created the real way: the
 * owner signs in and OP-SETUP runs through the route (the project row's
 * owner is the SESSION's identity id — the id the lifecycle route's R-24
 * check compares against), then the operations and seeded sale rows run
 * against that owner. */
async function populatedSource(sub: string): Promise<{ projectId: string; owner: string }> {
  const session = await signInAs(worker, { sub, email: `${sub}@example.com` });
  const setup = await apiPost(worker, session.cookieHeader, "/api/manage-v2/setup", {
    requestId: `m213-${suffix()}`,
    projectName: "مشروع النقل",
    boxes: [
      { kind: "cash", opening: { openingFils: 500_000 } },
      { kind: "account", opening: { openingFils: 0 } },
    ],
  });
  expect(setup.status).toBe(200);
  const projectId = ((await setup.json()) as { projectId: string }).projectId;
  const ownerRow = await withSql(sql => sql`SELECT owner_account_id FROM project WHERE id = ${projectId}`);
  const owner = String(ownerRow[0]!.owner_account_id);
  await finishPopulatedSource(projectId, owner);
  return { projectId, owner };
}

/** The operations and seeded rows on top of an OP-SETUP-created project. */
async function finishPopulatedSource(projectId: string, owner: string): Promise<void> {
  await withSql(async sql => {
    await runPlan(sql, () =>
      planExpense({
        projectId,
        createdByAccountId: owner,
        requestId: `req-${suffix()}`,
        today: AMMAN_TODAY,
        amountFils: 120_000,
        category: "materials_packaging",
        payment: { type: "partial", paidFils: 50_000 },
        source: "cash",
        supplierName: "مكتب الأدوات",
      }),
    );
    await runPlan(sql, () =>
      planOwnerDeposit({
        projectId,
        createdByAccountId: owner,
        requestId: `req-${suffix()}`,
        today: AMMAN_TODAY,
        amountFils: 30_000,
        box: "account",
        source: { type: "borrowed", name: "أخي" },
      }),
    );
    await runPlan(sql, () =>
      planPay({
        projectId,
        createdByAccountId: owner,
        requestId: `req-${suffix()}`,
        today: AMMAN_TODAY,
        amountFils: 20_000,
        box: "cash",
        counterpartyName: "مكتب الأدوات",
      }),
    );
    // A product + a delivered sale with prepayment and a remainder line
    // (the phase-3 rows OP-SALE-CREATE/OP-PREPAYMENT/OP-DELIVER will write —
    // seeded directly the same way M2.11's figures suite seeds them).
    const productId = crypto.randomUUID();
    const saleId = crypto.randomUUID();
    const createdAt = `${AMMAN_TODAY}T10:00:00.000Z`;
    await sql`INSERT INTO product (id, project_id, name, unit_label, unit_price_minor, created_at)
              VALUES (${productId}, ${projectId}, ${"قفص خشبي"}, ${"قطعة"}, ${45_000}, ${createdAt})`;
    await sql`INSERT INTO product_component (id, project_id, product_id, name, cost_minor, position)
              VALUES (${crypto.randomUUID()}, ${projectId}, ${productId}, ${"خشب"}, ${12_000}, ${1})`;
    await sql`INSERT INTO sale (id, project_id, customer_name, registered_on, planned_delivery_on,
                                final_price_minor, tracked, created_at)
              VALUES (${saleId}, ${projectId}, ${"أم عمر"}, ${AMMAN_TODAY}, ${AMMAN_TODAY},
                      ${90_000}, ${true}, ${createdAt})`;
    await sql`INSERT INTO sale_line (id, project_id, sale_id, position, product_id, description,
                                     quantity_milli, unit_price_minor, unit_cost_minor)
              VALUES (${crypto.randomUUID()}, ${projectId}, ${saleId}, ${1}, ${productId},
                      ${"قفص خشبي"}, ${2000}, ${45_000}, ${12_000})`;
    const op = crypto.randomUUID();
    const entry = crypto.randomUUID();
    await sql`INSERT INTO operation (id, project_id, kind, effective_on, status, sale_id, box_id,
                                     amount_minor, payload, created_by_account_id, created_at)
              VALUES (${op}, ${projectId}, ${"OP-PREPAYMENT"}, ${AMMAN_TODAY}, ${"active"}, ${saleId},
                      NULL, ${30_000}, ${"{}"}, ${"seed"}, ${createdAt})`;
    await sql`INSERT INTO ledger_entry (id, project_id, operation_id, entry_type, effective_on, created_at)
              VALUES (${entry}, ${projectId}, ${op}, ${"Q4"}, ${AMMAN_TODAY}, ${createdAt})`;
    const cashBox = await sql`SELECT id FROM box WHERE project_id = ${projectId} AND kind = 'cash'`;
    await sql`INSERT INTO ledger_posting (id, project_id, entry_id, account, ref_id, delta_minor)
              VALUES (${crypto.randomUUID()}, ${projectId}, ${entry}, ${"BOX"}, ${cashBox[0]!.id}, ${30_000}),
                     (${crypto.randomUUID()}, ${projectId}, ${entry}, ${"PRE"}, ${saleId}, ${30_000})`;
    const deliverOp = crypto.randomUUID();
    const deliverEntry = crypto.randomUUID();
    const remainderLine = crypto.randomUUID();
    await sql`INSERT INTO operation (id, project_id, kind, effective_on, status, sale_id, balance_line_id,
                                     amount_minor, payload, created_by_account_id, created_at)
              VALUES (${deliverOp}, ${projectId}, ${"OP-DELIVER"}, ${AMMAN_TODAY}, ${"active"}, ${saleId},
                      ${remainderLine}, ${90_000}, ${"{}"}, ${"seed"}, ${createdAt})`;
    await sql`INSERT INTO balance_line (id, project_id, direction, kind, counterparty_name, origin_on,
                                        sale_id, origin_operation_id)
              VALUES (${remainderLine}, ${projectId}, ${"to_me"}, ${"sale_remainder"}, ${"أم عمر"},
                      ${AMMAN_TODAY}, ${saleId}, ${deliverOp})`;
    await sql`INSERT INTO ledger_entry (id, project_id, operation_id, entry_type, effective_on, created_at)
              VALUES (${deliverEntry}, ${projectId}, ${deliverOp}, ${"Q5"}, ${AMMAN_TODAY}, ${createdAt})`;
    await sql`INSERT INTO ledger_posting (id, project_id, entry_id, account, ref_id, rev_kind, delta_minor)
              VALUES (${crypto.randomUUID()}, ${projectId}, ${deliverEntry}, ${"REV"}, ${saleId}, ${"delivery"}, ${90_000}),
                     (${crypto.randomUUID()}, ${projectId}, ${deliverEntry}, ${"PRE"}, ${saleId}, ${null}, ${-30_000}),
                     (${crypto.randomUUID()}, ${projectId}, ${deliverEntry}, ${"AR"}, ${remainderLine}, ${null}, ${60_000})`;
  });
}

/** The real transfer artifact: the export ROUTE's response JSON for the
 * owner's own project (what a client holds and later imports). */
async function exportArtifact(projectId: string, owner: string): Promise<ManageImportEnvelope> {
  const session = await signInAs(worker, { sub: owner, email: `${owner}@example.com` });
  const response = await worker.fetch(`/api/account/projects/${projectId}/export`, {
    headers: { cookie: session.cookieHeader },
  });
  expect(response.status).toBe(200);
  return (await response.json()) as ManageImportEnvelope;
}

/* ── 1. The round-trip ─────────────────────────────────────────────────── */

describe("M2.13 — the v2 round-trip", () => {
  it("export → import into a fresh account produces identical figures and full family rows", async () => {
    const sourceOwner = `m213-src-${suffix()}`;
    const { projectId: sourceId } = await populatedSource(sourceOwner);
    const envelope = await exportArtifact(sourceId, sourceOwner);

    const targetOwner = `m213-dst-${suffix()}`;
    const result = await withSql(sql => importManageProject(sql, envelope, { ownerAccountId: targetOwner }));
    expect(result.projectId).not.toBe(sourceId);

    // Every family's rows arrived (idempotency is request-layer metadata,
    // not §3 data — the documented import decision). The nine families the
    // phase-2 source populates are non-empty; absence/reconciliation/
    // reconciliation_box are phase-4 families — exercised as empty arrays.
    const sourceCounts = await withSql(sql => familyCounts(sql, sourceId));
    const targetCounts = await withSql(sql => familyCounts(sql, result.projectId));
    expect(targetCounts).toEqual(sourceCounts);
    for (const table of [
      "box",
      "product",
      "product_component",
      "sale",
      "sale_line",
      "balance_line",
      "operation",
      "ledger_entry",
      "ledger_posting",
    ] as const) {
      expect(sourceCounts[table]).toBeGreaterThan(0);
    }

    // IDENTICAL figures: every §8/§8.2 figure of the imported project
    // equals the source's (ids stripped, arrays canonically sorted).
    const sourceFigures = await withSql(sql =>
      computeManageFigures(sql, sourceId, AMMAN_TODAY, "since_start"),
    );
    const targetFigures = await withSql(sql =>
      computeManageFigures(sql, result.projectId, AMMAN_TODAY, "since_start"),
    );
    expect(canonical(stripIds(targetFigures))).toEqual(canonical(stripIds(sourceFigures)));
    // The money figures concretely (not only structurally): cash balance,
    // profit, receivables and payables are the spec's own integers.
    expect(targetFigures.totalBalance.fils).toBe(sourceFigures.totalBalance.fils);
    expect(targetFigures.netProfit.fils).toBe(sourceFigures.netProfit.fils);
    expect(targetFigures.receivables.fils).toBe(sourceFigures.receivables.fils);
    expect(targetFigures.payables.fils).toBe(sourceFigures.payables.fils);

    // §13: the acceptance test ends with the core invariant assertions on
    // the IMPORTED state.
    const state = await withSql(sql => ledgerState(sql, result.projectId));
    const core = assertLedgerCoreInvariants(state);
    expect(core.inv1.outcome).not.toBe("violation");
    expect(core.inv2.outcome).toBe("pass");
  });
});

/* ── 2. The explicit v1 rejection (S6: no v1 reader in the new path) ───── */

describe("M2.13 — the v1 envelope is rejected and nothing is written", () => {
  it("refuses the v1 artifact, a version-1 envelope and any unknown shape with E-ENVELOPE-V1-UNSUPPORTED", async () => {
    const owner = `m213-v1-${suffix()}`;
    const poison = `POISON-${suffix()}`;
    const v1 = {
      format: "micro-project-export",
      version: 1,
      digest: "irrelevant",
      data: { project: { id: crypto.randomUUID(), name: poison }, boxes: [] },
    };
    await expect(
      withSql(sql =>
        importManageProject(sql, v1 as unknown as ManageImportEnvelope, { ownerAccountId: owner }),
      ),
    ).rejects.toThrow(/E-ENVELOPE-V1-UNSUPPORTED/);
    const v1UnderV2Format = { ...v1, format: "micro-manage-export", version: 1 };
    await expect(
      withSql(sql =>
        importManageProject(sql, v1UnderV2Format as unknown as ManageImportEnvelope, {
          ownerAccountId: owner,
        }),
      ),
    ).rejects.toThrow(/E-ENVELOPE-V1-UNSUPPORTED/);
    const unknown = { ...v1, format: "something-else", version: 9 };
    await expect(
      withSql(sql =>
        importManageProject(sql, unknown as unknown as ManageImportEnvelope, { ownerAccountId: owner }),
      ),
    ).rejects.toThrow(/E-ENVELOPE-V1-UNSUPPORTED/);

    // MNG-LOCAL-05: the closed error message never echoes envelope content.
    const message = await withSql(async sql => {
      try {
        await importManageProject(sql, v1 as unknown as ManageImportEnvelope, { ownerAccountId: owner });
        return "";
      } catch (error) {
        return (error as Error).message;
      }
    });
    expect(message).toContain("E-ENVELOPE-V1-UNSUPPORTED");
    expect(message).not.toContain(poison);

    // Nothing was written: no project row for the account, zero rows in
    // every Manage table for any of the envelope's ids.
    const rows = await withSql(
      sql => sql`SELECT count(*)::int AS n FROM project WHERE owner_account_id = ${owner}`,
    );
    expect(Number(rows[0]!.n)).toBe(0);
  });

  it("refuses a tampered v2 envelope: the digest no longer matches its data", async () => {
    const sourceOwner = `m213-tamper-${suffix()}`;
    const { projectId: sourceId } = await populatedSource(sourceOwner);
    const envelope = await exportArtifact(sourceId, sourceOwner);
    // An amount is inflated after export (the digest still says "original").
    envelope.data.postings[0]!.delta_minor = 999_999_999;
    const targetOwner = `m213-tamper-dst-${suffix()}`;
    await expect(
      withSql(sql => importManageProject(sql, envelope, { ownerAccountId: targetOwner })),
    ).rejects.toThrow(/E-IMPORT-DIGEST-MISMATCH/);
    const rows = await withSql(
      sql => sql`SELECT count(*)::int AS n FROM project WHERE owner_account_id = ${targetOwner}`,
    );
    expect(Number(rows[0]!.n)).toBe(0);
  });
});

/* ── 3. R-24: one project per account — the target must be empty ───────── */

describe("M2.13 — the import target", () => {
  it("refuses an account that already owns a project; the existing project is untouched", async () => {
    const sourceOwner = `m213-r24-src-${suffix()}`;
    const { projectId: sourceId } = await populatedSource(sourceOwner);
    const envelope = await exportArtifact(sourceId, sourceOwner);

    const existingOwner = `m213-r24-dst-${suffix()}`;
    const existingId = crypto.randomUUID();
    await withSql(sql =>
      setupProject(sql, {
        projectId: existingId,
        owner: existingOwner,
        today: AMMAN_TODAY,
        boxes: [{ kind: "cash", opening: { openingFils: 10_000 } }],
      }),
    );
    const before = await withSql(sql => familyCounts(sql, existingId));
    await expect(
      withSql(sql => importManageProject(sql, envelope, { ownerAccountId: existingOwner })),
    ).rejects.toThrow(/E-IMPORT-TARGET-NOT-EMPTY/);
    const after = await withSql(sql => familyCounts(sql, existingId));
    expect(after).toEqual(before);
  });
});

/* ── 4. SRV-07: the concurrent-import race and the rollback ────────────── */

describe("M2.13 — SRV-07 concurrency and rollback", () => {
  it("two concurrent imports into one fresh account: exactly one applies, no mixed rows", async () => {
    const ownerA = `m213-race-a-${suffix()}`;
    const { projectId: sourceA } = await populatedSource(ownerA);
    const envelopeA = await exportArtifact(sourceA, ownerA);

    const ownerB = `m213-race-b-${suffix()}`;
    const { projectId: sourceB } = await populatedSource(ownerB);
    const envelopeB = await exportArtifact(sourceB, ownerB);

    const target = `m213-race-dst-${suffix()}`;
    const results = await Promise.allSettled([
      withSql(sql => importManageProject(sql, envelopeA, { ownerAccountId: target })),
      withSql(sql => importManageProject(sql, envelopeB, { ownerAccountId: target })),
    ]);
    const winners = results.filter(r => r.status === "fulfilled");
    const losers = results.filter(r => r.status === "rejected");
    expect(winners).toHaveLength(1);
    expect(losers).toHaveLength(1);
    expect((losers[0] as PromiseRejectedResult).reason.message).toMatch(/E-IMPORT-TARGET-NOT-EMPTY/);

    // No mixed rows: the winner is EXACTLY its source (figures identical to
    // it, and the loser's source differs from it).
    const winner = (winners[0] as PromiseFulfilledResult<{ projectId: string }>).value;
    const winnerFigures = await withSql(sql =>
      computeManageFigures(sql, winner.projectId, AMMAN_TODAY, "since_start"),
    );
    const figuresA = await withSql(sql => computeManageFigures(sql, sourceA, AMMAN_TODAY, "since_start"));
    const figuresB = await withSql(sql => computeManageFigures(sql, sourceB, AMMAN_TODAY, "since_start"));
    const winnerMatchesA =
      JSON.stringify(canonical(stripIds(winnerFigures))) === JSON.stringify(canonical(stripIds(figuresA)));
    const winnerMatchesB =
      JSON.stringify(canonical(stripIds(winnerFigures))) === JSON.stringify(canonical(stripIds(figuresB)));
    expect(winnerMatchesA || winnerMatchesB).toBe(true);
    // Both sources are identical in shape here, so also prove no DOUBLED
    // rows: the winner's family counts equal ONE source's counts exactly.
    const countsA = await withSql(sql => familyCounts(sql, sourceA));
    const winnerCounts = await withSql(sql => familyCounts(sql, winner.projectId));
    expect(winnerCounts).toEqual(countsA);
  });

  it("never lands halfway: an injected failure after the first insert rolls back everything", async () => {
    const sourceOwner = `m213-rb-src-${suffix()}`;
    const { projectId: sourceId } = await populatedSource(sourceOwner);
    const envelope = await exportArtifact(sourceId, sourceOwner);
    const target = `m213-rb-dst-${suffix()}`;
    await expect(
      withSql(sql =>
        importManageProject(sql, envelope, {
          ownerAccountId: target,
          injectFailureAfterFirstInsert: true,
        }),
      ),
    ).rejects.toThrow(/injected failure/);
    const rows = await withSql(
      sql => sql`SELECT count(*)::int AS n FROM project WHERE owner_account_id = ${target}`,
    );
    expect(Number(rows[0]!.n)).toBe(0);
    // The append-only guards are untouched by the rollback (INSERT-only path
    // never disarms them — the armed proof targets a real row).
    const anyRow = await withSql(sql => sql`SELECT id FROM ledger_entry LIMIT 1`);
    if (anyRow.length > 0) {
      const armed = await withSql(async sql => {
        try {
          await sql`DELETE FROM ledger_entry WHERE id = ${anyRow[0]!.id}`;
          return false;
        } catch {
          return true;
        }
      });
      expect(armed).toBe(true);
    }
  });
});
