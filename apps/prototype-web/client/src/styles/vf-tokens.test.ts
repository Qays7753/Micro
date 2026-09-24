import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

/*
 * W1 — اختبارات طبقة الربط (Runtime Token Mapping).
 * تعقد: كل قيم المعيار موجودة حرفيًا، كل إشارة --vf-* تُحلّ،
 * :root لا يحمل هكسات خارج مجموعة Micro المحفوظة الموثّقة، والداكن
 * المحلي لم يُمَسّ من هذا الربط.
 *
 * UX-001 Phase 2 (2026-09-24): أُعيد تحديد المجموعة المعتمدة من 18 قيمة
 * دافئة إلى لوحة Bold Modular V2 الفاتحة (OD-01/OD-02/OD-03؛ مهمة المالك
 * 2026-09-24). هذا الملف هو أثر التفويض: تغيير القيمة يمر عبر تحديث هذا
 * الاختبار في نفس الـPR (CHANGE_PROTOCOL §1.4/§4). الهوية (#D97757/#C96442)
 * والداكن لم يتغيرا.
 */

const vfCss = readFileSync(fileURLToPath(new URL("./vf-tokens.css", import.meta.url)), "utf8");
const indexCss = readFileSync(fileURLToPath(new URL("../index.css", import.meta.url)), "utf8");

/** اللوحة الفاتحة المعتمدة — Bold Modular V2 (UX-001 Phase 2، 2026-09-24):
 *  الأسطح الفاتحة + الحبر الأزرق الداكن + الهوية (دون تغيير) + الفعل الصلب
 *  #A94630 + الأزواج الدلالية V2. المصدر: V2 tokens.css @ 1c990544. */
const APPROVED_18 = [
  "#F0F3F4", // canvas (V2)
  "#EDF1F2", // ground (documented blend)
  "#E4EAEC", // recessed (V2 surface-2)
  "#FFFFFF", // surface / on-action
  "#DCE3E5", // tint (V2 border value as quiet tier)
  "#CFD8DB", // soft (documented pressed step)
  "#78868D", // boundary (V2)
  "#1D2930", // ink (V2)
  "#53616A", // ink-2 (V2)
  "#5E6B74", // ink-3 (documented cool derivative)
  "#D97757", // identity clay — UNCHANGED
  "#C96442", // pressed/chosen — UNCHANGED
  "#305968", // info + focus (V2 information)
  "#16765A", // success (V2)
  "#DFF3E9", // success surface (V2)
  "#B0324F", // danger (V2)
  "#FFE7EB", // danger surface (V2)
  "#95590C", // attention (V2)
  "#FFF0D7", // attention surface (V2)
  "#FBE9E2", // brand-soft (V2)
  "#5B6770", // partial/unknown (V2)
  "#A94630", // solid action (OD-01)
  "#8F3B27", // pressed action (V2 derived)
  "#313D45", // pressed ink (documented derivative)
  "#8A959C", // disabled ink (V2; dead token value)
];

/** القيم التي احتفظ بها Micro تاريخيًا كأزواج مملوكة — أُعيد ربطها داخل
 *  الجسر بموجة V2 (2026-09-24): :root لم يعد يحمل أي هكس حرفي، والقائمة
 *  تبقى موثقة تاريخيًا (لا تزال مسموحة لو عادت مؤقتًا). */
const MICRO_KEPT = [
  "#256b4a",
  "#e4f2ea", // success pair — moved into --vf-success/-surface (V2 wave)
  "#7a5c20",
  "#f6eccf", // attention pair — moved into --vf-attention/-surface (V2 wave)
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
  const start = source.indexOf(":root.dark {");
  if (start === -1) return "";
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
  it("contains all approved V2-wave hex values verbatim in the mapping layer", () => {
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

describe("W1: overlay scrim is the V2 overlay token", () => {
  it("defines --vf-scrim as the V2 cool ink at 55%", () => {
    expect(vfCss).toContain("--vf-scrim: rgba(29, 41, 48, 0.55)");
  });

  it("the dialog overlay consumes the token — no raw scrim literal remains", () => {
    expect(indexCss).toContain("background: var(--vf-scrim)");
    expect(indexCss).not.toContain("color-mix(in srgb, #1f1e1d 45%, transparent)");
  });
});

describe("W5 (D1): permanent dark layer — single owner, no retired values", () => {
  const darkCss = readFileSync(fileURLToPath(new URL("./theme-dark.css", import.meta.url)), "utf8");
  const dark = darkBlock(darkCss);

  it("index.css no longer carries any .dark runtime block (single owner: theme-dark.css)", () => {
    expect(darkBlock(indexCss)).toBe("");
  });

  it("the dark owner uses :root.dark — specificity beats index.css :root literals", () => {
    /* عقد التتالي: :root.dark (0,2,0) يهزم :root (0,1,0) مهما كان ترتيب
     * الاستيراد — بدونه تبقى أزواج Micro الحرفية (نجاح/تحذير/ink-on-color)
     * فاتحة داخل الداكن. هذا العقد تعاقدي بعد رصده في الالتقاط الحقيقي. */
    const strippedDark = stripComments(darkCss);
    expect(strippedDark).toContain(":root.dark {");
    expect(strippedDark).not.toMatch(/^\.dark \{/m);
  });

  it("the dark layer declares color-scheme: dark and :root declares light", () => {
    expect(dark).toContain("color-scheme: dark");
    expect(rootBlock(indexCss)).toContain("color-scheme: light");
  });

  it("the dark layer rebinds the same semantic contracts — no second alias grammar", () => {
    expect(dark).toContain("--vf-canvas:");
    expect(dark).toContain("--color-bg-canvas: var(--vf-canvas)");
    expect(dark).toContain("--color-text-primary: var(--vf-ink)");
    expect(dark).toContain("--primary: var(--vf-action-create)");
    expect(dark).toContain("--ring: var(--vf-focus)");
  });

  it("identity is preserved exactly in dark: clay + pressed + their roles", () => {
    expect(dark).toContain("--vf-clay: #d97757");
    expect(dark).toContain("--vf-clay-interactive: #c96442");
    expect(dark).toContain("--vf-action-create-ink: #141413");
    expect(dark).toContain("--color-ink-on-color: #141413");
  });

  it("the retired v0 dark palette is gone from the dark layer", () => {
    const darkNoComments = stripComments(darkCss).toLowerCase();
    for (const hex of [
      "#1c1917",
      "#332d27",
      "#27231f",
      "#51473c",
      "#62564b",
      "#fff7ed",
      "#d6c9ba",
      "#d59172",
      "#8fd5d6",
      "#5ec0c1",
      "#7fc49e",
      "#e47975",
      "#e2c268",
      "#cc785c",
      "#964e33",
      "#5f3120",
      "#079fa0",
    ]) {
      expect(darkNoComments, `retired ${hex} leaked into the dark layer`).not.toContain(hex);
    }
  });

  it("every --vf-* referenced inside the dark layer resolves (chains included)", () => {
    const defined = new Set(
      [...vfCss.matchAll(/(--vf-[a-z0-9-]+)\s*:/g), ...darkCss.matchAll(/(--vf-[a-z0-9-]+)\s*:/g)].map(
        m => m[1],
      ),
    );
    const referenced = new Set([...darkCss.matchAll(/var\((--vf-[a-z0-9-]+)/g)].map(m => m[1]));
    const unresolved = [...referenced].filter(name => !defined.has(name));
    expect(unresolved, `unresolved --vf-* in dark layer: ${unresolved.join(", ")}`).toEqual([]);
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
