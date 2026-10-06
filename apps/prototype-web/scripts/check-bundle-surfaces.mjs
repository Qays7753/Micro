#!/usr/bin/env node
/**
 * W8 (برنامج الإكمال ما بعد المسح — STR-608/F-11، 2026-10-05): حارس أسطح
 * الحزمة غير المقيسة سابقًا — الشظايا الكسولة (lazy) ومخزن PWA المسبق
 * (precache). حارس الميزانية القائم (check-bundle-budget.mjs) يثبت شظية
 * الدخول وحدها (D-034/ADR-017)؛ هذان السطحان كانا بلا قياس ولا حد نمو.
 *
 * ما يثبته هذا الحارس:
 *  - إجمالي بايتات الشظايا الكسولة (خام + gzip) لا يتجاوز خط الأساس المسجل؛
 *  - إجمالي بايتات مخزن PWA المسبق لا يتجاوز خط الأساس المسجل.
 *
 * ما لا يثبته (ميتاداتا PG-2 — الخطة §4.3.1):
 *  - لا يثبت عدالة توزيع الشظايا ولا أحجامًا فردية (التحليل اليدوي عند
 *    الحاجة وفق ADR-012)؛ عدد الشظايا/المداخل يُسجل ويُبلَّغ لا يُحرس
 *    (كسر شظية إلى اثنتين بلا نمو بايتات مشروع بنيويًا).
 *
 * البروتوكول (نمط الراتشة 4E/RC-9): خط الأساس يُحدَّث عمدًا في نفس PR
 * التغيير المقيس (نمو مقصود بمبرر موثق، أو تقليص يقفل مكسبه) — لا نمو
 * صامت. رفع أي سقف قائم (650,000/155,300 للدخول) يبقى قرار مالك بdiff
 * مزدوج (ADR-017) — هذا الحارس لا يمس سقوف الدخول إطلاقًا.
 *
 * الاستخدام: node scripts/check-bundle-surfaces.mjs [distRoot]
 * (يُشغَّل تلقائيًا ضمن build بعد check-bundle-budget.mjs).
 * الخروج: 0 = ضمن الأساس؛ 1 = نمو صامت أو بيئة ناقصة.
 */
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import zlib from "node:zlib";
import { fileURLToPath } from "node:url";

export const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
export const REPO_ROOT = path.resolve(SCRIPT_DIR, "../../..");
export const APP_ROOT = path.resolve(SCRIPT_DIR, "..");
export const DEFAULT_DIST = path.join(APP_ROOT, "dist", "public");
export const BASELINE_PATH = path.join(SCRIPT_DIR, "bundle-surfaces-baseline.json");

/** قراءة خط الأساس (التحديث عمدًا في نفس PR التغيير — لا هنا أبدًا). */
export function readBaseline(baselinePath = BASELINE_PATH) {
  return JSON.parse(fs.readFileSync(baselinePath, "utf8"));
}

/** حجم gzip (مستوى 9 — نفس أساس حارس الميزانية). */
export function gzipSize(buffer) {
  return zlib.gzipSync(buffer, { level: 9 }).length;
}

/**
 * قياس الأسطح الحية من مجلد البناء:
 *  - الشظايا الكسولة: ملفات assets/*.js غير الشظية الداخلية index-*.js؛
 *  - المخزن المسبق: مداخل precacheAndRoute في sw.js (ملفات فعلية موجودة).
 */
export function measureSurfaces(distRoot = DEFAULT_DIST) {
  const assetsDir = path.join(distRoot, "assets");
  if (!fs.existsSync(assetsDir)) return { error: `missing dist assets: ${assetsDir}` };
  const jsFiles = fs
    .readdirSync(assetsDir)
    .filter(name => name.endsWith(".js"))
    .sort();
  const lazyFiles = jsFiles.filter(name => !name.startsWith("index-"));
  let lazyRawTotal = 0;
  let lazyGzipTotal = 0;
  for (const name of lazyFiles) {
    const buffer = fs.readFileSync(path.join(assetsDir, name));
    lazyRawTotal += buffer.length;
    lazyGzipTotal += gzipSize(buffer);
  }
  const swPath = path.join(distRoot, "sw.js");
  if (!fs.existsSync(swPath)) return { error: `missing service worker: ${swPath}` };
  const sw = fs.readFileSync(swPath, "utf8");
  const urls = [...sw.matchAll(/\{url:"([^"]+)",revision/g)].map(match => match[1]);
  let precacheBytesTotal = 0;
  const missing = [];
  for (const url of urls) {
    const file = path.join(distRoot, url);
    if (fs.existsSync(file)) precacheBytesTotal += fs.statSync(file).size;
    else missing.push(url);
  }
  if (missing.length > 0)
    return { error: `precache references missing files: ${missing.slice(0, 3).join(", ")}` };
  return {
    lazyJsCount: lazyFiles.length,
    lazyRawTotal,
    lazyGzipTotal,
    precacheEntryCount: urls.length,
    precacheBytesTotal,
  };
}

/** المقارنة ضد الأساس: النمو فوق الأساس = فشل؛ التقليص = نجاح يقفل بتحديث الأساس نفس-الـPR. */
export function compareSurfaces(measured, baseline) {
  const failures = [];
  const reports = [];
  const checks = [
    ["lazyRawTotal", "lazy JS raw bytes"],
    ["lazyGzipTotal", "lazy JS gzip bytes"],
    ["precacheBytesTotal", "PWA precache bytes"],
  ];
  for (const [key, label] of checks) {
    const current = measured[key];
    const base = baseline[key];
    if (current > base) {
      failures.push(
        `SURFACE_GROWTH ${key}: ${current} > baseline ${base} (${label}) — update the baseline in the same PR with a documented reason or reduce the cost`,
      );
    } else if (current < base) {
      reports.push(
        `${key}: ${current} < baseline ${base} (improvement — lock it by updating the baseline in this PR)`,
      );
    }
  }
  for (const key of ["lazyJsCount", "precacheEntryCount"]) {
    reports.push(`${key}: ${measured[key]} (recorded; baseline ${baseline[key]})`);
  }
  return { failures, reports };
}

function main() {
  const distRoot = process.argv[2] ? path.resolve(process.argv[2]) : DEFAULT_DIST;
  const measured = measureSurfaces(distRoot);
  if (measured.error) {
    console.error(`check-bundle-surfaces: MISSING_BUILD — ${measured.error}`);
    return 1;
  }
  const baseline = readBaseline();
  const { failures, reports } = compareSurfaces(measured, baseline);
  for (const line of reports) console.log(`check-bundle-surfaces: ${line}`);
  if (failures.length > 0) {
    for (const line of failures) console.error(`check-bundle-surfaces: FAIL ${line}`);
    return 1;
  }
  console.log(
    `check-bundle-surfaces: PASS — lazy ${measured.lazyJsCount} chunks (${measured.lazyRawTotal} raw / ${measured.lazyGzipTotal} gzip), precache ${measured.precacheEntryCount} entries (${measured.precacheBytesTotal} bytes) — within baseline`,
  );
  return 0;
}

const invokedDirectly =
  process.argv[1] !== undefined && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (invokedDirectly) {
  process.exit(main());
}
