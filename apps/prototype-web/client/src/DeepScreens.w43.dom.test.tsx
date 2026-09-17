/** @vitest-environment jsdom */
/* Wave 4.3 — P-4.3-6: الشاشات العميقة — إصلاحات الجرد الموثقة.
 * ---------------------------------------------------------------------------
 * ١) GAP-4.3-08: محرر الحدث المالي يحيل للأصول والقروض القائمين بأفعال
 *    حقيقية — لا وعد «لاحقًا» لميزتين منفذتين.
 * ٢) GAP-4.3-09: خلاصة القروض تستعمل جمع القروض الصحيح لا جمع الأصول.
 * ٣) N-92: صيغة الماضي الموحدة «حُفظ…» في نجاح الحدث المالي.
 */
import React from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { usePrototypeServices } from "@/app/PrototypeServicesContext";
import { UnsavedChangesProvider } from "@/components/forms/UnsavedChangesGuard";
import { MemoryLocalStore } from "@/storage/local/MemoryLocalStore";
import { ProjectFinancialService } from "@/application/finance/projectFinancialService";
import { LoanService } from "@/application/loans/loanService";
import { AssetService } from "@/application/assets/assetService";
import { CashContinuityService } from "@/application/cash/cashContinuityService";
import { FormDraftService } from "@/application/drafts/formDraftService";
import { OwnerEntitlementService } from "@/application/finance/ownerEntitlementService";
import { ProfileService } from "@/application/profile/profileService";
import FinancialEventEditor from "@/pages/FinancialEventEditor";
import Loans from "@/pages/Loans";

vi.mock("@/app/PrototypeServicesContext", () => ({
  usePrototypeServices: vi.fn(),
}));

const wouterMocks = vi.hoisted(() => ({
  navigate: vi.fn(),
  location: "/finance/new/operating_expense_cash",
  params: { type: "operating_expense_cash" } as Record<string, string>,
  search: "",
}));
vi.mock("wouter", () => ({
  useLocation: () => [wouterMocks.location, wouterMocks.navigate],
  useParams: () => wouterMocks.params,
  useSearch: () => wouterMocks.search,
  Redirect: () => null,
}));

const mockedUsePrototypeServices = vi.mocked(usePrototypeServices);
const NOW = "2026-09-16T09:00:00.000Z";

let store: MemoryLocalStore;

function buildServices() {
  const projectFinance = new ProjectFinancialService(store, () => NOW);
  return {
    projectFinance,
    loans: new LoanService(store, () => NOW),
    assets: new AssetService(store, () => NOW),
    cashContinuity: new CashContinuityService(store, () => NOW),
    formDrafts: new FormDraftService(store),
    ownerEntitlement: new OwnerEntitlementService(store, (from, to) =>
      projectFinance.readRecordedPeriodResult(from, to),
    ),
    preferences: {
      load: async () => ({ ok: true, preference: { theme: "light" } }),
      save: async () => ({ ok: true }),
      readAllocationPolicy: async () => ({ ok: true, policy: null }),
      readDisabledCapabilities: async () => ({ ok: true, disabled: [] }),
    },
    notifyDataChanged: vi.fn(),
    dataVersion: 0,
  } as unknown as ReturnType<typeof usePrototypeServices>;
}

function renderWithProviders(page: React.ReactNode) {
  render(<UnsavedChangesProvider navigate={wouterMocks.navigate}>{page}</UnsavedChangesProvider>);
}

describe("Wave 4.3 — P-4.3-6: documented deep-screen fixes", () => {
  beforeEach(() => {
    wouterMocks.navigate.mockReset();
    wouterMocks.location = "/finance/new/operating_expense_cash";
    wouterMocks.params = { type: "operating_expense_cash" };
    wouterMocks.search = "";
    vi.clearAllMocks();
    store = new MemoryLocalStore();
    mockedUsePrototypeServices.mockReturnValue(buildServices());
  });
  afterEach(() => cleanup());

  it("GAP-4.3-08: the expense editor refers to the implemented assets/loans homes with real actions", async () => {
    renderWithProviders(<FinancialEventEditor />);
    /* لا وعد «لاحقًا» لميزتين منفذتين — إحالة صادقة بأفعال حقيقية. */
    const surface = await screen.findByRole("heading", { name: "تسجيل استثمار المالك" }).catch(() => null);
    const bodyText = document.body.textContent ?? "";
    expect(bodyText).not.toContain("مساراتها قادمة لاحقًا");
    await waitFor(() => expect(screen.getByText(/سجّله من الأصول/)).toBeTruthy());
    expect(screen.getByText(/سجّله من القروض/)).toBeTruthy();
    /* الأفعال تفتح البيتين القائمين بسياق رجوع محفوظ. */
    fireEvent.click(screen.getByRole("button", { name: /سجّله من الأصول/ }));
    expect(wouterMocks.navigate).toHaveBeenCalledWith(
      "/assets?returnTo=%2Ffinance%2Fnew%2Foperating_expense_cash",
    );
    fireEvent.click(screen.getByRole("button", { name: /سجّله من القروض/ }));
    expect(wouterMocks.navigate).toHaveBeenCalledWith(
      "/loans?returnTo=%2Ffinance%2Fnew%2Foperating_expense_cash",
    );
    expect(surface).toBeNull();
  });

  it("GAP-4.3-09: the loans summary uses the correct Arabic loans plural, never the assets one", async () => {
    const profile = await new ProfileService(store, () => NOW).save("مشغل قروض");
    if (!profile.ok) throw new Error(profile.message);
    /* قرضان قائمان — الجمع الصحيح «قرضين» لا «أصلين». */
    for (const [id, name] of [
      ["loan-a", "سامي"],
      ["loan-b", "لمى"],
    ] as const) {
      const created = await new LoanService(store, () => NOW).create({
        borrowerName: name,
        principalMinor: 5000,
        loanDate: "2026-09-10",
        purposeNote: null,
        sourceWalletId: null,
      });
      if (!created.ok) throw new Error(created.message);
    }
    wouterMocks.location = "/loans";
    wouterMocks.params = {};
    renderWithProviders(<Loans />);
    await waitFor(() => expect(screen.getByText("قائم عند الناس")).toBeTruthy());
    const summary = document.querySelector('.micro-decision-card[aria-label="خلاصة القروض"]');
    expect(summary?.textContent).toContain("قرضان قائمان من أصل قرضين");
    /* جمع الأصول لا يظهر في خلاصة القروض أبدًا. */
    expect(summary?.textContent).not.toMatch(/أصلان|أصلين|أصلًا من|\d أصول/);
  });
});
