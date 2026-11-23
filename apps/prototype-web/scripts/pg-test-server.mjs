/**
 * Vitest globalSetup — repository-supported local PostgreSQL test server
 * (EX-D20 Phase B). Boots an embedded PostgreSQL 17 (devDependency
 * @embedded-postgres/linux-x64 binaries — MIT wrapper, PostgreSQL-licensed
 * server) once per test run, then exposes its connection string through
 * MICRO_TEST_PG_CONNECTION for worker/tests/harness.ts (per-file isolated
 * databases are created by the harness).
 *
 * Override: setting MICRO_TEST_PG_CONNECTION before the run uses an existing
 * PostgreSQL server instead (e.g. a CI service container) — no embedded
 * server is booted in that case. The server never leaves this machine; no
 * provider account or paid resource is involved.
 */
import { spawnSync } from "node:child_process";
import { rmSync, mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const appDir = path.resolve(here, "..");

function resolveBin(name) {
  // The platform package does not export ./package.json — resolve through the
  // workspace node_modules symlink (pnpm) to the bundled binaries.
  return path.join(appDir, "node_modules", "@embedded-postgres", "linux-x64", "native", "bin", name);
}

const PORT = Number(process.env.MICRO_TEST_PG_PORT ?? 55432);
const DATA_DIR = path.join(appDir, "node_modules", ".cache", "micro-pg-test");
const LOG_FILE = path.join(DATA_DIR, "server.log");

function run(bin, args, opts = {}) {
  const result = spawnSync(bin, args, { encoding: "utf8", ...opts });
  if (result.status !== 0) {
    throw new Error(
      `${path.basename(bin)} failed (${result.status}): ${(result.stderr || result.stdout || "").slice(-2000)}`,
    );
  }
  return result;
}

async function waitForServer(connectionString, attempts = 40) {
  const postgres = (await import("postgres")).default;
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      const sql = postgres(connectionString, { max: 1, connect_timeout: 2 });
      await sql`select 1`;
      await sql.end();
      return;
    } catch {
      await new Promise(resolve => setTimeout(resolve, 250));
    }
  }
  throw new Error(`PostgreSQL did not become reachable on port ${PORT}`);
}

async function createDatabase(admin, name) {
  const exists = await admin`select 1 as ok from pg_database where datname = ${name}`;
  if (exists.length === 0) {
    await admin`create database ${admin(name)}`;
  }
}

export default async function setup() {
  if (process.env.MICRO_TEST_PG_CONNECTION) {
    console.log(`[pg-test-server] using external PostgreSQL: ${process.env.MICRO_TEST_PG_CONNECTION}`);
    return () => {};
  }

  rmSync(DATA_DIR, { recursive: true, force: true });
  mkdirSync(DATA_DIR, { recursive: true });

  const initdb = resolveBin("initdb");
  const pgCtl = resolveBin("pg_ctl");
  run(initdb, ["-D", path.join(DATA_DIR, "pgdata"), "-U", "micro", "--auth=trust", "-E", "UTF8"]);
  writeFileSync(LOG_FILE, "");
  run(pgCtl, [
    "-D",
    path.join(DATA_DIR, "pgdata"),
    "-l",
    LOG_FILE,
    "-o",
    `-p ${PORT} -c listen_addresses=127.0.0.1 -c max_connections=200`,
    "start",
  ]);

  const adminConnection = `postgres://micro@127.0.0.1:${PORT}/postgres`;
  await waitForServer(adminConnection);
  const postgres = (await import("postgres")).default;
  const admin = postgres(adminConnection, { max: 1 });
  await createDatabase(admin, "micro_base");
  await admin.end();

  process.env.MICRO_TEST_PG_CONNECTION = `postgres://micro@127.0.0.1:${PORT}/postgres`;
  console.log(`[pg-test-server] embedded PostgreSQL ready on 127.0.0.1:${PORT}`);

  return async () => {
    try {
      run(pgCtl, ["-D", path.join(DATA_DIR, "pgdata"), "-m", "fast", "stop"]);
    } finally {
      if (!process.env.MICRO_TEST_PG_KEEP_DATA) {
        rmSync(DATA_DIR, { recursive: true, force: true });
      }
    }
  };
}
