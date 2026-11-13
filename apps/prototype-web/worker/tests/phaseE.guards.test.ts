/**
 * Phase E (S12 wave W6) focused guards:
 *  - F-07: delivery_scoped reads and DENIED reads are audited (contract 22 §4)
 *          — actor/reference/time only, never a content copy.
 *  - F-08: a multi-hat admin cannot review their own records (OD18 parity).
 *  - F-09: the public driver profile is rate-limited like the directory.
 *  - F-12: report follow-up decisions (contract 22 §2 closed set) with no
 *          auto-mutation of the reported object.
 *  - F-13: driver application invitations (OD22 — context only, single-use).
 *  - F-25: the global module kill-switch fails business actions closed with
 *          an honest state while entry points/reads stay available.
 */
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { apiGet, apiPost, rawDb, signInAs, startWorker, type WorkerInstance } from "./harness.ts";
import { createApprovedDriver, setupExecutionPair, type WorkerRefs } from "./delivery.helpers.ts";

let worker: WorkerInstance;
let adminCookie: string;

async function makeAdmin(email: string): Promise<string> {
  const session = await signInAs(worker, { sub: email, email });
  const db = await rawDb(worker);
  await db
    .prepare(
      "INSERT INTO network_membership (identity_id, role, status, granted_by, granted_at) " +
        "SELECT id, 'admin', 'active', 'test', 1 FROM network_identity WHERE email = ?",
    )
    .bind(email)
    .run();
  return session.cookieHeader;
}

async function putSetting(cookie: string, key: string, value: unknown): Promise<Response> {
  return worker.fetch(`/api/admin/settings/${key}`, {
    method: "PUT",
    headers: { "content-type": "application/json", origin: worker.origin, "x-micro-api": "1", cookie },
    body: JSON.stringify({ value }),
  });
}

async function apiDelete(cookie: string, path: string): Promise<Response> {
  return worker.fetch(path, {
    method: "DELETE",
    headers: { "content-type": "application/json", origin: worker.origin, "x-micro-api": "1", cookie },
    body: JSON.stringify({}),
  });
}

async function identityIdOf(email: string): Promise<string> {
  const db = await rawDb(worker);
  const row = await db
    .prepare("SELECT id FROM network_identity WHERE email = ?")
    .bind(email)
    .first<{ id: string }>();
  if (!row) throw new Error(`identity ${email} missing`);
  return row.id;
}

const BOOKING_PAYLOAD = (driverProfileId: string) => ({
  driverProfileId,
  needType: "deliver_to_customer",
  pricingMode: "prepriced",
  offeredFareMinor: "300",
  payload: {
    pickup: {
      governorate: "عمان",
      area: "تلاع العلي",
      name: "ورشة",
      phone: "+962795555001",
      address: "شارع 1",
    },
    dropoff: {
      governorate: "الزرقاء",
      area: "وسط",
      name: "زبون",
      phone: "+962795555002",
      address: "بناية 2",
    },
    load: { description: "صناديق", parcels: 3, fragile: false },
    schedule: { pickupWindow: "09:00-11:00", dropoffWindow: "13:00-15:00", date: "2026-11-21" },
  },
});

beforeEach(async () => {
  worker = await startWorker();
  adminCookie = await makeAdmin("pe-admin@example.test");
});

afterEach(async () => {
  await worker.close();
});

describe("F-25: global module kill-switch — business actions fail closed, entries stay", () => {
  it("market disabled → vendor actions 503 module_globally_disabled with an honest message; public reads unaffected; re-enable restores", async () => {
    const vendor = await signInAs(worker, { sub: "pe-v1", email: "pe-v1@example.test" });
    const profile = {
      displayName: "مورد القاطع",
      contactPhone: "+962790000101",
      governorate: "عمان",
    };
    const first = await apiPost(worker, vendor.cookieHeader, "/api/market/vendor/profile", profile);
    expect(first.status).toBe(201);
    // Only the admin may flip the switch; only honest values are accepted.
    expect((await putSetting(vendor.cookieHeader, "market.enabled", "disabled")).status).toBe(403);
    expect((await putSetting(adminCookie, "market.enabled", "maybe")).status).toBe(400);
    expect((await putSetting(adminCookie, "market.enabled", "disabled")).status).toBe(200);
    const blocked = await apiPost(worker, vendor.cookieHeader, "/api/market/vendor/profile", {
      ...profile,
      contactPhone: "+962790000102",
    });
    expect(blocked.status).toBe(503);
    const body = (await blocked.json()) as { error: { code: string; message: string } };
    expect(body.error.code).toBe("module_globally_disabled");
    expect(body.error.message).toContain("موقوفة مؤقتًا");
    // Entry points / public reads stay available (EX-D19: the product is
    // never hidden — only the business action fails closed).
    expect((await apiGet(worker, null, "/api/market/listings")).status).toBe(200);
    expect((await apiGet(worker, null, "/api/market/meta")).status).toBe(200);
    // Re-enabling restores the action — the profile now exists, so the
    // honest success is the UPDATE path (200), not a second create.
    expect((await putSetting(adminCookie, "market.enabled", "enabled")).status).toBe(200);
    const restored = await apiPost(worker, vendor.cookieHeader, "/api/market/vendor/profile", {
      ...profile,
      contactPhone: "+962790000103",
    });
    expect(restored.status).toBe(200);
    const restoredBody = (await restored.json()) as { profile: { status: string } };
    expect(restoredBody.profile.status).toBe("draft");
  });

  it("delivery disabled → booking creation fails closed 503", async () => {
    const refs: WorkerRefs = { worker, adminCookie };
    const driver = await createApprovedDriver(refs, "pe-driver-k@example.test", "pe-driver-k");
    const owner = await signInAs(worker, { sub: "pe-ok1", email: "pe-ok1@example.test" });
    const first = await apiPost(
      worker,
      owner.cookieHeader,
      "/api/delivery/requests",
      BOOKING_PAYLOAD(driver.driverProfileId),
    );
    expect(first.status).toBe(201);
    expect((await putSetting(adminCookie, "delivery.enabled", "disabled")).status).toBe(200);
    const blocked = await apiPost(
      worker,
      owner.cookieHeader,
      "/api/delivery/requests",
      BOOKING_PAYLOAD(driver.driverProfileId),
    );
    expect(blocked.status).toBe(503);
    const body = (await blocked.json()) as { error: { code: string } };
    expect(body.error.code).toBe("module_globally_disabled");
    // The driver directory (public read) is unaffected.
    expect((await apiGet(worker, null, "/api/delivery/drivers")).status).toBe(200);
  });
});

describe("F-08: a multi-hat admin cannot review their own records", () => {
  it("the admin's own vendor profile is refused (self_review_forbidden) and stays pending; another admin decides", async () => {
    // The ADMIN identity creates and submits their own vendor profile.
    const own = await apiPost(worker, adminCookie, "/api/market/vendor/profile", {
      displayName: "الأدمن المورد",
      contactPhone: "+962790000110",
      governorate: "عمان",
    });
    expect(own.status).toBe(201);
    expect((await apiPost(worker, adminCookie, "/api/market/vendor/profile/submit", {})).status).toBe(200);
    const db = await rawDb(worker);
    const adminId = await identityIdOf("pe-admin@example.test");
    const profileRow = await db
      .prepare("SELECT id, status FROM supplier_profile WHERE identity_id = ?")
      .bind(adminId)
      .first<{ id: string; status: string }>();
    expect(profileRow?.status).toBe("submitted");
    const review = await apiPost(worker, adminCookie, `/api/market/review/profile/${profileRow!.id}`, {
      action: "approve",
    });
    expect(review.status).toBe(403);
    const body = (await review.json()) as { error: { code: string; message: string } };
    expect(body.error.code).toBe("self_review_forbidden");
    expect(body.error.message).toContain("سجلك الخاص");
    // The record was NOT decided by the refusal.
    const after = await db
      .prepare("SELECT status FROM supplier_profile WHERE id = ?")
      .bind(profileRow!.id)
      .first<{ status: string }>();
    expect(after?.status).toBe("submitted");
    // A DIFFERENT admin reviews the same profile fine.
    const admin2 = await makeAdmin("pe-admin2@example.test");
    const ok = await apiPost(worker, admin2, `/api/market/review/profile/${profileRow!.id}`, {
      action: "approve",
    });
    expect(ok.status).toBe(200);
  });

  it("the admin's own uploaded media is refused the same way", async () => {
    const upload = await worker.fetch("/api/media?purpose=market_listing_media", {
      method: "POST",
      headers: {
        "content-type": "image/png",
        origin: worker.origin,
        "x-micro-api": "1",
        cookie: adminCookie,
      },
      body: new Uint8Array([1, 2, 3, 4]),
    });
    expect(upload.status).toBe(201);
    const { media } = (await upload.json()) as { media: { id: string } };
    const review = await apiPost(worker, adminCookie, `/api/market/review/media/${media.id}`, {
      action: "approve",
    });
    expect(review.status).toBe(403);
    const body = (await review.json()) as { error: { code: string } };
    expect(body.error.code).toBe("self_review_forbidden");
    const db = await rawDb(worker);
    const row = await db
      .prepare("SELECT status FROM media_object WHERE id = ?")
      .bind(media.id)
      .first<{ status: string }>();
    expect(row?.status).toBe("pending");
  });
});

describe("F-12: report follow-up decisions (contract 22 §2 closed set)", () => {
  it("acknowledge keeps the report open; close resolves with actor+note; every decision is recorded; the object never auto-mutates", async () => {
    const reporter = await signInAs(worker, { sub: "pe-rep", email: "pe-rep@example.test" });
    const filed = await apiPost(worker, reporter.cookieHeader, "/api/market/report", {
      listingId: "lst_report_target",
      reason: "spam",
    });
    expect(filed.status).toBe(201);
    const db = await rawDb(worker);
    const reportId = (
      await db.prepare("SELECT id FROM market_report ORDER BY id DESC LIMIT 1").first<{ id: string }>()
    )?.id;
    expect(reportId).toBeTruthy();
    // Closed-set validation: unknown action / missing reason are 400s; a
    // non-admin is refused.
    expect(
      (await apiPost(worker, adminCookie, `/api/market/review/report/${reportId}`, { action: "delete" }))
        .status,
    ).toBe(400);
    expect(
      (await apiPost(worker, adminCookie, `/api/market/review/report/${reportId}`, { action: "acknowledge" }))
        .status,
    ).toBe(400);
    expect(
      (
        await apiPost(worker, reporter.cookieHeader, `/api/market/review/report/${reportId}`, {
          action: "close",
          reason: "إغلاق ذاتي",
        })
      ).status,
    ).toBe(403);
    // Acknowledge: recorded, report stays open.
    const ack = await apiPost(worker, adminCookie, `/api/market/review/report/${reportId}`, {
      action: "acknowledge",
      reason: "تم استلام البلاغ",
    });
    expect(ack.status).toBe(200);
    expect(((await ack.json()) as { resolved: boolean }).resolved).toBe(false);
    let row = await db
      .prepare("SELECT status, resolution_note, resolved_by, resolved_at FROM market_report WHERE id = ?")
      .bind(reportId)
      .first<{
        status: string;
        resolution_note: string | null;
        resolved_by: string | null;
        resolved_at: number | null;
      }>();
    expect(row?.status).toBe("open");
    expect(row?.resolved_at).toBeNull();
    // Close: resolves with actor + note.
    const close = await apiPost(worker, adminCookie, `/api/market/review/report/${reportId}`, {
      action: "close",
      reason: "لا مخالفة بعد المراجعة",
    });
    expect(close.status).toBe(200);
    expect(((await close.json()) as { resolved: boolean }).resolved).toBe(true);
    row = await db
      .prepare("SELECT status, resolution_note, resolved_by, resolved_at FROM market_report WHERE id = ?")
      .bind(reportId)
      .first<{ status: string; resolution_note: string; resolved_by: string; resolved_at: number | null }>();
    expect(row?.status).toBe("resolved");
    expect(row?.resolution_note).toBe("لا مخالفة بعد المراجعة");
    const adminId = await identityIdOf("pe-admin@example.test");
    expect(row?.resolved_by).toBe(adminId);
    expect(row?.resolved_at).not.toBeNull();
    // A resolved report is never re-decided from this path.
    expect(
      (
        await apiPost(worker, adminCookie, `/api/market/review/report/${reportId}`, {
          action: "close",
          reason: "مرة أخرى",
        })
      ).status,
    ).toBe(409);
    // Every decision lives in the moderation history + audit + reporter inbox.
    const events = await db
      .prepare(
        "SELECT action, reason, actor_identity_id FROM market_moderation_event WHERE object_type = 'market_report' AND object_id = ? ORDER BY id",
      )
      .bind(String(reportId))
      .all<{ action: string; reason: string; actor_identity_id: string }>();
    expect(events.results.map(event => event.action)).toEqual(["acknowledge", "close"]);
    const audits = await db
      .prepare(
        "SELECT action, result FROM network_audit_event WHERE object_type = 'market_report' ORDER BY id",
      )
      .all<{ action: string; result: string }>();
    expect(audits.results.map(entry => entry.action)).toEqual([
      "review_report_acknowledge",
      "review_report_close",
    ]);
    const reporterId = await identityIdOf("pe-rep@example.test");
    const notes = await db
      .prepare("SELECT type FROM network_notification WHERE identity_id = ? ORDER BY id")
      .bind(reporterId)
      .all<{ type: string }>();
    // Filing already receipts the reporter (report_replied), then each
    // recorded decision notifies again — three in-app messages total.
    expect(notes.results.map(note => note.type)).toEqual([
      "report_replied",
      "report_replied",
      "report_replied",
    ]);
  });

  it("the admin who filed the report cannot resolve it either", async () => {
    const adminId = await identityIdOf("pe-admin@example.test");
    const db = await rawDb(worker);
    await db
      .prepare(
        "INSERT INTO market_report (reporter_identity_id, object_type, object_id, reason, created_at) VALUES (?, 'supplier_listing', 'lst_x', 'other', 1)",
      )
      .bind(adminId)
      .run();
    const reportId = (
      await db.prepare("SELECT id FROM market_report ORDER BY id DESC LIMIT 1").first<{ id: string }>()
    )?.id;
    const attempt = await apiPost(worker, adminCookie, `/api/market/review/report/${reportId}`, {
      action: "close",
      reason: "بلاغي",
    });
    expect(attempt.status).toBe(403);
    const body = (await attempt.json()) as { error: { code: string } };
    expect(body.error.code).toBe("self_review_forbidden");
  });
});

describe("F-13: driver application invitations (OD22 — context only, single-use)", () => {
  it("create → consume binds exactly one identity; reuse is 409; nothing is activated; the trail is audited", async () => {
    const plain = await signInAs(worker, { sub: "pe-p1", email: "pe-p1@example.test" });
    // Only the admin issues invitations.
    expect((await apiPost(worker, plain.cookieHeader, "/api/admin/driver-invitations", {})).status).toBe(403);
    expect(
      (await apiPost(worker, adminCookie, "/api/admin/driver-invitations", { expiresInDays: 0 })).status,
    ).toBe(400);
    const created = await apiPost(worker, adminCookie, "/api/admin/driver-invitations", {});
    expect(created.status).toBe(201);
    const { invitation } = (await created.json()) as { invitation: { code: string; expiresAt: number } };
    expect(invitation.code).toMatch(/^dinv_/);
    expect(invitation.expiresAt).toBeGreaterThan(Date.now());
    // Consuming requires the shared Micro session.
    expect((await apiPost(worker, null, `/api/driver/invitation/${invitation.code}`, {})).status).toBe(401);
    const db = await rawDb(worker);
    const identitiesBefore = (
      await db.prepare("SELECT COUNT(*) AS n FROM network_identity").first<{ n: number }>()
    )?.n;
    const consumed = await apiPost(
      worker,
      plain.cookieHeader,
      `/api/driver/invitation/${invitation.code}`,
      {},
    );
    expect(consumed.status).toBe(200);
    expect(((await consumed.json()) as { invitationContext: boolean }).invitationContext).toBe(true);
    // Single-use: the same person (or anyone else) gets 409 afterwards.
    expect(
      (await apiPost(worker, plain.cookieHeader, `/api/driver/invitation/${invitation.code}`, {})).status,
    ).toBe(409);
    const other = await signInAs(worker, { sub: "pe-p2", email: "pe-p2@example.test" });
    expect(
      (await apiPost(worker, other.cookieHeader, `/api/driver/invitation/${invitation.code}`, {})).status,
    ).toBe(409);
    // The row is bound to exactly the consuming identity — AT38: the same
    // person with the same Micro identity, no second account created.
    const row = await db
      .prepare("SELECT used_by_identity_id, used_at FROM driver_invitation WHERE code = ?")
      .bind(invitation.code)
      .first<{ used_by_identity_id: string; used_at: number }>();
    const plainId = await identityIdOf("pe-p1@example.test");
    expect(row?.used_by_identity_id).toBe(plainId);
    expect(row?.used_at).not.toBeNull();
    const identitiesAfter = (
      await db.prepare("SELECT COUNT(*) AS n FROM network_identity").first<{ n: number }>()
    )?.n;
    expect(identitiesAfter).toBe(identitiesBefore! + 1); // only `other`'s sign-in
    // Context ONLY: no driver profile, no activation, no membership.
    const profiles = await db.prepare("SELECT COUNT(*) AS n FROM driver_profile").first<{ n: number }>();
    expect(profiles?.n).toBe(0);
    const memberships = await db
      .prepare("SELECT COUNT(*) AS n FROM workspace_member WHERE identity_id = ?")
      .bind(plainId)
      .first<{ n: number }>();
    expect(memberships?.n).toBe(0);
    // The admin trail is audited.
    const audits = await db
      .prepare("SELECT action FROM network_audit_event WHERE object_type = 'driver_invitation' ORDER BY id")
      .all<{ action: string }>();
    expect(audits.results.map(entry => entry.action)).toEqual([
      "driver_invitation_created",
      "driver_invitation_consumed",
    ]);
    // Unknown codes are a plain 404.
    expect(
      (await apiPost(worker, plain.cookieHeader, "/api/driver/invitation/dinv_missing", {})).status,
    ).toBe(404);
  });

  it("cancellation and expiry fail closed; self-application stays open regardless (OD22)", async () => {
    const user = await signInAs(worker, { sub: "pe-p3", email: "pe-p3@example.test" });
    // Create → cancel → consume is 410.
    const created = await apiPost(worker, adminCookie, "/api/admin/driver-invitations", { expiresInDays: 7 });
    const { code } = ((await created.json()) as { invitation: { code: string } }).invitation;
    expect((await apiDelete(adminCookie, `/api/admin/driver-invitations/${code}`)).status).toBe(200);
    const afterCancel = await apiPost(worker, user.cookieHeader, `/api/driver/invitation/${code}`, {});
    expect(afterCancel.status).toBe(410);
    expect(((await afterCancel.json()) as { error: { code: string } }).error.code).toBe("invitation_expired");
    // Cancelling an unused invitation is idempotent (200 again); cancelling
    // a CONSUMED invitation is a 409 (it is history now, not a live token).
    expect((await apiDelete(adminCookie, `/api/admin/driver-invitations/${code}`)).status).toBe(200);
    const createdUsed = await apiPost(worker, adminCookie, "/api/admin/driver-invitations", {});
    const { code: usedCode } = ((await createdUsed.json()) as { invitation: { code: string } }).invitation;
    expect((await apiPost(worker, user.cookieHeader, `/api/driver/invitation/${usedCode}`, {})).status).toBe(
      200,
    );
    expect((await apiDelete(adminCookie, `/api/admin/driver-invitations/${usedCode}`)).status).toBe(409);
    // A naturally expired invitation is 410 as well.
    const created2 = await apiPost(worker, adminCookie, "/api/admin/driver-invitations", {});
    const { code: code2 } = ((await created2.json()) as { invitation: { code: string } }).invitation;
    const db = await rawDb(worker);
    await db.prepare("UPDATE driver_invitation SET expires_at = 1 WHERE code = ?").bind(code2).run();
    const expired = await apiPost(worker, user.cookieHeader, `/api/driver/invitation/${code2}`, {});
    expect(expired.status).toBe(410);
    // OD22: self-application is NEVER blocked by invitation state.
    const apply = await apiPost(worker, user.cookieHeader, "/api/driver/profile", {
      displayName: "سائق متقدم",
      phone: "+962790000120",
      serviceAreas: ["عمان"],
    });
    expect(apply.status).toBe(201);
    const profileRow = await db
      .prepare("SELECT status FROM driver_profile WHERE identity_id = ?")
      .bind(await identityIdOf("pe-p3@example.test"))
      .first<{ status: string }>();
    // Review is still required — an invitation never approves anything.
    expect(profileRow?.status).not.toBe("approved");
  });
});

describe("F-09: the public driver profile is rate-limited (guest abuse control)", () => {
  it("exceeding the guest read limit throttles driver profile reads like the directory", async () => {
    const refs: WorkerRefs = { worker, adminCookie };
    const driver = await createApprovedDriver(refs, "pe-d9@example.test", "pe-d9");
    expect((await putSetting(adminCookie, "rate.limits", { guestReadsPerMinute: 2 })).status).toBe(200);
    const read = () => apiGet(worker, null, `/api/delivery/drivers/${driver.driverProfileId}`);
    expect((await read()).status).toBe(200);
    expect((await read()).status).toBe(200);
    const throttled = await read();
    expect(throttled.status).toBe(429);
    expect(((await throttled.json()) as { error: { code: string } }).error.code).toBe("too_many_requests");
  });
});

describe("F-07: delivery scoped-read and denied-read audit (contract 22 §4)", () => {
  it("a stranger's denied request read returns 404 AND is audited (no content copy)", async () => {
    const refs: WorkerRefs = { worker, adminCookie };
    const driver = await createApprovedDriver(refs, "pe-d1@example.test", "pe-d1");
    const owner = await signInAs(worker, { sub: "pe-o2", email: "pe-o2@example.test" });
    const requestId = await setupExecutionPair(
      worker,
      owner.cookieHeader,
      driver.cookie,
      driver.driverProfileId,
    );
    const stranger = await signInAs(worker, { sub: "pe-s1", email: "pe-s1@example.test" });
    const denied = await apiGet(worker, stranger.cookieHeader, `/api/delivery/requests/${requestId}`);
    expect(denied.status).toBe(404);
    const db = await rawDb(worker);
    const strangerId = await identityIdOf("pe-s1@example.test");
    const row = await db
      .prepare(
        "SELECT actor_identity_id, action, result, object_id, meta_json, created_at FROM network_audit_event WHERE action = 'delivery_request_read'",
      )
      .first<{
        actor_identity_id: string;
        action: string;
        result: string;
        object_id: string;
        meta_json: string | null;
        created_at: number;
      }>();
    expect(row?.result).toBe("denied");
    expect(row?.actor_identity_id).toBe(strangerId);
    expect(row?.object_id).toBe(requestId);
    expect(row?.created_at).toBeGreaterThan(0);
    // No content copy — the audit row carries no payload fields at all.
    expect(row?.meta_json).toBeNull();
  });

  it("the assigned driver reading recipient-scoped details under the allowed disclosure is audited (scope only)", async () => {
    const refs: WorkerRefs = { worker, adminCookie };
    const driver = await createApprovedDriver(refs, "pe-d2@example.test", "pe-d2");
    const owner = await signInAs(worker, { sub: "pe-o3", email: "pe-o3@example.test" });
    // Owner/legal gate decision recorded through the allowlisted setting.
    expect((await putSetting(adminCookie, "disclosure.recipient", "allowed_after_acceptance")).status).toBe(
      200,
    );
    const requestId = await setupExecutionPair(
      worker,
      owner.cookieHeader,
      driver.cookie,
      driver.driverProfileId,
    );
    const view = await apiGet(worker, driver.cookie, `/api/delivery/requests/${requestId}`);
    expect(view.status).toBe(200);
    const db = await rawDb(worker);
    const driverId = await identityIdOf("pe-d2@example.test");
    const row = await db
      .prepare(
        "SELECT actor_identity_id, action, result, object_id, meta_json FROM network_audit_event WHERE action = 'delivery_scoped_read'",
      )
      .first<{
        actor_identity_id: string;
        action: string;
        result: string;
        object_id: string;
        meta_json: string | null;
      }>();
    expect(row?.result).toBe("success");
    expect(row?.actor_identity_id).toBe(driverId);
    expect(row?.object_id).toBe(requestId);
    // The audit carries the SCOPE marker only — never the field contents
    // (the recipient phone must not appear anywhere in the audit row).
    expect(row?.meta_json).toBe(JSON.stringify({ scope: "recipient_details" }));
    expect(row?.meta_json).not.toContain("+962");
    // The requester reading their own request is NOT a scoped read (own data).
    await apiGet(worker, owner.cookieHeader, `/api/delivery/requests/${requestId}`);
    const scopedCount = (
      await db
        .prepare("SELECT COUNT(*) AS n FROM network_audit_event WHERE action = 'delivery_scoped_read'")
        .first<{ n: number }>()
    )?.n;
    expect(scopedCount).toBe(1);
  });
});
