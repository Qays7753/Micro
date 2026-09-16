/** @vitest-environment jsdom */

/* FIN-005 (قرار المالك المعتمد ٢٠٢٦-٠٩-١٦): قواعد مصدر صرف المصروف السريع —
 * بلا محافظ: تحذير معلن والصرف من غير الموزع؛ محفظة واحدة: تعيين مسبق مرئي
 * مع خيار صريح لغير الموزع؛ محافظ متعددة: اختيار إلزامي (محفظة أو الكاش
 * غير الموزع) ولا تُذكر آخر محفظة. المحفظة المختارة هي وجهة التخصيص
 * الفعلية المخزنة. */
import React from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
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
  /* EXE-007: الوصف إلزامي في المدخلين — القاعدة الموحدة من expenseFormModel. */
  await user.type(screen.getByLabelText(/البند/), "أكياس تغليف");
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
    /* المحاولة بلا اختيار تُرفض بلا أي كتابة — الوصف المطلوب مُدخل أولًا
     * فالرفض سببه قاعدة المحفظة لا حقلًا ناقصًا (EXE-007: قاعدة واحدة). */
    const user = userEvent.setup();
    await user.type(screen.getByLabelText("مبلغ المصروف"), "3");
    await user.type(screen.getByLabelText(/البند/), "أكياس تغليف");
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
    /* EXE-007: الوصف إلزامي في المدخلين — القاعدة الموحدة. */
    await user.type(screen.getByLabelText(/البند/), "أكياس تغليف");
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

describe("EXE-007 — quick sheet is the compact mode of the same expense journey", () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it("requires the note in the quick sheet too — no manufactured text attributed to the owner", async () => {
    const submitted: QuickActionReceipt[] = [];
    renderForm([], submitted);
    const user = userEvent.setup();
    await user.type(screen.getByLabelText("مبلغ المصروف"), "3");
    await user.click(screen.getByRole("button", { name: "سجّل المصروف" }));
    expect(
      await screen.findByText("اكتب ما حدث قبل الحفظ؛ الوصف جزء من السجل المالي."),
    ).toBeTruthy();
    expect(submitted).toHaveLength(0);
    /* لا يوجد أي حدث مالي مكتوب — القاعدة أوقفت الكتابة قبل الخدمة. */
    const events = await store.listFinancialEvents();
    expect(events.ok && events.value).toHaveLength(0);
  });

  it("records with the owner's own note — the saved event carries it verbatim", async () => {
    const submitted: QuickActionReceipt[] = [];
    renderForm([], submitted);
    const user = userEvent.setup();
    await user.type(screen.getByLabelText("مبلغ المصروف"), "3");
    await user.type(screen.getByLabelText(/البند/), "أكياس تغليف للمشروع");
    await user.click(screen.getByRole("button", { name: "سجّل المصروف" }));
    await waitFor(() => expect(submitted.length).toBeGreaterThan(0));
    const events = await store.listFinancialEvents();
    const event = events.ok ? events.value[0] : null;
    expect(event).not.toBeNull();
    expect(event!.note).toBe("أكياس تغليف للمشروع");
  });

  it("edits the date like the guided editor — a past date flows to the saved event", async () => {
    const submitted: QuickActionReceipt[] = [];
    renderForm([], submitted);
    const user = userEvent.setup();
    await user.type(screen.getByLabelText("مبلغ المصروف"), "3");
    await user.type(screen.getByLabelText(/البند/), "مصروف بتاريخ ماض");
    const dateField = await screen.findByLabelText(/تاريخ المصروف/);
    await user.clear(dateField);
    await user.type(dateField, "2026-09-01");
    await user.click(screen.getByRole("button", { name: "سجّل المصروف" }));
    await waitFor(() => expect(submitted.length).toBeGreaterThan(0));
    const events = await store.listFinancialEvents();
    const event = events.ok ? events.value[0] : null;
    expect(event).not.toBeNull();
    expect(event!.occurredOn).toBe("2026-09-01");
  });

  it("double-clicking save records one expense and one wallet coverage only", async () => {
    const wallet = await openWallet("درج-EXE007", 10000);
    const submitted: QuickActionReceipt[] = [];
    renderForm([{ id: wallet.id, name: "درج-EXE007" }], submitted);
    const user = userEvent.setup();
    await user.type(screen.getByLabelText("مبلغ المصروف"), "3");
    await user.type(screen.getByLabelText(/البند/), "نقرة مزدوجة");
    const saveButton = screen.getByRole("button", { name: "سجّل المصروف" });
    /* نقرتان متتابعتان قبل اكتمال الأولى — عهدة التزامن + مفتاح الحتمية. */
    fireEvent.click(saveButton);
    fireEvent.click(saveButton);
    await waitFor(() => expect(submitted.length).toBeGreaterThan(0));
    await waitFor(() => expect(screen.getByRole("button", { name: "سجّل المصروف" }).getAttribute("disabled")).toBeNull());
    const events = await store.listFinancialEvents();
    expect(events.ok && events.value).toHaveLength(1);
    const entries = await store.listCashContinuityEntries();
    /* افتتاح المحفظة + تغطية واحدة فقط — لا تكرار أثر. */
    expect(entries.ok && entries.value).toHaveLength(2);
    const position = await projectFinance.readPosition();
    if (!position.ok) throw new Error(position.message);
    expect(position.value.walletCashMinor).toBe(9700);
    expect(position.value.recordedCashMinor).toBe(9700);
  });

  it("produces an equivalent event to the guided editor for the same expense", async () => {
    /* نفس المصروف (مبلغ/وصف/تاريخ/تصنيف/غير موزع) من الورقة السريعة ثم من
     * المحرر الموجه — النموذجان يكتبان عبر الخدمة نفسها بقيم متكافئة:
     * النوع والدلتا والرصيد والوصف والتصنيف الافتراضي متطابقة. */
    const submitted: QuickActionReceipt[] = [];
    renderForm([], submitted);
    const user = userEvent.setup();
    await user.type(screen.getByLabelText("مبلغ المصروف"), "4");
    await user.type(screen.getByLabelText(/البند/), "توصيل طلبات");
    const dateField = await screen.findByLabelText(/تاريخ المصروف/);
    await user.clear(dateField);
    await user.type(dateField, "2026-09-10");
    await user.click(screen.getByRole("button", { name: "سجّل المصروف" }));
    await waitFor(() => expect(submitted.length).toBeGreaterThan(0));
    const quickEvents = await store.listFinancialEvents();
    const quickEvent = quickEvents.ok ? quickEvents.value[0] : null;
    expect(quickEvent).not.toBeNull();

    /* المحرر الموجه: نفس المدخلات عبر مساره هو — التصنيف الافتراضي هناك
     * (مشروع/غير معروف/عام/معروف) هو نفسه تصنيف الوضع المختصر. */
    const guidedRecord = await projectFinance.record({
      type: "operating_expense_cash",
      amountMinor: 400,
      occurredOn: "2026-09-10",
      note: "توصيل طلبات",
      counterparty: null,
      relatedEventId: null,
      expenseContext: {
        relationship: "project",
        behavior: "unknown",
        purpose: "project_general",
        knowledge: "known",
        sharedProjectShare: null,
        categoryLabel: null,
      },
      idempotencyKey: "guided-equi-key",
    });
    expect(guidedRecord.ok).toBe(true);
    const guidedEvent = guidedRecord.ok ? guidedRecord.value : null;
    expect(guidedEvent).not.toBeNull();
    /* التكافؤ: نفس النوع والمبلغ والتاريخ والوصف والسياق والدلتا. */
    expect(quickEvent!.type).toBe(guidedEvent!.type);
    expect(quickEvent!.amountMinor).toBe(guidedEvent!.amountMinor);
    expect(quickEvent!.occurredOn).toBe(guidedEvent!.occurredOn);
    expect(quickEvent!.note).toBe(guidedEvent!.note);
    expect(quickEvent!.cashDeltaMinor).toBe(guidedEvent!.cashDeltaMinor);
    expect(quickEvent!.operatingExpenseDeltaMinor).toBe(guidedEvent!.operatingExpenseDeltaMinor);
    expect(quickEvent!.expenseContext).toEqual(guidedEvent!.expenseContext);
  });
});
