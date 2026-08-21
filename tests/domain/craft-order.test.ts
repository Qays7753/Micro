import { describe, expect, it } from 'vitest';
import {
  calculateCostSnapshot,
  cancelOrder,
  collectDeposit,
  collectRemaining,
  createCraftOrder,
  registerDebt,
  reviseOrderCost,
  transitionOrder,
  type CostSnapshot,
  type CraftOrder,
} from '../../src/domain/craft-order/index.js';

const costSnapshot: CostSnapshot = calculateCostSnapshot('cost-1', {
  currency: 'JOD',
  materialItems: [
    {
      name: 'خشب',
      quantity: 2,
      unit: 'قطعة',
      unitPriceMinor: 500,
      priceDate: '2026-08-21',
      source: 'user_input',
      confidence: 'known',
    },
    {
      name: 'طلاء',
      quantity: 1.5,
      unit: 'ملعقة',
      unitPriceMinor: 300,
      priceDate: '2026-08-21',
      source: 'user_input',
      confidence: 'known',
    },
  ],
  time: { minutes: 120, hourlyRateMinor: 600, confidence: 'known' },
  packagingMinor: 100,
  deliveryMinor: 200,
  wasteMinor: 50,
  safetyBufferMinor: 500,
  quantity: 1,
  createdAt: '2026-08-21T09:00:00Z',
  source: 'price_approval',
});

function makeOrder(overrides: Partial<CraftOrder> = {}): CraftOrder {
  return createCraftOrder({
    id: 'order-1',
    customerName: 'سارة',
    itemName: 'صندوق مخصص',
    specifications: 'لون أزرق ومقاس متوسط',
    quantity: 1,
    agreedPriceMinor: 4000,
    costSnapshot,
    createdAt: '2026-08-21T09:05:00Z',
    ...overrides,
  });
}

function confirmAndDeliver(order: CraftOrder): CraftOrder {
  let next = transitionOrder(order, {
    to: 'provisional_agreement',
    idempotencyKey: 'status-provisional',
    createdAt: '2026-08-21T09:10:00Z',
  });
  next = transitionOrder(next, {
    to: 'confirmed',
    idempotencyKey: 'status-confirmed',
    createdAt: '2026-08-21T09:11:00Z',
  });
  next = transitionOrder(next, {
    to: 'in_progress',
    idempotencyKey: 'status-progress',
    createdAt: '2026-08-21T09:12:00Z',
  });
  next = transitionOrder(next, {
    to: 'ready',
    idempotencyKey: 'status-ready',
    createdAt: '2026-08-21T09:13:00Z',
  });
  return transitionOrder(next, {
    to: 'delivered',
    idempotencyKey: 'status-delivered',
    createdAt: '2026-08-21T09:14:00Z',
  });
}

describe('craft-order domain core', () => {
  it('calculates a transparent cost and protection price without floating money', () => {
    expect(costSnapshot.materialCostMinor).toBe(1450);
    expect(costSnapshot.timeCostMinor).toBe(1200);
    expect(costSnapshot.plannedCostMinor).toBe(3000);
    expect(costSnapshot.unitCostMinor).toBe(3000);
    expect(costSnapshot.priceFloorMinor).toBe(3500);
    expect(costSnapshot.knowledgeState).toBe('known');
  });

  it('marks an estimated cost instead of pretending it is exact', () => {
    const estimated = calculateCostSnapshot('cost-estimated', {
      currency: 'JOD',
      materialItems: [
        {
          name: 'خامة تقديرية',
          quantity: 1,
          unit: 'قطعة',
          unitPriceMinor: 1000,
          priceDate: '2026-08-01',
          source: 'estimate',
          confidence: 'estimated',
        },
      ],
      time: null,
      packagingMinor: 0,
      deliveryMinor: 0,
      wasteMinor: 0,
      safetyBufferMinor: 100,
      quantity: 1,
      createdAt: '2026-08-21T09:00:00Z',
      source: 'draft',
    });

    expect(estimated.knowledgeState).toBe('variable');
  });

  it('keeps deposit, delivery, collection, and profit separate', () => {
    let order = makeOrder();
    order = collectDeposit(order, 1000, 'deposit-1', '2026-08-21T09:20:00Z');

    expect(order.collectedMinor).toBe(1000);
    expect(order.receivableMinor).toBe(3000);
    expect(order.recognizedRevenueMinor).toBe(0);
    expect(order.profitIndicatorMinor).toBeNull();

    order = confirmAndDeliver(order);
    expect(order.status).toBe('delivered');
    expect(order.collectedMinor).toBe(1000);
    expect(order.recognizedRevenueMinor).toBe(4000);
    expect(order.recognizedCostMinor).toBe(3000);
    expect(order.profitIndicatorMinor).toBe(1000);

    order = collectRemaining(order, 3000, 'collection-1', '2026-08-21T09:30:00Z');
    expect(order.status).toBe('settled');
    expect(order.settlementStatus).toBe('paid');
    expect(order.collectedMinor).toBe(4000);
    expect(order.receivableMinor).toBe(0);
  });

  it('registers a debt without increasing cash', () => {
    let order = confirmAndDeliver(makeOrder());
    order = registerDebt(order, 'debt-1', '2026-08-21T09:40:00Z');

    expect(order.status).toBe('settled');
    expect(order.settlementStatus).toBe('debt');
    expect(order.collectedMinor).toBe(0);
    expect(order.receivableMinor).toBe(4000);
    expect(order.recognizedRevenueMinor).toBe(4000);
  });

  it('requires a reason and preserves a cancellation event', () => {
    const order = makeOrder();
    expect(() => cancelOrder(order, '', 'cancel-1', '2026-08-21T09:50:00Z')).toThrow(
      'cancellation reason is required',
    );

    const cancelled = cancelOrder(
      order,
      'الزبون غير المواصفات',
      'cancel-1',
      '2026-08-21T09:51:00Z',
    );
    expect(cancelled.status).toBe('cancelled');
    expect(cancelled.events.at(-1)?.type).toBe('cancelled');
  });

  it('preserves the old cost snapshot when specifications change', () => {
    const order = makeOrder();
    const revisedSnapshot: CostSnapshot = {
      ...costSnapshot,
      id: 'cost-2',
      plannedCostMinor: 3600,
      unitCostMinor: 3600,
      priceFloorMinor: 4100,
      createdAt: '2026-08-21T10:20:00Z',
      input: { ...costSnapshot.input, source: 'revision' },
    };

    const revised = reviseOrderCost(
      order,
      'لون أخضر ومقاس كبير',
      revisedSnapshot,
      'revision-1',
      '2026-08-21T10:21:00Z',
    );

    expect(revised.status).toBe('needs_review');
    expect(revised.costSnapshot.id).toBe('cost-2');
    expect(revised.costSnapshots.map((snapshot) => snapshot.id)).toEqual(['cost-1', 'cost-2']);
    expect(revised.events.at(-1)?.type).toBe('specification_revised');
  });

  it('rejects invalid status transitions', () => {
    const order = makeOrder();
    expect(() =>
      transitionOrder(order, {
        to: 'delivered',
        idempotencyKey: 'invalid-delivery',
        createdAt: '2026-08-21T10:00:00Z',
      }),
    ).toThrow('invalid transition');
  });

  it('does not duplicate a financial event when retried', () => {
    const order = makeOrder();
    const once = collectDeposit(order, 500, 'same-key', '2026-08-21T10:10:00Z');
    const twice = collectDeposit(once, 500, 'same-key', '2026-08-21T10:11:00Z');

    expect(twice.collectedMinor).toBe(500);
    expect(twice.depositCollectedMinor).toBe(500);
    expect(twice.events).toHaveLength(2);
  });
});
