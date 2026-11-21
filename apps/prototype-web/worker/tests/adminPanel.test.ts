/**
 * Platform Admin panel (Post-Group 6 continuous completion — WS-251/DOC-041,
 * owner order 7593b9c4 §4 G02): ONLY the Q129-defined pieces —
 *   «كل الطوابير مع عمر كل عنصر» (queues with ages),
 *   «البحث عن مستخدم بالاسم أو البريد أو الهاتف» (user search),
 *   «سجل القرارات» (the admin decisions log),
 *   «إيقاف هوية كاملة بسبب» (full identity suspension with a reason),
 *   «إلغاء حجز جارٍ بقرار إداري مع سبب» (administrative cancel of an
 *   ongoing booking with a reason + the immediate booker notification),
 *   «أرقام تشغيلية بسيطة» (the honest Q154 counts).
 * Least privilege: no route here reads or writes manage_record — the admin
 * gains NO Manage financial access; non-admin callers are refused everywhere.
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
  const admin = await signInAs(worker, { sub: "ap-admin", email: "ap-admin@example.test" });
  const db = await rawDb(worker);
  await db
    .prepare(
      "INSERT INTO network_membership (identity_id, role, status, granted_by, granted_at) " +
        "SELECT id, 'admin', 'active', 'test', 1 FROM network_identity WHERE email = ?",
    )
    .bind("ap-admin@example.test")
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

describe("G02 admin panel: server-side protection (least privilege)", () => {
  it("every panel route refuses a non-admin caller (and a guest)", async () => {
    const user = await signInAs(worker, { sub: "ap-user", email: "ap-user@example.test" });
    for (const path of [
      "/api/admin/panel/queues",
      "/api/admin/panel/user-search?q=abc",
      "/api/admin/panel/decisions",
    ]) {
      const guest = await apiGet(worker, null, path);
      expect(guest.status).toBe(401);
      const refused = await apiGet(worker, user.cookieHeader, path);
      expect(refused.status).toBe(403);
    }
    const suspend = await apiPost(worker, user.cookieHeader, "/api/admin/panel/identities/x/suspend", {
      reason: "محاولة غير مصرح بها",
    });
    expect(suspend.status).toBe(403);
    const cancel = await apiPost(
      worker,
      user.cookieHeader,
      "/api/admin/panel/delivery/requests/x/admin-cancel",
      {
        reason: "محاولة غير مصرح بها",
      },
    );
    expect(cancel.status).toBe(403);
  });
});

describe("G02 admin panel: queues with ages + honest operational counts", () => {
  it("the consolidated queues carry each item's server-clock age and the Q154 counts", async () => {
    const owner = await signInAs(worker, { sub: "ap-owner", email: "ap-owner@example.test" });
    const ownerWorkspaceId = await createWorkspace(worker, owner.cookieHeader, "مشروع لوحة المشرف");
    const driver = await createApprovedDriver(refs, "ap-driver@example.test", "ap-driver");
    const bookingId = await setupExecutionPair(
      worker,
      owner.cookieHeader,
      driver.cookie,
      driver.driverProfileId,
      ownerWorkspaceId,
    );
    const response = await apiGet(worker, adminCookie, "/api/admin/panel/queues");
    expect(response.status).toBe(200);
    const body = (await response.json()) as {
      queues: {
        driverApplications: { id: string; ageMs: number | null }[];
        openCases: { id: number; requestId: string; ageMs: number | null }[];
        marketListings: unknown[];
      };
      opsCounts: { activeDrivers: number; weeklyBookings: number; activeSuppliers: number };
    };
    expect(body.opsCounts.activeDrivers).toBe(1);
    expect(body.opsCounts.weeklyBookings).toBeGreaterThanOrEqual(1);
    expect(body.opsCounts.activeSuppliers).toBe(0);
    // An open case filed on the ongoing booking appears with its age.
    const filed = await apiPost(worker, owner.cookieHeader, `/api/delivery/requests/${bookingId}/report`, {
      reason: "undelivered",
      details: "بلاغ اختبار اللوحة",
    });
    expect(filed.status).toBe(201);
    const after = (await (await apiGet(worker, adminCookie, "/api/admin/panel/queues")).json()) as {
      queues: { openCases: { requestId: string; ageMs: number | null }[] };
    };
    const openCase = after.queues.openCases.find(c => c.requestId === bookingId);
    expect(openCase).toBeDefined();
    expect(openCase!.ageMs).not.toBeNull();
    expect(openCase!.ageMs!).toBeGreaterThanOrEqual(0);
  });
});

describe("G02 admin panel: user search by name, email, or phone", () => {
  it("finds a supplier by phone, a user by email, and shows the honest role/suspension state", async () => {
    const vendor = await signInAs(worker, { sub: "ap-vendor", email: "ap-vendor@example.test" });
    const workspaceId = await createWorkspace(worker, vendor.cookieHeader, "مشروع مورد البحث");
    await apiPost(worker, vendor.cookieHeader, "/api/market/vendor/profile", {
      displayName: "مورد الهاتف المطلوب",
      contactPhone: "+962790555001",
      governorate: "عمان",
      supplierType: "manufacturer",
      deliveryOption: "delivery",
      termsAccepted: true,
      workspaceId,
    });
    // By phone (the work copy is the only place it lives).
    const byPhone = (await (
      await apiGet(worker, adminCookie, "/api/admin/panel/user-search?q=%2B962790555001")
    ).json()) as {
      users: { identityId: string; vendorStatus: string | null; matchedBy: string }[];
    };
    expect(byPhone.users).toHaveLength(1);
    expect(byPhone.users[0]!.vendorStatus).toBe("active");
    expect(byPhone.users[0]!.matchedBy).toBe("phone");
    // By email.
    const byEmail = (await (
      await apiGet(worker, adminCookie, "/api/admin/panel/user-search?q=ap-vendor%40example.test")
    ).json()) as { users: { identityId: string }[] };
    expect(byEmail.users.map(u => u.identityId)).toContain(byPhone.users[0]!.identityId);
    // A short query is an honest 400.
    const short = await apiGet(worker, adminCookie, "/api/admin/panel/user-search?q=a");
    expect(short.status).toBe(400);
  });
});

describe("G02 admin panel: the decisions log", () => {
  it("records the admin's decisions with ages (the audit trail the decision requires)", async () => {
    // An admin decision exists: approving a driver.
    await createApprovedDriver(refs, "ap-log@example.test", "ap-log");
    const response = await apiGet(worker, adminCookie, "/api/admin/panel/decisions");
    expect(response.status).toBe(200);
    const body = (await response.json()) as {
      decisions: { action: string; result: string; ageMs: number; actorName: string | null }[];
    };
    expect(body.decisions.length).toBeGreaterThan(0);
    expect(body.decisions.every(d => d.ageMs >= 0)).toBe(true);
    expect(body.decisions.some(d => d.action.includes("review") || d.action.includes("approve"))).toBe(true);
    // A regular user's audit events never appear here (admin actors only).
    const user = await signInAs(worker, { sub: "ap-noise", email: "ap-noise@example.test" });
    const ws = await createWorkspace(worker, user.cookieHeader, "مشروع ضجيج");
    void ws;
    const refreshed = (await (await apiGet(worker, adminCookie, "/api/admin/panel/decisions")).json()) as {
      decisions: { action: string }[];
    };
    expect(refreshed.decisions.some(d => d.action === "workspace_create")).toBe(false);
  });
});

describe("G02 admin panel: «إيقاف هوية كاملة بسبب»", () => {
  it("suspension requires a reason, revokes the sessions, blocks the account, and keeps bookings completing", async () => {
    const owner = await signInAs(worker, { sub: "ap-susp-owner", email: "ap-susp-owner@example.test" });
    const ownerWorkspaceId = await createWorkspace(worker, owner.cookieHeader, "مشروع الإيقاف");
    const driver = await createApprovedDriver(refs, "ap-susp-driver@example.test", "ap-susp-driver");
    const bookingId = await setupExecutionPair(
      worker,
      owner.cookieHeader,
      driver.cookie,
      driver.driverProfileId,
      ownerWorkspaceId,
    );
    const driverIdentityId = await identityIdOf("ap-susp-driver@example.test");
    // A reason is mandatory.
    const noReason = await apiPost(
      worker,
      adminCookie,
      `/api/admin/panel/identities/${driverIdentityId}/suspend`,
      {
        reason: "قص",
      },
    );
    expect(noReason.status).toBe(400);
    const suspended = await apiPost(
      worker,
      adminCookie,
      `/api/admin/panel/identities/${driverIdentityId}/suspend`,
      {
        reason: "خطر على الناس — بلاغ موثق",
      },
    );
    expect(suspended.status).toBe(201);
    // Every active session of the identity is revoked NOW — his API access fails.
    const portal = await apiGet(worker, driver.cookie, "/api/driver/portal");
    expect(portal.status).toBe(401);
    // The ongoing booking is NOT auto-cancelled (final decision ج) — it stays
    // for its parties; the administrative cancel is a separate explicit act.
    const db = await rawDb(worker);
    const booking = await db
      .prepare("SELECT status FROM delivery_request WHERE id = ?")
      .bind(bookingId)
      .first<{ status: string }>();
    expect(booking!.status).toBe("confirmed");
    // A second suspension of the same identity is an honest 409.
    const twice = await apiPost(
      worker,
      adminCookie,
      `/api/admin/panel/identities/${driverIdentityId}/suspend`,
      {
        reason: "محاولة إيقاف ثانية",
      },
    );
    expect(twice.status).toBe(409);
    // The search shows the honest suspended state with the reason.
    const search = (await (
      await apiGet(worker, adminCookie, "/api/admin/panel/user-search?q=ap-susp-driver")
    ).json()) as { users: { suspended: boolean; suspensionReason: string | null }[] };
    expect(search.users[0]!.suspended).toBe(true);
    expect(search.users[0]!.suspensionReason).toBe("خطر على الناس — بلاغ موثق");
    // The decision is in the log and the audit trail.
    const log = (await (await apiGet(worker, adminCookie, "/api/admin/panel/decisions")).json()) as {
      decisions: { action: string; reason: string | null }[];
    };
    const entry = log.decisions.find(d => d.action === "identity_suspended");
    expect(entry).toBeDefined();
    expect(entry!.reason).toBe("خطر على الناس — بلاغ موثق");
  });

  it("an ADMIN identity is never a suspension target (lockout protection)", async () => {
    const adminIdentityId = await identityIdOf("ap-admin@example.test");
    const refused = await apiPost(
      worker,
      adminCookie,
      `/api/admin/panel/identities/${adminIdentityId}/suspend`,
      {
        reason: "محاولة إيقاف حساب الإدارة",
      },
    );
    expect(refused.status).toBe(403);
    const body = (await refused.json()) as { error: { details: { reason: string } } };
    expect(body.error.details.reason).toBe("admin_identity_not_suspendable");
  });

  it("the suspended identity cannot open a NEW session (the Google callback refuses with the reason)", async () => {
    const target = await signInAs(worker, { sub: "ap-susp-signin", email: "ap-susp-signin@example.test" });
    const targetIdentityId = await identityIdOf("ap-susp-signin@example.test");
    await apiPost(worker, adminCookie, `/api/admin/panel/identities/${targetIdentityId}/suspend`, {
      reason: "اختبار منع الدخول",
    });
    // The Google sign-in flow (mock) is refused with the honest reason — the
    // flow cookie rides along exactly as a real browser would carry it.
    const startResponse = await worker.fetch("/api/auth/google/start?returnTo=/", {
      headers: { "x-micro-api": "1", origin: worker.origin },
      redirect: "manual",
    });
    const location = startResponse.headers.get("location") ?? "";
    const params = new URL(location).searchParams;
    const flowCookie = /micro_flow=([^;]+)/.exec(startResponse.headers.get("set-cookie") ?? "")?.[1];
    worker.googleMock.nextPayload = {
      iss: "https://accounts.google.com",
      aud: "test-client-id",
      exp: Math.floor(Date.now() / 1000) + 3600,
      nonce: params.get("nonce"),
      sub: "ap-susp-signin",
      email: "ap-susp-signin@example.test",
      email_verified: true,
      name: "موقوف",
    };
    const callback = await worker.fetch(
      `/api/auth/google/callback?code=susp&state=${encodeURIComponent(params.get("state") ?? "")}`,
      { headers: { cookie: `micro_flow=${flowCookie}` } },
    );
    expect(callback.status).toBe(403);
    const text = await callback.text();
    expect(text).toContain("حسابك موقوف حاليًا");
    expect(text).toContain("اختبار منع الدخول");
    void target;
  });
});

describe("G02 admin panel: «إلغاء حجز جارٍ بقرار إداري مع سبب»", () => {
  it("cancels an ONGOING booking with a reason, notifies the booker, records the event, and audits the decision", async () => {
    const owner = await signInAs(worker, { sub: "ap-cancel-owner", email: "ap-cancel-owner@example.test" });
    const ownerWorkspaceId = await createWorkspace(worker, owner.cookieHeader, "مشروع الإلغاء الإداري");
    const driver = await createApprovedDriver(refs, "ap-cancel-driver@example.test", "ap-cancel-driver");
    const bookingId = await setupExecutionPair(
      worker,
      owner.cookieHeader,
      driver.cookie,
      driver.driverProfileId,
      ownerWorkspaceId,
    );
    // A reason is mandatory.
    const noReason = await apiPost(
      worker,
      adminCookie,
      `/api/admin/panel/delivery/requests/${bookingId}/admin-cancel`,
      { reason: "قص" },
    );
    expect(noReason.status).toBe(400);
    const cancelled = await apiPost(
      worker,
      adminCookie,
      `/api/admin/panel/delivery/requests/${bookingId}/admin-cancel`,
      { reason: "خطر على الناس — إلغاء إداري" },
    );
    expect(cancelled.status).toBe(200);
    const body = (await cancelled.json()) as { from: string };
    expect(body.from).toBe("confirmed");
    const db = await rawDb(worker);
    const booking = await db
      .prepare("SELECT status FROM delivery_request WHERE id = ?")
      .bind(bookingId)
      .first<{ status: string }>();
    expect(booking!.status).toBe("cancelled");
    const event = await db
      .prepare(
        "SELECT event_type, reason FROM delivery_event WHERE request_id = ? AND event_type = 'admin_cancelled'",
      )
      .bind(bookingId)
      .first<{ event_type: string; reason: string }>();
    expect(event).not.toBeNull();
    expect(event!.reason).toBe("خطر على الناس — إلغاء إداري");
    // «يُبلَّغ صاحب الحجز فورًا» — the in-app notification with the reason
    // (located by the admin-cancel idempotency key — the precise row).
    const ownerIdentityId = await identityIdOf("ap-cancel-owner@example.test");
    const notification = await db
      .prepare(
        "SELECT type, payload_json FROM network_notification WHERE identity_id = ? AND idempotency_key = ?",
      )
      .bind(ownerIdentityId, `admin-cancel:${bookingId}`)
      .first<{ type: string; payload_json: string }>();
    expect(notification).not.toBeNull();
    expect(notification!.type).toBe("status_changed");
    expect(notification!.payload_json).toContain("خطر على الناس — إلغاء إداري");
    // The booking's records survive (never deleted) — the requester still reads it.
    const detail = await apiGet(worker, owner.cookieHeader, `/api/delivery/requests/${bookingId}`);
    expect(detail.status).toBe(200);
    // A TERMINAL booking is not cancellable administratively (ongoing only).
    const again = await apiPost(
      worker,
      adminCookie,
      `/api/admin/panel/delivery/requests/${bookingId}/admin-cancel`,
      { reason: "محاولة ثانية على حجز منتهٍ" },
    );
    expect(again.status).toBe(404);
  });
});
