/**
 * M2.12 acceptance (Manage v2 phase 2, wave J — spec §14.6, S5 export/delete
 * surface, SRV-07; the M2.1-documented forward path: the one internal
 * function allowed to delete ledger rows disables the append-only guards
 * INSIDE its single transaction and re-enables them before commit):
 * export and delete over the NEW §3 tables — export produces a v2 envelope
 * under a locked read; deletion covers every Manage table including
 * entries and postings, leaves no orphan, and never lands halfway.
 *
 * Tests-first: this file was written before the module existed and fails
 * with "Cannot find module … application/manage/exportDelete.js".
 *
 * Posture: Miniflare over the per-file isolated PostgreSQL. The module
 * functions run against the real database; the lifecycle route's MANAGE
 * branch is exercised end-to-end (signInAs + fetch). The v1 lifecycle
 * behavior is untouched (its own suites stay green).
 */
import type postgres from "postgres";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { apiPost, signInAs, startWorker, type WorkerInstance } from "./harness.ts";
import { fileSqlUrl, runPlan, scopedClient, setupProject } from "./manage.v2.helpers.ts";
import {
  deleteManageProject,
  exportManageProject,
  MANAGE_EXPORT_FORMAT,
  MANAGE_EXPORT_VERSION,
} from "../application/manage/exportDelete.js";
import { planExpense } from "../../../../src/domain/manage/operations/expense.js";
import { planPay } from "../../../../src/domain/manage/operations/pay.js";
import { planOwnerDeposit } from "../../../../src/domain/manage/operations/ownerMoney.js";

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

/** A project with real data across the table families. */
async function populatedProject() {
  const projectId = crypto.randomUUID();
  const owner = `m212-owner-${suffix()}`;
  await withSql(sql =>
    setupProject(sql, {
      projectId,
      owner,
      today: AMMAN_TODAY,
      boxes: [
        { kind: "cash", opening: { openingFils: 500_000 } },
        { kind: "account", opening: { openingFils: 0 } },
      ],
    }),
  );
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
  });
  return { projectId, owner };
}

/** Every §3 Manage table's row count for the project (the orphan check). */
const MANAGE_TABLES = [
  "project",
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
  "manage_v2_idempotency",
] as const;

async function manageRowCounts(sql: postgres.Sql, projectId: string): Promise<Record<string, number>> {
  const counts: Record<string, number> = {};
  for (const table of MANAGE_TABLES) {
    if (table === "project") {
      const rows = await sql`SELECT count(*)::int AS n FROM project WHERE id = ${projectId}`;
      counts.project = Number(rows[0]!.n);
      continue;
    }
    const rows = await sql`SELECT count(*)::int AS n FROM ${sql(table)} WHERE project_id = ${projectId}`;
    counts[table] = Number(rows[0]!.n);
  }
  return counts;
}

/** A real ledger_entry id of the project — the guard proof needs a row the
 * DELETE actually MATCHES (M2.1's verified trigger semantics: it is a ROW
 * trigger, so a zero-row DELETE fires nothing and succeeds). */
async function anyEntryId(sql: postgres.Sql, projectId: string): Promise<string> {
  const rows = await sql`SELECT id FROM ledger_entry WHERE project_id = ${projectId} LIMIT 1`;
  if (rows.length === 0) {
    throw new Error("no ledger_entry row to prove the append-only guard with");
  }
  return String(rows[0]!.id);
}

/** True when a manual ledger DELETE on a REAL row is rejected at the
 * database level (the append-only guard is armed). */
async function manualLedgerDeleteRejected(sql: postgres.Sql, entryId: string): Promise<boolean> {
  try {
    await sql`DELETE FROM ledger_entry WHERE id = ${entryId}`;
    return false;
  } catch {
    return true;
  }
}

/* ── 1. The v2 export envelope ─────────────────────────────────────────── */

describe("M2.12 — the v2 export envelope", () => {
  it("carries every table's rows with format/version 2 and a data-only stable digest", async () => {
    const { projectId } = await populatedProject();
    const first = await withSql(sql => exportManageProject(sql, projectId));
    expect(first.envelope.format).toBe(MANAGE_EXPORT_FORMAT);
    expect(first.envelope.version).toBe(MANAGE_EXPORT_VERSION);
    // The data families: boxes, a supplier line, operations, entries and
    // postings — all present with their rows.
    expect(first.envelope.boxes).toHaveLength(2);
    expect(first.envelope.balanceLines.length).toBeGreaterThanOrEqual(1);
    expect(first.envelope.operations.length).toBeGreaterThanOrEqual(4);
    expect(first.envelope.entries.length).toBeGreaterThanOrEqual(4);
    expect(first.envelope.postings.length).toBeGreaterThanOrEqual(8);
    expect(first.envelope.project.id).toBe(projectId);
    // The digest covers the DATA (not the export timestamp): a second
    // export of the same state produces the very same digest.
    const second = await withSql(sql => exportManageProject(sql, projectId));
    expect(second.digest).toBe(first.digest);
    // An unknown project does not export.
    await expect(withSql(sql => exportManageProject(sql, crypto.randomUUID()))).rejects.toThrow(/not_found/);
  });
});

/* ── 2. The deletion: every table, no orphan, guards intact ───────────── */

describe("M2.12 — the deletion", () => {
  it("deletes every Manage table's rows and leaves the append-only guards armed", async () => {
    const { projectId } = await populatedProject();
    const before = await withSql(sql => manageRowCounts(sql, projectId));
    expect(before.project).toBe(1);
    expect(before.ledger_posting).toBeGreaterThan(0);

    const result = await withSql(sql => deleteManageProject(sql, projectId));
    expect(result.deleted.ledger_posting).toBe(before.ledger_posting);
    expect(result.deleted.ledger_entry).toBe(before.ledger_entry);
    expect(result.deleted.project).toBe(1);

    const after = await withSql(sql => manageRowCounts(sql, projectId));
    expect(after).toEqual(Object.fromEntries(MANAGE_TABLES.map(t => [t, 0])));
    // The append-only guards are re-armed: a manual ledger DELETE on a REAL
    // row of a FRESH project is still rejected at the database level after
    // the deletion path ran (a zero-row DELETE proves nothing — the guard
    // is a ROW trigger, so the delete must match a live row).
    const fresh = await populatedProject();
    const freshEntryId = await withSql(sql => anyEntryId(sql, fresh.projectId));
    const guardArmed = await withSql(sql => manualLedgerDeleteRejected(sql, freshEntryId));
    expect(guardArmed).toBe(true);
    // Deleting again: the documented error (the project is gone).
    await expect(withSql(sql => deleteManageProject(sql, projectId))).rejects.toThrow(
      /project_already_deleted/,
    );
  });

  it("never lands halfway: an injected failure after the first table rolls back everything", async () => {
    const { projectId } = await populatedProject();
    const before = await withSql(sql => manageRowCounts(sql, projectId));
    await expect(
      withSql(sql => deleteManageProject(sql, projectId, { injectFailureAfterFirstTable: true })),
    ).rejects.toThrow(/injected failure/);
    const after = await withSql(sql => manageRowCounts(sql, projectId));
    expect(after).toEqual(before);
    // The guards are armed after the rollback too (the DDL rolled back) —
    // proven on a REAL row of the restored project.
    const entryId = await withSql(sql => anyEntryId(sql, projectId));
    const guard = await withSql(sql => manualLedgerDeleteRejected(sql, entryId));
    expect(guard).toBe(true);
  });

  it("export-first is enforced INSIDE the deletion lock: a stale digest refuses and deletes nothing", async () => {
    const { projectId, owner } = await populatedProject();
    const before = await withSql(sql => manageRowCounts(sql, projectId));
    const stale = await withSql(sql => exportManageProject(sql, projectId));
    // A write lands after that export: the state the owner confirmed is
    // no longer the live state.
    await withSql(sql =>
      runPlan(sql, () =>
        planExpense({
          projectId,
          createdByAccountId: owner,
          requestId: `req-${suffix()}`,
          today: AMMAN_TODAY,
          amountFils: 10_000,
          category: "gas",
          payment: { type: "full" },
          source: "cash",
        }),
      ),
    );
    await expect(
      withSql(sql => deleteManageProject(sql, projectId, { expectedDigest: stale.digest })),
    ).rejects.toThrow(/export_digest_mismatch/);
    const after = await withSql(sql => manageRowCounts(sql, projectId));
    expect(after.project).toBe(1);
    expect(after.ledger_entry).toBe(before.ledger_entry + 1);
    // The digest of a CURRENT export deletes: the check is the
    // export-first rule, not a refusal to ever delete.
    const fresh = await withSql(sql => exportManageProject(sql, projectId));
    const result = await withSql(sql =>
      deleteManageProject(sql, projectId, { expectedDigest: fresh.digest }),
    );
    expect(result.deleted.project).toBe(1);
    const zeroed = await withSql(sql => manageRowCounts(sql, projectId));
    expect(Object.values(zeroed).every(n => n === 0)).toBe(true);
  });

  it("two concurrent deletes: exactly one wins, the other gets the documented error", async () => {
    const { projectId } = await populatedProject();
    const results = await Promise.allSettled([
      withSql(sql => deleteManageProject(sql, projectId)),
      withSql(sql => deleteManageProject(sql, projectId)),
    ]);
    const winners = results.filter(r => r.status === "fulfilled");
    const losers = results.filter(r => r.status === "rejected");
    expect(winners).toHaveLength(1);
    expect(losers).toHaveLength(1);
    expect((losers[0] as PromiseRejectedResult).reason.message).toMatch(/project_already_deleted/);
    const counts = await withSql(sql => manageRowCounts(sql, projectId));
    expect(Object.values(counts).every(n => n === 0)).toBe(true);
  });
});

/* ── 3. The lifecycle route's MANAGE branch (end-to-end) ──────────────── */

describe("M2.12 — the lifecycle route's manage branch", () => {
  it("exports and deletes a Manage project end-to-end; export-first is enforced; R-24 and 401", async () => {
    const sub = `m212-route-${suffix()}`;
    const session = await signInAs(worker, { sub, email: `${sub}@example.com` });
    const setup = await apiPost(worker, session.cookieHeader, "/api/manage-v2/setup", {
      requestId: `route-${suffix()}`,
      projectName: "مشروع الحذف",
      boxes: [{ kind: "cash", opening: { openingFils: 100_000 } }],
    });
    expect(setup.status).toBe(200);
    const projectId = ((await setup.json()) as { projectId: string }).projectId;

    // The export (GET) returns the v2 envelope.
    const exportResponse = await worker.fetch(`/api/account/projects/${projectId}/export`, {
      headers: { cookie: session.cookieHeader },
    });
    expect(exportResponse.status).toBe(200);
    const envelope = (await exportResponse.json()) as {
      format: string;
      version: number;
      digest: string;
      data: { boxes: unknown[] };
    };
    expect(envelope.format).toBe("micro-manage-export");
    expect(envelope.version).toBe(2);
    expect(envelope.data.boxes).toHaveLength(1);

    // Deletion without the digest of a current export is refused.
    const noDigest = await apiPost(
      worker,
      session.cookieHeader,
      `/api/account/projects/${projectId}/delete`,
      {
        confirm: "حذف",
      },
    );
    expect(noDigest.status).toBe(409);
    expect(
      ((await noDigest.json()) as { error: { details?: { reason?: string } } }).error.details?.reason,
    ).toBe("export_required");

    // A wrong confirmation token is refused.
    const wrongConfirm = await apiPost(
      worker,
      session.cookieHeader,
      `/api/account/projects/${projectId}/delete`,
      {
        confirm: "حذف ",
        exportDigest: envelope.digest,
      },
    );
    expect(wrongConfirm.status).toBe(400);

    // R-24: another account gets 404 on the manage branch; anonymous 401.
    const otherSub = `m212-other-${suffix()}`;
    const other = await signInAs(worker, { sub: otherSub, email: `${otherSub}@example.com` });
    const foreignExport = await worker.fetch(`/api/account/projects/${projectId}/export`, {
      headers: { cookie: other.cookieHeader },
    });
    expect(foreignExport.status).toBe(404);
    const anonymous = await worker.fetch(`/api/account/projects/${projectId}/export`);
    expect(anonymous.status).toBe(401);

    // The real deletion: confirm + the current export's digest.
    const deleteResponse = await apiPost(
      worker,
      session.cookieHeader,
      `/api/account/projects/${projectId}/delete`,
      {
        confirm: "حذف",
        exportDigest: envelope.digest,
      },
    );
    expect(deleteResponse.status).toBe(200);
    const deleted = (await deleteResponse.json()) as { ok: boolean; deleted: { project: number } };
    expect(deleted.ok).toBe(true);
    expect(deleted.deleted.project).toBe(1);

    await withSql(async sql => {
      const counts = await manageRowCounts(sql, projectId);
      expect(Object.values(counts).every(n => n === 0)).toBe(true);
    });

    // The v1 lifecycle is untouched: a workspace id still answers the v1
    // path (404 for an unknown id — same honest code as before).
    const v1path = await worker.fetch(`/api/account/projects/${crypto.randomUUID()}/export`, {
      headers: { cookie: session.cookieHeader },
    });
    expect(v1path.status).toBe(404);
  });
});
