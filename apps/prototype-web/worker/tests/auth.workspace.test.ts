/**
 * Post-Group 6 W1 acceptance (owner final decisions 2026-11-21 / EX-D24 /
 * WS-251/DOC-041) — real workerd over the real PostgreSQL target:
 *  - G06 multi-device sessions: list + server-side revoke-all;
 *  - G01/AUTHZ-05 explicit project creation (one per account, no implicit
 *    creation on business actions, explicit context verified per request);
 *  - G02 admin separation (bootstrap refuses business identities; the admin
 *    account is refused business paths);
 *  - AUTHZ-05 on the manage surfaces (named cross-account context refused).
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  apiGet,
  apiPost,
  createWorkspace,
  rawDb,
  signInAs,
  startWorker,
  type WorkerInstance,
} from "./harness.ts";

let worker: WorkerInstance;

beforeAll(async () => {
  worker = await startWorker();
});

afterAll(async () => {
  await worker.close();
});

describe("G06 — multi-device sessions and server-side revoke-all", () => {
  it("shows both devices, revokes all from one, and the other device is refused", async () => {
    const first = await signInAs(worker, { sub: "sessions-owner", email: "sessions@example.test" });
    const second = await signInAs(worker, { sub: "sessions-owner", email: "sessions@example.test" });

    const listFromFirst = await apiGet(worker, first.cookieHeader, "/api/auth/sessions");
    expect(listFromFirst.status).toBe(200);
    const firstView = (await listFromFirst.json()) as {
      sessions: { id: string; createdAt: number; expiresAt: number; current: boolean }[];
    };
    expect(firstView.sessions).toHaveLength(2);
    expect(firstView.sessions.filter(s => s.current)).toHaveLength(1);

    const signOutAll = await apiPost(worker, first.cookieHeader, "/api/auth/signout-all", {});
    expect(signOutAll.status).toBe(200);
    const receipt = (await signOutAll.json()) as { ok: boolean; revoked: number };
    expect(receipt.revoked).toBe(2);

    // The OTHER device is refused with its (now revoked) token — and the
    // revoked token of the acting device can never authenticate again.
    const refusedSecond = await apiGet(worker, second.cookieHeader, "/api/auth/session");
    expect(((await refusedSecond.json()) as { authenticated: boolean }).authenticated).toBe(false);
    const refusedFirst = await apiGet(worker, first.cookieHeader, "/api/auth/session");
    expect(((await refusedFirst.json()) as { authenticated: boolean }).authenticated).toBe(false);
    const sessionsAfter = await apiGet(worker, first.cookieHeader, "/api/auth/sessions");
    expect(sessionsAfter.status).toBe(401);
  });

  it("refuses the session list for guests (401) and never returns tokens", async () => {
    const guest = await apiGet(worker, null, "/api/auth/sessions");
    expect(guest.status).toBe(401);
  });
});

describe("G01/AUTHZ-05 — explicit project creation and explicit context", () => {
  it("creates the single project explicitly and refuses a second one", async () => {
    const owner = await signInAs(worker, { sub: "project-owner", email: "project@example.test" });
    const workspaceId = await createWorkspace(worker, owner.cookieHeader, "مشروعي الأول");

    const session = (await (await apiGet(worker, owner.cookieHeader, "/api/auth/session")).json()) as {
      workspaces: { id: string; role: string }[];
    };
    expect(session.workspaces).toHaveLength(1);
    expect(session.workspaces[0]!.id).toBe(workspaceId);
    expect(session.workspaces[0]!.role).toBe("owner");

    const second = await apiPost(worker, owner.cookieHeader, "/api/workspaces", {
      displayName: "مشروع ثانٍ",
    });
    expect(second.status).toBe(409);
    expect(((await second.json()) as { error: { code: string } }).error.code).toBe("one_project_per_account");
  });

  it("refuses guest project creation (401)", async () => {
    const guest = await apiPost(worker, null, "/api/workspaces", { displayName: "زائر" });
    expect(guest.status).toBe(401);
  });

  it("structurally refuses a second active owner membership at the database level (migration 0007)", async () => {
    const owner = await signInAs(worker, { sub: "db-constraint-owner", email: "dbconstraint@example.test" });
    await createWorkspace(worker, owner.cookieHeader, "المشروع الوحيد");
    const db = await rawDb(worker);
    const identity = await db
      .prepare("SELECT id FROM network_identity WHERE email = ?")
      .bind("dbconstraint@example.test")
      .first<{ id: string }>();
    const otherWorkspace = "ws_constraint_other";
    await db
      .prepare(
        "INSERT INTO workspace (id, display_name, created_by_identity_id, market_enabled, delivery_enabled, created_at, updated_at) VALUES (?, ?, ?, 1, 1, 1, 1)",
      )
      .bind(otherWorkspace, "مساحة أخرى", identity!.id)
      .run();
    await expect(
      db
        .prepare(
          "INSERT INTO workspace_member (workspace_id, identity_id, role, status, granted_by_identity_id, granted_at) VALUES (?, ?, 'owner', 'active', ?, 1)",
        )
        .bind(otherWorkspace, identity!.id, identity!.id)
        .run(),
    ).rejects.toThrow();
  });

  it("no implicit creation: vendor profile save requires the explicit context and refuses cross-account workspaces", async () => {
    const owner = await signInAs(worker, { sub: "vendor-explicit", email: "vendorexplicit@example.test" });
    const other = await signInAs(worker, { sub: "other-owner", email: "otherowner@example.test" });
    const otherWorkspaceId = await createWorkspace(worker, other.cookieHeader, "مشروع الآخر");

    // No workspace yet and no context sent → honest 400, nothing created.
    const noContext = await apiPost(worker, owner.cookieHeader, "/api/market/vendor/profile", {
      displayName: "مورد صريح",
      contactPhone: "+962790000001",
      governorate: "عمان",
    });
    expect(noContext.status).toBe(400);
    expect(((await noContext.json()) as { error: { code: string } }).error.code).toBe(
      "workspace_context_required",
    );
    const db = await rawDb(worker);
    const noWorkspace = await db
      .prepare(
        "SELECT COUNT(*) AS n FROM workspace_member WHERE identity_id = (SELECT id FROM network_identity WHERE email = ?)",
      )
      .bind("vendorexplicit@example.test")
      .first<{ n: number }>();
    expect(Number(noWorkspace!.n)).toBe(0);

    // Another account's workspace → 403, never a silent redirect. An
    // identity with NO project yet gets the actionable workspace_missing
    // (create your project first); an identity WITH a project that names a
    // foreign workspace gets workspace_forbidden.
    const crossAccountBefore = await apiPost(worker, owner.cookieHeader, "/api/market/vendor/profile", {
      displayName: "مورد صريح",
      contactPhone: "+962790000001",
      governorate: "عمان",
      workspaceId: otherWorkspaceId,
    });
    expect(crossAccountBefore.status).toBe(403);
    expect(((await crossAccountBefore.json()) as { error: { code: string } }).error.code).toBe(
      "workspace_missing",
    );

    // Own explicit context → the profile is created inside that project.
    const ownWorkspaceId = await createWorkspace(worker, owner.cookieHeader, "مشروع المورد");
    const crossAccountAfter = await apiPost(worker, owner.cookieHeader, "/api/market/vendor/profile", {
      displayName: "مورد صريح",
      contactPhone: "+962790000001",
      governorate: "عمان",
      workspaceId: otherWorkspaceId,
    });
    expect(crossAccountAfter.status).toBe(403);
    expect(((await crossAccountAfter.json()) as { error: { code: string } }).error.code).toBe(
      "workspace_forbidden",
    );
    const saved = await apiPost(worker, owner.cookieHeader, "/api/market/vendor/profile", {
      displayName: "مورد صريح",
      contactPhone: "+962790000001",
      governorate: "عمان",
      workspaceId: ownWorkspaceId,
    });
    expect(saved.status).toBe(201);
  });

  it("vendor profile submit requires the explicit context and refuses a foreign workspace id", async () => {
    const owner = await signInAs(worker, { sub: "vendor-submit-ctx", email: "vendorsubmit@example.test" });
    const workspaceId = await createWorkspace(worker, owner.cookieHeader, "مشروع التقديم");
    await apiPost(worker, owner.cookieHeader, "/api/market/vendor/profile", {
      displayName: "مورد التقديم",
      contactPhone: "+962790000002",
      governorate: "عمان",
      workspaceId,
    });

    const noContext = await apiPost(worker, owner.cookieHeader, "/api/market/vendor/profile/submit", {});
    expect(noContext.status).toBe(400);
    expect(((await noContext.json()) as { error: { code: string } }).error.code).toBe(
      "workspace_context_required",
    );

    const foreign = await apiPost(worker, owner.cookieHeader, "/api/market/vendor/profile/submit", {
      workspaceId: "ws_someone_else",
    });
    expect(foreign.status).toBe(403);

    const own = await apiPost(worker, owner.cookieHeader, "/api/market/vendor/profile/submit", {
      workspaceId,
    });
    expect(own.status).toBe(200);
  });
});

describe("G02 — admin separation (server-granted, no business roles)", () => {
  it("refuses the admin bootstrap for an identity that already owns a project, then grants the clean separate account", async () => {
    const adminWorker = await startWorker({ bindings: { BOOTSTRAP_OWNER_EMAIL: "admin@example.test" } });
    try {
      // (1) The clean account signs in first — no business role — and is
      // granted the (first) admin membership server-side.
      const clean = await signInAs(adminWorker, { sub: "admin-clean", email: "admin@example.test" });
      const cleanSession = (await (
        await apiGet(adminWorker, clean.cookieHeader, "/api/auth/session")
      ).json()) as { isAdmin: boolean };
      expect(cleanSession.isAdmin).toBe(true);

      // (2) A DIFFERENT identity (same configured email, other Google
      // account) signs in while an admin exists: no bootstrap, so it can
      // create its project — it is a business identity now.
      const business = await signInAs(adminWorker, { sub: "admin-business", email: "admin@example.test" });
      const businessWorkspace = await apiPost(adminWorker, business.cookieHeader, "/api/workspaces", {
        displayName: "مشروع صاحب الأعمال",
      });
      expect(businessWorkspace.status).toBe(201);

      // (3) The admin membership is deactivated (operator action) — the
      // bootstrap becomes eligible again, and the business identity signs
      // in with the matching email: the grant MUST be refused.
      const db = await rawDb(adminWorker);
      await db.prepare("UPDATE network_membership SET status = 'inactive' WHERE role = 'admin'").run();
      const businessAgain = await signInAs(adminWorker, {
        sub: "admin-business",
        email: "admin@example.test",
      });
      const refusedSession = (await (
        await apiGet(adminWorker, businessAgain.cookieHeader, "/api/auth/session")
      ).json()) as { isAdmin: boolean };
      expect(refusedSession.isAdmin).toBe(false);

      const refusedAudit = await db
        .prepare(
          "SELECT COUNT(*) AS n FROM network_audit_event WHERE action = 'signin_bootstrap_admin_refused'",
        )
        .first<{ n: number }>();
      expect(Number(refusedAudit!.n)).toBe(1);

      // (4) The clean separate account signs in again and the grant succeeds
      // (it holds no business role) — the admin is always a dedicated
      // account, never a business identity.
      const cleanAgain = await signInAs(adminWorker, { sub: "admin-clean", email: "admin@example.test" });
      const reGranted = (await (
        await apiGet(adminWorker, cleanAgain.cookieHeader, "/api/auth/session")
      ).json()) as { isAdmin: boolean };
      expect(reGranted.isAdmin).toBe(true);

      // (5) The admin account is refused business paths: project creation is
      // an honest 403 (it holds no business roles by design).
      const refusedWorkspace = await apiPost(adminWorker, cleanAgain.cookieHeader, "/api/workspaces", {
        displayName: "مشروع الإدارة",
      });
      expect(refusedWorkspace.status).toBe(403);
      expect(((await refusedWorkspace.json()) as { error: { code: string } }).error.code).toBe(
        "admin_identity_forbidden",
      );
    } finally {
      await adminWorker.close();
    }
  });
});

describe("AUTHZ-05 — explicit context on the manage surfaces", () => {
  const PROOF = "w1-manage-proof-secret-0123456789abcdef012345";
  let linked: { cookieHeader: string; workspaceId: string };

  async function linkOwner(cookie: string, workspaceId: string): Promise<void> {
    const db = await rawDb(worker);
    await db.prepare("UPDATE workspace SET manage_enabled = 1 WHERE id = ?").bind(workspaceId).run();
    const start = await apiPost(worker, cookie, "/api/manage/link/start", { proofSecret: PROOF });
    expect(start.status).toBe(200);
    const { nonce } = (await start.json()) as { nonce: string };
    const confirm = await apiPost(worker, cookie, "/api/manage/link/confirm", { nonce });
    expect(confirm.status).toBe(200);
  }

  beforeAll(async () => {
    const owner = await signInAs(worker, { sub: "manage-ctx-owner", email: "managectx@example.test" });
    const workspaceId = await createWorkspace(worker, owner.cookieHeader, "مشروع Manage");
    await linkOwner(owner.cookieHeader, workspaceId);
    linked = { cookieHeader: owner.cookieHeader, workspaceId };
  });

  it("accepts the caller's own named context", async () => {
    const families = await apiGet(
      worker,
      linked.cookieHeader,
      `/api/manage/families?workspaceId=${encodeURIComponent(linked.workspaceId)}`,
    );
    expect(families.status).toBe(200);
  });

  it("refuses a named context the caller does not own (cross-account)", async () => {
    const foreign = await apiGet(
      worker,
      linked.cookieHeader,
      "/api/manage/families?workspaceId=ws_someone_else",
    );
    expect(foreign.status).toBe(403);
    expect(((await foreign.json()) as { error: { code: string } }).error.code).toBe("workspace_forbidden");
  });

  it("refuses a foreign context on writes too (record save)", async () => {
    const refused = await worker.fetch("/api/manage/records/assets/w-ctx", {
      method: "PUT",
      headers: {
        "content-type": "application/json",
        origin: worker.origin,
        "x-micro-api": "1",
        cookie: linked.cookieHeader,
        "idempotency-key": "w1-ctx-foreign-1",
      },
      body: JSON.stringify({ data: { note: "x" }, workspaceId: "ws_someone_else" }),
    });
    expect(refused.status).toBe(403);
  });
});
