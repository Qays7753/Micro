/**
 * M2.2 (§4 + §3.8 — مانج-في₂، الموجة E): عون البناة المشترك — التضييق
 * النوعي لمدخل البناء ومرجع غير الفارغ والتتمة الموحدة (الفحص قبل الإعادة).
 * ملف مستقل بلا دورة: البناة (buildEntry/buildCompoundEntry) يستوردونه،
 * ولا يستورد أحدًا منهم (حدود دورات الاستيراد والتدقيق النوعي).
 */
import { validateLedgerEntry } from "./validateEntry.js";
import type { BuiltLedgerEntry, LedgerEntryBuildInput, LedgerEntryTypeId } from "./types.js";

/** هل النص مرجع غير فارغ؟ (فحص مشترك للمعرفات الممررة). */
export function nonEmptyRef(value: string | undefined): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

/** تضييق مدخل البناء إلى نوعه — حرس وقت التشغيل لكل باني (فشل مغلق). */
export function requireType<K extends LedgerEntryTypeId>(
  input: LedgerEntryBuildInput,
  type: K,
): Extract<LedgerEntryBuildInput, { type: K }> {
  if (input.type !== type) {
    throw new Error(`باني النوع ${type} استُدعي بمدخل نوعه ${input.type} — خطأ برمجي لا يُمرر بصمت.`);
  }
  return input as Extract<LedgerEntryBuildInput, { type: K }>;
}

/** التتمة الموحدة: القيمة المبنية تُفحص قبل إعادتها (يبني ويَتحقق). */
export function finishEntry(entry: BuiltLedgerEntry): BuiltLedgerEntry {
  validateLedgerEntry(entry);
  return entry;
}
