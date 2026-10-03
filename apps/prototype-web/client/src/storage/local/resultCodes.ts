import type { StorageFailureCode } from "./types.js";

/**
 * ADR-012 (Wave B — شريحة 1، 2026-10-03): مفردات أكواد فشل التخزين.
 *
 * كل ثابت يحمل الحرفية نفسها التي يستبدلها (`as const` يثبت النوع الحرفي
 * نفسه) — لا تغيير في هوية النتائج ولا في رسائلها ولا في الاتحاد الحاكم
 * `StorageFailureCode` في `types.ts` (السلطة النوعية تبقى هناك). الهدف
 * الوحيد: إزالة تكرار حرفيات الأكواد عبر المحوّلين والافتتاح والترحيلات
 * (122+ موقعًا) لتوسيع هامش ميزانية الحزمة مع بقاء السلوك بالبايت كما هو.
 *
 * الاستخدام: `code: STORAGE_ERROR` بدل `code: "storage_error"` — القيم
 * متطابقة وقت التشغيل؛ الاختبارات (conformance/goldens/الأجنحة) تشهد
 * على ثبات هوية الفشل قبل وبعد.
 */
export const STORAGE_ERROR = "storage_error" as const;
export const STORAGE_STALE = "storage_stale" as const;
export const STORAGE_UNAVAILABLE = "storage_unavailable" as const;
export const STORAGE_UPGRADE_FAILED = "storage_upgrade_failed" as const;
export const STORAGE_BLOCKED = "storage_blocked" as const;

/** الاتحاد الحاكم كما هو في types.ts — يعاد تصديره للتيسير فقط. */
export type { StorageFailureCode };
