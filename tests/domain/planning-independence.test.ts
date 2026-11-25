/**
 * M1.1 (§14.3 / IMPACT S1 — أمر تنفيذ المرحلة ١): فحص مصدر يثبت استقلال
 * عائلة التخطيط (أدواتي) عن `craft-order` — لا أي حافة استيراد (ثابتة أو
 * ديناميكية أو تصدير-من) تشير إلى `craft-order` من أي ملف تحت
 * `src/domain/planning`. القراءة عبر استيراد المصدر الخام (?raw) لكل
 * ملفات العائلة (تلقائية بلا قائمة يدوية)، والتعليقات النثرية التي تذكر
 * الاسم التاريخي لا تُحسب اعتمادًا؛ العدّ على محددات الوحدات في عبارات
 * الاستيراد فقط.
 */
import { describe, expect, it } from "vitest";

const planningSources: Record<string, string> = import.meta.glob("../../src/domain/planning/**/*", {
  query: "?raw",
  import: "default",
  eager: true,
});

/** محدد وحدة يشير إلى craft-order داخل أي عبارة استيراد/تصدير-من/استيراد ديناميكي/require. */
const CRAFT_ORDER_IMPORT_PATTERN =
  /from\s*["'][^"']*craft-order[^"']*["']|import\s*\(\s*["'][^"']*craft-order[^"']*["']|require\s*\(\s*["'][^"']*craft-order[^"']*["']/;

describe("M1.1 (§14.3 / IMPACT S1) — planning independence source scan", () => {
  it("src/domain/planning contains no craft-order import edge", () => {
    expect(Object.keys(planningSources).length).toBeGreaterThan(0);
    const offenders = Object.entries(planningSources)
      .filter(([, source]) => CRAFT_ORDER_IMPORT_PATTERN.test(source))
      .map(([file]) => file);
    expect(offenders).toEqual([]);
  });
});
