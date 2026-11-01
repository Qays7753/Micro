/* مبدأ Micro: تثبت الاختبارات أن لغة الاتفاق تشرح الحالة الفعلية ولا تخترع اعتمادًا ثانيًا. */
import { describe, expect, it } from "vitest";
import { getAgreementPresentation } from "./orderAgreementPresentation";

describe("getAgreementPresentation", () => {
  it("distinguishes an empty agreement from a partial one", () => {
    expect(getAgreementPresentation({ status: "draft" })).toMatchObject({
      kind: "none",
      label: "لا يوجد اتفاق",
      nextAction: "أضف السعر وموعد التسليم",
    });
    expect(getAgreementPresentation({ status: "draft", agreedPriceMinor: 1200 })).toMatchObject({
      kind: "incomplete",
      label: "اتفاق ناقص",
      nextAction: "أكمل موعد التسليم",
    });
  });

  it("shows a saved agreement and a separate execution action", () => {
    expect(
      getAgreementPresentation({
        status: "provisional_agreement",
        agreedPriceMinor: 1200,
        deliveryDate: "2026-09-10",
      }),
    ).toMatchObject({
      kind: "saved",
      label: "اتفاق محفوظ",
      nextAction: "ابدأ التنفيذ",
    });
  });

  it("keeps review and settlement language grounded in the current status", () => {
    expect(
      getAgreementPresentation({
        status: "needs_review",
        agreedPriceMinor: 1200,
        deliveryDate: "2026-09-10",
      }),
    ).toMatchObject({ label: "يحتاج مراجعة", nextAction: "افتح المراجعة" });
    expect(
      getAgreementPresentation({
        status: "settled",
        agreedPriceMinor: 1200,
        deliveryDate: "2026-09-10",
      }),
    ).toMatchObject({ label: "مغلق", nextAction: "راجع نتيجة الطلب" });
  });

  /* S12 (DOC-021 — J002-DEC02، تصحيح R5-F01): التمييز الثلاثي — المجهول
   * الصريح null يُعرض بحالته الحقيقية لا «ناقصًا» ولا بموعد اليوم. */
  it("saved with an explicitly-unknown date: the true state, never «ناقص»", () => {
    expect(
      getAgreementPresentation({
        status: "provisional_agreement",
        agreedPriceMinor: 1200,
        deliveryDate: null,
      }),
    ).toMatchObject({
      kind: "saved",
      label: "اتفاق محفوظ · الموعد لم يُحدد بعد",
      nextAction: "ابدأ التنفيذ",
    });
    expect(
      getAgreementPresentation({ status: "in_progress", agreedPriceMinor: 1200, deliveryDate: null }),
    ).toMatchObject({ kind: "execution", label: "قيد التنفيذ · الموعد لم يُحدد بعد" });
    expect(
      getAgreementPresentation({ status: "ready", agreedPriceMinor: 1200, deliveryDate: null }),
    ).toMatchObject({ kind: "execution", label: "جاهز للتسليم · الموعد لم يُحدد بعد" });
  });

  it("draft with an explicitly-unknown date: review, not an incomplete-agreement prompt", () => {
    /* بلا سعر مع موعد مجهول صريح: النقص هو السعر وحده — المجهول ليس نقصًا
     * فلا يُدرج في قائمة النقص (تسمية الدومين الكنونية للسعر). */
    expect(getAgreementPresentation({ status: "draft", deliveryDate: null })).toMatchObject({
      kind: "incomplete",
      label: "اتفاق ناقص",
      nextAction: "أكمل السعر المتفق عليه",
    });
    expect(
      getAgreementPresentation({ status: "draft", agreedPriceMinor: 1200, deliveryDate: null }),
    ).toMatchObject({
      kind: "review",
      label: "اتفاق قيد المراجعة",
      nextAction: "راجع السعر والموعد",
    });
    /* الفراغ (لم يُدخل بعد) يبقى ناقصًا كما كان — المجهول الصريح مختلف عنه. */
    expect(
      getAgreementPresentation({ status: "draft", agreedPriceMinor: 1200, deliveryDate: "" }),
    ).toMatchObject({
      kind: "incomplete",
      label: "اتفاق ناقص",
      nextAction: "أكمل موعد التسليم",
    });
  });

  it("price missing dominates: the unknown date never masks the price gap", () => {
    expect(
      getAgreementPresentation({
        status: "provisional_agreement",
        agreedPriceMinor: null,
        deliveryDate: null,
      }),
    ).toMatchObject({ kind: "incomplete", label: "اتفاق ناقص", nextAction: "أكمل السعر المتفق عليه" });
  });
});
