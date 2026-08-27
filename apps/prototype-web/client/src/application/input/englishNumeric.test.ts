import { describe, expect, it } from "vitest";
import { allowsEnglishNumericText, blurEnglishNumericText, focusEnglishNumericText, formatEnglishNumericValue, parseEnglishNumericText } from "./englishNumeric";

describe("english numeric input", () => {
  it("accepts only editable ASCII digit forms", () => {
    expect(allowsEnglishNumericText("1", "integer")).toBe(true);
    expect(allowsEnglishNumericText("12.5", "decimal")).toBe(true);
    expect(allowsEnglishNumericText("12.50", "money")).toBe(true);
    expect(allowsEnglishNumericText("", "money")).toBe(true);
    expect(allowsEnglishNumericText("12.500", "money")).toBe(false);
    expect(allowsEnglishNumericText("١", "integer")).toBe(false);
    expect(allowsEnglishNumericText("1e3", "decimal")).toBe(false);
  });

  it("converts validated text without turning incomplete input into zero", () => {
    expect(parseEnglishNumericText("1", "integer")).toBe(1);
    expect(parseEnglishNumericText("1.5", "decimal")).toBe(1.5);
    expect(parseEnglishNumericText("12.5", "money")).toBe(1250);
    expect(parseEnglishNumericText("12.", "money")).toBe(1200);
    expect(parseEnglishNumericText("", "integer")).toBeNull();
    expect(parseEnglishNumericText("١", "integer")).toBeNull();
  });

  it("formats persisted quantities and minor units as English text", () => {
    expect(formatEnglishNumericValue(7, "integer")).toBe("7");
    expect(formatEnglishNumericValue(1.25, "decimal")).toBe("1.25");
    expect(formatEnglishNumericValue(1250, "money")).toBe("12.50");
    expect(formatEnglishNumericValue(null, "money")).toBe("");
  });

  it("clears an untouched displayed zero on focus and restores it when left empty", () => {
    expect(focusEnglishNumericText(0, "0.00", "money", false, true)).toBe("");
    expect(blurEnglishNumericText("", 0, "money", false)).toEqual({ text: "0.00", committed: 0, empty: false, valid: true });
  });

  it("does not clear a real zero after the user has edited the field", () => {
    expect(focusEnglishNumericText(0, "0.00", "money", true, true)).toBe("0.00");
    expect(focusEnglishNumericText(0, "0", "integer", true, true)).toBe("0");
  });

  it("keeps non-zero values and permits optional numeric fields to remain empty", () => {
    expect(focusEnglishNumericText(1250, "12.50", "money", false, true)).toBe("12.50");
    expect(blurEnglishNumericText("", null, "money", true)).toEqual({ text: "", committed: null, empty: true, valid: true });
    expect(blurEnglishNumericText("12.000", 1, "integer", false)).toEqual({ text: "12.000", committed: 1, empty: false, valid: false });
  });
});
