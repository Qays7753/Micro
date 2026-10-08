import { describe, expect, it } from "vitest";
import { CostService, type CostEditorInput } from "./costService";
import { MemoryLocalStore } from "@/storage/local/MemoryLocalStore";

/*
 * R2 (WS-216/ARCH-007 — M-06/D6، 2026-10-08): انحدار عقد «تاريخ السعر».
 * كان الكاتبان يحقنان الطابع الزمني الكامل (createdAt) في حقل تاريخ محلي
 * (MaterialCostItem.priceDate) فيمر بفحص Date.parse القديم وتُخزن طوابع
 * في لقطات الطلبات وتفسد مقارنة الحداثة المسائية (طابع UTC المتأخر يُقرأ
 * أقدم من يوم عمّان التالي). الآن: priceDate = تاريخ أعمال عمّان للطابق.
 */

const input: CostEditorInput = {
  materialItems: [{ name: "خشب", quantity: 2, unit: "لوح", unitPriceMinor: 500, confidence: "known" }],
  time: { minutes: 60, hourlyRateMinor: 600, confidence: "known" },
  packagingMinor: 0,
  deliveryMinor: 0,
  wasteMinor: 0,
  safetyBufferMinor: 0,
  quantity: 1,
};

describe("R2 regression — priceDate is a true Local Date (Amman business date of createdAt)", () => {
  it("morning timestamp derives the same-day Amman date", () => {
    const service = new CostService(new MemoryLocalStore(), () => "2026-10-07T10:30:00.000Z");
    const result = service.preview(input);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.snapshot.input.materialItems[0]!.priceDate).toBe("2026-10-07");
  });

  it("evening timestamp (after 21:00Z) derives the NEXT Amman day — was the raw timestamp", () => {
    const service = new CostService(new MemoryLocalStore(), () => "2026-10-07T21:30:00.000Z");
    const result = service.preview(input);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const priceDate = result.snapshot.input.materialItems[0]!.priceDate;
    expect(priceDate).toBe("2026-10-08");
    /* العقد: ليس طابعًا زمنيًا أبدًا — نحو ISO تقويمي فقط. */
    expect(priceDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(priceDate).not.toContain("T");
  });

  it("an evening snapshot with freshnessDays is NOT falsely stale (the M-06 repair)", () => {
    /* قبل الإصلاح: priceDate = "2026-10-07T21:30:00.000Z" < oldestAllowed
     * "2026-10-08" (سلسلة أطول تبدأ بنفس البادئة لكن الطابع يقارن أكبر...
     * العلة كانت تظهر عند freshnessDays=0 وما فوق مع تواريخ الحد) — الآن
     * priceDate يشتق من اليوم نفسه فلا حداثة كاذبة أبدًا. */
    const service = new CostService(new MemoryLocalStore(), () => "2026-10-07T21:30:00.000Z");
    const result = service.preview({ ...input, freshnessDays: 7 });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.snapshot.knowledgeState).not.toBe("stale");
  });
});
