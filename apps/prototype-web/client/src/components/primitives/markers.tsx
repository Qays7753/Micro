import { Check, CircleAlert, Clock3, Eye, HelpCircle, Undo2, X } from "lucide-react";
import type { StateMarkerKind } from "@/presentation/stateAdapter";

/*
 * W2 — علامات الحالة غير اللونية (leaf primitive).
 * الدور يأتي من مهايئ الحالات؛ الشكل يأتي من هنا فقط. العلامة تحمل المعنى
 * غير اللوني (عقد المعيار) واللون تعزيز في طبقة CSS حسب السطح.
 * التعبئة: dot/partial/tilde أشكال CSS — لا اعتماد على مكتبة أيقونات بعينها
 * لهذه الأدوار (إرشاد أيقونات المعيار).
 *
 * R10-B4/F-018 (صلاحية الواجهة): الخاصية صارت marker لا role — كانت تُسمى
 * role فتوهم أنها دور وصول يصل إلى DOM بينما كل مخرجاتها aria-hidden زخرفية
 * (المعنى غير اللوني يعيش في الكلمة المجاورة وقنوات الإعلان الرسمية).
 * لا تغيير بصري ولا سلوكي هنا — تصحيح تسمية الواجهة فقط.
 */

const ICON_BY_KIND = {
  check: Check,
  clock: Clock3,
  alert: CircleAlert,
  close: X,
  return: Undo2,
  eye: Eye,
  question: HelpCircle,
} as const;

export function StateMarker({ marker }: { marker: StateMarkerKind }) {
  if (marker === "none") return null;
  /* أشكال CSS الثلاثة (tilde/dot/partial) — عنصر واحد بلا أيقونة مكتبة،
   * والشكل يحدده المعدِّل نفسه؛ المخرج مطابق حرفيًا للفروع الثلاثة. */
  if (marker === "tilde" || marker === "dot" || marker === "partial") {
    return (
      <span aria-hidden="true" className={`micro-prim-marker micro-prim-marker--${marker}`}>
        {marker === "tilde" ? "~" : null}
      </span>
    );
  }
  const Icon = ICON_BY_KIND[marker];
  return <Icon aria-hidden="true" className="micro-prim-marker" />;
}
