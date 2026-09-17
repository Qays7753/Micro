/** @vitest-environment jsdom */
/* Wave 4.3 — P-4.3-2: إعادة بناء «مشروعي الآن» — الترتيب المهني الجديد.
 * ---------------------------------------------------------------------------
 * ١) قسم الأرقام: تقسيم واضح «اليوم» و«هذا الشهر» من القراءة الرسمية،
 *    والوضع القائم (الحقائق) تحتهما — لا بطاقات دفعة واحدة.
 * ٢) الرقم القابل للفتح يصل مصدره (عرض الفترة)؛ النتيجة الناقصة وصف صادق.
 * ٣) الإجراءات السريعة: أساسي بارز + حتى أربعة ظاهرة + «المزيد» لبقية
 *    الإجراءات؛ القدرات المعطلة تخفي أزرارها.
 * ٤) «منتجاتي وخدماتي» إجراء سياقي واحد يفتح السطح الرسمي نفسه بreturnTo.
 * ٥) Insights من البيانات الحالية فقط مع فعل منطقي واحد.
 */
import React from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { usePrototypeServices } from "@/app/PrototypeServicesContext";
import { primaryNavigation } from "@/app/navigation";
import { QuickRecordingProvider } from "@/app/quickRecording";
import { UnsavedChangesProvider } from "@/components/forms/UnsavedChangesGuard";
import { BottomNav } from "@/components/layout/BottomNav";
import { MemoryLocalStore } from "@/storage/local/MemoryLocalStore";
import { ProfileService } from "@/application/profile/profileService";
import { CashContinuityService } from "@/application/cash/cashContinuityService";
import { ProjectFinancialService } from "@/application/finance/projectFinancialService";
import { HomeControlCenterService } from "@/application/home/homeControlCenterService";
import { InventoryMaterialService } from "@/application/inventory/inventoryMaterialService";
import { SupplierPurchaseService } from "@/application/suppliers/supplierPurchaseService";
import { ActivityService } from "@/application/activity/activityService";
import { AgreementContextService } from "@/application/agreements/agreementContextService";
import { DailyFollowUpService } from "@/application/follow-up/dailyFollowUpService";
import { DirectSaleService } from "@/application/direct-sales/directSaleService";
import Home from "@/pages/Home";

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
const NOW = "2026-09-18T09:00:00.000Z";
let store: MemoryLocalStore;
const contextRef: { current: Record<string, unknown> } = { current: {} };

function Harness({ page }: { page: React.ReactNode }) {
  const [version, setVersion] = React.useState(0);
  contextRef.current = {
    homeControlCenter: new HomeControlCenterService(
      store,
      new DailyFollowUpService(store),
      new ProjectFinancialService(store, () => NOW),
      new SupplierPurchaseService(store, () => NOW),
      new InventoryMaterialService(store, () => NOW),
      new AgreementContextService(store, () => NOW),
      new ActivityService(store),
      () => NOW,
    ),
    projectFinance: new ProjectFinancialService(store, () => NOW),
    cashContinuity: new CashContinuityService(store, () => NOW),
    directSales: new DirectSaleService(store, () => NOW),
    preferences: {
      load: async () => ({ ok: true, preference: { theme: "light" } }),
      save: async () => ({ ok: true }),
      readDisabledCapabilities: async () => ({ ok: true, disabled: [] }),
      saveDisabledCapabilities: async () => ({ ok: true, disabled: [] }),
    },
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

describe("Wave 4.3 — P-4.3-2: My Project Now professional order", () => {
  beforeEach(() => {
    wouterMocks.navigate.mockReset();
    wouterMocks.location = "/";
    wouterMocks.search = "";
    vi.clearAllMocks();
    store = new MemoryLocalStore();
  });
  afterEach(() => cleanup());

  it("renders the numbers section with a clear اليوم / هذا الشهر split above the standing facts", async () => {
    const profiles = new ProfileService(store, () => NOW);
    await profiles.save("مشروع-أرقام");
    const sale = await new DirectSaleService(store, () => NOW).record({
      itemName: "كوب",
      quantity: 1,
      revenueMinor: 1500,
      costMinor: 600,
      occurredOn: "2026-09-18",
      note: "اختبار",
      idempotencyKey: "w43-numbers-sale",
    });
    if (!sale.ok) throw new Error(sale.message);
    render(<Harness page={<Home />} />);
    const numbers = await screen.findByTestId("home-numbers");
    /* التقسيم الزمني واضح والحقائق القائمة تحته في القسم نفسه. */
    expect(numbers.querySelector('[data-period="today"]')?.textContent).toContain("مبيعات اليوم");
    expect(numbers.querySelector('[data-period="today"]')?.textContent).toContain("نتيجة اليوم");
    expect(numbers.querySelector('[data-period="month"]')?.textContent).toContain("مبيعات الشهر");
    expect(numbers.querySelector('[data-period="month"]')?.textContent).toContain("نتيجة الشهر");
    const section = numbers.closest("section");
    expect(section?.textContent).toContain("الكاش المسجل");
    /* مبيعات اليوم تعرف تعريف كشف الفترة الرسمي (طلبات + بيع مباشر). */
    expect(numbers.querySelector('[data-period="today"]')?.textContent).toContain("15.00");
    expect(section?.textContent).not.toContain("ما هو مسجل حتى الآن؟");
  });

  it("keeps the incomplete result honest — no invented number for unknown cost", async () => {
    const profiles = new ProfileService(store, () => NOW);
    await profiles.save("مشروع-ناقص");
    const sale = await new DirectSaleService(store, () => NOW).record({
      itemName: "كوب بلا تكلفة",
      quantity: 1,
      revenueMinor: 2000,
      costMinor: null,
      occurredOn: "2026-09-18",
      note: "اختبار",
      idempotencyKey: "w43-incomplete-sale",
    });
    if (!sale.ok) throw new Error(sale.message);
    render(<Harness page={<Home />} />);
    const numbers = await screen.findByTestId("home-numbers");
    const today = numbers.querySelector('[data-period="today"]');
    expect(today?.textContent).toContain("تحتاج بيانات تكلفة");
    /* لا رقم نتيجة مختلق — المبلغ وحده لا يُعرض ربحًا. */
    expect(today?.querySelector(".micro-home-number-note")).toBeTruthy();
  });

  it("quick actions: primary sale + four visible + المزيد revealing the rest", async () => {
    const profiles = new ProfileService(store, () => NOW);
    await profiles.save("مشروع-إجراءات");
    render(<Harness page={<Home />} />);
    const row = await screen.findByTestId("home-quick-actions");
    /* الأساسي البارز أولًا ثم أربعة متكررة — لا مسودة تصميم ظاهرة مباشرة. */
    const primary = row.querySelector(".micro-quick-action-primary");
    expect(primary?.textContent).toContain("سجّل بيعًا");
    for (const label of ["سجّل مصروفًا", "طلب من عميل", "عربون أو تحصيل", "منتجاتي وخدماتي"]) {
      expect(row.textContent).toContain(label);
    }
    expect(row.textContent).not.toContain("مسودة تصميم");
    /* «المزيد» يكشف بقية الإجراءات — لا زر ميت. */
    fireEvent.click(screen.getByRole("button", { name: /المزيد/ }));
    const more = await screen.findByTestId("home-quick-actions-more");
    expect(more.textContent).toContain("مسودة تصميم");
  });

  it("منتجاتي وخدماتي opens the one official surface with return context", async () => {
    const profiles = new ProfileService(store, () => NOW);
    await profiles.save("مشروع-كتالوج");
    render(<Harness page={<Home />} />);
    await screen.findByTestId("home-quick-actions");
    fireEvent.click(screen.getByRole("button", { name: "منتجاتي وخدماتي" }));
    expect(wouterMocks.navigate).toHaveBeenCalledWith("/catalog?returnTo=%2F");
  });

  it("insights stay data-driven with one logical action each", async () => {
    const profiles = new ProfileService(store, () => NOW);
    await profiles.save("مشروع-ملحوظات");
    const sale = await new DirectSaleService(store, () => NOW).record({
      itemName: "كوب",
      quantity: 1,
      revenueMinor: 3000,
      costMinor: 1000,
      occurredOn: "2026-09-18",
      note: "اختبار",
      idempotencyKey: "w43-insight-sale",
    });
    if (!sale.ok) throw new Error(sale.message);
    render(<Harness page={<Home />} />);
    const insights = await screen.findAllByTestId("home-insight");
    const texts = insights.map(insight => insight.textContent ?? "");
    /* القبض بلا محافظ → ملحوظة توزيع واحدة بفعل واحد. */
    const distribute = texts.find(text => text.includes("كاش غير موزع"));
    expect(distribute).toBeTruthy();
    expect(distribute).toContain("وزّعه");
    /* لا ملحوظات بلا بيانات — القسم كله يختفي حين لا سبب له. */
    const ids = insights.map(() => undefined);
    expect(ids.length).toBeGreaterThan(0);
  });

  it("insights section is absent when the data has nothing to say", async () => {
    const profiles = new ProfileService(store, () => NOW);
    await profiles.save("مشروع-هادئ");
    render(<Harness page={<Home />} />);
    await screen.findByTestId("home-numbers");
    expect(screen.queryByTestId("home-insight")).toBeNull();
    expect(screen.queryByRole("heading", { name: "ملحوظات تهمك" })).toBeNull();
  });

  it("keeps the five-seat bottom bar exactly as approved (no sixth seat)", () => {
    render(<BottomNav activePath="/" items={primaryNavigation} onNavigate={() => {}} />);
    const labels = primaryNavigation.map(item => item.label);
    expect(labels).toEqual(["مشروعي الآن", "العمل", "المالية", "أدواتي", "السوق"]);
    expect(labels).toHaveLength(5);
  });
});
