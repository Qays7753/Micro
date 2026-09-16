/**
 * خطافات عقد التنقل (المجموعة ١ + EXE-016): قراءة وجهة الرجوع وبناء روابط
 * تحفظها ورجوع آمن — المنطق الصرف نفسه في navigationContract.ts ومختبر هناك.
 * الإنتاج `?returnTo=` (EXE-016)؛ قراءة `?from=` القديم توافق خلفي فقط.
 */
import { useCallback } from "react";
import { useLocation, useSearch } from "wouter";
import { canonicalReturnFor, resolveReturnPath, withReturnTo } from "@/app/navigationContract";

/** مسار الرجوع الآمن: `?returnTo` الصالح (أو `?from` القديم توافقًا) أو البديل القانوني. */
export function useReturnPath(explicitFallback?: string): string {
  const [location] = useLocation();
  const search = useSearch();
  const fallback = explicitFallback ?? canonicalReturnFor(location);
  return resolveReturnPath(search, fallback, location);
}

/** روابط تحفظ الشاشة الحالية وجهة رجوع: `linkTo("/orders/1")` → `/orders/1?returnTo=<هنا>`. */
export function useReferrerLinks(): (target: string) => string {
  const [location] = useLocation();
  return useCallback((target: string) => withReturnTo(target, location), [location]);
}
