#!/usr/bin/env node
/**
 * WS-204 (برنامج عزل سياق التوثيق 2026-10-01): حارس سياسة الصور.
 *
 * الغاية: تنفيذ قرار المالك «لا لقطات تاريخية أو أدلة بصرية للتقارير/التخطيط داخل
 * المستودع» آليًا — فلا تعود صورة جديدة إلى سطح التوثيق بصمت. أصول التشغيل وحدها
 * تحت `apps/` مسموحة؛ صور التقارير والتخطيط لا تدخل خط الأساس.
 *
 * القاعدة:
 * - امتدادات مفحوصة: png/jpg/jpeg/gif/webp/svg (لا يشمل .ico وغيره عمدًا).
 * - خط الأساس أدناه هو الأصول التشغيلية تحت `apps/` فقط. أي صورة خارج هذا المسار
 *   = فشل، بما في ذلك أي Screenshot تخطيطية أو تقريرية.
 * - تعديل خط الأساس قرار مالك موثق (قرار المالك يظهر في الـdiff المزدوج)، لا إضافة
 *   صامتة؛ لتحديثه: أضف المسار مع سبب مؤرخ في هذا الملف داخل نفس PR القرار.
 *
 * ─── الخطوة ٥ (برنامج تصحيح ما بعد المسح لPR #316 — 2026-10-06): نطاق
 * المصدر السلطوي فُصل عن ناتج البناء المولَّد (بطاقة D3 من تدقيق W10) ───
 *
 * العلة الجذرية للعمى عن dist/: كان العدّ يمشي على نظام الملفات فيحصي
 * نسخ dist/ المولَّدة بعد البناء كأنها صور مصدر مكررة → إيجابيات زائفة
 * (انحراف العدد 36→72 بعد بناء محلي؛ في CI لا يتأثر الحراس لأنها تسبق
 * البناء — لكن التشغيل المحلي بعد البناء كان يفشل زورًا، وقياس «حراس
 * خضر بعد البناء» كان مستحيلًا).
 *
 * الإصلاح الجذري — تعريف نطاق المصدر السلطوي:
 * - الوضع الأصلي (git): ملفات git يتتبعها فعلاً + غير المتتبعة غير المتجاهلة
 *   (`git ls-files --cached --others --exclude-standard`) داخل الجذور
 *   المفحوصة = «ما سيدخل المستودع» — بالضبط. ناتج البناء المتجاهَل (dist/)
 *   خارج النطاق بحكم التعريف مهما تعشّق، ولا إفلات: صورة جديدة غير متجاهلة
 *   تُحصى (لا تجاوز للممنوعات).
 * - وضع الاحتياط (بلا git/ليس مستودعًا — عينات الاختبار): نفس المشي السابق
 *   مع استثناء أسماء مجلدات الناتج المولَّد الموثقة في .gitignore
 *   (dist/build/coverage/node_modules وغيرها) على أي عمق، مع تحذير مطبوع
 *   بأن العدّ احتياطي.
 *
 * الاستخدام: node scripts/check-image-policy.mjs [root]
 * الخروج: 0 = السياسة محفوظة؛ 1 = صورة خارج خط الأساس.
 */
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

export const IMAGE_EXTENSIONS = [".png", ".jpg", ".jpeg", ".gif", ".webp", ".svg"];
export const EXPECTED_IMAGE_COUNT = 36;

/**
 * خط الأساس المعتمد 2026-10-01 بعد تصحيح المالك:
 * - apps/prototype-web/client/public/brand/** — أصول تشغيلية (favicon/PWA/motion/splash) تستهلكها الواجهة والبناء.
 * - لا توجد حزمة Screenshots تخطيطية أو تقريرية مسموحة داخل المستودع.
 */
export const BASELINE_RULES = [
  { prefix: "apps/", reason: "operational application/build assets" },
];

/** الجذور المفحوصة (المصدر السلطوي للسياسة — لا يُفحص خارجها). */
export const SCAN_ROOTS = ["apps", "src", "docs", "reports", "planning", "qa", "ai-skills", "tests", "scripts"];

/**
 * أسماء مجلدات الناتج المولَّد/المتجاهَل (مرآة بنود البناء والمخرجات في
 * .gitignore) — تُستثنى على أي عمق في وضع الاحتياط فقط؛ أما وضع git فيعتمد
 * قواعد التجاهل الحقيقية للمستودع.
 */
export const GENERATED_DIR_NAMES = new Set([
  "node_modules",
  "dist",
  "build",
  "coverage",
  ".pnpm-store",
  ".cache",
  ".data",
  ".storage",
  "tmp",
  "temp",
]);

function hasImageExtension(relPath) {
  return IMAGE_EXTENSIONS.includes(path.extname(relPath).toLowerCase());
}

function inScanRoots(relPath) {
  return SCAN_ROOTS.some(root => relPath === root || relPath.startsWith(`${root}/`));
}

/** وضع العدّ: git (السلطوي) أم احتياطي (مشي نظام الملفات). */
export function enumerationMode(repoRoot) {
  const probe = spawnSync("git", ["-C", repoRoot, "rev-parse", "--is-inside-work-tree"], { encoding: "utf8" });
  return probe.status === 0 && probe.stdout.trim() === "true" ? "git" : "walk-fallback";
}

function listImagesGit(repoRoot) {
  const result = spawnSync(
    "git",
    ["-C", repoRoot, "ls-files", "--cached", "--others", "--exclude-standard", "-z"],
    { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 },
  );
  if (result.status !== 0) return null;
  return result.stdout
    .split("\0")
    .filter(Boolean)
    .filter(rel => inScanRoots(rel) && hasImageExtension(rel))
    .sort();
}

function listImagesWalk(repoRoot) {
  const out = [];
  const walk = rel => {
    const abs = path.join(repoRoot, rel);
    if (!fs.existsSync(abs)) return;
    for (const e of fs.readdirSync(abs, { withFileTypes: true })) {
      const r = rel ? `${rel}/${e.name}` : e.name;
      if (e.isDirectory()) {
        if (GENERATED_DIR_NAMES.has(e.name)) continue;
        walk(r);
      } else if (hasImageExtension(r)) out.push(r);
    }
  };
  for (const top of SCAN_ROOTS) walk(top);
  return out.sort();
}

/**
 * عدّ صور المصدر السلطوي: ملفات git (متتبعة + غير متتبعة غير متجاهلة) داخل
 * الجذور المفحوصة؛ وعند غياب git (عينات الاختبار) مشي احتياطي يستثني أسماء
 * مجلدات الناتج المولَّد على أي عمق — لا يمكن لنسخ dist/ المؤقتة أن تُحصى
 * في أي الوضعين، ولا يمكن لصورة مصدر ممنوعة أن تُفلت.
 */
export function listImages(repoRoot) {
  const mode = enumerationMode(repoRoot);
  if (mode === "git") {
    const gitListed = listImagesGit(repoRoot);
    if (gitListed !== null) return gitListed;
  }
  return listImagesWalk(repoRoot);
}

export function checkImagePolicy({ repoRoot = ROOT } = {}) {
  const images = listImages(repoRoot);
  const findings = [];
  if (images.length !== EXPECTED_IMAGE_COUNT) {
    findings.push({
      kind: "image-count-drift",
      message: `expected exactly ${EXPECTED_IMAGE_COUNT} operational images, found ${images.length}`,
    });
  }
  for (const img of images) {
    const allowed = BASELINE_RULES.some(rule => img.startsWith(rule.prefix));
    if (!allowed) {
      findings.push({
        kind: "image-outside-baseline",
        path: img,
        message: `image not in the approved baseline (owner decision 2026-10-01: no historical screenshots/report visuals in the repository; baseline changes require a documented owner decision in the same PR)`,
      });
    }
  }
  return findings;
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url))) {
  const root = process.argv[2] ? path.resolve(process.argv[2]) : ROOT;
  const mode = enumerationMode(root);
  const findings = checkImagePolicy({ repoRoot: root });
  for (const f of findings) {
    console.error(`check-image-policy: FAIL ${f.kind} ${f.path}: ${f.message}`);
  }
  if (findings.length > 0) {
    console.error(`check-image-policy: ${findings.length} finding(s)`);
    process.exit(1);
  }
  console.log(
    `check-image-policy: ${listImages(root).length} images, all within the approved baseline (source scope: ${mode} — generated/ignored output excluded by definition)`,
  );
  process.exit(0);
}
