/** @vitest-environment jsdom */

/* المجموعة ١١ (المرحلة 11-E — تغطية الرحلات عالية القيمة): رحلة صفحة الأساس —
 * حالات الإقلاع (التحميل ← الجهوزية) والفراغ والخطأ الصادق عبر الحدود الحقيقية
 * (تفاعل ← خدمة ← مخزن الذاكرة)، والرصيد النقدي الافتتاحي بدقته الكاملة،
 * وعقد التنقل الموحّد (?from). عقد الجهوزية المستقر هو العنوان الرئيسي باسم
 * النشاط — عنصر دائم في الحالة الجاهزة؛ بطاقة «أثناء غيابك» مشروطة بغياب
 * ٧ أيام فلا تصلح عقد جهوزية، وحالة التحميل تُثبَّت ببوابة قراءة يحكمها الاختبار
 * (لا سباق ولا نوم)، وزر «إعادة المحاولة» في سطح الخطأ لا يُنقر أبدًا. */
import React from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { usePrototypeServices } from "@/app/PrototypeServicesContext";
import { withReturnTo } from "@/app/navigationContract";
import { UnsavedChangesProvider } from "@/components/forms/UnsavedChangesGuard";
/* NAV-001: الرئيسية تستدعي سياق التسجيل السريع — المزوّد فوقها في الاختبار كما في القشرة. */
import { QuickRecordingProvider } from "@/app/quickRecording";
import { MemoryLocalStore } from "@/storage/local/MemoryLocalStore";
import { ProjectFinancialService } from "@/application/finance/projectFinancialService";
import { CashContinuityService } from "@/application/cash/cashContinuityService";
import { InventoryMaterialService } from "@/application/inventory/inventoryMaterialService";
import { SupplierPurchaseService } from "@/application/suppliers/supplierPurchaseService";
import { ActivityService } from "@/application/activity/activityService";
import { AgreementContextService } from "@/application/agreements/agreementContextService";
import { DailyFollowUpService } from "@/application/follow-up/dailyFollowUpService";
import { HomeControlCenterService } from "@/application/home/homeControlCenterService";
import { ProfileService } from "@/application/profile/profileService";
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
  params: {} as Record<string, string>,
}));
vi.mock("wouter", () => ({
  useLocation: () => [wouterMocks.location, wouterMocks.navigate],
  useParams: () => wouterMocks.params,
  useSearch: () => "",
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

const NOW = "2026-09-12T09:00:00.000Z";

let store: MemoryLocalStore;
let dataVersion = 0;

function buildHomeControlCenter() {
  return buildHomeService(store, () => NOW);
}

beforeEach(() => {
  store = new MemoryLocalStore();
  dataVersion = 0;
  mockedUsePrototypeServices.mockReturnValue({
    homeControlCenter: buildHomeControlCenter(),
    projectFinance: new ProjectFinancialService(store, () => NOW),
    dataVersion,
    notifyDataChanged: () => {
      dataVersion += 1;
    },
  } as unknown as ReturnType<typeof usePrototypeServices>);
});

afterEach(() => {
  cleanup();
});

async function seedProfile() {
  const result = await new ProfileService(store, () => NOW).create("مشغل الاختبار");
  if (!result.ok) throw new Error(result.message);
}

function renderHome() {
  return render(
    <QuickRecordingProvider>
      <UnsavedChangesProvider navigate={wouterMocks.navigate}>
        <Home />
      </UnsavedChangesProvider>
    </QuickRecordingProvider>,
  );
}

/* عقد الجهوزية المستقر: العنوان الرئيسي باسم النشاط من الملف (§7.1). */
const readyHeading = { level: 1 as const, name: "مشغل الاختبار" };

describe("Home journeys (Group 11-E)", () => {
  it("settles into the ready home surface with an honest quiet day and no error", async () => {
    await seedProfile();
    renderHome();
    expect(await screen.findByRole("heading", readyHeading)).toBeTruthy();
    expect(screen.queryByText("تعذر تحميل مشروعك")).not.toBeTruthy();
    /* HOME-A2-3 (S16): متابعتك بلا مهام ضمن قراءة مكتملة — الحالة الصادقة
     * لا «يومك مفتوح» ولا «كل شيء ممتاز» (HOME-R03: مختصر واحد بدل الحالتين
     * المتداخلتين؛ بلا بيانات لا تُخترع أرقام). */
    expect(screen.getByText("لا توجد متابعات مسجلة الآن")).toBeTruthy();
  });

  it("offers the fixed recording actions on the empty day — the day is open, not blocked", async () => {
    await seedProfile();
    renderHome();
    expect(await screen.findByRole("heading", readyHeading)).toBeTruthy();
    /* ACCESS-01/H (S16): الخمسة إلى أصحابها — بيع/مصروف/طلب جديد/شراء/أدوات
     * المشروع؛ الصف يدوي و«عرض الكل» ثابت خارجه. */
    const fixedActions = screen.getByTestId("home-quick-actions");
    for (const label of ["بيع", "مصروف", "طلب جديد", "شراء", "أدوات المشروع"]) {
      expect(fixedActions.textContent).toContain(label);
    }
    expect(screen.getByRole("button", { name: "عرض الكل" })).toBeTruthy();
  });

  it("keeps the opening cash wallet balance exact through the home read model", async () => {
    const cash = new CashContinuityService(store, () => NOW);
    const opened = await cash.openWallet({
      name: "درج",
      kind: "cash_drawer",
      openingMinor: 152040,
      occurredOn: "2026-09-01",
      note: "رصيد بداية",
      operationKey: "g11-home-open",
    });
    expect(opened.ok).toBe(true);
    await seedProfile();

    renderHome();
    /* صفحة الأساس تقرأ من نفس المخزن — القيمة 1520.40 د.أ تبقى دقيقة (152,040 قروشًا). */
    expect(await screen.findByRole("heading", readyHeading)).toBeTruthy();
    const cash2 = new CashContinuityService(store, () => NOW);
    const overview = await cash2.overview();
    expect(overview.ok && overview.value.wallets[0]?.balanceMinor).toBe(152040);
  });

  it("navigates from home with the source preserved (from contract)", async () => {
    await seedProfile();
    renderHome();
    expect(await screen.findByRole("heading", readyHeading)).toBeTruthy();
    /* HOME-A2-4 (S16): رابط «عرض المالية» يفتح 013 — الرحلة تحترم عقد
     * التنقل ٢٦: المصدر الرئيسية يُحفظ في ?from. */
    fireEvent.click(screen.getByRole("button", { name: "عرض المالية" }));
    expect(wouterMocks.navigate).toHaveBeenCalledWith(withReturnTo("/finance", "/"));
  });

  it("shows the first-boot loading state until the read resolves, then the ready surface", async () => {
    await seedProfile();
    /* بوابة يحكمها الاختبار: القراءة معلقة حتى الإفراج — لا سباق ولا نوم. */
    let releaseRead: () => void = () => {};
    const gate = new Promise<void>(resolve => {
      releaseRead = resolve;
    });
    const realControlCenter = buildHomeControlCenter();
    const gatedControlCenter = {
      read: () => gate.then(() => realControlCenter.read()),
    } as unknown as HomeControlCenterService;
    mockedUsePrototypeServices.mockReturnValue({
      homeControlCenter: gatedControlCenter,
      projectFinance: new ProjectFinancialService(store, () => NOW),
      dataVersion,
      notifyDataChanged: () => {
        dataVersion += 1;
      },
    } as unknown as ReturnType<typeof usePrototypeServices>);

    renderHome();
    /* S5-08: الإقلاع الأول يظهر حالة التحميل الكاملة — دور الحالة قبل القراءة. */
    expect(screen.getByRole("status").textContent).toContain("جارٍ تجهيز مشروعك");
    releaseRead();
    expect(await screen.findByRole("heading", readyHeading)).toBeTruthy();
  });

  it("offers the honest setup CTA when there is no project yet (guest/connected-only account)", async () => {
    /* Stage C (S13/R5-1 — أمر المالك 2026-11-14): بلا ملف مالك القراءة ترجع
     * no_project — دعوة تأسيس صادقة، لا شاشة «تعذر تحميل مشروعك» التي لا
     * تنجح إعادتها أبدًا (الضيف من السوق يهبط هنا من مقعد الرئيسية). */
    renderHome();
    expect(await screen.findByTestId("home-no-project")).toBeTruthy();
    expect(screen.getByRole("heading", { name: "ابدأ مشروعك في Micro" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "أنشئ مشروعي الآن" })).toBeTruthy();
    expect(screen.queryByRole("heading", { name: "تعذر تحميل مشروعك" })).not.toBeTruthy();
  });

  it("fails honestly with the retry affordance when the read model fails (no click)", async () => {
    /* فشل قراءة حقيقي (وليس غياب المشروع) — سطح الخطأ الصادق يظهر كما هو. */
    const failingControlCenter = {
      read: async () => ({
        ok: false as const,
        code: "storage_error" as const,
        message: "تعذر قراءة بيانات مشروعك المحلية.",
      }),
    } as unknown as HomeControlCenterService;
    mockedUsePrototypeServices.mockReturnValue({
      homeControlCenter: failingControlCenter,
      projectFinance: new ProjectFinancialService(store, () => NOW),
      dataVersion: 0,
      notifyDataChanged: () => {},
    } as unknown as ReturnType<typeof usePrototypeServices>);
    renderHome();
    expect(await screen.findByRole("heading", { name: "تعذر تحميل مشروعك" })).toBeTruthy();
    expect(screen.getByText("تعذر قراءة بيانات مشروعك المحلية.")).toBeTruthy();
    /* زر «إعادة المحاولة» موجود كواجهة إعادة المحاولة — لا يُنقر في الاختبار
     * (إعادة المحاولة تعيد القراءة في مكانها، لا إعادة تحميل الصفحة). */
    expect(screen.getByRole("button", { name: "إعادة المحاولة" })).toBeTruthy();
    expect(screen.queryByRole("heading", readyHeading)).not.toBeTruthy();
  });

  it("keeps the ready surface when a background refresh fails, with an inline alert and a safe in-place retry", async () => {
    await seedProfile();
    /* Z1.4 (§3.1 حالة الخطأ): فشل التحديث الخلفي مع جهوزية قائمة — المحتوى
     * الجاهز يبقى، وخطأ صادق معلن مع زر إعادة محاولة يعيد القراءة نفسها. */
    let readCalls = 0;
    const realControlCenter = buildHomeControlCenter();
    const flakyControlCenter = {
      read: async () => {
        readCalls += 1;
        if (readCalls === 2)
          return { ok: false as const, code: "storage_error" as const, message: "تعذّر تحديث القراءة." };
        return realControlCenter.read();
      },
    } as unknown as HomeControlCenterService;
    function RefreshHarness() {
      const [version, setVersion] = React.useState(0);
      mockedUsePrototypeServices.mockReturnValue({
        homeControlCenter: flakyControlCenter,
        projectFinance: new ProjectFinancialService(store, () => NOW),
        dataVersion: version,
        notifyDataChanged: () => {
          setVersion(current => current + 1);
        },
      } as unknown as ReturnType<typeof usePrototypeServices>);
      return (
        <QuickRecordingProvider>
          <UnsavedChangesProvider navigate={wouterMocks.navigate}>
            <Home />
            <button type="button" onClick={() => setVersion(current => current + 1)}>
              bump-refresh
            </button>
          </UnsavedChangesProvider>
        </QuickRecordingProvider>
      );
    }
    render(<RefreshHarness />);
    expect(await screen.findByRole("heading", readyHeading)).toBeTruthy();
    /* تحديث خلفي يفشل: الجهوزية تبقى ولا يستبدلها سطح الخطأ الكامل. */
    fireEvent.click(screen.getByText("bump-refresh"));
    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toContain("تعذّر تحديث القراءة.");
    expect(screen.getByRole("heading", readyHeading)).toBeTruthy();
    expect(screen.queryByRole("heading", { name: "تعذر تحميل مشروعك" })).not.toBeTruthy();
    /* إعادة المحاولة الآمنة تعيد القراءة في مكانها — لا window.location.reload. */
    const retry = screen.getByRole("button", { name: "إعادة المحاولة" });
    expect(alert.contains(retry)).toBe(true);
    fireEvent.click(retry);
    expect(await screen.findByRole("heading", readyHeading)).toBeTruthy();
    await waitFor(() => expect(screen.queryByRole("alert")).toBeNull());
    expect(readCalls).toBe(3);
  });
});
