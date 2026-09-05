/** @vitest-environment jsdom */

/* المجموعة ٦ (تدقيق A1 — FT-03): أحداث الأصول/القروض/العربونات المحتفظة
 * لا تُصحّح من الطبقة العامة (السجل والأثر) — المسار العام كان يعكس الحدث
 * دون سجل عائلته فيفشل MIC-10/11 بلا طريق إصلاح. الصف يعرض وصلة المالك
 * (صفحة الأصل/القرض/الطلب) والأحداث العامة تبقى بأزرارها الثلاثة. */
import React from "react";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { InventoryMaterialService } from "@/application/inventory/inventoryMaterialService";
import { usePrototypeServices } from "@/app/PrototypeServicesContext";
import { AssetService } from "@/application/assets/assetService";
import { LoanService } from "@/application/loans/loanService";
import { RetainedDepositService } from "@/application/finance/retainedDepositService";
import { G5Service } from "@/application/g5/g5Service";
import { OwnerEntitlementService } from "@/application/finance/ownerEntitlementService";
import { ProjectFinancialService } from "@/application/finance/projectFinancialService";
import { CorrectionHistoryService } from "@/application/finance/correctionHistoryService";
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
const NOW = "2026-09-05T09:00:00.000Z";
let store: MemoryLocalStore;
let projectFinance: ProjectFinancialService;
const contextRef: { current: Record<string, unknown> } = { current: {} };

function FinanceHarness() {
  const [version, setVersion] = React.useState(0);
  contextRef.current = {
    projectFinance,
    correctionHistory: new CorrectionHistoryService(store),
    ownerEntitlement: new OwnerEntitlementService(
      store,
      (from: string, to: string) => projectFinance.readRecordedPeriodResult(from, to),
      () => NOW,
    ),
    g5: new G5Service(store, projectFinance, () => NOW),
    financialPulse: new FinancialPulseService(store),
    fulfillment: new FulfillmentService(store, () => NOW),
    inventory: new InventoryMaterialService(store, () => NOW),
    assets: new AssetService(store, () => NOW),
    loans: new LoanService(store, () => NOW),
    retainedDeposits: new RetainedDepositService(store, () => NOW),
    dataVersion: version,
    notifyDataChanged: () => setVersion(current => current + 1),
  };
  return <Finance />;
}

async function openEventsLayer() {
  render(<FinanceHarness />);
  await waitFor(() => expect(screen.queryByText("جارٍ قراءة الوضع المالي المحلي…")).not.toBeTruthy());
  const summary = Array.from(document.querySelectorAll("summary")).find(node =>
    node.textContent?.includes("السجل والأثر"),
  );
  if (!summary) throw new Error("events layer summary should exist");
  fireEvent.click(summary);
  await waitFor(() => expect(screen.getByText("أحدث الأحداث العامة")).toBeTruthy());
}

beforeEach(() => {
  store = new MemoryLocalStore();
  projectFinance = new ProjectFinancialService(store, () => NOW);
  vi.clearAllMocks();
  mockedUsePrototypeServices.mockImplementation(
    () => contextRef.current as ReturnType<typeof usePrototypeServices>,
  );
});

afterEach(() => {
  cleanup();
});

describe("family-owned events are corrected only through their owner record (FT-03)", () => {
  it("asset events show the owner deep link instead of the general correction actions", async () => {
    const assets = new AssetService(store, () => NOW);
    const created = await assets.create({
      name: "ماكينة خياطة",
      acquisitionAmountMinor: 50000,
      acquisitionKind: "cash",
      purchaseDate: "2026-09-01",
      lifeMonths: 60,
      depreciationStartOn: "2026-09-01",
    });
    if (!created.ok) throw new Error(created.message);
    await projectFinance.record({
      type: "operating_expense_cash",
      amountMinor: 300,
      occurredOn: "2026-09-02",
      note: "مصروف عادي",
      counterparty: "ناقل",
      relatedEventId: null,
      expenseContext: {
        relationship: "project",
        behavior: "variable",
        purpose: "order",
        knowledge: "known",
      },
      idempotencyKey: "ft03-expense",
    });

    await openEventsLayer();

    const rows = Array.from(document.querySelectorAll<HTMLElement>("article.micro-finance-event"));
    const assetRow = rows.find(row => within(row).queryByText("شراء أصل نقدًا") !== null);
    const expenseRow = rows.find(row => within(row).queryByText("مصروف مدفوع") !== null);
    if (!assetRow || !expenseRow) throw new Error("both event rows should render");

    /* حدث الأصل: وصلة المالك بلا أزرار التصحيح العامة. */
    expect(within(assetRow).getByRole("button", { name: "صحّحه من صفحة الأصل" })).toBeTruthy();
    expect(within(assetRow).queryByRole("button", { name: "تراجع موثق" })).toBeNull();
    expect(within(assetRow).queryByRole("button", { name: "عدّل بقيم جديدة" })).toBeNull();
    expect(within(assetRow).queryByRole("button", { name: "حذف موثق" })).toBeNull();

    /* الحدث العام: الأزرار الثلاثة كما هي. */
    expect(within(expenseRow).getByRole("button", { name: "تراجع موثق" })).toBeTruthy();
    expect(within(expenseRow).getByRole("button", { name: "عدّل بقيم جديدة" })).toBeTruthy();
    expect(within(expenseRow).getByRole("button", { name: "حذف موثق" })).toBeTruthy();

    /* الوصلة تقود لصفحة الأصل مع حفظ المصدر (مُرمَّزًا كقيمة استعلام). */
    fireEvent.click(within(assetRow).getByRole("button", { name: "صحّحه من صفحة الأصل" }));
    expect(wouterMocks.navigate).toHaveBeenCalledWith(
      `/assets/${created.value.asset.id}?from=${encodeURIComponent("/finance")}`,
    );
  });

  it("loan events route to the loan page and never expose general corrections", async () => {
    const loans = new LoanService(store, () => NOW);
    const created = await loans.create({
      borrowerName: "سليم",
      principalMinor: 20000,
      loanDate: "2026-09-02",
      purposeNote: "قرض اختبار",
    });
    if (!created.ok) throw new Error(created.message);

    await openEventsLayer();

    const rows = Array.from(document.querySelectorAll<HTMLElement>("article.micro-finance-event"));
    const loanRow = rows.find(row => within(row).queryByText("قرض لشخص") !== null);
    if (!loanRow) throw new Error("loan event row should render");
    expect(within(loanRow).getByRole("button", { name: "صحّحه من صفحة القرض" })).toBeTruthy();
    expect(within(loanRow).queryByRole("button", { name: "تراجع موثق" })).toBeNull();
  });
});
