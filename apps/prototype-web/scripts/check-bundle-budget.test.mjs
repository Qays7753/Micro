/**
 * D-034 (المجموعة ٤): اختبارات بوابة ميزانية الحزمة — حتمية بالكامل عبر
 * أدلة مؤقتة وبيانات مولدة ببذرة ثابتة (xorshift32)، بلا شبكة ولا نوم ولا
 * عشوائية. تغطي: النجاح، تجاوز كل سقف على حدة، المخرجات الناقصة/الغامضة/
 * القديمة، تعدد البايت، ثبات الاختيار عند تغير التجزئة، حدود السقف
 * بالضبط (== يمر، +١ يفشل)، وسلوك CLI (أكواد الخروج ورفض تمرير حدود).
 */
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import process from "node:process";
import zlib from "node:zlib";
import { fileURLToPath } from "node:url";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  APP_ROOT,
  DEFAULT_DIST_DIR,
  GZIP_BYTE_LIMIT,
  GZIP_LEVEL,
  RAW_BYTE_LIMIT,
  checkBundleBudget,
  htmlScriptSources,
  measureBundle,
  selectEntry,
} from "./check-bundle-budget.mjs";

const CHECKER_PATH = fileURLToPath(import.meta.url).replace(
  /check-bundle-budget\.test\.mjs$/,
  "check-bundle-budget.mjs",
);

const tempDirs = [];
function makeTempDir() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "micro-bundle-budget-"));
  tempDirs.push(dir);
  return dir;
}
afterAll(() => {
  for (const dir of tempDirs) fs.rmSync(dir, { recursive: true, force: true });
});

/** مولد حتمي بلا عشوائية: xorshift32 ببذرة ثابتة — بيانات غير قابلة للضغط. */
function seededBytes(length) {
  const bytes = Buffer.alloc(length);
  let state = 0x9e3779b9;
  for (let index = 0; index < length; index += 1) {
    state ^= state << 13;
    state ^= state >>> 17;
    state ^= state << 5;
    state >>>= 0;
    bytes[index] = state & 0xff;
  }
  return bytes;
}

function compressibleBytes(length) {
  return Buffer.alloc(length, 0x61);
}

function writeFixture(distDir, { entryFile = "assets/index-TESTHASH.js", content, htmlScripts = null }) {
  fs.mkdirSync(path.join(distDir, ".vite"), { recursive: true });
  fs.mkdirSync(path.join(distDir, "assets"), { recursive: true });
  const entryPath = path.join(distDir, entryFile);
  fs.writeFileSync(entryPath, content);
  const posixEntry = entryFile.split(path.sep).join("/");
  const scripts =
    htmlScripts === null
      ? [`<script type="module" crossorigin src="/${posixEntry}"></script>`]
      : htmlScripts;
  const html = `<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8">${scripts.join("")}</head><body><div id="root"></div></body></html>`;
  fs.writeFileSync(path.join(distDir, "index.html"), html);
  fs.writeFileSync(
    path.join(distDir, ".vite", "manifest.json"),
    JSON.stringify({ "index.html": { file: posixEntry, src: "index.html", isEntry: true } }),
  );
  return { entryPath, posixEntry };
}

describe("check-bundle-budget — fixtures and failure matrix", () => {
  it("passes an under-budget build and reports exact byte measurements", () => {
    const distDir = makeTempDir();
    const content = compressibleBytes(1000);
    writeFixture(distDir, { content });
    const result = checkBundleBudget(distDir);
    if (!result.ok) throw new Error(result.message);
    expect(result.entry).toBe("assets/index-TESTHASH.js");
    expect(result.rawBytes).toBe(1000);
    expect(result.gzipBytes).toBe(zlib.gzipSync(content, { level: GZIP_LEVEL }).length);
  });

  it("fails with RAW_OVER when raw bytes exceed the limit (boundary: limit passes, +1 fails)", () => {
    const passing = makeTempDir();
    writeFixture(passing, { content: compressibleBytes(RAW_BYTE_LIMIT) });
    expect(checkBundleBudget(passing)).toMatchObject({ ok: true, rawBytes: RAW_BYTE_LIMIT });
    const failing = makeTempDir();
    writeFixture(failing, { content: compressibleBytes(RAW_BYTE_LIMIT + 1) });
    expect(checkBundleBudget(failing)).toMatchObject({ ok: false, code: "RAW_OVER" });
  });

  it("fails with GZIP_OVER when gzip exceeds the limit while raw is under it", () => {
    /* بيانات غير قابلة للضغط ببذرة ثابتة: خامها تحت سقف الخام وgzipها فوق سقفه. */
    const content = seededBytes(160_000);
    expect(content.length).toBeLessThan(RAW_BYTE_LIMIT);
    expect(zlib.gzipSync(content, { level: GZIP_LEVEL }).length).toBeGreaterThan(GZIP_BYTE_LIMIT);
    const distDir = makeTempDir();
    writeFixture(distDir, { content });
    expect(checkBundleBudget(distDir)).toMatchObject({ ok: false, code: "GZIP_OVER" });
  });

  it("gzip boundary is exact: == limit passes and +1 fails", () => {
    /* البحث عن حجم خام محدد يجعل gzipه بالضبط عند السقف — العلاقة خطية
     * تقريبًا (بايتات خام + ثابت) فيتقارب في iteration أو اثنتين. */
    let size = GZIP_BYTE_LIMIT - 68;
    let gzip = 0;
    for (let attempt = 0; attempt < 12; attempt += 1) {
      gzip = zlib.gzipSync(seededBytes(size), { level: GZIP_LEVEL }).length;
      if (gzip === GZIP_BYTE_LIMIT) break;
      size += GZIP_BYTE_LIMIT - gzip;
    }
    expect(gzip).toBe(GZIP_BYTE_LIMIT);
    const atLimit = makeTempDir();
    writeFixture(atLimit, { content: seededBytes(size) });
    expect(checkBundleBudget(atLimit)).toMatchObject({ ok: true, gzipBytes: GZIP_BYTE_LIMIT });
    const overLimit = makeTempDir();
    writeFixture(overLimit, { content: seededBytes(size + 1) });
    expect(checkBundleBudget(overLimit)).toMatchObject({ ok: false, code: "GZIP_OVER" });
  });

  it("fails honestly when the build output is missing entirely", () => {
    expect(checkBundleBudget(makeTempDir())).toMatchObject({ ok: false, code: "MANIFEST_MISSING" });
  });

  it("fails when the manifest is not valid JSON", () => {
    const distDir = makeTempDir();
    fs.mkdirSync(path.join(distDir, ".vite"), { recursive: true });
    fs.writeFileSync(path.join(distDir, ".vite", "manifest.json"), "{not-json");
    expect(checkBundleBudget(distDir)).toMatchObject({ ok: false, code: "MANIFEST_INVALID_JSON" });
  });

  it("fails on ambiguous entry selection: zero entries, two entries, CSS-only entries", () => {
    const empty = makeTempDir();
    fs.mkdirSync(path.join(empty, ".vite"), { recursive: true });
    fs.writeFileSync(path.join(empty, ".vite", "manifest.json"), "{}");
    expect(checkBundleBudget(empty)).toMatchObject({ ok: false, code: "ENTRY_AMBIGUOUS" });

    expect(selectEntry({ a: { file: "assets/one.js", isEntry: true }, b: { file: "assets/two.js", isEntry: true } })).toMatchObject({ code: "ENTRY_AMBIGUOUS" });
    expect(selectEntry({ css: { file: "assets/index.css", isEntry: true } })).toMatchObject({ code: "ENTRY_AMBIGUOUS" });
    expect(selectEntry({ js: { file: "assets/index.js", isEntry: false } })).toMatchObject({ code: "ENTRY_AMBIGUOUS" });
  });

  it("fails when the manifest entry file is missing from the output", () => {
    const distDir = makeTempDir();
    writeFixture(distDir, { content: compressibleBytes(10) });
    fs.rmSync(path.join(distDir, "assets", "index-TESTHASH.js"));
    expect(checkBundleBudget(distDir)).toMatchObject({ ok: false, code: "ENTRY_FILE_MISSING" });
  });

  it("fails when the entry path escapes the dist directory", () => {
    const distDir = makeTempDir();
    fs.mkdirSync(path.join(distDir, ".vite"), { recursive: true });
    fs.writeFileSync(
      path.join(distDir, ".vite", "manifest.json"),
      JSON.stringify({ "index.html": { file: "../escape.js", isEntry: true } }),
    );
    expect(checkBundleBudget(distDir)).toMatchObject({ ok: false, code: "ENTRY_FILE_ESCAPE" });
  });

  it("fails when index.html is missing or no longer references the manifest entry (stale output)", () => {
    const noHtml = makeTempDir();
    writeFixture(noHtml, { content: compressibleBytes(10) });
    fs.rmSync(path.join(noHtml, "index.html"));
    expect(checkBundleBudget(noHtml)).toMatchObject({ ok: false, code: "HTML_MISSING" });

    const stale = makeTempDir();
    writeFixture(stale, {
      content: compressibleBytes(10),
      /* البيّنة تشير إلى التجزئة الجديدة والمستند إلى القديمة — انفصام. */
      htmlScripts: ['<script type="module" crossorigin src="/assets/index-OLDHASH.js"></script>'],
    });
    expect(checkBundleBudget(stale)).toMatchObject({ ok: false, code: "HTML_ENTRY_MISMATCH" });
  });

  it("changing the asset hash does not change selection behavior", () => {
    const distDir = makeTempDir();
    writeFixture(distDir, { content: compressibleBytes(2000), entryFile: "assets/index-NEWHASH9.js" });
    const result = checkBundleBudget(distDir);
    if (!result.ok) throw new Error(result.message);
    expect(result.entry).toBe("assets/index-NEWHASH9.js");
    expect(result.rawBytes).toBe(2000);
  });

  it("raw byte counting is correct for multibyte content (bytes, not characters)", () => {
    const arabic = "ب".repeat(50_000);
    const buffer = Buffer.from(arabic, "utf8");
    expect(buffer.length).toBe(100_000);
    expect(arabic.length).toBe(50_000);
    const measured = measureBundle(buffer);
    expect(measured.rawBytes).toBe(100_000);
    const distDir = makeTempDir();
    writeFixture(distDir, { content: buffer });
    const result = checkBundleBudget(distDir);
    if (!result.ok) throw new Error(result.message);
    expect(result.rawBytes).toBe(100_000);
  });

  it("html script extraction ignores modulepreload links and non-script sources", () => {
    const html =
      '<link rel="modulepreload" crossorigin href="/assets/react-runtime.js">' +
      '<script type="module" crossorigin src="/assets/index-X.js"></script>' +
      '<link rel="stylesheet" href="/assets/index.css">';
    expect(htmlScriptSources(html)).toEqual(["/assets/index-X.js"]);
  });
});

describe("check-bundle-budget — CLI contract", () => {
  function runCli(args, cwd) {
    return spawnSync(process.execPath, [CHECKER_PATH, ...args], { encoding: "utf8", cwd });
  }

  it("exits 0 and prints the report for a passing fixture, from any cwd", () => {
    const distDir = makeTempDir();
    writeFixture(distDir, { content: compressibleBytes(3000) });
    const outcome = runCli([distDir], os.tmpdir());
    expect(outcome.status).toBe(0);
    expect(outcome.stdout).toContain("bundle-budget: PASS");
    expect(outcome.stdout).toContain("raw=3000 bytes");
    expect(outcome.stdout).toContain(`limit ${RAW_BYTE_LIMIT}`);
    expect(outcome.stdout).toContain(`zlib level ${GZIP_LEVEL}`);
  });

  it("exits 1 with a distinct failure reason for an over-budget fixture", () => {
    const distDir = makeTempDir();
    writeFixture(distDir, { content: compressibleBytes(RAW_BYTE_LIMIT + 1) });
    const outcome = runCli([distDir]);
    expect(outcome.status).toBe(1);
    expect(outcome.stderr).toContain("bundle-budget: FAIL reason=RAW_OVER");
  });

  it("exits 1 for missing output with an honest reason", () => {
    const outcome = runCli([makeTempDir()]);
    expect(outcome.status).toBe(1);
    expect(outcome.stderr).toContain("bundle-budget: FAIL reason=MANIFEST_MISSING");
  });

  it("refuses extra arguments and limit-override flags — thresholds are not passable", () => {
    const distDir = makeTempDir();
    writeFixture(distDir, { content: compressibleBytes(10) });
    for (const args of [["--raw-limit", "999999", distDir], ["-x"], [distDir, distDir]]) {
      const outcome = runCli(args);
      expect(outcome.status).toBe(1);
      expect(outcome.stderr).toContain("bundle-budget: FAIL reason=USAGE");
    }
  });

  it("default dist dir is anchored to the app root (not the cwd)", () => {
    expect(DEFAULT_DIST_DIR).toBe(path.join(APP_ROOT, "dist", "public"));
  });
});
