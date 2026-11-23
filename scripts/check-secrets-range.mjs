#!/usr/bin/env node
/**
 * SEC-GIT-001 (Post-Group 6 Wave 5 / DOC-041، 2026-11-21): فحص أسرار المدى
 * الجديد لكل دفعة — كل مدى يُدفع يُفحص قبل البوابات، لا الشجرة الحية وحدها.
 *
 * الغاية: حارس الأسرار الحي (check-secrets.mjs) يفحص الشجرة الحالية فقط؛
 * سرٌ أُدخل ودُفع ثم أُزيل في التزام لاحق يبقى في المدى الجديد للدفعة ولا
 * يراه الفحص الحي أبدًا. هذا الفاحص يسحب المدى `before..after` بـgit
 * (المسارات المضافة/المعدّلة فقط) ويفحص محتوى كل ملف في كل التزام من
 * المدى بأنماط الحارس الحي نفسها — بلا شبكة ولا اعتماديات ولا تكرار
 * للجدول (يستورده من check-secrets.mjs حرفيًا).
 *
 * المخرجات منقّحة دائمًا: اسم النمط + الملف + رقم السطر + الالتزام — لا
 * يُطابق النص المطابق أبدًا (فحص الأسرار لا يكون مصدر تسريب).
 *
 * الاستخدام: node scripts/check-secrets-range.mjs <before> <after> [repoRoot]
 * - before/after: مراجع git صالحة (SHA أو مرجع). المدى before..after.
 * - before = "-" يعني من جذر المستودع (كل التزامات after القابلة للسحب
 *   من جذر المستودع) — مسار التشغيل اليدوي على فرع طويل.
 * الخروج: 0 = نظيف؛ 1 = إصابة واحدة على الأقل؛ 2 = خطأ استخدام/git.
 */
import { execFileSync } from "node:child_process";
import process from "node:process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { SECRET_PATTERNS, scanContent, isSecretFileName } from "./check-secrets.mjs";

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function git(args, repoRoot) {
  return execFileSync("git", args, { cwd: repoRoot, encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
}

/** All commits in before..after (first-parent-agnostic set difference). */
export function commitsInRange(repoRoot, before, after) {
  const range = before === "-" ? after : `${before}..${after}`;
  return git(["rev-list", "--reverse", range], repoRoot).trim().split("\n").filter(Boolean);
}

/** Files touched by a commit (added/modified/renamed — the new-range surface). */
export function filesInCommit(repoRoot, sha) {
  return git(["diff-tree", "--no-commit-id", "--name-only", "-r", "--diff-filter=AMR", "-z", sha], repoRoot)
    .split("\0")
    .filter(Boolean);
}

/** Scan one commit's full tree state for the touched files, with the LIVE
 * guard's exact pattern table. Returns sanitized hits only. */
export function scanCommitRange(repoRoot, before, after) {
  const hits = [];
  const commits = commitsInRange(repoRoot, before, after);
  for (const sha of commits) {
    const files = filesInCommit(repoRoot, sha);
    for (const file of files) {
      if (isSecretFileName(path.basename(file))) {
        hits.push({ pattern: "secret-file-name", file, line: 0, commit: sha.slice(0, 12) });
        continue;
      }
      let content = "";
      try {
        content = git(["show", `${sha}:${file}`], repoRoot);
      } catch {
        /* الملف حُذف في هذا الالتزام أو مسار غير نصي — لا محتوى يُفحص */
        continue;
      }
      for (const hit of scanContent(content, SECRET_PATTERNS)) {
        hits.push({ pattern: hit.patternName, line: hit.line, file, commit: sha.slice(0, 12) });
      }
    }
  }
  return hits;
}

function main() {
  const args = process.argv.slice(2);
  if (args.length < 2 || args.length > 3) {
    console.error("usage: node scripts/check-secrets-range.mjs <before|-> <after> [repoRoot]");
    process.exit(2);
  }
  const [before, after, rootArg] = args;
  const repoRoot = path.resolve(rootArg ?? ROOT);
  let hits;
  try {
    hits = scanCommitRange(repoRoot, before, after);
  } catch (error) {
    console.error(`check-secrets-range: git error — ${error?.message ?? String(error)}`);
    process.exit(2);
  }
  for (const hit of hits) {
    console.log(`check-secrets-range: HIT ${hit.pattern} ${hit.file}:${hit.line} (commit ${hit.commit})`);
  }
  if (hits.length > 0) {
    console.error(
      `check-secrets-range: FAIL — ${hits.length} secret hit(s) in the pushed range ${before}..${after}`,
    );
    process.exit(1);
  }
  console.log(`check-secrets-range: PASS — the new range is free of secret patterns`);
  process.exit(0);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main();
}
