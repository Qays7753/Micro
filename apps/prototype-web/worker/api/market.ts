/**
 * Market API — public browse + vendor workspace (contract 20).
 * Authorization is server-side on every path: guests see only approved
 * public copies with the approved contact channel; vendors see only their
 * own drafts; publication requires the full approval chain (OD-09/OD-16).
 */

import { audit } from "../audit.ts";
import { nowMs } from "../clock.ts";
import { randomToken } from "../crypto.ts";
import { newId, isGlobalModuleEnabled, type Db } from "../db/db.ts";
import { enforceGuestReadLimit } from "../ratelimit.ts";
import {
  conformsToQuantityRules,
  freshnessFrom,
  JORDAN_GOVERNORATES,
  type ListingPricing,
  type ListingQuantity,
} from "../domain/market.ts";
import { LISTING_FRESHNESS_HIDE_MS, LISTING_FRESHNESS_REMINDER_MS } from "../env.ts";
import { HttpError, jsonResponse } from "../http.ts";
import { readJsonBody, type RouteContext } from "../router.ts";
import { ensurePersonalWorkspace, vendorStatus } from "../authorization.ts";
import type { AuthenticatedContext } from "../auth/session.ts";

function db(ctx: RouteContext): Db {
  return ctx.env.DB;
}

async function loadListing(ctx: RouteContext, listingId: string) {
  const row = await db(ctx)
    .prepare(
      "SELECT id, supplier_profile_id, identity_id, title, category, governorate, description, work_copy_json, " +
        "public_copy_json, status, revision_status, price_mode, price_micro_jod, price_basis_json, quantity_unit, " +
        "min_quantity_milli, quantity_step_milli, availability_status, availability_confirmed_at, freshness_state, " +
        "contact_channel_json, published_at, hidden_at FROM supplier_listing WHERE id = ?",
    )
    .bind(listingId)
    .first<Record<string, unknown>>();
  if (!row) throw new HttpError(404, "not_found");
  return row;
}

function publicListingView(row: Record<string, unknown>, now: number) {
  const confirmedAt = Number(row.availability_confirmed_at);
  const freshness = freshnessFrom(confirmedAt, now, LISTING_FRESHNESS_REMINDER_MS, LISTING_FRESHNESS_HIDE_MS);
  return {
    id: String(row.id),
    title: String(row.title),
    category: String(row.category),
    governorate: String(row.governorate),
    description: String(row.description),
    pricing: JSON.parse(String(row.public_copy_json ?? row.work_copy_json)) as { pricing: ListingPricing },
    quantity: JSON.parse(String(row.public_copy_json ?? row.work_copy_json)) as { quantity: ListingQuantity },
    priceMode: String(row.price_mode),
    priceMicroJod: row.price_micro_jod === null ? null : String(row.price_micro_jod),
    priceBasis: row.price_basis_json === null ? null : (JSON.parse(String(row.price_basis_json)) as unknown),
    quantityUnit: String(row.quantity_unit),
    minQuantityMilli: String(row.min_quantity_milli),
    stepMilli: String(row.quantity_step_milli),
    availabilityStatus: String(row.availability_status),
    availabilityConfirmedAt: confirmedAt,
    freshness,
    contactChannel: JSON.parse(String(row.contact_channel_json)) as { type: string; value: string },
    publishedAt: row.published_at === null ? null : Number(row.published_at),
  };
}

/** Cursor pagination for the public browse (continuation 2026-11-12): a
 * stable keyset over (published_at DESC, id DESC). The cursor is opaque and
 * only encodes the position — filters stay independent query params, so any
 * filter combination works with any page. Page size is bounded (1..50). */
interface BrowseCursor {
  v: 1;
  p: number;
  i: string;
}

function decodeBrowseCursor(raw: string | null): BrowseCursor | null {
  if (raw === null) return null;
  if (raw.length > 200 || !/^[A-Za-z0-9_-]+$/.test(raw)) {
    throw new HttpError(400, "bad_request", { field: "cursor", reason: "malformed_cursor" });
  }
  let decoded: unknown;
  try {
    decoded = JSON.parse(atobUrl(raw));
  } catch {
    throw new HttpError(400, "bad_request", { field: "cursor", reason: "malformed_cursor" });
  }
  const cursor = decoded as Partial<BrowseCursor> | null;
  if (
    cursor === null ||
    typeof cursor !== "object" ||
    cursor.v !== 1 ||
    typeof cursor.p !== "number" ||
    !Number.isInteger(cursor.p) ||
    cursor.p <= 0 ||
    typeof cursor.i !== "string" ||
    !/^lst_/.test(cursor.i)
  ) {
    throw new HttpError(400, "bad_request", { field: "cursor", reason: "malformed_cursor" });
  }
  return { v: 1, p: cursor.p, i: cursor.i };
}

function atobUrl(value: string): string {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized + "=".repeat((4 - (normalized.length % 4)) % 4);
  return atob(padded);
}

function btoaUrl(value: string): string {
  return btoa(value).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

const BROWSE_PAGE_SIZE_MAX = 50;

/** GET /api/market/listings — public browse (approved + not hidden), keyset
 * paginated. Malformed cursors are a 400; a stale (older-than-oldest) cursor
 * is a valid empty final page — never an error, never a silent restart. */
export async function browseListings(ctx: RouteContext): Promise<Response> {
  const now = nowMs();
  await enforceGuestReadLimit(ctx.env.DB, ctx.request, now);
  const search = (ctx.url.searchParams.get("search") ?? "").trim();
  const category = ctx.url.searchParams.get("category");
  const governorate = ctx.url.searchParams.get("governorate");
  const availableOnly = ctx.url.searchParams.get("available") === "1";
  const limitParam = Number(ctx.url.searchParams.get("limit") ?? 20) || 20;
  const limit = Math.min(Math.max(Math.trunc(limitParam), 1), BROWSE_PAGE_SIZE_MAX);
  const cursor = decodeBrowseCursor(ctx.url.searchParams.get("cursor"));
  const like = `%${search}%`;
  // Fetch one extra row to know whether a next page exists without lying.
  const rows = await db(ctx)
    .prepare(
      "SELECT l.*, p.public_copy_json AS profile_public FROM supplier_listing l " +
        "JOIN supplier_profile p ON p.id = l.supplier_profile_id " +
        "WHERE l.status = 'approved_for_publish' AND p.status = 'approved' " +
        "AND l.published_at IS NOT NULL " +
        "AND l.availability_confirmed_at > ? " +
        "AND (?::text IS NULL OR l.category = ?) AND (?::text IS NULL OR l.governorate = ?) " +
        "AND (?::text = '' OR l.title ILIKE ? OR l.description ILIKE ? OR l.category ILIKE ?) " +
        (availableOnly ? "AND l.availability_status = 'available' " : "") +
        (cursor === null ? "" : "AND (l.published_at < ? OR (l.published_at = ? AND l.id < ?)) ") +
        "ORDER BY l.published_at DESC, l.id DESC LIMIT ?",
    )
    .bind(
      now - LISTING_FRESHNESS_HIDE_MS,
      category,
      category,
      governorate,
      governorate,
      search,
      like,
      like,
      like,
      ...(cursor === null ? [] : [cursor.p, cursor.p, cursor.i]),
      limit + 1,
    )
    .all<Record<string, unknown>>();
  const hasMore = rows.results.length > limit;
  const page = rows.results.slice(0, limit);
  const listings = page.map(row => publicListingView(row, now));
  const last = page.length > 0 ? page[page.length - 1] : null;
  const nextCursor =
    hasMore && last !== null
      ? btoaUrl(
          JSON.stringify({
            v: 1 as const,
            p: Number(last.published_at ?? 0),
            i: String(last.id),
          }),
        )
      : null;
  return jsonResponse({ listings, count: listings.length, nextCursor, hasMore });
}

/** GET /api/market/listings/:id — public detail of a published listing. */
export async function listingDetail(ctx: RouteContext): Promise<Response> {
  await enforceGuestReadLimit(ctx.env.DB, ctx.request, nowMs());
  const row = await loadListing(ctx, ctx.params.id!);
  const profile = await db(ctx)
    .prepare("SELECT status, public_copy_json FROM supplier_profile WHERE id = ?")
    .bind(String(row.supplier_profile_id))
    .first<Record<string, unknown>>();
  const isPublic =
    String(row.status) === "approved_for_publish" &&
    profile !== null &&
    String(profile.status) === "approved";
  if (!isPublic) throw new HttpError(404, "not_found");
  const view = publicListingView(row, nowMs());
  const media = await db(ctx)
    .prepare(
      "SELECT m.id FROM listing_media lm JOIN media_object m ON m.id = lm.media_id " +
        "WHERE lm.listing_id = ? AND m.status = 'approved'",
    )
    .bind(view.id)
    .all<Record<string, unknown>>();
  const profilePublic = JSON.parse(String(profile.public_copy_json ?? "{}")) as { displayName?: string };
  return jsonResponse({
    listing: view,
    mediaIds: media.results.map(m => String(m.id)),
    vendor: { displayName: profilePublic.displayName ?? "", governorate: view.governorate },
  });
}

/** GET /api/market/meta — categories (owner-managed settings) + governorates. */
export async function marketMeta(ctx: RouteContext): Promise<Response> {
  const settingsRow = await db(ctx)
    .prepare("SELECT value_json FROM network_settings WHERE key = 'market.categories'")
    .first<Record<string, unknown>>();
  const categories =
    settingsRow === null
      ? [
          { id: "packaging", label: "التغليف" },
          { id: "paper", label: "الورق" },
          { id: "fabric", label: "القماش" },
          { id: "panels", label: "الألواح" },
          { id: "food-ingredients", label: "المكونات الغذائية" },
          { id: "construction", label: "البناء" },
        ]
      : (JSON.parse(String(settingsRow.value_json)) as unknown[]);
  return jsonResponse({ categories, governorates: JORDAN_GOVERNORATES });
}

/** GET /api/market/vendor/overview — the signed-in user's own workspace. */
export async function vendorOverview(ctx: RouteContext, auth: AuthenticatedContext): Promise<Response> {
  const profile = await vendorStatus(db(ctx), auth.identityId);
  const profileRow = await db(ctx)
    .prepare(
      "SELECT review_reason, work_copy_json, public_copy_json FROM supplier_profile WHERE identity_id = ? ORDER BY created_at LIMIT 1",
    )
    .bind(auth.identityId)
    .first<Record<string, unknown>>();
  const listings = await db(ctx)
    .prepare(
      "SELECT id, title, status, revision_status, freshness_state, availability_confirmed_at, availability_status, " +
        "price_mode, price_micro_jod, review_reason, updated_at FROM supplier_listing WHERE identity_id = ? ORDER BY updated_at DESC",
    )
    .bind(auth.identityId)
    .all<Record<string, unknown>>();
  return jsonResponse({
    vendor: profile,
    vendorReviewReason:
      profileRow === null
        ? null
        : profileRow.review_reason === null
          ? null
          : String(profileRow.review_reason),
    profileFields:
      profileRow === null
        ? null
        : (JSON.parse(String(profileRow.work_copy_json)) as {
            displayName?: string;
            contactPhone?: string;
            governorate?: string;
          }),
    listings: listings.results.map(row => ({
      id: String(row.id),
      title: String(row.title),
      status: String(row.status),
      revisionStatus: String(row.revision_status),
      freshness: String(row.freshness_state),
      availabilityConfirmedAt: Number(row.availability_confirmed_at),
      availabilityStatus: String(row.availability_status),
      priceMode: String(row.price_mode),
      priceMicroJod: row.price_micro_jod === null ? null : String(row.price_micro_jod),
      updatedAt: Number(row.updated_at),
    })),
  });
}

/** POST /api/market/vendor/profile — create or replace the work copy. */
export async function saveVendorProfile(ctx: RouteContext, auth: AuthenticatedContext): Promise<Response> {
  const body = (await readJsonBody(ctx.request)) as {
    displayName?: string;
    contactPhone?: string;
    governorate?: string;
    minDealValue?: string;
  };
  const displayName =
    typeof body.displayName === "string" && body.displayName.trim().length >= 2
      ? body.displayName.trim()
      : null;
  const phone =
    typeof body.contactPhone === "string" && /^\+?\d{7,15}$/.test(body.contactPhone)
      ? body.contactPhone
      : null;
  const governorate =
    typeof body.governorate === "string" &&
    (JORDAN_GOVERNORATES as readonly string[]).includes(body.governorate)
      ? body.governorate
      : null;
  if (!displayName || !phone || !governorate) throw new HttpError(400, "bad_request", { field: "profile" });
  const now = nowMs();
  const workCopy = JSON.stringify({
    displayName,
    contactPhone: phone,
    governorate,
    minDealValue: body.minDealValue ?? null,
  });
  const existing = await db(ctx)
    .prepare("SELECT id, status FROM supplier_profile WHERE identity_id = ?")
    .bind(auth.identityId)
    .first<Record<string, unknown>>();
  // F-25: the global market kill-switch fails business actions closed BEFORE
  // the workspace capability check (an incident-wide stop is the more
  // informative state when both would apply). Entry points stay visible.
  if (!(await isGlobalModuleEnabled(db(ctx), "market"))) {
    throw new HttpError(503, "module_globally_disabled", { reason: "module_market_disabled_globally" });
  }
  const workspace = await ensurePersonalWorkspace(db(ctx), auth.identityId, nowMs(), randomToken);
  if (!workspace.marketEnabled) {
    throw new HttpError(403, "workspace_capability_disabled", { reason: "module_market_disabled" });
  }
  if (existing) {
    await db(ctx)
      .prepare("UPDATE supplier_profile SET work_copy_json = ?, updated_at = ? WHERE id = ?")
      .bind(workCopy, now, String(existing.id))
      .run();
    return jsonResponse({ profile: { id: String(existing.id), status: String(existing.status) } });
  }
  const id = newId("sp", randomToken);
  await db(ctx)
    .prepare(
      "INSERT INTO supplier_profile (id, identity_id, workspace_id, work_copy_json, status, created_at, updated_at) VALUES (?, ?, ?, ?, 'draft', ?, ?)",
    )
    .bind(id, auth.identityId, workspace.workspaceId, workCopy, now, now)
    .run();
  await audit(
    db(ctx),
    {
      actorIdentityId: auth.identityId,
      action: "vendor_profile_draft",
      objectType: "supplier_profile",
      objectId: id,
      result: "success",
    },
    now,
  );
  return jsonResponse({ profile: { id, status: "draft" } }, 201);
}

/** POST /api/market/vendor/profile/submit — submit the profile for review. */
export async function submitVendorProfile(ctx: RouteContext, auth: AuthenticatedContext): Promise<Response> {
  const now = nowMs();
  const profile = await db(ctx)
    .prepare("SELECT id, status FROM supplier_profile WHERE identity_id = ?")
    .bind(auth.identityId)
    .first<Record<string, unknown>>();
  if (!profile) throw new HttpError(404, "not_found");
  const status = String(profile.status);
  if (status !== "draft" && status !== "changes_requested") {
    throw new HttpError(409, "conflict", { reason: `profile_status_${status}` });
  }
  await db(ctx)
    .prepare(
      "UPDATE supplier_profile SET status = 'submitted', submitted_at = ?, updated_at = ? WHERE id = ?",
    )
    .bind(now, now, String(profile.id))
    .run();
  await audit(
    db(ctx),
    {
      actorIdentityId: auth.identityId,
      action: "vendor_profile_submitted",
      objectType: "supplier_profile",
      objectId: String(profile.id),
      result: "success",
    },
    now,
  );
  return jsonResponse({ ok: true });
}

/** Quantity conformance endpoint (used by the client quantity helper). */
export async function checkQuantity(ctx: RouteContext): Promise<Response> {
  const body = (await readJsonBody(ctx.request)) as {
    minQuantityMilli?: string;
    stepMilli?: string;
    packageSizeMilli?: string;
    unpacked?: boolean;
    requestedMilli?: string;
  };
  if (
    typeof body.minQuantityMilli !== "string" ||
    typeof body.stepMilli !== "string" ||
    typeof body.requestedMilli !== "string"
  ) {
    throw new HttpError(400, "bad_request", { field: "quantity" });
  }
  const result = conformsToQuantityRules(
    {
      unit: "",
      minQuantityMilli: body.minQuantityMilli,
      stepMilli: body.stepMilli,
      packageSizeMilli: body.packageSizeMilli,
      unpacked: body.unpacked !== false,
    },
    BigInt(body.requestedMilli),
  );
  return jsonResponse(result);
}
