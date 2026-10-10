#!/usr/bin/env node
/**
 * R8 (WS-216/ARCH-007 — R8-F-005/R8-F-006، 2026-10-10): راتشة الحجم داخل
 * الشريط — امتداد جذر لحارس Wave 4E/RC-9: لا نمو غير مبرر داخل Band بعد
 * اليوم، ولا تعديل أساس نفس-الـPR يخفي نموًا.
 *
 * القواعد (فوق تعريفات الأشرطة نفسها حرفيًا: NORMAL <400، WATCH 400-799،
 * SPLIT_CANDIDATE 800-1199، SPLIT_NOW ≥1200؛ وnbLOC منهجية السجل):
 *  1) نمو داخل الشريط يُرفض: current > baseline يفشل بعناصر (ملف، قيمة
 *     قديمة، جديدة، شريط، سبب) — إلا إذا غطّاه سجل إرساء موثق (ledger)
 *     بسلسلة صحيحة (from == قيمة الأساس) ومرجع مراجعة مالك.
 *  2) عبور شريط صعودًا = نمو (تغلّطه القاعدة ١ تلقائيًا)؛ ملف جديد لا يدخل
 *     WATCH+ مباشرة؛ الجديد NORMAL يجوز.
 *  3) الانكماش مسموح ويُبلَّغ بتوصية قفل المكسب؛ المحذوف يبقى في الأساس
 *     بلا أثر (تنظيفه عمدًا في نفس PR الحذف — موثق).
 *  4) تدقيق انجراف الأساس (منع إخفاء نمو نفس-الـPR): يقارن أساس رأس الدمج
 *     (merge-base مع main) بأساس HEAD؛ كل زيادة قيمة تتطلب مدخل ledger
 *     مطابقًا (from/to)، وكل حذف صف لملف ما زال حيًّا يُرفض. في CI يتعذر
 *     حلّ قاعدة الدمج = فشل؛ محليًا تحذير صريح.
 *  5) فشل مغلق: مخطط تالف، مسارات مكررة، شريط لا يطابق قياسه، نسخة مجهولة.
 *
 * الفئات المشمولة: production + script (دالة تصنيف السجل حرفيًا)؛ الاختبارات
 * والـfixtures والمولدة والإعدادات خارج الراتشة (تُحكم بأنظمتها). بيانات
 * الحارس نفسه (baseline + reanchors) خارج القياس عمدًا (وإلا حرس نفسه بذاته).
 *
 * الاستخدام: node scripts/check-file-size-ratchet.mjs [repoRoot].
 * الخروج: 0 = نظيف؛ 1 = أي نمو/انجراف غير مصرح؛ 2 = خطأ استخدام.
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
export const REANCHOR_LEDGER_PATH = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "file-size-ratchet-reanchors.json",
);

export const TEST_PAT =
  /\.(test|spec|dom\.test|ui\.test|contract\.test|characterization\.test)\.[cm]?[jt]sx?$/;

/** بيانات الحارس نفسها — خارج الراتشة عمدًا (بيانات حرس لا كودًا محملًا). */
const GUARD_DATA_FILES = new Set([
  "scripts/file-size-ratchet-baseline.json",
  "scripts/file-size-ratchet-reanchors.json",
]);

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
export const BASELINE_SCHEMA = "micro-file-size-ratchet/2";

/** الأسطر غير الفارغة (nbLOC) — نفس تعريف القياس في سجل الجرد. */
export function nonBlankLines(content) {
  return content.split("\n").filter(line => line.trim().length > 0).length;
}

/** الملفات المتتبعة بترتيب حتمي (git ls-files — مثل القياس). */
export function listTrackedFiles(repoRoot) {
  const out = execFileSync("git", ["-C", repoRoot, "ls-files"], { encoding: "utf8" });
  return out.split("\n").filter(Boolean).sort();
}

/** قياس الشجرة الحية: المسار → { nbLoc, band } للفئتين المشمولتين. */
export function measureCurrentMetrics(repoRoot) {
  const metrics = {};
  for (const rel of listTrackedFiles(repoRoot)) {
    if (GUARD_DATA_FILES.has(rel)) continue;
    const cat = category(rel);
    if (cat !== "production" && cat !== "script") continue;
    const full = path.join(repoRoot, rel);
    /* ملف محذوف من قرص العمل قبل التحديث في الفهرس: خارج القياس (كالمحذوف). */
    if (!fs.existsSync(full)) continue;
    const content = fs.readFileSync(full, "utf8");
    const nbLoc = nonBlankLines(content);
    metrics[rel] = { nbLoc, band: bandOf(nbLoc) };
  }
  return metrics;
}

/**
 * فحص مخطط الأساس v2 (fail-closed): نسخة، قياسات صحيحة، شريط مطابق للقياس،
 * ومسارات مكررة (كشفها بمسح نصي للمفاتيح ذات القيم الكائنية ثم مطابقة
 * التكرار) — لا يُقبل أساس غامض.
 */
export function validateBaseline(baseline, rawText) {
  if (baseline === null || typeof baseline !== "object" || Array.isArray(baseline)) return "not an object";
  if (baseline.version !== 2) return "version !== 2";
  if (baseline.schema !== BASELINE_SCHEMA) return "schema mismatch";
  const measurements = baseline.measurements;
  if (measurements === null || typeof measurements !== "object" || Array.isArray(measurements))
    return "measurements invalid";
  for (const [rel, entry] of Object.entries(measurements)) {
    if (entry === null || typeof entry !== "object") return `measurements.${rel} invalid`;
    if (!Number.isInteger(entry.nbLoc) || entry.nbLoc < 0) return `measurements.${rel}.nbLoc invalid`;
    if (!["NORMAL", "WATCH", "SPLIT_CANDIDATE", "SPLIT_NOW"].includes(entry.band))
      return `measurements.${rel}.band invalid`;
    if (entry.band !== bandOf(entry.nbLoc))
      return `measurements.${rel}.band inconsistent with nbLoc ${entry.nbLoc}`;
  }
  if (typeof rawText === "string") {
    const structural = new Set(["measurements", "provenance"]);
    const counts = new Map();
    for (const match of rawText.matchAll(/"((?:[^"\\]|\\.)*)":\s*\{/g)) {
      const key = match[1];
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    for (const [key, count] of counts)
      if (count > 1 && !structural.has(key)) return `duplicate path "${key}" (${count} occurrences)`;
  }
  return null;
}

/** قراءة سجل الإرساء (الترخيص الموثق الوحيد لنمو قيمة أساس). */
export function loadReanchorLedger(ledgerPath = REANCHOR_LEDGER_PATH) {
  let parsed;
  try {
    parsed = JSON.parse(fs.readFileSync(ledgerPath, "utf8"));
  } catch (error) {
    if (error.code === "ENOENT") return { entries: [] };
    throw error;
  }
  if (parsed === null || typeof parsed !== "object" || !Array.isArray(parsed.entries))
    throw new Error("reanchor ledger invalid");
  return parsed;
}

/** تغطية ledger لزيادة قيمة مسار: from مطابق للقيمة القديمة وإلى ≥ الجديدة. */
function ledgerCovers(ledgerEntries, rel, fromNbLoc, toNbLoc) {
  return ledgerEntries.some(
    entry =>
      entry.path === rel &&
      entry.from?.nbLoc === fromNbLoc &&
      Number.isInteger(entry.to?.nbLoc) &&
      entry.to.nbLoc >= toNbLoc &&
      typeof entry.authorization?.ownerReview === "string" &&
      entry.authorization.ownerReview.length > 0,
  );
}

/**
 * الفحص الكامل: نمو غير مبرر (داخل الشريط أو عابره)، ملف جديد يدخل WATCH+،
 * مع تغطية الإرساء الموثق (يُبلَّغ لا يُمرر بصمت)، والانكماش والمحذوف.
 */
export function checkFileSizeRatchet(repoRoot, baseline, current, ledger = { entries: [] }) {
  const base = baseline ?? JSON.parse(fs.readFileSync(BASELINE_PATH, "utf8"));
  const cur = current ?? measureCurrentMetrics(repoRoot);
  const violations = [];
  const reanchored = [];
  let shrunk = 0;
  let removed = 0;
  for (const [rel, entry] of Object.entries(cur)) {
    const baseEntry = base.measurements?.[rel];
    if (baseEntry === undefined) {
      if (entry.band !== "NORMAL") {
        violations.push({
          rule: "new-file-enters-band",
          key: `${rel}: ${entry.band} (${entry.nbLoc} nbLOC)`,
          hint: "ملف جديد يدخل مباشرة في شريط مراجعة — إن كان نموًا مشروعًا فأرسِ القيمة بسجل الإرساء وصف سجل الجرد في نفس الـPR (لا تصعيد صامت)",
        });
      }
      continue;
    }
    if (entry.nbLoc > baseEntry.nbLoc) {
      if (ledgerCovers(ledger.entries ?? [], rel, baseEntry.nbLoc, entry.nbLoc)) {
        reanchored.push(`${rel}: ${baseEntry.nbLoc} -> ${entry.nbLoc} (${entry.band})`);
      } else {
        violations.push({
          rule: BAND_RANK[entry.band] > BAND_RANK[baseEntry.band] ? "band-escalation" : "within-band-growth",
          key: `${rel}: ${baseEntry.nbLoc} -> ${entry.nbLoc} nbLOC (${baseEntry.band} -> ${entry.band})`,
          hint: "نمو غير مبرر داخل الشريط — قلّل المسؤولية أو أرسِ القيمة الجديدة بسجل إرساء موثق (ledger) بمرجع مراجعة مالك في نفس الـPR؛ لا تحرر الأساس بصمت",
        });
      }
    } else if (entry.nbLoc < baseEntry.nbLoc) {
      shrunk += 1;
    }
  }
  for (const rel of Object.keys(base.measurements ?? {})) if (!(rel in cur)) removed += 1;
  return {
    ok: violations.length === 0,
    violations,
    reanchored,
    stats: {
      measured: Object.keys(cur).length,
      baseline: Object.keys(base.measurements ?? {}).length,
      shrunk,
      removed,
    },
  };
}

/** حل قاعدة الدمج مع main (origin/main ثم main) — أو null إن تعذر. */
export function resolveMergeBase(repoRoot) {
  for (const ref of ["origin/main", "main"]) {
    try {
      const out = execFileSync("git", ["-C", repoRoot, "merge-base", "HEAD", ref], { encoding: "utf8" });
      const sha = out.trim();
      if (sha !== "") return { sha, ref };
    } catch {
      /* المرجع غير موجود — جرّب التالي */
    }
  }
  return null;
}

function baselineAtCommit(repoRoot, sha) {
  const out = execFileSync("git", ["-C", repoRoot, "show", `${sha}:scripts/file-size-ratchet-baseline.json`], {
    encoding: "utf8",
  });
  return { parsed: JSON.parse(out), raw: out };
}

/**
 * تدقيق الانجراف: مقارنة أساس رأس الدمج بأساس HEAD — كل زيادة قيمة تتطلب
 * مدخل إرساء بسلسلة صحيحة، وكل حذف صف لملف حي يُرفض. أساس v1 عند القاعدة
 * = هجرة موثقة (تحقق البذرة == القياس الحي) لا تدقيق قيم.
 */
export function auditBaselineDrift(repoRoot, options = {}) {
  const inCI = options.inCi ?? (process.env.GITHUB_ACTIONS === "true" || process.env.CI === "true");
  const mergeBase = options.mergeBase !== undefined ? options.mergeBase : resolveMergeBase(repoRoot);
  if (mergeBase === null) {
    return {
      status: inCI ? "unavailable-in-ci" : "unavailable",
      violations: inCI
        ? [
            {
              rule: "drift-audit-unavailable",
              key: "merge-base with main unresolvable",
              hint: "في CI يجب أن تكون قاعدة الدمج متاحة (fetch-depth: 0) — لا يدقق إخفاء نمو نفس-الـPR بدونها",
            },
          ]
        : [],
      notes: ["merge-base غير قابل للحل — تخطي التدقيق (تحذير محلي؛ فشل في CI)"],
    };
  }
  let old;
  try {
    old = baselineAtCommit(repoRoot, mergeBase.sha);
  } catch {
    return {
      status: "no-baseline-at-base",
      violations: [],
      notes: [`لا أساس عند ${mergeBase.sha} — أول تأسيس، لا انجراف`],
    };
  }
  const current = JSON.parse(fs.readFileSync(path.join(repoRoot, "scripts", "file-size-ratchet-baseline.json"), "utf8"));
  if (old.parsed.version !== 2) {
    /* هجرة v1→v2: البذرة يجب أن تساوي القياس الحي (لا انحراف صامت). */
    const live = measureCurrentMetrics(repoRoot);
    const mismatches = Object.entries(current.measurements ?? {})
      .filter(([rel, entry]) => live[rel] === undefined || live[rel].nbLoc !== entry.nbLoc)
      .slice(0, 5)
      .map(([rel, entry]) => `${rel}: baseline ${entry.nbLoc} vs live ${live[rel]?.nbLoc ?? "missing"}`);
    return {
      status: mismatches.length > 0 ? "migration-mismatch" : "migration-verified",
      violations: mismatches.map(detail => ({
        rule: "seed-mismatch",
        key: detail,
        hint: "بذرة v2 يجب أن تطابق القياس الحي للشجرة عند الهجرة — أي انحراف يحتاج تفسيرًا موثقًا",
      })),
      notes: [`هجرة أساس v${old.parsed.version}→v2 عند القاعدة ${mergeBase.sha} — تحقق البذرة ضد القياس الحي`],
    };
  }
  const ledger =
    options.ledger ?? loadReanchorLedger(path.join(repoRoot, "scripts", "file-size-ratchet-reanchors.json"));
  const violations = [];
  const reanchored = [];
  const oldMeasurements = old.parsed.measurements ?? {};
  const newMeasurements = current.measurements ?? {};
  for (const [rel, entry] of Object.entries(newMeasurements)) {
    const oldEntry = oldMeasurements[rel];
    if (oldEntry === undefined) continue;
    if (entry.nbLoc > oldEntry.nbLoc) {
      if (ledgerCovers(ledger.entries ?? [], rel, oldEntry.nbLoc, entry.nbLoc)) {
        reanchored.push(`${rel}: ${oldEntry.nbLoc} -> ${entry.nbLoc}`);
      } else {
        violations.push({
          rule: "drift-unauthorized",
          key: `${rel}: baseline ${oldEntry.nbLoc} -> ${entry.nbLoc} في هذا الـPR بلا إرساء موثق`,
          hint: "زيادة قيمة الأساس في نفس PR النمو تخفيه — أضف مدخل إرساء (from/to/سبب/مرجع مراجعة مالك) أو أرجع القيمة",
        });
      }
    }
  }
  for (const rel of Object.keys(oldMeasurements)) {
    if (!(rel in newMeasurements) && fs.existsSync(path.join(repoRoot, rel))) {
      violations.push({
        rule: "drift-entry-removed",
        key: rel,
        hint: "حُذف صف الأساس لملف ما زال حيًّا في نفس الـPR — مسار إخفاء نمو مرفوض؛ أرجع الصف أو وثّق حذف الملف نفسه",
      });
    }
  }
  return { status: violations.length > 0 ? "drift" : "clean", violations, reanchored, notes: [`تدقيق الانجراف مقابل ${mergeBase.ref} @ ${mergeBase.sha}`] };
}

/* ─── CLI ─────────────────────────────────────────────────────────────────── */
function main() {
  const repoRoot = process.argv[2] ? path.resolve(process.argv[2]) : ROOT;
  if (!fs.existsSync(path.join(repoRoot, "package.json"))) {
    console.error("file-size-ratchet: USAGE: node scripts/check-file-size-ratchet.mjs [repoRoot]");
    process.exit(2);
  }
  let result;
  let drift;
  try {
    const rawText = fs.readFileSync(path.join(repoRoot, "scripts", "file-size-ratchet-baseline.json"), "utf8");
    const baseline = JSON.parse(rawText);
    const schemaError = validateBaseline(baseline, rawText);
    if (schemaError !== null) {
      console.error(`file-size-ratchet: FAIL INVALID_BASELINE — ${schemaError}`);
      process.exit(1);
    }
    const ledger = loadReanchorLedger(path.join(repoRoot, "scripts", "file-size-ratchet-reanchors.json"));
    result = checkFileSizeRatchet(repoRoot, baseline, undefined, ledger);
    drift = auditBaselineDrift(repoRoot, { ledger });
  } catch (error) {
    console.error(`file-size-ratchet: FAIL — تعذر القراءة: ${error.message}`);
    process.exit(1);
  }
  for (const note of drift.notes ?? []) console.log(`file-size-ratchet: ${note}`);
  const allViolations = [...result.violations, ...(drift.violations ?? [])];
  if (allViolations.length > 0) {
    console.error(`file-size-ratchet: FAIL — ${allViolations.length} نمو/انجرافًا غير مصرح فوق الأساس:`);
    for (const v of allViolations) {
      console.error(`  [${v.rule}] ${v.key}`);
      console.error(`    ${v.hint}`);
    }
    process.exit(1);
  }
  for (const line of result.reanchored) console.log(`file-size-ratchet: REANCHORED (documented) ${line}`);
  for (const line of drift.reanchored ?? []) console.log(`file-size-ratchet: DRIFT-AUTHORIZED ${line}`);
  const s = result.stats;
  console.log(
    `file-size-ratchet: PASS — ${s.measured} ملفًا مشمولًا (الأساس ${s.baseline}؛ انكماش ${s.shrunk}؛ محذوف ${s.removed}؛ إرساءات موثقة ${result.reanchored.length})؛ صفر نمو غير مبرر داخل الشريط أو عابره (R8-2/R8-F-005+F-006)`,
  );
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main();
}
