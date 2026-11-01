/* مبدأ Micro: تعرض هذه الخريطة حالة الاتفاق وفعلًا واحدًا، ولا تستبدل مرحلة Domain بتسمية عرضية. */
/* R11 W3 / OD-LABEL (2026-10-15): تسمية السعر تُستهلك من مفردة الدومين
 * الكنونية (fieldLabelAr) لا من نسخة حرفية — المستهلك الوحيد القابل
 * للترحيل المحايد (طبقة تطبيق؛ حافة تطبيق→دومين قانونية لا تمس R2/R6)؛
 * «موعد التسليم» بلا مفتاح مطابق في المفردة فتبقى نصًا معلنًا هنا حتى
 * قرار مالك مستقل (لا توحيد صامتيًا). */
import { fieldLabelAr } from "@micro-domain/shared/index.js";

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

/* S12 (DOC-021 — J002-DEC02، تصحيح R5-F01): التمييز الثلاثي لموعد التسليم —
 * null = مجهول صريح «لم يُحدد بعد» (اتفاق جائز يُحفظ بلا جدول ولا تاريخ
 * صوري)، والفراغ/الغياب = لم يُدخل بعد (يسدّ النقص في المسودة قبل الحفظ)؛
 * المجهول الصريح على طلب محفوظ يُعرض بحالته الحقيقية «— الموعد لم يُحدد
 * بعد» لا «ناقصًا» ولا بموعد اليوم (اعتماد UNIT-010: يعرض الطلب المؤكد
 * بلا موعد بحالته الحقيقية). */
const unknownDateNote = " · الموعد لم يُحدد بعد";
const withUnknownNote = (presentation: AgreementPresentation, unknown: boolean): AgreementPresentation =>
  unknown ? { ...presentation, label: `${presentation.label}${unknownDateNote}` } : presentation;

function incompleteAgreement(hasAgreedPrice: boolean, hasDeliveryDate: boolean): AgreementPresentation {
  const missing = [
    !hasAgreedPrice ? fieldLabelAr("agreedPriceMinor") : null,
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
  const unknownDate = input.deliveryDate === null;
  const hasDeliveryDate = hasDate(input.deliveryDate);
  const status = input.status ?? "draft";

  if (status === "draft" || !input.status) {
    if (!hasAgreedPrice && !hasDeliveryDate && !unknownDate)
      return {
        kind: "none",
        label: "لا يوجد اتفاق",
        nextAction: "أضف السعر وموعد التسليم",
      };
    /* السعر الغائب يُكمل وحده إن كان الموعد معلومًا أو مجهولًا صراحةً —
     * المجهول ليس نقصًا فلا يُدرج في قائمة النقص أبدًا. */
    if (!hasAgreedPrice) return incompleteAgreement(hasAgreedPrice, hasDeliveryDate || unknownDate);
    if (!hasDeliveryDate && !unknownDate) return incompleteAgreement(hasAgreedPrice, false);
    /* حالة المراجعة للمجهول الصريح كحالة الموعد المعلوم — بيان الموعد
     * المجهول يظهر من حقل التاريخ نفسه في المحرر؛ لا سلسلة جديدة هنا. */
    return {
      kind: "review",
      label: "اتفاق قيد المراجعة",
      nextAction: "راجع السعر والموعد",
    };
  }

  if (!hasAgreedPrice) return incompleteAgreement(hasAgreedPrice, hasDeliveryDate || unknownDate);
  if (!hasDeliveryDate && !unknownDate) return incompleteAgreement(hasAgreedPrice, false);

  switch (status) {
    case "provisional_agreement":
    case "confirmed":
      return withUnknownNote(
        {
          kind: "saved",
          label: "اتفاق محفوظ",
          nextAction: "ابدأ التنفيذ",
        },
        unknownDate,
      );
    case "in_progress":
      return withUnknownNote(
        {
          kind: "execution",
          label: "قيد التنفيذ",
          nextAction: "أكمل التنفيذ",
        },
        unknownDate,
      );
    case "ready":
      return withUnknownNote(
        {
          kind: "execution",
          label: "جاهز للتسليم",
          nextAction: "سجّل التسليم",
        },
        unknownDate,
      );
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
