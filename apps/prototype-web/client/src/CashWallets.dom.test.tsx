/** @vitest-environment jsdom */
/*
 * R10-B4 (F-020، 2026-10-12): اختبار مباشر لسطح محافظ الكاش — الصفحة كانت
 * بين الثلاث بلا اختبار مباشر (مراجع الاسم كانت إيجابيات كاذبة: أسماء
 * طرق تحوي «CashWallets» كجزء كلمة). الرحلات: الجاهزية بمحافظ حقيقية
 * (قراءة الاسم والنوع وسطر الأمانات وسطر الانحراف السالب بإعلان alert)،
 * والفراغ الصادق بأفعاله المؤجلة الموثقة، وفشل القراءة بصفة alert مع
 * إعادة المحاولة. الموقف المالي يُقرأ عبر كعب محكم الشكل (اشتقاقه
 * مختبر في بيته)؛ محافظ الكاش عبر الخدمة الحقيقية فوق مخزن الذاكرة.
 */
import React from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { usePrototypeServices } from "@/app/PrototypeServicesContext";
import { CashContinuityService } from "@/application/cash/cashContinuityService";
import { MemoryLocalStore } from "@/storage/local/MemoryLocalStore";
import CashWallets from "@/pages/CashWallets";

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

/* موقف مالي محكم الشكل قابل للتوجيه — الاشتقاق الحقيقي مختبر في بيته. */
let positionValue: {
  amanahHeldMinor: number;
  unallocatedCashMinor: number;
  recordedCashMinor: number;
};

class FailingOverviewStore extends MemoryLocalStore {
  failReads = true;
  override async listCashWallets() {
    if (this.failReads)
      return {
        ok: false as const,
        code: "storage_error" as const,
        message: "تعذر قراءة محافظ الكاش المحلية.",
      };
    return super.listCashWallets();
  }
}

function services() {
  return {
    cashContinuity: new CashContinuityService(store, () => NOW),
    projectFinance: {
      readPosition: async () => ({ ok: true as const, value: positionValue }),
    },
    notifyDataChanged: bumpVersion,
    dataVersion: 0,
  };
}

function Harness() {
  return <CashWallets />;
}

async function seedWallet(name: string, openingMinor: number, unknown = false): Promise<string> {
  const cash = new CashContinuityService(store, () => NOW);
  const opened = await cash.openWallet({
    name,
    kind: "cash_drawer",
    openingMinor,
    occurredOn: "2026-10-01",
    note: "بداية",
    operationKey: `seed-${name}`,
    ...(unknown ? { openingStatus: "unknown" as const } : {}),
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
  positionValue = { amanahHeldMinor: 0, unallocatedCashMinor: 0, recordedCashMinor: 0 };
  mockedUsePrototypeServices.mockReturnValue(
    services() as unknown as ReturnType<typeof usePrototypeServices>,
  );
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("R10-B4/F-020 — CashWallets direct journeys", () => {
  it("renders the declared wallets with kind, entry count, and the unknown-opening honest hint", async () => {
    await seedWallet("درج رئيسي", 10000);
    await seedWallet("درج احتياطي", 0, true);
    render(<Harness />);
    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "محافظ الكاش" })).toBeTruthy();
    });
    expect(screen.getByText("درج رئيسي")).toBeTruthy();
    expect(screen.getByText("درج احتياطي")).toBeTruthy();
    /* الختم الصادق للمجهول الافتتاح + وصلته الموثقة. */
    expect(screen.getByText(/رصيد الافتتاح غير معروف/)).toBeTruthy();
    expect(screen.getByRole("button", { name: "سجّل رصيدًا موثقًا لاحقًا" })).toBeTruthy();
    /* وصلات السجل وضبط بسبب للمحفظة المعروفة. */
    expect(screen.getAllByRole("button", { name: /السجل/ }).length).toBe(2);
  });

  it("empty state stays honest: no invented wallet, deferred actions documented, create action live", async () => {
    render(<Harness />);
    await waitFor(() => {
      expect(screen.getByText("لم تسجل محفظة بعد")).toBeTruthy();
    });
    /* لا يظهر الفعل المشروط كزر معطل — شرط إنجازه معلن. */
    expect(screen.getByText("عدّ الصندوق — لاحقًا")).toBeTruthy();
    expect(screen.getByText("تحويل بين المحافظ — لاحقًا")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /محفظة ورصيد بداية/ }));
    expect(wouterMocks.navigate).toHaveBeenCalledWith("/cash/wallet/new?returnTo=%2Fcash");
  });

  it("held amanah cash shows as a trust (not profit) and a negative unallocated announces the documented deviation", async () => {
    await seedWallet("درج رئيسي", 10000);
    positionValue = { amanahHeldMinor: 2500, unallocatedCashMinor: -750, recordedCashMinor: 9250 };
    render(<Harness />);
    await waitFor(() => {
      expect(screen.getByText("أمانات بأمانتك")).toBeTruthy();
    });
    expect(screen.getByText(/ليس ربحك ولا مالكًا لك/)).toBeTruthy();
    /* الانحراف السالب يفسَّر بسببه الموثق لا برقم مجرد — بقناة alert. */
    const deviation = screen.getByText(/تخصيص زائد/);
    expect(deviation.getAttribute("role")).toBe("alert");
  });

  it("a read failure renders its actual message with role=alert and retry recovers to the wallets", async () => {
    const failStore = new FailingOverviewStore();
    store = failStore;
    currentStore = failStore;
    mockedUsePrototypeServices.mockReturnValue(
      services() as unknown as ReturnType<typeof usePrototypeServices>,
    );
    render(<Harness />);
    /* عقد السطح: فشل القراءة يُعلن بصفة alert مع وعد «لم يتغير أي سجل»
     * الثابت (الرسالة الفعلية في السجل) + إعادة المحاولة. */
    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toContain("لم يتغير أي سجل.");
    failStore.failReads = false;
    fireEvent.click(screen.getByRole("button", { name: "إعادة المحاولة" }));
    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "محافظ الكاش" })).toBeTruthy();
    });
  });
});
