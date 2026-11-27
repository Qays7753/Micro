/**
 * M5.1 (Manage v2 phase 5 — §9 R-1a/R-20 + IMPACT §12 «Presentation (عميل)»):
 * تنسيق **إدخال** المال لأسطح مانج — الطبقة الواحدة التي تحوّل نص حقل
 * المبلغ (C-01) إلى عدد صحيح بالفلس **للإرسال فقط**، والقيمة المُعبّأة
 * مسبقًا من الخادم إلى نص حقل قانوني.
 *
 * الحدود (ملزمة):
 *  - لا يُنسَّق هنا أي رقم **محسوب**؛ كل مبلغ معروض على الشاشة يأتي بنصه
 *    الجاهز من موديول قراءة §8 في الخادم (`text`/`textDashboard`) — هذا
 *    الملف لمدخلات المستخدم وحدها (القيم المدخلة تُعرض كما أُدخلت).
 *  - النسخة العميلية هذه تعكس عقد محلل الدومين `filsFromJodText` حرفيًا
 *    (R10 يمنع استيراد العميل من مجال مانج) — لكنها ترجع null بدل الرمي:
 *    القرار «مبلغ غير صالح» يعرض رسالة §11 (E-AMOUNT) من الكتالوج، لا
 *    استثناءً خامًا.
 *  - حساب صحيح خالص (BigInt للتحويل الخام وfloorRatio من النواة المشتركة
 *    للتجزئة — D-02) بلا أي Math خام؛ الفلس وحدة الإرسال الوحيدة (R-1)،
 *    والخادم يعيد التحقق من كل قيمة على كل حال.
 */

import { floorRatio } from "@micro-domain/shared/index.js";

/** ١ دينار = ١٠٠٠ فلس (ISO 4217) — ثابت العرض والإرسال. */
export const MANAGE_FILS_PER_JOD = 1000;

/** نص قانوني بالكامل (R-20): جزء صحيح مجرد أو مجمَّع بفواصل آلاف صحيحة +
 *  كسر اختياري من ١–٣ أرقام. الأرقام الإنجليزية حصرًا؛ لا إشارة ولا فراغ. */
const JOD_INPUT_PATTERN = /^(?:\d{1,3}(?:,\d{3})+|\d+)(?:\.\d{1,3})?$/;

/** تحليل نص إدخال المال إلى فلس صحيح — null على أي نص غير قانوني (فشل
 *  مغلق بلا تخمين): «12.350» و«12.35» و«12» و«1,250.000» مقبولة. */
export function parseJodInputToFils(text: string): number | null {
  if (typeof text !== "string" || text.length === 0 || !JOD_INPUT_PATTERN.test(text)) return null;
  const [wholePart, fractionPart = ""] = text.split(".");
  const wholeDigits = (wholePart ?? "").replace(/,/g, "");
  const fractionDigits = `${fractionPart}000`.slice(0, 3);
  const fils = BigInt(wholeDigits) * BigInt(MANAGE_FILS_PER_JOD) + BigInt(fractionDigits);
  if (fils > BigInt(Number.MAX_SAFE_INTEGER)) return null;
  return Number(fils);
}

/** تجميع الجزء الصحيح بمجموعات ثلاث بفاصلة «,» (R-20) — معالجة نصية صرفة. */
function groupThousands(wholeDigits: string): string {
  const groups: string[] = [];
  let remaining = wholeDigits;
  while (remaining.length > 3) {
    groups.unshift(remaining.slice(-3));
    remaining = remaining.slice(0, -3);
  }
  groups.unshift(remaining);
  return groups.join(",");
}

/** نص حقل المبلغ لقيمة فلس من الخادم (تعبئة C-01 مسبقًا): ٣ منازل دائمًا
 *  (R-1a) بلا رمز العملة (اللاحقة «د» ثابتة على الحقل نفسه — R-22).
 *  القيمة السالبة غير مدخلة أبدًا (الأرصدة السالبة محسوبة لا مدخلة). */
export function jodInputText(fils: number): string {
  if (!Number.isSafeInteger(fils) || fils < 0) return "";
  const whole = floorRatio(fils, MANAGE_FILS_PER_JOD) ?? 0;
  const fraction = fils % MANAGE_FILS_PER_JOD;
  return `${groupThousands(String(whole))}.${String(fraction).padStart(3, "0")}`;
}
