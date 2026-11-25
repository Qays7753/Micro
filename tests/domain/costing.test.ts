/**
 * M1.1 (§14.3 / IMPACT S1 — أمر تنفيذ المرحلة ١): اختبارات نواة التكلفة
 * المحايدة الجديدة `src/domain/costing/`.
 *  - اللقطة المعروفة نفسها (قيم مأخوذة حرفيًا من اختبار cost-1 الأخضر
 *    القائم في tests/domain/craft-order.test.ts) تُشتق الآن من الوحدة
 *    الجديدة عبر سطحها العام `index.js`.
 *  - `craft-order` يعيد تصدير الدالة نفسها (هوية مرجعية واحدة) لا نسخة
 *    مكررة — «لا تنفيذ مكرر» في قبول المهمة.
 */
import { describe, expect, it } from "vitest";
import {
  calculateCostSnapshot,
  type CostSnapshot,
  type CostSnapshotInput,
} from "../../src/domain/costing/index.js";
import { calculateCostSnapshot as craftOrderCalculateCostSnapshot } from "../../src/domain/craft-order/index.js";

const costSnapshotInput: CostSnapshotInput = {
  currency: "JOD",
  materialItems: [
    {
      name: "خشب",
      quantity: 2,
      unit: "قطعة",
      unitPriceMinor: 500,
      priceDate: "2026-08-21",
      source: "user_input",
      confidence: "known",
    },
    {
      name: "طلاء",
      quantity: 1.5,
      unit: "ملعقة",
      unitPriceMinor: 300,
      priceDate: "2026-08-21",
      source: "user_input",
      confidence: "known",
    },
  ],
  time: { minutes: 120, hourlyRateMinor: 600, confidence: "known" },
  packagingMinor: 100,
  deliveryMinor: 200,
  wasteMinor: 50,
  safetyBufferMinor: 500,
  quantity: 1,
  createdAt: "2026-08-21T09:00:00Z",
  source: "price_approval",
};

describe("M1.1 (§14.3 / IMPACT S1) — costing core module", () => {
  it("calculateCostSnapshot from src/domain/costing returns the known cost-1 snapshot", () => {
    const snapshot: CostSnapshot = calculateCostSnapshot("cost-1", costSnapshotInput);
    expect(snapshot.materialCostMinor).toBe(1450);
    expect(snapshot.timeCostMinor).toBe(1200);
    expect(snapshot.plannedCostMinor).toBe(3000);
    expect(snapshot.unitCostMinor).toBe(3000);
    expect(snapshot.priceFloorMinor).toBe(3500);
    expect(snapshot.knowledgeState).toBe("known");
  });

  it("craft-order re-exports the exact same calculateCostSnapshot (no duplicated implementation)", () => {
    expect(craftOrderCalculateCostSnapshot).toBe(calculateCostSnapshot);
  });
});
