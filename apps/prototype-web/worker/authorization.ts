/**
 * Server-side authorization (contract 18 §4 / ROLE-ACCESS-MATRIX).
 * One identity may hold multiple capabilities; every check resolves state
 * from D1 at request time — never from client-supplied roles.
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
import type { Db } from "./db/d1.ts";

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
