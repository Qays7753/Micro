import { useEffect, useMemo, useState } from "react";
import { ArchiveX, ArrowRight, Check, GitCompareArrows, Plus, RotateCcw, X } from "lucide-react";
import { useLocation } from "wouter";
import { withFrom } from "@/app/navigationContract";
import { useReturnPath } from "@/app/useReturnNavigation";
import { usePrototypeServices } from "@/app/PrototypeServicesContext";
import { perOutputUnitAmountMinor } from "@micro-domain/recurring-margin/index.js";
import { parseEnglishNumericText, parseEnglishQuantityText } from "@/application/input/englishNumeric";
import { EnglishNumberInput } from "@/components/forms/EnglishNumberInput";
import { EnglishQuantityInput } from "@/components/forms/EnglishQuantityInput";
import { useUnsavedChangesGuard } from "@/components/forms/UnsavedChangesGuard";
import {
  formatLocalDateLong,
  formatMoneyMinor,
  formatMoneyWithUnit,
  localDateInAmman,
} from "@/presentation/formatters";
import { templateComponentCountLabel } from "@/presentation/plurals";
import type {
  CatalogItem,
  CatalogItemKind,
  CatalogTemplate,
  DirectConversion,
  MeasurementUnit,
  UnitDimension,
} from "@micro-domain/catalog/index.js";
import type {
  RecurringWorkPolicyInput,
  RecurringWorkReading,
  RecurringWorkReadings,
} from "@/application/recurring-work/recurringWorkService";

const dimensions: readonly { value: UnitDimension; label: string }[] = [
  { value: "count", label: "عدد" },
  { value: "mass", label: "وزن" },
  { value: "volume", label: "حجم" },
  { value: "time", label: "وقت" },
  { value: "distance", label: "مسافة" },
  { value: "area", label: "مساحة" },
];
const dimensionLabel = (dimension: UnitDimension) =>
  dimensions.find(entry => entry.value === dimension)?.label ?? dimension;
const quantityLabel = (quantityMilli: number) => (quantityMilli / 1000).toFixed(3);
const parseQuantityMilli = (value: string) => {
  const result = parseEnglishQuantityText(value);
  return result !== null && result > 0 ? result : null;
};
const parsePositiveSafeInteger = (value: string) => {
  const result = parseEnglishNumericText(value.trim(), "integer");
  return result !== null && result > 0 ? result : null;
};
export const catalogDimensionOptions = dimensions;
export const parseCatalogQuantityMilli = parseQuantityMilli;
export const parseCatalogPositiveSafeInteger = parsePositiveSafeInteger;
export const catalogConversionExactnessWarning =
  "لا يمكن تمثيل هذا المثال بدقة؛ صحح العامل بدل التقريب الخفي.";
export const catalogConversionDirectionText = (fromName: string, toName: string) =>
  `المصدر: ${fromName.trim()} | الوجهة: ${toName.trim()}`;
export const buildCatalogConversionPreview = (
  fromName: string,
  toName: string,
  numerator: number,
  denominator: number,
  sampleQuantityMilli = 12_000,
) => {
  if (
    !Number.isSafeInteger(numerator) ||
    numerator <= 0 ||
    !Number.isSafeInteger(denominator) ||
    denominator <= 0 ||
    !Number.isSafeInteger(sampleQuantityMilli) ||
    sampleQuantityMilli <= 0
  )
    return {
      exact: false,
      sourceQuantityMilli: sampleQuantityMilli,
      targetQuantityMilli: null,
      text: null,
      warning: catalogConversionExactnessWarning,
    };
  const scaledNumerator = sampleQuantityMilli * numerator;
  if (!Number.isSafeInteger(scaledNumerator) || scaledNumerator % denominator !== 0)
    return {
      exact: false,
      sourceQuantityMilli: sampleQuantityMilli,
      targetQuantityMilli: null,
      text: null,
      warning: catalogConversionExactnessWarning,
    };
  const targetQuantityMilli = scaledNumerator / denominator;
  if (!Number.isSafeInteger(targetQuantityMilli) || targetQuantityMilli <= 0)
    return {
      exact: false,
      sourceQuantityMilli: sampleQuantityMilli,
      targetQuantityMilli: null,
      text: null,
      warning: catalogConversionExactnessWarning,
    };
  const sourceLabel = fromName.trim() || "وحدة المصدر";
  const targetLabel = toName.trim() || "وحدة الوجهة";
  return {
    exact: true,
    sourceQuantityMilli: sampleQuantityMilli,
    targetQuantityMilli,
    text: `${quantityLabel(sampleQuantityMilli)} ${sourceLabel} × ${numerator} ÷ ${denominator} = ${quantityLabel(targetQuantityMilli)} ${targetLabel}`,
    warning: null,
  };
};
export const catalogYieldReadinessLabel = (value: CatalogTemplate["yieldReadiness"]) =>
  value === "ready" ? "مهيأ" : value === "needs_conversion" ? "يحتاج تحويلًا صريحًا" : "غير مهيأ اختياريًا";
export const isCatalogTemplateDirty = (fingerprint: string, baseline: string | null, hasDraft: boolean) =>
  baseline === null ? hasDraft : fingerprint !== baseline;
const operationKey = (prefix: string) => `${prefix}:${crypto.randomUUID()}`;
const currentMonth = () => {
  /* S5-14: شهر عمان لا شهر الجهاز — نفس مصدر الحقيقة الذي تستعمله مالي والكشف. */
  const today = localDateInAmman();
  const year = Number(today.slice(0, 4));
  const month = Number(today.slice(5, 7));
  const lastDay = monthEndDate(year, month);
  return {
    from: `${today.slice(0, 7)}-01`,
    to: `${today.slice(0, 7)}-${String(lastDay).padStart(2, "0")}`,
  };
};
const nextDay = (value: string) => {
  const date = new Date(`${value}T12:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + 1);
  return date.toISOString().slice(0, 10);
};
const monthEndDate = (year: number, month: number) => new Date(Date.UTC(year, month, 0)).getUTCDate();
export const parseCatalogJodMinor = (value: string) => {
  const minor = parseEnglishNumericText(value.trim(), "money");
  return minor !== null && minor > 0 ? minor : null;
};
export const parseCatalogPercentageBps = (value: string) => {
  const bps = parseEnglishNumericText(value.trim(), "percentage");
  return bps !== null && bps >= 1 && bps <= 10_000 ? bps : null;
};
export const catalogAllocationKindLabel = (kind: RecurringWorkReading["policies"][number]["kind"]) =>
  ({
    manual_amount: "مبلغ يدوي للفترة",
    per_output_unit: "معدل لكل 1.000 وحدة كاملة",
    actual_time: "معدل لكل دقيقة فعلية",
    completed_revenue_percentage: "نسبة من الإيراد المكتمل",
  })[kind];
export const catalogPerUnitRateLabel = (unitName: string) =>
  `المعدل لكل 1.000 ${unitName.trim() || "وحدة كاملة"} · د.أ`;
export const catalogPerUnitRoundingNote = "يُقرب مجموع الفترة مرة واحدة إلى أقرب قرش.";
export const buildCatalogPerUnitPreview = (
  quantityMilli: number | null,
  rateMinorPerWholeUnit: number | null,
  unitName: string,
) => {
  const allocation = perOutputUnitAmountMinor(quantityMilli, rateMinorPerWholeUnit);
  if ("problem" in allocation)
    return {
      allocationMinor: null,
      text: null,
      warning:
        allocation.problem === "missing_input"
          ? "تحتاج المعاينة إلى كمية نهائية ومعدل صالحين."
          : allocation.problem === "unsafe_range"
            ? "لا يمكن الحساب بأمان؛ راجع الكمية والمعدل قبل الحفظ."
            : "تجاوز الحساب الدقة الآمنة؛ لم يُقرب الرقم.",
    };
  const allocationMinor = allocation.amountMinor;
  const label = unitName.trim() || "وحدة كاملة";
  return {
    allocationMinor,
    text: `${((quantityMilli ?? 0) / 1000).toFixed(3)} ${label} × ${formatMoneyWithUnit((rateMinorPerWholeUnit ?? 0))} لكل 1.000 ${label} = ${formatMoneyWithUnit(allocationMinor ?? 0)}`,
    warning: null,
  };
};
export const catalogAllocationStatusLabel = (status: "known" | "needs_review" | "incomplete" | null) =>
  status === "known"
    ? "مكتمل"
    : status === "needs_review"
      ? "يحتاج مراجعة"
      : status === "incomplete"
        ? "ناقص"
        : "غير محسوب";

export default function Catalog() {
  const [, navigate] = useLocation();
  /* المجموعة ١ (Scope A): الرجوع يعود للمصدر (?from) مع بديل قانوني موثّق. */
  const returnPath = useReturnPath();
  const { catalog, recurringWork, dataVersion, notifyDataChanged , inventory } = usePrototypeServices();
  const [kind, setKind] = useState<CatalogItemKind>("product");
  const [name, setName] = useState("");
  const [unitLabel, setUnitLabel] = useState("");
  const [unitId, setUnitId] = useState("");
  /* P-002 (الخيار أ): اقتراحات اختيارية على المرجع — اقتراح لا سعر مفروض ولا تكلفة فعلية. */
  const [defaultPrice, setDefaultPrice] = useState(0);
  const [defaultPriceEmpty, setDefaultPriceEmpty] = useState(true);
  const [defaultPriceValid, setDefaultPriceValid] = useState(true);
  const [defaultCost, setDefaultCost] = useState(0);
  const [defaultCostEmpty, setDefaultCostEmpty] = useState(true);
  const [defaultCostValid, setDefaultCostValid] = useState(true);
  /* تحرير اقتراحات مرجع قائم: يفتح لمرجع واحد فقط ويحفظ بالقيم الجديدة. */
  const [defaultsEditingId, setDefaultsEditingId] = useState<string | null>(null);
  const [editingPrice, setEditingPrice] = useState(0);
  const [editingPriceEmpty, setEditingPriceEmpty] = useState(true);
  const [editingPriceValid, setEditingPriceValid] = useState(true);
  const [editingCost, setEditingCost] = useState(0);
  const [editingCostEmpty, setEditingCostEmpty] = useState(true);
  const [editingCostValid, setEditingCostValid] = useState(true);
  const [items, setItems] = useState<readonly CatalogItem[]>([]);
  const month = useMemo(currentMonth, []);
  const [periodFrom, setPeriodFrom] = useState(month.from);
  const [periodTo, setPeriodTo] = useState(month.to);
  const [policyPeriodFrom, setPolicyPeriodFrom] = useState(month.from);
  const [policyPeriodTo, setPolicyPeriodTo] = useState(month.to);
  const [policyRevisionId, setPolicyRevisionId] = useState<string | null>(null);
  const [readings, setReadings] = useState<RecurringWorkReadings | null>(null);
  const [units, setUnits] = useState<readonly MeasurementUnit[]>([]);
  const [conversions, setConversions] = useState<readonly DirectConversion[]>([]);
  const [templates, setTemplates] = useState<readonly CatalogTemplate[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [policyKind, setPolicyKind] = useState<RecurringWorkPolicyInput["kind"]>("manual_amount");
  const [policyAmount, setPolicyAmount] = useState<number | null>(null);
  const [policyRate, setPolicyRate] = useState<number | null>(null);
  const [policyPercentage, setPolicyPercentage] = useState<number | null>(null);
  const [policyAmountValid, setPolicyAmountValid] = useState(true);
  const [policyRateValid, setPolicyRateValid] = useState(true);
  const [policyPercentageValid, setPolicyPercentageValid] = useState(true);
  const [policyUnitId, setPolicyUnitId] = useState("");
  const [policySource, setPolicySource] = useState("");
  const [policyReason, setPolicyReason] = useState("");
  const [policyNote, setPolicyNote] = useState("");

  const [unitName, setUnitName] = useState("");
  const [unitDimension, setUnitDimension] = useState<UnitDimension>("count");
  const [conversionFrom, setConversionFrom] = useState("");
  const [conversionTo, setConversionTo] = useState("");
  const [conversionNumerator, setConversionNumerator] = useState<number | null>(null);
  const [conversionDenominator, setConversionDenominator] = useState<number | null>(null);
  const [conversionNumeratorValid, setConversionNumeratorValid] = useState(true);
  const [conversionDenominatorValid, setConversionDenominatorValid] = useState(true);
  const [conversionNote, setConversionNote] = useState("");

  const [selectedItemId, setSelectedItemId] = useState("");
  const [templateTitle, setTemplateTitle] = useState("");
  const [templateNote, setTemplateNote] = useState("");
  const [templateComponents, setTemplateComponents] = useState<CatalogTemplate["components"]>([]);
  const [componentName, setComponentName] = useState("");
  /* المجموعة ٣ (عقد D5): ربط المكوّن بمادة مخزون — اختياري، والمادة إن رُبطت
   * تُعرض بصدق متتبَّعة/غير متتبَّعة؛ الربط مرجع تخطيط بلا أثر مخزون. */
  const [componentMaterialId, setComponentMaterialId] = useState("");
  const [materials, setMaterials] = useState<
    readonly { id: string; name: string; unitLabel: string; tracked: boolean }[]
  >([]);
  /* المجموعة ٣ (عقد D5): بنود التكلفة الاختيارية على مستوى القالب — مرآة بنية
   * نسخة تكلفة الطلب؛ كلها اختيارية وغيابها حالة صادقة لا صفر مفترض. */
  const [extrasOpen, setExtrasOpen] = useState(false);
  /* المجموعة ٤ (عقد ٢٩): إعلان الخصم التلقائي عند التسليم — علم صريح على القالب. */
  const [autoConsumeOnDelivery, setAutoConsumeOnDelivery] = useState(false);
  const [extraTimeMinutes, setExtraTimeMinutes] = useState<number | null>(null);
  const [extraRateMinor, setExtraRateMinor] = useState<number | null>(null);
  const [extraPackagingMinor, setExtraPackagingMinor] = useState(0);
  const [extraDeliveryMinor, setExtraDeliveryMinor] = useState(0);
  const [extraWasteMinor, setExtraWasteMinor] = useState(0);
  const [extraBufferMinor, setExtraBufferMinor] = useState(0);
  const [componentQuantity, setComponentQuantity] = useState<number | null>(null);
  const [componentQuantityValid, setComponentQuantityValid] = useState(true);
  const [componentUnitId, setComponentUnitId] = useState("");
  const [yieldEnabled, setYieldEnabled] = useState(false);
  const [yieldQuantity, setYieldQuantity] = useState<number | null>(null);
  const [yieldQuantityValid, setYieldQuantityValid] = useState(true);
  const [yieldUnitId, setYieldUnitId] = useState("");
  const [editingTemplateId, setEditingTemplateId] = useState<string | null>(null);
  const [templateBaseline, setTemplateBaseline] = useState<string | null>(null);

  const activeUnits = useMemo(() => units.filter(unit => unit.active), [units]);
  const selectedItem = items.find(item => item.id === selectedItemId) ?? null;
  const selectedItemUnit = selectedItem?.unitId
    ? (units.find(unit => unit.id === selectedItem.unitId) ?? null)
    : null;
  const selectedReading = readings?.items.find(entry => entry.catalogItemId === selectedItemId) ?? null;
  const perUnitPreview =
    policyKind === "per_output_unit"
      ? buildCatalogPerUnitPreview(
          selectedReading?.outputQuantityMilli ?? null,
          policyRate,
          selectedItemUnit?.nameAr ?? selectedItem?.unitLabel ?? "وحدة كاملة",
        )
      : null;
  const selectedTemplates = templates.filter(template => template.catalogItemId === selectedItemId);

  async function load() {
    const [itemResult, readingResult, unitResult, conversionResult, templateResult, materialsResult] =
      await Promise.all([
        catalog.list({ includeInactive: true }),
        recurringWork.readRecurringWork(periodFrom, periodTo),
        catalog.listUnits({ includeInactive: true }),
        catalog.listConversions({ includeInactive: true }),
        catalog.listTemplates(undefined, { includeInactive: true }),
        /* المجموعة ٣ (عقد D5): مواد المخزون لربط مكونات القالب — قراءة فقط. */
        inventory.overview(),
      ]);
    if (itemResult.ok) setItems(itemResult.items);
    else setMessage(itemResult.message);
    if (readingResult.ok) setReadings(readingResult.value);
    else setMessage(readingResult.message);
    if (unitResult.ok) setUnits(unitResult.units);
    else setMessage(unitResult.message);
    if (conversionResult.ok) setConversions(conversionResult.conversions);
    else setMessage(conversionResult.message);
    if (templateResult.ok) setTemplates(templateResult.templates);
    else setMessage(templateResult.message);
    if (materialsResult.ok)
      setMaterials(
        materialsResult.value.materials.map(material => ({
          id: material.id,
          name: material.name,
          unitLabel:
            material.unit === "piece"
              ? "قطعة"
              : material.unit === "meter"
                ? "متر"
                : material.unit === "kilogram"
                  ? "كيلوغرام"
                  : material.unit === "liter"
                    ? "لتر"
                    : "وحدة أخرى",
          tracked: !material.tracking || material.tracking.status === "tracked",
        })),
      );
  }

  useEffect(() => {
    void load();
  }, [catalog, recurringWork, dataVersion, periodFrom, periodTo]);
  useEffect(() => {
    if (!selectedItemId && items.some(item => item.active))
      setSelectedItemId(items.find(item => item.active)?.id ?? "");
    if (!componentUnitId && activeUnits[0]) setComponentUnitId(activeUnits[0].id);
    if (!yieldUnitId && activeUnits[0]) setYieldUnitId(activeUnits[0].id);
    if (!policyUnitId && selectedItem?.unitId) setPolicyUnitId(selectedItem.unitId);
  }, [items, activeUnits, selectedItemId, componentUnitId, yieldUnitId]);

  async function create() {
    setSaving(true);
    setMessage(null);
    const result = await catalog.create({
      kind,
      name,
      unitLabel: unitLabel.trim() || null,
      unitId: unitId || null,
      defaultPriceMinor: defaultPriceEmpty || !defaultPriceValid ? null : defaultPrice,
      defaultUnitCostMinor: defaultCostEmpty || !defaultCostValid ? null : defaultCost,
      operationKey: operationKey("catalog"),
    });
    setSaving(false);
    if (!result.ok) {
      setMessage(result.message);
      return;
    }
    setName("");
    setUnitLabel("");
    setUnitId("");
    setDefaultPrice(0);
    setDefaultPriceEmpty(true);
    setDefaultCost(0);
    setDefaultCostEmpty(true);
    setSelectedItemId(result.item.id);
    notifyDataChanged();
    await load();
    setMessage("تم حفظ مرجع العمل محليًا. يمكنك إضافة القياس أو القالب لاحقًا، وليس ذلك مطلوبًا للحفظ.");
  }

  /* P-002: فتح محرر اقتراحات مرجع قائم بقيمه الحالية. */
  function openDefaultsEditor(item: CatalogItem) {
    setDefaultsEditingId(item.id);
    if (item.defaultPriceMinor == null) {
      setEditingPrice(0);
      setEditingPriceEmpty(true);
    } else {
      setEditingPrice(item.defaultPriceMinor);
      setEditingPriceEmpty(false);
    }
    if (item.defaultUnitCostMinor == null) {
      setEditingCost(0);
      setEditingCostEmpty(true);
    } else {
      setEditingCost(item.defaultUnitCostMinor);
      setEditingCostEmpty(false);
    }
  }

  /* P-002: حفظ الاقتراحات الجديدة — لا يعدّل أي بيع سابق؛ البيع يحتفظ بنسخته. */
  async function saveDefaults(id: string) {
    if (!editingPriceValid || !editingCostValid) {
      setMessage("أدخل الاقتراحات بالأرقام 0–9 أو اتركها فارغة بلا قيمة.");
      return;
    }
    setSaving(true);
    setMessage(null);
    const result = await catalog.updateDefaults(id, {
      defaultPriceMinor: editingPriceEmpty ? null : editingPrice,
      defaultUnitCostMinor: editingCostEmpty ? null : editingCost,
    });
    setSaving(false);
    if (!result.ok) {
      setMessage(result.message);
      return;
    }
    setDefaultsEditingId(null);
    notifyDataChanged();
    await load();
    setMessage("تم حفظ الاقتراحات الجديدة؛ لا يتأثر أي بيع سابق بقيمه المسجّلة.");
  }

  async function deactivate(id: string) {
    const result = await catalog.deactivate(id);
    if (!result.ok) {
      setMessage(result.message);
      return;
    }
    notifyDataChanged();
    await load();
    setMessage("تم إيقاف المرجع للطلبات الجديدة مع بقاء تاريخه محفوظًا.");
  }

  /* F-082 (القرار ١٦): إيقاف سياسة توزيع فعالة بزر ظاهر مع تأكيد يبيّن أثره —
   * سياسة خاطئة لم تعد أبدية، والقراءات السابقة تبقى بتوثيقها. */
  const [policyStopId, setPolicyStopId] = useState<string | null>(null);
  async function deactivateAllocationPolicy(policyId: string) {
    const result = await recurringWork.deactivatePolicy(policyId);
    if (!result.ok) {
      setMessage(result.message);
      return;
    }
    setPolicyStopId(null);
    notifyDataChanged();
    await load();
    setMessage("تم إيقاف سياسة التوزيع — لا تُوزّع بها حصص جديدة، والقراءات السابقة تبقى بتوثيقها.");
  }

  function startPolicyRevision(policy: RecurringWorkReading["policies"][number]) {
    const start = policy.endsOn ? nextDay(policy.endsOn) : month.from;
    const [year, monthNumber] = start.split("-").map(Number);
    const existingRateMinor =
      policy.kind === "per_output_unit" ? policy.rateMinorPerWholeUnit : policy.rateMinor;
    setSelectedItemId(policy.catalogItemId);
    setPolicyRevisionId(policy.id);
    setPolicyKind(policy.kind);
    setPolicyAmount(policy.amountMinor);
    setPolicyRate(existingRateMinor);
    setPolicyPercentage(policy.percentageBps);
    setPolicyAmountValid(true);
    setPolicyRateValid(true);
    setPolicyPercentageValid(true);
    setPolicyUnitId(policy.unitId ?? "");
    setPolicySource(policy.source);
    setPolicyReason(policy.reason);
    setPolicyNote(policy.note);
    setPolicyPeriodFrom(start);
    setPolicyPeriodTo(
      policy.endsOn
        ? `${year}-${String(monthNumber).padStart(2, "0")}-${String(monthEndDate(year!, monthNumber!)).padStart(2, "0")}`
        : month.to,
    );
    setMessage("أنت تعدل نسخة جديدة؛ ستبقى السياسة السابقة محفوظة وتنتهي قبل بداية النسخة الجديدة.");
  }

  async function savePolicy() {
    if (!selectedItemId) {
      setMessage("اختر مرجع عمل قبل إضافة سياسة توزيع.");
      return;
    }
    const amountMinor = policyKind === "manual_amount" ? policyAmount : null;
    const parsedRateMinor =
      policyKind === "per_output_unit" || policyKind === "actual_time" ? policyRate : null;
    const rateMinor = policyKind === "actual_time" ? parsedRateMinor : null;
    const rateMinorPerWholeUnit = policyKind === "per_output_unit" ? parsedRateMinor : null;
    const percentageBps = policyKind === "completed_revenue_percentage" ? policyPercentage : null;
    if (
      (policyKind === "manual_amount" && (!policyAmountValid || amountMinor === null || amountMinor <= 0)) ||
      ((policyKind === "per_output_unit" || policyKind === "actual_time") &&
        (!policyRateValid || parsedRateMinor === null || parsedRateMinor <= 0)) ||
      (policyKind === "completed_revenue_percentage" &&
        (!policyPercentageValid || percentageBps === null || percentageBps <= 0 || percentageBps > 10_000))
    ) {
      setMessage("أدخل أساس التوزيع بصيغة موجبة واضحة؛ لا نستخدم صفرًا بدل البيانات الناقصة.");
      return;
    }
    if (
      policyKind === "per_output_unit" &&
      (!policyUnitId || !selectedItem?.unitId || policyUnitId !== selectedItem.unitId)
    ) {
      setMessage("اختر وحدة ناتج منظمة متوافقة مع وحدة مرجع العمل؛ لا نحوّل الناتج تلقائيًا.");
      return;
    }
    if (!policySource.trim() || !policyReason.trim() || !policyNote.trim()) {
      setMessage("مصدر السياسة وسببها وملاحظتها حقول إلزامية.");
      return;
    }
    setSaving(true);
    setMessage(null);
    const input: RecurringWorkPolicyInput = {
      catalogItemId: selectedItemId,
      kind: policyKind,
      amountMinor,
      rateMinor,
      rateMinorPerWholeUnit,
      percentageBps,
      unitId: policyKind === "per_output_unit" ? policyUnitId : null,
      periodFrom: policyPeriodFrom,
      periodTo: policyPeriodTo,
      startsOn: policyPeriodFrom,
      endsOn: policyPeriodTo,
      source: policySource,
      reason: policyReason,
      note: policyNote,
      idempotencyKey: operationKey("allocation-policy"),
    };
    const { catalogItemId: _catalogItemId, ...successorInput } = input;
    const result = policyRevisionId
      ? await recurringWork.createPolicySuccessor(policyRevisionId, successorInput)
      : await recurringWork.createPolicy(input);
    setSaving(false);
    if (!result.ok) {
      setMessage(result.message);
      return;
    }
    setPolicyAmount(null);
    setPolicyRate(null);
    setPolicyPercentage(null);
    setPolicyAmountValid(true);
    setPolicyRateValid(true);
    setPolicyPercentageValid(true);
    setPolicySource("");
    setPolicyReason("");
    setPolicyNote("");
    setPolicyRevisionId(null);
    notifyDataChanged();
    await load();
    setMessage("تم حفظ سياسة التوزيع كقراءة تفسيرية مؤرخة؛ لم ينشأ منها أثر مالي أو تغيير في نسخة التكلفة.");
  }

  async function createUnit() {
    setMessage(null);
    const result = await catalog.createUnit({
      nameAr: unitName,
      dimension: unitDimension,
      operationKey: operationKey("unit"),
    });
    if (!result.ok) {
      setMessage(result.message);
      return;
    }
    setUnitName("");
    setUnitId(result.unit.id);
    notifyDataChanged();
    await load();
    setMessage("تمت إضافة الوحدة. لم تُنشأ كمية أو حركة مخزون.");
  }

  async function deactivateUnit(id: string) {
    const result = await catalog.deactivateUnit(id);
    if (!result.ok) {
      setMessage(result.message);
      return;
    }
    notifyDataChanged();
    await load();
    setMessage("تم إيقاف الوحدة للاختيار الجديد مع إبقاء المراجع القديمة قابلة للقراءة.");
  }

  async function createConversion(): Promise<boolean> {
    setMessage(null);
    const numerator = conversionNumerator;
    const denominator = conversionDenominator;
    if (
      !conversionNumeratorValid ||
      !conversionDenominatorValid ||
      numerator === null ||
      denominator === null ||
      numerator <= 0 ||
      denominator <= 0
    ) {
      setMessage("أدخل بسطًا ومقامًا صحيحين موجبين بالأرقام 0–9 فقط، من دون تقريب أو نص إضافي.");
      return false;
    }
    const result = await catalog.createConversion({
      fromUnitId: conversionFrom,
      toUnitId: conversionTo,
      numerator,
      denominator,
      note: conversionNote,
      operationKey: operationKey("conversion"),
    });
    if (!result.ok) {
      setMessage(result.message);
      return false;
    }
    setConversionFrom("");
    setConversionTo("");
    setConversionNumerator(null);
    setConversionDenominator(null);
    setConversionNumeratorValid(true);
    setConversionDenominatorValid(true);
    setConversionNote("");
    notifyDataChanged();
    await load();
    setMessage("تم حفظ التحويل المباشر الصريح. لن نمر عبر وحدات أخرى تلقائيًا.");
    return true;
  }

  async function deactivateConversion(id: string) {
    const result = await catalog.deactivateConversion(id);
    if (!result.ok) {
      setMessage(result.message);
      return;
    }
    notifyDataChanged();
    await load();
    setMessage("تم إيقاف التحويل القديم مع إبقاء سجله قابلًا للقراءة.");
  }

  function addComponent() {
    const quantityMilli = componentQuantity;
    if (
      !componentName.trim() ||
      quantityMilli === null ||
      !componentQuantityValid ||
      quantityMilli <= 0 ||
      !componentUnitId
    ) {
      setMessage("أدخل اسم المكوّن وكمية موجبة حتى ثلاثة منازل ووحدة نشطة.");
      return;
    }
    setTemplateComponents(current => [
      ...current,
      {
        id: crypto.randomUUID(),
        name: componentName.trim(),
        quantityMilli,
        unitId: componentUnitId,
        note: null,
        /* المجموعة ٣ (عقد D5): رابط المادة إن اختير — هوية تخطيط لا قيمة مخزنة. */
        materialId: componentMaterialId || null,
      },
    ]);
    setComponentName("");
    setComponentQuantity(null);
    setComponentQuantityValid(true);
    setComponentMaterialId("");
  }

  function resetTemplateForm() {
    setEditingTemplateId(null);
    setTemplateBaseline(null);
    setTemplateTitle("");
    setTemplateNote("");
    setTemplateComponents([]);
    setYieldEnabled(false);
    setYieldQuantity(null);
    setYieldQuantityValid(true);
    setComponentMaterialId("");
    setExtraTimeMinutes(null);
    setExtraRateMinor(null);
    setExtraPackagingMinor(0);
    setExtraDeliveryMinor(0);
    setExtraWasteMinor(0);
    setExtraBufferMinor(0);
    setAutoConsumeOnDelivery(false);
  }

  function startRevision(template: CatalogTemplate) {
    const revisionYieldQuantity = template.yield?.quantityMilli ?? null;
    const revisionYieldUnitId = template.yield?.unitId ?? activeUnits[0]?.id ?? "";
    setEditingTemplateId(template.id);
    setSelectedItemId(template.catalogItemId);
    setTemplateTitle(template.title ?? "");
    setTemplateNote(template.note ?? "");
    setTemplateComponents(template.components);
    setComponentMaterialId("");
    /* المجموعة ٣ (عقد D5): بنود القالب الاختيارية تُحمَّل للتعديل كما هي. */
    setExtraTimeMinutes(template.extras?.timeMinutes ?? null);
    setExtraRateMinor(template.extras?.hourlyRateMinor ?? null);
    setExtraPackagingMinor(template.extras?.packagingMinor ?? 0);
    setExtraDeliveryMinor(template.extras?.deliveryMinor ?? 0);
    setExtraWasteMinor(template.extras?.wasteMinor ?? 0);
    setExtraBufferMinor(template.extras?.safetyBufferMinor ?? 0);
    setAutoConsumeOnDelivery(template.autoConsumeOnDelivery === true);
    setYieldEnabled(template.yield !== null);
    setYieldQuantity(revisionYieldQuantity);
    setYieldQuantityValid(true);
    setYieldUnitId(revisionYieldUnitId);
    setTemplateBaseline(
      JSON.stringify({
        title: (template.title ?? "").trim(),
        note: (template.note ?? "").trim(),
        components: template.components,
        yield: template.yield ? { quantity: revisionYieldQuantity, unitId: revisionYieldUnitId } : null,
        extras: template.extras ?? null,
        autoConsumeOnDelivery: template.autoConsumeOnDelivery === true,
      }),
    );
    setMessage(`تعديل القالب من النسخة ${template.revision}. سيبقى القالب السابق محفوظًا للقراءة.`);
  }

  async function saveTemplate(): Promise<boolean> {
    if (!selectedItemId) {
      setMessage("اختر مرجع عمل قبل إضافة قالب.");
      return false;
    }
    const parsedYield = yieldEnabled ? yieldQuantity : null;
    if (yieldEnabled && (!yieldQuantityValid || parsedYield === null || parsedYield <= 0 || !yieldUnitId)) {
      setMessage("أدخل كمية ناتج موجبة حتى ثلاثة منازل ووحدة ناتج.");
      return false;
    }
    setSaving(true);
    setMessage(null);
    /* المجموعة ٣ (عقد D5): البنود الاختيارية تُبنى مما دخل فعلًا — الوقت بلا
     * أجر أو الأجر بلا وقت يبقى «غير معرف بعد» (null/null) لا صفرًا مفترضًا. */
    const extras =
      extraTimeMinutes !== null ||
      extraRateMinor !== null ||
      extraPackagingMinor > 0 ||
      extraDeliveryMinor > 0 ||
      extraWasteMinor > 0 ||
      extraBufferMinor > 0
        ? {
            timeMinutes: extraTimeMinutes,
            hourlyRateMinor: extraRateMinor,
            packagingMinor: extraPackagingMinor,
            deliveryMinor: extraDeliveryMinor,
            wasteMinor: extraWasteMinor,
            safetyBufferMinor: extraBufferMinor,
          }
        : null;
    const input = {
      catalogItemId: selectedItemId,
      title: templateTitle.trim() || null,
      note: templateNote.trim() || null,
      components: templateComponents,
      yield: yieldEnabled ? { quantityMilli: parsedYield as number, unitId: yieldUnitId } : null,
      extras,
      autoConsumeOnDelivery,
      operationKey: operationKey("template"),
    };
    const result = editingTemplateId
      ? await catalog.reviseTemplate(editingTemplateId, input)
      : await catalog.createTemplate(input);
    setSaving(false);
    if (!result.ok) {
      setMessage(result.message);
      return false;
    }
    resetTemplateForm();
    notifyDataChanged();
    await load();
    setMessage(
      result.template.yieldReadiness === "needs_conversion"
        ? "تم حفظ القالب، لكن الناتج غير مهيأ بعد: أضف تحويلًا صريحًا داخل البعد نفسه."
        : "تم حفظ القالب كمرجع تخطيطي فقط؛ لم يتغير المخزون أو السعر أو أي نسخة تكلفة.",
    );
    return true;
  }

  async function deactivateTemplate(id: string) {
    const result = await catalog.deactivateTemplate(id);
    if (!result.ok) {
      setMessage(result.message);
      return;
    }
    notifyDataChanged();
    await load();
    setMessage("تم إيقاف القالب، وبقيت مراجعته السابقة محفوظة.");
  }

  const currentTemplateFingerprint = JSON.stringify({
    title: templateTitle.trim(),
    note: templateNote.trim(),
    components: templateComponents,
    yield: yieldEnabled ? { quantity: yieldQuantity, unitId: yieldUnitId } : null,
  });
  const hasTemplateDraft = Boolean(
    templateTitle.trim() ||
    templateNote.trim() ||
    templateComponents.length ||
    yieldEnabled ||
    yieldQuantity !== null,
  );
  const templateDirty = isCatalogTemplateDirty(
    currentTemplateFingerprint,
    templateBaseline,
    hasTemplateDraft,
  );
  const conversionDirty = Boolean(
    conversionFrom ||
    conversionTo ||
    conversionNumerator !== null ||
    conversionDenominator !== null ||
    !conversionNumeratorValid ||
    !conversionDenominatorValid ||
    conversionNote.trim(),
  );
  /* S1-14: نموذج «مرجع عمل» الجديد داخل الحارس أيضًا — نصف اسم مسجل لا يضيع
   * صامتًا عند القفز لتسجيل بيع من صف آخر. */
  const referenceDirty = Boolean(
    name.trim() ||
    unitLabel.trim() ||
    defaultPrice ||
    defaultCost ||
    !defaultPriceEmpty && defaultPriceValid && defaultPrice > 0,
  );
  const requestSafeNavigation = useUnsavedChangesGuard({
    isDirty: templateDirty || conversionDirty || referenceDirty,
    onSave: async () => {
      if (referenceDirty) {
        await create();
        return true;
      }
      if (templateDirty && !(await saveTemplate())) return false;
      if (conversionDirty && !(await createConversion())) return false;
      return true;
    },
  });
  const conversionFromUnit = units.find(unit => unit.id === conversionFrom) ?? null;
  const conversionToUnit = units.find(unit => unit.id === conversionTo) ?? null;
  const conversionPreview =
    conversionFromUnit && conversionToUnit && conversionNumerator !== null && conversionDenominator !== null
      ? buildCatalogConversionPreview(
          conversionFromUnit.nameAr,
          conversionToUnit.nameAr,
          conversionNumerator,
          conversionDenominator,
        )
      : null;

  /* مبدأ Micro: يبدأ الكتالوج بمرجع عملي، وتأتي القياسات والقوالب والقراءات عند الحاجة فقط. */
  return (
    <section className="micro-page">
      <button className="micro-back-button" type="button" onClick={() => requestSafeNavigation(returnPath)}>
        <ArrowRight aria-hidden="true" /> رجوع
      </button>
      <div className="micro-page-heading">
        <span className="micro-overline">مرجع اختياري</span>
        <h1>منتجاتي وخدماتي</h1>
        <p>
          نظّم ما تكرره. المرجع يحفظ اقتراحًا اختياريًا للسعر والتكلفة، ولا يحدد مخزونًا ولا ربحًا نهائيًا؛
          البيع الفعلي يُسجّل بقيمه المستقلة.
        </p>
      </div>

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
                            withFrom(
                              `/direct-sales/new?product=${encodeURIComponent(item.id)}`,
                              "/catalog",
                            ),
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
                    {dimensions.map(dimension => (
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
                    <select
                      value={componentUnitId}
                      onChange={event => setComponentUnitId(event.target.value)}
                    >
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
                          عند تأكيد التسليم تكون حركات استهلاك المواد المرتبطة جاهزةً ضمن الخطوة نفسها —
                          بمعاينة وبلا أثر عند فتح الصفحات أو حفظ المسودات.
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
                              هذا تذكّر تخطيطي فقط؛ لا شراء مواد ولا مخزون ولا استهلاك ولا تكلفة بيع ولا
                              إيراد ولا هامش ينشأ منه.
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
                      onChange={event =>
                        setPolicyKind(event.target.value as RecurringWorkPolicyInput["kind"])
                      }
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

      <details className="micro-decision-layer">
        <summary className="micro-decision-layer-summary">
          <span>
            <b>قراءة المراجع</b>
            <small>الهامش المسجل والأدلة والسياسات عند الحاجة.</small>
          </span>
          <strong>افتح التفاصيل</strong>
        </summary>
        <section className="micro-form-card">
          <div className="micro-page-heading">
            <span className="micro-overline">المراجع المسجلة</span>
            <h2>أعمال متكررة وقراءة القرار</h2>
            <p>
              {readings
                ? `الفترة المعلنة: ${formatLocalDateLong(readings.from) ?? readings.from} → ${formatLocalDateLong(readings.to) ?? readings.to}`
                : "جارٍ تحميل القراءة المحلية…"}
            </p>
          </div>
          {items.length ? (
            <div className="micro-list">
              {items.map(item => {
                const reading = readings?.items.find(entry => entry.catalogItemId === item.id);
                const organizedUnit = item.unitId ? units.find(unit => unit.id === item.unitId) : null;
                const allocation = reading?.allocation ?? null;
                return (
                  <article key={item.id} className="micro-list-item">
                    <div>
                      <strong>{item.name}</strong>
                      <p>
                        {item.kind === "product" ? "منتج" : "خدمة"}
                        {item.unitLabel ? ` · ${item.unitLabel}` : ""}
                        {organizedUnit ? ` · ${organizedUnit.nameAr}` : ""}
                        {item.active ? "" : " · موقوف للطلبات الجديدة"}
                      </p>
                      {reading?.directStatus === "recorded" ? (
                        <p>
                          <strong>الهامش المباشر المسجل: {formatMoneyWithUnit(reading.directMarginMinor ?? 0)}</strong> ·{" "}
                          {reading.finalOrderCount} طلب نهائي · كمية {reading.deliveredQuantity}
                        </p>
                      ) : (
                        <p>
                          لا توجد طلبات نهائية مرتبطة بهذا المرجع في الفترة؛ لا تعرض القراءة صفرًا بدل دليل
                          ناقص.
                        </p>
                      )}
                      {reading ? (
                        <>
                          <p>
                            المادة:{" "}
                            {reading.material.actualMaterialMinor === null
                              ? "غير مسجلة بعد"
                              : formatMoneyWithUnit(reading.material.actualMaterialMinor)}
                            {reading.material.varianceMinor === null
                              ? ""
                              : ` · الفرق ${formatMoneyWithUnit(reading.material.varianceMinor)}`}{" "}
                            · {reading.material.recordedOrderCount} مسجل /{" "}
                            {reading.material.notRecordedOrderCount} بلا سجل
                          </p>
                          <p>
                            الوقت:{" "}
                            {reading.time.actualMinutes === null
                              ? "غير مسجل بعد"
                              : `${reading.time.actualMinutes} دقيقة`}
                            {reading.time.varianceMinutes === null
                              ? ""
                              : ` · الفرق ${reading.time.varianceMinutes} دقيقة`}{" "}
                            · {reading.time.recordedOrderCount} مسجل / {reading.time.notRecordedOrderCount}{" "}
                            بلا سجل
                          </p>
                          <p>
                            الهدر المرتبط بهذا المرجع:{" "}
                            {formatMoneyWithUnit(
                              reading.waste.orderWasteMinor +
                                reading.waste.catalogItemWasteMinor +
                                reading.waste.catalogTemplateWasteMinor,
                            )}{" "}
                            · الهدر العام/غير الموزع منفصل:{" "}
                            {formatMoneyWithUnit(
                              reading.waste.generalProjectWasteMinor + reading.waste.unallocatedWasteMinor,
                            )}
                          </p>
                          {allocation ? (
                            <>
                              <p>
                                <strong>
                                  الربح بعد التوزيع:{" "}
                                  {allocation.resultMinor === null
                                    ? "غير مكتمل"
                                    : formatMoneyWithUnit(allocation.resultMinor)}
                                </strong>{" "}
                                · {catalogAllocationKindLabel(allocation.kind)} ·{" "}
                                {catalogAllocationStatusLabel(allocation.status)}
                              </p>
                              <p>{allocation.calculationNote}</p>
                            </>
                          ) : (
                            <p>لا توجد سياسة توزيع فعالة تغطي الفترة؛ الهامش المباشر هو القراءة الأساسية.</p>
                          )}
                          {reading.reasons.map(reason => (
                            <p className="micro-warning-copy" key={reason}>
                              {reason}
                            </p>
                          ))}
                          {reading.policies.length ? (
                            <details className="micro-inline-disclosure">
                              <summary>سياسات هذا المرجع</summary>
                              {reading.policies.map(policy => (
                                <p key={policy.id}>
                                  {catalogAllocationKindLabel(policy.kind)} ·{" "}
                                  {policy.status === "active" ? "فعالة" : "غير فعالة"} ·{" "}
                                  {formatLocalDateLong(policy.periodFrom) ?? policy.periodFrom} →{" "}
                                  {formatLocalDateLong(policy.periodTo) ?? policy.periodTo}
                                  {policy.kind === "per_output_unit" && policy.rateMinorPerWholeUnit !== null
                                    ? ` · ${formatMoneyWithUnit(policy.rateMinorPerWholeUnit)} لكل 1.000 وحدة`
                                    : ""}{" "}
                                  · {policy.source} · السبب: {policy.reason} · {policy.note}
                                  {policy.status === "active" ? (
                                    <button
                                      className="micro-button micro-button-secondary"
                                      type="button"
                                      onClick={() => startPolicyRevision(policy)}
                                    >
                                      أنشئ نسخة جديدة
                                    </button>
                                  ) : null}
                                  {/* F-082 (القرار ١٦): زر إيقاف بجانب كل سياسة فعالة، مع تأكيد يبيّن أثره. */}
                                  {policy.status === "active" ? (
                                    <span className="micro-policy-stop">
                                      {policyStopId === policy.id ? (
                                        <>
                                          <small>
                                            الإيقاف يمنع توزيعات جديدة بهذه السياسة؛ القراءات السابقة تبقى
                                            بتوثيقها ولا يُحذف شيء.
                                          </small>
                                          <button
                                            className="micro-button micro-button-secondary"
                                            type="button"
                                            onClick={() => {
                                              void deactivateAllocationPolicy(policy.id);
                                            }}
                                          >
                                            أكّد الإيقاف
                                          </button>
                                          <button
                                            className="micro-button micro-button-quiet"
                                            type="button"
                                            onClick={() => setPolicyStopId(null)}
                                          >
                                            تراجع
                                          </button>
                                        </>
                                      ) : (
                                        <button
                                          className="micro-button micro-button-quiet"
                                          type="button"
                                          onClick={() => setPolicyStopId(policy.id)}
                                        >
                                          إيقاف
                                        </button>
                                      )}
                                    </span>
                                  ) : null}
                                </p>
                              ))}
                            </details>
                          ) : null}
                          <details className="micro-inline-disclosure">
                            <summary>الحقيقة والحدود</summary>
                            <p>
                              الهدر لا يدخل تكلفة البيع ولا المصروف تلقائيًا. القراءة لا تعني صافي ربح نهائيًا،
                              ولا توصية سعر، ولا تتضمن تكاليف لم تُسجل.
                            </p>
                          </details>
                        </>
                      ) : (
                        <p className="micro-empty-copy">لا تتوفر قراءة لهذا المرجع بعد.</p>
                      )}
                    </div>
                    {item.active ? (
                      <button
                        className="micro-button micro-button-secondary"
                        type="button"
                        onClick={() => deactivate(item.id)}
                      >
                        <ArchiveX aria-hidden="true" /> إيقاف
                      </button>
                    ) : null}
                  </article>
                );
              })}
            </div>
          ) : (
            <p className="micro-empty-copy">
              لا يوجد مرجع بعد. أضف فقط العمل الذي يتكرر كي يصبح تحليله منظمًا لاحقًا.
            </p>
          )}
        </section>
      </details>
      {message ? (
        <p className="micro-save-note" role="status">
          {message}
        </p>
      ) : null}
    </section>
  );
}
