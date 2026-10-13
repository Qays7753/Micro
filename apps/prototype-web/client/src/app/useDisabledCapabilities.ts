import { useEffect, useState } from "react";
import { usePrototypeServices } from "@/app/PrototypeServicesContext";

/* G-004 (تدقيق الإدارة المالية المتدرجة 2026-09-19): القارئ المركزي الواحد
 * للقدرات المتوقفة — حارس واحد لكل أسطح الإنشاء بدل فحوص متناثرة متعارضة.
 * التعطيل يخفي مداخل الإنشاء فقط ولا يمس السجلات القائمة أو قراءتها أبدًا
 * (قرار مجمّد في context.md)، والعلم يُعاد قراءته مع كل تغيير بيانات فلا
 * يبقى بعد إعادة التفعيل. غياب خدمة التفضيلات في بيئة اختبار لا يُسقط
 * السطح (نمط S5-08 نفسه في الرئيسية). */

/* R10-B3/R10A-F-004 (2026-10-11): النوع الكنوني من مالك التخزين (باب
 * التفضيلات) — كان معاد تعريفه محليًا هنا وفي قسم الإعدادات. إعادة
 * التصدير توافقًا لمستهلكي هذه الوحدة (CapabilityRouteGate). */
export type { CapabilityId } from "@/application/preferences";

export type DisabledCapabilitiesState = {
  disabled: readonly string[];
  /** false حتى تكتمل أول قراءة — الحرس على المسارات يعرض حالة التحميل لا
   * محررًا يومض ثم يُسدل (الرابط العميق البارد لا يتجاوز الحرس). */
  ready: boolean;
};

export function useDisabledCapabilities(): DisabledCapabilitiesState {
  const { preferences, dataVersion } = usePrototypeServices();
  const [state, setState] = useState<DisabledCapabilitiesState>({ disabled: [], ready: false });
  useEffect(() => {
    let active = true;
    if (typeof preferences?.readDisabledCapabilities === "function") {
      preferences
        .readDisabledCapabilities()
        .then(result => {
          if (active && result.ok) setState({ disabled: result.disabled, ready: true });
        })
        .catch(() => undefined);
    } else {
      setState(current => ({ ...current, ready: true }));
    }
    return () => {
      active = false;
    };
  }, [preferences, dataVersion]);
  return state;
}
