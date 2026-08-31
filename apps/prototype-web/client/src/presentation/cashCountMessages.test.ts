import { describe, expect, it } from "vitest";
import {
  cashCountDifferenceReason,
  cashCountSettledMessage,
  cashCountSettlementNote,
} from "./cashCountMessages";

/* F-001 (انحدار): كان نص العدّ يقسم على 1000 (مقياس الكميات) والفرق يُعرض وحدات
 * صغرى خامًا. الاختبار يحرس أن كل نص مالي بمقياس المال 1/100 عبر المنسّق المشترك. */
describe("cash count money messages use the shared money scale (F-001 regression)", () => {
  it("renders the counted amount on the money scale, never 1/1000", () => {
    const note = cashCountSettlementNote(25000); // 250.00 JOD
    expect(note).toContain("250.00");
    expect(note).not.toContain("25 د.أ");
    const settled = cashCountSettledMessage(25000);
    expect(settled).toContain("250.00");
    expect(settled).not.toContain("25 د.أ");
  });

  it("renders the difference reason on the money scale, not raw minor units", () => {
    expect(cashCountDifferenceReason(3000)).toContain("+30.00");
    expect(cashCountDifferenceReason(-3000)).toContain("-30.00");
    expect(cashCountDifferenceReason(3000)).not.toContain("+3000");
    expect(cashCountDifferenceReason(-3000)).not.toContain("-3000");
  });

  it("keeps formatting consistent with the shared formatter for grouping", () => {
    // 1,250,000 minor = 12,500.00 JOD — التجميع بفواصل كما في كل واجهات المال.
    expect(cashCountSettlementNote(1250000)).toContain("12,500.00");
  });
});
