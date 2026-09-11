/**
 * المجموعة ٥ (التحصين الكامل — قالب المسار الآمن): تحويل المسار الحي إلى
 * قالب معروف بلا معاملات ولا استعلام — الطريق الوحيد الذي تدخل به حركة
 * المستخدم إلى أي سجل تشخيصي.
 *
 * قواعد الإخفاء:
 * - الاستعلام (#…) كله يُسقط دومًا — لا قيم استعلام إطلاقًا.
 * - كل مقطع منزوع البنية (معرّف/نوع/معامل) يُطابق فقط قالب :seg المسجل
 *   في جدول المسارات المعروف من MicroRouter.
 * - المسار خارج الجدول يُخفى كليًا إلى /unknown — لا يُمرر نص المسار
 *   الخام أبدًا (قد يحمل معرفات أو قيم حساسة).
 */
const ROUTE_TEMPLATES: readonly string[] = [
  "/",
  "/assets",
  "/assets/new",
  "/assets/:id",
  "/cash",
  "/cash/count",
  "/cash/distribute",
  "/cash/transfer",
  "/cash/entry/:id/reverse",
  "/cash/wallet/new",
  "/cash/wallet/:id",
  "/cash/wallet/:id/adjust",
  "/cash/wallet/:id/opening-later",
  "/catalog",
  "/collect",
  "/direct-sales/new",
  "/direct-sales/:id",
  "/finance",
  "/finance/activity",
  "/finance/g5/declaration",
  "/finance/new/:type",
  "/finance/owner-entitlement",
  "/finance/statement",
  "/finance/withdraw",
  "/foundation",
  "/inventory",
  "/inventory/material/new",
  "/inventory/material/:id/confirm",
  "/inventory/movement/:id/reverse",
  "/inventory/movement/:type",
  "/loans",
  "/loans/new",
  "/loans/:id",
  "/orders",
  "/orders/new",
  "/orders/draft/:id",
  "/orders/draft/:id/agreement",
  "/orders/draft/:id/cost",
  "/orders/:id",
  "/orders/:id/deliver",
  "/parties",
  "/profile",
  "/review",
  "/schedule",
  "/schedule/:id",
  "/settings",
  "/setup",
  "/share/preview",
  "/suppliers",
  "/suppliers/purchase/:id",
  "/suppliers/purchase/:id/payment",
  "/tools",
  "/tools/calculator",
  "/tools/estimate/:id",
  "/tools/integrity",
];

const UNKNOWN_ROUTE_TEMPLATE = "/unknown";

function splitSegments(path: string): readonly string[] {
  return path.split("/").filter(segment => segment !== "");
}

function templateMatches(template: readonly string[], segments: readonly string[]): boolean {
  if (template.length !== segments.length) return false;
  for (let index = 0; index < template.length; index += 1) {
    const expected = template[index];
    if (expected.startsWith(":")) continue;
    if (expected !== segments[index]) return false;
  }
  return true;
}

/** قالب المسار الآمن لموقع حي — الإخفاء الافتراضي /unknown عند أي شك. */
export function routeTemplateFor(location: string): string {
  const pathnameOnly = location.split(/[?#]/, 1)[0] ?? location;
  const segments = splitSegments(pathnameOnly);
  if (segments.length === 0) return "/";
  for (const template of ROUTE_TEMPLATES) {
    if (templateMatches(splitSegments(template), segments)) return template;
  }
  return UNKNOWN_ROUTE_TEMPLATE;
}
