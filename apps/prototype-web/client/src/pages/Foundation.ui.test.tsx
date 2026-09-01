/** @vitest-environment jsdom */

import React from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { usePrototypeServices } from "@/app/PrototypeServicesContext";
import Foundation from "@/pages/Foundation";

vi.mock("@/app/PrototypeServicesContext", () => ({
  usePrototypeServices: vi.fn(),
}));

const wouterMocks = { navigate: vi.fn() };

vi.mock("wouter", () => ({
  useSearch: () => "",
  useLocation: () => ["/foundation", wouterMocks.navigate],
}));

const mockedUsePrototypeServices = vi.mocked(usePrototypeServices);

function servicesOverrides(hasData: boolean) {
  return {
    cashContinuity: {
      overview: vi.fn().mockResolvedValue({
        ok: true,
        value: {
          wallets: hasData ? [{ id: "w1", name: "الدرج", balanceMinor: 50000, entryCount: 1 }] : [],
          totalWalletCashMinor: hasData ? 50000 : 0,
          entryCount: hasData ? 1 : 0,
          truth: "قراءة محلية.",
        },
      }),
    },
    ownerEntitlement: {
      readOverview: vi.fn().mockResolvedValue({
        ok: true,
        value: {
          approvedEntitlementMinor: hasData ? 50000 : 0,
          openingBalanceMinor: 0,
          activePolicies: [],
        },
      }),
    },
    supplierPurchases: {
      readSummary: vi.fn().mockResolvedValue({
        ok: true,
        value: {
          purchaseCount: hasData ? 1 : 0,
          openPurchaseCount: hasData ? 1 : 0,
          supplierPayablesMinor: hasData ? 12000 : 0,
          recordedCashPaidMinor: 0,
          truth: "قراءة محلية.",
        },
      }),
    },
    inventory: {
      overview: vi.fn().mockResolvedValue({
        ok: true,
        value: {
          materials: hasData ? [{ id: "m1", name: "فضة" }] : [],
          movementCount: hasData ? 1 : 0,
          truth: "قراءة محلية.",
        },
      }),
    },
    dataVersion: 0,
  } as unknown as ReturnType<typeof usePrototypeServices>;
}

describe("Foundation page (decisions 4–8)", () => {
  afterEach(() => cleanup());

  beforeEach(() => {
    wouterMocks.navigate.mockReset();
  });

  it("shows the honest one-line state for every empty section and opens with cash unfolded", async () => {
    mockedUsePrototypeServices.mockReturnValue(servicesOverrides(false));
    render(<Foundation />);

    expect(await screen.findByRole("heading", { name: "شو عندك هلق؟" })).toBeTruthy();
    // سطر الحقيقة (§2.5) يتصدر الصفحة.
    expect(screen.getByText(/هذه الأرقام أساس كل ما سيقوله التطبيق/)).toBeTruthy();
    // القرار ٤: الكاش مفتوح افتراضيًا، والباقي مطوي بحالته بسطر واحد.
    expect(screen.getByText("لم تسجل محفظة بعد")).toBeTruthy();
    expect(screen.getByText("لم يسجل رأس مال بعد — اختياري بالكامل")).toBeTruthy();
    expect(screen.getByText("الديون: لم يُسجَّل شيء")).toBeTruthy();
    expect(screen.getByText("المواد: لم تسجل مادة بعد")).toBeTruthy();
  });

  it("keeps every section a road: each empty block sends to its own registration path", async () => {
    mockedUsePrototypeServices.mockReturnValue(servicesOverrides(false));
    render(<Foundation />);

    const walletButton = await screen.findByRole("button", { name: /محفظة ورصيد بداية/ });
    fireEvent.click(walletButton);
    expect(wouterMocks.navigate).toHaveBeenCalledWith("/cash/wallet/new");

    fireEvent.click(screen.getByRole("button", { name: /سجل التزامًا لمورد/ }));
    expect(wouterMocks.navigate).toHaveBeenCalledWith("/finance/new/operating_expense_payable");

    fireEvent.click(screen.getByRole("button", { name: /سجل استثمارًا نقديًا/ }));
    expect(wouterMocks.navigate).toHaveBeenCalledWith("/finance/new/owner_investment_cash");

    fireEvent.click(screen.getByRole("button", { name: /مادة ورصيد بداية/ }));
    expect(wouterMocks.navigate).toHaveBeenCalledWith("/inventory/material/new");

    // F-076 + المجموعة ١: بديل الملف باب إلى الاستيراد الموجه — يصل للبطاقة نفسها.
    fireEvent.click(screen.getByRole("button", { name: /فتح الاستيراد/ }));
    expect(wouterMocks.navigate).toHaveBeenCalledWith("/settings?focus=guided-import&from=%2Ffoundation");
  });

  it("offers both exits and lands on Home without closing the step (decision 7)", async () => {
    mockedUsePrototypeServices.mockReturnValue(servicesOverrides(false));
    render(<Foundation />);

    fireEvent.click(await screen.findByRole("button", { name: /تخطَّ وأكمل لاحقًا/ }));
    expect(wouterMocks.navigate).toHaveBeenCalledWith("/");
    fireEvent.click(screen.getByRole("button", { name: /ادخل إلى مشروعي/ }));
    expect(wouterMocks.navigate).toHaveBeenCalledWith("/");
  });

  it("states what is already recorded instead of repeating the empty copy", async () => {
    mockedUsePrototypeServices.mockReturnValue(servicesOverrides(true));
    render(<Foundation />);

    expect(await screen.findByText("1 محفظة · كاش المحافظ:")).toBeTruthy();
    expect(screen.getByText(/عليك للموردين:/)).toBeTruthy();
    expect(screen.getByText(/مادة مسجلة في المخزون المحلي/)).toBeTruthy();
    expect(screen.queryByText("الديون: لم يُسجَّل شيء")).toBeNull();
  });
});
