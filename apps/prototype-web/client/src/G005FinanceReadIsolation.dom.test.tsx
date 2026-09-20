/** @vitest-environment jsdom */
/* G-005 (تدقيق الإدارة المالية المتدرجة 2026-09-19): عزل فشل قراءات صفحة
 * المالية — فشل كتلة متقدمة واحدة (أو اثنتين) لا يحجب الصفحة: الأسطح
 * السليمة تبقى من مصادرها الحية، والمعطوبة تعرض بطاقة خطأ موجزة + إعادة
 * محاولة بلا أصفار كاذبة (المجهول «غير متاح» لا 0.00)، وفشل المجموعة
 * الأساسية (المركز) وحده يوجّه الصفحة للخطأ الصادق، والرفض (rejected
 * Promise) يُعالج كفشل كتلة لا كرفض غير معالج ولا صفحة فارغة. */
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
const NOW = "2026-09-20T09:00:00.000Z";

let store: MemoryLocalStore;
let dataVersion = 0;
/* فشل قابل للتبديل لكل كتلة: "ok_false" أو "reject" أو null (سليم). */
let failureMode: Record<string, "ok_false" | "reject" | null> = {};

function failing<T>(block: string, real: () => Promise<T>): Promise<T | { ok: false }> {
  const mode = failureMode[block];
  if (mode === "ok_false")
    return Promise.resolve({
      ok: false as const,
      code: "storage_error" as const,
      message: `فشل مفبرك لكتلة ${block}`,
    }) as Promise<T | { ok: false }>;
  if (mode === "reject") return Promise.reject(new Error(`رفض مفبرك لكتلة ${block}`));
  return real();
}

function buildServices() {
  const schedules = new ScheduleService(store, () => NOW);
  const cashContinuity = new CashContinuityService(store, () => NOW);
  const inventory = new InventoryMaterialService(store, () => NOW);
  const projectFinance = new ProjectFinancialService(store, () => NOW);
  const supplierPurchases = new SupplierPurchaseService(store, () => NOW);
  const realLoans = new LoanService(store, () => NOW);
  const realAssets = new AssetService(store, () => NOW);
  const realOwner = new OwnerEntitlementService(
    store,
    async () => ({ ok: true as const, value: { resultMinor: 0, status: "recorded_only" as const } }),
    () => NOW,
  );
  const realG5 = new G5Service(store, projectFinance, () => NOW);
  const realFulfillment = new FulfillmentService(store, () => NOW);
  return {
    projectFinance: {
      ...projectFinance,
      readPosition: () => failing("position", () => projectFinance.readPosition()),
      listEvents: () => failing("events", () => projectFinance.listEvents()),
      readRecordedPeriodResult: (from: string, to: string) =>
        failing("period", () => projectFinance.readRecordedPeriodResult(from, to)),
      readFinancialInsights: (from: string, to: string) =>
        failing("period", () => projectFinance.readFinancialInsights(from, to)),
    },
    correctionHistory: new CorrectionHistoryService(store),
    ownerEntitlement: {
      ...realOwner,
      readOverview: () => failing("owner", () => realOwner.readOverview()),
    },
    g5: {
      ...realG5,
      readDecision: (from: string, to: string) => failing("g5", () => realG5.readDecision(from, to)),
      listDeclarations: () => failing("g5", () => realG5.listDeclarations()),
    },
    financialPulse: new FinancialPulseService(store),
    fulfillment: {
      ...realFulfillment,
      listDepositOverview: () => failing("deposits", () => realFulfillment.listDepositOverview()),
    },
    inventory,
    assets: {
      ...realAssets,
      overview: () => failing("assets", () => realAssets.overview()),
    },
    loans: {
      ...realLoans,
      overview: () => failing("loans", () => realLoans.overview()),
    },
    retainedDeposits: {
      ...new RetainedDepositService(store, () => NOW),
      listPending: () => failing("loans", () => new RetainedDepositService(store, () => NOW).listPending()),
    },
    cashContinuity,
    supplierPurchases,
    schedules,
    activity: new ActivityService(store),
    agreements: new AgreementContextService(store, () => NOW),
    dataVersion,
    notifyDataChanged: () => {
      dataVersion += 1;
    },
  } as unknown as ReturnType<typeof usePrototypeServices>;
}

async function seedWallet() {
  const cash = new CashContinuityService(store, () => NOW);
  const opened = await cash.openWallet({
    name: "درج-G005",
    kind: "cash_drawer",
    openingMinor: 10000,
    occurredOn: "2026-09-01",
    note: "رصيد بداية",
    operationKey: "g005-open-wallet",
  });
  if (!opened.ok) throw new Error(opened.message);
}

function Harness() {
  const services = React.useMemo(() => buildServices(), []);
  mockedUsePrototypeServices.mockImplementation(() => services);
  return (
    <UnsavedChangesProvider navigate={wouterMocks.navigate}>
      <Finance />
    </UnsavedChangesProvider>
  );
}

describe("G-005 — Finance read-failure isolation", () => {
  beforeEach(() => {
    wouterMocks.navigate.mockReset();
    vi.clearAllMocks();
    failureMode = {};
    dataVersion = 0;
    store = new MemoryLocalStore();
  });
  afterEach(() => cleanup());

  it("success baseline: the page renders with no block errors", async () => {
    await seedWallet();
    render(<Harness />);
    await waitFor(() => {
      expect(screen.getByText("المالية")).toBeTruthy();
    });
    expect(screen.queryByTestId("finance-block-error")).toBeNull();
  });

  it("loans block failing alone: block error + healthy position cards stay live", async () => {
    await seedWallet();
    failureMode = { loans: "ok_false" };
    render(<Harness />);
    const blockErrors = await screen.findAllByTestId("finance-block-error");
    expect(blockErrors.length).toBeGreaterThanOrEqual(1);
    expect(blockErrors[0]!.textContent).toContain("القروض");
    /* الأسطح السليمة حية: بطاقة الكاش المسجل تعرض الرصيد الحقيقي لا صفرًا. */
    expect(screen.getByText("الكاش المسجل").textContent ?? "").toBeTruthy();
    await waitFor(() => {
      expect(screen.getAllByText("100.00").length).toBeGreaterThan(0);
    });
    /* لا 0.00 كاذبة: ملخص القروض في وضع «غير متاح» (لا يُعرض رصيص 0.00). */
    expect(screen.queryAllByText("0.00 قائمًا")).toHaveLength(0);
  });

  it("assets block failing alone stays isolated", async () => {
    await seedWallet();
    failureMode = { assets: "ok_false" };
    render(<Harness />);
    const blockErrors = await screen.findAllByTestId("finance-block-error");
    expect(blockErrors[0]!.textContent).toContain("الأصول");
    await waitFor(() => {
      expect(screen.getAllByText("100.00").length).toBeGreaterThan(0);
    });
  });

  it("two advanced blocks failing (assets + loans) keep the page alive", async () => {
    await seedWallet();
    failureMode = { assets: "ok_false", loans: "ok_false" };
    render(<Harness />);
    await screen.findAllByTestId("finance-block-error");
    expect(screen.getByText("المالية")).toBeTruthy();
    await waitFor(() => {
      expect(screen.getAllByText("100.00").length).toBeGreaterThan(0);
    });
  });

  it("owner money block failing: fallback card, position cards healthy", async () => {
    await seedWallet();
    failureMode = { owner: "ok_false" };
    render(<Harness />);
    const blockErrors = await screen.findAllByTestId("finance-block-error");
    expect(blockErrors.some(error => error.textContent?.includes("مال المالك"))).toBe(true);
    await waitFor(() => {
      expect(screen.getAllByText("100.00").length).toBeGreaterThan(0);
    });
  });

  it("g5 block failing: cash decision fallback without false numbers", async () => {
    await seedWallet();
    failureMode = { g5: "ok_false" };
    render(<Harness />);
    const blockErrors = await screen.findAllByTestId("finance-block-error");
    await waitFor(() => {
      expect(screen.getAllByText("100.00").length).toBeGreaterThan(0);
    });
  });

  it("events block failing: events fallback replaces the layer, not an empty list", async () => {
    await seedWallet();
    failureMode = { events: "ok_false" };
    render(<Harness />);
    const blockErrors = await screen.findAllByTestId("finance-block-error");
    expect(blockErrors.some(error => error.textContent?.includes("الأحداث"))).toBe(true);
  });

  it("deposits block failing stays isolated", async () => {
    await seedWallet();
    failureMode = { deposits: "ok_false" };
    render(<Harness />);
    const blockErrors = await screen.findAllByTestId("finance-block-error");
  });

  it("period block failing: the available-result card shows غير متاح (never 0.00)", async () => {
    await seedWallet();
    failureMode = { period: "ok_false" };
    render(<Harness />);
    /* بطاقة «النتيجة المتاحة» في وضع الوضع الآن تعرض «غير متاح» لا رقمًا. */
    await waitFor(() => {
      expect(screen.getByRole("button", { name: "افتح نتيجة الفترة" }).textContent).toContain("غير متاح");
    });
    await waitFor(() => {
      expect(screen.getAllByText("100.00").length).toBeGreaterThan(0);
    });
  });

  it("primary block (position) failing: the whole page shows the honest error with retry", async () => {
    await seedWallet();
    failureMode = { position: "ok_false" };
    render(<Harness />);
    await waitFor(() => {
      expect(screen.getByText("تعذر قراءة الوضع المالي")).toBeTruthy();
    });
    expect(screen.getByRole("button", { name: "إعادة المحاولة" })).toBeTruthy();
  });

  it("a rejected promise is handled as a block failure — no unhandled rejection, no blank page", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);
    await seedWallet();
    failureMode = { loans: "reject" };
    render(<Harness />);
    await screen.findAllByTestId("finance-block-error");
    expect(screen.getByText("المالية")).toBeTruthy();
    await waitFor(() => {
      expect(screen.getAllByText("100.00").length).toBeGreaterThan(0);
    });
    consoleError.mockRestore();
  });

  it("retry after recovery: the failed block heals and the error card disappears", async () => {
    await seedWallet();
    failureMode = { loans: "ok_false" };
    const { rerender } = render(<Harness />);
    await screen.findAllByTestId("finance-block-error");
    /* التعافي: الكتلة ترجع سليمة ثم إعادة المحاولة تعيد القراءة. */
    failureMode = {};
    fireEvent.click(screen.getAllByRole("button", { name: "إعادة المحاولة" })[0]!);
    await rerender(<Harness />);
    await waitFor(
      () => {
        expect(screen.queryByTestId("finance-block-error")).toBeNull();
      },
      { timeout: 4000 },
    );
  });

  it("the retry action is keyboard reachable (a real focusable button)", async () => {
    await seedWallet();
    failureMode = { loans: "ok_false" };
    render(<Harness />);
    await screen.findAllByTestId("finance-block-error");
    const retry = screen.getAllByRole("button", { name: "إعادة المحاولة" })[0]!;
    expect(retry.getAttribute("disabled")).toBeNull();
    expect(retry.tagName).toBe("BUTTON");
  });
});
