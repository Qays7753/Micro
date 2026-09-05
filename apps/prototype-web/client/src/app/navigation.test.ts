import { describe, expect, it } from "vitest";
import { getNavigationLabel, primaryNavigation } from "./navigation";
import { isPublicLocalRecoveryRoute } from "./StartupGate";

describe("Prototype navigation contract", () => {
  it("keeps the approved four-destination bar: project, work, finance, tools — My Tools is a first-class destination", () => {
    expect(primaryNavigation.map(item => item.href)).toEqual(["/", "/orders", "/finance", "/tools"]);
    expect(primaryNavigation.map(item => item.label)).toEqual(["مشروعي الآن", "العمل", "مالي", "أدواتي"]);
  });

  it("maps each known path to an Arabic contextual label with the unified finance name", () => {
    expect(getNavigationLabel("/")).toBe("مشروعي الآن");
    expect(getNavigationLabel("/orders")).toBe("العمل");
    expect(getNavigationLabel("/finance")).toBe("مالي");
    expect(getNavigationLabel("/tools")).toBe("أدواتي");
    expect(getNavigationLabel("/parties")).toBe("دفتر الناس");
    expect(getNavigationLabel("/cash")).toBe("محافظ الكاش");
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
