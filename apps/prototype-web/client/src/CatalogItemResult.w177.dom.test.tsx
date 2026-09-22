/** @vitest-environment jsdom */
/* FIN-006 (WS-177 — Wave 5): عرض الفصل الكنوني والاستبعاد الظاهر في «قراءة
 * المراجع» — التقديرية مرئية بقيمها منفصلة، وغير المكتملة عَدّ بلا قيم،
 * والطلبات بلا مرجع قابل للربط مُدرجة بأسبابها؛ لا دمج ولا إخفاء ولا
 * توصيات. المكوّن عرض صرف فوق خصائص جاهزة (لا مخزن ولا خدمات). */
import React from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { CatalogReadingsSection } from "@/components/catalog/CatalogReadingsSection";
import type { CatalogItem } from "@micro-domain/catalog/index.js";
import type { RecurringWorkReadings } from "@/application/finance/recurringWorkService";

const item = (id: string, name: string): CatalogItem =>
  ({
    id,
    kind: "product",
    name,
    unitLabel: "قطعة",
    unitId: null,
    defaultPriceMinor: null,
    defaultUnitCostMinor: null,
    active: true,
    createdAt: "2026-08-01T09:00:00.000Z",
    updatedAt: "2026-08-01T09:00:00.000Z",
    createdOperationKey: `${id}-create`,
  }) as unknown as CatalogItem;

function readings(overrides: Partial<RecurringWorkReadings> = {}): RecurringWorkReadings {
  return {
    from: "2026-08-01",
    to: "2026-08-31",
    items: [
      {
        catalogItemId: "item-a",
        periodFrom: "2026-08-01",
        periodTo: "2026-08-31",
        finalOrderCount: 2,
        deliveredQuantity: 4,
        outputQuantityMilli: 4000,
        recognizedRevenueMinor: 10000,
        recognizedDirectCostMinor: 4000,
        directMarginMinor: 6000,
        directStatus: "recorded",
        estimatedOrderCount: 1,
        estimatedRevenueMinor: 3500,
        estimatedMarginMinor: 1500,
        incompleteOrderCount: 1,
        material: {
          recordedOrderCount: 0,
          notRecordedOrderCount: 2,
          needsReviewOrderCount: 0,
          plannedMaterialMinor: 0,
          actualMaterialMinor: null,
          varianceMinor: null,
        },
        time: {
          recordedOrderCount: 0,
          notRecordedOrderCount: 2,
          needsReviewOrderCount: 0,
          plannedMinutes: 0,
          actualMinutes: null,
          varianceMinutes: null,
        },
        waste: {
          orderWasteMinor: 0,
          catalogItemWasteMinor: 0,
          catalogTemplateWasteMinor: 0,
          generalProjectWasteMinor: 0,
          unallocatedWasteMinor: 0,
          totalWasteMinor: 0,
          recordedCount: 0,
        },
        policies: [],
        allocation: null,
        reasons: [],
        nextAction: "راجع السياسة والدليل",
      },
    ],
    unlinkedDeliveredOrders: [],
    ...overrides,
  } as unknown as RecurringWorkReadings;
}

describe("FIN-006 (WS-177 — Wave 5): CatalogReadingsSection canonical separation display", () => {
  afterEach(() => {
    cleanup();
  });

  it("renders the estimated separation with its recorded values, visibly apart from the final core", () => {
    render(
      <CatalogReadingsSection
        readings={readings()}
        items={[item("item-a", "صندوق قياسي")]}
        units={[]}
        deactivate={vi.fn()}
        navigate={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByText("افتح التفاصيل"));
    /* الرقم الأساسي من النهائي فقط. */
    expect(screen.getByText(/الهامش المباشر المسجل/)).toBeTruthy();
    expect(screen.getByText(/2 طلب نهائي/)).toBeTruthy();
    /* التقديرية منفصلة بقيمها المسجلة — لا تدخل الرقم. */
    expect(screen.getByText(/تقديرية منفصلة: 1 طلبًا/)).toBeTruthy();
    expect(screen.getByText(/هامش تقديري/)).toBeTruthy();
    /* غير المكتملة: عَدّ مرئي بلا قيم. */
    expect(screen.getByText(/1 طلبًا غير مكتمل أو مقفلًا للمراجعة/)).toBeTruthy();
  });

  it("renders the unlinked-delivered exclusion note with historical names — visible, not merged, not hidden", () => {
    render(
      <CatalogReadingsSection
        readings={readings({
          unlinkedDeliveredOrders: [
            { id: "order-legacy", itemName: "صندوق قديم بلا مرجع", resultStatus: "final" },
            { id: "order-dangling", itemName: "طلب مرجعه معلق", resultStatus: "estimated" },
          ],
        })}
        items={[item("item-a", "صندوق قياسي")]}
        units={[]}
        deactivate={vi.fn()}
        navigate={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByText("افتح التفاصيل"));
    expect(screen.getByText(/بلا مرجع قابل للربط \(2\)/)).toBeTruthy();
    expect(screen.getByText(/صندوق قديم بلا مرجع/)).toBeTruthy();
    expect(screen.getByText(/طلب مرجعه معلق/)).toBeTruthy();
    expect(screen.getByText(/مستبعدة من كل الصفوف/)).toBeTruthy();
  });

  it("renders no unlinked note and no separation lines when the period is clean — zero noise", () => {
    render(
      <CatalogReadingsSection
        readings={readings({
          items: [{ ...readings().items[0]!, estimatedOrderCount: 0, incompleteOrderCount: 0 }],
          unlinkedDeliveredOrders: [],
        })}
        items={[item("item-a", "صندوق قياسي")]}
        units={[]}
        deactivate={vi.fn()}
        navigate={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByText("افتح التفاصيل"));
    expect(screen.queryByText(/تقديرية منفصلة/)).toBeNull();
    expect(screen.queryByText(/غير مكتمل أو مقفلًا/)).toBeNull();
    expect(screen.queryByText(/بلا مرجع قابل للربط/)).toBeNull();
  });
});
