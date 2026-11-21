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
import { askQuestion, askStatus } from "./api/ask.ts";
import { registerDeliveryRoutes } from "./routes.delivery.ts";
import { registerManageRoutes } from "./routes.manage.ts";
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
  registerMarketRoutes(router);
  registerDeliveryRoutes(router);
  registerManageRoutes(router);
  return router;
}
