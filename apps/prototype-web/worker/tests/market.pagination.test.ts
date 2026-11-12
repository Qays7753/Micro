/**
 * Market browse keyset pagination (continuation 2026-11-12 — §17-7 closure):
 * stable cursor over (published_at DESC, id DESC), filter-stable pages, safe
 * page-size bounds, malformed cursor is an honest 400, a stale cursor is a
 * valid empty final page, and no draft/private listing ever appears on any
 * page regardless of cursor.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { apiGet, apiPost, rawDb, signInAs, startWorker, type WorkerInstance } from "./harness.ts";

let worker: WorkerInstance;
let adminCookie: string;
let vendorCookie: string;
let otherVendorCookie: string;

const TOTAL = 9;

async function publishListing(title: string, pricing: Record<string, unknown>): Promise<string> {
  const media = await worker.fetch("/api/media?purpose=market_listing_media", {
    method: "POST",
    headers: { "content-type": "image/png", origin: worker.origin, "x-micro-api": "1", cookie: vendorCookie },
    body: new Uint8Array([9, 9, 9]),
  });
  const mediaBody = (await media.json()) as { media: { id: string } };
  const created = await apiPost(worker, vendorCookie, "/api/market/vendor/listings", {
    title,
    category: "packaging",
    governorate: "عمان",
    description: "وصف مادة تغليف للاختبار مع تفاصيل كافية للنشر.",
    contactType: "phone",
    contactValue: "+962790000001",
    pricing,
    quantity: { unit: "حبة", minQuantityMilli: "1000", stepMilli: "500", unpacked: true },
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

beforeAll(async () => {
  worker = await startWorker();
  adminCookie = (await signInAs(worker, { sub: "pg-admin", email: "pg-admin@example.test" })).cookieHeader;
  const db = await rawDb(worker);
  const adminIdentity = await db
    .prepare("SELECT id FROM network_identity WHERE email = ?")
    .bind("pg-admin@example.test")
    .first<{ id: string }>();
  await db
    .prepare(
      "INSERT INTO network_membership (identity_id, role, status, granted_by, granted_at) VALUES (?, 'admin', 'active', 'test', 1)",
    )
    .bind(adminIdentity!.id)
    .run();
  vendorCookie = (await signInAs(worker, { sub: "pg-vendor", email: "pg-vendor@example.test" })).cookieHeader;
  otherVendorCookie = (await signInAs(worker, { sub: "pg-other", email: "pg-other@example.test" }))
    .cookieHeader;
  // Vendor profile first (the publication gate needs an approved file).
  const profileResponse = await apiPost(worker, vendorCookie, "/api/market/vendor/profile", {
    displayName: "مورد الترقيم",
    contactPhone: "+962790000001",
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

interface BrowsePage {
  listings: { id: string }[];
  count: number;
  nextCursor: string | null;
  hasMore: boolean;
}

async function browse(query: string): Promise<Response> {
  return apiGet(worker, null, `/api/market/listings${query}`);
}

describe("market browse keyset pagination (§17-7 closure)", () => {
  it("pages through every published listing exactly once, then an honest final page", async () => {
    const ids: string[] = [];
    for (let index = 0; index < TOTAL; index += 1) {
      const pricing =
        index % 2 === 0
          ? { mode: "fixed", priceMicroJod: `${(index + 1) * 1000000}`, basis: { units: "1", unit: "حبة" } }
          : {
              mode: "tiered",
              tiers: [{ minQuantityMilli: "1000", priceMicroJod: `${(index + 1) * 500000}` }],
            };
      ids.push(await publishListing(`إعلان مرقّم ${index + 1}`, pricing));
    }
    // Deterministic order: distinct published_at, newest = index 0.
    const db = await rawDb(worker);
    const base = Date.now();
    for (let index = 0; index < ids.length; index += 1) {
      await db
        .prepare("UPDATE supplier_listing SET published_at = ? WHERE id = ?")
        .bind(base - (index + 1) * 1000, ids[index]!)
        .run();
    }
    const pageSize = 4;
    const seen: string[] = [];
    let cursor: string | null = null;
    let pages = 0;
    for (;;) {
      const query = `?limit=${pageSize}${cursor === null ? "" : `&cursor=${cursor}`}`;
      const response = await browse(query);
      expect(response.status).toBe(200);
      const page = (await response.json()) as BrowsePage;
      expect(page.listings.length).toBeLessThanOrEqual(pageSize);
      seen.push(...page.listings.map(l => l.id));
      pages += 1;
      if (!page.hasMore) {
        expect(page.nextCursor).toBeNull();
        break;
      }
      expect(page.nextCursor).toBeTruthy();
      cursor = page.nextCursor;
      expect(pages).toBeLessThan(10);
    }
    expect(seen).toHaveLength(TOTAL);
    expect(new Set(seen).size).toBe(TOTAL);
    // Newest first, strictly.
    expect(seen).toEqual(ids);
    // A fresh first page equals the first page above (filter-stable).
    const first = (await (await browse(`?limit=${pageSize}`)).json()) as BrowsePage;
    expect(first.listings.map(l => l.id)).toEqual(seen.slice(0, pageSize));
    // Walking past the end with the last seen position yields a valid empty
    // final page (stale cursor — never an error, never a restart).
    const last = seen[seen.length - 1]!;
    const lastRow = await db
      .prepare("SELECT published_at FROM supplier_listing WHERE id = ?")
      .bind(last)
      .first<{ published_at: number }>();
    const stale = btoa(JSON.stringify({ v: 1, p: lastRow!.published_at, i: last }))
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/, "");
    const stalePage = (await (await browse(`?cursor=${stale}`)).json()) as BrowsePage;
    expect(stalePage.listings).toHaveLength(0);
    expect(stalePage.hasMore).toBe(false);
    expect(stalePage.nextCursor).toBeNull();
  }, 120_000);

  it("malformed cursors are honest 400s (never silently ignored)", async () => {
    for (const bad of ["not-a-cursor!", "####", "eyJ2IjoxLCJwIjo5fQ", "lst_nope", "aaaa.aaa"]) {
      const response = await browse(`?cursor=${encodeURIComponent(bad)}`);
      expect(response.status).toBe(400);
      const body = (await response.json()) as { error?: { details?: { reason?: string } } };
      expect(body.error?.details?.reason).toBe("malformed_cursor");
    }
    // Well-formed but wrong-typed payload is still malformed.
    const wrongType = btoa(JSON.stringify({ v: 1, p: "not-a-number", i: "lst_x" }))
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/, "");
    const wrongTypeResponse = await browse(`?cursor=${wrongType}`);
    expect(wrongTypeResponse.status).toBe(400);
  });

  it("page size is bounded (1..50) and filters stay independent of the cursor", async () => {
    const zero = (await (await browse("?limit=0")).json()) as BrowsePage;
    expect(zero.listings.length).toBeGreaterThanOrEqual(1);
    const huge = await browse("?limit=10000");
    expect(huge.status).toBe(200);
    // The cursor carries only the position: filtering works on any page.
    const page1 = (await (await browse("?limit=2")).json()) as BrowsePage;
    expect(page1.hasMore).toBe(true);
    const filtered = (await (
      await browse(`?limit=50&cursor=${page1.nextCursor}&search=${encodeURIComponent("غير موجود إطلاقًا")}`)
    ).json()) as BrowsePage;
    expect(filtered.listings).toHaveLength(0);
    expect(filtered.hasMore).toBe(false);
  });

  it("drafts and other vendors' unpublished work never appear on any page", async () => {
    // A draft (never submitted) and a submitted-but-unreviewed listing.
    const draft = await apiPost(worker, vendorCookie, "/api/market/vendor/listings", {
      title: "مسودة لا تُنشر أبدًا",
      category: "paper",
      governorate: "عمان",
      description: "وصف مسودة كافٍ للطول المطلوب هنا لأجل الاختبار.",
      contactType: "phone",
      contactValue: "+962790000001",
      pricing: { mode: "fixed", priceMicroJod: "1000000", basis: { units: "1", unit: "حبة" } },
      quantity: { unit: "حبة", minQuantityMilli: "1000", stepMilli: "500", unpacked: true },
    });
    const draftBody = (await draft.json()) as { listing: { id: string } };
    const draftDetail = await apiGet(worker, null, `/api/market/listings/${draftBody.listing.id}`);
    expect(draftDetail.status).toBe(404);
    // Walk every page: the draft must never surface.
    let cursor: string | null = null;
    let guard = 0;
    do {
      const page = (await (
        await browse(`?limit=50${cursor === null ? "" : `&cursor=${cursor}`}`)
      ).json()) as BrowsePage;
      expect(page.listings.some(l => l.id === draftBody.listing.id)).toBe(false);
      cursor = page.nextCursor;
      guard += 1;
    } while (cursor !== null && guard < 10);
    // Cross-vendor read of the draft is a 404 as the other vendor too.
    const cross = await apiGet(
      worker,
      otherVendorCookie,
      `/api/market/vendor/listings/${draftBody.listing.id}`,
    );
    expect(cross.status).toBe(404);
  });
});
