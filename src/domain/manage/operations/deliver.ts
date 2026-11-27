/**
 * M3.4 (Manage v2 phase 3 — spec §5 OP-DELIVER, §4 Q5, §6 transitions,
 * R-13/R-26/R-28; tests S1 delivery slice, T1 delivery half, T2/T3
 * delivery+collect slices, T17 pre-undo slice, T40, T49, T57): deliver the
 * sale at its final price.
 *
 * Contract (§5): sale_id; actual delivery date — default today, or when
 * planned_delivery_on < today the LATER of planned_delivery_on and the
 * latest active prepayment date (T49/T57); always ≤ today (R-13, a delivery
 * posts REV); optional immediate collection {amount, box} effective on the
 * actual delivery date (R-26). Validation: final price set
 * (E-PRICE-REQUIRED); not delivered, not cancelled (E-SALE-STATE); the
 * actual date ≥ the latest active prepayment date (E-DATE-ORDER, T40); a
 * same-day sale without a customer name must collect the full remaining
 * (E-NAME-REQUIRED-FOR-DEBT).
 *
 * Entries: Q5 (§4) — REV[s] +P (rev_kind delivery, dated the actual date);
 * PRE[s] −p; P > p → a new sale_remainder line with AR +(P−p); p > P → a
 * new customer_refund line with AP +(p−P) (T1). The immediate collection is
 * a SEPARATE OP-COLLECT operation created together ATOMICALLY — the M3.4
 * handler extension ("companion") runs M2.8's collect planner inside the
 * same transaction against the fresh remainder line; each operation stays
 * correctable on its own (R-28 groups them for display only).
 *
 * An immediate collection on a refund-owing sale (p > P: no remainder line
 * exists) has nothing to collect → E-AMOUNT (documented interpretation:
 * §5 offers the collection against the remainder only).
 *
 * PURE PLANNER: the sale's row (state, price, planned date, name), the
 * prepayment totals and the delivery state live in the database — resolved
 * inside the handler's transaction (`loadState`) with the sale row locked
 * FOR UPDATE (two concurrent deliveries of one sale serialize; the second
 * sees the first's Q5 and answers E-SALE-STATE).
 */
import { buildLedgerEntry } from "../ledger/index.js";
import { planCollect } from "./collect.js";
import {
  reject,
  requireContext,
  requireDate,
  requirePositiveFils,
  type OperationContextInput,
  type OperationPlan,
  type OperationWritePlan,
  type PlanBalanceLine,
  type TxQuery,
} from "./support.js";

/** The optional immediate collection (§5): {amount, box} — a separate
 * OP-COLLECT operation in the same transaction, effective on the actual
 * delivery date (R-26). */
export interface DeliverCollectionInput {
  amountFils: unknown;
  box: unknown;
}

export interface DeliverInput extends OperationContextInput {
  saleId: unknown;
  actualDeliveryOn?: unknown;
  collection?: DeliverCollectionInput;
}

/** The optional immediate collection (§5): {amount > 0, box kind}. */
function optionalCollection(
  collection: DeliverCollectionInput | undefined,
): { amountFils: number; box: "cash" | "account" } | undefined {
  if (collection === undefined) return undefined;
  const amountFils = requirePositiveFils(collection.amountFils);
  if (collection.box !== "cash" && collection.box !== "account") reject("E-AMOUNT");
  return { amountFils, box: collection.box };
}

/** Plan OP-DELIVER: validate the inputs, resolve the sale's state and post
 * Q5 inside the transaction, and attach the immediate collection as the
 * companion OP-COLLECT operation. */
export function planDeliver(input: DeliverInput): OperationPlan {
  const ctx = requireContext(input);
  if (typeof input.saleId !== "string" || input.saleId.length === 0) reject("E-AMOUNT");
  const actualDeliveryOn =
    input.actualDeliveryOn === undefined ? undefined : requireDate(input.actualDeliveryOn);
  const collection = optionalCollection(input.collection);
  const intent = {
    saleId: input.saleId,
    ...(actualDeliveryOn === undefined ? {} : { actualDeliveryOn }),
    ...(collection === undefined ? {} : { collection }),
  };
  const write: OperationWritePlan = {
    projectId: ctx.projectId,
    createdByAccountId: ctx.createdByAccountId,
    requestId: ctx.requestId,
    kind: "OP-DELIVER",
    // The actual date resolves inside the transaction (the §5 default
    // rules); the handler's response carries it.
    effectiveOn: actualDeliveryOn ?? ctx.today,
    amountFils: 0, // the price resolves inside the transaction
    saleId: input.saleId,
    payload: intent,
    intent,
    entries: [],
  };
  // The loadState → companion handoff: the resolved delivery facts (actual
  // date, price, prepayment, the fresh remainder line id) — this plan's own
  // closure slot, never module state.
  const resolved: {
    actualOn: string;
    priceFils: number;
    prepaymentFils: number;
    remainderLineId: string | null;
    refundLineId: string | null;
  } = { actualOn: "", priceFils: 0, prepaymentFils: 0, remainderLineId: null, refundLineId: null };
  return {
    write,
    loadState: deliverLoadState(ctx, input.saleId, actualDeliveryOn, collection, write, resolved),
    companion: async () => {
      if (collection === undefined || resolved.remainderLineId === null) return undefined;
      // The immediate collection: M2.8's OP-COLLECT planner against the
      // fresh remainder line, effective on the ACTUAL delivery date (R-26),
      // inside this same transaction (the line's outstanding is visible).
      return planCollect({
        projectId: ctx.projectId,
        createdByAccountId: ctx.createdByAccountId,
        requestId: ctx.requestId,
        today: ctx.today,
        amountFils: collection.amountFils,
        box: collection.box,
        balanceLineId: resolved.remainderLineId,
        effectiveOn: resolved.actualOn,
      });
    },
    resultData: async () => {
      const remainderOpen = resolved.priceFils - resolved.prepaymentFils - (collection?.amountFils ?? 0);
      const status = remainderOpen > 0 ? "delivered_unpaid" : "completed";
      return {
        saleId: input.saleId,
        deliveredOn: resolved.actualOn,
        status,
        ...(resolved.refundLineId !== null ? { customerRefundOpened: true } : {}),
      };
    },
  };
}

/** The sale's live row, locked and §5-checked: exists, not cancelled, not
 * already delivered (§3.4: a non-reversed Q5), final price set. */
async function lockedSaleState(
  tx: TxQuery,
  projectId: string,
  saleId: string,
): Promise<{ finalPriceFils: number; customerName: string | null; plannedDeliveryOn: string }> {
  const sales = (await tx`
    SELECT final_price_minor, customer_name, planned_delivery_on::text AS planned_delivery_on,
           cancelled_on::text AS cancelled_on
    FROM sale WHERE id = ${saleId} AND project_id = ${projectId}
    FOR UPDATE`) as Array<{
    final_price_minor: string | number | null;
    customer_name: string | null;
    planned_delivery_on: string;
    cancelled_on: string | null;
  }>;
  const sale = sales[0];
  if (sale === undefined || sale.cancelled_on !== null) reject("E-SALE-STATE");
  if (sale.final_price_minor === null) reject("E-PRICE-REQUIRED");
  const deliveries = (await tx`
    SELECT 1 FROM ledger_entry e
    JOIN operation o ON o.id = e.operation_id
    WHERE o.project_id = ${projectId} AND o.sale_id = ${saleId} AND e.entry_type = 'Q5'
      AND NOT EXISTS (SELECT 1 FROM ledger_entry r WHERE r.reverses_entry_id = e.id)`) as unknown[];
  if (deliveries.length > 0) reject("E-SALE-STATE");
  return {
    finalPriceFils: Number(sale.final_price_minor),
    customerName: sale.customer_name,
    plannedDeliveryOn: sale.planned_delivery_on,
  };
}

/** The sale's prepayment facts: p = PRE[s] (the net of every PRE posting —
 * reversals net to zero) and the latest ACTIVE prepayment date (a reversed
 * Q4 does not constrain the delivery date). */
async function prepaymentFacts(
  tx: TxQuery,
  projectId: string,
  saleId: string,
): Promise<{ totalFils: number; latestActiveOn: string | null }> {
  const totals = (await tx`
    SELECT COALESCE(SUM(p.delta_minor), 0)::bigint AS total
    FROM ledger_posting p WHERE p.project_id = ${projectId} AND p.account = 'PRE' AND p.ref_id = ${saleId}`) as Array<{
    total: string | number;
  }>;
  const latest = (await tx`
    SELECT e.effective_on::text AS effective_on
    FROM ledger_entry e
    JOIN operation o ON o.id = e.operation_id
    WHERE o.project_id = ${projectId} AND o.sale_id = ${saleId} AND e.entry_type = 'Q4'
      AND NOT EXISTS (SELECT 1 FROM ledger_entry r WHERE r.reverses_entry_id = e.id)
    ORDER BY e.effective_on DESC LIMIT 1`) as Array<{ effective_on: string }>;
  return { totalFils: Number(totals[0]!.total), latestActiveOn: latest[0]?.effective_on ?? null };
}

/** The §5 actual-date rules: default today; when the planned date has
 * passed, the LATER of the planned date and the latest active prepayment
 * date (T49/T57); an explicit date must be ≤ today (R-13) and ≥ the latest
 * active prepayment (T40's E-DATE-ORDER). */
function resolveActualOn(
  plannedDeliveryOn: string,
  latestPrepayOn: string | null,
  given: string | undefined,
  today: string,
): string {
  let actualOn: string;
  if (given !== undefined) {
    actualOn = given;
    if (actualOn > today) reject("E-FUTURE-DATE");
  } else if (plannedDeliveryOn >= today) {
    actualOn = today;
  } else {
    actualOn =
      latestPrepayOn !== null && latestPrepayOn > plannedDeliveryOn ? latestPrepayOn : plannedDeliveryOn;
  }
  if (latestPrepayOn !== null && actualOn < latestPrepayOn) reject("E-DATE-ORDER");
  return actualOn;
}

/** Q5 (§4) with its fresh remainder/refund line and the §5 write updates. */
function q5WithLines(
  saleId: string,
  actualOn: string,
  priceFils: number,
  prepaymentFils: number,
): {
  entry: ReturnType<typeof buildLedgerEntry>;
  balanceLines: PlanBalanceLine[];
  remainderLineId: string | null;
  refundLineId: string | null;
} {
  let remainderLineId: string | null = null;
  let refundLineId: string | null = null;
  const balanceLines: PlanBalanceLine[] = [];
  if (priceFils > prepaymentFils) {
    remainderLineId = crypto.randomUUID();
    balanceLines.push({
      id: remainderLineId,
      direction: "to_me",
      kind: "sale_remainder",
      originOn: actualOn,
      saleId,
    });
  } else if (prepaymentFils > priceFils) {
    refundLineId = crypto.randomUUID();
    balanceLines.push({
      id: refundLineId,
      direction: "by_me",
      kind: "customer_refund",
      originOn: actualOn,
      saleId,
    });
  }
  const entry = buildLedgerEntry({
    type: "Q5",
    effectiveOn: actualOn,
    saleId,
    priceFils,
    prepaymentFils,
    ...(remainderLineId !== null ? { remainderLineId } : {}),
    ...(refundLineId !== null ? { refundLineId } : {}),
  });
  return { entry, balanceLines, remainderLineId, refundLineId };
}

/** «Load state in the transaction» (§14.1): lock the sale, apply every §5
 * validation, resolve the default actual date, and build Q5 with its
 * remainder/refund line. */
function deliverLoadState(
  ctx: { projectId: string; today: string },
  saleId: string,
  actualDeliveryOn: string | undefined,
  collection: { amountFils: number; box: "cash" | "account" } | undefined,
  write: OperationWritePlan,
  resolved: {
    actualOn: string;
    priceFils: number;
    prepaymentFils: number;
    remainderLineId: string | null;
    refundLineId: string | null;
  },
): (tx: TxQuery) => Promise<void> {
  return async (tx: TxQuery) => {
    const state = await lockedSaleState(tx, ctx.projectId, saleId);
    const prepay = await prepaymentFacts(tx, ctx.projectId, saleId);
    const actualOn = resolveActualOn(
      state.plannedDeliveryOn,
      prepay.latestActiveOn,
      actualDeliveryOn,
      ctx.today,
    );
    const priceFils = state.finalPriceFils;
    // §5: a same-day sale without a customer name must collect the full
    // remaining — the remainder left open after the immediate collection
    // would be an unnamed debt (§3.4).
    if (state.customerName === null && priceFils > prepay.totalFils) {
      const openAfter = priceFils - prepay.totalFils - (collection?.amountFils ?? 0);
      if (openAfter > 0) reject("E-NAME-REQUIRED-FOR-DEBT");
    }
    // An immediate collection needs an open remainder (a refund-owing sale
    // has none) — documented interpretation of §5's collection offer.
    if (collection !== undefined && priceFils <= prepay.totalFils) reject("E-AMOUNT");
    const q5 = q5WithLines(saleId, actualOn, priceFils, prepay.totalFils);
    write.effectiveOn = actualOn;
    write.amountFils = priceFils;
    const lineId = q5.remainderLineId ?? q5.refundLineId;
    if (lineId !== null) write.balanceLineId = lineId;
    write.balanceLines = q5.balanceLines;
    write.entries = [q5.entry];
    resolved.actualOn = actualOn;
    resolved.priceFils = priceFils;
    resolved.prepaymentFils = prepay.totalFils;
    resolved.remainderLineId = q5.remainderLineId;
    resolved.refundLineId = q5.refundLineId;
  };
}
