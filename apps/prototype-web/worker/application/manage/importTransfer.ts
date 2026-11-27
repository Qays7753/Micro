/**
 * M2.13 (Manage v2 phase 2, wave J — spec S6, §14.6, SRV-07, MNG-LOCAL-05;
 * no migration of old data): the v2 TRANSFER envelope's import half — the
 * counterpart of M2.12's export, over the NEW §3 tables.
 *
 * THE EXPLICIT v1 REJECTION (S6: "استبدال المظروف القديم بمظروف v2 يرفض
 * القديم صراحةً" — no v1 reader in the new path): the import parses ONLY the
 * v2 shape (`micro-manage-export`, version 2). The v1 artifact
 * (`micro-project-export`, version 1) and ANY other shape are refused with
 * `E-ENVELOPE-V1-UNSUPPORTED` (the task's own name — the spec names none)
 * BEFORE a single row is written.
 *
 * INTEGRITY: the envelope's data digest is recomputed with the export's ONE
 * digest implementation (`digestOfEnvelopeData`) — a tampered envelope
 * (any row changed after export) fails `E-IMPORT-DIGEST-MISMATCH` and
 * writes nothing. The digest is integrity, not authenticity (MNG-LOCAL-03
 * stays open with its owner).
 *
 * SAFETY NET: before writing, the envelope's whole ledger state is checked
 * against the seven single-state invariants (M2.3's pure checks) — a
 * crafted envelope cannot import a corrupted ledger
 * (`E-IMPORT-BROKEN-LEDGER`). The three transitional invariants (INV-7/8/9)
 * are two-state contracts of the write paths and do not apply to an import
 * from an empty target.
 *
 * SRV-07 (the import race): ONE transaction; the target account's project
 * row is created by the FIRST insert, and the `project` table's
 * UNIQUE(owner_account_id) (R-24) is the database arbitrator INSIDE the
 * transaction — two concurrent imports into one account: exactly one
 * commits, the loser gets `E-IMPORT-TARGET-NOT-EMPTY`, and no mixed rows
 * can exist (every family row is written after the winner's project insert
 * inside the same transaction). A failure anywhere rolls back everything.
 *
 * SEMANTICS (S6, no migration): the import CREATES a fresh project for the
 * importing account (new project id, the envelope's project name and
 * creation date, the IMPORTER as owner — R-24) and remaps EVERY entity id
 * to a fresh UUID while preserving every reference, so the imported
 * project's §8 figures are identical to the source's. The M2.4 idempotency
 * reservations are NOT imported: they are request-layer metadata (0019,
 * not a §3 table) whose stored responses reference the ORIGINAL project's
 * entity ids — meaningless (and misleading) after remapping.
 */
import type postgres from "postgres";
import { MANAGE_EXPORT_FORMAT, MANAGE_EXPORT_VERSION, digestOfEnvelopeData } from "./exportDelete.js";
import {
  checkInv1,
  checkInv2,
  checkInv3,
  checkInv4,
  checkInv5,
  checkInv6,
  checkInv10,
  type LedgerCheckState,
} from "../../../../../src/domain/manage/invariants/index.js";

/** The route-shape transfer artifact the import accepts (M2.12's export
 * response: format/version/digest + the camelCase data families). */
export interface ManageImportEnvelope {
  format: string;
  version: number;
  digest: string;
  data: {
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
    idempotency?: Array<Record<string, unknown>>;
  };
}

export interface ManageImportOptions {
  /** The importing app account (R-24: it must own no project yet). */
  ownerAccountId: string;
  /** The M2.4-pattern test hook: prove the import never lands halfway. */
  injectFailureAfterFirstInsert?: boolean;
}

export interface ManageImportResult {
  projectId: string;
  counts: Record<string, number>;
}

/** A §3 DATE value as the invariant state's plain "YYYY-MM-DD" string. */
function dateText(value: unknown): string {
  if (typeof value === "string") return value.slice(0, 10);
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return String(value);
}

function num(value: unknown): number {
  return Number(value);
}

/** A nullable reference through an id map — an unmapped reference is a
 * malformed envelope (the digest passed, so this is a family the export
 * never produces; refuse loudly, never guess). */
function ref(map: Map<string, string>, value: unknown): string | null {
  if (value === null || value === undefined) return null;
  const mapped = map.get(String(value));
  if (mapped === undefined) {
    throw new Error(`E-IMPORT-MALFORMED: reference to an unknown row (${String(value)})`);
  }
  return mapped;
}

/** old id → fresh id for one family. */
function mapIds(rows: Array<Record<string, unknown>>): Map<string, string> {
  const map = new Map<string, string>();
  for (const row of rows) {
    map.set(String(row.id), crypto.randomUUID());
  }
  return map;
}

/** Build the INV-1…INV-10 check state from the envelope's raw rows (the
 * same projection the test helper makes of the §3 tables). */
function invariantStateOf(data: ManageImportEnvelope["data"]): LedgerCheckState {
  return {
    boxes: data.boxes.map(b => ({
      id: String(b.id),
      status: b.status as "active" | "merged",
      openingStatus: b.opening_status as "known" | "unknown",
    })),
    balanceLines: data.balanceLines.map(l => ({
      id: String(l.id),
      direction: l.direction as "to_me" | "by_me",
    })),
    sales: data.sales.map(s => ({
      id: String(s.id),
      registeredOn: dateText(s.registered_on),
      plannedDeliveryOn: dateText(s.planned_delivery_on),
    })),
    saleLines: data.saleLines.map(l => ({
      id: String(l.id),
      saleId: String(l.sale_id),
      position: num(l.position),
      productId: l.product_id === null || l.product_id === undefined ? null : String(l.product_id),
      description: String(l.description),
      quantityMilli: num(l.quantity_milli),
      unitPriceFils:
        l.unit_price_minor === null || l.unit_price_minor === undefined ? null : num(l.unit_price_minor),
      unitCostFils:
        l.unit_cost_minor === null || l.unit_cost_minor === undefined ? null : num(l.unit_cost_minor),
    })),
    operations: data.operations.map(o => ({
      id: String(o.id),
      kind: String(o.kind),
      status: o.status as "active" | "reversed",
      ...(o.corrects_operation_id !== null && o.corrects_operation_id !== undefined
        ? { correctsOperationId: String(o.corrects_operation_id) }
        : {}),
      ...(o.reversed_by_operation_id !== null && o.reversed_by_operation_id !== undefined
        ? { reversedByOperationId: String(o.reversed_by_operation_id) }
        : {}),
    })),
    entries: data.entries.map(e => ({
      id: String(e.id),
      operationId: String(e.operation_id),
      entryType: String(e.entry_type),
      effectiveOn: dateText(e.effective_on),
      ...(e.reverses_entry_id !== null && e.reverses_entry_id !== undefined
        ? { reversesEntryId: String(e.reverses_entry_id) }
        : {}),
      postings: data.postings
        .filter(p => String(p.entry_id) === String(e.id))
        .map(p => ({
          account: String(p.account),
          deltaFils: num(p.delta_minor),
          ...(p.ref_id !== null && p.ref_id !== undefined ? { refId: String(p.ref_id) } : {}),
          ...(p.category !== null && p.category !== undefined ? { category: String(p.category) } : {}),
          ...(p.rev_kind !== null && p.rev_kind !== undefined ? { revKind: String(p.rev_kind) } : {}),
        })),
    })),
  };
}

/** The SEVEN single-state checks over the envelope's state — every
 * "violation" refuses the import ("unknown" is INV-1's honest answer with
 * an unknown opening). The three TRANSITIONAL invariants (INV-7/8/9 —
 * M2.3's دوال فوق حالتين: before, after) do not apply to an import: their
 * contracts police a transition FROM an existing state on the write paths
 * (M2.5+), and the import's before-state is empty by definition — there is
 * no prior state whose rows could be disturbed. */
function assertEnvelopeInvariants(data: ManageImportEnvelope["data"]): void {
  const state = invariantStateOf(data);
  const results = [
    checkInv1(state),
    checkInv2(state),
    checkInv3(state),
    checkInv4(state),
    checkInv5(state),
    checkInv6(state),
    checkInv10(state),
  ];
  const broken = results.filter(r => r.outcome === "violation");
  if (broken.length > 0) {
    throw new Error(
      `E-IMPORT-BROKEN-LEDGER: ${broken.map(r => r.invariantId).join(", ")} violated by the envelope`,
    );
  }
}

/**
 * Import one v2 transfer envelope into a FRESH project owned by
 * `ownerAccountId`. Validation is total and BEFORE any write (v1 rejection,
 * shape, digest, invariants); the write is ONE transaction whose first
 * insert creates the project row — UNIQUE(owner_account_id) arbitrates
 * concurrent imports inside the transaction (SRV-07). Every entity id is
 * remapped to a fresh UUID; every §3 field value is preserved verbatim.
 */
export async function importManageProject(
  sql: postgres.Sql,
  envelope: ManageImportEnvelope,
  options: ManageImportOptions,
): Promise<ManageImportResult> {
  // 1. The explicit v1 rejection — the new path parses ONLY v2 (S6). The
  // single inequality covers the v1 artifact (micro-project-export /
  // version 1) and every other shape: anything that is not exactly the v2
  // envelope is refused here, before a single row is written.
  if (envelope.format !== MANAGE_EXPORT_FORMAT || envelope.version !== MANAGE_EXPORT_VERSION) {
    throw new Error(
      "E-ENVELOPE-V1-UNSUPPORTED: the new Manage reads the v2 envelope (micro-manage-export, version 2) only — the old envelope is explicitly rejected, and nothing was written",
    );
  }
  // 2. The shape (a closed surface: exactly the v2 families; extra families
  // such as idempotency are ignored, never interpreted).
  const data = envelope.data;
  if (
    data === null ||
    typeof data !== "object" ||
    data.project === null ||
    typeof data.project !== "object"
  ) {
    throw new Error("E-IMPORT-MALFORMED: the envelope's data.project is missing");
  }
  // 3. The integrity digest — the ONE implementation (exportDelete's).
  const digest = await digestOfEnvelopeData(data as Parameters<typeof digestOfEnvelopeData>[0]);
  if (digest !== envelope.digest) {
    throw new Error(
      "E-IMPORT-DIGEST-MISMATCH: the envelope's data no longer matches its digest — export again, then import",
    );
  }
  // 4. The safety net: INV-1…INV-10 over the envelope's whole ledger.
  assertEnvelopeInvariants(data);

  // 5. ONE transaction; the project insert is the SRV-07 arbitrator.
  return sql
    .begin(async tx => {
      const projectId = crypto.randomUUID();
      const counts: Record<string, number> = {};
      await tx`INSERT INTO project (id, name, owner_account_id, created_at)
             VALUES (${projectId}, ${String(data.project.name)}, ${options.ownerAccountId},
                     ${data.project.created_at as string})`;
      counts.project = 1;
      if (options.injectFailureAfterFirstInsert === true) {
        throw new Error("M2.13 injected failure after the first insert — the import must roll back");
      }

      const boxMap = mapIds(data.boxes);
      const productMap = mapIds(data.products);
      const saleMap = mapIds(data.sales);
      const lineMap = mapIds(data.balanceLines);
      const operationMap = mapIds(data.operations);
      const entryMap = mapIds(data.entries);
      const reconciliationMap = mapIds(data.reconciliations);

      // The FK-safe insert order: every parent before its children.
      for (const row of data.boxes) {
        await tx`INSERT INTO box (id, project_id, kind, status, opening_status, created_on, created_at)
               VALUES (${boxMap.get(String(row.id))!}, ${projectId}, ${row.kind as string},
                       ${row.status as string}, ${row.opening_status as string},
                       ${row.created_on as string}, ${row.created_at as string})`;
        counts.box = (counts.box ?? 0) + 1;
      }
      for (const row of data.products) {
        await tx`INSERT INTO product (id, project_id, name, unit_label, unit_price_minor, archived,
                                    created_at, updated_at)
               VALUES (${productMap.get(String(row.id))!}, ${projectId}, ${row.name as string},
                       ${row.unit_label as string | null}, ${row.unit_price_minor as number | string},
                       ${row.archived as boolean}, ${row.created_at as string},
                       ${row.updated_at as string | null})`;
        counts.product = (counts.product ?? 0) + 1;
      }
      for (const row of data.productComponents) {
        await tx`INSERT INTO product_component (id, project_id, product_id, name, cost_minor, position)
               VALUES (${crypto.randomUUID()}, ${projectId}, ${ref(productMap, row.product_id)},
                       ${row.name as string}, ${row.cost_minor as number | string}, ${row.position as number})`;
        counts.product_component = (counts.product_component ?? 0) + 1;
      }
      for (const row of data.sales) {
        await tx`INSERT INTO sale (id, project_id, customer_name, registered_on, planned_delivery_on,
                                 final_price_minor, cancelled_on, tracked, hidden_from_tracker, note,
                                 created_at, updated_at)
               VALUES (${saleMap.get(String(row.id))!}, ${projectId}, ${row.customer_name as string | null},
                       ${row.registered_on as string}, ${row.planned_delivery_on as string},
                       ${row.final_price_minor as number | string | null},
                       ${row.cancelled_on as string | null}, ${row.tracked as boolean},
                       ${row.hidden_from_tracker as boolean}, ${row.note as string | null},
                       ${row.created_at as string}, ${row.updated_at as string | null})`;
        counts.sale = (counts.sale ?? 0) + 1;
      }
      for (const row of data.operations) {
        await tx`INSERT INTO operation (id, project_id, kind, effective_on, status, corrects_operation_id,
                                      reversed_by_operation_id, box_id, sale_id, balance_line_id,
                                      counterparty_name, category, amount_minor, delivery_cost_minor,
                                      payload, note, created_by_account_id, created_at)
               VALUES (${operationMap.get(String(row.id))!}, ${projectId}, ${row.kind as string},
                       ${row.effective_on as string}, ${row.status as string},
                       ${ref(operationMap, row.corrects_operation_id)},
                       ${ref(operationMap, row.reversed_by_operation_id)},
                       ${ref(boxMap, row.box_id)}, ${ref(saleMap, row.sale_id)},
                       ${ref(lineMap, row.balance_line_id)},
                       ${row.counterparty_name as string | null}, ${row.category as string | null},
                       ${row.amount_minor as number | string | null},
                       ${row.delivery_cost_minor as number | string | null},
                       ${row.payload === undefined || row.payload === null ? null : JSON.stringify(row.payload)},
                       ${row.note as string | null},
                       ${row.created_by_account_id as string}, ${row.created_at as string})`;
        counts.operation = (counts.operation ?? 0) + 1;
      }
      for (const row of data.saleLines) {
        await tx`INSERT INTO sale_line (id, project_id, sale_id, position, product_id, description,
                                      quantity_milli, unit_price_minor, unit_cost_minor, components_snapshot)
               VALUES (${crypto.randomUUID()}, ${projectId}, ${ref(saleMap, row.sale_id)},
                       ${row.position as number}, ${ref(productMap, row.product_id)},
                       ${row.description as string}, ${row.quantity_milli as number},
                       ${row.unit_price_minor as number | string | null},
                       ${row.unit_cost_minor as number | string | null},
                       ${
                         row.components_snapshot === undefined || row.components_snapshot === null
                           ? null
                           : JSON.stringify(row.components_snapshot)
                       })`;
        counts.sale_line = (counts.sale_line ?? 0) + 1;
      }
      for (const row of data.balanceLines) {
        await tx`INSERT INTO balance_line (id, project_id, direction, kind, counterparty_name, origin_on,
                                         sale_id, origin_operation_id)
               VALUES (${lineMap.get(String(row.id))!}, ${projectId}, ${row.direction as string},
                       ${row.kind as string}, ${row.counterparty_name as string | null},
                       ${row.origin_on as string}, ${ref(saleMap, row.sale_id)},
                       ${ref(operationMap, row.origin_operation_id)})`;
        counts.balance_line = (counts.balance_line ?? 0) + 1;
      }
      for (const row of data.entries) {
        await tx`INSERT INTO ledger_entry (id, project_id, operation_id, entry_type, effective_on,
                                         reverses_entry_id, created_at)
               VALUES (${entryMap.get(String(row.id))!}, ${projectId},
                       ${ref(operationMap, row.operation_id)}, ${row.entry_type as string},
                       ${row.effective_on as string}, ${ref(entryMap, row.reverses_entry_id)},
                       ${row.created_at as string})`;
        counts.ledger_entry = (counts.ledger_entry ?? 0) + 1;
      }
      for (const row of data.postings) {
        // §3.8's polymorphic ref_id: BOX→box, AR/AP→balance line, PRE/REV→sale.
        const account = String(row.account);
        const mappedRef =
          account === "BOX"
            ? ref(boxMap, row.ref_id)
            : account === "AR" || account === "AP"
              ? ref(lineMap, row.ref_id)
              : account === "PRE" || account === "REV"
                ? ref(saleMap, row.ref_id)
                : null;
        await tx`INSERT INTO ledger_posting (id, project_id, entry_id, account, ref_id, category, rev_kind,
                                           delta_minor)
               VALUES (${crypto.randomUUID()}, ${projectId}, ${ref(entryMap, row.entry_id)},
                       ${account}, ${mappedRef}, ${row.category as string | null},
                       ${row.rev_kind as string | null}, ${row.delta_minor as number | string})`;
        counts.ledger_posting = (counts.ledger_posting ?? 0) + 1;
      }
      for (const row of data.absences) {
        await tx`INSERT INTO absence_event (id, project_id, started_on, ended_on, complete)
               VALUES (${crypto.randomUUID()}, ${projectId}, ${row.started_on as string},
                       ${row.ended_on as string}, ${row.complete as boolean | null})`;
        counts.absence_event = (counts.absence_event ?? 0) + 1;
      }
      for (const row of data.reconciliations) {
        await tx`INSERT INTO reconciliation (id, project_id, performed_on, context, created_at)
               VALUES (${reconciliationMap.get(String(row.id))!}, ${projectId},
                       ${row.performed_on as string}, ${row.context as string},
                       ${row.created_at as string})`;
        counts.reconciliation = (counts.reconciliation ?? 0) + 1;
      }
      for (const row of data.reconciliationBoxes) {
        await tx`INSERT INTO reconciliation_box (reconciliation_id, box_id, project_id, recorded_minor,
                                               counted_minor)
               VALUES (${ref(reconciliationMap, row.reconciliation_id)}, ${ref(boxMap, row.box_id)},
                       ${projectId}, ${row.recorded_minor as number | string},
                       ${row.counted_minor as number | string})`;
        counts.reconciliation_box = (counts.reconciliation_box ?? 0) + 1;
      }
      return { projectId, counts };
    })
    .catch(error => {
      // The one EXPECTED concurrent-import refusal: the account's single
      // project slot is taken (R-24's UNIQUE inside the transaction — SRV-07).
      if (/manage_v2_project_owner_unique/.test(String(error))) {
        throw new Error(
          "E-IMPORT-TARGET-NOT-EMPTY: this account already owns a Manage project — one project per account (R-24); nothing was written",
        );
      }
      throw error;
    });
}
