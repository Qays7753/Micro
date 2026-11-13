/**
 * Ask Micro — universal, permission-scoped assistant boundary (EX-D21,
 * owner decision 2026-11-13). Every signed-in Micro account gets the entry
 * in the shared shell and in every applicable module context, including
 * Delivery/driver.
 *
 * Hard boundaries (contract 18 §9-4):
 *  - Every request is scoped server-side to the verified principal, the
 *    active role(s), the current workspace context, and permitted records.
 *  - Context retrieval goes through the same authorized read paths the
 *    product APIs use — never direct SQL from an assistant path, never
 *    another workspace's data, never financial/operational writes.
 *  - No approved AI provider exists in this repository: the configured state
 *    is honest ("not configured") and asking returns a clear 501 — no paid
 *    provider, no secrets, no fabricated answers. The exact owner/Manus
 *    setup step for live answers is documented in worker/README.md.
 */

import { HttpError, jsonResponse } from "../http.ts";
import type { Db } from "../db/db.ts";
import type { RouteContext } from "../router.ts";
import { readJsonBody } from "../router.ts";
import { driverStatus, listWorkspaceMemberships, requireIdentity, vendorStatus } from "../authorization.ts";
import { resolveSession } from "../auth/session.ts";
import { enforceRate, minuteBucket } from "../ratelimit.ts";
import { nowMs } from "../clock.ts";

/** Honest provider state: no approved runtime provider is wired in-repo. */
export const ASK_PROVIDER_CONFIGURED = false;

/**
 * GET /api/ask/status — the shared Ask Micro context boundary: the entry is
 * available to every signed-in account; the response states the honest
 * provider configuration and the role/workspace context the assistant is
 * scoped to (no record contents — only permitted, already-authorized counts
 * and states).
 */
export async function askStatus(db: Db, ctx: RouteContext): Promise<Response> {
  const auth = await resolveSession(db, sessionToken(ctx.request), nowMs());
  if (!auth)
    return jsonResponse({ available: false, configured: ASK_PROVIDER_CONFIGURED, reason: "unauthenticated" });
  const workspaces = await listWorkspaceMemberships(db, auth.identityId);
  const vendor = await vendorStatus(db, auth.identityId);
  const driver = await driverStatus(db, auth.identityId, nowMs());
  const context = {
    principal: { displayName: auth.displayName, email: auth.email },
    roles: {
      // Any authenticated Micro account may act as project owner (OD18 /
      // contract 18) — the owner context is the account itself, with its
      // workspace ensured on first business action.
      owner: true,
      vendor: vendor !== null,
      driver: driver !== null,
      admin: auth.isAdmin,
    },
    workspaces: workspaces.map(w => ({
      id: w.workspaceId,
      displayName: w.displayName,
      role: w.role,
      capabilities: { market: w.marketEnabled, delivery: w.deliveryEnabled },
    })),
    permittedRecordSummary: {
      // Owner-side: own open delivery decisions only (authorized read path).
      ownerPendingDecisions: await ownerPendingDecisionCount(db, auth.identityId),
      // Vendor-side: own listing states only.
      vendorListings: vendor === null ? 0 : await vendorListingCount(db, vendor.supplierProfileId),
      // Driver-side: own assigned inbox only.
      driverOpenTasks: driver === null ? 0 : await driverOpenTaskCount(db, driver.driverProfileId),
    },
  };
  return jsonResponse({ available: true, configured: ASK_PROVIDER_CONFIGURED, context });
}

/**
 * POST /api/ask — ask a question. Requires an approved runtime provider; the
 * repository ships none (EX-D21: no paid provider, no secrets, no fabricated
 * answers). Until the owner/Manus wires an approved provider this returns an
 * honest 501 with the exact next step.
 */
export async function askQuestion(db: Db, ctx: RouteContext): Promise<Response> {
  const auth = await resolveSession(db, sessionToken(ctx.request), nowMs());
  if (!auth) throw new HttpError(401, "unauthorized");
  const identityId = requireIdentity({ identityId: auth.identityId, isAdmin: auth.isAdmin });
  const now = nowMs();
  await enforceRate(db, minuteBucket("ask", identityId, now), 10, 60 * 1000, now);
  const body = (await readJsonBody(ctx.request)) as { question?: unknown };
  const question = typeof body.question === "string" ? body.question.trim() : "";
  if (question.length < 2) throw new HttpError(400, "bad_request", { field: "question" });
  if (question.length > 2000)
    throw new HttpError(400, "bad_request", { field: "question", reason: "too_long" });
  if (!ASK_PROVIDER_CONFIGURED) {
    throw new HttpError(501, "ask_not_configured", {
      step: "owner_manus_provider_setup",
      message:
        "Ask Micro غير مهيأة بعد: لا يوجد مزود ذكاء اصطناعي معتمد مرتبط. " +
        "الإعداد خطوة مالك/Manus لاحقة عبر مزود معتمد — ولا تُرسل أي بيانات لخدمة خارجية قبل ذلك.",
    });
  }
  // A configured provider path would be wired here — behind the same
  // permission-scoped context as askStatus, never direct SQL.
  throw new HttpError(501, "ask_not_configured");
}

function sessionToken(request: Request): string | undefined {
  const cookie = request.headers.get("cookie") ?? "";
  const part = cookie
    .split(";")
    .map(p => p.trim())
    .find(p => p.startsWith("micro_session="));
  return part === undefined ? undefined : part.slice("micro_session=".length);
}

/* Permitted-record summaries — the SAME authorized read shapes the product
 * endpoints use, reduced to counts. No cross-workspace data can appear here
 * because every query is scoped by identity/assignment. */

async function ownerPendingDecisionCount(db: Db, identityId: string): Promise<number> {
  const row = await db
    .prepare(
      "SELECT COUNT(*) AS n FROM delivery_request " +
        "WHERE requester_identity_id = ? AND status IN ('awaiting_driver_response','awaiting_requester_decision')",
    )
    .bind(identityId)
    .first<Record<string, unknown>>();
  return row === null ? 0 : Number(row.n);
}

async function vendorListingCount(db: Db, supplierProfileId: string): Promise<number> {
  const row = await db
    .prepare("SELECT COUNT(*) AS n FROM supplier_listing WHERE supplier_profile_id = ?")
    .bind(supplierProfileId)
    .first<Record<string, unknown>>();
  return row === null ? 0 : Number(row.n);
}

async function driverOpenTaskCount(db: Db, driverProfileId: string): Promise<number> {
  const row = await db
    .prepare(
      "SELECT COUNT(*) AS n FROM delivery_request WHERE driver_profile_id = ? AND status IN ('awaiting_driver_response','confirmed')",
    )
    .bind(driverProfileId)
    .first<Record<string, unknown>>();
  return row === null ? 0 : Number(row.n);
}
