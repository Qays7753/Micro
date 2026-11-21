/**
 * Web Push dispatch (G09 — القرار النهائي د-6): BEST-EFFORT delivery only —
 * a push attempt is NEVER a delivery guarantee, and the product copy says so.
 *
 * The provider is explicitly NOT configured: `PUSH_VAPID_PRIVATE_KEY` is
 * absent from every environment (worker/env.ts), no provider is selected,
 * and no network call is ever made from this module today. The honest state
 * mirrors Ask Micro's not-configured pattern: subscriptions ARE stored (the
 * client capability is real), attempts are answered
 * `skipped_not_configured`, and nothing claims delivery. An operator
 * configuring the key later is a setup step OUTSIDE this repository's
 * authorization — until then every caller treats push as a best-effort
 * side-channel that may silently not happen (the in-app notification and the
 * server-clock deadline are the authoritative surfaces).
 */

import { nowMs } from "./clock.ts";
import { randomToken } from "./crypto.ts";
import { newId, type Db } from "./db/db.ts";
import { HttpError } from "./http.ts";

export type PushAttemptStatus = "skipped_not_configured" | "no_subscription" | "sent";

export interface PushAttempt {
  attempted: boolean;
  status: PushAttemptStatus;
}

/** Is a push provider configured? (Today: never — see the module header.) */
export function pushProviderConfigured(env: { PUSH_VAPID_PRIVATE_KEY?: string }): boolean {
  return typeof env.PUSH_VAPID_PRIVATE_KEY === "string" && env.PUSH_VAPID_PRIVATE_KEY !== "";
}

/**
 * Best-effort push attempt for an identity's registered subscriptions.
 * Current honest outcome: `skipped_not_configured` (no provider, no keys, no
 * network) or `no_subscription`. Delivery is never claimed.
 */
export async function attemptWebPush(
  db: Db,
  env: { PUSH_VAPID_PRIVATE_KEY?: string },
  identityId: string,
): Promise<PushAttempt> {
  if (!pushProviderConfigured(env)) {
    return { attempted: false, status: "skipped_not_configured" };
  }
  const subscriptions = await db
    .prepare("SELECT id FROM web_push_subscription WHERE identity_id = ? LIMIT 1")
    .bind(identityId)
    .first();
  if (subscriptions === null) {
    return { attempted: false, status: "no_subscription" };
  }
  // A configured provider is a future operator setup step outside this
  // authorization; until the keys exist this line is unreachable, and the
  // module never pretends otherwise.
  return { attempted: false, status: "skipped_not_configured" };
}

/** POST /api/auth/push-subscriptions — register this device's subscription
 * (G09). The client registers AFTER the browser permission is granted; the
 * registration itself grants nothing — pushes stay best-effort. */
export async function registerPushSubscription(
  db: Db,
  identityId: string,
  input: { endpoint?: unknown; keys?: unknown },
): Promise<void> {
  if (
    typeof input.endpoint !== "string" ||
    !/^https:\/\/.+/.test(input.endpoint) ||
    input.endpoint.length > 2048
  ) {
    throw new HttpError(400, "bad_request", { field: "endpoint" });
  }
  if (typeof input.keys !== "object" || input.keys === null || Array.isArray(input.keys)) {
    throw new HttpError(400, "bad_request", { field: "keys" });
  }
  const id = newId("wps", randomToken);
  await db
    .prepare(
      "INSERT INTO web_push_subscription (id, identity_id, endpoint, keys_json, created_at) VALUES (?, ?, ?, ?, ?) " +
        "ON CONFLICT (identity_id, endpoint) DO NOTHING",
    )
    .bind(id, identityId, input.endpoint, JSON.stringify(input.keys), nowMs())
    .run();
}

/** DELETE the caller's subscription for an endpoint (G09: honest unregister). */
export async function removePushSubscription(db: Db, identityId: string, endpoint: string): Promise<void> {
  await db
    .prepare("DELETE FROM web_push_subscription WHERE identity_id = ? AND endpoint = ?")
    .bind(identityId, endpoint)
    .run();
}
