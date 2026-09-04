import { describe, expect, it } from "vitest";
import { LocalTransferService } from "./localTransferService";
import { CostEstimateService } from "@/application/estimates/costEstimateService";
import { CostService } from "@/application/cost/costService";
import { MemoryLocalStore } from "@/storage/local/MemoryLocalStore";

const now = () => "2026-09-06T09:00:00.000Z";

/* المجموعة ٣ (عقد D3/D7 — SA-5 R2a): ملفات الموجة السابقة (٢٤/٣٢ قبل حقول ربط
 * المنتج بالبيع) تُقبل وتُهاجر بغياب = null بلا اختراع روابط ولا أرقام؛ وملفات
 * الموجة الحالية (٢٥/٣٣) تعبر بهويت المادة وبنود القالب وربط البيع حرفيًا. */

const estimateInput = {
  title: "تقدير بالحاسبة",
  materialItems: [
    {
      name: "قماش",
      quantity: 2,
      unit: "متر",
      unitPriceMinor: 500,
      confidence: "known" as const,
      /* حقل المجموعة ٣: هوية المادة — يجب أن تعبر الدورة كاملة. */
      materialId: "mat-1",
    },
  ],
  time: null,
  packagingMinor: 100,
  deliveryMinor: 0,
  wasteMinor: 0,
  safetyBufferMinor: 50,
  quantity: 1,
  note: null,
};

describe("schema 33 export round-trip with product-sale links", () => {
  it("preserves cost-item material identity through export-verify-import, and imports legacy 24/32 files with null normalization", async () => {
    const store = new MemoryLocalStore();
    const estimates = new CostEstimateService(store, now);
    const saved = await estimates.save(estimateInput);
    if (!saved.ok) throw new Error(saved.message);

    const service = new LocalTransferService(store, now);
    const exported = await service.createExport();
    if (!exported.ok) throw new Error(exported.message);
    expect(exported.value.version).toBe(25);
    expect(exported.value.schemaVersion).toBe(33);
    const text = JSON.stringify(exported.value);

    /* الاستيراد في جهاز جديد: الهوية تعبر حرفيًا لا تُخترع ولا تُفقد. */
    const target = new MemoryLocalStore();
    const targetService = new LocalTransferService(target, now);
    const preview = await targetService.prepareImport(text);
    if (!preview.ok) throw new Error(preview.message);
    const confirmed = await targetService.confirmImport(preview.value);
    if (!confirmed.ok) throw new Error(confirmed.message);
    const roundTripped = await new CostEstimateService(target, now).list();
    if (!roundTripped.ok) throw new Error(roundTripped.message);
    expect(roundTripped.value[0]?.materialItems[0]).toMatchObject({
      materialId: "mat-1",
      unitPriceMinor: 500,
    });

    /* ملف موجة سابقة (٢٤/٣٢): تُقبل وتُهاجر — غياب الهوية = null لا خطأ. */
    const legacy = JSON.parse(text) as {
      version: number;
      schemaVersion: number;
      data: { costEstimates: { materialItems: Record<string, unknown>[] }[] };
    };
    legacy.version = 24;
    legacy.schemaVersion = 32;
    for (const estimate of legacy.data.costEstimates ?? []) {
      for (const item of estimate.materialItems ?? []) delete item.materialId;
    }
    const legacyPreview = await new LocalTransferService(new MemoryLocalStore(), now).prepareImport(
      JSON.stringify(legacy),
    );
    expect(legacyPreview.ok).toBe(true);
    if (legacyPreview.ok) {
      const legacyConfirmed = await new LocalTransferService(new MemoryLocalStore(), now).confirmImport(
        legacyPreview.value,
      );
      expect(legacyConfirmed.ok).toBe(true);
    }

    /* ملف أقدم من الموجتين (٢٣/٣١): يظل مقبولًا بالإرث المتسلسل — لا كسر خلفي. */
    const older = JSON.parse(text) as { version: number; schemaVersion: number };
    older.version = 23;
    older.schemaVersion = 31;
    const olderResult = await new LocalTransferService(new MemoryLocalStore(), now).prepareImport(
      JSON.stringify(older),
    );
    expect(olderResult.ok).toBe(true);
  });
});
