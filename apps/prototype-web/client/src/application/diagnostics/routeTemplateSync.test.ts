/**
 * W4-E (F-047 — اختبار تزامن قوالب المسارات): يشتق كل مسارات MicroRouter
 * الحية من مصدره نفسه (قراءة نصية بلا استيراد React — احترامًا لحدود
 * الطبقات: التطبيق لا يستورد الواجهة)، وللطريق الوحيد الدخول عبر السلوك
 * العام (routeTemplateFor) — لا قائمة مكررة ولا كشف داخلي.
 *
 * البرهان المطلوب: أي مسار راوتر جديد بلا قالب ينهار إلى /unknown ويفشل
 * هذا الاختبار بالاسم — لم تعد الفجوة صامتة.
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { routeTemplateFor } from "./routeTemplate";

const routerSource = readFileSync(
  fileURLToPath(new URL("../../app/MicroRouter.tsx", import.meta.url)),
  "utf8",
);

describe("ROUTE_TEMPLATES ↔ MicroRouter sync (F-047/W4-E)", () => {
  const routerPaths = [...new Set([...routerSource.matchAll(/path="([^"]+)"/g)].map(m => m[1]))].sort();

  it("derives a meaningful route set from the live router source", () => {
    expect(routerPaths.length).toBeGreaterThanOrEqual(65);
  });

  it("every router path maps to its own template — none collapses to /unknown", () => {
    /* كل معامل (:id/:type/…) يُستبدل بقيمة تمثيلية خالية ثم يُطالب القالب
     * نفسه بالعودة — المسار النوعي يجب أن يسبق أخاه البديل وإلا ابتلعه. */
    const collapsed = routerPaths.filter(path => {
      const concrete = path
        .split("/")
        .map(segment => (segment.startsWith(":") ? "sample" : segment))
        .join("/");
      return routeTemplateFor(concrete) !== path;
    });
    expect(collapsed).toEqual([]);
  });

  it("the ten formerly-collapsed routes map specifically (regression pin)", () => {
    expect(routeTemplateFor("/finance/more")).toBe("/finance/more");
    expect(routeTemplateFor("/finance/upcoming")).toBe("/finance/upcoming");
    expect(routeTemplateFor("/finance/recurring")).toBe("/finance/recurring");
    expect(routeTemplateFor("/finance/recurring/new")).toBe("/finance/recurring/new");
    expect(routeTemplateFor("/finance/recurring/sample")).toBe("/finance/recurring/:id");
    expect(routeTemplateFor("/finance/recurring/sample/edit")).toBe("/finance/recurring/:id/edit");
    expect(routeTemplateFor("/finance/new/owner_withdrawal_cash")).toBe("/finance/new/owner_withdrawal_cash");
    expect(routeTemplateFor("/loans/received/new")).toBe("/loans/received/new");
    expect(routeTemplateFor("/loans/received/sample")).toBe("/loans/received/:id");
    expect(routeTemplateFor("/market")).toBe("/market");
  });

  it("hides unknown paths and strips queries exactly as before (no behavior change)", () => {
    expect(routeTemplateFor("/not/a/known/route")).toBe("/unknown");
    expect(routeTemplateFor("/orders/sample?returnTo=/orders")).toBe("/orders/:id");
    expect(routeTemplateFor("/finance/new/owner_withdrawal_cash#secret")).toBe(
      "/finance/new/owner_withdrawal_cash",
    );
  });
});
