import { describe, expect, it } from "vitest";
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
} from "../../src/domain/craft-order/index.js";

const costSnapshot: CostSnapshot = calculateCostSnapshot("cost-1", {
  currency: "JOD",
  materialItems: [
    {
      name: "خشب",
      quantity: 2,
      unit: "قطعة",
      unitPriceMinor: 500,
      priceDate: "2026-08-21",
      source: "user_input",
      confidence: "known",
    },
    {
      name: "طلاء",
      quantity: 1.5,
      unit: "ملعقة",
      unitPriceMinor: 300,
      priceDate: "2026-08-21",
      source: "user_input",
      confidence: "known",
    },
  ],
  time: { minutes: 120, hourlyRateMinor: 600, confidence: "known" },
  packagingMinor: 100,
  deliveryMinor: 200,
  wasteMinor: 50,
  safetyBufferMinor: 500,
  quantity: 1,
  createdAt: "2026-08-21T09:00:00Z",
  source: "price_approval",
});

function makeOrder(overrides: Partial<CraftOrder> = {}): CraftOrder {
  return createCraftOrder({
    id: "order-1",
    customerName: "سارة",
    itemName: "صندوق مخصص",
    specifications: "لون أزرق ومقاس متوسط",
    quantity: 1,
    agreedPriceMinor: 4000,
    costSnapshot,
    createdAt: "2026-08-21T09:05:00Z",
    ...overrides,
  });
}

function confirmAndDeliver(order: CraftOrder): CraftOrder {
  let next = transitionOrder(order, {
    to: "provisional_agreement",
    idempotencyKey: "status-provisional",
    createdAt: "2026-08-21T09:10:00Z",
  });
  next = transitionOrder(next, {
    to: "confirmed",
    idempotencyKey: "status-confirmed",
    createdAt: "2026-08-21T09:11:00Z",
  });
  next = transitionOrder(next, {
    to: "in_progress",
    idempotencyKey: "status-progress",
    createdAt: "2026-08-21T09:12:00Z",
  });
  next = transitionOrder(next, {
    to: "ready",
    idempotencyKey: "status-ready",
    createdAt: "2026-08-21T09:13:00Z",
  });
  return transitionOrder(next, {
    to: "delivered",
    idempotencyKey: "status-delivered",
    createdAt: "2026-08-21T09:14:00Z",
  });
}

describe("craft-order domain core", () => {
  it("calculates a transparent cost and protection price without floating money", () => {
    expect(costSnapshot.materialCostMinor).toBe(1450);
    expect(costSnapshot.timeCostMinor).toBe(1200);
    expect(costSnapshot.plannedCostMinor).toBe(3000);
    expect(costSnapshot.unitCostMinor).toBe(3000);
    expect(costSnapshot.priceFloorMinor).toBe(3500);
    expect(costSnapshot.knowledgeState).toBe("known");
  });

  it("marks a variable cost when an estimated material is supplied", () => {
    const estimated = calculateCostSnapshot("cost-estimated", {
      currency: "JOD",
      materialItems: [
        {
          name: "خامة تقديرية",
          quantity: 1,
          unit: "قطعة",
          unitPriceMinor: 1000,
          priceDate: "2026-08-01",
          source: "estimate",
          confidence: "estimated",
        },
      ],
      time: { minutes: 60, hourlyRateMinor: 600, confidence: "known" },
      packagingMinor: 0,
      deliveryMinor: 0,
      wasteMinor: 0,
      safetyBufferMinor: 100,
      quantity: 1,
      createdAt: "2026-08-21T09:00:00Z",
      source: "draft",
    });

    expect(estimated.knowledgeState).toBe("variable");
  });

  it("marks missing time as incomplete even when another cost is variable", () => {
    const missingTime = calculateCostSnapshot("cost-missing-time-variable", {
      ...costSnapshot.input,
      time: null,
      materialItems: costSnapshot.input.materialItems.map((item, index) =>
        index === 0 ? { ...item, source: "estimate" as const, confidence: "estimated" as const } : item,
      ),
    });

    expect(missingTime.knowledgeState).toBe("incomplete");
  });

  it("marks missing time as incomplete even when a material is stale", () => {
    const missingTime = calculateCostSnapshot("cost-missing-time-stale", {
      ...costSnapshot.input,
      time: null,
      freshnessDays: 30,
      materialItems: costSnapshot.input.materialItems.map(item => ({
        ...item,
        priceDate: "2026-01-01",
      })),
    });

    expect(missingTime.knowledgeState).toBe("incomplete");
  });

  it("does not treat known zero time as a complete cost", () => {
    const zeroTime = calculateCostSnapshot("cost-zero-known-time", {
      ...costSnapshot.input,
      time: { minutes: 0, hourlyRateMinor: 0, confidence: "known" },
    });

    expect(zeroTime.knowledgeState).toBe("incomplete");
    expect(makeOrder({ costSnapshot: zeroTime }).resultStatus).toBe("incomplete");
    expect(confirmAndDeliver(makeOrder({ costSnapshot: zeroTime })).resultStatus).toBe("incomplete");
  });

  it("keeps estimated work with a zero rate incomplete", () => {
    const zeroRate = calculateCostSnapshot("cost-zero-estimated-rate", {
      ...costSnapshot.input,
      time: { minutes: 60, hourlyRateMinor: 0, confidence: "estimated" },
    });

    expect(zeroRate.timeCostMinor).toBe(0);
    expect(zeroRate.knowledgeState).toBe("incomplete");
    expect(zeroRate.priceFloorMinor).toBe(2300);
  });

  it("keeps a partially entered time record incomplete without inventing its missing component", () => {
    const partialTime = calculateCostSnapshot("cost-partial-time", {
      ...costSnapshot.input,
      time: { minutes: 45, hourlyRateMinor: null, confidence: "estimated" },
    });

    expect(partialTime.timeCostMinor).toBe(0);
    expect(partialTime.knowledgeState).toBe("incomplete");
    expect(partialTime.input.time).toEqual({ minutes: 45, hourlyRateMinor: null, confidence: "estimated" });
  });

  it("marks a custom-order snapshot with no effective cost components as incomplete", () => {
    const incomplete = calculateCostSnapshot("cost-incomplete", {
      currency: "JOD",
      materialItems: [],
      time: null,
      packagingMinor: 0,
      deliveryMinor: 0,
      wasteMinor: 0,
      safetyBufferMinor: 0,
      quantity: 1,
      createdAt: "2026-08-21T09:00:00Z",
      source: "draft",
    });

    expect(incomplete.knowledgeState).toBe("incomplete");
    expect(makeOrder({ costSnapshot: incomplete }).resultStatus).toBe("incomplete");
  });

  it("does not mark a craft cost as known when time is missing", () => {
    const missingTime = calculateCostSnapshot("cost-missing-time", {
      ...costSnapshot.input,
      time: null,
    });

    expect(missingTime.knowledgeState).toBe("incomplete");
    expect(makeOrder({ costSnapshot: missingTime }).resultStatus).toBe("incomplete");
  });

  it("rejects negative values and invalid quantities", () => {
    expect(() =>
      calculateCostSnapshot("cost-negative", {
        ...costSnapshot.input,
        materialItems: costSnapshot.input.materialItems.map((item, index) =>
          index === 0 ? { ...item, unitPriceMinor: -1 } : item,
        ),
      }),
    ).toThrow("سعر وحدة خشب");

    expect(() =>
      calculateCostSnapshot("cost-zero-quantity", {
        ...costSnapshot.input,
        quantity: 0,
      }),
    ).toThrow("أدخل الكمية رقمًا أكبر من صفر.");
  });

  it("marks stale prices only when an explicit freshness policy is supplied", () => {
    const stale = calculateCostSnapshot("cost-stale", {
      ...costSnapshot.input,
      freshnessDays: 30,
      materialItems: costSnapshot.input.materialItems.map(item => ({
        ...item,
        priceDate: "2026-01-01",
      })),
    });

    expect(stale.knowledgeState).toBe("stale");
  });

  it("does not reopen a delivered order from review without an explicit correction", () => {
    const delivered = confirmAndDeliver(makeOrder());
    const reviewed = transitionOrder(delivered, {
      to: "needs_review",
      idempotencyKey: "delivery-review",
      createdAt: "2026-08-21T09:15:00Z",
    });

    expect(reviewed.resultStatus).toBe("review_required");
    expect(reviewed.profitIndicatorMinor).toBeNull();
    expect(() =>
      transitionOrder(reviewed, {
        to: "confirmed",
        idempotencyKey: "unsafe-reopen",
        createdAt: "2026-08-21T09:16:00Z",
      }),
    ).toThrow("explicit correction");
  });

  it("keeps deposit, delivery, collection, and profit separate", () => {
    let order = makeOrder();
    order = collectDeposit(order, 1000, "deposit-1", "2026-08-21T09:20:00Z");

    expect(order.collectedMinor).toBe(1000);
    expect(order.receivableMinor).toBe(3000);
    expect(order.recognizedRevenueMinor).toBe(0);
    expect(order.profitIndicatorMinor).toBeNull();

    order = confirmAndDeliver(order);
    expect(order.status).toBe("delivered");
    expect(order.resultStatus).toBe("final");
    expect(order.collectedMinor).toBe(1000);
    expect(order.recognizedRevenueMinor).toBe(4000);
    expect(order.recognizedCostMinor).toBe(3000);
    expect(order.profitIndicatorMinor).toBe(1000);

    order = collectRemaining(order, 3000, "collection-1", "2026-08-21T09:30:00Z");
    expect(order.status).toBe("settled");
    expect(order.settlementStatus).toBe("paid");
    expect(order.collectedMinor).toBe(4000);
    expect(order.events).toContainEqual(
      expect.objectContaining({
        type: "status_changed",
        fromStatus: "delivered",
        toStatus: "settled",
      }),
    );
    expect(order.receivableMinor).toBe(0);
  });

  it("does not expose a final profit when delivery uses a non-known cost", () => {
    const estimated = calculateCostSnapshot("cost-estimated-delivery", {
      ...costSnapshot.input,
      materialItems: costSnapshot.input.materialItems.map((item, index) =>
        index === 0 ? { ...item, source: "estimate" as const, confidence: "estimated" as const } : item,
      ),
    });

    const delivered = confirmAndDeliver(makeOrder({ costSnapshot: estimated }));
    expect(delivered.resultStatus).toBe("review_required");
    expect(delivered.recognizedRevenueMinor).toBe(4000);
    expect(delivered.recognizedCostMinor).toBe(3000);
    expect(delivered.profitIndicatorMinor).toBeNull();
  });

  it("registers a debt without increasing cash", () => {
    let order = confirmAndDeliver(makeOrder());
    order = registerDebt(order, "debt-1", "2026-08-21T09:40:00Z");

    expect(order.status).toBe("settled");
    expect(order.settlementStatus).toBe("debt");
    expect(order.collectedMinor).toBe(0);
    expect(order.receivableMinor).toBe(4000);
    expect(order.recognizedRevenueMinor).toBe(4000);
    expect(order.events).toContainEqual(
      expect.objectContaining({
        type: "status_changed",
        fromStatus: "delivered",
        toStatus: "settled",
      }),
    );
  });

  it("requires a reason and preserves a cancellation event", () => {
    const order = makeOrder();
    expect(() => cancelOrder(order, "", "cancel-1", "2026-08-21T09:50:00Z")).toThrow(
      "أكمل سبب الإلغاء قبل الحفظ.",
    );

    const cancelled = cancelOrder(order, "الزبون غير المواصفات", "cancel-1", "2026-08-21T09:51:00Z");
    expect(cancelled.status).toBe("cancelled");
    expect(cancelled.settlementStatus).toBe("cancelled");
    expect(cancelled.events.at(-1)?.type).toBe("cancelled");
  });

  it("marks cancellation with a deposit as needing explicit settlement", () => {
    const withDeposit = collectDeposit(makeOrder(), 500, "deposit-cancel", "2026-08-21T09:52:00Z");
    const cancelled = cancelOrder(
      withDeposit,
      "تغيير قرار الزبون",
      "cancel-with-deposit",
      "2026-08-21T09:53:00Z",
    );

    expect(cancelled.depositSettlement).toBe("needs_review");
    expect(cancelled.settlementStatus).toBe("cancelled_pending");
    expect(cancelled.nextAction).toContain("العربون");
  });

  it("supports an explicit deposit refund and makes retry idempotent", () => {
    const cancelled = cancelOrder(
      collectDeposit(makeOrder(), 500, "deposit-refund", "2026-08-21T10:00:00Z"),
      "إلغاء قبل التنفيذ",
      "cancel-refund",
      "2026-08-21T10:01:00Z",
    );
    const refunded = settleDepositRefund(
      cancelled,
      500,
      "اتفاق على رد العربون",
      "refund-1",
      "2026-08-21T10:02:00Z",
    );
    const retried = settleDepositRefund(refunded, 500, "إعادة الإرسال", "refund-1", "2026-08-21T10:03:00Z");

    expect(refunded.depositSettlement).toBe("refund_deposit");
    expect(refunded.settlementStatus).toBe("cancelled_refunded");
    expect(refunded.collectedMinor).toBe(0);
    expect(refunded.events).toHaveLength(cancelled.events.length + 1);
    expect(retried).toEqual(refunded);
  });

  it("supports an explicit deposit retention and rejects contradictory settlement", () => {
    const cancelled = cancelOrder(
      collectDeposit(makeOrder(), 500, "deposit-retain", "2026-08-21T10:10:00Z"),
      "تكلفة مواد غير قابلة للاسترجاع",
      "cancel-retain",
      "2026-08-21T10:11:00Z",
    );
    expect(() =>
      settleDepositRefund(cancelled, 600, "مبلغ أكبر من العربون", "refund-too-large", "2026-08-21T10:11:30Z"),
    ).toThrow("settlement amount must equal the collected deposit");

    const retained = settleDepositRetain(
      cancelled,
      500,
      "احتفاظ متفق عليه",
      "retain-1",
      "2026-08-21T10:12:00Z",
    );

    expect(retained.depositSettlement).toBe("retain_deposit");
    expect(retained.settlementStatus).toBe("cancelled_retained");
    expect(retained.collectedMinor).toBe(500);
    expect(() =>
      settleDepositRefund(retained, 500, "محاولة قرار متناقض", "refund-after-retain", "2026-08-21T10:13:00Z"),
    ).toThrow("already decided");
  });

  it("prevents deposit collection after delivery or cancellation", () => {
    const delivered = confirmAndDeliver(makeOrder());
    expect(() => collectDeposit(delivered, 100, "late-deposit", "2026-08-21T10:20:00Z")).toThrow(
      "cannot collect deposit in delivered status",
    );

    const cancelled = cancelOrder(makeOrder(), "إلغاء", "cancel-late-deposit", "2026-08-21T10:21:00Z");
    expect(() => collectDeposit(cancelled, 100, "cancelled-deposit", "2026-08-21T10:22:00Z")).toThrow(
      "cannot collect deposit in cancelled status",
    );
    expect(() => collectRemaining(cancelled, 100, "cancelled-collection", "2026-08-21T10:23:00Z")).toThrow(
      "remaining collection requires a delivered order",
    );
  });

  it("preserves the old cost snapshot when specifications change", () => {
    const order = makeOrder();
    const revisedSnapshot: CostSnapshot = {
      ...costSnapshot,
      id: "cost-2",
      plannedCostMinor: 3600,
      unitCostMinor: 3600,
      priceFloorMinor: 4100,
      createdAt: "2026-08-21T10:20:00Z",
      input: { ...costSnapshot.input, source: "revision" },
    };

    const revised = reviseOrderCost(
      order,
      "لون أخضر ومقاس كبير",
      revisedSnapshot,
      "revision-1",
      "2026-08-21T10:21:00Z",
    );

    expect(revised.status).toBe("needs_review");
    expect(revised.resultStatus).toBe("review_required");
    expect(revised.profitIndicatorMinor).toBeNull();
    expect(revised.costSnapshot.id).toBe("cost-2");
    expect(revised.costSnapshots.map(snapshot => snapshot.id)).toEqual(["cost-1", "cost-2"]);
    expect(revised.events.at(-1)?.type).toBe("specification_revised");
  });

  it("rejects a revised cost snapshot with a mismatched quantity", () => {
    const order = makeOrder();
    const mismatchedSnapshot: CostSnapshot = {
      ...costSnapshot,
      id: "cost-mismatched-quantity",
      quantity: 2,
      input: { ...costSnapshot.input, quantity: 2, source: "revision" },
    };

    expect(() =>
      reviseOrderCost(
        order,
        "كمية مختلفة",
        mismatchedSnapshot,
        "revision-mismatched-quantity",
        "2026-08-21T10:22:00Z",
      ),
    ).toThrow("revised cost snapshot quantity must match order quantity");
  });

  it("settles a fully prepaid order at delivery and shows no collection action", () => {
    let order = collectDeposit(makeOrder(), 4000, "full-prepaid-deposit", "2026-08-21T10:30:00Z");
    order = confirmAndDeliver(order);

    expect(order.status).toBe("settled");
    expect(order.settlementStatus).toBe("paid");
    expect(order.receivableMinor).toBe(0);
    expect(order.nextAction).toBe("راجع النتيجة والفعل التالي");
    expect(order.events).toContainEqual(
      expect.objectContaining({
        type: "status_changed",
        fromStatus: "delivered",
        toStatus: "settled",
      }),
    );
  });

  it("blocks every public mutation after delivered review", () => {
    const delivered = confirmAndDeliver(makeOrder());
    const reviewed = transitionOrder(delivered, {
      to: "needs_review",
      idempotencyKey: "review-lock",
      createdAt: "2026-08-21T10:31:00Z",
    });

    expect(() =>
      cancelOrder(reviewed, "محاولة إلغاء بعد التسليم", "locked-cancel", "2026-08-21T10:32:00Z"),
    ).toThrow("explicit correction");
    expect(() =>
      reviseOrderCost(reviewed, "تعديل بعد التسليم", costSnapshot, "locked-revision", "2026-08-21T10:33:00Z"),
    ).toThrow("explicit correction");
    expect(() => collectDeposit(reviewed, 100, "locked-deposit", "2026-08-21T10:34:00Z")).toThrow(
      "explicit correction",
    );
  });

  it("does not allow generic cancellation to bypass deposit settlement", () => {
    const withDeposit = collectDeposit(makeOrder(), 500, "generic-cancel-deposit", "2026-08-21T10:35:00Z");

    expect(() =>
      transitionOrder(withDeposit, {
        to: "cancelled",
        idempotencyKey: "generic-cancel-transition",
        createdAt: "2026-08-21T10:36:00Z",
      }),
    ).toThrow("invalid transition");
  });

  it("rejects blank idempotency keys", () => {
    expect(() => collectDeposit(makeOrder(), 100, "   ", "2026-08-21T10:37:00Z")).toThrow(
      "أكمل مفتاح العملية قبل الحفظ.",
    );
  });

  it("keeps cost snapshot history immutable and self-consistent", () => {
    const sourceInput = {
      ...costSnapshot.input,
      materialItems: costSnapshot.input.materialItems.map(item => ({ ...item })),
    };
    const snapshot = calculateCostSnapshot("cost-immutable", sourceInput);

    expect(snapshot.quantity).toBe(snapshot.input.quantity);
    expect(() => {
      snapshot.input.materialItems[0]!.unitPriceMinor = 9999;
    }).toThrow(TypeError);
    expect(snapshot.input.materialItems[0]!.unitPriceMinor).toBe(500);
  });

  it("detaches external snapshot references at the order boundary", () => {
    const externalSnapshot: CostSnapshot = {
      ...costSnapshot,
      id: "cost-external",
      input: {
        ...costSnapshot.input,
        materialItems: costSnapshot.input.materialItems.map(item => ({ ...item })),
      },
    };
    const order = makeOrder({ costSnapshot: externalSnapshot });

    externalSnapshot.input.materialItems[0]!.unitPriceMinor = 9999;
    expect(order.costSnapshot.input.materialItems[0]!.unitPriceMinor).toBe(500);
    expect(() => order.costSnapshots.push(costSnapshot)).toThrow(TypeError);
  });

  it("records status_changed alongside revision and cancellation events", () => {
    const revised = reviseOrderCost(
      makeOrder(),
      "مواصفات معدلة",
      costSnapshot,
      "status-revision",
      "2026-08-21T10:38:00Z",
    );
    expect(revised.events).toContainEqual(
      expect.objectContaining({
        type: "status_changed",
        fromStatus: "draft",
        toStatus: "needs_review",
      }),
    );

    const cancelled = cancelOrder(makeOrder(), "إلغاء موثق", "status-cancel", "2026-08-21T10:39:00Z");
    expect(cancelled.events).toContainEqual(
      expect.objectContaining({
        type: "status_changed",
        fromStatus: "draft",
        toStatus: "cancelled",
      }),
    );
  });

  it("allows the same caller token across different event types without cross-operation suppression", () => {
    const deposited = collectDeposit(makeOrder(), 500, "shared-token", "2026-08-21T10:40:00Z");
    const delivered = confirmAndDeliver(deposited);
    const collected = collectRemaining(delivered, 3500, "shared-token", "2026-08-21T10:41:00Z");

    expect(collected.collectedMinor).toBe(4000);
    expect(collected.status).toBe("settled");
  });

  it("rejects invalid status transitions", () => {
    const order = makeOrder();
    expect(() =>
      transitionOrder(order, {
        to: "delivered",
        idempotencyKey: "invalid-delivery",
        createdAt: "2026-08-21T10:00:00Z",
      }),
    ).toThrow("invalid transition");
  });

  it("does not duplicate a financial event when retried", () => {
    const order = makeOrder();
    const once = collectDeposit(order, 500, "same-key", "2026-08-21T10:10:00Z");
    const twice = collectDeposit(once, 500, "same-key", "2026-08-21T10:11:00Z");

    expect(twice.collectedMinor).toBe(500);
    expect(twice.depositCollectedMinor).toBe(500);
    expect(twice.events).toHaveLength(2);
  });
});
