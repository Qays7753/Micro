/**
 * المجموعة ١١ (المرحلة 11-A — تفكيك الكتالوج): قالب المكونات وبنود التكلفة والناتج — مقطع عرض مستخرج
 * من صفحة Catalog.tsx حرفيًا؛ الصفحة تبقى الموزّع الوحيد (تملك الحالة
 * والمعالجات وحارس التغييرات غير المحفوظة) وتمرّر كل شيء خصائصِ أدناه.
 * لا منطق ماليًا هنا ولا تخزين ولا مسارات — عرض فقط بنفس السلوك.
 */
import { type Dispatch, type SetStateAction } from "react";
import { ArchiveX, Check, Plus, RotateCcw, X } from "lucide-react";
import { EnglishNumberInput } from "@/components/forms/EnglishNumberInput";
import { EnglishQuantityInput } from "@/components/forms/EnglishQuantityInput";
import { formatMoneyMinor } from "@/presentation/formatters";
import {
  catalogYieldReadinessLabel,
  dimensionLabel,
  parseCatalogJodMinor,
  parseCatalogQuantityMilli,
  quantityLabel,
  type CatalogConversionPreview,
  type CatalogPerUnitPreview,
} from "@/presentation/catalogPresentation";
import { templateComponentCountLabel } from "@/presentation/plurals";
import type { CatalogItem, CatalogTemplate, MeasurementUnit } from "@micro-domain/catalog/index.js";

export type CatalogTemplatesSectionProps = {
  selectedItemId: string;
  setSelectedItemId: Dispatch<SetStateAction<string>>;
  templateTitle: string;
  setTemplateTitle: Dispatch<SetStateAction<string>>;
  templateNote: string;
  setTemplateNote: Dispatch<SetStateAction<string>>;
  templateComponents: CatalogTemplate["components"];
  setTemplateComponents: Dispatch<SetStateAction<CatalogTemplate["components"]>>;
  componentName: string;
  setComponentName: Dispatch<SetStateAction<string>>;
  componentMaterialId: string;
  setComponentMaterialId: Dispatch<SetStateAction<string>>;
  componentQuantity: number | null;
  setComponentQuantity: Dispatch<SetStateAction<number | null>>;
  componentQuantityValid: boolean;
  setComponentQuantityValid: Dispatch<SetStateAction<boolean>>;
  componentUnitId: string;
  setComponentUnitId: Dispatch<SetStateAction<string>>;
  yieldEnabled: boolean;
  setYieldEnabled: Dispatch<SetStateAction<boolean>>;
  yieldQuantity: number | null;
  setYieldQuantity: Dispatch<SetStateAction<number | null>>;
  yieldQuantityValid: boolean;
  setYieldQuantityValid: Dispatch<SetStateAction<boolean>>;
  yieldUnitId: string;
  setYieldUnitId: Dispatch<SetStateAction<string>>;
  editingTemplateId: string | null;
  extrasOpen: boolean;
  setExtrasOpen: Dispatch<SetStateAction<boolean>>;
  autoConsumeOnDelivery: boolean;
  setAutoConsumeOnDelivery: Dispatch<SetStateAction<boolean>>;
  extraTimeMinutes: number | null;
  setExtraTimeMinutes: Dispatch<SetStateAction<number | null>>;
  extraRateMinor: number | null;
  setExtraRateMinor: Dispatch<SetStateAction<number | null>>;
  extraPackagingMinor: number;
  setExtraPackagingMinor: Dispatch<SetStateAction<number>>;
  extraDeliveryMinor: number;
  setExtraDeliveryMinor: Dispatch<SetStateAction<number>>;
  extraWasteMinor: number;
  setExtraWasteMinor: Dispatch<SetStateAction<number>>;
  extraBufferMinor: number;
  setExtraBufferMinor: Dispatch<SetStateAction<number>>;
  activeUnits: readonly MeasurementUnit[];
  units: readonly MeasurementUnit[];
  items: readonly CatalogItem[];
  materials: readonly { id: string; name: string; unitLabel: string; tracked: boolean }[];
  selectedItem: CatalogItem | null;
  selectedItemUnit: MeasurementUnit | null;
  selectedTemplates: readonly CatalogTemplate[];
  saving: boolean;
  addComponent: () => void;
  saveTemplate: () => Promise<boolean>;
  deactivateTemplate: (id: string) => Promise<void>;
  startRevision: (template: CatalogTemplate) => void;
  resetTemplateForm: () => void;
};

export function CatalogTemplatesSection({
  selectedItemId,
  setSelectedItemId,
  templateTitle,
  setTemplateTitle,
  templateNote,
  setTemplateNote,
  templateComponents,
  setTemplateComponents,
  componentName,
  setComponentName,
  componentMaterialId,
  setComponentMaterialId,
  componentQuantity,
  setComponentQuantity,
  componentQuantityValid,
  setComponentQuantityValid,
  componentUnitId,
  setComponentUnitId,
  yieldEnabled,
  setYieldEnabled,
  yieldQuantity,
  setYieldQuantity,
  yieldQuantityValid,
  setYieldQuantityValid,
  yieldUnitId,
  setYieldUnitId,
  editingTemplateId,
  extrasOpen,
  setExtrasOpen,
  autoConsumeOnDelivery,
  setAutoConsumeOnDelivery,
  extraTimeMinutes,
  setExtraTimeMinutes,
  extraRateMinor,
  setExtraRateMinor,
  extraPackagingMinor,
  setExtraPackagingMinor,
  extraDeliveryMinor,
  setExtraDeliveryMinor,
  extraWasteMinor,
  setExtraWasteMinor,
  extraBufferMinor,
  setExtraBufferMinor,
  activeUnits,
  units,
  items,
  materials,
  selectedItem,
  selectedItemUnit,
  selectedTemplates,
  saving,
  addComponent,
  saveTemplate,
  deactivateTemplate,
  startRevision,
  resetTemplateForm,
}: CatalogTemplatesSectionProps) {
  return (
    <details className="micro-decision-layer">
      <summary className="micro-decision-layer-summary">
        <span>
          <b>قالب اختياري</b>
          <small>تذكّر تخطيطي للمكونات والناتج عند الحاجة.</small>
        </span>
        <strong>افتح التفاصيل</strong>
      </summary>
      <section className="micro-form-card">
        <div className="micro-page-heading">
          <span className="micro-overline">3 · قالب اختياري</span>
          <h2>ماذا أجهز عادةً؟</h2>
          <p>القالب للتذكر والتخطيط فقط. لا يسحب مخزونًا ولا يغيّر تكلفة قديمة.</p>
        </div>
        <label className="micro-field">
          <span>مرجع القالب</span>
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
                  {item.name} · {item.kind === "product" ? "منتج" : "خدمة"}
                </option>
              ))}
          </select>
        </label>
        {selectedItem ? (
          <div className="micro-subsection-stack">
            <div className="micro-subsection">
              <div className="micro-subsection-heading">
                <div>
                  <h3>{editingTemplateId ? "تعديل القالب" : "قالب جديد"}</h3>
                  <p>
                    {selectedItemUnit
                      ? `مخرج المرجع: ${selectedItemUnit.nameAr} · ${dimensionLabel(selectedItemUnit.dimension)}`
                      : "لا توجد وحدة مخرج منظمة؛ يمكن حفظ القالب دون ناتج."}
                  </p>
                </div>
              </div>
              <div className="micro-form-grid">
                <label className="micro-field">
                  <span>
                    عنوان أو مصدر <small>اختياري</small>
                  </span>
                  <input
                    value={templateTitle}
                    onChange={event => setTemplateTitle(event.target.value)}
                    placeholder="مثال: تجهيز الطلب المعتاد"
                  />
                </label>
                <label className="micro-field micro-field-wide">
                  <span>
                    ملاحظة <small>اختيارية</small>
                  </span>
                  <input
                    value={templateNote}
                    onChange={event => setTemplateNote(event.target.value)}
                    placeholder="ملاحظة تساعدني في التكرار"
                  />
                </label>
              </div>
              <div className="micro-inline-heading">
                <h4>المكونات</h4>
                <span>{templateComponentCountLabel(templateComponents.length)}</span>
              </div>
              <div className="micro-form-grid">
                <label className="micro-field">
                  <span>اسم المكوّن</span>
                  <input
                    value={componentName}
                    onChange={event => setComponentName(event.target.value)}
                    placeholder="مثال: شمع"
                  />
                </label>
                <label className="micro-field">
                  <span>
                    الكمية <small>حتى 3 منازل</small>
                  </span>
                  <EnglishQuantityInput
                    valueMilli={componentQuantity}
                    onMilliChange={setComponentQuantity}
                    onTextValidityChange={setComponentQuantityValid}
                    onEmptyChange={() => setComponentQuantity(null)}
                    allowEmpty
                    aria-label="كمية مكوّن القالب"
                  />
                </label>
                <label className="micro-field">
                  <span>الوحدة</span>
                  <select value={componentUnitId} onChange={event => setComponentUnitId(event.target.value)}>
                    <option value="">اختر وحدة</option>
                    {activeUnits.map(unit => (
                      <option key={unit.id} value={unit.id}>
                        {unit.nameAr} · {dimensionLabel(unit.dimension)}
                      </option>
                    ))}
                  </select>
                </label>
                {/* المجموعة ٣ (عقد D5): ربط المادة اختياري — مكوّن حر إن تُرك فارغًا؛
                      الربط هوية تخطيط تظهر لاحقًا ضمن استهلاك مواد التسليم المقترح. */}
                <label className="micro-field">
                  <span>مادة مرتبطة من المخزون (اختياري)</span>
                  <select
                    value={componentMaterialId}
                    onChange={event => setComponentMaterialId(event.target.value)}
                  >
                    <option value="">بلا مادة — مكوّن حر</option>
                    {materials.map(material => (
                      <option key={material.id} value={material.id}>
                        {material.name} · {material.unitLabel} ·{" "}
                        {material.tracked ? "متتبَّعة" : "غير متتبَّعة (تكلفة فقط)"}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <button className="micro-button micro-button-secondary" type="button" onClick={addComponent}>
                <Plus aria-hidden="true" /> أضف مكوّنًا للقالب
              </button>
              {templateComponents.length ? (
                <div className="micro-list micro-list-compact">
                  {templateComponents.map(component => {
                    const linkedMaterial = component.materialId
                      ? materials.find(material => material.id === component.materialId)
                      : null;
                    return (
                      <div className="micro-list-item" key={component.id}>
                        <div>
                          <strong>{component.name}</strong>
                          <p dir="ltr">
                            {quantityLabel(component.quantityMilli)} ·{" "}
                            {units.find(unit => unit.id === component.unitId)?.nameAr ?? "وحدة محفوظة"}
                          </p>
                          {linkedMaterial ? (
                            <p className="micro-local-truth">
                              مربوط بـ«{linkedMaterial.name}» ·{" "}
                              {linkedMaterial.tracked ? "متتبَّعة" : "غير متتبَّعة — تكلفة فقط"}
                            </p>
                          ) : (
                            <p className="micro-local-truth">مكوّن حر — بلا مادة مخزون</p>
                          )}
                        </div>
                        <button
                          className="micro-icon-button"
                          type="button"
                          aria-label={`إزالة ${component.name}`}
                          onClick={() =>
                            setTemplateComponents(current =>
                              current.filter(entry => entry.id !== component.id),
                            )
                          }
                        >
                          <X aria-hidden="true" />
                        </button>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="micro-empty-copy">
                  لم تضف مكونات بعد. يمكنك حفظ قالب فارغ كملاحظة تخطيطية، أو إضافة ما تكرره عادةً.
                </p>
              )}
              {/* المجموعة ٣ (عقد D5): بنود تكلفة اختيارية على مستوى القالب — إفصاح
                    تدريجي؛ الافتراضي قالب ببندات مواد فقط، والعمل/التغليف/التوصيل/
                    الهدر/هامش الحماية خلف فعل واضح. مرجع تخطيط بلا أثر مخزون أو سعر. */}
              <button
                className="micro-button micro-button-quiet"
                type="button"
                onClick={() => setExtrasOpen(current => !current)}
              >
                {extrasOpen ? "إخفاء بنود التكلفة الاختيارية" : "بنود اختيارية: عمل، تغليف، توصيل، هدر، هامش"}
              </button>
              {extrasOpen ? (
                <div className="micro-form-grid">
                  <label className="micro-field">
                    <span>دقائق العمل لكل وحدة (اختياري)</span>
                    <EnglishNumberInput
                      value={extraTimeMinutes ?? 0}
                      kind="integer"
                      onNumericChange={value => setExtraTimeMinutes(value > 0 ? value : null)}
                      aria-label="دقائق العمل لكل وحدة"
                    />
                  </label>
                  <label className="micro-field">
                    <span>أجر الساعة (د.أ) (اختياري)</span>
                    <EnglishNumberInput
                      value={extraRateMinor ?? 0}
                      kind="money"
                      onNumericChange={value => setExtraRateMinor(value > 0 ? value : null)}
                      aria-label="أجر الساعة"
                    />
                  </label>
                  <label className="micro-field">
                    <span>تغليف لكل وحدة (د.أ)</span>
                    <EnglishNumberInput
                      value={extraPackagingMinor}
                      kind="money"
                      onNumericChange={setExtraPackagingMinor}
                      aria-label="تكلفة التغليف لكل وحدة"
                    />
                  </label>
                  <label className="micro-field">
                    <span>توصيل لكل وحدة (د.أ)</span>
                    <EnglishNumberInput
                      value={extraDeliveryMinor}
                      kind="money"
                      onNumericChange={setExtraDeliveryMinor}
                      aria-label="تكلفة التوصيل لكل وحدة"
                    />
                  </label>
                  <label className="micro-field">
                    <span>هدر متوقع لكل وحدة (د.أ)</span>
                    <EnglishNumberInput
                      value={extraWasteMinor}
                      kind="money"
                      onNumericChange={setExtraWasteMinor}
                      aria-label="تكلفة الهدر المتوقعة لكل وحدة"
                    />
                  </label>
                  <label className="micro-field">
                    <span>هامش حماية لكل وحدة (د.أ)</span>
                    <EnglishNumberInput
                      value={extraBufferMinor}
                      kind="money"
                      onNumericChange={setExtraBufferMinor}
                      aria-label="هامش الحماية لكل وحدة"
                    />
                  </label>
                  <p className="micro-local-truth">
                    الوقت بلا أجر أو الأجر بلا وقت يبقى «غير معرف بعد» — لا يُفترض صفر واثق.
                  </p>
                  {/* المجموعة ٤ (عقد ٢٩): إعلان الخصم التلقائي — علم صريح لا خصم خفي. */}
                  <label className="micro-checkbox">
                    <input
                      type="checkbox"
                      checked={autoConsumeOnDelivery}
                      onChange={event => setAutoConsumeOnDelivery(event.target.checked)}
                    />
                    <span>
                      خصم تلقائي عند التسليم
                      <small>
                        عند تأكيد التسليم تكون حركات استهلاك المواد المرتبطة جاهزةً ضمن الخطوة نفسها — بمعاينة
                        وبلا أثر عند فتح الصفحات أو حفظ المسودات.
                      </small>
                    </span>
                  </label>
                </div>
              ) : null}
              <label className="micro-checkbox">
                <input
                  type="checkbox"
                  checked={yieldEnabled}
                  onChange={event => setYieldEnabled(event.target.checked)}
                />
                <span>أضيف ناتجًا متوقعًا لهذا القالب</span>
              </label>
              {yieldEnabled ? (
                <div className="micro-form-grid">
                  <label className="micro-field">
                    <span>كمية الناتج</span>
                    <EnglishQuantityInput
                      valueMilli={yieldQuantity}
                      onMilliChange={setYieldQuantity}
                      onTextValidityChange={setYieldQuantityValid}
                      onEmptyChange={() => setYieldQuantity(null)}
                      allowEmpty
                      aria-label="كمية ناتج القالب"
                    />
                  </label>
                  <label className="micro-field">
                    <span>وحدة الناتج</span>
                    <select value={yieldUnitId} onChange={event => setYieldUnitId(event.target.value)}>
                      <option value="">اختر وحدة الناتج</option>
                      {activeUnits.map(unit => (
                        <option key={unit.id} value={unit.id}>
                          {unit.nameAr} · {dimensionLabel(unit.dimension)}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
              ) : null}
              <div className="micro-action-row">
                <button
                  className="micro-button micro-button-primary"
                  type="button"
                  disabled={saving || !selectedItemId}
                  onClick={saveTemplate}
                >
                  {editingTemplateId ? <RotateCcw aria-hidden="true" /> : <Check aria-hidden="true" />}{" "}
                  {saving ? "جارٍ الحفظ…" : editingTemplateId ? "احفظ النسخة الجديدة" : "احفظ القالب"}
                </button>
                {editingTemplateId ? (
                  <button
                    className="micro-button micro-button-secondary"
                    type="button"
                    onClick={resetTemplateForm}
                  >
                    إلغاء التعديل
                  </button>
                ) : null}
              </div>
            </div>
            <div className="micro-subsection">
              <div className="micro-subsection-heading">
                <div>
                  <span className="micro-overline">المراجعات المحفوظة</span>
                  <h3>قالب هذا المرجع</h3>
                </div>
                <p>التعديل ينشئ نسخة جديدة؛ لا يعيد حساب طلب سابق.</p>
              </div>
              {selectedTemplates.length ? (
                <div className="micro-list">
                  {selectedTemplates.map(template => (
                    <article className="micro-list-item" key={template.id}>
                      <div>
                        <strong>
                          {template.title || "قالب بلا عنوان"} · نسخة {template.revision}
                        </strong>
                        <p>
                          {templateComponentCountLabel(template.components.length)}
                          {template.yield
                            ? ` · الناتج ${quantityLabel(template.yield.quantityMilli)}`
                            : " · بلا ناتج"}
                          {template.active ? "" : " · موقوف"}
                        </p>
                        {template.yieldReadiness === "needs_conversion" ? (
                          <p className="micro-warning-copy">
                            الناتج غير مهيأ: أضف تحويلًا صريحًا داخل البعد نفسه، ولن نخمّن أو نقرب.
                          </p>
                        ) : template.yieldReadiness === "ready" ? (
                          <p className="micro-success-copy">الناتج متوافق مع وحدة المرجع.</p>
                        ) : null}
                        <details className="micro-inline-disclosure">
                          <summary>حدود القالب</summary>
                          <p>
                            هذا تذكّر تخطيطي فقط؛ لا شراء مواد ولا مخزون ولا استهلاك ولا تكلفة بيع ولا إيراد
                            ولا هامش ينشأ منه.
                          </p>
                        </details>
                      </div>
                      <div className="micro-action-column">
                        {template.active ? (
                          <>
                            <button
                              className="micro-button micro-button-secondary"
                              type="button"
                              onClick={() => startRevision(template)}
                            >
                              <RotateCcw aria-hidden="true" /> نسخة جديدة
                            </button>
                            <button
                              className="micro-button micro-button-secondary"
                              type="button"
                              onClick={() => deactivateTemplate(template.id)}
                            >
                              <ArchiveX aria-hidden="true" /> إيقاف
                            </button>
                          </>
                        ) : null}
                      </div>
                    </article>
                  ))}
                </div>
              ) : (
                <p className="micro-empty-copy">
                  لا يوجد قالب لهذا المرجع. وهذا مسار صحيح للخدمة أو العمل المخصص.
                </p>
              )}
            </div>
          </div>
        ) : (
          <p className="micro-empty-copy">
            اختر مرجعًا إن أردت إضافة مكونات أو ناتجًا متكررًا. لا يلزم إعداد أي قالب للحفظ.
          </p>
        )}
      </section>
    </details>
  );
}
