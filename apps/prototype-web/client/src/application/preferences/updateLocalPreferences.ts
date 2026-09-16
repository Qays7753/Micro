/** EXE-002 (AUD-NEW-02 / SET-003): بوابة كتابة التفضيلات الموحدة.
 *
 * كل كاتب تفضيلات (المظهر، التصدير المتحقق، تذكير النسخ، بطاقة التثبيت،
 * القدرات، طريقة العمل، سعة اليوم) يمر من هنا حصرًا: التحديث يُطبَّق patch فوق
 * السجل الحالي المقروء لحظة الكتابة، فلا يستطيع كاتب أن يُسقط حقلًا قائمًا
 * (العيب الذي أعاد تفعيل القدرات الموقوفة بصمت عند تغيير طريقة العمل أو
 * سعة اليوم)، وأي حقل يُضاف للنوع مستقبلًا يُنقل تلقائيًا ما دام في السجل.
 * السجل القديم بلا حقل اختياري يبقى بلاه — قراءته تُرجع الافتراض الصادق،
 * ويُرسَّخ بأول حفظ يمر من هنا (نفس سلوك إصلاح SET-003-B القائم).
 */
import { localPreferencesId, type LocalPreferences, type PrototypeLocalStore } from "@/storage/local/types";

/** الحقول القابلة للتحقيق فقط — الهوية وطابع التحديث تملكهما البوابة. */
export type LocalPreferencesPatch = Partial<
  Omit<LocalPreferences, "id" | "updatedAt">
>;

export type LocalPreferencesUpdateResult =
  | { ok: true; value: LocalPreferences }
  | { ok: false; code: "storage_error"; message: string };

/** سجل البداية عند أول كتابة على جهاز بلا تفضيلات — نفس الافتراضات
 * التي كانت الكتّاب السبعة تبنيها يدويًا قبل التوحيد. */
const freshRecord = (): LocalPreferences => ({
  id: localPreferencesId,
  theme: "system",
  dailyScheduleCapacityMinutes: null,
  workMode: null,
  actualTimeTrackingEnabled: false,
  installBannerDismissedAt: null,
  lastVerifiedExportAt: null,
  backupReminderEnabled: true,
  disabledCapabilities: [],
});

export async function updateLocalPreferences(
  store: PrototypeLocalStore,
  patch: LocalPreferencesPatch,
  now: () => string,
): Promise<LocalPreferencesUpdateResult> {
  const current = await store.getPreferences();
  if (!current.ok) return { ok: false, code: "storage_error", message: "تعذر قراءة التفضيلات المحلية." };
  const merged: LocalPreferences = {
    ...(current.value ?? freshRecord()),
    ...patch,
    id: localPreferencesId,
    updatedAt: now(),
  };
  /* السجل القديم بلا حقل اختياري يُرسَّخ بقيمته الصادقة عند أول حفظ يمر من
   * هنا — نفس سلوك إصلاح SET-003-B القائم: الغياب يُقرأ افتراضًا ثم يثبت،
   * فلا يبقى السجل بلا الحقل إلى الأبد. */
  merged.lastVerifiedExportAt = merged.lastVerifiedExportAt ?? null;
  merged.backupReminderEnabled = merged.backupReminderEnabled ?? true;
  merged.disabledCapabilities = merged.disabledCapabilities ?? [];
  const saved = await store.savePreferences(merged);
  return saved.ok
    ? { ok: true, value: saved.value }
    : { ok: false, code: "storage_error", message: "تعذر حفظ التفضيلات المحلية." };
}
