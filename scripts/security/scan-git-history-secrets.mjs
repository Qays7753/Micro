#!/usr/bin/env node
/**
 * R11 S0 (OD-SEC Option A — one-time, 2026-10-13 owner approval): ماسح أسرار
 * تاريخ Git الكامل — دليل فقط، بلا أي تغيير للتاريخ أو لبيانات الاعتماد.
 *
 * الغاية والحدود:
 *  - يفحص كل الكائنات القابلة للوصول في مستودع git (الافتراضي: مرآة نظيفة
 *    يجلبها المشغل — `git clone --mirror`) عبر `rev-list --objects --all` ثم
 *    `cat-file --batch` بتأطير طولي بايت-دقيق (لا تقسيم أسطر — الجسم يُقرأ
 *    بطوله المعلن بالضبط فلا التباس مع محارف فاصلة داخل المحتوى).
 *  - جدول الأنماط هو نفسه حارس شجرة العمل حرفيًا (imports from
 *    ../check-secrets.mjs: SECRET_PATTERNS + SECRET_FILE_NAMES) — لا جدول
 *    أضعف ولا نسخة منحرفة؛ أي تعديل مستقبلي على الجدول ينعكس هنا آليًا.
 *  - الرسائل: كل رسائل الالتزامات (`git log --all`) ورسائل الوسوم المعرّفة
 *    (annotated tags عبر cat-file) تُفحص بالنمط نفسه.
 *  - أسماء الملفات: كل مسار blob يُقاس على SECRET_FILE_NAMES.
 *
 * قواعد الأمن (الـPrompt الكنوني §6.2 — إلزامية):
 *  - لا يُطبع نص المطابقة ولا قيمة السر أبدًا؛ المخزون: اسم النمط + SHA
 *    الكائن + المسار (حيث آمن) + بصمة SHA-256 غير عكسية (16 محرفًا hex من
 *    هاش المنطقة المطابقة) + الالتزامات الحاوية (first/last عبر
 *    `git log --all --find-object`).
 *  - اختبار تنقية داخل المُخرِج (redaction assertion): كل نص يُكتب يُفحص
 *    ضد كل قيمة مطابقة ملتقطة؛ أي احتواء = إحباط فوري REDACTION_FAILURE
 *    قبل كتابة أي ملف. الماسح لا يكون مصدر تسريب.
 *  - بلا شبكة، بلا rotation، بلا إعادة كتابة تاريخ، بلا تعديل حارس
 *    شجرة العمل (المتكرر الدوري قرار W1b مستقل).
 *  - فشل مغلق: أي خطأ git أو وسيط غير صالح = خروج 2 مع رسالة، لا تمرير
 *    صامت.
 *
 * المخرجات (JSON إلى stdout أو --report <path>):
 *  { schema, scanner, pattern_source, date, repo, scanned: { refs, ref_names,
 *    commits, blobs, tag_objects }, result: "ZERO_FINDINGS" | "FINDINGS",
 *    findings: [{ rule, object, kind: "blob-path"|"blob-content"|"commit-message"|"tag-message",
 *    path?, fingerprint, commits: {first, last, count} }], redaction: "ASSERTED" }
 *
 * الاستخدام: node scripts/security/scan-git-history-secrets.mjs <repoPath> [--report out.json]
 * الخروج: 0 = نظيف (ZERO_FINDINGS)؛ 1 = اكتشافات منقحة (لا نص سر)؛ 2 = خطأ استخدام/ماسح.
 */
import { spawnSync } from "node:child_process";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import { SECRET_FILE_NAMES, SECRET_PATTERNS } from "../check-secrets.mjs";

export const SCANNER_SCHEMA = "micro-r11-s0-history-secret-scan/1";
const BATCH_CHUNK = 400;

function fail(message) {
  console.error(`scan-git-history-secrets: ${message}`);
  process.exit(2);
}

/** تنفيذ git فاشل-مغلق: أي فشل يوقف الماسح لا يمرره صامتًا. */
function git(repoPath, args, options = {}) {
  const run = spawnSync("git", ["-C", repoPath, ...args], {
    encoding: null,
    maxBuffer: 1024 * 1024 * 512,
    ...options,
  });
  if (run.error) fail(`git ${args[0]} failed to spawn: ${run.error.message}`);
  if (run.status !== 0) {
    fail(
      `git ${args[0]} exited ${run.status}: ${run.stderr ? run.stderr.toString("utf8").slice(0, 200) : "(no stderr)"}`,
    );
  }
  return run.stdout;
}

/** بصمة غير عكسية: 16 محرف hex من SHA-256 لقيمة مطابقة — لا تستعيد القيمة. */
export function fingerprintOf(value) {
  return crypto.createHash("sha256").update(value, "latin1").digest("hex").slice(0, 16);
}

/** فحص نص ضد جدول الأنماط — يعيد اكتشافات {rule, value, start}. */
export function matchSecrets(text) {
  const hits = [];
  for (const pattern of SECRET_PATTERNS) {
    const regex = new RegExp(pattern.regex.source, pattern.regex.flags.includes("g") ? pattern.regex.flags : `${pattern.regex.flags}g`);
    let match;
    while ((match = regex.exec(text)) !== null) {
      hits.push({ rule: pattern.name, value: match[0], start: match.index });
      if (match.index === regex.lastIndex) regex.lastIndex += 1;
    }
  }
  return hits;
}

/** فحص مسار ضد قواعد أسماء ملفات الأسرار — يعيد اسم القاعدة أو null. */
export function matchSecretFileName(relPath) {
  const base = path.posix.basename(relPath);
  for (const rule of SECRET_FILE_NAMES) {
    if (rule.test(base)) return `secret-file-name:${rule.source}`;
  }
  return null;
}

/**
 * الفحص الكامل لمستودع git (قراءة فقط). يعيد تقريرًا خامًا يحمل القيم
 * المطابقة داخليًا للتنقية ثم تُحذف قبل الإخراج — لا تعبر القيم حد هذه
 * الدالة إلا إلى مدقق التنقية.
 */
export function scanHistory(repoPath) {
  const isRepo =
    fs.existsSync(path.join(repoPath, "HEAD")) /* bare/mirror */ ||
    fs.existsSync(path.join(repoPath, ".git", "HEAD")); /* شجرة عمل عادية */
  if (!isRepo) fail(`not a git repository: ${repoPath}`);
  /* 1) المراجع كلها (رؤوس/وسوم/pull في المرآة) */
  const refNames = git(repoPath, ["for-each-ref", "--format=%(refname)"])
    .toString("utf8")
    .split("\n")
    .filter(Boolean);
  /* 2) كل الالتزامات القابلة للوصول + تعداد الكائنات بمساراتها */
  const commits = git(repoPath, ["rev-list", "--all"])
    .toString("utf8")
    .split("\n")
    .filter(Boolean);
  const objectsRaw = git(repoPath, ["rev-list", "--objects", "--all"]).toString("latin1");
  const blobPaths = new Map(); /* blob sha -> Set(paths) */
  const blobOrder = [];
  for (const line of objectsRaw.split("\n")) {
    if (!line) continue;
    const spaceAt = line.indexOf(" ");
    const sha = spaceAt === -1 ? line : line.slice(0, spaceAt);
    const objectPath = spaceAt === -1 ? "" : line.slice(spaceAt + 1);
    if (sha.length !== 40) continue; /* ليس معرف كائن (سطور شاذة) */
    if (!blobPaths.has(sha)) {
      blobPaths.set(sha, new Set());
      blobOrder.push(sha);
    }
    if (objectPath) blobPaths.get(sha).add(objectPath);
  }
  const blobs = [];
  {
    /* فحص أنواع دفعي واحد: cat-file --batch-check يرد النوع والحجم لكل
     * الكائنات في نداء واحد — لا عملية منفصلة لكل كائن. */
    const shas = blobOrder;
    for (let offset = 0; offset < shas.length; offset += BATCH_CHUNK) {
      const chunk = shas.slice(offset, offset + BATCH_CHUNK);
      const checkOutput = git(repoPath, ["cat-file", "--batch-check=%(objectname) %(objecttype)"], {
        input: `${chunk.join("\n")}\n`,
      })
        .toString("utf8")
        .split("\n")
        .filter(Boolean);
      for (const line of checkOutput) {
        const [sha, type] = line.split(" ");
        if (type === "blob") blobs.push(sha);
      }
    }
  }
  const rawFindings = [];
  /* 3) أسماء ملفات الأسرار على كل مسارات كل blob (بلا قراءة المحتوى).
   * قيمة التنقية فارغة عمدًا: المسار نفسه هو الدليل المقصود إصداره (سابقة
   * حارس شجرة العمل يطبع الملف والسطر) — ليس نص مطابقة سري يُحتَجَب. */
  for (const sha of blobs) {
    for (const objectPath of blobPaths.get(sha)) {
      const rule = matchSecretFileName(objectPath);
      if (rule) rawFindings.push({ rule, object: sha, kind: "blob-path", path: objectPath, value: "" });
    }
  }
  /* 4) محتوى الـblobs عبر cat-file --batch بتأطير طولي بايت-دقيق */
  for (let offset = 0; offset < blobs.length; offset += BATCH_CHUNK) {
    const chunk = blobs.slice(offset, offset + BATCH_CHUNK);
    const batchOutput = git(repoPath, ["cat-file", "--batch"], { input: `${chunk.join("\n")}\n` });
    let cursor = 0;
    for (let index = 0; index < chunk.length; index += 1) {
      const headerEnd = batchOutput.indexOf(0x0a, cursor);
      if (headerEnd === -1) fail(`cat-file batch framing broken (header) at chunk ${offset + index}`);
      const header = batchOutput.slice(cursor, headerEnd).toString("utf8");
      const parts = header.split(" ");
      if (parts.length < 3 || parts[1] !== "blob") fail(`cat-file unexpected header: ${parts.slice(0, 2).join(" ")}`);
      const size = Number.parseInt(parts[2], 10);
      if (!Number.isSafeInteger(size) || size < 0) fail(`cat-file invalid size in header: ${parts[2]}`);
      const bodyStart = headerEnd + 1;
      const body = batchOutput.slice(bodyStart, bodyStart + size);
      if (body.length !== size) fail(`cat-file truncated body for ${parts[0]}`);
      cursor = bodyStart + size + 1; /* الفاصل \n بعد الجسم */
      const text = body.toString("latin1");
      const paths = [...blobPaths.get(parts[0])];
      for (const hit of matchSecrets(text)) {
        rawFindings.push({
          rule: hit.rule,
          object: parts[0],
          kind: "blob-content",
          path: paths.length > 0 ? paths.sort().join(" | ") : "",
          value: hit.value,
        });
      }
    }
  }
  /* 5) رسائل الالتزامات — إطار سجلات بفواصل تحكم غير قابلة للالتباس عمليًا */
  const logRaw = git(repoPath, ["log", "--all", "--format=%H%x1f%B%x1e"]).toString("latin1");
  for (const record of logRaw.split("\x1e")) {
    const trimmed = record.replace(/^\s+/, "");
    if (!trimmed) continue;
    const separatorAt = trimmed.indexOf("\x1f");
    if (separatorAt === -1) continue;
    const commitSha = trimmed.slice(0, separatorAt);
    const message = trimmed.slice(separatorAt + 1);
    for (const hit of matchSecrets(message)) {
      rawFindings.push({ rule: hit.rule, object: commitSha, kind: "commit-message", path: "", value: hit.value });
    }
  }
  /* 6) رسائل الوسوم المعرّفة (annotated tags) */
  const tagLines = git(repoPath, ["for-each-ref", "--format=%(objecttype) %(objectname) %(refname)", "refs/tags"])
    .toString("utf8")
    .split("\n")
    .filter(Boolean);
  let tagObjects = 0;
  for (const line of tagLines) {
    const [type, sha, refname] = line.split(" ");
    if (type !== "tag") continue; /* الوسم الخفيف هدفه التزام غطاه فحص الرسائل */
    tagObjects += 1;
    const tagText = git(repoPath, ["cat-file", "-p", sha]).toString("latin1");
    for (const hit of matchSecrets(tagText)) {
      rawFindings.push({ rule: hit.rule, object: sha, kind: "tag-message", path: refname, value: hit.value });
    }
  }
  /* 7) مواقع الالتزامات الحاوية لا تُحسب إلا للاكتشافات (كفاءة + دقة) */
  const findings = rawFindings.map(finding => {
    const entry = {
      rule: finding.rule,
      object: finding.object,
      kind: finding.kind,
      fingerprint: fingerprintOf(finding.value),
    };
    if (finding.kind === "blob-path" || finding.kind === "blob-content") {
      entry.path = finding.path;
      const containing = git(repoPath, ["log", "--all", "--find-object", finding.object, "--format=%H"])
        .toString("utf8")
        .split("\n")
        .filter(Boolean);
      entry.commits = {
        first: containing[containing.length - 1] ?? null,
        last: containing[0] ?? null,
        count: containing.length,
      };
    }
    return { entry, secretValue: finding.value };
  });
  return {
    scanned: {
      refs: refNames.length,
      ref_names: refNames,
      commits: commits.length,
      blobs: blobs.length,
      tag_objects: tagObjects,
    },
    findings,
  };
}

/** اختبار التنقية: يعيد قائمة القيم التي كان يمكن أن تتسرب إلى نص متسلسل. */
export function redactionViolations(serializedText, findings) {
  const violations = [];
  for (const finding of findings) {
    if (finding.secretValue.length >= 8 && serializedText.includes(finding.secretValue)) {
      violations.push(finding.entry.fingerprint);
    }
  }
  return violations;
}

/** بناء التقرير المنقح مع اختبار التنقية الصارم قبل أي كتابة. */
export function buildSanitizedReport(repoPath, date) {
  const { scanned, findings } = scanHistory(repoPath);
  const report = {
    schema: SCANNER_SCHEMA,
    scanner: path.relative(process.cwd(), fileURLToPath(import.meta.url)) || "scripts/security/scan-git-history-secrets.mjs",
    pattern_source: "scripts/check-secrets.mjs (SECRET_PATTERNS + SECRET_FILE_NAMES — the working-tree guard's table, shared mechanically)",
    date,
    repo: path.basename(path.resolve(repoPath)),
    scanned,
    result: findings.length === 0 ? "ZERO_FINDINGS" : "FINDINGS",
    findings: findings.map(f => f.entry),
    redaction: "ASSERTED",
  };
  /* اختبار التنقية: لا قيمة سر ملتقطة قد تعبر إلى النص المتسلسل أبدًا. */
  const violations = redactionViolations(JSON.stringify(report), findings);
  if (violations.length > 0) {
    console.error(
      `scan-git-history-secrets: REDACTION_FAILURE — ${violations.length} captured value(s) would reach the report (fingerprints: ${violations.join(", ")})`,
    );
    process.exit(2);
  }
  return { report, findingCount: findings.length };
}

function main() {
  const args = process.argv.slice(2);
  const repoPath = args.find(a => !a.startsWith("--"));
  const reportIndex = args.indexOf("--report");
  const reportPath = reportIndex !== -1 ? args[reportIndex + 1] : null;
  if (!repoPath || (reportIndex !== -1 && !reportPath)) {
    fail("USAGE: node scripts/security/scan-git-history-secrets.mjs <repoPath> [--report out.json]");
  }
  const { report, findingCount } = buildSanitizedReport(repoPath, new Date().toISOString().slice(0, 10));
  const serialized = `${JSON.stringify(report, null, 2)}\n`;
  if (reportPath) fs.writeFileSync(reportPath, serialized, "utf8");
  else process.stdout.write(serialized);
  if (findingCount > 0) {
    console.error(`scan-git-history-secrets: FINDINGS — ${findingCount} sanitized finding(s); values never printed`);
    process.exit(1);
  }
  console.error(
    `scan-git-history-secrets: ZERO_FINDINGS — ${report.scanned.commits} commits, ${report.scanned.blobs} blobs, ${report.scanned.refs} refs scanned (${report.scanned.tag_objects} annotated tags); pattern table shared with the working-tree guard; redaction asserted`,
  );
  process.exit(0);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
