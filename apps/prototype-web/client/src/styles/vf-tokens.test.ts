import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

/*
 * W1 — اختبارات طبقة الربط (Runtime Token Mapping).
 * تعقد: كل قيم المعيار الـ18 موجودة حرفيًا، كل إشارة --vf-* تُحلّ،
 * :root لا يحمل هكسات خارج مجموعة Micro المحفوظة الموثّقة، والداكن
 * المحلي لم يُمَسّ من هذا الربط.
 */

const vfCss = readFileSync(fileURLToPath(new URL("./vf-tokens.css", import.meta.url)), "utf8");
const indexCss = readFileSync(fileURLToPath(new URL("../index.css", import.meta.url)), "utf8");

/** الـ18 قيمة معتمدة من Micro Standard v2 (design-tokens.css). */
const APPROVED_18 = [
  "#FAF9F5",
  "#F5F4ED",
  "#F0EEE6",
  "#FFFFFF",
  "#E8E6DC",
  "#D1CFC5",
  "#87867F",
  "#141413",
  "#4D4C48",
  "#6B6962",
  "#D97757",
  "#C96442",
  "#2C84DB",
  "#1490FF",
  "#629987",
  "#B53333",
  "#55524A",
  "#3D3D3A",
];

/** القيم التي يحتفظ بها Micro كأزواج مملوكة (موثقة في SOURCE_OF_TRUTH_MATRIX). */
const MICRO_KEPT = [
  "#256b4a",
  "#e4f2ea", // success pair (text-safe ink + tint) — W2+ migration
  "#7a5c20",
  "#f6eccf", // warning/knowledge pair — W5 migration
  "#3e5c76",
  "#e8eef3", // withdrawal pair — dead, W6 inventory
  "#b7b2a6", // text-tertiary — dead, W6 inventory
];

const RETIRED = [
  "#964e33",
  "#5f3120",
  "#cc785c",
  "#079fa0",
  "#057b7c",
  "#b4613f",
  "#f4e4db",
  "#e3f5f5",
  "#eae6dc",
  "#dad5c8",
  "#1f1e1d",
  "#33322e",
  "#6e6a60",
  "#b42318",
  "#fbe7e6",
];

function stripComments(css: string): string {
  return css.replace(/\/\*[\s\S]*?\*\//g, "");
}

function rootBlock(css: string): string {
  const source = stripComments(css);
  const start = source.indexOf(":root");
  const open = source.indexOf("{", start);
  let depth = 0;
  for (let i = open; i < source.length; i += 1) {
    if (source[i] === "{") depth += 1;
    else if (source[i] === "}") {
      depth -= 1;
      if (depth === 0) return source.slice(open + 1, i);
    }
  }
  return "";
}

function darkBlock(css: string): string {
  const source = stripComments(css);
  const start = source.indexOf(".dark {");
  const open = source.indexOf("{", start);
  let depth = 0;
  for (let i = open; i < source.length; i += 1) {
    if (source[i] === "{") depth += 1;
    else if (source[i] === "}") {
      depth -= 1;
      if (depth === 0) return source.slice(open + 1, i);
    }
  }
  return "";
}

describe("W1: Standard token presence (byte-for-byte)", () => {
  it("contains all 18 approved Standard hex values verbatim in the mapping layer", () => {
    // Hex casing is normalized to lowercase by the repo's prettier config
    // (format:check is a gate); hex case carries no CSS meaning. The check
    // still fails on any wrong VALUE — each approved 6-digit value must
    // appear exactly as a full token literal.
    const vfLower = vfCss.toLowerCase();
    for (const hex of APPROVED_18) {
      expect(vfLower, `missing approved value ${hex}`).toContain(`${hex.toLowerCase()};`);
    }
  });

  it("the mapping layer carries no retired v0 palette value", () => {
    for (const hex of RETIRED) {
      expect(vfCss.toLowerCase(), `retired value ${hex} leaked into vf-tokens`).not.toContain(
        hex.toLowerCase(),
      );
    }
  });

  it("the light :root re-binding introduces no hex outside the documented Micro-kept set", () => {
    const root = rootBlock(indexCss);
    const hexes = [...root.matchAll(/#[0-9a-fA-F]{3,8}\b/g)].map(m => m[0].toLowerCase());
    const allowed = new Set([
      ...APPROVED_18.map(h => h.toLowerCase()),
      ...MICRO_KEPT.map(h => h.toLowerCase()),
    ]);
    const unexpected = hexes.filter(h => !allowed.has(h));
    expect(unexpected, `unexpected hex in :root: ${unexpected.join(", ")}`).toEqual([]);
  });

  it("the light :root no longer carries retired v0 identity values", () => {
    const root = rootBlock(indexCss);
    for (const hex of ["#cc785c", "#964e33", "#079fa0", "#057b7c", "#b4613f"]) {
      expect(root, `retired ${hex} still feeds the light layer`).not.toContain(hex);
    }
  });
});

describe("W1: alias resolution (no unresolved references, no competing values)", () => {
  it("every --vf-* referenced from index.css resolves to a token defined in vf-tokens.css", () => {
    const defined = new Set([...vfCss.matchAll(/(--vf-[a-z0-9-]+)\s*:/g)].map(m => m[1]));
    const referenced = new Set([...indexCss.matchAll(/var\((--vf-[a-z0-9-]+)/g)].map(m => m[1]));
    expect(defined.size).toBeGreaterThan(40);
    const unresolved = [...referenced].filter(name => !defined.has(name));
    expect(unresolved, `unresolved --vf-* references: ${unresolved.join(", ")}`).toEqual([]);
  });

  it("every --vf-* referenced inside vf-tokens.css itself resolves (internal chains)", () => {
    const defined = new Set([...vfCss.matchAll(/(--vf-[a-z0-9-]+)\s*:/g)].map(m => m[1]));
    const referenced = new Set([...vfCss.matchAll(/var\((--vf-[a-z0-9-]+)/g)].map(m => m[1]));
    const unresolved = [...referenced].filter(name => !defined.has(name));
    expect(unresolved).toEqual([]);
  });

  it("each Micro runtime color name is declared exactly once in :root (no duplicate competing declarations)", () => {
    const root = rootBlock(indexCss);
    const names = [...root.matchAll(/(--[a-z0-9-]+)\s*:/g)].map(m => m[1]);
    const dupes = names.filter((n, i) => names.indexOf(n) !== i);
    expect(dupes, `duplicate token declarations: ${dupes.join(", ")}`).toEqual([]);
  });

  it("core shared roles bind to Standard contracts (spot-check the binding table)", () => {
    const root = rootBlock(indexCss);
    expect(root).toContain("--color-bg-canvas: var(--vf-canvas)");
    expect(root).toContain("--color-text-primary: var(--vf-ink)");
    expect(root).toContain("--color-text-secondary: var(--vf-ink-secondary)");
    expect(root).toContain("--color-brand-primary: var(--vf-clay)");
    expect(root).toContain("--color-accent-primary: var(--vf-clay-interactive)");
    expect(root).toContain("--color-accent-text: var(--vf-ink)");
    expect(root).toContain("--color-danger-text: var(--vf-error)");
    expect(root).toContain("--primary: var(--vf-action-create)");
    expect(root).toContain("--primary-foreground: var(--vf-action-create-ink)");
    expect(root).toContain("--ring: var(--vf-focus)");
  });
});

describe("W1: overlay scrim is the Standard token", () => {
  it("defines --vf-scrim as warm ink #141413 at 45%", () => {
    expect(vfCss).toContain("--vf-scrim: rgba(20, 20, 19, 0.45)");
  });

  it("the dialog overlay consumes the token — no raw scrim literal remains", () => {
    expect(indexCss).toContain("background: var(--vf-scrim)");
    expect(indexCss).not.toContain("color-mix(in srgb, #1f1e1d 45%, transparent)");
  });
});

describe("W1: dark layer remains Micro-local legacy (not re-bound by this wave)", () => {
  it("the .dark block still exists and keeps its own legacy values", () => {
    const dark = darkBlock(indexCss);
    expect(dark.length).toBeGreaterThan(200);
    expect(dark).toContain("--color-bg-canvas: #1c1917");
    expect(dark).toContain("--primary: var(--color-brand-primary)");
  });
});

describe("W1: guard integrity (U09 geometry rules still first-matchable)", () => {
  it("keeps the three U09-asserted selectors in their live homes", () => {
    expect(indexCss).toContain(".micro-period-range-fields input");
    expect(indexCss).toContain(".micro-text-action");
    /* W2 (completion): عقد الأزرار الهادئة انتقل من index.css إلى طبقة المكوّنات
     * الأولية — الحارس يتبع الموطن الجديد للعقد (MR-03/U09). */
    const primCss = readFileSync(fileURLToPath(new URL("./primitives.css", import.meta.url)), "utf8");
    expect(primCss).toContain(".micro-prim-button--quiet");
  });
});
