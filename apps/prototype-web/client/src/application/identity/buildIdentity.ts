/**
 * المجموعة ٥ (التحصين الكامل — هوية البناء الحقيقية): مصدر واحد لهوية
 * إصدار التطبيق تشترك فيه بيانات التصدير (appVersion) وسجلات التشخيص المحلي.
 *
 * العقد:
 * - بناء الإنتاج يحمل هوية حقيقية قابلة للتتبع: VITE_APP_VERSION إن حُدد
 *   صراحة، وإلا SHA البناء من بيئة GitHub Actions (GITHUB_SHA) أو Cloudflare
 *   Pages (CF_PAGES_COMMIT_SHA) — تُحقن وقت البناء عبر define في vite.config.
 * - لا إنتاج في الاختبارات والتطوير المحلي: القيمة المحقونة غائبة هناك
 *   (typeof-guard) فيرجع البديل الحتمي micro-local-dev — لا ينتحل هوية إنتاج.
 * - الهوية لا تحمل أسرارًا ولا مدخلات مستخدم: سلسلة قصيرة محكومة الطول فقط.
 * - الملفات القديمة بلا appVersion تُقبل كما كانت (الاستيراد اختياري الحقل).
 */
declare const __MICRO_APP_IDENTITY__: string | null | undefined;

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

function injectedIdentity(): string | null {
  /* typeof-guard: القيمة محقونة في بناء Vite (حتى null) وغائبة في vitest —
   * فلا ReferenceError ولا انتحال هوية في الاختبارات. */
  return typeof __MICRO_APP_IDENTITY__ === "undefined" ? null : __MICRO_APP_IDENTITY__;
}

/** الهوية المحلولة لهذا البناء — تُقرأ مرة عند تحميل الوحدة. */
export const appIdentity = resolveAppIdentity(injectedIdentity());
