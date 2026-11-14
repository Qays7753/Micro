/**
 * Manage Online route registration (EX-D23 — contract 18 §10, waves M2+M3).
 * The state read is honest-by-design (configured / capability / link per
 * workspace); the link commands are idempotent commands; the record reads
 * are owner-scoped behind requireManageOwner with denied-read auditing.
 * Business writes (M4) and the migration path (M5) register later.
 */
import { linkConfirm, linkStart, manageState, unlinkManage } from "./api/manage.ts";
import { getRecord, listFamilies, listFamilyRecords } from "./api/manageReads.ts";
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
  router.get(
    "api/manage/families",
    authedRoute((ctx, auth) => listFamilies(ctx.env.DB, auth)),
  );
  router.get(
    "api/manage/records/:family",
    authedRoute((ctx, auth) => listFamilyRecords(ctx, auth)),
  );
  router.get(
    "api/manage/records/:family/:id",
    authedRoute((ctx, auth) => getRecord(ctx, auth)),
  );
}
