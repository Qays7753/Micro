#!/usr/bin/env node
/**
 * R10-B5/NF-020 جزء 2 (2026-10-13): حارس تغطية التدقيق النوعي لملفات
 * الاختبار — يمنع عودة استثناء ملفات الاختبار من tsconfig (الفجوة التي
 * تركت 226 ملف اختبار بلا تدقيق نوعي حتى R10-B5).
 *
 * ما يثبته:
 *  - كل ملف test/spec تحت client/src (ts وtsx) داخل برنامج tsconfig التطبيق
 *    فعليًا (قائمة برنامج حية من tsc نفسه — لا مطابقة أنماط تقريبية)؛
 *  - لا يحوي exclude أي نمط يطابق ملفات الاختبار (النمط المتقاعد نفسه
 *    أو أي صيغة له) — فشل صادق مبكر برسالة واضحة.
 *
 * ما لا يثبته: جودة الأنواع نفسها (ملك tsc وحده عبر prototype:check).
 *
 * الاستخدام: node scripts/check-test-typecheck-coverage.mjs [appRoot].
 * الخروج: 0 = التغطية كاملة؛ 1 = ملف اختبار خارج التدقيق أو نمط استثناء
 * عائد أو فشل tsc نفسه (فشل مغلق).
 */
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

export const APP_ROOT = path.resolve(
  process.argv[2] ?? path.join(path.dirname(fileURLToPath(import.meta.url)), ".."),
);
export const TSCONFIG_PATH = path.join(APP_ROOT, "tsconfig.json");
export const TEST_FILE_PATTERN = /\.(test|spec)\.[cm]?[jt]sx?$/;

/** ملفات الاختبار الحية تحت client/src (الشجرة المتتبعة أو نظام الملفات). */
export function listTestFiles(appRoot = APP_ROOT) {
  const clientSrc = path.join(appRoot, "client", "src");
  const found = [];
  const walk = dir => {
    for (const name of fs.readdirSync(dir).sort()) {
      if (name === "node_modules") continue;
      const full = path.join(dir, name);
      const st = fs.statSync(full);
      if (st.isDirectory()) walk(full);
      else if (TEST_FILE_PATTERN.test(name)) found.push(path.resolve(full));
    }
  };
  walk(clientSrc);
  return found;
}

/** تحميل tsconfig مع تجريد التعليقات (JSONC). */
export function loadTsconfig(configPath = TSCONFIG_PATH) {
  const raw = fs.readFileSync(configPath, "utf8");
  const stripped = raw.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|\s)\/\/[^\n]*/g, "$1");
  return JSON.parse(stripped);
}

/** هل يطابق نمط الاستثناء ملفات الاختبار؟ (أنماط tsconfig المعروفة فقط —
 * نمط basename أو نمط امتداد شامل يطابق بأي عمق: نفس دلالات tsconfig). */
export function excludePatternMatchesTests(pattern) {
  const norm = pattern.replace(/\\/g, "/");
  if (norm.includes("node_modules") || norm.includes("build") || norm.includes("dist")) {
    if (!TEST_FILE_PATTERN.test(norm)) return false;
  }
  const tail = norm.split("/").pop() ?? norm;
  return TEST_FILE_PATTERN.test(tail);
}

/** قائمة برنامج tsc الحية (بلا تدقيق كامل — listFilesOnly). */
export function tscProgramFiles(appRoot = APP_ROOT) {
  const tscBin = path.join(appRoot, "node_modules", "typescript", "bin", "tsc");
  const out = execFileSync(process.execPath, [tscBin, "--noEmit", "--listFilesOnly", "-p", TSCONFIG_PATH], {
    cwd: appRoot,
    encoding: "utf8",
    maxBuffer: 64 * 1024 * 1024,
  });
  return out
    .split("\n")
    .map(l => l.trim())
    .filter(l => l.length > 0)
    .map(l => path.resolve(l));
}

export function checkCoverage(appRoot = APP_ROOT, options = {}) {
  const testFiles = listTestFiles(appRoot);
  if (testFiles.length === 0) {
    return { ok: false, reason: "NO_TEST_FILES", detail: "no test files found under client/src" };
  }
  const config = loadTsconfig(path.join(appRoot, "tsconfig.json"));
  const offending = (config.exclude ?? []).filter(excludePatternMatchesTests);
  if (offending.length > 0) {
    return {
      ok: false,
      reason: "EXCLUSION_PATTERN_RETURNED",
      detail: `exclude patterns matching test files: ${offending.join(", ")}`,
    };
  }
  const program = options.program ?? tscProgramFiles(appRoot);
  const programSet = new Set(program);
  const outside = testFiles.filter(f => !programSet.has(f));
  if (outside.length > 0) {
    return {
      ok: false,
      reason: "TEST_FILE_OUTSIDE_TYPECHECK",
      detail: `${outside.length} test file(s) not in the tsconfig program: ${outside
        .slice(0, 5)
        .map(f => path.relative(appRoot, f))
        .join(", ")}${outside.length > 5 ? " …" : ""}`,
    };
  }
  return { ok: true, testFileCount: testFiles.length };
}

function main() {
  const result = checkCoverage();
  if (result.ok) {
    console.log(
      `check-test-typecheck-coverage: PASS — ${result.testFileCount} test files inside the app typecheck program (NF-020 part 2)`,
    );
    return 0;
  }
  console.error(`check-test-typecheck-coverage: FAIL ${result.reason} — ${result.detail}`);
  return 1;
}

const invokedDirectly =
  process.argv[1] !== undefined && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (invokedDirectly) {
  process.exit(main());
}
