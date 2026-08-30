import { describe, expect, it } from "vitest";
import { unifiedWithdrawalPath } from "@/pages/OwnerWithdrawalEditor";

describe("unifiedWithdrawalPath (X-05: one entry, the correct path)", () => {
  it("routes to the ledger movement path when an owner entitlement policy is active", () => {
    expect(unifiedWithdrawalPath({ activePolicies: [{ id: "p1" } as never] })).toBe("ledger_movement");
  });

  it("routes to the general financial event path when no policy exists", () => {
    expect(unifiedWithdrawalPath({ activePolicies: [] })).toBe("financial_event");
  });
});
