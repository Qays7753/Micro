import { describe, expect, it } from "vitest";
import { cashCountSettledMessage } from "./cashCountMessages";

/*
 * F-001 (انحدار): كان نص العدّ يقسم على 1000 (مقياس الكميات) — الاختبار
 * يحرس أن كل نص مالي لحظي بمقياس المال 1/100 عبر المنسّق المشترك.
 * R2 (M-10/D11، 2026-10-08): بانيا نص السجل المحفوظ (الملاحظة/السبب)
 * انتقلا إلى طبقة التطبيق واختبارهما إلى application/cash — ما بقي هنا
 * عقد رسالة التوست اللحظية فقط (عرض بفواصل التجميع كما في كل واجهات المال).
 */
describe("cash count transient toast message uses the shared money scale (F-001 regression)", () => {
  it("renders the settled toast on the money scale, never 1/1000", () => {
    const settled = cashCountSettledMessage(25_000); // 250.00 JOD
    expect(settled).toContain("250.00");
    expect(settled).not.toContain("25 د.أ");
  });

  it("keeps display grouping in the transient toast — the display contract, not the persisted contract", () => {
    // 1,250,000 minor = 12,500.00 JOD — التجميع بفواصل كما في كل واجهات المال.
    expect(cashCountSettledMessage(1_250_000)).toContain("12,500.00");
  });
});
