/** EXE-002 (AUD-NEW-02 / SET-003): بوابة كتابة التفضيلات الموحدة.
 *
 * كل كاتب تفضيلات (المظهر، التصدير المتحقق، تذكير النسخ، بطاقة التثبيت،
 * القدرات، طريقة العمل، سعة اليوم، تفضيل العرض) يمر من هنا حصرًا: التحديث
 * رقعة (patch) تُطبَّق فوق السجل الحي عند حد الكتابة نفسه، فلا يستطيع كاتب
 * أن يُسقط حقلًا قائمًا (العيب الذي أعاد تفعيل القدرات الموقوفة بصمت عند
 * تغيير طريقة العمل أو سعة اليوم)، وأي حقل يُضاف للنوع مستقبلًا يُنقل
 * تلقائيًا ما دام في السجل. السجل القديم بلا حقل اختياري يبقى بلاه —
 * قراءته تُرجع الافتراض الصادق، ويُرسَّخ بأول حفظ يمر من هنا.
 *
 * S03 revalidation (00-S03-REVALIDATION-S04-EXECUTION-PROMPT-2026-10-28 §A2):
 * البوابة كانت تقرأ السجل ثم تدمج الرقعة ثم تكتب السجل كاملًا خارج أي حد
 * محروس — كاتبان متزامنان يقرآن النسخة نفسها فتسحق كتابة الثاني الكاملة
 * تحديث الأول بصمت (lost update مُثبت في preferencesConcurrency.repro.test.ts).
 * الجذر: القراءة والدمج والكتابة انتقلت إلى حد الكتابة المحروس
 * (commitPreferencesUpdate) في المحوّلين معًا — الرقعة تُطبَّق فوق السجل
 * الحي داخل المعاملة/الخطوة الواحدة، فلا كاتب يبني سجله من لقطة متقادمة.
 * المسار الافتراضي (بلا expectedUpdatedAt) هو مساركتّاب الحقول: كل كاتب
 * يملك حقه فقط ولا يُسقط غيره ولا يتعارض مع كتابة غير ذات صلة. المسار
 * المحروس (expectedUpdatedAt نصًا) فحص CAS حي للكاتب الذي بنى رقعته من
 * نسخة مقروءة: اختلاف الطابع يعاد storage_stale صادقًا بلا أي كتابة
 * (المتصل يعيد القراءة ثم المحاولة — لا حلقة إعادة عشوائية هنا).
 */
import type { LocalPreferences, PrototypeLocalStore } from "@/storage/local/types";
import { STORAGE_STALE, storageFailure } from "@/application/resultCodes";
import { systemClock, type Clock } from "@/application/time/clock";

/** الحقول القابلة للتحقيق فقط — الهوية وطابع التحديث يملكهما حد الكتابة
 * (التعريف الكنوني في storage/local — يُعاد تصديره لمستهلكي البوابة). */
export type { LocalPreferencesPatch } from "@/storage/local/types";

export type LocalPreferencesUpdateResult =
  | { ok: true; value: LocalPreferences }
  | { ok: false; code: "storage_error" | "storage_stale"; message: string };

export async function updateLocalPreferences(
  store: Pick<PrototypeLocalStore, "commitPreferencesUpdate">,
  patch: import("@/storage/local/types").LocalPreferencesPatch,
  now: Clock,
  expectedUpdatedAt: string | null = null,
): Promise<LocalPreferencesUpdateResult> {
  /* القراءة والدمج والكتابة معًا عند حد الكتابة داخل المحوّل — البوابة
   * طبقة توصيل فقط: لا لقطة بين القراءة والكتابة في طبقة التطبيق أبدًا. */
  const committed = await store.commitPreferencesUpdate(patch, expectedUpdatedAt, now());
  if (committed.ok) {
    const value = committed.value;
    if (value.outcome === "conflict") {
      /* تعارض CAS صادق: لا كتابة حدثت والسجل الحي هو المرجع — المتصل
       * يعيد القراءة والمحاولة بقرار صريح لا بإعادة صامتة. */
      return { ok: false, code: STORAGE_STALE, message: "تغيّرت التفضيلات من نافذة أخرى — أعد المحاولة." };
    }
    return { ok: true, value: value.preferences };
  }
  return storageFailure("تعذر حفظ التفضيلات المحلية.");
}
