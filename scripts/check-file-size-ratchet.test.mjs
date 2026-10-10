/**
 * R8 (R8-F-005/R8-F-006، 2026-10-10): اختبارات راتشة الحجم داخل الشريط v2 —
 * حتمية بلا شبكة ولا نوم. العينات تُبنى في مجلدات مؤقتة (شجرة git مصغرة
 * بملف أساس مصطنع) وتُمسح بعدها؛ والفحص الدخاني على المستودع الحي عبر CLI.
 *
 * تغطي: عتبات الأشرطة، ثبات القيمة داخل الشريط، الانكماش، رفض النمو
 * داخل-الشريط والعبور بقيم قديمة/جديدة، الملف الجديد (NORMAL يجوز وWATCH+
 * يرفض)، حذف الملف، الفئات المستثناة، فشل المخطط التالف والمسار المكرر
 * والشريط/القياس غير المتسقين، منع إخفاء النمو بتعديل الأساس نفس-الـPR
 * (تدقيق الانجراف ضد قاعدة الدمج)، تمييز الإرساء الموثق من التحديث الصامت،
 * هجرة v1→v2 (بذرة == قياس حي)، والأساس الحي المُلتزم.
 */
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import { afterAll, describe, expect, it } from "vitest";
import {
  BASELINE_SCHEMA,
  BAND_RANK,
  auditBaselineDrift,
  bandOf,
  category,
  checkFileSizeRatchet,
  nonBlankLines,
  validateBaseline,
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

/** محاكاة ملف tracked داخل شجرة مؤقتة (init git خفيف) مع فرع main قابل للحل. */
function initRepo() {
  const root = makeTempDir();
  fs.mkdirSync(path.join(root, "src"), { recursive: true });
  fs.mkdirSync(path.join(root, "scripts"), { recursive: true });
  fs.writeFileSync(path.join(root, "package.json"), "{}\n", "utf8");
  const git = args => spawnSync("git", ["-C", root, ...args], { encoding: "utf8" });
  git(["init", "-q", "-b", "main"]);
  git(["config", "user.email", "t@t"]);
  git(["config", "user.name", "t"]);
  const commit = message => {
    git(["add", "-A"]);
    git(["commit", "-qm", message]);
  };
  return { root, git, commit };
}

const filler = lines => Array.from({ length: lines }, (_, i) => `export const x${i} = ${i};`).join("\n");

/** أساس v2 مصطنع من خريطة { path: nbLoc }. */
function baselineV2(map) {
  return {
    version: 2,
    schema: BASELINE_SCHEMA,
    measurements: Object.fromEntries(
      Object.entries(map).map(([rel, nbLoc]) => [rel, { nbLoc, band: bandOf(nbLoc) }]),
    ),
  };
}
function ledgerWith(entries) {
  return { entries };
}

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

  it("the guard's own data files are excluded from measurement by census, not category", () => {
    /* الفئات تبقى كما هي؛ الاستثناء في قياس الشجرة فقط (بيانات حرس لا كود). */
    expect(category("scripts/file-size-ratchet-baseline.json")).toBe("script");
    expect(category("scripts/file-size-ratchet-reanchors.json")).toBe("script");
  });
});

describe("within-band ratchet rules on synthetic trees (each rule can fail)", () => {
  it("an unchanged value within the band passes; shrinkage passes and is counted", () => {
    const { root, git, commit } = initRepo();
    fs.writeFileSync(path.join(root, "src", "service.ts"), filler(300), "utf8");
    commit("seed");
    const baseline = baselineV2({ "src/service.ts": 300 });
    expect(checkFileSizeRatchet(root, baseline).ok).toBe(true);
    fs.writeFileSync(path.join(root, "src", "service.ts"), filler(150), "utf8");
    const result = checkFileSizeRatchet(root, baseline);
    expect(result.ok).toBe(true);
    expect(result.stats.shrunk).toBe(1);
  });

  it("within-band growth fails with old/new values; band crossing fails with its own rule", () => {
    const { root, git, commit } = initRepo();
    fs.writeFileSync(path.join(root, "src", "service.ts"), filler(300), "utf8");
    commit("seed");
    const baseline = baselineV2({ "src/service.ts": 300 });
    fs.writeFileSync(path.join(root, "src", "service.ts"), filler(320), "utf8");
    let result = checkFileSizeRatchet(root, baseline);
    expect(result.ok).toBe(false);
    expect(result.violations[0]?.rule).toBe("within-band-growth");
    expect(result.violations[0]?.key).toContain("300 -> 320 nbLOC (NORMAL -> NORMAL)");
    fs.writeFileSync(path.join(root, "src", "service.ts"), filler(420), "utf8");
    result = checkFileSizeRatchet(root, baseline);
    expect(result.violations[0]?.rule).toBe("band-escalation");
    expect(result.violations[0]?.key).toContain("NORMAL -> WATCH");
  });

  it("a NEW file entering WATCH+ directly is caught; a new NORMAL file passes", () => {
    const { root, git, commit } = initRepo();
    fs.writeFileSync(path.join(root, "src", "seed.ts"), filler(10), "utf8");
    commit("seed");
    const baseline = baselineV2({ "src/seed.ts": 10 });
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

  it("a deleted file stays in the baseline without effect (explicit removed stat)", () => {
    const { root, git, commit } = initRepo();
    fs.writeFileSync(path.join(root, "src", "gone.ts"), filler(10), "utf8");
    commit("seed");
    const baseline = baselineV2({ "src/gone.ts": 10 });
    fs.rmSync(path.join(root, "src", "gone.ts"));
    const result = checkFileSizeRatchet(root, baseline);
    expect(result.ok).toBe(true);
    expect(result.stats.removed).toBe(1);
  });

  it("a documented ledger re-anchor authorizes growth, is reported, and never silently passes", () => {
    const { root, git, commit } = initRepo();
    fs.writeFileSync(path.join(root, "src", "service.ts"), filler(300), "utf8");
    commit("seed");
    const baseline = baselineV2({ "src/service.ts": 300 });
    fs.writeFileSync(path.join(root, "src", "service.ts"), filler(320), "utf8");
    const ledger = ledgerWith([
      {
        path: "src/service.ts",
        from: { nbLoc: 300, band: "NORMAL" },
        to: { nbLoc: 320, band: "NORMAL" },
        authorization: { ownerReview: "PR #999 review" },
      },
    ]);
    const result = checkFileSizeRatchet(root, baseline, undefined, ledger);
    expect(result.ok).toBe(true);
    expect(result.reanchored).toHaveLength(1);
    expect(result.reanchored[0]).toContain("src/service.ts: 300 -> 320");
    /* سلسلة خاطئة (from لا يطابق) = لا تغطية. */
    const badChain = ledgerWith([
      { path: "src/service.ts", from: { nbLoc: 299, band: "NORMAL" }, to: { nbLoc: 320, band: "NORMAL" }, authorization: { ownerReview: "x" } },
    ]);
    expect(checkFileSizeRatchet(root, baseline, undefined, badChain).ok).toBe(false);
    /* بلا مرجع مراجعة مالك = لا تغطية (لا ثقة المؤلف المجردة). */
    const noAuth = ledgerWith([
      { path: "src/service.ts", from: { nbLoc: 300, band: "NORMAL" }, to: { nbLoc: 320, band: "NORMAL" }, authorization: {} },
    ]);
    expect(checkFileSizeRatchet(root, baseline, undefined, noAuth).ok).toBe(false);
  });

  it("test files and other excluded categories remain outside the ratchet even when huge", () => {
    const { root, git, commit } = initRepo();
    fs.writeFileSync(path.join(root, "src", "huge.test.ts"), filler(2000), "utf8");
    fs.writeFileSync(path.join(root, "README.md"), filler(2000), "utf8");
    commit("seed");
    const result = checkFileSizeRatchet(root, baselineV2({}));
    expect(result.ok).toBe(true);
    expect(result.stats.measured).toBe(0);
  });
});

describe("baseline schema v2 (fail-closed)", () => {
  it("accepts a valid baseline and rejects malformed variants", () => {
    expect(validateBaseline(baselineV2({ "src/a.ts": 10 }))).toBeNull();
    expect(validateBaseline({ version: 1, measurements: {} })).toContain("version");
    expect(validateBaseline({ version: 2, schema: "other", measurements: {} })).toContain("schema");
    expect(validateBaseline({ version: 2, schema: BASELINE_SCHEMA, measurements: [] })).toContain("measurements");
    const badBand = baselineV2({ "src/a.ts": 10 });
    badBand.measurements["src/a.ts"].band = "WATCH";
    expect(validateBaseline(badBand)).toContain("band inconsistent with nbLoc 10");
    const badMetric = baselineV2({ "src/a.ts": 10 });
    badMetric.measurements["src/a.ts"].nbLoc = -1;
    expect(validateBaseline(badMetric)).toContain("nbLoc invalid");
    const unknownBand = baselineV2({ "src/a.ts": 10 });
    unknownBand.measurements["src/a.ts"].band = "LATER";
    expect(validateBaseline(unknownBand)).toContain("band invalid");
    expect(validateBaseline(null)).toContain("not an object");
  });

  it("duplicate paths fail closed (raw-text key scan)", () => {
    /* نص خام مكتوب يدويًا بمفتاح مكرر (JSON.stringify لا يمكنه إنتاج تكرار). */
    const raw = [
      "{",
      '  "version": 2,',
      `  "schema": ${JSON.stringify(BASELINE_SCHEMA)},`,
      '  "measurements": {',
      '    "src/a.ts": { "nbLoc": 10, "band": "NORMAL" },',
      '    "src/a.ts": { "nbLoc": 400, "band": "WATCH" }',
      "  }",
      "}",
    ].join("\n");
    /* JSON.parse يأخذ الأخير صامتًا — الكشف النصي يمنع ذلك. */
    const parsed = JSON.parse(raw);
    expect(validateBaseline(parsed, raw)).toContain('duplicate path "src/a.ts"');
    const clean = JSON.stringify(baselineV2({ "src/a.ts": 10 }), null, 2);
    expect(validateBaseline(JSON.parse(clean), clean)).toBeNull();
  });

  it("the committed live baseline is a valid v2 census of the live tree", () => {
    const raw = fs.readFileSync(path.join(REPO_ROOT, "scripts", "file-size-ratchet-baseline.json"), "utf8");
    const baseline = JSON.parse(raw);
    expect(validateBaseline(baseline, raw)).toBeNull();
    expect(Object.keys(baseline.measurements).length).toBeGreaterThan(450);
    expect(baseline.provenance?.historical_growth_evidence ?? "").toContain("R6-SCAN-F-005");
  });
});

describe("same-PR concealment prevention (drift audit against the merge base)", () => {
  function seedMainWithBaseline(root, git, commit, nbLoc) {
    fs.writeFileSync(path.join(root, "src", "service.ts"), filler(nbLoc), "utf8");
    const baseline = baselineV2({ "src/service.ts": nbLoc });
    fs.mkdirSync(path.join(root, "scripts"), { recursive: true });
    fs.writeFileSync(path.join(root, "scripts", "file-size-ratchet-baseline.json"), JSON.stringify(baseline, null, 2));
    commit("baseline on main");
  }

  it("a baseline edit alone cannot make same-PR growth pass (no ledger -> drift violation)", () => {
    const { root, git, commit } = initRepo();
    seedMainWithBaseline(root, git, commit, 300);
    git(["checkout", "-qb", "feature"]);
    fs.writeFileSync(path.join(root, "src", "service.ts"), filler(360), "utf8");
    const bumped = baselineV2({ "src/service.ts": 360 });
    fs.writeFileSync(path.join(root, "scripts", "file-size-ratchet-baseline.json"), JSON.stringify(bumped, null, 2));
    commit("grow + bump baseline silently");
    /* فحص الشجرة وحده يمر (الأساس المرفوع يطابق الحي) — التدقيق يكشف الإخفاء. */
    expect(checkFileSizeRatchet(root, bumped).ok).toBe(true);
    const audit = auditBaselineDrift(root, { inCi: true });
    expect(audit.status).toBe("drift");
    expect(audit.violations[0]?.rule).toBe("drift-unauthorized");
    expect(audit.violations[0]?.key).toContain("300 -> 360");
  });

  it("a documented ledger entry authorizes the drift and is reported as authorized", () => {
    const { root, git, commit } = initRepo();
    seedMainWithBaseline(root, git, commit, 300);
    git(["checkout", "-qb", "feature"]);
    fs.writeFileSync(path.join(root, "src", "service.ts"), filler(360), "utf8");
    const bumped = baselineV2({ "src/service.ts": 360 });
    fs.writeFileSync(path.join(root, "scripts", "file-size-ratchet-baseline.json"), JSON.stringify(bumped, null, 2));
    fs.writeFileSync(
      path.join(root, "scripts", "file-size-ratchet-reanchors.json"),
      JSON.stringify(
        ledgerWith([
          {
            id: "T-1",
            date: "2026-10-10",
            path: "src/service.ts",
            from: { nbLoc: 300, band: "NORMAL" },
            to: { nbLoc: 360, band: "NORMAL" },
            reason: "documented test re-anchor",
            authorization: { ownerReview: "PR #999" },
          },
        ]),
        null,
        2,
      ),
    );
    commit("grow + documented re-anchor");
    const audit = auditBaselineDrift(root, { inCi: true });
    expect(audit.status).toBe("clean");
    expect(audit.reanchored).toEqual(["src/service.ts: 300 -> 360"]);
  });

  it("removing a live file's baseline entry in the same PR is rejected", () => {
    const { root, git, commit } = initRepo();
    seedMainWithBaseline(root, git, commit, 300);
    git(["checkout", "-qb", "feature"]);
    fs.writeFileSync(path.join(root, "src", "service.ts"), filler(360), "utf8");
    fs.writeFileSync(path.join(root, "scripts", "file-size-ratchet-baseline.json"), JSON.stringify(baselineV2({}), null, 2));
    commit("drop the entry");
    const audit = auditBaselineDrift(root, { inCi: true });
    expect(audit.violations[0]?.rule).toBe("drift-entry-removed");
    expect(audit.violations[0]?.key).toBe("src/service.ts");
  });

  it("a v1 baseline at the merge base triggers migration verification (seed must equal live)", () => {
    const { root, git, commit } = initRepo();
    fs.writeFileSync(path.join(root, "src", "service.ts"), filler(300), "utf8");
    fs.mkdirSync(path.join(root, "scripts"), { recursive: true });
    fs.writeFileSync(
      path.join(root, "scripts", "file-size-ratchet-baseline.json"),
      JSON.stringify({ version: 1, bands: { "src/service.ts": "NORMAL" } }),
    );
    commit("v1 on main");
    git(["checkout", "-qb", "feature"]);
    const v2 = baselineV2({ "src/service.ts": 300 });
    fs.writeFileSync(path.join(root, "scripts", "file-size-ratchet-baseline.json"), JSON.stringify(v2, null, 2));
    commit("v2 seed matches live");
    expect(auditBaselineDrift(root, { inCi: true }).status).toBe("migration-verified");
    const v2bad = baselineV2({ "src/service.ts": 250 });
    fs.writeFileSync(path.join(root, "scripts", "file-size-ratchet-baseline.json"), JSON.stringify(v2bad, null, 2));
    commit("v2 seed drifts from live");
    const audit = auditBaselineDrift(root, { inCi: true });
    expect(audit.status).toBe("migration-mismatch");
    expect(audit.violations[0]?.rule).toBe("seed-mismatch");
  });

  it("an unresolvable merge base fails in CI and warns locally", () => {
    const { root, git, commit } = initRepo();
    fs.writeFileSync(path.join(root, "src", "service.ts"), filler(300), "utf8");
    commit("no baseline branch");
    const ci = auditBaselineDrift(root, { inCi: true, mergeBase: null });
    expect(ci.status).toBe("unavailable-in-ci");
    expect(ci.violations[0]?.rule).toBe("drift-audit-unavailable");
    const local = auditBaselineDrift(root, { inCi: false, mergeBase: null });
    expect(local.status).toBe("unavailable");
    expect(local.violations).toHaveLength(0);
  });
});

describe("CLI on the live repo (smoke)", () => {
  it("exits 0 with a summary line and the migration/drift note on the live tree", () => {
    const run = spawnSync(process.execPath, [SCRIPT_PATH, REPO_ROOT], { encoding: "utf8" });
    expect(run.status).toBe(0);
    expect(run.stdout).toContain("file-size-ratchet: PASS");
    expect(run.stdout).toContain("R8-2/R8-F-005+F-006");
  });
});
