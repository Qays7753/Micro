/**
 * M2.1 acceptance (Manage v2 phase 2, spec §3 + §14.4/§14.5) — the §3 schema
 * migration `0018_manage_v2_schema.sql`. Everything runs on a DEDICATED EMPTY
 * database (not the per-file harness database): the test creates it, applies
 * 0018 alone through the repository migration runner's exact statement-split
 * semantics (harness.ts applyMigrations: strip `--` lines, split on `;`), and
 * then again as a single whole-file call (rtl-review-server.mjs form).
 *
 * Asserted: the thirteen §3 tables exist with EXACTLY the §3 columns/types/
 * nullability; the §3-enumerated CHECK/UNIQUE constraints reject bad rows
 * behaviourally; UPDATE/DELETE on ledger_entry and ledger_posting FAIL at the
 * database level (append-only, §3.8) while INSERT, 0-row UPDATE and TRUNCATE
 * (the harness reset path) keep working; re-application is idempotent under
 * both runner forms; and no statement touches any legacy table (every
 * statement is a CREATE, except the single ALTER that closes the circular FK
 * between two tables this migration itself creates).
 */
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import postgres from "postgres";
import { workerRoot } from "./harness.ts";

const migrationsDir = path.join(workerRoot, "db", "migrations-pg");
const migrationPath = path.join(migrationsDir, "0018_manage_v2_schema.sql");
const migrationSql = readFileSync(migrationPath, "utf8");

/** Runner 1 semantics — a literal mirror of harness.ts applyMigrations. */
function runnerStatements(sqlText: string): string[] {
  return sqlText
    .split("\n")
    .filter(line => !line.trimStart().startsWith("--"))
    .join("\n")
    .split(";")
    .map(statement => statement.trim())
    .filter(statement => statement.length > 0);
}

const TS = "timestamp with time zone";

interface ColumnSpec {
  name: string;
  type: string;
  nullable: boolean;
}

function col(name: string, type: string, nullable = false): ColumnSpec {
  return { name, type, nullable };
}

/** §3 columns, in DDL order — exact sets (extras fail as loudly as gaps). */
const TABLES: Array<{ table: string; columns: ColumnSpec[] }> = [
  {
    table: "project",
    columns: [col("id", "uuid"), col("name", "text"), col("owner_account_id", "text"), col("created_at", TS)],
  },
  {
    table: "box",
    columns: [
      col("id", "uuid"),
      col("project_id", "uuid"),
      col("kind", "text"),
      col("status", "text"),
      col("opening_status", "text"),
      col("created_on", "date"),
      col("created_at", TS),
    ],
  },
  {
    table: "product",
    columns: [
      col("id", "uuid"),
      col("project_id", "uuid"),
      col("name", "text"),
      col("unit_label", "text", true),
      col("unit_price_minor", "bigint"),
      col("archived", "boolean"),
      col("created_at", TS),
      col("updated_at", TS, true),
    ],
  },
  {
    table: "product_component",
    columns: [
      col("id", "uuid"),
      col("project_id", "uuid"),
      col("product_id", "uuid"),
      col("name", "text"),
      col("cost_minor", "bigint"),
      col("position", "integer"),
    ],
  },
  {
    table: "sale",
    columns: [
      col("id", "uuid"),
      col("project_id", "uuid"),
      col("customer_name", "text", true),
      col("registered_on", "date"),
      col("planned_delivery_on", "date"),
      col("final_price_minor", "bigint", true),
      col("cancelled_on", "date", true),
      col("tracked", "boolean"),
      col("hidden_from_tracker", "boolean"),
      col("note", "text", true),
      col("created_at", TS),
      col("updated_at", TS, true),
    ],
  },
  {
    table: "operation",
    columns: [
      col("id", "uuid"),
      col("project_id", "uuid"),
      col("kind", "text"),
      col("effective_on", "date"),
      col("status", "text"),
      col("corrects_operation_id", "uuid", true),
      col("reversed_by_operation_id", "uuid", true),
      col("box_id", "uuid", true),
      col("sale_id", "uuid", true),
      col("balance_line_id", "uuid", true),
      col("counterparty_name", "text", true),
      col("category", "text", true),
      col("amount_minor", "bigint", true),
      col("delivery_cost_minor", "bigint", true),
      col("payload", "json", true),
      col("note", "text", true),
      col("created_by_account_id", "text"),
      col("created_at", TS),
    ],
  },
  {
    table: "sale_line",
    columns: [
      col("id", "uuid"),
      col("project_id", "uuid"),
      col("sale_id", "uuid"),
      col("position", "integer"),
      col("product_id", "uuid", true),
      col("description", "text"),
      col("quantity_milli", "integer"),
      col("unit_price_minor", "bigint", true),
      col("unit_cost_minor", "bigint", true),
      col("components_snapshot", "json", true),
    ],
  },
  {
    table: "balance_line",
    columns: [
      col("id", "uuid"),
      col("project_id", "uuid"),
      col("direction", "text"),
      col("kind", "text"),
      col("counterparty_name", "text", true),
      col("origin_on", "date"),
      col("sale_id", "uuid", true),
      col("origin_operation_id", "uuid"),
    ],
  },
  {
    table: "ledger_entry",
    columns: [
      col("id", "uuid"),
      col("project_id", "uuid"),
      col("operation_id", "uuid"),
      col("entry_type", "text"),
      col("effective_on", "date"),
      col("reverses_entry_id", "uuid", true),
      col("created_at", TS),
    ],
  },
  {
    table: "ledger_posting",
    columns: [
      col("id", "uuid"),
      col("project_id", "uuid"),
      col("entry_id", "uuid"),
      col("account", "text"),
      col("ref_id", "uuid", true),
      col("category", "text", true),
      col("rev_kind", "text", true),
      col("delta_minor", "bigint"),
    ],
  },
  {
    table: "absence_event",
    columns: [
      col("id", "uuid"),
      col("project_id", "uuid"),
      col("started_on", "date"),
      col("ended_on", "date"),
      col("complete", "boolean", true),
    ],
  },
  {
    table: "reconciliation",
    columns: [
      col("id", "uuid"),
      col("project_id", "uuid"),
      col("performed_on", "date"),
      col("context", "text"),
      col("created_at", TS),
    ],
  },
  {
    table: "reconciliation_box",
    columns: [
      col("reconciliation_id", "uuid"),
      col("box_id", "uuid"),
      col("project_id", "uuid"),
      col("recorded_minor", "bigint"),
      col("counted_minor", "bigint"),
    ],
  },
];

const PROJECT = "11111111-1111-4111-8111-111111111111";
const BOX = "22222222-2222-4222-8222-222222222222";
const OPERATION = "33333333-3333-4333-8333-333333333333";
const ENTRY = "44444444-4444-4444-8444-444444444444";
const POSTING_BOX = "55555555-5555-4555-8555-555555555555";
const POSTING_OPEN = "55555555-5555-4555-8555-555555555556";

let admin: postgres.Sql;
let client: postgres.Sql;
let databaseName: string;

/** A minimal FK-valid seed graph (idempotent) for the rejection probes. */
async function seedGraph(): Promise<void> {
  await client.unsafe(
    `INSERT INTO project (id, name, owner_account_id, created_at)
     VALUES ('${PROJECT}', 'مشروع مالي للاختبار', 'm21-owner', now())
     ON CONFLICT (id) DO NOTHING`,
  );
  await client.unsafe(
    `INSERT INTO box (id, project_id, kind, status, opening_status, created_on, created_at)
     VALUES ('${BOX}', '${PROJECT}', 'cash', 'active', 'known', '2026-11-01', now())
     ON CONFLICT (id) DO NOTHING`,
  );
  await client.unsafe(
    `INSERT INTO operation (id, project_id, kind, effective_on, status, created_by_account_id, created_at)
     VALUES ('${OPERATION}', '${PROJECT}', 'OP-SETUP', '2026-11-01', 'active', 'm21-owner', now())
     ON CONFLICT (id) DO NOTHING`,
  );
  await client.unsafe(
    `INSERT INTO ledger_entry (id, project_id, operation_id, entry_type, effective_on, created_at)
     VALUES ('${ENTRY}', '${PROJECT}', '${OPERATION}', 'Q1', '2026-11-01', now())
     ON CONFLICT (id) DO NOTHING`,
  );
  await client.unsafe(
    `INSERT INTO ledger_posting (id, project_id, entry_id, account, ref_id, delta_minor)
     VALUES ('${POSTING_BOX}', '${PROJECT}', '${ENTRY}', 'BOX', '${BOX}', 1000)
     ON CONFLICT (id) DO NOTHING`,
  );
  await client.unsafe(
    `INSERT INTO ledger_posting (id, project_id, entry_id, account, delta_minor)
     VALUES ('${POSTING_OPEN}', '${PROJECT}', '${ENTRY}', 'OPEN', 1000)
     ON CONFLICT (id) DO NOTHING`,
  );
}

beforeAll(async () => {
  const base = process.env.MICRO_TEST_PG_CONNECTION;
  if (!base)
    throw new Error("MICRO_TEST_PG_CONNECTION is not set (prototype vitest globalSetup provides it)");
  admin = postgres(base, { max: 1 });
  databaseName = `micro_m21_${Math.random().toString(36).slice(2, 10)}`;
  const existing = await admin`select 1 as ok from pg_database where datname = ${databaseName}`;
  if (existing.length === 0) {
    await admin`create database ${admin(databaseName)}`;
  }
  const withoutDb = base.replace(/\/[^/]*$/, "");
  client = postgres(`${withoutDb}/${databaseName}`, { max: 1 });
  // Runner 1: apply 0018 alone to the EMPTY database, exactly as the harness does.
  for (const statement of runnerStatements(migrationSql)) {
    await client.unsafe(statement);
  }
});

afterAll(async () => {
  if (client) await client.end();
  if (admin) {
    await admin`drop database if exists ${admin(databaseName)}`;
    await admin.end();
  }
});

describe("M2.1 §3 schema applies to an empty database (runner 1: harness split)", () => {
  it("creates exactly the thirteen §3 tables and nothing else", async () => {
    const rows = await client`
      SELECT table_name FROM information_schema.tables
      WHERE table_schema = 'public' ORDER BY table_name`;
    expect(rows.map(r => r.table_name)).toEqual(TABLES.map(t => t.table).sort());
  });

  it("creates every §3 table with exactly the §3 columns, types, and nullability", async () => {
    for (const { table, columns } of TABLES) {
      const rows = await client`
        SELECT column_name, data_type, is_nullable FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = ${table}
        ORDER BY ordinal_position`;
      const actual = rows.map(r => `${r.column_name}|${r.data_type}|${r.is_nullable}`);
      const expected = columns.map(c => `${c.name}|${c.type}|${c.nullable ? "YES" : "NO"}`);
      expect(actual, `column mismatch on ${table}`).toEqual(expected);
    }
  });

  it("contains only CREATE statements — pure forward creation, no ALTER of anything", () => {
    const statements = runnerStatements(migrationSql);
    expect(statements.length).toBeGreaterThan(20);
    for (const statement of statements) {
      expect(statement.startsWith("CREATE "), `unexpected statement shape: ${statement.slice(0, 80)}`).toBe(
        true,
      );
    }
  });

  it("never mentions any legacy table created by migrations 0001-0017", () => {
    const legacyNames = readdirSync(migrationsDir)
      .filter(name => name.endsWith(".sql") && name < "0018")
      .flatMap(name =>
        [...readFileSync(path.join(migrationsDir, name), "utf8").matchAll(/CREATE TABLE (\w+)/g)].map(
          m => m[1],
        ),
      );
    expect(legacyNames.length).toBeGreaterThan(30);
    for (const legacy of legacyNames) {
      expect(new RegExp(`\\b${legacy}\\b`).test(migrationSql), `legacy table mentioned: ${legacy}`).toBe(
        false,
      );
    }
  });
});

describe("M2.1 §3 enumerated constraints reject bad rows at the database level", () => {
  it("enforces the project uniqueness and non-empty name", async () => {
    await seedGraph();
    await expect(
      client.unsafe(
        `INSERT INTO project (id, name, owner_account_id, created_at)
         VALUES ('66666666-6666-4666-8666-666666666666', 'مشروع ثانٍ', 'm21-owner', now())`,
      ),
    ).rejects.toThrow(/manage_v2_project_owner_unique/);
    await expect(
      client.unsafe(
        `INSERT INTO project (id, name, owner_account_id, created_at)
         VALUES ('66666666-6666-4666-8666-666666666667', '   ', 'm21-other', now())`,
      ),
    ).rejects.toThrow(/manage_v2_project_name_nonempty/);
  });

  it("enforces the box enumerations and the one-box-per-kind uniqueness", async () => {
    await seedGraph();
    await expect(
      client.unsafe(
        `INSERT INTO box (id, project_id, kind, status, opening_status, created_on, created_at)
         VALUES ('77777777-7777-4777-8777-777777777777', '${PROJECT}', 'wallet', 'active', 'known', '2026-11-01', now())`,
      ),
    ).rejects.toThrow(/manage_v2_box_kind_check/);
    await expect(
      client.unsafe(
        `INSERT INTO box (id, project_id, kind, status, opening_status, created_on, created_at)
         VALUES ('77777777-7777-4777-8777-777777777778', '${PROJECT}', 'cash', 'active', 'maybe', '2026-11-01', now())`,
      ),
    ).rejects.toThrow(/manage_v2_box_opening_status_check/);
    await expect(
      client.unsafe(
        `INSERT INTO box (id, project_id, kind, status, opening_status, created_on, created_at)
         VALUES ('77777777-7777-4777-8777-777777777779', '${PROJECT}', 'cash', 'active', 'known', '2026-11-01', now())`,
      ),
    ).rejects.toThrow(/manage_v2_box_project_kind_unique/);
  });

  it("enforces the money, quantity, and price rules of §3.3-§3.5", async () => {
    await seedGraph();
    await expect(
      client.unsafe(
        `INSERT INTO product (id, project_id, name, unit_price_minor, archived, created_at)
         VALUES ('88888888-8888-4888-8888-888888888888', '${PROJECT}', 'منتج سالب', -1, false, now())`,
      ),
    ).rejects.toThrow(/manage_v2_product_unit_price_nonneg/);
    await expect(
      client.unsafe(
        `INSERT INTO product_component (id, project_id, product_id, name, cost_minor, position)
         VALUES ('88888888-8888-4888-8888-888888888889', '${PROJECT}', '88888888-8888-4888-8888-888888888888', 'مكوّن', -1, 1)`,
      ),
    ).rejects.toThrow(/manage_v2_product_component_cost_nonneg/);
    // A VALID sale first (final price NULL): the sale_line probe must fail on its
    // own quantity rule, never on a missing parent.
    await client.unsafe(
      `INSERT INTO sale (id, project_id, registered_on, planned_delivery_on, tracked, created_at)
       VALUES ('99999999-9999-4999-8999-999999999998', '${PROJECT}', '2026-11-01', '2026-11-05', false, now())`,
    );
    await expect(
      client.unsafe(
        `INSERT INTO sale (id, project_id, registered_on, planned_delivery_on, final_price_minor, tracked, created_at)
         VALUES ('99999999-9999-4999-8999-999999999999', '${PROJECT}', '2026-11-01', '2026-11-05', 0, false, now())`,
      ),
    ).rejects.toThrow(/manage_v2_sale_final_price_positive/);
    await expect(
      client.unsafe(
        `INSERT INTO sale_line (id, project_id, sale_id, position, description, quantity_milli)
         VALUES ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', '${PROJECT}', '99999999-9999-4999-8999-999999999998', 1, 'سطر', 0)`,
      ),
    ).rejects.toThrow(/manage_v2_sale_line_quantity_positive/);
  });

  it("enforces the balance_line direction/kind mapping and counterparty rules", async () => {
    await seedGraph();
    await expect(
      client.unsafe(
        `INSERT INTO balance_line (id, project_id, direction, kind, counterparty_name, origin_on, origin_operation_id)
         VALUES ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', '${PROJECT}', 'to_me', 'supplier', 'مورّد', '2026-11-01', '${OPERATION}')`,
      ),
    ).rejects.toThrow(/manage_v2_balance_direction_kind_check/);
    await expect(
      client.unsafe(
        `INSERT INTO balance_line (id, project_id, direction, kind, counterparty_name, origin_on, origin_operation_id)
         VALUES ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbc', '${PROJECT}', 'to_me', 'prior_receivable', NULL, '2026-11-01', '${OPERATION}')`,
      ),
    ).rejects.toThrow(/manage_v2_balance_counterparty_check/);
  });

  it("enforces the operation kind and status enumerations", async () => {
    await seedGraph();
    await expect(
      client.unsafe(
        `INSERT INTO operation (id, project_id, kind, effective_on, status, created_by_account_id, created_at)
         VALUES ('cccccccc-cccc-4ccc-8ccc-cccccccccccc', '${PROJECT}', 'OP-NOPE', '2026-11-01', 'active', 'm21-owner', now())`,
      ),
    ).rejects.toThrow(/manage_v2_operation_kind_check/);
    await expect(
      client.unsafe(
        `INSERT INTO operation (id, project_id, kind, effective_on, status, created_by_account_id, created_at)
         VALUES ('cccccccc-cccc-4ccc-8ccc-cccccccccccd', '${PROJECT}', 'OP-SETUP', '2026-11-01', 'paused', 'm21-owner', now())`,
      ),
    ).rejects.toThrow(/manage_v2_operation_status_check/);
  });

  it("enforces the entry type enumeration and the Q20-only reversal rule", async () => {
    await seedGraph();
    await expect(
      client.unsafe(
        `INSERT INTO ledger_entry (id, project_id, operation_id, entry_type, effective_on, created_at)
         VALUES ('dddddddd-dddd-4ddd-8ddd-dddddddddddd', '${PROJECT}', '${OPERATION}', 'Q21', '2026-11-01', now())`,
      ),
    ).rejects.toThrow(/manage_v2_entry_type_check/);
    await expect(
      client.unsafe(
        `INSERT INTO ledger_entry (id, project_id, operation_id, entry_type, effective_on, reverses_entry_id, created_at)
         VALUES ('dddddddd-dddd-4ddd-8ddd-dddddddddddE', '${PROJECT}', '${OPERATION}', 'Q1', '2026-11-01', '${ENTRY}', now())`,
      ),
    ).rejects.toThrow(/manage_v2_entry_reversal_q20_check/);
  });

  it("enforces the posting account enumeration, non-zero delta, and account-scoped fields", async () => {
    await seedGraph();
    await expect(
      client.unsafe(
        `INSERT INTO ledger_posting (id, project_id, entry_id, account, ref_id, delta_minor)
         VALUES ('eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee', '${PROJECT}', '${ENTRY}', 'NOPE', '${BOX}', 100)`,
      ),
    ).rejects.toThrow(/manage_v2_posting_account_check/);
    await expect(
      client.unsafe(
        `INSERT INTO ledger_posting (id, project_id, entry_id, account, ref_id, delta_minor)
         VALUES ('eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeef', '${PROJECT}', '${ENTRY}', 'BOX', '${BOX}', 0)`,
      ),
    ).rejects.toThrow(/manage_v2_posting_delta_nonzero/);
    await expect(
      client.unsafe(
        `INSERT INTO ledger_posting (id, project_id, entry_id, account, category, delta_minor)
         VALUES ('eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee0', '${PROJECT}', '${ENTRY}', 'EXP', NULL, 100)`,
      ),
    ).rejects.toThrow(/manage_v2_posting_category_exp_check/);
    await expect(
      client.unsafe(
        `INSERT INTO ledger_posting (id, project_id, entry_id, account, category, delta_minor)
         VALUES ('eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee1', '${PROJECT}', '${ENTRY}', 'BOX', 'food', 100)`,
      ),
    ).rejects.toThrow(/manage_v2_posting_category_exp_check/);
    await expect(
      client.unsafe(
        `INSERT INTO ledger_posting (id, project_id, entry_id, account, rev_kind, delta_minor)
         VALUES ('eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee2', '${PROJECT}', '${ENTRY}', 'REV', NULL, 100)`,
      ),
    ).rejects.toThrow(/manage_v2_posting_rev_kind_rev_check/);
    await expect(
      client.unsafe(
        `INSERT INTO ledger_posting (id, project_id, entry_id, account, ref_id, delta_minor)
         VALUES ('eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee3', '${PROJECT}', '${ENTRY}', 'BOX', NULL, 100)`,
      ),
    ).rejects.toThrow(/manage_v2_posting_ref_id_check/);
    await expect(
      client.unsafe(
        `INSERT INTO ledger_posting (id, project_id, entry_id, account, ref_id, delta_minor)
         VALUES ('eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee4', '${PROJECT}', '${ENTRY}', 'OPEN', '${BOX}', 100)`,
      ),
    ).rejects.toThrow(/manage_v2_posting_ref_id_check/);
  });

  it("accepts the §4-legal positive shapes (REV posting may carry a NULL ref)", async () => {
    await seedGraph();
    const added = await client.unsafe(
      `INSERT INTO ledger_posting (id, project_id, entry_id, account, ref_id, rev_kind, delta_minor)
       VALUES ('eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee5', '${PROJECT}', '${ENTRY}', 'REV', NULL, 'delivery', 100)
       RETURNING id`,
    );
    expect(added.length).toBe(1);
  });
});

describe("M2.1 append-only enforcement at the database level (§3.8)", () => {
  it("rejects UPDATE and DELETE on ledger_entry with the append-only notice", async () => {
    await seedGraph();
    await expect(
      client.unsafe(`UPDATE ledger_entry SET effective_on = '2026-11-02' WHERE id = '${ENTRY}'`),
    ).rejects.toThrow(/append-only/);
    await expect(client.unsafe(`DELETE FROM ledger_entry WHERE id = '${ENTRY}'`)).rejects.toThrow(
      /append-only/,
    );
  });

  it("rejects UPDATE and DELETE on ledger_posting with the append-only notice", async () => {
    await seedGraph();
    await expect(
      client.unsafe(`UPDATE ledger_posting SET delta_minor = 5 WHERE id = '${POSTING_BOX}'`),
    ).rejects.toThrow(/append-only/);
    await expect(client.unsafe(`DELETE FROM ledger_posting WHERE id = '${POSTING_BOX}'`)).rejects.toThrow(
      /append-only/,
    );
  });

  it("still allows INSERT (the append path) and an UPDATE matching zero rows", async () => {
    await seedGraph();
    const added = await client.unsafe(
      `INSERT INTO ledger_posting (id, project_id, entry_id, account, ref_id, delta_minor)
       VALUES ('ffffffff-ffff-4fff-8fff-ffffffffffff', '${PROJECT}', '${ENTRY}', 'BOX', '${BOX}', 250)
       RETURNING id`,
    );
    expect(added.length).toBe(1);
    const untouched = await client.unsafe(
      `UPDATE ledger_entry SET effective_on = '2026-11-02' WHERE id = '99999999-9999-4999-8999-999999999999'`,
    );
    expect(untouched.count).toBe(0);
  });

  it("keeps TRUNCATE working (the harness reset path) and enforcement intact after it", async () => {
    await seedGraph();
    await client.unsafe(
      "TRUNCATE TABLE ledger_posting, ledger_entry, balance_line, sale_line, sale, operation, reconciliation_box, reconciliation, absence_event, product_component, product, box, project RESTART IDENTITY",
    );
    await seedGraph();
    await expect(
      client.unsafe(`UPDATE ledger_entry SET effective_on = '2026-11-02' WHERE id = '${ENTRY}'`),
    ).rejects.toThrow(/append-only/);
  });
});

describe("M2.1 idempotency under both repository migration runners", () => {
  it("re-applies 0018 through the harness split with no failing statement", async () => {
    for (const statement of runnerStatements(migrationSql)) {
      await client.unsafe(statement);
    }
  });

  it("re-applies 0018 as a single whole-file call (rtl-review-server form)", async () => {
    await client.unsafe(migrationSql);
  });
});
