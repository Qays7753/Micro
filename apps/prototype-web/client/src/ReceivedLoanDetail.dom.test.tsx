/** @vitest-environment jsdom */
/*
 * R9-W3 (WS-216/ARCH-007): اختبار مباشر لحدود صفحة تفصيل القرض المستلم —
 * القراءة المشتقة الحية، الخطأ الصادق لقرض غير موجود مع إعادة المحاولة،
 * تصحيح بيانات القرض بعكس وبديل موثقين، والتراجع المضمن لدفعة السداد مع
 * استعادة الالتزام القائم. الخدمة تُحمَّل ديناميكيًا فوق المخزن الوحيد
 * (سابقة EXE-014) — السياق يموّن المخزن والقراءة عبر getPrototypeLocalStore.
 */
import React from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getPrototypeLocalStore, usePrototypeServices } from "@/app/PrototypeServicesContext";
import { UnsavedChangesProvider } from "@/components/forms/UnsavedChangesGuard";
import { MemoryLocalStore } from "@/storage/local/MemoryLocalStore";
import ReceivedLoanDetail from "@/pages/ReceivedLoanDetail";

vi.mock("@/app/PrototypeServicesContext", () => ({
  usePrototypeServices: vi.fn(),
  getPrototypeLocalStore: () => currentStore,
}));

const wouterMocks = vi.hoisted(() => ({
  navigate: vi.fn(),
  location: "/",
  params: {} as Record<string, string>,
  search: "",
}));
vi.mock("wouter", () => ({
  useLocation: () => [wouterMocks.location, wouterMocks.navigate],
  useParams: () => wouterMocks.params,
  useSearch: () => wouterMocks.search,
}));

const mockedUsePrototypeServices = vi.mocked(usePrototypeServices);
const NOW = "2026-10-10T09:00:00.000Z";

let store: MemoryLocalStore;
let currentStore: MemoryLocalStore;
const bumpVersion = vi.fn();

beforeEach(() => {
  store = new MemoryLocalStore();
  currentStore = store;
  wouterMocks.search = "";
  wouterMocks.navigate.mockReset();
  bumpVersion.mockReset();
  mockedUsePrototypeServices.mockReturnValue({
    notifyDataChanged: bumpVersion,
    dataVersion: 0,
  } as unknown as ReturnType<typeof usePrototypeServices>);
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  window.history.replaceState(null, "", "/");
});

function Harness() {
  return (
    <UnsavedChangesProvider navigate={wouterMocks.navigate}>
      <ReceivedLoanDetail />
    </UnsavedChangesProvider>
  );
}

async function seedLoan(): Promise<string> {
  const { ReceivedLoanService } = await import("@/application/loans");
  const loans = new ReceivedLoanService(getPrototypeLocalStore(), () => NOW);
  const created = await loans.create({
    lenderName: "سارة",
    lenderType: "person",
    principalMinor: 8_000,
    receivedOn: "2026-09-01",
    dueOn: null,
    note: null,
  });
  if (!created.ok) throw new Error(created.message);
  return created.value.loan.id;
}

describe("ReceivedLoanDetail — direct page-boundary behavior (R9-W3)", () => {
  it("shows the live derived reading of the outstanding commitment for a created loan", async () => {
    const loanId = await seedLoan();
    window.history.replaceState(null, "", `/loans/received/${loanId}`);
    render(<Harness />);
    expect(await screen.findByRole("heading", { name: "سارة" })).toBeTruthy();
    expect(screen.getByText("قرض مستلم قائم")).toBeTruthy();
    expect(document.body.textContent ?? "").toMatch(/80(\.00)?/);
  });

  it("shows the honest error surface with a retry action for an unknown loan id", async () => {
    window.history.replaceState(null, "", "/loans/received/missing-loan");
    render(<Harness />);
    const retry = await screen.findByRole("button", { name: /إعادة المحاولة/ });
    expect(retry).toBeTruthy();
    expect(document.querySelector(".micro-field-error")).toBeTruthy();
    expect(wouterMocks.navigate).not.toHaveBeenCalled();
  });

  it("corrects the lender through the documented reverse-and-replace flow and updates the live reading", async () => {
    const loanId = await seedLoan();
    window.history.replaceState(null, "", `/loans/received/${loanId}`);
    render(<Harness />);
    fireEvent.click(await screen.findByRole("button", { name: /صحِّح بيانات القرض المستلم/ }));
    const lenderInput = await screen.findByLabelText("اسم المُقرض");
    fireEvent.change(lenderInput, { target: { value: "سارة الياسين" } });
    const reasonInput = await screen.findByPlaceholderText("مثال: المبلغ الصحيح 500 لا 450");
    fireEvent.change(reasonInput, { target: { value: "تصحيح اسم المُقرض" } });
    fireEvent.click(screen.getByRole("button", { name: /احفظ التصحيح/ }));
    expect(await screen.findByRole("heading", { name: "سارة الياسين" })).toBeTruthy();
    expect(bumpVersion).toHaveBeenCalled();
    /* التاريخ محفوظ: حدث القبض الأصلي + العكس + البديل ثلاثتها حية. */
    const { ReceivedLoanService } = await import("@/application/loans");
    const reader = new ReceivedLoanService(getPrototypeLocalStore(), () => NOW);
    const read = await reader.read(loanId);
    if (!read.ok) throw new Error(read.message);
    expect(read.value.loan.lenderName).toBe("سارة الياسين");
    expect(read.value.events.length).toBeGreaterThanOrEqual(3);
  });

  it("reverses a recorded repayment inline and restores the outstanding commitment", async () => {
    const loanId = await seedLoan();
    const { ReceivedLoanService } = await import("@/application/loans");
    const loans = new ReceivedLoanService(getPrototypeLocalStore(), () => NOW);
    const repaid = await loans.recordRepayment(loanId, {
      amountMinor: 3_000,
      date: "2026-10-05",
      note: "دفعة أولى",
    });
    if (!repaid.ok) throw new Error(repaid.message);
    window.history.replaceState(null, "", `/loans/received/${loanId}`);
    render(<Harness />);
    /* قبل التراجع: الالتزام القائم انقص بقيمة الدفعة (8,000 − 3,000 = 5,000). */
    await screen.findByRole("heading", { name: "سارة" });
    expect(document.body.textContent ?? "").toMatch(/50(\.00)?/);
    fireEvent.click(screen.getByRole("button", { name: /^تراجع$/ }));
    const reason = await screen.findByLabelText("سبب تراجع الدفعة");
    fireEvent.change(reason, { target: { value: "دفعة مسجلة بالخطأ" } });
    fireEvent.click(screen.getByRole("button", { name: /أكّد التراجع/ }));
    await waitFor(() => expect(bumpVersion).toHaveBeenCalled());
    /* بعد التراجع الموثق: الدفعة معكوسة والالتزام القائم عاد إلى 8,000. */
    expect(await screen.findByText(/معكوسة موثقة/)).toBeTruthy();
    expect(document.body.textContent ?? "").toMatch(/80(\.00)?/);
    const reader = new ReceivedLoanService(getPrototypeLocalStore(), () => NOW);
    const read = await reader.read(loanId);
    if (!read.ok) throw new Error(read.message);
    expect(read.value.reading.outstandingMinor).toBe(8_000);
    expect(read.value.loan.repayments[0]?.reversal?.reason).toBe("دفعة مسجلة بالخطأ");
  });
});
