import { useEffect, useMemo, useState } from "react";
import {
  ArchiveX,
  ArrowRight,
  Check,
  GitCompareArrows,
  Plus,
  RotateCcw,
  Settings2,
  SlidersHorizontal,
  X,
} from "lucide-react";
import { useLocation } from "wouter";
import { usePrototypeServices } from "@/app/PrototypeServicesContext";
import { parseEnglishNumericText, parseEnglishQuantityText } from "@/application/input/englishNumeric";
import { EnglishNumberInput } from "@/components/forms/EnglishNumberInput";
import { EnglishQuantityInput } from "@/components/forms/EnglishQuantityInput";
import { useUnsavedChangesGuard } from "@/components/forms/UnsavedChangesGuard";
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

const jod = (minor: number) => `${(minor / 100).toFixed(2)} د.أ`;
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
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const lastDay = new Date(year, now.getMonth() + 1, 0).getDate();
  return { from: `${year}-${month}-01`, to: `${year}-${month}-${String(lastDay).padStart(2, "0")}` };
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
  if (quantityMilli === null || rateMinorPerWholeUnit === null)
    return { allocationMinor: null, text: null, warning: "تحتاج المعاينة إلى كمية final ومعدل صالحين." };
  if (
    !Number.isSafeInteger(quantityMilli) ||
    quantityMilli <= 0 ||
    !Number.isSafeInteger(rateMinorPerWholeUnit) ||
    rateMinorPerWholeUnit <= 0 ||
    rateMinorPerWholeUnit > Number.MAX_SAFE_INTEGER / quantityMilli
  )
    return {
      allocationMinor: null,
      text: null,
      warning: "لا يمكن الحساب بأمان؛ راجع الكمية والمعدل قبل الحفظ.",
    };
  const rawMinor = rateMinorPerWholeUnit * quantityMilli;
  if (!Number.isSafeInteger(rawMinor) || rawMinor > Number.MAX_SAFE_INTEGER - 500)
    return { allocationMinor: null, text: null, warning: "تجاوز الحساب الدقة الآمنة؛ لم يُقرب الرقم." };
  const allocationMinor = Math.floor((rawMinor + 500) / 1000);
  const label = unitName.trim() || "وحدة كاملة";
  return {
    allocationMinor,
    text: `${(quantityMilli / 1000).toFixed(3)} ${label} × ${(rateMinorPerWholeUnit / 100).toFixed(2)} د.أ لكل 1.000 ${label} = ${(allocationMinor / 100).toFixed(2)} د.أ`,
    warning:
      allocationMinor === 0
        ? "الناتج 0.00 د.أ نتيجة حسابية معلنة بعد تقريب مجموع الفترة، وليس غياب بيانات."
        : null,
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
  const { catalog, recurringWork, dataVersion, notifyDataChanged } = usePrototypeServices();
  const [kind, setKind] = useState<CatalogItemKind>("product");
  const [name, setName] = useState("");
  const [unitLabel, setUnitLabel] = useState("");
  const [unitId, setUnitId] = useState("");
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
  const [showMeasurements, setShowMeasurements] = useState(false);
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
    const [itemResult, readingResult, unitResult, conversionResult, templateResult] = await Promise.all([
      catalog.list({ includeInactive: true }),
      recurringWork.readRecurringWork(periodFrom, periodTo),
      catalog.listUnits({ includeInactive: true }),
      catalog.listConversions({ includeInactive: true }),
      catalog.listTemplates(undefined, { includeInactive: true }),
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
    setSelectedItemId(result.item.id);
    notifyDataChanged();
    await load();
    setMessage("تم حفظ مرجع العمل محليًا. يمكنك إضافة القياس أو القالب لاحقًا، وليس ذلك مطلوبًا للحفظ.");
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
      setMessage("اختر مرجع عمل قبل إضافة سياسة تحميل.");
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
      setMessage("أدخل أساس التحميل بصيغة موجبة واضحة؛ لا نستخدم صفرًا بدل البيانات الناقصة.");
      return;
    }
    if (
      policyKind === "per_output_unit" &&
      (!policyUnitId || !selectedItem?.unitId || policyUnitId !== selectedItem.unitId)
    ) {
      setMessage("اختر وحدة ناتج منظمة متوافقة مع وحدة مرجع العمل؛ لا نحول yield تلقائيًا.");
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
    setMessage("تم حفظ سياسة التحميل كقراءة تفسيرية مؤرخة؛ لم ينشأ منها قيد مالي أو تغيير في Snapshot.");
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
      },
    ]);
    setComponentName("");
    setComponentQuantity(null);
    setComponentQuantityValid(true);
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
  }

  function startRevision(template: CatalogTemplate) {
    const revisionYieldQuantity = template.yield?.quantityMilli ?? null;
    const revisionYieldUnitId = template.yield?.unitId ?? activeUnits[0]?.id ?? "";
    setEditingTemplateId(template.id);
    setSelectedItemId(template.catalogItemId);
    setTemplateTitle(template.title ?? "");
    setTemplateNote(template.note ?? "");
    setTemplateComponents(template.components);
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
      }),
    );
    setMessage(`تعديل مراجعة القالب ${template.revision}. سيبقى القالب السابق محفوظًا للقراءة.`);
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
    const input = {
      catalogItemId: selectedItemId,
      title: templateTitle.trim() || null,
      note: templateNote.trim() || null,
      components: templateComponents,
      yield: yieldEnabled ? { quantityMilli: parsedYield as number, unitId: yieldUnitId } : null,
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
        : "تم حفظ القالب كمرجع تخطيطي فقط؛ لم يتغير المخزون أو السعر أو أي Snapshot.",
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
  const requestSafeNavigation = useUnsavedChangesGuard({
    isDirty: templateDirty || conversionDirty,
    onSave: async () => {
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

  return (
    <section className="micro-page">
      <button className="micro-back-button" type="button" onClick={() => requestSafeNavigation("/orders")}>
        <ArrowRight aria-hidden="true" /> العودة للطلبات
      </button>
      <div className="micro-page-heading">
        <span className="micro-overline">مرجع اختياري</span>
        <h1>منتجاتي وخدماتي المتكررة</h1>
        <p>نظّم ما تكرره. لا يحدد هذا المرجع سعرًا أو مخزونًا أو ربحًا نهائيًا.</p>
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
        </div>
        <button
          className="micro-button micro-button-primary"
          type="button"
          disabled={saving || !name.trim()}
          onClick={create}
        >
          <Plus aria-hidden="true" /> {saving ? "جارٍ الحفظ…" : "أضف مرجعًا"}
        </button>
      </section>

      <section className="micro-form-card">
        <button
          className="micro-section-toggle"
          type="button"
          aria-expanded={showMeasurements}
          onClick={() => setShowMeasurements(value => !value)}
        >
          <span>
            <SlidersHorizontal aria-hidden="true" /> 2 · القياس والتحويلات <small>اختيارية</small>
          </span>
          {showMeasurements ? <X aria-hidden="true" /> : <Settings2 aria-hidden="true" />}
        </button>
        <p className="micro-muted-copy">
          أضف ما يساعدك على تذكر الكمية. لن ننشئ مخزونًا، ولن نحول الوزن إلى حجم تلقائيًا.
        </p>
        {showMeasurements ? (
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
        ) : null}
      </section>

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
                  <h3>{editingTemplateId ? "مراجعة القالب" : "قالب جديد"}</h3>
                  <p>
                    {selectedItemUnit
                      ? `مخرج المرجع: ${selectedItemUnit.nameAr} · ${dimensionLabel(selectedItemUnit.dimension)}`
                      : "لا توجد وحدة مخرج منظمة؛ يمكن حفظ القالب دون yield."}
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
                <span>{templateComponents.length} مكوّن</span>
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
              </div>
              <button className="micro-button micro-button-secondary" type="button" onClick={addComponent}>
                <Plus aria-hidden="true" /> أضف مكوّنًا للقالب
              </button>
              {templateComponents.length ? (
                <div className="micro-list micro-list-compact">
                  {templateComponents.map(component => (
                    <div className="micro-list-item" key={component.id}>
                      <div>
                        <strong>{component.name}</strong>
                        <p dir="ltr">
                          {quantityLabel(component.quantityMilli)} ·{" "}
                          {units.find(unit => unit.id === component.unitId)?.nameAr ?? "وحدة محفوظة"}
                        </p>
                      </div>
                      <button
                        className="micro-icon-button"
                        type="button"
                        aria-label={`إزالة ${component.name}`}
                        onClick={() =>
                          setTemplateComponents(current => current.filter(entry => entry.id !== component.id))
                        }
                      >
                        <X aria-hidden="true" />
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="micro-empty-copy">
                  لم تضف مكونات بعد. يمكنك حفظ قالب فارغ كملاحظة تخطيطية، أو إضافة ما تكرره عادةً.
                </p>
              )}
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
                  {saving ? "جارٍ الحفظ…" : editingTemplateId ? "احفظ المراجعة" : "احفظ القالب"}
                </button>
                {editingTemplateId ? (
                  <button
                    className="micro-button micro-button-secondary"
                    type="button"
                    onClick={resetTemplateForm}
                  >
                    إلغاء المراجعة
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
                <p>التعديل ينشئ مراجعة جديدة؛ لا يعيد حساب طلب سابق.</p>
              </div>
              {selectedTemplates.length ? (
                <div className="micro-list">
                  {selectedTemplates.map(template => (
                    <article className="micro-list-item" key={template.id}>
                      <div>
                        <strong>
                          {template.title || "قالب بلا عنوان"} · مراجعة {template.revision}
                        </strong>
                        <p>
                          {template.components.length} مكوّن
                          {template.yield
                            ? ` · الناتج ${quantityLabel(template.yield.quantityMilli)}`
                            : " · بلا yield"}
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
                            هذا تذكّر تخطيطي فقط؛ لا Purchase ولا Inventory ولا Consumption ولا COGS ولا إيراد
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
                              <RotateCcw aria-hidden="true" /> مراجعة
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

      <section className="micro-form-card">
        <div className="micro-page-heading">
          <span className="micro-overline">4 · فترة القراءة والسياسة</span>
          <h2>اقرأ قبل أن تقرر</h2>
          <p>
            حدد فترة معلنة، ثم اعرض الهامش المباشر المسجل. أي تحميل اختياري يحتاج سياسة مؤرخة ومصدرًا وسببًا
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
          الهامش المباشر هو الإيراد المعترف به للطلبات <bdi dir="ltr">final</bdi> ناقص التكلفة المباشرة
          المحفوظة في Snapshot. الوقت والهدر وCOGS قراءات منفصلة، وليست أجرًا أو مصروفًا أو خصمًا تلقائيًا.
        </p>
        <div className="micro-subsection">
          <div className="micro-subsection-heading">
            <div>
              <span className="micro-overline">سياسة اختيارية</span>
              <h3>أضف تحميلًا واضحًا</h3>
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
                  <span>أساس التحميل</span>
                  <select
                    value={policyKind}
                    onChange={event => setPolicyKind(event.target.value as RecurringWorkPolicyInput["kind"])}
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
                      aria-label="مبلغ سياسة التحميل"
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
                      aria-label="معدل سياسة التحميل"
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
                      aria-label="نسبة سياسة التحميل"
                    />
                  </label>
                ) : null}
              </div>
              {policyKind === "per_output_unit" ? (
                <div className="micro-inline-disclosure">
                  <p>{perUnitPreview?.text ?? "ستظهر معاينة التحميل بعد وجود كمية final ومعدل صالح."}</p>
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
            <p className="micro-empty-copy">اختر مرجع عمل إذا أردت تسجيل سياسة تحميل اختيارية.</p>
          )}
        </div>
      </section>

      <section className="micro-form-card">
        <div className="micro-page-heading">
          <span className="micro-overline">المراجع المسجلة</span>
          <h2>أعمال متكررة وقراءة القرار</h2>
          <p>
            {readings ? `الفترة المعلنة: ${readings.from} → ${readings.to}` : "جارٍ تحميل القراءة المحلية…"}
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
                        <strong>الهامش المباشر المسجل: {jod(reading.directMarginMinor ?? 0)}</strong> ·{" "}
                        {reading.finalOrderCount} طلب نهائي · كمية {reading.deliveredQuantity}
                      </p>
                    ) : (
                      <p>
                        لا توجد طلبات final مرتبطة بهذا المرجع في الفترة؛ لا تعرض القراءة صفرًا بدل دليل ناقص.
                      </p>
                    )}
                    {reading ? (
                      <>
                        <p>
                          المادة:{" "}
                          {reading.material.actualMaterialMinor === null
                            ? "غير مسجلة بعد"
                            : jod(reading.material.actualMaterialMinor)}
                          {reading.material.varianceMinor === null
                            ? ""
                            : ` · الفرق ${jod(reading.material.varianceMinor)}`}{" "}
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
                          · {reading.time.recordedOrderCount} مسجل / {reading.time.notRecordedOrderCount} بلا
                          سجل
                        </p>
                        <p>
                          الهدر المرتبط بهذا المرجع:{" "}
                          {jod(
                            reading.waste.orderWasteMinor +
                              reading.waste.catalogItemWasteMinor +
                              reading.waste.catalogTemplateWasteMinor,
                          )}{" "}
                          · الهدر العام/غير الموزع منفصل:{" "}
                          {jod(reading.waste.generalProjectWasteMinor + reading.waste.unallocatedWasteMinor)}
                        </p>
                        {allocation ? (
                          <>
                            <p>
                              <strong>
                                الربح بعد التحميل:{" "}
                                {allocation.resultMinor === null ? "غير مكتمل" : jod(allocation.resultMinor)}
                              </strong>{" "}
                              · {catalogAllocationKindLabel(allocation.kind)} ·{" "}
                              {catalogAllocationStatusLabel(allocation.status)}
                            </p>
                            <p>{allocation.calculationNote}</p>
                          </>
                        ) : (
                          <p>لا توجد سياسة تحميل فعالة تغطي الفترة؛ الهامش المباشر هو القراءة الأساسية.</p>
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
                                {policy.status === "active" ? "فعالة" : "غير فعالة"} · {policy.periodFrom} →{" "}
                                {policy.periodTo}
                                {policy.kind === "per_output_unit" && policy.rateMinorPerWholeUnit !== null
                                  ? ` · ${(policy.rateMinorPerWholeUnit / 100).toFixed(2)} د.أ لكل 1.000 وحدة`
                                  : ""}{" "}
                                · {policy.source} · السبب: {policy.reason} · {policy.note}
                                {policy.status === "active" ? (
                                  <button
                                    className="micro-button micro-button-secondary"
                                    type="button"
                                    onClick={() => startPolicyRevision(policy)}
                                  >
                                    أنشئ مراجعة
                                  </button>
                                ) : null}
                              </p>
                            ))}
                          </details>
                        ) : null}
                        <details className="micro-inline-disclosure">
                          <summary>الحقيقة والحدود</summary>
                          <p>{reading.truth}</p>
                          <p>
                            الهدر لا يدخل COGS ولا المصروف تلقائيًا. القراءة لا تعني صافي ربح نهائيًا، ولا
                            توصية سعر، ولا تتضمن تكاليف لم تُسجل.
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
      {message ? (
        <p className="micro-save-note" role="status">
          {message}
        </p>
      ) : null}
    </section>
  );
}
