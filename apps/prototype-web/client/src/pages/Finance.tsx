/* مبدأ Micro: ابدأ بقرار الكاش والفعل الأقرب، وأجّل قراءة الفترة والسجل والأثر الكامل إلى طبقات مستقلة. */
/* §2.2: المراجعة اندمجت نبضةً أعلى هذه الصفحة (F-003) — جلسة قراءة أسبوعية لا تستحق مقعدًا. */
import { assetCountLabel, pendingDepositCountLabel } from "@/presentation/g5Plurals";
import {
  ArrowRight,
  ArrowLeft,
  CircleAlert,
  CircleDollarSign,
  HandCoins,
  Landmark,
  ReceiptText,
  Scale,
  WalletCards,
} from "lucide-react";
import { useEffect, useState } from "react";
import { useLocation, useSearch } from "wouter";
import { useReturnPath } from "@/app/useReturnNavigation";
import { appendQueryParams, withReturnTo } from "@/app/navigationContract";
import { usePrototypeServices, getPrototypeLocalStore } from "@/app/PrototypeServicesContext";
/* FIN-003 (WS-173 — Wave 1): نموذج جسر النتيجة إلى الكاش — من جذر التطبيق
 * (الخدمة نفسها تُوفَّر عبر السياق؛ جسم الجسر كله داخل تفاصيل مطوية). */
import type { ProfitToCashBridgeReading } from "@/app/PrototypeServicesContext";
import type { LocalFinancialPulse } from "@/application/financial-pulse/financialPulseService";
import type { DepositOverview } from "@/application/fulfillment/fulfillmentService";
import type {
  FinancialInsights,
  FinancialMetricEvidence,
  ProjectFinancialPosition,
  ProjectFinancialService,
  RecordedPeriodResult,
} from "@/application/finance/projectFinancialService";
import type { OwnerEntitlementOverview } from "@/application/finance/ownerEntitlementService";
import type { G5Decision, ShortCashHorizonReading } from "@/application/g5/g5Service";
/* FIN-005 (WS-175 — Wave 3): عائلة أفق الكاش القصير — الأنواع والثوابت فقط
 * (النموذج النقي لا يحمّل كومة الصفحة: بلا مخزن ولا React). */
import {
  DEFAULT_SHORT_CASH_HORIZON_DAYS,
  SHORT_CASH_HORIZON_DAYS,
  SHORT_CASH_HORIZON_LABELS_AR,
  type ShortCashHorizonDays,
} from "@/application/finance/shortCashHorizon";
import type { FinancialEvent, FinancialEventType } from "@micro-domain/financial-event/index.js";
import type { ShortCashDeclaration } from "@micro-domain/g5/index.js";
/* FIN-004 (WS-176 — Wave 4): قراءة السحب الآمن الاستشارية — دالة مجال نقية
 * تُركّب فوق نتيجة أفق FIN-005 نفسه؛ الاحتياطي مُدخل جلسة (لا مخزن — ميثاق
 * التفضيلات يحرم المحتوى المالي، والدوام قرار مالك مؤجل بنص الوثيقة). */
import {
  calculateSafeWithdrawal,
  type SafeWithdrawalReserve,
} from "@micro-domain/owner-safe-withdrawal/index.js";
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
import { EnglishNumberInput } from "@/components/forms/EnglishNumberInput";
import { EventsLayer } from "@/components/finance/EventsLayer";
import { CorrectionsLayer } from "@/components/finance/CorrectionsLayer";
import { RestatementNote } from "@/components/finance/RestatementNote";
import { FinancePeriodResultSection } from "@/components/finance/FinancePeriodResultSection";
/* Wave 4.2 — P-4.2-5 (F02/T3): سياسات الربح والتوزيع — السطح المالي بعد نقله
 * من الكتالوج؛ موضعه «ملخص الفترة» بجوار «التغطية والتعادل». */
import { FinancePoliciesSection } from "@/components/finance/FinancePoliciesSection";
/* Wave 4.3 — P-4.3-3 (F09): سطح «شو عليّ؟» الموحد بمصدرَيه ومسارَي تسديدهما. */
import { FinanceObligationsCard } from "@/components/finance/FinanceObligationsCard";
/* FIN-002 (WS-174 — Wave 2): جسم الميزانيات الاختيارية — مكوّن مستقل (كثافة + سابقة RecurringConfirmPanel). */
import { FinanceBudgetsSection } from "@/components/finance/ExpenseBudgetsSectionBody";
import type { CorrectionDigest } from "@/application/finance/correctionHistoryService";
import type { PeriodWasteReading } from "@/application/inventory/inventoryMaterialService";
import { DepositsLayer } from "@/components/finance/DepositsLayer";
/* المجموعة ٤ (عقد ٢٩): قراءات الأصول والقروض والعربون المحتفظ به. */
import type { AssetOverviewRead } from "@/application/assets/assetService";
import type { LoanOverviewRead } from "@/application/loans/loanService";
import type { RetainedDepositRow } from "@/application/finance/retainedDepositService";
import * as G5Display from "@/components/finance/G5DecisionPanel";
import {
  formatBreakEvenDisplay,
  formatLocalDate,
  formatMonthLabel,
  formatMoneyMinor,
  formatQuantityMilli,
  localDateInAmman,
} from "@/presentation/formatters";

import { Button } from "@/components/primitives";
/* G-005 (تدقيق الإدارة المالية المتدرجة 2026-09-19): كتل القراءة المعزولة
 * الفشل — المجموعة الأساسية (المركز + النبضة) وحدها تحجب الصفحة عند فشلها،
 * وكل كتلة متقدمة مستقلة: قيمتها null تعني تعذر قراءتها (لا صفرًا كاذبًا)،
 * وfailedBlocks يحدد المعطوبة لبطاقة خطأ موجزة + إعادة محاولة لكل كتلة،
 * والأسطح السليمة تبقى من مصادرها الحية. */
export type FinanceBlockId =
  "events" | "period" | "owner" | "g5" | "deposits" | "assets" | "loans" | "correctionsAllTime" | "bridge";
export type FinanceState =
  | { phase: "loading" }
  | { phase: "error"; message: string }
  | {
      phase: "ready";
      position: ProjectFinancialPosition;
      events: readonly FinancialEvent[] | null;
      period: RecordedPeriodResult | null;
      /* و٧ (F-077): طبقة المؤشرات داخل قراءة الفترة. */
      insights: FinancialInsights | null;
      decision: G5Decision | null;
      /* و٧ (F-079): سجل المتوقعات المسجلة كاملًا داخل التغطية والتعادل. */
      declarations: readonly ShortCashDeclaration[] | null;
      owner: OwnerEntitlementOverview | null;
      pulse: LocalFinancialPulse;
      excludedOrders: readonly StoredCraftOrder[];
      deposits: DepositOverview | null;
      /* المجموعة ٦ (البند ٣ — S2-09): خلاصة أثر التصحيحات — كل التاريخ للوضع،
       * وبنطاق الفترة لقراءة الفترة. */
      correctionsAllTime: CorrectionDigest | null;
      correctionsInPeriod: CorrectionDigest | null;
      /* المجموعة ٢ (عقد ٢٨): هدر المخزون داخل الفترة — قراءة مشتقة غير نقدية. */
      periodWaste: PeriodWasteReading | null;
      /* المجموعة ٤ (عقد ٢٩): الأصول والقروض والعربونات المحتفظة — طبقات مستقلة.
       * Wave 4.4 — P-4.4-1: التجميع من خدمة القراءة (rows + totals) لا من
       * reduce داخل العرض — مصدر واحد للمعادلة (تماثل D7). */
      assetsOverview: AssetOverviewRead | null;
      loansOverview: LoanOverviewRead | null;
      pendingRetainedDeposits: readonly RetainedDepositRow[] | null;
      /* FIN-001: دليل نبضة المراجعة — طلبات مسجلة / نتائج نهائية قائمة. */
      ordersRecorded: boolean;
      finalOrdersRecorded: boolean;
      /* G-005: الكتل التي تعذرت قراءتها — بطاقة خطأ + إعادة محاولة لكل واحدة. */
      failedBlocks: Partial<Record<FinanceBlockId, true>>;
    };
/* FIN-003 (WS-173 — Wave 1): حالة جسر النتيجة إلى الكاش — كتلة قراءة مستقلة
 * مثل إخواتها (فشلها = بطاقة إعادة محاولة لا صفر كاذب)، فوق نطاق الأشهر نفسه. */
type BridgeState =
  { phase: "loading" } | { phase: "error" } | { phase: "ready"; reading: ProfitToCashBridgeReading };
/* FIN-005 (WS-175 — Wave 3): حالة قراءة أفق الكاش القصير — كتلة مستقلة
 * عن نطاق أشهر الصفحة (الأفق مثبّت على اليوم المحلي للساعة القابلة للحقن)،
 * وإعادة القراءة عند تبديل الأفق أو تغيّر البيانات فقط؛ فشلها بطاقة
 * إعادة محاولة معزولة كإخواتها (نمط G-005). */
type CashHorizonState =
  { phase: "loading" } | { phase: "error" } | { phase: "ready"; reading: ShortCashHorizonReading };
/* FIN-002 (WS-174 — Wave 2): حالة تحميل خدمة الميزانيات — null يعني «جارٍ
 * التجهيز» (نمط transfers/recurringExpenses في جذر التركيب نفسه، لكن هنا
 * محليًا داخل الصفحة: الخدمة لا تُسجّل في السياق أبدًا). */
type BudgetsServiceLoad =
  | { phase: "idle" }
  | { phase: "loading" }
  | { phase: "error" }
  | { phase: "ready"; service: ExpenseBudgetServiceT };
type ExpenseBudgetServiceT = import("@/application/finance/expenseBudgetService").ExpenseBudgetService;
type ExpenseBudgetStatusesReadingT =
  import("@/application/finance/expenseBudgetService").ExpenseBudgetStatusesReading;
type ExpenseBudgetStatusLineT = import("@/application/finance/expenseBudgetService").ExpenseBudgetStatusLine;
type ExpenseBudgetMonthListT = import("@/application/finance/expenseBudgetService").ExpenseBudgetMonthList;
/* تسمية النطاق — مفردات عقد ٤٢ §٤: «مصروف عام» أو «فئة: نص صريح». */
/* مفاتيح الأشهر داخل نطاق معروض صالح — سقف دفاعي لا حلقة بلا نهاية. */
const currentMonth = () => localDateInAmman().slice(0, 7);
/* FIN-001 (قرار المالك ٢٠٢٦-٠٩-١٦): تسمية واحدة لحالة «غير مسجل» في كل مالي —
 * القيمة العددية باقية كما هي، والعرض يتبع حالة الدليل لا العدد. */
const NOT_RECORDED_LABEL = "غير مسجل";
const unknownValue = () => <span className="micro-unknown-value">{NOT_RECORDED_LABEL}</span>;
const evidenceValue = (state: FinancialMetricEvidence, minor: number) =>
  state === "recorded" ? <MoneyValue minor={minor} /> : unknownValue();
const validMonth = (month: string) =>
  /^\d{4}-\d{2}$/.test(month) && Number(month.slice(5)) >= 1 && Number(month.slice(5)) <= 12;
function monthBounds(month: string) {
  const [year, numericMonth] = month.split("-").map(Number);
  const lastDay = new Date(Date.UTC(year!, numericMonth!, 0)).getUTCDate();
  return { from: `${month}-01`, to: `${month}-${String(lastDay).padStart(2, "0")}` };
}
/* §10: مساعدات العرض الخاصة بقراءة G5 انتقلت إلى وحدة الطبقة — الاستيراد بلا نص مكرر. */
const { displayCashAmount, formatted, shortStatusLabel } = G5Display;
const cogsStatusLabel = (status: RecordedPeriodResult["cogsStatus"]) =>
  status === "recorded" ? "من الاستهلاك" : status === "partial" ? "جزئي" : "من نسخة التكلفة";
/* G-005: قارئ كتلة آمن — ok:false والرفض (rejected Promise) كلاهما فشل الكتلة
 * لا فشل الصفحة ولا رفضًا غير معالج؛ المجموعة الأساسية وحدها تحجب الصفحة. */
type BlockRead<T> = { ok: true; value: T } | { ok: false };
async function safeBlock<T>(read: Promise<BlockRead<T>>): Promise<{ value: T | null; failed: boolean }> {
  try {
    const result = await read;
    return result.ok ? { value: result.value, failed: false } : { value: null, failed: true };
  } catch {
    return { value: null, failed: true };
  }
}

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
  const [view, setView] = useState<"position" | "period">(viewParam === "period" ? "period" : "position");
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
    /* المجموعة ٤ (عقد ٢٩): أسطح الأصول والعربون المحتفظ به؛ القروض عبر
     * الخدمة المحمّلة خاملًا (FIN-001 WS-178 — null = جارٍ التجهيز). */
    assets,
    loans,
    retainedDeposits,
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
  /* FIN-005 (WS-175 — Wave 3): أفق الكاش القصير — العائلة المعتمدة ٧/٣٠/٩٠
   * يومًا والافتراضي ٣٠ (قرار المالك §4.4)؛ حالة القراءة كتلة مستقلة فوق
   * الأفق المختار لا فوق أشهر الصفحة (الأفق مثبّت على اليوم المحلي). */
  const [horizonDays, setHorizonDays] = useState<ShortCashHorizonDays>(DEFAULT_SHORT_CASH_HORIZON_DAYS);
  const [cashHorizonState, setCashHorizonState] = useState<CashHorizonState>({ phase: "loading" });
  /* FIN-004 (WS-176 — Wave 4): الاحتياطي الصريح للسحب الآمن — حالة جلسة
   * فقط (لا مخزن ولا تفضيلات: ميثاق التفضيلات يحرم المحتوى المالي): مبلغ
   * موجب بالوحدة الصغرى أو «غير مُدخل»، مع تعطيل صريح بطلب المالك. لا
   * نسبة افتراضية ولا قاعدة أشهر مصاريف؛ والدوام بين الجلسات قرار مالك
   * مؤجل موثق (يتطلب مخزنًا محروسًا 38/30 عند اعتماده). */
  const [reserveAmountMinor, setReserveAmountMinor] = useState<number | null>(null);
  const [reserveDisabled, setReserveDisabled] = useState(false);
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
    /* G-005: المجموعة الأساسية أولًا (المركز + النبضة) — فشلها وحده يوجّه
     * الصفحة كاملة للخطأ الصادق مع إعادة المحاولة كما كان؛ بقية الكتل تُقرأ
     * بعدها كلٌّ على حدة: ok:false أو رفض وعد = فشل تلك الكتلة وحدها، والأسطح
     * السليمة تبقى حية، ولا رفض غير معالج إطلاقًا (كل قراءة داخل safeBlock). */
    const pulseSafe = (async () => {
      try {
        const result = await financialPulse.read();
        return result.ok ? { value: result, failed: false } : { value: null, failed: true };
      } catch {
        return { value: null, failed: true };
      }
    })();
    Promise.all([safeBlock(projectFinance.readPosition()), pulseSafe]).then(([positionRead, pulseRead]) => {
      if (!active) return;
      if (positionRead.failed || pulseRead.failed || pulseRead.value === null) {
        setState({ phase: "error", message: "لم يتم تغيير بياناتك. أعد فتح التطبيق للمحاولة." });
        return;
      }
      const pulseResult = pulseRead.value;
      Promise.all([
        safeBlock(projectFinance.listEvents()),
        safeBlock(projectFinance.readRecordedPeriodResult(from.from, to.to)),
        /* و٧: المؤشرات تُقرأ مع الفترة نفسها — طبقة واحدة داخل القراءة. */
        safeBlock(projectFinance.readFinancialInsights(from.from, to.to)),
        safeBlock(g5.readDecision(from.from, to.to)),
        safeBlock(g5.listDeclarations()),
        safeBlock(ownerEntitlement.readOverview()),
        safeBlock(fulfillment.listDepositOverview()),
        safeBlock(correctionHistory.affecting()),
        safeBlock(correctionHistory.affecting(from.from, to.to)),
        /* المجموعة ٢ (عقد ٢٨): هدر الفترة — قراءة مشتقة بأساس occurredOn نفسه. */
        safeBlock(inventory.readPeriodWaste(from.from, to.to)),
        /* المجموعة ٤ (عقد ٢٩): الأصول والقروض والعربونات المحتفظة — طبقات مستقلة؛
         * القروض عبر الخدمة المحمّلة خاملًا (FIN-001 WS-178) — null لحظة
         * التجهيز = كتلة معطوبة صادقة تُعاد قراءتها فور جاهزيتها (G-005). */
        safeBlock(assets.overview()),
        loans
          ? safeBlock(loans.overview())
          : Promise.resolve({ value: null as LoanOverviewRead | null, failed: true }),
        safeBlock(retainedDeposits.listPending()),
      ]).then(
        ([
          eventsRead,
          resultRead,
          insightsRead,
          decisionRead,
          declarationsRead,
          ownerRead,
          depositsRead,
          correctionsAll,
          correctionsPeriod,
          periodWaste,
          assetsRead,
          loansRead,
          pendingRetainedRead,
        ]) => {
          if (!active) return;
          const completed = pulseResult.orders.filter(stored =>
            ["delivered", "settled"].includes(stored.order.status),
          );
          const failedBlocks: Partial<Record<FinanceBlockId, true>> = {};
          if (eventsRead.failed) failedBlocks.events = true;
          if (resultRead.failed || insightsRead.failed || correctionsPeriod.failed || periodWaste.failed)
            failedBlocks.period = true;
          if (correctionsAll.failed) failedBlocks.correctionsAllTime = true;
          if (ownerRead.failed) failedBlocks.owner = true;
          if (decisionRead.failed || declarationsRead.failed) failedBlocks.g5 = true;
          if (depositsRead.failed) failedBlocks.deposits = true;
          if (assetsRead.failed) failedBlocks.assets = true;
          if (loansRead.failed || pendingRetainedRead.failed) failedBlocks.loans = true;
          setState({
            phase: "ready",
            position: positionRead.value!,
            events: eventsRead.value,
            period: resultRead.value,
            insights: insightsRead.value,
            decision: decisionRead.value,
            declarations: declarationsRead.value,
            owner: ownerRead.value,
            pulse: pulseResult.pulse,
            excludedOrders: completed.filter(stored => stored.order.resultStatus !== "final"),
            deposits: depositsRead.value,
            /* القيم null تعني تعذر قراءة الكتلة لا صفرًا (عقد FIN-001 نفسه). */
            correctionsAllTime: correctionsAll.value,
            correctionsInPeriod: correctionsPeriod.value,
            periodWaste: periodWaste.value,
            assetsOverview: assetsRead.value,
            loansOverview: loansRead.value,
            pendingRetainedDeposits: pendingRetainedRead.value,
            /* FIN-001: دليل نبضة المراجعة — من الطلبات الفعلية لا من مجموع فارغ. */
            ordersRecorded: pulseResult.orders.length > 0,
            finalOrdersRecorded: pulseResult.orders.some(stored =>
              ["delivered", "settled"].includes(stored.order.status),
            ),
            failedBlocks,
          });
        },
      );
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
    fulfillment,
    correctionHistory,
    inventory,
    assets,
    loans,
    retainedDeposits,
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
    safeBlock(profitToCashBridge.readProfitToCashBridge({ from: from.from, to: to.to })).then(read => {
      if (!active) return;
      setBridgeState(
        read.failed || read.value === null ? { phase: "error" } : { phase: "ready", reading: read.value },
      );
    });
    return () => {
      active = false;
    };
  }, [profitToCashBridge, fromMonth, toMonth, dataVersion, retryCount]);
  /* FIN-005 (WS-175 — Wave 3): قراءة أفق الكاش القصير — كتلة مستقلة عن
   * نطاق أشهر الصفحة: الأفق مثبّت على اليوم المحلي من ساعة الخدمة القابلة
   * للحقن، وإعادة القراءة فقط عند تبديل الأفق أو تغيّر البيانات أو إعادة
   * المحاولة. بلا كتابة إطلاقًا (عقد 17 §7): توقع معلن لا قبض ولا دفع
   * ولا تغيير كاش أو دين أو أحداث أو مخزن. */
  useEffect(() => {
    let active = true;
    safeBlock(g5.readShortCashHorizon(horizonDays)).then(read => {
      if (!active) return;
      setCashHorizonState(
        read.failed || read.value === null ? { phase: "error" } : { phase: "ready", reading: read.value },
      );
    });
    return () => {
      active = false;
    };
  }, [g5, horizonDays, dataVersion, retryCount]);
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
        <div className="micro-form-actions">
          <Button action="save" onClick={() => setRetryCount(count => count + 1)}>
            إعادة المحاولة
          </Button>
        </div>
        <Button action="secondary" onClick={() => navigate("/")}>
          مشروعي الآن
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
        <ArrowRight aria-hidden="true" /> {returnPath === "/" ? "مشروعي الآن" : "رجوع"}
      </button>
      <div className="micro-page-heading">
        <span className="micro-overline">الصورة العامة · المبالغ (د.أ)</span>
        <h1>المالية</h1>
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
          {/* F02 (قرار المالك — Wave 4.2): «ملخص الفترة» هو الاسم الرسمي للتبويب؛
              «شو صار خلال الفترة؟» سطر مساعد داخلي فقط لا اسمًا رسميًا. */}
          ملخص الفترة
        </button>
      </div>
      {view === "position" ? (
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
              helper="دين مسجل بعد التسليم — افتح دفتر الناس"
              icon={HandCoins}
              openLabel="افتح دفتر الناس"
              onOpen={() => navigate(withReturnTo("/parties", "/finance"))}
            />
            {/* NAV-002 (قرار المالك ٢٠٢٦-٠٩-١٦): النتيجة المتاحة في المستوى
                الأول — تقدير موثق لنتيجة الفترة بلا خلط مع الكاش؛ الناقص
                «غير متاح» لا صفرًا، والتفصيل في عرض الفترة. */}
            <button
              type="button"
              className="micro-finance-position-card micro-finance-position-link"
              aria-label="افتح نتيجة الفترة"
              onClick={() => switchView("period")}
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
          {/* FIN-005 (WS-175 — Wave 3): قرار الكاش صار فوق أفق معتمد
              ٧/٣٠/٩٠ يومًا مثبّت على اليوم المحلي (الافتراضي ٣٠) — كتلة
              قراءة مستقلة عن نطاق أشهر الصفحة؛ فشلها بطاقة إعادة محاولة
              معزولة (نمط G-005) لا يحجب بطاقات المركز. */}
          {cashHorizonState.phase === "error" ? (
            <FinanceBlockFallback block="g5" onRetry={retryBlocks} />
          ) : cashHorizonState.phase === "ready" ? (
            <CashDecisionSurface
              reading={cashHorizonState.reading}
              horizonDays={horizonDays}
              onHorizonChange={setHorizonDays}
              unallocatedCashMinor={position.unallocatedCashMinor}
              cashRecorded={position.evidence.cash === "recorded"}
              declarationsRecorded={(state.declarations ?? []).some(
                declaration => declaration.kind !== "reversal",
              )}
              /* FIN-004 (WS-176 — Wave 4): مدخلات القراءة الاستشارية للسحب —
               * الاحتياطي حالة جلسة والقروض سياق معلن من كتلة القروض نفسها. */
              reserveAmountMinor={reserveAmountMinor}
              reserveDisabled={reserveDisabled}
              onReserveAmountChange={setReserveAmountMinor}
              onReserveDisabledChange={setReserveDisabled}
              loansOutstandingMinor={state.loansOverview ? state.loansOverview.totals.outstandingMinor : null}
              onDeclare={() => navigate(withReturnTo("/finance/g5/declaration", "/finance"))}
              onCoverPayment={() =>
                navigate(appendQueryParams("/cash/distribute", { mode: "cover", returnTo: "/finance" }))
              }
            />
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
              onOpen={() => navigate(withReturnTo("/finance?layer=corrections", "/finance"))}
            />
          ) : null}
          <section className="micro-finance-truth">
            <ReceiptText aria-hidden="true" />
            <div>
              <h2>ما نعرفه الآن</h2>
              <p>
                كاش المحافظ المعلن (د.أ):{" "}
                {evidenceValue(position.evidence.walletCash, position.walletCashMinor)} · الكاش غير الموزع
                (د.أ): {evidenceValue(position.evidence.unallocatedCash, position.unallocatedCashMinor)} ·
                محافظ مسجلة: {position.cashWalletCount}
              </p>
              <p>
                المصاريف التشغيلية المسجلة (د.أ):{" "}
                {evidenceValue(position.evidence.operatingExpenses, position.operatingExpensesRecordedMinor)}{" "}
                · شراء مواد مسجل: {position.supplierPurchaseCount} · الأحداث العامة:{" "}
                {position.projectEventCount}
              </p>
              {/* المبدأ ١٣: أمانات بحوزتك — كاش في الدرج ليس ملكًا لك ولا إيرادًا. */}
              {position.amanahHeldMinor > 0 ? (
                <p>
                  أمانات بحوزتك (د.أ):{" "}
                  <MoneyValue minor={position.amanahHeldMinor} className="micro-inline-number" /> — كاش حقيقي
                  في الدرج لكنه ليس لك ولا يدخل الربح.
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
              {/* التدفقات ١٤/٢٠ + D-002: دفتر الناس وعدّ الصناديق والموردون من مسارات
              مالي الدائمة — نوايا قراءة تجد مكانها الطبيعي هنا بلا مقعد خامس. */}
              {/* المجموعة ٢ (§8.1): روابط الوضع إلى مصادره — دفتر المحفظة والكشف من هنا. */}
              <p className="micro-fact-road-line">
                <button
                  className="micro-text-action"
                  type="button"
                  onClick={() => navigate(withReturnTo("/parties", "/finance"))}
                >
                  افتح دفتر الناس — مين عليه إلَي وعليّ لمين
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
                <button className="micro-text-action" type="button" onClick={() => switchView("period")}>
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
                  onClick={() => navigate(withReturnTo("/finance/more", "/finance"))}
                >
                  المزيد من المالية — قراءات وتنظيم أعمق
                </button>
              </p>
            </div>
          </section>
          {state.deposits === null ? (
            <FinanceBlockFallback block="deposits" onRetry={retryBlocks} />
          ) : (
            <DepositsLayer
              deposits={state.deposits}
              onOpenOrder={orderId => navigate(withReturnTo(`/orders/${orderId}`, "/finance"))}
            />
          )}
          {/* المجموعة ٤ (عقد ٢٩): الأصول والقروض — طبقتان مستقلتان بمدخلين، بلا مقعد تنقل جديد. */}
          <details className="micro-finance-layer">
            <summary className="micro-finance-layer-summary">
              <span>
                <b>الأصول</b>
                <small>دفتري مشتق من الأحداث — لا مس شراءً للربح</small>
              </span>
              <strong>
                {state.assetsOverview === null
                  ? "غير متاح"
                  : `${assetCountLabel(state.assetsOverview.rows.length)} · ${
                      state.assetsOverview.rows.length > 0
                        ? `${formatMoneyMinor(state.assetsOverview.totals.bookValueMinor)} د.أ`
                        : NOT_RECORDED_LABEL
                    }`}
              </strong>
            </summary>
            {state.assetsOverview === null ? (
              <FinanceBlockFallback block="assets" onRetry={retryBlocks} />
            ) : (
              <p className="micro-period-status">
                {state.assetsOverview.rows.length === 0
                  ? "لا أصول بعد — سجّل أول أصل طويل الاستخدام من «سجّل أصلًا»."
                  : `دفتري كلي ${formatMoneyMinor(state.assetsOverview.totals.bookValueMinor)} د.أ؛ الإهلاك غير نقدي ولا يخصم من الصندوق.`}
              </p>
            )}
            <div className="micro-form-actions">
              <button
                className="micro-text-action"
                type="button"
                onClick={() => navigate(withReturnTo("/assets", "/finance"))}
              >
                افتح سجل الأصول
              </button>
            </div>
          </details>
          <details className="micro-finance-layer">
            <summary className="micro-finance-layer-summary">
              <span>
                <b>القروض</b>
                <small>مالك عند غيرك — ليس مصروفًا ولا ربحًا</small>
              </span>
              <strong>
                {state.loansOverview === null || state.pendingRetainedDeposits === null
                  ? "غير متاح"
                  : `${
                      state.pendingRetainedDeposits.filter(row => row.decision === "pending").length > 0
                        ? `${pendingDepositCountLabel(
                            state.pendingRetainedDeposits.filter(row => row.decision === "pending").length,
                          )} · `
                        : ""
                    }${
                      state.loansOverview.rows.length > 0 || state.pendingRetainedDeposits.length > 0
                        ? `${formatMoneyMinor(state.loansOverview.totals.outstandingMinor)} د.أ قائمًا`
                        : NOT_RECORDED_LABEL
                    }`}
              </strong>
            </summary>
            {state.loansOverview === null || state.pendingRetainedDeposits === null ? (
              <FinanceBlockFallback block="loans" onRetry={retryBlocks} />
            ) : (
              <>
                <p className="micro-period-status">
                  {state.loansOverview.rows.length === 0 && state.pendingRetainedDeposits.length === 0
                    ? "لا قروض ولا عربونات محتفظة — سجّل قرضًا حين تعطي مالًا يُعاد."
                    : "المتبقي مشتق من الدفعات القائمة؛ والعربون المحتفظ بلا قرار يبقى معلقًا ظاهرًا."}
                </p>
                {/* FIN-001 (WS-178 — Wave 6): طبقة التزام الاقتراض المستقلة — من
                    قراءة المركز (مجموع أحداث المجال) لا من كتلة القروض الصادرة،
                    ولا تختلط بذمم «شو عليّ؟» التشغيلية أبدًا؛ تفصيلها خلف
                    «افتح سجل القروض» نفسه أدناه. */}
                {position.evidence.borrowedLoans === "recorded" &&
                position.borrowedLoansOutstandingMinor > 0 ? (
                  <p className="micro-period-status">
                    قروض أخذتها قائمة الآن: {formatMoneyMinor(position.borrowedLoansOutstandingMinor)} د.أ —
                    التزام يُسدّد من الكاش ولا يدخل النتيجة.
                  </p>
                ) : null}
              </>
            )}
            <div className="micro-form-actions micro-contextual-actions">
              <button
                className="micro-text-action"
                type="button"
                onClick={() => navigate(withReturnTo("/loans", "/finance"))}
              >
                افتح سجل القروض
              </button>
            </div>
          </details>
        </>
      ) : (
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
          <FinanceBudgetsSection
            fromMonth={appliedRange.from}
            toMonth={appliedRange.to}
            rangeInvalid={rangeInvalid}
            dataVersion={dataVersion}
          />
          <details className="micro-finance-layer">
            <summary className="micro-finance-layer-summary">
              <span>
                <b>التغطية والتعادل</b>
                <small>قراءة الهامش والمتوقعات للفترة</small>
              </span>
              <strong>افتح التفاصيل</strong>
            </summary>
            {decision === null ? (
              <FinanceBlockFallback block="g5" onRetry={retryBlocks} />
            ) : (
              <G5DecisionPanel
                decision={decision}
                g5={g5}
                onDeclare={() => navigate(withReturnTo("/finance/g5/declaration", "/finance"))}
                onChanged={notifyDataChanged}
              />
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
          <Button
            action="secondary"

            onClick={() => navigate(withReturnTo("/cash", "/finance"))}
          >
            محافظ الكاش
          </Button>
          <Button
            action="secondary"

            onClick={() => navigate(withReturnTo("/suppliers", "/finance"))}
          >
            الموردون والمشتريات
          </Button>
          <Button
            action="secondary"

            onClick={() => navigate(withReturnTo("/inventory", "/finance"))}
          >
            المواد والمخزون
          </Button>
          <Button
            action="secondary"

            onClick={() => navigate(withReturnTo("/finance/new/operating_expense_cash", "/finance"))}
          >
            سجّل مصروفًا مدفوعًا
          </Button>
          <Button
            action="secondary"

            onClick={() => navigate(withReturnTo("/finance/new/operating_expense_payable", "/finance"))}
          >
            سجّل التزامًا لمورد
          </Button>
          <Button
            action="secondary"

            /* المجموعة ٦ (البند ٢ — S2-07): مدخل مالك واحد من «مالي» — الدفتر الموحد
             * يحمل فعل الإدخال والسحب وسياسة الحق (X-05 محفوظ داخل الدفتر). */
            onClick={() => navigate(withReturnTo("/finance/owner-entitlement", "/finance"))}
          >
            مال المالك
          </Button>
          {position.supplierPayablesMinor > 0 ? (
            <Button
              action="secondary"

              onClick={() => navigate(withReturnTo("/finance/new/payable_settlement_cash", "/finance"))}
            >
              سدد التزام مصروف
            </Button>
          ) : null}
          {/* المبدأ ١٣: الأمانات والهالك مسارات صريحة — لا تُسجل إيرادًا ولا مصروفًا عاديًا. */}
          <Button
            action="secondary"

            onClick={() => navigate(withReturnTo("/finance/new/amanah_held_cash", "/finance"))}
          >
            سجّل أمانة قُبضت
          </Button>
          {position.amanahHeldMinor > 0 ? (
            <Button
              action="secondary"

              onClick={() => navigate(withReturnTo("/finance/new/amanah_released_cash", "/finance"))}
            >
              سجّل أمانة سُلّمت
            </Button>
          ) : null}
          <Button
            action="secondary"

            onClick={() => navigate(withReturnTo("/finance/new/loss_non_cash", "/finance"))}
          >
            سجّل هالكًا بلا خروج نقد
          </Button>
        </section>
      </details>
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
      {/* U-001: «السجل» — سطح قراءة واحد لكل تصحيح موثق عبر السجلات المدعومة؛
          لا يضيف حدثًا ولا يعدّل قيمة، ويُحدّث مع كل تغيير بيانات. */}
      <CorrectionsLayer
        correctionHistory={correctionHistory}
        reloadToken={dataVersion}
        initiallyOpen={layerParam === "corrections"}
      />
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

function CashDecisionSurface({
  reading,
  horizonDays,
  onHorizonChange,
  unallocatedCashMinor,
  cashRecorded,
  declarationsRecorded,
  /* FIN-004 (WS-176 — Wave 4): مدخلات القراءة الاستشارية للسحب الآمن. */
  reserveAmountMinor,
  reserveDisabled,
  onReserveAmountChange,
  onReserveDisabledChange,
  loansOutstandingMinor,
  onDeclare,
  onCoverPayment,
}: {
  /* FIN-005 (WS-175 — Wave 3): القراءة فوق أفق معتمد لا نطاق أشهر الصفحة —
   * `ShortCashHorizonReading` يحمل الأفق (من/إلى شاملين بالتاريخ المحلي)
   * ونتيجة المحرك نفسها بلا أي تغيير صيغة. */
  reading: ShortCashHorizonReading;
  horizonDays: ShortCashHorizonDays;
  onHorizonChange: (days: ShortCashHorizonDays) => void;
  unallocatedCashMinor: number;
  cashRecorded: boolean;
  declarationsRecorded: boolean;
  /* FIN-004: الاحتياطي حالة جلسة (number | null) — null يعني غير مُدخل؛
   * التعطيل صريح بطلب المالك؛ القروض سياق معلن فقط (null عند تعذر الكتلة). */
  reserveAmountMinor: number | null;
  reserveDisabled: boolean;
  onReserveAmountChange: (amountMinor: number | null) => void;
  onReserveDisabledChange: (disabled: boolean) => void;
  loansOutstandingMinor: number | null;
  onDeclare: () => void;
  onCoverPayment: () => void;
}) {
  const cash = reading.shortCash;
  /* FIN-001: مقاييس قرار الكاش تتبع دليلها — كاش غير مسجل أو متوقعات غير
   * مسجلة تُعرض «غير مسجل» لا 0.00 مؤكدًا، باتساق مع «الكاش المتوقع». */
  const declaredValue = (minor: number, status: G5Decision["shortCash"]["status"]) =>
    !declarationsRecorded ? NOT_RECORDED_LABEL : displayCashAmount(minor, status);
  /* FIN-004 (WS-176 — Wave 4): قراءة السحب الآمن الاستشارية — تركيب صرف
   * لدالة المجال النقية فوق نتيجة أفق FIN-005 نفسه (لا مسار ثانٍ ولا قراءة
   * إضافية): الاحتياطي مُفعّل فقط حين يكون مبلغًا صحيحًا موجبًا؛ غير ذلك
   * «غير مُدخل» بلا رقم مخترع. التعطيل والتمكين بيد المالك حصرًا. */
  const reserve: SafeWithdrawalReserve = reserveDisabled
    ? { mode: "disabled" }
    : reserveAmountMinor !== null && Number.isInteger(reserveAmountMinor) && reserveAmountMinor > 0
      ? { mode: "enabled", amountMinor: reserveAmountMinor }
      : { mode: "unset" };
  const withdrawal = calculateSafeWithdrawal({
    horizon: reading.horizon,
    shortCash: cash,
    cashRecorded,
    reserve,
    loansOutstandingMinor,
  });
  return (
    <section className="micro-cash-decision" aria-labelledby="cash-decision-title">
      <div className="micro-cash-decision-heading">
        <span className="micro-overline">
          قرار الكاش · <LocalDateValue value={cash.from} /> → <LocalDateValue value={cash.to} />
        </span>
      </div>
      {/* FIN-005 (WS-175 — Wave 3): عائلة الأفق المعتمدة ٧/٣٠/٩٠ (الافتراضي ٣٠)
          — تبديل عرض فقط: يعيد القراءة فوق الأفق الجديد ولا يكتب شيئًا ولا
          يفرض قيمة (نفس مفاتيح تبديل «الوضع الآن/ملخص الفترة» أعلاه). */}
      <div className="micro-form-actions" role="group" aria-label="أفق قراءة الكاش">
        {SHORT_CASH_HORIZON_DAYS.map(days => (
          <button
            key={days}
            className="micro-text-action"
            type="button"
            aria-pressed={horizonDays === days}
            onClick={() => onHorizonChange(days)}
          >
            {SHORT_CASH_HORIZON_LABELS_AR[days]}
          </button>
        ))}
      </div>
      <div className="micro-cash-decision-metrics">
        <Metric
          label="الكاش المسجل الآن"
          value={cashRecorded ? displayCashAmount(cash.recordedCashMinor, cash.status) : NOT_RECORDED_LABEL}
          negative={cashRecorded && cash.status !== "invalid" && cash.recordedCashMinor < 0}
        />
        <Metric label="قبض متوقع قريب" value={declaredValue(cash.declaredCollectionsMinor, cash.status)} />
        <Metric
          label="دفع متوقع قريب"
          value={declaredValue(cash.declaredCommitmentsMinor, cash.status)}
          negative={
            declarationsRecorded &&
            cash.status !== "invalid" &&
            cash.declaredCommitmentsMinor > cash.declaredCollectionsMinor
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
        <Button action="create" onClick={onDeclare}>
          أعلن تحصيلًا أو التزامًا قريبًا
        </Button>
      </div>
      {/* FIN-004 (WS-176 — Wave 4): السحب الآمن — قراءة استشارية فقط فوق الأفق
          نفسه: احتياطي ثابت يُدخله المالك (جلسة) أو تعطيل صريح؛ الفائض =
          التوقع − الاحتياطي بلا قصّ للسالب؛ القروض إفصاح لا حساب؛ لا زر سحب
          ولا حجب ولا ضمان — القرار للمالك. */}
      <div className="micro-cash-decision-footer">
        <div>
          <strong>سحب آمن — قراءة استشارية</strong>
          <p className="micro-local-truth">
            قراءة استشارية فقط: لا تنفّذ سحبًا ولا تضمن سيولة، والربح ليس كاشًا.
          </p>
        </div>
        <div className="micro-form-actions">
          <button
            className="micro-text-action"
            type="button"
            aria-pressed={reserveDisabled}
            onClick={() => onReserveDisabledChange(!reserveDisabled)}
          >
            {reserveDisabled ? "فعّل القراءة" : "عطّل القراءة"}
          </button>
        </div>
        <label className="micro-field">
          <span>
            احتياطي ثابت <small>د.أ · جلسة فقط</small>
          </span>
          <EnglishNumberInput
            value={reserveAmountMinor}
            kind="money"
            onNumericChange={onReserveAmountChange}
            onEmptyChange={() => onReserveAmountChange(null)}
            allowEmpty
          />
        </label>
        <div className="micro-cash-decision-metrics">
          <Metric
            label="الفائض المتوقع فوق الاحتياطي"
            value={
              withdrawal.headroomMinor === null || !cashRecorded
                ? "غير متاح"
                : formatted(withdrawal.headroomMinor)
            }
            negative={withdrawal.headroomMinor !== null && withdrawal.headroomMinor < 0}
          />
          <Metric
            label="قروض صادرة قائمة"
            value={
              loansOutstandingMinor === null
                ? "غير متاح"
                : loansOutstandingMinor === 0
                  ? "—"
                  : formatted(loansOutstandingMinor)
            }
          />
        </div>
        <div>
          {withdrawal.reasons.length > 0 ? (
            <p className="micro-warning-copy" role="status">
              {withdrawal.reasons[0]}
            </p>
          ) : null}
          <p className="micro-decision-next">{withdrawal.nextAction}</p>
        </div>
      </div>
      {unallocatedCashMinor < 0 ? (
        <div className="micro-finance-unallocated-alert" role="status">
          <div>
            <strong>في دفعة تحتاج تغطية</strong>
            <p>
              الكاش غير الموزع الآن <MoneyWithUnit minor={unallocatedCashMinor} unit="د.أ" /> — سالب لأن دفعًا
              مسجلًا تجاوز ما دخل غير موزع. مصدر الفرق ظاهر في المصادر المسجلة، وهو ليس مصروفًا أو ربحًا
              جديدًا.
            </p>
          </div>
          <Button action="secondary" onClick={onCoverPayment}>
            غطِّ الدفعة من محفظة
          </Button>
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
/* رسائل فشل الكتل — نصوص لحظة تعذّر القراءة بمعيار «message:» نفسه في
 * CorrectionsLayer (نصوص حالة لحظية لا نصوص سكون): تُعرض عبر
 * FinanceBlockFallback عند فشل كتلتها وحدها، ولا تظهر أبدًا في السكون. */
const FINANCE_BLOCK_FAILURE_MESSAGES: Record<FinanceBlockId, { message: string }> = {
  owner: {
    message:
      "تعذّرت قراءة مال المالك — لم يتغير أي رصيد؛ باقي الصفحة من مصادرها الحية. أعد المحاولة أو أعد فتح الصفحة.",
  },
  deposits: {
    message:
      "تعذّرت قراءة عربونات الطلبات — لم يتغير أي رصيد؛ باقي الصفحة من مصادرها الحية. أعد المحاولة أو أعد فتح الصفحة.",
  },
  assets: {
    message:
      "تعذّرت قراءة الأصول — لم يتغير أي رصيد ولا أي إهلاك؛ باقي الصفحة من مصادرها الحية. أعد المحاولة أو أعد فتح الصفحة.",
  },
  loans: {
    message:
      "تعذّرت قراءة القروض والعربونات المحتفظة — لم يتغير أي رصيد؛ باقي الصفحة من مصادرها الحية. أعد المحاولة أو أعد فتح الصفحة.",
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
