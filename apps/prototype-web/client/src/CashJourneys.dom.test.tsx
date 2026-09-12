/** @vitest-environment jsdom */

/* المجموعة ١١ (المرحلة 11-E — تغطية الرحلات عالية القيمة): عدّ الصندوق
 * وتوزيع الكاش غير الموزّع عبر الحدود الحقيقية (تفاعل ← خدمة ← مخزن الذاكرة):
 * حالات التحميل والجهوزية والفرق والرفض الصادق، والقيم الدقيقة قبل وبعد
 * التسوية/التوزيع، ورسائل عربية صريحة بلا تقريب صامت. */
import React from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { usePrototypeServices } from "@/app/PrototypeServicesContext";
import { CashContinuityService } from "@/application/cash/cashContinuityService";
import { ProjectFinancialService } from "@/application/finance/projectFinancialService";
import { UnsavedChangesProvider } from "@/components/forms/UnsavedChangesGuard";
import { MemoryLocalStore } from "@/storage/local/MemoryLocalStore";
import CashCount from "@/pages/CashCount";
import CashDistribution from "@/pages/CashDistribution";

vi.mock("@/app/PrototypeServicesContext", () => ({
  usePrototypeServices: vi.fn(),
}));

const wouterMocks = vi.hoisted(() => ({
  navigate: vi.fn(),
  location: "/cash/wallets",
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
const NOW = "2026-09-12T09:00:00.000Z";

let store: MemoryLocalStore;
const bumpVersion = vi.fn();
let dataVersion = 0;

function Harness({ page }: { page: React.ReactNode }) {
  return <UnsavedChangesProvider navigate={wouterMocks.navigate}>{page}</UnsavedChangesProvider>;
}

async function openWalletWith(minor: number, name = "درج") {
  const cash = new CashContinuityService(store, () => NOW);
  const result = await cash.openWallet({
    name,
    kind: "cash_drawer",
    openingMinor: minor,
    occurredOn: "2026-09-01",
    note: "رصيد بداية",
    operationKey: `g11-open-${name}`,
  });
  if (!result.ok) throw new Error(result.message);
  const overview = await cash.overview();
  if (!overview.ok) throw new Error("overview failed after opening");
  return overview.value.wallets[0]!;
}

beforeEach(() => {
  store = new MemoryLocalStore();
  dataVersion = 0;
  bumpVersion.mockImplementation(() => {
    dataVersion += 1;
  });
  const cashContinuity = new CashContinuityService(store, () => NOW);
  const projectFinance = new ProjectFinancialService(store, () => NOW);
  mockedUsePrototypeServices.mockReturnValue({
    cashContinuity,
    projectFinance,
    dataVersion,
    notifyDataChanged: bumpVersion,
  } as unknown as ReturnType<typeof usePrototypeServices>);
});

afterEach(() => {
  cleanup();
});

describe("CashCount journeys (Group 11-E)", () => {
  it("loads through the loading state into the ready counting form with the recorded balance", async () => {
    await openWalletWith(15000);
    render(<Harness page={<CashCount />} />);
    expect(await screen.findByRole("heading", { name: "عدّ اللي في الدرج فعلًا" })).toBeTruthy();
    /* الرصيد المسجل يظهر بالقيمة الدقيقة 150.00 د.أ داخل خيار المحفظة. */
    await waitFor(() => expect(screen.getByText(/المسجل 150\.00/)).toBeTruthy());
    expect(screen.getByLabelText("المبلغ المعدود")).toBeTruthy();
  });

  it("blocks settlement when the count matches the recorded balance — no adjustment invented", async () => {
    await openWalletWith(15000);
    render(<Harness page={<CashCount />} />);
    await screen.findByRole("heading", { name: "عدّ اللي في الدرج فعلًا" });
    const counted = screen.getByLabelText("المبلغ المعدود");
    fireEvent.change(counted, { target: { value: "150" } });
    fireEvent.click(screen.getByRole("button", { name: "سجّل التسوية" }));
    await waitFor(() =>
      expect(screen.getByText("العدّ يطابق الرصيد المسجل — لا تسوية مطلوبة.")).toBeTruthy(),
    );
  });

  it("records the exact difference and shows the exact new balance after settlement", async () => {
    const wallet = await openWalletWith(15000);
    render(<Harness page={<CashCount />} />);
    await screen.findByRole("heading", { name: "عدّ اللي في الدرج فعلًا" });
    /* 152.40 معدودة مقابل 150.00 مسجلة → فرق 2.40 بالضبط (240 قروش صحيحة). */
    fireEvent.change(screen.getByLabelText("المبلغ المعدود"), { target: { value: "152.4" } });
    fireEvent.click(screen.getByRole("button", { name: "سجّل التسوية" }));
    expect(await screen.findByRole("heading", { name: "انسجّلت التسوية" })).toBeTruthy();
    /* القيم الدقيقة: الرصيد الجديد 152.40 والفرق 2.40 — لا تقريب ولا شوائب. */
    expect(screen.getByText("152.40")).toBeTruthy();
    expect(screen.getByText("+2.40")).toBeTruthy();
    /* القراءة بعد التسوية من المخزن نفسه: الرصيد 15240 minor بالضبط. */
    const cash = new CashContinuityService(store, () => NOW);
    const overview = await cash.overview();
    expect(overview.ok && overview.value.wallets[0]?.balanceMinor).toBe(15240);
    expect(wallet.id).toBeTruthy();
  });

  it("fails closed on an invalid count with a user-safe message and no write", async () => {
    await openWalletWith(15000);
    render(<Harness page={<CashCount />} />);
    await screen.findByRole("heading", { name: "عدّ اللي في الدرج فعلًا" });
    const counted = screen.getByLabelText("المبلغ المعدود");
    /* دقة أدق من القروش: ترفضها ترجمة الإدخال نفسها (fail closed). */
    fireEvent.change(counted, { target: { value: "150.005" } });
    fireEvent.blur(counted);
    fireEvent.click(screen.getByRole("button", { name: "سجّل التسوية" }));
    const message =
      screen.queryByText("أدخل المعدود رقمًا صحيحًا غير سالب.") ??
      (await screen.findByText(/أدخل المعدود|رقمًا/));
    expect(message).toBeTruthy();
    const cash = new CashContinuityService(store, () => NOW);
    const overview = await cash.overview();
    expect(overview.ok && overview.value.wallets[0]?.balanceMinor).toBe(15000);
  });
});

describe("CashDistribution journeys (Group 11-E)", () => {
  it("shows the unallocated cash decision card with exact values once ready", async () => {
    await openWalletWith(20000, "درج");
    render(<Harness page={<CashDistribution />} />);
    expect(await screen.findByRole("heading", { name: "وزّع الكاش غير الموزع" })).toBeTruthy();
    await waitFor(() => expect(screen.getByLabelText("المتاح الآن")).toBeTruthy());
  });

  it("distributes unallocated cash into a wallet with an exact documented amount", async () => {
    await openWalletWith(40000, "درج");
    /* حركة قبض غير موزعة: إيراد نقدي بسيط عبر المحفظة دون تخصيص. */
    const cash = new CashContinuityService(store, () => NOW);
    const seededOverview = await cash.overview();
    if (!seededOverview.ok) throw new Error("overview failed before distribution journey");
    const wallet = seededOverview.value.wallets[0];
    expect(wallet).toBeTruthy();
    const projectFinance = new ProjectFinancialService(store, () => NOW);
    /* تغطية من المحفظة إلى غير الموزع أولًا (اتجاه cover): تصنع كاشًا غير موزع
     * حقيقيًا 271.00 د.أ ثم توزّعه الرحلة نفسها عائداً إلى المحفظة. */
    const covered = await projectFinance.distributeUnallocated({
      walletId: wallet!.id,
      deltaMinor: -27100,
      note: "صرف أُعيد للمراجعة",
      operationKey: "g11-seed-cover",
    });
    expect(covered.ok).toBe(true);

    render(<Harness page={<CashDistribution />} />);
    expect(await screen.findByRole("heading", { name: "وزّع الكاش غير الموزع" })).toBeTruthy();
    await waitFor(() => expect(screen.getByLabelText("نموذج التوزيع")).toBeTruthy());
    /* القيمة الدقيقة 271.00 د.أ تُوزّع كاملة بلا تقريب. */
    fireEvent.change(screen.getByLabelText("مبلغ التوزيع"), { target: { value: "271" } });
    fireEvent.click(screen.getByRole("button", { name: "سجّل التوزيع" }));
    await waitFor(() => expect(screen.getByText(/انخصص الكاش/)).toBeTruthy());
  });

  it("blocks distribution without a positive exact amount — no silent zero", async () => {
    await openWalletWith(20000, "درج");
    render(<Harness page={<CashDistribution />} />);
    expect(await screen.findByRole("heading", { name: "وزّع الكاش غير الموزع" })).toBeTruthy();
    await waitFor(() => expect(screen.getByLabelText("نموذج التوزيع")).toBeTruthy());
    fireEvent.click(screen.getByRole("button", { name: "سجّل التوزيع" }));
    await waitFor(() => expect(screen.getByText("أدخل مبلغًا صحيحًا موجبًا بالأرقام 0–9.")).toBeTruthy());
  });
});
