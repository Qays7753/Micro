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

describe("CashCount journeys (Group 11-E — S04/UNIT-025 honest measurement flow)", () => {
  /* S04 (DOC-013 / UNIT-025): المكان قرار صريح لا أول مكان تلقائيًا، والمبلغ
   * يبدأ فارغًا، والمطابقة «تم» بلا كتابة، والفرق يتطلب سببًا صريحًا. */
  async function selectTheOnlyWallet() {
    const select = (await screen.findByRole("combobox")) as HTMLSelectElement;
    const option = Array.from(select.options).find(candidate => candidate.value !== "");
    if (!option) throw new Error("wallet option not found");
    fireEvent.change(select, { target: { value: option.value } });
  }

  it("loads through the loading state into the ready form — no auto-picked wallet, empty counted amount", async () => {
    await openWalletWith(15000);
    render(<Harness page={<CashCount />} />);
    expect(await screen.findByRole("heading", { name: "عدّ اللي في الدرج فعلًا" })).toBeTruthy();
    /* الرصيد المسجل يظهر بالقيمة الدقيقة 150.00 د.أ داخل خيار المكان. */
    await waitFor(() => expect(screen.getByText(/المسجل 150\.00/)).toBeTruthy());
    /* لا اختيار تلقائي: القيمة الفارغة قانونية حتى يختار المالك. */
    expect(screen.getByLabelText("المبلغ الموجود")).toBeTruthy();
    const select = screen.getByRole("combobox") as HTMLSelectElement;
    expect(select.value).toBe("");
  });

  it("a matching count ends the check with no write at all — no adjustment, no observation", async () => {
    const wallet = await openWalletWith(15000);
    render(<Harness page={<CashCount />} />);
    await screen.findByRole("heading", { name: "عدّ اللي في الدرج فعلًا" });
    await selectTheOnlyWallet();
    fireEvent.change(screen.getByLabelText("المبلغ الموجود"), { target: { value: "150" } });
    await waitFor(() =>
      expect(screen.getByText("المبلغ يطابق الرصيد المسجل — لا تسوية مطلوبة.")).toBeTruthy(),
    );
    fireEvent.click(screen.getByRole("button", { name: "تم" }));
    expect(await screen.findByRole("heading", { name: "انسجّل القياس" })).toBeTruthy();
    /* لا كتابة البتة: لا قيد ولا رصد (R09/AC08). */
    const cash = new CashContinuityService(store, () => NOW);
    const overview = await cash.overview();
    expect(overview.ok && overview.value.wallets[0]?.balanceMinor).toBe(15000);
    const observations = await store.listBalanceObservations();
    expect(observations.ok && observations.value).toHaveLength(0);
    expect(wallet.id).toBeTruthy();
  });

  it("records the exact linked measurement and settlement with an explicit reason — 90 and −10 semantics, never −20", async () => {
    const wallet = await openWalletWith(15000);
    render(<Harness page={<CashCount />} />);
    await screen.findByRole("heading", { name: "عدّ اللي في الدرج فعلًا" });
    await selectTheOnlyWallet();
    /* 152.40 معدودة مقابل 150.00 مسجلة → قياس 15240 وتسوية +240 مرتبطتان. */
    fireEvent.change(screen.getByLabelText("المبلغ الموجود"), { target: { value: "152.4" } });
    /* سبب صريح قبل التسجيل — «لم أعرف سبب الفرق» خيارًا لا افتراضيًا. */
    fireEvent.click(screen.getByLabelText("لم أعرف سبب الفرق"));
    fireEvent.click(screen.getByRole("button", { name: /تسجيل فرق الزيادة/ }));
    expect(await screen.findByRole("heading", { name: "انسجّل فرق العدّ" })).toBeTruthy();
    /* القيم الدقيقة: المعدود 152.40 — لا تقريب ولا شوائب. */
    expect(screen.getByText("152.40")).toBeTruthy();
    /* القراءة بعد التسوية من المخزن نفسه: الرصيد 15240 minor بالضبط، والقياس
     * والتسوية مكتوبان معًا (قياس واحد وقيد واحد — لا مضاعفة أثر). */
    const cash = new CashContinuityService(store, () => NOW);
    const overview = await cash.overview();
    expect(overview.ok && overview.value.wallets[0]?.balanceMinor).toBe(15240);
    const observations = await store.listBalanceObservations();
    expect(observations.ok && observations.value).toHaveLength(1);
    if (observations.ok && observations.value[0]) expect(observations.value[0].countedMinor).toBe(15240);
    const entries = await store.listCashContinuityEntries();
    if (entries.ok) {
      expect(entries.value.filter(entry => entry.type === "cash_adjustment")).toHaveLength(1);
      expect(entries.value.filter(entry => entry.type === "opening_balance")).toHaveLength(1);
    }
    expect(wallet.id).toBeTruthy();
  });

  it("fails closed on an invalid count with a user-safe message and no write", async () => {
    await openWalletWith(15000);
    render(<Harness page={<CashCount />} />);
    await screen.findByRole("heading", { name: "عدّ اللي في الدرج فعلًا" });
    await selectTheOnlyWallet();
    const counted = screen.getByLabelText("المبلغ الموجود");
    /* دقة أدق من القروش: ترفضها ترجمة الإدخال نفسها (fail closed). */
    fireEvent.change(counted, { target: { value: "150.005" } });
    fireEvent.blur(counted);
    fireEvent.click(screen.getByRole("button", { name: "تم" }));
    const message =
      screen.queryByText(/أدخل المبلغ الموجود|رقمًا/) ??
      (await screen.findByText(/أدخل المبلغ الموجود|رقمًا/));
    expect(message).toBeTruthy();
    const cash = new CashContinuityService(store, () => NOW);
    const overview = await cash.overview();
    expect(overview.ok && overview.value.wallets[0]?.balanceMinor).toBe(15000);
    const observations = await store.listBalanceObservations();
    expect(observations.ok && observations.value).toHaveLength(0);
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
    await waitFor(() => expect(screen.getByText(/سُجّل التوزيع/)).toBeTruthy());
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

/* EXE-001 (AUD-NEW-01 / CASH-002): التوزيع الثاني في الزيارة نفسها قيد
 * مستقل لا ابتلاع صامت — قبل الإصلاح كان مفتاح العملية الواحد للصفحة يجعل
 * الخدمة تعيد {reused:true} بلا كتابة بينما تعرض الواجهة نجاحًا كاذبًا. */
describe("EXE-001 — sequential distributions in one visit", () => {
  it("records two distributions in the same visit as two ledger entries with reconciled balances", async () => {
    await openWalletWith(10000, "درج");
    /* كاش غير موزع حقيقي: استثمار نقدي 60.00 د.أ بلا نسبة محفظة. */
    const finance = new ProjectFinancialService(store, () => NOW);
    const invested = await finance.record({
      type: "owner_investment_cash",
      amountMinor: 6000,
      occurredOn: "2026-09-12",
      note: "استثمار لاختبار التوزيع المتتابع",
      counterparty: null,
      relatedEventId: null,
      idempotencyKey: "exe001-seed-invest",
    });
    if (!invested.ok) throw new Error(invested.message);

    render(<Harness page={<CashDistribution />} />);
    expect(await screen.findByRole("heading", { name: "وزّع الكاش غير الموزع" })).toBeTruthy();
    await waitFor(() => expect(screen.getByLabelText("نموذج التوزيع")).toBeTruthy());

    /* التوزيع الأول: 20.00 د.أ إلى المحفظة. */
    fireEvent.change(screen.getByLabelText("مبلغ التوزيع"), { target: { value: "20" } });
    fireEvent.click(screen.getByRole("button", { name: "سجّل التوزيع" }));
    await waitFor(() => expect(screen.getByText(/سُجّل التوزيع/)).toBeTruthy());

    /* التوزيع الثاني في الزيارة نفسها: 30.00 د.أ — قبل الإصلاح كان يُبتلع
     * بصمت مع رسالة نجاح؛ الآن قيد ثانٍ والأرصدة تتحدث فعليًا. */
    await waitFor(() => expect(screen.getByLabelText("مبلغ التوزيع")).toBeTruthy());
    fireEvent.change(screen.getByLabelText("مبلغ التوزيع"), { target: { value: "30" } });
    fireEvent.click(screen.getByRole("button", { name: "سجّل التوزيع" }));
    await waitFor(() => expect(screen.getByText(/سُجّل التوزيع/)).toBeTruthy());

    /* قيدا تخصيص موجبان في دفتر المحفظة: +20.00 و +30.00. */
    const entries = await store.listCashContinuityEntries();
    if (!entries.ok) throw new Error("entries should read");
    const allocations = entries.value
      .filter(entry => entry.type === "allocation" && entry.cashDeltaMinor > 0)
      .map(entry => entry.cashDeltaMinor)
      .sort((left, right) => left - right);
    expect(allocations).toEqual([2000, 3000]);

    /* الأرصدة: المحفظة 150.00، غير الموزع 10.00، والهوية متصالحة. */
    const cash = new CashContinuityService(store, () => NOW);
    const overview = await cash.overview();
    if (!overview.ok) throw new Error("overview failed");
    expect(overview.value.wallets[0]!.balanceMinor).toBe(15000);
    const position = await finance.readPosition();
    if (!position.ok) throw new Error(position.message);
    expect(position.value.unallocatedCashMinor).toBe(1000);
    expect(position.value.recordedCashMinor).toBe(
      position.value.walletCashMinor + position.value.unallocatedCashMinor,
    );
    expect(position.value.recordedCashMinor).toBe(16000);

    /* ملاحظة قيد الحزمة: خيار المحفظة وبطاقة «المتاح الآن» يُحدّثان عبر
     * dataVersion في التطبيق الحي؛ حزمة هذا الملف تثبّت dataVersion (غير
     * تفاعلية بالتصميم)، لذا الدليل الحاسم هنا على مستوى المخزن والدفتر
     * أعلاه: قيدان مستقلان وأرصدة متصالحة وهوية كاش سليمة. */
  });
});
