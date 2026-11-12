/**
 * Append-only audit trail (contract 22 §4) and in-app notifications
 * (contract 19 — closed type set, in-app only, no external providers).
 * PII and tokens are never placed in meta payloads.
 */

import type { Db } from "./db/d1.ts";

export async function audit(
  db: Db,
  entry: {
    actorIdentityId: string | null;
    action: string;
    objectType: string;
    objectId: string | null;
    result: "success" | "denied" | "error";
    meta?: Record<string, unknown>;
  },
  now: number,
): Promise<void> {
  const safeMeta = entry.meta === undefined ? null : JSON.stringify(entry.meta);
  await db
    .prepare(
      "INSERT INTO network_audit_event (actor_identity_id, action, object_type, object_id, result, created_at, meta_json) " +
        "VALUES (?, ?, ?, ?, ?, ?, ?)",
    )
    .bind(entry.actorIdentityId, entry.action, entry.objectType, entry.objectId, entry.result, now, safeMeta)
    .run();
}

/** Contract 19 §9 notification types (closed set — delivery model). */
export const DELIVERY_NOTIFICATION_TYPES = [
  "booking_request_received",
  "quote_submitted",
  "quote_expiring",
  "quote_expired",
  "booking_outcome",
  "booking_modified",
  "consent_proposed",
  "declaration_recorded",
  "confirmation_requested",
  "daily_statement_submitted",
  "driver_review_decision",
  "evidence_expiry_reminder",
  "objection_recorded",
  "report_replied",
  "status_changed",
] as const;

/** Contract 19 §9 notification types (market model). */
export const MARKET_NOTIFICATION_TYPES = [
  "moderation_decision",
  "vendor_file_decision",
  "attention_promotion",
  "listing_freshness_reminder",
  "listing_expired",
] as const;

export type NotificationType =
  (typeof DELIVERY_NOTIFICATION_TYPES)[number] | (typeof MARKET_NOTIFICATION_TYPES)[number];

export function isNotificationType(value: string): value is NotificationType {
  return (
    (DELIVERY_NOTIFICATION_TYPES as readonly string[]).includes(value) ||
    (MARKET_NOTIFICATION_TYPES as readonly string[]).includes(value)
  );
}

export async function notify(
  db: Db,
  entry: {
    identityId: string;
    type: NotificationType;
    targetPath: string;
    payload?: Record<string, unknown>;
    idempotencyKey: string;
  },
  now: number,
): Promise<void> {
  const payload = entry.payload === undefined ? null : JSON.stringify(entry.payload);
  await db
    .prepare(
      "INSERT OR IGNORE INTO network_notification (identity_id, type, target_path, payload_json, created_at, idempotency_key) " +
        "VALUES (?, ?, ?, ?, ?, ?)",
    )
    .bind(entry.identityId, entry.type, entry.targetPath, payload, now, entry.idempotencyKey)
    .run();
}

/** List a recipient's notifications (newest first, bounded page). */
export async function listNotifications(db: Db, identityId: string, limit: number) {
  const rows = await db
    .prepare(
      "SELECT id, type, target_path, payload_json, read_at, created_at FROM network_notification " +
        "WHERE identity_id = ? ORDER BY created_at DESC, id DESC LIMIT ?",
    )
    .bind(identityId, limit)
    .all<Record<string, unknown>>();
  return rows.results.map(row => ({
    id: Number(row.id),
    type: String(row.type),
    targetPath: String(row.target_path),
    payload:
      row.payload_json === null ? null : (JSON.parse(String(row.payload_json)) as Record<string, unknown>),
    readAt: row.read_at === null ? null : Number(row.read_at),
    createdAt: Number(row.created_at),
  }));
}
