/**
 * Foundation acceptance — Manage non-interference and PostgreSQL transaction
 * atomicity. The worker has NO path to Manage local storage (it cannot even
 * name it), and the API surface must never expose Manage data. Multi-statement
 * writes go through a single transaction (`batch`) — a forced failure leaves
 * no partial state. The ACTIVE schema is the PostgreSQL target (EX-D20);
 * the D1 files under db/migrations/ are superseded history.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { rawDb, signInAs, startWorker, workerRoot, type WorkerInstance } from "./harness.ts";

let worker: WorkerInstance;

beforeAll(async () => {
  worker = await startWorker();
});

afterAll(async () => {
  await worker.close();
});

const migrationsFile = path.join(workerRoot, "db", "migrations-pg", "0001_init.sql");

describe("foundation: Manage non-interference", () => {
  it("the worker tree never imports or references the Manage local store", () => {
    const files: string[] = [];
    const walk = (dir: string): void => {
      for (const entry of readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          if (entry.name === "tests") continue;
          walk(full);
        } else if (/\.(ts|sql)$/.test(entry.name)) {
          files.push(full);
        }
      }
    };
    walk(workerRoot);
    expect(files.length).toBeGreaterThan(10);
    const forbidden = [
      "PrototypeLocalStore",
      "IndexedDbLocalStore",
      "indexedDB",
      "localSchemaVersion",
      "localExportVersion",
      "micro-prototype-local",
      "MoneyMinor",
    ];
    for (const file of files) {
      const text = readFileSync(file, "utf8");
      for (const marker of forbidden) {
        expect(text.includes(marker), `${path.basename(file)} must not reference ${marker}`).toBe(false);
      }
    }
  });

  it("the PostgreSQL schema contains network tables only — no Manage financial entities", () => {
    const sql = readFileSync(migrationsFile, "utf8");
    const tables = [...sql.matchAll(/CREATE TABLE (\w+)/g)].map(match => match[1]);
    expect(tables.length).toBeGreaterThan(15);
    const manageEntities = [
      "craft_order",
      "financial_event",
      "cash_wallet",
      "inventory_material",
      "supplier_purchase",
      "loan",
      "asset",
      "owner_entitlement",
    ];
    for (const entity of manageEntities) {
      expect(tables).not.toContain(entity);
    }
  });

  it("no API response may reference Manage local storage keys", async () => {
    const guestSession = await worker.fetch("/api/auth/session");
    const text = await guestSession.text();
    expect(text).not.toContain("micro-prototype-local");
    expect(text).not.toContain("IndexedDB");
  });
});

describe("foundation: PostgreSQL transaction atomicity", () => {
  it("a failed batch leaves no partial state (multi-statement writes are atomic)", async () => {
    await signInAs(worker, { sub: "sub-atomic-1", email: "atomic@example.test" });
    const db = await rawDb(worker);
    const identity = await db
      .prepare("SELECT id FROM network_identity WHERE email = ?")
      .bind("atomic@example.test")
      .first<{ id: string }>();
    expect(identity).not.toBeNull();
    const before = await db.prepare("SELECT COUNT(*) AS n FROM network_membership").first<{ n: number }>();
    let threw = false;
    try {
      await db.batch([
        db
          .prepare(
            "INSERT INTO network_membership (identity_id, role, status, granted_by, granted_at) VALUES (?, 'admin', 'active', 'test', 1)",
          )
          .bind(identity!.id),
        // role CHECK violation forces the transaction to fail AFTER a valid
        // first write — proving the rollback discards it.
        db
          .prepare(
            "INSERT INTO network_membership (identity_id, role, status, granted_by, granted_at) VALUES (?, 'superadmin', 'active', 'test', 1)",
          )
          .bind(identity!.id),
      ]);
    } catch {
      threw = true;
    }
    expect(threw).toBe(true);
    const after = await db.prepare("SELECT COUNT(*) AS n FROM network_membership").first<{ n: number }>();
    expect(after!.n).toBe(before!.n);
  });
});
