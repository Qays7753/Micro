import type { HTMLAttributes, ReactNode } from "react";
import clsx from "clsx";

/*
 * W2 — EmptyState: عقد الفراغ (empty-loading-error-states.md).
 * ---------------------------------------------------------------------------
 * "لا بيانات" ليس فشلًا: رمز هادئ + عنوان موجّه + فعل واحد (سجّل أول…).
 * "لا نتائج" (المرشّح استثنى البيانات): عنوان هادئ + فعل إزالة مرشّح واحد.
 * الحالة هنا عرض فقط — النصوص والأفعال ملك الشاشة وتُمرَّر كخصائص.
 */

export interface EmptyStateProps extends Omit<HTMLAttributes<HTMLElement>, "title"> {
  /** رمز هادئ (أيقونة) — اختياري. */
  symbol?: ReactNode;
  /** خانة حالة اختيارية (شريحة الحالة الصادقة — «لا بيانات» ليس فشلًا). */
  state?: ReactNode;
  /** العنوان (مستوى العنوان مسؤولية الشاشة — يُمرَّر جاهزًا). */
  title: ReactNode;
  /** الشرح الموجّه. */
  description?: ReactNode;
  /** فعل واحد (زر الإرشاد) — اختياري. */
  action?: ReactNode;
}

export function EmptyState({
  symbol,
  state,
  title,
  description,
  action,
  className,
  ...rest
}: EmptyStateProps) {
  return (
    <section className={clsx("micro-prim-empty", className)} {...rest}>
      {symbol ? (
        <span aria-hidden="true" className="micro-prim-empty__symbol">
          {symbol}
        </span>
      ) : null}
      {state ? <span className="micro-prim-empty__state">{state}</span> : null}
      <span className="micro-prim-empty__title">{title}</span>
      {description ? <span className="micro-prim-empty__description">{description}</span> : null}
      {action ? <span className="micro-prim-empty__action">{action}</span> : null}
    </section>
  );
}
