/**
 * مبدأ Micro: يحدد هذا الملف عمق المسار من مركز واحد كي يبقى الرجوع والسياق
 * موحدين، ولا تتكرر قوائم المسارات داخل الصفحات.
 *
 * U-005: قاعدة تنقل موحدة للأسطح التفصيلية —
 * - سطح قراءة تفصيلي (OrderDetail وأمثاله) يُبقي التنقل السفلي كي لا يفقد المالك
 *   اتجاهه، مع زر رجوعٍ لأصله دائمًا؛
 * - محرر عميق (DirectSaleEditor/DraftEditor/FinancialEventEditor...) يخفي التنقل
 *   عمدًا: سبب التركيز على فعل واحد وحماية التغييرات غير المحفوظة (UnsavedChangesGuard)،
 *   وزر الرجوع لأصله أعلى الصفحة يحفظ الاتجاه.
 * فالاختلاف الظاهر بين «تفاصيل طلب تعرض التنقل» و«بيع مباشر محرر يخفيه» ليس تضاربًا
 * بل تطبيق القاعدة نفسها: القارئ سطح، والمحرر عمق.
 */
export type MicroRouteKind = "setup" | "deep" | "surface";

const deepFlowPatterns: readonly RegExp[] = [
  /^\/direct-sales\/[^/]+$/,
  /^\/orders\/new$/,
  /^\/orders\/draft\/[^/]+(?:\/(?:agreement|cost))?$/,
  /^\/finance\/new\/[^/]+$/,
  /* X-05: المدخل الموحد للسحب عمق نموذج واحد، مثل بقية محررات الأفعال المالية. */
  /^\/finance\/withdraw$/,
  /^\/finance\/owner-entitlement$/,
  /^\/finance\/g5\/declaration$/,
  /^\/suppliers\/purchase\/[^/]+(?:\/payment)?$/,
  /* المجموعة ٢ (Scope B): ورقة التحصيل — محرر فعل مالي واحد عميق كإخوته. */
  /^\/collect$/,
  /^\/cash\/wallet\/new$/,
  /^\/cash\/transfer$/,
  /^\/cash\/distribute$/,
  /^\/cash\/count$/,
  /^\/cash\/wallet\/[^/]+\/adjust$/,
  /* D-004: إكمال رصيد الافتتاح المجهول — محرر فعل واحد عميق كإخوته. */
  /^\/cash\/wallet\/[^/]+\/opening-later$/,
  /^\/cash\/entry\/[^/]+\/reverse$/,
  /^\/inventory\/material\/new$/,
  /^\/inventory\/movement\/[^/]+\/reverse$/,
  /^\/inventory\/movement\/[^/]+$/,
  /^\/schedule\/[^/]+$/,
  /* المجموعة ٣ (Scope A/B): الحاسبة وصفحة التقدير محررا تفكير عميقة كإخوتهما —
   * حارس المدخلات غير المحفوظة وزر الرجوع للمصدر بدل شريط التنقل. */
  /^\/tools\/calculator$/,
  /^\/tools\/estimate\/[^/]+$/,
];

function pathnameOnly(location: string) {
  return location.split(/[?#]/, 1)[0] ?? location;
}

export function isDeepFlowPath(location: string) {
  return deepFlowPatterns.some(pattern => pattern.test(pathnameOnly(location)));
}

export function getMicroRouteKind(location: string): MicroRouteKind {
  const pathname = pathnameOnly(location);
  if (pathname === "/setup") return "setup";
  return isDeepFlowPath(pathname) ? "deep" : "surface";
}

export function showsGlobalChrome(location: string) {
  return getMicroRouteKind(location) === "surface";
}
