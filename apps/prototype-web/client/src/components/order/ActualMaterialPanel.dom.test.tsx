/** @vitest-environment jsdom */

/* Stage 2 — OPS-007 (عقد ١٣ سطر ٣٦): بطاقة «المادة المنفذة مقابل المخطط» تعرض
 * الفرق مع سبب نقص المعرفة — السبب نص مرئي لا نبرة فقط؛ الفرق لا يُخفى عند
 * needs_review، والمجهول لا يظهر 0.00 واثقة ولا نتيجة نهائية (عقد ٢٨ §٥).
 * مكوّن عرض صرف يعمل بالنموذج — بلا تخزين ولا خدمات (لا كتابة أصلًا). */
import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { ActualMaterialPanel, type MaterialState } from "@/components/order/ActualMaterialPanel";
import type { OrderActualMaterialComparison } from "@/application/inventory/inventoryMaterialService";

function comparisonOf(overrides: Partial<OrderActualMaterialComparison>): OrderActualMaterialComparison {
  return {
    orderId: "order-dom-1",
    status: "recorded",
    plannedMaterialMinor: 2000,
    actualMaterialMinor: 2500,
    actualQuantityMilli: 2000,
    varianceMinor: 500,
    consumptionCount: 1,
    actualCostKnowledge: "known",
    reviewReasons: [],
    ...overrides,
  };
}

function stateOf(comparison: OrderActualMaterialComparison): MaterialState {
  return { phase: "ready", comparison };
}

afterEach(() => {
  document.body.replaceChildren();
});

describe("Stage 2 — OPS-007: بطاقة المادة المنفذة تعلن سبب المراجعة بلا إخفاء الفرق", () => {
  it("recorded: يعرض المخطط والمنفذ والفرق بلا سبب مراجعة وبلا كلمة نهائي", () => {
    render(<ActualMaterialPanel state={stateOf(comparisonOf({}))} />);
    expect(screen.getByText("فرق مادة مسجل لهذا الطلب")).toBeTruthy();
    expect(screen.getByText("مادة مخططة")).toBeTruthy();
    expect(screen.getByText("مادة منفذة مسجلة")).toBeTruthy();
    expect(screen.getByText("الفرق")).toBeTruthy();
    const card = document.querySelector(".micro-info-card");
    expect(card?.textContent).toContain("20.00");
    expect(card?.textContent).toContain("25.00");
    expect(card?.textContent).toContain("+5.00");
    expect(screen.queryByTestId("actual-material-review-reasons")).toBeNull();
    expect(card?.textContent).not.toContain("نهائي");
  });

  it("not_recorded: حالة صادقة — لا مادة منفذة، ولا صفر مضلل", () => {
    render(
      <ActualMaterialPanel
        state={stateOf(
          comparisonOf({
            status: "not_recorded",
            actualMaterialMinor: null,
            actualQuantityMilli: null,
            varianceMinor: null,
            consumptionCount: 0,
            actualCostKnowledge: null,
          }),
        )}
      />,
    );
    expect(screen.getByText("لم تسجل مادة منفذة لهذا الطلب بعد")).toBeTruthy();
    expect(document.body.textContent).not.toContain("0.00");
    expect(document.body.textContent).not.toContain("الفرق");
  });

  it("needs_review بسبب التكلفة غير المعروفة: السبب نص مرئي والفرق يبقى ظاهرًا مؤهَّلًا", () => {
    render(
      <ActualMaterialPanel
        state={stateOf(
          comparisonOf({
            status: "needs_review",
            actualMaterialMinor: 0,
            varianceMinor: -2000,
            actualCostKnowledge: "unknown",
            reviewReasons: ["actual_cost_unknown"],
          }),
        )}
      />,
    );
    expect(screen.getByText("فرق المادة يحتاج مراجعة")).toBeTruthy();
    const reasons = screen.getByTestId("actual-material-review-reasons");
    expect(reasons.textContent).toContain("سبب المراجعة: التكلفة غير معروفة لبعض الاستهلاك المسجل");
    expect(reasons.textContent).toContain("أدنى من الحقيقة");
    /* عقد ١٣: الفرق لا يُخفى — القيمة والفرق يبقيان مرئيين مع السبب المصرَّح. */
    const card = document.querySelector(".micro-info-card");
    expect(card?.textContent).toContain("20.00");
    expect(card?.textContent).toContain("-20.00");
    expect(card?.textContent).not.toContain("نهائي");
  });

  it("needs_review بسبب لقطة التكلفة: سبب اللقطة يظهر ويرشد لحالة النتيجة", () => {
    render(
      <ActualMaterialPanel
        state={stateOf(
          comparisonOf({
            status: "needs_review",
            actualMaterialMinor: 800,
            varianceMinor: -1200,
            reviewReasons: ["snapshot_knowledge"],
          }),
        )}
      />,
    );
    const reasons = screen.getByTestId("actual-material-review-reasons");
    expect(reasons.textContent).toContain("سبب المراجعة: لقطة التكلفة ليست معروفة");
    expect(reasons.textContent).toContain("حالة النتيجة");
  });

  it("السببان معًا يظهران معًا في سطر الأسباب", () => {
    render(
      <ActualMaterialPanel
        state={stateOf(
          comparisonOf({
            status: "needs_review",
            actualMaterialMinor: 0,
            varianceMinor: -2000,
            actualCostKnowledge: "unknown",
            reviewReasons: ["snapshot_knowledge", "actual_cost_unknown"],
          }),
        )}
      />,
    );
    const reasons = screen.getByTestId("actual-material-review-reasons");
    expect(reasons.textContent).toContain("لقطة التكلفة ليست معروفة");
    expect(reasons.textContent).toContain("التكلفة غير معروفة لبعض الاستهلاك المسجل");
  });

  it("القيم المفقودة (دفاعيًا) تظهر شرطة صادقة لا صفرًا", () => {
    render(
      <ActualMaterialPanel
        state={stateOf(
          comparisonOf({
            status: "needs_review",
            actualMaterialMinor: null,
            varianceMinor: null,
            actualCostKnowledge: null,
            reviewReasons: ["snapshot_knowledge"],
          }),
        )}
      />,
    );
    const card = document.querySelector(".micro-info-card");
    /* MoneyValue: null → «—» لا 0.00 — لا قسرًا إلى الصفر في أي مسار.
     * (20.00 المخططة سليمة؛ المحظور 0.00 وحيدة كقيمة، لا كجزء من رقم أكبر.) */
    expect(card?.textContent).toContain("—");
    expect(/(^|[^0-9])0\.00($|[^0-9])/.test(card?.textContent ?? "")).toBe(false);
  });
});
