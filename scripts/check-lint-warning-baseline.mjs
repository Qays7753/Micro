#!/usr/bin/env node
/**
 * R11 W1A-1 / D-05 (R10A-F-026، قرار OD-GUARD الخيار A، 2026-10-13): نقطة
 * استقصاء دقيقة لعدد تحذيرات lint — الأساس 35 بالضبط، والسقف 37 باقٍ
 * حرفيًا في `package.json` (سطر lint) لا يُمس.
 *
 * المبدأ: السقف 37 يمنع الانفجار فقط؛ هذه النقطة تمنع الانجراف الصامت في
 * الاتجاهين — الزيادة تضغط على السقف بلا قرار، والنقصان «لا يُودَع رصيدًا
 * مستقبليًا»: أي تغيّر في العدد يتطلب إعادة إرساء موثقة في نفس الـPR
 * (بروتوكول الراتشة المعتمد)، فلا يُستهلك الهامش الصامت ولا يُخفى النمو.
 *
 * المنهج (مسجل حرفيًا):
 *  - الأمر: نفس أهداف `pnpm lint` حرفيًا (`eslint src tests
 *    apps/prototype-web/client/src tools`) بصيغة `--format json` و**بلا**
 *    `--max-warnings` — كي تبقى الأعداد قابلة للقياس حتى فوق السقف.
 *  - eslint يُحل هرميتيًا من node_modules المستودع (لا اعتماد على PATH).
 *  - التحذير = severity 1؛ الخطأ = severity 2 (أي خطأ = فشل مغلق
 *    ESLINT_ERRORS — ليس من نطاق هذه الراتشة لكنه يمنع القياس الكاذب).
 *  - فشل تنفيذ eslint نفسه (خروج غير صفر لغير الأخطاء المكتشفة) = فشل
 *    مغلق ESLINT_FAILED.
 *
 * الفشول الثلاثة المميزة:
 *  1) WARNING_COUNT_INCREASED — العدد فوق الأساس (مع تفصيل لكل قاعدة).
 *  2) WARNING_COUNT_DECREASED — العدد دون الأساس: ليس رصيدًا؛ أعد الإرساء
 *     موثقًا في نفس الـPR أو اتركه.
 *  3) RULE_MIX_CHANGED — المجموع نفسه بتوزيع قواعد مختلف (تبديل يعادل
 *     انجرافًا ولا يمر صامتًا).
 *
 * لا تعدل أي قاعدة lint لاجتياز العدد — تعديل القواعد خارج نطاق W1A.
 *
 * الاستخدام: node scripts/check-lint-warning-baseline.mjs [repoRoot]
 * الخروج: 0 = مطابق للأساس؛ 1 = انجراف؛ 2 = خطأ استخدام/تنفيذ.
 */
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

/** أهداف الفحص — نفس أهداف `pnpm lint` حرفيًا (package.json: lint). */
export const LINT_TARGETS = ["src", "tests", "apps/prototype-web/client/src", "tools"];

/** الأساس المعتمد (OD-GUARD الخيار A، مقيس حيًا عند 5ef4ce08 بتاريخ
 * 2026-10-14): 35 تحذيرًا = 18 max-lines-per-function + 17 complexity. */
export const LINT_WARNING_BASELINE_TOTAL = 35;
export const LINT_WARNING_BASELINE_BY_RULE = {
  "max-lines-per-function": 18,
  complexity: 17,
};

/** تشغيل eslint بصيغة JSON — يعيد {exitCode, stdout, stderr}. */
export function runEslintJson(repoRoot = ROOT) {
  const eslintBin = path.join(repoRoot, "node_modules", "eslint", "bin", "eslint.js");
  if (!fs.existsSync(eslintBin)) {
    return { exitCode: null, stdout: "", stderr: `eslint not found at ${path.relative(repoRoot, eslintBin)}` };
  }
  const run = spawnSync(
    process.execPath,
    [eslintBin, ...LINT_TARGETS, "--format", "json"],
    { encoding: "utf8", maxBuffer: 1024 * 1024 * 64, cwd: repoRoot },
  );
  return { exitCode: run.status, stdout: run.stdout ?? "", stderr: run.stderr ?? "" };
}

/** تحليل مخرجات eslint JSON إلى {errors, warnings, byRule}. */
export function parseEslintJsonWarnings(jsonText) {
  const files = JSON.parse(jsonText);
  const errors = [];
  const warnings = [];
  const byRule = {};
  for (const file of files) {
    for (const message of file.messages ?? []) {
      if (message.severity === 2) {
        errors.push(`${path.basename(file.filePath)}:${message.line} ${message.ruleId ?? "parse"}`);
      } else if (message.severity === 1) {
        warnings.push(message);
        const rule = message.ruleId ?? "(no-rule)";
        byRule[rule] = (byRule[rule] ?? 0) + 1;
      }
    }
  }
  return { errors, warnings, byRule };
}

/** مقارنة الأعداد بالأساس — يعيد قائمة الخروق المميزة (نقية، قابلة للاختبار). */
export function lintWarningViolations(warningCount, byRule, baselineTotal = LINT_WARNING_BASELINE_TOTAL, baselineByRule = LINT_WARNING_BASELINE_BY_RULE) {
  const violations = [];
  if (warningCount > baselineTotal) {
    const detail = Object.entries(byRule)
      .sort((a, b) => b[1] - a[1])
      .map(([rule, count]) => `${rule}=${count}`)
      .join(", ");
    violations.push({
      rule: "WARNING_COUNT_INCREASED",
      detail: `${warningCount} > ${baselineTotal} (per-rule: ${detail}) — خفض التحذيرات الجديدة أو أعد إرساء الأساس موثقًا في نفس الـPR`,
    });
  } else if (warningCount < baselineTotal) {
    violations.push({
      rule: "WARNING_COUNT_DECREASED",
      detail: `${warningCount} < ${baselineTotal} — النقصان ليس رصيدًا مستقبليًا: أعد إرساء الأساس موثقًا في نفس الـPR (OD-GUARD/D-05)`,
    });
  } else {
    const mixChanged = new Set([...Object.keys(byRule), ...Object.keys(baselineByRule)]);
    for (const rule of mixChanged) {
      if ((byRule[rule] ?? 0) !== (baselineByRule[rule] ?? 0)) {
        violations.push({
          rule: "RULE_MIX_CHANGED",
          detail: `total matches (${warningCount}) but per-rule drift: ${rule} live=${byRule[rule] ?? 0} baseline=${baselineByRule[rule] ?? 0} — أعد الإرساء موثقًا في نفس الـPR`,
        });
      }
    }
  }
  return violations;
}

function main() {
  const repoRoot = process.argv[2] ? path.resolve(process.argv[2]) : ROOT;
  if (!fs.existsSync(path.join(repoRoot, "package.json"))) {
    console.error("check-lint-warning-baseline: USAGE: node scripts/check-lint-warning-baseline.mjs [repoRoot]");
    process.exit(2);
  }
  const run = runEslintJson(repoRoot);
  if (run.exitCode === null || !(run.exitCode === 0 || run.exitCode === 1)) {
    /* eslint يخرج 1 عند وجود مشاكل (مقيسة أدناه) — أي خروج آخر = فشل تنفيذ. */
    console.error(`check-lint-warning-baseline: ESLINT_FAILED — eslint exited ${run.exitCode ?? "without a code"}: ${run.stderr.slice(0, 300)}`);
    process.exit(2);
  }
  let parsed;
  try {
    parsed = parseEslintJsonWarnings(run.stdout);
  } catch (error) {
    console.error(`check-lint-warning-baseline: ESLINT_FAILED — unparsable eslint JSON output: ${error.message}`);
    process.exit(2);
  }
  if (parsed.errors.length > 0) {
    console.error(
      `check-lint-warning-baseline: ESLINT_ERRORS — ${parsed.errors.length} error(s) fail the run before the warning tripwire (first: ${parsed.errors[0]})`,
    );
    process.exit(1);
  }
  const warningCount = parsed.warnings.length;
  const violations = lintWarningViolations(warningCount, parsed.byRule);
  if (violations.length > 0) {
    console.error(`check-lint-warning-baseline: FAIL — ${violations.length} drift finding(s) against the baseline ${LINT_WARNING_BASELINE_TOTAL}:`);
    for (const violation of violations) console.error(`  [${violation.rule}] ${violation.detail}`);
    process.exit(1);
  }
  const detail = Object.entries(parsed.byRule)
    .sort((a, b) => b[1] - a[1])
    .map(([rule, count]) => `${rule}=${count}`)
    .join(" + ");
  console.log(
    `check-lint-warning-baseline: PASS — ${warningCount} تحذيرًا بالضبط (${detail}) = الأساس المعتمد؛ السقف 37 باقٍ في سطر lint دون مساس (D-05/R10A-F-026 — OD-GUARD)`,
  );
  process.exit(0);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
