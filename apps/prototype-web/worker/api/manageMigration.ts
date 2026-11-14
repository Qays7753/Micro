/**
 * Manage Online migration path (EX-D23, wave M5) — export→PostgreSQL, tested
 * with SYNTHETIC fixtures only. Never executed against the shared Neon
 * project by Z AI; the local export remains the recovery source — the server
 * copy is derived, never primary.
 *
 * Verification chain (the local chain's server-side mirror, without ever
 * naming the local format in the worker — the format check runs in the
 * client before upload; the server re-verifies everything cryptographically
 * meaningful):
 *  1. live version pair only (older exports are refused with an honest
 *     re-export message — legacy pairs stay the LOCAL import chain's concern);
 *  2. integrity: the sha256 digest over the serialized data is recomputed and
 *     must match (tampered files never apply);
 *  3. counts: every count entry must equal its family's array length;
 *  4. structure: every array-family record must carry a non-empty string id,
 *     singleton families (object or null) become one record;
 *  5. the double proof completes §2-b: the proof secret presented WITH the
 *     export must hash to the value registered at link time.
 *
 * Idempotent recovery: the same export (same fingerprint = same integrity
 * digest) re-apply returns the ORIGINAL receipt with no second effect. A
 * different export while one is applied is an honest 409 — roll back first.
 * Rollback clears the workspace's connected manage store entirely and the
 * local export stays the recovery path.
 */
import { audit } from "../audit.ts";
import { rowString, type Db, type DbPreparedStatement } from "../db/db.ts";
import { HttpError, jsonResponse } from "../http.ts";
import { sha256Hex } from "../crypto.ts";
import type { AuthenticatedContext } from "../auth/session.ts";
import type { RouteContext } from "../router.ts";
import { requireManageOwnerAudited } from "./manageReads.ts";

/** The live released pair values (mirrored as plain numbers — the worker
 * never names the local constants; the client owns the format knowledge). */
const LIVE_SCHEMA_VERSION = 41;
const LIVE_EXPORT_VERSION = 34;
/** Same order as the local verification bound (2^24 UTF-16 units). */
const DATA_TEXT_MAX = 2 ** 24;
/** Sanity bound on the total record count of one migration. */
const TOTAL_RECORDS_MAX = 50_000;
const RECORD_ID_MAX = 128;
const SINGLETON_RECORD_ID = "__single__";
const FAMILY_PATTERN = /^[a-z][a-z0-9-]{0,63}$/;

interface ParsedMigration {
  fingerprint: string;
  totalRecords: number;
  familyCounts: Record<string, number>;
  contentChecksum: string;
  records: { family: string; id: string; dataJson: string }[];
  schemaVersion: number;
  exportVersion: number;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

/** Validate + canonicalize the envelope into ready statements. Throws honest errors. */
async function parseMigrationEnvelope(raw: unknown): Promise<ParsedMigration> {
  const envelope = asRecord(raw);
  if (envelope === null) throw new HttpError(400, "bad_request", { field: "envelope" });
  if (envelope.version !== LIVE_EXPORT_VERSION || envelope.schemaVersion !== LIVE_SCHEMA_VERSION) {
    throw new HttpError(400, "bad_request", {
      field: "version",
      reason: "migration_requires_live_pair",
    });
  }
  if (typeof envelope.exportedAt !== "string" || envelope.exportedAt.length === 0) {
    throw new HttpError(400, "bad_request", { field: "exportedAt" });
  }
  const data = asRecord(envelope.data);
  if (data === null) throw new HttpError(400, "bad_request", { field: "data" });
  const dataText = JSON.stringify(data);
  if (dataText === null || dataText.length > DATA_TEXT_MAX) {
    throw new HttpError(400, "bad_request", { field: "data", reason: "export_too_large" });
  }
  const integrity = asRecord(envelope.integrity);
  if (
    integrity === null ||
    integrity.algorithm !== "sha256" ||
    typeof integrity.digest !== "string" ||
    integrity.digest.length !== 64
  ) {
    throw new HttpError(400, "bad_request", { field: "integrity", reason: "integrity_block_invalid" });
  }
  const fingerprint = await sha256Hex(dataText);
  if (fingerprint !== integrity.digest) {
    throw new HttpError(400, "bad_request", { field: "integrity", reason: "integrity_digest_mismatch" });
  }
  const counts = asRecord(envelope.counts);
  if (counts === null) {
    // The current-pair rule (AV-04 mirror): a current export always carries
    // counts — their absence is tampering, not an old file.
    throw new HttpError(400, "bad_request", { field: "counts", reason: "counts_missing" });
  }
  for (const [family, count] of Object.entries(counts)) {
    if (!FAMILY_PATTERN.test(family) || typeof count !== "number" || !Number.isInteger(count) || count < 0) {
      throw new HttpError(400, "bad_request", { field: "counts" });
    }
    const value = data[family];
    if (!Array.isArray(value) || value.length !== count) {
      throw new HttpError(400, "bad_request", { field: "counts", reason: "counts_mismatch" });
    }
  }
  const records: ParsedMigration["records"] = [];
  const familyCounts: Record<string, number> = {};
  for (const [family, value] of Object.entries(data)) {
    if (!FAMILY_PATTERN.test(family)) {
      throw new HttpError(400, "bad_request", { field: "data", reason: "family_name_invalid" });
    }
    if (Array.isArray(value)) {
      familyCounts[family] = value.length;
      for (const entry of value) {
        const record = asRecord(entry);
        const id = record === null ? undefined : record["id"];
        if (record === null || typeof id !== "string" || id.length === 0 || id.length > RECORD_ID_MAX) {
          throw new HttpError(400, "bad_request", { field: "data", reason: "record_id_invalid" });
        }
        records.push({ family, id, dataJson: JSON.stringify(entry) });
      }
    } else {
      // Singleton family (object or null) — exactly one record.
      familyCounts[family] = 1;
      records.push({ family, id: SINGLETON_RECORD_ID, dataJson: JSON.stringify(value) });
    }
  }
  if (records.length > TOTAL_RECORDS_MAX) {
    throw new HttpError(400, "bad_request", { field: "data", reason: "too_many_records" });
  }
  // Content checksum over the canonical (family, id, record) ordering — the
  // receipt's exact-value evidence, recomputable from the database.
  const canonical = records
    .map(r => `${r.family}\u0000${r.id}\u0000${r.dataJson}`)
    .sort()
    .join("\u0001");
  const contentChecksum = await sha256Hex(canonical);
  return {
    fingerprint,
    totalRecords: records.length,
    familyCounts,
    contentChecksum,
    records,
    schemaVersion: LIVE_SCHEMA_VERSION,
    exportVersion: LIVE_EXPORT_VERSION,
  };
}

interface MigrationReceipt {
  applied: true;
  fingerprint: string;
  totalRecords: number;
  familyCounts: Record<string, number>;
  contentChecksum: string;
  appliedAt: number;
}

/** POST /api/manage/migrate/apply — idempotent, transactional, double-proof. */
export async function applyMigration(ctx: RouteContext, auth: AuthenticatedContext): Promise<Response> {
  const db = ctx.env.DB;
  const owner = await requireManageOwnerAudited(db, auth, "manage.migrate.apply");
  const body = (await ctx.request.json()) as { envelope?: unknown; proofSecret?: unknown };
  if (typeof body.proofSecret !== "string" || body.proofSecret.length === 0) {
    throw new HttpError(400, "bad_request", { field: "proofSecret" });
  }
  // §2-b double proof: the secret presented WITH the export must hash to the
  // value registered at link time — possession of both legs, never email.
  const link = await db
    .prepare(
      "SELECT proof_hash FROM manage_owner_link WHERE workspace_id = ? AND identity_id = ? AND status = 'linked'",
    )
    .bind(owner.workspaceId, auth.identityId)
    .first<Record<string, unknown>>();
  if (link === null || (await sha256Hex(body.proofSecret)) !== rowString(link, "proof_hash")) {
    throw new HttpError(403, "manage_proof_invalid", { reason: "proof_does_not_match_link" });
  }
  const parsed = await parseMigrationEnvelope(body.envelope);

  // Idempotent recovery: the same export re-applied returns the original receipt.
  const existing = await db
    .prepare(
      "SELECT status, total_records, family_counts_json, content_checksum, applied_at FROM manage_migration WHERE workspace_id = ? AND export_fingerprint = ?",
    )
    .bind(owner.workspaceId, parsed.fingerprint)
    .first<Record<string, unknown>>();
  if (existing !== null && String(existing.status) === "applied") {
    const receipt: MigrationReceipt = {
      applied: true,
      fingerprint: parsed.fingerprint,
      totalRecords: Number(existing.total_records),
      familyCounts: JSON.parse(rowString(existing, "family_counts_json")) as Record<string, number>,
      contentChecksum: rowString(existing, "content_checksum"),
      appliedAt: Number(existing.applied_at),
    };
    return jsonResponse({ ...receipt, replayed: true });
  }
  // A different export while one is applied: the explicit rollback boundary.
  const activeOther = await db
    .prepare("SELECT export_fingerprint FROM manage_migration WHERE workspace_id = ? AND status = 'applied'")
    .bind(owner.workspaceId)
    .first<Record<string, unknown>>();
  if (activeOther !== null) {
    throw new HttpError(409, "conflict", {
      reason: "migration_already_applied_rollback_first",
      fingerprint: rowString(activeOther, "export_fingerprint"),
    });
  }

  const now = Date.now();
  const statements: DbPreparedStatement[] = [];
  // The migration replaces the workspace's connected store in ONE transaction:
  // clear, insert every record, in-transaction count assertion, then receipt.
  statements.push(db.prepare("DELETE FROM manage_record WHERE workspace_id = ?").bind(owner.workspaceId));
  for (const record of parsed.records) {
    statements.push(
      db
        .prepare(
          "INSERT INTO manage_record (workspace_id, family, record_id, data_json, updated_at) VALUES (?, ?, ?, ?, ?)",
        )
        .bind(owner.workspaceId, record.family, record.id, record.dataJson, now),
    );
  }
  // In-transaction assertion: if the inserted count does not equal the parsed
  // count the division raises and the WHOLE transaction rolls back — no
  // partial migration can ever commit.
  statements.push(
    db
      .prepare(
        "SELECT 1 / CAST(CASE WHEN (SELECT COUNT(*) FROM manage_record WHERE workspace_id = ?) = ?::bigint THEN 1 ELSE 0 END AS int) AS asserted",
      )
      .bind(owner.workspaceId, parsed.totalRecords),
  );
  statements.push(
    db
      .prepare(
        "INSERT INTO manage_migration (workspace_id, export_fingerprint, status, schema_version, export_version, family_counts_json, total_records, content_checksum, applied_at, applied_by_identity_id) " +
          "VALUES (?, ?, 'applied', ?, ?, ?, ?, ?, ?, ?) " +
          "ON CONFLICT(workspace_id, export_fingerprint) DO UPDATE SET status = 'applied', rolled_back_at = NULL, schema_version = excluded.schema_version, export_version = excluded.export_version, family_counts_json = excluded.family_counts_json, total_records = excluded.total_records, content_checksum = excluded.content_checksum, applied_at = excluded.applied_at, applied_by_identity_id = excluded.applied_by_identity_id",
      )
      .bind(
        owner.workspaceId,
        parsed.fingerprint,
        parsed.schemaVersion,
        parsed.exportVersion,
        JSON.stringify(parsed.familyCounts),
        parsed.totalRecords,
        parsed.contentChecksum,
        now,
        auth.identityId,
      ),
  );
  await db.batch(statements);
  await audit(
    db,
    {
      actorIdentityId: auth.identityId,
      action: "manage.migrate.apply",
      objectType: "manage_migration",
      objectId: owner.workspaceId,
      result: "success",
      meta: { reason: "synthetic_or_operator_gated", totalRecords: parsed.totalRecords },
    },
    now,
  );
  const receipt: MigrationReceipt = {
    applied: true,
    fingerprint: parsed.fingerprint,
    totalRecords: parsed.totalRecords,
    familyCounts: parsed.familyCounts,
    contentChecksum: parsed.contentChecksum,
    appliedAt: now,
  };
  return jsonResponse({ ...receipt, replayed: false });
}

/** GET /api/manage/migrate/status — the workspace's migration ledger. */
export async function migrationStatus(db: Db, auth: AuthenticatedContext): Promise<Response> {
  const owner = await requireManageOwnerAudited(db, auth, "manage.read.migration");
  const rows = await db
    .prepare(
      "SELECT export_fingerprint, status, total_records, content_checksum, applied_at, rolled_back_at FROM manage_migration WHERE workspace_id = ? ORDER BY applied_at DESC",
    )
    .bind(owner.workspaceId)
    .all<Record<string, unknown>>();
  const migrations = rows.results.map(row => ({
    fingerprint: rowString(row, "export_fingerprint"),
    status: String(row.status),
    totalRecords: Number(row.total_records),
    contentChecksum: rowString(row, "content_checksum"),
    appliedAt: Number(row.applied_at),
    rolledBackAt: row.rolled_back_at === null ? null : Number(row.rolled_back_at),
  }));
  return jsonResponse({ workspaceId: owner.workspaceId, migrations });
}

/** POST /api/manage/migrate/rollback — full rollback; the local export stays the recovery source. */
export async function rollbackMigration(ctx: RouteContext, auth: AuthenticatedContext): Promise<Response> {
  const db = ctx.env.DB;
  const owner = await requireManageOwnerAudited(db, auth, "manage.migrate.rollback");
  const body = (await ctx.request.json()) as { fingerprint?: unknown };
  if (typeof body.fingerprint !== "string" || body.fingerprint.length !== 64) {
    throw new HttpError(400, "bad_request", { field: "fingerprint" });
  }
  const existing = await db
    .prepare("SELECT status FROM manage_migration WHERE workspace_id = ? AND export_fingerprint = ?")
    .bind(owner.workspaceId, body.fingerprint)
    .first<Record<string, unknown>>();
  if (existing === null || String(existing.status) !== "applied") {
    throw new HttpError(404, "not_found", { reason: "no_applied_migration" });
  }
  const now = Date.now();
  await db.batch([
    db.prepare("DELETE FROM manage_record WHERE workspace_id = ?").bind(owner.workspaceId),
    db
      .prepare(
        "UPDATE manage_migration SET status = 'rolled_back', rolled_back_at = ? WHERE workspace_id = ? AND export_fingerprint = ?",
      )
      .bind(now, owner.workspaceId, body.fingerprint),
  ]);
  await audit(
    db,
    {
      actorIdentityId: auth.identityId,
      action: "manage.migrate.rollback",
      objectType: "manage_migration",
      objectId: body.fingerprint,
      result: "success",
      meta: { reason: "local_export_remains_recovery_source" },
    },
    now,
  );
  return jsonResponse({ rolledBack: true, fingerprint: body.fingerprint });
}

/** Test-only export of the envelope parser (no route). */
export async function parseMigrationEnvelopeForTest(raw: unknown): Promise<ParsedMigration> {
  return parseMigrationEnvelope(raw);
}
