/**
 * المجموعة ١١ (المرحلة 11-A — تفكيك الكتالوج): القياس والتحويلات المباشرة الصريحة — مقطع عرض مستخرج
 * من صفحة Catalog.tsx حرفيًا؛ الصفحة تبقى الموزّع الوحيد (تملك الحالة
 * والمعالجات وحارس التغييرات غير المحفوظة) وتمرّر كل شيء خصائصِ أدناه.
 * لا منطق ماليًا هنا ولا تخزين ولا مسارات — عرض فقط بنفس السلوك.
 */
import { type Dispatch, type SetStateAction } from "react";
import { ArchiveX, GitCompareArrows, Plus } from "lucide-react";
import { EnglishNumberInput } from "@/components/forms/EnglishNumberInput";
import {
  buildCatalogConversionPreview,
  catalogConversionDirectionText,
  catalogConversionExactnessWarning,
  catalogDimensionOptions,
  dimensionLabel,
  parseCatalogPositiveSafeInteger,
  quantityLabel,
  type CatalogConversionPreview,
} from "@/presentation/catalogPresentation";
import { formatMoneyMinor } from "@/presentation/formatters";
import type { DirectConversion, MeasurementUnit, UnitDimension } from "@micro-domain/catalog/index.js";

export type CatalogUnitsSectionProps = {
  unitName: string;
  setUnitName: Dispatch<SetStateAction<string>>;
  unitDimension: UnitDimension;
  setUnitDimension: Dispatch<SetStateAction<UnitDimension>>;
  conversionFrom: string;
  setConversionFrom: Dispatch<SetStateAction<string>>;
  conversionTo: string;
  setConversionTo: Dispatch<SetStateAction<string>>;
  conversionNumerator: number | null;
  setConversionNumerator: Dispatch<SetStateAction<number | null>>;
  conversionNumeratorValid: boolean;
  setConversionNumeratorValid: Dispatch<SetStateAction<boolean>>;
  conversionDenominator: number | null;
  setConversionDenominator: Dispatch<SetStateAction<number | null>>;
  conversionDenominatorValid: boolean;
  setConversionDenominatorValid: Dispatch<SetStateAction<boolean>>;
  conversionNote: string;
  setConversionNote: Dispatch<SetStateAction<string>>;
  units: readonly MeasurementUnit[];
  conversions: readonly DirectConversion[];
  activeUnits: readonly MeasurementUnit[];
  conversionFromUnit: MeasurementUnit | null;
  conversionToUnit: MeasurementUnit | null;
  conversionPreview: CatalogConversionPreview | null;
  createUnit: () => Promise<void>;
  deactivateUnit: (id: string) => Promise<void>;
  createConversion: () => Promise<boolean>;
  deactivateConversion: (id: string) => Promise<void>;
};

export function CatalogUnitsSection({
  unitName,
  setUnitName,
  unitDimension,
  setUnitDimension,
  conversionFrom,
  setConversionFrom,
  conversionTo,
  setConversionTo,
  conversionNumerator,
  setConversionNumerator,
  conversionNumeratorValid,
  setConversionNumeratorValid,
  conversionDenominator,
  setConversionDenominator,
  conversionDenominatorValid,
  setConversionDenominatorValid,
  conversionNote,
  setConversionNote,
  units,
  conversions,
  activeUnits,
  conversionFromUnit,
  conversionToUnit,
  conversionPreview,
  createUnit,
  deactivateUnit,
  createConversion,
  deactivateConversion,
}: CatalogUnitsSectionProps) {
  return (
    <details className="micro-decision-layer">
      <summary className="micro-decision-layer-summary">
        <span>
          <b>القياس والتحويلات</b>
          <small>تفاصيل اختيارية للكمية؛ لا تحتاجها لبدء المرجع.</small>
        </span>
        <strong>افتح التفاصيل</strong>
      </summary>
      <section className="micro-form-card">
        <p className="micro-muted-copy">
          أضف ما يساعدك على تذكر الكمية. لن ننشئ مخزونًا، ولن نحول الوزن إلى حجم تلقائيًا.
        </p>
        <div className="micro-subsection-stack">
          <div className="micro-subsection">
            <div className="micro-subsection-heading">
              <div>
                <span className="micro-overline">الوحدات</span>
                <h3>وحدات ذات بُعد واضح</h3>
              </div>
              <p>الوحدة مجرد معنى للكمية؛ لا يلزم ربطها بأي مرجع.</p>
            </div>
            <div className="micro-form-grid">
              <label className="micro-field">
                <span>اسم عملي</span>
                <input
                  value={unitName}
                  onChange={event => setUnitName(event.target.value)}
                  placeholder="مثال: كيلوغرام"
                />
              </label>
              <label className="micro-field">
                <span>البعد</span>
                <select
                  value={unitDimension}
                  onChange={event => setUnitDimension(event.target.value as UnitDimension)}
                >
                  {catalogDimensionOptions.map(dimension => (
                    <option key={dimension.value} value={dimension.value}>
                      {dimension.label}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <button
              className="micro-button micro-button-secondary"
              type="button"
              disabled={!unitName.trim()}
              onClick={createUnit}
            >
              <Plus aria-hidden="true" /> أضف وحدة
            </button>
            <div className="micro-chip-list">
              {units.length ? (
                units.map(unit => (
                  <span className={`micro-chip ${unit.active ? "" : "micro-chip-muted"}`} key={unit.id}>
                    {unit.nameAr} · {dimensionLabel(unit.dimension)}
                    {unit.active ? (
                      <button
                        type="button"
                        aria-label={`إيقاف ${unit.nameAr}`}
                        onClick={() => deactivateUnit(unit.id)}
                      >
                        <ArchiveX aria-hidden="true" />
                      </button>
                    ) : (
                      <small>موقوفة</small>
                    )}
                  </span>
                ))
              ) : (
                <p className="micro-empty-copy">لا توجد وحدات منظمة بعد. هذا طبيعي ويمكنك تركها فارغة.</p>
              )}
            </div>
          </div>
          <div className="micro-subsection">
            <div className="micro-subsection-heading">
              <div>
                <span className="micro-overline">تحويل مباشر</span>
                <h3>أضف تحويلًا واضحًا</h3>
              </div>
              <p>
                المعادلة: <bdi dir="ltr">كمية المصدر × البسط ÷ المقام = الناتج بوحدة الوجهة</bdi>، ولا نقرب
                إذا تعذر تمثيله.
              </p>
            </div>
            <div className="micro-form-grid">
              <label className="micro-field">
                <span>المصدر</span>
                <select value={conversionFrom} onChange={event => setConversionFrom(event.target.value)}>
                  <option value="">اختر وحدة المصدر</option>
                  {activeUnits.map(unit => (
                    <option key={unit.id} value={unit.id}>
                      {unit.nameAr} · {dimensionLabel(unit.dimension)}
                    </option>
                  ))}
                </select>
              </label>
              <label className="micro-field">
                <span>الوجهة</span>
                <select value={conversionTo} onChange={event => setConversionTo(event.target.value)}>
                  <option value="">اختر وحدة الوجهة</option>
                  {activeUnits.map(unit => (
                    <option key={unit.id} value={unit.id}>
                      {unit.nameAr} · {dimensionLabel(unit.dimension)}
                    </option>
                  ))}
                </select>
              </label>
              <label className="micro-field">
                <span>
                  البسط <small dir="rtl">موجب</small>
                </span>
                <EnglishNumberInput
                  value={conversionNumerator}
                  kind="integer"
                  onNumericChange={setConversionNumerator}
                  onTextValidityChange={setConversionNumeratorValid}
                  onEmptyChange={() => setConversionNumerator(null)}
                  allowEmpty
                  aria-label="بسط التحويل"
                />
              </label>
              <label className="micro-field">
                <span>
                  المقام <small dir="rtl">موجب</small>
                </span>
                <EnglishNumberInput
                  value={conversionDenominator}
                  kind="integer"
                  onNumericChange={setConversionDenominator}
                  onTextValidityChange={setConversionDenominatorValid}
                  onEmptyChange={() => setConversionDenominator(null)}
                  allowEmpty
                  aria-label="مقام التحويل"
                />
              </label>
              <label className="micro-field micro-field-wide">
                <span>لماذا هذا التحويل؟</span>
                <input
                  value={conversionNote}
                  onChange={event => setConversionNote(event.target.value)}
                  placeholder="مثال: 1 كيلوغرام = 1000 غرام"
                />
              </label>
            </div>
            {conversionPreview ? (
              <div
                className={`micro-conversion-preview ${conversionPreview.exact ? "" : "micro-conversion-preview-warning"}`}
                role="status"
              >
                <strong>
                  {conversionPreview.exact
                    ? catalogConversionDirectionText(
                        conversionFromUnit?.nameAr ?? "وحدة المصدر",
                        conversionToUnit?.nameAr ?? "وحدة الوجهة",
                      )
                    : "المعاينة غير دقيقة"}
                </strong>
                <p>
                  {conversionPreview.exact && conversionFromUnit && conversionToUnit ? (
                    <span
                      className="micro-conversion-equation"
                      dir="ltr"
                      aria-label={conversionPreview.text ?? undefined}
                    >
                      <bdi>{quantityLabel(conversionPreview.sourceQuantityMilli)}</bdi>
                      <span className="micro-conversion-unit" dir="rtl">
                        {conversionFromUnit.nameAr}
                      </span>
                      <bdi>
                        × {conversionNumerator} ÷ {conversionDenominator} =
                      </bdi>
                      <bdi>{quantityLabel(conversionPreview.targetQuantityMilli ?? 0)}</bdi>
                      <span className="micro-conversion-unit" dir="rtl">
                        {conversionToUnit.nameAr}
                      </span>
                    </span>
                  ) : (
                    <span>{conversionPreview.warning}</span>
                  )}
                </p>
              </div>
            ) : null}
            <button
              className="micro-button micro-button-secondary"
              type="button"
              disabled={
                !conversionFrom ||
                !conversionTo ||
                !conversionNumerator ||
                !conversionDenominator ||
                !conversionNote.trim()
              }
              onClick={createConversion}
            >
              <GitCompareArrows aria-hidden="true" /> أضف تحويلًا صريحًا
            </button>
            <div className="micro-list micro-list-compact">
              {conversions.length ? (
                conversions.map(conversion => {
                  const from = units.find(unit => unit.id === conversion.fromUnitId);
                  const to = units.find(unit => unit.id === conversion.toUnitId);
                  return (
                    <div className="micro-list-item" key={conversion.id}>
                      <div>
                        <strong>
                          {catalogConversionDirectionText(
                            from?.nameAr ?? "وحدة قديمة",
                            to?.nameAr ?? "وحدة قديمة",
                          )}
                        </strong>
                        <p dir="ltr">
                          × {conversion.numerator} ÷ {conversion.denominator} · {conversion.note}
                          {conversion.active ? "" : " · موقوف"}
                        </p>
                      </div>
                      {conversion.active ? (
                        <button
                          className="micro-button micro-button-secondary"
                          type="button"
                          onClick={() => deactivateConversion(conversion.id)}
                        >
                          <ArchiveX aria-hidden="true" /> إيقاف
                        </button>
                      ) : null}
                    </div>
                  );
                })
              ) : (
                <p className="micro-empty-copy">لا توجد تحويلات. لن نحتاج إليها ما دامت الوحدات متطابقة.</p>
              )}
            </div>
          </div>
        </div>
      </section>
    </details>
  );
}
