/**
 * Local persistence contracts. Domain aggregates, persistence records, and view models stay separate.
 * Schedule records are local operational follow-up only; they do not create financial effects.
 */
import type { CraftOrder } from "@micro-domain/craft-order/index.js";
import type { FinancialEvent } from "@micro-domain/financial-event/index.js";
import type { SupplierPurchase } from "@micro-domain/supplier-purchase/index.js";
import type { CashContinuityEntry, CashWallet } from "@micro-domain/cash-continuity/index.js";

export const localSchemaVersion = 12;
export const localProfileId = "local-profile";
export const localPreferencesId = "local-preferences";
export const localExportFormat = "micro-prototype-local-export";
export const localExportVersion = 5;

export type ActivityProfile = { id: typeof localProfileId; activityName: string; currency: "JOD"; activityType: "custom_craft"; createdAt: string; updatedAt: string };
export type LocalPreferences = { id: typeof localPreferencesId; theme: "light" | "dark" | "system"; dailyScheduleCapacityMinutes: number | null; updatedAt: string };
export type DraftIntent = "customer_order" | "planned_design";
export type DraftCostMaterial = { name: string; quantity: number; unit: string; unitPriceMinor: number; confidence: "known" | "estimated" };
export type DraftCostTime = { minutes: number; hourlyRateMinor: number; confidence: "known" | "estimated" };
export type DraftCostSnapshot = { id: string; revision: number; currency: "JOD"; materialItems: readonly DraftCostMaterial[]; time: DraftCostTime | null; packagingMinor: number; deliveryMinor: number; wasteMinor: number; safetyBufferMinor: number; quantity: number; createdAt: string };
export type OrderDraft = { id: string; intent: DraftIntent; customerName: string; itemName: string; specifications: string; quantity: number; costSnapshots: readonly DraftCostSnapshot[]; activeCostSnapshotId: string | null; linkedOrderId: string | null; createdAt: string; updatedAt: string };
export type StoredCraftOrder = { id: string; order: CraftOrder; deliveryDate: string; agreementSource: string | null; createdAt: string; updatedAt: string };

export type ScheduleStatus = "scheduled" | "postponed" | "completed" | "cancelled";
export type ScheduleEventType = "created" | "postponed" | "timing_changed" | "completed" | "cancelled";
export type ScheduleEvent = { id: string; type: ScheduleEventType; idempotencyKey: string; createdAt: string; previousScheduledFor: string | null; scheduledFor: string; previousScheduledTime: string | null; scheduledTime: string | null; previousDurationMinutes: number | null; durationMinutes: number | null; reason: string | null };
export type ScheduleEntry = { id: string; orderId: string; kind: "delivery"; scheduledFor: string; scheduledTime: string | null; durationMinutes: number | null; status: ScheduleStatus; postponeReason: string | null; events: readonly ScheduleEvent[]; createdAt: string; updatedAt: string };

export type LocalStoreSnapshot = { profile: ActivityProfile | null; preferences: LocalPreferences | null; drafts: readonly OrderDraft[]; orders: readonly StoredCraftOrder[]; schedules: readonly ScheduleEntry[]; financialEvents: readonly FinancialEvent[]; supplierPurchases?: readonly SupplierPurchase[]; cashWallets?: readonly CashWallet[]; cashContinuityEntries?: readonly CashContinuityEntry[] };
export type LocalExportFile = { format: typeof localExportFormat; version: typeof localExportVersion; schemaVersion: typeof localSchemaVersion; exportedAt: string; data: LocalStoreSnapshot };
export type StorageFailure = { ok: false; code: "storage_unavailable" | "storage_error"; message: string };
export type StorageSuccess<T> = { ok: true; value: T };
export type StorageResult<T> = StorageSuccess<T> | StorageFailure;

export interface PrototypeLocalStore {
  getProfile(): Promise<StorageResult<ActivityProfile | null>>;
  saveProfile(profile: ActivityProfile): Promise<StorageResult<ActivityProfile>>;
  getPreferences(): Promise<StorageResult<LocalPreferences | null>>;
  savePreferences(preferences: LocalPreferences): Promise<StorageResult<LocalPreferences>>;
  listDrafts(): Promise<StorageResult<readonly OrderDraft[]>>;
  getDraft(id: string): Promise<StorageResult<OrderDraft | null>>;
  saveDraft(draft: OrderDraft): Promise<StorageResult<OrderDraft>>;
  listOrders(): Promise<StorageResult<readonly StoredCraftOrder[]>>;
  getOrder(id: string): Promise<StorageResult<StoredCraftOrder | null>>;
  saveOrder(order: StoredCraftOrder): Promise<StorageResult<StoredCraftOrder>>;
  listSchedules(): Promise<StorageResult<readonly ScheduleEntry[]>>;
  getSchedule(id: string): Promise<StorageResult<ScheduleEntry | null>>;
  saveSchedule(schedule: ScheduleEntry): Promise<StorageResult<ScheduleEntry>>;
  listFinancialEvents(): Promise<StorageResult<readonly FinancialEvent[]>>;
  getFinancialEvent(id: string): Promise<StorageResult<FinancialEvent | null>>;
  saveFinancialEvent(event: FinancialEvent): Promise<StorageResult<FinancialEvent>>;
  listSupplierPurchases(): Promise<StorageResult<readonly SupplierPurchase[]>>;
  getSupplierPurchase(id: string): Promise<StorageResult<SupplierPurchase | null>>;
  saveSupplierPurchase(purchase: SupplierPurchase): Promise<StorageResult<SupplierPurchase>>;
  listCashWallets(): Promise<StorageResult<readonly CashWallet[]>>;
  listCashContinuityEntries(): Promise<StorageResult<readonly CashContinuityEntry[]>>;
  commitCashContinuity(wallet: CashWallet | null, entries: readonly CashContinuityEntry[]): Promise<StorageResult<{ wallet: CashWallet | null; entries: readonly CashContinuityEntry[] }>>;
  commitOrderFromDraft(order: StoredCraftOrder, draft: OrderDraft, schedule?: ScheduleEntry): Promise<StorageResult<{ order: StoredCraftOrder; draft: OrderDraft; schedule: ScheduleEntry | null }>>;
  readSnapshot(): Promise<StorageResult<LocalStoreSnapshot>>;
  replaceSnapshot(snapshot: LocalStoreSnapshot): Promise<StorageResult<LocalStoreSnapshot>>;
}
