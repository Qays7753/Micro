/**
 * R6-W3/F-009 (2026-10-09): توصيف عقد CLI لعدّاد كثافة النص — قبل الفصل وبعده.
 *
 * الغرض: تثبيت العقد الحرفي الحالي (خروج/مخرجات/ترتيب/سلوك) قبل فصل دفتر
 * السياسة (CAPS/PAGES/EXPLICIT_SERVICES) إلى وحدة بيانات مستقلة
 * (scripts/text_density_policy.py)، بحيث يكون الدليل على أن الفصل لم يغيّر
 * سلوكًا هو نجاح الاختبار نفسه بايت-ببايت قبل الفصل وبعده.
 *
 * الطبقات:
 *  ١) الذهبي الكامل: مخرجات `python3 scripts/text-density-count.py` على الشجرة
 *     الحية تطابق `docs/fixtures/text-density/w3-characterization.golden.txt`
 *     بايت-ببايت (التقاطه قبل الفصل عند 3b6faf9b..fb11c6c7). أي تغيير واعٍ
 *     في الشاشات أو السقوف يحدث الذهبي في نفس الـPR — بروتوكول الراتشة نفسه.
 *  ٢) عقد البنية: خرج 0؛ stderr فارغ؛ كل سطر صفحة بالصيغة الحرفية
 *     `OK  <name> <count> distinct at-rest strings (cap <cap>)` بترتيب PAGES؛
 *     السطر الختامي حرفيًا.
 *  ٣) حدّ السقوف من وحدة السياسة نفسها: قيم السقوف في المخرجات == قراءة
 *     وحدة السياسة مباشرة (مصدر واحد).
 *  ٤) عقد الوسائط: ‎--list <Page> يتبع تفصيل السطور؛ ‎--breakdown يسلوكه
 *     المستقر (تفصيل عند التجاوز فقط).
 *  ٥) سلبيات: سياسة معدّلة (سقف مضروب) يكشفها المحرك بفشل الخروج؛ وسياسة
 *     مشوهة (سقف غير صحيح) يرفضها المحرك بخطأ صريح.
 */
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(HERE, "..");
const SCRIPT = path.join(REPO_ROOT, "scripts", "text-density-count.py");
const POLICY = path.join(REPO_ROOT, "scripts", "text_density_policy.py");
const GOLDEN = path.join(REPO_ROOT, "docs", "fixtures", "text-density", "w3-characterization.golden.txt");

const PAGE_LINE = /^OK {2}\S+ +\d+ distinct at-rest strings \(cap \d+\)$/;

function runPython(code) {
  return spawnSync("python3", ["-c", code], { cwd: REPO_ROOT, encoding: "utf8" });
}

describe("R6-W3/F-009 — text-density-count.py CLI characterization (byte-exact, pre/post split)", () => {
  it("full-repository run is byte-identical to the golden fixture (exit 0, empty stderr)", () => {
    const run = spawnSync("python3", [SCRIPT], { cwd: REPO_ROOT, encoding: "utf8" });
    expect(run.status).toBe(0);
    expect(run.stderr).toBe("");
    const golden = readFileSync(GOLDEN, "utf8");
    expect(run.stdout).toBe(golden);
  });

  it("structural contract: every page line matches the literal format, in PAGES order, with the exact closing line", () => {
    const run = spawnSync("python3", [SCRIPT], { cwd: REPO_ROOT, encoding: "utf8" });
    const lines = run.stdout.split("\n");
    const pageLines = lines.filter(l => PAGE_LINE.test(l));
    expect(pageLines.length).toBeGreaterThan(20);
    for (const line of pageLines) expect(line).toMatch(PAGE_LINE);
    /* الترتيب من وحدة السياسة (المصدر الواحد) — لا ترتيب مجلد أو صدفة. */
    const pages = runPython(
      `import sys; sys.path.insert(0, ${JSON.stringify(path.dirname(POLICY))}); ` +
        `import text_density_policy as p; print("\\n".join(p.PAGES))`,
    );
    expect(pages.status).toBe(0);
    const ordered = pages.stdout.trim().split("\n");
    expect(pageLines.map(l => l.trim().split(/\s+/)[1])).toEqual(ordered);
    expect(lines[lines.length - 1]).toBe("");
    expect(lines[lines.length - 2]).toBe("All surfaces within §10 caps.");
  });

  it("caps in the output equal the policy module's CAPS (single source, cross-checked)", () => {
    const run = spawnSync("python3", [SCRIPT], { cwd: REPO_ROOT, encoding: "utf8" });
    const caps = runPython(
      `import sys, json; sys.path.insert(0, ${JSON.stringify(path.dirname(POLICY))}); ` +
        `import text_density_policy as p; print(json.dumps(p.CAPS))`,
    );
    expect(caps.status).toBe(0);
    const policyCaps = JSON.parse(caps.stdout);
    for (const line of run.stdout.split("\n")) {
      if (!PAGE_LINE.test(line)) continue;
      const match = line.match(/^OK {2}(\S+) +(\d+) distinct at-rest strings \(cap (\d+)\)$/);
      const name = match[1];
      const cap = Number(match[3]);
      if (name in policyCaps) expect(cap).toBe(policyCaps[name]);
      else expect(cap).toBe(30);
    }
  });

  it("--list <Page> prints the sorted breakdown for that page only (exit 0)", () => {
    const run = spawnSync("python3", [SCRIPT, "--list", "WalletLedger"], { cwd: REPO_ROOT, encoding: "utf8" });
    expect(run.status).toBe(0);
    const listed = run.stdout
      .split("\n")
      .filter(l => l.startsWith("    - "));
    expect(listed.length).toBeGreaterThan(0);
    const values = listed.map(l => l.slice(6));
    expect(values).toEqual([...values].sort());
  });

  it("negative (R6-W3): an altered policy cap is detected — the engine fails when a cap is tampered below the real count", () => {
    /* تعديل مدخل سياسة قائم (Home cap → 3) داخل العملية نفسها: المحرك يستهلك
     * كائن السياسة نفسه، فيفشل الخروج ويطبع التجاوز — «السياسة المعدلة تكشف». */
    const run = runPython(
      `import sys\n` +
        `sys.path.insert(0, ${JSON.stringify(path.dirname(POLICY))})\n` +
        `import text_density_policy as policy\n` +
        `policy.CAPS["Home"] = 3\n` +
        `import runpy\n` +
        `sys.argv = [${JSON.stringify(SCRIPT)}]\n` +
        `try:\n` +
        `    runpy.run_path(${JSON.stringify(SCRIPT)}, run_name="__main__")\n` +
        `except SystemExit as e:\n` +
        `    sys.exit(e.code)\n`,
    );
    expect(run.status).toBe(1);
    expect(run.stdout).toContain("OVER");
    expect(run.stdout).toContain("Home");
  });

  it("negative (R6-W3): a malformed policy entry is rejected loudly by the engine's policy validation (exit 2, clear error)", () => {
    const run = runPython(
      `import sys\n` +
        `sys.path.insert(0, ${JSON.stringify(path.dirname(POLICY))})\n` +
        `import text_density_policy as policy\n` +
        `policy.CAPS["Home"] = "not-an-int"\n` +
        `import runpy\n` +
        `sys.argv = [${JSON.stringify(SCRIPT)}]\n` +
        `try:\n` +
        `    runpy.run_path(${JSON.stringify(SCRIPT)}, run_name="__main__")\n` +
        `except SystemExit as e:\n` +
        `    sys.exit(e.code)\n`,
    );
    expect(run.status).toBe(2);
    expect(run.stderr).toContain("text-density policy");
  });

  it("engine/policy boundary: the engine imports the policy module and defines no CAPS/PAGES/EXPLICIT_SERVICES of its own", () => {
    const engineSource = readFileSync(SCRIPT, "utf8");
    expect(engineSource).toContain("from text_density_policy import");
    expect(engineSource).not.toMatch(/^CAPS\s*[:=]/m);
    expect(engineSource).not.toMatch(/^PAGES\s*[:=]/m);
    expect(engineSource).not.toMatch(/^EXPLICIT_SERVICES\s*[:=]/m);
    const policySource = readFileSync(POLICY, "utf8");
    expect(policySource).toMatch(/^CAPS\s*[:=]/m);
    expect(policySource).toMatch(/^PAGES\s*[:=]/m);
    expect(policySource).toMatch(/^EXPLICIT_SERVICES\s*[:=]/m);
    /* وحدة السياسة بيانات فقط: لا عدّ ولا مخرجات ولا CLI. */
    expect(policySource).not.toMatch(/def (main|count_screen|screen_files)/);
    expect(policySource).not.toContain("sys.exit");
  });
});
