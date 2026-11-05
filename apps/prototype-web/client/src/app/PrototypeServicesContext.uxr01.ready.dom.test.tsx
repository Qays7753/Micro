/** @vitest-environment jsdom */

/*
 * UXR-01 (أمر UXR-W01 — قبول A01، F-001/PERF-004): اختبار انحدار للسبب الجذري
 * المثبت لتعليق الرئيسية عند الإقلاع البارد — سلسلة التجهيز الكسولة
 * (بوابة المشتريات → مركز التحكم) تُنشر في سياق الخدمات فور اكتمال تحميلها
 * حتى لو لم تتغير أي اعتمادية أخرى بعدها. المزوّد الحقيقي يُركَّب فوق
 * fake-indexeddb؛ الاستيرادات الكسولة كلها تستبدل بكعبات فورية عدا بوابتي
 * الاختبار (المشتريات ثم مركز التحكم) اللتين يفتحهما الاختبار بالترتيب داخل
 * التركيبة نفسها — فتهدأ كل الخدمات الأخرى قبل سلسلة الرئيسية ولا يبقى
 * بعدها أي محفّث لقيمة السياق (لا كتابة ولا dataVersion). الإصلاح يضع قيمة
 * homeControlCenterService نفسها داخل مصفوفة اعتماديات الـmemo (نمط R1-F2
 * الموثق للخدمات الكسولة الأخرى: الحاسبة/حركات البيع/الاتفاق) إلى جانب
 * حالة التجهيز المنشورة معها — فإذا غيّر أحد لاحقًا آلة حالة التجهيز وأصبح
 * تحديث الخدمة لا يتزامن مع تغيّر الحالة، تبقى النشرة صحيحة ولن يعود تعليق
 * «جارٍ تجهيز مشروعك…» الذي تفكّه أي كتابة (بطاقة F-001 حرفيًا: «أي كتابة
 * في الجلسة تفكّ التعليق») — ولذلك يثبت الاختبار أيضًا بقاء نسخة الخدمة
 * نفسها عند رفع dataVersion بعد النشر.
 */
import "fake-indexeddb/auto";
import React from "react";
import { act, cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { PrototypeServicesProvider, usePrototypeServices } from "@/app/PrototypeServicesContext";

const gates = vi.hoisted(() => {
  let releaseSuppliers: () => void = () => {};
  let releaseHome: () => void = () => {};
  const suppliersGate = new Promise<void>(resolve => {
    releaseSuppliers = resolve;
  });
  const homeGate = new Promise<void>(resolve => {
    releaseHome = resolve;
  });
  return { suppliersGate, homeGate, releaseSuppliers, releaseHome };
});

vi.mock("@/application/suppliers/supplierPurchaseService", () =>
  gates.suppliersGate.then(() => ({
    SupplierPurchaseService: class MockSupplierPurchaseServiceUxr01 {},
  })),
);
vi.mock("@/application/home/homeControlCenterService", () =>
  gates.homeGate.then(() => ({
    HomeControlCenterService: class MockHomeControlCenterServiceUxr01 {},
  })),
);
vi.mock("@/application/follow-up", () => ({
  UnifiedFollowUpService: class MockUnifiedFollowUpServiceUxr01 {},
}));
vi.mock("@/application/scheduling", () => ({
  activeDeliveryLens: () => ({ kind: "mock-delivery-lens-uxr01" }),
}));
vi.mock("@/application/transfers/localTransferService", () => ({
  LocalTransferService: class MockLocalTransferServiceUxr01 {
    static verifiedBackupBuilder() {
      return { build: async () => undefined };
    }
  },
}));
vi.mock("@/application/transfers/guidedOpeningImportService", () => ({
  GuidedOpeningImportService: class MockGuidedOpeningImportServiceUxr01 {},
}));
vi.mock("@/application/recurring/recurringExpenseService", () => ({
  RecurringExpenseService: class MockRecurringExpenseServiceUxr01 {},
}));
vi.mock("@/application/loans/loanService", () => ({
  LoanService: class MockLoanServiceUxr01 {},
}));
vi.mock("@/application/agreements/agreementService", () => ({
  AgreementService: class MockAgreementServiceUxr01 {},
}));
vi.mock("@/application/cash/cashCountService", () => ({
  CashCountService: class MockCashCountServiceUxr01 {},
}));
vi.mock("@/application/parties/partyLedgerService", () => ({
  PartyDirectoryService: class MockPartyDirectoryServiceUxr01 {},
}));
vi.mock("@/application/assets/assetService", () => ({
  AssetService: class MockAssetServiceUxr01 {},
}));
vi.mock("@/application/estimates/planningCalculationLifecycle", () => ({
  PlanningCalculationLifecycleService: class MockPlanningCalculationsUxr01 {},
}));
vi.mock("@/application/direct-sales/directSaleMovements", () => ({
  DirectSaleMovementsService: class MockDirectSaleMovementsServiceUxr01 {},
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

describe("PrototypeServicesContext — UXR-01 Home setup chain (W01)", () => {
  afterEach(() => {
    cleanup();
  });

  it("publishes the home control center the moment its gated import settles — honest loading, no later dependency change, stable instance", async () => {
    const capture: { current: ServicesSnapshot | null } = { current: null };
    render(
      <PrototypeServicesProvider>
        <ContextProbe capture={capture} />
      </PrototypeServicesProvider>,
    );
    /* (١) كل الاستيرادات الكسولة الأخرى هدأت (كعبات فورية)؛ سلسلة الرئيسية
     * ما زالت خلف بوابتي الاختبار — الحالة الصادقة «جارٍ تجهيز» لا خطأ. */
    await flush();
    expect(capture.current?.homeControlCenter ?? null).toBeNull();
    expect(capture.current?.homeSetup.status).toBe("loading");
    expect(capture.current?.supplierPurchases ?? null).toBeNull();
    /* (٢) بوابة المشتريات (الرابط الأول في السلسلة الوحيدة الموثقة)
     * تفتح: الخدمة تُبنَى وتُنشر، ومركز التحكم ما زال قيد الاستيراد. */
    await act(async () => {
      gates.releaseSuppliers();
      await flush();
    });
    expect(capture.current?.supplierPurchases ?? null).not.toBeNull();
    expect(capture.current?.homeControlCenter ?? null).toBeNull();
    expect(capture.current?.homeSetup.status).toBe("loading");
    /* (٣) بوابة مركز التحكم تفتح — لا كتابة ولا dataVersion بعدها أبدًا:
     * النشرة إلى السياق يجب أن تتم هنا فورًا؛ عيب الـmemo (F-001) هو أن
     * تظل القيمة null بعد هذا الحدث إلى أن تكتب الجلسة شيئًا. */
    await act(async () => {
      gates.releaseHome();
      await flush();
    });
    expect(capture.current?.homeControlCenter ?? null).not.toBeNull();
    expect(capture.current?.homeSetup.status).toBe("ready");
    /* (٤) S5-08: كتابة ترفع dataVersion تعيد تغليف السياق فقط — نسخة
     * مركز التحكم نفسها تبقى (لا إعادة بناء خدمات عند كل كتابة). */
    const before = capture.current?.homeControlCenter;
    await act(async () => {
      capture.current?.notifyDataChanged();
      await flush();
    });
    expect(capture.current?.homeControlCenter).toBe(before);
    expect(capture.current?.homeSetup.status).toBe("ready");
  });
});
