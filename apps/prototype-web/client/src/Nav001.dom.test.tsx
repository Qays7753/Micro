/** @vitest-environment jsdom */
/* NAV-001/SET-002 — التنقل المعتمد: خمسة مقاعد بلا زر «سجّل» مركزي، أزرار
 * التسجيل السريع داخل «مشروعي الآن» تفتح ورقة البيع/المصروف، السوق مقعد
 * «قريبًا» صادق بلا أي سجل أو أثر، ولافتة نجاح الإعداد الأول. */
import React from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { usePrototypeServices } from "@/app/PrototypeServicesContext";
import { primaryNavigation } from "@/app/navigation";
import { QuickRecordingProvider } from "@/app/quickRecording";
import { UnsavedChangesProvider } from "@/components/forms/UnsavedChangesGuard";
import { BottomNav } from "@/components/layout/BottomNav";
import { AppHeader } from "@/components/layout/AppHeader";
import { ThemeProvider } from "@/contexts/ThemeContext";
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
import Home from "@/pages/Home";
import Market from "@/pages/Market";

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
const NOW = "2026-09-16T09:00:00.000Z";
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

describe("NAV-001 — approved five-seat navigation", () => {
  beforeEach(() => {
    wouterMocks.navigate.mockReset();
    wouterMocks.location = "/";
    wouterMocks.search = "";
    vi.clearAllMocks();
    store = new MemoryLocalStore();
  });
  afterEach(() => cleanup());

  it("the bottom bar holds exactly the five approved seats with no central record button", () => {
    render(<BottomNav activePath="/" items={primaryNavigation} onNavigate={() => {}} />);
    const labels = primaryNavigation.map(item => item.label);
    expect(labels).toEqual(["مشروعي الآن", "العمل", "المالية", "أدواتي", "السوق"]);
    const buttons = screen.getAllByRole("button");
    for (const label of labels) {
      expect(buttons.some(button => button.textContent?.includes(label))).toBe(true);
    }
    /* زر «سجّل» المركزي أُزيل — لا وجود له في الشريط. */
    expect(buttons.some(button => button.getAttribute("aria-label") === "سجّل")).toBe(false);
    expect(document.querySelector(".micro-fab")).toBeNull();
  });

  it("home hosts the quick-recording row and the sale sheet opens in place over it", async () => {
    const profiles = new ProfileService(store);
    const saved = await profiles.save("مشروع-NAV");
    if (!saved.ok) throw new Error(saved.message);
    render(<Harness page={<Home />} />);
    const row = await screen.findByTestId("home-quick-actions");
    for (const label of ["سجّل بيعًا", "سجّل مصروفًا", "طلب من عميل", "عربون أو تحصيل"]) {
      expect(row.textContent).toContain(label);
    }
    /* البيع يفتح الورقة في نموذجها مباشرة فوق الرئيسية المركّبة. */
    fireEvent.click(screen.getByText("سجّل بيعًا"));
    await waitFor(() => expect(screen.getByText("سجّل بيعًا الآن")).toBeTruthy());
    expect(screen.getByLabelText("مبلغ البيع")).toBeTruthy();
  });

  it("the expense quick action opens the expense form with the approved wallet rules", async () => {
    const profiles = new ProfileService(store);
    await profiles.save("مشروع-NAV2");
    render(<Harness page={<Home />} />);
    await screen.findByTestId("home-quick-actions");
    fireEvent.click(screen.getByText("سجّل مصروفًا"));
    await waitFor(() => expect(screen.getByText("سجّل مصروفًا الآن")).toBeTruthy());
    expect(screen.getByLabelText("مبلغ المصروف")).toBeTruthy();
    /* FIN-005: بلا محافظ — الصرف من غير الموزع بتحذير معلن. */
    expect(screen.getByText(/من الكاش غير الموزع/)).toBeTruthy();
  });

  it("SET-002: the setup success banner appears once after first setup and disappears without the flag", async () => {
    const profiles = new ProfileService(store);
    await profiles.save("مشروع-NAV3");
    wouterMocks.search = "?setup=1";
    render(<Harness page={<Home />} />);
    const banner = await screen.findByTestId("setup-success-banner");
    expect(banner.textContent).toContain("تم إنشاء مشروعك");
    expect(banner.textContent).toContain("مشروع-NAV3");
    /* EXE-006 (AUD-NEW-11): اللافتة تدل على الموقع الحقيقي لصفحة الأساس —
     * زر «صفحة الأساس» في قسم «مالي» بهذه الصفحة، لا مقعد «المالية». */
    expect(banner.textContent).toContain("قسم «مالي»");
    expect(banner.textContent).not.toContain("من «المالية»");
    cleanup();
    wouterMocks.search = "";
    render(<Harness page={<Home />} />);
    await waitFor(() => expect(screen.getByText("مشروع-NAV3")).toBeTruthy());
    expect(screen.queryByTestId("setup-success-banner")).toBeNull();
  });

  it("السوق renders an honest قريبًa badge with no records or financial effects", async () => {
    wouterMocks.location = "/market";
    render(<Harness page={<Market />} />);
    const page = await screen.findByTestId("market-soon-page");
    expect(page.textContent).toContain("قريبًا");
    expect(page.textContent).toContain("سوق الموردين");
    /* لا موردين وهميين ولا زر شراء — والصفحة لا تكتب شيئًا. */
    expect(screen.queryByRole("button", { name: /شراء/ })).toBeNull();
    const orders = await store.listOrders();
    const events = await store.listFinancialEvents();
    const purchases = await store.listSupplierPurchases();
    expect(orders.ok && orders.value).toHaveLength(0);
    expect(events.ok && events.value).toHaveLength(0);
    expect(purchases.ok && purchases.value).toHaveLength(0);
  });

  /* EXE-005 (AUD-NEW-13): زر «رجوع لمشروعي» وزر الرجوع في السوق يتنقلان إلى
   * returnPath المعلن بالآلية المعتمدة — لا window.history.back() الذي يهبط
   * على صفحة عشوائية سابقة عند البدء البارد بوصلة عميقة. */
  it("EXE-005: market back buttons navigate to the declared return path, not history.back()", async () => {
    wouterMocks.navigate.mockClear();
    /* بدء بارد بلا ?from: الوجهة القانونية هي الرئيسية. */
    wouterMocks.location = "/market";
    wouterMocks.search = "";
    render(<Harness page={<Market />} />);
    expect(await screen.findByTestId("market-soon-page")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "رجوع لمشروعي" }));
    expect(wouterMocks.navigate).toHaveBeenCalledWith("/");
    /* زر الرجوع العلوي يعد بالوجهة نفسها وينفذها. */
    wouterMocks.navigate.mockClear();
    fireEvent.click(screen.getByRole("button", { name: "مشروعي الآن" }));
    expect(wouterMocks.navigate).toHaveBeenCalledWith("/");
    cleanup();
    /* دخول بسياق عودة معتمد: ?from=/tools يعيد إلى الأدوات. */
    wouterMocks.search = "?from=/tools";
    render(<Harness page={<Market />} />);
    expect(await screen.findByTestId("market-soon-page")).toBeTruthy();
    wouterMocks.navigate.mockClear();
    fireEvent.click(screen.getByRole("button", { name: "رجوع" }));
    expect(wouterMocks.navigate).toHaveBeenCalledWith("/tools");
  });

  it("the top bar carries transport and assistant قريبًا entries with honest copy", () => {
    render(
      <Harness
        page={
          <ThemeProvider>
            <AppHeader contextLabel={null} onOpenSettings={() => {}} />
          </ThemeProvider>
        }
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "النقل والتوصيل — قريبًا" }));
    const transport = screen.getByTestId("soon-panel");
    expect(transport.textContent).toContain("النقل والتوصيل — قريبًا");
    expect(transport.textContent).toContain("لا حجز نقل ولا تسعير ولا تتبع");
    fireEvent.click(screen.getByRole("button", { name: "إغلاق" }));
    fireEvent.click(screen.getByRole("button", { name: "اسأل Micro — قريبًا" }));
    const assistant = screen.getByTestId("soon-panel");
    expect(assistant.textContent).toContain("قارئًا فقط");
    expect(assistant.textContent).toContain("لا تُرسل بيانات مشروعك إلى أي خدمة خارجية");
  });
});
