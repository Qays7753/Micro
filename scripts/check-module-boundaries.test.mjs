/**
 * Wave 4E (RC-9): اختبارات مراقب الحدود القائم على الفَلْحة — حتمية بلا شبكة
 * ولا نوم. العينات تُبنى في مجلدات مؤقتة تحاكي بنية المستودع (src/domain +
 * مصدر النموذج) وتُمسح بعدها.
 *
 * تغطي: تصنيف الطبقات، استخراج الاستيرادات (ثابت/ديناميكي/نوعي)، القواعد
 * الست (عميق داخل المجال R1، واجهة→مجال R2، تطبيق→عرض R3، أزواج مناطق
 * المجال R4، واجهة→تخزين R5، وأساس استيراد UI→دواخل التطبيق R6) على أساس
 * مصطنع (نجاح + اصطياد كل قاعدة على حدة)، وسلوك CLI على المستودع الحي
 * (فحص دخاني). *(تصحيح مؤرخ 2026-10-07 — R1/TG-03 [R1-D2]: كان العنوان
 * يقول «القواعد الثلاث» والجسم يغطي الست؛ تصحيح تعليقي فقط بلا تغيير سلوك)*
 */
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, describe, expect, it } from "vitest";
import {
  APPLICATION_TO_PRESENTATION_VALUE_BASELINE,
  COMPONENT_TO_PAGE_BASELINE,
  DEEP_DOMAIN_IMPORT_BASELINE,
  DOMAIN_CROSS_AREA_DEEP_BASELINE,
  UI_TO_DOMAIN_VALUE_BASELINE,
  UI_TO_STORAGE_VALUE_BASELINE,
  checkModuleBoundaries,
  collectAllImports,
  layerOf,
} from "./check-module-boundaries.mjs";

const SCRIPT_PATH = fileURLToPath(import.meta.url).replace(
  /check-module-boundaries\.test\.mjs$/,
  "check-module-boundaries.mjs",
);
const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const tempDirs = [];
function makeTempDir() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "micro-boundaries-"));
  tempDirs.push(dir);
  return dir;
}
afterAll(() => {
  for (const dir of tempDirs) fs.rmSync(dir, { recursive: true, force: true });
});

function write(root, rel, content) {
  const full = path.join(root, rel);
  fs.mkdirSync(path.dirname(full), { recursive: true });
  fs.writeFileSync(full, content, "utf8");
}

const DOMAIN_BARREL = area => `export type T = { a: number };\nexport const v = 1;\n`;
const APP_SERVICE = (specifier, importLine) => `import { v } from "${specifier}";\nexport const s = v;\n`;

describe("layer classification", () => {
  it("maps paths to the registry's layer vocabulary", () => {
    expect(layerOf(REPO_ROOT, path.join(REPO_ROOT, "src/domain/asset/policies.ts"))).toBe("domain");
    expect(layerOf(REPO_ROOT, path.join(REPO_ROOT, "src/domain/asset/index.ts"))).toBe("domain");
    expect(layerOf(REPO_ROOT, path.join(REPO_ROOT, "apps/prototype-web/client/src/application/x/s.ts"))).toBe(
      "application",
    );
    expect(layerOf(REPO_ROOT, path.join(REPO_ROOT, "apps/prototype-web/client/src/presentation/f.ts"))).toBe(
      "presentation",
    );
    expect(layerOf(REPO_ROOT, path.join(REPO_ROOT, "apps/prototype-web/client/src/pages/P.tsx"))).toBe("ui");
    expect(layerOf(REPO_ROOT, path.join(REPO_ROOT, "apps/prototype-web/client/src/components/c/C.tsx"))).toBe(
      "ui",
    );
    expect(layerOf(REPO_ROOT, path.join(REPO_ROOT, "apps/prototype-web/client/src/app/Shell.tsx"))).toBe(
      "app-shell",
    );
    expect(layerOf(REPO_ROOT, path.join(REPO_ROOT, "apps/prototype-web/client/src/lib/u.ts"))).toBe("lib");
  });
});

describe("import extraction (AST, resolution-based)", () => {
  it("collects static value, static type, and dynamic imports with resolution", () => {
    const root = makeTempDir();
    write(root, "src/domain/widget/index.ts", DOMAIN_BARREL());
    write(root, "src/domain/widget/deep.ts", "export const d = 2;\n");
    write(root, "src/domain/shared/index.ts", DOMAIN_BARREL());
    write(
      root,
      "apps/prototype-web/client/src/application/x/service.ts",
      [
        'import { v } from "@micro-domain/widget/index.js";',
        'import type { T } from "@micro-domain/shared/index.js";',
        "export async function load() {",
        '  return import("@micro-domain/widget/deep.js");',
        "}",
        "export const t = 1;",
      ].join("\n"),
    );
    const imports = collectAllImports(root);
    const fromService = imports.filter(i => i.file.endsWith("application/x/service.ts"));
    expect(fromService.length).toBe(3);
    const valueBarrel = fromService.find(i => i.specifier.endsWith("widget/index.js"));
    expect(valueBarrel?.kind).toBe("value");
    expect(valueBarrel?.resolved).toBe("src/domain/widget/index.ts");
    const typeImport = fromService.find(i => i.specifier.endsWith("shared/index.js"));
    expect(typeImport?.kind).toBe("type");
    const dynamicDeep = fromService.find(i => i.specifier.endsWith("widget/deep.js"));
    expect(dynamicDeep?.kind).toBe("value");
    expect(dynamicDeep?.dynamic).toBe(true);
    expect(dynamicDeep?.resolved).toBe("src/domain/widget/deep.ts");
  });
});

describe("boundary rules on a synthetic tree (each rule can fail)", () => {
  it("R1: a NEW deep domain import outside the baseline is caught; the registered one passes", () => {
    const root = makeTempDir();
    write(root, "src/domain/widget/index.ts", DOMAIN_BARREL());
    write(root, "src/domain/widget/deep.ts", "export const d = 2;\n");
    write(root, "src/domain/other/index.ts", DOMAIN_BARREL());
    write(root, "src/domain/other/inner.ts", "export const o = 3;\n");
    /* المسجل: application/finance/integrityCheckService.ts -> deep */
    write(
      root,
      "apps/prototype-web/client/src/application/finance/integrityCheckService.ts",
      APP_SERVICE("@micro-domain/widget/deep.js"),
    );
    let result = checkModuleBoundaries(root);
    /* الأساس الحقيقي يسجل مسارًا آخر — نبني أساسًا مصطنعًا عبر الحقن: نعيد
     * الفحص بأساس يحوي هذا الزوج بالضبط (اختبار الدالة لا الأساس المضمّن). */
    const syntheticBaselineImports = collectAllImports(root);
    const key =
      "apps/prototype-web/client/src/application/finance/integrityCheckService.ts -> @micro-domain/widget/deep.js";
    const saved = [...DEEP_DOMAIN_IMPORT_BASELINE];
    DEEP_DOMAIN_IMPORT_BASELINE.length = 0;
    DEEP_DOMAIN_IMPORT_BASELINE.push(key);
    result = checkModuleBoundaries(root, syntheticBaselineImports);
    expect(result.violations.filter(v => v.rule === "R1-deep-domain-import")).toEqual([]);
    /* الآن خرق جديد: ملف آخر يستورد عميقًا غير مسجل. */
    write(
      root,
      "apps/prototype-web/client/src/application/x/newService.ts",
      APP_SERVICE("@micro-domain/other/inner.js"),
    );
    result = checkModuleBoundaries(root);
    const r1 = result.violations.filter(v => v.rule === "R1-deep-domain-import");
    expect(r1.length).toBe(1);
    expect(r1[0]?.key).toContain("newService.ts");
    DEEP_DOMAIN_IMPORT_BASELINE.length = 0;
    DEEP_DOMAIN_IMPORT_BASELINE.push(...saved);
  });

  it("R2: a NEW ui->domain value edge is caught; a type-only edge is not", () => {
    const root = makeTempDir();
    write(root, "src/domain/widget/index.ts", DOMAIN_BARREL());
    write(
      root,
      "apps/prototype-web/client/src/pages/NewPage.tsx",
      'import { v } from "@micro-domain/widget/index.js";\nexport const p = v;\n',
    );
    const result = checkModuleBoundaries(root);
    const r2 = result.violations.filter(v => v.rule === "R2-ui-to-domain-value");
    expect(r2.length).toBe(1);
    expect(r2[0]?.key).toContain("NewPage.tsx");
    /* نوع فقط: مسموح (سياسة STR-106 تقيد حواف القيمة). */
    const root2 = makeTempDir();
    write(root2, "src/domain/widget/index.ts", DOMAIN_BARREL());
    write(
      root2,
      "apps/prototype-web/client/src/pages/TypeOnly.tsx",
      'import type { T } from "@micro-domain/widget/index.js";\nexport const p = 1;\n',
    );
    const result2 = checkModuleBoundaries(root2);
    expect(result2.violations.filter(v => v.rule === "R2-ui-to-domain-value")).toEqual([]);
  });

  it("R3: a NEW application->presentation value edge is caught", () => {
    const root = makeTempDir();
    write(root, "apps/prototype-web/client/src/presentation/formatters.ts", "export const f = 1;\n");
    write(
      root,
      "apps/prototype-web/client/src/application/x/service.ts",
      'import { f } from "@/presentation/formatters";\nexport const s = f;\n',
    );
    const result = checkModuleBoundaries(root);
    const r3 = result.violations.filter(v => v.rule === "R3-application-to-presentation-value");
    expect(r3.length).toBe(1);
    expect(r3[0]?.key).toContain("application/x/service.ts");
  });

  it("R4 (Wave H): a NEW domain cross-area deep edge is caught; barrel and same-area edges are not", () => {
    const root = makeTempDir();
    write(root, "src/domain/widget/index.ts", DOMAIN_BARREL());
    write(root, "src/domain/widget/deep.ts", "export const d = 2;\n");
    write(root, "src/domain/other/index.ts", DOMAIN_BARREL());
    /* برميل منطقة أخرى: مسموح (البرميل هو السطح العام). */
    write(root, "src/domain/widget/consumer.ts", APP_SERVICE("@micro-domain/other/index.js"));
    let result = checkModuleBoundaries(root);
    expect(result.violations.filter(v => v.rule === "R4-domain-cross-area-deep")).toEqual([]);
    /* نسبي عميق عابر للمناطق: يُصطاد. */
    write(
      root,
      "src/domain/other/consumer.ts",
      'import { d } from "../widget/deep.js";\nexport const o = d;\n',
    );
    result = checkModuleBoundaries(root);
    const r4 = result.violations.filter(v => v.rule === "R4-domain-cross-area-deep");
    expect(r4.length).toBe(1);
    expect(r4[0]?.key).toContain("other/consumer.ts");
  });

  it("R5 (Wave H): a NEW ui->storage VALUE edge is caught even via a relative path; the two registered waivers pass", () => {
    const root = makeTempDir();
    write(root, "apps/prototype-web/client/src/storage/local/store.ts", "export const s = 1;\n");
    /* إفلات نسبي (الفتحة التي أغلقتها R5 resolution-based): مسار نسبي لا specifier. */
    write(
      root,
      "apps/prototype-web/client/src/pages/EscapePage.tsx",
      'import { s } from "../storage/local/store.js";\nexport const p = s;\n',
    );
    const result = checkModuleBoundaries(root);
    const r5 = result.violations.filter(v => v.rule === "R5-ui-to-storage-value");
    expect(r5.length).toBe(1);
    expect(r5[0]?.key).toContain("EscapePage.tsx");
    /* الاستثناءان المسجلان (مسارات مطلقة @/): يمران. */
    const root2 = makeTempDir();
    write(root2, "apps/prototype-web/client/src/storage/local/persistentStorage.ts", "export const p = 1;\n");
    write(
      root2,
      "apps/prototype-web/client/src/app/StartupGate.tsx",
      'import { p } from "@/storage/local/persistentStorage";\nexport const g = p;\n',
    );
    const result2 = checkModuleBoundaries(root2);
    expect(result2.violations.filter(v => v.rule === "R5-ui-to-storage-value")).toEqual([]);
    expect(result2.stats.uiToStorage).toBe(1);
  });

  it("R1 (Wave H regex fix): a digit-area deep import (g5) is now caught — was invisible with [a-z-]+", () => {
    const root = makeTempDir();
    write(root, "src/domain/g5/index.ts", DOMAIN_BARREL());
    write(root, "src/domain/g5/inner.ts", "export const g = 5;\n");
    write(
      root,
      "apps/prototype-web/client/src/application/x/service.ts",
      APP_SERVICE("@micro-domain/g5/inner.js"),
    );
    const result = checkModuleBoundaries(root);
    const r1 = result.violations.filter(v => v.rule === "R1-deep-domain-import");
    expect(r1.length).toBe(1);
    expect(r1[0]?.key).toContain("@micro-domain/g5/inner.js");
  });

  it("the embedded baselines are internally unique; R1/R2/R4/R5 non-empty, R3 may reach zero when its edges are eliminated", () => {
    /* تحديث مؤرخ 2026-10-03 (Wave B — ADR-011 §2): أساس R3 وصل إلى صفر
     * مشروعًا بعد استخراج مفردات العرض النقية إلى بيوت تطبيقية — هذا هو
     * عمل الراتشة لا إضعافه: القاعدة تبقى مفروضة على أي حافة جديدة
     * (يثبته اختبار الشجرة الاصطناعية أعلاه)، والفراغ مسموح حصرًا لأساس
     * حواف قائمة أُزيلت كلها. R1/R2 يبقيان غير فارغين حتى تغلق مساريهما. */
    for (const [name, baseline] of [
      ["deep", DEEP_DOMAIN_IMPORT_BASELINE],
      ["ui→domain", UI_TO_DOMAIN_VALUE_BASELINE],
      ["domain-cross-area", DOMAIN_CROSS_AREA_DEEP_BASELINE],
      ["ui→storage", UI_TO_STORAGE_VALUE_BASELINE],
    ]) {
      expect(baseline.length, name).toBeGreaterThan(0);
      expect(new Set(baseline).size).toBe(baseline.length);
    }
    expect(new Set(APPLICATION_TO_PRESENTATION_VALUE_BASELINE).size).toBe(
      APPLICATION_TO_PRESENTATION_VALUE_BASELINE.length,
    );
  });
});

describe("R7 component->page regression class (R8-F-019)", () => {
  const COMPONENT = "apps/prototype-web/client/src/components/finance/Section.tsx";
  const PAGE = "apps/prototype-web/client/src/pages/Finance.tsx";

  function treeWith(edgeLine) {
    const root = makeTempDir();
    write(root, "apps/prototype-web/client/src/pages/Finance.tsx", "export function Finance() { return 1; }\n");
    write(root, "apps/prototype-web/client/src/components/finance/Section.tsx", edgeLine);
    /* حواف قانونية غير ذات صلة تبقى بلا أثر. */
    write(
      root,
      "apps/prototype-web/client/src/components/presentation/DisplayValue.tsx",
      'import { MoneyValue } from "@/components/presentation/DisplayValueInner";\nexport const V = 1;\n',
    );
    write(root, "apps/prototype-web/client/src/components/presentation/DisplayValueInner.ts", "export const MoneyValue = 1;\n");
    return root;
  }

  it("a component -> page VALUE import is rejected", () => {
    const root = treeWith('import { Finance } from "@/pages/Finance";\nexport const S = Finance;\n');
    const result = checkModuleBoundaries(root);
    expect(result.ok).toBe(false);
    expect(result.violations.some(v => v.rule === "R7-component-to-page" && v.key.includes("pages/Finance.tsx"))).toBe(true);
  });

  it("a component -> page TYPE import is rejected (the exact former Finance-cycle form, STR-204c)", () => {
    const root = treeWith('import type { FinanceState } from "@/pages/Finance";\nexport type X = FinanceState;\n');
    const result = checkModuleBoundaries(root);
    expect(result.violations.some(v => v.rule === "R7-component-to-page")).toBe(true);
  });

  it("a component -> page DYNAMIC import is rejected", () => {
    const root = treeWith('export async function load() { return import("@/pages/Finance"); }\n');
    const result = checkModuleBoundaries(root);
    expect(result.violations.some(v => v.rule === "R7-component-to-page")).toBe(true);
  });

  it("a component -> page RELATIVE import is rejected after resolution", () => {
    const root = treeWith('import type { FinanceState } from "../../pages/Finance";\nexport type X = FinanceState;\n');
    const result = checkModuleBoundaries(root);
    expect(result.violations.some(v => v.rule === "R7-component-to-page" && v.key.includes("pages/Finance.tsx"))).toBe(true);
  });

  it("a component -> page import-type position and re-export forms are rejected", () => {
    const root = treeWith('export type { Something } from "@/pages/Finance";\n');
    const result = checkModuleBoundaries(root);
    expect(result.violations.some(v => v.rule === "R7-component-to-page")).toBe(true);
    const root2 = treeWith('export type P = import("@/pages/Finance").PageProps;\n');
    const result2 = checkModuleBoundaries(root2);
    expect(result2.violations.some(v => v.rule === "R7-component-to-page")).toBe(true);
  });

  it("the LEGAL page -> component direction passes, and unrelated legal UI imports are unaffected", () => {
    const root = makeTempDir();
    write(root, "apps/prototype-web/client/src/pages/Finance.tsx", 'import { Section } from "@/components/finance/Section";\nexport function Finance() { return Section; }\n');
    write(root, "apps/prototype-web/client/src/components/finance/Section.tsx", "export const Section = 1;\n");
    write(
      root,
      "apps/prototype-web/client/src/components/finance/Helper.ts",
      'import { formatMoney } from "@/presentation/formatters";\nexport const f = formatMoney;\n',
    );
    write(root, "apps/prototype-web/client/src/presentation/formatters.ts", "export const formatMoney = 1;\n");
    const result = checkModuleBoundaries(root);
    expect(result.ok).toBe(true);
    expect(result.stats.componentToPage).toBe(0);
  });

  it("the baseline is an explicit owner-reviewed list, empty at establishment", () => {
    expect(COMPONENT_TO_PAGE_BASELINE).toEqual([]);
  });

  it("the live repository has ZERO component->page violations (R7 outcome held)", () => {
    const result = checkModuleBoundaries(REPO_ROOT);
    expect(result.ok).toBe(true);
    expect(result.stats.componentToPage).toBe(0);
  });
});

describe("CLI on the live repo (smoke)", () => {
  it("exits 0 with a summary line on the live tree", () => {
    const run = spawnSync(process.execPath, [SCRIPT_PATH, REPO_ROOT], { encoding: "utf8" });
    expect(run.status).toBe(0);
    expect(run.stdout).toContain("module-boundaries: PASS");
  });
});

describe("R6 (Step 6 — STR-615 system-wide ratchet: UI -> application interiors)", () => {
  const PAGE = specifier => `import { Thing } from "${specifier}";\nexport const P = Thing;\n`;
  const SERVICE = "export class Thing {}\n";

  function writeBaseline(root, allowed) {
    write(
      root,
      "scripts/ui-application-import-baseline.json",
      JSON.stringify({ version: 1, allowed }, null, 1),
    );
  }

  it("a baseline-registered deep import passes; a NEW deep import is caught; a door import is free", () => {
    const root = makeTempDir();
    write(root, "apps/prototype-web/client/src/application/house/service.ts", SERVICE);
    write(
      root,
      "apps/prototype-web/client/src/application/house/index.ts",
      'export { Thing } from "./service.js";\n',
    );
    write(root, "apps/prototype-web/client/src/pages/A.tsx", PAGE("@/application/house/service"));
    write(root, "apps/prototype-web/client/src/pages/B.tsx", PAGE("@/application/house"));
    writeBaseline(root, [
      "apps/prototype-web/client/src/pages/A.tsx -> apps/prototype-web/client/src/application/house/service.ts",
    ]);
    let result = checkModuleBoundaries(root);
    expect(result.violations.filter(v => v.rule.startsWith("R6"))).toEqual([]);
    expect(result.stats.uiToApplicationDeep).toBe(1);

    /* استيراد عميق جديد غير مسجل — يُرفض. */
    write(root, "apps/prototype-web/client/src/pages/C.tsx", PAGE("@/application/house/service"));
    result = checkModuleBoundaries(root);
    const r6 = result.violations.filter(v => v.rule === "R6-ui-to-application-deep");
    expect(r6.length).toBe(1);
    expect(r6[0].key).toContain("pages/C.tsx");
  });

  it("a migrated site that reverts is caught (its key left the baseline)", () => {
    const root = makeTempDir();
    write(root, "apps/prototype-web/client/src/application/house/service.ts", SERVICE);
    write(root, "apps/prototype-web/client/src/pages/A.tsx", PAGE("@/application/house/service"));
    /* لا أساس: أي استيراد عميق خرق. */
    let result = checkModuleBoundaries(root);
    expect(result.violations.filter(v => v.rule === "R6-ui-to-application-deep")).toHaveLength(1);
    /* هجرة الموقع إلى الباب: يمر، لكن بلا تنظيف الأساس لا يحدث شيء هنا
     * (الأساس فارغ أصلًا) — نختبر الاتجاه المعاكس أسفل. */
    write(root, "apps/prototype-web/client/src/pages/A.tsx", PAGE("@/application/house"));
    result = checkModuleBoundaries(root);
    expect(result.violations.filter(v => v.rule.startsWith("R6"))).toEqual([]);
  });

  it("a stale baseline entry (site no longer live) fails — same-PR hygiene", () => {
    const root = makeTempDir();
    write(root, "apps/prototype-web/client/src/application/house/service.ts", SERVICE);
    /* الموقع A لا يزال عميقًا ومسجلًا (حي)؛ GONE مسجل لكن ملفه غير موجود. */
    write(root, "apps/prototype-web/client/src/pages/A.tsx", PAGE("@/application/house/service"));
    writeBaseline(root, [
      "apps/prototype-web/client/src/pages/A.tsx -> apps/prototype-web/client/src/application/house/service.ts",
      "apps/prototype-web/client/src/pages/GONE.tsx -> apps/prototype-web/client/src/application/house/service.ts",
    ]);
    const result = checkModuleBoundaries(root);
    expect(result.violations.filter(v => v.rule === "R6-ui-to-application-deep")).toEqual([]);
    const stale = result.violations.filter(v => v.rule === "R6-baseline-stale");
    expect(stale.length).toBe(1);
    expect(stale[0].key).toContain("pages/GONE.tsx");
  });

  it("pwa layer is covered (runtime UI-adjacent consumer), storage is not an application interior", () => {
    const root = makeTempDir();
    write(root, "apps/prototype-web/client/src/application/house/service.ts", SERVICE);
    write(root, "apps/prototype-web/client/src/pwa/register.ts", PAGE("@/application/house/service"));
    const result = checkModuleBoundaries(root);
    expect(result.stats.uiToApplicationDeep).toBe(1);
    expect(result.violations.filter(v => v.rule === "R6-ui-to-application-deep")).toHaveLength(1);
  });

  it("live repo: the R6 baseline file is unique-keyed and fully live (no stale rows)", () => {
    const raw = JSON.parse(
      fs.readFileSync(path.join(REPO_ROOT, "scripts", "ui-application-import-baseline.json"), "utf8"),
    );
    expect(raw.version).toBe(1);
    expect(new Set(raw.allowed).size).toBe(raw.allowed.length);
    /* الحالة بعد R5/S1 (2026-10-09): ٤٢ مفتاحًا محتجزًا موثقًا — ٣٦ لجذر
     * التركيب + ٦ لأسطح التوافق المجمدة (٣ شيمة g5 + ٣ واجهات عرض)؛ هاجر
     * مفتاح شيمة الميزانيات إلى باب budgets في نفس الشريحة (كان ٤٣). أي
     * نقصان لاحق = تقدم (يُثبت بتحديث هذا الدبوس في نفس الـPR)؛ أي زيادة
     * = خرق راتشة.
     * R7/R6-F17-P02 (2026-10-10): +١ مفتاح موثق — مسار المالية الكسول يستهلك
     * قراء نموذج عرض المالية من financeState.ts مباشرة (الباب يبقى أنواعًا فقط
     * كي لا تدخل قيم كومة الإقلاع)؛ المجموع ٤٣ (٣٦ + ٧).
     * R7/R7-2 (P07+P03+P01، 2026-10-10): +٣ مفاتيح موثقة — نماذج عرض المحررات
     * والطلبات المستخرجة (directSaleEditorModel/financialEventEditorModel/
     * orderDetailViewModel) تستهلكها مساراتها الكسولة باستيراد عميق مؤرخ؛
     * المجموع ٤٦ (٣٦ + ١٠).
     * R7/R7-3 (P04+P08+P09، 2026-10-10): +٣ مفاتيح موثقة — نماذج عرض
     * الموردين والمخزون المستخرجة؛ المجموع ٤٩ (٣٦ + ١٣).
     * R7/R7-4 (P05+P06+P11، 2026-10-10): +٣ مفاتيح موثقة — نموذجا عرض مال
     * المالك والجدولة والبيان المستخرجة؛ المجموع النهائي ٥٢ (٣٦ + ١٦) —
     * الطرف النهائي لموجة R7 (كل الحزم الإحدى عشرة منفذة).
     * R7/R7-5 (2026-10-10): −٤ مفاتيح — شيمات g5/recurringExpense أُزيلت بترحيل
     * كل مستهلكيها إلى المسارات الكنسية وإثبات صفر مستهلكين؛ المجموع ٤٨
     * (٣٦ + ١٣) — نقصان موثق = تقدم (بروتوكول الراتشة نفسه). ثم مفاتيح التبديل
     * الموثقة الأربعة (تعديل المراجعة 10): PSC→recurring الكنوني + ثلاثة مواقع
     * g5 النوعية → financial-analysis؛ المجموع ٥٢ (٣٦ + ١٦) — صافي التبديل صفر. */
    const contextKeys = raw.allowed.filter(k => k.includes("PrototypeServicesContext"));
    const otherKeys = raw.allowed.filter(k => !k.includes("PrototypeServicesContext"));
    expect(contextKeys.length).toBe(36);
    expect(otherKeys.length).toBe(16);
    expect(otherKeys.some(k => k.includes("finance/expenseBudgetService.ts"))).toBe(false);
    expect(otherKeys.filter(k => k.includes("g5/g5Service.ts")).length).toBe(0); /* R7/R7-5: أُزيلت الشيمة بمستهلكيها */
    expect(otherKeys.some(k => k.includes("activity/activityLabels.ts"))).toBe(true);
    expect(otherKeys.some(k => k.includes("formatting/formatters.ts"))).toBe(true);
    expect(otherKeys.some(k => k.includes("agreements/agreementPresentation.ts"))).toBe(true);
    expect(otherKeys.some(k => k.includes("pages/Finance.tsx -> "))).toBe(true);
    const live = checkModuleBoundaries(REPO_ROOT);
    expect(live.violations.filter(v => v.rule === "R6-baseline-stale")).toEqual([]);
  });

  /* ── R5/S1 (2026-10-09): المحدّد النوعي `import("…").X` وملفات `.js` ── */

  it('R5/S1: type-position import("…") into an application interior is counted and rejected when un-baselined', () => {
    const root = makeTempDir();
    write(root, "apps/prototype-web/client/src/application/house/service.ts", SERVICE);
    write(
      root,
      "apps/prototype-web/client/src/pages/P.tsx",
      `type T = import("@/application/house/service").Thing;\nexport const p: T | null = null;\n`,
    );
    const result = checkModuleBoundaries(root);
    expect(result.stats.uiToApplicationDeep).toBe(1);
    const hit = result.violations.find(v => v.rule === "R6-ui-to-application-deep");
    expect(hit?.key).toContain("application/house/service.ts");
  });

  it("R5/S1: a .js production file deep-importing an application interior is scanned and caught", () => {
    const root = makeTempDir();
    write(root, "apps/prototype-web/client/src/application/house/service.ts", SERVICE);
    write(
      root,
      "apps/prototype-web/client/src/pages/Q.js",
      `import { s } from "@/application/house/service";\nexport const q = s;\n`,
    );
    const result = checkModuleBoundaries(root);
    expect(result.stats.uiToApplicationDeep).toBe(1);
    const hit = result.violations.find(v => v.rule === "R6-ui-to-application-deep");
    expect(hit?.key).toContain("pages/Q.js");
  });
});
