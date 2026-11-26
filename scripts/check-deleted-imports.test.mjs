/**
 * M1.9 (قرار المالك D-10): اختبارات حارس الاستيراد المحذوف
 * `scripts/check-deleted-imports.mjs` — حتمية بلا شبكة ولا نوم. العينات في
 * مجلدات مؤقتة تحاكي بنية المستودع (src/domain + مصدر النموذج) وتُمسح
 * بعدها، بنمط اختبارات حراس الحدود والنص الحرفي نفسه.
 *
 * يغطي: اصطياد استيراد مسار موسوم `deleted` بالمستعار وبالنسبي، اصطياد
 * استيراد داخل شجرة مجلد محذوف، عدم فرض الصفوف `planned` (المعلنة فقط)،
 * فشلًا مغلقًا عند صف بيانات معطوب (حالة غير معروفة أو أعمدة ناقصة)،
 * اصطياد «عودة المسار المحذوف» إلى الشجرة (لا يعود الكود الميت بصمت)،
 * وفحصًا دخانيًا على المستودع الحي (أخضر: صف AskDraftCard الوحيد المحذوف
 * بلا مستورد).
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, describe, expect, it } from "vitest";
import { checkDeletedImports, parseDeletionManifest } from "./check-deleted-imports.mjs";

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const tempDirs = [];
function makeTempDir() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "micro-deleted-imports-"));
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

const MANIFEST_HEADER = `# جرد الحذف — اختبار\n\n| المسار | السبب | البديل | الحالة | المرحلة |\n|---|---|---|---|---|\n`;

describe("M1.9 (D-10) — parseDeletionManifest", () => {
  it("parses planned and deleted rows and fails closed on a bad status", () => {
    const good = parseDeletionManifest(
      `${MANIFEST_HEADER}| \`src/domain/asset/\` | سبب | بديل | planned | المرحلة ٦ |\n| \`src/x/y.ts\` | سبب | بديل | deleted | المرحلة ٦ |\n`,
    );
    expect(good.errors).toEqual([]);
    expect(good.rows.map((row) => [row.path, row.status])).toEqual([
      ["src/domain/asset/", "planned"],
      ["src/x/y.ts", "deleted"],
    ]);
    const bad = parseDeletionManifest(`${MANIFEST_HEADER}| src/x/y.ts | سبب | بديل | maybe | المرحلة ٦ |\n`);
    expect(bad.errors.length).toBe(1);
    expect(bad.errors[0].rule).toBe("manifest-invalid");
    const malformed = parseDeletionManifest(`${MANIFEST_HEADER}| src/x/y.ts | سبب | deleted |\n`);
    expect(malformed.errors.length).toBe(1);
  });
});

describe("M1.9 (D-10) — checkDeletedImports", () => {
  it("fails when a production file imports a deleted path via the domain alias", () => {
    const root = makeTempDir();
    write(
      root,
      "src/domain/other/policies.ts",
      'import { x } from "@micro-domain/asset/policies.js";\nexport const y = x;\n',
    );
    write(
      root,
      "docs/manage-v2/DELETION-MANIFEST.md",
      `${MANIFEST_HEADER}| \`src/domain/asset/policies.ts\` | سبب | بديل | deleted | المرحلة ٦ |\n`,
    );
    const result = checkDeletedImports(root);
    expect(result.ok).toBe(false);
    expect(
      result.violations.some((v) => v.rule === "deleted-import" && v.key.includes("other/policies.ts") && v.key.includes("asset/policies")),
    ).toBe(true);
  });

  it("fails when a production file imports a deleted path relatively", () => {
    const root = makeTempDir();
    write(
      root,
      "src/domain/other/policies.ts",
      'import { x } from "../asset/policies.js";\nexport const y = x;\n',
    );
    write(
      root,
      "docs/manage-v2/DELETION-MANIFEST.md",
      `${MANIFEST_HEADER}| \`src/domain/asset/policies.ts\` | سبب | بديل | deleted | المرحلة ٦ |\n`,
    );
    const result = checkDeletedImports(root);
    expect(result.ok).toBe(false);
    expect(result.violations.some((v) => v.rule === "deleted-import" && v.key.includes("asset/policies"))).toBe(true);
  });

  it("fails when a production file imports anything inside a deleted directory", () => {
    const root = makeTempDir();
    write(
      root,
      "src/domain/other/policies.ts",
      'import { x } from "@micro-domain/budget";\nexport const y = x;\n',
    );
    write(
      root,
      "docs/manage-v2/DELETION-MANIFEST.md",
      `${MANIFEST_HEADER}| \`src/domain/budget/\` | سبب | بديل | deleted | المرحلة ٦ |\n`,
    );
    const result = checkDeletedImports(root);
    expect(result.ok).toBe(false);
    expect(result.violations.some((v) => v.rule === "deleted-import" && v.key.includes("budget"))).toBe(true);
  });

  it("does not enforce planned rows (declaration only, nothing deleted yet)", () => {
    const root = makeTempDir();
    write(
      root,
      "src/domain/other/policies.ts",
      'import { x } from "@micro-domain/asset/policies.js";\nexport const y = x;\n',
    );
    write(
      root,
      "docs/manage-v2/DELETION-MANIFEST.md",
      `${MANIFEST_HEADER}| \`src/domain/asset/policies.ts\` | سبب | بديل | planned | المرحلة ٦ |\n`,
    );
    const result = checkDeletedImports(root);
    expect(result.ok).toBe(true);
    expect(result.violations).toEqual([]);
  });

  it("fails closed when the manifest itself is malformed", () => {
    const root = makeTempDir();
    write(
      root,
      "docs/manage-v2/DELETION-MANIFEST.md",
      `${MANIFEST_HEADER}| src/x/y.ts | سبب | بديل | maybe | المرحلة ٦ |\n`,
    );
    const result = checkDeletedImports(root);
    expect(result.ok).toBe(false);
    expect(result.violations.some((v) => v.rule === "manifest-invalid")).toBe(true);
  });

  it("fails when a path marked deleted reappears on the tree (dead code returns silently)", () => {
    const root = makeTempDir();
    write(root, "src/domain/ghost/index.ts", "export const g = 1;\n");
    write(
      root,
      "docs/manage-v2/DELETION-MANIFEST.md",
      `${MANIFEST_HEADER}| \`src/domain/ghost/\` | سبب | بديل | deleted | المرحلة ٦ |\n`,
    );
    const result = checkDeletedImports(root);
    expect(result.ok).toBe(false);
    expect(result.violations.some((v) => v.rule === "deleted-path-resurrected" && v.key.includes("ghost"))).toBe(true);
  });

  it("live repo smoke: green — the only deleted row (AskDraftCard, M1.3) has no importer", () => {
    const result = checkDeletedImports(REPO_ROOT);
    expect(result.ok).toBe(true);
    expect(result.violations).toEqual([]);
    expect(result.stats.deleted).toBe(1);
    expect(result.stats.planned).toBeGreaterThan(20);
  });
});
