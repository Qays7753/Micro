import { describe, expect, it } from "vitest";
import {
  calculateCostSnapshot,
  cancelOrder,
  createCraftOrder,
  noteDeliveryConsumption,
  reverseDelivery,
  reviseAgreedPrice,
  transitionOrder,
} from "../../src/domain/craft-order/index.js";
import { createCatalogTemplate } from "../../src/domain/catalog/index.js";

/* المجموعة ٣ (عقد D2/D7 — SA-5 R2b/c): عقود النطاق الجديدة — عكس التسليم
 * وتوثيق استهلاكه وفتح قفل المراجعة، وثبات هوية المادة في نسخة التكلفة،
 * وبنود القالب الاختيارية. */

function baseSnapshot() {
  return calculateCostSnapshot("snap-g3", {
    currency: "JOD",
    materialItems: [
      {
        name: "قماش",
        quantity: 2,
        unit: "متر",
        unitPriceMinor: 500,
        priceDate: "2026-09-01",
        source: "user_input",
        confidence: "known",
        materialId: "mat-1",
      },
    ],
    time: null,
    packagingMinor: 0,
    deliveryMinor: 0,
    wasteMinor: 0,
    safetyBufferMinor: 0,
    quantity: 1,
    createdAt: "2026-09-04T08:00:00.000Z",
    source: "draft",
  });
}

function orderAtReady() {
  const order = createCraftOrder({
    id: "o-g3",
    customerName: "سارة",
    itemName: "فستان",
    specifications: "تطريز",
    quantity: 1,
    agreedPriceMinor: 5000,
    costSnapshot: baseSnapshot(),
    createdAt: "2026-09-04T08:00:00.000Z",
  });
  return transitionOrder(
    transitionOrder(
      transitionOrder(order, {
        to: "provisional_agreement",
        idempotencyKey: "a",
        createdAt: "2026-09-04T08:01:00.000Z",
      }),
      { to: "confirmed", idempotencyKey: "b", createdAt: "2026-09-04T08:02:00.000Z" },
    ),
    { to: "in_progress", idempotencyKey: "c", createdAt: "2026-09-04T08:03:00.000Z" },
  );
}

function deliveredOrder() {
  const ready = orderAtReady();
  const readyState = transitionOrder(ready, {
    to: "ready",
    idempotencyKey: "d",
    createdAt: "2026-09-04T08:04:00.000Z",
  });
  return transitionOrder(readyState, {
    to: "delivered",
    idempotencyKey: "o-g3:deliver",
    createdAt: "2026-09-04T09:00:00.000Z",
  });
}

describe("Group 3 craft-order domain — reverseDelivery and delivery consumption note", () => {
  it("reverses a completed delivery: revenue neutralized honestly, history preserved, order in explicit review", () => {
    const delivered = deliveredOrder();
    expect(delivered.recognizedRevenueMinor).toBe(5000);
    const reversed = reverseDelivery(delivered, {
      reason: "سُلّم للزبون الخطأ",
      idempotencyKey: "o-g3:reverse-delivery",
      createdAt: "2026-09-04T10:00:00.000Z",
    });
    expect(reversed).toMatchObject({
      status: "needs_review",
      resultStatus: "review_required",
      recognizedRevenueMinor: 0,
      recognizedCostMinor: 0,
      profitIndicatorMinor: null,
      collectedMinor: 0,
    });
    /* الأصل باقٍ: حدث التسليم لم يُحذف، والعكس موثق بعلاقة صريحة به. */
    const deliveryEvent = reversed.events.find(
      event => event.type === "status_changed" && event.toStatus === "delivered",
    );
    const reversalEvent = reversed.events.find(event => event.type === "delivery_reversed");
    expect(deliveryEvent).toBeTruthy();
    expect(reversalEvent).toMatchObject({ reversesEventId: deliveryEvent!.id, note: "سُلّم للزبون الخطأ" });
  });

  it("is idempotent by key and refuses double reversal of the same delivery", () => {
    const delivered = deliveredOrder();
    const first = reverseDelivery(delivered, {
      reason: "خطأ",
      idempotencyKey: "o-g3:reverse-delivery",
      createdAt: "2026-09-04T10:00:00.000Z",
    });
    /* إعادة نفس المفتاح: لا أثر إضافي. */
    expect(
      reverseDelivery(first, {
        reason: "إعادة محاولة",
        idempotencyKey: "o-g3:reverse-delivery",
        createdAt: "2026-09-04T10:05:00.000Z",
      }),
    ).toBe(first);
    /* مفتاح جديد على التسليم المعكوس نفسه: رفض صريح — حارس الحالة يسبق (الطلب
     * صار «يحتاج مراجعة» فلا يُعكس تسليم ثانٍ منه إلا بعد تسليم جديد). */
    expect(() =>
      reverseDelivery(first, {
        reason: "عكس ثانٍ",
        idempotencyKey: "o-g3:reverse-delivery-2",
        createdAt: "2026-09-04T10:06:00.000Z",
      }),
    ).toThrow("عكس التسليم يتطلب طلبًا مسلّمًا");
  });

  it("unlocks the delivered-review lock exactly for reversed deliveries — re-execution and cancellation work after reversal", () => {
    const reversed = reverseDelivery(deliveredOrder(), {
      reason: "خطأ",
      idempotencyKey: "o-g3:reverse-delivery",
      createdAt: "2026-09-04T10:00:00.000Z",
    });
    /* الخروج من المراجعة مسموح بعد العكس — إعادة تنفيذ موثقة. */
    const reconfirmed = transitionOrder(reversed, {
      to: "confirmed",
      idempotencyKey: "o-g3:reconfirm",
      createdAt: "2026-09-04T10:10:00.000Z",
    });
    expect(reconfirmed.status).toBe("confirmed");
    /* والإلغاء بعد العكس كذلك — قرار صريح لا قفل أبدي. */
    const cancelled = cancelOrder(
      reconfirmed,
      "الزبون ألغى بعد الخطأ",
      "o-g3:cancel",
      "2026-09-04T10:11:00.000Z",
    );
    expect(cancelled.status).toBe("cancelled");
    /* لكن الطلب المسلّم غير المعكوس يبقى مقفولًا في المراجعة. */
    const deliveredNeedsReview = transitionOrder(deliveredOrder(), {
      to: "needs_review",
      idempotencyKey: "e-nr",
      createdAt: "2026-09-04T10:12:00.000Z",
    });
    expect(() =>
      transitionOrder(deliveredNeedsReview, {
        to: "confirmed",
        idempotencyKey: "e-nr-2",
        createdAt: "2026-09-04T10:13:00.000Z",
      }),
    ).toThrow("لا يخرج من «يحتاج مراجعة» إلا بتصحيح موثق صريح");
  });

  it("notes delivery consumption with an explicit link to the delivery event and is idempotent", () => {
    const delivered = deliveredOrder();
    const deliveryEvent = delivered.events.find(
      event => event.type === "status_changed" && event.toStatus === "delivered",
    )!;
    const noted = noteDeliveryConsumption(delivered, {
      note: "مواد مستهلكة عند التسليم: قماش (2 متر)",
      reversesEventId: deliveryEvent.id,
      idempotencyKey: "o-g3:deliver-consumed",
      createdAt: "2026-09-04T09:01:00.000Z",
    });
    const notedEvent = noted.events.find(event => event.type === "delivery_consumed");
    expect(notedEvent).toMatchObject({ reversesEventId: deliveryEvent.id });
    expect(
      noteDeliveryConsumption(noted, {
        note: "تكرار",
        reversesEventId: deliveryEvent.id,
        idempotencyKey: "o-g3:deliver-consumed",
        createdAt: "2026-09-04T09:02:00.000Z",
      }),
    ).toBe(noted);
    /* بلا سبب: رفض. */
    expect(() =>
      noteDeliveryConsumption(delivered, {
        note: "  ",
        reversesEventId: deliveryEvent.id,
        idempotencyKey: "o-g3:deliver-consumed-2",
        createdAt: "2026-09-04T09:03:00.000Z",
      }),
    ).toThrow();
  });

  it("keeps material identity inside the frozen snapshot — later price edits elsewhere never rewrite it", () => {
    const snapshot = baseSnapshot();
    expect(snapshot.input.materialItems[0]).toMatchObject({ materialId: "mat-1", unitPriceMinor: 500 });
    /* تجميد: تعديل خارجي بعد الإنشاء لا يمس النسخة المجمدة. */
    const mutated = JSON.parse(JSON.stringify(snapshot.input)) as {
      materialItems: { unitPriceMinor: number }[];
    };
    mutated.materialItems[0]!.unitPriceMinor = 9999;
    expect(snapshot.input.materialItems[0]!.unitPriceMinor).toBe(500);
    /* تصحيح السعر بعد التسليم يجدد الإيراد المعروف فقط — النسخة باقية. */
    const delivered = deliveredOrder();
    const revised = reviseAgreedPrice(delivered, {
      newPriceMinor: 6000,
      reason: "شغل إضافي",
      idempotencyKey: "o-g3:revise",
      createdAt: "2026-09-04T11:00:00.000Z",
    });
    expect(revised).toMatchObject({
      agreedPriceMinor: 6000,
      recognizedRevenueMinor: 6000,
      recognizedCostMinor: 1000,
    });
    expect(revised.costSnapshot.input.materialItems[0]).toMatchObject({
      materialId: "mat-1",
      unitPriceMinor: 500,
    });
  });
});

describe("Group 3 catalog domain — template component material link and extras", () => {
  it("creates a template with material-linked components and honest optional extras", () => {
    const template = createCatalogTemplate({
      id: "tpl-1",
      catalogItemId: "item-1",
      title: "قالب الفستان",
      note: null,
      components: [
        { id: "c-1", name: "قماش", quantityMilli: 2000, unitId: "u-meter", note: null, materialId: "mat-1" },
        { id: "c-2", name: "خيط", quantityMilli: 100, unitId: "u-piece", note: null, materialId: null },
      ],
      yield: null,
      yieldReadiness: "not_configured",
      extras: {
        timeMinutes: 60,
        hourlyRateMinor: 500,
        packagingMinor: 100,
        deliveryMinor: 0,
        wasteMinor: 50,
        safetyBufferMinor: 200,
      },
      revision: 1,
      sourceTemplateId: null,
      createdAt: "2026-09-04T08:00:00.000Z",
      createdOperationKey: "tpl-op-1",
    });
    expect(template.components[0]).toMatchObject({ materialId: "mat-1" });
    expect(template.components[1]).toMatchObject({ materialId: null });
    expect(template.extras).toMatchObject({ timeMinutes: 60, hourlyRateMinor: 500, wasteMinor: 50 });
  });

  it("rejects negative or fractional extras — no invented numbers, no silent zero", () => {
    expect(() =>
      createCatalogTemplate({
        id: "tpl-2",
        catalogItemId: "item-1",
        title: null,
        note: null,
        components: [],
        yield: null,
        yieldReadiness: "not_configured",
        extras: {
          timeMinutes: -5,
          hourlyRateMinor: null,
          packagingMinor: 0,
          deliveryMinor: 0,
          wasteMinor: 0,
          safetyBufferMinor: 0,
        },
        revision: 1,
        sourceTemplateId: null,
        createdAt: "2026-09-04T08:00:00.000Z",
        createdOperationKey: "tpl-op-2",
      }),
    ).toThrow("دقائق العمل غير صالحة");
  });
});
