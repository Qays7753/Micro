/**
 * Account role lifecycle (Post-Group 6 continuous completion — WS-251/DOC-041,
 * owner order 7593b9c4 §4 G01): the non-destructive role-removal and
 * draft-cancellation behavior stated verbatim in the 2026-11-21 final
 * decisions (ب — دورة الدور Q5):
 *
 *   - «إلغاء المسودة فوري» — an immediate draft cancel that deletes only
 *     rows which never left the owner's account (no public/counterparty data).
 *   - «السائق لا يُزال دوره وعنده حجز جارٍ» — the ongoing-booking protection.
 *   - «المورد تُخفى إعلاناته فورًا وتُؤرشف» — supplier removal hides+archives
 *     every listing and preserves every row (never a financial/history delete).
 *   - «السجلات المنتهية التي تخص الطرف الآخر تبقى باسم «مستخدم سابق»» — the
 *     other party's records survive under the former-user mask.
 *   - Removal is not silently reversible (re-adding is an unspecified recovery
 *     semantic — refused honestly, decided by the owner).
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
  const admin = await signInAs(worker, { sub: "roles-admin", email: "roles-admin@example.test" });
  const db = await rawDb(worker);
  await db
    .prepare(
      "INSERT INTO network_membership (identity_id, role, status, granted_by, granted_at) " +
        "SELECT id, 'admin', 'active', 'test', 1 FROM network_identity WHERE email = ?",
    )
    .bind("roles-admin@example.test")
    .run();
  adminCookie = admin.cookieHeader;
  refs = { worker, adminCookie };
});

afterEach(async () => {
  await worker.close();
});

async function activeVendorWithListings(tag: string): Promise<{
  cookie: string;
  workspaceId: string;
  profileId: string;
  draftListingId: string;
  publishedListingId: string;
  mediaId: string;
}> {
  const session = await signInAs(worker, { sub: `rv-${tag}`, email: `rv-${tag}@example.test` });
  const cookie = session.cookieHeader;
  const workspaceId = await createWorkspace(worker, cookie, `مشروع ${tag}`);
  const profileResponse = await apiPost(worker, cookie, "/api/market/vendor/profile", {
    displayName: `مورد ${tag}`,
    contactPhone: "+962790100001",
    governorate: "عمان",
    supplierType: "manufacturer",
    deliveryOption: "delivery",
    termsAccepted: true,
    workspaceId,
  });
  const profile = (await profileResponse.json()) as { profile: { id: string; status: string } };
  expect(profile.profile.status).toBe("active");
  // A published listing (content + media approved — the full publication gate).
  const mediaResponse = await worker.fetch("/api/media?purpose=market_listing_media", {
    method: "POST",
    headers: { "content-type": "image/png", origin: worker.origin, "x-micro-api": "1", cookie },
    body: new Uint8Array([1, 2, 3, 4, 5]),
  });
  const media = (await mediaResponse.json()) as { media: { id: string } };
  const listingResponse = await apiPost(worker, cookie, "/api/market/vendor/listings", {
    title: `أكواب تغليف ${tag} للنشر 12 حبة`,
    category: "packaging",
    governorate: "عمان",
    description: "وصف مادة تغليف للاختبار مع تفاصيل كافية للنشر.",
    contactType: "phone",
    contactValue: "+962790100001",
    pricing: { mode: "fixed", priceMicroJod: "1500000", basis: { units: "12", unit: "حبة" } },
    quantity: { unit: "حبة", minQuantityMilli: "24000", stepMilli: "12000", unpacked: true },
  });
  const published = (await listingResponse.json()) as { listing: { id: string } };
  await apiPost(worker, cookie, `/api/market/vendor/listings/${published.listing.id}/media`, {
    mediaId: media.media.id,
    kind: "cover",
  });
  await apiPost(worker, cookie, `/api/market/vendor/listings/${published.listing.id}/submit`, {});
  await apiPost(worker, adminCookie, `/api/market/review/listing/${published.listing.id}`, {
    action: "approve",
    verificationCall: { done: true, note: "اتصال تحقق أول إعلان — تم" },
  });
  await apiPost(worker, adminCookie, `/api/market/review/media/${media.media.id}`, { action: "approve" });
  const browse = (await (await apiGet(worker, null, "/api/market/listings")).json()) as { count: number };
  expect(browse.count).toBe(1);
  // A second listing left in draft.
  const draftResponse = await apiPost(worker, cookie, "/api/market/vendor/listings", {
    title: `مسودة إعلان ${tag} لم تُنشر بعد`,
    category: "packaging",
    governorate: "عمان",
    description: "وصف مسودة إعلان كافٍ للطول المطلوب في التحقق الخادمي.",
    contactType: "phone",
    contactValue: "+962790100001",
    pricing: { mode: "fixed", priceMicroJod: "900000", basis: { units: "6", unit: "حبة" } },
    quantity: { unit: "حبة", minQuantityMilli: "6000", stepMilli: "6000", unpacked: true },
  });
  const draft = (await draftResponse.json()) as { listing: { id: string } };
  return {
    cookie,
    workspaceId,
    profileId: profile.profile.id,
    draftListingId: draft.listing.id,
    publishedListingId: published.listing.id,
    mediaId: media.media.id,
  };
}

describe("G01 role lifecycle: supplier draft cancellation (immediate)", () => {
  it("an INCOMPLETE profile stays draft and cancels immediately — rows gone, nothing public ever existed", async () => {
    const session = await signInAs(worker, { sub: "rv-draft1", email: "rv-draft1@example.test" });
    const cookie = session.cookieHeader;
    const workspaceId = await createWorkspace(worker, cookie, "مشروع مسودة المورد");
    const draft = await apiPost(worker, cookie, "/api/market/vendor/profile", {
      displayName: "مورد مسودة",
      contactPhone: "+962790200001",
      governorate: "عمان",
      workspaceId,
    });
    const body = (await draft.json()) as { profile: { status: string } };
    expect(body.profile.status).toBe("draft");
    const cancel = await apiPost(worker, cookie, "/api/account/roles/supplier/cancel-draft", {});
    expect(cancel.status).toBe(200);
    const db = await rawDb(worker);
    const count = await db
      .prepare(
        "SELECT COUNT(*) AS n FROM supplier_profile WHERE identity_id = (SELECT id FROM network_identity WHERE email = ?)",
      )
      .bind("rv-draft1@example.test")
      .first<{ n: number }>();
    expect(Number(count!.n)).toBe(0);
    // The audit trail keeps the actorless-but-attributed record of the cancel.
    const auditRow = await db
      .prepare(
        "SELECT COUNT(*) AS n FROM network_audit_event WHERE action = 'supplier_draft_cancelled' AND result = 'success'",
      )
      .first<{ n: number }>();
    expect(Number(auditRow!.n)).toBe(1);
    // A fresh start stays possible — a NEW draft is not blocked by the cancel.
    const again = await apiPost(worker, cookie, "/api/market/vendor/profile", {
      displayName: "مورد مسودة جديدة",
      contactPhone: "+962790200002",
      governorate: "عمان",
      workspaceId,
    });
    const againBody = (await again.json()) as { profile: { status: string } };
    expect(againBody.profile.status).toBe("draft");
  });

  it("cancel-draft refuses an ACTIVATED profile honestly (removal is the path, never a silent delete)", async () => {
    const vendor = await activeVendorWithListings("cancelrefuse");
    const cancel = await apiPost(worker, vendor.cookie, "/api/account/roles/supplier/cancel-draft", {});
    expect(cancel.status).toBe(409);
    const body = (await cancel.json()) as { error: { details: { reason: string } } };
    expect(body.error.details.reason).toContain("supplier_draft_required");
  });

  it("a driver draft cancels immediately — profile, vehicle and evidence rows gone", async () => {
    const session = await signInAs(worker, { sub: "drv-draft1", email: "drv-draft1@example.test" });
    const cookie = session.cookieHeader;
    const profileResponse = await apiPost(worker, cookie, "/api/driver/profile", {
      displayName: "سائق مسودة",
      phone: "+962790300001",
      serviceAreas: ["عمان"],
    });
    const profile = (await profileResponse.json()) as { driverProfileId: string };
    const cancel = await apiPost(worker, cookie, "/api/account/roles/driver/cancel-draft", {});
    expect(cancel.status).toBe(200);
    const db = await rawDb(worker);
    const count = await db
      .prepare("SELECT COUNT(*) AS n FROM driver_profile WHERE id = ?")
      .bind(profile.driverProfileId)
      .first<{ n: number }>();
    expect(Number(count!.n)).toBe(0);
    const auditRow = await db
      .prepare(
        "SELECT COUNT(*) AS n FROM network_audit_event WHERE action = 'driver_draft_cancelled' AND result = 'success'",
      )
      .first<{ n: number }>();
    expect(Number(auditRow!.n)).toBe(1);
  });

  it("cancel-draft refuses an approved driver (his application is not a draft)", async () => {
    const driver = await createApprovedDriver(refs, "drv-approve1@example.test", "drv-approve1");
    const cancel = await apiPost(worker, driver.cookie, "/api/account/roles/driver/cancel-draft", {});
    expect(cancel.status).toBe(409);
  });

  it("a stranger with no profile gets an honest 404 (no cross-account effect)", async () => {
    const stranger = await signInAs(worker, { sub: "rv-none", email: "rv-none@example.test" });
    const supplier = await apiPost(
      worker,
      stranger.cookieHeader,
      "/api/account/roles/supplier/cancel-draft",
      {},
    );
    expect(supplier.status).toBe(404);
    const driver = await apiPost(worker, stranger.cookieHeader, "/api/account/roles/driver/cancel-draft", {});
    expect(driver.status).toBe(404);
  });
});

describe("G01 role lifecycle: supplier removal — «تُخفى إعلاناته فورًا وتُؤرشف»", () => {
  it("removal archives EVERY listing, hides them publicly, and preserves every row", async () => {
    const vendor = await activeVendorWithListings("remove1");
    const remove = await apiPost(worker, vendor.cookie, "/api/account/roles/supplier/remove", {});
    expect(remove.status).toBe(200);
    const db = await rawDb(worker);
    const profile = await db
      .prepare("SELECT status, removed_at FROM supplier_profile WHERE id = ?")
      .bind(vendor.profileId)
      .first<{ status: string; removed_at: number | null }>();
    expect(profile!.status).toBe("removed");
    expect(profile!.removed_at).not.toBeNull();
    // Every listing is archived and PRESERVED (never deleted).
    const listings = await db
      .prepare("SELECT id, status FROM supplier_listing WHERE supplier_profile_id = ? ORDER BY id")
      .bind(vendor.profileId)
      .all<{ id: string; status: string }>();
    expect(listings.results).toHaveLength(2);
    for (const row of listings.results) {
      expect(row.status).toBe("archived");
    }
    // Public surfaces: the published listing is gone from browse and detail.
    const browse = (await (await apiGet(worker, null, "/api/market/listings")).json()) as { count: number };
    expect(browse.count).toBe(0);
    const detail = await apiGet(worker, null, `/api/market/listings/${vendor.publishedListingId}`);
    expect(detail.status).toBe(404);
    // Audited.
    const auditRow = await db
      .prepare(
        "SELECT COUNT(*) AS n FROM network_audit_event WHERE action = 'supplier_role_removed' AND result = 'success'",
      )
      .first<{ n: number }>();
    expect(Number(auditRow!.n)).toBe(1);
  });

  it("a removed supplier's OLD application stays frozen — archived listings are not revived or mutated", async () => {
    const vendor = await activeVendorWithListings("remove2");
    await apiPost(worker, vendor.cookie, "/api/account/roles/supplier/remove", {});
    /* Owner supplement §10.1-1 (2026-11-22): re-adding is a NEW application
     * — the save below now creates a fresh profile (asserted in the re-add
     * suite); this test pins that the OLD application itself stays frozen:
     * its listings are never un-archived or mutated through their own paths. */
    const update = await apiPost(
      worker,
      vendor.cookie,
      `/api/market/vendor/listings/${vendor.draftListingId}`,
      { title: "تعديل بعد الإزالة مرفوض" },
    );
    expect(update.status).toBe(409);
    const secondRemove = await apiPost(worker, vendor.cookie, "/api/account/roles/supplier/remove", {});
    expect(secondRemove.status).toBe(409);
    const db = await rawDb(worker);
    const oldListings = await db
      .prepare("SELECT status FROM supplier_listing WHERE supplier_profile_id = ?")
      .bind(vendor.profileId)
      .all<{ status: string }>();
    expect(oldListings.results).toHaveLength(2);
    for (const row of oldListings.results) {
      expect(row.status).toBe("archived");
    }
  });
});

describe("G01 role re-add (owner supplement §10.1-1): a removed role is re-added as a NEW application", () => {
  it("supplier re-add: a fresh application row, the archived history untouched, nothing restored", async () => {
    const vendor = await activeVendorWithListings("readd1");
    await apiPost(worker, vendor.cookie, "/api/account/roles/supplier/remove", {});
    // Re-add = a new application through the normal save path (201, new id).
    const save = await apiPost(worker, vendor.cookie, "/api/market/vendor/profile", {
      displayName: "مورد عاد بطلب جديد",
      contactPhone: "+962790100001",
      governorate: "عمان",
      supplierType: "manufacturer",
      deliveryOption: "delivery",
      termsAccepted: true,
      workspaceId: vendor.workspaceId,
    });
    expect(save.status).toBe(201);
    const saved = (await save.json()) as {
      profile: { id: string; status: string };
      reapplied?: boolean;
    };
    expect(saved.profile.id).not.toBe(vendor.profileId);
    expect(saved.profile.status).toBe("active"); // the NORMAL new-application flow (complete + terms)
    expect(saved.reapplied).toBe(true);
    const db = await rawDb(worker);
    // The OLD row stays archived history — exactly as it was.
    const oldProfile = await db
      .prepare("SELECT status, removed_at FROM supplier_profile WHERE id = ?")
      .bind(vendor.profileId)
      .first<{ status: string; removed_at: number | null }>();
    expect(oldProfile!.status).toBe("removed");
    expect(oldProfile!.removed_at).not.toBeNull();
    const oldListings = await db
      .prepare("SELECT status FROM supplier_listing WHERE supplier_profile_id = ?")
      .bind(vendor.profileId)
      .all<{ status: string }>();
    expect(oldListings.results).toHaveLength(2);
    for (const row of oldListings.results) {
      expect(row.status).toBe("archived"); // NOT restored — no permission revives
    }
    // The old archived listing is NOT publicly revived by the re-add.
    const detail = await apiGet(worker, null, `/api/market/listings/${vendor.publishedListingId}`);
    expect(detail.status).toBe(404);
    // The archived listing of the OLD application is still frozen for edits.
    const updateOld = await apiPost(
      worker,
      vendor.cookie,
      `/api/market/vendor/listings/${vendor.draftListingId}`,
      { title: "تحرير إعلان الأرشيف مرفوض" },
    );
    expect(updateOld.status).toBe(409);
    // The NEW application starts from the beginning: a new listing is possible.
    const createNew = await apiPost(worker, vendor.cookie, "/api/market/vendor/listings", {
      title: "إعلان الطلب الجديد بعد الإعادة",
      category: "packaging",
      governorate: "عمان",
      description: "وصف كافٍ للطول المطلوب في التحقق الخادمي للاختبار.",
      contactType: "phone",
      contactValue: "+962790100001",
      pricing: { mode: "fixed", priceMicroJod: "700000", basis: { units: "4", unit: "حبة" } },
      quantity: { unit: "حبة", minQuantityMilli: "4000", stepMilli: "4000", unpacked: true },
    });
    expect(createNew.status).toBe(201);
    const auditRow = await db
      .prepare(
        "SELECT COUNT(*) AS n FROM network_audit_event WHERE action = 'supplier_role_reapplied' AND result = 'success'",
      )
      .first<{ n: number }>();
    expect(Number(auditRow!.n)).toBe(1);
  });

  it("driver re-add: a fresh draft application; the old bookings keep «مستخدم سابق»; approval is the normal admin flow", async () => {
    const owner = await signInAs(worker, { sub: "rv-readd-owner", email: "rv-readd-owner@example.test" });
    const ownerWorkspaceId = await createWorkspace(worker, owner.cookieHeader, "مشروع إعادة السائق");
    const driver = await createApprovedDriver(refs, "drv-readd@example.test", "drv-readd");
    const bookingId = await setupExecutionPair(
      worker,
      owner.cookieHeader,
      driver.cookie,
      driver.driverProfileId,
      ownerWorkspaceId,
    );
    // Terminate the booking honestly, then remove the role (no ongoing booking).
    await apiPost(worker, driver.cookie, `/api/driver/requests/${bookingId}/cancel`, {
      reason: "إنهاء لإجراء اختبار الإضافة من جديد",
    });
    const remove = await apiPost(worker, driver.cookie, "/api/account/roles/driver/remove", {});
    expect(remove.status).toBe(200);
    // Re-apply through the normal save path: a NEW draft row (201, new id).
    const save = await apiPost(worker, driver.cookie, "/api/driver/profile", {
      displayName: "سائق عاد بطلب جديد",
      phone: "+962790000010",
      serviceAreas: ["عمان"],
    });
    expect(save.status).toBe(201);
    const saved = (await save.json()) as { driverProfileId: string; reapplied?: boolean };
    expect(saved.driverProfileId).not.toBe(driver.driverProfileId);
    expect(saved.reapplied).toBe(true);
    const db = await rawDb(worker);
    // The OLD profile stays archived history; the old booking keeps pointing at it.
    const oldProfile = await db
      .prepare("SELECT status FROM driver_profile WHERE id = ?")
      .bind(driver.driverProfileId)
      .first<{ status: string }>();
    expect(oldProfile!.status).toBe("removed");
    const oldVehicles = await db
      .prepare("SELECT COUNT(*) AS n FROM driver_vehicle WHERE driver_profile_id = ?")
      .bind(driver.driverProfileId)
      .first<{ n: number }>();
    expect(Number(oldVehicles!.n)).toBeGreaterThan(0); // preserved archived, never deleted
    // The requester's record of the old booking keeps the «مستخدم سابق» mask.
    const overview = (await (await apiGet(worker, owner.cookieHeader, "/api/delivery/overview")).json()) as {
      requests: { id: string; driverName: string | null }[];
    };
    const oldBooking = overview.requests.find(request => request.id === bookingId);
    expect(oldBooking?.driverName).toBe("مستخدم سابق");
    // The NEW application starts from the beginning: draft → submit needs its
    // own evidence; the admin approval is the normal flow (not a restoration).
    const newProfileStatus = await db
      .prepare("SELECT status FROM driver_profile WHERE id = ?")
      .bind(saved.driverProfileId)
      .first<{ status: string }>();
    expect(newProfileStatus!.status).toBe("draft");
    const submitTooEarly = await apiPost(worker, driver.cookie, "/api/driver/submit", {});
    expect(submitTooEarly.status).toBe(400); // identity+license of the NEW application required first
    const auditRow = await db
      .prepare(
        "SELECT COUNT(*) AS n FROM network_audit_event WHERE action = 'driver_role_reapplied' AND result = 'success'",
      )
      .first<{ n: number }>();
    expect(Number(auditRow!.n)).toBe(1);
  });
});

describe("G01 role lifecycle: driver removal — «لا يُزال دوره وعنده حجز جارٍ»", () => {
  it("an ONGOING booking blocks removal (the exact protection the decision states)", async () => {
    const owner = await signInAs(worker, { sub: "rv-owner1", email: "rv-owner1@example.test" });
    const ownerWorkspaceId = await createWorkspace(worker, owner.cookieHeader, "مشروع صاحب الحجز");
    const driver = await createApprovedDriver(refs, "drv-ongoing@example.test", "drv-ongoing");
    await setupExecutionPair(
      worker,
      owner.cookieHeader,
      driver.cookie,
      driver.driverProfileId,
      ownerWorkspaceId,
    );
    const remove = await apiPost(worker, driver.cookie, "/api/account/roles/driver/remove", {});
    expect(remove.status).toBe(409);
    const body = (await remove.json()) as { error: { details: { reason: string } } };
    expect(body.error.details.reason).toBe("ongoing_booking_present");
    const db = await rawDb(worker);
    const profile = await db
      .prepare("SELECT status FROM driver_profile WHERE id = ?")
      .bind(driver.driverProfileId)
      .first<{ status: string }>();
    expect(profile!.status).toBe("approved");
  });

  it("with NO ongoing booking the removal succeeds, the public surfaces hide him, and his own records stay", async () => {
    const owner = await signInAs(worker, { sub: "rv-owner2", email: "rv-owner2@example.test" });
    const ownerWorkspaceId = await createWorkspace(worker, owner.cookieHeader, "مشروع صاحب الحجز الثاني");
    const driver = await createApprovedDriver(refs, "drv-free@example.test", "drv-free");
    const bookingId = await setupExecutionPair(
      worker,
      owner.cookieHeader,
      driver.cookie,
      driver.driverProfileId,
      ownerWorkspaceId,
    );
    // Terminate the booking honestly (the driver cancels before pickup with
    // a written reason → 'cancelled', a terminal state — nothing «جارٍ»
    // remains; Q106 د-3).
    const cancel = await apiPost(worker, driver.cookie, `/api/driver/requests/${bookingId}/cancel`, {
      reason: "تعطلت المركبة قبل الاستلام — إنهاء الاختبار",
    });
    expect(cancel.status).toBe(200);
    const remove = await apiPost(worker, driver.cookie, "/api/account/roles/driver/remove", {});
    expect(remove.status).toBe(200);
    const db = await rawDb(worker);
    const profile = await db
      .prepare("SELECT status, removed_at FROM driver_profile WHERE id = ?")
      .bind(driver.driverProfileId)
      .first<{ status: string; removed_at: number | null }>();
    expect(profile!.status).toBe("removed");
    expect(profile!.removed_at).not.toBeNull();
    // The directory and the public profile no longer expose him.
    const directory = (await (await apiGet(worker, null, "/api/delivery/drivers")).json()) as {
      drivers: { driverProfileId: string }[];
    };
    expect(directory.drivers.find(d => d.driverProfileId === driver.driverProfileId)).toBeUndefined();
    const publicProfile = await apiGet(worker, null, `/api/delivery/drivers/${driver.driverProfileId}`);
    expect(publicProfile.status).toBe(404);
    // The booking ROW survives untouched (never deleted).
    const bookingRow = await db
      .prepare("SELECT status FROM delivery_request WHERE id = ?")
      .bind(bookingId)
      .first<{ status: string }>();
    expect(bookingRow!.status).toBe("cancelled");
    // His own portal still opens and reports the honest removed state.
    const portal = (await (await apiGet(worker, driver.cookie, "/api/driver/portal")).json()) as {
      driver: { status: string } | null;
    };
    expect(portal.driver?.status).toBe("removed");
    /* Owner supplement §10.1-1 (2026-11-22): a save after removal is now a
     * NEW application (a fresh draft row — proven in the re-add suite); here
     * we pin that it is NOT a restoration: the removed row keeps its state
     * and stays out of the public directory. */
    const save = await apiPost(worker, driver.cookie, "/api/driver/profile", {
      displayName: "سائق يحاول العودة",
      phone: "+962790300010",
      serviceAreas: ["عمان"],
    });
    expect(save.status).toBe(201);
    const oldRow = await db
      .prepare("SELECT status FROM driver_profile WHERE id = ?")
      .bind(driver.driverProfileId)
      .first<{ status: string }>();
    expect(oldRow!.status).toBe("removed"); // never restored by the re-application
    const directoryAfter = (await (await apiGet(worker, null, "/api/delivery/drivers")).json()) as {
      drivers: { driverProfileId: string }[];
    };
    expect(directoryAfter.drivers.find(d => d.driverProfileId === driver.driverProfileId)).toBeUndefined();
    // Audited.
    const auditRow = await db
      .prepare(
        "SELECT COUNT(*) AS n FROM network_audit_event WHERE action = 'driver_role_removed' AND result = 'success'",
      )
      .first<{ n: number }>();
    expect(Number(auditRow!.n)).toBe(1);
  });

  it("«مستخدم سابق»: the requester's records of a removed driver keep the mask; his own view keeps his name", async () => {
    const owner = await signInAs(worker, { sub: "rv-owner3", email: "rv-owner3@example.test" });
    const ownerWorkspaceId = await createWorkspace(worker, owner.cookieHeader, "مشروع مستخدم سابق");
    const driver = await createApprovedDriver(refs, "drv-former@example.test", "drv-former");
    const bookingId = await setupExecutionPair(
      worker,
      owner.cookieHeader,
      driver.cookie,
      driver.driverProfileId,
      ownerWorkspaceId,
    );
    await apiPost(worker, driver.cookie, `/api/driver/requests/${bookingId}/cancel`, {
      reason: "تعطلت المركبة قبل الاستلام — إنهاء اختبار القناع",
    });
    await apiPost(worker, driver.cookie, "/api/account/roles/driver/remove", {});
    // The requester's overview card: the former-user mask, not the name.
    const overview = (await (await apiGet(worker, owner.cookieHeader, "/api/delivery/overview")).json()) as {
      requests: { id: string; driverName: string | null }[];
    };
    const card = overview.requests.find(r => r.id === bookingId);
    expect(card?.driverName).toBe("مستخدم سابق");
    // The requester's detail view: masked name, no contact.
    const detail = (await (
      await apiGet(worker, owner.cookieHeader, `/api/delivery/requests/${bookingId}`)
    ).json()) as {
      driver: { profile: { displayName: string; phone?: string } };
    };
    expect(detail.driver.profile.displayName).toBe("مستخدم سابق");
    expect(detail.driver.profile.phone).toBeUndefined();
    // The removed driver's OWN view of the same record keeps his identity.
    const own = (await (
      await apiGet(worker, driver.cookie, `/api/delivery/requests/${bookingId}`)
    ).json()) as {
      driver: { profile: { displayName: string } };
    };
    expect(own.driver.profile.displayName).not.toBe("مستخدم سابق");
  });
});
