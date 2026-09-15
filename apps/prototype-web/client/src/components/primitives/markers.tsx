import { Check, CircleAlert, Clock3, Eye, HelpCircle, Undo2, X } from "lucide-react";
import type { StateMarkerRole } from "@/presentation/stateAdapter";

/*
 * W2 — علامات الحالة غير اللونية (leaf primitive).
 * الدور يأتي من مهايئ الحالات؛ الشكل يأتي من هنا فقط. العلامة تحمل المعنى
 * غير اللوني (عقد المعيار) واللون تعزيز في طبقة CSS حسب السطح.
 * التعبئة: dot/partial/tilde أشكال CSS — لا اعتماد على مكتبة أيقونات بعينها
 * لهذه الأدوار (إرشاد أيقونات المعيار).
 */

const ICON_BY_ROLE = {
  check: Check,
  clock: Clock3,
  alert: CircleAlert,
  close: X,
  return: Undo2,
  eye: Eye,
  question: HelpCircle,
} as const;

export function StateMarker({ role }: { role: StateMarkerRole }) {
  if (role === "none") return null;
  if (role === "tilde") {
    return (
      <span aria-hidden="true" className="micro-prim-marker micro-prim-marker--tilde">
        ~
      </span>
    );
  }
  if (role === "dot") {
    return <span aria-hidden="true" className="micro-prim-marker micro-prim-marker--dot" />;
  }
  if (role === "partial") {
    return <span aria-hidden="true" className="micro-prim-marker micro-prim-marker--partial" />;
  }
  const Icon = ICON_BY_ROLE[role];
  return <Icon aria-hidden="true" className="micro-prim-marker" />;
}
