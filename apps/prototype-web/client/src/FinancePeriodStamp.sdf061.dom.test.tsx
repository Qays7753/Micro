/** @vitest-environment jsdom */
/* SDF-061 (UNIT-013/016 — تنفيذ S15 بالأمر الموحد §5): تغيّر الفترة أثناء
 * تحميل ملخص المالية لا يمزّق الختم — نتيجة نطاق قديم تعود متأخرة فتُهمَل
 * بلا setState (راية active لكل تشغيل أثر)، والعرض النهائي يحمل نطاق القراءة
 * المطبق الأخير وحده: لا أرقام فترة قديمة فوق نطاق جديد.
 * البرهان بوعود قابلة للتعليق: بذرة مصروف واحد في آب (٧٧٫٧٧)، والقارئ يتنقل
 * إلى تموز، تُحل قراءة تموز أولًا فتُعرض، ثم تُحل كل وعود النطاقات الأقدم
 * (أيلول البداية والوسائط) — فيبقى العرض ختم تموز.
 * حدود البرهان: أسطح الزمن-الكامل (الحقيقة «ما نعرفه الآن» وسجل الأحداث
 * والمركز) يحق لها إظهار رقم آب — مصدرها قراءات كل-الوقت لا نطاق الفترة؛
 * الغرض هنا أسطح النطاق حصرًا: قراءة الفترة ومؤشراتها وجسر النقد الذي
 * يقرأ فوق النطاق المعروض نفسه — لو نُفذ setState المتأخر لظهر رقم آب
 * فيها أو انقلب ختمها. */
import React from "react";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { usePrototypeServices } from "@/app/PrototypeServicesContext";
import { UnsavedChangesProvider } from "@/components/forms/UnsavedChangesGuard";
import { MemoryLocalStore } from "@/storage/local/MemoryLocalStore";
import { ProjectFinancialService } from "@/application/finance/projectFinancialService";
import { CorrectionHistoryService } from "@/application/financial-records/correctionHistoryService";
import { OwnerEntitlementService } from "@/application/owner-money/ownerEntitlementService";
import { G5Service } from "@/application/financial-analysis/financialAnalysisService";
import { FinancialPulseService } from "@/application/financial-pulse/financialPulseService";
import { InventoryMaterialService } from "@/application/inventory/inventoryMaterialService";
import { ProfitToCashBridgeService } from "@/application/finance/profitToCashBridgeService";
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

/* SDF-061 حتمية الزمن: الصفحة تشتق الشهر الأولي من باب «اليوم» المسماى
 * (todayInAmman) — بلا تحديد له تصير بوابات الاختبار رهن الساعة الحقيقية
 * لجهاز التشغيل. يُثبَّت «اليوم» على NOW نفسه (12 أيلول 2026) داخل حدود
 * هذا الملف حصرًا، فتستقيم خريطة النطاقات: أيلول بداية، آب بذرة، تموز
 * هدفًا — أينما شُغّل الملف لاحقًا. الخدمات تظل تحقن ساعتها صراحة كما
 * هي؛ الباب الوحيد المُسخر هو باب قراءة «اليوم» في الواجهة. */
vi.mock("@/application/time", () => ({
  todayInAmman: () => "2026-09-12",
}));

const mockedUsePrototypeServices = vi.mocked(usePrototypeServices);
const NOW = "2026-09-12T09:00:00.000Z";

/* تعليق قراءات الفترة: بوابة لكل نطاق (from:to) — تُحل عند الطلب. */
type Gate = { resolve: () => void };
const gates: Record<string, Gate[]> = {};
function waitForRange(from: string, to: string): Promise<void> {
  return new Promise(resolve => {
    (gates[`${from}:${to}`] ??= []).push({ resolve });
  });
}
function releaseRange(from: string, to: string) {
  for (const gate of gates[`${from}:${to}`] ?? []) gate.resolve();
}
function releaseAllGates() {
  for (const queue of Object.values(gates)) for (const gate of queue) gate.resolve();
}

let store: MemoryLocalStore;

beforeEach(async () => {
  vi.clearAllMocks();
  gatesClear();
  store = new MemoryLocalStore();
  const real = new ProjectFinancialService(store, () => NOW);
  const profile = await new ProfileService(store, () => NOW).create("مشغل SDF-061");
  if (!profile.ok) throw new Error(profile.message);
  /* بذرة تمييز: مصروف واحد في آب وحده (٧٧٫٧٧) — إن تسربت قراءة آب المتأخرة
   * إلى العرض لظهر الرقم؛ تموز وأيلول فارغانان. */
  const augustExpense = await real.record({
    type: "operating_expense_cash",
    amountMinor: 7_777,
    occurredOn: "2026-08-14",
    note: "مصروف آب المميز",
    counterparty: null,
    relatedEventId: null,
    expenseContext: {
      relationship: "project",
      behavior: "fixed",
      purpose: "project_general",
      knowledge: "known",
      sharedProjectShare: null,
      categoryLabel: null,
    },
    idempotencyKey: "sdf-061-august-expense",
  });
  if (!augustExpense.ok) throw new Error(augustExpense.message);
  /* تفويض النموذج الأولي: كل القراءات كما هي، وقراءتا الفترة وحدهما معلّقتان. */
  const gatedFinance = Object.assign(Object.create(Object.getPrototypeOf(real)), real, {
    readRecordedPeriodResult: (from: string, to: string) =>
      waitForRange(from, to).then(() => real.readRecordedPeriodResult(from, to)),
    readFinancialInsights: (from: string, to: string) =>
      waitForRange(from, to).then(() => real.readFinancialInsights(from, to)),
  });
  /* الجسر (FIN-003) يقرأ فوق النطاق المعروض نفسه — يُعلَّق معه ليُثبت
   * انضباط أثره المستقل بنفس الطريقة: قراءته الوسيطة المتأخرة تُهمَل. */
  const realBridge = new ProfitToCashBridgeService(store, () => NOW);
  const gatedBridge = Object.assign(Object.create(Object.getPrototypeOf(realBridge)), realBridge, {
    readProfitToCashBridge: (period: { from: string; to: string }) =>
      waitForRange(period.from, period.to).then(() => realBridge.readProfitToCashBridge(period)),
  });
  mockedUsePrototypeServices.mockReturnValue({
    projectFinance: gatedFinance,
    correctionHistory: new CorrectionHistoryService(store),
    ownerEntitlement: new OwnerEntitlementService(
      store,
      (from: string, to: string) => real.readRecordedPeriodResult(from, to),
      () => NOW,
    ),
    g5: new G5Service(store, real, () => NOW),
    financialPulse: new FinancialPulseService(store),
    inventory: new InventoryMaterialService(store, () => NOW),
    profitToCashBridge: gatedBridge,
    dataVersion: 0,
    notifyDataChanged: () => undefined,
  } as unknown as ReturnType<typeof usePrototypeServices>);
});

function gatesClear() {
  for (const key of Object.keys(gates)) delete gates[key];
}

afterEach(() => {
  cleanup();
});

describe("SDF-061 — تغيّر الفترة أثناء التحميل يُهمل الناتج القديم بختم متسق", () => {
  it("قراءات النطاقات الأقدم تُهمَل متى تأخرت — الختم النهائي تموز بلا أرقام آب", async () => {
    render(
      <UnsavedChangesProvider navigate={wouterMocks.navigate}>
        <Finance />
      </UnsavedChangesProvider>,
    );
    /* أولاً: تحرير قراءة أيلول الأولية حتى تصير الصفحة جاهزة. */
    await waitFor(() => expect(gates["2026-09-01:2026-09-30"]?.length).toBeGreaterThanOrEqual(1));
    releaseRange("2026-09-01", "2026-09-30");
    expect(await screen.findByRole("heading", { level: 1, name: "المالية" })).toBeTruthy();
    await waitFor(() => expect(screen.queryByText("جارٍ قراءة الوضع المالي المحلي…")).not.toBeTruthy());

    /* نية القارئ تتحول إلى تموز عبر حقلي النطاق؛ كل تغيير حقل يشغّل قراءة
     * للنطاق الوسيط المعروض لحظتها — كلها تبقى معلقة على بواباتها. */
    fireEvent.change(screen.getByLabelText("بداية نطاق نتيجة الفترة"), {
      target: { value: "2026-07" },
    });
    await waitFor(() => expect(Object.keys(gates).length).toBeGreaterThanOrEqual(2));
    fireEvent.change(screen.getByLabelText("نهاية نطاق نتيجة الفترة"), {
      target: { value: "2026-07" },
    });
    /* قراءة النطاق النهائي (تموز) تُحل أولًا وحدها. */
    await waitFor(() => expect(gates["2026-07-01:2026-07-31"]?.length).toBeGreaterThanOrEqual(1));
    releaseRange("2026-07-01", "2026-07-31");
    /* ختمان يحملان النطاق المعروض نفسه ولا ثالث لهما: ختم قراءة الفترة
     * وختم ملخص جسر النقد (FIN-003 يقرأ فوق النطاق نفسه — لا منتقي ثانٍ). */
    await waitFor(() => expect(screen.getAllByText(/من 07\/2026 إلى 07\/2026/)).toHaveLength(2));

    /* الآن تُحل كل الوعود الأقدم المتأخرة (أيلول والوسائط) — نتائجها تُهمَل:
     * أسطح النطاق (قراءة الفترة بمؤشراتها، والجسر) تبقى ختم تموز بلا رقم
     * آب، وحقول النطاق تبقى نية القارئ الحية. لو نُفذ setState المتأخر
     * لظهر رقم آب في أسطح النطاق أو انقلب ختمها إلى النطاق الوسيط. */
    releaseAllGates();
    await waitFor(() => expect(screen.getAllByText(/من 07\/2026 إلى 07\/2026/)).toHaveLength(2));
    /* أسطح النطاق وحدها في الحكم. المطابقات الموجبة للرقم على مستوى الصفحة
     * تبقى الاثنتين المشروعتين حصرًا — كلاهما زمن-كامل بالتصميم: الحقيقة
     * «ما نعرفه الآن» (المصاريف التشغيلية المسجلة كل-الوقت) وسجل الأحداث
     * (مصروف آب المدفوع في السجل). لو نُفذ setState المتأخر لظهرت صور
     * موجبة إضافية: المنصرف المؤهل/المصروف الثابت/تكوين التكلفة بأرقام
     * النطاق الوسيط — فينكشف العدد. أما جسر النقد فطبقته نطاق-صرف خالص
     * (كل أرقامه فوق النطاق المعروض) فلا يحتمل أي صورة للرقم لا موجبة
     * ولا سالبة؛ وسيولة المؤشرات داخل قراءة الفترة تركيب فوق المركز
     * الكنوني (كل-الوقت) بالتصميم فلا تُحاسب هنا. */
    const bridgeLayer = within(screen.getByText("لماذا يختلف الربح عن الكاش؟").closest("details")!);
    expect(screen.queryAllByText("77.77")).toHaveLength(2);
    expect(bridgeLayer.queryAllByText(/77\.77/)).toHaveLength(0);
    /* لا ختم يبدأ من آب أو أيلول، ولا ختم ينتهي عند أيلول (صورة النطاق
     * الوسيط 07←09 لو تسربت)؛ ختم البداية الأيلولي هو صورة الحالة الأولى
     * ولو بقيت لظهر هنا. */
    expect(screen.queryAllByText(/من 08\/2026/)).toHaveLength(0);
    expect(screen.queryAllByText(/من 09\/2026/)).toHaveLength(0);
    expect(screen.queryAllByText(/إلى 09\/2026/)).toHaveLength(0);
    expect((screen.getByLabelText("بداية نطاق نتيجة الفترة") as HTMLInputElement).value).toBe("2026-07");
    expect((screen.getByLabelText("نهاية نطاق نتيجة الفترة") as HTMLInputElement).value).toBe("2026-07");
  });
});
