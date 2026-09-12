/** Transfer envelope rules: the released export/schema pair gate and the
 * integrity (sha256) verification, extracted verbatim from
 * localTransferService.prepareImport (Group 10, Phase 10-D). Accepted pairs,
 * error messages, and rejection order are unchanged.
 */
import { syncSha256Hex } from "@/lib/syncSha256";
import {
  localExportVersion,
  localSchemaVersion,
  type LocalExportCounts,
  type LocalStoreSnapshot,
} from "@/storage/local/types";
import { isRecord } from "./transferFamilyValidators";

export const RELEASED_LEGACY_EXPORT_PAIRS: ReadonlySet<string> = new Set([
  "26/34", // المجموعة ٤ كما صدرت فعلًا (بلا مظروف التكامل)
  "25/33", // المجموعة ٤ قبل الأصول والقروض
  "24/32", // ربط المنتج بالبيع
  "23/31", // مخزون انتقائي
  "22/30", // تصنيفي للمصاريف
  "21/29", // ملف المالك — سابقًا
  "20/28", // موجة إعادة التدفق
  "19/27", // القرار ٩: بلا سجل تفعيل المخزون
  "18/27", // S5-05: حملت مخطط ٢٧ حرفيًا (زوج صدر فعلًا)
  "17/26", // تصعيد الكتالوج الأساسي (دمج G3–G5)
  "16/25", // توسيع G4b
  "15/24", // الجسر
  "14/23", // نواة الكتالوج (O1)
  "13/22", // O1 — أرصدة حق المالك
  "12/21", // O1 — سياسات حق المالك
  "11/20", // G3
  "10/19", // G5 — التصريحات
  "9/18", // G4 — الوقت الفعلي
  "8/17", // D-1: زوج الالتزام 570eba1 — محتمل الاستخدام الميداني
  "7/15", // G3 الحالي — إرث
  "6/14", // G3 إرث
]);

export function isCurrentPair(candidate: Record<string, unknown>): boolean {
  return candidate.version === localExportVersion && candidate.schemaVersion === localSchemaVersion;
}

export function isReleasedLegacyPair(candidate: Record<string, unknown>): boolean {
  return (
    typeof candidate.version === "number" &&
    typeof candidate.schemaVersion === "number" &&
    RELEASED_LEGACY_EXPORT_PAIRS.has(candidate.version + "/" + candidate.schemaVersion)
  );
}

/** تحقق التكامل — يُعيد رسالة الرفض أو null عند القبول (نفس منطق
 * prepareImport الحرفي: البصمة الحاضرة تُتحقق، المعطوبة تُرفض، والحالية
 * بلا بصمة تُرفض؛ القديمة بلا بصمة على مسارها الموروث). */
export function verifyTransferIntegrity(
  candidate: Record<string, unknown>,
  isCurrent: boolean,
): string | null {
  if (isRecord(candidate.integrity)) {
    const algorithm = candidate.integrity["algorithm"];
    const digest = candidate.integrity["digest"];
    if (algorithm !== "sha256" || typeof digest !== "string")
      return "كتلة التكامل في الملف معطوبة (خوارزمية أو بصمة غير صالحة)؛ لا يمكن الاعتماد عليه. بقيت بيانات هذا الجهاز دون تغيير.";
    if (syncSha256Hex(JSON.stringify(candidate.data)) !== digest)
      return "تُغيّر الملف بعد إنشائه فبصمة التكامل لا تطابقه؛ لا تعتمد عليه. بقيت بيانات هذا الجهاز دون تغيير.";
  } else if (isCurrent) {
    /* عقد الإغلاق العميق (AV-04 — تلاعب المظروف): ملف الإصدار الحالي يُنشأ
     * دومًا ببصمة تكامل وعدادات — حذفهما من ملف حالٍ تلاعبٌ يتخطى الفحصين؛ يُرفض كما تُرفض البصمة المعطوبة. الملفات القديمة (قبل
     * المظروف) على مسارها الموروث. */
    return "ملف الإصدار الحالي بلا بصمة تكامل — يبدو أن الملف فُتح وعُدّل وحُذف مظروف التحقق منه؛ لا يعتمد عليه. بقيت بيانات هذا الجهاز دون تغيير.";
  }
  return null;
}
