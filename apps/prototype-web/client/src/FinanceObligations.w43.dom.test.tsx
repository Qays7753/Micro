/** @vitest-environment jsdom */
/* Wave 4.3 — P-4.3-3 (F09/D8/D9): المالية — «شو عليّ؟» والبطاقات القابلة
 * للفتح وسلامة الحسابات المقروءة.
 * ---------------------------------------------------------------------------
 * ١) سطح «شو عليّ؟» الموحد: الرقم المجمع من قراءة المركز الرسمية، مفسرًا
 *    بمصدرَيه (مبالغ للموردين + مصاريف مستحقة) مع السطر المساعد المعتمد،
 *    ولكل نوع مسار تسديده بالكاتب الرسمي القائم — لا Writer جديد.
 * ٢) الحالات الصادقة: غير مسجل طريق؛ صفر موثق نص صريح لا أصفار مضللة.
 * ٣) بطاقات المركز تفتح مصادرها (الكاش → المحافظ، الذمم → دفتر الناس).
 * ٤) سلامة الحسابات: السجلات المتأثرة تُعرض بأسماء عملياتها وتواريخها
 *    ومبالغها وروابطها — لا معرّفات تقنية خام حيث يمكن الاسم.
 */
import React from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { usePrototypeServices } from "@/app/PrototypeServicesContext";
import { UnsavedChangesProvider } from "@/components/forms/UnsavedChangesGuard";
import { MemoryLocalStore } from "@/storage/local/MemoryLocalStore";
import { ProjectFinancialService } from "@/application/finance/projectFinancialService";
import { CashContinuityService } from "@/application/cash/cashContinuityService";
import { InventoryMaterialService } from "@/application/inventory/inventoryMaterialService";
import { SupplierPurchaseService } from "@/application/suppliers/supplierPurchaseService";
import { AgreementContextService } from "@/application/agreements/agreementContextService";
import { ActivityService } from "@/application/activity/activityService";
import { CorrectionHistoryService } from "@/application/finance/correctionHistoryService";
import { OwnerEntitlementService } from "@/application/finance/ownerEntitlementService";
import { G5Service } from "@/application/g5/g5Service";
import { FinancialPulseService } from "@/application/financial-pulse/financialPulseService";
import { FulfillmentService } from "@/application/fulfillment/fulfillmentService";
import { ScheduleService } from "@/application/scheduling/scheduleService";
import { AssetService } from "@/application/assets/assetService";
import { LoanService } from "@/application/loans/loanService";
import { RetainedDepositService } from "@/application/finance/retainedDepositService";
import { ProfileService } from "@/application/profile/profileService";
import { SupplierPurchaseService as SupplierPurchases } from "@/application/suppliers/supplierPurchaseService";
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
const NOW = "2026-09-16T09:00:00.000Z";

let store: MemoryLocalStore;
let projectFinance: ProjectFinancialService;
let dataVersion = 0;

function buildServices() {
  const schedules = new ScheduleService(store, () => NOW);
  const cashContinuity = new CashContinuityService(store, () => NOW);
  projectFinance = new ProjectFinancialService(store, () => NOW);
  return {
    projectFinance,
    correctionHistory: new CorrectionHistoryService(store),
    ownerEntitlement: new OwnerEntitlementService(
      store,
      (from, to) => projectFinance.readRecordedPeriodResult(from, to),
      () => NOW,
    ),
    g5: new G5Service(store, projectFinance, () => NOW),
    financialPulse: new FinancialPulseService(store),
    fulfillment: new FulfillmentService(store, () => NOW, schedules),
    inventory: new InventoryMaterialService(store, () => NOW),
    assets: new AssetService(store, () => NOW),
    loans: new LoanService(store, () => NOW),
    retainedDeposits: new RetainedDepositService(store, () => NOW),
    cashContinuity,
    dataVersion,
    notifyDataChanged: () => {
      dataVersion += 1;
    },
  } as unknown as ReturnType<typeof usePrototypeServices>;
}

beforeEach(() => {
  store = new MemoryLocalStore();
  dataVersion = 0;
  wouterMocks.navigate.mockReset();
  mockedUsePrototypeServices.mockReturnValue(buildServices());
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

async function seedProfile() {
  const result = await new ProfileService(store, () => NOW).save("مشغل شو عليّ");
  if (!result.ok) throw new Error(result.message);
}

async function seedObligations() {
  /* شراء مواد بدين للمورد — مصدر «مبالغ للموردين». */
  const purchase = await new SupplierPurchases(store, () => NOW).recordPurchase({
    supplierName: "مورد الأقمشة",
    note: "قماش تغليف",
    purchasedOn: "2026-09-10",
    dueOn: null,
    totalMinor: 40000,
    initialPaidMinor: 10000,
    idempotencyKey: "w43-purchase",
  });
  if (!purchase.ok) throw new Error(purchase.message);
  /* مصروف مستحق (التزام غير مسدد) — مصدر «مصاريف مستحقة». */
  const expense = await projectFinance.record({
    type: "operating_expense_payable",
    amountMinor: 15000,
    occurredOn: "2026-09-12",
    note: "فاتورة كهرباء",
    counterparty: "شركة الكهرباء",
    relatedEventId: null,
    expenseContext: {
      relationship: "project",
      behavior: "fixed",
      purpose: "project_general",
      knowledge: "known",
      sharedProjectShare: null,
      categoryLabel: "كهرباء",
    },
    idempotencyKey: "w43-payable-expense",
  });
  if (!expense.ok) throw new Error(expense.message);
}

function renderFinance() {
  render(
    <UnsavedChangesProvider navigate={wouterMocks.navigate}>
      <Finance />
    </UnsavedChangesProvider>,
  );
}

describe("Wave 4.3 — P-4.3-3: Finance obligations surface (شو عليّ؟)", () => {
  it("explains the aggregated number by its two official sources with a settle path each (F09)", async () => {
    await seedProfile();
    await seedObligations();
    renderFinance();
    const card = await screen.findByTestId("finance-obligations");
    /* الاسم الرسمي + السطر المساعد المعتمد + المجموع بمصدرَيه. */
    expect(card.textContent).toContain("شو عليّ؟");
    expect(card.textContent).toContain("مبالغ للموردين ومصاريف مستحقة");
    expect(card.textContent).toContain("الإجمالي المستحق");
    expect(card.textContent).toContain("مبالغ للموردين");
    expect(card.textContent).toContain("مصاريف مستحقة");
    /* مسارا التسديد بالكاتب الرسمي القائم — لا Writer جديد. */
    const suppliersAction = screen.getByRole("button", { name: "سجّل تسديد شراء" });
    const expenseAction = screen.getByRole("button", { name: "سجّل تسديد التزام" });
    fireEvent.click(suppliersAction);
    expect(wouterMocks.navigate).toHaveBeenCalledWith("/suppliers?returnTo=%2Ffinance");
    fireEvent.click(expenseAction);
    expect(wouterMocks.navigate).toHaveBeenCalledWith(
      "/finance/new/payable_settlement_cash?returnTo=%2Ffinance",
    );
  });

  it("unrecorded obligations stay an honest road, never confirmed zeros", async () => {
    await seedProfile();
    renderFinance();
    const card = await screen.findByTestId("finance-obligations");
    expect(card.textContent).toContain("غير مسجل");
    expect(card.textContent).toContain("سجّل أول التزام");
    expect(card.textContent).not.toContain("الإجمالي المستحق");
  });

  it("recorded zero obligations show one honest line, not fake zeros", async () => {
    await seedProfile();
    /* شراء مسدد بالكامل يسجل دليل الالتزامات بصفر متبقٍ موثق — لا صفر مضلل. */
    const purchase = await new SupplierPurchases(store, () => NOW).recordPurchase({
      supplierName: "مورد الأدوات",
      note: "أدوات صغيرة",
      purchasedOn: "2026-09-10",
      dueOn: null,
      totalMinor: 8000,
      initialPaidMinor: 8000,
      idempotencyKey: "w43-paid-purchase",
    });
    if (!purchase.ok) throw new Error(purchase.message);
    renderFinance();
    const card = await screen.findByTestId("finance-obligations");
    await waitFor(() => expect(card.textContent).toContain("لا التزامات مستحقة مسجلة الآن"));
  });

  it("position cards open their sources (D8) — cash to wallets, receivables to parties", async () => {
    await seedProfile();
    await seedObligations();
    renderFinance();
    await screen.findByTestId("finance-obligations");
    fireEvent.click(screen.getByRole("button", { name: "افتح محافظ الكاش" }));
    expect(wouterMocks.navigate).toHaveBeenCalledWith("/cash?returnTo=%2Ffinance");
    fireEvent.click(screen.getByRole("button", { name: "افتح دفتر الناس" }));
    expect(wouterMocks.navigate).toHaveBeenCalledWith("/parties?returnTo=%2Ffinance");
  });

  it("reads the order back from the model: readings and no financial writes", async () => {
    await seedProfile();
    await seedObligations();
    const before = await store.readSnapshot();
    renderFinance();
    await screen.findByTestId("finance-obligations");
    const after = await store.readSnapshot();
    /* السطح قراءة خالصة — لا كتابة مالية من المالية. */
    expect(after).toEqual(before);
  });
});
