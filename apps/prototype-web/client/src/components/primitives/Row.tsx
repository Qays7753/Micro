import type { HTMLAttributes, ReactNode } from "react";
import clsx from "clsx";

/*
 * W2 — Row: عقد الصف التشغيلي (component-contracts.md "operational row slots").
 * ---------------------------------------------------------------------------
 * شبكة واحدة: مقدم هوية اختياري (تجانب أيقونة/صورة رمزية) · عمود عنوان/شرح
 * يلتف بأمان للعربية · خانة حالة اختيارية (كلمة + علامة) · خانة خلفية ثابتة
 * للمبالغ الجدولية والأفعال. شريط حافة بداية السطر ≤3px بلون دلالي —
 * اختياري، وحصريًا مع وجود خانة حالة (الكلمة هي الإشارة الأساسية؛ الشريط
 * تعزيز). الفواصل داخلية (inset) ولا يُعتمد على الشريط وحده أبدًا.
 */

export type RowStripeTone = "success" | "error" | "info";

export interface RowProps extends Omit<HTMLAttributes<HTMLElement>, "title"> {
  as?: "li" | "div";
  lead?: ReactNode;
  title: ReactNode;
  caption?: ReactNode;
  state?: ReactNode;
  trailing?: ReactNode;
  /** شريط الحافة الدلالي — يُعرض فقط مع وجود خانة حالة (عقد الشريط). */
  stripeTone?: RowStripeTone;
}

export function Row({
  as: Tag = "li",
  lead,
  title,
  caption,
  state,
  trailing,
  stripeTone,
  className,
  ...rest
}: RowProps) {
  const striped = Boolean(stripeTone && state);
  return (
    <Tag
      className={clsx("micro-prim-row", striped && "micro-prim-row--striped", className)}
      data-stripe-tone={striped ? stripeTone : undefined}
      {...rest}
    >
      {lead ? <span className="micro-prim-row__lead">{lead}</span> : null}
      <span className="micro-prim-row__main">
        <span className="micro-prim-row__title">{title}</span>
        {caption ? <span className="micro-prim-row__caption">{caption}</span> : null}
      </span>
      {state ? <span className="micro-prim-row__state">{state}</span> : null}
      {trailing ? <span className="micro-prim-row__trailing">{trailing}</span> : null}
    </Tag>
  );
}

export function RowList({
  children,
  className,
  ...rest
}: { children: ReactNode } & HTMLAttributes<HTMLUListElement>) {
  return (
    <ul className={clsx("micro-prim-row-list", className)} {...rest}>
      {children}
    </ul>
  );
}
