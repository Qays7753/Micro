import { describe, expect, it } from "vitest";
import {
  calculateCostSnapshot,
  collectDeposit,
  collectRemaining,
  createCraftOrder,
  registerDebt,
  reverseDelivery,
  reverseOrderCollection,
  reviseAgreedPrice,
  transitionOrder,
  type CostSnapshot,
  type CraftOrder,
} from "../../src/domain/craft-order/index.js";

/**
 * R11 W1b-6 / OD-PRESERVE (P-03): توصيف مباشر + تدريبات تحوير لأعلى عناقيد
 * الخطر في سطح سياسات أمر الشغل — بلا أي نقل أو إعادة كتابة للسياسات أو
 * الرسائل أو التقريب أو الثوابت (البطاقة P-03 محفوظة؛ هذا الملف أدلة فقط).
 *
 * العنقودان المختاران (الأعلى خطرًا وفق بطاقة P-03):
 *  ١) قفل المراجعة للطلب المسلّم (needs_review + delivered بلا عكس):
 *     الرسائل العربية مثبتة بالنقاط الكاملة (code points) لا بالتقريب،
 *     وحدود القفل مثبتة (بدون حدث تسليم = لا قفل؛ بعد عكس موثق = مفتوح).
 *  ٢) حدود التسوية والتحصيل: الصفر المتبقي بالضبط يُسوّي، والناقص لا يُسوّي،
 *     والتجاوز مرفوض برسالة العقد، والمبلغ غير الموجب مرفوض.
 *
 * تدريبات التحوير (mutation/weakening drills) — توصيف صادق لا ترقيع:
 *  - تبديل حقل الحالة يدويًا على طلب مقفل (تحوير خام) يفتح القفل: السياسة
 *    اشتقاق حالة داخل عقد الدالة النقية، والدفاع ضد تحوير المدخلات ليس
 *    مسؤولية المجال بل طبقة التخزين (storage_stale + حراس الالتزام) —
 *    مسجلاً هنا كحدّ موثق للسطح، لا كعيب جديد.
 *  - إزالة حدث التسليم من طلب مقفل تُسقط القفل للسبب نفسه.
 *  - إعادة المفتاح الحتمي تُعيد الطلب نفسه (replay آمن)، والمفتاح الثاني
 *    للتحصيل نفسه يصطدم بحد التجاوز فورًا.
 */

const costSnapshot: CostSnapshot = calculateCostSnapshot("cost-p03", {
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

const ORDER_VALUE = 8000; /* agreedPriceMinor لطلب الاختبار أدناه. */

function makeOrder(id = "order-p03"): CraftOrder {
  return createCraftOrder({
    id,
    customerName: "ليلى",
    itemName: "رف خشبي",
    specifications: "مقاس متوسط",
    quantity: 1,
    agreedPriceMinor: ORDER_VALUE,
    costSnapshot,
    createdAt: "2026-09-01T09:05:00Z",
  });
}

function confirmAndDeliver(order: CraftOrder): CraftOrder {
  const steps = ["provisional_agreement", "confirmed", "in_progress", "ready"] as const;
  let next = order;
  for (const [index, to] of steps.entries()) {
    next = transitionOrder(next, {
      to,
      idempotencyKey: `status-${index}`,
      createdAt: `2026-09-01T09:1${index}:00Z`,
    });
  }
  return transitionOrder(next, {
    to: "delivered",
    idempotencyKey: "status-delivered",
    createdAt: "2026-09-01T09:15:00Z",
  });
}

/** طلب مسلّم مقفل: قبضة جزئية ثم «يحتاج مراجعة» (الباب الوحيد). */
function lockedOrderWithCollection(): CraftOrder {
  const delivered = confirmAndDeliver(makeOrder());
  const withCollection = collectRemaining(delivered, 3000, "collect-partial", "2026-09-02T10:00:00Z");
  return transitionOrder(withCollection, {
    to: "needs_review",
    idempotencyKey: "status-review",
    createdAt: "2026-09-02T11:00:00Z",
  });
}

/** عنقود ١ / اختبار ١: تثبيت رسالة القفل بنقاط الكود الكاملة لكل
 * مسارات الكتابة المالية الأربعة (تحصيل، دين، عربون، عكس تحصيل) —
 * مستخرج لنطاق الوحدة ليبقى جسم التوصيف تحت سقف الدالة (لا تغطية أبدلت). */
function lockMessageIsPinnedByFullCodePoints(): void {
  const locked = lockedOrderWithCollection();
  const collectionEvent = locked.events.find(event => event.type === "collection_recorded");
  if (!collectionEvent) throw new Error("collection event missing");
  const expectedCodePoints = Array.from("الطلب المسلّم لا يخرج من «يحتاج مراجعة» إلا بتصحيح موثق صريح.");
  const pin = (fn: () => unknown) => {
    try {
      fn();
      throw new Error("expected the lock to throw");
    } catch (error) {
      const message = (error as Error).message;
      expect(Array.from(message)).toEqual(expectedCodePoints);
    }
  };
  pin(() => collectRemaining(locked, 500, "x-1", "2026-09-03T10:00:00Z"));
  pin(() => registerDebt(locked, "x-2", "2026-09-03T10:01:00Z"));
  pin(() => collectDeposit(locked, 100, "x-3", "2026-09-03T10:02:00Z"));
  pin(() =>
    reverseOrderCollection(locked, {
      collectionEventId: collectionEvent.id,
      amountMinor: 1000,
      reason: "محاولة تحوير",
      idempotencyKey: "x-4",
      createdAt: "2026-09-03T10:03:00Z",
    }),
  );
}

/** عنقود ١ / اختبار ٢ (مستخرج لنطاق الوحدة — نفس الجسم بلا تبديل). */
function priceRevisionOnLockedThrowsItsOwnMessage(): void {
  const locked = lockedOrderWithCollection();
  expect(() =>
    reviseAgreedPrice(locked, {
      newPriceMinor: 9000,
      reason: "محاولة تعديل على مقفل",
      idempotencyKey: "revise-locked",
      createdAt: "2026-09-03T10:04:00Z",
    }),
  ).toThrow("راجع تعارض الطلب أولًا ثم عدّل السعر بعدها");
}

/** عنقود ١ / اختبار ٣ (مستخرج لنطاق الوحدة — نفس الجسم بلا تبديل). */
function needsReviewFromDraftIsNotLocked(): void {
  const reviewFromDraft = transitionOrder(makeOrder(), {
    to: "needs_review",
    idempotencyKey: "draft-review",
    createdAt: "2026-09-01T09:06:00Z",
  });
  expect(reviewFromDraft.status).toBe("needs_review");
  const withDeposit = collectDeposit(reviewFromDraft, 500, "deposit-open-review", "2026-09-01T09:07:00Z");
  expect(withDeposit.depositCollectedMinor).toBe(500);
}

/** عنقود ١ / اختبار ٤ (مستخرج لنطاق الوحدة — نفس الجسم بلا تبديل). */
function documentedUnlockPathReopensCollection(): void {
  const locked = lockedOrderWithCollection();
  const unlocked = reverseDelivery(locked, {
    reason: "تصحيح موثق لفتح المراجعة",
    idempotencyKey: "reverse-to-unlock",
    createdAt: "2026-09-03T11:00:00Z",
  });
  /* بعد العكس يعود الطلب لما قبل التسليم (ليس مسلّمًا) — التحصيل يتطلب
   * إعادة تسليم موثقة جديدة (المسار الموثق لا اختصار له). */
  expect(() => collectRemaining(unlocked, 500, "too-early", "2026-09-03T11:00:30Z")).toThrow(
    "تحصيل المتبقي يتطلب طلبًا مسلّمًا.",
  );
  const reconfirmed = transitionOrder(unlocked, {
    to: "confirmed",
    idempotencyKey: "reconfirm-after-review",
    createdAt: "2026-09-03T11:00:45Z",
  });
  const redelivered = (["in_progress", "ready", "delivered"] as const).reduce(
    (current, to) =>
      transitionOrder(current, {
        to,
        idempotencyKey: `redeliver-${to}`,
        createdAt: "2026-09-03T11:01:00Z",
      }),
    reconfirmed,
  );
  const collectable = collectRemaining(redelivered, 500, "after-unlock", "2026-09-03T11:02:00Z");
  expect(collectable.collectedMinor).toBe(3500);
}

describe("P-03 عنقود ١ — قفل المراجعة: الرسائل العربية بالنقاط الكاملة وحدود القفل", () => {
  it(
    "رسالة القفل مثبتة بنقاط الكود الكاملة (لا تقريب نصي) لكل مسارات الكتابة المالية",
    lockMessageIsPinnedByFullCodePoints,
  );
  it(
    "تعديل السعر على المقفل برسالته الخاصة (مسار مختلف عمدًا — نفس القفل)",
    priceRevisionOnLockedThrowsItsOwnMessage,
  );
  it(
    "حد القفل: «يحتاج مراجعة» بلا حدث تسليم (من المسودة) ليس مقفلًا — العربون يمر",
    needsReviewFromDraftIsNotLocked,
  );
  it(
    "حد فتح القفل الموثق: عكس التسليم ثم إعادة التسليم يفتح طريق التحصيل من جديد",
    documentedUnlockPathReopensCollection,
  );
});

describe("P-03 عنقود ٢ — حدود التسوية والتحصيل (توصيف مباشر بقيم الحدود)", () => {
  it("الصفر المتبقي بالضبط يسوّي (settled) والمتبقي = 0", () => {
    const delivered = confirmAndDeliver(makeOrder("settle-exact"));
    const settled = collectRemaining(delivered, ORDER_VALUE, "collect-all", "2026-09-02T10:00:00Z");
    expect(settled.status).toBe("settled");
    expect(settled.receivableMinor).toBe(0);
  });

  it("الناقص دينارًا واحدًا (minor واحد) لا يُسوّي — يبقى مسلّمًا بمتبقٍ ١", () => {
    const delivered = confirmAndDeliver(makeOrder("settle-short"));
    const almost = collectRemaining(delivered, ORDER_VALUE - 1, "collect-short", "2026-09-02T10:00:00Z");
    expect(almost.status).toBe("delivered");
    expect(almost.receivableMinor).toBe(1);
  });

  it("التحصيل فوق القيمة القابلة للتحصيل مرفوض برسالة العقد الحرفية", () => {
    const delivered = confirmAndDeliver(makeOrder("settle-over"));
    expect(() =>
      collectRemaining(delivered, ORDER_VALUE + 1, "collect-over", "2026-09-02T10:00:00Z"),
    ).toThrow("التحصيل لا يمكن أن يتجاوز قيمة الطلب القابلة للتحصيل.");
  });

  it("العربون الكامل + التسليم = تسوية مباشرة (القاعدة الموثقة)؛ لا تحصيل بعدها أصلًا", () => {
    const order = makeOrder("deposit-full");
    const fullyDeposited = collectDeposit(order, ORDER_VALUE, "deposit-all", "2026-09-01T09:06:00Z");
    const delivered = confirmAndDeliver(fullyDeposited);
    /* القاعدة الموثقة (AGENTS §6): الدفع الكامل مقدمًا ثم التسليم ينقل
     * الطلب إلى settled إذا كان المتبقي صفرًا — لا مسار تحصيل أصلًا. */
    expect(delivered.status).toBe("settled");
    expect(delivered.receivableMinor).toBe(0);
    expect(() => collectRemaining(delivered, 1, "collect-after-full", "2026-09-02T10:00:00Z")).toThrow(
      "تحصيل المتبقي يتطلب طلبًا مسلّمًا.",
    );
  });

  it("المبلغ غير الموجب مرفوض برسالة العقد الحرفية (صفر وسالب)", () => {
    const delivered = confirmAndDeliver(makeOrder("settle-invalid"));
    const message = "أدخل مبلغ التحصيل رقمًا صحيحًا موجبًا بالدينار الأردني ضمن الدقة الآمنة.";
    expect(() => collectRemaining(delivered, 0, "collect-zero", "2026-09-02T10:00:00Z")).toThrow(message);
    expect(() => collectRemaining(delivered, -5, "collect-negative", "2026-09-02T10:01:00Z")).toThrow(
      message,
    );
  });

  it("العربون على طلب مسلّم مرفوض برسالة الحالة العربية الحرفية", () => {
    const delivered = confirmAndDeliver(makeOrder("deposit-delivered"));
    expect(() => collectDeposit(delivered, 100, "deposit-late", "2026-09-02T10:00:00Z")).toThrow(
      "لا يمكن تسجيل العربون والطلب في حالة «تم التسليم».",
    );
  });

  it("تحصيل المتبقي قبل التسليم مرفوض برسالته الحرفية (ترتيب الحالة محروس)", () => {
    const confirmed = transitionOrder(makeOrder("premature"), {
      to: "provisional_agreement",
      idempotencyKey: "status-0",
      createdAt: "2026-09-01T09:10:00Z",
    });
    expect(() => collectRemaining(confirmed, 100, "collect-early", "2026-09-01T09:11:00Z")).toThrow(
      "تحصيل المتبقي يتطلب طلبًا مسلّمًا.",
    );
  });
});

describe("P-03 تدريبات التحوير — توصيف صادق لحدود السياسة اشتقاق الحالة (لا ترقيع)", () => {
  it("تبديل حقل الحالة يدويًا على المقفل (تحوير خام) يفتح القفل — الدفاع ضد تحوير المدخلات في طبقة التخزين لا المجال", () => {
    const locked = lockedOrderWithCollection();
    expect(() => collectRemaining(locked, 1, "tampered-1", "2026-09-03T12:00:00Z")).toThrow(
      "الطلب المسلّم لا يخرج من «يحتاج مراجعة» إلا بتصحيح موثق صريح.",
    );
    /* التحوير: نسخة بحالة «تم التسليم» بدل «يحتاج مراجعة» (تلاعب خام خارج
     * عقد الدوال النقية — المجال يستهلك حالات منتجة من مساره لا مصنوعة).
     * التوصيف: القفل اشتقاق حالة داخل الدالة، فإزالة الحالة تُسقطه؛ ضابط
     * التعويض الموثق هو طبقة التخزين: storage_stale على الكتابة الحساسة
     * + حراس الالتزام (orderCommitGuard ونظراؤها) + مفاتيح الحتمية. */
    const tampered: CraftOrder = { ...locked, status: "delivered" };
    const collected = collectRemaining(tampered, 1, "tampered-2", "2026-09-03T12:01:00Z");
    expect(collected.collectedMinor).toBe(3001);
  });

  it("إزالة حدث التسليم من المقفل تُسقط القفل — لكن فحص الحالة الثاني يبقى يرفض التحصيل (دفاع طبقي)", () => {
    const locked = lockedOrderWithCollection();
    const tampered: CraftOrder = {
      ...locked,
      events: locked.events.filter(
        event => !(event.type === "status_changed" && event.toStatus === "delivered"),
      ),
    };
    expect(() => collectRemaining(locked, 1, "evt-1", "2026-09-03T12:02:00Z")).toThrow(
      "الطلب المسلّم لا يخرج من «يحتاج مراجعة» إلا بتصحيح موثق صريح.",
    );
    /* التحوير يُسقط قفل المراجعة (لم يعد ثمّة حدث تسليم) — لكن فحص الحالة
     * المستقل في collectRemaining يرفض التحصيل على «يحتاج مراجعة": طبقتا
     * دفاع منفصلتان داخل الدالة نفسها. */
    expect(() => collectRemaining(tampered, 1, "evt-2", "2026-09-03T12:03:00Z")).toThrow(
      "تحصيل المتبقي يتطلب طلبًا مسلّمًا.",
    );
  });

  it("إعادة المفتاح الحتمي تُعيد الطلب نفسه (replay آمن بالمرجع)؛ والمفتاح الثاني فوق الحد يصطدم بحد التجاوز", () => {
    const delivered = confirmAndDeliver(makeOrder("replay"));
    const first = collectRemaining(delivered, 3000, "replay-key", "2026-09-02T10:00:00Z");
    expect(first.collectedMinor).toBe(3000);
    const replay = collectRemaining(first, 3000, "replay-key", "2026-09-04T10:00:00Z");
    expect(replay).toBe(first);
    /* ٣٠٠٠ + ٥٠٠١ > ٨٠٠٠: المفتاح الثاني فوق الحد يُرفض برسالة العقد. */
    expect(() => collectRemaining(first, 5001, "second-key", "2026-09-04T10:01:00Z")).toThrow(
      "التحصيل لا يمكن أن يتجاوز قيمة الطلب القابلة للتحصيل.",
    );
    /* والمفتاح الثاني ضمن الحد يمرّ ويسجّل (السلوك الموثق: لا منع، بل سقف). */
    const second = collectRemaining(first, 5000, "second-key", "2026-09-04T10:02:00Z");
    expect(second.collectedMinor).toBe(8000);
    expect(second.status).toBe("settled");
  });
});
