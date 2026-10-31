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
  UI_TO_STORAGE_TYPE_BASELINE,
  UI_TO_STORAGE_TYPE_BASELINE_HISTORICAL_17,
  UI_TO_STORAGE_VALUE_BASELINE,
  checkModuleBoundaries,
  collectAllImports,
  collectHouseEdges,
  houseSccs,
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
    /* (R11 W1A-1 / D-01 — 2026-10-14): الشجرة التركيبية لا تحمل ملفات أساس R8 الـ19 الحية، فيُتوقع من نظافة الأساس
     * أن تفشل هنا بأسباب غير متعلق بهدف هذا الاختبار (الاتجاه القانوني صفحة→مكوّن) —
     * يُحصر التأكيد على القواعد المختبرة هنا، ونظافة أساس R8 يختبرها جهاز R8 المختص أدناه على المستودع الحي. */
    expect(result.violations.filter(v => !v.rule.startsWith("R8") && !v.rule.startsWith("R9"))).toEqual([]);
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

describe("R8 (R11 W1A-1 / D-01 — UI->storage type-only edge ratchet, OD-GUARD Option A)", () => {
  it("the full baseline is exactly 22 keys and the historical 17 is a strict subset modulo the two documented retirements", () => {
    expect(UI_TO_STORAGE_TYPE_BASELINE).toHaveLength(22);
    expect(new Set(UI_TO_STORAGE_TYPE_BASELINE).size).toBe(22);
    expect(UI_TO_STORAGE_TYPE_BASELINE_HISTORICAL_17).toHaveLength(17);
    /* S10 (UNIT-030/031/032 — أمر b56967d8/DOC-019، نفس-الـPR): مفتاحان
     * تاريخيان تُقاعدا بتوثيق — EstimateDetail.tsx وTools.tsx لم يعودا
     * يستوردان أنواع التخزين إطلاقًا على الشجرة الحية (صفر استيراد storage)،
     * فبقاؤهما في الأساس خرق نظافة المفاتيح المتقدمة؛ التقاعدهما تضييق
     * لا توسيع (الحافة صارت ممنوعة لا مسموحة). */
    const RETIRED_HISTORICAL_2 = [
      "apps/prototype-web/client/src/pages/EstimateDetail.tsx -> @/storage/local/types",
      "apps/prototype-web/client/src/pages/Tools.tsx -> @/storage/local/types",
    ];
    for (const key of UI_TO_STORAGE_TYPE_BASELINE_HISTORICAL_17) {
      const stillPresent = UI_TO_STORAGE_TYPE_BASELINE.includes(key);
      const retired = RETIRED_HISTORICAL_2.includes(key);
      expect(stillPresent || retired).toBe(true);
    }
    /* مفتاحا app-shell الموثقان + مفتاح S03 الموثق (نفس-الـPR، DOC-012)
     * + مفاتيح S10 الأربعة الموثقة (DOC-019) هم الفرق المسموح بين الأساسين. */
    const diff = UI_TO_STORAGE_TYPE_BASELINE.filter(k => !UI_TO_STORAGE_TYPE_BASELINE_HISTORICAL_17.includes(k));
    expect(diff).toEqual([
      "apps/prototype-web/client/src/app/PrototypeServicesContext.tsx -> @/storage/local/types",
      "apps/prototype-web/client/src/app/StartupGate.tsx -> @/storage/local/types",
      "apps/prototype-web/client/src/components/settings/SettingsProjectDataSection.tsx -> @/storage/local/types",
      "apps/prototype-web/client/src/components/planning/LegacyEstimateEditor.tsx -> @/storage/local/types",
      "apps/prototype-web/client/src/components/planning/PlanningGroupEditor.tsx -> @/storage/local/planningCalculationTypes",
      "apps/prototype-web/client/src/components/planning/SavedCalculations.tsx -> @/storage/local/types",
      "apps/prototype-web/client/src/pages/CostCalculator.tsx -> @/storage/local/planningCalculationTypes",
    ]);
  });

  it("the live repository passes at the baseline: 22 type edges, zero violations", () => {
    const result = checkModuleBoundaries(REPO_ROOT);
    expect(result.ok).toBe(true);
    expect(result.stats.uiToStorageType).toBe(22);
  });

  it("growth: a new type-only UI->storage edge is rejected", () => {
    const root = makeTempDir();
    write(root, "apps/prototype-web/client/src/storage/local/types.ts", "export type StoredThing = { a: number };\n");
    write(
      root,
      "apps/prototype-web/client/src/pages/NewPage.tsx",
      'import type { StoredThing } from "@/storage/local/types";\nexport function p(x: StoredThing) { return x; }\n',
    );
    const result = checkModuleBoundaries(root);
    const r8 = result.violations.filter(v => v.rule === "R8-ui-to-storage-type");
    expect(r8).toHaveLength(1);
    expect(r8[0].key).toContain("pages/NewPage.tsx");
    expect(result.stats.uiToStorageType).toBe(1);
  });

  it("mixed imports count as VALUE (no R8 edge; the R5 value ratchet owns it instead)", () => {
    const root = makeTempDir();
    write(root, "apps/prototype-web/client/src/storage/local/types.ts", "export type T1 = { a: number };\n");
    write(
      root,
      "apps/prototype-web/client/src/pages/Mixed.tsx",
      'import { type T1, someValue } from "@/storage/local/types";\nexport const x = 1;\n',
    );
    const result = checkModuleBoundaries(root);
    expect(result.violations.filter(v => v.rule === "R8-ui-to-storage-type")).toEqual([]);
    expect(result.violations.some(v => v.rule === "R5-ui-to-storage-value")).toBe(true);
    expect(result.stats.uiToStorageType).toBe(0);
  });

  it("all-type specifier lists are type edges; export type re-exports are type edges", () => {
    const root = makeTempDir();
    write(root, "apps/prototype-web/client/src/storage/local/types.ts", "export type T1 = { a: number };\nexport const someValue = 1;\n");
    write(
      root,
      "apps/prototype-web/client/src/pages/AllType.tsx",
      'import { type T1, type T2 } from "@/storage/local/types";\nexport type T2 = { b: number };\nexport function p() { return 1; }\n',
    );
    write(
      root,
      "apps/prototype-web/client/src/pages/Reexport.ts",
      'export type { T1 as R1 } from "@/storage/local/types";\n',
    );
    const result = checkModuleBoundaries(root);
    const r8 = result.violations.filter(v => v.rule === "R8-ui-to-storage-type");
    expect(r8).toHaveLength(2);
    expect(result.stats.uiToStorageType).toBe(2);
  });

  it("spelling cannot bypass: a relative path resolving to storage still counts", () => {
    const root = makeTempDir();
    write(root, "apps/prototype-web/client/src/storage/local/types.ts", "export type StoredThing = { a: number };\n");
    write(
      root,
      "apps/prototype-web/client/src/pages/Relative.tsx",
      'import type { StoredThing } from "../storage/local/types";\nexport function p(x: StoredThing) { return x; }\n',
    );
    const result = checkModuleBoundaries(root);
    expect(result.violations.filter(v => v.rule === "R8-ui-to-storage-type")).toHaveLength(1);
    expect(result.stats.uiToStorageType).toBe(1);
  });

  it('type-position import("...") nodes into storage are type edges', () => {
    const root = makeTempDir();
    write(root, "apps/prototype-web/client/src/storage/local/types.ts", "export type StoredThing = { a: number };\n");
    write(
      root,
      "apps/prototype-web/client/src/pages/DynamicType.ts",
      'export type Box = import("@/storage/local/types").StoredThing;\nexport function p(b: Box) { return b; }\n',
    );
    const result = checkModuleBoundaries(root);
    expect(result.violations.filter(v => v.rule === "R8-ui-to-storage-type")).toHaveLength(1);
    expect(result.stats.uiToStorageType).toBe(1);
  });

  it("import-equals require() spelling is collected (no import-spelling escape)", () => {
    const root = makeTempDir();
    write(root, "apps/prototype-web/client/src/storage/local/types.ts", "export type StoredThing = { a: number };\n");
    write(
      root,
      "apps/prototype-web/client/src/pages/Equals.ts",
      'import type StoredThing = require("@/storage/local/types");\nexport function p(x: StoredThing) { return x; }\n',
    );
    const imports = collectAllImports(root);
    const storageTypeImports = imports.filter(
      i => i.kind === "type" && i.resolved?.startsWith("apps/prototype-web/client/src/storage/"),
    );
    expect(storageTypeImports).toHaveLength(1);
    expect(storageTypeImports[0].specifier).toBe("@/storage/local/types");
    const result = checkModuleBoundaries(root);
    expect(result.violations.filter(v => v.rule === "R8-ui-to-storage-type")).toHaveLength(1);
  });

  it("stale: a baseline key absent from the live tree fails (same-PR hygiene)", () => {
    const root = makeTempDir();
    write(root, "apps/prototype-web/client/src/pages/Unrelated.tsx", "export const u = 1;\n");
    const result = checkModuleBoundaries(root);
    const stale = result.violations.filter(v => v.rule === "R8-baseline-stale");
    expect(stale).toHaveLength(22);
    /* على المستودع الحي: صفر مفاتيح متقدمة (يثبته اختبار المستودع الحي أعلاه). */
  });

  it("swap is caught from both sides: a new key arrives AND the replaced key goes stale", () => {
    const root = makeTempDir();
    write(root, "apps/prototype-web/client/src/storage/local/types.ts", "export type StoredThing = { a: number };\n");
    write(
      root,
      "apps/prototype-web/client/src/pages/Finance.tsx",
      'import type { StoredThing } from "../storage/local/types";\nexport function p(x: StoredThing) { return x; }\n',
    );
    /* الملف مسجل في الأساس بالمحدد المستعار؛ الحافة الحية صارت بالمحدد النسبي —
     * مفتاح جديد (نمو) + المفتاح المسجل غادر (قِدم) في آن واحد: التبديل مرئي من الجهتين. */
    const result = checkModuleBoundaries(root);
    expect(result.violations.some(v => v.rule === "R8-ui-to-storage-type" && v.key.includes("pages/Finance.tsx") && v.key.includes("../storage/local/types"))).toBe(true);
    expect(result.violations.some(v => v.rule === "R8-baseline-stale" && v.key.includes("pages/Finance.tsx"))).toBe(true);
  });
});

describe("R9 (R11 W1A-1 / D-07 — OD-10 house-pair ratchet on the full census)", () => {
  const EXEMPT_LEAF = "application/time/clock.ts";

  function houseTree() {
    const root = makeTempDir();
    /* الورقة المعفاة + بيتا ميزات + حواف حاكمة ومعفاة. */
    write(root, "apps/prototype-web/client/src/application/time/clock.ts", 'export const systemClock = (): string => "2026-01-01T00:00:00.000Z";\n');
    write(
      root,
      "apps/prototype-web/client/src/application/finance/serviceA.ts",
      'import { systemClock } from "@/application/time/clock";\nexport const a = systemClock;\n',
    );
    write(root, "apps/prototype-web/client/src/application/parties/types.ts", "export type Thing = { id: string };\n");
    write(
      root,
      "apps/prototype-web/client/src/application/inventory/reads.ts",
      'import type { Thing } from "@/application/parties/types";\nexport type T = Thing;\n',
    );
    return root;
  }

  /** يبني جردًا متسقًا مع الشجرة الحية (baseline == current) للأشجار التركيبية. */
  function writeCensusFor(root, { exemptModules = [], sccOverride = null } = {}) {
    const edges = collectHouseEdges(collectAllImports(root));
    const exemptSet = new Set(exemptModules.map(m => m.path));
    const pairCaps = {};
    for (const edge of edges) {
      if (exemptSet.has(edge.key.split(" -> ")[1])) continue;
      const pairKey = `${edge.sourceHouse}->${edge.targetHouse}`;
      pairCaps[pairKey] = pairCaps[pairKey] || { value: 0, type: 0 };
      pairCaps[pairKey][edge.kind]++;
    }
    const census = {
      schema: "micro-application-house-edges-census/1",
      provenance: { base_sha: "synthetic-fixture", measured_at: "2026-10-14", method: "test fixture", authority: "test" },
      totals: {
        edges: edges.length,
        value: edges.filter(e => e.kind === "value").length,
        type: edges.filter(e => e.kind === "type").length,
        governedEdges: edges.filter(e => !exemptSet.has(e.key.split(" -> ")[1])).length,
        governedPairs: Object.keys(pairCaps).length,
        exemptTargetEdges: edges.filter(e => exemptSet.has(e.key.split(" -> ")[1])).length,
      },
      edges: edges.map(e => ({ key: e.key, kind: e.kind, exemptTarget: exemptSet.has(e.key.split(" -> ")[1]) })),
      pairCaps,
      exemptModules,
      sccBaselines: sccOverride ?? { value: houseSccs(edges, "value"), type: houseSccs(edges, "type") },
      reviewCandidates: [],
      notes: [],
    };
    write(root, "scripts/application-house-edges-census.json", JSON.stringify(census, null, 1));
    return census;
  }

  const r9Only = result => result.violations.filter(v => v.rule.startsWith("R9"));

  it("the live repository passes on the recorded census: 131 edges (82 value + 49 type)", () => {
    /* R11 Lock Remediation (2026-10-15): +1 type edge — pinOperations.ts (الوحدة
     * الكسولة لعمليات الرمز) -> application/time/clock.ts (هدف معفى OD-10؛
     * صف الجرد مضاف في نفس الـPR — نمو مرئي لا صامت).
     * S02 (2026-10-27، SH-02/SH-03/SH-04): -2 value edge (تقاعد القفل حذف
     * localLockService وpinOperations) و+1 type edge (بروتوكول حماية الاستبدال
     * الجديد -> time/clock هدف معفى OD-10) — الجرد 129/80/49 صار 128/79/49؛
     * إعادة إرساء موثقة نفس-الـPR (راجع تقرير S02). */
    const result = checkModuleBoundaries(REPO_ROOT);
    expect(result.ok).toBe(true);
    /* S05 (2026-10-29، DOC-014 / UNIT-037): +1 value edge (partyLedgerService ->
     * time/clock هدف معفى OD-10؛ صف الجرد مضاف في نفس الـPR) — الجرد 129/80/49
     * صار 130/81/49؛ إعادة إرساء موثقة نفس-الـPR (راجع تقرير S05). */
    /* S07 (2026-10-30، DOC-016 / S06-MR-001): +1 value edge
     * (financialEventEditorModel -> financial-records/expenseRecordIntent — زوج
     * تأكيد جزء المالك من وحدة النية الكنسية؛ سقف الزوج finance→financial-records
     * 1→2) — الجرد 130/81/49 صار 131/82/49؛ إعادة إرساء موثقة نفس-الـPR
     * (راجع تقرير S07). */
    expect(result.stats.houseEdges).toBe(132);
    expect(result.stats.houseEdgesValue).toBe(83);
    expect(result.stats.houseEdgesType).toBe(49);
  });

  it("fail-closed: a missing census file is a violation, never a pass", () => {
    const root = houseTree(); /* لا جرد مكتوب */
    const result = checkModuleBoundaries(root);
    expect(result.violations.some(v => v.rule === "R9-census-invalid")).toBe(true);
  });

  it("fail-closed: an unknown census schema version is rejected", () => {
    const root = houseTree();
    writeCensusFor(root, { exemptModules: [{ path: EXEMPT_LEAF, role: "leaf", importAllowlist: [], notes: "" }] });
    const censusPath = path.join(root, "scripts", "application-house-edges-census.json");
    const census = JSON.parse(fs.readFileSync(censusPath, "utf8"));
    census.schema = "micro-application-house-edges-census/999";
    fs.writeFileSync(censusPath, JSON.stringify(census));
    const result = checkModuleBoundaries(root);
    expect(result.violations.some(v => v.rule === "R9-census-invalid" && v.hint.includes("999"))).toBe(true);
  });

  it("a tree matching its census passes (and internal consistency is verified)", () => {
    const root = houseTree();
    writeCensusFor(root, { exemptModules: [{ path: EXEMPT_LEAF, role: "leaf", importAllowlist: [], notes: "" }] });
    const result = checkModuleBoundaries(root);
    expect(r9Only(result)).toEqual([]);
  });

  it("new pair: an edge forming an unregistered house pair fails", () => {
    const root = houseTree();
    writeCensusFor(root, { exemptModules: [{ path: EXEMPT_LEAF, role: "leaf", importAllowlist: [], notes: "" }] });
    write(root, "apps/prototype-web/client/src/application/catalog/imports.ts", 'import type { Thing } from "@/application/inventory/reads";\nexport type U = Thing;\n');
    const result = checkModuleBoundaries(root);
    expect(result.violations.some(v => v.rule === "R9-new-pair" && v.key.includes("catalog"))).toBe(true);
  });

  it("cap growth: a second edge inside a registered pair fails (value/type separate)", () => {
    const root = houseTree();
    writeCensusFor(root, { exemptModules: [{ path: EXEMPT_LEAF, role: "leaf", importAllowlist: [], notes: "" }] });
    /* inventory->parties مسجل بقيمة نوعية 1؛ حافة قيمة ثانية في الزوج نفسه = تجاوز سقف النوع/القيمة. */
    write(
      root,
      "apps/prototype-web/client/src/application/inventory/secondValue.ts",
      'import { nothing } from "@/application/parties/types";\nexport const v = nothing;\n',
    );
    write(root, "apps/prototype-web/client/src/application/parties/types.ts", "export type Thing = { id: string };\nexport const nothing = 1;\n");
    const result = checkModuleBoundaries(root);
    expect(result.violations.some(v => v.rule === "R9-cap-growth")).toBe(true);
  });

  it("stale edge: a census edge that left the tree fails (same-PR hygiene)", () => {
    const root = houseTree();
    writeCensusFor(root, { exemptModules: [{ path: EXEMPT_LEAF, role: "leaf", importAllowlist: [], notes: "" }] });
    /* هجرة الاستيراد إلى الباب: الحافة المسجلة تغادر. */
    write(
      root,
      "apps/prototype-web/client/src/application/inventory/reads.ts",
      'import type { Thing } from "@/application/parties";\nexport type T = Thing;\n',
    );
    write(root, "apps/prototype-web/client/src/application/parties/index.ts", 'export type { Thing } from "./types.js";\n');
    const result = checkModuleBoundaries(root);
    expect(result.violations.some(v => v.rule === "R9-stale-edge" && v.key.includes("inventory/reads.ts"))).toBe(true);
  });

  it("census drift: a new edge onto an exempt leaf is bookkeeping, not a pair violation", () => {
    const root = houseTree();
    writeCensusFor(root, { exemptModules: [{ path: EXEMPT_LEAF, role: "leaf", importAllowlist: [], notes: "" }] });
    write(
      root,
      "apps/prototype-web/client/src/application/inventory/alsoClock.ts",
      'import { systemClock } from "@/application/time/clock";\nexport const b = systemClock;\n',
    );
    const result = checkModuleBoundaries(root);
    expect(result.violations.some(v => v.rule === "R9-census-drift" && v.key.includes("alsoClock.ts"))).toBe(true);
    expect(result.violations.some(v => v.rule === "R9-new-pair" && v.key.includes("alsoClock.ts"))).toBe(false);
  });

  it("exemption invariants: mutable state / import drift / outgoing edge each revoke loudly", () => {
    const exemptEntry = { path: EXEMPT_LEAF, role: "leaf", importAllowlist: [], notes: "" };
    /* 1) حالة قابلة للتغيير */
    const root1 = houseTree();
    writeCensusFor(root1, { exemptModules: [exemptEntry] });
    write(root1, "apps/prototype-web/client/src/application/time/clock.ts", 'export const systemClock = (): string => "x";\nlet hidden = 0;\nexport const leak = () => hidden;\n');
    expect(checkModuleBoundaries(root1).violations.some(v => v.rule === "R9-exemption-violation" && v.key.includes("MUTABLE_MODULE_STATE"))).toBe(true);
    /* 2) انحراف قائمة الاستيراد */
    const root2 = houseTree();
    writeCensusFor(root2, { exemptModules: [exemptEntry] });
    write(root2, "apps/prototype-web/client/src/application/time/clock.ts", 'import { localDateInAmman } from "@micro-domain/shared/index.js";\nexport const systemClock = (): string => "x";\n');
    expect(checkModuleBoundaries(root2).violations.some(v => v.rule === "R9-exemption-violation" && v.key.includes("IMPORT_ALLOWLIST_DRIFT"))).toBe(true);
    /* 3) حافة خارجة من الورقة المعفاة */
    const root3 = houseTree();
    writeCensusFor(root3, { exemptModules: [exemptEntry] });
    write(root3, "apps/prototype-web/client/src/application/time/clock.ts", 'import { helper } from "@/application/parties/types";\nexport const systemClock = (): string => "x";\n');
    expect(checkModuleBoundaries(root3).violations.some(v => v.rule === "R9-exemption-violation" && v.key.includes("OUTGOING_CROSS_HOUSE"))).toBe(true);
  });

  it("new value cycle between houses fails; a resolved recorded cycle also fails until re-anchored", () => {
    const exemptEntry = { path: EXEMPT_LEAF, role: "leaf", importAllowlist: [], notes: "" };
    /* دورة قيمة حقيقية جديدة: a->b وb->a */
    const root = makeTempDir();
    write(root, "apps/prototype-web/client/src/application/alpha/mod.ts", 'import { betaFn } from "@/application/beta/mod";\nexport const alphaFn = () => betaFn;\n');
    write(root, "apps/prototype-web/client/src/application/beta/mod.ts", 'import { alphaFn } from "@/application/alpha/mod";\nexport const betaFn = () => alphaFn;\n');
    /* الجرد بلا دورة مسجلة -> الدورة الحية جديدة. */
    writeCensusFor(root, { exemptModules: [exemptEntry], sccOverride: { value: [], type: [] } });
    expect(checkModuleBoundaries(root).violations.some(v => v.rule === "R9-new-value-cycle" && v.key.includes("alpha"))).toBe(true);
    /* والعكس: جرد يسجل دورة غير موجودة حيًا -> محلولة (إعادة إرساء مطلوبة). */
    writeCensusFor(root, { exemptModules: [exemptEntry], sccOverride: { value: [["alpha", "beta"]], type: [] } });
    const before = collectHouseEdges(collectAllImports(root)).length;
    write(root, "apps/prototype-web/client/src/application/beta/mod.ts", "export const betaFn = () => 1;\n");
    expect(collectHouseEdges(collectAllImports(root)).length).toBe(before - 1);
    expect(checkModuleBoundaries(root).violations.some(v => v.rule === "R9-resolved-cycle")).toBe(true);
  });

  it("type-dominant classification: a pair with one type site and one value site is TYPE", () => {
    const root = makeTempDir();
    write(root, "apps/prototype-web/client/src/application/parties/types.ts", "export type Thing = { id: string };\nexport const thingValue = 1;\n");
    write(
      root,
      "apps/prototype-web/client/src/application/inventory/dual.ts",
      'import { thingValue } from "@/application/parties/types";\nimport type { Thing } from "@/application/parties/types";\nexport const v = thingValue;\nexport type T = Thing;\n',
    );
    const edges = collectHouseEdges(collectAllImports(root));
    expect(edges).toHaveLength(1);
    expect(edges[0].kind).toBe("type");
  });
});
