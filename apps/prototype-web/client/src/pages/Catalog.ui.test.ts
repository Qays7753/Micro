import { describe, expect, it } from "vitest";
import { catalogDimensionOptions, catalogYieldReadinessLabel, parseCatalogQuantityMilli } from "./Catalog";

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

  it("keeps unconfigured and needs-conversion states visible in Arabic", () => {
    expect(catalogYieldReadinessLabel("not_configured")).toBe("غير مهيأ اختياريًا");
    expect(catalogYieldReadinessLabel("ready")).toBe("مهيأ");
    expect(catalogYieldReadinessLabel("needs_conversion")).toBe("يحتاج تحويلًا صريحًا");
  });
});
