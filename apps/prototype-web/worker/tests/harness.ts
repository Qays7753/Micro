/**
 * Worker test harness — real local Cloudflare emulation (workerd + D1 + R2)
 * via Miniflare. The worker bundle is built once per test run with esbuild;
 * migrations from worker/db/migrations are applied to the emulated D1 before
 * any test runs. Sign-in is exercised through the REAL OIDC redirect flow
 * with a synthetic Google service binding (no real IdP, no real credentials).
 */
import { build } from "esbuild";
import { Miniflare } from "miniflare";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));

/** The worker source root (worker/). */
export const workerRoot = path.resolve(here, "..");
const migrationsDir = path.join(workerRoot, "db", "migrations");

let cachedScript: string | null = null;

async function workerScript(): Promise<string> {
  if (cachedScript !== null) return cachedScript;
  const result = await build({
    entryPoints: [path.join(workerRoot, "index.ts")],
    bundle: true,
    format: "esm",
    target: "es2022",
    platform: "neutral",
    minify: false,
    write: false,
  });
  cachedScript = result.outputFiles[0].text;
  return cachedScript;
}

export interface GoogleMock {
  /** Set the id_token payload the next token exchange will return. */
  nextPayload: Record<string, unknown> | null;
}

export interface WorkerInstance {
  origin: string;
  mf: Miniflare;
  googleMock: GoogleMock;
  fetch: (pathAndQuery: string, init?: RequestInit) => Promise<Response>;
  close: () => Promise<void>;
}

export interface HarnessOptions {
  bindings?: Record<string, unknown>;
}

/** Start the emulated worker with D1/R2 and mocked ASSETS + GOOGLE bindings. */
export async function startWorker(options: HarnessOptions = {}): Promise<WorkerInstance> {
  const script = await workerScript();
  const googleMock: GoogleMock = { nextPayload: null };
  const mf = new Miniflare({
    modules: true,
    script,
    compatibilityDate: "2024-12-01",
    d1Databases: ["DB"],
    r2Buckets: ["MEDIA"],
    // Enables directly triggering the worker's `scheduled` export through
    // dispatchFetch("/cdn-cgi/handler/scheduled") — used by reminders tests.
    unsafeTriggerHandlers: true,
    bindings: {
      GOOGLE_CLIENT_ID: "test-client-id",
      GOOGLE_CLIENT_SECRET: "test-client-secret-value",
      ...options.bindings,
    },
    serviceBindings: {
      ASSETS: async (request: Request) => {
        const pathname = new URL(request.url).pathname;
        if (pathname === "/index.html")
          return new Response("<!doctype html><title>Micro</title>", {
            status: 200,
            headers: { "content-type": "text/html" },
          });
        return new Response("not-found", { status: 404 });
      },
      GOOGLE: async (request: Request) => {
        const form = new URLSearchParams(await request.text());
        void form;
        if (googleMock.nextPayload === null) {
          return Response.json({ error: "mock_not_configured" }, { status: 500 });
        }
        const encode = (obj: unknown) =>
          btoa(String.fromCharCode(...new TextEncoder().encode(JSON.stringify(obj))))
            .replace(/\+/g, "-")
            .replace(/\//g, "_")
            .replace(/=+$/, "");
        const idToken = `${encode({ alg: "none" })}.${encode(googleMock.nextPayload)}.synthetic`;
        return Response.json({ id_token: idToken, token_type: "Bearer" });
      },
    },
  });
  const db = await mf.getD1Database("DB");
  const files = readdirSync(migrationsDir)
    .filter(name => name.endsWith(".sql"))
    .sort();
  for (const file of files) {
    // Split on statement-final semicolons and run via prepared statements
    // (D1 `exec` is line-oriented; wrangler's file runner splits statements).
    const sql = readFileSync(path.join(migrationsDir, file), "utf8");
    const statements = sql
      .split("\n")
      .filter(line => !line.trimStart().startsWith("--"))
      .join("\n")
      .split(";")
      .map(statement => statement.trim())
      .filter(statement => statement.length > 0);
    for (const statement of statements) {
      await db.prepare(statement).run();
    }
  }
  const origin = "http://mf.local";
  // Test posture: the limiter MECHANICS are covered by a dedicated focused
  // test; every other test signs in and browses freely (all requests share
  // one emulated IP, so production defaults would trip mid-suite).
  await db
    .prepare(
      "INSERT INTO network_settings (key, value_json, updated_at, updated_by) VALUES ('rate.limits', ?, 1, 'harness')",
    )
    .bind(
      JSON.stringify({
        submissionsPerDay: 1000,
        imagesPerDay: 1000,
        reportsPerDay: 1000,
        guestReadsPerMinute: 100000,
        authStartsPerMinute: 100000,
      }),
    )
    .run();
  return {
    mf,
    origin,
    googleMock,
    // Redirects must surface as responses (the browser would follow them,
    // never the test transport).
    fetch: (pathAndQuery: string, init?: RequestInit): Promise<Response> =>
      mf.dispatchFetch(new URL(pathAndQuery, origin).toString(), {
        redirect: "manual",
        ...init,
      } as never) as unknown as Promise<Response>,
    close: () => mf.dispose(),
  };
}

export interface SignInResult {
  cookieHeader: string;
  identityEmail: string;
}

/** Complete the real OIDC redirect flow against the synthetic Google. */
export async function signInAs(
  worker: WorkerInstance,
  profile: { sub: string; email: string; name?: string },
  returnTo = "/",
): Promise<SignInResult> {
  const startResponse = await worker.fetch(`/api/auth/google/start?returnTo=${encodeURIComponent(returnTo)}`);
  if (startResponse.status !== 302) {
    throw new Error(`google/start failed: ${startResponse.status} ${await startResponse.text()}`);
  }
  const flowCookie = /micro_flow=([^;]+)/.exec(startResponse.headers.get("set-cookie") ?? "")?.[1];
  if (!flowCookie) throw new Error("google/start did not set the flow cookie");
  const location = startResponse.headers.get("location") ?? "";
  const params = new URL(location).searchParams;
  const state = params.get("state");
  const nonce = params.get("nonce");
  if (!state || !nonce) throw new Error("google/start missing state/nonce");
  worker.googleMock.nextPayload = {
    iss: "https://accounts.google.com",
    aud: "test-client-id",
    exp: Math.floor(Date.now() / 1000) + 3600,
    nonce,
    sub: profile.sub,
    email: profile.email,
    email_verified: true,
    name: profile.name ?? profile.email,
    picture: null,
  };
  const callbackResponse = await worker.fetch(
    `/api/auth/google/callback?code=test-code&state=${encodeURIComponent(state)}`,
    { headers: { cookie: `micro_flow=${flowCookie}` } },
  );
  if (callbackResponse.status !== 302) {
    throw new Error(`callback failed: ${callbackResponse.status} ${await callbackResponse.text()}`);
  }
  const setCookie = callbackResponse.headers.get("set-cookie");
  const token = /micro_session=([^;]+)/.exec(setCookie ?? "")?.[1];
  if (!token) throw new Error("callback did not set the session cookie");
  return { cookieHeader: `micro_session=${token}`, identityEmail: profile.email };
}

/** Authenticated JSON POST with the API/CSRF headers. */
export async function apiPost(
  worker: WorkerInstance,
  cookie: string | null,
  pathAndQuery: string,
  body: unknown,
  extraHeaders: Record<string, string> = {},
): Promise<Response> {
  return worker.fetch(pathAndQuery, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      origin: worker.origin,
      "x-micro-api": "1",
      ...(cookie ? { cookie } : {}),
      ...extraHeaders,
    },
    body: JSON.stringify(body),
  });
}

/** Authenticated JSON GET. */
export async function apiGet(
  worker: WorkerInstance,
  cookie: string | null,
  pathAndQuery: string,
): Promise<Response> {
  return worker.fetch(pathAndQuery, { headers: cookie ? { cookie } : {} });
}

/** Direct D1 access for seeding/inspecting state (bypasses the API). */
export async function rawDb(worker: WorkerInstance) {
  return worker.mf.getD1Database("DB");
}
