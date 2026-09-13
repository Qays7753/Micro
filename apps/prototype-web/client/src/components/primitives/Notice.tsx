import type { HTMLAttributes, ReactNode } from "react";
import clsx from "clsx";
import { Check } from "lucide-react";
import { StateMarker } from "./markers";

/*
 * W2 — Notice / QuietCompletion: عقد التغذية الراجعة الهادئة (U-07/D-06).
 * ---------------------------------------------------------------------------
 * النظام المصادق عليه: inline/quiet — role="status" (aria-live مهذّب)،
 * كلمة + علامة، بلا Snackbar إلزامي. الإتمام الهادئ: علامة صح بحبر داكن
 * على السطح الدافئ (قاعدة المعيار: على الأسطح الدافئة تحمل العلامة المعنى
 * بالشكل، والحبر هو الآمن) + كلمة بصيغة الماضي (ملك المنتج — تُمرَّر).
 * الأخطاء: حبر الخطأ (آمن نصيًا 5.46:1 على الأرضية) + علامة تنبيه.
 */

export interface NoticeProps extends HTMLAttributes<HTMLDivElement> {
  tone?: "neutral" | "info" | "success" | "error";
  /** علامة اختيارية تُضاف قبل المحتوى (دور من مهايئ الحالات عند الحاجة). */
  markerRole?: ReactNode;
}

export function Notice({ tone = "neutral", className, children, ...rest }: NoticeProps) {
  return (
    <div
      role="status"
      className={clsx("micro-prim-notice", `micro-prim-notice--${tone}`, className)}
      {...rest}
    >
      {children}
    </div>
  );
}

export interface QuietCompletionProps extends HTMLAttributes<HTMLDivElement> {
  /** كلمة الإتمام بصيغة الماضي — ملك المنتج (مثال: "تم الحفظ"). */
  word: ReactNode;
}

export function QuietCompletion({ word, className, ...rest }: QuietCompletionProps) {
  return (
    <div
      role="status"
      className={clsx("micro-prim-notice", "micro-prim-notice--quiet-completion", className)}
      {...rest}
    >
      <Check aria-hidden="true" className="micro-prim-marker" />
      <span>{word}</span>
    </div>
  );
}

export function InlineError({
  children,
  ...rest
}: { children: ReactNode } & HTMLAttributes<HTMLParagraphElement>) {
  return (
    <p
      role="status"
      className={clsx("micro-prim-notice", "micro-prim-notice--error-inline", rest.className)}
      {...rest}
    >
      <StateMarker role="alert" />
      <span>{children}</span>
    </p>
  );
}
