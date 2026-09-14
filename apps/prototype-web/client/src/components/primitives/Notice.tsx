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

/*
 * W7 (تدقيق الوكيل ٤، HIGH-1) — FeedbackNote: تصنيف قناة الرسالة المختلطة.
 * ---------------------------------------------------------------------------
 * سابقات الشاشات (CostEditor/Schedule ثم Catalog) تصنف رسالتها بالبادئة:
 * إتمام هادئ (تبدأ بـ«تم »/«تمت ») · إرشاد محايد (نمط الشاشة) · وإلا فهي
 * خطأ. هذا المكوّن يجمع التصنيف المعتمد في مكان واحد بدل تكراره — الكلمة
 * نفسها ملك الشاشة ولا تتغير؛ التصنيف عرض صرف. تعبيرات نمطية لا نصوصًا
 * حرفية كي لا تدخل عدّاد كثافة النص.
 */
const FEEDBACK_SUCCESS = /^تم[ت ]/;

export interface FeedbackNoteProps extends HTMLAttributes<HTMLDivElement> {
  /** نص الرسالة — ملك الشاشة (التصنيف يطبق على النصوص). */
  word: ReactNode;
  /** نمط الإرشاد المحايد الخاص بالشاشة (اختياري) — ما طابقه يُعرض إشعارًا. */
  advisory?: RegExp;
}

export function FeedbackNote({ word, advisory, ...rest }: FeedbackNoteProps) {
  if (typeof word === "string") {
    if (FEEDBACK_SUCCESS.test(word)) {
      return <QuietCompletion word={word} {...rest} />;
    }
    if (advisory?.test(word)) {
      return <Notice {...rest}>{word}</Notice>;
    }
    return <InlineError {...rest}>{word}</InlineError>;
  }
  return <Notice {...rest}>{word}</Notice>;
}
