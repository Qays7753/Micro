/** Transfer family validators: the per-family shape guards moved verbatim
 * from localTransferService (Group 10, Phase 10-D). Pure unknown->boolean
 * predicates with the same literal contracts - no behavior change.
 */
import { calculateSharedProjectShareMinor } from "@micro-domain/financial-event/index.js";
import type { DirectSale } from "@micro-domain/direct-sale/index.js";
import type { FinancialEvent } from "@micro-domain/financial-event/index.js";
/* المجموعة ٩ (STR-030): محقق سياق الهدر من مالكه الكنسي (صاحب حركة
 * المخزون) — الواردات القديمة تمر كما هي بالسماح الموجود لا بمسار مواز. */
import { isValidWasteContext } from "@micro-domain/inventory-material/index.js";
import { localOwnerProfileId, type OwnerProfile } from "@/storage/local/types";

export const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);
export const isString = (value: unknown): value is string => typeof value === "string";
export const isDate = (value: unknown): value is string =>
  isString(value) && !Number.isNaN(Date.parse(value));
export const isMoney = (value: unknown): value is number =>
  /* عقد الإغلاق العميق (AV-05 — حدود المبالغ): المبلغ المستورد عدد صحيح آمن
   * موجب — قيمة فوق ٢^٥٣−١ تفقد دقتها في الجمع فتُرفض قبل أي معاينة. */
  typeof value === "number" && Number.isSafeInteger(value) && value >= 0;
export const isOptionalMoney = (value: unknown): value is number | null => value === null || isMoney(value);
export const isTimeMinutes = (value: unknown): value is number | null =>
  value === null || (typeof value === "number" && Number.isFinite(value) && value >= 0);
export const isPositiveQuantity = (value: unknown): value is number =>
  typeof value === "number" && Number.isFinite(value) && value > 0;
export const isKnownState = (value: unknown) =>
  value === "known" ||
  value === "estimated" ||
  value === "incomplete" ||
  value === "variable" ||
  value === "stale" ||
  value === "partial";
export const isResultStatus = (value: unknown) =>
  value === "final" || value === "estimated" || value === "incomplete" || value === "review_required";
export const isOrderStatus = (value: unknown) =>
  typeof value === "string" &&
  [
    "draft",
    "provisional_agreement",
    "confirmed",
    "in_progress",
    "ready",
    "delivered",
    "settled",
    "postponed",
    "cancelled",
    "needs_review",
  ].includes(value);
export const isSettlement = (value: unknown) =>
  typeof value === "string" &&
  [
    "unpaid",
    "partially_paid",
    "paid",
    "debt",
    "cancelled",
    "cancelled_pending",
    "cancelled_refunded",
    "cancelled_retained",
  ].includes(value);
export const isScheduleStatus = (value: unknown) =>
  value === "scheduled" || value === "postponed" || value === "completed" || value === "cancelled";
export const isScheduleTime = (value: unknown): value is string =>
  isString(value) && /^([01]\d|2[0-3]):[0-5]\d$/.test(value);
export const isScheduleDuration = (value: unknown): value is number =>
  typeof value === "number" && Number.isInteger(value) && value >= 15 && value <= 720 && value % 15 === 0;
export const isAgreementSource = (value: unknown) =>
  value === null ||
  value === "instagram" ||
  value === "whatsapp" ||
  value === "referral" ||
  value === "walk_in" ||
  value === "other" ||
  value === "conversation" ||
  value === "call" ||
  value === "in_person";
export const isLocalDate = (value: string) =>
  /^\d{4}-\d{2}-\d{2}$/.test(value) &&
  new Date(`${value}T12:00:00.000Z`).toISOString().slice(0, 10) === value;
export const rangesOverlap = (
  leftFrom: string,
  leftTo: string | null,
  rightFrom: string,
  rightTo: string | null,
) => leftFrom <= (rightTo ?? "9999-12-31") && rightFrom <= (leftTo ?? "9999-12-31");
export const isFollowUpDate = (value: unknown) => value === null || (isString(value) && isLocalDate(value));
export const isFollowUpSummary = (value: unknown) =>
  value === null || (isString(value) && value.trim().length >= 2 && value.trim().length <= 240);
export const isRecurrenceFrequency = (value: unknown) => value === "weekly" || value === "monthly";
export const isRecurrenceStatus = (value: unknown) => value === "active" || value === "cancelled";
export const isFollowUpEvent = (value: unknown) =>
  isRecord(value) &&
  isString(value.id) &&
  (value.type === "created" || value.type === "changed") &&
  isString(value.idempotencyKey) &&
  value.idempotencyKey.trim().length > 0 &&
  isDate(value.createdAt) &&
  isFollowUpDate(value.previousDate) &&
  isFollowUpDate(value.followUpDate) &&
  isString(value.reason) &&
  value.reason.trim().length > 0;
export const isRecurrence = (value: unknown) =>
  isRecord(value) &&
  isString(value.id) &&
  isString(value.sourceScheduleId) &&
  isString(value.orderId) &&
  isRecurrenceFrequency(value.frequency) &&
  typeof value.occurrenceCount === "number" &&
  Number.isInteger(value.occurrenceCount) &&
  value.occurrenceCount >= 1 &&
  value.occurrenceCount <= 12 &&
  isRecurrenceStatus(value.status) &&
  isString(value.idempotencyKey) &&
  value.idempotencyKey.trim().length > 0 &&
  (value.cancelledAt === null || isDate(value.cancelledAt)) &&
  (value.cancellationReason === null ||
    (isString(value.cancellationReason) && value.cancellationReason.trim().length > 0)) &&
  isDate(value.createdAt) &&
  isDate(value.updatedAt) &&
  (value.status === "active"
    ? value.cancelledAt === null && value.cancellationReason === null
    : value.cancelledAt !== null && value.cancellationReason !== null);
export const isScheduleEvent = (value: unknown) =>
  isRecord(value) &&
  isString(value.id) &&
  isString(value.idempotencyKey) &&
  isDate(value.createdAt) &&
  (value.type === "created" ||
    value.type === "postponed" ||
    value.type === "timing_changed" ||
    value.type === "completed" ||
    value.type === "cancelled") &&
  (value.previousScheduledFor === null || isString(value.previousScheduledFor)) &&
  isString(value.scheduledFor) &&
  (value.previousScheduledTime === null || isScheduleTime(value.previousScheduledTime)) &&
  (value.scheduledTime === null || isScheduleTime(value.scheduledTime)) &&
  (value.previousDurationMinutes === null || isScheduleDuration(value.previousDurationMinutes)) &&
  (value.durationMinutes === null || isScheduleDuration(value.durationMinutes)) &&
  (value.reason === null || isString(value.reason));
export const isFinancialType = (value: unknown) =>
  value === "owner_investment_cash" ||
  value === "owner_withdrawal_cash" ||
  value === "operating_expense_cash" ||
  value === "operating_expense_payable" ||
  value === "payable_settlement_cash" ||
  value === "amanah_held_cash" ||
  value === "amanah_released_cash" ||
  value === "loss_non_cash" ||
  /* المجموعة ٤ (عقد ٢٩): أنواع الأصول والقروض والعربون المحتفظ به. */
  value === "asset_purchase_cash" ||
  value === "asset_purchase_payable" ||
  value === "asset_depreciation" ||
  value === "asset_disposal_cash" ||
  value === "asset_writeoff" ||
  value === "loan_outgoing_cash" ||
  value === "loan_repayment_cash" ||
  value === "deposit_retained_revenue" ||
  value === "deposit_retained_owner";
export const isAssetEventType = (value: unknown) =>
  value === "asset_purchase_cash" ||
  value === "asset_purchase_payable" ||
  value === "asset_depreciation" ||
  value === "asset_disposal_cash" ||
  value === "asset_writeoff";
export const isLoanEventType = (value: unknown) =>
  value === "loan_outgoing_cash" || value === "loan_repayment_cash";
export const isDepositEventType = (value: unknown) =>
  value === "deposit_retained_revenue" || value === "deposit_retained_owner";
export const isSafeMoney = (value: unknown): value is number =>
  typeof value === "number" && Number.isSafeInteger(value) && value >= 0;
export const isSignedMoney = (value: unknown) => typeof value === "number" && Number.isSafeInteger(value);
/* X-06: مراجعة البيع المباشر قد تكون تعديلًا أو إلغاءً أو تخفيض سعر موثقًا —
 * كلها سلوك نطامي تنتجه الوحدة، فلا يرفض التصدير المُتحقق أياها. */
export const isDirectSaleRevision = (value: unknown): boolean =>
  isRecord(value) &&
  (value.kind === "edit" || value.kind === "cancel" || value.kind === "price_cut") &&
  isString(value.idempotencyKey) &&
  value.idempotencyKey.trim().length > 0 &&
  isDate(value.createdAt) &&
  (value.reason === null ||
    (isString(value.reason) &&
      (value.kind === "edit" || value.kind === "price_cut" || value.reason.trim().length > 0))) &&
  (value.beforeRevenueMinor === undefined ||
    value.beforeRevenueMinor === null ||
    isSafeMoney(value.beforeRevenueMinor));

export function isDirectSale(value: unknown): value is DirectSale {
  if (
    !isRecord(value) ||
    !isString(value.id) ||
    !value.id.trim() ||
    !isString(value.itemName) ||
    !value.itemName.trim() ||
    !isPositiveSafeInteger(value.quantity) ||
    value.currency !== "JOD" ||
    !isSafeMoney(value.revenueMinor) ||
    value.revenueMinor <= 0 ||
    /* X-06: القبض الجزئي (بيع آجل أو تخفيض) سلوك نطامي — المقبوض لا يتجاوز المتفق. */
    !isSafeMoney(value.collectedMinor) ||
    value.collectedMinor > value.revenueMinor ||
    !(
      value.collectionStatus === undefined ||
      value.collectionStatus === "collected_in_full" ||
      value.collectionStatus === "partial_debt" ||
      value.collectionStatus === "partial_needs_review"
    ) ||
    /* D-001: الزبون حقل مستقل اختياري — null أو اسم غير فارغ. */
    !(
      value.customerName === undefined ||
      value.customerName === null ||
      (isString(value.customerName) && value.customerName.trim().length > 0)
    ) ||
    /* P-002 (دورة التدقيق النهائي): مرجع الكتالوج اختياري — null أو معرّف نصي
     * غير فارغ؛ تناظرًا مع تحقق الطلبات والمسودات فلا يُقبل ملف معطوب يضع
     * نوعًا آخر في هذا الحقل. المرجع المعلّق مقبول (حذف المرجع لاحقًا قانوني). */
    !(
      value.catalogItemId === undefined ||
      value.catalogItemId === null ||
      (isString(value.catalogItemId) && value.catalogItemId.trim().length > 0)
    ) ||
    !(value.costMinor === null || isSafeMoney(value.costMinor)) ||
    !(value.profitMinor === null || isSignedMoney(value.profitMinor)) ||
    !isString(value.occurredOn) ||
    !isLocalDate(value.occurredOn) ||
    !isDate(value.recordedAt) ||
    !isString(value.note) ||
    !value.note.trim() ||
    !isString(value.idempotencyKey) ||
    !value.idempotencyKey.trim() ||
    !(value.status === undefined || value.status === "active" || value.status === "cancelled") ||
    !(value.cancelledAt === undefined || value.cancelledAt === null || isDate(value.cancelledAt)) ||
    !(
      value.cancellationReason === undefined ||
      value.cancellationReason === null ||
      (isString(value.cancellationReason) && value.cancellationReason.trim().length > 0)
    ) ||
    !(
      value.revisions === undefined ||
      (Array.isArray(value.revisions) && value.revisions.every(isDirectSaleRevision))
    )
  )
    return false;
  const status = value.status ?? "active";
  if (status === "active" && (value.cancelledAt ?? null) !== null) return false;
  if (status === "active" && (value.cancellationReason ?? null) !== null) return false;
  if (
    status === "cancelled" &&
    (!isDate(value.cancelledAt) ||
      !isString(value.cancellationReason) ||
      !value.cancellationReason.trim() ||
      !(value.revisions ?? []).some(revision => revision.kind === "cancel"))
  )
    return false;
  if (status === "cancelled") {
    const cancellation = [...(value.revisions ?? [])].reverse().find(revision => revision.kind === "cancel");
    if (
      !cancellation ||
      cancellation.createdAt !== value.cancelledAt ||
      cancellation.reason !== value.cancellationReason
    )
      return false;
  }
  const revisionKeys = new Set<string>();
  const revisions = value.revisions ?? [];
  for (const [index, revision] of revisions.entries()) {
    if (
      revisionKeys.has(revision.idempotencyKey) ||
      revision.idempotencyKey === value.idempotencyKey ||
      revision.createdAt < value.recordedAt ||
      (revision.kind === "cancel" && (status !== "cancelled" || index !== revisions.length - 1))
    )
      return false;
    revisionKeys.add(revision.idempotencyKey);
  }
  if (status === "active" && revisions.some(revision => revision.kind === "cancel")) return false;
  return value.profitMinor === (value.costMinor === null ? null : value.revenueMinor - value.costMinor);
}
export const isCorrectionType = (value: unknown) =>
  value === undefined || value === null || value === "reverse";
export const isOptionalString = (value: unknown) => value === undefined || value === null || isString(value);
export const isUnitDimension = (value: unknown) =>
  value === "count" ||
  value === "mass" ||
  value === "volume" ||
  value === "time" ||
  value === "distance" ||
  value === "area";
export const isPositiveSafeInteger = (value: unknown) =>
  typeof value === "number" && Number.isSafeInteger(value) && value > 0;
export const isSafeNonZeroInteger = (value: unknown): value is number =>
  typeof value === "number" && Number.isSafeInteger(value) && value !== 0;
export const isOptionalNote = (value: unknown) => value === null || isString(value);
export type ActualTimeRecordLike = {
  id: string;
  orderId: string;
  minutesDelta: number;
  recordedOn: string;
  createdAt: string;
  note: string | null;
  operationKey: string;
  reversalOfId: string | null;
  reversalReason: string | null;
};
export function validActualTimeRecord(value: unknown, orderIds: Set<string>): value is ActualTimeRecordLike {
  if (
    !isRecord(value) ||
    !isString(value.id) ||
    value.id.trim().length === 0 ||
    !isString(value.orderId) ||
    !orderIds.has(value.orderId) ||
    !isSafeNonZeroInteger(value.minutesDelta) ||
    !isString(value.recordedOn) ||
    !isLocalDate(value.recordedOn) ||
    !isDate(value.createdAt) ||
    !isOptionalNote(value.note) ||
    !isString(value.operationKey) ||
    value.operationKey.trim().length === 0 ||
    !(
      value.reversalOfId === null ||
      (isString(value.reversalOfId) && value.reversalOfId.trim().length > 0)
    ) ||
    !(
      value.reversalReason === null ||
      (isString(value.reversalReason) && value.reversalReason.trim().length > 0)
    )
  )
    return false;
  return value.reversalOfId === null
    ? value.minutesDelta > 0 && value.reversalReason === null
    : value.minutesDelta < 0 && isString(value.reversalReason) && value.reversalReason.trim().length > 0;
}
export const isYieldReadiness = (value: unknown) =>
  value === "not_configured" || value === "ready" || value === "needs_conversion";
export const isOptionalNonNegativeMoney = (value: unknown) =>
  value === undefined || value === null || isMoney(value);
export const isPercentageBps = (value: unknown) =>
  value === undefined ||
  value === null ||
  (typeof value === "number" && Number.isInteger(value) && value >= 1 && value <= 10_000);
export const isSharedProjectShare = (value: unknown, knowledge: unknown) => {
  if (value === undefined || value === null) return true;
  if (
    !isRecord(value) ||
    !(
      value.basis === "agreed_fixed_share" ||
      value.basis === "agreed_percentage" ||
      value.basis === "owner_estimate" ||
      value.basis === "needs_review"
    ) ||
    !(value.note === null || isString(value.note))
  )
    return false;
  const expectedKnowledge =
    value.basis === "agreed_fixed_share" || value.basis === "agreed_percentage"
      ? "known"
      : value.basis === "owner_estimate"
        ? "estimated"
        : "needs_review";
  if (
    knowledge !== expectedKnowledge ||
    !(
      value.allocation === undefined ||
      value.allocation === "allocated" ||
      value.allocation === "unallocated"
    ) ||
    !isOptionalNonNegativeMoney(value.totalAmountMinor) ||
    !isPercentageBps(value.percentageBps) ||
    !isOptionalNonNegativeMoney(value.calculatedShareMinor)
  )
    return false;
  if (value.basis === "agreed_percentage")
    return (
      value.allocation !== "unallocated" &&
      isMoney(value.totalAmountMinor) &&
      value.totalAmountMinor > 0 &&
      typeof value.percentageBps === "number" &&
      typeof value.calculatedShareMinor === "number" &&
      value.calculatedShareMinor ===
        calculateSharedProjectShareMinor(value.totalAmountMinor, value.percentageBps)
    );
  if (value.allocation === "unallocated")
    return (
      value.basis === "needs_review" &&
      isMoney(value.totalAmountMinor) &&
      value.totalAmountMinor > 0 &&
      value.percentageBps === null &&
      value.calculatedShareMinor === null
    );
  return (
    value.basis !== "needs_review" ||
    ((value.totalAmountMinor === undefined || value.totalAmountMinor === null) &&
      value.percentageBps === null &&
      value.calculatedShareMinor === null)
  );
};
/* المجموعة ١ (تصنيفي للمصاريف): وسم التصنيف على سياق المصروف — اختياري (null/undefined)
 * أو نص ≤ ٨٠ حرفًا بعد التطبيع (نفس قاعدة الـDomain). التطبيع الكامل (قص/دمج/فارغ→null)
 * يجري في خريطة الترحيل قبل الفحص؛ هنا يُرفض فقط النوع غير النصي أو الطول الزائد. */
export const categoryLabelMaxLength = 80;
export const isExpenseCategoryLabel = (value: unknown) =>
  value === undefined ||
  value === null ||
  (isString(value) && value.trim().replace(/\s+/gu, " ").length <= categoryLabelMaxLength);
export const normalizeImportedCategoryLabel = (value: unknown): string | null => {
  if (value === undefined || value === null) return null;
  if (!isString(value)) return null;
  return value.trim().replace(/\s+/gu, " ") || null;
};
export const isExpenseContext = (value: unknown) =>
  isRecord(value) &&
  (value.relationship === "project" || value.relationship === "shared") &&
  (value.behavior === "fixed" ||
    value.behavior === "variable" ||
    value.behavior === "mixed" ||
    value.behavior === "unknown") &&
  (value.purpose === "project_general" ||
    value.purpose === "period" ||
    value.purpose === "order" ||
    value.purpose === "product" ||
    value.purpose === "campaign" ||
    value.purpose === "unallocated") &&
  (value.knowledge === "known" || value.knowledge === "estimated" || value.knowledge === "needs_review") &&
  isExpenseCategoryLabel(value.categoryLabel) &&
  (value.relationship === "shared"
    ? isSharedProjectShare(value.sharedProjectShare, value.knowledge)
    : value.sharedProjectShare === undefined || value.sharedProjectShare === null);
export function validFinancialEvent(value: unknown): boolean {
  if (
    !isRecord(value) ||
    !isString(value.id) ||
    !value.id.trim() ||
    !isFinancialType(value.type) ||
    value.currency !== "JOD" ||
    !isMoney(value.amountMinor) ||
    value.amountMinor === 0 ||
    !isString(value.occurredOn) ||
    !isLocalDate(value.occurredOn) ||
    !isDate(value.recordedAt) ||
    !isString(value.idempotencyKey) ||
    !value.idempotencyKey.trim() ||
    !isString(value.note) ||
    !value.note.trim() ||
    !(value.counterparty === null || isString(value.counterparty)) ||
    !(value.relatedEventId === null || isString(value.relatedEventId)) ||
    !isSignedMoney(value.cashDeltaMinor) ||
    !isSignedMoney(value.payableDeltaMinor) ||
    !isSignedMoney(value.ownerCapitalDeltaMinor) ||
    !isSignedMoney(value.operatingExpenseDeltaMinor) ||
    !isCorrectionType(value.correctionType) ||
    !isOptionalString(value.correctionOfEventId) ||
    !isOptionalString(value.correctionReason)
  )
    return false;
  const expenseContext = value.expenseContext;
  const hasExpenseContext = expenseContext !== undefined && expenseContext !== null;
  if (
    hasExpenseContext &&
    (!isExpenseContext(expenseContext) ||
      (value.type !== "operating_expense_cash" && value.type !== "operating_expense_payable"))
  )
    return false;
  const isReversal = value.correctionType === "reverse";
  if (isReversal) {
    if (
      !isString(value.correctionOfEventId) ||
      !value.correctionOfEventId.trim() ||
      !isString(value.correctionReason) ||
      !value.correctionReason.trim()
    )
      return false;
    if (value.relatedEventId !== null && (!isString(value.relatedEventId) || !value.relatedEventId.trim()))
      return false;
    return true;
  }
  if (value.correctionOfEventId !== undefined && value.correctionOfEventId !== null) return false;
  if (value.correctionReason !== undefined && value.correctionReason !== null) return false;
  const amount = value.amountMinor;
  /* المجموعة ٤ (عقد ٢٩): فروع الأنواع الجديدة — سياق إلزامي مطابق للنوع
   * ودلتات الأعمدة الثلاث الجديدة كما تنتجها الوحدة تمامًا. */
  const assetContext = value.assetContext;
  const loanContext = value.loanContext;
  const depositContext = value.depositContext;
  if (isAssetEventType(value.type)) {
    if (
      !isRecord(assetContext) ||
      !isString(assetContext.assetId) ||
      !assetContext.assetId.trim() ||
      !isString(assetContext.name) ||
      !assetContext.name.trim()
    )
      return false;
    if (value.type === "asset_disposal_cash") {
      if (!isSafeMoney(assetContext.bookValueMinor)) return false;
      return (
        value.cashDeltaMinor === amount &&
        value.payableDeltaMinor === 0 &&
        value.ownerCapitalDeltaMinor === 0 &&
        value.operatingExpenseDeltaMinor === 0 &&
        (value.amanahDeltaMinor ?? 0) === 0 &&
        (value.assetDeltaMinor ?? 0) === -assetContext.bookValueMinor &&
        (value.loanDeltaMinor ?? 0) === 0 &&
        (value.revenueDeltaMinor ?? 0) === 0
      );
    }
    const expectedAsset =
      value.type === "asset_depreciation" || value.type === "asset_writeoff" ? -amount : amount;
    const expectedCash = value.type === "asset_purchase_cash" ? -amount : 0;
    const expectedPayable = value.type === "asset_purchase_payable" ? amount : 0;
    return (
      value.cashDeltaMinor === expectedCash &&
      value.payableDeltaMinor === expectedPayable &&
      value.ownerCapitalDeltaMinor === 0 &&
      value.operatingExpenseDeltaMinor === 0 &&
      (value.amanahDeltaMinor ?? 0) === 0 &&
      (value.assetDeltaMinor ?? 0) === expectedAsset &&
      (value.loanDeltaMinor ?? 0) === 0 &&
      (value.revenueDeltaMinor ?? 0) === 0 &&
      assetContext.bookValueMinor === undefined
    );
  }
  if (isLoanEventType(value.type)) {
    if (
      !isRecord(loanContext) ||
      !isString(loanContext.loanId) ||
      !loanContext.loanId.trim() ||
      !isString(loanContext.borrower) ||
      !loanContext.borrower.trim()
    )
      return false;
    return (
      value.cashDeltaMinor === (value.type === "loan_outgoing_cash" ? -amount : amount) &&
      value.payableDeltaMinor === 0 &&
      value.ownerCapitalDeltaMinor === 0 &&
      value.operatingExpenseDeltaMinor === 0 &&
      (value.amanahDeltaMinor ?? 0) === 0 &&
      (value.assetDeltaMinor ?? 0) === 0 &&
      (value.loanDeltaMinor ?? 0) === (value.type === "loan_outgoing_cash" ? amount : -amount) &&
      (value.revenueDeltaMinor ?? 0) === 0
    );
  }
  if (isDepositEventType(value.type)) {
    if (!isRecord(depositContext) || !isString(depositContext.orderId) || !depositContext.orderId.trim())
      return false;
    return (
      value.cashDeltaMinor === 0 &&
      value.payableDeltaMinor === 0 &&
      value.ownerCapitalDeltaMinor === (value.type === "deposit_retained_owner" ? amount : 0) &&
      value.operatingExpenseDeltaMinor === 0 &&
      (value.amanahDeltaMinor ?? 0) === 0 &&
      (value.assetDeltaMinor ?? 0) === 0 &&
      (value.loanDeltaMinor ?? 0) === 0 &&
      (value.revenueDeltaMinor ?? 0) === (value.type === "deposit_retained_revenue" ? amount : 0)
    );
  }
  /* الأنواع القديمة لا تحمل أي سياق من المجموعة ٤. */
  if (assetContext !== undefined && assetContext !== null) return false;
  if (loanContext !== undefined && loanContext !== null) return false;
  if (depositContext !== undefined && depositContext !== null) return false;
  const unallocatedShared =
    isRecord(expenseContext) &&
    isRecord(expenseContext.sharedProjectShare) &&
    expenseContext.sharedProjectShare.allocation === "unallocated";
  const operatingExpense = unallocatedShared ? 0 : amount;
  /* ترتيب الأثر: [كاش، ذمم، رأس مالك، مصروف، أمانات]. */
  const expected =
    value.type === "owner_investment_cash"
      ? [amount, 0, amount, 0, 0]
      : value.type === "owner_withdrawal_cash"
        ? [-amount, 0, -amount, 0, 0]
        : value.type === "operating_expense_cash"
          ? [-amount, 0, 0, operatingExpense, 0]
          : value.type === "operating_expense_payable"
            ? [0, amount, 0, operatingExpense, 0]
            : value.type === "amanah_held_cash"
              ? [amount, 0, 0, 0, amount]
              : value.type === "amanah_released_cash"
                ? [-amount, 0, 0, 0, -amount]
                : value.type === "loss_non_cash"
                  ? [0, 0, 0, amount, 0]
                  : [-amount, -amount, 0, 0, 0];
  return (
    value.cashDeltaMinor === expected[0] &&
    value.payableDeltaMinor === expected[1] &&
    value.ownerCapitalDeltaMinor === expected[2] &&
    value.operatingExpenseDeltaMinor === expected[3] &&
    (value.amanahDeltaMinor ?? 0) === expected[4] &&
    /* المجموعة ٤ (تصحيح مراجعة 4-c): الأنواع القديمة لا تحمل أثر الأعمدة
     * الثلاثة الجديدة — ملف يزعم غير ذلك يُرفض لا يُقبل بتخفٍّ يفسر الأصول
     * والقروض عند الاستيراد بخلاف ما ينتجه المسار الحي. */
    (value.assetDeltaMinor ?? 0) === 0 &&
    (value.loanDeltaMinor ?? 0) === 0 &&
    (value.revenueDeltaMinor ?? 0) === 0 &&
    (value.type === "payable_settlement_cash"
      ? isString(value.relatedEventId) && value.relatedEventId.trim().length > 0
      : value.relatedEventId === null)
  );
}

/* المجموعة ٤ (عقد ٢٩): شكل سجل الأصل — العقد والهوية وحالة الدورة فقط؛
 * الرصيد الدفتري قراءة مشتقة في التطبيق لا حقل مخزن. */
export function validAssetRecord(value: unknown): boolean {
  if (
    !isRecord(value) ||
    !isString(value.id) ||
    !value.id.trim() ||
    !isString(value.name) ||
    !value.name.trim() ||
    value.name.trim().length > 200 ||
    !(value.categoryLabel === null || value.categoryLabel === undefined || isString(value.categoryLabel)) ||
    !isMoney(value.acquisitionAmountMinor) ||
    value.acquisitionAmountMinor === 0 ||
    !(value.acquisitionKind === "cash" || value.acquisitionKind === "payable") ||
    !isString(value.purchaseDate) ||
    !isLocalDate(value.purchaseDate) ||
    !(
      value.lifeMonths === null ||
      value.lifeMonths === undefined ||
      (typeof value.lifeMonths === "number" &&
        Number.isInteger(value.lifeMonths) &&
        (value.lifeMonths as number) >= 1 &&
        (value.lifeMonths as number) <= 600)
    ) ||
    !(
      value.depreciationStartOn === null ||
      value.depreciationStartOn === undefined ||
      (isString(value.depreciationStartOn) && isLocalDate(value.depreciationStartOn as string))
    ) ||
    !(value.status === "active" || value.status === "disposed" || value.status === "written_off") ||
    !isString(value.acquisitionEventId) ||
    value.acquisitionEventId.trim().length === 0 ||
    !Array.isArray(value.contractRevisions) ||
    !isString(value.operationKey) ||
    !value.operationKey.trim() ||
    !isDate(value.createdAt) ||
    !isDate(value.updatedAt)
  )
    return false;
  if (value.status === "active" && (value.disposal !== null || value.writeOff !== null)) return false;
  if (value.status === "disposed" && !isRecord(value.disposal)) return false;
  if (value.status === "written_off" && !isRecord(value.writeOff)) return false;
  if (value.disposal !== null && value.disposal !== undefined) {
    const disposal = value.disposal;
    if (
      !isRecord(disposal) ||
      !isString(disposal.on) ||
      !isLocalDate(disposal.on) ||
      !isMoney(disposal.proceedsMinor) ||
      disposal.proceedsMinor === 0 ||
      !isMoney(disposal.bookValueMinor) ||
      !isString(disposal.eventId) ||
      !disposal.eventId.trim() ||
      !isString(disposal.reason) ||
      !disposal.reason.trim()
    )
      return false;
  }
  if (value.writeOff !== null && value.writeOff !== undefined) {
    const writeOff = value.writeOff;
    if (
      !isRecord(writeOff) ||
      !isString(writeOff.on) ||
      !isLocalDate(writeOff.on) ||
      !isMoney(writeOff.bookValueMinor) ||
      !isString(writeOff.eventId) ||
      !writeOff.eventId.trim() ||
      !isString(writeOff.reason) ||
      !writeOff.reason.trim()
    )
      return false;
  }
  return value.contractRevisions.every(
    (revision: unknown) =>
      isRecord(revision) &&
      typeof revision.revision === "number" &&
      Number.isSafeInteger(revision.revision) &&
      (revision.revision as number) >= 1 &&
      (revision.lifeMonths === null ||
        (typeof revision.lifeMonths === "number" &&
          Number.isInteger(revision.lifeMonths) &&
          (revision.lifeMonths as number) >= 1)) &&
      (revision.depreciationStartOn === null ||
        (isString(revision.depreciationStartOn) && isLocalDate(revision.depreciationStartOn as string))) &&
      isString(revision.reason) &&
      (revision.reason as string).trim().length > 0 &&
      isDate(revision.changedAt),
  );
}
/* المجموعة ٤ (عقد ٢٩): شكل سجل القرض — العقد والدفعات وتراجعها الموثق. */
export function validLoanRecord(value: unknown): boolean {
  if (
    !isRecord(value) ||
    !isString(value.id) ||
    !value.id.trim() ||
    !isString(value.borrowerName) ||
    !value.borrowerName.trim() ||
    value.borrowerName.trim().length > 200 ||
    !isMoney(value.principalMinor) ||
    value.principalMinor === 0 ||
    !isString(value.loanDate) ||
    !isLocalDate(value.loanDate) ||
    !(value.purposeNote === null || value.purposeNote === undefined || isString(value.purposeNote)) ||
    !(
      value.sourceWalletId === null ||
      value.sourceWalletId === undefined ||
      isString(value.sourceWalletId)
    ) ||
    !isString(value.principalEventId) ||
    value.principalEventId.trim().length === 0 ||
    !Array.isArray(value.repayments) ||
    !Array.isArray(value.corrections) ||
    !isString(value.operationKey) ||
    !value.operationKey.trim() ||
    !isDate(value.createdAt) ||
    !isDate(value.updatedAt)
  )
    return false;
  const repaymentIds = new Set<string>();
  if (
    !value.repayments.every((repayment: unknown) => {
      const valid =
        isRecord(repayment) &&
        isString(repayment.id) &&
        repayment.id.trim().length > 0 &&
        !repaymentIds.has(repayment.id) &&
        isMoney(repayment.amountMinor) &&
        repayment.amountMinor !== 0 &&
        isString(repayment.date) &&
        isLocalDate(repayment.date as string) &&
        (repayment.note === null || repayment.note === undefined || isString(repayment.note)) &&
        isString(repayment.eventId) &&
        repayment.eventId.trim().length > 0;
      if (valid && isRecord(repayment) && isString(repayment.id)) repaymentIds.add(repayment.id);
      return valid;
    })
  )
    return false;
  return (
    value.repayments.every(
      (repayment: Record<string, unknown>) =>
        repayment.reversal === null ||
        repayment.reversal === undefined ||
        (isRecord(repayment.reversal) &&
          isString(repayment.reversal.reason) &&
          repayment.reversal.reason.trim().length > 0 &&
          isDate(repayment.reversal.at) &&
          isString(repayment.reversal.reversalEventId) &&
          repayment.reversal.reversalEventId.trim().length > 0),
    ) &&
    value.corrections.every(
      (correction: unknown) =>
        isRecord(correction) &&
        isString(correction.reason) &&
        correction.reason.trim().length > 0 &&
        isDate(correction.at),
    )
  );
}
export function validSupplierPurchase(value: unknown): boolean {
  if (
    !isRecord(value) ||
    !isString(value.id) ||
    !isString(value.supplierName) ||
    !value.supplierName.trim() ||
    !isString(value.note) ||
    !value.note.trim() ||
    !isString(value.purchasedOn) ||
    !isDate(`${value.purchasedOn}T12:00:00.000Z`) ||
    !(value.dueOn === null || isString(value.dueOn)) ||
    (isString(value.dueOn) && !isDate(`${value.dueOn}T12:00:00.000Z`)) ||
    !isMoney(value.totalMinor) ||
    value.totalMinor === 0 ||
    !isMoney(value.paidMinor) ||
    !isMoney(value.payableMinor) ||
    !isString(value.idempotencyKey) ||
    !isDate(value.createdAt) ||
    !isDate(value.updatedAt) ||
    !Array.isArray(value.payments) ||
    /* المجموعة ٢ (عقد ٢٨): ربط المادة والكمية المتوقعة اختياري — الشكل فقط. */
    !(
      value.materialId === undefined ||
      value.materialId === null ||
      (isString(value.materialId) && value.materialId.trim().length > 0)
    ) ||
    !(
      value.expectedQuantityMilli === undefined ||
      value.expectedQuantityMilli === null ||
      (isMoney(value.expectedQuantityMilli) && value.expectedQuantityMilli > 0)
    )
  )
    return false;
  const paymentKeys = new Set<string>();
  const paymentIds = new Set<string>();
  const totalPaid = value.payments.reduce<number>((sum, payment) => {
    if (
      !isRecord(payment) ||
      !isString(payment.id) ||
      !isMoney(payment.amountMinor) ||
      payment.amountMinor === 0 ||
      !isString(payment.occurredOn) ||
      !isDate(`${payment.occurredOn}T12:00:00.000Z`) ||
      !isDate(payment.recordedAt) ||
      !isString(payment.idempotencyKey) ||
      !isString(payment.note) ||
      !payment.note.trim() ||
      paymentKeys.has(payment.idempotencyKey) ||
      paymentIds.has(payment.id)
    )
      return Number.NaN;
    /* المجموعة ٢ (التحصين الكامل — LOW-002): الطرح كان يضيف هوية الدفعة في
     * مجموعة المفاتيح فتفلت الدفعات ذات المفتاح المكرر داخل الشراء الواحد —
     * مسار الكتابة يمنعها أصلًا فلا ملف صادق يحملها؛ الآن المفتاح والهوية
     * كلٌّ منهما في مجموعته. */
    paymentKeys.add(payment.idempotencyKey);
    paymentIds.add(payment.id);
    return sum + payment.amountMinor;
  }, 0);
  /* S2-03: التراجعات الموثقة عن الدفعات جزء من الحالة الشرعية — المدفوع الفعلي =
   * الدفعات − التراجعات، وإلا رُفضت نسخة احتياطية صادقة بعد تراجع موثق. */
  const paymentsList = value.payments as readonly unknown[];
  const reversals = Array.isArray(value.paymentReversals)
    ? (value.paymentReversals as readonly unknown[])
    : [];
  const reversalKeys = new Set<string>();
  const reversedPaymentIds = new Set<string>();
  const totalReversed = reversals.reduce<number>((sum, reversal) => {
    if (
      !isRecord(reversal) ||
      !isString(reversal.id) ||
      !isString(reversal.paymentId) ||
      !isMoney(reversal.amountMinor) ||
      reversal.amountMinor === 0 ||
      !isString(reversal.reason) ||
      !reversal.reason.trim() ||
      !isString(reversal.occurredOn) ||
      !isDate(`${reversal.occurredOn}T12:00:00.000Z`) ||
      !isDate(reversal.recordedAt) ||
      !isString(reversal.idempotencyKey) ||
      reversalKeys.has(reversal.idempotencyKey) ||
      reversedPaymentIds.has(reversal.paymentId)
    )
      return Number.NaN;
    const payment = paymentsList.find(
      candidate => isRecord(candidate) && isString(candidate.id) && candidate.id === reversal.paymentId,
    );
    /* التراجع يماثل دفعته: نفس المبلغ، ومرة واحدة لكل دفعة (عقد المجموعة ٢). */
    if (!isRecord(payment) || payment.amountMinor !== reversal.amountMinor) return Number.NaN;
    reversalKeys.add(reversal.idempotencyKey);
    reversedPaymentIds.add(reversal.paymentId);
    return sum + reversal.amountMinor;
  }, 0);
  const effectivePaid = totalPaid - totalReversed;
  const status =
    effectivePaid === 0 ? "unpaid" : effectivePaid === value.totalMinor ? "paid" : "partially_paid";
  return (
    Number.isInteger(totalPaid) &&
    Number.isInteger(totalReversed) &&
    effectivePaid >= 0 &&
    effectivePaid <= value.totalMinor &&
    value.paidMinor === effectivePaid &&
    value.payableMinor === value.totalMinor - effectivePaid &&
    value.status === status
  );
}
export const isCashWalletKind = (value: unknown) =>
  value === "cash_drawer" || value === "bank_account" || value === "digital_wallet" || value === "other";
export const isCashEntryType = (value: unknown) =>
  value === "opening_balance" ||
  value === "cash_adjustment" ||
  value === "transfer_out" ||
  value === "transfer_in" ||
  value === "reversal" ||
  value === "allocation";
export function validCashWallet(value: unknown): boolean {
  return (
    isRecord(value) &&
    isString(value.id) &&
    isString(value.name) &&
    value.name.trim().length > 0 &&
    isCashWalletKind(value.kind) &&
    isDate(value.createdAt) &&
    isString(value.createdOperationKey) &&
    value.createdOperationKey.trim().length > 0 &&
    (value.openingStatus === undefined ||
      value.openingStatus === null ||
      value.openingStatus === "known" ||
      value.openingStatus === "unknown")
  );
}
export function validCashEntry(value: unknown): boolean {
  if (
    !isRecord(value) ||
    !isString(value.id) ||
    !isString(value.walletId) ||
    !isCashEntryType(value.type) ||
    !isString(value.occurredOn) ||
    !isDate(`${value.occurredOn}T12:00:00.000Z`) ||
    !isDate(value.recordedAt) ||
    !isSignedMoney(value.cashDeltaMinor) ||
    value.cashDeltaMinor === 0 ||
    !isString(value.note) ||
    !value.note.trim() ||
    !(value.reason === null || isString(value.reason)) ||
    !isString(value.operationKey) ||
    !value.operationKey.trim() ||
    !(value.transferId === null || isString(value.transferId)) ||
    !(value.reversesEntryId === null || isString(value.reversesEntryId))
  )
    return false;
  const delta = value.cashDeltaMinor as number;
  if (value.type === "opening_balance" && delta < 0) return false;
  if (value.type === "cash_adjustment" && (!isString(value.reason) || !value.reason.trim())) return false;
  if (
    (value.type === "transfer_out" || value.type === "transfer_in") &&
    (!isString(value.transferId) || value.reason !== null)
  )
    return false;
  return value.type === "reversal"
    ? isString(value.reason) && value.reason.trim().length > 0 && isString(value.reversesEntryId)
    : value.reversesEntryId === null;
}
export const isMaterialUnit = (value: unknown) =>
  value === "piece" || value === "meter" || value === "kilogram" || value === "liter" || value === "other";
export const isInventoryMovementType = (value: unknown) =>
  value === "opening" ||
  value === "purchase_receipt" ||
  value === "consumption" ||
  value === "waste" ||
  value === "adjustment" ||
  value === "reversal";
export function validMaterial(value: unknown): boolean {
  return (
    isRecord(value) &&
    isString(value.id) &&
    isString(value.name) &&
    value.name.trim().length > 0 &&
    isMaterialUnit(value.unit) &&
    isDate(value.createdAt) &&
    isString(value.createdOperationKey) &&
    value.createdOperationKey.trim().length > 0 &&
    /* المجموعة ٢ (عقد ٢٨): قرار المتابعة ومعرفة البداية اختيارية — الشكل فقط يُفحص. */
    (value.tracking === undefined ||
      value.tracking === null ||
      (isRecord(value.tracking) &&
        (value.tracking.status === "tracked" || value.tracking.status === "untracked") &&
        (value.tracking.decidedOn === null ||
          (isString(value.tracking.decidedOn) && isDate(`${value.tracking.decidedOn}T12:00:00.000Z`))) &&
        (value.tracking.reason === null || isString(value.tracking.reason)))) &&
    (value.opening === undefined ||
      value.opening === null ||
      (isRecord(value.opening) &&
        (value.opening.quantityState === "unconfirmed" || value.opening.quantityState === "confirmed") &&
        (value.opening.quantityState === "unconfirmed"
          ? value.opening.quantityMilli === null || value.opening.quantityMilli === undefined
          : isMoney(value.opening.quantityMilli)) &&
        (value.opening.costState === "known" || value.opening.costState === "unknown") &&
        (value.opening.costState === "known"
          ? isMoney(value.opening.valueMinor)
          : value.opening.valueMinor === null || value.opening.valueMinor === undefined) &&
        (value.opening.confirmedOn === null ||
          (isString(value.opening.confirmedOn) && isDate(`${value.opening.confirmedOn}T12:00:00.000Z`))) &&
        (value.opening.sourceNote === null || isString(value.opening.sourceNote))))
  );
}
export function validInventoryMovement(value: unknown): boolean {
  if (
    !isRecord(value) ||
    !isString(value.id) ||
    !isString(value.materialId) ||
    !isInventoryMovementType(value.type) ||
    !isString(value.occurredOn) ||
    !isDate(`${value.occurredOn}T12:00:00.000Z`) ||
    !isDate(value.recordedAt) ||
    !isSignedMoney(value.quantityDeltaMilli) ||
    !isSignedMoney(value.valueDeltaMinor) ||
    value.quantityDeltaMilli === 0 ||
    !isString(value.note) ||
    !value.note.trim() ||
    !(value.reason === null || isString(value.reason)) ||
    !isString(value.operationKey) ||
    !value.operationKey.trim() ||
    !(value.purchaseId === null || isString(value.purchaseId)) ||
    !(value.orderId === null || isString(value.orderId)) ||
    /* المجموعة ٣ (عقد D6): ربط البيع المباشر — null أو نص (اختياري). */
    !(value.saleId === undefined || value.saleId === null || isString(value.saleId)) ||
    !(value.reversesMovementId === null || isString(value.reversesMovementId)) ||
    !(
      value.costKnowledge === undefined ||
      value.costKnowledge === null ||
      value.costKnowledge === "known" ||
      value.costKnowledge === "unknown"
    )
  )
    return false;
  /* المجموعة ٢ (عقد ٢٨): قيمة صفرية ⇐ تكلفة غير معروفة — لا صفرًا واثقًا بلا وسم،
   * ولا وسم «غير معروفة» على قيمة معلنة. (الإرث بلا حقل = known وقيمة غير صفرية.) */
  const costKnowledge = value.costKnowledge === "unknown" ? "unknown" : "known";
  if (value.valueDeltaMinor === 0 && costKnowledge !== "unknown") return false;
  if (value.valueDeltaMinor !== 0 && costKnowledge === "unknown") return false;
  const quantity = value.quantityDeltaMilli as number;
  const amount = value.valueDeltaMinor as number;
  if ((value.type === "opening" || value.type === "purchase_receipt") && (quantity < 0 || amount < 0))
    return false;
  if ((value.type === "consumption" || value.type === "waste") && (quantity > 0 || amount > 0)) return false;
  if (value.type === "purchase_receipt" ? !isString(value.purchaseId) : value.purchaseId !== null)
    return false;
  /* المجموعة ٢ (عقد ٢٨): الاستهلاك لطلب أو ببيان — الاستهلاك بلا مرجع ولا بيان يُرفض. */
  if (
    value.type === "consumption"
      ? !(isString(value.orderId) || (isString(value.reason) && value.reason.trim().length > 0))
      : value.orderId !== null
  )
    return false;
  if (
    ["waste", "adjustment", "reversal"].includes(value.type as string) &&
    (!isString(value.reason) || !value.reason.trim())
  )
    return false;
  const wasteContextValid =
    value.type === "waste"
      ? isValidWasteContext(value.wasteContext)
      : value.wasteContext === null || value.wasteContext === undefined;
  return (
    wasteContextValid &&
    (value.type === "reversal" ? isString(value.reversesMovementId) : value.reversesMovementId === null)
  );
}
/* المجموعة ٢ (عقد ٢٨ / D-027): فحص سجل نقص عند الاستيراد — شكل صارم بلا تهاون. */
export function validInventoryShortage(value: unknown): boolean {
  if (
    !isRecord(value) ||
    !isString(value.id) ||
    !isString(value.materialId) ||
    !isString(value.occurredOn) ||
    !isDate(value.recordedAt) ||
    !isString(value.note) ||
    !isString(value.operationKey)
  )
    return false;
  const requested = value.requestedQuantityMilli;
  const available = value.availableQuantityMilli;
  const shortage = value.shortageQuantityMilli;
  return (
    isSignedMoney(requested) &&
    (requested as number) > 0 &&
    isSignedMoney(available) &&
    (available as number) >= 0 &&
    isSignedMoney(shortage) &&
    (shortage as number) > 0 &&
    (shortage as number) === (requested as number) - (available as number) &&
    isDate(`${value.occurredOn}T12:00:00.000Z`) &&
    value.note.trim().length > 0 &&
    value.operationKey.trim().length > 0 &&
    (value.orderId === null || isString(value.orderId)) &&
    (value.status === "open" || value.status === "resolved") &&
    (value.status === "open"
      ? value.resolvedOn === null && value.resolutionNote === null
      : isString(value.resolvedOn) &&
        isDate(`${value.resolvedOn}T12:00:00.000Z`) &&
        isString(value.resolutionNote) &&
        value.resolutionNote.trim().length > 0)
  );
}
export function validCatalogItem(value: unknown): boolean {
  return (
    isRecord(value) &&
    isString(value.id) &&
    (value.kind === "product" || value.kind === "service") &&
    isString(value.name) &&
    value.name.trim().length > 0 &&
    (value.unitLabel === null || isString(value.unitLabel)) &&
    (value.unitId === undefined ||
      value.unitId === null ||
      (isString(value.unitId) && value.unitId.trim().length > 0)) &&
    /* P-002: اقتراحات اختيارية — غائبة/فارغة أو عدد صحيح صالح؛ الملفات القديمة بلا
     * الحقلين تُقبل كما هي (توافق التصدير/الاستيراد). */
    (value.defaultPriceMinor === undefined ||
      value.defaultPriceMinor === null ||
      (typeof value.defaultPriceMinor === "number" &&
        Number.isSafeInteger(value.defaultPriceMinor) &&
        value.defaultPriceMinor > 0)) &&
    (value.defaultUnitCostMinor === undefined ||
      value.defaultUnitCostMinor === null ||
      (typeof value.defaultUnitCostMinor === "number" &&
        Number.isSafeInteger(value.defaultUnitCostMinor) &&
        value.defaultUnitCostMinor >= 0)) &&
    typeof value.active === "boolean" &&
    isDate(value.createdAt) &&
    isDate(value.updatedAt) &&
    isString(value.createdOperationKey) &&
    value.createdOperationKey.trim().length > 0
  );
}
export function validMeasurementUnit(value: unknown): boolean {
  return (
    isRecord(value) &&
    isString(value.id) &&
    value.id.trim().length > 0 &&
    isString(value.nameAr) &&
    value.nameAr.trim().length > 0 &&
    isUnitDimension(value.dimension) &&
    (value.symbol === null || isString(value.symbol)) &&
    typeof value.active === "boolean" &&
    isDate(value.createdAt) &&
    isDate(value.updatedAt) &&
    isString(value.createdOperationKey) &&
    value.createdOperationKey.trim().length > 0
  );
}
export function validDirectConversion(
  value: unknown,
  unitIds: Set<string>,
  units: readonly Record<string, unknown>[],
): boolean {
  if (
    !isRecord(value) ||
    !isString(value.id) ||
    !isString(value.fromUnitId) ||
    !isString(value.toUnitId) ||
    value.fromUnitId === value.toUnitId ||
    !unitIds.has(value.fromUnitId) ||
    !unitIds.has(value.toUnitId) ||
    !isUnitDimension(value.dimension) ||
    !isPositiveSafeInteger(value.numerator) ||
    !isPositiveSafeInteger(value.denominator) ||
    !isString(value.note) ||
    value.note.trim().length === 0 ||
    typeof value.active !== "boolean" ||
    !isDate(value.createdAt) ||
    !isDate(value.updatedAt) ||
    !isString(value.createdOperationKey) ||
    value.createdOperationKey.trim().length === 0
  )
    return false;
  const from = units.find(unit => unit.id === value.fromUnitId);
  const to = units.find(unit => unit.id === value.toUnitId);
  return Boolean(from && to && from.dimension === value.dimension && to.dimension === value.dimension);
}
export function validCatalogTemplate(value: unknown, catalogIds: Set<string>, unitIds: Set<string>): boolean {
  if (
    !isRecord(value) ||
    !isString(value.id) ||
    !isString(value.catalogItemId) ||
    !catalogIds.has(value.catalogItemId) ||
    !(value.title === null || isString(value.title)) ||
    !(value.note === null || isString(value.note)) ||
    !Array.isArray(value.components) ||
    !value.components.every(
      component =>
        isRecord(component) &&
        isString(component.id) &&
        component.id.trim().length > 0 &&
        isString(component.name) &&
        component.name.trim().length > 0 &&
        isPositiveSafeInteger(component.quantityMilli) &&
        isString(component.unitId) &&
        unitIds.has(component.unitId) &&
        isOptionalNote(component.note) &&
        /* المجموعة ٣ (عقد D5): هوية المادة اختيارية — null أو نص غير فارغ. */
        (component.materialId === undefined ||
          component.materialId === null ||
          (isString(component.materialId) && component.materialId.trim().length > 0)),
    ) ||
    !(
      value.yield === null ||
      (isRecord(value.yield) &&
        isPositiveSafeInteger(value.yield.quantityMilli) &&
        isString(value.yield.unitId) &&
        unitIds.has(value.yield.unitId))
    ) ||
    !isYieldReadiness(value.yieldReadiness) ||
    !(typeof value.revision === "number" && Number.isSafeInteger(value.revision) && value.revision >= 1) ||
    !(value.sourceTemplateId === null || isString(value.sourceTemplateId)) ||
    typeof value.active !== "boolean" ||
    !isDate(value.createdAt) ||
    !isDate(value.updatedAt) ||
    !isString(value.createdOperationKey) ||
    value.createdOperationKey.trim().length === 0
  )
    return false;
  /* المجموعة ٣ (عقد D5): البنود الاختيارية للقالب — null أو سجل بحقول غير سالبة
   * وغياب صريح (null) للوقت والأجر. */
  if (
    value.extras !== undefined &&
    value.extras !== null &&
    !(
      isRecord(value.extras) &&
      (value.extras.timeMinutes === null ||
        (typeof value.extras.timeMinutes === "number" &&
          Number.isSafeInteger(value.extras.timeMinutes) &&
          value.extras.timeMinutes >= 0)) &&
      (value.extras.hourlyRateMinor === null ||
        (typeof value.extras.hourlyRateMinor === "number" &&
          Number.isSafeInteger(value.extras.hourlyRateMinor) &&
          value.extras.hourlyRateMinor >= 0)) &&
      typeof value.extras.packagingMinor === "number" &&
      Number.isSafeInteger(value.extras.packagingMinor) &&
      value.extras.packagingMinor >= 0 &&
      typeof value.extras.deliveryMinor === "number" &&
      Number.isSafeInteger(value.extras.deliveryMinor) &&
      value.extras.deliveryMinor >= 0 &&
      typeof value.extras.wasteMinor === "number" &&
      Number.isSafeInteger(value.extras.wasteMinor) &&
      value.extras.wasteMinor >= 0 &&
      typeof value.extras.safetyBufferMinor === "number" &&
      Number.isSafeInteger(value.extras.safetyBufferMinor) &&
      value.extras.safetyBufferMinor >= 0
    )
  )
    return false;
  return value.yield === null
    ? value.yieldReadiness === "not_configured"
    : value.yieldReadiness === "ready" || value.yieldReadiness === "needs_conversion";
}
export function validShortCashDeclaration(value: unknown): boolean {
  return (
    isRecord(value) &&
    isString(value.id) &&
    value.id.trim().length > 0 &&
    (value.kind === "declaration" || value.kind === "reversal") &&
    (value.direction === "collection" || value.direction === "commitment") &&
    isPositiveSafeInteger(value.amountMinor) &&
    isString(value.dueOn) &&
    isLocalDate(value.dueOn) &&
    isString(value.source) &&
    value.source.trim().length > 0 &&
    (value.knowledge === "known" || value.knowledge === "estimated" || value.knowledge === "needs_review") &&
    isString(value.note) &&
    value.note.trim().length > 0 &&
    (value.relatedOrderId === null ||
      (isString(value.relatedOrderId) && value.relatedOrderId.trim().length > 0)) &&
    (value.relatedEventId === null ||
      (isString(value.relatedEventId) && value.relatedEventId.trim().length > 0)) &&
    !(isString(value.relatedOrderId) && isString(value.relatedEventId)) &&
    !(isString(value.relatedOrderId) && value.direction !== "collection") &&
    !(isString(value.relatedEventId) && value.direction !== "commitment") &&
    isString(value.idempotencyKey) &&
    value.idempotencyKey.trim().length > 0 &&
    (value.reversalOfId === null || (isString(value.reversalOfId) && value.reversalOfId.trim().length > 0)) &&
    isDate(value.createdAt) &&
    (value.kind === "declaration"
      ? value.reversalOfId === null
      : isString(value.reversalOfId) && value.reversalOfId.trim().length > 0)
  );
}

export function validDraftCostSnapshot(value: unknown): boolean {
  if (
    !isRecord(value) ||
    !isString(value.id) ||
    !Number.isInteger(value.revision) ||
    !isDate(value.createdAt) ||
    value.currency !== "JOD" ||
    !isPositiveQuantity(value.quantity) ||
    !Array.isArray(value.materialItems) ||
    !isMoney(value.packagingMinor) ||
    !isMoney(value.deliveryMinor) ||
    !isMoney(value.wasteMinor) ||
    !isMoney(value.safetyBufferMinor)
  )
    return false;
  if (!(
    value.time === null ||
    (isRecord(value.time) &&
      isTimeMinutes(value.time.minutes) &&
      isOptionalMoney(value.time.hourlyRateMinor) &&
      (value.time.confidence === "known" || value.time.confidence === "estimated"))
  ))
    return false;
  return value.materialItems.every(
    item =>
      isRecord(item) &&
      isString(item.name) &&
      isString(item.unit) &&
      isPositiveQuantity(item.quantity) &&
      isMoney(item.unitPriceMinor) &&
      (item.confidence === "known" || item.confidence === "estimated") &&
      /* المجموعة ٣ (عقد D2): هوية المادة في بند التكلفة — اختيارية null أو نص. */
      (item.materialId === undefined || item.materialId === null || isString(item.materialId)),
  );
}

/* تقدير مستقل: نفس مدخلات الحاسبة بلا مراجع مسودة أو طلب — أداة تفكير بلا أثر مالي. */
export function validCostEstimate(value: unknown): boolean {
  if (
    !isRecord(value) ||
    !isString(value.id) ||
    !isString(value.title) ||
    value.title.trim().length === 0 ||
    value.currency !== "JOD" ||
    !isPositiveQuantity(value.quantity) ||
    !Array.isArray(value.materialItems) ||
    !isMoney(value.packagingMinor) ||
    !isMoney(value.deliveryMinor) ||
    !isMoney(value.wasteMinor) ||
    !isMoney(value.safetyBufferMinor) ||
    !isMoney(value.plannedCostMinor) ||
    !isMoney(value.unitCostMinor) ||
    !isMoney(value.priceFloorMinor) ||
    !isKnownState(value.knowledgeState) ||
    !(value.note === null || value.note === undefined || isString(value.note)) ||
    !isDate(value.createdAt) ||
    !isDate(value.updatedAt)
  )
    return false;
  if (!(
    value.time === null ||
    value.time === undefined ||
    (isRecord(value.time) &&
      isTimeMinutes(value.time.minutes) &&
      isOptionalMoney(value.time.hourlyRateMinor) &&
      (value.time.confidence === "known" || value.time.confidence === "estimated"))
  ))
    return false;
  return value.materialItems.every(
    item =>
      isRecord(item) &&
      isString(item.name) &&
      isString(item.unit) &&
      isPositiveQuantity(item.quantity) &&
      isMoney(item.unitPriceMinor) &&
      (item.confidence === "known" || item.confidence === "estimated") &&
      /* المجموعة ٣ (عقد D2): هوية المادة في بند التكلفة — اختيارية null أو نص. */
      (item.materialId === undefined || item.materialId === null || isString(item.materialId)),
  );
}

export function validDomainCostSnapshot(value: unknown): boolean {
  if (
    !isRecord(value) ||
    !isString(value.id) ||
    value.currency !== "JOD" ||
    !isPositiveQuantity(value.quantity) ||
    !isKnownState(value.knowledgeState) ||
    !isDate(value.createdAt) ||
    !isRecord(value.input)
  )
    return false;
  return [
    "materialCostMinor",
    "timeCostMinor",
    "packagingMinor",
    "deliveryMinor",
    "wasteMinor",
    "plannedCostMinor",
    "unitCostMinor",
    "priceFloorMinor",
  ].every(key => isMoney(value[key]));
}

export function validEvent(value: unknown): boolean {
  return (
    isRecord(value) &&
    isString(value.id) &&
    isString(value.type) &&
    isString(value.idempotencyKey) &&
    isDate(value.createdAt)
  );
}

export function validateOwnerProfile(value: unknown): boolean {
  if (value === null || value === undefined) return true;
  if (!isRecord(value)) return false;
  return (
    value.id === localOwnerProfileId &&
    isString(value.ownerId) &&
    value.ownerId.length >= 8 &&
    value.ownerId.length <= 64 &&
    (value.displayName === null || (isString(value.displayName) && value.displayName.length <= 80)) &&
    (value.email === null || (isString(value.email) && value.email.length <= 120)) &&
    /* حقول مستقبلية محجوزة — null فقط في هذه المرحلة؛ أي قيمة أخرى ترفض الملف. */
    value.provider === null &&
    value.externalAccountId === null &&
    isDate(value.createdAt) &&
    isDate(value.updatedAt)
  );
}
