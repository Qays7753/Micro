/**
 * MNG-LOCAL-04/05/06 (Post-Group 6 Wave 5 / DOC-041، 2026-11-21): فحوص حدود
 * الاستيراد المحلي — العمق والعدد فوق حد الحجم القائم، والتسمية الصادقة
 * لقدر بصمة SHA-256 في ملف التصدير (تكشف التلف العرضي فقط، لا الأصالة).
 */
import { describe, expect, it } from "vitest";
import {
  IMPORT_COUNT_LIMIT_MESSAGE,
  IMPORT_DEPTH_LIMIT_MESSAGE,
  MAX_IMPORT_FAMILY_RECORDS,
  MAX_IMPORT_JSON_DEPTH,
  MAX_IMPORT_TOTAL_RECORDS,
  importFamilyCountVerdict,
  isWithinImportDepth,
  measureJsonDepth,
} from "./transferResourceLimits";

describe("MNG-LOCAL-06: import depth/count resource limits", () => {
  it("measureJsonDepth measures honest export-like nesting (flat ≈ 2-3 levels)", () => {
    expect(measureJsonDepth(null)).toBe(0);
    expect(measureJsonDepth("text")).toBe(0);
    expect(measureJsonDepth({ a: 1 })).toBe(1);
    expect(measureJsonDepth({ data: { orders: [{ id: 1 }] } })).toBe(4);
  });

  it("a hostile deeply-nested value is rejected by the depth gate", () => {
    // Build depth 10_000 hostile nesting programmatically (small text, deep tree).
    let hostile: unknown = { id: "x" };
    for (let index = 0; index < 10_000; index += 1) {
      hostile = { nested: hostile };
    }
    expect(measureJsonDepth(hostile)).toBeGreaterThan(MAX_IMPORT_JSON_DEPTH);
    expect(isWithinImportDepth(hostile)).toBe(false);
  });

  it("an honest export depth passes with a wide margin", () => {
    const honest = {
      format: "micro-prototype-local-export",
      data: { orders: [{ id: "o-1", items: [{ id: "i-1", note: { deep: { deeper: 1 } } }] }] },
    };
    expect(isWithinImportDepth(honest)).toBe(true);
  });

  it("the family-count verdict rejects a bloated family and a bloated total", () => {
    const bloatedFamily: Record<string, unknown> = {
      orders: Array.from({ length: MAX_IMPORT_FAMILY_RECORDS + 1 }, (_, index) => ({ id: `o-${index}` })),
    };
    expect(importFamilyCountVerdict(bloatedFamily)).toEqual({
      ok: false,
      reason: "family",
      family: "orders",
    });
    // Many families each under the family cap but over the total.
    const bloatedTotal: Record<string, unknown> = {};
    for (let family = 0; family < 60; family += 1) {
      bloatedTotal[`family-${family}`] = Array.from({ length: 1000 }, (_, index) => ({ id: index }));
    }
    expect(importFamilyCountVerdict(bloatedTotal)).toEqual({ ok: false, reason: "total" });
    const honest: Record<string, unknown> = { orders: [{ id: "o-1" }], profile: null };
    expect(importFamilyCountVerdict(honest)).toEqual({ ok: true });
  });

  it("the limit messages state honestly that nothing was written", () => {
    expect(IMPORT_DEPTH_LIMIT_MESSAGE).toContain("قبل أي كتابة");
    expect(IMPORT_COUNT_LIMIT_MESSAGE).toContain("قبل أي كتابة");
    expect(MAX_IMPORT_TOTAL_RECORDS).toBeGreaterThan(MAX_IMPORT_FAMILY_RECORDS);
  });

  /* MNG-LOCAL-06 (إصلاح النتيجة المفتوحة 2026-11-23 — WS-254/DOC-044):
   * اختبارا الحافة بالضبط عند السقفين — عند السقف تمامًا يمر الفحص (رفضُ
   * ملف صادق عند حده الأعلى خطأ منعٌ لمشروع مشروع)، وفوقه بواحد فقط يُرفض.
   * هذا استكمال «واختبار الحدود» التي بقيت ناقصة في الموجة ٥. */
  it("the EXACT family boundary: a family at exactly the cap passes, one record over is refused", () => {
    const atCap: Record<string, unknown> = {
      orders: Array.from({ length: MAX_IMPORT_FAMILY_RECORDS }, (_, index) => ({ id: `o-${index}` })),
    };
    expect(importFamilyCountVerdict(atCap)).toEqual({ ok: true });
    const oneOver: Record<string, unknown> = {
      orders: Array.from({ length: MAX_IMPORT_FAMILY_RECORDS + 1 }, (_, index) => ({ id: `o-${index}` })),
    };
    expect(importFamilyCountVerdict(oneOver)).toEqual({ ok: false, reason: "family", family: "orders" });
  });

  it("the EXACT total boundary: a total at exactly the cap passes, one record over is refused", () => {
    // Three families (each at or under the family cap) summing to exactly the
    // total cap: 20_000 + 20_000 + 10_000 = MAX_IMPORT_TOTAL_RECORDS.
    const filler = (family: string, count: number) => ({
      [family]: Array.from({ length: count }, (_, index) => ({ id: `${family}-${index}` })),
    });
    const atCapTotal: Record<string, unknown> = {
      ...filler("orders", MAX_IMPORT_FAMILY_RECORDS),
      ...filler("materials", MAX_IMPORT_FAMILY_RECORDS),
      ...filler("assets", MAX_IMPORT_TOTAL_RECORDS - 2 * MAX_IMPORT_FAMILY_RECORDS),
    };
    expect(importFamilyCountVerdict(atCapTotal)).toEqual({ ok: true });
    const oneOverTotal: Record<string, unknown> = {
      ...filler("orders", MAX_IMPORT_FAMILY_RECORDS),
      ...filler("materials", MAX_IMPORT_FAMILY_RECORDS),
      ...filler("assets", MAX_IMPORT_TOTAL_RECORDS - 2 * MAX_IMPORT_FAMILY_RECORDS + 1),
    };
    expect(importFamilyCountVerdict(oneOverTotal)).toEqual({ ok: false, reason: "total" });
  });

  it("the EXACT depth boundary: nesting at exactly the cap passes, one level over is refused", () => {
    const atCap: Record<string, unknown> = { level: 1 };
    let node: Record<string, unknown> = atCap;
    for (let index = 1; index < MAX_IMPORT_JSON_DEPTH; index += 1) {
      node.nested = { level: index + 1 };
      node = node.nested as Record<string, unknown>;
    }
    expect(measureJsonDepth(atCap)).toBe(MAX_IMPORT_JSON_DEPTH);
    expect(isWithinImportDepth(atCap)).toBe(true);
    node.nested = { oneMore: true };
    expect(measureJsonDepth(atCap)).toBe(MAX_IMPORT_JSON_DEPTH + 1);
    expect(isWithinImportDepth(atCap)).toBe(false);
  });
});

describe("MNG-LOCAL-04: the export-authenticity honest labeling", () => {
  it("the Settings export notice carries the accidental-corruption-only wording", async () => {
    const fs = await import("node:fs");
    const path = await import("node:path");
    const settings = fs.readFileSync(path.resolve(import.meta.dirname, "../../pages/Settings.tsx"), "utf8");
    /* التسمية الصادقة: البصمة تكشف التلف العرضي فقط ولا تثبت الأصالة —
     * النص في رسالة نجاح التصدير نفسها. */
    expect(settings).toContain("تكشف التلف العرضي");
    expect(settings).toContain("لا تثبت أصالة الملف");
    expect(settings).toContain("MNG-LOCAL-04");
  });

  /* MNG-LOCAL-04 (إصلاح النتيجة المفتوحة 2026-11-23 — WS-254/DOC-044):
   * التسمية الصادقة نفسها عند لحظة قرار الثقة في الاستيراد — معاينة
   * الاستعادة داخل قسم حماية البيانات، لا في إشعار التصدير وحده. */
  it("the restore preview ALSO states the accidental-corruption-only guarantee at the trust-decision moment", async () => {
    const fs = await import("node:fs");
    const path = await import("node:path");
    const section = fs.readFileSync(
      path.resolve(import.meta.dirname, "../../components/settings/SettingsDataProtectionSection.tsx"),
      "utf8",
    );
    expect(section).toContain("MNG-LOCAL-04");
    expect(section).toContain("يكشف التلف العرضي");
    expect(section).toContain("ولا يثبت مصدر الملف أو أصالته");
    expect(section).toContain("لا توقيعًا رقميًّا");
    expect(section).toContain("مصدرك الموثوق");
  });
});
