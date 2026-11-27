/**
 * M3.1 (Manage v2 phase 3 — spec §3.3 `product`/`product_component`, §3.5
 * `sale_line` snapshot, §3.4 default final price, R-14, R-17, INV-5, INV-7;
 * owner decision D-5; tests T12, T14, T19): منتجاتي + لقطة البند — the PURE
 * domain of the product catalog and the line snapshot.
 *
 * What lives here (D-5: the domain is `src/domain/manage/`, pure, no I/O):
 *  - the §3.3 product form validation: name required (`E-NAME-REQUIRED`),
 *    unit price required (`E-UNIT-PRICE-REQUIRED`, ≥ 0 — a 0 price is a
 *    value), unit label optional; a component row needs BOTH the name and
 *    the cost or is DISCARDED (§3.3 verbatim — a partial row is removed at
 *    save, never an error; an explicit cost of 0 is a provided value).
 *  - the unit cost rule: unit cost = Σ components; zero components →
 *    UNKNOWN (null), never 0 (§3.3).
 *  - the §3.5 line snapshot: a product line copies the product's name,
 *    unit price, unit cost and (when the sale overrides them) the EDITED
 *    components — the sale line is its own source of truth afterwards
 *    (INV-7: editing a product never changes an existing sale line). A
 *    free-text line carries its description, no price until one is entered,
 *    and an unknown cost.
 *  - the §3.4 default final price: Σ round_half_up(quantity × unit_price)
 *    over the lines that have a price; null when none does (the user must
 *    enter a price).
 *
 * Purity: no database, no clock, no Arabic UI text. Products are R-17 plain
 * updates — the worker-side application module (M3.1,
 * worker/application/manage/products.ts) owns the direct table writes; NO
 * operation row and NO ledger entry is ever created for a product save
 * (INV-5), which is why this module has no planner at all.
 *
 * Money is integer fils end to end; quantities are positive milli-integers;
 * names are free text, trimmed (R-14).
 */
import { mulFilsByQuantityMilli } from "./money/index.js";
import { reject, requireName } from "./operations/support.js";

/** A component row as it arrives from the route layer — every field
 * `unknown` until validated. */
export interface ProductComponentInput {
  name?: unknown;
  costFils?: unknown;
}

/** A validated component row (§3.3): both the name and the cost provided. */
export interface ProductComponentForm {
  name: string;
  costFils: number;
}

/** The unvalidated product form as it arrives from the route layer. */
export interface ProductFormInput {
  name?: unknown;
  unitLabel?: unknown;
  unitPriceFils?: unknown;
  components?: unknown;
}

/** The validated product form: every field confirmed, partial component
 * rows discarded. */
export interface ProductForm {
  name: string;
  unitLabel: string | undefined;
  unitPriceFils: number;
  components: ProductComponentForm[];
}

/** A non-negative integer fils cost, or undefined when the row did not
 * provide one. */
function providedCost(value: unknown): number | undefined {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 0) return undefined;
  return value;
}

/** One component row: kept only when BOTH the trimmed name and the cost are
 * provided (§3.3: "a component row needs both name and cost or is
 * discarded"). An explicit cost of 0 IS provided — a free ingredient is a
 * value; a missing or fractional/negative one is not. */
function componentForm(row: unknown): ProductComponentForm | null {
  if (row === null || typeof row !== "object") return null;
  const { name, costFils } = row as { name?: unknown; costFils?: unknown };
  if (typeof name !== "string") return null;
  const trimmed = name.trim();
  const cost = providedCost(costFils);
  if (trimmed.length === 0 || cost === undefined) return null;
  return { name: trimmed, costFils: cost };
}

/** The §3.3 unit price: required, a non-negative integer fils amount
 * (`E-UNIT-PRICE-REQUIRED` — a price of 0 is a value, §3.3 allows ≥ 0). */
function requireUnitPriceFils(value: unknown): number {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 0) {
    reject("E-UNIT-PRICE-REQUIRED");
  }
  return value;
}

/** The optional unit label (§3.3): free text, trimmed; empty → none. */
function optionalUnitLabel(value: unknown): string | undefined {
  if (value === undefined || value === null) return undefined;
  if (typeof value !== "string") reject("E-AMOUNT");
  const trimmed = value.trim();
  return trimmed.length === 0 ? undefined : trimmed;
}

/** Validate the §3.3 product form: name required, unit price required
 * (≥ 0); the unit label is optional free text (trimmed; empty → none);
 * partial component rows are discarded, not errors. */
export function validateProductForm(input: ProductFormInput): ProductForm {
  const name = requireName(input.name);
  const unitPriceFils = requireUnitPriceFils(input.unitPriceFils);
  const components: ProductComponentForm[] = [];
  if (input.components !== undefined && input.components !== null) {
    if (!Array.isArray(input.components)) reject("E-AMOUNT");
    for (const row of input.components) {
      const form = componentForm(row);
      if (form !== null) components.push(form);
    }
  }
  return { name, unitLabel: optionalUnitLabel(input.unitLabel), unitPriceFils, components };
}

/** §3.3: unit cost = Σ component costs; zero components → UNKNOWN (null),
 * never 0. This is the product's CURRENT cost — a sale line copies it into
 * its own snapshot and never reads it again (INV-7). */
export function productUnitCostFils(components: readonly ProductComponentForm[]): number | null {
  if (components.length === 0) return null;
  let total = 0;
  for (const component of components) total += component.costFils;
  return total;
}

/** The §3.5 snapshot of one product line, copied at sale time (§5
 * OP-SALE-CREATE): the product's name and unit price, the unit cost = Σ
 * components (null when the product has none), and — only when the sale
 * OVERRIDES the components — the edited components themselves as
 * `components_snapshot` (null otherwise). The snapshot is the line's own
 * source of truth: a later product edit never reaches it (T12 / INV-7). */
export function productLineSnapshot(
  product: { name: string; unitPriceFils: number },
  components: readonly ProductComponentForm[],
  editedComponents?: readonly ProductComponentForm[],
): {
  description: string;
  unitPriceFils: number;
  unitCostFils: number | null;
  componentsSnapshot: Array<{ name: string; cost_minor: number }> | null;
} {
  const overridden = editedComponents ?? components;
  return {
    description: product.name,
    unitPriceFils: product.unitPriceFils,
    unitCostFils: productUnitCostFils(overridden),
    componentsSnapshot:
      editedComponents === undefined
        ? null
        : // §3.5 verbatim: the persisted snapshot key is cost_minor.
          editedComponents.map(c => ({ name: c.name, cost_minor: c.costFils })),
  };
}

/** The §3.5 free-text line: a description (required — R-14 free text,
 * trimmed), no price until one is entered, an unknown cost, never a
 * components snapshot. */
export function freeTextLineSnapshot(
  description: unknown,
  unitPriceFils?: unknown,
): {
  description: string;
  unitPriceFils: number | null;
  unitCostFils: null;
  componentsSnapshot: null;
} {
  return {
    description: requireName(description),
    unitPriceFils:
      typeof unitPriceFils === "number" && Number.isSafeInteger(unitPriceFils) && unitPriceFils >= 0
        ? unitPriceFils
        : null,
    unitCostFils: null,
    componentsSnapshot: null,
  };
}

/** §3.4: the default final price of a sale = Σ round_half_up(quantity ×
 * unit_price) over the lines that have a price (the M1.7 kernel's single
 * half-up per multiplication, R-2). Lines without a price contribute
 * nothing; when NO line has a price the default is null — the price must be
 * entered. */
export function defaultFinalPriceFils(
  lines: ReadonlyArray<{ quantityMilli: number; unitPriceFils: number | null }>,
): number | null {
  let total: number | null = null;
  for (const line of lines) {
    if (line.unitPriceFils === null) continue;
    const value = mulFilsByQuantityMilli(line.unitPriceFils, line.quantityMilli);
    total = (total ?? 0) + value;
  }
  return total;
}
