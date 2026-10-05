/**
 * W8 (برنامج الإكمال ما بعد المسح — 2026-10-05): اختبارات حارس أسطح الحزمة
 * (الشظايا الكسولة + مخزن PWA المسبق) — حتمية بلا شبكة: عينات تُبنى في
 * مجلدات مؤقتة تحاكي بنية البناء وتُمسح بعد الاختبار.
 *
 * تغطي: القياس (عد/بايتات خام+gzip/مداخل المخزن/الملفات المفقودة)، المقارنة
 * (نمو فوق الأساس يفشل؛ المساواة تجوز؛ التقليص ينجح مع توصية قفل المكسب)،
 * وسلوك CLI (بيئة ناقصة = فشل صادق).
 */
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import { afterAll, describe, expect, it } from "vitest";
import { compareSurfaces, gzipSize, measureSurfaces, readBaseline } from "./check-bundle-surfaces.mjs";

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

function seedDist(root, { lazyChunks, entryBytes = 100, precacheExtra = [] }) {
  const assets = path.join(root, "assets");
  fs.mkdirSync(assets, { recursive: true });
  fs.writeFileSync(path.join(assets, "index-test123.js"), "console.log('entry');");
  const urls = ["assets/index-test123.js"];
  for (const [name, bytes] of lazyChunks) {
    fs.writeFileSync(path.join(assets, name), "x".repeat(bytes));
    urls.push(`assets/${name}`);
  }
  const manifestEntries = urls
    .concat(precacheExtra)
    .map(url => `{url:"${url}",revision:null}`)
    .join(",");
  fs.writeFileSync(path.join(root, "sw.js"), `self.precacheAndRoute([${manifestEntries}]);`);
  return root;
}

function runCli(...args) {
  return spawnSync(process.execPath, [SCRIPT_PATH, ...args], { encoding: "utf8" });
}

describe("check-bundle-surfaces — measurement", () => {
  it("measures lazy chunk counts, raw and gzip bytes, and precache totals", () => {
    const root = seedDist(makeTempDir(), {
      lazyChunks: [
        ["Home-abc.js", 1000],
        ["Finance-def.js", 500],
      ],
      precacheExtra: ["index.html"],
    });
    fs.writeFileSync(path.join(root, "index.html"), "<html></html>");
    const measured = measureSurfaces(root);
    expect(measured.error).toBeUndefined();
    expect(measured.lazyJsCount).toBe(2);
    expect(measured.lazyRawTotal).toBe(1500);
    const expectedGzip = gzipSize(Buffer.from("x".repeat(1000))) + gzipSize(Buffer.from("x".repeat(500)));
    expect(measured.lazyGzipTotal).toBe(expectedGzip);
    expect(measured.precacheEntryCount).toBe(4);
    expect(measured.precacheBytesTotal).toBe(1500 + 21 + 13);
  });

  it("fails honestly when the dist tree or precache files are missing", () => {
    const empty = makeTempDir();
    expect(measureSurfaces(empty).error).toContain("missing dist assets");
    const noSw = seedDist(makeTempDir(), { lazyChunks: [] });
    fs.rmSync(path.join(noSw, "sw.js"));
    expect(measureSurfaces(noSw).error).toContain("missing service worker");
    const broken = seedDist(makeTempDir(), { lazyChunks: [], precacheExtra: ["ghost.js"] });
    expect(measureSurfaces(broken).error).toContain("precache references missing files");
  });
});

describe("check-bundle-surfaces — ratchet comparison", () => {
  it("fails on silent growth beyond the baseline", () => {
    const baseline = {
      lazyJsCount: 2,
      lazyRawTotal: 1500,
      lazyGzipTotal: 400,
      precacheEntryCount: 3,
      precacheBytesTotal: 1600,
    };
    const grown = {
      lazyJsCount: 3,
      lazyRawTotal: 1600,
      lazyGzipTotal: 400,
      precacheEntryCount: 3,
      precacheBytesTotal: 1600,
    };
    const { failures } = compareSurfaces(grown, baseline);
    expect(failures).toHaveLength(1);
    expect(failures[0]).toContain("SURFACE_GROWTH lazyRawTotal");
  });

  it("passes at parity and on reduction (with lock-it guidance), reporting counts", () => {
    const baseline = {
      lazyJsCount: 2,
      lazyRawTotal: 1500,
      lazyGzipTotal: 400,
      precacheEntryCount: 3,
      precacheBytesTotal: 1600,
    };
    const same = {
      lazyJsCount: 4,
      lazyRawTotal: 1500,
      lazyGzipTotal: 390,
      precacheEntryCount: 5,
      precacheBytesTotal: 1500,
    };
    const { failures, reports } = compareSurfaces(same, baseline);
    expect(failures).toHaveLength(0);
    expect(reports.some(line => line.includes("improvement"))).toBe(true);
    expect(reports.some(line => line.startsWith("lazyJsCount: 4"))).toBe(true);
  });

  it("the committed live baseline parses with all five fields", () => {
    const baseline = readBaseline();
    for (const key of [
      "lazyJsCount",
      "lazyRawTotal",
      "lazyGzipTotal",
      "precacheEntryCount",
      "precacheBytesTotal",
    ]) {
      expect(typeof baseline[key]).toBe("number");
    }
  });
});

describe("check-bundle-surfaces — CLI behavior", () => {
  it("fails with MISSING_BUILD on an absent dist root", () => {
    const result = runCli(path.join(os.tmpdir(), "micro-surfaces-missing-xyz"));
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("MISSING_BUILD");
  });
});
