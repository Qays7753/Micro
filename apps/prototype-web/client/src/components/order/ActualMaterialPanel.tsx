/* §10: «المادة المنفذة مقابل المخطط» وحدة مستقلة داخل طبقة «تفاصيل إضافية» — قيم مسجلة بلا سرد. */
import { PackageCheck } from "lucide-react";
import type { OrderActualMaterialComparison } from "@/application/inventory/inventoryMaterialService";
import { MoneyValue } from "@/components/presentation/DisplayValue";
import { InfoCard } from "@/components/presentation/InfoCard";

export type MaterialState =
  { phase: "loading" } | { phase: "error" } | { phase: "ready"; comparison: OrderActualMaterialComparison };

export function ActualMaterialPanel({ state, onRecord }: { state: MaterialState; onRecord: () => void }) {
  if (state.phase === "loading")
    return (
      <section className="micro-note-card" aria-live="polite">
        <PackageCheck aria-hidden="true" />
        <p>جارٍ قراءة المادة المنفذة لهذا الطلب…</p>
      </section>
    );
  if (state.phase === "error")
    return (
      <section className="micro-note-card">
        <PackageCheck aria-hidden="true" />
        <p>تعذر قراءة مقارنة المادة الآن.</p>
      </section>
    );
  const { comparison } = state;
  if (comparison.status === "not_recorded")
    return (
      <section className="micro-decision-panel" data-tone="warning">
        <div>
          <span className="micro-decision-label">المادة المنفذة مقابل المخطط</span>
          <strong>لم تسجل مادة منفذة لهذا الطلب بعد</strong>
        </div>
        <button className="micro-text-action" type="button" onClick={onRecord}>
          سجّل استهلاك مادة إذا كان مؤثرًا
        </button>
      </section>
    );
  /* S4-04: البطاقة عبر المكوّن المشترك بدل ترميز مكرر — نفس الفئات والنغمة. */
  return (
    <InfoCard
      eyebrow="المادة المنفذة مقابل المخطط"
      title={comparison.status === "needs_review" ? "فرق المادة يحتاج مراجعة" : "فرق مادة مسجل لهذا الطلب"}
      tone={comparison.status === "needs_review" ? "warning" : "default"}
    >
      <div className="micro-record-summary">
        <div>
          <span>مادة مخططة</span>
          <strong>
            <MoneyValue minor={comparison.plannedMaterialMinor} />
          </strong>
        </div>
        <div>
          <span>مادة منفذة مسجلة</span>
          <strong>
            <MoneyValue minor={comparison.actualMaterialMinor ?? 0} />
          </strong>
        </div>
        <div>
          <span>الفرق</span>
          <strong>
            <MoneyValue minor={comparison.varianceMinor ?? 0} showPlus />
          </strong>
        </div>
        <div>
          <span>حركات استهلاك</span>
          <strong className="micro-number">{comparison.consumptionCount}</strong>
        </div>
      </div>
    </InfoCard>
  );
}
