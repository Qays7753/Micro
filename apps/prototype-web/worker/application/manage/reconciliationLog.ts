/**
 * M4.5 (Manage v2 phase 4 — spec §3.10 the reconciliation log, R-8 the
 * due rule): the reconciliation LOG read surface — the history of every
 * saved reconciliation with its per-box recorded/counted, newest first,
 * plus R-8's `due` flag computed server-side (the screens consume the
 * response as-is — no client arithmetic).
 *
 * A dedicated read module (NOT a figures-response section): the log is
 * §3.10's own surface, and this keeps the ONE §8 read module
 * (readModel.ts, WATCH) untouched — no ratchet growth.
 *
 * The per-box recorded value is what the reconciliation itself persisted
 * (M4.2): the client's at-start read for a known box, the server's own
 * pre-operation Σ postings for an unknown one (M4.4) — display history
 * either way; every financial figure stays computed from the ledger.
 */
import type postgres from "postgres";
import { reconciliationDue } from "../../../../../src/domain/manage/figures/index.js";

/** One reconciliation's log row (§3.10). */
export interface ReconciliationLogEntry {
  id: string;
  performedOn: string;
  context: string;
  boxes: Array<{ boxId: string; kind: string; recordedFils: number; countedFils: number }>;
}

/** The log surface's response. */
export interface ReconciliationLogResponse {
  /** R-8's reminder rule, computed server-side. */
  due: boolean;
  /** Newest first. */
  reconciliations: ReconciliationLogEntry[];
}

/** Read the reconciliation log + R-8's due flag. */
export async function readReconciliationLog(
  sql: postgres.Sql,
  projectId: string,
  today: string,
): Promise<ReconciliationLogResponse> {
  // §3.10's rows, newest first, with each box's kind.
  const rows = (await sql`
    SELECT r.id, r.performed_on::text AS performed_on, r.context,
           b.box_id, b.recorded_minor, b.counted_minor, k.kind
    FROM reconciliation r
    JOIN reconciliation_box b ON b.reconciliation_id = r.id AND b.project_id = r.project_id
    JOIN box k ON k.id = b.box_id AND k.project_id = r.project_id
    WHERE r.project_id = ${projectId}
    ORDER BY r.created_at DESC, r.performed_on DESC, k.kind`) as Array<{
    id: string;
    performed_on: string;
    context: string;
    box_id: string;
    recorded_minor: string | number;
    counted_minor: string | number;
    kind: string;
  }>;
  const byId = new Map<string, ReconciliationLogEntry>();
  for (const row of rows) {
    const id = String(row.id);
    let entry = byId.get(id);
    if (entry === undefined) {
      entry = {
        id,
        performedOn: String(row.performed_on),
        context: String(row.context),
        boxes: [],
      };
      byId.set(id, entry);
    }
    entry.boxes.push({
      boxId: String(row.box_id),
      kind: String(row.kind),
      recordedFils: Number(row.recorded_minor),
      countedFils: Number(row.counted_minor),
    });
  }

  // R-8's inputs: the anchor (the last reconciliation — its day AND its
  // moment — else the project's creation) and every money operation's
  // moment (≥1 BOX posting, other than the OP-SETUP that IS the
  // beginning).
  const lastReconciliation = (await sql`
    SELECT performed_on::text AS performed_on, created_at::text AS created_at
    FROM reconciliation
    WHERE project_id = ${projectId}
    ORDER BY performed_on DESC, created_at DESC
    LIMIT 1`) as Array<{ performed_on: string; created_at: string }>;
  const project = (await sql`
    SELECT created_at::text AS created_at FROM project WHERE id = ${projectId}`) as Array<{
    created_at: string;
  }>;
  const moneyOperations = (await sql`
    SELECT DISTINCT ON (o.id) o.created_at::text AS created_at
    FROM operation o
    JOIN ledger_entry e ON e.operation_id = o.id AND e.project_id = o.project_id
    JOIN ledger_posting p ON p.entry_id = e.id AND p.project_id = o.project_id
    WHERE o.project_id = ${projectId} AND p.account = 'BOX' AND o.kind <> 'OP-SETUP'`) as Array<{
    created_at: string;
  }>;

  const anchored = lastReconciliation[0];
  const due = reconciliationDue({
    today,
    anchorDay:
      anchored === undefined ? String(project[0]!.created_at).slice(0, 10) : String(anchored.performed_on),
    anchorAt: anchored === undefined ? String(project[0]!.created_at) : String(anchored.created_at),
    moneyOperationAt: moneyOperations.map(o => String(o.created_at)),
  });
  return { due, reconciliations: [...byId.values()] };
}
