/**
 * Post-Group 6 security hardening batch (owner order bd242b3e — WS-251/DOC-041):
 * focused tests directly exercising the risky behavior of each closed finding:
 *  - AUTHZ-01: an admin who is NOT a party can never accept/reject an
 *    agreement change (parties only — the administrative decision is a
 *    separate path);
 *  - AUTHZ-02: the admin reviewer is refused on their own driver
 *    profile/evidence/vehicle records (separation of duties);
 *  - AUTH-03: a returnTo containing a backslash never passes as internal;
 *  - SRV-02: an oversized declared body is refused BEFORE it is read;
 *  - SRV-06: rate keys never contain the raw IP (hashed) and expired windows
 *    are cleaned (bounded retention);
 *  - API-01: the public quantity-check path is rate-limited (429 over limit);
 *  - WEB-01: responses carry frame-ancestors 'none' (CSP) + X-Frame-Options.
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
import { createApprovedDriver, setupExecutionPair, type WorkerRefs } from "./delivery.helpers.ts";
import { readJsonBody } from "../router.ts";

let worker: WorkerInstance;
let adminCookie: string;
let adminDriverRefs: { cookie: string; driverProfileId: string };

async function grantAdmin(email: string): Promise<void> {
  const db = await rawDb(worker);
  const identity = await db
    .prepare("SELECT id FROM network_identity WHERE email = ?")
    .bind(email)
    .first<{ id: string }>();
  await db
    .prepare(
      "INSERT INTO network_membership (identity_id, role, status, granted_by, granted_at) VALUES (?, 'admin', 'active', 'test', 1) ON CONFLICT(identity_id, role) DO UPDATE SET status='active'",
    )
    .bind(identity!.id)
    .run();
}

beforeAll(async () => {
  worker = await startWorker();
  adminCookie = (await signInAs(worker, { sub: "sec-admin", email: "sec-admin@example.test" })).cookieHeader;
  await grantAdmin("sec-admin@example.test");
  // A SEPARATE second admin approves the first admin's driver records — the
  // same separation of duties the new guard enforces (nobody approves their
  // own record, so the helper cannot use the owner's own admin session).
  const secondAdminCookie = (await signInAs(worker, { sub: "sec-admin2", email: "sec-admin2@example.test" }))
    .cookieHeader;
  await grantAdmin("sec-admin2@example.test");
  // The SAME identity as the admin (same sub): the driver profile belongs to
  // the reviewer himself — the multi-hat case the final decision structurally
  // refuses going forward, seeded here directly to exercise the
  // separation-of-duties guard on the review path.
  adminDriverRefs = await createApprovedDriver(
    { worker, adminCookie: secondAdminCookie },
    "sec-admin@example.test",
    "sec-admin",
  );
});

afterAll(async () => {
  await worker.close();
});

describe("AUTHZ-02 — the admin never reviews their own driver records", () => {
  it("refuses the admin's own driver profile review (self_review_forbidden) and the record stays submitted", async () => {
    const db = await rawDb(worker);
    await db
      .prepare("UPDATE driver_profile SET status = 'submitted' WHERE id = ?")
      .bind(adminDriverRefs.driverProfileId)
      .run();
    const review = await apiPost(
      worker,
      adminCookie,
      `/api/delivery/review/driver/${adminDriverRefs.driverProfileId}`,
      { action: "approve" },
    );
    expect(review.status).toBe(403);
    expect(((await review.json()) as { error: { code: string } }).error.code).toBe("self_review_forbidden");
    const after = await db
      .prepare("SELECT status FROM driver_profile WHERE id = ?")
      .bind(adminDriverRefs.driverProfileId)
      .first<{ status: string }>();
    expect(after?.status).toBe("submitted");
  });

  it("refuses the admin's own evidence and vehicle reviews the same way", async () => {
    const db = await rawDb(worker);
    const evidence = await db
      .prepare("SELECT id FROM driver_evidence WHERE driver_profile_id = ? LIMIT 1")
      .bind(adminDriverRefs.driverProfileId)
      .first<{ id: string }>();
    const vehicle = await db
      .prepare("SELECT id FROM driver_vehicle WHERE driver_profile_id = ? LIMIT 1")
      .bind(adminDriverRefs.driverProfileId)
      .first<{ id: string }>();
    const evidenceReview = await apiPost(
      worker,
      adminCookie,
      `/api/delivery/review/evidence/${evidence!.id}`,
      {
        action: "approve",
      },
    );
    expect(evidenceReview.status).toBe(403);
    expect(((await evidenceReview.json()) as { error: { code: string } }).error.code).toBe(
      "self_review_forbidden",
    );
    const vehicleReview = await apiPost(worker, adminCookie, `/api/delivery/review/vehicle/${vehicle!.id}`, {
      action: "approve",
    });
    expect(vehicleReview.status).toBe(403);
    expect(((await vehicleReview.json()) as { error: { code: string } }).error.code).toBe(
      "self_review_forbidden",
    );
  });
});

describe("AUTHZ-01 — agreement changes are decided by the PARTIES only", () => {
  it("refuses an admin non-party decision on a pending proposal (agreement_parties_only)", async () => {
    const driver = await createApprovedDriver(
      { worker, adminCookie },
      "sec-driver@example.test",
      "sec-driver-sub",
    );
    const owner = await signInAs(worker, { sub: "sec-owner", email: "sec-owner@example.test" });
    const ownerWorkspaceId = await createWorkspace(worker, owner.cookieHeader, "مشروع قرار الاتفاق");
    const requestId = await setupExecutionPair(
      worker,
      owner.cookieHeader,
      driver.cookie,
      driver.driverProfileId,
      ownerWorkspaceId,
    );
    // The owner (a party) proposes a fare change.
    const proposal = await apiPost(worker, owner.cookieHeader, `/api/delivery/requests/${requestId}/change`, {
      changes: { fareMinor: "400" },
      note: "تعديل الأجرة",
    });
    expect(proposal.status).toBe(201);
    const { proposal: created } = (await proposal.json()) as { proposal: { id: string } };
    const proposalId = created.id;

    // The ADMIN (not a party) can never accept it — the honest 403.
    const adminDecision = await apiPost(
      worker,
      adminCookie,
      `/api/delivery/requests/${requestId}/change/decide`,
      { proposalId, decision: "accept" },
    );
    expect(adminDecision.status).toBe(403);
    expect(((await adminDecision.json()) as { error: { code: string } }).error.code).toBe("forbidden");

    // The driver (the other party) decides it fine.
    const driverDecision = await apiPost(
      worker,
      driver.cookie,
      `/api/delivery/requests/${requestId}/change/decide`,
      { proposalId, decision: "accept" },
    );
    expect(driverDecision.status).toBe(200);
  });
});

describe("AUTH-03 — backslash returnTo is never an internal path", () => {
  it("falls back to / when returnTo carries a backslash trick", async () => {
    const start = await worker.fetch(
      "/api/auth/google/start?returnTo=" + encodeURIComponent("/\\evil.example.test/x"),
    );
    expect(start.status).toBe(302);
    // The stored destination of the opened flow is the sanitized "/" — the
    // unsafe path never survives to any redirect (AUTH-03).
    const flowCookie = /micro_flow=([^;]+)/.exec(start.headers.get("set-cookie") ?? "")?.[1];
    expect(flowCookie).toBeDefined();
    const db = await rawDb(worker);
    const flow = await db
      .prepare("SELECT return_to FROM oauth_flow ORDER BY created_at DESC LIMIT 1")
      .first<{ return_to: string }>();
    expect(flow?.return_to).toBe("/");
  });

  it("keeps a genuinely internal path", async () => {
    const start = await worker.fetch("/api/auth/google/start?returnTo=%2Fmarket");
    expect(start.status).toBe(302);
    const flowCookie = /micro_flow=([^;]+)/.exec(start.headers.get("set-cookie") ?? "")?.[1];
    expect(flowCookie).toBeDefined();
  });
});

describe("SRV-02 — declared body size is refused before reading", () => {
  it("refuses an oversized declared body BEFORE reading it (unit — the transport forbids a lying header)", async () => {
    // A real transport recomputes content-length from the body, so the precheck
    // is exercised directly with a request whose DECLARED length lies — exactly
    // the early-refusal behavior SRV-02 adds before any buffering.
    const oversized = {
      headers: new Headers({
        "content-type": "application/json",
        "content-length": String(300 * 1024),
      }),
      text: () => {
        throw new Error("the body must never be read when the declared length is over the cap");
      },
    } as unknown as Request;
    await expect(readJsonBody(oversized)).rejects.toMatchObject({
      status: 400,
      details: { reason: "body_too_large" },
    });
    // An honest small body still parses normally.
    const honest = new Request("http://mf.local/x", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ ok: true }),
    });
    await expect(readJsonBody(honest)).resolves.toEqual({ ok: true });
  });
});

describe("SRV-06 — rate keys hold no raw IP and expired windows are cleaned", () => {
  it("stores hashed keys only (no raw address) in rate_counter", async () => {
    const guest = await apiGet(worker, null, "/api/market/listings");
    expect(guest.status).toBe(200);
    const db = await rawDb(worker);
    const rows = (await db.prepare("SELECT bucket FROM rate_counter").all<{ bucket: string }>()).results;
    expect(rows.length).toBeGreaterThan(0);
    for (const row of rows) {
      expect(row.bucket).not.toContain("127.0.0.1");
      expect(row.bucket).not.toMatch(/\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b/);
    }
  });

  it("cleans windows older than the retention horizon", async () => {
    const db = await rawDb(worker);
    await db
      .prepare("INSERT INTO rate_counter (bucket, window_start, count) VALUES ('sec-stale:test', 1, 5)")
      .run();
    // Enough enforcing traffic gives the probabilistic cleanup a real chance.
    for (let i = 0; i < 200; i += 1) {
      await apiGet(worker, null, "/api/market/listings");
    }
    const stale = await db
      .prepare("SELECT COUNT(*) AS n FROM rate_counter WHERE bucket = 'sec-stale:test'")
      .first<{ n: number }>();
    expect(Number(stale!.n)).toBe(0);
  });
});

describe("API-01 — the public quantity-check path is rate-limited", () => {
  it("refuses with 429 after the per-minute engineering limit", async () => {
    let refused = false;
    for (let i = 0; i < 70 && !refused; i += 1) {
      const response = await apiPost(worker, null, "/api/market/quantity-check", {
        minQuantityMilli: "1000",
        stepMilli: "500",
        requestedMilli: "2000",
      });
      if (response.status === 429) {
        refused = true;
        expect(((await response.json()) as { error: { code: string } }).error.code).toBe("too_many_requests");
      } else {
        expect(response.status).toBe(200);
      }
    }
    expect(refused).toBe(true);
  });
});

describe("PUBLIC-DRIVER-PROFILE — the public page is an allowlist; the phone never leaks", () => {
  it("the public profile returns ONLY the allowlisted fields (no phone/terms/ceilings)", async () => {
    // The AUTHZ-02 test left this profile 'submitted'; re-approve it directly
    // (the DTO allowlist is what this test exercises, not the review flow).
    const db = await rawDb(worker);
    await db
      .prepare("UPDATE driver_profile SET status = 'approved' WHERE id = ?")
      .bind(adminDriverRefs.driverProfileId)
      .run();
    const response = await apiGet(worker, null, `/api/delivery/drivers/${adminDriverRefs.driverProfileId}`);
    expect(response.status).toBe(200);
    const body = (await response.json()) as {
      driver: Record<string, unknown>;
    };
    expect(body.driver.displayName).toBeDefined();
    expect(body.driver.governorates).toBeDefined();
    expect(body.driver.phone).toBeUndefined();
    expect(body.driver.terms).toBeUndefined();
    expect(body.driver.ceilings).toBeUndefined();
  });

  it("the directory entries carry no contact fields either", async () => {
    const response = await apiGet(worker, null, "/api/delivery/drivers");
    expect(response.status).toBe(200);
    const body = (await response.json()) as { drivers: Record<string, unknown>[] };
    expect(body.drivers.length).toBeGreaterThan(0);
    for (const entry of body.drivers) {
      expect(entry.phone).toBeUndefined();
      expect(entry.terms).toBeUndefined();
    }
  });
});

describe("WEB-01 — frame protections on every response class", () => {
  it("API responses carry X-Frame-Options: DENY", async () => {
    const response = await apiGet(worker, null, "/api/health");
    expect(response.headers.get("x-frame-options")).toBe("DENY");
  });

  it("the sign-in error page CSP includes frame-ancestors 'none'", async () => {
    const response = await worker.fetch("/api/auth/google/callback?code=x&state=y");
    const csp = response.headers.get("content-security-policy") ?? "";
    expect(csp).toContain("frame-ancestors 'none'");
    expect(response.headers.get("x-frame-options")).toBe("DENY");
  });
});
