/** @vitest-environment jsdom */
/* المجموعة ١ — قراءات الأسطح: باب «فحص سلامة مالي» في مالي، ووسم التصنيف في
 * صف السجل، وتجميع «مصاريفي حسب تصنيفي» في الكشف (مستوى الخدمة). */
import React from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { usePrototypeServices } from "@/app/PrototypeServicesContext";
import { G5Service } from "@/application/g5/g5Service";
import { OwnerEntitlementService } from "@/application/finance/ownerEntitlementService";
import { ProjectFinancialService } from "@/application/finance/projectFinancialService";
import { CorrectionHistoryService } from "@/application/finance/correctionHistoryService";
import { FinancialPulseService } from "@/application/financial-pulse/financialPulseService";
import { FulfillmentService } from "@/application/fulfillment/fulfillmentService";
import { StatementService } from "@/application/finance/statementService";
import { EventsLayer } from "@/components/finance/EventsLayer";
import { MemoryLocalStore } from "@/storage/local/MemoryLocalStore";
import Finance from "@/pages/Finance";
import type { FinancialEvent } from "@micro-domain/financial-event/index.js";

vi.mock("@/app/PrototypeServicesContext", () => ({
  usePrototypeServices: vi.fn(),
}));

const wouterMocks = vi.hoisted(() => ({ navigate: vi.fn(), search: "" }));

vi.mock("wouter", () => ({
  useLocation: () => ["/finance", wouterMocks.navigate],
  useParams: () => ({}),
  useSearch: () => wouterMocks.search,
}));

const mockedUsePrototypeServices = vi.mocked(usePrototypeServices);
const NOW = "2026-09-03T09:00:00.000Z";

const labeledEvent: FinancialEvent = {
  id: "labeled-1",
  type: "operating_expense_cash",
  currency: "JOD",
  amountMinor: 2500,
  occurredOn: "2026-09-02",
  recordedAt: "2026-09-02T09:00:00.000Z",
  idempotencyKey: "labeled-1",
  note: "بنزين السيارة",
  counterparty: null,
  relatedEventId: null,
  expenseContext: {
    relationship: "project",
    behavior: "variable",
    purpose: "project_general",
    knowledge: "known",
    sharedProjectShare: null,
    categoryLabel: "بنزين",
  },
  correctionType: null,
  correctionOfEventId: null,
  correctionReason: null,
  cashDeltaMinor: -2500,
  payableDeltaMinor: 0,
  ownerCapitalDeltaMinor: 0,
  operatingExpenseDeltaMinor: 2500,
};

const legacyEvent: FinancialEvent = {
  ...labeledEvent,
  id: "legacy-1",
  idempotencyKey: "legacy-1",
  note: "مصروف قديم",
  expenseContext: null,
};

describe("Finance doorway to the integrity surface (المجموعة ١)", () => {
  beforeEach(() => {
    wouterMocks.navigate.mockClear();
    vi.clearAllMocks();
  });
  afterEach(() => cleanup());

  it("shows the integrity text-action in the truth section and keeps ?from", async () => {
    const store = new MemoryLocalStore();
    const projectFinance = new ProjectFinancialService(store, () => NOW);
    const contextRef: { current: Record<string, unknown> } = { current: {} };
    mockedUsePrototypeServices.mockImplementation(
      () => contextRef.current as unknown as ReturnType<typeof usePrototypeServices>,
    );
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
        dataVersion: version,
        notifyDataChanged: () => setVersion(current => current + 1),
      };
      return <Finance />;
    }
    render(<FinanceHarness />);
    await waitFor(() =>
      expect(screen.queryByText("جارٍ قراءة الوضع المالي المحلي…")).not.toBeTruthy(),
    );
    const doorway = await screen.findByText(/فحص سلامة مالي — اطمن على أرقامك/);
    fireEvent.click(doorway);
    expect(wouterMocks.navigate).toHaveBeenCalledWith(
      expect.stringMatching(/\/tools\/integrity\?from=%2Ffinance|\/tools\/integrity\?from=\/finance/),
    );
  });
});

describe("EventsLayer shows the owner's category label (المجموعة ١)", () => {
  afterEach(() => cleanup());

  it("renders تصنيفك with the label inside the expanded event detail", () => {
    const projectFinance = {} as ProjectFinancialService;
    render(
      <EventsLayer
        visibleEvents={[labeledEvent]}
        events={[labeledEvent]}
        projectFinance={projectFinance}
        onChanged={() => undefined}
        openOnLoad
      />,
    );
    const row = screen.getByText("مصروف مدفوع");
    fireEvent.click(row.closest("article")?.querySelector(".micro-finance-event-toggle") as HTMLElement);
    expect(screen.getByText(/تصنيفك: بنزين/)).toBeTruthy();
  });

  it("legacy events keep their honest unclassified wording", () => {
    const projectFinance = {} as ProjectFinancialService;
    render(
      <EventsLayer
        visibleEvents={[legacyEvent]}
        events={[legacyEvent]}
        projectFinance={projectFinance}
        onChanged={() => undefined}
        openOnLoad
      />,
    );
    const row = screen.getByText("مصروف مدفوع");
    fireEvent.click(row.closest("article")?.querySelector(".micro-finance-event-toggle") as HTMLElement);
    expect(screen.getByText("مصروف قديم غير مصنف")).toBeTruthy();
  });
});

describe("Statement categories grouping (مصاريفي حسب تصنيفي)", () => {
  it("groups in-period expenses by label with an honest unclassified bucket", async () => {
    const store = new MemoryLocalStore();
    const finance = new ProjectFinancialService(store, () => NOW);
    const statement = new StatementService(store, finance);
    await finance.record({
      type: "operating_expense_cash",
      amountMinor: 2500,
      occurredOn: "2026-09-02",
      note: "بنزين ١",
      counterparty: null,
      relatedEventId: null,
      expenseContext: {
        relationship: "project",
        behavior: "variable",
        purpose: "project_general",
        knowledge: "known",
        sharedProjectShare: null,
        categoryLabel: "بنزين",
      },
      idempotencyKey: "group-benzene-1",
    });
    await finance.record({
      type: "operating_expense_cash",
      amountMinor: 1500,
      occurredOn: "2026-09-02",
      note: "بنزين ٢",
      counterparty: null,
      relatedEventId: null,
      expenseContext: {
        relationship: "project",
        behavior: "variable",
        purpose: "project_general",
        knowledge: "known",
        sharedProjectShare: null,
        categoryLabel: "  بنزين ",
      },
      idempotencyKey: "group-benzene-2",
    });
    await finance.record({
      type: "operating_expense_payable",
      amountMinor: 4000,
      occurredOn: "2026-09-02",
      note: "فاتورة كهرباء مستحقة",
      counterparty: "شركة الكهرباء",
      relatedEventId: null,
      expenseContext: {
        relationship: "project",
        behavior: "mixed",
        purpose: "project_general",
        knowledge: "known",
        sharedProjectShare: null,
        categoryLabel: "كهرباء",
      },
      idempotencyKey: "group-power",
    });
    await finance.record({
      type: "loss_non_cash",
      amountMinor: 700,
      occurredOn: "2026-09-02",
      note: "هالك",
      counterparty: null,
      relatedEventId: null,
      idempotencyKey: "group-loss",
    });
    const reading = await statement.read("2026-09-01", "2026-09-30");
    if (!reading.ok) throw new Error(reading.message);
    const groups = reading.value.expenseCategories;
    const benzene = groups.find(group => group.label === "بنزين");
    expect(benzene?.totalMinor).toBe(4000);
    expect(benzene?.lines.length).toBe(2);
    const power = groups.find(group => group.label === "كهرباء");
    expect(power?.totalMinor).toBe(4000);
    expect(power?.lines[0]?.kind).toBe("payable");
    /* الهالك ليس مصروفًا تشغيليًا بسياق — لا يدخل التجميع أصلًا. */
    expect(groups.length).toBe(2);
    /* الإيراد الكلي مشتق في الخدمة (لا حساب صفحة). */
    expect(reading.value.recognizedRevenueTotalMinor).toBe(
      reading.value.result.recognizedRevenueMinor + reading.value.result.directSaleRevenueMinor,
    );
  });
});
