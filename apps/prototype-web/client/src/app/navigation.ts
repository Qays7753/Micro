/**
 * Micro design reminder: navigation stays phone-first, task-oriented, and uses
 * the official semantic design system rather than a generic admin dashboard.
 */
import type { LucideIcon } from "lucide-react";
import { ClipboardList, House, WalletCards, Wrench } from "lucide-react";

export type NavigationItem = { href: string; label: string; icon: LucideIcon };

/* §2.2 محدّثة بقرار «أدواتي» (مبدأ المالك ٥.٤): مشروعي الآن | العمل | [FAB] | مالي | أدواتي.
 * الحاسبة وأدوات التفكير صارت وجهة مستقلة — لا خطوة داخل مسار التزام.
 * الإعدادات ترسٌ في الترويسة، والسوق يبقى قرار توسعة مستقبليًا خارج الشريط. */
export const primaryNavigation: readonly NavigationItem[] = [
  { href: "/", label: "مشروعي الآن", icon: House },
  { href: "/orders", label: "العمل", icon: ClipboardList },
  { href: "/finance", label: "مالي", icon: WalletCards },
  { href: "/tools", label: "أدواتي", icon: Wrench },
];

export function getNavigationLabel(pathname: string) {
  if (pathname.startsWith("/schedule")) return "المواعيد";
  if (pathname.startsWith("/finance")) return "مالي";
  if (pathname.startsWith("/cash")) return "محافظ الكاش";
  if (pathname.startsWith("/inventory")) return "المواد والمخزون";
  if (pathname.startsWith("/suppliers")) return "الموردون والمشتريات";
  if (pathname.startsWith("/parties")) return "دفتر الناس";
  if (pathname.startsWith("/tools")) return "أدواتي";
  if (pathname.startsWith("/settings")) return "الإعدادات";
  /* المجموعة ١: ملف المالك — تسمية سياقية للترويسة بلا مقعد تنقل جديد. */
  if (pathname.startsWith("/profile")) return "ملف المالك";
  return (
    primaryNavigation.find(
      item => item.href === pathname || (item.href !== "/" && pathname.startsWith(item.href)),
    )?.label ?? "مايكرو"
  );
}
