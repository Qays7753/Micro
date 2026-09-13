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
  formatQuantityMilliFixed3,
  localDateInAmman,
} from "@/presentation/formatters";
import {
  buildCatalogConversionPreview,
  buildCatalogPerUnitPreview,
  catalogAllocationKindLabel,
  catalogAllocationStatusLabel,
  catalogConversionDirectionText,
  catalogConversionExactnessWarning,
  catalogDimensionOptions,
  catalogOperationUuid,
  catalogPerUnitRateLabel,
  catalogPerUnitRoundingNote,
  catalogYieldReadinessLabel,
  currentMonth,
  dimensionLabel,
  isCatalogTemplateDirty,
  monthEndDate,
  nextDay,
  operationKey,
  parseCatalogJodMinor,
  parseCatalogPercentageBps,
  parseCatalogPositiveSafeInteger,
  parseCatalogQuantityMilli,
  quantityLabel,
} from "@/presentation/catalogPresentation";
import { CatalogItemsSection } from "@/components/catalog/CatalogItemsSection";
import { CatalogUnitsSection } from "@/components/catalog/CatalogUnitsSection";
import { CatalogTemplatesSection } from "@/components/catalog/CatalogTemplatesSection";
import { CatalogPoliciesSection } from "@/components/catalog/CatalogPoliciesSection";
import { CatalogReadingsSection } from "@/components/catalog/CatalogReadingsSection";
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

export default function Catalog() {
  const [, navigate] = useLocation();
  /* المجموعة ١ (Scope A): الرجوع يعود للمصدر (?from) مع بديل قانوني موثّق. */
  const returnPath = useReturnPath();
  const { catalog, recurringWork, dataVersion, notifyDataChanged, inventory } = usePrototypeServices();
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
        id: catalogOperationUuid(),
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
    (!defaultPriceEmpty && defaultPriceValid && defaultPrice > 0),
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

      <CatalogItemsSection
        kind={kind}
        setKind={setKind}
        name={name}
        setName={setName}
        unitLabel={unitLabel}
        setUnitLabel={setUnitLabel}
        unitId={unitId}
        setUnitId={setUnitId}
        defaultPrice={defaultPrice}
        setDefaultPrice={setDefaultPrice}
        defaultPriceEmpty={defaultPriceEmpty}
        setDefaultPriceEmpty={setDefaultPriceEmpty}
        defaultPriceValid={defaultPriceValid}
        setDefaultPriceValid={setDefaultPriceValid}
        defaultCost={defaultCost}
        setDefaultCost={setDefaultCost}
        defaultCostEmpty={defaultCostEmpty}
        setDefaultCostEmpty={setDefaultCostEmpty}
        defaultCostValid={defaultCostValid}
        setDefaultCostValid={setDefaultCostValid}
        defaultsEditingId={defaultsEditingId}
        setDefaultsEditingId={setDefaultsEditingId}
        editingPrice={editingPrice}
        setEditingPrice={setEditingPrice}
        editingPriceEmpty={editingPriceEmpty}
        setEditingPriceEmpty={setEditingPriceEmpty}
        editingPriceValid={editingPriceValid}
        setEditingPriceValid={setEditingPriceValid}
        editingCost={editingCost}
        setEditingCost={setEditingCost}
        editingCostEmpty={editingCostEmpty}
        setEditingCostEmpty={setEditingCostEmpty}
        editingCostValid={editingCostValid}
        setEditingCostValid={setEditingCostValid}
        items={items}
        activeUnits={activeUnits}
        saving={saving}
        create={create}
        openDefaultsEditor={openDefaultsEditor}
        saveDefaults={saveDefaults}
        requestSafeNavigation={requestSafeNavigation}
      />

      <CatalogUnitsSection
        unitName={unitName}
        setUnitName={setUnitName}
        unitDimension={unitDimension}
        setUnitDimension={setUnitDimension}
        conversionFrom={conversionFrom}
        setConversionFrom={setConversionFrom}
        conversionTo={conversionTo}
        setConversionTo={setConversionTo}
        conversionNumerator={conversionNumerator}
        setConversionNumerator={setConversionNumerator}
        conversionNumeratorValid={conversionNumeratorValid}
        setConversionNumeratorValid={setConversionNumeratorValid}
        conversionDenominator={conversionDenominator}
        setConversionDenominator={setConversionDenominator}
        conversionDenominatorValid={conversionDenominatorValid}
        setConversionDenominatorValid={setConversionDenominatorValid}
        conversionNote={conversionNote}
        setConversionNote={setConversionNote}
        units={units}
        conversions={conversions}
        activeUnits={activeUnits}
        conversionFromUnit={conversionFromUnit}
        conversionToUnit={conversionToUnit}
        conversionPreview={conversionPreview}
        createUnit={createUnit}
        deactivateUnit={deactivateUnit}
        createConversion={createConversion}
        deactivateConversion={deactivateConversion}
      />

      <CatalogTemplatesSection
        selectedItemId={selectedItemId}
        setSelectedItemId={setSelectedItemId}
        templateTitle={templateTitle}
        setTemplateTitle={setTemplateTitle}
        templateNote={templateNote}
        setTemplateNote={setTemplateNote}
        templateComponents={templateComponents}
        setTemplateComponents={setTemplateComponents}
        componentName={componentName}
        setComponentName={setComponentName}
        componentMaterialId={componentMaterialId}
        setComponentMaterialId={setComponentMaterialId}
        componentQuantity={componentQuantity}
        setComponentQuantity={setComponentQuantity}
        componentQuantityValid={componentQuantityValid}
        setComponentQuantityValid={setComponentQuantityValid}
        componentUnitId={componentUnitId}
        setComponentUnitId={setComponentUnitId}
        yieldEnabled={yieldEnabled}
        setYieldEnabled={setYieldEnabled}
        yieldQuantity={yieldQuantity}
        setYieldQuantity={setYieldQuantity}
        yieldQuantityValid={yieldQuantityValid}
        setYieldQuantityValid={setYieldQuantityValid}
        yieldUnitId={yieldUnitId}
        setYieldUnitId={setYieldUnitId}
        editingTemplateId={editingTemplateId}
        extrasOpen={extrasOpen}
        setExtrasOpen={setExtrasOpen}
        autoConsumeOnDelivery={autoConsumeOnDelivery}
        setAutoConsumeOnDelivery={setAutoConsumeOnDelivery}
        extraTimeMinutes={extraTimeMinutes}
        setExtraTimeMinutes={setExtraTimeMinutes}
        extraRateMinor={extraRateMinor}
        setExtraRateMinor={setExtraRateMinor}
        extraPackagingMinor={extraPackagingMinor}
        setExtraPackagingMinor={setExtraPackagingMinor}
        extraDeliveryMinor={extraDeliveryMinor}
        setExtraDeliveryMinor={setExtraDeliveryMinor}
        extraWasteMinor={extraWasteMinor}
        setExtraWasteMinor={setExtraWasteMinor}
        extraBufferMinor={extraBufferMinor}
        setExtraBufferMinor={setExtraBufferMinor}
        activeUnits={activeUnits}
        units={units}
        items={items}
        materials={materials}
        selectedItem={selectedItem}
        selectedItemUnit={selectedItemUnit}
        selectedTemplates={selectedTemplates}
        saving={saving}
        addComponent={addComponent}
        saveTemplate={saveTemplate}
        deactivateTemplate={deactivateTemplate}
        startRevision={startRevision}
        resetTemplateForm={resetTemplateForm}
      />

      <CatalogPoliciesSection
        periodFrom={periodFrom}
        setPeriodFrom={setPeriodFrom}
        periodTo={periodTo}
        setPeriodTo={setPeriodTo}
        policyKind={policyKind}
        setPolicyKind={setPolicyKind}
        policyAmount={policyAmount}
        setPolicyAmount={setPolicyAmount}
        policyAmountValid={policyAmountValid}
        setPolicyAmountValid={setPolicyAmountValid}
        policyRate={policyRate}
        setPolicyRate={setPolicyRate}
        policyRateValid={policyRateValid}
        setPolicyRateValid={setPolicyRateValid}
        policyPercentage={policyPercentage}
        setPolicyPercentage={setPolicyPercentage}
        policyPercentageValid={policyPercentageValid}
        setPolicyPercentageValid={setPolicyPercentageValid}
        policyUnitId={policyUnitId}
        setPolicyUnitId={setPolicyUnitId}
        policySource={policySource}
        setPolicySource={setPolicySource}
        policyReason={policyReason}
        setPolicyReason={setPolicyReason}
        policyNote={policyNote}
        setPolicyNote={setPolicyNote}
        policyPeriodFrom={policyPeriodFrom}
        setPolicyPeriodFrom={setPolicyPeriodFrom}
        policyPeriodTo={policyPeriodTo}
        setPolicyPeriodTo={setPolicyPeriodTo}
        selectedItemId={selectedItemId}
        setSelectedItemId={setSelectedItemId}
        selectedItem={selectedItem}
        selectedItemUnit={selectedItemUnit}
        perUnitPreview={perUnitPreview}
        items={items}
        activeUnits={activeUnits}
        saving={saving}
        savePolicy={savePolicy}
        resetTemplateForm={resetTemplateForm}
      />

      <CatalogReadingsSection
        readings={readings}
        items={items}
        units={units}
        policyStopId={policyStopId}
        setPolicyStopId={setPolicyStopId}
        deactivate={deactivate}
        deactivateAllocationPolicy={deactivateAllocationPolicy}
        startPolicyRevision={startPolicyRevision}
      />
      {message ? (
        <p className="micro-save-note" role="status">
          {message}
        </p>
      ) : null}
    </section>
  );
}
