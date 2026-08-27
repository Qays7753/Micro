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
});
