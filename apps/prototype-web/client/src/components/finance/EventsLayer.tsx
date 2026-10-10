/* §10: طبقة «السجل والأثر» وحدة مستقلة — تسميات الأحداث وأثرها وتصحيحها الموثق. */
/* D-005: التصحيح الثلاثة الموثق — التراجع، والتعديل الذرّي (تراجع + بديل)، والحذف الموثق،
 * والاسترجاع — كلها بأثرها الحقيقي أمام العين قبل التأكيد، وسبب واضح حيث يلزم. */
/* U-001 (دورة التدقيق النهائي): وصول عملي للأحداث الأقدم لا الأحدث الثلاثة فقط —
 * زر «اعرض كل الأحداث» + تركيز صف مصدر التصحيح القادم من «السجل» عبر ?event=. */
/* R7 / R6-F17-P10 (WS-216 — 2026-10-10): صف الحدث وأدواته (eventLabel/
 * expenseContextLabel/CorrectionMode/familyEventOwner/FinancialEventRow) انتقلت
 * حرفيًا إلى الشقيق FinancialEventRow.tsx؛ هذه الوحدة تبقى منسّق الطبقة وحده. */
import { useEffect, useState } from "react";
import type { ProjectFinancialService } from "@/application/finance";
import type { FinancialEvent } from "@micro-domain/financial-event/index.js";
import { eventCountLabel } from "@/presentation/g5Plurals";
import { FinancialEventRow } from "@/components/finance/FinancialEventRow";
export function EventsLayer({
  visibleEvents,
  events,
  projectFinance,
  onChanged,
  focusEventId = null,
  openOnLoad = false,
}: {
  visibleEvents: readonly FinancialEvent[];
  events: readonly FinancialEvent[];
  projectFinance: ProjectFinancialService;
  onChanged: () => void;
  focusEventId?: string | null;
  openOnLoad?: boolean;
}) {
  /* U-001 (دورة التدقيق النهائي): طريقة عملية للوصول للأحداث الأقدم — الافتراضي
   * الأحدث الثلاثة (كثافة §10)، وزر واحد يعرض السجل كاملًا بنفس صفوفه وتصحيحاته.
   * التركيز القادم من «السجل» (?event=) يفتح الكل ويُبرز صف المصدر. */
  const [showAll, setShowAll] = useState(false);
  const [layerOpen, setLayerOpen] = useState(false);
  useEffect(() => {
    if (focusEventId) {
      setShowAll(true);
      setLayerOpen(true);
    }
  }, [focusEventId]);
  /* S1-09: ?layer=events يفتح الطبقة نفسها (معجم عقد ٢٦ §3.1). */
  useEffect(() => {
    if (openOnLoad) setLayerOpen(true);
  }, [openOnLoad]);
  const renderedEvents = showAll ? events : visibleEvents;
  const focusedEventId = focusEventId ?? null;
  const onToggle = (event: React.ToggleEvent<HTMLDetailsElement>) => {
    setLayerOpen(event.currentTarget.open);
  };
  return (
    <details className="micro-finance-layer" open={layerOpen} onToggle={onToggle}>
      <summary className="micro-finance-layer-summary">
        <span>
          <b>السجل والأثر</b>
          <small>
            {showAll
              ? `السجل كاملًا (${eventCountLabel(events.length)})؛ افتح الصف لرؤية الأثر وتصحيحه`
              : "آخر ثلاثة أحداث؛ افتح الصف لرؤية الأثر الكامل وتصحيحه"}
          </small>
        </span>
        <strong>افتح السجل</strong>
      </summary>
      <section className="micro-finance-event-list">
        <div className="micro-finance-event-heading">
          <span className="micro-overline">السجل المحلي · المبالغ (د.أ)</span>
          <h2>{showAll ? "كل الأحداث العامة" : "أحدث الأحداث العامة"}</h2>
          <p>كل تراجع أو تعديل أو حذف موثق يضيف سجلًا؛ الأصل يبقى ظاهرًا ولا يوجد محو صامت.</p>
        </div>
        {renderedEvents.length > 0 ? (
          renderedEvents.map(event => (
            <FinancialEventRow
              key={event.id}
              event={event}
              events={events}
              projectFinance={projectFinance}
              onChanged={onChanged}
              focused={event.id === focusedEventId}
            />
          ))
        ) : (
          <p>لم تسجل حدثًا عامًا بعد. سجّل واقعًا تعرفه، لا تقديرًا لا تثق به.</p>
        )}
        <div className="micro-form-actions" role="group" aria-label="نطاق عرض الأحداث">
          <button
            className="micro-text-action"
            type="button"
            aria-pressed={showAll}
            onClick={() => setShowAll(current => !current)}
          >
            {showAll ? "أعرض الأحدث فقط" : `اعرض كل الأحداث (${events.length})`}
          </button>
        </div>
        {showAll && events.length > visibleEvents.length ? (
          <p className="micro-finance-event-closed">
            السجل الكامل ظاهر الآن؛ التصفح للأسفل بلا حد أقصى، وكل صف قابل للتصحيح الموثق مثل الأحدث.
          </p>
        ) : null}
      </section>
    </details>
  );
}
