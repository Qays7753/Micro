/**
 * M5.2 acceptance (Manage v2 phase 5 — UX P-10/P-11 + §3.1 + R-17/R-24):
 * the project-state read (name + the OPEN absence with its days for the
 * return card) and the rename (a direct update with no operation and no
 * ledger row — INV-1 untouched).
 *
 * Coverage:
 *  1. Fresh project: name echoes OP-SETUP's, openAbsence null (no card).
 *  2. After a 20-day gap detection (§7.2): openAbsence carries the days
 *     since the last record — computed SERVER-side (the client renders).
 *  3. A completed absence never shows (the card disappears after the flow).
 *  4. Rename (P-11): updates the name, no operation row, no ledger row.
 *  5. E-NAME-REQUIRED on an empty rename (§11, verbatim code).
 *  6. R-24 isolation: a foreign/unknown project is the unified 404 — the
 *     surface never confirms another project exists.
 *
 * Tests-first: the first run fails on the not-yet-registered routes.
 *
 * Posture: Miniflare over the per-file isolated PostgreSQL. Money is
 * integer fils. Every path that builds a live state ends with
 * assertLedgerCoreInvariants (INV-1 + INV-2).
 */
import type postgres from "postgres";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { apiGet, apiPost, signInAs, startWorker, type WorkerInstance } from "./harness.ts";
import { fileSqlUrl, ledgerState, runPlan, scopedClient, setupProject } from "./manage.v2.helpers.ts";
import { detectAbsence } from "../application/manage/absence.js";
import { planReconcile } from "../../../../src/domain/manage/operations/reconcile.js";
import { readProjectState, renameProject } from "../application/manage/projectState.js";
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
/** The last record's day: 20 days before today (the §7.2 given-state). */
const LAST_OP_DAY = "2026-11-07";

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

async function newProject(name = "مطبخ أم ليث"): Promise<Ctx> {
  const projectId = crypto.randomUUID();
  const owner = `m52-owner-${suffix()}`;
  await withSql(sql =>
    setupProject(sql, {
      projectId,
      owner,
      today: AMMAN_TODAY,
      boxes: [{ kind: "cash", opening: { openingFils: 100_000 } }],
    }),
  );
  // OP-SETUP writes the project row with its name — echo the P-01 flow.
  await withSql(sql => sql`UPDATE project SET name = ${name} WHERE id = ${projectId}`);
  return { projectId, owner };
}

/** The §7.2 given-state: the LAST operation's created_at moved back (no
 * operation sets created_at) + detection run — the return card's state. */
async function absentProject(name?: string): Promise<Ctx> {
  const ctx = await newProject(name);
  await withSql(
    sql =>
      sql`UPDATE operation SET created_at = ${`${LAST_OP_DAY} 10:00:00+00`}::timestamptz
         WHERE project_id = ${ctx.projectId}`,
  );
  await withSql(async sql => {
    await detectAbsence(sql, { projectId: ctx.projectId, today: AMMAN_TODAY });
  });
  return ctx;
}

/* ── 1. The read: name + the open absence's days ──────────────────────── */

describe("M5.2 — the project state read (P-10's header + return card)", () => {
  it("fresh project: the name echoes setup and there is no return card", async () => {
    const ctx = await newProject();
    await withSql(async sql => {
      const state = await readProjectState(sql, ctx.projectId, AMMAN_TODAY);
      expect(state.name).toBe("مطبخ أم ليث");
      expect(state.openAbsence).toBeNull();
      const invariant = await ledgerState(sql, ctx.projectId);
      assertLedgerCoreInvariants(invariant);
    });
  });

  it("open absence: the days since the last record are computed server-side", async () => {
    const ctx = await absentProject();
    await withSql(async sql => {
      const state = await readProjectState(sql, ctx.projectId, AMMAN_TODAY);
      expect(state.openAbsence).not.toBeNull();
      expect(state.openAbsence!.startedOn).toBe(LAST_OP_DAY);
      expect(state.openAbsence!.daysSinceLastRecord).toBe(20);
      const invariant = await ledgerState(sql, ctx.projectId);
      assertLedgerCoreInvariants(invariant);
    });
  });

  it("a completed absence never shows a card", async () => {
    const ctx = await absentProject();
    await withSql(async sql => {
      await runPlan(sql, () =>
        planReconcile({
          projectId: ctx.projectId,
          createdByAccountId: ctx.owner,
          requestId: `m52-${crypto.randomUUID()}`,
          today: AMMAN_TODAY,
          context: "return_after_absence",
          boxes: [{ box: "cash", countedFils: 100_000, recordedAtStartFils: 100_000 }],
        }),
      );
      const state = await readProjectState(sql, ctx.projectId, AMMAN_TODAY);
      expect(state.openAbsence).toBeNull();
      const invariant = await ledgerState(sql, ctx.projectId);
      assertLedgerCoreInvariants(invariant);
    });
  });
});

/* ── 2. The rename (P-11) ──────────────────────────────────────────────── */

describe("M5.2 — the rename (P-11, R-17: no operation, no ledger row)", () => {
  it("updates the name with zero financial effect", async () => {
    const ctx = await newProject();
    await withSql(async sql => {
      const before = await ledgerState(sql, ctx.projectId);
      const renamed = await renameProject(sql, { projectId: ctx.projectId, name: "حلويات ليان" });
      expect(renamed.name).toBe("حلويات ليان");
      const after = await ledgerState(sql, ctx.projectId);
      expect(after.entries).toHaveLength(before.entries.length);
      expect(after.operations).toHaveLength(before.operations.length);
      assertLedgerCoreInvariants(after);
    });
  });
});

/* ── 3. The routes (R-24 isolation + §11) ──────────────────────────────── */

describe("M5.2 — the project routes", () => {
  /* The session's identity id is generated at sign-in (not the Google sub),
   * so the route tests create their projects THROUGH the setup API — the
   * signed-in identity then owns them (the M4.5 route-test pattern). */
  async function signedInProject(name = "مطبخ أم ليث"): Promise<string> {
    const sub = `m52-route-${suffix()}`;
    const session = await signInAs(worker, { sub, email: `${sub}@example.com` });
    const setup = await apiPost(worker, session.cookieHeader, "/api/manage-v2/setup", {
      requestId: `m52-${crypto.randomUUID()}`,
      projectName: name,
      boxes: [{ kind: "cash", opening: { openingFils: 100_000 } }],
    });
    expect(setup.status).toBe(200);
    return session.cookieHeader;
  }

  it("GET /api/manage-v2/project serves the signed-in owner's project", async () => {
    const cookieHeader = await signedInProject("مطبخ أم ليث");
    const response = await apiGet(worker, cookieHeader, "/api/manage-v2/project");
    expect(response.status).toBe(200);
    const body = (await response.json()) as { name: string; openAbsence: unknown };
    expect(body.name).toBe("مطبخ أم ليث");
    expect(body.openAbsence).toBeNull();
  });

  it("GET with an account that has no project is the unified 404 (R-24)", async () => {
    const { cookieHeader } = await signInAs(worker, {
      sub: `m52-nobody-${suffix()}`,
      email: `m52-nobody-${suffix()}@example.com`,
    });
    const response = await apiGet(worker, cookieHeader, "/api/manage-v2/project");
    expect(response.status).toBe(404);
  });

  it("POST /api/manage-v2/project-name renames then reads back", async () => {
    const cookieHeader = await signedInProject("الاسم القديم");
    const renameResponse = await apiPost(worker, cookieHeader, "/api/manage-v2/project-name", {
      name: "الاسم الجديد",
    });
    expect(renameResponse.status).toBe(200);
    const readBack = await apiGet(worker, cookieHeader, "/api/manage-v2/project");
    const body = (await readBack.json()) as { name: string };
    expect(body.name).toBe("الاسم الجديد");
  });

  it("an empty rename is E-NAME-REQUIRED (§11, verbatim code)", async () => {
    const cookieHeader = await signedInProject();
    const response = await apiPost(worker, cookieHeader, "/api/manage-v2/project-name", {
      name: "   ",
    });
    expect(response.status).toBe(400);
    const body = (await response.json()) as { error: { details: { code: string } } };
    expect(body.error.details.code).toBe("E-NAME-REQUIRED");
  });
});
