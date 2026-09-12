/** IndexedDB single-record and list primitives shared by the adapter's methods,
 * extracted verbatim (Group 10, Phase 10-B). Transaction scope and commit ordering are
 * unchanged: each primitive opens the cached connection and resolves exactly as before.
 */
import { connection, failure } from "./indexedDbLifecycle";
import type { StorageResult } from "./types";

export async function readOne<T>(storeName: string, key: string): Promise<StorageResult<T | null>> {
  try {
    const database = await connection();
    return await new Promise(resolve => {
      const transaction = database.transaction(storeName, "readonly");
      const request = transaction.objectStore(storeName).get(key);
      request.onerror = () => resolve(failure(request.error, database));
      request.onsuccess = () => resolve({ ok: true, value: (request.result as T | undefined) ?? null });
      transaction.oncomplete = () => {};
    });
  } catch (error) {
    return failure(error);
  }
}

export async function writeOne<T>(storeName: string, value: T): Promise<StorageResult<T>> {
  try {
    const database = await connection();
    return await new Promise(resolve => {
      const transaction = database.transaction(storeName, "readwrite");
      const request = transaction.objectStore(storeName).put(value);
      request.onerror = () => resolve(failure(request.error, database));
      transaction.onabort = () => resolve(failure(transaction.error, database));
      transaction.oncomplete = () => {
        resolve({ ok: true, value });
      };
    });
  } catch (error) {
    return failure(error);
  }
}

/* حتمية داخل المعاملة (إصلاح P0 — الإرسال المتزامن المزدوج): الفحص خارج
 * المعاملة (قراءة ثم كتابة) يسمح لنداءين متزامنين بمفتاح واحد بالمرور معًا
 * فيُخزَّن السجل مرتين ويُقترن المحفظة مرتين. هنا يُفحص المفتاح داخل معاملة
 * الكتابة نفسها: إن وُجد سجل سابق بنفس المفتاح يُعاد كما هو دون كتابة ثانية —
 * نفس عقد commitOrderDelivery/commitFinancialEventCorrection لا مسار ثانٍ. */
export async function writeOneIdempotent<T>(
  storeName: string,
  value: T,
  isDuplicate: (existing: T) => boolean,
): Promise<StorageResult<T>> {
  try {
    const database = await connection();
    return await new Promise(resolve => {
      const transaction = database.transaction(storeName, "readwrite");
      const store = transaction.objectStore(storeName);
      const scanRequest = store.getAll();
      scanRequest.onerror = () => resolve(failure(scanRequest.error, database));
      scanRequest.onsuccess = () => {
        const existing = (scanRequest.result as T[]).find(isDuplicate);
        if (existing) {
          resolve({ ok: true, value: existing });
          return;
        }
        const putRequest = store.put(value);
        putRequest.onerror = () => resolve(failure(putRequest.error, database));
      };
      transaction.onabort = () => resolve(failure(transaction.error, database));
      transaction.onerror = () => resolve(failure(transaction.error, database));
      transaction.oncomplete = () => {
        resolve({ ok: true, value });
      };
    });
  } catch (error) {
    return failure(error);
  }
}

/* القرار ٢١: حذف المسودة غير المرتبطة — حذف سجل بلا أثر مالي؛ لا يمس أحداث طلب. */
export async function deleteOne(storeName: string, key: string): Promise<StorageResult<null>> {
  try {
    const database = await connection();
    return await new Promise(resolve => {
      const transaction = database.transaction(storeName, "readwrite");
      const request = transaction.objectStore(storeName).delete(key);
      request.onerror = () => resolve(failure(request.error, database));
      transaction.onabort = () => resolve(failure(transaction.error, database));
      transaction.oncomplete = () => {
        resolve({ ok: true, value: null });
      };
    });
  } catch (error) {
    return failure(error);
  }
}

export async function listAll<T>(
  storeName: string,
  sort: (left: T, right: T) => number,
): Promise<StorageResult<readonly T[]>> {
  try {
    const database = await connection();
    return await new Promise(resolve => {
      const transaction = database.transaction(storeName, "readonly");
      const request = transaction.objectStore(storeName).getAll();
      request.onerror = () => resolve(failure(request.error, database));
      request.onsuccess = () => resolve({ ok: true, value: (request.result as T[]).sort(sort) });
      transaction.oncomplete = () => {};
    });
  } catch (error) {
    return failure(error);
  }
}
