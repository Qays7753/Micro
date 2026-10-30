/** Slice 1 draft editor: saves pre-domain details only and never creates price, deposit, cash, or a CraftOrder.
 * §٥-١ (و٥): في مسار النية (id === "new") لا سجل وراء النقرة — المسودة تُنشأ
 * عند أول إدخال حقيقي (أي حقل يخرج عن الفراغ)، فلا يخلّف الاستكشاف مسودات فارغة.
 * S09 (UNIT-007/029 — أمر ad133bae القسم ٢): مجموعات الطلب بهوية ثابتة وتكرار
 * واحد، ومرجع عرض محفوظ كلقطة موسومة مستقلة (لا «الأحدث وقت القراءة»)، وسعر
 * مقترح حر اختياري (CONS-DEC07 — ليس اتفاقًا)، و«حفظ لاستخدامه مرة أخرى» صريح
 * اختياري بعد الحفظ، ومسودة نموذج عابرة تستعيد النص الخام نفسه ولو كان غير
 * صالح (U007-AC03) دون أي أثر مالي. */
import { useEffect, useRef, useState } from "react";
import { ArrowRight, BookOpen, Plus, Save, Trash2 } from "lucide-react";
import { useLocation, useParams, useSearch } from "wouter";
import { useReturnPath, useReferrerLinks } from "@/app/useReturnNavigation";
import { usePrototypeServices } from "@/app/PrototypeServicesContext";
import { DISMISS_PANEL_CLOSE_LABEL } from "@/app/resultFeedback";
import { EnglishNumberInput } from "@/components/forms/EnglishNumberInput";
import { FormDraftRestoreBanner } from "@/components/forms/FormDraftRestoreBanner";
import { useFormDraft } from "@/components/forms/useFormDraft";
import { useUnsavedChangesGuard } from "@/components/forms/UnsavedChangesGuard";
import { formatMoneyMinor } from "@/presentation/formatters";
import type {
  CostEstimate,
  DraftGroup,
  DraftIntent,
  DraftOfferingRef,
  OrderDraft,
} from "@/storage/local/types";
import type { CatalogItem, CatalogTemplate } from "@micro-domain/catalog/index.js";

import { Button, FeedbackMessage, FeedbackNote } from "@/components/primitives";
type EditorState = "loading" | "ready" | "not_found" | "error";
type DraftFormValues = Pick<
  OrderDraft,
  | "itemName"
  | "catalogItemId"
  | "customerName"
  | "orderName"
  | "quantity"
  | "specifications"
  | "offeringRef"
  | "groups"
  | "suggestedPriceMinor"
>;
/* S09: قيم مسودة النموذج العابرة — النص الخام نفسه للكمية والسعر المقترح
 * (ولو غير صالحين) مع علمي صلاحيتهما، فتُستعاد الحالة كما كانت بلا إخفاء. */
type DraftRecoveryValues = {
  form: DraftFormValues;
  quantityRawText: string | null;
  quantityValid: boolean;
  suggestedPriceRawText: string | null;
  suggestedPriceValid: boolean;
  intent: DraftIntent;
};

function draftFormValues(draft: OrderDraft): DraftFormValues {
  return {
    itemName: draft.itemName,
    catalogItemId: draft.catalogItemId,
    customerName: draft.customerName,
    orderName: draft.orderName ?? null,
    quantity: draft.quantity,
    specifications: draft.specifications,
    offeringRef: draft.offeringRef ?? null,
    groups: draft.groups ?? null,
    suggestedPriceMinor: draft.suggestedPriceMinor ?? null,
  };
}

function equalOfferingRef(left: DraftOfferingRef | null, right: DraftOfferingRef | null): boolean {
  if ((left ?? null) === (right ?? null)) return true;
  if (!left || !right) return false;
  return (
    left.catalogItemId === right.catalogItemId &&
    (left.templateId ?? null) === (right.templateId ?? null) &&
    (left.revision ?? null) === (right.revision ?? null) &&
    left.nameSnapshot === right.nameSnapshot &&
    left.takenAt === right.takenAt
  );
}

function equalGroups(left: readonly DraftGroup[] | null, right: readonly DraftGroup[] | null): boolean {
  if ((left ?? null) === (right ?? null)) return true;
  if (!left || !right || left.length !== right.length) return false;
  return left.every((group, index) => {
    const other = right[index];
    return (
      group.id === other.id &&
      group.label === other.label &&
      group.repeatQuantity === other.repeatQuantity &&
      group.offeringType === other.offeringType &&
      equalOfferingRef(group.offeringRef ?? null, other.offeringRef ?? null) &&
      (group.note ?? null) === (other.note ?? null)
    );
  });
}

function equalDraftValues(left: DraftFormValues | null, right: DraftFormValues | null) {
  return Boolean(
    left &&
    right &&
    left.itemName === right.itemName &&
    left.catalogItemId === right.catalogItemId &&
    left.customerName === right.customerName &&
    (left.orderName ?? null) === (right.orderName ?? null) &&
    left.quantity === right.quantity &&
    left.specifications === right.specifications &&
    equalOfferingRef(left.offeringRef ?? null, right.offeringRef ?? null) &&
    equalGroups(left.groups ?? null, right.groups ?? null) &&
    (left.suggestedPriceMinor ?? null) === (right.suggestedPriceMinor ?? null),
  );
}
/* S09 (و٥ نفسها): المجموعة بلا تسمية ليست إدخالًا حقيقيًا بعد — إضافة مجموعة
 * فارغة لا تنشئ مسودة؛ تصير حقيقية بأول حرف في تسميتها أو بمحتواها. */
function groupsHaveRealContent(groups: readonly DraftGroup[] | null | undefined): boolean {
  return Boolean(groups && groups.some(group => group.label.trim() !== ""));
}
/* S09 (U007-AC01/AC02): الإدخال الحقيقي الذي يستحق سجلًا — أي وصف أو جهة أو
 * تفاصيل أو مرجع أو سعر مقترح أو كمية غير الافتراضية 1 أو مجموعة ذات محتوى؛
 * الكمية الافتراضية وحدها والمجموعة الفارغة وحدها لا تنشئان شيئًا. */
function hasRealDraftInput(values: DraftFormValues): boolean {
  if (values.itemName.trim() !== "") return true;
  if (values.customerName.trim() !== "") return true;
  if ((values.orderName ?? "").trim() !== "") return true;
  if (values.specifications.trim() !== "") return true;
  if (values.catalogItemId !== null) return true;
  if (values.offeringRef !== null && values.offeringRef !== undefined) return true;
  if (values.suggestedPriceMinor !== null && values.suggestedPriceMinor !== undefined) return true;
  if (values.quantity !== 1) return true;
  return groupsHaveRealContent(values.groups);
}
/** نيّة المحرر الفارغ تُقرأ من البحث (useSearch) لا من المسار — wouter يعيد المسار بلا استعلام. */
function intentFromSearch(search: string): DraftIntent {
  const value = new URLSearchParams(search).get("intent");
  return value === "planned_design" ? "planned_design" : "customer_order";
}
/* U-004: جسر التقدير → المسودة — التقدير الذي بدأت منه، إن اختير من «أدواتي». */
function estimateIdFromSearch(search: string): string | null {
  const value = new URLSearchParams(search).get("estimate");
  return value && value.trim() ? value : null;
}
const estimateKnowledgeLabel: Record<CostEstimate["knowledgeState"], string> = {
  known: "معروفة",
  estimated: "تقديرية",
  partial: "جزئية",
  incomplete: "ناقصة",
  stale: "تحتاج مراجعة",
  variable: "متغيرة",
};
/* U-004: القيم المنسوخة اقتراحات معلنة لا أسعار مؤكدة — تُنسخ مرة واحدة وتُترك للتعديل. */
function prefillFromEstimate(virtual: OrderDraft, estimate: CostEstimate): OrderDraft {
  const materials = estimate.materialItems
    .map(item => `${item.name} ×${item.quantity} ${item.unit}`)
    .join("، ");
  const time = estimate.time
    ? `${estimate.time.minutes} دقيقة بـ ${formatMoneyMinor(estimate.time.hourlyRateMinor)} د.أ/ساعة`
    : null;
  const specs = [
    "(اقتراح من تقديرك — عدّل بحرية قبل أي اتفاق)",
    materials ? `مواد مقترحة: ${materials}` : null,
    time ? `وقت مقترح: ${time}` : null,
    `سعر الحماية المقترح: ${formatMoneyMinor(estimate.priceFloorMinor)} د.أ (حالة المعرفة: ${
      estimateKnowledgeLabel[estimate.knowledgeState]
    })`,
  ]
    .filter(Boolean)
    .join("\n");
  return {
    ...virtual,
    itemName: estimate.title.trim() || estimate.materialItems[0]?.name?.trim() || "مسودة من تقدير",
    quantity: estimate.quantity,
    specifications: specs,
    sourceEstimateId: estimate.id,
  };
}
function proposalNotice(estimate: CostEstimate): string {
  return `بدأت هذه المسودة من تقديرك «${estimate.title}» — القيم المنسوخة مقترحات قابلة للتعديل، التقدير نفسه لم يتغيّر وغير مالي، ولا شيء هنا سعر مؤكد أو التزام. تكلفته الكاملة تُبنى في خطوة «احسب التكلفة».`;
}
/* S09 (UNIT-029): ختم المرجع الموسوم من المرجع وقالبه النشط إن وُجد — لقطة
 * مستقلة بمراجعتها؛ تعديل/أرشفة المصدر لاحقًا لا تغيّرها أبدًا. */
function stampOfferingRef(
  item: CatalogItem,
  template: CatalogTemplate | null,
  takenAt: string,
): DraftOfferingRef {
  return {
    catalogItemId: item.id,
    templateId: template?.id ?? null,
    revision: template?.revision ?? null,
    nameSnapshot: item.name,
    takenAt,
  };
}
const newGroupId = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `group-${Date.now()}-${Math.random().toString(16).slice(2)}`;
const newGroup = (offeringType: "product" | "service" = "product"): DraftGroup => ({
  id: newGroupId(),
  label: "",
  repeatQuantity: 1,
  offeringType,
  offeringRef: null,
  note: null,
});
const offeringTypeLabel: Record<DraftGroup["offeringType"], string> = {
  product: "منتج",
  service: "خدمة",
};

export default function DraftEditor() {
  const params = useParams<{ id: string }>();
  const [location, navigate] = useLocation();
  /* و٥-ب (مجموعة ٣): المعاملات تُقرأ من useSearch — المسار في المتصفح الحقيقي يصل بلا استعلام. */
  const search = useSearch();
  /* المجموعة ١ (Scope A): الرجوع يعود للمصدر (?from) مع بديل قانوني موثّق. */
  const returnPath = useReturnPath();
  const { drafts, catalog, costEstimates, dataVersion, notifyDataChanged, formDrafts } =
    usePrototypeServices();
  /* و٥: "new" = محرر نية بلا سجل بعد. */
  const isNewDraft = params.id === "new";
  const intent = intentFromSearch(search);
  const estimateId = estimateIdFromSearch(search);
  const [state, setState] = useState<EditorState>("loading");
  const [draft, setDraft] = useState<OrderDraft | null>(null);
  const [feedback, setFeedback] = useState<FeedbackMessage | null>(null);
  /* U-004: إشعار الاقتراحات المنسوخة من تقدير — القيم مقترحة قابلة للتعديل. */
  const [estimateNotice, setEstimateNotice] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isQuantityValid, setIsQuantityValid] = useState(true);
  /* S09: النص الخام للكمية/السعر المقترح وعلم صلاحية السعر — للاستعادة الصادقة. */
  const [quantityRawText, setQuantityRawText] = useState<string | null>(null);
  const [isSuggestedPriceValid, setIsSuggestedPriceValid] = useState(true);
  const [suggestedPriceRawText, setSuggestedPriceRawText] = useState<string | null>(null);
  const [rawInputEpoch, setRawInputEpoch] = useState(0);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [catalogItems, setCatalogItems] = useState<readonly CatalogItem[]>([]);
  /* S09 (UNIT-029): «حفظ لاستخدامه مرة أخرى» — صريح اختياري بعد الحفظ. */
  const [reuseKind, setReuseKind] = useState<DraftGroup["offeringType"]>("product");
  const [reuseName, setReuseName] = useState<string | null>(null);
  const [isSavingReuse, setIsSavingReuse] = useState(false);
  const [reuseFeedback, setReuseFeedback] = useState<FeedbackMessage | null>(null);
  const initialValuesRef = useRef<DraftFormValues | null>(null);
  const draftRef = useRef<OrderDraft | null>(null);
  draftRef.current = draft;
  const materializePromiseRef = useRef<Promise<OrderDraft | null> | null>(null);
  /* S09: مسودة النموذج العابرة — تُكتب عند التعديل الفعلي وتُستعاد صريحة. */
  const formDraft = useFormDraft<DraftRecoveryValues>(
    formDrafts,
    "order_draft",
    isNewDraft ? null : params.id,
    {
      form: {
        itemName: "",
        catalogItemId: null,
        customerName: "",
        orderName: null,
        quantity: 1,
        specifications: "",
        offeringRef: null,
        groups: null,
        suggestedPriceMinor: null,
      },
      quantityRawText: null,
      quantityValid: true,
      suggestedPriceRawText: null,
      suggestedPriceValid: true,
      intent,
    },
  );
  useEffect(() => {
    let active = true;
    /* و٥: المحرر الفارغ يبدأ بلا قراءة من المخزن — لا سجل بعد. */
    if (isNewDraft) {
      if (state === "loading") {
        const nowIso = new Date().toISOString();
        const virtual: OrderDraft = {
          id: "new",
          intent,
          customerName: "",
          orderName: null,
          itemName: "",
          catalogItemId: null,
          specifications: "",
          quantity: 1,
          costSnapshots: [],
          activeCostSnapshotId: null,
          linkedOrderId: null,
          createdAt: nowIso,
          updatedAt: nowIso,
        };
        setDraft(virtual);
        initialValuesRef.current = draftFormValues(virtual);
        setState("ready");
      }
      return () => {
        active = false;
      };
    }
    drafts.get(params.id).then(result => {
      if (!active) return;
      if (!result.ok) {
        setState("error");
        return;
      }
      setDraft(result.value);
      initialValuesRef.current = result.value ? draftFormValues(result.value) : null;
      setState(result.value ? "ready" : "not_found");
    });
    return () => {
      active = false;
    };
  }, [dataVersion, drafts, intent, isNewDraft, params.id, state]);
  useEffect(() => {
    let active = true;
    catalog.list({ includeInactive: true }).then(result => {
      if (active && result.ok) setCatalogItems(result.items);
    });
    return () => {
      active = false;
    };
  }, [catalog, dataVersion]);
  /* U-004: جسر التقدير → المسودة في أثر مستقل يعمل مرة واحدة — لا يُبطل بانتقال
   * حالة التحميل إلى الجاهزية. القيم المقترحة تصل المسودة الافتراضية وتُنشئها؛
   * والتقدير نفسه لا يتغير ولا تُنشأ أي حركة مالية. */
  useEffect(() => {
    if (!isNewDraft || !estimateId) return;
    let estimateActive = true;
    void costEstimates.get(estimateId).then(result => {
      if (!estimateActive) return;
      if (!result.ok || !result.value) {
        setEstimateNotice("لم نجد التقدير المشار إليه (قد حُذف)؛ بدأت المسودة فارغة ولم يُنشأ شيء.");
        return;
      }
      const estimate = result.value;
      setDraft(current =>
        current && current.id === "new" ? prefillFromEstimate(current, estimate) : current,
      );
      setEstimateNotice(proposalNotice(estimate));
    });
    return () => {
      estimateActive = false;
    };
  }, [costEstimates, estimateId, isNewDraft, dataVersion]);
  /* S09 (U007-AC03): كتابة مسودة النموذج عند التعديل الفعلي — النص الخام
   * نفسه وعلم الصلاحية مع قيم النموذج؛ لا كتابة من مجرد الفتح. */
  const isDirty = Boolean(
    draft && initialValuesRef.current && !equalDraftValues(draftFormValues(draft), initialValuesRef.current),
  );
  useEffect(() => {
    if (!draft || !isDirty || formDraft.state.phase === "restore-offer") return;
    formDraft.onValuesChanged({
      form: draftFormValues(draft),
      quantityRawText,
      quantityValid: isQuantityValid,
      suggestedPriceRawText,
      suggestedPriceValid: isSuggestedPriceValid,
      intent: draft.intent,
    });
  }, [
    draft,
    isDirty,
    quantityRawText,
    isQuantityValid,
    suggestedPriceRawText,
    isSuggestedPriceValid,
    formDraft.state.phase,
  ]);
  /* S09: تطبيق القيم المستعادة بعد «استرجع» فقط — النصوص الخام تُحقن بإعادة
   * تركيب حقول الأرقام (initialRawText + key) فلا تُخفى الكمية/السعر كما كانا. */
  const restoredFromOffer = useRef(false);
  useEffect(() => {
    if (formDraft.state.phase === "drafting" && restoredFromOffer.current) {
      restoredFromOffer.current = false;
      const saved = formDraft.state.values;
      setDraft(current => (current ? { ...current, ...saved.form } : current));
      setIsQuantityValid(saved.quantityValid !== false);
      setIsSuggestedPriceValid(saved.suggestedPriceValid !== false);
      setQuantityRawText(saved.quantityRawText ?? null);
      setSuggestedPriceRawText(saved.suggestedPriceRawText ?? null);
      setRawInputEpoch(epoch => epoch + 1);
    }
    if (formDraft.state.phase === "restore-offer") restoredFromOffer.current = true;
  }, [formDraft.state.phase]);
  /* S09 (UNIT-029): ختم المرجع الموسوم عند اختيار مرجع من القائمة — القالب
   * النشط إن وُجد يُختم بمراجعته؛ القراءة اللاحقة تبقى من اللقطة لا من المصدر. */
  function chooseCatalogItem(itemId: string) {
    setDraft(current => (current ? { ...current, catalogItemId: itemId || null } : current));
    if (!itemId) {
      setDraft(current => (current ? { ...current, offeringRef: null } : current));
      return;
    }
    const item = catalogItems.find(candidate => candidate.id === itemId);
    if (!item) return;
    void catalog.listTemplates(itemId).then(result => {
      if (!result.ok) return;
      const active = result.templates.find(template => template.active) ?? null;
      setDraft(current =>
        current
          ? {
              ...current,
              offeringRef: stampOfferingRef(item, active, new Date().toISOString()),
            }
          : current,
      );
    });
  }
  function chooseGroupOffering(groupId: string, itemId: string) {
    if (!itemId) {
      updateGroup(groupId, { offeringRef: null });
      return;
    }
    const item = catalogItems.find(candidate => candidate.id === itemId);
    if (!item) return;
    void catalog.listTemplates(itemId).then(result => {
      if (!result.ok) return;
      const active = result.templates.find(template => template.active) ?? null;
      updateGroup(groupId, {
        offeringRef: stampOfferingRef(item, active, new Date().toISOString()),
      });
    });
  }
  function updateGroup(groupId: string, patch: Partial<DraftGroup>) {
    setDraft(current =>
      current
        ? {
            ...current,
            groups: (current.groups ?? []).map(group =>
              group.id === groupId ? { ...group, ...patch } : group,
            ),
          }
        : current,
    );
  }
  function addGroup() {
    setDraft(current =>
      current ? { ...current, groups: [...(current.groups ?? []), newGroup(reuseKind)] } : current,
    );
  }
  function removeGroup(groupId: string) {
    setDraft(current =>
      current
        ? { ...current, groups: (current.groups ?? []).filter(group => group.id !== groupId) }
        : current,
    );
  }
  /* و٥ (§٥-١): أول إدخال حقيقي يُنشئ المسودة — مرة واحدة، وبأحدث قيم مرئية.
   * لا تنقّل ولا تُفقد التركيز؛ المسار يبقى «new» حتى يغادر المستخدم المحرر.
   * S09: المجموعة الفارغة التسمية ليست إدخالًا حقيقيًا — تُسقط من الإنشاء
   * الأول فقط وتبقى أمام المستخدم في الحقول كما هي. */
  function ensureMaterialized(): Promise<OrderDraft | null> {
    const current = draftRef.current;
    if (current && current.id !== "new") return Promise.resolve(current);
    if (!current) return Promise.resolve(null);
    const values = draftFormValues(current);
    if (!initialValuesRef.current || equalDraftValues(values, initialValuesRef.current))
      return Promise.resolve(null);
    if (!hasRealDraftInput(values)) return Promise.resolve(null);
    if (!materializePromiseRef.current) {
      const groupsForCreate =
        values.groups && values.groups.some(group => group.label.trim() !== "")
          ? values.groups.filter(group => group.label.trim() !== "")
          : null;
      materializePromiseRef.current = drafts
        .create(current.intent, {
          ...values,
          groups: groupsForCreate,
          /* U-004: يبقى رابط التقدير المصدر مع المسودة — أثر سجل فقط. */
          sourceEstimateId: current.sourceEstimateId ?? null,
        })
        .then(result => {
          materializePromiseRef.current = null;
          if (!result.ok) {
            setFeedback({ kind: "error", word: result.message });
            return null;
          }
          /* و٥/و٦: المرجع يتحدّث لحظة نجاح الإنشاء — قبل الالتزام — كي لا يُنشئ
           * إدخال متزامن مسودة ثانية أثناء حل الوعد. */
          draftRef.current = result.draft;
          setDraft(latest => (latest ? { ...result.draft, ...draftFormValues(latest) } : result.draft));
          initialValuesRef.current = draftFormValues(result.draft);
          notifyDataChanged();
          return result.draft;
        });
    }
    return materializePromiseRef.current;
  }
  useEffect(() => {
    if (!isNewDraft || state !== "ready" || !draft || draft.id !== "new") return;
    const values = draftFormValues(draft);
    if (!initialValuesRef.current || equalDraftValues(values, initialValuesRef.current)) return;
    if (!hasRealDraftInput(values)) return;
    void ensureMaterialized();
  }, [draft, isNewDraft, state]);

  async function save(andContinue: boolean): Promise<boolean> {
    if (!draft) return false;
    if (andContinue && !draft.itemName.trim()) {
      setFeedback({
        kind: "error",
        word: "وصف القطعة: اكتب وصفًا مختصرًا ثم أعد المحاولة للانتقال للتكلفة.",
      });
      return false;
    }
    if (!isQuantityValid) {
      setFeedback({ kind: "error", word: "الكمية: استخدم أرقام 0–9 صحيحة ثم أعد الحفظ." });
      return false;
    }
    if (!isSuggestedPriceValid) {
      setFeedback({ kind: "error", word: "السعر المقترح: أدخل مبلغًا بالأرقام 0–9 أو اتركه فارغًا." });
      return false;
    }
    if (andContinue && !draft.specifications.trim()) {
      setFeedback({ kind: "error", word: "ملاحظات التخصيص: أضف ما يلزم للاتفاق قبل الانتقال للتكلفة." });
      return false;
    }
    let toSave = draft;
    /* و٦: رقم المسودة كما فُتحت — يمنع طمس تعديل أو نسخة تكلفة أحدث من نافذة ثانية. */
    const expectedUpdatedAt = draft.updatedAt;
    if (draft.id === "new") {
      const materialized = await ensureMaterialized();
      if (!materialized) {
        setFeedback({ kind: "error", word: "لم تدخل بيانات بعد؛ لا تُحفظ مسودة فارغة." });
        return false;
      }
      const latest = draftRef.current;
      toSave = latest ? { ...materialized, ...draftFormValues(latest) } : materialized;
    }
    setIsSaving(true);
    setFeedback(null);
    const result = await drafts.save(toSave, toSave.id === draft.id ? expectedUpdatedAt : undefined);
    setIsSaving(false);
    if (!result.ok) {
      setFeedback({ kind: "error", word: result.message });
      /* و٦: عند التعارض يتحدّث رقم المسودة وما جُدّد فيها من نافذة أخرى،
       * وتبقى كتابة المستخدم في الحقول كما هي — يراجع ثم يعيد الحفظ. */
      if (result.code === "conflict" && !isNewDraft) {
        const fresh = await drafts.get(params.id);
        if (fresh.ok && fresh.value) {
          const latest = draftRef.current;
          setDraft(latest ? { ...fresh.value, ...draftFormValues(latest) } : fresh.value);
          initialValuesRef.current = draftFormValues(fresh.value);
        }
      }
      return false;
    }
    setDraft(result.draft);
    initialValuesRef.current = draftFormValues(result.draft);
    notifyDataChanged();
    /* S09: نجاح الحفظ النهائي يحذف مسودة النموذج العابرة — السجل هو المصدر الآن. */
    void formDraft.clearFormDraft();
    setFeedback({ kind: "completion", word: "تم حفظ المسودة على هذا الجهاز." });
    if (andContinue) navigate(`/orders/draft/${toSave.id}/cost`);
    return true;
  }
  const requestNavigation = useUnsavedChangesGuard({ isDirty, onSave: () => save(false) });
  /* S1-04: وصلة الكتالوج تمرّ بالحارس نفسه وتحمل المصدر — لا ضياع صامت للمدخلات. */
  const linkTo = useReferrerLinks();
  /* القرار ٢١ (R-2): الحد القاطع يُقرأ من الحقل — linkedOrderId !== null ⇒ الزر لا يظهر أصلًا.
   * الحذف بلا سبب وبلا أثر مالي: المسودة ليست طلبًا ولا تحمل مالًا.
   * و٥: المحرر الفارغ بلا سجل — لا شيء يُحذف بعد. */
  const canDelete = draft !== null && draft.id !== "new" && draft.linkedOrderId === null;
  async function deleteDraft() {
    if (!draft) return;
    setIsDeleting(true);
    const result = await drafts.delete(draft.id);
    setIsDeleting(false);
    if (!result.ok) {
      setFeedback({ kind: "error", word: result.message });
      return;
    }
    notifyDataChanged();
    void formDraft.discardDraft();
    navigate("/orders", { replace: true });
  }
  /* S09 (UNIT-029 — AC01/AC32/AC44): الحفظ الصريح للاستخدام مرة أخرى — مفتاح
   * تشغيلي ثابت يجعل المحاولة المتكررة نية واحدة، والنتيجة صادقة تميّز الجديد
   * من الموجود؛ لا أثر مالي إطلاقًا ولا تغيير للمسودة نفسها. */
  async function saveForReuse() {
    if (!draft || draft.id === "new") return;
    const name = (reuseName ?? draft.itemName).trim();
    if (!name) {
      setReuseFeedback({ kind: "error", word: "اكتب اسم العرض قبل الحفظ للاستخدام مرة أخرى." });
      return;
    }
    setIsSavingReuse(true);
    setReuseFeedback(null);
    const result = await catalog.saveOfferingFromDraft({
      kind: reuseKind,
      name,
      operationKey: `draft-reuse:${draft.id}:${reuseKind}:${name.trim().replace(/\s+/g, " ").toLocaleLowerCase("ar-JO")}`,
    });
    setIsSavingReuse(false);
    if (!result.ok) {
      setReuseFeedback({ kind: "error", word: result.message });
      return;
    }
    notifyDataChanged();
    setReuseFeedback(
      result.alreadyExisted
        ? {
            kind: "advisory",
            word: `«${result.item.name}» محفوظ أصلًا بنفس الاسم والنوع — لم نُنشئ نسخة ثانية ولم يتغير أي سجل.`,
          }
        : {
            kind: "completion",
            word: `حُفظ «${result.item.name}» في منتجاتي وخدماتي — اختره من أي مسودة قادمة؛ لم يُسجَّل أي أثر مالي.`,
          },
    );
  }
  if (state === "loading")
    return (
      <div className="micro-route-loading" role="status">
        جارٍ فتح المسودة…
      </div>
    );
  if (state === "not_found")
    return (
      <section className="micro-page micro-not-found">
        <h1>لم نجد هذه المسودة</h1>
        <p>قد تكون حذفت محليًا أو لم تُحفظ بعد.</p>
        <Button
          action="secondary"

          onClick={() => navigate("/orders")}
        >
          العودة للطلبات
        </Button>
      </section>
    );
  if (state === "error" || !draft)
    return (
      <section className="micro-page micro-not-found">
        <h1>تعذر فتح المسودة</h1>
        <p role="alert">لم يتم تغيير بياناتك. أعد المحاولة من قائمة الطلبات.</p>
        <Button
          action="secondary"

          onClick={() => navigate("/orders")}
        >
          العودة للطلبات
        </Button>
      </section>
    );
  if (draft.linkedOrderId)
    return (
      <section className="micro-page micro-not-found">
        <span className="micro-overline">اتفاق محفوظ</span>
        <h1>هذه المسودة أصبحت طلبًا محليًا</h1>
        <p>لا نعدل تفاصيلها من هنا حتى لا يختلف الوصف عن الاتفاق وسجل التكلفة.</p>
        <Button
          action="secondary"

          onClick={() => navigate(`/orders/${draft.linkedOrderId}`)}
        >
          فتح الطلب
        </Button>
      </section>
    );
  const isCustomerOrder = draft.intent === "customer_order";
  const hasFormError = feedback?.kind === "error";
  const groups = draft.groups ?? [];
  const derivedGroupQuantity = groups.reduce((total, group) => total + group.repeatQuantity, 0);
  return (
    <section className="micro-page">
      <button className="micro-back-button" type="button" onClick={() => requestNavigation(returnPath)}>
        <ArrowRight aria-hidden="true" /> العودة للطلبات
      </button>
      <div className="micro-page-heading">
        <span className="micro-overline">مسودة محلية</span>
        <h1>{isCustomerOrder ? "طلب من عميل" : "تصميم مخطط"}</h1>
        <p>نسجل القصة والكمية الآن. التكلفة والاتفاق يأتيان بعد ذلك.</p>
      </div>
      {/* U-004: إشعار الجسر من التقدير — اقتراحات معلنة لا أسعار مؤكدة. */}
      {estimateNotice ? <FeedbackNote kind="advisory" word={estimateNotice} /> : null}
      {/* S09: عرض استعادة مسودة النموذج صريح — استرجع أو تجاهل، لا تطبيق صامت. */}
      {formDraft.state.phase === "restore-offer" ? (
        <FormDraftRestoreBanner
          savedAt={formDraft.state.savedAt}
          onRestore={formDraft.restoreDraft}
          onDiscard={formDraft.discardDraft}
        />
      ) : null}
      {formDraft.state.phase === "drafting" && formDraft.state.saveFailed ? (
        <p className="micro-field-error" role="alert">
          تعذر حفظ مسودة النموذج محليًا — قيمك أمامك كما هي ولم يُسجَّل أي أثر مالي.
        </p>
      ) : null}
      <section className="micro-form-card">
        <label className="micro-field">
          <span>
            وصف القطعة <small>مطلوب قبل الانتقال للتكلفة</small>
          </span>
          <input
            value={draft.itemName}
            onChange={event =>
              setDraft(current => (current ? { ...current, itemName: event.target.value } : current))
            }
            placeholder="مثال: صندوق خشبي مخصص"
            aria-invalid={hasFormError && !draft.itemName.trim()}
            aria-describedby={hasFormError ? "draft-form-error" : undefined}
          />
        </label>
        <label className="micro-field">
          <span>
            مرجع العمل <small>اختياري للأعمال المتكررة فقط</small>
          </span>
          <select value={draft.catalogItemId ?? ""} onChange={event => chooseCatalogItem(event.target.value)}>
            <option value="">لا أربط هذه المسودة بمرجع الآن</option>
            {catalogItems
              .filter(item => item.active || item.id === draft.catalogItemId)
              .map(item => (
                <option key={item.id} value={item.id}>
                  {item.name} · {item.kind === "product" ? "منتج" : "خدمة"}
                  {item.active ? "" : " (موقوف)"}
                </option>
              ))}
          </select>
          {draft.offeringRef ? (
            <small>لقطة مختومة بمراجعتها وقت الاختيار — تعديل الأصل لاحقًا لا يغيّرها.</small>
          ) : (
            <small>لا يغيّر المرجع السعر أو نسخة التكلفة أو تكلفة طلب سابق.</small>
          )}
        </label>
        <Button
          action="secondary"

          onClick={() => requestNavigation(linkTo("/catalog"))}
        >
          <BookOpen aria-hidden="true" /> منتجاتي وخدماتي
        </Button>
        {isCustomerOrder ? (
          <>
            {/* Conflict B: اسم طلب ودّي اختياري — يعبر إلى الاتفاق والطلب. */}
            <label className="micro-field">
              <span>
                اسم الطلب <small>اختياري — تسمية تعرضها فوق اسم العمل</small>
              </span>
              <input
                value={draft.orderName ?? ""}
                onChange={event =>
                  setDraft(current => (current ? { ...current, orderName: event.target.value } : current))
                }
                maxLength={80}
              />
            </label>
            <label className="micro-field">
              <span>
                اسم الجهة <small>اختياري في المسودة</small>
              </span>
              <input
                value={draft.customerName}
                onChange={event =>
                  setDraft(current => (current ? { ...current, customerName: event.target.value } : current))
                }
                placeholder="مثال: سارة"
              />
            </label>
          </>
        ) : null}
        <label className="micro-field">
          <span>
            الكمية <small>أرقام 0–9</small>
          </span>
          <EnglishNumberInput
            key={`quantity-${rawInputEpoch}`}
            value={draft.quantity}
            kind="integer"
            min="1"
            aria-label="الكمية بالأرقام 0–9"
            aria-invalid={!isQuantityValid}
            aria-describedby={hasFormError && !isQuantityValid ? "draft-form-error" : undefined}
            initialRawText={quantityRawText}
            onNumericChange={quantity => setDraft(current => (current ? { ...current, quantity } : current))}
            onTextValidityChange={setIsQuantityValid}
            onTextChange={text => setQuantityRawText(text)}
          />
        </label>
        <label className="micro-field">
          <span>السعر المقترح للبيع</span>
          <EnglishNumberInput
            key={`suggested-price-${rawInputEpoch}`}
            value={draft.suggestedPriceMinor ?? null}
            kind="money"
            allowEmpty
            aria-invalid={!isSuggestedPriceValid}
            aria-describedby={hasFormError && !isSuggestedPriceValid ? "draft-form-error" : undefined}
            initialRawText={suggestedPriceRawText}
            onNumericChange={minor =>
              setDraft(current => (current ? { ...current, suggestedPriceMinor: minor } : current))
            }
            onTextValidityChange={setIsSuggestedPriceValid}
            onTextChange={text => setSuggestedPriceRawText(text)}
            onEmptyChange={() =>
              setDraft(current => (current ? { ...current, suggestedPriceMinor: null } : current))
            }
          />
          <small>اقتراحك لا اتفاق ولا حدًا أدنى.</small>
        </label>
        <label className="micro-field">
          <span>
            ملاحظات التخصيص <small>مطلوبة قبل تسجيل الاتفاق</small>
          </span>
          <textarea
            value={draft.specifications}
            onChange={event =>
              setDraft(current => (current ? { ...current, specifications: event.target.value } : current))
            }
            placeholder="لون، قياس، اسم أو تفاصيل مهمة…"
            rows={4}
            aria-describedby={hasFormError ? "draft-form-error" : undefined}
          />
        </label>
        {/* S09 (UNIT-007): مجموعات الطلب — هوية ثابتة لكل مجموعة وتكرارها
            يُطبَّق مرة واحدة عند حساب التكلفة؛ لا تُبنى من الكتالوج إجبارًا. */}
        <fieldset className="micro-field">
          <legend>مجموعات الطلب</legend>
          {groups.length > 0 ? (
            <p className="micro-offline-truth">
              مجموع كامل التكرار: <bdi dir="ltr">{derivedGroupQuantity}</bdi>
            </p>
          ) : null}
          {groups.map(group => (
            <div className="micro-draft-group" key={group.id}>
              <label className="micro-field">
                <span>اسم المجموعة</span>
                <input
                  value={group.label}
                  onChange={event => updateGroup(group.id, { label: event.target.value })}
                  maxLength={200}
                  aria-invalid={hasFormError && !group.label.trim()}
                  aria-describedby={hasFormError ? "draft-form-error" : undefined}
                />
              </label>
              <label className="micro-field">
                <span>
                  التكرار <small>أرقام 0–9</small>
                </span>
                <EnglishNumberInput
                  value={group.repeatQuantity}
                  kind="integer"
                  min="1"
                  aria-label={`تكرار ${group.label || "مجموعة"} بالأرقام 0–9`}
                  onNumericChange={repeat =>
                    updateGroup(group.id, { repeatQuantity: Math.max(1, Math.trunc(repeat)) })
                  }
                />
              </label>
              <label className="micro-field">
                <span>نوع العرض</span>
                <select
                  value={group.offeringType}
                  onChange={event =>
                    updateGroup(group.id, {
                      offeringType: event.target.value === "service" ? "service" : "product",
                    })
                  }
                >
                  <option value="product">منتج</option>
                  <option value="service">خدمة</option>
                </select>
              </label>
              <label className="micro-field">
                <span>مرجع محفوظ</span>
                <select
                  value={group.offeringRef?.catalogItemId ?? ""}
                  onChange={event => chooseGroupOffering(group.id, event.target.value)}
                >
                  <option value="">بدون مرجع محفوظ</option>
                  {catalogItems
                    .filter(item => item.active)
                    .map(item => (
                      <option key={item.id} value={item.id}>
                        {item.name} · {item.kind === "product" ? "منتج" : "خدمة"}
                      </option>
                    ))}
                </select>
                {group.offeringRef ? <small>لقطة مختومة بمراجعتها وقت الاختيار.</small> : null}
              </label>
              <label className="micro-field">
                <span>ملاحظة المجموعة</span>
                <input
                  value={group.note ?? ""}
                  onChange={event => updateGroup(group.id, { note: event.target.value || null })}
                  maxLength={500}
                />
              </label>
              <Button action="quiet" onClick={() => removeGroup(group.id)}>
                <Trash2 aria-hidden="true" /> إزالة المجموعة
              </Button>
            </div>
          ))}
          <Button action="secondary" onClick={addGroup}>
            <Plus aria-hidden="true" /> أضف مجموعة
          </Button>
        </fieldset>
        {feedback ? <FeedbackNote id="draft-form-error" kind={feedback.kind} word={feedback.word} /> : null}
        <div className="micro-form-actions">
          <Button
            action="secondary"

            disabled={isSaving || !isQuantityValid || !isSuggestedPriceValid}
            onClick={() => {
              void save(false);
            }}
          >
            <Save aria-hidden="true" /> حفظ مسودة
          </Button>
          <Button
            action="save"

            disabled={isSaving || !isQuantityValid || !isSuggestedPriceValid || !draft.itemName.trim()}
            onClick={() => {
              void save(true);
            }}
          >
            {isSaving ? "جارٍ الحفظ…" : "احسب التكلفة"}
          </Button>
        </div>
        {/* S09 (UNIT-029): حفظ صريح اختياري بعد حفظ بيانات المسودة — لا حفظ
            كتالوج آليًا من مسودة أبدًا، وتجاهل الزر لا يمنع شيئًا. */}
        {draft.id !== "new" ? (
          <fieldset className="micro-field">
            <legend>حفظ لاستخدامه مرة أخرى</legend>
            <label className="micro-field">
              <span>نوع العرض</span>
              <select
                value={reuseKind}
                onChange={event => setReuseKind(event.target.value === "service" ? "service" : "product")}
              >
                <option value="product">منتج</option>
                <option value="service">خدمة</option>
              </select>
            </label>
            <label className="micro-field">
              <span>
                اسم العرض <small>يبدأ من وصف المسودة — عدّله إن أردت</small>
              </span>
              <input
                value={reuseName ?? draft.itemName}
                onChange={event => setReuseName(event.target.value)}
                maxLength={200}
              />
            </label>
            {reuseFeedback ? <FeedbackNote kind={reuseFeedback.kind} word={reuseFeedback.word} /> : null}
            <Button
              action="secondary"

              disabled={isSavingReuse || !(reuseName ?? draft.itemName).trim()}
              onClick={() => {
                void saveForReuse();
              }}
            >
              {isSavingReuse ? "جارٍ الحفظ…" : "احفظه لاستخدامه مرة أخرى"}
            </Button>
          </fieldset>
        ) : null}
        {canDelete ? (
          <div className="micro-draft-delete-zone">
            {confirmDelete ? (
              <>
                <p>
                  حذف المسودة يزيلها من هذا الجهاز نهائيًا — بلا سبب ولا أثر مالي، لأنها لم تصبح طلبًا. لا
                  يمكن التراجع بعد الحذف.
                </p>
                <div className="micro-form-actions">
                  <Button
                    action="secondary"

                    disabled={isDeleting}
                    onClick={() => {
                      void deleteDraft();
                    }}
                  >
                    <Trash2 aria-hidden="true" /> {isDeleting ? "جارٍ الحذف…" : "احذف المسودة نهائيًا"}
                  </Button>
                  <Button action="quiet" onClick={() => setConfirmDelete(false)}>
                    {DISMISS_PANEL_CLOSE_LABEL}
                  </Button>
                </div>
              </>
            ) : (
              <Button
                action="quiet"

                onClick={() => setConfirmDelete(true)}
              >
                <Trash2 aria-hidden="true" /> احذف المسودة
              </Button>
            )}
          </div>
        ) : null}
      </section>
    </section>
  );
}
