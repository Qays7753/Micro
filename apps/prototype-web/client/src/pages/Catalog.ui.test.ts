import { describe, expect, it } from "vitest";
import {
  buildCatalogConversionPreview,
  buildCatalogPerUnitPreview,
  catalogAllocationKindLabel,
  catalogAllocationStatusLabel,
  catalogConversionDirectionText,
  catalogConversionExactnessWarning,
  catalogDimensionOptions,
  catalogPerUnitRateLabel,
  catalogPerUnitRoundingNote,
  catalogYieldReadinessLabel,
  isCatalogTemplateDirty,
  parseCatalogJodMinor,
  parseCatalogPercentageBps,
  parseCatalogPositiveSafeInteger,
  parseCatalogQuantityMilli,
} from "./Catalog";
import { perOutputUnitAmountMinor } from "@micro-domain/recurring-margin/index.js";

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
    expect(buildCatalogConversionPreview("قطعة", "دزينة", 1, 12)).toMatchObject({
      exact: true,
      text: "12.000 قطعة × 1 ÷ 12 = 1.000 دزينة",
    });
    expect(buildCatalogConversionPreview("كيلوغرام", "غرام", 1000, 1, 1_000)).toMatchObject({
      exact: true,
      text: "1.000 كيلوغرام × 1000 ÷ 1 = 1000.000 غرام",
    });
    expect(buildCatalogConversionPreview("قطعة", "دزينة", 1, 3, 1_000)).toMatchObject({
      exact: false,
      text: null,
      warning: catalogConversionExactnessWarning,
    });
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

  it("accepts only explicit positive JOD and percentage values", () => {
    expect(parseCatalogJodMinor("25.00")).toBe(2500);
    expect(parseCatalogJodMinor("0")).toBeNull();
    expect(parseCatalogJodMinor("25.123")).toBeNull();
    expect(parseCatalogPercentageBps("5.00")).toBe(500);
    expect(parseCatalogPercentageBps("100.01")).toBeNull();
    expect(parseCatalogPercentageBps("0")).toBeNull();
  });

  it("keeps the four policy labels and incomplete state explicit", () => {
    expect(catalogAllocationKindLabel("manual_amount")).toBe("مبلغ يدوي للفترة");
    expect(catalogAllocationKindLabel("per_output_unit")).toBe("معدل لكل 1.000 وحدة كاملة");
    expect(catalogAllocationKindLabel("actual_time")).toBe("معدل لكل دقيقة فعلية");
    expect(catalogAllocationKindLabel("completed_revenue_percentage")).toBe("نسبة من الإيراد المكتمل");
    expect(catalogAllocationStatusLabel("incomplete")).toBe("ناقص");
    expect(catalogAllocationStatusLabel(null)).toBe("غير محسوب");
  });

  it("makes the per-unit scale and one-time rounding visible in the preview", () => {
    expect(catalogPerUnitRateLabel("قطعة")).toBe("المعدل لكل 1.000 قطعة · د.أ");
    expect(catalogPerUnitRoundingNote).toContain("مرة واحدة");
    expect(buildCatalogPerUnitPreview(12_000, 50, "قطعة")).toMatchObject({
      allocationMinor: 600,
      text: "12.000 قطعة × 0.50 د.أ لكل 1.000 قطعة = 6.00 د.أ",
    });
    expect(buildCatalogPerUnitPreview(1, 1, "قطعة")).toMatchObject({
      allocationMinor: 0,
      warning: expect.stringContaining("نتيجة حسابية معلنة"),
    });
    expect(buildCatalogPerUnitPreview(Number.MAX_SAFE_INTEGER, 2, "قطعة")).toMatchObject({
      allocationMinor: null,
      warning: expect.stringContaining("لا يمكن الحساب بأمان"),
    });
  });
});

describe("Catalog per-unit preview shares the domain implementation (A-07)", () => {
  it("agrees with perOutputUnitAmountMinor across normal, boundary, and refusing inputs", () => {
    const cases: ReadonlyArray<[number | null, number | null]> = [
      [2_475, 100],
      [1_000, 250],
      [650, 33],
      [null, 100],
      [1_000, null],
      [0, 100],
    ];
    for (const [quantityMilli, rate] of cases) {
      const preview = buildCatalogPerUnitPreview(quantityMilli, rate, "قطعة");
      const domain = perOutputUnitAmountMinor(quantityMilli, rate);
      expect(preview.allocationMinor).toBe("problem" in domain ? null : domain.amountMinor);
      if ("problem" in domain) expect(preview.warning).toBeTruthy();
    }
    expect(buildCatalogPerUnitPreview(2_475, 100, "قطعة").allocationMinor).toBe(248);
  });
});
