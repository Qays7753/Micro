/**
 * M3.2 (Manage v2 phase 3 — spec §5 OP-SALE-CREATE, §3.4 sale, §3.5
 * snapshot, §6 derived status, R-17, INV-9; tests S1 create slice, T20,
 * T21 create slice, T44 base, T48): create a sale/order — NO money moves.
 *
 * Contract (§5 OP-SALE-CREATE): lines[≥1] {product_id | description,
 * quantity (default 1), unit_price?, edited components?},
 * planned_delivery_on, final_price?, customer_name?, tracked? (default per
 * §3.4: true iff planned > today at creation), note?, registered_on
 * (default today). Validation: ≥1 line (E-NO-LINES); quantity > 0 (E-QTY);
 * customer name required for future sales (E-NAME-REQUIRED). Entries: NONE
 * (the combined prepayment / delivery-cost / delivered-now of one user
 * action are SEPARATE operations — M3.3/M3.4/M3.5 — the §5 text is
 * explicit). Product line snapshot: copy product name, unit price, unit
 * cost (or NULL if unknown), components (M3.1's builders — the single
 * implementation).
 *
 * Status (§6) is DERIVED, never stored: at creation the sale is scheduled
 * (planned ≥ today) or overdue (planned < today); the §6 transitions belong
 * to the later operations. `registered_on` and `planned_delivery_on` have
 * NO financial effect (INV-9): this operation writes no ledger row at all.
 *
 * Editing the sale's non-financial fields (customer name, note, registered
 * date, tracker flags) is NOT this operation — R-17/D-14: a direct row
 * update with no operation and no entry (worker/application/manage/
 * saleEdits.ts, T44).
 *
 * PURE PLANNER: the product lines' snapshots need live state (the product
 * rows and their components), resolved inside the handler's transaction
 * (`loadState`) — a product id that is not this project's answers
 * E-AMOUNT (no §11 code names it; the generic input rejection, the M2.6
 * precedent). An ARCHIVED product may still be referenced: §3.3 excludes
 * archived products from SUGGESTIONS only; an explicit id is the user's
 * choice and the snapshot copies it all the same.
 */
import { freeTextLineSnapshot, productLineSnapshot, type ProductComponentForm } from "../products.js";
import {
  reject,
  requireContext,
  requireDate,
  requireName,
  type OperationContextInput,
  type OperationPlan,
  type OperationWritePlan,
  type TxQuery,
} from "./support.js";

/** One sale line as it arrives from the route layer — every field `unknown`
 * until validated. A product line carries `productId`; a free-text line
 * carries `description`; both may carry a quantity, a unit price (an
 * override of the product's price — P-62 "لهذا الطلب فقط") and edited
 * components. */
export interface SaleCreateLineInput {
  productId?: unknown;
  description?: unknown;
  quantityMilli?: unknown;
  unitPriceFils?: unknown;
  editedComponents?: unknown;
}

/** The validated shape of one line (the sale-id binding happens in
 * extraWrites). */
export interface SaleLineWrite {
  id: string;
  productId: string | null;
  description: string;
  quantityMilli: number;
  unitPriceFils: number | null;
  unitCostFils: number | null;
  componentsSnapshot: string | null;
}

export interface SaleCreateInput extends OperationContextInput {
  lines: unknown;
  plannedDeliveryOn: unknown;
  finalPriceFils?: unknown;
  customerName?: unknown;
  tracked?: unknown;
  note?: unknown;
  registeredOn?: unknown;
}

/** A component row of a line's EDITED components: same §3.3 discard rule —
 * a row needs both the name and the cost, an explicit 0 cost is a value. */
function editedComponentsOf(value: unknown): ProductComponentForm[] | undefined {
  if (value === undefined || value === null) return undefined;
  if (!Array.isArray(value)) reject("E-AMOUNT");
  const forms: ProductComponentForm[] = [];
  for (const row of value) {
    if (row === null || typeof row !== "object") continue;
    const { name, costFils } = row as { name?: unknown; costFils?: unknown };
    if (typeof name !== "string") continue;
    const trimmed = name.trim();
    if (typeof costFils !== "number" || !Number.isSafeInteger(costFils) || costFils < 0) continue;
    if (trimmed.length === 0) continue;
    forms.push({ name: trimmed, costFils });
  }
  return forms;
}

/** One line's quantity: default 1000 (× 1), positive milli-integer (E-QTY). */
function requireQuantityMilli(value: unknown): number {
  if (value === undefined) return 1000;
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value <= 0) reject("E-QTY");
  return value;
}

/** One line's optional unit price: a non-negative integer fils amount
 * (0 is a value — a free line of a priced product, §3.5 allows NULL "until
 * entered" and the sale form lets the user type 0). */
function optionalPriceFils(value: unknown): number | null {
  if (value === undefined || value === null) return null;
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 0) reject("E-AMOUNT");
  return value;
}

/** The validated line BEFORE its snapshot resolves (product lines resolve
 * against the live product in loadState). */
interface PendingLine {
  productId: string | undefined;
  description: string | undefined;
  quantityMilli: number;
  unitPriceFils: number | null;
  editedComponents: ProductComponentForm[] | undefined;
}

function validateLine(line: unknown): PendingLine {
  if (line === null || typeof line !== "object") reject("E-AMOUNT");
  const { productId, description, quantityMilli, unitPriceFils, editedComponents } = line as {
    productId?: unknown;
    description?: unknown;
    [key: string]: unknown;
  };
  const pending: PendingLine = {
    productId: undefined,
    description: undefined,
    quantityMilli: requireQuantityMilli(quantityMilli),
    unitPriceFils: optionalPriceFils(unitPriceFils),
    editedComponents: editedComponentsOf(editedComponents),
  };
  if (productId !== undefined && productId !== null) {
    if (typeof productId !== "string" || productId.length === 0) reject("E-AMOUNT");
    pending.productId = productId;
    return pending;
  }
  // A free-text line: its description is the line (R-14 free text, trimmed).
  pending.description = requireName(description);
  return pending;
}

/** The validated sale form: every field confirmed, defaults applied. */
interface SaleForm {
  plannedDeliveryOn: string;
  registeredOn: string;
  finalPriceFils: number | null;
  customerName: string | undefined;
  tracked: boolean;
  note: string | undefined;
  lines: PendingLine[];
}

/** The sale's id (generated per planning — never in the idempotency hash). */
const saleIdOf = (): string => crypto.randomUUID();

/** Plan OP-SALE-CREATE: validate, then resolve the product snapshots inside
 * the handler's transaction and write the sale + its lines there. */
/** The optional final price (§3.4): NULL until set; > 0 when set. */
function optionalFinalPriceFils(value: unknown): number | null {
  if (value === undefined || value === null) return null;
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value <= 0) reject("E-AMOUNT");
  return value;
}

/** The sale's party fields (§3.4): the customer name — required (non-empty)
 * when the sale is for a future day; a same-day sale may omit it (the debt
 * paths guard it later, T6's E-NAME-REQUIRED-FOR-DEBT) — and tracked, which
 * defaults to true iff the sale is for a future day. */
function salePartyFields(
  input: SaleCreateInput,
  plannedDeliveryOn: string,
  today: string,
): { customerName: string | undefined; tracked: boolean } {
  let customerName: string | undefined;
  if (input.customerName !== undefined && input.customerName !== null) {
    customerName = requireName(input.customerName);
  }
  if (plannedDeliveryOn > today && customerName === undefined) reject("E-NAME-REQUIRED");
  let tracked: boolean = plannedDeliveryOn > today;
  if (input.tracked !== undefined && input.tracked !== null) {
    if (typeof input.tracked !== "boolean") reject("E-AMOUNT");
    tracked = input.tracked;
  }
  return { customerName, tracked };
}

/** The optional sale note: trimmed free text; empty → none. */
function optionalSaleNote(value: unknown): string | undefined {
  if (value === undefined || value === null) return undefined;
  if (typeof value !== "string") reject("E-AMOUNT");
  const trimmed = value.trim();
  return trimmed.length === 0 ? undefined : trimmed;
}

/** Validate the whole §5 OP-SALE-CREATE form: every field confirmed,
 * defaults applied (quantity ×1, registered today, tracked per §3.4, the
 * customer name required for future sales). */
function validateSaleCreate(input: SaleCreateInput, today: string): SaleForm {
  if (!Array.isArray(input.lines) || input.lines.length === 0) reject("E-NO-LINES");
  const plannedDeliveryOn = requireDate(input.plannedDeliveryOn);
  const registeredOn = input.registeredOn === undefined ? today : requireDate(input.registeredOn);
  const party = salePartyFields(input, plannedDeliveryOn, today);
  return {
    plannedDeliveryOn,
    registeredOn,
    finalPriceFils: optionalFinalPriceFils(input.finalPriceFils),
    customerName: party.customerName,
    tracked: party.tracked,
    note: optionalSaleNote(input.note),
    lines: (input.lines as unknown[]).map(validateLine),
  };
}

export function planSaleCreate(input: SaleCreateInput): OperationPlan {
  const ctx = requireContext(input);
  const form = validateSaleCreate(input, ctx.today);
  const saleId = saleIdOf();
  // The loadState → extraWrites handoff: both hooks close over THIS plan's
  // own slot (never module state — concurrent plans must not clobber each
  // other); loadState fills it inside the transaction, extraWrites reads it
  // right after, in the same transaction.
  const linesSlot: { lines: SaleLineWrite[] } = { lines: [] };
  // The idempotency intent: the validated inputs only — the sale and line
  // ids are generated per planning.
  const intent = {
    plannedDeliveryOn: form.plannedDeliveryOn,
    registeredOn: form.registeredOn,
    ...(form.finalPriceFils === null ? {} : { finalPriceFils: form.finalPriceFils }),
    ...(form.customerName === undefined ? {} : { customerName: form.customerName }),
    tracked: form.tracked,
    ...(form.note === undefined ? {} : { note: form.note }),
    lines: form.lines.map(l => ({
      ...(l.productId === undefined ? {} : { productId: l.productId }),
      ...(l.description === undefined ? {} : { description: l.description }),
      quantityMilli: l.quantityMilli,
      ...(l.unitPriceFils === null ? {} : { unitPriceFils: l.unitPriceFils }),
      ...(l.editedComponents === undefined ? {} : { editedComponents: l.editedComponents }),
    })),
  };
  const write: OperationWritePlan = {
    projectId: ctx.projectId,
    createdByAccountId: ctx.createdByAccountId,
    requestId: ctx.requestId,
    kind: "OP-SALE-CREATE",
    // §3.4: registered_on is the sale's own date; the operation carries it.
    effectiveOn: form.registeredOn,
    // §5.0: the row amount is the final price — blank (null) when none.
    amountFils: form.finalPriceFils,
    saleId,
    ...(form.customerName === undefined ? {} : { counterpartyName: form.customerName }),
    ...(form.note === undefined ? {} : { note: form.note }),
    payload: intent,
    intent,
    entries: [],
  };
  return {
    write,
    loadState: saleCreateLoadState(ctx.projectId, form, linesSlot),
    extraWrites: saleCreateExtraWrites(ctx.projectId, form, saleId, linesSlot),
    resultData: async () => ({
      saleId,
      status: form.plannedDeliveryOn >= ctx.today ? "scheduled" : "overdue",
    }),
  };
}

/** «Load state in the transaction» (§14.1): resolve every product line's
 * snapshot against the live product (name, price, components) — M3.1's
 * builders, the single snapshot implementation. */
function saleCreateLoadState(
  projectId: string,
  form: SaleForm,
  linesSlot: { lines: SaleLineWrite[] },
): (tx: TxQuery) => Promise<void> {
  return async (tx: TxQuery) => {
    const lines: SaleLineWrite[] = [];
    for (const pending of form.lines) {
      const id = crypto.randomUUID();
      if (pending.productId !== undefined) {
        const products = (await tx`
          SELECT name, unit_price_minor FROM product
          WHERE id = ${pending.productId} AND project_id = ${projectId}`) as Array<{
          name: string;
          unit_price_minor: string | number;
        }>;
        const product = products[0];
        if (product === undefined) reject("E-AMOUNT");
        const components = (await tx`
          SELECT name, cost_minor FROM product_component
          WHERE product_id = ${pending.productId} AND project_id = ${projectId}
          ORDER BY position`) as Array<{ name: string; cost_minor: string | number }>;
        const componentForms: ProductComponentForm[] = components.map(c => ({
          name: String(c.name),
          costFils: Number(c.cost_minor),
        }));
        const snapshot = productLineSnapshot(
          { name: String(product.name), unitPriceFils: Number(product.unit_price_minor) },
          componentForms,
          pending.editedComponents,
        );
        lines.push({
          id,
          productId: pending.productId,
          description: snapshot.description,
          quantityMilli: pending.quantityMilli,
          // P-62: an explicit price overrides the product's, for this order only.
          unitPriceFils: pending.unitPriceFils ?? snapshot.unitPriceFils,
          unitCostFils: snapshot.unitCostFils,
          componentsSnapshot:
            snapshot.componentsSnapshot === null ? null : JSON.stringify(snapshot.componentsSnapshot),
        });
        continue;
      }
      // A free-text line: its price is whatever was entered (§3.5: none
      // until entered), its cost is unknown, never a components snapshot.
      const snapshot = freeTextLineSnapshot(pending.description, pending.unitPriceFils ?? undefined);
      lines.push({
        id,
        productId: null,
        description: snapshot.description,
        quantityMilli: pending.quantityMilli,
        unitPriceFils: snapshot.unitPriceFils,
        unitCostFils: null,
        componentsSnapshot: null,
      });
    }
    linesSlot.lines = lines;
  };
}

/** Write the sale row and its lines (§3.4/§3.5) — FK-safe order: the sale
 * first, then its lines. */
function saleCreateExtraWrites(
  projectId: string,
  form: SaleForm,
  saleId: string,
  linesSlot: { lines: SaleLineWrite[] },
) {
  return async (context: { tx: TxQuery }): Promise<void> => {
    // R6 (the domain owns no clock): created_at/updated_at come from the
    // database's now() — the same pattern the M2.5 planners use.
    await context.tx`
      INSERT INTO sale (id, project_id, customer_name, registered_on, planned_delivery_on,
                        final_price_minor, tracked, hidden_from_tracker, note, created_at, updated_at)
      VALUES (${saleId}, ${projectId}, ${form.customerName ?? null}, ${form.registeredOn},
              ${form.plannedDeliveryOn}, ${form.finalPriceFils}, ${form.tracked}, ${false},
              ${form.note ?? null}, now(), now())`;
    for (const [index, line] of linesSlot.lines.entries()) {
      await context.tx`
        INSERT INTO sale_line (id, project_id, sale_id, position, product_id, description,
                               quantity_milli, unit_price_minor, unit_cost_minor, components_snapshot)
        VALUES (${line.id}, ${projectId}, ${saleId}, ${index + 1}, ${line.productId}, ${line.description},
                ${line.quantityMilli}, ${line.unitPriceFils}, ${line.unitCostFils}, ${line.componentsSnapshot})`;
    }
  };
}
