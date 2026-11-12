/**
 * Delivery review API (admin — OD17/OD22/OD28–OD31) + owner statement
 * confirmation (OD13) + rating comment moderation. Administrative decisions
 * only: the reviewer never confirms money/receipt on a party's behalf and
 * never auto-closes work; evidence expiry is recorded only when clear.
 */

import { audit, notify } from "../audit.ts";
import { nowMs } from "../clock.ts";
import type { Db } from "../db/d1.ts";
import { HttpError, jsonResponse } from "../http.ts";
import { readJsonBody, type RouteContext } from "../router.ts";
import type { AuthenticatedContext } from "../auth/session.ts";

function db(ctx: RouteContext): Db {
  return ctx.env.DB;
}

function requireAdmin(auth: AuthenticatedContext): void {
  if (!auth.isAdmin) throw new HttpError(403, "forbidden", { reason: "admin_only" });
}

/** GET /api/delivery/review/queue — pending driver applications + ratings. */
export async function deliveryReviewQueue(ctx: RouteContext, auth: AuthenticatedContext): Promise<Response> {
  requireAdmin(auth);
  const drivers = await db(ctx)
    .prepare(
      "SELECT id, identity_id, status, work_copy_json, submitted_at FROM driver_profile WHERE status = 'submitted' ORDER BY submitted_at",
    )
    .all<Record<string, unknown>>();
  const evidence = await db(ctx)
    .prepare(
      "SELECT e.id, e.driver_profile_id, e.category, e.status, e.expires_at, e.media_id FROM driver_evidence e " +
        "JOIN driver_profile p ON p.id = e.driver_profile_id WHERE e.status = 'pending' AND p.status IN ('submitted','approved','under_review')",
    )
    .all<Record<string, unknown>>();
  const vehicles = await db(ctx)
    .prepare(
      "SELECT v.id, v.driver_profile_id, v.info_json, v.status, v.ownership_proof_media_id FROM driver_vehicle v " +
        "JOIN driver_profile p ON p.id = v.driver_profile_id WHERE v.status = 'pending' AND p.status IN ('submitted','approved','under_review')",
    )
    .all<Record<string, unknown>>();
  const ratings = await db(ctx)
    .prepare(
      "SELECT id, request_id, stars, comment, status FROM task_rating WHERE status = 'pending_review' AND comment IS NOT NULL",
    )
    .all<Record<string, unknown>>();
  return jsonResponse({
    drivers: drivers.results,
    evidence: evidence.results.map(row => ({
      ...row,
      expires_at: row.expires_at === null ? null : Number(row.expires_at),
    })),
    vehicles: vehicles.results,
    ratingComments: ratings.results,
  });
}

/** POST /api/delivery/review/driver/:id — approve/changes/reject/suspend. */
export async function reviewDriver(ctx: RouteContext, auth: AuthenticatedContext): Promise<Response> {
  requireAdmin(auth);
  const body = (await readJsonBody(ctx.request)) as { action?: string; reason?: string };
  const action = body.action;
  const reason = typeof body.reason === "string" && body.reason.trim().length > 0 ? body.reason.trim() : null;
  if (!["approve", "changes_requested", "reject", "suspend_new", "unsuspend"].includes(action ?? "")) {
    throw new HttpError(400, "bad_request", { field: "action" });
  }
  if ((action === "changes_requested" || action === "reject" || action === "suspend_new") && !reason) {
    throw new HttpError(400, "bad_request", { field: "reason" });
  }
  const now = nowMs();
  const driver = await db(ctx)
    .prepare("SELECT id, identity_id, status FROM driver_profile WHERE id = ?")
    .bind(ctx.params.id!)
    .first<Record<string, unknown>>();
  if (!driver) throw new HttpError(404, "not_found");
  const driverId = String(driver.id);
  const driverIdentity = String(driver.identity_id);
  // OD22: person AND vehicle approval are both required; approving the person
  // promotes the work copy to the public copy but never grants acceptance.
  if (action === "approve") {
    const vehicle = await db(ctx)
      .prepare("SELECT status FROM driver_vehicle WHERE driver_profile_id = ? ORDER BY created_at LIMIT 1")
      .bind(driverId)
      .first<Record<string, unknown>>();
    if (!vehicle || String(vehicle.status) !== "approved") {
      throw new HttpError(409, "conflict", { reason: "vehicle_approval_required_first" });
    }
    const evidence = await db(ctx)
      .prepare(
        "SELECT category, status FROM driver_evidence WHERE driver_profile_id = ? AND category IN ('identity','license')",
      )
      .bind(driverId)
      .all<Record<string, unknown>>();
    const approved = new Set(
      evidence.results.filter(row => String(row.status) === "approved").map(row => String(row.category)),
    );
    if (!approved.has("identity") || !approved.has("license")) {
      throw new HttpError(409, "conflict", { reason: "identity_and_license_evidence_required" });
    }
    await db(ctx)
      .prepare(
        "UPDATE driver_profile SET status = 'approved', public_copy_json = work_copy_json, reviewed_by = ?, reviewed_at = ?, updated_at = ? WHERE id = ?",
      )
      .bind(auth.identityId, now, now, driverId)
      .run();
  } else if (action === "changes_requested" || action === "reject") {
    await db(ctx)
      .prepare(
        "UPDATE driver_profile SET status = ?, review_reason = ?, reviewed_by = ?, reviewed_at = ?, updated_at = ? WHERE id = ?",
      )
      .bind(action, reason, auth.identityId, now, now, driverId)
      .run();
  } else if (action === "suspend_new") {
    await db(ctx)
      .prepare(
        "UPDATE driver_profile SET status = 'suspended_new', accepting_new = 0, review_reason = ?, updated_at = ? WHERE id = ?",
      )
      .bind(reason, now, driverId)
      .run();
  } else {
    await db(ctx)
      .prepare("UPDATE driver_profile SET status = 'approved', updated_at = ? WHERE id = ?")
      .bind(now, driverId)
      .run();
  }
  await audit(
    db(ctx),
    {
      actorIdentityId: auth.identityId,
      action: `review_driver_${action}`,
      objectType: "driver_profile",
      objectId: driverId,
      result: "success",
      meta: { reason: reason ?? null },
    },
    now,
  );
  await notify(
    db(ctx),
    {
      identityId: driverIdentity,
      type: "driver_review_decision",
      targetPath: "/driver",
      payload: { action },
      idempotencyKey: `driver-decision:${driverId}:${now}`,
    },
    now,
  ).catch(() => undefined);
  return jsonResponse({ ok: true });
}

/** POST /api/delivery/review/evidence/:id — manual evidence review (OD29). */
export async function reviewEvidence(ctx: RouteContext, auth: AuthenticatedContext): Promise<Response> {
  requireAdmin(auth);
  const body = (await readJsonBody(ctx.request)) as { action?: string; reason?: string; expiresAt?: number };
  if (!["approve", "reject", "request_updated_image"].includes(body.action ?? "")) {
    throw new HttpError(400, "bad_request", { field: "action" });
  }
  const now = nowMs();
  const evidence = await db(ctx)
    .prepare("SELECT id, driver_profile_id FROM driver_evidence WHERE id = ?")
    .bind(ctx.params.id!)
    .first<Record<string, unknown>>();
  if (!evidence) throw new HttpError(404, "not_found");
  const status = body.action === "approve" ? "approved" : body.action === "reject" ? "rejected" : "pending";
  await db(ctx)
    .prepare(
      "UPDATE driver_evidence SET status = ?, reviewed_by = ?, reviewed_at = ?, review_reason = ?, expires_at = COALESCE(?, expires_at), updated_at = ? WHERE id = ?",
    )
    .bind(
      status,
      auth.identityId,
      now,
      typeof body.reason === "string" ? body.reason : null,
      typeof body.expiresAt === "number" && body.expiresAt > 0 ? body.expiresAt : null,
      now,
      String(evidence.id),
    )
    .run();
  await audit(
    db(ctx),
    {
      actorIdentityId: auth.identityId,
      action: `review_evidence_${body.action}`,
      objectType: "driver_evidence",
      objectId: String(evidence.id),
      result: "success",
    },
    now,
  );
  return jsonResponse({ ok: true });
}

/** POST /api/delivery/review/vehicle/:id — vehicle approval (OD22/OD27). */
export async function reviewVehicle(ctx: RouteContext, auth: AuthenticatedContext): Promise<Response> {
  requireAdmin(auth);
  const body = (await readJsonBody(ctx.request)) as { action?: string; reason?: string };
  if (!["approve", "reject", "request_updated_image"].includes(body.action ?? "")) {
    throw new HttpError(400, "bad_request", { field: "action" });
  }
  const now = nowMs();
  const vehicle = await db(ctx)
    .prepare("SELECT id FROM driver_vehicle WHERE id = ?")
    .bind(ctx.params.id!)
    .first<Record<string, unknown>>();
  if (!vehicle) throw new HttpError(404, "not_found");
  const status = body.action === "approve" ? "approved" : body.action === "reject" ? "rejected" : "pending";
  await db(ctx)
    .prepare("UPDATE driver_vehicle SET status = ?, updated_at = ? WHERE id = ?")
    .bind(status, now, String(vehicle.id))
    .run();
  await audit(
    db(ctx),
    {
      actorIdentityId: auth.identityId,
      action: `review_vehicle_${body.action}`,
      objectType: "driver_vehicle",
      objectId: String(vehicle.id),
      result: "success",
    },
    now,
  );
  return jsonResponse({ ok: true });
}

/** POST /api/delivery/review/rating/:id — moderate the text comment (OD17). */
export async function reviewRating(ctx: RouteContext, auth: AuthenticatedContext): Promise<Response> {
  requireAdmin(auth);
  const body = (await readJsonBody(ctx.request)) as { action?: string; reason?: string };
  if (!["publish", "reject"].includes(body.action ?? "")) {
    throw new HttpError(400, "bad_request", { field: "action" });
  }
  const rating = await db(ctx)
    .prepare("SELECT id FROM task_rating WHERE id = ?")
    .bind(ctx.params.id!)
    .first<Record<string, unknown>>();
  if (!rating) throw new HttpError(404, "not_found");
  await db(ctx)
    .prepare("UPDATE task_rating SET status = ? WHERE id = ?")
    .bind(body.action === "publish" ? "published" : "rejected", String(rating.id))
    .run();
  await audit(
    db(ctx),
    {
      actorIdentityId: auth.identityId,
      action: `review_rating_${body.action}`,
      objectType: "task_rating",
      objectId: String(rating.id),
      result: "success",
      meta: { reason: body.reason ?? null },
    },
    nowMs(),
  );
  return jsonResponse({ ok: true });
}

/** GET /api/delivery/statements — the owner's awaiting statements. */
export async function ownerStatements(ctx: RouteContext, auth: AuthenticatedContext): Promise<Response> {
  const rows = await db(ctx)
    .prepare(
      "SELECT s.id, s.driver_profile_id, s.statement_date, s.items_json, s.total_minor, s.status, s.supplement_of, s.created_at, " +
        "p.public_copy_json FROM daily_statement s JOIN driver_profile p ON p.id = s.driver_profile_id " +
        "WHERE s.requester_identity_id = ? ORDER BY s.created_at DESC LIMIT 30",
    )
    .bind(auth.identityId)
    .all<Record<string, unknown>>();
  return jsonResponse({
    statements: rows.results.map(row => ({
      id: String(row.id),
      driverProfileId: String(row.driver_profile_id),
      driverName:
        (JSON.parse(String(row.public_copy_json ?? "{}")) as { displayName?: string }).displayName ?? "",
      date: String(row.statement_date),
      items: JSON.parse(String(row.items_json)),
      totalMinor: String(row.total_minor),
      status: String(row.status),
      supplementOf: row.supplement_of === null ? null : String(row.supplement_of),
      createdAt: Number(row.created_at),
    })),
  });
}

/** POST /api/delivery/statements/:id/confirm — FULL receipt or difference (OD13). */
export async function confirmStatement(ctx: RouteContext, auth: AuthenticatedContext): Promise<Response> {
  const statement = await db(ctx)
    .prepare("SELECT id, status, requester_identity_id, driver_profile_id FROM daily_statement WHERE id = ?")
    .bind(ctx.params.id!)
    .first<Record<string, unknown>>();
  if (!statement || String(statement.requester_identity_id) !== auth.identityId)
    throw new HttpError(404, "not_found");
  if (String(statement.status) !== "awaiting_confirmation")
    throw new HttpError(409, "conflict", { reason: "already_decided" });
  const body = (await readJsonBody(ctx.request)) as { decision?: string; differenceNote?: string };
  const now = nowMs();
  if (body.decision === "full") {
    await db(ctx)
      .prepare("UPDATE daily_statement SET status = 'full_receipt_confirmed', confirmed_at = ? WHERE id = ?")
      .bind(now, String(statement.id))
      .run();
  } else if (body.decision === "difference") {
    const note =
      typeof body.differenceNote === "string" && body.differenceNote.length > 0 ? body.differenceNote : null;
    if (!note) throw new HttpError(400, "bad_request", { field: "differenceNote" });
    await db(ctx)
      .prepare("UPDATE daily_statement SET status = 'difference_recorded', difference_note = ? WHERE id = ?")
      .bind(note, String(statement.id))
      .run();
  } else {
    throw new HttpError(400, "bad_request", { field: "decision" });
  }
  const driverIdentity = await db(ctx)
    .prepare("SELECT identity_id FROM driver_profile WHERE id = ?")
    .bind(String(statement.driver_profile_id))
    .first<Record<string, unknown>>();
  if (driverIdentity) {
    await notify(
      db(ctx),
      {
        identityId: String(driverIdentity.identity_id),
        type: "status_changed",
        targetPath: "/driver",
        payload: { statementId: String(statement.id) },
        idempotencyKey: `statement-decision:${statement.id}`,
      },
      now,
    ).catch(() => undefined);
  }
  return jsonResponse({ ok: true });
}

/** GET /api/driver/statements — the driver's own statement history. */
export async function driverStatements(
  ctx: RouteContext,
  auth: AuthenticatedContext,
  driverProfileId: string,
): Promise<Response> {
  const rows = await db(ctx)
    .prepare(
      "SELECT id, requester_identity_id, statement_date, items_json, total_minor, status, confirmed_at, difference_note, created_at FROM daily_statement WHERE driver_profile_id = ? ORDER BY created_at DESC LIMIT 50",
    )
    .bind(driverProfileId)
    .all<Record<string, unknown>>();
  return jsonResponse({
    statements: rows.results.map(row => ({
      id: String(row.id),
      date: String(row.statement_date),
      items: JSON.parse(String(row.items_json)),
      totalMinor: String(row.total_minor),
      status: String(row.status),
      confirmedAt: row.confirmed_at === null ? null : Number(row.confirmed_at),
      differenceNote: row.difference_note === null ? null : String(row.difference_note),
      createdAt: Number(row.created_at),
    })),
  });
}
