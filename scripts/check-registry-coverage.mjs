#!/usr/bin/env node
/**
 * Wave H (STR-617 بند 5 — 2026-10-04): مراقب تغطية سجل الملكية.
 *
 * الفجوة الموثقة: لا مراقب يثبت أن سجل الملكية والمصادر
 * (OWNERSHIP-AND-TRUTH-REGISTRY.md) يغطي فعليًا وحدات الشجرة الحية — بيوت
 * التطبيق ومناطق المجال كانت تُنسى بصمت (مكتشف STR-619: خدمتان بلا صفوف).
 *
 * هذا الحارس: يشتق بيوت application/ ومناطق src/domain/ من الشجرة الحية
 * ويتطلب ذكر كل واحد منها في نص السجل (بالاسم «home/» أو «area/»). أي بيت
 * أو منطقة جديدة بلا صف سجل تفشل الحراسة — النمو صار مرئيًا لا صامتًا.
 *
 * الاستخدام: node scripts/check-registry-coverage.mjs [repoRoot].
 * الخروج: 0 = تغطية كاملة؛ 1 = بيت/منطقة بلا ذكر في السجل.
 */
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import { ROOT } from "./check-runtime-cycles.mjs";

export const REGISTRY_PATH = "docs/architecture/refactoring/OWNERSHIP-AND-TRUTH-REGISTRY.md";
const APP_DIR = path.join("apps", "prototype-web", "client", "src", "application");
const DOMAIN_DIR = path.join("src", "domain");

/** بيوت application/ ومناطق src/domain/ من الشجرة الحية (مصنفة أبجديًا). */
export function listOwnershipUnits(repoRoot) {
  const dirs = (relDir) => {
    const abs = path.join(repoRoot, relDir);
    if (!fs.existsSync(abs)) return [];
    return fs
      .readdirSync(abs, { withFileTypes: true })
      .filter(e => e.isDirectory() && e.name !== "node_modules")
      .map(e => `${e.name}/`)
      .sort();
  };
  return { applicationHomes: dirs(APP_DIR), domainAreas: dirs(DOMAIN_DIR) };
}

export function checkRegistryCoverage(repoRoot, registryText) {
  const text = registryText ?? fs.readFileSync(path.join(repoRoot, REGISTRY_PATH), "utf8");
  const { applicationHomes, domainAreas } = listOwnershipUnits(repoRoot);
  const violations = [];
  for (const home of applicationHomes) {
    if (!text.includes(home)) {
      violations.push({
        kind: "application-home",
        unit: home,
        hint: "بيت تطبيق بلا ذكر في سجل الملكية — أضف صفه في §3م (أو §3 للبيوت المالية) وحدّث خريطة G2",
      });
    }
  }
  for (const area of domainAreas) {
    if (!text.includes(area)) {
      violations.push({
        kind: "domain-area",
        unit: area,
        hint: "منطقة مجال بلا ذكر في سجل الملكية §1 — أضف صف الملكية قبل أي عمل في المنطقة",
      });
    }
  }
  return { ok: violations.length === 0, violations, applicationHomes, domainAreas };
}

function main() {
  const repoRoot = process.argv[2] ? path.resolve(process.argv[2]) : ROOT;
  if (!fs.existsSync(path.join(repoRoot, "package.json"))) {
    console.error("registry-coverage: USAGE: node scripts/check-registry-coverage.mjs [repoRoot]");
    process.exit(2);
  }
  const { ok, violations, applicationHomes, domainAreas } = checkRegistryCoverage(repoRoot);
  if (!ok) {
    console.error(`registry-coverage: FAIL — ${violations.length} وحدة بلا صف في ${REGISTRY_PATH}:`);
    for (const v of violations) {
      console.error(`  [${v.kind}] ${v.unit}`);
      console.error(`    ${v.hint}`);
    }
    process.exit(1);
  }
  console.log(
    `registry-coverage: PASS — ${applicationHomes.length} بيت تطبيق و${domainAreas.length} منطقة مجال كلها مذكورة في سجل الملكية (Wave H/STR-617 بند 5)`,
  );
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url))) {
  main();
}
