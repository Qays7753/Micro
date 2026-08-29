/* مبدأ Micro: يحفظ هذا السطح ما أدخله المالك بصدق، ويعرض المادة كخطوة قصيرة دون تحويل النقص إلى صفر. */
import { ArrowRight, ChevronLeft, CircleAlert, Pencil, Plus, Save, Trash2, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useParams } from "wouter";
import { knowledgeGapsOf, type KnowledgeGapId } from "@micro-domain/craft-order/index.js";
import { usePrototypeServices } from "@/app/PrototypeServicesContext";
import type { CostEditorInput } from "@/application/cost/costService";
import { EnglishNumberInput } from "@/components/forms/EnglishNumberInput";
import { EnglishQuantityInput } from "@/components/forms/EnglishQuantityInput";
import { useUnsavedChangesGuard } from "@/components/forms/UnsavedChangesGuard";
import { MoneyValue } from "@/components/presentation/DisplayValue";
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import type { DraftCostMaterial, OrderDraft } from "@/storage/local/types";

type EditableCostMaterial = DraftCostMaterial & { uiId: string };
type EditableCostInput = Omit<CostEditorInput, "materialItems"> & { materialItems: EditableCostMaterial[] };

const newUiId = () =>
  globalThis.crypto?.randomUUID?.() ?? `material-${Date.now()}-${Math.random().toString(16).slice(2)}`;
const newMaterial = (): EditableCostMaterial => ({
  uiId: newUiId(),
  name: "",
  quantity: 1,
  unit: "قطعة",
  unitPriceMinor: 0,
  confidence: "known",
});
const defaultInput = (quantity: number): EditableCostInput => ({
  materialItems: [],
  time: null,
  packagingMinor: 0,
  deliveryMinor: 0,
  wasteMinor: 0,
  safetyBufferMinor: 0,
  quantity,
});
const toEditableInput = (input: CostEditorInput): EditableCostInput => ({
  ...input,
  materialItems: input.materialItems.map(item => ({ ...item, uiId: newUiId() })),
});
const toServiceInput = (input: EditableCostInput): CostEditorInput => ({
  ...input,
  materialItems: input.materialItems.map(({ uiId: _uiId, ...item }) => item),
});
const knowledgeCopy = {
  known: ["تكلفة معروفة", "كل بنود الوقت والتكلفة المدخلة معروفة."],
  estimated: ["تكلفة تقديرية", "هناك بند أدخلته كتقدير، فراجع افتراضه قبل تسجيل السعر."],
  incomplete: ["تكلفة ناقصة", "وقت العمل غير مكتمل؛ لا يظهر سعر حماية كامل ولا نتيجة نهائية."],
  partial: ["تكلفة جزئية", "بعض البنود متاحة فقط؛ لا توجد نتيجة نهائية هنا."],
  stale: ["تكلفة تحتاج مراجعة", "بعض أسعار المواد لم تعد ضمن مدة الحداثة."],
  variable: ["تكلفة متغيرة", "هناك بند تقديري يحتاج مراجعة قبل تسجيل السعر."],
} as const;
/* القرار ٢٢: كل نقص يحمل علامته — إلزامي (يمنع نتيجة صادقة) أو اختياري (يحسّن الدقة). */
const knowledgeGapCopy: Record<KnowledgeGapId, string> = {
  no_cost_components: "لا بنود تكلفة مدخلة إطلاقًا — لا تُبنى نتيجة صادقة على فراغ",
  time_incomplete: "وقت العمل أو سعر الساعة غير مكتمل",
  stale_material_price: "سعر مادة خرج عن مدة الحداثة",
  estimated_item: "بند مدخل كتقدير — راجع افتراضه",
  variable_cost_source: "مصدر تكلفة تقديري — راجع مصدره",
};
const optionalCostFields = [
  { field: "packagingMinor", label: "تغليف" },
  { field: "deliveryMinor", label: "توصيل" },
  { field: "wasteMinor", label: "هدر" },
  { field: "safetyBufferMinor", label: "هامش الحماية لكل قطعة" },
] as const;
type OptionalCostField = (typeof optionalCostFields)[number]["field"];

function toInput(draft: OrderDraft, activeId: string | null): EditableCostInput {
  const record = draft.costSnapshots.find(snapshot => snapshot.id === activeId);
  if (!record) return defaultInput(draft.quantity);
  return toEditableInput({
    materialItems: record.materialItems.map(item => ({ ...item })),
    time: record.time ? { ...record.time } : null,
    packagingMinor: record.packagingMinor,
    deliveryMinor: record.deliveryMinor,
    wasteMinor: record.wasteMinor,
    safetyBufferMinor: record.safetyBufferMinor,
    quantity: draft.quantity,
  });
}

function equalCostInputs(left: CostEditorInput | null, right: CostEditorInput | null) {
  if (
    !left ||
    !right ||
    left.quantity !== right.quantity ||
    left.packagingMinor !== right.packagingMinor ||
    left.deliveryMinor !== right.deliveryMinor ||
    left.wasteMinor !== right.wasteMinor ||
    left.safetyBufferMinor !== right.safetyBufferMinor
  )
    return false;
  if (
    left.time?.minutes !== right.time?.minutes ||
    left.time?.hourlyRateMinor !== right.time?.hourlyRateMinor ||
    left.time?.confidence !== right.time?.confidence
  )
    return false;
  if (left.materialItems.length !== right.materialItems.length) return false;
  return left.materialItems.every((item, index) => {
    const other = right.materialItems[index];
    return (
      item.name === other.name &&
      item.quantity === other.quantity &&
      item.unit === other.unit &&
      item.unitPriceMinor === other.unitPriceMinor &&
      item.confidence === other.confidence
    );
  });
}

function optionalCostVisibility(input: CostEditorInput): Record<OptionalCostField, boolean> {
  return Object.fromEntries(optionalCostFields.map(({ field }) => [field, input[field] !== 0])) as Record<
    OptionalCostField,
    boolean
  >;
}

export default function CostEditor() {
  const params = useParams<{ id: string }>();
  const [, navigate] = useLocation();
  const { drafts, costs, dataVersion, notifyDataChanged } = usePrototypeServices();
  const [draft, setDraft] = useState<OrderDraft | null>(null);
  const [form, setForm] = useState<EditableCostInput | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  const [message, setMessage] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [materialSheet, setMaterialSheet] = useState<{
    index: number | null;
    draft: EditableCostMaterial;
  } | null>(null);
  const [materialSheetValidity, setMaterialSheetValidity] = useState<Record<string, boolean>>({});
  const [materialSheetMessage, setMaterialSheetMessage] = useState<string | null>(null);
  const [numericValidity, setNumericValidity] = useState<Record<string, boolean>>({});
  const [visibleOptionalCosts, setVisibleOptionalCosts] = useState<Record<OptionalCostField, boolean>>({
    packagingMinor: false,
    deliveryMinor: false,
    wasteMinor: false,
    safetyBufferMinor: false,
  });
  const initialFormRef = useRef<CostEditorInput | null>(null);

  useEffect(() => {
    let active = true;
    drafts.get(params.id).then(result => {
      if (!active) return;
      if (!result.ok || !result.value) {
        setState("error");
        return;
      }
      const loadedInput = toInput(result.value, result.value.activeCostSnapshotId);
      setDraft(result.value);
      setForm(loadedInput);
      initialFormRef.current = loadedInput;
      setVisibleOptionalCosts(optionalCostVisibility(loadedInput));
      setNumericValidity({});
      setState("ready");
    });
    return () => {
      active = false;
    };
  }, [dataVersion, drafts, params.id]);

  const preview = useMemo(() => (form ? costs.preview(toServiceInput(form)) : null), [costs, form]);
  const hasInvalidNumericInput = Object.values(numericValidity).some(isValid => !isValid);
  const isDirty = Boolean(form && initialFormRef.current && !equalCostInputs(form, initialFormRef.current));

  function setValidity(key: string, isValid: boolean) {
    setNumericValidity(current => (current[key] === isValid ? current : { ...current, [key]: isValid }));
  }
  function openMaterialSheet(index: number | null = null) {
    if (!form) return;
    const item = index === null ? newMaterial() : form.materialItems[index];
    if (!item) return;
    setMaterialSheet({ index, draft: { ...item } });
    setMaterialSheetValidity({});
    setMaterialSheetMessage(null);
  }
  function updateMaterialSheet(patch: Partial<DraftCostMaterial>) {
    setMaterialSheet(current => (current ? { ...current, draft: { ...current.draft, ...patch } } : current));
    setMaterialSheetMessage(null);
  }
  function saveMaterialFromSheet() {
    if (!materialSheet) return;
    const { draft: item, index } = materialSheet;
    const hasInvalidNumber = Object.values(materialSheetValidity).some(isValid => !isValid);
    if (
      hasInvalidNumber ||
      !item.name.trim() ||
      !item.unit.trim() ||
      item.quantity <= 0 ||
      item.unitPriceMinor < 0
    ) {
      setMaterialSheetMessage("أكمل اسم المادة والوحدة، وأدخل كمية صحيحة وتكلفة غير سالبة.");
      return;
    }
    setForm(current => {
      if (!current) return current;
      const materialItems =
        index === null
          ? [...current.materialItems, item]
          : current.materialItems.map((currentItem, itemIndex) => (itemIndex === index ? item : currentItem));
      return { ...current, materialItems };
    });
    setMaterialSheet(null);
    setMaterialSheetValidity({});
    setMaterialSheetMessage(null);
  }
  function addMaterial() {
    openMaterialSheet();
  }
  function removeMaterial(index: number, uiId: string) {
    setForm(current =>
      current
        ? { ...current, materialItems: current.materialItems.filter((_, itemIndex) => itemIndex !== index) }
        : current,
    );
    setNumericValidity(current =>
      Object.fromEntries(Object.entries(current).filter(([key]) => !key.startsWith(`material-${uiId}-`))),
    );
  }
  function revealOptionalCost(field: OptionalCostField) {
    setVisibleOptionalCosts(current => ({ ...current, [field]: true }));
  }
  function excludeOptionalCost(field: OptionalCostField) {
    setVisibleOptionalCosts(current => ({ ...current, [field]: false }));
    setForm(current => (current ? { ...current, [field]: 0 } : current));
  }

  async function saveSnapshot(): Promise<boolean> {
    if (!draft || !form) return false;
    setMessage(null);
    if (hasInvalidNumericInput) {
      setMessage("أكمل أو صحح الحقل العددي. استخدم أرقام 0–9 فقط.");
      return false;
    }
    if (!preview?.ok) {
      setMessage(preview?.message ?? "راجع المدخلات قبل الحفظ.");
      return false;
    }
    setIsSaving(true);
    const result = await costs.saveSnapshot(draft, toServiceInput(form));
    setIsSaving(false);
    if (!result.ok) {
      setMessage(result.message);
      return false;
    }
    initialFormRef.current = form;
    setDraft(result.draft!);
    notifyDataChanged();
    setMessage(
      preview.snapshot.knowledgeState === "incomplete"
        ? `تم حفظ مسودة تكلفة ناقصة ${result.draft!.costSnapshots.length} على هذا الجهاز. أضف دقائق العمل وسعر الساعة لتكتمل القراءة.`
        : `تم حفظ نسخة التكلفة ${result.draft!.costSnapshots.length} على هذا الجهاز.`,
    );
    return true;
  }

  const requestNavigation = useUnsavedChangesGuard({ isDirty, onSave: saveSnapshot });
  if (state === "loading" || !form)
    return (
      <div className="micro-route-loading" role="status">
        جارٍ فتح تكلفة المسودة…
      </div>
    );
  if (state === "error" || !draft)
    return (
      <section className="micro-page micro-not-found">
        <h1>تعذر فتح التكلفة</h1>
        <p>ارجع للمسودة ثم أعد المحاولة.</p>
        <button
          className="micro-button micro-button-primary"
          type="button"
          onClick={() => navigate("/orders")}
        >
          الطلبات
        </button>
      </section>
    );
  const status = preview?.ok
    ? knowledgeCopy[preview.snapshot.knowledgeState as keyof typeof knowledgeCopy]
    : null;
  const canShowProtectionPrice =
    preview?.ok && !["incomplete", "partial"].includes(preview.snapshot.knowledgeState);

  return (
    <section className="micro-page micro-cost-page">
      <button
        className="micro-back-button"
        type="button"
        onClick={() => requestNavigation(`/orders/draft/${draft.id}`)}
      >
        <ArrowRight aria-hidden="true" /> العودة للمسودة
      </button>
      <div className="micro-page-heading">
        <span className="micro-overline">نسخة تكلفة محفوظة</span>
        <h1>{draft.itemName || "وصف القطعة"}</h1>
        <p>أدخل ما تعرفه. الصفر ليس بديلًا عن وقت أو تكلفة لا تعرفها.</p>
      </div>
      {preview?.ok ? (
        <section className="micro-cost-result" data-knowledge={preview.snapshot.knowledgeState}>
          <span>سعر الحماية لكل قطعة (د.أ)</span>
          <strong>
            {canShowProtectionPrice ? (
              <MoneyValue minor={preview.snapshot.priceFloorMinor} />
            ) : (
              "غير متاح بعد"
            )}
          </strong>
          <small>
            {canShowProtectionPrice ? (
              <>
                تكلفة القطعة{" "}
                <MoneyValue minor={preview.snapshot.unitCostMinor} className="micro-inline-number" /> + هامش
                الحماية الذي أدخلته.
              </>
            ) : (
              "هذه قراءة جزئية من البنود المعروفة؛ أكمل المدة وسعر الساعة لقراءة سعر حماية أدق."
            )}
          </small>
          <div>
            <b>{status?.[0]}</b>
            <p>{status?.[1]}</p>
          </div>
          {knowledgeGapsOf(preview.snapshot).length > 0 ? (
            <ul className="micro-knowledge-gaps" aria-label="نقاط المعرفة الناقصة كاملة">
              {knowledgeGapsOf(preview.snapshot).map(gap => (
                <li key={gap.id} data-mandatory={gap.mandatory}>
                  <b>{gap.mandatory ? "إلزامي" : "اختياري"}</b>
                  <span>{knowledgeGapCopy[gap.id]}</span>
                </li>
              ))}
            </ul>
          ) : null}
        </section>
      ) : (
        <p className="micro-field-error" role="alert">
          {preview?.message ?? "راجع المدخلات."}
        </p>
      )}
      <section className="micro-form-card">
        <div className="micro-cost-section-heading">
          <div>
            <h2>المواد</h2>
            <p>أضف بندًا قصيرًا ثم راجع ملخصه؛ المادة الموجودة ليست مجانية.</p>
          </div>
          <button className="micro-icon-button" type="button" aria-label="إضافة مادة" onClick={addMaterial}>
            <Plus aria-hidden="true" />
          </button>
        </div>
        {form.materialItems.length === 0 ? (
          <p className="micro-empty-inline">
            لم تضف مادة بعد. قد تبقى التكلفة ناقصة إن لم تدخل وقت العمل وبنودًا مؤثرة.
          </p>
        ) : (
          <div className="micro-material-summary-list">
            {form.materialItems.map((item, index) => (
              <div className="micro-material-summary-row" key={item.uiId}>
                <button
                  className="micro-material-summary"
                  type="button"
                  onClick={() => openMaterialSheet(index)}
                  aria-label={`تعديل مادة ${item.name || index + 1}`}
                >
                  <span className="micro-draft-symbol">
                    <Pencil aria-hidden="true" />
                  </span>
                  <span>
                    <strong>{item.name || "مادة بلا اسم"}</strong>
                    <small>
                      {item.quantity} {item.unit || "وحدة"} · تكلفة الوحدة{" "}
                      <MoneyValue minor={item.unitPriceMinor} className="micro-inline-number" /> ·{" "}
                      {item.confidence === "estimated" ? "تقديري" : "مؤكد"}
                    </small>
                  </span>
                  <ChevronLeft aria-hidden="true" />
                </button>
                <button
                  className="micro-delete-row"
                  type="button"
                  aria-label={`حذف مادة ${item.name || index + 1}`}
                  onClick={() => removeMaterial(index, item.uiId)}
                >
                  <Trash2 aria-hidden="true" />
                </button>
              </div>
            ))}
          </div>
        )}
      </section>
      <MaterialSheet
        value={materialSheet}
        message={materialSheetMessage}
        validity={materialSheetValidity}
        onOpenChange={open => {
          if (!open) {
            setMaterialSheet(null);
            setMaterialSheetMessage(null);
            setMaterialSheetValidity({});
          }
        }}
        onChange={updateMaterialSheet}
        onValidityChange={(key, isValid) =>
          setMaterialSheetValidity(current => ({ ...current, [key]: isValid }))
        }
        onSave={saveMaterialFromSheet}
      />
      <section className="micro-form-card">
        <div className="micro-cost-section-heading">
          <div>
            <h2>وقت العمل</h2>
            <p>إذا كنت لا تعرف المدة أو سعر الساعة، اترك الوقت غير مكتمل. يمكنك إضافة تقدير واضح لاحقًا.</p>
          </div>
          <button
            className="micro-text-action"
            type="button"
            onClick={() =>
              setForm(current =>
                current
                  ? {
                      ...current,
                      time: current.time
                        ? null
                        : { minutes: null, hourlyRateMinor: null, confidence: "estimated" },
                    }
                  : current,
              )
            }
          >
            {form.time ? "اترك الوقت غير مكتمل" : "إضافة وقت"}
          </button>
        </div>
        {form.time ? (
          <div className="micro-field-grid">
            <label className="micro-field">
              <span>
                الدقائق <small>أرقام 0–9</small>
              </span>
              <EnglishNumberInput
                value={form.time.minutes}
                kind="integer"
                min="0"
                allowEmpty
                aria-label="دقائق الوقت بالأرقام 0–9"
                onNumericChange={minutes =>
                  setForm(current =>
                    current?.time ? { ...current, time: { ...current.time, minutes } } : current,
                  )
                }
                onEmptyChange={() =>
                  setForm(current =>
                    current?.time ? { ...current, time: { ...current.time, minutes: null } } : current,
                  )
                }
                onTextValidityChange={isValid => setValidity("time-minutes", isValid)}
              />
            </label>
            <label className="micro-field">
              <span>
                سعر الساعة (د.أ) <small>أرقام 0–9</small>
              </span>
              <EnglishNumberInput
                value={form.time.hourlyRateMinor}
                kind="money"
                min="0"
                allowEmpty
                aria-label="سعر الساعة بالأرقام 0–9"
                onNumericChange={hourlyRateMinor =>
                  setForm(current =>
                    current?.time ? { ...current, time: { ...current.time, hourlyRateMinor } } : current,
                  )
                }
                onEmptyChange={() =>
                  setForm(current =>
                    current?.time
                      ? { ...current, time: { ...current.time, hourlyRateMinor: null } }
                      : current,
                  )
                }
                onTextValidityChange={isValid => setValidity("time-rate", isValid)}
              />
            </label>
            <label className="micro-field">
              <span>حالة الرقم</span>
              <select
                value={form.time.confidence}
                onChange={event =>
                  setForm(current =>
                    current?.time
                      ? {
                          ...current,
                          time: {
                            ...current.time,
                            confidence: event.target.value as DraftCostMaterial["confidence"],
                          },
                        }
                      : current,
                  )
                }
              >
                <option value="known">مؤكد</option>
                <option value="estimated">تقديري</option>
              </select>
            </label>
          </div>
        ) : (
          <p className="micro-missing-time">
            <CircleAlert aria-hidden="true" /> وقت العمل غير معروف؛ ستبقى النتيجة ناقصة حتى تسجله.
          </p>
        )}
      </section>
      <section className="micro-form-card">
        <div className="micro-cost-section-heading">
          <div>
            <h2>بنود أخرى وحماية السعر</h2>
            <p>أضف بندًا فقط عندما ينطبق؛ البند غير المضاف لا يظهر كصفر مدخل أو تكلفة مجهولة.</p>
          </div>
        </div>
        <div className="micro-optional-cost-actions">
          {optionalCostFields
            .filter(({ field }) => !visibleOptionalCosts[field])
            .map(({ field, label }) => (
              <button
                className="micro-button micro-button-secondary"
                type="button"
                key={field}
                onClick={() => revealOptionalCost(field)}
              >
                أضف {label}
              </button>
            ))}
        </div>
        <div className="micro-field-grid">
          {optionalCostFields
            .filter(({ field }) => visibleOptionalCosts[field])
            .map(({ field, label }) => (
              <div className="micro-optional-cost-field" key={field}>
                <label className="micro-field">
                  <span>
                    {label} (د.أ) <small>أرقام 0–9</small>
                  </span>
                  <EnglishNumberInput
                    value={form[field]}
                    kind="money"
                    min="0"
                    aria-label={`${label} بالأرقام 0–9`}
                    onNumericChange={value =>
                      setForm(current => (current ? { ...current, [field]: value } : current))
                    }
                    onTextValidityChange={isValid => setValidity(field, isValid)}
                  />
                </label>
                <button
                  className="micro-text-action"
                  type="button"
                  onClick={() => excludeOptionalCost(field)}
                >
                  لا ينطبق الآن — احتسبه صفرًا
                </button>
              </div>
            ))}
        </div>
        {optionalCostFields.every(({ field }) => !visibleOptionalCosts[field]) ? (
          <p className="micro-empty-inline">
            لا توجد بنود إضافية معلنة الآن. هذا لا يعني أن Micro افترض تكلفة مجهولة بصفر.
          </p>
        ) : null}
      </section>
      {message ? (
        <p
          className={message.startsWith("تم ") ? "micro-save-note" : "micro-field-error"}
          role={message.startsWith("تم ") ? "status" : "alert"}
        >
          {message}
        </p>
      ) : null}
      {preview?.ok && preview.snapshot.knowledgeState === "incomplete" ? (
        <p className="micro-cost-save-guidance">
          يمكنك حفظ ما تعرفه الآن كمسودة ناقصة. أضف دقائق العمل وسعر الساعة لاحقًا لتكتمل قراءة التكلفة؛ لا
          تدخل صفرًا بدل المجهول.
        </p>
      ) : null}
      <div className="micro-form-actions">
        <button
          className="micro-button micro-button-primary micro-save-cost"
          type="button"
          disabled={isSaving || hasInvalidNumericInput || !preview?.ok}
          onClick={() => {
            void saveSnapshot();
          }}
        >
          <Save aria-hidden="true" />
          {isSaving
            ? "جارٍ حفظ النسخة…"
            : preview?.ok && preview.snapshot.knowledgeState === "incomplete"
              ? "حفظ مسودة تكلفة ناقصة"
              : "حفظ نسخة التكلفة"}
        </button>
        {draft.activeCostSnapshotId ? (
          <button
            className="micro-button micro-button-secondary"
            type="button"
            onClick={() => requestNavigation(`/orders/draft/${draft.id}/agreement`)}
          >
            تسجيل الاتفاق
          </button>
        ) : null}
      </div>
      <p className="micro-cost-disclaimer">
        هذا <strong>سعر حماية</strong> من التكلفة المدخلة، لا سعر سوق ولا قرار بقبول الطلب. الاتفاق والعربون
        لا يُسجلان هنا.
      </p>
    </section>
  );
}

type MaterialSheetProps = {
  value: { index: number | null; draft: EditableCostMaterial } | null;
  message: string | null;
  validity: Record<string, boolean>;
  onOpenChange: (open: boolean) => void;
  onChange: (patch: Partial<DraftCostMaterial>) => void;
  onValidityChange: (key: string, isValid: boolean) => void;
  onSave: () => void;
};

function MaterialSheet({
  value,
  message,
  validity,
  onOpenChange,
  onChange,
  onValidityChange,
  onSave,
}: MaterialSheetProps) {
  return (
    <Drawer open={Boolean(value)} onOpenChange={onOpenChange} direction="bottom">
      <DrawerContent className="micro-bottom-sheet" dir="rtl">
        {value ? (
          <>
            <DrawerHeader className="micro-sheet-header">
              <div className="micro-sheet-title-row">
                <div>
                  <DrawerTitle className="micro-sheet-title">
                    {value.index === null ? "أضف بند مادة" : "عدّل بند المادة"}
                  </DrawerTitle>
                  <DrawerDescription className="micro-sheet-description">
                    أدخل الحد الأدنى للمادة ثم عد إلى ملخص التكلفة. لا تتحول الكمية غير الصحيحة إلى رقم محفوظ.
                  </DrawerDescription>
                </div>
                <DrawerClose asChild>
                  <button className="micro-icon-button" type="button" aria-label="إغلاق إضافة المادة">
                    <X aria-hidden="true" />
                  </button>
                </DrawerClose>
              </div>
            </DrawerHeader>
            <div className="micro-sheet-form">
              <label className="micro-field">
                <span>المادة</span>
                <input
                  autoFocus
                  value={value.draft.name}
                  onChange={event => onChange({ name: event.target.value })}
                />
              </label>
              <label className="micro-field">
                <span>
                  الكمية <small>أرقام 0–9 وحتى 3 منازل</small>
                </span>
                <EnglishQuantityInput
                  valueMilli={Math.round(value.draft.quantity * 1000)}
                  min="0"
                  aria-label="كمية المادة بالأرقام 0–9"
                  aria-invalid={validity.quantity === false}
                  onMilliChange={quantityMilli => onChange({ quantity: quantityMilli / 1000 })}
                  onTextValidityChange={isValid => onValidityChange("quantity", isValid)}
                />
              </label>
              <label className="micro-field">
                <span>الوحدة</span>
                <input value={value.draft.unit} onChange={event => onChange({ unit: event.target.value })} />
              </label>
              <label className="micro-field">
                <span>
                  تكلفة الوحدة (د.أ) <small>أرقام 0–9</small>
                </span>
                <EnglishNumberInput
                  value={value.draft.unitPriceMinor}
                  kind="money"
                  min="0"
                  aria-label="تكلفة وحدة المادة بالأرقام 0–9"
                  aria-invalid={validity.price === false}
                  onNumericChange={unitPriceMinor => onChange({ unitPriceMinor })}
                  onTextValidityChange={isValid => onValidityChange("price", isValid)}
                />
              </label>
              <label className="micro-field">
                <span>حالة الرقم</span>
                <select
                  value={value.draft.confidence}
                  onChange={event =>
                    onChange({ confidence: event.target.value as DraftCostMaterial["confidence"] })
                  }
                >
                  <option value="known">مؤكد</option>
                  <option value="estimated">تقديري</option>
                </select>
              </label>
              {message ? (
                <p className="micro-field-error" role="alert">
                  {message}
                </p>
              ) : null}
            </div>
            <DrawerFooter className="micro-sheet-footer">
              <DrawerClose asChild>
                <button className="micro-button micro-button-secondary" type="button">
                  إلغاء
                </button>
              </DrawerClose>
              <button className="micro-button micro-button-primary" type="button" onClick={onSave}>
                حفظ بند المادة
              </button>
            </DrawerFooter>
          </>
        ) : null}
      </DrawerContent>
    </Drawer>
  );
}
