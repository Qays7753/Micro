/** @vitest-environment jsdom */

import React from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getPrototypeLocalStore, usePrototypeServices } from "@/app/PrototypeServicesContext";
import Foundation from "@/pages/Foundation";
/* S14: الجسر القانوني للحد — الصفحات واختباراتها لا تلمس التخزين مباشرة. */
import { createAccountCompletionHarness } from "@/application/transfers";

vi.mock("@/app/PrototypeServicesContext", () => ({
  usePrototypeServices: vi.fn(),
  getPrototypeLocalStore: vi.fn(),
}));

const wouterMocks = { navigate: vi.fn() };

vi.mock("wouter", () => ({
  useSearch: () => "",
  useLocation: () => ["/foundation", wouterMocks.navigate],
}));

const mockedUsePrototypeServices = vi.mocked(usePrototypeServices);

function servicesOverrides(hasData: boolean) {
  return {
    cashContinuity: {
      overview: vi.fn().mockResolvedValue({
        ok: true,
        value: {
          wallets: hasData ? [{ id: "w1", name: "الدرج", balanceMinor: 50000, entryCount: 1 }] : [],
          totalWalletCashMinor: hasData ? 50000 : 0,
          entryCount: hasData ? 1 : 0,
          truth: "قراءة محلية.",
        },
      }),
    },
    ownerEntitlement: {
      readOverview: vi.fn().mockResolvedValue({
        ok: true,
        value: {
          approvedEntitlementMinor: hasData ? 50000 : 0,
          openingBalanceMinor: 0,
          activePolicies: [],
        },
      }),
    },
    supplierPurchases: {
      readSummary: vi.fn().mockResolvedValue({
        ok: true,
        value: {
          purchaseCount: hasData ? 1 : 0,
          openPurchaseCount: hasData ? 1 : 0,
          supplierPayablesMinor: hasData ? 12000 : 0,
          recordedCashPaidMinor: 0,
          truth: "قراءة محلية.",
        },
      }),
    },
    inventory: {
      overview: vi.fn().mockResolvedValue({
        ok: true,
        value: {
          materials: hasData ? [{ id: "m1", name: "فضة" }] : [],
          movementCount: hasData ? 1 : 0,
          truth: "قراءة محلية.",
        },
      }),
    },
    dataVersion: 0,
    /* S14: رحلة الاستكمال — مصنع الحد القانوني فوق مخزن حقيقي. */
    formDrafts: journeyHarness.drafts,
    notifyDataChanged: vi.fn(),
  } as unknown as ReturnType<typeof usePrototypeServices>;
}

/* مصنع الرحلة الحقيقي — مخزن ومسودات ومنسق فوق الحالة نفسها. */
let journeyHarness = createAccountCompletionHarness(() => "2026-11-02T09:00:00.000Z");
const mockedGetStore = vi.mocked(getPrototypeLocalStore);

describe("Foundation page (decisions 4–8)", () => {
  afterEach(() => cleanup());

  beforeEach(() => {
    wouterMocks.navigate.mockReset();
    journeyHarness = createAccountCompletionHarness(() => "2026-11-02T09:00:00.000Z");
    mockedGetStore.mockReset();
    mockedGetStore.mockImplementation(() => journeyHarness.store);
  });

  it("shows the honest one-line state for every empty section and opens with cash unfolded", async () => {
    mockedUsePrototypeServices.mockReturnValue(servicesOverrides(false));
    render(<Foundation />);

    expect(await screen.findByRole("heading", { name: "شو عندك هلق؟" })).toBeTruthy();
    // سطر الحقيقة (§2.5) يتصدر الصفحة.
    expect(screen.getByText(/هذه الأرقام أساس كل ما سيقوله التطبيق/)).toBeTruthy();
    // القرار ٤: الكاش مفتوح افتراضيًا، والباقي مطوي بحالته بسطر واحد.
    expect(screen.getByText("لم تسجل محفظة بعد")).toBeTruthy();
    expect(screen.getByText("لم يسجل رأس مال بعد — اختياري بالكامل")).toBeTruthy();
    expect(screen.getByText("الديون: لم يُسجَّل شيء")).toBeTruthy();
    expect(screen.getByText("المواد: لم تسجل مادة بعد")).toBeTruthy();
  });

  it("keeps every section a road: each empty block sends to its own registration path", async () => {
    mockedUsePrototypeServices.mockReturnValue(servicesOverrides(false));
    render(<Foundation />);

    const walletButton = await screen.findByRole("button", { name: /محفظة ورصيد بداية/ });
    fireEvent.click(walletButton);
    expect(wouterMocks.navigate).toHaveBeenCalledWith("/cash/wallet/new");

    fireEvent.click(screen.getByRole("button", { name: /سجّل التزامًا لمورد/ }));
    expect(wouterMocks.navigate).toHaveBeenCalledWith("/finance/new/operating_expense_payable");

    fireEvent.click(screen.getByRole("button", { name: /سجّل استثمارًا نقديًا/ }));
    expect(wouterMocks.navigate).toHaveBeenCalledWith("/finance/new/owner_investment_cash");

    fireEvent.click(screen.getByRole("button", { name: /مادة ورصيد بداية/ }));
    expect(wouterMocks.navigate).toHaveBeenCalledWith("/inventory/material/new");

    // F-076 + المجموعة ١: بديل الملف باب إلى الاستيراد الموجه — يصل للبطاقة نفسها.
    fireEvent.click(screen.getByRole("button", { name: /فتح الاستيراد/ }));
    expect(wouterMocks.navigate).toHaveBeenCalledWith("/settings?focus=guided-import&returnTo=%2Ffoundation");
  });

  it("offers both exits and lands on Home without closing the step (decision 7)", async () => {
    mockedUsePrototypeServices.mockReturnValue(servicesOverrides(false));
    render(<Foundation />);

    fireEvent.click(await screen.findByRole("button", { name: /تخطَّ وأكمل لاحقًا/ }));
    expect(wouterMocks.navigate).toHaveBeenCalledWith("/");
    fireEvent.click(screen.getByRole("button", { name: /ادخل إلى مشروعي/ }));
    expect(wouterMocks.navigate).toHaveBeenCalledWith("/");
  });

  it("states what is already recorded instead of repeating the empty copy", async () => {
    mockedUsePrototypeServices.mockReturnValue(servicesOverrides(true));
    render(<Foundation />);

    expect(await screen.findByText("1 محفظة · كاش المحافظ:")).toBeTruthy();
    expect(screen.getByText(/عليك للموردين:/)).toBeTruthy();
    expect(screen.getByText(/مادة مسجلة في المخزون المحلي/)).toBeTruthy();
    expect(screen.queryByText("الديون: لم يُسجَّل شيء")).toBeNull();
  });
});

describe("S14 — رحلة استكمال الحسابات في صفحة الأساس (UNIT-002/ACC-01)", () => {
  afterEach(() => cleanup());

  beforeEach(() => {
    wouterMocks.navigate.mockReset();
    journeyHarness = createAccountCompletionHarness(() => "2026-11-02T09:00:00.000Z");
    mockedGetStore.mockReset();
    mockedGetStore.mockImplementation(() => journeyHarness.store);
  });

  it("القسم اختياري مغلق، وفتحه يعرض المسارين وأسئلة المعرفة الصادقة — لا صفر افتراضيًا", async () => {
    mockedUsePrototypeServices.mockReturnValue(servicesOverrides(false));
    render(<Foundation />);
    /* الرحلة مطوية كبقية الأقسام الاختيارية — لا معالج إجباري. */
    const closed = await screen.findByText(/استكمال فترة سابقة/);
    fireEvent.click(closed);
    /* نص القسم المغلوب صادق عن عقد الرحلة قبل فتحها. */
    expect(screen.getByText(/آخر زيارة ليست إقفالًا ماليًا/)).toBeTruthy();
    const start = await screen.findByRole("button", { name: /ابدأ رحلة الاستكمال/ });
    fireEvent.click(start);
    /* أسئلة الفترة والمجاميع ظاهرة بحالات المعرفة الخمس — «لا أعرف» و«أتخطى»
     * خيارات صريحة لا قيمة صفر. */
    expect(await screen.findByText(/كم بلغت مبيعاتك التي لم تسجلها؟/)).toBeTruthy();
    expect(screen.getAllByText("لا أعرف المبلغ").length).toBeGreaterThanOrEqual(3);
    expect(screen.getAllByText("أتخطى الآن").length).toBeGreaterThanOrEqual(3);
  });

  it("المعاينة قبل الحفظ تعرض ما سيُحفظ والمجهول المعلن، والحفظ يلتزم ثم يعيد القراءة — والإلغاء بلا كتابة", async () => {
    mockedUsePrototypeServices.mockReturnValue(servicesOverrides(false));
    render(<Foundation />);
    fireEvent.click(await screen.findByText(/استكمال فترة سابقة/));
    fireEvent.click(await screen.findByRole("button", { name: /ابدأ رحلة الاستكمال/ }));
    /* فترة صالحة + مبيعات معلومة 200 + مصاريف مجهولة (لا تناسب ولا صفرًا). */
    fireEvent.change(await screen.findByLabelText(/من \(YYYY-MM-DD\)/), { target: { value: "2026-09-01" } });
    fireEvent.change(screen.getByLabelText(/إلى \(YYYY-MM-DD\)/), { target: { value: "2026-10-31" } });
    const salesInput = screen.getByLabelText(/كم بلغت مبيعاتك التي لم تسجلها؟/);
    fireEvent.change(salesInput, { target: { value: "200" } });
    fireEvent.click(screen.getAllByRole("radio", { name: "لا أعرف المبلغ" })[2]!);
    fireEvent.click(await screen.findByRole("button", { name: /راجع واحفظ/ }));
    /* المعاينة الصادقة: المبيعات 200 دينار معلومة والمصاريف مجهولة معلنة. */
    expect(await screen.findByText("راجع قبل الحفظ")).toBeTruthy();
    expect(screen.getAllByText(/معلوم|تقريبي/).length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText(/المجهول محفوظ بحالته ولا يصير صفرًا/)).toBeTruthy();
    /* الحفظ يلتزم بالفعل — ملخص وإيصال وقراءة جديدة. */
    fireEvent.click(screen.getByRole("button", { name: /حفظ ومتابعة/ }));
    expect(await screen.findByText("تم حفظ إدخالاتك.")).toBeTruthy();
    const summaries = await journeyHarness.store.listPeriodSummaries();
    if (!summaries.ok) throw new Error(summaries.message);
    expect(summaries.value).toHaveLength(2);
    const sales = summaries.value.find(summary => summary.kind === "direct_sales");
    const expenses = summaries.value.find(summary => summary.kind === "expenses");
    expect(sales?.dimensions.revenue).toEqual({
      state: "entered",
      amountMinor: 20000,
      knowledge: "known",
    });
    expect(expenses?.dimensions.paid).toEqual({ state: "unknown" });
    const receipts = await journeyHarness.store.listCommandReceipts();
    expect(receipts.ok && receipts.value).toHaveLength(1);
  });

  it("الإلغاء فعل واعٍ بلا كتابة — اللقطة كما كانت تمامًا", async () => {
    mockedUsePrototypeServices.mockReturnValue(servicesOverrides(false));
    render(<Foundation />);
    fireEvent.click(await screen.findByText(/استكمال فترة سابقة/));
    fireEvent.click(await screen.findByRole("button", { name: /ابدأ رحلة الاستكمال/ }));
    const before = await journeyHarness.store.readSnapshot();
    fireEvent.change(await screen.findByLabelText(/من \(YYYY-MM-DD\)/), { target: { value: "2026-09-01" } });
    fireEvent.change(screen.getByLabelText(/إلى \(YYYY-MM-DD\)/), { target: { value: "2026-10-31" } });
    fireEvent.click(screen.getByRole("button", { name: /إلغاء \(لا يُكتب شيء\)/ }));
    /* الرحلة أُغلقت والمخزن لم يُمس — الملخصات والإيصالات والقياسات فارغة. */
    expect(await screen.findByText(/استكمال فترة سابقة/)).toBeTruthy();
    const after = await journeyHarness.store.readSnapshot();
    expect(after.ok && (after.value.periodSummaries ?? [])).toHaveLength(0);
    expect(after.ok && (after.value.commandReceipts ?? [])).toHaveLength(0);
    expect(after.ok && (after.value.balanceObservations ?? [])).toHaveLength(0);
  });

  it("الفترة غير الصالحة تُعلن بحقل صريح ولا تُطبق — ولا انقلاب على الوصل", async () => {
    mockedUsePrototypeServices.mockReturnValue(servicesOverrides(false));
    render(<Foundation />);
    fireEvent.click(await screen.findByText(/استكمال فترة سابقة/));
    fireEvent.click(await screen.findByRole("button", { name: /ابدأ رحلة الاستكمال/ }));
    /* تاريخ انتهاء قبل البداية — رفض معلن لا إسقاط فارغ صامت. */
    fireEvent.change(await screen.findByLabelText(/من \(YYYY-MM-DD\)/), { target: { value: "2026-10-31" } });
    fireEvent.change(screen.getByLabelText(/إلى \(YYYY-MM-DD\)/), { target: { value: "2026-09-01" } });
    fireEvent.click(await screen.findByRole("button", { name: /راجع واحفظ/ }));
    expect(await screen.findByRole("alert")).toBeTruthy();
    expect(screen.getByRole("alert").textContent).toContain("الفترة غير صالحة");
    const snapshot = await journeyHarness.store.readSnapshot();
    expect(snapshot.ok && (snapshot.value.periodSummaries ?? [])).toHaveLength(0);
  });
});
