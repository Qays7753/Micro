#!/usr/bin/env node
/**
 * Wave 4E (ARCH-002/WS-212 — بطاقة RC-9): حارس الراتشة الحجمية/المسؤولية —
 * يرفض أي تصعيد شريطي جديد فوق الأساس المقبول (CI يرفض الجديد فقط).
 *
 * الأشرطة (نتاج nbLOC للملفات الإنتاجية والسكربت — مطابقة لمنهجية سجل الجرد
 * وPLAN-A-TO-Z §7.3): NORMAL <400، WATCH 400-799، SPLIT_CANDIDATE 800-1199،
 * SPLIT_NOW ≥1200. إشارة مراجعة لا أمر تقسيم آلي — لكن العبور الصامت ممنوع:
 *
 *  - ملف في الأساس لا يجوز أن يتصاعد شريطه (عبور 400/800/1200 صعودًا).
 *  - ملف جديد لا يدخل مباشرة في WATCH أو أعلى: دخوله يعني نموًا يستحق
 *    تحديث الأساس + صف سجل الجرد في نفس الـPR (مرئيًا لا صامتًا).
 *  - الانكماش دائمًا مسموح؛ والملف المحذوف من الشجرة يبقى في الأساس بلا أثر.
 *
 * الفئات المشمولة: production + script (نفس دالة تصنيف سجل الجرد حرفيًا)؛
 * الاختبارات/الـfixtures/المولدة/الإعدادات خارج الراتشة (تُحكم بأنظمتها).
 *
 * الاستخدام: node scripts/check-file-size-ratchet.mjs [repoRoot].
 * الخروج: 0 = نظيف؛ 1 = أي تصعيد جديد؛ 2 = خطأ استخدام.
 */
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
export const BASELINE_PATH = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "file-size-ratchet-baseline.json",
);

export const TEST_PAT =
  /\.(test|spec|dom\.test|ui\.test|contract\.test|characterization\.test)\.[cm]?[jt]sx?$/;

const CONFIG_FILES = new Set([
  "package.json",
  "pnpm-lock.yaml",
  "pnpm-workspace.yaml",
  "tsconfig.json",
  "eslint.config.js",
  "vitest.config.ts",
  ".prettierrc.json",
  ".stylelintrc.json",
  ".gitattributes",
  ".gitignore",
  ".replit",
  "todo.md",
  "apps/prototype-web/package.json",
  "apps/prototype-web/tsconfig.json",
  "apps/prototype-web/tsconfig.node.json",
  "apps/prototype-web/vite.config.ts",
  "apps/prototype-web/vitest.config.ts",
  "apps/prototype-web/client/index.html",
  "apps/prototype-web/client/public/_headers",
  "apps/prototype-web/client/public/_redirects",
]);

/** فئة الملف — مرآة حرفية لمنهجية سجل الجرد (build_file_register). */
export function category(rel) {
  if (rel.startsWith("docs/operations/control/generated/")) return "generated";
  const base = path.posix.basename(rel);
  if (TEST_PAT.test(base) || rel.startsWith("tests/")) return "test";
  if (rel.startsWith("scripts/")) return rel.endsWith(".md") ? "doc" : "script";
  if (rel.startsWith("docs/fixtures/") || rel.endsWith(".fixture.json") || rel.endsWith(".fixtures.json"))
    return "fixture";
  if (rel.startsWith("src/") || rel.startsWith("apps/prototype-web/client/src/")) {
    return /\.(ts|tsx|css)$/.test(rel) ? "production" : "asset";
  }
  if (
    rel.startsWith("reports/") ||
    rel.startsWith("planning/") ||
    rel.startsWith("ai-skills/") ||
    rel.startsWith("docs/")
  )
    return "doc";
  if (rel.startsWith("apps/prototype-web/client/public/")) return "asset";
  if (rel.startsWith("apps/prototype-web/scripts/") || rel.startsWith("apps/prototype-web/dev-tools/"))
    return "script";
  if (rel.startsWith(".github/")) return "config";
  if (
    CONFIG_FILES.has(rel) ||
    /\.(json|yaml|yml)$/.test(rel) ||
    rel.endsWith(".config.js") ||
    rel.endsWith(".config.ts")
  )
    return "config";
  if (rel.endsWith(".md")) return "doc";
  if (/\.(ts|tsx|js|mjs|py|sh|css)$/.test(rel)) return "production";
  return "other";
}

/** الشريط من عدد الأسطر غير الفارغة — عتبات سجل الجرد حرفيًا. */
export function bandOf(nbLoc) {
  if (nbLoc >= 1200) return "SPLIT_NOW";
  if (nbLoc >= 800) return "SPLIT_CANDIDATE";
  if (nbLoc >= 400) return "WATCH";
  return "NORMAL";
}

export const BAND_RANK = { NORMAL: 0, WATCH: 1, SPLIT_CANDIDATE: 2, SPLIT_NOW: 3 };

/** الأسطر غير الفارغة (nbLOC) — نفس تعريف القياس في سجل الجرد. */
export function nonBlankLines(content) {
  return content.split("\n").filter(line => line.trim().length > 0).length;
}

/** الملفات المتتبعة بترتيب حتمي (git ls-files — مثل القياس). */
export function listTrackedFiles(repoRoot) {
  const out = execFileSync("git", ["-C", repoRoot, "ls-files"], { encoding: "utf8" });
  return out.split("\n").filter(Boolean).sort();
}

/** قياس الشجرة الحية: خريطة المسار → الشريط للفئتين المشمولتين. */
export function measureCurrentBands(repoRoot) {
  const bands = {};
  for (const rel of listTrackedFiles(repoRoot)) {
    /* ملف أساس الحارس نفسه بيانات حرس لا كودًا محملاً مسؤولية — خارج الراتشة
     * عمدًا (وإلا حرس الحارس نفسه بذاته). */
    if (rel === "scripts/file-size-ratchet-baseline.json") continue;
    const cat = category(rel);
    if (cat !== "production" && cat !== "script") continue;
    const full = path.join(repoRoot, rel);
    /* ملف محذوف من قرص العمل قبل التحديث في الفهرس: خارج القياس (كالمحذوف). */
    if (!fs.existsSync(full)) continue;
    const content = fs.readFileSync(full, "utf8");
    bands[rel] = bandOf(nonBlankLines(content));
  }
  return bands;
}

/** الفحص الكامل: التصعيدات الجديدة فوق الأساس المقبول. */
export function checkFileSizeRatchet(repoRoot, baseline, current) {
  const base = baseline ?? JSON.parse(fs.readFileSync(BASELINE_PATH, "utf8"));
  const cur = current ?? measureCurrentBands(repoRoot);
  const violations = [];
  let shrunk = 0;
  let removed = 0;
  for (const [rel, band] of Object.entries(cur)) {
    const baseBand = base.bands?.[rel];
    if (baseBand === undefined) {
      if (band !== "NORMAL") {
        violations.push({
          rule: "new-file-enters-band",
          key: `${rel}: ${band}`,
          hint: "ملف جديد يدخل مباشرة في شريط مراجعة — إن كان نموًا مشروعًا فحدّث الأساس وصف سجل الجرد في نفس الـPR (لا تصعيد صامت)",
        });
      }
    } else if (BAND_RANK[band] > BAND_RANK[baseBand]) {
      violations.push({
        rule: "band-escalation",
        key: `${rel}: ${baseBand} -> ${band}`,
        hint: "تصاعد شريط حجمي فوق الأساس المقبول — قسّم المسؤولية أو سجّل الاستثناء/خطة التقسيم وحدّث الأساس في نفس الـPR",
      });
    } else if (BAND_RANK[band] < BAND_RANK[baseBand]) {
      shrunk += 1;
    }
  }
  for (const rel of Object.keys(base.bands ?? {})) if (!(rel in cur)) removed += 1;
  return {
    ok: violations.length === 0,
    violations,
    stats: {
      measured: Object.keys(cur).length,
      baseline: Object.keys(base.bands ?? {}).length,
      shrunk,
      removed,
    },
  };
}

/* ─── CLI ─────────────────────────────────────────────────────────────────── */
function main() {
  const repoRoot = process.argv[2] ? path.resolve(process.argv[2]) : ROOT;
  if (!fs.existsSync(path.join(repoRoot, "package.json"))) {
    console.error("file-size-ratchet: USAGE: node scripts/check-file-size-ratchet.mjs [repoRoot]");
    process.exit(2);
  }
  let result;
  try {
    result = checkFileSizeRatchet(repoRoot);
  } catch (error) {
    console.error(`file-size-ratchet: FAIL — تعذر القراءة: ${error.message}`);
    process.exit(1);
  }
  if (!result.ok) {
    console.error(`file-size-ratchet: FAIL — ${result.violations.length} تصعيدًا جديدًا فوق الأساس المقبول:`);
    for (const v of result.violations) {
      console.error(`  [${v.rule}] ${v.key}`);
      console.error(`    ${v.hint}`);
    }
    process.exit(1);
  }
  const s = result.stats;
  console.log(
    `file-size-ratchet: PASS — ${s.measured} ملفًا مشمولًا (الأساس ${s.baseline}؛ انكماش ${s.shrunk}؛ محذوف ${s.removed})؛ صفر تصعيد صامت فوق الأساس (Wave 4E/RC-9)`,
  );
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main();
}
