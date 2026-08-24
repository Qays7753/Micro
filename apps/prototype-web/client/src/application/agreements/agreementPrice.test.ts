import { describe, expect, it } from "vitest";
import { agreementPriceIsReady, applyProtectionPriceAsStart, startAgreementPrice } from "./agreementPrice";

describe("agreement price presentation contract", () => {
  it("starts with no agreed price instead of a zero placeholder", () => {
    expect(startAgreementPrice()).toBeNull();
    expect(agreementPriceIsReady(null)).toBe(false);
    expect(agreementPriceIsReady(0)).toBe(false);
  });

  it("adopts the derived protection price only through an explicit action", () => {
    expect(applyProtectionPriceAsStart(1250)).toBe(1250);
    expect(agreementPriceIsReady(applyProtectionPriceAsStart(1250))).toBe(true);
    expect(applyProtectionPriceAsStart(null)).toBeNull();
  });

  it("accepts only positive integer minor units as an agreed price", () => {
    expect(agreementPriceIsReady(1)).toBe(true);
    expect(agreementPriceIsReady(1250)).toBe(true);
    expect(agreementPriceIsReady(-1)).toBe(false);
    expect(agreementPriceIsReady(1.5)).toBe(false);
  });
});
