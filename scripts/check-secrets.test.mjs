/**
 * المجموعة ٦ (برنامج التحصين الكامل): اختبارات فحص الأسرار — حتمية بلا
 * شبكة ولا نوم؛ عينات الأسرار مزيفة بنيويًا (بادئة النمط + حشو لا يصلح
 * توكنًا حقيقيًا) وتعيش في مجلد fixtures المستثنى الضيق من الفحص نفسه.
 *
 * تغطي: النجاح، الاصطياد لكل عائلة نمط، عدم تطابق القيمة أبدًا في المخرجات،
 * ملفات الأسماء الممنوعة، سلوك CLI (أكواد الخروج وUSAGE وROOT_MISSING)،
 * والمستودع الحي نفسه (فحص دخاني يثبت النظافة الحالية).
 */
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import { afterAll, describe, expect, it } from "vitest";
import { ROOT, isSecretFileName, scanContent, scanTree } from "./check-secrets.mjs";

const SCRIPT_PATH = fileURLToPath(import.meta.url).replace(
  /check-secrets\.test\.mjs$/,
  "check-secrets.mjs",
);

const FAKE_GITHUB_CLASSIC = `ghp_${"A".repeat(40)}`;
const FAKE_GITHUB_FINE = `github_pat_${"B".repeat(50)}`;
const FAKE_AWS_KEY = `AKIA${"C".repeat(16)}`;
const FAKE_SLACK = `xoxb-${"D".repeat(24)}`;
const FAKE_OPENAI = `sk-${"E".repeat(40)}`;
/* يُبنى وقت التشغيل كي لا يحمل مصدر الاختبار نفسه نمطًا كاملًا يصطاده
 * الفحص الحقيقي على المستودع الحي (الاستثناء الأنيق: لا استثناء). */
const FAKE_PRIVATE_KEY = ["-----BEGIN", "RSA", "PRIVATE", "KEY-----"].join(" ");

const tempDirs = [];
function makeTempDir() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "micro-secrets-"));
  tempDirs.push(dir);
  return dir;
}
afterAll(() => {
  for (const dir of tempDirs) fs.rmSync(dir, { recursive: true, force: true });
});

function runCli(...args) {
  return spawnSync(process.execPath, [SCRIPT_PATH, ...args], { encoding: "utf8" });
}

describe("check-secrets — pattern detection", () => {
  it("passes on clean content with no findings", () => {
    expect(scanContent("const token = 'safe-local-placeholder';\n")).toHaveLength(0);
  });

  it("catches each fake secret family exactly once and never returns the value", () => {
    const content = [
      `line one ${FAKE_GITHUB_CLASSIC} inline`,
      `line two ${FAKE_GITHUB_FINE}`,
      `line three ${FAKE_AWS_KEY}`,
      `line four ${FAKE_OPENAI}`,
      `line five ${FAKE_PRIVATE_KEY}`,
    ].join("\n");
    const findings = scanContent(content);
    const names = findings.map((f) => f.patternName);
    expect(names).toContain("github-classic-token");
    expect(names).toContain("github-fine-grained-token");
    expect(names).toContain("aws-access-key-id");
    expect(names).toContain("openai-style-key");
    expect(names).toContain("private-key-block");
    const rendered = JSON.stringify(findings);
    expect(rendered).not.toContain(FAKE_GITHUB_CLASSIC);
    expect(rendered).not.toContain("ghp_");
    expect(rendered).not.toContain("github_pat_");
  });

  it("reports the correct line number for a mid-file secret", () => {
    const content = `alpha\nbeta\ngamma ${FAKE_SLACK}\ndelta\n`;
    const findings = scanContent(content);
    expect(findings).toHaveLength(1);
    expect(findings[0]?.line).toBe(3);
  });

  it("flags obvious secret file names (strict by design — .env.* all flagged)", () => {
    expect(isSecretFileName("/config/.env")).toBe(true);
    expect(isSecretFileName("/config/.env.production")).toBe(true);
    expect(isSecretFileName("/keys/server.pem")).toBe(true);
    expect(isSecretFileName("/src/private.key")).toBe(true);
    expect(isSecretFileName("/docs/.env.example")).toBe(true);
    expect(isSecretFileName("/src/types.ts")).toBe(false);
  });
});

describe("check-secrets — tree scan on fixtures", () => {
  it("finds fake tokens in a fixture tree without ever exposing the values", () => {
    const root = makeTempDir();
    fs.writeFileSync(path.join(root, "notes.md"), `normal text\n${FAKE_GITHUB_CLASSIC}\n`);
    fs.mkdirSync(path.join(root, "src"), { recursive: true });
    fs.writeFileSync(path.join(root, "src", "leak.ts"), `const key = "${FAKE_OPENAI}";\n`);
    const findings = scanTree(root);
    const rendered = JSON.stringify(findings);
    expect(findings).toHaveLength(2);
    expect(rendered).not.toContain(FAKE_GITHUB_CLASSIC);
    expect(rendered).not.toContain(FAKE_OPENAI);
  });

  it("skips excluded directories (node_modules/dist/fixtures)", () => {
    const root = makeTempDir();
    fs.mkdirSync(path.join(root, "node_modules", "pkg"), { recursive: true });
    fs.writeFileSync(path.join(root, "node_modules", "pkg", "dep.js"), FAKE_GITHUB_FINE);
    fs.mkdirSync(path.join(root, "fixtures"), { recursive: true });
    fs.writeFileSync(path.join(root, "fixtures", "sample.txt"), FAKE_AWS_KEY);
    expect(scanTree(root)).toHaveLength(0);
  });

  it("scans binary-ish files by bytes without crashing", () => {
    const root = makeTempDir();
    const buffer = Buffer.concat([
      Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
      Buffer.from(`\n${FAKE_PRIVATE_KEY}\n`),
    ]);
    fs.writeFileSync(path.join(root, "image.png"), buffer);
    const findings = scanTree(root);
    expect(findings.map((f) => f.patternName)).toContain("private-key-block");
  });
});

describe("check-secrets — CLI behavior", () => {
  it("exits 1 on a hit, prints pattern+file+line, and never prints the token value", () => {
    const root = makeTempDir();
    fs.writeFileSync(path.join(root, "leak.md"), `intro\n${FAKE_GITHUB_CLASSIC}\n`);
    const result = runCli(root);
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("SECRET_FOUND");
    expect(result.stderr).toContain("leak.md");
    expect(result.stderr).toContain("github-classic-token");
    expect(result.stderr).not.toContain(FAKE_GITHUB_CLASSIC);
    expect(result.stderr).not.toContain(FAKE_GITHUB_CLASSIC.slice(0, 8));
  });

  it("exits 0 with a pass report on a clean tree", () => {
    const root = makeTempDir();
    fs.writeFileSync(path.join(root, "readme.md"), "clean content only\n");
    const result = runCli(root);
    expect(result.status).toBe(0);
    expect(result.stdout).toContain("check-secrets: PASS");
  });

  it("rejects extra arguments (USAGE) and missing roots (ROOT_MISSING)", () => {
    const extra = runCli("/tmp", "/another");
    expect(extra.status).toBe(1);
    expect(extra.stderr).toContain("USAGE");
    const missing = runCli(path.join(os.tmpdir(), "micro-definitely-missing-dir-xyz"));
    expect(missing.status).toBe(1);
    expect(missing.stderr).toContain("ROOT_MISSING");
  });

  it("passes on the live repository itself (smoke — 0 secrets today)", () => {
    const result = runCli(ROOT);
    expect(result.status).toBe(0);
    expect(result.stdout).toContain("check-secrets: PASS");
  });
});
