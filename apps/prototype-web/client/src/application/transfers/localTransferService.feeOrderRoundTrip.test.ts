import { describe, expect, it } from "vitest";
import { LocalTransferService } from "./localTransferService";
import { DraftService } from "@/application/drafts/draftService";
import { CostService, type CostEditorInput } from "@/application/cost/costService";
import { AgreementService } from "@/application/agreements/agreementService";
import { FulfillmentService } from "@/application/fulfillment/fulfillmentService";
import { MemoryLocalStore } from "@/storage/local/MemoryLocalStore";

const now = () => "2026-09-28T09:00:00.000Z";

const costInput: CostEditorInput = {
  materialItems: [{ name: "خشب", quantity: 1, unit: "لوح", unitPriceMinor: 200, confidence: "known" }],
  time: { minutes: 60, hourlyRateMinor: 200, confidence: "known" },
  packagingMinor: 0,
  deliveryMinor: 0,
  wasteMinor: 0,
  safetyBufferMinor: 0,
  quantity: 1,
};

/* Group 1 (F-007 — الميثاق الرئيسي 2026-09-28): طلب ذو أجرة عبر المشروع
 * يعبر دورة التصدير-التحقق-الاستيراد كاملة بلا فقد (شروط التوصيل والعربون
 * والدين والقبض والعكس)، وملف معدّل يزرع أجرة غير معقولة أو مسؤولية بلا
 * معنى يُرفض قبل الكتابة الذرية — الاستيراد طبقي: بنية ثم نطاق ثم علاقات،
 * والرفض قبل أي استبدال. */

async function feeOrderWithJourney(): Promise<{ store: MemoryLocalStore; orderId: string }> {
  const store = new MemoryLocalStore();
  const drafts = new DraftService(store, now);
  const created = await drafts.create("customer_order");
  if (!created.ok) throw new Error(created.message);
  const saved = await drafts.save({
    ...created.draft,
    customerName: "سارة",
    itemName: "رف خشبي",
    specifications: "مقاس كبير",
    quantity: 1,
  });
  if (!saved.ok) throw new Error(saved.message);
  const costs = new CostService(store, now);
  const withCost = await costs.saveSnapshot(saved.draft, costInput);
  if (!withCost.ok) throw new Error(withCost.message);
  const agreements = new AgreementService(store, costs, now);
  /* سعر 50 + أجرة عميل عبر المشروع 5 = قيمة قابلة للتحصيل 55. */
  const agreed = await agreements.createFromDraft(withCost.draft, {
    agreedPriceMinor: 5000,
    deliveryDate: "2026-10-01",
    depositMinor: 1000,
    agreementSource: null,
    deliveryTerms: {
      responsibility: "customer_pays_project",
      feeIncludedInPrice: false,
      costIncludedInProductCost: false,
      feeChargedMinor: 500,
      costPaidMinor: null,
      projectShareMinor: null,
      customerShareMinor: null,
    },
  });
  if (!agreed.ok) throw new Error(agreed.message);
  const started = await agreements.startExecution(agreed.stored.id);
  if (!started.ok) throw new Error(started.message);
  /* العربون المتفق (1000) يُقبض عند إنشاء الاتفاق نفسه — لا قبض مزدوج هنا. */
  const fulfillment = new FulfillmentService(store, now);
  const orderId = agreed.stored.id;
  await fulfillment.markReady(orderId);
  await fulfillment.deliver(orderId);
  await fulfillment.registerRemainingDebt(orderId);
  /* قبض 40 من دين 45 ثم عكس 5 — الأحداث والحالة تعبران الدورة كاملتين. */
  await fulfillment.collectDebt(orderId, 4000, "f7-collect");
  const gripId =
    (await store.getOrder(orderId)).value?.order.events.find(event => event.id === `${orderId}:f7-collect`)
      ?.id ?? `${orderId}:f7-collect`;
  await fulfillment.reverseCollection(orderId, {
    collectionEventId: gripId,
    amountMinor: 500,
    reason: "تسوية مع الزبون",
    operationKey: "f7-reverse",
  });
  return { store, orderId };
}

describe("fee order round-trip and layered import validation (F-007)", () => {
  it("round-trips a fee order with deposit, debt, collection, and reversal without loss", async () => {
    const { store, orderId } = await feeOrderWithJourney();
    const source = await store.getOrder(orderId);
    if (!source.ok || !source.value) throw new Error("order should exist");
    expect(source.value.order.receivableMinor).toBe(1000);
    expect(source.value.order.deliveryTerms?.feeChargedMinor).toBe(500);

    const transfers = new LocalTransferService(store, now);
    const verified = await transfers.createVerifiedExport();
    if (!verified.ok) throw new Error(verified.message);
    expect(verified.value.summary.orders).toBe(1);

    const target = new MemoryLocalStore();
    const targetTransfers = new LocalTransferService(target, now);
    const prepared = targetTransfers.prepareImport(JSON.stringify(verified.value.file));
    if (!prepared.ok) throw new Error(prepared.message);
    const confirmed = await targetTransfers.confirmImport(prepared.value);
    if (!confirmed.ok) throw new Error(confirmed.message);

    const restored = await target.getOrder(orderId);
    if (!restored.ok || !restored.value) throw new Error("order should restore");
    expect(restored.value.order).toEqual(source.value.order);
    expect(restored.value.order.deliveryTerms).toEqual({
      responsibility: "customer_pays_project",
      feeIncludedInPrice: false,
      costIncludedInProductCost: false,
      feeChargedMinor: 500,
      costPaidMinor: null,
      projectShareMinor: null,
      customerShareMinor: null,
    });
    expect(restored.value.order.events.filter(event => event.type === "collection_reversed")).toHaveLength(1);
  });

  it("rejects a tampered negative delivery fee before any write", async () => {
    const { store } = await feeOrderWithJourney();
    const transfers = new LocalTransferService(store, now);
    const verified = await transfers.createVerifiedExport();
    if (!verified.ok) throw new Error(verified.message);
    const file = JSON.parse(JSON.stringify(verified.value.file)) as {
      data: { orders: Array<{ order: { deliveryTerms: { feeChargedMinor: number } } }> };
    };
    file.data.orders[0]!.order.deliveryTerms.feeChargedMinor = -300;
    const target = new MemoryLocalStore();
    const targetTransfers = new LocalTransferService(target, now);
    const prepared = targetTransfers.prepareImport(JSON.stringify(file));
    expect(prepared.ok).toBe(false);
    /* الرفض قبل الكتابة الذرية: الهدف بلا أي بيانات. */
    const orders = await target.listOrders();
    if (!orders.ok) throw new Error(orders.message);
    expect(orders.value).toHaveLength(0);
  });

  it("rejects a fee planted on a project-pays responsibility before any write", async () => {
    const { store } = await feeOrderWithJourney();
    const transfers = new LocalTransferService(store, now);
    const verified = await transfers.createVerifiedExport();
    if (!verified.ok) throw new Error(verified.message);
    const file = JSON.parse(JSON.stringify(verified.value.file)) as {
      data: {
        orders: Array<{ order: { deliveryTerms: { responsibility: string; feeChargedMinor: number } } }>;
      };
    };
    file.data.orders[0]!.order.deliveryTerms.responsibility = "project_pays";
    file.data.orders[0]!.order.deliveryTerms.feeChargedMinor = 700;
    const target = new MemoryLocalStore();
    const targetTransfers = new LocalTransferService(target, now);
    const prepared = targetTransfers.prepareImport(JSON.stringify(file));
    expect(prepared.ok).toBe(false);
    const orders = await target.listOrders();
    if (!orders.ok) throw new Error(orders.message);
    expect(orders.value).toHaveLength(0);
  });

  it("rejects a courier-direct record carrying a project cost before any write", async () => {
    const { store } = await feeOrderWithJourney();
    const transfers = new LocalTransferService(store, now);
    const verified = await transfers.createVerifiedExport();
    if (!verified.ok) throw new Error(verified.message);
    const file = JSON.parse(JSON.stringify(verified.value.file)) as {
      data: {
        orders: Array<{ order: { deliveryTerms: { responsibility: string; costPaidMinor: number } } }>;
      };
    };
    file.data.orders[0]!.order.deliveryTerms.responsibility = "customer_pays_courier";
    file.data.orders[0]!.order.deliveryTerms.costPaidMinor = 400;
    const target = new MemoryLocalStore();
    const targetTransfers = new LocalTransferService(target, now);
    const prepared = targetTransfers.prepareImport(JSON.stringify(file));
    expect(prepared.ok).toBe(false);
  });

  it("rejects an invalid deposit settlement decision before any write", async () => {
    const { store } = await feeOrderWithJourney();
    const transfers = new LocalTransferService(store, now);
    const verified = await transfers.createVerifiedExport();
    if (!verified.ok) throw new Error(verified.message);
    const file = JSON.parse(JSON.stringify(verified.value.file)) as {
      data: { orders: Array<{ order: { depositSettlement: string } }> };
    };
    file.data.orders[0]!.order.depositSettlement = "keep_it_all";
    const target = new MemoryLocalStore();
    const prepared = new LocalTransferService(target, now).prepareImport(JSON.stringify(file));
    expect(prepared.ok).toBe(false);
  });

  it("rejects an invalid retained-deposit meaning before any write", async () => {
    const { store } = await feeOrderWithJourney();
    const transfers = new LocalTransferService(store, now);
    const verified = await transfers.createVerifiedExport();
    if (!verified.ok) throw new Error(verified.message);
    const file = JSON.parse(JSON.stringify(verified.value.file)) as {
      data: { orders: Array<{ order: { retainedMeaning: string } }> };
    };
    file.data.orders[0]!.order.retainedMeaning = "maybe";
    const target = new MemoryLocalStore();
    const prepared = new LocalTransferService(target, now).prepareImport(JSON.stringify(file));
    expect(prepared.ok).toBe(false);
  });

  it("rejects a money-moving event without a positive amount before any write", async () => {
    const { store } = await feeOrderWithJourney();
    const transfers = new LocalTransferService(store, now);
    const verified = await transfers.createVerifiedExport();
    if (!verified.ok) throw new Error(verified.message);
    const file = JSON.parse(JSON.stringify(verified.value.file)) as {
      data: { orders: Array<{ order: { events: Array<{ type: string; amountMinor?: number }> } }> };
    };
    const grip = file.data.orders[0]!.order.events.find(event => event.type === "collection_recorded");
    if (!grip) throw new Error("collection event missing");
    delete grip.amountMinor;
    const target = new MemoryLocalStore();
    const prepared = new LocalTransferService(target, now).prepareImport(JSON.stringify(file));
    expect(prepared.ok).toBe(false);
    const orders = await target.listOrders();
    if (!orders.ok) throw new Error(orders.message);
    expect(orders.value).toHaveLength(0);
  });
});
