/** @vitest-environment jsdom */

/* التحصين الكامل (المجموعة ٣): رحلة مالية من طبقة الكاش — صفحة تحويل بين
 * المحافظ تُختبر عبر الحدود الحقيقية (تفاعل ← خدمة ← مخزن): نجاح موثق
 * بزوج حركة واحد (مصدر سالب ووجهة موجبة) وبقية الكاش الكلي، وفشل تحقق
 * بلا أي كتابة جزئية، والزر معطّل أثناء التنفيذ. تمثّل بقية أسطح الكاش
 * (العدّ والتوزيع والتسوية والمراجعة) بالتغطية الخدمية-المخزنية نفسها —
 * موثقة كتأجيل صادق في §32. */
import React from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { usePrototypeServices } from "@/app/PrototypeServicesContext";
import { CashContinuityService } from "@/application/cash/cashContinuityService";
import { UnsavedChangesProvider } from "@/components/forms/UnsavedChangesGuard";
import { MemoryLocalStore } from "@/storage/local/MemoryLocalStore";
import CashTransferEditor from "@/pages/CashTransferEditor";

vi.mock("@/app/PrototypeServicesContext", () => ({
  usePrototypeServices: vi.fn(),
}));

const wouterMocks = vi.hoisted(() => ({
  navigate: vi.fn(),
  location: "/cash/transfer",
  params: {} as Record<string, string>,
}));
vi.mock("wouter", () => ({
  useLocation: () => [wouterMocks.location, wouterMocks.navigate],
  useParams: () => wouterMocks.params,
  useSearch: () => {
    const query = wouterMocks.location.split("?")[1] ?? "";
    return query ? `?${query}` : "";
  },
}));

const mockedUsePrototypeServices = vi.mocked(usePrototypeServices);
const NOW = "2026-09-11T09:00:00.000Z";

let store: MemoryLocalStore;
const contextRef: { current: Record<string, unknown> } = { current: {} };

function Harness({ page }: { page: React.ReactNode }) {
  const [version, setVersion] = React.useState(0);
  contextRef.current = {
    cashContinuity: new CashContinuityService(store, () => NOW),
    dataVersion: version,
    notifyDataChanged: () => setVersion(current => current + 1),
  };
  return <UnsavedChangesProvider navigate={wouterMocks.navigate}>{page}</UnsavedChangesProvider>;
}

async function openTwoWallets() {
  const cash = new CashContinuityService(store, () => NOW);
  const drawer = await cash.openWallet({
    name: "درج",
    kind: "cash_drawer",
    openingMinor: 50000,
    occurredOn: "2026-09-01",
    note: "رصيد بداية",
    operationKey: "g3-open-drawer",
  });
  if (!drawer.ok) throw new Error(drawer.message);
  const bank = await cash.openWallet({
    name: "حساب بنكي",
    kind: "bank_account",
    openingMinor: 20000,
    occurredOn: "2026-09-01",
    note: "رصيد بداية",
    operationKey: "g3-open-bank",
  });
  if (!bank.ok) throw new Error(bank.message);
}

describe("G3 hardening — cash transfer journey (page → service → store)", () => {
  beforeEach(() => {
    store = new MemoryLocalStore();
    wouterMocks.location = "/cash/transfer";
    wouterMocks.navigate.mockReset();
  });
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it("successful transfer: one operation, mirror pair of entries, total cash unchanged, wallet balances move", async () => {
    await openTwoWallets();
    mockedUsePrototypeServices.mockImplementation(
      () => contextRef.current as unknown as ReturnType<typeof usePrototypeServices>,
    );
    render(<Harness page={<CashTransferEditor />} />);
    await screen.findByRole("heading", { name: "حوّل كاشًا بين محافظك" });

    fireEvent.change(screen.getByLabelText("مبلغ التحويل"), { target: { value: "25.00" } });
    fireEvent.change(screen.getByPlaceholderText("مثال: أودعت كاش الدرج في الحساب البنكي"), {
      target: { value: "إيداع نهاية اليوم" },
    });
    fireEvent.click(screen.getByRole("button", { name: "حفظ التحويل" }));

    await waitFor(() => expect(wouterMocks.navigate).toHaveBeenCalledTimes(1));
    /* المخزن: حركتان متناظرتان (زوج التحويل) لا أكثر — والمجموع الكلي محفوظ. */
    const entries = await store.listCashContinuityEntries();
    if (!entries.ok) throw new Error(entries.message);
    const transferEntries = entries.value.filter(e => e.note === "إيداع نهاية اليوم");
    expect(transferEntries).toHaveLength(2);
    const delta = transferEntries.reduce((sum, entry) => sum + entry.cashDeltaMinor, 0);
    expect(delta).toBe(0);
    const overview = await new CashContinuityService(store, () => NOW).overview();
    if (!overview.ok) throw new Error(overview.message);
    expect(overview.value.totalWalletCashMinor).toBe(70000);
    const drawer = overview.value.wallets.find(w => w.name === "درج")!;
    const bank = overview.value.wallets.find(w => w.name === "حساب بنكي")!;
    expect(drawer.balanceMinor).toBe(47500);
    expect(bank.balanceMinor).toBe(22500);
  });

  it("validation failure: honest error with no partial write to the store", async () => {
    await openTwoWallets();
    mockedUsePrototypeServices.mockImplementation(
      () => contextRef.current as unknown as ReturnType<typeof usePrototypeServices>,
    );
    render(<Harness page={<CashTransferEditor />} />);
    await screen.findByRole("heading", { name: "حوّل كاشًا بين محافظك" });

    /* مبلغ بلا بيان: الرفض بلا كتابة. */
    fireEvent.change(screen.getByLabelText("مبلغ التحويل"), { target: { value: "25.00" } });
    fireEvent.click(screen.getByRole("button", { name: "حفظ التحويل" }));
    const error = await screen.findByRole("alert");
    expect(error.textContent).toContain("أدخل مبلغ التحويل وبيانًا قصيرًا");
    expect(wouterMocks.navigate).not.toHaveBeenCalled();
    const entries = await store.listCashContinuityEntries();
    if (!entries.ok) throw new Error(entries.message);
    /* فتحتا المحفظتين فقط — لا حركة تحويل. */
    expect(entries.value.filter(e => e.type === "transfer_out" || e.type === "transfer_in")).toHaveLength(0);
  });

  it("rapid repeated activation: busy button prevents duplicate transfer pairs", async () => {
    await openTwoWallets();
    mockedUsePrototypeServices.mockImplementation(
      () => contextRef.current as unknown as ReturnType<typeof usePrototypeServices>,
    );
    render(<Harness page={<CashTransferEditor />} />);
    await screen.findByRole("heading", { name: "حوّل كاشًا بين محافظك" });

    fireEvent.change(screen.getByLabelText("مبلغ التحويل"), { target: { value: "10.00" } });
    fireEvent.change(screen.getByPlaceholderText("مثال: أودعت كاش الدرج في الحساب البنكي"), {
      target: { value: "نقر مزدوج" },
    });
    const saveButton = screen.getByRole("button", { name: "حفظ التحويل" }) as HTMLButtonElement;
    fireEvent.click(saveButton);
    expect(saveButton.disabled).toBe(true);
    fireEvent.click(saveButton);

    await waitFor(() => expect(wouterMocks.navigate).toHaveBeenCalledTimes(1));
    const entries = await store.listCashContinuityEntries();
    if (!entries.ok) throw new Error(entries.message);
    expect(entries.value.filter(e => e.note === "نقر مزدوج")).toHaveLength(2);
    const overview = await new CashContinuityService(store, () => NOW).overview();
    if (!overview.ok) throw new Error(overview.message);
    expect(overview.value.totalWalletCashMinor).toBe(70000);
  });
});
