/**
 * Delivery API — the project-owner experience (contract 21).
 * Directed requests to a known driver only (OD03): no broadcast, no fallback,
 * no auto-assignment. Customer/recipient detailed contact data stays behind
 * the disclosure gate (EX-O14) — the driver sees zones until the owner's
 * documented legal decision; the requester's own phone is always visible to
 * both parties of a directed request.
 *
 * Wave 3 privacy slice (final decisions 2026-11-21 ج-بيانات المستلم/Q115/Q238
 * + د-8): the driver's recipient-data access stops IMMEDIATELY on
 * cancellation/withdrawal and 48 HOURS after the delivery declaration
 * (server clock — RECIPIENT_ACCESS_CUTOFF_MS); the admin's full read is
 * unlocked ONLY by an open case filed by a party (بلاغ على الحجز — MD-02),
 * audited with no content copy; the requester always sees their own data.
 */

import { audit, notify } from "../audit.ts";
import { dailyBucket, enforceGuestReadLimit, enforceRate, rateLimits } from "../ratelimit.ts";
import { nowMs } from "../clock.ts";
import { randomToken } from "../crypto.ts";
import { getDisclosureSettings, newId, type Db } from "../db/db.ts";
import {
  effectiveRequestStatus,
  NO_SHOW_GRACE_MS,
  NO_SHOW_REVIEW_THRESHOLD,
  NO_SHOW_REVIEW_WINDOW_MS,
  type RequestStatus,
} from "../domain/delivery.ts";
import { DRIVER_RESPONSE_WINDOW_MS } from "../env.ts";
import { HttpError, jsonResponse } from "../http.ts";
import { readJsonBody, type RouteContext } from "../router.ts";
import { driverStatus } from "../authorization.ts";
import type { AuthenticatedContext } from "../auth/session.ts";
import { bookingPayloadSummary, driverHasOverlappingConfirmed, recordEvent } from "./deliveryShared.ts";

function db(ctx: RouteContext): Db {
  return ctx.env.DB;
}

/** ج-بيانات المستلم: the driver loses recipient-data access 48 hours after
 * the delivery declaration (server time — never a client clock). */
export const RECIPIENT_ACCESS_CUTOFF_MS = 48 * 60 * 60 * 1000;

/** د-8: the closed reason set for a delivery case (بلاغ على الحجز). */
const DELIVERY_CASE_REASONS = [
  "undelivered",
  "damage",
  "no_show",
  "fare_dispute",
  "contact_issue",
  "other",
] as const;

/**
 * POST /api/delivery/requests/:id/report — a PARTY (requester or assigned
 * driver) files a case on the booking (د-8: بلاغ على الحجز). The case is the
 * ONLY key that unlocks the administrative full read (MD-02) and never
 * copies recipient data — just the reference, the reason, and the details.
 * Daily rate-limited per reporter like the market report path.
 */
export async function reportDeliveryCase(ctx: RouteContext, auth: AuthenticatedContext): Promise<Response> {
  const body = (await readJsonBody(ctx.request)) as { reason?: string; details?: string };
  if (
    typeof body.reason !== "string" ||
    !(DELIVERY_CASE_REASONS as readonly string[]).includes(body.reason)
  ) {
    throw new HttpError(400, "bad_request", { field: "reason" });
  }
  const now = nowMs();
  const row = await db(ctx)
    .prepare("SELECT id, requester_identity_id, driver_profile_id FROM delivery_request WHERE id = ?")
    .bind(ctx.params.id!)
    .first<Record<string, unknown>>();
  if (!row) throw new HttpError(404, "not_found");
  const driverIdentity = await db(ctx)
    .prepare("SELECT identity_id FROM driver_profile WHERE id = ?")
    .bind(String(row.driver_profile_id))
    .first<{ identity_id: string }>();
  const isRequester = String(row.requester_identity_id) === auth.identityId;
  const isDriver = driverIdentity !== null && driverIdentity.identity_id === auth.identityId;
  if (!isRequester && !isDriver) throw new HttpError(404, "not_found");
  const limits = await rateLimits(db(ctx));
  await enforceRate(
    db(ctx),
    dailyBucket("delivery-case", auth.identityId, now),
    limits.reportsPerDay,
    24 * 60 * 60 * 1000,
    now,
  );
  const filed = await db(ctx)
    .prepare(
      "INSERT INTO delivery_case (request_id, reporter_identity_id, reason, details, created_at) VALUES (?, ?, ?, ?, ?) RETURNING id",
    )
    .bind(
      String(row.id),
      auth.identityId,
      body.reason,
      typeof body.details === "string" ? body.details.slice(0, 1000) : null,
      now,
    )
    .first<{ id: number }>();
  await audit(
    db(ctx),
    {
      actorIdentityId: auth.identityId,
      action: "delivery_case_filed",
      objectType: "delivery_request",
      objectId: String(row.id),
      result: "success",
      meta: { caseId: Number(filed?.id ?? 0), reason: body.reason },
    },
    now,
  );
  return jsonResponse({ ok: true, caseId: Number(filed?.id ?? 0) }, 201);
}

/** POST /api/delivery/requests/:id/no-show — Q242 (القرار النهائي د-4):
 * «لم يحضر» بعد 30 دقيقة من الموعد — ساعة الخادم تحسم. صاحب الحجز وحده
 * يبلّغ، على حجز مؤكد لم تُلتقط بضاعته بعد؛ ثلاث حالات خلال 30 يومًا
 * ترفع علم المراجعة اليدوية وتُبلغ حسابات الإدارة (قرار المالك). */
export async function reportNoShow(ctx: RouteContext, auth: AuthenticatedContext): Promise<Response> {
  const now = nowMs();
  const row = await db(ctx)
    .prepare(
      "SELECT id, requester_identity_id, driver_profile_id, status, scheduled_start_at FROM delivery_request WHERE id = ?",
    )
    .bind(ctx.params.id!)
    .first<Record<string, unknown>>();
  if (!row || String(row.requester_identity_id) !== auth.identityId) throw new HttpError(404, "not_found");
  if (String(row.status) !== "confirmed") {
    throw new HttpError(409, "conflict", { reason: "no_show_requires_confirmed_booking" });
  }
  const scheduledStart = row.scheduled_start_at === null ? null : Number(row.scheduled_start_at);
  if (scheduledStart === null) {
    throw new HttpError(409, "conflict", { reason: "no_show_requires_scheduled_window" });
  }
  if (now < scheduledStart + NO_SHOW_GRACE_MS) {
    throw new HttpError(409, "conflict", { reason: "no_show_window_not_open_yet" });
  }
  const execution = await db(ctx)
    .prepare("SELECT execution_status FROM delivery_execution WHERE request_id = ?")
    .bind(String(row.id))
    .first<{ execution_status: string }>();
  if (
    execution !== null &&
    !["not_started", "heading_to_pickup", "arrived_at_source"].includes(execution.execution_status)
  ) {
    throw new HttpError(409, "conflict", { reason: "no_show_only_before_pickup" });
  }
  const id = newId("nsw", randomToken);
  try {
    await db(ctx)
      .prepare(
        "INSERT INTO no_show_report (id, request_id, reporter_identity_id, driver_profile_id, scheduled_start_at, reported_at) VALUES (?, ?, ?, ?, ?, ?)",
      )
      .bind(id, String(row.id), auth.identityId, String(row.driver_profile_id), scheduledStart, now)
      .run();
  } catch (error) {
    if (error !== null && typeof error === "object" && (error as { code?: string }).code === "23505") {
      throw new HttpError(409, "conflict", { reason: "no_show_already_reported" });
    }
    throw error;
  }
  await recordEvent(
    ctx,
    String(row.id),
    "request",
    "no_show_reported",
    "confirmed",
    "confirmed",
    auth.identityId,
  );
  /* Q242: ثلاث حالات خلال 30 يومًا تعني مراجعة يدوية — تُبلغ حسابات الإدارة
   * النشطة وتُدقّق؛ لا تعليق تلقائيًّا للسائق (القرار للمراجعة اليدوية). */
  const recent = await db(ctx)
    .prepare("SELECT COUNT(*) AS reports FROM no_show_report WHERE driver_profile_id = ? AND reported_at > ?")
    .bind(String(row.driver_profile_id), now - NO_SHOW_REVIEW_WINDOW_MS)
    .first<{ reports: number }>();
  if (Number(recent?.reports ?? 0) >= NO_SHOW_REVIEW_THRESHOLD) {
    const admins = await db(ctx)
      .prepare("SELECT identity_id FROM network_membership WHERE role = 'admin' AND status = 'active'")
      .all<{ identity_id: string }>();
    for (const admin of admins.results) {
      await notify(
        db(ctx),
        {
          identityId: String(admin.identity_id),
          type: "manual_review_required",
          targetPath: "/admin",
          payload: { driverProfileId: String(row.driver_profile_id), reason: "no_show_threshold" },
          idempotencyKey: `no-show-review:${row.driver_profile_id}:${now}`,
        },
        now,
      ).catch(() => undefined);
    }
    await audit(
      db(ctx),
      {
        actorIdentityId: auth.identityId,
        action: "no_show_review_threshold",
        objectType: "driver_profile",
        objectId: String(row.driver_profile_id),
        result: "success",
        meta: { reports: Number(recent?.reports ?? 0) },
      },
      now,
    );
  }
  return jsonResponse({ ok: true }, 201);
}

/** GET /api/delivery/cases — the admin's case list (open first). */
export async function listDeliveryCases(ctx: RouteContext, auth: AuthenticatedContext): Promise<Response> {
  if (!auth.isAdmin) throw new HttpError(403, "forbidden", { reason: "admin_only" });
  const rows = await db(ctx)
    .prepare(
      "SELECT c.id, c.request_id, c.reporter_identity_id, c.reason, c.details, c.status, c.resolution_note, c.closed_by, c.closed_at, c.created_at " +
        "FROM delivery_case c ORDER BY CASE WHEN c.status = 'open' THEN 0 ELSE 1 END, c.created_at DESC LIMIT 100",
    )
    .all<Record<string, unknown>>();
  return jsonResponse({
    cases: rows.results.map(entry => ({
      id: Number(entry.id),
      requestId: String(entry.request_id),
      reporterIdentityId: String(entry.reporter_identity_id),
      reason: String(entry.reason),
      details: entry.details === null ? null : String(entry.details),
      status: String(entry.status),
      resolutionNote: entry.resolution_note === null ? null : String(entry.resolution_note),
      closedBy: entry.closed_by === null ? null : String(entry.closed_by),
      closedAt: entry.closed_at === null ? null : Number(entry.closed_at),
      createdAt: Number(entry.created_at),
    })),
  });
}

/**
 * POST /api/delivery/cases/:id/close — the administrative closure with a
 * required reason (audited). Closing the case re-locks the administrative
 * full read of that booking's recipient data (MD-02 — the unlock is only
 * until closure, exactly the final decision's wording).
 */
export async function closeDeliveryCase(ctx: RouteContext, auth: AuthenticatedContext): Promise<Response> {
  if (!auth.isAdmin) throw new HttpError(403, "forbidden", { reason: "admin_only" });
  const body = (await readJsonBody(ctx.request)) as { note?: string };
  const note =
    typeof body.note === "string" && body.note.trim().length > 0 ? body.note.trim().slice(0, 1000) : null;
  if (note === null) throw new HttpError(400, "bad_request", { field: "note" });
  const caseIdParam = ctx.params.id!;
  if (!/^\d{1,18}$/.test(caseIdParam)) throw new HttpError(404, "not_found");
  const now = nowMs();
  const closed = await db(ctx)
    .prepare(
      "UPDATE delivery_case SET status = 'closed', resolution_note = ?, closed_by = ?, closed_at = ? WHERE id = ? AND status = 'open'",
    )
    .bind(note, auth.identityId, now, caseIdParam)
    .run();
  if (Number(closed.meta?.changes ?? 0) !== 1) {
    throw new HttpError(409, "conflict", { reason: "case_already_closed" });
  }
  await audit(
    db(ctx),
    {
      actorIdentityId: auth.identityId,
      action: "delivery_case_closed",
      objectType: "delivery_case",
      objectId: caseIdParam,
      result: "success",
      meta: { note },
    },
    now,
  );
  return jsonResponse({ ok: true });
}

export interface DriverDirectoryEntry {
  driverProfileId: string;
  displayName: string;
  governorates: string[];
  acceptingNew: boolean;
  eligibleForNewWork: boolean;
  averageStars: number | null;
  ratingsCount: number;
  /* Q73/Q93 (Wave 3): null = لم يُرسل مسار (لا ادعاء)؛ true/false = يغطي
   * المسار أو خارجه — الخارج مسموح والسائق يقرر. */
  coversRoute: boolean | null;
}

/** GET /api/delivery/drivers — the approved public driver directory (OD03).
 * Wave 3 (Q73/Q93 — القرار النهائي): القائمة تعرض كل السائقين المعتمدين؛
 * مع محافظتي المسار (pickupGovernorate/dropoffGovernorate) يُرتّب من يغطي
 * المسار أولًا مع علامة «يغطي مسارك»، ثم الباقون — الحجز خارج التغطية
 * مسموح والسائق يقرر، فلا رفض خادمي ولا إخفاء (سلوك صادق). */
export async function driverDirectory(ctx: RouteContext): Promise<Response> {
  const now = nowMs();
  await enforceGuestReadLimit(ctx.env.DB, ctx.request, now);
  const routePickup =
    typeof ctx.url.searchParams.get("pickupGovernorate") === "string" &&
    ctx.url.searchParams.get("pickupGovernorate") !== ""
      ? ctx.url.searchParams.get("pickupGovernorate")
      : null;
  const routeDropoff =
    typeof ctx.url.searchParams.get("dropoffGovernorate") === "string" &&
    ctx.url.searchParams.get("dropoffGovernorate") !== ""
      ? ctx.url.searchParams.get("dropoffGovernorate")
      : null;
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
  const routeKnown = routePickup !== null && routeDropoff !== null;
  const drivers: DriverDirectoryEntry[] = rows.results
    .map(row => {
      const profile = JSON.parse(String(row.public_copy_json ?? "{}")) as {
        displayName?: string;
        serviceAreas?: string[];
      };
      const vehicles = Number(row.vehicles);
      const validEvidence = Number(row.valid_evidence);
      const serviceAreas = Array.isArray(profile.serviceAreas)
        ? (profile.serviceAreas as unknown[]).filter((area): area is string => typeof area === "string")
        : [];
      return {
        driverProfileId: String(row.id),
        displayName: profile.displayName ?? "",
        governorates: serviceAreas,
        acceptingNew: Number(row.accepting_new) === 1,
        eligibleForNewWork: vehicles > 0 && validEvidence >= 2,
        averageStars: row.avg_stars === null ? null : Number(row.avg_stars),
        ratingsCount: Number(row.ratings),
        /* Q73: علامة التغطية — null حين لا يُرسل مسار (لا ادعاء)، true فقط حين
         * تغطي مناطق السائق المعلنة المحافظتين معًا. */
        coversRoute: routeKnown
          ? serviceAreas.includes(routePickup!) && serviceAreas.includes(routeDropoff!)
          : null,
      };
    })
    .sort((a, b) => {
      if (!routeKnown) return 0;
      const aCover = a.coversRoute === true ? 1 : 0;
      const bCover = b.coversRoute === true ? 1 : 0;
      if (aCover !== bCover) return bCover - aCover;
      return a.displayName.localeCompare(b.displayName, "ar");
    });
  return jsonResponse({ drivers });
}

/** GET /api/delivery/drivers/:id — the driver's approved public profile. */
export async function driverPublicProfile(ctx: RouteContext): Promise<Response> {
  // F-09 (S12 scan): the same guest read limiter as the directory — an
  // unbounded public profile surface is an unlimited scraping surface.
  await enforceGuestReadLimit(ctx.env.DB, ctx.request, nowMs());
  const row = await db(ctx)
    .prepare("SELECT id, public_copy_json, status FROM driver_profile WHERE id = ?")
    .bind(ctx.params.id!)
    .first<Record<string, unknown>>();
  if (!row || String(row.status) !== "approved") throw new HttpError(404, "not_found");
  const profile = JSON.parse(String(row.public_copy_json ?? "{}")) as Record<string, unknown>;
  /* PUBLIC-DRIVER-PROFILE (Post-Group 6 — أمر المالك bd242b3e): قائمة
   * سماح صريحة وحدها — الاسم والمحافظات وسعة الحمولة المعلنة (Q75)؛ رقم
   * الهاتف لا يظهر أبدًا في النسخة العامة (يظهر لطرف حجز مؤكد فقط عبر
   * عرض الطلب)، وأي حقل مستقبلي يبقى خاصًا ما لم يُضف هنا بقرار. */
  return jsonResponse({
    driver: {
      id: String(row.id),
      displayName: typeof profile.displayName === "string" ? profile.displayName : "",
      governorates: Array.isArray(profile.serviceAreas)
        ? (profile.serviceAreas as unknown[]).filter((area): area is string => typeof area === "string")
        : [],
      capacity: profile.capacity ?? null,
    },
  });
}

async function loadRequest(ctx: RouteContext, requestId: string) {
  const row = await db(ctx)
    .prepare(
      "SELECT id, requester_identity_id, driver_profile_id, need_type, payload_json, collection_minor, collection_content, " +
        "pricing_mode, offered_fare_minor, status, agreement_copy_json, agreement_version, response_deadline_at, quote_id, created_at, " +
        "load_class, piece_count, weight_band, scheduled_start_at, scheduled_end_at " +
        "FROM delivery_request WHERE id = ?",
    )
    .bind(requestId)
    .first<Record<string, unknown>>();
  if (!row) throw new HttpError(404, "not_found");
  return row;
}

/** PUBLIC-DRIVER-PROFILE: the driver profile allowlist for viewers — phone
 * included ONLY for a confirmed-booking party, never on the public page and
 * never for the admin viewer (an open case is the admin's path). */
function driverProfileForViewer(
  profile: Record<string, unknown>,
  includeContactOfConfirmedParty: boolean,
): Record<string, unknown> {
  const view: Record<string, unknown> = {
    displayName: typeof profile.displayName === "string" ? profile.displayName : "",
    governorates: Array.isArray(profile.serviceAreas)
      ? (profile.serviceAreas as unknown[]).filter((area): area is string => typeof area === "string")
      : [],
    capacity: profile.capacity ?? null,
  };
  if (includeContactOfConfirmedParty && typeof profile.phone === "string") {
    view.phone = profile.phone;
  }
  return view;
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
    .prepare("SELECT id, identity_id, status, public_copy_json FROM driver_profile WHERE id = ?")
    .bind(String(row.driver_profile_id))
    .first<Record<string, unknown>>();
  if (!driverProfileRow) throw new HttpError(404, "not_found");
  const isRequester = requesterId === auth.identityId;
  const isDriver = String(driverProfileRow.identity_id) === auth.identityId;
  /* Post-Group 6 continuous completion (G01 — دورة الدور): سجلات الطرف
   * الآخر لبائس مُزال دوره تبقى باسم «مستخدم سابق» — الإزالة لا تحذف
   * السجل ولا تعيد كتابته، والاسم والهاتف يُحجبان عن الطرف الآخر فقط؛
   * السائق المُزال نفسه يبقى يرى سجله. */
  const driverRemoved = String(driverProfileRow.status) === "removed" && !isDriver;
  const now = nowMs();
  if (!isRequester && !isDriver && !auth.isAdmin) {
    // F-07 (contract 22 §4): a denied attempt to read a delivery record is
    // audited — actor/reference/time only, never a content copy.
    await audit(
      db(ctx),
      {
        actorIdentityId: auth.identityId,
        action: "delivery_request_read",
        objectType: "delivery_request",
        objectId: String(row.id),
        result: "denied",
      },
      now,
    );
    throw new HttpError(404, "not_found");
  }
  const status = effectiveRequestStatus(
    String(row.status) as RequestStatus,
    row.response_deadline_at === null ? null : Number(row.response_deadline_at),
    now,
  );
  const payload = JSON.parse(String(row.payload_json)) as Record<string, unknown>;
  const disclosure = await getDisclosureSettings(db(ctx));
  const execution = await db(ctx)
    .prepare(
      "SELECT execution_status, confirmation_status, contact_status, goods_location, money_status, confirmation_requested_at FROM delivery_execution WHERE request_id = ?",
    )
    .bind(String(row.id))
    .first<Record<string, unknown>>();
  /* الموجة 3 (ج-بيانات المستلم/Q115/Q238 — القرار النهائي): القاعدة الزمنية
   * والقاعدة الإدارية لبيانات المستلم. وصول السائق يقف فورًا عند الإلغاء،
   * وبعد ٤٨ ساعة من إعلان التسليم (المحسوب من الطابع الخادمي لإعلان
   * التسليم — ساعة الخادم تحسم، لا ساعة العميل). والمشرف يرى التفاصيل
   * الكاملة فقط عبر قضية مفتوحة (MD-02) — بدونه تُعرض النسخة المنقّحة
   * نفسها التي يراها غير الأطراف، وكل قراءة مفتوحة تُدقّق بلا نسخة
   * محتوى. صاحب الحجز يرى بياناته دائمًا. */
  const executionConfirmationRequestedAt =
    execution === null ||
    execution.confirmation_requested_at === null ||
    execution.confirmation_requested_at === undefined
      ? null
      : Number(execution.confirmation_requested_at);
  const terminated = ["cancelled", "withdrawn"].includes(String(row.status));
  /* MD-01 (Post-Group 6 Wave 3): الموافقة على كشف بيانات المستلم موافقة
   * مدى الحجز — تُمنح عند الإنشاء بإصدار السياسة وتُسحب بطلب صاحب الحجز؛
   * تُتحقق هنا عند كل قراءة. بلا موافقة نشطة يبقى السائق على القائمة
   * المنقّحة حتى لو سمح الإعداد العام — الإعداد العام وحده لم يعد يكفي. */
  const recipientConsent =
    isDriver || isRequester
      ? await db(ctx)
          .prepare("SELECT revoked_at FROM recipient_data_consent WHERE request_id = ?")
          .bind(String(row.id))
          .first<{ revoked_at: number | null }>()
      : null;
  const recipientConsentActive = recipientConsent !== null && recipientConsent.revoked_at === null;
  const driverRecipientAccess =
    isDriver &&
    !terminated &&
    recipientConsentActive &&
    disclosure.recipient_details_to_driver === "allowed_after_acceptance" &&
    status === "confirmed" &&
    (executionConfirmationRequestedAt === null ||
      now < executionConfirmationRequestedAt + RECIPIENT_ACCESS_CUTOFF_MS);
  /* Q268 (Wave 3): صاحب الحجز يرى وجود حجوزات أخرى متداخلة للسائق —
   * علم واحد بلا أي تفاصيل (لا كشف تفاصيل حجوزات الآخرين أبدًا). */
  const windowStart = row.scheduled_start_at === null ? null : Number(row.scheduled_start_at);
  const windowEnd = row.scheduled_end_at === null ? null : Number(row.scheduled_end_at);
  const driverHasOtherBookingsInPeriod =
    isRequester &&
    windowStart !== null &&
    windowEnd !== null &&
    (await driverHasOverlappingConfirmed(
      db(ctx),
      String(row.driver_profile_id),
      String(row.id),
      windowStart,
      windowEnd,
    ));
  const openCase = auth.isAdmin
    ? await db(ctx)
        .prepare(
          "SELECT id FROM delivery_case WHERE request_id = ? AND status = 'open' ORDER BY created_at DESC LIMIT 1",
        )
        .bind(String(row.id))
        .first()
    : null;
  const adminRecipientAccess = auth.isAdmin && openCase !== null;
  if (adminRecipientAccess) {
    // MD-02 (contract 22 §4): the administrative read through an open case is
    // audited — actor/reference/time and the access scope ONLY, never a copy
    // of the field contents.
    await audit(
      db(ctx),
      {
        actorIdentityId: auth.identityId,
        action: "delivery_scoped_read",
        objectType: "delivery_request",
        objectId: String(row.id),
        result: "success",
        meta: { scope: "open_case_admin" },
      },
      now,
    );
  }
  if (driverRecipientAccess) {
    // F-07 (contract 22 §4, amendment E-12): the assigned driver reading
    // recipient-scoped details (phone/address) is audited — actor/reference/
    // time and the disclosure scope ONLY, never a copy of the field contents.
    await audit(
      db(ctx),
      {
        actorIdentityId: auth.identityId,
        action: "delivery_scoped_read",
        objectType: "delivery_request",
        objectId: String(row.id),
        result: "success",
        meta: { scope: "recipient_details" },
      },
      now,
    );
  }
  const quote = row.quote_id
    ? await db(ctx)
        .prepare("SELECT id, fare_minor, scope_json, valid_until FROM delivery_quote WHERE id = ?")
        .bind(String(row.quote_id))
        .first<Record<string, unknown>>()
    : null;
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
      needType: String(row.need_type),
      /* Wave 3 (Q75/Q100/Q268): خصائص الحمل والنافذة الزمنية — تظهر للطرفين
       * (خصائص الحمل ضمن قائمة السماح التعاقدية §4)؛ العلم المتداخل لصاحب
       * الحجز وحده وبلا تفاصيل. */
      loadClass: row.load_class === null ? null : String(row.load_class),
      weightBand: row.weight_band === null ? null : String(row.weight_band),
      pieceCount: row.piece_count === null ? null : Number(row.piece_count),
      scheduledStartAt: row.scheduled_start_at === null ? null : Number(row.scheduled_start_at),
      scheduledEndAt: row.scheduled_end_at === null ? null : Number(row.scheduled_end_at),
      driverHasOtherBookingsInPeriod,
      recipientConsentActive: isRequester ? recipientConsentActive : null,
      offeredFareMinor: row.offered_fare_minor === null ? null : String(row.offered_fare_minor),
      collectionMinor: row.collection_minor === null ? null : String(row.collection_minor),
      collectionContent: row.collection_content === null ? null : String(row.collection_content),
      responseDeadlineAt: row.response_deadline_at === null ? null : Number(row.response_deadline_at),
      agreementCopy:
        row.agreement_copy_json === null
          ? null
          : isRequester || adminRecipientAccess || driverRecipientAccess
            ? (JSON.parse(String(row.agreement_copy_json)) as Record<string, unknown>)
            : {
                ...(JSON.parse(String(row.agreement_copy_json)) as Record<string, unknown>),
                payload: redactPayload(
                  (JSON.parse(String(row.agreement_copy_json)) as { payload: Record<string, unknown> })
                    .payload,
                  "blocked",
                  status,
                ),
              },
      payload: isRequester
        ? payload
        : redactPayload(
            payload,
            driverRecipientAccess || adminRecipientAccess ? "allowed_after_acceptance" : "blocked",
            driverRecipientAccess || adminRecipientAccess ? "confirmed" : status,
          ),
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
      profile: driverRemoved
        ? /* «مستخدم سابق» — لا اسم ولا هاتف لسائق أُزيل دوره (G01). */
          { displayName: "مستخدم سابق", governorates: [], capacity: null }
        : driverProfileForViewer(
            JSON.parse(String(driverProfileRow.public_copy_json ?? "{}")) as Record<string, unknown>,
            /* PUBLIC-DRIVER-PROFILE + قرار المالك: الهاتف لطرف حجز مؤكد فقط —
             * ليس للزائر ولا للمشرف (المشرف يرى بيانات المستلم/الاتصال في بلاغ
             * أو نزاع مفتوح فقط — MD-02). */
            (isRequester || isDriver) && String(row.status) === "confirmed",
          ),
    },
    viewerRole: isRequester ? "requester" : isDriver ? "driver" : "admin",
  });
}

/** GET /api/delivery/overview — the owner's delivery tab data. */
export async function ownerOverview(ctx: RouteContext, auth: AuthenticatedContext): Promise<Response> {
  const now = nowMs();
  const rows = await db(ctx)
    .prepare(
      "SELECT r.id, r.status, r.response_deadline_at, r.pricing_mode, r.offered_fare_minor, r.collection_minor, r.payload_json, r.created_at, r.updated_at, p.status AS driver_status, p.public_copy_json AS driver_public_copy " +
        "FROM delivery_request r LEFT JOIN driver_profile p ON p.id = r.driver_profile_id " +
        "WHERE r.requester_identity_id = ? ORDER BY r.updated_at DESC LIMIT 50",
    )
    .bind(auth.identityId)
    .all<Record<string, unknown>>();
  const requests = rows.results.map(row => {
    /* R1-17 (أمر المالك 2026-11-14): المسار والموعد واسم السائق المعين
     * (إن وجد) على بطاقة النظرة نفسها — الاسم من النسخة العامة المعتمدة
     * وحدها (نمط الكشوف اليومية نفسه)؛ لا بيانات خاصة للسائق في القوائم. */
    let driverName: string | null = null;
    if (String(row.driver_status) === "removed") {
      /* G01 (دورة الدور): سائق أُزيل دوره — سجلات صاحب الحجز تبقى باسم
       * «مستخدم سابق» (الإزالة لا تحذف السجل ولا تعيد كتابته). */
      driverName = "مستخدم سابق";
    } else if (row.driver_public_copy !== null && row.driver_public_copy !== undefined) {
      try {
        const publicCopy = JSON.parse(String(row.driver_public_copy)) as { displayName?: unknown };
        if (typeof publicCopy.displayName === "string" && publicCopy.displayName.trim() !== "")
          driverName = publicCopy.displayName.trim();
      } catch {
        /* نسخة عامة تالفة لا تفشل النظرة — الاسم يبقى null */
      }
    }
    return {
      id: String(row.id),
      status: effectiveRequestStatus(
        String(row.status) as RequestStatus,
        row.response_deadline_at === null ? null : Number(row.response_deadline_at),
        now,
      ),
      pricingMode: String(row.pricing_mode),
      offeredFareMinor: row.offered_fare_minor === null ? null : String(row.offered_fare_minor),
      collectionMinor: row.collection_minor === null ? null : String(row.collection_minor),
      ...bookingPayloadSummary(row.payload_json),
      driverName,
      createdAt: Number(row.created_at),
      updatedAt: Number(row.updated_at),
    };
  });
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
