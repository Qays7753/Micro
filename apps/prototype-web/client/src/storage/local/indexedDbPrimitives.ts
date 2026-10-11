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
        /* R9-GA-F7 (استمرار R9): أي رمي متزامن داخل مستمع النجاح (put بعنصر
         * غير قابل للاستنساخ، أو خطأ في فاحص التكرار) لم يكن يُلتقط — فاعتمد
         * السلوك على معالجة المحرك لاستثناء المستمع (إحباط مع فقدان حمولة
         * الخطأ الأصلي، أو ما هو أسوأ على محرك لا يحترمها). الالتقاط هنا
         * يجعل الفشل حتميًا ببنية الكود: إحباط محرس + فشل صادق بالخطأ الأصلي. */
        try {
          const existing = (scanRequest.result as T[]).find(isDuplicate);
          if (existing) {
            resolve({ ok: true, value: existing });
            return;
          }
          const putRequest = store.put(value);
          putRequest.onerror = () => resolve(failure(putRequest.error, database));
        } catch (error) {
          resolve(failure(error, database));
          try {
            transaction.abort();
          } catch {
            /* المعاملة انتهت فعلًا — لا شيء يُحبَط. */
          }
        }
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
      /* R9-GA-F7.1 (استمرار R9 الجذري — الوجه القرائي لعائلة F7): جسم
       * المستمع كان يستدعي مقارن ترتيب المستدعي داخل onsuccess بلا التقاط
       * — أي رمي متزامن (سجل مشوّه يُفشِل المقارن) يهرب إلى المحرك فلا
       * يُحسم الوعد أبدًا (لا onabort ولا oncomplete يسلّم) وتبقى الصفحة
       * في التحميل الأبدي. الالتقاط هنا يحسم الفشل بالخطأ الأصلي وفق عقد
       * النتائج المعلن — معاملة قراءة لا كتابة فيها فلا إحباط مطلوبًا. */
      request.onsuccess = () => {
        try {
          resolve({ ok: true, value: (request.result as T[]).sort(sort) });
        } catch (error) {
          resolve(failure(error, database));
        }
      };
      transaction.oncomplete = () => {};
    });
  } catch (error) {
    return failure(error);
  }
}
