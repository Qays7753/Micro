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
 * F-028 + NF-021 (R10-B5 — 2026-10-13): ثلاثة إحكامات متصلة —
 *  أ) معجم مؤشرات CI الموحّد (CI_MARKER_KEYS/ciMarkerPresent): نفس مفردات
 *     check-bundle-surfaces.mjs::detectEnvironment حرفيًا — أي مؤشر معروف
 *     غير فارغ وقيمته ليست "false" يعني «بيئة CI حاضرة». كان هذا الحارس
 *     يطلب GITHUB_ACTIONS==='true' أو CI==='true' فقط فكانت CI='1' تُعامل
 *     محليًا (تحذير فقط) بينما حارس الأسطح يعتبرها CI مجهولة ويرفض —
 *     الاختبار التوافقي (check-ci-semantics-conformance.test.mjs) يفرز
 *     الاتفاق آليًا للأبد: local ⟺ لا مؤشر؛ null/هوية-CI ⟹ مؤشر حاضر.
 *  ب) سياسة الدفع المباشر إلى main (تدقيق الانجراف كان فارغًا هناك بنيويًا:
 *     merge-base(HEAD, origin/main) == HEAD فلا مقارنة تحدث): حين تساوي
 *     قاعدة الدمج رأس HEAD نفسه، يُدقّق الأب HEAD~1 (حالة ما قبل الدفع)
 *     بدل التمرير الصامت كـ«نظيف» — رفع قيمة أساس بلا إرساء بين HEAD~1
 *     وHEAD يُصطاد الآن. الحد المتبقي الموثق: دفعة مباشرة متعددة الالتزامات
 *     يخفي إرساءها في التزام أبعد من HEAD~1 لا يكشفها هذا المسار (تغطيه
 *     تشغيلات pull_request على الفروع — وهي مسار المراجعة القانوني).
 *     جذر المستودع بلا أب = تأسيس أول موثق ببذرة مطابقة للقياس الحي.
 *  ج) ترخيص الإرساء قابل للتحقق آليًا (سجل الإرساء v2): كان شرط التغطية
 *     نصًا حرًا غير فارغ فقط (قابل للتزوير بصياغة أي جملة)؛ الآن كل مدخل
 *     يحمل authorization.ocRef يشير لسجل Operations Control حيّ (عنصر أو
 *     مسار عمل بملف JSON فعلي ومعرّف مطابق وحالة ليست SUPERSEDED) —
 *     الحارس يرفض المخطط كله إن لم يُحلّ المرجع.
 *     ما يُثبته: الترخيص يستند لسجل حاكم قانوني فعلي في شجرة المستودع
 *     (لا نثرًا حرًا معلقًا). ما لا يُثبته: أن السجل المذكور يغطي هذا
 *     الإرساء بعينه دلاليًا — ذلك يبقى نطاق مراجعة المالك على الـPR.
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

/* F-028/NF-021 (R10-B5 — 2026-10-13): معجم مؤشرات CI الموحّد — نفس المفاتيح
 * التي يمسحها check-bundle-surfaces.mjs::detectEnvironment حرفيًا. أي مفتاح
 * بقيمة غير فارغة وليست "false" = بيئة CI حاضرة. الاختبار التوافقي يفرز
 * استمرار التطابق بين الحارسين. */
export const CI_MARKER_KEYS = [
  "CI",
  "GITHUB_ACTIONS",
  "GITLAB_CI",
  "JENKINS_URL",
  "TEAMCITY_VERSION",
  "CF_PAGES",
  "CF_PAGES_COMMIT_SHA",
];

export function ciMarkerPresent(env = process.env) {
  return CI_MARKER_KEYS.some(key => {
    const value = env[key];
    return value !== undefined && value !== null && value !== "" && value !== "false";
  });
}

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

/* ─── سجل الإرساء v2 (F-028 — ترخيص قابل للتحقق آليًا) ───────────────────── */

export const REANCHOR_SCHEMA_V1 = "micro-file-size-ratchet-reanchors/1";
export const REANCHOR_SCHEMA_V2 = "micro-file-size-ratchet-reanchors/2";

/** حلّ مرجع الترخيص ocRef داخل شجرة Operations Control — عنصر أو مسار عمل
 * حيّ (الملف موجود ويُحلّل ومعرّفه مطابق وحالته ليست SUPERSEDED). */
export function resolveOcRef(ocRoot, ref) {
  if (typeof ref !== "string" || !/^[A-Z0-9]+(-[A-Z0-9]+)*$/.test(ref))
    return { ok: false, reason: "malformed-ref" };
  for (const kind of ["items", "workstreams"]) {
    const file = path.join(ocRoot, kind, `${ref}.json`);
    let raw;
    try {
      raw = fs.readFileSync(file, "utf8");
    } catch {
      continue;
    }
    try {
      const record = JSON.parse(raw);
      if (record.id !== ref) return { ok: false, reason: `id-mismatch:${kind}` };
      if (record.status === "SUPERSEDED") return { ok: false, reason: "superseded" };
      return { ok: true, kind };
    } catch {
      return { ok: false, reason: `unparseable:${kind}` };
    }
  }
  return { ok: false, reason: "not-found" };
}

/** جذر OC الافتراضي لسجل إرساء داخل <repoRoot>/scripts/. */
function defaultOcRootFor(ledgerPath) {
  return path.join(path.dirname(path.dirname(path.resolve(ledgerPath))), "docs", "operations", "control");
}

/** قراءة سجل الإرساء (الترخيص الموثق الوحيد لنمو قيمة أساس).
 * v2 (F-028): كل مدخل يجب أن يحمل authorization.ocRef قابلاً للحل ضد شجرة
 * OC — أي فشل تحليل يُرفض المخطط كله (فشل مغلق). v1 القديم (بلا حقل
 * schema أو بمخطط /1) يُقبل كما هو للتاريخ المتجمد فقط. */
export function loadReanchorLedger(ledgerPath = REANCHOR_LEDGER_PATH, options = {}) {
  let parsed;
  try {
    parsed = JSON.parse(fs.readFileSync(ledgerPath, "utf8"));
  } catch (error) {
    if (error.code === "ENOENT") return { entries: [] };
    throw error;
  }
  if (parsed === null || typeof parsed !== "object" || !Array.isArray(parsed.entries))
    throw new Error("reanchor ledger invalid");
  const schema = parsed.schema ?? REANCHOR_SCHEMA_V1;
  if (schema !== REANCHOR_SCHEMA_V1 && schema !== REANCHOR_SCHEMA_V2)
    throw new Error(`reanchor ledger unknown schema: ${schema}`);
  if (schema === REANCHOR_SCHEMA_V2) {
    const ocRoot = options.ocRoot ?? defaultOcRootFor(ledgerPath);
    for (const [index, entry] of parsed.entries.entries()) {
      const ref = entry?.authorization?.ocRef;
      const resolved = resolveOcRef(ocRoot, ref);
      if (!resolved.ok)
        throw new Error(
          `reanchor ledger entry ${entry?.id ?? `#${index}`}: authorization.ocRef "${ref}" does not resolve (${resolved.reason})`,
        );
    }
  }
  return parsed;
}

/** تغطية ledger لزيادة قيمة مسار: from مطابق للقيمة القديمة وإلى ≥ الجديدة،
 * وترخيص v2 حاضر بنيويًا (ocRef غير فارغ — الحل الكامل ضد شجرة OC يتم
 * في loadReanchorLedger؛ هذا الفحص البنيوي يمنع تجاوز الترخيص بتمرير
 * كائن ledger غير محمّل عبر المسار القانوني). */
function ledgerCovers(ledgerEntries, rel, fromNbLoc, toNbLoc) {
  return ledgerEntries.some(
    entry =>
      entry.path === rel &&
      entry.from?.nbLoc === fromNbLoc &&
      Number.isInteger(entry.to?.nbLoc) &&
      entry.to.nbLoc >= toNbLoc &&
      typeof entry.authorization?.ownerReview === "string" &&
      entry.authorization.ownerReview.length > 0 &&
      typeof entry.authorization?.ocRef === "string" &&
      entry.authorization.ocRef.length > 0,
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

/** رأس HEAD الحالي (بصمة كاملة) — أو null إن تعذر. */
export function resolveHead(repoRoot) {
  try {
    const out = execFileSync("git", ["-C", repoRoot, "rev-parse", "HEAD"], { encoding: "utf8" });
    const sha = out.trim();
    return sha !== "" ? sha : null;
  } catch {
    return null;
  }
}

/** الأب المباشر HEAD~1 — أو null إن لم يوجد (جذر المستودع). */
function resolveParent(repoRoot) {
  try {
    const out = execFileSync("git", ["-C", repoRoot, "rev-parse", "HEAD~1"], { encoding: "utf8" });
    const sha = out.trim();
    return sha !== "" ? sha : null;
  } catch {
    return null;
  }
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
 *
 * F-028 (R10-B5 — 2026-10-13): سياسة الدفع المباشر إلى main — إن كانت قاعدة
 * الدمج هي HEAD نفسه (دفع مباشر لـmain أو دمج PR أو فحص محلي على main)
 * فالتدقيق مقابلها فارغ بنيويًا؛ يُدقّق الأب HEAD~1 (حالة ما قبل الدفع)
 * بتدقيق كامل بدل التمرير الصامت، مع ملاحظة صريحة بالسياسة المطبقة. جذر
 * المستودع (لا أب) = تأسيس أول موثق. F-028/NF-021: حضور CI بالمعجم
 * الموحد (ciMarkerPresent) — CI='1' الآن CI كاملة الفشل المغلق لا محليّ.
 */
export function auditBaselineDrift(repoRoot, options = {}) {
  const inCI = options.inCi ?? ciMarkerPresent();
  let mergeBase = options.mergeBase !== undefined ? options.mergeBase : resolveMergeBase(repoRoot);
  const notes = [];
  /* F-028: القاعدة الفارغة (== HEAD) لا تُدقق — الأب هو المرجع. */
  if (mergeBase !== null) {
    const head = resolveHead(repoRoot);
    if (head !== null && mergeBase.sha === head) {
      const parent = resolveParent(repoRoot);
      if (parent === null) {
        return {
          status: "root-commit-establishment",
          violations: [],
          notes: [
            "merge-base == HEAD وجذر المستودع بلا أب — تأسيس أول؛ البذرة يجب أن تطابق القياس الحي (تحقق المخطط/الشجرة يفرضه)",
          ],
        };
      }
      notes.push(
        "سياسة الدفع المباشر (F-028): قاعدة الدمج == HEAD فالتدقيق الفارغ استُبدل بتدقيق الأب HEAD~1 (حالة ما قبل الدفع) — الحد المتبقي موثق في رأس الحارس",
      );
      mergeBase = { sha: parent, ref: "HEAD~1" };
    }
  }
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
    options.ledger ??
    loadReanchorLedger(path.join(repoRoot, "scripts", "file-size-ratchet-reanchors.json"));
  /* F-028: بيانات الترخيص للتقرير — المخطط المحمّل وعدد المراجع المحسولة. */
  const ledgerSchema = ledger.schema ?? REANCHOR_SCHEMA_V1;
  const ledgerOcRefs = new Set(
    (ledger.entries ?? []).map(entry => entry?.authorization?.ocRef).filter(ref => typeof ref === "string"),
  ).size;
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
  return {
    status: violations.length > 0 ? "drift" : "clean",
    violations,
    reanchored,
    ledgerSchema,
    ledgerOcRefs,
    notes: [...notes, `تدقيق الانجراف مقابل ${mergeBase.ref} @ ${mergeBase.sha}`],
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
  const ledgerNote =
    drift.ledgerSchema === REANCHOR_SCHEMA_V2
      ? `؛ تراخيص الإرساء محسولة آليًا ضد شجرة OC (${drift.ledgerOcRefs} مرجعًا — F-028)`
      : "";
  console.log(
    `file-size-ratchet: PASS — ${s.measured} ملفًا مشمولًا (الأساس ${s.baseline}؛ انكماش ${s.shrunk}؛ محذوف ${s.removed}؛ إرساءات موثقة ${result.reanchored.length})؛ صفر نمو غير مبرر داخل الشريط أو عابره (R8-2/R8-F-005+F-006)${ledgerNote}`,
  );
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main();
}
