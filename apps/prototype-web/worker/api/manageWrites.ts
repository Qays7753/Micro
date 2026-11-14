/**
 * Manage Online connected writes (EX-D23, wave M4): transactional, idempotent,
 * owner-only upserts over the manage_record store. Conventions reused from the
 * network layer: Idempotency-Key commands (same key + body replays the stored
 * response — never duplicating state), optimistic concurrency via updated_at
 * CAS (a stale basis is an honest 409, never a last-writer-wins merge), and
 * the local write-guard principle translated to the server: the live state is
 * checked INSIDE the write statement itself, so a race can never produce a
 * silent overwrite.
 *
 * "Saved" is returned ONLY after the database statement committed — the client
 * shows success only on this acknowledgement. Money and every other value are
 * stored and returned EXACTLY as given (contract 25 dated note): the network
 * layer performs no computation on manage amounts.
 *
 * No single-record delete exists on this surface by design: corrections follow
 * the local correction conventions (reverse + reason), and family-level
 * replacement/rollback belongs to the migration path (M5).
 */
import { audit } from "../audit.ts";
import type { ManageOwnerContext } from "../authorization.ts";
import { rowString, type Db } from "../db/db.ts";
import { HttpError, jsonResponse } from "../http.ts";
import type { AuthenticatedContext } from "../auth/session.ts";
import type { RouteContext } from "../router.ts";
import { requireManageOwnerAudited } from "./manageReads.ts";

/** Per-record payload bound — generous for any real record, small enough to gate abuse. */
const DATA_JSON_MAX = 256 * 1024;
const RECORD_ID_MAX = 128;
const FAMILY_PATTERN = /^[a-z][a-z0-9-]{1,63}$/;

export async function saveManageRecord(ctx: RouteContext, auth: AuthenticatedContext): Promise<Response> {
  const db = ctx.env.DB;
  const owner: ManageOwnerContext = await requireManageOwnerAudited(db, auth, "manage.write.record");
  const family = ctx.params.family;
  const id = ctx.params.id;
  if (typeof family !== "string" || !FAMILY_PATTERN.test(family)) {
    throw new HttpError(400, "bad_request", { field: "family" });
  }
  if (typeof id !== "string" || id.length === 0 || id.length > RECORD_ID_MAX) {
    throw new HttpError(400, "bad_request", { field: "id" });
  }
  const body = (await ctx.request.json()) as { data?: unknown; expectedUpdatedAt?: unknown };
  if (body.data === null || typeof body.data !== "object" || Array.isArray(body.data)) {
    throw new HttpError(400, "bad_request", { field: "data", reason: "record_must_be_object" });
  }
  const serialized = JSON.stringify(body.data);
  if (serialized.length > DATA_JSON_MAX) {
    throw new HttpError(400, "bad_request", { field: "data", reason: "record_too_large" });
  }
  const expectedUpdatedAt =
    body.expectedUpdatedAt === undefined || body.expectedUpdatedAt === null
      ? null
      : Number(body.expectedUpdatedAt);
  if (body.expectedUpdatedAt != null && !Number.isFinite(expectedUpdatedAt)) {
    throw new HttpError(400, "bad_request", { field: "expectedUpdatedAt" });
  }
  const now = Date.now();
  // The workspace in the record key is ALWAYS the gate's resolution for the
  // caller — a client can never address another workspace's records.
  const workspaceId = owner.workspaceId;

  if (expectedUpdatedAt === null) {
    // CREATE: an existing record is an honest conflict (never an overwrite).
    const inserted = await db
      .prepare(
        "INSERT INTO manage_record (workspace_id, family, record_id, data_json, updated_at) VALUES (?, ?, ?, ?, ?) " +
          "ON CONFLICT (workspace_id, family, record_id) DO NOTHING",
      )
      .bind(workspaceId, family, id, serialized, now)
      .run();
    if (inserted.meta.changes === 0) {
      throw new HttpError(409, "conflict", { reason: "manage_record_exists", field: "id" });
    }
    await audit(
      db,
      {
        actorIdentityId: auth.identityId,
        action: "manage.write.record",
        objectType: "manage_record",
        objectId: `${family}/${id}`,
        result: "success",
        meta: { reason: "created" },
      },
      now,
    );
    return jsonResponse({ saved: true, family, id, updatedAt: now, created: true });
  }

  // UPDATE with CAS: the statement itself checks the live updated_at — a
  // concurrent writer moving it first turns this into zero changes, and the
  // re-read below reports the honest reason (stale basis vs vanished record).
  const updated = await db
    .prepare(
      "UPDATE manage_record SET data_json = ?, updated_at = ? " +
        "WHERE workspace_id = ? AND family = ? AND record_id = ? AND updated_at = ?",
    )
    .bind(serialized, now, workspaceId, family, id, expectedUpdatedAt)
    .run();
  if (updated.meta.changes === 0) {
    const existing = await db
      .prepare("SELECT updated_at FROM manage_record WHERE workspace_id = ? AND family = ? AND record_id = ?")
      .bind(workspaceId, family, id)
      .first<Record<string, unknown>>();
    if (existing === null) {
      throw new HttpError(404, "not_found", { reason: "record_absent" });
    }
    throw new HttpError(409, "conflict", {
      reason: "manage_record_stale",
      currentUpdatedAt: Number(existing.updated_at),
    });
  }
  await audit(
    db,
    {
      actorIdentityId: auth.identityId,
      action: "manage.write.record",
      objectType: "manage_record",
      objectId: `${family}/${id}`,
      result: "success",
      meta: { reason: "updated" },
    },
    now,
  );
  return jsonResponse({ saved: true, family, id, updatedAt: now, created: false });
}

/** Read helper for tests: the stored text (exact serialization). */
export async function readRawRecord(
  db: Db,
  workspaceId: string,
  family: string,
  id: string,
): Promise<string | null> {
  const row = await db
    .prepare("SELECT data_json FROM manage_record WHERE workspace_id = ? AND family = ? AND record_id = ?")
    .bind(workspaceId, family, id)
    .first<Record<string, unknown>>();
  return row === null ? null : rowString(row, "data_json");
}
