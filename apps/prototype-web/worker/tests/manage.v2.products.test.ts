/**
 * M3.1 acceptance (Manage v2 phase 3 — spec §3.3 product/product_component,
 * §3.5 sale_line snapshot, §3.4 default final price, R-14, R-17, INV-5,
 * INV-7; owner decision D-5; tests T12, T14, T19): منتجاتي + لقطة البند.
 *
 * What THIS task owns (PLAN.md M3.1): the product catalog as plain updates
 * (R-17 — no operation, no ledger entry, INV-5), the §3.5 line snapshot the
 * sale operations copy from (product name, unit price, unit cost = Σ
 * components or unknown, edited components), and the §3.4 default final
 * price. OP-SALE-CREATE itself is M3.2 — its rows are seeded here (the
 * M2.11/M2.12 pattern) with the lines BUILT by M3.1's snapshot functions, so
 * the figures (M2.11's read model) prove the snapshot end to end.
 *
 * Tests-first: this file was written before the modules existed and fails
 * with "Cannot find module …domain/manage/products.js" (and …application/
 * manage/products.js).
 *
 * Posture: Miniflare over the per-file isolated PostgreSQL (migrations
 * 0001–0019). Money is integer fils: "25" in the spec's table is 25_000
 * fils; quantities are milli-units ("× 10" → 10_000). The domain owns no
 * clock. Every acceptance path ends with assertLedgerCoreInvariants
 * (INV-1 + INV-2); T12 additionally asserts INV-7 across the product edit.
 */
import type postgres from "postgres";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { apiGet, apiPost, signInAs, startWorker, type WorkerInstance } from "./harness.ts";
import { accountTotal, fileSqlUrl, ledgerState, scopedClient, setupProject } from "./manage.v2.helpers.ts";
import {
  defaultFinalPriceFils,
  freeTextLineSnapshot,
  productLineSnapshot,
  productUnitCostFils,
  validateProductForm,
} from "../../../../src/domain/manage/products.js";
import {
  listProducts,
  saveProduct,
  setProductArchived,
  type ProductSaveInput,
} from "../application/manage/products.js";
import { checkInv7 } from "../../../../src/domain/manage/invariants/index.js";
import { assertLedgerCoreInvariants } from "../../../../src/domain/manage/invariants/index.js";
import { computeManageFigures } from "../application/manage/readModel.js";
import type { SetupBoxSlot } from "../../../../src/domain/manage/operations/setup.js";
import { OperationRejected } from "../../../../src/domain/manage/operations/support.js";

let worker: WorkerInstance;
let dbUrl = "";

beforeAll(async () => {
  worker = await startWorker();
  dbUrl = await fileSqlUrl(worker);
});

afterAll(async () => {
  await worker.close();
});

const AMMAN_TODAY = "2026-11-27";

function suffix(): string {
  return Math.random().toString(36).slice(2, 10);
}

/** A request-scoped single-connection client, always released. */
async function withSql<T>(run: (sql: postgres.Sql) => Promise<T>): Promise<T> {
  const sql = scopedClient(dbUrl);
  try {
    return await run(sql);
  } finally {
    await sql.end();
  }
}

/** A project set up through the real composition (§13 default: one cash box,
 * known opening 0). */
async function newProject(boxes: SetupBoxSlot[] = [{ kind: "cash", opening: { openingFils: 0 } }]) {
  const projectId = crypto.randomUUID();
  const owner = `m31-owner-${suffix()}`;
  await withSql(sql => setupProject(sql, { projectId, owner, today: AMMAN_TODAY, boxes }));
  return { projectId, owner };
}

/** A product saved through the real application handler. */
async function addProduct(
  sql: postgres.Sql,
  projectId: string,
  input: Partial<ProductSaveInput> & { name: string },
): Promise<string> {
  const saved = await saveProduct(sql, {
    projectId,
    productId: input.productId ?? crypto.randomUUID(),
    name: input.name,
    unitLabel: input.unitLabel,
    unitPriceFils: input.unitPriceFils ?? 0,
    components: input.components ?? [],
  });
  return saved.productId;
}

/** Seed a sale whose lines were built by M3.1's snapshot functions, with an
 * optional delivery (Q5 + its remainder line) — the rows OP-SALE-CREATE /
 * OP-DELIVER will write in M3.2/M3.4 (the M2.11 seeding pattern; only the
 * line columns now come from the real snapshot builders). */
async function seedSale(
  sql: postgres.Sql,
  projectId: string,
  input: {
    customerName: string | null;
    registeredOn: string;
    plannedOn: string;
    finalPriceFils: number | null;
    lines: Array<{
      description: string;
      productId?: string;
      quantityMilli: number;
      unitPriceFils: number | null;
      unitCostFils: number | null;
      componentsSnapshot?: Array<{ name: string; cost_minor: number }> | null;
    }>;
    deliverOn?: string;
  },
): Promise<string> {
  const saleId = crypto.randomUUID();
  const createdAt = `${input.registeredOn}T10:00:00.000Z`;
  const firstOp = crypto.randomUUID();
  await sql`INSERT INTO sale (id, project_id, customer_name, registered_on, planned_delivery_on,
                              final_price_minor, tracked, hidden_from_tracker, created_at, updated_at)
            VALUES (${saleId}, ${projectId}, ${input.customerName}, ${input.registeredOn}, ${input.plannedOn},
                    ${input.finalPriceFils}, ${false}, ${false}, ${createdAt}, ${createdAt})`;
  await sql`INSERT INTO operation (id, project_id, kind, effective_on, status, sale_id, amount_minor, payload,
                                   created_by_account_id, created_at)
            VALUES (${firstOp}, ${projectId}, ${"OP-SALE-CREATE"}, ${input.registeredOn}, ${"active"}, ${saleId},
                    ${input.finalPriceFils}, ${"{}"}, ${"seed"}, ${createdAt})`;
  for (const [index, line] of input.lines.entries()) {
    await sql`INSERT INTO sale_line (id, project_id, sale_id, position, product_id, description,
                                     quantity_milli, unit_price_minor, unit_cost_minor, components_snapshot)
              VALUES (${crypto.randomUUID()}, ${projectId}, ${saleId}, ${index + 1},
                      ${line.productId ?? null}, ${line.description}, ${line.quantityMilli},
                      ${line.unitPriceFils}, ${line.unitCostFils},
                      ${
                        line.componentsSnapshot === undefined || line.componentsSnapshot === null
                          ? null
                          : JSON.stringify(line.componentsSnapshot)
                      })`;
  }
  if (input.deliverOn !== undefined && input.finalPriceFils !== null) {
    const deliverOp = crypto.randomUUID();
    const deliverEntry = crypto.randomUUID();
    const remainderLineId = crypto.randomUUID();
    await sql`INSERT INTO operation (id, project_id, kind, effective_on, status, sale_id, balance_line_id,
                                     amount_minor, payload, created_by_account_id, created_at)
              VALUES (${deliverOp}, ${projectId}, ${"OP-DELIVER"}, ${input.deliverOn}, ${"active"}, ${saleId},
                      ${remainderLineId}, ${input.finalPriceFils}, ${"{}"}, ${"seed"}, ${createdAt})`;
    await sql`INSERT INTO balance_line (id, project_id, direction, kind, counterparty_name, origin_on, sale_id,
                                        origin_operation_id)
              VALUES (${remainderLineId}, ${projectId}, ${"to_me"}, ${"sale_remainder"}, ${input.customerName},
                      ${input.deliverOn}, ${saleId}, ${deliverOp})`;
    await sql`INSERT INTO ledger_entry (id, project_id, operation_id, entry_type, effective_on, created_at)
              VALUES (${deliverEntry}, ${projectId}, ${deliverOp}, ${"Q5"}, ${input.deliverOn}, ${createdAt})`;
    await sql`INSERT INTO ledger_posting (id, project_id, entry_id, account, ref_id, rev_kind, delta_minor)
              VALUES (${crypto.randomUUID()}, ${projectId}, ${deliverEntry}, ${"REV"}, ${saleId}, ${"delivery"},
                      ${input.finalPriceFils})`;
    await sql`INSERT INTO ledger_posting (id, project_id, entry_id, account, ref_id, delta_minor)
              VALUES (${crypto.randomUUID()}, ${projectId}, ${deliverEntry}, ${"AR"}, ${remainderLineId},
                      ${input.finalPriceFils})`;
  }
  return saleId;
}

/* ── 1. §3.3: the product catalog (R-17 plain updates, INV-5) ──────────── */

describe("M3.1 — product save/list/archive (§3.3, R-17)", () => {
  it("creates a product with components; unit cost is Σ components, unknown when there are none", async () => {
    const ctx = await newProject();
    await withSql(async sql => {
      const saved = await saveProduct(sql, {
        projectId: ctx.projectId,
        productId: crypto.randomUUID(),
        name: "منسف",
        unitLabel: "صحن",
        unitPriceFils: 25_000,
        components: [
          { name: "لحم", costFils: 12_000 },
          { name: "جميد", costFils: 6_000 },
        ],
      });
      expect(saved).toMatchObject({
        name: "منسف",
        unitLabel: "صحن",
        unitPriceFils: 25_000,
        unitCostFils: 18_000,
        archived: false,
      });

      const noComponents = await saveProduct(sql, {
        projectId: ctx.projectId,
        productId: crypto.randomUUID(),
        name: "شاي",
        unitPriceFils: 1_000,
        components: [],
      });
      // §3.3: zero components → unknown (NULL), never 0.
      expect(noComponents.unitCostFils).toBeNull();
    });
  });

  it("rejects a missing name with E-NAME-REQUIRED and a missing unit price with E-UNIT-PRICE-REQUIRED", async () => {
    const ctx = await newProject();
    await withSql(async sql => {
      await expect(
        saveProduct(sql, {
          projectId: ctx.projectId,
          productId: crypto.randomUUID(),
          name: "  ",
          unitPriceFils: 5_000,
          components: [],
        }),
      ).rejects.toMatchObject({ code: "E-NAME-REQUIRED" });
      await expect(
        saveProduct(sql, {
          projectId: ctx.projectId,
          productId: crypto.randomUUID(),
          name: "منسف",
          unitPriceFils: Number.NaN,
          components: [],
        }),
      ).rejects.toMatchObject({ code: "E-UNIT-PRICE-REQUIRED" });
    });
  });

  it("discards a component row that lacks the name or the cost, and keeps one whose cost is 0 (§3.3)", async () => {
    const form = validateProductForm({
      name: "كنافة",
      unitPriceFils: 12_000,
      components: [
        { name: "جبن", costFils: 6_000 }, // complete — kept
        { name: "سكر" }, // no cost — discarded
        { costFils: 500 }, // no name — discarded
        { name: "ماء", costFils: 0 }, // explicit 0 is a value — kept
        { name: "  ", costFils: 3_000 }, // blank name — discarded
      ],
    });
    expect(form.components).toEqual([
      { name: "جبن", costFils: 6_000 },
      { name: "ماء", costFils: 0 },
    ]);
    // Σ kept components — the discarded rows never enter the cost.
    expect(productUnitCostFils(form.components)).toBe(6_000);
  });

  it("updates a product in place, archives and unarchives it — no operation row, no ledger entry (R-17/INV-5)", async () => {
    const ctx = await newProject();
    const productId = await withSql(async sql => {
      const id = await addProduct(sql, ctx.projectId, {
        name: "منسف",
        unitPriceFils: 25_000,
        components: [{ name: "لحم", costFils: 18_000 }],
      });
      // Update: new price, new components.
      const updated = await saveProduct(sql, {
        projectId: ctx.projectId,
        productId: id,
        name: "منسف ملكي",
        unitLabel: "طبق",
        unitPriceFils: 28_000,
        components: [{ name: "لحم بلدي", costFils: 20_000 }],
      });
      expect(updated).toMatchObject({ productId: id, name: "منسف ملكي", unitCostFils: 20_000 });
      // Archive → unarchive.
      expect(
        (await setProductArchived(sql, { projectId: ctx.projectId, productId: id, archived: true })).archived,
      ).toBe(true);
      expect(
        (await setProductArchived(sql, { projectId: ctx.projectId, productId: id, archived: false }))
          .archived,
      ).toBe(false);
      return id;
    });
    // R-17: a plain update — no operation row and no posting appeared.
    const operations = await withSql(
      sql => sql`SELECT kind FROM operation WHERE project_id = ${ctx.projectId}`,
    );
    expect(operations.filter(o => o.kind !== "OP-SETUP")).toHaveLength(0);
    const postings = await withSql(
      sql => sql`SELECT account FROM ledger_posting WHERE project_id = ${ctx.projectId}`,
    );
    expect(postings).toHaveLength(0);
    // One product row only — the update was in place.
    const rows = await withSql(sql => sql`SELECT id FROM product WHERE project_id = ${ctx.projectId}`);
    expect(rows).toHaveLength(1);
    expect(String(rows[0]!.id)).toBe(productId);
  });

  it("lists active and archived products with their unit cost (the P-22 source)", async () => {
    const ctx = await newProject();
    await withSql(async sql => {
      const monsaf = await addProduct(sql, ctx.projectId, {
        name: "منسف",
        unitPriceFils: 25_000,
        components: [{ name: "لحم", costFils: 18_000 }],
      });
      const knafeh = await addProduct(sql, ctx.projectId, {
        name: "كنافة",
        unitPriceFils: 12_000,
        components: [{ name: "جبن", costFils: 6_000 }],
      });
      await addProduct(sql, ctx.projectId, { name: "شاي قديم", unitPriceFils: 500 });
      await setProductArchived(sql, {
        projectId: ctx.projectId,
        productId: knafeh,
        archived: true,
      });

      const listing = await listProducts(sql, ctx.projectId);
      expect(listing.active.map(p => p.name)).toEqual(["منسف", "شاي قديم"]);
      expect(listing.archived.map(p => p.name)).toEqual(["كنافة"]);
      const listed = listing.active.find(p => p.productId === monsaf);
      expect(listed).toMatchObject({ unitPriceFils: 25_000, unitCostFils: 18_000 });
      expect(listing.active.find(p => p.name === "شاي قديم")?.unitCostFils).toBeNull();
      /* M5.3 (P-23 معبّاة): المكوّنات نفسها بترتيب position — مصدر المحرر. */
      expect(listed?.components).toEqual([{ name: "لحم", costFils: 18_000 }]);
      expect(listing.active.find(p => p.name === "شاي قديم")?.components).toEqual([]);
      /* المحفوظ يرجع مكوّناته كذلك (نفس الشكل). */
      const saved = await saveProduct(sql, {
        projectId: ctx.projectId,
        productId: crypto.randomUUID(),
        name: "محاشي",
        unitPriceFils: 15_000,
        components: [
          { name: "ورق عنب", costFils: 6_000 },
          { name: "رز", costFils: 2_500 },
        ],
      });
      expect(saved.components).toEqual([
        { name: "ورق عنب", costFils: 6_000 },
        { name: "رز", costFils: 2_500 },
      ]);
    });
  });
});

/* ── 2. §3.5: the line snapshot (T12 / INV-7) ─────────────────────────── */

describe("M3.1 T12 — the snapshot survives a product cost edit (INV-7)", () => {
  it("keeps the sale's expected profit on cost 18 after the product's cost changes to 20", async () => {
    const ctx = await newProject();
    const saleId = await withSql(async sql => {
      const productId = await addProduct(sql, ctx.projectId, {
        name: "منسف",
        unitPriceFils: 25_000,
        components: [{ name: "لحم", costFils: 18_000 }],
      });
      // The sale line copies the product AT SALE TIME (§5 snapshot rule).
      const product = (await sql`SELECT name, unit_price_minor FROM product WHERE id = ${productId}`)[0] as {
        name: string;
        unit_price_minor: string | number;
      };
      const snapshot = productLineSnapshot(
        { name: String(product.name), unitPriceFils: Number(product.unit_price_minor) },
        [{ name: "لحم", costFils: 18_000 }],
      );
      expect(snapshot).toEqual({
        description: "منسف",
        unitPriceFils: 25_000,
        unitCostFils: 18_000,
        componentsSnapshot: null,
      });
      return seedSale(sql, ctx.projectId, {
        customerName: "سامي",
        registeredOn: AMMAN_TODAY,
        plannedOn: AMMAN_TODAY,
        finalPriceFils: 25_000,
        lines: [
          {
            description: snapshot.description,
            productId,
            quantityMilli: 1_000,
            unitPriceFils: snapshot.unitPriceFils,
            unitCostFils: snapshot.unitCostFils,
            componentsSnapshot: snapshot.componentsSnapshot,
          },
        ],
      });
    });

    // Expected profit before the edit: 25 − 18 = 7.
    const before = await withSql(sql => ledgerState(sql, ctx.projectId));
    const figuresBefore = await withSql(sql =>
      computeManageFigures(sql, ctx.projectId, AMMAN_TODAY, "since_start"),
    );
    expect(figuresBefore.salesList.find(s => s.id === saleId)?.expectedProfitFils).toBe(7_000);

    // The product's cost changes to 20 — a plain update (R-17).
    await withSql(async sql => {
      const productId = String(
        (await sql`SELECT id FROM product WHERE project_id = ${ctx.projectId} LIMIT 1`)[0]!.id,
      );
      await saveProduct(sql, {
        projectId: ctx.projectId,
        productId,
        name: "منسف",
        unitPriceFils: 25_000,
        components: [{ name: "لحم", costFils: 20_000 }],
      });
    });

    // INV-7: the ledger state is untouched and the line keeps its snapshot.
    const after = await withSql(sql => ledgerState(sql, ctx.projectId));
    expect(checkInv7(before, after)).toMatchObject({ invariantId: "INV-7", outcome: "pass" });
    const lineRow = await withSql(
      sql => sql`SELECT unit_cost_minor FROM sale_line WHERE sale_id = ${saleId}`,
    );
    expect(lineRow[0]!.unit_cost_minor).toBe("18000");
    const figuresAfter = await withSql(sql =>
      computeManageFigures(sql, ctx.projectId, AMMAN_TODAY, "since_start"),
    );
    // T12: the sale's expected profit still uses 18 → 25 − 18 = 7.
    expect(figuresAfter.salesList.find(s => s.id === saleId)?.expectedProfitFils).toBe(7_000);

    await withSql(async sql => assertLedgerCoreInvariants(await ledgerState(sql, ctx.projectId)));
  });

  it("keeps an EDITED per-sale components snapshot distinct from the product's own (§3.5)", () => {
    const snapshot = productLineSnapshot(
      { name: "منسف", unitPriceFils: 25_000 },
      [
        { name: "لحم", costFils: 18_000 },
        { name: "جميد", costFils: 4_000 },
      ],
      [{ name: "لحم قليل", costFils: 10_000 }],
    );
    expect(snapshot.unitCostFils).toBe(10_000); // Σ of the EDITED components
    expect(snapshot.componentsSnapshot).toEqual([{ name: "لحم قليل", cost_minor: 10_000 }]);
  });
});

/* ── 3. T14: default price, expected profit, top sellers, top profit ───── */

describe("M3.1 T14 — منسف ×10 (25/18) + كنافة ×5 (12/6), default 310, final 300", () => {
  it("snapshots both lines, defaults the final price to 310 and delivers at 300", async () => {
    const ctx = await newProject();
    const saleId = await withSql(async sql => {
      const monsaf = await addProduct(sql, ctx.projectId, {
        name: "منسف",
        unitPriceFils: 25_000,
        components: [{ name: "لحم", costFils: 18_000 }],
      });
      const knafeh = await addProduct(sql, ctx.projectId, {
        name: "كنافة",
        unitPriceFils: 12_000,
        components: [{ name: "جبن", costFils: 6_000 }],
      });
      const monsafSnapshot = productLineSnapshot({ name: "منسف", unitPriceFils: 25_000 }, [
        { name: "لحم", costFils: 18_000 },
      ]);
      const knafehSnapshot = productLineSnapshot({ name: "كنافة", unitPriceFils: 12_000 }, [
        { name: "جبن", costFils: 6_000 },
      ]);
      const lines = [
        { ...monsafSnapshot, productId: monsaf, quantityMilli: 10_000 },
        { ...knafehSnapshot, productId: knafeh, quantityMilli: 5_000 },
      ];
      // §3.4: default final price = Σ round_half_up(qty × unit_price) = 250 + 60 = 310.
      expect(
        defaultFinalPriceFils(
          lines.map(l => ({ quantityMilli: l.quantityMilli, unitPriceFils: l.unitPriceFils })),
        ),
      ).toBe(310_000);
      return seedSale(sql, ctx.projectId, {
        customerName: "سامي",
        registeredOn: AMMAN_TODAY,
        plannedOn: AMMAN_TODAY,
        finalPriceFils: 300_000,
        lines: lines.map(l => ({
          description: l.description,
          productId: l.productId,
          quantityMilli: l.quantityMilli,
          unitPriceFils: l.unitPriceFils,
          unitCostFils: l.unitCostFils,
          componentsSnapshot: l.componentsSnapshot,
        })),
        deliverOn: AMMAN_TODAY,
      });
    });

    const figures = await withSql(sql =>
      computeManageFigures(sql, ctx.projectId, AMMAN_TODAY, "since_start"),
    );
    // Expected profit 90: 300 − (10×18 + 5×6).
    expect(figures.salesList.find(s => s.id === saleId)?.expectedProfitFils).toBe(90_000);
    // Top sellers: منسف 250 (10), كنافة 60 (5).
    expect(figures.topSellers).toEqual([
      { productId: expect.any(String), name: "منسف", valueFils: 250_000, quantityText: "10" },
      { productId: expect.any(String), name: "كنافة", valueFils: 60_000, quantityText: "5" },
    ]);
    // Top profit: منسف 70 (7.0/unit), كنافة 30 (6.0/unit).
    expect(figures.topProfit).toEqual([
      { productId: expect.any(String), name: "منسف", profitFils: 70_000, perUnitText: "7" },
      { productId: expect.any(String), name: "كنافة", profitFils: 30_000, perUnitText: "6" },
    ]);

    await withSql(async sql => assertLedgerCoreInvariants(await ledgerState(sql, ctx.projectId)));
  });
});

/* ── 4. T19: the free-text line ────────────────────────────────────────── */

describe("M3.1 T19 — free-text line «كيكة» price 40, delivered", () => {
  it("has an unknown expected profit, is excluded from the product cards, and posts REV +40", async () => {
    const ctx = await newProject();
    // A free-text line: no product, price entered at the line, cost unknown.
    const snapshot = freeTextLineSnapshot("كيكة", 40_000);
    expect(snapshot).toEqual({
      description: "كيكة",
      unitPriceFils: 40_000,
      unitCostFils: null,
      componentsSnapshot: null,
    });
    // Without an entered price the line carries none until one is entered (§3.5).
    expect(freeTextLineSnapshot("كيكة").unitPriceFils).toBeNull();

    await withSql(async sql => {
      await seedSale(sql, ctx.projectId, {
        customerName: "سامي",
        registeredOn: AMMAN_TODAY,
        plannedOn: AMMAN_TODAY,
        finalPriceFils: 40_000,
        lines: [
          {
            description: snapshot.description,
            quantityMilli: 1_000,
            unitPriceFils: snapshot.unitPriceFils,
            unitCostFils: snapshot.unitCostFils,
          },
        ],
        deliverOn: AMMAN_TODAY,
      });
    });

    const figures = await withSql(sql =>
      computeManageFigures(sql, ctx.projectId, AMMAN_TODAY, "since_start"),
    );
    // Expected profit NULL (the line's cost is unknown).
    expect(figures.salesList[0]?.expectedProfitFils).toBeNull();
    // Excluded from the product cards (free text is not a product line).
    expect(figures.topSellers).toEqual([]);
    expect(figures.topProfit).toEqual([]);
    // REV +40.
    expect(await withSql(sql => accountTotal(sql, ctx.projectId, "REV"))).toBe(40_000);

    await withSql(async sql => assertLedgerCoreInvariants(await ledgerState(sql, ctx.projectId)));
  });
});

/* ── 5. The HTTP surface (R-24 trust boundary) ────────────────────────── */

interface RouteProduct {
  productId: string;
  name: string;
  unitLabel: string | null;
  unitPriceFils: number;
  unitCostFils: number | null;
  archived: boolean;
}

describe("M3.1 — routes GET/POST /api/manage-v2/products", () => {
  it("saves, lists, archives and replays a retried save end-to-end; foreign projects are invisible", async () => {
    const sub = `m31-route-${suffix()}`;
    const session = await signInAs(worker, { sub, email: `${sub}@example.com` });
    const setup = await apiPost(worker, session.cookieHeader, "/api/manage-v2/setup", {
      requestId: `route-${suffix()}`,
      projectName: "مشروع منتجاتي",
      boxes: [{ kind: "cash", opening: { openingFils: 0 } }],
    });
    expect(setup.status).toBe(200);
    const projectId = ((await setup.json()) as { projectId: string }).projectId;

    const productId = crypto.randomUUID();
    const body = {
      projectId,
      productId,
      name: "منسف",
      unitLabel: "صحن",
      unitPriceFils: 25_000,
      components: [{ name: "لحم", costFils: 18_000 }],
    };
    const first = await apiPost(worker, session.cookieHeader, "/api/manage-v2/products", body);
    expect(first.status).toBe(200);
    const saved = (await first.json()) as { product: RouteProduct };
    expect(saved.product).toMatchObject({ productId, name: "منسف", unitCostFils: 18_000, archived: false });

    // A retried save with the same body is idempotent by construction (the
    // upsert rewrites the same values) — one row, same result.
    const retry = await apiPost(worker, session.cookieHeader, "/api/manage-v2/products", body);
    expect(retry.status).toBe(200);
    expect(((await retry.json()) as { product: RouteProduct }).product.productId).toBe(productId);

    // §11 rejections map to 400 + the code.
    const invalid = await apiPost(worker, session.cookieHeader, "/api/manage-v2/products", {
      projectId,
      productId: crypto.randomUUID(),
      name: "",
      unitPriceFils: 5_000,
      components: [],
    });
    expect(invalid.status).toBe(400);
    expect(((await invalid.json()) as { error: { details: { code: string } } }).error.details.code).toBe(
      "E-NAME-REQUIRED",
    );

    // Archive through the dedicated action, then list.
    const archived = await apiPost(worker, session.cookieHeader, "/api/manage-v2/products/archive", {
      projectId,
      productId,
      archived: true,
    });
    expect(archived.status).toBe(200);
    expect(((await archived.json()) as { product: RouteProduct }).product.archived).toBe(true);

    const list = await apiGet(worker, session.cookieHeader, `/api/manage-v2/products?projectId=${projectId}`);
    expect(list.status).toBe(200);
    const listing = (await list.json()) as { active: RouteProduct[]; archived: RouteProduct[] };
    expect(listing.active).toHaveLength(0);
    expect(listing.archived[0]).toMatchObject({ name: "منسف", unitCostFils: 18_000 });

    // R-24: another account's caller gets the same answer as "no project".
    const otherSub = `m31-other-${suffix()}`;
    const other = await signInAs(worker, { sub: otherSub, email: `${otherSub}@example.com` });
    const foreign = await apiPost(worker, other.cookieHeader, "/api/manage-v2/products", {
      projectId,
      productId: crypto.randomUUID(),
      name: "غريب",
      unitPriceFils: 1_000,
      components: [],
    });
    expect(foreign.status).toBe(404);
  });
});

/* ── 6. Domain rejection shape (the §11 contract) ─────────────────────── */

describe("M3.1 — validateProductForm rejections", () => {
  it("throws OperationRejected with the §3.3 codes", () => {
    expect(() => validateProductForm({ name: "", unitPriceFils: 5_000 })).toThrow(OperationRejected);
    expect(() => validateProductForm({ name: "منسف" })).toThrow(OperationRejected);
    expect(() => validateProductForm({ name: "منسف", unitPriceFils: -1 })).toThrow(OperationRejected);
  });
});
