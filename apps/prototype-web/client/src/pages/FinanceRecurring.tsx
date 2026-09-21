/**
 * OPS-003 (عقد ٤١ §١٢): سطح «المصاريف المتكررة» — قائمة تذكيراتك بحالتها
 * التشغيلية الصادقة: النشطة والموقوفة في المقدمة، والمسودات بلا فترات،
 * والملغاة/المؤرشفة مطوية غير محذوفة. قراءة + أفعال تشغيلية صريحة (إيقاف/
 * استئناف/أرشفة/استعادة) — لا كتابة مالية من هنا أبدًا؛ التسجيل يحدث من
 * تفصيل الفترة بمراجعة وتأكيد. المتأخر انتباه لا دين.
 */
import { ArrowLeft, BellRing, Plus } from "lucide-react";
import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { withReturnTo } from "@/app/navigationContract";
import { useReturnPath } from "@/app/useReturnNavigation";
import { usePrototypeServices } from "@/app/PrototypeServicesContext";
import type { RecurringExpenseSeriesCardReading } from "@/application/finance/recurringExpenseService";
import { LocalDateValue } from "@/components/presentation/DisplayValue";
import { Button } from "@/components/primitives";

const SERIES_STATUS_LABELS: Record<string, string> = {
  draft: "مسودة — بلا فترات بعد",
  active: "نشط",
  paused: "موقوف مؤقتًا",
  cancelled: "ملغى — المستقبلي فقط",
  archived: "مؤرشف — مخفي تشغيليًا",
};

type PageState =
  | { phase: "loading" }
  | { phase: "ready"; cards: readonly RecurringExpenseSeriesCardReading[] }
  | { phase: "failed"; message: string };

export default function FinanceRecurring() {
  const [, navigate] = useLocation();
  const returnPath = useReturnPath();
  const { recurringExpenses, dataVersion } = usePrototypeServices();
  const [state, setState] = useState<PageState>({ phase: "loading" });
  const [retryCount, setRetryCount] = useState(0);

  useEffect(() => {
    if (!recurringExpenses) return;
    let active = true;
    recurringExpenses.readOverview().then(result => {
      if (!active) return;
      if (!result.ok) {
        setState({ phase: "failed", message: result.message });
        return;
      }
      setState({ phase: "ready", cards: result.value });
    });
    return () => {
      active = false;
    };
  }, [recurringExpenses, dataVersion, retryCount]);

  if (!recurringExpenses || state.phase === "loading") {
    return (
      <div className="micro-route-loading" role="status">
        جارٍ قراءة تذكيراتك المتكررة…
      </div>
    );
  }

  const openDetail = (seriesId: string) =>
    navigate(withReturnTo(`/finance/recurring/${seriesId}`, "/finance/recurring"));

  return (
    <section className="micro-page micro-finance-more-page">
      <button className="micro-back-button" type="button" onClick={() => navigate(returnPath)}>
        رجوع
      </button>
      <div className="micro-page-heading">
        <span className="micro-overline">تذكيرات تحت سيطرتك</span>
        <h1>المصاريف المتكررة</h1>
        <p>كل تذكير فترات وقرارات موثقة — لا يُسجَّل مصروف بغير تأكيدك، والمتأخر انتباه لا دين.</p>
      </div>

      <div className="micro-form-actions">
        <Button
          action="create"
          block
          onClick={() => navigate(withReturnTo("/finance/recurring/new", "/finance/recurring"))}
        >
          <Plus aria-hidden="true" /> تذكير مصروف متكرر جديد
        </Button>
      </div>

      {state.phase === "failed" ? (
        <div className="micro-cancel-panel" role="alert">
          <p>{state.message}</p>
          <Button action="save" onClick={() => setRetryCount(count => count + 1)}>
            إعادة المحاولة
          </Button>
        </div>
      ) : state.cards.length === 0 ? (
        <section className="micro-supplier-list" aria-label="لا تذكيرات بعد">
          <div className="micro-decision-card">
            <BellRing aria-hidden="true" />
            <div>
              <span>لا تذكيرات متكررة بعد</span>
              <strong>ابدأ بواحد — مسودة ثم تفعيل صريح</strong>
              <p>لن يُسجَّل أي مبلغ تلقائيًا؛ التذكير يذكّرك وأنت تقرر: سجّل أو خطِّ أو أجّل.</p>
            </div>
          </div>
        </section>
      ) : (
        <RecurringCards state={state} openDetail={openDetail} />
      )}

      <div className="micro-offline-truth" role="note">
        هذه الصفحة تذكير وتنظيم — التسجيل المالي يحدث فقط من مراجعة الفترة وتأكيدها الصريح.
      </div>
    </section>
  );
}

function RecurringCards({
  state,
  openDetail,
}: {
  state: { phase: "ready"; cards: readonly RecurringExpenseSeriesCardReading[] };
  openDetail: (seriesId: string) => void;
}) {
  const operational = state.cards.filter(
    card =>
      card.series.status === "active" || card.series.status === "paused" || card.series.status === "draft",
  );
  const closed = state.cards.filter(
    card => card.series.status === "cancelled" || card.series.status === "archived",
  );

  return (
    <>
      <section className="micro-supplier-list" aria-label="تذكيراتك العاملة">
        <div className="micro-finance-event-heading">
          <span className="micro-overline">عاملة الآن</span>
        </div>
        {operational.length === 0 ? <p>لا تذكيرات عاملة — فعّل مسودة أو أنشئ تذكيرًا جديدًا.</p> : null}
        {operational.map(card => (
          <article key={card.series.id}>
            <div className="micro-supplier-balance">
              <div>
                <strong dir="auto">{card.series.title}</strong>
                <small>{SERIES_STATUS_LABELS[card.series.status] ?? card.series.status}</small>
                {card.series.status === "paused" ? (
                  <small>الاستئناف نشاط مستقبلي — لا تُستكمل فترات التوقيف بأثر رجعي.</small>
                ) : null}
              </div>
              <div>
                <small>
                  {card.nextDueOn ? (
                    <>
                      أقرب موعد تذكير: <LocalDateValue value={card.nextDueOn} />
                    </>
                  ) : card.series.status === "draft" ? (
                    "المسودة بلا فترات حتى التفعيل"
                  ) : (
                    "لا فترات مفتوحة"
                  )}
                  {" · عولج "}
                  {card.handledCount}
                  {" من "}
                  {card.openCount + card.handledCount}
                </small>
                <Button action="secondary" onClick={() => openDetail(card.series.id)}>
                  افتح التذكير <ArrowLeft aria-hidden="true" />
                </Button>
              </div>
            </div>
          </article>
        ))}
      </section>

      {closed.length > 0 ? (
        <details className="micro-decision-layer">
          <summary className="micro-decision-layer-summary">
            <span>
              <b>ملغاة ومؤرشفة ({closed.length})</b>
              <small>محفوظة بقراراتها — غير محذوفة، والاستعادة تعيدها</small>
            </span>
            <strong>اطوِ أو افتح</strong>
          </summary>
          <section className="micro-supplier-list" aria-label="ملغاة ومؤرشفة">
            {closed.map(card => (
              <article key={card.series.id}>
                <div className="micro-supplier-balance">
                  <div>
                    <strong dir="auto">{card.series.title}</strong>
                    <small>{SERIES_STATUS_LABELS[card.series.status] ?? card.series.status}</small>
                    {card.series.cancelReason ? (
                      <small dir="auto">سبب الإلغاء: {card.series.cancelReason}</small>
                    ) : null}
                  </div>
                  <div>
                    <Button action="secondary" onClick={() => openDetail(card.series.id)}>
                      افتح التذكير <ArrowLeft aria-hidden="true" />
                    </Button>
                  </div>
                </div>
              </article>
            ))}
          </section>
        </details>
      ) : null}
    </>
  );
}
