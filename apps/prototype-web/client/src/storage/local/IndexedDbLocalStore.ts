/**
 * Browser adapter only. Components never import this directly; it holds no money
 * policy and only stores Slice 1 local profile and pre-domain draft records.
 */
import { localSchemaVersion, type ActivityProfile, type OrderDraft, type PrototypeLocalStore, type StorageFailure, type StorageResult } from "./types";

const databaseName = "micro-prototype-local";
const profileStore = "activity-profile";
const draftStore = "order-drafts";

function failure(error: unknown): StorageFailure {
  return { ok: false, code: typeof indexedDB === "undefined" ? "storage_unavailable" : "storage_error", message: error instanceof Error ? error.message : "تعذر الوصول إلى التخزين المحلي." };
}

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") { reject(new Error("التخزين المحلي غير مدعوم في هذا المتصفح.")); return; }
    const request = indexedDB.open(databaseName, localSchemaVersion);
    request.onerror = () => reject(request.error ?? new Error("تعذر فتح التخزين المحلي."));
    request.onblocked = () => reject(new Error("التخزين المحلي مفتوح في نافذة أخرى."));
    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(profileStore)) database.createObjectStore(profileStore, { keyPath: "id" });
      if (!database.objectStoreNames.contains(draftStore)) {
        const drafts = database.createObjectStore(draftStore, { keyPath: "id" });
        drafts.createIndex("updatedAt", "updatedAt");
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
}
