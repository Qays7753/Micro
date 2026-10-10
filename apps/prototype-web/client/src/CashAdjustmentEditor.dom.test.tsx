/** @vitest-environment jsdom */
/*
 * R9-GA-F3.7 (WS-216/ARCH-007 — استمرار R9 الجذري): اختبار مباشر لآلة حالة
 * القراءة الصريحة في محرر ضبط الكاش — كان حارس العرض القديم يجعل المحفظة
 * المجهولة تحميلًا أبديًا ويبتلع فشل القراءة داخل سطح «لم نجد». الحدود
 * المختبرة عبر الخدمة الحقيقية فوق مخزن الذاكرة: التحميل ينتهي دائمًا،
 * العدم يظهر لمجهولة، والفشل يُعرض برسالته الفعلية بصفة alert مع إعادة
 * محاولة، ولا حفظ خارج الجاهزية.
 */
import React from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { usePrototypeServices } from "@/app/PrototypeServicesContext";
import { CashContinuityService } from "@/application/cash/cashContinuityService";
import { UnsavedChangesProvider } from "@/components/forms/UnsavedChangesGuard";
import { MemoryLocalStore } from "@/storage/local/MemoryLocalStore";
import CashAdjustmentEditor from "@/pages/CashAdjustmentEditor";

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
const NOW = "2026-10-11T09:00:00.000Z";

let store: MemoryLocalStore;
let currentStore: MemoryLocalStore;
const bumpVersion = vi.fn();

/* فشل قراءة واحد ثم نجاح عند إعادة المحاولة — برسالة الخدمة الفعلية نفسها
 * («تعذر قراءة محافظ الكاش المحلية.»)، والعلم داخل الاختبار وحده. */
class FailingOverviewStore extends MemoryLocalStore {
  failReads = true;
  override async listCashWallets() {
    if (this.failReads)
      return { ok: false as const, code: "storage_error" as const, message: "تعذر قراءة المحافظ." };
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
      <CashAdjustmentEditor />
    </UnsavedChangesProvider>
  );
}

async function seedWallet() {
  const cash = new CashContinuityService(store, () => NOW);
  const opened = await cash.openWallet({
    name: "درج الضبط",
    kind: "cash_drawer",
    openingMinor: 5_000,
    occurredOn: "2026-10-01",
    note: "بداية",
    operationKey: "f37-open",
  });
  if (!opened.ok) throw new Error(opened.message);
  return opened.value.wallet.id;
}

beforeEach(() => {
  store = new MemoryLocalStore();
  currentStore = store;
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

describe("CashAdjustmentEditor — explicit read state machine (R9-GA-F3.7)", () => {
  it("an unknown wallet id renders the not-found surface and ends loading — no write, no navigation", async () => {
    const walletId = await seedWallet();
    wouterMocks.params = { id: "missing-wallet" };
    render(<Harness />);
    expect(screen.getByRole("status")).toBeTruthy();
    expect(await screen.findByRole("heading", { name: "لم نجد محفظة الكاش" })).toBeTruthy();
    expect(screen.queryByRole("status")).toBeNull();
    expect(wouterMocks.navigate).not.toHaveBeenCalled();
    expect(bumpVersion).not.toHaveBeenCalled();
    const cash = new CashContinuityService(store, () => NOW);
    const entries = await cash.entries();
    expect(entries.ok && entries.value).toHaveLength(1);
    void walletId;
  });

  it("a read failure renders its actual message with role=alert plus retry — not the not-found surface (F3.1 family closed here)", async () => {
    const failStore = new FailingOverviewStore();
    store = failStore;
    currentStore = failStore;
    mockedUsePrototypeServices.mockReturnValue(
      services() as unknown as ReturnType<typeof usePrototypeServices>,
    );
    wouterMocks.params = { id: "any-wallet" };
    render(<Harness />);
    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toContain("تعذر قراءة محافظ الكاش المحلية.");
    expect(screen.queryByRole("heading", { name: "لم نجد محفظة الكاش" })).toBeNull();
    expect(wouterMocks.navigate).not.toHaveBeenCalled();
    expect(bumpVersion).not.toHaveBeenCalled();
    /* إعادة المحاولة تعود إلى التحميل ثم الجاهزية بصدق. */
    failStore.failReads = false;
    const walletId = await seedWallet();
    wouterMocks.params = { id: walletId };
    fireEvent.click(screen.getByRole("button", { name: "إعادة المحاولة" }));
    expect(await screen.findByRole("heading", { level: 1 })).toBeTruthy();
    await waitFor(() => {
      expect(screen.queryByRole("alert")).toBeNull();
    });
  });

  it("a ready wallet renders the adjustment form and the save guard blocks empty submissions with role=alert", async () => {
    const walletId = await seedWallet();
    wouterMocks.params = { id: walletId };
    render(<Harness />);
    expect(await screen.findByRole("button", { name: /حفظ ضبط الكاش/ })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /حفظ ضبط الكاش/ }));
    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toContain("أدخل فرق الكاش وسببًا وبيانًا قبل الحفظ.");
    expect(wouterMocks.navigate).not.toHaveBeenCalled();
    expect(bumpVersion).not.toHaveBeenCalled();
  });
});
