/**
 * Material change to a CONFIRMED booking (contract 21 §3.2-2, OD11 —
 * continuation 2026-11-12): time, price, load, address, vehicle, or
 * collection amount are versioned proposals. The accepted agreement stays
 * effective and immutable until the OTHER party explicitly accepts; reject
 * and withdraw paths are explicit; history is preserved (events + versioned
 * agreement copies). Never a silent overwrite of agreed terms.
 */

import { notify } from "../audit.ts";
import { nowMs } from "../clock.ts";
import { randomToken } from "../crypto.ts";
import { newId, type Db } from "../db/d1.ts";
import { parseMinorAmount } from "../domain/delivery.ts";
import { dailyBucket, enforceRate, rateLimits } from "../ratelimit.ts";
import { HttpError, jsonResponse } from "../http.ts";
import { readJsonBody, type RouteContext } from "../router.ts";
import { loadRequest, notifyDriver, recordEvent } from "./deliveryShared.ts";
import type { AuthenticatedContext } from "../auth/session.ts";

function db(ctx: RouteContext): Db {
  return ctx.env.DB;
}

export interface ChangeFields {
  fareMinor?: string;
  schedule?: { date?: string; pickupWindow?: string; dropoffWindow?: string };
  pickup?: { governorate?: string; area?: string; address?: string };
  dropoff?: { governorate?: string; area?: string; address?: string };
  load?: { description?: string; parcels?: number };
  vehicleId?: string;
  collectionMinor?: string | null;
  collectionContent?: "product" | "product_and_fare";
  note?: string;
}

const MATERIAL_KEYS = [
  "fareMinor",
  "schedule",
  "pickup",
  "dropoff",
  "load",
  "vehicleId",
  "collectionMinor",
  "collectionContent",
] as const;

type Party = "requester" | "driver";

async function resolveParty(
  ctx: RouteContext,
  auth: AuthenticatedContext,
  row: Record<string, unknown>,
): Promise<{ party: Party | null; driverIdentityId: string | null }> {
  const driverProfile = await db(ctx)
    .prepare("SELECT id, identity_id FROM driver_profile WHERE id = ?")
    .bind(String(row.driver_profile_id))
    .first<Record<string, unknown>>();
  const driverIdentityId = driverProfile === null ? null : String(driverProfile.identity_id);
  if (String(row.requester_identity_id) === auth.identityId) return { party: "requester", driverIdentityId };
  if (driverIdentityId !== null && driverIdentityId === auth.identityId)
    return { party: "driver", driverIdentityId };
  return { party: null, driverIdentityId };
}

function validateChangeFields(changes: ChangeFields): void {
  const present = MATERIAL_KEYS.filter(key => (changes as Record<string, unknown>)[key] !== undefined);
  if (present.length === 0) {
    throw new HttpError(400, "bad_request", { field: "changes", reason: "no_material_fields" });
  }
  if (changes.fareMinor !== undefined) parseMinorAmount(changes.fareMinor, "changes.fareMinor");
  if (changes.schedule !== undefined && (typeof changes.schedule !== "object" || changes.schedule === null)) {
    throw new HttpError(400, "bad_request", { field: "changes.schedule" });
  }
  if (changes.pickup !== undefined && (typeof changes.pickup !== "object" || changes.pickup === null)) {
    throw new HttpError(400, "bad_request", { field: "changes.pickup" });
  }
  if (changes.dropoff !== undefined && (typeof changes.dropoff !== "object" || changes.dropoff === null)) {
    throw new HttpError(400, "bad_request", { field: "changes.dropoff" });
  }
  if (changes.load !== undefined && (typeof changes.load !== "object" || changes.load === null)) {
    throw new HttpError(400, "bad_request", { field: "changes.load" });
  }
  if (changes.vehicleId !== undefined && typeof changes.vehicleId !== "string") {
    throw new HttpError(400, "bad_request", { field: "changes.vehicleId" });
  }
  if (changes.collectionMinor !== undefined && changes.collectionMinor !== null) {
    parseMinorAmount(changes.collectionMinor, "changes.collectionMinor");
  }
  if (
    changes.collectionContent !== undefined &&
    !["product", "product_and_fare"].includes(changes.collectionContent)
  ) {
    throw new HttpError(400, "bad_request", { field: "changes.collectionContent" });
  }
}

/** POST /api/delivery/requests/:id/change — either party proposes a material
 * change; it stays pending until the other party explicitly accepts. */
export async function proposeChange(ctx: RouteContext, auth: AuthenticatedContext): Promise<Response> {
  const row = await loadRequest(ctx, ctx.params.id!);
  const { party, driverIdentityId } = await resolveParty(ctx, auth, row);
  if (party === null) throw new HttpError(404, "not_found");
  if (String(row.status) !== "confirmed") {
    throw new HttpError(409, "conflict", { reason: "changes_require_confirmed_booking" });
  }
  const body = (await readJsonBody(ctx.request)) as { changes?: unknown; note?: unknown };
  const changes = (body.changes ?? {}) as ChangeFields;
  if (typeof changes !== "object" || changes === null || Array.isArray(changes)) {
    throw new HttpError(400, "bad_request", { field: "changes" });
  }
  validateChangeFields(changes);
  if (changes.vehicleId !== undefined) {
    // A vehicle amendment must point at an approved vehicle of THIS driver.
    const vehicle = await db(ctx)
      .prepare(
        "SELECT id, info_json FROM driver_vehicle WHERE id = ? AND driver_profile_id = ? AND status = 'approved'",
      )
      .bind(changes.vehicleId, String(row.driver_profile_id))
      .first<Record<string, unknown>>();
    if (!vehicle) throw new HttpError(409, "conflict", { reason: "vehicle_not_approved_for_driver" });
  }
  const pending = await db(ctx)
    .prepare("SELECT id FROM delivery_change_proposal WHERE request_id = ? AND status = 'pending'")
    .bind(String(row.id))
    .first();
  if (pending) throw new HttpError(409, "conflict", { reason: "change_proposal_already_pending" });
  const limits = await rateLimits(db(ctx));
  await enforceRate(
    db(ctx),
    dailyBucket("change-propose", auth.identityId, nowMs()),
    limits.submissionsPerDay,
    24 * 60 * 60 * 1000,
    nowMs(),
  );
  const id = newId("chg", randomToken);
  const now = nowMs();
  const payload = JSON.stringify({
    changes,
    note: typeof body.note === "string" ? body.note.slice(0, 500) : null,
  });
  await db(ctx)
    .prepare(
      "INSERT INTO delivery_change_proposal (id, request_id, proposed_by_identity_id, changes_json, status, created_at, updated_at) VALUES (?, ?, ?, ?, 'pending', ?, ?)",
    )
    .bind(id, String(row.id), auth.identityId, payload, now, now)
    .run();
  await recordEvent(
    ctx,
    String(row.id),
    "agreement",
    "change_proposed",
    `v${String(Number(row.agreement_version ?? 1))}`,
    "pending",
    auth.identityId,
    payload,
  );
  const otherIdentity = party === "requester" ? driverIdentityId : String(row.requester_identity_id);
  if (otherIdentity !== null) {
    await notify(
      db(ctx),
      {
        identityId: otherIdentity,
        type: "booking_modified",
        targetPath:
          party === "requester" ? `/driver/booking/${String(row.id)}` : `/delivery/booking/${String(row.id)}`,
        payload: {
          requestId: String(row.id),
          proposalId: id,
          fields: MATERIAL_KEYS.filter(key => (changes as Record<string, unknown>)[key] !== undefined),
        },
        idempotencyKey: `change-proposal:${id}`,
      },
      now,
    ).catch(() => undefined);
  }
  return jsonResponse({ proposal: { id, status: "pending" } }, 201);
}

/** Apply an accepted change onto the frozen agreement copy as a NEW version —
 * the previous version stays in history (events); nothing is overwritten in
 * place without the other party's acceptance. */
function applyChangesToAgreement(
  agreement: Record<string, unknown>,
  changes: ChangeFields,
  vehicleRow: Record<string, unknown> | null,
  now: number,
  proposalId: string,
): { agreement: Record<string, unknown>; payload: Record<string, unknown> } {
  const next: Record<string, unknown> = { ...agreement };
  const payload = { ...((next.payload ?? {}) as Record<string, unknown>) };
  if (changes.fareMinor !== undefined) next.fareMinor = changes.fareMinor;
  if (changes.schedule !== undefined)
    payload.schedule = { ...(payload.schedule as object | undefined), ...changes.schedule };
  if (changes.pickup !== undefined)
    payload.pickup = { ...(payload.pickup as object | undefined), ...changes.pickup };
  if (changes.dropoff !== undefined)
    payload.dropoff = { ...(payload.dropoff as object | undefined), ...changes.dropoff };
  if (changes.load !== undefined) payload.load = { ...(payload.load as object | undefined), ...changes.load };
  if (changes.vehicleId !== undefined) {
    next.vehicle = vehicleRow
      ? { id: String(vehicleRow.id), info: JSON.parse(String(vehicleRow.info_json ?? "{}")) }
      : null;
  }
  if (changes.collectionMinor !== undefined) next.collectionMinor = changes.collectionMinor;
  if (changes.collectionContent !== undefined) next.collectionContent = changes.collectionContent;
  next.payload = payload;
  next.version = Number(next.version ?? 1) + 1;
  next.amendedAt = now;
  next.amendedByProposal = proposalId;
  return { agreement: next, payload };
}

/** POST /api/delivery/requests/:id/change/decide — the OTHER party accepts or
 * rejects. The proposer never decides his own proposal. */
export async function decideChange(ctx: RouteContext, auth: AuthenticatedContext): Promise<Response> {
  const row = await loadRequest(ctx, ctx.params.id!);
  const { party, driverIdentityId } = await resolveParty(ctx, auth, row);
  if (party === null && !auth.isAdmin) throw new HttpError(404, "not_found");
  const body = (await readJsonBody(ctx.request)) as {
    proposalId?: unknown;
    decision?: unknown;
    note?: unknown;
  };
  if (typeof body.proposalId !== "string") throw new HttpError(400, "bad_request", { field: "proposalId" });
  if (body.decision !== "accept" && body.decision !== "reject") {
    throw new HttpError(400, "bad_request", { field: "decision" });
  }
  const proposal = await db(ctx)
    .prepare(
      "SELECT id, request_id, proposed_by_identity_id, changes_json, status, resulting_agreement_version FROM delivery_change_proposal WHERE id = ?",
    )
    .bind(body.proposalId)
    .first<Record<string, unknown>>();
  if (!proposal || String(proposal.request_id) !== String(row.id)) throw new HttpError(404, "not_found");
  const proposedBy = String(proposal.proposed_by_identity_id);
  const proposerParty: Party | null =
    proposedBy === String(row.requester_identity_id)
      ? "requester"
      : proposedBy === driverIdentityId
        ? "driver"
        : null;
  // The decider must be the OTHER party — never the proposer.
  if (proposerParty === party) {
    throw new HttpError(403, "forbidden", { reason: "other_party_decision_required" });
  }
  if (party === null && !auth.isAdmin) throw new HttpError(404, "not_found");
  if (String(proposal.status) !== "pending") {
    throw new HttpError(409, "conflict", { reason: `proposal_already_${String(proposal.status)}` });
  }
  const now = nowMs();
  const accept = body.decision === "accept";
  const oldVersion = Number(row.agreement_version ?? 1);
  let newVersion: number | null = null;
  if (accept) {
    if (String(row.status) !== "confirmed") {
      throw new HttpError(409, "conflict", { reason: "booking_no_longer_confirmed" });
    }
    const { changes: stored } = JSON.parse(String(proposal.changes_json)) as {
      changes: ChangeFields;
      note: string | null;
    };
    let vehicleRow: Record<string, unknown> | null = null;
    if (stored.vehicleId !== undefined) {
      vehicleRow = await db(ctx)
        .prepare(
          "SELECT id, info_json FROM driver_vehicle WHERE id = ? AND driver_profile_id = ? AND status = 'approved'",
        )
        .bind(stored.vehicleId, String(row.driver_profile_id))
        .first<Record<string, unknown>>();
      if (!vehicleRow) throw new HttpError(409, "conflict", { reason: "vehicle_not_approved_for_driver" });
    }
    const agreement = JSON.parse(String(row.agreement_copy_json ?? "{}")) as Record<string, unknown>;
    const applied = applyChangesToAgreement(agreement, stored, vehicleRow, now, String(proposal.id));
    newVersion = Number(applied.agreement.version);
    // Row columns stay coherent with the amended agreement (existing views
    // read them); the agreement copy itself is the versioned record.
    const sets: string[] = [
      "agreement_copy_json = ?",
      "agreement_version = ?",
      "payload_json = ?",
      "updated_at = ?",
    ];
    const values: unknown[] = [
      JSON.stringify(applied.agreement),
      newVersion,
      JSON.stringify(applied.payload),
      now,
    ];
    if (stored.fareMinor !== undefined) {
      sets.push("offered_fare_minor = ?");
      values.push(stored.fareMinor);
    }
    if (stored.collectionMinor !== undefined) {
      sets.push("collection_minor = ?");
      values.push(stored.collectionMinor);
    }
    if (stored.collectionContent !== undefined) {
      sets.push("collection_content = ?");
      values.push(stored.collectionContent);
    }
    values.push(String(row.id));
    await db(ctx)
      .prepare(`UPDATE delivery_request SET ${sets.join(", ")} WHERE id = ?`)
      .bind(...values)
      .run();
  }
  const noteText = typeof body.note === "string" ? body.note.slice(0, 500) : null;
  const moved = await db(ctx)
    .prepare(
      "UPDATE delivery_change_proposal SET status = ?, decided_by_identity_id = ?, decided_at = ?, decision_note = ?, resulting_agreement_version = ?, updated_at = ? WHERE id = ? AND status = 'pending'",
    )
    .bind(
      accept ? "accepted" : "rejected",
      auth.identityId,
      now,
      noteText,
      newVersion,
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
    accept ? "change_accepted" : "change_rejected",
    `v${oldVersion}`,
    accept ? `v${newVersion}` : "rejected",
    auth.identityId,
    noteText ?? undefined,
  );
  if (accept) {
    const otherIdentity =
      proposerParty === "requester" ? driverIdentityId : String(row.requester_identity_id);
    if (otherIdentity !== null) {
      await notify(
        db(ctx),
        {
          identityId: otherIdentity,
          type: "booking_modified",
          targetPath:
            proposerParty === "requester"
              ? `/driver/booking/${String(row.id)}`
              : `/delivery/booking/${String(row.id)}`,
          payload: { requestId: String(row.id), proposalId: String(proposal.id), accepted: true },
          idempotencyKey: `change-accepted:${proposal.id}`,
        },
        now,
      ).catch(() => undefined);
    }
  }
  return jsonResponse({
    ok: true,
    decision: body.decision,
    version: newVersion,
    proposalId: String(proposal.id),
  });
}

/** POST /api/delivery/requests/:id/change/withdraw — the proposer pulls back a
 * still-pending change proposal; the agreed terms are untouched. */
export async function withdrawChange(ctx: RouteContext, auth: AuthenticatedContext): Promise<Response> {
  const row = await loadRequest(ctx, ctx.params.id!);
  const { party } = await resolveParty(ctx, auth, row);
  if (party === null) throw new HttpError(404, "not_found");
  const body = (await readJsonBody(ctx.request)) as { proposalId?: unknown };
  if (typeof body.proposalId !== "string") throw new HttpError(400, "bad_request", { field: "proposalId" });
  const full = await db(ctx)
    .prepare(
      "SELECT id, request_id, proposed_by_identity_id, status FROM delivery_change_proposal WHERE id = ?",
    )
    .bind(body.proposalId)
    .first<Record<string, unknown>>();
  if (!full || String(full.request_id) !== String(row.id)) throw new HttpError(404, "not_found");
  if (String(full.proposed_by_identity_id) !== auth.identityId) {
    throw new HttpError(403, "forbidden", { reason: "proposer_only" });
  }
  if (String(full.status) !== "pending") {
    throw new HttpError(409, "conflict", { reason: `proposal_already_${String(full.status)}` });
  }
  const now = nowMs();
  const moved = await db(ctx)
    .prepare(
      "UPDATE delivery_change_proposal SET status = 'withdrawn', updated_at = ? WHERE id = ? AND status = 'pending'",
    )
    .bind(now, String(full.id))
    .run();
  if (Number(moved.meta?.changes ?? 0) !== 1) {
    throw new HttpError(409, "conflict", { reason: "proposal_already_decided" });
  }
  await recordEvent(
    ctx,
    String(row.id),
    "agreement",
    "change_withdrawn",
    `v${Number(row.agreement_version ?? 1)}`,
    "withdrawn",
    auth.identityId,
  );
  return jsonResponse({ ok: true });
}
