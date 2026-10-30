/* مبدأ Micro: يحفظ هذا السطح ما أدخله المالك بصدق، ويعرض المادة كخطوة قصيرة دون تحويل النقص إلى صفر.
 * S09 (UNIT-008/SH-13 — أمر ad133bae القسم ٢): مسودة الطلبات المجمعة تدخل تكلفة
 * كل مجموعة بأساس وحدتها الواحدة (مكونات الوحدة فقط) ويوسّعه التوسيع القانوني
 * الواحد قبل النواة الواحدة — التكرار يُضرب مرة واحدة لا أكثر، ومستويات الطلب
 * (الوقت/التغليف/التوصيل/الهدر/الهامش) تبقى على نطاق الطلب كما في العقد القائم.
 * ومسودة نموذج عابرة (order_cost) تستعيد مدخلات التكلفة بعد التحديث بلا فقد صامت. */
import { ArrowRight, ChevronLeft, CircleAlert, Pencil, Plus, Save, Trash2 } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useParams } from "wouter";
import { knowledgeGapsOf, type KnowledgeGapId } from "@micro-domain/craft-order/index.js";
import { usePrototypeServices } from "@/app/PrototypeServicesContext";
import type { CostEditorInput, GroupedCostEditorInput } from "@/application/cost";
import { EnglishNumberInput } from "@/components/forms/EnglishNumberInput";
import { FormDraftRestoreBanner } from "@/components/forms/FormDraftRestoreBanner";
import { useFormDraft } from "@/components/forms/useFormDraft";
import { useUnsavedChangesGuard } from "@/components/forms/UnsavedChangesGuard";
import { MaterialSheet } from "@/components/cost/MaterialSheet";
import { readMaterialSuggestions, type MaterialSuggestion } from "@/application/inventory";
import { MoneyValue } from "@/components/presentation/DisplayValue";
import type { DraftCostMaterial, DraftCostSnapshot, DraftCostTime, OrderDraft } from "@/storage/local/types";

import { Button, FeedbackMessage, FeedbackNote } from "@/components/primitives";

type EditableCostMaterial = DraftCostMaterial & { uiId: string };
type EditableCostInput = Omit<CostEditorInput, "materialItems"> & { materialItems: EditableCostMaterial[] };
/* S09: أساس المجموعة القابل للتحرير — مكونات الوحدة الواحدة فقط؛ التكرار معروض
 * من مجموعة المسودة ولا يُحرَّر هنا (يُحرَّر في المسودة)، والتوسيع يتم مرة واحدة
 * عند الحساب لا في الواجهة. */
type EditableGroupBasis = { groupId: string; unitMaterialItems: EditableCostMaterial[] };
type EditableGroupedInput = {
  groupBasis: EditableGroupBasis[];
  time: DraftCostTime | null;
  packagingMinor: number;
  deliveryMinor: number;
  wasteMinor: number;
  safetyBufferMinor: number;
};
/* S09: مظروف مسودة النموذج — كل مدخلات التكلفة الحالية (مسطحًا أو مجموعات). */
type CostRecoveryValues = {
  mode: "flat" | "grouped";
  flat: CostEditorInput | null;
  grouped: { groupBasis: EditableGroupBasis[]; time: DraftCostTime | null } | null;
  packagingMinor: number;
  deliveryMinor: number;
  wasteMinor: number;
  safetyBufferMinor: number;
};

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
/* §10.2: حالة المعرفة تسمية على الوجه — الشرح محذوف؛ النواقص تحمل علاماتها أدناه. */
const knowledgeCopy = {
  known: "تكلفة معروفة",
  estimated: "تكلفة تقديرية",
  incomplete: "تكلفة ناقصة",
  partial: "تكلفة جزئية",
  stale: "تكلفة تحتاج مراجعة",
  variable: "تكلفة متغيرة",
} as const;
/* القرار ٢٢: كل نقص يحمل علامته — إلزامي (يمنع نتيجة صادقة) أو اختياري (يحسّن الدقة). */
const knowledgeGapCopy: Record<KnowledgeGapId, string> = {
  no_cost_components: "لا بنود تكلفة مدخلة",
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
/* S09: بذور أساس المجموعات من مسودة الطلب ولقطة التكلفة النشطة إن وُجدت —
 * مكونات الوحدة كما حُفظت؛ المجموعة الغائبة من اللقطة تبدأ فارغة لا مصطنعة. */
function toGroupedInput(draft: OrderDraft, activeId: string | null): EditableGroupedInput {
  const record = draft.costSnapshots.find(snapshot => snapshot.id === activeId);
  const savedBasis = record?.groupBasis ?? null;
  const groups = draft.groups ?? [];
  return {
    groupBasis: groups.map(group => ({
      groupId: group.id,
      unitMaterialItems:
        savedBasis
          ?.find(basis => basis.groupId === group.id)
          ?.unitMaterialItems.map(item => ({ ...item, uiId: newUiId() })) ?? [],
    })),
    time: record?.time ? { ...record.time } : null,
    packagingMinor: record?.packagingMinor ?? 0,
    deliveryMinor: record?.deliveryMinor ?? 0,
    wasteMinor: record?.wasteMinor ?? 0,
    safetyBufferMinor: record?.safetyBufferMinor ?? 0,
  };
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
function equalMaterials(left: readonly EditableCostMaterial[], right: readonly EditableCostMaterial[]) {
  if (left.length !== right.length) return false;
  return left.every((item, index) => {
    const other = right[index];
    return (
      item.name === other.name &&
      item.quantity === other.quantity &&
      item.unit === other.unit &&
      item.unitPriceMinor === other.unitPriceMinor &&
      item.confidence === other.confidence
    );
  });
}
/* S09: مقارنة أساس المجموعات بالمعنى لا بهوية واجهة البنود. */
function equalGroupedInputs(left: EditableGroupedInput | null, right: EditableGroupedInput | null) {
  if (!left || !right) return false;
  if (
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
  if (left.groupBasis.length !== right.groupBasis.length) return false;
  return left.groupBasis.every((basis, index) => {
    const other = right.groupBasis[index];
    return (
      basis.groupId === other.groupId && equalMaterials(basis.unitMaterialItems, other.unitMaterialItems)
    );
  });
}

function optionalCostVisibility(
  input: Pick<CostEditorInput, OptionalCostField>,
): Record<OptionalCostField, boolean> {
  return Object.fromEntries(optionalCostFields.map(({ field }) => [field, input[field] !== 0])) as Record<
    OptionalCostField,
    boolean
  >;
}

export default function CostEditor() {
  const params = useParams<{ id: string }>();
  const [, navigate] = useLocation();
  const { drafts, costs, costEstimates, inventory, dataVersion, notifyDataChanged, formDrafts } =
    usePrototypeServices();
  /* المجموعة ٢ (عقد ٢٨ — السيناريو G): مقترحات المواد من المخزون — آخر استلام
   * غير معكوس مصدر السعر (مؤكد)، وبلا استلام الاسم والوحدة فقط (تقديري).
   * قراءة فقط: التقدير لا يستهلك مخزونًا ولا ينشئ حدثًا. */
  const [materialSuggestions, setMaterialSuggestions] = useState<readonly MaterialSuggestion[]>([]);
  /* المجموعة ٣ (عقد D5): المقترحات عبر الدليل المشترك الواحد — نفس سلوك الحاسبة
   * حرفيًا (آخر استلام غير معكوس مصدر السعر، وبلا استلام اسم/وحدة تقديرية). */
  useEffect(() => {
    let active = true;
    void readMaterialSuggestions(inventory).then(suggestions => {
      if (active && suggestions) setMaterialSuggestions(suggestions);
    });
    return () => {
      active = false;
    };
  }, [inventory, dataVersion]);
  const [draft, setDraft] = useState<OrderDraft | null>(null);
  const [form, setForm] = useState<EditableCostInput | null>(null);
  /* S09: نموذج المسار المجمَّع — يعمل عندما تحمل المسودة مجموعات. */
  const [groupedForm, setGroupedForm] = useState<EditableGroupedInput | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  const [feedback, setFeedback] = useState<FeedbackMessage | null>(null);
  /* U-004: بنود مقترحة من تقدير المصدر — تُعرض معلنة كما هي: اقتراح لا تكلفة مؤكدة. */
  const [proposalNotice, setProposalNotice] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [materialSheet, setMaterialSheet] = useState<{
    index: number | null;
    /* S09: مجموعة أساس الوحدة التي تُحرَّر مادتها — null = المسار المسطح. */
    groupId: string | null;
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
  const initialGroupedRef = useRef<EditableGroupedInput | null>(null);
  /* U-004: التعليم مرة واحدة لكل فتح — لا يُعاد التعبئة فوق تعديل المالك. */
  const estimatePrefillDoneRef = useRef(false);
  const isGroupedDraft = (draft?.groups ?? []).length > 0;

  useEffect(() => {
    let active = true;
    drafts.get(params.id).then(result => {
      if (!active) return;
      if (!result.ok || !result.value) {
        setState("error");
        return;
      }
      setProposalNotice(null);
      const loaded = result.value;
      const grouped = (loaded.groups ?? []).length > 0;
      if (grouped) {
        const loadedGrouped = toGroupedInput(loaded, loaded.activeCostSnapshotId);
        setGroupedForm(loadedGrouped);
        initialGroupedRef.current = loadedGrouped;
        setForm(null);
        initialFormRef.current = null;
        setVisibleOptionalCosts(optionalCostVisibility(loadedGrouped));
      } else {
        const loadedInput = toInput(loaded, loaded.activeCostSnapshotId);
        setForm(loadedInput);
        initialFormRef.current = loadedInput;
        setGroupedForm(null);
        initialGroupedRef.current = null;
        setVisibleOptionalCosts(optionalCostVisibility(loadedInput));
      }
      setDraft(loaded);
      setNumericValidity({});
      setState("ready");
      /* U-004: جسر التقدير → التكلفة — إن بدأت المسودة من تقدير ولم تُبنَ لها تكلفة بعد،
       * تُعرض بنود التقدير كاقتراحات قابلة للتعديل والحذف؛ لا تُحفظ نسخة تكلفة إلا
       * حين يقرر المالك الحفظ. التقدير نفسه لا يتغير، ومرجع المسودة أثر سجل فقط. */
      const sourceEstimateId = loaded.sourceEstimateId ?? null;
      const costAlreadyBuilt =
        loaded.activeCostSnapshotId !== null ||
        (grouped
          ? (initialGroupedRef.current?.groupBasis ?? []).some(basis => basis.unitMaterialItems.length > 0)
          : (initialFormRef.current?.materialItems.length ?? 0) > 0);
      if (sourceEstimateId && !costAlreadyBuilt && !estimatePrefillDoneRef.current && !grouped) {
        estimatePrefillDoneRef.current = true;
        void costEstimates.get(sourceEstimateId).then(estimateResult => {
          if (!active) return;
          if (!estimateResult.ok || !estimateResult.value) {
            setProposalNotice("لم نجد تقديرك المصدر (قد حُذف)؛ ابدأ التكلفة بنفسك — لم يتغير أي سجل.");
            return;
          }
          const estimate = estimateResult.value;
          const prefilled: EditableCostInput = {
            materialItems: estimate.materialItems.map(item => ({ ...item, uiId: newUiId() })),
            time: estimate.time ? { ...estimate.time } : null,
            packagingMinor: estimate.packagingMinor,
            deliveryMinor: estimate.deliveryMinor,
            wasteMinor: estimate.wasteMinor,
            safetyBufferMinor: estimate.safetyBufferMinor,
            quantity: loaded.quantity,
          };
          setForm(prefilled);
          setVisibleOptionalCosts(optionalCostVisibility(prefilled));
          setProposalNotice(
            `بنود مقترحة من تقديرك «${estimate.title}» — عدّل أو احذف ما تشاء قبل الحفظ؛ الحفظ وحده يوثّق نسخة التكلفة. هذه ليست تكلفة مؤكدة ولا سعرًا ملتزمًا به.`,
          );
        });
      }
    });
    return () => {
      active = false;
    };
  }, [costEstimates, dataVersion, drafts, params.id]);

  /* S09: مدخل الخدمة للمسار المجمَّع — التوسيع يتم داخل الخدمة/النواة لا هنا. */
  const groupedServiceInput = (
    input: EditableGroupedInput,
    groups: NonNullable<OrderDraft["groups"]>,
  ): GroupedCostEditorInput => ({
    time: input.time,
    packagingMinor: input.packagingMinor,
    deliveryMinor: input.deliveryMinor,
    wasteMinor: input.wasteMinor,
    safetyBufferMinor: input.safetyBufferMinor,
    groupBasis: input.groupBasis.map(basis => {
      const group = groups?.find(candidate => candidate.id === basis.groupId);
      return {
        groupId: basis.groupId,
        label: group?.label ?? basis.groupId,
        repeatQuantity: group?.repeatQuantity ?? 1,
        unitMaterialItems: basis.unitMaterialItems.map(({ uiId: _uiId, ...item }) => item),
      };
    }),
  });
  const preview = useMemo(() => {
    if (isGroupedDraft && groupedForm && draft)
      return costs.previewGrouped(groupedServiceInput(groupedForm, draft.groups ?? []));
    if (!isGroupedDraft && form) return costs.preview(toServiceInput(form));
    return null;
  }, [costs, form, groupedForm, isGroupedDraft, draft]);
  const hasInvalidNumericInput = Object.values(numericValidity).some(isValid => !isValid);
  const isDirty = isGroupedDraft
    ? Boolean(
        groupedForm &&
        initialGroupedRef.current &&
        !equalGroupedInputs(groupedForm, initialGroupedRef.current),
      )
    : Boolean(form && initialFormRef.current && !equalCostInputs(form, initialFormRef.current));

  /* S09 (U008-AC09): مسودة نموذج عابرة لمدخلات التكلفة — تُكتب عند التعديل
   * الفعلي وتُستعاد صريحة بعد التحديث؛ حفظ النسخة يحذفها. */
  const formDraft = useFormDraft<CostRecoveryValues>(formDrafts, "order_cost", params.id, {
    mode: "flat",
    flat: null,
    grouped: null,
    packagingMinor: 0,
    deliveryMinor: 0,
    wasteMinor: 0,
    safetyBufferMinor: 0,
  });
  useEffect(() => {
    if (!isDirty || formDraft.state.phase === "restore-offer") return;
    if (isGroupedDraft && groupedForm) {
      formDraft.onValuesChanged({
        mode: "grouped",
        flat: null,
        grouped: { groupBasis: groupedForm.groupBasis, time: groupedForm.time },
        packagingMinor: groupedForm.packagingMinor,
        deliveryMinor: groupedForm.deliveryMinor,
        wasteMinor: groupedForm.wasteMinor,
        safetyBufferMinor: groupedForm.safetyBufferMinor,
      });
    } else if (form) {
      formDraft.onValuesChanged({
        mode: "flat",
        flat: toServiceInput(form),
        grouped: null,
        packagingMinor: form.packagingMinor,
        deliveryMinor: form.deliveryMinor,
        wasteMinor: form.wasteMinor,
        safetyBufferMinor: form.safetyBufferMinor,
      });
    }
  }, [isDirty, formDraft.state.phase, form, groupedForm, isGroupedDraft]);
  const restoredFromOffer = useRef(false);
  useEffect(() => {
    if (formDraft.state.phase === "drafting" && restoredFromOffer.current) {
      restoredFromOffer.current = false;
      const saved = formDraft.state.values;
      const applyOptional = <
        T extends {
          packagingMinor: number;
          deliveryMinor: number;
          wasteMinor: number;
          safetyBufferMinor: number;
        },
      >(
        target: T,
      ): T => ({
        ...target,
        packagingMinor: saved.packagingMinor,
        deliveryMinor: saved.deliveryMinor,
        wasteMinor: saved.wasteMinor,
        safetyBufferMinor: saved.safetyBufferMinor,
      });
      if (saved.mode === "grouped" && isGroupedDraft && groupedForm) {
        const restored = applyOptional(groupedForm);
        setGroupedForm({
          ...restored,
          time: saved.grouped?.time ?? restored.time,
          groupBasis:
            saved.grouped?.groupBasis.map(basis => ({
              groupId: basis.groupId,
              unitMaterialItems: basis.unitMaterialItems.map(item => ({ ...item, uiId: newUiId() })),
            })) ?? restored.groupBasis,
        });
        setVisibleOptionalCosts(optionalCostVisibility(restored));
      } else if (saved.mode === "flat" && !isGroupedDraft && form) {
        const restored = applyOptional(form);
        setForm({
          ...restored,
          time: saved.flat?.time ?? restored.time,
          quantity: saved.flat?.quantity ?? restored.quantity,
          materialItems:
            saved.flat?.materialItems.map(item => ({ ...item, uiId: newUiId() })) ?? restored.materialItems,
        });
        setVisibleOptionalCosts(optionalCostVisibility(restored));
      }
    }
    if (formDraft.state.phase === "restore-offer") restoredFromOffer.current = true;
  }, [formDraft.state.phase]);
  /* S09 (U008-AC12): تغيّرت كمية المسودة بعد آخر نسخة تكلفة — النسخة القديمة
   * تُعرض للمقارنة والمراجعة ولا تُعاد توزيعها صامتة. */
  const quantityReviewNotice = useMemo(() => {
    if (!draft) return null;
    const record = draft.costSnapshots.find(snapshot => snapshot.id === draft.activeCostSnapshotId);
    if (!record) return null;
    if (isGroupedDraft) {
      const currentDerived = (draft.groups ?? []).reduce((total, group) => total + group.repeatQuantity, 0);
      if (currentDerived === record.quantity) return null;
      return `كمية الطلب المشتقة من المجموعات صارت ${currentDerived} بينما آخر نسخة تكلفة حُفظت على كمية ${record.quantity} — راجع أساس الوحدة لكل مجموعة قبل الاتفاق؛ النسخة القديمة لم تُغيَّر.`;
    }
    if (draft.quantity === record.quantity) return null;
    return `كمية الطلب صارت ${draft.quantity} بينما آخر نسخة تكلفة حُفظت على كمية ${record.quantity} — راجع التكلفة قبل الاتفاق؛ النسخة القديمة لم تُغيَّر.`;
  }, [draft, isGroupedDraft]);

  function setValidity(key: string, isValid: boolean) {
    setNumericValidity(current => (current[key] === isValid ? current : { ...current, [key]: isValid }));
  }
  function openMaterialSheet(index: number | null = null, groupId: string | null = null) {
    const list =
      groupId !== null
        ? groupedForm?.groupBasis.find(basis => basis.groupId === groupId)?.unitMaterialItems
        : form?.materialItems;
    const item = index === null ? newMaterial() : list?.[index];
    if (!item) return;
    setMaterialSheet({ index, groupId, draft: { ...item } });
    setMaterialSheetValidity({});
    setMaterialSheetMessage(null);
  }
  function updateMaterialSheet(patch: Partial<DraftCostMaterial>) {
    setMaterialSheet(current => (current ? { ...current, draft: { ...current.draft, ...patch } } : current));
    setMaterialSheetMessage(null);
  }
  function saveMaterialFromSheet() {
    if (!materialSheet) return;
    const { draft: item, index, groupId } = materialSheet;
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
    if (groupId !== null) {
      setGroupedForm(current => {
        if (!current) return current;
        return {
          ...current,
          groupBasis: current.groupBasis.map(basis => {
            if (basis.groupId !== groupId) return basis;
            return {
              ...basis,
              unitMaterialItems:
                index === null
                  ? [...basis.unitMaterialItems, item]
                  : basis.unitMaterialItems.map((currentItem, itemIndex) =>
                      itemIndex === index ? item : currentItem,
                    ),
            };
          }),
        };
      });
    } else {
      setForm(current => {
        if (!current) return current;
        const materialItems =
          index === null
            ? [...current.materialItems, item]
            : current.materialItems.map((currentItem, itemIndex) =>
                itemIndex === index ? item : currentItem,
              );
        return { ...current, materialItems };
      });
    }
    setMaterialSheet(null);
    setMaterialSheetValidity({});
    setMaterialSheetMessage(null);
  }
  function removeMaterial(index: number, uiId: string, groupId: string | null = null) {
    if (groupId !== null) {
      setGroupedForm(current =>
        current
          ? {
              ...current,
              groupBasis: current.groupBasis.map(basis =>
                basis.groupId === groupId
                  ? {
                      ...basis,
                      unitMaterialItems: basis.unitMaterialItems.filter(
                        (_, itemIndex) => itemIndex !== index,
                      ),
                    }
                  : basis,
              ),
            }
          : current,
      );
    } else {
      setForm(current =>
        current
          ? { ...current, materialItems: current.materialItems.filter((_, itemIndex) => itemIndex !== index) }
          : current,
      );
    }
    setNumericValidity(current =>
      Object.fromEntries(Object.entries(current).filter(([key]) => !key.startsWith(`material-${uiId}-`))),
    );
  }
  function revealOptionalCost(field: OptionalCostField) {
    setVisibleOptionalCosts(current => ({ ...current, [field]: true }));
  }
  function excludeOptionalCost(field: OptionalCostField) {
    setVisibleOptionalCosts(current => ({ ...current, [field]: false }));
    if (isGroupedDraft) {
      setGroupedForm(current => (current ? { ...current, [field]: 0 } : current));
    } else {
      setForm(current => (current ? { ...current, [field]: 0 } : current));
    }
  }
  function setOptionalCost(field: OptionalCostField, value: number) {
    if (isGroupedDraft) {
      setGroupedForm(current => (current ? { ...current, [field]: value } : current));
    } else {
      setForm(current => (current ? { ...current, [field]: value } : current));
    }
  }
  function setTime(next: DraftCostTime | null) {
    if (isGroupedDraft) {
      setGroupedForm(current => (current ? { ...current, time: next } : current));
    } else {
      setForm(current => (current ? { ...current, time: next } : current));
    }
  }
  const currentTime = isGroupedDraft ? (groupedForm?.time ?? null) : (form?.time ?? null);

  async function saveSnapshot(): Promise<boolean> {
    if (!draft) return false;
    setFeedback(null);
    if (hasInvalidNumericInput) {
      setFeedback({ kind: "error", word: "أكمل أو صحح الحقل العددي. استخدم أرقام 0–9 فقط." });
      return false;
    }
    if (!preview?.ok) {
      if (preview) setFeedback({ kind: "error", word: preview.message });
      return false;
    }
    setIsSaving(true);
    const result = isGroupedDraft
      ? groupedForm &&
        (await costs.saveGroupedSnapshot(draft, groupedServiceInput(groupedForm, draft.groups ?? [])))
      : form && (await costs.saveSnapshot(draft, toServiceInput(form)));
    setIsSaving(false);
    if (!result || !result.ok) {
      setFeedback({ kind: "error", word: result ? result.message : "لم تُحفظ النسخة." });
      return false;
    }
    if (isGroupedDraft && groupedForm) {
      const restored = toGroupedInput(result.draft, result.draft.activeCostSnapshotId);
      setGroupedForm(restored);
      initialGroupedRef.current = restored;
    } else if (form) {
      const restored = toInput(result.draft, result.draft.activeCostSnapshotId);
      setForm(restored);
      initialFormRef.current = restored;
    }
    setDraft(result.draft);
    notifyDataChanged();
    /* S09: نجاح حفظ النسخة يحذف مسودة النموذج العابرة — النسخة هي السجل الآن. */
    void formDraft.clearFormDraft();
    setFeedback({
      kind: "completion",
      word:
        preview.snapshot.knowledgeState === "incomplete"
          ? `تم حفظ مسودة تكلفة ناقصة ${result.draft.costSnapshots.length} على هذا الجهاز.`
          : `تم حفظ نسخة التكلفة ${result.draft.costSnapshots.length} على هذا الجهاز.`,
    });
    return true;
  }

  const requestNavigation = useUnsavedChangesGuard({ isDirty, onSave: saveSnapshot });
  if (state === "loading" || (!form && !groupedForm))
    return (
      <div className="micro-route-loading" role="status">
        جارٍ فتح تكلفة المسودة…
      </div>
    );
  if (state === "error" || !draft)
    return (
      <section className="micro-page micro-not-found">
        <h1>تعذر فتح التكلفة</h1>
        <p role="alert">ارجع للمسودة ثم أعد المحاولة.</p>
        <Button
          action="secondary"

          onClick={() => navigate("/orders")}
        >
          الطلبات
        </Button>
      </section>
    );
  const status = preview?.ok
    ? knowledgeCopy[preview.snapshot.knowledgeState as keyof typeof knowledgeCopy]
    : null;
  const canShowProtectionPrice =
    preview?.ok && !["incomplete", "partial"].includes(preview.snapshot.knowledgeState);
  const draftGroups = draft.groups ?? [];
  const basisOf = (groupId: string) =>
    groupedForm?.groupBasis.find(basis => basis.groupId === groupId) ?? null;

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
      </div>
      {/* U-004: إشعار البنود المقترحة من التقدير المصدر — معلنة لا مفترضة. */}
      {proposalNotice ? <FeedbackNote kind="advisory" word={proposalNotice} /> : null}
      {/* S09: عرض استعادة مدخلات التكلفة صريح — استرجع أو تجاهل، لا تطبيق صامت. */}
      {formDraft.state.phase === "restore-offer" ? (
        <FormDraftRestoreBanner
          savedAt={formDraft.state.savedAt}
          onRestore={formDraft.restoreDraft}
          onDiscard={formDraft.discardDraft}
        />
      ) : null}
      {formDraft.state.phase === "drafting" && formDraft.state.saveFailed ? (
        <p className="micro-field-error" role="alert">
          تعذر حفظ مسودة التكلفة محليًا — مدخلاتك أمامك كما هي ولم يُسجَّل أي أثر مالي.
        </p>
      ) : null}
      {/* S09 (U008-AC12): مراجعة صريحة عند تغيّر الكمية بعد آخر نسخة. */}
      {quantityReviewNotice ? <FeedbackNote kind="advisory" word={quantityReviewNotice} /> : null}
      {preview?.ok ? (
        <section className="micro-cost-result" data-knowledge={preview.snapshot.knowledgeState}>
          <span>سعر الحماية لكل قطعة (د.أ)</span>
          <strong>
            {canShowProtectionPrice ? <MoneyValue minor={preview.snapshot.priceFloorMinor} /> : "—"}
          </strong>
          {canShowProtectionPrice ? (
            <small>
              تكلفة القطعة{" "}
              <MoneyValue minor={preview.snapshot.unitCostMinor} className="micro-inline-number" /> + هامش
              الحماية الذي أدخلته.
            </small>
          ) : null}
          {status ? <b>{status}</b> : null}
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
          {preview?.message}
        </p>
      )}
      {isGroupedDraft ? (
        /* S09: مواد كل مجموعة بأساس الوحدة الواحدة — التكرار يظهر معروضًا لا
         * محسوبًا في الواجهة؛ الضرب مرة واحدة يتم في التوسيع داخل الخدمة. */
        draftGroups.map(group => {
          const basis = basisOf(group.id);
          const items = basis?.unitMaterialItems ?? [];
          return (
            <section
              className="micro-form-card"
              key={group.id}
              aria-label={`مواد وحدة ${group.label || "مجموعة بلا اسم"}`}
            >
              <div className="micro-cost-section-heading">
                <div>
                  <h2>{group.label || "مجموعة بلا اسم"}</h2>
                  <p>
                    مكونات الوحدة الواحدة — تُضرب في التكرار <bdi dir="ltr">{group.repeatQuantity}</bdi> مرة
                    واحدة عند الحساب.
                  </p>
                </div>
                <button
                  className="micro-icon-button"
                  type="button"
                  aria-label={`إضافة مادة إلى وحدة ${group.label || "مجموعة بلا اسم"}`}
                  onClick={() => openMaterialSheet(null, group.id)}
                >
                  <Plus aria-hidden="true" />
                </button>
              </div>
              {items.length === 0 ? (
                <p className="micro-empty-inline">لم تضف مادة بعد.</p>
              ) : (
                <div className="micro-material-summary-list">
                  {items.map((item, index) => (
                    <div className="micro-material-summary-row" key={item.uiId}>
                      <button
                        className="micro-material-summary"
                        type="button"
                        onClick={() => openMaterialSheet(index, group.id)}
                        aria-label={`تعديل مادة ${item.name || index + 1} في وحدة ${group.label || "مجموعة بلا اسم"}`}
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
                        aria-label={`حذف مادة ${item.name || index + 1} من وحدة ${group.label || "مجموعة بلا اسم"}`}
                        onClick={() => removeMaterial(index, item.uiId, group.id)}
                      >
                        <Trash2 aria-hidden="true" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </section>
          );
        })
      ) : (
        <section className="micro-form-card">
          <div className="micro-cost-section-heading">
            <div>
              <h2>المواد</h2>
            </div>
            <button
              className="micro-icon-button"
              type="button"
              aria-label="إضافة مادة"
              onClick={() => openMaterialSheet()}
            >
              <Plus aria-hidden="true" />
            </button>
          </div>
          {form && form.materialItems.length === 0 ? (
            <p className="micro-empty-inline">لم تضف مادة بعد.</p>
          ) : null}
          {form && form.materialItems.length > 0 ? (
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
          ) : null}
        </section>
      )}
      <MaterialSheet
        value={materialSheet}
        message={materialSheetMessage}
        validity={materialSheetValidity}
        suggestions={materialSuggestions}
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
              setTime(currentTime ? null : { minutes: null, hourlyRateMinor: null, confidence: "estimated" })
            }
          >
            {currentTime ? "اترك الوقت غير مكتمل" : "إضافة وقت"}
          </button>
        </div>
        {currentTime ? (
          <div className="micro-field-grid">
            <label className="micro-field">
              <span>
                الدقائق <small>أرقام 0–9</small>
              </span>
              <EnglishNumberInput
                value={currentTime.minutes}
                kind="integer"
                min="0"
                allowEmpty
                aria-label="دقائق الوقت بالأرقام 0–9"
                onNumericChange={minutes =>
                  setTime(
                    currentTime
                      ? { ...currentTime, minutes }
                      : { minutes, hourlyRateMinor: null, confidence: "estimated" },
                  )
                }
                onEmptyChange={() => setTime(currentTime ? { ...currentTime, minutes: null } : null)}
                onTextValidityChange={isValid => setValidity("time-minutes", isValid)}
              />
            </label>
            <label className="micro-field">
              <span>
                سعر الساعة (د.أ) <small>أرقام 0–9</small>
              </span>
              <EnglishNumberInput
                value={currentTime.hourlyRateMinor}
                kind="money"
                min="0"
                allowEmpty
                aria-label="سعر الساعة بالأرقام 0–9"
                onNumericChange={hourlyRateMinor =>
                  setTime(
                    currentTime
                      ? { ...currentTime, hourlyRateMinor }
                      : { minutes: null, hourlyRateMinor, confidence: "estimated" },
                  )
                }
                onEmptyChange={() => setTime(currentTime ? { ...currentTime, hourlyRateMinor: null } : null)}
                onTextValidityChange={isValid => setValidity("time-rate", isValid)}
              />
            </label>
            <label className="micro-field">
              <span>حالة الرقم</span>
              <select
                value={currentTime.confidence}
                onChange={event =>
                  setTime(
                    currentTime
                      ? {
                          ...currentTime,
                          confidence: event.target.value as DraftCostMaterial["confidence"],
                        }
                      : null,
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
              <Button
                action="secondary"

                key={field}
                onClick={() => revealOptionalCost(field)}
              >
                أضف {label}
              </Button>
            ))}
        </div>
        <div className="micro-field-grid">
          {optionalCostFields
            .filter(({ field }) => visibleOptionalCosts[field])
            .map(({ field, label }) => {
              const currentOptionalValue = isGroupedDraft
                ? (groupedForm?.[field] ?? 0)
                : (form?.[field] ?? 0);
              return (
                <div className="micro-optional-cost-field" key={field}>
                  <label className="micro-field">
                    <span>
                      {label} (د.أ) <small>أرقام 0–9</small>
                    </span>
                    <EnglishNumberInput
                      value={currentOptionalValue}
                      kind="money"
                      min="0"
                      aria-label={`${label} بالأرقام 0–9`}
                      onNumericChange={value => setOptionalCost(field, value)}
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
              );
            })}
        </div>
        {optionalCostFields.every(({ field }) => !visibleOptionalCosts[field]) ? (
          <p className="micro-empty-inline">
            لا توجد بنود إضافية معلنة الآن. هذا لا يعني أن Micro افترض تكلفة مجهولة بصفر.
          </p>
        ) : null}
        {isGroupedDraft ? (
          <p className="micro-offline-truth">
            بنود المستوى أعلاه على نطاق الطلب كله مرة واحدة — لا تُضرب مع تكرار أي مجموعة.
          </p>
        ) : null}
      </section>
      {feedback ? <FeedbackNote kind={feedback.kind} word={feedback.word} /> : null}
      {preview?.ok && preview.snapshot.knowledgeState === "incomplete" ? (
        <p className="micro-cost-save-guidance">
          يمكنك حفظ ما تعرفه الآن كمسودة ناقصة. أضف دقائق العمل وسعر الساعة لاحقًا لتكتمل قراءة التكلفة؛ لا
          تدخل صفرًا بدل المجهول.
        </p>
      ) : null}
      <div className="micro-form-actions micro-sticky-save">
        <Button
          action="save"
          block

          disabled={isSaving || hasInvalidNumericInput || !preview?.ok}
          aria-busy={isSaving}
          onClick={() => {
            void saveSnapshot();
          }}
        >
          {/* §3.4: أثناء الحفظ الدوران يحل مكان الأيقونة والتسمية ثابتة — لا قفز عرض */}
          {isSaving ? <span className="micro-spinner" aria-hidden="true" /> : <Save aria-hidden="true" />}
          {preview?.ok && preview.snapshot.knowledgeState === "incomplete"
            ? "حفظ مسودة تكلفة ناقصة"
            : "حفظ نسخة التكلفة"}
        </Button>
        {draft.activeCostSnapshotId ? (
          <Button
            action="secondary"

            onClick={() => requestNavigation(`/orders/draft/${draft.id}/agreement`)}
          >
            تسجيل الاتفاق
          </Button>
        ) : null}
      </div>
      <p className="micro-cost-disclaimer">
        هذا <strong>سعر حماية</strong> من التكلفة المدخلة، لا سعر سوق ولا قرار بقبول الطلب. الاتفاق والعربون
        لا يُسجلان هنا.
      </p>
    </section>
  );
}
