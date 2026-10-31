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
import { createCashWallet } from "@micro-domain/cash-continuity/index.js";
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
