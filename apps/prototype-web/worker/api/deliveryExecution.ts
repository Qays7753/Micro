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
import { DRIVER_RESPONSE_WINDOW_MS } from "../env.ts";
import { HttpError, jsonResponse } from "../http.ts";
import { readJsonBody, type RouteContext } from "../router.ts";
import type { AuthenticatedContext } from "../auth/session.ts";
import { buildAgreementCopy, recordEvent, requireDriverProfile } from "./deliveryShared.ts";

function db(ctx: RouteContext): Db {
  return ctx.env.DB;
}

/** GET /api/driver/requests — directed incoming requests for this driver. */
export async function driverRequests(ctx: RouteContext, auth: AuthenticatedContext): Promise<Response> {
  const driverProfileId = await requireDriverProfile(ctx, auth);
  const now = nowMs();
  const rows = await db(ctx)
    .prepare(
      "SELECT id, status, response_deadline_at, pricing_mode, offered_fare_minor, collection_minor, collection_content, need_type, updated_at " +
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
  await db(ctx).batch([
    db(ctx)
      .prepare(
        "UPDATE delivery_request SET status = 'confirmed', agreement_copy_json = ?, response_deadline_at = NULL, updated_at = ? WHERE id = ?",
      )
      .bind(agreement, now, String(row.id)),
    db(ctx)
      .prepare(
        "INSERT OR IGNORE INTO delivery_execution (request_id, execution_status, confirmation_status, contact_status, goods_location, money_status, updated_at) " +
          "VALUES (?, 'not_started', 'none', 'not_attempted', 'at_source', 'none', ?)",
      )
      .bind(String(row.id), now),
  ]);
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

/** POST /api/driver/requests/:id/decline (no fallback, no broadcast — OD03/OD07). */
export async function driverDeclineRequest(ctx: RouteContext, auth: AuthenticatedContext): Promise<Response> {
  const row = await requireAssignedRequest(ctx, auth, ctx.params.id!);
  const next = transitionRequest(
    { status: String(row.status) as RequestStatus, responseDeadlineAt: null, quoteValidUntil: null },
    "driver_decline",
    nowMs(),
  );
  await db(ctx)
    .prepare("UPDATE delivery_request SET status = ?, updated_at = ? WHERE id = ?")
    .bind(next, nowMs(), String(row.id))
    .run();
  await recordEvent(
    ctx,
    String(row.id),
    "request",
    "driver_declined",
    String(row.status),
    next,
    auth.identityId,
  );
  return jsonResponse({ ok: true, status: next });
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
  // Replacing a pending quote voids the old copy (no piling up — spec §8).
  const previous = await db(ctx)
    .prepare("SELECT id FROM delivery_quote WHERE request_id = ? AND superseded_by IS NULL")
    .bind(String(row.id))
    .all<Record<string, unknown>>();
  const quoteId = newId("qte", randomToken);
  const validUntil = now + DRIVER_RESPONSE_WINDOW_MS;
  const statements = previous.results.map(prev =>
    db(ctx)
      .prepare("UPDATE delivery_quote SET superseded_by = ? WHERE id = ?")
      .bind(quoteId, String(prev.id)),
  );
  statements.push(
    db(ctx)
      .prepare(
        "INSERT INTO delivery_quote (id, request_id, driver_profile_id, fare_minor, scope_json, valid_until, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
      )
      .bind(quoteId, String(row.id), String(row.driver_profile_id), fareMinor, scope, validUntil, now),
    db(ctx)
      .prepare(
        "UPDATE delivery_request SET status = 'awaiting_requester_decision', quote_id = ?, response_deadline_at = ?, updated_at = ? WHERE id = ?",
      )
      .bind(quoteId, validUntil, now, String(row.id)),
  );
  await db(ctx).batch(statements);
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
    transit_started: "transit_started",
    delivery_declared: "delivery_declared",
    delivery_failed: "delivery_failed",
    awaiting_instructions: "awaiting_instructions",
    retry_agreed: "retry_agreed",
    holding_agreed: "holding_agreed",
    return_agreed: "return_agreed",
    return_declared: "return_declared",
  };
  const contactMap: Record<string, string> = {
    contact_attempt_no_answer: "attempt_no_answer",
    contact_reported: "contact_reported",
  };
  if (kind !== null && eventMap[kind] !== undefined) {
    if (kind === "delivery_failed") assertContactAttemptBeforeFailure(state, "delivery_failed");
    const nextExecution = transitionExecution(state, eventMap[kind]!);
    const goods = goodsAfterExecution(nextExecution, state.goods);
    const confirmation = confirmationAfterDeclaration(nextExecution, state.confirmation);
    await db(ctx)
      .prepare(
        "UPDATE delivery_execution SET execution_status = ?, goods_location = ?, confirmation_status = ?, updated_at = ? WHERE request_id = ?",
      )
      .bind(nextExecution, goods, confirmation, now, String(row.id))
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
    await db(ctx)
      .prepare(
        "UPDATE delivery_execution SET money_status = 'collection_declared', updated_at = ? WHERE request_id = ?",
      )
      .bind(now, String(row.id))
      .run();
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

/** POST /api/driver/statements — submit the daily statement (full-only, OD13). */
export async function submitDailyStatement(ctx: RouteContext, auth: AuthenticatedContext): Promise<Response> {
  const driverProfileId = await requireDriverProfile(ctx, auth);
  const body = (await readJsonBody(ctx.request)) as {
    requesterIdentityId?: string;
    items?: unknown;
    supplementOf?: string;
  };
  const requesterIdentityId = typeof body.requesterIdentityId === "string" ? body.requesterIdentityId : null;
  if (!requesterIdentityId || !Array.isArray(body.items) || body.items.length === 0) {
    throw new HttpError(400, "bad_request", { field: "statement" });
  }
  const items = (body.items as Record<string, unknown>[]).map((item, index) => ({
    requestId: typeof item.requestId === "string" ? item.requestId : `item-${index}`,
    description: typeof item.description === "string" ? item.description : "",
    amountMinor: parseMinorAmount(item.amountMinor, `items.${index}.amountMinor`),
  }));
  const total = statementTotal(items as StatementItem[]);
  const statementDate = ammanDateString(nowMs());
  const pending = await db(ctx)
    .prepare(
      "SELECT id FROM daily_statement WHERE driver_profile_id = ? AND requester_identity_id = ? AND statement_date = ? AND status = 'awaiting_confirmation'",
    )
    .bind(driverProfileId, requesterIdentityId, statementDate)
    .first();
  if (pending) throw new HttpError(409, "conflict", { reason: "one_awaiting_statement_per_pair_day" });
  const supplementOf = typeof body.supplementOf === "string" ? body.supplementOf : null;
  const id = newId("stmt", randomToken);
  const now = nowMs();
  await db(ctx)
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
    )
    .run();
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
