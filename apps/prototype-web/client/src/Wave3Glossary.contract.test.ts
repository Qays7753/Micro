/* W3-C (REM-003 — F-032 الجزء التوثيقي): حارس عقد القاموس (بيئة node — قراءة
 * الوثيقة فقط). يثبّت أن إدخالات الدلالات المُشحّنة موجودة وتحمل أساسها:
 * قيمة الطلب القابلة للتحصيل بأساس D-15-A، والتسوية بمعانيها الثلاثة،
 * والتغطية بمعنييها، ووعد MIC للقراءة فقط — مع مرساتي W3-A/W3-B
 * («المحتسب عند التسليم» و«حالة الرقم») في جدول المصطلح الملزم.
 * التعديل على القاموس نفسه قرار مالك يوثق — هذا الفحص يمنع الإزالة الصامتة. */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

function readGlossary(): string {
  return readFileSync(fileURLToPath(new URL("../../../../docs/08-glossary.md", import.meta.url)), "utf8");
}

describe("W3-C — قاموس 08: إدخالات الدلالات المُشحّنة (F-032)", () => {
  it("قيمة الطلب القابلة للتحصيل توثّق أساس D-15-A: السعر المتفق + مساهمة العميل عبر المشروع", () => {
    const glossary = readGlossary();
    const entry = glossary.slice(glossary.indexOf("| قيمة الطلب القابلة للتحصيل |"));
    expect(entry).toContain("السعر المتفق");
    expect(entry).toContain("مساهمة توصيل العميل");
    expect(entry).toContain("عقد ٢");
    /* الحد المباشر: ما يدفعه الزبون للناقل مباشرةً خارج الأساس والكاش. */
    expect(entry).toContain("مباشرةً");
  });

  it("التسوية توثّق معانيها الثلاثة والتغطية معنييها — لا تُخلط", () => {
    const glossary = readGlossary();
    const settlement = glossary.slice(glossary.indexOf("| التسوية |"));
    expect(settlement).toContain("تمت التسوية");
    expect(settlement).toContain("العربون المحتفظ");
    expect(settlement).toContain("ذمة المورد");
    const coverage = glossary.slice(glossary.indexOf("| التغطية |"));
    expect(coverage).toContain("بعد الالتزامات");
    expect(coverage).toContain("المصاريف الثابتة");
  });

  it("المظروف وMIC والكاش المسجل والعربون المصنّف والبيع المباشر: الإدخالات موجودة بحدودها", () => {
    const glossary = readGlossary();
    expect(glossary).toContain("| الكاش المسجل |");
    expect(glossary).toContain("| عربون محتفظ به مصنّف |");
    expect(glossary).toContain("| البيع المباشر |");
    expect(glossary).toContain("| المظروف |");
    const mic = glossary.slice(glossary.indexOf("| MIC |"));
    expect(mic).toContain("قراءة فقط");
    expect(mic).toContain("لا تكتب ولا تصلح");
  });

  it("مرساتا W3-A/W3-B باقيتان في جدول المصطلح الملزم (منع الإزالة الصامتة)", () => {
    const glossary = readGlossary();
    expect(glossary).toContain("«المحتسب عند التسليم»");
    expect(glossary).toContain("«حالة الرقم: مؤكد / تقديري»");
  });
});
