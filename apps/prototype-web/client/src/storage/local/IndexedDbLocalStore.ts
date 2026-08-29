/** Browser persistence adapter. React never imports this module and financial policy lives above it. */
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
import {
  localSchemaVersion,
  type ActivityProfile,
  type LocalPreferences,
  type LocalStoreSnapshot,
  type OrderDraft,
  type PrototypeLocalStore,
  type ScheduleEntry,
  type ScheduleRecurrence,
  type StorageFailure,
  type StorageFailureCode,
  type StorageResult,
  type StoredCraftOrder,
} from "./types";

const databaseName = "micro-prototype-local";
const profileStore = "activity-profile";
const preferencesStore = "local-preferences";
const draftStore = "order-drafts";
const orderStore = "craft-orders";
const scheduleStore = "schedule-entries";
const recurrenceStore = "schedule-recurrences";
const financialEventStore = "financial-events";
const supplierPurchaseStore = "supplier-purchases";
const cashWalletStore = "cash-wallets";
const cashContinuityEntryStore = "cash-continuity-entries";
const materialStore = "materials";
const inventoryMovementStore = "inventory-movements";
const catalogItemStore = "catalog-items";
const measurementUnitStore = "measurement-units";
const directConversionStore = "direct-conversions";
const catalogTemplateStore = "catalog-templates";
const actualTimeStore = "actual-time-records";
const shortCashDeclarationStore = "short-cash-declarations";
const ownerEntitlementPolicyStore = "owner-entitlement-policies";
const ownerEntitlementRecordStore = "owner-entitlement-records";
const ownerEntitlementOpeningBalanceStore = "owner-entitlement-opening-balances";
const ownerMovementStore = "owner-movements";
const allocationPolicyStore = "allocation-policies";

class StorageOpenError extends Error {
  constructor(
    readonly code: Extract<
      StorageFailureCode,
      "storage_upgrade_failed" | "storage_blocked" | "storage_stale"
    >,
    message: string,
  ) {
    super(message);
    this.name = "StorageOpenError";
  }
}

const staleConnections = new WeakSet<IDBDatabase>();
const upgradeErrors = new WeakMap<IDBOpenDBRequest, StorageOpenError>();

function failure(error: unknown, database?: IDBDatabase): StorageFailure {
  if (database && staleConnections.has(database)) {
    return {
      ok: false,
      code: "storage_stale",
      message: "هذه النسخة قديمة. أعد تحميل Micro قبل إدخال بيانات جديدة.",
    };
  }
  if (error instanceof StorageOpenError) return { ok: false, code: error.code, message: error.message };
  return {
    ok: false,
    code: typeof indexedDB === "undefined" ? "storage_unavailable" : "storage_error",
    message: error instanceof Error ? error.message : "تعذر الوصول إلى التخزين المحلي.",
  };
}

function guardUpgradeCursor(
  cursor: IDBRequest<IDBCursorWithValue | null>,
  request: IDBOpenDBRequest,
  label: string,
): IDBRequest<IDBCursorWithValue | null> {
  cursor.onerror = () => {
    let cause = "سبب غير معروف";
    try {
      const cursorError = cursor.error;
      if (cursorError) cause = cursorError.message;
    } catch {
      // Some test doubles expose the error only while the request is active.
    }
    upgradeErrors.set(
      request,
      new StorageOpenError(
        "storage_upgrade_failed",
        `تعذر ترقية التخزين المحلي أثناء ترحيل ${label}: ${cause}. أغلق النسخ الأخرى ثم أعد المحاولة.`,
      ),
    );
    try {
      request.transaction?.abort();
    } catch {
      // The upgrade transaction may already be aborting.
    }
  };
  return cursor;
}

function attachVersionChangeRecovery(database: IDBDatabase): IDBDatabase {
  database.onversionchange = () => {
    staleConnections.add(database);
    database.close();
  };
  return database;
}

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") {
      reject(new Error("التخزين المحلي غير مدعوم في هذا المتصفح."));
      return;
    }
    const request = indexedDB.open(databaseName, localSchemaVersion);
    request.onerror = () =>
      reject(upgradeErrors.get(request) ?? request.error ?? new Error("تعذر فتح التخزين المحلي."));
    request.onblocked = () =>
      reject(
        new StorageOpenError(
          "storage_blocked",
          "Micro مفتوح في نافذة أخرى. أغلق النوافذ الأخرى ثم أعد المحاولة.",
        ),
      );
    request.onupgradeneeded = event => {
      const database = request.result;
      if (!database.objectStoreNames.contains(profileStore))
        database.createObjectStore(profileStore, { keyPath: "id" });
      if (!database.objectStoreNames.contains(preferencesStore))
        database.createObjectStore(preferencesStore, { keyPath: "id" });
      if (!database.objectStoreNames.contains(draftStore)) {
        const drafts = database.createObjectStore(draftStore, { keyPath: "id" });
        drafts.createIndex("updatedAt", "updatedAt");
      }
      if (!database.objectStoreNames.contains(orderStore)) {
        const orders = database.createObjectStore(orderStore, { keyPath: "id" });
        orders.createIndex("updatedAt", "updatedAt");
      }
      if (!database.objectStoreNames.contains(scheduleStore)) {
        const schedules = database.createObjectStore(scheduleStore, { keyPath: "id" });
        schedules.createIndex("scheduledFor", "scheduledFor");
        schedules.createIndex("orderId", "orderId");
      }
      if (!database.objectStoreNames.contains(recurrenceStore)) {
        const recurrences = database.createObjectStore(recurrenceStore, { keyPath: "id" });
        recurrences.createIndex("sourceScheduleId", "sourceScheduleId");
        recurrences.createIndex("orderId", "orderId");
        recurrences.createIndex("status", "status");
        recurrences.createIndex("createdAt", "createdAt");
      }
      if (!database.objectStoreNames.contains(financialEventStore)) {
        const events = database.createObjectStore(financialEventStore, { keyPath: "id" });
        events.createIndex("recordedAt", "recordedAt");
        events.createIndex("occurredOn", "occurredOn");
      }
      if (!database.objectStoreNames.contains(supplierPurchaseStore)) {
        const purchases = database.createObjectStore(supplierPurchaseStore, { keyPath: "id" });
        purchases.createIndex("purchasedOn", "purchasedOn");
        purchases.createIndex("supplierName", "supplierName");
      }
      if (!database.objectStoreNames.contains(cashWalletStore))
        database.createObjectStore(cashWalletStore, { keyPath: "id" });
      if (!database.objectStoreNames.contains(cashContinuityEntryStore)) {
        const entries = database.createObjectStore(cashContinuityEntryStore, { keyPath: "id" });
        entries.createIndex("walletId", "walletId");
        entries.createIndex("occurredOn", "occurredOn");
        entries.createIndex("operationKey", "operationKey");
        entries.createIndex("transferId", "transferId");
      }
      if (!database.objectStoreNames.contains(materialStore))
        database.createObjectStore(materialStore, { keyPath: "id" });
      if (!database.objectStoreNames.contains(inventoryMovementStore)) {
        const movements = database.createObjectStore(inventoryMovementStore, { keyPath: "id" });
        movements.createIndex("materialId", "materialId");
        movements.createIndex("occurredOn", "occurredOn");
        movements.createIndex("operationKey", "operationKey");
        movements.createIndex("purchaseId", "purchaseId");
        movements.createIndex("orderId", "orderId");
      }
      if (!database.objectStoreNames.contains(catalogItemStore)) {
        const catalogItems = database.createObjectStore(catalogItemStore, { keyPath: "id" });
        catalogItems.createIndex("active", "active");
        catalogItems.createIndex("createdOperationKey", "createdOperationKey");
      }
      if (!database.objectStoreNames.contains(measurementUnitStore)) {
        const units = database.createObjectStore(measurementUnitStore, { keyPath: "id" });
        units.createIndex("dimension", "dimension");
        units.createIndex("active", "active");
        units.createIndex("createdOperationKey", "createdOperationKey");
      }
      if (!database.objectStoreNames.contains(directConversionStore)) {
        const conversions = database.createObjectStore(directConversionStore, { keyPath: "id" });
        conversions.createIndex("fromUnitId", "fromUnitId");
        conversions.createIndex("toUnitId", "toUnitId");
        conversions.createIndex("active", "active");
        conversions.createIndex("createdOperationKey", "createdOperationKey");
      }
      if (!database.objectStoreNames.contains(catalogTemplateStore)) {
        const templates = database.createObjectStore(catalogTemplateStore, { keyPath: "id" });
        templates.createIndex("catalogItemId", "catalogItemId");
        templates.createIndex("active", "active");
        templates.createIndex("createdOperationKey", "createdOperationKey");
      }
      if (!database.objectStoreNames.contains(actualTimeStore)) {
        const records = database.createObjectStore(actualTimeStore, { keyPath: "id" });
        records.createIndex("orderId", "orderId");
        records.createIndex("recordedOn", "recordedOn");
        records.createIndex("operationKey", "operationKey");
        records.createIndex("reversalOfId", "reversalOfId");
      }
      if (!database.objectStoreNames.contains(shortCashDeclarationStore)) {
        const declarations = database.createObjectStore(shortCashDeclarationStore, { keyPath: "id" });
        declarations.createIndex("dueOn", "dueOn");
        declarations.createIndex("createdAt", "createdAt");
        declarations.createIndex("idempotencyKey", "idempotencyKey");
        declarations.createIndex("reversalOfId", "reversalOfId");
      }
      if (!database.objectStoreNames.contains(ownerEntitlementPolicyStore)) {
        const policies = database.createObjectStore(ownerEntitlementPolicyStore, { keyPath: "id" });
        policies.createIndex("startsOn", "startsOn");
        policies.createIndex("status", "status");
        policies.createIndex("idempotencyKey", "idempotencyKey");
      }
      if (!database.objectStoreNames.contains(ownerEntitlementRecordStore)) {
        const records = database.createObjectStore(ownerEntitlementRecordStore, { keyPath: "id" });
        records.createIndex("occurredOn", "occurredOn");
        records.createIndex("policyId", "policyId");
        records.createIndex("idempotencyKey", "idempotencyKey");
      }
      if (!database.objectStoreNames.contains(ownerEntitlementOpeningBalanceStore)) {
        const balances = database.createObjectStore(ownerEntitlementOpeningBalanceStore, { keyPath: "id" });
        balances.createIndex("occurredOn", "occurredOn");
        balances.createIndex("idempotencyKey", "idempotencyKey");
      }
      if (!database.objectStoreNames.contains(ownerMovementStore)) {
        const movements = database.createObjectStore(ownerMovementStore, { keyPath: "id" });
        movements.createIndex("occurredOn", "occurredOn");
        movements.createIndex("walletId", "walletId");
        movements.createIndex("idempotencyKey", "idempotencyKey");
        movements.createIndex("relatedEntitlementId", "relatedEntitlementId");
        movements.createIndex("relatedMovementId", "relatedMovementId");
        movements.createIndex("reversalOfId", "reversalOfId");
      }
      if (!database.objectStoreNames.contains(allocationPolicyStore)) {
        const policies = database.createObjectStore(allocationPolicyStore, { keyPath: "id" });
        policies.createIndex("catalogItemId", "catalogItemId");
        policies.createIndex("startsOn", "startsOn");
        policies.createIndex("status", "status");
        policies.createIndex("idempotencyKey", "idempotencyKey");
        policies.createIndex("seriesId", "seriesId");
      }
      const policyStore = request.transaction?.objectStore(ownerEntitlementPolicyStore);
      if (policyStore && !policyStore.indexNames.contains("seriesId"))
        policyStore.createIndex("seriesId", "seriesId");
      if (policyStore && !policyStore.indexNames.contains("successorOfPolicyId"))
        policyStore.createIndex("successorOfPolicyId", "successorOfPolicyId");
      const recordStore = request.transaction?.objectStore(ownerEntitlementRecordStore);
      if (recordStore && !recordStore.indexNames.contains("reversalOfId"))
        recordStore.createIndex("reversalOfId", "reversalOfId");
      const openingStore = request.transaction?.objectStore(ownerEntitlementOpeningBalanceStore);
      if (openingStore && !openingStore.indexNames.contains("reversalOfId"))
        openingStore.createIndex("reversalOfId", "reversalOfId");
      const movementStore = request.transaction?.objectStore(ownerMovementStore);
      if (movementStore && !movementStore.indexNames.contains("relatedOpeningBalanceId"))
        movementStore.createIndex("relatedOpeningBalanceId", "relatedOpeningBalanceId");
      if (event.oldVersion < 23) {
        if (policyStore) {
          const cursor = guardUpgradeCursor(policyStore.openCursor(), request, "سياسات حق المالك");
          cursor.onsuccess = () => {
            const current = cursor.result;
            if (!current) return;
            const value = current.value as Record<string, unknown>;
            current.update({
              ...value,
              seriesId: typeof value.seriesId === "string" && value.seriesId ? value.seriesId : value.id,
              successorOfPolicyId:
                typeof value.successorOfPolicyId === "string" ? value.successorOfPolicyId : null,
            });
            current.continue();
          };
        }
        if (recordStore) {
          const cursor = guardUpgradeCursor(recordStore.openCursor(), request, "سجلات حق المالك");
          cursor.onsuccess = () => {
            const current = cursor.result;
            if (!current) return;
            const value = current.value as Record<string, unknown>;
            current.update({
              ...value,
              sourceKeys:
                Array.isArray(value.sourceKeys) && value.sourceKeys.length > 0
                  ? value.sourceKeys
                  : [`legacy:record:${value.id}`],
              reversalOfId: typeof value.reversalOfId === "string" ? value.reversalOfId : null,
              reversalReason: typeof value.reversalReason === "string" ? value.reversalReason : null,
            });
            current.continue();
          };
        }
        if (openingStore) {
          const cursor = guardUpgradeCursor(
            openingStore.openCursor(),
            request,
            "أرصدة افتتاح حق المالك",
          );
          cursor.onsuccess = () => {
            const current = cursor.result;
            if (!current) return;
            const value = current.value as Record<string, unknown>;
            current.update({
              ...value,
              reversalOfId: typeof value.reversalOfId === "string" ? value.reversalOfId : null,
              reversalReason: typeof value.reversalReason === "string" ? value.reversalReason : null,
            });
            current.continue();
          };
        }
        if (movementStore) {
          const cursor = guardUpgradeCursor(movementStore.openCursor(), request, "حركات المالك");
          cursor.onsuccess = () => {
            const current = cursor.result;
            if (!current) return;
            const value = current.value as Record<string, unknown>;
            current.update({
              ...value,
              relatedOpeningBalanceId:
                typeof value.relatedOpeningBalanceId === "string" ? value.relatedOpeningBalanceId : null,
              openingBalanceDeltaMinor:
                typeof value.openingBalanceDeltaMinor === "number" ? value.openingBalanceDeltaMinor : 0,
              reversalOfId: typeof value.reversalOfId === "string" ? value.reversalOfId : null,
              reversalReason: typeof value.reversalReason === "string" ? value.reversalReason : null,
            });
            current.continue();
          };
        }
      }
      if (event.oldVersion < 25) {
        const movements = request.transaction?.objectStore(inventoryMovementStore);
        if (movements) {
          const cursor = guardUpgradeCursor(movements.openCursor(), request, "حركات المخزون");
          cursor.onsuccess = () => {
            const current = cursor.result;
            if (!current) return;
            const legacy = current.value as Record<string, unknown>;
            current.update({
              ...legacy,
              wasteContext:
                legacy.type === "waste" ? (legacy.wasteContext ?? { kind: "general_project" }) : null,
            });
            current.continue();
          };
        }
      }
      if (event.oldVersion < 26) {
        const allocationPolicies = request.transaction?.objectStore(allocationPolicyStore);
        if (allocationPolicies) {
          const cursor = guardUpgradeCursor(allocationPolicies.openCursor(), request, "سياسات التوزيع");
          cursor.onsuccess = () => {
            const current = cursor.result;
            if (!current) return;
            const legacy = current.value as Record<string, unknown>;
            const isPerOutputUnit = legacy.kind === "per_output_unit";
            current.update({
              ...legacy,
              rateMinorPerWholeUnit: isPerOutputUnit
                ? typeof legacy.rateMinorPerWholeUnit === "number"
                  ? legacy.rateMinorPerWholeUnit
                  : typeof legacy.rateMinor === "number"
                    ? legacy.rateMinor
                    : null
                : null,
              rateMinor: isPerOutputUnit
                ? null
                : typeof legacy.rateMinor === "number"
                  ? legacy.rateMinor
                  : null,
            });
            current.continue();
          };
        }
      }
      if (event.oldVersion < 24) {
        const catalogItems = request.transaction?.objectStore(catalogItemStore);
        if (catalogItems) {
          const cursor = guardUpgradeCursor(catalogItems.openCursor(), request, "عناصر الكتالوج");
          cursor.onsuccess = () => {
            const current = cursor.result;
            if (!current) return;
            const legacy = current.value as Record<string, unknown>;
            current.update({
              ...legacy,
              unitId: typeof legacy.unitId === "string" && legacy.unitId ? legacy.unitId : null,
            });
            current.continue();
          };
        }
      }
      if (event.oldVersion < 4 || event.oldVersion < 17) {
        const drafts = request.transaction?.objectStore(draftStore);
        if (drafts) {
          const cursor = guardUpgradeCursor(drafts.openCursor(), request, "المسودات");
          cursor.onsuccess = () => {
            const current = cursor.result;
            if (!current) return;
            const legacy = current.value as Partial<OrderDraft>;
            current.update({
              ...legacy,
              ...(event.oldVersion < 4
                ? {
                    costSnapshots: Array.isArray(legacy.costSnapshots) ? legacy.costSnapshots : [],
                    activeCostSnapshotId: legacy.activeCostSnapshotId ?? null,
                    linkedOrderId: legacy.linkedOrderId ?? null,
                  }
                : {}),
              ...(event.oldVersion < 17 ? { catalogItemId: legacy.catalogItemId ?? null } : {}),
            });
            current.continue();
          };
        }
      }
      if (event.oldVersion < 8) {
        const transaction = request.transaction;
        const schedules = transaction?.objectStore(scheduleStore);
        if (schedules) {
          const cursor = guardUpgradeCursor(schedules.openCursor(), request, "المواعيد");
          cursor.onsuccess = () => {
            const current = cursor.result;
            if (!current) return;
            const legacy = current.value as Partial<ScheduleEntry>;
            current.update({
              ...legacy,
              scheduledTime: legacy.scheduledTime ?? null,
              durationMinutes: legacy.durationMinutes ?? null,
              events: Array.isArray(legacy.events)
                ? legacy.events.map(entry => ({
                    ...entry,
                    previousScheduledTime: entry.previousScheduledTime ?? null,
                    scheduledTime: entry.scheduledTime ?? null,
                    previousDurationMinutes: entry.previousDurationMinutes ?? null,
                    durationMinutes: entry.durationMinutes ?? null,
                  }))
                : [],
            });
            current.continue();
          };
        }
      }
      if (event.oldVersion < 17) {
        const orders = request.transaction?.objectStore(orderStore);
        if (orders) {
          const cursor = guardUpgradeCursor(orders.openCursor(), request, "الطلبات");
          cursor.onsuccess = () => {
            const current = cursor.result;
            if (!current) return;
            current.update({ ...current.value, catalogItemId: current.value.catalogItemId ?? null });
            current.continue();
          };
        }
      }
      if (event.oldVersion < 20) {
        const schedules = request.transaction?.objectStore(scheduleStore);
        if (schedules) {
          const cursor = guardUpgradeCursor(schedules.openCursor(), request, "المواعيد");
          cursor.onsuccess = () => {
            const current = cursor.result;
            if (!current) return;
            current.update({
              ...current.value,
              scheduledTime: current.value.scheduledTime ?? null,
              durationMinutes: current.value.durationMinutes ?? null,
              events: Array.isArray(current.value.events)
                ? current.value.events.map((entry: Record<string, unknown>) => ({
                    ...entry,
                    previousScheduledTime: entry.previousScheduledTime ?? null,
                    scheduledTime: entry.scheduledTime ?? null,
                    previousDurationMinutes: entry.previousDurationMinutes ?? null,
                    durationMinutes: entry.durationMinutes ?? null,
                  }))
                : [],
              recurrenceId: current.value.recurrenceId ?? null,
              recurrenceIndex: current.value.recurrenceIndex ?? null,
            });
            current.continue();
          };
        }
        const orders = request.transaction?.objectStore(orderStore);
        if (orders) {
          const cursor = guardUpgradeCursor(orders.openCursor(), request, "الطلبات");
          cursor.onsuccess = () => {
            const current = cursor.result;
            if (!current) return;
            current.update({
              ...current.value,
              catalogItemId: current.value.catalogItemId ?? null,
              followUpSummary: current.value.followUpSummary ?? null,
              followUpDate: current.value.followUpDate ?? null,
              followUpReason: current.value.followUpReason ?? null,
              followUpEvents: Array.isArray(current.value.followUpEvents) ? current.value.followUpEvents : [],
            });
            current.continue();
          };
        }
      }
      if (event.oldVersion < 8 || event.oldVersion < 18) {
        const preferences = request.transaction?.objectStore(preferencesStore);
        if (preferences) {
          const cursor = guardUpgradeCursor(preferences.openCursor(), request, "التفضيلات");
          cursor.onsuccess = () => {
            const current = cursor.result;
            if (!current) return;
            current.update({
              ...current.value,
              ...(event.oldVersion < 8
                ? { dailyScheduleCapacityMinutes: current.value.dailyScheduleCapacityMinutes ?? null }
                : {}),
              ...(event.oldVersion < 18
                ? {
                    workMode: current.value.workMode ?? null,
                    actualTimeTrackingEnabled: current.value.actualTimeTrackingEnabled ?? false,
                  }
                : {}),
            });
            current.continue();
          };
        }
      }
    };
    request.onsuccess = () => resolve(attachVersionChangeRecovery(request.result));
  });
}

/** @internal Test seam for exercising the adapter’s versionchange recovery with fake-indexeddb. */
export function __openDatabaseForTesting(): Promise<IDBDatabase> {
  return openDatabase();
}

async function readOne<T>(storeName: string, key: string): Promise<StorageResult<T | null>> {
  try {
    const database = await openDatabase();
    return await new Promise(resolve => {
      const transaction = database.transaction(storeName, "readonly");
      const request = transaction.objectStore(storeName).get(key);
      request.onerror = () => resolve(failure(request.error, database));
      request.onsuccess = () => resolve({ ok: true, value: (request.result as T | undefined) ?? null });
      transaction.oncomplete = () => database.close();
    });
  } catch (error) {
    return failure(error);
  }
}

async function writeOne<T>(storeName: string, value: T): Promise<StorageResult<T>> {
  try {
    const database = await openDatabase();
    return await new Promise(resolve => {
      const transaction = database.transaction(storeName, "readwrite");
      const request = transaction.objectStore(storeName).put(value);
      request.onerror = () => resolve(failure(request.error, database));
      transaction.onabort = () => resolve(failure(transaction.error, database));
      transaction.oncomplete = () => {
        database.close();
        resolve({ ok: true, value });
      };
    });
  } catch (error) {
    return failure(error);
  }
}

async function listAll<T>(
  storeName: string,
  sort: (left: T, right: T) => number,
): Promise<StorageResult<readonly T[]>> {
  try {
    const database = await openDatabase();
    return await new Promise(resolve => {
      const transaction = database.transaction(storeName, "readonly");
      const request = transaction.objectStore(storeName).getAll();
      request.onerror = () => resolve(failure(request.error, database));
      request.onsuccess = () => resolve({ ok: true, value: (request.result as T[]).sort(sort) });
      transaction.oncomplete = () => database.close();
    });
  } catch (error) {
    return failure(error);
  }
}

export class IndexedDbLocalStore implements PrototypeLocalStore {
  getProfile() {
    return readOne<ActivityProfile>(profileStore, "local-profile");
  }
  saveProfile(profile: ActivityProfile) {
    return writeOne(profileStore, profile);
  }
  getPreferences() {
    return readOne<LocalPreferences>(preferencesStore, "local-preferences");
  }
  savePreferences(preferences: LocalPreferences) {
    return writeOne(preferencesStore, preferences);
  }
  listDrafts() {
    return listAll<OrderDraft>(draftStore, (left, right) => right.updatedAt.localeCompare(left.updatedAt));
  }
  getDraft(id: string) {
    return readOne<OrderDraft>(draftStore, id);
  }
  saveDraft(draft: OrderDraft) {
    return writeOne(draftStore, draft);
  }
  listOrders() {
    return listAll<StoredCraftOrder>(orderStore, (left, right) =>
      right.updatedAt.localeCompare(left.updatedAt),
    );
  }
  getOrder(id: string) {
    return readOne<StoredCraftOrder>(orderStore, id);
  }
  saveOrder(order: StoredCraftOrder) {
    return writeOne(orderStore, order);
  }
  listSchedules() {
    return listAll<ScheduleEntry>(
      scheduleStore,
      (left, right) =>
        left.scheduledFor.localeCompare(right.scheduledFor) || right.updatedAt.localeCompare(left.updatedAt),
    );
  }
  getSchedule(id: string) {
    return readOne<ScheduleEntry>(scheduleStore, id);
  }
  saveSchedule(schedule: ScheduleEntry) {
    return writeOne(scheduleStore, schedule);
  }
  listRecurrences() {
    return listAll<ScheduleRecurrence>(recurrenceStore, (left, right) =>
      left.createdAt.localeCompare(right.createdAt),
    );
  }
  getRecurrence(id: string) {
    return readOne<ScheduleRecurrence>(recurrenceStore, id);
  }
  saveRecurrence(recurrence: ScheduleRecurrence) {
    return writeOne(recurrenceStore, recurrence);
  }
  async commitRecurrence(
    recurrence: ScheduleRecurrence,
    schedules: readonly ScheduleEntry[],
  ): Promise<StorageResult<{ recurrence: ScheduleRecurrence; schedules: readonly ScheduleEntry[] }>> {
    try {
      const database = await openDatabase();
      return await new Promise(resolve => {
        const transaction = database.transaction([recurrenceStore, scheduleStore], "readwrite");
        transaction.objectStore(recurrenceStore).put(recurrence);
        schedules.forEach(schedule => transaction.objectStore(scheduleStore).put(schedule));
        transaction.onabort = () => resolve(failure(transaction.error, database));
        transaction.onerror = () => resolve(failure(transaction.error, database));
        transaction.oncomplete = () => {
          database.close();
          resolve({ ok: true, value: { recurrence, schedules } });
        };
      });
    } catch (error) {
      return failure(error);
    }
  }
  listFinancialEvents() {
    return listAll<FinancialEvent>(financialEventStore, (left, right) =>
      right.recordedAt.localeCompare(left.recordedAt),
    );
  }
  getFinancialEvent(id: string) {
    return readOne<FinancialEvent>(financialEventStore, id);
  }
  saveFinancialEvent(event: FinancialEvent) {
    return writeOne(financialEventStore, event);
  }
  async commitFinancialEventCorrection(
    sourceEventId: string,
    reversal: FinancialEvent,
  ): Promise<StorageResult<FinancialEvent>> {
    try {
      const database = await openDatabase();
      return await new Promise(resolve => {
        const transaction = database.transaction(financialEventStore, "readwrite");
        const store = transaction.objectStore(financialEventStore);
        let settled = false;
        let pendingAbortResult: StorageResult<FinancialEvent> | null = null;
        const finish = (result: StorageResult<FinancialEvent>) => {
          if (settled) return;
          settled = true;
          database.close();
          resolve(result);
        };
        const abortWith = (result: StorageResult<FinancialEvent>) => {
          pendingAbortResult = result;
          try {
            transaction.abort();
          } catch {
            finish(result);
          }
        };
        const request = store.getAll();
        request.onerror = () => abortWith(failure(request.error, database));
        request.onsuccess = () => {
          const events = request.result as FinancialEvent[];
          const source = events.find(event => event.id === sourceEventId);
          if (!source) {
            abortWith({
              ok: false,
              code: "storage_error",
              message: "لم يعد الحدث المصدر موجودًا؛ لم يُحفظ التراجع.",
            });
            return;
          }
          if (source.correctionType === "reverse" || source.correctionOfEventId) {
            abortWith({ ok: false, code: "storage_error", message: "لا يمكن التراجع عن واقعة تراجع سابقة." });
            return;
          }
          const existing = events.find(
            event => event.correctionOfEventId === sourceEventId && event.correctionType === "reverse",
          );
          if (existing) {
            abortWith(
              existing.idempotencyKey === reversal.idempotencyKey
                ? { ok: true, value: existing }
                : {
                    ok: false,
                    code: "storage_error",
                    message: "تعذر حفظ التراجع لأن الواقعة تم التراجع عنها سابقًا بمفتاح مختلف.",
                  },
            );
            return;
          }
          if (events.some(event => event.id === reversal.id)) {
            abortWith({ ok: false, code: "storage_error", message: "تعذر حفظ التراجع بسبب تعارض هوية محلية." });
            return;
          }
          if (
            reversal.correctionType !== "reverse" ||
            reversal.correctionOfEventId !== source.id ||
            reversal.type !== source.type ||
            reversal.amountMinor !== source.amountMinor ||
            reversal.relatedEventId !== source.relatedEventId ||
            reversal.cashDeltaMinor !== -source.cashDeltaMinor ||
            reversal.payableDeltaMinor !== -source.payableDeltaMinor ||
            reversal.ownerCapitalDeltaMinor !== -source.ownerCapitalDeltaMinor ||
            reversal.operatingExpenseDeltaMinor !== -source.operatingExpenseDeltaMinor
          ) {
            abortWith({
              ok: false,
              code: "storage_error",
              message: "بيانات التراجع لا تطابق الواقعة الأصلية؛ لم يتغير السجل.",
            });
            return;
          }
          store.put(reversal);
        };
        transaction.onerror = () => {
          if (!pendingAbortResult) pendingAbortResult = failure(transaction.error, database);
        };
        transaction.onabort = () => finish(pendingAbortResult ?? failure(transaction.error, database));
        transaction.oncomplete = () => finish({ ok: true, value: reversal });
      });
    } catch (error) {
      return failure(error);
    }
  }
  listSupplierPurchases() {
    return listAll<SupplierPurchase>(
      supplierPurchaseStore,
      (left, right) =>
        right.purchasedOn.localeCompare(left.purchasedOn) || right.updatedAt.localeCompare(left.updatedAt),
    );
  }
  getSupplierPurchase(id: string) {
    return readOne<SupplierPurchase>(supplierPurchaseStore, id);
  }
  saveSupplierPurchase(purchase: SupplierPurchase) {
    return writeOne(supplierPurchaseStore, purchase);
  }
  listCashWallets() {
    return listAll<CashWallet>(cashWalletStore, (left, right) =>
      left.createdAt.localeCompare(right.createdAt),
    );
  }
  listCashContinuityEntries() {
    return listAll<CashContinuityEntry>(
      cashContinuityEntryStore,
      (left, right) =>
        left.occurredOn.localeCompare(right.occurredOn) || left.recordedAt.localeCompare(right.recordedAt),
    );
  }
  async commitCashContinuity(
    wallet: CashWallet | null,
    entries: readonly CashContinuityEntry[],
  ): Promise<StorageResult<{ wallet: CashWallet | null; entries: readonly CashContinuityEntry[] }>> {
    try {
      const database = await openDatabase();
      return await new Promise(resolve => {
        const transaction = database.transaction([cashWalletStore, cashContinuityEntryStore], "readwrite");
        if (wallet) transaction.objectStore(cashWalletStore).put(wallet);
        entries.forEach(entry => transaction.objectStore(cashContinuityEntryStore).put(entry));
        transaction.onerror = () => resolve(failure(transaction.error, database));
        transaction.onabort = () => resolve(failure(transaction.error, database));
        transaction.oncomplete = () => {
          database.close();
          resolve({ ok: true, value: { wallet, entries } });
        };
      });
    } catch (error) {
      return failure(error);
    }
  }
  listMaterials() {
    return listAll<Material>(materialStore, (left, right) => left.createdAt.localeCompare(right.createdAt));
  }
  listInventoryMovements() {
    return listAll<InventoryMovement>(
      inventoryMovementStore,
      (left, right) =>
        right.occurredOn.localeCompare(left.occurredOn) || right.recordedAt.localeCompare(left.recordedAt),
    );
  }
  async commitInventory(
    material: Material | null,
    movements: readonly InventoryMovement[],
  ): Promise<StorageResult<{ material: Material | null; movements: readonly InventoryMovement[] }>> {
    try {
      const database = await openDatabase();
      return await new Promise(resolve => {
        const transaction = database.transaction([materialStore, inventoryMovementStore], "readwrite");
        if (material) transaction.objectStore(materialStore).put(material);
        movements.forEach(movement => transaction.objectStore(inventoryMovementStore).put(movement));
        transaction.onerror = () => resolve(failure(transaction.error, database));
        transaction.onabort = () => resolve(failure(transaction.error, database));
        transaction.oncomplete = () => {
          database.close();
          resolve({ ok: true, value: { material, movements } });
        };
      });
    } catch (error) {
      return failure(error);
    }
  }
  listCatalogItems() {
    return listAll<CatalogItem>(
      catalogItemStore,
      (left, right) => left.name.localeCompare(right.name) || left.createdAt.localeCompare(right.createdAt),
    );
  }
  getCatalogItem(id: string) {
    return readOne<CatalogItem>(catalogItemStore, id);
  }
  saveCatalogItem(item: CatalogItem) {
    return writeOne(catalogItemStore, item);
  }
  listMeasurementUnits() {
    return listAll<MeasurementUnit>(measurementUnitStore, (left, right) =>
      left.nameAr.localeCompare(right.nameAr),
    );
  }
  getMeasurementUnit(id: string) {
    return readOne<MeasurementUnit>(measurementUnitStore, id);
  }
  saveMeasurementUnit(unit: MeasurementUnit) {
    return writeOne(measurementUnitStore, unit);
  }
  listDirectConversions() {
    return listAll<DirectConversion>(directConversionStore, (left, right) =>
      left.createdAt.localeCompare(right.createdAt),
    );
  }
  getDirectConversion(id: string) {
    return readOne<DirectConversion>(directConversionStore, id);
  }
  saveDirectConversion(conversion: DirectConversion) {
    return writeOne(directConversionStore, conversion);
  }
  async listCatalogTemplates(catalogItemId?: string): Promise<StorageResult<readonly CatalogTemplate[]>> {
    const result = await listAll<CatalogTemplate>(
      catalogTemplateStore,
      (left, right) =>
        left.catalogItemId.localeCompare(right.catalogItemId) || right.revision - left.revision,
    );
    return result.ok
      ? {
          ok: true,
          value: result.value.filter(template => !catalogItemId || template.catalogItemId === catalogItemId),
        }
      : result;
  }
  getCatalogTemplate(id: string) {
    return readOne<CatalogTemplate>(catalogTemplateStore, id);
  }
  saveCatalogTemplate(template: CatalogTemplate) {
    return writeOne(catalogTemplateStore, template);
  }
  async commitCatalogTemplateRevision(
    previous: CatalogTemplate,
    next: CatalogTemplate,
  ): Promise<StorageResult<{ previous: CatalogTemplate; next: CatalogTemplate }>> {
    try {
      const database = await openDatabase();
      return await new Promise(resolve => {
        const transaction = database.transaction(catalogTemplateStore, "readwrite");
        const store = transaction.objectStore(catalogTemplateStore);
        let pending: StorageResult<{ previous: CatalogTemplate; next: CatalogTemplate }> | null = null;
        const finish = (result: StorageResult<{ previous: CatalogTemplate; next: CatalogTemplate }>) => {
          database.close();
          resolve(result);
        };
        const request = store.getAll();
        request.onerror = () => {
          pending = failure(request.error, database);
          try {
            transaction.abort();
          } catch {
            if (pending) finish(pending);
          }
        };
        request.onsuccess = () => {
          const templates = request.result as CatalogTemplate[];
          const current = templates.find(template => template.id === previous.id);
          const repeated = templates.find(
            template => template.createdOperationKey === next.createdOperationKey,
          );
          if (repeated) {
            pending = { ok: true, value: { previous: current ?? previous, next: repeated } };
            try {
              transaction.abort();
            } catch {
              if (pending) finish(pending);
            }
            return;
          }
          if (!current || !current.active) {
            pending = {
              ok: false,
              code: "storage_error",
              message: "لم يعد القالب السابق فعالًا؛ لم تُحفظ المراجعة.",
            };
            try {
              transaction.abort();
            } catch {
              if (pending) finish(pending);
            }
            return;
          }
          if (templates.some(template => template.id === next.id)) {
            pending = {
              ok: false,
              code: "storage_error",
              message: "تعارض هوية مراجعة القالب؛ لم تتغير البيانات.",
            };
            try {
              transaction.abort();
            } catch {
              if (pending) finish(pending);
            }
            return;
          }
          store.put(previous);
          store.put(next);
        };
        transaction.onerror = () => {
          if (!pending) pending = failure(transaction.error, database);
        };
        transaction.onabort = () => finish(pending ?? failure(transaction.error, database));
        transaction.oncomplete = () => finish({ ok: true, value: { previous, next } });
      });
    } catch (error) {
      return failure(error);
    }
  }
  listActualTimeRecords() {
    return listAll<ActualTimeRecord>(
      actualTimeStore,
      (left, right) =>
        right.recordedOn.localeCompare(left.recordedOn) || right.createdAt.localeCompare(left.createdAt),
    );
  }
  getActualTimeRecord(id: string) {
    return readOne<ActualTimeRecord>(actualTimeStore, id);
  }
  saveActualTimeRecord(record: ActualTimeRecord) {
    return writeOne(actualTimeStore, record);
  }
  listShortCashDeclarations() {
    return listAll<ShortCashDeclaration>(shortCashDeclarationStore, (left, right) =>
      right.createdAt.localeCompare(left.createdAt),
    );
  }
  async listAllocationPolicies(catalogItemId?: string): Promise<StorageResult<readonly AllocationPolicy[]>> {
    const result = await listAll<AllocationPolicy>(
      allocationPolicyStore,
      (left, right) => right.startsOn.localeCompare(left.startsOn) || right.version - left.version,
    );
    return result.ok
      ? {
          ok: true,
          value: result.value.filter(policy => !catalogItemId || policy.catalogItemId === catalogItemId),
        }
      : result;
  }
  getAllocationPolicy(id: string) {
    return readOne<AllocationPolicy>(allocationPolicyStore, id);
  }
  saveAllocationPolicy(policy: AllocationPolicy) {
    return writeOne(allocationPolicyStore, policy);
  }
  async commitAllocationPolicySuccessor(
    previous: AllocationPolicy,
    successor: AllocationPolicy,
  ): Promise<StorageResult<{ previous: AllocationPolicy; successor: AllocationPolicy }>> {
    try {
      const database = await openDatabase();
      return await new Promise(resolve => {
        const transaction = database.transaction(allocationPolicyStore, "readwrite");
        const store = transaction.objectStore(allocationPolicyStore);
        let pending: StorageResult<{ previous: AllocationPolicy; successor: AllocationPolicy }> | null = null;
        const finish = (
          result: StorageResult<{ previous: AllocationPolicy; successor: AllocationPolicy }>,
        ) => {
          database.close();
          resolve(result);
        };
        const request = store.getAll();
        request.onerror = () => {
          pending = failure(request.error, database);
          try {
            transaction.abort();
          } catch {
            if (pending) finish(pending);
          }
        };
        request.onsuccess = () => {
          const policies = request.result as AllocationPolicy[];
          const repeated = policies.find(policy => policy.idempotencyKey === successor.idempotencyKey);
          if (repeated) {
            pending = {
              ok: true,
              value: {
                previous: policies.find(policy => policy.id === previous.id) ?? previous,
                successor: repeated,
              },
            };
            try {
              transaction.abort();
            } catch {
              if (pending) finish(pending);
            }
            return;
          }
          const current = policies.find(policy => policy.id === previous.id);
          if (!current || current.status !== "active") {
            pending = {
              ok: false,
              code: "storage_error",
              message: "لم تعد سياسة التوزيع الأصلية فعالة؛ لم يتغير أي شيء.",
            };
            try {
              transaction.abort();
            } catch {
              if (pending) finish(pending);
            }
            return;
          }
          if (policies.some(policy => policy.id === successor.id)) {
            pending = {
              ok: false,
              code: "storage_error",
              message: "تعارض هوية نسخة سياسة التوزيع؛ لم تتغير البيانات.",
            };
            try {
              transaction.abort();
            } catch {
              if (pending) finish(pending);
            }
            return;
          }
          store.put(previous);
          store.put(successor);
        };
        transaction.onerror = () => {
          if (!pending) pending = failure(transaction.error, database);
        };
        transaction.onabort = () => finish(pending ?? failure(transaction.error, database));
        transaction.oncomplete = () => finish({ ok: true, value: { previous, successor } });
      });
    } catch (error) {
      return failure(error);
    }
  }
  getShortCashDeclaration(id: string) {
    return readOne<ShortCashDeclaration>(shortCashDeclarationStore, id);
  }
  saveShortCashDeclaration(declaration: ShortCashDeclaration) {
    return writeOne(shortCashDeclarationStore, declaration);
  }
  async commitShortCashDeclarationReversal(
    sourceId: string,
    reversal: ShortCashDeclaration,
  ): Promise<StorageResult<ShortCashDeclaration>> {
    try {
      const database = await openDatabase();
      return await new Promise(resolve => {
        const transaction = database.transaction(shortCashDeclarationStore, "readwrite");
        const store = transaction.objectStore(shortCashDeclarationStore);
        let pending: StorageResult<ShortCashDeclaration> | null = null;
        const finish = (result: StorageResult<ShortCashDeclaration>) => {
          database.close();
          resolve(result);
        };
        const request = store.getAll();
        request.onerror = () => {
          pending = failure(request.error, database);
          try {
            transaction.abort();
          } catch {
            if (pending) finish(pending);
          }
        };
        request.onsuccess = () => {
          const declarations = request.result as ShortCashDeclaration[];
          const source = declarations.find(
            candidate => candidate.id === sourceId && candidate.kind === "declaration",
          );
          if (!source) {
            pending = {
              ok: false,
              code: "storage_error",
              message: "لم يعد السجل الأصلي موجودًا؛ لم يُحفظ التراجع.",
            };
            try {
              transaction.abort();
            } catch {
              if (pending) finish(pending);
            }
            return;
          }
          const existing = declarations.find(
            candidate => candidate.kind === "reversal" && candidate.reversalOfId === sourceId,
          );
          if (existing) {
            pending =
              existing.idempotencyKey === reversal.idempotencyKey
                ? { ok: true, value: existing }
                : {
                    ok: false,
                    code: "storage_error",
                    message: "تم التراجع عن هذا السجل المتوقع سابقًا بمفتاح مختلف؛ لم يتغير السجل.",
                  };
            try {
              transaction.abort();
            } catch {
              if (pending) finish(pending);
            }
            return;
          }
          const repeated = declarations.find(
            candidate =>
              candidate.kind === "reversal" && candidate.idempotencyKey === reversal.idempotencyKey,
          );
          if (repeated) {
            pending = { ok: true, value: repeated };
            try {
              transaction.abort();
            } catch {
              if (pending) finish(pending);
            }
            return;
          }
          if (declarations.some(candidate => candidate.id === reversal.id)) {
            pending = {
              ok: false,
              code: "storage_error",
              message: "تعارض هوية التراجع عن السجل المتوقع؛ لم يتغير السجل.",
            };
            try {
              transaction.abort();
            } catch {
              if (pending) finish(pending);
            }
            return;
          }
          store.put(reversal);
        };
        transaction.onerror = () => {
          if (!pending) pending = failure(transaction.error, database);
        };
        transaction.onabort = () => finish(pending ?? failure(transaction.error, database));
        transaction.oncomplete = () => finish({ ok: true, value: reversal });
      });
    } catch (error) {
      return failure(error);
    }
  }
  listOwnerEntitlementPolicies() {
    return listAll<OwnerEntitlementPolicy>(
      ownerEntitlementPolicyStore,
      (left, right) => right.startsOn.localeCompare(left.startsOn) || right.version - left.version,
    );
  }
  getOwnerEntitlementPolicy(id: string) {
    return readOne<OwnerEntitlementPolicy>(ownerEntitlementPolicyStore, id);
  }
  saveOwnerEntitlementPolicy(policy: OwnerEntitlementPolicy) {
    return writeOne(ownerEntitlementPolicyStore, policy);
  }
  async commitOwnerEntitlementPolicySuccessor(
    previous: OwnerEntitlementPolicy,
    successor: OwnerEntitlementPolicy,
  ): Promise<StorageResult<{ previous: OwnerEntitlementPolicy; successor: OwnerEntitlementPolicy }>> {
    try {
      const database = await openDatabase();
      return await new Promise(resolve => {
        const transaction = database.transaction(ownerEntitlementPolicyStore, "readwrite");
        const store = transaction.objectStore(ownerEntitlementPolicyStore);
        let pending: StorageResult<{
          previous: OwnerEntitlementPolicy;
          successor: OwnerEntitlementPolicy;
        }> | null = null;
        const finish = (
          result: StorageResult<{ previous: OwnerEntitlementPolicy; successor: OwnerEntitlementPolicy }>,
        ) => {
          database.close();
          resolve(result);
        };
        const request = store.getAll();
        request.onerror = () => {
          pending = failure(request.error, database);
          try {
            transaction.abort();
          } catch {
            if (pending) finish(pending);
          }
        };
        request.onsuccess = () => {
          const policies = request.result as OwnerEntitlementPolicy[];
          const repeated = policies.find(policy => policy.idempotencyKey === successor.idempotencyKey);
          if (repeated) {
            const current = policies.find(policy => policy.id === previous.id) ?? previous;
            pending = { ok: true, value: { previous: current, successor: repeated } };
            try {
              transaction.abort();
            } catch {
              if (pending) finish(pending);
            }
            return;
          }
          const current = policies.find(policy => policy.id === previous.id);
          if (!current || current.status !== "active") {
            pending = {
              ok: false,
              code: "storage_error",
              message: "لم تعد السياسة الأصلية فعالة؛ لم تُحفظ النسخة الجديدة.",
            };
            try {
              transaction.abort();
            } catch {
              if (pending) finish(pending);
            }
            return;
          }
          if (policies.some(policy => policy.id === successor.id)) {
            pending = {
              ok: false,
              code: "storage_error",
              message: "تعارض هوية النسخة الجديدة من السياسة؛ لم يتغير أي شيء.",
            };
            try {
              transaction.abort();
            } catch {
              if (pending) finish(pending);
            }
            return;
          }
          store.put(previous);
          store.put(successor);
        };
        transaction.onerror = () => {
          if (!pending) pending = failure(transaction.error, database);
        };
        transaction.onabort = () => finish(pending ?? failure(transaction.error, database));
        transaction.oncomplete = () => finish({ ok: true, value: { previous, successor } });
      });
    } catch (error) {
      return failure(error);
    }
  }
  listOwnerEntitlementRecords() {
    return listAll<OwnerEntitlementRecord>(
      ownerEntitlementRecordStore,
      (left, right) =>
        right.occurredOn.localeCompare(left.occurredOn) || right.recordedAt.localeCompare(left.recordedAt),
    );
  }
  getOwnerEntitlementRecord(id: string) {
    return readOne<OwnerEntitlementRecord>(ownerEntitlementRecordStore, id);
  }
  saveOwnerEntitlementRecord(record: OwnerEntitlementRecord) {
    return writeOne(ownerEntitlementRecordStore, record);
  }
  async commitOwnerEntitlementRecordReversal(
    sourceId: string,
    reversal: OwnerEntitlementRecord,
  ): Promise<StorageResult<OwnerEntitlementRecord>> {
    try {
      const database = await openDatabase();
      return await new Promise(resolve => {
        const transaction = database.transaction(ownerEntitlementRecordStore, "readwrite");
        const store = transaction.objectStore(ownerEntitlementRecordStore);
        let pending: StorageResult<OwnerEntitlementRecord> | null = null;
        const finish = (result: StorageResult<OwnerEntitlementRecord>) => {
          database.close();
          resolve(result);
        };
        const request = store.getAll();
        request.onerror = () => {
          pending = failure(request.error, database);
          try {
            transaction.abort();
          } catch {
            if (pending) finish(pending);
          }
        };
        request.onsuccess = () => {
          const records = request.result as OwnerEntitlementRecord[];
          const source = records.find(record => record.id === sourceId);
          if (!source) {
            pending = {
              ok: false,
              code: "storage_error",
              message: "لم يعد سجل الحق المصدر موجودًا؛ لم يُحفظ التراجع.",
            };
            try {
              transaction.abort();
            } catch {
              if (pending) finish(pending);
            }
            return;
          }
          const existing = records.find(record => record.reversalOfId === sourceId);
          if (existing) {
            pending =
              existing.idempotencyKey === reversal.idempotencyKey
                ? { ok: true, value: existing }
                : {
                    ok: false,
                    code: "storage_error",
                    message: "التراجع عن الحق موجود بمفتاح مختلف؛ لم تتغير البيانات.",
                  };
            try {
              transaction.abort();
            } catch {
              if (pending) finish(pending);
            }
            return;
          }
          if (records.some(record => record.id === reversal.id)) {
            pending = {
              ok: false,
              code: "storage_error",
              message: "تعارض هوية التراجع عن الحق؛ لم تتغير البيانات.",
            };
            try {
              transaction.abort();
            } catch {
              if (pending) finish(pending);
            }
            return;
          }
          store.put(reversal);
        };
        transaction.onerror = () => {
          if (!pending) pending = failure(transaction.error, database);
        };
        transaction.onabort = () => finish(pending ?? failure(transaction.error, database));
        transaction.oncomplete = () => finish({ ok: true, value: reversal });
      });
    } catch (error) {
      return failure(error);
    }
  }
  listOwnerEntitlementOpeningBalances() {
    return listAll<OwnerEntitlementOpeningBalance>(
      ownerEntitlementOpeningBalanceStore,
      (left, right) =>
        right.occurredOn.localeCompare(left.occurredOn) || right.recordedAt.localeCompare(left.recordedAt),
    );
  }
  saveOwnerEntitlementOpeningBalance(balance: OwnerEntitlementOpeningBalance) {
    return writeOne(ownerEntitlementOpeningBalanceStore, balance);
  }
  async commitOwnerEntitlementOpeningBalanceReversal(
    sourceId: string,
    reversal: OwnerEntitlementOpeningBalance,
  ): Promise<StorageResult<OwnerEntitlementOpeningBalance>> {
    try {
      const database = await openDatabase();
      return await new Promise(resolve => {
        const transaction = database.transaction(ownerEntitlementOpeningBalanceStore, "readwrite");
        const store = transaction.objectStore(ownerEntitlementOpeningBalanceStore);
        let pending: StorageResult<OwnerEntitlementOpeningBalance> | null = null;
        const finish = (result: StorageResult<OwnerEntitlementOpeningBalance>) => {
          database.close();
          resolve(result);
        };
        const request = store.getAll();
        request.onerror = () => {
          pending = failure(request.error, database);
          try {
            transaction.abort();
          } catch {
            if (pending) finish(pending);
          }
        };
        request.onsuccess = () => {
          const balances = request.result as OwnerEntitlementOpeningBalance[];
          const source = balances.find(balance => balance.id === sourceId);
          if (!source) {
            pending = {
              ok: false,
              code: "storage_error",
              message: "لم يعد الرصيد الافتتاحي المصدر موجودًا؛ لم يُحفظ التراجع.",
            };
            try {
              transaction.abort();
            } catch {
              if (pending) finish(pending);
            }
            return;
          }
          const existing = balances.find(balance => balance.reversalOfId === sourceId);
          if (existing) {
            pending =
              existing.idempotencyKey === reversal.idempotencyKey
                ? { ok: true, value: existing }
                : {
                    ok: false,
                    code: "storage_error",
                    message: "التراجع عن الرصيد الافتتاحي موجود بمفتاح مختلف؛ لم تتغير البيانات.",
                  };
            try {
              transaction.abort();
            } catch {
              if (pending) finish(pending);
            }
            return;
          }
          if (balances.some(balance => balance.id === reversal.id)) {
            pending = {
              ok: false,
              code: "storage_error",
              message: "تعارض هوية التراجع عن الرصيد الافتتاحي؛ لم تتغير البيانات.",
            };
            try {
              transaction.abort();
            } catch {
              if (pending) finish(pending);
            }
            return;
          }
          store.put(reversal);
        };
        transaction.onerror = () => {
          if (!pending) pending = failure(transaction.error, database);
        };
        transaction.onabort = () => finish(pending ?? failure(transaction.error, database));
        transaction.oncomplete = () => finish({ ok: true, value: reversal });
      });
    } catch (error) {
      return failure(error);
    }
  }
  listOwnerMovements() {
    return listAll<OwnerMovement>(ownerMovementStore, (left, right) =>
      right.recordedAt.localeCompare(left.recordedAt),
    );
  }
  getOwnerMovement(id: string) {
    return readOne<OwnerMovement>(ownerMovementStore, id);
  }
  async commitOwnerMovement(
    movement: OwnerMovement,
    cashEntry: CashContinuityEntry,
  ): Promise<StorageResult<{ movement: OwnerMovement; cashEntry: CashContinuityEntry }>> {
    try {
      const database = await openDatabase();
      return await new Promise(resolve => {
        const transaction = database.transaction([ownerMovementStore, cashContinuityEntryStore], "readwrite");
        const movements = transaction.objectStore(ownerMovementStore);
        const cashEntries = transaction.objectStore(cashContinuityEntryStore);
        const existingRequest = movements.getAll();
        let pending: StorageResult<{ movement: OwnerMovement; cashEntry: CashContinuityEntry }> | null = null;
        const finish = (
          result: StorageResult<{ movement: OwnerMovement; cashEntry: CashContinuityEntry }>,
        ) => {
          database.close();
          resolve(result);
        };
        existingRequest.onerror = () => {
          pending = failure(existingRequest.error, database);
          try {
            transaction.abort();
          } catch {
            if (pending) finish(pending);
          }
        };
        existingRequest.onsuccess = () => {
          const existing = (existingRequest.result as OwnerMovement[]).find(
            candidate => candidate.idempotencyKey === movement.idempotencyKey,
          );
          if (existing) {
            const cashRequest = cashEntries.getAll();
            cashRequest.onerror = () => {
              pending = failure(cashRequest.error, database);
              try {
                transaction.abort();
              } catch {
                if (pending) finish(pending);
              }
            };
            cashRequest.onsuccess = () => {
              const matching = (cashRequest.result as CashContinuityEntry[]).find(
                entry => entry.operationKey === cashEntry.operationKey,
              );
              if (!matching) {
                pending = {
                  ok: false,
                  code: "storage_error",
                  message: "وجدت حركة مالك بلا أثر كاش مطابق؛ لم يتغير السجل.",
                };
                try {
                  transaction.abort();
                } catch {
                  if (pending) finish(pending);
                }
              } else {
                pending = { ok: true, value: { movement: existing, cashEntry: matching } };
                try {
                  transaction.abort();
                } catch {
                  if (pending) finish(pending);
                }
              }
            };
            return;
          }
          movements.put(movement);
          cashEntries.put(cashEntry);
        };
        transaction.onerror = () => {
          if (!pending) pending = failure(transaction.error, database);
        };
        transaction.onabort = () => finish(pending ?? failure(transaction.error, database));
        transaction.oncomplete = () => finish({ ok: true, value: { movement, cashEntry } });
      });
    } catch (error) {
      return failure(error);
    }
  }
  async commitOrderFromDraft(
    order: StoredCraftOrder,
    draft: OrderDraft,
    schedule?: ScheduleEntry,
  ): Promise<StorageResult<{ order: StoredCraftOrder; draft: OrderDraft; schedule: ScheduleEntry | null }>> {
    try {
      const database = await openDatabase();
      return await new Promise(resolve => {
        const stores = schedule ? [orderStore, draftStore, scheduleStore] : [orderStore, draftStore];
        const transaction = database.transaction(stores, "readwrite");
        transaction.objectStore(orderStore).put(order);
        transaction.objectStore(draftStore).put(draft);
        if (schedule) transaction.objectStore(scheduleStore).put(schedule);
        transaction.onabort = () => resolve(failure(transaction.error, database));
        transaction.onerror = () => resolve(failure(transaction.error, database));
        transaction.oncomplete = () => {
          database.close();
          resolve({ ok: true, value: { order, draft, schedule: schedule ?? null } });
        };
      });
    } catch (error) {
      return failure(error);
    }
  }
  async readSnapshot(): Promise<StorageResult<LocalStoreSnapshot>> {
    try {
      const database = await openDatabase();
      return await new Promise(resolve => {
        const transaction = database.transaction(
          [
            profileStore,
            preferencesStore,
            draftStore,
            orderStore,
            scheduleStore,
            recurrenceStore,
            financialEventStore,
            supplierPurchaseStore,
            cashWalletStore,
            cashContinuityEntryStore,
            materialStore,
            inventoryMovementStore,
            catalogItemStore,
            measurementUnitStore,
            directConversionStore,
            catalogTemplateStore,
            actualTimeStore,
            shortCashDeclarationStore,
            ownerEntitlementPolicyStore,
            ownerEntitlementRecordStore,
            ownerEntitlementOpeningBalanceStore,
            ownerMovementStore,
            allocationPolicyStore,
          ],
          "readonly",
        );
        const profile = transaction.objectStore(profileStore).get("local-profile");
        const preferences = transaction.objectStore(preferencesStore).get("local-preferences");
        const drafts = transaction.objectStore(draftStore).getAll();
        const orders = transaction.objectStore(orderStore).getAll();
        const schedules = transaction.objectStore(scheduleStore).getAll();
        const recurrences = transaction.objectStore(recurrenceStore).getAll();
        const financialEvents = transaction.objectStore(financialEventStore).getAll();
        const supplierPurchases = transaction.objectStore(supplierPurchaseStore).getAll();
        const cashWallets = transaction.objectStore(cashWalletStore).getAll();
        const cashContinuityEntries = transaction.objectStore(cashContinuityEntryStore).getAll();
        const materials = transaction.objectStore(materialStore).getAll();
        const inventoryMovements = transaction.objectStore(inventoryMovementStore).getAll();
        const catalogItems = transaction.objectStore(catalogItemStore).getAll();
        const measurementUnits = transaction.objectStore(measurementUnitStore).getAll();
        const directConversions = transaction.objectStore(directConversionStore).getAll();
        const catalogTemplates = transaction.objectStore(catalogTemplateStore).getAll();
        const actualTimeRecords = transaction.objectStore(actualTimeStore).getAll();
        const shortCashDeclarations = transaction.objectStore(shortCashDeclarationStore).getAll();
        const ownerEntitlementPolicies = transaction.objectStore(ownerEntitlementPolicyStore).getAll();
        const ownerEntitlementRecords = transaction.objectStore(ownerEntitlementRecordStore).getAll();
        const ownerEntitlementOpeningBalances = transaction
          .objectStore(ownerEntitlementOpeningBalanceStore)
          .getAll();
        const ownerMovements = transaction.objectStore(ownerMovementStore).getAll();
        const allocationPolicies = transaction.objectStore(allocationPolicyStore).getAll();
        transaction.onerror = () => resolve(failure(transaction.error, database));
        transaction.onabort = () => resolve(failure(transaction.error, database));
        transaction.oncomplete = () => {
          database.close();
          resolve({
            ok: true,
            value: {
              profile: (profile.result as ActivityProfile | undefined) ?? null,
              preferences: (preferences.result as LocalPreferences | undefined) ?? null,
              drafts: drafts.result as OrderDraft[],
              orders: orders.result as StoredCraftOrder[],
              schedules: schedules.result as ScheduleEntry[],
              recurrences: recurrences.result as ScheduleRecurrence[],
              financialEvents: financialEvents.result as FinancialEvent[],
              supplierPurchases: supplierPurchases.result as SupplierPurchase[],
              cashWallets: cashWallets.result as CashWallet[],
              cashContinuityEntries: cashContinuityEntries.result as CashContinuityEntry[],
              materials: materials.result as Material[],
              inventoryMovements: inventoryMovements.result as InventoryMovement[],
              catalogItems: catalogItems.result as CatalogItem[],
              measurementUnits: measurementUnits.result as MeasurementUnit[],
              directConversions: directConversions.result as DirectConversion[],
              catalogTemplates: catalogTemplates.result as CatalogTemplate[],
              actualTimeRecords: actualTimeRecords.result as ActualTimeRecord[],
              shortCashDeclarations: shortCashDeclarations.result as ShortCashDeclaration[],
              ownerEntitlementPolicies: ownerEntitlementPolicies.result as OwnerEntitlementPolicy[],
              ownerEntitlementRecords: ownerEntitlementRecords.result as OwnerEntitlementRecord[],
              ownerEntitlementOpeningBalances:
                ownerEntitlementOpeningBalances.result as OwnerEntitlementOpeningBalance[],
              ownerMovements: ownerMovements.result as OwnerMovement[],
              allocationPolicies: allocationPolicies.result as AllocationPolicy[],
            },
          });
        };
      });
    } catch (error) {
      return failure(error);
    }
  }
  async replaceSnapshot(snapshot: LocalStoreSnapshot): Promise<StorageResult<LocalStoreSnapshot>> {
    try {
      const database = await openDatabase();
      const normalized: LocalStoreSnapshot = {
        ...snapshot,
        schedules: snapshot.schedules ?? [],
        recurrences: snapshot.recurrences ?? [],
        financialEvents: snapshot.financialEvents ?? [],
        supplierPurchases: snapshot.supplierPurchases ?? [],
        cashWallets: snapshot.cashWallets ?? [],
        cashContinuityEntries: snapshot.cashContinuityEntries ?? [],
        materials: snapshot.materials ?? [],
        inventoryMovements: snapshot.inventoryMovements ?? [],
        catalogItems: snapshot.catalogItems ?? [],
        measurementUnits: snapshot.measurementUnits ?? [],
        directConversions: snapshot.directConversions ?? [],
        catalogTemplates: snapshot.catalogTemplates ?? [],
        actualTimeRecords: snapshot.actualTimeRecords ?? [],
        shortCashDeclarations: snapshot.shortCashDeclarations ?? [],
        ownerEntitlementPolicies: snapshot.ownerEntitlementPolicies ?? [],
        ownerEntitlementRecords: snapshot.ownerEntitlementRecords ?? [],
        ownerEntitlementOpeningBalances: snapshot.ownerEntitlementOpeningBalances ?? [],
        ownerMovements: snapshot.ownerMovements ?? [],
        allocationPolicies: snapshot.allocationPolicies ?? [],
      };
      return await new Promise(resolve => {
        const transaction = database.transaction(
          [
            profileStore,
            preferencesStore,
            draftStore,
            orderStore,
            scheduleStore,
            recurrenceStore,
            financialEventStore,
            supplierPurchaseStore,
            cashWalletStore,
            cashContinuityEntryStore,
            materialStore,
            inventoryMovementStore,
            catalogItemStore,
            measurementUnitStore,
            directConversionStore,
            catalogTemplateStore,
            actualTimeStore,
            shortCashDeclarationStore,
            ownerEntitlementPolicyStore,
            ownerEntitlementRecordStore,
            ownerEntitlementOpeningBalanceStore,
            ownerMovementStore,
            allocationPolicyStore,
          ],
          "readwrite",
        );
        const profiles = transaction.objectStore(profileStore);
        const preferences = transaction.objectStore(preferencesStore);
        const drafts = transaction.objectStore(draftStore);
        const orders = transaction.objectStore(orderStore);
        const schedules = transaction.objectStore(scheduleStore);
        const recurrences = transaction.objectStore(recurrenceStore);
        const financialEvents = transaction.objectStore(financialEventStore);
        const supplierPurchases = transaction.objectStore(supplierPurchaseStore);
        const cashWallets = transaction.objectStore(cashWalletStore);
        const cashContinuityEntries = transaction.objectStore(cashContinuityEntryStore);
        const materials = transaction.objectStore(materialStore);
        const inventoryMovements = transaction.objectStore(inventoryMovementStore);
        const catalogItems = transaction.objectStore(catalogItemStore);
        const measurementUnits = transaction.objectStore(measurementUnitStore);
        const directConversions = transaction.objectStore(directConversionStore);
        const catalogTemplates = transaction.objectStore(catalogTemplateStore);
        const actualTimeRecords = transaction.objectStore(actualTimeStore);
        const shortCashDeclarations = transaction.objectStore(shortCashDeclarationStore);
        const ownerEntitlementPolicies = transaction.objectStore(ownerEntitlementPolicyStore);
        const ownerEntitlementRecords = transaction.objectStore(ownerEntitlementRecordStore);
        const ownerEntitlementOpeningBalances = transaction.objectStore(ownerEntitlementOpeningBalanceStore);
        const ownerMovements = transaction.objectStore(ownerMovementStore);
        const allocationPolicies = transaction.objectStore(allocationPolicyStore);
        profiles.clear();
        preferences.clear();
        drafts.clear();
        orders.clear();
        schedules.clear();
        recurrences.clear();
        financialEvents.clear();
        supplierPurchases.clear();
        cashWallets.clear();
        cashContinuityEntries.clear();
        materials.clear();
        inventoryMovements.clear();
        catalogItems.clear();
        measurementUnits.clear();
        directConversions.clear();
        catalogTemplates.clear();
        actualTimeRecords.clear();
        shortCashDeclarations.clear();
        ownerEntitlementPolicies.clear();
        ownerEntitlementRecords.clear();
        ownerEntitlementOpeningBalances.clear();
        ownerMovements.clear();
        allocationPolicies.clear();
        if (normalized.profile) profiles.put(normalized.profile);
        if (normalized.preferences) preferences.put(normalized.preferences);
        normalized.drafts.forEach(draft => drafts.put(draft));
        normalized.orders.forEach(order => orders.put(order));
        normalized.schedules.forEach(schedule => schedules.put(schedule));
        normalized.recurrences?.forEach(recurrence => recurrences.put(recurrence));
        normalized.financialEvents.forEach(event => financialEvents.put(event));
        normalized.supplierPurchases?.forEach(purchase => supplierPurchases.put(purchase));
        normalized.cashWallets?.forEach(wallet => cashWallets.put(wallet));
        normalized.cashContinuityEntries?.forEach(entry => cashContinuityEntries.put(entry));
        normalized.materials?.forEach(material => materials.put(material));
        normalized.inventoryMovements?.forEach(movement => inventoryMovements.put(movement));
        normalized.catalogItems?.forEach(item => catalogItems.put(item));
        normalized.measurementUnits?.forEach(unit => measurementUnits.put(unit));
        normalized.directConversions?.forEach(conversion => directConversions.put(conversion));
        normalized.catalogTemplates?.forEach(template => catalogTemplates.put(template));
        normalized.actualTimeRecords?.forEach(record => actualTimeRecords.put(record));
        normalized.shortCashDeclarations?.forEach(declaration => shortCashDeclarations.put(declaration));
        normalized.ownerEntitlementPolicies?.forEach(policy => ownerEntitlementPolicies.put(policy));
        normalized.ownerEntitlementRecords?.forEach(record => ownerEntitlementRecords.put(record));
        normalized.ownerEntitlementOpeningBalances?.forEach(balance =>
          ownerEntitlementOpeningBalances.put(balance),
        );
        normalized.ownerMovements?.forEach(movement => ownerMovements.put(movement));
        normalized.allocationPolicies?.forEach(policy => allocationPolicies.put(policy));
        transaction.onerror = () => resolve(failure(transaction.error, database));
        transaction.onabort = () => resolve(failure(transaction.error, database));
        transaction.oncomplete = () => {
          database.close();
          resolve({ ok: true, value: normalized });
        };
      });
    } catch (error) {
      return failure(error);
    }
  }
}
