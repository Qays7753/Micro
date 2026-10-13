/** @vitest-environment jsdom */
/*
 * R10-B4 (F-020، 2026-10-12): اختبار مباشر لمحرر إكمال رصيد الافتتاح
 * اللاحق — الصفحة كانت بين الثلاث بلا اختبار مباشر (مرجع الاسم كان
 * إيجابية كاذبة). الرحلات: الجاهزية لمحفظة مجهولة الافتتاح (تحقق فارغ
 * ثم حفظ موثق ينقص ختم المجهول)، وحالة «معروف أصلًا»، وفشل القراءة
 * بصفة alert مع إعادة المحاولة — كلها عبر الخدمة الحقيقية فوق مخزن
 * الذاكرة.
 */
import React from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { usePrototypeServices } from "@/app/PrototypeServicesContext";
import { CashContinuityService } from "@/application/cash/cashContinuityService";
import { UnsavedChangesProvider } from "@/components/forms/UnsavedChangesGuard";
import { MemoryLocalStore } from "@/storage/local/MemoryLocalStore";
import CashOpeningLaterEditor from "@/pages/CashOpeningLaterEditor";

vi.mock("@/app/PrototypeServicesContext", () => ({
  usePrototypeServices: vi.fn(),
  getPrototypeLocalStore: () => currentStore,
}));

const wouterMocks = vi.hoisted(() => ({
  navigate: vi.fn(),
  location: "/cash",
  params: {} as Record<string, string>,
  search: "",
}));
vi.mock("wouter", () => ({
  useLocation: () => [wouterMocks.location, wouterMocks.navigate],
  useParams: () => wouterMocks.params,
  useSearch: () => wouterMocks.search,
}));

const mockedUsePrototypeServices = vi.mocked(usePrototypeServices);
const NOW = "2026-10-12T09:00:00.000Z";

let store: MemoryLocalStore;
let currentStore: MemoryLocalStore;
const bumpVersion = vi.fn();

class FailingOverviewStore extends MemoryLocalStore {
  failReads = true;
  override async listCashWallets() {
    if (this.failReads)
      return { ok: false as const, code: "storage_error" as const, message: "تعذر قراءة محافظ الكاش." };
    return super.listCashWallets();
  }
}

function services() {
  return {
    cashContinuity: new CashContinuityService(store, () => NOW),
    notifyDataChanged: bumpVersion,
    dataVersion: 0,
  };
}

function Harness() {
  return (
    <UnsavedChangesProvider navigate={wouterMocks.navigate}>
      <CashOpeningLaterEditor />
    </UnsavedChangesProvider>
  );
}

async function seedUnknownOpeningWallet(): Promise<string> {
  const cash = new CashContinuityService(store, () => NOW);
  const opened = await cash.openWallet({
    name: "درج المجهول",
    kind: "cash_drawer",
    openingMinor: 0,
    occurredOn: "2026-10-01",
    note: "بداية",
    operationKey: "seed-unknown-open",
    openingStatus: "unknown",
  });
  if (!opened.ok) throw new Error("seed openWallet failed");
  return opened.value.wallet.id;
}

async function seedKnownOpeningWallet(): Promise<string> {
  const cash = new CashContinuityService(store, () => NOW);
  const opened = await cash.openWallet({
    name: "حساب معروف",
    kind: "bank_account",
    openingMinor: 5000,
    occurredOn: "2026-10-01",
    note: "كشف البنك",
    operationKey: "seed-known-open",
  });
  if (!opened.ok) throw new Error("seed openWallet failed");
  return opened.value.wallet.id;
}

beforeEach(() => {
  store = new MemoryLocalStore();
  currentStore = store;
  wouterMocks.location = "/cash";
  wouterMocks.search = "";
  wouterMocks.params = {};
  wouterMocks.navigate.mockReset();
  bumpVersion.mockReset();
  mockedUsePrototypeServices.mockReturnValue(
    services() as unknown as ReturnType<typeof usePrototypeServices>,
  );
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("R10-B4/F-020 — CashOpeningLaterEditor direct journeys", () => {
  it("an unknown-opening wallet reaches the ready editor; premature save announces the validation errors", async () => {
    const walletId = await seedUnknownOpeningWallet();
    wouterMocks.params = { id: walletId };
    render(<Harness />);
    await waitFor(() => {
      expect(screen.getByText(/سجّل رصيد «درج المجهول» الموثق لاحقًا/)).toBeTruthy();
    });
    /* سبب فارغ — الحفظ المبكر يُعلن خطأ التحقق. */
    fireEvent.click(screen.getByRole("button", { name: /سجّل الرصيد الموثق/ }));
    const error = await screen.findByRole("alert");
    expect(error.textContent).toContain("سبب هذا الرصيد");
  });

  it("a documented opening (amount + reason) saves, notifies, and returns to the source", async () => {
    const walletId = await seedUnknownOpeningWallet();
    wouterMocks.params = { id: walletId };
    /* الرجوع للمصدر: الوصول من محافظ الكاش يحفظ ?returnTo — عقد التنقل
     * (المسار الحالي هو المحرر نفسه، لا الوجهة). */
    wouterMocks.location = `/cash/wallet/${walletId}/opening-later`;
    wouterMocks.search = "?returnTo=/cash";
    render(<Harness />);
    await waitFor(() => {
      expect(screen.getByText(/سجّل رصيد «درج المجهول» الموثق لاحقًا/)).toBeTruthy();
    });
    const amount = screen.getByLabelText("الرصيد الموثق");
    fireEvent.change(amount, { target: { value: "45" } });
    const reason = screen.getByPlaceholderText("مثال: عدّت الدرج يوم 20/08 ووجدت 45 دينارًا");
    fireEvent.change(reason, { target: { value: "عدّت الدرج صباح اليوم" } });
    fireEvent.click(screen.getByRole("button", { name: /سجّل الرصيد الموثق/ }));
    await waitFor(() => {
      expect(wouterMocks.navigate).toHaveBeenCalledWith("/cash");
    });
    expect(bumpVersion).toHaveBeenCalledTimes(1);
    /* الختم رُفع فعلًا: القراءة الجديدة تعرض المحفظة معروفة الافتتاح. */
    const cash = new CashContinuityService(store, () => NOW);
    const overview = await cash.overview();
    if (!overview.ok) throw new Error(overview.message);
    expect(overview.value.unknownOpeningCount).toBe(0);
  });

  it("a wallet with a known opening shows the honest already-known surface with the adjust action", async () => {
    const walletId = await seedKnownOpeningWallet();
    wouterMocks.params = { id: walletId };
    render(<Harness />);
    const heading = await screen.findByRole("heading", {
      name: "رصيد افتتاحي هذه المحفظة معروف أصلًا",
    });
    expect(heading).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "ضبط الكاش بسبب" }));
    expect(wouterMocks.navigate).toHaveBeenCalledWith(`/cash/wallet/${walletId}/adjust`);
  });

  it("a read failure renders its actual message with role=alert and retry recovers to ready", async () => {
    const failStore = new FailingOverviewStore();
    store = failStore;
    currentStore = failStore;
    mockedUsePrototypeServices.mockReturnValue(
      services() as unknown as ReturnType<typeof usePrototypeServices>,
    );
    wouterMocks.params = { id: "wallet-any" };
    render(<Harness />);
    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toContain("تعذر قراءة محافظ الكاش المحلية.");
    failStore.failReads = false;
    const walletId = await seedUnknownOpeningWallet();
    wouterMocks.params = { id: walletId };
    fireEvent.click(screen.getByRole("button", { name: "إعادة المحاولة" }));
    await waitFor(() => {
      expect(screen.getByText(/سجّل رصيد «درج المجهول» الموثق لاحقًا/)).toBeTruthy();
    });
  });
});
