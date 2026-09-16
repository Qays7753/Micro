/**
 * ORD-003 — مسؤولية النقل والتوصيل ونتيجة الطلب التقديرية/الرسمية:
 * الخيارات الأربعة، أعلام الاحتواء (في السعر/في التكلفة) لمنع الاحتساب
 * المزدوج، المبلغ الناقص يبقى معلنًا، الصفر قيمة صريحة، التسجيل قبل
 * التسليم محمي بعده، ولا أثر للتقدير وحده في النتائج الرسمية.
 */
import { describe, expect, it } from "vitest";

import {
  calculateCostSnapshot,
  collectDeposit,
  collectRemaining,
  createCraftOrder,
  orderResultBreakdown,
  orderValueMinor,
  recordDeliveryTerms,
  transitionOrder,
} from "../../src/domain/craft-order/index.js";
import type { CraftOrder } from "../../src/domain/craft-order/index.js";

const NOW = "2026-09-16T09:00:00.000Z";

function knownCostOrder(priceMinor = 800): CraftOrder {
  const cost = calculateCostSnapshot("ord003-cost", {
    currency: "JOD",
    source: "draft",
    materialItems: [
      {
        name: "خشب",
        quantity: 1,
        unit: "قطعة",
        unitPriceMinor: 200,
        priceDate: "2026-09-01",
        source: "user_input",
        confidence: "known",
      },
    ],
    time: { minutes: 60, hourlyRateMinor: 200, confidence: "known" },
    packagingMinor: 0,
    deliveryMinor: 0,
    wasteMinor: 0,
    safetyBufferMinor: 0,
    quantity: 1,
    createdAt: NOW,
    freshnessDays: null,
  });
  return createCraftOrder({
    id: "ord003-order-1",
    customerName: "سارة",
    itemName: "رف خشبي",
    specifications: "مقاس كبير",
    quantity: 1,
    agreedPriceMinor: priceMinor,
    costSnapshot: cost,
    createdAt: NOW,
  });
}

function estimatedCostOrder(priceMinor = 800): CraftOrder {
  const cost = calculateCostSnapshot("ord003-cost-est", {
    currency: "JOD",
    source: "draft",
    materialItems: [
      {
        name: "خشب",
        quantity: 1,
        unit: "قطعة",
        unitPriceMinor: 200,
        priceDate: "2026-08-01",
        source: "estimate",
        confidence: "estimated",
      },
    ],
    time: null,
    packagingMinor: 0,
    deliveryMinor: 0,
    wasteMinor: 0,
    safetyBufferMinor: 0,
    quantity: 1,
    createdAt: NOW,
    freshnessDays: null,
  });
  return createCraftOrder({
    id: "ord003-order-2",
    customerName: "ليان",
    itemName: "إطار",
    specifications: "صغير",
    quantity: 1,
    agreedPriceMinor: priceMinor,
    costSnapshot: cost,
    createdAt: NOW,
  });
}

const termsInput = {
  responsibility: "customer_pays_project" as const,
  feeIncludedInPrice: false,
  costIncludedInProductCost: false,
  feeChargedMinor: 200 as number | null,
  costPaidMinor: 100 as number | null,
  projectShareMinor: null as number | null,
  customerShareMinor: null as number | null,
  idempotencyKey: "ord003-terms-1",
  createdAt: NOW,
};

/* سلسلة الحالات الكاملة حتى «جاهز» — التسليم لا يقع إلا من «جاهز». */
function toReady(order: CraftOrder): CraftOrder {
  let current = order;
  const steps: Array<"provisional_agreement" | "confirmed" | "in_progress" | "ready"> = [
    "provisional_agreement",
    "confirmed",
    "in_progress",
    "ready",
  ];
  for (const [index, step] of steps.entries()) {
    current = transitionOrder(current, {
      to: step,
      idempotencyKey: `ord003-step-${index}`,
      createdAt: NOW,
    });
  }
  return current;
}

describe("ORD-003 — delivery responsibility and order result", () => {
  it("orders without delivery terms keep the exact legacy result math (backward compatibility)", () => {
    const order = knownCostOrder(800);
    const breakdown = orderResultBreakdown(order);
    expect(breakdown.billableDeliveryFeeMinor).toBe(0);
    expect(breakdown.projectDeliveryCostMinor).toBe(0);
    expect(breakdown.revenueMinor).toBe(800);
    expect(breakdown.costMinor).toBe(400);
    expect(breakdown.resultMinor).toBe(400);
    expect(breakdown.incompleteReasons).toHaveLength(0);
    expect(orderValueMinor(order)).toBe(800);
    const delivered = transitionOrder(toReady(order), {
      to: "delivered",
      idempotencyKey: "d1",
      createdAt: NOW,
    });
    expect(delivered.recognizedRevenueMinor).toBe(800);
    expect(delivered.recognizedCostMinor).toBe(400);
    expect(delivered.profitIndicatorMinor).toBe(400);
    expect(delivered.resultStatus).toBe("final");
  });

  it("customer pays the project: fee joins order value once and the net delivery effect enters the result once", () => {
    const base = knownCostOrder(800);
    const withTerms = recordDeliveryTerms(base, termsInput);
    expect(orderValueMinor(withTerms)).toBe(1000);
    expect(withTerms.receivableMinor).toBe(1000);
    const breakdown = orderResultBreakdown(withTerms);
    expect(breakdown.revenueMinor).toBe(1000);
    expect(breakdown.costMinor).toBe(500);
    expect(breakdown.resultMinor).toBe(500);
    const delivered = transitionOrder(toReady(withTerms), {
      to: "delivered",
      idempotencyKey: "d2",
      createdAt: NOW,
    });
    expect(delivered.recognizedRevenueMinor).toBe(1000);
    expect(delivered.recognizedCostMinor).toBe(400);
    expect(delivered.profitIndicatorMinor).toBe(500);
  });

  it("fee already included in the sale price is not counted twice", () => {
    const base = knownCostOrder(800);
    const withTerms = recordDeliveryTerms(base, {
      ...termsInput,
      feeIncludedInPrice: true,
      feeChargedMinor: 200,
      idempotencyKey: "ord003-terms-2",
    });
    expect(orderValueMinor(withTerms)).toBe(800);
    const breakdown = orderResultBreakdown(withTerms);
    expect(breakdown.billableDeliveryFeeMinor).toBe(0);
    expect(breakdown.revenueMinor).toBe(800);
    expect(breakdown.resultMinor).toBe(300);
  });

  it("delivery cost already included in product cost is not subtracted twice", () => {
    const base = knownCostOrder(800);
    const withTerms = recordDeliveryTerms(base, {
      ...termsInput,
      costIncludedInProductCost: true,
      costPaidMinor: 100,
      idempotencyKey: "ord003-terms-3",
    });
    const breakdown = orderResultBreakdown(withTerms);
    expect(breakdown.projectDeliveryCostMinor).toBe(0);
    expect(breakdown.costMinor).toBe(400);
    expect(breakdown.resultMinor).toBe(600);
  });

  it("the project pays: cost enters the result once and no fee is charged", () => {
    const base = knownCostOrder(800);
    const withTerms = recordDeliveryTerms(base, {
      ...termsInput,
      responsibility: "project_pays",
      feeChargedMinor: null,
      costPaidMinor: 120,
      idempotencyKey: "ord003-terms-4",
    });
    expect(orderValueMinor(withTerms)).toBe(800);
    const breakdown = orderResultBreakdown(withTerms);
    expect(breakdown.revenueMinor).toBe(800);
    expect(breakdown.costMinor).toBe(520);
    expect(breakdown.resultMinor).toBe(280);
  });

  it("the customer pays the courier directly: contextual information only — no cash, revenue, expense, or cost", () => {
    const base = knownCostOrder(800);
    const withTerms = recordDeliveryTerms(base, {
      ...termsInput,
      responsibility: "customer_pays_courier",
      feeChargedMinor: null,
      costPaidMinor: null,
      idempotencyKey: "ord003-terms-5",
    });
    expect(orderValueMinor(withTerms)).toBe(800);
    const breakdown = orderResultBreakdown(withTerms);
    expect(breakdown.billableDeliveryFeeMinor).toBe(0);
    expect(breakdown.projectDeliveryCostMinor).toBe(0);
    expect(breakdown.revenueMinor).toBe(800);
    expect(breakdown.costMinor).toBe(400);
    expect(breakdown.resultMinor).toBe(400);
    expect(breakdown.incompleteReasons).toHaveLength(0);
  });

  it("shared cost: only the project's recorded share and pass-through amounts enter the math", () => {
    const base = knownCostOrder(800);
    const withTerms = recordDeliveryTerms(base, {
      ...termsInput,
      responsibility: "shared",
      feeChargedMinor: 80,
      costPaidMinor: 60,
      projectShareMinor: 60,
      customerShareMinor: 60,
      idempotencyKey: "ord003-terms-6",
    });
    expect(orderValueMinor(withTerms)).toBe(880);
    const breakdown = orderResultBreakdown(withTerms);
    expect(breakdown.revenueMinor).toBe(880);
    expect(breakdown.costMinor).toBe(460);
    expect(breakdown.resultMinor).toBe(420);
  });

  it("a missing required delivery amount stays unrecorded — no invented zero, result incomplete", () => {
    const base = knownCostOrder(800);
    const withTerms = recordDeliveryTerms(base, {
      ...termsInput,
      feeChargedMinor: null,
      costPaidMinor: null,
      idempotencyKey: "ord003-terms-7",
    });
    const breakdown = orderResultBreakdown(withTerms);
    expect(breakdown.billableDeliveryFeeMinor).toBeNull();
    expect(breakdown.projectDeliveryCostMinor).toBeNull();
    expect(breakdown.revenueMinor).toBeNull();
    expect(breakdown.resultMinor).toBeNull();
    expect(breakdown.incompleteReasons).toContain("أجرة التوصيل عبر المشروع غير مسجلة بعد.");
    expect(breakdown.incompleteReasons).toContain("كلفة النقل التي دفعها المشروع غير مسجلة بعد.");
    /* قيمة الطلب لا تخترع الأجرة الغائبة — تبقى على السعر. */
    expect(orderValueMinor(withTerms)).toBe(800);
    const delivered = transitionOrder(toReady(withTerms), {
      to: "delivered",
      idempotencyKey: "d7",
      createdAt: NOW,
    });
    expect(delivered.resultStatus).toBe("incomplete");
    expect(delivered.profitIndicatorMinor).toBeNull();
  });

  it("zero is an explicit valid amount, not a missing value", () => {
    const base = knownCostOrder(800);
    const withTerms = recordDeliveryTerms(base, {
      ...termsInput,
      feeChargedMinor: 0,
      costPaidMinor: 0,
      idempotencyKey: "ord003-terms-8",
    });
    const breakdown = orderResultBreakdown(withTerms);
    expect(breakdown.billableDeliveryFeeMinor).toBe(0);
    expect(breakdown.projectDeliveryCostMinor).toBe(0);
    expect(breakdown.resultMinor).toBe(400);
    expect(breakdown.incompleteReasons).toHaveLength(0);
  });

  it("an estimate alone never becomes an official result — estimated stays estimated until knowledge is confirmed", () => {
    const base = estimatedCostOrder(800);
    const withTerms = recordDeliveryTerms(base, {
      ...termsInput,
      feeChargedMinor: 200,
      costPaidMinor: 100,
      idempotencyKey: "ord003-terms-9",
    });
    const breakdown = orderResultBreakdown(withTerms);
    /* الربح التقديري يظهر رقمًا موسومًا تقديريًا في الواجهة — وليس نتيجة رسمية. */
    expect(breakdown.resultMinor).toBe(700);
    const delivered = transitionOrder(toReady(withTerms), {
      to: "delivered",
      idempotencyKey: "d9",
      createdAt: NOW,
    });
    expect(delivered.resultStatus).not.toBe("final");
    expect(delivered.profitIndicatorMinor).toBeNull();
    expect(delivered.recognizedRevenueMinor).toBe(1000);
  });

  it("delivery terms are editable before delivery and protected after it", () => {
    const base = knownCostOrder(800);
    const first = recordDeliveryTerms(base, termsInput);
    const edited = recordDeliveryTerms(first, {
      ...termsInput,
      feeChargedMinor: 250,
      costPaidMinor: 90,
      idempotencyKey: "ord003-terms-edit",
    });
    expect(orderValueMinor(edited)).toBe(1050);
    expect(edited.events.filter(event => event.type === "delivery_terms_recorded")).toHaveLength(2);
    const delivered = transitionOrder(toReady(edited), {
      to: "delivered",
      idempotencyKey: "d10",
      createdAt: NOW,
    });
    expect(() =>
      recordDeliveryTerms(delivered, {
        ...termsInput,
        feeChargedMinor: 300,
        idempotencyKey: "ord003-terms-late",
      }),
    ).toThrow(/قبل التسليم/);
  });

  it("replaying the same idempotency key records terms once, and invalid amounts are rejected", () => {
    const base = knownCostOrder(800);
    const once = recordDeliveryTerms(base, termsInput);
    const replay = recordDeliveryTerms(once, termsInput);
    expect(replay.events.filter(event => event.type === "delivery_terms_recorded")).toHaveLength(1);
    expect(() =>
      recordDeliveryTerms(base, { ...termsInput, feeChargedMinor: -1, idempotencyKey: "neg" }),
    ).toThrow(/غير سالب/);
    expect(() =>
      recordDeliveryTerms(base, {
        ...termsInput,
        responsibility: "project_pays",
        feeChargedMinor: 5,
        idempotencyKey: "wrong-fee",
      }),
    ).toThrow(/فقط عندما يدفع الزبون للمشروع/);
    expect(() =>
      recordDeliveryTerms(base, {
        ...termsInput,
        responsibility: "customer_pays_courier",
        feeChargedMinor: null,
        costPaidMinor: 5,
        idempotencyKey: "wrong-cost",
      }),
    ).toThrow(/معلومة سياقية فقط/);
  });

  it("the charged fee is collectable through the existing deposit and remaining flows", () => {
    const base = knownCostOrder(800);
    const withTerms = recordDeliveryTerms(base, termsInput);
    /* عربون 500 ضمن قيمة الطلب 1000 — مقبول. */
    const withDeposit = collectDeposit(withTerms, 500, "ord003-dep", NOW);
    expect(withDeposit.receivableMinor).toBe(500);
    const delivered = transitionOrder(toReady(withDeposit), {
      to: "delivered",
      idempotencyKey: "d11",
      createdAt: NOW,
    });
    /* تحصيل المتبقي 500 كاملًا — يصل إلى القيمة الكاملة (سعر + أجرة). */
    const settled = collectRemaining(delivered, 500, "ord003-rem", NOW);
    expect(settled.receivableMinor).toBe(0);
    expect(settled.status).toBe("settled");
    /* التحصيل فوق قيمة الطلب (سعر + أجرة) مرفوض. */
    const delivered2 = transitionOrder(toReady(withDeposit), {
      to: "delivered",
      idempotencyKey: "d12",
      createdAt: NOW,
    });
    expect(() => collectRemaining(delivered2, 501, "ord003-over", NOW)).toThrow(/لا يمكن أن يتجاوز/);
  });
});
