/**
 * M3.5 (Manage v2 phase 3 — spec §5 OP-SALE-DELIVERY-COST, §4 Q8/Q10,
 * R-10, R-18; tests S1 complete, T30's delivery-portion shape, T43): the
 * sale's delivery cost — a PAID expense of the internal-only category
 * `sale_delivery` (R-10: never offered in the expense form; created ONLY
 * from a sale's delivery-cost field), from a box or from the owner's
 * personal money.
 *
 * Contract (§5): sale_id, amount (> 0), source: box k | `personal`,
 * effective_on (default today, ≤ today). Allowed in ANY sale state except
 * `cancelled` (E-SALE-STATE) — a delivered sale may still record its
 * delivery cost; multiple entries per sale are allowed. Entries:
 *   box k:        Q8(k, sale_delivery, a)
 *   personal:     Q10(cash, a) + Q8(cash, sale_delivery, a)   (R-18 —
 *                 personal money passes through the cash box and nets to
 *                 zero on it, T43)
 * The operation row carries category `sale_delivery` and
 * delivery_cost_minor = the amount (§5.0/§3.7 display: «منها توصيل»).
 *
 * The §8 expected-profit term "Σ EXP[sale_delivery] linked to s" reads
 * these postings (M2.11's read model already does — S1's 65 proves it).
 *
 * PURE PLANNER: the box (by kind, R-9) and the sale's cancelled state live
 * in the database — resolved inside the handler's transaction (`loadState`)
 * with the box locked FOR UPDATE (not active → E-BOX-STATE).
 */
import { buildLedgerEntry } from "../ledger/index.js";
import {
  reject,
  requireContext,
  requireDate,
  requirePositiveFils,
  type OperationContextInput,
  type OperationPlan,
  type OperationWritePlan,
  type TxQuery,
} from "./support.js";

export interface SaleDeliveryCostInput extends OperationContextInput {
  saleId: unknown;
  amountFils: unknown;
  source: unknown;
  effectiveOn?: unknown;
}

/** Plan OP-SALE-DELIVERY-COST: validate, then resolve the box and the
 * sale's state inside the transaction and post Q8 (+Q10 for personal). */
export function planSaleDeliveryCost(input: SaleDeliveryCostInput): OperationPlan {
  const ctx = requireContext(input);
  if (typeof input.saleId !== "string" || input.saleId.length === 0) reject("E-AMOUNT");
  const amountFils = requirePositiveFils(input.amountFils);
  if (input.source !== "cash" && input.source !== "account" && input.source !== "personal") {
    reject("E-AMOUNT");
  }
  const effectiveOn = input.effectiveOn === undefined ? ctx.today : requireDate(input.effectiveOn);
  if (effectiveOn > ctx.today) reject("E-FUTURE-DATE");
  const intent = { saleId: input.saleId, amountFils, source: input.source, effectiveOn };
  const write: OperationWritePlan = {
    projectId: ctx.projectId,
    createdByAccountId: ctx.createdByAccountId,
    requestId: ctx.requestId,
    kind: "OP-SALE-DELIVERY-COST",
    effectiveOn,
    amountFils,
    category: "sale_delivery",
    deliveryCostFils: amountFils,
    saleId: input.saleId,
    payload: intent,
    intent,
    // The box and the entries are resolved inside the transaction.
    entries: [],
  };
  return {
    write,
    loadState: saleDeliveryCostLoadState(
      ctx.projectId,
      input.saleId,
      amountFils,
      input.source,
      effectiveOn,
      write,
    ),
  };
}

/** «Load state in the transaction» (§14.1): the sale must exist and not be
 * cancelled (ANY other state is allowed, delivered included); the paying
 * box is the source's kind — cash for personal money (R-18). */
function saleDeliveryCostLoadState(
  projectId: string,
  saleId: string,
  amountFils: number,
  source: "cash" | "account" | "personal",
  effectiveOn: string,
  write: OperationWritePlan,
): (tx: TxQuery) => Promise<void> {
  return async (tx: TxQuery) => {
    const sales = (await tx`
      SELECT cancelled_on::text AS cancelled_on FROM sale
      WHERE id = ${saleId} AND project_id = ${projectId}`) as Array<{ cancelled_on: string | null }>;
    const sale = sales[0];
    if (sale === undefined || sale.cancelled_on !== null) reject("E-SALE-STATE");
    // R-18: personal money posts on the cash box.
    const kind = source === "personal" ? "cash" : source;
    const boxes = (await tx`
      SELECT id FROM box
      WHERE project_id = ${projectId} AND kind = ${kind} AND status = 'active'
      FOR UPDATE`) as Array<{ id: string }>;
    if (boxes.length === 0) reject("E-BOX-STATE");
    const boxId = String(boxes[0]!.id);
    write.boxId = boxId;
    if (source === "personal") {
      write.entries = [
        buildLedgerEntry({ type: "Q10", effectiveOn, boxId, amountFils }),
        buildLedgerEntry({ type: "Q8", effectiveOn, boxId, category: "sale_delivery", amountFils }),
      ];
      return;
    }
    write.entries = [
      buildLedgerEntry({ type: "Q8", effectiveOn, boxId, category: "sale_delivery", amountFils }),
    ];
  };
}
