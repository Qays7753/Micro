/** @vitest-environment jsdom */
/** EXE-009 (OWN-001/002/003): رحلة مال المالك بعد التوحيد — حارس التكرار
 * التقاطعي يوقف الحفظ بإفصاح ويكمل بعد تأكيد صريح؛ وجهة/مصدر الكاش لأحداث
 * المالك؛ لا طريق مسدود عند سياسة بلا محافظ؛ وإحالة المسار القديم للمدخل
 * الموحد مع حفظ ?from. */
import React from "react";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { usePrototypeServices } from "@/app/PrototypeServicesContext";
import { UnsavedChangesProvider } from "@/components/forms/UnsavedChangesGuard";
import FinancialEventEditor from "@/pages/FinancialEventEditor";
import OwnerWithdrawalEditor from "@/pages/OwnerWithdrawalEditor";
import { OwnerWithdrawalLegacyRedirect } from "@/app/MicroRouter";

vi.mock("@/app/PrototypeServicesContext", () => ({
  usePrototypeServices: vi.fn(),
}));

const wouterMocks = vi.hoisted(() => ({ navigate: vi.fn(), redirectTargets: [] as string[] }));
let wouterLocation = "/finance/new/owner_investment_cash";

vi.mock("wouter", () => ({
  useSearch: () => "",
  useLocation: () => [wouterLocation, wouterMocks.navigate],
  useParams: () => ({ type: wouterLocation.split("/").pop() }),
  /* ملتقط الوجهة: مكوّن الإحالة يُختبر بتسجيل وجهة Redirect لا بتشغيل المتصفح. */
  Redirect: ({ to }: { to: string }) => {
    wouterMocks.redirectTargets.push(to);
    return null;
  },
}));

const mockedUsePrototypeServices = vi.mocked(usePrototypeServices);

const wallets = [
  { id: "drawer", name: "الدرج", kind: "cash_drawer" },
  { id: "bank", name: "حساب البنك", kind: "bank_account" },
];

const investmentEvent = {
  id: "owner-event-1",
  type: "owner_investment_cash",
  amountMinor: 10000,
  occurredOn: "2026-09-16",
  note: "حقنة رأس مال",
};

function renderInvestmentEditor(
  overrides: {
    findDuplicate?: ReturnType<typeof vi.fn>;
    record?: ReturnType<typeof vi.fn>;
    distributeUnallocated?: ReturnType<typeof vi.fn>;
  } = {},
) {
  const record =
    overrides.record ?? vi.fn().mockResolvedValue({ ok: true, value: investmentEvent, reused: false });
  const distributeUnallocated =
    overrides.distributeUnallocated ?? vi.fn().mockResolvedValue({ ok: true, value: {} });
  mockedUsePrototypeServices.mockReturnValue({
    projectFinance: {
      record,
      listSettleablePayables: vi.fn().mockResolvedValue({ ok: true, value: [] }),
      listEvents: vi.fn().mockResolvedValue({ ok: true, value: [] }),
      readPosition: vi.fn().mockResolvedValue({ ok: true, value: { amanahHeldMinor: 0 } }),
      distributeUnallocated,
    },
    cashContinuity: {
      overview: vi.fn().mockResolvedValue({ ok: true, value: { wallets } }),
    },
    recurringExpenses: {
      findUnhandledOccurrenceForDate: vi.fn().mockResolvedValue({ ok: true, value: null }),
    },
    ownerEntitlement: {
      findCrossModelOwnerDuplicate:
        overrides.findDuplicate ?? vi.fn().mockResolvedValue({ ok: true, value: null }),
    },
    dataVersion: 0,
    notifyDataChanged: vi.fn(),
    formDrafts: {
      read: vi.fn().mockResolvedValue({ ok: true, value: null }),
      save: vi.fn().mockResolvedValue({ ok: true, value: null }),
      discard: vi.fn().mockResolvedValue({ ok: true, value: null }),
      clearDraft: vi.fn().mockResolvedValue({ ok: true, value: null }),
      loadDraft: vi.fn().mockResolvedValue({ ok: true, value: null }),
    },
  } as unknown as ReturnType<typeof usePrototypeServices>);
  wouterLocation = "/finance/new/owner_investment_cash";
  render(
    <UnsavedChangesProvider navigate={() => undefined}>
      <FinancialEventEditor />
    </UnsavedChangesProvider>,
  );
  return { record, distributeUnallocated };
}

function renderWithdrawalEditor(
  overrides: {
    overview?: Record<string, unknown>;
    record?: ReturnType<typeof vi.fn>;
    recordMovement?: ReturnType<typeof vi.fn>;
    findDuplicate?: ReturnType<typeof vi.fn>;
    distributeUnallocated?: ReturnType<typeof vi.fn>;
  } = {},
) {
  const overview =
    overrides.overview ??
    ({
      policies: [],
      activePolicies: [],
      entitlements: [],
      openingBalances: [],
      movements: [],
      walletBalances: [{ id: "drawer", name: "الدرج", balanceMinor: 5000 }],
      approvedEntitlementMinor: 0,
      openingBalanceMinor: 0,
      openingBalanceSettlementMinor: 0,
      openingBalanceRemainingMinor: 0,
      drawnForEntitlementMinor: 0,
      drawnBeforeEntitlementMinor: 0,
      ownerDrawMinor: 0,
      returnedForPriorDrawMinor: 0,
      returnedAsCapitalMinor: 0,
      remainingEntitlementBalanceMinor: 0,
      cashMovementMinor: 0,
      balanceState: "zero",
    } as Record<string, unknown>);
  const record =
    overrides.record ??
    vi.fn().mockResolvedValue({
      ok: true,
      value: { ...investmentEvent, type: "owner_withdrawal_cash", amountMinor: 2500 },
      reused: false,
    });
  mockedUsePrototypeServices.mockReturnValue({
    projectFinance: {
      record,
      distributeUnallocated:
        overrides.distributeUnallocated ?? vi.fn().mockResolvedValue({ ok: true, value: {} }),
    },
    ownerEntitlement: {
      readOverview: vi.fn().mockResolvedValue({ ok: true, value: overview }),
      recordMovement: overrides.recordMovement ?? vi.fn(),
      findCrossModelOwnerDuplicate:
        overrides.findDuplicate ?? vi.fn().mockResolvedValue({ ok: true, value: null }),
    },
    dataVersion: 0,
    notifyDataChanged: vi.fn(),
  } as unknown as ReturnType<typeof usePrototypeServices>);
  wouterLocation = "/finance/withdraw";
  render(
    <UnsavedChangesProvider navigate={() => undefined}>
      <OwnerWithdrawalEditor />
    </UnsavedChangesProvider>,
  );
  return { record };
}

describe("EXE-009 — owner investment editor: destination + cross-model guard", () => {
  beforeEach(() => {
    wouterMocks.navigate.mockClear();
    wouterMocks.redirectTargets.length = 0;
    window.localStorage.clear();
  });
  afterEach(() => cleanup());

  it("asks the cash destination with unallocated as the explicit default (no silent wallet)", async () => {
    renderInvestmentEditor();
    const select = (await screen.findByLabelText(/وجهة الكاش/)) as HTMLSelectElement;
    await waitFor(() => expect(select.value).toBe(""));
    expect(screen.getByText("الكاش غير الموزع")).toBeTruthy();
    expect(screen.getByText("الدرج — تخصيص إلى رصيدها")).toBeTruthy();
    expect(screen.getByText(/الكاش غير الموزع هو الافتراضي/)).toBeTruthy();
  });

  it("attributes the investment to the chosen wallet with the owner_event legal source", async () => {
    const { record, distributeUnallocated } = renderInvestmentEditor();
    await userEvent.setup().type(screen.getByLabelText("المبلغ بالدينار الأردني"), "100");
    await userEvent.setup().type(screen.getByLabelText(/ما الذي حدث/), "حقنة رأس مال");
    await userEvent.setup().selectOptions(await screen.findByLabelText(/وجهة الكاش/), "drawer");
    await userEvent.setup().click(screen.getByRole("button", { name: "حفظ الحدث" }));
    await waitFor(() => expect(record).toHaveBeenCalledOnce());
    await waitFor(() =>
      expect(distributeUnallocated).toHaveBeenCalledWith(
        expect.objectContaining({
          walletId: "drawer",
          deltaMinor: 10000,
          sourceRefKind: "owner_event",
          sourceRefId: "owner-event-1",
        }),
      ),
    );
  });

  it("blocks the save when the same amount and day exists in the ledger model, then proceeds on explicit confirm", async () => {
    const duplicate = {
      direction: "injection",
      amountMinor: 10000,
      occurredOn: "2026-09-16",
      eventIds: [],
      movementIds: ["movement-7"],
    };
    const findDuplicate = vi
      .fn()
      .mockResolvedValueOnce({ ok: true, value: duplicate })
      .mockResolvedValueOnce({ ok: true, value: duplicate });
    const { record } = renderInvestmentEditor({ findDuplicate });
    await userEvent.setup().type(screen.getByLabelText("المبلغ بالدينار الأردني"), "100");
    await userEvent.setup().type(screen.getByLabelText(/ما الذي حدث/), "عملية");
    await userEvent.setup().click(screen.getByRole("button", { name: "حفظ الحدث" }));
    /* الحارس يوقف الحفظ بالإفصاح — لم يُكتب شيء بعد. */
    expect(await screen.findByText("تطابق محتمل بين نموذجي مال المالك")).toBeTruthy();
    expect(record).not.toHaveBeenCalled();
    /* التأكيد الصريح يكمل الحفظ — والتأكيد يستدعي الحفظ مباشرة بلا فحص ثانٍ. */
    await userEvent.setup().click(screen.getByRole("button", { name: /هذه عملية جديدة مختلفة/ }));
    await waitFor(() => expect(record).toHaveBeenCalledOnce());
    expect(findDuplicate).toHaveBeenCalledTimes(1);
  });
});

describe("EXE-009 — unified withdrawal editor: source + guard + no dead end", () => {
  beforeEach(() => {
    wouterMocks.navigate.mockClear();
    window.localStorage.clear();
  });
  afterEach(() => cleanup());

  it("asks the withdrawal source on the financial-event path (no policy)", async () => {
    renderWithdrawalEditor();
    await screen.findByLabelText("مبلغ السحب");
    const select = (await screen.findByLabelText(/مصدر السحب/)) as HTMLSelectElement;
    await waitFor(() => expect(select.value).toBe(""));
    expect(screen.getByText("الكاش غير الموزع")).toBeTruthy();
    expect(screen.getByText("الدرج — تغطية من رصيدها")).toBeTruthy();
  });

  it("blocks then confirms on a cross-model duplicate before writing the event", async () => {
    const duplicate = {
      direction: "withdrawal",
      amountMinor: 2500,
      occurredOn: "2026-09-16",
      eventIds: ["event-9"],
      movementIds: [],
    };
    const findDuplicate = vi
      .fn()
      .mockResolvedValueOnce({ ok: true, value: duplicate })
      .mockResolvedValueOnce({ ok: true, value: duplicate });
    const { record } = renderWithdrawalEditor({ findDuplicate });
    await userEvent.setup().type(await screen.findByLabelText("مبلغ السحب"), "25");
    await userEvent.setup().type(screen.getByLabelText(/بيان مختصر/), "سحب لبيت المالك");
    await userEvent.setup().click(screen.getByRole("button", { name: /سجّل السحب/ }));
    expect(await screen.findByText("تطابق محتمل بين نموذجي مال المالك")).toBeTruthy();
    expect(record).not.toHaveBeenCalled();
    await userEvent.setup().click(screen.getByRole("button", { name: /هذه عملية جديدة مختلفة/ }));
    await waitFor(() => expect(record).toHaveBeenCalledOnce());
  });

  it("policy with zero wallets shows a documented next step (create a wallet), not a dead end", async () => {
    renderWithdrawalEditor({
      overview: {
        policies: [{ id: "p1" }],
        activePolicies: [{ id: "p1" }],
        entitlements: [],
        openingBalances: [],
        movements: [],
        walletBalances: [],
        remainingEntitlementBalanceMinor: 0,
        balanceState: "zero",
      },
    });
    expect(await screen.findByText("سياستك الفعالة تسحب من محفظة، وما في محفظة معلنة بعد.")).toBeTruthy();
    expect(screen.getByRole("button", { name: /أنشئ محفظة كاش/ })).toBeTruthy();
  });
});

describe("EXE-009 — legacy withdrawal URL redirects to the unified editor", () => {
  afterEach(() => cleanup());

  it("redirects preserving the ?from tag", () => {
    wouterMocks.redirectTargets.length = 0;
    wouterLocation = "/finance/new/owner_withdrawal_cash?from=/finance";
    render(<OwnerWithdrawalLegacyRedirect />);
    expect(wouterMocks.redirectTargets).toEqual(["/finance/withdraw?from=/finance"]);
    wouterLocation = "/finance/new/owner_withdrawal_cash";
    render(<OwnerWithdrawalLegacyRedirect />);
    expect(wouterMocks.redirectTargets[1]).toBe("/finance/withdraw");
  });
});
