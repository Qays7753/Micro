/** @vitest-environment jsdom */

/*
 * M5.2 (UX P-10 «مشروعي الآن»): الحالات الحرفية — الرأس والإعدادات، بطاقة
 * العودة بأيام الخادم، التنبيه السالب لصندوق معروف فقط، الرصيد الإجمالي
 * وتفصيل الصندوقين والمجهول، إخفاء الصفور، تذكير R-8 (r.prompt/r.prompt_single)
 * وإخفاؤه مع التنبيه السالب و«لاحقاً» للجلسة، طلبات اليوم والغد (G-06) بحد
 * 5، المتأخرة، المستحقات المتأخرة بحد 3، الأزرار السريعة C-07 بترتيبها،
 * والفارغة الجديدة (الرصيد + الأزرار فقط). و404 → P-01.
 */
import React from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import NowPage from "@/pages/manage/NowPage";
import { MANAGE_STRINGS_AR } from "@/application/manage/strings";
import * as api from "@/application/manage/api";
import type { ManageFiguresResponse, ProjectStateResponse, SaleRow } from "@/application/manage/api";

const navigate = vi.fn();
vi.mock("wouter", () => ({
  useLocation: () => ["/", navigate],
}));
vi.mock("@/application/time", () => ({
  todayInAmman: () => "2026-11-29",
}));

vi.mock("@/application/manage/api", async importOriginal => {
  /* الدوال النقية (خرائط الأخطاء) تبقى الحقيقية؛ النداءات الشبكية وحدها
   * تُموَّك — نفس شكل استجابات الخادم. */
  const actual = await importOriginal<typeof import("@/application/manage/api")>();
  return {
    ...actual,
    detectAbsence: vi.fn().mockResolvedValue({}),
    fetchManageProject: vi.fn(),
    fetchManageFigures: vi.fn(),
    fetchReconciliationLog: vi.fn(),
    fetchManageSaleRows: vi.fn(),
  };
});

const projectApi = vi.mocked(api.fetchManageProject);
const figuresApi = vi.mocked(api.fetchManageFigures);
const logApi = vi.mocked(api.fetchReconciliationLog);
const rowsApi = vi.mocked(api.fetchManageSaleRows);

const filled = (key: keyof typeof MANAGE_STRINGS_AR, params: Record<string, string>) =>
  MANAGE_STRINGS_AR[key].replace(/\{(\w+)\}/g, (_, name) => params[name] ?? "");

function moneyFigure(fils: number) {
  return { fils, text: `${fils / 1000}.000 د`, textDashboard: `${fils / 1000} د` };
}

function baseFigures(overrides: Partial<ManageFiguresResponse> = {}): ManageFiguresResponse {
  return {
    period: { kind: "month", from: "2026-11-01", to: "2026-11-29", label: "11/2026", labelText: "11/2026" },
    boxes: [
      {
        id: "b1",
        kind: "cash",
        status: "active",
        openingStatus: "known",
        balanceFils: 225_000,
        text: "225.000 د",
        textDashboard: "225 د",
      },
    ],
    totalBalance: moneyFigure(225_000),
    receivables: moneyFigure(18_000),
    payables: moneyFigure(10_000),
    payablesPrepayments: moneyFigure(10_000),
    whatYouHave: moneyFigure(243_000),
    whatYouOwe: moneyFigure(10_000),
    whatYouOweBreakdown: [],
    sales: moneyFigure(42_000),
    returnsAndDiscounts: moneyFigure(0),
    netSales: moneyFigure(42_000),
    netProfit: moneyFigure(9_500),
    expenses: moneyFigure(32_500),
    equipment: moneyFigure(0),
    personalWithdrawals: moneyFigure(15_000),
    ownerDeposits: moneyFigure(7_000),
    perTenRatio: { perTenText: "2.3", shown: true },
    biggestExpense: null,
    expensesByCategory: [],
    materialsAlert: false,
    unexplained: { fils: 0, shown: false, text: "0.000 د" },
    netWorth: moneyFigure(233_000),
    netWorthSources: null,
    overdueReceivables: [],
    balanceLines: [],
    salesList: [],
    openSales: [],
    topSellers: [],
    topProfit: [],
    bars: [],
    flags: { newUser: false, incompletePeriod: false, unknownBalance: false },
    ...overrides,
  } as ManageFiguresResponse;
}

function projectState(overrides: Partial<ProjectStateResponse> = {}): ProjectStateResponse {
  return {
    projectId: "p1",
    name: "مطبخ أم ليث",
    openAbsence: null,
    ...overrides,
  };
}

function saleRow(overrides: Partial<SaleRow> = {}): SaleRow {
  return {
    id: "s1",
    status: "scheduled",
    customerName: "أبو أحمد",
    firstLineDescription: "مقلوبة",
    plannedDeliveryOn: "2026-11-29",
    deliveredOn: null,
    tracked: true,
    hiddenFromTracker: false,
    paidFils: 10_000,
    ofFils: 36_000,
    fullAmountFils: 26_000,
    ...overrides,
  };
}

async function renderReady(
  figuresOverrides: Partial<ManageFiguresResponse> = {},
  projectOverrides: Partial<ProjectStateResponse> = {},
  rows: SaleRow[] = [saleRow()],
  due = false,
) {
  projectApi.mockResolvedValue(projectState(projectOverrides));
  figuresApi.mockResolvedValue(baseFigures(figuresOverrides));
  logApi.mockResolvedValue({ due, reconciliations: [] });
  rowsApi.mockResolvedValue({ sales: rows });
  render(<NowPage />);
  await waitFor(() => expect(screen.getByText("مطبخ أم ليث")).toBeTruthy());
}

beforeEach(() => {
  navigate.mockReset();
  projectApi.mockReset();
  figuresApi.mockReset();
  logApi.mockReset();
  rowsApi.mockReset();
});

afterEach(cleanup);

describe("M5.2 — P-10 مشروعي الآن (UX P-10)", () => {
  it("الرأس: اسم المشروع + أيقونة الإعدادات → P-11", async () => {
    await renderReady();
    expect(screen.getByText("مطبخ أم ليث")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: MANAGE_STRINGS_AR["t.settings"] }));
    expect(navigate).toHaveBeenCalledWith("/manage/settings");
  });

  it("الكشف عند الفتح (§7.2-1) يُستدعى قبل القراءات", async () => {
    await renderReady();
    expect(api.detectAbsence).toHaveBeenCalled();
  });

  it("بطاقة العودة بأيام الخادم (r.absence_intro) وزر «ابدأ» → P-12 — ولا فتح تلقائي", async () => {
    await renderReady(
      {},
      { openAbsence: { startedOn: "2026-11-09", endedOn: "2026-11-29", daysSinceLastRecord: 20 } },
    );
    expect(screen.getByText(filled("r.absence_intro", { days: "20" }))).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: MANAGE_STRINGS_AR["a.start"] }));
    expect(navigate).toHaveBeenCalledWith("/manage/return/orders");
    /* التطبيق لا يفتح أي صفحة تلقائيًا — البطاقة فقط. */
    expect(navigate).not.toHaveBeenCalledWith("/manage/return/orders", { replace: true });
  });

  it("لا بطاقة عودة بلا انقطاع مفتوح", async () => {
    await renderReady();
    expect(screen.queryByText(MANAGE_STRINGS_AR["a.start"])).toBeNull();
  });

  it("التنبيه السالب لصندوق معروف + «ابدأ المطابقة»؛ المجهول بلا تنبيه", async () => {
    await renderReady({
      boxes: [
        {
          id: "b1",
          kind: "cash",
          status: "active",
          openingStatus: "known",
          balanceFils: -30_000,
          text: "-30.000 د",
          textDashboard: "-30 د",
        },
      ],
      totalBalance: moneyFigure(-30_000),
    });
    expect(screen.getByText(MANAGE_STRINGS_AR["w.negative_box"])).toBeTruthy();
    fireEvent.click(screen.getAllByRole("button", { name: MANAGE_STRINGS_AR["a.start_recon"] })[0]!);
    expect(navigate).toHaveBeenCalledWith("/manage/reconcile");

    cleanup();
    navigate.mockClear();
    await renderReady({
      boxes: [
        {
          id: "b1",
          kind: "cash",
          status: "active",
          openingStatus: "unknown",
          balanceFils: null,
          balanceLabelKey: "l.unknown_balance",
        },
      ],
      totalBalance: { fils: null, labelKey: "l.unknown_balance" },
      flags: { newUser: false, incompletePeriod: true, unknownBalance: true },
    });
    expect(screen.queryByText(MANAGE_STRINGS_AR["w.negative_box"])).toBeNull();
    /* N-37: جملة الرصيد المجهول الكاملة مكان الإجمالي. */
    expect(screen.getByText(MANAGE_STRINGS_AR["s.balance_unknown"])).toBeTruthy();
  });

  it("الرصيد الإجمالي (s.balance) يفتح الصناديق؛ التفصيل مع صندوقين فقط", async () => {
    await renderReady({
      boxes: [
        {
          id: "b1",
          kind: "cash",
          status: "active",
          openingStatus: "known",
          balanceFils: 76_500,
          text: "76.500 د",
          textDashboard: "76.500 د",
        },
        {
          id: "b2",
          kind: "account",
          status: "active",
          openingStatus: "known",
          balanceFils: 160_000,
          text: "160.000 د",
          textDashboard: "160 د",
        },
      ],
      totalBalance: moneyFigure(236_500),
    });
    expect(screen.getByText(filled("s.balance", { amount: "236.5 د" }))).toBeTruthy();
    expect(
      screen.getByText(`${MANAGE_STRINGS_AR["f.cash"]} 76.500 د · ${MANAGE_STRINGS_AR["f.account"]} 160 د`),
    ).toBeTruthy();
    fireEvent.click(screen.getByText(filled("s.balance", { amount: "236.5 د" })));
    expect(navigate).toHaveBeenCalledWith("/manage/boxes");
  });

  it("المستحقات والالتزامات تظهران بقيمهما وتخفيان عند الصفر؛ النقر → P-44", async () => {
    await renderReady();
    expect(screen.getByText(filled("s.receivables", { amount: "18 د" }))).toBeTruthy();
    expect(screen.getByText(filled("s.payables", { amount: "10 د", pre: "10 د" }))).toBeTruthy();
    fireEvent.click(screen.getByText(filled("s.receivables", { amount: "18 د" })));
    expect(navigate).toHaveBeenCalledWith("/manage/balances?tab=to_me");

    cleanup();
    await renderReady({
      receivables: moneyFigure(0),
      payables: moneyFigure(0),
      payablesPrepayments: moneyFigure(0),
    });
    expect(screen.queryByText(MANAGE_STRINGS_AR["s.receivables"].split("{")[0])).toBeNull();
  });

  it("التزام بلا دفعات مقدمة: N-26 (s.payables_no_pre)", async () => {
    await renderReady({ payablesPrepayments: moneyFigure(0) });
    expect(screen.getByText(filled("s.payables_no_pre", { amount: "10 د" }))).toBeTruthy();
  });

  it("تذكير R-8: r.prompt مع تفصيل الصندوقين وr.prompt_single لواحد؛ «لاحقاً» يخفيه (G-10)", async () => {
    await renderReady(
      {
        boxes: [
          {
            id: "b1",
            kind: "cash",
            status: "active",
            openingStatus: "known",
            balanceFils: 76_500,
            text: "76.500 د",
            textDashboard: "76.500 د",
          },
          {
            id: "b2",
            kind: "account",
            status: "active",
            openingStatus: "known",
            balanceFils: 160_000,
            text: "160.000 د",
            textDashboard: "160 د",
          },
        ],
        totalBalance: moneyFigure(236_500),
      },
      {},
      [],
      true,
    );
    const prompt = filled("r.prompt", {
      total: "236.5 د",
      breakdown: `${MANAGE_STRINGS_AR["f.cash"]} 76.500 د · ${MANAGE_STRINGS_AR["f.account"]} 160 د`,
    });
    expect(screen.getByText(prompt)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: MANAGE_STRINGS_AR["d.recon_later"] }));
    await waitFor(() => expect(screen.queryByText(prompt)).toBeNull());
  });

  it("التذكير لا يظهر مع التنبيه السالب (لا تكرار لزر المطابقة)", async () => {
    await renderReady(
      {
        boxes: [
          {
            id: "b1",
            kind: "cash",
            status: "active",
            openingStatus: "known",
            balanceFils: -30_000,
            text: "-30.000 د",
            textDashboard: "-30 د",
          },
        ],
        totalBalance: moneyFigure(-30_000),
      },
      {},
      [],
      true,
    );
    expect(screen.queryByTestId("manage-recon-reminder")).toBeNull();
    expect(screen.getByText(MANAGE_STRINGS_AR["w.negative_box"])).toBeTruthy();
  });

  it("طلبات اليوم والغد (G-06): مجموعتان بصفوف C-09 وزر «تم التسليم» على اليوم", async () => {
    await renderReady({}, {}, [
      saleRow({ id: "s-today", plannedDeliveryOn: "2026-11-29" }),
      saleRow({
        id: "s-tomorrow",
        plannedDeliveryOn: "2026-11-30",
        customerName: "سلمى",
        firstLineDescription: "ورق عنب",
      }),
      saleRow({ id: "s-delivered", status: "completed", deliveredOn: "2026-11-28" }),
      saleRow({ id: "s-cancelled", status: "cancelled" }),
    ]);
    expect(screen.getByText(MANAGE_STRINGS_AR["s.today_orders"])).toBeTruthy();
    expect(screen.getByText(MANAGE_STRINGS_AR["a.today"])).toBeTruthy();
    expect(screen.getByText(MANAGE_STRINGS_AR["a.tomorrow"])).toBeTruthy();
    expect(screen.getByText("مقلوبة")).toBeTruthy();
    expect(screen.getByText("ورق عنب")).toBeTruthy();
    /* المسلَّم والملغى خارج القائمة (G-06): عموداهما لا يظهران؛ وصف
     * «ورق عنب» (الغد) مرة واحدة فقط. */
    expect(screen.getAllByText("ورق عنب")).toHaveLength(1);
    const deliverButtons = screen.getAllByRole("button", { name: MANAGE_STRINGS_AR["a.deliver"] });
    fireEvent.click(deliverButtons[0]!);
    expect(navigate).toHaveBeenCalledWith("/manage/op/deliver/s-today");
  });

  it("المتأخرة قسم مستقل، والمستحقات المتأخرة بحد 3 + «عرض الكل»", async () => {
    await renderReady(
      {
        overdueReceivables: [
          {
            lineId: "l1",
            counterpartyName: "أم خالد",
            outstandingFils: 18_000,
            originOn: "2026-11-13",
            text: "18.000 د",
          },
          {
            lineId: "l2",
            counterpartyName: "سامي",
            outstandingFils: 8_000,
            originOn: "2026-11-01",
            text: "8.000 د",
          },
          {
            lineId: "l3",
            counterpartyName: "ليان",
            outstandingFils: 5_000,
            originOn: "2026-11-20",
            text: "5.000 د",
          },
          {
            lineId: "l4",
            counterpartyName: "رابع",
            outstandingFils: 3_000,
            originOn: "2026-11-20",
            text: "3.000 د",
          },
        ],
      },
      {},
      [saleRow({ id: "s-late", status: "overdue", plannedDeliveryOn: "2026-11-20" })],
    );
    expect(screen.getByText(MANAGE_STRINGS_AR["s.overdue_orders"])).toBeTruthy();
    expect(screen.getByText(MANAGE_STRINGS_AR["s.overdue_receivables"])).toBeTruthy();
    /* حد 3: الرابع غائب + «عرض الكل» حاضر. */
    expect(screen.queryByText("رابع")).toBeNull();
    expect(
      screen.getByText(
        filled("s.overdue_receivable", {
          name: "أم خالد",
          amount: "18 د",
          age: MANAGE_STRINGS_AR["l.age_week2"],
        }),
      ),
    ).toBeTruthy();
    fireEvent.click(
      screen.getAllByRole("button", { name: MANAGE_STRINGS_AR["a.view_all"] })[
        screen.getAllByRole("button", { name: MANAGE_STRINGS_AR["a.view_all"] }).length - 1
      ]!,
    );
    expect(navigate).toHaveBeenCalledWith("/manage/balances?tab=to_me");
  });

  it("الفارغة الجديدة: الرصيد والأزرار السريعة فقط (G-13)", async () => {
    await renderReady(
      {
        receivables: moneyFigure(0),
        payables: moneyFigure(0),
        payablesPrepayments: moneyFigure(0),
        flags: { newUser: true, incompletePeriod: false, unknownBalance: false },
      },
      {},
      [],
    );
    expect(screen.getByText(filled("s.balance", { amount: "225 د" }))).toBeTruthy();
    expect(screen.queryByText(MANAGE_STRINGS_AR["s.today_orders"])).toBeNull();
    expect(screen.queryByText(MANAGE_STRINGS_AR["s.overdue_orders"])).toBeNull();
    expect(screen.queryByText(MANAGE_STRINGS_AR["s.overdue_receivables"])).toBeNull();
  });

  it("الأزرار السريعة C-07 بالترتيب الملزم الأربعة ووجهاتها", async () => {
    await renderReady();
    const order = ["op.sale", "op.collect_pay", "op.expense", "op.owner"] as const;
    for (const key of order) {
      expect(screen.getAllByRole("button", { name: MANAGE_STRINGS_AR[key] }).length).toBeGreaterThan(0);
    }
    fireEvent.click(screen.getAllByRole("button", { name: MANAGE_STRINGS_AR["op.sale"] })[0]!);
    expect(navigate).toHaveBeenCalledWith("/manage/op/sale");
  });

  it("404 الموحّد (لا مشروع): توجيه إلى P-01", async () => {
    projectApi.mockRejectedValueOnce(
      Object.assign(new Error("not found"), { status: 404, code: "not_found", details: undefined }),
    );
    figuresApi.mockResolvedValue(baseFigures());
    logApi.mockResolvedValue({ due: false, reconciliations: [] });
    rowsApi.mockResolvedValue({ sales: [] });
    render(<NowPage />);
    await waitFor(() => expect(navigate).toHaveBeenCalledWith("/manage/start"));
  });

  it("انقطاع الاتصال: E-OFFLINE (T56) بلا تحويل", async () => {
    projectApi.mockRejectedValueOnce(new TypeError("Failed to fetch"));
    figuresApi.mockResolvedValue(baseFigures());
    logApi.mockResolvedValue({ due: false, reconciliations: [] });
    rowsApi.mockResolvedValue({ sales: [] });
    render(<NowPage />);
    expect(await screen.findAllByText(MANAGE_STRINGS_AR["E-OFFLINE"])).not.toHaveLength(0);
    expect(navigate).not.toHaveBeenCalledWith("/manage/start");
  });
});
