/**
 * Manage v2 phase 2, wave G+: HTTP surface for the §5 operations over the
 * new §3 tables — OP-SETUP / OP-ADD-BOX / OP-ADD-PRIOR-BALANCE (M2.5),
 * OP-EXPENSE (M2.6); M2.7+ add their operations here. One route file for
 * the whole Manage v2 write surface (`/api/manage-v2/*`); the M2.4 handler
 * owns the transaction and the atomic idempotency.
 *
 * Shape (§14.1 + the M1.6 boundary): the route ONLY adapts HTTP —
 * authenticate, resolve the caller's project (R-24: one project per app
 * account), read Amman today from the clock, run the DOMAIN PLANNER (pure,
 * `src/domain/manage/operations`), and compose its plan with the M2.4
 * handler inside the single transaction. The composition lives HERE
 * (worker side) because the domain must not import worker code. §11
 * rejections map to the error envelope; no Arabic strings (the client maps
 * error codes to catalog text).
 *
 * Trust boundary (binding for every route in this file):
 *  - The TARGET PROJECT is never taken from the request. It is the signed-in
 *    account's own project (R-24); a body `projectId` may only repeat it,
 *    and anything else is the same 404 as "no project" — the surface never
 *    confirms that another project exists.
 *  - Nothing persists before the operation's input is validated: the planner
 *    runs first, so its rejections are plain 400s with no row behind them;
 *    every row the operation needs is written by the handler's ONE
 *    transaction (R-12).
 *  - Bodies go through the shared JSON reader (SRV-02 256 KiB cap).
 */
import postgres from "postgres";
import { ammanDateString } from "../clock.ts";
import { rawSqlOf } from "../db/db.ts";
import { HttpError, jsonResponse, requireJsonBody } from "../http.ts";
import { authedRoute } from "../routes.ts";
import { readJsonBody, type ApiRouter, type RouteContext } from "../router.ts";
import type { AuthenticatedContext } from "../auth/session.ts";
import { applyManageOperation, type ManageOperationOutcome } from "../application/manage/operationHandler.ts";
import { planSetup } from "../../../../src/domain/manage/operations/setup.js";
import { planAddBox } from "../../../../src/domain/manage/operations/addBox.js";
import { planAddPriorBalance } from "../../../../src/domain/manage/operations/addPriorBalance.js";
import { planExpense } from "../../../../src/domain/manage/operations/expense.js";
import { OperationRejected, type OperationPlan } from "../../../../src/domain/manage/operations/support.js";

/** Body of a Manage v2 write request: the shared reader (JSON content type,
 * SRV-02 256 KiB cap, malformed JSON → 400), then a JSON object. */
async function readBody(request: Request): Promise<Record<string, unknown>> {
  return requireJsonBody(await readJsonBody(request));
}

/** The signed-in caller's project (R-24: one per app account). `claimed` is
 * the projectId the request body repeats, when it does: it may only EQUAL
 * the caller's own project, never choose the target. Someone else's project,
 * an unknown id and "no project yet" all answer the same 404. */
async function requireProject(
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
function toHttpError(error: unknown): never {
  if (error instanceof OperationRejected) {
    throw new HttpError(400, error.code.toLowerCase(), { code: error.code });
  }
  throw error;
}

/** Run a planner through the §11 → 400 mapping: its rejections are
 * synchronous throws, thrown before anything persists. */
function planOr400<T>(make: () => T): T {
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
async function runPlan(sql: postgres.Sql, plan: OperationPlan): Promise<ManageOperationOutcome> {
  try {
    const outcome = await applyManageOperation(sql, plan.write, {
      ...(plan.loadState !== undefined ? { loadState: plan.loadState } : {}),
      ...(plan.extraWrites !== undefined ? { extraWrites: plan.extraWrites } : {}),
      ...(plan.resultData !== undefined ? { resultData: plan.resultData } : {}),
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
async function projectWrite(ctx: RouteContext, auth: AuthenticatedContext) {
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

export function registerManageV2Routes(router: ApiRouter): void {
  router.post(
    "api/manage-v2/setup",
    authedRoute(async (ctx, auth) => {
      const sql = rawSqlOf(ctx.env);
      const body = await readBody(ctx.request);
      const today = ammanDateString(Date.now());
      const buildPlan = (projectId: string): OperationPlan =>
        planSetup({
          projectId,
          createdByAccountId: auth.identityId,
          requestId: body.requestId,
          today,
          projectName: body.projectName,
          boxes: body.boxes,
        });

      // OP-SETUP brings the project into being (R-24: one project per app
      // account). The order is the guarantee that an invalid first setup
      // strands nobody — nothing persists before the input has validated:
      //   1. the plan validates (a §11 rejection is a plain 400, no row);
      //   2. the project row is created. The account's existing project is
      //      reused, so a retried request replays (T55) and a project left
      //      without boxes by an aborted first setup is completed; the row
      //      must exist before the transaction because the handler's
      //      idempotency reservation references it;
      //   3. the handler writes the operation, the boxes and the Q1 entries.
      const own = await sql`SELECT id FROM project WHERE owner_account_id = ${auth.identityId}`;
      let projectId = own.length > 0 ? String((own[0] as { id: string }).id) : crypto.randomUUID();
      let plan = planOr400(() => buildPlan(projectId));
      if (own.length === 0) {
        const projectName = (plan.write.payload as { projectName: string }).projectName;
        const inserted = await sql`INSERT INTO project (id, name, owner_account_id, created_at)
                                  VALUES (${projectId}, ${projectName}, ${auth.identityId}, now())
                                  ON CONFLICT (owner_account_id) DO NOTHING
                                  RETURNING id`;
        if (inserted.length === 0) {
          // A concurrent first setup for this account won the slot: go on
          // with ITS project (a duplicate request then replays or hits the
          // R-9 live check inside the transaction).
          const winner = await sql`SELECT id FROM project WHERE owner_account_id = ${auth.identityId}`;
          projectId = String((winner[0] as { id: string }).id);
          plan = buildPlan(projectId);
        }
      }
      const outcome = await runPlan(sql, plan);
      // The client needs the project id its account now owns (subsequent
      // operations address it) — carried on the setup response, not
      // re-queried by the client from any list.
      return jsonResponse({ ...outcome, projectId });
    }),
  );

  router.post(
    "api/manage-v2/add-box",
    authedRoute(async (ctx, auth) => {
      const { sql, projectId, body, createdByAccountId, today } = await projectWrite(ctx, auth);
      const plan = planOr400(() =>
        planAddBox({
          projectId,
          createdByAccountId,
          requestId: body.requestId,
          today,
          kind: body.kind,
          opening: body.opening,
        }),
      );
      return jsonResponse(await runPlan(sql, plan));
    }),
  );

  router.post(
    "api/manage-v2/add-prior-balance",
    authedRoute(async (ctx, auth) => {
      const { sql, projectId, body, createdByAccountId, today } = await projectWrite(ctx, auth);
      const plan = planOr400(() =>
        planAddPriorBalance({
          projectId,
          createdByAccountId,
          requestId: body.requestId,
          today,
          direction: body.direction,
          counterpartyName: body.counterpartyName,
          amountFils: body.amountFils,
          originOn: body.originOn,
        }),
      );
      return jsonResponse(await runPlan(sql, plan));
    }),
  );

  // M2.6 — OP-EXPENSE (§5). The planner needs live state (the box the
  // payment leaves): it is resolved inside the handler's transaction; a box
  // that is not active answers E-BOX-STATE here like any §11 rejection.
  router.post(
    "api/manage-v2/expense",
    authedRoute(async (ctx, auth) => {
      const { sql, projectId, body, createdByAccountId, today } = await projectWrite(ctx, auth);
      const plan = planOr400(() =>
        planExpense({
          projectId,
          createdByAccountId,
          requestId: body.requestId,
          today,
          amountFils: body.amountFils,
          deliveryCostFils: body.deliveryCostFils,
          category: body.category,
          payment: body.payment,
          source: body.source,
          supplierName: body.supplierName,
          effectiveOn: body.effectiveOn,
          note: body.note,
        }),
      );
      return jsonResponse(await runPlan(sql, plan));
    }),
  );
}
