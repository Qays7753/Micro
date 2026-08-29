import { describe, expect, it } from "vitest";
import { getNavigationLabel, primaryNavigation } from "./navigation";
import { isPublicLocalRecoveryRoute } from "./StartupGate";

describe("Prototype navigation contract", () => {
  it("keeps the four Android-like destinations in the approved order", () => {
    expect(primaryNavigation.map(item => item.href)).toEqual(["/", "/orders", "/review", "/settings"]);
  });

  it("maps each known path to an Arabic contextual label", () => {
    expect(getNavigationLabel("/")).toBe("مشروعي الآن");
    expect(getNavigationLabel("/orders")).toBe("العمل");
    expect(getNavigationLabel("/review")).toBe("المراجعة");
    expect(getNavigationLabel("/settings")).toBe("الإعدادات");
  });

  it("falls back to the product identity for an unknown route", () => {
    expect(getNavigationLabel("/missing")).toBe("مايكرو");
  });

  it("allows local import settings before a first activity profile exists", () => {
    expect(isPublicLocalRecoveryRoute("/settings")).toBe(true);
    expect(isPublicLocalRecoveryRoute("/setup")).toBe(true);
    expect(isPublicLocalRecoveryRoute("/orders")).toBe(false);
  });
});
