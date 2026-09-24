import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

/*
 * UX-001 V2 — WS-183 حارس تكيف السطح (2026-09-24).
 * ---------------------------------------------------------------------------
 * اختبارات مستوى النص لقواعد موجة «التكيف الفعلي للمكونات والشاشات» فوق
 * أساسات WS-182 المدموجة:
 * ١) حدود عناصر النماذج = boundary البنيوي (مواصفة V2 للحقول) في نظامي
 *    الحقول (صفحة + primitives) — لا الفاصل الزخرفي.
 * ٢) هالة تركيز الحقل = سطح المعلومات المعتمد #DFEDF1 من V2.
 * ٣) .micro-field-hint و.micro-list/.micro-list-item لهما قواعد أساس (كانا
 *    مستهلكَين بلا تعريف).
 * ٤) زر الأيقونة لم يعد مُجمَّعًا مع زر الحذف (خلل تعاقب كان يعيد تلوين كل
 *    أزرار الأيقونات كرقائق accent-soft).
 * ٥) الفئات الميتة المزالة (جرد صفر مستهلكين 2026-09-24) لا تعود كقواعد.
 * ٦) ارتفاع الترويسة من التوكن لا من قيمة حرفية.
 * ٧) توكن سطح المعلومات موجود في الجسر الفاتح مع إعادة ربط حفظ في الداكن.
 */

const indexCss = readFileSync("client/src/index.css", "utf8");
const tokensCss = readFileSync("client/src/styles/vf-tokens.css", "utf8");
const darkCss = readFileSync("client/src/styles/theme-dark.css", "utf8");
const primitivesCss = readFileSync("client/src/styles/primitives.css", "utf8");

function ruleOf(css: string, selector: string): string {
  return (
    css.match(new RegExp(`${selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*\\{[^}]*\\}`))?.[0] ?? ""
  );
}

describe("WS-183 V2 surface adaptation: field control grammar", () => {
  it("page-level .micro-field inputs use the structural boundary token (V2 field spec)", () => {
    const inputs = ruleOf(indexCss, ".micro-field input,\n.micro-field textarea,\n.micro-field select");
    expect(inputs).toContain("border: 1px solid var(--vf-border-interactive)");
    expect(inputs).not.toContain("var(--color-border)");
  });

  it("primitive .micro-prim-field controls use the same boundary token (one field grammar)", () => {
    const inputs = ruleOf(
      primitivesCss,
      ".micro-prim-field > input,\n.micro-prim-field > select,\n.micro-prim-field > textarea",
    );
    expect(inputs).toContain("border: 1px solid var(--vf-border-interactive)");
  });

  it("field focus halo is the approved V2 Information surface", () => {
    const focus = ruleOf(
      indexCss,
      ".micro-field input:focus,\n.micro-field textarea:focus,\n.micro-field select:focus",
    );
    expect(focus).toContain("border-color: var(--vf-focus)");
    expect(focus).toContain("box-shadow: 0 0 0 3px var(--vf-info-surface)");
  });

  it("the bridge carries --vf-info-surface with the exact V2 value and dark rebinds it", () => {
    expect(tokensCss).toContain("--vf-info-surface: #dfedf1");
    /* dark keeps its current warm halo through a preservation rebind (the
       declaration is line-wrapped by prettier; assert the stable head). */
    expect(darkCss).toContain("--vf-info-surface: color-mix(");
  });

  it(".micro-field-hint is defined (was consumed with no CSS rule)", () => {
    const hint = ruleOf(indexCss, ".micro-field-hint");
    expect(hint).toContain("font-size: var(--vf-text-label-size)");
  });
});

describe("WS-183 V2 surface adaptation: unified list base (row-group pattern)", () => {
  it(".micro-list has a base grid rule and items carry internal dividers", () => {
    expect(ruleOf(indexCss, ".micro-list")).toContain("display: grid");
    expect(indexCss).toContain(".micro-list-item + .micro-list-item {");
  });

  it("compact variant stays quiet (no boxed card-in-card inside sections)", () => {
    const compact = ruleOf(indexCss, ".micro-list-compact");
    expect(compact).toContain("border-top: 1px solid var(--color-border)");
  });
});

describe("WS-183 V2 surface adaptation: icon-button cascade fix", () => {
  it(".micro-icon-button is not grouped with .micro-delete-row (accent chip leak)", () => {
    expect(indexCss).not.toMatch(/\.micro-icon-button,\s*\n?\.micro-delete-row\s*\{/);
    expect(indexCss).not.toMatch(/\.micro-icon-button svg,\s*\n?\.micro-delete-row svg\s*\{/);
  });

  it("the quiet base definition remains the single icon-button contract", () => {
    const base = ruleOf(indexCss, ".micro-icon-button");
    expect(base).toContain("background: transparent");
    expect(base).toContain("color: var(--color-text-strong)");
  });

  it("delete rows keep their own danger chip styling", () => {
    const del = ruleOf(indexCss, ".micro-delete-row");
    expect(del).toContain("color: var(--color-danger-text)");
    expect(del).toContain("background: var(--color-danger-bg)");
  });
});

describe("WS-183 V2 surface adaptation: dead-rule and literal hygiene", () => {
  const removedDead = [
    ".micro-eyebrow {",
    ".micro-priority-panel {",
    ".micro-priority-content {",
    ".micro-priority-truth {",
    ".micro-guidance-grid {",
    ".micro-review-intro {",
    ".micro-review-result {",
    ".micro-review-empty {",
    ".micro-truth-banner {",
  ];

  it.each(removedDead)("removed dead rule %s stays out of production CSS", selector => {
    expect(indexCss).not.toContain(selector);
  });

  it("header geometry resolves through the topbar token, not literals", () => {
    expect(indexCss).toContain("calc(var(--vf-topbar-height) + env(safe-area-inset-top))");
    expect(indexCss).not.toContain("calc(56px + env(safe-area-inset-top))");
  });

  it("consolidated selectors have exactly one base definition (scoped variants allowed)", () => {
    /* عدّ الأسطر التي تبدأ بالمحدد نفسه (لا المحددات السياقية الأعمق مثل
       .micro-g5-reversal-editor .micro-local-truth — تلك تباينات مقصودة). */
    const baseCount = (selector: string) =>
      indexCss.split("\n").filter(line => line.trim() === selector).length;
    for (const selector of [
      ".micro-sheet-form {",
      ".micro-section-title {",
      ".micro-finance-event-list {",
      ".micro-local-truth {",
      ".micro-setup-page {",
      ".micro-setup-heading {",
    ]) {
      expect(baseCount(selector), `${selector} should have exactly one base rule`).toBe(1);
    }
  });
});
