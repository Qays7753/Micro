import { describe, expect, it } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { findViolations, stripComments } from "./check-date-arithmetic-ownership.mjs";

/*
 * اختبارات حارس ملكية حساب التاريخ (R2 — M-09): يثبت أن الحارس يمسك بما
 * يجب ويمرر ما يجب — R1 (Date.UTC رقمية في الإنتاج)، R2 (new Date داخل
 * المجال خارج shared/businessTime)، R3 (Date.parse خارج shared/numeric)،
 * R4 (قصّ slice(0,10) الخام في طبقة التطبيق بلا حارس)، مع إعفاء
 * الاختبارات/الـdist وتجريد التعليقات.
 */

function makeTree(build) {
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

describe("check-date-arithmetic-ownership (R2 — M-09)", () => {
  it("strips comments so documented mentions never trip the guard", () => {
    const code = "// Date.UTC mentioned in a comment\nconst x = 1; /* new Date( and Date.parse( too */\n";
    const stripped = stripComments(code);
    expect(stripped.includes("Date.UTC")).toBe(false);
    expect(stripped.includes("new Date(")).toBe(false);
  });

  it("R1: a numeric Date.UTC in production fails (domain and app alike)", () => {
    const dir = makeTree(tree => {
      write(tree, "src/domain/demo/policies.ts", "export const f = () => Date.UTC(2026, 0, 1);\n");
      write(tree, "apps/prototype-web/client/src/application/demo/service.ts", "export const g = Date.UTC(2026, 0, 1);\n");
    });
    try {
      const violations = findViolations(dir);
      expect(rulesOf(violations).filter(rule => rule === "R1").length).toBe(2);
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  it("R2/R3: the domain keeps the Date object and Date.parse kernel-only", () => {
    const dir = makeTree(tree => {
      write(tree, "src/domain/shared/businessTime.ts", "export const f = (x) => new Date(x);\n");
      write(tree, "src/domain/shared/numeric.ts", "export const g = (x) => !Number.isNaN(Date.parse(x));\n");
      write(tree, "src/domain/other/policies.ts", "export const bad1 = (x) => new Date(x);\nexport const bad2 = (x) => Date.parse(x);\n");
    });
    try {
      const violations = findViolations(dir);
      expect(rulesOf(violations).filter(rule => rule === "R2").length).toBe(1);
      expect(rulesOf(violations).filter(rule => rule === "R3").length).toBe(1);
      expect(violations.some(v => v.file === "src/domain/shared/businessTime.ts")).toBe(false);
      expect(violations.some(v => v.file === "src/domain/shared/numeric.ts")).toBe(false);
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  it("R4: raw slice(0, 10) fails; the guarded Amman fallback passes", () => {
    const dir = makeTree(tree => {
      write(tree, "apps/prototype-web/client/src/application/demo/clock.ts", [
        "const bad = now.slice(0, 10);",
        "const good = ammanDateOrNull(x) ?? x.slice(0, 10);",
      ].join("\n"));
    });
    try {
      const violations = findViolations(dir);
      expect(rulesOf(violations).filter(rule => rule === "R4").length).toBe(1);
      expect(violations[0].line).toBe(1);
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  it("kernel-owned patterns pass and tests/dist are out of scope", () => {
    const dir = makeTree(tree => {
      write(tree, "src/domain/shared/numeric.ts", "export const ok = 1;\n");
      write(tree, "apps/prototype-web/client/src/application/demo/service.ts", "const d = localDateInAmman(now);\n");
      write(tree, "src/domain/demo/policies.test.ts", "export const f = () => Date.UTC(2026, 0, 1);\n");
      write(tree, "apps/prototype-web/client/dist/demo.js", "Date.UTC(2026,0,1);\n");
    });
    try {
      expect(findViolations(dir)).toEqual([]);
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });
});
