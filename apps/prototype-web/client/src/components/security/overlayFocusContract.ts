/**
 * R11 W4 / D-14 (موجة المتابعة 2026-10-15 — OD-A11Y الخيار B): عقد تركيز
 * الغطاء الحواري للمودالات الحقيقية — النمط الذهبي نفسه المعتبر في
 * AppLockGate وUnsavedChangesGuard، مستخرجًا مساعدًا واحدًا مشتركًا:
 *
 *  - **focus-in**: عند الفتح ينتقل التركيز إلى أول عنصر قابل للتركيز داخل
 *    الغطاء (والغطاء نفسه احتياطًا بـtabIndex=-1) — لا يبقى التركيز في
 *    المحتوى خلف الغطاء أبدًا.
 *  - **الاحتواء**: Tab/Shift+Tab يدوران داخل الغطاء وحده (الأول/الأخير
 *    يلتفان) — لا تجوال إلى ما تحت الغطاء؛ ترتيب الدوران هو ترتيب DOM
 *    نفسه فيبقى ترتيب Tab في RTL كما هو.
 *  - **Escape**: يُغلق الغطاء بمساره الآمن (إلغاء/حسنًا) ويُوقف الانتشار
 *    حتى لا تلتقطه معالجات أعلى.
 *  - **الاستعادة**: عند الإغلاق يعود التركيز إلى العنصر الذي فتح الغطاء
 *    إن ظل في المستند.
 *
 * دلالات فقط — لا CSS ولا تخطيط ولا تغيير بصري: الغطاء والستار يستخدمان
 * صنفيهما القائمين. الفخ قانوني هنا لأنه للمودال الحقيقي وحده (قرار
 * OD-A11Y)؛ الألواح غير المودالة لا تستخدم هذا المساعد إطلاقًا.
 */
import { useEffect, useRef } from "react";
import type { RefObject } from "react";

const FOCUSABLE_SELECTOR =
  'button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])';

export function useOverlayFocusContract(
  overlayRef: RefObject<HTMLDivElement | null>,
  onEscape: () => void,
): void {
  /* مرجع دائم الجدة لمسار الإغلاق — لا يعطل المستمع القديم بإعادة تركيب */
  const onEscapeRef = useRef(onEscape);
  onEscapeRef.current = onEscape;

  useEffect(() => {
    const overlay = overlayRef.current;
    if (!overlay) return;
    const restoreTo = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    /* عناصر التركيز داخل الغطاء — محارف غير المعطلة بالتحديد نفسه؛ لا فلتر
     * إظهار layout-based (offsetParent فارغ دومًا في jsdom ولأغلفة القفل
     * هذه كل المعروض مرئي بالبناء — حد موثق). */
    const focusables = () => Array.from(overlay.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR));
    (focusables()[0] ?? overlay).focus();

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented) return;
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopPropagation();
        onEscapeRef.current();
        return;
      }
      if (event.key !== "Tab") return;
      /* الحركة كلها مملوكة هنا لا مفوضة للمتصفح: حتمية في المتصفح وفي
       * jsdom معًا، والإلتفاف الأول/الأخير يحفظ ترتيب DOM (ترتيب Tab في
       * RTL كما هو). */
      event.preventDefault();
      const list = focusables();
      if (list.length === 0) {
        overlay.focus();
        return;
      }
      const first = list[0]!;
      const last = list[list.length - 1]!;
      const active = document.activeElement;
      const index = list.indexOf(active as HTMLElement);
      if (event.shiftKey) {
        const target = index <= 0 ? last : (list[index - 1] ?? last);
        target.focus();
      } else {
        const target = index === -1 ? first : index === list.length - 1 ? first : (list[index + 1] ?? first);
        target.focus();
      }
    };
    document.addEventListener("keydown", onKeyDown, true);
    return () => {
      document.removeEventListener("keydown", onKeyDown, true);
      if (restoreTo && restoreTo.isConnected) restoreTo.focus();
    };
  }, [overlayRef]);
}
