/** @vitest-environment jsdom */
/* FIN-005 (WS-175 — Wave 3): أفق الكاش القصير على سطح المالية — العائلة
 * المعتمدة ٧/٣٠/٩٠ (الافتراضي ٣٠) مثبتة على اليوم المحلي من ساعة الخدمة
 * القابلة للحقن، والتبديل يعيد القراءة فوق الأفق الجديد بلا أي كتابة
 * (notifyDataChanged لا يُستدعى من القراءة أبدًا — قراءة صرفة فوق المخزن). */
import React from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { usePrototypeServices } from "@/app/PrototypeServicesContext";
import { MemoryLocalStore } from "@/storage/local/MemoryLocalStore";
import { ProjectFinancialService } from "@/application/finance/projectFinancialService";
import { CorrectionHistoryService } from "@/application/finance/correctionHistoryService";
import { OwnerEntitlementService } from "@/application/finance/ownerEntitlementService";
import { G5Service } from "@/application/g5/g5Service";
import { FinancialPulseService } from "@/application/financial-pulse/financialPulseService";
import { FulfillmentService } from "@/application/fulfillment/fulfillmentService";
import { InventoryMaterialService } from "@/application/inventory/inventoryMaterialService";
import { ScheduleService } from "@/application/scheduling/scheduleService";
import { AssetService } from "@/application/assets/assetService";
import { LoanService } from "@/application/loans/loanService";
import { RetainedDepositService } from "@/application/finance/retainedDepositService";
import { ProfitToCashBridgeService } from "@/application/finance/profitToCashBridgeService";
import { CashContinuityService } from "@/application/cash/cashContinuityService";
import { SupplierPurchaseService } from "@/application/suppliers/supplierPurchaseService";
import { AgreementContextService } from "@/application/agreements/agreementContextService";
import { ActivityService } from "@/application/activity/activityService";
import { createSupplierPurchase } from "@micro-domain/supplier-purchase/index.js";
import Finance from "@/pages/Finance";

vi.mock("@/app/PrototypeServicesContext", () => ({
  usePrototypeServices: vi.fn(),
}));

const wouterMocks = vi.hoisted(() => ({
  navigate: vi.fn(),
  location: "/finance",
  params: {} as Record<string, string>,
}));
vi.mock("wouter", () => ({
  useLocation: () => [wouterMocks.location, wouterMocks.navigate],
  useParams: () => wouterMocks.params,
  useSearch: () => "",
}));

const mockedUsePrototypeServices = vi.mocked(usePrototypeServices);
/* 12:00 بتوقيت عمان → اليوم المحلي 2026-09-23؛ الأفقال:
 * 7 = [2026-09-23, 2026-09-29] · 30 = [2026-09-23, 2026-10-22] · 90 = [2026-09-23, 2026-12-21]. */
const NOW = "2026-09-23T09:00:00.000Z";

describe("FIN-005 (WS-175 — Wave 3): short-cash horizon on the Finance cash decision", () => {
  let notifyDataChanged: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    const store = new MemoryLocalStore();
    const now = () => NOW;
    const projectFinance = new ProjectFinancialService(store, now);
    const g5 = new G5Service(store, projectFinance, now);

    /* التزام مؤرخ واحد داخل أفق ٣٠ (2026-10-01) وخارج أفق ٧ — يظهر في
     * الرقم عند أفق ٣٠ ويختفي من الرقم عند أفق ٧ بلا إخفاء للحقيقة. */
    await store.saveSupplierPurchase(
      createSupplierPurchase({
        id: "w175-commitment",
        supplierName: "مورد",
        note: "التزام مؤرخ داخل الثلاثين",
        purchasedOn: "2026-09-01",
        dueOn: "2026-10-01",
        totalMinor: 2500,
        initialPaidMinor: 0,
        recordedAt: NOW,
        idempotencyKey: "w175-commitment",
      }),
    );
    notifyDataChanged = vi.fn();

    mockedUsePrototypeServices.mockReturnValue({
      projectFinance,
      correctionHistory: new CorrectionHistoryService(store),
      ownerEntitlement: new OwnerEntitlementService(
        store,
        (from: string, to: string) => projectFinance.readRecordedPeriodResult(from, to),
        now,
      ),
      g5,
      financialPulse: new FinancialPulseService(store),
      fulfillment: new FulfillmentService(store, now),
      inventory: new InventoryMaterialService(store, now),
      assets: new AssetService(store, now),
      loans: new LoanService(store, now),
      retainedDeposits: new RetainedDepositService(store, now),
      profitToCashBridge: new ProfitToCashBridgeService(store, now),
      dataVersion: 0,
      notifyDataChanged,
    } as unknown as ReturnType<typeof usePrototypeServices>);
  });

  afterEach(() => {
    cleanup();
  });

  it("offers the approved family 7/30/90 with 30 pressed by default over the Amman-local window", async () => {
    render(<Finance />);
    expect(await screen.findByRole("heading", { name: "المالية" })).toBeTruthy();
    await waitFor(() => expect(screen.queryByText("جارٍ قراءة الوضع المالي المحلي…")).not.toBeTruthy());

    const group = screen.getByRole("group", { name: "أفق قراءة الكاش" });
    expect(group).toBeTruthy();
    for (const label of ["٧ أيام", "٣٠ يومًا", "٩٠ يومًا"]) {
      expect(screen.getByRole("button", { name: label })).toBeTruthy();
    }
    /* الافتراضي المعتمد: ٣٠ يومًا مضغوطًا. */
    expect(screen.getByRole("button", { name: "٣٠ يومًا" }).getAttribute("aria-pressed")).toBe("true");
    expect(screen.getByRole("button", { name: "٧ أيام" }).getAttribute("aria-pressed")).toBe("false");
    /* النافذة الظاهرة: 23/09/2026 → 22/10/2026 (اليوم المحلي من الساعة المحقونة). */
    expect(screen.getByText("23/09/2026")).toBeTruthy();
    expect(screen.getByText("22/10/2026")).toBeTruthy();
  });

  it("re-reads over the new horizon when switched — dated evidence moves with the window, honestly", async () => {
    render(<Finance />);
    expect(await screen.findByRole("heading", { name: "المالية" })).toBeTruthy();
    await waitFor(() => expect(screen.queryByText("جارٍ قراءة الوضع المالي المحلي…")).not.toBeTruthy());

    /* أفق ٣٠: الالتزام المؤرخ (2026-10-01) داخل النافذة — «دفع متوقع قريب» 25.00. */
    await waitFor(() => expect(screen.getByText("دفع متوقع قريب")).toBeTruthy());
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "٣٠ يومًا" }).getAttribute("aria-pressed")).toBe("true"),
    );

    /* التبديل إلى ٧ أيام: النافذة تنتهي 29/09 قبل الاستحقاق — الالتزام يخرج
     * من الرقم لكن الحقيقة تبقى: لا إعادة كتابة ولا قيم مختلقة. */
    fireEvent.click(screen.getByRole("button", { name: "٧ أيام" }));
    await waitFor(() => expect(screen.getByText("29/09/2026")).toBeTruthy());
    expect(screen.getByRole("button", { name: "٧ أيام" }).getAttribute("aria-pressed")).toBe("true");

    /* القراءة وحدها لا تكتب: notifyDataChanged لم يُستدعَ من أي قراءة أفق. */
    expect(notifyDataChanged).not.toHaveBeenCalled();
  });

  it("keeps the horizon reading isolated from the page's month range", async () => {
    render(<Finance />);
    expect(await screen.findByRole("heading", { name: "المالية" })).toBeTruthy();
    await waitFor(() => expect(screen.queryByText("جارٍ قراءة الوضع المالي المحلي…")).not.toBeTruthy());

    /* تغيير نطاق أشهر الصفحة (وجهة الفترة) لا يمس نافذة الأفق: الأفق مثبت
     * على اليوم المحلي لا على الشهر المعروض. */
    fireEvent.click(screen.getByText("ملخص الفترة"));
    fireEvent.change(screen.getByLabelText("بداية نطاق نتيجة الفترة"), { target: { value: "2026-01" } });
    fireEvent.change(screen.getByLabelText("نهاية نطاق نتيجة الفترة"), { target: { value: "2026-01" } });
    await waitFor(() => expect(screen.getByText("التغطية والتعادل")).toBeTruthy());
    fireEvent.click(screen.getByText("الوضع الآن"));
    await waitFor(() => expect(screen.getByText("23/09/2026")).toBeTruthy());
    expect(screen.getByText("22/10/2026")).toBeTruthy();
  });
});
