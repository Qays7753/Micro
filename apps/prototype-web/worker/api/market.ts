/**
 * Market API — public browse + vendor workspace (contract 20).
 * Authorization is server-side on every path: guests see only published
 * listings of ACTIVE suppliers with no contact value in any public DTO; the
 * supplier phone is revealed only through the audited, daily-limited reveal
 * endpoint for authenticated accounts (final decisions 2026-11-21 د-1 and the
 * approved continuation decision §8-3). Supplier activation is automatic on
 * profile completion + terms acceptance — there is NO profile review (final
 * decision ب-قواعد/Q4+Q28); every LISTING is reviewed before publication and
 * the first listing requires the reviewer-recorded verification call.
 */

import { audit } from "../audit.ts";
import { nowMs } from "../clock.ts";
import { randomToken } from "../crypto.ts";
import { getSetting, newId, type Db } from "../db/db.ts";
import { enforceGuestReadLimit, enforceQuantityCheckLimit } from "../ratelimit.ts";
import {
  categoryIdsUnderMain,
  conformsToQuantityRules,
  DEFAULT_CATEGORY_TREE,
  DELIVERY_OPTIONS,
  flattenCategoryIds,
  freshnessFrom,
  JORDAN_GOVERNORATES,
  SUPPLIER_TERMS_VERSION,
  SUPPLIER_TYPES,
  type CategoryNode,
  type ListingPricing,
  type ListingQuantity,
  type ListingVariant,
} from "../domain/market.ts";
import { LISTING_FRESHNESS_HIDE_MS, LISTING_FRESHNESS_REMINDER_MS } from "../env.ts";
import { HttpError, jsonResponse } from "../http.ts";
import { readJsonBody, type RouteContext } from "../router.ts";
import { isAdminIdentity, requireWorkspaceContext, vendorStatus } from "../authorization.ts";
import type { AuthenticatedContext } from "../auth/session.ts";

function db(ctx: RouteContext): Db {
  return ctx.env.DB;
}

/** The active category tree (admin-managed network setting, reviewed default). */
export async function activeCategoryTree(db: Db): Promise<CategoryNode[]> {
  const settingsRow = await db
    .prepare("SELECT value_json FROM network_settings WHERE key = 'market.categories'")
    .first<Record<string, unknown>>();
  if (settingsRow === null) return DEFAULT_CATEGORY_TREE;
  try {
    const parsed = JSON.parse(String(settingsRow.value_json)) as CategoryNode[];
    return Array.isArray(parsed) && parsed.length > 0 ? parsed : DEFAULT_CATEGORY_TREE;
  } catch {
    return DEFAULT_CATEGORY_TREE;
  }
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

/**
 * PUBLIC DTO allowlist (final decision د-1 + Wave 2): the contact channel
 * VALUE never appears in any public view — only its type, so the buyer knows a
 * phone exists behind the explicit reveal button. Variants ride in the public
 * copy (Q38); nothing from the work copy leaks (notes stay private).
 */
function publicListingView(row: Record<string, unknown>, now: number) {
  const confirmedAt = Number(row.availability_confirmed_at);
  const freshness = freshnessFrom(confirmedAt, now, LISTING_FRESHNESS_REMINDER_MS, LISTING_FRESHNESS_HIDE_MS);
  const publicCopy = JSON.parse(String(row.public_copy_json ?? row.work_copy_json)) as {
    pricing: ListingPricing;
    quantity: ListingQuantity;
    variants?: ListingVariant[];
  };
  return {
    id: String(row.id),
    title: String(row.title),
    category: String(row.category),
    governorate: String(row.governorate),
    description: String(row.description),
    pricing: publicCopy.pricing,
    quantity: publicCopy.quantity,
    variants: publicCopy.variants ?? [],
    priceMode: String(row.price_mode),
    priceMicroJod: row.price_micro_jod === null ? null : String(row.price_micro_jod),
    priceBasis: row.price_basis_json === null ? null : (JSON.parse(String(row.price_basis_json)) as unknown),
    quantityUnit: String(row.quantity_unit),
    minQuantityMilli: String(row.min_quantity_milli),
    stepMilli: String(row.quantity_step_milli),
    availabilityStatus: String(row.availability_status),
    availabilityConfirmedAt: confirmedAt,
    freshness,
    // د-1 (final decision): the channel TYPE only — the value never appears
    // in a public DTO; the audited reveal endpoint is the only path to it.
    contactChannelType: (JSON.parse(String(row.contact_channel_json)) as { type: string }).type,
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

/** GET /api/market/listings — public browse (published + not hidden +
 * ACTIVE supplier), keyset paginated, final-decision filters (Q49/Q146):
 * supplier type, governorate, delivery vs pickup-only, category (main expands
 * to its subs), maximum minimum-quantity. Malformed cursors are a 400; a
 * stale (older-than-oldest) cursor is a valid empty final page. */
export async function browseListings(ctx: RouteContext): Promise<Response> {
  const now = nowMs();
  await enforceGuestReadLimit(ctx.env.DB, ctx.request, now);
  const search = (ctx.url.searchParams.get("search") ?? "").trim();
  const categoryParam = ctx.url.searchParams.get("category");
  const governorate = ctx.url.searchParams.get("governorate");
  const supplierType = ctx.url.searchParams.get("supplierType");
  const deliveryOption = ctx.url.searchParams.get("delivery");
  const maxMinQuantityMilli = ctx.url.searchParams.get("maxMinQuantityMilli");
  const availableOnly = ctx.url.searchParams.get("available") === "1";
  const limitParam = Number(ctx.url.searchParams.get("limit") ?? 20) || 20;
  const limit = Math.min(Math.max(Math.trunc(limitParam), 1), BROWSE_PAGE_SIZE_MAX);
  const cursor = decodeBrowseCursor(ctx.url.searchParams.get("cursor"));
  if (supplierType !== null && !(SUPPLIER_TYPES as readonly string[]).includes(supplierType)) {
    throw new HttpError(400, "bad_request", { field: "supplierType" });
  }
  if (deliveryOption !== null && !(DELIVERY_OPTIONS as readonly string[]).includes(deliveryOption)) {
    throw new HttpError(400, "bad_request", { field: "delivery" });
  }
  if (maxMinQuantityMilli !== null && !/^\d{1,15}$/.test(maxMinQuantityMilli)) {
    throw new HttpError(400, "bad_request", { field: "maxMinQuantityMilli" });
  }
  // A main-category filter matches the main id itself AND every sub under it.
  const tree = await activeCategoryTree(db(ctx));
  const categoryIds =
    categoryParam === null
      ? null
      : categoryParam.trim().length === 0
        ? null
        : categoryIdsUnderMain(tree, categoryParam.trim());
  const like = `%${search}%`;
  // Fetch one extra row to know whether a next page exists without lying.
  const rows = await db(ctx)
    .prepare(
      "SELECT l.*, p.public_copy_json AS profile_public, p.supplier_type, p.delivery_option FROM supplier_listing l " +
        "JOIN supplier_profile p ON p.id = l.supplier_profile_id " +
        "WHERE l.status = 'approved_for_publish' AND p.status = 'active' " +
        "AND l.published_at IS NOT NULL " +
        "AND l.availability_confirmed_at > ? " +
        "AND (?::text IS NULL OR l.category = ANY(?)) AND (?::text IS NULL OR l.governorate = ?) " +
        "AND (?::text IS NULL OR p.supplier_type = ?) AND (?::text IS NULL OR p.delivery_option = ?) " +
        "AND (?::text IS NULL OR l.min_quantity_milli <= ?) " +
        "AND (?::text = '' OR l.title ILIKE ? OR l.description ILIKE ? OR l.category ILIKE ?) " +
        (availableOnly ? "AND l.availability_status = 'available' " : "") +
        (cursor === null ? "" : "AND (l.published_at < ? OR (l.published_at = ? AND l.id < ?)) ") +
        "ORDER BY l.published_at DESC, l.id DESC LIMIT ?",
    )
    .bind(
      now - LISTING_FRESHNESS_HIDE_MS,
      categoryIds === null ? null : categoryIds.join(","),
      categoryIds === null ? null : categoryIds,
      governorate,
      governorate,
      supplierType,
      supplierType,
      deliveryOption,
      deliveryOption,
      maxMinQuantityMilli,
      maxMinQuantityMilli,
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

/** GET /api/market/listings/:id — public detail of a published listing
 * (ACTIVE supplier). The contact VALUE is never in this DTO — the explicit
 * reveal endpoint is the only public path to the phone. */
export async function listingDetail(ctx: RouteContext): Promise<Response> {
  await enforceGuestReadLimit(ctx.env.DB, ctx.request, nowMs());
  const row = await loadListing(ctx, ctx.params.id!);
  const profile = await db(ctx)
    .prepare(
      "SELECT status, public_copy_json, supplier_type, delivery_option FROM supplier_profile WHERE id = ?",
    )
    .bind(String(row.supplier_profile_id))
    .first<Record<string, unknown>>();
  const isPublic =
    String(row.status) === "approved_for_publish" && profile !== null && String(profile.status) === "active";
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
    vendor: {
      displayName: profilePublic.displayName ?? "",
      governorate: view.governorate,
      supplierType: profile.supplier_type === null ? null : String(profile.supplier_type),
      deliveryOption: profile.delivery_option === null ? null : String(profile.delivery_option),
    },
  });
}

/** GET /api/market/meta — the hierarchical category tree (admin-managed),
 * the 12 governorates, and the final-decision filter vocabularies. */
export async function marketMeta(ctx: RouteContext): Promise<Response> {
  const categories = await activeCategoryTree(db(ctx));
  return jsonResponse({
    categories,
    governorates: JORDAN_GOVERNORATES,
    supplierTypes: SUPPLIER_TYPES,
    deliveryOptions: DELIVERY_OPTIONS,
  });
}

/** GET /api/market/vendor/overview — the signed-in user's own workspace. */
export async function vendorOverview(ctx: RouteContext, auth: AuthenticatedContext): Promise<Response> {
  const profile = await vendorStatus(db(ctx), auth.identityId);
  const profileRow = await db(ctx)
    .prepare(
      "SELECT review_reason, work_copy_json, public_copy_json, terms_accepted_at, activated_at, supplier_type, delivery_option FROM supplier_profile WHERE identity_id = ? ORDER BY created_at LIMIT 1",
    )
    .bind(auth.identityId)
    .first<Record<string, unknown>>();
  const listings = await db(ctx)
    .prepare(
      "SELECT id, title, status, revision_status, freshness_state, availability_confirmed_at, availability_status, " +
        "price_mode, price_micro_jod, review_reason, verification_call_at, updated_at FROM supplier_listing WHERE identity_id = ? ORDER BY updated_at DESC",
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
            supplierType?: string;
            deliveryOption?: string;
          }),
    termsAcceptedAt: profileRow === null ? null : (profileRow.terms_accepted_at as number | null),
    termsVersion: SUPPLIER_TERMS_VERSION,
    activatedAt: profileRow === null ? null : (profileRow.activated_at as number | null),
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
      verificationCallAt: row.verification_call_at === null ? null : Number(row.verification_call_at),
      updatedAt: Number(row.updated_at),
    })),
  });
}

/**
 * POST /api/market/vendor/profile — create or replace the work copy.
 *
 * Post-Group 6 W1 (EX-D24 / AUTHZ-05 / G01): the caller names the ACTIVE
 * project context explicitly (workspaceId) and the server verifies the
 * membership + market capability for THAT workspace — no implicit creation,
 * no first-workspace selection. The admin account is refused (it holds no
 * business roles — final decision ب-المشرف).
 *
 * Wave 2 (final decision ب-قواعد + Q4/Q28): NO profile review — the supplier
 * ACTIVATES automatically when the profile is complete (display name, phone,
 * governorate, supplier type, delivery option) AND the versioned terms are
 * accepted in the same request. A partial save stays an honest draft. A
 * suspended profile stays suspended (the admin decision stands; the honest
 * status is returned).
 */
export async function saveVendorProfile(ctx: RouteContext, auth: AuthenticatedContext): Promise<Response> {
  const body = (await readJsonBody(ctx.request)) as {
    displayName?: string;
    contactPhone?: string;
    governorate?: string;
    minDealValue?: string;
    supplierType?: string;
    deliveryOption?: string;
    termsAccepted?: boolean;
    workspaceId?: string;
  };
  if (typeof body.workspaceId !== "string" || body.workspaceId.length === 0) {
    throw new HttpError(400, "workspace_context_required", { reason: "explicit_active_context" });
  }
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
  const supplierType =
    typeof body.supplierType === "string" && (SUPPLIER_TYPES as readonly string[]).includes(body.supplierType)
      ? body.supplierType
      : null;
  const deliveryOption =
    typeof body.deliveryOption === "string" &&
    (DELIVERY_OPTIONS as readonly string[]).includes(body.deliveryOption)
      ? body.deliveryOption
      : null;
  const termsAccepted = body.termsAccepted === true;
  const now = nowMs();
  if (await isAdminIdentity(db(ctx), auth.identityId)) {
    throw new HttpError(403, "admin_identity_forbidden", {
      reason: "admin_account_holds_no_business_roles",
    });
  }
  const workspace = await requireWorkspaceContext(db(ctx), auth.identityId, body.workspaceId, "market");
  const workCopy = JSON.stringify({
    displayName,
    contactPhone: phone,
    governorate,
    minDealValue: body.minDealValue ?? null,
    supplierType,
    deliveryOption,
    termsVersion: termsAccepted ? SUPPLIER_TERMS_VERSION : null,
  });
  const existing = await db(ctx)
    .prepare("SELECT id, status, workspace_id FROM supplier_profile WHERE identity_id = ?")
    .bind(auth.identityId)
    .first<Record<string, unknown>>();
  if (existing) {
    if (String(existing.workspace_id) !== workspace.workspaceId) {
      // The supplier profile is bound to its project at first save; moving it
      // to another workspace is a cross-context mutation — refused honestly.
      throw new HttpError(409, "conflict", { reason: "profile_workspace_mismatch" });
    }
    /* Post-Group 6 continuous completion (G01 — دورة الدور): دور أُزيل لا
     * يُستعاد بحفظ الملف — إعادة الإضافة بعد الإزالة دلالة استرداد غير
     * محددة في قرارات المالك، فترفض بصمتٍ صادق لا أن تُخترع. */
    if (String(existing.status) === "removed") {
      throw new HttpError(409, "conflict", { reason: "supplier_role_removed" });
    }
    const currentStatus = String(existing.status);
    // Auto-activation (final decision ب-قواعد): complete profile + accepted
    // terms → ACTIVE. A suspended profile stays suspended — only the admin
    // unsuspends. Every other state (draft) can activate.
    const activatable =
      displayName !== null &&
      phone !== null &&
      governorate !== null &&
      supplierType !== null &&
      deliveryOption !== null &&
      termsAccepted;
    const wasActive = currentStatus === "active";
    const nextStatus =
      currentStatus === "suspended" ? "suspended" : activatable || wasActive ? "active" : "draft";
    if (nextStatus === "active") {
      // The PUBLIC copy only ever carries a COMPLETE profile: an active
      // vendor saving an incomplete edit keeps the last complete public copy
      // (the work/public split the listings already use); the columns track
      // the latest declared values for the vendor's own workspace view.
      const publishComplete = activatable;
      await db(ctx)
        .prepare(
          "UPDATE supplier_profile SET work_copy_json = ?, " +
            (publishComplete ? "public_copy_json = ?, " : "") +
            "status = 'active', terms_accepted_at = ?, activated_at = COALESCE(activated_at, ?), " +
            "supplier_type = ?, delivery_option = ?, updated_at = ? WHERE id = ?",
        )
        .bind(
          workCopy,
          ...(publishComplete ? [workCopy] : []),
          termsAccepted ? now : await currentTermsAcceptedAt(db(ctx), String(existing.id)),
          now,
          supplierType,
          deliveryOption,
          now,
          String(existing.id),
        )
        .run();
      if (!wasActive) {
        await audit(
          db(ctx),
          {
            actorIdentityId: auth.identityId,
            action: "vendor_profile_activated",
            objectType: "supplier_profile",
            objectId: String(existing.id),
            result: "success",
            meta: { termsVersion: SUPPLIER_TERMS_VERSION },
          },
          now,
        );
      }
    } else {
      await db(ctx)
        .prepare(
          "UPDATE supplier_profile SET work_copy_json = ?, supplier_type = ?, delivery_option = ?, " +
            "terms_accepted_at = COALESCE(?, terms_accepted_at), updated_at = ? WHERE id = ?",
        )
        .bind(workCopy, supplierType, deliveryOption, termsAccepted ? now : null, now, String(existing.id))
        .run();
    }
    return jsonResponse({ profile: { id: String(existing.id), status: nextStatus } });
  }
  const id = newId("sp", randomToken);
  const activatable =
    displayName !== null &&
    phone !== null &&
    governorate !== null &&
    supplierType !== null &&
    deliveryOption !== null &&
    termsAccepted;
  await db(ctx)
    .prepare(
      activatable
        ? "INSERT INTO supplier_profile (id, identity_id, workspace_id, work_copy_json, public_copy_json, status, terms_accepted_at, activated_at, supplier_type, delivery_option, created_at, updated_at) VALUES (?, ?, ?, ?, ?, 'active', ?, ?, ?, ?, ?, ?)"
        : "INSERT INTO supplier_profile (id, identity_id, workspace_id, work_copy_json, status, supplier_type, delivery_option, created_at, updated_at) VALUES (?, ?, ?, ?, 'draft', ?, ?, ?, ?)",
    )
    .bind(
      ...(activatable
        ? [
            id,
            auth.identityId,
            workspace.workspaceId,
            workCopy,
            workCopy,
            now,
            now,
            supplierType,
            deliveryOption,
            now,
            now,
          ]
        : [id, auth.identityId, workspace.workspaceId, workCopy, supplierType, deliveryOption, now, now]),
    )
    .run();
  await audit(
    db(ctx),
    {
      actorIdentityId: auth.identityId,
      action: activatable ? "vendor_profile_activated" : "vendor_profile_draft",
      objectType: "supplier_profile",
      objectId: id,
      result: "success",
      ...(activatable ? { meta: { termsVersion: SUPPLIER_TERMS_VERSION } } : {}),
    },
    now,
  );
  return jsonResponse({ profile: { id, status: activatable ? "active" : "draft" } }, 201);
}

/** The already-recorded terms acceptance (kept when a later save omits the flag). */
async function currentTermsAcceptedAt(db: Db, profileId: string): Promise<number | null> {
  const row = await db
    .prepare("SELECT terms_accepted_at FROM supplier_profile WHERE id = ?")
    .bind(profileId)
    .first<{ terms_accepted_at: number | null }>();
  return row === null ? null : row.terms_accepted_at === null ? null : Number(row.terms_accepted_at);
}

/**
 * POST /api/market/listings/:id/reveal-phone — the ONLY public path to a
 * supplier phone (final decision د-1 + approved continuation decision §8-3).
 *
 * Any AUTHENTICATED account may reveal — explicitly including an account with
 * no active role (the approved decision forbids adding an active-role gate).
 * Anonymous visitors get 401, and the value is in no public DTO. The
 * server-side limit is 10 DISTINCT supplier numbers per account per day on
 * the repository's fixed UTC-day window (dailyBucket convention — server
 * time, never a client clock). Each reveal is recorded with only the
 * necessary audit data (who, which supplier, which day) and audited.
 */
export const SUPPLIER_PHONE_REVEAL_DAILY_LIMIT = 10;
const DAY_MS = 24 * 60 * 60 * 1000;

export async function revealSupplierPhone(ctx: RouteContext, auth: AuthenticatedContext): Promise<Response> {
  const now = nowMs();
  const listing = await db(ctx)
    .prepare(
      "SELECT l.id, l.supplier_profile_id, l.status, l.contact_channel_json, p.status AS profile_status, p.public_copy_json, p.work_copy_json " +
        "FROM supplier_listing l JOIN supplier_profile p ON p.id = l.supplier_profile_id WHERE l.id = ?",
    )
    .bind(ctx.params.id!)
    .first<Record<string, unknown>>();
  if (
    !listing ||
    String(listing.status) !== "approved_for_publish" ||
    String(listing.profile_status) !== "active"
  ) {
    throw new HttpError(404, "not_found");
  }
  const profileId = String(listing.supplier_profile_id);
  const windowStart = Math.floor(now / DAY_MS) * DAY_MS;
  const revealedToday = await db(ctx)
    .prepare("SELECT COUNT(*) AS n FROM market_phone_reveal WHERE identity_id = ? AND window_start = ?")
    .bind(auth.identityId, windowStart)
    .first<Record<string, unknown>>();
  const distinctToday = Number(revealedToday?.n ?? 0);
  const alreadyRevealedThisSupplier = await db(ctx)
    .prepare(
      "SELECT 1 AS ok FROM market_phone_reveal WHERE identity_id = ? AND supplier_profile_id = ? AND window_start = ?",
    )
    .bind(auth.identityId, profileId, windowStart)
    .first();
  if (distinctToday >= SUPPLIER_PHONE_REVEAL_DAILY_LIMIT && alreadyRevealedThisSupplier === null) {
    throw new HttpError(429, "too_many_requests", {
      reason: "supplier_phone_reveal_daily_limit",
      limit: SUPPLIER_PHONE_REVEAL_DAILY_LIMIT,
      retryAfterMs: DAY_MS,
    });
  }
  // Idempotent ledger row: (identity, supplier, day) — repeat reveals of the
  // same supplier never consume another of the day's distinct slots.
  await db(ctx)
    .prepare(
      "INSERT INTO market_phone_reveal (identity_id, supplier_profile_id, window_start, created_at) VALUES (?, ?, ?, ?) ON CONFLICT DO NOTHING",
    )
    .bind(auth.identityId, profileId, windowStart, now)
    .run();
  const profileCopy = JSON.parse(String(listing.public_copy_json ?? listing.work_copy_json)) as {
    contactPhone?: string;
  };
  const channel = JSON.parse(String(listing.contact_channel_json)) as { type: string; value: string };
  await audit(
    db(ctx),
    {
      actorIdentityId: auth.identityId,
      action: "market_phone_reveal",
      objectType: "supplier_profile",
      objectId: profileId,
      result: "success",
      meta: { listingId: String(listing.id) },
    },
    now,
  );
  return jsonResponse({
    phone: profileCopy.contactPhone ?? channel.value,
    channelType: channel.type,
    remainingToday: Math.max(
      0,
      SUPPLIER_PHONE_REVEAL_DAILY_LIMIT -
        (alreadyRevealedThisSupplier === null ? distinctToday + 1 : distinctToday),
    ),
  });
}

/**
 * GET /api/market/admin/ops-counts — simple operational numbers (Q154, final
 * decision Q129-أرقام تشغيلية), admin-only, derived from explicit sources:
 * active suppliers per the EXACT approved counting rule (distinct active
 * supplier account with a completed profile, accepted terms, at least one
 * listing published after review, and the recorded first-listing verification
 * call), approved drivers, and delivery requests created in the last 7 days.
 * An honest empty state returns zeros — never a fabricated number, and never
 * a launch-threshold claim (synthetic data never satisfies the gate).
 */
export async function marketOpsCounts(ctx: RouteContext, auth: AuthenticatedContext): Promise<Response> {
  if (!auth.isAdmin) throw new HttpError(403, "forbidden", { reason: "admin_only" });
  const now = nowMs();
  const countedSuppliers = await db(ctx)
    .prepare(
      "SELECT COUNT(DISTINCT p.id) AS n FROM supplier_profile p WHERE p.status = 'active' " +
        "AND p.terms_accepted_at IS NOT NULL " +
        "AND EXISTS (SELECT 1 FROM supplier_listing l WHERE l.supplier_profile_id = p.id " +
        "AND l.status = 'approved_for_publish' AND l.published_at IS NOT NULL AND l.verification_call_at IS NOT NULL)",
    )
    .first<Record<string, unknown>>();
  const activeDrivers = await db(ctx)
    .prepare("SELECT COUNT(*) AS n FROM driver_profile WHERE status = 'approved'")
    .first<Record<string, unknown>>();
  const weeklyBookings = await db(ctx)
    .prepare("SELECT COUNT(*) AS n FROM delivery_request WHERE created_at >= ?")
    .bind(now - 7 * DAY_MS)
    .first<Record<string, unknown>>();
  return jsonResponse({
    activeSuppliers: Number(countedSuppliers?.n ?? 0),
    activeDrivers: Number(activeDrivers?.n ?? 0),
    weeklyBookings: Number(weeklyBookings?.n ?? 0),
    // The launch gate itself (≥10 suppliers / ≥5 drivers across the 12
    // governorates) is an OWNER operational decision over genuine accounts —
    // these counts are the honest numbers, never a threshold-satisfied claim.
    launchThreshold: { suppliers: 10, drivers: 5, governorates: 12 },
    computedAt: now,
  });
}

/** Quantity conformance endpoint (used by the client quantity helper).
 * API-01 (Post-Group 6 — order bd242b3e): public path, rate-limited per
 * connecting IP like every public read — no unbounded anonymous hammering. */
export async function checkQuantity(ctx: RouteContext): Promise<Response> {
  await enforceQuantityCheckLimit(db(ctx), ctx.request, nowMs());
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
  // Phase F (reviewer 3): a non-numeric requested quantity is an honest 400,
  // never a BigInt cast-error 500.
  if (!/^\d{1,15}$/.test(body.requestedMilli)) {
    throw new HttpError(400, "bad_request", { field: "requestedMilli" });
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
