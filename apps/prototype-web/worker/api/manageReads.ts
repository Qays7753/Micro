/**
 * Manage Online connected reads (EX-D23, wave M3): owner-scoped read APIs
 * over the manage_record store, every one behind requireManageOwner — the
 * Worker IS the authorization boundary; the browser never talks to
 * PostgreSQL directly. Denied reads are audited without content copies
 * (the F-07 pattern).
 */
import { audit } from "../audit.ts";
import { requireManageOwner, type ManageOwnerContext } from "../authorization.ts";
import { rowString, type Db } from "../db/db.ts";
import { HttpError, jsonResponse } from "../http.ts";
import type { AuthenticatedContext } from "../auth/session.ts";
import type { RouteContext } from "../router.ts";

/** Family names mirror the local export families: kebab-case, bounded. */
const FAMILY_PATTERN = /^[a-z][a-z0-9-]{1,63}$/;
const RECORD_ID_MAX = 128;
const DEFAULT_PAGE = 200;
const MAX_PAGE = 500;

/**
 * The gate with denied-read auditing (contract 22 §4 / F-07): every refusal
 * is recorded without any record content — actor, action, result only.
 */
export async function requireManageOwnerAudited(
  db: Db,
  auth: AuthenticatedContext,
  action: string,
): Promise<ManageOwnerContext> {
  try {
    return await requireManageOwner(db, auth.identityId);
  } catch (error) {
    if (error instanceof HttpError) {
      await audit(
        db,
        {
          actorIdentityId: auth.identityId,
          action,
          objectType: "manage_surface",
          objectId: null,
          result: "denied",
          meta: { reason: error.code },
        },
        Date.now(),
      );
    }
    throw error;
  }
}

function familyOf(raw: unknown): string {
  if (typeof raw !== "string" || !FAMILY_PATTERN.test(raw)) {
    throw new HttpError(400, "bad_request", { field: "family" });
  }
  return raw;
}

/** GET /api/manage/families — what the server holds for the linked owner. */
export async function listFamilies(db: Db, auth: AuthenticatedContext): Promise<Response> {
  const owner = await requireManageOwnerAudited(db, auth, "manage.read.families");
  const rows = await db
    .prepare(
      "SELECT family, COUNT(*) AS n FROM manage_record WHERE workspace_id = ? GROUP BY family ORDER BY family",
    )
    .bind(owner.workspaceId)
    .all<{ family: string; n: number }>();
  const families = rows.results.map(row => ({ family: rowString(row, "family"), count: Number(row.n) }));
  return jsonResponse({
    workspaceId: owner.workspaceId,
    families,
    totalRecords: families.reduce((sum, f) => sum + f.count, 0),
  });
}

/** GET /api/manage/records/:family — one family's records, keyset-paginated. */
export async function listFamilyRecords(ctx: RouteContext, auth: AuthenticatedContext): Promise<Response> {
  const db = ctx.env.DB;
  const owner = await requireManageOwnerAudited(db, auth, "manage.read.records");
  const family = familyOf(ctx.params.family);
  const limitParam = Number(ctx.url.searchParams.get("limit") ?? DEFAULT_PAGE);
  const limit =
    Number.isInteger(limitParam) && limitParam > 0 ? Math.min(limitParam, MAX_PAGE) : DEFAULT_PAGE;
  const cursor = ctx.url.searchParams.get("cursor");
  if (cursor !== null && cursor.length > RECORD_ID_MAX) {
    throw new HttpError(400, "bad_request", { field: "cursor" });
  }
  const hasCursor = cursor !== null && cursor !== "";
  // Fetch one row beyond the page so the end of the family is detected
  // without guessing (the cursor is only emitted when a next row exists).
  const binds: unknown[] = hasCursor
    ? [owner.workspaceId, family, cursor, limit + 1]
    : [owner.workspaceId, family, limit + 1];
  const rows = await db
    .prepare(
      "SELECT record_id, data_json, updated_at FROM manage_record WHERE workspace_id = ? AND family = ?" +
        (hasCursor ? " AND record_id > ?" : "") +
        " ORDER BY record_id LIMIT ?",
    )
    .bind(...binds)
    .all<Record<string, unknown>>();
  const hasMore = rows.results.length > limit;
  const records = rows.results.slice(0, limit).map(row => ({
    id: rowString(row, "record_id"),
    data: JSON.parse(rowString(row, "data_json")),
    updatedAt: Number(row.updated_at),
  }));
  const nextCursor = hasMore && records.length > 0 ? records[records.length - 1]!.id : null;
  return jsonResponse({ family, records, nextCursor });
}

/** GET /api/manage/records/:family/:id — a single record, 404 when absent. */
export async function getRecord(ctx: RouteContext, auth: AuthenticatedContext): Promise<Response> {
  const db = ctx.env.DB;
  const owner = await requireManageOwnerAudited(db, auth, "manage.read.record");
  const family = familyOf(ctx.params.family);
  const id = ctx.params.id;
  if (typeof id !== "string" || id.length === 0 || id.length > RECORD_ID_MAX) {
    throw new HttpError(400, "bad_request", { field: "id" });
  }
  const row = await db
    .prepare(
      "SELECT data_json, updated_at FROM manage_record WHERE workspace_id = ? AND family = ? AND record_id = ?",
    )
    .bind(owner.workspaceId, family, id)
    .first<Record<string, unknown>>();
  if (row === null) {
    // An absent record is an honest 404 — existence is not disclosed.
    throw new HttpError(404, "not_found");
  }
  return jsonResponse({
    family,
    id,
    data: JSON.parse(rowString(row, "data_json")),
    updatedAt: Number(row.updated_at),
  });
}
