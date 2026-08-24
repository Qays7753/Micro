import { describe, expect, it } from "vitest";
import { GuidedOpeningImportService } from "./guidedOpeningImportService";
import { MemoryLocalStore } from "@/storage/local/MemoryLocalStore";

const valid = { format: "micro-guided-opening-import", version: 1, importId: "opening-2026-08-24-valid", profile: { activityName: "مخبز صغير", currency: "JOD", activityType: "custom_craft", source: "عد يدوي", knowledge: "known", occurredOn: "2026-08-01", note: "بداية معلنة" }, cashWallets: [{ id: "drawer", name: "درج", kind: "cash_drawer", openingMinor: 12500, source: "عد يدوي", knowledge: "known", occurredOn: "2026-08-01", note: "عد المالك" }], materials: [{ id: "flour", name: "طحين", unit: "kilogram", openingQuantityMilli: 2500, openingValueMinor: 8750, source: "جرد", knowledge: "estimated", occurredOn: "2026-08-01", note: "تقدير آخر شراء" }] };

describe("GuidedOpeningImportService", () => {
  it("previews then atomically confirms a valid opening position", async () => {
    const store = new MemoryLocalStore(); const service = new GuidedOpeningImportService(store, () => "2026-08-24T10:00:00.000Z");
    const preview = await service.prepare(JSON.stringify(valid)); expect(preview).toMatchObject({ ok: true, value: { summary: { acceptedWallets: 1, acceptedMaterials: 1, acceptedCashMinor: 12500, estimatedRecords: 1 } } });
    if (!preview.ok) return;
    await expect(store.readSnapshot()).resolves.toMatchObject({ ok: true, value: { profile: null, cashWallets: [] } });
    await expect(service.confirm(preview.value)).resolves.toMatchObject({ ok: true, value: { acceptedWallets: 1 } });
    await expect(store.readSnapshot()).resolves.toMatchObject({ ok: true, value: { profile: { activityName: "مخبز صغير" }, cashWallets: [{ name: "درج" }], cashContinuityEntries: [{ cashDeltaMinor: 12500 }], materials: [{ name: "طحين" }], inventoryMovements: [{ quantityDeltaMilli: 2500, valueDeltaMinor: 8750 }] } });
  });

  it.each([["{not-json", "validation_error"], [JSON.stringify({ ...valid, version: 99 }), "validation_error"], [JSON.stringify({ ...valid, profile: { ...valid.profile, source: "" } }), "validation_error"]])("rejects %s before writing", async (text) => {
    const store = new MemoryLocalStore(); const service = new GuidedOpeningImportService(store); const result = await service.prepare(text); expect(result).toMatchObject({ ok: false, code: "validation_error" }); await expect(store.readSnapshot()).resolves.toMatchObject({ ok: true, value: { profile: null, cashWallets: [], materials: [] } });
  });

  it("rejects a non-empty store and does not overwrite it", async () => {
    const store = new MemoryLocalStore(); await store.saveProfile({ id: "local-profile", activityName: "قديم", currency: "JOD", activityType: "custom_craft", createdAt: "2026-08-01T00:00:00.000Z", updatedAt: "2026-08-01T00:00:00.000Z" });
    const result = await new GuidedOpeningImportService(store).prepare(JSON.stringify(valid)); expect(result).toMatchObject({ ok: false, code: "non_empty_store" }); await expect(store.getProfile()).resolves.toMatchObject({ ok: true, value: { activityName: "قديم" } });
  });

  it("is idempotent when the same import is retried", async () => {
    const store = new MemoryLocalStore(); const service = new GuidedOpeningImportService(store); const preview = await service.prepare(JSON.stringify(valid)); if (!preview.ok) throw new Error(preview.message); await service.confirm(preview.value); const retry = await service.prepare(JSON.stringify(valid)); expect(retry).toMatchObject({ ok: true, reused: true }); const confirmed = await service.confirm(preview.value); expect(confirmed).toMatchObject({ ok: true, reused: true }); await expect(store.listCashContinuityEntries()).resolves.toMatchObject({ ok: true, value: [{ cashDeltaMinor: 12500 }] });
  });
});
