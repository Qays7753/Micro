/** Delivery request lifecycle (contract 21 §3.2-2): directed drafts, the
 * 30-minute window, quote decisions with the frozen agreement copy (OD11),
 * cancellation, outcome confirmation (OD14), contact answers, known-driver
 * saving (OD03), and one-per-booking ratings (OD17). */

import { audit, notify } from "../audit.ts";
import { nowMs } from "../clock.ts";
import { randomToken } from "../crypto.ts";
import { newId, type Db } from "../db/db.ts";
import {
  loadClassFromInput,
  parseMinorAmount,
  transitionContact,
  transitionRequest,
  validateBookingWindow,
  weightBandFromInput,
  type RequestStatus,
} from "../domain/delivery.ts";
import { DRIVER_RESPONSE_WINDOW_MS } from "../env.ts";
import { dailyBucket, enforceRate, rateLimits } from "../ratelimit.ts";
import { HttpError, jsonResponse } from "../http.ts";
import { readJsonBody, type RouteContext } from "../router.ts";
import {
  buildAgreementCopy,
  CAPACITY_OVERLAP_SQL,
  driverCapacityLockStatement,
  loadRequest,
  notifyDriver,
  recordEvent,
} from "./deliveryShared.ts";
import { isAdminIdentity, requireWorkspaceContext } from "../authorization.ts";
import type { AuthenticatedContext } from "../auth/session.ts";

function db(ctx: RouteContext): Db {
  return ctx.env.DB;
}

/** MD-01 (Post-Group 6 Wave 3): the recipient-data consent policy version
 * the requester accepts at booking time. Scoped per booking, per owner, per
 * field set — recorded at creation and verified at every read. */
export const RECIPIENT_CONSENT_POLICY_VERSION = "2026-11-21";
const RECIPIENT_CONSENT_FIELDS = [
  "pickup.name",
  "pickup.address",
  "dropoff.name",
  "dropoff.phone",
  "dropoff.address",
];

/** POST /api/delivery/requests — create a DRAFT directed request (OD03). */
export async function createRequestDraft(ctx: RouteContext, auth: AuthenticatedContext): Promise<Response> {
  const limits = await rateLimits(db(ctx));
  await enforceRate(
    db(ctx),
    dailyBucket("delivery-create", auth.identityId, nowMs()),
    limits.submissionsPerDay,
    24 * 60 * 60 * 1000,
    nowMs(),
  );
  const body = (await readJsonBody(ctx.request)) as Record<string, unknown>;
  const workspaceId = typeof body.workspaceId === "string" ? body.workspaceId : null;
  if (workspaceId === null || workspaceId.length === 0) {
    // Post-Group 6 W1 (EX-D24 / AUTHZ-05 / G01): explicit active context — no
    // implicit workspace creation, no first-workspace selection.
    throw new HttpError(400, "workspace_context_required", { reason: "explicit_active_context" });
  }
  const driverProfileId = typeof body.driverProfileId === "string" ? body.driverProfileId : null;
  const needType =
    body.needType === "deliver_to_customer" ||
    body.needType === "fetch_ready_goods" ||
    body.needType === "period_booking"
      ? body.needType
      : null;
  if (!driverProfileId || !needType) throw new HttpError(400, "bad_request", { field: "request" });
  const driverRow = await db(ctx)
    .prepare("SELECT id, status, identity_id FROM driver_profile WHERE id = ?")
    .bind(driverProfileId)
    .first<Record<string, unknown>>();
  if (
    !driverRow ||
    String(driverRow.status) !== "approved" ||
    String(driverRow.identity_id) === auth.identityId
  ) {
    throw new HttpError(404, "not_found");
  }
  const payload = (body.payload ?? {}) as Record<string, unknown>;
  const pickup = payload.pickup as Record<string, unknown> | undefined;
  const dropoff = payload.dropoff as Record<string, unknown> | undefined;
  if (!pickup?.governorate || !dropoff?.governorate)
    throw new HttpError(400, "bad_request", { field: "zones" });
  const pricingMode =
    body.pricingMode === "prepriced" || body.pricingMode === "quote_request" ? body.pricingMode : null;
  if (!pricingMode) throw new HttpError(400, "bad_request", { field: "pricingMode" });
  const offeredFareMinor =
    pricingMode === "prepriced" ? parseMinorAmount(body.offeredFareMinor, "offeredFareMinor") : null;
  const collectionMinor =
    body.collectionMinor === undefined || body.collectionMinor === null
      ? null
      : parseMinorAmount(body.collectionMinor, "collectionMinor");
  const collectionContent =
    collectionMinor === null
      ? null
      : body.collectionContent === "product_and_fare"
        ? "product_and_fare"
        : "product";
  /* Wave 3 (Q75 — أحجام الحمولة): فئة الحمل وعدد القطع وشريحة الوزن حقول
   * إلزامية يتحقق منها الخادم لنوعي البضاعة؛ الحجز بالفترة (Q100) لا
   * يشترطها (لا بضاعة تُنقل بذاتها) ويشترط بدلها نافذة البداية/النهاية. */
  let loadClass: string | null = null;
  let weightBand: string | null = null;
  let pieceCount: number | null = null;
  if (needType !== "period_booking") {
    loadClass = loadClassFromInput(body.loadClass);
    weightBand = weightBandFromInput(body.weightBand);
    if (
      typeof body.pieceCount !== "number" ||
      !Number.isInteger(body.pieceCount) ||
      body.pieceCount < 1 ||
      body.pieceCount > 200
    ) {
      throw new HttpError(400, "bad_request", { field: "pieceCount" });
    }
    pieceCount = body.pieceCount;
  }
  /* Wave 3 (Q100/Q268): نافذة الحجز الزمنية — إلزامية للحجز بالفترة،
   * اختيارية للنوعين الآخرين (تُستخدم لفحص التداخل والسعة عند وجودها). */
  let scheduledStartAt: number | null = null;
  let scheduledEndAt: number | null = null;
  if (body.scheduledStartAt !== undefined && body.scheduledEndAt !== undefined) {
    const window = validateBookingWindow(body.scheduledStartAt, body.scheduledEndAt);
    scheduledStartAt = window.start;
    scheduledEndAt = window.end;
  } else if (needType === "period_booking") {
    throw new HttpError(400, "bad_request", {
      field: "scheduledWindow",
      reason: "period_booking_requires_window",
    });
  }
  /* Wave 3 (Q100): «حجز لفترة» — سعر متفق عليه من الطرفين وملاحظات؛ السعر
   * يمر بالمسار القائم (prepriced مع أجرة معروضة) والملاحظة داخل الحمولة. */
  if (needType === "period_booking") {
    if (typeof body.periodNotes === "string" && body.periodNotes.length > 500) {
      throw new HttpError(400, "bad_request", { field: "periodNotes", reason: "too_long" });
    }
  }
  const id = newId("dlv", randomToken);
  const now = nowMs();
  if (await isAdminIdentity(db(ctx), auth.identityId)) {
    throw new HttpError(403, "admin_identity_forbidden", {
      reason: "admin_account_holds_no_business_roles",
    });
  }
  /* AUTHZ-04 (2026-11-23): the delivery_request creator must be the PROJECT
   * OWNER of the named workspace — contract 21 binds delivery_request to
   * "صاحب المشروع" (OD02), and the owner's final decisions allow exactly one
   * owner per project with no team roles. An active membership alone is not
   * enough: a (hypothetical future) non-owner member is refused here with an
   * honest 403, not merely hidden in the UI. */
  const workspace = await requireWorkspaceContext(db(ctx), auth.identityId, workspaceId, "delivery", "owner");
  await db(ctx)
    .prepare(
      "INSERT INTO delivery_request (id, requester_identity_id, workspace_id, driver_profile_id, need_type, payload_json, collection_minor, " +
        "collection_content, pricing_mode, offered_fare_minor, load_class, piece_count, weight_band, scheduled_start_at, scheduled_end_at, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'draft', ?, ?)",
    )
    .bind(
      id,
      auth.identityId,
      workspace.workspaceId,
      driverProfileId,
      needType,
      JSON.stringify(
        needType === "period_booking" && typeof body.periodNotes === "string"
          ? { ...payload, periodNotes: body.periodNotes }
          : payload,
      ),
      collectionMinor,
      collectionContent,
      pricingMode,
      offeredFareMinor,
      loadClass,
      pieceCount,
      weightBand,
      scheduledStartAt,
      scheduledEndAt,
      now,
      now,
    )
    .run();
  /* MD-01 (Post-Group 6 Wave 3): موافقة مدى الحجز على كشف بيانات المستلم
   * للسائق المعيّن — تُسجّل بخطوة الإنشاء بإصدار السياسة وحقولها، وتُتحقق
   * عند كل قراءة؛ بلا موافقة يبقى السائق على القائمة المنقّحة. */
  if (body.recipientDataConsent === true) {
    await db(ctx)
      .prepare(
        "INSERT INTO recipient_data_consent (request_id, granted_by_identity_id, fields_json, policy_version, granted_at) VALUES (?, ?, ?, ?, ?)",
      )
      .bind(
        id,
        auth.identityId,
        JSON.stringify(RECIPIENT_CONSENT_FIELDS),
        RECIPIENT_CONSENT_POLICY_VERSION,
        now,
      )
      .run();
    await audit(
      db(ctx),
      {
        actorIdentityId: auth.identityId,
        action: "recipient_consent_granted",
        objectType: "delivery_request",
        objectId: id,
        result: "success",
        meta: { policyVersion: RECIPIENT_CONSENT_POLICY_VERSION },
      },
      now,
    );
  }
  await audit(
    db(ctx),
    {
      actorIdentityId: auth.identityId,
      action: "delivery_draft_created",
      objectType: "delivery_request",
      objectId: id,
      result: "success",
    },
    now,
  );
  return jsonResponse({ request: { id } }, 201);
}

async function loadOwnRequest(ctx: RouteContext, auth: AuthenticatedContext, requestId: string) {
  const row = await loadRequest(ctx, requestId);
  if (String(row.requester_identity_id) !== auth.identityId) throw new HttpError(404, "not_found");
  return row;
}

/** POST /api/delivery/requests/:id/recipient-consent/revoke — MD-01 (Post-Group
 * 6 Wave 3): صاحب الحجز وحده يسحب موافقة كشف بيانات المستلم؛ الوصول يقف
 * فورًا (تُتحقق الموافقة غير المسحوبة عند كل قراءة). */
export async function revokeRecipientConsent(
  ctx: RouteContext,
  auth: AuthenticatedContext,
): Promise<Response> {
  const row = await loadOwnRequest(ctx, auth, ctx.params.id!);
  const now = nowMs();
  const moved = await db(ctx)
    .prepare(
      "UPDATE recipient_data_consent SET revoked_at = ? WHERE request_id = ? AND granted_by_identity_id = ? AND revoked_at IS NULL",
    )
    .bind(now, String(row.id), auth.identityId)
    .run();
  if (Number(moved.meta?.changes ?? 0) !== 1) {
    throw new HttpError(409, "conflict", { reason: "no_active_recipient_consent" });
  }
  await recordEvent(
    ctx,
    String(row.id),
    "request",
    "recipient_consent_revoked",
    "granted",
    "revoked",
    auth.identityId,
  );
  await audit(
    db(ctx),
    {
      actorIdentityId: auth.identityId,
      action: "recipient_consent_revoked",
      objectType: "delivery_request",
      objectId: String(row.id),
      result: "success",
    },
    now,
  );
  return jsonResponse({ ok: true });
}

/** POST /api/delivery/requests/:id/submit — send the directed request (30-min window). */
export async function submitRequest(ctx: RouteContext, auth: AuthenticatedContext): Promise<Response> {
  const row = await loadOwnRequest(ctx, auth, ctx.params.id!);
  /* Owner supplement §10.3-11 (2026-11-22): the driver eligibility RECHECK at
   * submit time — the draft may have sat while the driver was removed,
   * suspended, or otherwise left 'approved'; a stale draft never submits
   * silently to a driver who can no longer take it. The check mirrors the
   * creation-time gate exactly (profile status 'approved'). */
  const driverNow = await db(ctx)
    .prepare("SELECT status FROM driver_profile WHERE id = ?")
    .bind(String(row.driver_profile_id))
    .first<Record<string, unknown>>();
  if (driverNow === null || String(driverNow.status) !== "approved") {
    throw new HttpError(409, "conflict", {
      reason: "driver_no_longer_eligible",
      message: "لم يعد السائق متاحًا لهذا الحجز (حالته تغيّرت منذ إنشاء المسودة). اختر سائقًا آخر.",
    });
  }
  const status = transitionRequest(
    { status: String(row.status) as RequestStatus, responseDeadlineAt: null, quoteValidUntil: null },
    "submit",
    nowMs(),
  );
  const now = nowMs();
  const deadline = now + DRIVER_RESPONSE_WINDOW_MS;
  await db(ctx)
    .prepare("UPDATE delivery_request SET status = ?, response_deadline_at = ?, updated_at = ? WHERE id = ?")
    .bind(status, deadline, now, String(row.id))
    .run();
  const driverIdentity = await db(ctx)
    .prepare("SELECT identity_id FROM driver_profile WHERE id = ?")
    .bind(String(row.driver_profile_id))
    .first<Record<string, unknown>>();
  if (driverIdentity) {
    await notify(
      db(ctx),
      {
        identityId: String(driverIdentity.identity_id),
        type: "booking_request_received",
        targetPath: `/driver/booking/${String(row.id)}`,
        payload: { requestId: String(row.id) },
        idempotencyKey: `request-submitted:${row.id}`,
      },
      now,
    );
  }
  return jsonResponse({ ok: true, responseDeadlineAt: deadline });
}

/** POST /api/delivery/requests/:id/withdraw — pull back before acceptance (no fee). */
export async function withdrawRequest(ctx: RouteContext, auth: AuthenticatedContext): Promise<Response> {
  const row = await loadOwnRequest(ctx, auth, ctx.params.id!);
  const next = transitionRequest(
    { status: String(row.status) as RequestStatus, responseDeadlineAt: null, quoteValidUntil: null },
    "requester_withdraw",
    nowMs(),
  );
  const moved = await db(ctx)
    .prepare(
      // Conditional update: a concurrent driver acceptance/quote wins and
      // this withdrawal becomes a 409 (spec §8 — one server-decided outcome).
      "UPDATE delivery_request SET status = ?, updated_at = ? WHERE id = ? AND status = ?",
    )
    .bind(next, nowMs(), String(row.id), String(row.status))
    .run();
  if (Number(moved.meta?.changes ?? 0) !== 1) {
    throw new HttpError(409, "conflict", { reason: "request_state_changed" });
  }
  await recordEvent(ctx, String(row.id), "request", "withdrawn", String(row.status), next, auth.identityId);
  return jsonResponse({ ok: true });
}

/** POST /api/delivery/requests/:id/accept-quote | /reject-quote (OD05). */
export async function decideQuote(
  ctx: RouteContext,
  auth: AuthenticatedContext,
  accept: boolean,
): Promise<Response> {
  const row = await loadOwnRequest(ctx, auth, ctx.params.id!);
  const event = accept ? "requester_accept_quote" : "requester_reject_quote";
  const quoteRow = row.quote_id
    ? await db(ctx)
        .prepare("SELECT valid_until FROM delivery_quote WHERE id = ?")
        .bind(String(row.quote_id))
        .first<Record<string, unknown>>()
    : null;
  const now = nowMs();
  const next = transitionRequest(
    {
      status: String(row.status) as RequestStatus,
      responseDeadlineAt: null,
      quoteValidUntil: quoteRow ? Number(quoteRow.valid_until) : null,
    },
    event,
    now,
  );
  if (accept) {
    await confirmBooking(ctx, row, now);
  } else {
    const moved = await db(ctx)
      .prepare("UPDATE delivery_request SET status = ?, updated_at = ? WHERE id = ? AND status = ?")
      .bind(next, now, String(row.id), String(row.status))
      .run();
    if (Number(moved.meta?.changes ?? 0) !== 1) {
      throw new HttpError(409, "conflict", { reason: "request_state_changed" });
    }
  }
  await recordEvent(
    ctx,
    String(row.id),
    "request",
    accept ? "quote_accepted" : "quote_rejected",
    String(row.status),
    next,
    auth.identityId,
  );
  await notifyDriver(ctx, String(row.driver_profile_id), "booking_outcome", String(row.id), now);
  return jsonResponse({ ok: true, status: next });
}

/** Confirmation writes the frozen agreement copy (OD11) atomically — with the
 * Q268 atomic capacity/overlap check riding the same conditional statement
 * under the driver's advisory lock (see deliveryShared.ts). */
async function confirmBooking(ctx: RouteContext, row: Record<string, unknown>, now: number): Promise<void> {
  const quoteRow = row.quote_id
    ? await db(ctx)
        .prepare("SELECT fare_minor, scope_json FROM delivery_quote WHERE id = ?")
        .bind(String(row.quote_id))
        .first<Record<string, unknown>>()
    : null;
  const driverProfile = await db(ctx)
    .prepare("SELECT public_copy_json FROM driver_profile WHERE id = ?")
    .bind(String(row.driver_profile_id))
    .first<Record<string, unknown>>();
  const requester = await db(ctx)
    .prepare("SELECT display_name FROM network_identity WHERE id = ?")
    .bind(String(row.requester_identity_id))
    .first<Record<string, unknown>>();
  const agreementCopy = JSON.stringify({
    needType: String(row.need_type),
    payload: JSON.parse(String(row.payload_json)),
    fareMinor: quoteRow ? String(quoteRow.fare_minor) : String(row.offered_fare_minor ?? "0"),
    quoteScope: quoteRow ? String(quoteRow.scope_json) : null,
    collectionMinor: row.collection_minor === null ? null : String(row.collection_minor),
    collectionContent: row.collection_content === null ? null : String(row.collection_content),
    driverProfileSnapshot: JSON.parse(String(driverProfile?.public_copy_json ?? "{}")),
    requesterName: String(requester?.display_name ?? ""),
    confirmedAt: now,
  });
  /* Q268 (Post-Group 6 Wave 3): قفل استشاري + UPDATE شرطي واحد يفحص السعة
   * والتداخل ذريًّا — سباق قبولي اقتباس متزامنين لنفس السائق يتحلل إلى
   * نجاح واحد و409 صادق (السعة ممتلئة أو تغيّرت الحالة). */
  const results = await db(ctx).batch([
    driverCapacityLockStatement(db(ctx), String(row.driver_profile_id)),
    db(ctx)
      .prepare(
        "UPDATE delivery_request r SET status = 'confirmed', agreement_copy_json = ?, response_deadline_at = NULL, updated_at = ? " +
          "WHERE r.id = ? AND r.status = 'awaiting_requester_decision' AND (r.scheduled_start_at IS NULL OR r.scheduled_end_at IS NULL OR " +
          CAPACITY_OVERLAP_SQL +
          ")",
      )
      .bind(agreementCopy, now, String(row.id)),
    db(ctx)
      .prepare(
        "INSERT INTO delivery_execution (request_id, execution_status, confirmation_status, contact_status, goods_location, money_status, updated_at) " +
          "VALUES (?, 'not_started', 'none', 'not_attempted', 'at_source', CASE WHEN ?::text IS NULL THEN 'none' ELSE 'agreed' END, ?) ON CONFLICT DO NOTHING",
      )
      .bind(String(row.id), row.collection_minor, now),
  ]);
  if (Number(results[1]?.meta?.changes ?? 0) !== 1) {
    const current = await db(ctx)
      .prepare("SELECT status FROM delivery_request WHERE id = ?")
      .bind(String(row.id))
      .first<{ status: string }>();
    if (current !== null && current.status === "awaiting_requester_decision") {
      throw new HttpError(409, "conflict", { reason: "driver_capacity_full" });
    }
    throw new HttpError(409, "conflict", { reason: "request_state_changed" });
  }
}

/** POST /api/delivery/requests/:id/cancel — after confirmation, per saved terms. */
export async function cancelRequest(ctx: RouteContext, auth: AuthenticatedContext): Promise<Response> {
  const row = await loadOwnRequest(ctx, auth, ctx.params.id!);
  const next = transitionRequest(
    { status: String(row.status) as RequestStatus, responseDeadlineAt: null, quoteValidUntil: null },
    "requester_cancel",
    nowMs(),
  );
  const now = nowMs();
  const moved = await db(ctx)
    .prepare("UPDATE delivery_request SET status = ?, updated_at = ? WHERE id = ? AND status = ?")
    .bind(next, now, String(row.id), String(row.status))
    .run();
  if (Number(moved.meta?.changes ?? 0) !== 1) {
    throw new HttpError(409, "conflict", { reason: "request_state_changed" });
  }
  await recordEvent(
    ctx,
    String(row.id),
    "request",
    "cancelled_by_requester",
    String(row.status),
    next,
    auth.identityId,
  );
  await notifyDriver(ctx, String(row.driver_profile_id), "booking_outcome", String(row.id), now);
  return jsonResponse({ ok: true });
}

/** POST /api/delivery/requests/:id/confirm-outcome | /object-outcome (OD14). */
export async function decideOutcome(
  ctx: RouteContext,
  auth: AuthenticatedContext,
  confirm: boolean,
): Promise<Response> {
  const row = await loadOwnRequest(ctx, auth, ctx.params.id!);
  const now = nowMs();
  const execution = await db(ctx)
    .prepare("SELECT confirmation_status, contact_status FROM delivery_execution WHERE request_id = ?")
    .bind(String(row.id))
    .first<Record<string, unknown>>();
  if (!execution || String(execution.confirmation_status) !== "awaiting_requester_confirmation") {
    throw new HttpError(409, "conflict", { reason: "no_declared_outcome_to_confirm" });
  }
  const next = confirm ? "confirmed_by_requester" : "objected";
  await db(ctx)
    .prepare("UPDATE delivery_execution SET confirmation_status = ?, updated_at = ? WHERE request_id = ?")
    .bind(next, now, String(row.id))
    .run();
  await recordEvent(
    ctx,
    String(row.id),
    "confirmation",
    confirm ? "confirmed_by_requester" : "objected",
    "awaiting_requester_confirmation",
    next,
    auth.identityId,
  );
  await notifyDriver(
    ctx,
    String(row.driver_profile_id),
    confirm ? "status_changed" : "objection_recorded",
    String(row.id),
    now,
  );
  return jsonResponse({ ok: true });
}

/** POST /api/delivery/requests/:id/contact — requester answers a contact attempt. */
export async function answerContactAttempt(ctx: RouteContext, auth: AuthenticatedContext): Promise<Response> {
  const row = await loadOwnRequest(ctx, auth, ctx.params.id!);
  const body = (await readJsonBody(ctx.request)) as { outcome?: string };
  const execution = await db(ctx)
    .prepare("SELECT contact_status FROM delivery_execution WHERE request_id = ?")
    .bind(String(row.id))
    .first<Record<string, unknown>>();
  if (!execution) throw new HttpError(409, "conflict", { reason: "no_execution" });
  // Unknown outcomes are rejected honestly instead of silently read as "denied".
  if (body.outcome !== "confirmed" && body.outcome !== "denied") {
    throw new HttpError(400, "bad_request", { field: "outcome" });
  }
  const current = String(execution.contact_status) as import("../domain/delivery.ts").ContactStatus;
  const confirmed = body.outcome === "confirmed";
  const event =
    current === "attempt_no_answer"
      ? confirmed
        ? "requester_answered"
        : "requester_denied"
      : confirmed
        ? "requester_confirmed"
        : "requester_denied";
  const next = transitionContact(current, event);
  const now = nowMs();
  await db(ctx)
    .prepare("UPDATE delivery_execution SET contact_status = ?, updated_at = ? WHERE request_id = ?")
    .bind(next, now, String(row.id))
    .run();
  await recordEvent(
    ctx,
    String(row.id),
    "contact",
    `contact_${next}`,
    String(execution.contact_status),
    next,
    auth.identityId,
  );
  return jsonResponse({ ok: true });
}

/** POST /api/delivery/drivers/:id/save — save a known driver (OD03). */
export async function toggleSavedDriver(ctx: RouteContext, auth: AuthenticatedContext): Promise<Response> {
  const driverProfileId = ctx.params.id!;
  const driver = await db(ctx)
    .prepare("SELECT id FROM driver_profile WHERE id = ? AND status = 'approved'")
    .bind(driverProfileId)
    .first();
  if (!driver) throw new HttpError(404, "not_found");
  const existing = await db(ctx)
    .prepare(
      "SELECT driver_profile_id FROM saved_driver WHERE owner_identity_id = ? AND driver_profile_id = ?",
    )
    .bind(auth.identityId, driverProfileId)
    .first();
  if (existing) {
    await db(ctx)
      .prepare("DELETE FROM saved_driver WHERE owner_identity_id = ? AND driver_profile_id = ?")
      .bind(auth.identityId, driverProfileId)
      .run();
    return jsonResponse({ saved: false });
  }
  await db(ctx)
    .prepare("INSERT INTO saved_driver (owner_identity_id, driver_profile_id, created_at) VALUES (?, ?, ?)")
    .bind(auth.identityId, driverProfileId, nowMs())
    .run();
  return jsonResponse({ saved: true });
}

/** POST /api/delivery/requests/:id/rate — one rating after confirmed delivery (OD17). */
export async function rateRequest(ctx: RouteContext, auth: AuthenticatedContext): Promise<Response> {
  const row = await loadOwnRequest(ctx, auth, ctx.params.id!);
  const body = (await readJsonBody(ctx.request)) as { stars?: number; comment?: string };
  const stars = body.stars;
  if (typeof stars !== "number" || !Number.isInteger(stars) || stars < 1 || stars > 5) {
    throw new HttpError(400, "bad_request", { field: "stars" });
  }
  const execution = await db(ctx)
    .prepare("SELECT execution_status, confirmation_status FROM delivery_execution WHERE request_id = ?")
    .bind(String(row.id))
    .first<Record<string, unknown>>();
  const delivered =
    execution !== null &&
    String(execution.execution_status) === "delivered_declared" &&
    String(execution.confirmation_status) === "confirmed_by_requester";
  if (!delivered) throw new HttpError(409, "conflict", { reason: "rating_requires_confirmed_delivery" });
  const existing = await db(ctx)
    .prepare("SELECT id FROM task_rating WHERE request_id = ?")
    .bind(String(row.id))
    .first();
  if (existing) throw new HttpError(409, "conflict", { reason: "already_rated" });
  const id = newId("rate", randomToken);
  await db(ctx)
    .prepare(
      "INSERT INTO task_rating (id, request_id, rater_identity_id, driver_profile_id, stars, comment, status, created_at) " +
        "VALUES (?, ?, ?, ?, ?, ?, 'pending_review', ?)",
    )
    .bind(
      id,
      String(row.id),
      auth.identityId,
      String(row.driver_profile_id),
      stars,
      typeof body.comment === "string" ? body.comment.slice(0, 1000) : null,
      nowMs(),
    )
    .run();
  return jsonResponse({ rating: { id, status: "pending_review" } }, 201);
}
