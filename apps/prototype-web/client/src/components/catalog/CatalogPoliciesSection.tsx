/**
 * المجموعة ١١ (المرحلة 11-A — تفكيك الكتالوج): فترة القراءة وسياسة التوزيع وإيقافها الموثق — مقطع عرض مستخرج
 * من صفحة Catalog.tsx حرفيًا؛ الصفحة تبقى الموزّع الوحيد (تملك الحالة
 * والمعالجات وحارس التغييرات غير المحفوظة) وتمرّر كل شيء خصائصِ أدناه.
 * لا منطق ماليًا هنا ولا تخزين ولا مسارات — عرض فقط بنفس السلوك.
 */
import { type Dispatch, type SetStateAction } from "react";
import { Check } from "lucide-react";
import { EnglishNumberInput } from "@/components/forms/EnglishNumberInput";
import {
  catalogPerUnitRateLabel,
  dimensionLabel,
  catalogPerUnitRoundingNote,
  parseCatalogJodMinor,
  parseCatalogPercentageBps,
  quantityLabel,
  type CatalogPerUnitPreview,
} from "@/presentation/catalogPresentation";
import type { CatalogItem, MeasurementUnit } from "@micro-domain/catalog/index.js";
import type { RecurringWorkPolicyInput } from "@/application/recurring-work/recurringWorkService";

export type CatalogPoliciesSectionProps = {
  periodFrom: string;
  setPeriodFrom: Dispatch<SetStateAction<string>>;
  periodTo: string;
  setPeriodTo: Dispatch<SetStateAction<string>>;
  policyKind: RecurringWorkPolicyInput["kind"];
  setPolicyKind: Dispatch<SetStateAction<RecurringWorkPolicyInput["kind"]>>;
  policyAmount: number | null;
  setPolicyAmount: Dispatch<SetStateAction<number | null>>;
  policyAmountValid: boolean;
  setPolicyAmountValid: Dispatch<SetStateAction<boolean>>;
  policyRate: number | null;
  setPolicyRate: Dispatch<SetStateAction<number | null>>;
  policyRateValid: boolean;
  setPolicyRateValid: Dispatch<SetStateAction<boolean>>;
  policyPercentage: number | null;
  setPolicyPercentage: Dispatch<SetStateAction<number | null>>;
  policyPercentageValid: boolean;
  setPolicyPercentageValid: Dispatch<SetStateAction<boolean>>;
  policyUnitId: string;
  setPolicyUnitId: Dispatch<SetStateAction<string>>;
  policySource: string;
  setPolicySource: Dispatch<SetStateAction<string>>;
  policyReason: string;
  setPolicyReason: Dispatch<SetStateAction<string>>;
  policyNote: string;
  setPolicyNote: Dispatch<SetStateAction<string>>;
  policyPeriodFrom: string;
  setPolicyPeriodFrom: Dispatch<SetStateAction<string>>;
  policyPeriodTo: string;
  setPolicyPeriodTo: Dispatch<SetStateAction<string>>;
  selectedItemId: string;
  setSelectedItemId: Dispatch<SetStateAction<string>>;
  selectedItem: CatalogItem | null;
  selectedItemUnit: MeasurementUnit | null;
  perUnitPreview: CatalogPerUnitPreview | null;
  items: readonly CatalogItem[];
  activeUnits: readonly MeasurementUnit[];
  saving: boolean;
  savePolicy: () => Promise<void>;
  resetTemplateForm: () => void;
};

export function CatalogPoliciesSection({
  periodFrom,
  setPeriodFrom,
  periodTo,
  setPeriodTo,
  policyKind,
  setPolicyKind,
  policyAmount,
  setPolicyAmount,
  policyAmountValid,
  setPolicyAmountValid,
  policyRate,
  setPolicyRate,
  policyRateValid,
  setPolicyRateValid,
  policyPercentage,
  setPolicyPercentage,
  policyPercentageValid,
  setPolicyPercentageValid,
  policyUnitId,
  setPolicyUnitId,
  policySource,
  setPolicySource,
  policyReason,
  setPolicyReason,
  policyNote,
  setPolicyNote,
  policyPeriodFrom,
  setPolicyPeriodFrom,
  policyPeriodTo,
  setPolicyPeriodTo,
  selectedItemId,
  setSelectedItemId,
  selectedItem,
  selectedItemUnit,
  perUnitPreview,
  items,
  activeUnits,
  saving,
  savePolicy,
  resetTemplateForm,
}: CatalogPoliciesSectionProps) {
  return (
    <details className="micro-decision-layer">
      <summary className="micro-decision-layer-summary">
        <span>
          <b>فترة القراءة والسياسة</b>
          <small>قراءة مشتقة وسياسة توزيع معلنة عند الطلب.</small>
        </span>
        <strong>افتح التفاصيل</strong>
      </summary>
      <section className="micro-form-card">
        <div className="micro-page-heading">
          <span className="micro-overline">4 · فترة القراءة والسياسة</span>
          <h2>اقرأ قبل أن تقرر</h2>
          <p>
            حدد فترة معلنة، ثم اعرض الهامش المباشر المسجل. أي توزيع اختياري يحتاج سياسة مؤرخة ومصدرًا وسببًا
            واضحًا.
          </p>
        </div>
        <div className="micro-form-grid">
          <label className="micro-field">
            <span>من</span>
            <input type="date" value={periodFrom} onChange={event => setPeriodFrom(event.target.value)} />
          </label>
          <label className="micro-field">
            <span>إلى</span>
            <input type="date" value={periodTo} onChange={event => setPeriodTo(event.target.value)} />
          </label>
        </div>
        <p className="micro-muted-copy">
          الهامش المباشر هو السعر المحتسب عند التسليم للطلبات المسلّمة النهائية ناقص التكلفة المباشرة المحفوظة
          في نسخة التكلفة. الوقت والهدر وتكلفة البيع قراءات منفصلة، وليست أجرًا أو مصروفًا أو خصمًا تلقائيًا.
        </p>
        <div className="micro-subsection">
          <div className="micro-subsection-heading">
            <div>
              <span className="micro-overline">سياسة اختيارية</span>
              <h3>أضف توزيعًا واضحًا</h3>
            </div>
            <p>
              لا تُنشئ السياسة قيدًا ماليًا ولا تعيد كتابة الماضي؛ وتبقى قابلة للمراجعة عبر تاريخها ومصدرها.
            </p>
          </div>
          <label className="micro-field">
            <span>مرجع العمل</span>
            <select
              value={selectedItemId}
              onChange={event => {
                setSelectedItemId(event.target.value);
                resetTemplateForm();
              }}
            >
              <option value="">اختر مرجعًا</option>
              {items
                .filter(item => item.active)
                .map(item => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
            </select>
          </label>
          {selectedItem ? (
            <>
              <div className="micro-form-grid">
                <label className="micro-field">
                  <span>بداية السياسة</span>
                  <input
                    type="date"
                    value={policyPeriodFrom}
                    onChange={event => setPolicyPeriodFrom(event.target.value)}
                  />
                </label>
                <label className="micro-field">
                  <span>نهاية السياسة</span>
                  <input
                    type="date"
                    value={policyPeriodTo}
                    onChange={event => setPolicyPeriodTo(event.target.value)}
                  />
                </label>
                <label className="micro-field">
                  <span>أساس التوزيع</span>
                  <select
                    value={policyKind}
                    onChange={event => setPolicyKind(event.target.value as RecurringWorkPolicyInput["kind"])}
                  >
                    <option value="manual_amount">مبلغ يدوي للفترة</option>
                    <option value="per_output_unit">معدل لكل 1.000 وحدة كاملة</option>
                    <option value="actual_time">معدل لكل دقيقة فعلية</option>
                    <option value="completed_revenue_percentage">نسبة من الإيراد المكتمل</option>
                  </select>
                </label>
                {policyKind === "manual_amount" ? (
                  <label className="micro-field">
                    <span>
                      المبلغ <small>د.أ</small>
                    </span>
                    <EnglishNumberInput
                      value={policyAmount}
                      kind="money"
                      onNumericChange={setPolicyAmount}
                      onTextValidityChange={setPolicyAmountValid}
                      onEmptyChange={() => setPolicyAmount(null)}
                      allowEmpty
                      aria-label="مبلغ سياسة التوزيع"
                    />
                  </label>
                ) : null}
                {policyKind === "per_output_unit" || policyKind === "actual_time" ? (
                  <label className="micro-field">
                    <span>
                      {policyKind === "per_output_unit"
                        ? catalogPerUnitRateLabel(
                            selectedItemUnit?.nameAr ?? selectedItem?.unitLabel ?? "وحدة كاملة",
                          )
                        : "المعدل لكل دقيقة فعلية · د.أ"}
                    </span>
                    <EnglishNumberInput
                      value={policyRate}
                      kind="money"
                      onNumericChange={setPolicyRate}
                      onTextValidityChange={setPolicyRateValid}
                      onEmptyChange={() => setPolicyRate(null)}
                      allowEmpty
                      aria-label="معدل سياسة التوزيع"
                    />
                  </label>
                ) : null}
                {policyKind === "per_output_unit" ? (
                  <label className="micro-field">
                    <span>وحدة الناتج</span>
                    <select value={policyUnitId} onChange={event => setPolicyUnitId(event.target.value)}>
                      <option value="">اختر وحدة المرجع</option>
                      {activeUnits.map(unit => (
                        <option key={unit.id} value={unit.id}>
                          {unit.nameAr} · {dimensionLabel(unit.dimension)}
                        </option>
                      ))}
                    </select>
                  </label>
                ) : null}
                {policyKind === "completed_revenue_percentage" ? (
                  <label className="micro-field">
                    <span>
                      النسبة <small>%</small>
                    </span>
                    <EnglishNumberInput
                      value={policyPercentage}
                      kind="percentage"
                      onNumericChange={setPolicyPercentage}
                      onTextValidityChange={setPolicyPercentageValid}
                      onEmptyChange={() => setPolicyPercentage(null)}
                      allowEmpty
                      aria-label="نسبة سياسة التوزيع"
                    />
                  </label>
                ) : null}
              </div>
              {policyKind === "per_output_unit" ? (
                <div className="micro-inline-disclosure">
                  <p>{perUnitPreview?.text ?? "ستظهر معاينة التوزيع بعد وجود كمية نهائية ومعدل صالح."}</p>
                  <p>{catalogPerUnitRoundingNote}</p>
                  {perUnitPreview?.warning ? (
                    <p className="micro-warning-copy">{perUnitPreview.warning}</p>
                  ) : null}
                </div>
              ) : null}
              <div className="micro-form-grid">
                <label className="micro-field">
                  <span>المصدر</span>
                  <input
                    value={policySource}
                    onChange={event => setPolicySource(event.target.value)}
                    placeholder="مثال: فاتورة كهرباء شهرية"
                  />
                </label>
                <label className="micro-field">
                  <span>السبب</span>
                  <input
                    value={policyReason}
                    onChange={event => setPolicyReason(event.target.value)}
                    placeholder="مثال: توزيع تكلفة تشغيل مشتركة"
                  />
                </label>
                <label className="micro-field micro-field-wide">
                  <span>ملاحظة القرار</span>
                  <textarea
                    value={policyNote}
                    onChange={event => setPolicyNote(event.target.value)}
                    placeholder="لماذا اخترت هذا الأساس لهذه الفترة؟"
                  />
                </label>
              </div>
              <button
                className="micro-button micro-button-secondary"
                type="button"
                disabled={saving}
                onClick={savePolicy}
              >
                <Check aria-hidden="true" /> {saving ? "جارٍ الحفظ…" : "احفظ السياسة"}
              </button>
            </>
          ) : (
            <p className="micro-empty-copy">اختر مرجع عمل إذا أردت تسجيل سياسة توزيع اختيارية.</p>
          )}
        </div>
      </section>
    </details>
  );
}
