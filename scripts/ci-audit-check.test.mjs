/**
 * الخطوة ٣ (برنامج تصحيح ما بعد المسح لPR #316 — 2026-10-06): اختبارات
 * فاحص التدقيق مع سجل الاستثناءات الأمنية — حتمية بلا شبكة (تقارير محفوظة
 * عبر --report-file وسجلات fixture عبر --register).
 *
 * يثبت الحالات الحاكمة الأربع للسجل + سلامة الفشل المغلق:
 *  1) مكتشف بلا صف في السجل → حجب (خرج 1)؛
 *  2) مكتشف بصف OWNER_ACCEPTED → مرور (خرج 0) مع إشعار صريح غير صامت؛
 *  3) مكتشف بصف PROPOSED → حجب برسالة القرار المعلق (خرج 1)؛
 *  4) صف OWNER_ACCEPTED بلا مكتشف حي → تحذير تقادم (المراقبة الفعالة)؛
 *  5) سجل تالف/مفقود → فشل مغلق (خرج 1)؛
 *  6) تقرير غير قابل للتحليل → خرج 2 (إشارة فشل الأداة/الشبكة لإعادة المحاولة).
 */
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { evaluateAuditReport, loadRegister, extractAdvisories, DEFAULT_REGISTER_PATH } from "./ci-audit-check.mjs";

const SCRIPT_PATH = fileURLToPath(import.meta.url).replace("ci-audit-check.test.mjs", "ci-audit-check.mjs");
const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const tempDirs = [];
function makeTempDir() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "ci-audit-check-"));
  tempDirs.push(dir);
  return dir;
}
function writeTemp(name, content) {
  const dir = makeTempDir();
  const file = path.join(dir, name);
  fs.writeFileSync(file, typeof content === "string" ? content : JSON.stringify(content), "utf8");
  return file;
}

function runChecker(args) {
  return spawnSync(process.execPath, [SCRIPT_PATH, ...args], { encoding: "utf8", cwd: REPO_ROOT });
}

const BRACES_REPORT = {
  advisories: {
    "1240992": {
      id: 1240992,
      github_advisory_id: "GHSA-vfj7-8cjw-p6xm",
      module_name: "braces",
      severity: "high",
      title: "braces vulnerable to stack-exhaustion denial of service through deeply nested patterns",
      vulnerable_versions: "<=3.0.3",
      findings: [{ version: "3.0.3", paths: [".>stylelint>micromatch>braces"] }],
    },
  },
  metadata: { vulnerabilities: { info: 0, low: 0, moderate: 0, high: 1, critical: 0, total: 1 } },
};

const REGISTER = extraStatus => ({
  version: 1,
  exceptions: [
    {
      advisory_id: "GHSA-vfj7-8cjw-p6xm",
      package: "braces",
      status: extraStatus,
      classification: "development-only",
      removal_condition: "upstream patch reaches the lockfile",
      accepted_at: "2026-10-06",
    },
  ],
});

describe("ci-audit-check — register semantics (pure evaluation)", () => {
  it("blocks an advisory with no register entry", () => {
    const verdict = evaluateAuditReport(BRACES_REPORT, { exceptions: [] });
    expect(verdict.exitCode).toBe(1);
    expect(verdict.blocked).toHaveLength(1);
    expect(verdict.blocked[0].advisory.id).toBe("GHSA-vfj7-8cjw-p6xm");
    expect(verdict.blocked[0].reason).toContain("no exception record");
  });

  it("passes an OWNER_ACCEPTED advisory with an explicit, non-silent notice", () => {
    const verdict = evaluateAuditReport(BRACES_REPORT, REGISTER("OWNER_ACCEPTED"));
    expect(verdict.exitCode).toBe(0);
    expect(verdict.accepted).toHaveLength(1);
    expect(verdict.accepted[0].notice).toContain("documented security exception");
    expect(verdict.accepted[0].notice).toContain("removal condition");
    expect(verdict.blocked).toHaveLength(0);
  });

  it("blocks a PROPOSED advisory pending the owner decision", () => {
    const verdict = evaluateAuditReport(BRACES_REPORT, REGISTER("PROPOSED"));
    expect(verdict.exitCode).toBe(1);
    expect(verdict.blocked[0].reason).toContain("PROPOSED security exception awaiting the owner decision");
  });

  it("blocks a REJECTED advisory like any unregistered finding", () => {
    const verdict = evaluateAuditReport(BRACES_REPORT, REGISTER("REJECTED"));
    expect(verdict.exitCode).toBe(1);
    expect(verdict.blocked[0].reason).toContain("explicitly REJECTED by owner");
  });

  it("flags a stale OWNER_ACCEPTED entry whose advisory no longer matches (monitoring)", () => {
    const verdict = evaluateAuditReport({ advisories: {} }, REGISTER("OWNER_ACCEPTED"));
    expect(verdict.exitCode).toBe(0);
    expect(verdict.stale).toHaveLength(1);
    expect(verdict.stale[0].notice).toContain("stale OWNER_ACCEPTED exception");
    expect(verdict.stale[0].notice).toContain("removal condition may have been met");
  });

  it("extracts advisory identity from pnpm audit JSON shape", () => {
    const advisories = extractAdvisories(BRACES_REPORT);
    expect(advisories).toHaveLength(1);
    expect(advisories[0]).toMatchObject({
      id: "GHSA-vfj7-8cjw-p6xm",
      module: "braces",
      severity: "high",
      vulnerableVersions: "<=3.0.3",
    });
    expect(advisories[0].paths).toEqual([".>stylelint>micromatch>braces"]);
  });
});

describe("ci-audit-check — CLI (offline via --report-file/--register)", () => {
  it("exits 1 and prints the pending decision for the live PROPOSED register entry", () => {
    const report = writeTemp("report.json", BRACES_REPORT);
    const result = runChecker(["--report-file", report, "--register", DEFAULT_REGISTER_PATH]);
    expect(result.status).toBe(1);
    expect(result.stdout).toContain("BLOCKED GHSA-vfj7-8cjw-p6xm (high) braces");
    expect(result.stdout).toContain("PROPOSED security exception awaiting the owner decision");
    expect(result.stdout).toContain("1 blocking finding(s)");
  });

  it("exits 0 with an explicit notice for an OWNER_ACCEPTED register", () => {
    const report = writeTemp("report.json", BRACES_REPORT);
    const register = writeTemp("register.json", REGISTER("OWNER_ACCEPTED"));
    const result = runChecker(["--report-file", report, "--register", register]);
    expect(result.status).toBe(0);
    expect(result.stdout).toContain("NOTICE");
    expect(result.stdout).toContain("documented security exception");
    expect(result.stdout).toContain("never silent");
  });

  it("fails closed (exit 1) on a malformed register", () => {
    const report = writeTemp("report.json", BRACES_REPORT);
    const register = writeTemp("register.json", "{ not json");
    const result = runChecker(["--report-file", report, "--register", register]);
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("unreadable/malformed");
  });

  it("signals tool failure (exit 2) for an unparseable report", () => {
    const report = writeTemp("report.json", "connection refused");
    const result = runChecker(["--report-file", report, "--register", DEFAULT_REGISTER_PATH]);
    expect(result.status).toBe(2);
    expect(result.stderr).toContain("TOOL FAILURE");
  });

  it("the live register carries the braces PROPOSED record with all ten required fields", () => {
    const loaded = loadRegister(DEFAULT_REGISTER_PATH);
    expect(loaded.ok).toBe(true);
    const entry = loaded.register.exceptions.find(e => e.advisory_id === "GHSA-vfj7-8cjw-p6xm");
    expect(entry).toBeTruthy();
    expect(entry.status).toBe("PROPOSED");
    expect(entry.package).toBe("braces");
    for (const key of [
      "dependency_chain",
      "classification",
      "exploitability_assessment",
      "affected_surfaces",
      "unaffected_surfaces",
      "monitoring_method",
      "owner",
      "review_date",
      "reopening_trigger",
      "removal_condition",
      "rollback_boundary",
    ]) {
      expect(entry, `register entry missing ${key}`).toHaveProperty(key);
    }
  });
});
