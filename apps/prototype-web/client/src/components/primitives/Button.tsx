import type { ButtonHTMLAttributes, Ref } from "react";
import clsx from "clsx";

/*
 * W2 — Button: عقد أصناف الأفعال المالكة المعتمدة (button-system.md).
 * ---------------------------------------------------------------------------
 * الأصناف: create (هوية Clay، حبر داكن للنص) · save (سطح دافئ + حبر داكن +
 * حافة clay-interactive عند الضغط — الضغط ليس نجاحًا) · commit (حبر دافئ ممتلئ +
 * نص أبيض — للالتزام عالي العواقب فقط، مع مسار تأكيد مستقل عند الاستهلاك)
 * · secondary/outline/ghost (محايدة) · quiet (مداخل التصحيح والتراجع الموثقة —
 * حد شعري، خلفية شفافة، 48px قاعدة، عقد اللمس MR-03/U09) · destructive
 * (حبر الخطأ + تأكيد).
 * الأساس المشترك: 48px، radius-control، 600، تركيز مرئي، منع الإرسال
 * المزدوج، تحميل بلا إزاحة تخطيط (الأيقونة تدور، التسمية تبقى).
 * لا معنى ماليًا داخل الزر — الأفعال تُفسَّر في سياق الشاشة.
 */

export type ButtonAction =
  "create" | "save" | "commit" | "secondary" | "outline" | "ghost" | "quiet" | "destructive";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  /** صنف الفعل (افتراضيًا save — الفعل الاعتيادي الأكثر شيوعًا). */
  action?: ButtonAction;
  /** تحميل: الأيقونة تدور والتسمية تبقى ويُمنع التكرار. */
  loading?: boolean;
  /** عرض كامل داخل الحاوية. */
  block?: boolean;
  /** React 19: المرجع prop اعتيادي — يُمرَّر إلى عنصر الزر كما هو. */
  ref?: Ref<HTMLButtonElement>;
}

export function Button({
  action = "save",
  loading = false,
  block = false,
  className,
  children,
  disabled,
  onClick,
  ref,
  type = "button",
  ...rest
}: ButtonProps) {
  return (
    <button
      ref={ref}
      type={type}
      aria-busy={loading || undefined}
      disabled={disabled || loading}
      className={clsx(
        "micro-prim-button",
        `micro-prim-button--${action}`,
        block && "micro-prim-button--block",
        className,
      )}
      onClick={loading ? undefined : onClick}
      {...rest}
    >
      {loading ? <span aria-hidden="true" className="micro-prim-spinner" /> : null}
      <span className="micro-prim-button__label">{children}</span>
    </button>
  );
}
