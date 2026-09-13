/**
 * المجموعة ١١ (المرحلة 11-A — تفكيك الكتالوج): مرجع العمل: نموذج الإنشاء بالاسم والاقتراحات وقائمة المراجع — مقطع عرض مستخرج
 * من صفحة Catalog.tsx حرفيًا؛ الصفحة تبقى الموزّع الوحيد (تملك الحالة
 * والمعالجات وحارس التغييرات غير المحفوظة) وتمرّر كل شيء خصائصِ أدناه.
 * لا منطق ماليًا هنا ولا تخزين ولا مسارات — عرض فقط بنفس السلوك.
 */
import { type Dispatch, type SetStateAction } from "react";
import { ArchiveX, Plus, X } from "lucide-react";
import { EnglishNumberInput } from "@/components/forms/EnglishNumberInput";
import { formatMoneyMinor } from "@/presentation/formatters";
import {
  dimensionLabel,
  parseCatalogJodMinor,
  parseCatalogQuantityMilli,
  quantityLabel,
} from "@/presentation/catalogPresentation";
import { withFrom } from "@/app/navigationContract";
import type { CatalogItem, CatalogItemKind, MeasurementUnit } from "@micro-domain/catalog/index.js";

export type CatalogItemsSectionProps = {
  kind: CatalogItemKind;
  setKind: Dispatch<SetStateAction<CatalogItemKind>>;
  name: string;
  setName: Dispatch<SetStateAction<string>>;
  unitLabel: string;
  setUnitLabel: Dispatch<SetStateAction<string>>;
  unitId: string;
  setUnitId: Dispatch<SetStateAction<string>>;
  defaultPrice: number;
  setDefaultPrice: Dispatch<SetStateAction<number>>;
  defaultPriceEmpty: boolean;
  setDefaultPriceEmpty: Dispatch<SetStateAction<boolean>>;
  defaultPriceValid: boolean;
  setDefaultPriceValid: Dispatch<SetStateAction<boolean>>;
  defaultCost: number;
  setDefaultCost: Dispatch<SetStateAction<number>>;
  defaultCostEmpty: boolean;
  setDefaultCostEmpty: Dispatch<SetStateAction<boolean>>;
  defaultCostValid: boolean;
  setDefaultCostValid: Dispatch<SetStateAction<boolean>>;
  defaultsEditingId: string | null;
  setDefaultsEditingId: Dispatch<SetStateAction<string | null>>;
  editingPrice: number;
  setEditingPrice: Dispatch<SetStateAction<number>>;
  editingPriceEmpty: boolean;
  setEditingPriceEmpty: Dispatch<SetStateAction<boolean>>;
  editingPriceValid: boolean;
  setEditingPriceValid: Dispatch<SetStateAction<boolean>>;
  editingCost: number;
  setEditingCost: Dispatch<SetStateAction<number>>;
  editingCostEmpty: boolean;
  setEditingCostEmpty: Dispatch<SetStateAction<boolean>>;
  editingCostValid: boolean;
  setEditingCostValid: Dispatch<SetStateAction<boolean>>;
  items: readonly CatalogItem[];
  activeUnits: readonly MeasurementUnit[];
  saving: boolean;
  create: () => Promise<void>;
  openDefaultsEditor: (item: CatalogItem) => void;
  saveDefaults: (id: string) => Promise<void>;
  requestSafeNavigation: (target: string) => void;
};

export function CatalogItemsSection({
  kind,
  setKind,
  name,
  setName,
  unitLabel,
  setUnitLabel,
  unitId,
  setUnitId,
  defaultPrice,
  setDefaultPrice,
  defaultPriceEmpty,
  setDefaultPriceEmpty,
  defaultPriceValid,
  setDefaultPriceValid,
  defaultCost,
  setDefaultCost,
  defaultCostEmpty,
  setDefaultCostEmpty,
  defaultCostValid,
  setDefaultCostValid,
  defaultsEditingId,
  setDefaultsEditingId,
  editingPrice,
  setEditingPrice,
  editingPriceEmpty,
  setEditingPriceEmpty,
  editingPriceValid,
  setEditingPriceValid,
  editingCost,
  setEditingCost,
  editingCostEmpty,
  setEditingCostEmpty,
  editingCostValid,
  setEditingCostValid,
  items,
  activeUnits,
  saving,
  create,
  openDefaultsEditor,
  saveDefaults,
  requestSafeNavigation,
}: CatalogItemsSectionProps) {
  return (
    <>
      <section className="micro-form-card">
        <div className="micro-page-heading">
          <span className="micro-overline">1 · مرجع العمل</span>
          <h2>ابدأ بالاسم فقط</h2>
          <p>الوحدة المنظمة اختيارية؛ تبقى تسمية العرض القديمة كما أدخلتها.</p>
        </div>
        <div className="micro-form-grid">
          <label className="micro-field">
            <span>نوع المرجع</span>
            <select value={kind} onChange={event => setKind(event.target.value as CatalogItemKind)}>
              <option value="product">منتج</option>
              <option value="service">خدمة</option>
            </select>
          </label>
          <label className="micro-field">
            <span>اسم المرجع</span>
            <input
              value={name}
              onChange={event => setName(event.target.value)}
              placeholder={kind === "product" ? "مثال: صندوق هدايا" : "مثال: تغليف هدايا"}
            />
          </label>
          <label className="micro-field">
            <span>
              وحدة عرض <small>اختيارية</small>
            </span>
            <input
              value={unitLabel}
              onChange={event => setUnitLabel(event.target.value)}
              placeholder={kind === "product" ? "مثال: قطعة" : "مثال: جلسة"}
            />
          </label>
          {/* المجموعة ٦ (البند ٤ — S3-12): الوحدة المنظمة اختيار تقني خلف إفصاح
              44px — المسار الأساسي (اسم + وحدة عملية) يبقى في الوجه. */}
          <details className="micro-inline-disclosure">
            <summary>وحدة منظمة (اختيارية)</summary>
            <label className="micro-field">
              <span>
                وحدة منظمة <small>اختيارية</small>
              </span>
              <select value={unitId} onChange={event => setUnitId(event.target.value)}>
                <option value="">لا أضيف وحدة الآن</option>
                {activeUnits.map(unit => (
                  <option key={unit.id} value={unit.id}>
                    {unit.nameAr} · {dimensionLabel(unit.dimension)}
                  </option>
                ))}
              </select>
            </label>
          </details>
        </div>
        {/* P-002 (الخيار أ): اقتراحان اختياريان يُحفظان مع المرجع — يُعرضان في بيع
            المباشر كمقترح قابل للتعديل، والسعر الفعلي للبيع هو ما يُدخل ويُؤكد هناك.
            المجموعة ٦ (البند ٤ — S3-12): الاقتراحان خلف إفصاح مسمّى — إنشاء المرجع
            الأساسي (الاسم والوحدة) لا يتطلب فتحه. */}
        <details className="micro-inline-disclosure">
          <summary>اقتراحات السعر والتكلفة (اختيارية)</summary>
          <div className="micro-form-grid">
            <label className="micro-field">
              <span>
                سعر بيع افتراضي <small>اقتراح اختياري — ليس سعرًا مفروضًا</small>
              </span>
              <EnglishNumberInput
                value={defaultPrice}
                kind="money"
                /* المجموعة ٣ (فحص حي): الكتابة تُخرج الحقل من حالة «الفراغ» — وإلا
                 يُحفظ السعر المقترح null بصمت بينما التكلفة تُحفظ. */
                onNumericChange={value => {
                  setDefaultPrice(value);
                  setDefaultPriceEmpty(false);
                }}
                onTextValidityChange={setDefaultPriceValid}
                allowEmpty
                onEmptyChange={() => setDefaultPriceEmpty(true)}
                aria-label="سعر بيع افتراضي مقترح"
              />
            </label>
            <label className="micro-field">
              <span>
                تكلفة وحدة افتراضية <small>اقتراح اختياري — ليس تكلفة فعلية</small>
              </span>
              <EnglishNumberInput
                value={defaultCost}
                kind="money"
                onNumericChange={value => {
                  setDefaultCost(value);
                  setDefaultCostEmpty(false);
                }}
                onTextValidityChange={setDefaultCostValid}
                allowEmpty
                onEmptyChange={() => setDefaultCostEmpty(true)}
                aria-label="تكلفة وحدة افتراضية مقترحة"
              />
            </label>
          </div>
        </details>
        <button
          className="micro-button micro-button-primary"
          type="button"
          disabled={saving || !name.trim()}
          onClick={create}
        >
          <Plus aria-hidden="true" /> {saving ? "جارٍ الحفظ…" : "أضف مرجعًا"}
        </button>
      </section>

      <section className="micro-section" aria-labelledby="catalog-items-title">
        <div className="micro-section-heading">
          <div>
            <span className="micro-overline">مراجعي</span>
            <h2 id="catalog-items-title">أعمال متكررة</h2>
          </div>
          <span className="micro-g5-count">{items.length}</span>
        </div>
        {items.length ? (
          <div className="micro-list micro-list-compact">
            {items.map(item => (
              <article className="micro-list-item" key={item.id}>
                <div>
                  <strong>{item.name}</strong>
                  <p>
                    {item.kind === "product" ? "منتج" : "خدمة"}
                    {item.unitLabel ? ` · ${item.unitLabel}` : ""}
                    {item.active ? " · متاح للطلبات الجديدة" : " · موقوف للطلبات الجديدة"}
                    {item.defaultPriceMinor != null
                      ? ` · سعر مقترح: ${formatMoneyMinor(item.defaultPriceMinor)} د.أ`
                      : ""}
                    {item.defaultUnitCostMinor != null
                      ? ` · تكلفة مقترحة: ${formatMoneyMinor(item.defaultUnitCostMinor)} د.أ`
                      : ""}
                  </p>
                  <details
                    className="micro-inline-disclosure"
                    open={defaultsEditingId === item.id}
                    onToggle={event => {
                      /* فتح الإفصاح يعبّئ المحرر بقيم المرجع الحالية (P-002)؛
                       * الإغلاق ينهي التعديل — نفس سلوك الزر السابق بلا زر إضافي. */
                      if (event.currentTarget.open) openDefaultsEditor(item);
                      else setDefaultsEditingId(null);
                    }}
                  >
                    <summary>عدّل الافتراضيات</summary>
                    {defaultsEditingId === item.id ? (
                      <div className="micro-form-grid">
                        <label className="micro-field">
                          <span>سعر مقترح جديد</span>
                          <EnglishNumberInput
                            value={editingPrice}
                            kind="money"
                            onNumericChange={value => {
                              setEditingPrice(value);
                              setEditingPriceEmpty(false);
                            }}
                            onTextValidityChange={setEditingPriceValid}
                            allowEmpty
                            onEmptyChange={() => setEditingPriceEmpty(true)}
                            aria-label="سعر مقترح جديد"
                          />
                        </label>
                        <label className="micro-field">
                          <span>تكلفة مقترحة جديدة</span>
                          <EnglishNumberInput
                            value={editingCost}
                            kind="money"
                            onNumericChange={value => {
                              setEditingCost(value);
                              setEditingCostEmpty(false);
                            }}
                            onTextValidityChange={setEditingCostValid}
                            allowEmpty
                            onEmptyChange={() => setEditingCostEmpty(true)}
                            aria-label="تكلفة مقترحة جديدة"
                          />
                        </label>
                        <div className="micro-form-actions">
                          <button
                            className="micro-button micro-button-primary"
                            type="button"
                            disabled={saving}
                            onClick={() => void saveDefaults(item.id)}
                          >
                            {saving ? "جارٍ الحفظ…" : "حفظ الاقتراحات"}
                          </button>
                          <button
                            className="micro-button micro-button-secondary"
                            type="button"
                            disabled={saving}
                            onClick={() => setDefaultsEditingId(null)}
                          >
                            إلغاء التعديل
                          </button>
                        </div>
                      </div>
                    ) : null}
                  </details>
                  <div className="micro-form-actions">
                    {/* المجموعة ٣ (Scope C — §9.3): Product-to-Sale من صف المرجع — يفتح
                        محرر البيع بمرجع مُختار مسبقًا (?product=) ويحفظ الكتالوج مصدرًا؛
                        الموقوف لا يُباع من هنا حتى يُفعّل. */}
                    {item.active ? (
                      <button
                        className="micro-button micro-button-primary"
                        type="button"
                        onClick={() =>
                          requestSafeNavigation(
                            withFrom(`/direct-sales/new?product=${encodeURIComponent(item.id)}`, "/catalog"),
                          )
                        }
                      >
                        {item.kind === "product" ? "سجّل بيع هذا المنتج" : "سجّل بيع هذه الخدمة"}
                      </button>
                    ) : null}
                  </div>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <p className="micro-empty-copy">لا يوجد مرجع بعد. أضف فقط العمل الذي يتكرر.</p>
        )}
      </section>
    </>
  );
}
