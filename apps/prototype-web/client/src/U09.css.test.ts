import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const css = readFileSync(fileURLToPath(new URL("./index.css", import.meta.url)), "utf8");

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
});
