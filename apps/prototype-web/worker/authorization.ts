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
 * All active workspace memberships of an identity (a person may belong to
 * several workspaces with different roles — contract 18 §2). Server-derived
 * only; the client may render them but never asserts them.
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

/**
 * Ensure the identity has a personal business workspace (auto-created on
 * first business action — EX-D19: no module choice at registration; default
 * capabilities both enabled). Returns the active membership context.
 * Idempotent and safe under races: the membership upsert conflicts-nothing.
 */
export async function ensurePersonalWorkspace(
  db: Db,
  identityId: string,
  now: number,
  randomToken: (byteLength?: number) => string,
): Promise<WorkspaceContext> {
  const existing = await db
    .prepare(
      "SELECT m.workspace_id, m.role, w.display_name, w.market_enabled, w.delivery_enabled " +
        "FROM workspace_member m JOIN workspace w ON w.id = m.workspace_id " +
        "WHERE m.identity_id = ? AND m.status = 'active' ORDER BY w.created_at LIMIT 1",
    )
    .bind(identityId)
    .first<Record<string, unknown>>();
  if (existing) return toWorkspaceContext(existing);
  const identityRow = await db
    .prepare("SELECT display_name, email FROM network_identity WHERE id = ?")
    .bind(identityId)
    .first<Record<string, unknown>>();
  const displayName =
    identityRow === null
      ? "مساحة عمل شخصية"
      : String(identityRow.display_name || identityRow.email || "مساحة عمل شخصية");
  const workspaceId = `ws_${randomToken(16)}`;
  await db
    .prepare(
      "INSERT INTO workspace (id, display_name, created_by_identity_id, market_enabled, delivery_enabled, created_at, updated_at) VALUES (?, ?, ?, 1, 1, ?, ?)",
    )
    .bind(workspaceId, displayName, identityId, now, now)
    .run();
  await db
    .prepare(
      "INSERT INTO workspace_member (workspace_id, identity_id, role, status, granted_by_identity_id, granted_at) " +
        "VALUES (?, ?, 'owner', 'active', ?, ?) ON CONFLICT DO NOTHING",
    )
    .bind(workspaceId, identityId, identityId, now)
    .run();
  return {
    workspaceId,
    displayName,
    role: "owner",
    marketEnabled: true,
    deliveryEnabled: true,
  };
}

/**
 * Resolve the identity's active business workspace for a module. Fails
 * closed with an honest error when there is no active membership or the
 * workspace capability is disabled (EX-D19: capability limits business
 * actions/data — it never hides the shared product entry points, so the
 * client shows an honest setup/permission state instead of this throwing
 * for UI purposes; the API itself must refuse the action).
 *
 * NOTE (Phase F, final review 1): this helper is the DESIGNATED future
 * enforcement point for per-workspace capability gating across ALL business
 * writes once multi-workspace grant flows exist — its "any enabled
 * membership" semantics are the contract-18 §2 target. The CURRENT recorded
 * enforcement scope (Phase B §37-2) is the two entry actions that ensure a
 * personal workspace first (vendor profile save / booking creation), where
 * this helper cannot be used because it would refuse the auto-creation of
 * the first workspace. Do not delete it; wire it when grants arrive.
 */
export async function requireModuleWorkspace(
  db: Db,
  identityId: string,
  module: "market" | "delivery",
): Promise<WorkspaceContext> {
  const memberships = await listWorkspaceMemberships(db, identityId);
  const enabled = memberships.filter(m => (module === "market" ? m.marketEnabled : m.deliveryEnabled));
  if (enabled.length === 0) {
    if (memberships.length === 0) {
      throw new HttpError(403, "workspace_missing", { reason: "no_active_workspace" });
    }
    throw new HttpError(403, "workspace_capability_disabled", { reason: `module_${module}_disabled` });
  }
  return enabled[0];
}

/* ───────────── Manage Online (EX-D23, contract 18 §10) ───────────── */

export interface ManageOwnerContext {
  workspaceId: string;
  displayName: string;
}

/**
 * THE Manage owner gate (EX-D23 / decision card §3-د / scenarios MO-06+MO-07):
 * the only doorway to connected Manage surfaces. Resolves everything from the
 * database at request time — session identity + active workspace membership +
 * the manage capability + the VERIFIED owner-identity link (migration-gate
 * §2-b). Fails closed with honest codes:
 *  - 403 manage_capability_disabled — the operator has not enabled the
 *    capability for the caller's workspace(s) yet (the default posture);
 *  - 403 manage_not_linked — capability enabled but this identity has no
 *    verified link (an UNLINKED identity — even one sharing the owner's exact
 *    email address — is refused: email matching is never consulted, MO-03).
 * The platform-admin flag is deliberately NOT consulted here: an admin is
 * refused exactly like any other non-owner role (contract 18 §10-4).
 */
export async function requireManageOwner(db: Db, identityId: string): Promise<ManageOwnerContext> {
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
