/* مبدأ Micro: ابدأ بقرار الكاش والفعل الأقرب، وأجّل قراءة الفترة والسجل والأثر الكامل إلى طبقات مستقلة. */
/* §2.2: المراجعة اندمجت نبضةً أعلى هذه الصفحة (F-003) — جلسة قراءة أسبوعية لا تستحق مقعدًا. */
import { ArrowLeft, CircleAlert, CircleDollarSign, HandCoins, Landmark, ReceiptText, WalletCards } from "lucide-react";
import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { usePrototypeServices } from "@/app/PrototypeServicesContext";
import type { LocalFinancialPulse } from "@/application/financial-pulse/financialPulseService";
import type { DepositOverview } from "@/application/fulfillment/fulfillmentService";
import type {
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
      decision: G5Decision;
      owner: OwnerEntitlementOverview;
      pulse: LocalFinancialPulse;
      excludedOrders: readonly StoredCraftOrder[];
      deposits: DepositOverview;
    };
const eventLabel: Record<FinancialEventType, string> = {
  owner_investment_cash: "استثمار المالك",
  owner_withdrawal_cash: "سحب شخصي",
  operating_expense_cash: "مصروف مدفوع",
  operating_expense_payable: "مصروف مستحق",
  payable_settlement_cash: "تسديد التزام",
};
const expenseContextLabel = (event: FinancialEvent) => {
  if (
    event.operatingExpenseDeltaMinor <= 0 &&
    event.expenseContext?.sharedProjectShare?.allocation !== "unallocated"
  )
    return null;
  if (!event.expenseContext) return "مصروف قديم غير مصنف";
  const knowledge =
    event.expenseContext.knowledge === "known"
      ? "معروف"
      : event.expenseContext.knowledge === "estimated"
        ? "تقديري"
        : "يحتاج مراجعة";
  if (event.expenseContext.relationship === "project") return `للمشروع · ${knowledge}`;
  const share = event.expenseContext.sharedProjectShare;
  if (share?.allocation === "unallocated")
    return `مصروف مشترك غير موزّع · ${formatMoneyMinor(share.totalAmountMinor ?? event.amountMinor)}`;
  const source = share?.basis;
  const sourceLabel =
    source === "agreed_fixed_share"
      ? "حصة ثابتة معلنة"
      : source === "agreed_percentage"
        ? "نسبة معلنة"
        : source === "owner_estimate"
          ? "تقدير المالك"
          : source === "needs_review"
            ? "مصدر يحتاج مراجعة"
            : "مصدر الحصة غير موثق";
  return `حصة المشروع من مصروف مشترك · ${knowledge} · ${sourceLabel}`;
};
const currentMonth = () => localDateInAmman().slice(0, 7);
const depositStateLabel = (row: DepositOverview["deposits"][number]) =>
  row.depositSettlement === "needs_review"
    ? "ينتظر قرارك: ردّه أو احتفظ به — أو اتركه للمراجعة"
    : row.depositSettlement === "refund_deposit"
      ? "مردود بتسوية موثقة"
      : row.depositSettlement === "retain_deposit"
        ? "محتفظ به رصيدًا بتسوية موثقة"
        : "مرتبط بطلب قائم — ليس ربحًا ولا تحصيلًا زائدًا";
const validMonth = (month: string) =>
  /^\d{4}-\d{2}$/.test(month) && Number(month.slice(5)) >= 1 && Number(month.slice(5)) <= 12;
function monthBounds(month: string) {
  const [year, numericMonth] = month.split("-").map(Number);
  const lastDay = new Date(Date.UTC(year!, numericMonth!, 0)).getUTCDate();
  return { from: `${month}-01`, to: `${month}-${String(lastDay).padStart(2, "0")}` };
}
const formatted = (minor: number) => formatMoneyMinor(minor);
const displayContributionAmount = (value: number, status: G5Decision["period"]["status"]) =>
  status === "invalid" ? "غير متاح" : formatMoneyMinor(value);
const displayCashAmount = (value: number, status: G5Decision["shortCash"]["status"]) =>
  status === "invalid" ? "غير متاح" : formatMoneyMinor(value);
const formatSourceDates = (source: string) =>
  source.replace(/\b\d{4}-\d{2}-\d{2}\b/g, date => formatLocalDate(date) ?? date);
const statusLabel = (status: G5Decision["period"]["status"]) =>
  status === "available"
    ? "متاح من السجل"
    : status === "needs_review"
      ? "متاح مع افتراض معلن"
      : status === "invalid"
        ? "لا يمكن حسابه"
        : "بيانات ناقصة";
const recordedPeriodStatusLabel = (status: RecordedPeriodResult["status"]) =>
  status === "recorded_only"
    ? "مسجل من البنود المعروفة"
    : status === "incomplete"
      ? "الرقم مسجل مع عناصر تحتاج مراجعة"
      : "لا يمكن حساب الفترة";
const cogsStatusLabel = (status: RecordedPeriodResult["cogsStatus"]) =>
  status === "recorded"
    ? "تكلفة البيع مسجلة من استهلاك مؤهل لكل الأعمال النهائية"
    : status === "partial"
      ? "تكلفة البيع مسجلة لبعض الأعمال، ونسخة التكلفة مستخدمة لبقية الأعمال"
      : "لا توجد تكلفة بيع مؤهلة؛ نسخة التكلفة هي المصدر البديل المعلن";
const shortStatusLabel = (status: G5Decision["shortCash"]["status"]) =>
  status === "available"
    ? "توقع مكتمل"
    : status === "needs_review"
      ? "توقع يحتاج مراجعة"
      : status === "invalid"
        ? "السجل غير صالح"
        : "لا يكفي لبناء توقع";

export default function Finance() {
  const [, navigate] = useLocation();
  const { projectFinance, ownerEntitlement, g5, financialPulse, fulfillment, dataVersion, notifyDataChanged } =
    usePrototypeServices();
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
      g5.readDecision(from.from, to.to),
      ownerEntitlement.readOverview(),
      financialPulse.read(),
      fulfillment.listDepositOverview(),
    ]).then(([position, events, result, decision, owner, pulseResult, depositsResult]) => {
      if (!active) return;
      if (
        !position.ok ||
        !events.ok ||
        !result.ok ||
        !decision.ok ||
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
        decision: decision.value,
        owner: owner.value,
        pulse: pulseResult.pulse,
        excludedOrders: completed.filter(stored => stored.order.resultStatus !== "final"),
        deposits: depositsResult.value,
      });
    });
    return () => {
      active = false;
    };
  }, [dataVersion, fromMonth, toMonth, projectFinance, g5, ownerEntitlement, financialPulse, fulfillment]);
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
  const { position, period, decision, owner, pulse } = state;
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
      <button className="micro-back-button" type="button" onClick={() => navigate("/")}>
        <ArrowLeft aria-hidden="true" /> مشروعي الآن
      </button>
      <div className="micro-page-heading">
        <span className="micro-overline">الصورة العامة · المبالغ (د.أ)</span>
        <h1>مالي</h1>
        <p>كم عندي الآن ومن أين؟ ابدأ بالكاش والالتزامات القريبة، ثم افتح القراءة المسجلة للفترة إذا احتجت مراجعة أوسع.</p>
      </div>
      <ReviewPulseSection
        pulse={pulse}
        excludedOrders={state.excludedOrders}
        onOpenOrder={orderId => navigate(`/orders/${orderId}`)}
      />
      <CashDecisionSurface
        decision={decision}
        unallocatedCashMinor={position.unallocatedCashMinor}
        onDeclare={() => navigate("/finance/g5/declaration")}
        onReviewCash={() => navigate("/cash")}
      />
      <OwnerDecisionCard overview={owner} onOpen={() => navigate("/finance/owner-entitlement")} />
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
        <PositionCard
          label="مال المالك المسجل"
          value={position.ownerCapitalRecordedMinor}
          helper="استثمار ناقص سحب شخصي"
          icon={CircleDollarSign}
        />
      </section>
      <section className="micro-finance-truth">
        <ReceiptText aria-hidden="true" />
        <div>
          <h2>ما نعرفه الآن</h2>
          <p>{position.truth}</p>
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
          {/* §2.7 (F-031): الحقيقة غير المسجلة طريق — لا عدد أصفار عاجز. */}
          {position.cashWalletCount === 0 ? (
            <p className="micro-fact-road-line">
              الكاش: لا محفظة معلنة بعد —{" "}
              <button
                className="micro-text-action"
                type="button"
                onClick={() => navigate("/cash/wallet/new")}
              >
                سجّل محفظة ورصيد بداية
              </button>
            </p>
          ) : null}
        </div>
      </section>
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
            <p className="micro-field-error" role="status">
              اختر نطاقًا يبدأ قبل نهايته؛ القراءة أدناه تبقى على آخر نطاق صحيح.
            </p>
          ) : null}
          <p className="micro-period-range-label">
            النطاق المحدد: {formatMonthLabel(appliedRange.from)} — {formatMonthLabel(appliedRange.to)}. هذا رقم
            تشغيلي مسجل من البنود المعروفة، وليس صافي ربح نهائيًا.
          </p>
          <p className="micro-period-result-value">
            <span>
              الإيراد − التكلفة المباشرة المستخدمة − المصروف التشغيلي الموزّع، ضمن الفترة المحددة فقط
            </span>
            <strong>
              {period.resultMinor === null ? "غير متاح" : <MoneyValue minor={period.resultMinor} />}
            </strong>
          </p>
          <p className="micro-period-status" data-status={period.status}>
            {recordedPeriodStatusLabel(period.status)}
            {period.status === "incomplete" ? "؛ يظهر الرقم ولا يخفي البنود المستبعدة أو التقديرية." : null}
          </p>
          <dl>
            <div>
              <dt>إيراد طلبات نهائية</dt>
              <dd>
                <PeriodMoney value={period.recognizedRevenueMinor} status={period.status} />
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
              <dt>هدر مخزون عام</dt>
              <dd>
                <PeriodMoney value={period.generalInventoryWasteMinor} status={period.status} />
              </dd>
            </div>
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
                  <bdi dir="ltr" className="micro-inline-number">
                    غير متاح
                  </bdi>
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
              {cogsStatusLabel(period.cogsStatus)}. الأعمال النهائية التي رجعت إلى نسخة التكلفة لغياب استهلاك
              مؤهل: <IntegerValue value={period.cogsMissingOrderCount} className="micro-inline-number" />.
            </p>
            {period.cogsReasons.length > 0 ? (
              <ul>
                {period.cogsReasons.map(reason => (
                  <li key={reason}>{reason}</li>
                ))}
              </ul>
            ) : null}
            <p className="micro-period-next-action">الخطوة التالية: {period.cogsNextAction}</p>
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
          {period.sharedUnallocatedExpenseCount > 0 ? (
            <p className="micro-period-next-action">
              الخطوة التالية: حدد حصة المشروع للمصروف المشترك غير الموزّع قبل الاعتماد على نتيجة أدق؛ لم يخصم
              المصدر المستبعد من الرقم أعلاه.
            </p>
          ) : null}
          <p className="micro-period-truth">{period.truth}</p>
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
          onDeclare={() => navigate("/finance/g5/declaration")}
          onChanged={notifyDataChanged}
        />
      </details>
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
            onClick={() => navigate("/cash")}
          >
            محافظ الكاش والافتتاح
          </button>
          <button
            className="micro-button micro-button-secondary"
            type="button"
            onClick={() => navigate("/suppliers")}
          >
            مشتريات المواد والموردون
          </button>
          <button
            className="micro-button micro-button-secondary"
            type="button"
            onClick={() => navigate("/inventory")}
          >
            المواد والمخزون
          </button>
          <button
            className="micro-button micro-button-secondary"
            type="button"
            onClick={() => navigate("/finance/new/operating_expense_cash")}
          >
            سجل مصروفًا مدفوعًا
          </button>
          <button
            className="micro-button micro-button-secondary"
            type="button"
            onClick={() => navigate("/finance/new/operating_expense_payable")}
          >
            سجل التزامًا لمورد
          </button>
          <button
            className="micro-button micro-button-secondary"
            type="button"
            onClick={() => navigate("/finance/new/owner_investment_cash")}
          >
            سجل استثمارًا
          </button>
          <button
            className="micro-button micro-button-secondary"
            type="button"
            onClick={() => navigate("/finance/new/owner_withdrawal_cash")}
          >
            سجل سحبًا شخصيًا
          </button>
          <button
            className="micro-button micro-button-secondary"
            type="button"
            onClick={() => navigate("/finance/owner-entitlement")}
          >
            دفتر حق المالك
          </button>
          {position.supplierPayablesMinor > 0 ? (
            <button
              className="micro-button micro-button-secondary"
              type="button"
              onClick={() => navigate("/finance/new/payable_settlement_cash")}
            >
              سدد التزام مصروف
            </button>
          ) : null}
        </section>
      </details>
      <details className="micro-finance-layer">
        <summary className="micro-finance-layer-summary">
          <span>
            <b>العربونات</b>
            <small>
              {state.deposits.deposits.length > 0
                ? `${state.deposits.deposits.length} عربونًا مقبوضًا · ينتظر التسوية: ${state.deposits.awaitingSettlementCount}`
                : "لا عربونات مقبوضة بعد"}
            </small>
          </span>
          <strong>افتح العربونات</strong>
        </summary>
        {/* إضافة المالك (القرار ١٩): قسم يجمع العربونات — كم عربونًا مقبوضًا، على أي طلبات، وأيها ينتظر تسوية. */}
        <section className="micro-finance-event-list" aria-label="قراءة العربونات">
          <div className="micro-finance-event-heading">
            <span className="micro-overline">العربونات المقبوضة · المبالغ (د.أ)</span>
            <h2>عربونات الطلبات في مكان واحد</h2>
            <p>{state.deposits.truth}</p>
          </div>
          {state.deposits.deposits.length > 0 ? (
            <>
              <p className="micro-period-range-label">
                إجمالي العربونات المقبوضة: <MoneyValue minor={state.deposits.collectedTotalMinor} /> ·
                ينتظر قرار التسوية:{" "}
                <IntegerValue value={state.deposits.awaitingSettlementCount} className="micro-inline-number" />
              </p>
              {state.deposits.deposits.map(row => (
                <button
                  key={row.orderId}
                  className="micro-home-recent-item"
                  type="button"
                  onClick={() => navigate(`/orders/${row.orderId}`)}
                >
                  <span>
                    <strong>{row.itemName || "طلب بلا وصف"}</strong>
                    <small>
                      {row.customerName || "عميل بلا اسم"} · عربون مقبوض:{" "}
                      <MoneyValue minor={row.depositCollectedMinor} className="micro-inline-number" />
                    </small>
                    <small className="micro-row-next-action">{depositStateLabel(row)}</small>
                  </span>
                  <ArrowLeft aria-hidden="true" />
                </button>
              ))}
            </>
          ) : (
            <p>لم تقبض عربونًا بعد. العربون يسجل من تسجيل الاتفاق، ويظهر هنا لحظة قبضه.</p>
          )}
        </section>
      </details>
      <details className="micro-finance-layer">
        <summary className="micro-finance-layer-summary">
          <span>
            <b>السجل والأثر</b>
            <small>آخر ثلاثة أحداث؛ افتح الصف لرؤية الأثر الكامل</small>
          </span>
          <strong>افتح السجل</strong>
        </summary>
        <section className="micro-finance-event-list">
          <div className="micro-finance-event-heading">
            <span className="micro-overline">السجل المحلي · المبالغ (د.أ)</span>
            <h2>أحدث الأحداث العامة</h2>
            <p>كل تراجع موثق يضيف حدثًا جديدًا؛ الأصل يبقى ظاهرًا ولا يوجد حذف.</p>
          </div>
          {visibleEvents.length > 0 ? (
            visibleEvents.map(event => (
              <FinancialEventRow
                key={event.id}
                event={event}
                events={state.events}
                projectFinance={projectFinance}
                onChanged={notifyDataChanged}
              />
            ))
          ) : (
            <p>لم تسجل حدثًا عامًا بعد. سجّل واقعًا تعرفه، لا تقديرًا لا تثق به.</p>
          )}
        </section>
      </details>
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
      <p className="micro-financial-pulse-note">
        الإيراد والتكلفة أعلاه محسوبان من الطلبات ذات النتيجة النهائية فقط؛ ليست هذه قراءة كل طلب مسلّم.
      </p>
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
      <p className="micro-financial-pulse-note">العربون قبض مرتبط بالطلب، والدين مستحق، والتسليم لا يضيف قبضًا تلقائيًا.</p>
    </section>
  );
}

function OwnerDecisionCard({ overview, onOpen }: { overview: OwnerEntitlementOverview; onOpen: () => void }) {
  return (
    <section
      className="micro-owner-decision-card"
      data-balance={overview.balanceState}
      aria-labelledby="owner-decision-title"
    >
      <div className="micro-section-heading">
        <div>
          <span className="micro-overline">حق المالك · دفتر منفصل عن الربح</span>
          <h2 id="owner-decision-title">حق المالك وما تحرك فعليًا</h2>
        </div>
        <bdi dir="ltr" className="micro-inline-number">
          {formatMoneyMinor(overview.remainingEntitlementBalanceMinor)} د.أ
        </bdi>
      </div>
      <p>
        {overview.balanceState === "positive"
          ? "المشروع ما زال مدينًا لك بهذا الرصيد المسجل."
          : overview.balanceState === "negative"
            ? "السجل يظهر سحوبات أكثر من الحق المسجل حتى الآن."
            : "لا يوجد رصيد حق متبقٍ في السجل الحالي."}
      </p>
      <div className="micro-owner-decision-grid">
        <Metric label="حق مسجل" value={formatMoneyMinor(overview.approvedEntitlementMinor)} />
        <Metric label="سحب/إرجاع فعلي" value={formatMoneyMinor(overview.cashMovementMinor)} />
        <Metric label="سياسات فعالة" value={String(overview.activePolicies.length)} />
      </div>
      <p className="micro-local-truth">
        حق المالك لا يغير كاش المشروع. السحب والإرجاع يغيران محفظة الكاش بسبب موثق، والاستثمار الجديد مستقل عن
        حق المالك.
      </p>
      <button className="micro-button micro-button-primary" type="button" onClick={onOpen}>
        فتح دفتر حق المالك والحركات
      </button>
    </section>
  );
}

function CashDecisionSurface({
  decision,
  unallocatedCashMinor,
  onDeclare,
  onReviewCash,
}: {
  decision: G5Decision;
  unallocatedCashMinor: number;
  onDeclare: () => void;
  onReviewCash: () => void;
}) {
  const cash = decision.shortCash;
  return (
    <section className="micro-cash-decision" aria-labelledby="cash-decision-title">
      <div className="micro-cash-decision-heading">
        <span className="micro-overline">
          قرار الكاش · <LocalDateValue value={cash.from} /> → <LocalDateValue value={cash.to} />
        </span>
        <h2 id="cash-decision-title">ماذا أفعل بالكاش؟</h2>
        <p>
          ابدأ بما هو متاح الآن، ثم قارنه بما تتوقع تحصيله وما يجب دفعه ضمن النطاق المحدد. هذه قراءة من مسجلاتك، لا
          وعد بأموال قادمة.
        </p>
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
            <strong>يوجد فرق كاش غير موزع يحتاج مراجعة</strong>
            <p>
              الفرق الحالي <MoneyValue minor={unallocatedCashMinor} /> د.أ. سببه ظاهر في المصادر المسجلة، لكنه
              ليس مصروفًا أو ربحًا جديدًا.
            </p>
          </div>
          <button className="micro-button micro-button-secondary" type="button" onClick={onReviewCash}>
            راجع مصدر الفرق
          </button>
        </div>
      ) : null}
      <p className="micro-cash-decision-truth">{decision.truth}</p>
    </section>
  );
}

function FinancialEventRow({
  event,
  events,
  projectFinance,
  onChanged,
}: {
  event: FinancialEvent;
  events: readonly FinancialEvent[];
  projectFinance: ProjectFinancialService;
  onChanged: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const reversal =
    events.find(
      candidate => candidate.correctionType === "reverse" && candidate.correctionOfEventId === event.id,
    ) ?? null;
  const isReversal = event.correctionType === "reverse";
  const original =
    isReversal && event.correctionOfEventId
      ? (events.find(candidate => candidate.id === event.correctionOfEventId) ?? null)
      : null;
  const begin = () => {
    setError(null);
    setSuccess(null);
    setReason("");
    setDetailsOpen(true);
    setOpen(true);
  };
  const cancel = () => {
    if (saving) return;
    setError(null);
    setReason("");
    setOpen(false);
  };
  const submit = async () => {
    const trimmed = reason.trim();
    if (!trimmed) {
      setError("سبب التصحيح مطلوب؛ اكتب لماذا سُجّل هذا الحدث خطأ قبل التراجع.");
      return;
    }
    setError(null);
    setSaving(true);
    const result = await projectFinance.reverse({
      sourceEventId: event.id,
      occurredOn: localDateInAmman(),
      reason: trimmed,
      idempotencyKey: `reverse:${event.id}`,
    });
    setSaving(false);
    if (!result.ok) {
      setError(result.message);
      return;
    }
    setOpen(false);
    setReason("");
    setSuccess(
      result.reused ? "التراجع موثق مسبقًا؛ لم يُضاعف الأثر." : "تم تسجيل تراجع موثق. الأصل محفوظ ولم يتغير.",
    );
    onChanged();
  };
  return (
    <article
      className="micro-finance-event"
      data-correction={isReversal ? "reverse" : reversal ? "reversed" : "source"}
    >
      <div className="micro-finance-event-main">
        <div>
          <strong>{eventLabel[event.type]}</strong>
          <small>
            <LocalDateValue value={event.occurredOn} /> ·{" "}
            {isReversal ? "تراجع موثق" : reversal ? "تم التراجع" : "مسجلة"}
          </small>
        </div>
        <b>
          <MoneyValue minor={event.amountMinor} /> د.أ
        </b>
      </div>
      <button
        className="micro-text-action micro-finance-event-toggle"
        type="button"
        aria-expanded={detailsOpen}
        aria-controls={`micro-finance-event-detail-${event.id}`}
        onClick={() => setDetailsOpen(current => !current)}
      >
        {detailsOpen ? "إخفاء الأثر الكامل" : "عرض الأثر الكامل"}
      </button>
      {detailsOpen ? (
        <div className="micro-finance-event-detail" id={`micro-finance-event-detail-${event.id}`}>
          <p className="micro-finance-event-note">{event.note}</p>
          {expenseContextLabel(event) ? (
            <p className="micro-finance-event-note">{expenseContextLabel(event)}</p>
          ) : null}
          {isReversal ? (
            <small className="micro-finance-event-audit">
              {original ? (
                <>
                  الأصل: {eventLabel[original.type]} · <LocalDateValue value={original.occurredOn} /> ·{" "}
                </>
              ) : null}
              السبب: {event.correctionReason}
            </small>
          ) : reversal ? (
            <small className="micro-finance-event-audit">
              التراجع الموثق: {eventLabel[reversal.type]} · <LocalDateValue value={reversal.occurredOn} /> ·
              السبب: {reversal.correctionReason}
            </small>
          ) : null}
          <div className="micro-finance-event-effects">
            <span>
              كاش <MoneyValue minor={event.cashDeltaMinor} /> د.أ
            </span>
            <span>
              التزام <MoneyValue minor={event.payableDeltaMinor} /> د.أ
            </span>
            <span>
              مال المالك <MoneyValue minor={event.ownerCapitalDeltaMinor} /> د.أ
            </span>
            <span>
              مصروف <MoneyValue minor={event.operatingExpenseDeltaMinor} /> د.أ
            </span>
          </div>
        </div>
      ) : null}
      {!isReversal && !reversal ? (
        <button className="micro-text-action" type="button" onClick={begin}>
          صحّح هذا الحدث
        </button>
      ) : null}
      {reversal ? (
        <p className="micro-finance-event-closed">تم التراجع عنها مرة واحدة بتراجع كامل؛ لا يُسمح بتراجع ثانٍ.</p>
      ) : null}
      {success ? (
        <p className="micro-save-note" role="status">
          {success}
        </p>
      ) : null}
      {open ? (
        <div className="micro-finance-reversal-editor">
          <div className="micro-finance-reversal-review">
            <strong>مراجعة قبل التراجع</strong>
            <p>
              سيبقى السجل الأصلي كما هو دون تعديل. سيُضاف حدث جديد بتاريخ اليوم المحلي ويلغي كامل الأثر،
              دون إعادة كتابة تاريخ الحدث.
            </p>
            <dl>
              <div>
                <dt>الحدث</dt>
                <dd>
                  {eventLabel[event.type]} · <LocalDateValue value={event.occurredOn} />
                </dd>
              </div>
              <div>
                <dt>الأثر الحالي</dt>
                <dd>
                  كاش <MoneyValue minor={event.cashDeltaMinor} /> · التزام{" "}
                  <MoneyValue minor={event.payableDeltaMinor} /> · مال المالك{" "}
                  <MoneyValue minor={event.ownerCapitalDeltaMinor} /> · مصروف{" "}
                  <MoneyValue minor={event.operatingExpenseDeltaMinor} />
                </dd>
              </div>
            </dl>
          </div>
          <label className="micro-field">
            <span>
              سبب التصحيح <small>مطلوب · لا يُقبل فارغًا</small>
            </span>
            <textarea
              value={reason}
              onChange={input => setReason(input.target.value)}
              placeholder="مثال: سُجّل الحدث مرتين بالخطأ"
              autoFocus
            />
          </label>
          <p className="micro-local-truth">
            التراجع لا يحذف التاريخ ولا يعدل المبلغ أو السياق القديم. إذا كان الحدث الصحيح مختلفًا، سجّل
            حدثًا جديدًا منفصلًا.
          </p>
          {error ? (
            <p className="micro-field-error" role="alert">
              {error}
            </p>
          ) : null}
          <div className="micro-form-actions">
            <button
              className="micro-button micro-button-primary"
              type="button"
              disabled={saving}
              onClick={() => void submit()}
            >
              {saving ? "جارٍ تسجيل التراجع…" : "أكّد التراجع الموثق"}
            </button>
            <button
              className="micro-button micro-button-secondary"
              type="button"
              disabled={saving}
              onClick={cancel}
            >
              إلغاء
            </button>
          </div>
        </div>
      ) : null}
    </article>
  );
}

function G5DecisionPanel({
  decision,
  g5,
  onDeclare,
  onChanged,
}: {
  decision: G5Decision;
  g5: import("@/application/g5/g5Service").G5Service;
  onDeclare: () => void;
  onChanged: () => void;
}) {
  const [error, setError] = useState<string | null>(null);
  const [reversalTarget, setReversalTarget] = useState<ShortCashDeclaration | null>(null);
  const [reversalNote, setReversalNote] = useState("");
  const [reversing, setReversing] = useState(false);
  const activeIds = new Set(
    decision.declarations.filter(entry => entry.kind === "reversal").map(entry => entry.reversalOfId),
  );
  const activeDeclarations = decision.declarations.filter(
    entry => entry.kind === "declaration" && !activeIds.has(entry.id),
  );
  const beginReverse = (entry: ShortCashDeclaration) => {
    setError(null);
    setReversalTarget(entry);
    setReversalNote("");
  };
  const cancelReverse = () => {
    setError(null);
    setReversalTarget(null);
    setReversalNote("");
  };
  const submitReverse = async () => {
    if (!reversalTarget) return;
    const note = reversalNote.trim();
    if (!note) {
      setError("اكتب سبب التصحيح قبل تنفيذ التراجع.");
      return;
    }
    setError(null);
    setReversing(true);
    const result = await g5.reverseDeclaration(reversalTarget.id, note, `reverse:${reversalTarget.id}`);
    setReversing(false);
    if (!result.ok) {
      setError(result.message);
      return;
    }
    cancelReverse();
    onChanged();
  };
  const contribution = decision.period;
  const breakEvenDisplay = formatBreakEvenDisplay(
    contribution.breakEvenUnits,
    contribution.quantityUnitKey,
    contribution.quantityUnitLabel,
  );
  return (
    <section className="micro-section micro-g5-surface" aria-label="تفاصيل القرار المالي للفترة">
      <div className="micro-section-heading">
        <div>
          <span className="micro-overline">
            تفاصيل القرار المالي · <LocalDateValue value={contribution.from} /> →{" "}
            <LocalDateValue value={contribution.to} />
          </span>
          <h2>قراءة الهامش المسجل</h2>
        </div>
      </div>
      <article
        className="micro-g5-card micro-g5-card-secondary"
        data-tone={
          contribution.status === "available"
            ? "accent"
            : contribution.status === "invalid"
              ? "danger"
              : "warning"
        }
      >
        <div className="micro-card-copy">
          <span className="micro-card-eyebrow">الهامش بعد الكلفة المباشرة — قراءة ثانوية</span>
          <h2>
            {contribution.status === "invalid"
              ? "لا يمكن إعطاء رقم تعادل"
              : contribution.status === "incomplete"
                ? "الهامش ناقص من مصدر مؤثر"
                : statusLabel(contribution.status)}
          </h2>
          <p>
            الإيراد والكلفة المباشرة مأخوذان من الطلبات النهائية ذات نسخة التكلفة المسجلة. هذه قراءة
            مسجلة للفترة، وليست صافي ربح نهائيًا ولا تكلفة بيع فعلية.
          </p>
        </div>
        <div className="micro-g5-metrics">
          <Metric
            label="الإيراد النهائي"
            value={displayContributionAmount(contribution.totalRevenueMinor, contribution.status)}
          />
          <Metric
            label="الكلفة المباشرة للطلبات النهائية"
            value={displayContributionAmount(contribution.totalVariableCostMinor, contribution.status)}
          />
          <Metric
            label="المصاريف الثابتة المسجلة"
            value={displayContributionAmount(contribution.fixedExpenseMinor, contribution.status)}
          />
          <Metric
            label="الهامش الكلي"
            value={displayContributionAmount(contribution.contributionMarginMinor, contribution.status)}
            negative={contribution.contributionMarginMinor < 0}
          />
          <Metric
            label="الهامش لكل وحدة"
            value={
              contribution.contributionMarginPerUnitMinor === null
                ? "غير متاح"
                : formatted(Math.round(contribution.contributionMarginPerUnitMinor))
            }
          />
        </div>
        <div className="micro-g5-break-even">
          <span>كم وحدة تغطي المصاريف الثابتة</span>
          <strong>
            {breakEvenDisplay === null ? (
              "غير متاحة"
            ) : (
              <>
                <bdi dir="ltr" className="micro-inline-number">
                  {breakEvenDisplay.number}
                </bdi>{" "}
                {breakEvenDisplay.scale}
              </>
            )}
          </strong>
          <p>
            {contribution.breakEvenUnits === null ? (
              (contribution.reasons[0] ?? "لا توجد شروط كافية.")
            ) : (
              <>
                التكاليف الثابتة{" "}
                <MoneyValue minor={contribution.fixedExpenseMinor} className="micro-inline-number" /> ÷ هامش
                الوحدة المسجل. المزيج ليس توقعًا للمبيعات.
              </>
            )}
          </p>
          {contribution.mix.length > 0 ? (
            <ul className="micro-g5-mix">
              {contribution.mix.slice(0, 4).map(item => (
                <li key={`${item.itemName}-${item.unitKey ?? "unknown"}`}>
                  {item.itemName}:{" "}
                  <bdi dir="ltr" className="micro-inline-number">
                    {formatQuantityMilli(item.quantityMilli)}
                  </bdi>{" "}
                  {item.unitLabel ?? "وحدة غير موحدة"} · هامش{" "}
                  <MoneyValue minor={item.contributionMarginMinor} className="micro-inline-number" />
                </li>
              ))}
            </ul>
          ) : null}
        </div>
        <G5Reasons
          reasons={contribution.reasons}
          assumptions={contribution.assumptions}
          excluded={contribution.excluded}
          sources={contribution.sources}
          nextAction={contribution.nextAction}
        />
      </article>
      <article className="micro-g5-declarations">
        <div className="micro-section-heading">
          <div>
            <span className="micro-overline">أثر قابل للتصحيح</span>
            <h2>المتوقعات المحلية</h2>
          </div>
          <span className="micro-g5-count">{activeDeclarations.length}</span>
        </div>
        {activeDeclarations.length === 0 ? (
          <p>لا توجد متوقعات مسجلة. لن يفترض النظام مواعيد من تلقاء نفسه.</p>
        ) : (
          <div className="micro-g5-declaration-list">
            {activeDeclarations.map(entry => (
              <div className="micro-g5-declaration" key={entry.id}>
                <div>
                  <strong>
                    {entry.direction === "collection" ? "قبض متوقع" : "دفع متوقع"} · {entry.source}
                  </strong>
                  <small>
                    {entry.dueOn ? <LocalDateValue value={entry.dueOn} /> : "بلا تاريخ"} ·{" "}
                    {entry.knowledge === "known"
                      ? "معروف"
                      : entry.knowledge === "estimated"
                        ? "تقديري"
                        : "يحتاج مراجعة"}{" "}
                    · <MoneyValue minor={entry.amountMinor} className="micro-inline-number" />
                  </small>
                </div>
                <button className="micro-text-action" type="button" onClick={() => beginReverse(entry)}>
                  صحّح بتراجع موثق
                </button>
                {reversalTarget?.id === entry.id ? (
                  <div className="micro-g5-reversal-editor">
                    <label className="micro-field">
                      <span>
                        سبب التصحيح <small>مطلوب قبل التراجع</small>
                      </span>
                      <textarea
                        value={reversalNote}
                        onChange={event => setReversalNote(event.target.value)}
                        placeholder="مثال: أكد العميل موعدًا مختلفًا للتحصيل"
                      />
                    </label>
                    <p className="micro-local-truth">
                      لن يُنفذ التراجع قبل كتابة سبب غير فارغ. سيُحفظ هذا النص في سجل التراجع مع بقاء السجل المتوقع
                      الأصلي محفوظًا.
                    </p>
                    <div className="micro-form-actions">
                      <button
                        className="micro-button micro-button-primary"
                        type="button"
                        disabled={reversing}
                        onClick={() => void submitReverse()}
                      >
                        {reversing ? "جارٍ حفظ التصحيح…" : "تنفيذ التراجع بسبب موثق"}
                      </button>
                      <button
                        className="micro-button micro-button-secondary"
                        type="button"
                        disabled={reversing}
                        onClick={cancelReverse}
                      >
                        إلغاء
                      </button>
                    </div>
                  </div>
                ) : null}
              </div>
            ))}
          </div>
        )}
        {error ? (
          <p className="micro-field-error" role="alert">
            {error}
          </p>
        ) : null}
      </article>
      <p className="micro-cost-disclaimer">
        القراءة النقدية أعلاه هي موضع القرار الأول. هذه التفاصيل مبنية على الفترة والمصادر المعلنة ولا تحفظ
        نتيجة جديدة.
      </p>
    </section>
  );
}

function G5Reasons({
  reasons,
  assumptions,
  excluded,
  sources,
  nextAction,
}: {
  reasons: readonly string[];
  assumptions: readonly string[];
  excluded: readonly string[];
  sources: readonly string[];
  nextAction: string;
}) {
  return (
    <div className="micro-g5-guidance">
      {reasons.length > 0 ? (
        <div>
          <strong>ما يمنع اكتمال القراءة</strong>
          <ul>
            {reasons.slice(0, 4).map(reason => (
              <li key={reason}>{reason}</li>
            ))}
          </ul>
        </div>
      ) : null}
      {assumptions.length > 0 ? (
        <div>
          <strong>افتراضات معلنة</strong>
          <ul>
            {assumptions.slice(0, 4).map(assumption => (
              <li key={assumption}>{assumption}</li>
            ))}
          </ul>
        </div>
      ) : null}
      {excluded.length > 0 ? (
        <div>
          <strong>استبعادات ظاهرة</strong>
          <ul>
            {excluded.slice(0, 4).map(entry => (
              <li key={entry}>{entry}</li>
            ))}
          </ul>
        </div>
      ) : null}
      {sources.length > 0 ? (
        <p className="micro-g5-sources">
          <strong>المصادر المستخدمة:</strong> {sources.slice(0, 4).map(formatSourceDates).join(" · ")}
        </p>
      ) : null}
      <p className="micro-decision-next">الخطوة التالية: {nextAction}</p>
    </div>
  );
}
function Metric({ label, value, negative = false }: { label: string; value: string; negative?: boolean }) {
  return (
    <div>
      <span>{label}</span>
      <strong className="micro-number" data-negative={negative}>
        {value}
      </strong>
    </div>
  );
}
function PeriodMoney({ value, status }: { value: number; status: RecordedPeriodResult["status"] }) {
  return status === "invalid" ? (
    <bdi dir="ltr" className="micro-number">
      غير متاح
    </bdi>
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
