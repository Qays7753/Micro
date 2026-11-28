/**
 * M5.2 (Manage v2 phase 5 — UX P-10/P-11 + R-17): مسارات حالة المشروع —
 * قراءة (الاسم + الانقطاع المفتوح بأيامه لبطاقة العودة) وتعديل الاسم
 * (تحديث مباشر بلا عملية — نمط sale-fields/products). كلاهما خلف
 * requireProject (R-24: مشروع المتصل وحده).
 */
import { HttpError } from "../http.ts";
import { authedRoute } from "../routes.ts";
import type { ApiRouter } from "../router.ts";
import { ammanDateString } from "../clock.ts";
import { rawSqlOf } from "../db/db.ts";
import { ProjectNotFound, readProjectState, renameProject } from "../application/manage/projectState.js";
import { readSaleRows } from "../application/manage/saleRows.js";
import { readRecentActivity } from "../application/manage/activityRows.js";
import { readActivityLog } from "../application/manage/activityLog.js";
import {
  LineNotFound,
  OperationNotFound,
  readBalanceLineDetails,
  readOperationDetails,
} from "../application/manage/operationDetails.js";
import { SaleDetailsNotFound, readSaleDetails } from "../application/manage/saleDetails.js";
import { projectRead, projectWrite } from "./manageV2Shared.ts";
import { jsonResponse } from "../http.ts";

export function registerManageV2ProjectRoutes(router: ApiRouter): void {
  // P-10/P-11: the project state — name + the open absence (the return card).
  // Read-only: the figures route's posture (no body, no idempotency).
  router.get(
    "api/manage-v2/project",
    authedRoute(async (ctx, auth) => {
      const { sql, projectId } = await projectRead(ctx, auth);
      const state = await readProjectState(sql, projectId, ammanDateString(Date.now()));
      return jsonResponse(state);
    }),
  );

  // M5.2 — the C-09 sale rows (P-10's lists and P-12's cards): every
  // figure from the ONE read module + the first-line display description.
  // Read-only: the figures route's posture.
  router.get(
    "api/manage-v2/sale-rows",
    authedRoute(async (ctx, auth) => {
      const { sql, projectId } = await projectRead(ctx, auth);
      const rows = await readSaleRows(sql, projectId, ammanDateString(Date.now()));
      return jsonResponse({ sales: rows });
    }),
  );

  // M5.4 — P-30 §10: the latest five movements (C-10 rows). Read-only.
  router.get(
    "api/manage-v2/recent-activity",
    authedRoute(async (ctx, auth) => {
      const { sql, projectId } = await projectRead(ctx, auth);
      const rows = await readRecentActivity(sql, projectId, ammanDateString(Date.now()));
      return jsonResponse({ activity: rows });
    }),
  );

  // M5.6 — P-41 the full activity log (§10/ج-1/R-28): search + type group +
  // period filters applied server-side; compound rows carry their members.
  // Read-only.
  router.get(
    "api/manage-v2/activity",
    authedRoute(async (ctx, auth) => {
      const { sql, projectId } = await projectRead(ctx, auth);
      const url = new URL(ctx.request.url);
      const typeParam = url.searchParams.get("type");
      const periodParam = url.searchParams.get("period");
      const log = await readActivityLog(sql, projectId, ammanDateString(Date.now()), {
        search: url.searchParams.get("search") ?? undefined,
        type: (
          [
            "all",
            "rep.opening",
            "op.sale",
            "op.collect",
            "op.pay",
            "op.expense",
            "op.deposit",
            "op.withdraw",
            "op.transfer",
            "op.reconcile",
          ] as const
        ).includes(typeParam as never)
          ? (typeParam as never)
          : undefined,
        period: (["week", "month", "year", "since_start"] as const).includes(periodParam as never)
          ? (periodParam as never)
          : undefined,
      });
      return jsonResponse(log);
    }),
  );

  // M5.6 — P-42/P-43 one operation's details + its previous versions.
  // Read-only; the unified 404 for a foreign/unknown id (R-24).
  router.get(
    "api/manage-v2/activity/:id",
    authedRoute(async (ctx, auth) => {
      const { sql, projectId } = await projectRead(ctx, auth);
      try {
        return jsonResponse(
          await readOperationDetails(sql, projectId, ctx.params.id!, ammanDateString(Date.now())),
        );
      } catch (error) {
        if (error instanceof OperationNotFound) return new Response("Not Found", { status: 404 });
        throw error;
      }
    }),
  );

  // M5.6 — P-45 one balance line + its movements (C-10 rows). Read-only.
  router.get(
    "api/manage-v2/line/:id",
    authedRoute(async (ctx, auth) => {
      const { sql, projectId } = await projectRead(ctx, auth);
      try {
        return jsonResponse(
          await readBalanceLineDetails(sql, projectId, ctx.params.id!, ammanDateString(Date.now())),
        );
      } catch (error) {
        if (error instanceof LineNotFound) return new Response("Not Found", { status: 404 });
        throw error;
      }
    }),
  );

  // M5.3 — P-21 sale details: the ONE read module's figures + the display
  // fields (lines, delivery costs, the linked operation history). Read-only.
  router.get(
    "api/manage-v2/sale/:id",
    authedRoute(async (ctx, auth) => {
      const { sql, projectId } = await projectRead(ctx, auth);
      try {
        const details = await readSaleDetails(sql, projectId, ctx.params.id!, ammanDateString(Date.now()));
        return jsonResponse(details);
      } catch (error) {
        if (error instanceof SaleDetailsNotFound) {
          throw new HttpError(404, "not_found", { surface: "manage_v2_sale" });
        }
        throw error;
      }
    }),
  );

  // P-11: rename (R-17 — no operation, no ledger row; idempotent by
  // construction: the same name rewrites the same row).
  router.post(
    "api/manage-v2/project-name",
    authedRoute(async (ctx, auth) => {
      const { sql, projectId, body } = await projectWrite(ctx, auth);
      if (typeof body.name !== "string" || body.name.trim().length === 0) {
        throw new HttpError(400, "e-name-required", { code: "E-NAME-REQUIRED" });
      }
      try {
        const renamed = await renameProject(sql, { projectId, name: body.name.trim() });
        return jsonResponse(renamed);
      } catch (error) {
        if (error instanceof ProjectNotFound) {
          throw new HttpError(404, "not_found", { surface: "manage_v2_project" });
        }
        throw error;
      }
    }),
  );
}
