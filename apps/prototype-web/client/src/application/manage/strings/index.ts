/**
 * M1.8 (§10/§11 + §14.2 / قرار المالك D-7): باب كتالوج نصوص مانج —
 * المفتاح نصّه. `t(key)` تنظر في `ar.ts` (النسخة الحرفية من المواصفة)
 * وترمي فشلًا مغلقًا على أي مفتاح غير معروف: لا نص افتراضي ولا سقوط
 * صامت — الخطأ في المفتاح خطأ برمجي يظهر فورًا.
 *
 * رسالة الرمي إنجليزية عمدًا: هذا الملف داخل نطاق حارس النص الحرفي
 * (check-manage-literal-text.mjs) الذي يحظر العربية الحرفية خارج
 * `strings/ar.ts` وحده، والرسالة موجهة للمطوّر لا للمستخدم — النص
 * العربي للمستخدم من الكتالوج وحده.
 */
import { MANAGE_STRINGS_AR } from "./ar";
import type { ManageStringKey } from "./keys";

export type { ManageStringKey } from "./keys";
export { MANAGE_STRING_KEYS } from "./keys";
export { MANAGE_STRINGS_AR } from "./ar";

/** نص مانج العربي لمفتاح معروف — يرمي على المجهول (فشل مغلق). */
export function t(key: ManageStringKey): string {
  const text = MANAGE_STRINGS_AR[key];
  if (text === undefined) {
    throw new Error(`Unknown Manage string key: ${key}`);
  }
  return text;
}
