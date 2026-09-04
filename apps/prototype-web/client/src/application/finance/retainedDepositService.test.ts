import { describe, expect, it } from "vitest";
import { RetainedDepositService } from "./retainedDepositService";
import { MemoryLocalStore } from "@/storage/local/MemoryLocalStore";
import {
  calculateCostSnapshot,
  cancelOrder,
  classifyRetainedDeposit as classifyOnOrder,
  collectDeposit,
  createCraftOrder,
  settleDepositRetain,
} from "@micro-domain/craft-order/index.js";
import type { CostSnapshotInput, CraftOrder } from "@micro-domain/craft-order/index.js";
import type { StoredCraftOrder } from "@/storage/local/types";

const COST_INPUT: CostSnapshotInput = {
  currency: "JOD",
  materialItems: [{ name: "قماش", quantity: 2, unit: "متر", unitPriceMinor: 500, priceDate: "2026-08-01", source: "user_input", confidence: "known" }],
  time: null,
  packagingMinor: 0,
  deliveryMinor: 0,
  wasteMinor: 0,
  safetyBufferMinor: 0,
  quantity: 1,
  createdAt: "2026-08-21T09:00:00Z",
  source: "price_approval",
};

function fixedNow() {
  let tick = 0;
  return () => {
    tick += 1;
    return new Date(Date.UTC(2026, 8, 1 + tick, 8, 0, 0)).toISOString();
  };
}

const now = fixedNow();

async function cancelledOrderWithRetainedDeposit(store: MemoryLocalStore): Promise<StoredCraftOrder> {
  const snapshot = calculateCostSnapshot(`cost-${Math.random().toString(16).slice(2)}`, COST_INPUT);
  let order: CraftOrder = createCraftOrder({
    id: "order-1",
    customerName: "ليلى",
    itemName: "فستان",
    specifications: "قياس مخصص",
    quantity: 1,
    agreedPriceMinor: 10000,
    costSnapshot: snapshot,
    createdAt: now(),
  });
  order = collectDeposit(order, 5000, "order-1:initial-deposit", now());
  order = cancelOrder(order, "العميلة ألغت", "order-1:cancel", now());
  order = settleDepositRetain(order, 5000, "تنازل عن العربون", "order-1:retain", now());
  const stored: StoredCraftOrder = {
    id: "order-1",
    order,
    catalogItemId: null,
    deliveryDate: "2026-09-01",
    agreementSource: "whatsapp",
    createdAt: now(),
    updatedAt: now(),
  };
  await store.saveOrder(stored);
  return stored;
}

async function pendingOrder(store: MemoryLocalStore): Promise<StoredCraftOrder> {
  const snapshot = calculateCostSnapshot(`cost-${Math.random().toString(16).slice(2)}`, COST_INPUT);
  let order: CraftOrder = createCraftOrder({
    id: "order-2",
    customerName: "سعاد",
    itemName: "حقيبة",
    specifications: "جلد طبيعي",
    quantity: 1,
    agreedPriceMinor: 8000,
    costSnapshot: snapshot,
    createdAt: now(),
  });
  order = collectDeposit(order, 3000, "order-2:initial-deposit", now());
  order = cancelOrder(order, "إلغاء متفق", "order-2:cancel", now());
  order = settleDepositRetain(order, 3000, "احتفاظ", "order-2:retain", now());
  const stored: StoredCraftOrder = {
    id: "order-2",
    order,
    catalogItemId: null,
    deliveryDate: "2026-09-01",
    agreementSource: "walk_in",
    createdAt: now(),
    updatedAt: now(),
  };
  await store.saveOrder(stored);
  return stored;
}

describe("retained deposit service (المجموعة ٤ — عقد ٢٩)", () => {
  it("lists pending retained deposits as the safe default state", async () => {
    const store = new MemoryLocalStore();
    const service = new RetainedDepositService(store, now);
    await cancelledOrderWithRetainedDeposit(store);
    await pendingOrder(store);
    const pending = await service.listPending();
    expect(pending.ok).toBe(true);
    if (!pending.ok) return;
    expect(pending.value).toHaveLength(2);
    expect(pending.value.every(row => row.decision === "pending")).toBe(true);
  });

  it("classifies as owner money: owner capital rises, no new cash, no revenue", async () => {
    const store = new MemoryLocalStore();
    const service = new RetainedDepositService(store, now);
    await cancelledOrderWithRetainedDeposit(store);
    const result = await service.classify("order-1", "owner", "العربون يعود لي");
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.event.type).toBe("deposit_retained_owner");
    expect(result.value.event.ownerCapitalDeltaMinor).toBe(5000);
    expect(result.value.event.cashDeltaMinor).toBe(0);
    expect(result.value.event.revenueDeltaMinor ?? 0).toBe(0);
    expect(result.value.order.order.retainedMeaning).toBe("owner");
    const pending = await service.listPending();
    expect(pending.ok && pending.value).toHaveLength(0);
  });

  it("classifies as project revenue: recognized once, no new cash, no owner change", async () => {
    const store = new MemoryLocalStore();
    const service = new RetainedDepositService(store, now);
    await cancelledOrderWithRetainedDeposit(store);
    const result = await service.classify("order-1", "revenue", "تعويض الإلغاء");
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.event.type).toBe("deposit_retained_revenue");
    expect(result.value.event.revenueDeltaMinor).toBe(5000);
    expect(result.value.event.cashDeltaMinor).toBe(0);
    expect(result.value.order.order.retainedMeaning).toBe("revenue");
  });

  it("rejects a second classification on the same order — correction is the documented path", async () => {
    const store = new MemoryLocalStore();
    const service = new RetainedDepositService(store, now);
    await cancelledOrderWithRetainedDeposit(store);
    const first = await service.classify("order-1", "owner", "قرار أول");
    expect(first.ok).toBe(true);
    const second = await service.classify("order-1", "revenue", "قرار ثانٍ");
    expect(second.ok).toBe(false);
  });

  it("reclassifies with reversal + replacement: net financial effect switches honestly", async () => {
    const store = new MemoryLocalStore();
    const service = new RetainedDepositService(store, now);
    await cancelledOrderWithRetainedDeposit(store);
    const first = await service.classify("order-1", "owner", "قرار أول");
    expect(first.ok).toBe(true);
    const correction = await service.reclassify("order-1", "revenue", "القرار الأول كان متسرعًا");
    expect(correction.ok).toBe(true);
    if (!correction.ok) return;
    expect(correction.value.order.order.retainedMeaning).toBe("revenue");
    const events = await store.listFinancialEvents();
    /* تصنيف + تراجع + بديل = ٣ أحداث؛ الصافي: إيراد فقط. */
    const classifications = events.value.filter(
      event => event.type === "deposit_retained_owner" || event.type === "deposit_retained_revenue",
    );
    expect(classifications).toHaveLength(3);
    /* الأصل المعكوس يُستبعد بمعرّفه لا بوسمه — التراجع يستهدف حدثًا سليمًا. */
    const reversedIds = new Set(
      events.value.flatMap(event =>
        event.correctionType === "reverse" && event.correctionOfEventId ? [event.correctionOfEventId] : [],
      ),
    );
    const ownerActive = classifications.filter(
      event =>
        event.type === "deposit_retained_owner" &&
        event.correctionType !== "reverse" &&
        !reversedIds.has(event.id),
    );
    expect(ownerActive).toHaveLength(0);
    /* التراجع نقض أثر المالك: صافي ownerCapital من الأحداث = صفر. */
    const ownerNet = classifications.reduce(
      (sum, event) => sum + event.ownerCapitalDeltaMinor,
      0,
    );
    expect(ownerNet).toBe(0);
    const revenueNet = classifications.reduce((sum, event) => sum + (event.revenueDeltaMinor ?? 0), 0);
    expect(revenueNet).toBe(5000);
  });

  it("rejects reclassification with no standing classification", async () => {
    const store = new MemoryLocalStore();
    const service = new RetainedDepositService(store, now);
    await cancelledOrderWithRetainedDeposit(store);
    const result = await service.reclassify("order-1", "revenue", "لا تصنيف قائم");
    expect(result.ok).toBe(false);
  });

  it("domain guard: classification requires the retain decision first", () => {
    const snapshot = calculateCostSnapshot(`cost-${Math.random().toString(16).slice(2)}`, COST_INPUT);
    let order: CraftOrder = createCraftOrder({
      id: "order-3",
      customerName: "منى",
      itemName: "تنورة",
      specifications: "قياس مخصص",
      quantity: 1,
      agreedPriceMinor: 9000,
      costSnapshot: snapshot,
      createdAt: now(),
    });
    order = collectDeposit(order, 2000, "order-3:dep", now());
    /* إلغاء بلا قرار احتفاظ: التصنيف يُرفض. */
    order = cancelOrder(order, "سبب", "order-3:cancel", now());
    expect(() => classifyOnOrder(order, "owner", "سبب", "order-3:classify", now())).toThrow(
      /يتبع قرار الاحتفاظ/,
    );
  });
});
