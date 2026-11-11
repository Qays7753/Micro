/**
 * Private media handling (R2 + D1 metadata).
 * Objects are private by default; every read is authorized server-side and
 * mediated by the worker (`/api/media/:id`) — no public bucket, no public
 * URLs, no long-lived signed URLs. Keys are random and non-guessable; PII
 * never appears in keys or logs.
 */

import { randomObjectKeySegment } from "./crypto.ts";
import { ALLOWED_MEDIA_TYPES, MAX_MEDIA_BYTES, type Env, type R2Bucket } from "./env.ts";
import { HttpError } from "./http.ts";
import { newId, type Db } from "./db/d1.ts";

export type MediaPurpose = "market_listing_media" | "driver_evidence" | "driver_vehicle_proof";

export interface MediaObjectRow {
  id: string;
  r2_key: string;
  owner_identity_id: string;
  purpose: MediaPurpose;
  content_type: string;
  size_bytes: number;
  status: "pending" | "approved" | "rejected";
  created_at: number;
}

function bucket(env: Env): R2Bucket {
  if (!env.MEDIA) throw new HttpError(503, "network_not_configured", { binding: "MEDIA" });
  return env.MEDIA;
}

/**
 * Store an uploaded object. Authorization (who may upload which purpose) is
 * enforced by the API layer before calling this; this function performs
 * format/size validation and writes bytes + metadata atomically enough for
 * the worker (metadata write failure after R2 put leaves an orphan object —
 * harmless: keys are random and unreferenced objects are unreadable).
 */
export async function storeMedia(
  env: Env,
  db: Db,
  owner: { identityId: string; purpose: MediaPurpose },
  file: { bytes: ArrayBuffer; contentType: string },
  now: number,
  randomToken: () => string,
): Promise<MediaObjectRow> {
  if (!(ALLOWED_MEDIA_TYPES as readonly string[]).includes(file.contentType)) {
    throw new HttpError(400, "bad_request", { field: "content_type" });
  }
  if (file.bytes.byteLength === 0 || file.bytes.byteLength > MAX_MEDIA_BYTES) {
    throw new HttpError(400, "bad_request", { field: "size", maxBytes: MAX_MEDIA_BYTES });
  }
  const key = `media/${owner.purpose}/${randomObjectKeySegment()}`;
  await bucket(env).put(key, file.bytes, { httpMetadata: { contentType: file.contentType } });
  const row: MediaObjectRow = {
    id: newId("med", randomToken),
    r2_key: key,
    owner_identity_id: owner.identityId,
    purpose: owner.purpose,
    content_type: file.contentType,
    size_bytes: file.bytes.byteLength,
    status: "pending",
    created_at: now,
  };
  await db
    .prepare(
      "INSERT INTO media_object (id, r2_key, owner_identity_id, purpose, content_type, size_bytes, status, created_at) " +
        "VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
    )
    .bind(
      row.id,
      row.r2_key,
      row.owner_identity_id,
      row.purpose,
      row.content_type,
      row.size_bytes,
      row.status,
      now,
    )
    .run();
  return row;
}

export async function findMedia(db: Db, mediaId: string): Promise<MediaObjectRow | null> {
  const row = await db
    .prepare(
      "SELECT id, r2_key, owner_identity_id, purpose, content_type, size_bytes, status, created_at " +
        "FROM media_object WHERE id = ?",
    )
    .bind(mediaId)
    .first<Record<string, unknown>>();
  if (!row) return null;
  return {
    id: String(row.id),
    r2_key: String(row.r2_key),
    owner_identity_id: String(row.owner_identity_id),
    purpose: row.purpose as MediaPurpose,
    content_type: String(row.content_type),
    size_bytes: Number(row.size_bytes),
    status: row.status as MediaObjectRow["status"],
    created_at: Number(row.created_at),
  };
}

/** Authorized read: returns the object body (caller enforces authorization). */
export async function readMediaBody(
  env: Env,
  media: MediaObjectRow,
): Promise<{ body: ReadableStream; contentType: string } | null> {
  const object = await bucket(env).get(media.r2_key);
  if (!object) return null;
  return { body: object.body, contentType: media.content_type };
}

/** Delete bytes + metadata (draft cleanup / admin removal). */
export async function deleteMedia(env: Env, db: Db, media: MediaObjectRow): Promise<void> {
  await bucket(env).delete(media.r2_key);
  await db.prepare("DELETE FROM media_object WHERE id = ?").bind(media.id).run();
}

/**
 * Is this media object publicly readable? Only when it is gallery/cover media
 * attached to a listing whose CURRENT public copy is published (OD-04/OD-09).
 */
export async function isPubliclyAttachedListingMedia(db: Db, mediaId: string): Promise<boolean> {
  const row = await db
    .prepare(
      "SELECT l.status FROM listing_media lm JOIN supplier_listing l ON l.id = lm.listing_id " +
        "WHERE lm.media_id = ? LIMIT 1",
    )
    .bind(mediaId)
    .first<Record<string, unknown>>();
  return row !== null && String(row.status) === "approved_for_publish";
}
