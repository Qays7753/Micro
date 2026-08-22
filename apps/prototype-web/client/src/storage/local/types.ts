/**
 * Micro architecture reminder: persistence records are local-only and separate
 * from Domain aggregates. Slice 1 stores setup and pre-domain drafts only.
 */
import type { CraftOrder } from "@micro-domain/craft-order/index.js";

export const localSchemaVersion = 5;
export const localProfileId = "local-profile";
export const localPreferencesId = "local-preferences";
export const localExportFormat = "micro-prototype-local-export";
export const localExportVersion = 1;

export type ActivityProfile = {
  id: typeof localProfileId;
  activityName: string;
  currency: "JOD";
  activityType: "custom_craft";
  createdAt: string;
  updatedAt: string;
};

export type LocalPreferences = {
  id: typeof localPreferencesId;
  theme: "light" | "dark" | "system";
  updatedAt: string;
};

export type DraftIntent = "customer_order" | "planned_design";

export type DraftCostMaterial = { name: string; quantity: number; unit: string; unitPriceMinor: number; confidence: "known" | "estimated" };
export type DraftCostTime = { minutes: number; hourlyRateMinor: number; confidence: "known" | "estimated" };
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
  specifications: string;
  quantity: number;
  costSnapshots: readonly DraftCostSnapshot[];
  activeCostSnapshotId: string | null;
  linkedOrderId: string | null;
  createdAt: string;
  updatedAt: string;
};

export type StoredCraftOrder = {
  id: string;
  order: CraftOrder;
  deliveryDate: string;
  agreementSource: string | null;
  createdAt: string;
  updatedAt: string;
};

export type LocalStoreSnapshot = {
  profile: ActivityProfile | null;
  preferences: LocalPreferences | null;
  drafts: readonly OrderDraft[];
  orders: readonly StoredCraftOrder[];
};

export type LocalExportFile = {
  format: typeof localExportFormat;
  version: typeof localExportVersion;
  schemaVersion: typeof localSchemaVersion;
  exportedAt: string;
  data: LocalStoreSnapshot;
};

export type StorageFailure = {
  ok: false;
  code: "storage_unavailable" | "storage_error";
  message: string;
};

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
  commitOrderFromDraft(order: StoredCraftOrder, draft: OrderDraft): Promise<StorageResult<{ order: StoredCraftOrder; draft: OrderDraft }>>;
  readSnapshot(): Promise<StorageResult<LocalStoreSnapshot>>;
  replaceSnapshot(snapshot: LocalStoreSnapshot): Promise<StorageResult<LocalStoreSnapshot>>;
}
