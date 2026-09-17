/* Wave 4.2 — P-4.2-5: فحوص عقدية (بيئة node — قراءة مصادر وعقود).
 * - الكتالوج بلا كتابة سياسة نهائيًا: القراءات والرابط السياقي فقط (F02/T3).
 * - Finance يركب سطح السياسات داخل «ملخص الفترة» بجوار «التغطية والتعادل».
 * - F04: البديل الكنوني للكتالوج = الرئيسية (مع العقد).
 * - عقد ٢٦ يوثق المنتج المرئي القانوني الأول لـdestinationWalletId (T7). */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { canonicalReturnFor } from "@/app/navigationContract";

function readSource(relative: string) {
  return readFileSync(fileURLToPath(new URL(relative, import.meta.url)), "utf8");
}

describe("P-4.2-5 — العقود والمصادر (F02/F04/T7)", () => {
  it("الكتالوج بلا كتابة سياسة: القراءة والرابط السياقي فقط (F02/T3)", () => {
    const catalogSource = readSource("./pages/Catalog.tsx");
    const readingsSource = readSource("./components/catalog/CatalogReadingsSection.tsx");
    /* لا استدعاء كاتب سياسات من أي ملف كتالوج — العرض والرابط فقط. */
    for (const source of [catalogSource, readingsSource]) {
      expect(source.includes("createPolicy")).toBe(false);
      expect(source.includes("deactivatePolicy")).toBe(false);
      expect(source.includes("createPolicySuccessor")).toBe(false);
    }
    /* الرابط السياقي إلى السطح المالي موجود مع حفظ المصدر (returnTo=/catalog). */
    expect(readingsSource.includes('withReturnTo("/finance?view=period", "/catalog")')).toBe(true);
  });

  it("السطح المنقول يقيم في المالية ويستدعي الكاتب القانوني عبر السياق (نقل لا نسخ)", () => {
    const financePolicies = readSource("./components/finance/FinancePoliciesSection.tsx");
    expect(financePolicies.includes("recurringWork.createPolicy")).toBe(true);
    expect(financePolicies.includes("recurringWork.deactivatePolicy")).toBe(true);
    /* لا استيراد قيمي للخدمة — الأنواع فقط (import type) مباحة والطريق
       القانوني سياق الخدمات (عقد 40 §4). */
    const valueImport = /import\s+\{[^}]*\}\s*from\s*"@\/application\/finance\/recurringWorkService"/;
    expect(valueImport.test(financePolicies)).toBe(false);
    expect(financePolicies.includes("usePrototypeServices")).toBe(true);
  });

  it("Finance يركب سطح السياسات داخل عرض «ملخص الفترة» بجوار «التغطية والتعادل»", () => {
    const financeSource = readSource("./pages/Finance.tsx");
    const coverageIndex = financeSource.indexOf("التغطية والتعادل");
    const policiesIndex = financeSource.indexOf("<FinancePoliciesSection />");
    expect(coverageIndex).toBeGreaterThan(-1);
    expect(policiesIndex).toBeGreaterThan(coverageIndex);
    /* داخل عرض الفترة فقط: يظهر بعد فرع view === "period". */
    const periodBranch = financeSource.indexOf('view === "position" ? (');
    expect(policiesIndex).toBeGreaterThan(periodBranch);
  });

  it("F04: البديل الكنوني للكتالوج صار الرئيسية (تحديث موثق واحد في الكود والعقد)", () => {
    expect(canonicalReturnFor("/catalog")).toBe("/");
    /* المسارات الأعمق داخل الكتالوج تعود لقائمته كما هي. */
    expect(canonicalReturnFor("/catalog/xyz")).toBe("/catalog");
    const contract = readSource(
      "../../../../docs/contracts/26-navigation-referrer-and-deep-link-contract.md",
    );
    expect(contract.includes("F04: الرئيسية بيت قسم «منتجاتي وخدماتي»")).toBe(true);
  });

  it("عقد ٢٦ يوثق المنتج المرئي القانوني الأول لـdestinationWalletId (T7)", () => {
    const contract = readSource(
      "../../../../docs/contracts/26-navigation-referrer-and-deep-link-contract.md",
    );
    expect(contract.includes("وزّع على هذه المحفظة")).toBe(true);
    expect(contract.includes("destinationWalletId=<id>&returnTo=/cash/wallet/<id>")).toBe(true);
  });

  it("عقد ٤٠ يغلق ملكية المنتجات لسياسات التوزيع (F02)", () => {
    const contract = readSource("../../../../docs/contracts/40-technical-ownership-map-contract.md");
    expect(contract.includes("سطح أُغلق في Wave 4.2 (P-4.2-5 — قرار F02/T3)")).toBe(true);
    expect(contract.includes("الكتالوج صار **بلا أي كتابة سياسة**")).toBe(true);
  });
});
