import { describe, expect, it } from "vitest";
import { CostService, type CostEditorInput } from "./costService";
import { DraftService } from "@/application/drafts/draftService";
import { MemoryLocalStore } from "@/storage/local/MemoryLocalStore";

const completeInput: CostEditorInput = {
  materialItems: [{ name: "خشب", quantity: 2, unit: "لوح", unitPriceMinor: 500, confidence: "known" }],
  time: { minutes: 60, hourlyRateMinor: 600, confidence: "known" },
  packagingMinor: 100,
  deliveryMinor: 0,
  wasteMinor: 50,
  safetyBufferMinor: 125,
  quantity: 2,
};

describe("CostService", () => {
  it("delegates planned cost, knowledge, and price floor to Domain Core", () => {
    const service = new CostService(new MemoryLocalStore(), () => "2026-08-22T00:00:00.000Z");
    const result = service.preview(completeInput);
    expect(result).toMatchObject({
      ok: true,
      snapshot: {
        plannedCostMinor: 1750,
        unitCostMinor: 875,
        priceFloorMinor: 1000,
        knowledgeState: "known",
      },
    });
  });

  it("marks a cost with no work time as incomplete rather than silently treating time as zero", () => {
    const service = new CostService(new MemoryLocalStore(), () => "2026-08-22T00:00:00.000Z");
    const result = service.preview({ ...completeInput, time: null });
    expect(result).toMatchObject({
      ok: true,
      snapshot: { knowledgeState: "incomplete", priceFloorMinor: 700 },
    });
  });

  it("keeps a non-final estimated label when the owner marks a material as an estimate", () => {
    const service = new CostService(new MemoryLocalStore(), () => "2026-08-22T00:00:00.000Z");
    const result = service.preview({
      ...completeInput,
      materialItems: [{ ...completeInput.materialItems[0], confidence: "estimated" }],
    });
    expect(result).toMatchObject({
      ok: true,
      snapshot: { knowledgeState: "estimated", priceFloorMinor: 1000 },
    });
  });

  it("marks estimated work with a zero hourly rate as incomplete", () => {
    const service = new CostService(new MemoryLocalStore(), () => "2026-08-22T00:00:00.000Z");
    const result = service.preview({
      ...completeInput,
      time: { minutes: 60, hourlyRateMinor: 0, confidence: "estimated" },
    });
    expect(result).toMatchObject({ ok: true, snapshot: { knowledgeState: "incomplete", timeCostMinor: 0 } });
  });

  it("saves and reloads a partially known time entry without turning it into zero-rate known time", async () => {
    const store = new MemoryLocalStore();
    const drafts = new DraftService(store, () => "2026-08-22T00:00:00.000Z");
    const created = await drafts.create("customer_order");
    if (!created.ok) throw new Error("draft should be created");
    const costs = new CostService(store, () => "2026-08-22T01:00:00.000Z");
    const partialTime: CostEditorInput = {
      ...completeInput,
      time: { minutes: 45, hourlyRateMinor: null, confidence: "estimated" },
    };
    const saved = await costs.saveSnapshot(created.draft, partialTime);
    if (!saved.ok || !saved.draft) throw new Error("partial snapshot should save");
    const reloaded = await store.getDraft(saved.draft.id);
    expect(reloaded).toMatchObject({
      ok: true,
      value: { costSnapshots: [{ time: { minutes: 45, hourlyRateMinor: null, confidence: "estimated" } }] },
    });
    const preview = costs.previewStored(saved.draft.costSnapshots[0]);
    expect(preview).toMatchObject({ ok: true, snapshot: { knowledgeState: "incomplete", timeCostMinor: 0 } });
  });

  it("appends immutable draft cost records instead of mutating the earlier snapshot", async () => {
    const store = new MemoryLocalStore();
    const drafts = new DraftService(store, () => "2026-08-22T00:00:00.000Z");
    const created = await drafts.create("customer_order");
    if (!created.ok) throw new Error("draft should be created");
    const costs = new CostService(store, () => "2026-08-22T01:00:00.000Z");
    const first = await costs.saveSnapshot(created.draft, completeInput);
    if (!first.ok || !first.draft) throw new Error("first snapshot should save");
    const second = await costs.saveSnapshot(first.draft, { ...completeInput, wasteMinor: 150 });
    expect(second).toMatchObject({
      ok: true,
      draft: {
        costSnapshots: [
          { revision: 1, wasteMinor: 50 },
          { revision: 2, wasteMinor: 150 },
        ],
      },
    });
  });
});
