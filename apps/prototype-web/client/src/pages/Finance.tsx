/* مبدأ Micro: ابدأ بقرار الكاش والفعل الأقرب، وأجّل قراءة الفترة والسجل والأثر الكامل إلى طبقات مستقلة. */
/* §2.2: المراجعة اندمجت نبضةً أعلى هذه الصفحة (F-003) — جلسة قراءة أسبوعية لا تستحق مقعدًا. */
import {
  ArrowRight,
  ArrowLeft,
  CircleAlert,
  CircleDollarSign,
  HandCoins,
  Landmark,
  LayoutGrid,
  Plus,
  ReceiptText,
  Scale,
  WalletCards,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useLocation, useSearch } from "wouter";
import { useReturnPath } from "@/app/useReturnNavigation";
import { appendQueryParams, withReturnTo } from "@/app/navigationContract";
import { usePrototypeServices, getPrototypeLocalStore } from "@/app/PrototypeServicesContext";
import type { LocalFinancialPulse } from "@/application/financial-pulse";
import type {
  BridgeState,
  FinancialMetricEvidence,
  FinanceBlockId,
  FinanceState,
  ProjectFinancialService,
  RecordedPeriodResult,
} from "@/application/finance";
/* R7/R6-F17-P02 (2026-10-10): قراء تجميع نموذج عرض المالية من بيتهما التطبيقي —
 * استيراد عميق موثق بأساس (الشظية الكسولة وحدها تستهلكه؛ الباب يبقى أنواعًا
 * فقط كي لا تدخل قيم كومة الإقلاع عبر استيراد جذر التركيب للباب). */
import { monthBounds, readFinanceOverview, readProfitToCashBridge } from "@/application/finance/financeState";
import type { OwnerEntitlementOverview } from "@/application/owner-money";
import type { G5Decision } from "@/application/financial-analysis/financialAnalysisService";
/* UNIT-021 (تنفيذ S15 بالأمر الموحد §5): استيرادا أفق الكاش القصير
 * والسحب الآمن أزيلا من صفحة المالية مع القدرة المؤجلة — لا قراءة توقع
 * ولا توصية سحب في النطاق الأساسي ولا بديل يوحي بوجودها. */
import type { StoredCraftOrder } from "@/storage/local/types";
/* FIN-002 (WS-174 — Wave 2): أنواع الميزانيات الاختيارية — النوع فقط هنا
 * (import(...) في موضع النوع — سابقة Schedule.tsx) فلا تُسحب وحدة الخدمة
 * إلى كومة الصفحة ولا إلى طيف كثافة النص؛ الخدمة تُحمّل ديناميكيًا عند
 * أول فتح للقسم (سابقة EXE-014/D-034 كما في OPS-003). */
import type { BudgetScope, ExpenseBudgetRecord } from "@micro-domain/budget/index.js";
import {
  IntegerValue,
  LocalDateValue,
  MoneyValue,
  MoneyWithUnit,
} from "@/components/presentation/DisplayValue";
import G5DecisionPanel from "@/components/finance/G5DecisionPanel";
import { EventsLayer } from "@/components/finance/EventsLayer";
import { RestatementNote } from "@/components/finance/RestatementNote";
import { FinancePeriodResultSection } from "@/components/finance/FinancePeriodResultSection";
/* Wave 4.2 — P-4.2-5 (F02/T3): سياسات الربح والتوزيع — السطح المالي بعد نقله
 * من الكتالوج؛ موضعه «ملخص الفترة» بجوار «التغطية والتعادل». */
import { FinancePoliciesSection } from "@/components/finance/FinancePoliciesSection";
/* Wave 4.3 — P-4.3-3 (F09): سطح «شو عليّ؟» الموحد بمصدرَيه ومسارَي تسديدهما. */
import { FinanceObligationsCard } from "@/components/finance/FinanceObligationsCard";
/* FIN-002 (WS-174 — Wave 2): جسم الميزانيات الاختيارية — مكوّن مستقل (كثافة + سابقة RecurringConfirmPanel). */
import { FinanceBudgetsSection } from "@/components/finance/ExpenseBudgetsSectionBody";
import { FinanceFunctionsBoard } from "@/components/finance/FinanceFunctionsBoard";
import { todayInAmman } from "@/application/time";
import {
  formatBreakEvenDisplay,
  formatLocalDate,
  formatMonthLabel,
  formatMoneyMinor,
  formatQuantityMilli,
} from "@/presentation/formatters";

import { Button } from "@/components/primitives";
/* G-005 (تدقيق الإدارة المالية المتدرجة 2026-09-19): كتل القراءة المعزولة
 * الفشل — المجموعة الأساسية (المركز + النبضة) وحدها تحجب الصفحة عند فشلها،
 * وكل كتلة متقدمة مستقلة: قيمتها null تعني تعذر قراءتها (لا صفرًا كاذبًا)،
 * وfailedBlocks يحدد المعطوبة لبطاقة خطأ موجزة + إعادة محاولة لكل كتلة،
 * والأسطح السليمة تبقى من مصادرها الحية. — أنواع نموذج العرض وقراء التجميع
 * انتقلت إلى بيتها التطبيقي المالك (R7/R6-F17-P02، 2026-10-10):
 * application/finance/financeState.ts؛ الأنواع عبر باب المالية، والدوال من
 * الوحدة مباشرة داخل الشظية الكسولة، والصفحة تُبقي ربط React وحده. */
/* FIN-002 (WS-174 — Wave 2): حالة تحميل خدمة الميزانيات — null يعني «جارٍ
 * التجهيز» (نمط transfers/recurringExpenses في جذر التركيب نفسه، لكن هنا
 * محليًا داخل الصفحة: الخدمة لا تُسجّل في السياق أبدًا). */
type BudgetsServiceLoad =
  | { phase: "idle" }
  | { phase: "loading" }
  | { phase: "error" }
  | { phase: "ready"; service: ExpenseBudgetServiceT };
type ExpenseBudgetServiceT = import("@/application/budgets").ExpenseBudgetService;
type ExpenseBudgetStatusesReadingT = import("@/application/budgets").ExpenseBudgetStatusesReading;
type ExpenseBudgetStatusLineT = import("@/application/budgets").ExpenseBudgetStatusLine;
type ExpenseBudgetMonthListT = import("@/application/budgets").ExpenseBudgetMonthList;
/* تسمية النطاق — مفردات عقد ٤٢ §٤: «مصروف عام» أو «فئة: نص صريح». */
/* مفاتيح الأشهر داخل نطاق معروض صالح — سقف دفاعي لا حلقة بلا نهاية. */
const currentMonth = () => todayInAmman().slice(0, 7);
/* FIN-001 (قرار المالك ٢٠٢٦-٠٩-١٦): تسمية واحدة لحالة «غير مسجل» في كل مالي —
 * القيمة العددية باقية كما هي، والعرض يتبع حالة الدليل لا العدد. */
const NOT_RECORDED_LABEL = "غير مسجل";
const unknownValue = () => <span className="micro-unknown-value">{NOT_RECORDED_LABEL}</span>;
const evidenceValue = (state: FinancialMetricEvidence, minor: number) =>
  state === "recorded" ? <MoneyValue minor={minor} /> : unknownValue();
const validMonth = (month: string) =>
  /^\d{4}-\d{2}$/.test(month) && Number(month.slice(5)) >= 1 && Number(month.slice(5)) <= 12;
/* UNIT-021 (تنفيذ S15): مساعدات عرض قراءة الكاش التوقعية أزيلت مع البطاقة
 * المؤجلة؛ مساعدات الهامش المسجل تبقى في وحدة طبقتها. */
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
  /* S1-09: ?layer=events يفتح طبقة الأحداث من الوصلة العميقة (عقد ٢٦ §3.1)؛
   * طبقة التصحيحات غادرت الجذر مع UNIT-013 (تنفيذ S15) والمعامل القديم
   * يُهمل بهدوء بلا انفجار. */
  const layerParam = new URLSearchParams(search).get("layer");
  /* UNIT-013 / AF-B (تنفيذ S15): لوحة وظائف المالية — مغلقة أولًا ولا تفتح
   * تلقائيًا عند الدخول؛ الإغلاق يعيد التركيز لزرها (AF-AC07). */
  const [boardOpen, setBoardOpen] = useState(false);
  const functionsButtonRef = useRef<HTMLButtonElement>(null);
  const budgetsSectionRef = useRef<HTMLElement>(null);
  const periodSectionRef = useRef<HTMLElement>(null);
  /* F-003 (UXR-03 — أمر W02): كشف القسم السياقي بعد استقرار المساحة
   * الفرعية. مدخل الميزانيات من اللوحة كان يكشف قسمه ثم يستعيد المتصفح
   * تمرير مدخل الحارس (0) عند وصول popstate المؤجل فيُلغى الكشف؛ الآن
   * تستهلك اللوحة الحارس بلا back()، ويُجدولة الكشف إطارًا واحدًا بعد
   * إغلاق اللوحة فيثبت فوق 0 ولا يعود اجتياح تاريخ يلغيه. */
  const openBudgetsSection = () => {
    window.requestAnimationFrame(() => {
      budgetsSectionRef.current?.scrollIntoView({ block: "start" });
    });
  };
  const {
    projectFinance,
    correctionHistory,
    ownerEntitlement,
    g5,
    financialPulse,
    inventory,
    /* FIN-003 (WS-173 — Wave 1): جسر النتيجة المسجلة إلى تغير الكاش المسجل. */
    profitToCashBridge,
    dataVersion,
    notifyDataChanged,
  } = usePrototypeServices();
  const [fromMonth, setFromMonth] = useState(currentMonth);
  const [retryCount, setRetryCount] = useState(0);
  const [toMonth, setToMonth] = useState(currentMonth);
  const [appliedRange, setAppliedRange] = useState({ from: currentMonth(), to: currentMonth() });
  const [rangeInvalid, setRangeInvalid] = useState(false);
  const [state, setState] = useState<FinanceState>({ phase: "loading" });
  /* FIN-003: جسر النتيجة إلى الكاش — قراءة مستقلة فوق نطاق الأشهر نفسه؛
   * فشلها بطاقة كتلة معزولة لا يحجب ملخص الفترة (نمط G-005 نفسه). */
  const [bridgeState, setBridgeState] = useState<BridgeState>({ phase: "loading" });
  /* FIN-002 (WS-174 — Wave 2): الميزانيات الاختيارية — الخدمة تُحمَّل
   * ديناميكيًا عند أول فتح للقسم المطوي فقط (سابقة EXE-014/D-034): الوحدة
   * تُستورد بـimport() لحظتها فلا تدخل كومة الصفحة/الإقلاع، والمخزن من جذر
   * التركيب (الصفحات لا تلمس التخزين مباشرة)؛ الخدمة لا تُسجَّل في السياق. */
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
    /* G-005: المجموعة الأساسية أولًا ثم الكتل المستقلة — التجميع نفسه
     * (نفس القراءات وترتيبها وعزل الفشل) عند صاحبه التطبيقي الآن:
     * readFinanceOverview في application/finance/financeState.ts (R7/P02)؛
     * الصفحة تربط النتيجة بحالتها عند حد الـsetState فقط. */
    readFinanceOverview(
      {
        projectFinance,
        financialPulse,
        g5,
        ownerEntitlement,
        correctionHistory,
        inventory,
      },
      from.from,
      to.to,
    ).then(next => {
      if (!active) return;
      setState(next);
    });
    return () => {
      active = false;
    };
  }, [
    dataVersion,
    retryCount,
    fromMonth,
    toMonth,
    projectFinance,
    g5,
    ownerEntitlement,
    financialPulse,
    correctionHistory,
    inventory,
  ]);
  /* FIN-003 (WS-173 — Wave 1): جسر النتيجة المسجلة إلى تغير الكاش المقيس —
   * يُقرأ فوق نطاق الأشهر المعروض نفسه (لا منتقي ثانٍ)، بلا كتابة إطلاقًا،
   * وكتلة مستقلة: فشلها بطاقة إعادة محاولة والملخص يبقى من مصدره الحي. */
  useEffect(() => {
    let active = true;
    const monthsUsable = validMonth(fromMonth) && validMonth(toMonth) && fromMonth <= toMonth;
    if (!monthsUsable) {
      // نطاق غير صالح خطأ حقل لا خطأ جسر — تبقى آخر قراءة صحيحة كما في الملخص.
      return () => {
        active = false;
      };
    }
    const from = monthBounds(fromMonth);
    const to = monthBounds(toMonth);
    readProfitToCashBridge({ profitToCashBridge }, from.from, to.to).then(next => {
      if (!active) return;
      setBridgeState(next);
    });
    return () => {
      active = false;
    };
  }, [profitToCashBridge, fromMonth, toMonth, dataVersion, retryCount]);
  /* UNIT-021 (تنفيذ S15 بالأمر الموحد §5): قراءة أفق الكاش القصير أزيلت
   * من تحميل المالية الأساسي بقرار تأجيل التوقعات — لا قراءة توقع في
   * إقلاع المالية ولا بياناتها تدخل كومة الصفحة؛ متابعة الحقوق المسجلة
   * الفعلية تبقى في سطحها المخصص (012/018). */
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
        <p role="alert">{state.message}</p>
        <div className="micro-form-actions">
          <Button action="save" onClick={() => setRetryCount(count => count + 1)}>
            إعادة المحاولة
          </Button>
        </div>
        <Button action="secondary" onClick={() => navigate("/")}>
          الرئيسية
        </Button>
      </section>
    );
  const { position, period, insights, decision, declarations, owner, pulse } = state;
  /* G-005: كتلة الأحداث المعطوبة لا تُعرض كقائمة فارغة (فراغ ≠ بيانات) —
   * طبقة السجل تعرض بطاقة الخطأ + إعادة المحاولة بدل الأحداث. */
  const events = state.events ?? [];
  const visibleEventIds = new Set(events.slice(0, 3).map(event => event.id));
  events.slice(0, 3).forEach(event => {
    if (event.correctionType === "reverse" && event.correctionOfEventId)
      visibleEventIds.add(event.correctionOfEventId);
    const reversal = events.find(
      candidate => candidate.correctionType === "reverse" && candidate.correctionOfEventId === event.id,
    );
    if (reversal) visibleEventIds.add(reversal.id);
  });
  const visibleEvents = events.filter(event => visibleEventIds.has(event.id));
  const retryBlocks = () => setRetryCount(count => count + 1);
  return (
    <section className="micro-page micro-finance-page">
      <button className="micro-back-button" type="button" onClick={() => navigate(returnPath)}>
        <ArrowRight aria-hidden="true" /> {returnPath === "/" ? "الرئيسية" : "رجوع"}
      </button>
      <div className="micro-page-heading">
        <span className="micro-overline">الصورة العامة · المبالغ (د.أ)</span>
        <h1>المالية</h1>
      </div>
      <FinanceFunctionsBoard
        open={boardOpen}
        onClose={() => {
          setBoardOpen(false);
          functionsButtonRef.current?.focus();
        }}
        statementHref={`/finance/statement?from=${appliedRange.from.slice(0, 7)}&to=${appliedRange.to.slice(0, 7)}`}
        onOpenBudgets={openBudgetsSection}
      />
      {/* UNIT-013 / AF-B (تنفيذ S15 بالأمر الموحد §5): لا شريط تبويبات داخلي —
       * الصفحة الواحدة تعرض «الآن» ثم «نتيجة الفترة» بوضوح، والوصول الكامل
       * للوظائف عبر لوحة «وظائف المالية» عند الطلب (مغلقة أولًا). */}
      <div className="micro-form-actions" role="group" aria-label="إجراءات المالية">
        <Button action="secondary" ref={functionsButtonRef} onClick={() => setBoardOpen(true)}>
          <LayoutGrid aria-hidden="true" /> وظائف المالية
        </Button>
      </div>
      {/* UNIT-013 / FIN-A2 (ترتيب ٢): ثلاثة أفعال تسجيل متقاربة تفتح أصحابها
       * مباشرة — لا معالج يسأل عن نوع محاسبي ولا كاتب داخل المالية. */}
      <div className="micro-finance-record-actions" role="group" aria-label="تسجيل عملية">
        <Button action="create" onClick={() => navigate(withReturnTo("/direct-sales/new", "/finance"))}>
          <Plus aria-hidden="true" /> تسجيل بيع
        </Button>
        <Button
          action="create"
          onClick={() => navigate(withReturnTo("/finance/new/operating_expense", "/finance"))}
        >
          <Plus aria-hidden="true" /> تسجيل مصروف
        </Button>
        <Button action="create" onClick={() => navigate(withReturnTo("/suppliers/purchase/new", "/finance"))}>
          <Plus aria-hidden="true" /> تسجيل شراء
        </Button>
      </div>
      {/* FIN-A2 (ترتيب ٣): «الآن» — النقد والديون بمصادرها. */}
      <>
        <ReviewPulseSection
          pulse={pulse}
          ordersRecorded={state.ordersRecorded}
          finalOrdersRecorded={state.finalOrdersRecorded}
          excludedOrders={state.excludedOrders}
          onOpenOrder={orderId => navigate(withReturnTo(`/orders/${orderId}`, "/finance"))}
        />
        {/* Wave 4.3 — P-4.3-3: بطاقات المركز المالي القابلة للفتح — كل رقم
              يفتح مصدره (D8)؛ لا بطاقة زينة؛ «عليّ للموردين» انتقل إلى سطح
              «شو عليّ؟» الموحد الأغنى تحتها مباشرة (F09). */}
        <section
          className="micro-finance-position"
          aria-label="تفاصيل الوضع المالي المسجل · المبالغ بالدينار الأردني"
        >
          <PositionCard
            label="الكاش المسجل"
            value={position.recordedCashMinor}
            state={position.evidence.cash}
            helper="محافظ معلنة + كاش غير موزع"
            icon={WalletCards}
            openLabel="افتح محافظ الكاش"
            onOpen={() => navigate(withReturnTo("/cash", "/finance"))}
          />
          <PositionCard
            label="لي عند العملاء"
            value={position.customerReceivablesMinor}
            state={position.evidence.customerReceivables}
            helper="دين مسجل بعد التسليم — افتح العملاء والموردين"
            icon={HandCoins}
            openLabel="افتح العملاء والموردين"
            onOpen={() => navigate(withReturnTo("/parties", "/finance"))}
          />
          {/* NAV-002 (قرار المالك ٢٠٢٦-٠٩-١٦): النتيجة المتاحة في المستوى
                الأول — تقدير موثق لنتيجة الفترة بلا خلط مع الكاش؛ الناقص
                «غير متاح» لا صفرًا، والتفصيل في عرض الفترة. */}
          <button
            type="button"
            className="micro-finance-position-card micro-finance-position-link"
            aria-label="افتح نتيجة الفترة"
            onClick={() => periodSectionRef.current?.scrollIntoView({ block: "start" })}
          >
            <Scale aria-hidden="true" />
            <span>النتيجة المتاحة</span>
            <strong>
              {period === null || period.resultMinor === null ? (
                "غير متاح"
              ) : (
                <MoneyValue minor={period.resultMinor} />
              )}
            </strong>
            <small>
              {period === null
                ? FINANCE_BLOCK_FAILURE_MESSAGES.period.message
                : period.status === "recorded_only"
                  ? "نتيجة الفترة المسجلة — افتح التفصيل"
                  : "مكونات ناقصة تمنع رقمًا نهائيًا صادقًا — افتح التفصيل"}
            </small>
          </button>
          <button
            type="button"
            className="micro-finance-position-card micro-finance-position-link"
            aria-label="افتح مال المالك"
            onClick={() => navigate(withReturnTo("/finance/owner-entitlement", "/finance"))}
          >
            <CircleDollarSign aria-hidden="true" />
            <span>مال المالك</span>
            <strong>
              {evidenceValue(position.evidence.ownerCapital, position.ownerCapitalRecordedMinor)}
            </strong>
            <small>رأس مالك · افتح الدفتر الموحد</small>
          </button>
        </section>
        {/* Wave 4.3 — P-4.3-3 (F09): «شو عليّ؟» — السطح الموحد للالتزامات
              بمصدرَيه ومسارَي تسديدهما بالكاتب الرسمي القائم؛ يلي بطاقات
              المركز مباشرة في ترتيب القراءة المعتمد. */}
        <FinanceObligationsCard position={position} onNavigate={navigate} />
        {/* UNIT-021 (تنفيذ S15 بالأمر الموحد §5): بطاقة قرار الكاش
              التوقعية (القبض/الدفع المتوقع القريب والكاش المتوقع والسحب
              الاستشاري) أزيلت من النطاق الأساسي بقرار التأجيل المعتمد — لا
              بديل توصية ولا إيحاء بوجودها؛ التزام التغطية الحقيقي أدناه من
              البيانات المسجلة نفسها. */}
        {position.unallocatedCashMinor < 0 ? (
          <div className="micro-finance-unallocated-alert" role="status">
            <div>
              <strong>في دفعة تحتاج تغطية</strong>
              <p>
                الكاش غير الموزع الآن <MoneyWithUnit minor={position.unallocatedCashMinor} unit="د.أ" /> —
                سالب لأن دفعًا مسجلًا تجاوز ما دخل غير موزع. مصدر الفرق ظاهر في المصادر المسجلة، وهو ليس
                مصروفًا أو ربحًا جديدًا.
              </p>
            </div>
            <Button
              action="secondary"
              onClick={() =>
                navigate(appendQueryParams("/cash/distribute", { mode: "cover", returnTo: "/finance" }))
              }
            >
              غطِّ الدفعة من محفظة
            </Button>
          </div>
        ) : null}
        {owner === null ? (
          <FinanceBlockFallback block="owner" onRetry={retryBlocks} />
        ) : (
          <OwnerDecisionCard
            overview={owner}
            capitalRecordedMinor={position.ownerCapitalRecordedMinor}
            capitalEvidence={position.evidence.ownerCapital}
            onOpen={() => navigate(withReturnTo("/finance/owner-entitlement", "/finance"))}
          />
        )}
        {state.correctionsAllTime === null ? (
          /* G-005: فشل قراءة سجل التصحيحات كامل التاريخ — بطاقة صادقة لا
           * سكوت (null ≠ لا تصحيحات). */
          <FinanceBlockFallback block="correctionsAllTime" onRetry={retryBlocks} />
        ) : state.correctionsAllTime.count > 0 ? (
          <RestatementNote
            count={state.correctionsAllTime.count}
            netAmountMinor={state.correctionsAllTime.netAmountMinor}
            scopeLabel="هذه الأرصدة"
            onOpen={() => navigate(withReturnTo("/finance/activity", "/finance"))}
          />
        ) : null}
        <section className="micro-finance-truth">
          <ReceiptText aria-hidden="true" />
          <div>
            <h2>ما نعرفه الآن</h2>
            <p>
              كاش المحافظ المعلن (د.أ):{" "}
              {evidenceValue(position.evidence.walletCash, position.walletCashMinor)} · الكاش غير الموزع
              (د.أ): {evidenceValue(position.evidence.unallocatedCash, position.unallocatedCashMinor)} · محافظ
              مسجلة: {position.cashWalletCount}
            </p>
            <p>
              المصاريف التشغيلية المسجلة (د.أ):{" "}
              {evidenceValue(position.evidence.operatingExpenses, position.operatingExpensesRecordedMinor)} ·
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
                    كاش غير موزع:{" "}
                    <MoneyValue minor={position.unallocatedCashMinor} className="micro-inline-number" />
                  </strong>
                  <small>وزّعه على محفظة الآن، أو اتركه حتى تعرف وجهته — لا يُخصص شيء بصمت.</small>
                </div>
                <Button
                  action="secondary"

                  onClick={() => navigate(withReturnTo("/cash/distribute", "/finance"))}
                >
                  وزّع على محفظة
                </Button>
              </div>
            ) : null}
            {/* §2.7 (F-031): الحقيقة غير المسجلة طريق — لا عدد أصفار عاجز. */}
            {position.cashWalletCount === 0 ? (
              <p className="micro-fact-road-line">
                الكاش: لا محفظة معلنة بعد —{" "}
                <button
                  className="micro-text-action"
                  type="button"
                  onClick={() => navigate(withReturnTo("/cash/wallet/new", "/finance"))}
                >
                  سجّل محفظة ورصيد بداية
                </button>
              </p>
            ) : null}
            {/* التدفقات ١٤/٢٠ + D-002: العملاء والموردون وعدّ الصناديق والموردون من مسارات
              مالي الدائمة — نوايا قراءة تجد مكانها الطبيعي هنا بلا مقعد خامس. */}
            {/* المجموعة ٢ (§8.1): روابط الوضع إلى مصادره — دفتر المحفظة والكشف من هنا. */}
            <p className="micro-fact-road-line">
              <button
                className="micro-text-action"
                type="button"
                onClick={() => navigate(withReturnTo("/parties", "/finance"))}
              >
                افتح العملاء والموردين — من تتعامل معه عند الحاجة
              </button>{" "}
              ·{" "}
              <button
                className="micro-text-action"
                type="button"
                onClick={() => navigate(withReturnTo("/suppliers", "/finance"))}
              >
                الموردون والمشتريات — استحقاقاتك ودفعاتك
              </button>{" "}
              ·{" "}
              <button
                className="micro-text-action"
                type="button"
                onClick={() => navigate(withReturnTo("/cash/count", "/finance"))}
              >
                عدّ الصندوق — طابق الدرج مع السجل
              </button>
            </p>
            <p className="micro-fact-road-line">
              <button
                className="micro-text-action"
                type="button"
                onClick={() => navigate(withReturnTo("/finance/statement", "/finance"))}
              >
                كشف الفترة — بسيط ومفصول بالعربية
              </button>{" "}
              ·{" "}
              <button
                className="micro-text-action"
                type="button"
                onClick={() => periodSectionRef.current?.scrollIntoView({ block: "start" })}
              >
                قراءة الفترة الكاملة
              </button>
            </p>
            {/* Wave 4.2 — P-4.2-4 (F01/F05): مدخل «المزيد» — سلامة الحسابات
                  والقراءات العميقة والمالك والسياسات تنظيمها هناك؛ التسجيل
                  لا يدخل ذلك السطح أبدًا. */}
            <p className="micro-fact-road-line">
              <button
                className="micro-text-action"
                type="button"
                onClick={() => {
                  setBoardOpen(true);
                  functionsButtonRef.current?.focus();
                }}
              >
                وظائف المالية — السجلات والقراءات والمنتجات
              </button>
            </p>
          </div>
        </section>
        {/* UNIT-013 / AF-AC01 (تنفيذ S15): طبقة عربونات الطلبات الكاملة غادرت
         * جذر المالية — وصولها من طلباتها وسجل العمليات؛ ملخصها في «شو
         * عليّ؟» أعلاه. */}
        {/* UNIT-013 / AF-AC01 (تنفيذ S15 بالأمر الموحد §5): طبقتا الأصول
         * والقروض الكاملتان غادرتا جذر المالية — المعدات من لوحة الوظائف
         * (عند الحاجة) وسجل القروض من سطحه بمعناه المحفوظ (UNIT-035). */}
      </>
      {/* FIN-A2 (ترتيب ٤): «نتيجة الفترة» — النطاق المطبق ونتيجة واحدة بحالتها
       * ثم كشف الفترة؛ الفترة تؤثر في هذا الجزء فقط ولا تمس أرصدة «الآن». */}
      <section ref={periodSectionRef} aria-label="نتيجة الفترة">
        <>
          {period === null || insights === null ? (
            <FinanceBlockFallback block="period" onRetry={retryBlocks} />
          ) : (
            <FinancePeriodResultSection
              state={state}
              period={period}
              insights={insights}
              appliedRange={appliedRange}
              fromMonth={fromMonth}
              setFromMonth={setFromMonth}
              toMonth={toMonth}
              setToMonth={setToMonth}
              rangeInvalid={rangeInvalid}
              navigate={navigate}
            />
          )}
          {/* FIN-003 (WS-173 — Wave 1): «لماذا يختلف الربح عن الكاش؟» — جسر
              النتيجة المسجلة إلى تغير الكاش المقيس فوق نطاق الأشهر نفسه (لا
              منتقي فترة ثانٍ)؛ جسمه كله داخل التفاصيل المطوية فلا نص سكون
              جديد، وكل رقم من الخدمة — لا معادلة داخل الصفحة. */}
          <details className="micro-finance-layer micro-profit-cash-bridge">
            <summary className="micro-finance-layer-summary">
              <span>
                <b>لماذا يختلف الربح عن الكاش؟</b>
                <small>
                  من {formatMonthLabel(appliedRange.from)} إلى {formatMonthLabel(appliedRange.to)}
                </small>
              </span>
              <strong>
                {bridgeState.phase === "ready" && bridgeState.reading.recordedCashDeltaMinor !== null ? (
                  <MoneyValue
                    minor={bridgeState.reading.recordedCashDeltaMinor}
                    showPlus
                    className="micro-inline-number"
                  />
                ) : (
                  "—"
                )}
              </strong>
            </summary>
            {bridgeState.phase === "loading" ? (
              <p className="micro-period-status" role="status">
                جارٍ قراءة الجسر…
              </p>
            ) : bridgeState.phase === "error" ? (
              <FinanceBlockFallback block="bridge" onRetry={retryBlocks} />
            ) : (
              <section
                className="micro-period-result micro-derived-surface"
                aria-label="جسر النتيجة إلى الكاش"
                data-bridge-status={bridgeState.reading.status}
              >
                <dl>
                  <div>
                    <dt>نتيجة الفترة المسجلة</dt>
                    <dd>
                      {bridgeState.reading.resultMinor === null ? (
                        <span className="micro-unknown-value">غير متاح</span>
                      ) : (
                        <MoneyValue minor={bridgeState.reading.resultMinor} />
                      )}
                    </dd>
                  </div>
                  <div>
                    <dt>تغير الكاش المسجل المقيس</dt>
                    <dd>
                      {bridgeState.reading.recordedCashDeltaMinor === null ? (
                        <span className="micro-unknown-value">غير متاح</span>
                      ) : (
                        <MoneyValue minor={bridgeState.reading.recordedCashDeltaMinor} showPlus />
                      )}
                    </dd>
                  </div>
                  <div>
                    <dt>مجموع بنود الجسر</dt>
                    <dd>
                      {bridgeState.reading.bridgedTotalMinor === null ? (
                        <span className="micro-unknown-value">غير متاح</span>
                      ) : (
                        <MoneyValue minor={bridgeState.reading.bridgedTotalMinor} showPlus />
                      )}
                    </dd>
                  </div>
                </dl>
                <p className="micro-period-status" data-status={bridgeState.reading.status}>
                  {bridgeState.reading.status === "recorded_only"
                    ? "متوازنة من السجلات"
                    : bridgeState.reading.status === "incomplete"
                      ? "ناقصة"
                      : "غير صالحة"}
                </p>
                <ul className="micro-insights-work-list">
                  {bridgeState.reading.lines.map(line => (
                    <li
                      key={line.id}
                      data-line-id={line.id}
                      data-state={line.id === "remainder" ? "unexplained" : "explained"}
                    >
                      <span
                        className={
                          line.id === "remainder" ? "micro-warning-copy" : "micro-insights-work-name"
                        }
                      >
                        {line.label}
                      </span>
                      <small>{line.source}</small>
                      <b>
                        <MoneyValue minor={line.amountMinor} showPlus className="micro-inline-number" />
                      </b>
                    </li>
                  ))}
                </ul>
                {bridgeState.reading.reasons.length > 0 ? (
                  <div className="micro-period-review-note">
                    <strong>أسباب الحالة قبل الاعتماد على الجسر</strong>
                    <ul className="micro-insights-reasons">
                      {bridgeState.reading.reasons.map(reason => (
                        <li key={reason}>{reason}</li>
                      ))}
                    </ul>
                  </div>
                ) : null}
              </section>
            )}
          </details>
          {/* FIN-002 (WS-174 — Wave 2): «ميزانيات اختيارية» — خطة لا حدثًا
              ماليًا (عقد ٤٢). القسم كله (التفاصيل المطوية + التحميل الديناميكي
              EXE-014 + الجسم) داخل مكوّن مستقل واحد فلا سلاسل سكون جديدة هنا. */}
          <section ref={budgetsSectionRef} aria-label="ميزانيات المصروف">
            <FinanceBudgetsSection
              fromMonth={appliedRange.from}
              toMonth={appliedRange.to}
              rangeInvalid={rangeInvalid}
              dataVersion={dataVersion}
            />
          </section>
          <details className="micro-finance-layer">
            <summary className="micro-finance-layer-summary">
              <span>
                <b>التغطية والتعادل</b>
                <small>قراءة الهامش والمتوقعات للفترة</small>
              </span>
              <strong>افتح التفاصيل</strong>
            </summary>
            {/* UNIT-021 (تنفيذ S15): لا مدخل تصريح جديد — إنشاء التوقعات
             * مؤجل بقرار معتمد؛ اللوحة قراءة هامش مسجل وسجل تصريحات
             * قديمة قابل للتصحيح الموثق فقط. */}
            {decision === null ? (
              <FinanceBlockFallback block="g5" onRetry={retryBlocks} />
            ) : (
              <G5DecisionPanel decision={decision} g5={g5} onChanged={notifyDataChanged} />
            )}
            {/* و٧ (F-079): سجل المتوقعات المسجلة كاملًا — حتى المنقوضة — بلا تصحيح من هنا. */}
            <details className="micro-finance-layer micro-declarations-record">
              <summary className="micro-finance-layer-summary">
                <span>
                  <b>سجل المتوقعات المسجلة</b>
                  <small>كل ما سُجل — حتى المتراجع عنه</small>
                </span>
                <strong>
                  {declarations === null ? (
                    "غير متاح"
                  ) : declarations.length > 0 ? (
                    <IntegerValue value={declarations.length} className="micro-inline-number" />
                  ) : (
                    "افتح السجل"
                  )}
                </strong>
              </summary>
              {declarations === null ? (
                <FinanceBlockFallback block="g5" onRetry={retryBlocks} />
              ) : (
                <section
                  className="micro-period-result micro-derived-surface"
                  aria-label="سجل المتوقعات المسجلة"
                >
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
                              {entry.kind === "reversal" ? "تراجع موثق" : "ساري"}
                            </b>
                          </li>
                        ))}
                    </ul>
                  )}
                </section>
              )}
            </details>
          </details>
          {/* F02 (قرار المالك — Wave 4.2): سياسات الربح والتوزيع بجوار «التغطية
              والتعادل» — نقل السطح من الكتالوج؛ الخدمة والكاتب كما هما بعقد 40. */}
          <FinancePoliciesSection />
          {/* المجموعة ٢ (§9.2): من قراءة الفترة إلى الكشف البسيط — الرجوع محفوظ للمصدر. */}
          <section className="micro-decision-card" aria-label="كشف الفترة البسيط">
            <ReceiptText aria-hidden="true" />
            <div>
              <span>قصة الأسبوع ببساطة</span>
              <p>كشف بأسطر عربية مفصولة: كاش، نتيجة، أمانات، ذمم، مال المالك — وكل سطر بمصدره.</p>
            </div>
            <Button
              action="secondary"

              onClick={() => navigate(withReturnTo("/finance/statement", "/finance"))}
            >
              افتح كشف الفترة
            </Button>
          </section>
        </>
      </section>
      {/* المجموعة ٥ (عقد ٣٠): مدخل القارئ الكامل — كل العائلات في مكان واحد؛
          نافذة الرئيس تكفي للنظرة السريعة وهنا الرحلة الكاملة. */}
      <div className="micro-finance-actions">
        <button
          className="micro-text-action"
          type="button"
          onClick={() => navigate(withReturnTo("/finance/activity", "/finance"))}
        >
          آخر ما حدث — القارئ الكامل لكل النشاط
        </button>
      </div>
      {state.events === null ? (
        <FinanceBlockFallback block="events" onRetry={retryBlocks} />
      ) : (
        <EventsLayer
          visibleEvents={visibleEvents}
          events={state.events}
          projectFinance={projectFinance}
          onChanged={notifyDataChanged}
          focusEventId={focusEventId}
          openOnLoad={layerParam === "events"}
        />
      )}
      {/* UNIT-013 / AF-AC01 (تنفيذ S15): طبقة سجل التصحيحات الكاملة غادرت جذر
       * المالية — التصحيحات تُقرأ من سجل العمليات الموحد (017) ومصادرها؛
       * ملخص RestatementNote أعلاه يبقى ظاهرًا بنطاقه الصادق. */}
    </section>
  );
}

function ReviewPulseSection({
  pulse,
  ordersRecorded,
  finalOrdersRecorded,
  excludedOrders,
  onOpenOrder,
}: {
  pulse: LocalFinancialPulse;
  ordersRecorded: boolean;
  finalOrdersRecorded: boolean;
  excludedOrders: readonly StoredCraftOrder[];
  onOpenOrder: (orderId: string) => void;
}) {
  /* FIN-001: نبضة المراجعة تتبع دليل الطلبات — مشروع بلا طلبات لا يعرض
   * أصفارًا مؤكدة بل «غير مسجل»، كما تفعل الرئيسية بالضبط. */
  const pulseValue = (recorded: boolean, minor: number) =>
    recorded ? <MoneyValue minor={minor} /> : unknownValue();
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
          <dd>{pulseValue(ordersRecorded, pulse.registeredCollectionsMinor)}</dd>
          <small>لا يساوي كاش المشروع</small>
        </div>
        <div>
          <dt>دين مسجل بعد التسليم</dt>
          <dd>{pulseValue(ordersRecorded, pulse.registeredDebtMinor)}</dd>
          <small>لا يدخل في القبض</small>
        </div>
        <div>
          <dt>سعر محتسب عند التسليم</dt>
          <dd>{pulseValue(finalOrdersRecorded, pulse.recognizedRevenueFromFinalOrdersMinor)}</dd>
          <small>من نتائج معروفة فقط</small>
        </div>
        <div>
          <dt>تكلفة محتسبة عند التسليم</dt>
          <dd>{pulseValue(finalOrdersRecorded, pulse.recognizedCostFromFinalOrdersMinor)}</dd>
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
  capitalEvidence,
  onOpen,
}: {
  overview: OwnerEntitlementOverview;
  capitalRecordedMinor: number;
  capitalEvidence: FinancialMetricEvidence;
  onOpen: () => void;
}) {
  /* المجموعة ٦ (البند ٢ — S2-07): بطاقة مالك واحدة برقمين مفصولين — رأس المال
   * والحق المسجل المتبقي — ومدخل واحد للدفتر الموحد «مال المالك». */
  /* FIN-001: دليل الحق المتبقي من مصادره الخاصة (استحقاقات/أرصدة افتتاحية/
   * حركات) — دفتر مالك فارغ لا يعرض صفرًا مؤكدًا. */
  const entitlementRecorded =
    overview.entitlements.length > 0 || overview.openingBalances.length > 0 || overview.movements.length > 0;
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
        <Metric
          label="رأس مالك في المشروع"
          value={capitalEvidence === "recorded" ? formatMoneyMinor(capitalRecordedMinor) : NOT_RECORDED_LABEL}
        />
        <Metric
          label="حق مسجل متبقٍ"
          value={
            entitlementRecorded
              ? formatMoneyMinor(overview.remainingEntitlementBalanceMinor)
              : NOT_RECORDED_LABEL
          }
        />
      </div>
      <Button action="secondary" onClick={onOpen}>
        افتح مال المالك
      </Button>
    </section>
  );
}

/* UNIT-021 (تنفيذ S15 بالأمر الموحد §5): مكوّن بطاقة قرار الكاش أزيل مع
 * قراءة الأفق التوقعية والسحب الاستشاري ومدخل التصريح — القدرة مؤجلة
 * بقرار معتمد ولا بديل يوحي بوجودها؛ تنبيه التغطية الحقيقي صار مستقلًا
 * فوق البيانات المسجلة نفسها أعلاه. */
function Metric({ label, value, negative = false }: { label: string; value: string; negative?: boolean }) {
  return (
    <div>
      <span>{label}</span>
      {/* S3-07: الحالة العربية خارج صنف الأرقام — هادئة لا الصوت الأعلى في الخلية. */}
      {value === "غير متاح" || value === NOT_RECORDED_LABEL ? (
        <span className="micro-unknown-value">{value}</span>
      ) : (
        <strong className="micro-number" data-negative={negative}>
          {value}
        </strong>
      )}
    </div>
  );
}
function PositionCard({
  label,
  value,
  state = "recorded",
  helper,
  icon: Icon,
  openLabel,
  onOpen,
}: {
  label: string;
  value: number;
  state?: FinancialMetricEvidence;
  helper: string;
  icon: typeof WalletCards;
  /* Wave 4.3 — P-4.3-3 (D8): البطاقة التي تعرض رقمًا تفتح مصدره — زر كامل
   * لا بطاقة زينة؛ بلا onOpen تبقى قراءة صامتة حيث لا سطح أعمق. */
  openLabel?: string;
  onOpen?: () => void;
}) {
  if (onOpen) {
    return (
      <button
        type="button"
        className="micro-finance-position-card micro-finance-position-link"
        aria-label={openLabel ?? `افتح ${label}`}
        onClick={onOpen}
        data-evidence={state}
      >
        <Icon aria-hidden="true" />
        <span>{label}</span>
        <strong>{evidenceValue(state, value)}</strong>
        <small>{helper}</small>
      </button>
    );
  }
  return (
    <article className="micro-finance-position-card" data-evidence={state}>
      <Icon aria-hidden="true" />
      <span>{label}</span>
      <strong>{evidenceValue(state, value)}</strong>
      <small>{helper}</small>
    </article>
  );
}

/* G-005 (تدقيق الإدارة المالية المتدرجة ٢026-09-19): بطاقة الكتلة المعطوبة —
 * خطأ موجز بلا أرقام كاذبة (المجهول «غير متاح» لا 0.00) وفعل إعادة محاولة
 * واحد بنفس لغة AR-14 القائمة؛ الكتل السليمة تبقى معروضة من مصادرها الحية. */
/* رسائل فشل الكتل — نصوص لحظة تعذّر القراءة بمعيار «message:» نفسه
 * (نصوص حالة لحظية لا نصوص سكون): تُعرض عبر
 * FinanceBlockFallback عند فشل كتلتها وحدها، ولا تظهر أبدًا في السكون. */
const FINANCE_BLOCK_FAILURE_MESSAGES: Record<FinanceBlockId, { message: string }> = {
  owner: {
    message:
      "تعذّرت قراءة مال المالك — لم يتغير أي رصيد؛ باقي الصفحة من مصادرها الحية. أعد المحاولة أو أعد فتح الصفحة.",
  },
  period: {
    message: "تعذّرت قراءة نتيجة الفترة — أعد المحاولة من ملخص الفترة.",
  },
  g5: {
    message:
      "تعذّرت قراءة التغطية والتعادل ومتوقعاتها — لم يتغير أي رصيد؛ باقي الصفحة من مصادرها الحية. أعد المحاولة أو أعد فتح الصفحة.",
  },
  correctionsAllTime: {
    message:
      "تعذّرت قراءة سجل التصحيحات — لم يتغير أي سجل؛ باقي الصفحة من مصادرها الحية. أعد المحاولة أو أعد فتح الصفحة.",
  },
  events: {
    message:
      "تعذّرت قراءة سجل الأحداث المالية — لم يتغير أي حدث؛ باقي الصفحة من مصادرها الحية. أعد المحاولة أو أعد فتح الصفحة.",
  },
  /* FIN-003 (WS-173 — Wave 1): فشل قراءة جسر النتيجة إلى الكاش — كتلة مستقلة. */
  bridge: {
    message:
      "تعذّرت قراءة جسر الربح والكاش — لم يتغير أي رصيد ولا أي سجل؛ باقي الصفحة من مصادرها الحية. أعد المحاولة أو أعد فتح الصفحة.",
  },
};

function FinanceBlockFallback({ block, onRetry }: { block: FinanceBlockId; onRetry: () => void }) {
  return (
    <section className="micro-cancel-panel" role="alert" data-testid="finance-block-error">
      <p className="micro-warning-copy">{FINANCE_BLOCK_FAILURE_MESSAGES[block].message}</p>
      <div className="micro-form-actions micro-contextual-actions">
        <Button action="save" onClick={onRetry}>
          إعادة المحاولة
        </Button>
      </div>
    </section>
  );
}
