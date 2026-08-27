/* مبدأ Micro: ابدأ بقرار الكاش والفعل الأقرب، وأجّل قراءة الفترة والسجل والأثر الكامل إلى طبقات مستقلة. */
import { ArrowLeft, CircleDollarSign, HandCoins, Landmark, ReceiptText, WalletCards } from "lucide-react";
import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { usePrototypeServices } from "@/app/PrototypeServicesContext";
import type {
  ProjectFinancialPosition,
  ProjectFinancialService,
  RecordedPeriodResult,
} from "@/application/finance/projectFinancialService";
import type { OwnerEntitlementOverview } from "@/application/finance/ownerEntitlementService";
import type { G5Decision } from "@/application/g5/g5Service";
import type { FinancialEvent, FinancialEventType } from "@micro-domain/financial-event/index.js";
import type { ShortCashDeclaration } from "@micro-domain/g5/index.js";
import { IntegerValue, LocalDateValue, MoneyValue } from "@/components/presentation/DisplayValue";
import {
  formatBreakEvenDisplay,
  formatLocalDate,
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
    return `مصروف مشترك غير محمل · ${formatMoneyMinor(share.totalAmountMinor ?? event.amountMinor)}`;
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
  return `حصة مشروع مشتركة · ${knowledge} · ${sourceLabel}`;
};
const currentMonth = () => localDateInAmman().slice(0, 7);
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
    ? "COGS مسجلة من استهلاك مؤهل لكل الأعمال النهائية"
    : status === "partial"
      ? "COGS مسجلة لبعض الأعمال، وSnapshot مستخدم لبقية الأعمال"
      : "لا توجد COGS مؤهلة؛ Snapshot هو المصدر البديل المعلن";
const shortStatusLabel = (status: G5Decision["shortCash"]["status"]) =>
  status === "available"
    ? "توقع معلن مكتمل"
    : status === "needs_review"
      ? "توقع معلن يحتاج مراجعة"
      : status === "invalid"
        ? "إعلان غير صالح"
        : "لا يكفي لبناء توقع";

export default function Finance() {
  const [, navigate] = useLocation();
  const { projectFinance, ownerEntitlement, g5, dataVersion, notifyDataChanged } = usePrototypeServices();
  const [fromMonth, setFromMonth] = useState(currentMonth);
  const [toMonth, setToMonth] = useState(currentMonth);
  const [state, setState] = useState<FinanceState>({ phase: "loading" });
  useEffect(() => {
    let active = true;
    if (!validMonth(fromMonth) || !validMonth(toMonth) || fromMonth > toMonth) {
      setState({ phase: "error", message: "اختر نطاقًا صحيحًا يبدأ من شهر لا يتجاوز شهر النهاية." });
      return () => {
        active = false;
      };
    }
    const from = monthBounds(fromMonth);
    const to = monthBounds(toMonth);
    Promise.all([
      projectFinance.readPosition(),
      projectFinance.listEvents(),
      projectFinance.readRecordedPeriodResult(from.from, to.to),
      g5.readDecision(from.from, to.to),
      ownerEntitlement.readOverview(),
    ]).then(([position, events, result, decision, owner]) => {
      if (!active) return;
      if (!position.ok || !events.ok || !result.ok || !decision.ok || !owner.ok) {
        setState({ phase: "error", message: "لم يتم تغيير بياناتك. أعد فتح التطبيق للمحاولة." });
        return;
      }
      setState({
        phase: "ready",
        position: position.value,
        events: events.value,
        period: result.value,
        decision: decision.value,
        owner: owner.value,
      });
    });
    return () => {
      active = false;
    };
  }, [dataVersion, fromMonth, toMonth, projectFinance, g5, ownerEntitlement]);
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
  const { position, period, decision, owner } = state;
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
        <h1>وضعي المالي الآن</h1>
        <p>ابدأ بالكاش والالتزامات القريبة، ثم افتح القراءة المسجلة للفترة إذا احتجت مراجعة أوسع.</p>
      </div>
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
              <h2>صافي الربح التشغيلي المسجل للفترة</h2>
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
          <p className="micro-period-range-label">
            النطاق المحدد: <bdi dir="ltr">{fromMonth}</bdi> — <bdi dir="ltr">{toMonth}</bdi>. هذا رقم تشغيلي
            مسجل من البنود المعروفة، وليس صافي ربح نهائيًا.
          </p>
          <p className="micro-period-result-value">
            <span>
              الإيراد − التكلفة المباشرة المستخدمة − المصروف التشغيلي المحمل، ضمن الفترة المحددة فقط
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
              <dt>تكلفة مباشرة من Snapshot</dt>
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
              <dt>حصص مشروع مشتركة محملة</dt>
              <dd>
                <PeriodMoney value={period.sharedProjectExpenseMinor} status={period.status} />
              </dd>
            </div>
            <div>
              <dt>مصروف مشترك غير محمل</dt>
              <dd>
                <PeriodMoney value={period.sharedUnallocatedExpenseMinor} status={period.status} />
              </dd>
            </div>
            <div>
              <dt>استهلاك عام غير محمل</dt>
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
            <strong>مصدر التكلفة وحالة COGS</strong>
            <p>
              {cogsStatusLabel(period.cogsStatus)}. الأعمال النهائية التي رجعت إلى Snapshot لغياب استهلاك
              مؤهل: <IntegerValue value={period.cogsMissingOrderCount} className="micro-inline-number" />.
            </p>
            {period.cogsReasons.length > 0 ? (
              <ul>
                {period.cogsReasons.map(reason => (
                  <li key={reason}>{reason}</li>
                ))}
              </ul>
            ) : null}
            <p className="micro-period-next-action">الفعل التالي: {period.cogsNextAction}</p>
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
              الفعل التالي: حدد حصة المشروع للمصروف المشترك غير المحمل قبل الاعتماد على نتيجة أدق؛ لم يخصم
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
            <small>قراءة G5 للفترة والمزيج والإعلانات المعلنة</small>
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
            دفتر استحقاق المالك والسحب الفعلي
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
            <b>السجل والأثر</b>
            <small>آخر ثلاثة أحداث؛ افتح الصف لرؤية الأثر الكامل</small>
          </span>
          <strong>افتح السجل</strong>
        </summary>
        <section className="micro-finance-event-list">
          <div className="micro-finance-event-heading">
            <span className="micro-overline">السجل المحلي · المبالغ (د.أ)</span>
            <h2>أحدث الأحداث العامة</h2>
            <p>كل عكس موثق يضيف حدثًا جديدًا؛ الأصل يبقى ظاهرًا ولا يوجد حذف.</p>
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
            ? "السجل يظهر سحوبات أكثر من الاستحقاق المسجل حتى الآن."
            : "لا يوجد رصيد استحقاق متبقٍ في السجل الحالي."}
      </p>
      <div className="micro-owner-decision-grid">
        <Metric label="استحقاق مسجل" value={formatMoneyMinor(overview.approvedEntitlementMinor)} />
        <Metric label="سحب/إرجاع فعلي" value={formatMoneyMinor(overview.cashMovementMinor)} />
        <Metric label="سياسات فعالة" value={String(overview.activePolicies.length)} />
      </div>
      <p className="micro-local-truth">
        الاستحقاق لا يغير كاش المشروع. السحب والإرجاع يغيران محفظة الكاش بسبب موثق، والاستثمار الجديد مستقل عن
        الاستحقاق.
      </p>
      <button className="micro-button micro-button-primary" type="button" onClick={onOpen}>
        فتح دفتر الاستحقاق والحركات
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
          ابدأ بما هو متاح الآن، ثم قارنه بما تتوقع تحصيله وما يجب دفعه ضمن النطاق المحدد. هذه قراءة معلنة، لا
          وعد بتدفق نقدي.
        </p>
      </div>
      <div className="micro-cash-decision-metrics">
        <Metric
          label="الكاش المسجل الآن"
          value={displayCashAmount(cash.recordedCashMinor, cash.status)}
          negative={cash.status !== "invalid" && cash.recordedCashMinor < 0}
        />
        <Metric
          label="تحصيلات قريبة معلنة"
          value={displayCashAmount(cash.declaredCollectionsMinor, cash.status)}
        />
        <Metric
          label="التزامات قريبة معلنة"
          value={displayCashAmount(cash.declaredCommitmentsMinor, cash.status)}
          negative={
            cash.status !== "invalid" && cash.declaredCommitmentsMinor > cash.declaredCollectionsMinor
          }
        />
        <Metric
          label="بعد المعلن"
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
      setError("سبب التصحيح مطلوب؛ اكتب لماذا سُجلت هذه الواقعة خطأ قبل العكس.");
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
      result.reused ? "العكس موثق مسبقًا؛ لم يُضاعف الأثر." : "تم تسجيل عكس موثق. الأصل محفوظ ولم يتغير.",
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
            {isReversal ? "عكس موثق" : reversal ? "عُكست" : "مسجلة"}
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
              الأصل: <bdi dir="ltr">{event.correctionOfEventId}</bdi> · السبب: {event.correctionReason}
            </small>
          ) : reversal ? (
            <small className="micro-finance-event-audit">
              العكس الموثق: <bdi dir="ltr">{reversal.id}</bdi> · السبب: {reversal.correctionReason}
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
          صحح هذه الواقعة
        </button>
      ) : null}
      {reversal ? (
        <p className="micro-finance-event-closed">عُكست مرة واحدة بعكس كامل؛ لا يُسمح بعكس ثانٍ.</p>
      ) : null}
      {success ? (
        <p className="micro-save-note" role="status">
          {success}
        </p>
      ) : null}
      {open ? (
        <div className="micro-finance-reversal-editor">
          <div className="micro-finance-reversal-review">
            <strong>مراجعة قبل العكس</strong>
            <p>
              سيبقى الأصل immutable كما هو. سيُضاف حدث جديد بتاريخ اليوم المحلي ويعكس كامل الأثر، دون إعادة
              كتابة تاريخ الواقعة.
            </p>
            <dl>
              <div>
                <dt>الواقعة</dt>
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
              placeholder="مثال: سُجلت الواقعة مرتين بالخطأ"
              autoFocus
            />
          </label>
          <p className="micro-local-truth">
            العكس لا يحذف التاريخ ولا يعدل المبلغ أو السياق القديم. إذا كانت الواقعة الصحيحة مختلفة، سجّل
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
              {saving ? "جارٍ تسجيل العكس…" : "أكّد العكس الموثق"}
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
      setError("اكتب سبب التصحيح قبل تنفيذ العكس.");
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
          <span className="micro-card-eyebrow">هامش المساهمة — قراءة ثانوية</span>
          <h2>
            {contribution.status === "invalid"
              ? "لا يمكن إعطاء رقم تعادل"
              : contribution.status === "incomplete"
                ? "الهامش ناقص من مصدر مؤثر"
                : statusLabel(contribution.status)}
          </h2>
          <p>
            الإيراد والتكلفة المتغيرة مأخوذان من الطلبات النهائية ذات Snapshot المسجل. هذه قراءة مسجلة للفترة،
            وليست صافي ربح نهائيًا ولا COGS فعليًا.
          </p>
        </div>
        <div className="micro-g5-metrics">
          <Metric
            label="الإيراد النهائي"
            value={displayContributionAmount(contribution.totalRevenueMinor, contribution.status)}
          />
          <Metric
            label="التكلفة المتغيرة"
            value={displayContributionAmount(contribution.totalVariableCostMinor, contribution.status)}
          />
          <Metric
            label="الثابت المسجل"
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
          <span>نقطة التعادل المفككة من المزيج المسجل</span>
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
            <h2>الإعلانات المحلية</h2>
          </div>
          <span className="micro-g5-count">{activeDeclarations.length}</span>
        </div>
        {activeDeclarations.length === 0 ? (
          <p>لا توجد إعلانات فعالة. لن يفترض النظام مواعيد من تلقاء نفسه.</p>
        ) : (
          <div className="micro-g5-declaration-list">
            {activeDeclarations.map(entry => (
              <div className="micro-g5-declaration" key={entry.id}>
                <div>
                  <strong>
                    {entry.direction === "collection" ? "تحصيل معلن" : "التزام معلن"} · {entry.source}
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
                  صحح بعكس موثق
                </button>
                {reversalTarget?.id === entry.id ? (
                  <div className="micro-g5-reversal-editor">
                    <label className="micro-field">
                      <span>
                        سبب التصحيح <small>مطلوب قبل العكس</small>
                      </span>
                      <textarea
                        value={reversalNote}
                        onChange={event => setReversalNote(event.target.value)}
                        placeholder="مثال: أكد العميل موعدًا مختلفًا للتحصيل"
                      />
                    </label>
                    <p className="micro-local-truth">
                      لن يُنفذ العكس قبل كتابة سبب غير فارغ. سيُحفظ هذا النص في سجل العكس مع بقاء الإعلان
                      الأصلي محفوظًا.
                    </p>
                    <div className="micro-form-actions">
                      <button
                        className="micro-button micro-button-primary"
                        type="button"
                        disabled={reversing}
                        onClick={() => void submitReverse()}
                      >
                        {reversing ? "جارٍ حفظ التصحيح…" : "تنفيذ العكس بسبب موثق"}
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
      <p className="micro-decision-next">الفعل التالي: {nextAction}</p>
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
