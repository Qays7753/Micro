import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

/*
 * UXR-02 (أمر UXR-W01 — F-015): حارس ملكية تعويض التمرير — القيم تعلن على
 * حاوية التمرير الفعلية (html) بلا عودة للإعلان الميت داخل .micro-main
 * (ليس حاوية تمرير)، مع تخصص قيمة الأسطح عبر data-micro-route-kind الذي
 * تزامنه القشرة (MicroAppShell.uxr02.dom.test.tsx يثبت المزامنة؛ القياس
 * الهندسي الفعلي في تقرير W01). تغيير الملكية يمر عبر تحديث هذا الاختبار
 * في نفس الـPR.
 */

const indexCss = readFileSync(fileURLToPath(new URL("../../index.css", import.meta.url)), "utf8");

/** استخراج أجسام كل قواعد CSS لمُحدِّد معيّن (قد يتكرر في الملف). */
function ruleBlocks(selector: string): string[] {
  const pattern = new RegExp(`${selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*\\{`, "g");
  const blocks: string[] = [];
  for (const match of indexCss.matchAll(pattern)) {
    const start = (match.index ?? 0) + match[0].length;
    let depth = 1;
    let end = start;
    while (end < indexCss.length && depth > 0) {
      if (indexCss[end] === "{") depth += 1;
      else if (indexCss[end] === "}") depth -= 1;
      end += 1;
    }
    blocks.push(indexCss.slice(start, Math.max(start, end - 1)));
  }
  return blocks;
}

describe("UXR-02 scroll-padding ownership (W01, F-015)", () => {
  it("declares the scroll compensation on the actual scroll container (html)", () => {
    const html = ruleBlocks("html").join("\n");
    expect(html).toContain("scroll-padding-block-end");
    expect(html).toContain("scroll-padding-block-start");
    /* قيم التعويض نفسها محفوظة (لا قيم جمالية جديدة). */
    expect(html).toContain("var(--space-6) + env(safe-area-inset-bottom)");
    expect(html).toContain("var(--vf-topbar-height) + env(safe-area-inset-top) + var(--space-2)");
  });

  it("specializes the surface end-gap for the fixed bottom bar via the shell-synced attribute", () => {
    const surface = ruleBlocks('html[data-micro-route-kind="surface"]').join("\n");
    expect(surface).toContain("scroll-padding-block-end");
    expect(surface).toContain("calc(80px + env(safe-area-inset-bottom))");
  });

  it("keeps .micro-main free of scroll-padding (the dead declaration must not return)", () => {
    const main = ruleBlocks(".micro-main").join("\n");
    expect(main).not.toContain("scroll-padding");
    const mainSurface = ruleBlocks('.micro-main[data-route-kind="surface"]').join("\n");
    expect(mainSurface).not.toContain("scroll-padding");
    /* تعويض القاع القائم للأسطح (padding) يبقى كما هو — لا إضافة فراغ أعمى. */
    expect(mainSurface).toContain("calc(116px + env(safe-area-inset-bottom))");
  });
});
