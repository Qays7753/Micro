/**
 * المجموعة ٨ (برنامج المعالجة الرباعية): اختبارات حارس دورات الاستيراد في
 * زمن التشغيل — حتمية بلا شبكة ولا نوم؛ العينات تُبنى في مجلدات مؤقتة
 * تحاكي تخطيط المستودع (src/ للنطاق وclient/src/ للتطبيق)، والمستودع الحي
 * نفسه فحص دخاني يثبت نظافته الحالية (صفر دورات زمن تشغيل — والمعروفة
 * الوحيدة نوعية فقط تُتجاهل عمدًا).
 *
 * تغطي: الدورة القيمية تُكتشف بمسارها الكامل؛ الدورة النوعية (import type)
 * لا تُكتشف لأنها ممحوة عند التجميع؛ الاستيراد المختلط (type + قيمة) قيمة؛
 * الاستيراد الديناميكي قيمة؛ إعادة التصدير بلا type قيمة وexport type
 * نوعية؛ حل الأسماء (@/ و@micro-domain/ والنسبي مع لاحقة .js)؛ تجاهل
 * الحزم الخارجية؛ وأكواد الخروج (0/1/2) للمستودع الحي والعينات.
 */
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import { afterAll, describe, expect, it } from "vitest";
import { ROOT, collectRuntimeEdges, findRuntimeCycles, resolveSpecifier } from "./check-runtime-cycles.mjs";

const SCRIPT_PATH = fileURLToPath(import.meta.url).replace(
  /check-runtime-cycles\.test\.mjs$/,
  "check-runtime-cycles.mjs",
);

const tempDirs = [];
function makeRepo(layout) {
  const repo = fs.mkdtempSync(path.join(os.tmpdir(), "micro-cycles-"));
  tempDirs.push(repo);
  const appSrc = path.join(repo, "apps", "prototype-web", "client", "src");
  const domainSrc = path.join(repo, "src", "domain");
  for (const [relative, content] of Object.entries(layout)) {
    const absolute = path.join(repo, relative);
    fs.mkdirSync(path.dirname(absolute), { recursive: true });
    fs.writeFileSync(absolute, content);
  }
  return { repo, appSrc, domainSrc };
}
afterAll(() => {
  for (const dir of tempDirs) fs.rmSync(dir, { recursive: true, force: true });
});

function runCli(root) {
  return spawnSync(process.execPath, [SCRIPT_PATH, root], { encoding: "utf8" });
}

describe("check-runtime-cycles — edge classification and resolution", () => {
  it("detects a two-file value-import cycle with the full path", () => {
    const { repo } = makeRepo({
      "src/domain/alpha/policies.ts":
        'import { beta } from "../beta/policies.js";\nexport const alpha = 1;\n',
      "src/domain/beta/policies.ts":
        'import { alpha } from "../alpha/policies.js";\nexport const beta = 2;\n',
    });
    const cycles = findRuntimeCycles(collectRuntimeEdges(repo));
    expect(cycles).toHaveLength(1);
    const members = cycles[0].map(file => path.relative(repo, file));
    expect(members).toContain("src/domain/alpha/policies.ts");
    expect(members).toContain("src/domain/beta/policies.ts");
    const cli = runCli(repo);
    expect(cli.status).toBe(1);
    expect(cli.stderr).toContain("1 runtime cycle");
    expect(cli.stderr).toContain("domain/alpha/policies.ts");
    expect(cli.stderr).toContain("domain/beta/policies.ts");
  });

  it("ignores a type-only cycle (erased at compile time - the repo's known port/guard cycle)", () => {
    const { repo } = makeRepo({
      "src/domain/port/types.ts":
        'import type { Commit } from "./guard.js";\nexport interface Store { commit: Commit; }\n',
      "src/domain/port/guard.ts":
        'import type { Store } from "./types.js";\nexport function validate(store: Store): void {}\n',
    });
    expect(findRuntimeCycles(collectRuntimeEdges(repo))).toEqual([]);
    expect(runCli(repo).status).toBe(0);
  });

  it("treats an all-inline-type import as erased, but a mixed type+value import as runtime", () => {
    const erased = makeRepo({
      "src/domain/port/types.ts":
        'import { type Commit } from "./guard.js";\nexport interface Store { commit: Commit; }\n',
      "src/domain/port/guard.ts":
        'import { type Store } from "./types.js";\nexport function validate(): void {}\n',
    });
    expect(findRuntimeCycles(collectRuntimeEdges(erased.repo))).toEqual([]);
    const mixed = makeRepo({
      "src/domain/port/types.ts":
        'import { type Commit, validate } from "./guard.js";\nexport interface Store { commit: Commit; }\nexport const storeMarker = 1;\n',
      "src/domain/port/guard.ts":
        'import { type Store, storeMarker } from "./types.js";\nexport function validate(): void { void storeMarker; }\n',
    });
    expect(findRuntimeCycles(collectRuntimeEdges(mixed.repo))).toHaveLength(1);
  });

  it("treats dynamic imports as runtime edges", () => {
    const { repo } = makeRepo({
      "src/domain/alpha/policies.ts":
        'export async function load() { return import("../beta/policies.js"); }\nexport const alpha = 1;\n',
      "src/domain/beta/policies.ts":
        'import { alpha } from "../alpha/policies.js";\nexport const beta = alpha;\n',
    });
    expect(findRuntimeCycles(collectRuntimeEdges(repo))).toHaveLength(1);
  });

  it("treats value re-exports as runtime edges and export type as type-only", () => {
    const valueReexport = makeRepo({
      "src/domain/alpha/index.ts": 'export { alpha } from "./policies.js";\nexport const alpha2 = 1;\n',
      "src/domain/alpha/policies.ts": 'import { alpha2 } from "./index.js";\nexport const alpha = alpha2;\n',
    });
    expect(findRuntimeCycles(collectRuntimeEdges(valueReexport.repo))).toHaveLength(1);
    const typeReexport = makeRepo({
      "src/domain/alpha/index.ts": 'export type { Alpha } from "./policies.js";\nexport const alpha2 = 1;\n',
      "src/domain/alpha/policies.ts": 'import { alpha2 } from "./index.js";\nexport type Alpha = number;\n',
    });
    expect(findRuntimeCycles(collectRuntimeEdges(typeReexport.repo))).toEqual([]);
  });

  it("resolves @/ and @micro-domain/ aliases and ignores external packages", () => {
    const fromApp = path.join(ROOT, "apps", "prototype-web", "client", "src", "app", "probe.ts");
    expect(resolveSpecifier("@/pages/Orders", fromApp, ROOT)).toBe(
      path.join(ROOT, "apps", "prototype-web", "client", "src", "pages", "Orders.tsx"),
    );
    expect(resolveSpecifier("@micro-domain/shared/index.js", fromApp, ROOT)).toBe(
      path.join(ROOT, "src", "domain", "shared", "index.ts"),
    );
    expect(resolveSpecifier("react", fromApp, ROOT)).toBeNull();
    expect(resolveSpecifier("virtual:pwa-register", fromApp, ROOT)).toBeNull();
    expect(resolveSpecifier("@radix-ui/react-tooltip", fromApp, ROOT)).toBeNull();
    const fromDomain = path.join(ROOT, "src", "domain", "shared", "numeric.ts");
    expect(resolveSpecifier("./numeric.js", fromDomain, ROOT)).toBe(
      path.join(ROOT, "src", "domain", "shared", "numeric.ts"),
    );
  });

  it("ignores test files inside the scan roots (production boundary only)", () => {
    const { repo } = makeRepo({
      "src/domain/alpha/policies.ts": "export const alpha = 1;\n",
      "src/domain/alpha/policies.test.ts":
        'import { alpha } from "./policies.js";\nimport { helper } from "./helper.js";\nexport const t = helper(alpha);\n',
      "src/domain/alpha/helper.test.ts":
        'import { t } from "./policies.test.js";\nimport { alpha } from "./policies.js";\nexport function helper(x: number) { return x; }\n',
    });
    const edges = collectRuntimeEdges(repo);
    expect([...edges.keys()].map(file => path.basename(file)).sort()).toEqual(["policies.ts"]);
  });
});

describe("check-runtime-cycles — CLI and the live repository", () => {
  it("exits 0 with a summary line on the live repo (type-only cycle ignored by design)", () => {
    const cli = runCli(ROOT);
    expect(cli.status).toBe(0);
    expect(cli.stdout).toContain("runtime-cycle-guard:");
    expect(cli.stdout).toContain("0 runtime cycles (type-only edges ignored)");
    /* المستودع الحي: الحافة النوعية الوحيدة المعروفة (types ↔ supplierScheduleCommitGuard)
     * لا تظهر كحافة زمن تشغيل في أي اتجاه. */
    const edges = collectRuntimeEdges(ROOT);
    const typesFile = path.join(
      ROOT,
      "apps",
      "prototype-web",
      "client",
      "src",
      "storage",
      "local",
      "types.ts",
    );
    const guardFile = path.join(
      ROOT,
      "apps",
      "prototype-web",
      "client",
      "src",
      "storage",
      "local",
      "supplierScheduleCommitGuard.ts",
    );
    expect(edges.get(typesFile)?.has(guardFile) ?? false).toBe(false);
    expect(edges.get(guardFile)?.has(typesFile) ?? false).toBe(false);
  });

  it("exits 2 with SCAN_EMPTY when the root has no production sources (honest failure)", () => {
    const empty = fs.mkdtempSync(path.join(os.tmpdir(), "micro-cycles-empty-"));
    tempDirs.push(empty);
    const cli = runCli(empty);
    expect(cli.status).toBe(2);
    expect(cli.stderr).toContain("SCAN_EMPTY");
  });
});
