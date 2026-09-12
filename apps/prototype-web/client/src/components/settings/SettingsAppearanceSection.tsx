/**
 * المجموعة ١١ (المرحلة 11-B — تفكيك الإعدادات): إعدادات المظهر — مقطع عرض مستخرج
 * من صفحة Settings.tsx حرفيًا؛ الصفحة تبقى الموزّع (تملك الحالة والمعالجات
 * وبوابة الرمز) وتمرّر كل شيء خصائصِ أدناه. نفس السلوك حرفيًا.
 */
import { type Dispatch, type SetStateAction } from "react";
import { MoonStar } from "lucide-react";

export type SettingsAppearanceSectionProps = {
  theme: string | null;
  toggleTheme: (() => void) | undefined;
};

export function SettingsAppearanceSection({ theme, toggleTheme }: SettingsAppearanceSectionProps) {
  return (
    <details className="micro-decision-layer" open>
      <summary className="micro-decision-layer-summary">
        <span>
          <b>المظهر</b>
          <small>تغيير العرض اليومي فقط.</small>
        </span>
        <strong>افتح المظهر</strong>
      </summary>
      <section className="micro-settings-list" aria-label="إعدادات المظهر">
        <article className="micro-setting-row">
          <span className="micro-setting-icon">
            <MoonStar aria-hidden="true" />
          </span>
          <div>
            <h2>المظهر</h2>
            <p>الوضع الحالي: {theme === "dark" ? "داكن" : "فاتح"}.</p>
          </div>
          <button className="micro-button micro-button-secondary" type="button" onClick={toggleTheme}>
            التبديل إلى {theme === "dark" ? "الفاتح" : "الداكن"}
          </button>
        </article>
      </section>
    </details>
  );
}
