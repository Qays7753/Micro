/** @vitest-environment jsdom */

/* FIN-004 (قرار المالك المعتمد ٢٠٢٦-٠٩-١٦): إشعار تحديث البيانات يقع بعد
 * اكتمال كل الكتابات (الحدث المالي ثم تخصيص المحفظة) لا بينهما — فلا تقرأ
 * الرئيسية حالة وسيطة (غير موزع سالب + محفظة قديمة) بعد صرف من محفظة.
 * الرحلة هنا عبر الخدمات الحقيقية فوق مخزن الذاكرة مع تسجيل ترتيب الكتابات
 * والإشعار، ثم التحقق من الحالة النهائية الملتزَمة نفسها. */
import React from "react";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { usePrototypeServices } from "@/app/PrototypeServicesContext";
import { MemoryLocalStore } from "@/storage/local/MemoryLocalStore";
import { ProjectFinancialService } from "@/application/finance/projectFinancialService";
import { CashContinuityService } from "@/application/cash/cashContinuityService";
import { DirectSaleService } from "@/application/direct-sales/directSaleService";
import { QuickExpenseForm } from "@/components/finance/QuickExpenseForm";
import { QuickSaleForm } from "@/components/finance/QuickSaleForm";
import type { QuickActionReceipt } from "@/components/finance/quickActionFormTypes";

vi.mock("@/app/PrototypeServicesContext", () => ({
  usePrototypeServices: vi.fn(),
}));

const mockedUsePrototypeServices = vi.mocked(usePrototypeServices);
const NOW = "2026-09-16T09:00:00.000Z";

let store: MemoryLocalStore;
let projectFinance: ProjectFinancialService;
let orderLog: string[] = [];
let dataVersion = 0;
let notifyCount = 0;

beforeEach(() => {
  store = new MemoryLocalStore();
  orderLog = [];
  dataVersion = 0;
  notifyCount = 0;
  projectFinance = new ProjectFinancialService(store, () => NOW);
  /* تسجيل ترتيب الكتابات: الحدث المالي ثم التخصيص ثم الإشعار. */
  const originalSaveEvent = store.saveFinancialEvent.bind(store);
  store.saveFinancialEvent = async (...args: Parameters<typeof originalSaveEvent>) => {
    const result = await originalSaveEvent(...args);
    if (result.ok) orderLog.push("event-committed");
    return result;
  };
  const originalCommitCash = store.commitCashContinuity.bind(store);
  store.commitCashContinuity = async (...args: Parameters<typeof originalCommitCash>) => {
    const result = await originalCommitCash(...args);
    if (result.ok) orderLog.push("allocation-committed");
    return result;
  };
  const originalSaveSale = store.saveDirectSale.bind(store);
  store.saveDirectSale = async (...args: Parameters<typeof originalSaveSale>) => {
    const result = await originalSaveSale(...args);
    if (result.ok) orderLog.push("sale-committed");
    return result;
  };
  mockedUsePrototypeServices.mockReturnValue({
    projectFinance,
    directSales: new DirectSaleService(store, () => NOW),
    notifyDataChanged: () => {
      notifyCount += 1;
      orderLog.push("notify");
    },
    dataVersion,
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
    operationKey: `fin004-open-${name}`,
  });
  if (!opened.ok) throw new Error(opened.message);
  const overview = await cash.overview();
  if (!overview.ok) throw new Error("overview failed");
  return overview.value.wallets[0]!;
}

async function seedProfile() {
  const { ProfileService } = await import("@/application/profile/profileService");
  const saved = await new ProfileService(store, () => NOW).save("مشغل اختبار FIN-004");
  if (!saved.ok) throw new Error(saved.message);
}

describe("Quick forms notify after committed state (FIN-004)", () => {
  it("notifies exactly once AFTER the wallet allocation completes — no intermediate read", async () => {
    const wallet = await openWallet("درج-FIN004", 10000);
    const submitted: QuickActionReceipt[] = [];
    render(
      <QuickExpenseForm
        wallets={[{ id: wallet.id, name: "درج-FIN004" }]}
        categorySuggestions={[]}
        onSubmitted={receipt => submitted.push(receipt)}
        onBackToMenu={() => undefined}
      />,
    );
    const user = userEvent.setup();
    await user.type(screen.getByLabelText("مبلغ المصروف"), "3");
    /* EXE-007: البند مطلوب في المدخل السريع أيضًا — قاعدة الملكية الموحدة. */
    await user.type(screen.getByLabelText(/البند/), "توصيل خامه");
    await user.selectOptions(screen.getByLabelText(/مصدر الصرف/), wallet.id);
    orderLog = [];
    await user.click(screen.getByRole("button", { name: "سجّل المصروف" }));
    await waitForReceipt(submitted);
    /* الترتيب الحاسم: الحدث، ثم التخصيص، ثم إشعار واحد — لا إشعار بين الكتابتين. */
    expect(orderLog).toEqual(["event-committed", "allocation-committed", "notify"]);
    expect(notifyCount).toBe(1);
    /* الحالة النهائية الملتزَمة: المحفظة 97.00 وغير الموزع 0 والإجمالي 97.00. */
    const position = await projectFinance.readPosition();
    if (!position.ok) throw new Error(position.message);
    expect(position.value.walletCashMinor).toBe(9700);
    expect(position.value.unallocatedCashMinor).toBe(0);
    expect(position.value.recordedCashMinor).toBe(9700);
    /* وصل صادق من الحالة النهائية لا الوسيطة. */
    expect(submitted[0]?.cashMinor).toBe(9700);
  });

  it("keeps the same ordering for a wallet-attributed quick sale", async () => {
    const wallet = await openWallet("درج-FIN004", 10000);
    const submitted: QuickActionReceipt[] = [];
    render(
      <QuickSaleForm
        wallets={[{ id: wallet.id, name: "درج-FIN004" }]}
        onSubmitted={receipt => submitted.push(receipt)}
        onBackToMenu={() => undefined}
      />,
    );
    const user = userEvent.setup();
    await user.type(screen.getByLabelText("مبلغ البيع"), "15");
    await user.selectOptions(screen.getByLabelText(/وجهة القبض/), wallet.id);
    orderLog = [];
    await user.click(screen.getByRole("button", { name: "سجّل البيع" }));
    await waitForReceipt(submitted);
    expect(orderLog).toEqual(["sale-committed", "allocation-committed", "notify"]);
    expect(notifyCount).toBe(1);
    const position = await projectFinance.readPosition();
    if (!position.ok) throw new Error(position.message);
    expect(position.value.walletCashMinor).toBe(11500);
    expect(position.value.unallocatedCashMinor).toBe(0);
  });

  it("keeps Home equal to Finance immediately after a wallet-funded expense — no reload", async () => {
    await seedProfile();
    const wallet = await openWallet("درج-FIN004", 10000);
    const submitted: QuickActionReceipt[] = [];
    render(
      <QuickExpenseForm
        wallets={[{ id: wallet.id, name: "درج-FIN004" }]}
        categorySuggestions={[]}
        onSubmitted={receipt => submitted.push(receipt)}
        onBackToMenu={() => undefined}
      />,
    );
    const user = userEvent.setup();
    await user.type(screen.getByLabelText("مبلغ المصروف"), "3");
    /* EXE-007: البند مطلوب في المدخل السريع أيضًا — قاعدة الملكية الموحدة. */
    await user.type(screen.getByLabelText(/البند/), "توصيل خامه");
    await user.selectOptions(screen.getByLabelText(/مصدر الصرف/), wallet.id);
    await user.click(screen.getByRole("button", { name: "سجّل المصروف" }));
    await waitForReceipt(submitted);
    /* بعد الإشعار مباشرة — بلا تنقل ولا إعادة تحميل — الرئيسية ومالي تقرآن
     * الحالة الملتزَمة نفسها: محفظة 97.00، لا بطاقة «كاش غير موزع» سالبة،
     * ولا تحذير «فرق سالب — راجع مصدره». */
    const home = await readHome();
    const position = await projectFinance.readPosition();
    if (!position.ok) throw new Error(position.message);
    const cashFact = home.facts.find(fact => fact.id === "cash");
    expect(cashFact?.state).toBe("known");
    expect(cashFact?.valueMinor).toBe(position.value.recordedCashMinor);
    expect(cashFact?.valueMinor).toBe(9700);
    const unallocatedFact = home.facts.find(fact => fact.id === "unallocated");
    expect(unallocatedFact).toBeUndefined();
    expect(home.facts.some(fact => fact.qualifier?.includes("فرق سالب"))).toBe(false);
  });
});

async function readHome() {
  const { HomeControlCenterService } = await import("@/application/home/homeControlCenterService");
  const { DailyFollowUpService } = await import("@/application/follow-up/dailyFollowUpService");
  const { SupplierPurchaseService } = await import("@/application/suppliers/supplierPurchaseService");
  const { InventoryMaterialService } = await import("@/application/inventory/inventoryMaterialService");
  const { AgreementContextService } = await import("@/application/agreements/agreementContextService");
  const { ActivityService } = await import("@/application/activity/activityService");
  const home = new HomeControlCenterService(
    store,
    new DailyFollowUpService(store),
    projectFinance,
    new SupplierPurchaseService(store, () => NOW),
    new InventoryMaterialService(store, () => NOW),
    new AgreementContextService(store),
    new ActivityService(store),
    () => NOW,
  );
  const result = await home.read();
  if (!result.ok) throw new Error(result.message);
  return result.value;
}

async function waitForReceipt(submitted: QuickActionReceipt[]) {
  for (let attempt = 0; attempt < 50 && submitted.length === 0; attempt += 1) {
    await new Promise(resolve => setTimeout(resolve, 10));
  }
  expect(submitted.length).toBeGreaterThan(0);
}
