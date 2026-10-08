import { describe, expect, it } from "vitest";
import { formatEnglishQuantityEcho } from "./englishNumeric";

/*
 * R2 (WS-216/ARCH-007 — M-07/D14، 2026-10-08): عقد صدى إدخال الكمية،
 * مملوكًا في نواة الإدخال. العقد صريح وموثق ومختلف عن عرض القراءة:
 *  • صدى الإدخال: تمثيل ثابت 3 منازل مع قصّ الكسر الصفري الكامل فقط —
 *    «1.500» تبقى «1.500» و«1.000» تصير «1» (يرى المستخدم رقمه بصيغة
 *    الإدخال نفسها عند التمويه والعودة).
 *  • عرض القراءة (formatQuantityMilli في بيت التنسيق): يقصّ كل الأصفار
 *    اللاحقة — 1500 ملي ← «1.5» (توصيف مثبت في formatters.characterization).
 * عقدين مملوكين مختبرين — لا مصادفة تكرار.
 */

describe("R2 regression — input-echo quantity formatter (M-07/D14, 2026-10-08)", () => {
  it("keeps user-typed trailing zeros within the fraction (1.500 stays 1.500)", () => {
    expect(formatEnglishQuantityEcho(1500)).toBe("1.500");
    expect(formatEnglishQuantityEcho(1550)).toBe("1.550");
    expect(formatEnglishQuantityEcho(1234)).toBe("1.234");
  });

  it("trims only the all-zero fraction (1.000 => 1; 0 => 0)", () => {
    expect(formatEnglishQuantityEcho(1000)).toBe("1");
    expect(formatEnglishQuantityEcho(0)).toBe("0");
    expect(formatEnglishQuantityEcho(2000)).toBe("2");
  });

  it("renders null as the empty input string", () => {
    expect(formatEnglishQuantityEcho(null)).toBe("");
  });

  it("is deliberately distinct from the read/display formatter (documented divergence)", () => {
    /* الصدى يثبّت المنازل؛ العرض يقصّ كل الأصفار اللاحقة — الاختلاف عقد
     * موثق لا عيب (يسري أيضًا على 1.50 → صدى «1.500» / عرض «1.5»). */
    expect(formatEnglishQuantityEcho(1500)).toBe("1.500");
    expect(formatEnglishQuantityEcho(1500)).not.toBe("1.5");
    expect(formatEnglishQuantityEcho(50000)).toBe("50"); /* الكسر الصفري الكامل يُقص دائمًا */
  });
});
