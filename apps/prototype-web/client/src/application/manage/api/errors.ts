/**
 * M5.1 (Manage v2 phase 5 — IMPACT §12 «Client API»): خرائط أخطاء مانج-في₂
 * — استخراج رمز §11 من مغلّف خطأ الشبكة الموحّد.
 *
 * الخادم يرفض عمليات §5 بمغلّف `{ error: { code: "e-amount", details:
 * { code: "E-AMOUNT" } } }` — الرمز الكبير في `details.code` هو مفتاح
 * الكتالوج الحرفي (§11). أي شيء آخر (شبكة/خادم/مجهول) يرجع null: الشاشة
 * تعرض رسالة E-OFFLINE عند انقطاع الاتصال (T56) أو تترك الخطأ للسياق.
 */
import { ApiError } from "@/application/network";

/** رمز §11 (E-AMOUNT…) من خطأ نداء — null إذا لم يكن رفضًا موصوفًا. */
export function manageErrorCode(error: unknown): string | null {
  if (!(error instanceof ApiError)) return null;
  const details = error.details as { code?: unknown } | null | undefined;
  if (details !== null && typeof details === "object" && typeof details.code === "string") {
    return details.code;
  }
  return null;
}

/** هل الخطأ انقطاع اتصال (T56: E-OFFLINE — لا يُحفظ شيء)؟ */
export function isNetworkFailure(error: unknown): boolean {
  return error instanceof TypeError || (error instanceof ApiError && error.status === 0);
}
