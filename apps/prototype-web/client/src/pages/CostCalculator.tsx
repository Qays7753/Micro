/**
 * المجموعة ٣ (Scope A — §7): حاسبة التكلفة كأداة تفكير مستقلة بمسار عميق كامل.
 * تعمل بلا طلب وبلا مسودة وبلا مخزون وبلا حدث مالي؛ الحفظ والتعديل يكتبان تقديرًا
 * فقط، وبدء المسودة يبقى جسرًا معلنًا (U-004) بقيم مقترحة قابلة للتعديل.
 * التعديل يفتح بـ ?estimate=<id> من صفحة التقدير — الأصل لا يتغير حتى الحفظ.
 */
import { ArrowRight, Calculator, PackageOpen, Save, Trash2 } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useSearch } from "wouter";
import { useReturnPath } from "@/app/useReturnNavigation";
import { withFrom } from "@/app/navigationContract";
import { usePrototypeServices } from "@/app/PrototypeServicesContext";
import { EnglishNumberInput } from "@/components/forms/EnglishNumberInput";
import { useFormDirty } from "@/components/forms/useFormDirty";
import { useUnsavedChangesGuard } from "@/components/forms/UnsavedChangesGuard";
import { MoneyValue } from "@/components/presentation/DisplayValue";
import type { CostEstimateInput } from "@/application/estimates/costEstimateService";
import type { CostEstimate } from "@/storage/local/types";
import type { MaterialSuggestion } from "@/components/cost/MaterialSheet";
import { readMaterialSuggestions } from "@/application/inventory/materialSuggestions";

type EditableMaterial = {
  uiId: string;
  name: string;
  quantity: number;
  unit: string;
  unitPriceMinor: number;
  /* المجموعة ٣ (عقد D2): هوية المادة من المخزون إن اختيرت — هوية ربط فقط. */
  materialId?: string | null;
};

type CalculatorState = { phase: "loading" } | { phase: "ready" };

const knowledgeLabel: Record<string, string> = {
  known: "معروفة",
  estimated: "تقديرية",
  partial: "جزئية",
  incomplete: "ناقصة",
  stale: "متقادمة",
  variable: "متغيرة",
};

/* معرّف التقدير المطلوب تعديله يُقرأ دفاعيًا من البحث (useSearch — المسار الحقيقي بلا
 * استعلام)؛ غير الصالح يُهمل بهدوء. */
function estimateIdFromSearch(search: string): string | null {
  const value = new URLSearchParams(search).get("estimate");
  return value && /^[A-Za-z0-9_-]{1,64}$/.test(value) ? value : null;
}

function emptyMaterial(index: number): EditableMaterial {
  return {
    uiId: `m-${index}-${Date.now()}`,
    name: "",
    quantity: 1,
    unit: "قطعة",
    unitPriceMinor: 0,
  };
}

function materialInputsOf(materials: readonly EditableMaterial[]): CostEstimateInput["materialItems"] {
  return materials
    .filter(material => material.name.trim() && material.unitPriceMinor > 0)
    .map(material => ({
      name: material.name.trim(),
      quantity: material.quantity,
      unit: material.unit.trim() || "قطعة",
      unitPriceMinor: material.unitPriceMinor,
      confidence: "known" as const,
      /* المجموعة ٣ (عقد D2): الهوية تُحفظ مع التقدير — بلا رقم حي ولا أثر مخزون. */
      materialId: material.materialId ?? null,
    }));
}

function timeInputOf(timeKnown: boolean, minutes: number, rateMinor: number) {
  return timeKnown && minutes > 0 && rateMinor > 0
    ? { minutes, hourlyRateMinor: rateMinor, confidence: "known" as const }
    : null;
}

function fillFormFromEstimate(estimate: CostEstimate): {
  title: string;
  materials: EditableMaterial[];
  timeKnown: boolean;
  timeMinutes: number;
  timeRateMinor: number;
  quantity: number;
  safetyBufferMinor: number;
  packagingMinor: number;
  deliveryMinor: number;
  wasteMinor: number;
} {
  return {
    title: estimate.title,
    materials: estimate.materialItems.map((item, index) => ({
      uiId: `m-${index}-${Date.now()}`,
      name: item.name,
      quantity: item.quantity,
      unit: item.unit,
      unitPriceMinor: item.unitPriceMinor,
    })),
    timeKnown: estimate.time !== null,
    timeMinutes: estimate.time?.minutes ?? 0,
    timeRateMinor: estimate.time?.hourlyRateMinor ?? 0,
    quantity: estimate.quantity,
    safetyBufferMinor: estimate.safetyBufferMinor,
    packagingMinor: estimate.packagingMinor,
    deliveryMinor: estimate.deliveryMinor,
    wasteMinor: estimate.wasteMinor,
  };
}

export default function CostCalculator() {
  const [location, navigate] = useLocation();
  /* المجموعة ٣ (§7): الحاسبة مسار عميق — الرجوع للمصدر (?from) أو أدواتي بديلًا. */
  const returnPath = useReturnPath();
  const { dataVersion, costEstimates, inventory, notifyDataChanged } = usePrototypeServices();
  /* المجموعة ٣ (عقد D5): مقترحات مواد الحاسبة — نفس دليل محرر التكلفة المشترك:
   * تعبئة أرقام مقترحة فقط؛ لا حركة مخزون ولا حدث نقدي من التقدير أبدًا. */
  const [materialSuggestions, setMaterialSuggestions] = useState<readonly MaterialSuggestion[]>([]);
  useEffect(() => {
    let active = true;
    void readMaterialSuggestions(inventory).then(suggestions => {
      if (active && suggestions) setMaterialSuggestions(suggestions);
    });
    return () => {
      active = false;
    };
  }, [inventory, dataVersion]);
  /* و٥-ب (مجموعة ٣): معامل التقدير يُقرأ من useSearch — المسار الحقيقي بلا استعلام. */
  const search = useSearch();
  const requestedEstimateId = estimateIdFromSearch(search);
  const [state, setState] = useState<CalculatorState>(
    requestedEstimateId ? { phase: "loading" } : { phase: "ready" },
  );
  const [editingId, setEditingId] = useState<string | null>(requestedEstimateId);
  const [estimateMissing, setEstimateMissing] = useState(false);
  const [title, setTitle] = useState("");
  const [materials, setMaterials] = useState<EditableMaterial[]>([emptyMaterial(1)]);
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
  /* بعد الحفظ: المسار يرتبط بالمعرّف نفسه — التعديل اللاحق يحدّث ولا يكرر تقديرًا. */
  const [savedId, setSavedId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [loadedToken, setLoadedToken] = useState(0);

  /* وضع التعديل: يُحمّل التقدير مرة واحدة — الأصل لا يتغير حتى يقرر المالك الحفظ. */
  useEffect(() => {
    if (!requestedEstimateId) return;
    let active = true;
    void costEstimates.get(requestedEstimateId).then(result => {
      if (!active) return;
      if (!result.ok || !result.value) {
        setEstimateMissing(true);
        setState({ phase: "ready" });
        return;
      }
      const form = fillFormFromEstimate(result.value);
      setTitle(form.title);
      setMaterials(form.materials.length ? form.materials : [emptyMaterial(1)]);
      setTimeKnown(form.timeKnown);
      setTimeMinutes(form.timeMinutes);
      setTimeRateMinor(form.timeRateMinor);
      setQuantity(form.quantity);
      setSafetyBufferMinor(form.safetyBufferMinor);
      setPackagingMinor(form.packagingMinor);
      setDeliveryMinor(form.deliveryMinor);
      setWasteMinor(form.wasteMinor);
      setLoadedToken(token => token + 1);
      setState({ phase: "ready" });
    });
    return () => {
      active = false;
    };
  }, [costEstimates, requestedEstimateId, dataVersion]);

  const input = useMemo<CostEstimateInput>(
    () => ({
      title,
      materialItems: materialInputsOf(materials),
      time: timeInputOf(timeKnown, timeMinutes, timeRateMinor),
      packagingMinor,
      deliveryMinor,
      wasteMinor,
      safetyBufferMinor,
      quantity: Math.max(1, Math.round(quantity)),
      note: null,
    }),
    [
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

  const preview = useMemo(() => costEstimates.preview(input), [costEstimates, input]);

  /* §7.2: الشك معلن لا صفر مضلل — مادة بلا سعر ووقت غير مُدخل يبقيان «غير محدد بعد». */
  const namedMaterialWithoutPrice = materials.some(
    material => material.name.trim() && material.unitPriceMinor <= 0,
  );
  const canShowPrice = preview.ok && !["incomplete", "partial"].includes(preview.value.knowledgeState);

  const isDirty = useFormDirty(
    [
      title,
      materials,
      timeKnown,
      timeMinutes,
      timeRateMinor,
      quantity,
      safetyBufferMinor,
      packagingMinor,
      deliveryMinor,
      wasteMinor,
    ],
    loadedToken,
  );
  const requestNavigation = useUnsavedChangesGuard({
    isDirty,
    onSave: () => save(),
  });

  async function save(): Promise<boolean> {
    if (!preview.ok) {
      setMessage(preview.message);
      return false;
    }
    setSaving(true);
    setMessage(null);
    const result = editingId ? await costEstimates.update(editingId, input) : await costEstimates.save(input);
    setSaving(false);
    if (!result.ok) {
      setMessage(result.message);
      return false;
    }
    notifyDataChanged();
    setEditingId(result.value.id);
    setSavedId(result.value.id);
    setLoadedToken(token => token + 1);
    setMessage(
      editingId
        ? "حُفظ تعديل التقدير كما هو — بلا أي حركة مالية أو مخزون."
        : "حُفظ التقدير لمراجعته لاحقًا — لم تُنشأ أي حركة مالية ولا مخزون.",
    );
    return true;
  }

  if (state.phase === "loading")
    return (
      <div className="micro-route-loading" role="status">
        جارٍ فتح التقدير…
      </div>
    );

  return (
    <section className="micro-page micro-tools-page">
      <button className="micro-back-button" type="button" onClick={() => requestNavigation(returnPath)}>
        <ArrowRight aria-hidden="true" /> أدواتي
      </button>
      <div className="micro-page-heading">
        <span className="micro-overline">أداة مستقلة</span>
        <h1>حاسبة التكلفة والسعر</h1>
        <p>احسب قبل أن تلتزم — بلا طلب وبلا مخزون وبلا تسجيل منتج، والنتيجة تقديرية دومًا.</p>
      </div>

      <section className="micro-decision-card" aria-label="قاعدة الأداة">
        <span>قاعدة هذه الأداة</span>
        <strong>هذا حساب تقديري. ما انحفظت أي حركة مالية ولا مخزون.</strong>
        <p>الحاسبة لا تمس الكاش ولا الأرصدة ولا التقارير. قرار التسجيل يبقى فعلًا منفصلًا ومقصودًا.</p>
      </section>

      {estimateMissing ? (
        <p className="micro-save-note" role="status">
          لم نجد التقدير المطلوب تعديله (قد حُذف)؛ فُتحت الحاسبة فارغة ولم يتغير شيء.
        </p>
      ) : null}

      <section className="micro-form-card" aria-label="حاسبة التكلفة">
        <div className="micro-section-title">
          <Calculator aria-hidden="true" />
          <div>
            <span className="micro-overline">{editingId ? "تعديل تقدير محفوظ" : "تقدير جديد"}</span>
            <h2>{editingId ? "عدّل تقديرك" : "احسب تكلفة وسعر حماية"}</h2>
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
        {materialSuggestions.length > 0 ? (
          <div className="micro-suggest-group" data-testid="calculator-material-suggestions">
            <small className="micro-suggest-group-label">مقترحات من موادك — السعر من آخر استلام</small>
            <div className="micro-suggest-chip-row">
              {materialSuggestions.map(suggestion => (
                <button
                  key={suggestion.materialId}
                  className="micro-suggest-chip"
                  type="button"
                  onClick={() => {
                    setMaterials(current => {
                      const emptyIndex = current.findIndex(item => !item.name.trim());
                      const filled: EditableMaterial = {
                        uiId: emptyIndex >= 0 ? current[emptyIndex]!.uiId : `m-${Date.now()}`,
                        name: suggestion.name,
                        quantity: 1,
                        unit: suggestion.unit,
                        unitPriceMinor: suggestion.unitPriceMinor ?? 0,
                        materialId: suggestion.materialId,
                      };
                      if (emptyIndex >= 0)
                        return current.map((item, index) => (index === emptyIndex ? filled : item));
                      return [...current, filled];
                    });
                  }}
                >
                  {suggestion.name}
                  {suggestion.unitPriceMinor !== null ? " · بآخر سعر استلام" : " · بلا سعر بعد"}
                </button>
              ))}
            </div>
          </div>
        ) : null}
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
                    current.map(item => (item.uiId === material.uiId ? { ...item, quantity: value } : item)),
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
                onClick={() => setMaterials(current => current.filter(item => item.uiId !== material.uiId))}
              >
                <Trash2 aria-hidden="true" /> احذف المادة
              </button>
            ) : null}
          </div>
        ))}
        <button
          className="micro-text-action"
          type="button"
          onClick={() => setMaterials(current => [...current, emptyMaterial(current.length + 1)])}
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
            {namedMaterialWithoutPrice ? (
              <p className="micro-cost-disclaimer">
                مستثنى من الحساب (مسماة بلا سعر — «غير محدد بعد» لا صفر):{" "}
                {materials
                  .filter(material => material.name.trim() && material.unitPriceMinor <= 0)
                  .map(material => material.name.trim())
                  .join("، ")}
                .
              </p>
            ) : null}
            {!timeKnown ? (
              <p className="micro-cost-disclaimer">وقت العمل غير مُدخل — النتيجة بلا أجر وقتك.</p>
            ) : null}
            <p className="micro-cost-disclaimer">هذا حساب تقديري. ما انحفظت أي حركة مالية ولا مخزون.</p>
          </section>
        ) : (
          <p className="micro-field-error" role="status">
            {preview.message}
          </p>
        )}
        {message ? (
          <p className={message.startsWith("حُفظ") ? "micro-save-note" : "micro-field-error"} role="status">
            {message}
          </p>
        ) : null}
        <button
          className="micro-button micro-button-primary"
          type="button"
          disabled={saving || !preview.ok}
          onClick={() => void save()}
        >
          <Save aria-hidden="true" />
          {saving
            ? "جارٍ الحفظ…"
            : editingId
              ? "احفظ التعديلات على هذا التقدير"
              : "احفظ التقدير لمراجعته لاحقًا"}
        </button>
      </section>

      {savedId ? (
        <section className="micro-form-card" aria-label="الخطوة التالية بعد الحفظ">
          <div className="micro-section-title">
            <Calculator aria-hidden="true" />
            <div>
              <span className="micro-overline">محفوظ — بلا أثر مالي</span>
              <h2>شو بدك تعمل بالتقدير؟</h2>
            </div>
          </div>
          <div className="micro-form-actions">
            <button
              className="micro-button micro-button-primary"
              type="button"
              onClick={() => navigate(withFrom(`/tools/estimate/${encodeURIComponent(savedId)}`, "/tools"))}
            >
              افتح التقدير
            </button>
            <button
              className="micro-button micro-button-secondary"
              type="button"
              onClick={() =>
                navigate(
                  withFrom(
                    `/orders/draft/new?intent=planned_design&estimate=${encodeURIComponent(savedId)}`,
                    /* رحلة §12: بدء مسودة من الحاسبة يعود إلى التقدير نفسه عند الرجوع. */
                    `/tools/estimate/${encodeURIComponent(savedId)}`,
                  ),
                )
              }
            >
              ابدأ مسودة من هذا التقدير
            </button>
          </div>
          <p className="micro-home-quiet">
            يمكن المتابعة بالحساب والتعديل — الحفظ التالي يحدّث التقدير نفسه ولا يكرره.
          </p>
        </section>
      ) : null}

      {editingId ? (
        <button
          className="micro-text-action"
          type="button"
          onClick={() => navigate(withFrom(`/tools/estimate/${encodeURIComponent(editingId)}`, returnPath))}
        >
          <ArrowRight aria-hidden="true" /> عرض صفحة التقدير
        </button>
      ) : null}

      <p className="micro-local-truth">حسابك يبقى على هذا الجهاز — الحاسبة لا تكتب أي سجل مالي أو مخزون.</p>
    </section>
  );
}
