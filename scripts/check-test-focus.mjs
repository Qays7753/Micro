#!/usr/bin/env node
/**
 * المجموعة ٦ (برنامج التحصين الكامل 2026): فحص `.only`/`.skip` حتمي.
 *
 * الغاية: لا يصل اختبار معطّل أو «مركّز» إلى الدمج — `it.only` يحوّل الحزمة
 * الخضراء إلى وهم، و`it.skip` يدفن انحدارًا حيًا. الفحص يعمل على مصادر
 * ملفات الاختبار نفسها (vitest) في مجلدات الاختبار الحقيقية فقط.
 *
 * النطاق: مجلدات الاختبار المعتمدة (src، tests، scripts، ومصدر النموذج
 * الأولي وتجاربه). ملفات الاختبار = الاسم يحوي `.test.` أو `.spec.`.
 * استثناء ضيق وموثق وحيد: المسار الموثق `scripts/fixtures` حصرًا — عينات
 * الفحص نفسه (ملف فيه `.only(` مقصود لتجربة الاصطياد)؛ المالك: مالك
 * المنتج؛ شرط الإزالة: يُحذف مع حذف `check-test-focus.test.mjs`. لا
 * استثناء لملفات اختبار حقيقية.
 *
 * F-05b (برنامج ما بعد المسح W1 — 2026-10-05): كان الاستثناء يشمل أي
 * مجلد اسمه `fixtures` في أي مسار — بينما رأس هذا الحارس يوثق المسار
 * `scripts/fixtures` وحده (مرآةً لتضييق F-056/REM-004 في check-secrets:
 * كانت مجلدات fixtures أخرى تُخرج من فحص الأسرار فأُنقرت للمسار الموثق
 * وحده). ضُيّق هنا بالمثل: المجلدات الأخرى المسماة fixtures تُفحص الآن
 * كأي مصدر — لا يبقى تعطيل اختبار مدفون في مسار مجهول.
 *
 * الاستخدام: node scripts/check-test-focus.mjs [repoRoot].
 * الخروج: 0 = نظيف؛ 1 = أي إصابة (الملف والسطر — النص آمن للطباعة).
 */
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

export const TEST_ROOTS = [
  "src",
  "tests",
  "scripts",
  "apps/prototype-web/client/src",
  "apps/prototype-web/scripts",
];

export const EXCLUDED_DIR_NAMES = ["node_modules", "dist", "coverage"];

/** F-05b: استثناء المسار الموثق وحده `scripts/fixtures` (نسبيًا لجذر المستودع). */
export const EXCLUDED_EXACT_DIRS = ["scripts/fixtures"];

/** F-05b: هل الدليل داخل أحد المسارات المستثناة الموثقة؟ */
export function isExcludedExactDir(repoRoot, absoluteDir) {
  const rel = path.relative(path.resolve(repoRoot), absoluteDir).split(path.sep).join("/");
  return EXCLUDED_EXACT_DIRS.some(dir => rel === dir || rel.startsWith(`${dir}/`));
}

/** F-057 (W4-P1 — REM-004): نمط التركيز/التعطيل يشمل أسماء vitest كاملة —
 * .only/.skip/.skipIf/.runIf/.fixme/.todo — إغفال الأسماء الشرطية كان ثغرة
 * حراسة كامنة (لا استخدام حاليًا، والنمط يسدّها قبل أول استخدام). */
export const FOCUS_REGEX = /\.(only|skip|skipIf|runIf|fixme|todo)\s*\(/;

/** هل اسم الملف اسم اختبار (اصطلاح vitest في هذا المستودع)؟ */
export function isTestFileName(fileName) {
  const base = path.basename(fileName);
  return base.includes(".test.") || base.includes(".spec.");
}

/** حصر ملفات الاختبار تحت الجذور المعتمدة — حتمي بترتيب ثابت. */
export function listTestFiles(repoRoot = ROOT, testRoots = TEST_ROOTS) {
  const files = [];
  for (const testRoot of testRoots) {
    const absolute = path.join(path.resolve(repoRoot), testRoot);
    if (!fs.existsSync(absolute)) continue;
    const stack = [absolute];
    while (stack.length > 0) {
      const dir = stack.pop();
      let entries;
      try {
        entries = fs.readdirSync(dir, { withFileTypes: true });
      } catch {
        continue;
      }
      entries.sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
      for (const entry of entries) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          if (EXCLUDED_DIR_NAMES.includes(entry.name)) continue;
          if (isExcludedExactDir(repoRoot, full)) continue;
          stack.push(full);
          continue;
        }
        if (entry.isFile() && isTestFileName(entry.name)) files.push(full);
      }
    }
  }
  files.sort();
  return files;
}

/** فحص ملف واحد — يعيد الأسطر المطابقة (السطر والنص الفرعي القصير آمنان). */
export function scanTestFile(filePath) {
  const content = fs.readFileSync(filePath, "utf8");
  const hits = [];
  const lines = content.split("\n");
  for (let index = 0; index < lines.length; index += 1) {
    const match = FOCUS_REGEX.exec(lines[index]);
    if (match === null) continue;
    hits.push({ line: index + 1, method: match[1] });
  }
  return hits;
}

/** فحص كل ملفات الاختبار — يعيد الإصابات كمسارات نسبية من جذر المستودع. */
export function scanTestTree(repoRoot = ROOT) {
  const findings = [];
  for (const file of listTestFiles(repoRoot)) {
    for (const { line, method } of scanTestFile(file)) {
      findings.push({ file: path.relative(path.resolve(repoRoot), file), line, method });
    }
  }
  return findings;
}

function main() {
  const repoRoot = process.argv[2] ?? ROOT;
  if (process.argv.length > 3) {
    process.stderr.write("check-test-focus: USAGE — node scripts/check-test-focus.mjs [repoRoot]\n");
    return 1;
  }
  if (!fs.existsSync(repoRoot)) {
    process.stderr.write(`check-test-focus: ROOT_MISSING — ${repoRoot}\n`);
    return 1;
  }
  const testFiles = listTestFiles(repoRoot);
  const findings = scanTestTree(repoRoot);
  if (findings.length > 0) {
    process.stderr.write(
      `check-test-focus: FAIL FOCUS_FOUND — ${findings.length} occurrence(s) of .only/.skip — (file:method:line)\n` +
        findings.map(f => `  ${f.file} : .${f.method}( : line ${f.line}`).join("\n") +
        "\n",
    );
    return 1;
  }
  process.stdout.write(
    `check-test-focus: PASS — ${testFiles.length} test files, 0 .only/.skip occurrences\n`,
  );
  return 0;
}

const invokedDirectly =
  process.argv[1] !== undefined && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (invokedDirectly) {
  process.exit(main());
}
