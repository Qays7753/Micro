import { describe, expect, it } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { findViolations, stripComments } from "./check-date-arithmetic-ownership.mjs";

/*
 * اختبارات حارس ملكية حساب التاريخ (R2 — M-09؛ مشدّد بعد المراجعة
 * النهائية FH-4/FA-02/FA-03/FT-3): يثبت أن الحارس يمسك بما يجب ويمرر ما
 * يجب — R1 (Date.UTC رقمية أو وصول قوسي في الإنتاج)، R2/R3 (ملفات النواة
 * حصرًا لا المجلد)، R4 (قصّ التاريخ الخام في **أي** طبقة تطبيق بلا حارس)،
 * مع إعفاء الاختبارات/الـdist وسلامة السلاسل النصية عند تجريد التعليقات.
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

describe("check-date-arithmetic-ownership (R2 — M-09, tightened)", () => {
  it("strips comments but never blanks quoted strings (FH-4 remediation)", () => {
    const code = [
      'const url = "https://x//evil"; Date.UTC(2026, 0, 1);',
      "// Date.UTC mentioned in a comment",
      "/* new Date( and Date.parse( too */ const ok = 1;",
    ].join("\n");
    const stripped = stripComments(code);
    /* الرمي الحقيقي بعد السلسلة النصية يُمسك — التعليقات وحدها تُجرد. */
    expect(stripped.includes("Date.UTC(2026")).toBe(true);
    expect(stripped.includes("https://x//evil")).toBe(true);
    const violations = findViolations(
      makeTree(tree => write(tree, "src/demo.ts", code)),
    );
    expect(rulesOf(violations)).toContain("R1");
  });

  it("R1: numeric Date.UTC fails in domain and app alike, including bracket access", () => {
    const dir = makeTree(tree => {
      write(tree, "src/domain/demo/policies.ts", "export const f = () => Date.UTC(2026, 0, 1);\n");
      write(tree, "apps/prototype-web/client/src/application/demo/service.ts", 'export const g = Date["UTC"](2026, 0, 1);\n');
    });
    try {
      const violations = findViolations(dir);
      expect(rulesOf(violations).filter(rule => rule === "R1").length).toBe(2);
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  it("R2/R3: the domain exempts exactly the two kernel files — not the shared directory (FA-02 remediation)", () => {
    const dir = makeTree(tree => {
      write(tree, "src/domain/shared/businessTime.ts", "export const f = (x) => new Date(x);\n");
      write(tree, "src/domain/shared/numeric.ts", "export const g = (x) => !Number.isNaN(Date.parse(x));\n");
      write(tree, "src/domain/shared/other.ts", "export const bad = (x) => new Date(x);\n");
      write(tree, "src/domain/other/policies.ts", "export const bad2 = (x) => Date.parse(x);\n");
    });
    try {
      const violations = findViolations(dir);
      expect(rulesOf(violations).filter(rule => rule === "R2").length).toBe(1); /* shared/other.ts */
      expect(violations.some(v => v.file === "src/domain/shared/other.ts")).toBe(true);
      expect(rulesOf(violations).filter(rule => rule === "R3").length).toBe(1); /* domain/other */
      expect(violations.some(v => v.file === "src/domain/shared/businessTime.ts")).toBe(false);
      expect(violations.some(v => v.file === "src/domain/shared/numeric.ts")).toBe(false);
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  it("R4: raw slicing fails in ANY app layer (pages/components/presentation too) and in variant shapes", () => {
    const dir = makeTree(tree => {
      write(tree, "apps/prototype-web/client/src/application/demo/clock.ts", "const a = now.slice(0, 10);\n");
      write(tree, "apps/prototype-web/client/src/pages/demo.tsx", "const b = now.slice(0,10);\n");
      write(tree, "apps/prototype-web/client/src/components/demo.tsx", "const c = now.substring(0, 10);\n");
      write(tree, "apps/prototype-web/client/src/presentation/demo.ts", 'const d = stamp.split("T")[0];\n');
      write(tree, "apps/prototype-web/client/src/application/demo/ok.ts", "const good = ammanDateOrNull(x) ?? x.slice(0, 10);\n");
    });
    try {
      const violations = findViolations(dir);
      expect(rulesOf(violations).filter(rule => rule === "R4").length).toBe(4);
      expect(violations.every(v => !v.file.endsWith("ok.ts"))).toBe(true);
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
