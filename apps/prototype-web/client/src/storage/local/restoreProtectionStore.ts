/** S02-A (SH-02/SH-03): محرك قاعدة حماية الاستبدال — قاعدة بيانات IndexedDB
 * **منفصلة** (`micro-prototype-restore`، الإصدار ١، مخزن واحد) خارج قاعدة
 * البيانات التي يستبدلها الاسترداد (`micro-prototype-local`) حرفيًا كما يفرض
 * العقد المشترك §16.3: «نسخة رجوع دائمة قابلة للوصول خارج قاعدة البيانات
 * التي ستستبدل» — فلا يمسها مخزن لقطة ولا يمكن لمعاملة الاستبدال إتلافها.
 *
 * لماذا قاعدة منفصلة وليس مخزنًا جديدًا في القاعدة الأصلية: إضافة أي مخزن
 * إلى `micro-prototype-local` ترفع إصدار قاعدة البيانات نفسه، وإصدار القاعدة
 * هو `localSchemaVersion` المحروس (٣٨) المقترن بزوج التصدير ٣٨/٣٠ المحمي
 * بقرار مالك — فالقاعدة المنفصلة هي التنفيذ الوحيد الذي يوفر الدوام الحقيقي
 * دون مس المفتاح المحروس. الجيل محلي لا يُصدَّر؛ نسخة قديمة لا تعيده أبدًا.
 *
 * العقد الذرّي داخل هذه القاعدة (سجلات: data-generation / replacement-marker
 * [نية] / replacement-receipt [إيصال] / rollback-active / rollback-pending):
 * - beginReplacementIntent: النسخة الرجوع المعلقة + النية في معاملة واحدة،
 *   **بشرط عدم وجود نية قائمة** (replacement_intent_busy) — سياج النية
 *   الواحدة داخل المعاملة نفسها فلا تعبره نوافذ متسابقة أبدًا.
 * - commitReplacementIntent: ترقية المعلقة إلى نشطة + صك الجيل + كتابة
 *   الإيصال + حذف النية في معاملة واحدة — لا نصف ترقية أبدًا.
 * - abortReplacementIntent: حذف المعلقة + حذف النية معًا — الإيصال والنسخة
 *   النشطة والجيل لا يُمسّان بمحاولة فاشلة أبدًا (عقد ٠٤٤ B4.3)؛ فالإيصال
 *   لا يضيع خلف محاولة فشلت (فصل النية عن الإيصال مقصود لهذا بالذات).
 * - الانهيار بين هذه المعاملات يحسمه مآل البصمات في النية عند القراءة
 *   التالية (SDF-051) — لا إعادة استيراد تلقائية ولا ادعاء «لم يتغير شيء».
 */
import type {
  DataGenerationRecord,
  ReplacementIntentRecord,
  ReplacementReceiptRecord,
  RestoreProtectionState,
  RestoreRollbackRecord,
  StorageResult,
} from "./types";
import { STORAGE_ERROR, STORAGE_UNAVAILABLE } from "./resultCodes";

export const restoreDatabaseName = "micro-prototype-restore";
export const restoreProtectionStoreName = "restore-protection";
export const restoreDatabaseVersion = 1;

const generationId: DataGenerationRecord["id"] = "data-generation";
const intentId: ReplacementIntentRecord["id"] = "replacement-marker";
const receiptId: ReplacementReceiptRecord["id"] = "replacement-receipt";
const activeRollbackId: RestoreRollbackRecord["id"] = "rollback-active";
const pendingRollbackId: RestoreRollbackRecord["id"] = "rollback-pending";

/** اتصال واحد مُخزَّن على مستوى الوحدة (نمط S5-07 في القاعدة الأصلية) — لا
 * مصافحة open لكل عملية؛ القاعدة لا تُرقّى أبدًا (الإصدار ١ نهائي) فلا
 * versionchange ولا onblocked لها معنى هنا. */
let cachedConnection: Promise<IDBDatabase> | null = null;

function openRestoreDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") {
      reject(new Error("التخزين المحلي غير مدعوم في هذا المتصفح."));
      return;
    }
    const request = indexedDB.open(restoreDatabaseName, restoreDatabaseVersion);
    request.onupgradeneeded = () => {
      /* المُنشئ المحروس — الإصدار الوحيد؛ يُنشئ المخزن مرة ولا يمس شيئًا
       * بعدها أبدًا (نمط الترقيات المحروسة في القاعدة الأصلية). */
      if (!request.result.objectStoreNames.contains(restoreProtectionStoreName)) {
        request.result.createObjectStore(restoreProtectionStoreName, { keyPath: "id" });
      }
    };
    request.onerror = () => reject(request.error ?? new Error("تعذر فتح تخزين حماية الاستبدال."));
    request.onsuccess = () => {
      const database = request.result;
      /* الإصدار لا يرقى أبدًا، لكن حذف قاعدة الاختبار للبيئة (أو تصفح خاص)
       * يرسل versionchange — الاتصال يُقال فورًا فلا يحجب الحذف أبدًا (نمط
       * S5-07 في القاعدة الأصلية نفسه). */
      database.onversionchange = () => {
        if (cachedConnection !== null) cachedConnection = null;
        database.close();
      };
      resolve(database);
    };
  });
}

function connection(): Promise<IDBDatabase> {
  if (cachedConnection === null) {
    const promise = openRestoreDatabase();
    promise.catch(() => {
      if (cachedConnection === promise) cachedConnection = null;
    });
    cachedConnection = promise;
  }
  return cachedConnection;
}

function restoreFailure(error: unknown): StorageResult<never> {
  return {
    ok: false,
    code: typeof indexedDB === "undefined" ? STORAGE_UNAVAILABLE : STORAGE_ERROR,
    message: error instanceof Error ? error.message : "تعذر الوصول إلى تخزين حماية الاستبدال.",
  };
}

/** @internal فحص ذاكرة الاتصال للاختبار — النمط المعتمد في indexedDbLifecycle. */
export function __restoreConnectionForTesting(): Promise<IDBDatabase> | null {
  return cachedConnection;
}

export async function readRestoreProtectionState(): Promise<StorageResult<RestoreProtectionState>> {
  try {
    const database = await connection();
    return await new Promise<StorageResult<RestoreProtectionState>>(resolve => {
      const transaction = database.transaction(restoreProtectionStoreName, "readonly");
      const store = transaction.objectStore(restoreProtectionStoreName);
      const generationRequest = store.get(generationId);
      const intentRequest = store.get(intentId);
      const receiptRequest = store.get(receiptId);
      const activeRequest = store.get(activeRollbackId);
      const pendingRequest = store.get(pendingRollbackId);
      transaction.onerror = () => resolve(restoreFailure(transaction.error));
      transaction.onabort = () => resolve(restoreFailure(transaction.error));
      transaction.oncomplete = () => {
        const generationRecord = generationRequest.result as DataGenerationRecord | undefined;
        resolve({
          ok: true,
          value: {
            generation: generationRecord?.generation ?? 0,
            intent: (intentRequest.result as ReplacementIntentRecord | undefined) ?? null,
            receipt: (receiptRequest.result as ReplacementReceiptRecord | undefined) ?? null,
            activeRollback: (activeRequest.result as RestoreRollbackRecord | undefined) ?? null,
            pendingRollback: (pendingRequest.result as RestoreRollbackRecord | undefined) ?? null,
          },
        });
      };
    });
  } catch (error) {
    return restoreFailure(error);
  }
}

export async function readDataGeneration(): Promise<StorageResult<number>> {
  const state = await readRestoreProtectionState();
  if (!state.ok) return state;
  return { ok: true, value: state.value.generation };
}

/** النية + نسختها الرجوع المعلقة في معاملة واحدة **بشرط خلوها من نية قائمة**
 * — فشل أي جزء يفشل الاثنين معًا فلا نية مسجلة بلا حماية تحت يدها (شرط
 * البدء قبل أي كتابة تخزينية مدمّرة — SDF-049)، وسباق نافذتين يصده الشرط
 * داخل المعاملة نفسها فلا تُدمَّر نية الأولى أبدًا (replacement_intent_busy). */
export async function beginReplacementIntent(
  pending: RestoreRollbackRecord,
  intent: ReplacementIntentRecord,
): Promise<StorageResult<null>> {
  try {
    const database = await connection();
    return await new Promise<StorageResult<null>>(resolve => {
      const transaction = database.transaction(restoreProtectionStoreName, "readwrite");
      const store = transaction.objectStore(restoreProtectionStoreName);
      const existingIntentRequest = store.get(intentId);
      let busy = false;
      existingIntentRequest.onsuccess = () => {
        if (existingIntentRequest.result !== undefined) {
          busy = true;
          return;
        }
        /* الكتابتان تُصدران داخل رد القراءة في المعاملة نفسها — سلسلة
         * تزامنية واحدة فلا تلتزم المعاملة قبل اكتمالهما. */
        store.put(pending);
        store.put(intent);
      };
      transaction.onerror = () => resolve(restoreFailure(transaction.error));
      transaction.onabort = () => resolve(restoreFailure(transaction.error));
      transaction.oncomplete = () => {
        if (busy)
          resolve({
            ok: false,
            code: "replacement_intent_busy",
            message: "عملية استبدال أخرى قيد الحسم — لن تبدأ عملية ثانية فوقها.",
          });
        else resolve({ ok: true, value: null });
      };
    });
  } catch (error) {
    return restoreFailure(error);
  }
}

/** التزام الاستبدال: ترقية النسخة المعلقة إلى نشطة + صك الجيل الجديد +
 * كتابة الإيصال + حذف النية — معاملة واحدة؛ الانهيار قبلها يترك النية
 * قائمة فيحسمه مآل البصمات عند القراءة التالية (لا نجاح مزدوج ولا نصف
 * ترقية). */
export async function commitReplacementIntent(
  generation: number,
  receipt: ReplacementReceiptRecord,
  resolvedAt: string,
): Promise<StorageResult<null>> {
  try {
    const database = await connection();
    return await new Promise<StorageResult<null>>(resolve => {
      const transaction = database.transaction(restoreProtectionStoreName, "readwrite");
      const store = transaction.objectStore(restoreProtectionStoreName);
      const pendingRequest = store.get(pendingRollbackId);
      pendingRequest.onsuccess = () => {
        const pendingRecord = pendingRequest.result as RestoreRollbackRecord | undefined;
        if (pendingRecord !== undefined) {
          store.put({ ...pendingRecord, id: activeRollbackId });
          store.delete(pendingRollbackId);
        }
        store.put({ ...receipt, id: receiptId } satisfies ReplacementReceiptRecord);
        store.delete(intentId);
        store.put({ id: generationId, generation, updatedAt: resolvedAt } satisfies DataGenerationRecord);
      };
      transaction.onerror = () => resolve(restoreFailure(transaction.error));
      transaction.onabort = () => resolve(restoreFailure(transaction.error));
      transaction.oncomplete = () => resolve({ ok: true, value: null });
    });
  } catch (error) {
    return restoreFailure(error);
  }
}

/** إحباط نية: حذف المعلقة + حذف النية معًا — الإيصال والنسخة النشطة
 * والجيل كما هي؛ محاولة فاشلة لا تستبدل النسخة الجيدة ولا تمحو إيصالًا
 * أبدًا (عقد ٠٤٤ B4.3). */
export async function abortReplacementIntent(): Promise<StorageResult<null>> {
  try {
    const database = await connection();
    return await new Promise<StorageResult<null>>(resolve => {
      const transaction = database.transaction(restoreProtectionStoreName, "readwrite");
      const store = transaction.objectStore(restoreProtectionStoreName);
      store.delete(pendingRollbackId);
      store.delete(intentId);
      transaction.onerror = () => resolve(restoreFailure(transaction.error));
      transaction.onabort = () => resolve(restoreFailure(transaction.error));
      transaction.oncomplete = () => resolve({ ok: true, value: null });
    });
  } catch (error) {
    return restoreFailure(error);
  }
}
