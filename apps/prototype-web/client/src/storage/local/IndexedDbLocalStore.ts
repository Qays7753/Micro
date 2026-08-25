/** Browser persistence adapter. React never imports this module and financial policy lives above it. */
import type { FinancialEvent } from "@micro-domain/financial-event/index.js";
import type { SupplierPurchase } from "@micro-domain/supplier-purchase/index.js";
import type { CashContinuityEntry, CashWallet } from "@micro-domain/cash-continuity/index.js";
import type { InventoryMovement, Material } from "@micro-domain/inventory-material/index.js";
import type { CatalogItem } from "@micro-domain/catalog/index.js";
import type { ActualTimeRecord } from "@micro-domain/actual-time/index.js";
import type { ShortCashDeclaration } from "@micro-domain/g5/index.js";
import { localSchemaVersion, type ActivityProfile, type LocalPreferences, type LocalStoreSnapshot, type OrderDraft, type PrototypeLocalStore, type ScheduleEntry, type ScheduleRecurrence, type StorageFailure, type StorageResult, type StoredCraftOrder } from "./types";

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
const actualTimeStore = "actual-time-records";
const shortCashDeclarationStore = "short-cash-declarations";

function failure(error: unknown): StorageFailure {
  return { ok: false, code: typeof indexedDB === "undefined" ? "storage_unavailable" : "storage_error", message: error instanceof Error ? error.message : "تعذر الوصول إلى التخزين المحلي." };
}

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") {
      reject(new Error("التخزين المحلي غير مدعوم في هذا المتصفح."));
      return;
    }
    const request = indexedDB.open(databaseName, localSchemaVersion);
    request.onerror = () => reject(request.error ?? new Error("تعذر فتح التخزين المحلي."));
    request.onblocked = () => reject(new Error("التخزين المحلي مفتوح في نافذة أخرى."));
    request.onupgradeneeded = event => {
      const database = request.result;
      if (!database.objectStoreNames.contains(profileStore)) database.createObjectStore(profileStore, { keyPath: "id" });
      if (!database.objectStoreNames.contains(preferencesStore)) database.createObjectStore(preferencesStore, { keyPath: "id" });
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
      if (!database.objectStoreNames.contains(cashWalletStore)) database.createObjectStore(cashWalletStore, { keyPath: "id" });
      if (!database.objectStoreNames.contains(cashContinuityEntryStore)) {
        const entries = database.createObjectStore(cashContinuityEntryStore, { keyPath: "id" });
        entries.createIndex("walletId", "walletId");
        entries.createIndex("occurredOn", "occurredOn");
        entries.createIndex("operationKey", "operationKey");
        entries.createIndex("transferId", "transferId");
      }
      if (!database.objectStoreNames.contains(materialStore)) database.createObjectStore(materialStore, { keyPath: "id" });
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
      if (event.oldVersion < 4 || event.oldVersion < 17) {
        const drafts = request.transaction?.objectStore(draftStore);
        if (drafts) {
          const cursor = drafts.openCursor();
          cursor.onsuccess = () => {
            const current = cursor.result;
            if (!current) return;
            const legacy = current.value as Partial<OrderDraft>;
            current.update({
              ...legacy,
              ...(event.oldVersion < 4 ? { costSnapshots: Array.isArray(legacy.costSnapshots) ? legacy.costSnapshots : [], activeCostSnapshotId: legacy.activeCostSnapshotId ?? null, linkedOrderId: legacy.linkedOrderId ?? null } : {}),
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
          const cursor = schedules.openCursor();
          cursor.onsuccess = () => {
            const current = cursor.result;
            if (!current) return;
            const legacy = current.value as Partial<ScheduleEntry>;
            current.update({ ...legacy, scheduledTime: legacy.scheduledTime ?? null, durationMinutes: legacy.durationMinutes ?? null, events: Array.isArray(legacy.events) ? legacy.events.map(entry => ({ ...entry, previousScheduledTime: entry.previousScheduledTime ?? null, scheduledTime: entry.scheduledTime ?? null, previousDurationMinutes: entry.previousDurationMinutes ?? null, durationMinutes: entry.durationMinutes ?? null })) : [] });
            current.continue();
          };
        }
      }
      if (event.oldVersion < 17) {
        const orders = request.transaction?.objectStore(orderStore);
        if (orders) {
          const cursor = orders.openCursor();
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
          const cursor = schedules.openCursor();
          cursor.onsuccess = () => {
            const current = cursor.result;
            if (!current) return;
            current.update({ ...current.value, scheduledTime: current.value.scheduledTime ?? null, durationMinutes: current.value.durationMinutes ?? null, events: Array.isArray(current.value.events) ? current.value.events.map((entry: Record<string, unknown>) => ({ ...entry, previousScheduledTime: entry.previousScheduledTime ?? null, scheduledTime: entry.scheduledTime ?? null, previousDurationMinutes: entry.previousDurationMinutes ?? null, durationMinutes: entry.durationMinutes ?? null })) : [], recurrenceId: current.value.recurrenceId ?? null, recurrenceIndex: current.value.recurrenceIndex ?? null });
            current.continue();
          };
        }
        const orders = request.transaction?.objectStore(orderStore);
        if (orders) {
          const cursor = orders.openCursor();
          cursor.onsuccess = () => {
            const current = cursor.result;
            if (!current) return;
            current.update({ ...current.value, catalogItemId: current.value.catalogItemId ?? null, followUpSummary: current.value.followUpSummary ?? null, followUpDate: current.value.followUpDate ?? null, followUpReason: current.value.followUpReason ?? null, followUpEvents: Array.isArray(current.value.followUpEvents) ? current.value.followUpEvents : [] });
            current.continue();
          };
        }
      }
      if (event.oldVersion < 8 || event.oldVersion < 18) {
        const preferences = request.transaction?.objectStore(preferencesStore);
        if (preferences) {
          const cursor = preferences.openCursor();
          cursor.onsuccess = () => {
            const current = cursor.result;
            if (!current) return;
            current.update({ ...current.value, ...(event.oldVersion < 8 ? { dailyScheduleCapacityMinutes: current.value.dailyScheduleCapacityMinutes ?? null } : {}), ...(event.oldVersion < 18 ? { workMode: current.value.workMode ?? null, actualTimeTrackingEnabled: current.value.actualTimeTrackingEnabled ?? false } : {}) });
            current.continue();
          };
        }
      }
    };
    request.onsuccess = () => resolve(request.result);
  });
}

async function readOne<T>(storeName: string, key: string): Promise<StorageResult<T | null>> {
  try {
    const database = await openDatabase();
    return await new Promise(resolve => {
      const transaction = database.transaction(storeName, "readonly");
      const request = transaction.objectStore(storeName).get(key);
      request.onerror = () => resolve(failure(request.error));
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
      request.onerror = () => resolve(failure(request.error));
      transaction.onabort = () => resolve(failure(transaction.error));
      transaction.oncomplete = () => {
        database.close();
        resolve({ ok: true, value });
      };
    });
  } catch (error) {
    return failure(error);
  }
}

async function listAll<T>(storeName: string, sort: (left: T, right: T) => number): Promise<StorageResult<readonly T[]>> {
  try {
    const database = await openDatabase();
    return await new Promise(resolve => {
      const transaction = database.transaction(storeName, "readonly");
      const request = transaction.objectStore(storeName).getAll();
      request.onerror = () => resolve(failure(request.error));
      request.onsuccess = () => resolve({ ok: true, value: (request.result as T[]).sort(sort) });
      transaction.oncomplete = () => database.close();
    });
  } catch (error) {
    return failure(error);
  }
}

export class IndexedDbLocalStore implements PrototypeLocalStore {
  getProfile() { return readOne<ActivityProfile>(profileStore, "local-profile"); }
  saveProfile(profile: ActivityProfile) { return writeOne(profileStore, profile); }
  getPreferences() { return readOne<LocalPreferences>(preferencesStore, "local-preferences"); }
  savePreferences(preferences: LocalPreferences) { return writeOne(preferencesStore, preferences); }
  listDrafts() { return listAll<OrderDraft>(draftStore, (left, right) => right.updatedAt.localeCompare(left.updatedAt)); }
  getDraft(id: string) { return readOne<OrderDraft>(draftStore, id); }
  saveDraft(draft: OrderDraft) { return writeOne(draftStore, draft); }
  listOrders() { return listAll<StoredCraftOrder>(orderStore, (left, right) => right.updatedAt.localeCompare(left.updatedAt)); }
  getOrder(id: string) { return readOne<StoredCraftOrder>(orderStore, id); }
  saveOrder(order: StoredCraftOrder) { return writeOne(orderStore, order); }
  listSchedules() { return listAll<ScheduleEntry>(scheduleStore, (left, right) => left.scheduledFor.localeCompare(right.scheduledFor) || right.updatedAt.localeCompare(left.updatedAt)); }
  getSchedule(id: string) { return readOne<ScheduleEntry>(scheduleStore, id); }
  saveSchedule(schedule: ScheduleEntry) { return writeOne(scheduleStore, schedule); }
  listRecurrences() { return listAll<ScheduleRecurrence>(recurrenceStore, (left, right) => left.createdAt.localeCompare(right.createdAt)); }
  getRecurrence(id: string) { return readOne<ScheduleRecurrence>(recurrenceStore, id); }
  saveRecurrence(recurrence: ScheduleRecurrence) { return writeOne(recurrenceStore, recurrence); }
  async commitRecurrence(recurrence: ScheduleRecurrence, schedules: readonly ScheduleEntry[]): Promise<StorageResult<{ recurrence: ScheduleRecurrence; schedules: readonly ScheduleEntry[] }>> {
    try {
      const database = await openDatabase();
      return await new Promise(resolve => {
        const transaction = database.transaction([recurrenceStore, scheduleStore], "readwrite");
        transaction.objectStore(recurrenceStore).put(recurrence);
        schedules.forEach(schedule => transaction.objectStore(scheduleStore).put(schedule));
        transaction.onabort = () => resolve(failure(transaction.error));
        transaction.onerror = () => resolve(failure(transaction.error));
        transaction.oncomplete = () => {
          database.close();
          resolve({ ok: true, value: { recurrence, schedules } });
        };
      });
    } catch (error) {
      return failure(error);
    }
  }
  listFinancialEvents() { return listAll<FinancialEvent>(financialEventStore, (left, right) => right.recordedAt.localeCompare(left.recordedAt)); }
  getFinancialEvent(id: string) { return readOne<FinancialEvent>(financialEventStore, id); }
  saveFinancialEvent(event: FinancialEvent) { return writeOne(financialEventStore, event); }
  async commitFinancialEventCorrection(sourceEventId: string, reversal: FinancialEvent): Promise<StorageResult<FinancialEvent>> {
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
          try { transaction.abort(); } catch { finish(result); }
        };
        const request = store.getAll();
        request.onerror = () => abortWith(failure(request.error));
        request.onsuccess = () => {
          const events = request.result as FinancialEvent[];
          const source = events.find(event => event.id === sourceEventId);
          if (!source) {
            abortWith({ ok: false, code: "storage_error", message: "لم يعد الحدث المصدر موجودًا؛ لم يُحفظ العكس." });
            return;
          }
          if (source.correctionType === "reverse" || source.correctionOfEventId) {
            abortWith({ ok: false, code: "storage_error", message: "لا يمكن عكس واقعة عكس سابقة." });
            return;
          }
          const existing = events.find(event => event.correctionOfEventId === sourceEventId && event.correctionType === "reverse");
          if (existing) {
            abortWith(existing.idempotencyKey === reversal.idempotencyKey ? { ok: true, value: existing } : { ok: false, code: "storage_error", message: "تعذر حفظ العكس لأن الواقعة عُكست سابقًا بمفتاح مختلف." });
            return;
          }
          if (events.some(event => event.id === reversal.id)) {
            abortWith({ ok: false, code: "storage_error", message: "تعذر حفظ العكس بسبب تعارض هوية محلية." });
            return;
          }
          if (reversal.correctionType !== "reverse" || reversal.correctionOfEventId !== source.id || reversal.type !== source.type || reversal.amountMinor !== source.amountMinor || reversal.relatedEventId !== source.relatedEventId || reversal.cashDeltaMinor !== -source.cashDeltaMinor || reversal.payableDeltaMinor !== -source.payableDeltaMinor || reversal.ownerCapitalDeltaMinor !== -source.ownerCapitalDeltaMinor || reversal.operatingExpenseDeltaMinor !== -source.operatingExpenseDeltaMinor) {
            abortWith({ ok: false, code: "storage_error", message: "بيانات العكس لا تطابق الواقعة الأصلية؛ لم يتغير السجل." });
            return;
          }
          store.put(reversal);
        };
        transaction.onerror = () => { if (!pendingAbortResult) pendingAbortResult = failure(transaction.error); };
        transaction.onabort = () => finish(pendingAbortResult ?? failure(transaction.error));
        transaction.oncomplete = () => finish({ ok: true, value: reversal });
      });
    } catch (error) {
      return failure(error);
    }
  }
  listSupplierPurchases() { return listAll<SupplierPurchase>(supplierPurchaseStore, (left, right) => right.purchasedOn.localeCompare(left.purchasedOn) || right.updatedAt.localeCompare(left.updatedAt)); }
  getSupplierPurchase(id: string) { return readOne<SupplierPurchase>(supplierPurchaseStore, id); }
  saveSupplierPurchase(purchase: SupplierPurchase) { return writeOne(supplierPurchaseStore, purchase); }
  listCashWallets() { return listAll<CashWallet>(cashWalletStore, (left, right) => left.createdAt.localeCompare(right.createdAt)); }
  listCashContinuityEntries() { return listAll<CashContinuityEntry>(cashContinuityEntryStore, (left, right) => left.occurredOn.localeCompare(right.occurredOn) || left.recordedAt.localeCompare(right.recordedAt)); }
  async commitCashContinuity(wallet: CashWallet | null, entries: readonly CashContinuityEntry[]): Promise<StorageResult<{ wallet: CashWallet | null; entries: readonly CashContinuityEntry[] }>> {
    try {
      const database = await openDatabase();
      return await new Promise(resolve => {
        const transaction = database.transaction([cashWalletStore, cashContinuityEntryStore], "readwrite");
        if (wallet) transaction.objectStore(cashWalletStore).put(wallet);
        entries.forEach(entry => transaction.objectStore(cashContinuityEntryStore).put(entry));
        transaction.onerror = () => resolve(failure(transaction.error));
        transaction.onabort = () => resolve(failure(transaction.error));
        transaction.oncomplete = () => {
          database.close();
          resolve({ ok: true, value: { wallet, entries } });
        };
      });
    } catch (error) {
      return failure(error);
    }
  }
  listMaterials() { return listAll<Material>(materialStore, (left, right) => left.createdAt.localeCompare(right.createdAt)); }
  listInventoryMovements() { return listAll<InventoryMovement>(inventoryMovementStore, (left, right) => right.occurredOn.localeCompare(left.occurredOn) || right.recordedAt.localeCompare(left.recordedAt)); }
  async commitInventory(material: Material | null, movements: readonly InventoryMovement[]): Promise<StorageResult<{ material: Material | null; movements: readonly InventoryMovement[] }>> {
    try {
      const database = await openDatabase();
      return await new Promise(resolve => {
        const transaction = database.transaction([materialStore, inventoryMovementStore], "readwrite");
        if (material) transaction.objectStore(materialStore).put(material);
        movements.forEach(movement => transaction.objectStore(inventoryMovementStore).put(movement));
        transaction.onerror = () => resolve(failure(transaction.error));
        transaction.onabort = () => resolve(failure(transaction.error));
        transaction.oncomplete = () => {
          database.close();
          resolve({ ok: true, value: { material, movements } });
        };
      });
    } catch (error) {
      return failure(error);
    }
  }
  listCatalogItems() { return listAll<CatalogItem>(catalogItemStore, (left, right) => left.name.localeCompare(right.name) || left.createdAt.localeCompare(right.createdAt)); }
  getCatalogItem(id: string) { return readOne<CatalogItem>(catalogItemStore, id); }
  saveCatalogItem(item: CatalogItem) { return writeOne(catalogItemStore, item); }
  listActualTimeRecords() { return listAll<ActualTimeRecord>(actualTimeStore, (left, right) => right.recordedOn.localeCompare(left.recordedOn) || right.createdAt.localeCompare(left.createdAt)); }
  getActualTimeRecord(id: string) { return readOne<ActualTimeRecord>(actualTimeStore, id); }
  saveActualTimeRecord(record: ActualTimeRecord) { return writeOne(actualTimeStore, record); }
  listShortCashDeclarations() { return listAll<ShortCashDeclaration>(shortCashDeclarationStore, (left, right) => right.createdAt.localeCompare(left.createdAt)); }
  getShortCashDeclaration(id: string) { return readOne<ShortCashDeclaration>(shortCashDeclarationStore, id); }
  saveShortCashDeclaration(declaration: ShortCashDeclaration) { return writeOne(shortCashDeclarationStore, declaration); }
  async commitOrderFromDraft(order: StoredCraftOrder, draft: OrderDraft, schedule?: ScheduleEntry): Promise<StorageResult<{ order: StoredCraftOrder; draft: OrderDraft; schedule: ScheduleEntry | null }>> {
    try {
      const database = await openDatabase();
      return await new Promise(resolve => {
        const stores = schedule ? [orderStore, draftStore, scheduleStore] : [orderStore, draftStore];
        const transaction = database.transaction(stores, "readwrite");
        transaction.objectStore(orderStore).put(order);
        transaction.objectStore(draftStore).put(draft);
        if (schedule) transaction.objectStore(scheduleStore).put(schedule);
        transaction.onabort = () => resolve(failure(transaction.error));
        transaction.onerror = () => resolve(failure(transaction.error));
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
        const transaction = database.transaction([profileStore, preferencesStore, draftStore, orderStore, scheduleStore, recurrenceStore, financialEventStore, supplierPurchaseStore, cashWalletStore, cashContinuityEntryStore, materialStore, inventoryMovementStore, catalogItemStore, actualTimeStore, shortCashDeclarationStore], "readonly");
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
        const actualTimeRecords = transaction.objectStore(actualTimeStore).getAll();
        const shortCashDeclarations = transaction.objectStore(shortCashDeclarationStore).getAll();
        transaction.onerror = () => resolve(failure(transaction.error));
        transaction.onabort = () => resolve(failure(transaction.error));
        transaction.oncomplete = () => {
          database.close();
          resolve({ ok: true, value: { profile: (profile.result as ActivityProfile | undefined) ?? null, preferences: (preferences.result as LocalPreferences | undefined) ?? null, drafts: drafts.result as OrderDraft[], orders: orders.result as StoredCraftOrder[], schedules: schedules.result as ScheduleEntry[], recurrences: recurrences.result as ScheduleRecurrence[], financialEvents: financialEvents.result as FinancialEvent[], supplierPurchases: supplierPurchases.result as SupplierPurchase[], cashWallets: cashWallets.result as CashWallet[], cashContinuityEntries: cashContinuityEntries.result as CashContinuityEntry[], materials: materials.result as Material[], inventoryMovements: inventoryMovements.result as InventoryMovement[], catalogItems: catalogItems.result as CatalogItem[], actualTimeRecords: actualTimeRecords.result as ActualTimeRecord[], shortCashDeclarations: shortCashDeclarations.result as ShortCashDeclaration[] } });
        };
      });
    } catch (error) {
      return failure(error);
    }
  }
  async replaceSnapshot(snapshot: LocalStoreSnapshot): Promise<StorageResult<LocalStoreSnapshot>> {
    try {
      const database = await openDatabase();
      const normalized: LocalStoreSnapshot = { ...snapshot, schedules: snapshot.schedules ?? [], recurrences: snapshot.recurrences ?? [], financialEvents: snapshot.financialEvents ?? [], supplierPurchases: snapshot.supplierPurchases ?? [], cashWallets: snapshot.cashWallets ?? [], cashContinuityEntries: snapshot.cashContinuityEntries ?? [], materials: snapshot.materials ?? [], inventoryMovements: snapshot.inventoryMovements ?? [], catalogItems: snapshot.catalogItems ?? [], actualTimeRecords: snapshot.actualTimeRecords ?? [], shortCashDeclarations: snapshot.shortCashDeclarations ?? [] };
      return await new Promise(resolve => {
        const transaction = database.transaction([profileStore, preferencesStore, draftStore, orderStore, scheduleStore, recurrenceStore, financialEventStore, supplierPurchaseStore, cashWalletStore, cashContinuityEntryStore, materialStore, inventoryMovementStore, catalogItemStore, actualTimeStore, shortCashDeclarationStore], "readwrite");
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
        const actualTimeRecords = transaction.objectStore(actualTimeStore);
        const shortCashDeclarations = transaction.objectStore(shortCashDeclarationStore);
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
        actualTimeRecords.clear();
        shortCashDeclarations.clear();
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
        normalized.actualTimeRecords?.forEach(record => actualTimeRecords.put(record));
        normalized.shortCashDeclarations?.forEach(declaration => shortCashDeclarations.put(declaration));
        transaction.onerror = () => resolve(failure(transaction.error));
        transaction.onabort = () => resolve(failure(transaction.error));
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
