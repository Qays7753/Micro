/**
 * Market Wave 2 acceptance (Post-Group 6 continuation — final decisions
 * 2026-11-21 + the four approved continuation decisions §8):
 * - The supplier phone reveal: authenticated-only (no active-role gate — an
 *   account with NO role may reveal), server-side limit of 10 DISTINCT
 *   supplier numbers per account per UTC day, repeat reveals of the same
 *   supplier consume nothing, every reveal audited (§8-3 / د-1).
 * - Product variants (Q38): server-side cap 20, each option with its own
 *   price / minimum quantity / availability; the variant-aware effective
 *   minimum feeds the denormalized browse column.
 * - The hierarchical category tree (Q49/Q146): admin-managed via the
 *   settings allowlist, browse by MAIN expands to its subs, unknown category
 *   ids are refused.
 * - The final-decision filters (Q49/Q146): supplier type, delivery vs
 *   pickup-only, maximum minimum-quantity — plus the honest invalid-value 400s.
 * - Operational counts (Q154): the EXACT launch-threshold counting rule —
 *   a supplier counts only with a complete active profile + accepted terms +
 *   a published listing carrying the recorded first-listing verification
 *   call; an honest empty state returns zeros; never a threshold claim.
 * - Administrative suspension: a suspended supplier's listings leave the
 *   public browse immediately; unsuspend restores them.
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
let adminCookie: string;
let vendorCookie: string;
let vendorWorkspaceId: string;
let buyerCookie: string;
let noRoleCookie: string;

interface PublishedRefs {
  profileId: string;
  listingId: string;
}

async function activateVendor(cookie: string, workspaceId: string, phone: string): Promise<string> {
  const response = await apiPost(worker, cookie, "/api/market/vendor/profile", {
    displayName: "مورد الموجة الثانية",
    contactPhone: phone,
    governorate: "عمان",
    supplierType: "manufacturer",
    deliveryOption: "delivery",
    termsAccepted: true,
    workspaceId,
  });
  const body = (await response.json()) as { profile: { id: string; status: string } };
  expect(body.profile.status).toBe("active");
  return body.profile.id;
}

async function publishFirstListing(
  cookie: string,
  title: string,
  options: { category?: string; variants?: unknown[]; minQuantityMilli?: string } = {},
): Promise<PublishedRefs> {
  const profileId = await activateVendor(cookie, vendorWorkspaceId, "+962799000001");
  const created = await apiPost(worker, cookie, "/api/market/vendor/listings", {
    title,
    category: options.category ?? "packaging",
    governorate: "عمان",
    description: "وصف مادة كافٍ للطول المطلوب في اختبار الموجة الثانية.",
    contactType: "phone",
    contactValue: "+962799000001",
    pricing: { mode: "fixed", priceMicroJod: "1500000", basis: { units: "1", unit: "حبة" } },
    quantity: {
      unit: "حبة",
      minQuantityMilli: options.minQuantityMilli ?? "1000",
      stepMilli: "500",
      unpacked: true,
    },
    ...(options.variants !== undefined ? { variants: options.variants } : {}),
  });
  expect(created.status).toBe(201);
  const { listing } = (await created.json()) as { listing: { id: string } };
  await apiPost(worker, cookie, `/api/market/vendor/listings/${listing.id}/submit`, {});
  const approve = await apiPost(worker, adminCookie, `/api/market/review/listing/${listing.id}`, {
    action: "approve",
    verificationCall: { done: true, note: "اتصال تحقق موثق" },
  });
  expect(approve.status).toBe(200);
  return { profileId, listingId: listing.id };
}

async function reveal(cookie: string | null, listingId: string): Promise<Response> {
  return apiPost(worker, cookie, `/api/market/listings/${listingId}/reveal-phone`, {});
}

beforeAll(async () => {
  worker = await startWorker();
  adminCookie = (await signInAs(worker, { sub: "w2-admin", email: "w2-admin@example.test" })).cookieHeader;
  const db = await rawDb(worker);
  const adminIdentity = await db
    .prepare("SELECT id FROM network_identity WHERE email = ?")
    .bind("w2-admin@example.test")
    .first<{ id: string }>();
  await db
    .prepare(
      "INSERT INTO network_membership (identity_id, role, status, granted_by, granted_at) VALUES (?, 'admin', 'active', 'test', 1)",
    )
    .bind(adminIdentity!.id)
    .run();
  vendorCookie = (await signInAs(worker, { sub: "w2-vendor", email: "w2-vendor@example.test" })).cookieHeader;
  vendorWorkspaceId = await createWorkspace(worker, vendorCookie, "مشروع موجة ثانية");
  buyerCookie = (await signInAs(worker, { sub: "w2-buyer", email: "w2-buyer@example.test" })).cookieHeader;
  noRoleCookie = (await signInAs(worker, { sub: "w2-norole", email: "w2-norole@example.test" })).cookieHeader;
});

afterAll(async () => {
  await worker.close();
});

describe("Wave 2 د-1/§8-3: the audited supplier phone reveal", () => {
  let target: PublishedRefs;

  it("an anonymous visitor is refused (401) — the value is auth-gated, not just hidden", async () => {
    target = await publishFirstListing(vendorCookie, "مادة اختبار كشف الرقم");
    const guest = await reveal(null, target.listingId);
    expect(guest.status).toBe(401);
  });

  it("an authenticated account with NO active role may reveal (no active-role gate — §8-3)", async () => {
    const response = await reveal(noRoleCookie, target.listingId);
    expect(response.status).toBe(200);
    const body = (await response.json()) as { phone: string; channelType: string; remainingToday: number };
    expect(body.phone).toBe("+962799000001");
    expect(body.channelType).toBe("phone");
    expect(body.remainingToday).toBe(9);
  });

  it("a repeat reveal of the SAME supplier consumes no new distinct slot", async () => {
    const response = await reveal(noRoleCookie, target.listingId);
    expect(response.status).toBe(200);
    const body = (await response.json()) as { remainingToday: number };
    expect(body.remainingToday).toBe(9);
    const db = await rawDb(worker);
    const ledger = await db
      .prepare(
        "SELECT COUNT(*) AS n FROM market_phone_reveal WHERE identity_id = (SELECT id FROM network_identity WHERE email = ?)",
      )
      .bind("w2-norole@example.test")
      .first<{ n: number }>();
    expect(Number(ledger!.n)).toBe(1);
    const auditRow = await db
      .prepare(
        "SELECT COUNT(*) AS n FROM network_audit_event WHERE action = 'market_phone_reveal' AND actor_identity_id = (SELECT id FROM network_identity WHERE email = ?)",
      )
      .bind("w2-norole@example.test")
      .first<{ n: number }>();
    expect(Number(auditRow!.n)).toBe(2);
  });

  it("the 10-distinct-suppliers daily limit refuses the 11th with an honest 429", async () => {
    // Reveal suppliers 2..10 (the first slot is consumed by the vendor above).
    for (let index = 2; index <= 10; index += 1) {
      const vendorN = (await signInAs(worker, { sub: `w2-v${index}`, email: `w2-v${index}@example.test` }))
        .cookieHeader;
      const workspaceN = await createWorkspace(worker, vendorN, `مشروع مورّد ${index}`);
      const profileResponse = await apiPost(worker, vendorN, "/api/market/vendor/profile", {
        displayName: `مورد رقم ${index}`,
        contactPhone: `+9627990000${String(index).padStart(2, "0")}`,
        governorate: "عمان",
        supplierType: "shop",
        deliveryOption: "pickup_only",
        termsAccepted: true,
        workspaceId: workspaceN,
      });
      expect(profileResponse.status).toBe(201);
      const created = await apiPost(worker, vendorN, "/api/market/vendor/listings", {
        title: `مادة مورّد ${index} للكشف عن الرقم`,
        category: "paper",
        governorate: "عمان",
        description: "وصف مادة كافٍ للطول المطلوب في اختبار الموجة الثانية.",
        contactType: "phone",
        contactValue: `+9627990000${String(index).padStart(2, "0")}`,
        pricing: { mode: "fixed", priceMicroJod: "900000", basis: { units: "1", unit: "حبة" } },
        quantity: { unit: "حبة", minQuantityMilli: "1000", stepMilli: "500", unpacked: true },
      });
      const { listing } = (await created.json()) as { listing: { id: string } };
      await apiPost(worker, vendorN, `/api/market/vendor/listings/${listing.id}/submit`, {});
      await apiPost(worker, adminCookie, `/api/market/review/listing/${listing.id}`, {
        action: "approve",
        verificationCall: { done: true },
      });
      const revealN = await reveal(noRoleCookie, listing.id);
      expect(revealN.status).toBe(200);
    }
    // The 11th DISTINCT supplier is refused for the day (server window).
    const vendor11 = (await signInAs(worker, { sub: "w2-v11", email: "w2-v11@example.test" })).cookieHeader;
    const workspace11 = await createWorkspace(worker, vendor11, "مشروع مورّد 11");
    await apiPost(worker, vendor11, "/api/market/vendor/profile", {
      displayName: "مورد رقم 11",
      contactPhone: "+962799000011",
      governorate: "عمان",
      supplierType: "shop",
      deliveryOption: "pickup_only",
      termsAccepted: true,
      workspaceId: workspace11,
    });
    const created11 = await apiPost(worker, vendor11, "/api/market/vendor/listings", {
      title: "مادة مورّد 11 للكشف عن الرقم",
      category: "paper",
      governorate: "عمان",
      description: "وصف مادة كافٍ للطول المطلوب في اختبار الموجة الثانية.",
      contactType: "phone",
      contactValue: "+962799000011",
      pricing: { mode: "fixed", priceMicroJod: "900000", basis: { units: "1", unit: "حبة" } },
      quantity: { unit: "حبة", minQuantityMilli: "1000", stepMilli: "500", unpacked: true },
    });
    const listing11Id = ((await created11.json()) as { listing: { id: string } }).listing.id;
    await apiPost(worker, vendor11, `/api/market/vendor/listings/${listing11Id}/submit`, {});
    await apiPost(worker, adminCookie, `/api/market/review/listing/${listing11Id}`, {
      action: "approve",
      verificationCall: { done: true },
    });
    const refused = await reveal(noRoleCookie, listing11Id);
    expect(refused.status).toBe(429);
    const body = (await refused.json()) as { error: { details: { reason: string; limit: number } } };
    expect(body.error.details.reason).toBe("supplier_phone_reveal_daily_limit");
    expect(body.error.details.limit).toBe(10);
    // A DIFFERENT account starts with its own full budget.
    const fresh = await reveal(buyerCookie, listing11Id);
    expect(fresh.status).toBe(200);
  });

  it("a draft or unpublished listing has no reveal path (404)", async () => {
    const created = await apiPost(worker, vendorCookie, "/api/market/vendor/listings", {
      title: "مسودة بلا كشف رقم",
      category: "paper",
      governorate: "عمان",
      description: "وصف مادة كافٍ للطول المطلوب في اختبار الموجة الثانية.",
      contactType: "phone",
      contactValue: "+962799000001",
      pricing: { mode: "fixed", priceMicroJod: "900000", basis: { units: "1", unit: "حبة" } },
      quantity: { unit: "حبة", minQuantityMilli: "1000", stepMilli: "500", unpacked: true },
    });
    const { listing } = (await created.json()) as { listing: { id: string } };
    const response = await reveal(buyerCookie, listing.id);
    expect(response.status).toBe(404);
  });
});

describe("Wave 2 Q38: product variants (≤20, per-option price/min/availability)", () => {
  it("21 options are refused; a valid variant list publishes with its own prices", async () => {
    const tooMany = Array.from({ length: 21 }, (_, index) => ({
      id: `v${index}`,
      label: `خيار ${index + 1}`,
      priceMicroJod: "1000000",
      minQuantityMilli: "1000",
      availability: "available",
    }));
    const created = await apiPost(worker, vendorCookie, "/api/market/vendor/listings", {
      title: "مادة بخيارات كثيرة جدًا",
      category: "packaging",
      governorate: "عمان",
      description: "وصف مادة كافٍ للطول المطلوب في اختبار الموجة الثانية.",
      contactType: "phone",
      contactValue: "+962799000001",
      pricing: { mode: "fixed", priceMicroJod: "1500000", basis: { units: "1", unit: "حبة" } },
      quantity: { unit: "حبة", minQuantityMilli: "2000", stepMilli: "500", unpacked: true },
      variants: tooMany,
    });
    expect(created.status).toBe(400);

    const variants = [
      {
        id: "small",
        label: "حجم صغير",
        priceMicroJod: "1200000",
        minQuantityMilli: "500",
        availability: "available",
      },
      {
        id: "large",
        label: "حجم كبير",
        priceMicroJod: "2200000",
        minQuantityMilli: "1500",
        availability: "made_to_order",
      },
    ];
    const refs = await publishFirstListing(vendorCookie, "مادة بخيارات متعددة", { variants });
    const detail = (await (await apiGet(worker, null, `/api/market/listings/${refs.listingId}`)).json()) as {
      listing: {
        variants: {
          id: string;
          label: string;
          priceMicroJod: string;
          minQuantityMilli: string;
          availability: string;
        }[];
        minQuantityMilli: string;
      };
    };
    expect(detail.listing.variants).toHaveLength(2);
    expect(detail.listing.variants[0]!.priceMicroJod).toBe("1200000");
    expect(detail.listing.variants[1]!.availability).toBe("made_to_order");
    // The denormalized browse minimum is the SMALLEST option minimum (500).
    expect(detail.listing.minQuantityMilli).toBe("500");
    // Duplicate labels are refused.
    const dup = await apiPost(worker, vendorCookie, "/api/market/vendor/listings", {
      title: "مادة بخيارات مكررة",
      category: "packaging",
      governorate: "عمان",
      description: "وصف مادة كافٍ للطول المطلوب في اختبار الموجة الثانية.",
      contactType: "phone",
      contactValue: "+962799000001",
      pricing: { mode: "fixed", priceMicroJod: "1500000", basis: { units: "1", unit: "حبة" } },
      quantity: { unit: "حبة", minQuantityMilli: "1000", stepMilli: "500", unpacked: true },
      variants: [
        {
          id: "a",
          label: "خيار",
          priceMicroJod: "1000000",
          minQuantityMilli: "1000",
          availability: "available",
        },
        {
          id: "b",
          label: "خيار",
          priceMicroJod: "1100000",
          minQuantityMilli: "1000",
          availability: "available",
        },
      ],
    });
    expect(dup.status).toBe(400);
  });
});

describe("Wave 2 Q49/Q146: the hierarchical category tree + admin management", () => {
  it("the admin can update the tree through the settings allowlist; invalid trees are refused", async () => {
    const put = (value: unknown) =>
      worker.fetch("/api/admin/settings/market.categories", {
        method: "PUT",
        headers: {
          "content-type": "application/json",
          origin: worker.origin,
          "x-micro-api": "1",
          cookie: adminCookie,
        },
        body: JSON.stringify({ value }),
      });
    // Duplicate ids are refused.
    expect(
      (await put([{ id: "main-a", label: "رئيسي أ", sub: [{ id: "main-a", label: "فرعي مكرر" }] }])).status,
    ).toBe(400);
    // A valid custom tree replaces the default.
    const tree = [
      {
        id: "custom-main",
        label: "تصنيف مخصص",
        sub: [
          { id: "custom-sub-1", label: "فرعي أول" },
          { id: "custom-sub-2", label: "فرعي ثانٍ" },
        ],
      },
    ];
    expect((await put(tree)).status).toBe(200);
    const meta = (await (await apiGet(worker, null, "/api/market/meta")).json()) as {
      categories: { id: string; sub: { id: string }[] }[];
    };
    expect(meta.categories).toHaveLength(1);
    expect(meta.categories[0]!.sub).toHaveLength(2);
    // A listing under a SUB of the custom tree is creatable; an unknown id is refused.
    const created = await apiPost(worker, vendorCookie, "/api/market/vendor/listings", {
      title: "مادة بتصنيف فرعي مخصص",
      category: "custom-sub-1",
      governorate: "عمان",
      description: "وصف مادة كافٍ للطول المطلوب في اختبار الموجة الثانية.",
      contactType: "phone",
      contactValue: "+962799000001",
      pricing: { mode: "fixed", priceMicroJod: "1000000", basis: { units: "1", unit: "حبة" } },
      quantity: { unit: "حبة", minQuantityMilli: "1000", stepMilli: "500", unpacked: true },
    });
    expect(created.status).toBe(201);
    const unknown = await apiPost(worker, vendorCookie, "/api/market/vendor/listings", {
      title: "مادة بتصنيف مجهول",
      category: "does-not-exist",
      governorate: "عمان",
      description: "وصف مادة كافٍ للطول المطلوب في اختبار الموجة الثانية.",
      contactType: "phone",
      contactValue: "+962799000001",
      pricing: { mode: "fixed", priceMicroJod: "1000000", basis: { units: "1", unit: "حبة" } },
      quantity: { unit: "حبة", minQuantityMilli: "1000", stepMilli: "500", unpacked: true },
    });
    expect(unknown.status).toBe(400);
  });

  it("browse by a MAIN category matches the main id AND every sub under it", async () => {
    // Restore the default tree, then publish one main-level and one sub-level listing.
    const restore = await worker.fetch("/api/admin/settings/market.categories", {
      method: "PUT",
      headers: {
        "content-type": "application/json",
        origin: worker.origin,
        "x-micro-api": "1",
        cookie: adminCookie,
      },
      body: JSON.stringify({
        value: [
          {
            id: "packaging",
            label: "التغليف",
            sub: [
              { id: "packaging-cups", label: "أكواب وأوعية" },
              { id: "packaging-bags", label: "أكياس وشرنك" },
            ],
          },
          { id: "paper", label: "الورق", sub: [] },
        ],
      }),
    });
    expect(restore.status).toBe(200);
    const mainLevel = await publishFirstListing(vendorCookie, "مادة بمستوى رئيسي", { category: "packaging" });
    const subLevel = await publishFirstListing(vendorCookie, "مادة بمستوى فرعي", {
      category: "packaging-cups",
    });
    const mainLevelId = mainLevel.listingId;
    const subLevelId = subLevel.listingId;
    const browseMain = (await (
      await apiGet(worker, null, "/api/market/listings?category=packaging")
    ).json()) as { listings: { id: string }[] };
    const ids = browseMain.listings.map(entry => entry.id);
    expect(ids).toContain(mainLevelId);
    expect(ids).toContain(subLevelId);
    const browseSub = (await (
      await apiGet(worker, null, "/api/market/listings?category=packaging-cups")
    ).json()) as { listings: { id: string }[] };
    const subIds = browseSub.listings.map(entry => entry.id);
    expect(subIds).toContain(subLevelId);
    expect(subIds).not.toContain(mainLevelId);
  });
});

describe("Wave 2 Q49/Q146: the final-decision browse filters", () => {
  it("supplierType / delivery / maxMinQuantityMilli filter the results; invalid values are 400", async () => {
    const manufacturerListing = await publishFirstListing(vendorCookie, "مادة مصنّع للتصفية");
    const shopVendor = (await signInAs(worker, { sub: "w2-shop", email: "w2-shop@example.test" }))
      .cookieHeader;
    const shopWorkspace = await createWorkspace(worker, shopVendor, "مشروع محل");
    await apiPost(worker, shopVendor, "/api/market/vendor/profile", {
      displayName: "محل التجزئة",
      contactPhone: "+962799000099",
      governorate: "إربد",
      supplierType: "shop",
      deliveryOption: "pickup_only",
      termsAccepted: true,
      workspaceId: shopWorkspace,
    });
    const shopListing = await apiPost(worker, shopVendor, "/api/market/vendor/listings", {
      title: "مادة محل للاستلام فقط",
      category: "paper",
      governorate: "إربد",
      description: "وصف مادة كافٍ للطول المطلوب في اختبار الموجة الثانية.",
      contactType: "phone",
      contactValue: "+962799000099",
      pricing: { mode: "fixed", priceMicroJod: "700000", basis: { units: "1", unit: "حبة" } },
      quantity: { unit: "حبة", minQuantityMilli: "5000", stepMilli: "500", unpacked: true },
    });
    const shopListingId = ((await shopListing.json()) as { listing: { id: string } }).listing.id;
    await apiPost(worker, shopVendor, `/api/market/vendor/listings/${shopListingId}/submit`, {});
    await apiPost(worker, adminCookie, `/api/market/review/listing/${shopListingId}`, {
      action: "approve",
      verificationCall: { done: true },
    });

    const byType = (await (await apiGet(worker, null, "/api/market/listings?supplierType=shop")).json()) as {
      listings: { id: string }[];
    };
    expect(byType.listings.map(entry => entry.id)).toContain(shopListingId);
    expect(byType.listings.map(entry => entry.id)).not.toContain(manufacturerListing.listingId);

    const byDelivery = (await (
      await apiGet(worker, null, "/api/market/listings?delivery=pickup_only")
    ).json()) as { listings: { id: string }[] };
    expect(byDelivery.listings.map(entry => entry.id)).toContain(shopListingId);
    expect(byDelivery.listings.map(entry => entry.id)).not.toContain(manufacturerListing.listingId);

    const byMin = (await (
      await apiGet(worker, null, "/api/market/listings?maxMinQuantityMilli=1000")
    ).json()) as { listings: { id: string }[] };
    expect(byMin.listings.map(entry => entry.id)).toContain(manufacturerListing.listingId);
    expect(byMin.listings.map(entry => entry.id)).not.toContain(shopListingId);

    expect((await apiGet(worker, null, "/api/market/listings?supplierType=factory")).status).toBe(400);
    expect((await apiGet(worker, null, "/api/market/listings?delivery=drone")).status).toBe(400);
    expect((await apiGet(worker, null, "/api/market/listings?maxMinQuantityMilli=abc")).status).toBe(400);
  });
});

describe("Wave 2 Q154: operational counts and the launch-threshold counting rule", () => {
  it("counts only suppliers with the complete chain; an honest empty state; non-admin refused", async () => {
    expect((await apiGet(worker, buyerCookie, "/api/market/admin/ops-counts")).status).toBe(403);
    const counts = (await (await apiGet(worker, adminCookie, "/api/market/admin/ops-counts")).json()) as {
      activeSuppliers: number;
      activeDrivers: number;
      weeklyBookings: number;
      launchThreshold: { suppliers: number; drivers: number; governorates: number };
    };
    // Every published supplier so far in this file went through the full chain
    // (active + terms + published listing + verification call).
    expect(counts.activeSuppliers).toBeGreaterThanOrEqual(2);
    expect(counts.activeDrivers).toBe(0);
    expect(counts.weeklyBookings).toBe(0);
    expect(counts.launchThreshold).toEqual({ suppliers: 10, drivers: 5, governorates: 12 });

    // A supplier with NO published listing yet does NOT count, even though
    // their profile is active with accepted terms.
    const pendingVendor = (await signInAs(worker, { sub: "w2-pending", email: "w2-pending@example.test" }))
      .cookieHeader;
    const pendingWorkspace = await createWorkspace(worker, pendingVendor, "مشروع بلا إعلان منشور");
    const pendingProfile = await apiPost(worker, pendingVendor, "/api/market/vendor/profile", {
      displayName: "مورد بلا إعلان منشور",
      contactPhone: "+962799000098",
      governorate: "عمان",
      supplierType: "manufacturer",
      deliveryOption: "delivery",
      termsAccepted: true,
      workspaceId: pendingWorkspace,
    });
    expect(pendingProfile.status).toBe(201);
    const after = (await (await apiGet(worker, adminCookie, "/api/market/admin/ops-counts")).json()) as {
      activeSuppliers: number;
    };
    expect(after.activeSuppliers).toBe(counts.activeSuppliers);
  });
});

describe("Wave 2 Q129: administrative supplier suspension", () => {
  it("a suspended supplier leaves the public browse; unsuspend restores", async () => {
    const refs = await publishFirstListing(vendorCookie, "مادة قبل الإيقاف");
    expect((await apiGet(worker, null, `/api/market/listings/${refs.listingId}`)).status).toBe(200);
    const suspend = await apiPost(worker, adminCookie, `/api/market/review/profile/${refs.profileId}`, {
      action: "suspend",
      reason: "إيقاف إداري للاختبار",
    });
    expect(suspend.status).toBe(200);
    expect((await apiGet(worker, null, `/api/market/listings/${refs.listingId}`)).status).toBe(404);
    const browse = (await (await apiGet(worker, null, "/api/market/listings")).json()) as {
      listings: { id: string }[];
    };
    expect(browse.listings.map(entry => entry.id)).not.toContain(refs.listingId);
    const unsuspend = await apiPost(worker, adminCookie, `/api/market/review/profile/${refs.profileId}`, {
      action: "unsuspend",
    });
    expect(unsuspend.status).toBe(200);
    expect((await apiGet(worker, null, `/api/market/listings/${refs.listingId}`)).status).toBe(200);
  });
});
