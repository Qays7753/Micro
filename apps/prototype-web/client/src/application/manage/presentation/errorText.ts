/**
 * M5.1 (§11 + T56): نص خطأ مانج الموحّد — رمز §11 → نص الكتالوج حرفيًا،
 * وانقطاع الشبكة → E-OFFLINE (لا يُحفظ شيء)، ورسالة الخادم العربية كما
 * وردت لما ليس له رمز موصوف. لا حرفيات عربية هنا: كل نص من الكتالوج أو
 * من الخادم نفسه.
 */
import { ApiError } from "@/application/network";
import { MANAGE_STRING_KEYS, t, type ManageStringKey } from "../strings/index.js";
import { isNetworkFailure, manageErrorCode } from "../api/errors.js";

const KNOWN_KEYS: readonly string[] = MANAGE_STRING_KEYS;

/** نص الخطأ لعرضه تحت الحقل أو أعلى الورقة (§1.2 قواعد التنقل). */
export function manageErrorText(error: unknown): string {
  const code = manageErrorCode(error);
  if (code !== null && KNOWN_KEYS.includes(code)) {
    return t(code as ManageStringKey);
  }
  if (isNetworkFailure(error)) {
    return t("E-OFFLINE");
  }
  if (error instanceof ApiError && typeof error.message === "string" && error.message.length > 0) {
    return error.message;
  }
  /* غير المتوقع من apiFetch شبكي الشكل (fetch يرفض بTypeError عند انقطاع
   * الاتصال) — E-OFFLINE هو الصادق الوحيد بلا ابتكار نص. */
  return t("E-OFFLINE");
}
