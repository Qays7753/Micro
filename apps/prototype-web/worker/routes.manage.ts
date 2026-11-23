/**
 * Manage Online route registration (EX-D23 — contract 18 §10, waves M2+M3).
 * The state read is honest-by-design (configured / capability / link per
 * workspace); the link commands are idempotent commands; the record reads
 * are owner-scoped behind requireManageOwner with denied-read auditing, and
 * record writes (M4) are transactional idempotent CAS upserts, and the
 * migration path (M5) is the synthetic-fixture export→PostgreSQL apply/
 * status/rollback family.
 */
import { linkConfirm, linkStart, manageState, unlinkManage } from "./api/manage.ts";
import { getRecord, listFamilies, listFamilyRecords, manageMode } from "./api/manageReads.ts";
import { saveManageRecord } from "./api/manageWrites.ts";
import {
  applyMigration,
  migrationStatus,
  rollbackMigration,
  MIGRATION_APPLY_BODY_MAX_BYTES,
} from "./api/manageMigration.ts";
import { command } from "./commands.ts";
import { authedRoute } from "./routes.ts";
import type { ApiRouter } from "./router.ts";

/* Post-Group 6 W1 (EX-D24 / AUTHZ-05): every manage surface accepts the
 * caller's explicit active context (workspaceId — query param on reads,
 * body field on writes) and verifies it server-side; when absent the
 * resolution relies on migration 0007's structural one-owner-workspace
 * guarantee. The connected client always sends its context. */

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
    "api/manage/mode",
    authedRoute((ctx, auth) => manageMode(ctx.env.DB, auth, ctx.request)),
  );
  router.get(
    "api/manage/families",
    authedRoute((ctx, auth) => listFamilies(ctx.env.DB, auth, ctx.request)),
  );
  router.get(
    "api/manage/records/:family",
    authedRoute((ctx, auth) => listFamilyRecords(ctx, auth)),
  );
  router.get(
    "api/manage/records/:family/:id",
    authedRoute((ctx, auth) => getRecord(ctx, auth)),
  );
  router.put(
    "api/manage/records/:family/:id",
    command(
      "manage-record-save",
      authedRoute((ctx, auth) => saveManageRecord(ctx, auth)),
    ),
  );
  router.get(
    "api/manage/migrate/status",
    authedRoute((ctx, auth) => migrationStatus(ctx.env.DB, auth, ctx.request)),
  );
  router.post(
    "api/manage/migrate/apply",
    command(
      "manage-migrate-apply",
      authedRoute((ctx, auth) => applyMigration(ctx, auth)),
      /* SRV-02 (2026-11-23): the migration envelope is the ONE command body
       * that legitimately exceeds the canonical JSON cap — the route
       * registers its own documented byte ceiling (derived from the
       * post-parse DATA_TEXT_MAX gate) instead of being buffered unbounded. */
      { maxBodyBytes: MIGRATION_APPLY_BODY_MAX_BYTES },
    ),
  );
  router.post(
    "api/manage/migrate/rollback",
    command(
      "manage-migrate-rollback",
      authedRoute((ctx, auth) => rollbackMigration(ctx, auth)),
    ),
  );
}
