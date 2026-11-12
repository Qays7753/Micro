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

export interface PublicListingDetail extends PublicListingSummary {
  description: string;
  stepMilli: string;
  availabilityConfirmedAt: number;
  contactChannel: { type: string; value: string };
  publishedAt: number | null;
  priceBasis: { units: string; unit: string } | null;
}

export interface MarketMeta {
  categories: { id: string; label: string }[];
  governorates: string[];
}

export interface VendorOverview {
  vendor: { status: string; supplierProfileId: string } | null;
  vendorReviewReason: string | null;
  profileFields: { displayName?: string; contactPhone?: string; governorate?: string } | null;
  listings: {
    id: string;
    title: string;
    status: string;
    revisionStatus: string;
    freshness: string;
    availabilityStatus: string;
    priceMode: string;
    priceMicroJod: string | null;
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
  notes?: string;
}

export async function browseMarketListings(filters: {
  search?: string;
  category?: string;
  governorate?: string;
  availableOnly?: boolean;
}): Promise<{ listings: PublicListingSummary[]; count: number }> {
  const params = new URLSearchParams();
  if (filters.search) params.set("search", filters.search);
  if (filters.category) params.set("category", filters.category);
  if (filters.governorate) params.set("governorate", filters.governorate);
  if (filters.availableOnly) params.set("available", "1");
  const query = params.size > 0 ? `?${params.toString()}` : "";
  return apiFetch<{ listings: PublicListingSummary[]; count: number }>(`/api/market/listings${query}`);
}

export async function fetchListingDetail(id: string): Promise<{
  listing: PublicListingDetail;
  mediaIds: string[];
  vendor: { displayName: string; governorate: string };
}> {
  return apiFetch(`/api/market/listings/${encodeURIComponent(id)}`);
}

export async function fetchMarketMeta(): Promise<MarketMeta> {
  return apiFetch<MarketMeta>("/api/market/meta");
}

export async function fetchVendorOverview(): Promise<VendorOverview> {
  return apiFetch<VendorOverview>("/api/market/vendor/overview");
}

export async function upsertVendorProfile(input: {
  displayName: string;
  contactPhone: string;
  governorate: string;
}): Promise<void> {
  await apiFetch(
    "/api/market/vendor/profile",
    { method: "POST", body: JSON.stringify(input) },
    { idempotencyKey: newIdempotencyKey() },
  );
}

export async function submitVendorProfile(): Promise<void> {
  await apiFetch(
    "/api/market/vendor/profile/submit",
    { method: "POST", body: "{}" },
    { idempotencyKey: newIdempotencyKey() },
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
  pricing: { mode?: string; priceMicroJod?: string; basis?: { units?: string; unit?: string } } | null;
  quantity: { unit?: string; minQuantityMilli?: string; stepMilli?: string; unpacked?: boolean } | null;
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

/** OD-09: direct numeric price update on a published FIXED-price listing —
 * verified server-side, re-anchors nothing else, and logs a moderation event. */
export async function directUpdateListing(
  id: string,
  input: {
    priceMicroJod?: string;
    availabilityStatus?: "available" | "made_to_order" | "temporarily_unavailable";
  },
): Promise<void> {
  await apiFetch(
    `/api/market/vendor/listings/${encodeURIComponent(id)}/direct-update`,
    { method: "POST", body: JSON.stringify(input) },
    { idempotencyKey: `direct-update:${id}:${input.priceMicroJod ?? input.availabilityStatus ?? ""}` },
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
