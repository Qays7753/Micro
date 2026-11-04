/**
 * S10 (UNIT-032 — أمر b56967d8): محرر التقدير القديم — وضع توافقي صادق
 * لتقديرات ما قبل S10: يفتحها بنطاقها الأصلي حرفيًا (مواد للدفعة + عدد
 * القطع + هامش الحماية) بلا إعادة تفسير كمية قديمة ككمية وحدة (B1:
 * «لا إعادة تفسير كمية قديمة للطلب ككمية قطعة») — النواة نفسها تحسب،
 * والحفظ يحدث السجل نفسه بهويته. حساب سابق؛ يُراجع ولا يعاد تسعيره.
 */
import { PackageOpen, Save, Trash2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { MoneyValue } from "@/components/presentation/DisplayValue";
import { readMaterialSuggestions, type MaterialSuggestion } from "@/application/inventory";
import { EnglishNumberInput } from "@/components/forms/EnglishNumberInput";
import { useFormDirty } from "@/components/forms/useFormDirty";
import { Button } from "@/components/primitives";
import type { CostEstimate, DraftCostMaterial } from "@/storage/local/types";
import type { CostEstimateService } from "@/application/estimates";

type EditableMaterial = {
  uiId: string;
  name: string;
  quantity: number;
  unit: string;
  unitPriceMinor: number;
  materialId?: string | null;
};

function materialFrom(item: DraftCostMaterial, index: number): EditableMaterial {
  return {
    uiId: `lm-${index}-${Date.now()}`,
    name: item.name,
    quantity: item.quantity,
    unit: item.unit,
    unitPriceMinor: item.unitPriceMinor,
    materialId: item.materialId ?? null,
  };
}

/** R3-F2: جسر حالة القذارة والحفظ إلى حارس الصفحة الواحد — المحرر
 * التوافقي يشارك حارس التغييرات غير المحفوظة نفسه (تأكيد قبل الخروج). */
export type LegacyEditorGuardState = {
  isDirty: boolean;
  save: () => Promise<boolean>;
};

export function LegacyEstimateEditor({
  estimate,
  service,
  inventory,
  onSaved,
  onGuardStateChange,
}: {
  estimate: CostEstimate;
  service: CostEstimateService;
  /* المجموعة ٣ (عقد D5): مقترحات مواد المحرر القديم — تعبئة أرقام مقترحة
   * فقط من قارئ القراءة؛ لا حركة مخزون ولا حدث نقدي من التقدير أبدًا. */
  inventory: { overview: () => Promise<{ ok: boolean; value?: unknown }> } | null;
  onSaved: () => void;
  onGuardStateChange: (state: LegacyEditorGuardState | null) => void;
}) {
  const [title, setTitle] = useState(estimate.title);
  const [materials, setMaterials] = useState<EditableMaterial[]>(
    estimate.materialItems.length
      ? estimate.materialItems.map((item, index) => materialFrom(item, index))
      : [{ uiId: `lm-1-${Date.now()}`, name: "", quantity: 1, unit: "قطعة", unitPriceMinor: 0 }],
  );
  const [timeKnown, setTimeKnown] = useState(estimate.time !== null);
  const [timeMinutes, setTimeMinutes] = useState(estimate.time?.minutes ?? 0);
  const [timeRateMinor, setTimeRateMinor] = useState(estimate.time?.hourlyRateMinor ?? 0);
  const [quantity, setQuantity] = useState(estimate.quantity);
  const [packagingMinor, setPackagingMinor] = useState(estimate.packagingMinor);
  const [deliveryMinor, setDeliveryMinor] = useState(estimate.deliveryMinor);
  const [wasteMinor, setWasteMinor] = useState(estimate.wasteMinor);
  const [safetyBufferMinor, setSafetyBufferMinor] = useState(estimate.safetyBufferMinor);
  const [message, setMessage] = useState<{ text: string; tone: "error" | "success" } | null>(null);
  const [saving, setSaving] = useState(false);
  const [reloadToken, setReloadToken] = useState(0);

  useEffect(() => {
    setReloadToken(token => token + 1);
  }, [estimate.id]);

  void reloadToken;

  /* R3-F2: تعديلات المحرر التوافقي محروسة كتعديلات الحاسبة نفسها — الرجوع
   * أو فتح حساب آخر يمر بتأكيد لا بابتلاع صامت؛ والخط الأساس يُعاد ضبطه
   * بعد الحفظ الناجح داخل المحرر (نمط loadedToken في الحاسبة). */
  const [savedToken, setSavedToken] = useState(0);
  const isDirty = useFormDirty(
    [
      title,
      materials,
      timeKnown,
      timeMinutes,
      timeRateMinor,
      quantity,
      packagingMinor,
      deliveryMinor,
      wasteMinor,
      safetyBufferMinor,
    ],
    savedToken,
  );

  /* عقد D5: المقترحات من آخر استلام — تعبئة مقترحة بلا أي أثر. */
  const [materialSuggestions, setMaterialSuggestions] = useState<readonly MaterialSuggestion[]>([]);
  useEffect(() => {
    let active = true;
    if (!inventory) return;
    void readMaterialSuggestions(inventory as never).then(suggestions => {
      if (active && suggestions) setMaterialSuggestions(suggestions);
    });
    return () => {
      active = false;
    };
  }, [inventory]);

  async function save(): Promise<boolean> {
    setSaving(true);
    setMessage(null);
    const result = await service.update(estimate.id, {
      title,
      materialItems: materials
        .filter(material => material.name.trim() && material.unitPriceMinor > 0)
        .map(material => ({
          name: material.name.trim(),
          quantity: material.quantity,
          unit: material.unit.trim() || "قطعة",
          unitPriceMinor: material.unitPriceMinor,
          confidence: "known" as const,
          materialId: material.materialId ?? null,
        })),
      time:
        timeKnown && timeMinutes > 0 && timeRateMinor > 0
          ? { minutes: timeMinutes, hourlyRateMinor: timeRateMinor, confidence: "known" as const }
          : null,
      packagingMinor,
      deliveryMinor,
      wasteMinor,
      safetyBufferMinor,
      quantity: Math.max(1, quantity),
      note: estimate.note,
    });
    setSaving(false);
    if (!result.ok) {
      setMessage({ text: result.message, tone: "error" });
      return false;
    }
    setMessage({ text: "حُفظ تعديل الحساب السابق كما هو — بلا أي حركة مالية أو مخزون.", tone: "success" });
    setSavedToken(token => token + 1);
    onSaved();
    return true;
  }

  /* R3-F2: الجسر يُحدَّث عند انتقال القذارة فقط (لا مع كل رسم وإلا دارت
   * حلقة التحديث)؛ والحفظ يُقرأ دائمًا من أحدث إغلاق عبر المرجع. */
  const saveRef = useRef(save);
  saveRef.current = save;
  useEffect(() => {
    onGuardStateChange({ isDirty, save: () => saveRef.current() });
    return () => onGuardStateChange(null);
  }, [isDirty, onGuardStateChange]);

  const preview = service.preview({
    title,
    materialItems: materials
      .filter(material => material.name.trim() && material.unitPriceMinor > 0)
      .map(material => ({
        name: material.name.trim(),
        quantity: material.quantity,
        unit: material.unit.trim() || "قطعة",
        unitPriceMinor: material.unitPriceMinor,
        confidence: "known" as const,
        materialId: material.materialId ?? null,
      })),
    time:
      timeKnown && timeMinutes > 0 && timeRateMinor > 0
        ? { minutes: timeMinutes, hourlyRateMinor: timeRateMinor, confidence: "known" as const }
        : null,
    packagingMinor,
    deliveryMinor,
    wasteMinor,
    safetyBufferMinor,
    quantity: Math.max(1, quantity),
    note: null,
  });

  return (
    <section className="micro-form-card" aria-label="تعديل حساب سابق">
      <p className="micro-save-note" role="status">
        حساب سابق بنموذج ما قبل الأدوات الجديدة — راجع الأسعار قبل استخدامه.
      </p>
      <label className="micro-field">
        <span>عنوان الحساب</span>
        <input value={title} onChange={event => setTitle(event.target.value)} />
      </label>
      {materialSuggestions.length > 0 ? (
        <div className="micro-suggest-group" data-testid="legacy-material-suggestions">
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
                      uiId: emptyIndex >= 0 ? current[emptyIndex]!.uiId : `lm-${Date.now()}`,
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
        onClick={() =>
          setMaterials(current => [
            ...current,
            {
              uiId: `lm-${current.length + 1}-${Date.now()}`,
              name: "",
              quantity: 1,
              unit: "قطعة",
              unitPriceMinor: 0,
            },
          ])
        }
      >
        <PackageOpen aria-hidden="true" /> أضف مادة
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
      {preview.ok ? (
        <section className="micro-cost-result" data-knowledge={preview.value.knowledgeState}>
          <span className="micro-overline">سعر الحماية للقطعة</span>
          <strong>
            <MoneyValue minor={preview.value.priceFloorMinor} />
          </strong>
          <p>
            تكلفة القطعة: <MoneyValue minor={preview.value.unitCostMinor} /> · الإجمالي:{" "}
            <MoneyValue minor={preview.value.plannedCostMinor} />
          </p>
        </section>
      ) : (
        <p className="micro-field-error" role="alert">
          {preview.message}
        </p>
      )}
      {message ? (
        <p
          className={message.tone === "error" ? "micro-field-error" : "micro-save-note"}
          role={message.tone === "error" ? "alert" : "status"}
        >
          {message.text}
        </p>
      ) : null}
      <Button action="save" disabled={saving || !preview.ok} onClick={() => void save()}>
        <Save aria-hidden="true" /> {saving ? "جارٍ الحفظ…" : "احفظ التعديلات على هذا الحساب"}
      </Button>
    </section>
  );
}
