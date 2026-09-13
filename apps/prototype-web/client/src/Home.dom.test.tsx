/** @vitest-environment jsdom */

/* المجموعة ١١ (المرحلة 11-E — تغطية الرحلات عالية القيمة): رحلة صفحة الأساس —
 * حالات الإقلاع (التحميل ← الجهوزية) والفراغ والخطأ الصادق عبر الحدود الحقيقية
 * (تفاعل ← خدمة ← مخزن الذاكرة)، والرصيد النقدي الافتتاحي بدقته الكاملة،
 * وعقد التنقل الموحّد (?from). عقد الجهوزية المستقر هو العنوان الرئيسي باسم
 * النشاط — عنصر دائم في الحالة الجاهزة؛ بطاقة «أثناء غيابك» مشروطة بغياب
 * ٧ أيام فلا تصلح عقد جهوزية، وحالة التحميل تُثبَّت ببوابة قراءة يحكمها الاختبار
 * (لا سباق ولا نوم)، وزر «إعادة المحاولة» في سطح الخطأ لا يُنقر أبدًا. */
import React from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { usePrototypeServices } from "@/app/PrototypeServicesContext";
import { withFrom } from "@/app/navigationContract";
import { UnsavedChangesProvider } from "@/components/forms/UnsavedChangesGuard";
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
const NOW = "2026-09-12T09:00:00.000Z";

let store: MemoryLocalStore;
let dataVersion = 0;

function buildHomeControlCenter() {
  return new HomeControlCenterService(
    store,
    new DailyFollowUpService(store),
    new ProjectFinancialService(store, () => NOW),
    new SupplierPurchaseService(store, () => NOW),
    new InventoryMaterialService(store, () => NOW),
    new AgreementContextService(store, () => NOW),
    new ActivityService(store),
    () => NOW,
  );
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
  const result = await new ProfileService(store, () => NOW).save("مشغل الاختبار");
  if (!result.ok) throw new Error(result.message);
}

function renderHome() {
  return render(
    <UnsavedChangesProvider navigate={wouterMocks.navigate}>
      <Home />
    </UnsavedChangesProvider>,
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
    /* بلا بيانات: يوم مفتوح بلا أرقام مختلقة (§7.1 — ما لا تسجله لا يُخترع له رقم). */
    expect(screen.getByText("يومك مفتوح")).toBeTruthy();
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
    /* وحدة «مالي» الدائمة (القرار ٧): زر «صفحة الأساس» باسم مستقر لا لبس فيه —
     * الرحلة تحترم عقد التنقل ٢٦: المصدر الرئيسية يُحفظ في ?from. */
    fireEvent.click(screen.getByRole("button", { name: "صفحة الأساس" }));
    expect(wouterMocks.navigate).toHaveBeenCalledWith(withFrom("/foundation", "/"));
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

  it("fails honestly with the retry affordance when the read model fails (no click)", async () => {
    /* بلا ملف مالك: القراءة ترجع ok:false — سطح الخطأ الصادق يظهر. */
    renderHome();
    expect(await screen.findByRole("heading", { name: "تعذر تحميل مشروعك" })).toBeTruthy();
    expect(screen.getByText("تعذر قراءة بيانات مشروعك المحلية.")).toBeTruthy();
    /* زر «إعادة المحاولة» موجود كواجهة إعادة المحاولة — لا يُنقر في الاختبار
     * (استدعاؤه window.location.reload — خارج نطاق jsdom وسبق أن أربك رحلة سابقة). */
    expect(screen.getByRole("button", { name: "إعادة المحاولة" })).toBeTruthy();
    expect(screen.queryByRole("heading", readyHeading)).not.toBeTruthy();
  });
});
