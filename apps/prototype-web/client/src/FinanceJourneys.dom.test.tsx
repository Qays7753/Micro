/** @vitest-environment jsdom */

/* المجموعة ١١ (المرحلة 11-E — تغطية الرحلات عالية القيمة): صفحة مالي —
 * أكبر سطح مالي بعد تفكيك المرحلة 11-D وقراءة الفترة خلف نواة قراءة الفترة.
 * الرحلات عبر الحدود الحقيقية (تفاعل ← خدمة ← مخزن الذاكرة): الرصيد النقدي
 * المسجل بدقته الكاملة في عرض «الوضع الآن»، وشريط الكاش غير الموزع بقيمته
 * الدقيقة وطريقه (PA-002)، وعرض «شو صار خلال الفترة» عبر طبقة القراءة
 * المستخرجة بنطاقه المعلن ونتيجته الصادقة. */
import React from "react";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { usePrototypeServices } from "@/app/PrototypeServicesContext";
import { withFrom } from "@/app/navigationContract";
import { UnsavedChangesProvider } from "@/components/forms/UnsavedChangesGuard";
import { MemoryLocalStore } from "@/storage/local/MemoryLocalStore";
import { ProjectFinancialService } from "@/application/finance/projectFinancialService";
import { CashContinuityService } from "@/application/cash/cashContinuityService";
import { InventoryMaterialService } from "@/application/inventory/inventoryMaterialService";
import { SupplierPurchaseService } from "@/application/suppliers/supplierPurchaseService";
import { AgreementContextService } from "@/application/agreements/agreementContextService";
import { ActivityService } from "@/application/activity/activityService";
import { CorrectionHistoryService } from "@/application/finance/correctionHistoryService";
import { OwnerEntitlementService } from "@/application/finance/ownerEntitlementService";
import { G5Service } from "@/application/g5/g5Service";
import { FinancialPulseService } from "@/application/financial-pulse/financialPulseService";
import { FulfillmentService } from "@/application/fulfillment/fulfillmentService";
import { ScheduleService } from "@/application/scheduling/scheduleService";
import { AssetService } from "@/application/assets/assetService";
import { LoanService } from "@/application/loans/loanService";
import { RetainedDepositService } from "@/application/finance/retainedDepositService";
import { ProfileService } from "@/application/profile/profileService";
import Finance from "@/pages/Finance";

vi.mock("@/app/PrototypeServicesContext", () => ({
  usePrototypeServices: vi.fn(),
}));

const wouterMocks = vi.hoisted(() => ({
  navigate: vi.fn(),
  location: "/finance",
  params: {} as Record<string, string>,
}));
vi.mock("wouter", () => ({
  useLocation: () => [wouterMocks.location, wouterMocks.navigate],
  useParams: () => wouterMocks.params,
  useSearch: () => "",
}));

const mockedUsePrototypeServices = vi.mocked(usePrototypeServices);
const NOW = "2026-09-12T09:00:00.000Z";

let store: MemoryLocalStore;
let projectFinance: ProjectFinancialService;
let dataVersion = 0;

/* تركيب الخدمات كما في جذر التركيب نفسه (PrototypeServicesContext) — فوق مخزن
 * الذاكرة وساعة ثابتة: الصفحة تُقرأ من الحدود الحقيقية لا من محاكاة. */
function buildServices() {
  const schedules = new ScheduleService(store, () => NOW);
  const cashContinuity = new CashContinuityService(store, () => NOW);
  const inventory = new InventoryMaterialService(store, () => NOW);
  projectFinance = new ProjectFinancialService(store, () => NOW);
  return {
    projectFinance,
    correctionHistory: new CorrectionHistoryService(store),
    ownerEntitlement: new OwnerEntitlementService(
      store,
      (from, to) => projectFinance.readRecordedPeriodResult(from, to),
      () => NOW,
    ),
    g5: new G5Service(store, projectFinance, () => NOW),
    financialPulse: new FinancialPulseService(store),
    fulfillment: new FulfillmentService(store, () => NOW, schedules),
    inventory,
    assets: new AssetService(store, () => NOW),
    loans: new LoanService(store, () => NOW),
    retainedDeposits: new RetainedDepositService(store, () => NOW),
    /* خدمات الرحلة (زر التوزيع يقرأ من قارئ المشروع نفسه). */
    cashContinuity,
    dataVersion,
    notifyDataChanged: () => {
      dataVersion += 1;
    },
  } as unknown as ReturnType<typeof usePrototypeServices>;
}

beforeEach(() => {
  store = new MemoryLocalStore();
  dataVersion = 0;
  mockedUsePrototypeServices.mockReturnValue(buildServices());
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

async function seedProfile() {
  const result = await new ProfileService(store, () => NOW).save("مشغل الاختبار");
  if (!result.ok) throw new Error(result.message);
}

async function openWalletWith(minor: number) {
  const cash = new CashContinuityService(store, () => NOW);
  const opened = await cash.openWallet({
    name: "درج",
    kind: "cash_drawer",
    openingMinor: minor,
    occurredOn: "2026-09-01",
    note: "رصيد بداية",
    operationKey: `g11-finance-open-${minor}`,
  });
  if (!opened.ok) throw new Error(opened.message);
}

function renderFinance() {
  return render(
    <UnsavedChangesProvider navigate={wouterMocks.navigate}>
      <Finance />
    </UnsavedChangesProvider>,
  );
}

describe("Finance journeys (Group 11-E)", () => {
  it("keeps the recorded wallet opening exact on the position view", async () => {
    await openWalletWith(152040);
    await seedProfile();
    renderFinance();
    /* عقد الجهوزية: عنوان «مالي» الدائم في الحالة الجاهزة. */
    expect(await screen.findByRole("heading", { level: 1, name: "مالي" })).toBeTruthy();
    /* القيمة الدقيقة 1,520.40 د.أ تُعرض كما خُزنت (152,040 قروشًا) بلا تقريب. */
    expect(screen.getAllByText("1,520.40").length).toBeGreaterThan(0);
    expect(screen.getByText("الكاش المسجل")).toBeTruthy();
    /* سطر الحقيقة: محافظ مسجلة: 1 — التسمية تصف ما تحته. */
    expect(screen.getByText(/محافظ مسجلة: 1/)).toBeTruthy();
    /* القراءة الراجعة من نواة قراءة المركز نفسها: القيمة الصحيحة بالقروش. */
    const position = await projectFinance.readPosition();
    expect(position.ok && position.value.recordedCashMinor).toBe(152040);
  });

  it("surfaces unallocated cash with its exact amount and the distribution road (PA-002)", async () => {
    await openWalletWith(40000);
    await seedProfile();
    /* تغطية من المحفظة إلى غير الموزع (اتجاه cover): كاش غير موزع حقيقي 271.00 د.أ. */
    const seededOverview = await new CashContinuityService(store, () => NOW).overview();
    if (!seededOverview.ok) throw new Error("overview failed before the finance journey");
    const walletId = seededOverview.value.wallets[0]?.id ?? "";
    const covered = await projectFinance.distributeUnallocated({
      walletId,
      deltaMinor: -27100,
      note: "صرف أُعيد للمراجعة",
      operationKey: "g11-finance-seed-cover",
    });
    if (!covered.ok) throw new Error(covered.message);

    renderFinance();
    expect(await screen.findByRole("heading", { level: 1, name: "مالي" })).toBeTruthy();
    /* الشريط الصريح: كاش غير موزع 271.00 — لا كاش عالق بلا طريق حل. */
    const stripTitle = screen.getByText("كاش غير موزع:");
    const strip = stripTitle.closest(".micro-unallocated-strip");
    expect(strip).toBeTruthy();
    expect(within(strip as HTMLElement).getByText("271.00")).toBeTruthy();
    /* الطريق: زر «وزّع على محفظة» يحفظ المصدر (?from=/finance). */
    fireEvent.click(screen.getByRole("button", { name: "وزّع على محفظة" }));
    expect(wouterMocks.navigate).toHaveBeenCalledWith(withFrom("/cash/distribute", "/finance"));
    /* القراءة الراجعة: غير الموزع 27,100 قروشًا بالضبط بلا تقريب. */
    const position = await projectFinance.readPosition();
    expect(position.ok && position.value.unallocatedCashMinor).toBe(27100);
  });

  it("opens the period view through the extracted reading layer with an honest declared range", async () => {
    await openWalletWith(15000);
    await seedProfile();
    renderFinance();
    expect(await screen.findByRole("heading", { level: 1, name: "مالي" })).toBeTruthy();
    /* قرار القراءة: تبويب «شو صار خلال الفترة» يفتح عرض الفترة ويحفظه في الرابط. */
    fireEvent.click(screen.getByRole("tab", { name: "شو صار خلال الفترة" }));
    expect(wouterMocks.navigate).toHaveBeenCalledWith("/finance?view=period", { replace: true });
    /* طبقة قراءة الفترة المستخرجة (11-D): نتيجة الفترة المسجلة بنطاقها المعلن. */
    expect(await screen.findByRole("heading", { name: "نتيجة الفترة المسجلة" })).toBeTruthy();
    /* نطاق القراءة المعلن (F-005): ما يدخل الفترة وما لا يدخلها معلن صراحة. */
    expect(screen.getByLabelText("نطاق قراءة الفترة")).toBeTruthy();
    expect(screen.getByText(/النطاق المحدد:/)).toBeTruthy();
    /* حدود النطاق نفسها تُعرض كمدخلين معلنين لا كمجرد نص. */
    expect(screen.getByLabelText("بداية نطاق نتيجة الفترة")).toBeTruthy();
    expect(screen.getByLabelText("نهاية نطاق نتيجة الفترة")).toBeTruthy();
  });
});
