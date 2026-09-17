/** @vitest-environment jsdom */

/* FIN-001 (قرار المالك المعتمد ٢٠٢٦-٠٩-١٦): مشروع فارغ لا يعرض في «مالي»
 * أصفارًا مؤكدة — بطاقات المركز وقرار الكاش ونبضة المراجعة تعرض «غير مسجل»،
 * والصفر الموثق فوق سجلات حقيقية يبقى 0.00. الرحلة عبر الحدود الحقيقية
 * (تفاعل ← خدمة ← مخزن الذاكرة) كما في رحلات المجموعة ١١. */
import React from "react";
import { cleanup, render, screen } from "@testing-library/react";
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
  const inventory = new InventoryMaterialService(store, () => NOW);
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
    inventory,
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
  mockedUsePrototypeServices.mockReturnValue(buildServices());
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

async function seedProfile() {
  const result = await new ProfileService(store, () => NOW).save("مشغل اختبار FIN-001");
  if (!result.ok) throw new Error(result.message);
}

function renderFinance() {
  return render(
    <UnsavedChangesProvider navigate={wouterMocks.navigate}>
      <Finance />
    </UnsavedChangesProvider>,
  );
}

describe("Finance empty-evidence truth (FIN-001)", () => {
  it("renders غير مسجل instead of invented 0.00 for a brand-new empty project", async () => {
    await seedProfile();
    renderFinance();
    expect(await screen.findByRole("heading", { level: 1, name: "المالية" })).toBeTruthy();
    /* بطاقات المركز الأربع: الكاش والذمم ومال المالك غير مسجلة. */
    const unknowns = screen.getAllByText("غير مسجل");
    expect(unknowns.length).toBeGreaterThanOrEqual(4);
    /* لا 0.00 مؤكد في أي بطاقة مركز ولا في مقاييس قرار الكاش. */
    const position = screen.getByRole("heading", { level: 1, name: "المالية" }).closest("section");
    expect(position).toBeTruthy();
    const positionCards = screen.getAllByText("الكاش المسجل");
    expect(positionCards.length).toBeGreaterThan(0);
    for (const card of positionCards) {
      const article = card.closest("article,button");
      expect(article).toBeTruthy();
      expect(article!.querySelector(".micro-unknown-value")).toBeTruthy();
      expect(article!.textContent).not.toContain("0.00");
    }
    /* نبضة المراجعة: القيم الأربع غير مسجلة. */
    expect(screen.getAllByText("قبض مسجل من الطلبات").length).toBeGreaterThan(0);
    const pulseValue = screen.getByText("قبض مسجل من الطلبات").closest("div");
    expect(pulseValue?.querySelector(".micro-unknown-value")).toBeTruthy();
  });

  it("shows the confirmed 0.00 for a calculated zero over real records", async () => {
    await seedProfile();
    const invested = await projectFinance.record({
      type: "owner_investment_cash",
      amountMinor: 5000,
      occurredOn: "2026-09-16",
      note: "استثمار",
      counterparty: null,
      relatedEventId: null,
      idempotencyKey: "fin001-dom-invest",
    });
    if (!invested.ok) throw new Error(invested.message);
    const spent = await projectFinance.record({
      type: "operating_expense_cash",
      amountMinor: 5000,
      occurredOn: "2026-09-16",
      note: "مصروف بكامل الاستثمار",
      counterparty: null,
      relatedEventId: null,
      expenseContext: {
        relationship: "project",
        behavior: "unknown",
        purpose: "project_general",
        knowledge: "known",
        sharedProjectShare: null,
        categoryLabel: null,
      },
      idempotencyKey: "fin001-dom-spend",
    });
    if (!spent.ok) throw new Error(spent.message);
    renderFinance();
    expect(await screen.findByRole("heading", { level: 1, name: "المالية" })).toBeTruthy();
    /* صفر موثق: الكاش المسجل 0.00 (سجلان حقيقيان خلفه) لا «غير مسجل». */
    const cashCards = screen.getAllByText("الكاش المسجل");
    for (const card of cashCards) {
      const article = card.closest("article,button");
      expect(article).toBeTruthy();
      expect(article!.querySelector(".micro-unknown-value")).toBeNull();
      expect(article!.textContent).toContain("0.00");
    }
  });
});
