/**
 * Open-findings remediation (2026-11-23 — WS-254/DOC-044, the owner's
 * OPEN-FINDINGS-AND-PROTOTYPE-CODE-PROMPT): one focused regression test per
 * implemented fix, each exercising the risky behavior directly:
 *  - AUTHZ-04: creating a delivery request requires the caller's ACTIVE
 *    OWNER role in the named workspace (contract 21 binds delivery_request
 *    to the project owner; an active non-owner membership is an honest 403,
 *    not a silent pass);
 *  - AUTHZ-05: the market supplier-profile save enforces the same
 *    membership ROLE dimension server-side (one owner per project, no team
 *    roles — the owner's final decisions);
 *  - SRV-02: the Manage command surfaces read request bodies through the
 *    bounded readers — an oversized declared body is refused BEFORE any
 *    buffering (including through the idempotency command wrapper), while
 *    the migration apply route keeps its own documented larger envelope
 *    ceiling so an honest export-sized body still reaches its auth gate.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { apiPost, createWorkspace, rawDb, signInAs, startWorker, type WorkerInstance } from "./harness.ts";
import { createApprovedDriver } from "./delivery.helpers.ts";
import { readBodyTextWithin } from "../router.ts";

let worker: WorkerInstance;
let adminCookie: string;
let ownerCookie: string;
let ownerWorkspaceId: string;
let memberCookie: string;
let driverProfileId: string;

/** The shared valid directed-request body (OD03) for the named workspace. */
function deliveryRequestBody(workspaceId: string): Record<string, unknown> {
  return {
    driverProfileId,
    needType: "deliver_to_customer",
    loadClass: "small",
    weightBand: "under_10kg",
    pieceCount: 1,
    pricingMode: "prepriced",
    offeredFareMinor: "300",
    workspaceId,
    payload: {
      pickup: {
        governorate: "عمان",
        area: "جبل الحسين",
        name: "ورشة المصدر",
        phone: "+962795555001",
        address: "شارع 1",
      },
      dropoff: {
        governorate: "عمان",
        area: "وسط البلد",
        name: "زبون نهائي",
        phone: "+962795555002",
        address: "بناية 2",
      },
    },
  };
}

beforeAll(async () => {
  worker = await startWorker();
  adminCookie = (await signInAs(worker, { sub: "of-admin", email: "of-admin@example.test" })).cookieHeader;
  // Grant the platform-admin membership (the reviewer role lives in
  // network_membership, not workspace_member — same seeding as the delivery
  // and security suites).
  const adminDb = await rawDb(worker);
  const adminIdentity = await adminDb
    .prepare("SELECT id FROM network_identity WHERE email = ?")
    .bind("of-admin@example.test")
    .first<{ id: string }>();
  await adminDb
    .prepare(
      "INSERT INTO network_membership (identity_id, role, status, granted_by, granted_at) VALUES (?, 'admin', 'active', 'test', 1) ON CONFLICT (identity_id, role) DO UPDATE SET status='active'",
    )
    .bind(adminIdentity!.id)
    .run();
  ownerCookie = (await signInAs(worker, { sub: "of-owner", email: "of-owner@example.test" })).cookieHeader;
  ownerWorkspaceId = await createWorkspace(worker, ownerCookie, "مشروع النتائج المفتوحة");
  memberCookie = (await signInAs(worker, { sub: "of-member", email: "of-member@example.test" })).cookieHeader;
  // The NON-owner ACTIVE membership the role gate must refuse: seeded
  // directly because no invitation surface exists (final decision أ-4) — the
  // schema's own role CHECK ('owner','supplier','driver') still permits such
  // a row, and AUTHZ-04/05 must not depend on today's data never containing
  // one. 'supplier' is the realistic future member role (contract 18 §2).
  const db = await rawDb(worker);
  const memberIdentity = await db
    .prepare("SELECT id FROM network_identity WHERE email = ?")
    .bind("of-member@example.test")
    .first<{ id: string }>();
  const ownerIdentity = await db
    .prepare("SELECT id FROM network_identity WHERE email = ?")
    .bind("of-owner@example.test")
    .first<{ id: string }>();
  await db
    .prepare(
      "INSERT INTO workspace_member (workspace_id, identity_id, role, status, granted_by_identity_id, granted_at) VALUES (?, ?, 'supplier', 'active', ?, 1)",
    )
    .bind(ownerWorkspaceId, memberIdentity!.id, ownerIdentity!.id)
    .run();
  const driver = await createApprovedDriver(
    { worker, adminCookie },
    "of-driver@example.test",
    "of-driver-sub",
  );
  driverProfileId = driver.driverProfileId;
});

afterAll(async () => {
  await worker.close();
});

describe("AUTHZ-04 — delivery request creation requires the ACTIVE OWNER role", () => {
  it("refuses an active NON-owner member of the named workspace with 403 workspace_role_forbidden", async () => {
    const response = await apiPost(
      worker,
      memberCookie,
      "/api/delivery/requests",
      deliveryRequestBody(ownerWorkspaceId),
    );
    expect(response.status).toBe(403);
    const body = (await response.json()) as {
      error: { code: string; details?: { reason?: string; requiredRole?: string } };
    };
    expect(body.error.code).toBe("workspace_role_forbidden");
    expect(body.error.details?.reason).toBe("membership_role_insufficient");
    expect(body.error.details?.requiredRole).toBe("owner");
    // Nothing was created by the refused member.
    const db = await rawDb(worker);
    const requests = await db
      .prepare(
        "SELECT COUNT(*) AS n FROM delivery_request WHERE requester_identity_id = (SELECT id FROM network_identity WHERE email = ?)",
      )
      .bind("of-member@example.test")
      .first<{ n: number }>();
    expect(Number(requests?.n ?? 0)).toBe(0);
  });

  it("the workspace OWNER still creates the same directed request (the control case)", async () => {
    const response = await apiPost(
      worker,
      ownerCookie,
      "/api/delivery/requests",
      deliveryRequestBody(ownerWorkspaceId),
    );
    expect(response.status).toBe(201);
  });
});

describe("AUTHZ-05 — the market supplier-profile save enforces the membership ROLE server-side", () => {
  it("refuses an active NON-owner member binding a supplier profile to the workspace", async () => {
    const response = await apiPost(worker, memberCookie, "/api/market/vendor/profile", {
      displayName: "مورد عضو",
      contactPhone: "+962790000002",
      governorate: "عمان",
      workspaceId: ownerWorkspaceId,
    });
    expect(response.status).toBe(403);
    const body = (await response.json()) as { error: { code: string } };
    expect(body.error.code).toBe("workspace_role_forbidden");
  });
});

describe("SRV-02 — the Manage command surfaces read bodies through the bounded readers", () => {
  it("readBodyTextWithin refuses an oversized DECLARED length before the body is ever read (unit)", async () => {
    const oversized = {
      headers: new Headers({ "content-length": String(300 * 1024) }),
      text: () => {
        throw new Error("the body must never be read when the declared length is over the cap");
      },
    } as unknown as Request;
    await expect(readBodyTextWithin(oversized, 256 * 1024)).rejects.toMatchObject({
      status: 400,
      details: { reason: "body_too_large" },
    });
    // The post-read cap stays for the lying/chunked case.
    const lying = new Request("http://mf.local/x", {
      method: "POST",
      body: "x".repeat(300 * 1024),
    });
    await expect(readBodyTextWithin(lying, 256 * 1024)).rejects.toMatchObject({
      status: 400,
      details: { reason: "body_too_large" },
    });
    // An honest small body still reads normally.
    const honest = new Request("http://mf.local/x", { method: "POST", body: "صغير" });
    await expect(readBodyTextWithin(honest, 256 * 1024)).resolves.toBe("صغير");
  });

  it("an oversized Manage command body is refused before buffering THROUGH the idempotency wrapper (integration)", async () => {
    // A real 300 KB body: workerd derives content-length from the actual
    // body, so the declared-length precheck fires inside the command wrapper
    // BEFORE the handler (or any buffering for the request hash) runs.
    const bigBody = JSON.stringify({ nonce: "n".repeat(300 * 1024) });
    const response = await worker.fetch("/api/manage/link/confirm", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        origin: worker.origin,
        "x-micro-api": "1",
        cookie: ownerCookie,
        "idempotency-key": "srv02-oversized-manage-body",
      },
      body: bigBody,
    });
    expect(response.status).toBe(400);
    const body = (await response.json()) as { error: { code: string; details?: { reason?: string } } };
    expect(body.error.code).toBe("bad_request");
    expect(body.error.details?.reason).toBe("body_too_large");
  });

  it("the migration apply route keeps its documented larger envelope ceiling (an export-sized body is NOT refused as too large)", async () => {
    // A body over the canonical 256 KB JSON cap but well under the migration
    // envelope ceiling: the wrapper's cap is the route-registered larger one,
    // so the request proceeds past the body gates to the honest auth gate
    // (this caller is an active NON-owner member naming a workspace → 403
    // workspace_forbidden from the manage owner gate, never 400 body_too_large).
    const envelopeSized = JSON.stringify({
      workspaceId: ownerWorkspaceId,
      proofSecret: "s".repeat(300 * 1024),
    });
    const response = await worker.fetch("/api/manage/migrate/apply", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        origin: worker.origin,
        "x-micro-api": "1",
        cookie: memberCookie,
        "idempotency-key": "srv02-migration-envelope-sized",
      },
      body: envelopeSized,
    });
    expect(response.status).toBe(403);
    const body = (await response.json()) as { error: { code: string } };
    expect(body.error.code).toBe("workspace_forbidden");
  });
});
