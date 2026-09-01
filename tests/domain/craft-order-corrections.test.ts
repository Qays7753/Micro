import { describe, expect, it } from "vitest";
import {
  calculateCostSnapshot,
  collectDeposit,
  collectRegisteredDebt,
  collectRemaining,
  createCraftOrder,
  registerDebt,
  reviseAgreedPrice,
  reverseOrderCollection,
  transitionOrder,
  type CostSnapshot,
  type CraftOrder,
} from "../../src/domain/craft-order/index.js";

const costSnapshot: CostSnapshot = calculateCostSnapshot("cost-g2", {
  currency: "JOD",
  materialItems: [
    {
      name: "خيط",
      quantity: 1,
      unit: "لفة",
      unitPriceMinor: 1500,
      priceDate: "2026-09-01",
      source: "user_input",
      confidence: "known",
    },
  ],
  time: { minutes: 60, hourlyRateMinor: 1000, confidence: "known" },
  packagingMinor: 0,
  deliveryMinor: 0,
  wasteMinor: 0,
  safetyBufferMinor: 0,
  quantity: 1,
  createdAt: "2026-09-01T08:00:00Z",
  source: "price_approval",
});

function makeOrder(overrides: Partial<Parameters<typeof createCraftOrder>[0]> = {}): CraftOrder {
  return createCraftOrder({
    id: "order-g2",
    customerName: "ليلى",
    itemName: "فستان مطرز",
    specifications: "مقاس متوسط",
    quantity: 1,
    agreedPriceMinor: 8000,
    costSnapshot,
    createdAt: "2026-09-01T08:05:00Z",
    ...overrides,
  });
}

function agreedOrder(): CraftOrder {
  return transitionOrder(makeOrder(), {
    to: "provisional_agreement",
    idempotencyKey: "status-provisional",
    createdAt: "2026-09-01T08:10:00Z",
  });
}

function deliveredOrder(): CraftOrder {
  return deliverFrom(agreedOrder(), "status");
}

/* سلسلة التسليم بادئة مفاتيح قابلة للتمييز — تستخدمها مسارات تصحيح القبض
 * والسعر؛ أداة واحدة لا سلاسل منسوخة داخل كل اختبار. */
function deliverFrom(order: CraftOrder, prefix: string): CraftOrder {
  let next = transitionOrder(order, {
    to: "confirmed",
    idempotencyKey: `${prefix}-confirmed`,
    createdAt: "2026-09-01T08:11:00Z",
  });
  next = transitionOrder(next, {
    to: "in_progress",
    idempotencyKey: `${prefix}-progress`,
    createdAt: "2026-09-01T08:12:00Z",
  });
  next = transitionOrder(next, {
    to: "ready",
    idempotencyKey: `${prefix}-ready`,
    createdAt: "2026-09-01T08:13:00Z",
  });
  return transitionOrder(next, {
    to: "delivered",
    idempotencyKey: `${prefix}-delivered`,
    createdAt: "2026-09-01T08:14:00Z",
  });
}

function deliveredWithCollection(): CraftOrder {
  const withDeposit = collectDeposit(agreedOrder(), 2000, "deposit-r1", "2026-09-01T09:00:00Z");
  return collectRemaining(deliverFrom(withDeposit, "status-r"), 3000, "collect-r1", "2026-09-01T10:00:00Z");
}

describe("reviseAgreedPrice — تصحيح السعر بعد الاتفاق (المجموعة ٢)", () => {
  it("يعدّل السعر ويحفظ الاتفاق الأصلي والسبب في الأحداث", () => {
    const revised = reviseAgreedPrice(agreedOrder(), {
      newPriceMinor: 9500,
      reason: "زيادة التطريز بطلب العميل",
      idempotencyKey: "revise-1",
      createdAt: "2026-09-02T10:00:00Z",
    });
    expect(revised.agreedPriceMinor).toBe(9500);
    expect(revised.receivableMinor).toBe(9500);
    const event = revised.events.find(item => item.type === "price_revised");
    expect(event).toBeDefined();
    expect(event?.fromPriceMinor).toBe(8000);
    expect(event?.toPriceMinor).toBe(9500);
    expect(event?.note).toBe("زيادة التطريز بطلب العميل");
  });

  it("لا يبدّل الإيراد المعروف قبل التسليم — الإيراد يُعرف عند التسليم", () => {
    const revised = reviseAgreedPrice(agreedOrder(), {
      newPriceMinor: 9000,
      reason: "تعديل بعد الاتفاق",
      idempotencyKey: "revise-2",
      createdAt: "2026-09-02T10:00:00Z",
    });
    expect(revised.recognizedRevenueMinor).toBe(0);
  });

  it("يجدّد الإيراد المعروف ومؤشر النتيجة بعد التسليم النهائي", () => {
    const delivered = deliveredOrder();
    const revised = reviseAgreedPrice(delivered, {
      newPriceMinor: 9000,
      reason: "تعديل ثمن بعد التسليم",
      idempotencyKey: "revise-3",
      createdAt: "2026-09-02T10:00:00Z",
    });
    expect(revised.recognizedRevenueMinor).toBe(9000);
    expect(revised.resultStatus).toBe("final");
    expect(revised.profitIndicatorMinor).toBe(9000 - delivered.recognizedCostMinor);
  });

  it("يحفظ العربون والقبضات المسجلة ويفتح المتبقي وفق السعر الجديد", () => {
    let order = collectDeposit(agreedOrder(), 2000, "deposit-1", "2026-09-01T09:00:00Z");
    order = deliverFrom(order, "status-a");
    order = collectRemaining(order, 3000, "collect-1", "2026-09-01T10:00:00Z");
    const revised = reviseAgreedPrice(order, {
      newPriceMinor: 10000,
      reason: "إضافة شغل إضافي",
      idempotencyKey: "revise-4",
      createdAt: "2026-09-02T10:00:00Z",
    });
    expect(revised.collectedMinor).toBe(5000);
    expect(revised.depositCollectedMinor).toBe(2000);
    expect(revised.receivableMinor).toBe(5000);
    expect(revised.settlementStatus).toBe("partially_paid");
  });
});

/* الحمايات والتكرار — رفض التصحيحات غير الصالحة لا يمس السجل أبدًا. */
describe("reviseAgreedPrice — الحمايات والتكرار (المجموعة ٢)", () => {
  it("يرفض سعرًا أقل مما قُبض فعليًا", () => {
    const order = collectDeposit(agreedOrder(), 4000, "deposit-2", "2026-09-01T09:00:00Z");
    expect(() =>
      reviseAgreedPrice(order, {
        newPriceMinor: 3900,
        reason: "خطأ",
        idempotencyKey: "revise-5",
        createdAt: "2026-09-02T10:00:00Z",
      }),
    ).toThrow("السعر الجديد لا يمكن أن يقل عمّا قُبض فعليًا");
  });

  it("يرفض المسودة والملغى ويحتاج مراجعة وبلا سبب وبلا تغيير", () => {
    expect(() =>
      reviseAgreedPrice(makeOrder(), {
        newPriceMinor: 9000,
        reason: "سبب",
        idempotencyKey: "revise-6",
        createdAt: "2026-09-02T10:00:00Z",
      }),
    ).toThrow("يتطلب اتفاقًا مسجلًا");
    expect(() =>
      reviseAgreedPrice(agreedOrder(), {
        newPriceMinor: 9000,
        reason: "",
        idempotencyKey: "revise-7",
        createdAt: "2026-09-02T10:00:00Z",
      }),
    ).toThrow("أكمل سبب تعديل السعر");
    expect(() =>
      reviseAgreedPrice(agreedOrder(), {
        newPriceMinor: 8000,
        reason: "لا تغيير",
        idempotencyKey: "revise-8",
        createdAt: "2026-09-02T10:00:00Z",
      }),
    ).toThrow("يطابق السعر الحالي");
  });

  it("idempotent: نفس المفتاح لا يضيف حدثًا ثانيًا", () => {
    const once = reviseAgreedPrice(agreedOrder(), {
      newPriceMinor: 9000,
      reason: "سبب",
      idempotencyKey: "revise-9",
      createdAt: "2026-09-02T10:00:00Z",
    });
    const twice = reviseAgreedPrice(once, {
      newPriceMinor: 9000,
      reason: "سبب",
      idempotencyKey: "revise-9",
      createdAt: "2026-09-02T11:00:00Z",
    });
    expect(twice.events.filter(item => item.type === "price_revised")).toHaveLength(1);
  });
});

describe("reverseOrderCollection — التراجع عن قبض مسجل (المجموعة ٢)", () => {
  it("يرد المبلغ للعميل ويعيد فتح المتبقي دون مسّ الإيراد", () => {
    const order = deliveredWithCollection();
    const collectionEvent = order.events.find(item => item.type === "collection_recorded");
    expect(collectionEvent).toBeDefined();
    const reversed = reverseOrderCollection(order, {
      collectionEventId: collectionEvent!.id,
      amountMinor: 3000,
      reason: "رُدّ المبلغ للعميل",
      idempotencyKey: "reverse-1",
      createdAt: "2026-09-02T10:00:00Z",
    });
    expect(reversed.collectedMinor).toBe(2000);
    expect(reversed.receivableMinor).toBe(6000);
    expect(reversed.recognizedRevenueMinor).toBe(8000);
    expect(reversed.settlementStatus).toBe("partially_paid");
    const event = reversed.events.find(item => item.type === "collection_reversed");
    expect(event?.reversesEventId).toBe(collectionEvent!.id);
    expect(event?.amountMinor).toBe(3000);
  });

  it("تراجع جزئي مسموح والتراكمي لا يتجاوز القبضة", () => {
    const order = deliveredWithCollection();
    const collectionEvent = order.events.find(item => item.type === "collection_recorded")!;
    const partial = reverseOrderCollection(order, {
      collectionEventId: collectionEvent.id,
      amountMinor: 1000,
      reason: "قبض زائد",
      idempotencyKey: "reverse-2",
      createdAt: "2026-09-02T10:00:00Z",
    });
    expect(partial.collectedMinor).toBe(4000);
    expect(() =>
      reverseOrderCollection(partial, {
        collectionEventId: collectionEvent.id,
        amountMinor: 2500,
        reason: "زيادة",
        idempotencyKey: "reverse-3",
        createdAt: "2026-09-02T10:30:00Z",
      }),
    ).toThrow("لا يمكن أن يتجاوز مبلغ القبضة المسجلة");
  });
});

describe("reverseOrderCollection — طلب مسوّى يعود دينًا (المجموعة ٢)", () => {
  it("طلب مسوّى بقبض كامل يعود دينًا مسجلًا بعد التراجع", () => {
    let order = deliveredOrder();
    order = collectRemaining(order, 8000, "collect-full", "2026-09-01T11:00:00Z");
    expect(order.status).toBe("settled");
    expect(order.settlementStatus).toBe("paid");
    const collectionEvent = order.events.find(
      item => item.type === "collection_recorded" && item.idempotencyKey === "collect-full",
    )!;
    const reversed = reverseOrderCollection(order, {
      collectionEventId: collectionEvent.id,
      amountMinor: 8000,
      reason: "شيك مرتجع",
      idempotencyKey: "reverse-4",
      createdAt: "2026-09-02T10:00:00Z",
    });
    expect(reversed.status).toBe("settled");
    expect(reversed.settlementStatus).toBe("debt");
    expect(reversed.receivableMinor).toBe(8000);
  });
});

/* رفض مسارات التراجع غير الصالحة — لا كتابة عند الرفض، والطلب كما هو. */
describe("reverseOrderCollection — الحمايات (المجموعة ٢)", () => {
  function reverseTestOrder(): CraftOrder {
    const withDeposit = collectDeposit(agreedOrder(), 2000, "deposit-g", "2026-09-01T09:00:00Z");
    return collectRemaining(deliverFrom(withDeposit, "status-g"), 3000, "collect-g", "2026-09-01T10:00:00Z");
  }

  it("يرفض أحداث غير القبض وبلا سبب والطلب الملغى", () => {
    const order = reverseTestOrder();
    const depositEvent = order.events.find(item => item.type === "deposit_collected")!;
    expect(() =>
      reverseOrderCollection(order, {
        collectionEventId: depositEvent.id,
        amountMinor: 100,
        reason: "سبب",
        idempotencyKey: "reverse-5",
        createdAt: "2026-09-02T10:00:00Z",
      }),
    ).toThrow("اختر قبضة مسجلة");
    expect(() =>
      reverseOrderCollection(order, {
        collectionEventId: "missing",
        amountMinor: 100,
        reason: "سبب",
        idempotencyKey: "reverse-6",
        createdAt: "2026-09-02T10:00:00Z",
      }),
    ).toThrow("اختر قبضة مسجلة");
    expect(() =>
      reverseOrderCollection(order, {
        collectionEventId: order.events.find(item => item.type === "collection_recorded")!.id,
        amountMinor: 3000,
        reason: "",
        idempotencyKey: "reverse-7",
        createdAt: "2026-09-02T10:00:00Z",
      }),
    ).toThrow("أكمل سبب التراجع");
  });
});

describe("reverseOrderCollection — تراجع تحصيل الدين (المجموعة ٢)", () => {
  it("تحصيل الدين المسجل قابل للتراجع أيضًا", () => {
    let order = deliveredOrder();
    order = registerDebt(order, "register-debt", "2026-09-01T11:00:00Z");
    order = collectRegisteredDebt(order, 3000, "debt-collect-1", "2026-09-02T09:00:00Z");
    const collectionEvent = order.events.find(
      item => item.type === "collection_recorded" && item.idempotencyKey === "debt-collect-1",
    )!;
    const reversed = reverseOrderCollection(order, {
      collectionEventId: collectionEvent.id,
      amountMinor: 3000,
      reason: "أُعيد المبلغ",
      idempotencyKey: "reverse-8",
      createdAt: "2026-09-02T10:00:00Z",
    });
    expect(reversed.collectedMinor).toBe(0);
    expect(reversed.receivableMinor).toBe(8000);
    expect(reversed.settlementStatus).toBe("debt");
  });
});
