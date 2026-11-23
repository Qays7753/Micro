/** @vitest-environment jsdom */
/* UNIT-003 (تنفيذ S16 بالأمر الموحد §4 — HOME-A/AC + 3D-C1):
 * الرئيسية بترتيبها المعتمد — إجراءات سريعة خمسة بسحب يدوي و«عرض الكل»،
 * متابعتك (حتى 3 مهام من القارئ الموحد مع «عرض المتابعة» للقائمة الكاملة)،
 * لمحة مالية بفترة أداء واحدة (اليوم/هذا الشهر بتطبيق/إلغاء) والنقد الآن
 * منفصلًا، واسأل Micro ثانويًا؛ والشريط الخماسي الجديد (المالية، الطلبات،
 * الرئيسية، التوصيل، السوق) بلا مقعد سادس. تحل هذه المجموعة محل
 * HomeRedesign.w43 (تصميم Wave 4.3) كما حلّت لوحة وظائف المالية محل دليل
 * «المزيد» في S15 — البدائل جاهزة قبل الإزالة والتاريخ محفوظ في git.
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
import { DailyFollowUpService } from "@/application/follow-up/dailyFollowUpService";
import { DirectSaleService } from "@/application/direct-sales/directSaleService";
import Home from "@/pages/Home";
import Delivery from "@/pages/Delivery";
import { CollectionService } from "@/application/collections/collectionService";
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

const NOW = "2026-09-18T09:00:00.000Z";
let store: MemoryLocalStore;
const contextRef: { current: Record<string, unknown> } = { current: {} };

function Harness({ page }: { page: React.ReactNode }) {
  const [version, setVersion] = React.useState(0);
  contextRef.current = {
    homeControlCenter: buildHomeService(store, () => NOW),
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

/* طلب مسلَّم عليه دين — بند تحصيل مستحق يقود مختصر المتابعة. */
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
    source: "order_confirmation",
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
  } as never;
  await store.saveOrder({
    id,
    order,
    catalogItemId: null,
    deliveryDate: "2026-09-20",
    agreementSource: "test",
    followUpSummary: null,
    followUpDate: null,
    followUpReason: null,
    followUpEvents: [],
    createdAt: "2026-09-10T09:00:00.000Z",
    updatedAt: "2026-09-10T09:00:00.000Z",
  } as never);
}

async function seedProfile() {
  const profiles = new ProfileService(store, () => NOW);
  const saved = await profiles.create("مشروع-الرئيسية");
  if (!saved.ok) throw new Error(saved.message);
}

beforeEach(() => {
  store = new MemoryLocalStore();
  wouterMocks.navigate.mockClear();
  wouterMocks.location = "/";
  wouterMocks.search = "";
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("UNIT-003/S16 — الرئيسية (HOME-A2) والشريط الخماسي (NAV-01 §1)", () => {
  it("HOME-AC01/HOME-A2-1: الترويسة — الاسم والتاريخ ومدخل الإعدادات وزر !", async () => {
    await seedProfile();
    render(<Harness page={<Home />} />);
    expect(await screen.findByRole("heading", { level: 1, name: "مشروع-الرئيسية" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "الإعدادات" })).toBeTruthy();
    expect(screen.getByRole("button", { name: /معلومات الرئيسية/ })).toBeTruthy();
    /* لا فرض استكمال 002 ولا أرقام تجريبية (HOME-B3). */
    expect(screen.queryByText(/إجباري/)).toBeNull();
  });

  it("ACCESS-01/H: الإجراءات الخمسة إلى أصحابها و«عرض الكل» لوحة بديلة كاملة", async () => {
    await seedProfile();
    render(<Harness page={<Home />} />);
    const row = await screen.findByTestId("home-quick-actions");
    for (const label of ["بيع", "مصروف", "طلب جديد", "شراء", "أدوات المشروع"]) {
      expect(row.textContent).toContain(label);
    }
    /* «عرض الكل» ثابت خارجه ويعرض الخمسة كاملة ثم يغلق. */
    fireEvent.click(screen.getByRole("button", { name: "عرض الكل" }));
    const panel = await screen.findByTestId("home-all-actions");
    for (const label of ["بيع", "مصروف", "طلب جديد", "شراء", "أدوات المشروع"]) {
      expect(panel.textContent).toContain(label);
    }
    fireEvent.click(screen.getByRole("button", { name: "إغلاق" }));
    await waitFor(() => expect(screen.queryByTestId("home-all-actions")).toBeNull());
    /* مدخل واحد يعمل من الصف ومن اللوحة: الأدوات تفتح وجهتها بReturnTo. */
    fireEvent.click(screen.getByTestId("home-action-tools"));
    expect(wouterMocks.navigate).toHaveBeenCalledWith(withReturnTo("/tools", "/"));
  });

  it("HOME-A2-3/HOME-AC05: متابعتك حتى 3 مهام بفعله الصحيح و«عرض المتابعة» للقائمة الكاملة", async () => {
    await seedProfile();
    await seedDebtOrder("order-debt");
    render(<Harness page={<Home />} />);
    const rows = await screen.findByTestId("home-followup-rows");
    expect(rows.textContent).toContain("خاتم أمينة");
    /* بند الدين يحمل مبلغه بتسمية دوره لا رقمًا عاريًا (HOME-A3). */
    expect(rows.textContent).toContain("المتبقي على العميل");
    /* عرض المتابعة يفتح القائمة الكاملة غير المقيدة. */
    fireEvent.click(screen.getByRole("button", { name: "عرض المتابعة" }));
    expect(wouterMocks.navigate).toHaveBeenCalledWith(withReturnTo("/finance/upcoming", "/"));
  });

  it("HOME-A2-4/HOME-AC10/13: لمحة مالية بفترة واحدة — التبديل بتطبيق وإلغاء والنقد الآن منفصل", async () => {
    await seedProfile();
    /* نقد مسجل حتى يكون رقم النقد الآن معروفًا قابلاً للفتح (022). */
    const finance = new ProjectFinancialService(store, () => NOW);
    const invested = await finance.record({
      type: "owner_investment_cash",
      amountMinor: 5000,
      occurredOn: "2026-09-05",
      note: "استثمار",
      counterparty: null,
      relatedEventId: null,
      idempotencyKey: "s16-glimpse-invest",
    });
    if (!invested.ok) throw new Error(invested.message);
    render(<Harness page={<Home />} />);
    await screen.findByRole("heading", { level: 1, name: "مشروع-الرئيسية" });
    /* أول دخول «هذا الشهر» (HOME-B1) والمبيعات المسجلة/النتيجة يفتحان 016
     * بالنطاق نفسه (3D-C1) بلا ملخص 013 وسيط. */
    /* التاريخ من ساعة الاختبار نفسها (NOW) — لا من ساعة الجهاز الحية. */
    const sales = screen.getByRole("button", { name: "افتح المبيعات المسجلة بالنطاق نفسه" });
    fireEvent.click(sales);
    expect(wouterMocks.navigate).toHaveBeenCalledWith(
      withReturnTo("/finance/statement?since=2026-09-01&until=2026-09-18", "/"),
    );
    wouterMocks.navigate.mockClear();
    /* النقد المسجل الآن يفتح 022 — لا يتغير بتغيير الفترة (HOME-AC13). */
    fireEvent.click(screen.getByRole("button", { name: "افتح النقد المسجل الآن" }));
    expect(wouterMocks.navigate).toHaveBeenCalledWith(withReturnTo("/cash", "/"));
    /* لوحة الفترة: اليوم بتطبيق وإلغاء — لا شرائح دائمة. */
    fireEvent.click(screen.getByRole("button", { name: /الفترة: هذا الشهر/ }));
    expect(screen.getByTestId("home-period-picker")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "اليوم" }));
    fireEvent.click(screen.getByRole("button", { name: "تطبيق" }));
    await waitFor(() => expect(screen.getByRole("button", { name: /الفترة: اليوم/ })).toBeTruthy());
    wouterMocks.navigate.mockClear();
    const todaySales = screen.getByRole("button", { name: "افتح المبيعات المسجلة بالنطاق نفسه" });
    fireEvent.click(todaySales);
    expect(wouterMocks.navigate).toHaveBeenCalledWith(
      withReturnTo("/finance/statement?since=2026-09-18&until=2026-09-18", "/"),
    );
    /* «عرض المالية» يفتح 013 العام. */
    wouterMocks.navigate.mockClear();
    fireEvent.click(screen.getByRole("button", { name: "عرض المالية" }));
    expect(wouterMocks.navigate).toHaveBeenCalledWith(withReturnTo("/finance", "/"));
  });

  it("HOME-R06/R07: كتل الغياب والسجل والخيارات غادرت الرئيسية — لا أثناء غيابك ولا آخر ما حدث", async () => {
    await seedProfile();
    render(<Harness page={<Home />} />);
    await screen.findByRole("heading", { level: 1, name: "مشروع-الرئيسية" });
    for (const gone of [
      "أثناء غيابك",
      "آخر ما حدث",
      "سجّل بسرعة",
      "منتجاتي وخدماتي",
      "الأهم الآن",
      "أرقامك",
    ]) {
      expect(screen.queryByText(new RegExp(gone))).toBeNull();
    }
  });

  it("HOME-B4/AC16: زر ! يفتح المعلومات القصيرة مع حالة النسخة المتحققة ومدخل النسخ", async () => {
    await seedProfile();
    render(<Harness page={<Home />} />);
    await screen.findByRole("heading", { level: 1, name: "مشروع-الرئيسية" });
    fireEvent.click(screen.getByRole("button", { name: /معلومات الرئيسية/ }));
    const info = await screen.findByTestId("home-info-panel");
    expect(info.textContent).toContain("القبض ليس ربحًا");
    expect(info.textContent).toContain("محفوظة محليًا");
    expect(info.textContent).toContain("لا توجد نسخة احتياطية متحققة بعد");
    fireEvent.click(screen.getByRole("button", { name: /النسخ الاحتياطي من الإعدادات/ }));
    expect(wouterMocks.navigate).toHaveBeenCalledWith(withReturnTo("/settings", "/"));
    fireEvent.click(screen.getByRole("button", { name: "إغلاق" }));
    await waitFor(() => expect(screen.queryByTestId("home-info-panel")).toBeNull());
  });

  it("HOME-A2-5/AC19 + DEC-SHELL-01 (UXR-03): لا أثر دائم لاسأل Micro في الرئيسية — عنصر واحد عند الطلب في قائمة مايكرو", async () => {
    await seedProfile();
    render(<Harness page={<Home />} />);
    await screen.findByRole("heading", { level: 1, name: "مشروع-الرئيسية" });
    /* UXR-03 (أمر W02): الشريط الثانوي والبطاقة داخل الرئيسية أُزيلوا معًا —
     * لا مدخل دائمًا في الرئيسية؛ الإعلان القائم بموضعه الوحيد عند الطلب
     * داخل قائمة «مايكرو» في الترويسة (AppSurface يثبت بند القائمة نفسه)؛
     * EX-D21 (Phase B): المدخل صار حقيقيًا إلى /ask — بلا «قريبًا».
     * ولا محادثة ولا إرسال بيانات كما كان. */
    expect(screen.queryByRole("button", { name: "اسأل Micro" })).toBeNull();
    expect(wouterMocks.navigate).not.toHaveBeenCalled();
  });

  it("UNIT-043/SDF-060 + EX-D18: التوصيل مقعد صاحب المشروع الحقيقي — بلا أثر مالي", async () => {
    await seedProfile();
    render(<Harness page={<Delivery />} />);
    const page = await screen.findByTestId("delivery-owner-page");
    /* EX-D18 (بوابة الكود 2026-11-12): تجربة صاحب المشروع الحقيقية — عرض
     * لحجوزات الخادم فقط، ولا زر حجز وهمي ولا تسعير ولا تتبع ولا أي أثر
     * مالي من التبويب نفسه (OD01/OD12). */
    expect(page.textContent).toContain("التوصيل");
    await waitFor(() => {
      expect(screen.getAllByText(/تسجيل الدخول|جارٍ التحميل|لا حجوزات|تعذر/).length).toBeGreaterThan(0);
    });
    expect(screen.queryByTestId("delivery-soon-card")).toBeNull();
    expect(screen.queryByRole("button", { name: /اطلب توصيلة الآن|تتبع/ })).toBeNull();
    const orders = await store.listOrders();
    const events = await store.listFinancialEvents();
    expect(orders.ok && orders.value).toHaveLength(0);
    expect(events.ok && events.value).toHaveLength(0);
  });

  it("NAV-01 §1: الشريط الخماسي الجديد بلا مقعد سادس — المالية، الطلبات، الرئيسية، التوصيل، السوق", () => {
    render(<BottomNav activePath="/" items={primaryNavigation} onNavigate={() => {}} />);
    const labels = primaryNavigation.map(item => item.label);
    expect(labels).toEqual(["المالية", "الطلبات", "الرئيسية", "التوصيل", "السوق"]);
    expect(labels).toHaveLength(5);
    /* الأدوات والإعدادات ليستا مقعدًا (بيت الأدوات مدخل الرئيسية). */
    expect(labels).not.toContain("أدواتي");
    expect(labels).not.toContain("الإعدادات");
  });
});
