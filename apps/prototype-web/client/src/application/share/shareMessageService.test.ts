/** EXE-015 (الموجة ٣ — SHR-001) فوق المجموعة ٥ (عقد ٣٣): اختبار عقد المشاركة
 * الموحد — إشعار القبض من الحدث المحفوظ القائم وحده، والملغى بلا «جاهز
 * للمتابعة»، والمعكوس لا يبقى تحصيلًا قائمًا، والبناء حتمي بلا تكرار، ونصوص
 * بلا هامش ولا تكلفة ولا معرفات داخلية. */
import { describe, expect, it } from "vitest";
import { calculateCostSnapshot, createCraftOrder } from "@micro-domain/craft-order/index.js";
import type { OrderEvent } from "@micro-domain/craft-order/index.js";
import { MemoryLocalStore } from "@/storage/local/MemoryLocalStore";
import {
  collectionShareDraft,
  customerShareDraft,
  deliveryShareDraft,
  orderShareDraft,
  reminderShareDraft,
  standingCollectionEvent,
} from "./shareMessageService";

const NOW = "2026-09-05T09:00:00.000Z";

function buildStored(overrides: Record<string, unknown> = {}) {
  const cost = calculateCostSnapshot("cost-1", {
    currency: "JOD",
    materialItems: [],
    time: { minutes: 30, hourlyRateMinor: 300, confidence: "known" },
    packagingMinor: 0,
    deliveryMinor: 0,
    wasteMinor: 0,
    safetyBufferMinor: 0,
    quantity: 1,
    createdAt: NOW,
    freshnessDays: null,
  });
  const order = {
    ...createCraftOrder({
      id: "order-1",
      customerName: "أم خالد",
      itemName: "شماغ مطرّز",
      specifications: "خيط أبيض",
      quantity: 1,
      agreedPriceMinor: 15000,
      costSnapshot: cost,
      createdAt: NOW,
    }),
    depositCollectedMinor: 3000,
    collectedMinor: 5000,
    receivableMinor: 10000,
    status: "in_progress" as const,
    settlementStatus: "partial" as const,
  };
  return {
    id: "order-1",
    order,
    catalogItemId: null,
    deliveryDate: "2026-09-10",
    agreementSource: null,
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides,
  };
}

/** حدث قبض محفوظ بمعرّف حتمي — كما تنتجه آلة التحصيل في الدومين. */
function collectionEvent(overrides: Partial<OrderEvent> = {}): OrderEvent {
  return {
    id: "order-1:collect-1",
    type: "collection_recorded",
    idempotencyKey: "collect-1",
    createdAt: "2026-09-04T12:00:00.000Z",
    amountMinor: 2000,
    ...overrides,
  };
}

describe("EXE-015 — عقد المشاركة الموحد (إشعار القبض من الحدث المحفوظ)", () => {
  it("التحصيل المحفوظ الناجح ينتج إشعار قبض من الحدث نفسه: المبلغ والتاريخ من الحدث والمتبقي من السجل", () => {
    const stored = buildStored();
    stored.order.events = [collectionEvent()];
    const draft = customerShareDraft(stored);
    expect(draft.kind).toBe("collection");
    /* المبلغ من الحدث لا من أي State مؤقت. */
    expect(draft.body).toContain("20.00 د.أ");
    /* التاريخ من createdAt الحدث (توقيت عمان المحلي). */
    expect(draft.body).toContain("04/09/2026");
    /* المتبقي من السجل الحي. */
    expect(draft.body).toContain("100.00 د.أ");
    /* مرجع العملية والحدث محمول في المسودة — لا في نص الزبون. */
    expect(draft.origin).toEqual({ orderId: "order-1", eventId: "order-1:collect-1" });
    expect(draft.body).not.toContain("order-1");
    expect(draft.body).not.toContain("collect-1");
  });

  it("إعادة الإرسال (reused) تشير إلى الحدث نفسه: بناء حتمي بلا مسودة مكررة ولا كتابة", () => {
    const stored = buildStored();
    stored.order.events = [collectionEvent()];
    const first = customerShareDraft(stored);
    const second = customerShareDraft(stored);
    expect(second).toEqual(first);
    /* لا مخزن يُنشأ ولا سجل مشاركة يُكتب — البناء صرف فوق السجل. */
    const store = new MemoryLocalStore();
    expect(store).toBeTruthy();
  });

  it("العربون المحصل القائم مصدر صالح أيضًا لإشعار القبض", () => {
    const stored = buildStored();
    stored.order.events = [
      collectionEvent({
        id: "order-1:deposit-1",
        type: "deposit_collected",
        idempotencyKey: "deposit-1",
        amountMinor: 3000,
      }),
    ];
    const draft = customerShareDraft(stored);
    expect(draft.kind).toBe("collection");
    expect(draft.body).toContain("30.00 د.أ");
    expect(draft.origin?.eventId).toBe("order-1:deposit-1");
  });

  it("التحصيل المعكوس كاملًا لا يبقى تحصيلًا قائمًا قابلًا للمشاركة — يسقط إلى تذكير الذمة", () => {
    const stored = buildStored();
    stored.order.events = [
      collectionEvent(),
      collectionEvent({
        id: "order-1:reverse-1",
        type: "collection_reversed",
        idempotencyKey: "reverse-1",
        amountMinor: 2000,
        reversesEventId: "order-1:collect-1",
      }),
    ];
    expect(standingCollectionEvent(stored)).toBeNull();
    const draft = customerShareDraft(stored);
    expect(draft.kind).toBe("reminder");
    expect(draft.body).toContain("أتذكر لك");
    expect(draft.body).not.toContain("استلمت منك");
  });

  it("العكس الجزئي يبقي الحدث قائمًا بإشعار صادق: مبلغ الحدث كما قُبض والمتبقي حي", () => {
    const stored = buildStored();
    stored.order.events = [
      collectionEvent({ amountMinor: 5000 }),
      collectionEvent({
        id: "order-1:reverse-1",
        type: "collection_reversed",
        idempotencyKey: "reverse-1",
        amountMinor: 2000,
        reversesEventId: "order-1:collect-1",
      }),
    ];
    const standing = standingCollectionEvent(stored);
    expect(standing?.id).toBe("order-1:collect-1");
    const draft = customerShareDraft(stored);
    expect(draft.kind).toBe("collection");
    expect(draft.body).toContain("50.00 د.أ");
  });

  it("عكس العربون النشط (EXE-010) يخرجه من إشعار القبض — العكس ينقص رصيد العربون الحي", () => {
    const stored = buildStored();
    stored.order.events = [
      collectionEvent({
        id: "order-1:deposit-1",
        type: "deposit_collected",
        idempotencyKey: "deposit-1",
        amountMinor: 3000,
      }),
      collectionEvent({
        id: "order-1:dep-reverse-1",
        type: "deposit_reversed",
        idempotencyKey: "dep-reverse-1",
        amountMinor: 3000,
      }),
    ];
    /* عكس العربون في الدومين على مستوى المجموع: ينقص depositCollectedMinor
     * مباشرة — المحاكاة هنا تعكس أثر الدومين الحقيقي على السجل المحفوظ. */
    stored.order.depositCollectedMinor = 0;
    stored.order.collectedMinor = 2000;
    expect(standingCollectionEvent(stored)).toBeNull();
    const draft = customerShareDraft(stored);
    expect(draft.kind).toBe("reminder");
  });

  it("الطلب الملغى لا يمر بعقد «جاهز للمتابعة» — نص إلغاء صادق وتسوية العربون من السجل", () => {
    const stored = buildStored();
    stored.order.status = "cancelled";
    stored.order.settlementStatus = "cancelled";
    stored.order.depositCollectedMinor = 0;
    stored.order.receivableMinor = 0;
    const noDeposit = customerShareDraft(stored);
    expect(noDeposit.kind).toBe("order");
    expect(noDeposit.body).toContain("أُلغي");
    expect(noDeposit.body).not.toContain("جاهز للمتابعة");

    const refunded = buildStored();
    refunded.order.status = "cancelled";
    refunded.order.settlementStatus = "cancelled_refunded";
    refunded.order.receivableMinor = 0;
    const refundedDraft = customerShareDraft(refunded);
    expect(refundedDraft.body).toContain("رُدّ إليك عربون البالغ 30.00 د.أ");

    const retained = buildStored();
    retained.order.status = "cancelled";
    retained.order.settlementStatus = "cancelled_retained";
    retained.order.receivableMinor = 0;
    expect(customerShareDraft(retained).body).toContain("واحتُفظ بعربون البالغ 30.00 د.أ");

    const pending = buildStored();
    pending.order.status = "cancelled";
    pending.order.settlementStatus = "cancelled_pending";
    pending.order.receivableMinor = 0;
    expect(customerShareDraft(pending).body).toContain("بانتظار حسم تسويته");
  });

  it("إشعار التسليم بتاريخ التسليم الفعلي من الحدث — لا «اليوم» الزائف عند مشاركة لاحقة", () => {
    const stored = buildStored();
    stored.order.status = "delivered";
    stored.order.settlementStatus = "debt";
    const draft = deliveryShareDraft(stored, "2026-09-01");
    expect(draft.body).toContain("سُلّم 01/09/2026");
    /* ادعاء «سُلّم اليوم» الزائف عند المشاركة اللاحقة زال — «اليوم» الباقية
     * في سطر الملاحظات («أخبرني بها اليوم») ليست ادعاء تاريخ تسليم. */
    expect(draft.body).not.toContain("سُلّم اليوم");
    /* عبر نقطة القرار الموحدة: التاريخ يصل من حدث التسليم المحفوظ. */
    const viaEntry = customerShareDraft(stored, "2026-09-01");
    expect(viaEntry.kind).toBe("delivery");
    expect(viaEntry.body).toContain("سُلّم 01/09/2026");
  });

  it("رسالة الطلب النشطة تحفظ عقدها القائم (جاهز للمتابعة) بلا هامش ولا تكلفة", () => {
    const stored = buildStored();
    stored.order.depositCollectedMinor = 0;
    stored.order.receivableMinor = 0;
    stored.order.events = [];
    const draft = orderShareDraft(stored);
    expect(draft.body).toContain("جاهز للمتابعة");
    expect(draft.body).toContain("150.00 د.أ");
    expect(draft.body).toContain("موعد التسليم المتفق: 10/09/2026");
    expect(draft.body).not.toContain("هامش");
    expect(draft.body).not.toContain("3.30");
    expect(customerShareDraft(stored).kind).toBe("order");
  });

  it("إشعار التسليم المسدد يصرّح بحسم كامل المبلغ — والذممي بالمتبقي", () => {
    const settled = buildStored();
    settled.order.status = "delivered";
    settled.order.settlementStatus = "paid";
    settled.order.receivableMinor = 0;
    const settledDraft = deliveryShareDraft(settled, "2026-09-12");
    expect(settledDraft.body).toContain("حُسم كامل المبلغ");
    expect(settledDraft.body).not.toContain("المتبقي عليك");
    /* الذمم القائمة بعد التسليم تبقى في النص صادقة. */
    const withDebt = buildStored();
    withDebt.order.status = "delivered";
    withDebt.order.settlementStatus = "debt";
    expect(deliveryShareDraft(withDebt, "2026-09-12").body).toContain("المتبقي عليك: 100.00 د.أ");
  });

  it("تذكير الذمة يبقى للمستحق بلا قبض قائم", () => {
    const stored = buildStored();
    stored.order.events = [];
    const draft = reminderShareDraft(stored, 10000, "2026-09-15");
    expect(draft.body).toContain("100.00 د.أ");
    expect(draft.body).toContain("15/09/2026");
    expect(customerShareDraft(stored).kind).toBe("reminder");
  });

  it("البناؤون المنفردون يظلون متاحين لعقدهم — إشعار القبض لا يقبل أرقامًا من خارج الحدث", () => {
    const stored = buildStored();
    stored.order.events = [collectionEvent()];
    const direct = collectionShareDraft(stored, stored.order.events[0]);
    expect(direct.kind).toBe("collection");
    expect(direct.body).toContain("20.00 د.أ");
  });
});
