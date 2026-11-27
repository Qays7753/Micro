/** @vitest-environment jsdom */

/*
 * M5.2 (UX P-11/P-12/P-13/P-14): الإعدادات (R-17) وتدفق العودة بعد
 * الانقطاع (§7.2) — الجملة المحايدة بلا شارة «متأخر» ولا ألوان تحذير،
 * الأزرار الثلاثة بنفس الوزن، انطواء البطاقة، القفز فوق الصفحات الفارغة،
 * التسوية الفورية بصندوق واحد (استثناء R-26) وP-14 لصندوقين، و«لاحقاً»
 * يعيد مع بقاء البطاقة (G-11).
 */
import React from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import SettingsPage from "@/pages/manage/SettingsPage";
import ReturnOrdersPage from "@/pages/manage/ReturnOrdersPage";
import ReturnBalancesPage from "@/pages/manage/ReturnBalancesPage";
import ReturnConfirmPage from "@/pages/manage/ReturnConfirmPage";
import { MANAGE_STRINGS_AR } from "@/application/manage/strings";
import * as api from "@/application/manage/api";
import type { ManageFiguresResponse, SaleRow } from "@/application/manage/api";

const navigate = vi.fn();
/** سلسلة البحث قابلة للتوجيه لكل اختبار (P-14 يقرأ ?line=). */
let searchValue = "?line=l1";
vi.mock("wouter", () => ({
  useLocation: () => ["/manage/settings", navigate],
  useSearch: () => searchValue,
}));
vi.mock("@/application/time", () => ({ todayInAmman: () => "2026-11-29" }));
vi.mock("@/application/manage/api", async importOriginal => {
  const actual = await importOriginal<typeof import("@/application/manage/api")>();
  return {
    ...actual,
    fetchManageProject: vi.fn(),
    fetchManageFigures: vi.fn(),
    fetchManageSaleRows: vi.fn(),
    renameProject: vi.fn(),
    collectPayment: vi.fn(),
    payDebt: vi.fn(),
  };
});

const projectApi = vi.mocked(api.fetchManageProject);
const figuresApi = vi.mocked(api.fetchManageFigures);
const rowsApi = vi.mocked(api.fetchManageSaleRows);
const renameApi = vi.mocked(api.renameProject);
const collectApi = vi.mocked(api.collectPayment);
const payApi = vi.mocked(api.payDebt);

function figuresWith(
  lines: Array<{
    id: string;
    direction: string;
    kind: string;
    counterpartyName: string | null;
    originOn: string;
    outstandingFils: number;
    overdue: boolean;
    text: string;
  }>,
  boxes = 1,
) {
  return {
    period: { kind: "month", from: "x", to: "y", label: "l", labelText: "l" },
    boxes:
      boxes === 1
        ? [
            {
              id: "b1",
              kind: "cash",
              status: "active",
              openingStatus: "known",
              balanceFils: 100_000,
              text: "100.000 د",
              textDashboard: "100 د",
            },
          ]
        : [
            {
              id: "b1",
              kind: "cash",
              status: "active",
              openingStatus: "known",
              balanceFils: 100_000,
              text: "100.000 د",
              textDashboard: "100 د",
            },
            {
              id: "b2",
              kind: "account",
              status: "active",
              openingStatus: "known",
              balanceFils: 50_000,
              text: "50.000 د",
              textDashboard: "50 د",
            },
          ],
    totalBalance: { fils: 100_000, text: "100.000 د", textDashboard: "100 د" },
    receivables: { fils: 0, text: "0", textDashboard: "0" },
    payables: { fils: 0, text: "0", textDashboard: "0" },
    payablesPrepayments: { fils: 0, text: "0", textDashboard: "0" },
    whatYouHave: { fils: 0, text: "0", textDashboard: "0" },
    whatYouOwe: { fils: 0, text: "0", textDashboard: "0" },
    whatYouOweBreakdown: [],
    sales: { fils: 0, text: "0", textDashboard: "0" },
    returnsAndDiscounts: { fils: 0, text: "0", textDashboard: "0" },
    netSales: { fils: 0, text: "0", textDashboard: "0" },
    netProfit: { fils: 0, text: "0", textDashboard: "0" },
    expenses: { fils: 0, text: "0", textDashboard: "0" },
    equipment: { fils: 0, text: "0", textDashboard: "0" },
    personalWithdrawals: { fils: 0, text: "0", textDashboard: "0" },
    ownerDeposits: { fils: 0, text: "0", textDashboard: "0" },
    perTenRatio: { perTenText: "", shown: false },
    biggestExpense: null,
    expensesByCategory: [],
    materialsAlert: false,
    unexplained: { fils: 0, shown: false, text: "" },
    netWorth: { fils: 0, text: "0", textDashboard: "0" },
    netWorthSources: null,
    overdueReceivables: [],
    balanceLines: lines,
    salesList: [],
    openSales: [],
    topSellers: [],
    topProfit: [],
    bars: [],
    flags: { newUser: false, incompletePeriod: false, unknownBalance: false },
  } as unknown as ManageFiguresResponse;
}

function saleRow(overrides: Partial<SaleRow> = {}): SaleRow {
  return {
    id: "s1",
    status: "overdue",
    customerName: "أبو أحمد",
    firstLineDescription: "مقلوبة",
    plannedDeliveryOn: "2026-11-20",
    deliveredOn: null,
    tracked: true,
    hiddenFromTracker: false,
    paidFils: 10_000,
    ofFils: 36_000,
    fullAmountFils: 26_000,
    ...overrides,
  };
}

beforeEach(() => {
  navigate.mockReset();
  projectApi.mockReset();
  figuresApi.mockReset();
  rowsApi.mockReset();
  renameApi.mockReset();
  collectApi.mockReset();
  payApi.mockReset();
});

afterEach(cleanup);

describe("M5.2 — P-11 الإعدادات (R-17)", () => {
  it("يعرض الاسم الحالي معبّى و«حفظ» يعيد التسمية ثم يعود", async () => {
    projectApi.mockResolvedValue({ projectId: "p1", name: "الاسم القديم", openAbsence: null });
    renameApi.mockResolvedValue({ projectId: "p1", name: "الاسم الجديد" });
    render(<SettingsPage />);
    const field = (await screen.findByTestId("manage-settings-name")) as HTMLInputElement;
    expect(field.value).toBe("الاسم القديم");
    fireEvent.change(field, { target: { value: "الاسم الجديد" } });
    fireEvent.click(screen.getByRole("button", { name: MANAGE_STRINGS_AR["a.save"] }));
    await waitFor(() => expect(renameApi).toHaveBeenCalledWith("الاسم الجديد"));
    await waitFor(() => expect(navigate).toHaveBeenCalledWith("/"));
  });

  it("اسم فارغ: E-NAME-REQUIRED تحت الحقل ولا نداء", async () => {
    projectApi.mockResolvedValue({ projectId: "p1", name: "س", openAbsence: null });
    render(<SettingsPage />);
    const field = (await screen.findByTestId("manage-settings-name")) as HTMLInputElement;
    fireEvent.change(field, { target: { value: " " } });
    fireEvent.click(screen.getByRole("button", { name: MANAGE_STRINGS_AR["a.save"] }));
    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toContain(MANAGE_STRINGS_AR["E-NAME-REQUIRED"]);
    expect(renameApi).not.toHaveBeenCalled();
  });
});

describe("M5.2 — P-12 العودة: الطلبات المتأخرة (§7.2)", () => {
  it("بطاقة لكل متأخر بثلاثة أزرار بنفس الوزن — بلا شارة «متأخر» ولا ألوان تحذير", async () => {
    projectApi.mockResolvedValue({
      projectId: "p1",
      name: "م",
      openAbsence: { startedOn: "2026-11-09", endedOn: "2026-11-29", daysSinceLastRecord: 20 },
    });
    rowsApi.mockResolvedValue({ sales: [saleRow()] });
    render(<ReturnOrdersPage />);
    expect(
      await screen.findByText(MANAGE_STRINGS_AR["r.absence_intro"].replace("{days}", "20")),
    ).toBeTruthy();
    expect(screen.getByText(MANAGE_STRINGS_AR["s.overdue_orders"])).toBeTruthy();
    expect(screen.getByRole("button", { name: MANAGE_STRINGS_AR["a.deliver"] })).toBeTruthy();
    expect(screen.getByRole("button", { name: MANAGE_STRINGS_AR["r.cancelled"] })).toBeTruthy();
    expect(screen.getByRole("button", { name: MANAGE_STRINGS_AR["r.still_open"] })).toBeTruthy();
    /* البطاقة المتأخرة بلا شارة الحالة المتأخرة (لا تحذير). */
    expect(screen.queryByText(MANAGE_STRINGS_AR["st.overdue"])).toBeNull();
  });

  it("«التالي» → P-13 و«لاحقاً» → P-10؛ وإجابة آخر بطاقة تقفز تلقائيًا (الصفحة لا تُعرض فارغة)", async () => {
    projectApi.mockResolvedValue({
      projectId: "p1",
      name: "م",
      openAbsence: { startedOn: "2026-11-09", endedOn: "2026-11-29", daysSinceLastRecord: 20 },
    });
    rowsApi.mockResolvedValue({
      sales: [saleRow({ id: "s-twobuttons" }), saleRow({ id: "s-twobuttons-2", customerName: "سلمى" })],
    });
    render(<ReturnOrdersPage />);
    await screen.findByText("أبو أحمد");
    fireEvent.click(screen.getByRole("button", { name: MANAGE_STRINGS_AR["a.next"] }));
    expect(navigate).toHaveBeenCalledWith("/manage/return/balances");
    fireEvent.click(screen.getByRole("button", { name: MANAGE_STRINGS_AR["a.later"] }));
    expect(navigate).toHaveBeenCalledWith("/");
    /* إجالة البطاقة الوحيدة المتبقية (بطاقة واحدة بعد انطواء سابقتها في
     * الترتيب) — انطواء آخر بطاقة يقفز للصفحة التالية كما عند الدخول
     * الفارغ. */
    fireEvent.click(screen.getAllByRole("button", { name: MANAGE_STRINGS_AR["r.still_open"] })[0]!);
    fireEvent.click(screen.getAllByRole("button", { name: MANAGE_STRINGS_AR["r.still_open"] })[0]!);
    await waitFor(() => expect(navigate).toHaveBeenCalledWith("/manage/return/balances"));
  });

  it("لا متأخرة: الصفحة ما بتبين — قفز مباشر لـP-13", async () => {
    projectApi.mockResolvedValue({ projectId: "p1", name: "م", openAbsence: null });
    rowsApi.mockResolvedValue({ sales: [saleRow({ status: "scheduled", plannedDeliveryOn: "2026-12-01" })] });
    render(<ReturnOrdersPage />);
    await waitFor(() => expect(navigate).toHaveBeenCalledWith("/manage/return/balances"));
  });
});

describe("M5.2 — P-13 العودة: المستحقات والالتزامات المفتوحة", () => {
  const lines = [
    {
      id: "l1",
      direction: "to_me",
      kind: "sale_remainder",
      counterpartyName: "أم خالد",
      originOn: "2026-11-13",
      outstandingFils: 18_000,
      overdue: true,
      text: "18.000 د",
    },
    {
      id: "l2",
      direction: "by_me",
      kind: "supplier",
      counterpartyName: "مطبعة النور",
      originOn: "2026-11-01",
      outstandingFils: 120_000,
      overdue: false,
      text: "120.000 د",
    },
  ];

  it("قسما «لك» و«عليك» ببطاقات الاسم والمتبقي والعمر؛ الفارغة → P-50", async () => {
    projectApi.mockResolvedValue({ projectId: "p1", name: "م", openAbsence: null });
    figuresApi.mockResolvedValue(figuresWith(lines));
    render(<ReturnBalancesPage />);
    expect(await screen.findByText(MANAGE_STRINGS_AR["t.to_me"])).toBeTruthy();
    expect(screen.getByText(MANAGE_STRINGS_AR["t.by_me"])).toBeTruthy();
    expect(screen.getByText("أم خالد")).toBeTruthy();
    expect(screen.getByText(MANAGE_STRINGS_AR["l.age_week2"])).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: MANAGE_STRINGS_AR["a.next"] }));
    expect(navigate).toHaveBeenCalledWith("/manage/reconcile?context=return_after_absence");
  });

  it("صندوق واحد: «حُصِّل أو سُدِّد» ينفّذ فورًا بكامل المتبقي بتاريخ اليوم (R-26)", async () => {
    projectApi.mockResolvedValue({ projectId: "p1", name: "م", openAbsence: null });
    figuresApi.mockResolvedValueOnce(figuresWith(lines));
    figuresApi.mockResolvedValueOnce(figuresWith([lines[1]!]));
    collectApi.mockResolvedValue({
      outcome: "applied",
      result: {
        operationId: "op1",
        kind: "OP-COLLECT",
        effectiveOn: "2026-11-29",
        amountFils: 18_000,
        entryIds: [],
      },
    });
    render(<ReturnBalancesPage />);
    const settleButtons = await screen.findAllByRole("button", { name: MANAGE_STRINGS_AR["r.settled"] });
    fireEvent.click(settleButtons[0]!);
    await waitFor(() =>
      expect(collectApi).toHaveBeenCalledWith(
        expect.objectContaining({
          amountFils: 18_000,
          box: "cash",
          balanceLineId: "l1",
          effectiveOn: "2026-11-29",
        }),
      ),
    );
    await waitFor(() => expect(screen.queryByText("أم خالد")).toBeNull());
  });

  it("صندوقان: «حُصِّل أو سُدِّد» يفتح P-14 (اختيار الصندوق)", async () => {
    projectApi.mockResolvedValue({ projectId: "p1", name: "م", openAbsence: null });
    const fresh = [
      { ...lines[0]!, id: "l-twins-1" },
      { ...lines[1]!, id: "l-twins-2" },
    ];
    figuresApi.mockResolvedValue(figuresWith(fresh, 2));
    render(<ReturnBalancesPage />);
    const settleButtons = await screen.findAllByRole("button", { name: MANAGE_STRINGS_AR["r.settled"] });
    fireEvent.click(settleButtons[0]!);
    expect(navigate).toHaveBeenCalledWith("/manage/return/confirm?line=l-twins-1");
  });
});

describe("M5.2 — P-14 تأكيد التسوية (صندوقان)", () => {
  const lines = [
    {
      id: "l1",
      direction: "to_me",
      kind: "sale_remainder",
      counterpartyName: "أم خالد",
      originOn: "2026-11-13",
      outstandingFils: 18_000,
      overdue: true,
      text: "18.000 د",
    },
  ];

  it("الاسم والمبلغ للعرض (غير قابل للتعديل) + C-02 + «تأكيد» ينفّذ ويعود لـP-13", async () => {
    figuresApi.mockResolvedValue(figuresWith(lines, 2));
    collectApi.mockResolvedValue({
      outcome: "applied",
      result: {
        operationId: "op1",
        kind: "OP-COLLECT",
        effectiveOn: "2026-11-29",
        amountFils: 18_000,
        entryIds: [],
      },
    });
    render(<ReturnConfirmPage />);
    expect(await screen.findByText(`أم خالد · 18.000 د`)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: MANAGE_STRINGS_AR["f.account"] }));
    fireEvent.click(screen.getByRole("button", { name: MANAGE_STRINGS_AR["a.confirm"] }));
    await waitFor(() =>
      expect(collectApi).toHaveBeenCalledWith(
        expect.objectContaining({ amountFils: 18_000, box: "account", balanceLineId: "l1" }),
      ),
    );
    await waitFor(() => expect(navigate).toHaveBeenCalledWith("/manage/return/balances"));
  });

  it("سداد خط «عليك» يستدعي OP-PAY لا OP-COLLECT", async () => {
    searchValue = "?line=l2";
    figuresApi.mockResolvedValue(
      figuresWith(
        [
          {
            id: "l2",
            direction: "by_me",
            kind: "supplier",
            counterpartyName: "مطبعة النور",
            originOn: "2026-11-01",
            outstandingFils: 120_000,
            overdue: false,
            text: "120.000 د",
          },
        ],
        2,
      ),
    );
    payApi.mockResolvedValue({
      outcome: "applied",
      result: {
        operationId: "op2",
        kind: "OP-PAY",
        effectiveOn: "2026-11-29",
        amountFils: 120_000,
        entryIds: [],
      },
    });
    render(<ReturnConfirmPage />);
    await screen.findByText("مطبعة النور · 120.000 د");
    fireEvent.click(screen.getByRole("button", { name: MANAGE_STRINGS_AR["a.confirm"] }));
    await waitFor(() => expect(payApi).toHaveBeenCalled());
    expect(collectApi).not.toHaveBeenCalled();
  });
});
