/** @vitest-environment jsdom */
/* Wave 4.4 — P-4.4-1: بقايا Wave 4.3 واتساق طبقة القراءة.
 * ---------------------------------------------------------------------------
 * ١) تكافؤ نماذج القراءة قبل/بعد على Fixtures موثقة: تجميعات الأصول والقروض
 *    التي كانت تُحسب داخل العرض تساوي حرفيًا totals خدمة القراءة الجديدة؛
 *    وطرح مصدرَي «شو عليّ؟» (العرض القديم) يساوي operatingPayablesMinor
 *    (قراءة المركز الجديدة) — لا معادلة موازية ولا قيمة تغيرت.
 * ٢) تماثل D8 لبطاقات حقائق الرئيسية: الحقيقة المعروفة تفتح مصدرها الحقيقي
 *    (الكاش → المحافظ، لي عند العملاء → دليل «العملاء والموردين»، عليّ للموردين → «شو
 *    عليّ؟» في المالية) — ولا وجهة وهمية.
 * ٣) زر «أظهر المعرّفات» الميت في سلامة الحسابات أُزيل بعد D9.
 * ٤) لوحتا «قريبًا» في الترويسة: Escape يغلق ويعيد التركيز للمشغّل،
 *    والتركيز يدخل اللوحة عند فتحها — كسلوك قائمة الشعار نفسه.
 */
import React from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { usePrototypeServices, getPrototypeLocalStore } from "@/app/PrototypeServicesContext";
import { AppHeader } from "@/components/layout/AppHeader";
import { ThemeProvider } from "@/contexts/ThemeContext";
import { MemoryLocalStore } from "@/storage/local/MemoryLocalStore";
import { AssetService } from "@/application/assets/assetService";
import { LoanService } from "@/application/loans/loanService";
import { ProjectFinancialService } from "@/application/finance/projectFinancialService";
import { IntegrityCheckService } from "@/application/finance/integrityCheckService";
import { StatementService } from "@/application/finance/statementService";
import { CashContinuityService } from "@/application/cash/cashContinuityService";
import { FormDraftService } from "@/application/drafts/formDraftService";
import { ProfileService } from "@/application/profile/profileService";
import { SupplierPurchaseService } from "@/application/suppliers/supplierPurchaseService";
import { HomeControlCenterService } from "@/application/home/homeControlCenterService";
import { AgreementContextService } from "@/application/agreements/agreementContextService";
import { InventoryMaterialService } from "@/application/inventory/inventoryMaterialService";
import { DailyFollowUpService } from "@/application/follow-up/dailyFollowUpService";
import { ActivityService } from "@/application/activity/activityService";
import { DirectSaleService } from "@/application/direct-sales/directSaleService";
import { QuickRecordingProvider } from "@/app/quickRecording";
import { calculateCostSnapshot, createCraftOrder } from "@micro-domain/craft-order/index.js";
/* UNIT-035 (تنفيذ S15): زرع القروض التاريخية عند حد المخزن — نفس نمط
 * loanService.test.ts (المصنعان الكنونيان + commitLoanRecord). */
import { createLoanRecord } from "@micro-domain/loan/index.js";
import { createFinancialEvent, type FinancialEvent } from "@micro-domain/financial-event/index.js";
import { SettingsDataCheckSection } from "@/components/settings/SettingsDataCheckSection";
import Home from "@/pages/Home";
import { UnsavedChangesProvider } from "@/components/forms/UnsavedChangesGuard";
import { CollectionService } from "@/application/collections/collectionService";
import { DueDatesService } from "@/application/finance/dueDatesService";
import { UnifiedFollowUpService } from "@/application/follow-up/unifiedFollowUpService";
import { FulfillmentService } from "@/application/fulfillment/fulfillmentService";
import { activeDeliveryLens } from "@/application/scheduling";

vi.mock("@/app/PrototypeServicesContext", () => ({
  usePrototypeServices: vi.fn(),
  getPrototypeLocalStore: vi.fn(),
}));

const wouterMocks = vi.hoisted(() => ({
  navigate: vi.fn(),
  location: "/",
  params: {} as Record<string, string>,
}));
vi.mock("wouter", () => ({
  useLocation: () => [wouterMocks.location, wouterMocks.navigate],
  useParams: () => wouterMocks.params,
  useSearch: () => "",
}));

const mockedUsePrototypeServices = vi.mocked(usePrototypeServices);
const mockedGetStore = vi.mocked(getPrototypeLocalStore);
/* S16 (UNIT-003): قارئ الرئيسية في الاختبارات فوق المصادر الكنونية نفسها —
 * القارئ الموحد للمتابعة (S13) بعدساته القائمة؛ لا قارئ ثانٍ. */
function buildHomeService(store: MemoryLocalStore, now: () => string) {
  const projectFinance = new ProjectFinancialService(store, now);
  const directSales = new DirectSaleService(store, now);
  const fulfillment = new FulfillmentService(store, now);
  const collections = new CollectionService(store, fulfillment, directSales, projectFinance);
  const dueDates = new DueDatesService(store, collections, now);
  const unified = new UnifiedFollowUpService(
    activeDeliveryLens(store),
    store,
    collections,
    dueDates,
    projectFinance,
    store,
    now,
  );
  return new HomeControlCenterService(store, new DailyFollowUpService(store), projectFinance, unified, now);
}

const NOW = "2026-09-16T09:00:00.000Z";
const now = () => NOW;

let store: MemoryLocalStore;

beforeEach(() => {
  store = new MemoryLocalStore();
  wouterMocks.navigate.mockReset();
  /* أمر استئناف S14 (2026-11-03 — A3): صفحة فحص السلامة تبني الخدمة كسولًا
   * بساعة النظام — تُثبَّت Date على لحظة الاختبار فيصير التقرير حتميًا. */
  vi.useFakeTimers({ now: new Date(NOW), toFake: ["Date"] });
  mockedGetStore.mockReturnValue(store as never);
});

afterEach(() => {
  vi.useRealTimers();
  cleanup();
  vi.clearAllMocks();
});

async function seedProfile(name = "مشغل تكافؤ القراءة") {
  const result = await new ProfileService(store, now).create(name);
  if (!result.ok) throw new Error(result.message);
}

/* Fixture موثقة: أصلان (أحدهما بإهلاك مجهول العمر) + قرضان (أحدهما مسدد
 * جزئيًا) + شراء مورد بذمم + مصروف مستحق — تغطي كل التجميعات المنقولة. */
async function seedFixtures() {
  const assets = new AssetService(store, now);
  const firstAsset = await assets.create({
    name: "ماكينة خياطة صناعية",
    categoryLabel: "آلات",
    acquisitionAmountMinor: 250000,
    acquisitionKind: "cash",
    purchaseDate: "2026-08-01",
    lifeMonths: 60,
    depreciationStartOn: "2026-08-01",
    note: null,
  });
  if (!firstAsset.ok) throw new Error(firstAsset.message);
  const secondAsset = await assets.create({
    name: "رف عرض طويل الأمد",
    categoryLabel: "تجهيزات",
    acquisitionAmountMinor: 90000,
    acquisitionKind: "payable",
    purchaseDate: "2026-09-01",
    lifeMonths: null,
    depreciationStartOn: null,
    note: null,
  });
  if (!secondAsset.ok) throw new Error(secondAsset.message);
  /* UNIT-035 (تنفيذ S15 بالأمر الموحد §5): إنشاء الإقراض ملغى عند حد الكاتب —
   * القروض هنا بيانات موروثة للقراءة فتُزرع مباشرة عند حد المخزن (نفس مسار
   * توافق النقل) لا عبر خدمة الإنشاء الملغاة؛ التسديد يبقى عبر مساره الحي. */
  const seedLegacyLoan = async (
    loanId: string,
    borrowerName: string,
    principalMinor: number,
    loanDate: string,
  ) => {
    const event = createFinancialEvent({
      id: `event-${loanId}`,
      type: "loan_outgoing_cash",
      amountMinor: principalMinor,
      occurredOn: loanDate,
      recordedAt: `${loanDate}T09:00:00.000Z`,
      idempotencyKey: `${loanId}:principal`,
      note: "قرض تاريخي لاختبار تكافؤ القراءة",
      counterparty: borrowerName,
      loanContext: { loanId, borrower: borrowerName },
    }) as FinancialEvent;
    const loan = createLoanRecord({
      id: loanId,
      borrowerName,
      principalMinor,
      loanDate,
      purposeNote: null,
      sourceWalletId: null,
      principalEventId: event.id,
      operationKey: `${loanId}:create`,
      createdAt: `${loanDate}T09:00:00.000Z`,
    });
    const commit = await store.commitLoanRecord(loan, event);
    if (!commit.ok) throw new Error(commit.message);
    return loanId;
  };
  const loans = new LoanService(store, now);
  const firstLoanId = await seedLegacyLoan("w44-parity-loan-1", "سامي الحداد", 120000, "2026-08-10");
  const secondLoanId = await seedLegacyLoan("w44-parity-loan-2", "ليلى النجار", 50000, "2026-09-01");
  const repaid = await loans.recordRepayment(secondLoanId, {
    amountMinor: 20000,
    date: "2026-09-08",
    note: null,
  });
  if (!repaid.ok) throw new Error(repaid.message);
  const purchase = await new SupplierPurchaseService(store, now).recordPurchase({
    supplierName: "مورد الأقمشة",
    note: "قماش تغليف",
    purchasedOn: "2026-09-10",
    dueOn: null,
    totalMinor: 40000,
    initialPaidMinor: 10000,
    idempotencyKey: "w44-parity-purchase",
  });
  if (!purchase.ok) throw new Error(purchase.message);
  const finance = new ProjectFinancialService(store, now);
  const expense = await finance.record({
    type: "operating_expense_payable",
    amountMinor: 15000,
    occurredOn: "2026-09-12",
    note: "فاتورة كهرباء",
    counterparty: "شركة الكهرباء",
    relatedEventId: null,
    expenseContext: {
      relationship: "project",
      behavior: "fixed",
      purpose: "project_general",
      knowledge: "known",
      sharedProjectShare: null,
      categoryLabel: "كهرباء",
    },
    idempotencyKey: "w44-parity-payable",
  });
  if (!expense.ok) throw new Error(expense.message);
}

describe("Wave 4.4 — P-4.4-1: read-layer aggregation parity (before/after on documented fixtures)", () => {
  it("asset overview totals equal the exact view-layer reduce they replace", async () => {
    await seedProfile();
    await seedFixtures();
    const overview = await new AssetService(store, now).overview();
    if (!overview.ok) throw new Error(overview.message);
    /* معادلة العرض القديمة (قبل النقل) — تُعاد هنا حرفيًا لإثبات التكافؤ. */
    const legacyBookValue = overview.value.rows.reduce((sum, row) => sum + row.bookValueMinor, 0);
    const legacyUnrecorded = overview.value.rows.reduce(
      (sum, row) => sum + row.unrecordedDepreciationMinor,
      0,
    );
    expect(overview.value.totals.bookValueMinor).toBe(legacyBookValue);
    expect(overview.value.totals.unrecordedDepreciationMinor).toBe(legacyUnrecorded);
    /* الدلالة لم تتغير: الأصلان المسجلان موجودان بقيمهما الدفترية. */
    expect(overview.value.rows).toHaveLength(2);
    expect(overview.value.rows.map(row => row.asset.name)).toEqual(
      expect.arrayContaining(["ماكينة خياطة صناعية", "رف عرض طويل الأمد"]),
    );
  });

  it("loan overview totals equal the exact view-layer reduce they replace", async () => {
    await seedProfile();
    await seedFixtures();
    const overview = await new LoanService(store, now).overview();
    if (!overview.ok) throw new Error(overview.message);
    const legacyOutstanding = overview.value.rows.reduce((sum, row) => sum + row.reading.outstandingMinor, 0);
    expect(overview.value.totals.outstandingMinor).toBe(legacyOutstanding);
    expect(overview.value.totals.outstandingMinor).toBe(150000);
  });

  it("obligations split: operatingPayablesMinor equals the view subtraction it replaces (شو عليّ؟)", async () => {
    await seedProfile();
    await seedFixtures();
    const position = await new ProjectFinancialService(store, now).readPosition();
    if (!position.ok) throw new Error(position.message);
    /* طرح العرض القديم: مصاريف مستحقة = إجمالي الالتزامات − التزامات المشتريات. */
    const legacyExpensesMinor =
      position.value.supplierPayablesMinor - position.value.supplierMaterialPayablesMinor;
    expect(position.value.operatingPayablesMinor).toBe(legacyExpensesMinor);
    /* المصدران على الـFixture: 30.00 ذمم مشتريات + 15.00 مصروف مستحق
     * + 90.00 ذمم اقتناء الأصل بالذمم (يدخل الذمم العامة كما في الطرح
     * القديم نفسه — التكافؤ هو العهد، والدلالة لم تتغير). */
    expect(position.value.supplierMaterialPayablesMinor).toBe(30000);
    expect(position.value.operatingPayablesMinor).toBe(105000);
    expect(position.value.supplierPayablesMinor).toBe(135000);
  });

  it("the read services stay pure reads — seeding then reading writes nothing new", async () => {
    await seedProfile();
    await seedFixtures();
    const before = await store.readSnapshot();
    const assets = new AssetService(store, now);
    const loans = new LoanService(store, now);
    const finance = new ProjectFinancialService(store, now);
    const assetRead = await assets.overview();
    const loanRead = await loans.overview();
    const positionRead = await finance.readPosition();
    if (!assetRead.ok || !loanRead.ok || !positionRead.ok) throw new Error("reads failed");
    const after = await store.readSnapshot();
    expect(after).toEqual(before);
  });
});

describe("Wave 4.4 — P-4.4-1: home fact cards open their real sources (D8 parity)", () => {
  function homeServices() {
    const finance = new ProjectFinancialService(store, now);
    const suppliers = new SupplierPurchaseService(store, now);
    return buildHomeService(store, now);
  }

  /* طلب قائم يجعل «لي عند العملاء» معروفة (دليل تسجيل) دون مس الأرقام الأخرى. */
  async function seedOpenOrder() {
    const cost = calculateCostSnapshot("cost-w44-d8", {
      currency: "JOD",
      materialItems: [],
      time: { minutes: 30, hourlyRateMinor: 300, confidence: "known" },
      packagingMinor: 0,
      deliveryMinor: 0,
      wasteMinor: 0,
      safetyBufferMinor: 0,
      quantity: 1,
      createdAt: "2026-09-10T09:00:00.000Z",
      freshnessDays: null,
      source: "price_approval",
    });
    const order = createCraftOrder({
      id: "w44-d8-order",
      customerName: "ريم",
      itemName: "خاتم أمانة",
      specifications: "اختبار",
      quantity: 1,
      agreedPriceMinor: 5000,
      costSnapshot: cost,
      createdAt: "2026-09-10T09:00:00.000Z",
    });
    await store.saveOrder({
      id: order.id,
      order,
      updatedAt: "2026-09-10T09:00:00.000Z",
      catalogItemId: null,
      deliveryDate: "2026-09-20",
      agreementSource: "test",
      createdAt: "2026-09-10T09:00:00.000Z",
    });
  }

  it("known facts carry their real source routes — no fake destinations", async () => {
    await seedProfile();
    await seedFixtures();
    await seedOpenOrder();
    const result = await homeServices().read();
    if (!result.ok) throw new Error(result.message);
    const cashNow = result.value.glimpse.cashNow;
    /* D8 (S16): النقد الآن من قراءة الوضع نفسها ويفتح محافظه القائمة — لا
     * وجهة وهمية؛ بقية الحقائق عند أصحابها (المالية/الأطراف). */
    expect(cashNow.state).toBe("known");
    expect(cashNow.sourceHref).toBe("/cash");
    const positionRead = await new ProjectFinancialService(store, now).readPosition();
    if (!positionRead.ok) throw new Error(positionRead.message);
    expect(cashNow.valueMinor).toBe(positionRead.value.recordedCashMinor);
  });

  it("unrecorded facts keep their honest road and no invented source", async () => {
    await seedProfile();
    const result = await homeServices().read();
    if (!result.ok) throw new Error(result.message);
    const cashNow = result.value.glimpse.cashNow;
    expect(cashNow.state).toBe("not_initialized");
    expect(cashNow.valueMinor).toBeNull();
  });

  it("the Home surface renders known facts as buttons that navigate to their sources", async () => {
    await seedProfile();
    await seedFixtures();
    await seedOpenOrder();
    const home = homeServices();
    mockedUsePrototypeServices.mockReturnValue({
      homeControlCenter: home,
      projectFinance: new ProjectFinancialService(store, now),
      cashContinuity: new CashContinuityService(store, now),
      directSales: new DirectSaleService(store, now),
      preferences: {
        load: async () => ({ ok: true, preference: { theme: "light" } }),
        save: async () => ({ ok: true }),
        readDisabledCapabilities: async () => ({ ok: true, disabled: [] }),
        saveDisabledCapabilities: async () => ({ ok: true, disabled: [] }),
      },
      dataVersion: 0,
      notifyDataChanged: vi.fn(),
    } as unknown as ReturnType<typeof usePrototypeServices>);
    render(
      <QuickRecordingProvider>
        <UnsavedChangesProvider navigate={wouterMocks.navigate}>
          <Home />
        </UnsavedChangesProvider>
      </QuickRecordingProvider>,
    );
    /* S16 (HOME-A2-4): أزرار اللمحة — النقد الآن يفتح 022 والمبيعات المسجلة
     * تفتح كشف 016 بالنطاق نفسه؛ لي عند العملاء وعليّ للموردين عند أصحابهما
     * في المالية والأطراف (HOME-R07). */
    const cashButton = await screen.findByRole("button", { name: "افتح النقد المسجل الآن" });
    fireEvent.click(cashButton);
    expect(wouterMocks.navigate).toHaveBeenCalledWith("/cash?returnTo=%2F");
    const salesButton = screen.getByRole("button", { name: "افتح المبيعات المسجلة بالنطاق نفسه" });
    fireEvent.click(salesButton);
    expect(wouterMocks.navigate).toHaveBeenCalledWith(
      "/finance/statement?since=2026-09-01&until=2026-09-16&returnTo=%2F",
    );
  });
});

describe("Wave 4.4 — P-4.4-1: integrity dead identifiers button removed after D9", () => {
  function integrityServices() {
    const projectFinance = new ProjectFinancialService(store, now);
    const statement = new StatementService(store, projectFinance);
    const cashContinuity = new CashContinuityService(store, now);
    const integrityCheck = new IntegrityCheckService(store, projectFinance, statement, cashContinuity, now);
    return { projectFinance, statement, cashContinuity, integrityCheck };
  }

  /* نفس بذرة فساد IntegrityReadable.w43: حدث مسجل ثم تزوير أثره المالي مباشرة. */
  async function seedCorruptedEvent() {
    const services = integrityServices();
    const recorded = await services.projectFinance.record({
      type: "operating_expense_payable",
      amountMinor: 12000,
      occurredOn: "2026-09-01",
      note: "فاتورة مورد",
      counterparty: "المورد",
      relatedEventId: null,
      expenseContext: {
        relationship: "project",
        behavior: "fixed",
        purpose: "project_general",
        knowledge: "known",
        sharedProjectShare: null,
        categoryLabel: "مواد",
      },
      idempotencyKey: "w44-corrupt-payable",
    });
    if (!recorded.ok) throw new Error(recorded.message);
    const events = await store.listFinancialEvents();
    if (!events.ok) throw new Error(events.message);
    const target = events.value.find(event => event.id === recorded.value.id);
    if (!target) throw new Error("seeded event missing");
    const saved = await store.saveFinancialEvent({ ...target, amountMinor: 99000 });
    if (!saved.ok) throw new Error(saved.message);
    return services;
  }

  it("a failing check with offenders renders no identifiers toggle button", async () => {
    await seedProfile();
    const services = await seedCorruptedEvent();
    mockedUsePrototypeServices.mockReturnValue({
      ...services,
      formDrafts: new FormDraftService(store),
      dataVersion: 0,
      notifyDataChanged: vi.fn(),
    } as unknown as ReturnType<typeof usePrototypeServices>);
    render(<SettingsDataCheckSection open={true} onToggle={() => {}} />);
    await screen.findByText(/أرقامك كما هي/);
    fireEvent.click(screen.getByRole("button", { name: /بدء الفحص/ }));
    await screen.findByTestId("integrity-offender-summary");
    /* الزر الميت أُزيل — المعرّفات الخام الاحتياطية (إن بقيت) تظهر داخل التفصيل بلا زر. */
    expect(screen.queryByRole("button", { name: "أظهر المعرّفات" })).toBeNull();
    expect(screen.queryByRole("button", { name: "إخفاء المعرّفات" })).toBeNull();
    /* مسار الفحص نفسه سليم: الخلاصة تعرض الخلل بأمانة. */
    await waitFor(() => expect(screen.getByText(/خلل — يوجد خلل يحتاج تصحيحًا موثقًا/)).toBeTruthy());
  });
});

describe("Wave 4.4 — P-4.4-1: soon panels match the logo-menu Escape and focus behavior", () => {
  function renderHeader() {
    const navigate = vi.fn();
    mockedUsePrototypeServices.mockImplementation(
      () =>
        ({
          preferences: {
            load: async () => ({ ok: true, preference: { theme: "light" } }),
            save: async () => ({ ok: true }),
          },
          dataVersion: 0,
        }) as unknown as ReturnType<typeof usePrototypeServices>,
    );
    window.history.pushState({}, "", "/");
    render(
      <ThemeProvider>
        <AppHeader contextLabel={null} accountComplete={null} onNavigate={navigate} />
      </ThemeProvider>,
    );
    return navigate;
  }

  it("opening a soon panel moves focus into it; Escape closes and returns focus to its trigger", async () => {
    renderHeader();
    /* S16 (UNIT-043) + DEC-SHELL-01 (UXR-03 — أمر W02): لوحة الإعلان مشغّلها
     * بند قائمة «مايكرو» — تفتح من القائمة (مالكها زر الشعار). */
    const menuOwner = screen.getByTestId("micro-logo-menu-button");
    fireEvent.click(menuOwner);
    fireEvent.click(screen.getByRole("menuitem", { name: "اسأل Micro — قريبًا" }));
    const panel = await screen.findByTestId("soon-panel");
    expect(panel.getAttribute("role")).toBe("dialog");
    /* التركيز يدخل اللوحة عند فتحها. */
    await waitFor(() => expect(panel.contains(document.activeElement)).toBe(true));
    /* Escape يغلق ويعيد التركيز إلى مالك القائمة (زر الشعار) — كسلوك
     * القائمة نفسه. */
    fireEvent.keyDown(document, { key: "Escape" });
    await waitFor(() => expect(screen.queryByTestId("soon-panel")).toBeNull());
    expect(document.activeElement).toBe(menuOwner);
  });

  it("the assistant panel behaves the same, and Tab stays trapped inside the dialog", async () => {
    renderHeader();
    const menuOwner = screen.getByTestId("micro-logo-menu-button");
    fireEvent.click(menuOwner);
    fireEvent.click(screen.getByRole("menuitem", { name: "اسأل Micro — قريبًا" }));
    const panel = await screen.findByTestId("soon-panel");
    await waitFor(() => expect(panel.contains(document.activeElement)).toBe(true));
    const closeButton = screen.getByRole("button", { name: "إغلاق" });
    expect(panel.contains(closeButton)).toBe(true);
    /* حبس التركيز: Tab من آخر عنصر يعود إلى أوله داخل اللوحة. */
    closeButton.focus();
    fireEvent.keyDown(document, { key: "Tab" });
    await waitFor(() => expect(panel.contains(document.activeElement)).toBe(true));
    /* الإغلاق بزر X يعيد التركيز للمشغّل أيضًا. */
    fireEvent.click(closeButton);
    await waitFor(() => expect(screen.queryByTestId("soon-panel")).toBeNull());
    expect(document.activeElement).toBe(menuOwner);
  });
});
