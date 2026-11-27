/**
 * M3.1 (Manage v2 phase 3 — spec §14.1, R-24, R-25; owner decision D-5):
 * the SHARED route plumbing of the Manage v2 HTTP surface — extracted from
 * api/manageV2.ts when M3.1's product routes arrived, because phase 3 adds
 * its own route files (products now, the sale operations next) and the
 * one-file surface had reached its file-size ratchet band.
 *
 * Nothing here is new behaviour: every function is the exact code the M2.5+
 * routes in manageV2.ts already ran, moved verbatim so every Manage v2
 * route file shares ONE implementation (the trust boundary below, the §11 →
 * 400 mapping and the M2.4 composition).
 *
 * Trust boundary (binding for every route built on this plumbing):
 *  - The TARGET PROJECT is never taken from the request. It is the signed-in
 *    account's own project (R-24); a body `projectId` may only repeat it,
 *    and anything else is the same 404 as "no project".
 *  - Nothing persists before an operation's input is validated: the planner
 *    runs first, so §11 rejections are plain 400s with no row behind them;
 *    every row an operation needs is written by the M2.4 handler's ONE
 *    transaction (R-12).
 *  - Bodies go through the shared JSON reader (SRV-02 256 KiB cap).
 */
import postgres from "postgres";
import { ammanDateString } from "../clock.ts";
import { rawSqlOf } from "../db/db.ts";
import { HttpError, jsonResponse, requireJsonBody } from "../http.ts";
import { readJsonBody, type RouteContext } from "../router.ts";
import type { AuthenticatedContext } from "../auth/session.ts";
import { applyManageOperation, type ManageOperationOutcome } from "../application/manage/operationHandler.ts";
import { OperationRejected, type OperationPlan } from "../../../../src/domain/manage/operations/support.js";

/** Body of a Manage v2 write request: the shared reader (JSON content type,
 * SRV-02 256 KiB cap, malformed JSON → 400), then a JSON object. */
export async function readBody(request: Request): Promise<Record<string, unknown>> {
  return requireJsonBody(await readJsonBody(request));
}

/** The signed-in caller's project (R-24: one per app account). `claimed` is
 * the projectId the request body repeats, when it does: it may only EQUAL
 * the caller's own project, never choose the target. Someone else's project,
 * an unknown id and "no project yet" all answer the same 404. */
export async function requireProject(
  sql: postgres.Sql,
  auth: AuthenticatedContext,
  claimed: unknown,
): Promise<string> {
  if (claimed !== undefined && claimed !== null && typeof claimed !== "string") {
    throw new HttpError(400, "bad_request", { field: "projectId" });
  }
  const rows = await sql`SELECT id FROM project WHERE owner_account_id = ${auth.identityId}`;
  const project = rows[0] as { id: string } | undefined;
  if (
    project === undefined ||
    (typeof claimed === "string" && claimed.length > 0 && claimed !== project.id)
  ) {
    throw new HttpError(404, "not_found", { surface: "manage_v2_project" });
  }
  return project.id;
}

/** Map §11 rejections to the HTTP error envelope (400 + the code). */
export function toHttpError(error: unknown): never {
  if (error instanceof OperationRejected) {
    throw new HttpError(400, error.code.toLowerCase(), { code: error.code });
  }
  throw error;
}

/** Run a planner through the §11 → 400 mapping: its rejections are
 * synchronous throws, thrown before anything persists. */
export function planOr400<T>(make: () => T): T {
  try {
    return make();
  } catch (error) {
    toHttpError(error);
  }
}

/** Compose a validated domain plan with the M2.4 handler: the ONE
 * transaction. A refused idempotency key (same key, different body; still
 * in flight) is a 409 — never a 200 the client could mistake for a saved
 * operation. */
export async function runPlan(sql: postgres.Sql, plan: OperationPlan): Promise<ManageOperationOutcome> {
  try {
    const outcome = await applyManageOperation(sql, plan.write, {
      ...(plan.loadState !== undefined ? { loadState: plan.loadState } : {}),
      ...(plan.extraWrites !== undefined ? { extraWrites: plan.extraWrites } : {}),
      ...(plan.resultData !== undefined ? { resultData: plan.resultData } : {}),
      ...(plan.revisionEntries !== undefined ? { revisionEntries: plan.revisionEntries } : {}),
      ...(plan.companion !== undefined ? { companion: plan.companion } : {}),
    });
    if (outcome.outcome === "conflict") {
      throw new HttpError(409, "conflict", { code: outcome.reason });
    }
    return outcome;
  } catch (error) {
    toHttpError(error);
  }
}

/** The opening of every project-scoped write route: the request-scoped
 * client, the JSON body, and the caller's OWN project (R-24 — the body may
 * only repeat it) with Amman today for the planner. */
export async function projectWrite(ctx: RouteContext, auth: AuthenticatedContext) {
  const sql = rawSqlOf(ctx.env);
  const body = await readBody(ctx.request);
  return {
    sql,
    projectId: await requireProject(sql, auth, body.projectId),
    body,
    createdByAccountId: auth.identityId,
    today: ammanDateString(Date.now()),
  };
}

/** A read route's project: the request-scoped client plus the caller's own
 * project (R-24), with the optional query-param repeat of the id. */
export async function projectRead(ctx: RouteContext, auth: AuthenticatedContext) {
  const sql = rawSqlOf(ctx.env);
  const claimed = new URL(ctx.request.url).searchParams.get("projectId");
  return {
    sql,
    projectId: await requireProject(sql, auth, claimed === null ? undefined : claimed),
  };
}

export { jsonResponse };
