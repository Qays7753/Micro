/**
 * Market OD-09 direct updates beyond the fixed price (continuation 2026-11-12
 * — §17 audit follow-up, contract 20 §3.3): the tiered price list and the
 * declared quantity figures (minimum + step) are direct within the SAME
 * pricing mode with full validation, ownership, an audit moderation event,
 * and coherent work/public copies — while the pricing MODE, unit, content,
 * category, and contact channel stay in review.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { apiGet, apiPost, rawDb, signInAs, startWorker, type WorkerInstance } from "./harness.ts";

let worker: WorkerInstance;
let adminCookie: string;
let vendorCookie: string;
let otherVendorCookie: string;

async function publish(title: string, pricing: Record<string, unknown>): Promise<string> {
  const media = await worker.fetch("/api/media?purpose=market_listing_media", {
    method: "POST",
    headers: { "content-type": "image/png", origin: worker.origin, "x-micro-api": "1", cookie: vendorCookie },
    body: new Uint8Array([7, 7, 7]),
  });
  const mediaBody = (await media.json()) as { media: { id: string } };
  const created = await apiPost(worker, vendorCookie, "/api/market/vendor/listings", {
    title,
    category: "fabric",
    governorate: "إربد",
    description: "وصف مادة قماش كافٍ للطول المطلوب هنا لأجل الاختبار.",
    contactType: "whatsapp",
    contactValue: "+962790000002",
    pricing,
    quantity: { unit: "متر", minQuantityMilli: "5000", stepMilli: "1000", unpacked: true },
  });
  const { listing } = (await created.json()) as { listing: { id: string } };
  await apiPost(worker, vendorCookie, `/api/market/vendor/listings/${listing.id}/media`, {
    mediaId: mediaBody.media.id,
    kind: "gallery",
  });
  await apiPost(worker, vendorCookie, `/api/market/vendor/listings/${listing.id}/submit`, {});
  await apiPost(worker, adminCookie, `/api/market/review/listing/${listing.id}`, { action: "approve" });
  await apiPost(worker, adminCookie, `/api/market/review/media/${mediaBody.media.id}`, { action: "approve" });
  return listing.id;
}

beforeAll(async () => {
  worker = await startWorker();
  adminCookie = (await signInAs(worker, { sub: "du-admin", email: "du-admin@example.test" })).cookieHeader;
  const db = await rawDb(worker);
  const adminIdentity = await db
    .prepare("SELECT id FROM network_identity WHERE email = ?")
    .bind("du-admin@example.test")
    .first<{ id: string }>();
  await db
    .prepare(
      "INSERT INTO network_membership (identity_id, role, status, granted_by, granted_at) VALUES (?, 'admin', 'active', 'test', 1)",
    )
    .bind(adminIdentity!.id)
    .run();
  vendorCookie = (await signInAs(worker, { sub: "du-vendor", email: "du-vendor@example.test" })).cookieHeader;
  otherVendorCookie = (await signInAs(worker, { sub: "du-other", email: "du-other@example.test" }))
    .cookieHeader;
  const profileResponse = await apiPost(worker, vendorCookie, "/api/market/vendor/profile", {
    displayName: "مورد التحديث المباشر",
    contactPhone: "+962790000002",
    governorate: "إربد",
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

async function listingRow(listingId: string) {
  const db = await rawDb(worker);
  return db
    .prepare(
      "SELECT price_mode, price_micro_jod, price_basis_json, min_quantity_milli, quantity_step_milli, work_copy_json, public_copy_json FROM supplier_listing WHERE id = ?",
    )
    .bind(listingId)
    .first<{
      price_mode: string;
      price_micro_jod: string | null;
      price_basis_json: string | null;
      min_quantity_milli: string;
      quantity_step_milli: string;
      work_copy_json: string;
      public_copy_json: string | null;
    }>();
}

/** The worker error body nests reasons under `error.details`. */
async function reasonOf(response: Response): Promise<string | undefined> {
  const body = (await response.json()) as { error?: { details?: { reason?: string } } };
  return body.error?.details?.reason;
}

describe("tiered direct price updates (OD-09 — same pricing mode)", () => {
  it("updates the full validated tier list; columns and copies stay coherent", async () => {
    const listingId = await publish("قماش متدرج", {
      mode: "tiered",
      tiers: [
        { minQuantityMilli: "5000", priceMicroJod: "2000000" },
        { minQuantityMilli: "20000", priceMicroJod: "1800000" },
      ],
    });
    const response = await apiPost(
      worker,
      vendorCookie,
      `/api/market/vendor/listings/${listingId}/direct-update`,
      {
        tiers: [
          { minQuantityMilli: "5000", priceMicroJod: "1900000" },
          { minQuantityMilli: "20000", priceMicroJod: "1700000" },
        ],
      },
    );
    expect(response.status).toBe(200);
    const row = await listingRow(listingId);
    const tiers = JSON.parse(row!.price_basis_json ?? "[]") as {
      minQuantityMilli: string;
      priceMicroJod: string;
    }[];
    expect(tiers).toEqual([
      { minQuantityMilli: "5000", priceMicroJod: "1900000" },
      { minQuantityMilli: "20000", priceMicroJod: "1700000" },
    ]);
    const work = JSON.parse(row!.work_copy_json) as { pricing: { tiers?: unknown } };
    const publicCopy = JSON.parse(row!.public_copy_json ?? "{}") as { pricing: { tiers?: unknown } };
    expect(work.pricing.tiers).toEqual(tiers);
    expect(publicCopy.pricing.tiers).toEqual(tiers);
    // The public detail now shows the updated tiers through the columns.
    const detail = (await (await apiGet(worker, null, `/api/market/listings/${listingId}`)).json()) as {
      listing: { priceBasis: unknown };
    };
    expect(detail.listing.priceBasis).toEqual(tiers);
    // The moderation event logs the exact fields.
    const db = await rawDb(worker);
    const logged = await db
      .prepare(
        "SELECT reason FROM market_moderation_event WHERE object_id = ? AND action = 'direct_update' ORDER BY created_at DESC LIMIT 1",
      )
      .bind(listingId)
      .first<{ reason: string }>();
    expect(logged!.reason).toContain("tiers");
  });

  it("invalid tier lists are refused with the domain rule reason", async () => {
    const listingId = await publish("قماش متدرج ثانٍ", {
      mode: "tiered",
      tiers: [{ minQuantityMilli: "5000", priceMicroJod: "2000000" }],
    });
    const overlapping = await apiPost(
      worker,
      vendorCookie,
      `/api/market/vendor/listings/${listingId}/direct-update`,
      {
        tiers: [
          { minQuantityMilli: "5000", priceMicroJod: "2000000" },
          { minQuantityMilli: "5000", priceMicroJod: "1900000" },
        ],
      },
    );
    expect(overlapping.status).toBe(400);
    expect(await reasonOf(overlapping)).toBe("bounds_must_increase_without_overlap");
    const increasing = await apiPost(
      worker,
      vendorCookie,
      `/api/market/vendor/listings/${listingId}/direct-update`,
      {
        tiers: [
          { minQuantityMilli: "5000", priceMicroJod: "2000000" },
          { minQuantityMilli: "20000", priceMicroJod: "2100000" },
        ],
      },
    );
    expect(increasing.status).toBe(400);
    expect(await reasonOf(increasing)).toBe("unit_price_must_not_increase");
    // A scalar price on a tiered listing is refused (same-mode rule).
    const scalar = await apiPost(
      worker,
      vendorCookie,
      `/api/market/vendor/listings/${listingId}/direct-update`,
      {
        priceMicroJod: "1000000",
      },
    );
    expect(scalar.status).toBe(409);
    expect(await reasonOf(scalar)).toBe("direct_price_requires_fixed_pricing");
    // Tiers on a fixed listing are refused symmetrically.
    const fixed = await publish("قماش ثابت", {
      mode: "fixed",
      priceMicroJod: "2500000",
      basis: { units: "10", unit: "متر" },
    });
    const tiersOnFixed = await apiPost(
      worker,
      vendorCookie,
      `/api/market/vendor/listings/${fixed}/direct-update`,
      {
        tiers: [{ minQuantityMilli: "5000", priceMicroJod: "2000000" }],
      },
    );
    expect(tiersOnFixed.status).toBe(409);
    expect(await reasonOf(tiersOnFixed)).toBe("direct_tiers_require_tiered_pricing");
  });
});

describe("declared quantity direct updates (OD-09)", () => {
  it("updates minimum + step with validation and copy coherence", async () => {
    const listingId = await publish("قماش كميات", {
      mode: "fixed",
      priceMicroJod: "2500000",
      basis: { units: "10", unit: "متر" },
    });
    const response = await apiPost(
      worker,
      vendorCookie,
      `/api/market/vendor/listings/${listingId}/direct-update`,
      {
        minQuantityMilli: "8000",
        stepMilli: "2000",
      },
    );
    expect(response.status).toBe(200);
    const row = await listingRow(listingId);
    expect(row!.min_quantity_milli).toBe("8000");
    expect(row!.quantity_step_milli).toBe("2000");
    const work = JSON.parse(row!.work_copy_json) as {
      quantity: { minQuantityMilli?: string; stepMilli?: string };
    };
    const publicCopy = JSON.parse(row!.public_copy_json ?? "{}") as {
      quantity: { minQuantityMilli?: string; stepMilli?: string };
    };
    expect(work.quantity.minQuantityMilli).toBe("8000");
    expect(work.quantity.stepMilli).toBe("2000");
    expect(publicCopy.quantity.minQuantityMilli).toBe("8000");
    expect(publicCopy.quantity.stepMilli).toBe("2000");
    // Non-numeric / non-positive values are honest 400s.
    const badMin = await apiPost(
      worker,
      vendorCookie,
      `/api/market/vendor/listings/${listingId}/direct-update`,
      {
        minQuantityMilli: "abc",
      },
    );
    expect(badMin.status).toBe(400);
    const zeroStep = await apiPost(
      worker,
      vendorCookie,
      `/api/market/vendor/listings/${listingId}/direct-update`,
      {
        stepMilli: "0",
      },
    );
    expect(zeroStep.status).toBe(400);
  });

  it("ownership: another vendor never reaches someone else's listing", async () => {
    const listingId = await publish("قماش ملكية", {
      mode: "fixed",
      priceMicroJod: "2500000",
      basis: { units: "10", unit: "متر" },
    });
    const cross = await apiPost(
      worker,
      otherVendorCookie,
      `/api/market/vendor/listings/${listingId}/direct-update`,
      {
        priceMicroJod: "1000000",
      },
    );
    expect(cross.status).toBe(404);
    // And a non-published listing refuses direct updates entirely.
    const draft = await apiPost(worker, vendorCookie, "/api/market/vendor/listings", {
      title: "مسودة تحديث مباشر",
      category: "fabric",
      governorate: "إربد",
      description: "وصف مسودة كافٍ للطول المطلوب هنا لأجل الاختبار.",
      contactType: "phone",
      contactValue: "+962790000002",
      pricing: { mode: "fixed", priceMicroJod: "2500000", basis: { units: "10", unit: "متر" } },
      quantity: { unit: "متر", minQuantityMilli: "5000", stepMilli: "1000", unpacked: true },
    });
    const draftBody = (await draft.json()) as { listing: { id: string } };
    const onDraft = await apiPost(
      worker,
      vendorCookie,
      `/api/market/vendor/listings/${draftBody.listing.id}/direct-update`,
      {
        priceMicroJod: "1000000",
      },
    );
    expect(onDraft.status).toBe(409);
    expect(await reasonOf(onDraft)).toBe("not_published");
    // No fields at all is a 400, not a silent no-op.
    const empty = await apiPost(
      worker,
      vendorCookie,
      `/api/market/vendor/listings/${listingId}/direct-update`,
      {},
    );
    expect(empty.status).toBe(400);
    expect(await reasonOf(empty)).toBe("no_direct_fields");
  });
});
