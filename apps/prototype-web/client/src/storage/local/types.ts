/**
 * Local persistence contracts. Domain aggregates, persistence records, and view models stay separate.
 * Schedule records are local operational follow-up only; they do not create financial effects.
 */
import type { CraftOrder } from "@micro-domain/craft-order/index.js";
import type { FinancialEvent } from "@micro-domain/financial-event/index.js";
import type { SupplierPurchase } from "@micro-domain/supplier-purchase/index.js";
import type { CashContinuityEntry, CashWallet } from "@micro-domain/cash-continuity/index.js";
import type { InventoryMovement, Material } from "@micro-domain/inventory-material/index.js";
import type {
  CatalogItem,
  CatalogTemplate,
  DirectConversion,
  MeasurementUnit,
} from "@micro-domain/catalog/index.js";
import type { ActualTimeRecord } from "@micro-domain/actual-time/index.js";
import type { ShortCashDeclaration } from "@micro-domain/g5/index.js";
import type {
  OwnerEntitlementOpeningBalance,
  OwnerEntitlementPolicy,
  OwnerEntitlementRecord,
  OwnerMovement,
} from "@micro-domain/owner-entitlement/index.js";
import type { AllocationPolicy } from "@micro-domain/recurring-margin/index.js";

export const localSchemaVersion = 26;
export const localProfileId = "local-profile";
export const localPreferencesId = "local-preferences";
export const localExportFormat = "micro-prototype-local-export";
export const localExportVersion = 17;

export type ActivityProfile = {
  id: typeof localProfileId;
  activityName: string;
  currency: "JOD";
  activityType: "custom_craft";
  createdAt: string;
  updatedAt: string;
};
export type OperatingWorkMode = "material_focused" | "time_focused" | "mixed";
export type LocalPreferences = {
  id: typeof localPreferencesId;
  theme: "light" | "dark" | "system";
  dailyScheduleCapacityMinutes: number | null;
  workMode: OperatingWorkMode | null;
  actualTimeTrackingEnabled: boolean;
  /** آخر إخفاء لبطاقة التثبيت؛ تُظهر البطاقة مجددًا بعد نافذة الثلاثين يومًا. ليست بيانات مالية. */
  installBannerDismissedAt: string | null;
  updatedAt: string;
};
export type DraftIntent = "customer_order" | "planned_design";
export type DraftCostMaterial = {
  name: string;
  quantity: number;
  unit: string;
  unitPriceMinor: number;
  confidence: "known" | "estimated";
};
export type DraftCostTime = {
  minutes: number | null;
  hourlyRateMinor: number | null;
  confidence: "known" | "estimated";
};
export type DraftCostSnapshot = {
  id: string;
  revision: number;
  currency: "JOD";
  materialItems: readonly DraftCostMaterial[];
  time: DraftCostTime | null;
  packagingMinor: number;
  deliveryMinor: number;
  wasteMinor: number;
  safetyBufferMinor: number;
  quantity: number;
  createdAt: string;
};
export type OrderDraft = {
  id: string;
  intent: DraftIntent;
  customerName: string;
  itemName: string;
  catalogItemId: string | null;
  specifications: string;
  quantity: number;
  costSnapshots: readonly DraftCostSnapshot[];
  activeCostSnapshotId: string | null;
  linkedOrderId: string | null;
  createdAt: string;
  updatedAt: string;
};
export type AgreementSource = "instagram" | "whatsapp" | "referral" | "walk_in" | "other";
export type FollowUpEvent = {
  id: string;
  type: "created" | "changed";
  idempotencyKey: string;
  createdAt: string;
  previousDate: string | null;
  followUpDate: string | null;
  reason: string;
};
export type StoredCraftOrder = {
  id: string;
  order: CraftOrder;
  catalogItemId: string | null;
  deliveryDate: string;
  agreementSource: AgreementSource | string | null;
  followUpSummary?: string | null;
  followUpDate?: string | null;
  followUpReason?: string | null;
  followUpEvents?: readonly FollowUpEvent[];
  createdAt: string;
  updatedAt: string;
};

export type ScheduleStatus = "scheduled" | "postponed" | "completed" | "cancelled";
export type ScheduleEventType = "created" | "postponed" | "timing_changed" | "completed" | "cancelled";
export type ScheduleEvent = {
  id: string;
  type: ScheduleEventType;
  idempotencyKey: string;
  createdAt: string;
  previousScheduledFor: string | null;
  scheduledFor: string;
  previousScheduledTime: string | null;
  scheduledTime: string | null;
  previousDurationMinutes: number | null;
  durationMinutes: number | null;
  reason: string | null;
};
export type ScheduleEntry = {
  id: string;
  orderId: string;
  kind: "delivery";
  scheduledFor: string;
  scheduledTime: string | null;
  durationMinutes: number | null;
  status: ScheduleStatus;
  postponeReason: string | null;
  events: readonly ScheduleEvent[];
  recurrenceId?: string | null;
  recurrenceIndex?: number | null;
  createdAt: string;
  updatedAt: string;
};
export type ScheduleRecurrenceFrequency = "weekly" | "monthly";
export type ScheduleRecurrenceStatus = "active" | "cancelled";
export type ScheduleRecurrence = {
  id: string;
  sourceScheduleId: string;
  orderId: string;
  frequency: ScheduleRecurrenceFrequency;
  occurrenceCount: number;
  status: ScheduleRecurrenceStatus;
  idempotencyKey: string;
  cancelledAt: string | null;
  cancellationReason: string | null;
  createdAt: string;
  updatedAt: string;
};

export type LocalStoreSnapshot = {
  profile: ActivityProfile | null;
  preferences: LocalPreferences | null;
  drafts: readonly OrderDraft[];
  orders: readonly StoredCraftOrder[];
  schedules: readonly ScheduleEntry[];
  recurrences?: readonly ScheduleRecurrence[];
  financialEvents: readonly FinancialEvent[];
  supplierPurchases?: readonly SupplierPurchase[];
  cashWallets?: readonly CashWallet[];
  cashContinuityEntries?: readonly CashContinuityEntry[];
  materials?: readonly Material[];
  inventoryMovements?: readonly InventoryMovement[];
  catalogItems?: readonly CatalogItem[];
  measurementUnits?: readonly MeasurementUnit[];
  directConversions?: readonly DirectConversion[];
  catalogTemplates?: readonly CatalogTemplate[];
  actualTimeRecords?: readonly ActualTimeRecord[];
  shortCashDeclarations?: readonly ShortCashDeclaration[];
  ownerEntitlementPolicies?: readonly OwnerEntitlementPolicy[];
  ownerEntitlementRecords?: readonly OwnerEntitlementRecord[];
  ownerEntitlementOpeningBalances?: readonly OwnerEntitlementOpeningBalance[];
  ownerMovements?: readonly OwnerMovement[];
  allocationPolicies?: readonly AllocationPolicy[];
};
export type LocalExportFile = {
  format: typeof localExportFormat;
  version: typeof localExportVersion;
  schemaVersion: typeof localSchemaVersion;
  exportedAt: string;
  data: LocalStoreSnapshot;
};
export type StorageFailureCode =
  "storage_unavailable" | "storage_error" | "storage_upgrade_failed" | "storage_blocked" | "storage_stale";
export type StorageFailure = { ok: false; code: StorageFailureCode; message: string };
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
  listRecurrences(): Promise<StorageResult<readonly ScheduleRecurrence[]>>;
  getRecurrence(id: string): Promise<StorageResult<ScheduleRecurrence | null>>;
  saveRecurrence(recurrence: ScheduleRecurrence): Promise<StorageResult<ScheduleRecurrence>>;
  commitRecurrence(
    recurrence: ScheduleRecurrence,
    schedules: readonly ScheduleEntry[],
  ): Promise<StorageResult<{ recurrence: ScheduleRecurrence; schedules: readonly ScheduleEntry[] }>>;
  listFinancialEvents(): Promise<StorageResult<readonly FinancialEvent[]>>;
  getFinancialEvent(id: string): Promise<StorageResult<FinancialEvent | null>>;
  saveFinancialEvent(event: FinancialEvent): Promise<StorageResult<FinancialEvent>>;
  commitFinancialEventCorrection(
    sourceEventId: string,
    reversal: FinancialEvent,
  ): Promise<StorageResult<FinancialEvent>>;
  listSupplierPurchases(): Promise<StorageResult<readonly SupplierPurchase[]>>;
  getSupplierPurchase(id: string): Promise<StorageResult<SupplierPurchase | null>>;
  saveSupplierPurchase(purchase: SupplierPurchase): Promise<StorageResult<SupplierPurchase>>;
  listCashWallets(): Promise<StorageResult<readonly CashWallet[]>>;
  listCashContinuityEntries(): Promise<StorageResult<readonly CashContinuityEntry[]>>;
  commitCashContinuity(
    wallet: CashWallet | null,
    entries: readonly CashContinuityEntry[],
  ): Promise<StorageResult<{ wallet: CashWallet | null; entries: readonly CashContinuityEntry[] }>>;
  listMaterials(): Promise<StorageResult<readonly Material[]>>;
  listInventoryMovements(): Promise<StorageResult<readonly InventoryMovement[]>>;
  commitInventory(
    material: Material | null,
    movements: readonly InventoryMovement[],
  ): Promise<StorageResult<{ material: Material | null; movements: readonly InventoryMovement[] }>>;
  listCatalogItems(): Promise<StorageResult<readonly CatalogItem[]>>;
  getCatalogItem(id: string): Promise<StorageResult<CatalogItem | null>>;
  saveCatalogItem(item: CatalogItem): Promise<StorageResult<CatalogItem>>;
  listMeasurementUnits(): Promise<StorageResult<readonly MeasurementUnit[]>>;
  getMeasurementUnit(id: string): Promise<StorageResult<MeasurementUnit | null>>;
  saveMeasurementUnit(unit: MeasurementUnit): Promise<StorageResult<MeasurementUnit>>;
  listDirectConversions(): Promise<StorageResult<readonly DirectConversion[]>>;
  getDirectConversion(id: string): Promise<StorageResult<DirectConversion | null>>;
  saveDirectConversion(conversion: DirectConversion): Promise<StorageResult<DirectConversion>>;
  listCatalogTemplates(catalogItemId?: string): Promise<StorageResult<readonly CatalogTemplate[]>>;
  getCatalogTemplate(id: string): Promise<StorageResult<CatalogTemplate | null>>;
  commitCatalogTemplateRevision(
    previous: CatalogTemplate,
    next: CatalogTemplate,
  ): Promise<StorageResult<{ previous: CatalogTemplate; next: CatalogTemplate }>>;
  saveCatalogTemplate(template: CatalogTemplate): Promise<StorageResult<CatalogTemplate>>;
  listActualTimeRecords(): Promise<StorageResult<readonly ActualTimeRecord[]>>;
  listShortCashDeclarations(): Promise<StorageResult<readonly ShortCashDeclaration[]>>;
  getShortCashDeclaration(id: string): Promise<StorageResult<ShortCashDeclaration | null>>;
  saveShortCashDeclaration(declaration: ShortCashDeclaration): Promise<StorageResult<ShortCashDeclaration>>;
  commitShortCashDeclarationReversal(
    sourceId: string,
    reversal: ShortCashDeclaration,
  ): Promise<StorageResult<ShortCashDeclaration>>;
  listOwnerEntitlementPolicies(): Promise<StorageResult<readonly OwnerEntitlementPolicy[]>>;
  getOwnerEntitlementPolicy(id: string): Promise<StorageResult<OwnerEntitlementPolicy | null>>;
  saveOwnerEntitlementPolicy(policy: OwnerEntitlementPolicy): Promise<StorageResult<OwnerEntitlementPolicy>>;
  commitOwnerEntitlementPolicySuccessor(
    previous: OwnerEntitlementPolicy,
    successor: OwnerEntitlementPolicy,
  ): Promise<StorageResult<{ previous: OwnerEntitlementPolicy; successor: OwnerEntitlementPolicy }>>;
  listOwnerEntitlementRecords(): Promise<StorageResult<readonly OwnerEntitlementRecord[]>>;
  getOwnerEntitlementRecord(id: string): Promise<StorageResult<OwnerEntitlementRecord | null>>;
  saveOwnerEntitlementRecord(record: OwnerEntitlementRecord): Promise<StorageResult<OwnerEntitlementRecord>>;
  commitOwnerEntitlementRecordReversal(
    sourceId: string,
    reversal: OwnerEntitlementRecord,
  ): Promise<StorageResult<OwnerEntitlementRecord>>;
  listOwnerEntitlementOpeningBalances(): Promise<StorageResult<readonly OwnerEntitlementOpeningBalance[]>>;
  saveOwnerEntitlementOpeningBalance(
    balance: OwnerEntitlementOpeningBalance,
  ): Promise<StorageResult<OwnerEntitlementOpeningBalance>>;
  commitOwnerEntitlementOpeningBalanceReversal(
    sourceId: string,
    reversal: OwnerEntitlementOpeningBalance,
  ): Promise<StorageResult<OwnerEntitlementOpeningBalance>>;
  listOwnerMovements(): Promise<StorageResult<readonly OwnerMovement[]>>;
  getOwnerMovement(id: string): Promise<StorageResult<OwnerMovement | null>>;
  commitOwnerMovement(
    movement: OwnerMovement,
    cashEntry: CashContinuityEntry,
  ): Promise<StorageResult<{ movement: OwnerMovement; cashEntry: CashContinuityEntry }>>;
  getActualTimeRecord(id: string): Promise<StorageResult<ActualTimeRecord | null>>;
  saveActualTimeRecord(record: ActualTimeRecord): Promise<StorageResult<ActualTimeRecord>>;
  listAllocationPolicies(catalogItemId?: string): Promise<StorageResult<readonly AllocationPolicy[]>>;
  getAllocationPolicy(id: string): Promise<StorageResult<AllocationPolicy | null>>;
  saveAllocationPolicy(policy: AllocationPolicy): Promise<StorageResult<AllocationPolicy>>;
  commitAllocationPolicySuccessor(
    previous: AllocationPolicy,
    successor: AllocationPolicy,
  ): Promise<StorageResult<{ previous: AllocationPolicy; successor: AllocationPolicy }>>;
  commitOrderFromDraft(
    order: StoredCraftOrder,
    draft: OrderDraft,
    schedule?: ScheduleEntry,
  ): Promise<StorageResult<{ order: StoredCraftOrder; draft: OrderDraft; schedule: ScheduleEntry | null }>>;
  readSnapshot(): Promise<StorageResult<LocalStoreSnapshot>>;
  replaceSnapshot(snapshot: LocalStoreSnapshot): Promise<StorageResult<LocalStoreSnapshot>>;
}
