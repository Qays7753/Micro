/** @vitest-environment jsdom */

/* FIN-005 (قرار المالك المعتمد ٢٠٢٦-٠٩-١٦): قواعد مصدر صرف المصروف السريع —
 * بلا محافظ: تحذير معلن والصرف من غير الموزع؛ محفظة واحدة: تعيين مسبق مرئي
 * مع خيار صريح لغير الموزع؛ محافظ متعددة: اختيار إلزامي (محفظة أو الكاش
 * غير الموزع) ولا تُذكر آخر محفظة. المحفظة المختارة هي وجهة التخصيص
 * الفعلية المخزنة. */
import React from "react";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { usePrototypeServices } from "@/app/PrototypeServicesContext";
import { MemoryLocalStore } from "@/storage/local/MemoryLocalStore";
import { ProjectFinancialService } from "@/application/finance/projectFinancialService";
import { CashContinuityService } from "@/application/cash/cashContinuityService";
import { QuickExpenseForm } from "@/components/finance/QuickExpenseForm";
import type { QuickActionReceipt } from "@/components/finance/quickActionFormTypes";

vi.mock("@/app/PrototypeServicesContext", () => ({
  usePrototypeServices: vi.fn(),
}));

const mockedUsePrototypeServices = vi.mocked(usePrototypeServices);
const NOW = "2026-09-16T09:00:00.000Z";

let store: MemoryLocalStore;
let projectFinance: ProjectFinancialService;

beforeEach(() => {
  store = new MemoryLocalStore();
  projectFinance = new ProjectFinancialService(store, () => NOW);
  mockedUsePrototypeServices.mockReturnValue({
    projectFinance,
    notifyDataChanged: vi.fn(),
    dataVersion: 0,
  } as unknown as ReturnType<typeof usePrototypeServices>);
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

async function openWallet(name: string, openingMinor: number) {
  const cash = new CashContinuityService(store, () => NOW);
  const opened = await cash.openWallet({
    name,
    kind: "cash_drawer",
    openingMinor,
    occurredOn: "2026-09-16",
    note: "رصيد بداية",
    operationKey: `fin005-open-${name}`,
  });
  if (!opened.ok) throw new Error(opened.message);
  const overview = await cash.overview();
  if (!overview.ok) throw new Error("overview failed");
  return overview.value.wallets.find(wallet => wallet.name === name)!;
}

function renderForm(wallets: readonly { id: string; name: string }[], submitted: QuickActionReceipt[]) {
  render(
    <QuickExpenseForm
      wallets={wallets}
      categorySuggestions={[]}
      onSubmitted={receipt => submitted.push(receipt)}
      onBackToMenu={() => undefined}
    />,
  );
}

async function submitExpense(selectorValue?: string) {
  const user = userEvent.setup();
  await user.type(screen.getByLabelText("مبلغ المصروف"), "3");
  if (selectorValue !== undefined) {
    await waitFor(() => expect(screen.getByLabelText(/مصدر الصرف/)).toBeTruthy());
    await user.selectOptions(screen.getByLabelText(/مصدر الصرف/), selectorValue);
  }
  await user.click(screen.getByRole("button", { name: "سجّل المصروف" }));
}

describe("QuickExpenseForm cash-source rules (FIN-005)", () => {
  it("warns before saving when no wallet exists and records from unallocated", async () => {
    const submitted: QuickActionReceipt[] = [];
    renderForm([], submitted);
    expect(
      await screen.findByText(/سيُسجَّل المصروف من الكاش غير الموزع، ويمكن تغطيته من محفظة لاحقًا/),
    ).toBeTruthy();
    expect(screen.queryByLabelText(/مصدر الصرف/)).toBeNull();
    await submitExpense();
    await waitFor(() => expect(submitted.length).toBeGreaterThan(0));
    const position = await projectFinance.readPosition();
    if (!position.ok) throw new Error(position.message);
    /* المصروف سُجل فعلًا من غير الموزع (−3.00) — التحذير كان صادقًا. */
    expect(position.value.unallocatedCashMinor).toBe(-300);
    expect(position.value.walletCashMinor).toBe(0);
    expect(position.value.recordedCashMinor).toBe(-300);
  });

  it("preselects the single wallet visibly and spends from it", async () => {
    const wallet = await openWallet("درج-FIN005", 10000);
    const submitted: QuickActionReceipt[] = [];
    renderForm([{ id: wallet.id, name: "درج-FIN005" }], submitted);
    const selector = await screen.findByLabelText(/مصدر الصرف/);
    await waitFor(() => expect((selector as HTMLSelectElement).value).toBe(wallet.id));
    expect(screen.getByText("درج-FIN005 — تغطية من رصيدها")).toBeTruthy();
    /* الكاش غير الموزع خيار صريح إلى جانب المحفظة المعيَّنة. */
    expect(screen.getByText("الكاش غير الموزع")).toBeTruthy();
    await submitExpense();
    await waitFor(() => expect(submitted.length).toBeGreaterThan(0));
    const position = await projectFinance.readPosition();
    if (!position.ok) throw new Error(position.message);
    /* المال ذهب إلى المحفظة المعيَّنة فعلًا: رصيدها 97.00 وغير الموزع 0. */
    expect(position.value.walletCashMinor).toBe(9700);
    expect(position.value.unallocatedCashMinor).toBe(0);
  });

  it("requires an explicit choice with multiple wallets and honors it", async () => {
    const drawer = await openWallet("درج-FIN005", 10000);
    const bank = await openWallet("بنك-FIN005", 50000);
    const submitted: QuickActionReceipt[] = [];
    renderForm(
      [
        { id: drawer.id, name: "درج-FIN005" },
        { id: bank.id, name: "بنك-FIN005" },
      ],
      submitted,
    );
    const selector = await screen.findByLabelText(/مصدر الصرف/);
    await waitFor(() => expect((selector as HTMLSelectElement).value).toBe("__unset__"));
    expect(screen.getByText("اختر مصدر الصرف")).toBeTruthy();
    /* المحاولة بلا اختيار تُرفض بلا أي كتابة. */
    const user = userEvent.setup();
    await user.type(screen.getByLabelText("مبلغ المصروف"), "3");
    await user.click(screen.getByRole("button", { name: "سجّل المصروف" }));
    expect(await screen.findByText("اختر مصدر الصرف: محفظة أو الكاش غير الموزع.")).toBeTruthy();
    expect(submitted).toHaveLength(0);
    const positionBefore = await projectFinance.readPosition();
    if (!positionBefore.ok) throw new Error(positionBefore.message);
    expect(positionBefore.value.recordedCashMinor).toBe(60000);
    /* اختيار البنك صراحةً — الصرف من رصيده هو وحده. */
    await user.selectOptions(selector, bank.id);
    await user.click(screen.getByRole("button", { name: "سجّل المصروف" }));
    await waitFor(() => expect(submitted.length).toBeGreaterThan(0));
    const position = await projectFinance.readPosition();
    if (!position.ok) throw new Error(position.message);
    expect(position.value.walletCashMinor).toBe(59700);
    expect(position.value.unallocatedCashMinor).toBe(0);
    expect(position.value.recordedCashMinor).toBe(59700);
  });

  it("spends from unallocated when it is chosen explicitly with one wallet", async () => {
    const wallet = await openWallet("درج-FIN005", 10000);
    const submitted: QuickActionReceipt[] = [];
    renderForm([{ id: wallet.id, name: "درج-FIN005" }], submitted);
    await screen.findByLabelText(/مصدر الصرف/);
    await submitExpense("");
    await waitFor(() => expect(submitted.length).toBeGreaterThan(0));
    const position = await projectFinance.readPosition();
    if (!position.ok) throw new Error(position.message);
    /* خيار صريح لغير الموزع: المحفظة لا تُمس والسالب معلن مصدره. */
    expect(position.value.walletCashMinor).toBe(10000);
    expect(position.value.unallocatedCashMinor).toBe(-300);
  });

  it("follows the approved rule again when the form is reopened — no last-wallet memory", async () => {
    const drawer = await openWallet("درج-FIN005", 10000);
    const bank = await openWallet("بنك-FIN005", 50000);
    const firstSubmitted: QuickActionReceipt[] = [];
    const { unmount } = render(
      <QuickExpenseForm
        wallets={[
          { id: drawer.id, name: "درج-FIN005" },
          { id: bank.id, name: "بنك-FIN005" },
        ]}
        categorySuggestions={[]}
        onSubmitted={receipt => firstSubmitted.push(receipt)}
        onBackToMenu={() => undefined}
      />,
    );
    const selector = await screen.findByLabelText(/مصدر الصرف/);
    await waitFor(() => expect((selector as HTMLSelectElement).value).toBe("__unset__"));
    const user = userEvent.setup();
    await user.type(screen.getByLabelText("مبلغ المصروف"), "3");
    await user.selectOptions(selector, bank.id);
    await user.click(screen.getByRole("button", { name: "سجّل المصروف" }));
    await waitFor(() => expect(firstSubmitted.length).toBeGreaterThan(0));
    unmount();
    /* إعادة الفتح: العبارة المحايدة من جديد — لا تذكر آخر محفظة اختيرت. */
    const secondSubmitted: QuickActionReceipt[] = [];
    renderForm(
      [
        { id: drawer.id, name: "درج-FIN005" },
        { id: bank.id, name: "بنك-FIN005" },
      ],
      secondSubmitted,
    );
    const reopened = await screen.findByLabelText(/مصدر الصرف/);
    await waitFor(() => expect((reopened as HTMLSelectElement).value).toBe("__unset__"));
  });
});
