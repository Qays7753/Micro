/* و٩/§10: طبقة «التغطية والتعادل» وحدة مستقلة — تُفتح فتُقرأ، وتُغلب القيمة على الجملة. */
import { useEffect, useState } from "react";
import { LocalDateValue, MoneyValue, IntegerValue } from "@/components/presentation/DisplayValue";
import type { G5Decision } from "@/application/g5/g5Service";
import type { G5Service } from "@/application/g5/g5Service";
import type { ShortCashDeclaration } from "@micro-domain/g5/index.js";
import {
  formatBreakEvenDisplay,
  formatLocalDate,
  formatMoneyMinor,
  formatQuantityMilli,
  localDateInAmman,
} from "@/presentation/formatters";

export const formatted = (minor: number) => formatMoneyMinor(minor);
export const displayContributionAmount = (value: number, status: G5Decision["period"]["status"]) =>
  status === "invalid" ? "غير متاح" : formatMoneyMinor(value);
export const displayCashAmount = (value: number, status: G5Decision["shortCash"]["status"]) =>
  status === "invalid" ? "غير متاح" : formatMoneyMinor(value);
export const formatSourceDates = (source: string) =>
  source.replace(/\b\d{4}-\d{2}-\d{2}\b/g, date => formatLocalDate(date) ?? date);
export const statusLabel = (status: G5Decision["period"]["status"]) =>
  status === "available"
    ? "متاح"
    : status === "needs_review"
      ? "يحتاج مراجعة"
      : status === "invalid"
        ? "غير متاح"
        : "ناقص";
export const shortStatusLabel = (status: G5Decision["shortCash"]["status"]) =>
  status === "available" ? "متاح" : status === "needs_review" ? "يحتاج مراجعة" : "غير متاح";

function Metric({ label, value, negative = false }: { label: string; value: string; negative?: boolean }) {
  return (
    <div className="micro-g5-metric">
      <span>{label}</span>
      <strong data-negative={negative || undefined}>{value}</strong>
    </div>
  );
}

function G5DecisionPanel({
  decision,
  g5,
  onDeclare,
  onChanged,
}: {
  decision: G5Decision;
  g5: import("@/application/g5/g5Service").G5Service;
  onDeclare: () => void;
  onChanged: () => void;
}) {
  const [error, setError] = useState<string | null>(null);
  const [reversalTarget, setReversalTarget] = useState<ShortCashDeclaration | null>(null);
  const [reversalNote, setReversalNote] = useState("");
  const [reversing, setReversing] = useState(false);
  const activeIds = new Set(
    decision.declarations.filter(entry => entry.kind === "reversal").map(entry => entry.reversalOfId),
  );
  const activeDeclarations = decision.declarations.filter(
    entry => entry.kind === "declaration" && !activeIds.has(entry.id),
  );
  const beginReverse = (entry: ShortCashDeclaration) => {
    setError(null);
    setReversalTarget(entry);
    setReversalNote("");
  };
  const cancelReverse = () => {
    setError(null);
    setReversalTarget(null);
    setReversalNote("");
  };
  const submitReverse = async () => {
    if (!reversalTarget) return;
    const note = reversalNote.trim();
    if (!note) {
      setError("اكتب سبب التصحيح قبل تنفيذ التراجع.");
      return;
    }
    setError(null);
    setReversing(true);
    const result = await g5.reverseDeclaration(reversalTarget.id, note, `reverse:${reversalTarget.id}`);
    setReversing(false);
    if (!result.ok) {
      setError(result.message);
      return;
    }
    cancelReverse();
    onChanged();
  };
  const contribution = decision.period;
  const breakEvenDisplay = formatBreakEvenDisplay(
    contribution.breakEvenUnits,
    contribution.quantityUnitKey,
    contribution.quantityUnitLabel,
  );
  return (
    <section className="micro-section micro-g5-surface" aria-label="تفاصيل القرار المالي للفترة">
      <div className="micro-section-heading">
        <div>
          <span className="micro-overline">
            تفاصيل القرار المالي · <LocalDateValue value={contribution.from} /> →{" "}
            <LocalDateValue value={contribution.to} />
          </span>
          <h2>قراءة الهامش المسجل</h2>
        </div>
      </div>
      <article
        className="micro-g5-card micro-g5-card-secondary"
        data-tone={
          contribution.status === "available"
            ? "accent"
            : contribution.status === "invalid"
              ? "danger"
              : "warning"
        }
      >
        <div className="micro-card-copy">
          <span className="micro-card-eyebrow">الهامش بعد الكلفة المباشرة — قراءة ثانوية</span>
          <h2>
            {contribution.status === "invalid"
              ? "تعادل غير محسوب"
              : contribution.status === "incomplete"
                ? "الهامش ناقص من مصدر مؤثر"
                : statusLabel(contribution.status)}
          </h2>
        </div>
        <div className="micro-g5-metrics">
          <Metric
            label="الإيراد النهائي"
            value={displayContributionAmount(contribution.totalRevenueMinor, contribution.status)}
          />
          <Metric
            label="الكلفة المباشرة للطلبات النهائية"
            value={displayContributionAmount(contribution.totalVariableCostMinor, contribution.status)}
          />
          <Metric
            label="المصاريف الثابتة المسجلة"
            value={displayContributionAmount(contribution.fixedExpenseMinor, contribution.status)}
          />
          <Metric
            label="الهامش الكلي"
            value={displayContributionAmount(contribution.contributionMarginMinor, contribution.status)}
            negative={contribution.contributionMarginMinor < 0}
          />
          <Metric
            label="الهامش لكل وحدة"
            value={
              contribution.contributionMarginPerUnitMinor === null
                ? "غير متاح"
                : formatted(Math.round(contribution.contributionMarginPerUnitMinor))
            }
          />
        </div>
        <div className="micro-g5-break-even">
          <span>كم وحدة تغطي المصاريف الثابتة</span>
          <strong>
            {breakEvenDisplay === null ? (
              "غير متاحة"
            ) : (
              <>
                <bdi dir="ltr" className="micro-inline-number">
                  {breakEvenDisplay.number}
                </bdi>{" "}
                {breakEvenDisplay.scale}
              </>
            )}
          </strong>
          <p>
            {contribution.breakEvenUnits === null ? (
              (contribution.reasons[0] ?? "لا توجد شروط كافية.")
            ) : (
              <>
                التكاليف الثابتة{" "}
                <MoneyValue minor={contribution.fixedExpenseMinor} className="micro-inline-number" /> ÷ هامش
                الوحدة المسجل. المزيج ليس توقعًا للمبيعات.
              </>
            )}
          </p>
          {contribution.mix.length > 0 ? (
            <ul className="micro-g5-mix">
              {contribution.mix.slice(0, 4).map(item => (
                <li key={`${item.itemName}-${item.unitKey ?? "unknown"}`}>
                  {item.itemName}:{" "}
                  <bdi dir="ltr" className="micro-inline-number">
                    {formatQuantityMilli(item.quantityMilli)}
                  </bdi>{" "}
                  {item.unitLabel ?? "وحدة غير موحدة"} · هامش{" "}
                  <MoneyValue minor={item.contributionMarginMinor} className="micro-inline-number" />
                </li>
              ))}
            </ul>
          ) : null}
        </div>
        <G5Reasons
          reasons={contribution.reasons}
          assumptions={contribution.assumptions}
          excluded={contribution.excluded}
          sources={contribution.sources}
          nextAction={contribution.nextAction}
        />
      </article>
      <article className="micro-g5-declarations">
        <div className="micro-section-heading">
          <div>
            <span className="micro-overline">أثر قابل للتصحيح</span>
            <h2>المتوقعات المحلية</h2>
          </div>
          <span className="micro-g5-count">{activeDeclarations.length}</span>
        </div>
        {activeDeclarations.length === 0 ? (
          <p>لا توجد متوقعات مسجلة. لن يفترض النظام مواعيد من تلقاء نفسه.</p>
        ) : (
          <div className="micro-g5-declaration-list">
            {activeDeclarations.map(entry => (
              <div className="micro-g5-declaration" key={entry.id}>
                <div>
                  <strong>
                    {entry.direction === "collection" ? "قبض متوقع" : "دفع متوقع"} · {entry.source}
                  </strong>
                  <small>
                    {entry.dueOn ? <LocalDateValue value={entry.dueOn} /> : "بلا تاريخ"} ·{" "}
                    {entry.knowledge === "known"
                      ? "معروف"
                      : entry.knowledge === "estimated"
                        ? "تقديري"
                        : "يحتاج مراجعة"}{" "}
                    · <MoneyValue minor={entry.amountMinor} className="micro-inline-number" />
                  </small>
                </div>
                <button className="micro-text-action" type="button" onClick={() => beginReverse(entry)}>
                  صحّح بتراجع موثق
                </button>
                {reversalTarget?.id === entry.id ? (
                  <div className="micro-g5-reversal-editor">
                    <label className="micro-field">
                      <span>
                        سبب التصحيح <small>مطلوب قبل التراجع</small>
                      </span>
                      <textarea
                        value={reversalNote}
                        onChange={event => setReversalNote(event.target.value)}
                        placeholder="مثال: أكد العميل موعدًا مختلفًا للتحصيل"
                      />
                    </label>
                    <p className="micro-local-truth">
                      لن يُنفذ التراجع قبل كتابة سبب غير فارغ. سيُحفظ هذا النص في سجل التراجع مع بقاء السجل
                      المتوقع الأصلي محفوظًا.
                    </p>
                    <div className="micro-form-actions">
                      <button
                        className="micro-button micro-button-primary"
                        type="button"
                        disabled={reversing}
                        onClick={() => void submitReverse()}
                      >
                        {reversing ? "جارٍ حفظ التصحيح…" : "تنفيذ التراجع بسبب موثق"}
                      </button>
                      <button
                        className="micro-button micro-button-secondary"
                        type="button"
                        disabled={reversing}
                        onClick={cancelReverse}
                      >
                        إلغاء
                      </button>
                    </div>
                  </div>
                ) : null}
              </div>
            ))}
          </div>
        )}
        {error ? (
          <p className="micro-field-error" role="alert">
            {error}
          </p>
        ) : null}
      </article>
    </section>
  );
}

function G5Reasons({
  reasons,
  assumptions,
  excluded,
  sources,
  nextAction,
}: {
  reasons: readonly string[];
  assumptions: readonly string[];
  excluded: readonly string[];
  sources: readonly string[];
  nextAction: string;
}) {
  return (
    <div className="micro-g5-guidance">
      {reasons.length > 0 ? (
        <div>
          <strong>ما يمنع اكتمال القراءة</strong>
          <ul>
            {reasons.slice(0, 4).map(reason => (
              <li key={reason}>{reason}</li>
            ))}
          </ul>
        </div>
      ) : null}
      {assumptions.length > 0 ? (
        <div>
          <strong>افتراضات معلنة</strong>
          <ul>
            {assumptions.slice(0, 4).map(assumption => (
              <li key={assumption}>{assumption}</li>
            ))}
          </ul>
        </div>
      ) : null}
      {excluded.length > 0 ? (
        <div>
          <strong>استبعادات ظاهرة</strong>
          <ul>
            {excluded.slice(0, 4).map(entry => (
              <li key={entry}>{entry}</li>
            ))}
          </ul>
        </div>
      ) : null}
      {sources.length > 0 ? (
        <p className="micro-g5-sources">
          <strong>المصادر المستخدمة:</strong> {sources.slice(0, 4).map(formatSourceDates).join(" · ")}
        </p>
      ) : null}
      <p className="micro-decision-next">الخطوة التالية: {nextAction}</p>
    </div>
  );
}

export default G5DecisionPanel;
