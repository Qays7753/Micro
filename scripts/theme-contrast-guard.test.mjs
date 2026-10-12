/**
 * F-030 (R10-B5 — 2026-10-13): سلبيات حارس تباين السمة D5 — نفس نمط
 * subprocess: الحارس يستورد عبر importlib داخل عملية بايثون، ثم تُعاد
 * توجيه مصادره (LIGHT_CSS/DARK_CSS/INDEX_CSS) إلى ملفات عينات مؤقتة
 * ويُعاد بذر المفاتيح المحلولة (light/dark/index_light/index_dark) عبر
 * parse_zone نفسها، ثم تُستبدل مصفوفة الأزواج بمصفوفة مسبار محكومة —
 * فيُختبَر المسار الكامل (parse_zone + resolve + build + contrast + main)
 * ضد مدخلات مصطنعة بلا أي لمس للشجرة الحية.
 *
 * الطبقات:
 *  ١) دخاني حي: الحارس على الشجرة الحية يخرج 0.
 *  ٢) عنصر تحكم موجب: زوج نظيف (21:1) وزوج علامة فوق الأرضية — يخرج 0
 *     (يثبت أن العينة ليست فاشلة بالصدفة).
 *  ٣) نص تحت أرضية 4.5:1 — يُصطاد بالرسالة الحرفية مع القيمتين.
 *  ٤) علامة تحت أرضية 3:1 — تُصطاد برسالتها.
 *  ٥) رمز غير محلول — يُصطاد صراحة.
 *  ٦) سلسلة var() تُحل حتى hex النهائي قبل القياس (resolve pipeline).
 *  ٧) الطبقة الداكنة تُبنى كتراكب فوق الفاتح (build('dark')) — إعادة ربط
 *     canvas داكنة تكشف زوجًا يفشل في الداكن وحده.
 */
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, describe, expect, it } from "vitest";

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SCRIPT = path.join(REPO_ROOT, "scripts", "theme-contrast-guard.py");

const tempDirs = [];
function makeTempDir() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "micro-tcg-"));
  tempDirs.push(dir);
  return dir;
}
afterAll(() => {
  for (const dir of tempDirs) fs.rmSync(dir, { recursive: true, force: true });
});

/**
 * تشغيل الحارس الحرفي ضد ملفات عينات: يعاد توجيه المصادر الثلاثة ثم يعاد
 * بذر المفاتيح عبر parse_zone نفسها، وتُستبدل المصفوفتان بمصفوفتي المسبار،
 * ثم main() يُستدعى كما هو.
 */
function runGuardAgainst({ light, dark = "", index = "", textPairs, markPairs }) {
  const root = makeTempDir();
  const lightCss = path.join(root, "vf-tokens.css");
  const darkCss = path.join(root, "theme-dark.css");
  const indexCss = path.join(root, "index.css");
  fs.writeFileSync(lightCss, light, "utf8");
  fs.writeFileSync(darkCss, dark, "utf8");
  fs.writeFileSync(indexCss, index, "utf8");
  const driver = [
    "import importlib.util, pathlib, sys",
    `spec = importlib.util.spec_from_file_location("tcg", ${JSON.stringify(SCRIPT)})`,
    "m = importlib.util.module_from_spec(spec)",
    "spec.loader.exec_module(m)",
    `m.LIGHT_CSS = pathlib.Path(${JSON.stringify(lightCss)})`,
    `m.DARK_CSS = pathlib.Path(${JSON.stringify(darkCss)})`,
    `m.INDEX_CSS = pathlib.Path(${JSON.stringify(indexCss)})`,
    'm.light = m.parse_zone(m.LIGHT_CSS, ":root")',
    'm.dark = m.parse_zone(m.DARK_CSS, ":root.dark")',
    'm.index_light = m.parse_zone(m.INDEX_CSS, ":root")',
    'm.index_dark = m.parse_zone(m.INDEX_CSS, ":root.dark")',
    `m.TEXT_PAIRS = ${JSON.stringify(textPairs ?? [])}`,
    `m.MARK_PAIRS = ${JSON.stringify(markPairs ?? [])}`,
    "sys.exit(m.main())",
  ].join("\n");
  return spawnSync("python3", ["-c", driver], { cwd: REPO_ROOT, encoding: "utf8" });
}

describe("F-030 — theme-contrast-guard.py negatives (subprocess, fixture-driven)", () => {
  it("live-tree smoke: the guard passes on the real repository (exit 0)", () => {
    const run = spawnSync("python3", [SCRIPT], { cwd: REPO_ROOT, encoding: "utf8" });
    expect(run.status).toBe(0);
    expect(run.stdout).toContain("pairs pass");
  });

  it("positive control: a clean text pair and a clean mark pair exit 0", () => {
    const run = runGuardAgainst({
      light: [":root {", "  --vf-ink: #000000;", "  --vf-canvas: #ffffff;", "  --vf-info: #767676;", "}"].join("\n"),
      textPairs: [["probe ink on probe canvas", "--vf-ink", "--vf-canvas"]],
      markPairs: [["probe mark on probe canvas", "--vf-info", "--vf-canvas"]],
    });
    expect(run.status).toBe(0);
    /* الزوجان × سمتان (فاتح/داكن) = 4 أزواج محسوبة — البذرة نفسها تُثبت
     * أن main() يفحص السمتين معًا لا الفاتحة وحدها. */
    expect(run.stdout).toContain("4 pairs pass");
  });

  it("a text pair below the 4.5:1 floor is caught with both hex values in the message", () => {
    const run = runGuardAgainst({
      light: [":root {", "  --vf-ink: #777777;", "  --vf-canvas: #888888;", "}"].join("\n"),
      textPairs: [["probe ink on probe canvas", "--vf-ink", "--vf-canvas"]],
    });
    expect(run.status).toBe(1);
    expect(run.stdout).toContain("violations");
    expect(run.stdout).toContain("[light] probe ink on probe canvas");
    expect(run.stdout).toContain("< 4.5:1");
    expect(run.stdout).toContain("(#777777 on #888888)");
  });

  it("a mark pair below the 3:1 floor is caught with its own floor in the message", () => {
    const run = runGuardAgainst({
      light: [":root {", "  --vf-info: #999999;", "  --vf-canvas: #aaaaaa;", "}"].join("\n"),
      markPairs: [["probe mark on probe canvas", "--vf-info", "--vf-canvas"]],
    });
    expect(run.status).toBe(1);
    expect(run.stdout).toContain("[light] probe mark on probe canvas");
    expect(run.stdout).toContain("< 3.0:1");
  });

  it("an unresolved token is reported explicitly, not silently skipped", () => {
    const run = runGuardAgainst({
      light: [":root {", "  --vf-canvas: #ffffff;", "}"].join("\n"),
      textPairs: [["probe missing ink", "--vf-nonexistent", "--vf-canvas"]],
    });
    expect(run.status).toBe(1);
    expect(run.stdout).toContain("unresolved token");
  });

  it("var() chains resolve to the final hex before measuring (resolve pipeline)", () => {
    const run = runGuardAgainst({
      light: [
        ":root {",
        "  --vf-ink: var(--vf-ink-base);",
        "  --vf-ink-base: #777777;",
        "  --vf-canvas: #888888;",
        "}",
      ].join("\n"),
      textPairs: [["chained ink on canvas", "--vf-ink", "--vf-canvas"]],
    });
    expect(run.status).toBe(1);
    expect(run.stdout).toContain("[light] chained ink on canvas");
    expect(run.stdout).toContain("(#777777 on #888888)");
  });

  it("dark is built as an overlay over light: a dark-only canvas rebinding fails only in dark", () => {
    const run = runGuardAgainst({
      light: [":root {", "  --vf-ink: #000000;", "  --vf-canvas: #ffffff;", "}"].join("\n"),
      dark: [":root.dark {", "  --vf-canvas: #222222;", "}"].join("\n"),
      textPairs: [["overlay ink on canvas", "--vf-ink", "--vf-canvas"]],
    });
    expect(run.status).toBe(1);
    expect(run.stdout).toContain("[dark] overlay ink on canvas");
    expect(run.stdout).toContain("< 4.5:1");
    expect(run.stdout).not.toContain("[light] overlay ink on canvas");
  });
});
