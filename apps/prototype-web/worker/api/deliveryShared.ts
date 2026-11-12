/**
 * Shared delivery helpers: event recording, driver notification, and the
 * frozen agreement-copy builder (OD11).
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
      "pricing_mode, offered_fare_minor, status, agreement_copy_json, response_deadline_at, quote_id, created_at " +
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
