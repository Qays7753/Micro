import { describe, expect, it } from "vitest";
import { LocalTransferService } from "./localTransferService";
import { CostEstimateService } from "@/application/estimates/costEstimateService";
import { ProjectFinancialService } from "@/application/finance/projectFinancialService";
import { MemoryLocalStore } from "@/storage/local/MemoryLocalStore";
import { localExportVersion, localSchemaVersion } from "@/storage/local/types";

const now = () => "2026-08-30T09:00:00.000Z";

/* عقد التصدير ٢١/مخطط ٢٩: التقديرات المستقلة والأمانات والتخصيصات تعبر دورة
 * التصدير-التحقق-الاستيراد كاملة، وملفات الموجة السابقة (٢٠/٢٨) تُقبل وتُهاجر. */
describe("schema 29 export round-trip with estimates, amanah, and allocations", () => {
  it("round-trips cost estimates, amanah events, and allocations through a verified export", async () => {
    const store = new MemoryLocalStore();
    const finance = new ProjectFinancialService(store, now);
    const estimates = new CostEstimateService(store, now);
    await estimates.save({
      title: "تقدير كيكة",
      materialItems: [{ name: "دقيق", quantity: 1, unit: "كيلو", unitPriceMinor: 1200, confidence: "known" }],
      time: null,
      packagingMinor: 0,
      deliveryMinor: 0,
      wasteMinor: 0,
      safetyBufferMinor: 500,
      quantity: 1,
      note: null,
    });
    await finance.record({
      type: "amanah_held_cash",
      amountMinor: 30000,
      occurredOn: "2026-08-28",
      note: "أمانة مندوب",
      counterparty: "ليث",
      relatedEventId: null,
      idempotencyKey: "amanah-round-trip",
    });
    const transfers = new LocalTransferService(store, now);
    const verified = await transfers.createVerifiedExport();
    if (!verified.ok) throw new Error(verified.message);
    expect(verified.value.file.version).toBe(localExportVersion);
    expect(verified.value.file.schemaVersion).toBe(localSchemaVersion);
    expect(verified.value.summary.costEstimates).toBe(1);
    expect(verified.value.summary.financialEvents).toBe(1);

    /* استيراد في مخزن جديد — معاينة ثم تأكيد. */
    const target = new MemoryLocalStore();
    const targetTransfers = new LocalTransferService(target, now);
    const prepared = targetTransfers.prepareImport(JSON.stringify(verified.value.file));
    if (!prepared.ok) throw new Error(prepared.message);
    expect(prepared.value.summary.costEstimates).toBe(1);
    const confirmed = await targetTransfers.confirmImport(prepared.value);
    if (!confirmed.ok) throw new Error(confirmed.message);
    const restored = await new CostEstimateService(target, now).list();
    if (!restored.ok) throw new Error(restored.message);
    expect(restored.value[0]?.title).toBe("تقدير كيكة");
    const position = await new ProjectFinancialService(target, now).readPosition();
    if (!position.ok) throw new Error(position.message);
    expect(position.value.amanahHeldMinor).toBe(30000);
  });

  it("accepts and migrates a legacy 20/28 export by backfilling the new fields", async () => {
    const store = new MemoryLocalStore();
    const finance = new ProjectFinancialService(store, now);
    await finance.record({
      type: "owner_investment_cash",
      amountMinor: 5000,
      occurredOn: "2026-08-28",
      note: "استثمار",
      counterparty: null,
      relatedEventId: null,
      idempotencyKey: "legacy-inv",
    });
    const transfers = new LocalTransferService(store, now);
    const current = await transfers.createExport();
    if (!current.ok) throw new Error(current.message);
    /* محاكاة ملف الموجة السابقة: نسخة ٢٠/مخطط ٢٨ وبلا الحقول الجديدة. */
    const legacyFile = {
      ...JSON.parse(JSON.stringify(current.value)),
      version: 20,
      schemaVersion: 28,
    };
    delete legacyFile.data.costEstimates;
    for (const event of legacyFile.data.financialEvents) delete event.amanahDeltaMinor;
    if (legacyFile.data.preferences) delete legacyFile.data.preferences.lastVerifiedExportAt;
    const prepared = new LocalTransferService(new MemoryLocalStore(), now).prepareImport(
      JSON.stringify(legacyFile),
    );
    if (!prepared.ok) throw new Error(prepared.message);
    expect(prepared.value.file.schemaVersion).toBe(localSchemaVersion);
    expect(prepared.value.file.data.costEstimates).toEqual([]);
    expect(prepared.value.file.data.financialEvents[0]?.amanahDeltaMinor).toBe(0);
  });

  it("resetAll replaces the whole store with an empty snapshot", async () => {
    const store = new MemoryLocalStore();
    const finance = new ProjectFinancialService(store, now);
    await finance.record({
      type: "owner_investment_cash",
      amountMinor: 5000,
      occurredOn: "2026-08-28",
      note: "استثمار",
      counterparty: null,
      relatedEventId: null,
      idempotencyKey: "reset-inv",
    });
    const transfers = new LocalTransferService(store, now);
    const result = await transfers.resetAll();
    if (!result.ok) throw new Error(result.message);
    const position = await finance.readPosition();
    if (!position.ok) throw new Error(position.message);
    expect(position.value.projectEventCount).toBe(0);
    expect(position.value.recordedCashMinor).toBe(0);
    const profile = await store.getProfile();
    if (!profile.ok) throw new Error(profile.message);
    expect(profile.value).toBeNull();
  });
});
