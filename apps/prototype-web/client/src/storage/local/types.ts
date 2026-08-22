/**
 * Micro architecture reminder: persistence records are local-only and separate
 * from Domain aggregates. Slice 1 stores setup and pre-domain drafts only.
 */
export const localSchemaVersion = 2;
export const localProfileId = "local-profile";

export type ActivityProfile = {
  id: typeof localProfileId;
  activityName: string;
  currency: "JOD";
  activityType: "custom_craft";
  createdAt: string;
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
  createdAt: string;
  updatedAt: string;
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
  listDrafts(): Promise<StorageResult<readonly OrderDraft[]>>;
  getDraft(id: string): Promise<StorageResult<OrderDraft | null>>;
  saveDraft(draft: OrderDraft): Promise<StorageResult<OrderDraft>>;
}
