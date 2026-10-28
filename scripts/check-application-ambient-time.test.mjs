import { describe, expect, it } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { classifyAmbientTime, ROOT, APPROVED_ID_FALLBACK_SITES } from "./check-application-ambient-time.mjs";

/*
 * اختبارات حارس الزمن المحيطي لطبقة التطبيق (R11 W1b-3 / D-12 — OD-TIME):
 * يثبت أن الحارس يمسك بكل ما يجب رفضه ويمرر ما هو معتمد — مع سلبيات
 * خصومية صريحة (تعليقات، نصوص، ||، مستقبل خاطئ، fallback خاطئ، متغيرات
 * معاد تسميتها، قراءات خارج العائلة، بناء محيط، ساعة أداء، مرجع بلا
 * نداء، فشل مغلق عند خطأ التحليل) وثبات الجرد الحي (22 موقعًا).
 *
 * ملاحظة بنيوية: في أشجار الاختبار المؤقتة تغيب الملفات المثبتة الـ21
 * كلها، فتظهر 21 خرق AT-stale-id-fallback-site حتمًا — الاختبارات تعزل
 * قواعدها المستهدفة بالتصفية وتتحقق من العدد الحتمي صراحة حيث يلزم.
 */

function makeTree(build) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "r11-od-time-guard-"));
  build(dir);
  return dir;
}

function write(dir, relative, content) {
  const full = path.join(dir, relative);
  fs.mkdirSync(path.dirname(full), { recursive: true });
  fs.writeFileSync(full, content);
}

function rulesOf(violations) {
  return violations.map(violation => violation.rule);
}

function withTree(build, run) {
  const dir = makeTree(build);
  try {
    return run(classifyAmbientTime(dir));
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

describe("check-application-ambient-time (R11 W1b-3 / D-12 — OD-TIME)", () => {
  it("الجرد الحي: صفر خرق؛ 22 منطقة معتمدة فيها 22 نداء معفى؛ منفذ ساعة واحد؛ التحليل الصريح مسموح", () => {
    const { violations, stats } = classifyAmbientTime(ROOT);
    expect(violations).toEqual([]);
    expect(stats.files).toBeGreaterThan(100);
    expect(stats.approvedIdFallbackRegions).toBe(22);
    expect(stats.approvedDateNowCalls).toBe(22);
    expect(stats.clockBoundarySites).toBe(1);
    expect(stats.parseCalls).toBeGreaterThan(0);
  });

  it("تعليق يحوي النمط لا يُعفي ولا يُدان (الربط AST لا نصي)", () => {
    const { violations, stats } = withTree(
      tree => {
        write(
          tree,
          "apps/prototype-web/client/src/application/demo/comment.ts",
          "// globalThis.crypto?.randomUUID?.() ?? Date.now()\nconst ok = 1;\n",
        );
      },
      result => result,
    );
    expect(
      rulesOf(violations).filter(rule => rule.startsWith("AT-date-now") || rule === "AT-performance-now"),
    ).toEqual([]);
    expect(stats.approvedIdFallbackRegions).toBe(0);
  });

  it("نص يحوي النمط لا يُعفي ولا يُدان", () => {
    const { violations, stats } = withTree(
      tree => {
        write(
          tree,
          "apps/prototype-web/client/src/application/demo/str.ts",
          'export const doc = "Date.now() behind globalThis.crypto?.randomUUID?.() ??";\n',
        );
      },
      result => result,
    );
    expect(rulesOf(violations).filter(rule => rule.startsWith("AT-date-now"))).toEqual([]);
    expect(stats.approvedIdFallbackRegions).toBe(0);
  });

  it("|| بدل ??: لا إعفاء — الخرق AT-date-now-out-of-family", () => {
    const { violations } = withTree(
      tree => {
        write(
          tree,
          "apps/prototype-web/client/src/application/demo/orshape.ts",
          "export const id = globalThis.crypto?.randomUUID?.() || `x-${Date.now()}`;\n",
        );
      },
      result => result,
    );
    expect(rulesOf(violations)).toContain("AT-date-now-out-of-family");
  });

  it("مستقبل خاطئ (randomXUUID / foo.randomUUID): لا إعفاء", () => {
    const { violations } = withTree(
      tree => {
        write(
          tree,
          "apps/prototype-web/client/src/application/demo/wrongrecv.ts",
          "export const a = globalThis.crypto?.randomXUUID?.() ?? `x-${Date.now()}`;\n" +
            'const foo = { randomUUID: () => "u" };\n' +
            "export const b = foo.randomUUID?.() ?? `y-${Date.now()}`;\n",
        );
      },
      result => result,
    );
    expect(rulesOf(violations).filter(rule => rule === "AT-date-now-out-of-family")).toHaveLength(2);
  });

  it("fallback خاطئ الموضع: Date.now() في المعامل الأيسر لا يُعفى", () => {
    const { violations } = withTree(
      tree => {
        write(
          tree,
          "apps/prototype-web/client/src/application/demo/leftslot.ts",
          "export const id = `${Date.now()}` ?? globalThis.crypto?.randomUUID?.();\n",
        );
      },
      result => result,
    );
    expect(rulesOf(violations)).toContain("AT-date-now-out-of-family");
  });

  it("متغير وسيط (alias) يكسر الربط البنيوي: لا إعفاء", () => {
    const { violations } = withTree(
      tree => {
        write(
          tree,
          "apps/prototype-web/client/src/application/demo/alias.ts",
          "const c = globalThis.crypto;\nexport const id = c?.randomUUID?.() ?? `x-${Date.now()}`;\n",
        );
      },
      result => result,
    );
    expect(rulesOf(violations)).toContain("AT-date-now-out-of-family");
  });

  it("قراءة ساعة عارية خارج العائلة: مرفوضة", () => {
    const { violations } = withTree(
      tree => {
        write(
          tree,
          "apps/prototype-web/client/src/application/demo/bare.ts",
          "export const stamp = () => Date.now();\n",
        );
      },
      result => result,
    );
    expect(rulesOf(violations)).toContain("AT-date-now-out-of-family");
  });

  it("ثلاثي بشرط ناقص أو بفرع وفاء بلا نداء randomUUID: لا إعفاء", () => {
    const { violations } = withTree(
      tree => {
        write(
          tree,
          "apps/prototype-web/client/src/application/demo/ternarybad.ts",
          'export const a = typeof crypto !== "undefined" ? crypto.randomUUID() : `x-${Date.now()}`;\n' +
            'export const b = typeof crypto !== "undefined" && "randomUUID" in crypto ? `x` : `y-${Date.now()}`;\n',
        );
      },
      result => result,
    );
    expect(rulesOf(violations).filter(rule => rule === "AT-date-now-out-of-family")).toHaveLength(2);
  });

  it("بناء محيط new Date() خارج clock.ts مرفوض؛ وداخل clock.ts مسموح لشكل systemClock فقط", () => {
    const { violations, stats } = withTree(
      tree => {
        write(
          tree,
          "apps/prototype-web/client/src/application/demo/ambient.ts",
          "export const now = () => new Date().toISOString();\n",
        );
        write(
          tree,
          "apps/prototype-web/client/src/application/time/clock.ts",
          "export const systemClock = () => new Date().toISOString();\nexport const rogue = () => new Date().getTime();\n",
        );
      },
      result => result,
    );
    const ambientRules = rulesOf(violations).filter(rule => rule === "AT-ambient-new-date");
    expect(ambientRules).toHaveLength(2); /* واحد في demo وواحد (rogue) داخل clock.ts نفسه */
    expect(stats.clockBoundarySites).toBe(1); /* شكل systemClock وحده مقبول */
  });

  it("التحليل الصريح new Date(value) وDate.parse(value) مسموح ومعدود", () => {
    const { violations, stats } = withTree(
      tree => {
        write(
          tree,
          "apps/prototype-web/client/src/application/demo/parse.ts",
          "export const f = (v: string) => new Date(v);\nexport const g = (v: string) => Date.parse(v);\n",
        );
      },
      result => result,
    );
    expect(rulesOf(violations).filter(rule => rule !== "AT-stale-id-fallback-site")).toEqual([]);
    expect(stats.parseCalls).toBe(2);
  });

  it("performance.now() مرفوض", () => {
    const { violations } = withTree(
      tree => {
        write(
          tree,
          "apps/prototype-web/client/src/application/demo/perf.ts",
          "export const t = () => performance.now();\n",
        );
      },
      result => result,
    );
    expect(rulesOf(violations)).toContain("AT-performance-now");
  });

  it("مرجع Date.now بدون نداء (ساعة مقنعة) مرفوض", () => {
    const { violations } = withTree(
      tree => {
        write(
          tree,
          "apps/prototype-web/client/src/application/demo/ref.ts",
          "export const clock = Date.now;\n",
        );
      },
      result => result,
    );
    expect(rulesOf(violations)).toContain("AT-date-now-reference");
  });

  it("موقع معتمد جديد في ملف غير مثبت: AT-new-id-fallback-site (نمط الراتشة)", () => {
    const { violations } = withTree(
      tree => {
        write(
          tree,
          "apps/prototype-web/client/src/application/demo/newsite.ts",
          "export const id = globalThis.crypto?.randomUUID?.() ?? `x-${Date.now()}-${Math.random().toString(16).slice(2)}`;\n",
        );
      },
      result => result,
    );
    const rules = rulesOf(violations);
    expect(rules).toContain("AT-new-id-fallback-site");
    expect(rules).not.toContain("AT-date-now-out-of-family"); /* الشكل بنيويًا سليم — الرفض للجاتشة فقط */
    expect(rules.filter(rule => rule === "AT-stale-id-fallback-site")).toHaveLength(
      APPROVED_ID_FALLBACK_SITES.length,
    );
  });

  it("الشكلان المعتمدان في ملف مثبت (fixture للشكل أ والشكل ب) يعفيان النداءَين", () => {
    const { violations, stats } = withTree(
      tree => {
        write(
          tree,
          "apps/prototype-web/client/src/application/assets/assetService.ts",
          "export const id = (p: string) => `${p}-${globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`}`;\n",
        );
        write(
          tree,
          "apps/prototype-web/client/src/application/cost/costService.ts",
          'const newId = (prefix: string) =>\n  typeof crypto !== "undefined" && "randomUUID" in crypto\n    ? `${prefix}-${crypto.randomUUID()}`\n    : `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;\nexport { newId };\n',
        );
      },
      result => result,
    );
    const rules = rulesOf(violations);
    expect(rules).not.toContain("AT-date-now-out-of-family");
    expect(rules).not.toContain("AT-new-id-fallback-site");
    expect(stats.approvedIdFallbackRegions).toBe(2);
    expect(stats.approvedDateNowCalls).toBe(2);
    expect(rules.filter(rule => rule === "AT-stale-id-fallback-site")).toHaveLength(
      APPROVED_ID_FALLBACK_SITES.length - 2,
    );
  });

  it("خطأ تحليل TypeScript: فشل مغلق (AT-parse-error)", () => {
    const { violations } = withTree(
      tree => {
        write(tree, "apps/prototype-web/client/src/application/demo/broken.ts", "export const = :::\n");
      },
      result => result,
    );
    expect(rulesOf(violations)).toContain("AT-parse-error");
  });

  it("ملفات الاختبار خارج المسح أصلًا", () => {
    const { stats } = withTree(
      tree => {
        write(
          tree,
          "apps/prototype-web/client/src/application/demo/ok.test.ts",
          "export const t = () => Date.now();\n",
        );
      },
      result => result,
    );
    expect(stats.files).toBe(0);
  });
});
