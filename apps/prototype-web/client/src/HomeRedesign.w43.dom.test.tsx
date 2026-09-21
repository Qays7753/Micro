/** @vitest-environment jsdom */
/* Wave 4.3 — P-4.3-2 + Z1 (العرض المعتمد §3.1): إعادة بناء «مشروعي الآن» —
 * ---------------------------------------------------------------------------
 * ١) منطقة حالة اليوم أولًا (انتباه/فراغ/بيانات ناقصة/هادئ) ثم «اليوم»،
 *    ثم الإجراءات الثابتة — كلها قبل الأرقام والنشاط.
 * ٢) أولوية واحدة على الأكثر مع CTA أساسي واحد؛ البيع أساسي فقط بلا أولوية.
 * ٣) الإجراءات الثابتة ثلاثة بالضبط: بيع/مصروف/طلب — التحصيل سياقي فقط.
 * ٤) «منتجاتي وخدماتي» و«المزيد» عنقود ثانوي أخف خارج الإجراءات الثابتة.
 * ٥) Insights من البيانات الحالية فقط مع فعل منطقي واحد (تغيّر المبيعات).
 * ٦) المقاعد الخمسة كما اُعتمدت — لا مقعد سادس.
 */
import React from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { usePrototypeServices } from "@/app/PrototypeServicesContext";
import { primaryNavigation } from "@/app/navigation";
import { withReturnTo } from "@/app/navigationContract";
import { QuickRecordingProvider } from "@/app/quickRecording";
import { UnsavedChangesProvider } from "@/components/forms/UnsavedChangesGuard";
import { BottomNav } from "@/components/layout/BottomNav";
import { MemoryLocalStore } from "@/storage/local/MemoryLocalStore";
import { calculateCostSnapshot, createCraftOrder } from "@micro-domain/craft-order/index.js";
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

/* طلب مسلَّم عليه دين — بند تحصيل مستحق (أولوية ١٥) يقود يوم انتباه. */
async function seedDebtOrder(id: string) {
  const cost = calculateCostSnapshot(`cost-${id}`, {
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
  });
  const baseOrder = createCraftOrder({
    id,
    customerName: "ريم",
    itemName: "خاتم أمينة",
    specifications: "اختبار",
    quantity: 1,
    agreedPriceMinor: 5000,
    costSnapshot: cost,
    createdAt: "2026-09-10T09:00:00.000Z",
  });
  const order = {
    ...baseOrder,
    status: "settled" as const,
    settlementStatus: "debt" as const,
    receivableMinor: 3500,
    nextAction: "تابع تحصيل الدين",
  };
  await store.saveOrder({
    id,
    order,
    catalogItemId: null,
    deliveryDate: "2026-09-16",
    agreementSource: "test",
    createdAt: order.createdAt,
    updatedAt: order.createdAt,
  });
}

const precedes = (first: Element, second: Element) =>
  (first.compareDocumentPosition(second) & Node.DOCUMENT_POSITION_FOLLOWING) !== 0;

describe("Wave 4.3 — P-4.3-2 + Z1: My Project Now daily decision surface", () => {
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

  it("fixed actions are exactly sale, expense, and order — collection is contextual, not a fourth fixed action", async () => {
    const profiles = new ProfileService(store, () => NOW);
    await profiles.save("مشروع-إجراءات");
    render(<Harness page={<Home />} />);
    const row = await screen.findByTestId("home-quick-actions");
    const buttons = row.querySelectorAll("button");
    expect(buttons).toHaveLength(3);
    expect(buttons[0]?.textContent).toContain("سجّل بيعًا");
    expect(buttons[1]?.textContent).toContain("سجّل مصروفًا");
    expect(buttons[2]?.textContent).toContain("طلب من عميل");
    /* Z1 §3.1: التحصيل ليس إجراءً ثابتًا — يظهر سياقيًا على بند دين فقط. */
    expect(row.textContent).not.toContain("عربون أو تحصيل");
    /* لا مصاريف متكررة على الرئيسية إطلاقًا (§3.9). */
    expect(document.querySelector(".micro-home-control-center")?.textContent ?? "").not.toMatch(/متكرر/);
  });

  it("منتجاتي وخدماتي and المزيد live in the lighter secondary cluster, outside the fixed actions", async () => {
    const profiles = new ProfileService(store, () => NOW);
    await profiles.save("مشروع-كتالوج");
    render(<Harness page={<Home />} />);
    const fixed = await screen.findByTestId("home-quick-actions");
    const secondary = await screen.findByTestId("home-secondary-actions");
    /* العنقود الثانوي خارج حاوية الإجراءات الثابتة — لا ينافسها بصريًا. */
    expect(fixed.contains(secondary)).toBe(false);
    expect(fixed.textContent).not.toContain("منتجاتي وخدماتي");
    expect(fixed.textContent).not.toContain("المزيد");
    expect(fixed.textContent).not.toContain("مسودة تصميم");
    expect(secondary.textContent).toContain("منتجاتي وخدماتي");
    expect(secondary.querySelector('[data-testid="home-catalog-entry"]')).toBeTruthy();
    /* «المزيد» يكشف بقية الإجراءات — لا زر ميت. */
    fireEvent.click(screen.getByRole("button", { name: /المزيد/ }));
    const more = await screen.findByTestId("home-quick-actions-more");
    expect(more.textContent).toContain("مسودة تصميم");
    expect(secondary.contains(more)).toBe(true);
  });

  it("منتجاتي وخدماتي opens the one official surface with return context", async () => {
    const profiles = new ProfileService(store, () => NOW);
    await profiles.save("مشروع-كتالوج");
    render(<Harness page={<Home />} />);
    await screen.findByTestId("home-secondary-actions");
    fireEvent.click(screen.getByRole("button", { name: "منتجاتي وخدماتي" }));
    expect(wouterMocks.navigate).toHaveBeenCalledWith("/catalog?returnTo=%2F");
  });

  it("a quiet day (no priority) keeps the sale button as the one primary fixed action", async () => {
    const profiles = new ProfileService(store, () => NOW);
    await profiles.save("مشروع-هادئ");
    render(<Harness page={<Home />} />);
    const fixed = await screen.findByTestId("home-quick-actions");
    const primaries = fixed.querySelectorAll(".micro-quick-action-primary");
    expect(primaries).toHaveLength(1);
    expect(primaries[0]?.textContent).toContain("سجّل بيعًا");
  });

  it("an attention day shows one priority with exactly one primary CTA — and demotes the sale button", async () => {
    const profiles = new ProfileService(store, () => NOW);
    await profiles.save("مشروع-انتباه");
    await seedDebtOrder("w43-debt-order");
    render(<Harness page={<Home />} />);
    const dailyStatus = await screen.findByTestId("home-daily-status");
    expect(dailyStatus.getAttribute("role")).toBe("status");
    /* أولوية واحدة معلنة برأسها — بند الدين يقود اليوم. */
    expect(dailyStatus.textContent).toContain("الأهم الآن");
    expect(dailyStatus.textContent).toContain("دين");
    /* CTA أساسي واحد (زر بدائي) بلا فعل نصي مكرر بجواره داخل المنطقة. */
    const dailyButtons = dailyStatus.querySelectorAll("button");
    expect(dailyButtons).toHaveLength(1);
    const cta = dailyButtons[0];
    expect(cta?.className).toContain("micro-prim-button");
    expect(cta?.textContent).toContain("حصّل");
    /* البيع لا يلبس الأساسية حين توجد أولوية — CTA الأولوية هو الأساس. */
    const fixed = screen.getByTestId("home-quick-actions");
    expect(fixed.querySelectorAll(".micro-quick-action-primary")).toHaveLength(0);
    expect(fixed.textContent).toContain("سجّل بيعًا");
    /* التحصيل السياقي يحفظ مصدر رجوعه إلى الرئيسية. */
    fireEvent.click(cta as HTMLButtonElement);
    expect(wouterMocks.navigate).toHaveBeenCalledWith(
      withReturnTo("/collect?source=order:w43-debt-order", "/"),
    );
  });

  it("state, today, and fixed actions precede the numbers; finance and activity follow them", async () => {
    const profiles = new ProfileService(store, () => NOW);
    await profiles.save("مشروع-ترتيب");
    await seedDebtOrder("w43-order-order");
    render(<Harness page={<Home />} />);
    const dailyStatus = await screen.findByTestId("home-daily-status");
    const numbers = await screen.findByTestId("home-numbers");
    const todaySection = document.querySelector('section[aria-labelledby="home-today-title"]');
    const fixedActions = await screen.findByTestId("home-quick-actions");
    /* §3.1 ترتيب الهدف: الحالة والأولوية واليوم والإجراءات قبل الأرقام. */
    expect(todaySection).not.toBeNull();
    expect(precedes(dailyStatus, numbers)).toBe(true);
    expect(precedes(todaySection as Element, numbers)).toBe(true);
    expect(precedes(fixedActions, numbers)).toBe(true);
    expect(precedes(dailyStatus, todaySection as Element)).toBe(true);
    /* المالية والنشاط بعد الأرقام — العمق خلف القرار. */
    const financeSection = document.querySelector('section[aria-labelledby="home-finance-title"]');
    const recentSection = document.querySelector('section[aria-labelledby="home-recent-title"]');
    expect(financeSection).not.toBeNull();
    expect(recentSection).not.toBeNull();
    expect(precedes(numbers, financeSection as Element)).toBe(true);
    expect(precedes(numbers, recentSection as Element)).toBe(true);
  });

  it("insights keep only the month-over-month sales comparison with one logical action", async () => {
    const profiles = new ProfileService(store, () => NOW);
    await profiles.save("مشروع-ملحوظات");
    const previousMonth = await new DirectSaleService(store, () => NOW).record({
      itemName: "كوب أغسطس",
      quantity: 1,
      revenueMinor: 3000,
      costMinor: 1000,
      occurredOn: "2026-08-18",
      note: "اختبار",
      idempotencyKey: "w43-insight-previous-sale",
    });
    if (!previousMonth.ok) throw new Error(previousMonth.message);
    const sale = await new DirectSaleService(store, () => NOW).record({
      itemName: "كوب",
      quantity: 1,
      revenueMinor: 1500,
      costMinor: 500,
      occurredOn: "2026-09-18",
      note: "اختبار",
      idempotencyKey: "w43-insight-sale",
    });
    if (!sale.ok) throw new Error(sale.message);
    render(<Harness page={<Home />} />);
    const insights = await screen.findAllByTestId("home-insight");
    const texts = insights.map(insight => insight.textContent ?? "");
    /* مقارنة الشهر بالشهر هي الملحوظة الوحيدة الباقية (Z1 §3.1 — لا تكرار). */
    expect(texts.some(text => text.includes("مبيعات هذا الشهر"))).toBe(true);
    const salesChange = texts.find(text => text.includes("مبيعات هذا الشهر"));
    expect(salesChange).toContain("أقل");
    /* الملحوظات الثلاث المكررة للأرقام المجاورة أُزيلت من الاشتقاق. */
    expect(texts.some(text => text.includes("كاش غير موزع في الدرج"))).toBe(false);
    expect(texts.some(text => text.includes("مبالغ غير محصلة عند العملاء"))).toBe(false);
    expect(texts.some(text => text.includes("بيانات تكلفة ناقصة تمنع نتيجة"))).toBe(false);
    expect(insights.length).toBeGreaterThan(0);
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
