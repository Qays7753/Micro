/** S03 revalidation (00-S03-REVALIDATION-S04-EXECUTION-PROMPT-2026-10-28 §A2):
 * منطق التزامن المحروس لسجل التفضيلات — ملكية واحدة مشتركة بين المحوّلين.
 *
 * العيب المُثبت (preferencesConcurrency.repro.test.ts): بوابة الدمج كانت
 * تقرأ السجل ثم تدمج الرقعة ثم تكتب السجل كاملًا خارج أي حد محروس، فكاتبان
 * متزامنان على حقول مختلفة يقرآن النسخة نفسها وتسحق كتابة الثاني الكاملة
 * تحديث الأول بصمت (lost update). الجذر: نقل القراءة والدمج والكتابة إلى
 * حد الكتابة نفسه (معاملة IndexedDB واحدة / خطوة متزامنة واحدة في الذاكرة)
 * بحيث تُطبَّق الرقعة فوق السجل الحي داخل الحد — لا فوق لقطة المتصل.
 *
 * هذا الملف هو المصدر الواحد للمنطق الصافي المشترك (بذرة السجل الجديد،
 * الدمج، ترسيخ الحقول الاختيارية، قرار التعارض) — يستدعيه المحوّلان
 * حرفيًا فتتحقق مطابقة الذاكرة/IndexedDB بالبناء لا بالتزام (نمط
 * financialEventCorrectionMessages نفسه).
 */
import {
  localPreferencesId,
  type LocalPreferences,
  type LocalPreferencesPatch,
  type PreferencesCommitOutcome,
} from "./types";

/** الحقول القابلة للتحقيق فقط — الهوية وطابع التحديث يملكهما حد الكتابة.
 * (التعريف الكنوني في types.ts بجوار عقد المنفذ؛ يُعاد تصديره هنا لمستهلكي
 * منطق الالتزام.) */
export type { LocalPreferencesPatch, PreferencesCommitOutcome };

/** سجل البداية عند أول كتابة على جهاز بلا تفضيلات — نفس الافتراضات
 * الصادقة التي كانت بوابة الدمج تبنيها (EXE-002/SET-003/S03 P3.2):
 * لا يُفترض منتجات (محايد) ولا سياسة تنبيه ولا قدرات موقوفة. */
export function freshLocalPreferences(timestamp: string): LocalPreferences {
  return {
    id: localPreferencesId,
    theme: "system",
    dailyScheduleCapacityMinutes: null,
    workMode: null,
    actualTimeTrackingEnabled: false,
    installBannerDismissedAt: null,
    lastVerifiedExportAt: null,
    backupReminderEnabled: true,
    disabledCapabilities: [],
    /* Stage 2 — OPS-002: غياب الحد = لا سياسة = لا تنبيه. */
    lowStockThresholdsMilli: null,
    /* S03 (UNIT-038 P3.2): البداية المحايدة الصادقة — لا يُفترض منتجات. */
    offeringPreference: null,
    updatedAt: timestamp,
  };
}

/** دمج الرقعة فوق السجل الحي داخل حد الكتابة — الحقول غير المستهدفة
 * تُنقل كلها من الحي (لا من لقطة المتصل)، والاختيارية تُرسَّخ بقيمتها
 * الصادقة عند أول حفظ يمر من هنا (نفس سلوك إصلاح SET-003-B القائم).
 * دالة صافية بلا أثر جانبي — المحوّلان يستدعيانها داخل حدودهما. */
export function applyPreferencesPatch(
  live: LocalPreferences | null,
  patch: LocalPreferencesPatch,
  timestamp: string,
): LocalPreferences {
  const merged: LocalPreferences = {
    ...(live ?? freshLocalPreferences(timestamp)),
    ...patch,
    id: localPreferencesId,
    updatedAt: timestamp,
  };
  /* السجل القديم بلا حقل اختياري يُرسَّخ بقيمته الصادقة — الغياب يُقرأ
   * افتراضًا ثم يثبت، فلا يبقى السجل بلا الحقل إلى الأبد. */
  merged.lastVerifiedExportAt = merged.lastVerifiedExportAt ?? null;
  merged.backupReminderEnabled = merged.backupReminderEnabled ?? true;
  merged.disabledCapabilities = merged.disabledCapabilities ?? [];
  /* Stage 2 — OPS-002: غياب الحد = لا سياسة = لا تنبيه (افتراض صادق يُرسّى بأول حفظ). */
  merged.lowStockThresholdsMilli = merged.lowStockThresholdsMilli ?? null;
  /* S03 (UNIT-038 P3.2): غياب تفضيل العرض = محايد (لا منتجات). */
  merged.offeringPreference = merged.offeringPreference ?? null;
  return merged;
}

/** قرار التعارض داخل حد الكتابة — يعيد السجل المدموج للكتابة، أو الحالة
 * الحية كتعارض صادق بلا كتابة:
 *  - expectedUpdatedAt === null: لا توقع نسخة — الرقعة تُطبَّق فوق الحي
 *    (أو تنشئ السجل إن غاب). هذا مساركتّاب الحقول (كل كاتب يملك حرفه
 *    فقط) فلا يفقد كاتب متزامن تحديثه ولا تتعارض كتابة غير ذات صلة.
 *  - expectedUpdatedAt نصًا: فحص CAS حي — غياب السجل أو اختلاف طابعه
 *    تعارض صادق (المتصل بنى رقعته من نسخة متقادمة) ولا يُكتب شيء.
 * الدالة صافية؛ الكتابة نفسها ملك المحوّل داخل حدوده. */
export function decidePreferencesCommit(
  live: LocalPreferences | null,
  patch: LocalPreferencesPatch,
  expectedUpdatedAt: string | null,
  timestamp: string,
):
  | { write: LocalPreferences; outcome: "updated" | "created" }
  | { outcome: "conflict"; live: LocalPreferences | null } {
  if (expectedUpdatedAt !== null && (!live || live.updatedAt !== expectedUpdatedAt)) {
    return { outcome: "conflict", live };
  }
  return { write: applyPreferencesPatch(live, patch, timestamp), outcome: live ? "updated" : "created" };
}
