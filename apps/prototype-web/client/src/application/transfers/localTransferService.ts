/** Slice 5 transfer boundary: parse and validate first; only an explicit confirmation may replace local IndexedDB state. */
import { localExportFormat, localExportVersion, localProfileId, localSchemaVersion, type LocalExportFile, type LocalStoreSnapshot, type PrototypeLocalStore } from "@/storage/local/types";

export type TransferSummary = { profile: boolean; preferences: boolean; drafts: number; orders: number; schedules: number; financialEvents: number; snapshots: number; events: number; exportedAt: string };
export type TransferPreview = { file: LocalExportFile; summary: TransferSummary };
export type TransferResult<T> = { ok: true; value: T } | { ok: false; code: "validation_error" | "storage_error"; message: string };
const fail = <T,>(message: string): TransferResult<T> => ({ ok: false, code: "validation_error", message });
const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null && !Array.isArray(value);
const isString = (value: unknown): value is string => typeof value === "string";
const isDate = (value: unknown): value is string => isString(value) && !Number.isNaN(Date.parse(value));
const isMoney = (value: unknown): value is number => typeof value === "number" && Number.isInteger(value) && value >= 0;
const isPositiveQuantity = (value: unknown): value is number => typeof value === "number" && Number.isFinite(value) && value > 0;
const isKnownState = (value: unknown) => value === "known" || value === "estimated" || value === "incomplete" || value === "variable" || value === "stale" || value === "partial";
const isResultStatus = (value: unknown) => value === "final" || value === "estimated" || value === "incomplete" || value === "review_required";
const isOrderStatus = (value: unknown) => typeof value === "string" && ["draft", "provisional_agreement", "confirmed", "in_progress", "ready", "delivered", "settled", "postponed", "cancelled", "needs_review"].includes(value);
const isSettlement = (value: unknown) => typeof value === "string" && ["unpaid", "partially_paid", "paid", "debt", "cancelled", "cancelled_pending", "cancelled_refunded", "cancelled_retained"].includes(value);
const isScheduleStatus = (value: unknown) => value === "scheduled" || value === "postponed" || value === "completed" || value === "cancelled";
const isScheduleTime = (value: unknown): value is string => isString(value) && /^([01]\d|2[0-3]):[0-5]\d$/.test(value);
const isScheduleDuration = (value: unknown): value is number => typeof value === "number" && Number.isInteger(value) && value >= 15 && value <= 720 && value % 15 === 0;
const isScheduleEvent = (value: unknown) => isRecord(value) && isString(value.id) && isString(value.idempotencyKey) && isDate(value.createdAt) && (value.type === "created" || value.type === "postponed" || value.type === "timing_changed" || value.type === "completed" || value.type === "cancelled") && (value.previousScheduledFor === null || isString(value.previousScheduledFor)) && isString(value.scheduledFor) && (value.previousScheduledTime === null || isScheduleTime(value.previousScheduledTime)) && (value.scheduledTime === null || isScheduleTime(value.scheduledTime)) && (value.previousDurationMinutes === null || isScheduleDuration(value.previousDurationMinutes)) && (value.durationMinutes === null || isScheduleDuration(value.durationMinutes)) && (value.reason === null || isString(value.reason));
const isFinancialType = (value: unknown) => value === "owner_investment_cash" || value === "owner_withdrawal_cash" || value === "operating_expense_cash" || value === "operating_expense_payable" || value === "payable_settlement_cash";
const isSignedMoney = (value: unknown) => typeof value === "number" && Number.isInteger(value);
const isExpenseContext = (value: unknown) => isRecord(value) && (value.relationship === "project" || value.relationship === "shared") && (value.behavior === "fixed" || value.behavior === "variable" || value.behavior === "mixed" || value.behavior === "unknown") && (value.purpose === "project_general" || value.purpose === "period" || value.purpose === "order" || value.purpose === "product" || value.purpose === "campaign" || value.purpose === "unallocated") && (value.knowledge === "known" || value.knowledge === "estimated" || value.knowledge === "needs_review");
function validFinancialEvent(value: unknown): boolean { if (!isRecord(value) || !isString(value.id) || !isFinancialType(value.type) || value.currency !== "JOD" || !isMoney(value.amountMinor) || value.amountMinor === 0 || !isString(value.occurredOn) || !isDate(`${value.occurredOn}T12:00:00.000Z`) || !isDate(value.recordedAt) || !isString(value.idempotencyKey) || !isString(value.note) || !(value.counterparty === null || isString(value.counterparty)) || !(value.relatedEventId === null || isString(value.relatedEventId)) || !isSignedMoney(value.cashDeltaMinor) || !isSignedMoney(value.payableDeltaMinor) || !isSignedMoney(value.ownerCapitalDeltaMinor) || !isSignedMoney(value.operatingExpenseDeltaMinor)) return false; const expenseContext = value.expenseContext; const hasExpenseContext = expenseContext !== undefined && expenseContext !== null; if (hasExpenseContext && (!isExpenseContext(expenseContext) || (value.type !== "operating_expense_cash" && value.type !== "operating_expense_payable"))) return false; const amount = value.amountMinor; const expected = value.type === "owner_investment_cash" ? [amount, 0, amount, 0] : value.type === "owner_withdrawal_cash" ? [-amount, 0, -amount, 0] : value.type === "operating_expense_cash" ? [-amount, 0, 0, amount] : value.type === "operating_expense_payable" ? [0, amount, 0, amount] : [-amount, -amount, 0, 0]; return value.cashDeltaMinor === expected[0] && value.payableDeltaMinor === expected[1] && value.ownerCapitalDeltaMinor === expected[2] && value.operatingExpenseDeltaMinor === expected[3] && (value.type === "payable_settlement_cash" ? isString(value.relatedEventId) && value.relatedEventId.trim().length > 0 : value.relatedEventId === null); }

function validDraftCostSnapshot(value: unknown): boolean {
  if (!isRecord(value) || !isString(value.id) || !Number.isInteger(value.revision) || !isDate(value.createdAt) || value.currency !== "JOD" || !isPositiveQuantity(value.quantity) || !Array.isArray(value.materialItems) || !isMoney(value.packagingMinor) || !isMoney(value.deliveryMinor) || !isMoney(value.wasteMinor) || !isMoney(value.safetyBufferMinor)) return false;
  if (!(value.time === null || (isRecord(value.time) && typeof value.time.minutes === "number" && isMoney(value.time.hourlyRateMinor) && (value.time.confidence === "known" || value.time.confidence === "estimated")))) return false;
  return value.materialItems.every(item => isRecord(item) && isString(item.name) && isString(item.unit) && isPositiveQuantity(item.quantity) && isMoney(item.unitPriceMinor) && (item.confidence === "known" || item.confidence === "estimated"));
}

function validDomainCostSnapshot(value: unknown): boolean {
  if (!isRecord(value) || !isString(value.id) || value.currency !== "JOD" || !isPositiveQuantity(value.quantity) || !isKnownState(value.knowledgeState) || !isDate(value.createdAt) || !isRecord(value.input)) return false;
  return ["materialCostMinor", "timeCostMinor", "packagingMinor", "deliveryMinor", "wasteMinor", "plannedCostMinor", "unitCostMinor", "priceFloorMinor"].every(key => isMoney(value[key]));
}

function validEvent(value: unknown): boolean {
  return isRecord(value) && isString(value.id) && isString(value.type) && isString(value.idempotencyKey) && isDate(value.createdAt);
}

function validateSnapshot(data: unknown): data is LocalStoreSnapshot {
  if (!isRecord(data) || !Array.isArray(data.drafts) || !Array.isArray(data.orders) || !Array.isArray(data.schedules) || !Array.isArray(data.financialEvents)) return false;
  if (data.profile !== null && (!isRecord(data.profile) || data.profile.id !== localProfileId || !isString(data.profile.activityName) || data.profile.currency !== "JOD" || data.profile.activityType !== "custom_craft" || !isDate(data.profile.createdAt) || !isDate(data.profile.updatedAt))) return false;
  if (data.preferences !== null && (!isRecord(data.preferences) || data.preferences.id !== "local-preferences" || !(data.preferences.theme === "light" || data.preferences.theme === "dark" || data.preferences.theme === "system") || !(data.preferences.dailyScheduleCapacityMinutes === null || isScheduleDuration(data.preferences.dailyScheduleCapacityMinutes)) || !isDate(data.preferences.updatedAt))) return false;
  const orderIds = new Set<string>();
  for (const stored of data.orders) {
    if (!isRecord(stored) || !isString(stored.id) || !isDate(stored.createdAt) || !isDate(stored.updatedAt) || !isString(stored.deliveryDate) || !(stored.agreementSource === null || isString(stored.agreementSource)) || !isRecord(stored.order)) return false;
    const order = stored.order;
    if (order.id !== stored.id || !isString(order.customerName) || !isString(order.itemName) || !isString(order.specifications) || !isPositiveQuantity(order.quantity) || order.currency !== "JOD" || !isMoney(order.agreedPriceMinor) || !isMoney(order.depositCollectedMinor) || !isMoney(order.collectedMinor) || !isMoney(order.receivableMinor) || !isMoney(order.recognizedRevenueMinor) || !isMoney(order.recognizedCostMinor) || !(order.profitIndicatorMinor === null || isMoney(order.profitIndicatorMinor)) || !isOrderStatus(order.status) || !isSettlement(order.settlementStatus) || !isResultStatus(order.resultStatus) || !Array.isArray(order.events) || !order.events.every(validEvent) || !Array.isArray(order.costSnapshots) || !order.costSnapshots.every(validDomainCostSnapshot) || !validDomainCostSnapshot(order.costSnapshot)) return false;
    if (orderIds.has(stored.id)) return false; orderIds.add(stored.id);
  }
  const draftIds = new Set<string>();
  for (const draft of data.drafts) {
    if (!isRecord(draft) || !isString(draft.id) || !(draft.intent === "customer_order" || draft.intent === "planned_design") || !isString(draft.customerName) || !isString(draft.itemName) || !isString(draft.specifications) || !isPositiveQuantity(draft.quantity) || !Array.isArray(draft.costSnapshots) || !draft.costSnapshots.every(validDraftCostSnapshot) || !(draft.activeCostSnapshotId === null || isString(draft.activeCostSnapshotId)) || !(draft.linkedOrderId === null || isString(draft.linkedOrderId)) || !isDate(draft.createdAt) || !isDate(draft.updatedAt)) return false;
    if (draftIds.has(draft.id) || (isString(draft.linkedOrderId) && !orderIds.has(draft.linkedOrderId))) return false; draftIds.add(draft.id);
  }
  const scheduleIds = new Set<string>(); const scheduledOrderIds = new Set<string>();
  for (const schedule of data.schedules) {
    if (!isRecord(schedule) || !isString(schedule.id) || !isString(schedule.orderId) || schedule.kind !== "delivery" || !isString(schedule.scheduledFor) || !(schedule.scheduledTime === null || isScheduleTime(schedule.scheduledTime)) || !(schedule.durationMinutes === null || isScheduleDuration(schedule.durationMinutes)) || (schedule.scheduledTime === null) !== (schedule.durationMinutes === null) || !isScheduleStatus(schedule.status) || !(schedule.postponeReason === null || isString(schedule.postponeReason)) || !isDate(schedule.createdAt) || !isDate(schedule.updatedAt) || !Array.isArray(schedule.events) || !schedule.events.every(isScheduleEvent) || !orderIds.has(schedule.orderId) || scheduleIds.has(schedule.id) || scheduledOrderIds.has(schedule.orderId)) return false;
    scheduleIds.add(schedule.id); scheduledOrderIds.add(schedule.orderId);
  }
  const financialIds = new Set<string>(); const financialKeys = new Set<string>();
  for (const event of data.financialEvents) {
    if (!validFinancialEvent(event) || financialIds.has(event.id) || financialKeys.has(`${event.type}:${event.idempotencyKey}`)) return false;
    financialIds.add(event.id); financialKeys.add(`${event.type}:${event.idempotencyKey}`);
  }
  return true;
}

function summary(file: LocalExportFile): TransferSummary {
  const snapshots = file.data.drafts.reduce((count, draft) => count + draft.costSnapshots.length, 0) + file.data.orders.reduce((count, stored) => count + stored.order.costSnapshots.length, 0);
  const events = file.data.orders.reduce((count, stored) => count + stored.order.events.length, 0);
  return { profile: file.data.profile !== null, preferences: file.data.preferences !== null, drafts: file.data.drafts.length, orders: file.data.orders.length, schedules: file.data.schedules.length, financialEvents: file.data.financialEvents.length, snapshots, events, exportedAt: file.exportedAt };
}

export class LocalTransferService {
  constructor(private readonly store: PrototypeLocalStore, private readonly now: () => string = () => new Date().toISOString()) {}

  async createExport(): Promise<TransferResult<LocalExportFile>> {
    const snapshot = await this.store.readSnapshot();
    if (!snapshot.ok) return { ok: false, code: "storage_error", message: "تعذر قراءة البيانات المحلية للتصدير. لم يُنشأ ملف." };
    return { ok: true, value: { format: localExportFormat, version: localExportVersion, schemaVersion: localSchemaVersion, exportedAt: this.now(), data: snapshot.value } };
  }

  prepareImport(text: string): TransferResult<TransferPreview> {
    let candidate: unknown;
    try { candidate = JSON.parse(text); } catch { return fail("الملف ليس JSON صالحًا. بقيت بيانات هذا الجهاز دون تغيير."); }
    if (!isRecord(candidate) || candidate.format !== localExportFormat) return fail("هذا ليس ملف تصدير Micro المحلي. بقيت بيانات هذا الجهاز دون تغيير.");
    if (candidate.version !== localExportVersion || candidate.schemaVersion !== localSchemaVersion) return fail("إصدار الملف غير مدعوم في هذا Prototype. بقيت بيانات هذا الجهاز دون تغيير.");
    if (!isDate(candidate.exportedAt) || !validateSnapshot(candidate.data)) return fail("الملف ناقص أو لا يطابق بنية Micro المطلوبة. بقيت بيانات هذا الجهاز دون تغيير.");
    const file: LocalExportFile = candidate as LocalExportFile;
    return { ok: true, value: { file, summary: summary(file) } };
  }

  async confirmImport(preview: TransferPreview): Promise<TransferResult<TransferSummary>> {
    const replacement = await this.store.replaceSnapshot(preview.file.data);
    if (!replacement.ok) return { ok: false, code: "storage_error", message: "تعذر استبدال البيانات المحلية. لم يتم تأكيد نجاح الاستيراد." };
    return { ok: true, value: preview.summary };
  }
}
