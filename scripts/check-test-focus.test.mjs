/**
 * المجموعة ٦ (برنامج التحصين الكامل): اختبارات فحص `.only`/`.skip` — حتمية
 * بلا شبكة ولا نوم. العينات تُبنى في مجلدات مؤقتة تحاكي بنية الجذور
 * المعتمدة (src/tests/…) وتُمسح بعد الاختبار؛ مجلد fixtures نفسه مستثنى
 * من الفحص الحقيقي فلا يسمّم النتيجة.
 *
 * للاحظة الأنية: كل استدعاء تركيز/تعطيل في هذا الملف يُبنى وقت التشغيل
 * (تجميع قطع نصية) كي لا يحمل مصدر الاختبار نفسه حرفية يصطادها الفحص
 * الحقيقي على المستودع الحي — الفحص لا يستثني ملفات اختبارات الحراس.
 *
 * تغطي: النجاح، الاصطياد (it/describe/test × only/skip)، تجاهل النص البريء،
 * اصطلاح التسمية، استثناء fixtures، سلوك CLI (أكواد الخروج وUSAGE
 * وROOT_MISSING)، والمستودع الحي نفسه (فحص دخاني).
 */
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import { afterAll, describe, expect, it } from "vitest";
import { FOCUS_REGEX, ROOT, isTestFileName, scanTestFile, scanTestTree } from "./check-test-focus.mjs";

const SCRIPT_PATH = fileURLToPath(import.meta.url).replace(
  /check-test-focus\.test\.mjs$/,
  "check-test-focus.mjs",
);

/* استدعاء مركّب وقت التشغيل: `${name}.${method}(${label}, …)` */
const focusCall = (name, method, label) =>
  [name, ".", method, "(", JSON.stringify(label), ", () => {});"].join("");

/* حرفية `${method}(` مركّبة وقت التشغيل للاستخدام في التوكّدات. */
const dotCall = method => [".", method, "("].join("");

const tempDirs = [];
function makeTempDir() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "micro-focus-"));
  tempDirs.push(dir);
  return dir;
}
afterAll(() => {
  for (const dir of tempDirs) fs.rmSync(dir, { recursive: true, force: true });
});

function writeTestFile(root, relative, content) {
  const absolute = path.join(root, relative);
  fs.mkdirSync(path.dirname(absolute), { recursive: true });
  fs.writeFileSync(absolute, content);
  return absolute;
}

function runCli(...args) {
  return spawnSync(process.execPath, [SCRIPT_PATH, ...args], { encoding: "utf8" });
}

describe("check-test-focus — detection", () => {
  it("detects focused/skipped call sites across it/describe/test with lines", () => {
    const root = makeTempDir();
    const file = writeTestFile(
      root,
      "src/a.test.ts",
      [
        'import { it } from "vitest";',
        'it("clean", () => {});',
        focusCall("it", "only", "focused"),
        focusCall("describe", "skip", "off"),
        focusCall("test", "skip", "off2"),
        "",
      ].join("\n"),
    );
    const findings = scanTestFile(file);
    expect(findings).toEqual([
      { line: 3, method: "only" },
      { line: 4, method: "skip" },
      { line: 5, method: "skip" },
    ]);
  });

  it("does not flag innocent text or property reads without a call", () => {
    const root = makeTempDir();
    const file = writeTestFile(
      root,
      "src/b.test.ts",
      [
        "// comment mentions only and skip words without any call",
        'const skipped = "skipped value";',
        "const parts = list.filter((x) => x.enabled);",
        "expect(result.enabled).toBeDefined();",
        "",
      ].join("\n"),
    );
    expect(scanTestFile(file)).toHaveLength(0);
    expect(FOCUS_REGEX.test("this was skipped (in the past)")).toBe(false);
  });

  it("collects only files named *.test.* / *.spec.* under the approved roots", () => {
    expect(isTestFileName("wallet.test.ts")).toBe(true);
    expect(isTestFileName("Editor.dom.test.tsx")).toBe(true);
    expect(isTestFileName("budget.spec.mjs")).toBe(true);
    expect(isTestFileName("check-bundle-budget.test.mjs")).toBe(true);
    expect(isTestFileName("index.ts")).toBe(false);
    expect(isTestFileName("README.test-notes.md")).toBe(false);
  });

  it("finds focus hits through scanTestTree and skips the documented scripts/fixtures path only", () => {
    const root = makeTempDir();
    writeTestFile(
      root,
      "tests/c.test.ts",
      ['it("x", () => {});', focusCall("it", "only", "y"), ""].join("\n"),
    );
    writeTestFile(root, "scripts/fixtures/f.test.ts", `${focusCall("it", "only", "fixture")}\n`);
    writeTestFile(root, "src/helper.ts", `${focusCall("it", "only", "not-a-test-file")}\n`);
    const findings = scanTestTree(root);
    expect(findings).toHaveLength(1);
    expect(findings[0]?.file).toContain("tests/c.test.ts");
    expect(findings[0]?.method).toBe("only");
    expect(findings[0]?.line).toBe(2);
  });

  it("F-05b: fixtures dirs outside the documented path are scanned now (regression)", () => {
    const root = makeTempDir();
    writeTestFile(
      root,
      "tests/fixtures/buried.test.ts",
      ['it("x", () => {});', focusCall("it", "only", "buried"), ""].join("\n"),
    );
    writeTestFile(
      root,
      "apps/prototype-web/client/src/fixtures/ui.test.ts",
      [focusCall("it", "skip", "ui"), ""].join("\n"),
    );
    const findings = scanTestTree(root);
    expect(findings).toHaveLength(2);
    expect(findings.some(f => f.file.includes("tests/fixtures/buried.test.ts"))).toBe(true);
    expect(findings.some(f => f.file.includes("ui.test.ts"))).toBe(true);
  });

  it("F-057: catches conditional focus names (skipIf/runIf/fixme/todo) in test files", () => {
    const root = makeTempDir();
    writeTestFile(
      root,
      "tests/conditional.test.ts",
      [
        `it${dotCall("skipIf")}("a", false, () => {});`,
        `it${dotCall("runIf")}("b", true, () => {});`,
        `it${dotCall("fixme")}("c", () => {});`,
        `describe${dotCall("todo")}("d", () => {});`,
        "",
      ].join("\n"),
    );
    const findings = scanTestTree(root);
    expect(findings.map(finding => finding.method).sort()).toEqual(["fixme", "runIf", "skipIf", "todo"]);
  });
});

describe("check-test-focus — CLI behavior", () => {
  it("exits 1 with file:method:line when a focus call exists", () => {
    const root = makeTempDir();
    writeTestFile(root, "src/d.test.ts", ['it("a", () => {});', focusCall("it", "only", "b"), ""].join("\n"));
    const result = runCli(root);
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("FOCUS_FOUND");
    expect(result.stderr).toContain("d.test.ts");
    expect(result.stderr).toContain(dotCall("only"));
    expect(result.stderr).toContain("line 2");
  });

  it("exits 0 with a pass report on a clean tree", () => {
    const root = makeTempDir();
    writeTestFile(root, "src/e.test.ts", 'it("a", () => {});\n');
    const result = runCli(root);
    expect(result.status).toBe(0);
    expect(result.stdout).toContain("check-test-focus: PASS");
  });

  it("rejects extra arguments and missing roots", () => {
    const extra = runCli("/tmp", "/another");
    expect(extra.status).toBe(1);
    expect(extra.stderr).toContain("USAGE");
    const missing = runCli(path.join(os.tmpdir(), "micro-definitely-missing-dir-xyz"));
    expect(missing.status).toBe(1);
    expect(missing.stderr).toContain("ROOT_MISSING");
  });

  it("passes on the live repository itself (smoke — 0 focus calls today)", () => {
    const result = runCli(ROOT);
    expect(result.status).toBe(0);
    expect(result.stdout).toContain("check-test-focus: PASS");
  });
});
