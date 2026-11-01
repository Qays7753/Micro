import { describe, expect, it } from "vitest";
import { AgreementService } from "@/application/agreements/agreementService";
import { CostService, type CostEditorInput } from "@/application/cost/costService";
import { DraftService } from "@/application/drafts/draftService";
import { FulfillmentService } from "@/application/fulfillment/fulfillmentService";
import { DeliveryReviewService } from "@/application/fulfillment/deliveryReviewService";
import { CollectionService } from "@/application/collections/collectionService";
import { DirectSaleService } from "@/application/direct-sales/directSaleService";
import { InventoryMaterialService } from "@/application/inventory/inventoryMaterialService";
import { SupplierPurchaseService } from "@/application/suppliers/supplierPurchaseService";
import { ProjectFinancialService } from "@/application/finance/projectFinancialService";
import { ActualTimeService } from "@/application/time/actualTimeService";
import { MemoryLocalStore } from "@/storage/local/MemoryLocalStore";
import {
  calculateCostSnapshot,
  expandGroupedCostBasis,
  orderResultBreakdown,
} from "@micro-domain/craft-order/index.js";

/* S12 (DOC-021 / أمر 2e645802 §7): حالات القبول المشتركة المملوكة هنا —
 * SDF-033/034/035/039/040/052/054/055 — تُشغَّل الآن كأدلة دائمة على رحلات
 * حقيقية عبر الخدمات الحية (لا كعب واجهة)، كل حالة بخريطة ملكيتها:
 * 033 → 027/028/011؛ 034 → 008/009/011؛ 035 → 008/011/028؛ 039 → 026/010؛
 * 040 → 009/011/028؛ 052 → PD-01 عبر 008/009/011/026؛ 054 → PD-02 عبر 010/026؛
 * 055 → PD-02 عبر 011/028/013. */

const NOW = "2026-11-01T09:00:00.000Z";

const costInput: CostEditorInput = {
  materialItems: [{ name: "قماش", quantity: 2, unit: "متر", unitPriceMinor: 500, confidence: "known" }],
  time: { minutes: 60, hourlyRateMinor: 500, confidence: "known" },
  packagingMinor: 0,
  deliveryMinor: 0,
  wasteMinor: 0,
  safetyBufferMinor: 0,
  quantity: 1,
};

/* رحلة كاملة: مسودة → تكلفة (بمادة مرتبطة اختياريًا) → اتفاق (بعربون اختياري)
 * → تنفيذ → جاهز. تُرجع الخدمات الحية فوق المخزن نفسه. */
async function readyOrder(options: {
  agreedPriceMinor?: number;
  depositMinor?: number;
  cost?: (trackedMaterialId: string | null) => CostEditorInput;
  withTrackedMaterial?: boolean;
  deliveryTerms?: Parameters<AgreementService["createFromDraft"]>[1]["deliveryTerms"];
  store?: MemoryLocalStore;
}) {
  const store = options.store ?? new MemoryLocalStore();
  const inventory = new InventoryMaterialService(store, () => NOW);
  let trackedMaterialId: string | null = null;
  if (options.withTrackedMaterial) {
    const opened = await inventory.openMaterial({
      name: "قماش قطنية",
      unit: "meter",
      tracking: "tracked",
      opening: {
        quantityState: "confirmed",
        quantityMilli: 20_000,
        costState: "known",
        valueMinor: 4_000,
        confirmedOn: "2026-10-01",
        sourceNote: "جرد أول المدة",
      },
      note: "مادة رحلة القبول",
      operationKey: "sdf-open-material",
    });
    if (!opened.ok) throw new Error(opened.message);
    trackedMaterialId = opened.value.material.id;
  }
  const drafts = new DraftService(store, () => NOW);
  const created = await drafts.create("customer_order");
  if (!created.ok) throw new Error(created.message);
  const saved = await drafts.save({
    ...created.draft,
    customerName: "سارة",
    itemName: "صندوق هدايا",
    specifications: "تغليف فاخر",
    quantity: 1,
  });
  if (!saved.ok) throw new Error(saved.message);
  const costs = new CostService(store, () => NOW);
  const withCost = await costs.saveSnapshot(
    saved.draft,
    options.cost ? options.cost(trackedMaterialId) : costInput,
  );
  if (!withCost.ok) throw new Error(withCost.message);
  const agreements = new AgreementService(store, costs, () => NOW);
  const agreed = await agreements.createFromDraft(withCost.draft, {
    agreedPriceMinor: options.agreedPriceMinor ?? 5000,
    deliveryDate: "2026-11-20",
    depositMinor: options.depositMinor ?? 0,
    agreementSource: null,
    deliveryTerms: options.deliveryTerms ?? null,
  });
  if (!agreed.ok) throw new Error(agreed.message);
  await agreements.startExecution(agreed.stored.id);
  const fulfillment = new FulfillmentService(store, () => NOW);
  await fulfillment.markReady(agreed.stored.id);
  return { store, orderId: agreed.stored.id, trackedMaterialId };
}

describe("SDF-033 (027/028/011) — شراء متتبع 12 ودفع 4 واستلام لاحق واستهلاك بتكلفة 5", () => {
  it("النقد −4 والالتزام 8؛ الاستلام يزيد الكمية؛ والتكلفة عند الاستعمال 5 لا 12 عند الشراء", async () => {
    const store = new MemoryLocalStore();
    const inventory = new InventoryMaterialService(store, () => NOW);
    const opened = await inventory.openMaterial({
      name: "خشب زان",
      unit: "meter",
      tracking: "tracked",
      opening: {
        quantityState: "confirmed",
        quantityMilli: 0,
        costState: "known",
        valueMinor: 0,
        confirmedOn: "2026-10-01",
        sourceNote: null,
      },
      note: "مادة شراء متتبع",
      operationKey: "sdf033-open",
    });
    if (!opened.ok) throw new Error(opened.message);
    const materialId = opened.value.material.id;

    /* شراء 12.00 ودفع 4.00 — لا مصروف تشغيل من الشراء. */
    const purchases = new SupplierPurchaseService(store, () => NOW);
    const purchase = await purchases.recordPurchase({
      supplierName: "مورد الخشب",
      note: "دفعة خشب",
      purchasedOn: "2026-11-01",
      dueOn: null,
      totalMinor: 1200,
      initialPaidMinor: 400,
      idempotencyKey: "sdf033-purchase",
      materialId,
      expectedQuantityMilli: 12_000,
    });
    if (!purchase.ok) throw new Error(purchase.message);
    expect(purchase.value).toMatchObject({ paidMinor: 400, payableMinor: 800 });

    const finance = new ProjectFinancialService(store, () => NOW);
    await expect(finance.readPosition()).resolves.toMatchObject({
      ok: true,
      value: { recordedCashMinor: -400, supplierPayablesMinor: 800 },
    });

    /* الاستلام اللاحق يزيد الكمية — لا استلام من مجرد الشراء. */
    const movementsBefore = await store.listInventoryMovements();
    expect(movementsBefore.ok && movementsBefore.value).toHaveLength(0);
    const received = await inventory.receivePurchase({
      materialId,
      purchaseId: purchase.value.id,
      quantityMilli: 12_000,
      valueMinor: 1200,
      occurredOn: "2026-11-02",
      note: "استلام الدفعة",
      operationKey: "sdf033-receive",
    });
    if (!received.ok) throw new Error(received.message);
    const overview = await inventory.overview();
    const row = overview.ok ? overview.value.materials.find(item => item.id === materialId) : null;
    expect(row?.quantityMilli).toBe(12_000);

    /* التكلفة عند الاستعمال: طلب يستهلك 5 وحدات عند التسليم — حركتها بقيمة
     * 5.00 (متوسط المركز الحي: 12 وحدة بقيمة 12) لا بشراء 12.00 كاملًا ولا
     * بالقيمة التقديرية. الرحلة فوق المخزن نفسه (مادة واحدة حقيقة). */
    const journey = await readyOrder({
      store,
      cost: () => ({
        materialItems: [
          {
            name: "خشب زان",
            quantity: 5,
            unit: "متر",
            unitPriceMinor: 900,
            confidence: "known",
            materialId,
          },
        ],
        time: null,
        packagingMinor: 0,
        deliveryMinor: 0,
        wasteMinor: 0,
        safetyBufferMinor: 0,
        quantity: 1,
      }),
    });
    const review = new DeliveryReviewService(journey.store, () => NOW);
    const committed = await review.commitDelivery(journey.orderId, {
      rows: [
        {
          materialId,
          quantityMilli: 5_000,
          action: "consume",
        },
      ],
      finalPriceMinor: null,
      priceRevisionReason: null,
      collectNow: null,
      operationKey: "sdf033-deliver",
    });
    if (!committed.ok) throw new Error(committed.message);
    expect(committed.value.movements).toHaveLength(1);
    /* 12.00 د.أ لـ12 وحدة = 1.00 للوحدة؛ خمس وحدات = 5.00 عند الاستعمال. */
    expect(committed.value.movements[0]?.valueDeltaMinor).toBe(-500);
    /* لا مصروف تشغيل من الاستهلاك — تكلفة الطلب تُعرف عند التسليم من مرجعها. */
    await expect(
      new ProjectFinancialService(journey.store, () => NOW).readRecordedPeriodResult(
        "2026-11-01",
        "2026-11-30",
      ),
    ).resolves.toMatchObject({ ok: true, value: { recordedOperatingExpenseMinor: 0 } });
  });
});

describe("SDF-034 (008/009/011) — صندوق بمكونات وتكرار 10 وتوصيل على المشروع 3", () => {
  it("مكونات الوحدة تضرب 10 مرة واحدة، والتوصيل 3 على الطلب مرة؛ لا رسوم زبون", () => {
    /* نواة التكلفة الواحدة: أساس المجموعة يتوسع مرة واحدة — إجمالي10 لكمية3
     * يبقى 10، وتكرار المجموعة يضرب مرة واحدة (عقد §3/5/10). */
    const expanded = expandGroupedCostBasis({
      currency: "JOD",
      groups: [
        {
          id: "box",
          label: "صندوق",
          repeatQuantity: 10,
          unitMaterialItems: [
            {
              name: "خشب",
              quantity: 0.5,
              unit: "متر",
              unitPriceMinor: 400,
              priceDate: "2026-10-01",
              source: "user_input",
              confidence: "known",
            },
          ],
        },
      ],
      time: null,
      packagingMinor: 0,
      /* توصيل على نطاق الطلب مرة واحدة — لا لكل صندوق. */
      deliveryMinor: 300,
      wasteMinor: 0,
      safetyBufferMinor: 0,
      createdAt: NOW,
    });
    /* 0.5 × 400 = 200 للوحدة؛ ×10 تكرارًا = 2000 مرة واحدة، + توصيل 300 مرة. */
    const snapshot = calculateCostSnapshot("sdf034-snapshot", expanded);
    expect(snapshot.materialCostMinor).toBe(2000);
    expect(snapshot.deliveryMinor).toBe(300);
    expect(snapshot.plannedCostMinor).toBe(2300);
    expect(snapshot.quantity).toBe(10);
  });

  it("توصيل المشروع على الطلب: الكلفة 3 تدخل نتيجة الطلب مرة ولا ترفع قيمته القابلة للتحصيل", async () => {
    const { store, orderId } = await readyOrder({
      deliveryTerms: {
        responsibility: "project_pays",
        feeIncludedInPrice: false,
        costIncludedInProductCost: false,
        feeChargedMinor: null,
        costPaidMinor: 300,
        projectShareMinor: null,
        customerShareMinor: null,
      },
    });
    const stored = await store.getOrder(orderId);
    if (!stored.ok || !stored.value) throw new Error("order should exist");
    const breakdown = orderResultBreakdown(stored.value.order);
    /* الكلفة مرة واحدة في النتيجة، والقيمة القابلة للتحصيل هي السعر وحده —
     * لا أجرة زبون ولا نسبة جديدة. */
    expect(breakdown.projectDeliveryCostMinor).toBe(300);
    expect(breakdown.billableDeliveryFeeMinor).toBe(0);
    expect(breakdown.revenueMinor).toBe(stored.value.order.agreedPriceMinor);
    expect(stored.value.order.receivableMinor).toBe(stored.value.order.agreedPriceMinor);
  });
});

describe("SDF-035 (008/011/028) — تقييم فعلي للمواد يختلف عن لقطة التسعير", () => {
  it("يستبدل جزء المواد المطابق فقط؛ الجهد لا يُمحى؛ ولا جمع لقطتي تكلفة", async () => {
    const journey = await readyOrder({
      withTrackedMaterial: true,
      cost: trackedMaterialId => ({
        materialItems: [
          {
            name: "قماش قطنية",
            quantity: 4,
            unit: "متر",
            unitPriceMinor: 250,
            confidence: "known",
            materialId: trackedMaterialId,
          },
        ],
        time: { minutes: 60, hourlyRateMinor: 500, confidence: "known" },
        packagingMinor: 0,
        deliveryMinor: 0,
        wasteMinor: 0,
        safetyBufferMinor: 0,
        quantity: 1,
      }),
    });
    if (!journey.trackedMaterialId) throw new Error("tracked material expected");
    /* اللقطة: مواد مخططة 1000 + جهد 500. الاستهلاك الفعلي عند التسليم 4 وحدات
     * من المركز الحي (20 وحدة بقيمة 20 → 1.00 للوحدة) = 800 فعليًا. */
    const review = new DeliveryReviewService(journey.store, () => NOW);
    const committed = await review.commitDelivery(journey.orderId, {
      rows: [{ materialId: journey.trackedMaterialId, quantityMilli: 4_000, action: "consume" }],
      finalPriceMinor: null,
      priceRevisionReason: null,
      collectNow: null,
      operationKey: "sdf035-deliver",
    });
    if (!committed.ok) throw new Error(committed.message);
    /* (أ) الحركة تحمل التقييم الفعلي 800 — لا التقدير 1000 ولا جمعهما. */
    expect(committed.value.movements[0]?.valueDeltaMinor).toBe(-800);

    /* (ب) قارئ المواد الفعلية يستبدل جزء المواد المطابق فقط: الفعلي 800
     * مقابل المخطط 1000 بفارق −200، والجهد ليس موادًا فلا يُمسح. */
    const inventory = new InventoryMaterialService(journey.store, () => NOW);
    const comparison = await inventory.readOrderActualMaterialComparison(journey.orderId);
    if (!comparison.ok) throw new Error(comparison.message);
    expect(comparison.value.plannedMaterialMinor).toBe(1000);
    expect(comparison.value.actualMaterialMinor).toBe(800);
    expect(comparison.value.varianceMinor).toBe(-200);

    /* (ج) التكلفة المعتمدة للطلب تُعرف عند التسليم من مرجعها مرة واحدة —
     * 1000 مواد مرجعية + 500 جهد = 1500؛ لا 1500+800 (جمع لقطتين) ولا محو
     * الجهد. (حد §B4-011: أي توسيع لدخول الفترة الفعلية يُحسم مع 008/009/010
     * وقرار 503 — ليس إصلاح معاينة؛ الفعلي معلن في قارئه أعلاه.) */
    const stored = await journey.store.getOrder(journey.orderId);
    if (!stored.ok || !stored.value) throw new Error("order should exist");
    expect(stored.value.order.recognizedCostMinor).toBe(1500);
    expect(stored.value.order.costSnapshot.timeCostMinor).toBe(500);
  });
});

describe("SDF-039 (026/010) — نافذتان تحاولان تحصيل المتبقي 10 نفسه", () => {
  it("تفحص الحالة الحية: تنجح واحدة وتُراجع الأخرى — لا حق سالب ولا قبض 20", async () => {
    const { store, orderId } = await readyOrder({ agreedPriceMinor: 10_000 });
    const fulfillment = new FulfillmentService(store, () => NOW);
    await fulfillment.deliver(orderId);

    /* نافذتان متزامنتان بمفتاحين مختلفين على المتبقي 10 نفسه. */
    const projectFinance = new ProjectFinancialService(store, () => NOW);
    const directSales = new DirectSaleService(store, () => NOW);
    const collections = new CollectionService(store, fulfillment, directSales, projectFinance, () => NOW);
    const [first, second] = await Promise.all([
      collections.collect({
        sourceKind: "order",
        sourceId: orderId,
        amountMinor: 10_000,
        walletId: null,
        note: null,
        idempotencyKey: "sdf039-window-a",
      }),
      collections.collect({
        sourceKind: "order",
        sourceId: orderId,
        amountMinor: 10_000,
        walletId: null,
        note: null,
        idempotencyKey: "sdf039-window-b",
      }),
    ]);
    const successes = [first, second].filter(result => result.ok).length;
    expect(successes).toBe(1);
    const stored = await store.getOrder(orderId);
    if (!stored.ok || !stored.value) throw new Error("order should exist");
    /* نجاح واحدة فقط: المقبوض 10 لا 20، والمتبقي 0 لا −10. */
    expect(stored.value.order.collectedMinor).toBe(10_000);
    expect(stored.value.order.receivableMinor).toBe(0);
    const collectionsAfter = stored.value.order.events.filter(event => event.type === "collection_recorded");
    expect(collectionsAfter).toHaveLength(1);

    /* المحاولة اللاحقة على مصدر مكتمل: رفض صادق لا قبض على بديل. */
    const third = await collections.collect({
      sourceKind: "order",
      sourceId: orderId,
      amountMinor: 10_000,
      walletId: null,
      note: null,
      idempotencyKey: "sdf039-window-c",
    });
    expect(third.ok).toBe(false);
  });
});

describe("SDF-040 (009/011/028) — تسليم بمقدم 5 وقبض 10 صريح وفشل الاستهلاك", () => {
  /* S12-ATOMIC-001 (أمر 2158b0fc §5): هذا الفحص يثبت رفض التحقق قبل
   * الكتابة وحده (حد الخدمة) — إثبات التدحرج الكامل عند فشل الحزمة بعد
   * بدئها عند حد الالتزام (خطأ استنساخ حقيقي داخل المعاملة/التسلسل) في
   * `deliveryCommitAtomicity.s12atomic.test.ts` على المهايئين معًا. */
  it("رفض ما قبل الكتابة: كمية فوق المتبقي تُرفض عند حد الخدمة قبل أي كتابة فلا يبقى أثر", async () => {
    const journey = await readyOrder({
      agreedPriceMinor: 15_000,
      depositMinor: 5_000,
      withTrackedMaterial: true,
    });
    if (!journey.trackedMaterialId) throw new Error("tracked material expected");
    const review = new DeliveryReviewService(journey.store, () => NOW);

    /* صف استهلاك يفشل تحققه: كمية تتجاوز المتبقي المؤهل للمادة (المخطط 4
     * أمتار — نطلب 99) — الرفض قبل أي كتابة فلا يبقى أثر البتة. */
    const failed = await review.commitDelivery(journey.orderId, {
      rows: [{ materialId: journey.trackedMaterialId, quantityMilli: 99_000, action: "consume" }],
      finalPriceMinor: null,
      priceRevisionReason: null,
      collectNow: { amountMinor: 10_000, walletId: null },
      operationKey: "sdf040-fail",
    });
    expect(failed.ok).toBe(false);

    const stored = await journey.store.getOrder(journey.orderId);
    if (!stored.ok || !stored.value) throw new Error("order should exist");
    /* لا تسليم ولا إيراد ولا قبض جديد ولا استهلاك — الطلب كما كان: جاهزًا
     * بعربونه 5 ومقبوضه 5 ومتبقيه 10. */
    expect(stored.value.order.status).toBe("ready");
    expect(stored.value.order.recognizedRevenueMinor).toBe(0);
    expect(stored.value.order.collectedMinor).toBe(5_000);
    expect(stored.value.order.receivableMinor).toBe(10_000);
    const movements = await journey.store.listInventoryMovements();
    const orderMovements = movements.ok
      ? movements.value.filter(entry => entry.orderId === journey.orderId)
      : [];
    expect(orderMovements).toHaveLength(0);
    const cashEntries = await journey.store.listCashContinuityEntries();
    const allocations = cashEntries.ok
      ? cashEntries.value.filter(entry => entry.sourceRefId === journey.orderId)
      : [];
    expect(allocations).toHaveLength(0);
  });
});

describe("SDF-052 (PD-01 — 008/009/011/026) — طلب 50 وإضافة 5 وقبض 20", () => {
  it("الإجمالي 55 والمتبقي 35، والإيراد 55 عند التسليم فقط؛ لا خلط بدخل طرف آخر", async () => {
    const { store, orderId } = await readyOrder({ agreedPriceMinor: 50_000, depositMinor: 20_000 });

    /* قبل الإضافة: الإجمالي 50 والمقبوض 20 والمتبقي 30، ولا إيراد معترف به. */
    let stored = await store.getOrder(orderId);
    if (!stored.ok || !stored.value) throw new Error("order should exist");
    expect(stored.value.order.collectedMinor).toBe(20_000);
    expect(stored.value.order.receivableMinor).toBe(30_000);
    expect(stored.value.order.recognizedRevenueMinor).toBe(0);

    /* إضافة PD-01 المعتمدة: جزء من اتفاق العميل — تصحيح موثق للسعر 50→55. */
    const fulfillment = new FulfillmentService(store, () => NOW);
    const revised = await fulfillment.revisePrice(orderId, {
      newPriceMinor: 55_000,
      reason: "إضافة معتمدة وفق PD-01",
    });
    if (!revised.ok) throw new Error(revised.message);
    stored = await store.getOrder(orderId);
    if (!stored.ok || !stored.value) throw new Error("order should exist");
    expect(stored.value.order.agreedPriceMinor).toBe(55_000);
    expect(stored.value.order.receivableMinor).toBe(35_000);
    /* الإضافة اتفاق لا قبض — المقبوض ما زال 20. */
    expect(stored.value.order.collectedMinor).toBe(20_000);
    expect(stored.value.order.recognizedRevenueMinor).toBe(0);

    /* الإيراد 55 يُعرف عند التسليم المؤهل فقط — لا عند الاتفاق ولا عند القبض. */
    await fulfillment.markReady(orderId);
    await fulfillment.deliver(orderId);
    stored = await store.getOrder(orderId);
    if (!stored.ok || !stored.value) throw new Error("order should exist");
    expect(stored.value.order.recognizedRevenueMinor).toBe(55_000);
    expect(stored.value.order.receivableMinor).toBe(35_000);
  });
});

describe("SDF-054 (PD-02 — 010/026) — محاولتا دفع رد 5 من مدخلين", () => {
  it("دفعة رد واحدة ضمن الحق الحي؛ المحاولة الثانية لا تكرر الرد", async () => {
    const { store, orderId } = await readyOrder({ agreedPriceMinor: 5_000, depositMinor: 5_000 });
    const fulfillment = new FulfillmentService(store, () => NOW);
    const cancelled = await fulfillment.cancel(orderId, "انسحب العميل");
    if (!cancelled.ok) throw new Error(cancelled.message);

    /* المدخل الأول: رد كامل العربون 5 — نجاح واحد وإيصال واحد. */
    const first = await fulfillment.refundDeposit(orderId, "رد العربون كاملًا", undefined, "sdf054-refund-a");
    expect(first.ok).toBe(true);

    /* المدخل الثاني: رد 5 ثانية — الحق الحي صار صفرًا فتُرفض بصدق، ولا يتكرر
     * الرد ولا يصبح السالب. */
    const second = await fulfillment.refundDeposit(orderId, "محاولة مدخل ثانٍ", undefined, "sdf054-refund-b");
    expect(second.ok).toBe(false);

    const stored = await store.getOrder(orderId);
    if (!stored.ok || !stored.value) throw new Error("order should exist");
    const refunds = stored.value.order.events.filter(event => event.type === "deposit_refunded");
    expect(refunds).toHaveLength(1);
    /* العربون قائم بعد الرد = صفر، والمقبوض تبعًا لذلك صفر — لا سالب. */
    expect(stored.value.order.depositCollectedMinor).toBe(0);
    expect(stored.value.order.collectedMinor).toBe(0);
  });
});

describe("SDF-055 (PD-02 — 011/028/013) — صندوق مرتجع وله جهد وتوصيل مستهلكان", () => {
  it("لا إعادة مواد أو عكس تكلفة مستهلكة آليًا؛ العودة المؤهلة وحدها تُسترد بتقييم معلوم", async () => {
    const journey = await readyOrder({
      agreedPriceMinor: 6_000,
      withTrackedMaterial: true,
      cost: trackedMaterialId => ({
        materialItems: [
          {
            name: "قماش قطنية",
            quantity: 4,
            unit: "متر",
            unitPriceMinor: 250,
            confidence: "known",
            materialId: trackedMaterialId,
          },
        ],
        time: { minutes: 60, hourlyRateMinor: 500, confidence: "known" },
        packagingMinor: 0,
        deliveryMinor: 0,
        wasteMinor: 0,
        safetyBufferMinor: 0,
        quantity: 1,
      }),
      deliveryTerms: {
        responsibility: "project_pays",
        feeIncludedInPrice: false,
        costIncludedInProductCost: false,
        feeChargedMinor: null,
        costPaidMinor: 300,
        projectShareMinor: null,
        customerShareMinor: null,
      },
    });
    if (!journey.trackedMaterialId) throw new Error("tracked material expected");

    /* جهد فعلي موثق على الطلب قبل التسليم. */
    const time = new ActualTimeService(journey.store, () => NOW);
    const recorded = await time.record({
      orderId: journey.orderId,
      minutes: 90,
      recordedOn: "2026-11-05",
      note: "تطريز يدوي",
      operationKey: "sdf055-time",
    });
    if (!recorded.ok) throw new Error(recorded.message);

    const review = new DeliveryReviewService(journey.store, () => NOW);
    const committed = await review.commitDelivery(journey.orderId, {
      rows: [{ materialId: journey.trackedMaterialId, quantityMilli: 4_000, action: "consume" }],
      finalPriceMinor: null,
      priceRevisionReason: null,
      collectNow: null,
      operationKey: "sdf055-deliver",
    });
    if (!committed.ok) throw new Error(committed.message);

    /* التسليم لا يعيد المواد آليًا: الاستهلاك قائم والكمية نقصت. */
    let movements = await journey.store.listInventoryMovements();
    const consumption = movements.ok
      ? movements.value.filter(entry => entry.orderId === journey.orderId && entry.type === "consumption")
      : [];
    expect(consumption).toHaveLength(1);

    /* لا مسار مرتجع تجاري آلي: إلغاء طلب مسلّم مرفوض — مرتجع PD-02 الكامل
     * المؤهل مواصفته غير جاهزة (CONS-DEC08: اعتماد نطاق لا جاهزية مواصفة)
     * ولا يُخترع هنا. الباب الموثق الوحيد بعد التسليم: عكس التسليم تصحيحًا. */
    const fulfillment = new FulfillmentService(journey.store, () => NOW);
    const cancelRefused = await fulfillment.cancel(journey.orderId, "محاولة إلغاء بعد التسليم");
    expect(cancelRefused.ok).toBe(false);

    /* عكس التسليم (التصحيح الموثق): يحاكي حركاته هو حصرًا — الجهد الفعلي
     * الموثق لا يُمس، ولا حركة كاش جديدة تُخلق، ولا تكلفة مستهلكة تُعكس
     * خارج حدوده. */
    const reversed = await review.reverseDelivery(journey.orderId, {
      reason: "أُدخل التسليم على الطلب الخطأ",
      operationKey: "sdf055-reverse",
    });
    if (!reversed.ok) throw new Error(reversed.message);
    movements = await journey.store.listInventoryMovements();
    const reversals = movements.ok ? movements.value.filter(entry => entry.type === "reversal") : [];
    expect(reversals).toHaveLength(1);
    expect(reversals[0]?.reversesMovementId).toBe(consumption[0]?.id);
    const timesAfter = (await journey.store.listActualTimeRecords)
      ? await journey.store.listActualTimeRecords()
      : { ok: true, value: [] as readonly unknown[] };
    const timeRecords = timesAfter.ok ? timesAfter.value : [];
    expect(Array.isArray(timeRecords) && timeRecords.length).toBe(1);
    const cashEntries = await journey.store.listCashContinuityEntries();
    const orderCash = cashEntries.ok
      ? cashEntries.value.filter(entry => entry.sourceRefId === journey.orderId)
      : [];
    expect(orderCash).toHaveLength(0);
  });
});
