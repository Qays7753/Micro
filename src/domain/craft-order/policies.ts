import type {
  CostSnapshot,
  CostSnapshotInput,
  CraftOrder,
  CreateCraftOrderInput,
  DepositSettlementDecision,
  KnowledgeState,
  MoneyMinor,
  OrderEvent,
  OrderEventType,
  OrderStatus,
  OrderTransitionInput,
  ResultStatus,
} from "./types.js";
import { JOD, assertNonNegativeInteger } from "../shared/index.js";

const ALLOWED_TRANSITIONS: Record<OrderStatus, readonly OrderStatus[]> = {
  draft: ["provisional_agreement", "needs_review"],
  provisional_agreement: ["confirmed", "postponed", "needs_review"],
  confirmed: ["in_progress", "postponed", "needs_review"],
  in_progress: ["ready", "postponed", "needs_review"],
  ready: ["delivered", "postponed", "needs_review"],
  delivered: ["settled", "needs_review"],
  settled: [],
  postponed: ["provisional_agreement", "confirmed", "needs_review"],
  cancelled: [],
  needs_review: ["provisional_agreement", "confirmed"],
};

function assertPositiveInteger(value: number, field: string): void {
  if (!Number.isInteger(value) || value <= 0) {
    throw new Error(`${field} must be a positive integer in minor currency units`);
  }
}

function assertValidQuantity(value: number): void {
  if (!Number.isFinite(value) || value <= 0) {
    throw new Error("quantity must be greater than zero");
  }
}

function assertValidDate(value: string, field: string): void {
  if (!value.trim() || Number.isNaN(Date.parse(value))) {
    throw new Error(`${field} must be a valid date`);
  }
}

function assertFreshnessDays(value: number | null | undefined): void {
  if (value !== null && value !== undefined && (!Number.isInteger(value) || value < 0)) {
    throw new Error("freshnessDays must be a non-negative integer");
  }
}

function assertIdempotencyKey(value: string): void {
  if (!value.trim()) throw new Error("idempotencyKey must be non-blank");
}

function cloneCostSnapshotInput(input: CostSnapshotInput): CostSnapshotInput {
  return {
    ...input,
    materialItems: input.materialItems.map(item => ({ ...item })),
    time: input.time ? { ...input.time } : null,
  };
}

function freezeCostSnapshot(snapshot: CostSnapshot): CostSnapshot {
  const input = cloneCostSnapshotInput(snapshot.input);
  input.materialItems.forEach(item => Object.freeze(item));
  Object.freeze(input.materialItems);
  if (input.time) Object.freeze(input.time);
  Object.freeze(input);
  return Object.freeze({ ...snapshot, input }) as CostSnapshot;
}

function assertSnapshotSelfConsistency(snapshot: CostSnapshot): void {
  if (snapshot.quantity !== snapshot.input.quantity) {
    throw new Error("cost snapshot quantity must match its input quantity");
  }
}

function determineKnowledgeState(input: CostSnapshotInput): KnowledgeState {
  const hasNoCostComponent =
    input.materialItems.length === 0 &&
    input.time === null &&
    input.packagingMinor === 0 &&
    input.deliveryMinor === 0 &&
    input.wasteMinor === 0;
  const hasEstimate =
    input.materialItems.some(item => item.confidence === "estimated") ||
    input.time?.confidence === "estimated";
  const hasVariableCost = input.materialItems.some(item => item.source === "estimate");
  const hasIncompleteTime =
    input.time === null ||
    input.time.minutes === null ||
    input.time.hourlyRateMinor === null ||
    input.time.minutes === 0 ||
    input.time.hourlyRateMinor === 0;

  if (hasNoCostComponent) return "incomplete";
  if (hasIncompleteTime) return "incomplete";

  if (input.freshnessDays !== null && input.freshnessDays !== undefined) {
    const createdAt = Date.parse(input.createdAt);
    const oldestAllowed = createdAt - input.freshnessDays * 24 * 60 * 60 * 1000;
    const hasStaleMaterial = input.materialItems.some(item => Date.parse(item.priceDate) < oldestAllowed);
    if (hasStaleMaterial) return "stale";
  }

  if (hasVariableCost) return "variable";
  if (hasEstimate) return "estimated";
  return "known";
}

export function calculateCostSnapshot(id: string, input: CostSnapshotInput): CostSnapshot {
  if (!id.trim()) throw new Error("snapshot id is required");
  if (input.currency !== JOD) throw new Error("only JOD is supported in the first slice");
  assertValidQuantity(input.quantity);
  assertValidDate(input.createdAt, "createdAt");
  assertFreshnessDays(input.freshnessDays);
  assertNonNegativeInteger(input.packagingMinor, "packagingMinor");
  assertNonNegativeInteger(input.deliveryMinor, "deliveryMinor");
  assertNonNegativeInteger(input.wasteMinor, "wasteMinor");
  assertNonNegativeInteger(input.safetyBufferMinor, "safetyBufferMinor");

  const materialCostMinor = input.materialItems.reduce((total, item) => {
    if (!item.name.trim() || !item.unit.trim()) {
      throw new Error("material name and unit are required");
    }
    if (!Number.isFinite(item.quantity) || item.quantity <= 0) {
      throw new Error(`material quantity must be greater than zero: ${item.name}`);
    }
    assertNonNegativeInteger(item.unitPriceMinor, `unitPriceMinor for ${item.name}`);
    assertValidDate(item.priceDate, `priceDate for ${item.name}`);
    return total + Math.round(item.quantity * item.unitPriceMinor);
  }, 0);

  const timeCostMinor = input.time
    ? (() => {
        const { minutes, hourlyRateMinor } = input.time!;
        if (minutes !== null && (!Number.isFinite(minutes) || minutes < 0)) {
          throw new Error("time minutes must be non-negative");
        }
        if (hourlyRateMinor !== null) {
          assertNonNegativeInteger(hourlyRateMinor, "hourlyRateMinor");
        }
        if (minutes === null || hourlyRateMinor === null) return 0;
        return Math.round((minutes / 60) * hourlyRateMinor);
      })()
    : 0;

  const plannedCostMinor =
    materialCostMinor + timeCostMinor + input.packagingMinor + input.deliveryMinor + input.wasteMinor;
  const unitCostMinor = Math.ceil(plannedCostMinor / input.quantity);
  const priceFloorMinor = unitCostMinor + input.safetyBufferMinor;

  return freezeCostSnapshot({
    id,
    currency: input.currency,
    materialCostMinor,
    timeCostMinor,
    packagingMinor: input.packagingMinor,
    deliveryMinor: input.deliveryMinor,
    wasteMinor: input.wasteMinor,
    plannedCostMinor,
    unitCostMinor,
    priceFloorMinor,
    quantity: input.quantity,
    knowledgeState: determineKnowledgeState(input),
    input: cloneCostSnapshotInput(input),
    createdAt: input.createdAt,
  });
}

function eventExists(order: CraftOrder, idempotencyKey: string, eventType: OrderEventType): boolean {
  return order.events.some(event => event.idempotencyKey === idempotencyKey && event.type === eventType);
}

function assertNotLockedDeliveredReview(order: CraftOrder): void {
  if (order.status === "needs_review" && hasDeliveredEvent(order)) {
    throw new Error("delivered order requires an explicit correction before leaving needs_review");
  }
}

function hasDeliveredEvent(order: CraftOrder): boolean {
  return order.events.some(event => event.type === "status_changed" && event.toStatus === "delivered");
}

function appendEvent(order: CraftOrder, event: OrderEvent): CraftOrder {
  if (eventExists(order, event.idempotencyKey, event.type)) return order;
  return { ...order, events: [...order.events, event] };
}

function appendStatusChanged(
  order: CraftOrder,
  fromStatus: OrderStatus,
  toStatus: OrderStatus,
  idempotencyKey: string,
  createdAt: string,
  note?: string,
): CraftOrder {
  if (fromStatus === toStatus) return order;
  return appendEvent(order, {
    id: `${order.id}:status:${idempotencyKey}`,
    type: "status_changed",
    idempotencyKey: `status:${idempotencyKey}`,
    createdAt,
    ...(note ? { note } : {}),
    fromStatus,
    toStatus,
  });
}

function withSettlement(order: CraftOrder): CraftOrder {
  const receivableMinor = Math.max(order.agreedPriceMinor - order.collectedMinor, 0);
  const settlementStatus =
    order.collectedMinor === 0 ? "unpaid" : receivableMinor === 0 ? "paid" : "partially_paid";

  return { ...order, receivableMinor, settlementStatus };
}

function resultStatusForKnowledge(knowledgeState: KnowledgeState): ResultStatus {
  if (knowledgeState === "known") return "final";
  if (knowledgeState === "incomplete" || knowledgeState === "partial") {
    return "incomplete";
  }
  if (knowledgeState === "stale" || knowledgeState === "variable") {
    return "review_required";
  }
  return "estimated";
}

export function createCraftOrder(input: CreateCraftOrderInput): CraftOrder {
  if (!input.id.trim()) throw new Error("order id is required");
  if (!input.customerName.trim()) throw new Error("customer name is required");
  if (!input.itemName.trim()) throw new Error("item name is required");
  if (!input.specifications.trim()) throw new Error("specifications are required");
  assertValidQuantity(input.quantity);
  assertPositiveInteger(input.agreedPriceMinor, "agreedPriceMinor");
  assertSnapshotSelfConsistency(input.costSnapshot);
  if (input.costSnapshot.quantity !== input.quantity) {
    throw new Error("cost snapshot quantity must match order quantity");
  }
  const safeCostSnapshot = freezeCostSnapshot(input.costSnapshot);

  const order: CraftOrder = {
    id: input.id,
    customerName: input.customerName,
    itemName: input.itemName,
    specifications: input.specifications,
    quantity: input.quantity,
    currency: input.costSnapshot.currency,
    agreedPriceMinor: input.agreedPriceMinor,
    costSnapshot: safeCostSnapshot,
    costSnapshots: Object.freeze([safeCostSnapshot]) as unknown as CostSnapshot[],
    status: "draft",
    settlementStatus: "unpaid",
    depositCollectedMinor: 0,
    depositSettlement: null,
    collectedMinor: 0,
    receivableMinor: input.agreedPriceMinor,
    recognizedRevenueMinor: 0,
    recognizedCostMinor: 0,
    profitIndicatorMinor: null,
    resultStatus: "incomplete",
    nextAction: "سجل الاتفاق أو راجع المواصفات",
    events: [],
    createdAt: input.createdAt,
  };

  return appendEvent(order, {
    id: `${input.id}:created`,
    type: "created",
    idempotencyKey: `${input.id}:created`,
    createdAt: input.createdAt,
  });
}

export function transitionOrder(order: CraftOrder, input: OrderTransitionInput): CraftOrder {
  assertIdempotencyKey(input.idempotencyKey);
  if (eventExists(order, input.idempotencyKey, "status_changed")) return order;
  assertNotLockedDeliveredReview(order);
  if (!ALLOWED_TRANSITIONS[order.status].includes(input.to)) {
    throw new Error(`invalid transition: ${order.status} -> ${input.to}`);
  }
  if (input.to === "settled" && order.receivableMinor > 0 && order.settlementStatus !== "debt") {
    throw new Error("settled order requires zero receivable or a registered debt");
  }

  const deliveredAction =
    order.receivableMinor > 0 ? "حصّل المتبقي أو سجل الدين" : "راجع النتيجة والفعل التالي";
  const nextActionByStatus: Record<OrderStatus, string> = {
    draft: "سجل الاتفاق أو راجع المواصفات",
    provisional_agreement: "أكد السعر والموعد",
    confirmed: "ابدأ التنفيذ",
    in_progress: "سجل الجاهزية أو سبب التأجيل",
    ready: "سجل التسليم",
    delivered: deliveredAction,
    settled: "راجع النتيجة والفعل التالي",
    postponed: "حدد موعد متابعة",
    cancelled: "راجع إغلاق الطلب وتسوية العربون إن وجدت",
    needs_review: "راجع التعارض أو النقص",
  };

  const next = {
    ...order,
    status: input.to,
    nextAction: nextActionByStatus[input.to],
  };
  const reviewSafe =
    input.to === "needs_review"
      ? { ...next, resultStatus: "review_required" as const, profitIndicatorMinor: null }
      : next;

  const recognized =
    input.to === "delivered" || input.to === "settled"
      ? (() => {
          const resultStatus = resultStatusForKnowledge(reviewSafe.costSnapshot.knowledgeState);
          const profitIndicatorMinor =
            resultStatus === "final"
              ? reviewSafe.agreedPriceMinor - reviewSafe.costSnapshot.plannedCostMinor
              : null;
          return {
            ...reviewSafe,
            recognizedRevenueMinor: reviewSafe.agreedPriceMinor,
            recognizedCostMinor: reviewSafe.costSnapshot.plannedCostMinor,
            profitIndicatorMinor,
            resultStatus,
          };
        })()
      : reviewSafe;

  const shouldSettleAfterDelivery =
    input.to === "delivered" && recognized.receivableMinor === 0 && recognized.settlementStatus === "paid";
  const statusAfterDelivery = shouldSettleAfterDelivery
    ? { ...recognized, status: "settled" as const, nextAction: "راجع النتيجة والفعل التالي" }
    : recognized;
  const withDeliveryStatusEvent = shouldSettleAfterDelivery
    ? appendEvent(statusAfterDelivery, {
        id: `${order.id}:status:${input.idempotencyKey}`,
        type: "status_changed",
        idempotencyKey: `status:${input.idempotencyKey}`,
        createdAt: input.createdAt,
        fromStatus: "delivered",
        toStatus: "settled",
      })
    : statusAfterDelivery;

  return appendEvent(withDeliveryStatusEvent, {
    id: `${order.id}:${input.idempotencyKey}`,
    type: "status_changed",
    idempotencyKey: input.idempotencyKey,
    createdAt: input.createdAt,
    ...(input.note ? { note: input.note } : {}),
    fromStatus: order.status,
    toStatus: input.to,
  });
}

export function reviseOrderCost(
  order: CraftOrder,
  specifications: string,
  nextCostSnapshot: CostSnapshot,
  idempotencyKey: string,
  createdAt: string,
): CraftOrder {
  assertIdempotencyKey(idempotencyKey);
  if (eventExists(order, idempotencyKey, "specification_revised")) return order;
  assertNotLockedDeliveredReview(order);
  if (!specifications.trim()) throw new Error("revised specifications are required");
  assertSnapshotSelfConsistency(nextCostSnapshot);
  if (nextCostSnapshot.quantity !== order.quantity) {
    throw new Error("revised cost snapshot quantity must match order quantity");
  }
  if (order.status === "delivered" || order.status === "settled" || order.status === "cancelled") {
    throw new Error(`cannot revise order in ${order.status} status`);
  }
  const safeCostSnapshot = freezeCostSnapshot(nextCostSnapshot);

  const next: CraftOrder = {
    ...order,
    specifications,
    costSnapshot: safeCostSnapshot,
    costSnapshots: Object.freeze([...order.costSnapshots, safeCostSnapshot]) as unknown as CostSnapshot[],
    status: "needs_review",
    resultStatus: "review_required",
    profitIndicatorMinor: null,
    nextAction: "راجع السعر والمواصفات مع الزبون",
  };

  const withStatusEvent = appendStatusChanged(
    next,
    order.status,
    "needs_review",
    idempotencyKey,
    createdAt,
    "specification revision requires review",
  );
  return appendEvent(withStatusEvent, {
    id: `${order.id}:${idempotencyKey}`,
    type: "specification_revised",
    idempotencyKey,
    createdAt,
    note: `cost snapshot: ${safeCostSnapshot.id}`,
  });
}

export function collectDeposit(
  order: CraftOrder,
  amountMinor: MoneyMinor,
  idempotencyKey: string,
  createdAt: string,
): CraftOrder {
  assertIdempotencyKey(idempotencyKey);
  if (eventExists(order, idempotencyKey, "deposit_collected")) return order;
  assertNotLockedDeliveredReview(order);
  if (order.status === "delivered" || order.status === "settled" || order.status === "cancelled") {
    throw new Error(`cannot collect deposit in ${order.status} status`);
  }
  assertPositiveInteger(amountMinor, "deposit amount");
  if (amountMinor + order.collectedMinor > order.agreedPriceMinor) {
    throw new Error("deposit cannot exceed the agreed price");
  }

  const next = withSettlement({
    ...order,
    depositCollectedMinor: order.depositCollectedMinor + amountMinor,
    collectedMinor: order.collectedMinor + amountMinor,
    nextAction: "نفذ الطلب ثم سجل التسليم",
  });

  return appendEvent(next, {
    id: `${order.id}:${idempotencyKey}`,
    type: "deposit_collected",
    idempotencyKey,
    createdAt,
    amountMinor,
  });
}

export function collectRemaining(
  order: CraftOrder,
  amountMinor: MoneyMinor,
  idempotencyKey: string,
  createdAt: string,
): CraftOrder {
  assertIdempotencyKey(idempotencyKey);
  if (eventExists(order, idempotencyKey, "collection_recorded")) return order;
  assertNotLockedDeliveredReview(order);
  if (order.status !== "delivered") {
    throw new Error("remaining collection requires a delivered order");
  }
  assertPositiveInteger(amountMinor, "collection amount");
  if (amountMinor + order.collectedMinor > order.agreedPriceMinor) {
    throw new Error("collection cannot exceed the agreed price");
  }

  const next = withSettlement({
    ...order,
    collectedMinor: order.collectedMinor + amountMinor,
    nextAction: "راجع النتيجة والفعل التالي",
  });
  const settled = next.receivableMinor === 0 ? { ...next, status: "settled" as const } : next;
  const withStatusEvent = appendStatusChanged(
    settled,
    order.status,
    settled.status,
    idempotencyKey,
    createdAt,
  );

  return appendEvent(withStatusEvent, {
    id: `${order.id}:${idempotencyKey}`,
    type: "collection_recorded",
    idempotencyKey,
    createdAt,
    amountMinor,
  });
}

/** A customer debt exists only when the owner explicitly registered the remainder as debt; a receivable on a draft or un-agreed order is not one. */
export function isRegisteredCustomerDebt(order: CraftOrder): boolean {
  return order.settlementStatus === "debt" && order.receivableMinor > 0;
}

export function registerDebt(order: CraftOrder, idempotencyKey: string, createdAt: string): CraftOrder {
  assertIdempotencyKey(idempotencyKey);
  if (eventExists(order, idempotencyKey, "debt_registered")) return order;
  assertNotLockedDeliveredReview(order);
  if (order.status !== "delivered") {
    throw new Error("debt requires a delivered order");
  }
  if (order.receivableMinor <= 0) {
    throw new Error("cannot register debt with no remaining amount");
  }

  const next: CraftOrder = {
    ...order,
    status: "settled",
    settlementStatus: "debt",
    nextAction: "تابع تحصيل الدين",
  };
  const withStatusEvent = appendStatusChanged(next, order.status, "settled", idempotencyKey, createdAt);

  return appendEvent(withStatusEvent, {
    id: `${order.id}:${idempotencyKey}`,
    type: "debt_registered",
    idempotencyKey,
    createdAt,
    amountMinor: order.receivableMinor,
  });
}

export function cancelOrder(
  order: CraftOrder,
  reason: string,
  idempotencyKey: string,
  createdAt: string,
): CraftOrder {
  assertIdempotencyKey(idempotencyKey);
  if (eventExists(order, idempotencyKey, "cancelled")) return order;
  assertNotLockedDeliveredReview(order);
  if (order.status === "delivered" || order.status === "settled" || order.status === "cancelled") {
    throw new Error(`cannot cancel order in ${order.status} status`);
  }
  if (!reason.trim()) throw new Error("cancellation reason is required");

  const hasDeposit = order.depositCollectedMinor > 0;
  const next: CraftOrder = {
    ...order,
    status: "cancelled",
    settlementStatus: hasDeposit ? "cancelled_pending" : "cancelled",
    depositSettlement: hasDeposit ? "needs_review" : null,
    receivableMinor: 0,
    resultStatus: "review_required",
    profitIndicatorMinor: null,
    nextAction: hasDeposit ? "راجع قرار رد العربون أو الاحتفاظ به" : "أرشف سبب الإلغاء وراجع أي مواد مرتبطة",
  };

  const withStatusEvent = appendStatusChanged(
    next,
    order.status,
    "cancelled",
    idempotencyKey,
    createdAt,
    reason,
  );

  return appendEvent(withStatusEvent, {
    id: `${order.id}:${idempotencyKey}`,
    type: "cancelled",
    idempotencyKey,
    createdAt,
    note: reason,
  });
}

function settleDeposit(
  order: CraftOrder,
  decision: Exclude<DepositSettlementDecision, "needs_review">,
  eventType: Extract<OrderEventType, "deposit_refunded" | "deposit_retained">,
  amountMinor: MoneyMinor,
  reason: string,
  idempotencyKey: string,
  createdAt: string,
): CraftOrder {
  assertIdempotencyKey(idempotencyKey);
  if (eventExists(order, idempotencyKey, eventType)) return order;
  if (order.status !== "cancelled") {
    throw new Error("deposit settlement requires a cancelled order");
  }
  if (order.depositSettlement !== "needs_review") {
    throw new Error("deposit settlement is already decided");
  }
  if (!reason.trim()) throw new Error("deposit settlement reason is required");
  assertPositiveInteger(amountMinor, "settlement amount");
  if (amountMinor !== order.depositCollectedMinor) {
    throw new Error("settlement amount must equal the collected deposit");
  }

  const isRefund = decision === "refund_deposit";
  const next: CraftOrder = {
    ...order,
    depositSettlement: decision,
    settlementStatus: isRefund ? "cancelled_refunded" : "cancelled_retained",
    collectedMinor: isRefund ? order.collectedMinor - amountMinor : order.collectedMinor,
    receivableMinor: 0,
    nextAction: "أرشف قرار تسوية الإلغاء",
  };

  return appendEvent(next, {
    id: `${order.id}:${idempotencyKey}`,
    type: eventType,
    idempotencyKey,
    createdAt,
    amountMinor,
    note: reason,
  });
}

export function settleDepositRefund(
  order: CraftOrder,
  amountMinor: MoneyMinor,
  reason: string,
  idempotencyKey: string,
  createdAt: string,
): CraftOrder {
  return settleDeposit(
    order,
    "refund_deposit",
    "deposit_refunded",
    amountMinor,
    reason,
    idempotencyKey,
    createdAt,
  );
}

export function settleDepositRetain(
  order: CraftOrder,
  amountMinor: MoneyMinor,
  reason: string,
  idempotencyKey: string,
  createdAt: string,
): CraftOrder {
  return settleDeposit(
    order,
    "retain_deposit",
    "deposit_retained",
    amountMinor,
    reason,
    idempotencyKey,
    createdAt,
  );
}
