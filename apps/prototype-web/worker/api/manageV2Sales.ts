/**
 * M3.2 (Manage v2 phase 3 — spec §5 OP-SALE-CREATE, §3.4, §6, R-17/D-14,
 * R-24; tests S1 create slice, T20, T21, T44, T48): the sale surfaces' HTTP
 * routes — phase 3's own route file (the M3.1 precedent for the ratchet:
 * one file per surface family, sharing manageV2Shared.ts).
 *
 * Two DIFFERENT kinds of surface live here, deliberately:
 *  - OP-SALE-CREATE (`/sale-create`): a §5 operation through the M2.4
 *    handler — the ONE transaction with the atomic idempotency reservation
 *    (R-25), entries none, the sale + lines written by the plan's
 *    extraWrites.
 *  - The non-financial field edits (`/sale-fields`): R-17/D-14 direct row
 *    updates — NO operation, NO ledger row; idempotent by construction (the
 *    same provided values rewrite), the M3.1 products posture.
 */
import { HttpError } from "../http.ts";
import { authedRoute } from "../routes.ts";
import type { ApiRouter } from "../router.ts";
import { planSaleCreate } from "../../../../src/domain/manage/operations/saleCreate.js";
import { planPrepayment } from "../../../../src/domain/manage/operations/prepayment.js";
import { SaleNotFound, updateSaleFields } from "../application/manage/saleEdits.js";
import { jsonResponse, planOr400, projectWrite, runPlan, toHttpError } from "./manageV2Shared.ts";

export function registerManageV2SaleRoutes(router: ApiRouter): void {
  // M3.2 — OP-SALE-CREATE (§5): create a sale/order; no money moves. The
  // product lines' snapshots resolve inside the transaction; §11 rejections
  // (E-NO-LINES, E-QTY, E-NAME-REQUIRED for future sales) are plain 400s.
  router.post(
    "api/manage-v2/sale-create",
    authedRoute(async (ctx, auth) => {
      const { sql, projectId, body, createdByAccountId, today } = await projectWrite(ctx, auth);
      const plan = planOr400(() =>
        planSaleCreate({
          projectId,
          createdByAccountId,
          requestId: body.requestId,
          today,
          lines: body.lines,
          plannedDeliveryOn: body.plannedDeliveryOn,
          ...(body.finalPriceFils === undefined ? {} : { finalPriceFils: body.finalPriceFils }),
          ...(body.customerName === undefined ? {} : { customerName: body.customerName }),
          ...(body.tracked === undefined ? {} : { tracked: body.tracked }),
          ...(body.note === undefined ? {} : { note: body.note }),
          ...(body.registeredOn === undefined ? {} : { registeredOn: body.registeredOn }),
        }),
      );
      return jsonResponse(await runPlan(sql, plan));
    }),
  );

  // M3.3 — OP-PREPAYMENT (§5): money received on an undelivered sale —
  // Q4 on the resolved active box; the sale must be neither delivered nor
  // cancelled (E-SALE-STATE inside the transaction).
  router.post(
    "api/manage-v2/prepayment",
    authedRoute(async (ctx, auth) => {
      const { sql, projectId, body, createdByAccountId, today } = await projectWrite(ctx, auth);
      const plan = planOr400(() =>
        planPrepayment({
          projectId,
          createdByAccountId,
          requestId: body.requestId,
          today,
          saleId: body.saleId,
          amountFils: body.amountFils,
          box: body.box,
          ...(body.effectiveOn === undefined ? {} : { effectiveOn: body.effectiveOn }),
        }),
      );
      return jsonResponse(await runPlan(sql, plan));
    }),
  );

  // M3.2 — the non-financial field edits (R-17/D-14, T44): customer name,
  // note, registered date, tracker flags — a direct update with no
  // operation and no ledger row; the sale's remainder/refund lines follow a
  // rename through the sale (§3.6).
  router.post(
    "api/manage-v2/sale-fields",
    authedRoute(async (ctx, auth) => {
      const { sql, projectId, body } = await projectWrite(ctx, auth);
      try {
        const sale = await updateSaleFields(sql, {
          projectId,
          saleId: body.saleId,
          ...(body.customerName === undefined ? {} : { customerName: body.customerName }),
          ...(body.note === undefined ? {} : { note: body.note }),
          ...(body.registeredOn === undefined ? {} : { registeredOn: body.registeredOn }),
          ...(body.tracked === undefined ? {} : { tracked: body.tracked }),
          ...(body.hiddenFromTracker === undefined ? {} : { hiddenFromTracker: body.hiddenFromTracker }),
        });
        return jsonResponse({ sale });
      } catch (error) {
        if (error instanceof SaleNotFound) {
          throw new HttpError(404, "not_found", { surface: "manage_v2_sale" });
        }
        toHttpError(error);
      }
    }),
  );
}
