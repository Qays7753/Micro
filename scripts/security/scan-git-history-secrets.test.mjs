/**
 * R11 S0: اختبارات ماسح أسرار تاريخ Git — حتمية بلا شبكة.
 *
 * القاعدة الأمنية الحاكمة (RV3-A6): أي سر مزيف في هذا الملف يُجمَّع وقت
 * التشغيل (`"ghp_" + "A".repeat(36)`) ولا يُكتب حرفيًا أبدًا — حارس شجرة
 * العمل نفسه يفحص هذا الملف، فالقيمة الحرفية كانت ستفشل الفحص وتكذب على
 * الغرض. نفس المنطق ينطبق على رسائل الالتزامات المزروعة (تُمرر عبر argv).
 *
 * التغطية:
 *  1) كشف سر مزروع حُذف في التزام لاحق (الكائن ما زال قابلًا للوصول).
 *  2) التنقية: القيمة المزروعة لا تظهر في التقرير المتسلسل أبدًا.
 *  3) مستودع نظيف = ZERO_FINDINGS وخروج 0.
 *  4) قاعدة اسم ملف سر (id_rsa) عبر blob-path.
 *  5) رسالة التزام تحمل سرًا (kind=commit-message).
 *  6) التأطير البايتي الدقيق: محتوى يقلد رؤوس cat-file لا يكسر الماسح.
 *  7) مدقق التنقية مباشرة (redactionViolations): يلتقط التسرب ولا يكذب.
 *  8) أكواد خروج CLI: 0 نظيف / 1 اكتشافات / 2 خطأ استخدام.
 *  9) R11-REV-NF-001: الكائن المكرر (نفس البايتات في مسارين) يُعدّد كل
 *     أسمائه — المسار الحساس لا يضيع بسبب إقران rev-list بمسار واحد.
 * 10) R11-REV-NF-002: رسالة التزام تحوي 0x1e (و0x1f) قبل حارس مُجمّع وقت
 *     التشغيل تُفحص كاملة وتُنسب لالتزامها بالضبط — لا قطع بالفواصل.
 */
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, describe, expect, it } from "vitest";
import {
  SCANNER_SCHEMA,
  buildSanitizedReport,
  fingerprintOf,
  matchSecretFileName,
  matchSecrets,
  redactionViolations,
} from "./scan-git-history-secrets.mjs";

const SCRIPT_PATH = fileURLToPath(import.meta.url).replace(
  /scan-git-history-secrets\.test\.mjs$/,
  "scan-git-history-secrets.mjs",
);
const tempDirs = [];
function makeTempDir() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "micro-s0-scan-"));
  tempDirs.push(dir);
  return dir;
}
afterAll(() => {
  for (const dir of tempDirs) fs.rmSync(dir, { recursive: true, force: true });
});

/** مستودع تركيبي بهوية git صريحة (عدّادات CI بلا هوية). */
function git(repoPath, args, options = {}) {
  const run = spawnSync(
    "git",
    [
      "-c",
      "user.email=zai-s0-selftest@example.invalid",
      "-c",
      "user.name=S0 self-test",
      "-C",
      repoPath,
      ...args,
    ],
    { encoding: "utf8", ...options },
  );
  if (run.status !== 0) throw new Error(`git ${args.join(" ")} failed: ${run.stderr}`);
  return run.stdout;
}
function initRepo() {
  const repoPath = makeTempDir();
  git(repoPath, ["init", "--initial-branch=main"]);
  return repoPath;
}
function commitFile(repoPath, rel, content, message) {
  const full = path.join(repoPath, rel);
  fs.mkdirSync(path.dirname(full), { recursive: true });
  fs.writeFileSync(full, content, "utf8");
  git(repoPath, ["add", rel]);
  git(repoPath, ["commit", "-m", message]);
}
function removeFile(repoPath, rel, message) {
  git(repoPath, ["rm", "-q", rel]);
  git(repoPath, ["commit", "-m", message]);
}

/* سر مزيف يُجمَّع وقت التشغيل — لا حرفيًا أبدًا (حارس الأسرار يفحص هذا الملف). */
const fakeClassicToken = `ghp_${"A".repeat(36)}`;
const fakeFineGrained = `github_pat_${"B".repeat(60)}`;

describe("S0 history secret scan", () => {
  it("detects a planted-then-removed secret and never leaks its value (redaction)", () => {
    const repoPath = initRepo();
    commitFile(repoPath, "notes.txt", "nothing interesting\n", "clean start");
    commitFile(repoPath, "config.txt", `token=${fakeClassicToken}\n`, "add config");
    removeFile(repoPath, "config.txt", "remove config");
    const { report, findingCount } = buildSanitizedReport(repoPath, "2026-10-14");
    expect(findingCount).toBeGreaterThan(0);
    expect(report.result).toBe("FINDINGS");
    const contentFindings = report.findings.filter(
      f => f.rule === "github-classic-token" && f.kind === "blob-content",
    );
    expect(contentFindings.length).toBeGreaterThan(0);
    for (const finding of contentFindings) {
      expect(finding.object).toMatch(/^[0-9a-f]{40}$/);
      expect(finding.path).toContain("config.txt");
      expect(finding.fingerprint).toMatch(/^[0-9a-f]{16}$/);
      expect(finding.commits.count).toBeGreaterThanOrEqual(1);
      expect(finding.commits.last).toMatch(/^[0-9a-f]{40}$/);
    }
    /* التنقية: لا القيمة الكاملة ولا أي مقطع منها في التقرير المتسلسل. */
    const serialized = JSON.stringify(report);
    expect(serialized).not.toContain(fakeClassicToken);
    expect(serialized).not.toContain(fakeClassicToken.slice(4));
  });

  it("returns ZERO_FINDINGS for a clean repository", () => {
    const repoPath = initRepo();
    commitFile(repoPath, "readme.md", "# clean\n\nplain text only\n", "initial");
    commitFile(repoPath, "src/a.ts", "export const a = 1;\n", "add a");
    const { report, findingCount } = buildSanitizedReport(repoPath, "2026-10-14");
    expect(findingCount).toBe(0);
    expect(report.result).toBe("ZERO_FINDINGS");
    expect(report.findings).toEqual([]);
    expect(report.redaction).toBe("ASSERTED");
    expect(report.schema).toBe(SCANNER_SCHEMA);
    expect(report.scanned.commits).toBe(2);
    expect(report.scanned.blobs).toBeGreaterThanOrEqual(2);
  });

  it("flags secret file names through blob paths (id_rsa)", () => {
    const repoPath = initRepo();
    commitFile(repoPath, "keys/id_rsa", "ssh-rsa AAAAFakeKeyBodyForSelfTest\n", "add key");
    removeFile(repoPath, "keys/id_rsa", "remove key");
    const { report } = buildSanitizedReport(repoPath, "2026-10-14");
    const pathFindings = report.findings.filter(f => f.kind === "blob-path");
    expect(pathFindings.length).toBeGreaterThan(0);
    expect(pathFindings.some(f => f.rule.includes("id_rsa"))).toBe(true);
  });

  it("scans commit messages (kind=commit-message) with runtime-built secret text", () => {
    const repoPath = initRepo();
    commitFile(repoPath, "a.txt", "content\n", "normal commit");
    /* الرسالة تحمل السر عبر argv — لا يُكتب في أي ملف داخل الشجرة. */
    const full = path.join(repoPath, "b.txt");
    fs.writeFileSync(full, "b\n", "utf8");
    git(repoPath, ["add", "b.txt"]);
    git(repoPath, ["commit", "-m", `deploy with ${fakeFineGrained}`]);
    const { report } = buildSanitizedReport(repoPath, "2026-10-14");
    const messageFindings = report.findings.filter(f => f.kind === "commit-message");
    expect(messageFindings.length).toBeGreaterThan(0);
    expect(messageFindings.some(f => f.rule === "github-fine-grained-token")).toBe(true);
    expect(JSON.stringify(report)).not.toContain(fakeFineGrained);
  });

  it("survives blob content that mimics cat-file framing (byte-exact parsing)", () => {
    const repoPath = initRepo();
    const hostile = [
      "0123456789abcdef0123456789abcdef01234567 blob 3",
      "abc",
      "missing blob 999",
      "---- header-like line ----",
      "trailing",
      "",
    ].join("\n");
    commitFile(repoPath, "hostile.bin", hostile, "hostile content");
    const { report, findingCount } = buildSanitizedReport(repoPath, "2026-10-14");
    expect(findingCount).toBe(0);
    expect(report.result).toBe("ZERO_FINDINGS");
    expect(report.scanned.blobs).toBe(1);
  });

  it("redaction checker catches leaks and passes clean output", () => {
    const findings = [{ entry: { fingerprint: "ab".repeat(8) }, secretValue: fakeClassicToken }];
    expect(redactionViolations(`{"x":"contains ${fakeClassicToken}"}`, findings)).toEqual(["ab".repeat(8)]);
    expect(redactionViolations('{"x":"clean"}', findings)).toEqual([]);
    /* القيم القصيرة (<8) لا تفحص — قاعدة الطول موثقة في المُخرِج. */
    expect(
      redactionViolations('{"x":"short"}', [
        { entry: { fingerprint: "c".repeat(16) }, secretValue: "short" },
      ]),
    ).toEqual([]);
  });

  it("fingerprint is non-reversible and stable", () => {
    const first = fingerprintOf(fakeClassicToken);
    expect(first).toMatch(/^[0-9a-f]{16}$/);
    expect(fingerprintOf(fakeClassicToken)).toBe(first);
    expect(first).not.toContain("ghp_");
    expect(fingerprintOf(fakeFineGrained)).not.toBe(first);
  });

  it("pattern helpers share the working-tree guard's table semantics", () => {
    expect(matchSecrets(`a ${fakeClassicToken} b`)).toHaveLength(1);
    expect(matchSecrets("plain text")).toHaveLength(0);
    expect(matchSecretFileName("folder/.env")).toContain("secret-file-name");
    expect(matchSecretFileName("folder/README.md")).toBeNull();
  });

  it("CLI exit codes: 0 clean, 1 findings, 2 usage error", () => {
    const clean = initRepo();
    commitFile(clean, "r.md", "ok\n", "init");
    const cleanRun = spawnSync("node", [SCRIPT_PATH, clean], { encoding: "utf8" });
    expect(cleanRun.status).toBe(0);
    expect(cleanRun.stderr).toContain("ZERO_FINDINGS");

    const dirty = initRepo();
    commitFile(dirty, "c.txt", `k=${fakeClassicToken}\n`, "add");
    const dirtyRun = spawnSync("node", [SCRIPT_PATH, dirty], { encoding: "utf8" });
    expect(dirtyRun.status).toBe(1);
    expect(dirtyRun.stderr).toContain("FINDINGS");
    expect(dirtyRun.stdout).not.toContain(fakeClassicToken);

    const usageRun = spawnSync("node", [SCRIPT_PATH], { encoding: "utf8" });
    expect(usageRun.status).toBe(2);
    expect(usageRun.stderr).toContain("USAGE");
  });
});

describe("S0 adversarial regressions (PR review R11-REV-NF-001 / R11-REV-NF-002)", () => {
  it("enumerates every alias path of a deduplicated blob — sensitive filename never lost (R11-REV-NF-001)", () => {
    const repoPath = initRepo();
    /* نفس البايتات في مسارين — كائن blob واحد له اسمان؛ التحليل القديم
     * المعتمد على rev-list --objects كان يقرن الكائن بمسار واحد فقط
     * (README.txt) فيُفوّت قاعدة اسم id_rsa كليًا — ZERO_FINDINGS كاذبة. */
    commitFile(repoPath, "README.txt", "ordinary documentation body\n", "add readme");
    const keyPath = path.join(repoPath, "keys/id_rsa");
    fs.mkdirSync(path.dirname(keyPath), { recursive: true });
    fs.copyFileSync(path.join(repoPath, "README.txt"), keyPath);
    git(repoPath, ["add", "keys/id_rsa"]);
    git(repoPath, ["commit", "-m", "alias identical content at a sensitive path"]);
    const { report } = buildSanitizedReport(repoPath, "2026-10-14");
    expect(report.scanned.blobs).toBe(1); /* كائن واحد مكرر في مسارين لا اثنان */
    const pathFindings = report.findings.filter(f => f.kind === "blob-path");
    expect(pathFindings).toHaveLength(1);
    expect(pathFindings[0].path).toBe("keys/id_rsa");
    expect(pathFindings[0].rule).toContain("id_rsa");
    expect(pathFindings[0].object).toMatch(/^[0-9a-f]{40}$/);
    expect(pathFindings[0].commits.count).toBeGreaterThanOrEqual(1);
    /* المسار الآمن لا يُصطاد (README.txt ليس اسم سر) — الاصطياد للاسم الحساس وحده. */
  });

  it("attributes all alias paths to the one blob-content finding and scans content once per object (R11-REV-NF-001)", () => {
    const repoPath = initRepo();
    commitFile(repoPath, "docs/readme.txt", `token=${fakeClassicToken}\n`, "add doc");
    /* الكائن نفسه (البايتات نفسها) في مسار ثانٍ حساس الاسم عبر التزام لاحق —
     * مسح المحتوى مرة واحدة لكل كائن، وكل الأسماء تُنسب إلى الاكتشاف. */
    const aliasPath = path.join(repoPath, "archive/creds.pem");
    fs.mkdirSync(path.dirname(aliasPath), { recursive: true });
    fs.copyFileSync(path.join(repoPath, "docs/readme.txt"), aliasPath);
    git(repoPath, ["add", "archive/creds.pem"]);
    git(repoPath, ["commit", "-m", "alias the same blob at an archive path"]);
    const { report } = buildSanitizedReport(repoPath, "2026-10-14");
    expect(report.scanned.blobs).toBe(1);
    const contentFindings = report.findings.filter(f => f.kind === "blob-content");
    expect(contentFindings).toHaveLength(1); /* مرة واحدة لكل كائن فريد */
    expect(contentFindings[0].rule).toBe("github-classic-token");
    expect(contentFindings[0].path).toBe("archive/creds.pem | docs/readme.txt"); /* كل الأسماء */
    const pathFindings = report.findings.filter(f => f.kind === "blob-path");
    expect(pathFindings.some(f => f.path === "archive/creds.pem")).toBe(true);
    expect(JSON.stringify(report)).not.toContain(fakeClassicToken);
  });

  it("scans commit-message text after an embedded 0x1e record separator (R11-REV-NF-002)", () => {
    const repoPath = initRepo();
    commitFile(repoPath, "a.txt", "content\n", "normal commit");
    const full = path.join(repoPath, "b.txt");
    fs.writeFileSync(full, "b\n", "utf8");
    git(repoPath, ["add", "b.txt"]);
    /* الرسالة تحوي فاصل السجلات 0x1e قبل الحارس المُجمّع وقت التشغيل وبلا أي
     * 0x1f بعده — التحليل القديم بالفواصل كان يُسقط المقطع كليًا (ZERO_FINDINGS
     * كاذبة)؛ الاستخراج الخام بطول معلن لا يتأثر بأي محرف داخل الرسالة. */
    git(repoPath, ["commit", "-m", `notes\x1efinal token ${fakeClassicToken}`]);
    const { report } = buildSanitizedReport(repoPath, "2026-10-14");
    const messageFindings = report.findings.filter(f => f.kind === "commit-message");
    expect(messageFindings).toHaveLength(1);
    expect(messageFindings[0].rule).toBe("github-classic-token");
    expect(messageFindings[0].object).toBe(git(repoPath, ["rev-parse", "HEAD"]).trim());
    expect(JSON.stringify(report)).not.toContain(fakeClassicToken);
  });

  it("attributes commit-message findings to the exact commit even with 0x1e and 0x1f inside the message (R11-REV-NF-002)", () => {
    const repoPath = initRepo();
    commitFile(repoPath, "a.txt", "content\n", "clean");
    const full = path.join(repoPath, "b.txt");
    fs.writeFileSync(full, "b\n", "utf8");
    git(repoPath, ["add", "b.txt"]);
    /* الفاصلان معًا: 0x1e و0x1f قبل الحارس — التحليل القديم كان يلتقطه أحيانًا
     * لكن بنسبته لمعرف مشوه؛ الاستخراج الخام ينسبه لالتزامه الحقيقي حصرًا. */
    git(repoPath, ["commit", "-m", `head\x1e mid\x1f tail ${fakeFineGrained}`]);
    const headSha = git(repoPath, ["rev-parse", "HEAD"]).trim();
    const { report } = buildSanitizedReport(repoPath, "2026-10-14");
    const messageFindings = report.findings.filter(f => f.kind === "commit-message");
    expect(messageFindings).toHaveLength(1);
    expect(messageFindings[0].rule).toBe("github-fine-grained-token");
    expect(messageFindings[0].object).toBe(headSha);
    expect(JSON.stringify(report)).not.toContain(fakeFineGrained);
  });

  it("survives commit messages that mimic cat-file batch framing (byte-exact raw-object parsing)", () => {
    const repoPath = initRepo();
    /* رسالة تقلد رؤوس cat-file وثنائية 0x1e/0x1f — التأطير الطولي للكائن الخام
     * لا ينكسر، والاستخلاص بعد أول سطر فارغ قانوني يظل مضبوطًا. */
    const hostile = [
      "0123456789abcdef0123456789abcdef01234567 commit 999",
      "",
      `framing-like body\x1e\x1f ${fakeClassicToken}`,
    ].join("\n");
    fs.writeFileSync(path.join(repoPath, "h.txt"), "h\n", "utf8");
    git(repoPath, ["add", "h.txt"]);
    git(repoPath, ["commit", "-m", hostile]);
    const headSha = git(repoPath, ["rev-parse", "HEAD"]).trim();
    const { report } = buildSanitizedReport(repoPath, "2026-10-14");
    expect(report.scanned.commits).toBe(1);
    const messageFindings = report.findings.filter(f => f.kind === "commit-message");
    expect(messageFindings).toHaveLength(1);
    expect(messageFindings[0].object).toBe(headSha);
    expect(messageFindings[0].rule).toBe("github-classic-token");
  });
});
