/**
 * Driver portal API (contract 21 §3.2 + OD01/OD21/OD22/OD28–OD31).
 * The driver experience is a separately gated context on the same Micro
 * identity: application with private evidence, manual review, accepting-new
 * toggle, directed incoming requests, and execution declarations. Evidence
 * files stay private (driver + authorized reviewers only); expiry blocks NEW
 * acceptance only (OD30) and never closes existing work.
 */

import { audit, notify } from "../audit.ts";
import { nowMs } from "../clock.ts";
import { randomToken } from "../crypto.ts";
import { newId, type Db } from "../db/d1.ts";
import {
  assertContactAttemptBeforeFailure,
  confirmationAfterDeclaration,
  effectiveRequestStatus,
  goodsAfterExecution,
  parseMinorAmount,
  statementTotal,
  transitionExecution,
  transitionRequest,
  type ExecutionState,
  type RequestStatus,
  type StatementItem,
} from "../domain/delivery.ts";
import { ammanDateString } from "../clock.ts";
import { DRIVER_RESPONSE_WINDOW_MS } from "../env.ts";
import { HttpError, jsonResponse } from "../http.ts";
import { readJsonBody, type RouteContext } from "../router.ts";
import { driverStatus } from "../authorization.ts";
import type { AuthenticatedContext } from "../auth/session.ts";

function db(ctx: RouteContext): Db {
  return ctx.env.DB;
}

async function requireDriverProfile(ctx: RouteContext, auth: AuthenticatedContext): Promise<string> {
  const status = await driverStatus(db(ctx), auth.identityId, nowMs());
  if (!status) throw new HttpError(404, "not_found");
  return status.driverProfileId;
}

/** GET /api/driver/portal — the driver's own dashboard state (OD01). */
export async function driverPortal(ctx: RouteContext, auth: AuthenticatedContext): Promise<Response> {
  const status = await driverStatus(db(ctx), auth.identityId, nowMs());
  if (!status) return jsonResponse({ driver: null, step: "apply" });
  const profileFull = await db(ctx)
    .prepare("SELECT status, review_reason, work_copy_json FROM driver_profile WHERE id = ?")
    .bind(status.driverProfileId)
    .first<Record<string, unknown>>();
  const evidence = await db(ctx)
    .prepare(
      "SELECT id, category, status, expires_at, media_id FROM driver_evidence WHERE driver_profile_id = ?",
    )
    .bind(status.driverProfileId)
    .all<Record<string, unknown>>();
  const vehicle = await db(ctx)
    .prepare(
      "SELECT id, info_json, status FROM driver_vehicle WHERE driver_profile_id = ? ORDER BY created_at LIMIT 1",
    )
    .bind(status.driverProfileId)
    .first<Record<string, unknown>>();
  return jsonResponse({
    driver: {
      status: status.profileStatus,
      reviewReason:
        profileFull === null || profileFull.review_reason === null ? null : String(profileFull.review_reason),
      profileFields:
        profileFull === null
          ? null
          : (JSON.parse(String(profileFull.work_copy_json)) as {
              displayName?: string;
              phone?: string;
              serviceAreas?: string[];
            }),
      eligibleForNewWork: status.eligibleForNewWork,
      acceptingNew: status.acceptingNew,
      evidenceValid: status.requiredEvidenceValid,
      vehicleApproved: status.vehicleApproved,
    },
    step: status.profileStatus === "approved" ? "dashboard" : "application",
    evidence: evidence.results.map(row => ({
      id: String(row.id),
      category: String(row.category),
      status: String(row.status),
      expiresAt: row.expires_at === null ? null : Number(row.expires_at),
      mediaId: String(row.media_id),
    })),
    vehicle: vehicle
      ? {
          id: String(vehicle.id),
          info: JSON.parse(String(vehicle.info_json)),
          status: String(vehicle.status),
        }
      : null,
  });
}

/** POST /api/driver/profile — create/update the driver work copy (self-application, OD22). */
export async function saveDriverProfile(ctx: RouteContext, auth: AuthenticatedContext): Promise<Response> {
  const body = (await readJsonBody(ctx.request)) as Record<string, unknown>;
  const displayName =
    typeof body.displayName === "string" && body.displayName.trim().length >= 2
      ? body.displayName.trim()
      : null;
  const phone = typeof body.phone === "string" && /^\+?\d{7,15}$/.test(body.phone) ? body.phone : null;
  if (!displayName || !phone) throw new HttpError(400, "bad_request", { field: "profile" });
  const work = JSON.stringify({
    displayName,
    phone,
    serviceAreas: Array.isArray(body.serviceAreas)
      ? (body.serviceAreas as unknown[]).filter((a): a is string => typeof a === "string").slice(0, 12)
      : [],
    capacity: body.capacity ?? null,
    terms: body.terms ?? null,
    ceilings: body.ceilings ?? null,
  });
  const now = nowMs();
  const existing = await db(ctx)
    .prepare("SELECT id FROM driver_profile WHERE identity_id = ?")
    .bind(auth.identityId)
    .first<Record<string, unknown>>();
  if (existing) {
    await db(ctx)
      .prepare("UPDATE driver_profile SET work_copy_json = ?, updated_at = ? WHERE id = ?")
      .bind(work, now, String(existing.id))
      .run();
    return jsonResponse({ driverProfileId: String(existing.id) });
  }
  const id = newId("drv", randomToken);
  await db(ctx)
    .prepare(
      "INSERT INTO driver_profile (id, identity_id, work_copy_json, status, created_at, updated_at) VALUES (?, ?, ?, 'draft', ?, ?)",
    )
    .bind(id, auth.identityId, work, now, now)
    .run();
  return jsonResponse({ driverProfileId: id }, 201);
}

/** POST /api/driver/vehicle — register a vehicle with its ownership/permission proof. */
export async function saveDriverVehicle(ctx: RouteContext, auth: AuthenticatedContext): Promise<Response> {
  const driverProfileId = await requireDriverProfile(ctx, auth);
  const body = (await readJsonBody(ctx.request)) as Record<string, unknown>;
  const plate = typeof body.plate === "string" && body.plate.trim().length >= 2 ? body.plate.trim() : null;
  const vehicleType =
    typeof body.vehicleType === "string" && body.vehicleType.trim().length >= 2
      ? body.vehicleType.trim()
      : null;
  if (!plate || !vehicleType) throw new HttpError(400, "bad_request", { field: "vehicle" });
  const proofMediaId = typeof body.ownershipProofMediaId === "string" ? body.ownershipProofMediaId : null;
  if (proofMediaId) {
    const media = await db(ctx)
      .prepare("SELECT id, owner_identity_id, purpose FROM media_object WHERE id = ?")
      .bind(proofMediaId)
      .first<Record<string, unknown>>();
    if (
      !media ||
      String(media.owner_identity_id) !== auth.identityId ||
      String(media.purpose) !== "driver_vehicle_proof"
    ) {
      throw new HttpError(404, "not_found");
    }
  }
  const now = nowMs();
  if (proofMediaId) {
    // OD28: the vehicle ownership/permission proof is tracked as a
    // vehicle_ownership evidence row so its status and expiry (when clear)
    // participate in the OD30 eligibility gate.
    await db(ctx)
      .prepare("DELETE FROM driver_evidence WHERE driver_profile_id = ? AND category = 'vehicle_ownership'")
      .bind(driverProfileId)
      .run();
    await db(ctx)
      .prepare(
        "INSERT INTO driver_evidence (id, driver_profile_id, category, media_id, status, created_at, updated_at) VALUES (?, ?, 'vehicle_ownership', ?, 'pending', ?, ?)",
      )
      .bind(newId("evd", randomToken), driverProfileId, proofMediaId, now, now)
      .run();
  }
  const existing = await db(ctx)
    .prepare("SELECT id FROM driver_vehicle WHERE driver_profile_id = ?")
    .bind(driverProfileId)
    .first<Record<string, unknown>>();
  if (existing) {
    await db(ctx)
      .prepare(
        "UPDATE driver_vehicle SET info_json = ?, ownership_proof_media_id = ?, status = 'pending', updated_at = ? WHERE id = ?",
      )
      .bind(JSON.stringify({ plate, vehicleType }), proofMediaId, now, String(existing.id))
      .run();
    return jsonResponse({ vehicleId: String(existing.id) });
  }
  const id = newId("veh", randomToken);
  await db(ctx)
    .prepare(
      "INSERT INTO driver_vehicle (id, driver_profile_id, info_json, ownership_proof_media_id, status, created_at, updated_at) VALUES (?, ?, ?, ?, 'pending', ?, ?)",
    )
    .bind(id, driverProfileId, JSON.stringify({ plate, vehicleType }), proofMediaId, now, now)
    .run();
  return jsonResponse({ vehicleId: id }, 201);
}

/** POST /api/driver/evidence — attach an evidence image to a category (OD28). */
export async function saveDriverEvidence(ctx: RouteContext, auth: AuthenticatedContext): Promise<Response> {
  const driverProfileId = await requireDriverProfile(ctx, auth);
  const body = (await readJsonBody(ctx.request)) as Record<string, unknown>;
  const category = body.category;
  if (category !== "identity" && category !== "license" && category !== "vehicle_ownership") {
    throw new HttpError(400, "bad_request", { field: "category" });
  }
  const mediaId = typeof body.mediaId === "string" ? body.mediaId : null;
  const expiresAt = typeof body.expiresAt === "number" && body.expiresAt > 0 ? body.expiresAt : null;
  if (!mediaId) throw new HttpError(400, "bad_request", { field: "mediaId" });
  const media = await db(ctx)
    .prepare("SELECT id, owner_identity_id, purpose FROM media_object WHERE id = ?")
    .bind(mediaId)
    .first<Record<string, unknown>>();
  if (
    !media ||
    String(media.owner_identity_id) !== auth.identityId ||
    String(media.purpose) !== "driver_evidence"
  ) {
    throw new HttpError(404, "not_found");
  }
  // One active evidence row per category: replace pending/old with a new upload.
  await db(ctx)
    .prepare("DELETE FROM driver_evidence WHERE driver_profile_id = ? AND category = ?")
    .bind(driverProfileId, category)
    .run();
  const id = newId("evd", randomToken);
  const now = nowMs();
  await db(ctx)
    .prepare(
      "INSERT INTO driver_evidence (id, driver_profile_id, category, media_id, status, expires_at, created_at, updated_at) VALUES (?, ?, ?, ?, 'pending', ?, ?, ?)",
    )
    .bind(id, driverProfileId, category, mediaId, expiresAt, now, now)
    .run();
  return jsonResponse({ evidence: { id, status: "pending" } }, 201);
}

/** POST /api/driver/submit — submit the application for manual review (OD22). */
export async function submitDriverApplication(
  ctx: RouteContext,
  auth: AuthenticatedContext,
): Promise<Response> {
  const driverProfileId = await requireDriverProfile(ctx, auth);
  const profile = await db(ctx)
    .prepare("SELECT status FROM driver_profile WHERE id = ?")
    .bind(driverProfileId)
    .first<Record<string, unknown>>();
  const status = String(profile?.status);
  if (status !== "draft" && status !== "changes_requested") {
    throw new HttpError(409, "conflict", { reason: `driver_status_${status}` });
  }
  const evidence = await db(ctx)
    .prepare(
      "SELECT category FROM driver_evidence WHERE driver_profile_id = ? AND category IN ('identity','license')",
    )
    .bind(driverProfileId)
    .all<Record<string, unknown>>();
  const categories = new Set(evidence.results.map(row => String(row.category)));
  if (!categories.has("identity") || !categories.has("license")) {
    throw new HttpError(400, "bad_request", { reason: "identity_and_license_required" });
  }
  const now = nowMs();
  await db(ctx)
    .prepare("UPDATE driver_profile SET status = 'submitted', submitted_at = ?, updated_at = ? WHERE id = ?")
    .bind(now, now, driverProfileId)
    .run();
  await audit(
    db(ctx),
    {
      actorIdentityId: auth.identityId,
      action: "driver_application_submitted",
      objectType: "driver_profile",
      objectId: driverProfileId,
      result: "success",
    },
    now,
  );
  return jsonResponse({ ok: true });
}

/** POST /api/driver/accepting-new — the service toggle (approval ≠ readiness). */
export async function setAcceptingNew(ctx: RouteContext, auth: AuthenticatedContext): Promise<Response> {
  const driverProfileId = await requireDriverProfile(ctx, auth);
  const status = await driverStatus(db(ctx), auth.identityId, nowMs());
  if (!status || status.profileStatus !== "approved") {
    throw new HttpError(409, "conflict", { reason: "approval_required" });
  }
  const body = (await readJsonBody(ctx.request)) as { accepting?: boolean };
  const accepting = body.accepting === true ? 1 : 0;
  await db(ctx)
    .prepare("UPDATE driver_profile SET accepting_new = ?, updated_at = ? WHERE id = ?")
    .bind(accepting, nowMs(), driverProfileId)
    .run();
  return jsonResponse({ ok: true, acceptingNew: accepting === 1 });
}
