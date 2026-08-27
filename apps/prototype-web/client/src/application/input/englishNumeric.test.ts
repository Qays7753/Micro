import { describe, expect, it } from "vitest";
import {
  allowsEnglishNumericText,
  blurEnglishNumericText,
  focusEnglishNumericText,
  formatEnglishNumericValue,
  parseEnglishNumericText,
  parseEnglishQuantityText,
} from "./englishNumeric";

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

  it("accepts only an explicit ASCII signed-integer form for negative-capable fields", () => {
    expect(allowsEnglishNumericText("-", "signedInteger")).toBe(true);
    expect(allowsEnglishNumericText("-500", "signedInteger")).toBe(true);
    expect(allowsEnglishNumericText("500", "signedInteger")).toBe(true);
    expect(allowsEnglishNumericText("-500", "integer")).toBe(false);
    expect(allowsEnglishNumericText("−500", "signedInteger")).toBe(false);
    expect(allowsEnglishNumericText("-1e3", "signedInteger")).toBe(false);
    expect(parseEnglishNumericText("-", "signedInteger")).toBeNull();
    expect(parseEnglishNumericText("-500", "signedInteger")).toBe(-500);
    expect(blurEnglishNumericText("-", 0, "signedInteger", false)).toEqual({
      text: "-",
      committed: 0,
      empty: false,
      valid: false,
    });
    expect(blurEnglishNumericText("-500", 0, "signedInteger", false)).toEqual({
      text: "-500",
      committed: -500,
      empty: false,
      valid: true,
    });
  });

  it("converts validated text without turning incomplete input into zero", () => {
    expect(parseEnglishQuantityText("1.250")).toBe(1250);
    expect(parseEnglishQuantityText("12.000")).toBe(12000);
    expect(parseEnglishQuantityText("12.0000")).toBeNull();
    expect(parseEnglishQuantityText("١.٢٥٠")).toBeNull();
    expect(parseEnglishNumericText("1", "integer")).toBe(1);
    expect(parseEnglishNumericText("1.5", "decimal")).toBe(1.5);
    expect(parseEnglishNumericText("12.5", "money")).toBe(1250);
    expect(parseEnglishNumericText("5.00", "percentage")).toBe(500);
    expect(parseEnglishNumericText("12.", "money")).toBe(1200);
    expect(parseEnglishNumericText("", "integer")).toBeNull();
    expect(parseEnglishNumericText("١", "integer")).toBeNull();
  });

  it("formats persisted quantities and minor units as English text", () => {
    expect(formatEnglishNumericValue(7, "integer")).toBe("7");
    expect(formatEnglishNumericValue(-500, "signedInteger")).toBe("-500");
    expect(formatEnglishNumericValue(1.25, "decimal")).toBe("1.25");
    expect(formatEnglishNumericValue(1250, "money")).toBe("12.50");
    expect(formatEnglishNumericValue(null, "money")).toBe("");
  });

  it("clears an untouched displayed zero on focus and restores it when left empty", () => {
    expect(focusEnglishNumericText(0, "0.00", "money", false, true)).toBe("");
    expect(blurEnglishNumericText("", 0, "money", false)).toEqual({
      text: "0.00",
      committed: 0,
      empty: false,
      valid: true,
    });
  });

  it("does not clear a real zero after the user has edited the field", () => {
    expect(focusEnglishNumericText(0, "0.00", "money", true, true)).toBe("0.00");
    expect(focusEnglishNumericText(0, "0", "integer", true, true)).toBe("0");
  });

  it("keeps non-zero values and permits optional numeric fields to remain empty", () => {
    expect(focusEnglishNumericText(1250, "12.50", "money", false, true)).toBe("12.50");
    expect(blurEnglishNumericText("", null, "money", true)).toEqual({
      text: "",
      committed: null,
      empty: true,
      valid: true,
    });
    expect(blurEnglishNumericText("12.000", 1, "integer", false)).toEqual({
      text: "12.000",
      committed: 1,
      empty: false,
      valid: false,
    });
  });
});
