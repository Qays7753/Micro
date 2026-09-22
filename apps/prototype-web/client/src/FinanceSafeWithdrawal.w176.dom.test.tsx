/** @vitest-environment jsdom */
/* FIN-004 (WS-176 — Wave 4): قراءة السحب الآمن الاستشارية على بطاقة قرار
 * الكاش — احتياطي ثابت يُدخله المالك (جلسة) + الأفق نفسه ٧/٣٠/٩٠؛ لا رقم
 * بلا احتياطي ولا توقع مكتمل؛ السالب ظاهر؛ التعطيل بيد المالك؛ لا زر سحب
 * ولا ضمان؛ والقراءة لا تكتب (notifyDataChanged لا يُستدعى أبدًا هنا). */
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
/* 12:00 بتوقيت عمان → اليوم المحلي 2026-09-23؛ أفق 30 = [23/09، 22/10]. */
const NOW = "2026-09-23T09:00:00.000Z";

describe("FIN-004 (WS-176 — Wave 4): advisory safe-withdrawal reading on the cash decision", () => {
  let notifyDataChanged: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    const store = new MemoryLocalStore();
    const now = () => NOW;
    const projectFinance = new ProjectFinancialService(store, now);
    const g5 = new G5Service(store, projectFinance, now);

    /* كاش مسجل (محفظة برصيد افتتاحي) + التزام مؤرخ داخل أفق 30 (خارج أفق 7). */
    const cashContinuity = new CashContinuityService(store, now);
    const opened = await cashContinuity.openWallet({
      name: "محفظة الاختبار",
      kind: "cash_drawer",
      openingMinor: 10000,
      occurredOn: "2026-09-01",
      note: "رصيد افتتاحي للاختبار",
      operationKey: "w176-opening",
    });
    if (!opened.ok) throw new Error(opened.message);
    await store.saveSupplierPurchase(
      createSupplierPurchase({
        id: "w176-commitment",
        supplierName: "مورد",
        note: "التزام مؤرخ",
        purchasedOn: "2026-09-01",
        dueOn: "2026-10-01",
        totalMinor: 2000,
        initialPaidMinor: 0,
        recordedAt: NOW,
        idempotencyKey: "w176-commitment",
      }),
    );
    await store.saveSupplierPurchase(
      createSupplierPurchase({
        id: "w176-commitment-week",
        supplierName: "مورد آخر",
        note: "التزام مؤرخ قريب",
        purchasedOn: "2026-09-01",
        dueOn: "2026-09-25",
        totalMinor: 2000,
        initialPaidMinor: 0,
        recordedAt: NOW,
        idempotencyKey: "w176-commitment-week",
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

  it("shows the advisory reading with no number until the owner enters a reserve — never an invented rule", async () => {
    render(<Finance />);
    expect(await screen.findByText("سحب آمن — قراءة استشارية")).toBeTruthy();
    /* الإخلاء الصادق: لا رقم قبل الاحتياطي، مع سبب النقص الظاهر من المجال. */
    await waitFor(() => expect(screen.getByText("الفائض المتوقع فوق الاحتياطي")).toBeTruthy());
    const surplusCells = screen.getAllByText("غير متاح");
    expect(surplusCells.length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText(/لا يخترع نسبة/)).toBeTruthy();
    /* لا زر سحب إطلاقًا — القراءة الاستشارية ليست أمرًا. */
    expect(screen.queryByText(/اسحب/)).toBeNull();
    expect(screen.getByText(/لا تنفّذ سحبًا ولا تضمن سيولة/)).toBeTruthy();
  });

  it("derives headroom = projected cash − reserve once a valid reserve is entered, without any write", async () => {
    render(<Finance />);
    expect(await screen.findByText("احتياطي ثابت")).toBeTruthy();
    await waitFor(() => expect(screen.getByText("الكاش المتوقع")).toBeTruthy());
    /* التوقع فوق أفق 30: 10000 − 4000 (التزامان مؤرخان) = 6000؛ باحتياطي 3000 → فائض 3000. */
    const reserveField = screen.getByLabelText(/احتياطي ثابت/);
    fireEvent.change(reserveField, { target: { value: "30.00" } });
    await waitFor(() => expect(screen.getByText("30.00")).toBeTruthy());
    /* القراءة وحدها لا تكتب أبدًا — لا notifyDataChanged من أي قراءة. */
    expect(notifyDataChanged).not.toHaveBeenCalled();
  });

  it("moves honestly with the horizon: the dated commitment leaves the number on the 7-day horizon", async () => {
    render(<Finance />);
    expect(await screen.findByText("احتياطي ثابت")).toBeTruthy();
    const reserveField = screen.getByLabelText(/احتياطي ثابت/);
    fireEvent.change(reserveField, { target: { value: "30.00" } });
    /* أفق 30: الالتزامان المؤرخان داخل النافذة → الفائض 3000 (30.00). */
    await waitFor(() => expect(screen.getByText("30.00")).toBeTruthy());
    /* أفق 7: التزام الأسبوع وحده داخل النافذة والتزام 2026-10-01 خارجها →
     * التوقع 8000 → الفائض 5000 (50.00) — الحركة مع الأفق صادقة لا ثابتة. */
    fireEvent.click(screen.getByRole("button", { name: "٧ أيام" }));
    await waitFor(() => expect(screen.getByText("50.00")).toBeTruthy());
  });

  it("respects the owner's explicit disable — no number, honest reason, no coercion", async () => {
    render(<Finance />);
    expect(await screen.findByText("عطّل القراءة")).toBeTruthy();
    fireEvent.click(screen.getByText("عطّل القراءة"));
    await waitFor(() => expect(screen.getByText(/عطّلتَ قراءة السحب الآمن/)).toBeTruthy());
    await waitFor(() => expect(screen.getByText("فعّل القراءة")).toBeTruthy());
    expect(notifyDataChanged).not.toHaveBeenCalled();
  });

  it("separates the advisory from profit and discloses outstanding loans as context only", async () => {
    render(<Finance />);
    expect(await screen.findByText("سحب آمن — قراءة استشارية")).toBeTruthy();
    /* الفصل الصادق عن الربح — سطر إخلاء ظاهر دائمًا. */
    expect(screen.getByText(/الربح ليس كاشًا/)).toBeTruthy();
    /* القروض الصادرة القائمة = 0 في هذا العالم → الشرطة الصادقة لا 0.00 مؤكدة. */
    await waitFor(() => expect(screen.getByText("قروض صادرة قائمة")).toBeTruthy());
  });
});
