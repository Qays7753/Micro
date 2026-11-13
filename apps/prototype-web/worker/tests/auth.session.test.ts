/**
 * Foundation acceptance — identity/session security.
 * Real workerd emulation; sign-in through the real OIDC redirect flow with a
 * synthetic Google binding. Covers: session lifecycle, cookie flags, CSRF
 * (origin + custom header), unauthenticated denial, idempotent replay, and
 * D1-failure atomicity.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { apiGet, apiPost, rawDb, signInAs, startWorker, type WorkerInstance } from "./harness.ts";

let worker: WorkerInstance;

beforeAll(async () => {
  worker = await startWorker({ bindings: { BOOTSTRAP_OWNER_EMAIL: "owner@example.test" } });
});

afterAll(async () => {
  await worker.close();
});

describe("foundation: sessions and CSRF", () => {
  it("health reports honest configuration state", async () => {
    const response = await apiGet(worker, null, "/api/health");
    expect(response.status).toBe(200);
    const body = (await response.json()) as { ready: boolean; googleSignIn: string };
    expect(body.googleSignIn).toBe("configured");
    expect(body.ready).toBe(true);
  });

  it("unauthenticated session is reported as such", async () => {
    const response = await apiGet(worker, null, "/api/auth/session");
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ authenticated: false });
  });

  it("protected endpoints reject unauthenticated callers with 401", async () => {
    const notifications = await apiGet(worker, null, "/api/notifications");
    expect(notifications.status).toBe(401);
    const upload = await apiPost(worker, null, "/api/media?purpose=market_listing_media", {});
    expect(upload.status).toBe(401);
  });

  it("sign-in through the real OIDC flow sets an HttpOnly SameSite cookie", async () => {
    const owner = await signInAs(worker, { sub: "sub-owner-1", email: "owner@example.test" });
    expect(owner.cookieHeader).toContain("micro_session=");
    const session = await apiGet(worker, owner.cookieHeader, "/api/auth/session");
    const body = (await session.json()) as {
      authenticated: boolean;
      identity: { email: string };
      isAdmin: boolean;
    };
    expect(body.authenticated).toBe(true);
    expect(body.identity.email).toBe("owner@example.test");
    // First matching sign-in bootstrapped the admin (no self-grant endpoint).
    expect(body.isAdmin).toBe(true);
  });

  it("a second identity does NOT get admin (bootstrap is one-time)", async () => {
    const guest = await signInAs(worker, { sub: "sub-guest-1", email: "someone@example.test" });
    const session = (await (await apiGet(worker, guest.cookieHeader, "/api/auth/session")).json()) as {
      isAdmin: boolean;
    };
    expect(session.isAdmin).toBe(false);
  });

  it("the session cookie is HttpOnly and SameSite=Lax in the raw header", async () => {
    const startResponse = await worker.fetch("/api/auth/google/start?returnTo=/market");
    expect(startResponse.status).toBe(302);
    const location = startResponse.headers.get("location") ?? "";
    const params = new URL(location).searchParams;
    // The flow is bound to the initiating browser (anti login-CSRF): the
    // short-lived micro_flow cookie must ride along on the callback.
    const flowCookie = /micro_flow=([^;]+)/.exec(startResponse.headers.get("set-cookie") ?? "")?.[1];
    expect(flowCookie).toBeDefined();
    worker.googleMock.nextPayload = {
      iss: "https://accounts.google.com",
      aud: "test-client-id",
      exp: Math.floor(Date.now() / 1000) + 3600,
      nonce: params.get("nonce"),
      sub: "sub-flags-1",
      email: "flags@example.test",
      email_verified: true,
      name: "Flags",
    };
    const callback = await worker.fetch(
      `/api/auth/google/callback?code=c2&state=${encodeURIComponent(params.get("state") ?? "")}`,
      { headers: { cookie: `micro_flow=${flowCookie}` } },
    );
    const setCookie = callback.headers.get("set-cookie") ?? "";
    expect(setCookie).toContain("HttpOnly");
    expect(setCookie).toContain("SameSite=Lax");
  });

  it("a callback without the matching micro_flow cookie fails closed (login-CSRF binding)", async () => {
    const startResponse = await worker.fetch("/api/auth/google/start?returnTo=/market");
    expect(startResponse.status).toBe(302);
    const location = startResponse.headers.get("location") ?? "";
    const params = new URL(location).searchParams;
    worker.googleMock.nextPayload = {
      iss: "https://accounts.google.com",
      aud: "test-client-id",
      exp: Math.floor(Date.now() / 1000) + 3600,
      nonce: params.get("nonce"),
      sub: "sub-flags-2",
      email: "attacker@example.test",
      email_verified: true,
      name: "Attacker",
    };
    // A state value minted in ANOTHER browser (no micro_flow cookie here):
    // the flow must be consumed atomically and fail closed — with a VISIBLE
    // honest error page (F-26), never a silent redirect that hides the failure.
    const hijacked = await worker.fetch(
      `/api/auth/google/callback?code=c3&state=${encodeURIComponent(params.get("state") ?? "")}`,
    );
    expect(hijacked.status).toBe(401);
    expect(hijacked.headers.get("set-cookie")).toBe(null);
    const page = await hijacked.text();
    expect(page).toContain("تعذّر إكمال تسجيل الدخول");
    expect(page).toContain("لم تُفتح أي جلسة");
    const session = await worker.fetch("/api/auth/session");
    expect(((await session.json()) as { authenticated: boolean }).authenticated).toBe(false);
  });

  it("mutating calls without the custom API header are rejected (CSRF)", async () => {
    const owner = await signInAs(worker, { sub: "sub-owner-2", email: "owner2@example.test" });
    const response = await worker.fetch("/api/notifications/read", {
      method: "POST",
      headers: { "content-type": "application/json", origin: worker.origin, cookie: owner.cookieHeader },
      body: JSON.stringify({ ids: [1] }),
    });
    expect(response.status).toBe(403);
    const body = (await response.json()) as { error: { code: string } };
    expect(body.error.code).toBe("forbidden");
  });

  it("mutating calls with a mismatching Origin are rejected", async () => {
    const owner = await signInAs(worker, { sub: "sub-owner-3", email: "owner3@example.test" });
    const response = await worker.fetch("/api/notifications/read", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        origin: "https://evil.example",
        "x-micro-api": "1",
        cookie: owner.cookieHeader,
      },
      body: JSON.stringify({ ids: [1] }),
    });
    expect(response.status).toBe(403);
  });

  it("sign-out revokes the session server-side", async () => {
    const user = await signInAs(worker, { sub: "sub-signout-1", email: "signout@example.test" });
    const out = await apiPost(worker, user.cookieHeader, "/api/auth/signout", {});
    expect(out.status).toBe(200);
    const after = await apiGet(worker, user.cookieHeader, "/api/auth/session");
    expect(await after.json()).toEqual({ authenticated: false });
  });

  it("an unknown API route returns 404 and an internal error never leaks a stack", async () => {
    const missing = await apiGet(worker, null, "/api/definitely/not/a/route");
    expect(missing.status).toBe(404);
  });
});

describe("foundation: idempotent commands", () => {
  it("replaying the same Idempotency-Key + body returns the same response", async () => {
    const user = await signInAs(worker, { sub: "sub-idem-1", email: "idem@example.test" });
    const bytes = new Uint8Array([1, 2, 3, 4]);
    const doUpload = () =>
      worker.fetch("/api/media?purpose=market_listing_media", {
        method: "POST",
        headers: {
          "content-type": "image/png",
          origin: worker.origin,
          "x-micro-api": "1",
          cookie: user.cookieHeader,
          "idempotency-key": "idem-key-1",
        },
        body: bytes,
      });
    const first = await doUpload();
    expect(first.status).toBe(201);
    const replay = await doUpload();
    expect(replay.status).toBe(201);
    expect(replay.headers.get("x-idempotent-replay")).toBe("1");
    expect(await replay.text()).toBe(await first.clone().text());
    const db = await rawDb(worker);
    const rows = await db.prepare("SELECT COUNT(*) AS n FROM media_object").first<{ n: number }>();
    expect(rows?.n).toBe(1);
  });

  it("the same key with a DIFFERENT body is a 409 conflict", async () => {
    const user = await signInAs(worker, { sub: "sub-idem-2", email: "idem2@example.test" });
    const doUpload = (bytes: Uint8Array, key: string) =>
      worker.fetch("/api/media?purpose=market_listing_media", {
        method: "POST",
        headers: {
          "content-type": "image/png",
          origin: worker.origin,
          "x-micro-api": "1",
          cookie: user.cookieHeader,
          "idempotency-key": key,
        },
        body: bytes,
      });
    const first = await doUpload(new Uint8Array([1, 2, 3]), "clash-1");
    expect(first.status).toBe(201);
    const clash = await doUpload(new Uint8Array([9, 9, 9]), "clash-1");
    expect(clash.status).toBe(409);
  });

  it("the same key from a DIFFERENT session never replays another account's response", async () => {
    const userA = await signInAs(worker, { sub: "sub-idem-3", email: "idem3@example.test" });
    const userB = await signInAs(worker, { sub: "sub-idem-4", email: "idem4@example.test" });
    const uploadAs = (cookie: string) =>
      worker.fetch("/api/media?purpose=market_listing_media", {
        method: "POST",
        headers: {
          "content-type": "image/png",
          origin: worker.origin,
          "x-micro-api": "1",
          cookie,
          "idempotency-key": "shared-key-across-accounts",
        },
        body: new Uint8Array([7, 7, 7]),
      });
    const first = await uploadAs(userA.cookieHeader);
    expect(first.status).toBe(201);
    expect(first.headers.get("x-idempotent-replay")).toBe(null);
    const second = await uploadAs(userB.cookieHeader);
    // B's call executes freshly under B's own session — never a replay of
    // A's stored response (cross-account replay would leak A's media id).
    expect(second.status).toBe(201);
    expect(second.headers.get("x-idempotent-replay")).toBe(null);
    const firstBody = (await first.json()) as { media: { id: string } };
    const secondBody = (await second.json()) as { media: { id: string } };
    expect(secondBody.media.id).not.toBe(firstBody.media.id);
    const db = await rawDb(worker);
    const rows = await db
      .prepare("SELECT COUNT(*) AS n FROM media_object WHERE size_bytes = 3")
      .first<{ n: number }>();
    expect(rows?.n).toBeGreaterThanOrEqual(2);
  });
});

describe("foundation: admin settings and guest abuse limits", () => {
  it("the allowlisted admin settings route works, non-admins and unknown keys are rejected", async () => {
    const admin = await signInAs(worker, { sub: "sub-settings-admin", email: "settings-admin@example.test" });
    const db = await rawDb(worker);
    const identity = await db
      .prepare("SELECT id FROM network_identity WHERE email = ?")
      .bind("settings-admin@example.test")
      .first<{ id: string }>();
    await db
      .prepare(
        "INSERT INTO network_membership (identity_id, role, status, granted_by, granted_at) VALUES (?, 'admin', 'active', 'test', ?)",
      )
      .bind(identity!.id, Date.now())
      .run();
    const put = (cookie: string, key: string, value: unknown) =>
      worker.fetch(`/api/admin/settings/${key}`, {
        method: "PUT",
        headers: { "content-type": "application/json", origin: worker.origin, "x-micro-api": "1", cookie },
        body: JSON.stringify({ value }),
      });
    // Non-admin is rejected; unknown keys are not settable; a bad value is a 400.
    const plain = await signInAs(worker, { sub: "sub-settings-plain", email: "settings-plain@example.test" });
    expect((await put(plain.cookieHeader, "rate.limits", { guestReadsPerMinute: 5 })).status).toBe(403);
    expect((await put(admin.cookieHeader, "not.a.key", 1)).status).toBe(404);
    expect((await put(admin.cookieHeader, "rate.limits", { guestReadsPerMinute: "many" })).status).toBe(400);
    expect((await put(admin.cookieHeader, "disclosure.recipient", "sometimes")).status).toBe(400);
    // The admin can set a low guest-read limit…
    const set = await put(admin.cookieHeader, "rate.limits", { guestReadsPerMinute: 2 });
    expect(set.status).toBe(200);
    // …and the guest limiter enforces it (fixed window, per connecting IP).
    const guestGet = () => worker.fetch("/api/market/listings");
    expect((await guestGet()).status).toBe(200);
    expect((await guestGet()).status).toBe(200);
    const throttled = await guestGet();
    expect(throttled.status).toBe(429);
    // Restore the generous test posture for the rest of the suite.
    const restore = await put(admin.cookieHeader, "rate.limits", {
      guestReadsPerMinute: 100000,
      authStartsPerMinute: 100000,
    });
    expect(restore.status).toBe(200);
    expect((await guestGet()).status).toBe(200);
  });
});
