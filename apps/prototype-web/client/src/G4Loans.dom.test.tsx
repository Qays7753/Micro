/** @vitest-environment jsdom */

/* المجموعة ٤ (عقد ٢٩) — أسطح القروض بعد قرار UNIT-035/036 (تنفيذ S15 بالأمر
 * الموحد §5): إنشاء الإقراض ملغى والاقتراض مؤجل. الوصلة العميقة القديمة
 * ترفض رفضًا صادقًا بلا نموذج ولا «قريبًا»، وسطح القروض بلا مدخل إنشاء؛
 * السجل الموروث يُزرع عند حد المخزن (مسار توافق النقل نفسه) — السداد من
 * الورقة السفلية بمعاينة الأثر وحارس التجاوز، والتاريخ يبقى بعد التسديد. */
import React from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { usePrototypeServices } from "@/app/PrototypeServicesContext";
import { AssetService } from "@/application/assets/assetService";
import { LoanService } from "@/application/loans/loanService";
import { RetainedDepositService } from "@/application/financial-records/retainedDepositService";
import { CashContinuityService } from "@/application/cash/cashContinuityService";
import { MemoryLocalStore } from "@/storage/local/MemoryLocalStore";
import { FormDraftService } from "@/application/drafts/formDraftService";
import { UnsavedChangesProvider } from "@/components/forms/UnsavedChangesGuard";
import { createLoanRecord } from "@micro-domain/loan/index.js";
import { createFinancialEvent } from "@micro-domain/financial-event/index.js";
import Loans from "@/pages/Loans";
import LoanEditor from "@/pages/LoanEditor";
import LoanDetail from "@/pages/LoanDetail";
import RepaymentSheet from "@/components/loans/RepaymentSheet";

vi.mock("@/app/PrototypeServicesContext", () => ({
  usePrototypeServices: vi.fn(),
  /* الخدمات الديناميكية (القروض المستلمة) تُبنى فوق هذا المخزن — كما في
   * الإنتاج لكن فوق مخزن الذاكرة هنا. */
  getPrototypeLocalStore: () => store,
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
    formDrafts: new FormDraftService(store),
    loans,
    cashContinuity: new CashContinuityService(store, () => NOW),
    assets: new AssetService(store, () => NOW),
    retainedDeposits: new RetainedDepositService(store, () => NOW),
    dataVersion: version,
    notifyDataChanged: () => setVersion(current => current + 1),
  };
  return <UnsavedChangesProvider navigate={wouterMocks.navigate}>{page}</UnsavedChangesProvider>;
}

/* UNIT-035 (تنفيذ S15): بذرة القرض الموروث مباشرة عند حد المخزن — الإنشاء
 * ملغى، والبيانات هنا تاريخ محفوظ للقراءة والصيانة (سداد/تصحيح) لا جديد. */
async function seedLegacyLoan(input: { id: string; borrowerName: string; principalMinor: number }) {
  const event = createFinancialEvent({
    id: `event-${input.id}`,
    type: "loan_outgoing_cash" as never,
    amountMinor: input.principalMinor,
    occurredOn: "2026-07-01",
    recordedAt: "2026-07-01T09:00:00.000Z",
    idempotencyKey: `${input.id}:create`,
    note: `قرض تاريخي لـ ${input.borrowerName}`,
    counterparty: input.borrowerName,
    loanContext: { loanId: input.id, borrower: input.borrowerName },
  });
  const loan = createLoanRecord({
    id: input.id,
    borrowerName: input.borrowerName,
    principalMinor: input.principalMinor,
    loanDate: "2026-07-01",
    purposeNote: null,
    sourceWalletId: null,
    principalEventId: event.id,
    operationKey: `${input.id}:create`,
    createdAt: "2026-07-01T09:00:00.000Z",
  });
  const commit = await store.commitLoanRecord(loan, event);
  if (!commit.ok) throw new Error(commit.message);
  return loan.id;
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

describe("G4 loans surfaces (المجموعة ٤ — عقد ٢٩ · UNIT-035 بعد الإلغاء)", () => {
  it("UNIT-035: the legacy /loans/new deep link refuses honestly — no form, no write, no bypass", async () => {
    wouterMocks.location = "/loans/new";
    render(<Harness page={<LoanEditor />} />);
    expect(await screen.findByRole("heading", { name: "إنشاء الإقراض ملغى" })).toBeTruthy();
    expect(screen.getByText("لا يُنشأ إقراض جديد في هذا الإطلاق.")).toBeTruthy();
    /* لا نموذج إنشاء ولا زر حفظ — القدرة الملغاة لا تُعلن «قريبًا» ولا تُترك
     * مسار التفاف؛ الرابط يبقى مسجلًا ليرفض بصدق. */
    expect(screen.queryByLabelText("مبلغ القرض")).toBeNull();
    expect(screen.queryByPlaceholderText("مثال: أحمد، محمد، ورشة الجيران")).toBeNull();
    expect(screen.queryByRole("button", { name: /احفظ القرض/ })).toBeNull();
    /* لا كتابة أصلًا — المخزن فارغ بعد الزيارة. */
    const events = await store.listFinancialEvents();
    expect(events.ok && events.value).toHaveLength(0);
    const list = await store.listLoans();
    expect(list.ok && list.value).toHaveLength(0);
  });

  it("UNIT-035: the loans surface carries no creation entry point — history only, honestly worded", async () => {
    render(<Harness page={<Loans />} />);
    /* الحالة الفارغة تذكر الإلغاء بصدق ولا تدعو لإنشاء. */
    expect(
      await screen.findByText("إنشاء الإقراض ملغى من نطاق المنتج؛ ما سُجل سابقًا يبقى محفوظًا كما هو."),
    ).toBeTruthy();
    expect(screen.queryByRole("button", { name: /سجّل قرضًا/ })).toBeNull();
    expect(screen.queryByRole("button", { name: /سجّل قرضًا أخذته/ })).toBeNull();
    expect(screen.queryByRole("link", { name: /سجّل قرضًا/ })).toBeNull();
  });

  it("repays from the bottom sheet with preview and over-repayment guard on a legacy loan", async () => {
    const loanId = await seedLegacyLoan({ id: "loan-g4-1", borrowerName: "أحمد", principalMinor: 15000 });
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
    expect(list.value.find(record => record.id === loanId)!.repayments).toHaveLength(1);
  });

  it("keeps a settled legacy loan visible in history with its payments", async () => {
    const loanId = await seedLegacyLoan({ id: "loan-g4-2", borrowerName: "سالم", principalMinor: 5000 });
    await loans.recordRepayment(loanId, { amountMinor: 5000, date: "2026-08-01" });
    wouterMocks.location = `/loans/${loanId}`;
    window.history.pushState({}, "", `/loans/${loanId}`);
    render(<Harness page={<LoanDetail />} />);
    expect(await screen.findByText(/مسدَّد بالكامل — يبقى في التاريخ/)).toBeTruthy();
    expect(await screen.findByText(/دفعات السداد \(1\)/)).toBeTruthy();
  });

  it("ignores a second confirm while the first repayment is still in flight (G6/A2)", async () => {
    let resolveRepay!: (value: unknown) => void;
    const repayPromise = new Promise(resolve => {
      resolveRepay = resolve;
    });
    const recordRepayment = vi.fn(() => repayPromise);
    loans = { recordRepayment } as unknown as LoanService;
    const onDone = vi.fn();
    const row = {
      loan: { id: "loan-1", borrowerName: "أحمد" },
      reading: { principalMinor: 15000, repaidActiveMinor: 0, outstandingMinor: 15000 },
    } as unknown as Parameters<typeof RepaymentSheet>[0]["row"];
    render(
      <Harness page={<RepaymentSheet service={loans} row={row} onClose={() => {}} onDone={onDone} />} />,
    );
    const amount = await screen.findByLabelText("مبلغ الدفعة");
    fireEvent.change(amount, { target: { value: "50" } });
    fireEvent.blur(amount);
    /* عقد ظاهر للمستخدم: نبضات متعددة قبل اكتمال الأولى تكتب دفعة واحدة فقط —
     * يتحقق بطبقتين: تعطيل الزر أثناء الحفظ، وعهدة الإرسال المتزامن (G6/A2).
     * هنا نثبّت العقد الظاهر: لا كتابة مزدوجة مهما تكرر النقر. */
    const confirm = await screen.findByRole("button", { name: /أكّد السداد/ });
    fireEvent.click(confirm);
    fireEvent.click(confirm);
    fireEvent.click(confirm);
    expect(recordRepayment).toHaveBeenCalledTimes(1);
    resolveRepay({ ok: true, value: { loan: row.loan, event: null } });
    await waitFor(() => expect(onDone).toHaveBeenCalled());
  });
});
