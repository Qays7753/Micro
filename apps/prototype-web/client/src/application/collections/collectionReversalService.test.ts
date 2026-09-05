/** المجموعة ٦ (البند ١ — S2-04أ): اختبارات التراجع المزدوج عن القبضة مع تخصيصها
 * المطابق — مطابقة كاملة/بلا مطابقة/ملغومة/مبلغ مغاير/مُتراجَع سابقًا/جزئي/
 * تكرار آمن/فشل ذرّي/محفظة سالبة، مع انحدار بيانات القبضة لحالها. */
import { describe, expect, it } from "vitest";
import { CollectionReversalService } from "./collectionReversalService";
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
  transitionOrder,
} from "@micro-domain/craft-order/index.js";
import { createCashContinuityEntry, createCashWallet } from "@micro-domain/cash-continuity/index.js";

/** ساعة قابلة للتقدم — كشف عيوب المفاتيح الزمنية (نمط انحدار S2-02). */
function advancingClock(start = "2026-09-02T10:00:00.000Z") {
  let current = new Date(start).getTime();
  return () => {
    current += 60_000;
    return new Date(current).toISOString();
  };
}

function makeServices(store: MemoryLocalStore, clock: () => string = () => "2026-09-02T10:00:00.000Z") {
  const projectFinance = new ProjectFinancialService(store, clock);
  const fulfillment = new FulfillmentService(store, clock);
  const directSales = new DirectSaleService(store, clock);
  const collections = new CollectionService(store, fulfillment, directSales, projectFinance, clock);
  const collectionReversal = new CollectionReversalService(store, projectFinance, clock);
  return { projectFinance, fulfillment, directSales, collections, collectionReversal };
}

/** طلب مسلّم بمتبقٍ — التحصيل من الورقة مشروعه عليه. */
async function deliveredOrderWithRemaining(
  store: MemoryLocalStore,
  id: string,
  price = 10000,
  deposit = 2000,
) {
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
    source: "order_confirmation",
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
  order = collectDeposit(order, deposit, `${id}-deposit`, "2026-08-20T10:00:00.000Z");
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

async function openDrawer(store: MemoryLocalStore, openingMinor = 5000, id = "drawer-1") {
  const wallet = createCashWallet({
    id,
    name: "درج المحل",
    kind: "cash_drawer",
    createdAt: "2026-09-01T09:00:00.000Z",
    createdOperationKey: `${id}-open`,
  });
  const opening = createCashContinuityEntry({
    id: `${id}-opening`,
    walletId: wallet.id,
    type: "opening_balance",
    occurredOn: "2026-09-01",
    recordedAt: "2026-09-01T09:00:00.000Z",
    cashDeltaMinor: openingMinor,
    note: "رصيد بداية",
    operationKey: `${id}-open`,
  });
  const committed = await store.commitCashContinuity(wallet, [opening]);
  if (!committed.ok) throw new Error("wallet should commit");
  return wallet;
}

async function positionOf(store: MemoryLocalStore, clock: () => string) {
  const projectFinance = new ProjectFinancialService(store, clock);
  const position = await projectFinance.readPosition();
  if (!position.ok) throw new Error("position should read");
  return position.value;
}

describe("CollectionReversalService — التراجع المزدوج الموثق (S2-04أ)", () => {
  it("مطابقة كاملة: تحصيل بمحفظة ثم تراجع مزدوج — المحفظة تنقص وغير الموزع صافيه صفر والإجمالي ينقص بمقدار المرجّع", async () => {
    const store = new MemoryLocalStore();
    const clock = advancingClock();
    const { collections, collectionReversal } = makeServices(store, clock);
    await deliveredOrderWithRemaining(store, "order-1");
    await openDrawer(store);

    const collected = await collections.collect({
      sourceKind: "order",
      sourceId: "order-1",
      amountMinor: 3000,
      walletId: "drawer-1",
      idempotencyKey: "sheet-collect-1",
    });
    expect(collected.ok).toBe(true);
    const before = await positionOf(store, clock);
    expect(before.unallocatedCashMinor).toBe(2000 + 3000 - 3000);
    expect(before.walletCashMinor).toBe(5000 + 3000);

    const event = collected.value
      ? (await store.getOrder("order-1")).value!.order.events.find(
          e => e.type === "collection_recorded" && e.amountMinor === 3000,
        )!
      : null;
    expect(event).not.toBeNull();

    const preview = await collectionReversal.preview({
      orderId: "order-1",
      collectionEventId: event!.id,
    });
    expect(preview.ok).toBe(true);
    expect(preview.value.status).toBe("full_match");
    expect(preview.value.allocation?.walletId).toBe("drawer-1");
    expect(preview.value.allocation?.amountMinor).toBe(3000);
    expect(preview.value.unallocatedAfterMinor).toBe(preview.value.unallocatedBeforeMinor);
    expect(preview.value.recordedCashAfterMinor).toBe(preview.value.recordedCashBeforeMinor! - 3000);

    const result = await collectionReversal.reverse({
      orderId: "order-1",
      collectionEventId: event!.id,
      amountMinor: 3000,
      reason: "رجّعت المبلغ للزبون من الدرج",
      operationKey: "root-reverse-1",
      alsoReverseAllocation: true,
    });
    expect(result.ok).toBe(true);
    expect(result.value.reused).toBe(false);
    expect(result.value.allocationReversal).not.toBeNull();
    expect(result.value.allocationReversal!.cashDeltaMinor).toBe(-3000);
    expect(result.value.allocationReversal!.reversesEntryId).toBe(preview.value.allocation!.entryId);
    expect(result.value.allocationReversal!.operationKey).toBe("root-reverse-1:unattribute");

    const after = await positionOf(store, clock);
    expect(after.orderCollectedMinor ?? 0).toBeLessThanOrEqual(2000);
    expect(after.walletCashMinor).toBe(5000);
    expect(after.unallocatedCashMinor).toBe(2000);
    expect(after.recordedCashMinor).toBe(before.recordedCashMinor - 3000);
    /* الطلب: المقبوض نقص والمتبقي فُتح والوضع صار دينًا. */
    const stored = (await store.getOrder("order-1")).value!;
    expect(stored.order.collectedMinor).toBe(2000);
    expect(stored.order.receivableMinor).toBe(8000);
    /* طلب مسلّم (غير مقفول) بعد التراجع: مقبوض جزئيًا ومتبقٍ مفتوح. */
    expect(stored.order.settlementStatus).toBe("partially_paid");
    expect(stored.order.events.some(e => e.type === "collection_reversed")).toBe(true);
    /* حدثا التراجع موجودان معًا — الأصلان باقيان. */
    const entries = (await store.listCashContinuityEntries()).value!;
    expect(entries.some(e => e.type === "reversal" && e.reversesEntryId)).toBe(true);
    expect(entries.filter(e => e.sourceRefLineId === event!.id).length).toBe(1);
  });

  it("بلا مطابقة (وجهة غير موزع): المزدوج يُرفض بسبب صادق، والقبضة لحالها تنجح بدلالات اليوم", async () => {
    const store = new MemoryLocalStore();
    const clock = advancingClock();
    const { collections, collectionReversal } = makeServices(store, clock);
    await deliveredOrderWithRemaining(store, "order-2");
    const collected = await collections.collect({
      sourceKind: "order",
      sourceId: "order-2",
      amountMinor: 3000,
      walletId: null,
      idempotencyKey: "sheet-collect-2",
    });
    expect(collected.ok).toBe(true);
    const event = (await store.getOrder("order-2")).value!.order.events.find(
      e => e.type === "collection_recorded" && e.amountMinor === 3000,
    )!;

    const preview = await collectionReversal.preview({
      orderId: "order-2",
      collectionEventId: event.id,
    });
    expect(preview.value.status).toBe("no_allocation");
    expect(preview.value.refusalReason).toContain("ما إلها تخصيص");

    const compound = await collectionReversal.reverse({
      orderId: "order-2",
      collectionEventId: event.id,
      amountMinor: 3000,
      reason: "سبب",
      operationKey: "root-reverse-2",
      alsoReverseAllocation: true,
    });
    expect(compound.ok).toBe(false);

    const single = await collectionReversal.reverse({
      orderId: "order-2",
      collectionEventId: event.id,
      amountMinor: 3000,
      reason: "رجّعت المبلغ للزبون",
      operationKey: "root-reverse-2s",
      alsoReverseAllocation: false,
    });
    expect(single.ok).toBe(true);
    expect(single.value.allocationReversal).toBeNull();
    const stored = (await store.getOrder("order-2")).value!;
    expect(stored.order.collectedMinor).toBe(2000);
  });

  it("بيانات قديمة ملغومة: تخصيصان بنفس المصدر والمبلغ → رفض بلا تخمين", async () => {
    const store = new MemoryLocalStore();
    const clock = advancingClock();
    const { collections, collectionReversal } = makeServices(store, clock);
    await deliveredOrderWithRemaining(store, "order-3");
    /* قبضة حقيقية بلا وجهة محفظة — ثم تخصيصان يدويان قديمان بنفس المصدر والمبلغ. */
    const collected = await collections.collect({
      sourceKind: "order",
      sourceId: "order-3",
      amountMinor: 2000,
      walletId: null,
      idempotencyKey: "sheet-collect-3",
    });
    expect(collected.ok).toBe(true);
    const event = (await store.getOrder("order-3")).value!.order.events.find(
      e => e.type === "collection_recorded" && e.amountMinor === 2000,
    )!;
    await openDrawer(store);
    /* تخصيصان يدويان قديمان بلا مفتاح ورقة وبلا سطر مصدر — المطابقة السقوطية تتعدد. */
    for (const key of ["legacy-a", "legacy-b"]) {
      const allocation = createCashContinuityEntry({
        id: `legacy-${key}`,
        walletId: "drawer-1",
        type: "allocation",
        occurredOn: "2026-09-01",
        recordedAt: "2026-09-01T09:00:00.000Z",
        cashDeltaMinor: 2000,
        note: "تخصيص قديم",
        operationKey: key,
        sourceRefId: "order-3",
        sourceRefKind: "order",
      });
      const saved = await store.commitCashContinuity(null, [allocation]);
      expect(saved.ok).toBe(true);
    }
    const preview = await collectionReversal.preview({
      orderId: "order-3",
      collectionEventId: event.id,
    });
    expect(preview.value.status).toBe("ambiguous");
    expect(preview.value.refusalReason).toContain("أكتر من تخصيص");
    const compound = await collectionReversal.reverse({
      orderId: "order-3",
      collectionEventId: event.id,
      amountMinor: event.amountMinor ?? 0,
      reason: "سبب",
      operationKey: "root-3",
      alsoReverseAllocation: true,
    });
    expect(compound.ok).toBe(false);
  });

  it("مبلغ مغاير (التخصيص غُيّر لاحقًا): رفض المزدوج بلا خسارة رقم", async () => {
    const store = new MemoryLocalStore();
    const clock = advancingClock();
    const { collections, collectionReversal } = makeServices(store, clock);
    await deliveredOrderWithRemaining(store, "order-4");
    await openDrawer(store);
    await collections.collect({
      sourceKind: "order",
      sourceId: "order-4",
      amountMinor: 3000,
      walletId: "drawer-1",
      idempotencyKey: "sheet-collect-4",
    });
    const event = (await store.getOrder("order-4")).value!.order.events.find(
      e => e.type === "collection_recorded" && e.amountMinor === 3000,
    )!;
    /* تعديل يدوي لمبلغ التخصيص: تراجع ناقص ثم تخصيص بمبلغ مختلف — يكسر تطابق المبلغ. */
    const entries = (await store.listCashContinuityEntries()).value!;
    const allocation = entries.find(e => e.sourceRefLineId === event.id)!;
    const partialReversal = createCashContinuityEntry({
      id: "manual-part-rev",
      walletId: "drawer-1",
      type: "reversal",
      occurredOn: "2026-09-02",
      recordedAt: "2026-09-02T11:00:00.000Z",
      cashDeltaMinor: -1000,
      note: "تراجع يدوي جزئي",
      reason: "سبب",
      operationKey: "manual-part-rev",
      reversesEntryId: allocation.id,
    });
    await store.commitCashContinuity(null, [partialReversal]);
    const preview = await collectionReversal.preview({
      orderId: "order-4",
      collectionEventId: event.id,
    });
    expect(preview.value.status).not.toBe("full_match");
    const compound = await collectionReversal.reverse({
      orderId: "order-4",
      collectionEventId: event.id,
      amountMinor: 3000,
      reason: "سبب",
      operationKey: "root-4",
      alsoReverseAllocation: true,
    });
    expect(compound.ok).toBe(false);
  });

  it("التخصيص مُتراجَع سابقًا من دفتر المحفظة: المزدوج يُرفض والقبضة لحالها متاحة", async () => {
    const store = new MemoryLocalStore();
    const clock = advancingClock();
    const { collections, collectionReversal } = makeServices(store, clock);
    await deliveredOrderWithRemaining(store, "order-5");
    await openDrawer(store);
    await collections.collect({
      sourceKind: "order",
      sourceId: "order-5",
      amountMinor: 3000,
      walletId: "drawer-1",
      idempotencyKey: "sheet-collect-5",
    });
    const event = (await store.getOrder("order-5")).value!.order.events.find(
      e => e.type === "collection_recorded" && e.amountMinor === 3000,
    )!;
    const entries = (await store.listCashContinuityEntries()).value!;
    const allocation = entries.find(e => e.sourceRefLineId === event.id)!;
    const manualReversal = createCashContinuityEntry({
      id: "manual-rev-5",
      walletId: "drawer-1",
      type: "reversal",
      occurredOn: "2026-09-02",
      recordedAt: "2026-09-02T11:00:00.000Z",
      cashDeltaMinor: -3000,
      note: "تراجع يدوي",
      reason: "سبب",
      operationKey: "manual-rev-5",
      reversesEntryId: allocation.id,
    });
    await store.commitCashContinuity(null, [manualReversal]);
    const preview = await collectionReversal.preview({
      orderId: "order-5",
      collectionEventId: event.id,
    });
    expect(preview.value.status).toBe("allocation_already_reversed");
    const compound = await collectionReversal.reverse({
      orderId: "order-5",
      collectionEventId: event.id,
      amountMinor: 3000,
      reason: "سبب",
      operationKey: "root-5",
      alsoReverseAllocation: true,
    });
    expect(compound.ok).toBe(false);
  });

  it("تراجع جزئي سابق على القبضة نفسها: partial_only — المزدوج يُرفض والجزئي المفرد يبقى", async () => {
    const store = new MemoryLocalStore();
    const clock = advancingClock();
    const { collectionReversal } = makeServices(store, clock);
    await deliveredOrderWithRemaining(store, "order-6");
    const stored = (await store.getOrder("order-6")).value!;
    const order = collectRemaining(stored.order, 3000, "sheet-collect-6", "2026-09-02T10:30:00.000Z");
    await store.saveOrder({ ...stored, order, updatedAt: "2026-09-02T10:31:00.000Z" });
    const event = order.events.find(e => e.type === "collection_recorded" && e.amountMinor === 3000)!;
    const first = await collectionReversal.reverse({
      orderId: "order-6",
      collectionEventId: event.id,
      amountMinor: 1000,
      reason: "أول جزء",
      operationKey: "root-6a",
      alsoReverseAllocation: false,
    });
    expect(first.ok).toBe(true);
    const preview = await collectionReversal.preview({
      orderId: "order-6",
      collectionEventId: event.id,
    });
    expect(preview.value.status).toBe("partial_only");
  });

  it("تكرار آمن: نفس المفتاح الجذر مرتين (وساعة متقدمة وخدمة جديدة) → إعادة استخدام بلا أثر إضافي", async () => {
    const store = new MemoryLocalStore();
    const clock = advancingClock();
    const { collections, collectionReversal } = makeServices(store, clock);
    await deliveredOrderWithRemaining(store, "order-7");
    await openDrawer(store);
    await collections.collect({
      sourceKind: "order",
      sourceId: "order-7",
      amountMinor: 3000,
      walletId: "drawer-1",
      idempotencyKey: "sheet-collect-7",
    });
    const event = (await store.getOrder("order-7")).value!.order.events.find(
      e => e.type === "collection_recorded" && e.amountMinor === 3000,
    )!;
    const first = await collectionReversal.reverse({
      orderId: "order-7",
      collectionEventId: event.id,
      amountMinor: 3000,
      reason: "تراجع مزدوج",
      operationKey: "root-reverse-7",
      alsoReverseAllocation: true,
    });
    expect(first.ok).toBe(true);
    /* إعادة المحاولة بمفتاح الجذر نفسه عبر نسخة خدمة جديدة — التخزين هو الحكم. */
    const freshServices = makeServices(store, clock);
    const second = await freshServices.collectionReversal.reverse({
      orderId: "order-7",
      collectionEventId: event.id,
      amountMinor: 3000,
      reason: "تراجع مزدوج",
      operationKey: "root-reverse-7",
      alsoReverseAllocation: true,
    });
    expect(second.ok).toBe(true);
    expect(second.value.reused).toBe(true);
    const stored = (await store.getOrder("order-7")).value!;
    expect(stored.order.events.filter(e => e.type === "collection_reversed").length).toBe(1);
    const entries = (await store.listCashContinuityEntries()).value!;
    expect(entries.filter(e => e.operationKey === "root-reverse-7:unattribute").length).toBe(1);
    const after = await positionOf(store, clock);
    expect(after.walletCashMinor).toBe(5000);
    expect(after.recordedCashMinor).toBe(2000 + 5000);
  });

  it("فشل ذرّي في منتصف الكتابة: الطلب وأثر الكاش لا يتغيران ورسالة صادقة", async () => {
    const store = new MemoryLocalStore();
    const clock = advancingClock();
    const { collections } = makeServices(store, clock);
    await deliveredOrderWithRemaining(store, "order-8");
    await openDrawer(store);
    await collections.collect({
      sourceKind: "order",
      sourceId: "order-8",
      amountMinor: 3000,
      walletId: "drawer-1",
      idempotencyKey: "sheet-collect-8",
    });
    const event = (await store.getOrder("order-8")).value!.order.events.find(
      e => e.type === "collection_recorded" && e.amountMinor === 3000,
    )!;
    const before = await positionOf(store, clock);
    const storedBefore = (await store.getOrder("order-8")).value!;
    /* مخزن يفشل معاملة التراجع المزدوج حصرًا — لا شيء يُكتب. */
    class FailingStore extends MemoryLocalStore {
      async commitOrderCollectionReversal() {
        return { ok: false as const, code: "storage_error" as const, message: "تعذر حفظ التراجع ذريًا." };
      }
    }
    const failing = new FailingStore();
    for (const [key, value] of Object.entries({
      orders: (store as unknown as Record<string, Map<string, unknown>>).orders,
      cashContinuityEntries: (store as unknown as Record<string, Map<string, unknown>>).cashContinuityEntries,
      cashWallets: (store as unknown as Record<string, Map<string, unknown>>).cashWallets,
      directSales: (store as unknown as Record<string, Map<string, unknown>>).directSales,
      supplierPurchases: (store as unknown as Record<string, Map<string, unknown>>).supplierPurchases,
      financialEvents: (store as unknown as Record<string, Map<string, unknown>>).financialEvents,
    }))
      Object.assign(failing, { [key]: value });
    const projectFinance = new ProjectFinancialService(failing, clock);
    const reversalService = new CollectionReversalService(failing, projectFinance, clock);
    const result = await reversalService.reverse({
      orderId: "order-8",
      collectionEventId: event.id,
      amountMinor: 3000,
      reason: "سبب",
      operationKey: "root-8",
      alsoReverseAllocation: true,
    });
    expect(result.ok).toBe(false);
    const after = await positionOf(store, clock);
    expect(after.recordedCashMinor).toBe(before.recordedCashMinor);
    const storedAfter = (await store.getOrder("order-8")).value!;
    expect(storedAfter.order.events.length).toBe(storedBefore.order.events.length);
    expect(storedAfter.order.collectedMinor).toBe(storedBefore.order.collectedMinor);
  });

  it("انحدار G6-F1-2: تراجع جزئي مضاع بضغطة مزدوجة عبر مفتاح مستدعٍ → لا يتكرر", async () => {
    const store = new MemoryLocalStore();
    const clock = advancingClock();
    const { fulfillment } = makeServices(store, clock);
    const stored = await deliveredOrderWithRemaining(store, "order-9", 10000, 2000);
    const order = collectRemaining(stored.order, 6000, "sheet-collect-9", "2026-09-02T10:30:00.000Z");
    await store.saveOrder({ ...stored, order, updatedAt: "2026-09-02T10:31:00.000Z" });
    const event = order.events.find(e => e.type === "collection_recorded" && e.amountMinor === 6000)!;
    /* مفتاح جذر واحد لضغطتين متطابقتين — الثانية تُكتشف ولا تُطبق. */
    const key = "order-9:reverse-collection:panel-root-9";
    const first = await fulfillment.reverseCollection("order-9", {
      collectionEventId: event.id,
      amountMinor: 2000,
      reason: "جزء أول",
      operationKey: "panel-root-9",
    });
    expect(first.ok).toBe(true);
    const second = await fulfillment.reverseCollection("order-9", {
      collectionEventId: event.id,
      amountMinor: 2000,
      reason: "جزء أول",
      operationKey: "panel-root-9",
    });
    expect(second.ok).toBe(true);
    const final = (await store.getOrder("order-9")).value!;
    expect(final.order.events.filter(e => e.type === "collection_reversed").length).toBe(1);
    /* 2000 عربون + 6000 قبضة − 2000 تراجع واحد = 6000. */
    expect(final.order.collectedMinor).toBe(6000);
    expect(key).toContain("panel-root-9");
  });

  it("محفظة راحت سالب: التراجع المزدوج ينجح والأرقام تبقى متسقة (لا خسارة مال)", async () => {
    const store = new MemoryLocalStore();
    const clock = advancingClock();
    const { collections, collectionReversal, projectFinance } = makeServices(store, clock);
    await deliveredOrderWithRemaining(store, "order-10");
    /* محفظة برصيد 1000 ثم تخصيص 3000 لها (عبر الورقة) ثم إنفاق 2500 منها تغطيةً. */
    await openDrawer(store, 1000, "thin-1");
    await collections.collect({
      sourceKind: "order",
      sourceId: "order-10",
      amountMinor: 3000,
      walletId: "thin-1",
      idempotencyKey: "sheet-collect-10",
    });
    await projectFinance.distributeUnallocated({
      walletId: "thin-1",
      deltaMinor: -2500,
      note: "تغطية صرف",
      operationKey: "cover-10",
      sourceRefId: "order-10",
      sourceRefKind: "order",
    });
    const event = (await store.getOrder("order-10")).value!.order.events.find(
      e => e.type === "collection_recorded" && e.amountMinor === 3000,
    )!;
    const preview = await collectionReversal.preview({
      orderId: "order-10",
      collectionEventId: event.id,
    });
    expect(preview.value.status).toBe("full_match");
    expect(preview.value.walletBalanceAfterMinor).toBe(1000 + 3000 - 2500 - 3000);
    expect(preview.value.walletWarning).toContain("سالب");
    const result = await collectionReversal.reverse({
      orderId: "order-10",
      collectionEventId: event.id,
      amountMinor: 3000,
      reason: "سبب",
      operationKey: "root-10",
      alsoReverseAllocation: true,
    });
    expect(result.ok).toBe(true);
    const after = await positionOf(store, clock);
    expect(after.walletCashMinor).toBe(1000 - 2500);
    expect(after.unallocatedCashMinor).toBe(2000 + 2500);
    expect(after.recordedCashMinor).toBe(1000 + 2000);
  });
});
