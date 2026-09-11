/**
 * المجموعة ٨ (المعالجة الرباعية — حارس STR-010): اختبار تزامن معرفة المسارات
 * بين مصادرها الأربعة — جدول المسارات في `MicroRouter.tsx`، وتصنيف العمق في
 * `routeClassifier.ts`، وبدائل الرجوع القانونية في `navigationContract.ts`،
 * وتسميات التنقل في `navigation.ts`. لا يحتوي هذا الاختبار على «نسخة ثالثة»
 * من القوائم: الجدول يُستخرج من مصدر الموجّه حيًّا، والتصنيف والبدائل تُستورد
 * من وحداتها الحقيقية، والخرائط الصريحة أدناه هي عقد القصد (لماذا هذا المسار
 * محررًا عميقًا أو سطح قراءة) — وكل مسار جديد في الموجّه يجب أن يُصنَّف هنا
 * صراحة وإلا فشل الاختبار، فلا ينزلل مسار بلا قرار عمق واعٍ.
 *
 * الحالات التي يفشل عندها الاختبار (مثبتة بعينات سلبية داخلية):
 * مسار محرر بلا تصنيف عميق؛ بديل رجوع يشير لمسار غير موجود؛ نمط عمق لا يطابق
 * أي مسار قائم (نمط ميت)؛ مسار جديد بلا تصنيف في العقد؛ نمط عمق يبتلع سطحًا؛
 * بديل محرر يعيد المحرر إلى نفسه (حلقة).
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { getMicroRouteKind, isDeepFlowPath } from "./routeClassifier";
import { canonicalReturnFallbacks, canonicalReturnFor } from "./navigationContract";
import { getNavigationLabel, primaryNavigation } from "./navigation";

function readRepoFile(relative: string): string {
  return readFileSync(fileURLToPath(new URL(relative, import.meta.url)), "utf8");
}

const routerSource = readRepoFile("./MicroRouter.tsx");
const classifierSource = readRepoFile("./routeClassifier.ts");

/** استخراج أنماط المسارات من مصدر الموجّه — فشل التحليل يُعلن بصوت عالٍ. */
function extractRoutePatterns(source: string): string[] {
  const patterns = [...source.matchAll(/<Route\s+path="([^"]+)"/g)].map(match => match[1]);
  if (patterns.length < 40) {
    throw new Error(`route table parse failed: only ${patterns.length} routes extracted`);
  }
  return patterns;
}

/** استخراج أنماط العمق الحرفية من مصدر المصنّف (لا يُصدَّر قصدًا — يُقرأ من مصدره). */
function extractDeepPatternLiterals(source: string): RegExp[] {
  const literals = source
    .split("\n")
    .map(line => line.trim())
    .filter(line => line.startsWith("/^") && (line.endsWith("/,") || line.endsWith("/")))
    .map(line => (line.endsWith(",") ? line.slice(0, -1) : line));
  if (literals.length < 20) {
    throw new Error(`deep-pattern parse failed: only ${literals.length} patterns extracted`);
  }
  return literals.map(literal => new RegExp(literal.slice(1, -1)));
}

/** تحويل نمط wouter إلى مسار خرساني للفحص (العينة لا تؤثر في التصنيف). */
function concretePath(pattern: string): string {
  return pattern.replace(/:[A-Za-z]+/g, "sample");
}

/** هل المسار مغطى بمجموعة أنماط (حرفيًا أو بارامتريًا)؟ */
function routeExists(path: string, patterns: readonly string[]): boolean {
  return patterns.some(pattern => {
    if (pattern === path) return true;
    const matcher = new RegExp(`^${pattern.replace(/:[A-Za-z]+/g, "[^/]+")}$`);
    return matcher.test(path);
  });
}

/**
 * عقد القصد الصريح — لماذا هذا القانوني: المحرر واجهة فعل واحد يحرس مدخلات
 * غير محفوظة (يخفي شريط التنقل)، والسطح قراءة/تنقل يحتفظ به. المصدر: عقد
 * التنقل ٢٦ وقاعدة U-005 في `routeClassifier.ts`؛ تعديل التصنيف هنا قرار
 * عمق واعٍ يجب أن يرافقه تعديل المصنّف في الالتزام نفسه.
 */
const EDITOR_ROUTES: Readonly<Record<string, string>> = {
  "/direct-sales/new": "بيع مباشر جديد — محرر فعل واحد",
  "/direct-sales/:id": "تعديل/تصحيح بيع مباشر — محرر",
  "/orders/new": "طلب جديد — محرر مسودة كامل",
  "/orders/draft/:id": "محرر مسودة الطلب",
  "/orders/draft/:id/agreement": "محرر الاتفاق",
  "/orders/draft/:id/cost": "محرر التكلفة",
  "/orders/:id/deliver": "مراجعة تسليم — محرر فعل قبل الالتزام",
  "/schedule/:id": "محرر موعد",
  "/finance/new/:type": "محرر حدث مالي",
  "/finance/withdraw": "المدخل الموحد لسحب المالك (X-05)",
  "/finance/owner-entitlement": "دفتر حق المالك — محرر عميق",
  "/finance/g5/declaration": "محرر إعلان التعادل",
  "/suppliers/purchase/:id": "محرر شراء",
  "/suppliers/purchase/:id/payment": "ورقة دفعة المورد — محرر فعل",
  "/cash/wallet/new": "محرر محفظة",
  "/cash/wallet/:id/adjust": "محرر ضبط محفظة",
  "/cash/wallet/:id/opening-later": "إكمال رصيد الافتتاح (D-004) — محرر",
  "/cash/transfer": "تحويل بين المحافظ — محرر فعل مالي",
  "/cash/distribute": "توزيع غير الموزّع — محرر فعل مالي",
  "/cash/count": "عدّ الصندوق — محرر جلسة عد",
  "/cash/entry/:id/reverse": "عكس قيد كاش — محرر فعل",
  "/collect": "ورقة التحصيل — محرر فعل واعٍ بالمصدر",
  "/inventory/material/new": "محرر مادة",
  "/inventory/material/:id/confirm": "تأكيد رصيد مادة — محرر عميق",
  "/inventory/movement/:id/reverse": "عكس حركة مخزون — محرر فعل",
  "/inventory/movement/:type": "محرر حركة مخزون",
  "/tools/calculator": "الحاسبة — أداة تفكير عميقة تحرس المدخلات",
  "/tools/estimate/:id": "صفحة التقدير — عمق تفكير محروس",
  "/assets/new": "محرر أصل",
  "/assets/:id": "تفصيل/تحرير أصل — عمق",
  "/loans/new": "محرر قرض",
  "/loans/:id": "تفصيل/تحرير قرض — عمق",
  "/share/preview": "معاينة المشاركة — محرر نص عميق (عقد ٣٣)",
};

/** أسطح القراءة/التنقل — تبقي الشريط السفلي (قاعدة U-005: القارئ سطح). */
const SURFACE_ROUTES: readonly string[] = [
  "/",
  "/foundation",
  "/orders",
  "/orders/:id",
  "/schedule",
  "/suppliers",
  "/cash",
  "/cash/wallet/:id",
  "/inventory",
  "/catalog",
  "/tools",
  "/tools/integrity",
  "/assets",
  "/loans",
  "/parties",
  "/finance",
  "/finance/statement",
  "/finance/activity",
  "/settings",
  "/profile",
];

/** مسارات ذات دور خاص: الإقلاع الأول (نوع setup) وحامل التحويل /review. */
const SPECIAL_ROUTES: Readonly<Record<string, string>> = {
  "/setup": "بوابة الإقلاع الأولى — نوع setup لا سطح ولا عمق",
  "/review": "حامل التحويل القديم → /finance — ليس صفحة",
};

/** مسارات خرسانية حرفية إضافية يغطيها النمط البارامتري لكن لها عقد خاص. */
const LITERAL_PATHS: readonly string[] = ["/orders/draft/new"];

type Violations = string[];

/** الفاحصات — دوال نقية تُعيد قائمة انتهاكاتها (فارغة = متزامن). */
function checkClassificationAgreement(
  routerPatterns: readonly string[],
  editors: Readonly<Record<string, string>>,
  surfaces: readonly string[],
): Violations {
  const violations: Violations = [];
  const classified = new Set([...Object.keys(editors), ...surfaces, ...Object.keys(SPECIAL_ROUTES)]);
  for (const pattern of routerPatterns) {
    if (!classified.has(pattern)) {
      violations.push(
        `route "${pattern}" is not classified in the sync contract (add to EDITOR_ROUTES or SURFACE_ROUTES with the depth decision)`,
      );
    }
  }
  for (const pattern of Object.keys(editors)) {
    if (!routerPatterns.includes(pattern)) {
      violations.push(`declared editor "${pattern}" has no <Route> in MicroRouter`);
    } else if (surfaces.includes(pattern)) {
      violations.push(`route "${pattern}" is classified as both editor and surface`);
    }
  }
  for (const pattern of surfaces) {
    if (!routerPatterns.includes(pattern)) {
      violations.push(`declared surface "${pattern}" has no <Route> in MicroRouter`);
    }
  }
  for (const pattern of routerPatterns) {
    const path = concretePath(pattern);
    const kind = getMicroRouteKind(path);
    const expected = Object.prototype.hasOwnProperty.call(editors, pattern)
      ? "deep"
      : surfaces.includes(pattern)
        ? "surface"
        : null;
    if (expected === null) continue;
    if (expected === "deep" && kind !== "deep") {
      violations.push(
        `editor route "${pattern}" is classified "${kind}" — the classifier lost its deep coverage`,
      );
    }
    if (expected === "surface" && kind === "deep") {
      violations.push(
        `surface route "${pattern}" is swallowed by a deep-flow pattern — navigation would disappear on a reading surface`,
      );
    }
  }
  return violations;
}

function checkDeepPatternLiveness(
  routerPatterns: readonly string[],
  deepPatterns: readonly RegExp[],
): Violations {
  const violations: Violations = [];
  const concretePaths = [...routerPatterns.map(concretePath), ...LITERAL_PATHS];
  for (const pattern of deepPatterns) {
    if (!concretePaths.some(path => pattern.test(path))) {
      violations.push(`deep-flow pattern ${pattern} matches no existing route — stale classifier entry`);
    }
  }
  return violations;
}

function checkFallbackTargets(
  routerPatterns: readonly string[],
  fallbacks: Readonly<Record<string, string>>,
): Violations {
  const violations: Violations = [];
  for (const [from, to] of Object.entries(fallbacks)) {
    if (!routeExists(from, routerPatterns)) {
      violations.push(`canonical fallback key "${from}" is not a route`);
    }
    if (!routeExists(to, routerPatterns)) {
      violations.push(`canonical fallback for "${from}" points to unknown route "${to}"`);
    }
  }
  return violations;
}

function checkEditorReturnCoverage(
  routerPatterns: readonly string[],
  editors: Readonly<Record<string, string>>,
  resolveReturn: (path: string) => string = canonicalReturnFor,
): Violations {
  const violations: Violations = [];
  for (const pattern of Object.keys(editors)) {
    const path = concretePath(pattern);
    const fallback = resolveReturn(path);
    if (fallback === path) {
      violations.push(`editor "${path}" returns to itself (self-loop fallback)`);
    }
    if (!routeExists(fallback, routerPatterns)) {
      violations.push(`editor "${path}" falls back to unknown route "${fallback}"`);
    }
  }
  for (const literal of LITERAL_PATHS) {
    const fallback = resolveReturn(literal);
    if (!routeExists(fallback, routerPatterns)) {
      violations.push(`literal "${literal}" falls back to unknown route "${fallback}"`);
    }
  }
  return violations;
}

const routerPatterns = extractRoutePatterns(routerSource);
const deepPatterns = extractDeepPatternLiterals(classifierSource);

describe("route knowledge synchronization (Group 8, STR-010)", () => {
  it("every route is deliberately classified and the classifier agrees (editors deep, surfaces keep chrome)", () => {
    const violations = checkClassificationAgreement(routerPatterns, EDITOR_ROUTES, SURFACE_ROUTES);
    expect(violations).toEqual([]);
    expect(routerPatterns.length).toBeGreaterThanOrEqual(50);
    expect(Object.keys(EDITOR_ROUTES).length).toBeGreaterThanOrEqual(30);
    expect(SURFACE_ROUTES.length).toBeGreaterThanOrEqual(15);
    /* الدور الخاص يبقى كما هو: الإقلاع نوع مستقل، وحامل التحويل سطح بلا عمق. */
    expect(getMicroRouteKind("/setup")).toBe("setup");
    expect(getMicroRouteKind("/review")).toBe("surface");
  });

  it("every deep-flow pattern in the classifier is live against the real route table", () => {
    expect(checkDeepPatternLiveness(routerPatterns, deepPatterns)).toEqual([]);
    expect(deepPatterns.length).toBeGreaterThanOrEqual(25);
  });

  it("every canonical fallback key and target resolve to real routes (including the /orders/draft/new exact entry)", () => {
    expect(checkFallbackTargets(routerPatterns, canonicalReturnFallbacks)).toEqual([]);
    expect(canonicalReturnFallbacks["/orders/draft/new"]).toBe("/orders");
    expect(isDeepFlowPath("/orders/draft/new")).toBe(true);
  });

  it("every editor resolves a real non-self fallback; the redirect target exists; nav labels never break", () => {
    expect(checkEditorReturnCoverage(routerPatterns, EDITOR_ROUTES)).toEqual([]);
    const redirectTargets = [...routerSource.matchAll(/<Redirect to="([^"]+)"\s*\/>/g)].map(
      match => match[1],
    );
    expect(redirectTargets).toContain("/finance");
    for (const item of primaryNavigation) {
      expect(routeExists(item.href, routerPatterns)).toBe(true);
    }
    for (const pattern of routerPatterns) {
      expect(getNavigationLabel(concretePath(pattern)).length).toBeGreaterThan(0);
    }
  });

  it("negative proof: the checkers catch drift when fed mutated knowledge (no snapshot duplication)", () => {
    /* محرر سقط من الجدول — الاكتمال يفشل. */
    const routerMissingEditor = routerPatterns.filter(pattern => pattern !== "/share/preview");
    expect(
      checkClassificationAgreement(routerMissingEditor, EDITOR_ROUTES, SURFACE_ROUTES).length,
    ).toBeGreaterThan(0);
    /* بديل يشير لمسار غير موجود. */
    expect(checkFallbackTargets(routerPatterns, { "/orders/new": "/does-not-exist" })).not.toEqual([]);
    /* نمط عمق ميت لا يطابق أي مسار قائم. */
    expect(checkDeepPatternLiveness(routerPatterns, [/^\/legacy\/[^/]+$/])).not.toEqual([]);
    /* مسار قائم بلا تصنيف في العقد — الانزلاق الصامت ممنوع. */
    const unclassifiedRouter = [...routerPatterns, "/brand-new-feature"];
    expect(checkClassificationAgreement(unclassifiedRouter, EDITOR_ROUTES, SURFACE_ROUTES)).not.toEqual([]);
    /* سطح يعلن محررًا والمصنّف يخالفه. */
    const catalogAsEditor = { ...EDITOR_ROUTES, "/catalog": "misclassified" };
    const surfacesWithoutCatalog = SURFACE_ROUTES.filter(pattern => pattern !== "/catalog");
    expect(checkClassificationAgreement(routerPatterns, catalogAsEditor, surfacesWithoutCatalog)).not.toEqual(
      [],
    );
    /* بديل محرر يعيد المحرر إلى نفسه (حلقة رجوع). */
    expect(checkEditorReturnCoverage(routerPatterns, EDITOR_ROUTES, path => path)).not.toEqual([]);
  });
});
