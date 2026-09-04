/** @vitest-environment jsdom */

import React from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { InventoryMaterialService } from "@/application/inventory/inventoryMaterialService";
import { usePrototypeServices } from "@/app/PrototypeServicesContext";
import { CorrectionHistoryService } from "@/application/finance/correctionHistoryService";
import { G5Service } from "@/application/g5/g5Service";
import { OwnerEntitlementService } from "@/application/finance/ownerEntitlementService";
import { ProjectFinancialService } from "@/application/finance/projectFinancialService";
import { FinancialPulseService } from "@/application/financial-pulse/financialPulseService";
import { FulfillmentService } from "@/application/fulfillment/fulfillmentService";
import { MemoryLocalStore } from "@/storage/local/MemoryLocalStore";
import Finance from "@/pages/Finance";

vi.mock("@/app/PrototypeServicesContext", () => ({
  usePrototypeServices: vi.fn(),
}));

const wouterMocks = vi.hoisted(() => ({ navigate: vi.fn() }));

vi.mock("wouter", () => ({
  useLocation: () => ["/finance", wouterMocks.navigate],
  useParams: () => ({}),
  useSearch: () => "",
}));

const mockedUsePrototypeServices = vi.mocked(usePrototypeServices);

describe("Finance month-range validation stays inline (U-05)", () => {
  beforeEach(() => {
    const store = new MemoryLocalStore();
    const now = () => "2026-08-29T09:00:00.000Z";
    const projectFinance = new ProjectFinancialService(store, now);
    mockedUsePrototypeServices.mockReturnValue({
      projectFinance,
      ownerEntitlement: new OwnerEntitlementService(
        store,
        (from, to) => projectFinance.readRecordedPeriodResult(from, to),
        now,
      ),
      /* المجموعة ٦ (البند ٣): خلاصة أثر التصحيحات تُقرأ داخل تأثير التحميل. */
      correctionHistory: new CorrectionHistoryService(store),
      g5: new G5Service(store, projectFinance, now),
      financialPulse: new FinancialPulseService(store),
      fulfillment: new FulfillmentService(store, now),
      /* المجموعة ٢ (عقد ٢٨): خدمة المخزون الحقيقية فوق مخزن الذاكرة. */
      inventory: new InventoryMaterialService(store, now),
      dataVersion: 0,
      notifyDataChanged: vi.fn(),
    } as unknown as ReturnType<typeof usePrototypeServices>);
  });

  afterEach(() => {
    cleanup();
  });

  it("shows a scoped message for an inverted range while the last valid reading stays rendered", async () => {
    render(<Finance />);
    expect(await screen.findByRole("heading", { name: "مالي" })).toBeTruthy();
    await waitFor(() =>
      expect(screen.queryByText("جارٍ قراءة الوضع المالي المحلي…")).not.toBeTruthy(),
    );
    /* المجموعة ٢ (§8): قراءة الفترة صارت وجهة «الفترة» — تُفتح من مبدّل القراءة. */
    fireEvent.click(screen.getByText("شو صار خلال الفترة"));
    // The ready reading is on screen: the period section with its heading.
    expect(await screen.findByRole("heading", { name: "نتيجة الفترة المسجلة" })).toBeTruthy();

    const fromInput = screen.getByLabelText("بداية نطاق نتيجة الفترة");
    const toInput = screen.getByLabelText("نهاية نطاق نتيجة الفترة");
    // Invert the range: start month after the end month.
    fireEvent.change(fromInput, { target: { value: "2026-12" } });
    fireEvent.change(toInput, { target: { value: "2026-01" } });

    await waitFor(() =>
      expect(screen.getByText("اختر نطاقًا يبدأ قبل نهايته؛ القراءة أدناه تبقى على آخر نطاق صحيح.")).toBeTruthy(),
    );
    // The whole screen did NOT collapse to the page-level error.
    expect(screen.queryByRole("heading", { name: "تعذر قراءة الوضع المالي" })).not.toBeTruthy();
    expect(screen.getByRole("heading", { name: "نتيجة الفترة المسجلة" })).toBeTruthy();
    // The fields keep their values — recovery is changing one month back.
    expect((fromInput as HTMLInputElement).value).toBe("2026-12");
    expect((toInput as HTMLInputElement).value).toBe("2026-01");

    // Recovery: fix the range, the inline message disappears and the reading reloads.
    fireEvent.change(toInput, { target: { value: "2026-12" } });
    await waitFor(() =>
      expect(
        screen.queryByText("اختر نطاقًا يبدأ قبل نهايته؛ القراءة أدناه تبقى على آخر نطاق صحيح."),
      ).not.toBeTruthy(),
    );
    expect(screen.getByRole("heading", { name: "نتيجة الفترة المسجلة" })).toBeTruthy();
  });
});
