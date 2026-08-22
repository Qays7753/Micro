import { describe, expect, it } from "vitest";
import { allowsEnglishNumericText, formatEnglishNumericValue, parseEnglishNumericText } from "./englishNumeric";

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
  });
});
