/**
 * Phase E RTL review server (S12/W6 — MASTER-PROMPT §6-Phase E):
 * boots the REAL built worker (dist/public/_worker.js) inside Miniflare with
 * the REAL embedded PostgreSQL (the production Hyperdrive code path over
 * cloudflare:sockets) and serves the built SPA — a real HTTP origin for the
 * rendered-UI review at 360/390/430 CSS px. No provider account, no network
 * egress beyond localhost; synthetic data only.
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
  // 1. Embedded PostgreSQL (isolated database micro_rtl_review).
  rmSync(DATA_DIR, { recursive: true, force: true });
  mkdirSync(DATA_DIR, { recursive: true });
  run(resolveBin("initdb"), ["-D", path.join(DATA_DIR, "data"), "-U", "postgres", "--no-locale", "-E", "UTF8"]);
  run(resolveBin("pg_ctl"), [
    "-D", path.join(DATA_DIR, "data"), "-o", `-p ${PG_PORT}`, "-l", path.join(DATA_DIR, "server.log"), "start",
  ]);
  const postgres = (await import("postgres")).default;
  const admin = postgres(`postgres://postgres@127.0.0.1:${PG_PORT}/postgres`, { max: 1 });
  const exists = await admin`select 1 as ok from pg_database where datname = 'micro_rtl_review'`;
  if (exists.length === 0) await admin`create database micro_rtl_review`;
  const db = postgres(`postgres://postgres@127.0.0.1:${PG_PORT}/micro_rtl_review`, { max: 1 });
  const migrationsDir = path.join(appDir, "worker", "db", "migrations-pg");
  const { readdirSync } = await import("node:fs");
  for (const file of readdirSync(migrationsDir).filter(f => f.endsWith(".sql")).sort()) {
    await db.unsafe(readFileSync(path.join(migrationsDir, file), "utf8"));
  }
  console.log(`[rtl-review] PostgreSQL ready on :${PG_PORT} (migrations applied)`);
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
      DB: { connectionString: `postgres://postgres@127.0.0.1:${PG_PORT}/micro_rtl_review` },
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
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
