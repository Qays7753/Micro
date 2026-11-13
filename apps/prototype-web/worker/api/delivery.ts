/**
 * Delivery API — the project-owner experience (contract 21).
 * Directed requests to a known driver only (OD03): no broadcast, no fallback,
 * no auto-assignment. Customer/recipient detailed contact data stays behind
 * the disclosure gate (EX-O14) — the driver sees zones until the owner's
 * documented legal decision; the requester's own phone is always visible to
 * both parties of a directed request.
 */

import { audit, notify } from "../audit.ts";
import { enforceGuestReadLimit } from "../ratelimit.ts";
import { nowMs } from "../clock.ts";
import { randomToken } from "../crypto.ts";
import { getDisclosureSettings, newId, type Db } from "../db/db.ts";
import { effectiveRequestStatus, type RequestStatus } from "../domain/delivery.ts";
import { DRIVER_RESPONSE_WINDOW_MS } from "../env.ts";
import { HttpError, jsonResponse } from "../http.ts";
import { readJsonBody, type RouteContext } from "../router.ts";
import { driverStatus } from "../authorization.ts";
import type { AuthenticatedContext } from "../auth/session.ts";

function db(ctx: RouteContext): Db {
  return ctx.env.DB;
}

export interface DriverDirectoryEntry {
  driverProfileId: string;
  displayName: string;
  governorates: string[];
  acceptingNew: boolean;
  eligibleForNewWork: boolean;
  averageStars: number | null;
  ratingsCount: number;
}

/** GET /api/delivery/drivers — the approved public driver directory (OD03). */
export async function driverDirectory(ctx: RouteContext): Promise<Response> {
  const now = nowMs();
  await enforceGuestReadLimit(ctx.env.DB, ctx.request, now);
  const rows = await db(ctx)
    .prepare(
      "SELECT p.id, p.public_copy_json, p.accepting_new, " +
        "(SELECT COUNT(*) FROM driver_vehicle v WHERE v.driver_profile_id = p.id AND v.status = 'approved') AS vehicles, " +
        "(SELECT COUNT(*) FROM driver_evidence e WHERE e.driver_profile_id = p.id AND e.status = 'approved' " +
        "  AND (e.expires_at IS NULL OR e.expires_at > ?)) AS valid_evidence, " +
        // OD17: stars are visible immediately (pending + published); a REJECTED
        // rating is removed entirely by moderation — its stars never count.
        "(SELECT AVG(r.stars) FROM task_rating r WHERE r.driver_profile_id = p.id AND r.status != 'rejected') AS avg_stars, " +
        "(SELECT COUNT(*) FROM task_rating r WHERE r.driver_profile_id = p.id AND r.status != 'rejected') AS ratings " +
        "FROM driver_profile p WHERE p.status = 'approved'",
    )
    .bind(now)
    .all<Record<string, unknown>>();
  const drivers: DriverDirectoryEntry[] = rows.results.map(row => {
    const profile = JSON.parse(String(row.public_copy_json ?? "{}")) as {
      displayName?: string;
      serviceAreas?: string[];
    };
    const vehicles = Number(row.vehicles);
    const validEvidence = Number(row.valid_evidence);
    return {
      driverProfileId: String(row.id),
      displayName: profile.displayName ?? "",
      governorates: profile.serviceAreas ?? [],
      acceptingNew: Number(row.accepting_new) === 1,
      eligibleForNewWork: vehicles > 0 && validEvidence >= 2,
      averageStars: row.avg_stars === null ? null : Number(row.avg_stars),
      ratingsCount: Number(row.ratings),
    };
  });
  return jsonResponse({ drivers });
}

/** GET /api/delivery/drivers/:id — the driver's approved public profile. */
export async function driverPublicProfile(ctx: RouteContext): Promise<Response> {
  const row = await db(ctx)
    .prepare("SELECT id, public_copy_json, status FROM driver_profile WHERE id = ?")
    .bind(ctx.params.id!)
    .first<Record<string, unknown>>();
  if (!row || String(row.status) !== "approved") throw new HttpError(404, "not_found");
  const profile = JSON.parse(String(row.public_copy_json ?? "{}")) as Record<string, unknown>;
  return jsonResponse({ driver: { id: String(row.id), ...profile } });
}

async function loadRequest(ctx: RouteContext, requestId: string) {
  const row = await db(ctx)
    .prepare(
      "SELECT id, requester_identity_id, driver_profile_id, need_type, payload_json, collection_minor, collection_content, " +
        "pricing_mode, offered_fare_minor, status, agreement_copy_json, agreement_version, response_deadline_at, quote_id, created_at " +
        "FROM delivery_request WHERE id = ?",
    )
    .bind(requestId)
    .first<Record<string, unknown>>();
  if (!row) throw new HttpError(404, "not_found");
  return row;
}

/** The disclosure view: what the OTHER party may see (contract 21 §4). */
function redactPayload(
  payload: Record<string, unknown>,
  disclosure: string,
  requestStatus: string,
): Record<string, unknown> {
  if (disclosure === "allowed_after_acceptance" && requestStatus === "confirmed") {
    return payload;
  }
  // Blocked by default (EX-O14): an ALLOWLIST — only zones, schedule, and
  // load characteristics reach the driver; any future payload field stays
  // private unless explicitly added here.
  const pickup = payload.pickup as Record<string, unknown> | undefined;
  const dropoff = payload.dropoff as Record<string, unknown> | undefined;
  return {
    pickup: { governorate: pickup?.governorate, area: pickup?.area },
    dropoff: { governorate: dropoff?.governorate, area: dropoff?.area },
    load: payload.load,
    schedule: payload.schedule,
  };
}

/** GET /api/delivery/requests/:id — party view (requester or assigned driver). */
export async function requestDetail(ctx: RouteContext, auth: AuthenticatedContext): Promise<Response> {
  const row = await loadRequest(ctx, ctx.params.id!);
  const requesterId = String(row.requester_identity_id);
  const driverProfileRow = await db(ctx)
    .prepare("SELECT id, identity_id, public_copy_json FROM driver_profile WHERE id = ?")
    .bind(String(row.driver_profile_id))
    .first<Record<string, unknown>>();
  if (!driverProfileRow) throw new HttpError(404, "not_found");
  const isRequester = requesterId === auth.identityId;
  const isDriver = String(driverProfileRow.identity_id) === auth.identityId;
  if (!isRequester && !isDriver && !auth.isAdmin) throw new HttpError(404, "not_found");
  const now = nowMs();
  const status = effectiveRequestStatus(
    String(row.status) as RequestStatus,
    row.response_deadline_at === null ? null : Number(row.response_deadline_at),
    now,
  );
  const payload = JSON.parse(String(row.payload_json)) as Record<string, unknown>;
  const disclosure = await getDisclosureSettings(db(ctx));
  const quote = row.quote_id
    ? await db(ctx)
        .prepare("SELECT id, fare_minor, scope_json, valid_until FROM delivery_quote WHERE id = ?")
        .bind(String(row.quote_id))
        .first<Record<string, unknown>>()
    : null;
  const execution = await db(ctx)
    .prepare(
      "SELECT execution_status, confirmation_status, contact_status, goods_location, money_status, confirmation_requested_at FROM delivery_execution WHERE request_id = ?",
    )
    .bind(String(row.id))
    .first<Record<string, unknown>>();
  const consentProposals = await db(ctx)
    .prepare(
      "SELECT id, kind, terms_json, status, proposed_by_identity_id, decided_at, decision_note, applied_execution, created_at FROM delivery_consent_proposal WHERE request_id = ? ORDER BY created_at DESC, id DESC LIMIT 10",
    )
    .bind(String(row.id))
    .all<Record<string, unknown>>();
  const changeProposals = await db(ctx)
    .prepare(
      "SELECT id, changes_json, status, proposed_by_identity_id, decided_at, decision_note, resulting_agreement_version, created_at FROM delivery_change_proposal WHERE request_id = ? ORDER BY created_at DESC, id DESC LIMIT 10",
    )
    .bind(String(row.id))
    .all<Record<string, unknown>>();
  const events = await db(ctx)
    .prepare(
      "SELECT axis, event_type, from_value, to_value, reason, created_at FROM delivery_event WHERE request_id = ? ORDER BY created_at, id",
    )
    .bind(String(row.id))
    .all<Record<string, unknown>>();
  const requester = await db(ctx)
    .prepare("SELECT display_name FROM network_identity WHERE id = ?")
    .bind(requesterId)
    .first<Record<string, unknown>>();
  return jsonResponse({
    request: {
      id: String(row.id),
      status,
      pricingMode: String(row.pricing_mode),
      offeredFareMinor: row.offered_fare_minor === null ? null : String(row.offered_fare_minor),
      collectionMinor: row.collection_minor === null ? null : String(row.collection_minor),
      collectionContent: row.collection_content === null ? null : String(row.collection_content),
      responseDeadlineAt: row.response_deadline_at === null ? null : Number(row.response_deadline_at),
      agreementCopy:
        row.agreement_copy_json === null
          ? null
          : isRequester ||
              auth.isAdmin ||
              (disclosure.recipient_details_to_driver === "allowed_after_acceptance" &&
                status === "confirmed")
            ? (JSON.parse(String(row.agreement_copy_json)) as Record<string, unknown>)
            : {
                ...(JSON.parse(String(row.agreement_copy_json)) as Record<string, unknown>),
                payload: redactPayload(
                  (JSON.parse(String(row.agreement_copy_json)) as { payload: Record<string, unknown> })
                    .payload,
                  disclosure.recipient_details_to_driver,
                  status,
                ),
              },
      payload: isRequester ? payload : redactPayload(payload, disclosure.recipient_details_to_driver, status),
      createdAt: Number(row.created_at),
    },
    quote:
      quote === null
        ? null
        : {
            id: String(quote.id),
            fareMinor: String(quote.fare_minor),
            scope: String(quote.scope_json),
            validUntil: Number(quote.valid_until),
          },
    execution:
      execution === null
        ? null
        : {
            execution: String(execution.execution_status),
            confirmation: String(execution.confirmation_status),
            contact: String(execution.contact_status),
            goods: String(execution.goods_location),
            money: String(execution.money_status),
            confirmationRequestedAt:
              execution.confirmation_requested_at === null ||
              execution.confirmation_requested_at === undefined
                ? null
                : Number(execution.confirmation_requested_at),
          },
    agreementVersion: Number(row.agreement_version ?? 1),
    consentProposals: consentProposals.results.map(proposal => ({
      id: String(proposal.id),
      kind: String(proposal.kind),
      terms: JSON.parse(String(proposal.terms_json ?? "{}")),
      status: String(proposal.status),
      proposedBy: String(proposal.proposed_by_identity_id),
      decidedAt: proposal.decided_at === null ? null : Number(proposal.decided_at),
      decisionNote: proposal.decision_note === null ? null : String(proposal.decision_note),
      appliedExecution: proposal.applied_execution === null ? null : String(proposal.applied_execution),
      createdAt: Number(proposal.created_at),
    })),
    changeProposals: changeProposals.results.map(proposal => ({
      id: String(proposal.id),
      changes: JSON.parse(String(proposal.changes_json ?? "{}")),
      status: String(proposal.status),
      proposedBy: String(proposal.proposed_by_identity_id),
      decidedAt: proposal.decided_at === null ? null : Number(proposal.decided_at),
      decisionNote: proposal.decision_note === null ? null : String(proposal.decision_note),
      resultingVersion:
        proposal.resulting_agreement_version === null ? null : Number(proposal.resulting_agreement_version),
      createdAt: Number(proposal.created_at),
    })),
    events: events.results.map(event => ({
      axis: String(event.axis),
      type: String(event.event_type),
      from: event.from_value === null ? null : String(event.from_value),
      to: event.to_value === null ? null : String(event.to_value),
      reason: event.reason === null ? null : String(event.reason),
      at: Number(event.created_at),
    })),
    requester: {
      id: String(requesterId),
      displayName: String(requester?.display_name ?? ""),
    },
    driver: {
      id: String(driverProfileRow.id),
      profile: JSON.parse(String(driverProfileRow.public_copy_json ?? "{}")),
    },
    viewerRole: isRequester ? "requester" : isDriver ? "driver" : "admin",
  });
}

/** GET /api/delivery/overview — the owner's delivery tab data. */
export async function ownerOverview(ctx: RouteContext, auth: AuthenticatedContext): Promise<Response> {
  const now = nowMs();
  const rows = await db(ctx)
    .prepare(
      "SELECT id, status, response_deadline_at, pricing_mode, offered_fare_minor, collection_minor, created_at, updated_at " +
        "FROM delivery_request WHERE requester_identity_id = ? ORDER BY updated_at DESC LIMIT 50",
    )
    .bind(auth.identityId)
    .all<Record<string, unknown>>();
  const requests = rows.results.map(row => ({
    id: String(row.id),
    status: effectiveRequestStatus(
      String(row.status) as RequestStatus,
      row.response_deadline_at === null ? null : Number(row.response_deadline_at),
      now,
    ),
    pricingMode: String(row.pricing_mode),
    offeredFareMinor: row.offered_fare_minor === null ? null : String(row.offered_fare_minor),
    collectionMinor: row.collection_minor === null ? null : String(row.collection_minor),
    createdAt: Number(row.created_at),
    updatedAt: Number(row.updated_at),
  }));
  const saved = await db(ctx)
    .prepare(
      "SELECT sd.driver_profile_id, p.public_copy_json FROM saved_driver sd JOIN driver_profile p ON p.id = sd.driver_profile_id " +
        "WHERE sd.owner_identity_id = ?",
    )
    .bind(auth.identityId)
    .all<Record<string, unknown>>();
  return jsonResponse({
    requests,
    savedDrivers: saved.results.map(row => ({
      driverProfileId: String(row.driver_profile_id),
      profile: JSON.parse(String(row.public_copy_json ?? "{}")),
    })),
  });
}
