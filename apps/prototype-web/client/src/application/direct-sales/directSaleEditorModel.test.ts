/** R7 / R6-F17-P07 (2026-10-10): عقد نموذج عرض محرر البيع المباشر — بوابة
 * التحقق، قرار الفرق X-06، تعيين مرجع الوصلة العميقة، وخريطة السجل المحمّل.
 * نفس شروط القرار التي كانت الصفحة تنفذها؛ النصوص العربية نسخة واجهة تبقى
 * عند الصفحة — الوحدة تعيد أكواد قرارات فقط. */
import { describe, expect, it } from "vitest";
import {
  directSaleToFormValues,
  productParamFromSearch,
  proposeProductParam,
  resolveDifferenceOutcome,
  validateDirectSaleSubmission,
} from "./directSaleEditorModel";
import type { CatalogItem } from "@micro-domain/catalog/index.js";
import type { DirectSale } from "@micro-domain/direct-sale/index.js";

const validBase = {
  note: "بيع مباشر",
  validQuantity: true,
  quantity: 1,
  validRevenue: true,
  revenueMinor: 5000,
  validCollected: true,
  resolvedCollected: 5000,
  costKnown: false,
  validCost: true,
  costMinor: 0,
  difference: 0,
  differenceChoice: null,
};

describe("R7/P07 — بوابة التحقق قبل الإرسال", () => {
  it("القيم السليمة تمر (null)", () => {
    expect(validateDirectSaleSubmission(validBase)).toBeNull();
  });

  it("المبلغ الفارغ أو المدخلات غير الصالحة = missing_required_fields", () => {
    expect(validateDirectSaleSubmission({ ...validBase, note: "  " })).toBe("missing_required_fields");
    expect(validateDirectSaleSubmission({ ...validBase, validRevenue: false })).toBe(
      "missing_required_fields",
    );
    expect(validateDirectSaleSubmission({ ...validBase, revenueMinor: 0 })).toBe("missing_required_fields");
    expect(validateDirectSaleSubmission({ ...validBase, quantity: 0 })).toBe("missing_required_fields");
    expect(validateDirectSaleSubmission({ ...validBase, validQuantity: false })).toBe(
      "missing_required_fields",
    );
    expect(validateDirectSaleSubmission({ ...validBase, resolvedCollected: -1 })).toBe(
      "missing_required_fields",
    );
    expect(
      validateDirectSaleSubmission({ ...validBase, costKnown: true, validCost: false, costMinor: 100 }),
    ).toBe("missing_required_fields");
    expect(
      validateDirectSaleSubmission({ ...validBase, costKnown: true, validCost: true, costMinor: -1 }),
    ).toBe("missing_required_fields");
  });

  it("المقبوض فوق السعر = collected_exceeds_price (قبل قرار الفرق)", () => {
    expect(validateDirectSaleSubmission({ ...validBase, resolvedCollected: 6000, difference: -1000 })).toBe(
      "collected_exceeds_price",
    );
  });

  it("الفرق بلا قرار = difference_choice_required (X-06: ينبّه ولا يقرّر)", () => {
    expect(validateDirectSaleSubmission({ ...validBase, resolvedCollected: 4000, difference: 1000 })).toBe(
      "difference_choice_required",
    );
    expect(
      validateDirectSaleSubmission({
        ...validBase,
        resolvedCollected: 4000,
        difference: 1000,
        differenceChoice: "price_cut",
      }),
    ).toBeNull();
  });
});

describe("R7/P07 — قرار الفرق X-06", () => {
  it("لا فرق = قبض كامل دائمًا", () => {
    expect(resolveDifferenceOutcome(0, null)).toEqual({
      collectionStatus: "collected_in_full",
      priceCut: false,
    });
    expect(resolveDifferenceOutcome(-500, "price_cut")).toEqual({
      collectionStatus: "collected_in_full",
      priceCut: false,
    });
  });

  it("الفرق بالخيارات الثلاثة", () => {
    expect(resolveDifferenceOutcome(1000, "price_cut")).toEqual({
      collectionStatus: "collected_in_full",
      priceCut: true,
    });
    expect(resolveDifferenceOutcome(1000, "remaining_debt")).toEqual({
      collectionStatus: "partial_debt",
      priceCut: false,
    });
    expect(resolveDifferenceOutcome(1000, "needs_review")).toEqual({
      collectionStatus: "partial_needs_review",
      priceCut: false,
    });
    /* فرق بلا قرار (يمر فقط بعد البوابة) — القيمة الافتراضية كاملة كما بالأصل. */
    expect(resolveDifferenceOutcome(1000, null)).toEqual({
      collectionStatus: "collected_in_full",
      priceCut: false,
    });
  });
});

describe("R7/P07 — معامل الوصلة العميقة ?product=", () => {
  it("الصيغة الصالحة فقط تُعاد", () => {
    expect(productParamFromSearch("?product=abc-123")).toBe("abc-123");
    expect(productParamFromSearch("")).toBeNull();
    expect(productParamFromSearch("?product=")).toBeNull();
    expect(productParamFromSearch("?product=%D8%A8%D9%8A%D8%B9")).toBeNull();
    expect(productParamFromSearch("?product=" + "x".repeat(65))).toBeNull();
  });

  const items = [
    { id: "a", name: "خدمة أ", active: true, defaultPriceMinor: 7000, defaultUnitCostMinor: 2000 },
    { id: "b", name: "منتج موقوف", active: false, defaultPriceMinor: null, defaultUnitCostMinor: null },
  ] as unknown as readonly CatalogItem[];
  const fresh = {
    editing: false,
    alreadyApplied: false,
    itemName: "",
    revenueMinor: 0,
    quantity: 1,
    costKnown: false,
  };

  it("المرجع الصالح يُقترح بقيمه الافتراضية دون دوس على ما كتبه المستخدم", () => {
    expect(proposeProductParam(items, "?product=a", fresh)).toEqual({
      kind: "apply",
      catalogItemId: "a",
      itemName: "خدمة أ",
      revenueMinor: 7000,
      cost: { known: true, minor: 2000 },
      suggestedReferenceId: "a",
    });
    /* المستخدم كتب اسمًا خاصًا وسعرًا — لا يُداس. */
    expect(
      proposeProductParam(items, "?product=a", { ...fresh, itemName: "اسمي الخاص", revenueMinor: 1234 }),
    ).toEqual({
      kind: "apply",
      catalogItemId: "a",
      itemName: null,
      revenueMinor: null,
      cost: { known: true, minor: 2000 },
      suggestedReferenceId: "a",
    });
  });

  it("الموقوف = إشعار؛ المحذوف = إهمال هادئ؛ وكلاهما يستهلك الطلب مرة واحدة", () => {
    expect(proposeProductParam(items, "?product=b", fresh)).toEqual({ kind: "inactive_reference" });
    expect(proposeProductParam(items, "?product=zz", fresh)).toEqual({ kind: "unavailable" });
    expect(proposeProductParam(items, "?product=a", { ...fresh, alreadyApplied: true })).toEqual({
      kind: "none",
    });
    expect(proposeProductParam(items, "?product=a", { ...fresh, editing: true })).toEqual({ kind: "none" });
  });
});

describe("R7/P07 — خريطة السجل المحمّل إلى قيم النموذج", () => {
  const sale = {
    itemName: "خدمة أ",
    quantity: 2,
    revenueMinor: 9000,
    collectedMinor: 5000,
    costMinor: null,
    customerName: null,
    catalogItemId: "a",
    occurredOn: "2026-09-01",
    note: "ملاحظة",
    collectionStatus: "partial_debt",
  } as unknown as DirectSale;

  it("الخريطة كما كانت الصفحة تطبقها (بما فيها قرار الفرق من حالة التحصيل)", () => {
    expect(directSaleToFormValues(sale)).toEqual({
      itemName: "خدمة أ",
      quantity: 2,
      revenueMinor: 9000,
      collectedEmpty: false,
      collectedMinor: 5000,
      costKnown: false,
      costMinor: 0,
      customerName: "",
      catalogItemId: "a",
      occurredOn: "2026-09-01",
      note: "ملاحظة",
      differenceChoice: "remaining_debt",
    });
  });

  it("القبض الكامل المحفوظ = الحقلة الفارغة (تعني السعر)", () => {
    const full = {
      ...sale,
      collectedMinor: 9000,
      collectionStatus: "collected_in_full",
    } as unknown as DirectSale;
    expect(directSaleToFormValues(full).collectedEmpty).toBe(true);
    expect(directSaleToFormValues(full).differenceChoice).toBeNull();
  });
});
