/**
 * Micro design reminder: navigation stays phone-first, task-oriented, and uses
 * the official semantic design system rather than a generic admin dashboard.
 */
import type { LucideIcon } from "lucide-react";
import { ClipboardList, House, Store, Truck, WalletCards } from "lucide-react";

export type NavigationItem = { href: string; label: string; icon: LucideIcon };

/* SH-21 (تنفيذ S16 بالأمر الموحد §4 — NAV-01 V15 §1): الشريط السفلي خمسة
 * مقاعد ثابتة بهذا الترتيب من اليمين إلى اليسار على الهاتف العربي:
 * المالية، الطلبات، الرئيسية، التوصيل، السوق. الرئيسية وجهة الفتح الوسطى
 * (HOME-R01: تسمية موحدة «الرئيسية»؛ «مشروعي الآن» اسم الملف التاريخي لا
 * اسمًا ثانيًا في الشريط). التوصيل وجهة Micro Delivery المستقبلية بإعلان
 * صادق «قريبًا»؛ لا مقعد سادس للإعدادات أو الأدوات أو اسأل Micro (بيت
 * الأدوات مدخل الرئيسية، وبيت الإعدادات الترويسة/الرئيسية). */
export const primaryNavigation: readonly NavigationItem[] = [
  { href: "/finance", label: "المالية", icon: WalletCards },
  { href: "/orders", label: "الطلبات", icon: ClipboardList },
  { href: "/", label: "الرئيسية", icon: House },
  { href: "/delivery", label: "التوصيل", icon: Truck },
  { href: "/market", label: "السوق", icon: Store },
];

export function getNavigationLabel(pathname: string) {
  if (pathname.startsWith("/schedule")) return "المواعيد";
  if (pathname.startsWith("/finance")) return "المالية";
  if (pathname.startsWith("/cash")) return "محافظ النقد";
  if (pathname.startsWith("/inventory")) return "المواد والمخزون";
  if (pathname.startsWith("/suppliers")) return "الموردون والمشتريات";
  if (pathname.startsWith("/parties")) return "العملاء والموردون";
  /* S17 (DOC-026 / UNIT-033): تسمية «سلامة الحسابات» المستقلة تقاعدت مع
   * سطحها — المسار القديم يوجه إلى الإعدادات وبيتها قسم «فحص البيانات». */
  if (pathname.startsWith("/tools")) return "أدواتي";
  if (pathname.startsWith("/settings")) return "الإعدادات";
  /* المجموعة ١: ملف المالك — تسمية سياقية للترويسة بلا مقعد تنقل جديد. */
  if (pathname.startsWith("/profile")) return "ملف المالك";
  /* المجموعة ٣ (عقد D5): مراجعة التسليم — سياق واضح فوق محرر عميق. */
  if (/^\/orders\/[^/]+\/deliver$/.test(pathname)) return "مراجعة التسليم";
  /* المجموعة ٤ (عقد ٢٩): الأصول والقروض — تسميات سياقية بلا مقاعد جديدة. */
  if (pathname === "/assets" || pathname.startsWith("/assets/")) return "الأصول";
  if (pathname === "/loans" || pathname.startsWith("/loans/")) return "القروض";
  /* عقد الإغلاق العميق (MR-04): تسميات سياقية للمسارات العميقة غير المغطاة —
   * علامة الموقع لا تتكرر «مايكرو مايكرو» فوق أسطح المال. */
  if (pathname === "/collect" || pathname.startsWith("/collect")) return "ورقة التحصيل";
  if (pathname.startsWith("/direct-sales")) return "بيع مباشر";
  /* N-06 (Wave 4.2 — F-09/قرار المالك): الاسم الموحد للسطح «منتجاتي وخدماتي»
   * في كل المواضع الظاهرة — «الكتالوج» مصطلح نظام لا اسم ملكية. */
  if (pathname.startsWith("/catalog")) return "منتجاتي وخدماتي";
  if (pathname.startsWith("/share")) return "معاينة المشاركة";
  if (pathname.startsWith("/foundation")) return "صفحة الأساس";
  /* EX-D21 (Phase B): مدخل Ask Micro الشامل — سطح عمق واحد بلا شريط سفلي،
   * يُدخل من القائمة (سياق المالك) أو من ترويسة بوابة السائق (سياق السائق). */
  if (pathname === "/ask" || pathname.startsWith("/ask/")) return "اسأل Micro";
  /* EX-D18 (عقد 26 §8): تسميات سياقية لمسارات السوق فوق مقعد الشريط نفسه. */
  if (pathname === "/market/vendor" || pathname.startsWith("/market/vendor/")) return "مساحة المورد";
  if (pathname.startsWith("/market/listing/")) return "تفاصيل الإعلان";
  if (pathname.startsWith("/market/review")) return "مراجعة السوق";
  if (pathname === "/market" || pathname.startsWith("/market")) return "السوق";
  /* EX-D18 (عقد 26 §8): تسميات التوصيل وبوابة السائق المستقلة (OD01). */
  if (pathname.startsWith("/delivery/booking/")) return "تفاصيل الحجز";
  if (pathname.startsWith("/delivery/drivers")) return "سائقوني";
  if (pathname.startsWith("/delivery/review")) return "مراجعة التوصيل";
  if (pathname.startsWith("/delivery")) return "التوصيل";
  if (pathname.startsWith("/driver")) return "Micro — السائق";
  return (
    primaryNavigation.find(
      item => item.href === pathname || (item.href !== "/" && pathname.startsWith(item.href)),
    )?.label ?? "مايكرو"
  );
}
