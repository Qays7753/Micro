/**
 * Wave 4.2 — P-4.2-5 (قرار المالك F02/T3): سياسات الربح والتوزيع.
 * السطح المرئي انتقل من الكتالوج إلى المالية داخل «ملخص الفترة» بجوار
 * «التغطية والتعادل». المنقول هو السطح ومنطق إدخاله (نقل لا نسخ — أُزيل من
 * Catalog.tsx وCatalogPoliciesSection.tsx في الالتزام نفسه)؛ الخدمة المالية
 * الأساسية (recurringWorkService) لم تتحرك من بيتها بعقد 40، ولا Writer
 * جديد: الكاتب القانوني نفسه عبر سياق الخدمات. الكتالوج يعرض القراءات
 * ونتيجة السياسة ورابطًا إلى هنا فقط — بلا أي كتابة سياسة.
 */
import { useEffect, useMemo, useState } from "react";
import { Check } from "lucide-react";
import { usePrototypeServices } from "@/app/PrototypeServicesContext";
import { EnglishNumberInput } from "@/components/forms/EnglishNumberInput";
import {
  buildCatalogPerUnitPreview,
  catalogAllocationKindLabel,
  catalogPerUnitRateLabel,
  catalogPerUnitRoundingNote,
  currentMonth,
  dimensionLabel,
  monthEndDate,
  nextDay,
  operationKey,
} from "@/presentation/catalogPresentation";
import { formatLocalDateLong, formatMoneyWithUnit } from "@/presentation/formatters";
import type { CatalogItem, MeasurementUnit } from "@micro-domain/catalog/index.js";
import type {
  RecurringWorkPolicyInput,
  RecurringWorkReading,
  RecurringWorkReadings,
} from "@/application/finance/recurringWorkService";

import { Button, FeedbackMessage, FeedbackNote } from "@/components/primitives";

export function FinancePoliciesSection() {
  const { catalog, recurringWork, dataVersion, notifyDataChanged } = usePrototypeServices();
  const month = useMemo(currentMonth, []);
  /* فترة القراءة (لعرض الهامش ومعاينات السياسات) — مستقلة عن نافذة السياسة. */
  const [periodFrom, setPeriodFrom] = useState(month.from);
  const [periodTo, setPeriodTo] = useState(month.to);
  const [policyPeriodFrom, setPolicyPeriodFrom] = useState(month.from);
  const [policyPeriodTo, setPolicyPeriodTo] = useState(month.to);
  const [policyRevisionId, setPolicyRevisionId] = useState<string | null>(null);
  const [items, setItems] = useState<readonly CatalogItem[]>([]);
  const [units, setUnits] = useState<readonly MeasurementUnit[]>([]);
  const [readings, setReadings] = useState<RecurringWorkReadings | null>(null);
  const [feedback, setFeedback] = useState<FeedbackMessage | null>(null);
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
  const [selectedItemId, setSelectedItemId] = useState("");
  /* F-082 (القرار ١٦): إيقاف سياسة فعالة بزر ظاهر مع تأكيد يبيّن أثره. */
  const [policyStopId, setPolicyStopId] = useState<string | null>(null);

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

  async function load() {
    const [itemResult, readingResult, unitResult] = await Promise.all([
      catalog.list({ includeInactive: true }),
      recurringWork.readRecurringWork(periodFrom, periodTo),
      catalog.listUnits({ includeInactive: true }),
    ]);
    if (itemResult.ok) setItems(itemResult.items);
    if (readingResult.ok) setReadings(readingResult.value);
    if (unitResult.ok) setUnits(unitResult.units);
  }

  /* إفصاح تدريجي: لا قراءة إلا بعد فتح الطبقة — المستوى الأول للمالية لا
   * يدفع كلفة قراءة السياسات، والطبقة المغلقة لا تحمل شيئًا (مبدأ Micro). */
  const [opened, setOpened] = useState(false);
  useEffect(() => {
    if (!opened) return;
    void load();
  }, [opened, catalog, recurringWork, dataVersion, periodFrom, periodTo]);

  function resetPolicyForm() {
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
  }

  /* منقول حرفيًا من Catalog.tsx (P-4.2-5) — الكاتب القانوني نفسه عبر سياق الخدمات. */
  async function deactivateAllocationPolicy(policyId: string) {
    const result = await recurringWork.deactivatePolicy(policyId);
    if (!result.ok) {
      setFeedback({ kind: "error", word: result.message });
      return;
    }
    setPolicyStopId(null);
    notifyDataChanged();
    await load();
    setFeedback({
      kind: "completion",
      word: "تم إيقاف سياسة التوزيع — لا تُوزّع بها حصص جديدة، والقراءات السابقة تبقى بتوثيقها.",
    });
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
    setFeedback({
      kind: "advisory",
      word: "أنت تعدل نسخة جديدة؛ ستبقى السياسة السابقة محفوظة وتنتهي قبل بداية النسخة الجديدة.",
    });
  }

  async function savePolicy() {
    if (!selectedItemId) {
      setFeedback({ kind: "error", word: "اختر مرجع عمل قبل إضافة سياسة توزيع." });
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
      setFeedback({
        kind: "error",
        word: "أدخل أساس التوزيع بصيغة موجبة واضحة؛ لا نستخدم صفرًا بدل البيانات الناقصة.",
      });
      return;
    }
    if (
      policyKind === "per_output_unit" &&
      (!policyUnitId || !selectedItem?.unitId || policyUnitId !== selectedItem.unitId)
    ) {
      setFeedback({
        kind: "error",
        word: "اختر وحدة ناتج منظمة متوافقة مع وحدة مرجع العمل؛ لا نحوّل الناتج تلقائيًا.",
      });
      return;
    }
    if (!policySource.trim() || !policyReason.trim() || !policyNote.trim()) {
      setFeedback({ kind: "error", word: "مصدر السياسة وسببها وملاحظتها حقول إلزامية." });
      return;
    }
    setSaving(true);
    setFeedback(null);
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
      setFeedback({ kind: "error", word: result.message });
      return;
    }
    resetPolicyForm();
    notifyDataChanged();
    await load();
    setFeedback({
      kind: "completion",
      word: "تم حفظ سياسة التوزيع كقراءة تفسيرية مؤرخة؛ لم ينشأ منها أثر مالي أو تغيير في نسخة التكلفة.",
    });
  }

  return (
    <details
      className="micro-finance-layer"
      onToggle={event => setOpened((event.target as HTMLDetailsElement).open)}
    >
      <summary className="micro-finance-layer-summary">
        <span>
          <b>سياسات الربح والتوزيع</b>
          <small>كيف يُحتسب ربح عملك المتكرر — سياسة لكل مرجع أو نسبة عامة بفترة معلنة</small>
        </span>
        <strong>افتح التفاصيل</strong>
      </summary>
      <section className="micro-form-card">
        <div className="micro-page-heading">
          <span className="micro-overline">سياسة توزيع معلنة عند الطلب</span>
          <h2>فترة القراءة والسياسة</h2>
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
                resetPolicyForm();
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
              <Button
                action="secondary"

                disabled={saving}
                onClick={savePolicy}
              >
                <Check aria-hidden="true" /> {saving ? "جارٍ الحفظ…" : "احفظ السياسة"}
              </Button>
            </>
          ) : (
            <p className="micro-empty-copy">اختر مرجع عمل إذا أردت تسجيل سياسة توزيع اختيارية.</p>
          )}
        </div>
        {/* سياسات المرجع المحدد — الإدارة (نسخ جديدة/إيقاف موثق) من هنا بعد النقل؛
            الكتالوج يعرضها قراءةً ورابطًا إلى هذا السطح فقط. */}
        {selectedReading && selectedReading.policies.length ? (
          <details className="micro-inline-disclosure">
            <summary>سياسات هذا المرجع</summary>
            {selectedReading.policies.map(policy => (
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
                  <Button action="secondary" onClick={() => startPolicyRevision(policy)}>
                    أنشئ نسخة جديدة
                  </Button>
                ) : null}
                {policy.status === "active" ? (
                  <span className="micro-policy-stop">
                    {policyStopId === policy.id ? (
                      <>
                        <small>
                          الإيقاف يمنع توزيعات جديدة بهذه السياسة؛ القراءات السابقة تبقى بتوثيقها ولا يُحذف
                          شيء.
                        </small>
                        <Button
                          action="secondary"
                          onClick={() => {
                            void deactivateAllocationPolicy(policy.id);
                          }}
                        >
                          أكّد الإيقاف
                        </Button>
                        <Button action="quiet" onClick={() => setPolicyStopId(null)}>
                          تراجع
                        </Button>
                      </>
                    ) : (
                      <Button action="quiet" onClick={() => setPolicyStopId(policy.id)}>
                        إيقاف
                      </Button>
                    )}
                  </span>
                ) : null}
              </p>
            ))}
          </details>
        ) : null}
        {feedback ? <FeedbackNote kind={feedback.kind} word={feedback.word} /> : null}
      </section>
    </details>
  );
}
