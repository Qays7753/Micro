/**
 * PostgreSQL adapter (EX-D20, 2026-11-13): Market/Delivery network data lives
 * on ONE PostgreSQL target reached through Cloudflare Hyperdrive. In production
 * the `DB` binding is a Hyperdrive binding carrying a `connectionString`; in
 * local tests the same shape points at an embedded PostgreSQL instance
 * (see worker/tests/harness.ts + scripts/pg-test-server.mjs).
 *
 * The adapter implements the D1-shaped `Db` seam (`prepare`/`batch`) so the
 * feature modules keep their parameterized SQL style. Placeholders `?` are
 * translated to PostgreSQL `$n` here (quote-aware), and `batch` runs inside a
 * single transaction (BEGIN…COMMIT) — PostgreSQL's native atomic surface.
 *
 * Driver: postgres.js (Unlicense) selected through its `workerd` export
 * condition (cloudflare:sockets) — the same code path runs locally under
 * real workerd via Miniflare. Affected-row counts come from the driver's
 * `Result.count` (UPDATE/DELETE/INSERT command tag), exposed as `meta.changes`.
 */

import postgres from "postgres";
import type { Db, DbMeta, DbPreparedStatement, DbRow } from "./db.ts";

/**
 * postgres.js client cache keyed by connection string — for NODE-side reuse
 * only (test harness migrations/seeding). Inside the worker each request
 * gets a FRESH client: workerd forbids reusing I/O objects (sockets) across
 * request contexts, so a cached cross-request client fails with
 * "Cannot perform I/O on behalf of a different request".
 */
const clientCache = new Map<string, postgres.Sql>();

/**
 * Epoch-ms timestamps live in BIGINT columns; PostgreSQL returns int8 as
 * strings by default — parse to Number (safe: all our int8 values are far
 * below Number.MAX_SAFE_INTEGER; money is decimal-STRING by contract 25).
 */
const BIGINT_AS_NUMBER = {
  to: 20,
  from: [20],
  parse: (value: string): number => Number(value),
  serialize: (value: number | bigint): string => String(value),
};

export function sqlClient(connectionString: string): postgres.Sql {
  let client = clientCache.get(connectionString);
  if (client === undefined) {
    client = postgres(connectionString, {
      max: 2,
      idle_timeout: 20,
      connect_timeout: 10,
      max_lifetime: 60 * 30,
      types: { bigint: BIGINT_AS_NUMBER },
    });
    clientCache.set(connectionString, client);
  }
  return client;
}

/**
 * Translate `?` positional placeholders to PostgreSQL `$n`, skipping `?`
 * inside single-quoted string literals and comments (the worker's SQL is
 * code-controlled; this keeps 273 existing bind sites unchanged).
 */
export function toNumberedPlaceholders(text: string): string {
  let out = "";
  let index = 0;
  let param = 0;
  const n = text.length;
  while (index < n) {
    const ch = text[index];
    if (ch === "'") {
      // string literal — copy until closing quote (doubled '' stays inside)
      let j = index + 1;
      while (j < n) {
        if (text[j] === "'" && text[j + 1] === "'") j += 2;
        else if (text[j] === "'") break;
        else j += 1;
      }
      out += text.slice(index, Math.min(j + 1, n));
      index = j + 1;
      continue;
    }
    if (ch === "-" && text[index + 1] === "-") {
      const end = text.indexOf("\n", index);
      const stop = end === -1 ? n : end;
      out += text.slice(index, stop);
      index = stop;
      continue;
    }
    if (ch === "/" && text[index + 1] === "*") {
      const end = text.indexOf("*/", index);
      const stop = end === -1 ? n : end + 2;
      out += text.slice(index, stop);
      index = stop;
      continue;
    }
    if (ch === "?") {
      param += 1;
      out += `$${param}`;
      index += 1;
      continue;
    }
    out += ch;
    index += 1;
  }
  return out;
}

/** A translated statement awaiting execution (internal adapter detail). */
export interface PendingStatement {
  readonly text: string;
  readonly params: unknown[];
}

class PgStatement implements DbPreparedStatement {
  constructor(
    private readonly client: postgres.Sql,
    private readonly text: string,
    private readonly params: unknown[] = [],
  ) {}

  bind(...values: unknown[]): DbPreparedStatement {
    return new PgStatement(this.client, this.text, [...this.params, ...values]);
  }

  pending(): PendingStatement {
    return { text: toNumberedPlaceholders(this.text), params: this.params };
  }

  async first<T = DbRow>(): Promise<T | null> {
    const { text, params } = this.pending();
    const rows: T[] = await this.client.unsafe(text, params as never[]);
    return rows.length > 0 ? (rows[0] as T) : null;
  }

  async all<T = DbRow>(): Promise<{ results: T[] }> {
    const { text, params } = this.pending();
    const rows: T[] = await this.client.unsafe(text, params as never[]);
    return { results: rows };
  }

  async run(): Promise<{ success: boolean; meta: DbMeta }> {
    const { text, params } = this.pending();
    const result = await this.client.unsafe(text, params as never[]);
    return { success: true, meta: metaOf(result.count) };
  }
}

function metaOf(changes: number): DbMeta {
  return {
    changes,
    duration: 0,
    last_row_id: 0,
    rows_read: 0,
    rows_written: changes,
  };
}

/** PostgreSQL-backed `Db`: same seam the D1 path exposed, now on one PG target. */
export class PgDb implements Db {
  constructor(private readonly client: postgres.Sql) {}

  prepare(query: string): DbPreparedStatement {
    return new PgStatement(this.client, query);
  }

  /** Close this Db's sockets (request-scoped clients are closed by the
   * worker entry after each dispatch — see index.ts / withDbEnv). */
  async end(): Promise<void> {
    await this.client.end({ timeout: 2 });
  }

  async batch(statements: DbPreparedStatement[]): Promise<Array<{ results: DbRow[]; meta: DbMeta }>> {
    const pending: PendingStatement[] = (statements as PgStatement[]).map(s =>
      s instanceof PgStatement ? s.pending() : { text: "", params: [] },
    );
    if (pending.some(p => p.text === "")) {
      throw new Error("batch expects statements prepared by this adapter");
    }
    const out = await this.client.begin(async tx => {
      const results: Array<{ results: DbRow[]; meta: DbMeta }> = [];
      for (const { text, params } of pending) {
        const result = await tx.unsafe(text, params as never[]);
        results.push({ results: result as unknown as DbRow[], meta: metaOf(result.count) });
      }
      return results;
    });
    return out;
  }
}
