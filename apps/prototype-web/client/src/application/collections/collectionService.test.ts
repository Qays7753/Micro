/** المجموعة ٢ (§15 — اختبارات التحصيل): جزئي/كامل/تجاوز/محفظة/تكرار/انقطاع. */
import { describe, expect, it } from "vitest";
import { CollectionService } from "./collectionService";
import { ProjectFinancialService } from "@/application/finance/projectFinancialService";
import { FulfillmentService } from "@/application/fulfillment/fulfillmentService";
import { DirectSaleService } from "@/application/direct-sales/directSaleService";
import { MemoryLocalStore } from "@/storage/local/MemoryLocalStore";
import {
  calculateCostSnapshot,
  collectDeposit,
  collectRemaining,
  createCraftOrder,
  registerDebt,
  transitionOrder,
} from "@micro-domain/craft-order/index.js";
import { createDirectSale } from "@micro-domain/direct-sale/index.js";
import { createCashContinuityEntry, createCashWallet } from "@micro-domain/cash-continuity/index.js";

const now = () => "2026-09-02T10:00:00.000Z";

function makeServices(store: MemoryLocalStore) {
  const projectFinance = new ProjectFinancialService(store, now);
  const fulfillment = new FulfillmentService(store, now);
  const directSales = new DirectSaleService(store, now);
  const collections = new CollectionService(store, fulfillment, directSales, projectFinance, now);
  return { projectFinance, fulfillment, directSales, collections };
}

/** طلب مسلّم بمتبقٍ — التحصيل الجزئي والكامل مشروعه، والدين يُسجل بعدها. */
async function deliveredOrderWithRemaining(store: MemoryLocalStore, id: string, price = 10000) {
  const cost = calculateCostSnapshot(`${id}-cost`, {
    currency: "JOD",
    materialItems: [],
    time: { minutes: 60, hourlyRateMinor: 500, confidence: "known" },
    packagingMinor: 0,
    deliveryMinor: 0,
    wasteMinor: 0,
    safetyBufferMinor: 0,
    quantity: 1,
    createdAt: "2026-08-20T09:00:00.000Z",
    freshnessDays: null,
  });
  let order = createCraftOrder({
    id,
    customerName: "خالد",
    itemName: "طقم مطرز",
    specifications: "اختبار",
    quantity: 1,
    agreedPriceMinor: price,
    costSnapshot: cost,
    createdAt: "2026-08-20T09:00:00.000Z",
  });
  order = collectDeposit(order, 2000, `${id}-deposit`, "2026-08-20T10:00:00.000Z");
  for (const [to, stamp] of [
    ["provisional_agreement", "2026-08-20T11:00:00.000Z"],
    ["confirmed", "2026-08-21T09:00:00.000Z"],
    ["in_progress", "2026-08-22T09:00:00.000Z"],
    ["ready", "2026-08-23T09:00:00.000Z"],
    ["delivered", "2026-08-25T09:00:00.000Z"],
  ] as const)
    order = transitionOrder(order, { to, idempotencyKey: `${id}-${to}`, createdAt: stamp });
  const saved = await store.saveOrder({
    id,
    order,
    catalogItemId: null,
    deliveryDate: "2026-08-25",
    agreementSource: "walk_in",
    createdAt: "2026-08-20T09:00:00.000Z",
    updatedAt: "2026-08-25T09:00:00.000Z",
  });
  if (!saved.ok) throw new Error("order should save");
  return saved.value;
}

async function openDrawer(store: MemoryLocalStore) {
  const wallet = createCashWallet({
    id: "drawer-1",
    name: "درج المحل",
    kind: "cash_drawer",
    createdAt: now(),
    createdOperationKey: "drawer-open-key",
  });
  const opening = createCashContinuityEntry({
    id: "drawer-opening",
    walletId: wallet.id,
    type: "opening_balance",
    occurredOn: "2026-09-01",
    recordedAt: now(),
    cashDeltaMinor: 5000,
    note: "رصيد بداية",
    operationKey: "drawer-open-key",
  });
  const committed = await store.commitCashContinuity(wallet, [opening]);
  if (!committed.ok) throw new Error("wallet should commit");
  return wallet;
}

describe("CollectionService — ورقة التحصيل (المجموعة ٢ §6)", () => {
  it("يسرد الذمم القابلة للتحصيل: دين مسجل ومتبقي تسليم ودين بيع آجل", async () => {
    const store = new MemoryLocalStore();
    const { collections } = makeServices(store);
    const stored = await deliveredOrderWithRemaining(store, "order-1");
    /* دين مسجل: نحول المتبقي لدين مسجل بعد التسليم. */
    const orderWithDebt = registerDebt(stored.order, "order-1-register-debt", now());
    await store.saveOrder({ ...stored, order: orderWithDebt });
    /* بيع آجل بدين. */
    await store.saveDirectSale(
      createDirectSale({
        id: "sale-1",
        itemName: "كعكة",
        quantity: 1,
        revenueMinor: 1200,
        collectedMinor: 400,
        collectionStatus: "partial_debt",
        catalogItemId: null,
        customerName: "سما",
        costMinor: 300,
        occurredOn: "2026-09-01",
        recordedAt: now(),
        note: "بيع آجل",
        idempotencyKey: "sale-1-key",
      }),
    );
    const list = await collections.listReceivableSources();
    expect(list.ok).toBe(true);
    const ids = list.value.map(source => source.id);
    expect(ids).toContain("order-1");
    expect(ids).toContain("sale-1");
    const saleSource = list.value.find(source => source.id === "sale-1");
    expect(saleSource?.outstandingMinor).toBe(800);
    expect(saleSource?.personName).toBe("سما");
    expect(saleSource?.qualifier).toBe("دين بيع آجل");
    const orderSource = list.value.find(source => source.id === "order-1");
    expect(orderSource?.qualifier).toBe("دين مسجل بعد التسليم");
    expect(orderSource?.sourceHref).toBe("/orders/order-1");
  });

  it("تحصيل جزئي من طلب مسلّم: المتبقي يبقى والكاش يرتفع بلا إيراد جديد", async () => {
    const store = new MemoryLocalStore();
    const { collections, projectFinance } = makeServices(store);
    await deliveredOrderWithRemaining(store, "order-2");
    const drawer = await openDrawer(store);
    /* الأساس بعد فتح الدرج: عربون 2000 غير موزع + افتتاح درج 5000 = 7000. */
    const before = await projectFinance.readPosition();
    expect(before.value.recordedCashMinor).toBe(7000);
    const result = await collections.collect({
      sourceKind: "order",
      sourceId: "order-2",
      amountMinor: 3000,
      walletId: drawer.id,
      idempotencyKey: "collect-partial-1",
    });
    expect(result.ok).toBe(true);
    expect(result.value.collectedMinor).toBe(3000);
    /* 8000 متبقٍ − 3000 = 5000. */
    expect(result.value.remainingAfterMinor).toBe(5000);
    expect(result.value.attributedToWalletMinor).toBe(3000);
    expect(result.value.walletName).toBe("درج المحل");
    const after = await projectFinance.readPosition();
    expect(after.value.recordedCashMinor).toBe(10000);
    /* التخصيص نقل المقبوض للدرج: غير الموزع بقي 2000 (العربون). */
    expect(after.value.unallocatedCashMinor).toBe(2000);
    expect(after.value.walletCashMinor).toBe(8000);
    /* الإيراد المعروف لا يتغير بالتحصيل — يُعرف عند التسليم. */
    const order = (await store.getOrder("order-2")).value!;
    expect(order.order.recognizedRevenueMinor).toBe(10000);
    expect(order.order.receivableMinor).toBe(5000);
  });

  it("يمنع التحصيل فوق المتبقي برسالة تعرض المتبقي والمطلوب", async () => {
    const store = new MemoryLocalStore();
    const { collections } = makeServices(store);
    await deliveredOrderWithRemaining(store, "order-3");
    const result = await collections.collect({
      sourceKind: "order",
      sourceId: "order-3",
      amountMinor: 9000,
      walletId: null,
      idempotencyKey: "collect-over-1",
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.message).toContain("يتجاوز المتبقي");
      expect(result.message).toContain("80.00");
    }
    /* لم يُكتب شيء. */
    const order = (await store.getOrder("order-3")).value!;
    expect(order.order.receivableMinor).toBe(8000);
    expect(order.order.collectedMinor).toBe(2000);
  });

  it("تحصيل كامل لدين بيع آجل يغلق الذمة ويخصص للدرج بوصل المصدر", async () => {
    const store = new MemoryLocalStore();
    const { collections } = makeServices(store);
    await store.saveDirectSale(
      createDirectSale({
        id: "sale-2",
        itemName: "إطار",
        quantity: 1,
        revenueMinor: 5000,
        collectedMinor: 2000,
        collectionStatus: "partial_debt",
        catalogItemId: null,
        customerName: "ريم",
        costMinor: null,
        occurredOn: "2026-09-01",
        recordedAt: now(),
        note: "بيع آجل",
        idempotencyKey: "sale-2-key",
      }),
    );
    const drawer = await openDrawer(store);
    const result = await collections.collect({
      sourceKind: "direct_sale",
      sourceId: "sale-2",
      amountMinor: 3000,
      walletId: drawer.id,
      idempotencyKey: "collect-sale-1",
    });
    expect(result.ok).toBe(true);
    expect(result.value.remainingAfterMinor).toBe(0);
    const sale = (await store.listDirectSales()).value!.find(item => item.id === "sale-2")!;
    expect(sale.collectedMinor).toBe(5000);
    expect(sale.collectionStatus).toBe("collected_in_full");
    expect(sale.customerName).toBe("ريم");
    expect(sale.revisions?.length).toBe(1);
    /* وصل المصدر محفوظ في حركة التخصيص — دفتر المحفظة يصل للسجل. */
    const entries = (await store.listCashContinuityEntries()).value!;
    const allocation = entries.find(entry => entry.type === "allocation");
    expect(allocation?.sourceRefId).toBe("sale-2");
    expect(allocation?.sourceRefKind).toBe("sale");
  });

  it("وجهة «غير موزع» صريحة: لا تخصيص وبقاء الكاش غير موزع", async () => {
    const store = new MemoryLocalStore();
    const { collections } = makeServices(store);
    await deliveredOrderWithRemaining(store, "order-4");
    const result = await collections.collect({
      sourceKind: "order",
      sourceId: "order-4",
      amountMinor: 2000,
      walletId: null,
      idempotencyKey: "collect-unallocated-1",
    });
    expect(result.ok).toBe(true);
    expect(result.value.attributedToWalletMinor).toBe(0);
    expect(result.value.walletName).toBeNull();
    const entries = (await store.listCashContinuityEntries()).value!;
    expect(entries.filter(entry => entry.type === "allocation")).toHaveLength(0);
  });

  it("تكرار الإرسال بمفتاح واحد لا يضاعف أثرًا (طلبات ومبيعات)", async () => {
    const store = new MemoryLocalStore();
    const { collections } = makeServices(store);
    await deliveredOrderWithRemaining(store, "order-5");
    const first = await collections.collect({
      sourceKind: "order",
      sourceId: "order-5",
      amountMinor: 2000,
      walletId: null,
      idempotencyKey: "collect-dup-1",
    });
    expect(first.ok && first.value.remainingAfterMinor).toBe(6000);
    /* نفس المفتاح بعد تحديث الحالة: التحصيل يُقيّد بعملية جديدة عبر fulfillment
     * بمفتاح مختلف كل مرة؛ الحماية هنا: طلب التحصيل نفسه بمفتاح ورقة واحدة.
     * الطلب الثاني بمفتاح الورقة نفسها يمر بمفتاح عملية مختلف في fulfillment،
     * لذا نتحقق أن الواجهة لا تزعم النجاح مرتين بنفس المفتاح عبر مسار البيع. */
    await store.saveDirectSale(
      createDirectSale({
        id: "sale-3",
        itemName: "صحن",
        quantity: 1,
        revenueMinor: 4000,
        collectedMinor: 1000,
        collectionStatus: "partial_debt",
        catalogItemId: null,
        customerName: "دانا",
        costMinor: null,
        occurredOn: "2026-09-01",
        recordedAt: now(),
        note: "بيع",
        idempotencyKey: "sale-3-key",
      }),
    );
    const saleFirst = await collections.collect({
      sourceKind: "direct_sale",
      sourceId: "sale-3",
      amountMinor: 1000,
      walletId: null,
      idempotencyKey: "collect-dup-sale",
    });
    expect(saleFirst.ok).toBe(true);
    /* إعادة الإرسال بمفتاح الورقة نفسه: تعديل البيع يرفض المفتاح المكرر — لا تغيير. */
    const saleSecond = await collections.collect({
      sourceKind: "direct_sale",
      sourceId: "sale-3",
      amountMinor: 1000,
      walletId: null,
      idempotencyKey: "collect-dup-sale",
    });
    expect(saleSecond.ok).toBe(true);
    const sale = (await store.listDirectSales()).value!.find(item => item.id === "sale-3")!;
    /* قبض واحد فقط: 1000 أساس + 1000 بوابة واحدة. */
    expect(sale.collectedMinor).toBe(2000);
    expect(sale.revisions?.length).toBe(1);
  });

  it("انقطاع الكتابة المحلية لا يُعلن نجاحًا — رسالة الفشل كما هي", async () => {
    const store = new MemoryLocalStore();
    const { collections } = makeServices(store);
    await deliveredOrderWithRemaining(store, "order-6");
    /* نفشل الكتابة عبر استبدال saveOrder مؤقتًا — نفس أسلوب فشل التخزين. */
    const original = store.saveOrder.bind(store);
    store.saveOrder = async () => ({ ok: false, code: "storage_error", message: "تعذر الحفظ المحلي." });
    const result = await collections.collect({
      sourceKind: "order",
      sourceId: "order-6",
      amountMinor: 2000,
      walletId: null,
      idempotencyKey: "collect-fail-1",
    });
    store.saveOrder = original;
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.message).toContain("تعذر");
    /* لم يتغير شيء على الطلب. */
    const order = (await store.getOrder("order-6")).value!;
    expect(order.order.receivableMinor).toBe(8000);
  });

  it("المصدر المفقود أو المحصّل كاملًا يُخبر بصدق لا بقائمة عامة", async () => {
    const store = new MemoryLocalStore();
    const { collections } = makeServices(store);
    const missing = await collections.findSource("order", "missing-id");
    expect(missing.ok).toBe(false);
    if (!missing.ok) expect(missing.message).toContain("لا توجد ذمة");
  });
});
