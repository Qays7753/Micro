/** @vitest-environment jsdom */

/*
 * UXR-01 (أمر UXR-W01 — قبول A01، PERF-004/S11 L-01): رفض استيراد شظية بوابة
 * تجهيز الرئيسية (خدمة المشتريات — الرابط الذي تنتظره الرئيسية وحدها وفق
 * تقرير الأداء) يجب أن يظهر فشل تجهيز صريحًا مع فعل إعادة محاولة فعالة —
 * لا «جارٍ التجهيز» إلى ما لا نهاية ولا فشلًا صامتًا ولا استثناء خام ولا
 * رفض وعد غير معالج. المزوّد الحقيقي يُركَّب فوق fake-indexeddb؛ استيراد
 * البوابة يُرفض باستمرار (شظية غير متاحة) فتبقى الحالة الصادقة «failed»
 * بعد إعادة المحاولة أيضًا — لا جاهزية كاذبة، وبقية السلسلة الكسولة كعبات
 * فورية لا تشارك في المسار.
 */
import "fake-indexeddb/auto";
import React from "react";
import { act, cleanup, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PrototypeServicesProvider, usePrototypeServices } from "@/app/PrototypeServicesContext";

vi.mock("@/application/suppliers/supplierPurchaseService", () =>
  Promise.reject(new Error("chunk unavailable (synthetic network rejection)")),
);
vi.mock("@/application/follow-up", () => ({
  UnifiedFollowUpService: class MockUnifiedFollowUpServiceUxr01F {},
}));
vi.mock("@/application/scheduling", () => ({
  activeDeliveryLens: () => ({ kind: "mock-delivery-lens-uxr01f" }),
}));
vi.mock("@/application/transfers/localTransferService", () => ({
  LocalTransferService: class MockLocalTransferServiceUxr01F {
    static verifiedBackupBuilder() {
      return { build: async () => undefined };
    }
  },
}));
vi.mock("@/application/transfers/guidedOpeningImportService", () => ({
  GuidedOpeningImportService: class MockGuidedOpeningImportServiceUxr01F {},
}));
vi.mock("@/application/recurring/recurringExpenseService", () => ({
  RecurringExpenseService: class MockRecurringExpenseServiceUxr01F {},
}));
vi.mock("@/application/loans/loanService", () => ({
  LoanService: class MockLoanServiceUxr01F {},
}));
vi.mock("@/application/agreements/agreementService", () => ({
  AgreementService: class MockAgreementServiceUxr01F {},
}));
vi.mock("@/application/cash/cashCountService", () => ({
  CashCountService: class MockCashCountServiceUxr01F {},
}));
vi.mock("@/application/parties/partyLedgerService", () => ({
  PartyDirectoryService: class MockPartyDirectoryServiceUxr01F {},
}));
vi.mock("@/application/assets/assetService", () => ({
  AssetService: class MockAssetServiceUxr01F {},
}));
vi.mock("@/application/estimates/planningCalculationLifecycle", () => ({
  PlanningCalculationLifecycleService: class MockPlanningCalculationsUxr01F {},
}));
vi.mock("@/application/direct-sales/directSaleMovements", () => ({
  DirectSaleMovementsService: class MockDirectSaleMovementsServiceUxr01F {},
}));
vi.mock("@/application/security", () => ({
  retireLocalLockRecord: async () => undefined,
}));

type ServicesSnapshot = ReturnType<typeof usePrototypeServices>;

function ContextProbe({ capture }: { capture: { current: ServicesSnapshot | null } }) {
  const services = usePrototypeServices();
  capture.current = services;
  return null;
}

const flush = async (ticks = 5) => {
  for (let i = 0; i < ticks; i += 1) await new Promise(resolve => setTimeout(resolve, 0));
};

describe("PrototypeServicesContext — UXR-01 Home setup rejection (W01, PERF-004)", () => {
  let capture: { current: ServicesSnapshot | null };

  beforeEach(() => {
    capture = { current: null };
    render(
      <PrototypeServicesProvider>
        <ContextProbe capture={capture} />
      </PrototypeServicesProvider>,
    );
  });

  afterEach(() => {
    cleanup();
  });

  it("surfaces an explicit failed setup state with an effective retry — never an endless «جارٍ تجهيز»", async () => {
    await flush();
    const setup = capture.current?.homeSetup;
    expect(setup?.status).toBe("failed");
    expect(typeof (setup as { retry?: unknown } | undefined)?.retry).toBe("function");
    /* الخدمة نفسها لم تُبنَ أبدًا — رفض الاستيراد ليس قراءة فاشلة. */
    expect(capture.current?.homeControlCenter ?? null).toBeNull();
    expect(capture.current?.supplierPurchases ?? null).toBeNull();
  });

  it("keeps the honest failed state after a retry that re-imports the still-unavailable chunk", async () => {
    await flush();
    expect(capture.current?.homeSetup.status).toBe("failed");
    const retry = (capture.current?.homeSetup as { retry: () => void }).retry;
    await act(async () => {
      retry();
      await flush();
    });
    /* إعادة المحاولة الفعالة تعيد الاستيراد نفسه؛ الشظية ما زالت مرفوضة
     * فالحالة الصادقة تبقى «failed» — لا جاهزية كاذبة ولا استثناء غير معالج. */
    expect(capture.current?.homeSetup.status).toBe("failed");
    expect(capture.current?.homeControlCenter ?? null).toBeNull();
  });
});
