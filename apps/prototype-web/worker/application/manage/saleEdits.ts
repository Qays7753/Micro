/**
 * M3.2 (Manage v2 phase 3 — spec §3.4, R-17, owner decision D-14; test
 * T44): the sale's NON-FINANCIAL field edits — direct row updates, NOT
 * operations.
 *
 * Why no operation (R-17/D-14, binding): "تعديل البيانات غير المالية (اسم
 * العميل وغيره) تحديث حقل مباشر، لا عملية ولا قيد" — editing the customer
 * name, note, registered date or the tracker flags creates NO operation
 * row, NO ledger entry and NO balance line; the sale just shows its last
 * edit time (updated_at). The rename carries the sale's open
 * remainder/refund lines with it (§3.4): those lines take the name FROM the
 * sale (§3.6 — counterparty_name is NULL for sale lines and every reader
 * resolves it through the sale, T44), so updating the one row is the whole
 * rename.
 *
 * Scope (PLAN.md M3.2): customer name, note, registered_on, tracked,
 * hidden_from_tracker. Lines/quantities/final price/planned date are a
 * different surface (editable before delivery, locked after — §3.4) owned
 * by the later tasks/screens; this module does not touch them.
 *
 * Idempotency (R-25): the update sets the SAME provided values on retry
 * (idempotent by construction, the M3.1 products posture — no operation is
 * created, so no reservation is needed).
 *
 * Trust boundary: the sale is looked up scoped to (id, project_id); a sale
 * of another project is indistinguishable from "no such sale" (404 at the
 * route — the R-24 posture).
 */
import type postgres from "postgres";
import { OperationRejected } from "../../../../../src/domain/manage/operations/support.js";

/** The fields one edit may set — only what arrived is updated. */
export interface SaleFieldsEditInput {
  projectId: string;
  saleId: unknown;
  customerName?: unknown;
  note?: unknown;
  registeredOn?: unknown;
  tracked?: unknown;
  hiddenFromTracker?: unknown;
}

/** The sale's edited result: the stored row read back. */
export interface SaleFieldsEditResult {
  saleId: string;
  customerName: string | null;
  note: string | null;
  registeredOn: string;
  tracked: boolean;
  hiddenFromTracker: boolean;
  updatedAt: string | null;
}

/** The §11-style code for a sale id that is not this project's — mapped to
 * the route's 404 (the R-24 "does not differ from no project" posture). */
export class SaleNotFound extends Error {
  readonly code = "E-SALE-NOT-FOUND";
  constructor() {
    super("SaleNotFound");
  }
}

function requireSaleId(value: unknown): string {
  if (typeof value !== "string" || value.length === 0) {
    throw new OperationRejected("E-AMOUNT");
  }
  return value;
}

/** A provided optional name: trimmed; an empty/whitespace string CLEARS the
 * field (§3.4 keeps the name always editable — the debt paths own their own
 * E-NAME guards, T6's collection rule is not an edit rule). */
function optionalName(value: unknown): string | null | undefined {
  if (value === undefined) return undefined;
  if (value === null) return null;
  if (typeof value !== "string") throw new OperationRejected("E-AMOUNT");
  const trimmed = value.trim();
  return trimmed.length === 0 ? null : trimmed;
}

/** A provided optional note: trimmed; empty clears it. */
function optionalNote(value: unknown): string | null | undefined {
  const name = optionalName(value);
  return name;
}

function optionalDate(value: unknown): string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new OperationRejected("E-AMOUNT");
  }
  return value;
}

function optionalBoolean(value: unknown): boolean {
  if (typeof value !== "boolean") throw new OperationRejected("E-AMOUNT");
  return value;
}

/** Edit the sale's non-financial fields (R-17/D-14): ONE update of exactly
 * the provided fields; no operation row, no ledger row, no balance line.
 * A rename needs nothing else — the sale's lines resolve their name through
 * the sale (§3.6, T44). */
export async function updateSaleFields(
  sql: postgres.Sql,
  input: SaleFieldsEditInput,
): Promise<SaleFieldsEditResult> {
  const saleId = requireSaleId(input.saleId);
  const customerName = optionalName(input.customerName);
  const note = optionalNote(input.note);
  const registeredOn = input.registeredOn === undefined ? undefined : optionalDate(input.registeredOn);
  const tracked = input.tracked === undefined ? undefined : optionalBoolean(input.tracked);
  const hiddenFromTracker =
    input.hiddenFromTracker === undefined ? undefined : optionalBoolean(input.hiddenFromTracker);
  if (
    customerName === undefined &&
    note === undefined &&
    registeredOn === undefined &&
    tracked === undefined &&
    hiddenFromTracker === undefined
  ) {
    // Nothing to edit is a malformed request, not a no-op write.
    throw new OperationRejected("E-AMOUNT");
  }
  const updated = await sql.begin(async tx => {
    const rows = await tx`
      UPDATE sale SET
        customer_name = ${customerName === undefined ? sql`customer_name` : customerName},
        note = ${note === undefined ? sql`note` : note},
        registered_on = ${registeredOn === undefined ? sql`registered_on` : registeredOn},
        tracked = ${tracked === undefined ? sql`tracked` : tracked},
        hidden_from_tracker = ${hiddenFromTracker === undefined ? sql`hidden_from_tracker` : hiddenFromTracker},
        updated_at = now()
      WHERE id = ${saleId} AND project_id = ${input.projectId}
      RETURNING id, customer_name, note, registered_on::text AS registered_on, tracked,
                hidden_from_tracker, updated_at`;
    return rows[0];
  });
  if (updated === undefined) throw new SaleNotFound();
  return {
    saleId: String(updated.id),
    customerName: updated.customer_name === null ? null : String(updated.customer_name),
    note: updated.note === null ? null : String(updated.note),
    registeredOn: String(updated.registered_on),
    tracked: Boolean(updated.tracked),
    hiddenFromTracker: Boolean(updated.hidden_from_tracker),
    updatedAt: updated.updated_at === null ? null : new Date(updated.updated_at).toISOString(),
  };
}
