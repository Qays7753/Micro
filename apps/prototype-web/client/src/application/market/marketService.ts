/**
 * EX-D18 — خدمات السوق للعميل (عقد 20): التصفح العام ومساحة المورد
 * والمسودات والتقدير. تعرض هذه الخدمات ما يعيده الخادم حصرًا ولا تكتب
 * في أي تخزين محلي، ولا تنشئ أي حدث مالي (OD-13/OD-14).
 */

import { apiFetch, apiUpload, newIdempotencyKey } from "@/application/network";

export interface PublicListingSummary {
  id: string;
  title: string;
  category: string;
  governorate: string;
  priceMode: "fixed" | "tiered" | "quote_required";
  priceMicroJod: string | null;
  minQuantityMilli: string;
  quantityUnit: string;
  availabilityStatus: string;
  freshness: "fresh" | "needs_confirmation" | "hidden_stale";
}

export interface ListingVariant {
  id: string;
  label: string;
  priceMicroJod: string;
  minQuantityMilli: string;
  availability: "available" | "made_to_order" | "temporarily_unavailable";
}

export interface PublicListingDetail extends PublicListingSummary {
  description: string;
  stepMilli: string;
  availabilityConfirmedAt: number;
  /** د-1 (final decision): the channel TYPE only — the VALUE never appears in
   * a public DTO; the audited reveal endpoint is the only path to the phone. */
  contactChannelType: string;
  variants: ListingVariant[];
  publishedAt: number | null;
  priceBasis: { units: string; unit: string } | null;
}

export interface MarketCategoryNode {
  id: string;
  label: string;
  sub: { id: string; label: string }[];
}

export interface MarketMeta {
  categories: MarketCategoryNode[];
  governorates: string[];
  supplierTypes: string[];
  deliveryOptions: string[];
}

export interface VendorOverview {
  vendor: { status: string; supplierProfileId: string } | null;
  vendorReviewReason: string | null;
  profileFields: {
    displayName?: string;
    contactPhone?: string;
    governorate?: string;
    supplierType?: string;
    deliveryOption?: string;
  } | null;
  termsAcceptedAt: number | null;
  termsVersion: string;
  activatedAt: number | null;
  listings: {
    id: string;
    title: string;
    status: string;
    revisionStatus: string;
    freshness: string;
    availabilityStatus: string;
    priceMode: string;
    priceMicroJod: string | null;
    verificationCallAt: number | null;
    updatedAt: number;
  }[];
}

export interface ListingDraftInput {
  title: string;
  category: string;
  governorate: string;
  description: string;
  contactType: "phone" | "whatsapp";
  contactValue: string;
  pricing: {
    mode: "fixed" | "tiered" | "quote_required";
    priceMicroJod?: string;
    basis?: { units: string; unit: string };
    tiers?: { minQuantityMilli: string; priceMicroJod: string }[];
    quoteReason?: string;
  };
  quantity: { unit: string; minQuantityMilli: string; stepMilli: string; unpacked: boolean };
  /** Q38 (final decision): up to 20 options, each with its own price,
   * minimum quantity, and availability — review-scope content. */
  variants?: ListingVariant[];
  notes?: string;
}

/** Keyset cursor pagination (continuation 2026-11-12): filters stay
 * independent params; the cursor is opaque and only encodes the position. */
export async function browseMarketListings(filters: {
  search?: string;
  category?: string;
  governorate?: string;
  supplierType?: string;
  deliveryOption?: string;
  maxMinQuantityMilli?: string;
  availableOnly?: boolean;
  cursor?: string | null;
  limit?: number;
}): Promise<{
  listings: PublicListingSummary[];
  count: number;
  nextCursor: string | null;
  hasMore: boolean;
}> {
  const params = new URLSearchParams();
  if (filters.search) params.set("search", filters.search);
  if (filters.category) params.set("category", filters.category);
  if (filters.governorate) params.set("governorate", filters.governorate);
  if (filters.supplierType) params.set("supplierType", filters.supplierType);
  if (filters.deliveryOption) params.set("delivery", filters.deliveryOption);
  if (filters.maxMinQuantityMilli) params.set("maxMinQuantityMilli", filters.maxMinQuantityMilli);
  if (filters.availableOnly) params.set("available", "1");
  if (filters.cursor) params.set("cursor", filters.cursor);
  if (typeof filters.limit === "number") params.set("limit", String(filters.limit));
  const query = params.size > 0 ? `?${params.toString()}` : "";
  return apiFetch<{
    listings: PublicListingSummary[];
    count: number;
    nextCursor: string | null;
    hasMore: boolean;
  }>(`/api/market/listings${query}`);
}

export async function fetchListingDetail(id: string): Promise<{
  listing: PublicListingDetail;
  mediaIds: string[];
  vendor: {
    displayName: string;
    governorate: string;
    supplierType: string | null;
    deliveryOption: string | null;
  };
}> {
  return apiFetch(`/api/market/listings/${encodeURIComponent(id)}`);
}

export async function fetchMarketMeta(): Promise<MarketMeta> {
  return apiFetch<MarketMeta>("/api/market/meta");
}

export async function fetchVendorOverview(): Promise<VendorOverview> {
  return apiFetch<VendorOverview>("/api/market/vendor/overview");
}

/** Wave 2 (final decision ب-قواعد): the complete profile + accepted versioned
 * terms ACTIVATES the supplier in this single request — no profile review.
 * A partial save stays an honest draft. */
export async function upsertVendorProfile(input: {
  displayName: string;
  contactPhone: string;
  governorate: string;
  supplierType?: string;
  deliveryOption?: string;
  termsAccepted?: boolean;
  /** W1 (EX-D24/AUTHZ-05): السياق النشط الصريح — يتحقق منه الخادم. */
  workspaceId: string;
}): Promise<{ profile: { id: string; status: string } }> {
  return apiFetch(
    "/api/market/vendor/profile",
    { method: "POST", body: JSON.stringify(input) },
    { idempotencyKey: newIdempotencyKey() },
  );
}

/** د-1 + §8-3 (approved decision): reveal the supplier phone — ANY
 * authenticated account (no active-role gate), server-side limit of 10
 * distinct supplier numbers per account per day, every reveal audited. */
export async function revealSupplierPhone(listingId: string): Promise<{
  phone: string;
  channelType: string;
  remainingToday: number;
}> {
  return apiFetch(
    `/api/market/listings/${encodeURIComponent(listingId)}/reveal-phone`,
    { method: "POST", body: "{}" },
    { idempotencyKey: `reveal-phone:${listingId}` },
  );
}

/** Q154: admin-only operational counts (the launch-threshold counting rule —
 * never a threshold-satisfied claim from synthetic data). */
export async function fetchMarketOpsCounts(): Promise<{
  activeSuppliers: number;
  activeDrivers: number;
  weeklyBookings: number;
  launchThreshold: { suppliers: number; drivers: number; governorates: number };
  computedAt: number;
}> {
  return apiFetch("/api/market/admin/ops-counts");
}

/** Q49/Q146: the admin-managed hierarchical category tree. */
export async function putMarketCategories(
  tree: { id: string; label: string; sub: { id: string; label: string }[] }[],
): Promise<void> {
  await apiFetch(
    "/api/admin/settings/market.categories",
    { method: "PUT", body: JSON.stringify({ value: tree }) },
    { idempotencyKey: `market-categories:${JSON.stringify(tree)}` },
  );
}

export async function createListingDraft(input: ListingDraftInput): Promise<{ listing: { id: string } }> {
  return apiFetch(
    "/api/market/vendor/listings",
    { method: "POST", body: JSON.stringify(input) },
    { idempotencyKey: newIdempotencyKey() },
  );
}

export interface VendorListingDraft {
  id: string;
  status: string;
  revisionStatus: string;
  title: string;
  category: string;
  governorate: string;
  description: string;
  contact: { type?: string; value?: string };
  pricing: {
    mode?: string;
    priceMicroJod?: string;
    basis?: { units?: string; unit?: string };
    tiers?: { minQuantityMilli: string; priceMicroJod: string }[];
  } | null;
  quantity: { unit?: string; minQuantityMilli?: string; stepMilli?: string; unpacked?: boolean } | null;
  /** Q38: the work copy's variant options (review-scope content). */
  variants?: ListingVariant[] | null;
  mediaIds: string[];
}

export async function fetchVendorListingDraft(id: string): Promise<{ listing: VendorListingDraft }> {
  return apiFetch(`/api/market/vendor/listings/${encodeURIComponent(id)}`);
}

export async function updateListingDraft(id: string, input: ListingDraftInput): Promise<void> {
  await apiFetch(
    `/api/market/vendor/listings/${encodeURIComponent(id)}`,
    { method: "POST", body: JSON.stringify(input) },
    { idempotencyKey: newIdempotencyKey() },
  );
}

export async function submitListing(id: string): Promise<void> {
  await apiFetch(
    `/api/market/vendor/listings/${encodeURIComponent(id)}/submit`,
    { method: "POST", body: "{}" },
    { idempotencyKey: newIdempotencyKey() },
  );
}

export async function confirmListingAvailability(id: string): Promise<void> {
  await apiFetch(
    `/api/market/vendor/listings/${encodeURIComponent(id)}/confirm-availability`,
    { method: "POST", body: "{}" },
    { idempotencyKey: newIdempotencyKey() },
  );
}

/** OD-09 (contract 20 §3.3): approved direct updates — the numeric price
 * WITHIN the same pricing mode (fixed scalar / tiered list), the declared
 * quantity figures (minimum + step), and availability. Verified and logged
 * server-side; re-anchors nothing else. */
export async function directUpdateListing(
  id: string,
  input: {
    priceMicroJod?: string;
    tiers?: { minQuantityMilli: string; priceMicroJod: string }[];
    minQuantityMilli?: string;
    stepMilli?: string;
    availabilityStatus?: "available" | "made_to_order" | "temporarily_unavailable";
  },
): Promise<void> {
  await apiFetch(
    `/api/market/vendor/listings/${encodeURIComponent(id)}/direct-update`,
    { method: "POST", body: JSON.stringify(input) },
    {
      idempotencyKey: `direct-update:${id}:${JSON.stringify(Object.keys(input).sort())}:${JSON.stringify(
        input.priceMicroJod ??
          input.tiers ??
          input.minQuantityMilli ??
          input.stepMilli ??
          input.availabilityStatus ??
          "",
      )}`,
    },
  );
}

export async function listingLifecycleAction(
  id: string,
  action: "pause" | "resume" | "archive",
): Promise<void> {
  await apiFetch(
    `/api/market/vendor/listings/${encodeURIComponent(id)}/${action}`,
    { method: "POST", body: "{}" },
    { idempotencyKey: newIdempotencyKey() },
  );
}

export async function uploadListingImage(file: File): Promise<{ media: { id: string } }> {
  return apiUpload("/api/media?purpose=market_listing_media", file, { idempotencyKey: newIdempotencyKey() });
}

export async function attachListingMedia(listingId: string, mediaId: string): Promise<void> {
  await apiFetch(
    `/api/market/vendor/listings/${encodeURIComponent(listingId)}/media`,
    { method: "POST", body: JSON.stringify({ mediaId }) },
    { idempotencyKey: newIdempotencyKey() },
  );
}

export async function toggleSavedListing(listingId: string): Promise<{ saved: boolean }> {
  return apiFetch(
    `/api/market/saved/${encodeURIComponent(listingId)}`,
    { method: "POST", body: "{}" },
    { idempotencyKey: newIdempotencyKey() },
  );
}

export async function reportListing(listingId: string, reason: string, details?: string): Promise<void> {
  await apiFetch(
    "/api/market/report",
    { method: "POST", body: JSON.stringify({ listingId, reason, details }) },
    { idempotencyKey: newIdempotencyKey() },
  );
}
