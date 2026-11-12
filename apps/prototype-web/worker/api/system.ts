/**
 * System API: in-app notifications list + read marking (contract 19).
 * Opening a notification never mutates any other state.
 */

import { audit, listNotifications, notify, isNotificationType } from "../audit.ts";
import { nowMs } from "../clock.ts";
import { putSetting, type Db } from "../db/d1.ts";
import { HttpError, jsonResponse } from "../http.ts";
import { readJsonBody, type RouteContext } from "../router.ts";
import type { AuthenticatedContext } from "../auth/session.ts";

/** GET /api/notifications — the recipient's in-app inbox (bounded). */
export async function listMyNotifications(db: Db, auth: AuthenticatedContext): Promise<Response> {
  const items = await listNotifications(db, auth.identityId, 100);
  return jsonResponse({ notifications: items });
}

/** POST /api/notifications/read — mark specific notifications read. */
export async function markNotificationsRead(
  db: Db,
  ctx: RouteContext,
  auth: AuthenticatedContext,
): Promise<Response> {
  const body = (await readJsonBody(ctx.request)) as { ids?: unknown };
  if (!Array.isArray(body.ids) || body.ids.length === 0 || body.ids.length > 100) {
    throw new HttpError(400, "bad_request", { field: "ids" });
  }
  const ids = body.ids.filter((id): id is number => typeof id === "number" && Number.isInteger(id) && id > 0);
  const now = nowMs();
  for (const id of ids) {
    await db
      .prepare(
        "UPDATE network_notification SET read_at = ? WHERE id = ? AND identity_id = ? AND read_at IS NULL",
      )
      .bind(now, id, auth.identityId)
      .run();
  }
  return jsonResponse({ ok: true, updated: ids.length });
}

/** Development/test helper used by the harness to seed a notification. */
export async function seedNotificationForTests(
  db: Db,
  entry: { identityId: string; type: string; targetPath: string; idempotencyKey: string },
): Promise<void> {
  if (!isNotificationType(entry.type)) throw new HttpError(400, "bad_request", { field: "type" });
  await notify(db, { ...entry, type: entry.type as never, payload: { seeded: true } }, nowMs());
}

/** Settings the admin may flip in-product (documented owner actions).
 * EX-O14: recipient disclosure stays "blocked" until the owner/legal consent
 * decision; rate limits are engineering references (EX-O16) — final pilot
 * values remain an owner action. Anything outside this allowlist is not
 * settable through the API. */
const ADMIN_SETTINGS_ALLOWLIST: Record<string, (value: unknown) => unknown> = {
  "disclosure.recipient": value => {
    if (value !== "blocked" && value !== "allowed_after_acceptance") {
      throw new HttpError(400, "bad_request", { field: "value", reason: "invalid_disclosure_value" });
    }
    return { recipient_details_to_driver: value };
  },
  "rate.limits": value => {
    if (value === null || typeof value !== "object" || Array.isArray(value)) {
      throw new HttpError(400, "bad_request", { field: "value", reason: "invalid_rate_limits" });
    }
    const parsed = value as Record<string, unknown>;
    const out: Record<string, number> = {};
    for (const key of [
      "submissionsPerDay",
      "imagesPerDay",
      "reportsPerDay",
      "guestReadsPerMinute",
      "authStartsPerMinute",
    ]) {
      const raw = parsed[key];
      if (raw === undefined) continue;
      if (typeof raw !== "number" || !Number.isInteger(raw) || raw < 1 || raw > 1_000_000) {
        throw new HttpError(400, "bad_request", { field: `value.${key}` });
      }
      out[key] = raw;
    }
    if (Object.keys(out).length === 0) {
      throw new HttpError(400, "bad_request", { field: "value", reason: "no_valid_limits" });
    }
    return out;
  },
};

/** PUT /api/admin/settings/:key — admin-only, allowlisted network settings. */
export async function putAdminSetting(
  db: Db,
  ctx: RouteContext,
  auth: AuthenticatedContext,
): Promise<Response> {
  if (!auth.isAdmin) throw new HttpError(403, "forbidden", { reason: "admin_only" });
  const key = ctx.params.key!;
  const transform = ADMIN_SETTINGS_ALLOWLIST[key];
  if (transform === undefined) throw new HttpError(404, "not_found");
  const body = (await readJsonBody(ctx.request)) as { value?: unknown };
  const value = transform(body.value);
  const now = nowMs();
  await putSetting(db, key, value, auth.identityId, now);
  await audit(
    db,
    {
      actorIdentityId: auth.identityId,
      action: "admin_setting_update",
      objectType: "network_settings",
      objectId: key,
      result: "success",
      meta: { key },
    },
    now,
  );
  return jsonResponse({ ok: true, key, value });
}
