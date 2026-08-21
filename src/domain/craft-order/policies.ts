import type {
  CostSnapshot,
  CostSnapshotInput,
  CraftOrder,
  CreateCraftOrderInput,
  KnowledgeState,
  MoneyMinor,
  OrderEvent,
  OrderStatus,
  OrderTransitionInput,
} from './types.js';

const ALLOWED_TRANSITIONS: Record<OrderStatus, readonly OrderStatus[]> = {
  draft: ['provisional_agreement', 'cancelled', 'needs_review'],
  provisional_agreement: ['confirmed', 'postponed', 'cancelled', 'needs_review'],
  confirmed: ['in_progress', 'postponed', 'cancelled', 'needs_review'],
  in_progress: ['ready', 'postponed', 'cancelled', 'needs_review'],
  ready: ['delivered', 'postponed', 'cancelled', 'needs_review'],
  delivered: ['settled', 'needs_review'],
  settled: [],
  postponed: ['provisional_agreement', 'confirmed', 'cancelled', 'needs_review'],
  cancelled: [],
  needs_review: ['provisional_agreement', 'confirmed', 'cancelled'],
};

function assertPositiveInteger(value: number, field: string): void {
  if (!Number.isInteger(value) || value <= 0) {
    throw new Error(`${field} must be a positive integer in minor currency units`);
  }
}

function assertNonNegativeInteger(value: number, field: string): void {
  if (!Number.isInteger(value) || value < 0) {
    throw new Error(`${field} must be a non-negative integer in minor currency units`);
  }
}

function assertValidQuantity(value: number): void {
  if (!Number.isFinite(value) || value <= 0) {
    throw new Error('quantity must be greater than zero');
  }
}

function determineKnowledgeState(input: CostSnapshotInput): KnowledgeState {
  const hasMissingMaterial = input.materialItems.some(
    (item) => !item.name.trim() || !item.unit.trim() || item.quantity <= 0,
  );
  const hasEstimate =
    input.materialItems.some((item) => item.confidence === 'estimated') ||
    input.time?.confidence === 'estimated';
  const hasVariableCost = input.materialItems.some(
    (item) => item.source === 'estimate',
  );

  if (hasMissingMaterial) return 'incomplete';
  if (hasVariableCost) return 'variable';
  if (hasEstimate) return 'estimated';
  return 'known';
}

export function calculateCostSnapshot(
  id: string,
  input: CostSnapshotInput,
): CostSnapshot {
  if (!id.trim()) throw new Error('snapshot id is required');
  if (input.currency !== 'JOD') throw new Error('only JOD is supported in the first slice');
  assertValidQuantity(input.quantity);
  assertNonNegativeInteger(input.packagingMinor, 'packagingMinor');
  assertNonNegativeInteger(input.deliveryMinor, 'deliveryMinor');
  assertNonNegativeInteger(input.wasteMinor, 'wasteMinor');
  assertNonNegativeInteger(input.safetyBufferMinor, 'safetyBufferMinor');

  const materialCostMinor = input.materialItems.reduce((total, item) => {
    if (!item.name.trim() || !item.unit.trim()) {
      throw new Error('material name and unit are required');
    }
    if (!Number.isFinite(item.quantity) || item.quantity <= 0) {
      throw new Error(`material quantity must be greater than zero: ${item.name}`);
    }
    assertNonNegativeInteger(item.unitPriceMinor, `unitPriceMinor for ${item.name}`);
    return total + Math.round(item.quantity * item.unitPriceMinor);
  }, 0);

  const timeCostMinor = input.time
    ? (() => {
        if (!Number.isFinite(input.time!.minutes) || input.time!.minutes < 0) {
          throw new Error('time minutes must be non-negative');
        }
        assertNonNegativeInteger(input.time!.hourlyRateMinor, 'hourlyRateMinor');
        return Math.round((input.time!.minutes / 60) * input.time!.hourlyRateMinor);
      })()
    : 0;

  const plannedCostMinor =
    materialCostMinor +
    timeCostMinor +
    input.packagingMinor +
    input.deliveryMinor +
    input.wasteMinor;
  const unitCostMinor = Math.ceil(plannedCostMinor / input.quantity);
  const priceFloorMinor = unitCostMinor + input.safetyBufferMinor;

  return {
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
    input,
    createdAt: input.createdAt,
  };
}

function eventExists(order: CraftOrder, idempotencyKey: string): boolean {
  return order.events.some((event) => event.idempotencyKey === idempotencyKey);
}

function appendEvent(
  order: CraftOrder,
  event: OrderEvent,
): CraftOrder {
  if (eventExists(order, event.idempotencyKey)) return order;
  return { ...order, events: [...order.events, event] };
}

function withSettlement(order: CraftOrder): CraftOrder {
  const receivableMinor = Math.max(order.agreedPriceMinor - order.collectedMinor, 0);
  const settlementStatus =
    order.collectedMinor === 0
      ? 'unpaid'
      : receivableMinor === 0
        ? 'paid'
        : 'partially_paid';

  return { ...order, receivableMinor, settlementStatus };
}

export function createCraftOrder(input: CreateCraftOrderInput): CraftOrder {
  if (!input.id.trim()) throw new Error('order id is required');
  if (!input.customerName.trim()) throw new Error('customer name is required');
  if (!input.itemName.trim()) throw new Error('item name is required');
  if (!input.specifications.trim()) throw new Error('specifications are required');
  assertValidQuantity(input.quantity);
  assertPositiveInteger(input.agreedPriceMinor, 'agreedPriceMinor');

  const order: CraftOrder = {
    id: input.id,
    customerName: input.customerName,
    itemName: input.itemName,
    specifications: input.specifications,
    quantity: input.quantity,
    currency: 'JOD',
    agreedPriceMinor: input.agreedPriceMinor,
    costSnapshot: input.costSnapshot,
    costSnapshots: [input.costSnapshot],
    status: 'draft',
    settlementStatus: 'unpaid',
    depositCollectedMinor: 0,
    collectedMinor: 0,
    receivableMinor: input.agreedPriceMinor,
    recognizedRevenueMinor: 0,
    recognizedCostMinor: 0,
    profitIndicatorMinor: null,
    nextAction: 'سجل الاتفاق أو راجع المواصفات',
    events: [],
    createdAt: input.createdAt,
  };

  return appendEvent(order, {
    id: `${input.id}:created`,
    type: 'created',
    idempotencyKey: `${input.id}:created`,
    createdAt: input.createdAt,
  });
}

export function transitionOrder(
  order: CraftOrder,
  input: OrderTransitionInput,
): CraftOrder {
  if (eventExists(order, input.idempotencyKey)) return order;
  if (!ALLOWED_TRANSITIONS[order.status].includes(input.to)) {
    throw new Error(`invalid transition: ${order.status} -> ${input.to}`);
  }

  const nextActionByStatus: Record<OrderStatus, string> = {
    draft: 'سجل الاتفاق أو راجع المواصفات',
    provisional_agreement: 'أكد السعر والموعد',
    confirmed: 'ابدأ التنفيذ',
    in_progress: 'سجل الجاهزية أو سبب التأجيل',
    ready: 'سجل التسليم',
    delivered: 'حصّل المتبقي أو سجل الدين',
    settled: 'راجع النتيجة والفعل التالي',
    postponed: 'حدد موعد متابعة',
    cancelled: 'راجع تسوية العربون والمواد',
    needs_review: 'راجع التعارض أو النقص',
  };

  const next = {
    ...order,
    status: input.to,
    nextAction: nextActionByStatus[input.to],
  };

  const recognized =
    input.to === 'delivered' || input.to === 'settled'
      ? {
          ...next,
          recognizedRevenueMinor: next.agreedPriceMinor,
          recognizedCostMinor: next.costSnapshot.plannedCostMinor,
          profitIndicatorMinor:
            next.agreedPriceMinor - next.costSnapshot.plannedCostMinor,
        }
      : next;

  return appendEvent(recognized, {
    id: `${order.id}:${input.idempotencyKey}`,
    type: 'status_changed',
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
  if (eventExists(order, idempotencyKey)) return order;
  if (!specifications.trim()) throw new Error('revised specifications are required');
  if (order.status === 'delivered' || order.status === 'settled' || order.status === 'cancelled') {
    throw new Error(`cannot revise order in ${order.status} status`);
  }

  const next: CraftOrder = {
    ...order,
    specifications,
    costSnapshot: nextCostSnapshot,
    costSnapshots: [...order.costSnapshots, nextCostSnapshot],
    status: 'needs_review',
    nextAction: 'راجع السعر والمواصفات مع الزبون',
  };

  return appendEvent(next, {
    id: `${order.id}:${idempotencyKey}`,
    type: 'specification_revised',
    idempotencyKey,
    createdAt,
    note: `cost snapshot: ${nextCostSnapshot.id}`,
  });
}

export function collectDeposit(
  order: CraftOrder,
  amountMinor: MoneyMinor,
  idempotencyKey: string,
  createdAt: string,
): CraftOrder {
  if (eventExists(order, idempotencyKey)) return order;
  assertPositiveInteger(amountMinor, 'deposit amount');
  if (amountMinor + order.collectedMinor > order.agreedPriceMinor) {
    throw new Error('deposit cannot exceed the agreed price');
  }

  const next = withSettlement({
    ...order,
    depositCollectedMinor: order.depositCollectedMinor + amountMinor,
    collectedMinor: order.collectedMinor + amountMinor,
    nextAction: 'نفذ الطلب ثم سجل التسليم',
  });

  return appendEvent(next, {
    id: `${order.id}:${idempotencyKey}`,
    type: 'deposit_collected',
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
  if (eventExists(order, idempotencyKey)) return order;
  if (order.status !== 'delivered') {
    throw new Error('remaining collection requires a delivered order');
  }
  assertPositiveInteger(amountMinor, 'collection amount');
  if (amountMinor + order.collectedMinor > order.agreedPriceMinor) {
    throw new Error('collection cannot exceed the agreed price');
  }

  const next = withSettlement({
    ...order,
    collectedMinor: order.collectedMinor + amountMinor,
    nextAction: 'راجع النتيجة والفعل التالي',
  });
  const settled = next.receivableMinor === 0 ? { ...next, status: 'settled' as const } : next;

  return appendEvent(settled, {
    id: `${order.id}:${idempotencyKey}`,
    type: 'collection_recorded',
    idempotencyKey,
    createdAt,
    amountMinor,
  });
}

export function registerDebt(
  order: CraftOrder,
  idempotencyKey: string,
  createdAt: string,
): CraftOrder {
  if (eventExists(order, idempotencyKey)) return order;
  if (order.status !== 'delivered') {
    throw new Error('debt requires a delivered order');
  }
  if (order.receivableMinor <= 0) {
    throw new Error('cannot register debt with no remaining amount');
  }

  const next: CraftOrder = {
    ...order,
    status: 'settled',
    settlementStatus: 'debt',
    nextAction: 'تابع تحصيل الدين',
  };

  return appendEvent(next, {
    id: `${order.id}:${idempotencyKey}`,
    type: 'debt_registered',
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
  if (eventExists(order, idempotencyKey)) return order;
  if (order.status === 'delivered' || order.status === 'settled' || order.status === 'cancelled') {
    throw new Error(`cannot cancel order in ${order.status} status`);
  }
  if (!reason.trim()) throw new Error('cancellation reason is required');

  const next = {
    ...order,
    status: 'cancelled' as const,
    nextAction: 'راجع تسوية العربون والمواد',
  };

  return appendEvent(next, {
    id: `${order.id}:${idempotencyKey}`,
    type: 'cancelled',
    idempotencyKey,
    createdAt,
    note: reason,
  });
}
