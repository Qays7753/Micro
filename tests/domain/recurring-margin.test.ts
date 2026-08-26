import { describe, expect, it } from "vitest";
import { calculateAllocationPolicy, createAllocationPolicy, isValidWasteContext } from "../../src/domain/recurring-margin/index.js";
import type { AllocationEvidence } from "../../src/domain/recurring-margin/index.js";

const evidence: AllocationEvidence = { catalogItemId: "catalog-1", periodFrom: "2026-08-01", periodTo: "2026-08-31", finalOrderIds: ["order-1", "order-2"], excludedOrderIds: [], outputQuantity: 5, outputUnitId: "unit-piece", actualTimeMinutes: 10, missingTimeOrderIds: [], recognizedRevenueMinor: 10_000, missingRevenueOrderIds: [], directMarginMinor: 4_000 };
const base = { id: "policy", seriesId: "series", successorOfPolicyId: null, version: 1, catalogItemId: "catalog-1", periodFrom: "2026-08-01", periodTo: "2026-08-31", startsOn: "2026-08-01", endsOn: "2026-08-31", source: "اختبار", reason: "سبب", note: "ملاحظة", status: "active" as const, idempotencyKey: "policy-key", createdAt: "2026-08-01T00:00:00.000Z", updatedAt: "2026-08-01T00:00:00.000Z" };

describe("G4-B recurring margin Domain", () => {
  it("calculates each allowed allocation basis from explicit evidence only", () => {
    const manual = calculateAllocationPolicy(createAllocationPolicy({ ...base, kind: "manual_amount", amountMinor: 250, rateMinor: null, percentageBps: null, unitId: null }), evidence);
    const perUnit = calculateAllocationPolicy(createAllocationPolicy({ ...base, id: "per-unit", idempotencyKey: "per-unit", kind: "per_output_unit", amountMinor: null, rateMinor: 100, percentageBps: null, unitId: "unit-piece" }), evidence);
    const time = calculateAllocationPolicy(createAllocationPolicy({ ...base, id: "time", idempotencyKey: "time", kind: "actual_time", amountMinor: null, rateMinor: 100, percentageBps: null, unitId: null }), evidence);
    const percentage = calculateAllocationPolicy(createAllocationPolicy({ ...base, id: "percentage", idempotencyKey: "percentage", kind: "completed_revenue_percentage", amountMinor: null, rateMinor: null, percentageBps: 500, unitId: null }), evidence);
    expect(manual).toMatchObject({ status: "known", amountMinor: 250, resultMinor: 3_750 });
    expect(perUnit).toMatchObject({ status: "known", amountMinor: 500, resultMinor: 3_500 });
    expect(time).toMatchObject({ status: "known", amountMinor: 1_000, resultMinor: 3_000 });
    expect(percentage).toMatchObject({ status: "known", amountMinor: 500, resultMinor: 3_500 });
  });

  it("never converts missing evidence into a zero allocation", () => {
    const policy = createAllocationPolicy({ ...base, kind: "actual_time", amountMinor: null, rateMinor: 100, percentageBps: null, unitId: null });
    const result = calculateAllocationPolicy(policy, { ...evidence, actualTimeMinutes: null, missingTimeOrderIds: ["order-1"] });
    expect(result).toMatchObject({ status: "incomplete", amountMinor: null, resultMinor: null, nextAction: expect.stringContaining("أكمل") });
  });

  it("accepts only the five bounded waste context shapes", () => {
    expect(isValidWasteContext({ kind: "order", orderId: "order-1" })).toBe(true);
    expect(isValidWasteContext({ kind: "catalog_item", catalogItemId: "catalog-1" })).toBe(true);
    expect(isValidWasteContext({ kind: "catalog_template", catalogItemId: "catalog-1", templateId: "template-1" })).toBe(true);
    expect(isValidWasteContext({ kind: "general_project" })).toBe(true);
    expect(isValidWasteContext({ kind: "unallocated", allocationNote: null })).toBe(true);
    expect(isValidWasteContext({ kind: "order", orderId: "" })).toBe(false);
    expect(isValidWasteContext({ kind: "unknown" })).toBe(false);
  });
});
