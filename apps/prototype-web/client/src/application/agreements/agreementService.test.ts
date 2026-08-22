import { describe, expect, it } from "vitest";
import { AgreementService } from "./agreementService";
import { CostService, type CostEditorInput } from "@/application/cost/costService";
import { DraftService } from "@/application/drafts/draftService";
import { MemoryLocalStore } from "@/storage/local/MemoryLocalStore";

const costInput: CostEditorInput = { materialItems: [{ name: "خشب", quantity: 1, unit: "لوح", unitPriceMinor: 1000, confidence: "known" }], time: { minutes: 60, hourlyRateMinor: 500, confidence: "known" }, packagingMinor: 0, deliveryMinor: 0, wasteMinor: 0, safetyBufferMinor: 100, quantity: 1 };
async function preparedDraft() {
  const store = new MemoryLocalStore(); const drafts = new DraftService(store, () => "2026-08-22T00:00:00.000Z"); const created = await drafts.create("customer_order");
  if (!created.ok) throw new Error("draft should create");
  const saved = await drafts.save({ ...created.draft, customerName: "سارة", itemName: "صندوق خشبي", specifications: "نقش اسم", quantity: 1 });
  if (!saved.ok) throw new Error("draft should save");
  const costs = new CostService(store, () => "2026-08-22T00:01:00.000Z"); const withCost = await costs.saveSnapshot(saved.draft, costInput);
  if (!withCost.ok) throw new Error("cost should save");
  return { store, costs, draft: withCost.draft };
}

describe("AgreementService", () => {
  it("creates a provisional agreement and records deposit as collected cash, not profit", async () => {
    const { store, costs, draft } = await preparedDraft(); const service = new AgreementService(store, costs, () => "2026-08-22T01:00:00.000Z");
    const result = await service.createFromDraft(draft, { agreedPriceMinor: 2200, deliveryDate: "2026-08-30", depositMinor: 500, agreementSource: "in_person" });
    expect(result).toMatchObject({ ok: true, stored: { deliveryDate: "2026-08-30", order: { status: "provisional_agreement", agreedPriceMinor: 2200, depositCollectedMinor: 500, collectedMinor: 500, receivableMinor: 1700, recognizedRevenueMinor: 0, profitIndicatorMinor: null } } });
  });

  it("returns the existing local agreement on retry instead of duplicating events or cash", async () => {
    const { store, costs, draft } = await preparedDraft(); const service = new AgreementService(store, costs, () => "2026-08-22T01:00:00.000Z");
    const first = await service.createFromDraft(draft, { agreedPriceMinor: 2200, deliveryDate: "2026-08-30", depositMinor: 500, agreementSource: null });
    if (!first.ok) throw new Error("agreement should save");
    const linked = await store.getDraft(draft.id); if (!linked.ok || !linked.value) throw new Error("linked draft should exist");
    const repeated = await service.createFromDraft(linked.value, { agreedPriceMinor: 2200, deliveryDate: "2026-08-30", depositMinor: 500, agreementSource: null });
    expect(repeated).toMatchObject({ ok: true, stored: { id: first.stored.id, order: { collectedMinor: 500, events: first.stored.order.events } } });
  });

  it("requires a valid agreement and starts execution without adding a second cash event", async () => {
    const { store, costs, draft } = await preparedDraft(); const service = new AgreementService(store, costs, () => "2026-08-22T01:00:00.000Z");
    await expect(service.createFromDraft(draft, { agreedPriceMinor: 1000, deliveryDate: "", depositMinor: 0, agreementSource: null })).resolves.toMatchObject({ ok: false, code: "validation_error" });
    const agreed = await service.createFromDraft(draft, { agreedPriceMinor: 2200, deliveryDate: "2026-08-30", depositMinor: 500, agreementSource: null }); if (!agreed.ok) throw new Error("agreement should save");
    const started = await service.startExecution(agreed.stored.id);
    expect(started).toMatchObject({ ok: true, stored: { order: { status: "in_progress", collectedMinor: 500, depositCollectedMinor: 500 } } });
    await expect(service.startExecution(agreed.stored.id)).resolves.toMatchObject({ ok: true, stored: { order: { events: started.ok ? started.stored.order.events : [] } } });
  });
});
