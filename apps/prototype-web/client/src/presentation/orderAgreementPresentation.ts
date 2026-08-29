/* مبدأ Micro: تعرض هذه الخريطة حالة الاتفاق وفعلًا واحدًا، ولا تستبدل مرحلة Domain بتسمية عرضية. */

export type AgreementPresentationKind =
  "none" | "incomplete" | "review" | "saved" | "execution" | "delivery" | "settled";

export type AgreementPresentationInput = {
  status?: string | null;
  agreedPriceMinor?: number | null;
  deliveryDate?: string | null;
  nextAction?: string | null;
};

export type AgreementPresentation = {
  kind: AgreementPresentationKind;
  label: string;
  nextAction: string;
  explanation: string;
};

const hasPrice = (value: number | null | undefined) =>
  typeof value === "number" && Number.isInteger(value) && value > 0;
const hasDate = (value: string | null | undefined) => Boolean(value?.trim());

function incompleteAgreement(hasAgreedPrice: boolean, hasDeliveryDate: boolean): AgreementPresentation {
  const missing = [
    !hasAgreedPrice ? "السعر المتفق عليه" : null,
    !hasDeliveryDate ? "موعد التسليم" : null,
  ].filter((value): value is string => Boolean(value));
  const missingLabel = missing.length === 2 ? "السعر وموعد التسليم" : missing[0];
  return {
    kind: "incomplete",
    label: "اتفاق ناقص",
    nextAction: `أكمل ${missingLabel}`,
    explanation: `ينقص الاتفاق ${missingLabel} قبل اعتباره محفوظًا.`,
  };
}

export function getAgreementPresentation(input: AgreementPresentationInput): AgreementPresentation {
  const hasAgreedPrice = hasPrice(input.agreedPriceMinor);
  const hasDeliveryDate = hasDate(input.deliveryDate);
  const status = input.status ?? "draft";

  if (status === "draft" || !input.status) {
    if (!hasAgreedPrice && !hasDeliveryDate)
      return {
        kind: "none",
        label: "لا يوجد اتفاق",
        nextAction: "أضف السعر وموعد التسليم",
        explanation: "احفظ السعر والموعد عندما يصبحان معروفين لديك.",
      };
    if (!hasAgreedPrice || !hasDeliveryDate) return incompleteAgreement(hasAgreedPrice, hasDeliveryDate);
    return {
      kind: "review",
      label: "اتفاق قيد المراجعة",
      nextAction: "راجع السعر والموعد",
      explanation: "السعر والموعد مدخلان، ولم يُحفظ الاتفاق بعد.",
    };
  }

  if (!hasAgreedPrice || !hasDeliveryDate) return incompleteAgreement(hasAgreedPrice, hasDeliveryDate);

  switch (status) {
    case "provisional_agreement":
    case "confirmed":
      return {
        kind: "saved",
        label: "اتفاق محفوظ",
        nextAction: "ابدأ التنفيذ",
        explanation: "السعر وموعد التسليم محفوظان. بدء التنفيذ فعل منفصل.",
      };
    case "in_progress":
      return {
        kind: "execution",
        label: "قيد التنفيذ",
        nextAction: "أكمل التنفيذ",
        explanation: "الاتفاق محفوظ والعمل بدأ؛ لا ينشئ تغيير الحالة قبضًا.",
      };
    case "ready":
      return {
        kind: "execution",
        label: "جاهز للتسليم",
        nextAction: "سجل التسليم",
        explanation: "العمل جاهز، والتسليم خطوة تشغيلية منفصلة عن التحصيل.",
      };
    case "delivered":
      return {
        kind: "delivery",
        label: "تم التسليم",
        nextAction: input.nextAction?.trim() || "راجع التحصيل أو النتيجة",
        explanation: "التسليم مسجل؛ راجع المتبقي أو نتيجة الطلب دون مساواة القبض بالربح.",
      };
    case "settled":
      return {
        kind: "settled",
        label: "مغلق",
        nextAction: "راجع نتيجة الطلب",
        explanation: "أُغلقت التسوية، وتبقى نتيجة الطلب مرتبطة بدرجة المعرفة.",
      };
    case "cancelled":
      return {
        kind: "review",
        label: "ملغى",
        nextAction: "راجع تسوية الطلب",
        explanation: "الإلغاء لا يحذف الطلب أو أثره؛ راجع التسوية الموثقة.",
      };
    case "postponed":
      return {
        kind: "review",
        label: "مؤجل",
        nextAction: input.nextAction?.trim() || "راجع سبب التأجيل",
        explanation: "التأجيل يحتاج سببًا وفعل متابعة واضحًا.",
      };
    case "needs_review":
      return {
        kind: "review",
        label: "يحتاج مراجعة",
        nextAction: "افتح المراجعة",
        explanation: "هذه الحالة موقوفة للمراجعة؛ راجع الطلب قبل أي خطوة مالية.",
      };
    default:
      return {
        kind: "review",
        label: "يحتاج مراجعة",
        nextAction: input.nextAction?.trim() || "افتح الطلب وراجع الحالة",
        explanation: "حالة غير معروفة للعرض؛ لم يتغير أي شيء.",
      };
  }
}
