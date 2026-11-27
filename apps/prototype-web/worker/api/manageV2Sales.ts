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
import type { RouteContext } from "../router.ts";
import type { AuthenticatedContext } from "../auth/session.ts";
import type postgres from "postgres";
import { planSaleCreate } from "../../../../src/domain/manage/operations/saleCreate.js";
import { planPrepayment } from "../../../../src/domain/manage/operations/prepayment.js";
import { planDeliver } from "../../../../src/domain/manage/operations/deliver.js";
import { planSaleDeliveryCost } from "../../../../src/domain/manage/operations/saleDeliveryCost.js";
import { planCancelSale } from "../../../../src/domain/manage/operations/cancelSale.js";
import { planReturn } from "../../../../src/domain/manage/operations/saleReturn.js";
import { planPriceCorrection } from "../../../../src/domain/manage/operations/priceCorrection.js";
import { planUndoDelivery } from "../../../../src/domain/manage/operations/undoDelivery.js";
import {
  SaleNotFound,
  addSaleToTracker,
  hideSaleFromTracker,
  updateSaleFields,
} from "../application/manage/saleEdits.js";
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

  // M3.4 — OP-DELIVER (§5): Q5 at the actual delivery date (the §5
  // default rules), the remainder/refund line, and the optional immediate
  // collection as a SEPARATE OP-COLLECT in the same transaction.
  router.post(
    "api/manage-v2/deliver",
    authedRoute(async (ctx, auth) => {
      const { sql, projectId, body, createdByAccountId, today } = await projectWrite(ctx, auth);
      const plan = planOr400(() =>
        planDeliver({
          projectId,
          createdByAccountId,
          requestId: body.requestId,
          today,
          saleId: body.saleId,
          ...(body.actualDeliveryOn === undefined ? {} : { actualDeliveryOn: body.actualDeliveryOn }),
          ...(body.collection === undefined
            ? {}
            : {
                collection: {
                  amountFils: (body.collection as Record<string, unknown>).amountFils,
                  box: (body.collection as Record<string, unknown>).box,
                },
              }),
        }),
      );
      return jsonResponse(await runPlan(sql, plan));
    }),
  );

  // M3.5 — OP-SALE-DELIVERY-COST (§5): the sale's delivery cost — Q8 of
  // the internal-only category sale_delivery (from a box, or personal
  // money through cash, R-18); any sale state except cancelled.
  router.post(
    "api/manage-v2/sale-delivery-cost",
    authedRoute(async (ctx, auth) => {
      const { sql, projectId, body, createdByAccountId, today } = await projectWrite(ctx, auth);
      const plan = planOr400(() =>
        planSaleDeliveryCost({
          projectId,
          createdByAccountId,
          requestId: body.requestId,
          today,
          saleId: body.saleId,
          amountFils: body.amountFils,
          source: body.source,
          ...(body.effectiveOn === undefined ? {} : { effectiveOn: body.effectiveOn }),
        }),
      );
      return jsonResponse(await runPlan(sql, plan));
    }),
  );

  // M3.6 — OP-CANCEL-SALE (§5): final cancellation — Q15 with the kept
  // amount and the refund choice; cancelled_on set; today's date (R-26).
  router.post(
    "api/manage-v2/cancel-sale",
    authedRoute(async (ctx, auth) => {
      const { sql, projectId, body, createdByAccountId, today } = await projectWrite(ctx, auth);
      const plan = planOr400(() =>
        planCancelSale({
          projectId,
          createdByAccountId,
          requestId: body.requestId,
          today,
          saleId: body.saleId,
          ...(body.keptFils === undefined ? {} : { keptFils: body.keptFils }),
          ...(body.refund === undefined ? {} : { refund: body.refund as never }),
        }),
      );
      return jsonResponse(await runPlan(sql, plan));
    }),
  );

  // M3.7 — OP-RETURN (§5): Q16 on a delivered sale — REV −r dated the
  // return date, x off the remainder, y refunded now or later.
  router.post(
    "api/manage-v2/return",
    authedRoute(async (ctx, auth) => {
      const { sql, projectId, body, createdByAccountId, today } = await projectWrite(ctx, auth);
      const plan = planOr400(() =>
        planReturn({
          projectId,
          createdByAccountId,
          requestId: body.requestId,
          today,
          saleId: body.saleId,
          amountFils: body.amountFils,
          refund: body.refund as never,
          ...(body.effectiveOn === undefined ? {} : { effectiveOn: body.effectiveOn }),
        }),
      );
      return jsonResponse(await runPlan(sql, plan));
    }),
  );

  // M3.8 — OP-PRICE-CORRECTION (§5): the after-delivery price fix — Q20 of
  // the active Q5 + a new Q5 at the new price on the delivery date.
  router.post(
    "api/manage-v2/price-correction",
    authedRoute(async (ctx, auth) => {
      const { sql, projectId, body, createdByAccountId, today } = await projectWrite(ctx, auth);
      const plan = planOr400(() =>
        planPriceCorrection({
          projectId,
          createdByAccountId,
          requestId: body.requestId,
          today,
          saleId: body.saleId,
          newPriceFils: body.newPriceFils,
        }),
      );
      return jsonResponse(await runPlan(sql, plan));
    }),
  );

  // M3.9 — OP-UNDO-DELIVERY (§5): reverse the delivery and its tied
  // collections/write-offs/overpayments; the collected money becomes a
  // prepayment (Q4s at the same box, amount and date).
  router.post(
    "api/manage-v2/undo-delivery",
    authedRoute(async (ctx, auth) => {
      const { sql, projectId, body, createdByAccountId, today } = await projectWrite(ctx, auth);
      const plan = planOr400(() =>
        planUndoDelivery({
          projectId,
          createdByAccountId,
          requestId: body.requestId,
          today,
          saleId: body.saleId,
        }),
      );
      return jsonResponse(await runPlan(sql, plan));
    }),
  );

  // M3.11 — the tracker actions (§5 OP-TRACKER-HIDE / OP-TRACKER-ADD, UX
  // P-78): the FIXED §5 semantics as direct field updates (R-17/D-14 — no
  // operation row, no ledger row; T31: «ما بيغير ولا رقم»). Hide sets
  // hidden_from_tracker only; add sets tracked = true AND
  // hidden_from_tracker = false.
  const trackerAction =
    (action: (sql: postgres.Sql, input: { projectId: string; saleId: unknown }) => Promise<unknown>) =>
    async (ctx: RouteContext, auth: AuthenticatedContext): Promise<Response> => {
      const { sql, projectId, body } = await projectWrite(ctx, auth);
      try {
        const sale = await action(sql, { projectId, saleId: body.saleId });
        return jsonResponse({ sale });
      } catch (error) {
        if (error instanceof SaleNotFound) {
          throw new HttpError(404, "not_found", { surface: "manage_v2_sale" });
        }
        toHttpError(error);
      }
    };
  router.post("api/manage-v2/tracker-hide", authedRoute(trackerAction(hideSaleFromTracker)));
  router.post("api/manage-v2/tracker-add", authedRoute(trackerAction(addSaleToTracker)));

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
