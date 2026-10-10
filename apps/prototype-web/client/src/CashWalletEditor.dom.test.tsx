/** @vitest-environment jsdom */
/*
 * R9-W3 (WS-216/ARCH-007): اختبار مباشر لحدود صفحة محفظة الكاش — الرحلة
 * الحقيقية عبر الصفحة والخدمة فوق مخزن الذاكرة: بوابة التحقق قبل أي كتابة،
 * إنشاء المحفظة برصيد بداية معلن وقراءة الأثر المجتزأ (الاسم والقيمة
 * والنوع) بخدمة ثانية، وعقد الخروج (?returnTo) والإشعار. لا مساس بأي
 * كود إنتاج ولا CSS/DOM/نصوص.
 */
import React from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { usePrototypeServices } from "@/app/PrototypeServicesContext";
import { CashContinuityService } from "@/application/cash/cashContinuityService";
import { UnsavedChangesProvider } from "@/components/forms/UnsavedChangesGuard";
import { MemoryLocalStore } from "@/storage/local/MemoryLocalStore";
import CashWalletEditor from "@/pages/CashWalletEditor";

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
      <CashWalletEditor />
    </UnsavedChangesProvider>
  );
}

beforeEach(() => {
  store = new MemoryLocalStore();
  currentStore = store;
  wouterMocks.search = "";
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

describe("CashWalletEditor — direct page-boundary behavior (R9-W3)", () => {
  it("creates a wallet with its declared opening balance through the page and the effect is readable by a second service instance", async () => {
    wouterMocks.search = "?returnTo=/cash";
    render(<Harness />);
    fireEvent.change(screen.getByPlaceholderText("مثال: درج الورشة"), {
      target: { value: "درج الرحلة المباشرة" },
    });
    fireEvent.change(screen.getByLabelText("رصيد البداية"), { target: { value: "75" } });
    fireEvent.change(screen.getByPlaceholderText("مثال: عدّ الدرج في بداية استخدام Micro"), {
      target: { value: "عدّ أولي مباشر" },
    });
    fireEvent.click(screen.getByRole("button", { name: /حفظ محفظة ورصيد البداية/ }));
    await waitFor(() => expect(wouterMocks.navigate).toHaveBeenCalled());
    expect(bumpVersion).toHaveBeenCalled();
    /* عقد الخروج بعد حفظ ناجح: العودة إلى المصدر (?returnTo). */
    expect(wouterMocks.navigate).toHaveBeenCalledWith("/cash");
    /* الأثر المجتزأ عبر خدمة ثانية — الاسم وقيمة رصيد البداية (75 د.أ = 7,500 minor). */
    const reader = new CashContinuityService(store, () => NOW);
    const overview = await reader.overview();
    if (!overview.ok) throw new Error(overview.message);
    const wallet = overview.value.wallets.find(candidate => candidate.name === "درج الرحلة المباشرة");
    expect(wallet).toBeDefined();
    const entries = await reader.entries();
    if (!entries.ok) throw new Error(entries.message);
    const opening = entries.value.find(
      entry => entry.reversesEntryId === null && entry.note === "عدّ أولي مباشر",
    );
    expect(opening).toBeDefined();
    expect(opening?.cashDeltaMinor).toBe(7_500);
  });

  it("blocks the save at the validation gate without touching the store or navigating", async () => {
    render(<Harness />);
    fireEvent.click(screen.getByRole("button", { name: /حفظ محفظة ورصيد البداية/ }));
    expect(await screen.findByRole("status")).toBeTruthy();
    expect(screen.getByText("أدخل اسم المحفظة ورصيد بداية صالحًا بالأرقام 0–9.")).toBeTruthy();
    const reader = new CashContinuityService(store, () => NOW);
    const overview = await reader.overview();
    if (!overview.ok) throw new Error(overview.message);
    expect(overview.value.wallets).toHaveLength(0);
    expect(wouterMocks.navigate).not.toHaveBeenCalled();
    expect(bumpVersion).not.toHaveBeenCalled();
  });

  it("carries the selected wallet kind into the persisted record", async () => {
    render(<Harness />);
    fireEvent.change(screen.getByPlaceholderText("مثال: درج الورشة"), { target: { value: "حساب الرحلة" } });
    fireEvent.change(screen.getByLabelText("نوع المكان"), { target: { value: "bank_account" } });
    fireEvent.change(screen.getByPlaceholderText("مثال: عدّ الدرج في بداية استخدام Micro"), {
      target: { value: "افتتاح بنكي" },
    });
    fireEvent.click(screen.getByRole("button", { name: /حفظ محفظة ورصيد البداية/ }));
    await waitFor(() => expect(wouterMocks.navigate).toHaveBeenCalled());
    const reader = new CashContinuityService(store, () => NOW);
    const overview = await reader.overview();
    if (!overview.ok) throw new Error(overview.message);
    expect(overview.value.wallets[0]?.kind).toBe("bank_account");
  });
});
