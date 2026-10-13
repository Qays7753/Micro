/**
 * R10-B5/NF-020 (2026-10-13): اختبار دخاني لأدوات التضييق — يثبت عقد
 * assertOk/okValue قبل أن تستهلكهما ملفات الاختبار في شريحة إزالة الاستثناء
 * (الجزء الثاني): التضييق النوعي (value متاح بعد assertOk)، إعادة القيمة
 * من okValue، ورمي الذراع الفاشلة برسالتها في كليهما.
 */
import { describe, expect, it } from "vitest";
import { assertOk, okValue } from "./resultAssertions";

type ProbeResult = { ok: true; value: { count: number } } | { ok: false; message: string };

describe("testing/resultAssertions — NF-020 groundwork", () => {
  it("assertOk narrows to the ok arm (value accessible) and returns silently", () => {
    const result: ProbeResult = { ok: true, value: { count: 3 } };
    assertOk(result);
    expect(result.value.count).toBe(3);
  });

  it("assertOk throws on the failure arm carrying its message", () => {
    const result: ProbeResult = { ok: false, message: "storage refused" };
    expect(() => assertOk(result)).toThrow(/storage refused/);
  });

  it("okValue returns the ok arm's value", () => {
    const result: ProbeResult = { ok: true, value: { count: 7 } };
    expect(okValue(result).count).toBe(7);
  });

  it("okValue throws on the failure arm carrying its message", () => {
    const result: ProbeResult = { ok: false, message: "validation rejected" };
    expect(() => okValue(result)).toThrow(/validation rejected/);
  });

  it("a failure arm without a message still throws with the plain contract line", () => {
    const bare: { ok: boolean } & Record<string, unknown> = { ok: false, code: "storage_stale" };
    expect(() => okValue(bare as never)).toThrow(/okValue — expected the ok arm/);
  });
});
