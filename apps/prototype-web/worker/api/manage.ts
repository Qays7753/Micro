/**
 * Manage Online foundation (EX-D23, wave M2 — owner order 2026-11-14):
 * the honest manage configuration state and the VERIFIED owner-identity link
 * flow (migration gate §2-b / decision card §3-ب). Everything here fails
 * closed until the operator applies migration 0003 AND enables the workspace
 * capability — no default-on surface of any kind.
 *
 * Link protocol (double proof, never email-only — MO-03/MO-04):
 *  1. The owner generates a random ownership secret INSIDE local Manage and
 *     deposits it in the local export file (outside the data snapshot) — the
 *     local side of the proof. Migration (M5) verifies the uploaded export's
 *     secret against the hash stored here.
 *  2. `link/start` (cloud session): the owner presents that secret; only its
 *     SHA-256 hash is stored (never the raw secret), on a network-side table
 *     only — the local export envelope and the 41/34 pair are never touched.
 *  3. `link/confirm` (cloud session): the explicit second confirmation with
 *     the pending nonce, within the short expiry window.
 * Email addresses are never read by any step of this flow.
 */

import { audit } from "../audit.ts";
import { requireManageOwner } from "../authorization.ts";
import { randomToken, sha256Hex } from "../crypto.ts";
import { rowString, type Db } from "../db/db.ts";
import { HttpError, asString, jsonResponse } from "../http.ts";
import type { AuthenticatedContext } from "../auth/session.ts";
import type { RouteContext } from "../router.ts";

/** Pending-link window (matches the short-lived invitation posture). */
const PENDING_LINK_TTL_MS = 15 * 60 * 1000;

/** Proof secret bounds: long enough to be a real secret, never stored raw. */
const PROOF_MIN = 32;
const PROOF_MAX = 256;

/**
 * Honest configuration probe: has the operator applied the manage migrations
 * (0003 foundation + 0004 records) at all? Absent schema is a deliberate
 * unconfigured state (503 manage_not_configured, the ask_not_configured
 * pattern) — never a 500 and never a silent fallback.
 */
export async function ensureManageSchema(db: Db): Promise<void> {
  const row = await db
    .prepare(
      "SELECT (SELECT COUNT(*) FROM information_schema.columns WHERE table_name = 'workspace' AND column_name = 'manage_enabled') AS has_column, " +
        "(SELECT COUNT(*) FROM information_schema.columns WHERE table_name = 'workspace' AND column_name = 'manage_online_only') AS has_mode_column, " +
        "(SELECT COUNT(*) FROM information_schema.tables WHERE table_name = 'manage_owner_link') AS has_link_table, " +
        "(SELECT COUNT(*) FROM information_schema.tables WHERE table_name = 'manage_record') AS has_record_table",
    )
    .first<Record<string, unknown>>();
  if (
    row === null ||
    Number(row.has_column) !== 1 ||
    Number(row.has_mode_column) !== 1 ||
    Number(row.has_link_table) !== 1 ||
    Number(row.has_record_table) !== 1
  ) {
    throw new HttpError(503, "manage_not_configured", {
      reason: "manage_schema_not_applied_by_operator",
    });
  }
}

interface ManageWorkspaceState {
  id: string;
  displayName: string;
  role: string;
  manageEnabled: boolean;
  /** The caller's own link relation — 'taken' never discloses WHO owns it. */
  linkStatus: "none" | "pending" | "linked" | "taken";
}

/** GET /api/manage/state — the truthful manage state for the caller. */
export async function manageState(db: Db, auth: AuthenticatedContext): Promise<Response> {
  await ensureManageSchema(db);
  const rows = await db
    .prepare(
      "SELECT m.workspace_id, w.display_name, m.role, w.manage_enabled, " +
        "(SELECT l.status FROM manage_owner_link l WHERE l.workspace_id = m.workspace_id AND l.identity_id = m.identity_id LIMIT 1) AS own_link, " +
        "(SELECT COUNT(*) FROM manage_owner_link l2 WHERE l2.workspace_id = m.workspace_id AND l2.status = 'linked') AS linked_count " +
        "FROM workspace_member m JOIN workspace w ON w.id = m.workspace_id " +
        "WHERE m.identity_id = ? AND m.status = 'active' ORDER BY w.created_at",
    )
    .bind(auth.identityId)
    .all<Record<string, unknown>>();
  const workspaces: ManageWorkspaceState[] = rows.results.map(row => {
    const ownLink = row.own_link === null ? null : String(row.own_link);
    const linkedCount = Number(row.linked_count);
    let linkStatus: ManageWorkspaceState["linkStatus"] = "none";
    if (ownLink === "linked") linkStatus = "linked";
    else if (ownLink === "pending") linkStatus = "pending";
    else if (linkedCount > 0) linkStatus = "taken";
    return {
      id: String(row.workspace_id),
      displayName: String(row.display_name),
      role: String(row.role),
      manageEnabled: Number(row.manage_enabled) === 1,
      linkStatus,
    };
  });
  return jsonResponse({ configured: true, workspaces });
}

/**
 * POST /api/manage/link/start — register the Manage-side ownership secret
 * (hash only) and open a short-lived pending link for the caller's first
 * owner workspace that is not already linked to ANOTHER identity.
 */
export async function linkStart(db: Db, ctx: RouteContext, auth: AuthenticatedContext): Promise<Response> {
  await ensureManageSchema(db);
  const body = (await ctx.request.json()) as Record<string, unknown>;
  const proofSecret = asString(body.proofSecret, "proofSecret", { min: PROOF_MIN, max: PROOF_MAX });
  const now = Date.now();

  const rows = await db
    .prepare(
      "SELECT m.workspace_id, w.manage_enabled, " +
        "(SELECT l.status FROM manage_owner_link l WHERE l.workspace_id = m.workspace_id AND l.identity_id = m.identity_id LIMIT 1) AS own_link, " +
        "(SELECT COUNT(*) FROM manage_owner_link l2 WHERE l2.workspace_id = m.workspace_id AND l2.status = 'linked' AND l2.identity_id <> m.identity_id) AS other_linked " +
        "FROM workspace_member m JOIN workspace w ON w.id = m.workspace_id " +
        "WHERE m.identity_id = ? AND m.status = 'active' AND m.role = 'owner' ORDER BY w.created_at",
    )
    .bind(auth.identityId)
    .all<Record<string, unknown>>();
  if (rows.results.length === 0) {
    throw new HttpError(403, "workspace_missing", { reason: "no_active_owner_workspace" });
  }
  // Fail closed on the capability first: linking is part of the manage
  // surface, so the operator's enable step precedes any link attempt.
  const enabledRows = rows.results.filter(row => Number(row.manage_enabled) === 1);
  if (enabledRows.length === 0) {
    throw new HttpError(403, "manage_capability_disabled", { reason: "manage_not_enabled_for_workspace" });
  }
  if (enabledRows.some(row => row.own_link !== null && String(row.own_link) === "linked")) {
    throw new HttpError(409, "manage_already_linked", { reason: "already_linked_unlink_first" });
  }
  const target = enabledRows.find(row => Number(row.other_linked) === 0);
  if (target === undefined) {
    throw new HttpError(409, "manage_owner_exists", { reason: "workspace_already_has_manage_owner" });
  }
  const workspaceId = String(target.workspace_id);

  const nonce = randomToken(16);
  const proofHash = await sha256Hex(proofSecret);
  await db
    .prepare(
      "INSERT INTO manage_owner_link (workspace_id, identity_id, proof_hash, nonce, status, created_at, updated_at) " +
        "VALUES (?, ?, ?, ?, 'pending', ?, ?) " +
        "ON CONFLICT(workspace_id, identity_id) DO UPDATE SET proof_hash = excluded.proof_hash, nonce = excluded.nonce, status = 'pending', updated_at = excluded.updated_at",
    )
    .bind(workspaceId, auth.identityId, proofHash, nonce, now, now)
    .run();
  await audit(
    db,
    {
      actorIdentityId: auth.identityId,
      action: "manage.link.start",
      objectType: "manage_owner_link",
      objectId: workspaceId,
      result: "success",
      meta: { reason: "proof_hash_registered" },
    },
    now,
  );
  return jsonResponse({
    pending: true,
    workspaceId,
    nonce,
    expiresAt: now + PENDING_LINK_TTL_MS,
  });
}

/**
 * POST /api/manage/link/confirm — the explicit second confirmation inside the
 * cloud session: the caller confirms their own pending link by nonce within
 * the expiry window. The database's partial unique index structurally refuses
 * a second linked owner for the same workspace, even under a race.
 */
export async function linkConfirm(db: Db, ctx: RouteContext, auth: AuthenticatedContext): Promise<Response> {
  await ensureManageSchema(db);
  const body = (await ctx.request.json()) as Record<string, unknown>;
  const nonce = asString(body.nonce, "nonce", { min: 16, max: 64 });
  const now = Date.now();

  const pending = await db
    .prepare(
      "SELECT workspace_id, created_at FROM manage_owner_link WHERE identity_id = ? AND nonce = ? AND status = 'pending'",
    )
    .bind(auth.identityId, nonce)
    .first<Record<string, unknown>>();
  if (pending === null) {
    throw new HttpError(404, "not_found", { reason: "no_pending_manage_link" });
  }
  if (now - Number(pending.created_at) > PENDING_LINK_TTL_MS) {
    throw new HttpError(410, "manage_link_expired", { reason: "pending_link_window_elapsed" });
  }
  const workspaceId = rowString(pending, "workspace_id");
  try {
    await db
      .prepare(
        "UPDATE manage_owner_link SET status = 'linked', updated_at = ? WHERE workspace_id = ? AND identity_id = ? AND nonce = ? AND status = 'pending'",
      )
      .bind(now, workspaceId, auth.identityId, nonce)
      .run();
  } catch {
    // The partial unique index (one linked owner per workspace) fired —
    // another identity completed a link first. Honest conflict, no winner.
    throw new HttpError(409, "manage_owner_exists", { reason: "workspace_already_has_manage_owner" });
  }
  await audit(
    db,
    {
      actorIdentityId: auth.identityId,
      action: "manage.link.confirm",
      objectType: "manage_owner_link",
      objectId: workspaceId,
      result: "success",
      meta: { reason: "double_confirmation_completed" },
    },
    now,
  );
  return jsonResponse({ linked: true, workspaceId });
}

/** DELETE /api/manage/link — remove the caller's own link (owner-initiated). */
export async function unlinkManage(db: Db, ctx: RouteContext, auth: AuthenticatedContext): Promise<Response> {
  void ctx;
  await ensureManageSchema(db);
  const now = Date.now();
  const existing = await db
    .prepare("SELECT workspace_id FROM manage_owner_link WHERE identity_id = ?")
    .bind(auth.identityId)
    .first<Record<string, unknown>>();
  if (existing === null) {
    throw new HttpError(404, "not_found", { reason: "no_manage_link" });
  }
  const workspaceId = rowString(existing, "workspace_id");
  await db.prepare("DELETE FROM manage_owner_link WHERE identity_id = ?").bind(auth.identityId).run();
  await audit(
    db,
    {
      actorIdentityId: auth.identityId,
      action: "manage.link.unlink",
      objectType: "manage_owner_link",
      objectId: workspaceId,
      result: "success",
      meta: { reason: "owner_initiated_unlink" },
    },
    now,
  );
  return jsonResponse({ unlinked: true, workspaceId });
}

export { requireManageOwner };
