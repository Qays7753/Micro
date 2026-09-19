import { describe, expect, it } from "vitest";
import { AgreementContextService } from "@/application/agreements/agreementContextService";
import { AgreementService } from "@/application/agreements/agreementService";
import { FulfillmentService } from "@/application/fulfillment/fulfillmentService";
import { MemoryLocalStore } from "@/storage/local/MemoryLocalStore";
import type { StoredCraftOrder } from "@/storage/local/types";
import { calculateCostSnapshot, createCraftOrder } from "@micro-domain/craft-order/index.js";

/* G-003 (تدقيق الإدارة المالية المتدرجة 2026-09-19): عقد الأكواد المطبوعة
 * لمسارات كتابة الطلب — تعارض القراءة-التعديل-الكتابة بين مسارين يظهر
 * «storage_stale» عبر طبقة التطبيق (لا يُطوى في storage_error ولا يُستنتج من
 * نص عربي)، ولا يُكتب شيء فوق الفائز، وإعادة تشغيل العملية نفسها بمفتاحها
 * إعادة استخدام صادقة — رحلة §31: أعد الفتح ثم أعد المحاولة بقرار واعٍ. */

const now = () => "2026-09-08T09:00:00.000Z";

async function saveOrder(store: MemoryLocalStore, id: string, deliveryDate: string) {
  const cost = calculateCostSnapshot(`${id}-cost`, {
    currency: "JOD",
    materialItems: [],
    time: { minutes: 60, hourlyRateMinor: 500, confidence: "known" },
    packagingMinor: 0,
    deliveryMinor: 0,
    wasteMinor: 0,
    safetyBufferMinor: 0,
    quantity: 1,
    createdAt: "2026-08-22T00:00:00.000Z",
    freshnessDays: null,
  });
  const order = createCraftOrder({
    id,
    customerName: "سارة",
    itemName: `طلب ${id}`,
    specifications: "اختبار",
    quantity: 1,
    agreedPriceMinor: 2000,
    costSnapshot: cost,
    createdAt: "2026-08-22T00:00:00.000Z",
  });
  const stored: StoredCraftOrder = {
    id,
    order: { ...order, status: "in_progress", nextAction: "أكمل التنفيذ" },
    deliveryDate,
    agreementSource: null,
    createdAt: "2026-08-22T00:00:00.000Z",
    updatedAt: "2026-08-22T00:00:00.000Z",
  };
  await store.saveOrder(stored);
  return stored;
}

async function saveProvisionalOrder(store: MemoryLocalStore, id: string) {
  const cost = calculateCostSnapshot(`${id}-cost`, {
    currency: "JOD",
    materialItems: [],
    time: { minutes: 60, hourlyRateMinor: 500, confidence: "known" },
    packagingMinor: 0,
    deliveryMinor: 0,
    wasteMinor: 0,
    safetyBufferMinor: 0,
    quantity: 1,
    createdAt: "2026-08-22T00:00:00.000Z",
    freshnessDays: null,
  });
  const order = createCraftOrder({
    id,
    customerName: "سارة",
    itemName: `طلب ${id}`,
    specifications: "اختبار",
    quantity: 1,
    agreedPriceMinor: 2000,
    costSnapshot: cost,
    createdAt: "2026-08-22T00:00:00.000Z",
  });
  const stored: StoredCraftOrder = {
    id,
    order: { ...order, status: "provisional_agreement", nextAction: "أكمل تأكيد الاتفاق" },
    deliveryDate: "2026-09-10",
    agreementSource: null,
    createdAt: "2026-08-22T00:00:00.000Z",
    updatedAt: "2026-08-22T00:00:00.000Z",
  };
  await store.saveOrder(stored);
  return stored;
}

const termsInput = (operationKey: string) =>
  ({
    responsibility: "customer_pays_project",
    feeIncludedInPrice: true,
    costIncludedInProductCost: false,
    feeChargedMinor: 300,
    costPaidMinor: null,
    projectShareMinor: null,
    customerShareMinor: null,
    operationKey,
  }) as const;

/* محوّل يفشل فشلًا تخزينيًا حقيقيًا عند الالتزام — يميّز الاختبار بين
 * storage_error الحقيقي وstorage_stale التعارضي. */
class GenuineFailureStore extends MemoryLocalStore {
  public failedCommit = false;
  override async commitOrderUpdate(
    base: StoredCraftOrder,
    next: StoredCraftOrder,
    idempotencyKeys: readonly string[],
  ) {
    this.failedCommit = true;
    void base;
    void idempotencyKeys;
    return {
      ok: false as const,
      code: "storage_error" as const,
      message: "فشل تخزيني حقيقي مفبرك للاختبار.",
      value: undefined as never,
    };
  }
}

describe("G-003 — order write stale conflicts surface typed storage_stale", () => {
  it("two contexts on the same order: the stale second write is rejected and the winner preserved", async () => {
    const store = new MemoryLocalStore();
    const orderId = "order-stale-1";
    await saveOrder(store, orderId, "2026-09-10");
    const fulfillment = new FulfillmentService(store, now);
    /* مساران متزامنان على القاعدة نفسها: جاهزية (فائز) وشروط نقل بُنيت على
     * قراءة قبل كتابة الفائز (متقادمة) — الثانية تُرفض بلا كتابة. */
    const [ready, terms] = await Promise.all([
      fulfillment.markReady(orderId),
      fulfillment.applyDeliveryTerms(orderId, termsInput("stale-terms-key"), "stale-terms-key"),
    ]);
    expect(ready.ok).toBe(true);
    if (!terms.ok) {
      expect(terms.code).toBe("storage_stale");
    } else {
      throw new Error("the stale second write should not succeed");
    }
    /* الفائز محفوظ: جاهزية بلا حدث شروط نقل، وupdatedAt للفائز. */
    const live = await store.getOrder(orderId);
    if (!live.ok || !live.value) throw new Error("order should read");
    expect(live.value.order.status).toBe("ready");
    expect(live.value.order.events.some(event => event.type === "delivery_terms_recorded")).toBe(false);
  });

  it("retrying the same operation with the same key is an honest reuse, not a conflict", async () => {
    const store = new MemoryLocalStore();
    const orderId = "order-reuse-1";
    await saveOrder(store, orderId, "2026-09-10");
    const fulfillment = new FulfillmentService(store, now);
    const first = await fulfillment.applyDeliveryTerms(orderId, termsInput("reuse-key"), "reuse-key");
    expect(first.ok).toBe(true);
    const second = await fulfillment.applyDeliveryTerms(orderId, termsInput("reuse-key"), "reuse-key");
    expect(second).toMatchObject({ ok: true });
    if (second.ok) expect(second.reused).toBe(true);
    const live = await store.getOrder(orderId);
    if (!live.ok || !live.value) throw new Error("order should read");
    const termsEvents = live.value.order.events.filter(event => event.type === "delivery_terms_recorded");
    expect(termsEvents).toHaveLength(1);
  });

  it("a conscious re-save after re-reading succeeds (the §31 recovery journey)", async () => {
    const store = new MemoryLocalStore();
    const orderId = "order-recovery-1";
    await saveOrder(store, orderId, "2026-09-10");
    const fulfillment = new FulfillmentService(store, now);
    const first = await fulfillment.applyDeliveryTerms(orderId, termsInput("recovery-key"), "recovery-key");
    expect(first.ok).toBe(true);
    /* إعادة المحاولة بمفتاح جديد بعد إعادة القراءة: تعديل موثق جديد ينجح —
     * الحارس يرفض القديم المتقادم لا الواعي الجديد. */
    const retried = await fulfillment.applyDeliveryTerms(
      orderId,
      termsInput("recovery-key-2"),
      "recovery-key-2",
    );
    expect(retried.ok).toBe(true);
    const live = await store.getOrder(orderId);
    if (!live.ok || !live.value) throw new Error("order should read");
    expect(live.value.order.events.filter(event => event.type === "delivery_terms_recorded")).toHaveLength(2);
  });

  it("independent orders never conflict with each other", async () => {
    const store = new MemoryLocalStore();
    await saveOrder(store, "order-ind-1", "2026-09-10");
    await saveOrder(store, "order-ind-2", "2026-09-11");
    const fulfillment = new FulfillmentService(store, now);
    const [one, two] = await Promise.all([
      fulfillment.applyDeliveryTerms("order-ind-1", termsInput("ind-key-1"), "ind-key-1"),
      fulfillment.applyDeliveryTerms("order-ind-2", termsInput("ind-key-2"), "ind-key-2"),
    ]);
    expect(one.ok).toBe(true);
    expect(two.ok).toBe(true);
  });

  it("agreement startExecution surfaces typed storage_stale on a concurrent change", async () => {
    const store = new MemoryLocalStore();
    const orderId = "order-agreement-1";
    await saveProvisionalOrder(store, orderId);
    const agreements = new AgreementService(store, null as never, now);
    const context = new AgreementContextService(store, now);
    /* مسار الحدث (بدء التنفيذ) ومسار سياق الاتفاق (غلاف فقط) على القاعدة
     * نفسها — الثاني المتقادم يُرفض بـstorage_stale بلا كتابة. */
    const [started, savedContext] = await Promise.all([
      agreements.startExecution(orderId),
      context.save(orderId, {
        agreementSource: "instagram",
        followUpSummary: "اتفاق عبر إنستغرام",
        followUpDate: null,
        followUpReason: null,
      }),
    ]);
    expect(started.ok).toBe(true);
    if (!savedContext.ok) {
      expect(savedContext.code).toBe("storage_stale");
    } else {
      throw new Error("the stale context write should not succeed");
    }
    const live = await store.getOrder(orderId);
    if (!live.ok || !live.value) throw new Error("order should read");
    expect(live.value.order.status).toBe("in_progress");
    expect(live.value.agreementSource).toBe(null);
  });

  it("delivery commit rejects a concurrent collection between the service read and the commit", async () => {
    const store = new MemoryLocalStore();
    const orderId = "order-delivery-1";
    const ready = await saveOrder(store, orderId, "2026-09-10");
    /* تحويل محلي إلى جاهز عبر الخدمة نفسها (كتابة محروسة تمر بالقاعدة). */
    const fulfillment = new FulfillmentService(store, now);
    const marked = await fulfillment.markReady(orderId);
    expect(marked.ok).toBe(true);
    /* القاعدة كما قرأتها خدمة التسليم. */
    const base = (await store.getOrder(orderId)).value!;
    /* مسار متزامن يكتب عربونًا بين قراءة الخدمة والالتزام. */
    const deposit = await fulfillment.collectDeposit(orderId, {
      amountMinor: 500,
      operationKey: "delivery-race-deposit",
    });
    expect(deposit.ok).toBe(true);
    /* حمولة تسليم مبنية على القاعدة المتقادمة — تُرفض بلا كتابة. */
    const delivered: StoredCraftOrder = {
      ...base,
      order: { ...base.order, status: "delivered" },
      updatedAt: "2026-09-08T09:05:00.000Z",
    };
    const committed = await store.commitOrderDelivery(base, delivered, [], [], null, null);
    expect(committed).toMatchObject({ ok: false, code: "storage_stale" });
    /* الفائز محفوظ: العربون موجود والطلب ما زال جاهزًا — لا طمر تحصيل. */
    const live = await store.getOrder(orderId);
    if (!live.ok || !live.value) throw new Error("order should read");
    expect(live.value.order.status).toBe("ready");
    expect(live.value.order.depositCollectedMinor).toBe(500);
    void ready;
  });

  it("old-data compatibility: absent optional fields still match null and real conflicts still reject", async () => {
    const store = new MemoryLocalStore();
    const orderId = "order-olddata-1";
    await saveOrder(store, orderId, "2026-09-10");
    /* سجل قديم بلا الحقول الاختيارية إطلاقًا (null ≡ undefined في الحارس). */
    const legacy = (await store.getOrder(orderId)).value!;
    const legacyLive: StoredCraftOrder = {
      ...legacy,
      retainedMeaning: undefined,
      orderName: undefined,
    };
    delete (legacyLive as Record<string, unknown>).retainedMeaning;
    delete (legacyLive as Record<string, unknown>).orderName;
    await store.saveOrder(legacyLive);
    const base = (await store.getOrder(orderId)).value!;
    const baseWithNulls: StoredCraftOrder = {
      ...base,
      retainedMeaning: null,
      orderName: null,
    };
    const fulfillment = new FulfillmentService(store, now);
    /* الكتابة الواعية فوق البيانات القديمة تنجح — null/undefined متكافئان. */
    const written = await store.commitOrderUpdate(
      baseWithNulls,
      {
        ...baseWithNulls,
        order: {
          ...baseWithNulls.order,
          status: "ready",
          events: [
            ...baseWithNulls.order.events,
            {
              id: `${orderId}:status-ready-legacy`,
              type: "status_changed",
              idempotencyKey: `legacy-ready`,
              createdAt: "2026-09-08T09:00:00.000Z",
              fromStatus: "in_progress",
              toStatus: "ready",
            },
          ],
        },
        updatedAt: "2026-09-08T09:01:00.000Z",
      },
      ["legacy-ready"],
    );
    expect(written).toMatchObject({ ok: true });
    void fulfillment;
    /* والتعارض الحقيقي يبقى رفضًا: قاعدة قديمة بعد كتابة حية. */
    const raced = await store.commitOrderUpdate(
      baseWithNulls,
      {
        ...baseWithNulls,
        order: { ...baseWithNulls.order },
        updatedAt: "2026-09-08T09:02:00.000Z",
      },
      [],
    );
    expect(raced).toMatchObject({ ok: false, code: "storage_stale" });
  });

  it("genuine storage failure stays storage_error (not folded into storage_stale)", async () => {
    const store = new GenuineFailureStore();
    const orderId = "order-genuine-1";
    await saveOrder(store, orderId, "2026-09-10");
    const fulfillment = new FulfillmentService(store, now);
    const result = await fulfillment.applyDeliveryTerms(orderId, termsInput("genuine-key"), "genuine-key");
    expect(result).toMatchObject({ ok: false, code: "storage_error" });
    expect(store.failedCommit).toBe(true);
  });

  it("export/restore round-trip: post-restore writes pass the guard on the restored record", async () => {
    const store = new MemoryLocalStore();
    const orderId = "order-restore-1";
    await saveOrder(store, orderId, "2026-09-10");
    const snapshot = await store.readSnapshot();
    if (!snapshot.ok) throw new Error(snapshot.message);
    /* استعادة كاملة فوق المتجر نفسه (replaceSnapshot — مسار الاستيراد). */
    const restored = await store.replaceSnapshot(snapshot.value);
    if (!restored.ok) throw new Error(restored.message);
    const fulfillment = new FulfillmentService(store, now);
    const written = await fulfillment.applyDeliveryTerms(
      orderId,
      termsInput("post-restore-key"),
      "post-restore-key",
    );
    expect(written.ok).toBe(true);
    const live = await store.getOrder(orderId);
    if (!live.ok || !live.value) throw new Error("order should read");
    expect(live.value.order.events.some(event => event.type === "delivery_terms_recorded")).toBe(true);
  });
});
