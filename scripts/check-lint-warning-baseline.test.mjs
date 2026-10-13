/**
 * R11 W1A-1 / D-05: اختبارات نقطة استقصاء تحذيرات lint — حتمية بلا شبكة.
 *
 * المنهج: المقارن يُختبر اصطناعيًا (مصفوفات أعداد وقواعد تركيبية) فلا
 * تشغيل eslint حقيقي داخل الاختبارات (يعمل مرة واحدة في سلسلة guards
 * عبر pnpm check — وحدة القياس الحية هي تشغيل الحارس نفسه). تغطي:
 *  +1 و-1 برسالتين مميزتين، وتبديل توزيع القواعد عند ثبات المجموع،
 *  والتطابق التام يمر، وتحليل JSON (أخطاء/تحذيرات/تجميع قواعد)، وسلوك
 *  CLI على مسار غير مستودع (استخدام خاطئ = 2).
 */
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  LINT_TARGETS,
  LINT_WARNING_BASELINE_BY_RULE,
  LINT_WARNING_BASELINE_TOTAL,
  lintWarningViolations,
  parseEslintJsonWarnings,
} from "./check-lint-warning-baseline.mjs";

const SCRIPT_PATH = fileURLToPath(import.meta.url).replace(
  /check-lint-warning-baseline\.test\.mjs$/,
  "check-lint-warning-baseline.mjs",
);

const baselineMix = { ...LINT_WARNING_BASELINE_BY_RULE };

describe("lint warning tripwire comparator (synthetic drills — D-05 / OD-GUARD Option A)", () => {
  it("the baseline is exactly 35 = 18 max-lines-per-function + 17 complexity", () => {
    expect(LINT_WARNING_BASELINE_TOTAL).toBe(35);
    expect(LINT_WARNING_BASELINE_BY_RULE).toEqual({ "max-lines-per-function": 18, complexity: 17 });
    expect(Object.values(LINT_WARNING_BASELINE_BY_RULE).reduce((s, n) => s + n, 0)).toBe(35);
  });

  it("exact match passes (no violations)", () => {
    expect(lintWarningViolations(35, baselineMix)).toEqual([]);
  });

  it("+1 drill: increase fails with WARNING_COUNT_INCREASED and per-rule detail", () => {
    const violations = lintWarningViolations(36, { ...baselineMix, complexity: 18 });
    expect(violations).toHaveLength(1);
    expect(violations[0].rule).toBe("WARNING_COUNT_INCREASED");
    expect(violations[0].detail).toContain("36 > 35");
    expect(violations[0].detail).toContain("complexity=18");
  });

  it("-1 drill: decrease fails with the distinct WARNING_COUNT_DECREASED message (no banking)", () => {
    const violations = lintWarningViolations(34, { ...baselineMix, complexity: 16 });
    expect(violations).toHaveLength(1);
    expect(violations[0].rule).toBe("WARNING_COUNT_DECREASED");
    expect(violations[0].detail).toContain("34 < 35");
    expect(violations[0].detail).toContain("رصيد");
  });

  it("rule-mix drill: same total, different distribution fails with RULE_MIX_CHANGED", () => {
    const violations = lintWarningViolations(35, { "max-lines-per-function": 19, complexity: 16 });
    expect(violations).toHaveLength(2);
    expect(violations.every(v => v.rule === "RULE_MIX_CHANGED")).toBe(true);
    expect(violations.some(v => v.detail.includes("max-lines-per-function"))).toBe(true);
    expect(violations.some(v => v.detail.includes("complexity"))).toBe(true);
  });

  it("a brand-new warning rule fails (unknown rule in the mix)", () => {
    const violations = lintWarningViolations(35, { ...baselineMix, "no-new-warnings": 1, complexity: 16 });
    expect(violations.some(v => v.rule === "RULE_MIX_CHANGED" && v.detail.includes("no-new-warnings"))).toBe(true);
  });

  it("increase outranks mix reporting: 36 with a swapped mix reports INCREASED (single headline)", () => {
    const violations = lintWarningViolations(36, { "max-lines-per-function": 19, complexity: 17 });
    expect(violations).toHaveLength(1);
    expect(violations[0].rule).toBe("WARNING_COUNT_INCREASED");
  });

  it("eslint JSON parsing separates errors from warnings and aggregates by rule", () => {
    const json = JSON.stringify([
      {
        filePath: "/repo/src/a.ts",
        messages: [
          { severity: 1, ruleId: "complexity", line: 1 },
          { severity: 1, ruleId: "complexity", line: 2 },
          { severity: 2, ruleId: "no-unused-vars", line: 3 },
        ],
      },
      { filePath: "/repo/src/b.ts", messages: [{ severity: 1, ruleId: "no-explicit-any", line: 9 }] },
      { filePath: "/repo/src/clean.ts", messages: [] },
    ]);
    const parsed = parseEslintJsonWarnings(json);
    expect(parsed.warnings).toHaveLength(3);
    expect(parsed.errors).toHaveLength(1);
    expect(parsed.byRule).toEqual({ complexity: 2, "no-explicit-any": 1 });
  });

  it("the lint targets are exactly the pnpm lint targets", () => {
    expect(LINT_TARGETS).toEqual(["src", "tests", "apps/prototype-web/client/src", "tools"]);
  });

  it("CLI usage error exits 2 on a non-repo path", () => {
    const run = spawnSync("node", [SCRIPT_PATH, "/definitely-not-a-repo"], { encoding: "utf8" });
    expect(run.status).toBe(2);
    expect(run.stderr).toContain("USAGE");
  });
});
