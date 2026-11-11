/**
 * Market API — public browse + vendor workspace (contract 20).
 * Authorization is server-side on every path: guests see only approved
 * public copies with the approved contact channel; vendors see only their
 * own drafts; publication requires the full approval chain (OD-09/OD-16).
 */

import { audit, notify } from "../audit.ts";
import { nowMs } from "../clock.ts";
import { randomToken } from "../crypto.ts";
import { newId, type Db } from "../db/d1.ts";
import {
  conformsToQuantityRules,
  freshnessFrom,
  JORDAN_GOVERNORATES,
  validatePricing,
  type ListingPricing,
  type ListingQuantity,
} from "../domain/market.ts";
import { LISTING_FRESHNESS_HIDE_MS, LISTING_FRESHNESS_REMINDER_MS, MAX_LISTING_MEDIA } from "../env.ts";
import { HttpError, jsonResponse } from "../http.ts";
import { readJsonBody, type RouteContext } from "../router.ts";
import { vendorStatus } from "../authorization.ts";
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

/** GET /api/market/listings — public browse (approved + not hidden). */
export async function browseListings(ctx: RouteContext): Promise<Response> {
  const now = nowMs();
  const search = (ctx.url.searchParams.get("search") ?? "").trim();
  const category = ctx.url.searchParams.get("category");
  const governorate = ctx.url.searchParams.get("governorate");
  const availableOnly = ctx.url.searchParams.get("available") === "1";
  const limit = Math.min(Number(ctx.url.searchParams.get("limit") ?? 20) || 20, 50);
  const like = `%${search}%`;
  const rows = await db(ctx)
    .prepare(
      "SELECT l.*, p.public_copy_json AS profile_public FROM supplier_listing l " +
        "JOIN supplier_profile p ON p.id = l.supplier_profile_id " +
        "WHERE l.status = 'approved_for_publish' AND p.status = 'approved' " +
        "AND l.availability_confirmed_at > ? " +
        "AND (? IS NULL OR l.category = ?) AND (? IS NULL OR l.governorate = ?) " +
        "AND (? = '' OR l.title LIKE ? OR l.description LIKE ? OR l.category LIKE ?) " +
        (availableOnly ? "AND l.availability_status = 'available' " : "") +
        "ORDER BY l.published_at DESC LIMIT ?",
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
      limit,
    )
    .all<Record<string, unknown>>();
  const listings = rows.results.map(row => publicListingView(row, now));
  return jsonResponse({ listings, count: listings.length });
}

/** GET /api/market/listings/:id — public detail of a published listing. */
export async function listingDetail(ctx: RouteContext): Promise<Response> {
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
  const listings = await db(ctx)
    .prepare(
      "SELECT id, title, status, revision_status, freshness_state, availability_confirmed_at, availability_status, " +
        "price_mode, price_micro_jod, updated_at FROM supplier_listing WHERE identity_id = ? ORDER BY updated_at DESC",
    )
    .bind(auth.identityId)
    .all<Record<string, unknown>>();
  return jsonResponse({
    vendor: profile,
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
      "INSERT INTO supplier_profile (id, identity_id, work_copy_json, status, created_at, updated_at) VALUES (?, ?, ?, 'draft', ?, ?)",
    )
    .bind(id, auth.identityId, workCopy, now, now)
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

async function requireOwnListing(ctx: RouteContext, auth: AuthenticatedContext, listingId: string) {
  const row = await loadListing(ctx, listingId);
  if (String(row.identity_id) !== auth.identityId && !auth.isAdmin) {
    throw new HttpError(404, "not_found");
  }
  return row;
}

/** POST /api/market/vendor/listings — create a listing draft (idempotent). */
export async function createListingDraft(ctx: RouteContext, auth: AuthenticatedContext): Promise<Response> {
  const body = (await readJsonBody(ctx.request)) as Record<string, unknown>;
  const title = typeof body.title === "string" && body.title.trim().length >= 8 ? body.title.trim() : null;
  const category = typeof body.category === "string" && body.category.length > 0 ? body.category : null;
  const governorate =
    typeof body.governorate === "string" &&
    (JORDAN_GOVERNORATES as readonly string[]).includes(body.governorate)
      ? body.governorate
      : null;
  const description =
    typeof body.description === "string" && body.description.trim().length >= 20
      ? body.description.trim()
      : null;
  const contactType =
    typeof body.contactType === "string" && ["phone", "whatsapp"].includes(body.contactType)
      ? body.contactType
      : null;
  const contactValue =
    typeof body.contactValue === "string" && /^\+?\d{7,15}$/.test(body.contactValue)
      ? body.contactValue
      : null;
  if (!title || !category || !governorate || !description || !contactType || !contactValue) {
    throw new HttpError(400, "bad_request", { field: "listing" });
  }
  const pricing = (body.pricing ?? null) as ListingPricing | null;
  const quantity = (body.quantity ?? null) as ListingQuantity | null;
  if (!pricing || !quantity) throw new HttpError(400, "bad_request", { field: "pricing/quantity" });
  validatePricing(pricing);
  if (BigInt(quantity.minQuantityMilli) < 1n)
    throw new HttpError(400, "bad_request", { field: "minQuantityMilli" });
  const profile = await db(ctx)
    .prepare("SELECT id FROM supplier_profile WHERE identity_id = ?")
    .bind(auth.identityId)
    .first<Record<string, unknown>>();
  if (!profile) throw new HttpError(409, "conflict", { reason: "vendor_profile_required" });
  const now = nowMs();
  const id = newId("lst", randomToken);
  const workCopy = JSON.stringify({
    title,
    category,
    governorate,
    description,
    pricing,
    quantity,
    notes: typeof body.notes === "string" ? body.notes.slice(0, 500) : null,
  });
  await db(ctx)
    .prepare(
      "INSERT INTO supplier_listing (id, supplier_profile_id, identity_id, title, category, governorate, description, " +
        "work_copy_json, status, revision_status, price_mode, price_micro_jod, price_basis_json, quantity_unit, " +
        "min_quantity_milli, quantity_step_milli, availability_status, availability_confirmed_at, freshness_state, " +
        "contact_channel_json, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'draft', 'none', ?, ?, ?, ?, ?, ?, 'available', ?, 'fresh', ?, ?, ?)",
    )
    .bind(
      id,
      String(profile.id),
      auth.identityId,
      title,
      category,
      governorate,
      description,
      workCopy,
      pricing.mode,
      pricing.priceMicroJod ?? null,
      pricing.mode === "fixed" && pricing.basis
        ? JSON.stringify(pricing.basis)
        : pricing.mode === "tiered" && pricing.tiers
          ? JSON.stringify(pricing.tiers)
          : null,
      quantity.unit,
      quantity.minQuantityMilli,
      quantity.stepMilli,
      now,
      JSON.stringify({ type: contactType, value: contactValue }),
      now,
      now,
    )
    .run();
  return jsonResponse({ listing: { id } }, 201);
}

/** POST /api/market/vendor/listings/:id — edit the work copy (draft/revision).
 *
 * The work copy is the single editable source (contract 20): for a published
 * listing, edits are STAGED in the work copy only — the public columns keep
 * serving the approved copy until a reviewer approves the revision.
 */
export async function updateListingDraft(ctx: RouteContext, auth: AuthenticatedContext): Promise<Response> {
  const row = await requireOwnListing(ctx, auth, ctx.params.id!);
  const body = (await readJsonBody(ctx.request)) as Record<string, unknown>;
  const status = String(row.status);
  const editable = status === "draft" || status === "changes_requested" || status === "rejected";
  const publishedWithRevision =
    status === "approved_for_publish" && ["none", "changes_requested"].includes(String(row.revision_status));
  if (!editable && !publishedWithRevision)
    throw new HttpError(409, "conflict", { reason: `listing_status_${status}` });
  const now = nowMs();
  const work = JSON.parse(String(row.work_copy_json)) as Record<string, unknown>;
  const stagedColumns: Record<string, string> = {};
  const textFields: Array<[string, number]> = [
    ["title", 8],
    ["description", 20],
  ];
  for (const [field, minLength] of textFields) {
    const value = body[field];
    if (typeof value === "string") {
      if (value.trim().length < minLength) throw new HttpError(400, "bad_request", { field });
      work[field] = value.trim();
      stagedColumns[field] = value.trim();
    }
  }
  const pricing = body.pricing as ListingPricing | undefined;
  if (pricing !== undefined) {
    validatePricing(pricing);
    work.pricing = pricing;
  }
  const quantity = body.quantity as ListingQuantity | undefined;
  if (quantity !== undefined) {
    work.quantity = quantity;
  }
  if (typeof body.notes === "string") work.notes = body.notes.slice(0, 500);
  // Persist the staged work copy; for a not-yet-published listing the draft
  // columns may mirror the edits directly (nothing is public yet).
  const sets = ["work_copy_json = ?", "updated_at = ?"];
  const values: unknown[] = [JSON.stringify(work), now];
  if (editable && stagedColumns.title !== undefined) {
    sets.push("title = ?");
    values.push(stagedColumns.title);
  }
  if (editable && stagedColumns.description !== undefined) {
    sets.push("description = ?");
    values.push(stagedColumns.description);
  }
  values.push(String(row.id));
  await db(ctx)
    .prepare(`UPDATE supplier_listing SET ${sets.join(", ")} WHERE id = ?`)
    .bind(...values)
    .run();
  return jsonResponse({ ok: true });
}

/** POST /api/market/vendor/listings/:id/submit — submit draft or revision. */
export async function submitListing(ctx: RouteContext, auth: AuthenticatedContext): Promise<Response> {
  const row = await requireOwnListing(ctx, auth, ctx.params.id!);
  const status = String(row.status);
  const now = nowMs();
  if (status === "draft" || status === "changes_requested" || status === "rejected") {
    await db(ctx)
      .prepare(
        "UPDATE supplier_listing SET status = 'submitted', submitted_at = ?, updated_at = ? WHERE id = ?",
      )
      .bind(now, now, String(row.id))
      .run();
  } else if (
    status === "approved_for_publish" &&
    ["none", "changes_requested", "submitted"].includes(String(row.revision_status))
  ) {
    // Content revision: the public copy stays live until the new one is
    // approved. For a listing hidden for staleness this is the OD-11 renewal
    // request — it goes through review, never a direct unhide.
    await db(ctx)
      .prepare(
        "UPDATE supplier_listing SET revision_status = 'submitted', submitted_at = ?, updated_at = ? WHERE id = ?",
      )
      .bind(now, now, String(row.id))
      .run();
  } else {
    throw new HttpError(409, "conflict", { reason: `listing_status_${status}` });
  }
  await audit(
    db(ctx),
    {
      actorIdentityId: auth.identityId,
      action: "listing_submitted",
      objectType: "supplier_listing",
      objectId: String(row.id),
      result: "success",
    },
    now,
  );
  return jsonResponse({ ok: true });
}

/** POST /api/market/vendor/listings/:id/confirm-availability (OD-09 direct). */
export async function confirmAvailability(ctx: RouteContext, auth: AuthenticatedContext): Promise<Response> {
  const row = await requireOwnListing(ctx, auth, ctx.params.id!);
  const now = nowMs();
  if (String(row.status) !== "approved_for_publish")
    throw new HttpError(409, "conflict", { reason: "not_published" });
  const confirmedAt = Number(row.availability_confirmed_at);
  if (now - confirmedAt >= LISTING_FRESHNESS_HIDE_MS) {
    // OD-11: renewal after hiding goes through review — the direct action is closed.
    throw new HttpError(409, "conflict", { reason: "renewal_requires_review" });
  }
  await db(ctx)
    .prepare(
      "UPDATE supplier_listing SET availability_confirmed_at = ?, freshness_state = 'fresh', updated_at = ? WHERE id = ?",
    )
    .bind(now, now, String(row.id))
    .run();
  await db(ctx)
    .prepare(
      "INSERT INTO market_moderation_event (object_type, object_id, actor_identity_id, action, reason, created_at) VALUES ('supplier_listing', ?, ?, 'direct_availability_confirmation', NULL, ?)",
    )
    .bind(String(row.id), auth.identityId, now)
    .run();
  return jsonResponse({ ok: true });
}

/** POST /api/market/vendor/listings/:id/pause | /archive | /resume. */
export async function vendorListingLifecycle(
  ctx: RouteContext,
  auth: AuthenticatedContext,
  action: string,
): Promise<Response> {
  const row = await requireOwnListing(ctx, auth, ctx.params.id!);
  const now = nowMs();
  const status = String(row.status);
  if (action === "pause" && status === "approved_for_publish") {
    await db(ctx)
      .prepare("UPDATE supplier_listing SET status = 'paused', updated_at = ? WHERE id = ?")
      .bind(now, String(row.id))
      .run();
  } else if (action === "archive" && ["approved_for_publish", "paused"].includes(status)) {
    await db(ctx)
      .prepare("UPDATE supplier_listing SET status = 'archived', updated_at = ? WHERE id = ?")
      .bind(now, String(row.id))
      .run();
  } else if (action === "resume" && status === "paused") {
    // OD-11: resuming a listing hidden for staleness requires review renewal.
    const needsReview = String(row.freshness_state) === "hidden_stale";
    if (needsReview) throw new HttpError(409, "conflict", { reason: "renewal_requires_review" });
    await db(ctx)
      .prepare("UPDATE supplier_listing SET status = 'approved_for_publish', updated_at = ? WHERE id = ?")
      .bind(now, String(row.id))
      .run();
  } else {
    throw new HttpError(409, "conflict", { reason: `action_${action}_invalid_for_${status}` });
  }
  await db(ctx)
    .prepare(
      "INSERT INTO market_moderation_event (object_type, object_id, actor_identity_id, action, created_at) VALUES ('supplier_listing', ?, ?, ?, ?)",
    )
    .bind(String(row.id), auth.identityId, `vendor_${action}`, now)
    .run();
  return jsonResponse({ ok: true });
}

/** POST /api/market/vendor/listings/:id/media — attach an owned media object. */
export async function attachListingMedia(ctx: RouteContext, auth: AuthenticatedContext): Promise<Response> {
  const row = await requireOwnListing(ctx, auth, ctx.params.id!);
  const body = (await readJsonBody(ctx.request)) as { mediaId?: string; kind?: string };
  if (typeof body.mediaId !== "string") throw new HttpError(400, "bad_request", { field: "mediaId" });
  const kind = body.kind === "cover" ? "cover" : "gallery";
  const media = await db(ctx)
    .prepare("SELECT id, owner_identity_id, purpose FROM media_object WHERE id = ?")
    .bind(body.mediaId)
    .first<Record<string, unknown>>();
  if (
    !media ||
    String(media.owner_identity_id) !== auth.identityId ||
    String(media.purpose) !== "market_listing_media"
  ) {
    throw new HttpError(404, "not_found");
  }
  const count = await db(ctx)
    .prepare("SELECT COUNT(*) AS n FROM listing_media WHERE listing_id = ?")
    .bind(String(row.id))
    .first<Record<string, unknown>>();
  if (Number(count?.n ?? 0) >= MAX_LISTING_MEDIA)
    throw new HttpError(409, "conflict", { reason: "media_limit" });
  await db(ctx)
    .prepare("INSERT OR IGNORE INTO listing_media (listing_id, media_id, kind) VALUES (?, ?, ?)")
    .bind(String(row.id), body.mediaId, kind)
    .run();
  return jsonResponse({ ok: true });
}

/** POST /api/market/saved/:listingId — save/unsave (toggle). */
export async function toggleSavedListing(ctx: RouteContext, auth: AuthenticatedContext): Promise<Response> {
  const listingId = ctx.params.listingId!;
  const existing = await db(ctx)
    .prepare("SELECT listing_id FROM market_saved_item WHERE identity_id = ? AND listing_id = ?")
    .bind(auth.identityId, listingId)
    .first();
  if (existing) {
    await db(ctx)
      .prepare("DELETE FROM market_saved_item WHERE identity_id = ? AND listing_id = ?")
      .bind(auth.identityId, listingId)
      .run();
    return jsonResponse({ saved: false });
  }
  await db(ctx)
    .prepare("INSERT INTO market_saved_item (identity_id, listing_id, created_at) VALUES (?, ?, ?)")
    .bind(auth.identityId, listingId, nowMs())
    .run();
  return jsonResponse({ saved: true });
}

/** POST /api/market/report — report a listing (never auto-mutates it). */
export async function reportListing(ctx: RouteContext, auth: AuthenticatedContext): Promise<Response> {
  const body = (await readJsonBody(ctx.request)) as { listingId?: string; reason?: string; details?: string };
  const reasons = ["misleading", "out_of_scope", "spam", "contact_issue", "other"];
  if (
    typeof body.listingId !== "string" ||
    typeof body.reason !== "string" ||
    !reasons.includes(body.reason)
  ) {
    throw new HttpError(400, "bad_request", { field: "report" });
  }
  const now = nowMs();
  await db(ctx)
    .prepare(
      "INSERT INTO market_report (reporter_identity_id, object_type, object_id, reason, details, created_at) VALUES (?, 'supplier_listing', ?, ?, ?, ?)",
    )
    .bind(
      auth.identityId,
      body.listingId,
      body.reason,
      typeof body.details === "string" ? body.details.slice(0, 1000) : null,
      now,
    )
    .run();
  await notify(
    db(ctx),
    {
      identityId: auth.identityId,
      type: "report_replied",
      targetPath: "/market",
      idempotencyKey: `report:${body.listingId}:${auth.identityId}`,
    },
    now,
  ).catch(() => undefined);
  return jsonResponse({ ok: true }, 201);
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
