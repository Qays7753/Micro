import { STORAGE_ERROR as _storageError, STORAGE_STALE as _storageStale } from "@/storage/local/resultCodes";

/**
 * ADR-012 (Wave B — امتداد شريحة الضغط إلى طبقة التطبيق، 2026-10-03):
 * مفردات أكواد نتائج خدمات التطبيق — قيم حرفية واحدة لكل كود يشترك فيه
 * مئات مواقع البناء (`code: "validation_error"` وأخواتها: ~440 موقع قيمة
 * في 35+ ملفًا). كل ثابت يحمل الحرفية نفسها التي يستبدلها (`as const` يثبت
 * النوع الحرفي) — لا تغيير في هوية النتائج ولا في الرسائل ولا في اتحادات
 * الأنواع (مواقع الأنواع بصيغة `"x" |` لا تُمس). أكواد التخزين تعاد من
 * مفردات التخزين نفسها (تعريف واحد لا اثنان). الهدف: توسيع هامش الميزانية
 * (RAW/GZIP) لتمكين أبواب الوحدات العامة (STR-615) ضمن السقفين.
 */
export const VALIDATION_ERROR = "validation_error" as const;
export const NOT_FOUND = "not_found" as const;
export const CONFLICT = "conflict" as const;
export const INVALID_STATE = "invalid_state" as const;
export const UNKNOWN_ERROR = "unknown_error" as const;

export const STORAGE_ERROR: "storage_error" = _storageError;
export const STORAGE_STALE: "storage_stale" = _storageStale;

/* Wave F (STR-608 — تكثيف هامش GZIP، 2026-10-04): مفردات رسائل الفشل القرائي
 * المشتركة عبر بيوت التطبيق — الحرفية الواحدة كانت تتكرر في حزمة الدخول
 * ٩–١٣ مرة (المُصغِّر لا يدمج النصوص)؛ الثابت الواحد يستبدل كل المواقع
 * بالحرفية نفسها بلا أي تغيير رسالة — امتداد مباشر لغاية ADR-012 نفسها. */
export const ORDER_UNAVAILABLE_MESSAGE = "الطلب غير متاح محليًا.";
export const ORDER_READ_FAILED_MESSAGE = "تعذر قراءة الطلب المحلي.";
export const FINANCIAL_EVENTS_READ_FAILED_MESSAGE = "تعذر قراءة سجل الأحداث المالية.";
export const ORDERS_READ_FAILED_MESSAGE = "تعذر قراءة الطلبات المحلية.";

/* Wave F (STR-608 — تكثيف هامش GZIP، 2026-10-04): معين رسالة الخطأ الملتقط
 * الواحد — النمط `errorMessageOf(error, "البديل")` كان
 * يتكرر ١٠٤ مواقع عبر ٢٣ ملفًا فيطبعه المُصغِّر في حزمة الدخول كل مرة؛
 * المعين الواحد يستبدلها بالتقييم نفسه حرفيًا (نمط ADR-012 نفسه). */
export function errorMessageOf(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback;
}
