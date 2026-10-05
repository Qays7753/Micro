/* المجموعة ٥ (عقد ٣٥): فحوص الاستمرارية الثلاثة — MIC-14/MIC-15/MIC-16
 * (صحة الكاش غير الموزّع، تفرّد مفاتيح الأحداث، فصل مال المالك). انتقلت
 * حرفيًا من integrityCheckService.ts في Wave F (ADR-013 — تقسيم مسؤولية
 * داخلي)؛ الفحص قراءة فقط عبر السياق المشترك ولا يكتب ولا يصلح أبدًا. */
import type { FinancialEvent } from "@micro-domain/financial-event/index.js";
import { formatMoneyWithUnit } from "@/application/formatting/formatters";
import {
  EVENTS_DEEP_LINK,
  fail,
  INTEGRITY_TITLES,
  unavailable,
  type IntegrityCheckContext,
  type IntegrityCheckResult,
} from "./integrityCheckModel";

/* ─── MIC-14 (المجموعة ٥): صحة الكاش غير الموزّع — الكاش الكلي مسجل
 * المصادر، وما لم يخصص بعد ليس خطأً بل حالة معلنة (عربونات اتفاق، قبض لم
 * يوزّع). السالب وحده تحذير صادق: إنفاق فوق مصادر مسجلة. عربونات الطلبات
 * الملغاة بلا تسوية (needs_review) تدخل المعلق ذاته — قرار معلق لا رقم مختفي. */
export async function checkUnallocatedCashTruth(ctx: IntegrityCheckContext): Promise<IntegrityCheckResult> {
  const [positionResult, ordersResult] = await Promise.all([
    ctx.projectFinance.readPosition(),
    ctx.store.listOrders(),
  ]);
  if (!positionResult.ok || !ordersResult.ok)
    return unavailable("MIC-14", "تعذر قراءة مركز الكاش غير الموزّع — أعد المحاولة.");
  const unallocated = positionResult.value.unallocatedCashMinor;
  const needsReview = ordersResult.value.filter(
    stored => stored.order.status === "cancelled" && stored.order.depositSettlement === "needs_review",
  );
  const needsReviewMinor = needsReview.reduce((sum, stored) => sum + stored.order.depositCollectedMinor, 0);
  if (unallocated < 0) {
    return {
      id: "MIC-14",
      titleAr: INTEGRITY_TITLES["MIC-14"],
      status: "WARN",
      detailAr: `الكاش غير الموزّع سالب (${formatMoneyWithUnit(-unallocated)}) — أنفقت أو خصّصت أكثر من مصادر الكاش المسجلة؛ راجع مصدر الفرق قبل الاعتماد على أي رصيد محفظة.`,
      driftMinor: -unallocated,
      deepLink: "/cash",
    };
  }
  const pendingNote =
    needsReview.length > 0
      ? ` وفيها ${needsReview.length} طلبًا ملغى بعربون بلا تسوية (${formatMoneyWithUnit(needsReviewMinor)}) — قراري الرد/الاحتفاظ بانتظارك من صفحة الطلب.`
      : "";
  return {
    id: "MIC-14",
    titleAr: INTEGRITY_TITLES["MIC-14"],
    status: "PASS",
    detailAr:
      unallocated === 0
        ? "لا كاش غير موزّع — كل ما سُجل مصادرّه وتخصيصاته متسقة."
        : `كاش غير موزّع: ${formatMoneyWithUnit(unallocated)} — حالة معلنة لا خطأً: عربونات اتفاق وقبض لم يوزّع بعد؛ وزّعه للمحافظ حين تجهز.${pendingNote}`,
    driftMinor: unallocated,
    deepLink: "/cash",
  };
}

/* ─── MIC-15 (المجموعة ٥): تفرّد مفاتيح الحتمية — طبقة التحقق نفسها التي
 * يفرضها الاستيراد على الملفات، لكن على المخزن الحيّ: نسخة معدّلة يدويًا
 * بمعرّف جديد ومفتاح مكرر تمرّ من كل الفحوص الأخرى وتُمسك هنا فقط. */
export function checkEventKeyUniqueness(events: readonly FinancialEvent[]): IntegrityCheckResult {
  const seen = new Map<string, number>();
  for (const event of events) seen.set(event.idempotencyKey, (seen.get(event.idempotencyKey) ?? 0) + 1);
  const duplicates = events.filter(event => (seen.get(event.idempotencyKey) ?? 0) > 1);
  if (duplicates.length > 0) {
    return fail(
      "MIC-15",
      `مفاتيح حتمية مكررة في ${duplicates.length} حدثًا — قد يكرّر أثرًا ماليًا؛ راجع السجل والتصحيح الموثق قبل الاعتماد على أي رقم.`,
      duplicates.map(event => event.id),
      null,
      EVENTS_DEEP_LINK,
    );
  }
  return {
    id: "MIC-15",
    titleAr: INTEGRITY_TITLES["MIC-15"],
    status: "PASS",
    detailAr: "كل حدث مفتاحه فريد — لا أثر مالي مكرر في سجلك الحي.",
  };
}

/* ─── MIC-16 (المجموعة ٥): فصل مال المالك — قاعدة جدول الدلتا نفسها:
 * دلتا رأس مال المالك لا تسكن إلا أنواع المالك (استثمار/سحب/عربون-مالك)،
 * وأنواع المالك لا تحمل مصروفًا ولا إيرادًا معلنًا. أي خلط = تسريب مال
 * المالك إلى النتيجة أو العكس — يُعرض لا يُصلح. */
export function checkOwnerMoneySeparation(events: readonly FinancialEvent[]): IntegrityCheckResult {
  const OWNER_TYPES = new Set(["owner_investment_cash", "owner_withdrawal_cash", "deposit_retained_owner"]);
  const offenders: string[] = [];
  for (const event of events) {
    const ownerDelta = event.ownerCapitalDeltaMinor;
    const isOwnerType = OWNER_TYPES.has(event.type);
    if (ownerDelta !== 0 && !isOwnerType) offenders.push(`مال-مالك-في-غير-نوعه:${event.id}`);
    if (isOwnerType && ownerDelta === 0 && event.correctionType !== "reverse")
      offenders.push(`نوع-مالك-بلا-أثر:${event.id}`);
    if (isOwnerType && (event.operatingExpenseDeltaMinor !== 0 || (event.revenueDeltaMinor ?? 0) !== 0))
      offenders.push(`مالك-يخالط-النتيجة:${event.id}`);
  }
  if (offenders.length > 0) {
    return fail(
      "MIC-16",
      `فصل مال المالك مكسور في ${offenders.length} موضعًا — مال المالك أو عربونه اختلط بالمصروف/الإيراد؛ صحّح بالتراجع الموثق من سطحه.`,
      offenders,
      null,
      EVENTS_DEEP_LINK,
    );
  }
  return {
    id: "MIC-16",
    titleAr: INTEGRITY_TITLES["MIC-16"],
    status: "PASS",
    detailAr: "مال المالك مفصول: الاستثمار والسحب والعربون-المالك لا يدخلون نتيجة الفترة ولا مصاريفها أبدًا.",
  };
}
