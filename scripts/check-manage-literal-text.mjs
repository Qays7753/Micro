#!/usr/bin/env node
/**
 * M1.8 (§10/§11 + §14.2 / قرار المالك D-7 — 2026-11-26): حارس النص
 * الحرفي لأسطح مانج.
 *
 * الغاية: «لا نص عربي حرفي على أسطح مانج الجديدة» — الكتالوج
 * (`client/src/application/manage/strings/ar.ts`، المنسوخ حرفيًا من §10/§11)
 * هو المصدر الواحد. أي حرفية نصية عربية خارج الكتالوج داخل أسطح مانج
 * تفشل الفحص فورًا — النص الجديد يدخل من الكتالوج بقرار موثَّق في نفس
 * الـPR لا بمسار صامت.
 *
 * النطاق (أسطح مانج وحدها — المسارات قد لا توجد بعد، والحارس جاهز قبلها):
 *  - `apps/prototype-web/client/src/pages/manage/**`
 *  - `apps/prototype-web/client/src/components/manage/**`
 *  - `apps/prototype-web/client/src/application/manage/**`
 * باستثناء واحد حصريًا: `client/src/application/manage/strings/ar.ts`
 * (الكتالوج نفسه). ملفات الاختبارات خارج المسح عمدًا (أدواتها معفاة —
 * عرف حراس المستودع نفسه)، والتعليقات كذلك: الحارس على **الحرفيات**
 * النصية وقيم JSX الحرفية (JsxText) — نصًّا يصل المستخدم لا نثرًا
 * توثيقيًا للمطوّر.
 *
 * الكشف: AST (typescript) — كل StringLiteral وNoSubstitutionTemplateLiteral
 * وكل قطعة نصية داخل TemplateLiteral (رأس/وسط/ذيل) وكل JsxText تحوي حرفًا
 * عربيًا واحدًا على الأقل (المدارج: U+0600–06FF و0750–077F و08A0–08FF
 * وFB50–FDFF وFE70–FEFF).
 *
 * الاستخدام: node scripts/check-manage-literal-text.mjs [repoRoot].
 * الخروج: 0 = نظيف؛ 1 = أي حرفية عربية خارج الكتالوج؛ 2 = خطأ استخدام.
 */
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import ts from "typescript";

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

/** أسطح مانج الممسوحة (قد لا توجد بعد — الاستعداد قبل ولادة الكود). */
export const MANAGE_LITERAL_SCAN_ROOTS = [
  path.join("apps", "prototype-web", "client", "src", "pages", "manage"),
  path.join("apps", "prototype-web", "client", "src", "components", "manage"),
  path.join("apps", "prototype-web", "client", "src", "application", "manage"),
];

/** الاستثناء الوحيد: الكتالوج — مصدر النص العربي الواحد (M1.8/§14.2/D-7).
 * المسار نسبي إلى `client/src` كما تُحسب مسارات الملفات الممسوحة. */
export const ARABIC_CATALOG_EXEMPTION = path.posix.join(
  "application",
  "manage",
  "strings",
  "ar.ts",
);

const TEST_PAT = /\.(test|spec|dom\.test|ui\.test|contract\.test|characterization\.test)\.[cm]?[jt]sx?$/;
const SOURCE_EXT = new Set([".ts", ".tsx"]);
const ARABIC_PATTERN = /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]/;

function listManageSurfaceFiles(repoRoot) {
  const out = [];
  for (const relativeRoot of MANAGE_LITERAL_SCAN_ROOTS) {
    const absolute = path.join(repoRoot, relativeRoot);
    if (!fs.existsSync(absolute)) continue;
    const walk = (dir) => {
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) walk(full);
        else if (SOURCE_EXT.has(path.extname(entry.name)) && !TEST_PAT.test(entry.name)) out.push(full);
      }
    };
    walk(absolute);
  }
  return out.sort();
}

/** الحرفيات النصية العربية في ملف واحد (AST — التعليقات خارج الرسم). */
export function arabicLiteralsIn(full) {
  const source = fs.readFileSync(full, "utf8");
  const sf = ts.createSourceFile(full, source, ts.ScriptTarget.Latest, true);
  const hits = [];
  const push = (text, line, kind) => {
    if (ARABIC_PATTERN.test(text)) hits.push({ text: text.trim(), line, kind });
  };
  const visit = (node) => {
    if (ts.isStringLiteral(node)) push(node.text, sf.getLineAndCharacterOfPosition(node.getStart()).line + 1, "string-literal");
    if (ts.isNoSubstitutionTemplateLiteral(node))
      push(node.text, sf.getLineAndCharacterOfPosition(node.getStart()).line + 1, "template-literal");
    if (ts.isTemplateHead(node) || ts.isTemplateMiddle(node) || ts.isTemplateTail(node))
      push(node.text, sf.getLineAndCharacterOfPosition(node.getStart()).line + 1, "template-piece");
    if (ts.isJsxText(node)) push(node.text, sf.getLineAndCharacterOfPosition(node.getStart()).line + 1, "jsx-text");
    node.forEachChild(visit);
  };
  visit(sf);
  return hits;
}

/** الفحص الكامل: يعيد الخروق والإحصاءات. */
export function checkManageLiteralText(repoRoot) {
  const violations = [];
  const files = listManageSurfaceFiles(repoRoot);
  const clientSrcRoot = path.join(repoRoot, "apps", "prototype-web", "client", "src");
  let arabicLiterals = 0;
  let exemptedCatalog = fs.existsSync(path.join(clientSrcRoot, ARABIC_CATALOG_EXEMPTION));
  for (const full of files) {
    const rel = path.relative(clientSrcRoot, full).split(path.sep).join("/");
    if (rel === ARABIC_CATALOG_EXEMPTION) continue;
    for (const hit of arabicLiteralsIn(full)) {
      arabicLiterals += 1;
      violations.push({
        rule: "literal-arabic-text",
        key: `${rel}:${hit.line} — «${hit.text.slice(0, 40)}» (${hit.kind})`,
        hint: "نص عربي حرفي خارج الكتالوج على سطح مانج — انقل النص إلى §10/§11 في الكتالوج (strings/ar.ts) واستعمل t(key)؛ المصدر الواحد هو الكتالوج (M1.8/§14.2/D-7)",
      });
    }
  }
  return {
    ok: violations.length === 0,
    violations,
    stats: { scannedFiles: files.length, arabicLiterals, catalogExempt: exemptedCatalog },
  };
}

function main() {
  const repoRoot = process.argv[2] ? path.resolve(process.argv[2]) : ROOT;
  if (!fs.existsSync(path.join(repoRoot, "package.json"))) {
    console.error("manage-literal-text: USAGE: node scripts/check-manage-literal-text.mjs [repoRoot]");
    process.exit(2);
  }
  const { ok, violations, stats } = checkManageLiteralText(repoRoot);
  if (!ok) {
    console.error(`manage-literal-text: FAIL — ${violations.length} حرفية عربية خارج الكتالوج على أسطح مانج:`);
    for (const v of violations) {
      console.error(`  [${v.rule}] ${v.key}`);
      console.error(`    ${v.hint}`);
    }
    process.exit(1);
  }
  console.log(
    `manage-literal-text: PASS — ${stats.scannedFiles} ملف سطح مانج مفحوصًا؛ ${stats.arabicLiterals} حرفية عربية (المسموح: الكتالوج strings/ar.ts وحده${stats.catalogExempt ? " — موجود ومستثنى" : " — غير موجود بعد (القاعدة جاهزة قبل الكود)"}؛ M1.8/§10-§11/§14.2/D-7)`,
  );
}

/* الاستدعاء المباشر (لا عند الاستيراد من الاختبارات). */
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main();
}
