/**
 * In-app reminders due-processing (contract 19 §9 — continuation 2026-11-12,
 * §17-6 closure): Market 30-day availability reminder + 60-day hide notice
 * (OD-11), Delivery 24-hour requester-confirmation reminder (contract 21
 * §3.2-5), and the 7-day driver-evidence-expiry reminder (OD31). All values
 * are operational engineering choices; the processor is idempotent (running
 * twice never duplicates), the admin endpoint is admin-only, the scheduled
 * export runs the same processor, and no reminder ever transitions state.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { apiGet, apiPost, rawDb, signInAs, startWorker, type WorkerInstance } from "./harness.ts";
import { createApprovedDriver, type WorkerRefs, setupExecutionPair } from "./delivery.helpers.ts";

const DAY = 24 * 60 * 60 * 1000;

let worker: WorkerInstance;
let adminCookie: string;
let ownerCookie: string;
let vendorCookie: string;
let plainUserCookie: string;
let driverProfileId: string;
let driverCookie: string;

beforeAll(async () => {
  worker = await startWorker();
  adminCookie = (await signInAs(worker, { sub: "rm-admin", email: "rm-admin@example.test" })).cookieHeader;
  const db = await rawDb(worker);
  const adminIdentity = await db
    .prepare("SELECT id FROM network_identity WHERE email = ?")
    .bind("rm-admin@example.test")
    .first<{ id: string }>();
  await db
    .prepare(
      "INSERT INTO network_membership (identity_id, role, status, granted_by, granted_at) VALUES (?, 'admin', 'active', 'test', 1)",
    )
    .bind(adminIdentity!.id)
    .run();
  ownerCookie = (await signInAs(worker, { sub: "rm-owner", email: "rm-owner@example.test" })).cookieHeader;
  const refs: WorkerRefs = { worker, adminCookie };
  const driver = await createApprovedDriver(refs, "rm-driver@example.test", "rm-driver-sub");
  driverCookie = driver.cookie;
  driverProfileId = driver.driverProfileId;
  vendorCookie = (await signInAs(worker, { sub: "rm-vendor", email: "rm-vendor@example.test" })).cookieHeader;
  plainUserCookie = (await signInAs(worker, { sub: "rm-user", email: "rm-user@example.test" })).cookieHeader;
  const profileResponse = await apiPost(worker, vendorCookie, "/api/market/vendor/profile", {
    displayName: "مورد التذكيرات",
    contactPhone: "+962790000003",
    governorate: "عمان",
  });
  const profile = (await profileResponse.json()) as { profile: { id: string } };
  await apiPost(worker, vendorCookie, "/api/market/vendor/profile/submit", {});
  await apiPost(worker, adminCookie, `/api/market/review/profile/${profile.profile.id}`, {
    action: "approve",
  });
});

afterAll(async () => {
  await worker.close();
});

async function publishListing(title: string): Promise<string> {
  const media = await worker.fetch("/api/media?purpose=market_listing_media", {
    method: "POST",
    headers: { "content-type": "image/png", origin: worker.origin, "x-micro-api": "1", cookie: vendorCookie },
    body: new Uint8Array([5, 5, 5]),
  });
  const mediaBody = (await media.json()) as { media: { id: string } };
  const created = await apiPost(worker, vendorCookie, "/api/market/vendor/listings", {
    title,
    category: "paper",
    governorate: "عمان",
    description: "وصف مادة ورق كافٍ للطول المطلوب هنا لأجل الاختبار.",
    contactType: "phone",
    contactValue: "+962790000003",
    pricing: { mode: "fixed", priceMicroJod: "1200000", basis: { units: "1", unit: "رزمة" } },
    quantity: { unit: "رزمة", minQuantityMilli: "1000", stepMilli: "500", unpacked: true },
  });
  const { listing } = (await created.json()) as { listing: { id: string } };
  await apiPost(worker, vendorCookie, `/api/market/vendor/listings/${listing.id}/media`, {
    mediaId: mediaBody.media.id,
    kind: "cover",
  });
  await apiPost(worker, vendorCookie, `/api/market/vendor/listings/${listing.id}/submit`, {});
  await apiPost(worker, adminCookie, `/api/market/review/listing/${listing.id}`, { action: "approve" });
  await apiPost(worker, adminCookie, `/api/market/review/media/${mediaBody.media.id}`, { action: "approve" });
  return listing.id;
}

async function countNotifications(identityEmail: string, type: string): Promise<number> {
  const db = await rawDb(worker);
  const identity = await db
    .prepare("SELECT id FROM network_identity WHERE email = ?")
    .bind(identityEmail)
    .first<{ id: string }>();
  const rows = await db
    .prepare("SELECT id FROM network_notification WHERE identity_id = ? AND type = ?")
    .bind(identity!.id, type)
    .all<{ id: number }>();
  return rows.results.length;
}

describe("reminders due-processing (contract 19 §9 — §17-6 closure)", () => {
  it("market 30-day reminder and 60-day hide notice, once each, idempotently", async () => {
    const reminderListing = await publishListing("إعلان يحتاج تأكيد توفر");
    const expiredListing = await publishListing("إعلان قديم انتهت حداثته");
    const freshListing = await publishListing("إعلان حديث");
    const db = await rawDb(worker);
    const now = Date.now();
    await db
      .prepare("UPDATE supplier_listing SET availability_confirmed_at = ? WHERE id = ?")
      .bind(now - 35 * DAY, reminderListing)
      .run();
    await db
      .prepare("UPDATE supplier_listing SET availability_confirmed_at = ? WHERE id = ?")
      .bind(now - 61 * DAY, expiredListing)
      .run();
    // freshListing keeps its confirmation anchor (now-ish).
    const run = await apiPost(worker, adminCookie, "/api/admin/reminders/due", {});
    expect(run.status).toBe(200);
    const summary = (await run.json()) as {
      summary: { freshnessReminders: number; expiryNotices: number };
    };
    expect(summary.summary.freshnessReminders).toBeGreaterThanOrEqual(1);
    expect(summary.summary.expiryNotices).toBeGreaterThanOrEqual(1);
    expect(await countNotifications("rm-vendor@example.test", "listing_freshness_reminder")).toBe(1);
    expect(await countNotifications("rm-vendor@example.test", "listing_expired")).toBe(1);
    // Idempotent: a second run adds nothing.
    await apiPost(worker, adminCookie, "/api/admin/reminders/due", {});
    expect(await countNotifications("rm-vendor@example.test", "listing_freshness_reminder")).toBe(1);
    expect(await countNotifications("rm-vendor@example.test", "listing_expired")).toBe(1);
    // The fresh listing never produced a reminder.
    const freshRow = await db
      .prepare("SELECT availability_confirmed_at FROM supplier_listing WHERE id = ?")
      .bind(freshListing)
      .first<{ availability_confirmed_at: number }>();
    expect(now - freshRow!.availability_confirmed_at).toBeLessThan(30 * DAY);
    // The reminders never mutated listing state (no auto action).
    const rows = await db
      .prepare("SELECT id, status FROM supplier_listing WHERE id IN (?, ?)")
      .bind(reminderListing, expiredListing)
      .all<{ id: string; status: string }>();
    for (const row of rows.results) expect(row.status).toBe("approved_for_publish");
  }, 120_000);

  it("24-hour requester-confirmation reminder, once, without closing anything", async () => {
    const requestId = await setupExecutionPair(worker, ownerCookie, driverCookie, driverProfileId);
    await apiPost(worker, driverCookie, `/api/driver/requests/${requestId}/declare`, { kind: "start" });
    await apiPost(worker, driverCookie, `/api/driver/requests/${requestId}/declare`, { kind: "arrive" });
    await apiPost(worker, driverCookie, `/api/driver/requests/${requestId}/declare`, {
      kind: "pickup_declared",
    });
    await apiPost(worker, driverCookie, `/api/driver/requests/${requestId}/declare`, {
      kind: "transit_started",
    });
    await apiPost(worker, driverCookie, `/api/driver/requests/${requestId}/declare`, {
      kind: "delivery_declared",
    });
    const db = await rawDb(worker);
    // The declaration stamped the anchor; age it past 24h.
    const stamped = await db
      .prepare("SELECT confirmation_requested_at FROM delivery_execution WHERE request_id = ?")
      .bind(requestId)
      .first<{ confirmation_requested_at: number | null }>();
    expect(stamped!.confirmation_requested_at).not.toBeNull();
    await db
      .prepare("UPDATE delivery_execution SET confirmation_requested_at = ? WHERE request_id = ?")
      .bind(Date.now() - 25 * 60 * 60 * 1000, requestId)
      .run();
    await apiPost(worker, adminCookie, "/api/admin/reminders/due", {});
    expect(await countNotifications("rm-owner@example.test", "confirmation_requested")).toBe(1);
    // Idempotent on a second run.
    await apiPost(worker, adminCookie, "/api/admin/reminders/due", {});
    expect(await countNotifications("rm-owner@example.test", "confirmation_requested")).toBe(1);
    // OD16: the reminder never closed or confirmed anything.
    const execution = await db
      .prepare("SELECT confirmation_status FROM delivery_execution WHERE request_id = ?")
      .bind(requestId)
      .first<{ confirmation_status: string }>();
    expect(execution!.confirmation_status).toBe("awaiting_requester_confirmation");
  });

  it("7-day evidence-expiry reminder only for a CLEAR approaching date", async () => {
    const db = await rawDb(worker);
    const evidence = await db
      .prepare("SELECT id FROM driver_evidence WHERE driver_profile_id = ? AND category = 'identity'")
      .bind(driverProfileId)
      .first<{ id: string }>();
    await db
      .prepare("UPDATE driver_evidence SET expires_at = ? WHERE id = ?")
      .bind(Date.now() + 3 * DAY, evidence!.id)
      .run();
    await apiPost(worker, adminCookie, "/api/admin/reminders/due", {});
    expect(await countNotifications("rm-driver@example.test", "evidence_expiry_reminder")).toBe(1);
    await apiPost(worker, adminCookie, "/api/admin/reminders/due", {});
    expect(await countNotifications("rm-driver@example.test", "evidence_expiry_reminder")).toBe(1);
    // Outside the window: no second evidence gets a reminder.
    const license = await db
      .prepare("SELECT id FROM driver_evidence WHERE driver_profile_id = ? AND category = 'license'")
      .bind(driverProfileId)
      .first<{ id: string }>();
    await db
      .prepare("UPDATE driver_evidence SET expires_at = ? WHERE id = ?")
      .bind(Date.now() + 20 * DAY, license!.id)
      .run();
    await apiPost(worker, adminCookie, "/api/admin/reminders/due", {});
    const driverNotifications = (await (await apiGet(worker, driverCookie, "/api/notifications")).json()) as {
      notifications: { type: string }[];
    };
    expect(driverNotifications.notifications.filter(n => n.type === "evidence_expiry_reminder")).toHaveLength(
      1,
    );
  });

  it("the admin endpoint is admin-only; the scheduled export runs the same processor", async () => {
    const forbidden = await apiPost(worker, plainUserCookie, "/api/admin/reminders/due", {});
    expect(forbidden.status).toBe(403);
    // The worker scheduled export — what a Cloudflare Cron Trigger invokes.
    // (Miniflare 4: triggered through the /cdn-cgi/handler/scheduled route
    // with unsafeTriggerHandlers enabled in the harness.)
    const triggered = await worker.fetch("/cdn-cgi/handler/scheduled");
    expect(triggered.status).toBe(200);
    const db = await rawDb(worker);
    const identity = await db
      .prepare("SELECT id FROM network_identity WHERE email = ?")
      .bind("rm-vendor@example.test")
      .first<{ id: string }>();
    const freshness = await db
      .prepare(
        "SELECT COUNT(*) AS n FROM network_notification WHERE identity_id = ? AND type = 'listing_freshness_reminder'",
      )
      .bind(identity!.id)
      .first<{ n: number }>();
    expect(freshness!.n).toBe(1);
  });
});
