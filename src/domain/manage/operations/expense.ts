/**
 * M2.6 (Manage v2 phase 2, wave G — spec §5 OP-EXPENSE, §4 Q7/Q8/Q9/Q10,
 * R-10, R-12, R-13, R-18, R-26; tests T8, T15, T16, T29 start state, T30,
 * T43): record an expense — paid in full from a box, paid from the owner's
 * personal money, on credit, or partially paid — with its delivery-cost
 * attribution.
 *
 * Contract (§5 OP-EXPENSE): amount (> 0), delivery_cost (≥ 0, default 0),
 * category (R-10, never `sale_delivery` — that one is produced by the
 * sale's delivery operation), payment full | credit | partial(m), source
 * (a box | `personal`) when something is paid, supplier name when something
 * is on credit, effective_on (default today, ≤ today), note. Total
 * t = amount + delivery_cost. Entries:
 *   full + box k:        Q8(c, k, t)
 *   full + personal:     Q10(cash, t) + Q8(c, cash, t)        (R-18)
 *   credit:              Q9(c, new supplier line, t)
 *   partial + box k:     Q9(c, L, t) + Q7(L, k, m)
 *   partial + personal:  Q9(c, L, t) + Q10(cash, m) + Q7(L, cash, m)
 * `operation.delivery_cost_minor` keeps the delivery portion for display;
 * the operation row's amount is the total.
 *
 * PURE PLANNER (M1.6 boundary) whose entries need LIVE state: the box a
 * payment leaves is identified by its kind (R-9: one box per kind per
 * project) and only exists in the database. The plan therefore resolves it
 * inside the handler's transaction (`loadState`: after the idempotency
 * reservation, before any write) — the box row is locked FOR UPDATE, a box
 * that is not active is E-BOX-STATE — and builds the entries there against
 * the resolved ids. A rejection rolls back the reservation too: nothing
 * persists.
 *
 * w.negative_box (T8): a box that ends below zero is a WARNING, never a
 * rejection (R-12: only a negative balance line or prepayment rejects an
 * operation). The warning is decided inside the same transaction AFTER the
 * entries are written (`resultData`), from the box's resulting balance, and
 * the handler stores it with the idempotent response — a replayed request
 * (R-25) returns the very same warning. A box whose opening is unknown has
 * an unknown balance: it never warns.
 */
import { buildLedgerEntry, isExpenseCategory } from "../ledger/index.js";
import type { BuiltLedgerEntry, ExpenseCategory } from "../ledger/index.js";
import {
  reject,
  requireContext,
  requireDate,
  requireName,
  requireNonNegativeFils,
  requirePositiveFils,
  type OperationContextInput,
  type OperationPlan,
  type OperationWritePlan,
  type TxQuery,
} from "./support.js";

/** How the expense is paid (§5: full | credit | partial(m)). */
export type ExpensePayment = { type: "full" } | { type: "credit" } | { type: "partial"; paidFils: number };

/** Where the paid part comes from (§5: box k | personal): a box of the
 * project identified by its kind (R-9), or the owner's personal money —
 * which passes through the cash box (R-18). */
export type ExpenseSource = "cash" | "account" | "personal";

export interface ExpenseInput extends OperationContextInput {
  amountFils: unknown;
  deliveryCostFils?: unknown;
  category: unknown;
  payment: unknown;
  source?: unknown;
  supplierName?: unknown;
  effectiveOn?: unknown;
  note?: unknown;
}

/** The validated expense: every field confirmed, defaults applied. */
interface ExpenseForm {
  amountFils: number;
  deliveryCostFils: number;
  /** t = amount + delivery_cost. */
  totalFils: number;
  category: ExpenseCategory;
  payment: ExpensePayment;
  /** Absent for a credit expense (nothing is paid). */
  source: ExpenseSource | undefined;
  /** Required whenever something is on credit; optional otherwise. */
  supplierName: string | undefined;
  effectiveOn: string;
  note: string | undefined;
}

/** R-10 as the expense form offers it: every category but `sale_delivery`. */
function requireExpenseCategory(category: unknown): ExpenseCategory {
  if (typeof category !== "string" || !isExpenseCategory(category) || category === "sale_delivery") {
    reject("E-AMOUNT");
  }
  return category;
}

function requirePayment(payment: unknown, totalFils: number): ExpensePayment {
  if (payment === null || typeof payment !== "object") reject("E-AMOUNT");
  const { type, paidFils } = payment as { type?: unknown; paidFils?: unknown };
  if (type === "full" || type === "credit") {
    // m belongs to a partial payment only.
    if (paidFils !== undefined) reject("E-AMOUNT");
    return { type };
  }
  if (type !== "partial") reject("E-AMOUNT");
  // partial(m): 0 < m < t (§5).
  if (
    typeof paidFils !== "number" ||
    !Number.isSafeInteger(paidFils) ||
    paidFils <= 0 ||
    paidFils >= totalFils
  ) {
    reject("E-AMOUNT");
  }
  return { type: "partial", paidFils };
}

/** The source is required when something is paid, and only then. */
function requireSource(source: unknown, payment: ExpensePayment): ExpenseSource | undefined {
  if (payment.type === "credit") {
    if (source !== undefined) reject("E-AMOUNT");
    return undefined;
  }
  if (source !== "cash" && source !== "account" && source !== "personal") reject("E-AMOUNT");
  return source;
}

function requireSupplierName(supplierName: unknown, payment: ExpensePayment): string | undefined {
  if (supplierName !== undefined) return requireName(supplierName);
  // Something is on credit: the supplier must be named (§5).
  if (payment.type !== "full") reject("E-NAME-REQUIRED");
  return undefined;
}

function requireNote(note: unknown): string | undefined {
  if (note === undefined) return undefined;
  if (typeof note !== "string") reject("E-AMOUNT");
  const trimmed = note.trim();
  return trimmed.length === 0 ? undefined : trimmed;
}

/** effective_on: default today, never in the future (R-13 / R-26). */
function requireEffectiveOn(effectiveOn: unknown, today: string): string {
  if (effectiveOn === undefined) return today;
  const date = requireDate(effectiveOn);
  if (date > today) reject("E-FUTURE-DATE");
  return date;
}

function validateExpense(input: ExpenseInput, today: string): ExpenseForm {
  const amountFils = requirePositiveFils(input.amountFils);
  const deliveryCostFils =
    input.deliveryCostFils === undefined ? 0 : requireNonNegativeFils(input.deliveryCostFils);
  const totalFils = amountFils + deliveryCostFils;
  if (!Number.isSafeInteger(totalFils)) reject("E-AMOUNT");
  const payment = requirePayment(input.payment, totalFils);
  return {
    amountFils,
    deliveryCostFils,
    totalFils,
    category: requireExpenseCategory(input.category),
    payment,
    source: requireSource(input.source, payment),
    supplierName: requireSupplierName(input.supplierName, payment),
    effectiveOn: requireEffectiveOn(input.effectiveOn, today),
    note: requireNote(input.note),
  };
}

/** An id the loadState hook was bound to resolve (it refuses before the
 * entries are built when it cannot). */
function resolved(value: string | undefined, code: string): string {
  if (value === undefined) reject(code);
  return value;
}

/** The §5 entries of one expense, in the contract's order. `boxId` is the
 * box the payment leaves (the cash box for personal money — R-18), absent
 * for a credit expense; `lineId` the supplier line a credit or partial
 * expense opens. */
function expenseEntries(
  form: ExpenseForm,
  boxId: string | undefined,
  lineId: string | undefined,
): BuiltLedgerEntry[] {
  const { category, effectiveOn, totalFils } = form;
  switch (form.payment.type) {
    case "full": {
      const box = resolved(boxId, "E-BOX-STATE");
      if (form.source === "personal") {
        return [
          buildLedgerEntry({ type: "Q10", effectiveOn, boxId: box, amountFils: totalFils }),
          buildLedgerEntry({ type: "Q8", effectiveOn, boxId: box, category, amountFils: totalFils }),
        ];
      }
      return [buildLedgerEntry({ type: "Q8", effectiveOn, boxId: box, category, amountFils: totalFils })];
    }
    case "credit":
      return [
        buildLedgerEntry({
          type: "Q9",
          effectiveOn,
          lineId: resolved(lineId, "E-AMOUNT"),
          category,
          amountFils: totalFils,
        }),
      ];
    case "partial": {
      const { paidFils } = form.payment;
      const box = resolved(boxId, "E-BOX-STATE");
      const line = resolved(lineId, "E-AMOUNT");
      const entries = [
        buildLedgerEntry({ type: "Q9", effectiveOn, lineId: line, category, amountFils: totalFils }),
      ];
      if (form.source === "personal") {
        entries.push(buildLedgerEntry({ type: "Q10", effectiveOn, boxId: box, amountFils: paidFils }));
      }
      entries.push(
        buildLedgerEntry({ type: "Q7", effectiveOn, boxId: box, lineId: line, amountFils: paidFils }),
      );
      return entries;
    }
  }
}

/** «Load state in the transaction» (§14.1): resolve — and lock — the box
 * the payment leaves, open the supplier line, and build the entries against
 * the resolved ids. The handler reads the write AFTER this hook. */
function expenseLoadState(projectId: string, form: ExpenseForm, write: OperationWritePlan) {
  return async (tx: TxQuery): Promise<void> => {
    // The kind of the box the payment leaves: the source box, or cash for
    // personal money (R-18); none for a credit expense.
    const kind = form.source === undefined ? undefined : form.source === "personal" ? "cash" : form.source;
    if (kind !== undefined) {
      const boxes = (await tx`
        SELECT id FROM box
        WHERE project_id = ${projectId} AND kind = ${kind} AND status = 'active'
        FOR UPDATE`) as Array<{ id: string }>;
      if (boxes.length === 0) reject("E-BOX-STATE");
      write.boxId = String(boxes[0]?.id);
    }
    if (form.payment.type !== "full") {
      const lineId = crypto.randomUUID();
      write.balanceLineId = lineId;
      write.balanceLines = [
        {
          id: lineId,
          direction: "by_me",
          kind: "supplier",
          originOn: form.effectiveOn,
          ...(form.supplierName !== undefined ? { counterpartyName: form.supplierName } : {}),
        },
      ];
    }
    write.entries = expenseEntries(form, write.boxId, write.balanceLineId);
  };
}

/** w.negative_box (T8), decided from the box's RESULTING balance: read after
 * the entries are written, in the same transaction. An unknown opening means
 * an unknown balance — never a warning. */
async function negativeBoxWarning(
  tx: TxQuery,
  projectId: string,
  boxId: string,
): Promise<Record<string, unknown> | undefined> {
  const rows = (await tx`
    SELECT b.opening_status, COALESCE(SUM(p.delta_minor), 0)::bigint AS total
    FROM box b
    LEFT JOIN ledger_posting p ON p.account = 'BOX' AND p.ref_id = b.id AND p.project_id = b.project_id
    WHERE b.id = ${boxId} AND b.project_id = ${projectId}
    GROUP BY b.id`) as Array<{ opening_status: string; total: string | number }>;
  const row = rows[0];
  if (row === undefined || String(row.opening_status) !== "known" || Number(row.total) >= 0) return undefined;
  return { warnings: ["w.negative_box"] };
}

/** Plan OP-EXPENSE: validate, then resolve the box and build the entries
 * inside the handler's transaction. */
export function planExpense(input: ExpenseInput): OperationPlan {
  const ctx = requireContext(input);
  const form = validateExpense(input, ctx.today);
  // Idempotency identity (R-25) and the persisted payload: the validated
  // inputs only — the supplier line id is generated per planning.
  const intent = {
    amountFils: form.amountFils,
    deliveryCostFils: form.deliveryCostFils,
    category: form.category,
    payment: form.payment,
    source: form.source,
    supplierName: form.supplierName,
    effectiveOn: form.effectiveOn,
    note: form.note,
  };
  const write: OperationWritePlan = {
    projectId: ctx.projectId,
    createdByAccountId: ctx.createdByAccountId,
    requestId: ctx.requestId,
    kind: "OP-EXPENSE",
    effectiveOn: form.effectiveOn,
    amountFils: form.totalFils,
    category: form.category,
    ...(form.deliveryCostFils > 0 ? { deliveryCostFils: form.deliveryCostFils } : {}),
    ...(form.supplierName !== undefined ? { counterpartyName: form.supplierName } : {}),
    ...(form.note !== undefined ? { note: form.note } : {}),
    payload: intent,
    intent,
    // Box, supplier line and entries are resolved inside the transaction.
    entries: [],
  };
  // Only a box the payment actually LEFT can end below zero: personal money
  // nets to zero on the cash box (Q10 then Q8/Q7 of the same amount).
  const paidFromBox = form.source === "cash" || form.source === "account";
  return {
    write,
    loadState: expenseLoadState(ctx.projectId, form, write),
    ...(paidFromBox
      ? {
          resultData: async ({ tx }: { tx: TxQuery }) => {
            const boxId = write.boxId;
            return boxId === undefined ? undefined : negativeBoxWarning(tx, ctx.projectId, boxId);
          },
        }
      : {}),
  };
}
