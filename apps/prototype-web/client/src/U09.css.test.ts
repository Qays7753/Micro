import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const css = readFileSync(fileURLToPath(new URL("./index.css", import.meta.url)), "utf8");
const primCss = readFileSync(fileURLToPath(new URL("./styles/primitives.css", import.meta.url)), "utf8");

function ruleBlock(selector: string): string {
  const start = css.indexOf(selector);
  if (start === -1) return "";
  const open = css.indexOf("{", start);
  const close = css.indexOf("}", open);
  return open === -1 || close === -1 ? "" : css.slice(open + 1, close);
}

describe("touch targets stay tappable at phone widths (U-09)", () => {
  it("period month inputs carry the standard 48px control height", () => {
    const block = ruleBlock(".micro-period-range-fields input");
    expect(block).toContain("min-height: 48px");
  });

  it("text actions carry a minimum 48px width beside their 44px height", () => {
    const block = ruleBlock(".micro-text-action");
    expect(block).toContain("min-height: 44px");
    expect(block).toContain("min-width: 48px");
  });

  it("quiet buttons meet the 44px minimum height (عقد الإغلاق العميق — MR-03)", () => {
    /* أزرار التصحيح/التراجع الهادئة تحمل مداخل مالية — لا يجوز أن تتقلص إلى
     * 32px تحت إصبع المالك. W2 (completion): العقد انتقل إلى المكوّن الأولي
     * (.micro-prim-button--quiet فوق قاعدة 48px) — الحارس يتبع العقد.
     * قيمة --vf-control-height (48px) تُحرس في اختبار طبقة الربط. */
    expect(primCss).toContain(".micro-prim-button--quiet");
    expect(primCss).toContain("min-height: var(--vf-control-height)");
  });
});
