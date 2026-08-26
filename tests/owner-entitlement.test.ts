import { describe, expect, it } from "vitest";
import { calculateOwnerEntitlement, createOwnerEntitlementOpeningBalance, createOwnerEntitlementOpeningBalanceReversal, createOwnerEntitlementPolicy, createOwnerEntitlementRecord, createOwnerEntitlementRecordReversal, createOwnerMovement, createOwnerMovementReversal } from "../src/domain/owner-entitlement/index.js";

const basePolicy = { id: "policy-1", version: 1, family: "time_period" as const, kind: "monthly" as const, amountMinor: 1500, percentageBps: null, unitLabel: null, startsOn: "2026-08-01", endsOn: null, source: "اتفاق المالك", note: "استحقاق شهري", status: "active" as const, idempotencyKey: "policy-1", createdAt: "2026-08-01T08:00:00.000Z" };

function recordInput(overrides: Partial<Parameters<typeof createOwnerEntitlementRecord>[0]> = {}) { return { id: "entitlement-1", policyId: "policy-1", policyVersion: 1, periodFrom: "2026-08-01", periodTo: "2026-08-31", occurredOn: "2026-08-31", recordedAt: "2026-08-31T08:00:00.000Z", amountMinor: 1500, knowledge: "known" as const, calculationBasis: "time_period" as const, baseMinor: null, quantity: null, sourceKeys: ["period:policy-1:2026-08-01:2026-08-31"], note: "آب", idempotencyKey: "entitlement-1", reversalOfId: null, reversalReason: null, ...overrides }; }

describe("owner entitlement Domain", () => {
  it("keeps dated policies immutable and calculates a fixed period amount", () => {
    const policy = createOwnerEntitlementPolicy(basePolicy);
    expect(policy.seriesId).toBe(policy.id);
    expect(calculateOwnerEntitlement(policy, { periodFrom: "2026-08-01", periodTo: "2026-08-31" })).toMatchObject({ amountMinor: 1500, knowledge: "known", calculationBasis: "time_period" });
  });

  it("requires complete local periods for monthly, weekly, and daily policies", () => {
    const monthly = createOwnerEntitlementPolicy(basePolicy);
    expect(calculateOwnerEntitlement(monthly, { periodFrom: "2026-08-15", periodTo: "2026-08-31" })).toMatchObject({ amountMinor: null, knowledge: "incomplete" });
    const bounded = createOwnerEntitlementPolicy({ ...basePolicy, id: "bounded", endsOn: "2026-08-25", idempotencyKey: "bounded" });
    expect(calculateOwnerEntitlement(bounded, { periodFrom: "2026-08-01", periodTo: "2026-08-31" })).toMatchObject({ amountMinor: null, knowledge: "incomplete" });
    const weekly = createOwnerEntitlementPolicy({ ...basePolicy, id: "weekly", kind: "weekly", idempotencyKey: "weekly" });
    expect(calculateOwnerEntitlement(weekly, { periodFrom: "2026-08-03", periodTo: "2026-08-09" })).toMatchObject({ amountMinor: 1500, knowledge: "known" });
    expect(calculateOwnerEntitlement(weekly, { periodFrom: "2026-08-03", periodTo: "2026-08-08" })).toMatchObject({ amountMinor: null, knowledge: "incomplete" });
    const daily = createOwnerEntitlementPolicy({ ...basePolicy, id: "daily", kind: "daily", idempotencyKey: "daily" });
    expect(calculateOwnerEntitlement(daily, { periodFrom: "2026-08-03", periodTo: "2026-08-03" })).toMatchObject({ amountMinor: 1500, knowledge: "known" });
    expect(calculateOwnerEntitlement(daily, { periodFrom: "2026-08-03", periodTo: "2026-08-04" })).toMatchObject({ amountMinor: null, knowledge: "incomplete" });
  });

  it("does not turn missing hourly time, units, or sale sources into zero", () => {
    const hourly = createOwnerEntitlementPolicy({ ...basePolicy, id: "hourly", kind: "hourly", amountMinor: 600, idempotencyKey: "hourly" });
    expect(calculateOwnerEntitlement(hourly, { periodFrom: "2026-08-01", periodTo: "2026-08-31" })).toMatchObject({ amountMinor: null, knowledge: "incomplete" });
    const unit = createOwnerEntitlementPolicy({ ...basePolicy, id: "unit", family: "unit", kind: "per_unit", amountMinor: 25, unitLabel: "قطعة", idempotencyKey: "unit" });
    expect(calculateOwnerEntitlement(unit, { periodFrom: "2026-08-01", periodTo: "2026-08-31", unitQuantity: 4 })).toMatchObject({ amountMinor: null, knowledge: "incomplete" });
    expect(calculateOwnerEntitlement(unit, { periodFrom: "2026-08-01", periodTo: "2026-08-31", unitQuantity: 4, unitSourceKeys: ["order-1"] })).toMatchObject({ amountMinor: 100, quantity: 4 });
    const sale = createOwnerEntitlementPolicy({ ...basePolicy, id: "sale", family: "completed_sale_percentage", kind: "sale_percentage", amountMinor: null, percentageBps: 1000, idempotencyKey: "sale" });
    expect(calculateOwnerEntitlement(sale, { periodFrom: "2026-08-01", periodTo: "2026-08-31", completedSaleMinor: 8000 })).toMatchObject({ amountMinor: null, knowledge: "incomplete" });
  });

  it("uses only a recorded G3 result for profit share", () => {
    const profit = createOwnerEntitlementPolicy({ ...basePolicy, id: "profit", family: "profit_share", kind: "profit_share", amountMinor: null, percentageBps: 2500, idempotencyKey: "profit" });
    expect(calculateOwnerEntitlement(profit, { periodFrom: "2026-08-01", periodTo: "2026-08-31", recognizedProfitMinor: 1000, recognizedProfitStatus: "incomplete" })).toMatchObject({ amountMinor: null, knowledge: "incomplete" });
    expect(calculateOwnerEntitlement(profit, { periodFrom: "2026-08-01", periodTo: "2026-08-31", recognizedProfitMinor: 1000, recognizedProfitStatus: "recorded_only" })).toMatchObject({ amountMinor: 250, knowledge: "known" });
  });

  it("does not claim a fixed-shift amount without shift evidence", () => {
    const shift = createOwnerEntitlementPolicy({ ...basePolicy, id: "shift", family: "fixed_amount", kind: "fixed_shift", amountMinor: 1200, idempotencyKey: "shift" });
    expect(calculateOwnerEntitlement(shift, { periodFrom: "2026-08-01", periodTo: "2026-08-31" })).toMatchObject({ amountMinor: null, knowledge: "incomplete" });
  });

  it("separates entitlement settlement, owner draw, capital return, and prior-draw return", () => {
    const settlement = createOwnerMovement({ id: "draw-1", kind: "draw", amountMinor: 400, walletId: "wallet-1", occurredOn: "2026-08-20", recordedAt: "2026-08-20T08:00:00.000Z", reason: "entitlement_settlement", note: "تسوية", idempotencyKey: "draw-1", relatedEntitlementId: "entitlement-1" });
    expect(settlement).toMatchObject({ cashDeltaMinor: -400, entitlementDeltaMinor: -400, openingBalanceDeltaMinor: 0, ownerCapitalDeltaMinor: 0 });
    const ownerDraw = createOwnerMovement({ id: "draw-2", kind: "draw", amountMinor: 200, walletId: "wallet-1", occurredOn: "2026-08-20", recordedAt: "2026-08-20T08:00:00.000Z", reason: "owner_draw", note: "سحب شخصي", idempotencyKey: "draw-2" });
    expect(ownerDraw).toMatchObject({ cashDeltaMinor: -200, entitlementDeltaMinor: 0, ownerCapitalDeltaMinor: -200 });
    const returnMovement = createOwnerMovement({ id: "return-1", kind: "return", amountMinor: 100, walletId: "wallet-1", occurredOn: "2026-08-21", recordedAt: "2026-08-21T08:00:00.000Z", reason: "settlement_of_prior_draw", note: "إرجاع", idempotencyKey: "return-1", relatedMovementId: "draw-1" });
    expect(returnMovement).toMatchObject({ cashDeltaMinor: 100, entitlementDeltaMinor: 100, ownerCapitalDeltaMinor: 0 });
    const openingDraw = createOwnerMovement({ id: "opening-draw", kind: "draw", amountMinor: 100, walletId: "wallet-1", occurredOn: "2026-08-21", recordedAt: "2026-08-21T08:00:00.000Z", reason: "opening_balance_settlement", note: "تسوية افتتاح موجب", idempotencyKey: "opening-draw", relatedOpeningBalanceId: "opening-1" });
    expect(openingDraw.openingBalanceDeltaMinor).toBe(-100);
  });

  it("keeps reversals append-only and restores the source eligibility", () => {
    const source = createOwnerEntitlementRecord(recordInput());
    const reversal = createOwnerEntitlementRecordReversal({ id: "entitlement-reversal", source, occurredOn: "2026-09-01", recordedAt: "2026-09-01T08:00:00.000Z", reason: "سجلت مرتين", idempotencyKey: "entitlement-reversal" });
    expect(reversal).toMatchObject({ reversalOfId: source.id, amountMinor: source.amountMinor, periodFrom: source.periodFrom });
    const opening = createOwnerEntitlementOpeningBalance({ id: "opening-1", amountMinor: -500, occurredOn: "2026-08-01", recordedAt: "2026-08-01T08:00:00.000Z", reason: "سحب سابق", note: "رصيد موثق", idempotencyKey: "opening-1", reversalOfId: null, reversalReason: null });
    const openingReversal = createOwnerEntitlementOpeningBalanceReversal({ id: "opening-reversal", source: opening, occurredOn: "2026-09-01", recordedAt: "2026-09-01T08:00:00.000Z", reason: "افتتاح غير صحيح", idempotencyKey: "opening-reversal" });
    expect(openingReversal).toMatchObject({ reversalOfId: opening.id, amountMinor: -500 });
    const movement = createOwnerMovement({ id: "draw-3", kind: "draw", amountMinor: 400, walletId: "wallet-1", occurredOn: "2026-08-20", recordedAt: "2026-08-20T08:00:00.000Z", reason: "entitlement_settlement", note: "تسوية", idempotencyKey: "draw-3", relatedEntitlementId: "entitlement-1" });
    expect(createOwnerMovementReversal({ id: "reverse-1", source: movement, occurredOn: "2026-08-22", recordedAt: "2026-08-22T08:00:00.000Z", reason: "سجلت مرتين", idempotencyKey: "reverse-1" })).toMatchObject({ reversalOfId: "draw-3", cashDeltaMinor: 400, entitlementDeltaMinor: 400 });
  });

  it("rejects invalid dates, blank notes, and zero opening balances", () => {
    expect(() => createOwnerEntitlementPolicy({ ...basePolicy, startsOn: "2026-02-30" })).toThrow();
    expect(() => createOwnerMovement({ id: "bad", kind: "draw", amountMinor: 0, walletId: "wallet-1", occurredOn: "2026-08-20", recordedAt: "2026-08-20T08:00:00.000Z", reason: "owner_draw", note: "", idempotencyKey: "bad" })).toThrow();
    expect(() => createOwnerEntitlementOpeningBalance({ id: "zero", amountMinor: 0, occurredOn: "2026-08-01", recordedAt: "2026-08-01T08:00:00.000Z", reason: "x", note: "x", idempotencyKey: "zero", reversalOfId: null, reversalReason: null })).toThrow();
  });
});
