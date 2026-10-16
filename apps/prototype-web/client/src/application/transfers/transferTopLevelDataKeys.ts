/**
 * R11 W2b / OD-KEYS — W2-2 (تفعيل 2026-10-16، موجة المتابعة الموحدة):
 * رفض مفاتيح `data` العلوية المجهولة في ملف النقل **للزوج الحالي وحده**
 * `(schemaVersion = 38, version/export = 30)` بالحمولة المعتمدة من المالك
 * حرفيًا (رمز `validation_error` عبر الثابت الكنوني القائم + النص العربي
 * الدقيق) — القرار مسجل append-only في
 * `docs/architecture/refactoring/r11-unified-followup-20261016/evidence/W2B-OWNER-PAYLOAD-ADDENDUM-2026-10-16.md`.
 *
 * الاشتقاق (لا قائمة يدوية تتقادم):
 * - مفاتيح العائلات المصفوفية الـ31 من السجل الكنوني `TRANSFER_ARRAY_FAMILY_ROLES`
 *   (المكتمل وقت الترجمة satisfiesً على مفاتيح اللقطة المصفوفية).
 * - المفاتيح غير العائلية الأربعة التي يصدرها المصدّر فعليًا
 *   (`profile`/`ownerProfile`/`preferences`/`inventoryActivation`) — سجل Record
 *   مستنفد وقت الترجمة على مفاتيح اللقطة غير المصفوفية: أي حقل لقطة جديد غير
 *   مصفوفي يكسر البناء حتى يُسجل هنا بقراره، ويطابق الاشتقاقَ الاختباري من
 *   جسد المصدّر (meta-test في أطقم W2b يثبت التكافؤ مع مفاتيح اللقطة الفارغة
 *   الكنونية ومخرجات المصدّر الحية).
 *
 * الأسبقية: الفحص يعمل في `prepareImport` بعد بوابة العدادات حصرًا — الموضع
 * الوحيد الذي أثبت توصيف W2a أنه لا يعيد ترتيب أي من الرفوضات السبع القائمة.
 * الإرث (الأزواج الـ24) لا يُفحص أصلًا — مقبول كما كان.
 */
import type { LocalStoreSnapshot } from "@/storage/local/types";
import { TRANSFER_ARRAY_FAMILY_ROLES } from "./transferArrayFamilyRoles";

/** مفاتيح اللقطة غير العائلية (غير المصفوفية) — استنفاد وقت الترجمة. */
type NonFamilySnapshotKey = Exclude<keyof LocalStoreSnapshot, keyof typeof TRANSFER_ARRAY_FAMILY_ROLES>;

const NON_FAMILY_TOP_LEVEL_DATA_KEYS: Record<NonFamilySnapshotKey, true> = {
  profile: true,
  ownerProfile: true,
  preferences: true,
  inventoryActivation: true,
};

/** المجموعة المسموحة الكاملة (35 اليوم: 31 عائلة + 4 غير عائلية). */
export const ALLOWED_TOP_LEVEL_DATA_KEYS: ReadonlySet<string> = new Set<string>([
  ...Object.keys(TRANSFER_ARRAY_FAMILY_ROLES),
  ...Object.keys(NON_FAMILY_TOP_LEVEL_DATA_KEYS),
]);

/** أول مفتاح data علوي مجهول أو null حين تكون كل المفاتيح مسموحة.
 * لا يُعاد اسم المفتاح في أي رسالة مستخدم أبدًا — الاستخدام الداخلي
 * للتشخيص الاختباري فقط (لا صدى أسماء). */
export function findUnknownTopLevelDataKey(data: Record<string, unknown>): string | null {
  for (const key of Object.keys(data)) {
    if (!ALLOWED_TOP_LEVEL_DATA_KEYS.has(key)) return key;
  }
  return null;
}

/** حمولة الرفض المعتمدة حرفيًا من المالك (W2b — الزوج الحالي وحده). */
export const W2B_UNKNOWN_TOP_LEVEL_DATA_KEY_MESSAGE =
  "تعذّر استيراد الملف لأنه يحتوي على أقسام بيانات غير معروفة لهذا الإصدار. بقيت بيانات هذا الجهاز دون تغيير.";
