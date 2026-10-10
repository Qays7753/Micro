/**
 * R7 / R6-F17-P01 (WS-216 — 2026-10-10): سطح استعلام ونموذج عرض تفصيل
 * الطلب — القراءات القسمية (الاتفاق/التسليم/التحصيل/التصحيحات) وقرارات
 * الأقسام النقية خلف سطح تطبيقي مالك في بيت الاتفاقيات (قارئ الطلب).
 * كان هذا المنطق داخل pages/OrderDetail.tsx؛ الصفحة تبقي ربط React ونسخ
 * الواجهة وقنوات الأوامر، والمرايا الحسابية الثلاث عشرة (W5-A/F-049)
 * تبقى في مكانها المجمد داخل الصفحة كما يحرسها moneyLayerGuard.
 *
 * عقد هذه الوحدة:
 *  - قراءات فقط: كل استعلام يمر بخدماته الكنسية (agreements/inventory/
 *    drafts/costEstimates/cashContinuity/partyLedger) ولا يلمس التخزين.
 *  - فصل صادق (R1): فشل القراءة ≠ السجل الغائب — error/not_found منفصلان.
 *  - قرارات نقية بلا نصوص: أكواد/أعلام أقسام؛ النسخ العربية عند الصفحة.
 *  - لا حساب مال إطلاقًا (يثبته moneyLayerGuard عند الصفر).
 */

import type { StoredCraftOrder, CostEstimate } from "@/storage/local/types";
import { hasDeliveredEvent, hasDeliveryReversal } from "@micro-domain/craft-order/index.js";
import type { AgreementService } from "./agreementService";
import type { InventoryMaterialService } from "../inventory/inventoryMaterialService";
import type { OrderActualMaterialComparison } from "../inventory/inventoryMaterialModel";
import type { DraftService } from "../drafts/draftService";
import type { CostEstimateService } from "../estimates/costEstimateService";
import type { CashContinuityService } from "../cash/cashContinuityService";
import type { PartyLedgerService } from "../parties/partyLedgerService";

/** نتيجة قراءة تفصيل الطلب — الفصل الصادق R1: خطأ القراءة ≠ الغياب. */
export type OrderDetailLoad =
  | { phase: "error" }
  | { phase: "not_found" }
  | {
      phase: "ready";
      stored: StoredCraftOrder;
      material: { phase: "ready"; comparison: OrderActualMaterialComparison } | { phase: "error" };
    };

export type OrderDetailQueryDeps = {
  agreements: AgreementService;
  inventory: InventoryMaterialService;
};

/** القراءة الرئيسية: الطلب ومقارنة مادته الفعلية معًا — نفس وعد الصفحة
 *  الأصلي (Promise.all واحد، وفشل المادة لا يفشل الصفحة). */
export async function readOrderDetail(deps: OrderDetailQueryDeps, orderId: string): Promise<OrderDetailLoad> {
  try {
    const [orderResult, materialResult] = await Promise.all([
      deps.agreements.get(orderId),
      deps.inventory.readOrderActualMaterialComparison(orderId),
    ]);
    if (!orderResult.ok) return { phase: "error" };
    if (!orderResult.stored) return { phase: "not_found" };
    return {
      phase: "ready",
      stored: orderResult.stored,
      material: materialResult.ok ? { phase: "ready", comparison: materialResult.value } : { phase: "error" },
    };
  } catch {
    return { phase: "error" };
  }
}

/** «المصدر: تقدير» (المجموعة ٣ §11.3): المسودة المرتبطة تحمل معرّف التقدير —
 *  العرض وصلة قراءة لا تغيّر شيئًا، والتقدير المحذوف يُغيب بصدق لا بخطأ. */
export async function readSourceEstimate(
  deps: { drafts: DraftService; costEstimates: CostEstimateService },
  orderId: string,
): Promise<CostEstimate | null> {
  const draftsResult = await deps.drafts.list();
  if (!draftsResult.ok) return null;
  const draft = draftsResult.value.find(candidate => candidate.linkedOrderId === orderId) ?? null;
  if (!draft?.sourceEstimateId) return null;
  const estimateResult = await deps.costEstimates.get(draft.sourceEstimateId);
  if (!estimateResult.ok || !estimateResult.value) return null;
  return estimateResult.value;
}

/** وجهات العربون الإضافي (WF-01/FC-04): كاش متاح فعلًا — تُقرأ عند فتح اللوحة. */
export async function readAvailableWalletOptions(deps: {
  cashContinuity: CashContinuityService;
}): Promise<readonly { id: string; name: string; kind: string }[] | null> {
  const overview = await deps.cashContinuity.overview();
  return overview.ok ? overview.value.wallets : null;
}

/** مقترحات تسمية الجهة (FIN-002): كل الأسماء المسجلة الأكثر تكرارًا أولًا. */
export async function readPartyNameSuggestions(deps: {
  partyLedger: PartyLedgerService;
}): Promise<readonly string[] | null> {
  const ledger = await deps.partyLedger.read();
  return ledger.ok ? ledger.value.parties.map(party => party.name).slice(0, 12) : null;
}

/** قرارات أقسام الصفحة النقية — الأعلام؛ النصوص العربية عند الصفحة. */
export type OrderSectionDecisions = {
  /* ORD-002: لحظة التسليم الأصلية من حدث التسليم نفسه لا وقت فتح الصفحة. */
  deliveredAtIso: string | null;
  /* Z2.2 (§3.3): التسليم القائم — يُذكر ما دام غير معكوس. */
  standingDeliveryIso: string | null;
  /* التحصين الكامل (D-031): القفل الحقيقي — مسلّم داخل «يحتاج مراجعة» بلا
   * تراجع موثق عن التسليم (STR-008). */
  lockedInDeliveredReview: boolean;
  /* المجموعة ٦ (S3-12): الأفعال المتاحة فعلًا حسب حالة الطلب. */
  canEditPrice: boolean;
  canReverseCollection: boolean;
  canCancel: boolean;
};

const nonEditablePriceStatuses = ["draft", "cancelled", "needs_review"];
/* Conflict F (AV-07): الإلغاء متاح حيث يُتِمّ بأمان — يشمل «يحتاج مراجعة» بعد عكس
 * التسليم (النطاق يسمح والقفل الموثق يحرس المسلّم غير المعكوس برسالة صادقة). */
const cancellableStatuses = [
  "provisional_agreement",
  "confirmed",
  "in_progress",
  "ready",
  "needs_review",
  "postponed",
];

export function deriveOrderSectionDecisions(stored: StoredCraftOrder): OrderSectionDecisions {
  const order = stored.order;
  const deliveredAtIso =
    [...order.events].reverse().find(event => event.toStatus === "delivered")?.createdAt ?? null;
  const hasStandingDelivery = deliveredAtIso !== null && !hasDeliveryReversal(order);
  const lockedInDeliveredReview =
    order.status === "needs_review" && hasDeliveredEvent(order) && !hasDeliveryReversal(order);
  return {
    deliveredAtIso,
    standingDeliveryIso: hasStandingDelivery ? deliveredAtIso : null,
    lockedInDeliveredReview,
    canEditPrice: !nonEditablePriceStatuses.includes(order.status),
    canReverseCollection:
      order.status !== "cancelled" &&
      !lockedInDeliveredReview &&
      order.events.some(event => event.type === "collection_recorded"),
    canCancel: cancellableStatuses.includes(order.status),
  };
}
