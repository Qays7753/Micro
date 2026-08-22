/**
 * Micro design reminder: navigation stays phone-first, task-oriented, and uses
 * the official semantic design system rather than a generic admin dashboard.
 */
import type { LucideIcon } from "lucide-react";
import { ChartNoAxesColumnIncreasing, ClipboardList, House, Settings } from "lucide-react";

export type NavigationItem = { href: string; label: string; icon: LucideIcon };

export const primaryNavigation: readonly NavigationItem[] = [
  { href: "/", label: "مشروعي الآن", icon: House },
  { href: "/orders", label: "الطلبات", icon: ClipboardList },
  { href: "/review", label: "المراجعة", icon: ChartNoAxesColumnIncreasing },
  { href: "/settings", label: "الإعدادات", icon: Settings },
];

export function getNavigationLabel(pathname: string) {
  return primaryNavigation.find(item => item.href === pathname || (item.href !== "/" && pathname.startsWith(item.href)))?.label ?? "مايكرو";
}
