/*
 * R10-B4/F-015 (2026-10-12): مزامنة ميكانيكية بين قائمة المسارات في اختبار
 * الدخان وأنماط الموجّه الحية — القائمة كانت تنمو منفصلة عن الموجّه فغابت
 * تسعة أنماط والمسار الافتراضي والتعليق انحرف (قال 55 والعدد 56). هذا
 * الاختبار يفشل بالاسم عند أي انجراف مستقبلي: كل نمط من MicroRouter له
 * مسار واحد على الأقل في القائمة ببنية مطابقة (الأجزاء الحرفية متساوية
 * والمعاملاتwildcard)، والمسار الافتراضي مغطى بمسار لا يطابق أي نمط آخر،
 * وعدد التعليق مطابق لطول القائمة.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const CLIENT_SRC = import.meta.dirname;

function routerPatterns(): { patterns: string[]; hasCatchAll: boolean } {
  const source = readFileSync(resolve(CLIENT_SRC, "app/MicroRouter.tsx"), "utf8");
  const patterns = [...source.matchAll(/<Route[^>]*\bpath="([^"]+)"/g)].map(match => match[1]);
  /* المسار الافتراضي: <Route component={NotFound} /> بلا path. */
  const hasCatchAll = /<Route\s+component=\{NotFound\}\s*\/>/.test(source);
  return { patterns, hasCatchAll };
}

function smokeRoutes(): string[] {
  const source = readFileSync(resolve(CLIENT_SRC, "R2.renderSmoke.test.tsx"), "utf8");
  const match = source.match(/const ROUTES: readonly string\[\] = \[([\s\S]*?)\];/);
  if (!match) throw new Error("ROUTES array not found in the smoke test");
  return [...match[1].matchAll(/"(\/[^"]*)"/g)].map(m => m[1]);
}

function segmentsOf(route: string): string[] {
  return route.split("/").filter(Boolean);
}

/** هل يغطي مسارُ دخانٍ نمطَ الموجّه بنيويًا؟ الأجزاء الحرفية متساوية؛
 * كل معامل (:id/:type) يقابل جزءًا غير فارغ أيًّا كان. */
function covers(smoke: string, pattern: string): boolean {
  const smokeParts = segmentsOf(smoke);
  const patternParts = segmentsOf(pattern);
  if (smokeParts.length !== patternParts.length) return false;
  return patternParts.every((part, index) =>
    part.startsWith(":") ? smokeParts[index].length > 0 : smokeParts[index] === part,
  );
}

describe("R10-B4/F-015 — smoke list covers every router pattern mechanically", () => {
  it("every router pattern is covered by at least one smoke route (structural match)", () => {
    const { patterns } = routerPatterns();
    const routes = smokeRoutes();
    expect(patterns.length).toBeGreaterThan(60);
    const uncovered = patterns.filter(pattern => !routes.some(route => covers(route, pattern)));
    expect(
      uncovered,
      `أنماط الموجّه بلا تغطية دخان: ${uncovered.join("، ")} — أضفها إلى ROUTES في R2.renderSmoke.test.tsx`,
    ).toEqual([]);
  });

  it("the catch-all is covered by a route matching no other pattern", () => {
    const { patterns, hasCatchAll } = routerPatterns();
    expect(hasCatchAll).toBe(true);
    const routes = smokeRoutes();
    const catchAllCover = routes.filter(
      route => !patterns.some(pattern => covers(route, pattern)) && route !== "/" && route !== "/setup",
    );
    expect(
      catchAllCover.length,
      "لا يوجد مسار دخان للمسار الافتراضي (catch-all) — أضف مسارًا لا يطابق أي نمط",
    ).toBeGreaterThan(0);
  });

  it("the smoke-list comment count matches the array length (no silent drift)", () => {
    const source = readFileSync(resolve(CLIENT_SRC, "R2.renderSmoke.test.tsx"), "utf8");
    const countMatch = source.match(/المسجّلة \((\d+)/);
    expect(countMatch, "التعليق يحمل عددًا — حدّثه مع القائمة").not.toBeNull();
    const routes = smokeRoutes();
    expect(Number(countMatch![1])).toBe(routes.length);
  });
});
