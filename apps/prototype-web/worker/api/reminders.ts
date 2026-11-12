/**
 * In-app reminders due-processing (contract 19 §9, continuation 2026-11-12):
 * Market 30-day availability reminder + 60-day hide notice (OD-11), Delivery
 * 24-hour requester-confirmation reminder (contract 21 §3.2-5), and the
 * 7-day driver-evidence-expiry reminder (OD31) — all in-app only, no email,
 * SMS, push, WhatsApp, or new vendor. Idempotent by fixed idempotency keys:
 * re-running the processor never duplicates a notification. All timing values
 * are documented operational engineering choices (env.ts), not owner product
 * decisions. There is NO auto-close: reminders never transition any state.
 *
 * Invocation paths (repository-side only):
 * 1. The worker `scheduled` export (Cloudflare Cron Trigger on the Pages
 *    project — an owner/Manus setup step; see worker/README.md).
 * 2. A manual admin endpoint for local emulation tests and UAT fallback.
 */

import { notify } from "../audit.ts";
import { nowMs } from "../clock.ts";
import {
  CONFIRMATION_REMINDER_MS,
  EVIDENCE_REMINDER_MS,
  LISTING_FRESHNESS_HIDE_MS,
  LISTING_FRESHNESS_REMINDER_MS,
} from "../env.ts";
import type { Db } from "../db/d1.ts";
import { HttpError, jsonResponse } from "../http.ts";
import type { RouteContext } from "../router.ts";
import type { AuthenticatedContext } from "../auth/session.ts";

export interface ReminderRunSummary {
  freshnessReminders: number;
  expiryNotices: number;
  confirmationReminders: number;
  evidenceReminders: number;
  processedAt: number;
}

/** Process every due reminder once. Idempotent: notification rows carry fixed
 * idempotency keys, so repeated runs insert nothing new. */
export async function processDueReminders(db: Db, now: number): Promise<ReminderRunSummary> {
  const summary: ReminderRunSummary = {
    freshnessReminders: 0,
    expiryNotices: 0,
    confirmationReminders: 0,
    evidenceReminders: 0,
    processedAt: now,
  };

  // (1) Market listing freshness (OD-11): remind the vendor 30 days after the
  // last availability confirmation; at 60 days the listing is hidden from
  // search (already enforced read-time in the browse query) and a one-time
  // expiry notice is sent. Renewal after hiding goes through review — the
  // reminder never un-hides or mutates anything.
  const staleListings = await db
    .prepare(
      "SELECT id, identity_id, availability_confirmed_at FROM supplier_listing " +
        "WHERE status = 'approved_for_publish' AND availability_confirmed_at <= ?",
    )
    .bind(now - LISTING_FRESHNESS_REMINDER_MS)
    .all<{ id: string; identity_id: string; availability_confirmed_at: number }>();
  for (const listing of staleListings.results) {
    const anchor = Number(listing.availability_confirmed_at);
    const age = now - anchor;
    if (age >= LISTING_FRESHNESS_HIDE_MS) {
      await notify(
        db,
        {
          identityId: String(listing.identity_id),
          type: "listing_expired",
          targetPath: "/market/vendor",
          payload: { listingId: String(listing.id) },
          idempotencyKey: `listing-expired:${listing.id}:${anchor}`,
        },
        now,
      );
      summary.expiryNotices += 1;
    } else {
      await notify(
        db,
        {
          identityId: String(listing.identity_id),
          type: "listing_freshness_reminder",
          targetPath: "/market/vendor",
          payload: { listingId: String(listing.id) },
          idempotencyKey: `listing-freshness:${listing.id}:${anchor}`,
        },
        now,
      );
      summary.freshnessReminders += 1;
    }
  }

  // (2) Delivery requester confirmation (contract 21 §3.2-5): ONE engineering
  // reminder 24h after the wait opened. Silence never closes anything (OD16).
  const awaitingConfirmations = await db
    .prepare(
      "SELECT e.request_id, e.confirmation_requested_at, r.requester_identity_id FROM delivery_execution e " +
        "JOIN delivery_request r ON r.id = e.request_id " +
        "WHERE e.confirmation_status = 'awaiting_requester_confirmation' AND e.confirmation_requested_at IS NOT NULL " +
        "AND e.confirmation_requested_at <= ?",
    )
    .bind(now - CONFIRMATION_REMINDER_MS)
    .all<{ request_id: string; confirmation_requested_at: number; requester_identity_id: string }>();
  for (const waiting of awaitingConfirmations.results) {
    await notify(
      db,
      {
        identityId: String(waiting.requester_identity_id),
        type: "confirmation_requested",
        targetPath: `/delivery/booking/${String(waiting.request_id)}`,
        payload: { requestId: String(waiting.request_id) },
        idempotencyKey: `confirmation-reminder:${waiting.request_id}:${Number(waiting.confirmation_requested_at)}`,
      },
      now,
    );
    summary.confirmationReminders += 1;
  }

  // (3) Driver evidence expiry (OD31): approaching expiry only — an evidence
  // with a CLEAR date within 7 days gets one reminder to its driver; the
  // system never invents a date for an unclear one (OD29).
  const expiringEvidence = await db
    .prepare(
      "SELECT e.id, e.expires_at, d.identity_id FROM driver_evidence e " +
        "JOIN driver_profile d ON d.id = e.driver_profile_id " +
        "WHERE e.status = 'approved' AND e.expires_at IS NOT NULL AND e.expires_at > ? AND e.expires_at <= ?",
    )
    .bind(now, now + EVIDENCE_REMINDER_MS)
    .all<{ id: string; expires_at: number; identity_id: string }>();
  for (const evidence of expiringEvidence.results) {
    await notify(
      db,
      {
        identityId: String(evidence.identity_id),
        type: "evidence_expiry_reminder",
        targetPath: "/driver/portal",
        payload: { evidenceId: String(evidence.id) },
        idempotencyKey: `evidence-expiry:${evidence.id}:${Number(evidence.expires_at)}`,
      },
      now,
    );
    summary.evidenceReminders += 1;
  }

  return summary;
}

/** POST /api/admin/reminders/due — admin-only manual run of the same
 * idempotent processor (local emulation tests + UAT fallback when no cron
 * trigger is configured). Never transitions any product state. */
export async function runDueRemindersNow(ctx: RouteContext, auth: AuthenticatedContext): Promise<Response> {
  if (!auth.isAdmin) throw new HttpError(403, "forbidden", { reason: "admin_only" });
  const summary = await processDueReminders(ctx.env.DB, nowMs());
  return jsonResponse({ ok: true, summary });
}
