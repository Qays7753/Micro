/** Micro design reminder: one practical truth and one next action, never a fictional financial KPI. */
import type { ReactNode } from "react";

type InfoCardProps = {
  eyebrow?: string;
  title: string;
  children: ReactNode;
  action?: ReactNode;
  tone?: "default" | "accent" | "warning";
};
export function InfoCard({ eyebrow, title, children, action, tone = "default" }: InfoCardProps) {
  return (
    <article className="micro-info-card" data-tone={tone}>
      {eyebrow ? <span className="micro-card-eyebrow">{eyebrow}</span> : null}
      <h2>{title}</h2>
      <div className="micro-card-copy">{children}</div>
      {action ? <div className="micro-card-action">{action}</div> : null}
    </article>
  );
}
