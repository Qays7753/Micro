/** R7 / R6-F17-P07 (2026-10-10): عقد نموذج عرض محرر البيع المباشر — بوابة
 * التحقق، قرار الفرق X-06، تعيين مرجع الوصلة العميقة، وخريطة السجل المحمّل.
 * S11-MR-001 (UNIT-005 A2/B3): وضع الدفع الصريح — اشتقاق المقبوض من الوضع،
 * القرار الفعّال، هجرة المسودة القديمة، وأجزاء المعاينة الملاصقة للحفظ.
 * نفس شروط القرار التي كانت الصفحة تنفذها؛ النصوص العربية نسخة واجهة تبقى
 * عند الصفحة — الوحدة تعيد أكواد قرارات فقط. */
import { describe, expect, it } from "vitest";
import {
  directSalePreviewParts,
  directSaleToFormValues,
  effectiveDifferenceChoice,
  paymentModeFromDraft,
  productParamFromSearch,
  proposeProductParam,
  resolveCollectedForMode,
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
  paymentMode: "full" as const,
  validCollected: true,
  collectedEmpty: true,
  partialCollectedMinor: 0,
  costKnown: false,
  validCost: true,
  costMinor: 0,
  difference: 0,
  differenceChoice: null,
  undecidedDifference: false,
};

describe("R7/P07 — بوابة التحقق قبل الإرسال", () => {
  it("القيم السليمة تمر (null) في كل أوضاع الدفع", () => {
    expect(validateDirectSaleSubmission(validBase)).toBeNull();
    expect(
      validateDirectSaleSubmission({
        ...validBase,
        paymentMode: "partial",
        collectedEmpty: false,
        partialCollectedMinor: 4000,
        difference: 1000,
      }),
    ).toBeNull();
    expect(validateDirectSaleSubmission({ ...validBase, paymentMode: "none", difference: 5000 })).toBeNull();
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
    expect(
      validateDirectSaleSubmission({ ...validBase, costKnown: true, validCost: false, costMinor: 100 }),
    ).toBe("missing_required_fields");
    expect(
      validateDirectSaleSubmission({ ...validBase, costKnown: true, validCost: true, costMinor: -1 }),
    ).toBe("missing_required_fields");
  });

  it("S11-MR-001: مبلغ الجزء الفراغ/الصفر/غير الصالح = partial_amount_required (لا تفسير مالي للفراغ)", () => {
    expect(
      validateDirectSaleSubmission({
        ...validBase,
        paymentMode: "partial",
        collectedEmpty: true,
        partialCollectedMinor: 0,
        difference: 5000,
      }),
    ).toBe("partial_amount_required");
    expect(
      validateDirectSaleSubmission({
        ...validBase,
        paymentMode: "partial",
        validCollected: false,
        collectedEmpty: false,
        partialCollectedMinor: 0,
        difference: 5000,
      }),
    ).toBe("partial_amount_required");
    expect(
      validateDirectSaleSubmission({
        ...validBase,
        paymentMode: "partial",
        collectedEmpty: false,
        partialCollectedMinor: 0,
        difference: 5000,
      }),
    ).toBe("partial_amount_required");
  });

  it("S11-MR-001: مبلغ الجزء فوق السعر = collected_exceeds_price؛ ومساوي الإجمالي = إشارة للكامل", () => {
    expect(
      validateDirectSaleSubmission({
        ...validBase,
        paymentMode: "partial",
        collectedEmpty: false,
        partialCollectedMinor: 6000,
        difference: -1000,
      }),
    ).toBe("collected_exceeds_price");
    expect(
      validateDirectSaleSubmission({
        ...validBase,
        paymentMode: "partial",
        collectedEmpty: false,
        partialCollectedMinor: 5000,
        difference: 0,
      }),
    ).toBe("partial_amount_equals_total");
  });

  it("S11-MR-001: الدين من الوضع الصريح لا يسأل قرارًا ثانيًا؛ والفرق المعلق القديم يسأله", () => {
    /* جزء/لم أستلم مع فرق وبلا قرار حالة مختلفة = دين صريح من الوضع — يمر. */
    expect(
      validateDirectSaleSubmission({
        ...validBase,
        paymentMode: "partial",
        collectedEmpty: false,
        partialCollectedMinor: 4000,
        difference: 1000,
        differenceChoice: null,
      }),
    ).toBeNull();
    expect(
      validateDirectSaleSubmission({
        ...validBase,
        paymentMode: "none",
        difference: 5000,
        differenceChoice: null,
      }),
    ).toBeNull();
    /* مسودة قديمة الاستعادة بفرق لم يُحسم باتفاق صريح — النظام ينبّه ولا يقرّر. */
    expect(
      validateDirectSaleSubmission({
        ...validBase,
        paymentMode: "partial",
        collectedEmpty: false,
        partialCollectedMinor: 4000,
        difference: 1000,
        differenceChoice: null,
        undecidedDifference: true,
      }),
    ).toBe("difference_choice_required");
    expect(
      validateDirectSaleSubmission({
        ...validBase,
        paymentMode: "partial",
        collectedEmpty: false,
        partialCollectedMinor: 4000,
        difference: 1000,
        differenceChoice: "price_cut",
        undecidedDifference: true,
      }),
    ).toBeNull();
  });

  it("S11-MR-001: نص غير صالح في مبلغ جزء مهجور لا يمنع حفظ وضع آخر", () => {
    expect(
      validateDirectSaleSubmission({
        ...validBase,
        paymentMode: "none",
        validCollected: false,
        collectedEmpty: false,
        partialCollectedMinor: 0,
        difference: 5000,
      }),
    ).toBeNull();
  });
});

describe("S11-MR-001 — اشتقاق المقبوض والقرار الفعّال من وضع الدفع", () => {
  it("الكامل = الإجمالي؛ والجزء = المُدخل؛ و«لم أستلم» = صفر صريح", () => {
    expect(resolveCollectedForMode("full", 5000, 1234)).toBe(5000);
    expect(resolveCollectedForMode("partial", 5000, 1234)).toBe(1234);
    expect(resolveCollectedForMode("none", 5000, 1234)).toBe(0);
  });

  it("القرار الفعّال: الكامل بلا فرق؛ والدين معنى الوضع ما لم تختر حالة مختلفة", () => {
    expect(effectiveDifferenceChoice("full", "needs_review")).toBeNull();
    expect(effectiveDifferenceChoice("partial", null)).toBe("remaining_debt");
    expect(effectiveDifferenceChoice("none", null)).toBe("remaining_debt");
    expect(effectiveDifferenceChoice("partial", "price_cut")).toBe("price_cut");
    expect(effectiveDifferenceChoice("none", "needs_review")).toBe("needs_review");
  });
});

describe("S11-MR-001 — هجرة مسودة ما قبل الأوضاع (collectedEmpty القديم)", () => {
  it("مسودة بنمط اليوم: الوضع والقرار المعلق يُقرآن كما حُفظا", () => {
    expect(
      paymentModeFromDraft({ paymentMode: "none", differenceUndecided: false, revenueMinor: 5000 }),
    ).toEqual({ mode: "none", undecidedDifference: false });
    expect(
      paymentModeFromDraft({ paymentMode: "partial", differenceUndecided: true, revenueMinor: 5000 }),
    ).toEqual({ mode: "partial", undecidedDifference: true });
  });

  it("الحقلة القديمة = الكامل (معناها الأصلي محفوظ)", () => {
    expect(paymentModeFromDraft({ collectedEmpty: true, collectedMinor: 0, revenueMinor: 5000 })).toEqual({
      mode: "full",
      undecidedDifference: false,
    });
    /* غياب الحقل كليًا كالحقلة نفسها — لا فراغ يُفسَّر دينًا. */
    expect(paymentModeFromDraft({ revenueMinor: 5000 })).toEqual({
      mode: "full",
      undecidedDifference: false,
    });
  });

  it("مسودة قديمة بقبض جزئي موجب = جزء بفرق غير محسوم (لا يُمنح دينًا بصمت)", () => {
    expect(paymentModeFromDraft({ collectedEmpty: false, collectedMinor: 2000, revenueMinor: 5000 })).toEqual(
      { mode: "partial", undecidedDifference: true },
    );
    /* القبض المساوي للإجمالي = كامل محسوم. */
    expect(paymentModeFromDraft({ collectedEmpty: false, collectedMinor: 5000, revenueMinor: 5000 })).toEqual(
      { mode: "full", undecidedDifference: false },
    );
  });

  it("مسودة قديمة بصفر صريح مع إجمالي = «لم أستلم» بفرق غير محسوم", () => {
    expect(paymentModeFromDraft({ collectedEmpty: false, collectedMinor: 0, revenueMinor: 5000 })).toEqual({
      mode: "none",
      undecidedDifference: true,
    });
    /* صفر بلا إجمالي = لا شيء أُدخل أصلًا — الكامل الافتراضي. */
    expect(paymentModeFromDraft({ collectedEmpty: false, collectedMinor: 0, revenueMinor: 0 })).toEqual({
      mode: "full",
      undecidedDifference: false,
    });
  });
});

describe("S11-MR-001 — أجزاء المعاينة الملاصقة للحفظ", () => {
  const base = {
    valid: true,
    revenueMinor: 15000,
    resolvedCollectedMinor: 5000,
    difference: 10000,
    paymentMode: "partial" as const,
    effectiveChoice: "remaining_debt" as const,
  };

  it("مدخل غير صالح أو إجمالي فارغ = لا معاينة (لا رقم من نص فاسد)", () => {
    expect(directSalePreviewParts({ ...base, valid: false }).kind).toBe("unavailable");
    expect(directSalePreviewParts({ ...base, revenueMinor: 0 }).kind).toBe("unavailable");
  });

  it("الكامل: البيع = المقبوض = الإجمالي؛ والدين: الأرقام الثلاثة من النية الفعّالة", () => {
    expect(
      directSalePreviewParts({
        ...base,
        paymentMode: "full",
        difference: 0,
        resolvedCollectedMinor: 15000,
        effectiveChoice: null,
      }),
    ).toEqual({
      kind: "full",
      saleMinor: 15000,
    });
    expect(directSalePreviewParts(base)).toEqual({
      kind: "debt",
      saleMinor: 15000,
      collectedMinor: 5000,
      debtMinor: 10000,
      none: false,
    });
    expect(
      directSalePreviewParts({
        ...base,
        paymentMode: "none",
        resolvedCollectedMinor: 0,
        difference: 15000,
        effectiveChoice: "remaining_debt",
      }),
    ).toEqual({ kind: "debt", saleMinor: 15000, collectedMinor: 0, debtMinor: 15000, none: true });
  });

  it("الحالة المختلفة: تخفيض بالسعر الفعلي؛ ومراجعة بفرق معلق", () => {
    expect(directSalePreviewParts({ ...base, effectiveChoice: "price_cut" })).toEqual({
      kind: "price_cut",
      effectiveSaleMinor: 5000,
    });
    expect(directSalePreviewParts({ ...base, effectiveChoice: "needs_review" })).toEqual({
      kind: "review",
      saleMinor: 15000,
      collectedMinor: 5000,
      pendingMinor: 10000,
      none: false,
    });
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
      /* S11-MR-001: وضع السجل القائم من محفوظه — جزء (لا افتراض إنشائي). */
      paymentMode: "partial",
      collectedEmpty: false,
      collectedMinor: 5000,
      costKnown: false,
      costMinor: 0,
      customerName: "",
      /* S05 (DOC-014 / UNIT-037): ربط الطرف المحفوظ يُستعاد مع المسودة،
       * والحفظ للاستخدام قيد غير محدد مسبقًا لا يُستعاد من السجل. */
      customerPartyId: "",
      saveForReuse: false,
      catalogItemId: "a",
      occurredOn: "2026-09-01",
      note: "ملاحظة",
      differenceChoice: "remaining_debt",
    });
  });

  it("القبض الكامل المحفوظ = الحقلة الفارغة (تعني السعر) ووضع الكامل", () => {
    const full = {
      ...sale,
      collectedMinor: 9000,
      collectionStatus: "collected_in_full",
    } as unknown as DirectSale;
    expect(directSaleToFormValues(full).collectedEmpty).toBe(true);
    expect(directSaleToFormValues(full).paymentMode).toBe("full");
    expect(directSaleToFormValues(full).differenceChoice).toBeNull();
  });

  it("S11-MR-001: القبض الصفري المحفوظ = وضع «لم أستلم»", () => {
    const nonePaid = {
      ...sale,
      collectedMinor: 0,
      collectionStatus: "partial_debt",
    } as unknown as DirectSale;
    expect(directSaleToFormValues(nonePaid).paymentMode).toBe("none");
  });
});
