/**
 * M4.1/M4.2 (Manage v2 phase 4 — spec §5 OP-MERGE-BOXES / OP-SPLIT-BOXES,
 * §7.1 OP-RECONCILE, R-24): the box-lifecycle and reconciliation surfaces'
 * HTTP routes — phase 4's own route file (the M3.1 precedent for the
 * ratchet: one file per surface family, sharing manageV2Shared.ts).
 *
 * All are §5 operations through the M2.4 handler — the ONE transaction
 * with the atomic idempotency reservation (R-25). None takes a date
 * (R-26: today); the split takes the account amount (0 allowed), and the
 * reconcile takes the context + the counted amount per active box.
 */
import { authedRoute } from "../routes.ts";
import type { ApiRouter } from "../router.ts";
import { planMergeBoxes } from "../../../../src/domain/manage/operations/mergeBoxes.js";
import { planSplitBoxes } from "../../../../src/domain/manage/operations/splitBoxes.js";
import { planReconcile } from "../../../../src/domain/manage/operations/reconcile.js";
import { jsonResponse, planOr400, projectWrite, runPlan } from "./manageV2Shared.ts";

export function registerManageV2BoxRoutes(router: ApiRouter): void {
  // M4.1 — OP-MERGE-BOXES (§5): the Q14 that zeroes the account into
  // cash, then the account row merged. No inputs beyond the context.
  router.post(
    "api/manage-v2/merge-boxes",
    authedRoute(async (ctx, auth) => {
      const { sql, projectId, createdByAccountId, today, body } = await projectWrite(ctx, auth);
      const plan = planOr400(() =>
        planMergeBoxes({
          projectId,
          createdByAccountId,
          requestId: body.requestId,
          today,
        }),
      );
      return jsonResponse(await runPlan(sql, plan));
    }),
  );

  // M4.1 — OP-SPLIT-BOXES (§5): reactivate the merged account + the
  // user-entered amount as Q14 cash → account (0 → no entry, T59).
  router.post(
    "api/manage-v2/split-boxes",
    authedRoute(async (ctx, auth) => {
      const { sql, projectId, createdByAccountId, today, body } = await projectWrite(ctx, auth);
      const plan = planOr400(() =>
        planSplitBoxes({
          projectId,
          createdByAccountId,
          requestId: body.requestId,
          today,
          amountFils: body.amountFils,
        }),
      );
      return jsonResponse(await runPlan(sql, plan));
    }),
  );

  // M4.2 — OP-RECONCILE (§7.1): the reconciliation finish — Q19 per box
  // with the remaining Δ (computed from the ledger inside the
  // transaction) + the §3.10 rows. The counted amounts come from P-50;
  // the answers ran as their own operations before it.
  router.post(
    "api/manage-v2/reconcile",
    authedRoute(async (ctx, auth) => {
      const { sql, projectId, createdByAccountId, today, body } = await projectWrite(ctx, auth);
      const boxes = Array.isArray(body.boxes) ? body.boxes : [];
      const plan = planOr400(() =>
        planReconcile({
          projectId,
          createdByAccountId,
          requestId: body.requestId,
          today,
          context: body.context,
          boxes,
        }),
      );
      return jsonResponse(await runPlan(sql, plan));
    }),
  );
}
