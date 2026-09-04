/** @vitest-environment jsdom */

/* المجموعة ٤ (عقد ٢٩ — اختبارات سطوح القروض): رحلة «هل أعطيت هذا المبلغ
 * كقرض؟» بمعاينة صريحة (لا ربح ولا مصروف)، وسداد دفعة من ورقة سفلية
 * بمعاينة الأثر وحارس التجاوز — والتاريخ يبقى بعد التسديد. */
import React from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { usePrototypeServices } from "@/app/PrototypeServicesContext";
import { AssetService } from "@/application/assets/assetService";
import { LoanService } from "@/application/loans/loanService";
import { RetainedDepositService } from "@/application/finance/retainedDepositService";
import { CashContinuityService } from "@/application/cash/cashContinuityService";
import { MemoryLocalStore } from "@/storage/local/MemoryLocalStore";
import { UnsavedChangesProvider } from "@/components/forms/UnsavedChangesGuard";
import Loans from "@/pages/Loans";
import LoanEditor from "@/pages/LoanEditor";
import LoanDetail from "@/pages/LoanDetail";

vi.mock("@/app/PrototypeServicesContext", () => ({
  usePrototypeServices: vi.fn(),
}));

const wouterMocks = vi.hoisted(() => ({
  navigate: vi.fn(),
  location: "/loans",
  params: {} as Record<string, string>,
}));
vi.mock("wouter", () => ({
  useLocation: () => [wouterMocks.location, wouterMocks.navigate],
  useParams: () => wouterMocks.params,
  useSearch: () => "",
}));

const mockedUsePrototypeServices = vi.mocked(usePrototypeServices);
const NOW = "2026-09-04T10:00:00.000Z";

let store: MemoryLocalStore;
let loans: LoanService;
const contextRef: { current: Record<string, unknown> } = { current: {} };

function Harness({ page }: { page: React.ReactNode }) {
  const [version, setVersion] = React.useState(0);
  contextRef.current = {
    loans,
    cashContinuity: new CashContinuityService(store, () => NOW),
    assets: new AssetService(store, () => NOW),
    retainedDeposits: new RetainedDepositService(store, () => NOW),
    dataVersion: version,
    notifyDataChanged: () => setVersion(current => current + 1),
  };
  return <UnsavedChangesProvider navigate={wouterMocks.navigate}>{page}</UnsavedChangesProvider>;
}

beforeEach(() => {
  store = new MemoryLocalStore();
  loans = new LoanService(store, () => NOW);
  wouterMocks.location = "/loans";
  wouterMocks.navigate.mockClear();
  vi.clearAllMocks();
  mockedUsePrototypeServices.mockImplementation(
    () => contextRef.current as unknown as ReturnType<typeof usePrototypeServices>,
  );
});
afterEach(cleanup);

describe("G4 loans surfaces (المجموعة ٤ — عقد ٢٩)", () => {
  it("records a loan through the honest journey: cash out, not profit, not expense", async () => {
    wouterMocks.location = "/loans/new";
    render(<Harness page={<LoanEditor />} />);
    fireEvent.change(await screen.findByPlaceholderText("مثال: أحمد، محمد، ورشة الجيران"), {
      target: { value: "أحمد" },
    });
    const amount = await screen.findByLabelText("مبلغ القرض");
    fireEvent.change(amount, { target: { value: "150" } });
    fireEvent.blur(amount);
    /* معاينة الأثر قبل الحفظ — إعلان المبدأ بالنص نفسه. */
    expect(await screen.findByText(/لا يُخصم من ربحك — مالك ما زال لك، لكن عند غيره/)).toBeTruthy();
    fireEvent.click(await screen.findByRole("button", { name: /احفظ القرض/ }));
    await waitFor(() => expect(wouterMocks.navigate).toHaveBeenCalled());
    const events = await store.listFinancialEvents();
    if (!events.ok) throw new Error(events.message);
    const principal = events.value.find(event => event.type === "loan_outgoing_cash");
    expect(principal).toBeTruthy();
    expect(principal!.cashDeltaMinor).toBe(-15000);
    expect(principal!.loanDeltaMinor).toBe(15000);
    const list = await store.listLoans();
    if (!list.ok) throw new Error(list.message);
    expect(list.value).toHaveLength(1);
  });

  it("repays from the bottom sheet with preview and over-repayment guard", async () => {
    const created = await loans.create({ borrowerName: "أحمد", principalMinor: 15000, loanDate: "2026-07-01" });
    if (!created.ok) return;
    render(<Harness page={<Loans />} />);
    expect(await screen.findByText("أحمد")).toBeTruthy();
    fireEvent.click(await screen.findByRole("button", { name: /سجّل دفعة/ }));
    /* الورقة تعرض الأصل والمسدَّد والمتبقي قبل أي تأكيد. */
    expect(await screen.findByText(/سداد دفعة من قرض أحمد/)).toBeTruthy();
    expect(screen.getAllByText(/المتبقي/).length).toBeGreaterThan(0);
    const amount = await screen.findByLabelText("مبلغ الدفعة");
    fireEvent.change(amount, { target: { value: "200" } });
    fireEvent.blur(amount);
    fireEvent.click(await screen.findByRole("button", { name: /أكّد السداد/ }));
    expect(await screen.findByRole("alert")).toBeTruthy();
    /* التجاوز مرفوض بلا كتابة. */
    const events = await store.listFinancialEvents();
    if (!events.ok) throw new Error(events.message);
    expect(events.value.filter(event => event.type === "loan_repayment_cash")).toHaveLength(0);
    /* السداد الصحيح يكتب مرة واحدة. */
    fireEvent.change(amount, { target: { value: "50" } });
    fireEvent.blur(amount);
    fireEvent.click(await screen.findByRole("button", { name: /أكّد السداد/ }));
    await waitFor(async () => {
      const after = await store.listFinancialEvents();
      if (!after.ok) throw new Error(after.message);
      expect(after.value.filter(event => event.type === "loan_repayment_cash")).toHaveLength(1);
    });
    const list = await store.listLoans();
    if (!list.ok) throw new Error(list.message);
    expect(list.value[0]!.repayments).toHaveLength(1);
  });

  it("keeps a settled loan visible in history with its payments", async () => {
    const created = await loans.create({ borrowerName: "سالم", principalMinor: 5000, loanDate: "2026-07-01" });
    if (!created.ok) return;
    await loans.recordRepayment(created.value.loan.id, { amountMinor: 5000, date: "2026-08-01" });
    wouterMocks.location = `/loans/${created.value.loan.id}`;
    window.history.pushState({}, "", `/loans/${created.value.loan.id}`);
    render(<Harness page={<LoanDetail />} />);
    expect(await screen.findByText(/مسدَّد بالكامل — يبقى في التاريخ/)).toBeTruthy();
    expect(await screen.findByText(/دفعات السداد \(1\)/)).toBeTruthy();
  });
});
