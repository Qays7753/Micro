/**
 * Media API: authorized upload/read/delete of private R2 objects.
 * Reads ALWAYS pass server-side authorization: owner, admin reviewer, or
 * public attachment to a currently published listing (images only).
 */

import { audit } from "../audit.ts";
import { nowMs } from "../clock.ts";
import { randomToken } from "../crypto.ts";
import { dailyBucket, enforceRate, rateLimits } from "../ratelimit.ts";
import { HttpError, jsonResponse } from "../http.ts";
import {
  deleteMedia,
  findMedia,
  isPubliclyAttachedListingMedia,
  readMediaBody,
  storeMedia,
  type MediaPurpose,
} from "../media.ts";
import type { RouteContext } from "../router.ts";
import type { AuthenticatedContext } from "../auth/session.ts";

const PURPOSES: readonly MediaPurpose[] = ["market_listing_media", "driver_evidence", "driver_vehicle_proof"];

/** POST /api/media?purpose=... — raw-bytes upload with content-type. */
export async function uploadMedia(ctx: RouteContext, auth: AuthenticatedContext): Promise<Response> {
  const purposeParam = ctx.url.searchParams.get("purpose") ?? "";
  if (!(PURPOSES as readonly string[]).includes(purposeParam)) {
    throw new HttpError(400, "bad_request", { field: "purpose" });
  }
  const purpose = purposeParam as MediaPurpose;
  const now = nowMs();
  const limits = await rateLimits(db(ctx));
  await enforceRate(
    db(ctx),
    dailyBucket("media-upload", auth.identityId, now),
    limits.imagesPerDay,
    24 * 60 * 60 * 1000,
    now,
  );
  const contentType = ctx.request.headers.get("content-type") ?? "";
  const bytes = await ctx.request.arrayBuffer();
  const media = await storeMedia(
    ctx.env,
    db(ctx),
    { identityId: auth.identityId, purpose },
    { bytes, contentType },
    now,
    randomToken,
  );
  await audit(
    db(ctx),
    {
      actorIdentityId: auth.identityId,
      action: "media_upload",
      objectType: "media_object",
      objectId: media.id,
      result: "success",
      meta: { purpose, sizeBytes: media.size_bytes },
    },
    now,
  );
  return jsonResponse(
    { media: { id: media.id, purpose: media.purpose, contentType: media.content_type } },
    201,
  );
}

function db(ctx: RouteContext) {
  return ctx.env.DB;
}

/** GET /api/media/:id — authorized read (public listing media is cacheable). */
export async function readMedia(ctx: RouteContext, auth: AuthenticatedContext | null): Promise<Response> {
  const media = await findMedia(db(ctx), ctx.params.id!);
  if (!media) throw new HttpError(404, "not_found");
  const isOwner = auth !== null && auth.identityId === media.owner_identity_id;
  const isAdmin = auth?.isAdmin === true;
  const isPublicListingImage =
    media.purpose === "market_listing_media" && (await isPubliclyAttachedListingMedia(db(ctx), media.id));
  if (!isOwner && !isAdmin && !isPublicListingImage) {
    throw new HttpError(404, "not_found");
  }
  if (auth !== null && !isOwner) {
    // Any authenticated non-owner read (reviewer or signed-in reader) is audited.
    await audit(
      db(ctx),
      {
        actorIdentityId: auth.identityId,
        action: "media_read",
        objectType: "media_object",
        objectId: media.id,
        result: "success",
      },
      nowMs(),
    );
  }
  const body = await readMediaBody(ctx.env, media);
  if (!body) throw new HttpError(404, "not_found");
  const cacheControl = isPublicListingImage ? "public, max-age=3600" : "private, no-store";
  return new Response(body.body, {
    status: 200,
    headers: {
      "content-type": body.contentType,
      "cache-control": cacheControl,
      "x-content-type-options": "nosniff",
    },
  });
}

/** DELETE /api/media/:id — owner cleanup of pending/rejected drafts (or an
 * audited admin moderation removal). Media still attached to a listing or an
 * evidence/vehicle record is never deleted — that would corrupt the record
 * and strip a published listing's imagery without review. */
export async function removeMedia(ctx: RouteContext, auth: AuthenticatedContext): Promise<Response> {
  const media = await findMedia(db(ctx), ctx.params.id!);
  if (!media) throw new HttpError(404, "not_found");
  const isOwner = media.owner_identity_id === auth.identityId;
  if (!isOwner && !auth.isAdmin) throw new HttpError(404, "not_found");
  // Referenced media is in use (FK would also reject the raw delete — answer
  // honestly with a 409 instead of a 500).
  const referenced = await db(ctx)
    .prepare(
      "SELECT (SELECT COUNT(*) FROM listing_media WHERE media_id = ?) + " +
        "(SELECT COUNT(*) FROM driver_evidence WHERE media_id = ?) + " +
        "(SELECT COUNT(*) FROM driver_vehicle WHERE ownership_proof_media_id = ?) AS n",
    )
    .bind(media.id, media.id, media.id)
    .first<Record<string, unknown>>();
  if (Number(referenced?.n ?? 0) > 0) {
    throw new HttpError(409, "conflict", { reason: "media_in_use" });
  }
  if (isOwner && !auth.isAdmin && media.status === "approved") {
    // Approved media can only be removed through moderation, never by the
    // owner directly (the publication gate owns approved components).
    throw new HttpError(409, "conflict", { reason: "approved_media_requires_moderation" });
  }
  if (!isOwner && auth.isAdmin) {
    // Admin removal is an audited moderation action.
    await audit(
      db(ctx),
      {
        actorIdentityId: auth.identityId,
        action: "media_admin_delete",
        objectType: "media_object",
        objectId: media.id,
        result: "success",
      },
      nowMs(),
    );
  }
  await deleteMedia(ctx.env, db(ctx), media);
  return jsonResponse({ ok: true });
}
