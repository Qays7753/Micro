import { describe, expect, it } from "vitest";
import { buildCatalogConversionPreview, catalogConversionDirectionText, catalogConversionExactnessWarning, catalogDimensionOptions, catalogYieldReadinessLabel, isCatalogTemplateDirty, parseCatalogPositiveSafeInteger, parseCatalogQuantityMilli } from "./Catalog";

describe("Catalog G4-A UI capability model", () => {
  it("exposes only the six general dimensions in Arabic", () => {
    expect(catalogDimensionOptions).toEqual([
      { value: "count", label: "عدد" },
      { value: "mass", label: "وزن" },
      { value: "volume", label: "حجم" },
      { value: "time", label: "وقت" },
      { value: "distance", label: "مسافة" },
      { value: "area", label: "مساحة" },
    ]);
  });

  it("accepts exact ASCII quantities up to three decimal places and rejects hidden rounding", () => {
    expect(parseCatalogQuantityMilli("1")).toBe(1000);
    expect(parseCatalogQuantityMilli("1.250")).toBe(1250);
    expect(parseCatalogQuantityMilli("1.2345")).toBeNull();
    expect(parseCatalogQuantityMilli("0")).toBeNull();
    expect(parseCatalogQuantityMilli("-1")).toBeNull();
  });

  it("rejects conversion factors with non-digit text, zero, or unsafe values", () => {
    expect(parseCatalogPositiveSafeInteger("1000")).toBe(1000);
    expect(parseCatalogPositiveSafeInteger("1000x")).toBeNull();
    expect(parseCatalogPositiveSafeInteger("0")).toBeNull();
    expect(parseCatalogPositiveSafeInteger("-1")).toBeNull();
    expect(parseCatalogPositiveSafeInteger("9007199254740992")).toBeNull();
  });

  it("keeps source/destination wording and exact preview aligned with the conversion equation", () => {
    expect(catalogConversionDirectionText("قطعة", "دزينة")).toBe("المصدر: قطعة | الوجهة: دزينة");
    expect(buildCatalogConversionPreview("قطعة", "دزينة", 1, 12)).toMatchObject({ exact: true, text: "12.000 قطعة × 1 ÷ 12 = 1.000 دزينة" });
    expect(buildCatalogConversionPreview("كيلوغرام", "غرام", 1000, 1, 1_000)).toMatchObject({ exact: true, text: "1.000 كيلوغرام × 1000 ÷ 1 = 1000.000 غرام" });
    expect(buildCatalogConversionPreview("قطعة", "دزينة", 1, 3, 1_000)).toMatchObject({ exact: false, text: null, warning: catalogConversionExactnessWarning });
  });

  it("does not mark an unchanged revision dirty, but protects a new draft", () => {
    expect(isCatalogTemplateDirty("same", "same", true)).toBe(false);
    expect(isCatalogTemplateDirty("changed", "same", true)).toBe(true);
    expect(isCatalogTemplateDirty("new", null, false)).toBe(false);
    expect(isCatalogTemplateDirty("new", null, true)).toBe(true);
  });

  it("keeps unconfigured and needs-conversion states visible in Arabic", () => {
    expect(catalogYieldReadinessLabel("not_configured")).toBe("غير مهيأ اختياريًا");
    expect(catalogYieldReadinessLabel("ready")).toBe("مهيأ");
    expect(catalogYieldReadinessLabel("needs_conversion")).toBe("يحتاج تحويلًا صريحًا");
  });
});
