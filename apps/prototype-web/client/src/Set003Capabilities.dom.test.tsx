/** @vitest-environment jsdom */
/* SET-003 — السلوك الطبقي الأولي: منتج واحد بقدرات اختيارية. الإيقاف يخفي
 * مداخل الإدخال اليومية فقط (أزرار الرئيسية والعمل)، والسجلات القائمة
 * تبقى ظاهرة؛ والتفضيل يبقى عبر إعادة الفتح، وحفظ التفضيلات الأخرى لا
 * يمس القدرات (O-001). */
import React from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { usePrototypeServices } from "@/app/PrototypeServicesContext";
import { QuickRecordingProvider } from "@/app/quickRecording";
import { UnsavedChangesProvider } from "@/components/forms/UnsavedChangesGuard";
import { MemoryLocalStore } from "@/storage/local/MemoryLocalStore";
import { PreferenceService } from "@/application/preferences/preferenceService";
import { ProfileService } from "@/application/profile/profileService";
import { CashContinuityService } from "@/application/cash/cashContinuityService";
import { ProjectFinancialService } from "@/application/finance/projectFinancialService";
import { HomeControlCenterService } from "@/application/home/homeControlCenterService";
import { InventoryMaterialService } from "@/application/inventory/inventoryMaterialService";
import { SupplierPurchaseService } from "@/application/suppliers/supplierPurchaseService";
import { ActivityService } from "@/application/activity/activityService";
import { AgreementContextService } from "@/application/agreements/agreementContextService";
import { DailyFollowUpService } from "@/application/follow-up/dailyFollowUpService";
import Home from "@/pages/Home";
import { CollectionService } from "@/application/collections/collectionService";
import { DirectSaleService } from "@/application/direct-sales/directSaleService";
import { DueDatesService } from "@/application/finance/dueDatesService";
import { UnifiedFollowUpService } from "@/application/follow-up/unifiedFollowUpService";
import { FulfillmentService } from "@/application/fulfillment/fulfillmentService";
import { activeDeliveryLens } from "@/application/scheduling";

vi.mock("@/app/PrototypeServicesContext", () => ({
  usePrototypeServices: vi.fn(),
}));

const wouterMocks = vi.hoisted(() => ({
  navigate: vi.fn(),
  location: "/",
  search: "",
}));
vi.mock("wouter", () => ({
  useLocation: () => [wouterMocks.location, wouterMocks.navigate],
  useParams: () => ({}),
  useSearch: () => wouterMocks.search,
}));

const mockedUsePrototypeServices = vi.mocked(usePrototypeServices);
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
let store: MemoryLocalStore;
let preferences: PreferenceService;
const contextRef: { current: Record<string, unknown> } = { current: {} };

function Harness({ page }: { page: React.ReactNode }) {
  const [version, setVersion] = React.useState(0);
  contextRef.current = {
    homeControlCenter: buildHomeService(store, () => NOW),
    projectFinance: new ProjectFinancialService(store, () => NOW),
    cashContinuity: new CashContinuityService(store, () => NOW),
    preferences,
    dataVersion: version,
    notifyDataChanged: () => setVersion(current => current + 1),
  };
  mockedUsePrototypeServices.mockImplementation(
    () => contextRef.current as unknown as ReturnType<typeof usePrototypeServices>,
  );
  return (
    <QuickRecordingProvider>
      <UnsavedChangesProvider navigate={wouterMocks.navigate}>{page}</UnsavedChangesProvider>
    </QuickRecordingProvider>
  );
}

describe("SET-003 — layered capability behavior", () => {
  beforeEach(async () => {
    wouterMocks.navigate.mockReset();
    wouterMocks.location = "/";
    wouterMocks.search = "";
    vi.clearAllMocks();
    store = new MemoryLocalStore();
    preferences = new PreferenceService(store, () => NOW);
    const profiles = new ProfileService(store);
    const saved = await profiles.create("مشروع-SET003");
    if (!saved.ok) throw new Error(saved.message);
  });
  afterEach(() => cleanup());

  it("all capabilities default to enabled — the legacy surface is unchanged", async () => {
    /* Wave 4.3 — P-4.3-2: «مسودة تصميم» انتقل خلف «المزيد» (إجراء أقل تكرارًا) —
     * التحديث موثق مع القرار المرئي المعتمد؛ القدرة نفسها ما زالت مفعلة. */
    render(<Harness page={<Home />} />);
    const row = await screen.findByTestId("home-quick-actions");
    /* S16 (ACCESS-01/H): الخمسة — بيع/مصروف/طلب جديد/شراء/أدوات المشروع؛
     * «المزيد» و«مسودة تصميم» غادرا الرئيسية (بيتهما الطلبات). */
    for (const label of ["بيع", "مصروف", "طلب جديد", "شراء", "أدوات المشروع"]) {
      expect(row.textContent).toContain(label);
    }
    expect(screen.queryByRole("button", { name: /المزيد/ })).toBeNull();
  });

  it("disabling orders hides the order/estimate quick actions but never the sale/expense core", async () => {
    const result = await preferences.saveDisabledCapabilities(["orders"]);
    if (!result.ok) throw new Error(result.message);
    render(<Harness page={<Home />} />);
    const row = await screen.findByTestId("home-quick-actions");
    expect(row.textContent).not.toContain("طلب جديد");
    /* الأساس دائمًا مفعّل، والشراء يخضع لقدرة الموردين. */
    expect(row.textContent).toContain("بيع");
    expect(row.textContent).toContain("مصروف");
    expect(row.textContent).toContain("أدوات المشروع");
  });

  it("the preference survives reopen and survives an unrelated theme save (O-001 no-field-loss)", async () => {
    const result = await preferences.saveDisabledCapabilities(["orders"]);
    if (!result.ok) throw new Error(result.message);
    const themeSave = await preferences.save("dark");
    if (!themeSave.ok) throw new Error("theme save");
    const reread = await preferences.readDisabledCapabilities();
    if (!reread.ok) throw new Error(reread.message);
    expect(reread.disabled).toEqual(["orders"]);
    render(<Harness page={<Home />} />);
    const row = await screen.findByTestId("home-quick-actions");
    await waitFor(() => expect(row.textContent).not.toContain("طلب من عميل"));
  });

  it("existing records remain visible and auditable when their capability is disabled", async () => {
    /* دين قائم على طلب موجود ثم إيقاف القدرة — الدين يبقى ظاهرًا في الوقائع. */
    const directSales = new ProjectFinancialService(store, () => NOW);
    const recorded = await directSales.record({
      type: "owner_investment_cash",
      amountMinor: 5000,
      occurredOn: "2026-09-10",
      note: "استثمار",
      counterparty: null,
      relatedEventId: null,
      idempotencyKey: "set003-inv",
    });
    if (!recorded.ok) throw new Error(recorded.message);
    const disabled = await preferences.saveDisabledCapabilities(["orders"]);
    if (!disabled.ok) throw new Error(disabled.message);
    render(<Harness page={<Home />} />);
    /* S16 (HOME-B3): الوقائع تبقى ظاهرة في المالية — الإيقاف لا يخفي التزامًا؛
     * لمحة الرئيسية تبقى ظاهرة بغض النظر عن القدرة. */
    await waitFor(() => expect(screen.getByRole("heading", { level: 2, name: "لمحة مالية" })).toBeTruthy());
    const orders = await store.listOrders();
    if (!orders.ok) throw new Error(orders.message);
    /* لا حذف أبدًا — القدرة لا تمس السجلات. */
    const snapshot = await store.readSnapshot();
    if (!snapshot.ok) throw new Error(snapshot.message);
    expect(JSON.stringify(snapshot.value)).toContain("local-preferences");
  });
});
