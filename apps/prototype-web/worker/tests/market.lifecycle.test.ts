/**
 * Market acceptance — full listing lifecycle with the atomic publication
 * gate (OD-09/OD-16): vendor draft → submit → review (content approved
 * awaiting file) → profile approval publishes; content revision keeps the
 * old public copy; direct numeric updates are logged; freshness 30/60 with
 * review-based renewal (OD-11); cross-vendor isolation; guest boundaries.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { apiGet, apiPost, rawDb, signInAs, startWorker, type WorkerInstance } from "./harness.ts";

let worker: WorkerInstance;
let adminCookie: string;
let vendorCookie: string;
let otherVendorCookie: string;
let plainUserCookie: string;

const DAY = 24 * 60 * 60 * 1000;

interface ListingRefs {
  profileId: string;
  listingId: string;
  mediaId: string;
}

async function becomeAdmin(cookie: string, email: string): Promise<void> {
  const db = await rawDb(worker);
  const identity = await db
    .prepare("SELECT id FROM network_identity WHERE email = ?")
    .bind(email)
    .first<{ id: string }>();
  await db
    .prepare(
      "INSERT INTO network_membership (identity_id, role, status, granted_by, granted_at) VALUES (?, 'admin', 'active', 'test', ?) ON CONFLICT(identity_id, role) DO UPDATE SET status='active'",
    )
    .bind(identity!.id, Date.now())
    .run();
  void cookie;
}

async function createVendorListing(listingTitle: string): Promise<ListingRefs> {
  const profileResponse = await apiPost(worker, vendorCookie, "/api/market/vendor/profile", {
    displayName: "مورد الاختبار",
    contactPhone: "+962790000001",
    governorate: "عمان",
  });
  const profile = (await profileResponse.json()) as { profile: { id: string } };
  const mediaResponse = await worker.fetch("/api/media?purpose=market_listing_media", {
    method: "POST",
    headers: { "content-type": "image/png", origin: worker.origin, "x-micro-api": "1", cookie: vendorCookie },
    body: new Uint8Array([1, 2, 3, 4, 5]),
  });
  const media = (await mediaResponse.json()) as { media: { id: string } };
  const listingResponse = await apiPost(worker, vendorCookie, "/api/market/vendor/listings", {
    title: listingTitle,
    category: "packaging",
    governorate: "عمان",
    description: "وصف مادة تغليف للاختبار مع تفاصيل كافية للنشر.",
    contactType: "phone",
    contactValue: "+962790000001",
    pricing: { mode: "fixed", priceMicroJod: "1500000", basis: { units: "12", unit: "حبة" } },
    quantity: { unit: "حبة", minQuantityMilli: "24000", stepMilli: "12000", unpacked: true },
  });
  const listing = (await listingResponse.json()) as { listing: { id: string } };
  await apiPost(worker, vendorCookie, `/api/market/vendor/listings/${listing.listing.id}/media`, {
    mediaId: media.media.id,
    kind: "cover",
  });
  return { profileId: profile.profile.id, listingId: listing.listing.id, mediaId: media.media.id };
}

beforeAll(async () => {
  worker = await startWorker();
  adminCookie = (await signInAs(worker, { sub: "mk-admin", email: "mk-admin@example.test" })).cookieHeader;
  await becomeAdmin(adminCookie, "mk-admin@example.test");
  vendorCookie = (await signInAs(worker, { sub: "mk-vendor", email: "mk-vendor@example.test" })).cookieHeader;
  otherVendorCookie = (await signInAs(worker, { sub: "mk-other", email: "mk-other@example.test" }))
    .cookieHeader;
  plainUserCookie = (await signInAs(worker, { sub: "mk-user", email: "mk-user@example.test" })).cookieHeader;
});

afterAll(async () => {
  await worker.close();
});

describe("market: guest boundaries (S-01/S-03/OD-04)", () => {
  it("guest browse sees only published listings with an honest empty state", async () => {
    const response = await apiGet(worker, null, "/api/market/listings");
    expect(response.status).toBe(200);
    const body = (await response.json()) as { listings: unknown[]; count: number };
    expect(body.count).toBe(0);
    expect(body.listings).toEqual([]);
  });

  it("guest cannot access vendor workspace or any mutation", async () => {
    const overview = await apiGet(worker, null, "/api/market/vendor/overview");
    expect(overview.status).toBe(401);
    const create = await apiPost(worker, null, "/api/market/vendor/listings", {});
    expect(create.status).toBe(401);
  });

  it("meta exposes categories and the 12 governorates", async () => {
    const response = await apiGet(worker, null, "/api/market/meta");
    const body = (await response.json()) as { categories: unknown[]; governorates: string[] };
    expect(body.categories.length).toBeGreaterThanOrEqual(6);
    expect(body.governorates).toHaveLength(12);
  });
});

describe("market: lifecycle and the atomic publication gate (OD-09/OD-16)", () => {
  let refs: ListingRefs;

  it("drafts and submissions stay private (S-07)", async () => {
    refs = await createVendorListing("أكواب تغليف شفافة 12 حبة");
    const detail = await apiGet(worker, null, `/api/market/listings/${refs.listingId}`);
    expect(detail.status).toBe(404);
    await apiPost(worker, vendorCookie, `/api/market/vendor/listings/${refs.listingId}/submit`, {});
    const stillHidden = await apiGet(worker, null, `/api/market/listings/${refs.listingId}`);
    expect(stillHidden.status).toBe(404);
  });

  it("approving listing content with a pending file does NOT publish (spec §7.4)", async () => {
    const approve = await apiPost(worker, adminCookie, `/api/market/review/listing/${refs.listingId}`, {
      action: "approve",
    });
    expect(approve.status).toBe(200);
    const db = await rawDb(worker);
    const row = await db
      .prepare("SELECT status, revision_status FROM supplier_listing WHERE id = ?")
      .bind(refs.listingId)
      .first<{ status: string; revision_status: string }>();
    expect(row!.status).toBe("submitted");
    expect(row!.revision_status).toBe("content_approved");
    const browse = (await (await apiGet(worker, null, "/api/market/listings")).json()) as { count: number };
    expect(browse.count).toBe(0);
  });

  it("approving the file publishes atomically once media is also approved", async () => {
    await apiPost(worker, adminCookie, `/api/market/review/media/${refs.mediaId}`, { action: "approve" });
    // Media approval alone does not publish (content is approved, file is not).
    let browse = (await (await apiGet(worker, null, "/api/market/listings")).json()) as { count: number };
    expect(browse.count).toBe(0);
    await apiPost(worker, adminCookie, `/api/market/review/profile/${refs.profileId}`, { action: "approve" });
    browse = (await (await apiGet(worker, null, "/api/market/listings")).json()) as { count: number };
    expect(browse.count).toBe(1);
  });

  it("the published copy is public with its contact channel (OD-04)", async () => {
    const detailResponse = await apiGet(worker, null, `/api/market/listings/${refs.listingId}`);
    expect(detailResponse.status).toBe(200);
    const detail = (await detailResponse.json()) as {
      listing: { title: string; priceMicroJod: string; contactChannel: { type: string } };
      mediaIds: string[];
      vendor: { displayName: string };
    };
    expect(detail.listing.title).toContain("أكواب");
    expect(detail.listing.priceMicroJod).toBe("1500000");
    expect(detail.listing.contactChannel.type).toBe("phone");
    expect(detail.mediaIds).toHaveLength(1);
    expect(detail.vendor.displayName).toBe("مورد الاختبار");
  });

  it("a content revision keeps the OLD public copy visible until approved (OD-09)", async () => {
    await apiPost(worker, vendorCookie, `/api/market/vendor/listings/${refs.listingId}`, {
      title: "أكواب تغليف معاد تصميمها",
    });
    await apiPost(worker, vendorCookie, `/api/market/vendor/listings/${refs.listingId}/submit`, {});
    const detail = (await (await apiGet(worker, null, `/api/market/listings/${refs.listingId}`)).json()) as {
      listing: { title: string };
    };
    expect(detail.listing.title).toContain("شفافة");
    await apiPost(worker, adminCookie, `/api/market/review/listing/${refs.listingId}`, { action: "approve" });
    const updated = (await (await apiGet(worker, null, `/api/market/listings/${refs.listingId}`)).json()) as {
      listing: { title: string };
    };
    expect(updated.listing.title).toContain("معاد تصميمها");
  });

  it("direct availability confirmation is logged and resets freshness (OD-09/OD-11)", async () => {
    const confirm = await apiPost(
      worker,
      vendorCookie,
      `/api/market/vendor/listings/${refs.listingId}/confirm-availability`,
      {},
    );
    expect(confirm.status).toBe(200);
    const db = await rawDb(worker);
    const events = await db
      .prepare(
        "SELECT COUNT(*) AS n FROM market_moderation_event WHERE object_id = ? AND action = 'direct_availability_confirmation'",
      )
      .bind(refs.listingId)
      .first<{ n: number }>();
    expect(events!.n).toBe(1);
  });

  it("OD-09 direct numeric updates apply with verification + a logged event; content does not", async () => {
    // Only numeric price/availability fields go through direct-update.
    const direct = await apiPost(
      worker,
      vendorCookie,
      `/api/market/vendor/listings/${refs.listingId}/direct-update`,
      { priceMicroJod: "1800000", availabilityStatus: "available" },
    );
    expect(direct.status).toBe(200);
    const detail = (await (await apiGet(worker, null, `/api/market/listings/${refs.listingId}`)).json()) as {
      listing: { priceMicroJod: string };
    };
    expect(detail.listing.priceMicroJod).toBe("1800000");
    const db = await rawDb(worker);
    const row = await db
      .prepare("SELECT freshness_state FROM supplier_listing WHERE id = ?")
      .bind(refs.listingId)
      .first<{ freshness_state: string }>();
    expect(row!.freshness_state).toBe("fresh"); // availability re-anchors freshness (OD-11)
    const events = await db
      .prepare("SELECT reason FROM market_moderation_event WHERE object_id = ? AND action = 'direct_update'")
      .bind(refs.listingId)
      .all<{ reason: string }>();
    expect(events.results).toHaveLength(1);
    expect(events.results[0]!.reason).toContain("availabilityStatus");
    expect(events.results[0]!.reason).toContain("priceMicroJod");
    // Content fields are never direct-updateable — they go through review.
    const contentAttempt = await apiPost(
      worker,
      vendorCookie,
      `/api/market/vendor/listings/${refs.listingId}/direct-update`,
      { title: "عنوان مباشر بلا مراجعة" },
    );
    expect(contentAttempt.status).toBe(400);
    // Another vendor's listing is invisible (cross-vendor isolation).
    const foreign = await apiPost(
      worker,
      otherVendorCookie,
      `/api/market/vendor/listings/${refs.listingId}/direct-update`,
      { priceMicroJod: "1000000" },
    );
    expect(foreign.status).toBe(404);
    // A non-published listing cannot take direct updates.
    const draftRefs = await createVendorListing("مسودة لا تقبل التحديث المباشر");
    const draftAttempt = await apiPost(
      worker,
      vendorCookie,
      `/api/market/vendor/listings/${draftRefs.listingId}/direct-update`,
      { priceMicroJod: "900000" },
    );
    expect(draftAttempt.status).toBe(409);
  });
});

describe("market: cross-vendor isolation and admin boundaries", () => {
  it("another vendor cannot edit, submit, or attach to my listing", async () => {
    const refs = await createVendorListing("مادة خاصة بمورد آخر");
    const edit = await apiPost(worker, otherVendorCookie, `/api/market/vendor/listings/${refs.listingId}`, {
      title: "سرقة عنوان جديدة تمامًا",
    });
    expect(edit.status).toBe(404);
    const submit = await apiPost(
      worker,
      otherVendorCookie,
      `/api/market/vendor/listings/${refs.listingId}/submit`,
      {},
    );
    expect(submit.status).toBe(404);
    const overview = (await (
      await apiGet(worker, otherVendorCookie, "/api/market/vendor/overview")
    ).json()) as {
      listings: { id: string }[];
    };
    expect(overview.listings.map(listing => listing.id)).not.toContain(refs.listingId);
  });

  it("non-admin users cannot review", async () => {
    const queue = await apiGet(worker, plainUserCookie, "/api/market/review/queue");
    expect(queue.status).toBe(403);
  });

  it("reports never auto-mutate the listing (contract 22 §2)", async () => {
    const browse = (await (await apiGet(worker, null, "/api/market/listings")).json()) as {
      listings: { id: string }[];
    };
    const target = browse.listings[0]!.id;
    const report = await apiPost(worker, plainUserCookie, "/api/market/report", {
      listingId: target,
      reason: "misleading",
    });
    expect(report.status).toBe(201);
    const detail = await apiGet(worker, null, `/api/market/listings/${target}`);
    expect(detail.status).toBe(200);
  });

  it("MarketPrice validation rejects wrong scales and shapes (contract 25)", async () => {
    await apiPost(worker, vendorCookie, "/api/market/vendor/profile", {
      displayName: "مورد القيم",
      contactPhone: "+962790000002",
      governorate: "إربد",
    });
    const bad = await apiPost(worker, vendorCookie, "/api/market/vendor/listings", {
      title: "قيمة سعرية خاطئة تمامًا",
      category: "paper",
      governorate: "إربد",
      description: "وصف طويل بما يكفي لاجتياز حد الوصف الأدنى المطلوب.",
      contactType: "phone",
      contactValue: "+962790000002",
      pricing: { mode: "fixed", priceMicroJod: "12.5", basis: { units: "1", unit: "حبة" } },
      quantity: { unit: "حبة", minQuantityMilli: "1000", stepMilli: "1000", unpacked: true },
    });
    expect(bad.status).toBe(400);
    const tiers = await apiPost(worker, vendorCookie, "/api/market/vendor/listings", {
      title: "شرائح غير صالحة للسعر",
      category: "paper",
      governorate: "إربد",
      description: "وصف طويل بما يكفي لاجتياز حد الوصف الأدنى المطلوب.",
      contactType: "phone",
      contactValue: "+962790000002",
      pricing: {
        mode: "tiered",
        tiers: [
          { minQuantityMilli: "5000", priceMicroJod: "2000000" },
          { minQuantityMilli: "10000", priceMicroJod: "3000000" },
        ],
      },
      quantity: { unit: "حبة", minQuantityMilli: "5000", stepMilli: "1000", unpacked: true },
    });
    expect(tiers.status).toBe(400);
  });
});

describe("market: freshness 30/60 with review renewal (OD-11)", () => {
  it("after 30 days the listing asks for confirmation; after 60 it hides; renewal restores through review", async () => {
    const refs = await createVendorListing("مادة تجربة الحداثة الكاملة");
    await apiPost(worker, vendorCookie, `/api/market/vendor/listings/${refs.listingId}/submit`, {});
    await apiPost(worker, adminCookie, `/api/market/review/listing/${refs.listingId}`, { action: "approve" });
    await apiPost(worker, adminCookie, `/api/market/review/media/${refs.mediaId}`, { action: "approve" });
    await apiPost(worker, adminCookie, `/api/market/review/profile/${refs.profileId}`, { action: "approve" });
    const db = await rawDb(worker);
    const now = Date.now();

    // 35 days: needs confirmation, still visible.
    await db
      .prepare("UPDATE supplier_listing SET availability_confirmed_at = ? WHERE id = ?")
      .bind(now - 35 * DAY, refs.listingId)
      .run();
    let browse = (await (await apiGet(worker, null, "/api/market/listings")).json()) as {
      listings: { id: string; freshness: string }[];
    };
    let entry = browse.listings.find(item => item.id === refs.listingId);
    expect(entry?.freshness).toBe("needs_confirmation");
    expect(entry).toBeDefined();

    // Direct confirmation still works at 35 days.
    const confirm = await apiPost(
      worker,
      vendorCookie,
      `/api/market/vendor/listings/${refs.listingId}/confirm-availability`,
      {},
    );
    expect(confirm.status).toBe(200);

    // 65 days: hidden from search entirely.
    await db
      .prepare("UPDATE supplier_listing SET availability_confirmed_at = ? WHERE id = ?")
      .bind(now - 65 * DAY, refs.listingId)
      .run();
    browse = (await (await apiGet(worker, null, "/api/market/listings")).json()) as {
      listings: { id: string; freshness: string }[];
    };
    expect(browse.listings.find(item => item.id === refs.listingId)).toBeUndefined();

    // Direct confirmation is closed after hiding — renewal goes through review.
    const blockedConfirm = await apiPost(
      worker,
      vendorCookie,
      `/api/market/vendor/listings/${refs.listingId}/confirm-availability`,
      {},
    );
    expect(blockedConfirm.status).toBe(409);
    const body = (await blockedConfirm.json()) as { error: { details: { reason: string } } };
    expect(body.error.details.reason).toBe("renewal_requires_review");

    // Vendor requests renewal; admin approves; the listing is public again and
    // the original publish date is preserved (renewal is not a re-listing).
    const publishedBefore = await db
      .prepare("SELECT published_at FROM supplier_listing WHERE id = ?")
      .bind(refs.listingId)
      .first<{ published_at: number }>();
    await apiPost(worker, vendorCookie, `/api/market/vendor/listings/${refs.listingId}/submit`, {});
    await apiPost(worker, adminCookie, `/api/market/review/listing/${refs.listingId}`, { action: "approve" });
    browse = (await (await apiGet(worker, null, "/api/market/listings")).json()) as {
      listings: { id: string; freshness: string }[];
    };
    entry = browse.listings.find(item => item.id === refs.listingId);
    expect(entry?.freshness).toBe("fresh");
    const publishedAfter = await db
      .prepare("SELECT published_at FROM supplier_listing WHERE id = ?")
      .bind(refs.listingId)
      .first<{ published_at: number }>();
    expect(publishedAfter!.published_at).toBe(publishedBefore!.published_at);
  });
});
