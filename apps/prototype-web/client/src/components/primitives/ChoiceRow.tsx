import type { ReactNode } from "react";
import clsx from "clsx";

/*
 * W2 (completion run) — ChoiceRow: عقد الاختيار المتعادلة (component-contracts.md).
 * ---------------------------------------------------------------------------
 * «الاختيار والحالة الراهنة يستخدمان دور الحافة المختارة: حافة 2px بلون
 * clay-interactive (--vf-clay-interactive) أو تسطير مع إشارة غير لونية
 * (وزن أثقل). الشرائح والمقاطع المختارة لا تصبح مساحات سوداء تلقائيًا.»
 *
 * العقد: صف خيارات متعادلة — غير المختار سطح ثانوي هادئ؛ المختار يحتفظ
 * بالسطح الهادئ ويضيف حافة داخلية 2px بلون clay-interactive + وزن أثقل
 * (الإشارة غير اللونية). لا يمتلئ بالأسود أبدًا ولا بلون الهوية. الاختيار
 * حالة عرض صرفة — المعنى المالي (نقدًا/بالذمم، عمر طويل...) ملك الشاشة.
 * الملكية: طبقة المكوّنات الأولية (لا يستورد شيئًا خارجها).
 */

export interface ChoiceRowProps {
  /** أزرار الخيارات — استخدم ChoiceButton لكل خيار. */
  children: ReactNode;
  className?: string;
}

export function ChoiceRow({ children, className }: ChoiceRowProps) {
  return <div className={clsx("micro-prim-choice-row", className)}>{children}</div>;
}

export interface ChoiceButtonProps {
  /** هل هذا الخيار هو المختار حاليًا (حافة clay-interactive + وزن أثقل). */
  selected?: boolean;
  children: ReactNode;
  className?: string;
  onClick?: () => void;
  type?: "button" | "submit";
  disabled?: boolean;
  /** اسم المجموعة للوصولية (toggle semantics). */
  name?: string;
}

export function ChoiceButton({
  selected = false,
  children,
  className,
  onClick,
  type = "button",
  disabled,
  name,
}: ChoiceButtonProps) {
  return (
    <button
      type={type}
      aria-pressed={selected}
      aria-disabled={disabled || undefined}
      name={name}
      disabled={disabled}
      className={clsx("micro-prim-choice", selected && "micro-prim-choice--selected", className)}
      onClick={onClick}
    >
      {children}
    </button>
  );
}
