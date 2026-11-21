/**
 * Driver execution API (contract 21 §3.2-3..6): the directed inbox, prepriced
 * acceptance with atomic eligibility re-check (OD07/OD30), the ONE final quote
 * (OD05), execution/contact declarations with the OD15 guard, and daily
 * statements (OD13 — full confirmation only).
 */

import { notify } from "../audit.ts";
import { ammanDateString, nowMs } from "../clock.ts";
import { driverStatus } from "../authorization.ts";
import { randomToken } from "../crypto.ts";
import { newId, type Db } from "../db/db.ts";
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
import { DRIVER_RESPONSE_WINDOW_MS } from "../env.ts";
import { dailyBucket, enforceRate, rateLimits } from "../ratelimit.ts";
import { HttpError, jsonResponse } from "../http.ts";
import { readJsonBody, type RouteContext } from "../router.ts";
import type { AuthenticatedContext } from "../auth/session.ts";
import {
  advanceMoneyAxisForItems,
  bookingPayloadSummary,
  buildAgreementCopy,
  CAPACITY_OVERLAP_SQL,
  driverCapacityLockStatement,
  recordEvent,
  requireDriverProfile,
} from "./deliveryShared.ts";

function db(ctx: RouteContext): Db {
  return ctx.env.DB;
}

/** GET /api/driver/requests — directed incoming requests for this driver. */
export async function driverRequests(ctx: RouteContext, auth: AuthenticatedContext): Promise<Response> {
  const driverProfileId = await requireDriverProfile(ctx, auth);
  const now = nowMs();
  const rows = await db(ctx)
    .prepare(
      "SELECT id, status, response_deadline_at, pricing_mode, offered_fare_minor, collection_minor, collection_content, need_type, payload_json, updated_at " +
        "FROM delivery_request WHERE driver_profile_id = ? ORDER BY updated_at DESC LIMIT 50",
    )
    .bind(driverProfileId)
    .all<Record<string, unknown>>();
  return jsonResponse({
    requests: rows.results.map(row => ({
      id: String(row.id),
      status: effectiveRequestStatus(
        String(row.status) as RequestStatus,
        row.response_deadline_at === null ? null : Number(row.response_deadline_at),
        now,
      ),
      pricingMode: String(row.pricing_mode),
      offeredFareMinor: row.offered_fare_minor === null ? null : String(row.offered_fare_minor),
      collectionMinor: row.collection_minor === null ? null : String(row.collection_minor),
      collectionContent: row.collection_content === null ? null : String(row.collection_content),
      needType: String(row.need_type),
      /* R1-17: المسار (المحافظتان) والموعد على البطاقة نفسها قبل قرار
       * القبول — ملخص المحافظتين/الموعد وحده؛ لا عناوين ولا مناطق
       * ولا هواتف في القوائم أبدًا (عقد 21). */
      ...bookingPayloadSummary(row.payload_json),
      updatedAt: Number(row.updated_at),
    })),
  });
}

async function requireAssignedRequest(ctx: RouteContext, auth: AuthenticatedContext, requestId: string) {
  const driverProfileId = await requireDriverProfile(ctx, auth);
  const row = await db(ctx)
    .prepare(
      "SELECT id, requester_identity_id, driver_profile_id, need_type, payload_json, collection_minor, collection_content, pricing_mode, offered_fare_minor, status, response_deadline_at FROM delivery_request WHERE id = ?",
    )
    .bind(requestId)
    .first<Record<string, unknown>>();
  if (!row || String(row.driver_profile_id) !== driverProfileId) throw new HttpError(404, "not_found");
  return row;
}

/** POST /api/driver/requests/:id/accept — prepriced acceptance within the window (OD07). */
export async function driverAcceptRequest(ctx: RouteContext, auth: AuthenticatedContext): Promise<Response> {
  const row = await requireAssignedRequest(ctx, auth, ctx.params.id!);
  if (String(row.pricing_mode) !== "prepriced")
    throw new HttpError(409, "conflict", { reason: "quote_request_mode" });
  const eligibility = await driverStatus(db(ctx), auth.identityId, nowMs());
  if (!eligibility?.eligibleForNewWork) {
    throw new HttpError(409, "conflict", { reason: "not_eligible_for_new_work", od: "OD30" });
  }
  const now = nowMs();
  transitionRequest(
    {
      status: String(row.status) as RequestStatus,
      responseDeadlineAt: Number(row.response_deadline_at),
      quoteValidUntil: null,
    },
    "driver_accept_prepriced",
    now,
  );
  const requesterIdentity = String(row.requester_identity_id);
  const agreement = await buildAgreementCopy(ctx.env.DB, row, null, now);
  /* Q268 (Post-Group 6 Wave 3): التأكيد داخل معاملة واحدة — قفل استشاري
   * على مسار السائق ثم UPDATE شرطي يفحص السعة والتداخل ذريًّا؛ سباق
   * تأكيدين متزامنين لنفس السائق يتحلل إلى نجاح واحد و409 صادق. */
  const results = await db(ctx).batch([
    driverCapacityLockStatement(db(ctx), String(row.driver_profile_id)),
    db(ctx)
      .prepare(
        // Conditional update: a concurrent requester withdrawal wins and this
        // acceptance becomes a 409 instead of overwriting it (spec §8 — one
        // server-decided outcome for simultaneous actions) — AND the atomic
        // capacity/overlap check (Q268) rides the same single statement.
        "UPDATE delivery_request r SET status = 'confirmed', agreement_copy_json = ?, response_deadline_at = NULL, updated_at = ? " +
          "WHERE r.id = ? AND r.status = 'awaiting_driver_response' AND (r.scheduled_start_at IS NULL OR r.scheduled_end_at IS NULL OR " +
          CAPACITY_OVERLAP_SQL +
          ")",
      )
      .bind(agreement, now, String(row.id)),
    db(ctx)
      .prepare(
        "INSERT INTO delivery_execution (request_id, execution_status, confirmation_status, contact_status, goods_location, money_status, updated_at) " +
          "VALUES (?, 'not_started', 'none', 'not_attempted', 'at_source', CASE WHEN ?::text IS NULL THEN 'none' ELSE 'agreed' END, ?) ON CONFLICT DO NOTHING",
      )
      .bind(String(row.id), row.collection_minor, now),
  ]);
  if (Number(results[1]?.meta?.changes ?? 0) !== 1) {
    // Distinguish the honest cause: a still-awaiting request means the
    // capacity/overlap check refused it (Q268); anything else is a state race.
    const current = await db(ctx)
      .prepare("SELECT status FROM delivery_request WHERE id = ?")
      .bind(String(row.id))
      .first<{ status: string }>();
    if (current !== null && current.status === "awaiting_driver_response") {
      throw new HttpError(409, "conflict", { reason: "driver_capacity_full" });
    }
    throw new HttpError(409, "conflict", { reason: "request_state_changed" });
  }
  await recordEvent(
    ctx,
    String(row.id),
    "request",
    "driver_accepted",
    String(row.status),
    "confirmed",
    auth.identityId,
  );
  await notify(
    db(ctx),
    {
      identityId: requesterIdentity,
      type: "booking_outcome",
      targetPath: `/delivery/booking/${String(row.id)}`,
      payload: { requestId: String(row.id) },
      idempotencyKey: `accepted:${row.id}`,
    },
    now,
  ).catch(() => undefined);
  return jsonResponse({ ok: true, status: "confirmed" });
}

/** POST /api/driver/requests/:id/decline (no fallback, no broadcast — OD03/OD07).
 * MD-03 (Post-Group 6 Wave 3): the decline is a compare-and-set — the expected
 * status is part of the UPDATE and the affected-row count decides; a lost
 * race is an honest 409, never a blind overwrite. Q215 (القرار النهائي):
 * رفض السائق للحجز يُنبه صاحب الحجز فورًا. */
export async function driverDeclineRequest(ctx: RouteContext, auth: AuthenticatedContext): Promise<Response> {
  const row = await requireAssignedRequest(ctx, auth, ctx.params.id!);
  const next = transitionRequest(
    { status: String(row.status) as RequestStatus, responseDeadlineAt: null, quoteValidUntil: null },
    "driver_decline",
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
    "driver_declined",
    String(row.status),
    next,
    auth.identityId,
  );
  /* Q215 (د-4 — القرار النهائي): تنبيه فوري لصاحب الحجز عند الرفض. */
  await notify(
    db(ctx),
    {
      identityId: String(row.requester_identity_id),
      type: "booking_outcome",
      targetPath: `/delivery/booking/${String(row.id)}`,
      payload: { requestId: String(row.id), outcome: "declined" },
      idempotencyKey: `declined:${row.id}`,
    },
    now,
  ).catch(() => undefined);
  return jsonResponse({ ok: true, status: next });
}

/** POST /api/driver/requests/:id/cancel — Q106 (القرار النهائي د-3): إلغاء
 * السائق قبل الاستلام بسبب مكتوب، مع تنبيه فوري لصاحب الحجز. مسموح فقط
 * قبل التقاط البضاعة (not_started/heading_to_pickup/arrived_at_source)؛
 * بعد الاستلام لا إلغاء من السائق — البلاغ أو الدعم أو الإلغاء الإداري
 * فقط (قرار المالك النهائي). */
export async function driverCancelBeforePickup(
  ctx: RouteContext,
  auth: AuthenticatedContext,
): Promise<Response> {
  const row = await requireAssignedRequest(ctx, auth, ctx.params.id!);
  const body = (await readJsonBody(ctx.request)) as { reason?: unknown };
  if (typeof body.reason !== "string" || body.reason.trim().length < 5 || body.reason.length > 500) {
    throw new HttpError(400, "bad_request", { field: "reason", reason: "written_reason_required" });
  }
  const now = nowMs();
  transitionRequest(
    { status: String(row.status) as RequestStatus, responseDeadlineAt: null, quoteValidUntil: null },
    "driver_cancel_before_pickup",
    now,
  );
  const execution = await db(ctx)
    .prepare("SELECT execution_status FROM delivery_execution WHERE request_id = ?")
    .bind(String(row.id))
    .first<{ execution_status: string }>();
  const beforePickup =
    execution === null ||
    ["not_started", "heading_to_pickup", "arrived_at_source"].includes(execution.execution_status);
  if (!beforePickup) {
    throw new HttpError(409, "conflict", { reason: "driver_cancel_only_before_pickup" });
  }
  const moved = await db(ctx)
    .prepare(
      "UPDATE delivery_request SET status = 'cancelled', updated_at = ? WHERE id = ? AND status = 'confirmed'",
    )
    .bind(now, String(row.id))
    .run();
  if (Number(moved.meta?.changes ?? 0) !== 1) {
    throw new HttpError(409, "conflict", { reason: "request_state_changed" });
  }
  await recordEvent(
    ctx,
    String(row.id),
    "request",
    "cancelled_by_driver",
    "confirmed",
    "cancelled",
    auth.identityId,
    body.reason,
  );
  /* Q106: تنبيه فوري لصاحب الحجز بسبب الإلغاء. */
  await notify(
    db(ctx),
    {
      identityId: String(row.requester_identity_id),
      type: "booking_outcome",
      targetPath: `/delivery/booking/${String(row.id)}`,
      payload: { requestId: String(row.id), outcome: "driver_cancelled" },
      idempotencyKey: `driver-cancelled:${row.id}`,
    },
    now,
  ).catch(() => undefined);
  return jsonResponse({ ok: true, status: "cancelled" });
}

/** POST /api/driver/requests/:id/quote — the ONE final quote (OD05). */
export async function driverSubmitQuote(ctx: RouteContext, auth: AuthenticatedContext): Promise<Response> {
  const row = await requireAssignedRequest(ctx, auth, ctx.params.id!);
  if (String(row.pricing_mode) !== "quote_request")
    throw new HttpError(409, "conflict", { reason: "prepriced_mode" });
  const eligibility = await driverStatus(db(ctx), auth.identityId, nowMs());
  if (!eligibility?.eligibleForNewWork) {
    throw new HttpError(409, "conflict", { reason: "not_eligible_for_new_work", od: "OD30" });
  }
  const body = (await readJsonBody(ctx.request)) as { fareMinor?: unknown; scope?: unknown };
  const fareMinor = parseMinorAmount(body.fareMinor, "fareMinor");
  const scope = typeof body.scope === "string" && body.scope.length > 0 ? body.scope : "{}";
  const now = nowMs();
  const currentStatus = String(row.status) as RequestStatus;
  // The quote follows the request state machine: a first quote only from
  // awaiting_driver_response, a replacement only before the requester decides
  // — never on a confirmed/cancelled/expired request (contract 21 §3.2-2/§8).
  const quoteEvent =
    currentStatus === "awaiting_requester_decision" ? "driver_replace_quote" : "driver_submit_quote";
  transitionRequest(
    {
      status: currentStatus,
      responseDeadlineAt: Number(row.response_deadline_at),
      quoteValidUntil: null,
    },
    quoteEvent,
    now,
  );
  const quoteId = newId("qte", randomToken);
  const validUntil = now + DRIVER_RESPONSE_WINDOW_MS;
  // Conditional update first: a concurrent requester decision/withdrawal wins
  // and this submission becomes a 409 instead of overwriting it (spec §8).
  const moved = await db(ctx)
    .prepare(
      "UPDATE delivery_request SET status = 'awaiting_requester_decision', response_deadline_at = ?, updated_at = ? WHERE id = ? AND status = ?",
    )
    .bind(validUntil, now, String(row.id), currentStatus)
    .run();
  if (Number(moved.meta?.changes ?? 0) !== 1) {
    throw new HttpError(409, "conflict", { reason: "request_state_changed" });
  }
  await db(ctx).batch([
    // Set-based voiding inside the same batch: no piling-up race between two
    // concurrent replacements (OD05 — exactly one active final quote).
    db(ctx)
      .prepare("UPDATE delivery_quote SET superseded_by = ? WHERE request_id = ? AND superseded_by IS NULL")
      .bind(quoteId, String(row.id)),
    db(ctx)
      .prepare(
        "INSERT INTO delivery_quote (id, request_id, driver_profile_id, fare_minor, scope_json, valid_until, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
      )
      .bind(quoteId, String(row.id), String(row.driver_profile_id), fareMinor, scope, validUntil, now),
    db(ctx)
      .prepare(
        "UPDATE delivery_request SET quote_id = ? WHERE id = ? AND status = 'awaiting_requester_decision'",
      )
      .bind(quoteId, String(row.id)),
  ]);
  await recordEvent(
    ctx,
    String(row.id),
    "request",
    "quote_submitted",
    String(row.status),
    "awaiting_requester_decision",
    auth.identityId,
  );
  const requesterIdentity = String(row.requester_identity_id);
  await notify(
    db(ctx),
    {
      identityId: requesterIdentity,
      type: "quote_submitted",
      targetPath: `/delivery/booking/${String(row.id)}`,
      payload: { requestId: String(row.id) },
      idempotencyKey: `quote:${quoteId}`,
    },
    now,
  ).catch(() => undefined);
  return jsonResponse({ quote: { id: quoteId, validUntil } }, 201);
}

/** POST /api/driver/requests/:id/declare — execution/contact declarations. */
export async function driverDeclare(ctx: RouteContext, auth: AuthenticatedContext): Promise<Response> {
  const row = await requireAssignedRequest(ctx, auth, ctx.params.id!);
  if (String(row.status) !== "confirmed")
    throw new HttpError(409, "conflict", { reason: "request_not_confirmed" });
  const body = (await readJsonBody(ctx.request)) as Record<string, unknown>;
  const kind = typeof body.kind === "string" ? body.kind : null;
  const executionRow = await db(ctx)
    .prepare(
      "SELECT execution_status, confirmation_status, contact_status, goods_location, money_status FROM delivery_execution WHERE request_id = ?",
    )
    .bind(String(row.id))
    .first<Record<string, unknown>>();
  if (!executionRow) throw new HttpError(409, "conflict", { reason: "no_execution" });
  const state: ExecutionState = {
    execution: String(executionRow.execution_status) as ExecutionState["execution"],
    confirmation: String(executionRow.confirmation_status) as ExecutionState["confirmation"],
    contact: String(executionRow.contact_status) as ExecutionState["contact"],
    goods: String(executionRow.goods_location) as ExecutionState["goods"],
    money: String(executionRow.money_status) as ExecutionState["money"],
  };
  const now = nowMs();
  const eventMap: Record<string, string> = {
    start: "start",
    arrive: "arrive",
    pickup_declared: "pickup_declared",
    pickup_failed: "pickup_failed",
    transit_started: "transit_started",
    delivery_declared: "delivery_declared",
    delivery_failed: "delivery_failed",
    awaiting_instructions: "awaiting_instructions",
    // Resume events after an agreed outcome (contract 21 §3.2-3). The three
    // consent transitions out of undeliverable_declared (retry/holding/return)
    // and the requester instructions are NO LONGER driver declarations —
    // they go through the mutual-consent/instructions paths (OD10, actor
    // assignments per §3.2-3; see api/deliveryConsent.ts).
    return_declared: "return_declared",
    retry_started_pickup: "retry_started_pickup",
    retry_started_transit: "retry_started_transit",
    return_started: "return_started",
    transit_resumed: "transit_resumed",
  };
  const contactMap: Record<string, string> = {
    contact_attempt_no_answer: "attempt_no_answer",
    contact_reported: "contact_reported",
  };
  if (kind !== null && eventMap[kind] !== undefined) {
    if (kind === "delivery_failed" || kind === "pickup_failed") {
      // OD15: a recorded contact attempt (with its outcome) precedes any
      // failure declaration; a reason is always recorded (contract 21 §3.2-3).
      assertContactAttemptBeforeFailure(state, kind);
      if (typeof body.reason !== "string" || body.reason.trim().length === 0) {
        throw new HttpError(400, "bad_request", { field: "reason", reason: "failure_requires_reason" });
      }
    }
    const nextExecution = transitionExecution(state, eventMap[kind]!);
    const goods = goodsAfterExecution(nextExecution, state.goods);
    const confirmation = confirmationAfterDeclaration(nextExecution, state.confirmation);
    // Anchor for the single engineering 24h reminder (contract 21 §3.2-5 /
    // contract 19 §9): stamped when the wait opens, never on re-declarations.
    const confirmationOpened =
      confirmation === "awaiting_requester_confirmation" &&
      state.confirmation !== "awaiting_requester_confirmation";
    await db(ctx)
      .prepare(
        "UPDATE delivery_execution SET execution_status = ?, goods_location = ?, confirmation_status = ?, confirmation_requested_at = COALESCE(confirmation_requested_at, ?), updated_at = ? WHERE request_id = ?",
      )
      .bind(nextExecution, goods, confirmation, confirmationOpened ? now : null, now, String(row.id))
      .run();
    await recordEvent(
      ctx,
      String(row.id),
      "execution",
      kind,
      state.execution,
      nextExecution,
      auth.identityId,
      typeof body.reason === "string" ? body.reason : undefined,
    );
    if (confirmation === "awaiting_requester_confirmation") {
      const requesterIdentity = String(row.requester_identity_id);
      await notify(
        db(ctx),
        {
          identityId: requesterIdentity,
          type: "declaration_recorded",
          targetPath: `/delivery/booking/${String(row.id)}`,
          payload: { requestId: String(row.id), declaration: kind },
          idempotencyKey: `declare:${row.id}:${kind}:${now}`,
        },
        now,
      ).catch(() => undefined);
    }
    return jsonResponse({ ok: true, execution: nextExecution, confirmation, goods });
  }
  if (kind !== null && contactMap[kind] !== undefined) {
    const next = transitionContactSafe(state.contact, contactMap[kind]!);
    await db(ctx)
      .prepare("UPDATE delivery_execution SET contact_status = ?, updated_at = ? WHERE request_id = ?")
      .bind(next, now, String(row.id))
      .run();
    await recordEvent(ctx, String(row.id), "contact", kind, state.contact, next, auth.identityId);
    return jsonResponse({ ok: true, contact: next });
  }
  if (kind === "collection_declared") {
    const declared = parseMinorAmount(body.amountMinor, "amountMinor");
    const advanced = await db(ctx)
      .prepare(
        // Forward-only money ladder (§3.2-6): a booking already at/after the
        // statement stage can never regress to a fresh collection declaration.
        "UPDATE delivery_execution SET money_status = 'collection_declared', updated_at = ? WHERE request_id = ? AND money_status IN ('none', 'agreed')",
      )
      .bind(now, String(row.id))
      .run();
    if (Number(advanced.meta?.changes ?? 0) !== 1) {
      throw new HttpError(409, "conflict", { reason: "money_axis_already_advanced" });
    }
    await recordEvent(
      ctx,
      String(row.id),
      "money",
      "collection_declared",
      state.money,
      "collection_declared",
      auth.identityId,
      declared,
    );
    return jsonResponse({ ok: true, money: "collection_declared" });
  }
  throw new HttpError(400, "bad_request", { field: "kind" });
}

function transitionContactSafe(current: ExecutionState["contact"], event: string): ExecutionState["contact"] {
  if (current === "not_attempted") {
    if (event === "attempt_no_answer" || event === "contact_reported") return event;
  }
  throw new HttpError(409, "conflict", { reason: `contact_event_invalid_for_${current}` });
}

/** POST /api/driver/statements — submit the daily statement (full-only, OD13).
 * MD-04 (Post-Group 6 Wave 3): the statement's ITEMS AND TOTAL are DERIVED
 * SERVER-SIDE from the pair's eligible confirmed bookings (delivered +
 * declared collection, money axis not yet stated) — client-supplied amounts
 * are never trusted. MD-05: exactly one awaiting statement per pair/day is
 * enforced by a partial UNIQUE index; a concurrent duplicate insert fails
 * honestly with 409, never a silent second pending row. */
export async function submitDailyStatement(ctx: RouteContext, auth: AuthenticatedContext): Promise<Response> {
  const driverProfileId = await requireDriverProfile(ctx, auth);
  const body = (await readJsonBody(ctx.request)) as {
    requesterIdentityId?: string;
    supplementOf?: string;
  };
  const requesterIdentityId = typeof body.requesterIdentityId === "string" ? body.requesterIdentityId : null;
  if (!requesterIdentityId) {
    throw new HttpError(400, "bad_request", { field: "requesterIdentityId" });
  }
  const statementLimits = await rateLimits(db(ctx));
  await enforceRate(
    db(ctx),
    dailyBucket("statement-submit", auth.identityId, nowMs()),
    statementLimits.submissionsPerDay,
    24 * 60 * 60 * 1000,
    nowMs(),
  );
  const statementDate = ammanDateString(nowMs());
  const supplementOf = typeof body.supplementOf === "string" ? body.supplementOf : null;
  if (supplementOf !== null) {
    // Contract 21 §3.2-6: a supplement follows a CONFIRMED statement of the
    // same pair and day, carrying only new items. Validated BEFORE derivation
    // so a bad parent is named specifically, not as an empty eligible set.
    const parent = await db(ctx)
      .prepare(
        "SELECT driver_profile_id, requester_identity_id, statement_date, status FROM daily_statement WHERE id = ?",
      )
      .bind(supplementOf)
      .first<Record<string, unknown>>();
    if (
      !parent ||
      String(parent.driver_profile_id) !== driverProfileId ||
      String(parent.requester_identity_id) !== requesterIdentityId ||
      String(parent.statement_date) !== statementDate ||
      String(parent.status) !== "full_receipt_confirmed"
    ) {
      throw new HttpError(409, "conflict", { reason: "invalid_supplement_parent" });
    }
  }
  // The statement recipient must be an actual requester of this driver (no
  // cross-inbox statement spam).
  const pairRequest = await db(ctx)
    .prepare(
      "SELECT id FROM delivery_request WHERE driver_profile_id = ? AND requester_identity_id = ? LIMIT 1",
    )
    .bind(driverProfileId, requesterIdentityId)
    .first();
  if (!pairRequest) throw new HttpError(409, "conflict", { reason: "no_booking_relationship" });
  /* MD-04: العناصر والإجمالي يُشتقان من الحجوزات المؤهلة نفسها — الحجوزات
   * المؤكدة لهذا الزوج التي أُعلن تسليمها وعندها تحصيل مُعلن ولم تدخل
   * كشفًا بعد (محور المال agreed/collection_declared). لا يُقبل أي مبلغ
   * من العميل. */
  const eligible = await db(ctx)
    .prepare(
      "SELECT r.id, r.collection_minor FROM delivery_request r " +
        "JOIN delivery_execution e ON e.request_id = r.id " +
        "WHERE r.driver_profile_id = ? AND r.requester_identity_id = ? AND r.status = 'confirmed' " +
        "AND e.execution_status = 'delivered_declared' AND r.collection_minor IS NOT NULL " +
        "AND e.money_status IN ('agreed', 'collection_declared') ORDER BY r.updated_at",
    )
    .bind(driverProfileId, requesterIdentityId)
    .all<{ id: string; collection_minor: string }>();
  const items: StatementItem[] = eligible.results.map(row => ({
    requestId: String(row.id),
    description: "تحصيل نقدي لحجز مؤكد",
    amountMinor: String(row.collection_minor),
  }));
  if (items.length === 0) {
    throw new HttpError(409, "conflict", { reason: "no_eligible_bookings" });
  }
  const total = statementTotal(items);
  const id = newId("stmt", randomToken);
  const now = nowMs();
  /* MD-05: الإدراج وتقديم محور المال معاملة واحدة؛ القيد الفريد الجزئي
   * (uq_statement_pending_pair_day) يمنع كشفين معلقين متزامنين للزوج/
   * اليوم — خرقه يُعرض 409 صادقًا لا صفًّا ثانيًا صامتًا. */
  try {
    await db(ctx).batch([
      db(ctx)
        .prepare(
          "INSERT INTO daily_statement (id, driver_profile_id, requester_identity_id, statement_date, items_json, total_minor, status, supplement_of, created_at) " +
            "VALUES (?, ?, ?, ?, ?, ?, 'awaiting_confirmation', ?, ?)",
        )
        .bind(
          id,
          driverProfileId,
          requesterIdentityId,
          statementDate,
          JSON.stringify(items),
          total,
          supplementOf,
          now,
        ),
    ]);
  } catch (error) {
    if (error !== null && typeof error === "object" && (error as { code?: string }).code === "23505") {
      throw new HttpError(409, "conflict", { reason: "one_awaiting_statement_per_pair_day" });
    }
    throw error;
  }
  // OD13/contract 21 §3.2-6: submission advances the money axis of exactly the
  // bookings fixed in this statement's items (items are immutable afterwards).
  await advanceMoneyAxisForItems(
    ctx,
    driverProfileId,
    requesterIdentityId,
    items.map(item => item.requestId),
    "statement_submitted",
    now,
  );
  await notify(
    db(ctx),
    {
      identityId: requesterIdentityId,
      type: "daily_statement_submitted",
      targetPath: "/delivery",
      payload: { statementId: id },
      idempotencyKey: `statement:${id}`,
    },
    now,
  ).catch(() => undefined);
  return jsonResponse({ statement: { id, totalMinor: total, status: "awaiting_confirmation" } }, 201);
}
