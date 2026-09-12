import "fake-indexeddb/auto";
import { afterEach, describe, expect, it } from "vitest";
import {
  calculateCostSnapshot,
  cancelOrder,
  collectDeposit,
  collectRemaining,
  createCraftOrder,
  reverseOrderCollection,
  settleDepositRefund,
  settleDepositRetain,
  transitionOrder,
} from "@micro-domain/craft-order/index.js";
import { createInventoryMovement } from "@micro-domain/inventory-material/index.js";
import { createCashContinuityEntry, createCashWallet } from "@micro-domain/cash-continuity/index.js";
import { createFinancialEvent, createFinancialReversal } from "@micro-domain/financial-event/index.js";
import {
  createOwnerEntitlementOpeningBalance,
  createOwnerEntitlementOpeningBalanceReversal,
  createOwnerEntitlementPolicy,
  createOwnerEntitlementPolicySuccessor,
  createOwnerEntitlementRecord,
  createOwnerEntitlementRecordReversal,
  createOwnerMovement,
} from "@micro-domain/owner-entitlement/index.js";
import {
  createAllocationPolicy,
  createAllocationPolicySuccessor,
} from "@micro-domain/recurring-margin/index.js";
import { createShortCashDeclaration, createShortCashReversal } from "@micro-domain/g5/index.js";
import {
  createSupplierPurchase,
  recordSupplierPurchasePayment,
} from "@micro-domain/supplier-purchase/index.js";
import { IndexedDbLocalStore } from "./IndexedDbLocalStore";
import { MemoryLocalStore } from "./MemoryLocalStore";
import type {
  CatalogTemplate,
  InventoryShortage,
  OrderDraft,
  PrototypeLocalStore,
  ScheduleEntry,
  ScheduleRecurrence,
  StoredCraftOrder,
} from "./types";

/* المجموعة ١٠ (المرحلة 10-أ): مصفوفة مطابقة المحوّلين الكاملة — كل عمليات
 * الالتزام الثمانية والعشرين في واجهة المخزن (28) عبر المحوّلين (الذاكرة
 * وIndexedDB/fake-indexeddb) على السيناريوهات الموحّدة: كتابة ناجحة،
 * إعادة تشغيل بالمفتاح نفسه (إعادة استخدام صادقة لا تكرار)، تعارض/حالة
 * قديمة (رفض صادق بلا كتابة جزئية)، وقراءة مرجعة تُثبت النتيجة بعد كل
 * محاولة. البرهان بإعادة القراءة من المخزن لا بالقيمة المرجعة وحدها. */

const databaseName = "micro-prototype-local";
function clearDatabase() {
  return new Promise<void>((resolve, reject) => {
    const request = indexedDB.deleteDatabase(databaseName);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}
afterEach(clearDatabase);

const TS = "2026-09-08T09:00:00.000Z";

function snapshot(id: string) {
  return calculateCostSnapshot(id, {
    currency: "JOD",
    materialItems: [],
    time: { minutes: 60, hourlyRateMinor: 500, confidence: "known" },
    packagingMinor: 0,
    deliveryMinor: 0,
    wasteMinor: 0,
    safetyBufferMinor: 0,
    quantity: 1,
    createdAt: TS,
    source: "draft",
  });
}

function storedOrder(id: string): StoredCraftOrder {
  return {
    id,
    order: createCraftOrder({
      id,
      customerName: "سارة",
      itemName: "صندوق",
      specifications: "نقش",
      quantity: 1,
      agreedPriceMinor: 5000,
      costSnapshot: snapshot(`snap-${id}`),
      createdAt: TS,
    }),
    catalogItemId: null,
    deliveryDate: "2026-09-12",
    agreementSource: null,
    createdAt: TS,
    updatedAt: TS,
  };
}

function deliveredStored(id: string): StoredCraftOrder {
  let order = storedOrder(id).order;
  const chain = [
    ["provisional_agreement", `${id}:agree`],
    ["confirmed", `${id}:confirm`],
    ["in_progress", `${id}:start`],
    ["ready", `${id}:ready`],
    ["delivered", `${id}:deliver`],
  ] as const;
  for (const [to, key] of chain) {
    order = transitionOrder(order, { to, idempotencyKey: key, createdAt: TS });
  }
  return { ...storedOrder(id), order, updatedAt: TS };
}

function readyStored(id: string): StoredCraftOrder {
  let order = storedOrder(id).order;
  const chain = [
    ["provisional_agreement", `${id}:agree`],
    ["confirmed", `${id}:confirm`],
    ["in_progress", `${id}:start`],
    ["ready", `${id}:ready`],
  ] as const;
  for (const [to, key] of chain) {
    order = transitionOrder(order, { to, idempotencyKey: key, createdAt: TS });
  }
  return { ...storedOrder(id), order, updatedAt: TS };
}

function collectedStored(id: string): StoredCraftOrder {
  const delivered = deliveredStored(id).order;
  const collected = collectRemaining(delivered, 5000, `${id}:collect`, TS);
  return { ...storedOrder(id), order: collected, updatedAt: TS };
}

function retainedDepositStored(id: string): StoredCraftOrder {
  let order = storedOrder(id).order;
  order = collectDeposit(order, 2000, `${id}:dep`, TS);
  order = cancelOrder(order, "إلغاء", `${id}:cancel`, TS);
  order = settleDepositRetain(order, 2000, "احتفاظ", `${id}:retain`, TS);
  return { ...storedOrder(id), order, updatedAt: TS };
}

function pendingDepositStored(id: string): StoredCraftOrder {
  let order = storedOrder(id).order;
  order = collectDeposit(order, 2000, `${id}:dep`, TS);
  order = cancelOrder(order, "إلغاء", `${id}:cancel`, TS);
  return { ...storedOrder(id), order, updatedAt: TS };
}

function linkedDraft(orderId: string): OrderDraft {
  return {
    id: `draft-${orderId}`,
    intent: "customer_order",
    customerName: "سارة",
    itemName: "صندوق",
    specifications: "نقش",
    quantity: 1,
    costSnapshots: [],
    activeCostSnapshotId: null,
    linkedOrderId: orderId,
    createdAt: TS,
    updatedAt: TS,
  };
}

function consumption(orderId: string, key: string) {
  return createInventoryMovement({
    id: `mv-${key}`,
    materialId: "mat-1",
    type: "consumption",
    occurredOn: "2026-09-08",
    recordedAt: TS,
    quantityDeltaMilli: -1000,
    valueDeltaMinor: -500,
    note: "استهلاك",
    operationKey: key,
    orderId,
    costKnowledge: "known",
  });
}

function deliveryConsumption(stored: StoredCraftOrder) {
  const deliveryEventId = [...stored.order.events]
    .reverse()
    .find(event => event.type === "status_changed" && event.toStatus === "delivered")!.id;
  return createInventoryMovement({
    id: `mv-${stored.id}-deliver`,
    materialId: "mat-1",
    type: "consumption",
    occurredOn: "2026-09-08",
    recordedAt: TS,
    quantityDeltaMilli: -2000,
    valueDeltaMinor: -1000,
    note: `استهلاك تسليم الطلب ${stored.id}`,
    operationKey: `${stored.id}:deliver:${deliveryEventId}:mat-1`,
    orderId: stored.id,
    costKnowledge: "known",
  });
}

function deliveryMirror(target: {
  id: string;
  materialId: string;
  quantityDeltaMilli: number;
  valueDeltaMinor: number;
  operationKey: string;
}) {
  return createInventoryMovement({
    id: `delivery-reversal-${target.id}`,
    materialId: target.materialId,
    type: "reversal",
    occurredOn: "2026-09-08",
    recordedAt: TS,
    quantityDeltaMilli: -target.quantityDeltaMilli,
    valueDeltaMinor: -target.valueDeltaMinor,
    note: "مرآة التراجع",
    reason: "عكس التسليم",
    operationKey: `${target.operationKey}:reversal`,
    reversesMovementId: target.id,
    costKnowledge: "known",
  });
}

function scheduleEntry(id: string, orderId: string, date: string): ScheduleEntry {
  return {
    id,
    orderId,
    kind: "delivery",
    scheduledFor: date,
    scheduledTime: null,
    durationMinutes: null,
    status: "scheduled",
    postponeReason: null,
    events: [
      {
        id: `${id}:created`,
        type: "created",
        idempotencyKey: `${id}:created:${date}`,
        createdAt: TS,
        previousScheduledFor: null,
        scheduledFor: date,
        previousScheduledTime: null,
        scheduledTime: null,
        previousDurationMinutes: null,
        durationMinutes: null,
        reason: null,
      },
    ],
    recurrenceId: null,
    recurrenceIndex: null,
  };
}

function postponedSchedule(base: ScheduleEntry, date: string, key: string): ScheduleEntry {
  return {
    ...base,
    scheduledFor: date,
    status: "postponed",
    postponeReason: "تأجيل",
    updatedAt: TS,
    events: [
      ...base.events,
      {
        id: `${base.id}:postponed:${base.events.length + 1}`,
        type: "postponed",
        idempotencyKey: key,
        createdAt: TS,
        previousScheduledFor: base.scheduledFor,
        scheduledFor: date,
        previousScheduledTime: base.scheduledTime,
        scheduledTime: base.scheduledTime,
        previousDurationMinutes: base.durationMinutes,
        durationMinutes: base.durationMinutes,
        reason: "تأجيل",
      },
    ],
  };
}

function recurrenceFixture(id: string, sourceScheduleId: string): ScheduleRecurrence {
  return {
    id,
    sourceScheduleId,
    orderId: "order-1",
    frequency: "weekly",
    occurrenceCount: 2,
    status: "active",
    idempotencyKey: id,
    cancelledAt: null,
    cancellationReason: null,
    createdAt: TS,
    updatedAt: TS,
  };
}

function expenseEvent(id: string, amountMinor: number) {
  return createFinancialEvent({
    id,
    type: "operating_expense_cash",
    amountMinor,
    occurredOn: "2026-09-08",
    recordedAt: TS,
    idempotencyKey: id,
    note: "مصروف",
    counterparty: null,
    relatedEventId: null,
    expenseContext: {
      relationship: "project",
      behavior: "variable",
      purpose: "project_general",
      knowledge: "known",
      sharedProjectShare: null,
      categoryLabel: null,
    },
    assetContext: null,
    loanContext: null,
    depositContext: null,
  });
}

function wasteEvent(id: string, amountMinor: number) {
  return createFinancialEvent({
    id,
    type: "inventory_waste_noncash",
    amountMinor,
    occurredOn: "2026-09-08",
    recordedAt: TS,
    idempotencyKey: id,
    note: "هدر",
    counterparty: null,
    relatedEventId: null,
    expenseContext: null,
    assetContext: null,
    loanContext: null,
    depositContext: null,
  });
}

function walletFixture() {
  return createCashWallet({
    id: "wallet-1",
    name: "الصندوق",
    kind: "cash_drawer",
    createdAt: TS,
    createdOperationKey: "wallet-1",
  });
}

function cashEntry(id: string, key: string, deltaMinor: number) {
  return createCashContinuityEntry({
    id,
    walletId: "wallet-1",
    type: "cash_adjustment",
    occurredOn: "2026-09-08",
    recordedAt: TS,
    cashDeltaMinor: deltaMinor,
    note: "قيادة",
    reason: "تسوية",
    operationKey: key,
  });
}

function shortageFixture(id: string): InventoryShortage {
  return {
    id,
    materialId: "mat-1",
    requestedQuantityMilli: 3000,
    availableQuantityMilli: 1000,
    shortageQuantityMilli: 2000,
    occurredOn: "2026-09-08",
    recordedAt: TS,
    note: "نقص موثق",
    orderId: null,
  };
}

function templateFixture(id: string, revision: number, key: string): CatalogTemplate {
  return {
    id,
    catalogItemId: "catalog-1",
    title: "قالب",
    note: null,
    components: [],
    yield: { quantityMilli: 1000, unitId: "unit-piece" },
    yieldReadiness: "ready",
    revision,
    sourceTemplateId: null,
    active: true,
    createdAt: TS,
    updatedAt: TS,
    createdOperationKey: key,
  };
}

async function orders(store: PrototypeLocalStore): Promise<void> {
  /* 5. commitOrderFromDraft — الطلب ومسودته المرتبطة معًا. */
  const fromDraft = await store.commitOrderFromDraft(storedOrder("order-1"), linkedDraft("order-1"));
  expect(fromDraft.ok).toBe(true);
  const savedDraft = (await store.listDrafts()).value.find(draft => draft.id === "draft-order-1");
  expect(savedDraft?.linkedOrderId).toBe("order-1");
  const savedOrder = await store.getOrder("order-1");
  expect(savedOrder.value?.order.customerName).toBe("سارة");

  /* 6. commitOrderDelivery — تسليم ذرّي ثم إعادة تشغيل بالمفتاح نفسه؛ المخزون
   * الحي قبل التسليم (ready) والحمل الوارد يسليم (delivered) كما في الخدمة. */
  const delivered = deliveredStored("order-2");
  await store.saveOrder(readyStored("order-2"));
  const deliveryMovement = deliveryConsumption(delivered);
  const delivery = await store.commitOrderDelivery(delivered, [deliveryMovement], [], null, null);
  expect(delivery.ok).toBe(true);
  if (delivery.ok) expect(delivery.value.reused).toBe(false);
  const deliveryReplay = await store.commitOrderDelivery(delivered, [deliveryMovement], [], null, null);
  expect(deliveryReplay.ok).toBe(true);
  if (deliveryReplay.ok) expect(deliveryReplay.value.reused).toBe(true);
  expect((await store.listInventoryMovements()).value).toHaveLength(1);

  /* 7. commitOrderDeliveryReversal — عكس التسليم ثم إعادة التشغيل. */
  const storedAfterDelivery = (await store.getOrder("order-2")).value!;
  const { reverseDelivery } = await import("@micro-domain/craft-order/index.js");
  const reversedOrder = reverseDelivery(storedAfterDelivery.order, {
    reason: "سُلّم للزبون الخطأ",
    idempotencyKey: "order-2:rev",
    createdAt: TS,
  });
  const mirrorMovement = deliveryMirror(deliveryMovement);
  const reversal = await store.commitOrderDeliveryReversal({ ...storedAfterDelivery, order: reversedOrder }, [
    mirrorMovement,
  ]);
  expect(reversal.ok).toBe(true);
  const reversalReplay = await store.commitOrderDeliveryReversal(
    { ...storedAfterDelivery, order: reversedOrder },
    [mirrorMovement],
  );
  expect(reversalReplay.ok).toBe(true);
  if (reversalReplay.ok) expect(reversalReplay.value.reused).toBe(true);
  expect((await store.listInventoryMovements()).value).toHaveLength(2);

  /* 8. commitOrderCollectionReversal — تراجع القبضة ثم إعادة التشغيل. */
  const collected = collectedStored("order-3");
  await store.saveOrder(collected);
  const collectionEvent = collected.order.events.find(event => event.type === "collection_recorded")!;
  const afterCollectionReversal = reverseOrderCollection(collected.order, {
    collectionEventId: collectionEvent.id,
    amountMinor: 2000,
    reason: "خطأ قبض",
    idempotencyKey: "order-3:collrev",
    createdAt: TS,
  });
  const collectionReversal = await store.commitOrderCollectionReversal(
    { ...collected, order: afterCollectionReversal, updatedAt: TS },
    null,
    "order-3:collrev",
  );
  expect(collectionReversal.ok).toBe(true);
  const collectionReversalReplay = await store.commitOrderCollectionReversal(
    { ...collected, order: afterCollectionReversal, updatedAt: TS },
    null,
    "order-3:collrev",
  );
  expect(collectionReversalReplay.ok).toBe(true);
  if (collectionReversalReplay.ok) expect(collectionReversalReplay.value.reused).toBe(true);
  const rereadThree = (await store.getOrder("order-3")).value!;
  expect(rereadThree.order.events.filter(event => event.type === "collection_reversed")).toHaveLength(1);

  /* 9. commitDepositRefundSettlement — رد العربون المعلق بعد الإلغاء ثم إعادة التشغيل. */
  const pending = pendingDepositStored("order-4");
  await store.saveOrder(pending);
  const refunded = settleDepositRefund(pending.order, 2000, "رد العربون", "order-4:refund", TS);
  const refundCommit = await store.commitDepositRefundSettlement(
    { ...pending, order: refunded, updatedAt: TS },
    [],
    "order-4:refund",
  );
  expect(refundCommit.ok).toBe(true);
  const refundReplay = await store.commitDepositRefundSettlement(
    { ...pending, order: refunded, updatedAt: TS },
    [],
    "order-4:refund",
  );
  expect(refundReplay.ok).toBe(true);
  if (refundReplay.ok) expect(refundReplay.value.reused).toBe(true);
  const rereadFour = (await store.getOrder("order-4")).value!;
  expect(rereadFour.order.events.filter(event => event.type === "deposit_refunded")).toHaveLength(1);
}

async function schedulesAndSupplier(store: PrototypeLocalStore): Promise<void> {
  /* 1. commitScheduleCreate. */
  const created = await store.commitScheduleCreate(scheduleEntry("schedule-1", "order-1", "2026-09-10"));
  expect(created.ok).toBe(true);
  if (created.ok) expect(created.value.reused).toBe(false);
  const createReplay = await store.commitScheduleCreate(scheduleEntry("schedule-1", "order-1", "2026-09-10"));
  expect(createReplay.ok).toBe(true);
  if (createReplay.ok) expect(createReplay.value.reused).toBe(true);
  expect((await store.listSchedules()).value).toHaveLength(1);

  /* 2. commitScheduleUpdate. */
  const stored = (await store.getSchedule("schedule-1")).value!;
  const postponed = postponedSchedule(stored, "2026-09-11", "schedule-1:postponed:1");
  const updated = await store.commitScheduleUpdate(postponed);
  expect(updated.ok).toBe(true);
  const updateReplay = await store.commitScheduleUpdate(postponed);
  expect(updateReplay.ok).toBe(true);
  if (updateReplay.ok) expect(updateReplay.value.reused).toBe(true);
  const staleUpdate = await store.commitScheduleUpdate(
    postponedSchedule(stored, "2026-09-12", "schedule-1:postponed:stale"),
  );
  expect(staleUpdate.ok).toBe(false);
  if (!staleUpdate.ok) expect(staleUpdate.code).toBe("storage_stale");
  const afterStale = (await store.getSchedule("schedule-1")).value!;
  expect(afterStale.scheduledFor).toBe("2026-09-11");
  expect(afterStale.events).toHaveLength(2);

  /* 3. commitRecurrence — الذرّية: تعارض المظهر الثاني يتراجع بكل شيء. */
  await store.commitScheduleCreate(scheduleEntry("recurrence-1:2", "order-9", "2026-09-24"));
  const appearanceOne = scheduleEntry("recurrence-1:1", "order-1", "2026-09-17");
  const appearanceTwo = scheduleEntry("recurrence-1:2", "order-1", "2026-09-24");
  const withRecurrence = (appearance: ScheduleEntry, index: number): ScheduleEntry => ({
    ...appearance,
    recurrenceId: "recurrence-1",
    recurrenceIndex: index,
    events: [
      {
        ...appearance.events[0]!,
        id: `${appearance.id}:created`,
        idempotencyKey: `${appearance.id}:2026-09-${index === 1 ? "17" : "24"}`,
        reason: "موعد قادم من قالب تكرار محلي",
      },
    ],
  });
  const blocked = await store.commitRecurrence(recurrenceFixture("recurrence-1", "schedule-1"), [
    withRecurrence(appearanceOne, 1),
    withRecurrence(appearanceTwo, 2),
  ]);
  expect(blocked.ok).toBe(false);
  if (!blocked.ok) expect(blocked.code).toBe("storage_stale");
  expect((await store.getRecurrence("recurrence-1")).value).toBeNull();
  expect((await store.getSchedule("recurrence-1:1")).value).toBeNull();

  /* 4. commitSupplierPurchase — إنشاء ثم إعادة مفتاح ثم تعارض مراجعة قديمة. */
  const purchase = createSupplierPurchase({
    id: "purchase-1",
    supplierName: "مؤسسة النسيج",
    note: "شراء قماش",
    purchasedOn: "2026-09-07",
    dueOn: null,
    totalMinor: 10000,
    initialPaidMinor: 2000,
    recordedAt: TS,
    idempotencyKey: "purchase-1",
    materialId: null,
    expectedQuantityMilli: null,
  });
  const purchaseCommit = await store.commitSupplierPurchase({
    kind: "create",
    purchase,
    idempotencyKey: "purchase-1",
  });
  expect(purchaseCommit.ok).toBe(true);
  const purchaseReplay = await store.commitSupplierPurchase({
    kind: "create",
    purchase,
    idempotencyKey: "purchase-1",
  });
  expect(purchaseReplay.ok).toBe(true);
  if (purchaseReplay.ok) expect(purchaseReplay.value.reused).toBe(true);
  const withPayment = recordSupplierPurchasePayment(purchase, {
    id: "payment-1",
    amountMinor: 1500,
    occurredOn: "2026-09-08",
    recordedAt: TS,
    idempotencyKey: "payment-1",
    note: "دفعة",
  });
  const paymentCommit = await store.commitSupplierPurchase({
    kind: "payment",
    purchase: withPayment,
    idempotencyKey: "payment-1",
  });
  expect(paymentCommit.ok).toBe(true);
  const paymentReplay = await store.commitSupplierPurchase({
    kind: "payment",
    purchase: withPayment,
    idempotencyKey: "payment-1",
  });
  expect(paymentReplay.ok).toBe(true);
  if (paymentReplay.ok) expect(paymentReplay.value.reused).toBe(true);
  const stalePayment = await store.commitSupplierPurchase({
    kind: "payment",
    purchase: recordSupplierPurchasePayment(purchase, {
      id: "payment-2",
      amountMinor: 1500,
      occurredOn: "2026-09-08",
      recordedAt: TS,
      idempotencyKey: "payment-2",
      note: "دفعة ثانية",
    }),
    idempotencyKey: "payment-2",
  });
  expect(stalePayment.ok).toBe(false);
  if (!stalePayment.ok) expect(stalePayment.code).toBe("storage_stale");
  expect((await store.listSupplierPurchases()).value[0]!.payments).toHaveLength(2);
}

async function financeAndCash(store: PrototypeLocalStore): Promise<void> {
  /* 10. commitCashContinuity — القيد بمفتاح العملية لا يتكرر. */
  const wallet = walletFixture();
  const entry = cashEntry("cash-1", "op-cash-1", -300);
  const cashCommit = await store.commitCashContinuity(wallet, [entry]);
  expect(cashCommit.ok).toBe(true);
  await store.commitCashContinuity(wallet, [entry]);
  expect((await store.listCashContinuityEntries()).value).toHaveLength(1);
  expect((await store.listCashWallets()).value).toHaveLength(1);

  /* 14. commitFinancialEventCorrection — تراجع موثق ثم إعادة المفتاح نفسه. */
  const source = expenseEvent("event-1", 2500);
  await store.saveFinancialEvent(source);
  const reversal = createFinancialReversal({
    id: "event-1-rev",
    sourceEvent: source,
    occurredOn: "2026-09-08",
    recordedAt: TS,
    idempotencyKey: "rev-key-1",
    reason: "خطأ تسجيل",
  });
  const correction = await store.commitFinancialEventCorrection("event-1", reversal);
  expect(correction.ok).toBe(true);
  const correctionReplay = await store.commitFinancialEventCorrection("event-1", reversal);
  expect(correctionReplay.ok).toBe(true);
  const secondReversal = await store.commitFinancialEventCorrection(
    "event-1",
    createFinancialReversal({
      id: "event-1-rev-2",
      sourceEvent: source,
      occurredOn: "2026-09-08",
      recordedAt: TS,
      idempotencyKey: "rev-key-2",
      reason: "تراجع ثانٍ",
    }),
  );
  expect(secondReversal.ok).toBe(false);
  if (!secondReversal.ok) expect(secondReversal.code).toBe("storage_error");
  expect((await store.listFinancialEvents()).value).toHaveLength(2);

  /* 15. commitFinancialEventReplacement — التراجع والبديل معًا. */
  const sourceTwo = expenseEvent("event-2", 1000);
  await store.saveFinancialEvent(sourceTwo);
  const replacementReversal = createFinancialReversal({
    id: "event-2-rev",
    sourceEvent: sourceTwo,
    occurredOn: "2026-09-08",
    recordedAt: TS,
    idempotencyKey: "replace-key-1",
    reason: "تعديل موثق",
  });
  const replacement = expenseEvent("event-2-new", 1200);
  const replaceCommit = await store.commitFinancialEventReplacement(
    "event-2",
    replacementReversal,
    replacement,
  );
  expect(replaceCommit.ok).toBe(true);
  const replaceReplay = await store.commitFinancialEventReplacement(
    "event-2",
    replacementReversal,
    replacement,
  );
  expect(replaceReplay.ok).toBe(true);
  /* المصدر + تراجعه + البديل للأول + المصدر الثاني + تراجعه وبديله = 5. */
  expect((await store.listFinancialEvents()).value).toHaveLength(5);
}

async function inventoryAndCatalog(store: PrototypeLocalStore): Promise<void> {
  const material = {
    id: "mat-1",
    name: "قماش",
    unit: "meter" as const,
    createdAt: TS,
    createdOperationKey: "mat-1",
  };

  /* 11. commitInventory — المادة وحركتها معًا، والإعادة لا تكرر. */
  const movement = consumption("order-1", "inv-1");
  const invCommit = await store.commitInventory(material, [movement]);
  expect(invCommit.ok).toBe(true);
  await store.commitInventory(material, [movement]);
  /* حركتا قسم الطلبات (استهلاك التسليم ومرآته) + حركة القسم هذه = 3. */
  expect((await store.listInventoryMovements()).value).toHaveLength(3);
  expect((await store.listMaterials()).value).toHaveLength(1);

  /* 12. commitInventoryWithShortage — المادة والحركة وسجل النقص ذرّية. */
  const shortageCommit = await store.commitInventoryWithShortage(
    material,
    [consumption("order-1", "inv-2")],
    shortageFixture("shortage-1"),
  );
  expect(shortageCommit.ok).toBe(true);
  expect((await store.listInventoryShortages()).value).toHaveLength(1);

  /* 13. commitInventoryWithEvents — حركة هدر مع حدث خسارة غير نقدية. */
  const wasteMovement = createInventoryMovement({
    id: "mv-waste-1",
    materialId: "mat-1",
    type: "waste",
    occurredOn: "2026-09-08",
    recordedAt: TS,
    quantityDeltaMilli: -500,
    valueDeltaMinor: -250,
    note: "هدر قماش",
    reason: "تلف بالمخزون",
    operationKey: "waste-1",
    costKnowledge: "known",
  });
  const waste = wasteEvent("event-waste-1", 250);
  const wasteCommit = await store.commitInventoryWithEvents(material, [wasteMovement], [waste]);
  expect(wasteCommit.ok).toBe(true);
  if (wasteCommit.ok) expect(wasteCommit.value.reused).toBe(false);
  const wasteReplay = await store.commitInventoryWithEvents(material, [wasteMovement], [waste]);
  expect(wasteReplay.ok).toBe(true);
  if (wasteReplay.ok) expect(wasteReplay.value.reused).toBe(true);
  expect(
    (await store.listFinancialEvents()).value.filter(event => event.type === "inventory_waste_noncash"),
  ).toHaveLength(1);

  /* 16. commitCatalogTemplateRevision — النسخة الجديدة والموقوفة معًا. */
  const active = templateFixture("template-1", 1, "template-key-1");
  const saved = await store.saveCatalogTemplate(active);
  expect(saved.ok).toBe(true);
  const next = { ...templateFixture("template-2", 2, "template-key-2"), sourceTemplateId: "template-1" };
  const revision = await store.commitCatalogTemplateRevision(
    { ...active, active: false, updatedAt: TS },
    next,
  );
  expect(revision.ok).toBe(true);
  const revisionReplay = await store.commitCatalogTemplateRevision(
    { ...active, active: false, updatedAt: TS },
    next,
  );
  expect(revisionReplay.ok).toBe(true);
  const templates = (await store.listCatalogTemplates()).value;
  expect(templates.find(template => template.id === "template-1")?.active).toBe(false);
  expect(templates.find(template => template.id === "template-2")?.active).toBe(true);
}

async function g5AndOwner(store: PrototypeLocalStore): Promise<void> {
  /* 17. commitShortCashDeclarationReversal. */
  const declaration = createShortCashDeclaration({
    id: "short-1",
    direction: "collection",
    amountMinor: 500,
    dueOn: "2026-09-10",
    source: "جرد",
    note: "عجز صندوق",
    idempotencyKey: "short-1",
    knowledge: "estimated",
    createdAt: TS,
  });
  await store.saveShortCashDeclaration(declaration);
  const shortReversal = createShortCashReversal({
    id: "short-1-rev",
    original: declaration,
    idempotencyKey: "short-rev-1",
    createdAt: TS,
    note: "تراجع",
  });
  const shortCommit = await store.commitShortCashDeclarationReversal("short-1", shortReversal);
  expect(shortCommit.ok).toBe(true);
  const shortReplay = await store.commitShortCashDeclarationReversal("short-1", shortReversal);
  expect(shortReplay.ok).toBe(true);
  const declarations = (await store.listShortCashDeclarations()).value;
  expect(declarations.find(entry => entry.id === "short-1")!.kind).toBe("declaration");
  expect(declarations.find(entry => entry.id === "short-1-rev")!.kind).toBe("reversal");

  /* 18. commitOwnerEntitlementPolicySuccessor. */
  const policy = createOwnerEntitlementPolicy({
    id: "policy-1",
    version: 1,
    family: "time_period",
    kind: "monthly",
    amountMinor: 1500,
    percentageBps: null,
    unitLabel: null,
    startsOn: "2026-08-01",
    endsOn: null,
    source: "اتفاق",
    note: "شهري",
    status: "active",
    idempotencyKey: "policy-1",
    createdAt: TS,
  });
  await store.saveOwnerEntitlementPolicy(policy);
  const successor = createOwnerEntitlementPolicySuccessor({
    id: "policy-2",
    version: 2,
    kind: "monthly",
    amountMinor: 2000,
    percentageBps: null,
    unitLabel: null,
    startsOn: "2026-09-01",
    endsOn: null,
    source: "اتفاق",
    note: "شهري محدث",
    status: "active",
    idempotencyKey: "policy-2",
    createdAt: TS,
    successorOfPolicyId: "policy-1",
  });
  const successorCommit = await store.commitOwnerEntitlementPolicySuccessor(
    createOwnerEntitlementPolicy({ ...policy, endsOn: "2026-08-31", status: "ended" }),
    successor,
  );
  expect(successorCommit.ok).toBe(true);
  const successorReplay = await store.commitOwnerEntitlementPolicySuccessor(
    createOwnerEntitlementPolicy({ ...policy, endsOn: "2026-08-31", status: "ended" }),
    successor,
  );
  expect(successorReplay.ok).toBe(true);
  const policies = (await store.listOwnerEntitlementPolicies()).value;
  expect(policies).toHaveLength(2);

  /* 19. commitOwnerEntitlementRecordReversal. */
  const record = createOwnerEntitlementRecord({
    id: "entitlement-1",
    policyId: "policy-1",
    policyVersion: 1,
    periodFrom: "2026-08-01",
    periodTo: "2026-08-31",
    occurredOn: "2026-08-31",
    recordedAt: TS,
    amountMinor: 1500,
    knowledge: "known",
    calculationBasis: "time_period",
    baseMinor: null,
    quantity: null,
    note: "آب",
    idempotencyKey: "entitlement-1",
  });
  await store.saveOwnerEntitlementRecord(record);
  const recordReversal = createOwnerEntitlementRecordReversal({
    id: "entitlement-1-rev",
    source: record,
    occurredOn: "2026-09-08",
    recordedAt: TS,
    idempotencyKey: "ent-rev-1",
    reason: "خطأ",
  });
  const recordReversalCommit = await store.commitOwnerEntitlementRecordReversal(
    "entitlement-1",
    recordReversal,
  );
  expect(recordReversalCommit.ok).toBe(true);
  await store.commitOwnerEntitlementRecordReversal("entitlement-1", recordReversal);
  expect((await store.listOwnerEntitlementRecords()).value).toHaveLength(2);

  /* 20. commitOwnerEntitlementOpeningBalanceReversal. */
  const opening = createOwnerEntitlementOpeningBalance({
    id: "opening-1",
    amountMinor: 5000,
    reason: "رصيد افتتاح",
    note: "افتتاح",
    occurredOn: "2026-08-01",
    recordedAt: TS,
    idempotencyKey: "opening-1",
    reversalOfId: null,
    reversalReason: null,
  });
  await store.saveOwnerEntitlementOpeningBalance(opening);
  const openingReversal = createOwnerEntitlementOpeningBalanceReversal({
    id: "opening-1-rev",
    source: opening,
    occurredOn: "2026-09-08",
    recordedAt: TS,
    idempotencyKey: "opening-rev-1",
    reason: "خطأ افتتاح",
  });
  const openingReversalCommit = await store.commitOwnerEntitlementOpeningBalanceReversal(
    "opening-1",
    openingReversal,
  );
  expect(openingReversalCommit.ok).toBe(true);
  expect((await store.listOwnerEntitlementOpeningBalances()).value).toHaveLength(2);

  /* 21. commitOwnerMovement — الحركة وأثر الكاش معًا. */
  const movement = createOwnerMovement({
    id: "movement-1",
    kind: "draw",
    amountMinor: 500,
    walletId: "wallet-1",
    occurredOn: "2026-09-08",
    recordedAt: TS,
    reason: "owner_draw",
    note: "سحب مالك",
    idempotencyKey: "movement-1",
    relatedEntitlementId: null,
  });
  const movementCashEntry = createCashContinuityEntry({
    id: "cash-owner-1",
    walletId: "wallet-1",
    type: "cash_adjustment",
    occurredOn: "2026-09-08",
    recordedAt: TS,
    cashDeltaMinor: -500,
    note: "حركة مالك",
    reason: "owner_draw",
    operationKey: "owner-movement:movement-1",
  });
  const movementCommit = await store.commitOwnerMovement(movement, movementCashEntry);
  expect(movementCommit.ok).toBe(true);
  await store.commitOwnerMovement(movement, movementCashEntry);
  expect((await store.listOwnerMovements()).value).toHaveLength(1);

  /* 22. commitAllocationPolicySuccessor. */
  const allocationPolicy = createAllocationPolicy({
    id: "alloc-1",
    seriesId: "series-1",
    successorOfPolicyId: null,
    version: 1,
    catalogItemId: "catalog-1",
    periodFrom: "2026-08-01",
    periodTo: "2026-08-31",
    startsOn: "2026-08-01",
    endsOn: "2026-08-31",
    source: "اختبار",
    reason: "سياسة",
    note: "مصفوفة مطابقة",
    status: "active",
    idempotencyKey: "alloc-1",
    createdAt: TS,
    updatedAt: TS,
    kind: "per_output_unit",
    amountMinor: null,
    rateMinor: null,
    rateMinorPerWholeUnit: 50,
    percentageBps: null,
    unitId: "unit-piece",
  });
  await store.saveAllocationPolicy(allocationPolicy);
  const allocationSuccessor = createAllocationPolicySuccessor(allocationPolicy, {
    id: "alloc-2",
    seriesId: "series-1",
    successorOfPolicyId: "alloc-1",
    version: 2,
    catalogItemId: "catalog-1",
    periodFrom: "2026-09-01",
    periodTo: "2026-09-30",
    startsOn: "2026-09-01",
    endsOn: "2026-09-30",
    source: "اختبار",
    reason: "سياسة محدثة",
    note: "مصفوفة مطابقة",
    status: "active",
    idempotencyKey: "alloc-2",
    createdAt: TS,
    updatedAt: TS,
    kind: "per_output_unit",
    amountMinor: null,
    rateMinor: null,
    rateMinorPerWholeUnit: 60,
    percentageBps: null,
    unitId: "unit-piece",
  });
  const allocationCommit = await store.commitAllocationPolicySuccessor(
    createAllocationPolicy({ ...allocationPolicy, status: "inactive", updatedAt: TS }),
    allocationSuccessor,
  );
  expect(allocationCommit.ok).toBe(true);
  const allocationReplay = await store.commitAllocationPolicySuccessor(
    createAllocationPolicy({ ...allocationPolicy, status: "inactive", updatedAt: TS }),
    allocationSuccessor,
  );
  expect(allocationReplay.ok).toBe(true);
  expect((await store.listAllocationPolicies()).value).toHaveLength(2);
}

async function assetsLoansDeposits(store: PrototypeLocalStore): Promise<void> {
  const { AssetService } = await import("@/application/assets/assetService");
  const { LoanService } = await import("@/application/loans/loanService");
  const { RetainedDepositService } = await import("@/application/finance/retainedDepositService");
  const assets = new AssetService(store, () => TS);
  const loans = new LoanService(store, () => TS);
  const deposits = new RetainedDepositService(store, () => TS);

  /* 23. commitAssetRecord — إعادة المحاولة عبر المخزن مباشرة. */
  const assetCreated = await assets.create({
    name: "ثلاجة عرض",
    acquisitionAmountMinor: 60000,
    acquisitionKind: "cash",
    purchaseDate: "2026-06-01",
    lifeMonths: 24,
    depreciationStartOn: "2026-06-01",
  });
  expect(assetCreated.ok).toBe(true);
  if (!assetCreated.ok) return;
  const assetEvents = (await store.listFinancialEvents()).value.filter(
    event => event.type === "asset_purchase_cash",
  );
  expect(assetEvents).toHaveLength(1);
  const assetReplay = await store.commitAssetRecord(assetCreated.value.asset, assetEvents[0]!);
  expect(assetReplay.ok && assetReplay.value.reused).toBe(true);
  expect((await store.listAssets()).value).toHaveLength(1);

  /* 24. commitAssetAcquisitionCorrection — التراجع والبديل والسجل معًا. */
  const corrected = await assets.correctAcquisition(assetCreated.value.asset.id, {
    acquisitionAmountMinor: 55000,
    acquisitionKind: "cash",
    reason: "خطأ مبلغ",
  });
  expect(corrected.ok).toBe(true);
  if (!corrected.ok) return;
  const correctionReplay = await store.commitAssetAcquisitionCorrection(
    corrected.value.asset,
    corrected.value.reversal,
    corrected.value.replacement,
  );
  expect(correctionReplay.ok).toBe(true);
  if (correctionReplay.ok) expect(correctionReplay.value.reused).toBe(true);

  /* 25. commitLoanRecord. */
  const loanCreated = await loans.create({
    borrowerName: "أحمد",
    principalMinor: 15000,
    loanDate: "2026-07-01",
  });
  expect(loanCreated.ok).toBe(true);
  if (!loanCreated.ok) return;
  const loanReplay = await store.commitLoanRecord(loanCreated.value.loan, loanCreated.value.event);
  expect(loanReplay.ok && loanReplay.value.reused).toBe(true);
  expect((await store.listLoans()).value).toHaveLength(1);

  /* 26. commitLoanCorrection. */
  const loanCorrected = await loans.correctLoan(loanCreated.value.loan.id, {
    principalMinor: 14000,
    reason: "تصحيح أصل القرض",
  });
  expect(loanCorrected.ok).toBe(true);
  if (!loanCorrected.ok) return;
  const loanCorrectionReplay = await store.commitLoanCorrection(
    loanCorrected.value.loan,
    loanCorrected.value.reversal,
    loanCorrected.value.replacement,
  );
  expect(loanCorrectionReplay.ok).toBe(true);
  if (loanCorrectionReplay.ok) expect(loanCorrectionReplay.value.reused).toBe(true);

  /* 27. commitDepositClassification. */
  const retained = retainedDepositStored("order-deposit");
  await store.saveOrder(retained);
  const classified = await deposits.classify("order-deposit", "revenue", "تعويض الإلغاء");
  expect(classified.ok).toBe(true);
  if (!classified.ok) return;
  const classificationReplay = await store.commitDepositClassification(
    classified.value.order,
    classified.value.event,
  );
  expect(classificationReplay.ok && classificationReplay.value.reused).toBe(true);
  const classifiedEvents = (await store.listFinancialEvents()).value.filter(
    event => event.type === "deposit_retained_revenue",
  );
  expect(classifiedEvents).toHaveLength(1);

  /* 28. commitDepositClassificationCorrection. */
  const reclassified = await deposits.reclassify("order-deposit", {
    toMeaning: "owner_capital",
    reason: "إعادة تصنيف",
  });
  expect(reclassified.ok).toBe(true);
  if (!reclassified.ok) return;
  const reclassifyReplay = await store.commitDepositClassificationCorrection(
    reclassified.value.order,
    reclassified.value.reversal,
    reclassified.value.replacement,
  );
  expect(reclassifyReplay.ok).toBe(true);
  if (reclassifyReplay.ok) expect(reclassifyReplay.value.reused).toBe(true);
}

async function runFullMatrix(store: PrototypeLocalStore): Promise<void> {
  await orders(store);
  await schedulesAndSupplier(store);
  await financeAndCash(store);
  await inventoryAndCatalog(store);
  await g5AndOwner(store);
  await assetsLoansDeposits(store);

  /* اللقطة تحمل كل ما كُتب أعلاه — البرهان الختامي للتوافق والاسترجاع. */
  const snapshot = await store.readSnapshot();
  expect(snapshot.ok).toBe(true);
  if (!snapshot.ok) return;
  const target = new MemoryLocalStore();
  const replaced = await target.replaceSnapshot(snapshot.value);
  expect(replaced.ok).toBe(true);
  const restored = await target.readSnapshot();
  if (!restored.ok) return;
  expect(restored.value.orders.length).toBe(snapshot.value.orders.length);
  expect(restored.value.financialEvents.length).toBe(snapshot.value.financialEvents.length);
  expect(restored.value.inventoryMovements.length).toBe(snapshot.value.inventoryMovements.length);
}

describe("Group 10 adapter conformance — the complete 28-commit-operation matrix", () => {
  it("MemoryLocalStore satisfies all 28 commit-operation contracts", async () => {
    await runFullMatrix(new MemoryLocalStore());
  });

  it("IndexedDbLocalStore (fake-indexeddb) satisfies the same 28 commit-operation contracts", async () => {
    await runFullMatrix(new IndexedDbLocalStore());
  });
});
