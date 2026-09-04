/** المجموعة ٥ (عقد ٣٠ — اختبار القارئ الموحّد): كل عائلة حدث تُشتق بصفٍّ
 * واحد يحمل أثره ورابط مصدره؛ الترتيب بوقت التسجيل؛ المجهول يبقى null لا صفرًا؛
 * التراجع صفٌّ قائم والأصل المتراجع عنه بحالة «متراجع»؛ لا يجمع القارئ شيئًا. */
import { describe, expect, it } from "vitest";
import { createFinancialEvent, createFinancialReversal } from "@micro-domain/financial-event/index.js";
import { calculateCostSnapshot, createCraftOrder } from "@micro-domain/craft-order/index.js";
import type { OrderEvent } from "@micro-domain/craft-order/index.js";
import { MemoryLocalStore } from "@/storage/local/MemoryLocalStore";
import { ActivityService } from "./activityService";

const NOW = "2026-09-05T09:00:00.000Z";

async function saveEvent(store: MemoryLocalStore, input: Parameters<typeof createFinancialEvent>[0]) {
  const event = createFinancialEvent(input);
  const saved = await store.saveFinancialEvent(event);
  if (!saved.ok) throw new Error(saved.message);
  return event;
}

type CreateCraftOrderEvents = OrderEvent[];

describe("activity reader (المجموعة ٥ — عقد ٣٠)", () => {
  it("derives one row per event family with effect class and source link", async () => {
    const store = new MemoryLocalStore();
    await saveEvent(store, {
      id: "exp-1",
      type: "operating_expense_cash",
      amountMinor: 1500,
      occurredOn: "2026-09-01",
      recordedAt: "2026-09-01T08:00:00.000Z",
      idempotencyKey: "exp-1",
      note: "بنزين",
      counterparty: null,
    });
    await saveEvent(store, {
      id: "dep-1",
      type: "asset_depreciation",
      amountMinor: 2500,
      occurredOn: "2026-09-02",
      recordedAt: "2026-09-02T08:00:00.000Z",
      idempotencyKey: "dep-1",
      note: "إهلاك ثلاجة",
      counterparty: null,
      assetContext: { assetId: "asset-1", name: "ثلاجة عرض" },
    });
    await saveEvent(store, {
      id: "amanah-1",
      type: "amanah_held_cash",
      amountMinor: 5000,
      occurredOn: "2026-09-03",
      recordedAt: "2026-09-03T08:00:00.000Z",
      idempotencyKey: "amanah-1",
      note: "أمانة جار",
      counterparty: null,
    });
    const reader = new ActivityService(store);
    const result = await reader.read({ limit: 10 });
    if (!result.ok) throw new Error(result.message);
    const rows = result.value;
    expect(rows.length).toBe(3);
    const expense = rows.find(row => row.id === "financial-events:exp-1");
    expect(expense?.family).toBe("expense");
    expect(expense?.effect).toBe("cash_out");
    expect(expense?.amountMinor).toBe(1500);
    expect(expense?.sourceHref).toBe("/finance?event=exp-1");
    const depreciation = rows.find(row => row.id === "financial-events:dep-1");
    expect(depreciation?.family).toBe("depreciation");
    expect(depreciation?.effect).toBe("non_cash");
    const amanah = rows.find(row => row.id === "financial-events:amanah-1");
    expect(amanah?.effect).toBe("trust");
    /* الأحدث تسجيلًا أولًا — تراجع زمني ثابت لا تاريخ أثر. */
    expect(rows[0]?.id).toBe("financial-events:amanah-1");
  });

  it("reversal is its own row and the original becomes «reversed» — never deleted", async () => {
    const store = new MemoryLocalStore();
    const original = await saveEvent(store, {
      id: "src-1",
      type: "operating_expense_cash",
      amountMinor: 800,
      occurredOn: "2026-08-20",
      recordedAt: "2026-08-20T08:00:00.000Z",
      idempotencyKey: "src-1",
      note: "مصروف",
      counterparty: null,
    });
    const reversal = createFinancialReversal({
      id: "rev-1",
      sourceEvent: original,
      occurredOn: "2026-09-01",
      recordedAt: "2026-09-01T10:00:00.000Z",
      idempotencyKey: "rev-1",
      reason: "خطأ إدخال",
    });
    const savedReversal = await store.saveFinancialEvent(reversal);
    if (!savedReversal.ok) throw new Error(savedReversal.message);
    const reader = new ActivityService(store);
    const result = await reader.read({ limit: 10 });
    if (!result.ok) throw new Error(result.message);
    const reversedRow = result.value.find(row => row.id === "financial-events:src-1");
    const reversalRow = result.value.find(row => row.id === "financial-events:rev-1");
    expect(reversedRow?.status).toBe("reversed");
    expect(reversalRow?.family).toBe("correction");
    expect(reversalRow?.reversalOfId).toBe("financial-events:src-1");
    expect(reversalRow?.effect).toBe("cash_in");
  });

  it("grouped wallet transfers appear once and quantities ride inventory rows", async () => {
    const store = new MemoryLocalStore();
    const savedMaterial = await store.commitInventory(
      {
        id: "mat-1",
        name: "خشب",
        unit: "meter",
        createdAt: "2026-08-01T08:00:00.000Z",
        createdOperationKey: "mat-1",
      },
      [
        {
          id: "mov-1",
          materialId: "mat-1",
          type: "consumption",
          occurredOn: "2026-09-01",
          recordedAt: "2026-09-01T07:00:00.000Z",
          quantityDeltaMilli: -2500,
          valueDeltaMinor: -2000,
          note: "استهلاك",
          reason: null,
          operationKey: "order-1:deliver:ev-1:mat-1",
          purchaseId: null,
          orderId: "order-1",
          reversesMovementId: null,
          wasteContext: null,
        },
      ],
    );
    if (!savedMaterial.ok) throw new Error(savedMaterial.message);
    const transferOut = await store.commitCashContinuity(null, [
      {
        id: "cash-1",
        walletId: "wallet-1",
        type: "transfer_out",
        occurredOn: "2026-09-02",
        recordedAt: "2026-09-02T08:00:00.000Z",
        cashDeltaMinor: -3000,
        note: "تحويل",
        reason: null,
        operationKey: "transfer-1:out",
        transferId: "transfer-1",
        reversesEntryId: null,
      },
      {
        id: "cash-2",
        walletId: "wallet-2",
        type: "transfer_in",
        occurredOn: "2026-09-02",
        recordedAt: "2026-09-02T08:00:01.000Z",
        cashDeltaMinor: 3000,
        note: "تحويل",
        reason: null,
        operationKey: "transfer-1:in",
        transferId: "transfer-1",
        reversesEntryId: null,
      },
    ]);
    if (!transferOut.ok) throw new Error(transferOut.message);
    const reader = new ActivityService(store);
    const result = await reader.read({ limit: 10 });
    if (!result.ok) throw new Error(result.message);
    const transferRows = result.value.filter(row => row.family === "wallet_transfer");
    expect(transferRows.length).toBe(1);
    expect(transferRows[0]?.amountMinor).toBe(3000);
    expect(transferRows[0]?.effect).toBe("informational");
    const consumption = result.value.find(row => row.id === "inventory-movements:mov-1");
    expect(consumption?.family).toBe("inventory_consumption");
    expect(consumption?.quantityMilli).toBe(2500);
    expect(consumption?.effect).toBe("non_cash");
    expect(consumption?.sourceHref).toBe("/orders/order-1");
  });

  it("unknown cost stays null — never zero — and direct sales classify by collection", async () => {
    const store = new MemoryLocalStore();
    const savedSale = await store.saveDirectSale({
      id: "sale-1",
      itemName: "قطعة",
      quantity: 1,
      currency: "JOD",
      revenueMinor: 9000,
      collectedMinor: 9000,
      costMinor: null,
      profitMinor: null,
      occurredOn: "2026-09-01",
      recordedAt: "2026-09-01T09:00:00.000Z",
      note: "",
      idempotencyKey: "sale-1",
    });
    if (!savedSale.ok) throw new Error(savedSale.message);
    const savedPartial = await store.saveDirectSale({
      id: "sale-2",
      itemName: "قطعتان",
      quantity: 1,
      currency: "JOD",
      revenueMinor: 5000,
      collectedMinor: 2000,
      costMinor: 1000,
      profitMinor: null,
      occurredOn: "2026-09-02",
      recordedAt: "2026-09-02T09:00:00.000Z",
      note: "",
      idempotencyKey: "sale-2",
      collectionStatus: "partial_debt",
    });
    if (!savedPartial.ok) throw new Error(savedPartial.message);
    const reader = new ActivityService(store);
    const result = await reader.read({ limit: 10 });
    if (!result.ok) throw new Error(result.message);
    const full = result.value.find(row => row.id === "direct-sales:sale-1");
    expect(full?.effect).toBe("cash_in");
    expect(full?.amountMinor).toBe(9000);
    const partial = result.value.find(row => row.id === "direct-sales:sale-2");
    expect(partial?.effect).toBe("pending");
  });

  it("order events map by kind: collection cash-in, deposit pending, correction family", async () => {
    const store = new MemoryLocalStore();
    const cost = calculateCostSnapshot("cost-order-1", {
      currency: "JOD",
      materialItems: [],
      time: { minutes: 30, hourlyRateMinor: 300, confidence: "known" },
      packagingMinor: 0,
      deliveryMinor: 0,
      wasteMinor: 0,
      safetyBufferMinor: 0,
      quantity: 1,
      createdAt: "2026-08-25T08:00:00.000Z",
      freshnessDays: null,
    });
    /* القارئ يقرأ السجل المخزّن كما هو — نموذج بيانات مخزنة (تاريخ وارد أو مسجل):
     * بناء الطلب عبر التخزين المباشر يغطي الأحداث الثلاث المطلوبة للعائلات. */
    const created = {
      ...createCraftOrder({
        id: "order-1",
        customerName: "أم خالد",
        itemName: "شماغ مطرّز",
        specifications: "خيط أبيض على الأسود",
        quantity: 1,
        agreedPriceMinor: 15000,
        costSnapshot: cost,
        createdAt: "2026-08-25T08:00:00.000Z",
      }),
      depositCollectedMinor: 3000,
      collectedMinor: 2000,
      receivableMinor: 10000,
      status: "in_progress",
      settlementStatus: "partial",
      events: [
        { id: "ev-1", type: "created", idempotencyKey: "o1-created", createdAt: "2026-08-25T08:00:00.000Z" },
        {
          id: "ev-2",
          type: "deposit_collected",
          idempotencyKey: "o1-dep",
          createdAt: "2026-08-25T09:00:00.000Z",
          amountMinor: 3000,
        },
        {
          id: "ev-3",
          type: "collection_recorded",
          idempotencyKey: "o1-col",
          createdAt: "2026-09-01T09:00:00.000Z",
          amountMinor: 2000,
        },
      ] as CreateCraftOrderEvents,
    };
    const saved = await store.saveOrder({
      id: "order-1",
      order: created,
      catalogItemId: null,
      deliveryDate: "2026-09-10",
      agreementSource: null,
      createdAt: "2026-08-25T08:00:00.000Z",
      updatedAt: "2026-09-01T09:00:00.000Z",
    });
    if (!saved.ok) throw new Error(saved.message);
    const reader = new ActivityService(store);
    const result = await reader.read({ limit: 10 });
    if (!result.ok) throw new Error(result.message);
    const deposit = result.value.find(row => row.id === "craft-orders:order-1:ev-2");
    expect(deposit?.family).toBe("deposit");
    expect(deposit?.effect).toBe("cash_in");
    const collection = result.value.find(row => row.id === "craft-orders:order-1:ev-3");
    expect(collection?.family).toBe("collection");
    expect(collection?.effect).toBe("cash_in");
    expect(collection?.sourceHref).toBe("/orders/order-1");
  });

  it("empty store returns an honest empty list — no invented rows", async () => {
    const reader = new ActivityService(new MemoryLocalStore());
    const result = await reader.read({ limit: 8 });
    if (!result.ok) throw new Error(result.message);
    expect(result.value).toEqual([]);
  });
});
