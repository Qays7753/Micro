/**
 * «أدواتي» (owner principle 5.4): an independent top-level destination.
 * The cost calculator works without an order, without a draft, without inventory —
 * and it never creates a financial event or an inventory movement.
 */
import { ArrowLeft, Calculator, Layers, PackageOpen, Save, Trash2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useLocation } from "wouter";
import { withFrom } from "@/app/navigationContract";
import { usePrototypeServices } from "@/app/PrototypeServicesContext";
import { EnglishNumberInput } from "@/components/forms/EnglishNumberInput";
import { MoneyValue } from "@/components/presentation/DisplayValue";
import { formatLocalDate, localDateInAmman } from "@/presentation/formatters";
import type { CostEstimate } from "@/storage/local/types";
type EditableMaterial = {
  uiId: string;
  name: string;
  quantity: number;
  unit: string;
  unitPriceMinor: number;
  confidence: "known" | "estimated";
};

type ModuleState =
  | "not_available"
  | "available_not_enabled"
  | "enabled"
  | "partially_configured";

const moduleStateLabel: Record<ModuleState, string> = {
  not_available: "غير متاح في هذه المرحلة",
  available_not_enabled: "متاح — غير مفعّل",
  enabled: "مفعّل",
  partially_configured: "مفعّل جزئيًا — أكمل بياناته",
  /* Q-003/D-006: حالة «متوقف مؤقتًا» أُزيلت — لم يكن لها مُنتِج حقيقي. */
};

const knowledgeLabel: Record<string, string> = {
  known: "معروفة",
  estimated: "تقديرية",
  partial: "جزئية",
  incomplete: "ناقصة",
  stale: "متقادمة",
  variable: "متغيرة",
};

export default function Tools() {
  const [, navigate] = useLocation();
  const {
    costEstimates,
    dataVersion,
    inventory,
    catalog,
    schedules,
    supplierPurchases,
    partyLedger,
    notifyDataChanged,
  } = usePrototypeServices();
  /* نموذج الحاسبة */
  const [title, setTitle] = useState("");
  const [materials, setMaterials] = useState<EditableMaterial[]>([
    { uiId: "m-1", name: "", quantity: 1, unit: "قطعة", unitPriceMinor: 0, confidence: "known" },
  ]);
  const [timeKnown, setTimeKnown] = useState(false);
  const [timeMinutes, setTimeMinutes] = useState(0);
  const [timeRateMinor, setTimeRateMinor] = useState(0);
  const [quantity, setQuantity] = useState(1);
  const [safetyBufferMinor, setSafetyBufferMinor] = useState(0);
  const [packagingMinor, setPackagingMinor] = useState(0);
  const [deliveryMinor, setDeliveryMinor] = useState(0);
  const [wasteMinor, setWasteMinor] = useState(0);
  const [showOptional, setShowOptional] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  /* التقديرات المحفوظة + حالة الوحدات */
  const [savedEstimates, setSavedEstimates] = useState<readonly CostEstimate[]>([]);
  const [moduleStates, setModuleStates] = useState<readonly { label: string; state: ModuleState; href: string }[]>(
    [],
  );

  useEffect(() => {
    let active = true;
    costEstimates.list().then(result => {
      if (active && result.ok) setSavedEstimates(result.value);
    });
    /* D-006: حالات الوحدات مشتقة من بيانات فعلية — لا سلسلة مثبتة تقول «غير مفعّل»
     * لما فيه بيانات. الوحدة بلا منتج للحالة لا تدّعي حالة. */
    Promise.all([
      inventory.readActivation(),
      catalog.listUnits(),
      catalog.list(),
      schedules.overview(),
      supplierPurchases.readSummary(),
      partyLedger.read(),
    ]).then(([activation, units, items, scheduleOverview, purchases, parties]) => {
      if (!active || !activation.ok || !units.ok || !items.ok) return;
      const catalogConfigured = items.items.length > 0;
      const scheduleConfigured =
        scheduleOverview.ok &&
        scheduleOverview.value.overdue.length +
          scheduleOverview.value.today.length +
          scheduleOverview.value.upcoming.length +
          scheduleOverview.value.completedOrClosed >
          0;
      const suppliersConfigured = purchases.ok && purchases.value.purchaseCount > 0;
      const partiesConfigured = parties.ok && parties.value.parties.length > 0;
      setModuleStates([
        {
          label: "حاسبة التكلفة",
          state: "enabled",
          href: "/tools",
        },
        {
          label: "المخزون",
          state: activation.value.activatedOn ? "enabled" : "available_not_enabled",
          href: "/inventory",
        },
        {
          label: "الكتالوج والقوالب",
          state: catalogConfigured
            ? "enabled"
            : units.units.length > 0
              ? "partially_configured"
              : "available_not_enabled",
          href: "/catalog",
        },
        {
          label: "المواعيد والمتابعات",
          state: scheduleConfigured ? "enabled" : "available_not_enabled",
          href: "/schedule",
        },
        {
          label: "الموردون والمشتريات",
          state: suppliersConfigured ? "enabled" : "available_not_enabled",
          href: "/suppliers",
        },
        {
          label: "دفتر الناس",
          state: partiesConfigured ? "enabled" : "available_not_enabled",
          href: "/parties",
        },
        { label: "السوق والتوصيل", state: "not_available", href: "/tools" },
      ]);
    });
    return () => {
      active = false;
    };
  }, [costEstimates, inventory, catalog, schedules, supplierPurchases, partyLedger, dataVersion]);

  const preview = useMemo(
    () =>
      costEstimates.preview({
        title,
        materialItems: materials
          .filter(material => material.name.trim() && material.unitPriceMinor > 0)
          .map(material => ({
            name: material.name.trim(),
            quantity: material.quantity,
            unit: material.unit.trim() || "قطعة",
            unitPriceMinor: material.unitPriceMinor,
            confidence: material.confidence,
          })),
        time: timeKnown && timeMinutes > 0 && timeRateMinor > 0
          ? { minutes: timeMinutes, hourlyRateMinor: timeRateMinor, confidence: "known" as const }
          : null,
        packagingMinor,
        deliveryMinor,
        wasteMinor,
        safetyBufferMinor,
        quantity: Math.max(1, Math.round(quantity)),
        note: null,
      }),
    [
      costEstimates,
      title,
      materials,
      timeKnown,
      timeMinutes,
      timeRateMinor,
      packagingMinor,
      deliveryMinor,
      wasteMinor,
      safetyBufferMinor,
      quantity,
    ],
  );

  async function saveEstimate() {
    setSaving(true);
    setMessage(null);
    const result = await costEstimates.save({
      title,
      materialItems: materials
        .filter(material => material.name.trim() && material.unitPriceMinor > 0)
        .map(material => ({
          name: material.name.trim(),
          quantity: material.quantity,
          unit: material.unit.trim() || "قطعة",
          unitPriceMinor: material.unitPriceMinor,
          confidence: material.confidence,
        })),
      time:
        timeKnown && timeMinutes > 0 && timeRateMinor > 0
          ? { minutes: timeMinutes, hourlyRateMinor: timeRateMinor, confidence: "known" as const }
          : null,
      packagingMinor,
      deliveryMinor,
      wasteMinor,
      safetyBufferMinor,
      quantity: Math.max(1, Math.round(quantity)),
      note: null,
    });
    setSaving(false);
    if (!result.ok) {
      setMessage(result.message);
      return;
    }
    notifyDataChanged();
    setMessage("حُفظ التقدير للمراجعة لاحقًا — وسمه «تقديري» دائمًا؛ لم تُنشأ أي حركة مالية أو مخزون.");
    const list = await costEstimates.list();
    if (list.ok) setSavedEstimates(list.value);
  }

  async function removeEstimate(id: string) {
    const result = await costEstimates.remove(id);
    if (!result.ok) {
      setMessage(result.message);
      return;
    }
    notifyDataChanged();
    const list = await costEstimates.list();
    if (list.ok) setSavedEstimates(list.value);
  }

  const canShowPrice =
    preview.ok && !["incomplete", "partial"].includes(preview.value.knowledgeState);

  return (
    <section className="micro-page micro-tools-page">
      <div className="micro-page-heading">
        <span className="micro-overline">أدواتي</span>
        <h1>احسب قبل أن تلتزم</h1>
        <p>حاسبة تفكير مستقلة: تعمل بلا طلب وبلا مخزون وبلا تسجيل منتج — والنتيجة تقديرية دومًا.</p>
      </div>

      <section className="micro-decision-card" aria-label="قاعدة الأداة">
        <span>قاعدة هذه الأداة</span>
        <strong>هذا حساب تقديري. ما انحفظت أي حركة مالية ولا مخزون.</strong>
        <p>الحاسبة لا تمس الكاش ولا الأرصدة ولا التقارير. قرار التسجيل يبقى فعلًا منفصلًا ومقصودًا.</p>
      </section>

      <section className="micro-form-card" aria-label="حاسبة التكلفة">
        <div className="micro-section-title">
          <Calculator aria-hidden="true" />
          <div>
            <span className="micro-overline">أداة مستقلة</span>
            <h2>حاسبة التكلفة والسعر</h2>
          </div>
        </div>
        <label className="micro-field">
          <span>
            عنوان التقدير <small>اختياري</small>
          </span>
          <input
            value={title}
            onChange={event => setTitle(event.target.value)}
            placeholder="مثال: كيكة مناسبة صغيرة"
          />
        </label>
        {materials.map((material, index) => (
          <div className="micro-field-grid" key={material.uiId}>
            <label className="micro-field">
              <span>المادة {index + 1}</span>
              <input
                value={material.name}
                onChange={event =>
                  setMaterials(current =>
                    current.map(item =>
                      item.uiId === material.uiId ? { ...item, name: event.target.value } : item,
                    ),
                  )
                }
                placeholder="مثال: دقيق"
              />
            </label>
            <label className="micro-field">
              <span>الكمية</span>
              <EnglishNumberInput
                value={material.quantity}
                kind="decimal"
                onNumericChange={value =>
                  setMaterials(current =>
                    current.map(item =>
                      item.uiId === material.uiId ? { ...item, quantity: value } : item,
                    ),
                  )
                }
                aria-label={`كمية المادة ${index + 1}`}
              />
            </label>
            <label className="micro-field">
              <span>الوحدة</span>
              <input
                value={material.unit}
                onChange={event =>
                  setMaterials(current =>
                    current.map(item =>
                      item.uiId === material.uiId ? { ...item, unit: event.target.value } : item,
                    ),
                  )
                }
                placeholder="كيلو / لتر / قطعة"
              />
            </label>
            <label className="micro-field">
              <span>سعر الوحدة (د.أ)</span>
              <EnglishNumberInput
                value={material.unitPriceMinor}
                kind="money"
                onNumericChange={value =>
                  setMaterials(current =>
                    current.map(item =>
                      item.uiId === material.uiId ? { ...item, unitPriceMinor: value } : item,
                    ),
                  )
                }
                aria-label={`سعر وحدة المادة ${index + 1}`}
              />
            </label>
            {materials.length > 1 ? (
              <button
                className="micro-text-action micro-delete-row"
                type="button"
                onClick={() =>
                  setMaterials(current => current.filter(item => item.uiId !== material.uiId))
                }
              >
                <Trash2 aria-hidden="true" /> احذف المادة
              </button>
            ) : null}
          </div>
        ))}
        <button
          className="micro-text-action"
          type="button"
          onClick={() =>
            setMaterials(current => [
              ...current,
              {
                uiId: `m-${current.length + 1}-${Date.now()}`,
                name: "",
                quantity: 1,
                unit: "قطعة",
                unitPriceMinor: 0,
                confidence: "known",
              },
            ])
          }
        >
          <PackageOpen aria-hidden="true" /> أضف مادة أخرى
        </button>
        <label className="micro-field">
          <span>هل تحسب وقت عمل؟</span>
          <select
            value={timeKnown ? "known" : "unknown"}
            onChange={event => setTimeKnown(event.target.value === "known")}
          >
            <option value="unknown">بلا وقت الآن</option>
            <option value="known">نعم — أضف أجر الوقت</option>
          </select>
        </label>
        {timeKnown ? (
          <div className="micro-field-grid">
            <label className="micro-field">
              <span>الدقائق</span>
              <EnglishNumberInput
                value={timeMinutes}
                kind="integer"
                onNumericChange={setTimeMinutes}
                aria-label="دقائق العمل"
              />
            </label>
            <label className="micro-field">
              <span>أجر الساعة (د.أ)</span>
              <EnglishNumberInput
                value={timeRateMinor}
                kind="money"
                onNumericChange={setTimeRateMinor}
                aria-label="أجر الساعة"
              />
            </label>
          </div>
        ) : null}
        <div className="micro-field-grid">
          <label className="micro-field">
            <span>عدد القطع الناتجة</span>
            <EnglishNumberInput
              value={quantity}
              kind="integer"
              onNumericChange={setQuantity}
              aria-label="عدد القطع"
            />
          </label>
        </div>
        <details
          className="micro-decision-layer"
          open={showOptional}
          onToggle={event => setShowOptional((event.target as HTMLDetailsElement).open)}
        >
          <summary className="micro-decision-layer-summary">
            <span>
              <b>بنود أخرى وحماية السعر</b>
              <small>تغليف وتوصيل وهدر وهامش حماية — اختيارية كلها.</small>
            </span>
            <strong>{showOptional ? "أخفِ التفاصيل" : "افتح التفاصيل"}</strong>
          </summary>
          <div className="micro-field-grid">
            <label className="micro-field">
              <span>تغليف (د.أ)</span>
              <EnglishNumberInput
                value={packagingMinor}
                kind="money"
                onNumericChange={setPackagingMinor}
                aria-label="تكلفة التغليف"
              />
            </label>
            <label className="micro-field">
              <span>توصيل (د.أ)</span>
              <EnglishNumberInput
                value={deliveryMinor}
                kind="money"
                onNumericChange={setDeliveryMinor}
                aria-label="تكلفة التوصيل"
              />
            </label>
            <label className="micro-field">
              <span>هدر متوقع (د.أ)</span>
              <EnglishNumberInput
                value={wasteMinor}
                kind="money"
                onNumericChange={setWasteMinor}
                aria-label="الهدر المتوقع"
              />
            </label>
            <label className="micro-field">
              <span>هامش حماية السعر (د.أ)</span>
              <EnglishNumberInput
                value={safetyBufferMinor}
                kind="money"
                onNumericChange={setSafetyBufferMinor}
                aria-label="هامش حماية السعر"
              />
            </label>
          </div>
        </details>
        {preview.ok ? (
          <section className="micro-cost-result" data-knowledge={preview.value.knowledgeState}>
            <span className="micro-overline">سعر الحماية للقطعة</span>
            <strong>{canShowPrice ? <MoneyValue minor={preview.value.priceFloorMinor} /> : "—"}</strong>
            <p>
              تكلفة القطعة المتوقعة: <MoneyValue minor={preview.value.unitCostMinor} /> · الإجمالي المتوقع:{" "}
              <MoneyValue minor={preview.value.plannedCostMinor} /> · حالة المعرفة:{" "}
              {knowledgeLabel[preview.value.knowledgeState] ?? preview.value.knowledgeState}
            </p>
            <p className="micro-cost-disclaimer">
              هذا حساب تقديري. ما انحفظت أي حركة مالية ولا مخزون.
            </p>
          </section>
        ) : (
          <p className="micro-field-error" role="status">
            {preview.message}
          </p>
        )}
        {message ? (
          <p
            className={message.startsWith("حُفظ") ? "micro-save-note" : "micro-field-error"}
            role="status"
          >
            {message}
          </p>
        ) : null}
        <button
          className="micro-button micro-button-primary"
          type="button"
          disabled={saving || !preview.ok}
          onClick={() => void saveEstimate()}
        >
          <Save aria-hidden="true" />
          {saving ? "جارٍ الحفظ…" : "احفظ التقدير لمراجعته لاحقًا"}
        </button>
      </section>

      <section className="micro-settings-list" aria-label="التقديرات المحفوظة">
        <div className="micro-section-title">
          <Calculator aria-hidden="true" />
          <div>
            <span className="micro-overline">للمراجعة لاحقًا</span>
            <h2>تقديراتي المحفوظة</h2>
          </div>
        </div>
        {savedEstimates.length === 0 ? (
          <p className="micro-home-quiet">
            <strong>ما في تقديرات محفوظة بعد.</strong> احسب تكلفة منتج جديد وشوف كيف بتمشي.
          </p>
        ) : (
          savedEstimates.map(estimate => (
            <article className="micro-setting-row" key={estimate.id}>
              <span className="micro-setting-icon">
                <Calculator aria-hidden="true" />
              </span>
              <div>
                <strong>{estimate.title}</strong>
                <small>
                  تقديري · سعر الحماية <MoneyValue minor={estimate.priceFloorMinor} className="micro-inline-number" /> ·{" "}
                  {formatLocalDate(estimate.updatedAt.slice(0, 10))}
                </small>
                {/* U-004: جسر التقدير → المسودة — نسخ قيم مقترحة قابلة للتعديل؛ التقدير لا يتغير
                    ولا تُنشأ أي حركة مالية، والمسودة تُحفظ عند تأكيد المالك فقط. */}
                <div className="micro-form-actions">
                  <button
                    className="micro-text-action"
                    type="button"
                    onClick={() =>
                      navigate(
                        withFrom(
                          `/orders/draft/new?intent=planned_design&estimate=${encodeURIComponent(estimate.id)}`,
                          "/tools",
                        ),
                      )
                    }
                  >
                    ابدأ مسودة من هذا التقدير
                  </button>
                </div>
              </div>
              <button
                className="micro-icon-button"
                type="button"
                aria-label={`حذف تقدير ${estimate.title}`}
                onClick={() => void removeEstimate(estimate.id)}
              >
                <Trash2 aria-hidden="true" />
              </button>
            </article>
          ))
        )}
      </section>

      <section className="micro-settings-list" aria-label="حالة الوحدات">
        <div className="micro-section-title">
          <Layers aria-hidden="true" />
          <div>
            <span className="micro-overline">ما هو مفعّل الآن</span>
            <h2>حالة الوحدات</h2>
          </div>
        </div>
        {moduleStates.map(module => (
          <article className="micro-setting-row" key={module.label} data-state={module.state}>
            <span className="micro-setting-icon">
              <Layers aria-hidden="true" />
            </span>
            <div>
              <strong>{module.label}</strong>
              <small>{moduleStateLabel[module.state]}</small>
            </div>
            <button
              className="micro-text-action"
              type="button"
              onClick={() => navigate(module.href)}
              disabled={module.state === "not_available"}
            >
              افتح <ArrowLeft aria-hidden="true" />
            </button>
          </article>
        ))}
      </section>
    </section>
  );
}
