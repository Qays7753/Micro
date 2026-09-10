import { describe, expect, it } from "vitest";
import {
  calculateCostSnapshot,
  collectRemaining,
  collectRegisteredDebt,
  createCraftOrder,
  isRegisteredCustomerDebt,
  knowledgeGapsOf,
  registerDebt,
  retainedDepositMinor,
  reverseDelivery,
  reverseOrderCollection,
  reviseAgreedPrice,
  transitionOrder,
  type CostSnapshot,
  type CraftOrder,
} from "../../src/domain/craft-order/index.js";

/* المجموعة ٢ (التحصين الكامل — D-031/D-2): القفل الصارم للسجل المسلّم داخل
 * «يحتاج مراجعة». قبل هذه المجموعة كان تراجع القبضة يمرّ بينما تصحيح السعر
 * محروس — الباب المالي الوحيد المفتوح على السجل المقفل أُغلق، وكل مسارات
 * القراءة والعرض تبقى تعمل، وحدود المراجعة الموثقة (عكس التسليم) هي المخرج. */

const costSnapshot: CostSnapshot = calculateCostSnapshot("cost-lock", {
  currency: "JOD",
  materialItems: [
    {
      name: "خشب",
      quantity: 2,
      unit: "قطعة",
      unitPriceMinor: 500,
      priceDate: "2026-09-01",
      source: "user_input",
      confidence: "known",
    },
  ],
  time: { minutes: 60, hourlyRateMinor: 600, confidence: "known" },
  packagingMinor: 100,
  deliveryMinor: 100,
  wasteMinor: 50,
  safetyBufferMinor: 250,
  quantity: 1,
  createdAt: "2026-09-01T09:00:00Z",
  source: "price_approval",
});

function makeOrder(): CraftOrder {
  return createCraftOrder({
    id: "order-lock",
    customerName: "ليلى",
    itemName: "رف خشبي",
    specifications: "مقاس متوسط",
    quantity: 1,
    agreedPriceMinor: 8000,
    costSnapshot,
    createdAt: "2026-09-01T09:05:00Z",
  });
}

function confirmAndDeliver(order: CraftOrder): CraftOrder {
  let next = transitionOrder(order, {
    to: "provisional_agreement",
    idempotencyKey: "status-provisional",
    createdAt: "2026-09-01T09:10:00Z",
  });
  next = transitionOrder(next, {
    to: "confirmed",
    idempotencyKey: "status-confirmed",
    createdAt: "2026-09-01T09:11:00Z",
  });
  next = transitionOrder(next, {
    to: "in_progress",
    idempotencyKey: "status-progress",
    createdAt: "2026-09-01T09:12:00Z",
  });
  next = transitionOrder(next, {
    to: "ready",
    idempotencyKey: "status-ready",
    createdAt: "2026-09-01T09:13:00Z",
  });
  return transitionOrder(next, {
    to: "delivered",
    idempotencyKey: "status-delivered",
    createdAt: "2026-09-01T09:14:00Z",
  });
}

/** طلب مسلّم مقفل: دفعت قبضة جزئية ثم انتقل إلى «يحتاج مراجعة» (الباب الوحيد). */
function lockedOrderWithCollection(): CraftOrder {
  const delivered = confirmAndDeliver(makeOrder());
  const withCollection = collectRemaining(delivered, 3000, "collect-partial", "2026-09-02T10:00:00Z");
  return transitionOrder(withCollection, {
    to: "needs_review",
    idempotencyKey: "status-review",
    createdAt: "2026-09-02T11:00:00Z",
  });
}

describe("delivered review lock — strict boundary (D-031)", () => {
  it("blocks the collection reversal asymmetry: locked order refuses with the lock message", () => {
    const locked = lockedOrderWithCollection();
    const collectionEvent = locked.events.find(event => event.type === "collection_recorded");
    if (!collectionEvent) throw new Error("collection event missing");
    expect(locked.status).toBe("needs_review");
    expect(() =>
      reverseOrderCollection(locked, {
        collectionEventId: collectionEvent.id,
        amountMinor: 1000,
        reason: "محاولة تراجع على سجل مقفل",
        idempotencyKey: "locked-reversal",
        createdAt: "2026-09-02T12:00:00Z",
      }),
    ).toThrow("تصحيح موثق صريح");
  });

  it("blocks collectRemaining, registerDebt, and price revision on the same locked order", () => {
    const locked = lockedOrderWithCollection();
    expect(() => collectRemaining(locked, 500, "locked-collect", "2026-09-02T12:01:00Z")).toThrow(
      "تصحيح موثق صريح",
    );
    expect(() => registerDebt(locked, "locked-debt", "2026-09-02T12:02:00Z")).toThrow("تصحيح موثق صريح");
    expect(() =>
      reviseAgreedPrice(locked, {
        newPriceMinor: 9000,
        reason: "تعديل على سجل مقفل",
        idempotencyKey: "locked-price",
        createdAt: "2026-09-02T12:03:00Z",
      }),
    ).toThrow("راجع تعارض الطلب أولًا ثم عدّل السعر بعدها");
  });

  it("keeps replay semantics: a same-key retry of a prior reversal passes before the lock guard", () => {
    /* إعادة المحاولة البريئة بعد نجاح سابق لا تُحجب بالقفل — فحص التكرار
     * يسبق الحارس كما في كل مسارات النطاق. */
    const delivered = confirmAndDeliver(makeOrder());
    const withCollection = collectRemaining(delivered, 3000, "collect-replay", "2026-09-02T10:00:00Z");
    const reversed = reverseOrderCollection(withCollection, {
      collectionEventId: withCollection.events.find(event => event.type === "collection_recorded")!.id,
      amountMinor: 1000,
      reason: "تراجع قبل القفل",
      idempotencyKey: "pre-lock-reversal",
      createdAt: "2026-09-02T10:30:00Z",
    });
    const locked = transitionOrder(reversed, {
      to: "needs_review",
      idempotencyKey: "status-review-after",
      createdAt: "2026-09-02T11:00:00Z",
    });
    const replayed = reverseOrderCollection(locked, {
      collectionEventId: locked.events.find(event => event.type === "collection_recorded")!.id,
      amountMinor: 1000,
      reason: "إعادة محاولة بعد القفل",
      idempotencyKey: "pre-lock-reversal",
      createdAt: "2026-09-02T12:00:00Z",
    });
    expect(replayed).toBe(locked);
  });
});

describe("delivered review lock — guard structure and valid flows (D-031)", () => {
  it("structurally guards collectRegisteredDebt even on a synthetic locked debt record", () => {
    /* الحالة غير واصلة عبر المسارات الحية (الدين لا يقوم إلا على طلب مُسوّى)،
     * لكن الاستيراد/الاستعادة تكتب السجلات كما هي — الحارس البنائي يمنع أي
     * مسار مستقبلي من التحصيل على سجل مسلّم مقفل. */
    const locked = lockedOrderWithCollection();
    const syntheticDebt: CraftOrder = {
      ...locked,
      settlementStatus: "debt",
      receivableMinor: 2000,
    };
    expect(isRegisteredCustomerDebt(syntheticDebt)).toBe(true);
    expect(() =>
      collectRegisteredDebt(syntheticDebt, 500, "synthetic-debt-collect", "2026-09-02T12:05:00Z"),
    ).toThrow("تصحيح موثق صريح");
  });

  it("keeps read-only review and forensic views working on a locked order", () => {
    const locked = lockedOrderWithCollection();
    expect(locked.status).toBe("needs_review");
    expect(retainedDepositMinor(locked)).toBe(0);
    expect(Array.isArray(knowledgeGapsOf(locked.costSnapshot))).toBe(true);
    expect(locked.events.some(event => event.type === "collection_recorded")).toBe(true);
    expect(isRegisteredCustomerDebt(locked)).toBe(false);
  });

  it("does not break the valid flow after a documented delivery reversal (needs_review unlocked)", () => {
    /* عكس التسليم الموثق هو التصحيح الذي يفتح الخروج من المراجعة: بعده
     * يبقى تحصيل الدين المسجل وتراجع القبضة متاحين — لا تعميم للقفل فوق
     * الحالات غير المقفلة. */
    const delivered = confirmAndDeliver(makeOrder());
    const withCollection = collectRemaining(delivered, 3000, "collect-debt-flow", "2026-09-02T10:00:00Z");
    const withDebt = registerDebt(withCollection, "debt-flow", "2026-09-02T10:15:00Z");
    expect(withDebt.status).toBe("settled");
    expect(withDebt.settlementStatus).toBe("debt");
    const reversedDelivery = reverseDelivery(withDebt, {
      reason: "سُلّم للجهة الخطأ",
      idempotencyKey: "reverse-delivery-flow",
      createdAt: "2026-09-02T10:30:00Z",
    });
    expect(reversedDelivery.status).toBe("needs_review");
    const collected = collectRegisteredDebt(
      reversedDelivery,
      1000,
      "debt-collect-after-reversal",
      "2026-09-02T11:00:00Z",
    );
    expect(collected.collectedMinor).toBe(4000);
    const reversalEvent = collected.events.find(
      event => event.type === "collection_recorded" && event.idempotencyKey === "debt-collect-after-reversal",
    );
    expect(reversalEvent).toBeTruthy();
  });
});
