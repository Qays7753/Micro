/** @vitest-environment jsdom */

/*
 * M5.7 (UX P-50–P-53): نافذة المطابقة — الجملة بفروق الخادم، مطابق/غير
 * مطابق لكل صندوق والمجهول إجباري بلا «مطابق»، التالي بالفروق الثلاثة
 * (كله صفر ← إنهاء؛ فرقان بعكس بعض ← اقتراح §7.1-2؛ وإلا أسئلة الفرق)،
 * وتأكيد التحويل، وإنهاء Q19 والنتيجة، ولاحقًا بلا حفظ.
 */
import React from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import ReconcilePage from "@/pages/manage/ReconcilePage";
import { MANAGE_STRINGS_AR } from "@/application/manage/strings";
import * as api from "@/application/manage/api";
import type { ManageFiguresResponse } from "@/application/manage/api";

const navigate = vi.fn();
vi.mock("wouter", () => ({
  useLocation: () => ["/manage/reconcile", navigate],
}));

vi.mock("@/application/manage/api", async importOriginal => {
  const actual = await importOriginal<typeof import("@/application/manage/api")>();
  return {
    ...actual,
    fetchManageFigures: vi.fn(),
    fetchReconcileDiff: vi.fn(),
    finishReconcile: vi.fn(),
    transferBetweenBoxes: vi.fn(),
  };
});

const figuresApi = vi.mocked(api.fetchManageFigures);
const diffApi = vi.mocked(api.fetchReconcileDiff);
const finishApi = vi.mocked(api.finishReconcile);
const transferApi = vi.mocked(api.transferBetweenBoxes);

function figure(fils: number): { fils: number; text: string; textDashboard: string } {
  const text = `${Math.trunc(fils / 1000)}.000 د`;
  return { fils, text, textDashboard: fils % 1000 === 0 ? `${Math.trunc(fils / 1000)} د` : text };
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
        balanceFils: 300_000,
        text: "300.000 د",
        textDashboard: "300 د",
      },
      {
        id: "b-account",
        kind: "account",
        status: "active",
        openingStatus: "known",
        balanceFils: 50_000,
        text: "50.000 د",
        textDashboard: "50 د",
      },
    ],
    totalBalance: figure(350_000),
    receivables: figure(0),
    payables: figure(0),
    payablesPrepayments: figure(0),
    whatYouHave: figure(350_000),
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
    netWorth: figure(350_000),
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

function diffResponse(
  boxes: Array<{ boxId: string; kind: "cash" | "account"; recordedFils: number | null; countedFils: number }>,
) {
  const rows = boxes.map(box => {
    const delta = box.recordedFils === null ? 0 : box.countedFils - box.recordedFils;
    const sign = delta < 0 ? "-" : "";
    return {
      boxId: box.boxId,
      kind: box.kind,
      recordedFils: box.recordedFils,
      recordedText: box.recordedFils === null ? null : `${box.recordedFils / 1000}.000 د`,
      countedFils: box.countedFils,
      countedText: `${box.countedFils / 1000}.000 د`,
      deltaFils: delta,
      deltaText: `${sign}${Math.abs(delta) / 1000}.000 د`,
    };
  });
  const positive = rows.find(r => r.deltaFils > 0);
  const negative = rows.find(r => r.deltaFils < 0);
  const proposal =
    positive !== undefined && negative !== undefined
      ? {
          fromBox: negative.kind,
          toBox: positive.kind,
          amountFils: Math.min(positive.deltaFils, -negative.deltaFils),
          amountText: `${Math.min(positive.deltaFils, -negative.deltaFils) / 1000}.000 د`,
        }
      : null;
  return { boxes: rows, allZero: rows.every(r => r.deltaFils === 0), transferProposal: proposal };
}

beforeEach(() => {
  vi.clearAllMocks();
  figuresApi.mockResolvedValue(baseFigures());
});
afterEach(() => cleanup());

describe("M5.7 — P-50 الأرصدة", () => {
  it("الجملة بالتفصيل وصندوقان: مطابق يسجّل المسجَّل وغير المطابق حقلًا؛ لاحقًا يخرج بلا حفظ", async () => {
    render(<ReconcilePage />);
    await waitFor(() =>
      expect(
        screen.getByText(
          MANAGE_STRINGS_AR["r.prompt"]
            .replace("{total}", "350 د")
            .replace("{breakdown}", "نقد 300 د · حساب 50 د"),
        ),
      ).toBeTruthy(),
    );
    /* مطابق للنقد. */
    fireEvent.click(screen.getAllByText(MANAGE_STRINGS_AR["r.match"])[0]!);
    /* لاحقًا — خروج بلا حفظ. */
    fireEvent.click(screen.getByText(MANAGE_STRINGS_AR["d.recon_later"]));
    expect(navigate).toHaveBeenCalledWith("/");
    expect(finishApi).not.toHaveBeenCalled();
  });

  it("المجهول: بلا جملة وبلا «مطابق» والموجود إجباري", async () => {
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
        ],
        totalBalance: { fils: null, labelKey: "l.unknown_balance" },
        flags: { newUser: false, incompletePeriod: true, unknownBalance: true },
      }),
    );
    render(<ReconcilePage />);
    await waitFor(() => expect(screen.getByText(/غير معروف حتى المطابقة/)).toBeTruthy());
    expect(screen.queryByText(MANAGE_STRINGS_AR["r.match"])).toBeNull();
    expect(screen.queryByText(/رصيدك المسجَّل/)).toBeNull();
  });
});

describe("M5.7 — التالي: الفروق الثلاثة", () => {
  it("كله مطابق ← إنهاء مباشر ← النتيجة (لا Q19)", async () => {
    diffApi.mockResolvedValue(
      diffResponse([
        { boxId: "b-cash", kind: "cash", recordedFils: 300_000, countedFils: 300_000 },
        { boxId: "b-account", kind: "account", recordedFils: 50_000, countedFils: 50_000 },
      ]),
    );
    finishApi.mockResolvedValue({
      outcome: "applied",
      result: {
        operationId: "op",
        kind: "OP-RECONCILE",
        effectiveOn: "2026-11-28",
        amountFils: 0,
        entryIds: [],
      },
    });
    render(<ReconcilePage />);
    await waitFor(() => screen.getByText(MANAGE_STRINGS_AR["a.next"]));
    fireEvent.click(screen.getAllByText(MANAGE_STRINGS_AR["r.match"])[0]!);
    fireEvent.click(screen.getAllByText(MANAGE_STRINGS_AR["r.match"])[1]!);
    fireEvent.click(screen.getByText(MANAGE_STRINGS_AR["a.next"]));
    await waitFor(() =>
      expect(finishApi).toHaveBeenCalledWith(expect.objectContaining({ context: "routine" })),
    );
    await waitFor(() => expect(screen.getByText(MANAGE_STRINGS_AR["d.recon_done"])).toBeTruthy());
  });

  it("فرقان بعكس بعض ← P-51 باقتراح §7.1-2؛ التأكيد يحوّل ثم أسئلة الفرق", async () => {
    diffApi.mockResolvedValueOnce(
      diffResponse([
        { boxId: "b-cash", kind: "cash", recordedFils: 300_000, countedFils: 290_000 },
        { boxId: "b-account", kind: "account", recordedFils: 50_000, countedFils: 60_000 },
      ]),
    );
    transferApi.mockResolvedValue({
      outcome: "applied",
      result: {
        operationId: "op",
        kind: "OP-TRANSFER",
        effectiveOn: "2026-11-28",
        amountFils: 10_000,
        entryIds: [],
      },
    });
    diffApi.mockResolvedValueOnce(
      diffResponse([
        { boxId: "b-cash", kind: "cash", recordedFils: 300_000, countedFils: 290_000 },
        { boxId: "b-account", kind: "account", recordedFils: 50_000, countedFils: 60_000 },
      ]),
    );
    render(<ReconcilePage />);
    await waitFor(() => screen.getByText(MANAGE_STRINGS_AR["a.next"]));
    fireEvent.change(screen.getByTestId("manage-recon-count-cash"), { target: { value: "290.000" } });
    fireEvent.change(screen.getByTestId("manage-recon-count-account"), { target: { value: "60.000" } });
    fireEvent.click(screen.getByText(MANAGE_STRINGS_AR["a.next"]));
    await waitFor(() =>
      expect(
        screen.getByText(
          MANAGE_STRINGS_AR["S-RECON-TRANSFER"]
            .replace("{amount}", "10.000 د")
            .replace("{from}", "نقد")
            .replace("{to}", "حساب"),
        ),
      ).toBeTruthy(),
    );
    fireEvent.click(screen.getByText(MANAGE_STRINGS_AR["a.confirm"]));
    await waitFor(() =>
      expect(transferApi).toHaveBeenCalledWith(
        expect.objectContaining({ fromBox: "cash", toBox: "account", amountFils: 10_000 }),
      ),
    );
  });

  it("نقص واحد ← P-52 بأسئلته وسطر التذكير وإنهاء Q19 ← النتيجة بالفرق", async () => {
    const response = diffResponse([
      { boxId: "b-cash", kind: "cash", recordedFils: 300_000, countedFils: 295_000 },
    ]);
    diffApi.mockResolvedValue(response);
    finishApi.mockResolvedValue({
      outcome: "applied",
      result: {
        operationId: "op",
        kind: "OP-RECONCILE",
        effectiveOn: "2026-11-28",
        amountFils: 5_000,
        entryIds: [],
      },
    });
    render(<ReconcilePage />);
    await waitFor(() => screen.getByText(MANAGE_STRINGS_AR["a.next"]));
    fireEvent.change(screen.getByTestId("manage-recon-count-cash"), { target: { value: "295.000" } });
    fireEvent.click(screen.getAllByText(MANAGE_STRINGS_AR["r.match"])[1]!);
    fireEvent.click(screen.getByText(MANAGE_STRINGS_AR["a.next"]));
    await waitFor(() => expect(screen.getByText(/يوجد نقص 5\.000 د/)).toBeTruthy());
    expect(screen.getByText(MANAGE_STRINGS_AR["r.less.expense"])).toBeTruthy();
    expect(screen.getByText(MANAGE_STRINGS_AR["r.all_places"])).toBeTruthy();
    /* أسئلة الزيادة لا تظهر مع نقص. */
    expect(screen.queryByText(MANAGE_STRINGS_AR["r.more.collect"])).toBeNull();
    fireEvent.click(screen.getByText(MANAGE_STRINGS_AR["r.finish"]));
    await waitFor(() => expect(finishApi).toHaveBeenCalled());
    await waitFor(() => expect(screen.getByText(MANAGE_STRINGS_AR["d.recon_done"])).toBeTruthy());
    expect(screen.getByText(/-5\.000 د/)).toBeTruthy();
  });

  it("المجهول: السياق first_unknown_opening عند الإنهاء (§7.3)", async () => {
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
        ],
        totalBalance: { fils: null, labelKey: "l.unknown_balance" },
        flags: { newUser: false, incompletePeriod: true, unknownBalance: true },
      }),
    );
    diffApi.mockResolvedValue(
      diffResponse([{ boxId: "b-cash", kind: "cash", recordedFils: null, countedFils: 100_000 }]),
    );
    finishApi.mockResolvedValue({
      outcome: "applied",
      result: {
        operationId: "op",
        kind: "OP-RECONCILE",
        effectiveOn: "2026-11-28",
        amountFils: 0,
        entryIds: [],
      },
    });
    render(<ReconcilePage />);
    await waitFor(() => screen.getByText(MANAGE_STRINGS_AR["a.next"]));
    fireEvent.change(screen.getByTestId("manage-recon-count-cash"), { target: { value: "100.000" } });
    fireEvent.click(screen.getByText(MANAGE_STRINGS_AR["a.next"]));
    await waitFor(() =>
      expect(finishApi).toHaveBeenCalledWith(expect.objectContaining({ context: "first_unknown_opening" })),
    );
  });
});
