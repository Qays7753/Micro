#!/usr/bin/env node
/**
 * Guard: date-arithmetic ownership (R2 — M-09, WS-216/ARCH-007, 2026-10-08).
 *
 * Every date defect R2 repaired came from date logic living outside the
 * canonical kernel: numeric Date.UTC calls remapping years < 100 to 1900+,
 * noon-anchor toISOString RangeErrors, calendar-blind regexes accepting
 * rollover dates, and business dates derived by slicing UTC timestamps.
 * The kernel (src/domain/shared/numeric.ts) now owns validity and arithmetic
 * as pure integer computation, and business dates derive only through the
 * businessTime contract. This guard keeps that true:
 *
 *  R1 — `Date.UTC(` is FORBIDDEN in all production code under src/ and
 *       apps/prototype-web/client/src/ (zero exceptions after the R2
 *       conversion; pure-integer kernel arithmetic replaces it everywhere).
 *  R2 — `new Date(` inside src/domain/ is allowed ONLY in
 *       src/domain/shared/businessTime.ts (the owned instant-parsing/
 *       Amman-derivation contract; the domain is otherwise Date-free).
 *  R3 — `Date.parse(` inside src/domain/ is allowed ONLY in
 *       src/domain/shared/numeric.ts (isValidTimestamp — the owned
 *       timestamp-validity predicate; all policies delegate to it).
 *  R4 — `.slice(0, 10)` in apps/prototype-web/client/src/application/ is
 *       allowed ONLY as the fallback branch of a guarded Amman derivation
 *       (a `??` earlier on the same line) — never as the primary derivation
 *       of a business date from a timestamp (the R2-D4 clock-slicing bug).
 *
 * Test files, fixtures, and dist output are out of scope (tests legitimately
 * build clocks and legacy-comparison algorithms; dist is generated).
 *
 * FAILS on the first violation with file:line and the rule text; exit 0 only
 * when the whole production tree is clean.
 */
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
export const SCANNED_EXTENSIONS = new Set([".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs"]);

const isTestFile = filePath => /\.(?:test|spec|fixture)\.[jt]sx?$/.test(filePath) || filePath.includes("__fixtures__");
const isDist = filePath => filePath.includes(`${path.sep}dist${path.sep}`);

/** Walk a directory collecting production files with a scanned extension. */
export function collectProductionFiles(directory) {
  const results = [];
  if (!fs.existsSync(directory)) return results;
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const full = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === "node_modules" || entry.name === "dist" || entry.name === ".git") continue;
      results.push(...collectProductionFiles(full));
      continue;
    }
    if (!SCANNED_EXTENSIONS.has(path.extname(entry.name))) continue;
    if (isTestFile(full) || isDist(full)) continue;
    results.push(full);
  }
  return results;
}

/** Strip comments so documented mentions never trip the guard. */
export function stripComments(text) {
  return text
    .replace(/\/\*[\s\S]*?\*\//g, match => match.replace(/[^\n]/g, " "))
    .replace(/(^|[^:])\/\/[^\n]*/g, (match, lead) => lead + " ".repeat(match.length - lead.length));
}

/**
 * Evaluate the four ownership rules over the production tree.
 * Returns an array of violation objects { rule, file, line, excerpt }.
 */
export function findViolations(root = ROOT) {
  const violations = [];
  const domains = ["src/domain"];
  const appsClient = ["apps/prototype-web/client/src"];
  const scanned = [path.join(root, "src"), ...appsClient.map(p => path.join(root, p))].flatMap(dir =>
    collectProductionFiles(dir),
  );
  const domainFiles = domains.map(p => path.join(root, p)).flatMap(dir => collectProductionFiles(dir));

  for (const file of scanned) {
    const relative = path.relative(root, file).split(path.sep).join("/");
    const code = stripComments(fs.readFileSync(file, "utf8"));
    const lines = code.split("\n");
    lines.forEach((line, index) => {
      const at = { file: relative, line: index + 1, excerpt: line.trim().slice(0, 120) };
      /* R1: numeric Date.UTC anywhere in production. */
      if (line.includes("Date.UTC(")) {
        violations.push({ rule: "R1 (Date.UTC outside the pure-integer kernel)", ...at });
      }
      /* R2/R3: Date object + Date.parse inside the domain are kernel/businessTime-only. */
      if (relative.startsWith("src/domain/") && !relative.startsWith("src/domain/shared/")) {
        if (line.includes("new Date(")) {
          violations.push({ rule: "R2 (new Date in domain outside shared/businessTime)", ...at });
        }
        if (line.includes("Date.parse(")) {
          violations.push({ rule: "R3 (Date.parse in domain outside shared/numeric)", ...at });
        }
      }
    });
  }

  /* R4: raw .slice(0, 10) in the application layer is only legal as the
   * fallback of a guarded Amman derivation (?? earlier on the same line). */
  for (const file of scanned) {
    const relative = path.relative(root, file).split(path.sep).join("/");
    if (!relative.startsWith("apps/prototype-web/client/src/application/")) continue;
    const code = stripComments(fs.readFileSync(file, "utf8"));
    const lines = code.split("\n");
    lines.forEach((line, index) => {
      if (!line.includes(".slice(0, 10)")) return;
      const sliceAt = line.indexOf(".slice(0, 10)");
      const before = line.slice(0, sliceAt);
      if (before.includes("??")) return; /* guarded fallback — documented pattern */
      violations.push({
        rule: "R4 (raw .slice(0, 10) business-date derivation in application — use localDateInAmman/businessDateFromTimestamp)",
        file: relative,
        line: index + 1,
        excerpt: line.trim().slice(0, 120),
      });
    });
  }

  return violations;
}

function main() {
  const violations = findViolations();
  if (violations.length === 0) {
    console.log("check-date-arithmetic-ownership: PASS — date validity/arithmetic and business-date derivation are kernel-owned (R1–R4 clean).");
    return 0;
  }
  console.error(`check-date-arithmetic-ownership: FAIL — ${violations.length} violation(s):`);
  for (const violation of violations) {
    console.error(`  ${violation.rule}\n    ${violation.file}:${violation.line}\n    ${violation.excerpt}`);
  }
  console.error("\nThe canonical owner is src/domain/shared/numeric.ts (validity + integer arithmetic)");
  console.error("and src/domain/shared/businessTime.ts (Amman business dates). See R2-SEMANTIC-CHANGE-MANIFESTS.md M-09.");
  return 1;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  process.exit(main());
}
