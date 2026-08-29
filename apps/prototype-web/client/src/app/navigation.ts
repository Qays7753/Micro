/**
 * Micro design reminder: navigation stays phone-first, task-oriented, and uses
 * the official semantic design system rather than a generic admin dashboard.
 */
import type { LucideIcon } from "lucide-react";
import { ClipboardList, House, WalletCards } from "lucide-react";

export type NavigationItem = { href: string; label: string; icon: LucideIcon };

/* §2.2 من وثيقة إعادة التوزيع: مشروعي الآن | العمل | [FAB] | مالي — والمقعد
 * الخامس يبقى شاغرًا معلنًا للسوق حين يأتي؛ لا مساحة معطلة تُعرض اليوم (م8).
 * المراجعة اندمجت نبضةً أعلى «مالي»، والإعدادات ترسٌ في الترويسة. */
export const primaryNavigation: readonly NavigationItem[] = [
  { href: "/", label: "مشروعي الآن", icon: House },
  { href: "/orders", label: "العمل", icon: ClipboardList },
  { href: "/finance", label: "مالي", icon: WalletCards },
];

export function getNavigationLabel(pathname: string) {
  if (pathname.startsWith("/schedule")) return "المواعيد";
  if (pathname.startsWith("/finance")) return "مالي";
  if (pathname.startsWith("/cash")) return "محافظ الكاش";
  if (pathname.startsWith("/inventory")) return "المواد والمخزون";
  if (pathname.startsWith("/suppliers")) return "الموردون والمشتريات";
  if (pathname.startsWith("/settings")) return "الإعدادات";
  return (
    primaryNavigation.find(
      item => item.href === pathname || (item.href !== "/" && pathname.startsWith(item.href)),
    )?.label ?? "مايكرو"
  );
}
