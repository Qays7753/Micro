/**
 * Account role lifecycle (Post-Group 6 continuous completion — WS-251/DOC-041,
 * owner order 7593b9c4 §4 G01): the role-removal and draft-cancellation
 * behavior stated verbatim in the 2026-11-21 final decisions (ب — دورة الدور
 * Q5):
 *
 *   «كل دور يبدأ مسودة. … الإضافة من «حسابي» في أي وقت. إلغاء المسودة
 *   فوري. إزالة دور مفعّل بطلب: السائق لا يُزال دوره وعنده حجز جارٍ.
 *   المورد تُخفى إعلاناته فورًا وتُؤرشف. … السجلات المنتهية التي تخص
 *   الطرف الآخر تبقى باسم «مستخدم سابق».»
 *
 * Boundaries (owner order §4 G01 — hard):
 *  - NON-DESTRUCTIVE ONLY: a removal moves the profile to 'removed' and the
 *    supplier's listings to the pre-existing 'archived' status — no financial
 *    or history row is ever deleted; draft cancellation deletes rows that
 *    never left the owner's account (a draft profile/listing/evidence has no
 *    public or counterparty record).
 *  - The project-owner export/delete flow is NOT here: its destructive data
 *    boundary is unspecified, stays DEFERRED, and blocks nothing else.
 *  - Re-adding a role after removal is an unspecified recovery semantic: the
 *    save/submit paths refuse a removed profile honestly (409 role_removed).
 */

import { audit } from "../audit.ts";
import { nowMs } from "../clock.ts";
import type { Db } from "../db/db.ts";
import { HttpError, jsonResponse } from "../http.ts";
import type { RouteContext } from "../router.ts";
import type { AuthenticatedContext } from "../auth/session.ts";

function db(ctx: RouteContext): Db {
  return ctx.env.DB;
}

/* The requester-visible states that make a driver booking «جارٍ» — the exact
 * set the final decision protects: awaiting the driver's answer, awaiting the
 * requester's decision on a quote, or confirmed. */
const ONGOING_BOOKING_STATUSES =
  "('awaiting_driver_response','awaiting_requester_decision','confirmed')" as const;

/** POST /api/account/roles/supplier/cancel-draft — «إلغاء المسودة فوري». */
export async function cancelSupplierDraft(ctx: RouteContext, auth: AuthenticatedContext): Promise<Response> {
  const profile = await db(ctx)
    .prepare("SELECT id, status FROM supplier_profile WHERE identity_id = ?")
    .bind(auth.identityId)
    .first<Record<string, unknown>>();
  if (!profile) throw new HttpError(404, "not_found", { reason: "no_supplier_profile" });
  const status = String(profile.status);
  if (status !== "draft") {
    // An activated/submitted/suspended profile is not a draft — the honest
    // path for it is removal (or admin unsuspension), never a silent delete.
    throw new HttpError(409, "conflict", { reason: `supplier_draft_required_status_${status}` });
  }
  const now = nowMs();
  const profileId = String(profile.id);
  // Draft-only rows: they were never public and no counterparty record
  // references them (public listings are 'approved_for_publish' at minimum).
  await db(ctx)
    .prepare(
      "DELETE FROM listing_media WHERE listing_id IN (SELECT id FROM supplier_listing WHERE supplier_profile_id = ? AND status = 'draft')",
    )
    .bind(profileId)
    .run();
  await db(ctx)
    .prepare("DELETE FROM supplier_listing WHERE supplier_profile_id = ? AND status = 'draft'")
    .bind(profileId)
    .run();
  await db(ctx).prepare("DELETE FROM supplier_profile WHERE id = ?").bind(profileId).run();
  await audit(
    db(ctx),
    {
      actorIdentityId: auth.identityId,
      action: "supplier_draft_cancelled",
      objectType: "supplier_profile",
      objectId: profileId,
      result: "success",
    },
    now,
  );
  return jsonResponse({ ok: true, cancelled: "supplier_draft" });
}

/** POST /api/account/roles/driver/cancel-draft — «إلغاء المسودة فوري». */
export async function cancelDriverDraft(ctx: RouteContext, auth: AuthenticatedContext): Promise<Response> {
  const profile = await db(ctx)
    .prepare("SELECT id, status FROM driver_profile WHERE identity_id = ?")
    .bind(auth.identityId)
    .first<Record<string, unknown>>();
  if (!profile) throw new HttpError(404, "not_found", { reason: "no_driver_profile" });
  const status = String(profile.status);
  if (status !== "draft") {
    throw new HttpError(409, "conflict", { reason: `driver_draft_required_status_${status}` });
  }
  const now = nowMs();
  const profileId = String(profile.id);
  // Draft-only rows: evidence/vehicle rows of a never-approved application
  // never reached any counterparty (driver surfaces require 'approved').
  await db(ctx).prepare("DELETE FROM driver_evidence WHERE driver_profile_id = ?").bind(profileId).run();
  await db(ctx).prepare("DELETE FROM driver_vehicle WHERE driver_profile_id = ?").bind(profileId).run();
  await db(ctx).prepare("DELETE FROM driver_profile WHERE id = ?").bind(profileId).run();
  await audit(
    db(ctx),
    {
      actorIdentityId: auth.identityId,
      action: "driver_draft_cancelled",
      objectType: "driver_profile",
      objectId: profileId,
      result: "success",
    },
    now,
  );
  return jsonResponse({ ok: true, cancelled: "driver_draft" });
}

/** POST /api/account/roles/supplier/remove — «المورد تُخفى إعلاناته فورًا وتُؤرشف». */
export async function removeSupplierRole(ctx: RouteContext, auth: AuthenticatedContext): Promise<Response> {
  const profile = await db(ctx)
    .prepare("SELECT id, status FROM supplier_profile WHERE identity_id = ?")
    .bind(auth.identityId)
    .first<Record<string, unknown>>();
  if (!profile) throw new HttpError(404, "not_found", { reason: "no_supplier_profile" });
  const status = String(profile.status);
  if (status === "draft") {
    throw new HttpError(409, "conflict", { reason: "draft_use_cancel_draft" });
  }
  if (status === "removed") throw new HttpError(409, "conflict", { reason: "already_removed" });
  if (status !== "active") {
    // submitted/under review/suspended/… — the activated-role removal the
    // decision defines applies to the ACTIVE role; other states stay honest.
    throw new HttpError(409, "conflict", { reason: `supplier_active_required_status_${status}` });
  }
  const now = nowMs();
  const profileId = String(profile.id);
  // Hide + archive EVERY listing of this supplier in one move: 'archived' is
  // the pre-existing terminal status (public browse only ever shows
  // 'approved_for_publish' of an ACTIVE profile) and the rows are preserved.
  await db(ctx)
    .prepare(
      "UPDATE supplier_listing SET status = 'archived', hidden_at = COALESCE(hidden_at, ?), updated_at = ? " +
        "WHERE supplier_profile_id = ? AND status != 'archived'",
    )
    .bind(now, now, profileId)
    .run();
  await db(ctx)
    .prepare("UPDATE supplier_profile SET status = 'removed', removed_at = ?, updated_at = ? WHERE id = ?")
    .bind(now, now, profileId)
    .run();
  await audit(
    db(ctx),
    {
      actorIdentityId: auth.identityId,
      action: "supplier_role_removed",
      objectType: "supplier_profile",
      objectId: profileId,
      result: "success",
    },
    now,
  );
  return jsonResponse({ ok: true, removed: "supplier" });
}

/** POST /api/account/roles/driver/remove — «السائق لا يُزال دوره وعنده حجز جارٍ». */
export async function removeDriverRole(ctx: RouteContext, auth: AuthenticatedContext): Promise<Response> {
  const profile = await db(ctx)
    .prepare("SELECT id, status FROM driver_profile WHERE identity_id = ?")
    .bind(auth.identityId)
    .first<Record<string, unknown>>();
  if (!profile) throw new HttpError(404, "not_found", { reason: "no_driver_profile" });
  const status = String(profile.status);
  if (status === "draft") throw new HttpError(409, "conflict", { reason: "draft_use_cancel_draft" });
  if (status === "removed") throw new HttpError(409, "conflict", { reason: "already_removed" });
  if (status !== "approved") {
    throw new HttpError(409, "conflict", { reason: `driver_approved_required_status_${status}` });
  }
  const profileId = String(profile.id);
  // The protection the decision states: an ONGOING booking blocks removal.
  const ongoing = await db(ctx)
    .prepare(
      `SELECT COUNT(*) AS n FROM delivery_request WHERE driver_profile_id = ? AND status IN ${ONGOING_BOOKING_STATUSES}`,
    )
    .bind(profileId)
    .first<Record<string, unknown>>();
  if (Number(ongoing?.n ?? 0) > 0) {
    throw new HttpError(409, "conflict", {
      reason: "ongoing_booking_present",
      message: "لا يمكن إزالة دور السائق الآن: لديك حجز جارٍ. أكمل الحجز أولًا.",
    });
  }
  const now = nowMs();
  await db(ctx)
    .prepare(
      "UPDATE driver_profile SET status = 'removed', removed_at = ?, accepting_new = 0, updated_at = ? WHERE id = ?",
    )
    .bind(now, now, profileId)
    .run();
  await audit(
    db(ctx),
    {
      actorIdentityId: auth.identityId,
      action: "driver_role_removed",
      objectType: "driver_profile",
      objectId: profileId,
      result: "success",
    },
    now,
  );
  return jsonResponse({ ok: true, removed: "driver" });
}
