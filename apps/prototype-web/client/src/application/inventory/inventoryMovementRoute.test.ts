import { describe, expect, it } from "vitest";
import { resolveInventoryMovementType } from "./inventoryMovementRoute";

describe("inventory movement route contract", () => {
  it("rejects unknown types instead of assigning a movement meaning", () => {
    expect(resolveInventoryMovementType("use")).toBeNull();
    expect(resolveInventoryMovementType("unknown")).toBeNull();
    expect(resolveInventoryMovementType(undefined)).toBeNull();
  });

  it("keeps only the explicitly supported movement types", () => {
    expect(resolveInventoryMovementType("receipt")).toBe("receipt");
    expect(resolveInventoryMovementType("consume")).toBe("consume");
    expect(resolveInventoryMovementType("waste")).toBe("waste");
    expect(resolveInventoryMovementType("adjust")).toBe("adjust");
  });
});
