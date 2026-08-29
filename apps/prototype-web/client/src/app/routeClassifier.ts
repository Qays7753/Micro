/**
 * مبدأ Micro: يحدد هذا الملف عمق المسار من مركز واحد كي يبقى الرجوع والسياق
 * موحدين، ولا تتكرر قوائم المسارات داخل الصفحات.
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
  /^\/cash\/wallet\/new$/,
  /^\/cash\/transfer$/,
  /^\/cash\/wallet\/[^/]+\/adjust$/,
  /^\/cash\/entry\/[^/]+\/reverse$/,
  /^\/inventory\/material\/new$/,
  /^\/inventory\/movement\/[^/]+\/reverse$/,
  /^\/inventory\/movement\/[^/]+$/,
  /^\/schedule\/[^/]+$/,
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
