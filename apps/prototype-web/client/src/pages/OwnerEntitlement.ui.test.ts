import { describe, expect, it } from "vitest";
import { ownerMovementReasonsForKind, supportedOwnerEntitlementPolicyKinds } from "./OwnerEntitlement";

describe("OwnerEntitlement UI capability model", () => {
  it("does not expose fixed-shift without shift evidence", () => {
    expect(supportedOwnerEntitlementPolicyKinds).toContain("hourly");
    expect(supportedOwnerEntitlementPolicyKinds).not.toContain("fixed_shift");
  });

  it("keeps every actual movement reason explicit", () => {
    expect(ownerMovementReasonsForKind("draw")).toEqual(["entitlement_settlement", "opening_balance_settlement", "pre_entitlement_draw", "owner_draw"]);
    expect(ownerMovementReasonsForKind("return")).toEqual(["opening_balance_settlement", "settlement_of_prior_draw", "new_capital_investment"]);
  });
});
