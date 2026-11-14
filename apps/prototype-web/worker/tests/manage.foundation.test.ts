/**
 * Manage Online foundation acceptance (EX-D23, wave M2) — real workerd over
 * the real PostgreSQL target. Covers the honest configuration states, the
 * double-proof link flow (never email-only), the one-manage-owner constraint
 * (application + database partial unique index), and the requireManageOwner
 * gate's fail-closed paths for every refused class of caller (MO-01..MO-08).
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { apiGet, apiPost, rawDb, signInAs, startWorker, workerRoot, type WorkerInstance } from "./harness.ts";
import { requireManageOwner } from "../authorization.ts";
import { HttpError } from "../http.ts";
import { sha256Hex } from "../crypto.ts";

let worker: WorkerInstance;

const PROOF = "manage-proof-secret-0123456789abcdef0123456789abcdef";

interface Seeded {
  cookieHeader: string;
  workspaceId: string;
  identityId: string;
}

/** Seed a personal workspace + owner membership (operator/test posture). */
async function seedOwnerWorkspace(
  worker: WorkerInstance,
  email: string,
  workspaceId: string,
): Promise<Seeded> {
  const cookie = (await signInAs(worker, { sub: `sub-${workspaceId}`, email })).cookieHeader;
  const db = await rawDb(worker);
  const identity = await db
    .prepare("SELECT id FROM network_identity WHERE email = ?")
    .bind(email)
    .first<{ id: string }>();
  await db
    .prepare(
      "INSERT INTO workspace (id, display_name, created_by_identity_id, market_enabled, delivery_enabled, created_at, updated_at) VALUES (?, ?, ?, 1, 1, 1, 1)",
    )
    .bind(workspaceId, `مساحة ${workspaceId}`, identity!.id)
    .run();
  await db
    .prepare(
      "INSERT INTO workspace_member (workspace_id, identity_id, role, status, granted_by_identity_id, granted_at) VALUES (?, ?, 'owner', 'active', ?, 1)",
    )
    .bind(workspaceId, identity!.id, identity!.id)
    .run();
  return { cookieHeader: cookie, workspaceId, identityId: identity!.id };
}

/** The operator's enable step (never an API route): enable manage for a workspace. */
async function enableManageCapability(worker: WorkerInstance, workspaceId: string): Promise<void> {
  const db = await rawDb(worker);
  await db.prepare("UPDATE workspace SET manage_enabled = 1 WHERE id = ?").bind(workspaceId).run();
}

beforeAll(async () => {
  worker = await startWorker();
});

afterAll(async () => {
  await worker.close();
});

describe("manage foundation (M2): honest configuration states", () => {
  it("rejects unauthenticated callers on every manage route (MO-01)", async () => {
    const state = await apiGet(worker, null, "/api/manage/state");
    expect(state.status).toBe(401);
    const start = await apiPost(worker, null, "/api/manage/link/start", { proofSecret: PROOF });
    expect(start.status).toBe(401);
    const confirm = await apiPost(worker, null, "/api/manage/link/confirm", { nonce: "x".repeat(22) });
    expect(confirm.status).toBe(401);
    const unlink = await worker.fetch("/api/manage/link", {
      method: "DELETE",
      headers: { origin: worker.origin, "x-micro-api": "1" },
    });
    expect(unlink.status).toBe(401);
  });

  it("reports the unconfigured state honestly when the operator has not applied the schema (503, not 500)", async () => {
    const db = await rawDb(worker);
    await db.prepare("DROP INDEX IF EXISTS idx_manage_owner_linked_one").run();
    await db.prepare("DROP INDEX IF EXISTS idx_manage_owner_identity").run();
    await db.prepare("DROP TABLE IF EXISTS manage_owner_link").run();
    await db.prepare("ALTER TABLE workspace DROP COLUMN IF EXISTS manage_enabled").run();
    const owner = await signInAs(worker, { sub: "sub-unconfigured", email: "unconfigured@example.test" });
    const state = await apiGet(worker, owner.cookieHeader, "/api/manage/state");
    expect(state.status).toBe(503);
    const body = (await state.json()) as { error: { code: string } };
    expect(body.error.code).toBe("manage_not_configured");
    // Restore the schema exactly as migration 0003 defines it.
    const sql = readFileSync(
      path.join(workerRoot, "db", "migrations-pg", "0003_manage_online_foundation.sql"),
      "utf8",
    );
    for (const statement of sql
      .split("\n")
      .filter(line => !line.trimStart().startsWith("--"))
      .join("\n")
      .split(";")
      .map(s => s.trim())
      .filter(s => s.length > 0)) {
      await db.prepare(statement).run();
    }
    const restored = await apiGet(worker, owner.cookieHeader, "/api/manage/state");
    expect(restored.status).toBe(200);
  });

  it("fails the capability closed by default: disabled workspaces report disabled and refuse linking (MO-08)", async () => {
    const seeded = await seedOwnerWorkspace(worker, "m2-disabled@example.test", "ws_m2_disabled");
    const state = await apiGet(worker, seeded.cookieHeader, "/api/manage/state");
    expect(state.status).toBe(200);
    const body = (await state.json()) as {
      configured: boolean;
      workspaces: { id: string; manageEnabled: boolean; linkStatus: string }[];
    };
    expect(body.configured).toBe(true);
    const ws = body.workspaces.find(w => w.id === "ws_m2_disabled");
    expect(ws).toBeDefined();
    expect(ws!.manageEnabled).toBe(false);
    expect(ws!.linkStatus).toBe("none");
    const start = await apiPost(worker, seeded.cookieHeader, "/api/manage/link/start", {
      proofSecret: PROOF,
    });
    expect(start.status).toBe(403);
    const startBody = (await start.json()) as { error: { code: string } };
    expect(startBody.error.code).toBe("manage_capability_disabled");
  });
});

describe("manage foundation (M2): the verified link flow", () => {
  it("completes start → pending → confirm → linked with the proof stored as a hash only (MO-04)", async () => {
    const seeded = await seedOwnerWorkspace(worker, "m2-owner@example.test", "ws_m2_owner");
    await enableManageCapability(worker, "ws_m2_owner");

    const start = await apiPost(worker, seeded.cookieHeader, "/api/manage/link/start", {
      proofSecret: PROOF,
    });
    expect(start.status).toBe(200);
    const started = (await start.json()) as {
      pending: boolean;
      workspaceId: string;
      nonce: string;
      expiresAt: number;
    };
    expect(started.pending).toBe(true);
    expect(started.workspaceId).toBe("ws_m2_owner");
    expect(started.nonce.length).toBeGreaterThanOrEqual(16);

    const db = await rawDb(worker);
    const pendingRow = await db
      .prepare("SELECT proof_hash, status FROM manage_owner_link WHERE workspace_id = ?")
      .bind("ws_m2_owner")
      .first<{ proof_hash: string; status: string }>();
    expect(pendingRow!.status).toBe("pending");
    // Only the SHA-256 hash is stored — the raw secret never reaches the row.
    expect(pendingRow!.proof_hash).toBe(await sha256Hex(PROOF));
    expect(pendingRow!.proof_hash).not.toContain(PROOF);

    const confirm = await apiPost(worker, seeded.cookieHeader, "/api/manage/link/confirm", {
      nonce: started.nonce,
    });
    expect(confirm.status).toBe(200);
    const confirmed = (await confirm.json()) as { linked: boolean; workspaceId: string };
    expect(confirmed.linked).toBe(true);
    expect(confirmed.workspaceId).toBe("ws_m2_owner");

    const state = await apiGet(worker, seeded.cookieHeader, "/api/manage/state");
    const stateBody = (await state.json()) as { workspaces: { id: string; linkStatus: string }[] };
    expect(stateBody.workspaces.find(w => w.id === "ws_m2_owner")!.linkStatus).toBe("linked");

    // Both legs are audited (no secret material in the audit trail).
    const audits = await db
      .prepare(
        "SELECT action FROM network_audit_event WHERE object_type = 'manage_owner_link' ORDER BY created_at",
      )
      .all<{ action: string }>();
    const actions = audits.results.map(a => a.action);
    expect(actions).toContain("manage.link.start");
    expect(actions).toContain("manage.link.confirm");
    const auditText = JSON.stringify(audits);
    expect(auditText).not.toContain(PROOF);
  });

  it("never grants anything by email equality alone (MO-03)", async () => {
    // The linked owner above uses m2-owner@example.test. A DIFFERENT Google
    // identity carrying the exact same email gets nothing: no workspace, no
    // link, no confirmable nonce, no state leakage.
    const sameEmail = await signInAs(worker, { sub: "sub-m2-impersonator", email: "m2-owner@example.test" });
    const state = await apiGet(worker, sameEmail.cookieHeader, "/api/manage/state");
    expect(state.status).toBe(200);
    const body = (await state.json()) as { workspaces: { id: string }[] };
    expect(body.workspaces.find(w => w.id === "ws_m2_owner")).toBeUndefined();

    // Even a stolen nonce cannot be confirmed by the same-email identity: the
    // pending row is bound to the owner's identity id.
    const db = await rawDb(worker);
    const linkRow = await db
      .prepare("SELECT nonce, identity_id FROM manage_owner_link WHERE workspace_id = 'ws_m2_owner'")
      .first<{ nonce: string; identity_id: string }>();
    expect(linkRow!.identity_id).not.toBe(""); // bound to the real owner
    const hijack = await apiPost(worker, sameEmail.cookieHeader, "/api/manage/link/confirm", {
      nonce: linkRow!.nonce,
    });
    expect(hijack.status).toBe(404);

    // And the same-email identity cannot start a link on someone else's
    // workspace at all (no route accepts a workspace parameter).
    const start = await apiPost(worker, sameEmail.cookieHeader, "/api/manage/link/start", {
      proofSecret: PROOF,
    });
    expect(start.status).toBe(403);
    const startBody = (await start.json()) as { error: { code: string } };
    expect(startBody.error.code).toBe("workspace_missing");
  });

  it("refuses a second manage owner per workspace — application check AND database constraint (MO-05)", async () => {
    const seeded = await seedOwnerWorkspace(worker, "m2-second@example.test", "ws_m2_second");
    await enableManageCapability(worker, "ws_m2_second");
    // First owner links.
    const start = await apiPost(worker, seeded.cookieHeader, "/api/manage/link/start", {
      proofSecret: PROOF,
    });
    const started = (await start.json()) as { nonce: string };
    await apiPost(worker, seeded.cookieHeader, "/api/manage/link/confirm", { nonce: started.nonce });

    // A second identity is granted an owner membership on the same workspace.
    const second = await signInAs(worker, { sub: "sub-m2-second-owner", email: "second-owner@example.test" });
    const db = await rawDb(worker);
    const secondIdentity = await db
      .prepare("SELECT id FROM network_identity WHERE email = ?")
      .bind("second-owner@example.test")
      .first<{ id: string }>();
    await db
      .prepare(
        "INSERT INTO workspace_member (workspace_id, identity_id, role, status, granted_by_identity_id, granted_at) VALUES ('ws_m2_second', ?, 'owner', 'active', ?, 1)",
      )
      .bind(secondIdentity!.id, secondIdentity!.id)
      .run();
    const state = await apiGet(worker, second.cookieHeader, "/api/manage/state");
    const body = (await state.json()) as { workspaces: { id: string; linkStatus: string }[] };
    expect(body.workspaces.find(w => w.id === "ws_m2_second")!.linkStatus).toBe("taken");
    const secondStart = await apiPost(worker, second.cookieHeader, "/api/manage/link/start", {
      proofSecret: PROOF,
    });
    expect(secondStart.status).toBe(409);
    expect(((await secondStart.json()) as { error: { code: string } }).error.code).toBe(
      "manage_owner_exists",
    );

    // Structural enforcement: even a direct second linked row is refused by
    // the partial unique index (one linked owner per workspace, in the DB).
    let constraintFired = false;
    try {
      await db
        .prepare(
          "INSERT INTO manage_owner_link (workspace_id, identity_id, proof_hash, nonce, status, created_at, updated_at) VALUES ('ws_m2_second', ?, 'hash', 'n', 'linked', 1, 1)",
        )
        .bind(secondIdentity!.id)
        .run();
    } catch {
      constraintFired = true;
    }
    expect(constraintFired).toBe(true);
  });

  it("replays an idempotent link/start without a second pending row", async () => {
    const seeded = await seedOwnerWorkspace(worker, "m2-idem@example.test", "ws_m2_idem");
    await enableManageCapability(worker, "ws_m2_idem");
    const first = await apiPost(
      worker,
      seeded.cookieHeader,
      "/api/manage/link/start",
      { proofSecret: PROOF },
      { "idempotency-key": "m2-idem-1" },
    );
    expect(first.status).toBe(200);
    const replay = await apiPost(
      worker,
      seeded.cookieHeader,
      "/api/manage/link/start",
      { proofSecret: PROOF },
      { "idempotency-key": "m2-idem-1" },
    );
    expect(replay.status).toBe(200);
    expect(replay.headers.get("x-idempotent-replay")).toBe("1");
    const db = await rawDb(worker);
    const rows = await db
      .prepare("SELECT COUNT(*) AS n FROM manage_owner_link WHERE workspace_id = 'ws_m2_idem'")
      .first<{ n: number }>();
    expect(rows!.n).toBe(1);
  });

  it("expires a pending link honestly (410) after the window elapses", async () => {
    const seeded = await seedOwnerWorkspace(worker, "m2-expiry@example.test", "ws_m2_expiry");
    await enableManageCapability(worker, "ws_m2_expiry");
    const start = await apiPost(worker, seeded.cookieHeader, "/api/manage/link/start", {
      proofSecret: PROOF,
    });
    const started = (await start.json()) as { nonce: string };
    const db = await rawDb(worker);
    await db
      .prepare(
        "UPDATE manage_owner_link SET created_at = created_at - 3600000 WHERE workspace_id = 'ws_m2_expiry'",
      )
      .run();
    const confirm = await apiPost(worker, seeded.cookieHeader, "/api/manage/link/confirm", {
      nonce: started.nonce,
    });
    expect(confirm.status).toBe(410);
    expect(((await confirm.json()) as { error: { code: string } }).error.code).toBe("manage_link_expired");
  });

  it("refuses a fresh start while already linked (explicit unlink first)", async () => {
    const seeded = await seedOwnerWorkspace(worker, "m2-relink@example.test", "ws_m2_relink");
    await enableManageCapability(worker, "ws_m2_relink");
    const start = await apiPost(worker, seeded.cookieHeader, "/api/manage/link/start", {
      proofSecret: PROOF,
    });
    const started = (await start.json()) as { nonce: string };
    await apiPost(worker, seeded.cookieHeader, "/api/manage/link/confirm", { nonce: started.nonce });
    const again = await apiPost(worker, seeded.cookieHeader, "/api/manage/link/start", {
      proofSecret: PROOF,
    });
    expect(again.status).toBe(409);
    expect(((await again.json()) as { error: { code: string } }).error.code).toBe("manage_already_linked");
  });

  it("unlinks on the owner's explicit request, and unlink is 404 without a link", async () => {
    const seeded = await seedOwnerWorkspace(worker, "m2-unlink@example.test", "ws_m2_unlink");
    await enableManageCapability(worker, "ws_m2_unlink");
    const start = await apiPost(worker, seeded.cookieHeader, "/api/manage/link/start", {
      proofSecret: PROOF,
    });
    const started = (await start.json()) as { nonce: string };
    await apiPost(worker, seeded.cookieHeader, "/api/manage/link/confirm", { nonce: started.nonce });
    const unlink = await worker.fetch("/api/manage/link", {
      method: "DELETE",
      headers: { origin: worker.origin, "x-micro-api": "1", cookie: seeded.cookieHeader },
    });
    expect(unlink.status).toBe(200);
    const state = await apiGet(worker, seeded.cookieHeader, "/api/manage/state");
    const body = (await state.json()) as { workspaces: { id: string; linkStatus: string }[] };
    expect(body.workspaces.find(w => w.id === "ws_m2_unlink")!.linkStatus).toBe("none");
    const again = await worker.fetch("/api/manage/link", {
      method: "DELETE",
      headers: { origin: worker.origin, "x-micro-api": "1", cookie: seeded.cookieHeader },
    });
    expect(again.status).toBe(404);
  });
});

describe("manage foundation (M2): the requireManageOwner gate (unit, over the real database)", () => {
  it("refuses an identity with no workspace at all (workspace_missing)", async () => {
    const db = await rawDb(worker);
    const loner = await signInAs(worker, { sub: "sub-m2-loner", email: "loner@example.test" });
    const identity = await db
      .prepare("SELECT id FROM network_identity WHERE email = ?")
      .bind("loner@example.test")
      .first<{ id: string }>();
    await expect(requireManageOwner(db, identity!.id)).rejects.toMatchObject({
      status: 403,
      code: "workspace_missing",
    } satisfies Partial<HttpError>);
    void loner;
  });

  it("refuses a supplier member honestly (manage_not_linked, not workspace_missing)", async () => {
    const db = await rawDb(worker);
    const seeded = await seedOwnerWorkspace(worker, "m2-supplier@example.test", "ws_m2_supplier");
    await enableManageCapability(worker, "ws_m2_supplier");
    const supplier = await signInAs(worker, {
      sub: "sub-m2-supplier",
      email: "supplier-member@example.test",
    });
    const supplierIdentity = await db
      .prepare("SELECT id FROM network_identity WHERE email = ?")
      .bind("supplier-member@example.test")
      .first<{ id: string }>();
    await db
      .prepare(
        "INSERT INTO workspace_member (workspace_id, identity_id, role, status, granted_by_identity_id, granted_at) VALUES (?, ?, 'supplier', 'active', ?, 1)",
      )
      .bind(seeded.workspaceId, supplierIdentity!.id, supplierIdentity!.id)
      .run();
    await expect(requireManageOwner(db, supplierIdentity!.id)).rejects.toMatchObject({
      status: 403,
      code: "manage_not_linked",
    } satisfies Partial<HttpError>);
    void supplier;
  });

  it("refuses an owner while the capability is disabled, and while unlinked/pending (MO-08/MO-02)", async () => {
    const db = await rawDb(worker);
    const disabled = await seedOwnerWorkspace(worker, "m2-gate@example.test", "ws_m2_gate");
    await expect(requireManageOwner(db, disabled.identityId)).rejects.toMatchObject({
      status: 403,
      code: "manage_capability_disabled",
    } satisfies Partial<HttpError>);
    await enableManageCapability(worker, "ws_m2_gate");
    await expect(requireManageOwner(db, disabled.identityId)).rejects.toMatchObject({
      status: 403,
      code: "manage_not_linked",
    } satisfies Partial<HttpError>);
    // A pending link is NOT a verified link — still refused.
    await db
      .prepare(
        "INSERT INTO manage_owner_link (workspace_id, identity_id, proof_hash, nonce, status, created_at, updated_at) VALUES (?, ?, 'h', 'n', 'pending', 1, 1)",
      )
      .bind(disabled.workspaceId, disabled.identityId)
      .run();
    await expect(requireManageOwner(db, disabled.identityId)).rejects.toMatchObject({
      status: 403,
      code: "manage_not_linked",
    } satisfies Partial<HttpError>);
  });

  it("passes only the verified linked owner and scopes them to their OWN workspace (MO-09 boundary)", async () => {
    const db = await rawDb(worker);
    const owner = await seedOwnerWorkspace(worker, "m2-pass@example.test", "ws_m2_pass");
    await enableManageCapability(worker, "ws_m2_pass");
    await db
      .prepare(
        "INSERT INTO manage_owner_link (workspace_id, identity_id, proof_hash, nonce, status, created_at, updated_at) VALUES (?, ?, 'h', 'n', 'linked', 1, 1)",
      )
      .bind(owner.workspaceId, owner.identityId)
      .run();
    const context = await requireManageOwner(db, owner.identityId);
    expect(context.workspaceId).toBe("ws_m2_pass");

    // A second workspace the owner belongs to but does NOT own the manage
    // link of: the gate still returns only their own linked workspace.
    await db
      .prepare(
        "INSERT INTO workspace (id, display_name, created_by_identity_id, market_enabled, delivery_enabled, created_at, updated_at) VALUES ('ws_m2_other', 'أخرى', ?, 1, 1, 1, 1)",
      )
      .bind(owner.identityId)
      .run();
    const otherOwner = await signInAs(worker, { sub: "sub-m2-other", email: "other@example.test" });
    const otherIdentity = await db
      .prepare("SELECT id FROM network_identity WHERE email = ?")
      .bind("other@example.test")
      .first<{ id: string }>();
    await db
      .prepare(
        "INSERT INTO workspace_member (workspace_id, identity_id, role, status, granted_by_identity_id, granted_at) VALUES ('ws_m2_other', ?, 'owner', 'active', ?, 1)",
      )
      .bind(owner.identityId, owner.identityId)
      .run();
    await db
      .prepare(
        "INSERT INTO workspace_member (workspace_id, identity_id, role, status, granted_by_identity_id, granted_at) VALUES ('ws_m2_other', ?, 'owner', 'active', ?, 1)",
      )
      .bind(otherIdentity!.id, otherIdentity!.id)
      .run();
    await enableManageCapability(worker, "ws_m2_other");
    await db
      .prepare(
        "INSERT INTO manage_owner_link (workspace_id, identity_id, proof_hash, nonce, status, created_at, updated_at) VALUES ('ws_m2_other', ?, 'h', 'n', 'linked', 1, 1)",
      )
      .bind(otherIdentity!.id)
      .run();
    // The first owner's gate context is their own workspace, never the other.
    const stillOwn = await requireManageOwner(db, owner.identityId);
    expect(stillOwn.workspaceId).toBe("ws_m2_pass");
    // The other owner's gate context is theirs.
    const otherContext = await requireManageOwner(db, otherIdentity!.id);
    expect(otherContext.workspaceId).toBe("ws_m2_other");
    void otherOwner;
  });
});
