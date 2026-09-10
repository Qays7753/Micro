#!/usr/bin/env node
/**
 * D-034 (المجموعة ٤ — برنامج التحصين الكامل): بوابة ميزانية الحزمة الرئيسية.
 *
 * يقيس فعليًا ملف الدخول الرئيسي لناتج بناء الإنتاج ويُفشل الأمر عند تجاوز
 * السقفين المعتمدين — السقف سقفُ نموٍ لا إذنٌ برفعه، ولا توجد وسيلة لتمرير
 * حدٍّ مختلف عبر الوسائط. مصدر الحقيقة واحد: هذا السكربت.
 *
 * تحديد الحزمة الرئيسية: من بيّنة البناء (build.manifest) — المدخل الوحيد
 * isEntry بامتداد js؛ أي غموض (صفر أو أكثر من واحد) فشلٌ صادق. ثم يُطابق
 * المستند index.html على المسار نفسه (وسم script فعلي لا مجرد سلسلة) فلا
 * تُقبل مخرجات قديمة منفصمة عن بعضها.
 *
 * القياس والوحدات: البايتات الخام = طول Buffer (بايتات UTF-8 لا محارف)؛
 * gzip = zlib.gzipSync بمستوى ٩ (حتمي: الترويسة بلا وقت، وzlib مضمّن في
 * Node) — هذا هو القياس المرجعي، بينما لوحة Vite تعرض gzip بمستوى ٦
 * (أكبر قليلًا) وkB عشريًا (بايت÷١٠٠٠): «650 KB» في القرار = ٦٥٠٬٠٠٠
 * بايت عشري، لا KiB (٦٦٥٬٦٠٠). لا خرائط مصدر ولا طوابع زمنية في الناتج
 * فالقياس قابل لإعادة الإنتاج من نفس الالتزام.
 *
 * الاستخدام: node scripts/check-bundle-budget.mjs [distDir]
 * (الافتراضي: dist/public نسبة إلى جذر التطبيق — لا cwd). الخروج: ٠ نجاح،
 * ١ أي فشل (التعارض مع الحد، أو المخرجات الناقصة/الغامضة/القديمة).
 */
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import zlib from "node:zlib";
import { fileURLToPath, pathToFileURL } from "node:url";

/* السقفان المعتمدان (D-034) — بايتات صريحة، لا تُرفع ولا تُمرر عبر CLI. */
export const RAW_BYTE_LIMIT = 650_000;
export const GZIP_BYTE_LIMIT = 155_000;
export const GZIP_LEVEL = 9;

export const APP_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
export const DEFAULT_DIST_DIR = path.join(APP_ROOT, "dist", "public");

const FAILURE_MESSAGES = {
  MANIFEST_MISSING: "بيّنة البناء (dist/public/.vite/manifest.json) غير موجودة — شغّل البناء أولًا وتأكد من تفعيل build.manifest.",
  MANIFEST_INVALID_JSON: "بيّنة البناء غير قابلة للقراءة (JSON تالف) — لا قياس على ناتج مجهول.",
  ENTRY_AMBIGUOUS: "لم يُحدَّد مدخل js وحيد في البيّنة — الرفض الصادق أفضل من تخمين.",
  ENTRY_FILE_MISSING: "ملف المدخل المذكور في البيّنة غير موجود في المخرجات.",
  ENTRY_FILE_ESCAPE: "مسار المدخل يخرج عن مجلد المخرجات — مرفوض.",
  HTML_MISSING: "index.html غير موجود في المخرجات — لا يمكن التحقق من المدخل الحي.",
  HTML_ENTRY_MISMATCH: "index.html لا يشير إلى مدخل البيّنة — مخرجات قديمة أو منفصمة.",
  RAW_OVER: "الحزمة الرئيسية تجاوزت سقف البايتات الخام (D-034).",
  GZIP_OVER: "الحزمة الرئيسية تجاوزت سقف gzip (D-034).",
  USAGE: "وسائط غير مقبولة — الاستخدام: node scripts/check-bundle-budget.mjs [distDir] (لا يمكن تمرير حدود مختلفة).",
};

function fail(code) {
  return { ok: false, code, message: FAILURE_MESSAGES[code] };
}

/** اختيار مدخل js الوحيد من بيّنة البناء (isEntry === true وامتداد js). */
export function selectEntry(manifest) {
  if (manifest === null || typeof manifest !== "object") return fail("MANIFEST_INVALID_JSON");
  const entries = Object.values(manifest).filter(
    entry =>
      entry !== null &&
      typeof entry === "object" &&
      entry.isEntry === true &&
      typeof entry.file === "string",
  );
  const jsEntries = entries.filter(entry => entry.file.endsWith(".js"));
  if (jsEntries.length !== 1) return fail("ENTRY_AMBIGUOUS");
  return { file: jsEntries[0].file };
}

/** استخراج مسارات وسوم script (لا روابط modulepreload) من index.html. */
export function htmlScriptSources(html) {
  const sources = [];
  const pattern = /<script\b[^>]*\bsrc=["']([^"']+)["'][^>]*>/g;
  let match = pattern.exec(html);
  while (match !== null) {
    sources.push(match[1]);
    match = pattern.exec(html);
  }
  return sources;
}

/** القياس المرجعي: بايتات خام من طول Buffer وgzip بمستوى ٩ حتميًا. */
export function measureBundle(buffer) {
  return { rawBytes: buffer.length, gzipBytes: zlib.gzipSync(buffer, { level: GZIP_LEVEL }).length };
}

export function checkBundleBudget(distDir) {
  const resolvedDist = path.resolve(distDir);
  const manifestPath = path.join(resolvedDist, ".vite", "manifest.json");
  if (!fs.existsSync(manifestPath)) return fail("MANIFEST_MISSING");
  let manifest;
  try {
    manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
  } catch {
    return fail("MANIFEST_INVALID_JSON");
  }
  const entry = selectEntry(manifest);
  if (!entry.file) return entry;
  const entryPath = path.resolve(resolvedDist, entry.file);
  if (!entryPath.startsWith(resolvedDist + path.sep)) return fail("ENTRY_FILE_ESCAPE");
  if (!fs.existsSync(entryPath)) return fail("ENTRY_FILE_MISSING");
  const htmlPath = path.join(resolvedDist, "index.html");
  if (!fs.existsSync(htmlPath)) return fail("HTML_MISSING");
  const html = fs.readFileSync(htmlPath, "utf8");
  const posixFile = entry.file.split(path.sep).join("/");
  const referenced = htmlScriptSources(html).some(
    src => src === `/${posixFile}` || src === posixFile || src.endsWith(`/${posixFile}`),
  );
  if (!referenced) return fail("HTML_ENTRY_MISMATCH");
  const buffer = fs.readFileSync(entryPath);
  const { rawBytes, gzipBytes } = measureBundle(buffer);
  if (rawBytes > RAW_BYTE_LIMIT) return fail("RAW_OVER");
  if (gzipBytes > GZIP_BYTE_LIMIT) return fail("GZIP_OVER");
  return { ok: true, entry: posixFile, rawBytes, gzipBytes };
}

function report(result, distDir) {
  const prefix = "bundle-budget:";
  if (result.ok) {
    console.log(`${prefix} dist=${distDir}`);
    console.log(`${prefix} entry=${result.entry}`);
    console.log(
      `${prefix} raw=${result.rawBytes} bytes (limit ${RAW_BYTE_LIMIT} decimal bytes — D-034 "650 KB")`,
    );
    console.log(
      `${prefix} gzip=${result.gzipBytes} bytes (zlib level ${GZIP_LEVEL}, limit ${GZIP_BYTE_LIMIT} — Vite console shows level 6)`,
    );
    console.log(`${prefix} node=${process.version} zlib=${process.versions.zlib ?? "unknown"}`);
    console.log(`${prefix} PASS`);
    return;
  }
  console.error(`${prefix} FAIL reason=${result.code}`);
  console.error(`${prefix} ${result.message}`);
  if (result.code === "RAW_OVER" || result.code === "GZIP_OVER") {
    console.error(`${prefix} السقف سقف نمو لا إذن برفعه — راجع المرجع ٢٢ ثم قرار المالك.`);
  }
}

function main(argv) {
  if (argv.length > 1 || argv.some(arg => arg.startsWith("--") || arg.startsWith("-"))) {
    report(fail("USAGE"), DEFAULT_DIST_DIR);
    return 1;
  }
  const distDir = argv.length === 1 ? path.resolve(argv[0]) : DEFAULT_DIST_DIR;
  const result = checkBundleBudget(distDir);
  report(result, distDir);
  return result.ok ? 0 : 1;
}

const invokedDirectly =
  process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href;
if (invokedDirectly) {
  process.exitCode = main(process.argv.slice(2));
}
