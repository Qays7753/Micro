/**
 * S10 (UNIT-031/032 T01 — أمر b56967d8): حاسبة التكلفة والتسعير — أداة
 * التخطيط الأولى. مجموعات منتج/خدمة بكمية تكرار وطريقة تكلفة واحدة نشطة
 * (تفصيل مكونات الوحدة أو إجمالي الكمية كاملة) وسعر بيع حر يكتبه
 * المستخدم، فتظهر النتيجة المتوقعة وهامشها من سعر البيع — كلها عبر النواة
 * الواحدة (SH-13) بلا محرك ثانٍ ولا أي أثر أعمال (لا بيع ولا مصروف ولا
 * طلب ولا مخزون ولا حفظ كتالوج). الحفظ صريح اختياري داخل الحاسبة
 * (UNIT-032): «حفظ الحساب» ثم «حساباتي المحفوظة» عند وجود محفوظ؛ فتح
 * الحساب القديم يعيد مدخلاته بمعرفته ولا يعيد تسعيره بأسعار اليوم.
 * التقديرات القديمة (ما قبل S10) تفتح في محررها التوافقي بنطاقها الأصلي
 * بلا إعادة تفسير.
 */
import { ArrowRight, Calculator, Plus, Save } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useSearch } from "wouter";
import { useReturnPath } from "@/app/useReturnNavigation";
import { usePrototypeServices } from "@/app/PrototypeServicesContext";
import { useFormDirty } from "@/components/forms/useFormDirty";
import { useUnsavedChangesGuard } from "@/components/forms/UnsavedChangesGuard";
import { MoneyValue } from "@/components/presentation/DisplayValue";
import { EnglishNumberInput } from "@/components/forms/EnglishNumberInput";
import {
  emptyPlanningGroup,
  PlanningGroupEditor,
  toPersistGroup,
  type EditablePlanningGroup,
} from "@/components/planning/PlanningGroupEditor";
import { LegacyEstimateEditor } from "@/components/planning/LegacyEstimateEditor";
import { SavedCalculations } from "@/components/planning/SavedCalculations";
import { suggestPlanningPrice } from "@/application/planning";
import { formatMoneyMinor } from "@/presentation/formatters";
import type { PlanningCalculationResult } from "@micro-domain/planning/index.js";
import type { CostEstimate } from "@/storage/local/types";
import type { PlanningPersistExtraRow } from "@/storage/local/planningCalculationTypes";

import { Button } from "@/components/primitives";

type ExtraRowState = { uiId: string; amountMinor: number; description: string };

/* معرّف الحساب المطلوب فتحه يُقرأ دفاعيًا من البحث؛ غير الصالح يُهمل بهدوء. */
function estimateIdFromSearch(search: string): string | null {
  const value = new URLSearchParams(search).get("estimate");
  return value && /^[A-Za-z0-9_-]{1,64}$/.test(value) ? value : null;
}

function extraRowsOf(rows: readonly ExtraRowState[]): PlanningPersistExtraRow[] {
  return rows
    .filter(row => row.amountMinor > 0)
    .map(row => ({
      rowId: row.uiId,
      amountMinor: row.amountMinor,
      description: row.description.trim() || null,
    }));
}

function emptyExtraRow(index: number): ExtraRowState {
  return { uiId: `x-${index}-${Date.now()}`, amountMinor: 0, description: "" };
}

export default function CostCalculator() {
  const [, navigate] = useLocation();
  const returnPath = useReturnPath();
  const search = useSearch();
  const requestedEstimateId = estimateIdFromSearch(search);
  const { costEstimates, planningCalculations, dataVersion, notifyDataChanged, inventory } =
    usePrototypeServices();

  /* قائمة الحسابات المحفوظة — تُقرأ من بيتها عبر الخدمة حصرًا. */
  const [savedEstimates, setSavedEstimates] = useState<readonly CostEstimate[]>([]);
  const [listPhase, setListPhase] = useState<"loading" | "error" | "ready">("loading");
  const [reloadToken, setReloadToken] = useState(0);
  useEffect(() => {
    let active = true;
    setListPhase("loading");
    void costEstimates.list().then(result => {
      if (!active) return;
      if (!result.ok) setListPhase("error");
      else {
        setSavedEstimates(result.value);
        setListPhase("ready");
      }
    });
    return () => {
      active = false;
    };
  }, [costEstimates, dataVersion, reloadToken]);

  /* فتح محفوظ: حساب تخطيط يعيد مدخلاته في المحرر نفسه؛ وتقدير قديم يفتح
   * في محرره التوافقي بنطاقه — بلا إعادة تفسير ولا إعادة تسعير. */
  const [openedLegacy, setOpenedLegacy] = useState<CostEstimate | null>(null);
  const [openPhase, setOpenPhase] = useState<"idle" | "loading" | "missing">("idle");
  useEffect(() => {
    if (!requestedEstimateId) {
      setOpenedLegacy(null);
      setOpenPhase("idle");
      return;
    }
    let active = true;
    setOpenPhase("loading");
    void costEstimates.get(requestedEstimateId).then(result => {
      if (!active) return;
      if (!result.ok) {
        setOpenPhase("missing");
        return;
      }
      if (!result.value) {
        setOpenPhase("missing");
        return;
      }
      const record = result.value;
      if (record.planning) {
        /* حساب تخطيط: يعاد ملء المحرر التخطيطي بمدخلاته كما حُفظت. */
        setTitle(record.title);
        setGroups(
          record.planning.groups.map((group, index) => ({
            uiId: group.groupId || `g-${index}-${Date.now()}`,
            label: group.label,
            offeringType: group.offeringType,
            repeatQuantity: group.repeatQuantity,
            costMode: group.costMode,
            components: group.unitComponents.map((component, componentIndex) => ({
              uiId: `${group.groupId}-c${componentIndex}`,
              name: component.name,
              quantity: component.quantity,
              unit: component.unit,
              unitPriceMinor: component.unitPriceMinor,
              materialId: component.materialId ?? null,
            })),
            totalCostMinor: group.totalCostMinor,
            sellingPriceMinor: group.sellingPriceMinor,
          })),
        );
        setTimeKnown(record.planning.time !== null);
        setTimeMinutes(record.planning.time?.minutes ?? 0);
        setTimeRateMinor(record.planning.time?.hourlyRateMinor ?? 0);
        setPackagingMinor(record.planning.packagingMinor);
        setWasteMinor(record.planning.wasteMinor);
        setDeliveryMinor(record.planning.deliveryMinor);
        setOtherRevenues(
          record.planning.otherRevenues.map((row, index) => ({
            uiId: row.rowId || `r-${index}`,
            amountMinor: row.amountMinor,
            description: row.description ?? "",
          })),
        );
        setOtherExpenses(
          record.planning.otherExpenses.map((row, index) => ({
            uiId: row.rowId || `e-${index}`,
            amountMinor: row.amountMinor,
            description: row.description ?? "",
          })),
        );
        setDiscount(
          record.planning.discount
            ? {
                enabled: true,
                mode: record.planning.discount.mode,
                value:
                  record.planning.discount.mode === "amount"
                    ? record.planning.discount.amountMinor
                    : record.planning.discount.percentCenti / 100,
              }
            : { enabled: false, mode: "amount", value: 0 },
        );
        setCommission(
          record.planning.commission
            ? {
                enabled: true,
                mode: record.planning.commission.mode,
                value:
                  record.planning.commission.mode === "amount"
                    ? record.planning.commission.amountMinor
                    : record.planning.commission.percentCenti / 100,
                basis:
                  record.planning.commission.mode === "percent"
                    ? record.planning.commission.basis
                    : "products_after_discount",
              }
            : { enabled: false, mode: "amount", value: 0, basis: "products_after_discount" },
        );
        setEditingId(record.id);
        setOpenedLegacy(null);
        setOpenPhase("idle");
        setLoadedToken(token => token + 1);
        return;
      }
      setOpenedLegacy(record);
      setOpenPhase("idle");
    });
    return () => {
      active = false;
    };
  }, [costEstimates, requestedEstimateId]);

  /* حالة المحرر التخطيطي. */
  const [title, setTitle] = useState("");
  const [groups, setGroups] = useState<EditablePlanningGroup[]>([emptyPlanningGroup(1)]);
  const [timeKnown, setTimeKnown] = useState(false);
  const [timeMinutes, setTimeMinutes] = useState(0);
  const [timeRateMinor, setTimeRateMinor] = useState(0);
  const [packagingMinor, setPackagingMinor] = useState(0);
  const [wasteMinor, setWasteMinor] = useState(0);
  const [deliveryMinor, setDeliveryMinor] = useState(0);
  const [otherRevenues, setOtherRevenues] = useState<ExtraRowState[]>([]);
  const [otherExpenses, setOtherExpenses] = useState<ExtraRowState[]>([]);
  const [discount, setDiscount] = useState<{ enabled: boolean; mode: "amount" | "percent"; value: number }>({
    enabled: false,
    mode: "amount",
    value: 0,
  });
  const [commission, setCommission] = useState<{
    enabled: boolean;
    mode: "amount" | "percent";
    value: number;
    basis: "products_after_discount" | "order_total";
  }>({ enabled: false, mode: "amount", value: 0, basis: "products_after_discount" });
  const [showOptional, setShowOptional] = useState(false);
  const [message, setMessage] = useState<{ text: string; tone: "error" | "success" } | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [loadedToken, setLoadedToken] = useState(0);
  /* مفتاح نية الحفظ: الضغط المتكرر/إعادة المحاولة بعد فشل = حساب واحد. */
  const saveOperationKey = useRef<string | null>(null);

  const planningInput = useMemo(
    () => ({
      title,
      groups: groups.map(toPersistGroup),
      time:
        timeKnown && timeMinutes > 0 && timeRateMinor > 0
          ? { minutes: timeMinutes, hourlyRateMinor: timeRateMinor, confidence: "known" as const }
          : null,
      packagingMinor,
      wasteMinor,
      deliveryMinor,
      otherRevenues: extraRowsOf(otherRevenues),
      otherExpenses: extraRowsOf(otherExpenses),
      discount: discount.enabled
        ? discount.mode === "amount"
          ? ({ mode: "amount", amountMinor: discount.value } as const)
          : ({ mode: "percent", percentCenti: Math.round(discount.value * 100) } as const)
        : null,
      commission: commission.enabled
        ? commission.mode === "amount"
          ? ({ mode: "amount", amountMinor: commission.value } as const)
          : ({
              mode: "percent",
              percentCenti: Math.round(commission.value * 100),
              basis: commission.basis,
            } as const)
        : null,
    }),
    [
      title,
      groups,
      timeKnown,
      timeMinutes,
      timeRateMinor,
      packagingMinor,
      wasteMinor,
      deliveryMinor,
      otherRevenues,
      otherExpenses,
      discount,
      commission,
    ],
  );

  const preview = useMemo<PlanningCalculationResult | null>(
    () => {
      /* الخدمة كسولة (نمط assets/loans): null = «جارٍ التجهيز» — تُعلن بصدق
       * أسفلها ولا تُعرض نتيجة مزيفة. */
      if (!planningCalculations) return null;
      const outcome = planningCalculations.previewPlanning(planningInput);
      return outcome.ok ? outcome.value : null;
    },
    // المعاينة الحية نقية — تجدد مع كل تغيير مدخل.
    [planningCalculations, planningInput],
  );
  const previewError = useMemo(() => {
    if (!planningCalculations) return null;
    const outcome = planningCalculations.previewPlanning(planningInput);
    return outcome.ok ? null : outcome.message;
  }, [planningCalculations, planningInput]);

  const isDirty = useFormDirty(
    [
      title,
      groups,
      timeKnown,
      timeMinutes,
      timeRateMinor,
      packagingMinor,
      wasteMinor,
      deliveryMinor,
      otherRevenues,
      otherExpenses,
      discount,
      commission,
    ],
    loadedToken,
  );
  const requestNavigation = useUnsavedChangesGuard({
    isDirty,
    onSave: () => save(false),
  });

  /* مساعدة اقتراح السعر — اقتراح صريح بأساس معلن، لا توليد تلقائي. */
  const [aimKind, setAimKind] = useState<"amount" | "margin" | "markup">("amount");
  const [aimValue, setAimValue] = useState(0);
  const [suggestion, setSuggestion] = useState<string | null>(null);

  function suggestPrice() {
    if (!preview) {
      setSuggestion(null);
      return;
    }
    const unitCost = preview.unitCostMinor;
    const aim =
      aimKind === "amount"
        ? ({ kind: "amount", amountMinor: aimValue } as const)
        : aimKind === "margin"
          ? ({ kind: "margin", marginPercentCenti: Math.round(aimValue * 100) } as const)
          : ({ kind: "markup", markupPercentCenti: Math.round(aimValue * 100) } as const);
    const outcome = suggestPlanningPrice(unitCost, aim);
    setSuggestion(
      outcome.ok
        ? aimKind === "amount"
          ? `تكلفة الوحدة ${formatMoneyMinor(unitCost) ?? "—"} + مبلغ ${formatMoneyMinor(aimValue) ?? "—"} ⇒ سعر مقترح ${formatMoneyMinor(outcome.value) ?? "—"} د.أ`
          : aimKind === "margin"
            ? `هامش ${aimValue}٪ من سعر البيع ⇒ سعر مقترح ${formatMoneyMinor(outcome.value) ?? "—"} د.أ (التكلفة ÷ (1 − الهامش))`
            : `زيادة ${aimValue}٪ على التكلفة ⇒ سعر مقترح ${formatMoneyMinor(outcome.value) ?? "—"} د.أ (التكلفة × (1 + الزيادة))`
        : outcome.message,
    );
  }

  async function save(asCopy: boolean): Promise<boolean> {
    if (!planningCalculations) {
      setMessage({ text: "جارٍ تجهيز خدمة الحفظ — لحظة ثم أعد المحاولة.", tone: "error" });
      return false;
    }
    if (!preview) {
      setMessage({ text: previewError ?? "مدخلات الحساب غير صالحة.", tone: "error" });
      return false;
    }
    setSaving(true);
    setMessage(null);
    let outcome;
    if (editingId && !asCopy) {
      outcome = await planningCalculations.updatePlanning(editingId, planningInput);
    } else {
      /* حفظ جديد أو نسخة صريحة: مفتاح نية جديد لكل نسخة، ونفس المفتاح للإعادة. */
      if (asCopy || saveOperationKey.current === null) {
        saveOperationKey.current = `planning-save-${Date.now()}-${Math.random().toString(36).slice(2)}`;
      }
      outcome = await planningCalculations.savePlanning(planningInput, saveOperationKey.current);
    }
    setSaving(false);
    if (!outcome.ok) {
      setMessage({ text: outcome.message, tone: "error" });
      return false;
    }
    notifyDataChanged();
    setEditingId(outcome.value.id);
    setLoadedToken(token => token + 1);
    setMessage({
      tone: "success",
      text: asCopy
        ? "حُفظت نسخة جديدة بهوية مستقلة — الأصل باقٍ كما هو."
        : editingId && !asCopy
          ? "حُفظ تعديل الحساب نفسه — بلا أي حركة مالية أو مخزون."
          : "تم حفظ الحساب لمراجعته لاحقًا — لم تُنشأ أي حركة مالية ولا مخزون.",
    });
    void refreshList();
    return true;
  }

  async function refreshList() {
    const result = await costEstimates.list();
    if (result.ok) setSavedEstimates(result.value);
  }

  async function removeEstimate(id: string): Promise<string | null> {
    const result = await costEstimates.remove(id);
    if (!result.ok) return result.message;
    notifyDataChanged();
    if (editingId === id) {
      setEditingId(null);
      saveOperationKey.current = null;
    }
    void refreshList();
    return null;
  }

  function openEstimate(estimate: CostEstimate) {
    /* الرابط داخل الحاسبة نفسها: هوية صالحة ورجوع موثوق للسياق الحالي. */
    const target = `/tools/calculator?estimate=${encodeURIComponent(estimate.id)}`;
    const withReturn = returnPath.includes("?")
      ? target
      : `${target}&returnTo=${encodeURIComponent(returnPath)}`;
    navigate(withReturn);
    setReloadToken(token => token + 1);
  }

  const knowledgeLabel: Record<string, string> = {
    known: "معروفة",
    estimated: "تقديرية",
    partial: "جزئية",
    incomplete: "ناقصة",
    stale: "متقادمة",
    variable: "متغيرة",
  };

  return (
    <section className="micro-page micro-tools-page">
      <button className="micro-back-button" type="button" onClick={() => requestNavigation(returnPath)}>
        <ArrowRight aria-hidden="true" /> أدوات المشروع
      </button>
      <div className="micro-page-heading">
        <span className="micro-overline">أداة تخطيط مستقلة</span>
        <h1>حاسبة التكلفة والتسعير</h1>
        <p>احسب تكلفة منتج افتراضي وجرّب سعره — النتيجة متوقعة بحدود ما أدخلته، بلا أي تسجيل.</p>
      </div>

      <section className="micro-decision-card" aria-label="قاعدة الأداة">
        <span>قاعدة هذه الأداة</span>
        <strong>هذا حساب تقديري. ما انحفظت أي حركة مالية ولا مخزون.</strong>
        <p>سعر البيع حر بلا حد أدنى؛ الربح المتوقع هنا ليس ربحًا محققًا ولا وعدًا.</p>
      </section>

      {listPhase === "error" ? (
        <div className="micro-storage-error" role="alert">
          <strong>تعذر قراءة حساباتك المحفوظة.</strong>
          <p>لم يتغير أي شيء. أعد المحاولة.</p>
          <Button action="save" onClick={() => setReloadToken(token => token + 1)}>
            إعادة المحاولة
          </Button>
        </div>
      ) : null}
      {openPhase === "missing" ? (
        <p className="micro-save-note" role="status">
          لم نجد الحساب المطلوب فتحه (قد حُذف)؛ فُتحت الحاسبة فارغة ولم يتغير شيء.
        </p>
      ) : null}
      {openPhase === "loading" ? (
        <p className="micro-route-loading" role="status">
          جارٍ فتح الحساب…
        </p>
      ) : null}

      {openedLegacy ? (
        <LegacyEstimateEditor
          estimate={openedLegacy}
          service={costEstimates}
          inventory={inventory}
          onSaved={() => {
            void refreshList();
          }}
        />
      ) : (
        <section className="micro-form-card" aria-label="حاسبة التكلفة والتسعير">
          <div className="micro-section-title">
            <Calculator aria-hidden="true" />
            <div>
              <span className="micro-overline">{editingId ? "تعديل حساب محفوظ" : "حساب جديد"}</span>
              <h2>{editingId ? "عدّل حسابك" : "ما الذي ستبيعه؟"}</h2>
            </div>
          </div>
          <label className="micro-field">
            <span>
              عنوان الحساب <small>اختياري</small>
            </span>
            <input
              value={title}
              onChange={event => setTitle(event.target.value)}
              placeholder="مثال: صناديق المناسبة"
            />
          </label>
          {groups.map((group, index) => (
            <PlanningGroupEditor
              key={group.uiId}
              group={group}
              index={index}
              onChange={next =>
                setGroups(current => current.map(item => (item.uiId === group.uiId ? next : item)))
              }
              onRemove={() => setGroups(current => current.filter(item => item.uiId !== group.uiId))}
            />
          ))}
          <button
            className="micro-text-action"
            type="button"
            onClick={() => setGroups(current => [...current, emptyPlanningGroup(current.length + 1)])}
          >
            <Plus aria-hidden="true" /> أضف منتجًا أو خدمة أخرى
          </button>

          <label className="micro-field">
            <span>هل تحسب وقت عملك في التسعير؟</span>
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
              <p className="micro-home-quiet">وقتك هنا تقدير تسعيري — لا يُدفع منه أجر ولا يُسجل مصروف.</p>
            </div>
          ) : null}

          <details
            className="micro-decision-layer"
            open={showOptional}
            onToggle={event => setShowOptional((event.target as HTMLDetailsElement).open)}
          >
            <summary className="micro-decision-layer-summary">
              <span>
                <b>توصيل المشروع وإيرادات ومصاريف أخرى</b>
                <small>اختيارية كلها — مرة واحدة للحساب كله.</small>
              </span>
              <strong>{showOptional ? "أخفِ التفاصيل" : "افتح التفاصيل"}</strong>
            </summary>
            <label className="micro-field">
              <span>تكلفة توصيل على المشروع (د.أ)</span>
              <EnglishNumberInput
                value={deliveryMinor}
                kind="money"
                onNumericChange={setDeliveryMinor}
                aria-label="تكلفة التوصيل على المشروع"
              />
              <small>مرة واحدة للحساب كله — لا رسوم توصيل على الزبون هنا.</small>
            </label>
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
                <span>هدر متوقع (د.أ)</span>
                <EnglishNumberInput
                  value={wasteMinor}
                  kind="money"
                  onNumericChange={setWasteMinor}
                  aria-label="الهدر المتوقع"
                />
              </label>
            </div>
            <p className="micro-home-quiet">إيرادات أخرى (مرة للحساب):</p>
            {otherRevenues.map(row => (
              <div className="micro-field-grid" key={row.uiId}>
                <label className="micro-field">
                  <span>المبلغ (د.أ)</span>
                  <EnglishNumberInput
                    value={row.amountMinor}
                    kind="money"
                    onNumericChange={value =>
                      setOtherRevenues(current =>
                        current.map(item =>
                          item.uiId === row.uiId ? { ...item, amountMinor: value } : item,
                        ),
                      )
                    }
                    aria-label="مبلغ الإيراد الآخر"
                  />
                </label>
                <label className="micro-field">
                  <span>الوصف (اختياري)</span>
                  <input
                    value={row.description}
                    onChange={event =>
                      setOtherRevenues(current =>
                        current.map(item =>
                          item.uiId === row.uiId ? { ...item, description: event.target.value } : item,
                        ),
                      )
                    }
                  />
                </label>
              </div>
            ))}
            <button
              className="micro-text-action"
              type="button"
              onClick={() => setOtherRevenues(current => [...current, emptyExtraRow(current.length + 1)])}
            >
              <Plus aria-hidden="true" /> أضف إيرادًا آخر
            </button>
            <p className="micro-home-quiet">مصاريف أخرى (مرة للحساب):</p>
            {otherExpenses.map(row => (
              <div className="micro-field-grid" key={row.uiId}>
                <label className="micro-field">
                  <span>المبلغ (د.أ)</span>
                  <EnglishNumberInput
                    value={row.amountMinor}
                    kind="money"
                    onNumericChange={value =>
                      setOtherExpenses(current =>
                        current.map(item =>
                          item.uiId === row.uiId ? { ...item, amountMinor: value } : item,
                        ),
                      )
                    }
                    aria-label="مبلغ المصروف الآخر"
                  />
                </label>
                <label className="micro-field">
                  <span>الوصف (اختياري)</span>
                  <input
                    value={row.description}
                    onChange={event =>
                      setOtherExpenses(current =>
                        current.map(item =>
                          item.uiId === row.uiId ? { ...item, description: event.target.value } : item,
                        ),
                      )
                    }
                  />
                </label>
              </div>
            ))}
            <button
              className="micro-text-action"
              type="button"
              onClick={() => setOtherExpenses(current => [...current, emptyExtraRow(current.length + 1)])}
            >
              <Plus aria-hidden="true" /> أضف مصروفًا آخر
            </button>
          </details>

          <details className="micro-decision-layer">
            <summary className="micro-decision-layer-summary">
              <span>
                <b>تجربة السعر: خصم وعملولة</b>
                <small>اختيارية — بأساس معلن لا صامت.</small>
              </span>
              <strong>افتح التجربة</strong>
            </summary>
            <label className="micro-field">
              <span>هل تريد تجربة خصم؟</span>
              <select
                value={discount.enabled ? "yes" : "no"}
                onChange={event =>
                  setDiscount(current => ({ ...current, enabled: event.target.value === "yes" }))
                }
              >
                <option value="no">بلا خصم</option>
                <option value="yes">نعم — خصم واحد</option>
              </select>
            </label>
            {discount.enabled ? (
              <div className="micro-field-grid">
                <label className="micro-field">
                  <span>طريقة الخصم</span>
                  <select
                    value={discount.mode}
                    onChange={event =>
                      setDiscount(current => ({
                        ...current,
                        mode: event.target.value === "percent" ? "percent" : "amount",
                      }))
                    }
                  >
                    <option value="amount">مبلغ ثابت</option>
                    <option value="percent">نسبة من قيمة المنتجات</option>
                  </select>
                </label>
                <label className="micro-field">
                  <span>{discount.mode === "amount" ? "مبلغ الخصم (د.أ)" : "نسبة الخصم (٪)"}</span>
                  <EnglishNumberInput
                    value={discount.value}
                    kind={discount.mode === "amount" ? "money" : "decimal"}
                    onNumericChange={value => setDiscount(current => ({ ...current, value }))}
                    aria-label="قيمة الخصم"
                  />
                </label>
                <p className="micro-home-quiet">الخصم على قيمة المنتجات قبل الإيرادات الإضافية.</p>
              </div>
            ) : null}
            <label className="micro-field">
              <span>هل تريد احتساب عمولة؟</span>
              <select
                value={commission.enabled ? "yes" : "no"}
                onChange={event =>
                  setCommission(current => ({ ...current, enabled: event.target.value === "yes" }))
                }
              >
                <option value="no">بلا عمولة</option>
                <option value="yes">نعم — عمولة بأساس معلن</option>
              </select>
            </label>
            {commission.enabled ? (
              <div className="micro-field-grid">
                <label className="micro-field">
                  <span>طريقة العمولة</span>
                  <select
                    value={commission.mode}
                    onChange={event =>
                      setCommission(current => ({
                        ...current,
                        mode: event.target.value === "percent" ? "percent" : "amount",
                      }))
                    }
                  >
                    <option value="amount">مبلغ ثابت</option>
                    <option value="percent">نسبة بأساس معلن</option>
                  </select>
                </label>
                <label className="micro-field">
                  <span>{commission.mode === "amount" ? "مبلغ العمولة (د.أ)" : "نسبة العمولة (٪)"}</span>
                  <EnglishNumberInput
                    value={commission.value}
                    kind={commission.mode === "amount" ? "money" : "decimal"}
                    onNumericChange={value => setCommission(current => ({ ...current, value }))}
                    aria-label="قيمة العمولة"
                  />
                </label>
                {commission.mode === "percent" ? (
                  <label className="micro-field">
                    <span>أساس العمولة</span>
                    <select
                      value={commission.basis}
                      onChange={event =>
                        setCommission(current => ({
                          ...current,
                          basis:
                            event.target.value === "order_total" ? "order_total" : "products_after_discount",
                        }))
                      }
                    >
                      <option value="products_after_discount">قيمة المنتجات بعد الخصم</option>
                      <option value="order_total">إجمالي الحساب المتوقع</option>
                    </select>
                  </label>
                ) : null}
                <p className="micro-home-quiet">
                  تُحتسب العمولة تكلفة مرة واحدة ولا تتكرر ضمن المصاريف الأخرى.
                </p>
              </div>
            ) : null}
          </details>

          <details className="micro-decision-layer">
            <summary className="micro-decision-layer-summary">
              <span>
                <b>ساعدني في تحديد السعر</b>
                <small>اقتراح اختياري بأساس معلن — السعر قرارك.</small>
              </span>
              <strong>افتح المساعدة</strong>
            </summary>
            <label className="micro-field">
              <span>أساس الاقتراح</span>
              <select
                value={aimKind}
                onChange={event => setAimKind(event.target.value as "amount" | "margin" | "markup")}
              >
                <option value="amount">مبلغ فوق التكلفة</option>
                <option value="margin">هامش من سعر البيع</option>
                <option value="markup">زيادة على التكلفة</option>
              </select>
            </label>
            <label className="micro-field">
              <span>
                {aimKind === "amount"
                  ? "المبلغ فوق التكلفة (د.أ)"
                  : aimKind === "margin"
                    ? "الهامش من سعر البيع (٪)"
                    : "الزيادة على التكلفة (٪)"}
              </span>
              <EnglishNumberInput
                value={aimValue}
                kind={aimKind === "amount" ? "money" : "decimal"}
                onNumericChange={setAimValue}
                aria-label="قيمة هدف التسعير"
              />
            </label>
            <button className="micro-text-action" type="button" onClick={suggestPrice}>
              احسب السعر المقترح
            </button>
            {suggestion ? (
              <p className="micro-save-note" role="status">
                {suggestion}
              </p>
            ) : null}
            <p className="micro-home-quiet">
              هامش الربح نسبة من سعر البيع (الربح ÷ البيع)، والزيادة نسبة من التكلفة — مقامان مختلفان لا
              يخلطان.
            </p>
          </details>

          {!planningCalculations ? (
            <p className="micro-route-loading" role="status">
              جارٍ تجهيز الحاسبة…
            </p>
          ) : preview ? (
            <section className="micro-cost-result" data-knowledge={preview.knowledgeState} aria-live="polite">
              <span className="micro-overline">النتيجة المتوقعة</span>
              {preview.expectedProfitMinor !== null ? (
                <strong>
                  ربح متوقع <MoneyValue minor={preview.expectedProfitMinor} />
                  {preview.marginPercentCenti !== null ? (
                    <>
                      {" "}
                      · هامش <bdi dir="ltr">{preview.marginPercentCenti / 100}</bdi>٪ من سعر البيع
                    </>
                  ) : null}
                </strong>
              ) : (
                <strong>أدخل أسعار البيع لرؤية الربح المتوقع</strong>
              )}
              <p>
                إجمالي متوقع:{" "}
                {preview.expectedTotalMinor !== null ? (
                  <MoneyValue minor={preview.expectedTotalMinor} />
                ) : (
                  "—"
                )}{" "}
                · تكلفة التسعير: <MoneyValue minor={preview.pricingCostMinor} /> · تكلفة الوحدة:{" "}
                <MoneyValue minor={preview.unitCostMinor} /> · حالة المعرفة:{" "}
                {knowledgeLabel[preview.knowledgeState] ?? preview.knowledgeState}
              </p>
              {preview.excludedComponentNames.length > 0 ? (
                <p className="micro-cost-disclaimer">
                  مستثنى من الحساب (مسماة بلا سعر — «غير محدد بعد» لا صفر):{" "}
                  {preview.excludedComponentNames.join("، ")}.
                </p>
              ) : null}
              {!timeKnown ? (
                <p className="micro-cost-disclaimer">وقت عملك غير مُدخل — النتيجة بلا أجر وقتك.</p>
              ) : null}
              {preview.expectedProfitMinor !== null && preview.expectedProfitMinor < 0 ? (
                <p className="micro-cost-disclaimer">بهذا السعر هناك خسارة متوقعة — الرقم صادق والقرار لك.</p>
              ) : null}
              <p className="micro-cost-disclaimer">
                هذا حساب تقديري بحسب التكاليف المدرجة — لا بيع ولا مصروف ولا طلب.
              </p>
            </section>
          ) : (
            <p className="micro-field-error" role="alert">
              {previewError}
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
          <div className="micro-form-actions">
            <Button action="save" disabled={saving || !preview} onClick={() => void save(false)}>
              <Save aria-hidden="true" />{" "}
              {saving ? "جارٍ الحفظ…" : editingId ? "احفظ التعديلات" : "احفظ الحساب"}
            </Button>
            {editingId ? (
              <Button action="secondary" disabled={saving || !preview} onClick={() => void save(true)}>
                احفظ نسخة جديدة
              </Button>
            ) : null}
          </div>
        </section>
      )}

      {listPhase === "ready" ? (
        <SavedCalculations estimates={savedEstimates} onOpen={openEstimate} onDelete={removeEstimate} />
      ) : null}

      <p className="micro-local-truth">
        حسابك يبقى على هذا الجهاز — الحاسبة لا تكتب أي سجل مالي أو مخزون أو طلب.
      </p>
    </section>
  );
}
