/**
 * API route table core (EX-D18): base routes (health, auth, media,
 * notifications) plus the shared auth wrapper. Feature routes are registered
 * by routes.market.ts / routes.delivery.ts; the entry (index.ts) stays a thin
 * static+API dispatcher.
 */

import {
  authenticate,
  deviceSessions,
  googleCallback,
  googleStart,
  health,
  sessionInfo,
  signOut,
  signOutAll,
} from "./api/auth.ts";
import { readMedia, removeMedia, uploadMedia } from "./api/media.ts";
import { listMyNotifications, markNotificationsRead, putAdminSetting } from "./api/system.ts";
import { createWorkspace } from "./api/workspace.ts";
import type { AuthenticatedContext } from "./auth/session.ts";
import { command } from "./commands.ts";
import { errorResponse, HttpError, jsonResponse } from "./http.ts";
import { isGlobalModuleEnabled } from "./db/db.ts";
import { ApiRouter, type RouteContext, type RouteHandler } from "./router.ts";
import { registerMarketRoutes } from "./routes.market.ts";
import {
  cancelDriverDraft,
  cancelSupplierDraft,
  removeDriverRole,
  removeSupplierRole,
} from "./api/accountRoles.ts";
import { askConsentGrant, askConsentRevoke, askQuestion, askStatus } from "./api/ask.ts";
import { deleteProject, exportProject } from "./api/projectLifecycle.ts";
import { registerDeliveryRoutes } from "./routes.delivery.ts";
import { registerManageRoutes } from "./routes.manage.ts";
import { registerManageV2Routes } from "./api/manageV2.ts";
import { registerManageV2ProductRoutes } from "./api/manageV2Products.ts";
import { registerManageV2SaleRoutes } from "./api/manageV2Sales.ts";
import { registerManageV2BoxRoutes } from "./api/manageV2Boxes.ts";
import {
  adminCancelBooking,
  adminDecisionsLog,
  adminPanelQueues,
  adminUserSearch,
  liftIdentitySuspension,
  suspendIdentity,
} from "./api/adminPanel.ts";
import { registerPushSubscription, removePushSubscription } from "./webPush.ts";

/** Resolve the session then run the handler with it (uniform auth guard). */
export function withAuth(
  ctx: RouteContext,
  handler: (auth: AuthenticatedContext) => Promise<Response>,
): Promise<Response> {
  return (async () => {
    const auth = await authenticate(ctx.env.DB, ctx.request);
    if (!auth) return errorResponse("unauthorized", 401);
    return handler(auth);
  })();
}

/** Wrap a (ctx, auth) handler into a RouteHandler via withAuth. */
export function authedRoute(
  handler: (ctx: RouteContext, auth: AuthenticatedContext) => Promise<Response>,
): RouteHandler {
  return async (ctx: RouteContext) => withAuth(ctx, auth => handler(ctx, auth));
}

/**
 * Phase F (final-review integration, F-25 completion): wrap a PARTY-FACING
 * business write of a module with the global kill-switch check. The switch
 * fails the module's business actions closed (503 module_globally_disabled)
 * while public reads, personal bookmarks, abuse reports, admin review/
 * settings/invitations, and the shared shell entry points all stay available
 * (EX-D19) — an incident stop must never remove the way to report abuse or
 * for admins to act. Thrown errors bypass idempotency storage, so wrapping
 * inside command() is safe.
 */
export function moduleGated(
  module: "market" | "delivery",
  handler: (ctx: RouteContext, auth: AuthenticatedContext) => Promise<Response>,
): RouteHandler {
  return authedRoute(async (ctx, auth) => {
    const enabled = await isGlobalModuleEnabled(ctx.env.DB, module);
    if (!enabled) {
      throw new HttpError(503, "module_globally_disabled", {
        reason: `module_${module}_disabled_globally`,
      });
    }
    return handler(ctx, auth);
  });
}

export function buildRouter(): ApiRouter {
  const router = new ApiRouter();
  router.get("api/health", ctx => health(ctx.env));
  router.get("api/auth/session", async ctx => sessionInfo(ctx.env.DB, ctx.request));
  router.get("api/auth/google/start", async ctx => googleStart(ctx.env.DB, ctx.env, ctx.url, ctx.request));
  router.get("api/auth/google/callback", async ctx =>
    googleCallback(ctx.env.DB, ctx.env, ctx.url, ctx.request),
  );
  router.post(
    "api/auth/signout",
    command("signout", async ctx => signOut(ctx.env.DB, ctx)),
  );
  // Post-Group 6 W1 (final decision أ-7 / EX-D24 — G06): the account's device
  // sessions and the server-side "sign out all devices". The list is a
  // metadata-only read; signout-all is a consequential audited command.
  router.get("api/auth/sessions", async ctx => deviceSessions(ctx.env.DB, ctx.request));
  router.post(
    "api/auth/signout-all",
    command("signout-all", async ctx => signOutAll(ctx.env.DB, ctx)),
  );
  // Post-Group 6 Wave 3 (G09 د-6 — القرار النهائي): Web Push أفضل جهد —
  // تسجيل اشتراك الجهاز وإلغاؤه فقط؛ لا مزود مهيأ ولا ضمان وصول أبدًا
  // (الإشعار داخل التطبيق والساعة الخادمية هما الأساس — worker/webPush.ts).
  router.post(
    "api/auth/push-subscriptions",
    command(
      "push-subscription-register",
      authedRoute(async (ctx, auth) => {
        const body = (await ctx.request
          .clone()
          .json()
          .catch(() => ({}))) as {
          endpoint?: unknown;
          keys?: unknown;
        };
        await registerPushSubscription(ctx.env.DB, auth.identityId, body);
        return jsonResponse({ ok: true }, 201);
      }),
    ),
  );
  router.delete(
    "api/auth/push-subscriptions",
    command(
      "push-subscription-remove",
      authedRoute(async (ctx, auth) => {
        const url = new URL(ctx.request.url);
        const endpoint = url.searchParams.get("endpoint") ?? "";
        if (!/^https:\/\/.+/.test(endpoint)) {
          return errorResponse("bad_request", 400);
        }
        await removePushSubscription(ctx.env.DB, auth.identityId, endpoint);
        return jsonResponse({ ok: true });
      }),
    ),
  );
  // Post-Group 6 W1 (final decision أ-3/أ-4 / EX-D24 — G01/AUTHZ-05): the
  // ONE explicit project-creation request (one project per owner account,
  // one owner per project — no invitations, no implicit creation anywhere).
  router.post(
    "api/workspaces",
    command(
      "workspace-create",
      authedRoute((ctx, auth) => createWorkspace(ctx, auth)),
    ),
  );
  router.post(
    "api/media",
    command("media-upload", async ctx => {
      const auth = await authenticate(ctx.env.DB, ctx.request);
      if (!auth) return errorResponse("unauthorized", 401);
      return uploadMedia(ctx, auth);
    }),
  );
  router.get("api/media/:id", async ctx => readMedia(ctx, await authenticate(ctx.env.DB, ctx.request)));
  router.delete(
    "api/media/:id",
    command("media-delete", async ctx => {
      const auth = await authenticate(ctx.env.DB, ctx.request);
      if (!auth) return errorResponse("unauthorized", 401);
      return removeMedia(ctx, auth);
    }),
  );
  router.get(
    "api/notifications",
    command("notifications-list", async ctx => {
      const auth = await authenticate(ctx.env.DB, ctx.request);
      if (!auth) return errorResponse("unauthorized", 401);
      return listMyNotifications(ctx.env.DB, auth);
    }),
  );
  router.post(
    "api/notifications/read",
    command("notifications-read", async ctx => {
      const auth = await authenticate(ctx.env.DB, ctx.request);
      if (!auth) return errorResponse("unauthorized", 401);
      return markNotificationsRead(ctx.env.DB, ctx, auth);
    }),
  );
  router.put(
    "api/admin/settings/:key",
    command("admin-setting-update", async ctx => {
      const auth = await authenticate(ctx.env.DB, ctx.request);
      if (!auth) return errorResponse("unauthorized", 401);
      return putAdminSetting(ctx.env.DB, ctx, auth);
    }),
  );
  // Ask Micro — universal permission-scoped boundary (EX-D21). The GET is a
  // context/status read; the POST is a pure question (no state change — no
  // idempotency command wrapper needed).
  router.get("api/ask/status", async ctx => askStatus(ctx.env.DB, ctx));
  router.post("api/ask", async ctx => askQuestion(ctx.env.DB, ctx));
  // Owner supplement §10.2-7-1 (2026-11-22): the per-user revocable Ask
  // consent — grant and immediate revoke, both audited atomically.
  router.post("api/ask/consent", async ctx => askConsentGrant(ctx));
  router.post("api/ask/consent/revoke", async ctx => askConsentRevoke(ctx));
  // Owner supplement §10.1-3 (2026-11-22): the project export-first deletion
  // lifecycle — the export records the owner-accessible bundle; the deletion
  // requires that export + the explicit confirmation token + no ongoing
  // booking, and never touches the completed shared counterparty records.
  router.get(
    "api/account/projects/:id/export",
    command(
      "project-export",
      authedRoute((ctx, auth) => exportProject(ctx, auth)),
    ),
  );
  router.post(
    "api/account/projects/:id/delete",
    command(
      "project-delete",
      authedRoute((ctx, auth) => deleteProject(ctx, auth)),
    ),
  );
  // Post-Group 6 continuous completion (final decision ب — دورة الدور Q5 /
  // G01): the account's OWN role lifecycle. Draft cancellation is immediate
  // (draft-only rows, never public); activated-role removal preserves every
  // record — the supplier's listings are hidden+archived, and a driver with
  // an ongoing booking is refused. Audited; never a financial/history delete.
  router.post(
    "api/account/roles/supplier/cancel-draft",
    command(
      "supplier-draft-cancel",
      authedRoute((ctx, auth) => cancelSupplierDraft(ctx, auth)),
    ),
  );
  router.post(
    "api/account/roles/driver/cancel-draft",
    command(
      "driver-draft-cancel",
      authedRoute((ctx, auth) => cancelDriverDraft(ctx, auth)),
    ),
  );
  router.post(
    "api/account/roles/supplier/remove",
    command(
      "supplier-role-remove",
      authedRoute((ctx, auth) => removeSupplierRole(ctx, auth)),
    ),
  );
  router.post(
    "api/account/roles/driver/remove",
    command(
      "driver-role-remove",
      authedRoute((ctx, auth) => removeDriverRole(ctx, auth)),
    ),
  );
  // Post-Group 6 continuous completion (G02 — Q129): the Platform Admin
  // panel — a separate unit (this API module + the /admin client unit),
  // server-protected on every route, admin-only, audited on the
  // consequential actions, with NO Manage financial access anywhere.
  router.get(
    "api/admin/panel/queues",
    authedRoute((ctx, auth) => adminPanelQueues(ctx, auth)),
  );
  router.get(
    "api/admin/panel/user-search",
    authedRoute((ctx, auth) => adminUserSearch(ctx, auth)),
  );
  router.get(
    "api/admin/panel/decisions",
    authedRoute((ctx, auth) => adminDecisionsLog(ctx, auth)),
  );
  router.post(
    "api/admin/panel/identities/:id/suspend",
    command(
      "admin-identity-suspend",
      authedRoute((ctx, auth) => suspendIdentity(ctx, auth)),
    ),
  );
  // Owner supplement §10.1-2 (2026-11-22): the audited Admin lift of an
  // identity suspension — reason + Admin identity + timestamp recorded;
  // restores access only through roles that remain active/approved.
  router.post(
    "api/admin/panel/identities/:id/lift-suspension",
    command(
      "admin-identity-lift-suspension",
      authedRoute((ctx, auth) => liftIdentitySuspension(ctx, auth)),
    ),
  );
  router.post(
    "api/admin/panel/delivery/requests/:id/admin-cancel",
    command(
      "admin-booking-cancel",
      authedRoute((ctx, auth) => adminCancelBooking(ctx, auth)),
    ),
  );
  registerMarketRoutes(router);
  registerDeliveryRoutes(router);
  registerManageRoutes(router);
  registerManageV2Routes(router);
  registerManageV2ProductRoutes(router);
  registerManageV2SaleRoutes(router);
  registerManageV2BoxRoutes(router);
  return router;
}
