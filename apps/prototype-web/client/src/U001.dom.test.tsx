/** @vitest-environment jsdom */

/* U-001 (دورة التدقيق النهائي): «السجل» ليس آخر ثلاثة فقط —
 * ١) زر «اعرض كل الأحداث» يوصل للأحداث الأقدم بأفعال تصحيحها الموثقة نفسها.
 * ٢) صف التصحيح في «السجل» يصل لمصدره برابط عميق (?event=) يفتحه مركّزًا. */
import React from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
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

const wouterMocks = vi.hoisted(() => ({ navigate: vi.fn(), search: "" }));

vi.mock("wouter", () => ({
  useLocation: () => ["/finance", wouterMocks.navigate],
  useParams: () => ({}),
  useSearch: () => wouterMocks.search,
}));

const mockedUsePrototypeServices = vi.mocked(usePrototypeServices);
const NOW = "2026-08-29T09:00:00.000Z";
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
    /* المجموعة ٢ (عقد ٢٨): خدمة المخزون الحقيقية فوق مخزن الذاكرة. */
    inventory: new InventoryMaterialService(store, () => NOW),
    /* المجموعة ٤ (عقد ٢٩): خدمات الأصول والقروض والعربون فوق مخزن الذاكرة. */
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
  await waitFor(() =>
    expect(screen.queryByText("جارٍ قراءة الوضع المالي المحلي…")).not.toBeTruthy(),
  );
  const summary = Array.from(document.querySelectorAll("summary")).find(node =>
    node.textContent?.includes("السجل والأثر"),
  );
  if (!summary) throw new Error("events layer summary should exist");
  fireEvent.click(summary);
  await waitFor(() => expect(screen.getByText("أحدث الأحداث العامة")).toBeTruthy());
}

async function recordExpense(amountMinor: number, note: string, key: string) {
  const result = await projectFinance.record({
    type: "operating_expense_cash",
    amountMinor,
    occurredOn: "2026-08-10",
    note,
    counterparty: "ناقل",
    relatedEventId: null,
    expenseContext: {
      relationship: "project",
      behavior: "variable",
      purpose: "order",
      knowledge: "known",
    },
    idempotencyKey: key,
  });
  if (!result.ok) throw new Error("expense should save");
  return result.value;
}

describe("U-001 older events stay reachable from the finance record surface", () => {
  beforeEach(() => {
    store = new MemoryLocalStore();
    projectFinance = new ProjectFinancialService(store, () => NOW);
    wouterMocks.search = "";
    wouterMocks.navigate.mockClear();
    mockedUsePrototypeServices.mockImplementation(
      () => contextRef.current as unknown as ReturnType<typeof usePrototypeServices>,
    );
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it("caps the default list at the latest three, then reveals every older event with its correction actions", async () => {
    const first = await recordExpense(1000, "مصروف أول", "u001-e1");
    await recordExpense(1100, "مصروف ثانٍ", "u001-e2");
    await recordExpense(1200, "مصروف ثالث", "u001-e3");
    await recordExpense(1300, "مصروف رابع", "u001-e4");
    await recordExpense(1400, "مصروف خامس", "u001-e5");
    await openEventsLayer();
    const eventRows = () => Array.from(document.querySelectorAll("article.micro-finance-event"));
    /* الافتراضي: الأحدث فقط (كثافة §10) لا السجل كاملًا. */
    expect(eventRows().length).toBeLessThanOrEqual(3);
    /* زر الوصول العملي للأحداث الأقدم ظاهر ويعرض العدد الكامل. */
    const expand = await waitFor(() => screen.getByText("اعرض كل الأحداث (5)"));
    fireEvent.click(expand);
    await waitFor(() => expect(screen.getByText("كل الأحداث العامة")).toBeTruthy());
    expect(eventRows().length).toBe(5);
    /* الأقدم نفسه (المصروف الأول بمبلغ ١٠٫٠٠) ظاهر بأفعال التصحيح الموثقة نفسها. */
    const firstRow = eventRows().find(row => row.textContent?.includes("10.00"));
    expect(firstRow).toBeTruthy();
    expect(firstRow?.textContent).toContain("عدّل بقيم جديدة");
    /* الطيّ يعيد العرض المكثف للأحدث فقط. */
    fireEvent.click(screen.getByText("أعرض الأحدث فقط"));
    await waitFor(() => expect(screen.getByText("أحدث الأحداث العامة")).toBeTruthy());
    expect(eventRows().length).toBeLessThanOrEqual(3);
    expect(store).toBeDefined();
    expect(first.id).toBeTruthy();
  });

  it("links a correction row to its source event and opens that event focused from the record", async () => {
    const expense = await recordExpense(2000, "مصروف قابل للتراجع", "u001-linked");
    const reversal = await projectFinance.reverse({
      sourceEventId: expense.id,
      occurredOn: "2026-08-20",
      reason: "سُجل بالخطأ",
      idempotencyKey: "u001-link-reverse",
    });
    if (!reversal.ok) throw new Error("reversal should save");
    await openEventsLayer();
    /* فتح «السجل» (طبقة التصحيحات) وقراءة صف التراجع. */
    const correctionsSummary = Array.from(document.querySelectorAll("summary")).find(node =>
      node.textContent?.includes("افتح سجل التصحيحات"),
    );
    if (!correctionsSummary) throw new Error("corrections summary should exist");
    fireEvent.click(correctionsSummary);
    const sourceButton = await waitFor(() => screen.getByText("افتح السجل المصدر"));
    fireEvent.click(sourceButton);
    /* الرابط العميق يقود إلى صف الحدث المصدر نفسه في الطبقة المالية —
     * (S1-03) يحمل مصدره ?from=/finance فيعود الرجوع إلى مالي. */
    expect(wouterMocks.navigate).toHaveBeenCalledWith(
      `/finance?event=${expense.id}&from=%2Ffinance`,
    );
    /* الوصول العميق يفتح «السجل والأثر» كاملًا ويُبرز صف المصدر مركّزًا. */
    wouterMocks.search = `?event=${expense.id}`;
    cleanup();
    render(<FinanceHarness />);
    await waitFor(() =>
      expect(screen.queryByText("جارٍ قراءة الوضع المالي المحلي…")).not.toBeTruthy(),
    );
    await waitFor(() => expect(screen.getByText("كل الأحداث العامة")).toBeTruthy());
    const focused = document.querySelector('article.micro-finance-event[data-focused="true"]');
    expect(focused).toBeTruthy();
    expect(focused?.textContent).toContain("20.00");
  });
});
