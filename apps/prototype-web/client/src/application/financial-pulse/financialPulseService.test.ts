import { describe, expect, it } from "vitest";
import { AgreementService } from "@/application/agreements/agreementService";
import { CostService, type CostEditorInput } from "@/application/cost/costService";
import { DraftService } from "@/application/drafts/draftService";
import { FulfillmentService } from "@/application/fulfillment/fulfillmentService";
import { MemoryLocalStore } from "@/storage/local/MemoryLocalStore";
import { FinancialPulseService, summarizeLocalCraftOrders } from "./financialPulseService";

const knownCost: CostEditorInput = { materialItems: [{ name: "خشب", quantity: 1, unit: "لوح", unitPriceMinor: 1000, confidence: "known" }], time: { minutes: 60, hourlyRateMinor: 500, confidence: "known" }, packagingMinor: 0, deliveryMinor: 0, wasteMinor: 0, safetyBufferMinor: 100, quantity: 1 };

async function storedDeliveredOrder({ debt }: { debt: boolean }) {
  const store = new MemoryLocalStore(); const drafts = new DraftService(store, () => "2026-08-22T00:00:00.000Z"); const created = await drafts.create("customer_order"); if (!created.ok) throw new Error("draft should create");
  const saved = await drafts.save({ ...created.draft, customerName: "سارة", itemName: "صندوق خشبي", specifications: "نقش اسم", quantity: 1 }); if (!saved.ok) throw new Error("draft should save");
  const costs = new CostService(store, () => "2026-08-22T00:01:00.000Z"); const withCost = await costs.saveSnapshot(saved.draft, knownCost); if (!withCost.ok) throw new Error("cost should save");
  const agreements = new AgreementService(store, costs, () => "2026-08-22T01:00:00.000Z"); const agreed = await agreements.createFromDraft(withCost.draft, { agreedPriceMinor: 2200, deliveryDate: "2026-08-30", depositMinor: 500, agreementSource: null }); if (!agreed.ok) throw new Error("agreement should save"); await agreements.startExecution(agreed.stored.id);
  const fulfillment = new FulfillmentService(store, () => "2026-08-22T02:00:00.000Z"); await fulfillment.markReady(agreed.stored.id); await fulfillment.deliver(agreed.stored.id); if (debt) await fulfillment.registerRemainingDebt(agreed.stored.id);
  const list = await store.listOrders(); if (!list.ok) throw new Error("orders should list"); return { store, order: list.value[0] };
}

describe("FinancialPulseService", () => {
  it("separates registered collection, post-delivery debt, and final-order recognition without inventing project profit", async () => {
    const debt = await storedDeliveredOrder({ debt: true }); const paid = await storedDeliveredOrder({ debt: false });
    const pulse = summarizeLocalCraftOrders([debt.order, paid.order]);
    expect(pulse).toMatchObject({ totalOrderCount: 2, deliveredOrSettledOrderCount: 2, registeredCollectionsMinor: 1000, registeredDebtMinor: 1700, finalResultOrderCount: 2, recognizedRevenueFromFinalOrdersMinor: 4400, recognizedCostFromFinalOrdersMinor: 3000 });
    expect("projectProfitMinor" in pulse).toBe(false);
  });

  it("reads the pulse through the LocalStore port", async () => {
    const { store } = await storedDeliveredOrder({ debt: true });
    await expect(new FinancialPulseService(store).read()).resolves.toMatchObject({ ok: true, pulse: { registeredCollectionsMinor: 500, registeredDebtMinor: 1700, finalResultOrderCount: 1 } });
  });
});
