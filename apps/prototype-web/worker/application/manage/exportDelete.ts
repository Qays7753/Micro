/**
 * M2.12 (Manage v2 phase 2, wave J — spec §14.6, SRV-07): the §14.6 data
 * deletion hook + the v2 export envelope over the NEW §3 tables.
 *
 * THE ONLY PATH ALLOWED TO DELETE LEDGER ROWS (§14.6): the M2.1 migration
 * armed append-only TRIGGERS on ledger_entry/ledger_posting that reject
 * UPDATE and DELETE for every role, and its header documented this exact
 * forward path: the deletion disables the two guards INSIDE its single
 * transaction and re-ARMS them before commit. Nothing else may do so; a
 * failure anywhere rolls the whole transaction back — the DDL included —
 * so the guards can never stay disarmed and a project can never be deleted
 * halfway.
 *
 * The export runs under a locked read (FOR SHARE on the project row): one
 * consistent snapshot, every table's rows ordered by id for a deterministic
 * serialization, and a DATA-ONLY SHA-256 digest (the export timestamp sits
 * outside it, so the same state always digests identically — the deletion
 * requires that digest, which is the export-first rule without a new table:
 * you cannot delete what you have not just exported).
 *
 * The deletion: FOR UPDATE on the project row (two concurrent deletes —
 * exactly one wins; the loser gets the documented project_already_deleted),
 * then every Manage table in FK order — entries and postings included —
 * then the project row itself. Zero orphans by construction.
 */
import type postgres from "postgres";

export const MANAGE_EXPORT_FORMAT = "micro-manage-export";
export const MANAGE_EXPORT_VERSION = 2;

/** The §3 tables in the envelope (a stable, documented family order). */
const MANAGE_DATA_TABLES = [
  "box",
  "product",
  "product_component",
  "sale",
  "sale_line",
  "balance_line",
  "operation",
  "ledger_entry",
  "ledger_posting",
  "absence_event",
  "reconciliation",
  "reconciliation_box",
  "manage_v2_idempotency",
] as const;

/** The two append-only guards by name (M2.1's migration). */
const APPEND_ONLY_TRIGGERS = [
  { table: "ledger_entry", trigger: "manage_ledger_entry_append_only" },
  { table: "ledger_posting", trigger: "manage_ledger_posting_append_only" },
] as const;

/** The deletion order — FK-SAFE, every child before the row it references
 * (0018's FK graph: reconciliation_box → reconciliation + box;
 * ledger_posting → ledger_entry → operation; balance_line → operation;
 * sale_line → sale; product_component → product; and every table →
 * project). The project row itself goes last. The columns §3 does NOT
 * mark with FK (operation.box_id/sale_id/balance_line_id/…, sale_line.
 * product_id, balance_line.sale_id, ledger_entry.reverses_entry_id,
 * ledger_posting.ref_id) are plain references with no constraint, so they
 * impose no order. */
const MANAGE_DELETE_ORDER = [
  "reconciliation_box",
  "ledger_posting",
  "ledger_entry",
  "balance_line",
  "sale_line",
  "absence_event",
  "reconciliation",
  "manage_v2_idempotency",
  "operation",
  "sale",
  "product_component",
  "product",
  "box",
  "project",
] as const;

export interface ManageExportEnvelope {
  format: typeof MANAGE_EXPORT_FORMAT;
  version: typeof MANAGE_EXPORT_VERSION;
  exportedAt: string;
  /** SHA-256 of the canonical data serialization (no timestamp in it). */
  digest: string;
  project: Record<string, unknown>;
  boxes: Array<Record<string, unknown>>;
  products: Array<Record<string, unknown>>;
  productComponents: Array<Record<string, unknown>>;
  sales: Array<Record<string, unknown>>;
  saleLines: Array<Record<string, unknown>>;
  balanceLines: Array<Record<string, unknown>>;
  operations: Array<Record<string, unknown>>;
  entries: Array<Record<string, unknown>>;
  postings: Array<Record<string, unknown>>;
  absences: Array<Record<string, unknown>>;
  reconciliations: Array<Record<string, unknown>>;
  reconciliationBoxes: Array<Record<string, unknown>>;
  idempotency: Array<Record<string, unknown>>;
}

/** The envelope's family key per table (camelCase plural). */
const FAMILY_KEYS: Record<(typeof MANAGE_DATA_TABLES)[number], keyof ManageExportEnvelope> = {
  box: "boxes",
  product: "products",
  product_component: "productComponents",
  sale: "sales",
  sale_line: "saleLines",
  balance_line: "balanceLines",
  operation: "operations",
  ledger_entry: "entries",
  ledger_posting: "postings",
  absence_event: "absences",
  reconciliation: "reconciliations",
  reconciliation_box: "reconciliationBoxes",
  manage_v2_idempotency: "idempotency",
};

/** SHA-256 hex of a UTF-8 serialization. */
async function sha256Hex(text: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return Array.from(new Uint8Array(digest))
    .map(byte => byte.toString(16).padStart(2, "0"))
    .join("");
}

/** The stable row order per table for the export serialization: the §3 PK
 * (every table has `id` EXCEPT reconciliation_box — §3.10 gives it the
 * composite natural key (reconciliation_id, box_id) — and
 * manage_v2_idempotency — its PK is (project_id, request_id), and the
 * export is scoped to ONE project, so request_id alone is a total order). */
const ORDER_BY: Record<string, string> = {
  ledger_entry: "id",
  ledger_posting: "id",
  reconciliation_box: "reconciliation_id, box_id",
  manage_v2_idempotency: "request_id",
};

/** One consistent read of every §3 table's rows for the project — the
 * shared body of the export snapshot and the in-transaction digest check
 * (same serialization, same order, so the digests are comparable). */
async function readProjectSnapshot(
  tx: postgres.TransactionSql,
  projectId: string,
): Promise<Record<string, Array<Record<string, unknown>>>> {
  const families: Record<string, Array<Record<string, unknown>>> = {};
  for (const table of MANAGE_DATA_TABLES) {
    const order = ORDER_BY[table] ?? "id";
    const rows = (await tx.unsafe(`SELECT * FROM ${table} WHERE project_id = $1 ORDER BY ${order}`, [
      projectId,
    ])) as Array<Record<string, unknown>>;
    families[table] = rows;
  }
  return families;
}

/** The DATA-ONLY digest of a snapshot (deterministic order, no timestamp):
 * the same state always digests identically — the export-first rule and the
 * in-transaction deletion check both compare THIS value. */
async function digestSnapshot(
  project: Record<string, unknown>,
  families: Record<string, Array<Record<string, unknown>>>,
): Promise<string> {
  return sha256Hex(JSON.stringify({ project, families }));
}

/**
 * Export one Manage project as the v2 envelope — ONE locked read
 * transaction (FOR SHARE on the project row blocks a concurrent deletion;
 * the reads all see the same snapshot).
 */
export async function exportManageProject(
  sql: postgres.Sql,
  projectId: string,
): Promise<{ envelope: ManageExportEnvelope; digest: string }> {
  return sql.begin(async tx => {
    const locked = await tx`SELECT * FROM project WHERE id = ${projectId} FOR SHARE`;
    const project = locked[0] as Record<string, unknown> | undefined;
    if (project === undefined) {
      throw new Error("not_found: no such manage project");
    }
    const families = await readProjectSnapshot(tx, projectId);
    const exportedAt = new Date().toISOString();
    const digest = await digestSnapshot(project, families);
    const envelope = {
      format: MANAGE_EXPORT_FORMAT,
      version: MANAGE_EXPORT_VERSION,
      exportedAt,
      digest,
      project,
      boxes: families.box!,
      products: families.product!,
      productComponents: families.product_component!,
      sales: families.sale!,
      saleLines: families.sale_line!,
      balanceLines: families.balance_line!,
      operations: families.operation!,
      entries: families.ledger_entry!,
      postings: families.ledger_posting!,
      absences: families.absence_event!,
      reconciliations: families.reconciliation!,
      reconciliationBoxes: families.reconciliation_box!,
      idempotency: families.manage_v2_idempotency!,
    } as ManageExportEnvelope;
    return { envelope, digest };
  });
}

/** The deletion's per-table counts (the honest report of what went). */
export interface ManageDeleteResult {
  deleted: Record<string, number>;
}

/** The M2.4-pattern test hook (prove the deletion never lands halfway), and
 * the export-first digest the app-level lifecycle surface passes: when
 * `expectedDigest` is present it is checked INSIDE the deletion transaction
 * (under the FOR UPDATE lock — SRV-07's lock-inside-the-transaction rule),
 * so a write that lands between the caller's export and this call makes the
 * digest mismatch and the deletion refuses: nothing is deleted that the
 * owner did not see and confirm. */
export interface ManageDeleteOptions {
  expectedDigest?: string;
  injectFailureAfterFirstTable?: boolean;
}

/**
 * Delete ALL data of one Manage project (§14.6) — the only path allowed to
 * delete ledger rows. ONE transaction: lock the project row FOR UPDATE
 * (a concurrent deletion loses and gets project_already_deleted), disable
 * the two append-only guards, delete every Manage table in FK order
 * (children first, entries and postings included, the project row last),
 * re-arm the guards, commit. Any failure rolls back everything — the DDL
 * included — so the guards stay armed and nothing is half-deleted.
 */
export async function deleteManageProject(
  sql: postgres.Sql,
  projectId: string,
  options: ManageDeleteOptions = {},
): Promise<ManageDeleteResult> {
  return sql.begin(async tx => {
    const locked = await tx`SELECT * FROM project WHERE id = ${projectId} FOR UPDATE`;
    const project = locked[0] as Record<string, unknown> | undefined;
    if (project === undefined) {
      throw new Error("project_already_deleted: no such manage project");
    }
    // SRV-07: the export-first check runs UNDER the row lock, inside this
    // transaction — the state the digest describes is the exact state the
    // transaction deletes (no gap between check and delete).
    if (options.expectedDigest !== undefined) {
      const families = await readProjectSnapshot(tx, projectId);
      const digest = await digestSnapshot(project, families);
      if (digest !== options.expectedDigest) {
        throw new Error(
          "export_digest_mismatch: the project changed since the exported digest — export again, then delete",
        );
      }
    }
    // The one internal path allowed past the append-only guards (§14.6 +
    // the M2.1-documented forward path) — disarmed inside this transaction
    // only, re-armed before the commit.
    for (const guard of APPEND_ONLY_TRIGGERS) {
      await tx.unsafe(`ALTER TABLE ${guard.table} DISABLE TRIGGER ${guard.trigger}`);
    }
    const deleted: Record<string, number> = {};
    // Children first (the FK-safe order above); the project row last.
    for (const table of MANAGE_DELETE_ORDER) {
      const result =
        table === "project"
          ? await tx`DELETE FROM project WHERE id = ${projectId}`
          : await tx.unsafe(`DELETE FROM ${table} WHERE project_id = $1`, [projectId]);
      deleted[table] = result.count;
      if (options.injectFailureAfterFirstTable === true) {
        throw new Error("M2.12 injected failure after the first table — the deletion must roll back");
      }
    }
    for (const guard of APPEND_ONLY_TRIGGERS) {
      await tx.unsafe(`ALTER TABLE ${guard.table} ENABLE TRIGGER ${guard.trigger}`);
    }
    return { deleted };
  });
}
