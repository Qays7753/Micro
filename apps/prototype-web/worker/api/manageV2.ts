/**
 * M2.5 (Manage v2 phase 2, wave G): HTTP surface for the three opening
 * operations — OP-SETUP / OP-ADD-BOX / OP-ADD-PRIOR-BALANCE — over the new
 * §3 tables. One route file for the whole Manage v2 write surface
 * (`/api/manage-v2/*`), extended task by task (M2.6+ add their operations
 * here); the M2.4 handler owns the transaction and the atomic idempotency.
 *
 * Shape (§14.1 + the M1.6 boundary): the route ONLY adapts HTTP —
 * authenticate, resolve the caller's project (R-24: one project per app
 * account), read Amman today from the clock, run the DOMAIN PLANNER (pure,
 * `src/domain/manage/operations`), and compose its plan with the M2.4
 * handler inside the single transaction. The composition lives HERE
 * (worker side) because the domain must not import worker code. §11
 * rejections map to the error envelope; no Arabic strings (the client maps
 * error codes to catalog text).
 */
import postgres from "postgres";
import { ammanDateString } from "../clock.ts";
import { rawSqlOf } from "../db/db.ts";
import { HttpError, jsonResponse } from "../http.ts";
import { authedRoute } from "../routes.ts";
import type { ApiRouter } from "../router.ts";
import type { AuthenticatedContext } from "../auth/session.ts";
import { applyManageOperation, type ManageOperationOutcome } from "../application/manage/operationHandler.ts";
import { planSetup } from "../../../../src/domain/manage/operations/setup.js";
import { planAddBox } from "../../../../src/domain/manage/operations/addBox.js";
import { planAddPriorBalance } from "../../../../src/domain/manage/operations/addPriorBalance.js";
import { OperationRejected, type OperationPlan } from "../../../../src/domain/manage/operations/support.js";

/** Resolve the signed-in caller's project (R-24: one per app account);
 * 404 when none exists yet. */
async function requireProject(sql: postgres.Sql, auth: AuthenticatedContext): Promise<string> {
  const rows = await sql`SELECT id FROM project WHERE owner_account_id = ${auth.identityId}`;
  const project = rows[0] as { id: string } | undefined;
  if (project === undefined) {
    throw new HttpError(404, "not_found", { surface: "manage_v2_project" });
  }
  return project.id;
}

/** Body of a Manage v2 write request (JSON object). */
async function readBody(request: Request): Promise<Record<string, unknown>> {
  const body = (await request.json()) as unknown;
  if (body === null || typeof body !== "object" || Array.isArray(body)) {
    throw new HttpError(400, "bad_request", { field: "body" });
  }
  return body as Record<string, unknown>;
}

/** Map §11 rejections to the HTTP error envelope (400 + the code). */
function toHttpError(error: unknown): never {
  if (error instanceof OperationRejected) {
    throw new HttpError(400, error.code.toLowerCase(), { code: error.code });
  }
  throw error;
}

/** Compose a domain plan with the M2.4 handler: the ONE transaction. */
async function runPlan(sql: postgres.Sql, plan: OperationPlan): Promise<ManageOperationOutcome> {
  try {
    return await applyManageOperation(sql, plan.write, {
      ...(plan.loadState !== undefined ? { loadState: plan.loadState } : {}),
      ...(plan.extraWrites !== undefined ? { extraWrites: plan.extraWrites } : {}),
    });
  } catch (error) {
    toHttpError(error);
  }
}

export function registerManageV2Routes(router: ApiRouter): void {
  router.post(
    "api/manage-v2/setup",
    authedRoute(async (ctx, auth) => {
      const sql = rawSqlOf(ctx.env);
      const body = await readBody(ctx.request);
      // The project row is infrastructure OP-SETUP brings into being (R-24:
      // one project per app account). It is created BEFORE the operation's
      // transaction because the idempotency reservation (M2.4) carries an FK
      // to it; an existing project → the honest 409. The box rows, Q1
      // entries and the operation itself stay atomic in the transaction.
      const existing = await sql`SELECT id FROM project WHERE owner_account_id = ${auth.identityId}`;
      if (existing.length > 0) {
        throw new HttpError(409, "conflict", { surface: "manage_v2_project_exists" });
      }
      const projectId = crypto.randomUUID();
      await sql`INSERT INTO project (id, name, owner_account_id, created_at)
                VALUES (${projectId}, ${typeof body.projectName === "string" ? body.projectName : ""},
                        ${auth.identityId}, now())
                ON CONFLICT (owner_account_id) DO NOTHING`;
      const outcome = await runPlan(
        sql,
        planSetup({
          projectId,
          createdByAccountId: auth.identityId,
          requestId: body.requestId,
          today: ammanDateString(Date.now()),
          projectName: body.projectName,
          boxes: body.boxes,
        }),
      );
      // The client needs the project id its account now owns (subsequent
      // operations address it) — carried on the setup response, not
      // re-queried by the client from any list.
      return jsonResponse({ ...outcome, projectId });
    }),
  );

  router.post(
    "api/manage-v2/add-box",
    authedRoute(async (ctx, auth) => {
      const sql = rawSqlOf(ctx.env);
      const body = await readBody(ctx.request);
      const explicitProjectId = typeof body.projectId === "string" ? body.projectId : "";
      const projectId = explicitProjectId.length > 0 ? explicitProjectId : await requireProject(sql, auth);
      return jsonResponse(
        await runPlan(
          sql,
          planAddBox({
            projectId,
            createdByAccountId: auth.identityId,
            requestId: body.requestId,
            today: ammanDateString(Date.now()),
            kind: body.kind,
            opening: body.opening,
          }),
        ),
      );
    }),
  );

  router.post(
    "api/manage-v2/add-prior-balance",
    authedRoute(async (ctx, auth) => {
      const sql = rawSqlOf(ctx.env);
      const body = await readBody(ctx.request);
      const explicitProjectId = typeof body.projectId === "string" ? body.projectId : "";
      const projectId = explicitProjectId.length > 0 ? explicitProjectId : await requireProject(sql, auth);
      return jsonResponse(
        await runPlan(
          sql,
          planAddPriorBalance({
            projectId,
            createdByAccountId: auth.identityId,
            requestId: body.requestId,
            today: ammanDateString(Date.now()),
            direction: body.direction,
            counterpartyName: body.counterpartyName,
            amountFils: body.amountFils,
            originOn: body.originOn,
          }),
        ),
      );
    }),
  );
}
