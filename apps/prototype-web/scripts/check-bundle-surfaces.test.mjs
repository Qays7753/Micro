/**
 * R8 (R8-F-020 + R7-CF-REPAIR، 2026-10-10): اختبارات حارس أسطح الحزمة
 * القائم على البيّنة والبيئة — حتمية بلا شبكة: عينات تُبنى في مجلدات مؤقتة
 * تحاكي بنية البناء (بيّنة + أصول + sw) وتُمسح بعد الاختبار.
 *
 * تغطي العقد الكامل: التصنيف من البيّنة (مدخل غير مُسمّى index-* يُصنف
 * مدخلًا؛ شظية مُسمّاة index-* ليست مدخلًا)، غلق الساكن مقابل الديناميكي،
 * الشظايا المشتركة مرة واحدة، الديناميكي المتداخل، صفر/مدخل واحد/غامض،
 * البيّنة الغائبة/التالفة/الناقصة، إفلات المسارات، الملفات المفقودة، عامل
 * الخدمة والمخزن المسبق (تالف/ناقص/مكرر)، دلالات الخام+gzip والتطبيع،
 * البيئة (مجهولة/غير مرسّاة)، سلوك السماحيات، فشل النمو الصامت، التكافؤ
 * والتقليص الموثق، وصلاحية الأساس الحي المُلتزم.
 */
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import { afterAll, describe, expect, it } from "vitest";
import {
  DEFAULT_TOLERANCES,
  GUARDED_MEASUREMENTS,
  REPORTED_COUNTS,
  buildIdentityFromEnv,
  compareSurfaces,
  detectEnvironment,
  gzipSize,
  measureSurfaces,
  normalizeForGzip,
  readBaseline,
  validateBaseline,
} from "./check-bundle-surfaces.mjs";

const SCRIPT_PATH = fileURLToPath(import.meta.url).replace(
  /check-bundle-surfaces\.test\.mjs$/,
  "check-bundle-surfaces.mjs",
);

const tempDirs = [];
function makeTempDir() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "micro-surfaces-"));
  tempDirs.push(dir);
  return dir;
}
afterAll(() => {
  for (const dir of tempDirs) fs.rmSync(dir, { recursive: true, force: true });
});

/**
 * باني عينات حتمي: يبني شجرة مخرجات كاملة من وصف بيان (records) وملفات.
 * records: مصفوفة {key, file, isEntry?, isDynamicEntry?, imports?,
 * dynamicImports?} حيث المراجع أسماء ملفات صادرة (أو أسماء facade بشرطة
 * سفلية) كما تظهرها بيّنة Vite الحقيقية.
 */
function seedDist(root, { records, contents = {}, precacheUrls = null, swRuntime = true }) {
  const assets = path.join(root, "assets");
  fs.mkdirSync(assets, { recursive: true });
  fs.mkdirSync(path.join(root, ".vite"), { recursive: true });
  const manifest = {};
  for (const rec of records) {
    manifest[rec.key] = {
      file: rec.file,
      ...(rec.isEntry ? { isEntry: true } : {}),
      ...(rec.isDynamicEntry ? { isDynamicEntry: true } : {}),
      ...(rec.imports ? { imports: rec.imports } : {}),
      ...(rec.dynamicImports ? { dynamicImports: rec.dynamicImports } : {}),
    };
  }
  fs.writeFileSync(path.join(root, ".vite", "manifest.json"), JSON.stringify(manifest));
  for (const [name, content] of Object.entries(contents)) {
    const target = path.join(root, name);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, content);
  }
  if (swRuntime) fs.writeFileSync(path.join(root, "workbox-2fbc6a65.js"), "self WB runtime");
  const urls =
    precacheUrls ??
    [
      ...new Set(
        records.filter(r => !r.key.startsWith("_")).map(r => r.file),
      ),
      "index.html",
    ];
  const entries = urls.map(url => `{url:"${url}",revision:null}`).join(",");
  fs.writeFileSync(path.join(root, "sw.js"), `self.precacheAndRoute([${entries}]);`);
  if ((precacheUrls ?? null) === null || precacheUrls.includes("index.html"))
    fs.writeFileSync(path.join(root, "index.html"), "<html></html>");
  return root;
}

/** عينة مرجعية: مدخل app-main (ليس index-*) + شظية مشتركة + كسول متداخل. */
function referenceDist(root) {
  return seedDist(root, {
    records: [
      { key: "index.html", file: "assets/app-main-aBcD3f9h.js", isEntry: true, imports: ["assets/shared-xyZ12wQ9.js"] },
      { key: "_shared", file: "assets/shared-xyZ12wQ9.js" },
      { key: "route", file: "assets/index-Q1w2e3r4.js", isDynamicEntry: true, dynamicImports: ["assets/deep-t5y6u7i8.js"], imports: ["assets/shared-xyZ12wQ9.js"] },
      { key: "_deep", file: "assets/deep-t5y6u7i8.js" },
    ],
    contents: {
      "assets/app-main-aBcD3f9h.js": 'console.log("entry");import"./shared-xyZ12wQ9.js";',
      "assets/shared-xyZ12wQ9.js": "export const s=1;",
      "assets/index-Q1w2e3r4.js": 'import"./shared-xyZ12wQ9.js";export const r=2;',
      "assets/deep-t5y6u7i8.js": "export const d=3;",
    },
  });
}

/** بيئة فرعية مضبوطة بالكامل: تُنظّف مؤشرات البيئة الموروثة (في CI يرث
 * الإجراء GITHUB_ACTIONS وGITHUB_SHA فتفسد حتمية اختبارات CLI) قبل تطبيق
 * التجاوزات الصريحة لكل حالة. */
function runCli(args, env = {}) {
  const clean = { ...process.env };
  for (const key of [
    "CI",
    "GITHUB_ACTIONS",
    "GITHUB_SHA",
    "CF_PAGES",
    "CF_PAGES_COMMIT_SHA",
    "GITLAB_CI",
    "JENKINS_URL",
    "TEAMCITY_VERSION",
    "VITE_APP_VERSION",
  ])
    delete clean[key];
  return spawnSync(process.execPath, [SCRIPT_PATH, ...args], {
    encoding: "utf8",
    env: { ...clean, ...env },
  });
}

describe("environment and identity detection", () => {
  it("cloudflare-pages wins, then github-actions, then local; bare CI markers are unverified", () => {
    expect(detectEnvironment({ CF_PAGES: "1" })).toBe("cloudflare-pages");
    expect(detectEnvironment({ CF_PAGES_COMMIT_SHA: "abc123" })).toBe("cloudflare-pages");
    expect(detectEnvironment({ GITHUB_ACTIONS: "true" })).toBe("github-actions");
    expect(detectEnvironment({ CF_PAGES: "1", GITHUB_ACTIONS: "true" })).toBe("cloudflare-pages");
    expect(detectEnvironment({})).toBe("local");
    expect(detectEnvironment({ CI: "true" })).toBeNull();
    expect(detectEnvironment({ GITLAB_CI: "true" })).toBeNull();
    expect(detectEnvironment({ CI: "false" })).toBe("local");
  });

  it("build identity follows the vite.config priority: explicit, GitHub, Pages, none", () => {
    expect(buildIdentityFromEnv({ VITE_APP_VERSION: " v9 ", GITHUB_SHA: "g" })).toBe("v9");
    expect(buildIdentityFromEnv({ GITHUB_SHA: "g", CF_PAGES_COMMIT_SHA: "p" })).toBe("g");
    expect(buildIdentityFromEnv({ CF_PAGES_COMMIT_SHA: "p" })).toBe("p");
    expect(buildIdentityFromEnv({})).toBeNull();
  });
});

describe("deterministic gzip normalization", () => {
  it("canonicalizes known hashed filenames — including hashes that contain hyphens", () => {
    const buffer = Buffer.from('import"./Finance-Cc-BgvGT.js";import"./react-runtime-D-o6Z9it.js"');
    const out = normalizeForGzip(buffer, ["Finance-Cc-BgvGT.js", "react-runtime-D-o6Z9it.js"], null);
    expect(out.toString()).toContain('import"./Finance-00000000.js"');
    expect(out.toString()).toContain('import"./react-runtime-00000000.js"');
  });

  it("neutralizes the build identity when known and leaves unknown identities untouched", () => {
    const buffer = Buffer.from('const id="aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";');
    const out = normalizeForGzip(buffer, [], "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa");
    expect(out.toString()).toContain('"IIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIII"');
    const untouched = normalizeForGzip(buffer, [], "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb");
    expect(untouched.equals(buffer)).toBe(true);
  });

  it("two builds differing only in hash names measure identical normalized gzip", () => {
    const a = Buffer.from('import"./chunk-AAAAAAAA.js";export const x=1;');
    const b = Buffer.from('import"./chunk-aB3xY9kQ.js";export const x=1;');
    const normA = normalizeForGzip(a, ["chunk-AAAAAAAA.js"], null);
    const normB = normalizeForGzip(b, ["chunk-aB3xY9kQ.js"], null);
    expect(gzipSize(normA)).toBe(gzipSize(normB));
    expect(gzipSize(a) === gzipSize(b)).toBe(false);
  });
});

describe("manifest-based classification (R8-F-020)", () => {
  it("an entry NOT named index-* is classified as the entry; an index-* dynamic chunk is lazy", () => {
    const measured = measureSurfaces(referenceDist(makeTempDir()), { identity: null });
    expect(measured.error).toBeUndefined();
    expect(measured.entry.file).toBe("assets/app-main-aBcD3f9h.js");
    /* index-Q1w2e3r4.js (dynamic entry) وdeep كلاهما كسول — لا استبعاد بالاسم. */
    expect(measured.counts.lazyJsCount).toBe(2);
    expect(measured.counts.initialJsCount).toBe(1);
    expect(measured.counts.dynamicRootsCount).toBe(1);
  });

  it("static entry imports form the initial closure; shared chunks are counted once and assigned to initial", () => {
    const measured = measureSurfaces(referenceDist(makeTempDir()), { identity: null });
    /* shared-xyZ12wQ9.js مستورد ساكنًا من المدخل ومن الجذر الديناميكي معًا:
     * يُنسب للإقلاع (القاعدة الموثقة) ويُحتسب مرة واحدة. */
    expect(measured.measurements.initialRawTotal).toBe(Buffer.byteLength("export const s=1;"));
    expect(measured.measurements.lazyRawTotal).toBe(
      Buffer.byteLength('import"./shared-xyZ12wQ9.js";export const r=2;') + Buffer.byteLength("export const d=3;"),
    );
  });

  it("nested dynamic imports are followed transitively", () => {
    const root = seedDist(makeTempDir(), {
      records: [
        { key: "index.html", file: "assets/e-12345678.js", isEntry: true },
        { key: "r1", file: "assets/r1-87654321.js", isDynamicEntry: true, dynamicImports: ["assets/r2-11112222.js"] },
        { key: "r2", file: "assets/r2-11112222.js", dynamicImports: ["assets/r3-33334444.js"], imports: ["assets/r4-55556666.js"] },
        { key: "r3", file: "assets/r3-33334444.js" },
        { key: "r4", file: "assets/r4-55556666.js" },
      ],
      contents: {
        "assets/e-12345678.js": "e",
        "assets/r1-87654321.js": "1",
        "assets/r2-11112222.js": "2",
        "assets/r3-33334444.js": "3",
        "assets/r4-55556666.js": "4",
      },
    });
    const measured = measureSurfaces(root, { identity: null });
    expect(measured.error).toBeUndefined();
    expect(measured.counts.lazyJsCount).toBe(4);
    expect(measured.counts.initialJsCount).toBe(0);
  });

  it("zero or multiple entries fail honestly, and so do missing/invalid manifests", () => {
    const zero = seedDist(makeTempDir(), {
      records: [{ key: "r", file: "assets/r-12345678.js", isDynamicEntry: true }],
      contents: { "assets/r-12345678.js": "r" },
    });
    expect(measureSurfaces(zero, { identity: null }).error).toContain("AMBIGUOUS_ENTRY");
    const two = seedDist(makeTempDir(), {
      records: [
        { key: "a", file: "assets/a-12345678.js", isEntry: true },
        { key: "b", file: "assets/b-12345678.js", isEntry: true },
      ],
      contents: { "assets/a-12345678.js": "a", "assets/b-12345678.js": "b" },
    });
    expect(measureSurfaces(two, { identity: null }).error).toContain("AMBIGUOUS_ENTRY");
    const noManifest = makeTempDir();
    fs.mkdirSync(path.join(noManifest, "assets"), { recursive: true });
    expect(measureSurfaces(noManifest, { identity: null }).error).toContain("MISSING_MANIFEST");
    const broken = referenceDist(makeTempDir());
    fs.writeFileSync(path.join(broken, ".vite", "manifest.json"), "{not json");
    expect(measureSurfaces(broken, { identity: null }).error).toContain("INVALID_MANIFEST");
  });

  it("a manifest file missing from the output and an unaccounted emitted asset both fail", () => {
    const missing = referenceDist(makeTempDir());
    fs.rmSync(path.join(missing, "assets", "deep-t5y6u7i8.js"));
    expect(measureSurfaces(missing, { identity: null }).error).toContain("MISSING_EMITTED_FILE");
    const stray = referenceDist(makeTempDir());
    fs.writeFileSync(path.join(stray, "assets", "stray-99999999.js"), "ghost");
    expect(measureSurfaces(stray, { identity: null }).error).toContain("UNACCOUNTED_ASSET");
  });
});

describe("precache and service-worker surfaces", () => {
  it("missing service worker and malformed precache fail; duplicates are counted once and reported", () => {
    const noSw = referenceDist(makeTempDir());
    fs.rmSync(path.join(noSw, "sw.js"));
    expect(measureSurfaces(noSw, { identity: null }).error).toContain("MISSING_SERVICE_WORKER");
    const malformed = referenceDist(makeTempDir());
    fs.writeFileSync(path.join(malformed, "sw.js"), "self.addEventListener('install',()=>{});");
    expect(measureSurfaces(malformed, { identity: null }).error).toContain("MALFORMED_PRECACHE");
    const dup = referenceDist(makeTempDir());
    const sw = fs.readFileSync(path.join(dup, "sw.js"), "utf8");
    fs.writeFileSync(path.join(dup, "sw.js"), sw.replace("}]);", '},{url:"index.html",revision:null}]);'));
    const measured = measureSurfaces(dup, { identity: null });
    expect(measured.error).toBeUndefined();
    expect(measured.normalization.duplicatePrecacheUrls).toEqual(["index.html"]);
    /* المداخل الخام ٤ (تكرار index.html) والمقاسة الفريدة ٣ — المرصودة كعدّ. */
    expect(measured.counts.precacheEntryCount).toBe(3);
  });

  it("path escapes and missing precache files fail closed", () => {
    const escape = referenceDist(makeTempDir());
    const sw = fs.readFileSync(path.join(escape, "sw.js"), "utf8");
    fs.writeFileSync(path.join(escape, "sw.js"), sw + '{url:"../../etc/passwd",revision:null},');
    expect(measureSurfaces(escape, { identity: null }).error).toContain("PATH_ESCAPE");
    const absolute = referenceDist(makeTempDir());
    const sw2 = fs.readFileSync(path.join(absolute, "sw.js"), "utf8");
    fs.writeFileSync(path.join(absolute, "sw.js"), sw2 + '{url:"/etc/passwd",revision:null},');
    expect(measureSurfaces(absolute, { identity: null }).error).toContain("PATH_ESCAPE");
    const ghost = referenceDist(makeTempDir());
    const sw3 = fs.readFileSync(path.join(ghost, "sw.js"), "utf8");
    fs.writeFileSync(path.join(ghost, "sw.js"), sw3 + '{url:"ghost-12345678.js",revision:null},');
    expect(measureSurfaces(ghost, { identity: null }).error).toContain("MISSING_PRECACHE_FILE");
  });

  it("sw.js and the workbox runtime are measured as the sw-runtime surface", () => {
    const measured = measureSurfaces(referenceDist(makeTempDir()), { identity: null });
    const swSize = fs.statSync(path.join(tempDirs[tempDirs.length - 1], "sw.js")).size;
    const wbSize = fs.statSync(path.join(tempDirs[tempDirs.length - 1], "workbox-2fbc6a65.js")).size;
    expect(measured.measurements.swRuntimeRawTotal).toBe(swSize + wbSize);
    expect(measured.counts.swRuntimeFileCount).toBe(2);
  });
});

describe("comparison, tolerances, and growth (R7-CF-REPAIR semantics)", () => {
  const record = () => ({
    measurements: {
      initialRawTotal: 100,
      initialGzipNormTotal: 50,
      lazyRawTotal: 1000,
      lazyGzipNormTotal: 500,
      precacheBytesTotal: 2000,
      swRuntimeRawTotal: 300,
    },
    counts: {
      lazyJsCount: 10,
      initialJsCount: 1,
      dynamicRootsCount: 5,
      precacheEntryCount: 20,
      swRuntimeFileCount: 2,
    },
  });
  const measuredFrom = (measurementOver, countOver = {}) => ({
    measurements: { ...record().measurements, ...measurementOver },
    counts: { ...record().counts, ...countOver },
  });

  it("parity passes; growth beyond baseline+tolerance fails with exact values", () => {
    const { failures } = compareSurfaces(measuredFrom({}), record());
    expect(failures).toHaveLength(0);
    const grown = compareSurfaces(measuredFrom({ lazyRawTotal: 1009 }), record());
    expect(grown.failures).toHaveLength(1);
    expect(grown.failures[0]).toContain("SURFACE_GROWTH lazyRawTotal: 1009 > baseline 1000+8");
    /* داخل السماحية الموثقة (±8 خام / ±16 gzip) = مقبول — ليست نموًا صامتًا. */
    const within = compareSurfaces(measuredFrom({ lazyRawTotal: 1008, lazyGzipNormTotal: 516 }), record());
    expect(within.failures).toHaveLength(0);
    const gzipGrown = compareSurfaces(measuredFrom({ lazyGzipNormTotal: 517 }), record());
    expect(gzipGrown.failures[0]).toContain("SURFACE_GROWTH lazyGzipNormTotal: 517 > baseline 500+16");
  });

  it("reduction is reported with lock-it guidance; counts are recorded not guarded", () => {
    const { failures, reports } = compareSurfaces(
      measuredFrom({ precacheBytesTotal: 1900 }, { lazyJsCount: 12 }),
      record(),
    );
    expect(failures).toHaveLength(0);
    expect(reports.some(line => line.includes("precacheBytesTotal: 1900 < baseline 2000"))).toBe(true);
    expect(reports.some(line => line.includes("lazyJsCount: 12 (recorded; baseline 10)"))).toBe(true);
  });

  it("every guarded measurement and reported count has a canonical key set", () => {
    expect(GUARDED_MEASUREMENTS).toHaveLength(6);
    expect(REPORTED_COUNTS).toHaveLength(5);
    expect(DEFAULT_TOLERANCES).toEqual({ raw: 8, gzip: 16 });
  });
});

describe("baseline schema v2 validation (fail-closed)", () => {
  const validRecord = () => ({
    anchored: { head: "1e2678645d3c41beb448da2a0d8d2b5d817a18fe", date: "2026-10-10", method: "test" },
    toolchain: { node: "v24", zlib: "1.3", platform: "linux/x64", identityMode: "null-fallback" },
    measurements: {
      initialRawTotal: 1,
      initialGzipNormTotal: 1,
      lazyRawTotal: 1,
      lazyGzipNormTotal: 1,
      precacheBytesTotal: 1,
      swRuntimeRawTotal: 1,
    },
    counts: { lazyJsCount: 1, initialJsCount: 1, dynamicRootsCount: 1, precacheEntryCount: 1, swRuntimeFileCount: 1 },
  });
  const validBaseline = () => ({
    version: 2,
    schema: "micro-bundle-surfaces/2",
    tolerances: { raw: 8, gzip: 16 },
    environments: { local: validRecord() },
  });

  it("accepts a valid baseline and rejects every malformed variant", () => {
    expect(validateBaseline(validBaseline())).toBeNull();
    expect(validateBaseline({ ...validBaseline(), version: 1 })).toContain("version");
    expect(validateBaseline({ ...validBaseline(), schema: "other" })).toContain("schema");
    expect(validateBaseline({ ...validBaseline(), environments: { staging: validRecord() } })).toContain("unknown environment");
    expect(
      validateBaseline({ ...validBaseline(), tolerances: { raw: 17, gzip: 16 } }),
    ).toContain("guard weakening rejected");
    expect(
      validateBaseline({ ...validBaseline(), tolerances: { raw: 8, gzip: 257 } }),
    ).toContain("guard weakening rejected");
    const missingAnchor = validBaseline();
    delete missingAnchor.environments.local.anchored.head;
    expect(validateBaseline(missingAnchor)).toContain("anchored invalid");
    const badMeasurement = validBaseline();
    badMeasurement.environments.local.measurements.lazyRawTotal = -1;
    expect(validateBaseline(badMeasurement)).toContain("lazyRawTotal invalid");
    const missingCount = validBaseline();
    delete missingCount.environments.local.counts.precacheEntryCount;
    expect(validateBaseline(missingCount)).toContain("precacheEntryCount invalid");
    expect(validateBaseline(null)).toContain("not an object");
  });

  it("the committed live baseline is schema-valid with anchored environment records", () => {
    const baseline = readBaseline();
    expect(validateBaseline(baseline)).toBeNull();
    expect(Object.keys(baseline.environments).length).toBeGreaterThanOrEqual(2);
    for (const record of Object.values(baseline.environments))
      expect(record.anchored.method.length).toBeGreaterThan(0);
  });
});

describe("CLI behavior (deterministic paths only)", () => {
  it("fails on an absent dist root and on an unidentifiable environment, before any measurement", () => {
    const missing = runCli([path.join(os.tmpdir(), "micro-surfaces-missing-xyz")]);
    expect(missing.status).toBe(1);
    expect(missing.stderr).toContain("MISSING_MANIFEST");
    const unverified = runCli([path.join(os.tmpdir(), "micro-surfaces-missing-xyz")], { CI: "true" });
    expect(unverified.status).toBe(1);
    expect(unverified.stderr).toContain("UNVERIFIED_ENVIRONMENT");
  });
});
