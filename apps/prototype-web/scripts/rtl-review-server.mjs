/**
 * Phase E RTL review server (S12/W6 — MASTER-PROMPT §6-Phase E):
 * boots the REAL built worker (dist/public/_worker.js) inside Miniflare with
 * the REAL embedded PostgreSQL (the production Hyperdrive code path over
 * cloudflare:sockets) and serves the built SPA — a real HTTP origin for the
 * rendered-UI review at 360/390/430 CSS px. No provider account, no network
 * egress beyond localhost; synthetic data only.
 *
 * Stage B (S13/M-F3, 2026-11-14): setting MICRO_TEST_PG_CONNECTION uses an
 * existing PostgreSQL server instead of booting the embedded one — the same
 * harness-supported override as scripts/pg-test-server.mjs, so the tool keeps
 * working on machines/runners whose images no longer ship the libicuuc.so.60
 * the embedded binaries link against. The review database micro_rtl_review is
 * still created/migrated in isolation on that server; nothing else changes.
 */
import { spawnSync } from "node:child_process";
import { createServer } from "node:http";
import { rmSync, mkdirSync, readFileSync, existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const appDir = path.resolve(here, "..");
const DIST = path.join(appDir, "dist", "public");

const PORT = Number(process.env.MICRO_RTL_PORT ?? 8787);
const PG_PORT = 55491;
const DATA_DIR = path.join(appDir, "node_modules", ".cache", "micro-pg-rtl");

function resolveBin(name) {
  return path.join(appDir, "node_modules", "@embedded-postgres", "linux-x64", "native", "bin", name);
}

function run(bin, args) {
  const result = spawnSync(bin, args, { encoding: "utf8" });
  if (result.status !== 0) throw new Error(`${path.basename(bin)} failed: ${(result.stderr || "").slice(-500)}`);
  return result;
}

async function main() {
  if (!existsSync(path.join(DIST, "_worker.js"))) throw new Error("dist/public/_worker.js missing — run the build first");
  const postgres = (await import("postgres")).default;
  const externalAdmin = process.env.MICRO_TEST_PG_CONNECTION ?? null;
  let admin;
  if (externalAdmin !== null) {
    // External server override (Stage B/M-F3): identical isolation — the
    // review still gets its own micro_rtl_review database with fresh
    // migrations; the embedded binaries never run in this mode.
    admin = postgres(externalAdmin, { max: 1 });
    console.log(`[rtl-review] using external PostgreSQL: ${externalAdmin}`);
  } else {
    // 1. Embedded PostgreSQL (isolated database micro_rtl_review).
    rmSync(DATA_DIR, { recursive: true, force: true });
    mkdirSync(DATA_DIR, { recursive: true });
    run(resolveBin("initdb"), ["-D", path.join(DATA_DIR, "data"), "-U", "postgres", "--no-locale", "-E", "UTF8"]);
    run(resolveBin("pg_ctl"), [
      "-D", path.join(DATA_DIR, "data"), "-o", `-p ${PG_PORT}`, "-l", path.join(DATA_DIR, "server.log"), "start",
    ]);
    admin = postgres(`postgres://postgres@127.0.0.1:${PG_PORT}/postgres`, { max: 1 });
  }
  const pgPort = externalAdmin !== null ? null : PG_PORT;
  const reviewDbAdmin = externalAdmin !== null ? externalAdmin : `postgres://postgres@127.0.0.1:${pgPort}/postgres`;
  const exists = await admin`select 1 as ok from pg_database where datname = 'micro_rtl_review'`;
  if (exists.length === 0) await admin`create database micro_rtl_review`;
  else if (externalAdmin !== null) {
    // External mode: fresh review state per run, matching the embedded path's
    // rmSync(DATA_DIR) semantics (migrations are re-applied on a clean DB).
    await admin`drop database micro_rtl_review with (force)`;
    await admin`create database micro_rtl_review`;
  }
  const db = postgres(`${reviewDbAdmin.replace(/\/[^/]*$/, "")}/micro_rtl_review`, { max: 1 });
  const migrationsDir = path.join(appDir, "worker", "db", "migrations-pg");
  const { readdirSync } = await import("node:fs");
  for (const file of readdirSync(migrationsDir).filter(f => f.endsWith(".sql")).sort()) {
    await db.unsafe(readFileSync(path.join(migrationsDir, file), "utf8"));
  }
  console.log(`[rtl-review] PostgreSQL ready${externalAdmin !== null ? " (external)" : ` on :${PG_PORT}`} (migrations applied)`);
  await admin.end();

  // 2. Miniflare with the REAL worker + static assets + PG binding.
  const { Miniflare } = await import("miniflare");
  const mf = new Miniflare({
    modules: true,
    script: readFileSync(path.join(DIST, "_worker.js"), "utf8"),
    compatibilityDate: "2024-12-01",
    compatibilityFlags: ["nodejs_compat"],
    r2Buckets: ["MEDIA"],
    bindings: {
      GOOGLE_CLIENT_ID: "rtl-review-client-id",
      GOOGLE_CLIENT_SECRET: "rtl-review-secret",
      DB: { connectionString: `${reviewDbAdmin.replace(/\/[^/]*$/, "")}/micro_rtl_review` },
    },
    serviceBindings: {
      ASSETS: async request => {
        const url = new URL(request.url);
        let pathname = url.pathname === "/" ? "/index.html" : url.pathname;
        const filePath = path.join(DIST, pathname.replace(/^\//, ""));
        if (existsSync(filePath) && !filePath.endsWith(path.sep)) {
          const ext = path.extname(filePath);
          const types = { ".js": "text/javascript", ".css": "text/css", ".html": "text/html", ".json": "application/json", ".webmanifest": "application/manifest+json", ".svg": "image/svg+xml", ".png": "image/png", ".woff2": "font/woff2", ".ico": "image/x-icon" };
          return new Response(readFileSync(filePath), { headers: { "content-type": types[ext] ?? "application/octet-stream" } });
        }
        return new Response("not-found", { status: 404 });
      },
    },
  });

  // 3. Plain HTTP bridge so a real browser can reach the worker origin.
  const server = createServer(async (req, res) => {
    try {
      const mfRes = await mf.dispatchFetch(`http://rtl.local${req.url ?? "/"}`, {
        method: req.method,
        headers: req.headers,
        body: ["GET", "HEAD"].includes(req.method ?? "GET") ? undefined : req,
        redirect: "manual",
      });
      res.writeHead(mfRes.status, Object.fromEntries(mfRes.headers.entries()));
      if (mfRes.body) {
        for await (const chunk of mfRes.body) res.write(chunk);
      }
      res.end();
    } catch (error) {
      res.writeHead(500, { "content-type": "text/plain" });
      res.end(String(error));
    }
  });
  await new Promise(resolve => server.listen(PORT, "127.0.0.1", resolve));
  console.log(`[rtl-review] serving http://127.0.0.1:${PORT} (real worker + real PG)`);
  console.log("[rtl-review] press Ctrl+C to stop");
  // Phase F (review 5): stop PostgreSQL on Ctrl+C/TERM — otherwise the next
  // run's rmSync(DATA_DIR) races a live server on the same port.
  const shutdown = () => {
    try {
      server.close();
      if (externalAdmin === null) {
        run(resolveBin("pg_ctl"), ["-D", path.join(DATA_DIR, "data"), "stop"]);
      }
    } finally {
      process.exit(0);
    }
  };
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
