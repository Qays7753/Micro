import { describe, expect, it } from "vitest";
import { getNavigationLabel, primaryNavigation } from "./navigation";
import { isPublicLocalRecoveryRoute } from "./StartupGate";

describe("Prototype navigation contract", () => {
  it("keeps the approved five-destination bar (SH-21/S16 — NAV-01 V15 §1): المالية، الطلبات، الرئيسية، التوصيل، السوق — no sixth seat; tools live behind the home entry", () => {
    expect(primaryNavigation.map(item => item.href)).toEqual([
      "/finance",
      "/orders",
      "/",
      "/delivery",
      "/market",
    ]);
    expect(primaryNavigation.map(item => item.label)).toEqual([
      "المالية",
      "الطلبات",
      "الرئيسية",
      "التوصيل",
      "السوق",
    ]);
  });

  it("maps each known path to an Arabic contextual label with the unified finance name", () => {
    expect(getNavigationLabel("/")).toBe("الرئيسية");
    expect(getNavigationLabel("/orders")).toBe("الطلبات");
    expect(getNavigationLabel("/finance")).toBe("المالية");
    expect(getNavigationLabel("/tools")).toBe("أدواتي");
    expect(getNavigationLabel("/delivery")).toBe("التوصيل");
    expect(getNavigationLabel("/market")).toBe("السوق");
    expect(getNavigationLabel("/parties")).toBe("العملاء والموردون");
    expect(getNavigationLabel("/cash")).toBe("محافظ النقد");
    expect(getNavigationLabel("/settings")).toBe("الإعدادات");
    /* N-06 (Wave 4.2): الاسم الموحد للكتالوج — «منتجاتي وخدماتي» لا «الكتالوج». */
    expect(getNavigationLabel("/catalog")).toBe("منتجاتي وخدماتي");
    /* S17 (DOC-026 / UNIT-033): التسمية المستقلة تقاعدت مع سطحها — المسار
     * القديم يسقط إلى تسمية بادئته العامة حتى تحيله الموجّهات إلى الإعدادات
     * حيث يقيم قسم «فحص البيانات». */
    expect(getNavigationLabel("/tools/integrity")).toBe("أدواتي");
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
