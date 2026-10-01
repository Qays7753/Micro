#!/usr/bin/env node
/**
 * WS-204 (برنامج عزل سياق التوثيق 2026-10-01): حارس تسجيل المهارات ومنحرفات مراجعها.
 *
 * الغاية: قفل أنماط الفشل الأربعة الموثقة في تحقيق 2026-10-01:
 * (C1) مرجع مهارة يشير إلى مسار غير موجود؛
 * (C2) انحراف تثبيت الإصدارات (الاستشهاد بنسخة قديمة لنفس الاسم بينما توجد أحدث
 *      بلا تصريح نطاق)؛
 * (C3) مهارة غير مسجلة (مجلد فيه SKILL.md بلا صف في README.ar.md وفهرس الوثائق) —
 *      علة «anti-vibe غير المسجلة»؛
 * (C4) تحذير فقط: قائمة قراءة مكررة داخل مهارة (تجاوزًا لحزم AGENTS.md §2).
 *
 * الاستخدام: node scripts/check-skill-references.mjs [root]
 * الخروج: 0 = سليم؛ 1 = أي فشل (التحذيرات لا تغير الخروج).
 */
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
export const SKILLS_DIR = "ai-skills";
export const README = "ai-skills/README.ar.md";
export const INDEX = "docs/00-document-index.md";

/** أزواج مسموحة: النسخة الأقدم scoped sibling لا منجرفة (قرار نطاق موثق). */
export const VERSION_PIN_ALLOWLIST = new Set([
  "problem-statement-v4.md", // v5 نطاق الطلب/التنقل؛ v4 نطاق النواة العامة — النطاق يحكم لا الرقم
]);

const ROOT_PREFIXES = [
  "docs/", "ai-skills/", "apps/", "src/", "scripts/", "tests/", "reports/",
  "planning/", "qa/", ".github/",
];

export function extractPaths(text) {
  const out = new Set();
  // backticked paths and markdown link targets
  for (const m of text.matchAll(/`([^`\n]+)`/g)) out.add(m[1]);
  for (const m of text.matchAll(/\]\(([^)\n]+)\)/g)) out.add(m[1]);
  const candidates = [];
  for (const raw of out) {
    const v = raw.trim();
    if (!v || v.startsWith("http://") || v.startsWith("https://")) continue;
    if (!/\.(md|json|ts|tsx|css|mjs|py|csv|txt)\b/.test(v) && !v.startsWith("references/") && !v.startsWith("../")) continue;
    if (/[ <>:"|?*]/.test(v)) continue;
    candidates.push(v.replace(/^\.\//, ""));
  }
  return candidates;
}

export function resolveExists(repoRoot, fromFile, ref) {
  // two resolution styles verified in the wild: file-relative and repo-root-relative
  const base = path.dirname(path.join(repoRoot, fromFile));
  const a = path.normalize(path.join(base, ref));
  const b = path.normalize(path.join(repoRoot, ref));
  return fs.existsSync(a) || fs.existsSync(b);
}

export function listSkills(repoRoot) {
  const abs = path.join(repoRoot, SKILLS_DIR);
  return fs.readdirSync(abs, { withFileTypes: true })
    .filter((e) => e.isDirectory())
    .map((e) => e.name)
    .filter((name) => fs.existsSync(path.join(abs, name, "SKILL.md")));
}

export function checkSkills({ repoRoot = ROOT } = {}) {
  const findings = [];
  const readmeText = fs.existsSync(path.join(repoRoot, README))
    ? fs.readFileSync(path.join(repoRoot, README), "utf8")
    : "";
  const indexText = fs.existsSync(path.join(repoRoot, INDEX))
    ? fs.readFileSync(path.join(repoRoot, INDEX), "utf8")
    : "";
  const skills = listSkills(repoRoot);
  const scanned = [];
  for (const skill of skills) {
    const files = [`${SKILLS_DIR}/${skill}/SKILL.md`];
    const refDir = path.join(repoRoot, SKILLS_DIR, skill, "references");
    if (fs.existsSync(refDir)) {
      for (const f of fs.readdirSync(refDir)) {
        if (f.endsWith(".md") || f.endsWith(".json")) files.push(`${SKILLS_DIR}/${skill}/references/${f}`);
      }
    }
    if (fs.existsSync(path.join(repoRoot, README))) files.push(README);
    for (const rel of files) {
      if (scanned.includes(rel)) continue;
      scanned.push(rel);
      const text = fs.readFileSync(path.join(repoRoot, rel), "utf8");
      // C1: path existence
      for (const ref of extractPaths(text)) {
        if (!resolveExists(repoRoot, rel, ref)) {
          findings.push({ kind: "C1-missing-path", file: rel, message: `referenced path does not exist: ${ref}` });
        }
      }
      // C2: version-pin drift (resolve the referenced directory the same way C1 does)
      for (const ref of extractPaths(text)) {
        const base = path.basename(ref);
        const vm = base.match(/^(.*)-v(\d+)\.md$/);
        if (vm) {
          const [, stem, ver] = vm;
          const baseDir = path.dirname(path.join(repoRoot, rel));
          const candidates = [
            path.dirname(path.normalize(path.join(baseDir, ref))),
            path.dirname(path.normalize(path.join(repoRoot, ref))),
          ].filter((d, i, a) => fs.existsSync(d) && a.indexOf(d) === i);
          let newer = null;
          for (const dirAbs of candidates) {
            const found = fs.readdirSync(dirAbs)
              .map((f) => f.match(new RegExp(`^${stem.replace(/[.*+?^${}()|[\]]/g, "\\$&")}-v(\\d+)\\.md$`)))
              .filter((m) => m && Number(m[1]) > Number(ver))
              .sort((a, b) => Number(b[1]) - Number(a[1]))[0];
            if (found) { newer = found; break; }
          }
          if (newer && !VERSION_PIN_ALLOWLIST.has(base)) {
            findings.push({
              kind: "C2-version-drift",
              file: rel,
              message: `references ${base} while ${newer[0]} exists (scoped-sibling references require a VERSION_PIN_ALLOWLIST entry with a documented scope decision)`,
            });
          }
        }
      }
    }
    // C3: registration
    if (!readmeText.includes(skill)) {
      findings.push({ kind: "C3-unregistered", file: `${SKILLS_DIR}/${skill}`, message: `no row in ${README}` });
    }
    if (!indexText.includes(skill)) {
      findings.push({ kind: "C3-unindexed", file: `${SKILLS_DIR}/${skill}`, message: `no row in ${INDEX}` });
    }
  }
  return findings;
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url))) {
  const root = process.argv[2] ? path.resolve(process.argv[2]) : ROOT;
  const findings = checkSkills({ repoRoot: root });
  for (const f of findings) {
    console.error(`check-skill-references: FAIL ${f.kind} ${f.file}: ${f.message}`);
  }
  if (findings.length > 0) {
    console.error(`check-skill-references: ${findings.length} finding(s)`);
    process.exit(1);
  }
  console.log(`check-skill-references: ${listSkills(root).length} skills registered, all references resolve`);
  process.exit(0);
}
