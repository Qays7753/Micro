/**
 * Browser adapter only. Components never import this directly; it holds no money
 * policy and only stores Slice 1 local profile and pre-domain draft records.
 */
import { localSchemaVersion, type ActivityProfile, type LocalPreferences, type LocalStoreSnapshot, type OrderDraft, type PrototypeLocalStore, type StorageFailure, type StorageResult, type StoredCraftOrder } from "./types";

const databaseName = "micro-prototype-local";
const profileStore = "activity-profile";
const preferencesStore = "local-preferences";
const draftStore = "order-drafts";
const orderStore = "craft-orders";

function failure(error: unknown): StorageFailure {
  return { ok: false, code: typeof indexedDB === "undefined" ? "storage_unavailable" : "storage_error", message: error instanceof Error ? error.message : "تعذر الوصول إلى التخزين المحلي." };
}

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") { reject(new Error("التخزين المحلي غير مدعوم في هذا المتصفح.")); return; }
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
      if (event.oldVersion < 4) {
        const drafts = request.transaction?.objectStore(draftStore);
        if (!drafts) return;
        const cursor = drafts.openCursor();
        cursor.onsuccess = () => {
          const current = cursor.result;
          if (!current) return;
          const legacy = current.value as Partial<OrderDraft>;
          current.update({ ...legacy, costSnapshots: Array.isArray(legacy.costSnapshots) ? legacy.costSnapshots : [], activeCostSnapshotId: legacy.activeCostSnapshotId ?? null, linkedOrderId: legacy.linkedOrderId ?? null });
          current.continue();
        };
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
  } catch (error) { return failure(error); }
}

async function writeOne<T>(storeName: string, value: T): Promise<StorageResult<T>> {
  try {
    const database = await openDatabase();
    return await new Promise(resolve => {
      const transaction = database.transaction(storeName, "readwrite");
      const request = transaction.objectStore(storeName).put(value);
      request.onerror = () => resolve(failure(request.error));
      transaction.onabort = () => resolve(failure(transaction.error));
      transaction.oncomplete = () => { database.close(); resolve({ ok: true, value }); };
    });
  } catch (error) { return failure(error); }
}

export class IndexedDbLocalStore implements PrototypeLocalStore {
  getProfile() { return readOne<ActivityProfile>(profileStore, "local-profile"); }
  saveProfile(profile: ActivityProfile) { return writeOne(profileStore, profile); }
  getPreferences() { return readOne<LocalPreferences>(preferencesStore, "local-preferences"); }
  savePreferences(preferences: LocalPreferences) { return writeOne(preferencesStore, preferences); }
  async listDrafts(): Promise<StorageResult<readonly OrderDraft[]>> {
    try {
      const database = await openDatabase();
      return await new Promise(resolve => {
        const transaction = database.transaction(draftStore, "readonly");
        const request = transaction.objectStore(draftStore).getAll();
        request.onerror = () => resolve(failure(request.error));
        request.onsuccess = () => resolve({ ok: true, value: (request.result as OrderDraft[]).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)) });
        transaction.oncomplete = () => database.close();
      });
    } catch (error) { return failure(error); }
  }
  getDraft(id: string) { return readOne<OrderDraft>(draftStore, id); }
  saveDraft(draft: OrderDraft) { return writeOne(draftStore, draft); }
  async listOrders(): Promise<StorageResult<readonly StoredCraftOrder[]>> {
    try {
      const database = await openDatabase();
      return await new Promise(resolve => {
        const transaction = database.transaction(orderStore, "readonly");
        const request = transaction.objectStore(orderStore).getAll();
        request.onerror = () => resolve(failure(request.error));
        request.onsuccess = () => resolve({ ok: true, value: (request.result as StoredCraftOrder[]).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)) });
        transaction.oncomplete = () => database.close();
      });
    } catch (error) { return failure(error); }
  }
  getOrder(id: string) { return readOne<StoredCraftOrder>(orderStore, id); }
  saveOrder(order: StoredCraftOrder) { return writeOne(orderStore, order); }
  async commitOrderFromDraft(order: StoredCraftOrder, draft: OrderDraft): Promise<StorageResult<{ order: StoredCraftOrder; draft: OrderDraft }>> {
    try {
      const database = await openDatabase();
      return await new Promise(resolve => {
        const transaction = database.transaction([orderStore, draftStore], "readwrite");
        transaction.objectStore(orderStore).put(order);
        transaction.objectStore(draftStore).put(draft);
        transaction.onabort = () => resolve(failure(transaction.error));
        transaction.onerror = () => resolve(failure(transaction.error));
        transaction.oncomplete = () => { database.close(); resolve({ ok: true, value: { order, draft } }); };
      });
    } catch (error) { return failure(error); }
  }
  async readSnapshot(): Promise<StorageResult<LocalStoreSnapshot>> {
    try {
      const database = await openDatabase();
      return await new Promise(resolve => {
        const transaction = database.transaction([profileStore, preferencesStore, draftStore, orderStore], "readonly");
        const profile = transaction.objectStore(profileStore).get("local-profile");
        const preferences = transaction.objectStore(preferencesStore).get("local-preferences");
        const drafts = transaction.objectStore(draftStore).getAll();
        const orders = transaction.objectStore(orderStore).getAll();
        transaction.onerror = () => resolve(failure(transaction.error));
        transaction.onabort = () => resolve(failure(transaction.error));
        transaction.oncomplete = () => { database.close(); resolve({ ok: true, value: { profile: (profile.result as ActivityProfile | undefined) ?? null, preferences: (preferences.result as LocalPreferences | undefined) ?? null, drafts: drafts.result as OrderDraft[], orders: orders.result as StoredCraftOrder[] } }); };
      });
    } catch (error) { return failure(error); }
  }
  async replaceSnapshot(snapshot: LocalStoreSnapshot): Promise<StorageResult<LocalStoreSnapshot>> {
    try {
      const database = await openDatabase();
      return await new Promise(resolve => {
        const transaction = database.transaction([profileStore, preferencesStore, draftStore, orderStore], "readwrite");
        const profiles = transaction.objectStore(profileStore); const preferences = transaction.objectStore(preferencesStore); const drafts = transaction.objectStore(draftStore); const orders = transaction.objectStore(orderStore);
        profiles.clear(); preferences.clear(); drafts.clear(); orders.clear();
        if (snapshot.profile) profiles.put(snapshot.profile);
        if (snapshot.preferences) preferences.put(snapshot.preferences);
        snapshot.drafts.forEach(draft => drafts.put(draft)); snapshot.orders.forEach(order => orders.put(order));
        transaction.onerror = () => resolve(failure(transaction.error));
        transaction.onabort = () => resolve(failure(transaction.error));
        transaction.oncomplete = () => { database.close(); resolve({ ok: true, value: snapshot }); };
      });
    } catch (error) { return failure(error); }
  }
}
