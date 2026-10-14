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
 *  - R11-REV-NF-001 (2026-10-14، إصلاح مراجعة PR): `rev-list --objects`
 *    يقرن الكائن المكرر (deduplicated blob) بمسار واحد فقط — أول مسار
 *    يصادفه — فتضيع الأسماء المستعارة؛ الآن تُقرأ كل كائنات الشجر الخام
 *    وتُبنى خريطة كاملة (blob → كل مساراته في كل شجرة قابلة للوصول) بنشر
 *    البادئات من جذور الالتزامات، ومسح المحتوى يبقى مرة واحدة لكل كائن
 *    (تخزين مؤقت بمعرف SHA).
 *  - R11-REV-NF-002 (2026-10-14، إصلاح مراجعة PR): رسائل الالتزامات لم تعد
 *    تُستخرج بفواصل تنسيق git log (0x1e/0x1f قابلة للظهور داخل الرسالة فتقطعها)؛
 *    بل تُقرأ كائنات الالتزام الخام نفسها بتأطير طولي، والرسالة = البايتات بعد
 *    أول `\n\n` — الفاصل القانوني الوحيد بين رؤوس الالتزام ورسالته (أسطر
 *    الرؤوس لا تكون فارغة أبدًا؛ أسطر الاستمرار كتوقيع gpg تبدأ بمسافة) —
 *    فالاستخلاص غير ملتبس إثباتيًا مع أي ثنائي داخل الرسالة.
 *  - جدول الأنماط هو نفسه حارس شجرة العمل حرفيًا (imports from
 *    ../check-secrets.mjs: SECRET_PATTERNS + SECRET_FILE_NAMES) — لا جدول
 *    أضعف ولا نسخة منحرفة؛ أي تعديل مستقبلي على الجدول ينعكس هنا آليًا.
 *  - الرسائل: كل رسائل الالتزامات (كائنات خام) ورسائل الوسوم المعرّفة
 *    (annotated tags عبر cat-file) تُفحص بالنمط نفسه.
 *  - أسماء الملفات: كل مسار blob في كل شجرة قابلة للوصول يُقاس على
 *    SECRET_FILE_NAMES.
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
 *    commits, trees, blobs, blob_path_entries, tag_objects }, result:
 *    "ZERO_FINDINGS" | "FINDINGS",
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

export const SCANNER_SCHEMA = "micro-r11-s0-history-secret-scan/2";
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
    const regex = new RegExp(
      pattern.regex.source,
      pattern.regex.flags.includes("g") ? pattern.regex.flags : `${pattern.regex.flags}g`,
    );
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
 * قراءة كائنات بتأطير طولي بايت-دقيق عبر `cat-file --batch` — يُقرأ كل جسم
 * بطوله المعلن حصرًا فلا التباس مع أي محتوى ثنائي أو محارف تشبه الرؤوس
 * أو فواصل تحكم داخل المحتوى (R11-REV-NF-002: نفس المبدأ طُبّق على رسائل
 * الالتزامات). فاشل-مغلق عند أي كسر في الإطار.
 */
function batchReadObjects(repoPath, shas, onObject) {
  for (let offset = 0; offset < shas.length; offset += BATCH_CHUNK) {
    const chunk = shas.slice(offset, offset + BATCH_CHUNK);
    const batchOutput = git(repoPath, ["cat-file", "--batch"], { input: `${chunk.join("\n")}\n` });
    let cursor = 0;
    for (let index = 0; index < chunk.length; index += 1) {
      const headerEnd = batchOutput.indexOf(0x0a, cursor);
      if (headerEnd === -1) fail(`cat-file batch framing broken (header) at chunk ${offset + index}`);
      const header = batchOutput.slice(cursor, headerEnd).toString("utf8");
      const parts = header.split(" ");
      if (parts.length < 3 || parts[1] === "missing" || !/^\d+$/.test(parts[2]))
        fail(`cat-file unexpected header: ${parts.slice(0, 2).join(" ")}`);
      const size = Number.parseInt(parts[2], 10);
      const bodyStart = headerEnd + 1;
      const body = batchOutput.slice(bodyStart, bodyStart + size);
      if (body.length !== size) fail(`cat-file truncated body for ${parts[0]}`);
      cursor = bodyStart + size + 1; /* الفاصل \n بعد الجسم */
      onObject(parts[0], parts[1], body);
    }
  }
}

/**
 * تحليل كائن شجرة خام (R11-REV-NF-001): تسلسل `<mode> <name>\0<20 بايت
 * SHA ثنائية>` — بلا أي افتراض نصي؛ الأسماء بايتات خام (latin1). فاشل-مغلق
 * عند أي كسر في بنية المدخلات.
 */
export function parseTreeEntries(body) {
  const entries = [];
  let cursor = 0;
  while (cursor < body.length) {
    const spaceAt = body.indexOf(0x20, cursor);
    if (spaceAt === -1) fail(`tree entry broken (mode terminator) at byte ${cursor}`);
    const nulAt = body.indexOf(0x00, spaceAt + 1);
    if (nulAt === -1 || nulAt + 21 > body.length)
      fail(`tree entry broken (name terminator) at byte ${cursor}`);
    entries.push({
      mode: body.slice(cursor, spaceAt).toString("latin1"),
      name: body.slice(spaceAt + 1, nulAt).toString("latin1"),
      sha: body.slice(nulAt + 1, nulAt + 21).toString("hex"),
    });
    cursor = nulAt + 21;
  }
  return entries;
}

const BLANK_LINE = Buffer.from([0x0a, 0x0a]);

/**
 * تحليل كائن التزام خام (R11-REV-NF-002): الرؤوس ثم سطر فارغ ثم الرسالة.
 * أول `\n\n` هو الفاصل القانوني الوحيد — أسطر الرؤوس لا تكون فارغة أبدًا
 * (أسطر الاستمرار كتوقيع gpg تبدأ بمسافة) — فالرسالة تُستخلص بلا لبس مع
 * أي 0x1e/0x1f أو أي ثنائي داخلها. رأس `tree` هو حتميًا أول سطر في
 * الكائن (صيغة git الموثقة)؛ غيابه = كائن مشوه = فشل مغلق.
 */
export function parseCommitObject(body) {
  const treeMatch = /^tree ([0-9a-f]{40})\n/.exec(body.toString("latin1"));
  if (!treeMatch) fail("commit object missing its mandatory tree header");
  const separator = body.indexOf(BLANK_LINE);
  const message = separator === -1 ? "" : body.slice(separator + 2).toString("latin1");
  return { treeSha: treeMatch[1], message };
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
  /* 2) كل الالتزامات القابلة للوصول + تعداد الكائنات (المسارات تُستكمل
   *    من الشجر نفسها في الخطوة 4 — R11-REV-NF-001) */
  const commits = git(repoPath, ["rev-list", "--all"]).toString("utf8").split("\n").filter(Boolean);
  const objectShas = [
    ...new Set(
      git(repoPath, ["rev-list", "--objects", "--all"])
        .toString("latin1")
        .split("\n")
        .map(line => {
          const spaceAt = line.indexOf(" ");
          const sha = spaceAt === -1 ? line : line.slice(0, spaceAt);
          return sha.length === 40 ? sha : null; /* ليس معرف كائن (سطور شاذة) */
        })
        .filter(Boolean),
    ),
  ];
  const blobs = [];
  const trees = [];
  {
    /* فحص أنواع دفعي واحد: cat-file --batch-check يرد النوع لكل الكائنات في
     * نداء واحد — لا عملية منفصلة لكل كائن. */
    for (let offset = 0; offset < objectShas.length; offset += BATCH_CHUNK) {
      const chunk = objectShas.slice(offset, offset + BATCH_CHUNK);
      const checkOutput = git(repoPath, ["cat-file", "--batch-check=%(objectname) %(objecttype)"], {
        input: `${chunk.join("\n")}\n`,
      })
        .toString("utf8")
        .split("\n")
        .filter(Boolean);
      for (const line of checkOutput) {
        const [sha, type] = line.split(" ");
        if (type === "blob") blobs.push(sha);
        else if (type === "tree") trees.push(sha);
      }
    }
  }
  /* 3) كل كائنات الشجر تُقرأ خامًا وتُحلل مرة واحدة (تأطير طولي — الإطار
   *    لا يتأثر بأسماء/محارف داخل المدخلات؛ التحليل ثنائي صرف). */
  const parsedTrees = new Map(); /* tree sha -> entries[] */
  batchReadObjects(repoPath, trees, (sha, type, body) => {
    if (type !== "tree") fail(`cat-file expected tree, got ${type} for ${sha}`);
    parsedTrees.set(sha, parseTreeEntries(body));
  });
  /* 4) كائنات الالتزام الخام: رسائل بلا فواصل قابلة للالتباس (R11-REV-NF-002)
   *    + جذور الشجر لبذر مسح المسارات الكامل (R11-REV-NF-001). */
  const commitMessageFindings = [];
  const rootTreeShas = new Set();
  batchReadObjects(repoPath, commits, (sha, type, body) => {
    if (type !== "commit") fail(`cat-file expected commit, got ${type} for ${sha}`);
    const { treeSha, message } = parseCommitObject(body);
    rootTreeShas.add(treeSha);
    for (const hit of matchSecrets(message)) {
      commitMessageFindings.push({
        rule: hit.rule,
        object: sha,
        kind: "commit-message",
        path: "",
        value: hit.value,
      });
    }
  });
  const rawFindings = [];
  const tagMessageFindings = [];
  /* 5) حالة مسح المسارات (R11-REV-NF-001): الخريطة الكاملة blob → كل
   *    مساراته في كل شجرة قابلة للوصول — بذر البادئات من جذور الالتزامات
   *    (وكل وسم معرّف يشير لشجرة) ثم نشرها عبر مدخلات الشجر. الخريطة تحوي
   *    كل زوج (blob، مسار) في كل شجرة قابلة للوصول، لا أول مسار يصادفه
   *    rev-list فقط. الكائن المتكرر يُمسح محتواه مرة واحدة (blobs فريدة)
   *    وتُنسب إليه كل أسمائه. */
  const blobPaths = new Map(); /* blob sha -> Set(paths) */
  const treePrefixes = new Map(); /* tree sha -> Set(dir prefixes) */
  const processedPrefixCount = new Map(); /* tree sha -> prefixes propagated */
  const walkQueue = [];
  const seedTreePath = (treeSha, prefix) => {
    if (!parsedTrees.has(treeSha)) return; /* هدف وسم ليس شجرة معدودة — لا مسار له */
    let prefixes = treePrefixes.get(treeSha);
    if (!prefixes) {
      prefixes = new Set();
      treePrefixes.set(treeSha, prefixes);
    }
    if (prefixes.has(prefix)) return;
    prefixes.add(prefix);
    walkQueue.push(treeSha);
  };
  /* 6) رسائل الوسوم المعرّفة (annotated tags) — قبل مسح المسارات: وسم
   *    يشير مباشرة لشجرة يُبذرها بذرة جذر إضافية (اكتمال التعداد، فاشل-مغلق
   *    لو غابت الشجرة من التعداد). */
  const tagLines = git(repoPath, [
    "for-each-ref",
    "--format=%(objecttype) %(objectname) %(refname)",
    "refs/tags",
  ])
    .toString("utf8")
    .split("\n")
    .filter(Boolean);
  let tagObjects = 0;
  for (const line of tagLines) {
    const [type, sha, refname] = line.split(" ");
    if (type !== "tag") continue; /* الوسم الخفيف هدفه التزام غطاه فحص الرسائل */
    tagObjects += 1;
    const tagText = git(repoPath, ["cat-file", "-p", sha]).toString("latin1");
    const pointed = /^object ([0-9a-f]{40})\ntype (\w+)/m.exec(tagText);
    if (pointed && pointed[2] === "tree") {
      if (!parsedTrees.has(pointed[1]))
        fail(`tag ${refname} points at tree ${pointed[1]} which the object enumeration did not list`);
      seedTreePath(pointed[1], "");
    }
    for (const hit of matchSecrets(tagText)) {
      tagMessageFindings.push({
        rule: hit.rule,
        object: sha,
        kind: "tag-message",
        path: refname,
        value: hit.value,
      });
    }
  }
  for (const treeSha of rootTreeShas) {
    if (!parsedTrees.has(treeSha)) fail(`commit root tree ${treeSha} missing from the object enumeration`);
    seedTreePath(treeSha, "");
  }
  while (walkQueue.length > 0) {
    const treeSha = walkQueue.shift();
    const prefixes = treePrefixes.get(treeSha);
    if (processedPrefixCount.get(treeSha) === prefixes.size) continue; /* لم تنمُ المجموعة */
    for (const entry of parsedTrees.get(treeSha)) {
      const childPaths = [...prefixes].map(prefix =>
        prefix === "" ? entry.name : `${prefix}/${entry.name}`,
      );
      if (entry.mode === "40000") {
        for (const childPath of childPaths) seedTreePath(entry.sha, childPath);
      } else if (entry.mode !== "160000") {
        /* gitlink (160000): التزام وحدة خارجية ليس في هذا المخزن — ليس هدفًا. */
        let paths = blobPaths.get(entry.sha);
        if (!paths) {
          paths = new Set();
          blobPaths.set(entry.sha, paths);
        }
        for (const childPath of childPaths) paths.add(childPath);
      }
    }
    processedPrefixCount.set(treeSha, prefixes.size);
  }
  const blobPathEntries = [...blobPaths.values()].reduce((total, paths) => total + paths.size, 0);
  /* 7) أسماء ملفات الأسرار على كل مسار معدود لكل blob (بلا قراءة المحتوى).
   * قيمة التنقية فارغة عمدًا: المسار نفسه هو الدليل المقصود إصداره (سابقة
   * حارس شجرة العمل يطبع الملف والسطر) — ليس نص مطابقة سري يُحتَجَب. */
  for (const sha of blobs) {
    const paths = blobPaths.get(sha);
    if (!paths) continue; /* blob بمسار شجرة — محتواه يُفحص، لا قاعدة اسم عليه */
    for (const objectPath of [...paths].sort()) {
      const rule = matchSecretFileName(objectPath);
      if (rule) rawFindings.push({ rule, object: sha, kind: "blob-path", path: objectPath, value: "" });
    }
  }
  /* 7) محتوى الـblobs عبر cat-file --batch بتأطير طولي بايت-دقيق — مرة
   *    واحدة لكل كائن فريد، وكل الأسماء المسجلة تُنسب إليه */
  batchReadObjects(repoPath, blobs, (sha, type, body) => {
    if (type !== "blob") fail(`cat-file expected blob, got ${type} for ${sha}`);
    const paths = blobPaths.get(sha);
    const text = body.toString("latin1");
    for (const hit of matchSecrets(text)) {
      rawFindings.push({
        rule: hit.rule,
        object: sha,
        kind: "blob-content",
        path: paths && paths.size > 0 ? [...paths].sort().join(" | ") : "",
        value: hit.value,
      });
    }
  });
  /* 8) رسائل الالتزامات — من كائنات الالتزام الخام نفسها (الخطوة 4)، ثم رسائل الوسوم */
  rawFindings.push(...commitMessageFindings, ...tagMessageFindings);
  /* 9) مواقع الالتزامات الحاوية لا تُحسب إلا للاكتشافات (كفاءة + دقة) */
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
      trees: trees.length,
      blobs: blobs.length,
      blob_path_entries: blobPathEntries,
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
    scanner:
      path.relative(process.cwd(), fileURLToPath(import.meta.url)) ||
      "scripts/security/scan-git-history-secrets.mjs",
    pattern_source:
      "scripts/check-secrets.mjs (SECRET_PATTERNS + SECRET_FILE_NAMES — the working-tree guard's table, shared mechanically)",
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
    console.error(
      `scan-git-history-secrets: FINDINGS — ${findingCount} sanitized finding(s); values never printed`,
    );
    process.exit(1);
  }
  console.error(
    `scan-git-history-secrets: ZERO_FINDINGS — ${report.scanned.commits} commits, ${report.scanned.trees} trees, ${report.scanned.blobs} blobs (${report.scanned.blob_path_entries} blob-path entries), ${report.scanned.refs} refs scanned (${report.scanned.tag_objects} annotated tags); pattern table shared with the working-tree guard; redaction asserted`,
  );
  process.exit(0);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
