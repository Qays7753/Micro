/**
 * Shared delivery helpers: event recording, driver notification, the
 * frozen agreement-copy builder (OD11), and the statement money-axis
 * projection (OD13).
 */

import { notify } from "../audit.ts";
import { nowMs } from "../clock.ts";
import type { Db } from "../db/d1.ts";
import type { RouteContext } from "../router.ts";
import { HttpError } from "../http.ts";
import { driverStatus } from "../authorization.ts";
import type { AuthenticatedContext } from "../auth/session.ts";

export async function recordEvent(
  ctx: RouteContext,
  requestId: string,
  axis: string,
  eventType: string,
  from: string | null,
  to: string | null,
  actorIdentityId: string | null,
  reason?: string,
): Promise<void> {
  await ctx.env.DB.prepare(
    "INSERT INTO delivery_event (request_id, actor_identity_id, axis, event_type, from_value, to_value, reason, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
  )
    .bind(requestId, actorIdentityId, axis, eventType, from, to, reason ?? null, nowMs())
    .run();
}

export async function notifyDriver(
  ctx: RouteContext,
  driverProfileId: string,
  type: string,
  requestId: string,
  now: number,
): Promise<void> {
  const driverIdentity = await ctx.env.DB.prepare("SELECT identity_id FROM driver_profile WHERE id = ?")
    .bind(driverProfileId)
    .first<Record<string, unknown>>();
  if (!driverIdentity) return;
  await notify(
    ctx.env.DB,
    {
      identityId: String(driverIdentity.identity_id),
      type: type as never,
      targetPath: `/driver/booking/${requestId}`,
      payload: { requestId },
      idempotencyKey: `${type}:${requestId}:${now}`,
    },
    now,
  ).catch(() => undefined);
}

export async function buildAgreementCopy(
  db: Db,
  row: Record<string, unknown>,
  quoteRow: Record<string, unknown> | null,
  now: number,
): Promise<string> {
  const driverProfile = await db
    .prepare("SELECT public_copy_json FROM driver_profile WHERE id = ?")
    .bind(String(row.driver_profile_id))
    .first<Record<string, unknown>>();
  const requester = await db
    .prepare("SELECT display_name FROM network_identity WHERE id = ?")
    .bind(String(row.requester_identity_id))
    .first<Record<string, unknown>>();
  return JSON.stringify({
    needType: String(row.need_type),
    payload: JSON.parse(String(row.payload_json ?? "{}")),
    fareMinor: quoteRow ? String(quoteRow.fare_minor) : String(row.offered_fare_minor ?? "0"),
    quoteScope: quoteRow ? String(quoteRow.scope_json ?? "") : null,
    collectionMinor:
      row.collection_minor === null || row.collection_minor === undefined
        ? null
        : String(row.collection_minor),
    collectionContent:
      row.collection_content === null || row.collection_content === undefined
        ? null
        : String(row.collection_content),
    driverProfileSnapshot: JSON.parse(String(driverProfile?.public_copy_json ?? "{}")),
    requesterName: String(requester?.display_name ?? ""),
    confirmedAt: now,
  });
}

export async function loadRequest(ctx: RouteContext, requestId: string): Promise<Record<string, unknown>> {
  const row = await ctx.env.DB.prepare(
    "SELECT id, requester_identity_id, driver_profile_id, need_type, payload_json, collection_minor, collection_content, " +
      "pricing_mode, offered_fare_minor, status, agreement_copy_json, agreement_version, response_deadline_at, quote_id, created_at " +
      "FROM delivery_request WHERE id = ?",
  )
    .bind(requestId)
    .first<Record<string, unknown>>();
  if (!row) throw new HttpError(404, "not_found");
  return row;
}

export async function requireDriverProfile(ctx: RouteContext, auth: AuthenticatedContext): Promise<string> {
  const status = await driverStatus(ctx.env.DB, auth.identityId, nowMs());
  if (!status) throw new HttpError(404, "not_found");
  return status.driverProfileId;
}

/** Money-axis projection for a statement's fixed items (OD13, contract 21
 * §3.2-6): advances only the confirmed pair bookings listed in the statement,
 * and never re-opens an already-decided axis (§3.2-7 — re-open needs a
 * documented decision). */
export async function advanceMoneyAxisForItems(
  ctx: RouteContext,
  driverProfileId: string,
  requesterIdentityId: string,
  requestIds: string[],
  status: "statement_submitted" | "full_receipt_confirmed" | "difference_under_review",
  now: number,
): Promise<void> {
  const ids = requestIds.filter(id => id !== "");
  if (ids.length === 0) return;
  const placeholders = ids.map(() => "?").join(", ");
  await ctx.env.DB.prepare(
    `UPDATE delivery_execution SET money_status = ?, updated_at = ? WHERE request_id IN (${placeholders}) ` +
      "AND request_id IN (SELECT id FROM delivery_request WHERE driver_profile_id = ? AND requester_identity_id = ? AND status = 'confirmed') " +
      "AND money_status NOT IN ('full_receipt_confirmed', 'difference_under_review')",
  )
    .bind(status, now, ...ids, driverProfileId, requesterIdentityId)
    .run();
}
