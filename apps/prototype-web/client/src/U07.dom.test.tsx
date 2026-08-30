/** @vitest-environment jsdom */

/* و٧: F-077 طبقة «المؤشرات» داخل قراءة الفترة، وF-079 سجل المتوقعات المسجلة
 * داخل التغطية والتعادل — القيم المسجلة تصل الواجهة من خدماتها. */
import React from "react";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { usePrototypeServices } from "@/app/PrototypeServicesContext";
import { G5Service } from "@/application/g5/g5Service";
import { OwnerEntitlementService } from "@/application/finance/ownerEntitlementService";
import { ProjectFinancialService } from "@/application/finance/projectFinancialService";
import { FinancialPulseService } from "@/application/financial-pulse/financialPulseService";
import { FulfillmentService } from "@/application/fulfillment/fulfillmentService";
import { MemoryLocalStore } from "@/storage/local/MemoryLocalStore";
import Finance from "@/pages/Finance";
import { calculateCostSnapshot, createCraftOrder, transitionOrder } from "@micro-domain/craft-order/index.js";

vi.mock("@/app/PrototypeServicesContext", () => ({
  usePrototypeServices: vi.fn(),
}));

const wouterMocks = vi.hoisted(() => ({ navigate: vi.fn() }));

vi.mock("wouter", () => ({
  useLocation: () => ["/finance", wouterMocks.navigate],
  useParams: () => ({}),
}));

const mockedUsePrototypeServices = vi.mocked(usePrototypeServices);

const NOW = "2026-08-29T09:00:00.000Z";

function deliveredFinalOrder(id: string, itemName: string) {
  const cost = calculateCostSnapshot(`${id}-cost`, {
    currency: "JOD",
    materialItems: [
      {
        name: "خشب",
        quantity: 1,
        unit: "قطعة",
        unitPriceMinor: 1000,
        priceDate: "2026-08-01",
        source: "user_input",
        confidence: "known",
      },
    ],
    time: { minutes: 60, hourlyRateMinor: 500, confidence: "known" },
    packagingMinor: 100,
    deliveryMinor: 0,
    wasteMinor: 0,
    safetyBufferMinor: 0,
    quantity: 1,
    createdAt: "2026-08-01T09:00:00.000Z",
    source: "draft",
    freshnessDays: null,
  });
  let order = createCraftOrder({
    id,
    customerName: "عميلة",
    itemName,
    specifications: "اختبار المؤشرات",
    quantity: 1,
    agreedPriceMinor: 3000,
    costSnapshot: cost,
    createdAt: "2026-08-01T09:00:00.000Z",
  });
  for (const [to, stamp] of [
    ["provisional_agreement", "2026-08-01T10:00:00.000Z"],
    ["confirmed", "2026-08-01T11:00:00.000Z"],
    ["in_progress", "2026-08-02T09:00:00.000Z"],
    ["ready", "2026-08-03T09:00:00.000Z"],
    ["delivered", "2026-08-05T09:00:00.000Z"],
  ] as const)
    order = transitionOrder(order, { to, idempotencyKey: `${id}-${to}`, createdAt: stamp });
  return order;
}

describe("Finance indicators layer and registered expectations record (و٧, F-077/F-079)", () => {
  beforeEach(async () => {
    const store = new MemoryLocalStore();
    const now = () => NOW;
    const projectFinance = new ProjectFinancialService(store, now);
    const g5 = new G5Service(store, projectFinance, now);

    const order = deliveredFinalOrder("insights-order-1", "قطعة خشب");
    await store.saveOrder({
      id: order.id,
      order,
      catalogItemId: null,
      deliveryDate: "2026-08-05",
      agreementSource: "test",
      createdAt: "2026-08-01T09:00:00.000Z",
      updatedAt: "2026-08-05T09:00:00.000Z",
    });
    const declared = await g5.createDeclaration({
      direction: "collection",
      amountMinor: 1500,
      dueOn: "2026-09-01",
      source: "توقع مالك",
      knowledge: "known",
      note: "تحصيل متوقع",
      relatedOrderId: null,
      relatedEventId: null,
      idempotencyKey: "u07-declaration-1",
    });
    if (!declared.ok) throw new Error(declared.message);

    mockedUsePrototypeServices.mockReturnValue({
      projectFinance,
      ownerEntitlement: new OwnerEntitlementService(
        store,
        (from, to) => projectFinance.readRecordedPeriodResult(from, to),
        now,
      ),
      g5,
      financialPulse: new FinancialPulseService(store),
      fulfillment: new FulfillmentService(store, now),
      dataVersion: 0,
      notifyDataChanged: vi.fn(),
    } as unknown as ReturnType<typeof usePrototypeServices>);
  });

  afterEach(() => {
    cleanup();
  });

  it("reveals the indicators layer inside the period reading with margins, cost, coverage, and liquidity", async () => {
    render(<Finance />);
    expect(await screen.findByRole("heading", { name: "مالي" })).toBeTruthy();
    await waitFor(() =>
      expect(screen.queryByText("جارٍ قراءة الوضع المالي المحلي…")).not.toBeTruthy(),
    );

    /* F-077: طبقة المؤشرات داخل قراءة الفترة. */
    expect(screen.getByText("المؤشرات")).toBeTruthy();
    expect(screen.getByText("هامش أسماء الأعمال")).toBeTruthy();
    expect(screen.getByText("قطعة خشب")).toBeTruthy();
    expect(screen.getByText("تكوين التكلفة المباشرة")).toBeTruthy();
    expect(screen.getByText("التغطية والتعادل المسجلان")).toBeTruthy();
    expect(screen.getByText("وحدات التعادل")).toBeTruthy();
    expect(screen.getByText("السيولة المسجلة")).toBeTruthy();
    expect(screen.getAllByText("الكاش المسجل").length).toBeGreaterThan(1);
  });

  it("reveals the full registered expectations record under coverage and break-even, including reversals", async () => {
    render(<Finance />);
    expect(await screen.findByRole("heading", { name: "مالي" })).toBeTruthy();
    await waitFor(() =>
      expect(screen.queryByText("جارٍ قراءة الوضع المالي المحلي…")).not.toBeTruthy(),
    );

    /* F-079: سجل المتوقعات المسجلة داخل التغطية والتعادل. */
    expect(screen.getByText("سجل المتوقعات المسجلة")).toBeTruthy();
    expect(screen.getByLabelText("سجل المتوقعات المسجلة")).toBeTruthy();
    expect(screen.getAllByText("ساري").length).toBeGreaterThanOrEqual(1);
  });

  it("shows the unknown mark for break-even when coverage is not recordable", async () => {
    render(<Finance />);
    expect(await screen.findByRole("heading", { name: "مالي" })).toBeTruthy();
    await waitFor(() =>
      expect(screen.queryByText("جارٍ قراءة الوضع المالي المحلي…")).not.toBeTruthy(),
    );
    /* بلا مصروف ثابت مسجل لا تُخترع وحدة تعادل — العلامة — لا جملة. */
    const breakEvenCell = screen.getByText("وحدات التعادل").closest("div");
    expect(breakEvenCell?.querySelector(".micro-insights-unknown")?.textContent).toBe("—");
  });
});
