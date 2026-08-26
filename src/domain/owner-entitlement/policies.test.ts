import { describe, expect, it } from "vitest";
import { calculateOwnerEntitlement, createOwnerEntitlementPolicy, createOwnerMovement, createOwnerMovementReversal } from "./index.js";

const basePolicy = { id: "policy-1", version: 1, family: "time_period" as const, kind: "monthly" as const, amountMinor: 1500, percentageBps: null, unitLabel: null, startsOn: "2026-08-01", endsOn: null, source: "اتفاق المالك", note: "استحقاق شهري", status: "active" as const, idempotencyKey: "policy-1", createdAt: "2026-08-01T08:00:00.000Z" };

describe("owner entitlement Domain", () => {
  it("keeps dated policies immutable and calculates a fixed period amount", () => {
    const policy = createOwnerEntitlementPolicy(basePolicy);
    expect(policy.amountMinor).toBe(1500);
    expect(calculateOwnerEntitlement(policy, { periodFrom: "2026-08-01", periodTo: "2026-08-31" })).toMatchObject({ amountMinor: 1500, knowledge: "known", calculationBasis: "time_period" });
    expect(() => createOwnerEntitlementPolicy({ ...basePolicy, id: "policy-2", version: 2, startsOn: "2026-09-01", amountMinor: 2000, idempotencyKey: "policy-2" })).not.toThrow();
  });

  it("does not turn missing hourly time or missing units into zero", () => {
    const hourly = createOwnerEntitlementPolicy({ ...basePolicy, id: "hourly", kind: "hourly", amountMinor: 600, idempotencyKey: "hourly" });
    expect(calculateOwnerEntitlement(hourly, { periodFrom: "2026-08-01", periodTo: "2026-08-31" })).toMatchObject({ amountMinor: null, knowledge: "incomplete" });
    const unit = createOwnerEntitlementPolicy({ ...basePolicy, id: "unit", family: "unit", kind: "per_unit", amountMinor: 25, unitLabel: "قطعة", idempotencyKey: "unit" });
    expect(calculateOwnerEntitlement(unit, { periodFrom: "2026-08-01", periodTo: "2026-08-31", unitQuantity: 4 })).toMatchObject({ amountMinor: 100, quantity: 4 });
  });

  it("does not claim a fixed-shift amount without shift evidence", () => {
    const shift = createOwnerEntitlementPolicy({ ...basePolicy, id: "shift", family: "fixed_amount", kind: "fixed_shift", amountMinor: 1200, idempotencyKey: "shift" });
    expect(calculateOwnerEntitlement(shift, { periodFrom: "2026-08-01", periodTo: "2026-08-31" })).toMatchObject({ amountMinor: null, knowledge: "incomplete" });
  });

  it("uses only a recorded G3 result for profit share and completed revenue for sale share", () => {
    const profit = createOwnerEntitlementPolicy({ ...basePolicy, id: "profit", family: "profit_share", kind: "profit_share", amountMinor: null, percentageBps: 2_500, idempotencyKey: "profit" });
    expect(calculateOwnerEntitlement(profit, { periodFrom: "2026-08-01", periodTo: "2026-08-31", recognizedProfitMinor: 1000, recognizedProfitStatus: "incomplete" })).toMatchObject({ amountMinor: null, knowledge: "incomplete" });
    expect(calculateOwnerEntitlement(profit, { periodFrom: "2026-08-01", periodTo: "2026-08-31", recognizedProfitMinor: 1000, recognizedProfitStatus: "recorded_only" })).toMatchObject({ amountMinor: 250, knowledge: "known" });
    const sale = createOwnerEntitlementPolicy({ ...basePolicy, id: "sale", family: "completed_sale_percentage", kind: "sale_percentage", amountMinor: null, percentageBps: 1000, idempotencyKey: "sale" });
    expect(calculateOwnerEntitlement(sale, { periodFrom: "2026-08-01", periodTo: "2026-08-31", completedSaleMinor: 8000 })).toMatchObject({ amountMinor: 800 });
  });

  it("separates entitlement settlement, owner draw, capital return, and prior-draw return", () => {
    const settlement = createOwnerMovement({ id: "draw-1", kind: "draw", amountMinor: 400, walletId: "wallet-1", occurredOn: "2026-08-20", recordedAt: "2026-08-20T08:00:00.000Z", reason: "entitlement_settlement", note: "تسوية", idempotencyKey: "draw-1", relatedEntitlementId: "entitlement-1" });
    expect(settlement).toMatchObject({ cashDeltaMinor: -400, entitlementDeltaMinor: -400, ownerCapitalDeltaMinor: 0 });
    const ownerDraw = createOwnerMovement({ id: "draw-2", kind: "draw", amountMinor: 200, walletId: "wallet-1", occurredOn: "2026-08-20", recordedAt: "2026-08-20T08:00:00.000Z", reason: "owner_draw", note: "سحب شخصي", idempotencyKey: "draw-2" });
    expect(ownerDraw).toMatchObject({ cashDeltaMinor: -200, entitlementDeltaMinor: 0, ownerCapitalDeltaMinor: -200 });
    const returnMovement = createOwnerMovement({ id: "return-1", kind: "return", amountMinor: 100, walletId: "wallet-1", occurredOn: "2026-08-21", recordedAt: "2026-08-21T08:00:00.000Z", reason: "settlement_of_prior_draw", note: "إرجاع", idempotencyKey: "return-1", relatedMovementId: "draw-1" });
    expect(returnMovement).toMatchObject({ cashDeltaMinor: 100, entitlementDeltaMinor: 100, ownerCapitalDeltaMinor: 0 });
    const reversal = createOwnerMovementReversal({ id: "reverse-1", source: settlement, occurredOn: "2026-08-22", recordedAt: "2026-08-22T08:00:00.000Z", reason: "سجلت مرتين", idempotencyKey: "reverse-1" });
    expect(reversal).toMatchObject({ reversalOfId: "draw-1", cashDeltaMinor: 400, entitlementDeltaMinor: 400 });
  });

  it("rejects invalid dates, blank notes, and unactionable reasons", () => {
    expect(() => createOwnerEntitlementPolicy({ ...basePolicy, startsOn: "2026-02-30" })).toThrow();
    expect(() => createOwnerMovement({ id: "bad", kind: "draw", amountMinor: 0, walletId: "wallet-1", occurredOn: "2026-08-20", recordedAt: "2026-08-20T08:00:00.000Z", reason: "owner_draw", note: "", idempotencyKey: "bad" })).toThrow();
  });
});
