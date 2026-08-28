import { describe, expect, it } from "vitest";
import { calculateCostSnapshot } from "../../src/domain/craft-order/index.js";
import { calculateSharedProjectShareMinor } from "../../src/domain/financial-event/index.js";
import {
  addSafe,
  assertId,
  ceilRatio,
  isValidLocalDate,
  roundHalfUp,
} from "../../src/domain/shared/index.js";
import {
  calculateAllocationPolicy,
  createAllocationPolicy,
} from "../../src/domain/recurring-margin/index.js";
import type { AllocationEvidence } from "../../src/domain/recurring-margin/index.js";

describe("shared Domain policy vectors", () => {
  it("preserves line-item and unit-cost rounding policies", () => {
    const snapshot = calculateCostSnapshot("cost-vector", {
      currency: "JOD",
      materialItems: [
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
      time: null,
      packagingMinor: 0,
      deliveryMinor: 0,
      wasteMinor: 0,
      safetyBufferMinor: 0,
      quantity: 3,
      createdAt: "2026-08-21T09:00:00Z",
      source: "draft",
    });

    expect(snapshot.materialCostMinor).toBe(450);
    expect(snapshot.plannedCostMinor).toBe(450);
    expect(snapshot.unitCostMinor).toBe(150);

    const ceilingSnapshot = calculateCostSnapshot("cost-ceiling-vector", {
      currency: "JOD",
      materialItems: [
        {
          name: "خامة",
          quantity: 1,
          unit: "قطعة",
          unitPriceMinor: 100,
          priceDate: "2026-08-21",
          source: "user_input",
          confidence: "known",
        },
      ],
      time: null,
      packagingMinor: 0,
      deliveryMinor: 0,
      wasteMinor: 0,
      safetyBufferMinor: 0,
      quantity: 3,
      createdAt: "2026-08-21T09:00:00Z",
      source: "draft",
    });

    expect(ceilingSnapshot.plannedCostMinor).toBe(100);
    expect(ceilingSnapshot.unitCostMinor).toBe(34);
    expect(ceilingSnapshot.unitCostMinor * ceilingSnapshot.quantity).toBe(102);
  });

  it("preserves shared half-up, quantity-milli, and G5 share vectors", () => {
    expect(roundHalfUp(5, 2)).toBe(3);
    expect(roundHalfUp(4, 2)).toBe(2);
    expect(ceilRatio(2_500, 1_000)).toBe(3);
    expect(calculateSharedProjectShareMinor(10_000, 500)).toBe(500);

    const evidence: AllocationEvidence = {
      catalogItemId: "catalog-vector",
      periodFrom: "2026-08-01",
      periodTo: "2026-08-31",
      finalOrderIds: ["order-vector"],
      excludedOrderIds: [],
      outputQuantityMilli: 5_000,
      outputUnitId: "unit-piece",
      actualTimeMinutes: 10,
      missingTimeOrderIds: [],
      recognizedRevenueMinor: 10_000,
      missingRevenueOrderIds: [],
      directMarginMinor: 4_000,
    };
    const policy = createAllocationPolicy({
      id: "policy-vector",
      seriesId: "series-vector",
      successorOfPolicyId: null,
      version: 1,
      catalogItemId: "catalog-vector",
      periodFrom: "2026-08-01",
      periodTo: "2026-08-31",
      startsOn: "2026-08-01",
      endsOn: "2026-08-31",
      source: "اختبار",
      reason: "متجه سياسة",
      note: "متجه كمية milli",
      status: "active",
      idempotencyKey: "policy-vector-key",
      createdAt: "2026-08-01T00:00:00.000Z",
      updatedAt: "2026-08-01T00:00:00.000Z",
      kind: "per_output_unit",
      amountMinor: null,
      rateMinor: null,
      rateMinorPerWholeUnit: 50,
      percentageBps: null,
      unitId: "unit-piece",
    });

    expect(calculateAllocationPolicy(policy, evidence)).toMatchObject({ amountMinor: 250, status: "known" });
  });

  it("preserves shared overflow and validation guards", () => {
    expect(addSafe(Number.MAX_SAFE_INTEGER, 1)).toBeNull();
    expect(isValidLocalDate("2026-02-30")).toBe(false);
    expect(isValidLocalDate("2026-02-28")).toBe(true);
    expect(() => assertId("", "vectorId")).toThrow("vectorId is required");
  });
});
