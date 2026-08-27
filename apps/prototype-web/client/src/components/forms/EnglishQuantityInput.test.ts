import { describe, expect, it } from "vitest";
import { blurQuantityText, focusQuantityText } from "./EnglishQuantityInput";

describe("unified quantity input behavior", () => {
  it("clears an untouched zero quantity on focus and restores zero on empty blur", () => {
    expect(focusQuantityText(0, "0", false, true)).toBe("");
    expect(blurQuantityText("", 0)).toEqual({ text: "0", committed: 0, valid: true });
  });

  it("preserves a user-entered real zero and exact decimal quantity", () => {
    expect(focusQuantityText(0, "0", true, true)).toBe("0");
    expect(blurQuantityText("12.000", 0)).toEqual({ text: "12", committed: 12000, valid: true });
    expect(blurQuantityText("1.250", 0)).toEqual({ text: "1.250", committed: 1250, valid: true });
    expect(blurQuantityText("12.000.0", 1000)).toEqual({ text: "12.000.0", committed: 1000, valid: false });
  });

  it("keeps an optional empty quantity nullable instead of manufacturing zero", () => {
    expect(blurQuantityText("", null, true)).toEqual({ text: "", committed: null, valid: true });
  });

  it("can opt out for a field where zero is an intentional opening value", () => {
    expect(focusQuantityText(0, "0", false, false)).toBe("0");
  });
});
