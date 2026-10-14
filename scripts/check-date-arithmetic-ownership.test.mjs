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
      /* (R11 W1A-2 / D-03): count only the pure R4 detection rule (full-rule
       * filter — rulesOf truncates to "R4" and would match census rules too).
       * The census rules (R4-guarded-fallback-*) have their own fixtures below. */
      expect(violations.filter(v => v.rule.startsWith("R4 (")).length).toBe(4);
      /* ok.ts's genuine guarded fallback is a SIXTH site (not among the five
       * approved) — D-03 rejects it as unregistered until same-PR re-anchoring. */
      expect(violations.some(v => v.rule.startsWith("R4-guarded-fallback-unregistered") && v.file.endsWith("ok.ts"))).toBe(true);
      expect(violations.every(v => !v.file.endsWith("demo.tsx") || v.rule.startsWith("R4 ("))).toBe(true);
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  it("R5: zero-argument and ambient-new-Date localDateInAmman calls fail in ANY production layer; explicit instants and todayInAmman() pass", () => {
    const dir = makeTree(tree => {
      write(tree, "apps/prototype-web/client/src/pages/demo.tsx", "const a = localDateInAmman();\n");
      write(tree, "apps/prototype-web/client/src/application/demo/service.ts", "const b = localDateInAmman( new Date() );\n");
      write(tree, "src/domain/demo/policies.ts", "const c = localDateInAmman();\n");
      /* السوالب القانونية: لحظة صريحة (ساعة/طابع) والحد المسماى للتطبيق. */
      write(tree, "apps/prototype-web/client/src/pages/ok.tsx", "const d = localDateInAmman(now);\n");
      write(tree, "apps/prototype-web/client/src/application/time/clock.ts", "const e = todayInAmman();\n");
    });
    try {
      const violations = findViolations(dir);
      expect(rulesOf(violations).filter(rule => rule === "R5").length).toBe(3);
      expect(violations.every(v => !v.file.endsWith("ok.tsx"))).toBe(true);
      expect(violations.every(v => !v.file.endsWith("clock.ts"))).toBe(true);
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  it("R6: ambient zero-arg new Date() fails in the domain — even inside businessTime.ts (the default's former home); explicit parsing passes", () => {
    const dir = makeTree(tree => {
      write(
        tree,
        "src/domain/shared/businessTime.ts",
        "export const parse = (x) => new Date(x);\nexport const ambient = () => new Date();\n",
      );
      write(tree, "src/domain/other/policies.ts", "export const g = () => new Date();\n");
      /* السوالب: تحليل مدخل صريح في ملف النواة نفسه (السطر الأول أعلاه —
       * يمر R6)، وساعة النظام خارج المجال (ليست ضمن نطاق R6 أصلًا). */
      write(tree, "src/domain/shared/numeric.ts", "export const h = (x) => !Number.isNaN(Date.parse(x));\n");
      write(tree, "apps/prototype-web/client/src/application/time/clock.ts", "export const systemClock = () => new Date().toISOString();\n");
    });
    try {
      const violations = findViolations(dir);
      expect(rulesOf(violations).filter(rule => rule === "R6").length).toBe(2);
      expect(violations.some(v => v.file === "src/domain/shared/businessTime.ts")).toBe(true);
      expect(violations.every(v => v.file !== "src/domain/shared/numeric.ts")).toBe(true);
      expect(violations.every(v => v.file !== "apps/prototype-web/client/src/application/time/clock.ts")).toBe(true);
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
      /* (R11 W1A-2 / D-03): the synthetic tree carries none of the five live
       * pinned fallback sites, so the census-stale rule fires by design —
       * scope the assertion to everything except R4-guarded-fallback-stale
       * (its behavior is pinned by the D-03 fixtures below and the live run). */
      expect(findViolations(dir).filter(v => !v.rule.startsWith("R4-guarded-fallback-stale"))).toEqual([]);
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe("R4 AST-bound ?? exemption (R11 W1A-2 / D-03 — R10A-F-014, OD-GUARD Option A)", () => {
  const PINNED_SITE = {
    file: "apps/prototype-web/client/src/components/forms/FormDraftRestoreBanner.tsx",
    content: "export const line = formatLocalDate(businessDateFromTimestamp(savedAt)) ?? savedAt.slice(0, 10);\n",
  };

  const pureR4 = violations => violations.filter(v => v.rule.startsWith("R4 ("));
  const rules = violations => violations.map(v => v.rule);

  it("a genuine pinned guarded fallback is exempt (no unregistered, no raw-slice violation)", () => {
    const dir = makeTree(tree => {
      write(tree, PINNED_SITE.file, PINNED_SITE.content);
    });
    try {
      const violations = findViolations(dir);
      expect(pureR4(violations)).toEqual([]);
      expect(violations.some(v => v.rule.startsWith("R4-guarded-fallback-unregistered") && v.file === PINNED_SITE.file)).toBe(false);
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  it("a SIXTH guarded fallback (new file/receiver) is rejected as unregistered", () => {
    const dir = makeTree(tree => {
      write(tree, "apps/prototype-web/client/src/pages/SomePage.tsx", "const d = canon(x) ?? x.slice(0, 10);\n");
    });
    try {
      const violations = findViolations(dir);
      expect(pureR4(violations)).toEqual([]);
      expect(violations.some(v => v.rule.startsWith("R4-guarded-fallback-unregistered") && v.file.includes("SomePage.tsx"))).toBe(true);
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  it("a comment containing ?? never exempts a raw slice", () => {
    const dir = makeTree(tree => {
      write(tree, "apps/prototype-web/client/src/pages/A.ts", "const d = stamp.slice(0, 10); // fallback ?? guard\n");
    });
    try {
      expect(pureR4(findViolations(dir)).some(v => v.file.endsWith("A.ts"))).toBe(true);
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  it("a string containing ?? never exempts a raw slice", () => {
    const dir = makeTree(tree => {
      write(tree, "apps/prototype-web/client/src/pages/A.ts", 'const label = "a ?? b";\nconst d = stamp.slice(0, 10);\n');
    });
    try {
      expect(pureR4(findViolations(dir)).some(v => v.file.endsWith("A.ts"))).toBe(true);
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  it("a NEIGHBORING ?? in the same line/statement never exempts (the false-exemption class)", () => {
    const dir = makeTree(tree => {
      /* نفس السطر يحوي ?? في استدعاء مجاور — القاعدة النصية القديمة كانت تعفيه. */
      write(tree, "apps/prototype-web/client/src/pages/A.ts", "print(a ?? b); const d = stamp.slice(0, 10);\n");
    });
    try {
      expect(pureR4(findViolations(dir)).some(v => v.file.endsWith("A.ts"))).toBe(true);
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  it("|| never exempts a raw slice (nullish only, by the approved contract)", () => {
    const dir = makeTree(tree => {
      write(tree, "apps/prototype-web/client/src/pages/A.ts", "const d = canon(stamp) || stamp.slice(0, 10);\n");
    });
    try {
      expect(pureR4(findViolations(dir)).some(v => v.file.endsWith("A.ts"))).toBe(true);
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  it("the slice must be the DIRECT right operand: left-operand or nested slices do not exempt", () => {
    const dir = makeTree(tree => {
      /* القص داخل المعامل الأيسر لا يعفي القص الظاهر في الأيمن. */
      write(tree, "apps/prototype-web/client/src/pages/A.ts", "const d = canon(stamp.slice(0, 10)) ?? other.slice(0, 10);\n");
    });
    try {
      const violations = pureR4(findViolations(dir)).filter(v => v.file.endsWith("A.ts"));
      /* القص داخل المعامل الأيسر يُصاد خامًا (1)؛ القص الأيمن المباشر معفى
       * بنيويًا لكنه موقع سادس غير مسجل — يُصاد بقاعدة التسجيل لا بقاعدة القص. */
      expect(violations.length).toBe(1);
      expect(findViolations(dir).some(v => v.rule.startsWith("R4-guarded-fallback-unregistered") && v.file.endsWith("A.ts"))).toBe(true);
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  it("a multi-line ?? whose right operand IS the slice is structurally exempt (AST truth, superseding the same-line text rule)", () => {
    const dir = makeTree(tree => {
      write(tree, PINNED_SITE.file, "export const line =\n  formatLocalDate(businessDateFromTimestamp(savedAt))\n  ?? savedAt.slice(0, 10);\n");
    });
    try {
      const violations = findViolations(dir);
      expect(pureR4(violations)).toEqual([]);
      expect(violations.some(v => v.rule.startsWith("R4-guarded-fallback-unregistered") && v.file === PINNED_SITE.file)).toBe(false);
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  it("split(\"T\")[0] forms: exempt as a direct ?? right operand; raw otherwise", () => {
    const dir = makeTree(tree => {
      write(tree, "apps/prototype-web/client/src/pages/A.ts", 'const d = canon(stamp) ?? stamp.split("T")[0];\n');
      write(tree, "apps/prototype-web/client/src/pages/B.ts", 'const d = stamp.split("T")[0];\n');
    });
    try {
      const violations = findViolations(dir);
      expect(pureR4(violations).some(v => v.file.endsWith("B.ts"))).toBe(true);
      expect(pureR4(violations).some(v => v.file.endsWith("A.ts"))).toBe(false);
      /* A.ts fallback محروس لكنه غير مسجل (سادس) — يُصاد بالقاعدة المنفصلة. */
      expect(violations.some(v => v.rule.startsWith("R4-guarded-fallback-unregistered") && v.file.endsWith("A.ts"))).toBe(true);
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  it("a parse-error file fails closed (R4-PARSE-ERROR) and skips the rest of that file's checks", () => {
    const dir = makeTree(tree => {
      write(tree, "apps/prototype-web/client/src/pages/Broken.ts", "const d = ((( ;\nexport const x = 1;\n");
    });
    try {
      const violations = findViolations(dir);
      expect(violations.some(v => v.rule.startsWith("R4-PARSE-ERROR") && v.file.endsWith("Broken.ts"))).toBe(true);
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  it("stale: a pinned site whose operand/receiver text changed requires same-PR re-anchoring", () => {
    const dir = makeTree(tree => {
      /* نفس الملف لكن المعامل الأيسر تغيّر (renamed variable) — المفتاح لم يعد يطابق. */
      write(tree, PINNED_SITE.file, "export const line = formatLocalDate(businessDateFromTimestamp(savedStamp)) ?? savedStamp.slice(0, 10);\n");
    });
    try {
      const violations = findViolations(dir);
      expect(pureR4(violations)).toEqual([]);
      expect(violations.some(v => v.rule.startsWith("R4-guarded-fallback-unregistered") && v.file === PINNED_SITE.file)).toBe(true);
      expect(violations.some(v => v.rule.startsWith("R4-guarded-fallback-stale") && v.excerpt.includes(PINNED_SITE.file))).toBe(true);
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  it("the live repository passes with exactly the five approved sites (no stale, no sixth)", () => {
    const violations = findViolations();
    expect(violations).toEqual([]);
  });
});
