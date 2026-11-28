/** @vitest-environment jsdom */

/*
 * M5.4 (UX P-30–P-36 + §8/§8.2): الحالات الحرفية لأسطح المالية — بطاقة
 * صافي القيمة فوق الفترة، أزرار الفترة، بطاقة صافي الربح بأسطرها الشرطية
 * وتوسيع أعمدة الربح، جمل الأعلى مبيعاً/ربحاً وأكبر بند مصروف، حالات
 * الربح والسحوبات الثلاث، قسم الصناديق، المستحقات والالتزامات، الحركات
 * (آخر 5 + عرض الكل)، قائمة الدخل P-31، المركز المالي P-32، مصادر صافي
 * القيمة P-33، وصف الحركة C-10.
 *
 * كل رقم في الاختبار نص الخادم نفسه — لا حساب في العميل (القاعدة الذهبية).
 */
import React from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import FinancePage from "@/pages/manage/FinancePage";
import IncomePage from "@/pages/manage/IncomePage";
import PositionPage from "@/pages/manage/PositionPage";
import SourcesPage from "@/pages/manage/SourcesPage";
import { ActivityRowView } from "@/components/manage/ActivityRowView";
import { MANAGE_STRINGS_AR } from "@/application/manage/strings";
import * as api from "@/application/manage/api";
import type { ActivityRow, ManageFiguresResponse } from "@/application/manage/api";

const navigate = vi.fn();
vi.mock("wouter", () => ({
  useLocation: () => ["/manage/finance", navigate],
  useSearch: () => "",
}));

vi.mock("@/application/manage/api", async importOriginal => {
  const actual = await importOriginal<typeof import("@/application/manage/api")>();
  return {
    ...actual,
    fetchManageFigures: vi.fn(),
    fetchRecentActivity: vi.fn(),
  };
});

const figuresApi = vi.mocked(api.fetchManageFigures);
const activityApi = vi.mocked(api.fetchRecentActivity);

function figure(fils: number): { fils: number; text: string; textDashboard: string } {
  const text = `${fils < 0 ? "-" : ""}${Math.abs(Math.trunc(fils / 1000))}.${String(Math.abs(fils % 1000)).padStart(3, "0")} د`;
  const whole = fils % 1000 === 0;
  return {
    fils,
    text,
    textDashboard: whole ? `${Math.trunc(fils / 1000)} د` : text,
  };
}

function baseFigures(overrides: Partial<ManageFiguresResponse> = {}): ManageFiguresResponse {
  return {
    period: { kind: "month", from: "2026-11-01", to: "2026-11-30", label: "11/2026", labelText: "11/2026" },
    boxes: [
      {
        id: "b1",
        kind: "cash",
        status: "active",
        openingStatus: "known",
        balanceFils: 120_000,
        text: "120.000 د",
        textDashboard: "120 د",
      },
    ],
    totalBalance: figure(120_000),
    receivables: figure(40_000),
    payables: figure(15_000),
    payablesPrepayments: figure(0),
    whatYouHave: figure(160_000),
    whatYouOwe: figure(15_000),
    whatYouOweBreakdown: [{ kind: "supplier", fils: 15_000, text: "15.000 د" }],
    sales: figure(250_000),
    returnsAndDiscounts: figure(-10_000),
    netSales: figure(240_000),
    netProfit: figure(75_000),
    expenses: figure(165_000),
    equipment: figure(0),
    personalWithdrawals: figure(10_000),
    ownerDeposits: figure(50_000),
    perTenRatio: { kind: "ratio", tenths: 31, text: "3.1" },
    biggestExpense: { category: "materials_packaging", fils: 120_000, text: "120.000 د" },
    expensesByCategory: [
      { category: "materials_packaging", fils: 120_000, text: "120.000 د" },
      { category: "gas", fils: 45_000, text: "45.000 د" },
    ],
    materialsAlert: true,
    unexplained: { fils: -5_000, shown: true, text: "-5.000 د" },
    netWorth: figure(145_000),
    netWorthSources: {
      openingFils: 0,
      openingText: "0.000 د",
      ownerDepositsFils: 50_000,
      ownerDepositsText: "50.000 د",
      ownerWithdrawalsFils: 10_000,
      ownerWithdrawalsText: "10.000 د",
      netProfitSinceStartFils: 100_000,
      netProfitSinceStartText: "100.000 د",
      unexplainedFils: 5_000,
      unexplainedText: "5.000 د",
      totalFils: 145_000,
      totalText: "145.000 د",
    },
    overdueReceivables: [],
    balanceLines: [],
    salesList: [],
    openSales: [],
    topSellers: [
      { productId: "p1", name: "منسف", valueFils: 150_000, quantityText: "10", unitLabel: "صينية" },
    ],
    topProfit: [{ productId: "p1", name: "منسف", profitFils: 40_000, perUnitText: "4" }],
    bars: [
      { label: "09/2026", from: "2026-09-01", to: "2026-09-30", netProfitFils: 20_000, incomplete: false },
      { label: "10/2026", from: "2026-10-01", to: "2026-10-31", netProfitFils: 30_000, incomplete: false },
      { label: "11/2026", from: "2026-11-01", to: "2026-11-30", netProfitFils: 75_000, incomplete: false },
    ],
    flags: { newUser: false, incompletePeriod: false, unknownBalance: false },
    ...overrides,
  };
}

function activityRow(overrides: Partial<ActivityRow> = {}): ActivityRow {
  return {
    operationId: "op-1",
    kind: "OP-SALE-CREATE",
    effectiveOn: "2026-11-25",
    name: "سامي",
    amountText: "25.000 د",
    deliveryCostText: null,
    boxKind: null,
    corrected: false,
    cancelled: false,
    saleId: "sale-1",
    saleStatus: "scheduled",
    variant: null,
    category: null,
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  figuresApi.mockResolvedValue(baseFigures());
  activityApi.mockResolvedValue({ activity: [] });
});
afterEach(() => cleanup());

/* ── P-30 المالية ────────────────────────────────────────────────────── */

describe("M5.4 — P-30 المالية", () => {
  it("صافي القيمة فوق الفترة، وأزرار الفترة الأربعة، وكل جملة بنص الخادم", async () => {
    activityApi.mockResolvedValue({ activity: [activityRow()] });
    render(<FinancePage />);
    await waitFor(() => expect(screen.getByText(MANAGE_STRINGS_AR["rep.networth"])).toBeTruthy());
    expect(screen.getByText(MANAGE_STRINGS_AR["c.networth"].replace("{amount}", "145 د"))).toBeTruthy();
    for (const key of ["p.week", "p.month", "p.year", "p.all"] as const) {
      expect(screen.getByText(MANAGE_STRINGS_AR[key])).toBeTruthy();
    }
    expect(screen.getByText(MANAGE_STRINGS_AR["c.profit"].replace("{amount}", "75 د"))).toBeTruthy();
    /* شرطية: المعدات صفر → السطر مخفي؛ الفرق غير المفسَّر ≠ 0 → يظهر. */
    expect(screen.queryByText(MANAGE_STRINGS_AR["c.equipment"].replace("{amount}", "0 د"))).toBeNull();
    expect(
      screen.getByText(MANAGE_STRINGS_AR["r.unexplained_less"].replace("{amount}", "-5.000 د")),
    ).toBeTruthy();
    /* الأعلى مبيعاً: «{product}: {amount} ({qty} {unit})». */
    expect(screen.getByText("منسف: 150 د (10 صينية)")).toBeTruthy();
    /* النسبة: {x} منزلة وحدة وبلا «د». */
    expect(
      screen.getByText(MANAGE_STRINGS_AR["c.ratio"].replace("{x}", "3.1").replace("{w}", "10 د")),
    ).toBeTruthy();
    /* الصناديق: الرصيد + كبسة ← P-37. */
    expect(screen.getByText(MANAGE_STRINGS_AR["s.balance"].replace("{amount}", "120 د"))).toBeTruthy();
    fireEvent.click(screen.getByText(MANAGE_STRINGS_AR["s.boxes"]));
    expect(navigate).toHaveBeenCalledWith("/manage/boxes");
  });

  it("الخسارة تستبدل جملة النسبة، وصافي المبيعات صفر يخفيها", async () => {
    figuresApi.mockResolvedValue(baseFigures({ perTenRatio: { kind: "loss", labelKey: "S-LOSS" } }));
    const view = render(<FinancePage />);
    await waitFor(() => expect(screen.getByText(MANAGE_STRINGS_AR["S-LOSS"])).toBeTruthy());
    expect(screen.queryByText(/من كل 10 دنانير/)).toBeNull();
    view.unmount();

    figuresApi.mockResolvedValue(
      baseFigures({ perTenRatio: { kind: "hidden", labelKey: "c.withdrawals_only" } }),
    );
    render(<FinancePage />);
    await waitFor(() =>
      expect(screen.getByText(MANAGE_STRINGS_AR["c.withdrawals_only"].replace("{w}", "10 د"))).toBeTruthy(),
    );
    expect(screen.queryByText(/من كل 10 دنانير/)).toBeNull();
  });

  it("مستخدم جديد: الفراغ G-13 مكان الفترة والبطاقات؛ وفترة بلا بيانات: الفراغ الحرفي", async () => {
    figuresApi.mockResolvedValue(
      baseFigures({ flags: { newUser: true, incompletePeriod: false, unknownBalance: false } }),
    );
    const view = render(<FinancePage />);
    await waitFor(() => expect(screen.getByText(MANAGE_STRINGS_AR["c.empty"])).toBeTruthy());
    expect(screen.queryByText(MANAGE_STRINGS_AR["p.week"])).toBeNull();
    view.unmount();

    figuresApi.mockResolvedValue(
      baseFigures({
        sales: figure(0),
        expenses: figure(0),
        netProfit: figure(0),
        biggestExpense: null,
        expensesByCategory: [],
      }),
    );
    render(<FinancePage />);
    await waitFor(() => expect(screen.getByText(MANAGE_STRINGS_AR["e.empty_period"])).toBeTruthy());
    expect(screen.queryByText(MANAGE_STRINGS_AR["c.profit"].replace("{amount}", "0 د"))).toBeNull();
  });

  it("رصيد مجهول: N-30 على صافي القيمة وl.unknown_balance بالصناديق", async () => {
    figuresApi.mockResolvedValue(
      baseFigures({
        flags: { newUser: false, incompletePeriod: true, unknownBalance: true },
        totalBalance: { fils: null, labelKey: "l.unknown_balance" },
        netWorth: { fils: null, labelKey: "l.unknown_balance" },
        netWorthSources: {
          openingFils: null,
          openingText: null,
          ownerDepositsFils: 50_000,
          ownerDepositsText: "50.000 د",
          ownerWithdrawalsFils: 10_000,
          ownerWithdrawalsText: "10.000 د",
          netProfitSinceStartFils: 100_000,
          netProfitSinceStartText: "100.000 د",
          unexplainedFils: 5_000,
          unexplainedText: "5.000 د",
          totalFils: null,
          totalText: null,
        },
      }),
    );
    render(<FinancePage />);
    await waitFor(() => expect(screen.getByText(MANAGE_STRINGS_AR["c.networth_unknown"])).toBeTruthy());
    expect(screen.getByText(MANAGE_STRINGS_AR["l.unknown_balance"])).toBeTruthy();
    expect(screen.queryByText(MANAGE_STRINGS_AR["s.balance"].replace("{amount}", "120 د"))).toBeNull();
  });

  it("توسيع بطاقة صافي الربح يظهر أعمدة الربح بتسميات R-21، وزر قائمة الدخل يفتح P-31 بالفترة", async () => {
    render(<FinancePage />);
    await waitFor(() => expect(screen.getByText(MANAGE_STRINGS_AR["rep.net_profit"])).toBeTruthy());
    fireEvent.click(screen.getByText(MANAGE_STRINGS_AR["rep.net_profit"]));
    expect(screen.getByText("09/2026")).toBeTruthy();
    expect(screen.getByText("10/2026")).toBeTruthy();
    fireEvent.click(screen.getByText(MANAGE_STRINGS_AR["rep.income_open"]));
    expect(navigate).toHaveBeenCalledWith("/manage/finance/income?period=month");
  });

  it("الحركات: آخر صفوف C-10 و«عرض الكل» يفتح P-41؛ القسم يختفي فارغًا", async () => {
    activityApi.mockResolvedValue({
      activity: [
        activityRow(),
        activityRow({
          operationId: "op-2",
          kind: "OP-EXPENSE",
          name: "غاز",
          category: "gas",
          saleId: null,
          saleStatus: null,
        }),
      ],
    });
    const view = render(<FinancePage />);
    await waitFor(() => expect(screen.getByText(MANAGE_STRINGS_AR["s.activity"])).toBeTruthy());
    expect(screen.getByText("25/11/2026 · سامي")).toBeTruthy();
    fireEvent.click(screen.getByText(MANAGE_STRINGS_AR["a.view_all"]));
    expect(navigate).toHaveBeenCalledWith("/manage/activity");
    view.unmount();

    activityApi.mockResolvedValue({ activity: [] });
    render(<FinancePage />);
    await waitFor(() => expect(screen.getByText(MANAGE_STRINGS_AR["s.balances"])).toBeTruthy());
    expect(screen.queryByText(MANAGE_STRINGS_AR["s.activity"])).toBeNull();
  });
});

/* ── P-31 قائمة الدخل ────────────────────────────────────────────────── */

describe("M5.4 — P-31 قائمة الدخل", () => {
  it("أرقام الفترة فقط: المبيعات والمرتجعات بإشارتها والتصنيفات وصافي الربح، والرجوع لـP-30", async () => {
    render(<IncomePage />);
    await waitFor(() => expect(screen.getByText(/قائمة الدخل · 11\/2026/)).toBeTruthy());
    expect(screen.getByText(`المبيعات: 250.000 د`)).toBeTruthy();
    /* المرتجعات بإشارة سالب من نص الخادم — لا علامة مضافة في العميل. */
    expect(screen.getByText("المرتجعات والخصومات: -10.000 د")).toBeTruthy();
    expect(screen.getByText(`صافي المبيعات: 240.000 د`)).toBeTruthy();
    expect(screen.getByText("المصاريف: 165.000 د")).toBeTruthy();
    expect(screen.getByText("غاز: 45.000 د")).toBeTruthy();
    expect(screen.getByText("صافي الربح: 75.000 د")).toBeTruthy();
    fireEvent.click(screen.getByText(MANAGE_STRINGS_AR["a.back"]));
    expect(navigate).toHaveBeenCalledWith("/manage/finance");
  });

  it("فترة فاضية: الفراغ الحرفي مكان الصفوف", async () => {
    figuresApi.mockResolvedValue(
      baseFigures({ sales: figure(0), expenses: figure(0), netProfit: figure(0) }),
    );
    render(<IncomePage />);
    await waitFor(() => expect(screen.getByText(MANAGE_STRINGS_AR["e.empty_period"])).toBeTruthy());
    expect(screen.queryByText(/صافي الربح:/)).toBeNull();
  });
});

/* ── P-32 المركز المالي ──────────────────────────────────────────────── */

describe("M5.4 — P-32 المركز المالي", () => {
  it("ما لديك وما عليك بتفصيله ومنه الدفعات المقدمة، ثم صافي القيمة وزر المصادر", async () => {
    figuresApi.mockResolvedValue(
      baseFigures({
        payablesPrepayments: figure(5_000),
        whatYouOweBreakdown: [
          { kind: "supplier", fils: 10_000, text: "10.000 د" },
          { kind: "prior_payable", fils: 5_000, text: "5.000 د" },
        ],
      }),
    );
    render(<PositionPage />);
    await waitFor(() => expect(screen.getByText(MANAGE_STRINGS_AR["rep.position"])).toBeTruthy());
    expect(screen.getByText("نقد: 120.000 د")).toBeTruthy();
    expect(screen.getByText(MANAGE_STRINGS_AR["s.receivables"].replace("{amount}", "40.000 د"))).toBeTruthy();
    expect(screen.getByText("مورد: 10.000 د")).toBeTruthy();
    expect(screen.getByText("التزام سابق: 5.000 د")).toBeTruthy();
    expect(screen.getByText("دفعة مقدمة: 5.000 د")).toBeTruthy();
    expect(screen.getByText(`ما لديك: 160.000 د`)).toBeTruthy();
    expect(screen.getByText(`ما عليك: 15.000 د`)).toBeTruthy();
    fireEvent.click(screen.getByText(MANAGE_STRINGS_AR["rep.sources"]));
    expect(navigate).toHaveBeenCalledWith("/manage/finance/sources");
  });
});

/* ── P-33 مصادر صافي القيمة ──────────────────────────────────────────── */

describe("M5.4 — P-33 مصادر صافي القيمة", () => {
  it("المصادر بنصوصها والمجموع نص الخادم، والفرق غير المفسَّر بشرطه", async () => {
    render(<SourcesPage />);
    await waitFor(() => expect(screen.getByText(MANAGE_STRINGS_AR["rep.sources"])).toBeTruthy());
    expect(screen.getByText("الرصيد الافتتاحي: 0.000 د")).toBeTruthy();
    expect(screen.getByText("الإيداعات الشخصية: 50.000 د")).toBeTruthy();
    expect(screen.getByText("السحوبات الشخصية: 10.000 د")).toBeTruthy();
    expect(screen.getByText("صافي الربح منذ البداية: 100.000 د")).toBeTruthy();
    expect(screen.getByText("الفرق غير المفسَّر: 5.000 د")).toBeTruthy();
    expect(screen.getByText("صافي قيمة المشروع: 145.000 د")).toBeTruthy();
    fireEvent.click(screen.getByText(MANAGE_STRINGS_AR["a.back"]));
    expect(navigate).toHaveBeenCalledWith("/manage/finance/position");
  });

  it("رصيد مجهول: الرصيد الافتتاحي وصافي القيمة «غير معروف حتى المطابقة»", async () => {
    figuresApi.mockResolvedValue(
      baseFigures({
        flags: { newUser: false, incompletePeriod: true, unknownBalance: true },
        netWorth: { fils: null, labelKey: "l.unknown_balance" },
        netWorthSources: {
          openingFils: null,
          openingText: null,
          ownerDepositsFils: 50_000,
          ownerDepositsText: "50.000 د",
          ownerWithdrawalsFils: 10_000,
          ownerWithdrawalsText: "10.000 د",
          netProfitSinceStartFils: 100_000,
          netProfitSinceStartText: "100.000 د",
          unexplainedFils: 5_000,
          unexplainedText: "5.000 د",
          totalFils: null,
          totalText: null,
        },
      }),
    );
    render(<SourcesPage />);
    await waitFor(() => expect(screen.getByText(MANAGE_STRINGS_AR["rep.sources"])).toBeTruthy());
    expect(screen.getAllByText(/غير معروف حتى المطابقة/).length).toBe(2);
    expect(screen.queryByText(/صافي قيمة المشروع: 145/)).toBeNull();
  });
});

/* ── C-10 صف الحركة ──────────────────────────────────────────────────── */

describe("M5.4 — C-10 صف الحركة", () => {
  it("التاريخ R-21 والنوع والاسم والمبلغ وحالة الطلب، والصندوق مع صندوقين فقط", () => {
    const view = render(
      <ActivityRowView row={activityRow({ boxKind: "cash", corrected: true })} twoBoxes={false} />,
    );
    expect(screen.getByText(new RegExp(MANAGE_STRINGS_AR["op.sale"]))).toBeTruthy();
    expect(screen.getByText("25/11/2026 · سامي")).toBeTruthy();
    expect(screen.getByText("25.000 د")).toBeTruthy();
    /* صندوق واحد: لا صندوق في السطر. */
    expect(screen.queryByText(/نقد/)).toBeNull();
    view.unmount();

    render(<ActivityRowView row={activityRow({ boxKind: "cash" })} twoBoxes />);
    expect(screen.getByText(/25\/11\/2026 · سامي · نقد/)).toBeTruthy();
  });

  it("«معدَّلة» و«ملغاة» تعرضان، والمصروف بتصنيفه و«منها توصيل»", () => {
    render(
      <ActivityRowView
        row={activityRow({
          kind: "OP-EXPENSE",
          name: "غاز",
          category: "gas",
          saleId: null,
          saleStatus: null,
          deliveryCostText: "2.500 د",
          corrected: true,
          cancelled: true,
        })}
        twoBoxes={false}
      />,
    );
    expect(screen.getByText(/^غاز · معدَّلة · ملغاة$/)).toBeTruthy();
    expect(
      screen.getByText(MANAGE_STRINGS_AR["l.delivery_part"].replace("{amount}", "2.500 د")),
    ).toBeTruthy();
  });

  it("كبسة صف البيع تفتح P-21، وغيره يفتح P-42", () => {
    const view = render(<ActivityRowView row={activityRow()} twoBoxes={false} />);
    fireEvent.click(screen.getByRole("button"));
    expect(navigate).toHaveBeenCalledWith("/manage/sale/sale-1");
    view.unmount();

    render(
      <ActivityRowView
        row={activityRow({ kind: "OP-OWNER-DEPOSIT", saleId: null, saleStatus: null })}
        twoBoxes={false}
      />,
    );
    fireEvent.click(screen.getByRole("button"));
    expect(navigate).toHaveBeenCalledWith("/manage/activity/op-1");
  });
});
