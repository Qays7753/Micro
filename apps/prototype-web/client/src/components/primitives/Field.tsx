import React from "react";
import type { HTMLAttributes, ReactNode } from "react";
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
 * وصلات الوصول مسؤولية المستهلك: aria-invalid + aria-describedby على
 * العنصر التحكم عندما يظهر خطأ (موثقة في عقد المكوّن).
 */

export interface FieldProps extends HTMLAttributes<HTMLDivElement> {
  /** تسمية الحقل (تُربط بـ htmlFor عند تمرير id العنصر التحكم). */
  label: ReactNode;
  /** بيانات وصفية غير مالية (12px). */
  hint?: ReactNode;
  /** نص الخطأ مع مسار استرجاه — وجوده يحوّل الحقل للوضع الخاطئ. */
  error?: ReactNode;
  /** id العنصر التحكم لربط التسمية. */
  controlId?: string;
  children: ReactNode;
}

export function Field({ label, hint, error, controlId, className, children, ...rest }: FieldProps) {
  /* Wave 4.4 — P-4.4-5: الربط تلقائي الآن — عنصر التحكم الذي يمرر controlId
   * يستلم aria-invalid وaria-describedby عند الخطأ (ترقية العقد الموثق في
   * رأس الملف: الوصلات لم تعد عبئًا على كل مستهلك). */
  const errorId = controlId ? `${controlId}-field-error` : undefined;
  const wiredChildren =
    error && errorId && React.isValidElement(children)
      ? React.cloneElement(children as React.ReactElement<Record<string, unknown>>, {
          "aria-invalid": true,
          "aria-describedby":
            [(children.props as Record<string, unknown>)["aria-describedby"] as string | undefined, errorId]
              .filter(Boolean)
              .join(" ") || undefined,
        })
      : children;
  return (
    <div
      className={clsx("micro-prim-field", error && "micro-prim-field--error")}
      data-invalid={error ? true : undefined}
      {...rest}
    >
      <label className="micro-prim-field__label" htmlFor={controlId}>
        {label}
      </label>
      {wiredChildren}
      {error ? (
        <p className="micro-prim-field__error" role="status" id={errorId}>
          <StateMarker role="alert" />
          <span>{error}</span>
        </p>
      ) : hint ? (
        <p className="micro-prim-field__hint">{hint}</p>
      ) : null}
    </div>
  );
}
