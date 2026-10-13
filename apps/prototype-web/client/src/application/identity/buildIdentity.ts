/**
 * المجموعة ٥ (التحصين الكامل — هوية البناء الحقيقية) + OD-14 = D1
 * (2026-10-13): مصدر واحد لهوية إصدار التطبيق تشترك فيه بيانات التصدير
 * (appVersion) وسجلات التشخيص المحلي.
 *
 * العقد (بعد D1 — حامل index.html):
 * - بناء الإنتاج يحمل هوية حقيقية قابلة للتتبع عبر وسم meta واحد في
 *   index.html يُدخل وقت البناء (vite.config.ts::vitePluginBuildIdentity):
 *   VITE_APP_VERSION إن حُدد صراحة، وإلا SHA البيئة (GITHUB_SHA في Actions
 *   أو CF_PAGES_COMMIT_SHA في Pages). المدخل الجافاسكربتي لم يعد يحمل
 *   الهوية أبدًا — فلا شلال إعادة تهشير مع كل التزام (جذر R10B-NF-038) —
 *   ووسم meta هو الحامل الوحيد الممكن تحت CSP (script-src 'self' بلا
 *   unsafe-inline). البناء يفشل صادقًا إن غاب الحامل أو تلفت قيمته أو
 *   تسربت الهوية إلى أي مخرج JS/CSS/خريطة مصدر.
 * - لا إنتاج في الاختبارات والتطوير المحلي: الوسم غائب هناك فيرجع البديل
 *   الحتمي micro-local-dev — لا ينتحل هوية إنتاج.
 * - قراءة DOM محروسة تعمل في المتصفح ولا ترمي في Node/Vitest (لا مستند
 *   هناك)؛ وتُقرأ مرة واحدة عند تحميل الوحدة — سكربت الوحدة مؤجل دومًا
 *   فالوسم في <head> موجود قبل أي تنفيذ (لا سباق).
 * - الهوية لا تحمل أسرارًا ولا مدخلات مستخدم: سلسلة قصيرة محكومة الطول فقط.
 * - الملفات القديمة بلا appVersion تُقبل كما كانت (الاستيراد اختياري الحقل).
 */

/** اسم وسم الحامل — نفس ثابت vite.config.ts (يفرز اختبار سلكي تساويهما). */
export const APP_IDENTITY_META_NAME = "micro-app-identity";

/** بديل التطوير/الاختبار — حتمي ومعلن كغير إنتاجي بوضوح. */
export const LOCAL_DEV_APP_IDENTITY = "micro-local-dev";

/** حد طول الهوية — أطول من SHA-1 (40) بقليل ويشمل أي لاحقة تسمية قصيرة. */
const MAX_APP_IDENTITY_CHARS = 64;

/** الإكراه الواحد للهوية: سلسلة قصيرة غير فارغة وإلا البديل المحلي الصادق. */
export function resolveAppIdentity(raw: unknown): string {
  if (typeof raw !== "string") return LOCAL_DEV_APP_IDENTITY;
  const trimmed = raw.trim();
  if (trimmed === "" || trimmed.length > MAX_APP_IDENTITY_CHARS) return LOCAL_DEV_APP_IDENTITY;
  return trimmed;
}

type IdentityMetaElement = { getAttribute(name: string): string | null };
type IdentityDocument = { querySelector(selector: string): IdentityMetaElement | null };

/** الهوية المحلولة لهذا البناء — قراءة واحدة عند تحميل الوحدة من حامل
 * index.html (أو البديل المحلي الصادق حين يغيب الحامل).
 * القراءة محروسة (OD-14/D1): سلسلة الاستفهام الاختيارية تحرس غياب المستند
 * في Node/Vitest فلا رمي هناك أبدًا، وفك تهريب السمة في المتصفح يعيد القيمة
 * الأصلية حرفيًا. الإكراه الكامل (نوع/تقليم/طول/فراغ) مسؤولية
 * resolveAppIdentity وحدها كما كان دائمًا — لا مصدر إكراه ثانٍ. */
export const appIdentity = resolveAppIdentity(
  (globalThis as { document?: IdentityDocument }).document
    ?.querySelector(`meta[name="${APP_IDENTITY_META_NAME}"]`)
    ?.getAttribute("content"),
);
