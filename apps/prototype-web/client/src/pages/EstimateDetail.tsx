/**
 * المجموعة ٣ (Scope B — §8.1): صفحة التقدير المحفوظ — قراءة وفعل، لا محرر ثانٍ.
 * تُظهر المدخلات والافتراضات والنتيجة والمجهول والتاريخ، وت kwalify صراحة أن
 * التقدير أداة تفكير بلا أي أثر مالي. التعديل يذهب للحاسبة (?estimate=)،
 * وبدء المسودة يمر بجسر U-004 المعتمد — الرجوع يعود لهذه الصفحة.
 */
import { ArrowRight, BookOpen, Calculator, ClipboardPlus, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { useLocation, useParams } from "wouter";
import { useReturnPath } from "@/app/useReturnNavigation";
import { withFrom } from "@/app/navigationContract";
import { usePrototypeServices } from "@/app/PrototypeServicesContext";
import { MoneyValue } from "@/components/presentation/DisplayValue";
import { formatLocalDate, formatMoneyWithUnit } from "@/presentation/formatters";
import type { CostEstimate } from "@/storage/local/types";

type DetailState =
  | { phase: "loading" }
  | { phase: "not_found" }
  | { phase: "error" }
  | { phase: "ready"; estimate: CostEstimate };

const knowledgeLabel: Record<string, string> = {
  known: "معروفة",
  estimated: "تقديرية",
  partial: "جزئية",
  incomplete: "ناقصة",
  stale: "تحتاج مراجعة",
  variable: "متغيرة",
};

const canShowProtectionPrice = (estimate: CostEstimate) =>
  !["incomplete", "partial"].includes(estimate.knowledgeState);

export default function EstimateDetail() {
  const params = useParams<{ id: string }>();
  const [, navigate] = useLocation();
  /* المجموعة ٣ (§8.1): رجوع آمن للمصدر (?from) أو أدواتي بديلًا قانونيًا. */
  const returnPath = useReturnPath();
  const {
  dataVersion, costEstimates, notifyDataChanged } = usePrototypeServices();
  const [state, setState] = useState<DetailState>({ phase: "loading" });
  const [message, setMessage] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    let active = true;
    void costEstimates.get(params.id).then(result => {
      if (!active) return;
      if (!result.ok) {
        setState({ phase: "error" });
        return;
      }
      setState(result.value ? { phase: "ready", estimate: result.value } : { phase: "not_found" });
    });
    return () => {
      active = false;
    };
  }, [costEstimates, params.id, dataVersion]);

  async function deleteEstimate() {
    if (state.phase !== "ready") return;
    setDeleting(true);
    const result = await costEstimates.remove(state.estimate.id);
    setDeleting(false);
    if (!result.ok) {
      setMessage(result.message);
      return;
    }
    notifyDataChanged();
    navigate("/tools");
  }

  if (state.phase === "loading")
    return (
      <div className="micro-route-loading" role="status">
        جارٍ فتح التقدير…
      </div>
    );
  if (state.phase === "not_found")
    return (
      <section className="micro-page micro-not-found">
        <span className="micro-overline">تقدير محفوظ</span>
        <h1>لم نجد هذا التقدير</h1>
        <p>قد يكون حُذف محليًا — حذف التقدير حر وبلا أثر مالي، فلا يتغير أي رصيد.</p>
        <button
          className="micro-button micro-button-primary"
          type="button"
          onClick={() => navigate(returnPath)}
        >
          رجوع
        </button>
      </section>
    );
  if (state.phase === "error")
    return (
      <section className="micro-page micro-not-found">
        <h1>تعذر فتح التقدير</h1>
        <p>لم يتم تغيير بياناتك. أعد المحاولة من أدواتي.</p>
        <button
          className="micro-button micro-button-primary"
          type="button"
          onClick={() => navigate("/tools")}
        >
          رجوع
        </button>
      </section>
    );

  const estimate = state.estimate;
  const detailHref = `/tools/estimate/${encodeURIComponent(estimate.id)}`;
  const extras = [
    { label: "تغليف", value: estimate.packagingMinor },
    { label: "توصيل", value: estimate.deliveryMinor },
    { label: "هدر متوقع", value: estimate.wasteMinor },
    { label: "هامش حماية السعر", value: estimate.safetyBufferMinor },
  ].filter(extra => extra.value > 0);

  return (
    <section className="micro-page micro-tools-page">
      <button className="micro-back-button" type="button" onClick={() => navigate(returnPath)}>
        <ArrowRight aria-hidden="true" /> رجوع
      </button>
      <div className="micro-page-heading">
        <span className="micro-overline">تقدير محفوظ</span>
        <h1>{estimate.title}</h1>
        <p>
          حُفظ في <bdi dir="ltr">{formatLocalDate(estimate.createdAt.slice(0, 10))}</bdi> · حالة المعرفة:{" "}
          {knowledgeLabel[estimate.knowledgeState] ?? estimate.knowledgeState}
        </p>
      </div>

      <section className="micro-decision-card" aria-label="نتيجة التقدير">
        <span>سعر الحماية المقترح للقطعة</span>
        <strong>
          {canShowProtectionPrice(estimate) ? (
            <MoneyValue minor={estimate.priceFloorMinor} />
          ) : (
            "غير متوفر بعد"
          )}
        </strong>
        <p>
          تكلفة القطعة المتوقعة: <MoneyValue minor={estimate.unitCostMinor} /> · الإجمالي المتوقع:{" "}
          <MoneyValue minor={estimate.plannedCostMinor} /> · عدد القطع الناتجة: {estimate.quantity}
        </p>
        <p className="micro-cost-disclaimer">
          هذا التقدير أداة تفكير — لا حدث مالي ولا مخزون ولا التزام مرتبط به.
        </p>
      </section>

      <section className="micro-form-card" aria-label="مدخلات التقدير">
        <div className="micro-section-title">
          <Calculator aria-hidden="true" />
          <div>
            <span className="micro-overline">ما حُسب منه</span>
            <h2>المدخلات والافتراضات</h2>
          </div>
        </div>
        {estimate.materialItems.length ? (
          <div className="micro-list micro-list-compact">
            {estimate.materialItems.map(item => (
              <article className="micro-list-item" key={`${item.name}-${item.unit}`}>
                <div>
                  <strong>{item.name}</strong>
                  <p>
                    {item.quantity} {item.unit} · سعر الوحدة{" "}
                    <MoneyValue minor={item.unitPriceMinor} className="micro-inline-number" />
                  </p>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <p className="micro-home-quiet">ما في مواد مسجلة في هذا التقدير.</p>
        )}
        <p className="micro-muted-copy">
          {estimate.time && estimate.time.minutes != null && estimate.time.hourlyRateMinor != null
            ? `وقت العمل: ${estimate.time.minutes} دقيقة بـ ${formatMoneyWithUnit(estimate.time.hourlyRateMinor)} للساعة`
            : "وقت العمل: غير محدد بعد — النتيجة بلا أجر وقتك."}
        </p>
        {extras.length ? (
          <p className="micro-muted-copy">
            {extras.map(extra => `${extra.label}: ${formatMoneyWithUnit(extra.value)}`).join(" · ")}
          </p>
        ) : (
          <p className="micro-muted-copy">لا بنود إضافية محفوظة في هذا التقدير.</p>
        )}
        {estimate.note ? <p className="micro-muted-copy">{estimate.note}</p> : null}
      </section>

      {message ? (
        <p className="micro-field-error" role="status">
          {message}
        </p>
      ) : null}

      <section className="micro-form-card" aria-label="أفعال التقدير">
        <div className="micro-form-actions micro-contextual-actions">
          <button
            className="micro-button micro-button-primary"
            type="button"
            onClick={() =>
              navigate(
                withFrom(
                  `/orders/draft/new?intent=planned_design&estimate=${encodeURIComponent(estimate.id)}`,
                  detailHref,
                ),
              )
            }
          >
            <ClipboardPlus aria-hidden="true" /> ابدأ مسودة من هذا التقدير
          </button>
          <button
            className="micro-button micro-button-secondary"
            type="button"
            onClick={() => navigate(withFrom(`/tools/calculator?estimate=${encodeURIComponent(estimate.id)}`, detailHref))}
          >
            <BookOpen aria-hidden="true" /> عدّل التقدير
          </button>
        </div>
        <p className="micro-home-quiet">
          بدء المسودة ينسخ اقتراحات قابلة للتعديل — التقدير نفسه لا يتغير ولا يُنشأ شيء مالي.
        </p>
      </section>

      <div className="micro-draft-delete-zone">
        {confirmDelete ? (
          <>
            <p>
              حذف التقدير يزيله من هذا الجهاز — أداة تفكير بلا أثر مالي، فلا يتغير أي رصيد ولا
              سجل. لا يمكن التراجع بعد الحذف.
            </p>
            <div className="micro-form-actions">
              <button
                className="micro-button micro-button-secondary"
                type="button"
                disabled={deleting}
                onClick={() => void deleteEstimate()}
              >
                <Trash2 aria-hidden="true" /> {deleting ? "جارٍ الحذف…" : "احذف التقدير نهائيًا"}
              </button>
              <button
                className="micro-button micro-button-quiet"
                type="button"
                onClick={() => setConfirmDelete(false)}
              >
                تراجع
              </button>
            </div>
          </>
        ) : (
          <button
            className="micro-button micro-button-quiet"
            type="button"
            onClick={() => setConfirmDelete(true)}
          >
            <Trash2 aria-hidden="true" /> احذف التقدير
          </button>
        )}
      </div>
    </section>
  );
}
