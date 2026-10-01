#!/usr/bin/env node
/**
 * WS-204 (برنامج عزل سياق التوثيق 2026-10-01): حارس تغطية كتالوج السلطة.
 *
 * الغاية: ألا يعود «الملف السلطوي غير المرئي» — الملف canonical الذي لا يحمل
 * صفًا في `docs/00-document-index.md` (العلة الجذرية RC-4 في تحقيق 2026-10-01:
 * v5 والعقود 42/43 كانت موجودة وسلطوية وغير مفهرسة). يُشغَّل عبر `pnpm guards`
 * المتصل بـ`pnpm check` وبالتالي بCI.
 *
 * القواعد:
 * - كل ملف `.md` تحت `docs/contracts/` و`docs/architecture/` (شاملًا `ADRs/`)
 *   و`docs/decisions/` و`docs/research/` يجب أن يُذكر في الفهرس (بمساره أو
 *   باسم ملفه).
 * - قائمة REQUIRED_CANONICAL (أدناه) يجب أن تُذكر جميعًا — نواة السلطة.
 * - ثابت الزوج الحي «اليوم 38/30» يجب أن يبقى في الفهرس (مرتبط باختبار
 *   group6Docs).
 *
 * الاستخدام: node scripts/check-doc-index-coverage.mjs [root]
 * الخروج: 0 = التغطية كاملة؛ 1 = أي ملف سلطوي بلا صف.
 */
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

export const INDEX_PATH = "docs/00-document-index.md";

/** مجلدات يُفحص كل ملف .md فيها (تغطية شاملة). */
export const FULL_COVERAGE_DIRS = [
  "docs/contracts",
  "docs/architecture",
  "docs/decisions",
  "docs/research",
];

/** نواة السلطة — يجب ذكر كل منها في الفهرس (تُعدَّل بقرار موثق لا بصمت). */
export const REQUIRED_CANONICAL = [
  "AGENTS.md",
  "README.md",
  "CONTRIBUTING.md",
  "CHANGELOG.md",
  "todo.md",
  "docs/00-document-index.md",
  "docs/01-product-and-technical-blueprint.md",
  "docs/02-decision-log.md",
  "docs/03-hypothesis-register.md",
  "docs/04-product-truth-map.md",
  "docs/05-documentation-governance.md",
  "docs/06-reference-library.md",
  "docs/07-field-evidence-map.md",
  "docs/08-glossary.md",
  "docs/README.md",
  "docs/product-source-of-truth.md",
  "docs/product/problem-statement-v3.md",
  "docs/product/problem-statement-v4.md",
  "docs/product/problem-statement-v5.md",
  "docs/product/system-definition-v1.md",
  "docs/product/user-operating-model-v1.md",
  "docs/product/financial-operating-model-v1.md",
  "docs/product/guidance-interaction-policy-v1.md",
  "docs/product/activity-profiles-and-hybrid-projects-v1.md",
  "docs/product/capability-evolution-roadmap-v1.md",
  "docs/product/owner-decisions-v1.md",
  "docs/product/settled-findings-v1.md",
  "docs/product/code-facts-v1.md",
  "docs/product/capability-redistribution-v1.md",
  "docs/product/placement-principles-v1.md",
  "docs/product/mobile-ui-ux-reference-v1.md",
  "docs/product/home-navigation-proof-v1.md",
  "docs/product/design-system-v1.md",
  "docs/scenarios/scenario-test-set-v1.md",
  "docs/scenarios/scenario-test-results-v1.md",
  "docs/quality/scenario-coverage-matrix-v1.md",
  "docs/quality/persistent-entity-touchpoints.json",
  "docs/implementation/01-execution-roadmap.md",
  "docs/implementation/02-domain-contract-coverage.md",
  "docs/implementation/03-pre-build-alignment-v1.md",
  "docs/implementation/mobile-prototype-spec-v1.md",
  "docs/implementation/prototype-build-charter-v1.md",
  "docs/operations/current-state.md",
  "docs/operations/README.md",
  "docs/operations/micro-thinking-charter-v1.md",
  "docs/operations/agent-handoff-protocol-v1.md",
  "docs/operations/slice-handoff-template.md",
  "docs/operations/remaining-work-v1.md",
  "docs/operations/control/README.md",
];

export function listMarkdownFiles(root, dir) {
  const abs = path.join(root, dir);
  if (!fs.existsSync(abs)) return [];
  const out = [];
  for (const entry of fs.readdirSync(abs, { withFileTypes: true, recursive: false })) {
    const rel = path.join(dir, entry.name).split(path.sep).join("/");
    if (entry.isDirectory()) {
      out.push(...listMarkdownFiles(root, rel));
    } else if (entry.name.endsWith(".md")) {
      out.push(rel);
    }
  }
  return out;
}

export function checkCoverage({ repoRoot = ROOT } = {}) {
  const indexPath = path.join(repoRoot, INDEX_PATH);
  if (!fs.existsSync(indexPath)) {
    return [{ kind: "missing-index", message: `${INDEX_PATH} does not exist` }];
  }
  const indexText = fs.readFileSync(indexPath, "utf8");
  const findings = [];
  for (const dir of FULL_COVERAGE_DIRS) {
    for (const file of listMarkdownFiles(repoRoot, dir)) {
      const base = path.basename(file);
      if (!indexText.includes(file) && !indexText.includes(base)) {
        findings.push({ kind: "unindexed", path: file, message: `authority file not mentioned in ${INDEX_PATH}` });
      }
    }
  }
  for (const file of REQUIRED_CANONICAL) {
    if (file === "docs/06-reference-library.md" && !fs.existsSync(path.join(repoRoot, file))) {
      // أُزيل بقرار موثق (WS-204 W4): يُحذف من القائمة في نفس اللقطة.
      continue;
    }
    if (!indexText.includes(file)) {
      findings.push({ kind: "missing-canonical", path: file, message: `required canonical file not mentioned in ${INDEX_PATH}` });
    }
  }
  if (!indexText.includes("اليوم 38/30")) {
    findings.push({ kind: "pin", message: `pinned live pair string "اليوم 38/30" missing from ${INDEX_PATH}` });
  }
  return findings;
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url))) {
  const root = process.argv[2] ? path.resolve(process.argv[2]) : ROOT;
  const findings = checkCoverage({ repoRoot: root });
  for (const f of findings) {
    console.error(`check-doc-index-coverage: FAIL ${f.kind} ${f.path ?? ""} ${f.message}`);
  }
  if (findings.length > 0) {
    console.error(`check-doc-index-coverage: ${findings.length} finding(s)`);
    process.exit(1);
  }
  console.log("check-doc-index-coverage: catalog coverage complete");
  process.exit(0);
}
