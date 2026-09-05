/**
 * المجموعة ٥ (عقد ٣٦): شريط عرض استعادة المسودة — صريح دائمًا: قيم محفوظة
 * بتاريخها، وزرا «استرجع/تجاهل»؛ لا تطبيق صامت ولا إخفاء. العمر يظهر بالعربية
 * الصحيحة، والوقت بأرقام إنجليزية DD/MM/YYYY كما في كل التطبيق.
 */
import { useEffect, useState } from "react";
import { History } from "lucide-react";
import { formatLocalDate } from "@/presentation/formatters";

function ageInDays(savedAt: string, now: () => string): number {
  const saved = Date.parse(savedAt);
  const current = Date.parse(now());
  if (Number.isNaN(saved) || Number.isNaN(current)) return 0;
  return Math.max(0, Math.floor((current - saved) / (24 * 60 * 60 * 1000)));
}

export function FormDraftRestoreBanner({
  savedAt,
  now = () => new Date().toISOString(),
  onRestore,
  onDiscard,
}: {
  savedAt: string;
  now?: () => string;
  onRestore: () => void;
  onDiscard: () => void;
}) {
  const [visible, setVisible] = useState(true);
  useEffect(() => {
    setVisible(true);
  }, [savedAt]);
  if (!visible) return null;
  const days = ageInDays(savedAt, now);
  const ageLabel = days === 0 ? "اليوم" : days === 1 ? "أمس" : `قبل ${days} أيام`;
  return (
    <section className="micro-info-card" data-tone="accent" aria-label="مسودة غير محفوظة">
      <History aria-hidden="true" />
      <div>
        <span className="micro-overline">عندك مسودة</span>
        <h2>مدخلاتك من آخر مرة محفوظة محليًا</h2>
        <p>
          حُفظت <bdi dir="ltr">{formatLocalDate(savedAt.slice(0, 10)) ?? savedAt.slice(0, 10)}</bdi> (
          {ageLabel}) — لم تُسجّل أي حركة مالية بعد؛ استرجعها لتكمل من حيث توقفت، أو تجاهلها وابدأ من جديد.
        </p>
        <div className="micro-form-actions">
          <button className="micro-button micro-button-primary" type="button" onClick={onRestore}>
            استرجع المسودة
          </button>
          <button className="micro-button micro-button-quiet" type="button" onClick={() => void onDiscard()}>
            تجاهلها
          </button>
        </div>
      </div>
    </section>
  );
}
