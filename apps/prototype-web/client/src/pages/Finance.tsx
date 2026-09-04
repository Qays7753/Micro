/* مبدأ Micro: ابدأ بقرار الكاش والفعل الأقرب، وأجّل قراءة الفترة والسجل والأثر الكامل إلى طبقات مستقلة. */
/* §2.2: المراجعة اندمجت نبضةً أعلى هذه الصفحة (F-003) — جلسة قراءة أسبوعية لا تستحق مقعدًا. */
import {
  ArrowLeft,
  CircleAlert,
  CircleDollarSign,
  HandCoins,
  Landmark,
  ReceiptText,
  WalletCards,
} from "lucide-react";
import { useEffect, useState } from "react";
import { useLocation, useSearch } from "wouter";
import { useReturnPath } from "@/app/useReturnNavigation";
import { appendQueryParams, withFrom } from "@/app/navigationContract";
import { usePrototypeServices } from "@/app/PrototypeServicesContext";
import type { LocalFinancialPulse } from "@/application/financial-pulse/financialPulseService";
import type { DepositOverview } from "@/application/fulfillment/fulfillmentService";
import type {
  FinancialInsights,
  ProjectFinancialPosition,
  ProjectFinancialService,
  RecordedPeriodResult,
} from "@/application/finance/projectFinancialService";
import type { OwnerEntitlementOverview } from "@/application/finance/ownerEntitlementService";
import type { G5Decision } from "@/application/g5/g5Service";
import type { FinancialEvent, FinancialEventType } from "@micro-domain/financial-event/index.js";
import type { ShortCashDeclaration } from "@micro-domain/g5/index.js";
import type { StoredCraftOrder } from "@/storage/local/types";
import { IntegerValue, LocalDateValue, MoneyValue } from "@/components/presentation/DisplayValue";
import G5DecisionPanel from "@/components/finance/G5DecisionPanel";
import { EventsLayer } from "@/components/finance/EventsLayer";
import { CorrectionsLayer } from "@/components/finance/CorrectionsLayer";
import { RestatementNote } from "@/components/finance/RestatementNote";
import type { CorrectionDigest } from "@/application/finance/correctionHistoryService";
import type { PeriodWasteReading } from "@/application/inventory/inventoryMaterialService";
import { DepositsLayer } from "@/components/finance/DepositsLayer";
import * as G5Display from "@/components/finance/G5DecisionPanel";
import {
  formatBreakEvenDisplay,
  formatLocalDate,
  formatMonthLabel,
  formatMoneyMinor,
  formatQuantityMilli,
  localDateInAmman,
} from "@/presentation/formatters";

type FinanceState =
  | { phase: "loading" }
  | { phase: "error"; message: string }
  | {
      phase: "ready";
      position: ProjectFinancialPosition;
      events: readonly FinancialEvent[];
      period: RecordedPeriodResult;
      /* و٧ (F-077): طبقة المؤشرات داخل قراءة الفترة. */
      insights: FinancialInsights;
      decision: G5Decision;
      /* و٧ (F-079): سجل المتوقعات المسجلة كاملًا داخل التغطية والتعادل. */
      declarations: readonly ShortCashDeclaration[];
      owner: OwnerEntitlementOverview;
      pulse: LocalFinancialPulse;
      excludedOrders: readonly StoredCraftOrder[];
      deposits: DepositOverview;
      /* المجموعة ٦ (البند ٣ — S2-09): خلاصة أثر التصحيحات — كل التاريخ للوضع،
       * وبنطاق الفترة لقراءة الفترة. */
      correctionsAllTime: CorrectionDigest | null;
      correctionsInPeriod: CorrectionDigest | null;
      /* المجموعة ٢ (عقد ٢٨): هدر المخزون داخل الفترة — قراءة مشتقة غير نقدية. */
      periodWaste: PeriodWasteReading | null;
    };
const currentMonth = () => localDateInAmman().slice(0, 7);
const validMonth = (month: string) =>
  /^\d{4}-\d{2}$/.test(month) && Number(month.slice(5)) >= 1 && Number(month.slice(5)) <= 12;
function monthBounds(month: string) {
  const [year, numericMonth] = month.split("-").map(Number);
  const lastDay = new Date(Date.UTC(year!, numericMonth!, 0)).getUTCDate();
  return { from: `${month}-01`, to: `${month}-${String(lastDay).padStart(2, "0")}` };
}
/* §10: مساعدات العرض الخاصة بقراءة G5 انتقلت إلى وحدة الطبقة — الاستيراد بلا نص مكرر. */
const { displayCashAmount, formatted, shortStatusLabel } = G5Display;
const recordedPeriodStatusLabel = (status: RecordedPeriodResult["status"]) =>
  status === "recorded_only" ? "مسجل" : status === "incomplete" ? "ناقص" : "غير متاح";
const cogsStatusLabel = (status: RecordedPeriodResult["cogsStatus"]) =>
  status === "recorded" ? "من الاستهلاك" : status === "partial" ? "جزئي" : "من نسخة التكلفة";

export default function Finance() {
  const [, navigate] = useLocation();
  /* S1-10: الرجوع للمصدر (?from) مع بديل قانوني ثابت (عقد ٢٦ §٢.٢). */
  const returnPath = useReturnPath();
  /* U-001 (دورة التدقيق النهائي): رابط عميق ?event= من «السجل» — يفتح صف الحدث
   * المصدر في طبقة «السجل والأثر» مركّزًا (لا يكتب شيئًا؛ وصول وقراءة وتصحيح موثق). */
  const search = useSearch();
  const focusEventId = new URLSearchParams(search).get("event");
  /* S1-09: ?layer=corrections|events يفتح الطبقة المعنية من الوصلة العميقة (عقد ٢٦ §3.1). */
  const layerParam = new URLSearchParams(search).get("layer");
  /* المجموعة ٢ (§8 — Scope D): انقسام مالي إلى «الوضع الآن» و«الفترة» — قرار
   * أول واضح: شو معي الآن، أو شو صار خلال الفترة. القيمة دفاعية: مجهولة =
   * الوضع. تُحفظ في الرابط فيبقى البدء البارد والتحديث على نية القارئ. */
  const viewParam = new URLSearchParams(search).get("view");
  const [view, setView] = useState<"position" | "period">(
    viewParam === "period" ? "period" : "position",
  );
  const switchView = (next: "position" | "period") => {
    setView(next);
    const query = new URLSearchParams(search);
    query.set("view", next);
    if (next === "position") query.delete("view");
    const rendered = query.toString();
    navigate(rendered ? `/finance?${rendered}` : "/finance", { replace: true });
  };
  const {
    projectFinance,
    correctionHistory,
    ownerEntitlement,
    g5,
    financialPulse,
    fulfillment,
    inventory,
    dataVersion,
    notifyDataChanged,
  } = usePrototypeServices();
  const [fromMonth, setFromMonth] = useState(currentMonth);
  const [toMonth, setToMonth] = useState(currentMonth);
  const [appliedRange, setAppliedRange] = useState({ from: currentMonth(), to: currentMonth() });
  const [rangeInvalid, setRangeInvalid] = useState(false);
  const [state, setState] = useState<FinanceState>({ phase: "loading" });
  useEffect(() => {
    let active = true;
    const monthsUsable = validMonth(fromMonth) && validMonth(toMonth) && fromMonth <= toMonth;
    setRangeInvalid(!monthsUsable);
    if (!monthsUsable) {
      // نطاق غير صالح هو خطأ حقل، لا خطأ شاشة: تبقى آخر قراءة صحيحة معروضة.
      return () => {
        active = false;
      };
    }
    setAppliedRange({ from: fromMonth, to: toMonth });
    const from = monthBounds(fromMonth);
    const to = monthBounds(toMonth);
    Promise.all([
      projectFinance.readPosition(),
      projectFinance.listEvents(),
      projectFinance.readRecordedPeriodResult(from.from, to.to),
      /* و٧: المؤشرات تُقرأ مع الفترة نفسها — طبقة واحدة داخل القراءة. */
      projectFinance.readFinancialInsights(from.from, to.to),
      g5.readDecision(from.from, to.to),
      g5.listDeclarations(),
      ownerEntitlement.readOverview(),
      financialPulse.read(),
      fulfillment.listDepositOverview(),
      correctionHistory.affecting(),
      correctionHistory.affecting(from.from, to.to),
      /* المجموعة ٢ (عقد ٢٨): هدر الفترة — قراءة مشتقة بأساس occurredOn نفسه. */
      inventory.readPeriodWaste(from.from, to.to),
    ]).then(
      ([position, events, result, insights, decision, declarations, owner, pulseResult, depositsResult, correctionsAll, correctionsPeriod, periodWaste]) => {
        if (!active) return;
        if (
          !position.ok ||
          !events.ok ||
          !result.ok ||
          !insights.ok ||
          !decision.ok ||
          !declarations.ok ||
          !owner.ok ||
          !pulseResult.ok ||
          !depositsResult.ok
        ) {
          setState({ phase: "error", message: "لم يتم تغيير بياناتك. أعد فتح التطبيق للمحاولة." });
          return;
        }
        const completed = pulseResult.orders.filter(stored =>
          ["delivered", "settled"].includes(stored.order.status),
        );
        setState({
          phase: "ready",
          position: position.value,
          events: events.value,
          period: result.value,
          insights: insights.value,
          decision: decision.value,
          declarations: declarations.value,
          owner: owner.value,
          pulse: pulseResult.pulse,
          excludedOrders: completed.filter(stored => stored.order.resultStatus !== "final"),
          deposits: depositsResult.value,
          correctionsAllTime: correctionsAll.ok ? correctionsAll.value : null,
          correctionsInPeriod: correctionsPeriod.ok ? correctionsPeriod.value : null,
          periodWaste: periodWaste.ok ? periodWaste.value : null,
        });
      },
    );
    return () => {
      active = false;
    };
  }, [dataVersion, fromMonth, toMonth, projectFinance, g5, ownerEntitlement, financialPulse, fulfillment, correctionHistory, inventory]);
  if (state.phase === "loading")
    return (
      <div className="micro-route-loading" role="status">
        جارٍ قراءة الوضع المالي المحلي…
      </div>
    );
  if (state.phase === "error")
    return (
      <section className="micro-page micro-not-found">
        <h1>تعذر قراءة الوضع المالي</h1>
        <p>{state.message}</p>
        <button className="micro-button micro-button-primary" type="button" onClick={() => navigate("/")}>
          مشروعي الآن
        </button>
      </section>
    );
  const { position, period, insights, decision, declarations, owner, pulse } = state;
  const visibleEventIds = new Set(state.events.slice(0, 3).map(event => event.id));
  state.events.slice(0, 3).forEach(event => {
    if (event.correctionType === "reverse" && event.correctionOfEventId)
      visibleEventIds.add(event.correctionOfEventId);
    const reversal = state.events.find(
      candidate => candidate.correctionType === "reverse" && candidate.correctionOfEventId === event.id,
    );
    if (reversal) visibleEventIds.add(reversal.id);
  });
  const visibleEvents = state.events.filter(event => visibleEventIds.has(event.id));
  return (
    <section className="micro-page micro-finance-page">
      <button className="micro-back-button" type="button" onClick={() => navigate(returnPath)}>
        <ArrowLeft aria-hidden="true" /> {returnPath === "/" ? "مشروعي الآن" : "رجوع"}
      </button>
      <div className="micro-page-heading">
        <span className="micro-overline">الصورة العامة · المبالغ (د.أ)</span>
        <h1>مالي</h1>
      </div>
      {/* المجموعة ٢ (§8.3): أول قرار واضح — الوضع الآن أو ما صار خلال الفترة. */}
      <div className="micro-form-actions" role="tablist" aria-label="اختيار قراءة مالي">
        <button
          className="micro-text-action"
          type="button"
          role="tab"
          aria-selected={view === "position"}
          aria-pressed={view === "position"}
          onClick={() => switchView("position")}
        >
          الوضع الآن
        </button>
        <button
          className="micro-text-action"
          type="button"
          role="tab"
          aria-selected={view === "period"}
          aria-pressed={view === "period"}
          onClick={() => switchView("period")}
        >
          شو صار خلال الفترة
        </button>
      </div>
      {view === "position" ? (
        <>
      <ReviewPulseSection
        pulse={pulse}
        excludedOrders={state.excludedOrders}
        onOpenOrder={orderId => navigate(withFrom(`/orders/${orderId}`, "/finance"))}
      />
      <CashDecisionSurface
        decision={decision}
        unallocatedCashMinor={position.unallocatedCashMinor}
        onDeclare={() => navigate(withFrom("/finance/g5/declaration", "/finance"))}
        onCoverPayment={() =>
          navigate(appendQueryParams("/cash/distribute", { mode: "cover", from: "/finance" }))
        }
      />
      <OwnerDecisionCard
        overview={owner}
        capitalRecordedMinor={position.ownerCapitalRecordedMinor}
        onOpen={() => navigate(withFrom("/finance/owner-entitlement", "/finance"))}
      />
      <section
        className="micro-finance-position"
        aria-label="تفاصيل الوضع المالي المسجل · المبالغ بالدينار الأردني"
      >
        <PositionCard
          label="الكاش المسجل"
          value={position.recordedCashMinor}
          helper="محافظ معلنة + كاش غير موزع"
          icon={WalletCards}
        />
        <PositionCard
          label="لي عند العملاء"
          value={position.customerReceivablesMinor}
          helper="دين مسجل بعد التسليم"
          icon={HandCoins}
        />
        <PositionCard
          label="عليّ للموردين"
          value={position.supplierPayablesMinor}
          helper="مصروفات أو مشتريات مستحقة"
          icon={Landmark}
        />
        <button
          type="button"
          className="micro-finance-position-card micro-finance-position-link"
          aria-label="افتح مال المالك"
          onClick={() => navigate(withFrom("/finance/owner-entitlement", "/finance"))}
        >
          <CircleDollarSign aria-hidden="true" />
          <span>مال المالك</span>
          <strong>
            <MoneyValue minor={position.ownerCapitalRecordedMinor} />
          </strong>
          <small>رأس مالك · افتح الدفتر الموحد</small>
        </button>
      </section>
      {state.correctionsAllTime && state.correctionsAllTime.count > 0 ? (
        <RestatementNote
          count={state.correctionsAllTime.count}
          netAmountMinor={state.correctionsAllTime.netAmountMinor}
          scopeLabel="هذه الأرصدة"
          onOpen={() => navigate(withFrom("/finance?layer=corrections", "/finance"))}
        />
      ) : null}
      <section className="micro-finance-truth">
        <ReceiptText aria-hidden="true" />
        <div>
          <h2>ما نعرفه الآن</h2>
          <p>
            كاش المحافظ المعلن (د.أ):{" "}
            <MoneyValue minor={position.walletCashMinor} className="micro-inline-number" /> · الكاش غير الموزع
            (د.أ): <MoneyValue minor={position.unallocatedCashMinor} className="micro-inline-number" /> ·
            محافظ مسجلة: {position.cashWalletCount}
          </p>
          <p>
            المصاريف التشغيلية المسجلة (د.أ):{" "}
            <MoneyValue minor={position.operatingExpensesRecordedMinor} className="micro-inline-number" /> ·
            شراء مواد مسجل: {position.supplierPurchaseCount} · الأحداث العامة: {position.projectEventCount}
          </p>
          {/* المبدأ ١٣: أمانات بحوزتك — كاش في الدرج ليس ملكًا لك ولا إيرادًا. */}
          {position.amanahHeldMinor > 0 ? (
            <p>
              أمانات بحوزتك (د.أ):{" "}
              <MoneyValue minor={position.amanahHeldMinor} className="micro-inline-number" /> — كاش حقيقي في
              الدرج لكنه ليس لك ولا يدخل الربح.
            </p>
          ) : null}
          {/* PA-002: شريط توزيع صريح — لا كاش عالق بلا طريق حل. */}
          {position.unallocatedCashMinor > 0 ? (
            <div className="micro-unallocated-strip">
              <div>
                <strong>
                  كاش غير موزع: <MoneyValue minor={position.unallocatedCashMinor} className="micro-inline-number" />
                </strong>
                <small>وزّعه على محفظة الآن، أو اتركه حتى تعرف وجهته — لا يُخصص شيء بصمت.</small>
              </div>
              <button
                className="micro-button micro-button-secondary"
                type="button"
                onClick={() => navigate(withFrom("/cash/distribute", "/finance"))}
              >
                وزّع على محفظة
              </button>
            </div>
          ) : null}
          {/* §2.7 (F-031): الحقيقة غير المسجلة طريق — لا عدد أصفار عاجز. */}
          {position.cashWalletCount === 0 ? (
            <p className="micro-fact-road-line">
              الكاش: لا محفظة معلنة بعد —{" "}
              <button
                className="micro-text-action"
                type="button"
                onClick={() => navigate(withFrom("/cash/wallet/new", "/finance"))}
              >
                سجّل محفظة ورصيد بداية
              </button>
            </p>
          ) : null}
          {/* التدفقات ١٤/٢٠ + D-002: دفتر الناس وعدّ الصناديق والموردون من مسارات
              مالي الدائمة — نوايا قراءة تجد مكانها الطبيعي هنا بلا مقعد خامس. */}
          {/* المجموعة ٢ (§8.1): روابط الوضع إلى مصادره — دفتر المحفظة والكشف من هنا. */}
          <p className="micro-fact-road-line">
            <button className="micro-text-action" type="button" onClick={() => navigate(withFrom("/parties", "/finance"))}>
              افتح دفتر الناس — مين عليه إلَي وعليّ لمين
            </button>{" "}
            ·{" "}
            <button className="micro-text-action" type="button" onClick={() => navigate(withFrom("/suppliers", "/finance"))}>
              الموردون والمشتريات — استحقاقاتك ودفعاتك
            </button>{" "}
            ·{" "}
            <button className="micro-text-action" type="button" onClick={() => navigate(withFrom("/cash/count", "/finance"))}>
              عدّ الصندوق — طابق الدرج مع السجل
            </button>
          </p>
          <p className="micro-fact-road-line">
            <button className="micro-text-action" type="button" onClick={() => navigate(withFrom("/finance/statement", "/finance"))}>
              كشف الفترة — بسيط ومفصول بالعربية
            </button>{" "}
            ·{" "}
            <button className="micro-text-action" type="button" onClick={() => switchView("period")}>
              قراءة الفترة الكاملة
            </button>
            {/* المجموعة ١ (فحص سلامة مالي): باب مالي حيث يُشك بالرقم — قراءة فقط. */}
            {" · "}
            <button className="micro-text-action" type="button" onClick={() => navigate(withFrom("/tools/integrity", "/finance"))}>
              فحص سلامة مالي — اطمن على أرقامك
            </button>
          </p>
        </div>
      </section>
      <DepositsLayer deposits={state.deposits} onOpenOrder={orderId => navigate(withFrom(`/orders/${orderId}`, "/finance"))} />
      </>
      ) : (
      <>
      <details className="micro-finance-layer">
        <summary className="micro-finance-layer-summary">
          <span>
            <b>قراءة الفترة</b>
            <small>نتيجة مسجلة ومصادرها واستبعاداتها</small>
          </span>
          <strong>افتح التفاصيل</strong>
        </summary>
        <section className="micro-period-result micro-derived-surface" data-status={period.status}>
          <div className="micro-period-heading">
            <div>
              <span className="micro-overline">قراءة تشغيلية مسجلة · ضمن فترة معلنة</span>
              <h2>نتيجة الفترة المسجلة</h2>
            </div>
            <div className="micro-period-range-fields">
              <label>
                <span>من</span>
                <input
                  type="month"
                  value={fromMonth}
                  onChange={event => setFromMonth(event.target.value)}
                  aria-label="بداية نطاق نتيجة الفترة"
                />
              </label>
              <label>
                <span>إلى</span>
                <input
                  type="month"
                  value={toMonth}
                  onChange={event => setToMonth(event.target.value)}
                  aria-label="نهاية نطاق نتيجة الفترة"
                />
              </label>
            </div>
          </div>
          {rangeInvalid ? (
            <p className="micro-field-error" role="alert">
              اختر نطاقًا يبدأ قبل نهايته؛ القراءة أدناه تبقى على آخر نطاق صحيح.
            </p>
          ) : null}
          <p className="micro-period-range-label">
            النطاق المحدد: {formatMonthLabel(appliedRange.from)} — {formatMonthLabel(appliedRange.to)}. هذا
            رقم تشغيلي مسجل من البنود المعروفة، وليس صافي ربح نهائيًا.
          </p>
          <p className="micro-period-result-value">
            <span>
              إيراد الطلبات والبيع المباشر − التكلفة المباشرة المستخدمة − المصروف التشغيلي الموزّع، ضمن
              الفترة المحددة فقط
            </span>
            <strong>
              {period.resultMinor === null ? "غير متاح" : <MoneyValue minor={period.resultMinor} />}
            </strong>
          </p>
          <p className="micro-period-status" data-status={period.status}>
            {recordedPeriodStatusLabel(period.status)}
          </p>
          {state.correctionsInPeriod && state.correctionsInPeriod.count > 0 ? (
            <RestatementNote
              count={state.correctionsInPeriod.count}
              netAmountMinor={state.correctionsInPeriod.netAmountMinor}
              scopeLabel="هذه الفترة"
              onOpen={() => navigate(withFrom("/finance?layer=corrections", "/finance"))}
            />
          ) : null}
          {/* F-005 + بند ٢٤ من قرارات المالك: نطاق القراءة معلن صراحة — ما يدخل
              وما لا يدخل، وكيف يُعترف بكل مصدر، والكاش غير النتيجة. */}
          <div className="micro-period-review-note" aria-label="نطاق قراءة الفترة">
            <strong>ما تشمله هذه القراءة</strong>
            <p>
              طلبات مسلَّمة بنتيجة نهائية (تُعرف إيرادها بتاريخ التسليم) + بيع مباشر نشط (يُعرف إيراده
              بتاريخ البيع وبالثمن المسجّل وقت البيع). البيع الملغى مستبعد بالكامل.
            </p>
            <p>
              القبض — من طلبات أو بيع آجل — ليس إيرادًا هنا؛ الكاش يظهر في بطاقة الكاش، وديون العملاء في
              «لي عند العملاء». رأس المال والسحوبات والأمانات ليست إيرادًا ولا مصروفًا ولا تربحًا.
            </p>
            {period.directSaleCostUnknownCount > 0 ? (
              <p role="status">
                يوجد بيع مباشر بتكلفة غير معروفة: النتيجة «غير متاح» حتى تُوثّق تكلفته — لا تُقلب المجهول
                صفرًا فيربو رقمٌ غير مؤكد.
              </p>
            ) : null}
          </div>
          {/* القرار ١٠: التقارير القديمة تقول صراحةً إن المخزون لم يكن مُدارًا — لا إخفاء ولا صفر. */}
          {period.inventoryManagedFrom === null || period.inventoryManagedFrom > period.from ? (
            <p className="micro-period-review-note" role="status">
              {period.inventoryManagedFrom === null
                ? "لم يكن المخزون مُدارًا في هذه المدة؛ لا تُقرأ من هذه الفترة أرقام مخزون."
                : `المخزون لم يكن مُدارًا قبل ${
                    formatLocalDate(period.inventoryManagedFrom) ?? period.inventoryManagedFrom
                  }؛ ما قبله في هذه الفترة لا يُحسب من حركات المخزون.`}
            </p>
          ) : null}
          <dl>
            <div>
              <dt>إيراد طلبات نهائية</dt>
              <dd>
                <PeriodMoney value={period.recognizedRevenueMinor} status={period.status} />
              </dd>
            </div>
            {/* F-005: البيع المباشر داخل نتيجة الفترة — بتاريخ البيع وبثمنه المسجّل. */}
            <div>
              <dt>إيراد بيع مباشر (بتاريخ البيع)</dt>
              <dd>
                <PeriodMoney value={period.directSaleRevenueMinor} status={period.status} />
              </dd>
            </div>
            <div>
              <dt>تكلفة بيع مباشر معروفة</dt>
              <dd>
                <PeriodMoney value={period.directSaleCostKnownMinor} status={period.status} />
              </dd>
            </div>
            <div>
              <dt>بيع مباشر بتكلفة غير معروفة</dt>
              <dd>
                {period.status === "invalid" ? (
                  <span className="micro-unknown-value">غير متاح</span>
                ) : (
                  <IntegerValue value={period.directSaleCostUnknownCount} className="micro-inline-number" />
                )}
              </dd>
            </div>
            <div>
              <dt>بيع مباشر نشط / ملغى مستبعد</dt>
              <dd>
                {period.status === "invalid" ? (
                  <span className="micro-unknown-value">غير متاح</span>
                ) : (
                  <>
                    <IntegerValue value={period.directSaleCount} className="micro-inline-number" /> /{" "}
                    <IntegerValue value={period.directSaleCancelledCount} className="micro-inline-number" />
                  </>
                )}
              </dd>
            </div>
            <div>
              <dt>تكلفة مباشرة من نسخة التكلفة</dt>
              <dd>
                <PeriodMoney value={period.snapshotDirectCostMinor} status={period.status} />
              </dd>
            </div>
            <div>
              <dt>تكلفة بيع مسجلة من الاستهلاك</dt>
              <dd>
                <PeriodMoney value={period.recordedCogsMinor} status={period.status} />
              </dd>
            </div>
            <div>
              <dt>التكلفة المباشرة المستخدمة</dt>
              <dd>
                <PeriodMoney value={period.effectiveDirectCostMinor} status={period.status} />
              </dd>
            </div>
            <div>
              <dt>مصروف للمشروع</dt>
              <dd>
                <PeriodMoney value={period.projectOperatingExpenseMinor} status={period.status} />
              </dd>
            </div>
            <div>
              <dt>حصة المشروع من مصروف مشترك موزّعة</dt>
              <dd>
                <PeriodMoney value={period.sharedProjectExpenseMinor} status={period.status} />
              </dd>
            </div>
            <div>
              <dt>مصروف مشترك غير موزّع</dt>
              <dd>
                <PeriodMoney value={period.sharedUnallocatedExpenseMinor} status={period.status} />
              </dd>
            </div>
            <div>
              <dt>استهلاك عام غير موزّع</dt>
              <dd>
                <PeriodMoney value={period.unallocatedInventoryCostMinor} status={period.status} />
              </dd>
            </div>
            <div>
              <dt>هدر مخزون (منذ البداية)</dt>
              <dd>
                <PeriodMoney value={period.generalInventoryWasteMinor} status={period.status} />
              </dd>
            </div>
            {/* المجموعة ٢ (عقد ٢٨): هدر الفترة — غير نقدي، خارج نتيجة الفترة عمدًا؛
                * قيمة غير معروفة تُصرَّح بها ولا تُعرض 0.00 واثقة. */}
            {state.periodWaste && state.periodWaste.count > 0 ? (
              <div>
                <dt>هدر مخزون هذه الفترة</dt>
                <dd>
                  {state.periodWaste.valueMinor === 0 && state.periodWaste.hasUnknownCost ? (
                    <span className="micro-unknown-value">قيمة الهدر غير معروفة بعد</span>
                  ) : (
                    <>
                      <PeriodMoney value={state.periodWaste.valueMinor} status={period.status} />
                      {state.periodWaste.hasUnknownCost ? (
                        <small> · منها جزء بتكلفة غير معروفة</small>
                      ) : null}
                    </>
                  )}{" "}
                  — غير نقدي: لا يخرج كاش ولا يدخل نتيجة الفترة.
                </dd>
              </div>
            ) : null}
            <div>
              <dt>مصروف قديم بلا سياق</dt>
              <dd>
                <PeriodMoney value={period.legacyUnclassifiedExpenseMinor} status={period.status} />
              </dd>
            </div>
            <div>
              <dt>طلبات داخلة / مستبعدة</dt>
              <dd>
                {period.status === "invalid" ? (
                  <span className="micro-unknown-value">غير متاح</span>
                ) : (
                  <>
                    <IntegerValue value={period.finalOrderCount} className="micro-inline-number" /> /{" "}
                    <IntegerValue value={period.excludedOrderCount} className="micro-inline-number" />
                  </>
                )}
              </dd>
            </div>
          </dl>
          <div className="micro-period-review-note">
            <strong>مصدر التكلفة وحالة تكلفة البيع</strong>
            <p>
              {cogsStatusLabel(period.cogsStatus)} · من نسخة التكلفة:{" "}
              <IntegerValue value={period.cogsMissingOrderCount} className="micro-inline-number" />
            </p>
            {period.cogsReasons.length > 0 ? (
              <ul>
                {period.cogsReasons.map(reason => (
                  <li key={reason}>{reason}</li>
                ))}
              </ul>
            ) : null}
          </div>
          {period.reasons.length > 0 ? (
            <div className="micro-period-review-note">
              <strong>ما يحتاج مراجعة قبل الاعتماد على نتيجة أدق</strong>
              <ul>
                {period.reasons.map(reason => (
                  <li key={reason}>{reason}</li>
                ))}
              </ul>
            </div>
          ) : null}
          {/* و٧ (F-077): طبقة «المؤشرات» داخل قراءة الفترة — هامش أسماء الأعمال
              وتكوين التكلفة والتغطية والتعادل والسيولة، قيم مسجلة بلا سرد. */}
          <details className="micro-finance-layer micro-insights-layer">
            <summary className="micro-finance-layer-summary">
              <span>
                <b>المؤشرات</b>
                <small>هامش الأعمال · تكوين التكلفة · التغطية والتعادل · السيولة المسجلة</small>
              </span>
              <strong>افتح المؤشرات</strong>
            </summary>
            <section className="micro-period-result micro-derived-surface" aria-label="مؤشرات الفترة">
              <div className="micro-period-review-note">
                <strong>هامش أسماء الأعمال</strong>
                {insights.workNames.length === 0 ? (
                  <p className="micro-insights-empty">— لا أعمال نهائية في الفترة</p>
                ) : (
                  <ul className="micro-insights-work-list">
                    {insights.workNames.map(work => (
                      <li key={work.itemName}>
                        <span className="micro-insights-work-name">{work.itemName}</span>
                        <small>
                          طلبات <IntegerValue value={work.finalOrderCount} className="micro-inline-number" />{" "}
                          · إيراد{" "}
                          <MoneyValue minor={work.recognizedRevenueMinor} className="micro-inline-number" /> ·
                          تكلفة مباشرة{" "}
                          <MoneyValue
                            minor={work.recognizedDirectCostMinor}
                            className="micro-inline-number"
                          />
                        </small>
                        <b>
                          هامش <MoneyValue minor={work.directMarginMinor} className="micro-inline-number" />
                        </b>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              <div className="micro-period-review-note">
                <strong>تكوين التكلفة المباشرة</strong>
                <dl className="micro-insights-grid">
                  <div>
                    <dt>مواد</dt>
                    <dd>
                      <MoneyValue minor={insights.costComposition.materialMinor} />
                    </dd>
                  </div>
                  <div>
                    <dt>وقت</dt>
                    <dd>
                      <MoneyValue minor={insights.costComposition.timeMinor} />
                    </dd>
                  </div>
                  <div>
                    <dt>تغليف</dt>
                    <dd>
                      <MoneyValue minor={insights.costComposition.packagingMinor} />
                    </dd>
                  </div>
                  <div>
                    <dt>توصيل</dt>
                    <dd>
                      <MoneyValue minor={insights.costComposition.deliveryMinor} />
                    </dd>
                  </div>
                  <div>
                    <dt>هدر</dt>
                    <dd>
                      <MoneyValue minor={insights.costComposition.wasteMinor} />
                    </dd>
                  </div>
                  <div>
                    <dt>مصروف تشغيلي</dt>
                    <dd>
                      <MoneyValue minor={insights.costComposition.operatingExpenseMinor} />
                    </dd>
                  </div>
                </dl>
              </div>
              <div className="micro-period-review-note">
                <strong>التغطية والتعادل المسجلان</strong>
                <dl className="micro-insights-grid">
                  <div>
                    <dt>المصروف الثابت المسجل</dt>
                    <dd>
                      <MoneyValue minor={insights.coverage.fixedExpenseMinor} />
                    </dd>
                  </div>
                  <div>
                    <dt>الكمية المسلّمة النهائية</dt>
                    <dd>
                      <IntegerValue value={insights.coverage.finalDeliveredQuantity} />
                    </dd>
                  </div>
                  <div>
                    <dt>الهامش المباشر</dt>
                    <dd>
                      <MoneyValue minor={insights.coverage.directMarginMinor} />
                    </dd>
                  </div>
                  <div>
                    <dt>وحدات التعادل</dt>
                    <dd>
                      {insights.coverage.breakEvenUnits === null ? (
                        <span className="micro-insights-unknown">—</span>
                      ) : (
                        <IntegerValue value={insights.coverage.breakEvenUnits} />
                      )}
                    </dd>
                  </div>
                </dl>
                {insights.coverage.status !== "recorded_only" && insights.coverage.reasons.length > 0 ? (
                  <ul className="micro-insights-reasons">
                    {insights.coverage.reasons.map(reason => (
                      <li key={reason}>{reason}</li>
                    ))}
                  </ul>
                ) : null}
              </div>
              <div className="micro-period-review-note">
                <strong>السيولة المسجلة</strong>
                <dl className="micro-insights-grid">
                  <div>
                    <dt>الكاش المسجل</dt>
                    <dd>
                      <MoneyValue minor={insights.liquidity.recordedCashMinor} />
                    </dd>
                  </div>
                  <div>
                    <dt>ديون العملاء</dt>
                    <dd>
                      <MoneyValue minor={insights.liquidity.customerReceivablesMinor} />
                    </dd>
                  </div>
                  <div>
                    <dt>التزامات الموردين</dt>
                    <dd>
                      <MoneyValue minor={insights.liquidity.supplierPayablesMinor} />
                    </dd>
                  </div>
                  <div>
                    <dt>التغطية بعد الالتزامات</dt>
                    <dd>
                      <MoneyValue minor={insights.liquidity.cashCoverageAfterLiabilitiesMinor} />
                    </dd>
                  </div>
                  <div>
                    <dt>أمانات محتجزة (ليست مالكًا)</dt>
                    <dd>
                      <MoneyValue minor={insights.liquidity.amanahHeldMinor} />
                    </dd>
                  </div>
                </dl>
                {insights.liquidity.amanahNotice ? (
                  <p className="micro-period-review-note" role="status">
                    {insights.liquidity.amanahNotice}
                  </p>
                ) : null}
              </div>
            </section>
          </details>
        </section>
      </details>
      <details className="micro-finance-layer">
        <summary className="micro-finance-layer-summary">
          <span>
            <b>التغطية والتعادل</b>
            <small>قراءة الهامش والمتوقعات للفترة</small>
          </span>
          <strong>افتح التفاصيل</strong>
        </summary>
        <G5DecisionPanel
          decision={decision}
          g5={g5}
          onDeclare={() => navigate(withFrom("/finance/g5/declaration", "/finance"))}
          onChanged={notifyDataChanged}
        />
        {/* و٧ (F-079): سجل المتوقعات المسجلة كاملًا — حتى المنقوضة — بلا تصحيح من هنا. */}
        <details className="micro-finance-layer micro-declarations-record">
          <summary className="micro-finance-layer-summary">
            <span>
              <b>سجل المتوقعات المسجلة</b>
              <small>كل ما سُجل — حتى المنقوضة</small>
            </span>
            <strong>
              {declarations.length > 0 ? (
                <IntegerValue value={declarations.length} className="micro-inline-number" />
              ) : (
                "افتح السجل"
              )}
            </strong>
          </summary>
          <section className="micro-period-result micro-derived-surface" aria-label="سجل المتوقعات المسجلة">
            {declarations.length === 0 ? (
              <p className="micro-insights-empty">— لا متوقعات مسجلة</p>
            ) : (
              <ul className="micro-insights-work-list">
                {[...declarations]
                  .sort((left, right) => left.createdAt.localeCompare(right.createdAt))
                  .map(entry => (
                    <li key={entry.id}>
                      <span className="micro-insights-work-name">
                        {entry.direction === "collection" ? "قبض متوقع" : "دفع متوقع"} · {entry.source}
                      </span>
                      <small>
                        <MoneyValue minor={entry.amountMinor} className="micro-inline-number" /> ·{" "}
                        {entry.dueOn ? <LocalDateValue value={entry.dueOn} /> : "بلا تاريخ"} ·{" "}
                        {entry.knowledge === "known"
                          ? "معروف"
                          : entry.knowledge === "estimated"
                            ? "تقديري"
                            : "يحتاج مراجعة"}
                      </small>
                      <b data-state={entry.kind === "reversal" ? "reversed" : "active"}>
                        {entry.kind === "reversal" ? "نقض موثق" : "ساري"}
                      </b>
                    </li>
                  ))}
              </ul>
            )}
          </section>
        </details>
      </details>
      {/* المجموعة ٢ (§9.2): من قراءة الفترة إلى الكشف البسيط — الرجوع محفوظ للمصدر. */}
      <section className="micro-decision-card" aria-label="كشف الفترة البسيط">
        <ReceiptText aria-hidden="true" />
        <div>
          <span>قصة الأسبوع ببساطة</span>
          <p>كشف بأسطر عربية مفصولة: كاش، نتيجة، أمانات، ذمم، مال المالك — وكل سطر بمصدره.</p>
        </div>
        <button
          className="micro-button micro-button-secondary"
          type="button"
          onClick={() => navigate(withFrom("/finance/statement", "/finance"))}
        >
          افتح كشف الفترة
        </button>
      </section>
      </>
      )}
      <details className="micro-finance-layer">
        <summary className="micro-finance-layer-summary">
          <span>
            <b>تسجيل حركة أو فتح مصدر</b>
            <small>المحافظ والموردون والمصروفات واستثمار المالك</small>
          </span>
          <strong>افتح الإجراءات</strong>
        </summary>
        <section className="micro-finance-actions" aria-label="تسجيل حدث مالي">
          <button
            className="micro-button micro-button-primary"
            type="button"
            onClick={() => navigate(withFrom("/cash", "/finance"))}
          >
            محافظ الكاش
          </button>
          <button
            className="micro-button micro-button-secondary"
            type="button"
            onClick={() => navigate(withFrom("/suppliers", "/finance"))}
          >
            الموردون والمشتريات
          </button>
          <button
            className="micro-button micro-button-secondary"
            type="button"
            onClick={() => navigate(withFrom("/inventory", "/finance"))}
          >
            المواد والمخزون
          </button>
          <button
            className="micro-button micro-button-secondary"
            type="button"
            onClick={() => navigate(withFrom("/finance/new/operating_expense_cash", "/finance"))}
          >
            سجل مصروفًا مدفوعًا
          </button>
          <button
            className="micro-button micro-button-secondary"
            type="button"
            onClick={() => navigate(withFrom("/finance/new/operating_expense_payable", "/finance"))}
          >
            سجل التزامًا لمورد
          </button>
          <button
            className="micro-button micro-button-secondary"
            type="button"
            /* المجموعة ٦ (البند ٢ — S2-07): مدخل مالك واحد من «مالي» — الدفتر الموحد
             * يحمل فعل الإدخال والسحب وسياسة الحق (X-05 محفوظ داخل الدفتر). */
            onClick={() => navigate(withFrom("/finance/owner-entitlement", "/finance"))}
          >
            مال المالك
          </button>
          {position.supplierPayablesMinor > 0 ? (
            <button
              className="micro-button micro-button-secondary"
              type="button"
              onClick={() => navigate(withFrom("/finance/new/payable_settlement_cash", "/finance"))}
            >
              سدد التزام مصروف
            </button>
          ) : null}
          {/* المبدأ ١٣: الأمانات والهالك مسارات صريحة — لا تُسجل إيرادًا ولا مصروفًا عاديًا. */}
          <button
            className="micro-button micro-button-secondary"
            type="button"
            onClick={() => navigate(withFrom("/finance/new/amanah_held_cash", "/finance"))}
          >
            سجل أمانة قُبضت
          </button>
          {position.amanahHeldMinor > 0 ? (
            <button
              className="micro-button micro-button-secondary"
              type="button"
              onClick={() => navigate(withFrom("/finance/new/amanah_released_cash", "/finance"))}
            >
              سجل أمانة سُلّمت
            </button>
          ) : null}
          <button
            className="micro-button micro-button-secondary"
            type="button"
            onClick={() => navigate(withFrom("/finance/new/loss_non_cash", "/finance"))}
          >
            سجل هالكًا بلا خروج نقد
          </button>
        </section>
      </details>
      <EventsLayer
        visibleEvents={visibleEvents}
        events={state.events}
        projectFinance={projectFinance}
        onChanged={notifyDataChanged}
        focusEventId={focusEventId}
        openOnLoad={layerParam === "events"}
      />
      {/* U-001: «السجل» — سطح قراءة واحد لكل تصحيح موثق عبر السجلات المدعومة؛
          لا يضيف حدثًا ولا يعدّل قيمة، ويُحدّث مع كل تغيير بيانات. */}
      <CorrectionsLayer correctionHistory={correctionHistory} reloadToken={dataVersion} initiallyOpen={layerParam === "corrections"} />
    </section>
  );
}

function ReviewPulseSection({
  pulse,
  excludedOrders,
  onOpenOrder,
}: {
  pulse: LocalFinancialPulse;
  excludedOrders: readonly StoredCraftOrder[];
  onOpenOrder: (orderId: string) => void;
}) {
  return (
    <section className="micro-financial-pulse" aria-labelledby="finance-review-pulse-title">
      <div className="micro-financial-pulse-heading">
        <div>
          <span className="micro-overline">صورة الطلبات المسجلة · المراجعة</span>
          <h2 id="finance-review-pulse-title">قبض ودين ونتائج</h2>
        </div>
        <span>القيم (د.أ)</span>
      </div>
      <dl>
        <div>
          <dt>قبض مسجل من الطلبات</dt>
          <dd>
            <MoneyValue minor={pulse.registeredCollectionsMinor} />
          </dd>
          <small>لا يساوي كاش المشروع</small>
        </div>
        <div>
          <dt>دين مسجل بعد التسليم</dt>
          <dd>
            <MoneyValue minor={pulse.registeredDebtMinor} />
          </dd>
          <small>لا يدخل في القبض</small>
        </div>
        <div>
          <dt>سعر محتسب عند التسليم</dt>
          <dd>
            <MoneyValue minor={pulse.recognizedRevenueFromFinalOrdersMinor} />
          </dd>
          <small>من نتائج معروفة فقط</small>
        </div>
        <div>
          <dt>تكلفة محتسبة عند التسليم</dt>
          <dd>
            <MoneyValue minor={pulse.recognizedCostFromFinalOrdersMinor} />
          </dd>
          <small>من نتائج معروفة فقط</small>
        </div>
      </dl>
      {excludedOrders.length ? (
        <section className="micro-review-exclusions" aria-labelledby="finance-review-exclusions-title">
          <div>
            <CircleAlert aria-hidden="true" />
            <p id="finance-review-exclusions-title">
              استُبعدت{" "}
              <strong>
                <IntegerValue value={excludedOrders.length} />
              </strong>{" "}
              طلب/طلبات مسلّمة لأن معرفة التكلفة غير مكتملة أو تحتاج مراجعة.
            </p>
          </div>
          <div>
            {excludedOrders.map(stored => (
              <button
                className="micro-text-action"
                type="button"
                key={stored.id}
                onClick={() => onOpenOrder(stored.id)}
              >
                فتح مصدر الاستبعاد: {stored.order.itemName} <ArrowLeft aria-hidden="true" />
              </button>
            ))}
          </div>
        </section>
      ) : (
        <p className="micro-financial-pulse-note">لا توجد طلبات مسلّمة مستبعدة من نطاق النتيجة النهائية.</p>
      )}
    </section>
  );
}

function OwnerDecisionCard({
  overview,
  capitalRecordedMinor,
  onOpen,
}: {
  overview: OwnerEntitlementOverview;
  capitalRecordedMinor: number;
  onOpen: () => void;
}) {
  /* المجموعة ٦ (البند ٢ — S2-07): بطاقة مالك واحدة برقمين مفصولين — رأس المال
   * والحق المسجل المتبقي — ومدخل واحد للدفتر الموحد «مال المالك». */
  return (
    <section
      className="micro-owner-decision-card"
      data-balance={overview.balanceState}
      aria-labelledby="owner-decision-title"
    >
      <div className="micro-section-heading">
        <div>
          <span className="micro-overline">مال المالك · دفتر منفصل عن الربح</span>
          <h2 id="owner-decision-title">مال المالك</h2>
        </div>
        <span>
          <bdi dir="ltr" className="micro-inline-number">
            {formatMoneyMinor(overview.remainingEntitlementBalanceMinor)}
          </bdi>{" "}
          د.أ
        </span>
      </div>
      <div className="micro-owner-decision-grid">
        <Metric label="رأس مالك في المشروع" value={formatMoneyMinor(capitalRecordedMinor)} />
        <Metric label="حق مسجل متبقٍ" value={formatMoneyMinor(overview.remainingEntitlementBalanceMinor)} />
      </div>
      <button className="micro-button micro-button-primary" type="button" onClick={onOpen}>
        افتح مال المالك
      </button>
    </section>
  );
}

function CashDecisionSurface({
  decision,
  unallocatedCashMinor,
  onDeclare,
  onCoverPayment,
}: {
  decision: G5Decision;
  unallocatedCashMinor: number;
  onDeclare: () => void;
  onCoverPayment: () => void;
}) {
  const cash = decision.shortCash;
  return (
    <section className="micro-cash-decision" aria-labelledby="cash-decision-title">
      <div className="micro-cash-decision-heading">
        <span className="micro-overline">
          قرار الكاش · <LocalDateValue value={cash.from} /> → <LocalDateValue value={cash.to} />
        </span>
      </div>
      <div className="micro-cash-decision-metrics">
        <Metric
          label="الكاش المسجل الآن"
          value={displayCashAmount(cash.recordedCashMinor, cash.status)}
          negative={cash.status !== "invalid" && cash.recordedCashMinor < 0}
        />
        <Metric
          label="قبض متوقع قريب"
          value={displayCashAmount(cash.declaredCollectionsMinor, cash.status)}
        />
        <Metric
          label="دفع متوقع قريب"
          value={displayCashAmount(cash.declaredCommitmentsMinor, cash.status)}
          negative={
            cash.status !== "invalid" && cash.declaredCommitmentsMinor > cash.declaredCollectionsMinor
          }
        />
        <Metric
          label="الكاش المتوقع"
          value={
            cash.projectedCashMinor === null || cash.status === "invalid"
              ? "غير متاح"
              : formatted(cash.projectedCashMinor)
          }
          negative={
            cash.projectedCashMinor !== null && cash.status !== "invalid" && cash.projectedCashMinor < 0
          }
        />
      </div>
      <div className="micro-cash-decision-footer">
        <div>
          <strong>{shortStatusLabel(cash.status)}</strong>
          <p>{cash.nextAction}</p>
        </div>
        <button className="micro-button micro-button-primary" type="button" onClick={onDeclare}>
          أعلن تحصيلًا أو التزامًا قريبًا
        </button>
      </div>
      {unallocatedCashMinor < 0 ? (
        <div className="micro-finance-unallocated-alert" role="status">
          <div>
            <strong>في دفعة تحتاج تغطية</strong>
            <p>
              الكاش غير الموزع الآن <MoneyValue minor={unallocatedCashMinor} /> د.أ — سالب لأن دفعًا
              مسجلًا تجاوز ما دخل غير موزع. مصدر الفرق ظاهر في المصادر المسجلة، وهو ليس مصروفًا أو ربحًا
              جديدًا.
            </p>
          </div>
          <button
            className="micro-button micro-button-secondary"
            type="button"
            onClick={onCoverPayment}
          >
            غطِّ الدفعة من محفظة
          </button>
        </div>
      ) : null}
    </section>
  );
}

function Metric({ label, value, negative = false }: { label: string; value: string; negative?: boolean }) {
  return (
    <div>
      <span>{label}</span>
      {/* S3-07: الحالة العربية خارج صنف الأرقام — هادئة لا الصوت الأعلى في الخلية. */}
      {value === "غير متاح" ? (
        <span className="micro-unknown-value">{value}</span>
      ) : (
        <strong className="micro-number" data-negative={negative}>
          {value}
        </strong>
      )}
    </div>
  );
}
function PeriodMoney({ value, status }: { value: number; status: RecordedPeriodResult["status"] }) {
  return status === "invalid" ? (
    <span className="micro-unknown-value">غير متاح</span>
  ) : (
    <MoneyValue minor={value} />
  );
}
function PositionCard({
  label,
  value,
  helper,
  icon: Icon,
}: {
  label: string;
  value: number;
  helper: string;
  icon: typeof WalletCards;
}) {
  return (
    <article className="micro-finance-position-card">
      <Icon aria-hidden="true" />
      <span>{label}</span>
      <strong>
        <MoneyValue minor={value} />
      </strong>
      <small>{helper}</small>
    </article>
  );
}
