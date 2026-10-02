/**
 * Wave 4E (RC-9): اختبارات حارس الراتشة الحجمية — حتمية بلا شبكة ولا نوم.
 * العينات تُبنى في مجلدات مؤقتة (شجرة git مصغرة بملف أساس مصطنع) وتُمسح
 * بعدها؛ والفحص الدخاني على المستودع الحي عبر CLI.
 *
 * تغطي: عتبات الأشرطة (399/400/799/800/1199/1200)، الفئات المشمولة
 * (production+script) والمستثناة (اختبار/fixture/مولدة/إعداد)، القواعد
 * (تصاعد شريط، ملف جديد يدخل شريطًا)، الانكماش المسموح، الحذف بلا أثر،
 * وسلوك CLI على الحي.
 */
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import { afterAll, describe, expect, it } from "vitest";
import {
  BAND_RANK,
  bandOf,
  category,
  checkFileSizeRatchet,
  nonBlankLines,
} from "./check-file-size-ratchet.mjs";

const SCRIPT_PATH = fileURLToPath(import.meta.url).replace(
  /check-file-size-ratchet\.test\.mjs$/,
  "check-file-size-ratchet.mjs",
);
const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const tempDirs = [];
function makeTempDir() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "micro-ratchet-"));
  tempDirs.push(dir);
  return dir;
}
afterAll(() => {
  for (const dir of tempDirs) fs.rmSync(dir, { recursive: true, force: true });
});

/** محاكاة ملف tracked داخل شجرة مؤقتة (init git خفيف). */
function initRepo() {
  const root = makeTempDir();
  fs.mkdirSync(path.join(root, "src"), { recursive: true });
  fs.writeFileSync(path.join(root, "package.json"), "{}\n", "utf8");
  const git = args => spawnSync("git", ["-C", root, ...args], { encoding: "utf8" });
  git(["init", "-q"]);
  git(["config", "user.email", "t@t"]);
  git(["config", "user.name", "t"]);
  return { root, git };
}
function trackAndCommit(git, root) {
  git(["add", "-A"]);
  git(["commit", "-qm", "fixtures"]);
}

const filler = lines => Array.from({ length: lines }, (_, i) => `export const x${i} = ${i};`).join("\n");

describe("band thresholds (registry methodology, literal)", () => {
  it("399/400/799/800/1199/1200 map to the four bands", () => {
    expect(bandOf(0)).toBe("NORMAL");
    expect(bandOf(399)).toBe("NORMAL");
    expect(bandOf(400)).toBe("WATCH");
    expect(bandOf(799)).toBe("WATCH");
    expect(bandOf(800)).toBe("SPLIT_CANDIDATE");
    expect(bandOf(1199)).toBe("SPLIT_CANDIDATE");
    expect(bandOf(1200)).toBe("SPLIT_NOW");
  });

  it("nonBlankLines counts only non-blank lines", () => {
    expect(nonBlankLines("a\n\n  \nb\n")).toBe(2);
    expect(nonBlankLines("")).toBe(0);
  });

  it("BAND_RANK is total and ascending", () => {
    expect(BAND_RANK.NORMAL).toBeLessThan(BAND_RANK.WATCH);
    expect(BAND_RANK.WATCH).toBeLessThan(BAND_RANK.SPLIT_CANDIDATE);
    expect(BAND_RANK.SPLIT_CANDIDATE).toBeLessThan(BAND_RANK.SPLIT_NOW);
  });
});

describe("category scope (register categories, literal)", () => {
  it("production and script are in scope; tests/fixtures/generated/config are not", () => {
    expect(category("src/domain/asset/policies.ts")).toBe("production");
    expect(category("apps/prototype-web/client/src/pages/P.tsx")).toBe("production");
    expect(category("apps/prototype-web/client/src/index.css")).toBe("production");
    expect(category("scripts/check-secrets.mjs")).toBe("script");
    expect(category("scripts/text-density-count.py")).toBe("script");
    expect(category("scripts/check-secrets.test.mjs")).toBe("test");
    expect(category("apps/prototype-web/client/src/pages/P.dom.test.tsx")).toBe("test");
    expect(category("docs/fixtures/export-goldens/current-pair.golden.json")).toBe("fixture");
    expect(category("docs/operations/control/generated/ACTIVE-WORK.md")).toBe("generated");
    expect(category("package.json")).toBe("config");
    expect(category("README.md")).toBe("doc");
  });
});

describe("ratchet rules on synthetic trees (each rule can fail)", () => {
  it("an in-baseline file escalating its band is caught; staying/shrinking passes", () => {
    const { root, git } = initRepo();
    fs.writeFileSync(path.join(root, "src", "service.ts"), filler(300), "utf8");
    trackAndCommit(git, root);
    const baseline = { version: 1, bands: { "src/service.ts": "NORMAL" } };
    /* بقاء في الشريط نفسه + هامش تحت العتبة: نجاح. */
    fs.writeFileSync(path.join(root, "src", "service.ts"), filler(399), "utf8");
    expect(checkFileSizeRatchet(root, baseline).ok).toBe(true);
    /* عبور 400 صعودًا: خرق. */
    fs.writeFileSync(path.join(root, "src", "service.ts"), filler(400), "utf8");
    let result = checkFileSizeRatchet(root, baseline);
    expect(result.ok).toBe(false);
    expect(result.violations[0]?.rule).toBe("band-escalation");
    expect(result.violations[0]?.key).toContain("NORMAL -> WATCH");
    /* انكماش: نجاح دائمًا (خط الأساس WATCH والملف صار NORMAL). */
    fs.writeFileSync(path.join(root, "src", "service.ts"), filler(10), "utf8");
    result = checkFileSizeRatchet(root, { version: 1, bands: { "src/service.ts": "WATCH" } });
    expect(result.ok).toBe(true);
    expect(result.stats.shrunk).toBe(1);
  });

  it("a NEW file entering WATCH+ directly is caught; a new NORMAL file passes", () => {
    const { root, git } = initRepo();
    fs.writeFileSync(path.join(root, "src", "seed.ts"), filler(10), "utf8");
    trackAndCommit(git, root);
    const baseline = { version: 1, bands: { "src/seed.ts": "NORMAL" } };
    /* الملف الجديد يجب أن يكون متتبعًا (git add) كي يراه الفحص — كحال أي
     * ملف جديد في PR حقيقي. */
    fs.writeFileSync(path.join(root, "src", "small.ts"), filler(100), "utf8");
    git(["add", "-A"]);
    expect(checkFileSizeRatchet(root, baseline).ok).toBe(true);
    fs.writeFileSync(path.join(root, "src", "big.ts"), filler(900), "utf8");
    git(["add", "-A"]);
    const result = checkFileSizeRatchet(root, baseline);
    expect(result.ok).toBe(false);
    expect(result.violations[0]?.rule).toBe("new-file-enters-band");
    expect(result.violations[0]?.key).toContain("SPLIT_CANDIDATE");
  });

  it("a deleted file stays in the baseline without effect", () => {
    const { root, git } = initRepo();
    fs.writeFileSync(path.join(root, "src", "gone.ts"), filler(10), "utf8");
    trackAndCommit(git, root);
    const baseline = { version: 1, bands: { "src/gone.ts": "WATCH" } };
    fs.rmSync(path.join(root, "src", "gone.ts"));
    const result = checkFileSizeRatchet(root, baseline);
    expect(result.ok).toBe(true);
    expect(result.stats.removed).toBe(1);
  });

  it("test files are outside the ratchet even when huge", () => {
    const { root, git } = initRepo();
    fs.writeFileSync(path.join(root, "src", "huge.test.ts"), filler(2000), "utf8");
    trackAndCommit(git, root);
    const result = checkFileSizeRatchet(root, { version: 1, bands: {} });
    expect(result.ok).toBe(true);
    expect(result.stats.measured).toBe(0);
  });
});

describe("CLI on the live repo (smoke)", () => {
  it("exits 0 with a summary line on the live tree", () => {
    const run = spawnSync(process.execPath, [SCRIPT_PATH, REPO_ROOT], { encoding: "utf8" });
    expect(run.status).toBe(0);
    expect(run.stdout).toContain("file-size-ratchet: PASS");
  });

  it("the committed baseline is valid JSON with only known bands", () => {
    const baseline = JSON.parse(
      fs.readFileSync(path.join(REPO_ROOT, "scripts", "file-size-ratchet-baseline.json"), "utf8"),
    );
    expect(baseline.version).toBe(1);
    expect(Object.keys(baseline.bands ?? {}).length).toBeGreaterThan(300);
    for (const band of Object.values(baseline.bands ?? {})) {
      expect(["NORMAL", "WATCH", "SPLIT_CANDIDATE", "SPLIT_NOW"]).toContain(band);
    }
  });
});
