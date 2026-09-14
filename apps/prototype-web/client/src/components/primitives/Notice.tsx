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
 * R1 (D6) — FeedbackNote: قناة التغذية الراجعة الصريحة المُصنَّفة.
 * ---------------------------------------------------------------------------
 * القرار الملزم: لا تخمين بالبادئة أبدًا. الشاشة تعرف حقيقة ما حدث وقت
 * الحدث نفسه، فتُعلن القناة صراحة عبر kind: إتمام (فعل موثق تم) · إرشاد
 * (معرفة محايدة عن حالة العرض) · خطأ (تعذّر أو طلب تصحيح). الكلمة ملك
 * الشاشة ولا تتغير لتطابق التصنيف؛ التصنيف عرض صرف مصدره الحقيقة نفسها.
 * حلّ هذا محل تصنيف البادئات (تم…) الذي أخطأ عرض إتمامات مثل «سُجّل…»
 * و«أُوقفت…» و«عادت…» و«حُلّ…» كأخطاء.
 */
export type FeedbackKind = "completion" | "advisory" | "error";

/** رسالة موقّتة بقناة صريحة — الحقيقة تُحدَّد وقت الحدث لا وقت العرض. */
export interface FeedbackMessage {
  readonly kind: FeedbackKind;
  readonly word: string;
}

export interface FeedbackNoteProps extends HTMLAttributes<HTMLDivElement> {
  /** القناة الصريحة — إلزامية؛ لا تصنيف تلقائي. */
  kind: FeedbackKind;
  /** نص الرسالة — ملك الشاشة، لا يُعدَّل لتطابق القناة. */
  word: ReactNode;
}

export function FeedbackNote({ kind, word, ...rest }: FeedbackNoteProps) {
  if (kind === "completion") {
    return <QuietCompletion word={word} {...rest} />;
  }
  if (kind === "error") {
    return <InlineError {...rest}>{word}</InlineError>;
  }
  return <Notice {...rest}>{word}</Notice>;
}
