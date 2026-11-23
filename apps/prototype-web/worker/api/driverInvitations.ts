/**
 * Driver application invitations (F-13, S12 scan — OD22: self-application
 * AND invitation are both available). An invitation grants CONTEXT ONLY:
 * consuming it never activates the driver, never skips قيس's review, never
 * creates a membership, and never creates a second account — the person
 * signs in with the SAME shared Micro identity (AT38) and then applies
 * through the normal reviewed path (profile + vehicle + evidence → admin
 * review → approval before any new bookings).
 *
 * Documented engineering choices from the approved delivery spec (OD22
 * note): the issuer is قيس (admin) — the "authorized project owner" issuer
 * waits for the delivery contract rework; the code is a random token stored
 * as-is (the table stores the code — never a password hash, it IS the
 * bearer secret); default validity 7 days; revocable; single-use — it binds
 * exactly ONE identity. A missing/expired/cancelled invitation NEVER blocks
 * self-application.
 */

import { audit } from "../audit.ts";
import { nowMs } from "../clock.ts";
import { randomToken } from "../crypto.ts";
import type { Db } from "../db/db.ts";
import { HttpError, jsonResponse } from "../http.ts";
import { readJsonBody, type RouteContext } from "../router.ts";
import type { AuthenticatedContext } from "../auth/session.ts";

const DAY_MS = 24 * 60 * 60 * 1000;
const DEFAULT_TTL_DAYS = 7;
const MAX_TTL_DAYS = 30;

function db(ctx: RouteContext): Db {
  return ctx.env.DB;
}

/** POST /api/admin/driver-invitations — قيس issues a single-use invitation. */
export async function createDriverInvitation(
  ctx: RouteContext,
  auth: AuthenticatedContext,
): Promise<Response> {
  if (!auth.isAdmin) throw new HttpError(403, "forbidden", { reason: "admin_only" });
  const body = (await readJsonBody(ctx.request)) as { expiresInDays?: unknown };
  const days = body.expiresInDays === undefined ? DEFAULT_TTL_DAYS : body.expiresInDays;
  if (typeof days !== "number" || !Number.isInteger(days) || days < 1 || days > MAX_TTL_DAYS) {
    throw new HttpError(400, "bad_request", { field: "expiresInDays" });
  }
  const now = nowMs();
  const code = `dinv_${randomToken(24)}`;
  const expiresAt = now + days * DAY_MS;
  await db(ctx)
    .prepare(
      "INSERT INTO driver_invitation (code, created_by_identity_id, created_at, expires_at) VALUES (?, ?, ?, ?)",
    )
    .bind(code, auth.identityId, now, expiresAt)
    .run();
  await audit(
    db(ctx),
    {
      actorIdentityId: auth.identityId,
      action: "driver_invitation_created",
      objectType: "driver_invitation",
      objectId: code,
      result: "success",
      meta: { expiresAt },
    },
    now,
  );
  return jsonResponse({ invitation: { code, expiresAt } }, 201);
}

/** POST /api/driver/invitation/:code — consume with the signed-in identity. */
export async function consumeDriverInvitation(
  ctx: RouteContext,
  auth: AuthenticatedContext,
): Promise<Response> {
  const code = ctx.params.code!;
  const now = nowMs();
  const row = await db(ctx)
    .prepare("SELECT code, expires_at, used_at FROM driver_invitation WHERE code = ?")
    .bind(code)
    .first<Record<string, unknown>>();
  if (!row) throw new HttpError(404, "not_found");
  if (row.used_at !== null && row.used_at !== undefined) {
    throw new HttpError(409, "invitation_already_used");
  }
  const expiresAt = row.expires_at === null ? null : Number(row.expires_at);
  if (expiresAt !== null && expiresAt <= now) {
    throw new HttpError(410, "invitation_expired");
  }
  // Optimistic single-use claim: the conditional UPDATE loses the race when
  // a concurrent request consumed the same code first. Phase F (reviewer 3/4):
  // the claim also re-checks expiry inside the UPDATE, so a cancellation
  // (or natural expiry) landing between the pre-read and the claim can never
  // be raced past.
  const claimed = await db(ctx)
    .prepare(
      "UPDATE driver_invitation SET used_at = ?, used_by_identity_id = ? " +
        "WHERE code = ? AND used_at IS NULL AND (expires_at IS NULL OR expires_at > ?)",
    )
    .bind(now, auth.identityId, code, now)
    .run();
  if (Number(claimed.meta?.changes ?? 0) !== 1) {
    throw new HttpError(409, "invitation_already_used");
  }
  await audit(
    db(ctx),
    {
      actorIdentityId: auth.identityId,
      action: "driver_invitation_consumed",
      objectType: "driver_invitation",
      objectId: code,
      result: "success",
    },
    now,
  );
  // Context ONLY (OD22): no activation, no review skip, no membership — the
  // normal reviewed application path follows separately at the driver's
  // choice; self-application stays open regardless.
  return jsonResponse({ ok: true, invitationContext: true });
}

/** DELETE /api/admin/driver-invitations/:code — revoke (expires NOW).
 * Representation choice (documented): cancellation is stored as an immediate
 * expiry; the audit action distinguishes a cancellation from natural
 * expiry, and a used invitation can no longer be cancelled. */
export async function cancelDriverInvitation(
  ctx: RouteContext,
  auth: AuthenticatedContext,
): Promise<Response> {
  if (!auth.isAdmin) throw new HttpError(403, "forbidden", { reason: "admin_only" });
  const code = ctx.params.code!;
  const now = nowMs();
  const row = await db(ctx)
    .prepare("SELECT code, used_at FROM driver_invitation WHERE code = ?")
    .bind(code)
    .first<Record<string, unknown>>();
  if (!row) throw new HttpError(404, "not_found");
  if (row.used_at !== null && row.used_at !== undefined) {
    throw new HttpError(409, "invitation_already_used");
  }
  // Phase F (reviewer 3): verify the conditional UPDATE actually cancelled a
  // live row — a consume racing between the read and the write returns an
  // honest 409 instead of a silent ok.
  const cancelled = await db(ctx)
    .prepare("UPDATE driver_invitation SET expires_at = ? WHERE code = ? AND used_at IS NULL")
    .bind(now, code)
    .run();
  if (Number(cancelled.meta?.changes ?? 0) !== 1) {
    throw new HttpError(409, "invitation_already_used");
  }
  await audit(
    db(ctx),
    {
      actorIdentityId: auth.identityId,
      action: "driver_invitation_cancelled",
      objectType: "driver_invitation",
      objectId: code,
      result: "success",
    },
    now,
  );
  return jsonResponse({ ok: true });
}
