/**
 * Platform Admin panel (Post-Group 6 continuous completion — WS-251/DOC-041,
 * owner order 7593b9c4 §4 G02): ONLY the Q129-defined pieces, built as a
 * separate unit (this module + the /admin client unit) so it can be split
 * out later exactly as the decision requires:
 *
 *   «لوحة المشرف داخل نفس التطبيق، بمسار وتخطيط خاصين ومحمية من الخادم…
 *    تشمل: كل الطوابير مع عمر كل عنصر. البحث عن مستخدم بالاسم أو البريد
 *    أو الهاتف. سجل القرارات. إيقاف هوية كاملة بسبب. إلغاء حجز جارٍ
 *    بقرار إداري مع سبب. أرقام تشغيلية بسيطة (Q154).»
 *
 * Least privilege (order §4 G02): the admin gains NO Manage financial access
 * here — nothing in this module reads or writes manage_record; every route is
 * admin-only and the consequential actions (suspension, administrative
 * cancel) are audited. Suspension never auto-cancels an ongoing booking
 * (final decision ج) — the administrative cancel is a separate explicit
 * action that notifies the booker immediately with the reason.
 */

import { audit } from "../audit.ts";
import { nowMs } from "../clock.ts";
import { randomToken } from "../crypto.ts";
import { newId, type Db } from "../db/db.ts";
import { HttpError, jsonResponse } from "../http.ts";
import { readJsonBody, type RouteContext } from "../router.ts";
import type { AuthenticatedContext } from "../auth/session.ts";

function db(ctx: RouteContext): Db {
  return ctx.env.DB;
}

function requireAdmin(auth: AuthenticatedContext): void {
  if (!auth.isAdmin) throw new HttpError(403, "forbidden", { reason: "admin_only" });
}

/** The ongoing-booking set — the only states an administrative cancel may act on. */
const ONGOING_BOOKING_STATUSES =
  "('awaiting_driver_response','awaiting_requester_decision','confirmed')" as const;

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * GET /api/admin/panel/queues — «كل الطوابير مع عمر كل عنصر» + «أرقام
 * تشغيلية بسيطة (Q154)»: every review/queue surface in one admin view, each
 * item with its server-clock age, plus the honest operational counts (the
 * same counting rules as the dedicated endpoints — never a launch-threshold
 * claim).
 */
export async function adminPanelQueues(ctx: RouteContext, auth: AuthenticatedContext): Promise<Response> {
  requireAdmin(auth);
  const now = nowMs();
  const marketListings = await db(ctx)
    .prepare(
      "SELECT id, title, submitted_at FROM supplier_listing " +
        "WHERE status = 'submitted' OR revision_status IN ('submitted','renewal_requested') ORDER BY submitted_at LIMIT 100",
    )
    .all<Record<string, unknown>>();
  const marketMedia = await db(ctx)
    .prepare(
      "SELECT id, created_at FROM media_object WHERE status = 'pending' AND purpose = 'market_listing_media' ORDER BY created_at LIMIT 100",
    )
    .all<Record<string, unknown>>();
  const marketReports = await db(ctx)
    .prepare(
      "SELECT id, object_id, reason, created_at FROM market_report WHERE status = 'open' ORDER BY created_at LIMIT 100",
    )
    .all<Record<string, unknown>>();
  const driverApplications = await db(ctx)
    .prepare(
      "SELECT id, submitted_at FROM driver_profile WHERE status = 'submitted' ORDER BY submitted_at LIMIT 100",
    )
    .all<Record<string, unknown>>();
  const driverEvidence = await db(ctx)
    .prepare(
      "SELECT e.id, e.driver_profile_id, e.category, e.created_at FROM driver_evidence e " +
        "JOIN driver_profile p ON p.id = e.driver_profile_id WHERE e.status = 'pending' AND p.status IN ('submitted','approved','under_review') ORDER BY e.created_at LIMIT 100",
    )
    .all<Record<string, unknown>>();
  const driverVehicles = await db(ctx)
    .prepare(
      "SELECT v.id, v.driver_profile_id, v.created_at FROM driver_vehicle v " +
        "JOIN driver_profile p ON p.id = v.driver_profile_id WHERE v.status = 'pending' AND p.status IN ('submitted','approved','under_review') ORDER BY v.created_at LIMIT 100",
    )
    .all<Record<string, unknown>>();
  const openCases = await db(ctx)
    .prepare(
      "SELECT id, request_id, reason, created_at FROM delivery_case WHERE status = 'open' ORDER BY created_at LIMIT 100",
    )
    .all<Record<string, unknown>>();
  /* Q154 — الأرقام التشغيلية الصادقة نفسها (قواعد العد الموثقة نفسها؛
   * عتبة الإطلاق قرار مالك على حسابات حقيقية لا ادعاء هنا أبدًا). */
  const countedSuppliers = await db(ctx)
    .prepare(
      "SELECT COUNT(DISTINCT p.id) AS n FROM supplier_profile p WHERE p.status = 'active' " +
        "AND p.terms_accepted_at IS NOT NULL " +
        "AND EXISTS (SELECT 1 FROM supplier_listing l WHERE l.supplier_profile_id = p.id " +
        "AND l.status = 'approved_for_publish' AND l.published_at IS NOT NULL AND l.verification_call_at IS NOT NULL)",
    )
    .first<Record<string, unknown>>();
  const activeDrivers = await db(ctx)
    .prepare("SELECT COUNT(*) AS n FROM driver_profile WHERE status = 'approved'")
    .first<Record<string, unknown>>();
  const weeklyBookings = await db(ctx)
    .prepare("SELECT COUNT(*) AS n FROM delivery_request WHERE created_at >= ?")
    .bind(now - 7 * DAY_MS)
    .first<Record<string, unknown>>();
  const suspendedIdentities = await db(ctx)
    .prepare("SELECT COUNT(*) AS n FROM identity_suspension WHERE lifted_at IS NULL")
    .first<Record<string, unknown>>();

  const age = (value: unknown): number | null => (value === null ? null : now - Number(value));
  return jsonResponse({
    queues: {
      marketListings: marketListings.results.map(row => ({
        id: String(row.id),
        title: String(row.title),
        ageMs: age(row.submitted_at),
      })),
      marketMedia: marketMedia.results.map(row => ({ id: String(row.id), ageMs: age(row.created_at) })),
      marketReports: marketReports.results.map(row => ({
        id: Number(row.id),
        objectId: String(row.object_id),
        reason: String(row.reason),
        ageMs: age(row.created_at),
      })),
      driverApplications: driverApplications.results.map(row => ({
        id: String(row.id),
        ageMs: age(row.submitted_at),
      })),
      driverEvidence: driverEvidence.results.map(row => ({
        id: String(row.id),
        driverProfileId: String(row.driver_profile_id),
        category: String(row.category),
        /* Owner supplement §10.3-9 (Q129 «كل الطوابير مع عمر كل عنصر»): the
         * age of EVERY queue item — driver evidence and vehicles included. */
        ageMs: age(row.created_at),
      })),
      driverVehicles: driverVehicles.results.map(row => ({
        id: String(row.id),
        driverProfileId: String(row.driver_profile_id),
        ageMs: age(row.created_at),
      })),
      openCases: openCases.results.map(row => ({
        id: Number(row.id),
        requestId: String(row.request_id),
        reason: String(row.reason),
        ageMs: age(row.created_at),
      })),
    },
    opsCounts: {
      activeSuppliers: Number(countedSuppliers?.n ?? 0),
      activeDrivers: Number(activeDrivers?.n ?? 0),
      weeklyBookings: Number(weeklyBookings?.n ?? 0),
      suspendedIdentities: Number(suspendedIdentities?.n ?? 0),
      launchThreshold: { suppliers: 10, drivers: 5, governorates: 12 },
    },
    computedAt: now,
  });
}

/**
 * GET /api/admin/panel/user-search?q= — «البحث عن مستخدم بالاسم أو البريد
 * أو الهاتف»: name/email over network_identity, phone over the profile work
 * copies (the only places a phone lives). Bounded result, admin-only, with
 * the honest role/suspension state per match.
 */
export async function adminUserSearch(ctx: RouteContext, auth: AuthenticatedContext): Promise<Response> {
  requireAdmin(auth);
  const q = (ctx.url.searchParams.get("q") ?? "").trim();
  if (q.length < 2) throw new HttpError(400, "bad_request", { field: "q" });
  const like = `%${q.toLowerCase()}%`;
  const rows = await db(ctx)
    .prepare(
      "SELECT i.id, i.display_name, i.email, i.created_at, " +
        "(SELECT COUNT(*) FROM network_membership m WHERE m.identity_id = i.id AND m.role = 'admin' AND m.status = 'active') AS is_admin, " +
        "(SELECT p.status FROM supplier_profile p WHERE p.identity_id = i.id ORDER BY p.created_at DESC, p.id DESC LIMIT 1) AS vendor_status, " +
        "(SELECT d.status FROM driver_profile d WHERE d.identity_id = i.id ORDER BY d.created_at DESC, d.id DESC LIMIT 1) AS driver_status, " +
        "(SELECT s.reason FROM identity_suspension s WHERE s.identity_id = i.id AND s.lifted_at IS NULL LIMIT 1) AS suspension_reason, " +
        "(SELECT p.work_copy_json FROM supplier_profile p WHERE p.identity_id = i.id ORDER BY p.created_at LIMIT 1) AS vendor_work, " +
        "(SELECT d.work_copy_json FROM driver_profile d WHERE d.identity_id = i.id LIMIT 1) AS driver_work " +
        "FROM network_identity i " +
        "WHERE LOWER(i.display_name) LIKE ? OR LOWER(i.email) LIKE ? OR LOWER(COALESCE(i.email,'')) LIKE ? " +
        "ORDER BY i.created_at DESC LIMIT 20",
    )
    .bind(like, like, like)
    .all<Record<string, unknown>>();
  /* The phone dimension: matched over the profile work copies (the only
   * places a phone lives — Q129's search surface), appended to the identity
   * matches so one query covers name/email OR phone. */
  const phoneRows = await db(ctx)
    .prepare(
      "SELECT i.id, i.display_name, i.email, i.created_at, 'phone' AS matched_by, " +
        "(SELECT COUNT(*) FROM network_membership m WHERE m.identity_id = i.id AND m.role = 'admin' AND m.status = 'active') AS is_admin, " +
        "(SELECT p.status FROM supplier_profile p WHERE p.identity_id = i.id ORDER BY p.created_at DESC, p.id DESC LIMIT 1) AS vendor_status, " +
        "(SELECT d.status FROM driver_profile d WHERE d.identity_id = i.id ORDER BY d.created_at DESC, d.id DESC LIMIT 1) AS driver_status, " +
        "(SELECT s.reason FROM identity_suspension s WHERE s.identity_id = i.id AND s.lifted_at IS NULL LIMIT 1) AS suspension_reason " +
        "FROM network_identity i " +
        "WHERE EXISTS (SELECT 1 FROM supplier_profile p WHERE p.identity_id = i.id AND LOWER(p.work_copy_json) LIKE ?) " +
        "OR EXISTS (SELECT 1 FROM driver_profile d WHERE d.identity_id = i.id AND LOWER(d.work_copy_json) LIKE ?) " +
        "ORDER BY i.created_at DESC LIMIT 20",
    )
    .bind(like, like)
    .all<Record<string, unknown>>();
  const byId = new Map<string, Record<string, unknown>>();
  for (const row of [...rows.results, ...phoneRows.results]) {
    const id = String(row.id);
    if (!byId.has(id)) byId.set(id, row);
    else if (String(row.matched_by) === "phone") byId.get(id)!.matched_by = "phone";
  }
  return jsonResponse({
    query: q,
    users: [...byId.values()].slice(0, 20).map(row => ({
      identityId: String(row.id),
      displayName: String(row.display_name),
      email: String(row.email),
      createdAt: Number(row.created_at),
      isAdmin: Number(row.is_admin) > 0,
      vendorStatus:
        row.vendor_status === null || row.vendor_status === undefined ? null : String(row.vendor_status),
      driverStatus:
        row.driver_status === null || row.driver_status === undefined ? null : String(row.driver_status),
      suspended: row.suspension_reason !== null && row.suspension_reason !== undefined,
      suspensionReason:
        row.suspension_reason === null || row.suspension_reason === undefined
          ? null
          : String(row.suspension_reason),
      matchedBy: String(row.matched_by ?? "name-email"),
    })),
  });
}

/**
 * GET /api/admin/panel/decisions — «سجل القرارات»: the latest administrative
 * decisions (the audit events an ACTIVE admin identity performed), each with
 * its age — the panel's single view over the append-only audit trail.
 */
export async function adminDecisionsLog(ctx: RouteContext, auth: AuthenticatedContext): Promise<Response> {
  requireAdmin(auth);
  const now = nowMs();
  const rows = await db(ctx)
    .prepare(
      "SELECT e.id, e.actor_identity_id, e.action, e.object_type, e.object_id, e.result, e.created_at, e.meta_json, " +
        "(SELECT i.display_name FROM network_identity i WHERE i.id = e.actor_identity_id) AS actor_name, " +
        "(SELECT COUNT(*) FROM network_membership m WHERE m.identity_id = e.actor_identity_id AND m.role = 'admin' AND m.status = 'active') AS actor_is_admin " +
        "FROM network_audit_event e WHERE e.actor_identity_id IS NOT NULL " +
        "AND EXISTS (SELECT 1 FROM network_membership m WHERE m.identity_id = e.actor_identity_id AND m.role = 'admin' AND m.status = 'active') " +
        "ORDER BY e.created_at DESC, e.id DESC LIMIT 100",
    )
    .all<Record<string, unknown>>();
  return jsonResponse({
    decisions: rows.results.map(row => {
      let meta: Record<string, unknown> | null = null;
      if (row.meta_json !== null && row.meta_json !== undefined) {
        try {
          meta = JSON.parse(String(row.meta_json)) as Record<string, unknown>;
        } catch {
          meta = null;
        }
      }
      return {
        id: Number(row.id),
        actorName: row.actor_name === null || row.actor_name === undefined ? null : String(row.actor_name),
        action: String(row.action),
        objectType: String(row.object_type),
        objectId: row.object_id === null ? null : String(row.object_id),
        result: String(row.result),
        ageMs: now - Number(row.created_at),
        reason: meta !== null && typeof meta.reason === "string" ? meta.reason : null,
      };
    }),
  });
}

/**
 * POST /api/admin/panel/identities/:id/suspend — «إيقاف هوية كاملة بسبب»:
 * the full-identity suspension with a REQUIRED reason. Revokes every active
 * session immediately (fail-closed at resolveSession too); never cancels an
 * ongoing booking (final decision ج — the booking completes; the danger case
 * is the separate administrative cancel); an active ADMIN identity is never a
 * target (lockout protection). Audited. Lifting is not in the Q129 closed
 * set — no endpoint invents it.
 */
export async function suspendIdentity(ctx: RouteContext, auth: AuthenticatedContext): Promise<Response> {
  requireAdmin(auth);
  const body = (await readJsonBody(ctx.request)) as { reason?: unknown };
  const reason = typeof body.reason === "string" ? body.reason.trim().slice(0, 500) : "";
  if (reason.length < 4) throw new HttpError(400, "bad_request", { field: "reason" });
  const targetId = ctx.params.id!;
  const now = nowMs();
  const target = await db(ctx)
    .prepare(
      "SELECT i.id, " +
        "(SELECT COUNT(*) FROM network_membership m WHERE m.identity_id = i.id AND m.role = 'admin' AND m.status = 'active') AS is_admin " +
        "FROM network_identity i WHERE i.id = ?",
    )
    .bind(targetId)
    .first<Record<string, unknown>>();
  if (!target) throw new HttpError(404, "not_found");
  if (Number(target.is_admin) > 0) {
    throw new HttpError(403, "forbidden", { reason: "admin_identity_not_suspendable" });
  }
  const already = await db(ctx)
    .prepare("SELECT id FROM identity_suspension WHERE identity_id = ? AND lifted_at IS NULL")
    .bind(targetId)
    .first<Record<string, unknown>>();
  if (already) throw new HttpError(409, "conflict", { reason: "already_suspended" });
  const id = newId("sus", randomToken);
  await db(ctx)
    .prepare(
      "INSERT INTO identity_suspension (id, identity_id, reason, suspended_by, suspended_at) VALUES (?, ?, ?, ?, ?)",
    )
    .bind(id, targetId, reason, auth.identityId, now)
    .run();
  /* The immediate effect: every active session of the identity is revoked —
   * the account stops acting NOW; the sign-in refusal carries the reason. */
  await db(ctx)
    .prepare("UPDATE network_session SET revoked_at = ? WHERE identity_id = ? AND revoked_at IS NULL")
    .bind(now, targetId)
    .run();
  await audit(
    db(ctx),
    {
      actorIdentityId: auth.identityId,
      action: "identity_suspended",
      objectType: "network_identity",
      objectId: targetId,
      result: "success",
      meta: { reason },
    },
    now,
  );
  return jsonResponse({ ok: true, suspended: targetId }, 201);
}

/**
 * POST /api/admin/panel/identities/:id/lift-suspension — owner supplement
 * §10.1-2 (2026-11-22): the audited Admin action to LIFT an identity
 * suspension, recording the reason, the Admin identity, and the timestamp.
 * Lifting restores access ONLY through roles that remain active and
 * approved (suspension never changed profile statuses — the lift ends the
 * block and each role's CURRENT state governs); removed roles are never
 * restored and bookings are never touched. Revoked sessions stay revoked —
 * the user signs in again. The lift + its audit commit atomically.
 */
export async function liftIdentitySuspension(
  ctx: RouteContext,
  auth: AuthenticatedContext,
): Promise<Response> {
  requireAdmin(auth);
  const body = (await readJsonBody(ctx.request)) as { reason?: unknown };
  const reason = typeof body.reason === "string" ? body.reason.trim().slice(0, 500) : "";
  if (reason.length < 4) throw new HttpError(400, "bad_request", { field: "reason" });
  const targetId = ctx.params.id!;
  const now = nowMs();
  const active = await db(ctx)
    .prepare("SELECT id FROM identity_suspension WHERE identity_id = ? AND lifted_at IS NULL")
    .bind(targetId)
    .first<Record<string, unknown>>();
  if (!active) {
    /* The honest distinction the decision requires: an identity whose
     * suspension was ALREADY lifted is a conflict (the record exists, the
     * state is wrong); an identity with NO suspension record at all is
     * simply not found. */
    const latest = await db(ctx)
      .prepare(
        "SELECT id, lifted_at FROM identity_suspension WHERE identity_id = ? ORDER BY suspended_at DESC LIMIT 1",
      )
      .bind(targetId)
      .first<Record<string, unknown>>();
    if (latest) throw new HttpError(409, "conflict", { reason: "suspension_already_lifted" });
    throw new HttpError(404, "not_found", { reason: "no_active_suspension" });
  }
  const auditStatement = db(ctx)
    .prepare(
      "INSERT INTO network_audit_event (actor_identity_id, action, object_type, object_id, result, created_at, meta_json) " +
        "SELECT ?, 'identity_suspension_lifted', 'network_identity', ?, 'success', ?, ? " +
        "WHERE EXISTS (SELECT 1 FROM identity_suspension WHERE id = ? AND lifted_at IS NOT NULL AND lifted_at = ?)",
    )
    .bind(auth.identityId, targetId, now, JSON.stringify({ reason }), String(active.id), now);
  /* Atomic (§10.3-10): the CAS lift and its audit commit in ONE PostgreSQL
   * transaction; the audit row exists only when the lift actually happened
   * (the EXISTS guard rides the lifted_at marker the UPDATE just wrote). */
  const results = await db(ctx).batch([
    db(ctx)
      .prepare(
        "UPDATE identity_suspension SET lifted_at = ?, lifted_by = ?, lift_reason = ? WHERE id = ? AND lifted_at IS NULL",
      )
      .bind(now, auth.identityId, reason, String(active.id)),
    auditStatement,
  ]);
  if (Number(results[0]?.meta?.changes ?? 0) !== 1) {
    throw new HttpError(409, "conflict", { reason: "suspension_already_lifted" });
  }
  if (Number(results[1]?.meta?.changes ?? 0) !== 1) {
    throw new HttpError(500, "internal", { reason: "lift_audit_missing" });
  }
  /* The honest current-role report: which roles the user REGAINS access
   * through (still active/approved) and which stay removed — never a
   * restoration claim. */
  const roles = await db(ctx)
    .prepare(
      "SELECT " +
        "(SELECT p.status FROM supplier_profile p WHERE p.identity_id = ? ORDER BY p.created_at DESC, p.id DESC LIMIT 1) AS vendor_status, " +
        "(SELECT d.status FROM driver_profile d WHERE d.identity_id = ? ORDER BY d.created_at DESC, d.id DESC LIMIT 1) AS driver_status, " +
        "(SELECT COUNT(*) FROM workspace_member m WHERE m.identity_id = ? AND m.role = 'owner' AND m.status = 'active') AS owner_active",
    )
    .bind(targetId, targetId, targetId)
    .first<Record<string, unknown>>();
  const vendorStatus =
    roles?.vendor_status === null || roles?.vendor_status === undefined ? null : String(roles.vendor_status);
  const driverStatus =
    roles?.driver_status === null || roles?.driver_status === undefined ? null : String(roles.driver_status);
  return jsonResponse({
    ok: true,
    lifted: targetId,
    liftedAt: now,
    rolesRegained: {
      owner: Number(roles?.owner_active ?? 0) > 0,
      supplier: vendorStatus === "active",
      driver: driverStatus === "approved",
    },
    rolesNotRestored: {
      supplier: vendorStatus === "removed" ? "removed_stays_removed" : null,
      driver: driverStatus === "removed" ? "removed_stays_removed" : null,
    },
    bookingsUntouched: true,
  });
}

/**
 * POST /api/admin/panel/delivery/requests/:id/admin-cancel — «إلغاء حجز
 * جارٍ بقرار إداري مع سبب» (final decision ج): an ONGOING booking only,
 * with a REQUIRED reason, CAS on the current status, an event on the
 * request's audit axis, the booker notified immediately («يُبلَّغ صاحب الحجز
 * فورًا»), and the administrative decision audited. The driver's own record
 * of the cancelled booking stays (never deleted).
 */
export async function adminCancelBooking(ctx: RouteContext, auth: AuthenticatedContext): Promise<Response> {
  requireAdmin(auth);
  const body = (await readJsonBody(ctx.request)) as { reason?: unknown };
  const reason = typeof body.reason === "string" ? body.reason.trim().slice(0, 500) : "";
  if (reason.length < 4) throw new HttpError(400, "bad_request", { field: "reason" });
  const requestId = ctx.params.id!;
  const now = nowMs();
  const row = await db(ctx)
    .prepare(
      `SELECT id, requester_identity_id, driver_profile_id, status FROM delivery_request WHERE id = ? AND status IN ${ONGOING_BOOKING_STATUSES}`,
    )
    .bind(requestId)
    .first<Record<string, unknown>>();
  if (!row) throw new HttpError(404, "not_found", { reason: "ongoing_booking_required" });
  const from = String(row.status);
  /* Atomic (owner supplement §10.3-10, 2026-11-22): the CAS state change, the
   * request-axis event, the REQUIRED booker notification, and the admin audit
   * commit in ONE PostgreSQL transaction — the event/notification/audit
   * inserts ride an EXISTS guard on the cancellation marker (status='cancelled'
   * AND updated_at=now) so they exist ONLY when the cancellation itself happened;
   * any statement failure rolls the whole transaction back (all-or-nothing). */
  const results = await db(ctx).batch([
    db(ctx)
      .prepare("UPDATE delivery_request SET status = 'cancelled', updated_at = ? WHERE id = ? AND status = ?")
      .bind(now, requestId, from),
    db(ctx)
      .prepare(
        "INSERT INTO delivery_event (request_id, actor_identity_id, axis, event_type, from_value, to_value, reason, created_at) " +
          "SELECT ?, ?, 'request', 'admin_cancelled', ?, 'cancelled', ?, ? " +
          "WHERE EXISTS (SELECT 1 FROM delivery_request WHERE id = ? AND status = 'cancelled' AND updated_at = ?)",
      )
      .bind(requestId, auth.identityId, from, reason, now, requestId, now),
    db(ctx)
      .prepare(
        "INSERT INTO network_notification (identity_id, type, target_path, payload_json, created_at, idempotency_key) " +
          "SELECT ?, 'status_changed', ?, ?, ?, ? " +
          "WHERE EXISTS (SELECT 1 FROM delivery_request WHERE id = ? AND status = 'cancelled' AND updated_at = ?) " +
          "ON CONFLICT DO NOTHING",
      )
      .bind(
        String(row.requester_identity_id),
        `/delivery/booking/${requestId}`,
        JSON.stringify({ requestId, reason, by: "admin" }),
        now,
        `admin-cancel:${requestId}`,
        requestId,
        now,
      ),
    db(ctx)
      .prepare(
        "INSERT INTO network_audit_event (actor_identity_id, action, object_type, object_id, result, created_at, meta_json) " +
          "SELECT ?, 'admin_booking_cancelled', 'delivery_request', ?, 'success', ?, ? " +
          "WHERE EXISTS (SELECT 1 FROM delivery_request WHERE id = ? AND status = 'cancelled' AND updated_at = ?)",
      )
      .bind(auth.identityId, requestId, now, JSON.stringify({ reason, from }), requestId, now),
  ]);
  if (Number(results[0]?.meta?.changes ?? 0) !== 1) {
    throw new HttpError(409, "conflict", { reason: "request_state_changed" });
  }
  if (Number(results[1]?.meta?.changes ?? 0) !== 1 || Number(results[3]?.meta?.changes ?? 0) !== 1) {
    // The transaction committed the cancellation but its event/audit rider
    // did not fire — an honest 500, never a silent partial state.
    throw new HttpError(500, "internal", { reason: "cancel_evidence_missing" });
  }
  return jsonResponse({ ok: true, cancelled: requestId, from });
}
