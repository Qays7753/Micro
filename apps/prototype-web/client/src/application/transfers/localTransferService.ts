/** Slice 5 transfer boundary: parse and validate first; only an explicit confirmation may replace local IndexedDB state. */
import { calculateSharedProjectShareMinor } from "@micro-domain/financial-event/index.js";
import {
  isValidAllocationPolicy,
  isValidWasteContext,
  type AllocationPolicy,
} from "@micro-domain/recurring-margin/index.js";
import {
  isValidOwnerEntitlementOpeningBalance,
  isValidOwnerEntitlementPolicy,
  isValidOwnerEntitlementRecord,
  isValidOwnerMovement,
  type OwnerEntitlementOpeningBalance,
  type OwnerEntitlementPolicy,
  type OwnerEntitlementRecord,
  type OwnerMovement,
} from "@micro-domain/owner-entitlement/index.js";
import {
  localExportFormat,
  localExportVersion,
  localProfileId,
  localSchemaVersion,
  type LocalExportFile,
  type LocalStoreSnapshot,
  type PrototypeLocalStore,
} from "@/storage/local/types";

export type TransferSummary = {
  profile: boolean;
  preferences: boolean;
  drafts: number;
  orders: number;
  schedules: number;
  recurrences: number;
  financialEvents: number;
  supplierPurchases: number;
  cashWallets: number;
  cashContinuityEntries: number;
  materials: number;
  inventoryMovements: number;
  catalogItems: number;
  measurementUnits: number;
  directConversions: number;
  catalogTemplates: number;
  actualTimeRecords: number;
  shortCashDeclarations: number;
  ownerEntitlementPolicies: number;
  ownerEntitlementRecords: number;
  ownerEntitlementOpeningBalances: number;
  ownerMovements: number;
  allocationPolicies: number;
  snapshots: number;
  events: number;
  exportedAt: string;
};
export type TransferPreview = { file: LocalExportFile; summary: TransferSummary };
export type TransferResult<T> =
  { ok: true; value: T } | { ok: false; code: "validation_error" | "storage_error"; message: string };
const fail = <T>(message: string): TransferResult<T> => ({ ok: false, code: "validation_error", message });
const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);
const isString = (value: unknown): value is string => typeof value === "string";
const isDate = (value: unknown): value is string => isString(value) && !Number.isNaN(Date.parse(value));
const isMoney = (value: unknown): value is number =>
  typeof value === "number" && Number.isInteger(value) && value >= 0;
const isOptionalMoney = (value: unknown): value is number | null => value === null || isMoney(value);
const isTimeMinutes = (value: unknown): value is number | null =>
  value === null || (typeof value === "number" && Number.isFinite(value) && value >= 0);
const isPositiveQuantity = (value: unknown): value is number =>
  typeof value === "number" && Number.isFinite(value) && value > 0;
const isKnownState = (value: unknown) =>
  value === "known" ||
  value === "estimated" ||
  value === "incomplete" ||
  value === "variable" ||
  value === "stale" ||
  value === "partial";
const isResultStatus = (value: unknown) =>
  value === "final" || value === "estimated" || value === "incomplete" || value === "review_required";
const isOrderStatus = (value: unknown) =>
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
const isSettlement = (value: unknown) =>
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
const isScheduleStatus = (value: unknown) =>
  value === "scheduled" || value === "postponed" || value === "completed" || value === "cancelled";
const isScheduleTime = (value: unknown): value is string =>
  isString(value) && /^([01]\d|2[0-3]):[0-5]\d$/.test(value);
const isScheduleDuration = (value: unknown): value is number =>
  typeof value === "number" && Number.isInteger(value) && value >= 15 && value <= 720 && value % 15 === 0;
const isAgreementSource = (value: unknown) =>
  value === null ||
  value === "instagram" ||
  value === "whatsapp" ||
  value === "referral" ||
  value === "walk_in" ||
  value === "other" ||
  value === "conversation" ||
  value === "call" ||
  value === "in_person";
const isLocalDate = (value: string) =>
  /^\d{4}-\d{2}-\d{2}$/.test(value) &&
  new Date(`${value}T12:00:00.000Z`).toISOString().slice(0, 10) === value;
const rangesOverlap = (leftFrom: string, leftTo: string | null, rightFrom: string, rightTo: string | null) =>
  leftFrom <= (rightTo ?? "9999-12-31") && rightFrom <= (leftTo ?? "9999-12-31");
const isFollowUpDate = (value: unknown) => value === null || (isString(value) && isLocalDate(value));
const isFollowUpSummary = (value: unknown) =>
  value === null || (isString(value) && value.trim().length >= 2 && value.trim().length <= 240);
const isRecurrenceFrequency = (value: unknown) => value === "weekly" || value === "monthly";
const isRecurrenceStatus = (value: unknown) => value === "active" || value === "cancelled";
const isFollowUpEvent = (value: unknown) =>
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
const isRecurrence = (value: unknown) =>
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
const isScheduleEvent = (value: unknown) =>
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
const isFinancialType = (value: unknown) =>
  value === "owner_investment_cash" ||
  value === "owner_withdrawal_cash" ||
  value === "operating_expense_cash" ||
  value === "operating_expense_payable" ||
  value === "payable_settlement_cash";
const isSignedMoney = (value: unknown) => typeof value === "number" && Number.isInteger(value);
const isCorrectionType = (value: unknown) => value === undefined || value === null || value === "reverse";
const isOptionalString = (value: unknown) => value === undefined || value === null || isString(value);
const isUnitDimension = (value: unknown) =>
  value === "count" ||
  value === "mass" ||
  value === "volume" ||
  value === "time" ||
  value === "distance" ||
  value === "area";
const isPositiveSafeInteger = (value: unknown) =>
  typeof value === "number" && Number.isSafeInteger(value) && value > 0;
const isSafeNonZeroInteger = (value: unknown): value is number =>
  typeof value === "number" && Number.isSafeInteger(value) && value !== 0;
const isOptionalNote = (value: unknown) => value === null || isString(value);
type ActualTimeRecordLike = {
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
function validActualTimeRecord(value: unknown, orderIds: Set<string>): value is ActualTimeRecordLike {
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
const isYieldReadiness = (value: unknown) =>
  value === "not_configured" || value === "ready" || value === "needs_conversion";
const isOptionalNonNegativeMoney = (value: unknown) =>
  value === undefined || value === null || isMoney(value);
const isPercentageBps = (value: unknown) =>
  value === undefined ||
  value === null ||
  (typeof value === "number" && Number.isInteger(value) && value >= 1 && value <= 10_000);
const isSharedProjectShare = (value: unknown, knowledge: unknown) => {
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
const isExpenseContext = (value: unknown) =>
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
  (value.relationship === "shared"
    ? isSharedProjectShare(value.sharedProjectShare, value.knowledge)
    : value.sharedProjectShare === undefined || value.sharedProjectShare === null);
function validFinancialEvent(value: unknown): boolean {
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
  const unallocatedShared =
    isRecord(expenseContext) &&
    isRecord(expenseContext.sharedProjectShare) &&
    expenseContext.sharedProjectShare.allocation === "unallocated";
  const operatingExpense = unallocatedShared ? 0 : amount;
  const expected =
    value.type === "owner_investment_cash"
      ? [amount, 0, amount, 0]
      : value.type === "owner_withdrawal_cash"
        ? [-amount, 0, -amount, 0]
        : value.type === "operating_expense_cash"
          ? [-amount, 0, 0, operatingExpense]
          : value.type === "operating_expense_payable"
            ? [0, amount, 0, operatingExpense]
            : [-amount, -amount, 0, 0];
  return (
    value.cashDeltaMinor === expected[0] &&
    value.payableDeltaMinor === expected[1] &&
    value.ownerCapitalDeltaMinor === expected[2] &&
    value.operatingExpenseDeltaMinor === expected[3] &&
    (value.type === "payable_settlement_cash"
      ? isString(value.relatedEventId) && value.relatedEventId.trim().length > 0
      : value.relatedEventId === null)
  );
}
function validSupplierPurchase(value: unknown): boolean {
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
    !Array.isArray(value.payments)
  )
    return false;
  const paymentKeys = new Set<string>();
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
      paymentKeys.has(payment.idempotencyKey)
    )
      return Number.NaN;
    paymentKeys.add(payment.idempotencyKey);
    return sum + payment.amountMinor;
  }, 0);
  const status = totalPaid === 0 ? "unpaid" : totalPaid === value.totalMinor ? "paid" : "partially_paid";
  return (
    Number.isInteger(totalPaid) &&
    totalPaid === value.paidMinor &&
    value.payableMinor === value.totalMinor - totalPaid &&
    value.status === status
  );
}
const isCashWalletKind = (value: unknown) =>
  value === "cash_drawer" || value === "bank_account" || value === "digital_wallet" || value === "other";
const isCashEntryType = (value: unknown) =>
  value === "opening_balance" ||
  value === "cash_adjustment" ||
  value === "transfer_out" ||
  value === "transfer_in" ||
  value === "reversal";
function validCashWallet(value: unknown): boolean {
  return (
    isRecord(value) &&
    isString(value.id) &&
    isString(value.name) &&
    value.name.trim().length > 0 &&
    isCashWalletKind(value.kind) &&
    isDate(value.createdAt) &&
    isString(value.createdOperationKey) &&
    value.createdOperationKey.trim().length > 0
  );
}
function validCashEntry(value: unknown): boolean {
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
const isMaterialUnit = (value: unknown) =>
  value === "piece" || value === "meter" || value === "kilogram" || value === "liter" || value === "other";
const isInventoryMovementType = (value: unknown) =>
  value === "opening" ||
  value === "purchase_receipt" ||
  value === "consumption" ||
  value === "waste" ||
  value === "adjustment" ||
  value === "reversal";
function validMaterial(value: unknown): boolean {
  return (
    isRecord(value) &&
    isString(value.id) &&
    isString(value.name) &&
    value.name.trim().length > 0 &&
    isMaterialUnit(value.unit) &&
    isDate(value.createdAt) &&
    isString(value.createdOperationKey) &&
    value.createdOperationKey.trim().length > 0
  );
}
function validInventoryMovement(value: unknown): boolean {
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
    value.valueDeltaMinor === 0 ||
    !isString(value.note) ||
    !value.note.trim() ||
    !(value.reason === null || isString(value.reason)) ||
    !isString(value.operationKey) ||
    !value.operationKey.trim() ||
    !(value.purchaseId === null || isString(value.purchaseId)) ||
    !(value.orderId === null || isString(value.orderId)) ||
    !(value.reversesMovementId === null || isString(value.reversesMovementId))
  )
    return false;
  const quantity = value.quantityDeltaMilli as number;
  const amount = value.valueDeltaMinor as number;
  if ((value.type === "opening" || value.type === "purchase_receipt") && (quantity < 0 || amount < 0))
    return false;
  if ((value.type === "consumption" || value.type === "waste") && (quantity > 0 || amount > 0)) return false;
  if (value.type === "purchase_receipt" ? !isString(value.purchaseId) : value.purchaseId !== null)
    return false;
  if (value.type === "consumption" ? !isString(value.orderId) : value.orderId !== null) return false;
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
function validCatalogItem(value: unknown): boolean {
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
    typeof value.active === "boolean" &&
    isDate(value.createdAt) &&
    isDate(value.updatedAt) &&
    isString(value.createdOperationKey) &&
    value.createdOperationKey.trim().length > 0
  );
}
function validMeasurementUnit(value: unknown): boolean {
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
function validDirectConversion(
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
function validCatalogTemplate(value: unknown, catalogIds: Set<string>, unitIds: Set<string>): boolean {
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
        isOptionalNote(component.note),
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
  return value.yield === null
    ? value.yieldReadiness === "not_configured"
    : value.yieldReadiness === "ready" || value.yieldReadiness === "needs_conversion";
}
function validShortCashDeclaration(value: unknown): boolean {
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

function validDraftCostSnapshot(value: unknown): boolean {
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
      (item.confidence === "known" || item.confidence === "estimated"),
  );
}

function validDomainCostSnapshot(value: unknown): boolean {
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

function validEvent(value: unknown): boolean {
  return (
    isRecord(value) &&
    isString(value.id) &&
    isString(value.type) &&
    isString(value.idempotencyKey) &&
    isDate(value.createdAt)
  );
}

function validateSnapshot(data: unknown): data is LocalStoreSnapshot {
  if (
    !isRecord(data) ||
    !Array.isArray(data.drafts) ||
    !Array.isArray(data.orders) ||
    !Array.isArray(data.schedules) ||
    !Array.isArray(data.recurrences) ||
    !Array.isArray(data.financialEvents) ||
    !Array.isArray(data.supplierPurchases) ||
    !Array.isArray(data.cashWallets) ||
    !Array.isArray(data.cashContinuityEntries) ||
    !Array.isArray(data.materials) ||
    !Array.isArray(data.inventoryMovements) ||
    !Array.isArray(data.catalogItems) ||
    !Array.isArray(data.measurementUnits) ||
    !Array.isArray(data.directConversions) ||
    !Array.isArray(data.catalogTemplates) ||
    !Array.isArray(data.actualTimeRecords) ||
    !Array.isArray(data.shortCashDeclarations) ||
    !Array.isArray(data.allocationPolicies)
  )
    return false;
  if (
    data.profile !== null &&
    (!isRecord(data.profile) ||
      data.profile.id !== localProfileId ||
      !isString(data.profile.activityName) ||
      data.profile.currency !== "JOD" ||
      data.profile.activityType !== "custom_craft" ||
      !isDate(data.profile.createdAt) ||
      !isDate(data.profile.updatedAt))
  )
    return false;
  if (
    data.preferences !== null &&
    (!isRecord(data.preferences) ||
      data.preferences.id !== "local-preferences" ||
      !(
        data.preferences.theme === "light" ||
        data.preferences.theme === "dark" ||
        data.preferences.theme === "system"
      ) ||
      !(
        data.preferences.dailyScheduleCapacityMinutes === null ||
        isScheduleDuration(data.preferences.dailyScheduleCapacityMinutes)
      ) ||
      !isDate(data.preferences.updatedAt))
  )
    return false;
  const orderIds = new Set<string>();
  for (const stored of data.orders) {
    const orderContextValid =
      isRecord(stored) &&
      isString(stored.id) &&
      isDate(stored.createdAt) &&
      isDate(stored.updatedAt) &&
      isString(stored.deliveryDate) &&
      (stored.catalogItemId === null || isString(stored.catalogItemId)) &&
      isAgreementSource(stored.agreementSource) &&
      isFollowUpSummary(stored.followUpSummary) &&
      isFollowUpDate(stored.followUpDate) &&
      (stored.followUpReason === null ||
        (isString(stored.followUpReason) &&
          stored.followUpReason.trim().length >= 2 &&
          stored.followUpReason.trim().length <= 160)) &&
      (stored.followUpDate === null ? stored.followUpReason === null : stored.followUpReason !== null) &&
      Array.isArray(stored.followUpEvents) &&
      stored.followUpEvents.every(isFollowUpEvent) &&
      isRecord(stored.order);
    if (!orderContextValid || !isRecord(stored) || !isRecord(stored.order) || !isString(stored.id))
      return false;
    const order = stored.order;
    const domainOrderValid =
      order.id === stored.id &&
      isString(order.customerName) &&
      isString(order.itemName) &&
      isString(order.specifications) &&
      isPositiveQuantity(order.quantity) &&
      order.currency === "JOD" &&
      isMoney(order.agreedPriceMinor) &&
      isMoney(order.depositCollectedMinor) &&
      isMoney(order.collectedMinor) &&
      isMoney(order.receivableMinor) &&
      isMoney(order.recognizedRevenueMinor) &&
      isMoney(order.recognizedCostMinor) &&
      (order.profitIndicatorMinor === null || isMoney(order.profitIndicatorMinor)) &&
      isOrderStatus(order.status) &&
      isSettlement(order.settlementStatus) &&
      isResultStatus(order.resultStatus) &&
      Array.isArray(order.events) &&
      order.events.every(validEvent) &&
      Array.isArray(order.costSnapshots) &&
      order.costSnapshots.every(validDomainCostSnapshot) &&
      validDomainCostSnapshot(order.costSnapshot);
    if (!domainOrderValid) return false;
    if (orderIds.has(stored.id)) return false;
    orderIds.add(stored.id);
  }
  const actualTimeRecords = data.actualTimeRecords as unknown[];
  const actualTimeIds = new Set<string>();
  const actualTimeOperationKeys = new Set<string>();
  const reversedActualTimeIds = new Set<string>();
  for (const rawRecord of actualTimeRecords) {
    if (!validActualTimeRecord(rawRecord, orderIds)) return false;
    const record = rawRecord as ActualTimeRecordLike;
    if (actualTimeIds.has(record.id) || actualTimeOperationKeys.has(record.operationKey)) return false;
    if (record.reversalOfId !== null) {
      if (reversedActualTimeIds.has(record.reversalOfId)) return false;
      reversedActualTimeIds.add(record.reversalOfId);
    }
    actualTimeIds.add(record.id);
    actualTimeOperationKeys.add(record.operationKey);
  }
  for (const rawRecord of actualTimeRecords) {
    const record = rawRecord as ActualTimeRecordLike;
    if (record.reversalOfId === null) continue;
    const original = actualTimeRecords.find(
      candidate => isRecord(candidate) && candidate.id === record.reversalOfId,
    ) as ActualTimeRecordLike | undefined;
    if (
      !original ||
      original.reversalOfId !== null ||
      original.orderId !== record.orderId ||
      original.minutesDelta !== -record.minutesDelta ||
      original.minutesDelta <= 0
    )
      return false;
  }
  const draftIds = new Set<string>();
  for (const draft of data.drafts) {
    if (
      !isRecord(draft) ||
      !isString(draft.id) ||
      !(draft.intent === "customer_order" || draft.intent === "planned_design") ||
      !isString(draft.customerName) ||
      !isString(draft.itemName) ||
      !(draft.catalogItemId === null || isString(draft.catalogItemId)) ||
      !isString(draft.specifications) ||
      !isPositiveQuantity(draft.quantity) ||
      !Array.isArray(draft.costSnapshots) ||
      !draft.costSnapshots.every(validDraftCostSnapshot) ||
      !(draft.activeCostSnapshotId === null || isString(draft.activeCostSnapshotId)) ||
      !(draft.linkedOrderId === null || isString(draft.linkedOrderId)) ||
      !isDate(draft.createdAt) ||
      !isDate(draft.updatedAt)
    )
      return false;
    if (draftIds.has(draft.id) || (isString(draft.linkedOrderId) && !orderIds.has(draft.linkedOrderId)))
      return false;
    draftIds.add(draft.id);
  }
  const scheduleIds = new Set<string>();
  for (const schedule of data.schedules) {
    if (
      !isRecord(schedule) ||
      !isString(schedule.id) ||
      !isString(schedule.orderId) ||
      schedule.kind !== "delivery" ||
      !isString(schedule.scheduledFor) ||
      !(schedule.scheduledTime === null || isScheduleTime(schedule.scheduledTime)) ||
      !(schedule.durationMinutes === null || isScheduleDuration(schedule.durationMinutes)) ||
      (schedule.scheduledTime === null) !== (schedule.durationMinutes === null) ||
      !(schedule.recurrenceId === null || isString(schedule.recurrenceId)) ||
      !(
        schedule.recurrenceIndex === null ||
        (typeof schedule.recurrenceIndex === "number" &&
          Number.isInteger(schedule.recurrenceIndex) &&
          schedule.recurrenceIndex >= 1 &&
          schedule.recurrenceIndex <= 12)
      ) ||
      (schedule.recurrenceId === null) !== (schedule.recurrenceIndex === null) ||
      !isScheduleStatus(schedule.status) ||
      !(schedule.postponeReason === null || isString(schedule.postponeReason)) ||
      !isDate(schedule.createdAt) ||
      !isDate(schedule.updatedAt) ||
      !Array.isArray(schedule.events) ||
      !schedule.events.every(isScheduleEvent) ||
      !orderIds.has(schedule.orderId) ||
      scheduleIds.has(schedule.id)
    )
      return false;
    scheduleIds.add(schedule.id);
  }
  const recurrenceIds = new Set<string>();
  const recurrenceKeys = new Set<string>();
  const appearanceKeys = new Set<string>();
  for (const recurrence of data.recurrences) {
    if (
      !isRecurrence(recurrence) ||
      recurrenceIds.has(recurrence.id) ||
      recurrenceKeys.has(recurrence.idempotencyKey) ||
      !scheduleIds.has(recurrence.sourceScheduleId) ||
      !orderIds.has(recurrence.orderId)
    )
      return false;
    const source = data.schedules.find(schedule => schedule.id === recurrence.sourceScheduleId);
    if (!source || source.orderId !== recurrence.orderId || source.recurrenceId !== null) return false;
    recurrenceIds.add(recurrence.id);
    recurrenceKeys.add(recurrence.idempotencyKey);
  }
  for (const schedule of data.schedules) {
    if (schedule.recurrenceId !== null) {
      if (
        !recurrenceIds.has(schedule.recurrenceId) ||
        appearanceKeys.has(`${schedule.recurrenceId}:${schedule.recurrenceIndex}`)
      )
        return false;
      appearanceKeys.add(`${schedule.recurrenceId}:${schedule.recurrenceIndex}`);
    }
  }
  const financialIds = new Set<string>();
  const financialKeys = new Set<string>();
  const reversedFinancialIds = new Set<string>();
  for (const event of data.financialEvents) {
    if (
      !validFinancialEvent(event) ||
      financialIds.has(event.id) ||
      financialKeys.has(`${event.type}:${event.idempotencyKey}`)
    )
      return false;
    financialIds.add(event.id);
    financialKeys.add(`${event.type}:${event.idempotencyKey}`);
    if (event.correctionType === "reverse") {
      if (reversedFinancialIds.has(event.correctionOfEventId)) return false;
      reversedFinancialIds.add(event.correctionOfEventId);
    }
  }
  for (const event of data.financialEvents) {
    if (event.correctionType !== "reverse") continue;
    const source = data.financialEvents.find(candidate => candidate.id === event.correctionOfEventId);
    if (
      !source ||
      source.correctionType === "reverse" ||
      source.id === event.id ||
      source.type !== event.type ||
      source.amountMinor !== event.amountMinor ||
      source.relatedEventId !== event.relatedEventId ||
      event.cashDeltaMinor !== -source.cashDeltaMinor ||
      event.payableDeltaMinor !== -source.payableDeltaMinor ||
      event.ownerCapitalDeltaMinor !== -source.ownerCapitalDeltaMinor ||
      event.operatingExpenseDeltaMinor !== -source.operatingExpenseDeltaMinor
    )
      return false;
  }
  const purchaseIds = new Set<string>();
  const purchaseKeys = new Set<string>();
  for (const purchase of data.supplierPurchases ?? []) {
    if (
      !validSupplierPurchase(purchase) ||
      purchaseIds.has(purchase.id) ||
      purchaseKeys.has(purchase.idempotencyKey)
    )
      return false;
    purchaseIds.add(purchase.id);
    purchaseKeys.add(purchase.idempotencyKey);
  }
  const walletIds = new Set<string>();
  const walletOperationKeys = new Set<string>();
  for (const wallet of data.cashWallets ?? []) {
    if (
      !validCashWallet(wallet) ||
      walletIds.has(wallet.id) ||
      walletOperationKeys.has(wallet.createdOperationKey)
    )
      return false;
    walletIds.add(wallet.id);
    walletOperationKeys.add(wallet.createdOperationKey);
  }
  const entryIds = new Set<string>();
  const entryOperationKeys = new Set<string>();
  const reversedIds = new Set<string>();
  const transferGroups = new Map<string, Record<string, unknown>[]>();
  for (const entry of data.cashContinuityEntries ?? []) {
    if (
      !validCashEntry(entry) ||
      entryIds.has(entry.id) ||
      !walletIds.has(entry.walletId) ||
      entryOperationKeys.has(entry.operationKey)
    )
      return false;
    entryIds.add(entry.id);
    entryOperationKeys.add(entry.operationKey);
    if (entry.type === "reversal") {
      if (reversedIds.has(entry.reversesEntryId)) return false;
      reversedIds.add(entry.reversesEntryId);
    }
    if (isString(entry.transferId))
      transferGroups.set(entry.transferId, [...(transferGroups.get(entry.transferId) ?? []), entry]);
  }
  for (const entry of data.cashContinuityEntries ?? []) {
    if (entry.type === "reversal") {
      const original = (data.cashContinuityEntries ?? []).find(
        candidate => candidate.id === entry.reversesEntryId,
      );
      if (!original || entry.cashDeltaMinor !== -original.cashDeltaMinor) return false;
    }
  }
  for (const group of transferGroups.values()) {
    if (
      group.length !== 2 ||
      group.reduce((sum, entry) => sum + (entry.cashDeltaMinor as number), 0) !== 0 ||
      !group.some(entry => entry.type === "transfer_out") ||
      !group.some(entry => entry.type === "transfer_in") ||
      group.some(entry => entry.type === "transfer_out" && (entry.cashDeltaMinor as number) > 0) ||
      group.some(entry => entry.type === "transfer_in" && (entry.cashDeltaMinor as number) < 0)
    )
      return false;
  }
  const materialIds = new Set<string>();
  const materialKeys = new Set<string>();
  for (const material of data.materials) {
    if (
      !validMaterial(material) ||
      materialIds.has(material.id) ||
      materialKeys.has(material.createdOperationKey)
    )
      return false;
    materialIds.add(material.id);
    materialKeys.add(material.createdOperationKey);
  }
  const inventoryIds = new Set<string>();
  const inventoryKeys = new Set<string>();
  const reversedInventoryIds = new Set<string>();
  for (const movement of data.inventoryMovements) {
    if (
      !validInventoryMovement(movement) ||
      inventoryIds.has(movement.id) ||
      inventoryKeys.has(movement.operationKey) ||
      !materialIds.has(movement.materialId)
    )
      return false;
    if (movement.purchaseId !== null && !purchaseIds.has(movement.purchaseId)) return false;
    if (movement.orderId !== null && !orderIds.has(movement.orderId)) return false;
    if (movement.type === "reversal") {
      if (reversedInventoryIds.has(movement.reversesMovementId)) return false;
      reversedInventoryIds.add(movement.reversesMovementId);
    }
    inventoryIds.add(movement.id);
    inventoryKeys.add(movement.operationKey);
  }
  for (const movement of data.inventoryMovements) {
    if (movement.type === "reversal") {
      const target = data.inventoryMovements.find(candidate => candidate.id === movement.reversesMovementId);
      if (
        !target ||
        target.materialId !== movement.materialId ||
        target.quantityDeltaMilli !== -movement.quantityDeltaMilli ||
        target.valueDeltaMinor !== -movement.valueDeltaMinor
      )
        return false;
    }
  }
  const catalogIds = new Set<string>();
  const catalogKeys = new Set<string>();
  const activeCatalogNames = new Set<string>();
  for (const item of data.catalogItems) {
    if (!validCatalogItem(item) || catalogIds.has(item.id) || catalogKeys.has(item.createdOperationKey))
      return false;
    const key = `${item.kind}:${item.name.trim().replace(/\s+/g, " ").toLocaleLowerCase("ar-JO")}`;
    if (item.active && activeCatalogNames.has(key)) return false;
    catalogIds.add(item.id);
    catalogKeys.add(item.createdOperationKey);
    if (item.active) activeCatalogNames.add(key);
  }
  for (const stored of data.orders) {
    if (isString(stored.catalogItemId) && !catalogIds.has(stored.catalogItemId)) return false;
  }
  for (const draft of data.drafts) {
    if (isString(draft.catalogItemId) && !catalogIds.has(draft.catalogItemId)) return false;
  }
  const unitIds = new Set<string>();
  const unitKeys = new Set<string>();
  const activeUnitNames = new Set<string>();
  for (const unit of data.measurementUnits) {
    if (!validMeasurementUnit(unit) || unitIds.has(unit.id) || unitKeys.has(unit.createdOperationKey))
      return false;
    const nameKey = `${unit.dimension}:${unit.nameAr.trim().replace(/\s+/g, " ").toLocaleLowerCase("ar-JO")}`;
    if (unit.active && activeUnitNames.has(nameKey)) return false;
    unitIds.add(unit.id);
    unitKeys.add(unit.createdOperationKey);
    if (unit.active) activeUnitNames.add(nameKey);
  }
  for (const item of data.catalogItems) {
    if (isString(item.unitId) && !unitIds.has(item.unitId)) return false;
  }
  const conversionIds = new Set<string>();
  const conversionKeys = new Set<string>();
  const activeConversionPairs = new Set<string>();
  const conversionPairs = new Set<string>();
  for (const conversion of data.directConversions) {
    if (
      !validDirectConversion(conversion, unitIds, data.measurementUnits.filter(isRecord)) ||
      conversionIds.has(conversion.id) ||
      conversionKeys.has(conversion.createdOperationKey)
    )
      return false;
    const pair = `${conversion.fromUnitId}:${conversion.toUnitId}`;
    if (conversion.active && activeConversionPairs.has(pair)) return false;
    conversionIds.add(conversion.id);
    conversionKeys.add(conversion.createdOperationKey);
    conversionPairs.add(pair);
    if (conversion.active) activeConversionPairs.add(pair);
  }
  const templateIds = new Set<string>();
  const templateKeys = new Set<string>();
  const activeTemplateItems = new Set<string>();
  for (const template of data.catalogTemplates) {
    if (
      !validCatalogTemplate(template, catalogIds, unitIds) ||
      templateIds.has(template.id) ||
      templateKeys.has(template.createdOperationKey)
    )
      return false;
    templateIds.add(template.id);
    templateKeys.add(template.createdOperationKey);
  }
  for (const template of data.catalogTemplates) {
    if (template.active && activeTemplateItems.has(template.catalogItemId)) return false;
    if (template.sourceTemplateId !== null) {
      const source = data.catalogTemplates.find(
        candidate => isRecord(candidate) && candidate.id === template.sourceTemplateId,
      );
      if (
        !source ||
        source.catalogItemId !== template.catalogItemId ||
        source.revision + 1 !== template.revision ||
        source.active
      )
        return false;
    }
    if (template.active) activeTemplateItems.add(template.catalogItemId);
    const item = data.catalogItems.find(
      candidate => isRecord(candidate) && candidate.id === template.catalogItemId,
    );
    const itemUnit =
      item && isString(item.unitId)
        ? data.measurementUnits.find(candidate => isRecord(candidate) && candidate.id === item.unitId)
        : undefined;
    const outputUnit = template.yield
      ? data.measurementUnits.find(
          candidate => isRecord(candidate) && candidate.id === template.yield?.unitId,
        )
      : undefined;
    if (template.yield === null) {
      if (template.yieldReadiness !== "not_configured") return false;
    } else if (!itemUnit) {
      if (template.yieldReadiness !== "ready") return false;
    } else if (!outputUnit || itemUnit.dimension !== outputUnit.dimension) {
      return false;
    } else if (itemUnit.id === outputUnit.id) {
      if (template.yieldReadiness !== "ready") return false;
    } else if (
      template.yieldReadiness === "ready" &&
      !conversionPairs.has(`${outputUnit.id}:${itemUnit.id}`)
    ) {
      return false;
    }
  }
  for (const movement of data.inventoryMovements) {
    if (movement.type !== "waste" || !isRecord(movement.wasteContext)) continue;
    const context = movement.wasteContext;
    if (context.kind === "order" && !orderIds.has(context.orderId as string)) return false;
    if (context.kind === "catalog_item" && !catalogIds.has(context.catalogItemId as string)) return false;
    if (
      context.kind === "catalog_template" &&
      (!catalogIds.has(context.catalogItemId as string) || !templateIds.has(context.templateId as string))
    )
      return false;
    if (context.kind === "catalog_template") {
      const template = data.catalogTemplates.find(candidate => candidate.id === context.templateId);
      if (!template || template.catalogItemId !== context.catalogItemId) return false;
    }
  }
  const allocationPolicies = (data.allocationPolicies ?? []) as readonly AllocationPolicy[];
  const allocationIds = new Set<string>();
  const allocationKeys = new Set<string>();
  const allocationSuccessors = new Set<string>();
  for (const policy of allocationPolicies) {
    if (
      !isValidAllocationPolicy(policy) ||
      allocationIds.has(policy.id) ||
      allocationKeys.has(policy.idempotencyKey) ||
      !catalogIds.has(policy.catalogItemId) ||
      (policy.kind === "per_output_unit" && (!policy.unitId || !unitIds.has(policy.unitId)))
    )
      return false;
    allocationIds.add(policy.id);
    allocationKeys.add(policy.idempotencyKey);
  }
  for (const policy of allocationPolicies) {
    if (policy.successorOfPolicyId !== null) {
      const previous = allocationPolicies.find(candidate => candidate.id === policy.successorOfPolicyId);
      if (
        !previous ||
        previous.seriesId !== policy.seriesId ||
        previous.version + 1 !== policy.version ||
        previous.status !== "inactive" ||
        previous.endsOn === null ||
        previous.endsOn >= policy.startsOn ||
        allocationSuccessors.has(previous.id)
      )
        return false;
      allocationSuccessors.add(previous.id);
    }
  }
  const activeAllocationPolicies = allocationPolicies.filter(policy => policy.status === "active");
  for (let index = 0; index < activeAllocationPolicies.length; index += 1)
    for (let otherIndex = index + 1; otherIndex < activeAllocationPolicies.length; otherIndex += 1) {
      const left = activeAllocationPolicies[index]!;
      const right = activeAllocationPolicies[otherIndex]!;
      if (
        left.catalogItemId === right.catalogItemId &&
        rangesOverlap(left.periodFrom, left.periodTo, right.periodFrom, right.periodTo)
      )
        return false;
    }
  const declarationIds = new Set<string>();
  const declarationKeys = new Set<string>();
  const reversedDeclarationIds = new Set<string>();
  for (const declaration of data.shortCashDeclarations) {
    if (
      !validShortCashDeclaration(declaration) ||
      declarationIds.has(declaration.id) ||
      declarationKeys.has(`${declaration.kind}:${declaration.idempotencyKey}`)
    )
      return false;
    if (declaration.relatedOrderId !== null && !orderIds.has(declaration.relatedOrderId)) return false;
    if (declaration.relatedEventId !== null) {
      const related = data.financialEvents.find(candidate => candidate.id === declaration.relatedEventId);
      if (!related || related.type !== "operating_expense_payable") return false;
    }
    declarationIds.add(declaration.id);
    declarationKeys.add(`${declaration.kind}:${declaration.idempotencyKey}`);
    if (declaration.kind === "reversal") {
      if (reversedDeclarationIds.has(declaration.reversalOfId)) return false;
      reversedDeclarationIds.add(declaration.reversalOfId);
    }
  }
  for (const declaration of data.shortCashDeclarations) {
    if (declaration.kind === "reversal") {
      const original = data.shortCashDeclarations.find(
        candidate => candidate.id === declaration.reversalOfId,
      );
      if (
        !original ||
        original.kind !== "declaration" ||
        original.amountMinor !== declaration.amountMinor ||
        original.direction !== declaration.direction ||
        original.dueOn !== declaration.dueOn ||
        original.source !== declaration.source ||
        original.relatedOrderId !== declaration.relatedOrderId ||
        original.relatedEventId !== declaration.relatedEventId
      )
        return false;
    }
  }
  const ownerEntitlementPolicies = (
    Array.isArray(data.ownerEntitlementPolicies) ? data.ownerEntitlementPolicies : []
  ) as readonly OwnerEntitlementPolicy[];
  const ownerEntitlementRecords = (
    Array.isArray(data.ownerEntitlementRecords) ? data.ownerEntitlementRecords : []
  ) as readonly OwnerEntitlementRecord[];
  const ownerEntitlementOpeningBalances = (
    Array.isArray(data.ownerEntitlementOpeningBalances) ? data.ownerEntitlementOpeningBalances : []
  ) as readonly OwnerEntitlementOpeningBalance[];
  const ownerMovements = (
    Array.isArray(data.ownerMovements) ? data.ownerMovements : []
  ) as readonly OwnerMovement[];
  const policyIds = new Set<string>();
  const policyKeys = new Set<string>();
  const policyVersions = new Set<string>();
  const successorTargets = new Set<string>();
  for (const policy of ownerEntitlementPolicies) {
    if (
      !isValidOwnerEntitlementPolicy(policy) ||
      policyIds.has(policy.id) ||
      policyKeys.has(policy.idempotencyKey) ||
      policyVersions.has(`${policy.seriesId}:${policy.version}`)
    )
      return false;
    policyIds.add(policy.id);
    policyKeys.add(policy.idempotencyKey);
    policyVersions.add(`${policy.seriesId}:${policy.version}`);
  }
  for (const policy of ownerEntitlementPolicies) {
    if (policy.successorOfPolicyId !== null) {
      const previous = ownerEntitlementPolicies.find(
        candidate => candidate.id === policy.successorOfPolicyId,
      );
      if (
        !previous ||
        previous.id === policy.id ||
        previous.seriesId !== policy.seriesId ||
        previous.version + 1 !== policy.version ||
        previous.status !== "ended" ||
        previous.endsOn === null ||
        previous.endsOn >= policy.startsOn ||
        successorTargets.has(previous.id)
      )
        return false;
      successorTargets.add(previous.id);
    }
  }
  const activePolicies = ownerEntitlementPolicies.filter(policy => policy.status === "active");
  for (const left of activePolicies)
    for (const right of activePolicies)
      if (
        left.id !== right.id &&
        left.seriesId === right.seriesId &&
        rangesOverlap(left.startsOn, left.endsOn, right.startsOn, right.endsOn)
      )
        return false;
  const entitlementIds = new Set<string>();
  const entitlementKeys = new Set<string>();
  const reversedEntitlementIds = new Set<string>();
  for (const record of ownerEntitlementRecords) {
    if (
      !isValidOwnerEntitlementRecord(record) ||
      entitlementIds.has(record.id) ||
      entitlementKeys.has(record.idempotencyKey) ||
      !policyIds.has(record.policyId)
    )
      return false;
    const policy = ownerEntitlementPolicies.find(candidate => candidate.id === record.policyId);
    if (!policy || policy.version !== record.policyVersion) return false;
    if (record.reversalOfId !== null) {
      if (reversedEntitlementIds.has(record.reversalOfId)) return false;
      reversedEntitlementIds.add(record.reversalOfId);
    }
    entitlementIds.add(record.id);
    entitlementKeys.add(record.idempotencyKey);
  }
  for (const record of ownerEntitlementRecords) {
    if (record.reversalOfId !== null) {
      const source = ownerEntitlementRecords.find(candidate => candidate.id === record.reversalOfId);
      if (
        !source ||
        source.reversalOfId !== null ||
        source.policyId !== record.policyId ||
        source.policyVersion !== record.policyVersion ||
        source.amountMinor !== record.amountMinor ||
        source.periodFrom !== record.periodFrom ||
        source.periodTo !== record.periodTo ||
        source.calculationBasis !== record.calculationBasis ||
        source.baseMinor !== record.baseMinor ||
        source.quantity !== record.quantity ||
        source.sourceKeys.join("|") !== record.sourceKeys.join("|")
      )
        return false;
    }
  }
  const activeEntitlements = ownerEntitlementRecords.filter(
    record => record.reversalOfId === null && !reversedEntitlementIds.has(record.id),
  );
  for (let index = 0; index < activeEntitlements.length; index += 1)
    for (let otherIndex = index + 1; otherIndex < activeEntitlements.length; otherIndex += 1) {
      const left = activeEntitlements[index]!;
      const right = activeEntitlements[otherIndex]!;
      if (left.policyId !== right.policyId || left.policyVersion !== right.policyVersion) continue;
      const policy = ownerEntitlementPolicies.find(candidate => candidate.id === left.policyId);
      if (!policy) return false;
      if (
        left.sourceKeys.some(key => right.sourceKeys.includes(key)) ||
        (["monthly", "weekly", "daily", "fixed_period", "profit_share"].includes(policy.kind) &&
          rangesOverlap(left.periodFrom, left.periodTo, right.periodFrom, right.periodTo))
      )
        return false;
    }
  const openingIds = new Set<string>();
  const openingKeys = new Set<string>();
  const reversedOpeningIds = new Set<string>();
  for (const balance of ownerEntitlementOpeningBalances) {
    if (
      !isValidOwnerEntitlementOpeningBalance(balance) ||
      openingIds.has(balance.id) ||
      openingKeys.has(balance.idempotencyKey)
    )
      return false;
    if (balance.reversalOfId !== null) {
      if (reversedOpeningIds.has(balance.reversalOfId)) return false;
      reversedOpeningIds.add(balance.reversalOfId);
    }
    openingIds.add(balance.id);
    openingKeys.add(balance.idempotencyKey);
  }
  for (const balance of ownerEntitlementOpeningBalances) {
    if (balance.reversalOfId !== null) {
      const source = ownerEntitlementOpeningBalances.find(candidate => candidate.id === balance.reversalOfId);
      if (
        !source ||
        source.reversalOfId !== null ||
        source.amountMinor !== balance.amountMinor ||
        source.reason !== balance.reason
      )
        return false;
    }
  }
  if (
    ownerEntitlementOpeningBalances.filter(
      balance => balance.reversalOfId === null && !reversedOpeningIds.has(balance.id),
    ).length > 1
  )
    return false;
  const activeOpeningIds = new Set(
    ownerEntitlementOpeningBalances
      .filter(balance => balance.reversalOfId === null && !reversedOpeningIds.has(balance.id))
      .map(balance => balance.id),
  );
  const ownerMovementReferenceIds = new Set(ownerMovements.map(movement => movement.id));
  const ownerMovementIds = new Set<string>();
  const ownerMovementKeys = new Set<string>();
  const ownerReversalIds = new Set<string>();
  for (const movement of ownerMovements) {
    if (
      !isValidOwnerMovement(movement) ||
      ownerMovementIds.has(movement.id) ||
      ownerMovementKeys.has(movement.idempotencyKey) ||
      !walletIds.has(movement.walletId)
    )
      return false;
    if (
      movement.relatedEntitlementId !== null &&
      (!entitlementIds.has(movement.relatedEntitlementId) ||
        !activeEntitlements.some(record => record.id === movement.relatedEntitlementId))
    )
      return false;
    if (
      movement.relatedOpeningBalanceId !== null &&
      (!openingIds.has(movement.relatedOpeningBalanceId) ||
        !activeOpeningIds.has(movement.relatedOpeningBalanceId) ||
        movement.relatedEntitlementId !== null ||
        movement.relatedMovementId !== null)
    )
      return false;
    if (movement.relatedMovementId !== null) {
      const source = ownerMovements.find(candidate => candidate.id === movement.relatedMovementId);
      if (
        !source ||
        source.kind !== "draw" ||
        source.reversalOfId !== null ||
        ownerMovements.some(candidate => candidate.reversalOfId === source.id)
      )
        return false;
    }
    if (movement.reversalOfId !== null) {
      if (ownerReversalIds.has(movement.reversalOfId)) return false;
      ownerReversalIds.add(movement.reversalOfId);
    }
    const cashEntry = (data.cashContinuityEntries ?? []).find(
      entry => entry.operationKey === `owner-movement:${movement.idempotencyKey}`,
    );
    if (
      !cashEntry ||
      cashEntry.walletId !== movement.walletId ||
      cashEntry.cashDeltaMinor !== movement.cashDeltaMinor ||
      cashEntry.type !== "cash_adjustment"
    )
      return false;
    ownerMovementIds.add(movement.id);
    ownerMovementKeys.add(movement.idempotencyKey);
  }
  for (const movement of ownerMovements) {
    if (movement.reversalOfId !== null) {
      const source = ownerMovements.find(candidate => candidate.id === movement.reversalOfId);
      if (
        !source ||
        source.reversalOfId !== null ||
        source.kind !== movement.kind ||
        source.amountMinor !== movement.amountMinor ||
        source.walletId !== movement.walletId ||
        source.relatedEntitlementId !== movement.relatedEntitlementId ||
        source.relatedOpeningBalanceId !== movement.relatedOpeningBalanceId ||
        source.relatedMovementId !== movement.relatedMovementId ||
        movement.cashDeltaMinor !== -source.cashDeltaMinor ||
        movement.entitlementDeltaMinor !== -source.entitlementDeltaMinor ||
        movement.openingBalanceDeltaMinor !== -source.openingBalanceDeltaMinor ||
        movement.ownerCapitalDeltaMinor !== -source.ownerCapitalDeltaMinor
      )
        return false;
    }
  }
  for (const balance of ownerEntitlementOpeningBalances.filter(
    value => value.reversalOfId === null && !reversedOpeningIds.has(value.id),
  )) {
    const settled = ownerMovements
      .filter(movement => movement.relatedOpeningBalanceId === balance.id)
      .reduce((sum, movement) => sum + movement.openingBalanceDeltaMinor, 0);
    if (
      Math.abs(settled) > Math.abs(balance.amountMinor) ||
      (balance.amountMinor > 0 && settled > 0) ||
      (balance.amountMinor < 0 && settled < 0)
    )
      return false;
  }
  return true;
}

function summary(file: LocalExportFile): TransferSummary {
  const snapshots =
    file.data.drafts.reduce((count, draft) => count + draft.costSnapshots.length, 0) +
    file.data.orders.reduce((count, stored) => count + stored.order.costSnapshots.length, 0);
  const events = file.data.orders.reduce((count, stored) => count + stored.order.events.length, 0);
  return {
    profile: file.data.profile !== null,
    preferences: file.data.preferences !== null,
    drafts: file.data.drafts.length,
    orders: file.data.orders.length,
    schedules: file.data.schedules.length,
    recurrences: file.data.recurrences?.length ?? 0,
    financialEvents: file.data.financialEvents.length,
    supplierPurchases: file.data.supplierPurchases?.length ?? 0,
    cashWallets: file.data.cashWallets?.length ?? 0,
    cashContinuityEntries: file.data.cashContinuityEntries?.length ?? 0,
    materials: file.data.materials?.length ?? 0,
    inventoryMovements: file.data.inventoryMovements?.length ?? 0,
    catalogItems: file.data.catalogItems?.length ?? 0,
    measurementUnits: file.data.measurementUnits?.length ?? 0,
    directConversions: file.data.directConversions?.length ?? 0,
    catalogTemplates: file.data.catalogTemplates?.length ?? 0,
    actualTimeRecords: file.data.actualTimeRecords?.length ?? 0,
    shortCashDeclarations: file.data.shortCashDeclarations?.length ?? 0,
    ownerEntitlementPolicies: file.data.ownerEntitlementPolicies?.length ?? 0,
    ownerEntitlementRecords: file.data.ownerEntitlementRecords?.length ?? 0,
    ownerEntitlementOpeningBalances: file.data.ownerEntitlementOpeningBalances?.length ?? 0,
    ownerMovements: file.data.ownerMovements?.length ?? 0,
    allocationPolicies: file.data.allocationPolicies?.length ?? 0,
    snapshots,
    events,
    exportedAt: file.exportedAt,
  };
}

export class LocalTransferService {
  constructor(
    private readonly store: PrototypeLocalStore,
    private readonly now: () => string = () => new Date().toISOString(),
  ) {}

  async createExport(): Promise<TransferResult<LocalExportFile>> {
    const snapshot = await this.store.readSnapshot();
    if (!snapshot.ok)
      return {
        ok: false,
        code: "storage_error",
        message: "تعذر قراءة البيانات المحلية للتصدير. لم يُنشأ ملف.",
      };
    return {
      ok: true,
      value: {
        format: localExportFormat,
        version: localExportVersion,
        schemaVersion: localSchemaVersion,
        exportedAt: this.now(),
        data: snapshot.value,
      },
    };
  }

  prepareImport(text: string): TransferResult<TransferPreview> {
    let candidate: unknown;
    try {
      candidate = JSON.parse(text);
    } catch {
      return fail("الملف ليس ملف نسخة صالحًا. بقيت بيانات هذا الجهاز دون تغيير.");
    }
    if (!isRecord(candidate) || candidate.format !== localExportFormat)
      return fail("هذا ليس ملف تصدير Micro المحلي. بقيت بيانات هذا الجهاز دون تغيير.");
    const isCurrent =
      candidate.version === localExportVersion && candidate.schemaVersion === localSchemaVersion;
    const isPreviousCatalogCore = candidate.version === 14 && candidate.schemaVersion === 23;
    const isPreviousBridge = candidate.version === 15 && candidate.schemaVersion === 24;
    const isPreviousG4bScale = candidate.version === 16 && candidate.schemaVersion === 25;
    const isPreviousO1 =
      (candidate.version === 12 && candidate.schemaVersion === 21) ||
      (candidate.version === 13 && candidate.schemaVersion === 22);
    const isPreviousG3 = candidate.version === 11 && candidate.schemaVersion === 20;
    const isG3Legacy = candidate.version === 6 && candidate.schemaVersion === 14;
    const isG3CurrentLegacy = candidate.version === 7 && candidate.schemaVersion === 15;
    const isPreviousG4 = candidate.version === 9 && candidate.schemaVersion === 18;
    const isPreviousG5 = candidate.version === 10 && candidate.schemaVersion === 19;
    if (
      !isCurrent &&
      !isPreviousCatalogCore &&
      !isPreviousBridge &&
      !isPreviousG4bScale &&
      !isPreviousO1 &&
      !isPreviousG3 &&
      !isG3Legacy &&
      !isG3CurrentLegacy &&
      !isPreviousG4 &&
      !isPreviousG5
    )
      return fail("إصدار الملف غير مدعوم في هذا الإصدار من التطبيق؛ بقيت بيانات هذا الجهاز دون تغيير.");
    if (!isDate(candidate.exportedAt) || !isRecord(candidate.data))
      return fail("الملف ناقص أو لا يطابق بنية Micro المطلوبة. بقيت بيانات هذا الجهاز دون تغيير.");
    const raw = candidate.data;
    const migrated: LocalStoreSnapshot = {
      ...raw,
      drafts: Array.isArray(raw.drafts)
        ? raw.drafts.map(draft =>
            isRecord(draft) ? { ...draft, catalogItemId: draft.catalogItemId ?? null } : draft,
          )
        : [],
      orders: Array.isArray(raw.orders)
        ? raw.orders.map(order =>
            isRecord(order)
              ? {
                  ...order,
                  catalogItemId: order.catalogItemId ?? null,
                  followUpSummary: order.followUpSummary ?? null,
                  followUpDate: order.followUpDate ?? null,
                  followUpReason: order.followUpReason ?? null,
                  followUpEvents: Array.isArray(order.followUpEvents) ? order.followUpEvents : [],
                }
              : order,
          )
        : [],
      schedules: Array.isArray(raw.schedules)
        ? raw.schedules.map(schedule =>
            isRecord(schedule)
              ? {
                  ...schedule,
                  recurrenceId: schedule.recurrenceId ?? null,
                  recurrenceIndex: schedule.recurrenceIndex ?? null,
                }
              : schedule,
          )
        : [],
      recurrences: Array.isArray(raw.recurrences) ? raw.recurrences : [],
      financialEvents: Array.isArray(raw.financialEvents) ? raw.financialEvents : [],
      supplierPurchases: Array.isArray(raw.supplierPurchases) ? raw.supplierPurchases : [],
      cashWallets: Array.isArray(raw.cashWallets) ? raw.cashWallets : [],
      cashContinuityEntries: Array.isArray(raw.cashContinuityEntries) ? raw.cashContinuityEntries : [],
      materials: Array.isArray(raw.materials) ? raw.materials : [],
      inventoryMovements: Array.isArray(raw.inventoryMovements)
        ? raw.inventoryMovements.map(movement =>
            isRecord(movement)
              ? {
                  ...movement,
                  wasteContext:
                    movement.type === "waste" ? (movement.wasteContext ?? { kind: "general_project" }) : null,
                }
              : movement,
          )
        : [],
      catalogItems: Array.isArray(raw.catalogItems)
        ? raw.catalogItems.map(item => (isRecord(item) ? { ...item, unitId: item.unitId ?? null } : item))
        : [],
      measurementUnits: Array.isArray(raw.measurementUnits) ? raw.measurementUnits : [],
      directConversions: Array.isArray(raw.directConversions) ? raw.directConversions : [],
      catalogTemplates: Array.isArray(raw.catalogTemplates) ? raw.catalogTemplates : [],
      actualTimeRecords: Array.isArray(raw.actualTimeRecords)
        ? raw.actualTimeRecords
        : isCurrent
          ? undefined
          : [],
      shortCashDeclarations: Array.isArray(raw.shortCashDeclarations) ? raw.shortCashDeclarations : [],
      ownerEntitlementPolicies: Array.isArray(raw.ownerEntitlementPolicies)
        ? raw.ownerEntitlementPolicies.map(policy =>
            isRecord(policy)
              ? {
                  ...policy,
                  seriesId: policy.seriesId ?? policy.id,
                  successorOfPolicyId: policy.successorOfPolicyId ?? null,
                }
              : policy,
          )
        : [],
      ownerEntitlementRecords: Array.isArray(raw.ownerEntitlementRecords)
        ? raw.ownerEntitlementRecords.map(record =>
            isRecord(record)
              ? {
                  ...record,
                  sourceKeys:
                    Array.isArray(record.sourceKeys) && record.sourceKeys.length > 0
                      ? record.sourceKeys
                      : [`legacy:record:${record.id}`],
                  reversalOfId: record.reversalOfId ?? null,
                  reversalReason: record.reversalReason ?? null,
                }
              : record,
          )
        : [],
      ownerEntitlementOpeningBalances: Array.isArray(raw.ownerEntitlementOpeningBalances)
        ? raw.ownerEntitlementOpeningBalances.map(balance =>
            isRecord(balance)
              ? {
                  ...balance,
                  reversalOfId: balance.reversalOfId ?? null,
                  reversalReason: balance.reversalReason ?? null,
                }
              : balance,
          )
        : [],
      ownerMovements: Array.isArray(raw.ownerMovements)
        ? raw.ownerMovements.map(movement =>
            isRecord(movement)
              ? {
                  ...movement,
                  relatedOpeningBalanceId: movement.relatedOpeningBalanceId ?? null,
                  openingBalanceDeltaMinor: movement.openingBalanceDeltaMinor ?? 0,
                  reversalOfId: movement.reversalOfId ?? null,
                  reversalReason: movement.reversalReason ?? null,
                }
              : movement,
          )
        : [],
      allocationPolicies: Array.isArray(raw.allocationPolicies)
        ? raw.allocationPolicies.map(policy =>
            isRecord(policy)
              ? {
                  ...policy,
                  rateMinorPerWholeUnit:
                    policy.kind === "per_output_unit"
                      ? (policy.rateMinorPerWholeUnit ?? policy.rateMinor ?? null)
                      : null,
                  rateMinor: policy.kind === "per_output_unit" ? null : (policy.rateMinor ?? null),
                }
              : policy,
          )
        : [],
    } as unknown as LocalStoreSnapshot;
    if (!validateSnapshot(migrated))
      return fail("الملف ناقص أو لا يطابق بنية Micro المطلوبة. بقيت بيانات هذا الجهاز دون تغيير.");
    const file: LocalExportFile = {
      format: localExportFormat,
      version: localExportVersion,
      schemaVersion: localSchemaVersion,
      exportedAt: candidate.exportedAt,
      data: migrated,
    };
    return { ok: true, value: { file, summary: summary(file) } };
  }

  async confirmImport(preview: TransferPreview): Promise<TransferResult<TransferSummary>> {
    const replacement = await this.store.replaceSnapshot(preview.file.data);
    if (!replacement.ok)
      return {
        ok: false,
        code: "storage_error",
        message: "تعذر استبدال البيانات المحلية. لم يتم تأكيد نجاح الاستيراد.",
      };
    return { ok: true, value: preview.summary };
  }
}
