import { describe, expect, it } from "vitest";
import {
  calculateCostSnapshot,
  cancelOrder,
  collectRemaining,
  createCraftOrder,
  reverseDelivery,
  transitionOrder,
  type CostSnapshot,
  type CraftOrder,
} from "../../src/domain/craft-order/index.js";

/* التحصين الكامل (D-031، المجموعة ٣): Use Case التصحيح الموثق للسجل المسلّم
 * المقفل داخل «يحتاج مراجعة». المصدر الكنسي: AGENTS.md §6 (القفل حتى يوجد
 * Use Case تصحيح موثق) + قرار D-031 + سطر الحارس في policies.ts: «عكس التسليم
 * هو التصحيح الموثق الذي يفتح خروج الطلب المسلّم من المراجعة». reverseDelivery
 * نفسها هي الحد الكنسي — لا عملية correctDelivery جديدة ولا أي اختراع مالي:
 * العكس صريح، مُسبب، موثق الوقت، مرتبط بالحدث الذي يصححه، حتمي بمفتاحه،
 * ولا يمس أي قبض. */

const costSnapshot: CostSnapshot = calculateCostSnapshot("cost-d031", {
  currency: "JOD",
  materialItems: [
    {
      name: "قماش",
      quantity: 2,
      unit: "متر",
      unitPriceMinor: 400,
      priceDate: "2026-09-01",
      source: "user_input",
      confidence: "known",
    },
  ],
  time: { minutes: 90, hourlyRateMinor: 600, confidence: "known" },
  packagingMinor: 100,
  deliveryMinor: 100,
  wasteMinor: 50,
  safetyBufferMinor: 200,
  quantity: 1,
  createdAt: "2026-09-01T09:00:00Z",
  source: "price_approval",
});

function makeOrder(): CraftOrder {
  return createCraftOrder({
    id: "order-d031",
    customerName: "سلمى",
    itemName: "فستان خياطة",
    specifications: "مقاس 38",
    quantity: 1,
    agreedPriceMinor: 7000,
    costSnapshot,
    createdAt: "2026-09-01T09:05:00Z",
  });
}

function confirmAndDeliver(order: CraftOrder): CraftOrder {
  const steps = ["provisional_agreement", "confirmed", "in_progress", "ready"] as const;
  let next = order;
  steps.forEach((to, index) => {
    next = transitionOrder(next, {
      to,
      idempotencyKey: `status-${to}`,
      createdAt: `2026-09-01T09:1${index}:00Z`,
    });
  });
  return transitionOrder(next, {
    to: "delivered",
    idempotencyKey: "status-delivered",
    createdAt: "2026-09-01T09:20:00Z",
  });
}

/** سجل مسلّم دخل «يحتاج مراجعة» (تعارض) وقُبض فيه جزء — الحالة المقفلة نفسها. */
function lockedDeliveredOrder(): CraftOrder {
  const delivered = confirmAndDeliver(makeOrder());
  const withCollection = collectRemaining(delivered, 2500, "collect-partial", "2026-09-02T10:00:00Z");
  return transitionOrder(withCollection, {
    to: "needs_review",
    idempotencyKey: "status-review",
    createdAt: "2026-09-02T11:00:00Z",
  });
}

describe("D-031 documented correction — the locked exit works and preserves history and cash", () => {
  it("accepts the locked state: reversal is the documented exit, explicit, reasoned, and linked", () => {
    const locked = lockedDeliveredOrder();
    const eventsBefore = locked.events.length;
    const corrected = reverseDelivery(locked, {
      reason: "سُلّم قبل إتمام التعديل المتفق عليه",
      idempotencyKey: "d031-reverse",
      createdAt: "2026-09-02T12:00:00Z",
    });
    /* الحالة تبقى «يحتاج مراجعة» — العكس يفتح القفل بعلاقته لا بتغيير الحالة. */
    expect(corrected.status).toBe("needs_review");
    /* الأصل باقٍ: حدث التسليم لم يُحذف ولم يُعدّل، والعكس مرتبط به صراحة. */
    const deliveryEvent = corrected.events.find(
      event => event.type === "status_changed" && event.toStatus === "delivered",
    );
    expect(
      corrected.events.filter(event => event.type === "status_changed" && event.toStatus === "delivered"),
    ).toHaveLength(1);
    const reversalEvent = corrected.events.find(event => event.type === "delivery_reversed");
    expect(reversalEvent).toMatchObject({
      reversesEventId: deliveryEvent!.id,
      idempotencyKey: "d031-reverse",
      note: "سُلّم قبل إتمام التعديل المتفق عليه",
      createdAt: "2026-09-02T12:00:00Z",
    });
    /* لا حدث حالة إضافي: الحالة نفسها قبل وبعد (needs_review) — حدث واحد جديد فقط. */
    expect(corrected.events.length).toBe(eventsBefore + 1);
    /* الأثر المالي: تحييد صادق إلى غياب المعرفة — لا اختراع قيم ولا تصفير كذب. */
    expect(corrected).toMatchObject({
      recognizedRevenueMinor: 0,
      recognizedCostMinor: 0,
      profitIndicatorMinor: null,
      resultStatus: "review_required",
      nextAction: "راجع الطلب بعد التراجع الموثق عن التسليم — أعِد التنفيذ أو ألغِ موثقًا",
    });
    /* الكاش المقبوض لا يُمس — عكس القبضة له مساره الخاص. */
    expect(corrected.collectedMinor).toBe(locked.collectedMinor);
    expect(corrected.events.filter(event => event.type === "collection_recorded").length).toBe(
      locked.events.filter(event => event.type === "collection_recorded").length,
    );
  });
});

describe("D-031 documented correction — unlock, replay, and idempotency", () => {
  it("unlocks the record for the canonical next decisions: re-execution and documented cancellation", () => {
    const corrected = reverseDelivery(lockedDeliveredOrder(), {
      reason: "خطأ تسليم",
      idempotencyKey: "d031-reverse-unlock",
      createdAt: "2026-09-02T12:00:00Z",
    });
    const reconfirmed = transitionOrder(corrected, {
      to: "confirmed",
      idempotencyKey: "d031-reconfirm",
      createdAt: "2026-09-02T13:00:00Z",
    });
    expect(reconfirmed.status).toBe("confirmed");
    const cancelled = cancelOrder(
      reconfirmed,
      "الزبون ألغى بعد التراجع الموثق",
      "d031-cancel",
      "2026-09-02T13:30:00Z",
    );
    expect(cancelled.status).toBe("cancelled");
  });

  it("keeps replay semantics: the same key returns the same record with no duplicate effect", () => {
    const locked = lockedDeliveredOrder();
    const corrected = reverseDelivery(locked, {
      reason: "خطأ تسليم",
      idempotencyKey: "d031-reverse-replay",
      createdAt: "2026-09-02T12:00:00Z",
    });
    const replayed = reverseDelivery(corrected, {
      reason: "إعادة محاولة بعد انقطاع",
      idempotencyKey: "d031-reverse-replay",
      createdAt: "2026-09-03T09:00:00Z",
    });
    expect(replayed).toBe(corrected);
    expect(replayed.events.filter(event => event.type === "delivery_reversed")).toHaveLength(1);
  });
});

describe("D-031 documented correction — honest refusals (no unbounded bypass)", () => {
  it("refuses the correction without a reason — no event, no state change", () => {
    const locked = lockedDeliveredOrder();
    expect(() =>
      reverseDelivery(locked, {
        reason: "   ",
        idempotencyKey: "d031-reverse-no-reason",
        createdAt: "2026-09-02T12:00:00Z",
      }),
    ).toThrow("أكمل سبب التراجع الموثق عن التسليم");
  });

  it("refuses a second correction of the same delivery even from the accepted needs_review state", () => {
    const corrected = reverseDelivery(lockedDeliveredOrder(), {
      reason: "خطأ تسليم",
      idempotencyKey: "d031-reverse-once",
      createdAt: "2026-09-02T12:00:00Z",
    });
    expect(() =>
      reverseDelivery(corrected, {
        reason: "محاولة ثانية",
        idempotencyKey: "d031-reverse-twice",
        createdAt: "2026-09-02T14:00:00Z",
      }),
    ).toThrow("سُجّل التراجع الموثق عن هذا التسليم سابقًا");
  });

  it("still refuses a needs_review record with no delivered event — no unbounded bypass", () => {
    /* طلب دخل «يحتاج مراجعة» قبل أي تسليم (مراجعة مواصفات مثلًا): لا عكس بلا تسليم. */
    const order = makeOrder();
    expect(order.status).toBe("draft");
    let next = transitionOrder(order, {
      to: "provisional_agreement",
      idempotencyKey: "status-provisional",
      createdAt: "2026-09-01T10:00:00Z",
    });
    next = transitionOrder(next, {
      to: "confirmed",
      idempotencyKey: "status-confirmed",
      createdAt: "2026-09-01T10:01:00Z",
    });
    const revised = transitionOrder(next, {
      to: "needs_review",
      idempotencyKey: "status-early-review",
      createdAt: "2026-09-01T10:02:00Z",
    });
    expect(revised.status).toBe("needs_review");
    expect(() =>
      reverseDelivery(revised, {
        reason: "محاولة على طلب غير مسلّم",
        idempotencyKey: "d031-reverse-not-delivered",
        createdAt: "2026-09-01T10:03:00Z",
      }),
    ).toThrow("التراجع الموثق عن التسليم يتطلب طلبًا مسلّمًا");
    /* الرفض بلا أثر: الأحداث كما كانت. */
    expect(reverseDeliveryQuiet(revised, "d031-reverse-not-delivered")).toBeNull();
  });
});

function reverseDeliveryQuiet(order: CraftOrder, key: string): CraftOrder | null {
  try {
    return reverseDelivery(order, {
      reason: "محاولة على طلب غير مسلّم",
      idempotencyKey: key,
      createdAt: "2026-09-01T10:04:00Z",
    });
  } catch {
    return null;
  }
}
