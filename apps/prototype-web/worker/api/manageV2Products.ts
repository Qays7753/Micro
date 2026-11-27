/**
 * M3.1 (Manage v2 phase 3 — spec §3.3, R-17, R-24, INV-5; owner decision
 * D-5; tests T12, T14, T19): منتجاتي — the product-catalog HTTP surface
 * (`/api/manage-v2/products`), split from manageV2.ts at the file-size
 * ratchet band when phase 3 began adding route files.
 *
 * R-17 (binding): products are PLAIN UPDATES, not operations — no operation
 * row, no ledger entry, no balance line (INV-5); §5 has no OP-PRODUCT kind.
 * The application module (application/manage/products.ts) owns the direct
 * table writes; this file only adapts HTTP on the shared trust boundary
 * (manageV2Shared.ts): the caller's own project (R-24), the shared JSON
 * reader (SRV-02), and the §11 → 400 mapping (E-NAME-REQUIRED,
 * E-UNIT-PRICE-REQUIRED).
 *
 * Idempotency (R-25): the save is keyed by the CLIENT-GENERATED product id
 * — a retried request re-upserts the SAME id with the SAME values (idempotent
 * by construction; documented in the application module). A product id that
 * exists under another project answers the same 404 as "no such product".
 */
import { HttpError } from "../http.ts";
import { authedRoute } from "../routes.ts";
import type { ApiRouter } from "../router.ts";
import {
  listProducts,
  ProductNotFound,
  saveProduct,
  setProductArchived,
} from "../application/manage/products.js";
import type { ProductComponentInput } from "../../../../src/domain/manage/products.js";
import { jsonResponse, projectRead, projectWrite, toHttpError } from "./manageV2Shared.ts";

export function registerManageV2ProductRoutes(router: ApiRouter): void {
  // Save (create or update) one product with its components.
  router.post(
    "api/manage-v2/products",
    authedRoute(async (ctx, auth) => {
      const { sql, projectId, body } = await projectWrite(ctx, auth);
      try {
        const product = await saveProduct(sql, {
          projectId,
          productId: body.productId,
          name: body.name,
          ...(body.unitLabel === undefined ? {} : { unitLabel: body.unitLabel }),
          unitPriceFils: body.unitPriceFils,
          ...(body.components === undefined
            ? {}
            : { components: body.components as ProductComponentInput[] }),
        });
        return jsonResponse({ product });
      } catch (error) {
        if (error instanceof ProductNotFound) {
          throw new HttpError(404, "not_found", { surface: "manage_v2_product" });
        }
        toHttpError(error);
      }
    }),
  );

  // Archive / unarchive (§3.3: archived products leave the line suggestions
  // and can come back; existing sale lines never change, INV-7).
  router.post(
    "api/manage-v2/products/archive",
    authedRoute(async (ctx, auth) => {
      const { sql, projectId, body } = await projectWrite(ctx, auth);
      try {
        const product = await setProductArchived(sql, {
          projectId,
          productId: body.productId,
          archived: body.archived,
        });
        return jsonResponse({ product });
      } catch (error) {
        if (error instanceof ProductNotFound) {
          throw new HttpError(404, "not_found", { surface: "manage_v2_product" });
        }
        toHttpError(error);
      }
    }),
  );

  // The P-22 products list: active and archived, each with its §8.2 unit
  // cost (Σ components or unknown), computed on the server (D-5).
  router.get(
    "api/manage-v2/products",
    authedRoute(async (ctx, auth) => {
      const { sql, projectId } = await projectRead(ctx, auth);
      return jsonResponse(await listProducts(sql, projectId));
    }),
  );
}
