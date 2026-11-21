/**
 * Project export-before-deletion lifecycle (owner supplement §10.1-3,
 * 2026-11-22 — WS-251/DOC-041): the focused regression tests over real
 * workerd+PostgreSQL with SYNTHETIC fixtures in a disposable local database
 * ONLY — no live user data is ever deleted (the owner's explicit decision
 * text and this suite are the only exercise of the deletion path).
 *
 *   1. the export: owner-only, the full owner-accessible bundle (settings +
 *      financial records + bookings + file metadata), recorded + audited;
 *   2. deletion is EXPORT-FIRST: without a recorded export it is an honest
 *      409; without the explicit confirmation token an honest 400;
 *   3. an ONGOING booking blocks the deletion honestly (never auto-cancel)
 *      and NOTHING is deleted;
 *   4. after the export + the explicit confirmation: the private data and
 *      the unshared drafts are deleted, the completed shared counterparty
 *      records are RETAINED with the owner masked «مستخدم سابق» on the
 *      driver's view (his own view keeps his name), the audit history and
 *      the export evidence stay, and the membership is gone (the session no
 *      longer lists the project);
 *   5. a repeat deletion is refused honestly.
 */
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  apiGet,
  apiPost,
  createWorkspace,
  rawDb,
  signInAs,
  startWorker,
  type WorkerInstance,
} from "./harness.ts";
import { createApprovedDriver, setupExecutionPair, type WorkerRefs } from "./delivery.helpers.ts";

let worker: WorkerInstance;
let adminCookie: string;
let refs: WorkerRefs;

beforeEach(async () => {
  worker = await startWorker();
  const admin = await signInAs(worker, { sub: "pl-admin", email: "pl-admin@example.test" });
  const db = await rawDb(worker);
  await db
    .prepare(
      "INSERT INTO network_membership (identity_id, role, status, granted_by, granted_at) " +
        "SELECT id, 'admin', 'active', 'test', 1 FROM network_identity WHERE email = ?",
    )
    .bind("pl-admin@example.test")
    .run();
  adminCookie = admin.cookieHeader;
  refs = { worker, adminCookie };
});

afterEach(async () => {
  await worker.close();
});

async function identityIdOf(email: string): Promise<string> {
  const db = await rawDb(worker);
  const row = await db
    .prepare("SELECT id FROM network_identity WHERE email = ?")
    .bind(email)
    .first<{ id: string }>();
  if (!row) throw new Error(`identity ${email} missing`);
  return row.id;
}

/** Seed one TERMINAL shared booking row (a completed counterparty record)
 * directly — the deletion logic is the subject here, not the booking flow. */
async function seedTerminalSharedBooking(
  workspaceId: string,
  requesterIdentityId: string,
  driverProfileId: string,
  id: string,
): Promise<void> {
  const db = await rawDb(worker);
  await db
    .prepare(
      "INSERT INTO delivery_request (id, requester_identity_id, workspace_id, driver_profile_id, need_type, payload_json, pricing_mode, status, created_at, updated_at) " +
        "VALUES (?, ?, ?, ?, 'deliver_to_customer', '{}', 'prepriced', 'cancelled', 5, 5)",
    )
    .bind(id, requesterIdentityId, workspaceId, driverProfileId)
    .run();
}

/** Enable the connected Manage store for the workspace and complete the
 * double-proof owner link (the normal setup path — the same M3 flow the
 * manage/G13 tests use) so the canonical financial writes are legal. */
async function enableManageStore(worker: WorkerInstance, cookie: string, workspaceId: string): Promise<void> {
  const db = await rawDb(worker);
  await db.prepare("UPDATE workspace SET manage_enabled = 1 WHERE id = ?").bind(workspaceId).run();
  const start = await apiPost(worker, cookie, "/api/manage/link/start", {
    proofSecret: "pl-proof-0123456789abcdef0123456789abcdef",
  });
  const started = (await start.json()) as { nonce: string };
  const confirm = await apiPost(worker, cookie, "/api/manage/link/confirm", { nonce: started.nonce });
  expect(confirm.status).toBe(200);
}

function managePut(
  worker: WorkerInstance,
  cookie: string,
  family: string,
  id: string,
  body: { data: unknown; workspaceId?: string },
): Promise<Response> {
  return worker.fetch(`/api/manage/records/${family}/${id}`, {
    method: "PUT",
    headers: { "content-type": "application/json", origin: worker.origin, "x-micro-api": "1", cookie },
    body: JSON.stringify(body),
  });
}

describe("§10.1-3: the project export (export first)", () => {
  it("builds the owner-accessible bundle, records + audits it; a stranger is refused", async () => {
    const owner = await signInAs(worker, { sub: "pl-exp", email: "pl-exp@example.test" });
    const workspaceId = await createWorkspace(worker, owner.cookieHeader, "مشروع التصدير");
    await enableManageStore(worker, owner.cookieHeader, workspaceId);
    // Two connected financial records through the canonical write path.
    const first = await managePut(worker, owner.cookieHeader, "financial-events", "f-1", {
      data: { id: "f-1", amountMinor: 500 },
      workspaceId,
    });
    expect(first.status).toBe(200);
    expect(((await first.json()) as { saved: boolean }).saved).toBe(true);
    const second = await managePut(worker, owner.cookieHeader, "profile", "p-1", {
      data: { name: "ملف" },
      workspaceId,
    });
    expect(second.status).toBe(200);
    // A stranger gets an honest 404 (never data).
    const stranger = await signInAs(worker, { sub: "pl-str", email: "pl-str@example.test" });
    const strangerExport = await apiGet(
      worker,
      stranger.cookieHeader,
      `/api/account/projects/${workspaceId}/export`,
    );
    expect(strangerExport.status).toBe(404);
    // The owner's export carries the settings, the families, the bookings.
    const exported = await apiGet(worker, owner.cookieHeader, `/api/account/projects/${workspaceId}/export`);
    expect(exported.status).toBe(201);
    const body = (await exported.json()) as {
      export: { id: string; format: string; recordCount: number; digest: string };
      workspace: { displayName: string; settings: { marketEnabled: boolean; deliveryEnabled: boolean } };
      families: Record<string, { count: number; records: { id: string }[] }>;
      deliveries: { id: string }[];
      files: unknown[];
      retentionNote: string;
    };
    expect(body.export.format).toBe("micro-project-export");
    expect(body.workspace.displayName).toBe("مشروع التصدير");
    expect(body.workspace.settings.marketEnabled).toBe(true);
    expect(body.families["financial-events"]!.count).toBe(1);
    expect(body.families["financial-events"]!.records[0]!.id).toBe("f-1");
    expect(body.families["profile"]!.count).toBe(1);
    expect(body.export.recordCount).toBeGreaterThanOrEqual(2);
    expect(body.export.digest).toBeTruthy();
    expect(body.retentionNote).toContain("مستخدم سابق");
    // The export is recorded and audited.
    const db = await rawDb(worker);
    const record = await db
      .prepare("SELECT record_count, digest FROM project_export WHERE id = ?")
      .bind(body.export.id)
      .first<{ record_count: number; digest: string }>();
    expect(record).not.toBeNull();
    expect(Number(record!.record_count)).toBe(body.export.recordCount);
    const auditRow = await db
      .prepare(
        "SELECT action FROM network_audit_event WHERE action = 'project_exported' AND result = 'success'",
      )
      .first<{ action: string }>();
    expect(auditRow).not.toBeNull();
  });
});

describe("§10.1-3: deletion is export-first and explicitly confirmed", () => {
  it("without a prior export: an honest 409; without the token: an honest 400", async () => {
    const owner = await signInAs(worker, { sub: "pl-noexp", email: "pl-noexp@example.test" });
    const workspaceId = await createWorkspace(worker, owner.cookieHeader, "مشروع بلا تصدير");
    const noExport = await apiPost(
      worker,
      owner.cookieHeader,
      `/api/account/projects/${workspaceId}/delete`,
      {
        exportId: "exp-does-not-exist",
        confirm: "حذف",
      },
    );
    expect(noExport.status).toBe(409);
    const noExportBody = (await noExport.json()) as {
      error: { details: { reason: string; message?: string } };
    };
    expect(noExportBody.error.details.reason).toBe("export_required");
    expect(noExportBody.error.details.message).toContain("صدّر بيانات مشروعك أولًا");
    // With an export but WITHOUT the confirmation token: an honest 400.
    const exported = await apiGet(worker, owner.cookieHeader, `/api/account/projects/${workspaceId}/export`);
    const exportBody = (await exported.json()) as { export: { id: string } };
    const noToken = await apiPost(worker, owner.cookieHeader, `/api/account/projects/${workspaceId}/delete`, {
      exportId: exportBody.export.id,
      confirm: "نعم",
    });
    expect(noToken.status).toBe(400);
    const noTokenBody = (await noToken.json()) as { error: { details: { reason: string } } };
    expect(noTokenBody.error.details.reason).toBe("confirmation_token_required");
    // Nothing was deleted.
    const db = await rawDb(worker);
    const workspace = await db
      .prepare("SELECT deleted_at FROM workspace WHERE id = ?")
      .bind(workspaceId)
      .first<{ deleted_at: number | null }>();
    expect(workspace!.deleted_at).toBeNull();
  });

  it("an ONGOING booking blocks the deletion honestly — nothing is deleted", async () => {
    const owner = await signInAs(worker, { sub: "pl-ongoing", email: "pl-ongoing@example.test" });
    const workspaceId = await createWorkspace(worker, owner.cookieHeader, "مشروع الحجز الجاري");
    const driver = await createApprovedDriver(refs, "pl-ongoing-drv@example.test", "pl-ongoing-drv");
    await setupExecutionPair(worker, owner.cookieHeader, driver.cookie, driver.driverProfileId, workspaceId);
    const exported = await apiGet(worker, owner.cookieHeader, `/api/account/projects/${workspaceId}/export`);
    const exportBody = (await exported.json()) as { export: { id: string } };
    const blocked = await apiPost(worker, owner.cookieHeader, `/api/account/projects/${workspaceId}/delete`, {
      exportId: exportBody.export.id,
      confirm: "حذف",
    });
    expect(blocked.status).toBe(409);
    const blockedBody = (await blocked.json()) as { error: { details: { reason: string; message: string } } };
    expect(blockedBody.error.details.reason).toBe("ongoing_booking_blocks_deletion");
    expect(blockedBody.error.details.message).toContain("الحذف لا يلغي حجزًا تلقائيًا أبدًا");
    // The booking and the workspace are untouched.
    const db = await rawDb(worker);
    const workspace = await db
      .prepare("SELECT deleted_at FROM workspace WHERE id = ?")
      .bind(workspaceId)
      .first<{ deleted_at: number | null }>();
    expect(workspace!.deleted_at).toBeNull();
    const bookings = await db
      .prepare("SELECT COUNT(*) AS n FROM delivery_request WHERE workspace_id = ?")
      .bind(workspaceId)
      .first<{ n: number }>();
    expect(Number(bookings!.n)).toBeGreaterThan(0);
  });
});

describe("§10.1-3: the confirmed deletion (synthetic fixtures only)", () => {
  it("deletes the private data + unshared drafts, retains the shared records with the «مستخدم سابق» mask", async () => {
    const owner = await signInAs(worker, { sub: "pl-del", email: "pl-del@example.test" });
    const workspaceId = await createWorkspace(worker, owner.cookieHeader, "مشروع الحذف المؤكد");
    const ownerIdentityId = await identityIdOf("pl-del@example.test");
    const driver = await createApprovedDriver(refs, "pl-del-drv@example.test", "pl-del-drv");
    // One TERMINAL shared record (completed, counterparty-shared) + one UNSHARED draft.
    await seedTerminalSharedBooking(workspaceId, ownerIdentityId, driver.driverProfileId, "req_shared_1");
    const db = await rawDb(worker);
    await db
      .prepare(
        "INSERT INTO delivery_request (id, requester_identity_id, workspace_id, driver_profile_id, need_type, payload_json, pricing_mode, status, created_at, updated_at) " +
          "VALUES ('req_draft_1', ?, ?, ?, 'deliver_to_customer', '{}', 'prepriced', 'draft', 4, 4)",
      )
      .bind(ownerIdentityId, workspaceId, driver.driverProfileId)
      .run();
    // One private financial record.
    await db
      .prepare(
        "INSERT INTO manage_record (workspace_id, family, record_id, data_json, updated_at) VALUES (?, 'financial-events', 'f-private', '{}', 1)",
      )
      .bind(workspaceId)
      .run();
    // Export first, then the explicit confirmation.
    const exported = await apiGet(worker, owner.cookieHeader, `/api/account/projects/${workspaceId}/export`);
    expect(exported.status).toBe(201);
    const exportBody = (await exported.json()) as { export: { id: string } };
    const deleted = await apiPost(worker, owner.cookieHeader, `/api/account/projects/${workspaceId}/delete`, {
      exportId: exportBody.export.id,
      confirm: "حذف",
    });
    expect(deleted.status).toBe(200);
    const deleteBody = (await deleted.json()) as {
      deleted: { manageRecords: number; unsharedDrafts: number; membership: number };
      retained: { sharedCounterpartyRecords: number; ownerMaskedAs: string; auditHistory: boolean };
    };
    expect(deleteBody.deleted.manageRecords).toBe(1);
    expect(deleteBody.deleted.unsharedDrafts).toBe(1);
    expect(deleteBody.deleted.membership).toBe(1);
    expect(deleteBody.retained.sharedCounterpartyRecords).toBe(1);
    expect(deleteBody.retained.ownerMaskedAs).toBe("مستخدم سابق");
    expect(deleteBody.retained.auditHistory).toBe(true);
    // The private data is gone; the shared record stays; the tombstone is set.
    const manageCount = await db
      .prepare("SELECT COUNT(*) AS n FROM manage_record WHERE workspace_id = ?")
      .bind(workspaceId)
      .first<{ n: number }>();
    expect(Number(manageCount!.n)).toBe(0);
    const draftRow = await db
      .prepare("SELECT COUNT(*) AS n FROM delivery_request WHERE id = 'req_draft_1'")
      .first<{ n: number }>();
    expect(Number(draftRow!.n)).toBe(0);
    const sharedRow = await db
      .prepare("SELECT status FROM delivery_request WHERE id = 'req_shared_1'")
      .first<{ status: string }>();
    expect(sharedRow!.status).toBe("cancelled");
    const workspace = await db
      .prepare("SELECT deleted_at, deleted_by FROM workspace WHERE id = ?")
      .bind(workspaceId)
      .first<{ deleted_at: number; deleted_by: string }>();
    expect(workspace!.deleted_at).not.toBeNull();
    expect(workspace!.deleted_by).toBe(ownerIdentityId);
    // The deletion is audited.
    const auditRow = await db
      .prepare(
        "SELECT action FROM network_audit_event WHERE action = 'project_deleted' AND result = 'success'",
      )
      .first<{ action: string }>();
    expect(auditRow).not.toBeNull();
    // The DRIVER's view of the retained shared record masks the owner.
    const driverDetail = await apiGet(worker, driver.cookie, "/api/delivery/requests/req_shared_1");
    expect(driverDetail.status).toBe(200);
    const detailBody = (await driverDetail.json()) as { requester: { displayName: string } };
    expect(detailBody.requester.displayName).toBe("مستخدم سابق");
    // The OWNER's own view of his record keeps HIS name (the G01 pattern).
    const ownDetail = await apiGet(worker, owner.cookieHeader, "/api/delivery/requests/req_shared_1");
    expect(ownDetail.status).toBe(200);
    const ownBody = (await ownDetail.json()) as { requester: { displayName: string } };
    expect(ownBody.requester.displayName).toBe("pl-del@example.test");
    // The membership is gone — the session no longer lists the project.
    const session = await apiGet(worker, owner.cookieHeader, "/api/auth/session");
    const sessionBody = (await session.json()) as { workspaces: { id: string }[] };
    expect(sessionBody.workspaces.find(w => w.id === workspaceId)).toBeUndefined();
    // A repeat deletion is refused honestly (the gate no longer finds an
    // active owner membership).
    const again = await apiPost(worker, owner.cookieHeader, `/api/account/projects/${workspaceId}/delete`, {
      exportId: exportBody.export.id,
      confirm: "حذف",
    });
    expect(again.status).toBe(404);
  });
});
