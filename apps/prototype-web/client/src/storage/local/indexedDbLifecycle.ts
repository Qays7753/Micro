/** IndexedDB connection lifecycle: open/blocked/version-change plumbing and failure
 * mapping, extracted verbatim from the adapter (Group 10, Phase 10-B). The upgrade body
 * itself lives in indexedDbMigrations; this module owns the connection cache (S5-07).
 */
import { applySchemaUpgrade, staleConnections, StorageOpenError, upgradeErrors } from "./indexedDbMigrations";
import { databaseName } from "./indexedDbStores";
import { localSchemaVersion, type StorageFailure, type StorageFailureCode } from "./types";

/* S5-07 (المجموعة ٦ — البند ٦): اتصال واحد مُخزَّن على مستوى الوحدة. الفتح لكل
 * عملية كان يدفع مصافحة open كاملة لكل قراءة/كتابة (قياس ٥٣ فتحًا لتحميل
 * «مالي» واحد). الاتصال يُقال من الذاكرة عند versionchange (نافذة أخرى رقّت
 * النسخة) فلا يحجب ترقيةً أبدًا، وفشل الفتح لا يدنس الذاكرة — المحاولة
 * التالية تفتح من جديد. VersionError بعد إقالة الاتصال يُعلن storage_stale
 * بصدق (G6-P4-2) — لا إعادة محاولة تلقائية تخفي قدم البيانات. */
let cachedConnection: Promise<IDBDatabase> | null = null;

export function connection(): Promise<IDBDatabase> {
  if (cachedConnection === null) {
    const promise = openDatabase();
    promise.catch(() => {
      if (cachedConnection === promise) cachedConnection = null;
    });
    cachedConnection = promise;
  }
  return cachedConnection;
}

export function failure(error: unknown, database?: IDBDatabase): StorageFailure {
  if (database && staleConnections.has(database)) {
    return {
      ok: false,
      code: "storage_stale",
      message: "هذه النسخة قديمة. أعد تحميل Micro قبل إدخال بيانات جديدة.",
    };
  }
  if (error instanceof StorageOpenError) return { ok: false, code: error.code, message: error.message };
  /* G6-P4-2 (المجموعة ٦): إقالة الاتصال بعد ترقية في نافذة أخرى تجعل
   * المعاملات التالية VersionError — ذلك قدمٌ معلن لا «خطأ تخزين» عام. */
  if (error instanceof Error && error.name === "VersionError") {
    return {
      ok: false,
      code: "storage_stale",
      message: "هذه النسخة قديمة. أعد تحميل Micro قبل إدخال بيانات جديدة.",
    };
  }
  return {
    ok: false,
    code: typeof indexedDB === "undefined" ? "storage_unavailable" : "storage_error",
    message: error instanceof Error ? error.message : "تعذر الوصول إلى التخزين المحلي.",
  };
}

export function attachVersionChangeRecovery(database: IDBDatabase): IDBDatabase {
  database.onversionchange = () => {
    staleConnections.add(database);
    /* S5-07: الإقالة الفورية للاتصال المخزَّن — ترقية نافذة أخرى لا تُحجب
     * أبدًا، والعملية التالية هنا تفتح نسخة جديدة أو تعلن قدمها بصدق. */
    cachedConnection = null;
    database.close();
  };
  return database;
}

export function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") {
      reject(new Error("التخزين المحلي غير مدعوم في هذا المتصفح."));
      return;
    }
    const request = indexedDB.open(databaseName, localSchemaVersion);
    let settled = false;
    request.onerror = () => {
      if (settled) return;
      settled = true;
      reject(upgradeErrors.get(request) ?? request.error ?? new Error("تعذر فتح التخزين المحلي."));
    };
    request.onblocked = () => {
      if (settled) return;
      settled = true;
      reject(
        new StorageOpenError(
          "storage_blocked",
          "Micro مفتوح في نافذة أخرى. أغلق النوافذ الأخرى ثم أعد المحاولة.",
        ),
      );
      /* المجموعة ٢ (التحصين الكامل — RISK-003): النجاح المتأخر بعد الرفض
       * يعالجه معالج onsuccess النهائي أسفل الدالة — يغلق الاتصال اليتيم. */
    };
    request.onupgradeneeded = event => {
      applySchemaUpgrade(request, event);
    };
    request.onsuccess = () => {
      if (settled) {
        /* المجموعة ٢ (التحصين الكامل — RISK-003): نجاح متأخر بعد رفض
         * onblocked — وعد الرفض حُسم فلا مالك لهذا الاتصال؛ يُغلق فورًا
         * كي لا يبقى مفتوحًا يحجب ترقيات المستقبل ولا وعد معلق بلا حسم. */
        try {
          request.result.close();
        } catch {
          /* الاتصال قد يكون مغلقًا سلفًا — لا شيء للتصحيح. */
        }
        return;
      }
      settled = true;
      resolve(attachVersionChangeRecovery(request.result));
    };
  });
}

/** @internal Test seam for exercising the adapter’s versionchange recovery with fake-indexeddb. */
export function __openDatabaseForTesting(): Promise<IDBDatabase> {
  return openDatabase();
}

/** @internal S5-07: إعادة الاتصال المخزَّن لحالة الاختبار (يفحص أن ذاكرة الاتصال تُقال). */
export function __cachedConnectionForTesting(): Promise<IDBDatabase> | null {
  return cachedConnection;
}
