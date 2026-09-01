/**
 * خطافات عقد التنقل (المجموعة ١): قراءة المصدر وبناء روابط تحفظه ورجوع آمن.
 * تُستهلك من الصفحات؛ المنطق الصرف نفسه في navigationContract.ts ومختبر هناك.
 */
import { useCallback } from "react";
import { useLocation, useSearch } from "wouter";
import { canonicalReturnFor, resolveReturnPath, withFrom } from "@/app/navigationContract";

/** مسار الرجوع الآمن: `?from` الصالح أو البديل القانوني للمسار الحالي. */
export function useReturnPath(explicitFallback?: string): string {
  const [location] = useLocation();
  const search = useSearch();
  const fallback = explicitFallback ?? canonicalReturnFor(location);
  return resolveReturnPath(search, fallback, location);
}

/** روابط تحفظ الشاشة الحالية مصدرًا: `linkTo("/orders/1")` → `/orders/1?from=<هنا>`. */
export function useReferrerLinks(): (target: string) => string {
  const [location] = useLocation();
  return useCallback((target: string) => withFrom(target, location), [location]);
}
