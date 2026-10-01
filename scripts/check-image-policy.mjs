#!/usr/bin/env node
/**
 * WS-204 (برنامج عزل سياق التوثيق 2026-10-01): حارس سياسة الصور.
 *
 * الغاية: تنفيذ قرار المالك «لا لقطات تاريخية أو أدلة بصرية للتقارير/التخطيط داخل
 * المستودع» آليًا — فلا تعود صورة جديدة إلى سطح التوثيق بصمت. القرار الأصلي نفّذه
 * WS-204/الموجة 4 (حُذفت 337 لقطة تاريخية)، وهذا الحارس يجمّد خط الأساس الناتج.
 *
 * القاعدة:
 * - امتدادات مفحوصة: png/jpg/jpeg/gif/webp/svg (لا يشمل .ico وغيره عمدًا).
 * - خط الأساس أدناه هو الصور المسموح وجودها (أصول تشغيلية تحت apps/ + حزمة أدلة
 *   UX-001 الحية المرتبطة ببند نشط). أي صورة خارج خط الأساس = فشل.
 * - تعديل خط الأساس قرار مالك موثق (قرار المالك يظهر في الـdiff المزدوج)، لا إضافة
 *   صامتة؛ لتحديثه: أضف المسار مع سبب مؤرخ في هذا الملف داخل نفس PR القرار.
 *
 * الاستخدام: node scripts/check-image-policy.mjs [root]
 * الخروج: 0 = السياسة محفوظة؛ 1 = صورة خارج خط الأساس.
 */
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

export const IMAGE_EXTENSIONS = [".png", ".jpg", ".jpeg", ".gif", ".webp", ".svg"];

/**
 * خط الأساس المعتمد 2026-10-01 (WS-204/الموجة 5):
 * - apps/prototype-web/client/public/brand/** — أصول تشغيلية (favicon/PWA/motion/splash) تستهلكها الواجهة والبناء.
 * - planning/ux-001-v2-evolution-2026-09-24/** — حزمة أدلة UX-001 الحية (بند IN_PROGRESS)؛ يعاد تصنيفها عند إغلاق البند.
 */
export const BASELINE_RULES = [
  { prefix: "apps/", reason: "operational application/build assets" },
  { prefix: "planning/ux-001-v2-evolution-2026-09-24/", reason: "live evidence pack tied to active item UX-001" },
];

export function listImages(repoRoot) {
  const out = [];
  const walk = (rel) => {
    const abs = path.join(repoRoot, rel);
    if (!fs.existsSync(abs)) return;
    for (const e of fs.readdirSync(abs, { withFileTypes: true })) {
      const r = rel ? `${rel}/${e.name}` : e.name;
      if (e.isDirectory()) walk(r);
      else if (IMAGE_EXTENSIONS.includes(path.extname(e.name).toLowerCase())) out.push(r);
    }
  };
  for (const top of ["apps", "src", "docs", "reports", "planning", "qa", "ai-skills", "tests", "scripts"]) walk(top);
  return out;
}

export function checkImagePolicy({ repoRoot = ROOT } = {}) {
  const images = listImages(repoRoot);
  const findings = [];
  for (const img of images) {
    const allowed = BASELINE_RULES.some((rule) => img.startsWith(rule.prefix));
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
  const findings = checkImagePolicy({ repoRoot: root });
  for (const f of findings) {
    console.error(`check-image-policy: FAIL ${f.kind} ${f.path}: ${f.message}`);
  }
  if (findings.length > 0) {
    console.error(`check-image-policy: ${findings.length} finding(s)`);
    process.exit(1);
  }
  console.log(`check-image-policy: ${listImages(root).length} images, all within the approved baseline`);
  process.exit(0);
}
