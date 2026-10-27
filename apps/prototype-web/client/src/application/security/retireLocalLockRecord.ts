/**
 * S02-B (SH-04 — UNIT-042، قرار المالك المعتمد 2026-10-24): تقاعد سجل القفل
 * المحلي — تنظيف موثق لمرة واحدة عند الإقلاع، لا إزالة للمخزن.
 *
 * عقد التقاعد:
 * - مخزن `local-security` تاريخ مجمّد في المخطط ٣٨ المحروس: لا يُحذف المخزن
 *   (حذفه يرفع إصدار قاعدة البيانات = مفتاح محروس بقرار مالك) — يُحذف
 *   **السجل** فقط، وهو قفل-بحت بجرد موثق: بصمة الرمز والملح وخوارزميتهما
 *   ومدة الخمول وآخر نشاط وعدّاد المحاولات ووقفته (LocalSecurityRecord
 *   كلها حقول قفل؛ لا مال ولا أعمال ولا هوية مالك فيها).
 * - لا يُطلب الرمز القديم أبدًا لتشغيل النسخة الجديدة؛ البيئة التي فُعِّل
 *   فيها القفل سابقًا تفتح دون غطاء (الغطاء نفسه حُذف مع مكوّنه)، وتُنظَّف
 *   مادة PIN بمعروف: سجل حادثة تشخيصية آمنة (لا أسرار فيها أبدًا) إن نجح
 *   التنظيف، وحادثة صادقة إن فشل — الفشل لا يحبس المستخدم خلف غطاء ملغى
 *   ولا يمحو بياناته ولا يوقف الإقلاع.
 * - لا بديل مصادقة: لا بصمة ولا رمز جهاز ولا حساب دخول (قرار الإلغاء
 *   الكامل)؛ حراس بيانات ٠٤٤ (المعاينة والتأكيد والنسخة الرجوع الدائمة
 *   والسياج) مستقلة عن القفل وتبقى كما هي.
 * - استيراد/استعادة نسخة قديمة لا يعيد القفل أبدًا: مخزن local-security
 *   خارج اللقطة والتصدير أصلًا (مانيفست الكيانات الدائمة)، ولا يوجد بعد
 *   اليوم أي كاتب له في مسارات المنتج.
 */
import type { PrototypeLocalStore } from "@/storage/local/types";
import { localDiagnostics } from "@/application/diagnostics/localDiagnosticsService";
import { routeTemplateFor } from "@/application/diagnostics/routeTemplate";

export type LockRetirementOutcome =
  { status: "cleaned" } | { status: "nothing-to-clean" } | { status: "cleanup-failed" };

/** عدسة المخزن التي يحتاجها التقاعد — القراءة والكتابة عبر المنفذ وحده. */
type LockRetirementStore = Pick<PrototypeLocalStore, "getLocalSecurity" | "deleteLocalSecurity">;

/** التنظيف الفاشل يُوثق تشخيصيًا بلا أسرار — رمز الحادثة الثابت وحجم تقني
 * فقط؛ النجاح ليس حادثة (لا ضجيج في حلقة التشخيص المحدودة) ودليله قراءة
 * السجل بعدها: null. */
function recordCleanupFailure(reason: "read-failed" | "delete-failed"): void {
  try {
    localDiagnostics.recordIncident({
      operation: `retire-local-lock-record:${reason}`,
      errorCode: "lock_record_cleanup_failed",
      routeTemplate: routeTemplateFor(globalThis.location?.pathname ?? "/"),
    });
  } catch {
    /* التشخيص المحلي المحدود لا يعطل الإقلاع أبدًا — النتيجة تُعاد للمستدعي. */
  }
}

/** تقاعد سجل القفل — يُستدعى مرة عند الإقلاع؛ نتيجته معلنة لا مفترضة. */
export async function retireLocalLockRecord(store: LockRetirementStore): Promise<LockRetirementOutcome> {
  const existing = await store.getLocalSecurity();
  if (!existing.ok) {
    /* فشل قراءة السجل لا يحبس المستخدم خلف غطاء ملغى — يُعلن فشل التنظيف
     * بحجمه التقني ويستمر الإقلاع (لا إعادة محاولة تخزينية عمياء). */
    recordCleanupFailure("read-failed");
    return { status: "cleanup-failed" };
  }
  if (existing.value === null) return { status: "nothing-to-clean" };
  const removed = await store.deleteLocalSecurity();
  if (!removed.ok) {
    recordCleanupFailure("delete-failed");
    return { status: "cleanup-failed" };
  }
  return { status: "cleaned" };
}
