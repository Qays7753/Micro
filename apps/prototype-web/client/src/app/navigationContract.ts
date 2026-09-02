/**
 * عقد التنقل الموحّد (المجموعة ١ — أساس التجربة):
 * كل مسار يمكن فتحه من أكثر من سياق يحفظ أصله ويعود إليه بأمان.
 *
 * القواعد الملزمة (وثّقت في docs/contracts/26-navigation-referrer-and-deep-link-contract.md):
 * 1. `?from=<internal-path>` هو وعاء المصدر الوحيد؛ قيمته مسار داخلي فقط، وإلا
 *    يُهمل ويُستعمل البديل القانوني (canonical fallback) الموثّق لكل محرر.
 * 2. معاملات الوصل العميقة معجم محصور: `focus` / `layer` / `mode` / `event` /
 *    `from` / `to`. أي قيمة مجهولة أو معطوبة تُهمل بصمت — لا انفجار ولا سلوك غريب.
 * 3. الوصلة العميقة الصحيحة تفتح القسم أو الفعل المعنيّ، لا الصفحة العامة.
 * 4. البدء البارد أو التحديث يحفظ النية (المسار+المعاملات في URL) أو يُخفّضها بأمان.
 */
import { getMicroRouteKind } from "@/app/routeClassifier";

export type DeepLinkFocus =
  | "capacity" /* جدول المواعيد: افتح طبقة السعة حيث يُقرأ الضغط */
  | "recurrence" /* جدول المواعيد: افتح طبقة التكرار */
  | "guided-import" /* الإعدادات: افتح بطاقة إدخال الموقف الافتتاحي */
  | "export" /* الإعدادات: افتح حماية البيانات/التصدير */
  | "today" /* الرئيسية: ركّز على قائمة اليوم */
  | "priority"; /* العمل: ركّز على الأولوية الآن */

export type DeepLinkMode = "cover" /* طبقة كاملة فوق الشاشة القائمة */;

export type DeepLinkLayer =
  | "corrections" /* مالي: سجل التصحيحات */
  | "events"; /* مالي: سجل الأحداث المالية */

export type DeepLinkParams = {
  focus: DeepLinkFocus | null;
  layer: DeepLinkLayer | null;
  mode: DeepLinkMode | null;
  event: string | null;
  from: string | null;
  to: string | null;
};

const KNOWN_FOCUS_VALUES: readonly DeepLinkFocus[] = [
  "capacity",
  "recurrence",
  "guided-import",
  "export",
  "today",
  "priority",
];
const KNOWN_LAYER_VALUES: readonly DeepLinkLayer[] = ["corrections", "events"];
const KNOWN_MODE_VALUES: readonly DeepLinkMode[] = ["cover"];

/** مسار داخلي آمن: يبدأ بـ/، بلا فراغات، وبلا مخطط خارجي — يُهمل ما عداه. */
export function isSafeInternalPath(value: string): boolean {
  if (!value.startsWith("/") || value.length > 256) return false;
  if (/[\s"'<>\0]/.test(value)) return false;
  if (value.startsWith("//")) return false; // بروتوكول-نسبي خارجي
  return true;
}

function firstKnown<T extends string>(value: string | null, known: readonly T[]): T | null {
  if (value === null) return null;
  return (known as readonly string[]).includes(value) ? (value as T) : null;
}

/** قراءة دفاعية لسلسلة الاستعلام (search فقط، بلا hash) — القيم المجهولة تصبح null. */
export function parseDeepLink(search: string | null | undefined): DeepLinkParams {
  let query: URLSearchParams;
  try {
    query = new URLSearchParams(search ?? "");
  } catch {
    return { focus: null, layer: null, mode: null, event: null, from: null, to: null };
  }
  const from = query.get("from");
  const to = query.get("to");
  return {
    focus: firstKnown(query.get("focus"), KNOWN_FOCUS_VALUES),
    layer: firstKnown(query.get("layer"), KNOWN_LAYER_VALUES),
    mode: firstKnown(query.get("mode"), KNOWN_MODE_VALUES),
    /* معرّف الحدث المالي حر الشكل لكنه مقصور ومقيد بالطول ومحارف آمنة. */
    event: query.get("event") && /^[A-Za-z0-9_-]{1,64}$/.test(query.get("event") as string)
      ? (query.get("event") as string)
      : null,
    from: from && isSafeInternalPath(from) ? from : null,
    to: to && isSafeInternalPath(to) ? to : null,
  };
}

/** إلحاق معاملات بالمسار مع الحفاظ على الاستعلام القائم — بلا ازدواج. */
export function appendQueryParams(path: string, params: Record<string, string | null | undefined>): string {
  const [pathname, existingSearch = ""] = path.split("?", 2);
  const query = new URLSearchParams(existingSearch);
  for (const [key, value] of Object.entries(params)) {
    if (value === null || value === undefined || value === "") continue;
    if (query.get(key) === value) continue;
    query.set(key, value);
  }
  const search = query.toString();
  return search ? `${pathname}?${search}` : pathname;
}

/** وصلة تحفظ المصدر: `withFrom(target, source)` — المصدر مسار داخلي فقط. */
export function withFrom(target: string, source: string): string {
  if (!isSafeInternalPath(source)) return target;
  return appendQueryParams(target, { from: source });
}

/**
 * حل مسار الرجوع: `?from` إن وُجد وصالح، وإلا البديل القانوني الموثّق.
 * المصدر الذي يساوي المسار الحالي نفسه (حلقة) يُهمل — رجوع للأصل لا دوران.
 */
export function resolveReturnPath(
  search: string | null | undefined,
  canonicalFallback: string,
  currentPathname?: string,
): string {
  const { from } = parseDeepLink(search);
  if (from && from !== currentPathname && isSafeInternalPath(from)) return from;
  return canonicalFallback;
}

/**
 * البديل القانوني لكل مسار عميق — سجل واحد، لا أهداف رجوع ثابتة مبعثرة في الصفحات.
 * عند غياب `?from` هذه هي الوجهة الموثّقة (نفس سلوك ما قبل المجموعة ١ حيث وُجد).
 */
export const canonicalReturnFallbacks: Readonly<Record<string, string>> = {
  "/direct-sales/new": "/orders",
  "/orders/new": "/orders",
  "/orders/draft/new": "/orders",
  "/finance/withdraw": "/finance",
  "/finance/owner-entitlement": "/finance",
  "/finance/g5/declaration": "/finance",
  "/cash/wallet/new": "/cash",
  "/cash/transfer": "/cash",
  "/cash/distribute": "/cash",
  "/cash/count": "/cash",
  "/inventory/material/new": "/inventory",
  "/schedule": "/",
  "/parties": "/finance",
  "/profile": "/",
  /* المجموعة ٢ (Scope B): ورقة التحصيل — البديل القانوني هو الرئيسية (المركز). */
  "/collect": "/",
  /* المجموعة ٢ (§9.2): كشف الفترة — يفتح من مالي والرئيسية؛ البديل مالي. */
  "/finance/statement": "/finance",
  /* المجموعة ٣ (Scope C — §9.3): الحاسبة وصفحة التقدير — البديل القانوني أدواتي (بيتهما). */
  "/tools/calculator": "/tools",
  /* المجموعة ٣ (فحص حي): الكتالوج بلا مصدر كان يعود إلى نفسه (حلقة) — بيته أدواتي. */
  "/catalog": "/tools",
};

/** البديل القانوني لمسار بمعرّف: يُستخرج من نمط المسار لا من قائمة مغلقة. */
export function canonicalReturnFor(pathname: string): string {
  const exact = canonicalReturnFallbacks[pathname];
  if (exact) return exact;
  if (pathname.startsWith("/orders/draft/")) return "/orders";
  if (pathname.startsWith("/orders/")) return "/orders";
  if (pathname.startsWith("/direct-sales/")) return "/orders";
  if (pathname.startsWith("/schedule/")) return "/schedule";
  if (pathname.startsWith("/finance/")) return "/finance";
  if (pathname.startsWith("/suppliers/")) return "/suppliers";
  if (pathname.startsWith("/cash/")) return "/cash";
  if (pathname.startsWith("/inventory/")) return "/inventory";
  if (pathname.startsWith("/catalog")) return "/catalog";
  if (pathname.startsWith("/tools")) return "/tools";
  if (pathname === "/profile") return "/";
  return "/";
}

/** هل المسار سطح (يُبقي التنقل السفلي)؟ يُستعمل لتصنيف المصدر عند الحاجة. */
