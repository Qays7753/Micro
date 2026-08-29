import { describe, expect, it } from "vitest";
import {
  calculateAllocationPolicy,
  createAllocationPolicy,
  isValidWasteContext,
  perOutputUnitAmountMinor,
} from "../../src/domain/recurring-margin/index.js";
import type { AllocationEvidence } from "../../src/domain/recurring-margin/index.js";

const evidence: AllocationEvidence = {
  catalogItemId: "catalog-1",
  periodFrom: "2026-08-01",
  periodTo: "2026-08-31",
  finalOrderIds: ["order-1", "order-2"],
  excludedOrderIds: [],
  outputQuantityMilli: 5_000,
  outputUnitId: "unit-piece",
  actualTimeMinutes: 10,
  missingTimeOrderIds: [],
  recognizedRevenueMinor: 10_000,
  missingRevenueOrderIds: [],
  directMarginMinor: 4_000,
};
const base = {
  id: "policy",
  seriesId: "series",
  successorOfPolicyId: null,
  version: 1,
  catalogItemId: "catalog-1",
  periodFrom: "2026-08-01",
  periodTo: "2026-08-31",
  startsOn: "2026-08-01",
  endsOn: "2026-08-31",
  source: "اختبار",
  reason: "سبب",
  note: "ملاحظة",
  status: "active" as const,
  idempotencyKey: "policy-key",
  createdAt: "2026-08-01T00:00:00.000Z",
  updatedAt: "2026-08-01T00:00:00.000Z",
};

describe("G4-B recurring margin Domain", () => {
  it("calculates each allowed allocation basis from explicit evidence only", () => {
    const manual = calculateAllocationPolicy(
      createAllocationPolicy({
        ...base,
        kind: "manual_amount",
        amountMinor: 250,
        rateMinor: null,
        percentageBps: null,
        unitId: null,
      }),
      evidence,
    );
    const perUnit = calculateAllocationPolicy(
      createAllocationPolicy({
        ...base,
        id: "per-unit",
        idempotencyKey: "per-unit",
        kind: "per_output_unit",
        amountMinor: null,
        rateMinor: null,
        rateMinorPerWholeUnit: 50,
        percentageBps: null,
        unitId: "unit-piece",
      }),
      evidence,
    );
    const time = calculateAllocationPolicy(
      createAllocationPolicy({
        ...base,
        id: "time",
        idempotencyKey: "time",
        kind: "actual_time",
        amountMinor: null,
        rateMinor: 100,
        percentageBps: null,
        unitId: null,
      }),
      evidence,
    );
    const percentage = calculateAllocationPolicy(
      createAllocationPolicy({
        ...base,
        id: "percentage",
        idempotencyKey: "percentage",
        kind: "completed_revenue_percentage",
        amountMinor: null,
        rateMinor: null,
        percentageBps: 500,
        unitId: null,
      }),
      evidence,
    );
    expect(manual).toMatchObject({ status: "known", amountMinor: 250, resultMinor: 3_750 });
    expect(perUnit).toMatchObject({
      status: "known",
      amountMinor: 250,
      resultMinor: 3_750,
      calculationNote: expect.stringContaining("1.000"),
    });
    expect(time).toMatchObject({ status: "known", amountMinor: 1_000, resultMinor: 3_000 });
    expect(percentage).toMatchObject({ status: "known", amountMinor: 500, resultMinor: 3_500 });
  });

  it("uses the canonical whole-unit scale and preserves the legacy input alias", () => {
    const legacyInput = createAllocationPolicy({
      ...base,
      kind: "per_output_unit",
      amountMinor: null,
      rateMinor: 50,
      percentageBps: null,
      unitId: "unit-piece",
    });
    const oneUnit = calculateAllocationPolicy(legacyInput, {
      ...evidence,
      outputQuantityMilli: 1_000,
      finalOrderIds: ["order-1"],
    });
    const twelveUnits = calculateAllocationPolicy(legacyInput, { ...evidence, outputQuantityMilli: 12_000 });
    expect(legacyInput).toMatchObject({ rateMinorPerWholeUnit: 50, rateMinor: null });
    expect(oneUnit).toMatchObject({ status: "known", amountMinor: 50 });
    expect(twelveUnits).toMatchObject({ status: "known", amountMinor: 600 });
  });

  it("sums thousandths before one half-up rounding", () => {
    const policy = createAllocationPolicy({
      ...base,
      kind: "per_output_unit",
      amountMinor: null,
      rateMinor: null,
      rateMinorPerWholeUnit: 50,
      percentageBps: null,
      unitId: "unit-piece",
    });
    const aggregated = calculateAllocationPolicy(policy, {
      ...evidence,
      outputQuantityMilli: 333 + 333 + 334,
    });
    const halfUp = calculateAllocationPolicy(policy, { ...evidence, outputQuantityMilli: 1_010 });
    expect(aggregated).toMatchObject({ status: "known", amountMinor: 50 });
    expect(halfUp).toMatchObject({
      status: "known",
      amountMinor: 51,
      calculationNote: expect.stringContaining("مرة واحدة"),
    });
  });

  it("keeps zero after rounding as a known, explained calculation", () => {
    const policy = createAllocationPolicy({
      ...base,
      kind: "per_output_unit",
      amountMinor: null,
      rateMinor: null,
      rateMinorPerWholeUnit: 1,
      percentageBps: null,
      unitId: "unit-piece",
    });
    const result = calculateAllocationPolicy(policy, { ...evidence, outputQuantityMilli: 1 });
    expect(result).toMatchObject({
      status: "known",
      amountMinor: 0,
      resultMinor: 4_000,
      reasons: [expect.stringContaining("نتيجة حسابية معلنة")],
      calculationNote: expect.stringContaining("الصفر نتيجة حسابية"),
    });
  });

  it("returns incomplete instead of a misleading number on safe-integer overflow", () => {
    const policy = createAllocationPolicy({
      ...base,
      kind: "per_output_unit",
      amountMinor: null,
      rateMinor: null,
      rateMinorPerWholeUnit: 2,
      percentageBps: null,
      unitId: "unit-piece",
    });
    const result = calculateAllocationPolicy(policy, {
      ...evidence,
      outputQuantityMilli: Number.MAX_SAFE_INTEGER,
    });
    expect(result).toMatchObject({
      status: "incomplete",
      amountMinor: null,
      resultMinor: null,
      reasons: [expect.stringContaining("الدقة الآمنة")],
    });
  });

  it("never converts missing evidence into a zero allocation", () => {
    const policy = createAllocationPolicy({
      ...base,
      kind: "actual_time",
      amountMinor: null,
      rateMinor: 100,
      percentageBps: null,
      unitId: null,
    });
    const result = calculateAllocationPolicy(policy, {
      ...evidence,
      actualTimeMinutes: null,
      missingTimeOrderIds: ["order-1"],
    });
    expect(result).toMatchObject({
      status: "incomplete",
      amountMinor: null,
      resultMinor: null,
      nextAction: expect.stringContaining("أكمل"),
    });
  });

  it("accepts only the five bounded waste context shapes", () => {
    expect(isValidWasteContext({ kind: "order", orderId: "order-1" })).toBe(true);
    expect(isValidWasteContext({ kind: "catalog_item", catalogItemId: "catalog-1" })).toBe(true);
    expect(
      isValidWasteContext({ kind: "catalog_template", catalogItemId: "catalog-1", templateId: "template-1" }),
    ).toBe(true);
    expect(isValidWasteContext({ kind: "general_project" })).toBe(true);
    expect(isValidWasteContext({ kind: "unallocated", allocationNote: null })).toBe(true);
    expect(isValidWasteContext({ kind: "order", orderId: "" })).toBe(false);
    expect(isValidWasteContext({ kind: "unknown" })).toBe(false);
  });
});

describe("perOutputUnitAmountMinor (A-07 shared preview)", () => {
  it("rounds the period total half-up to the nearest minor unit at milli boundaries", () => {
    expect(perOutputUnitAmountMinor(2_475, 100)).toEqual({ amountMinor: 248 });
    expect(perOutputUnitAmountMinor(1_000, 100)).toEqual({ amountMinor: 100 });
    expect(perOutputUnitAmountMinor(2_450, 100)).toEqual({ amountMinor: 245 });
  });
  it("classifies missing, unsafe, and overflowing inputs instead of rounding them", () => {
    expect(perOutputUnitAmountMinor(null, 100)).toEqual({ problem: "missing_input" });
    expect(perOutputUnitAmountMinor(1_000, null)).toEqual({ problem: "missing_input" });
    expect(perOutputUnitAmountMinor(0, 100)).toEqual({ problem: "unsafe_range" });
    expect(perOutputUnitAmountMinor(1_000, -5)).toEqual({ problem: "unsafe_range" });
    expect(perOutputUnitAmountMinor(Number.MAX_SAFE_INTEGER, 2)).toEqual({ problem: "unsafe_range" });
  });
});
