/**
 * Manage Online route registration (EX-D23 — contract 18 §10, wave M2).
 * The state read is honest-by-design (configured / capability / link per
 * workspace); the link commands are idempotent commands. Business data
 * routes (reads/writes/migration) arrive in M3–M5 behind requireManageOwner.
 */
import { linkConfirm, linkStart, manageState, unlinkManage } from "./api/manage.ts";
import { command } from "./commands.ts";
import { authedRoute } from "./routes.ts";
import type { ApiRouter } from "./router.ts";

export function registerManageRoutes(router: ApiRouter): void {
  router.get(
    "api/manage/state",
    authedRoute((ctx, auth) => manageState(ctx.env.DB, auth)),
  );
  router.post(
    "api/manage/link/start",
    command(
      "manage-link-start",
      authedRoute((ctx, auth) => linkStart(ctx.env.DB, ctx, auth)),
    ),
  );
  router.post(
    "api/manage/link/confirm",
    command(
      "manage-link-confirm",
      authedRoute((ctx, auth) => linkConfirm(ctx.env.DB, ctx, auth)),
    ),
  );
  router.delete(
    "api/manage/link",
    command(
      "manage-link-delete",
      authedRoute((ctx, auth) => unlinkManage(ctx.env.DB, ctx, auth)),
    ),
  );
}
