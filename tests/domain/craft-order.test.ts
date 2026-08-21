import { describe, expect, it } from 'vitest';
import {
  calculateCostSnapshot,
  cancelOrder,
  collectDeposit,
  collectRemaining,
  createCraftOrder,
  registerDebt,
  reviseOrderCost,
  settleDepositRefund,
  settleDepositRetain,
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

  it('marks a custom-order snapshot with no effective cost components as incomplete', () => {
    const incomplete = calculateCostSnapshot('cost-incomplete', {
      currency: 'JOD',
      materialItems: [],
      time: null,
      packagingMinor: 0,
      deliveryMinor: 0,
      wasteMinor: 0,
      safetyBufferMinor: 0,
      quantity: 1,
      createdAt: '2026-08-21T09:00:00Z',
      source: 'draft',
    });

    expect(incomplete.knowledgeState).toBe('incomplete');
    expect(makeOrder({ costSnapshot: incomplete }).resultStatus).toBe('incomplete');
  });

  it('rejects negative values and invalid quantities', () => {
    expect(() =>
      calculateCostSnapshot('cost-negative', {
        ...costSnapshot.input,
        materialItems: costSnapshot.input.materialItems.map((item, index) =>
          index === 0 ? { ...item, unitPriceMinor: -1 } : item,
        ),
      }),
    ).toThrow('unitPriceMinor');

    expect(() =>
      calculateCostSnapshot('cost-zero-quantity', {
        ...costSnapshot.input,
        quantity: 0,
      }),
    ).toThrow('quantity must be greater than zero');
  });

  it('marks stale prices only when an explicit freshness policy is supplied', () => {
    const stale = calculateCostSnapshot('cost-stale', {
      ...costSnapshot.input,
      freshnessDays: 30,
      materialItems: costSnapshot.input.materialItems.map((item) => ({
        ...item,
        priceDate: '2026-01-01',
      })),
    });

    expect(stale.knowledgeState).toBe('stale');
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
    expect(order.resultStatus).toBe('final');
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

  it('does not expose a final profit when delivery uses a non-known cost', () => {
    const estimated = calculateCostSnapshot('cost-estimated-delivery', {
      ...costSnapshot.input,
      materialItems: costSnapshot.input.materialItems.map((item, index) =>
        index === 0
          ? { ...item, source: 'estimate' as const, confidence: 'estimated' as const }
          : item,
      ),
    });

    const delivered = confirmAndDeliver(makeOrder({ costSnapshot: estimated }));
    expect(delivered.resultStatus).toBe('review_required');
    expect(delivered.recognizedRevenueMinor).toBe(4000);
    expect(delivered.recognizedCostMinor).toBe(3000);
    expect(delivered.profitIndicatorMinor).toBeNull();
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
    expect(cancelled.settlementStatus).toBe('cancelled');
    expect(cancelled.events.at(-1)?.type).toBe('cancelled');
  });

  it('marks cancellation with a deposit as needing explicit settlement', () => {
    const withDeposit = collectDeposit(
      makeOrder(),
      500,
      'deposit-cancel',
      '2026-08-21T09:52:00Z',
    );
    const cancelled = cancelOrder(
      withDeposit,
      'تغيير قرار الزبون',
      'cancel-with-deposit',
      '2026-08-21T09:53:00Z',
    );

    expect(cancelled.depositSettlement).toBe('needs_review');
    expect(cancelled.settlementStatus).toBe('cancelled_pending');
    expect(cancelled.nextAction).toContain('العربون');
  });

  it('supports an explicit deposit refund and makes retry idempotent', () => {
    const cancelled = cancelOrder(
      collectDeposit(makeOrder(), 500, 'deposit-refund', '2026-08-21T10:00:00Z'),
      'إلغاء قبل التنفيذ',
      'cancel-refund',
      '2026-08-21T10:01:00Z',
    );
    const refunded = settleDepositRefund(
      cancelled,
      500,
      'اتفاق على رد العربون',
      'refund-1',
      '2026-08-21T10:02:00Z',
    );
    const retried = settleDepositRefund(
      refunded,
      500,
      'إعادة الإرسال',
      'refund-1',
      '2026-08-21T10:03:00Z',
    );

    expect(refunded.depositSettlement).toBe('refund_deposit');
    expect(refunded.settlementStatus).toBe('cancelled_refunded');
    expect(refunded.collectedMinor).toBe(0);
    expect(refunded.events).toHaveLength(cancelled.events.length + 1);
    expect(retried).toEqual(refunded);
  });

  it('supports an explicit deposit retention and rejects contradictory settlement', () => {
    const cancelled = cancelOrder(
      collectDeposit(makeOrder(), 500, 'deposit-retain', '2026-08-21T10:10:00Z'),
      'تكلفة مواد غير قابلة للاسترجاع',
      'cancel-retain',
      '2026-08-21T10:11:00Z',
    );
    expect(() =>
      settleDepositRefund(
        cancelled,
        600,
        'مبلغ أكبر من العربون',
        'refund-too-large',
        '2026-08-21T10:11:30Z',
      ),
    ).toThrow('settlement amount must equal the collected deposit');

    const retained = settleDepositRetain(
      cancelled,
      500,
      'احتفاظ متفق عليه',
      'retain-1',
      '2026-08-21T10:12:00Z',
    );

    expect(retained.depositSettlement).toBe('retain_deposit');
    expect(retained.settlementStatus).toBe('cancelled_retained');
    expect(retained.collectedMinor).toBe(500);
    expect(() =>
      settleDepositRefund(
        retained,
        500,
        'محاولة قرار متناقض',
        'refund-after-retain',
        '2026-08-21T10:13:00Z',
      ),
    ).toThrow('already decided');
  });

  it('prevents deposit collection after delivery or cancellation', () => {
    const delivered = confirmAndDeliver(makeOrder());
    expect(() =>
      collectDeposit(delivered, 100, 'late-deposit', '2026-08-21T10:20:00Z'),
    ).toThrow('cannot collect deposit in delivered status');

    const cancelled = cancelOrder(
      makeOrder(),
      'إلغاء',
      'cancel-late-deposit',
      '2026-08-21T10:21:00Z',
    );
    expect(() =>
      collectDeposit(cancelled, 100, 'cancelled-deposit', '2026-08-21T10:22:00Z'),
    ).toThrow('cannot collect deposit in cancelled status');
    expect(() =>
      collectRemaining(cancelled, 100, 'cancelled-collection', '2026-08-21T10:23:00Z'),
    ).toThrow('remaining collection requires a delivered order');
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
    expect(revised.resultStatus).toBe('review_required');
    expect(revised.profitIndicatorMinor).toBeNull();
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
