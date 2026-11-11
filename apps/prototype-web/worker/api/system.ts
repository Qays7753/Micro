/**
 * System API: in-app notifications list + read marking (contract 19).
 * Opening a notification never mutates any other state.
 */

import { listNotifications, notify, isNotificationType } from "../audit.ts";
import { nowMs } from "../clock.ts";
import { HttpError, jsonResponse } from "../http.ts";
import { readJsonBody, type RouteContext } from "../router.ts";
import type { AuthenticatedContext } from "../auth/session.ts";
import type { Db } from "../db/d1.ts";

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
