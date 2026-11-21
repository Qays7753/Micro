/**
 * Server-side authorization (contract 18 §4 / ROLE-ACCESS-MATRIX).
 * One identity may hold multiple capabilities; every check resolves state
 * from the database (one PostgreSQL target, EX-D20) at request time — never
 * from client-supplied roles.
 *
 * Capability model for v1:
 *  - guest: browse approved public listings, listing contact channel.
 *  - authenticated: start vendor path, create delivery requests, save
 *    drivers, rate delivered+confirmed bookings.
 *  - vendor (of their own records): drafts/submissions of supplier profile
 *    and listings; direct numeric updates with verification+log (OD-09).
 *  - driver (approved person + approved vehicle + non-expired required
 *    evidence): receive/accept directed requests, declare, submit statements.
 *  - admin (reviewer): review queues, approve/reject/request-changes,
 *    settings, reports — administrative decisions only, never on behalf of a
 *    party's money/receipt (contract 22).
 */

import { HttpError } from "./http.ts";
import type { Db } from "./db/db.ts";

export interface AuthContext {
  identityId: string | null;
  isAdmin: boolean;
}

export const GUEST: AuthContext = { identityId: null, isAdmin: false };

export function requireIdentity(auth: AuthContext): string {
  if (!auth.identityId) throw new HttpError(401, "unauthorized");
  return auth.identityId;
}

export function requireAdmin(auth: AuthContext): string {
  const identityId = requireIdentity(auth);
  if (!auth.isAdmin) throw new HttpError(403, "forbidden", { reason: "admin_only" });
  return identityId;
}

export interface VendorStatus {
  status: string;
  supplierProfileId: string;
}

/** The identity's supplier profile row (vendors are per-profile, OD-12). */
export async function vendorStatus(db: Db, identityId: string): Promise<VendorStatus | null> {
  const row = await db
    .prepare("SELECT id, status FROM supplier_profile WHERE identity_id = ? ORDER BY created_at LIMIT 1")
    .bind(identityId)
    .first<Record<string, unknown>>();
  if (!row) return null;
  return { status: String(row.status), supplierProfileId: String(row.id) };
}

export interface DriverStatus {
  driverProfileId: string;
  profileStatus: string;
  vehicleApproved: boolean;
  requiredEvidenceValid: boolean;
  acceptingNew: boolean;
  /** Can the driver receive/accept NEW bookings right now (OD22/OD30)? */
  eligibleForNewWork: boolean;
}

const REQUIRED_EVIDENCE_CATEGORIES = ["identity", "license"] as const;

/**
 * Driver capability resolution (OD22 + OD30): approved person AND approved
 * vehicle AND required evidence (identity/license [+ vehicle proof when a
 * vehicle is registered]) not expired. Expiry blocks NEW work only.
 */
export async function driverStatus(db: Db, identityId: string, now: number): Promise<DriverStatus | null> {
  const profile = await db
    .prepare("SELECT id, status, accepting_new FROM driver_profile WHERE identity_id = ?")
    .bind(identityId)
    .first<Record<string, unknown>>();
  if (!profile) return null;
  const driverProfileId = String(profile.id);
  const profileStatus = String(profile.status);
  const vehicle = await db
    .prepare("SELECT status FROM driver_vehicle WHERE driver_profile_id = ? ORDER BY created_at LIMIT 1")
    .bind(driverProfileId)
    .first<Record<string, unknown>>();
  const vehicleApproved = vehicle !== null && String(vehicle.status) === "approved";
  const evidenceRows = await db
    .prepare("SELECT category, status, expires_at FROM driver_evidence WHERE driver_profile_id = ?")
    .bind(driverProfileId)
    .all<Record<string, unknown>>();
  const evidence = evidenceRows.results.map(row => ({
    category: String(row.category),
    status: String(row.status),
    expiresAt: row.expires_at === null ? null : Number(row.expires_at),
  }));
  const required: string[] = [...REQUIRED_EVIDENCE_CATEGORIES];
  if (vehicle !== null) required.push("vehicle_ownership");
  const requiredEvidenceValid = required.every(category => {
    const match = evidence.find(item => item.category === category);
    if (!match) return false;
    if (match.status !== "approved") return false;
    // Expiry recorded only when clear (OD29); expired blocks new only (OD30).
    return match.expiresAt === null || match.expiresAt > now;
  });
  const acceptingNew = Number(profile.accepting_new) === 1;
  return {
    driverProfileId,
    profileStatus,
    vehicleApproved,
    requiredEvidenceValid,
    acceptingNew,
    eligibleForNewWork:
      profileStatus === "approved" && vehicleApproved && requiredEvidenceValid && acceptingNew,
  };
}

/** Requester (project owner) capability: any authenticated identity (OD18). */
export async function canCreateRequests(auth: AuthContext): Promise<string> {
  return requireIdentity(auth);
}

/* ───────────── Workspace layer (EX-D19, contract 18 §2/§9) ───────────── */

export interface WorkspaceContext {
  workspaceId: string;
  displayName: string;
  role: string;
  marketEnabled: boolean;
  deliveryEnabled: boolean;
}

function toWorkspaceContext(row: Record<string, unknown>): WorkspaceContext {
  return {
    workspaceId: String(row.workspace_id),
    displayName: String(row.display_name),
    role: String(row.role),
    marketEnabled: Number(row.market_enabled) === 1,
    deliveryEnabled: Number(row.delivery_enabled) === 1,
  };
}

/**
 * All active workspace memberships of an identity (display only — the shell
 * renders them so the user can send an explicit context). Server-derived
 * only; the client may render them but never asserts them.
 *
 * Post-Group 6 W1 (owner final decision أ-3/أ-4 / EX-D24): an identity can
 * hold at most ONE active owner membership (migration 0007's partial unique
 * index), so this list is the identity's single project plus — never, by
 * decision — any granted team memberships (no invitation surface exists).
 */
export async function listWorkspaceMemberships(db: Db, identityId: string): Promise<WorkspaceContext[]> {
  const rows = await db
    .prepare(
      "SELECT m.workspace_id, m.role, w.display_name, w.market_enabled, w.delivery_enabled " +
        "FROM workspace_member m JOIN workspace w ON w.id = m.workspace_id " +
        "WHERE m.identity_id = ? AND m.status = 'active' ORDER BY w.created_at",
    )
    .bind(identityId)
    .all<Record<string, unknown>>();
  return rows.results.map(toWorkspaceContext);
}

/** Does the identity hold the server-granted platform-admin membership? */
export async function isAdminIdentity(db: Db, identityId: string): Promise<boolean> {
  const row = await db
    .prepare(
      "SELECT 1 AS ok FROM network_membership WHERE identity_id = ? AND role = 'admin' AND status = 'active' LIMIT 1",
    )
    .bind(identityId)
    .first<Record<string, unknown>>();
  return row !== null;
}

/**
 * Does the identity hold ANY business role (project membership, supplier
 * profile, driver profile)? The final decision (ب-المشرف) keeps the admin on
 * a SEPARATE Google account that carries none of these — both directions are
 * enforced (bootstrap refuses business identities; business paths refuse
 * admin identities).
 */
export async function identityHoldsBusinessRole(db: Db, identityId: string): Promise<boolean> {
  const row = await db
    .prepare("SELECT 1 AS ok FROM workspace_member WHERE identity_id = ? AND status = 'active' LIMIT 1")
    .bind(identityId)
    .first<Record<string, unknown>>();
  if (row !== null) return true;
  const supplier = await db
    .prepare("SELECT 1 AS ok FROM supplier_profile WHERE identity_id = ? LIMIT 1")
    .bind(identityId)
    .first<Record<string, unknown>>();
  if (supplier !== null) return true;
  const driver = await db
    .prepare("SELECT 1 AS ok FROM driver_profile WHERE identity_id = ? LIMIT 1")
    .bind(identityId)
    .first<Record<string, unknown>>();
  return driver !== null;
}

/**
 * EXPLICIT personal project creation (final decision أ-3 / EX-D24 — replaces
 * the pre-W1 auto-creation on first business action): registration creates
 * no role and no project; the project is created by one explicit request,
 * one project per owner account, one owner per project. Refuses:
 *  - 403 admin_identity_forbidden — the admin account holds no business roles;
 *  - 409 one_project_per_account — an active owned workspace already exists
 *    (application check first, then the migration-0007 partial unique index
 *    makes a race degrade to the same honest 409, never a silent second
 *    project).
 * Idempotence is NOT provided on purpose: a retried creation must surface
 * the existing project (the caller lists memberships), not create another.
 */
export async function createPersonalWorkspace(
  db: Db,
  identityId: string,
  displayName: string,
  now: number,
  randomToken: (byteLength?: number) => string,
): Promise<WorkspaceContext> {
  if (await isAdminIdentity(db, identityId)) {
    throw new HttpError(403, "admin_identity_forbidden", {
      reason: "admin_account_holds_no_business_roles",
    });
  }
  const existing = await db
    .prepare(
      "SELECT m.workspace_id FROM workspace_member m " +
        "WHERE m.identity_id = ? AND m.role = 'owner' AND m.status = 'active' LIMIT 1",
    )
    .bind(identityId)
    .first<Record<string, unknown>>();
  if (existing !== null) {
    throw new HttpError(409, "one_project_per_account", {
      reason: "active_owned_workspace_exists",
      workspaceId: String(existing.workspace_id),
    });
  }
  const workspaceId = `ws_${randomToken(16)}`;
  try {
    await db
      .prepare(
        "INSERT INTO workspace (id, display_name, created_by_identity_id, market_enabled, delivery_enabled, created_at, updated_at) VALUES (?, ?, ?, 1, 1, ?, ?)",
      )
      .bind(workspaceId, displayName, identityId, now, now)
      .run();
    await db
      .prepare(
        "INSERT INTO workspace_member (workspace_id, identity_id, role, status, granted_by_identity_id, granted_at) " +
          "VALUES (?, ?, 'owner', 'active', ?, ?)",
      )
      .bind(workspaceId, identityId, identityId, now)
      .run();
  } catch {
    // The partial unique index (migration 0007) fired under a race — the
    // honest conflict, never a second project.
    throw new HttpError(409, "one_project_per_account", {
      reason: "active_owned_workspace_exists",
    });
  }
  return {
    workspaceId,
    displayName,
    role: "owner",
    marketEnabled: true,
    deliveryEnabled: true,
  };
}

/**
 * EXPLICIT workspace context (final decision ب-قواعد / EX-D24 — AUTHZ-05):
 * every business request names its active workspace and the server verifies
 * the caller's active membership, role and module capability for THAT
 * workspace. No implicit "first enabled membership" selection remains
 * anywhere (the pre-W1 requireModuleWorkspace auto-selection was removed
 * with the auto-creation it served).
 * Fails closed with honest codes:
 *  - 403 workspace_missing — the identity has no active membership at all;
 *  - 403 workspace_forbidden — the caller is not an active member of the
 *    NAMED workspace (cross-account/cross-context use is refused, not
 *    silently redirected to the caller's own workspace);
 *  - 403 workspace_capability_disabled — membership is fine but the module
 *    capability is off for that workspace.
 */
export async function requireWorkspaceContext(
  db: Db,
  identityId: string,
  workspaceId: string,
  module: "market" | "delivery",
): Promise<WorkspaceContext> {
  const row = await db
    .prepare(
      "SELECT m.workspace_id, m.role, w.display_name, w.market_enabled, w.delivery_enabled, m.status " +
        "FROM workspace_member m JOIN workspace w ON w.id = m.workspace_id " +
        "WHERE m.identity_id = ? AND m.workspace_id = ? LIMIT 1",
    )
    .bind(identityId, workspaceId)
    .first<Record<string, unknown>>();
  if (row === null || String(row.status) !== "active") {
    const anyMembership = await db
      .prepare("SELECT 1 AS ok FROM workspace_member WHERE identity_id = ? AND status = 'active' LIMIT 1")
      .bind(identityId)
      .first<Record<string, unknown>>();
    if (anyMembership === null) {
      throw new HttpError(403, "workspace_missing", { reason: "no_active_workspace" });
    }
    throw new HttpError(403, "workspace_forbidden", { reason: "not_a_member_of_workspace" });
  }
  const context = toWorkspaceContext(row);
  const enabled = module === "market" ? context.marketEnabled : context.deliveryEnabled;
  if (!enabled) {
    throw new HttpError(403, "workspace_capability_disabled", { reason: `module_${module}_disabled` });
  }
  return context;
}

/* ───────────── Manage Online (EX-D23, contract 18 §10) ───────────── */

export interface ManageOwnerContext {
  workspaceId: string;
  displayName: string;
}

/**
 * THE Manage owner gate (EX-D23 / decision card §3-د / scenarios MO-06+MO-07):
 * the only doorway to connected Manage surfaces. Resolves everything from the
 * database at request time — session identity + workspace membership + the
 * manage capability + the VERIFIED owner-identity link (migration-gate
 * §2-b). Fails closed with honest codes:
 *  - 403 manage_capability_disabled — the operator has not enabled the
 *    capability for the caller's workspace(s) yet (the default posture);
 *  - 403 manage_not_linked — capability enabled but this identity has no
 *    verified link (an UNLINKED identity — even one sharing the owner's exact
 *    email address — is refused: email matching is never consulted, MO-03).
 * The platform-admin flag is deliberately NOT consulted here: an admin is
 * refused exactly like any other non-owner role (contract 18 §10-4).
 *
 * Post-Group 6 W1 (EX-D24 / AUTHZ-05 — explicit active context): when the
 * caller NAMES a workspace (workspaceId), that exact workspace is verified —
 * a mismatched/cross-account context is an honest 403
 * `workspace_forbidden`, never a silent fall-back to the caller's own
 * project. When absent, resolution relies on migration 0007's structural
 * guarantee that an identity holds AT MOST ONE active owner membership, so
 * there is no "first workspace" selection left to get wrong; the connected
 * client always sends its explicit context.
 */
export async function requireManageOwner(
  db: Db,
  identityId: string,
  workspaceId?: string,
): Promise<ManageOwnerContext> {
  const rows = await db
    .prepare(
      "SELECT m.workspace_id, w.display_name, w.manage_enabled, " +
        "(SELECT l.status FROM manage_owner_link l WHERE l.workspace_id = m.workspace_id AND l.identity_id = m.identity_id LIMIT 1) AS own_link " +
        "FROM workspace_member m JOIN workspace w ON w.id = m.workspace_id " +
        "WHERE m.identity_id = ? AND m.status = 'active' AND m.role = 'owner' ORDER BY w.created_at",
    )
    .bind(identityId)
    .all<Record<string, unknown>>();
  const memberships = rows.results;
  if (workspaceId !== undefined) {
    const named = memberships.find(row => String(row.workspace_id) === workspaceId);
    if (named === undefined) {
      const anyMembership = await db
        .prepare("SELECT 1 AS ok FROM workspace_member WHERE identity_id = ? AND status = 'active' LIMIT 1")
        .bind(identityId)
        .first<Record<string, unknown>>();
      if (anyMembership === null) {
        throw new HttpError(403, "workspace_missing", { reason: "no_active_workspace" });
      }
      throw new HttpError(403, "workspace_forbidden", { reason: "not_a_member_of_workspace" });
    }
    if (Number(named.manage_enabled) !== 1) {
      throw new HttpError(403, "manage_capability_disabled", { reason: "manage_not_enabled_for_workspace" });
    }
    if (named.own_link === null || String(named.own_link) !== "linked") {
      throw new HttpError(403, "manage_not_linked", { reason: "no_verified_manage_owner_link" });
    }
    return { workspaceId: String(named.workspace_id), displayName: String(named.display_name) };
  }
  if (memberships.length === 0) {
    // Distinguish an identity with no workspace at all from a member who is
    // simply not the manage owner (supplier/driver/second owner) — both are
    // refused, but each gets its own honest reason.
    const anyMembership = await db
      .prepare("SELECT 1 AS ok FROM workspace_member WHERE identity_id = ? AND status = 'active' LIMIT 1")
      .bind(identityId)
      .first<Record<string, unknown>>();
    if (anyMembership === null) {
      throw new HttpError(403, "workspace_missing", { reason: "no_active_workspace" });
    }
    throw new HttpError(403, "manage_not_linked", { reason: "not_the_manage_owner" });
  }
  const enabled = memberships.filter(row => Number(row.manage_enabled) === 1);
  if (enabled.length === 0) {
    throw new HttpError(403, "manage_capability_disabled", { reason: "manage_not_enabled_for_workspace" });
  }
  for (const row of enabled) {
    if (row.own_link !== null && String(row.own_link) === "linked") {
      return { workspaceId: String(row.workspace_id), displayName: String(row.display_name) };
    }
  }
  throw new HttpError(403, "manage_not_linked", { reason: "no_verified_manage_owner_link" });
}
