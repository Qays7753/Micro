import { describe, expect, it } from "vitest";
import { getNavigationLabel, primaryNavigation } from "./navigation";
import { isPublicLocalRecoveryRoute } from "./StartupGate";

describe("Prototype navigation contract", () => {
  it("keeps the approved five-destination bar: project, work, finance, tools, market — My Tools is a first-class destination and السوق is an honest قريبًا seat", () => {
    expect(primaryNavigation.map(item => item.href)).toEqual([
      "/",
      "/orders",
      "/finance",
      "/tools",
      "/market",
    ]);
    expect(primaryNavigation.map(item => item.label)).toEqual([
      "مشروعي الآن",
      "العمل",
      "المالية",
      "أدواتي",
      "السوق",
    ]);
  });

  it("maps each known path to an Arabic contextual label with the unified finance name", () => {
    expect(getNavigationLabel("/")).toBe("مشروعي الآن");
    expect(getNavigationLabel("/orders")).toBe("العمل");
    expect(getNavigationLabel("/finance")).toBe("المالية");
    expect(getNavigationLabel("/tools")).toBe("أدواتي");
    expect(getNavigationLabel("/market")).toBe("السوق");
    expect(getNavigationLabel("/parties")).toBe("دفتر الناس");
    expect(getNavigationLabel("/cash")).toBe("محافظ الكاش");
    expect(getNavigationLabel("/settings")).toBe("الإعدادات");
    /* N-06 (Wave 4.2): الاسم الموحد للكتالوج — «منتجاتي وخدماتي» لا «الكتالوج». */
    expect(getNavigationLabel("/catalog")).toBe("منتجاتي وخدماتي");
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
