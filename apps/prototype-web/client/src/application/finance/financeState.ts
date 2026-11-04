/**
 * R7 / R6-F17-P02 (WS-216 — 2026-10-10): سطح حالة المالية واستعلامها — البيت
 * التطبيقي المالك لنموذج عرض صفحة المالية. كان هذا المنطق داخل pages/Finance.tsx
 * (أنواع FinanceState/FinanceBlockId + قارئ الكتلة الآمن + تجميع قراءات G-005)
 * مما صنع الحافة النوعية الوحيدة مكوّن→صفحة (FinancePeriodResultSection.tsx:12
 * ⇄ Finance.tsx:68 — الدورة القيمية/النوعية المختلطة الوحيدة في الشجرة،
 * R6-SCAN-F-019 / STR-204c). الانتقال هنا يفك الدورة من جذرها: الصفحة والمكوّن
 * كلاهما يستهلك هذا السطح التطبيقي، والاتجاهان قانونيان (UI→application).
 *
 * عقد هذه الوحدة (نموذج عرض/استعلام — لا قاعدة مالية):
 *  - كل رقم يأتي من القارئات الكنسية نفسها بالترتيب نفسه (عقد ٤٠ §8؛ القارئ
 *    الوحيد لنتيجة الفترة المسجلة يبقى readRecordedPeriodResult في
 *    projectFinancialService — يحرسه اختبار التجسس periodResultCanonical).
 *  - لا حساب مالي هنا إطلاقًا: عزل فشل (safeBlock)، تصنيف كتل فاشلة، وتصنيف
 *    حالات الطلبات المسجلة (membership على union المجال) — عرضٌ وقراءة فقط.
 *  - بلا React وبلا تخزين مباشر: الخدمات تُحقن كمعاملات، والفشل جزء من العقد.
 *  - لا تُصدَّر القيم عبر باب application/finance (الباب يستورده جذر التركيب
 *    استاتيكيًا فتدخل كومة الإقلاع) — الأنواع فقط عبر الباب؛ الدوال تُستهلك
 *    من هذه الوحدة مباشرة داخل شظية مسار المالية الكسولة (أساس الاستيراد
 *    العميق الموثق نفس-الـPR).
 */

import type { FinancialEvent } from "@micro-domain/financial-event/index.js";
import type { ShortCashDeclaration } from "@micro-domain/financial-analysis/index.js";
import { localDateMonthEnd } from "@micro-domain/shared/index.js";
import type { StoredCraftOrder } from "@/storage/local/types";
import type {
  FinancialInsights,
  ProjectFinancialPosition,
  ProjectFinancialService,
  RecordedPeriodResult,
} from "./projectFinancialService";
import type { ProfitToCashBridgeReading, ProfitToCashBridgeService } from "./profitToCashBridgeService";
import type { FinancialAnalysisService, G5Decision } from "../financial-analysis/financialAnalysisService";
import type { FinancialPulseService, LocalFinancialPulse } from "../financial-pulse/financialPulseService";
import type {
  CorrectionDigest,
  CorrectionHistoryService,
} from "../financial-records/correctionHistoryService";
import type {
  OwnerEntitlementOverview,
  OwnerEntitlementService,
} from "../owner-money/ownerEntitlementService";
import type { InventoryMaterialService } from "../inventory/inventoryMaterialService";
import type { PeriodWasteReading } from "../inventory/inventoryMaterialModel";

/* G-005 (تدقيق الإدارة المالية المتدرجة 2026-09-19): كتل القراءة المعزولة
 * الفشل — المجموعة الأساسية (المركز + النبضة) وحدها تحجب الصفحة عند فشلها،
 * وكل كتلة متقدمة مستقلة: قيمتها null تعني تعذر قراءتها (لا صفرًا كاذبًا)،
 * وfailedBlocks يحدد المعطوبة لبطاقة خطأ موجزة + إعادة محاولة لكل كتلة،
 * والأسطح السليمة تبقى من مصادرها الحية. */
export type FinanceBlockId = "events" | "period" | "owner" | "g5" | "correctionsAllTime" | "bridge";
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
      /* UNIT-013 (تنفيذ S15 بالأمر الموحد §5): قراءات العربونات والأصول
       * والقروض والعربونات المحتفظة غادرت تحميل المالية الأساسي مع طبقاتها
       * (جرد القارئين — لا قراءة بلا مستهلك)؛ وصولها من أسطحها وسجل
       * العمليات الموحد. */
      /* المجموعة ٦ (البند ٣ — S2-09): خلاصة أثر التصحيحات — كل التاريخ للوضع،
       * وبنطاق الفترة لقراءة الفترة. */
      correctionsAllTime: CorrectionDigest | null;
      correctionsInPeriod: CorrectionDigest | null;
      /* المجموعة ٢ (عقد ٢٨): هدر المخزون داخل الفترة — قراءة مشتقة غير نقدية. */
      periodWaste: PeriodWasteReading | null;
      /* FIN-001: دليل نبضة المراجعة — طلبات مسجلة / نتائج نهائية قائمة. */
      ordersRecorded: boolean;
      finalOrdersRecorded: boolean;
      /* G-005: الكتل التي تعذرت قراءتها — بطاقة خطأ + إعادة محاولة لكل واحدة. */
      failedBlocks: Partial<Record<FinanceBlockId, true>>;
    };
/* FIN-003 (WS-173 — Wave 1): حالة جسر النتيجة إلى الكاش — كتلة قراءة مستقلة
 * مثل إخواتها (فشلها = بطاقة إعادة محاولة لا صفر كاذب)، فوق نطاق الأشهر نفسه. */
export type BridgeState =
  { phase: "loading" } | { phase: "error" } | { phase: "ready"; reading: ProfitToCashBridgeReading };
/* G-005: قارئ كتلة آمن — ok:false والرفض (rejected Promise) كلاهما فشل الكتلة
 * لا فشل الصفحة ولا رفضًا غير معالج؛ المجموعة الأساسية وحدها تحجب الصفحة. */
type BlockRead<T> = { ok: true; value: T } | { ok: false };
export async function safeBlock<T>(
  read: Promise<BlockRead<T>>,
): Promise<{ value: T | null; failed: boolean }> {
  try {
    const result = await read;
    return result.ok ? { value: result.value, failed: false } : { value: null, failed: true };
  } catch {
    return { value: null, failed: true };
  }
}

/* R2 (M-02/X1، 2026-10-08): حدود الشهر من نواة التاريخ الكنسية — كانت
 * Date.UTC رقمية (تعيد السنوات < 0100 إلى 1900+). */
export function monthBounds(month: string) {
  const monthEnd = localDateMonthEnd(month);
  return { from: `${month}-01`, to: monthEnd ?? `${month}-31` };
}

/** الخدمات التي يُجمَّع فوقها نموذج عرض المالية — تُحقن من سياق الخدمات. */
export type FinanceOverviewDeps = {
  projectFinance: ProjectFinancialService;
  financialPulse: FinancialPulseService;
  g5: FinancialAnalysisService;
  ownerEntitlement: OwnerEntitlementService;
  correctionHistory: CorrectionHistoryService;
  inventory: InventoryMaterialService;
};

/**
 * تجميع نموذج عرض المالية (G-005) — المجموعة الأساسية أولًا (المركز + النبضة)
 * وفشلها وحده يُرجع حالة الخطأ الصادقة؛ بقية الكتل تُقرأ كلٌّ على حدة:
 * ok:false أو رفض وعد = فشل تلك الكتلة وحدها، والأسطح السليمة تبقى حية،
 * ولا رفض غير معالج إطلاقًا (كل قراءة داخل safeBlock). نفس مجموعة القراءات
 * وترتيبها الذي كانت الصفحة تنفذه حرفيًا.
 */
export async function readFinanceOverview(
  deps: FinanceOverviewDeps,
  from: string,
  to: string,
): Promise<FinanceState> {
  const { projectFinance, financialPulse, g5, ownerEntitlement, correctionHistory, inventory } = deps;
  const pulseSafe = (async () => {
    try {
      const result = await financialPulse.read();
      return result.ok ? { value: result, failed: false } : { value: null, failed: true };
    } catch {
      return { value: null, failed: true };
    }
  })();
  const [positionRead, pulseRead] = await Promise.all([safeBlock(projectFinance.readPosition()), pulseSafe]);
  if (positionRead.failed || pulseRead.failed || pulseRead.value === null) {
    return { phase: "error", message: "لم يتم تغيير بياناتك. أعد فتح التطبيق للمحاولة." };
  }
  const pulseResult = pulseRead.value;
  const [
    eventsRead,
    resultRead,
    insightsRead,
    decisionRead,
    declarationsRead,
    ownerRead,
    correctionsAll,
    correctionsPeriod,
    periodWaste,
  ] = await Promise.all([
    safeBlock(projectFinance.listEvents()),
    safeBlock(projectFinance.readRecordedPeriodResult(from, to)),
    /* و٧: المؤشرات تُقرأ مع الفترة نفسها — طبقة واحدة داخل القراءة. */
    safeBlock(projectFinance.readFinancialInsights(from, to)),
    safeBlock(g5.readDecision(from, to)),
    safeBlock(g5.listDeclarations()),
    safeBlock(ownerEntitlement.readOverview()),
    safeBlock(correctionHistory.affecting()),
    safeBlock(correctionHistory.affecting(from, to)),
    /* المجموعة ٢ (عقد ٢٨): هدر الفترة — قراءة مشتقة بأساس occurredOn نفسه. */
    safeBlock(inventory.readPeriodWaste(from, to)),
  ]);
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
  return {
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
    /* القيم null تعني تعذر قراءة الكتلة لا صفرًا (عقد FIN-001 نفسه). */
    correctionsAllTime: correctionsAll.value,
    correctionsInPeriod: correctionsPeriod.value,
    periodWaste: periodWaste.value,
    /* FIN-001: دليل نبضة المراجعة — من الطلبات الفعلية لا من مجموع فارغ. */
    ordersRecorded: pulseResult.orders.length > 0,
    finalOrdersRecorded: pulseResult.orders.some(stored =>
      ["delivered", "settled"].includes(stored.order.status),
    ),
    failedBlocks,
  };
}

/** FIN-003: جسر النتيجة إلى الكاش — قراءة مستقلة فوق نطاق الأشهر نفسه؛
 * فشلها بطاقة كتلة معزولة لا يحجب ملخص الفترة (نمط G-005 نفسه). */
export async function readProfitToCashBridge(
  deps: { profitToCashBridge: ProfitToCashBridgeService },
  from: string,
  to: string,
): Promise<BridgeState> {
  const read = await safeBlock(deps.profitToCashBridge.readProfitToCashBridge({ from, to }));
  return read.failed || read.value === null ? { phase: "error" } : { phase: "ready", reading: read.value };
}

/* UNIT-021 (تنفيذ S15 بالأمر الموحد §5): كتلة قراءة أفق الكاش القصير أزيلت
 * مع القدرة المؤجلة — قراءات التوقع خارج تحميل المالية الأساسي بلا بديل
 * يوحي بوجودها. */
