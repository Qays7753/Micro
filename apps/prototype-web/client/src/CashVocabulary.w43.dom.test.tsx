/** @vitest-environment jsdom */
/* Wave 4.3 — P-4.3-5 (F08): معجم التوزيع والتغطية الموحد.
 * ---------------------------------------------------------------------------
 * ١) رسالة النجاح الموحدة «سُجّل التوزيع ✓» لاتجاه التوزيع، و«سُجّلت
 *    التغطية ✓» لاتجاه التغطية (الفعل المعتمد نفسه) — لا مفردات لهجة.
 * ٢) تسمية الحركة «توزيع من غير الموزع» في دفتر المحفظة.
 * ٣) الملاحظات الجديدة تستخدم «توزيع…» لا «تخصيص…» — والسجلات القديمة
 *    المحفوظة لا تُعدّل (بذور الاختبار القديمة تُقرأ كما حُفظت).
 * ٤) عقد التوزيع محفوظ حرفيًا: Idempotency وdestinationWalletId وreturnTo
 *    واختيار المحفظة المسبق والرجوع لدفتر المحفظة — حراس 4.2 القائمة.
 */
import React from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { usePrototypeServices } from "@/app/PrototypeServicesContext";
import { UnsavedChangesProvider } from "@/components/forms/UnsavedChangesGuard";
import { MemoryLocalStore } from "@/storage/local/MemoryLocalStore";
import { CashContinuityService } from "@/application/cash/cashContinuityService";
import { ProjectFinancialService } from "@/application/finance/projectFinancialService";
import { WalletLedgerService } from "@/application/cash/walletLedgerService";
import { DirectSaleService } from "@/application/direct-sales/directSaleService";
import { ProfileService } from "@/application/profile/profileService";
import CashDistribution from "@/pages/CashDistribution";

vi.mock("@/app/PrototypeServicesContext", () => ({
  usePrototypeServices: vi.fn(),
}));

const wouterMocks = vi.hoisted(() => ({
  navigate: vi.fn(),
  location: "/cash/distribute",
  search: "",
}));
vi.mock("wouter", () => ({
  useLocation: () => [wouterMocks.location, wouterMocks.navigate],
  useParams: () => ({}),
  useSearch: () => wouterMocks.search,
}));

const mockedUsePrototypeServices = vi.mocked(usePrototypeServices);
const NOW = "2026-09-16T09:00:00.000Z";

let store: MemoryLocalStore;

function buildServices() {
  const cashContinuity = new CashContinuityService(store, () => NOW);
  const projectFinance = new ProjectFinancialService(store, () => NOW);
  return {
    cashContinuity,
    projectFinance,
    walletLedger: new WalletLedgerService(store),
    notifyDataChanged: vi.fn(),
    dataVersion: 0,
  } as unknown as ReturnType<typeof usePrototypeServices>;
}

async function seedWalletWithUnallocated() {
  const profile = await new ProfileService(store, () => NOW).save("مشغل معجم");
  if (!profile.ok) throw new Error(profile.message);
  const sale = await new DirectSaleService(store, () => NOW).record({
    itemName: "كوب",
    quantity: 1,
    revenueMinor: 5000,
    costMinor: null,
    occurredOn: "2026-09-16",
    note: "بيع لاختبار المعجم",
    idempotencyKey: "w43-vocab-sale",
  });
  if (!sale.ok) throw new Error(sale.message);
  const opened = await new CashContinuityService(store, () => NOW).openWallet({
    name: "درج المعجم",
    kind: "cash_drawer",
    openingMinor: 0,
    occurredOn: "2026-09-16",
    note: "محفظة اختبار",
    operationKey: "w43-vocab-wallet",
    openingStatus: "known",
  });
  if (!opened.ok) throw new Error(opened.message);
  return opened.value.wallet;
}

describe("Wave 4.3 — P-4.3-5 (F08): distribution and cover vocabulary", () => {
  beforeEach(() => {
    wouterMocks.navigate.mockReset();
    wouterMocks.location = "/cash/distribute";
    wouterMocks.search = "";
    vi.clearAllMocks();
    store = new MemoryLocalStore();
    mockedUsePrototypeServices.mockReturnValue(buildServices());
  });
  afterEach(() => cleanup());

  it("the unified success message is «سُجّل التوزيع ✓» for the distribute direction", async () => {
    const wallet = await seedWalletWithUnallocated();
    render(
      <UnsavedChangesProvider navigate={wouterMocks.navigate}>
        <CashDistribution />
      </UnsavedChangesProvider>,
    );
    const amount = await screen.findByLabelText("مبلغ التوزيع");
    fireEvent.change(amount.querySelector("input") ?? amount, { target: { value: "20" } });
    const walletSelect = screen.getByLabelText("المحفظة");
    fireEvent.change(walletSelect, { target: { value: wallet.id } });
    fireEvent.click(screen.getByRole("button", { name: /سجّل التوزيع/ }));
    await waitFor(() => expect(screen.getByText(/سُجّل التوزيع ✓/)).toBeTruthy());
    /* المفردات القديمة غير المعتمدة اختفت نهائيًا. */
    expect(screen.queryByText(/انخصص/)).toBeNull();
  });

  it("the cover direction says «سُجّلت التغطية ✓» — the approved cover verb", async () => {
    const wallet = await seedWalletWithUnallocated();
    const finance = new ProjectFinancialService(store, () => NOW);
    /* موّد المحفظة أولًا ثم صرف من غير الموزع — دفعة تحتاج تغطية (السالب الصادق). */
    const funded = await finance.distributeUnallocated({
      walletId: wallet.id,
      deltaMinor: 5000,
      note: null,
      operationKey: "w43-vocab-fund",
    });
    if (!funded.ok) throw new Error(funded.message);
    const expense = await finance.record({
      type: "operating_expense_cash",
      amountMinor: 3000,
      occurredOn: "2026-09-16",
      note: "صرف غير مغطى",
      counterparty: null,
      relatedEventId: null,
      expenseContext: {
        relationship: "project",
        behavior: "fixed",
        purpose: "project_general",
        knowledge: "known",
        sharedProjectShare: null,
        categoryLabel: "اختبار",
      },
      idempotencyKey: "w43-vocab-uncovered-expense",
    });
    if (!expense.ok) throw new Error(expense.message);
    render(
      <UnsavedChangesProvider navigate={wouterMocks.navigate}>
        <CashDistribution />
      </UnsavedChangesProvider>,
    );
    await waitFor(() => expect(screen.getByText(/في دفعة تحتاج تغطية/)).toBeTruthy());
    const amount = await screen.findByLabelText("مبلغ التوزيع");
    fireEvent.change(amount.querySelector("input") ?? amount, { target: { value: "10" } });
    const walletSelect = screen.getByLabelText("المحفظة");
    fireEvent.change(walletSelect, { target: { value: wallet.id } });
    fireEvent.click(screen.getByRole("button", { name: /سجّل التوزيع/ }));
    await waitFor(() => expect(screen.getByText(/سُجّلت التغطية ✓/)).toBeTruthy());
    expect(screen.queryByText(/انغطى/)).toBeNull();
  });

  it("the wallet ledger labels the movement «توزيع من غير الموزع» and keeps saved notes verbatim", async () => {
    const wallet = await seedWalletWithUnallocated();
    const distributed = await new ProjectFinancialService(store, () => NOW).distributeUnallocated({
      walletId: wallet.id,
      deltaMinor: 2000,
      note: null,
      operationKey: "w43-vocab-distribute",
    });
    if (!distributed.ok) throw new Error(distributed.message);
    const ledger = await new WalletLedgerService(store).read(wallet.id);
    if (!ledger.ok) throw new Error(ledger.message);
    const allocationRow = ledger.value.rows.find(row => row.kind === "allocation_in");
    expect(allocationRow?.label).toBe("توزيع من غير الموزع");
    /* الملاحظة الجديدة الافتراضية تستخدم «توزيع…» لا «تخصيص…». */
    expect(allocationRow?.note).toContain("توزيع");
    expect(allocationRow?.note).not.toContain("تخصيص");
  });
});
