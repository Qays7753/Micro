/**
 * المجموعة ١١ (المرحلة 11-B — تفكيك الإعدادات): طريقة إنجاز العمل وتتبعها — مقطع عرض مستخرج
 * من صفحة Settings.tsx حرفيًا؛ الصفحة تبقى الموزّع (تملك الحالة والمعالجات
 * وبوابة الرمز) وتمرّر كل شيء خصائصِ أدناه. نفس السلوك حرفيًا.
 */
import { type Dispatch, type SetStateAction } from "react";
import { Hammer, Save } from "lucide-react";
import type { OperatingWorkMode } from "@/storage/local/types";
import type { OperatingModeValue } from "@/application/time/actualTimeService";

export type OperatingModeState =
  { phase: "loading" } | { phase: "error"; message: string } | { phase: "ready"; value: OperatingModeValue };

export const modeOptions: Array<{ value: "" | OperatingWorkMode; label: string; description: string }> = [
  { value: "", label: "لم أحدد بعد", description: "يبقى الاختيار مفتوحًا، وتظهر الأدوات عند الحاجة فقط." },
  {
    value: "material_focused",
    label: "المادة أولًا",
    description: "مفيد عندما يكون فرق المادة أهم ما أراجعه في الطلب.",
  },
  {
    value: "time_focused",
    label: "الوقت أولًا",
    description: "مفيد عندما يكون وقت التنفيذ مؤثرًا في العمل أو الخدمة.",
  },
  {
    value: "mixed",
    label: "المادة والوقت معًا",
    description: "مفيد عندما يؤثر كل من المادة ووقت التنفيذ في القرار.",
  },
];

export type SettingsOperatingModeSectionProps = {
  operatingMode: OperatingModeState;
  selectedMode: "" | OperatingWorkMode;
  setSelectedMode: Dispatch<SetStateAction<"" | OperatingWorkMode>>;
  trackingEnabled: boolean;
  setTrackingEnabled: Dispatch<SetStateAction<boolean>>;
  isSavingOperatingMode: boolean;
  selectedModeDescription: string | undefined;
  notice: { text: string; section: "storage" | "mode" } | null;
  saveOperatingMode: () => Promise<void>;
};

export function SettingsOperatingModeSection({
  operatingMode,
  selectedMode,
  setSelectedMode,
  trackingEnabled,
  setTrackingEnabled,
  isSavingOperatingMode,
  selectedModeDescription,
  notice,
  saveOperatingMode,
}: SettingsOperatingModeSectionProps) {
  return (
    <details className="micro-decision-layer" open>
      <summary className="micro-decision-layer-summary">
        <span>
          <b>تفضيلات العمل اليومية</b>
          <small>اختر طريقة العمل وتتبّع الوقت دون تغيير السجل المالي.</small>
        </span>
        <strong>افتح التفضيل</strong>
      </summary>
      <section className="micro-form-card" aria-labelledby="operating-mode-title">
        <div className="micro-section-heading">
          <div>
            <span className="micro-overline">تفضيل اختياري</span>
            <h2 id="operating-mode-title">كيف تنجز عملك غالبًا؟</h2>
          </div>
          <Hammer aria-hidden="true" />
        </div>
        <p>
          يساعد هذا الاختيار Micro على تقديم الأداة الأقرب لسؤالك في الطلب. لا يغير نوع النشاط أو سجلًا
          تاريخيًا أو أي رقم مالي.
        </p>
        {operatingMode.phase === "loading" ? (
          <p className="micro-route-loading" role="status">
            جارٍ قراءة تفضيل طريقة العمل…
          </p>
        ) : null}
        {operatingMode.phase === "error" ? (
          <div className="micro-storage-error" role="alert">
            <strong>تعذر قراءة التفضيل المحلي</strong>
            <p>{operatingMode.message}</p>
          </div>
        ) : null}
        {operatingMode.phase === "ready" ? (
          <>
            <label className="micro-field">
              <span>طريقة العمل المعتادة</span>
              <select
                value={selectedMode}
                onChange={event => setSelectedMode(event.target.value as "" | OperatingWorkMode)}
                aria-describedby="operating-mode-help"
              >
                {modeOptions.map(option => (
                  <option key={option.value || "none"} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
            <p id="operating-mode-help" className="micro-local-truth">
              {selectedModeDescription}
            </p>
            <label className="micro-confirm-warning micro-setting-toggle">
              <input
                type="checkbox"
                checked={trackingEnabled}
                onChange={event => setTrackingEnabled(event.target.checked)}
              />
              <span>
                <b>تفعيل تتبع الوقت المحلي</b> يتيح تسجيل وقت فعلي للطلب لاحقًا عند الحاجة، ولا يشغّل مؤقتًا
                في الخلفية.
              </span>
            </label>
            <p className="micro-cost-disclaimer">
              عدم الاختيار أو إيقاف التتبع لا يمنع إنشاء الطلب أو تسجيل المال أو المادة؛ لكنه يعني أن مقارنة
              الوقت لن تكون متاحة بلا سجل.
            </p>
            <button
              className="micro-button micro-button-primary micro-save-cost"
              type="button"
              disabled={isSavingOperatingMode}
              onClick={saveOperatingMode}
            >
              <Save aria-hidden="true" />
              {isSavingOperatingMode ? "جارٍ حفظ التفضيل…" : "حفظ طريقة العمل"}
            </button>
            {notice?.section === "mode" ? (
              <p className="micro-save-note" role="status">
                {notice.text}
              </p>
            ) : null}
          </>
        ) : null}
      </section>
    </details>
  );
}
