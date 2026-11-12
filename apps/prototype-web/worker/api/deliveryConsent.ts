/**
 * Delivery mutual consent API (contract 21 §3.2-3, OD10 — continuation
 * 2026-11-12): retry/holding/return after a declared undeliverable outcome
 * become effective ONLY after the other party's explicit in-app acceptance.
 * A single party records a PENDING proposal; silence or disagreement leaves
 * that pending state and triggers nothing automatic. "Return" is return of
 * goods, never a money refund. Actor, timestamp, reason, prior agreement,
 * and event history are preserved on every step.
 *
 * Also carries the requester instructions path out of `awaiting_instructions`
 * (contract 21 §3.2-3: actor is the project owner — previously the driver
 * recorded these, which let one party drive a consent-class transition).
 */

import { notify } from "../audit.ts";
import { nowMs } from "../clock.ts";
import { randomToken } from "../crypto.ts";
import { newId, type Db } from "../db/d1.ts";
import {
  CONSENT_KIND_EVENT,
  CONSENT_KINDS,
  goodsAfterExecution,
  instructionEventFromInput,
  transitionExecution,
  validateConsentTerms,
  type ConsentKind,
  type ConsentTerms,
  type ExecutionState,
} from "../domain/delivery.ts";
import { dailyBucket, enforceRate, rateLimits } from "../ratelimit.ts";
import { HttpError, jsonResponse } from "../http.ts";
import { readJsonBody, type RouteContext } from "../router.ts";
import { loadRequest, notifyDriver, recordEvent } from "./deliveryShared.ts";
import type { AuthenticatedContext } from "../auth/session.ts";

function db(ctx: RouteContext): Db {
  return ctx.env.DB;
}

async function loadExecutionState(ctx: RouteContext, requestId: string): Promise<ExecutionState | null> {
  const row = await db(ctx)
    .prepare(
      "SELECT execution_status, confirmation_status, contact_status, goods_location, money_status FROM delivery_execution WHERE request_id = ?",
    )
    .bind(requestId)
    .first<Record<string, unknown>>();
  if (!row) return null;
  return {
    execution: String(row.execution_status) as ExecutionState["execution"],
    confirmation: String(row.confirmation_status) as ExecutionState["confirmation"],
    contact: String(row.contact_status) as ExecutionState["contact"],
    goods: String(row.goods_location) as ExecutionState["goods"],
    money: String(row.money_status) as ExecutionState["money"],
  };
}

/** POST /api/driver/requests/:id/propose-consent — the driver proposes
 * retry/holding/return; it stays PENDING until the requester accepts. */
export async function proposeConsent(ctx: RouteContext, auth: AuthenticatedContext): Promise<Response> {
  const row = await loadRequest(ctx, ctx.params.id!);
  const driverProfile = await db(ctx)
    .prepare("SELECT id, identity_id FROM driver_profile WHERE id = ?")
    .bind(String(row.driver_profile_id))
    .first<Record<string, unknown>>();
  if (!driverProfile || String(driverProfile.identity_id) !== auth.identityId) {
    throw new HttpError(404, "not_found");
  }
  if (String(row.status) !== "confirmed")
    throw new HttpError(409, "conflict", { reason: "request_not_confirmed" });
  const state = await loadExecutionState(ctx, String(row.id));
  if (!state) throw new HttpError(409, "conflict", { reason: "no_execution" });
  if (state.execution !== "undeliverable_declared") {
    throw new HttpError(409, "conflict", { reason: `consent_requires_undeliverable_declared` });
  }
  const body = (await readJsonBody(ctx.request)) as { kind?: unknown; terms?: unknown };
  if (typeof body.kind !== "string" || !(CONSENT_KINDS as readonly string[]).includes(body.kind)) {
    throw new HttpError(400, "bad_request", { field: "kind" });
  }
  const kind = body.kind as ConsentKind;
  const terms = (body.terms ?? {}) as ConsentTerms;
  validateConsentTerms(kind, terms);
  // One pending consent proposal at a time — an honest 409 instead of piling.
  const pending = await db(ctx)
    .prepare("SELECT id FROM delivery_consent_proposal WHERE request_id = ? AND status = 'pending'")
    .bind(String(row.id))
    .first();
  if (pending) throw new HttpError(409, "conflict", { reason: "consent_proposal_already_pending" });
  const limits = await rateLimits(db(ctx));
  await enforceRate(
    db(ctx),
    dailyBucket("consent-propose", auth.identityId, nowMs()),
    limits.submissionsPerDay,
    24 * 60 * 60 * 1000,
    nowMs(),
  );
  const id = newId("cns", randomToken);
  const now = nowMs();
  const termsJson = JSON.stringify(terms);
  await db(ctx)
    .prepare(
      "INSERT INTO delivery_consent_proposal (id, request_id, proposed_by_identity_id, kind, terms_json, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, 'pending', ?, ?)",
    )
    .bind(id, String(row.id), auth.identityId, kind, termsJson, now, now)
    .run();
  await recordEvent(
    ctx,
    String(row.id),
    "agreement",
    "consent_proposed",
    "undeliverable_declared",
    `pending:${kind}`,
    auth.identityId,
    termsJson,
  );
  const requesterIdentity = String(row.requester_identity_id);
  await notify(
    db(ctx),
    {
      identityId: requesterIdentity,
      type: "consent_proposed",
      targetPath: `/delivery/booking/${String(row.id)}`,
      payload: { requestId: String(row.id), proposalId: id, kind },
      idempotencyKey: `consent-proposal:${id}`,
    },
    now,
  ).catch(() => undefined);
  return jsonResponse({ proposal: { id, kind, status: "pending" } }, 201);
}

async function loadPendingProposal(ctx: RouteContext, requestId: string, proposalId: string) {
  const proposal = await db(ctx)
    .prepare(
      "SELECT id, request_id, proposed_by_identity_id, kind, terms_json, status, applied_execution FROM delivery_consent_proposal WHERE id = ?",
    )
    .bind(proposalId)
    .first<Record<string, unknown>>();
  if (!proposal || String(proposal.request_id) !== requestId) throw new HttpError(404, "not_found");
  return proposal;
}

/** POST /api/delivery/requests/:id/consent/decide — the REQUESTER (the other
 * party) explicitly accepts or rejects. The proposing driver can never decide
 * his own proposal; no other identity sees it. */
export async function decideConsent(ctx: RouteContext, auth: AuthenticatedContext): Promise<Response> {
  const row = await loadRequest(ctx, ctx.params.id!);
  const driverProfile = await db(ctx)
    .prepare("SELECT id, identity_id FROM driver_profile WHERE id = ?")
    .bind(String(row.driver_profile_id))
    .first<Record<string, unknown>>();
  const isRequester = String(row.requester_identity_id) === auth.identityId;
  const isDriver = driverProfile !== null && String(driverProfile.identity_id) === auth.identityId;
  if (!isRequester && !isDriver && !auth.isAdmin) throw new HttpError(404, "not_found");
  // The other party decides: the driver proposed, so only the requester (never
  // the proposer, never an unrelated identity) can accept or reject.
  if (isDriver && !isRequester) {
    throw new HttpError(403, "forbidden", { reason: "other_party_decision_required" });
  }
  if (!isRequester) throw new HttpError(403, "forbidden", { reason: "other_party_decision_required" });
  const body = (await readJsonBody(ctx.request)) as {
    proposalId?: unknown;
    decision?: unknown;
    note?: unknown;
  };
  if (typeof body.proposalId !== "string") throw new HttpError(400, "bad_request", { field: "proposalId" });
  if (body.decision !== "accept" && body.decision !== "reject") {
    throw new HttpError(400, "bad_request", { field: "decision" });
  }
  const proposal = await loadPendingProposal(ctx, String(row.id), body.proposalId);
  if (String(proposal.status) !== "pending") {
    throw new HttpError(409, "conflict", { reason: `proposal_already_${String(proposal.status)}` });
  }
  const kind = String(proposal.kind) as ConsentKind;
  const now = nowMs();
  const accept = body.decision === "accept";
  let appliedExecution: string | null = null;
  if (accept) {
    const state = await loadExecutionState(ctx, String(row.id));
    if (!state) throw new HttpError(409, "conflict", { reason: "no_execution" });
    if (state.execution !== "undeliverable_declared") {
      // The state moved since the proposal — the acceptance is refused
      // honestly instead of forcing a stale transition.
      throw new HttpError(409, "conflict", { reason: "proposal_stale_execution_state" });
    }
    appliedExecution = transitionExecution(state, CONSENT_KIND_EVENT[kind]);
    const goods = goodsAfterExecution(appliedExecution as ExecutionState["execution"], state.goods);
    await db(ctx)
      .prepare(
        "UPDATE delivery_execution SET execution_status = ?, goods_location = ?, updated_at = ? WHERE request_id = ?",
      )
      .bind(appliedExecution, goods, now, String(row.id))
      .run();
    await recordEvent(
      ctx,
      String(row.id),
      "execution",
      CONSENT_KIND_EVENT[kind],
      state.execution,
      appliedExecution,
      auth.identityId,
      `proposal:${String(proposal.id)}`,
    );
  }
  const note = typeof body.note === "string" ? body.note.slice(0, 500) : null;
  // Atomic decide: exactly one pending→decided transition wins.
  const moved = await db(ctx)
    .prepare(
      "UPDATE delivery_consent_proposal SET status = ?, decided_by_identity_id = ?, decided_at = ?, decision_note = ?, applied_execution = ?, updated_at = ? WHERE id = ? AND status = 'pending'",
    )
    .bind(
      accept ? "accepted" : "rejected",
      auth.identityId,
      now,
      note,
      appliedExecution,
      now,
      String(proposal.id),
    )
    .run();
  if (Number(moved.meta?.changes ?? 0) !== 1) {
    throw new HttpError(409, "conflict", { reason: "proposal_already_decided" });
  }
  await recordEvent(
    ctx,
    String(row.id),
    "agreement",
    accept ? "consent_accepted" : "consent_rejected",
    "pending:" + kind,
    accept ? appliedExecution : `rejected:${kind}`,
    auth.identityId,
    note ?? undefined,
  );
  await notifyDriver(ctx, String(row.driver_profile_id), "status_changed", String(row.id), now);
  return jsonResponse({
    ok: true,
    decision: body.decision,
    kind,
    execution: appliedExecution,
    proposalId: String(proposal.id),
  });
}

/** POST /api/driver/requests/:id/propose-consent/withdraw — the proposer
 * pulls back a still-pending proposal; nothing else changes. */
export async function withdrawConsent(ctx: RouteContext, auth: AuthenticatedContext): Promise<Response> {
  const row = await loadRequest(ctx, ctx.params.id!);
  const driverProfile = await db(ctx)
    .prepare("SELECT id, identity_id FROM driver_profile WHERE id = ?")
    .bind(String(row.driver_profile_id))
    .first<Record<string, unknown>>();
  if (!driverProfile || String(driverProfile.identity_id) !== auth.identityId) {
    throw new HttpError(404, "not_found");
  }
  const body = (await readJsonBody(ctx.request)) as { proposalId?: unknown };
  if (typeof body.proposalId !== "string") throw new HttpError(400, "bad_request", { field: "proposalId" });
  const proposal = await loadPendingProposal(ctx, String(row.id), body.proposalId);
  if (String(proposal.proposed_by_identity_id) !== auth.identityId) {
    throw new HttpError(403, "forbidden", { reason: "proposer_only" });
  }
  if (String(proposal.status) !== "pending") {
    throw new HttpError(409, "conflict", { reason: `proposal_already_${String(proposal.status)}` });
  }
  const now = nowMs();
  const moved = await db(ctx)
    .prepare(
      "UPDATE delivery_consent_proposal SET status = 'withdrawn', updated_at = ? WHERE id = ? AND status = 'pending'",
    )
    .bind(now, String(proposal.id))
    .run();
  if (Number(moved.meta?.changes ?? 0) !== 1) {
    throw new HttpError(409, "conflict", { reason: "proposal_already_decided" });
  }
  await recordEvent(
    ctx,
    String(row.id),
    "agreement",
    "consent_withdrawn",
    `pending:${String(proposal.kind)}`,
    "withdrawn",
    auth.identityId,
  );
  return jsonResponse({ ok: true });
}

/** POST /api/delivery/requests/:id/instructions — the REQUESTER records
 * instructions out of `awaiting_instructions` (contract 21 §3.2-3 actor:
 * صاحب المشروع). Previously the driver recorded these on his own. */
export async function recordInstructions(ctx: RouteContext, auth: AuthenticatedContext): Promise<Response> {
  const row = await loadRequest(ctx, ctx.params.id!);
  if (String(row.requester_identity_id) !== auth.identityId) throw new HttpError(404, "not_found");
  if (String(row.status) !== "confirmed")
    throw new HttpError(409, "conflict", { reason: "request_not_confirmed" });
  const state = await loadExecutionState(ctx, String(row.id));
  if (!state) throw new HttpError(409, "conflict", { reason: "no_execution" });
  if (state.execution !== "awaiting_instructions") {
    throw new HttpError(409, "conflict", { reason: "not_awaiting_instructions" });
  }
  const body = (await readJsonBody(ctx.request)) as { instruction?: unknown; note?: unknown };
  const event = instructionEventFromInput(body.instruction);
  const next = transitionExecution(state, event);
  const goods = goodsAfterExecution(next, state.goods);
  const now = nowMs();
  await db(ctx)
    .prepare(
      "UPDATE delivery_execution SET execution_status = ?, goods_location = ?, updated_at = ? WHERE request_id = ?",
    )
    .bind(next, goods, now, String(row.id))
    .run();
  await recordEvent(
    ctx,
    String(row.id),
    "execution",
    event,
    state.execution,
    next,
    auth.identityId,
    typeof body.note === "string" && body.note.length > 0 ? body.note.slice(0, 500) : undefined,
  );
  await notifyDriver(ctx, String(row.driver_profile_id), "status_changed", String(row.id), now);
  return jsonResponse({ ok: true, execution: next });
}
