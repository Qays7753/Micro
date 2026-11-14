import React from "react";
import { useId, type HTMLAttributes, type ReactNode } from "react";
import clsx from "clsx";
import { StateMarker } from "./markers";

/*
 * W2 — Field: عقد الحقل (input-system.md).
 * ---------------------------------------------------------------------------
 * سطح أبيض، حد بنيوي، تركيز بحبر دافئ مرئي، واسترجاع خطأ داخل السطر.
 * التسمية ≥13px (أرضية اللصائق). خانة تلميح (12px — بيانات وصفية غير
 * مالية فقط). الخطأ: كلمة + علامة تنبيه بحبر الخطأ، ويُرى مع بقاء المدخلات
 * (الاسترجاع لا يمسح ما كتبه المالك). العنصر التحكم نفسه يُمرَّر كأبناء —
 * السياسة المالية والتقريب ملك المنتج خارج هذا العقد.
 *
 * R10-B4/F-017 (قاعدة الحزم الموحدة): نص خطأ الحقل فشل تحقق مؤكد —
 * يعلن بـ role="alert" حازمًا كقنوات الخطأ كلها؛ كان الوحيد status.
 *
 * Stage C (S13/R3-1 — أمر المالك 2026-11-14 «جاهزية Manage + إغلاق CI/UX»):
 * الربط البرمجي للتسمية لم يعد اختياريًا — عند غياب controlId يُولَّد معرّف
 * ثابت بـ useId ويُحقن على عنصر التحكم الوحيد نفسه (cloneElement)، فيحصل كل
 * حقل على اسم برمجي (WCAG 2.2 AA SC 3.3.2 Labels or Instructions) في كل
 * المستهلكين دفعة واحدة؛ controlId الصريح يبقى محترمًا كما هو (لا تغيير
 * لأي مستهلك قائم ولا لهوية العناصر المختبرة).
 */

export interface FieldProps extends HTMLAttributes<HTMLDivElement> {
  /** تسمية الحقل (تُربط بـ htmlFor دائمًا — صراحةً عبر controlId أو تلقائيًا). */
  label: ReactNode;
  /** بيانات وصفية غير مالية (12px). */
  hint?: ReactNode;
  /** نص الخطأ مع مسار استرجاه — وجوده يحوّل الحقل للوضع الخاطئ. */
  error?: ReactNode;
  /** id العنصر التحكم لربط التسمية (اختياري — يُولَّد عند غيابه). */
  controlId?: string;
  children: ReactNode;
}

export function Field({ label, hint, error, controlId, className, children, ...rest }: FieldProps) {
  /* Stage C (S13/R3-1): معرّف مستقر لكل مثيل حقل — التسمية مربوطة برمجيًا
   * حتى بلا controlId صريح؛ معرفات React آمنة للأرقام والأحرف ولا تصطدم
   * بين المثيلات. */
  const autoId = useId();
  const resolvedId = controlId ?? autoId;
  /* Wave 4.4 — P-4.4-5: الربط تلقائي الآن — عنصر التحكم الذي يمرر controlId
   * يستلم aria-invalid وaria-describedby عند الخطأ (ترقية العقد الموثق في
   * رأس الملف: الوصلات لم تعد عبئًا على كل مستهلك). */
  const errorId = `${resolvedId}-field-error`;
  const wiredChildren = React.isValidElement(children)
    ? React.cloneElement(children as React.ReactElement<Record<string, unknown>>, {
        id: ((children.props as Record<string, unknown>)["id"] as string | undefined) ?? resolvedId,
        ...(error
          ? {
              "aria-invalid": true,
              "aria-describedby":
                [
                  (children.props as Record<string, unknown>)["aria-describedby"] as string | undefined,
                  errorId,
                ]
                  .filter(Boolean)
                  .join(" ") || undefined,
            }
          : {}),
      })
    : children;
  return (
    <div
      className={clsx("micro-prim-field", error && "micro-prim-field--error")}
      data-invalid={error ? true : undefined}
      {...rest}
    >
      <label className="micro-prim-field__label" htmlFor={resolvedId}>
        {label}
      </label>
      {wiredChildren}
      {error ? (
        <p className="micro-prim-field__error" role="alert" id={errorId}>
          <StateMarker marker="alert" />
          <span>{error}</span>
        </p>
      ) : hint ? (
        <p className="micro-prim-field__hint">{hint}</p>
      ) : null}
    </div>
  );
}
