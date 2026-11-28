/** @vitest-environment jsdom */

/*
 * M5.5 (UX P-37 «الصناديق» + P-38/P-39/P-40): الحالات الحرفية — قائمة
 * الصناديق بأزرارها بشرط ظهورها، إضافة الحساب (C-01 أو «لا أعرف الآن»)،
 * دمج الصندوقين بجملته ومانعه المجهول، وفصل الصندوقين (صفر مقبول وE-SPLIT
 * -AMOUNT من الخادم ومانع النقد المجهول).
 */
import React from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import BoxesPage from "@/pages/manage/BoxesPage";
import BoxAddPage from "@/pages/manage/BoxAddPage";
import BoxMergePage from "@/pages/manage/BoxMergePage";
import BoxSplitPage from "@/pages/manage/BoxSplitPage";
import { MANAGE_STRINGS_AR } from "@/application/manage/strings";
import { ApiError } from "@/application/network";
import * as api from "@/application/manage/api";
import type { ManageFiguresResponse } from "@/application/manage/api";

const navigate = vi.fn();
vi.mock("wouter", () => ({
  useLocation: () => ["/manage/boxes", navigate],
}));

vi.mock("@/application/manage/api", async importOriginal => {
  const actual = await importOriginal<typeof import("@/application/manage/api")>();
  return {
    ...actual,
    fetchManageFigures: vi.fn(),
    addManageBox: vi.fn(),
    mergeManageBoxes: vi.fn(),
    splitManageBoxes: vi.fn(),
  };
});

const figuresApi = vi.mocked(api.fetchManageFigures);
const addBoxApi = vi.mocked(api.addManageBox);
const mergeApi = vi.mocked(api.mergeManageBoxes);
const splitApi = vi.mocked(api.splitManageBoxes);

function figure(fils: number): { fils: number; text: string; textDashboard: string } {
  const text = `${fils < 0 ? "-" : ""}${Math.abs(Math.trunc(fils / 1000))}.${String(Math.abs(fils % 1000)).padStart(3, "0")} د`;
  const whole = fils % 1000 === 0;
  return { fils, text, textDashboard: whole ? `${Math.trunc(fils / 1000)} د` : text };
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
        balanceFils: 120_000,
        text: "120.000 د",
        textDashboard: "120 د",
      },
      {
        id: "b-account",
        kind: "account",
        status: "active",
        openingStatus: "known",
        balanceFils: 40_000,
        text: "40.000 د",
        textDashboard: "40 د",
      },
    ],
    totalBalance: figure(160_000),
    receivables: figure(0),
    payables: figure(0),
    payablesPrepayments: figure(0),
    whatYouHave: figure(160_000),
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
    netWorth: figure(160_000),
    netWorthSources: {
      openingFils: 160_000,
      openingText: "160.000 د",
      ownerDepositsFils: 0,
      ownerDepositsText: "0.000 د",
      ownerWithdrawalsFils: 0,
      ownerWithdrawalsText: "0.000 د",
      netProfitSinceStartFils: 0,
      netProfitSinceStartText: "0.000 د",
      unexplainedFils: 0,
      unexplainedText: "0.000 د",
      totalFils: 160_000,
      totalText: "160.000 د",
    },
    overdueReceivables: [],
    balanceLines: [],
    salesList: [],
    openSales: [],
    topSellers: [],
    topProfit: [],
    bars: [],
    flags: { newUser: false, incompletePeriod: false, unknownBalance: false },
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  figuresApi.mockResolvedValue(baseFigures());
});
afterEach(() => cleanup());

/* ── P-37 الصناديق ───────────────────────────────────────────────────── */

describe("M5.5 — P-37 الصناديق", () => {
  it("الرصيد الإجمالي وصفّا الصندوقين، وكل الأزرار الخمسة بشرطها مع صندوقين", async () => {
    render(<BoxesPage />);
    await waitFor(() => expect(screen.getByText(MANAGE_STRINGS_AR["s.boxes"])).toBeTruthy());
    expect(screen.getByText(MANAGE_STRINGS_AR["s.balance"].replace("{amount}", "160 د"))).toBeTruthy();
    expect(screen.getByText("نقد")).toBeTruthy();
    expect(screen.getByText("حساب")).toBeTruthy();
    expect(screen.getByText("120 د")).toBeTruthy();
    expect(screen.getByText("40 د")).toBeTruthy();
    /* الأزرار: تحويل ودمج (صندوقان) + ابدأ المطابقة (دائمًا)؛ لا إضافة ولا فصل. */
    expect(screen.getByText(MANAGE_STRINGS_AR["op.transfer"])).toBeTruthy();
    expect(screen.getByText(MANAGE_STRINGS_AR["a.merge"])).toBeTruthy();
    expect(screen.getByText(MANAGE_STRINGS_AR["a.start_recon"])).toBeTruthy();
    expect(screen.queryByText(MANAGE_STRINGS_AR["a.add_box"])).toBeNull();
    expect(screen.queryByText(MANAGE_STRINGS_AR["a.split"])).toBeNull();
    /* كبسة المطابقة ← P-50. */
    fireEvent.click(screen.getByText(MANAGE_STRINGS_AR["a.start_recon"]));
    expect(navigate).toHaveBeenCalledWith("/manage/reconcile");
  });

  it("صندوق واحد: زر الإضافة يظهر بلا تحويل ولا دمج؛ والسالب تنبيهه تحت الصندوق", async () => {
    figuresApi.mockResolvedValue(
      baseFigures({
        boxes: [
          {
            id: "b-cash",
            kind: "cash",
            status: "active",
            openingStatus: "known",
            balanceFils: -5_000,
            text: "-5.000 د",
            textDashboard: "-5.000 د",
          },
        ],
        totalBalance: figure(-5_000),
      }),
    );
    render(<BoxesPage />);
    await waitFor(() => expect(screen.getByText(MANAGE_STRINGS_AR["a.add_box"])).toBeTruthy());
    expect(screen.queryByText(MANAGE_STRINGS_AR["op.transfer"])).toBeNull();
    expect(screen.queryByText(MANAGE_STRINGS_AR["a.merge"])).toBeNull();
    /* تحت الصندوق المعروف السالب: w.negative_box. */
    expect(screen.getByText(MANAGE_STRINGS_AR["w.negative_box"])).toBeTruthy();
    fireEvent.click(screen.getByText(MANAGE_STRINGS_AR["a.add_box"]));
    expect(navigate).toHaveBeenCalledWith("/manage/boxes/add");
  });

  it("حساب مدموج: زر الفصل يظهر؛ ورصيد مجهول: N-37 ولا تنبيه سالب", async () => {
    figuresApi.mockResolvedValue(
      baseFigures({
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
            status: "merged",
            openingStatus: "known",
            balanceFils: 0,
            text: "0.000 د",
            textDashboard: "0 د",
          },
        ],
        totalBalance: figure(90_000),
      }),
    );
    const view = render(<BoxesPage />);
    await waitFor(() => expect(screen.getByText(MANAGE_STRINGS_AR["a.split"])).toBeTruthy());
    /* الحساب المدموج ليس صفًّا فعّالًا — صف واحد فقط. */
    expect(screen.queryByText("0 د")).toBeNull();
    view.unmount();

    figuresApi.mockResolvedValue(
      baseFigures({
        boxes: [
          {
            id: "b-cash",
            kind: "cash",
            status: "active",
            openingStatus: "known",
            balanceFils: 10_000,
            text: "10.000 د",
            textDashboard: "10 د",
          },
          {
            id: "b-account",
            kind: "account",
            status: "active",
            openingStatus: "unknown",
            balanceFils: null,
            balanceLabelKey: "l.unknown_balance",
          },
        ],
        totalBalance: { fils: null, labelKey: "l.unknown_balance" },
        flags: { newUser: false, incompletePeriod: true, unknownBalance: true },
      }),
    );
    render(<BoxesPage />);
    await waitFor(() => expect(screen.getByText(MANAGE_STRINGS_AR["s.balance_unknown"])).toBeTruthy());
    expect(screen.getByText(MANAGE_STRINGS_AR["l.unknown_balance"])).toBeTruthy();
    /* المجهول لا تنبيه سالب له. */
    expect(screen.queryByText(MANAGE_STRINGS_AR["w.negative_box"])).toBeNull();
  });
});

/* ── P-38 إضافة صندوق ────────────────────────────────────────────────── */

describe("M5.5 — P-38 إضافة صندوق", () => {
  it("«حساب» + «لا أعرف الآن» بتلميحه؛ الحفظ بلا مدخل معطّل ثم OP-ADD-BOX ← P-37", async () => {
    addBoxApi.mockResolvedValue({
      outcome: "applied",
      result: {
        operationId: "op",
        kind: "OP-ADD-BOX",
        effectiveOn: "2026-11-28",
        amountFils: 0,
        entryIds: [],
      },
    });
    render(<BoxAddPage />);
    const save = screen.getByText(MANAGE_STRINGS_AR["a.save"]).closest("button")!;
    expect(save.getAttribute("disabled")).not.toBeNull();
    /* «لا أعرف الآن» يفعّل الحفظ ويعطّل الحقل ويعرض التلميح. */
    fireEvent.click(screen.getByText(MANAGE_STRINGS_AR["t.unknown_now"]));
    expect(screen.getByText(MANAGE_STRINGS_AR["t.unknown_hint"])).toBeTruthy();
    expect(save.getAttribute("disabled")).toBeNull();
    fireEvent.click(save);
    await waitFor(() =>
      expect(addBoxApi).toHaveBeenCalledWith(
        expect.objectContaining({ kind: "account", opening: { unknown: true } }),
      ),
    );
    expect(navigate).toHaveBeenCalledWith("/manage/boxes");
  });

  it("مبلغ غير صالح: E-AMOUNT تحت الحقل ولا نداء (C-08: لا مسح)", async () => {
    render(<BoxAddPage />);
    const input = screen.getByTestId("manage-box-add-amount");
    fireEvent.change(input, { target: { value: "12.35.9" } });
    const save = screen.getByText(MANAGE_STRINGS_AR["a.save"]).closest("button")!;
    fireEvent.click(save);
    await waitFor(() => expect(screen.getByText(MANAGE_STRINGS_AR["E-AMOUNT"])).toBeTruthy());
    expect((input as HTMLInputElement).value).toBe("12.35.9");
    expect(addBoxApi).not.toHaveBeenCalled();
  });
});

/* ── P-39 دمج الصندوقين ──────────────────────────────────────────────── */

describe("M5.5 — P-39 دمج الصندوقين", () => {
  it("جملة «سيصبح رصيد النقد» بالرصيد الإجمالي؛ التأكيد → OP-MERGE-BOXES ← P-37", async () => {
    mergeApi.mockResolvedValue({
      outcome: "applied",
      result: {
        operationId: "op",
        kind: "OP-MERGE-BOXES",
        effectiveOn: "2026-11-28",
        amountFils: 0,
        entryIds: [],
      },
    });
    render(<BoxMergePage />);
    await waitFor(() =>
      expect(screen.getByText(MANAGE_STRINGS_AR["d.merge"].replace("{amount}", "160 د"))).toBeTruthy(),
    );
    fireEvent.click(screen.getByText(MANAGE_STRINGS_AR["a.confirm"]));
    await waitFor(() => expect(mergeApi).toHaveBeenCalledTimes(1));
    expect(navigate).toHaveBeenCalledWith("/manage/boxes");
  });

  it("رصيد مجهول: مكان التأكيد E-MERGE-UNKNOWN + «ابدأ المطابقة» ← P-50", async () => {
    figuresApi.mockResolvedValue(
      baseFigures({ flags: { newUser: false, incompletePeriod: true, unknownBalance: true } }),
    );
    render(<BoxMergePage />);
    await waitFor(() => expect(screen.getByText(MANAGE_STRINGS_AR["E-MERGE-UNKNOWN"])).toBeTruthy());
    expect(screen.queryByText(MANAGE_STRINGS_AR["a.confirm"])).toBeNull();
    fireEvent.click(screen.getByText(MANAGE_STRINGS_AR["a.start_recon"]));
    expect(navigate).toHaveBeenCalledWith("/manage/reconcile");
  });

  it("فشل الخادم: رسالة §11 ولا خروج (E-BOX-STATE مثالًا)", async () => {
    mergeApi.mockRejectedValue(
      new ApiError(400, { code: "e-box-state", message: "دولة", details: { code: "E-BOX-STATE" } }),
    );
    render(<BoxMergePage />);
    await waitFor(() => expect(screen.getByText(MANAGE_STRINGS_AR["a.confirm"])).toBeTruthy());
    fireEvent.click(screen.getByText(MANAGE_STRINGS_AR["a.confirm"]));
    await waitFor(() => expect(screen.getByText(MANAGE_STRINGS_AR["E-BOX-STATE"])).toBeTruthy());
    expect(navigate).not.toHaveBeenCalledWith("/manage/boxes");
  });
});

/* ── P-40 فصل الصندوقين ──────────────────────────────────────────────── */

describe("M5.5 — P-40 فصل الصندوقين", () => {
  it("«نقد» برصيده + «مبلغ الحساب» (صفر مقبول) → OP-SPLIT-BOXES ← P-37", async () => {
    splitApi.mockResolvedValue({
      outcome: "applied",
      result: {
        operationId: "op",
        kind: "OP-SPLIT-BOXES",
        effectiveOn: "2026-11-28",
        amountFils: 0,
        entryIds: [],
      },
    });
    render(<BoxSplitPage />);
    await waitFor(() => expect(screen.getByText("نقد: 120 د")).toBeTruthy());
    const save = screen.getByText(MANAGE_STRINGS_AR["a.confirm"]).closest("button")!;
    /* الفارغ يعطّل؛ الصفر مقبول. */
    expect(save.getAttribute("disabled")).not.toBeNull();
    fireEvent.change(screen.getByTestId("manage-box-split-amount"), { target: { value: "0" } });
    expect(save.getAttribute("disabled")).toBeNull();
    fireEvent.click(save);
    await waitFor(() => expect(splitApi).toHaveBeenCalledWith(expect.objectContaining({ amountFils: 0 })));
    expect(navigate).toHaveBeenCalledWith("/manage/boxes");
  });

  it("E-SPLIT-AMOUNT من الخادم تُعرض ولا خروج؛ ونقد مجهول: E-MERGE-UNKNOWN", async () => {
    splitApi.mockRejectedValue(
      new ApiError(400, { code: "e-split-amount", message: "مبلغ", details: { code: "E-SPLIT-AMOUNT" } }),
    );
    render(<BoxSplitPage />);
    await waitFor(() => expect(screen.getByText(MANAGE_STRINGS_AR["a.confirm"])).toBeTruthy());
    fireEvent.change(screen.getByTestId("manage-box-split-amount"), { target: { value: "500" } });
    fireEvent.click(screen.getByText(MANAGE_STRINGS_AR["a.confirm"]));
    await waitFor(() => expect(screen.getByText(MANAGE_STRINGS_AR["E-SPLIT-AMOUNT"])).toBeTruthy());
    expect(navigate).not.toHaveBeenCalledWith("/manage/boxes");
  });

  it("نقد مجهول الافتتاح: مكان التأكيد E-MERGE-UNKNOWN + «ابدأ المطابقة»", async () => {
    figuresApi.mockResolvedValue(
      baseFigures({
        boxes: [
          {
            id: "b-cash",
            kind: "cash",
            status: "active",
            openingStatus: "unknown",
            balanceFils: null,
            balanceLabelKey: "l.unknown_balance",
          },
          {
            id: "b-account",
            kind: "account",
            status: "merged",
            openingStatus: "known",
            balanceFils: 0,
            text: "0.000 د",
            textDashboard: "0 د",
          },
        ],
        flags: { newUser: false, incompletePeriod: true, unknownBalance: true },
      }),
    );
    render(<BoxSplitPage />);
    await waitFor(() => expect(screen.getByText(MANAGE_STRINGS_AR["E-MERGE-UNKNOWN"])).toBeTruthy());
    expect(screen.queryByText(MANAGE_STRINGS_AR["a.confirm"])).toBeNull();
    expect(screen.getByText(MANAGE_STRINGS_AR["a.start_recon"])).toBeTruthy();
  });
});
