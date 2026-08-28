import { describe, expect, it } from "vitest";
import { isIosSafari, isStandaloneMode } from "./install";

describe("PWA install detection", () => {
  it("suppresses install UI for display-mode standalone", () => {
    expect(
      isStandaloneMode({ matchMedia: () => ({ matches: true }) }, { standalone: false } as Navigator & {
        standalone?: boolean;
      }),
    ).toBe(true);
  });

  it("recognizes iPadOS Safari while excluding Chromium on iOS", () => {
    const safariUserAgent =
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 Version/17.0 Safari/605.1.15";
    expect(isIosSafari(safariUserAgent, "MacIntel", 5)).toBe(true);
    expect(isIosSafari(`${safariUserAgent} CriOS/120.0`, "MacIntel", 5)).toBe(false);
  });

  it("does not classify desktop Safari as iOS Safari", () => {
    const desktopSafari =
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 Version/17.0 Safari/605.1.15";
    expect(isIosSafari(desktopSafari, "MacIntel", 0)).toBe(false);
  });
});
