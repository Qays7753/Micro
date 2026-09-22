import { describe, expect, it } from "vitest";
import { createCatalogItem } from "@micro-domain/catalog/index.js";
import { calculateCostSnapshot, createCraftOrder, transitionOrder } from "@micro-domain/craft-order/index.js";
import { MemoryLocalStore } from "@/storage/local/MemoryLocalStore";
import { RecurringWorkService } from "./recurringWorkService";
import type { StoredCraftOrder } from "@/storage/local/types";

/* FIN-006 (WS-177 — Wave 5): القراءة الكنونية لنتيجة كل مرجع — هوية ثابتة
 * (معرف الكتالوج لا اسم العرض)، فصل نهائي/تقديري/ناقص مرئي، استبعاد الطلبات
 * بلا مرجع قابل للربط بأسباب ظاهرة، القيم المسجلة وحدها (لا إعادة حساب من
 * أسعار الكتالوج الحالية)، ولا توصيات سعر أو إيقاف أبدًا. */
const now = () => "2026-08-23T09:00:00.000Z";

function deliveredStored(
  id: string,
  catalogItemId: string | null,
  knowledge: "known" | "estimated",
  price = 5000,
): StoredCraftOrder {
  const cost = calculateCostSnapshot(`${id}-cost`, {
    currency: "JOD",
    materialItems: [
      {
        name: "خشب",
        quantity: 1,
        unit: "قطعة",
        unitPriceMinor: 1000,
        priceDate: "2026-08-01",
        source: "user_input",
        confidence: knowledge,
      },
    ],
    time: { minutes: 60, hourlyRateMinor: 500, confidence: knowledge },
    packagingMinor: 100,
    deliveryMinor: 0,
    wasteMinor: 0,
    safetyBufferMinor: 0,
    quantity: 2,
    createdAt: "2026-08-01T09:00:00.000Z",
    freshnessDays: null,
  });
  let order = createCraftOrder({
    id,
    customerName: "عميلة اختبار",
    itemName: `صندوق ${id}`,
    specifications: "مواصفات معلنة",
    quantity: 2,
    agreedPriceMinor: price,
    costSnapshot: cost,
    createdAt: "2026-08-01T09:00:00.000Z",
  });
  for (const [to, stamp] of [
    ["provisional_agreement", "2026-08-01T10:00:00.000Z"],
    ["confirmed", "2026-08-01T11:00:00.000Z"],
    ["in_progress", "2026-08-02T09:00:00.000Z"],
    ["ready", "2026-08-03T09:00:00.000Z"],
    ["delivered", "2026-08-05T09:00:00.000Z"],
  ] as const)
    order = transitionOrder(order, { to, idempotencyKey: `${id}-${to}`, createdAt: stamp });
  return {
    id: order.id,
    order,
    catalogItemId,
    deliveryDate: "2026-08-05",
    agreementSource: "test" as const,
    createdAt: order.createdAt,
    updatedAt: "2026-08-05T09:00:00.000Z",
  };
}

async function storeWithItem() {
  const store = new MemoryLocalStore();
  const item = createCatalogItem({
    id: "catalog-fin006",
    kind: "product",
    name: "صندوق قياسي",
    unitLabel: "قطعة",
    unitId: null,
    createdAt: now(),
    createdOperationKey: "catalog-fin006-create",
  });
  await store.saveCatalogItem(item);
  return { store, item };
}

describe("FIN-006 (WS-177 — Wave 5): canonical per-catalog-item recorded result", () => {
  it("separates final core from estimated recorded values and incomplete counts — never merged", async () => {
    const { store, item } = await storeWithItem();
    const finalOrder = deliveredStored("order-final", item.id, "known", 5000);
    const estimatedOrder = deliveredStored("order-estimated", item.id, "estimated", 4000);
    /* طلب ناقص كما سُجل: قيم معترف بها لكن حالته غير مكتملة (عدّ بلا قيم). */
    const incompleteOrder = deliveredStored("order-incomplete", item.id, "known", 3000);
    incompleteOrder.order = {
      ...incompleteOrder.order,
      resultStatus: "incomplete",
      profitIndicatorMinor: null,
    };
    for (const stored of [finalOrder, estimatedOrder, incompleteOrder]) await store.saveOrder(stored);
    const service = new RecurringWorkService(store, now);
    const readings = await service.readRecurringWork("2026-08-01", "2026-08-31");
    expect(readings).toMatchObject({ ok: true });
    if (!readings.ok) throw new Error(readings.message);
    const reading = readings.value.items.find(entry => entry.catalogItemId === item.id);
    if (!reading) throw new Error("reading missing");
    /* الرقم الأساسي: النهائي وحده. */
    expect(reading.finalOrderCount).toBe(1);
    expect(reading.directMarginMinor).toBe(
      finalOrder.order.recognizedRevenueMinor - finalOrder.order.recognizedCostMinor,
    );
    expect(reading.recognizedRevenueMinor).toBe(finalOrder.order.recognizedRevenueMinor);
    /* التقديرية: مرئية بقيمها المسجلة منفصلة — لا تدخل الرقم أبدًا. */
    expect(reading.estimatedOrderCount).toBe(1);
    expect(reading.estimatedRevenueMinor).toBe(estimatedOrder.order.recognizedRevenueMinor);
    expect(reading.estimatedMarginMinor).toBe(
      estimatedOrder.order.recognizedRevenueMinor - estimatedOrder.order.recognizedCostMinor,
    );
    /* غير المكتملة: عَدّ مرئي بلا قيم. */
    expect(reading.incompleteOrderCount).toBe(1);
    /* مجموع الرقم الأساسي لا يشمل التقديرية ولا الناقصة. */
    expect(reading.directMarginMinor).not.toBe(
      (finalOrder.order.recognizedRevenueMinor -
        finalOrder.order.recognizedCostMinor +
        estimatedOrder.order.recognizedRevenueMinor -
        estimatedOrder.order.recognizedCostMinor) as number,
    );
  });

  it("lists delivered orders without a linkable catalog reference visibly — null identity and dangling reference", async () => {
    const { store, item } = await storeWithItem();
    const linked = deliveredStored("order-linked", item.id, "known");
    const legacy = deliveredStored("order-legacy", null, "known");
    const dangling = deliveredStored("order-dangling", "catalog-deleted", "known");
    for (const stored of [linked, legacy, dangling]) await store.saveOrder(stored);
    const service = new RecurringWorkService(store, now);
    const readings = await service.readRecurringWork("2026-08-01", "2026-08-31");
    if (!readings.ok) throw new Error(readings.message);
    /* الاستبعاد الظاهر: الطلبات بلا مرجع مُدرجة بأسمائها التاريخية وحالاتها. */
    expect(readings.value.unlinkedDeliveredOrders).toHaveLength(2);
    expect(readings.value.unlinkedDeliveredOrders.map(entry => entry.id).sort()).toEqual(
      ["order-legacy", "order-dangling"].sort(),
    );
    expect(readings.value.unlinkedDeliveredOrders.every(entry => entry.itemName.length > 0)).toBe(true);
    /* المرتبط وحده داخل صف المرجع؛ لا دمج ولا إخفاء. */
    const reading = readings.value.items.find(entry => entry.catalogItemId === item.id);
    expect(reading?.finalOrderCount).toBe(1);
  });

  it("keys rows by stable catalog identity — same display name never merges two items", async () => {
    const store = new MemoryLocalStore();
    const left = createCatalogItem({
      id: "catalog-left",
      kind: "product",
      name: "صندوق متطابق الاسم",
      unitLabel: "قطعة",
      unitId: null,
      createdAt: now(),
      createdOperationKey: "catalog-left-create",
    });
    const right = createCatalogItem({
      id: "catalog-right",
      kind: "product",
      name: "صندوق متطابق الاسم",
      unitLabel: "قطعة",
      unitId: null,
      createdAt: now(),
      createdOperationKey: "catalog-right-create",
    });
    await store.saveCatalogItem(left);
    await store.saveCatalogItem(right);
    await store.saveOrder(deliveredStored("order-left", left.id, "known", 5000));
    await store.saveOrder(deliveredStored("order-right", right.id, "known", 7000));
    const service = new RecurringWorkService(store, now);
    const readings = await service.readRecurringWork("2026-08-01", "2026-08-31");
    if (!readings.ok) throw new Error(readings.message);
    /* هويتان مستقلتان باسم واحد — لا دمج باسم العرض إطلاقًا. */
    expect(readings.value.items).toHaveLength(2);
    const margins = readings.value.items.map(entry => entry.directMarginMinor);
    expect(margins).not.toContain(
      5000 + 7000 - 2 * deliveredStored("x", null, "known").order.recognizedCostMinor,
    );
    const leftReading = readings.value.items.find(entry => entry.catalogItemId === "catalog-left");
    const rightReading = readings.value.items.find(entry => entry.catalogItemId === "catalog-right");
    expect(leftReading?.finalOrderCount).toBe(1);
    expect(rightReading?.finalOrderCount).toBe(1);
    expect(leftReading?.recognizedRevenueMinor).not.toBe(rightReading?.recognizedRevenueMinor);
  });

  it("reads recorded values only — a catalog default-price revision never rewrites historical margins", async () => {
    const { store, item } = await storeWithItem();
    const stored = deliveredStored("order-frozen", item.id, "known", 5000);
    await store.saveOrder(stored);
    const service = new RecurringWorkService(store, now);
    const before = await service.readRecurringWork("2026-08-01", "2026-08-31");
    if (!before.ok) throw new Error(before.message);
    const beforeReading = before.value.items.find(entry => entry.catalogItemId === item.id);
    /* مراجعة افتراضات الكتالوج الحالية (سعر افتراضي جديد) — لا تعيد كتابة التاريخ. */
    const revised = {
      ...item,
      defaultPriceMinor: 999999,
      defaultUnitCostMinor: 888888,
      updatedAt: now(),
    };
    await store.saveCatalogItem(revised);
    const after = await service.readRecurringWork("2026-08-01", "2026-08-31");
    if (!after.ok) throw new Error(after.message);
    const afterReading = after.value.items.find(entry => entry.catalogItemId === item.id);
    expect(afterReading?.directMarginMinor).toBe(beforeReading?.directMarginMinor);
    expect(afterReading?.recognizedRevenueMinor).toBe(stored.order.recognizedRevenueMinor);
    expect(afterReading?.recognizedDirectCostMinor).toBe(stored.order.recognizedCostMinor);
  });

  it("never emits price or stop recommendations in reasons or next actions", async () => {
    const { store, item } = await storeWithItem();
    await store.saveOrder(deliveredStored("order-wording", item.id, "estimated", 4000));
    const service = new RecurringWorkService(store, now);
    const readings = await service.readRecurringWork("2026-08-01", "2026-08-31");
    if (!readings.ok) throw new Error(readings.message);
    for (const entry of readings.value.items) {
      for (const text of [...entry.reasons, entry.nextAction]) {
        expect(text).not.toContain("توصية سعر");
        expect(text).not.toContain("غيّر السعر");
        expect(text).not.toContain("أوقف");
        expect(text).not.toContain("أوقف المنتج");
      }
    }
  });
});
