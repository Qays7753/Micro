import { describe, expect, it } from "vitest";
import {
  ownerMovementReasonsForKind,
  successorPolicyFormRequirements,
  supportedOwnerEntitlementPolicyKinds,
} from "./OwnerEntitlement";

describe("OwnerEntitlement UI capability model", () => {
  it("does not expose fixed-shift without shift evidence", () => {
    expect(supportedOwnerEntitlementPolicyKinds).toContain("hourly");
    expect(supportedOwnerEntitlementPolicyKinds).not.toContain("fixed_shift");
  });

  it("exposes honest successor fields for changed policy terms", () => {
    expect(successorPolicyFormRequirements("monthly")).toMatchObject({
      family: "time_period",
      valueKind: "amount",
      requiresUnit: false,
      requiresEndDate: false,
    });
    expect(successorPolicyFormRequirements("sale_percentage")).toMatchObject({
      family: "completed_sale_percentage",
      valueKind: "percentage",
    });
    expect(successorPolicyFormRequirements("per_unit")).toMatchObject({ family: "unit", requiresUnit: true });
    expect(successorPolicyFormRequirements("fixed_period")).toMatchObject({
      family: "fixed_amount",
      requiresEndDate: true,
    });
  });

  it("keeps every actual movement reason explicit and leaves plain withdrawal to the unified entry (X-05)", () => {
    expect(ownerMovementReasonsForKind("draw")).toEqual([
      "entitlement_settlement",
      "opening_balance_settlement",
    ]);
    expect(ownerMovementReasonsForKind("return")).toEqual([
      "opening_balance_settlement",
      "settlement_of_prior_draw",
      "new_capital_investment",
    ]);
  });
});
