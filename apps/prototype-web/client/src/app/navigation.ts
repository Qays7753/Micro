/**
 * Micro design reminder: navigation stays phone-first, task-oriented, and uses
 * the official semantic design system rather than a generic admin dashboard.
 */
import type { LucideIcon } from "lucide-react";
import { ClipboardList, House, Store, WalletCards, Wrench } from "lucide-react";

export type NavigationItem = { href: string; label: string; icon: LucideIcon };

/* NAV-001 (قرار المالك المعتمد ٢٠٢٦-٠٩-١٦): الشريط السفلي خمسة مقاعد ثابتة
 * بهذا الترتيب: مشروعي الآن | العمل | المالية | أدواتي | السوق.
 * زر «سجّل» المركزي أُزيل بعد نقل كل أفعاله إلى أزرار التسجيل السريع في
 * «مشروعي الآن» (بيع/مصروف في الورقة نفسها، وطلب/تقدير/تحصيل مساراتها).
 * السوق مقعد معلن «قريبًا» — إعلان مرسوم صادق لا وظيفة وهمية. */
export const primaryNavigation: readonly NavigationItem[] = [
  { href: "/", label: "مشروعي الآن", icon: House },
  { href: "/orders", label: "العمل", icon: ClipboardList },
  { href: "/finance", label: "المالية", icon: WalletCards },
  { href: "/tools", label: "أدواتي", icon: Wrench },
  { href: "/market", label: "السوق", icon: Store },
];

export function getNavigationLabel(pathname: string) {
  if (pathname.startsWith("/schedule")) return "المواعيد";
  if (pathname.startsWith("/finance")) return "المالية";
  if (pathname.startsWith("/cash")) return "محافظ الكاش";
  if (pathname.startsWith("/inventory")) return "المواد والمخزون";
  if (pathname.startsWith("/suppliers")) return "الموردون والمشتريات";
  if (pathname.startsWith("/parties")) return "دفتر الناس";
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
  return (
    primaryNavigation.find(
      item => item.href === pathname || (item.href !== "/" && pathname.startsWith(item.href)),
    )?.label ?? "مايكرو"
  );
}
