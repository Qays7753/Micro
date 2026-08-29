import { describe, expect, it } from "vitest";
import { AgreementService } from "@/application/agreements/agreementService";
import { CostService, type CostEditorInput } from "@/application/cost/costService";
import { DraftService } from "@/application/drafts/draftService";
import { FulfillmentService } from "./fulfillmentService";
import { ScheduleService } from "@/application/scheduling/scheduleService";
import { MemoryLocalStore } from "@/storage/local/MemoryLocalStore";

const costInput: CostEditorInput = {
  materialItems: [{ name: "خشب", quantity: 1, unit: "لوح", unitPriceMinor: 1000, confidence: "known" }],
  time: { minutes: 60, hourlyRateMinor: 500, confidence: "known" },
  packagingMinor: 0,
  deliveryMinor: 0,
  wasteMinor: 0,
  safetyBufferMinor: 100,
  quantity: 1,
};
async function activeOrder(depositMinor = 500, input = costInput) {
  const store = new MemoryLocalStore();
  const drafts = new DraftService(store, () => "2026-08-22T00:00:00.000Z");
  const created = await drafts.create("customer_order");
  if (!created.ok) throw new Error("draft should create");
  const saved = await drafts.save({
    ...created.draft,
    customerName: "سارة",
    itemName: "صندوق خشبي",
    specifications: "نقش اسم",
    quantity: 1,
  });
  if (!saved.ok) throw new Error("draft should save");
  const costs = new CostService(store, () => "2026-08-22T00:01:00.000Z");
  const withCost = await costs.saveSnapshot(saved.draft, input);
  if (!withCost.ok) throw new Error("cost should save");
  const agreements = new AgreementService(store, costs, () => "2026-08-22T01:00:00.000Z");
  const agreed = await agreements.createFromDraft(withCost.draft, {
    agreedPriceMinor: 2200,
    deliveryDate: "2026-08-30",
    depositMinor,
    agreementSource: null,
  });
  if (!agreed.ok) throw new Error("agreement should save");
  const executing = await agreements.startExecution(agreed.stored.id);
  if (!executing.ok) throw new Error("execution should start");
  return { store, orderId: agreed.stored.id };
}

describe("FulfillmentService", () => {
  it("marks ready then delivers without inventing a collection, while recognizing a known-cost result", async () => {
    const { store, orderId } = await activeOrder();
    const service = new FulfillmentService(store, () => "2026-08-22T02:00:00.000Z");
    await expect(service.markReady(orderId)).resolves.toMatchObject({
      ok: true,
      stored: { order: { status: "ready", collectedMinor: 500 } },
    });
    const delivered = await service.deliver(orderId);
    expect(delivered).toMatchObject({
      ok: true,
      stored: {
        order: {
          status: "delivered",
          collectedMinor: 500,
          receivableMinor: 1700,
          recognizedRevenueMinor: 2200,
          recognizedCostMinor: 1500,
          profitIndicatorMinor: 700,
          resultStatus: "final",
        },
      },
    });
  });

  it("marks the operational schedule completed when delivery is recorded without changing financial values", async () => {
    const { store, orderId } = await activeOrder();
    const schedules = new ScheduleService(store, () => "2026-08-22T02:00:00.000Z");
    const service = new FulfillmentService(store, () => "2026-08-22T02:00:00.000Z", schedules);
    const before = await schedules.overview();
    if (!before.ok) throw new Error("schedule should load");
    await service.markReady(orderId);
    await expect(service.deliver(orderId)).resolves.toMatchObject({
      ok: true,
      stored: { order: { collectedMinor: 500, receivableMinor: 1700, recognizedRevenueMinor: 2200 } },
    });
    await expect(schedules.get(before.value.upcoming[0]!.schedule.id)).resolves.toMatchObject({
      ok: true,
      value: {
        status: "completed",
        events: [{ type: "created" }, { type: "completed", reason: "اكتمل عند تسجيل التسليم" }],
      },
    });
  });

  it("collects the remaining amount after delivery and settles the order without duplicating cash on retry", async () => {
    const { store, orderId } = await activeOrder();
    const service = new FulfillmentService(store, () => "2026-08-22T02:00:00.000Z");
    await service.markReady(orderId);
    await service.deliver(orderId);
    const collected = await service.collectFullRemaining(orderId);
    expect(collected).toMatchObject({
      ok: true,
      stored: {
        order: { status: "settled", settlementStatus: "paid", collectedMinor: 2200, receivableMinor: 0 },
      },
    });
    await expect(service.collectFullRemaining(orderId)).resolves.toMatchObject({
      ok: true,
      stored: { order: { events: collected.ok ? collected.stored.order.events : [] } },
    });
  });

  it("registers the post-delivery remainder as debt without increasing collected cash", async () => {
    const { store, orderId } = await activeOrder();
    const service = new FulfillmentService(store, () => "2026-08-22T02:00:00.000Z");
    await service.markReady(orderId);
    await service.deliver(orderId);
    await expect(service.registerRemainingDebt(orderId)).resolves.toMatchObject({
      ok: true,
      stored: {
        order: {
          status: "settled",
          settlementStatus: "debt",
          collectedMinor: 500,
          receivableMinor: 1700,
          resultStatus: "final",
        },
      },
    });
  });

  it("does not expose a final profit when delivered cost knowledge is incomplete", async () => {
    const incomplete: CostEditorInput = { ...costInput, time: null };
    const { store, orderId } = await activeOrder(0, incomplete);
    const service = new FulfillmentService(store, () => "2026-08-22T02:00:00.000Z");
    await service.markReady(orderId);
    await expect(service.deliver(orderId)).resolves.toMatchObject({
      ok: true,
      stored: {
        order: {
          status: "delivered",
          recognizedRevenueMinor: 2200,
          recognizedCostMinor: 1000,
          resultStatus: "incomplete",
          profitIndicatorMinor: null,
        },
      },
    });
  });

  /* القرار ١٩: الإلغاء بسبب اختياري، والعربون ثلاثة خيارات يشمل «يحتاج مراجعة». */
  it("cancels a pre-delivery order with a chosen reason and leaves the deposit awaiting an explicit decision", async () => {
    const { store, orderId } = await activeOrder(500);
    const service = new FulfillmentService(store, () => "2026-08-22T02:00:00.000Z");
    await expect(service.cancel(orderId, "غلط في السعر")).resolves.toMatchObject({
      ok: true,
      stored: {
        order: {
          status: "cancelled",
          settlementStatus: "cancelled_pending",
          depositSettlement: "needs_review",
          receivableMinor: 0,
          collectedMinor: 500,
        },
      },
    });
    const repeated = await service.cancel(orderId, "محاولة ثانية");
    expect(repeated.ok && repeated.stored.order.status).toBe("cancelled");
  });

  it("cancels with no reason by recording an honest unspecified reason, not by bypassing the contract", async () => {
    const { store, orderId } = await activeOrder(0);
    const service = new FulfillmentService(store, () => "2026-08-22T02:00:00.000Z");
    const cancelled = await service.cancel(orderId, "   ");
    expect(cancelled).toMatchObject({
      ok: true,
      stored: { order: { status: "cancelled", settlementStatus: "cancelled", depositSettlement: null } },
    });
    if (cancelled.ok) {
      const event = cancelled.stored.order.events.find(candidate => candidate.type === "cancelled");
      expect(event?.note).toBe("إلغاء بدون سبب محدد");
    }
  });

  it("refunds the deposit of a cancelled order so the collected balance actually drops (decision 19)", async () => {
    const { store, orderId } = await activeOrder(500);
    const service = new FulfillmentService(store, () => "2026-08-22T02:00:00.000Z");
    await service.cancel(orderId, "انسحب العميل");
    await expect(service.refundDeposit(orderId, "رد العربون نقدًا")).resolves.toMatchObject({
      ok: true,
      stored: {
        order: {
          status: "cancelled",
          settlementStatus: "cancelled_refunded",
          depositSettlement: "refund_deposit",
          collectedMinor: 0,
        },
      },
    });
  });

  it("retains the deposit of a cancelled order as a documented settlement that keeps it collected", async () => {
    const { store, orderId } = await activeOrder(500);
    const service = new FulfillmentService(store, () => "2026-08-22T02:00:00.000Z");
    await service.cancel(orderId, "انسحب العميل");
    await expect(service.retainDeposit(orderId, "احتفاظ بالعربون مقابل تجهيز بدأ")).resolves.toMatchObject({
      ok: true,
      stored: {
        order: {
          settlementStatus: "cancelled_retained",
          depositSettlement: "retain_deposit",
          collectedMinor: 500,
        },
      },
    });
  });

  it("collects every collected deposit in one honest overview, separating those awaiting settlement (owner addition)", async () => {
    const { store, orderId } = await activeOrder(500);
    const service = new FulfillmentService(store, () => "2026-08-22T02:00:00.000Z");
    await service.cancel(orderId, "غلط في السعر");
    const overview = await service.listDepositOverview();
    expect(overview).toMatchObject({
      ok: true,
      value: {
        deposits: [
          {
            orderId,
            depositCollectedMinor: 500,
            depositSettlement: "needs_review",
          },
        ],
        collectedTotalMinor: 500,
        awaitingSettlementCount: 1,
      },
    });
  });

  it("keeps the deposits overview empty and honest when no deposit was ever collected", async () => {
    const { store } = await activeOrder(0);
    const service = new FulfillmentService(store, () => "2026-08-22T02:00:00.000Z");
    const overview = await service.listDepositOverview();
    expect(overview).toMatchObject({
      ok: true,
      value: { deposits: [], collectedTotalMinor: 0, awaitingSettlementCount: 0 },
    });
  });
});
