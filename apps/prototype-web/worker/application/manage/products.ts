/**
 * M3.1 (Manage v2 phase 3 — spec §3.3, R-17, INV-5, INV-7; owner decision
 * D-5; tests T12, T14, T19): the worker-side product catalog — direct table
 * writes, NOT operations.
 *
 * Why no operation (R-17, binding): "Non-financial edits (project name,
 * sale fields before delivery, customer name, tracker flags, notes,
 * registered date, PRODUCTS) are plain updates, not operations." A product
 * save therefore creates NO `operation` row, NO ledger entry and NO balance
 * line (INV-5: product edits never change net profit); §5 has no OP-PRODUCT
 * kind at all. The writes below go straight to `product` / `product_component`
 * inside ONE transaction (a save that fails halfway leaves nothing behind).
 *
 * Idempotency (R-25): the save is keyed by the CLIENT-GENERATED product id —
 * a retried request re-upserts the SAME id with the SAME values and reads
 * back the SAME result (idempotent by construction, unlike operations whose
 * server-generated ids require the M2.4 reservation). No request-id
 * reservation is needed for an in-place upsert; this is documented here as
 * M3.1's binding interpretation of R-25 for the R-17 surface.
 *
 * Trust boundary: every query is scoped by `project_id`; a product id that
 * exists under ANOTHER project is indistinguishable from "no such product"
 * (`E-PRODUCT-NOT-FOUND` → 404 at the route, the R-24 posture: the surface
 * never confirms another project's rows).
 *
 * The §8.2 figures this module serves (P-22's unit cost column) are computed
 * HERE on the server (D-5: the client is thin) — Σ components or unknown,
 * through M3.1's pure `productUnitCostFils`, never a second implementation.
 */
import type postgres from "postgres";
import {
  productUnitCostFils,
  validateProductForm,
  type ProductComponentInput,
} from "../../../../../src/domain/manage/products.js";
import { OperationRejected } from "../../../../../src/domain/manage/operations/support.js";

/** A product row as the save's caller provides it (route body or test). */
export interface ProductSaveInput {
  projectId: string;
  /** The client-generated UUID: create (new id) or update (existing id). */
  productId: string;
  name: unknown;
  unitLabel?: unknown;
  unitPriceFils: unknown;
  components?: readonly ProductComponentInput[];
}

/** One component row as P-23's filled editor reads it (§3.3). */
export interface ProductComponentView {
  name: string;
  costFils: number;
}

/** One listed product (the P-22 source): every figure computed here. */
export interface ProductListItem {
  productId: string;
  name: string;
  unitLabel: string | null;
  unitPriceFils: number;
  /** §3.3: Σ components, or null when the product has none (unknown). */
  unitCostFils: number | null;
  archived: boolean;
  /** M5.3 (P-23 معبّاة): the stored components themselves, position order —
   * the editor loads them verbatim (a save without them would wipe the
   * catalog row wholesale, the save contract above). */
  components: ProductComponentView[];
}

/** A save/archive result: the stored row read back, cost included. */
export interface ProductSaveResult extends ProductListItem {}

/** The §11-style code for a product id that is not this project's — mapped
 * to the route's 404 (the R-24 "does not differ from no project" posture). */
export class ProductNotFound extends Error {
  readonly code = "E-PRODUCT-NOT-FOUND";
  constructor() {
    super("ProductNotFound");
  }
}

function requireProductId(value: unknown): string {
  if (typeof value !== "string" || value.length === 0) {
    throw new OperationRejected("E-AMOUNT");
  }
  return value;
}

/** Read one product row of THIS project, or throw ProductNotFound. */
async function productOf(
  sql: postgres.Sql,
  projectId: string,
  productId: string,
): Promise<{
  id: string;
  name: string;
  unit_label: string | null;
  unit_price_minor: string | number;
  archived: boolean;
}> {
  const rows = await sql`
    SELECT id, name, unit_label, unit_price_minor, archived
    FROM product WHERE id = ${productId} AND project_id = ${projectId}`;
  const row = rows[0];
  if (row === undefined) throw new ProductNotFound();
  return row as {
    id: string;
    name: string;
    unit_label: string | null;
    unit_price_minor: string | number;
    archived: boolean;
  };
}

/** Save (create or update) one product with its components — R-17: a plain
 * in-place update; components are replaced wholesale (the catalog is not a
 * financial record; R-11's append-only rule is the LEDGER's). One
 * transaction: the product row and its component rows commit together. */
export async function saveProduct(sql: postgres.Sql, input: ProductSaveInput): Promise<ProductSaveResult> {
  const productId = requireProductId(input.productId);
  const form = validateProductForm({
    name: input.name,
    unitLabel: input.unitLabel,
    unitPriceFils: input.unitPriceFils,
    components: input.components as unknown,
  });
  const now = new Date().toISOString();
  await sql.begin(async tx => {
    // Upsert scoped to THIS project: a foreign project's id never matches
    // (the WHERE on the conflict arm), and the read-back below then fails
    // honestly with ProductNotFound.
    const upserted = await tx`
      INSERT INTO product (id, project_id, name, unit_label, unit_price_minor, archived, created_at, updated_at)
      VALUES (${productId}, ${input.projectId}, ${form.name}, ${form.unitLabel ?? null}, ${form.unitPriceFils},
              ${false}, ${now}, ${now})
      ON CONFLICT (id) DO UPDATE SET
        name = EXCLUDED.name,
        unit_label = EXCLUDED.unit_label,
        unit_price_minor = EXCLUDED.unit_price_minor,
        updated_at = EXCLUDED.updated_at
      WHERE product.project_id = ${input.projectId}
      RETURNING id`;
    if (upserted.length === 0) {
      // The id exists under another project (or a raced delete): never
      // confirm it — same answer as "no such product".
      throw new ProductNotFound();
    }
    // Components are replaced wholesale: delete then re-insert, both inside
    // the same transaction (a product save is all-or-nothing).
    await tx`DELETE FROM product_component WHERE product_id = ${productId} AND project_id = ${input.projectId}`;
    for (const [index, component] of form.components.entries()) {
      await tx`
        INSERT INTO product_component (id, project_id, product_id, name, cost_minor, position)
        VALUES (${crypto.randomUUID()}, ${input.projectId}, ${productId}, ${component.name},
                ${component.costFils}, ${index + 1})`;
    }
  });
  const row = await productOf(sql, input.projectId, productId);
  return {
    productId: String(row.id),
    name: String(row.name),
    unitLabel: row.unit_label === null ? null : String(row.unit_label),
    unitPriceFils: Number(row.unit_price_minor),
    unitCostFils: productUnitCostFils(form.components),
    archived: Boolean(row.archived),
    components: form.components.map(c => ({ name: c.name, costFils: c.costFils })),
  };
}

/** The stored component rows of one product, position order (M5.3 — the
 * save/archive results and P-23's filled editor read the same shape). */
async function componentsOfProduct(
  sql: postgres.Sql,
  projectId: string,
  productId: string,
): Promise<ProductComponentView[]> {
  const rows = (await sql`
    SELECT name, cost_minor FROM product_component
    WHERE project_id = ${projectId} AND product_id = ${productId}
    ORDER BY position, id`) as Array<{ name: string; cost_minor: string | number }>;
  return rows.map(r => ({ name: String(r.name), costFils: Number(r.cost_minor) }));
}

/** The §3.3 unit cost of one product: Σ components, or null when it has
 * none (unknown — never 0). One query; the same rule the domain's pure
 * `productUnitCostFils` encodes. */
async function unitCostOf(sql: postgres.Sql, projectId: string, productId: string): Promise<number | null> {
  const rows = (await sql`
    SELECT COUNT(*)::int AS n, COALESCE(SUM(cost_minor), 0)::bigint AS total
    FROM product_component WHERE project_id = ${projectId} AND product_id = ${productId}`) as Array<{
    n: number;
    total: string | number;
  }>;
  const row = rows[0];
  if (row === undefined || Number(row.n) === 0) return null;
  return Number(row.total);
}

/** Archive or unarchive one product of this project (R-17: plain update; a
 * archived product is excluded from line suggestions and can be unarchived,
 * §3.3 — existing sale lines never change, INV-7). */
export async function setProductArchived(
  sql: postgres.Sql,
  input: { projectId: string; productId: unknown; archived: unknown },
): Promise<ProductSaveResult> {
  const productId = requireProductId(input.productId);
  if (typeof input.archived !== "boolean") throw new OperationRejected("E-AMOUNT");
  await productOf(sql, input.projectId, productId);
  await sql`
    UPDATE product SET archived = ${input.archived}, updated_at = ${new Date().toISOString()}
    WHERE id = ${productId} AND project_id = ${input.projectId}`;
  const row = await productOf(sql, input.projectId, productId);
  return {
    productId: String(row.id),
    name: String(row.name),
    unitLabel: row.unit_label === null ? null : String(row.unit_label),
    unitPriceFils: Number(row.unit_price_minor),
    unitCostFils: await unitCostOf(sql, input.projectId, productId),
    archived: Boolean(row.archived),
    components: await componentsOfProduct(sql, input.projectId, productId),
  };
}

/** The P-22 products list: active and archived, each with its §8.2 unit
 * cost (Σ components or unknown), computed here on the server (D-5). */
export async function listProducts(
  sql: postgres.Sql,
  projectId: string,
): Promise<{ active: ProductListItem[]; archived: ProductListItem[] }> {
  const products = (await sql`
    SELECT id, name, unit_label, unit_price_minor, archived FROM product
    WHERE project_id = ${projectId}
    ORDER BY archived, created_at, id`) as Array<{
    id: string;
    name: string;
    unit_label: string | null;
    unit_price_minor: string | number;
    archived: boolean;
  }>;
  const costs = (await sql`
    SELECT product_id, COALESCE(SUM(cost_minor), 0)::bigint AS total, COUNT(*)::int AS n
    FROM product_component WHERE project_id = ${projectId}
    GROUP BY product_id`) as Array<{ product_id: string; total: string | number; n: number }>;
  const costOf = new Map(costs.map(c => [String(c.product_id), Number(c.n) === 0 ? null : Number(c.total)]));
  // M5.3: the component rows themselves (position order) — P-23's filled
  // editor source; the cost above stays the server's Σ (D-5).
  const componentRows = (await sql`
    SELECT product_id, name, cost_minor FROM product_component
    WHERE project_id = ${projectId}
    ORDER BY product_id, position, id`) as Array<{
    product_id: string;
    name: string;
    cost_minor: string | number;
  }>;
  const componentsOf = new Map<string, ProductComponentView[]>();
  for (const row of componentRows) {
    const key = String(row.product_id);
    const list = componentsOf.get(key) ?? [];
    list.push({ name: String(row.name), costFils: Number(row.cost_minor) });
    componentsOf.set(key, list);
  }
  const toListItem = (p: (typeof products)[number]): ProductListItem => ({
    productId: String(p.id),
    name: String(p.name),
    unitLabel: p.unit_label === null ? null : String(p.unit_label),
    unitPriceFils: Number(p.unit_price_minor),
    // §3.3: zero components → unknown (null), never 0.
    unitCostFils: costOf.get(String(p.id)) ?? null,
    archived: Boolean(p.archived),
    components: componentsOf.get(String(p.id)) ?? [],
  });
  return {
    active: products.filter(p => !p.archived).map(toListItem),
    archived: products.filter(p => p.archived).map(toListItem),
  };
}
