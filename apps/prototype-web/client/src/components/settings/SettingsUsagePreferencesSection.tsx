/**
 * S03 (UNIT-038 P3.1/P3.2 + UNIT-001 P3.2): قسم «ما يقدّمه مشروعك» داخل
 * الإعدادات — محرر تفضيل العرض من مصدره الواحد (خدمة التفضيلات/038): نفس
 * الحقل الذي يجيب عنه سؤال البداية في 001، بلا مصدر ثانٍ منافس. الصفحة تبقى
 * الموزّع (تملك الحالة والمعالجات) وتمرر كل شيء خصائص.
 *
 * حدود صريحة:
 * - الحفظ جزئي عبر بوابة الدمج (updateLocalPreferences) — لا يُسقط أي حقل
 *   تفضيل آخر (EXE-002)، والغياب محايد لا يفترض منتجات.
 * - التفضيل مستقل تمامًا عن workMode (طريقة مواد/وقت في قسم آخر) ولا يعيد
 *   تصنيف أي سجل تاريخي ولا يمس أي رقم مالي.
 * - الفشل يُعلن صادقًا ويبقى التحكم بيد المالك؛ لا نجاح صامت ولا ابتلاع.
 */
import { CircleDollarSign, Save } from "lucide-react";
import type { Dispatch, SetStateAction } from "react";
import type { OfferingPreference } from "@/application/preferences";

import { Button, FeedbackNote, type FeedbackKind } from "@/components/primitives";

/* S03: خيارات السؤال نفسها من سؤال البداية (001) — المعجم المغلق الكنوني
 * مع المحايد؛ لا قيمة رابعة مبتكرة ولا ترتيب مختلف بين السطحين. */
export type OfferingSelection = OfferingPreference | "";

export const offeringOptions: Array<{ value: OfferingSelection; label: string; hint: string }> = [
  { value: "", label: "لم أحدد بعد", hint: "محايد — لا يُفترض شيء عن مشروعك." },
  { value: "products", label: "منتجات", hint: "تبيع أشياء تصنعها أو تجلبها." },
  { value: "services", label: "خدمات", hint: "تنجز عملًا أو خدمة للعميل." },
  { value: "both", label: "منتجات وخدمات معًا", hint: "تقدم النوعين معًا." },
];

export type OfferingState =
  { phase: "loading" } | { phase: "error"; message: string } | { phase: "ready"; value: OfferingPreference };

export type SettingsUsagePreferencesSectionProps = {
  offeringState: OfferingState;
  selectedOffering: OfferingSelection;
  setSelectedOffering: Dispatch<SetStateAction<OfferingSelection>>;
  isSavingOffering: boolean;
  offeringNotice: { kind: FeedbackKind; text: string } | null;
  saveOffering: () => Promise<void>;
};

export function SettingsUsagePreferencesSection({
  offeringState,
  selectedOffering,
  setSelectedOffering,
  isSavingOffering,
  offeringNotice,
  saveOffering,
}: SettingsUsagePreferencesSectionProps) {
  const hasChange = offeringState.phase === "ready" && (offeringState.value ?? "") !== selectedOffering;
  return (
    <details className="micro-decision-layer" open>
      <summary className="micro-decision-layer-summary">
        <span>
          <b>ما يقدّمه مشروعك</b>
          <small>تفضيل اختياري محايد — يُستخدم لعرض الأدوات الأقرب، ولا يمس أي سجل.</small>
        </span>
        <strong>افتح التفضيل</strong>
      </summary>
      <section className="micro-form-card" aria-labelledby="offering-title">
        <div className="micro-section-heading">
          <div>
            <span className="micro-overline">تفضيل اختياري</span>
            <h2 id="offering-title">ما يقدّمه مشروعك غالبًا؟</h2>
          </div>
          <CircleDollarSign aria-hidden="true" />
        </div>
        <p>
          نفس سؤال البداية في الإعداد، من مصدر واحد. مستقل تمامًا عن طريقة العمل (المادة/الوقت) ولا يغيّر نوع
          نشاطك أو أي سجل تاريخي أو رقمًا ماليًا.
        </p>
        {offeringState.phase === "loading" ? (
          <p className="micro-route-loading" role="status">
            جارٍ قراءة تفضيل ما يقدّمه مشروعك…
          </p>
        ) : null}
        {offeringState.phase === "error" ? (
          <div className="micro-storage-error" role="alert">
            <strong>تعذر قراءة التفضيل المحلي</strong>
            <p>{offeringState.message}</p>
          </div>
        ) : null}
        {offeringState.phase === "ready" ? (
          <>
            <fieldset className="micro-field" data-testid="offering-editor">
              <legend>اختيارك الحالي</legend>
              {offeringOptions.map(option => (
                <label key={option.value || "unselected"} className="micro-radio-choice">
                  <input
                    type="radio"
                    name="settings-offering"
                    value={option.value ?? ""}
                    checked={selectedOffering === option.value}
                    onChange={() => setSelectedOffering(option.value)}
                    disabled={isSavingOffering}
                  />
                  <span>
                    <b>{option.label}</b>
                    <small>{option.hint}</small>
                  </span>
                </label>
              ))}
            </fieldset>
            <Button
              action="save"
              block
              disabled={isSavingOffering || !hasChange}
              onClick={() => void saveOffering()}
            >
              <Save aria-hidden="true" />
              {isSavingOffering ? "جارٍ حفظ التفضيل…" : "احفظ تفضيل ما يقدّمه مشروعك"}
            </Button>
          </>
        ) : null}
        {offeringNotice ? <FeedbackNote kind={offeringNotice.kind} word={offeringNotice.text} /> : null}
      </section>
    </details>
  );
}
