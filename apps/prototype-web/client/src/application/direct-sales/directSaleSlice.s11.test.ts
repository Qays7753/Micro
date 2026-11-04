/**
 * S11 (UNIT-004/005/026 sale-slice + SH-15 — أمر b33a8877 §6/§7): الإثبات
 * الدائم لأمثلة الأمر المالية الخمسة على المسار التطبيقي الحقيقي عبر
 * مالك المصدر (DirectSaleService) والمنسق (CollectionService) على
 * المهايئين معًا (الذاكرة وIndexedDB/fake-indexeddb) — مع قراءة المالية
 * الحقيقية (readPosition) لكل خطوة:
 *  1) بيع 15 قبض 5 تكلفة 6 => نقد 5 وإيراد 15 ومساهمة 9 وحق 10؛ تحصيل
 *     المتبقي 10 => نقد 10 وحق 0 ولا إيراد/مساهمة جديدة.
 *  2) محاولتا قبض متزامنتان للمتبقي نفسه => نجاح واحدة وتعارض الأخرى بلا
 *     حق سالب ولا قبض مزدوج (SDF-039).
 *  3) مرتجع كامل بعد قبض 5 وبقاء 10 => إلغاء الحق 10 وحق رد 5 فقط؛ النقد
 *     لا يتغير قبل دفع رد فعلي، والدفع اللاحق مؤرخ لا يُدفع مرتين
 *     (SDF-053/054).
 *  4) شهر البيع وشهر القبض منفصلان (SDF-012) والإجمالي المجمل القديم لا
 *     تؤلف تواريخه (SDF-014).
 *  5) التكلفة المجهولة ≠ الصفر (SDF-005) والأسماء المتشابهة هويات مستقلة
 *     (SDF-009) ولا فعل اختياري يكتب مالًا ثانيًا.
 * ودورة النقل الكاملة للحقول الجديدة على زوجي الاقتران المتقاطع.
 */
import "fake-indexeddb/auto";
import { createHash } from "node:crypto";
import { afterEach, describe, expect, it } from "vitest";
import { DirectSaleService } from "@/application/direct-sales/directSaleService";
import { DirectSaleMovementsService } from "@/application/direct-sales/directSaleMovements";
import { CollectionService } from "@/application/collections/collectionService";
import { FulfillmentService } from "@/application/fulfillment/fulfillmentService";
import { ProjectFinancialService } from "@/application/finance/projectFinancialService";
import { LocalTransferService } from "@/application/transfers/localTransferService";
import { MemoryLocalStore } from "@/storage/local/MemoryLocalStore";
import { IndexedDbLocalStore } from "@/storage/local/IndexedDbLocalStore";
import type { ProjectFinancialServiceStore } from "@/application/finance/projectFinancialService";
import type { FulfillmentServiceStore } from "@/application/fulfillment/fulfillmentService";
import type { CollectionServiceStore } from "@/application/collections/collectionService";
import { createCashContinuityEntry, createCashWallet } from "@micro-domain/cash-continuity/index.js";
import { directSaleOutstandingMinor } from "@micro-domain/direct-sale/index.js";
import type { DirectSaleServiceStore } from "@/application/direct-sales/directSaleService";
import { okValue } from "@/testing/resultAssertions";

const NOW = "2026-10-01T09:00:00.000Z";
const now = () => NOW;

const databaseName = "micro-prototype-local";
function clearDatabase() {
  return new Promise<void>((resolve, reject) => {
    const request = indexedDB.deleteDatabase(databaseName);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

type AnyStore = SaleSliceTestStore & {
  saveDirectSale: (sale: Parameters<MemoryLocalStore["saveDirectSale"]>[0]) => unknown;
};

/** عدسة المخزن الكافي للمنظومة الثلاث معًا (الاختبار يستهلك المجموع). */
type SaleSliceTestStore = DirectSaleServiceStore &
  ProjectFinancialServiceStore &
  FulfillmentServiceStore &
  CollectionServiceStore;

function makeStack(store: SaleSliceTestStore) {
  const projectFinance = new ProjectFinancialService(store, now);
  const fulfillment = new FulfillmentService(store, now);
  const directSales = new DirectSaleService(store, now);
  const movements = new DirectSaleMovementsService(store, now);
  const collections = new CollectionService(store, fulfillment, directSales, projectFinance, now);
  return { projectFinance, directSales, movements, collections };
}

/** المثال ١: بيع 15 د.أ (1500)، قبض 5 (500)، تكلفة 6 (600) — دين مؤكد معرّف. */
async function recordSale_15_5_6(directSales: DirectSaleService) {
  const result = await directSales.record({
    itemName: "صندوق هدايا",
    quantity: 1,
    revenueMinor: 1500,
    collectedMinor: 500,
    collectionStatus: "partial_debt",
    customerName: "ليان — جارة المحل",
    costMinor: 600,
    occurredOn: "2026-09-15",
    note: "بيع مباشر",
    idempotencyKey: "s11-sale-op",
  });
  if (!result.ok) throw new Error(result.message);
  return result.value;
}

const adapters = [
  ["الذاكرة", () => new MemoryLocalStore() as unknown as SaleSliceTestStore],
  ["IndexedDB", () => new IndexedDbLocalStore() as unknown as SaleSliceTestStore],
] as const;

describe("S11 — أمثلة الأمر المالية الخمسة على مالك المصدر (المهايئان معًا)", () => {
  afterEach(async () => {
    await clearDatabase();
  });

  for (const [label, makeStore] of adapters) {
    it(`${label}: مثال ١ — بيع 15/قبض 5/تكلفة 6 ثم تحصيل 10 بلا إيراد جديد`, async () => {
      if (label === "IndexedDB") await clearDatabase();
      try {
        const store = makeStore();
        const { projectFinance, directSales, movements, collections } = makeStack(store);
        const before = await projectFinance.readPosition();
        if (!before.ok) throw new Error(before.message);

        const sale = await recordSale_15_5_6(directSales);
        /* الإيراد والمساهمة والحق من المصدر الواحد. */
        expect(sale.revenueMinor).toBe(1500);
        expect(sale.profitMinor).toBe(900);
        expect(directSaleOutstandingMinor(sale)).toBe(1000);
        expect(sale.collectionStatus).toBe("partial_debt");
        /* القبض الابتدائي سطر مؤرخ بتاريخ البيع (مثال ٤: فصل الشهور). */
        expect(sale.collections?.[0]?.occurredOn).toBe("2026-09-15");
        /* النقد +5 فقط (لا يُعد المقبوض ربحًا). */
        const afterSale = await projectFinance.readPosition();
        if (!afterSale.ok) throw new Error(afterSale.message);
        expect(afterSale.value.recordedCashMinor - before.value.recordedCashMinor).toBe(500);

        /* تحصيل المتبقي 10 بتاريخه المستقل عبر المنسق إلى مالك المصدر. */
        const collected = await collections.collect({
          sourceKind: "direct_sale",
          sourceId: sale.id,
          amountMinor: 1000,
          walletId: null,
          idempotencyKey: "s11-collect-op",
        });
        if (!collected.ok) throw new Error(collected.message);
        expect(collected.value.remainingAfterMinor).toBe(0);
        const afterCollect = await projectFinance.readPosition();
        if (!afterCollect.ok) throw new Error(afterCollect.message);
        /* النقد +10 إضافية ولا إيراد ولا مساهمة جديدة — القبض ليس ربحًا. */
        expect(afterCollect.value.recordedCashMinor - afterSale.value.recordedCashMinor).toBe(1000);
        const live = okValue(await directSales.get(sale.id));
        if (!live) throw new Error("missing sale");
        expect(live.collectedMinor).toBe(1500);
        expect(live.revenueMinor).toBe(1500);
        expect(live.profitMinor).toBe(900);
        expect(live.collectionStatus).toBe("collected_in_full");
        expect(directSaleOutstandingMinor(live)).toBe(0);
        /* سطرا القبض بشهرين مختلفين — تاريخ البيع وتاريخ القبض منفصلان. */
        expect(live.collections?.map(entry => entry.occurredOn)).toEqual(["2026-09-15", "2026-10-01"]);
      } finally {
        if (label === "IndexedDB") await clearDatabase();
      }
    });

    it(`${label}: مثال ٢ — محاولتا قبض متزامنتان للمتبقي 10: واحدة تنجح والأخرى تُراجع (SDF-039)`, async () => {
      if (label === "IndexedDB") await clearDatabase();
      try {
        const store = makeStore();
        const { projectFinance, directSales, movements } = makeStack(store);
        const sale = await recordSale_15_5_6(directSales);
        const before = await projectFinance.readPosition();
        if (!before.ok) throw new Error(before.message);

        /* نافذتان: خدمتان مستقلتان فوق المخزن الواحد تطلبان المتبقي نفسه
         * في آنٍ واحد — الحارس الحي داخل حد الكتابة يفصل بينهما. */
        const serviceA = new DirectSaleMovementsService(store, now);
        const serviceB = new DirectSaleMovementsService(store, now);
        const [a, b] = await Promise.all([
          serviceA.collectPayment(sale.id, {
            amountMinor: 1000,
            occurredOn: "2026-10-01",
            operationKey: "s11-race-a",
          }),
          serviceB.collectPayment(sale.id, {
            amountMinor: 1000,
            occurredOn: "2026-10-01",
            operationKey: "s11-race-b",
          }),
        ]);
        const outcomes = [a, b];
        const winners = outcomes.filter(outcome => outcome.ok);
        const losers = outcomes.filter(outcome => !outcome.ok);
        expect(winners).toHaveLength(1);
        expect(losers).toHaveLength(1);
        const loser = losers[0];
        if (loser.ok) throw new Error("unreachable");
        expect(loser.message).toContain("لم يُسجَّل شيء");
        /* لا حق سالب ولا قبض مزدوج: المقبوض 15 كاملة والنقد +10 مرة واحدة. */
        const live = okValue(await directSales.get(sale.id));
        if (!live) throw new Error("missing sale");
        expect(live.collectedMinor).toBe(1500);
        expect(directSaleOutstandingMinor(live)).toBe(0);
        const after = await projectFinance.readPosition();
        if (!after.ok) throw new Error(after.message);
        expect(after.value.recordedCashMinor - before.value.recordedCashMinor).toBe(1000);
        expect(live.collections?.filter(entry => entry.amountMinor > 0)).toHaveLength(2);
      } finally {
        if (label === "IndexedDB") await clearDatabase();
      }
    });

    it(`${label}: مثال ٣ — مرتجع كامل يلغي الحق 10 ويثبت رد 5 فقط، والرد الفعلي مؤرخ لا يُكرر (SDF-053/054)`, async () => {
      if (label === "IndexedDB") await clearDatabase();
      try {
        const store = makeStore();
        const { projectFinance, directSales, movements, collections } = makeStack(store);
        const sale = await recordSale_15_5_6(directSales);
        const before = await projectFinance.readPosition();
        if (!before.ok) throw new Error(before.message);

        /* المرتجع الكامل: يلغي الحق المتبقي (10) ويثبت رد المقبوض (5) فقط. */
        const returned = await movements.fullReturn(sale.id, {
          occurredOn: "2026-10-05",
          reason: "أرجعت الزبونة الصندوق كاملًا",
          operationKey: "s11-return-op",
        });
        if (!returned.ok) throw new Error(returned.message);
        expect(returned.value.sale.collectionStatus).toBe("returned_full");
        expect(returned.value.sale.return?.refundDueMinor).toBe(500);
        expect(directSaleOutstandingMinor(returned.value.sale)).toBe(0);
        /* الأصل محفوظ: الإيراد والتكلفة والمساهمة والقبض كما كانت. */
        expect(returned.value.sale.revenueMinor).toBe(1500);
        expect(returned.value.sale.profitMinor).toBe(900);
        expect(returned.value.sale.collectedMinor).toBe(500);
        /* النقد لم يتغير — لا خروج مال قبل دفع رد فعلي. */
        const afterReturn = await projectFinance.readPosition();
        if (!afterReturn.ok) throw new Error(afterReturn.message);
        expect(afterReturn.value.recordedCashMinor).toBe(before.value.recordedCashMinor);
        /* الحق الملغى خرج من الذمم: لا مصدر تحصيل مؤهل بعده. */
        const sources = await collections.listReceivableSources();
        if (!sources.ok) throw new Error(sources.message);
        expect(sources.value.some(source => source.id === sale.id)).toBe(false);

        /* دفع الرد الفعلي مؤرخ بتاريخه ولا يُدفع مرتين (SDF-054). */
        const paid = await movements.payRefund(sale.id, {
          amountMinor: 300,
          occurredOn: "2026-10-07",
          operationKey: "s11-refund-op",
        });
        if (!paid.ok) throw new Error(paid.message);
        expect(paid.value.sale.refundedMinor).toBe(300);
        const overPay = await movements.payRefund(sale.id, {
          amountMinor: 300,
          occurredOn: "2026-10-08",
          operationKey: "s11-refund-op-2",
        });
        expect(overPay.ok).toBe(false);
        /* النقد نقص بقدر المدفوع فعليًا فقط. */
        const afterRefund = await projectFinance.readPosition();
        if (!afterRefund.ok) throw new Error(afterRefund.message);
        expect(afterRefund.value.recordedCashMinor).toBe(before.value.recordedCashMinor - 300);
        /* إعادة نية الدفع نفسها إعادة استخدام صادقة لا دفعة ثانية. */
        const replay = await movements.payRefund(sale.id, {
          amountMinor: 300,
          occurredOn: "2026-10-07",
          operationKey: "s11-refund-op",
        });
        if (!replay.ok) throw new Error(replay.message);
        expect(replay.value.reused).toBe(true);
        const afterReplay = await projectFinance.readPosition();
        if (!afterReplay.ok) throw new Error(afterReplay.message);
        expect(afterReplay.value.recordedCashMinor).toBe(before.value.recordedCashMinor - 300);
      } finally {
        if (label === "IndexedDB") await clearDatabase();
      }
    });

    it(`${label}: تغيّر الحمولة بالمفتاح نفسه تعارض صادق — والمطابقة إعادة استخدام (تصحيح R3-001/SDF-037/038)`, async () => {
      if (label === "IndexedDB") await clearDatabase();
      try {
        const store = makeStore();
        const { directSales, movements } = makeStack(store);
        const sale = await recordSale_15_5_6(directSales);

        /* قبضة 10 ثم إعادة المفتاح نفسه بمبلغ مختلف: تعارض صادق لا عودة
         * صامتة لسجل قديم — ولا كتابة إطلاقًا. */
        const first = await movements.collectPayment(sale.id, {
          amountMinor: 1000,
          occurredOn: "2026-10-01",
          operationKey: "r3-payload-op",
        });
        if (!first.ok) throw new Error(first.message);
        const changedAmount = await movements.collectPayment(sale.id, {
          amountMinor: 400,
          occurredOn: "2026-10-01",
          operationKey: "r3-payload-op",
        });
        expect(changedAmount.ok).toBe(false);
        if (changedAmount.ok) throw new Error("unreachable");
        expect(changedAmount.message).toContain("بحمولة مختلفة");
        const changedDate = await movements.collectPayment(sale.id, {
          amountMinor: 1000,
          occurredOn: "2026-10-02",
          operationKey: "r3-payload-op",
        });
        expect(changedDate.ok).toBe(false);
        /* الحمولة المطابقة بالمفتاح نفسه: إعادة استخدام صادقة للمحفوظ. */
        const replay = await movements.collectPayment(sale.id, {
          amountMinor: 1000,
          occurredOn: "2026-10-01",
          operationKey: "r3-payload-op",
        });
        if (!replay.ok) throw new Error(replay.message);
        expect(replay.value.reused).toBe(true);
        expect(replay.value.sale.collectedMinor).toBe(1500);

        /* المرتجع: إعادة المفتاح بتاريخ مختلف تعارض؛ وبالسبب المختلف تعارض؛
         * وبالحمولة المطابقة إعادة استخدام. */
        await movements.fullReturn(sale.id, {
          occurredOn: "2026-10-05",
          reason: "أرجعت الزبونة الصندوق كاملًا",
          operationKey: "r3-return-op",
        });
        const changedReturnDate = await movements.fullReturn(sale.id, {
          occurredOn: "2026-10-06",
          reason: "أرجعت الزبونة الصندوق كاملًا",
          operationKey: "r3-return-op",
        });
        expect(changedReturnDate.ok).toBe(false);
        const changedReturnReason = await movements.fullReturn(sale.id, {
          occurredOn: "2026-10-05",
          reason: "سبب آخر مختلف",
          operationKey: "r3-return-op",
        });
        expect(changedReturnReason.ok).toBe(false);
        const replayReturn = await movements.fullReturn(sale.id, {
          occurredOn: "2026-10-05",
          reason: "أرجعت الزبونة الصندوق كاملًا",
          operationKey: "r3-return-op",
        });
        if (!replayReturn.ok) throw new Error(replayReturn.message);
        expect(replayReturn.value.reused).toBe(true);

        /* دفع الرد: الحمولة المتغيرة تعارض والمطابقة إعادة استخدام. */
        await movements.payRefund(sale.id, {
          amountMinor: 200,
          occurredOn: "2026-10-07",
          operationKey: "r3-refund-op",
        });
        const changedRefund = await movements.payRefund(sale.id, {
          amountMinor: 300,
          occurredOn: "2026-10-07",
          operationKey: "r3-refund-op",
        });
        expect(changedRefund.ok).toBe(false);
        const replayRefund = await movements.payRefund(sale.id, {
          amountMinor: 200,
          occurredOn: "2026-10-07",
          operationKey: "r3-refund-op",
        });
        if (!replayRefund.ok) throw new Error(replayRefund.message);
        expect(replayRefund.value.reused).toBe(true);
        expect(replayRefund.value.sale.refundedMinor).toBe(200);
      } finally {
        if (label === "IndexedDB") await clearDatabase();
      }
    });

    it(`${label}: إنشاء متزامن بمفتاح واحد: سجل واحد وسطر كاش واحد (تصحيح R3-002b)`, async () => {
      if (label === "IndexedDB") await clearDatabase();
      try {
        const store = makeStore();
        const { directSales } = makeStack(store);
        const serviceB = new DirectSaleService(store, now);
        const [a, b] = await Promise.all([
          directSales.record({
            itemName: "بيع متزامن",
            quantity: 1,
            revenueMinor: 900,
            collectedMinor: 900,
            costMinor: null,
            occurredOn: "2026-10-01",
            note: "نقدي",
            idempotencyKey: "r3-race-create-op",
          }),
          serviceB.record({
            itemName: "بيع متزامن",
            quantity: 1,
            revenueMinor: 900,
            collectedMinor: 900,
            costMinor: null,
            occurredOn: "2026-10-01",
            note: "نقدي",
            idempotencyKey: "r3-race-create-op",
          }),
        ]);
        /* واحدة التزام والثانية إعادة استخدام صادقة للسجل نفسه. */
        const outcomes = [a, b];
        const committed = outcomes.filter(outcome => outcome.ok && !outcome.reused);
        const reusedOutcomes = outcomes.filter(outcome => outcome.ok && outcome.reused);
        expect(committed).toHaveLength(1);
        expect(reusedOutcomes).toHaveLength(1);
        expect(committed[0].ok && committed[0].value.id).toBe(
          reusedOutcomes[0].ok ? reusedOutcomes[0].value.id : null,
        );
        const list = await directSales.list();
        if (!list.ok) throw new Error(list.message);
        expect(list.value.filter(s => s.idempotencyKey === "r3-race-create-op")).toHaveLength(1);
      } finally {
        if (label === "IndexedDB") await clearDatabase();
      }
    });
  }

  it("الذاكرة: مثال ٤ — الإرث المجمل القديم لا تؤلف تواريخه (SDF-014)", async () => {
    const store = new MemoryLocalStore() as unknown as SaleSliceTestStore;
    const { directSales, movements } = makeStack(store);
    /* سجل قديم (محاكاة ما قبل S11): قبض مجمل بلا خطوط مؤرخة. */
    const saved = await (store as unknown as AnyStore).saveDirectSale({
      id: "legacy-sale",
      itemName: "قطعة قديمة",
      quantity: 1,
      currency: "JOD",
      revenueMinor: 8000,
      collectedMinor: 3000,
      collectionStatus: "partial_debt",
      catalogItemId: null,
      customerName: "زبون قديم",
      customerPartyId: null,
      costMinor: null,
      profitMinor: null,
      occurredOn: "2026-06-05",
      recordedAt: "2026-06-05T09:00:00.000Z",
      note: "بيع ما قبل التأريخ",
      idempotencyKey: "legacy-key",
      status: "active",
      cancelledAt: null,
      cancellationReason: null,
      revisions: [],
    });
    if (!saved || !(saved as { ok: boolean }).ok) throw new Error("legacy save failed");
    const before = okValue(await directSales.get("legacy-sale"));
    if (!before) throw new Error("missing legacy");
    expect(before.collections ?? []).toHaveLength(0);
    /* التحصيل الجديد عليه سطر مؤرخ جديد فقط — الإجمالي القديم كما هو. */
    const collected = await movements.collectPayment("legacy-sale", {
      amountMinor: 2000,
      occurredOn: "2026-10-02",
      operationKey: "legacy-collect-op",
    });
    if (!collected.ok) throw new Error(collected.message);
    expect(collected.value.sale.collectedMinor).toBe(5000);
    expect(collected.value.sale.collections).toHaveLength(1);
    expect(collected.value.sale.collections?.[0]?.occurredOn).toBe("2026-10-02");
  });

  it("الذاكرة: مثال ٥ — المجهول ≠ الصفر، والأسماء المتشابهة هويات مستقلة، والإنشاء الذرّي مع المحفظة", async () => {
    const store = new MemoryLocalStore() as unknown as SaleSliceTestStore;
    const { projectFinance, directSales, movements } = makeStack(store);

    /* تكلفة مجهولة مقابل صفر مؤكد — معنيان مختلفان (SDF-005). */
    const unknownCost = await directSales.record({
      itemName: "بيع مجهول التكلفة",
      quantity: 1,
      revenueMinor: 2000,
      collectedMinor: 2000,
      costMinor: null,
      occurredOn: "2026-10-01",
      note: "نقدي",
      idempotencyKey: "s11-unknown-cost",
    });
    if (!unknownCost.ok) throw new Error(unknownCost.message);
    expect(unknownCost.value.costMinor).toBeNull();
    expect(unknownCost.value.profitMinor).toBeNull();
    const zeroCost = await directSales.record({
      itemName: "بيع تكلفته صفر مؤكدة",
      quantity: 1,
      revenueMinor: 2000,
      collectedMinor: 2000,
      costMinor: 0,
      occurredOn: "2026-10-01",
      note: "نقدي",
      idempotencyKey: "s11-zero-cost",
    });
    if (!zeroCost.ok) throw new Error(zeroCost.message);
    expect(zeroCost.value.costMinor).toBe(0);
    expect(zeroCost.value.profitMinor).toBe(2000);

    /* اسمان متشابهان (الاسم نفسه) هويتان مستقلتان — لا دمج بالاسم (SDF-009). */
    const first = await directSales.record({
      itemName: "قطعة",
      quantity: 1,
      revenueMinor: 1500,
      collectedMinor: 500,
      collectionStatus: "partial_debt",
      customerName: "ليان",
      costMinor: null,
      occurredOn: "2026-09-15",
      note: "أولى",
      idempotencyKey: "s11-twin-a",
    });
    if (!first.ok) throw new Error(first.message);
    const second = await directSales.record({
      itemName: "قطعة",
      quantity: 1,
      revenueMinor: 900,
      collectedMinor: 900,
      customerName: "ليان",
      costMinor: null,
      occurredOn: "2026-09-16",
      note: "ثانية",
      idempotencyKey: "s11-twin-b",
    });
    if (!second.ok) throw new Error(second.message);
    expect(first.value.id).not.toBe(second.value.id);
    expect(directSaleOutstandingMinor(first.value)).toBe(1000);
    expect(directSaleOutstandingMinor(second.value)).toBe(0);
    const list = await directSales.list();
    if (!list.ok) throw new Error(list.message);
    expect(list.value.filter(sale => sale.customerName === "ليان")).toHaveLength(2);

    /* الإنشاء الذرّي مع محفظة غائبة: لا بيع ولا تخصيص — صفر أثر. */
    const before = await projectFinance.readPosition();
    if (!before.ok) throw new Error(before.message);
    const failed = await directSales.record({
      itemName: "بيع بمحفظة غائبة",
      quantity: 1,
      revenueMinor: 700,
      collectedMinor: 700,
      costMinor: null,
      occurredOn: "2026-10-01",
      note: "ذرّية",
      idempotencyKey: "s11-atomic-fail",
      wallet: { walletId: "wallet-that-does-not-exist" },
    });
    expect(failed.ok).toBe(false);
    const afterFailed = await projectFinance.readPosition();
    if (!afterFailed.ok) throw new Error(afterFailed.message);
    expect(afterFailed.value).toEqual(before.value);
    const salesAfter = await directSales.list();
    if (!salesAfter.ok) throw new Error(salesAfter.message);
    expect(salesAfter.value.some(sale => sale.idempotencyKey === "s11-atomic-fail")).toBe(false);
  });

  it("الذاكرة: ملف تالف في حقول S11 يُرفض قبل المعاينة بلا أي كتابة في الهدف (تصحيح R4-002)", async () => {
    const source = new MemoryLocalStore() as unknown as SaleSliceTestStore;
    const { directSales, movements } = makeStack(source);
    const sale = await recordSale_15_5_6(directSales);
    const returned = await movements.fullReturn(sale.id, {
      occurredOn: "2026-10-05",
      reason: "أرجعت الزبونة الصندوق كاملًا",
      operationKey: "corrupt-return-op",
    });
    if (!returned.ok) throw new Error(returned.message);

    const transferSource = new LocalTransferService(
      source as unknown as ConstructorParameters<typeof LocalTransferService>[0],
      now,
    );
    const exported = await transferSource.createExport();
    if (!exported.ok) throw new Error(exported.message);
    /* تلف مادي: مجموع المردود لا يطابق مدفوعات الرد — المدقق يرفض قبل
     * المعاينة، والهدف لا يُكتب فيه شيء إطلاقًا. */
    const corrupted = JSON.parse(JSON.stringify(exported.value));
    const saleRecord = (corrupted.data?.directSales ?? []).find(
      (record: { id?: string }) => record?.id === sale.id,
    );
    expect(saleRecord).toBeTruthy();
    saleRecord.refundedMinor = 999;
    /* تجديد بصمة التكامل كي يمتحن الفحصُ مدققَ العائلة نفسه لا بصمة
     * الملف — كأن الملف أُنشئ هكذا من مصدر فاسد. */
    corrupted.integrity = {
      ...corrupted.integrity,
      digest: createHash("sha256").update(JSON.stringify(corrupted.data)).digest("hex"),
    };

    const cleanTarget = new MemoryLocalStore() as unknown as SaleSliceTestStore;
    const transferTarget = new LocalTransferService(
      cleanTarget as unknown as ConstructorParameters<typeof LocalTransferService>[0],
      now,
    );
    const prepared = await transferTarget.prepareRestore(JSON.stringify(corrupted));
    expect(prepared.ok).toBe(false);
    const afterAttempt = await new DirectSaleService(cleanTarget, now).list();
    if (!afterAttempt.ok) throw new Error(afterAttempt.message);
    expect(afterAttempt.value).toHaveLength(0);
  });

  it("الذاكرة → IndexedDB: السطر السالب (تصحيح المقبض والعكس) يعبر دورة النقل كاملة (تصحيح R2-F2)", async () => {
    await clearDatabase();
    try {
      const source = new MemoryLocalStore() as unknown as SaleSliceTestStore;
      const { directSales } = makeStack(source);
      const sale = await recordSale_15_5_6(directSales);
      /* تصحيح المقبض 5→3: دلتا سالبة −2 كسطر تسوية مؤرخ بمفتاح المراجعة. */
      const corrected = await directSales.update(sale.id, {
        itemName: sale.itemName,
        quantity: sale.quantity,
        revenueMinor: sale.revenueMinor,
        collectedMinor: 300,
        collectionStatus: "partial_debt",
        costMinor: sale.costMinor,
        occurredOn: sale.occurredOn,
        note: sale.note ?? "",
        idempotencyKey: "s11-adjust-transfer-op",
        revisionReason: "صححت المقبوض",
      });
      if (!corrected.ok) throw new Error(corrected.message);
      expect(corrected.value.collections?.some(line => (line.id ?? "").includes(":adjust:"))).toBe(true);
      const adjustLine = corrected.value.collections?.find(line => (line.id ?? "").includes(":adjust:"));
      expect(adjustLine?.amountMinor).toBe(-200);

      const transferSource = new LocalTransferService(
        source as unknown as ConstructorParameters<typeof LocalTransferService>[0],
        now,
      );
      const exported = await transferSource.createExport();
      if (!exported.ok) throw new Error(exported.message);

      const target = new IndexedDbLocalStore() as unknown as SaleSliceTestStore;
      const transferTarget = new LocalTransferService(
        target as unknown as ConstructorParameters<typeof LocalTransferService>[0],
        now,
      );
      const restored = await transferTarget.prepareRestore(JSON.stringify(exported.value));
      if (!restored.ok) throw new Error(restored.message);
      const confirmed = await transferTarget.confirmImport(restored.value);
      if (!confirmed.ok) throw new Error(confirmed.message);

      const targetSales = new DirectSaleService(target, now);
      const roundTripped = okValue(await targetSales.get(sale.id));
      if (!roundTripped) throw new Error("missing round-tripped sale");
      /* السطر السالب عبر حرفيًا والمدقق قبله: المجموع 3 والدلتا −2 بمفتاحها. */
      const roundAdjust = roundTripped.collections?.find(line => (line.id ?? "").includes(":adjust:"));
      expect(roundAdjust?.amountMinor).toBe(-200);
      expect(roundAdjust?.operationKey).toBe(adjustLine?.operationKey);
      expect(roundTripped.collectedMinor).toBe(300);
      /* مجموع الخطوط = المجموع المحروس بعد التصحيح (5 ابتدائي − 2 تسوية). */
      const sum = (roundTripped.collections ?? []).reduce((total, line) => total + line.amountMinor, 0);
      expect(sum).toBe(roundTripped.collectedMinor);
    } finally {
      await clearDatabase();
    }
  });

  it("الذاكرة: صرف الرد من محفظة — سطر إنفاق سالب واحد بالنقد مرة واحدة والإعادة إعادة استخدام (تصحيح R2-004)", async () => {
    const store = new MemoryLocalStore() as unknown as SaleSliceTestStore;
    const { projectFinance, directSales, movements } = makeStack(store);
    /* محفظة برصيد افتتاحي 50 د.أ. */
    const wallet = createCashWallet({
      id: "drawer-refund",
      name: "درج المحل",
      kind: "cash_drawer",
      createdAt: NOW,
      createdOperationKey: "drawer-refund-open",
    });
    const opening = createCashContinuityEntry({
      id: "drawer-refund-opening",
      walletId: wallet.id,
      type: "opening_balance",
      occurredOn: "2026-09-01",
      recordedAt: NOW,
      cashDeltaMinor: 5000,
      note: "رصيد بداية",
      operationKey: "drawer-refund-open-key",
    });
    const committed = await (
      store as unknown as { commitCashContinuity: typeof store.commitCashContinuity }
    ).commitCashContinuity(wallet, [opening]);
    if (!committed.ok) throw new Error(committed.message);

    /* بيع 15/قبض 5 إلى المحفظة نفسها ثم مرتجع كامل ثم دفع رد 3 منها من المحفظة. */
    const sale = await directSales.record({
      itemName: "صندوق محفظة",
      quantity: 1,
      revenueMinor: 1500,
      collectedMinor: 500,
      collectionStatus: "partial_debt",
      customerName: "ليان — جارة المحل",
      costMinor: null,
      occurredOn: "2026-09-15",
      note: "بيع بمحفظة",
      idempotencyKey: "s11-wallet-sale",
      wallet: { walletId: wallet.id },
    });
    if (!sale.ok) throw new Error(sale.message);
    expect(sale.value.collections?.[0]?.allocationEntryId).toBeTruthy();
    const returned = await movements.fullReturn(sale.value.id, {
      occurredOn: "2026-10-05",
      reason: "أرجعت الزبونة الصندوق كاملًا",
      operationKey: "s11-wallet-return",
    });
    if (!returned.ok) throw new Error(returned.message);

    const before = await projectFinance.readPosition();
    if (!before.ok) throw new Error(before.message);
    const paid = await movements.payRefund(sale.value.id, {
      amountMinor: 300,
      occurredOn: "2026-10-07",
      operationKey: "s11-wallet-refund",
      walletId: wallet.id,
    });
    if (!paid.ok) throw new Error(paid.message);
    /* سطر الإنفاق السالب واحد مرتبط بسطر الدفع نفسه. */
    expect(paid.value.cashEntry?.cashDeltaMinor).toBe(-300);
    expect(paid.value.cashEntry?.walletId).toBe(wallet.id);
    expect(paid.value.cashEntry?.sourceRefLineId).toBe(paid.value.sale.refundPayments?.[0]?.id);
    expect(paid.value.sale.refundPayments?.[0]?.allocationEntryId).toBe(paid.value.cashEntry?.id);
    expect(paid.value.sale.refundedMinor).toBe(300);
    /* النقد نقص 3 مرة واحدة بالضبط (الافتتاحي 50 + القبض 5 − الرد 3 = 52). */
    const after = await projectFinance.readPosition();
    if (!after.ok) throw new Error(after.message);
    expect(after.value.recordedCashMinor - before.value.recordedCashMinor).toBe(-300);

    /* إعادة نية الدفع نفسها: إعادة استخدام صادقة بأثر الكاش المطابق — لا إنفاق ثانٍ. */
    const replay = await movements.payRefund(sale.value.id, {
      amountMinor: 300,
      occurredOn: "2026-10-07",
      operationKey: "s11-wallet-refund",
      walletId: wallet.id,
    });
    if (!replay.ok) throw new Error(replay.message);
    expect(replay.value.reused).toBe(true);
    expect(replay.value.cashEntry?.id).toBe(paid.value.cashEntry?.id);
    const afterReplay = await projectFinance.readPosition();
    if (!afterReplay.ok) throw new Error(afterReplay.message);
    expect(afterReplay.value.recordedCashMinor).toBe(after.value.recordedCashMinor);

    /* زيادة على حق الرد القائم مرفوضة — لا سمح بصرف أكثر مما قُبض. */
    const over = await movements.payRefund(sale.value.id, {
      amountMinor: 300,
      occurredOn: "2026-10-08",
      operationKey: "s11-wallet-refund-2",
      walletId: wallet.id,
    });
    expect(over.ok).toBe(false);
  });

  it("الذاكرة: فشل حد الكتابة لا يكتب شيئًا وإعادة المحاولة بالمفتاح نفسه تلتزم أو تعيد — لا نتيجة مجهولة (تصحيح R3-002c)", async () => {
    const realStore = new MemoryLocalStore() as unknown as SaleSliceTestStore;
    /* غلاف يفشل نداء الالتزام الأول بعد تسليحه — محاكاة فشل الحد الصادق
     * (يسلَّح بعد تسجيل البيع كي يفشل التزام القبضة لا التزام البيع). */
    let failFirstCommit = false;
    const failingStore = new Proxy(realStore, {
      get(target, prop, receiver) {
        if (prop === "commitDirectSaleWrite") {
          return (...args: Parameters<SaleSliceTestStore["commitDirectSaleWrite"]>) => {
            if (failFirstCommit) {
              failFirstCommit = false;
              return Promise.resolve({ ok: false, code: "storage_error", message: "تعذر الحفظ محليًا الآن" });
            }
            return (target as SaleSliceTestStore).commitDirectSaleWrite(...args);
          };
        }
        return Reflect.get(target, prop, receiver);
      },
    }) as SaleSliceTestStore;
    const { directSales, movements } = makeStack(failingStore);
    /* محفظة موجودة كي يعبر فحص الوجهة ويصل الفشل إلى حد الكتابة نفسه. */
    const wallet = createCashWallet({
      id: "drawer-r3-recovery",
      name: "درج الاسترداد",
      kind: "cash_drawer",
      createdAt: NOW,
      createdOperationKey: "drawer-r3-recovery-open",
    });
    const walletOpening = createCashContinuityEntry({
      id: "drawer-r3-recovery-opening",
      walletId: wallet.id,
      type: "opening_balance",
      occurredOn: "2026-09-01",
      recordedAt: NOW,
      cashDeltaMinor: 5000,
      note: "رصيد",
      operationKey: "drawer-r3-recovery-open-key",
    });
    const opened = await realStore.commitCashContinuity(wallet, [walletOpening]);
    if (!opened.ok) throw new Error(opened.message);

    const sale = await recordSale_15_5_6(directSales);
    failFirstCommit = true; /* سلِّح الفشل لالتزام القبضة القادم وحده. */
    /* النية تفشل عند الحد بمحفظة مختارة: فشل تخزين صادق — لا نتيجة مجهولة
     * ولا أثر (لا سطر قبض ولا سطر كاش نصفيا). */
    const failed = await movements.collectPayment(sale.id, {
      amountMinor: 1000,
      occurredOn: "2026-10-01",
      operationKey: "r3-recovery-op",
      walletId: wallet.id,
    });
    expect(failed.ok).toBe(false);
    if (failed.ok) throw new Error("unreachable");
    expect(failed.code).toBe("storage_error");
    const afterFailure = await new DirectSaleService(realStore, now).get(sale.id);
    if (!afterFailure.ok) throw new Error(afterFailure.message);
    if (!afterFailure.value) throw new Error("missing sale after failure");
    expect(afterFailure.value.collectedMinor).toBe(500);
    expect(
      (afterFailure.value.collections ?? []).some(entry => entry.operationKey === "r3-recovery-op"),
    ).toBe(false);
    const entriesAfterFailure = await realStore.listCashContinuityEntries();
    if (!entriesAfterFailure.ok) throw new Error(entriesAfterFailure.message);
    expect(
      entriesAfterFailure.value.filter(entry => entry.sourceRefLineId === `${sale.id}:col:r3-recovery-op`),
    ).toHaveLength(0);

    /* إعادة المحاولة بالمفتاح نفسه بعد الفشل: التزام نظيف (لم يُكتب شيء
     * قبلًا) ثم إعادتها إعادة استخدام صادقة — استرداد النتيجة بالقصد نفسه. */
    const recovered = await movements.collectPayment(sale.id, {
      amountMinor: 1000,
      occurredOn: "2026-10-01",
      operationKey: "r3-recovery-op",
    });
    if (!recovered.ok) throw new Error(recovered.message);
    expect(recovered.value.reused).toBe(false);
    expect(recovered.value.sale.collectedMinor).toBe(1500);
    const replay = await movements.collectPayment(sale.id, {
      amountMinor: 1000,
      occurredOn: "2026-10-01",
      operationKey: "r3-recovery-op",
    });
    if (!replay.ok) throw new Error(replay.message);
    expect(replay.value.reused).toBe(true);
    expect(replay.value.sale.collectedMinor).toBe(1500);
    /* سطر قبض واحد بالمفتاح لا اثنان — لا كتابة مزدوجة أبدًا. */
    expect(
      (replay.value.sale.collections ?? []).filter(entry => entry.operationKey === "r3-recovery-op"),
    ).toHaveLength(1);
  });

  it("المهايئان معًا: عكسان متزامنان للتخصيص نفسه — واحد ينجح والآخر يُرفض بلا أثر جزئي (تصحيح R3-002d)", async () => {
    for (const [label, makeStore] of adapters) {
      if (label === "IndexedDB") await clearDatabase();
      try {
        const store = makeStore();
        const { directSales } = makeStack(store);
        /* محفظة وقبض موزع قابل للعكس. */
        const wallet = createCashWallet({
          id: "drawer-r3d",
          name: "درج العكس",
          kind: "cash_drawer",
          createdAt: NOW,
          createdOperationKey: "drawer-r3d-open",
        });
        const opening = createCashContinuityEntry({
          id: "drawer-r3d-opening",
          walletId: wallet.id,
          type: "opening_balance",
          occurredOn: "2026-09-01",
          recordedAt: NOW,
          cashDeltaMinor: 5000,
          note: "رصيد",
          operationKey: "drawer-r3d-open-key",
        });
        const opened = await (store as unknown as SaleSliceTestStore).commitCashContinuity(wallet, [opening]);
        if (!opened.ok) throw new Error(opened.message);

        const sale = await directSales.record({
          itemName: "بيع عكس متزامن",
          quantity: 1,
          revenueMinor: 1500,
          collectedMinor: 500,
          collectionStatus: "partial_debt",
          customerName: "ليان — جارة المحل",
          costMinor: null,
          occurredOn: "2026-09-15",
          note: "بيع",
          idempotencyKey: "r3d-sale-op",
          wallet: { walletId: wallet.id },
        });
        if (!sale.ok) throw new Error(sale.message);
        const allocationEntryId = sale.value.collections?.[0]?.allocationEntryId ?? null;
        expect(allocationEntryId).toBeTruthy();

        const { SaleCollectionReversalService } =
          await import("@/application/collections/saleCollectionReversalService");
        const { projectFinance } = makeStack(store);
        const reversalA = new SaleCollectionReversalService(store, projectFinance, now);
        const reversalB = new SaleCollectionReversalService(store, projectFinance, now);
        const [a, b] = await Promise.all([
          reversalA.reverse({
            saleId: sale.value.id,
            allocationEntryId: allocationEntryId!,
            operationKey: "r3d-reverse-op",
            reason: "خطأ في المبلغ",
          }),
          reversalB.reverse({
            saleId: sale.value.id,
            allocationEntryId: allocationEntryId!,
            operationKey: "r3d-reverse-op-2",
            reason: "خطأ في المبلغ",
          }),
        ]);
        const outcomes = [a, b];
        const winners = outcomes.filter(outcome => outcome.ok);
        const losers = outcomes.filter(outcome => !outcome.ok);
        expect(winners).toHaveLength(1);
        expect(losers).toHaveLength(1);
        /* لا أثر جزئي: المقبوض رجع إلى ما قبل القبضة الموزعة (0) بسطر سالب
         * واحد فقط، وقيد عكس كاش واحد للتخصيص. */
        const live = await new DirectSaleService(store, now).get(sale.value.id);
        if (!live.ok) throw new Error(live.message);
        if (!live.value) throw new Error("missing sale after double reversal");
        expect(live.value.collectedMinor).toBe(0);
        const negatives = (live.value.collections ?? []).filter(entry => entry.amountMinor < 0);
        expect(negatives).toHaveLength(1);
        const entries = await (store as unknown as SaleSliceTestStore).listCashContinuityEntries();
        if (!entries.ok) throw new Error(entries.message);
        const reversals = entries.value.filter(
          entry => entry.type === "reversal" && entry.reversesEntryId === allocationEntryId,
        );
        expect(reversals).toHaveLength(1);
      } finally {
        if (label === "IndexedDB") await clearDatabase();
      }
    }
  });

  it("الذاكرة → IndexedDB: دورة النقل الكاملة للحقول الجديدة (تصدير→وارد→استعادة→تأكيد)", async () => {
    await clearDatabase();
    try {
      const source = new MemoryLocalStore() as unknown as SaleSliceTestStore;
      const { directSales, movements } = makeStack(source);
      const sale = await recordSale_15_5_6(directSales);
      await movements.collectPayment(sale.id, {
        amountMinor: 400,
        occurredOn: "2026-10-02",
        operationKey: "transfer-collect-op",
      });
      await movements.fullReturn(sale.id, {
        occurredOn: "2026-10-05",
        reason: "مرتجع كامل قبل النقل",
        operationKey: "transfer-return-op",
      });
      await movements.payRefund(sale.id, {
        amountMinor: 200,
        occurredOn: "2026-10-07",
        operationKey: "transfer-refund-op",
      });

      const transferSource = new LocalTransferService(
        source as unknown as ConstructorParameters<typeof LocalTransferService>[0],
        now,
      );
      const exported = await transferSource.createExport();
      if (!exported.ok) throw new Error(exported.message);

      const target = new IndexedDbLocalStore() as unknown as SaleSliceTestStore;
      const transferTarget = new LocalTransferService(
        target as unknown as ConstructorParameters<typeof LocalTransferService>[0],
        now,
      );
      const restored = await transferTarget.prepareRestore(JSON.stringify(exported.value));
      if (!restored.ok) throw new Error(restored.message);
      const confirmed = await transferTarget.confirmImport(restored.value);
      if (!confirmed.ok) throw new Error(confirmed.message);

      const targetSales = new DirectSaleService(target, now);
      const roundTripped = okValue(await targetSales.get(sale.id));
      if (!roundTripped) throw new Error("missing round-tripped sale");
      /* كل الحقول الجديدة عبرت حرفيًا: الخطوط المؤرخة والمرتجع والرد. */
      expect(roundTripped.collections?.length).toBe(2);
      expect(roundTripped.collections?.[1]?.operationKey).toBe("transfer-collect-op");
      expect(roundTripped.return?.refundDueMinor).toBe(900);
      expect(roundTripped.return?.occurredOn).toBe("2026-10-05");
      expect(roundTripped.refundedMinor).toBe(200);
      expect(roundTripped.refundPayments?.[0]?.operationKey).toBe("transfer-refund-op");
      expect(roundTripped.collectedMinor).toBe(900);
    } finally {
      await clearDatabase();
    }
  });
});
