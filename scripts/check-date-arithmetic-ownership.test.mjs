#!/usr/bin/env node
/**
 * Tests for check-date-arithmetic-ownership (R2 — M-09).
 * Proves the guard catches what it must and passes what it must:
 *  - R1: a numeric Date.UTC in production fails (domain AND app).
 *  - R2: new Date( in domain outside shared/businessTime fails; the owned
 *    module itself is exempt.
 *  - R3: Date.parse( in domain outside shared/numeric fails.
 *  - R4: raw .slice(0, 10) in the application layer fails; the guarded
 *    Amman fallback (?? earlier on the same line) passes.
 *  - Comments documenting Date.UTC never trip the guard (comment stripping).
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { findViolations, stripComments } from "./check-date-arithmetic-ownership.mjs";

function withTree(build) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "r2-date-guard-"));
  build(dir);
  return dir;
}

function write(dir, relative, content) {
  const full = path.join(dir, relative);
  fs.mkdirSync(path.dirname(full), { recursive: true });
  fs.writeFileSync(full, content);
}

function rulesOf(violations) {
  return violations.map(violation => violation.rule.slice(0, 2));
}

/* ─── comment stripping ─── */
{
  const code = `// Date.UTC mentioned in a comment\nconst x = 1; /* new Date( and Date.parse( too */\n`;
  const stripped = stripComments(code);
  assert.equal(stripped.includes("Date.UTC"), false, "line comments must be stripped");
  assert.equal(stripped.includes("new Date("), false, "block comments must be stripped");
}

/* ─── R1: numeric Date.UTC anywhere in production ─── */
{
  const dir = withTree(tree => {
    write(tree, "src/domain/demo/policies.ts", "export const f = () => Date.UTC(2026, 0, 1);\n");
    write(tree, "apps/prototype-web/client/src/application/demo/service.ts", "export const g = Date.UTC(2026, 0, 1);\n");
  });
  const violations = findViolations(dir);
  assert.equal(rulesOf(violations).filter(r => r === "R1").length, 2, `expected two R1 violations, got ${JSON.stringify(violations)}`);
}

/* ─── R2/R3: domain keeps Date object and Date.parse kernel-only ─── */
{
  const dir = withTree(tree => {
    write(tree, "src/domain/shared/businessTime.ts", "export const f = (x: string) => new Date(x);\n");
    write(tree, "src/domain/shared/numeric.ts", "export const g = (x: string) => !Number.isNaN(Date.parse(x));\n");
    write(tree, "src/domain/other/policies.ts", "export const bad1 = (x: string) => new Date(x);\nexport const bad2 = (x: string) => Date.parse(x);\n");
  });
  const violations = findViolations(dir);
  assert.equal(rulesOf(violations).filter(r => r === "R2").length, 1, "new Date outside shared must fail exactly once");
  assert.equal(rulesOf(violations).filter(r => r === "R3").length, 1, "Date.parse outside shared must fail exactly once");
  assert.equal(violations.some(v => v.file === "src/domain/shared/businessTime.ts"), false, "businessTime is the owned module");
  assert.equal(violations.some(v => v.file === "src/domain/shared/numeric.ts"), false, "numeric is the owned module");
}

/* ─── R4: application-layer slice(0,10) only as guarded fallback ─── */
{
  const dir = withTree(tree => {
    write(tree, "apps/prototype-web/client/src/application/demo/clock.ts", [
      "const bad = now.slice(0, 10);",
      "const good = ammanDateOrNull(x) ?? x.slice(0, 10);",
    ].join("\n"));
  });
  const violations = findViolations(dir);
  assert.equal(rulesOf(violations).filter(r => r === "R4").length, 1, "only the unguarded slice fails");
  assert.equal(violations[0].line, 1, "the failing line is the unguarded one");
}

/* ─── clean tree passes ─── */
{
  const dir = withTree(tree => {
    write(tree, "src/domain/shared/numeric.ts", "export const ok = 1;\n");
    write(tree, "apps/prototype-web/client/src/application/demo/service.ts", "import { localDateInAmman } from '@micro-domain/shared/index.js';\nconst d = localDateInAmman(now);\n");
  });
  assert.deepEqual(findViolations(dir), [], "kernel-owned patterns pass");
}

/* ─── test files and dist are out of scope ─── */
{
  const dir = withTree(tree => {
    write(tree, "src/domain/demo/policies.test.ts", "export const f = () => Date.UTC(2026, 0, 1);\n");
    write(tree, "apps/prototype-web/client/dist/demo.js", "Date.UTC(2026,0,1);\n");
  });
  assert.deepEqual(findViolations(dir), [], "tests and dist are exempt");
}

console.log("check-date-arithmetic-ownership.test.mjs: all cases passed");
