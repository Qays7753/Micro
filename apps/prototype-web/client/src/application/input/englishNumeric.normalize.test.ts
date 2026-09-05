/** المجموعة ٦ (البند ٥): تطبيع حدود الإدخال — أرقام هندية/فارسية → إنجليزية
 * قبل أي فحص نمط؛ المعنى الرقمي محفوظ حرفيًا ولا يُمس نص حر. */
import { describe, expect, it } from "vitest";
import { allowsEnglishNumericText, normalizeAsciiDigits, parseEnglishNumericText } from "./englishNumeric";

describe("normalizeAsciiDigits — تطبيع حدود الإدخال (المجموعة ٦، البند ٥)", () => {
  it("يحول الأرقام العربية-الهندية إلى إنجليزية بلا تغيير المعنى", () => {
    expect(normalizeAsciiDigits("\u0661\u0662\u0665")).toBe("125");
    expect(normalizeAsciiDigits("\u0660.\u0665\u0660")).toBe("0.50");
  });

  it("يحول الأرقام الفارسية إلى إنجليزية", () => {
    expect(normalizeAsciiDigits("\u06F2\u06F7")).toBe("27");
  });

  it("يترك النص الإنجليزي والنص الحر العربي كما هما", () => {
    expect(normalizeAsciiDigits("12.50")).toBe("12.50");
    expect(normalizeAsciiDigits("كلام عربي")).toBe("كلام عربي");
    expect(normalizeAsciiDigits("")).toBe("");
  });

  it("الرقم الهند المطبَّع يجتاز فحص الإدخال ويُقرأ بالقيمة نفسها", () => {
    const normalized = normalizeAsciiDigits("\u0661\u0662\u0665");
    expect(allowsEnglishNumericText(normalized, "money")).toBe(true);
    expect(parseEnglishNumericText(normalized, "money")).toBe(12500);
    /* قبل التطبيع كان يُرفض رفض النمط — التحول عند الحد لا يفسد التحقق. */
    expect(allowsEnglishNumericText("\u0661\u0662\u0665", "money")).toBe(false);
  });

  it("خلط الأرقام الهندية والإشارة يُطبع كاملًا", () => {
    expect(normalizeAsciiDigits("-\u0664\u0665")).toBe("-45");
    expect(parseEnglishNumericText(normalizeAsciiDigits("-\u0664\u0665"), "signedInteger")).toBe(-45);
  });
});
