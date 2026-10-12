/**
 * F-030 (R10-B5 — 2026-10-13): سلبيات حارس رموز التصميم §9 — على نمط
 * توصيف كثافة النص (subprocess-driven): الحارس يستورد داخل عملية بايثون
 * عبر importlib ثم يُعاد توجيه CLIENT_SRC إلى شجرة عينات مؤقتة محكومة،
 * فيُشغَّل main() نفسه الحرفي ضد مدخلات مصطنعة. لا شبكة ولا نوم ولا
 * تعديل على الشجرة الحية إطلاقًا.
 *
 * الطبقات:
 *  ١) دخاني حي: الحارس على الشجرة الحية يخرج 0 (العقد الحالي).
 *  ٢) عينة نظيفة كاملة: index.css سليم color-scheme، قيم على سلم §1،
 *     hex خام داخل منطقة :root في ملف المالك المسموح — يخرج 0 (يثبت أن
 *     العينة ليست مخالفة بالصدفة).
 *  ٣) عينة مخالفات: hex خام خارج المناطق، rgb خارج المناطق، قيمة خارج
 *     السلم (margin/border-radius/font-size/z-index)، لون متقاعد محظور،
 *     hex داخل .dark في ملف غير المالك، hex في TSX — كل واحدة تُصطاد
 *     برسالتها الحرفية والخروج 1.
 *  ٤) غياب color-scheme يُصطاد صراحة.
 */
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, describe, expect, it } from "vitest";

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SCRIPT = path.join(REPO_ROOT, "scripts", "design-token-guards.py");

const tempDirs = [];
function makeTempDir() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "micro-dtg-"));
  tempDirs.push(dir);
  return dir;
}
afterAll(() => {
  for (const dir of tempDirs) fs.rmSync(dir, { recursive: true, force: true });
});

/** تشغيل الحارس الحرفي مع CLIENT_SRC معادًا توجيهه إلى شجرة عينات. */
function runGuardAgainst(clientSrc) {
  const driver = [
    "import importlib.util, pathlib, sys",
    `spec = importlib.util.spec_from_file_location("dtg", ${JSON.stringify(SCRIPT)})`,
    "m = importlib.util.module_from_spec(spec)",
    "spec.loader.exec_module(m)",
    `m.CLIENT_SRC = pathlib.Path(${JSON.stringify(clientSrc)})`,
    "sys.exit(m.main())",
  ].join("\n");
  return spawnSync("python3", ["-c", driver], { cwd: REPO_ROOT, encoding: "utf8" });
}

function writeFixture(tree) {
  const root = makeTempDir();
  for (const [rel, content] of Object.entries(tree)) {
    const full = path.join(root, rel);
    fs.mkdirSync(path.dirname(full), { recursive: true });
    fs.writeFileSync(full, content, "utf8");
  }
  return root;
}

const CLEAN_INDEX = [":root {", "  color-scheme: light;", "}"].join("\n");
const CLEAN_DARK = [":root.dark {", "  color-scheme: dark;", "}"].join("\n");

describe("F-030 — design-token-guards.py negatives (subprocess, fixture-driven)", () => {
  it("live-tree smoke: the guard passes on the real repository (exit 0)", () => {
    const run = spawnSync("python3", [SCRIPT], { cwd: REPO_ROOT, encoding: "utf8" });
    expect(run.status).toBe(0);
    expect(run.stdout).toContain("no raw hex, all values on scale");
  });

  it("a clean fixture tree passes (valid color-scheme, on-scale values, owner-zone hex)", () => {
    const root = writeFixture({
      "index.css": CLEAN_INDEX,
      "styles/theme-dark.css": CLEAN_DARK,
      "styles/vf-tokens.css": [":root {", "  --vf-probe: #123456;", "}"].join("\n"),
      "styles/app.css": [
        ".card {",
        "  margin: 8px;",
        "  padding: auto;",
        "  border-radius: 999px;",
        "  font-size: 0.75rem;",
        "  z-index: 30;",
        "  gap: var(--space-3);",
        "  margin-top: calc(100% - 8px);",
        "}",
      ].join("\n"),
    });
    const run = runGuardAgainst(root);
    expect(run.status).toBe(0);
    expect(run.stdout).toContain("no raw hex, all values on scale");
  });

  it("every violation family is caught with its literal message (exit 1)", () => {
    const root = writeFixture({
      "index.css": CLEAN_INDEX,
      "styles/theme-dark.css": CLEAN_DARK,
      /* إقرارات القيم يجب أن تكون كلٌّ على سطرها كما في مصادر المستودع —
       * DECL في الحارس يرسي على ^سطر (وهذا نفسه حدّ موثق للكشف). */
      "styles/app.css": [
        ".rawhex {",
        "  color: #ab12cd;",
        "}",
        ".retired {",
        "  color: #cc785c;",
        "}",
        ".dark {",
        "  color: #abcdef;",
        "}",
        ".rgblit {",
        "  background: rgb(1, 2, 3);",
        "}",
        ".offmargin {",
        "  margin: 7px;",
        "}",
        ".offradius {",
        "  border-radius: 13px;",
        "}",
        ".offont {",
        "  font-size: 0.8rem;",
        "}",
        ".offz {",
        "  z-index: 5;",
        "}",
      ].join("\n"),
      "components/Bad.tsx": 'export const c = "#ff0000";\n',
    });
    const run = runGuardAgainst(root);
    expect(run.status).toBe(1);
    expect(run.stdout).toContain("violations");
    expect(run.stdout).toContain("raw hex #ab12cd");
    expect(run.stdout).toContain("retired value #cc785c — banned from the runtime path");
    expect(run.stdout).toContain("inside .dark outside theme-dark.css — dark values have a single owner");
    expect(run.stdout).toContain("rgb/hsl");
    expect(run.stdout).toContain("margin: 7px");
    expect(run.stdout).toContain("border-radius: 13px");
    expect(run.stdout).toContain("font-size: 0.8rem");
    expect(run.stdout).toContain("z-index: 5");
    expect(run.stdout).toContain("#ff0000 في TSX");
  });

  it("a missing color-scheme declaration is caught explicitly", () => {
    const root = writeFixture({
      "index.css": [":root {", "  --x: 1;", "}"].join("\n"),
      "styles/theme-dark.css": CLEAN_DARK,
    });
    const run = runGuardAgainst(root);
    expect(run.status).toBe(1);
    expect(run.stdout).toContain("missing `color-scheme: light` for native controls");
  });
});
