/**
 * Micro design reminder: every route begins with the same operational grammar:
 * the current decision, the truth Micro knows, then one concrete next action.
 */
type DecisionPanelProps = {
  label: string;
  truth: string;
  nextAction: string;
  tone?: "accent" | "support" | "warning";
};

export function DecisionPanel({ label, truth, nextAction, tone = "support" }: DecisionPanelProps) {
  return (
    <section className="micro-decision-panel" data-tone={tone}>
      <span className="micro-decision-label">{label}</span>
      <div>
        {/* UXR-08 (COPY-01/F-006 — تغطية مستهلك نهائي): عنوان «ما نعرفه الآن» العام يُحذف
         * والقيمة تبقى في مالكها — وسم القرار أعلاه يحمل السياق والجملة القوية تظهر تحته مباشرة. */}
        <strong>{truth}</strong>
      </div>
      <div>
        <span>الخطوة التالية</span>
        <p>{nextAction}</p>
      </div>
    </section>
  );
}
