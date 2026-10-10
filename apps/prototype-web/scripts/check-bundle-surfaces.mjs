#!/usr/bin/env node
/**
 * R8 (WS-216/ARCH-007 — R8-F-020 + R7-CF-REPAIR، 2026-10-10): حارس أسطح الحزمة
 * القائم على بيان البناء والبيئة — استبدال نهائي لمصنّف أسماء الملفات
 * (index-*) ولجسر +512 المؤقت من R7.
 *
 * ما يثبته هذا الحارس (بعد R8-1):
 *  - تصنيف حتمي من بيّنة Vite/Rollup (isEntry/isDynamicEntry/imports/
 *    dynamicImports): كل ملف JS صادر يُحتسب مرة واحدة في سطح واحد بالضبط
 *    (مدخل / رفقاء كومة الإقلاع / كسول-ديناميكي فقط)؛ أي تعارض بين البيّنة
 *    والمخرجات = فشل صادق (fail-closed).
 *  - أسطح محروسة لكل بيئة قياس (local / github-actions / cloudflare-pages):
 *    خام رفقاء الإقلاع، خام+gzip الطبقة الكسولة، خام مخزن PWA المسبق، خام
 *    زمن تشغيل عامل الخدمة (sw.js + workbox) — بإثبات مصدر لكل قاعدة بيئة.
 *  - R8-N1 (إغلاق جذر 2026-10-10): أي عنوان precache مكرر في sw.js = فشل
 *    صادق (DUPLICATE_PRECACHE_URLS) — المسار الكنوني الواحد (globPatterns)
 *    لا يُنتج تكرارًا أبدًا؛ عودة التكرار = انحدار إعداد PWA يُرفض فورًا.
 *    كانت العناوين المكررة تُقاس مرة واحدة وتُبلَّغ فقط (رصد R8-1)؛ بعد
 *    إصلاح الجذر في vite.config.ts صار التكرار نفسه عيبًا يمنع البناء.
 *  - gzip يُقاس على محتوى مطبَّع حتميًا (أسماء التجزئة المعروفة + هوية البناء
 *    حين تتاح) فلا يتحول تنقّل أسماء التجزئة بين تشغيلات إلى نمو كود مزعوم؛
 *    والخام يظل البايتات الحقيقية المُصدَرة.
 *  - هوية البيئة تُقرأ من متغيراتها الموثوقة؛ البيئة المجهولة أو غير المُرسَّاة
 *    تفشل صادقة (UNVERIFIED_ENVIRONMENT / UNANCHORED_ENVIRONMENT مع سجل
 *    ANCHOR_RECORD قابل للالتقاط للترسية الموثقة) — لا يُطبَّق الأساس الأسخف
 *    بصمت أبدًا.
 *
 * ما لا يثبته (PG-2 — الخطة §4.3.1):
 *  - سقفا مدخل الإقلاع (650,000/155,300) — ملكية حصرية لـcheck-bundle-budget
 *    (D-034/ADR-017)؛ هذا الحارس يبلّغ قياس المدخل ولا يحرسه (لا مصدر حقيقة
 *    ثانٍ).
 *  - عدالة توزيع الشظايا ولا أحجامًا فردية — العدد يُسجَّل ويُبلَّغ لا يُحرس
 *    (تقسيم شظية بلا نمو بايتات مشروع بنيويًا).
 *
 * البروتوكول: تحديث الأساس عمدًا في نفس PR التغيير المقيس (نمو مقصود بمبرر
 * موثق أو تقليص يُقفل) — لا نمو صامت. رفع السقوف القائمة قرار مالك. سماحيات
 * القياس (raw/gzip) مثبتة المشتق أدناه وأي تجاوز لها في ملف الأساس يُرفض.
 *
 * الاستخدام: node scripts/check-bundle-surfaces.mjs [distRoot]
 * (يعمل ضمن سلسلة build بعد check-bundle-budget.mjs — محليًا وCI وPages).
 * الخروج: 0 = ضمن أساس البيئة؛ 1 = نمو/بيئة ناقصة/أساس غير صالح.
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

/** المقايسات المحروسة وترتيبها الكنوني في السجلات. */
export const GUARDED_MEASUREMENTS = [
  "initialRawTotal",
  "initialGzipNormTotal",
  "lazyRawTotal",
  "lazyGzipNormTotal",
  "precacheBytesTotal",
  "swRuntimeRawTotal",
];
export const REPORTED_COUNTS = [
  "lazyJsCount",
  "initialJsCount",
  "dynamicRootsCount",
  "precacheEntryCount",
  "swRuntimeFileCount",
];

/** سقوف صلبة لسماحيات القياس في ملف الأساس — ما فوقها إضعاف حارس مرفوض. */
export const TOLERANCE_CAPS = { raw: 16, gzip: 256 };
/** المشتق الموثق (R8-0 §4.3): ٢× أقصى |Δ| مرصود لكل فئة قياس. */
export const DEFAULT_TOLERANCES = { raw: 8, gzip: 16 };

const FAILURE_CODES = {
  MISSING_MANIFEST: "بيّنة البناء (dist/public/.vite/manifest.json) غير موجودة — شغّل البناء أولًا.",
  INVALID_MANIFEST: "بيّنة البناء غير قابلة للقراءة (JSON تالف).",
  AMBIGUOUS_ENTRY: "لم يُحدَّد مدخل js وحيد في البيّنة — الرفض الصادق أفضل من التخمين.",
  UNRESOLVABLE_REFERENCE: "البيّنة تشير لملف غير معروف في مخارجها.",
  MISSING_EMITTED_FILE: "ملف مذكور في البيّنة غير موجود في المخرجات.",
  UNACCOUNTED_ASSET: "ملف JS صاعد في assets خارج رسم البيّنة كله — تصنيف غير حتمي.",
  PATH_ESCAPE: "مسار يخرج عن جذر المخرجات — مرفوض.",
  MISSING_SERVICE_WORKER: "sw.js غير موجود في المخرجات.",
  MALFORMED_PRECACHE: "تعذر استخراج مداخل precache من sw.js (صفر مداخل أو صيغة غير مفهومة).",
  DUPLICATE_PRECACHE_URLS:
    "عناوين precache مكررة في sw.js — مسار اختيار واحد (globPatterns) لا ينتج تكرارًا؛ أصلح مصدر التكرار في إعداد PWA (R8-N1) ولا تكرر العنوان.",
  MISSING_PRECACHE_FILE: "مدخل precache يشير لملف غير موجود.",
  INVALID_BASELINE: "ملف الأساس غير صالح (مخطط/نسخة/سماحيات).",
  UNVERIFIED_ENVIRONMENT: "تعذر تحديد بيئة القياس بأمان — لا يُطبَّق أي أساس تخميني.",
  UNANCHORED_ENVIRONMENT: "لا سجل لهذه البيئة في الأساس — رسِّه من قياس فعلي فيها وفق البروتوكول.",
  SURFACE_GROWTH: "نمو فوق أساس البيئة وسماحيتها الموثقة.",
};

/** هوية بيئة القياس من متغيراتها — ترتيب الفحص CF ثم Actions ثم محلي. */
export function detectEnvironment(env = process.env) {
  if (env.CF_PAGES === "1" || (typeof env.CF_PAGES_COMMIT_SHA === "string" && env.CF_PAGES_COMMIT_SHA !== ""))
    return "cloudflare-pages";
  if (env.GITHUB_ACTIONS === "true") return "github-actions";
  /* مؤشرات CI أخرى بلا هوية موثوقة = بيئة غير موثقة (GitLab/GitHub-مقلد) —
   * الرفض الصادق بدل تطبيق أساس محلي على بناء مجهول الأداة. */
  const ciMarkers = [env.CI, env.GITLAB_CI, env.JENKINS_URL, env.TEAMCITY_VERSION];
  if (ciMarkers.some(v => v !== undefined && v !== null && v !== "" && v !== "false")) return null;
  return "local";
}

/** هوية البناء المضمّنة (نفس أولوية vite.config.ts::buildIdentityFromEnv). */
export function buildIdentityFromEnv(env = process.env) {
  const explicit = env.VITE_APP_VERSION?.trim();
  if (explicit) return explicit;
  const githubSha = env.GITHUB_SHA?.trim();
  if (githubSha) return githubSha;
  const pagesSha = env.CF_PAGES_COMMIT_SHA?.trim();
  if (pagesSha) return pagesSha;
  return null;
}

/** حجم gzip (مستوى 9 — نفس أساس حارس الميزانية). */
export function gzipSize(buffer) {
  return zlib.gzipSync(buffer, { level: 9 }).length;
}

/**
 * تطبيع حتمي للمحتوى قبل قياس gzip: أسماء الملفات المجزأة المعروفة تُستبدل
 * بصيغة صفريّة ثابتة (طول متساوٍ)، وسلسلة هوية البناء (حين تُعرف) برمز ثابت.
 * عمليات latin1 ثابتة بايت-بالبايت؛ لا تمس قياس الخام إطلاقًا.
 */
export function normalizeForGzip(buffer, knownBasenames, identity) {
  let text = buffer.toString("latin1");
  for (const name of knownBasenames) {
    /* Vite content hashes are exactly 8 chars of [A-Za-z0-9_-] before ".js" and
     * may themselves contain hyphens (e.g. Finance-Cc-BgvGT.js = name "Finance"
     * + hash "Cc-BgvGT") — extract positionally, never by splitting on "-". */
    if (!name.endsWith(".js") || name.length < 12) continue;
    const dot = name.length - 3;
    const hash = name.slice(dot - 8, dot);
    if (name[dot - 9] !== "-" || !/^[A-Za-z0-9_-]{8}$/.test(hash)) continue;
    const from = `${name.slice(0, dot - 9)}-${hash}`;
    const to = `${name.slice(0, dot - 9)}-00000000`;
    if (text.includes(from)) text = text.split(from).join(to);
  }
  if (identity) {
    const id = Buffer.from(identity, "utf8").toString("latin1");
    if (text.includes(id)) text = text.split(id).join("I".repeat(40));
  }
  return Buffer.from(text, "latin1");
}

/** قراءة الأساس (التحديث عمدًا في نفس PR التغيير — لا هنا أبدًا). */
export function readBaseline(baselinePath = BASELINE_PATH) {
  return JSON.parse(fs.readFileSync(baselinePath, "utf8"));
}

/** فحص صلاحية مخطط الأساس v2 (fail-closed). */
export function validateBaseline(baseline) {
  if (baseline === null || typeof baseline !== "object") return "not an object";
  if (baseline.version !== 2) return "version !== 2";
  if (baseline.schema !== "micro-bundle-surfaces/2") return "schema mismatch";
  const tol = baseline.tolerances ?? {};
  for (const [key, cap] of Object.entries(TOLERANCE_CAPS)) {
    const value = tol[key];
    if (!Number.isInteger(value) || value < 0) return `tolerances.${key} invalid`;
    if (value > cap) return `tolerances.${key} ${value} > cap ${cap} (guard weakening rejected)`;
  }
  const envs = baseline.environments;
  if (envs === null || typeof envs !== "object" || Array.isArray(envs)) return "environments invalid";
  const known = new Set(["local", "github-actions", "cloudflare-pages"]);
  for (const key of Object.keys(envs))
    if (!known.has(key)) return `unknown environment record "${key}"`;
  for (const [name, record] of Object.entries(envs)) {
    if (record === null || typeof record !== "object") return `environments.${name} invalid`;
    const anchored = record.anchored;
    if (
      anchored === null ||
      typeof anchored !== "object" ||
      typeof anchored.head !== "string" ||
      !/^[0-9a-f]{7,40}$/.test(anchored.head) ||
      typeof anchored.date !== "string" ||
      typeof anchored.method !== "string" ||
      anchored.method.length === 0
    )
      return `environments.${name}.anchored invalid (head/date/method required)`;
    const toolchain = record.toolchain;
    if (toolchain === null || typeof toolchain !== "object") return `environments.${name}.toolchain invalid`;
    for (const field of ["node", "zlib", "platform", "identityMode"])
      if (typeof toolchain[field] !== "string" || toolchain[field].length === 0)
        return `environments.${name}.toolchain.${field} missing`;
    const measurements = record.measurements;
    if (measurements === null || typeof measurements !== "object") return `environments.${name}.measurements invalid`;
    for (const key of GUARDED_MEASUREMENTS) {
      const value = measurements[key];
      if (!Number.isInteger(value) || value < 0) return `environments.${name}.measurements.${key} invalid`;
    }
    const counts = record.counts;
    if (counts === null || typeof counts !== "object") return `environments.${name}.counts invalid`;
    for (const key of REPORTED_COUNTS) {
      const value = counts[key];
      if (!Number.isInteger(value) || value < 0) return `environments.${name}.counts.${key} invalid`;
    }
  }
  return null;
}

/**
 * قياس الأسطح من مجلد البناء — تصنيف من البيّنة حصرًا:
 *  - المدخل: سجل isEntry الوحيد بامتداد js (مرآة منطق حارس الميزانية)؛
 *  - رفقاء الإقلاع: غلق imports الساكنة للمدخل (بدون المدخل نفسه)؛
 *  - الكسول: غلق جذور isDynamicEntry عبر imports+dynamicImports مطروحًا منه
 *    غلق الإقلاع (المشترك يُنسب للإقلاع — موثق أعلاه)؛
 *  - كل ملف يُحتسب مرة واحدة، وكل ملف صاعد يجب أن يقع في رسم البيّنة.
 */
export function measureSurfaces(distRoot = DEFAULT_DIST, options = {}) {
  const identity = options.identity !== undefined ? options.identity : buildIdentityFromEnv();
  const resolvedDist = path.resolve(distRoot);
  const manifestPath = path.join(resolvedDist, ".vite", "manifest.json");
  if (!fs.existsSync(manifestPath)) return { error: `MISSING_MANIFEST: ${FAILURE_CODES.MISSING_MANIFEST}` };
  let manifest;
  try {
    manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
  } catch {
    return { error: `INVALID_MANIFEST: ${FAILURE_CODES.INVALID_MANIFEST}` };
  }
  if (manifest === null || typeof manifest !== "object" || Array.isArray(manifest))
    return { error: `INVALID_MANIFEST: ${FAILURE_CODES.INVALID_MANIFEST}` };

  const byFile = new Map();
  for (const rec of Object.values(manifest)) {
    if (rec !== null && typeof rec === "object" && typeof rec.file === "string") byFile.set(rec.file, rec);
  }
  const entryRecords = [...byFile.values()].filter(r => r.isEntry === true && r.file.endsWith(".js"));
  if (entryRecords.length !== 1) return { error: `AMBIGUOUS_ENTRY: ${FAILURE_CODES.AMBIGUOUS_ENTRY}` };
  const entryFile = entryRecords[0].file;

  const resolve = (ref, referer) => {
    const dir = path.posix.dirname(referer);
    const candidates = [ref, ref.startsWith("_") ? ref.slice(1) : null];
    for (const cand of candidates) {
      if (cand === null) continue;
      for (const full of [cand, path.posix.join(dir, cand)]) if (byFile.has(full)) return full;
    }
    const rec = manifest[ref];
    if (rec !== null && typeof rec === "object" && typeof rec.file === "string") return rec.file;
    return null;
  };
  const closure = (roots, followDynamic) => {
    const seen = new Set();
    const stack = [...roots];
    while (stack.length > 0) {
      const cur = stack.pop();
      if (seen.has(cur)) continue;
      seen.add(cur);
      const rec = byFile.get(cur);
      for (const imp of rec.imports ?? []) {
        const resolvedRef = resolve(imp, cur);
        if (resolvedRef === null) return null;
        stack.push(resolvedRef);
      }
      if (followDynamic)
        for (const imp of rec.dynamicImports ?? []) {
          const resolvedRef = resolve(imp, cur);
          if (resolvedRef === null) return null;
          stack.push(resolvedRef);
        }
    }
    return seen;
  };
  const initial = closure([entryFile], false);
  if (initial === null) return { error: `UNRESOLVABLE_REFERENCE: ${FAILURE_CODES.UNRESOLVABLE_REFERENCE}` };
  const dynamicRoots = [...byFile.values()].filter(r => r.isDynamicEntry === true).map(r => r.file);
  const fullDynamic = closure(dynamicRoots, true);
  if (fullDynamic === null) return { error: `UNRESOLVABLE_REFERENCE: ${FAILURE_CODES.UNRESOLVABLE_REFERENCE}` };

  const assetsDir = path.join(resolvedDist, "assets");
  if (!fs.existsSync(assetsDir)) return { error: `MISSING_MANIFEST: missing dist assets: ${assetsDir}` };
  const diskJs = new Set(
    fs
      .readdirSync(assetsDir)
      .filter(name => name.endsWith(".js"))
      .map(name => `assets/${name}`),
  );
  for (const file of [...initial, ...fullDynamic])
    if (file.endsWith(".js") && !diskJs.has(file))
      return { error: `MISSING_EMITTED_FILE: ${file} — ${FAILURE_CODES.MISSING_EMITTED_FILE}` };
  const unaccounted = [...diskJs].filter(f => !initial.has(f) && !fullDynamic.has(f));
  if (unaccounted.length > 0)
    return { error: `UNACCOUNTED_ASSET: ${unaccounted.join(", ")} — ${FAILURE_CODES.UNACCOUNTED_ASSET}` };

  const lazyFiles = [...fullDynamic].filter(f => !initial.has(f) && diskJs.has(f)).sort();
  const initialFiles = [...initial].filter(f => f !== entryFile && diskJs.has(f)).sort();

  /* أسماء التجزئة المعروفة للتطبيع (كل ملفات assets لا المدخل وحده). */
  const knownBasenames = [...diskJs].map(f => path.posix.basename(f));
  const measureFiles = files => {
    let raw = 0;
    let gzipNorm = 0;
    for (const file of files) {
      const buffer = fs.readFileSync(path.join(resolvedDist, file));
      raw += buffer.length;
      gzipNorm += gzipSize(normalizeForGzip(buffer, knownBasenames, identity));
    }
    return { raw, gzipNorm };
  };
  const initialMeasure = measureFiles(initialFiles);
  const lazyMeasure = measureFiles(lazyFiles);
  const entryBuffer = fs.readFileSync(path.join(resolvedDist, entryFile));

  /* سطح عامل الخدمة: sw.js + workbox-*.js في جذر المخرجات (لا يُخزَّن مسبقًا). */
  const swPath = path.join(resolvedDist, "sw.js");
  if (!fs.existsSync(swPath)) return { error: `MISSING_SERVICE_WORKER: ${FAILURE_CODES.MISSING_SERVICE_WORKER}` };
  const rootFiles = fs.readdirSync(resolvedDist);
  const swRuntimeFiles = ["sw.js", ...rootFiles.filter(n => n.startsWith("workbox-") && n.endsWith(".js"))].sort();
  let swRuntimeRawTotal = 0;
  for (const name of swRuntimeFiles) swRuntimeRawTotal += fs.statSync(path.join(resolvedDist, name)).size;

  /* سطح المخزن المسبق: استخراج مداخل precacheAndRoute وحلها بأمان داخل الجذر. */
  const sw = fs.readFileSync(swPath, "utf8");
  const urls = [...sw.matchAll(/\{url:"([^"]+)",revision/g)].map(match => match[1]);
  if (urls.length === 0) return { error: `MALFORMED_PRECACHE: ${FAILURE_CODES.MALFORMED_PRECACHE}` };
  const seen = new Set();
  const duplicates = [];
  let precacheBytesTotal = 0;
  for (const url of urls) {
    if (seen.has(url)) {
      duplicates.push(url);
      continue;
    }
    seen.add(url);
    if (url.startsWith("/") || url.includes("\\") || url.split("/").includes(".."))
      return { error: `PATH_ESCAPE: ${url} — ${FAILURE_CODES.PATH_ESCAPE}` };
    const file = path.resolve(resolvedDist, url);
    if (file !== resolvedDist && !file.startsWith(resolvedDist + path.sep))
      return { error: `PATH_ESCAPE: ${url} — ${FAILURE_CODES.PATH_ESCAPE}` };
    if (!fs.existsSync(file)) return { error: `MISSING_PRECACHE_FILE: ${url} — ${FAILURE_CODES.MISSING_PRECACHE_FILE}` };
    precacheBytesTotal += fs.statSync(file).size;
  }
  /* R8-N1 (إغلاق الجذر 2026-10-10): التكرار عيب يُرفض صادقًا لا حالة تُقاس
   * فوقها — المسار الواحد الكنوني لا يُنتج تكرارًا، وعودته انحدار إعداد. */
  if (duplicates.length > 0)
    return {
      error:
        `DUPLICATE_PRECACHE_URLS: ${duplicates.length} duplicate precache URL(s) in sw.js ` +
        `[${duplicates.join(", ")}] — ${FAILURE_CODES.DUPLICATE_PRECACHE_URLS}`,
    };

  return {
    environment: options.environment,
    entry: { file: entryFile, rawBytes: entryBuffer.length, gzipBytes: gzipSize(entryBuffer) },
    measurements: {
      initialRawTotal: initialMeasure.raw,
      initialGzipNormTotal: initialMeasure.gzipNorm,
      lazyRawTotal: lazyMeasure.raw,
      lazyGzipNormTotal: lazyMeasure.gzipNorm,
      precacheBytesTotal,
      swRuntimeRawTotal,
    },
    counts: {
      lazyJsCount: lazyFiles.length,
      initialJsCount: initialFiles.length,
      dynamicRootsCount: dynamicRoots.length,
      precacheEntryCount: seen.size,
      swRuntimeFileCount: swRuntimeFiles.length,
    },
    normalization: {
      mode: identity === null ? "hash-names" : "hash-names+identity",
    },
  };
}

/**
 * المقارنة ضد سجل البيئة: النمو فوق (الأساس + السماحية الموثقة) = فشل؛
 * المساواة تجوز؛ التقليص يُبلَّغ بقفل المكسب في نفس الـPR.
 */
export function compareSurfaces(measured, environmentRecord, tolerances = DEFAULT_TOLERANCES) {
  const failures = [];
  const reports = [];
  const labels = {
    initialRawTotal: ["initial companions raw", tolerances.raw],
    initialGzipNormTotal: ["initial companions gzip (normalized)", tolerances.gzip],
    lazyRawTotal: ["lazy JS raw", tolerances.raw],
    lazyGzipNormTotal: ["lazy JS gzip (normalized)", tolerances.gzip],
    precacheBytesTotal: ["PWA precache raw", tolerances.raw],
    swRuntimeRawTotal: ["service-worker runtime raw", tolerances.raw],
  };
  const base = environmentRecord.measurements;
  for (const key of GUARDED_MEASUREMENTS) {
    const current = measured.measurements[key];
    const baselineValue = base[key];
    const [label, tolerance] = labels[key];
    if (current > baselineValue + tolerance) {
      failures.push(
        `SURFACE_GROWTH ${key}: ${current} > baseline ${baselineValue}+${tolerance} (${label}) — ` +
          `reduce the cost, or re-anchor with provenance in the same PR per the documented protocol`,
      );
    } else if (current < baselineValue) {
      reports.push(`${key}: ${current} < baseline ${baselineValue} (${label} — improvement; lock it by updating the baseline in this PR)`);
    }
  }
  for (const key of REPORTED_COUNTS) {
    const current = measured.counts[key];
    const baselineCount = environmentRecord.counts[key];
    reports.push(`${key}: ${current} (recorded; baseline ${baselineCount})`);
  }
  return { failures, reports };
}

function toolchainIdentity(identity) {
  return {
    node: process.version,
    zlib: process.versions.zlib ?? "unknown",
    platform: `${process.platform}/${process.arch}`,
    identityMode: identity === null ? "null-fallback" : "env",
  };
}

function main() {
  const distRoot = process.argv[2] ? path.resolve(process.argv[2]) : DEFAULT_DIST;
  const environment = detectEnvironment();
  const identity = buildIdentityFromEnv();
  if (environment === null) {
    console.error(`check-bundle-surfaces: FAIL UNVERIFIED_ENVIRONMENT — ${FAILURE_CODES.UNVERIFIED_ENVIRONMENT}`);
    return 1;
  }
  const measured = measureSurfaces(distRoot, { environment, identity });
  if (measured.error) {
    console.error(`check-bundle-surfaces: FAIL — ${measured.error}`);
    return 1;
  }
  const prefix = "check-bundle-surfaces:";
  console.log(
    `${prefix} ENV=${environment} node=${process.version} zlib=${process.versions.zlib ?? "unknown"} ` +
      `platform=${process.platform}/${process.arch} identity=${identity === null ? "null" : "env"} ` +
      `gzip=${measured.normalization.mode}`,
  );
  console.log(
    `${prefix} entry=${measured.entry.file} raw=${measured.entry.rawBytes} gzip=${measured.entry.gzipBytes} ` +
      `(reported only — check-bundle-budget owns the 650,000/155,300 ceilings)`,
  );
  let baseline;
  try {
    baseline = readBaseline();
  } catch (error) {
    console.error(`${prefix} FAIL INVALID_BASELINE — ${FAILURE_CODES.INVALID_BASELINE} (${error.message})`);
    return 1;
  }
  const schemaError = validateBaseline(baseline);
  if (schemaError !== null) {
    console.error(`${prefix} FAIL INVALID_BASELINE — ${schemaError}`);
    return 1;
  }
  const tolerances = baseline.tolerances ?? DEFAULT_TOLERANCES;
  const record = baseline.environments[environment];
  if (record === undefined) {
    console.log(
      `${prefix} ANCHOR_RECORD ${JSON.stringify({
        environment,
        toolchain: toolchainIdentity(identity),
        measurements: measured.measurements,
        counts: measured.counts,
        normalization: measured.normalization.mode,
      })}`,
    );
    console.error(
      `${prefix} FAIL UNANCHORED_ENVIRONMENT — ${FAILURE_CODES.UNANCHORED_ENVIRONMENT} ` +
        `(anchor the printed record with head/date/method provenance, then re-run)`,
    );
    return 1;
  }
  const { failures, reports } = compareSurfaces(measured, record, tolerances);
  for (const line of reports) console.log(`${prefix} ${line}`);
  if (failures.length > 0) {
    for (const line of failures) console.error(`${prefix} FAIL ${line}`);
    return 1;
  }
  console.log(
    `${prefix} PASS — entry ${measured.entry.rawBytes}/${measured.entry.gzipBytes} (reported); ` +
      `initial ${measured.counts.initialJsCount} (${measured.measurements.initialRawTotal} raw / ${measured.measurements.initialGzipNormTotal} gzipNorm); ` +
      `lazy ${measured.counts.lazyJsCount} (${measured.measurements.lazyRawTotal} raw / ${measured.measurements.lazyGzipNormTotal} gzipNorm); ` +
      `precache ${measured.counts.precacheEntryCount} (${measured.measurements.precacheBytesTotal} bytes); ` +
      `swRuntime ${measured.counts.swRuntimeFileCount} (${measured.measurements.swRuntimeRawTotal} bytes) — ` +
      `within the ${environment} baseline (tolerances raw +${tolerances.raw} / gzip +${tolerances.gzip})`,
  );
  return 0;
}

const invokedDirectly =
  process.argv[1] !== undefined && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (invokedDirectly) {
  process.exit(main());
}
