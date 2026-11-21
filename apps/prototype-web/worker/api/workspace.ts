/**
 * Explicit personal project creation (Post-Group 6 W1 — owner final decision
 * أ-3/أ-4 2026-11-21 / EX-D24 / AUTHZ-05 / G01): registration creates no role
 * and no project; the project is created by ONE explicit request — one
 * project per owner account, one owner per project, no team, no invitations.
 * The pre-W1 auto-creation on first business action was removed with the
 * implicit first-workspace selection it served.
 */

import { createPersonalWorkspace } from "../authorization.ts";
import { audit } from "../audit.ts";
import { nowMs } from "../clock.ts";
import { randomToken } from "../crypto.ts";
import type { Db } from "../db/db.ts";
import { HttpError, jsonResponse } from "../http.ts";
import { readJsonBody, type RouteContext } from "../router.ts";
import type { AuthenticatedContext } from "../auth/session.ts";

const DISPLAY_NAME_MIN = 2;
const DISPLAY_NAME_MAX = 80;

function db(ctx: RouteContext): Db {
  return ctx.env.DB;
}

/**
 * POST /api/workspaces — create the caller's single project explicitly.
 * Refuses: guests (401 by the route wrapper), the admin account (403 — the
 * administration account holds no business roles), and a second project for
 * an account that already owns one (409 one_project_per_account — enforced
 * in the application AND structurally by migration 0007's partial unique
 * index, so even a race cannot produce two projects).
 */
export async function createWorkspace(ctx: RouteContext, auth: AuthenticatedContext): Promise<Response> {
  const body = (await readJsonBody(ctx.request)) as Record<string, unknown>;
  const rawName = body.displayName;
  if (typeof rawName !== "string") {
    throw new HttpError(400, "bad_request", { field: "displayName" });
  }
  const displayName = rawName.trim();
  if (displayName.length < DISPLAY_NAME_MIN || displayName.length > DISPLAY_NAME_MAX) {
    throw new HttpError(400, "bad_request", { field: "displayName" });
  }
  const now = nowMs();
  const workspace = await createPersonalWorkspace(db(ctx), auth.identityId, displayName, now, randomToken);
  await audit(
    db(ctx),
    {
      actorIdentityId: auth.identityId,
      action: "workspace_created",
      objectType: "workspace",
      objectId: workspace.workspaceId,
      result: "success",
      meta: { explicitCreation: true },
    },
    now,
  );
  return jsonResponse(
    {
      workspace: {
        id: workspace.workspaceId,
        displayName: workspace.displayName,
        role: workspace.role,
        capabilities: { market: workspace.marketEnabled, delivery: workspace.deliveryEnabled },
      },
    },
    201,
  );
}
