import { describe, expect, it } from "vitest";
import { isInstallBannerDismissalActive, isIosSafari, isStandaloneMode } from "./install";

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

describe("install banner dismissal window (U-10)", () => {
  it("keeps a dismissal active for thirty days", () => {
    expect(isInstallBannerDismissalActive("2026-08-01T09:00:00.000Z", "2026-08-30T09:00:00.000Z")).toBe(true);
    expect(isInstallBannerDismissalActive("2026-08-01T09:00:00.000Z", "2026-08-31T09:00:00.000Z")).toBe(
      false,
    );
  });

  it("treats missing or unreadable dismissal as not dismissed", () => {
    expect(isInstallBannerDismissalActive(null, "2026-08-01T09:00:00.000Z")).toBe(false);
    expect(isInstallBannerDismissalActive(undefined, "2026-08-01T09:00:00.000Z")).toBe(false);
    expect(isInstallBannerDismissalActive("not-a-date", "2026-08-01T09:00:00.000Z")).toBe(false);
  });
});
