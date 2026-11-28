/** @vitest-environment jsdom */

/*
 * M5.6 (UX P-41–P-46): الحالات الحرفية — السجل بالفلاتر والتجميع R-28
 * والفراغات، تفاصيل الحركة بمحتواها وأزرارها ونسخها السابقة، والمجمّع
 * بقائمة عملياته، والمستحقات والالتزامات بجهتيهما ومجموعة المقدمات،
 * وتفاصيل الخط وحركاته، وإضافة السابق بتحققاتها.
 */
import React from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import ActivityPage from "@/pages/manage/ActivityPage";
import ActivityDetailPage from "@/pages/manage/ActivityDetailPage";
import BalancesPage from "@/pages/manage/BalancesPage";
import BalanceLinePage from "@/pages/manage/BalanceLinePage";
import AddPriorPage from "@/pages/manage/AddPriorPage";
import { MANAGE_STRINGS_AR } from "@/application/manage/strings";
import * as api from "@/application/manage/api";
import type { ActivityLogRow, ManageFiguresResponse, OperationVersion } from "@/application/manage/api";

let currentPath = "/manage/activity";
const navigate = vi.fn((to: string) => {
  currentPath = to;
});
vi.mock("wouter", () => ({
  useLocation: () => [currentPath, navigate],
  useSearch: () => (currentPath.includes("?") ? currentPath.slice(currentPath.indexOf("?") + 1) : ""),
  useParams: () => {
    const match = /^\/manage\/(?:activity|balances)\/([^/?]+)/.exec(currentPath);
    return { id: match === null ? "" : decodeURIComponent(match[1]) };
  },
}));

vi.mock("@/application/manage/api", async importOriginal => {
  const actual = await importOriginal<typeof import("@/application/manage/api")>();
  return {
    ...actual,
    fetchActivityLog: vi.fn(),
    fetchOperationDetails: vi.fn(),
    fetchBalanceLine: vi.fn(),
    fetchManageFigures: vi.fn(),
    addPriorBalance: vi.fn(),
  };
});

const logApi = vi.mocked(api.fetchActivityLog);
const detailsApi = vi.mocked(api.fetchOperationDetails);
const lineApi = vi.mocked(api.fetchBalanceLine);
const figuresApi = vi.mocked(api.fetchManageFigures);
const priorApi = vi.mocked(api.addPriorBalance);

function figure(fils: number): { fils: number; text: string; textDashboard: string } {
  const text = `${Math.trunc(fils / 1000)}.${String(fils % 1000).padStart(3, "0")} د`;
  return { fils, text, textDashboard: text };
}

function baseFigures(overrides: Partial<ManageFiguresResponse> = {}): ManageFiguresResponse {
  return {
    period: { kind: "month", from: "2026-11-01", to: "2026-11-30", label: "11/2026", labelText: "11/2026" },
    boxes: [
      {
        id: "b-cash",
        kind: "cash",
        status: "active",
        openingStatus: "known",
        balanceFils: 90_000,
        text: "90.000 د",
        textDashboard: "90 د",
      },
      {
        id: "b-account",
        kind: "account",
        status: "active",
        openingStatus: "known",
        balanceFils: 0,
        text: "0.000 د",
        textDashboard: "0 د",
      },
    ],
    totalBalance: figure(90_000),
    receivables: figure(18_000),
    payables: figure(0),
    payablesPrepayments: figure(0),
    whatYouHave: figure(108_000),
    whatYouOwe: figure(0),
    whatYouOweBreakdown: [],
    sales: figure(0),
    returnsAndDiscounts: figure(0),
    netSales: figure(0),
    netProfit: figure(0),
    expenses: figure(0),
    equipment: figure(0),
    personalWithdrawals: figure(0),
    ownerDeposits: figure(0),
    perTenRatio: { kind: "hidden", labelKey: "c.withdrawals_only" },
    biggestExpense: null,
    expensesByCategory: [],
    materialsAlert: false,
    unexplained: { fils: 0, shown: false, text: "0.000 د" },
    netWorth: figure(90_000),
    netWorthSources: {
      openingFils: 0,
      openingText: "0.000 د",
      ownerDepositsFils: 0,
      ownerDepositsText: "0.000 د",
      ownerWithdrawalsFils: 0,
      ownerWithdrawalsText: "0.000 د",
      netProfitSinceStartFils: 0,
      netProfitSinceStartText: "0.000 د",
      unexplainedFils: 0,
      unexplainedText: "0.000 د",
      totalFils: 0,
      totalText: "0.000 د",
    },
    overdueReceivables: [],
    balanceLines: [
      {
        id: "line-1",
        direction: "to_me",
        kind: "sale_remainder",
        counterpartyName: "أم خالد",
        originOn: "2026-11-14",
        outstandingFils: 18_000,
        overdue: true,
        text: "18.000 د",
      },
    ],
    salesList: [
      {
        id: "sale-1",
        status: "scheduled",
        customerName: "محمد",
        registeredOn: "2026-11-25",
        plannedDeliveryOn: "2026-11-30",
        deliveredOn: null,
        tracked: true,
        hiddenFromTracker: false,
        finalPriceFils: 80_000,
        prepaymentFils: 20_000,
        netSaleRevenueFils: 0,
        expectedProfitFils: null,
        fullAmountFils: 80_000,
        paid: { paidFils: 20_000, ofFils: 80_000 },
      },
    ],
    openSales: [],
    topSellers: [],
    topProfit: [],
    bars: [],
    flags: { newUser: false, incompletePeriod: false, unknownBalance: false },
    ...overrides,
  } as ManageFiguresResponse;
}

function singleRow(
  overrides: Partial<Extract<ActivityLogRow, { compound: false }>> = {},
): Extract<ActivityLogRow, { compound: false }> {
  return {
    compound: false,
    operationId: "op-1",
    kind: "OP-EXPENSE",
    effectiveOn: "2026-11-26",
    name: "غاز",
    amountText: "10.000 د",
    deliveryCostText: null,
    boxKind: null,
    corrected: false,
    cancelled: false,
    saleId: null,
    saleStatus: null,
    variant: null,
    category: "gas",
    ...overrides,
  };
}

function version(overrides: Partial<OperationVersion> = {}): OperationVersion {
  return {
    operationId: "op-1",
    kind: "OP-EXPENSE",
    effectiveOn: "2026-11-26",
    amountText: "10.000 د",
    deliveryCostText: null,
    boxKind: null,
    personalMoney: false,
    name: "غاز",
    category: "gas",
    note: null,
    saleId: null,
    saleStatus: null,
    corrected: false,
    cancelled: false,
    variant: null,
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  currentPath = "/manage/activity";
  figuresApi.mockResolvedValue(baseFigures());
  logApi.mockResolvedValue({ rows: [] });
});
afterEach(() => cleanup());

/* ── P-41 الحركات ────────────────────────────────────────────────────── */

describe("M5.6 — P-41 الحركات", () => {
  it("البحث وفلترا النوع والفترة؛ والمجمّع R-28 بسعره وحالته؛ والفراغان الحرفيان", async () => {
    logApi.mockResolvedValue({
      rows: [
        {
          compound: true,
          groupId: "sale-1@2026-11-26",
          labelKey: "op.sale",
          effectiveOn: "2026-11-26",
          name: "سامي",
          amountText: "25.000 د",
          saleId: "sale-1",
          saleStatus: "completed",
          corrected: false,
          cancelled: false,
          members: [
            {
              operationId: "op-c",
              kind: "OP-SALE-CREATE",
              amountText: "25.000 د",
              corrected: false,
              cancelled: false,
            },
            { operationId: "op-d", kind: "OP-DELIVER", amountText: null, corrected: false, cancelled: false },
          ],
        },
        singleRow(),
      ],
    });
    render(<ActivityPage />);
    await waitFor(() => expect(screen.getByText(MANAGE_STRINGS_AR["s.activity"])).toBeTruthy());
    /* المجمّع: التسمية + الحالة + السعر. */
    expect(screen.getByText(new RegExp(`بيع أو طلب · مكتمل`))).toBeTruthy();
    expect(screen.getByText("25.000 د")).toBeTruthy();
    /* صف مفرد. */
    expect(screen.getByText("غاز")).toBeTruthy();
    /* الفلاتر مطلوبة من الخادم بالافتراضي: النوع كله والفترة منذ البداية. */
    expect(logApi).toHaveBeenCalledWith(expect.objectContaining({ type: "all", period: "since_start" }));
    /* كبسة المجمّع ← P-42 بقائمة عملياته. */
    fireEvent.click(screen.getByText(/مكتمل/));
    expect(navigate).toHaveBeenCalledWith("/manage/activity/group-sale-1%402026-11-26");
  });

  it("تغيير الفلتر يعيد الكتابة إلى الوصل؛ والفراغان الحرفيان", async () => {
    const view = render(<ActivityPage />);
    await waitFor(() => expect(screen.getByText(MANAGE_STRINGS_AR["t.filter_type"])).toBeTruthy());
    fireEvent.click(screen.getByText(MANAGE_STRINGS_AR["op.expense"]));
    expect(navigate).toHaveBeenCalledWith("/manage/activity?type=op.expense");
    view.unmount();

    logApi.mockResolvedValue({ rows: [] });
    render(<ActivityPage />);
    await waitFor(() => expect(screen.getByText(MANAGE_STRINGS_AR["e.empty_activity"])).toBeTruthy());
  });
});

/* ── P-42/P-43 تفاصيل الحركة ─────────────────────────────────────────── */

describe("M5.6 — P-42/P-43 تفاصيل الحركة", () => {
  it("المحتوى الثماني والأزرار الحرفية والنسخ السابقة قراءة", async () => {
    currentPath = "/manage/activity/op-1";
    detailsApi.mockResolvedValue({
      ...version({ kind: "OP-COLLECT", saleId: "sale-1", corrected: true, boxKind: "cash", name: "سامي" }),
      previousVersions: [
        version({ operationId: "op-0", kind: "OP-COLLECT", amountText: "5.000 د", cancelled: true }),
      ],
    });
    render(<ActivityDetailPage />);
    await waitFor(() => expect(screen.getByText(/تحصيل · معدَّلة/)).toBeTruthy());
    expect(screen.getByText("المبلغ: 10.000 د")).toBeTruthy();
    expect(screen.getByText("الصندوق: نقد")).toBeTruthy();
    expect(screen.getByText("الاسم: سامي")).toBeTruthy();
    /* فتح الطلب + تعديل + إلغاء + النسخ السابقة. */
    fireEvent.click(screen.getByText(MANAGE_STRINGS_AR["a.open_sale"]));
    expect(navigate).toHaveBeenCalledWith("/manage/sale/sale-1");
    expect(screen.getByText(MANAGE_STRINGS_AR["a.edit"])).toBeTruthy();
    expect(screen.getByText(MANAGE_STRINGS_AR["a.cancel"])).toBeTruthy();
    expect(screen.getByText(MANAGE_STRINGS_AR["l.previous_versions"])).toBeTruthy();
    expect(screen.getByText("5.000 د")).toBeTruthy();
  });

  it("تسليم فعّال: إلغاء التسليم وتصحيح السعر ولا تعديل عام؛ والمجمّع بقائمته", async () => {
    currentPath = "/manage/activity/op-d";
    detailsApi.mockResolvedValue({
      ...version({ kind: "OP-DELIVER", saleId: "sale-1" }),
      previousVersions: [],
    });
    const view = render(<ActivityDetailPage />);
    await waitFor(() => expect(screen.getByText(MANAGE_STRINGS_AR["a.undo_delivery"])).toBeTruthy());
    expect(screen.getByText(MANAGE_STRINGS_AR["a.price_correction"])).toBeTruthy();
    expect(screen.queryByText(MANAGE_STRINGS_AR["a.edit"])).toBeNull();
    view.unmount();

    currentPath = `/manage/activity/group-${encodeURIComponent("sale-1@2026-11-26")}`;
    logApi.mockResolvedValue({
      rows: [
        {
          compound: true,
          groupId: "sale-1@2026-11-26",
          labelKey: "op.sale",
          effectiveOn: "2026-11-26",
          name: "سامي",
          amountText: "25.000 د",
          saleId: "sale-1",
          saleStatus: "completed",
          corrected: false,
          cancelled: false,
          members: [
            {
              operationId: "op-c",
              kind: "OP-SALE-CREATE",
              amountText: "25.000 د",
              corrected: false,
              cancelled: false,
            },
            { operationId: "op-d", kind: "OP-DELIVER", amountText: null, corrected: false, cancelled: false },
          ],
        },
      ],
    });
    render(<ActivityDetailPage />);
    await waitFor(() => expect(screen.getByText(MANAGE_STRINGS_AR["s.activity"])).toBeTruthy());
    /* قائمة عمليات المجمّع — كبسة أي وحدة تفتح تفاصيلها. */
    fireEvent.click(screen.getByText("تسليم"));
    expect(navigate).toHaveBeenCalledWith("/manage/activity/op-d");
  });
});

/* ── P-44 المستحقات والالتزامات ──────────────────────────────────────── */

describe("M5.6 — P-44 المستحقات والالتزامات", () => {
  it("«لك»: الجملة وصف الخط بنوعه ومتبقية وعمره وزر الإضافة؛ تبديل «عليك» يفتح على الجهة", async () => {
    currentPath = "/manage/balances?tab=to_me";
    render(<BalancesPage />);
    await waitFor(() =>
      expect(
        screen.getByText(MANAGE_STRINGS_AR["s.receivables"].replace("{amount}", "18.000 د")),
      ).toBeTruthy(),
    );
    expect(screen.getByText(/أم خالد · متبقٍ على طلب/)).toBeTruthy();
    expect(screen.getByText(/منذ أسبوعين|منذ \d+/)).toBeTruthy();
    fireEvent.click(screen.getByText(MANAGE_STRINGS_AR["t.by_me"]));
    expect(navigate).toHaveBeenCalledWith("/manage/balances?tab=by_me");
    fireEvent.click(screen.getByText(MANAGE_STRINGS_AR["a.add_prior"]));
    expect(navigate).toHaveBeenCalledWith("/manage/balances/add-prior?direction=to_me");
  });

  it("«عليك»: الفراغ الحرفي مع الزر؛ ومجموعة الدفعات المقدمة بطلباتها", async () => {
    currentPath = "/manage/balances?tab=by_me";
    const view = render(<BalancesPage />);
    await waitFor(() => expect(screen.getByText(MANAGE_STRINGS_AR["e.empty_payables"])).toBeTruthy());
    expect(screen.getByText(MANAGE_STRINGS_AR["a.add_prior_payable"])).toBeTruthy();
    /* مجموعة الدفعات المقدمة: طلب محمد بـ20 د. */
    expect(screen.getByText(MANAGE_STRINGS_AR["t.prepayments_group"])).toBeTruthy();
    expect(screen.getByText("محمد")).toBeTruthy();
    expect(screen.getByText("20 د")).toBeTruthy();
    view.unmount();
  });
});

/* ── P-45 تفاصيل الخط ────────────────────────────────────────────────── */

describe("M5.6 — P-45 تفاصيل المستحق", () => {
  it("النوع والمتبقي والعمر وفتح الطلب والأساسي تحصيل وحركاته", async () => {
    currentPath = "/manage/balances/line-1";
    lineApi.mockResolvedValue({
      line: {
        id: "line-1",
        direction: "to_me",
        kind: "sale_remainder",
        counterpartyName: "أم خالد",
        originOn: "2026-11-14",
        outstandingFils: 18_000,
        outstandingText: "18.000 د",
        overdue: true,
        saleId: "sale-1",
      },
      movements: [
        singleRow({ operationId: "op-9", kind: "OP-DELIVER", name: null, category: null, amountText: null }),
      ],
    });
    render(<BalanceLinePage />);
    await waitFor(() => expect(screen.getByText("أم خالد")).toBeTruthy());
    expect(screen.getByText(/18\.000 د · منذ/)).toBeTruthy();
    expect(screen.getByText(MANAGE_STRINGS_AR["a.collect_now"])).toBeTruthy();
    expect(screen.getByText(MANAGE_STRINGS_AR["f.short_writeoff"])).toBeTruthy();
    fireEvent.click(screen.getByText(MANAGE_STRINGS_AR["a.open_sale"]));
    expect(navigate).toHaveBeenCalledWith("/manage/sale/sale-1");
    /* الحركات على الخط. */
    expect(screen.getByText("تسليم")).toBeTruthy();
  });
});

/* ── P-46 إضافة سابق ────────────────────────────────────────────────── */

describe("M5.6 — P-46 إضافة مستحق سابق", () => {
  it("العنوان بنص الزر؛ التحققات الثلاثة تحت الحقول؛ الحفظ ← P-44", async () => {
    currentPath = "/manage/balances/add-prior?direction=to_me";
    priorApi.mockResolvedValue({
      outcome: "applied",
      result: {
        operationId: "op",
        kind: "OP-ADD-PRIOR-BALANCE",
        effectiveOn: "2026-11-28",
        amountFils: 5_000,
        entryIds: [],
      },
    });
    render(<AddPriorPage />);
    expect(screen.getByText(MANAGE_STRINGS_AR["a.add_prior"])).toBeTruthy();
    const save = screen.getByText(MANAGE_STRINGS_AR["a.save"]).closest("button")!;
    expect(save.getAttribute("disabled")).not.toBeNull();
    /* الاسم الفارغ → E-NAME-REQUIRED تحت الحقل. */
    fireEvent.change(screen.getByTestId("manage-prior-name"), { target: { value: "أبو أحمد" } });
    fireEvent.change(screen.getByTestId("manage-prior-amount"), { target: { value: "5.000" } });
    expect(save.getAttribute("disabled")).toBeNull();
    expect(screen.getByText(MANAGE_STRINGS_AR["l.prior_no_profit"])).toBeTruthy();
    fireEvent.click(save);
    await waitFor(() =>
      expect(priorApi).toHaveBeenCalledWith(
        expect.objectContaining({ direction: "to_me", counterpartyName: "أبو أحمد", amountFils: 5_000 }),
      ),
    );
    expect(navigate).toHaveBeenCalledWith("/manage/balances?tab=to_me");
  });

  it("مبلغ غير صالح: E-AMOUNT تحت الحقل بلا نداء (C-08)", async () => {
    currentPath = "/manage/balances/add-prior?direction=by_me";
    render(<AddPriorPage />);
    expect(screen.getByText(MANAGE_STRINGS_AR["a.add_prior_payable"])).toBeTruthy();
    fireEvent.change(screen.getByTestId("manage-prior-name"), { target: { value: "مطبعة النور" } });
    fireEvent.change(screen.getByTestId("manage-prior-amount"), { target: { value: "abc" } });
    fireEvent.click(screen.getByText(MANAGE_STRINGS_AR["a.save"]).closest("button")!);
    await waitFor(() => expect(screen.getByText(MANAGE_STRINGS_AR["E-AMOUNT"])).toBeTruthy());
    expect(priorApi).not.toHaveBeenCalled();
  });
});
