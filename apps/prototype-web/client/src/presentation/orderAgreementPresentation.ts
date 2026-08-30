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
      };
    if (!hasAgreedPrice || !hasDeliveryDate) return incompleteAgreement(hasAgreedPrice, hasDeliveryDate);
    return {
      kind: "review",
      label: "اتفاق قيد المراجعة",
      nextAction: "راجع السعر والموعد",
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
      };
    case "in_progress":
      return {
        kind: "execution",
        label: "قيد التنفيذ",
        nextAction: "أكمل التنفيذ",
      };
    case "ready":
      return {
        kind: "execution",
        label: "جاهز للتسليم",
        nextAction: "سجل التسليم",
      };
    case "delivered":
      return {
        kind: "delivery",
        label: "تم التسليم",
        nextAction: input.nextAction?.trim() || "راجع التحصيل أو النتيجة",
      };
    case "settled":
      return {
        kind: "settled",
        label: "مغلق",
        nextAction: "راجع نتيجة الطلب",
      };
    case "cancelled":
      return {
        kind: "review",
        label: "ملغى",
        nextAction: "راجع تسوية الطلب",
      };
    case "postponed":
      return {
        kind: "review",
        label: "مؤجل",
        nextAction: input.nextAction?.trim() || "راجع سبب التأجيل",
      };
    case "needs_review":
      return {
        kind: "review",
        label: "يحتاج مراجعة",
        nextAction: "افتح المراجعة",
      };
    default:
      return {
        kind: "review",
        label: "يحتاج مراجعة",
        nextAction: input.nextAction?.trim() || "افتح الطلب وراجع الحالة",
      };
  }
}
