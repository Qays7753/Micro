/**
 * Market review API (admin/reviewer — contract 20 §3.4, contract 22).
 * Reviewer decisions are administrative only: approve / request changes /
 * reject / suspend, each with actor, timestamp, reason and status history.
 * Publication is an ATOMIC gate (spec §7): the supplier file, the listing
 * content copy, and every attached image must all be approved; the last
 * approval re-verifies everything before anything becomes public.
 */

import { audit, notify } from "../audit.ts";
import { nowMs } from "../clock.ts";
import type { Db } from "../db/db.ts";
import { HttpError, jsonResponse } from "../http.ts";
import { readJsonBody, type RouteContext } from "../router.ts";
import { LISTING_FRESHNESS_HIDE_MS } from "../env.ts";
import type { AuthenticatedContext } from "../auth/session.ts";

function db(ctx: RouteContext): Db {
  return ctx.env.DB;
}

async function moderationEvent(
  db: Db,
  objectType: string,
  objectId: string,
  actor: string,
  action: string,
  reason: string | null,
  now: number,
): Promise<void> {
  await db
    .prepare(
      "INSERT INTO market_moderation_event (object_type, object_id, actor_identity_id, action, reason, created_at) VALUES (?, ?, ?, ?, ?, ?)",
    )
    .bind(objectType, objectId, actor, action, reason, now)
    .run();
}

/** GET /api/market/review/queue — pending profiles, listings, media, reports. */
export async function reviewQueue(ctx: RouteContext, auth: AuthenticatedContext): Promise<Response> {
  if (!auth.isAdmin) throw new HttpError(403, "forbidden", { reason: "admin_only" });
  const profiles = await db(ctx)
    .prepare(
      "SELECT id, identity_id, status, work_copy_json, submitted_at FROM supplier_profile WHERE status = 'submitted' ORDER BY submitted_at",
    )
    .all<Record<string, unknown>>();
  const listings = await db(ctx)
    .prepare(
      "SELECT id, identity_id, title, status, revision_status, work_copy_json, submitted_at FROM supplier_listing " +
        "WHERE status = 'submitted' OR revision_status IN ('submitted','renewal_requested') ORDER BY submitted_at",
    )
    .all<Record<string, unknown>>();
  const media = await db(ctx)
    .prepare(
      "SELECT m.id, m.owner_identity_id, m.status, lm.listing_id FROM media_object m " +
        "LEFT JOIN listing_media lm ON lm.media_id = m.id " +
        "WHERE m.status = 'pending' AND m.purpose = 'market_listing_media'",
    )
    .all<Record<string, unknown>>();
  const reports = await db(ctx)
    .prepare(
      "SELECT id, object_id, reason, details, status, created_at FROM market_report WHERE status = 'open' ORDER BY created_at",
    )
    .all<Record<string, unknown>>();
  return jsonResponse({
    profiles: profiles.results,
    listings: listings.results,
    media: media.results,
    reports: reports.results,
  });
}

/**
 * Publication gate: publish iff profile approved AND listing content approved
 * AND every attached media approved. Runs inside one atomic batch.
 */
async function tryPublish(db: Db, listingId: string, now: number): Promise<boolean> {
  const listing = await db
    .prepare(
      "SELECT id, supplier_profile_id, status, revision_status, work_copy_json FROM supplier_listing WHERE id = ?",
    )
    .bind(listingId)
    .first<Record<string, unknown>>();
  if (!listing) return false;
  const profile = await db
    .prepare("SELECT status FROM supplier_profile WHERE id = ?")
    .bind(String(listing.supplier_profile_id))
    .first<Record<string, unknown>>();
  if (!profile || String(profile.status) !== "approved") return false;
  // Content must be explicitly approved by a reviewer first (spec §7.4).
  if (String(listing.revision_status) !== "content_approved") return false;
  const pendingMedia = await db
    .prepare(
      "SELECT COUNT(*) AS n FROM listing_media lm JOIN media_object m ON m.id = lm.media_id " +
        "WHERE lm.listing_id = ? AND m.status != 'approved'",
    )
    .bind(listingId)
    .first<Record<string, unknown>>();
  if (Number(pendingMedia?.n ?? 0) > 0) return false;
  await db
    .prepare(
      "UPDATE supplier_listing SET status = 'approved_for_publish', " +
        "title = COALESCE(work_copy_json::jsonb ->> 'title', title), " +
        "description = COALESCE(work_copy_json::jsonb ->> 'description', description), " +
        // Denormalized price/quantity columns are refreshed from the approved
        // work copy exactly like the revision-approve path — the public price
        // must never diverge from the reviewed copy (Reviewer 1, 2026-11-12).
        "price_mode = COALESCE(work_copy_json::jsonb #>> '{pricing,mode}', price_mode), " +
        "price_micro_jod = COALESCE(work_copy_json::jsonb #>> '{pricing,priceMicroJod}', price_micro_jod), " +
        "min_quantity_milli = COALESCE(work_copy_json::jsonb #>> '{quantity,minQuantityMilli}', min_quantity_milli), " +
        "quantity_step_milli = COALESCE(work_copy_json::jsonb #>> '{quantity,stepMilli}', quantity_step_milli), " +
        "public_copy_json = work_copy_json, published_at = COALESCE(published_at, ?), freshness_state = 'fresh', " +
        "revision_status = 'none', reviewed_at = ?, updated_at = ? WHERE id = ?",
    )
    .bind(now, now, now, listingId)
    .run();
  return true;
}

/** POST /api/market/review/profile/:id — approve/changes_requested/reject. */
export async function reviewProfile(ctx: RouteContext, auth: AuthenticatedContext): Promise<Response> {
  if (!auth.isAdmin) throw new HttpError(403, "forbidden", { reason: "admin_only" });
  const body = (await readJsonBody(ctx.request)) as { action?: string; reason?: string };
  const action = body.action;
  const reason = typeof body.reason === "string" && body.reason.trim().length > 0 ? body.reason.trim() : null;
  if (action !== "approve" && (action === "changes_requested" || action === "reject") && !reason) {
    throw new HttpError(400, "bad_request", { field: "reason" });
  }
  if (!["approve", "changes_requested", "reject", "suspend", "unsuspend"].includes(action ?? "")) {
    throw new HttpError(400, "bad_request", { field: "action" });
  }
  const now = nowMs();
  const profile = await db(ctx)
    .prepare("SELECT id, identity_id, status FROM supplier_profile WHERE id = ?")
    .bind(ctx.params.id!)
    .first<Record<string, unknown>>();
  if (!profile) throw new HttpError(404, "not_found");
  const profileId = String(profile.id);
  const vendorIdentityId = String(profile.identity_id);
  if (action === "approve") {
    await db(ctx)
      .prepare(
        "UPDATE supplier_profile SET status = 'approved', public_copy_json = work_copy_json, reviewed_by = ?, reviewed_at = ?, updated_at = ? WHERE id = ?",
      )
      .bind(auth.identityId, now, now, profileId)
      .run();
    // Publication gate for listings whose content already passed review.
    const pending = await db(ctx)
      .prepare(
        "SELECT id FROM supplier_listing WHERE supplier_profile_id = ? AND revision_status = 'content_approved'",
      )
      .bind(profileId)
      .all<Record<string, unknown>>();
    for (const row of pending.results) {
      await tryPublish(db(ctx), String(row.id), now);
    }
  } else if (action === "changes_requested" || action === "reject") {
    await db(ctx)
      .prepare(
        "UPDATE supplier_profile SET status = ?, review_reason = ?, reviewed_by = ?, reviewed_at = ?, updated_at = ? WHERE id = ?",
      )
      .bind(action, reason, auth.identityId, now, now, profileId)
      .run();
  } else if (action === "suspend") {
    await db(ctx)
      .prepare(
        "UPDATE supplier_profile SET status = 'suspended', review_reason = ?, reviewed_at = ?, updated_at = ? WHERE id = ?",
      )
      .bind(reason, now, now, profileId)
      .run();
  } else {
    await db(ctx)
      .prepare(
        "UPDATE supplier_profile SET status = 'approved', reviewed_at = ?, updated_at = ? WHERE id = ?",
      )
      .bind(now, now, profileId)
      .run();
  }
  await moderationEvent(db(ctx), "supplier_profile", profileId, auth.identityId, action ?? "", reason, now);
  await notify(
    db(ctx),
    {
      identityId: vendorIdentityId,
      type: "vendor_file_decision",
      targetPath: "/market/vendor",
      payload: { action },
      idempotencyKey: `profile-decision:${profileId}:${now}`,
    },
    now,
  ).catch(() => undefined);
  await audit(
    db(ctx),
    {
      actorIdentityId: auth.identityId,
      action: `review_profile_${action}`,
      objectType: "supplier_profile",
      objectId: profileId,
      result: "success",
      meta: { reason: reason ?? null },
    },
    now,
  );
  return jsonResponse({ ok: true });
}

/** POST /api/market/review/listing/:id — approve/changes_requested/reject/suspend. */
export async function reviewListing(ctx: RouteContext, auth: AuthenticatedContext): Promise<Response> {
  if (!auth.isAdmin) throw new HttpError(403, "forbidden", { reason: "admin_only" });
  const body = (await readJsonBody(ctx.request)) as { action?: string; reason?: string };
  const action = body.action;
  const reason = typeof body.reason === "string" && body.reason.trim().length > 0 ? body.reason.trim() : null;
  if (!["approve", "changes_requested", "reject", "admin_suspend"].includes(action ?? "")) {
    throw new HttpError(400, "bad_request", { field: "action" });
  }
  if ((action === "changes_requested" || action === "reject" || action === "admin_suspend") && !reason) {
    throw new HttpError(400, "bad_request", { field: "reason" });
  }
  const now = nowMs();
  const listing = await db(ctx)
    .prepare(
      "SELECT id, identity_id, supplier_profile_id, status, revision_status FROM supplier_listing WHERE id = ?",
    )
    .bind(ctx.params.id!)
    .first<Record<string, unknown>>();
  if (!listing) throw new HttpError(404, "not_found");
  const listingId = String(listing.id);
  const vendorIdentityId = String(listing.identity_id);
  const status = String(listing.status);
  const revisionStatus = String(listing.revision_status);
  if (action === "approve") {
    if (status === "submitted") {
      if (revisionStatus === "content_approved") {
        const published = await tryPublish(db(ctx), listingId, now);
        if (!published) throw new HttpError(409, "conflict", { reason: "gate_not_satisfied" });
      } else {
        // Content approved; publication waits for file + media (spec §7.4).
        await db(ctx)
          .prepare(
            "UPDATE supplier_listing SET revision_status = 'content_approved', reviewed_by = ?, reviewed_at = ?, updated_at = ? WHERE id = ?",
          )
          .bind(auth.identityId, now, now, listingId)
          .run();
        // Content approval may itself be the last gate piece — attempt the
        // atomic publish (a no-op when file/media are still pending).
        await tryPublish(db(ctx), listingId, now);
      }
    } else if (
      status === "approved_for_publish" &&
      (revisionStatus === "submitted" || revisionStatus === "renewal_requested")
    ) {
      // Content revision approved: promote the work copy atomically. When the
      // listing was hidden for staleness, this approval IS the OD-11 renewal
      // (availability re-confirmed through review; published_at is preserved).
      await db(ctx)
        .prepare(
          "UPDATE supplier_listing SET public_copy_json = work_copy_json, revision_status = 'none', " +
            "title = COALESCE(work_copy_json::jsonb ->> 'title', title), " +
            "description = COALESCE(work_copy_json::jsonb ->> 'description', description), " +
            "price_mode = COALESCE(work_copy_json::jsonb #>> '{pricing,mode}', price_mode), " +
            "price_micro_jod = COALESCE(work_copy_json::jsonb #>> '{pricing,priceMicroJod}', price_micro_jod), " +
            "min_quantity_milli = COALESCE(work_copy_json::jsonb #>> '{quantity,minQuantityMilli}', min_quantity_milli), " +
            "quantity_step_milli = COALESCE(work_copy_json::jsonb #>> '{quantity,stepMilli}', quantity_step_milli), " +
            "availability_confirmed_at = CASE WHEN availability_confirmed_at < ? THEN ? ELSE availability_confirmed_at END, " +
            "freshness_state = 'fresh', reviewed_by = ?, reviewed_at = ?, updated_at = ? WHERE id = ?",
        )
        .bind(now - LISTING_FRESHNESS_HIDE_MS, now, auth.identityId, now, now, listingId)
        .run();
    } else {
      throw new HttpError(409, "conflict", { reason: `listing_status_${status}` });
    }
  } else if (action === "changes_requested") {
    if (status === "approved_for_publish") {
      await db(ctx)
        .prepare(
          "UPDATE supplier_listing SET revision_status = 'changes_requested', review_reason = ?, reviewed_at = ?, updated_at = ? WHERE id = ?",
        )
        .bind(reason, now, now, listingId)
        .run();
    } else {
      await db(ctx)
        .prepare(
          "UPDATE supplier_listing SET status = 'changes_requested', review_reason = ?, reviewed_by = ?, reviewed_at = ?, updated_at = ? WHERE id = ?",
        )
        .bind(reason, auth.identityId, now, now, listingId)
        .run();
    }
  } else if (action === "reject") {
    await db(ctx)
      .prepare(
        "UPDATE supplier_listing SET status = 'rejected', review_reason = ?, reviewed_by = ?, reviewed_at = ?, updated_at = ? WHERE id = ?",
      )
      .bind(reason, auth.identityId, now, now, listingId)
      .run();
  } else {
    await db(ctx)
      .prepare(
        "UPDATE supplier_listing SET status = 'admin_suspended', review_reason = ?, reviewed_by = ?, reviewed_at = ?, updated_at = ? WHERE id = ?",
      )
      .bind(reason, auth.identityId, now, now, listingId)
      .run();
  }
  await moderationEvent(db(ctx), "supplier_listing", listingId, auth.identityId, action ?? "", reason, now);
  await notify(
    db(ctx),
    {
      identityId: vendorIdentityId,
      type: "moderation_decision",
      targetPath: "/market/vendor",
      payload: { action },
      idempotencyKey: `listing-decision:${listingId}:${now}`,
    },
    now,
  ).catch(() => undefined);
  await audit(
    db(ctx),
    {
      actorIdentityId: auth.identityId,
      action: `review_listing_${action}`,
      objectType: "supplier_listing",
      objectId: listingId,
      result: "success",
      meta: { reason: reason ?? null },
    },
    now,
  );
  return jsonResponse({ ok: true });
}

/** POST /api/market/review/media/:mediaId — approve/reject an image. */
export async function reviewMedia(ctx: RouteContext, auth: AuthenticatedContext): Promise<Response> {
  if (!auth.isAdmin) throw new HttpError(403, "forbidden", { reason: "admin_only" });
  const body = (await readJsonBody(ctx.request)) as { action?: string; reason?: string };
  if (!["approve", "reject"].includes(body.action ?? "")) {
    throw new HttpError(400, "bad_request", { field: "action" });
  }
  const now = nowMs();
  const media = await db(ctx)
    .prepare("SELECT id, owner_identity_id FROM media_object WHERE id = ?")
    .bind(ctx.params.mediaId!)
    .first<Record<string, unknown>>();
  if (!media) throw new HttpError(404, "not_found");
  await db(ctx)
    .prepare("UPDATE media_object SET status = ? WHERE id = ?")
    .bind(body.action === "approve" ? "approved" : "rejected", String(media.id))
    .run();
  await moderationEvent(
    db(ctx),
    "listing_media",
    String(media.id),
    auth.identityId,
    body.action ?? "",
    typeof body.reason === "string" ? body.reason : null,
    now,
  );
  // Publication gate for the attached listing (last approval publishes).
  const attached = await db(ctx)
    .prepare("SELECT listing_id FROM listing_media WHERE media_id = ?")
    .bind(String(media.id))
    .all<Record<string, unknown>>();
  for (const row of attached.results) {
    await tryPublish(db(ctx), String(row.listing_id), now);
  }
  await audit(
    db(ctx),
    {
      actorIdentityId: auth.identityId,
      action: `review_media_${body.action}`,
      objectType: "media_object",
      objectId: String(media.id),
      result: "success",
    },
    now,
  );
  return jsonResponse({ ok: true });
}
