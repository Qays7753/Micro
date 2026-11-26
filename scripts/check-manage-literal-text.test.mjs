/**
 * M1.8 (§10/§11 + §14.2 / قرار المالك D-7): اختبارات حارس النص الحرفي
 * لأسطح مانج `scripts/check-manage-literal-text.mjs` — حتمية بلا شبكة ولا
 * نوم. العينات تُبنى في مجلدات مؤقتة تحاكي بنية المستودع (صفحات/مكوّنات/
 * تطبيق مانج) وتُمسح بعدها، ونمط سابقة اختبارات حارس الحدود نفسه.
 *
 * يغطي: الاصطياد على نص عربي حرفي في قالب نصي وجِسِكس داخل الأسطح الثلاثة،
 * إعفاء `strings/ar.ts` وحده (الكتالوج هو المصدر)، استثناء ملفات الاختبارات
 * والتعليقات (الحارس على الحرفيات لا النثر)، حدود النطاق (ملف خارج مانج لا
 * يُفحص)، وفحص دخاني على المستودع الحي (أخضر على الشجرة الحالية).
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, describe, expect, it } from "vitest";
import { checkManageLiteralText } from "./check-manage-literal-text.mjs";

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const tempDirs = [];
function makeTempDir() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "micro-manage-literal-"));
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

describe("M1.8 (§10/§11/§14.2/D-7) — check-manage-literal-text", () => {
  it("flags an Arabic string literal inside client/src/pages/manage/**", () => {
    const root = makeTempDir();
    write(root, "apps/prototype-web/client/src/pages/manage/Now.tsx", 'export const label = "الكمية";\n');
    const result = checkManageLiteralText(root);
    expect(result.ok).toBe(false);
    expect(result.violations.some((v) => v.rule === "literal-arabic-text" && v.key.includes("pages/manage/Now.tsx"))).toBe(true);
  });

  it("flags Arabic JSX text inside client/src/components/manage/**", () => {
    const root = makeTempDir();
    write(root, "apps/prototype-web/client/src/components/manage/Card.tsx", "export const Card = () => <span>مجموع الطلبات</span>;\n");
    const result = checkManageLiteralText(root);
    expect(result.ok).toBe(false);
    expect(result.violations.some((v) => v.key.includes("components/manage/Card.tsx"))).toBe(true);
  });

  it("flags Arabic template-literal text inside client/src/application/manage/** (outside the catalog)", () => {
    const root = makeTempDir();
    write(root, "apps/prototype-web/client/src/application/manage/api/someClient.ts", "export const msg = `حدث خطأ`;\n");
    const result = checkManageLiteralText(root);
    expect(result.ok).toBe(false);
    expect(result.violations.some((v) => v.key.includes("application/manage/api/someClient.ts"))).toBe(true);
  });

  it("exempts strings/ar.ts — the catalog is the one Arabic source", () => {
    const root = makeTempDir();
    write(root, "apps/prototype-web/client/src/application/manage/strings/ar.ts", 'export const AR = { "f.quantity": "الكمية" };\n');
    const result = checkManageLiteralText(root);
    expect(result.ok).toBe(true);
    expect(result.violations).toEqual([]);
  });

  it("does not flag English developer-facing text, comments, or test files inside the roots", () => {
    const root = makeTempDir();
    write(
      root,
      "client/src/application/manage/strings/index.ts",
      "/* التعليق العربي ليس حرفية نصية */\nexport function t(key: string): string {\n  throw new Error(`Unknown Manage string key: ${key}`);\n}\n",
    );
    write(root, "apps/prototype-web/client/src/pages/manage/some.test.ts", 'const expected = "الكمية";\n');
    const result = checkManageLiteralText(root);
    expect(result.ok).toBe(true);
    expect(result.violations).toEqual([]);
  });

  it("does not scan files outside the Manage surfaces", () => {
    const root = makeTempDir();
    write(root, "apps/prototype-web/client/src/pages/OtherPage.tsx", 'export const label = "الكمية";\n');
    write(root, "apps/prototype-web/client/src/application/other/home.ts", 'export const label = "السعر";\n');
    const result = checkManageLiteralText(root);
    expect(result.ok).toBe(true);
    expect(result.violations).toEqual([]);
  });

  it("live repo smoke: green on the current tree (catalog exempt, surfaces clean)", () => {
    const result = checkManageLiteralText(REPO_ROOT);
    expect(result.ok).toBe(true);
    expect(result.violations).toEqual([]);
  });
});
