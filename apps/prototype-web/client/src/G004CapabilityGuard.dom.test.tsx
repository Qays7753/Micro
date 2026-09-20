/** @vitest-environment jsdom */
/* G-004 (تدقيق الإدارة المالية المتدرجة 2026-09-19): تعطيل القدرة يخفي كل
 * مداخل الإنشاء على كل الأسطح (لا زر الشراء الباقي في الموردين — الثغرة
 * المدققة نفسها)، والسجلات القائمة تبقى مقروءة، وإعادة التفعيل تعيد
 * المداخل — عبر الحارس المركزي المشترك useDisabledCapabilities. */
import React from "react";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { usePrototypeServices } from "@/app/PrototypeServicesContext";
import { UnsavedChangesProvider } from "@/components/forms/UnsavedChangesGuard";
import { MemoryLocalStore } from "@/storage/local/MemoryLocalStore";
import { PreferenceService } from "@/application/preferences/preferenceService";
import { ProfileService } from "@/application/profile/profileService";
import { CashContinuityService } from "@/application/cash/cashContinuityService";
import { ProjectFinancialService } from "@/application/finance/projectFinancialService";
import { InventoryMaterialService } from "@/application/inventory/inventoryMaterialService";
import { SupplierPurchaseService } from "@/application/suppliers/supplierPurchaseService";
import { DailyFollowUpService } from "@/application/follow-up/dailyFollowUpService";
import { ScheduleService } from "@/application/scheduling/scheduleService";
import { ScheduleRecurrenceService } from "@/application/scheduling/recurrenceService";
import { HomeControlCenterService } from "@/application/home/homeControlCenterService";
import { ActivityService } from "@/application/activity/activityService";
import { AgreementContextService } from "@/application/agreements/agreementContextService";
import { QuickRecordingProvider } from "@/app/quickRecording";
import Suppliers from "@/pages/Suppliers";
import InventoryMaterials from "@/pages/InventoryMaterials";
import Schedule from "@/pages/Schedule";
import Home from "@/pages/Home";
import SupplierPurchaseEditor from "@/pages/SupplierPurchaseEditor";
import { ActualMaterialPanel } from "@/components/order/ActualMaterialPanel";
import { createSupplierPurchase } from "@micro-domain/supplier-purchase/index.js";
import { FormDraftService } from "@/application/drafts/formDraftService";

vi.mock("@/app/PrototypeServicesContext", () => ({
  usePrototypeServices: vi.fn(),
}));

const wouterMocks = vi.hoisted(() => ({
  navigate: vi.fn(),
  location: "/",
  search: "",
  params: {} as Record<string, string | undefined>,
}));
vi.mock("wouter", () => ({
  useLocation: () => [wouterMocks.location, wouterMocks.navigate],
  useParams: () => wouterMocks.params,
  useSearch: () => wouterMocks.search,
}));

const mockedUsePrototypeServices = vi.mocked(usePrototypeServices);
const NOW = "2026-09-20T09:00:00.000Z";
let store: MemoryLocalStore;
let preferences: PreferenceService;
const contextRef: { current: Record<string, unknown> } = { current: {} };

function Harness({ page }: { page: React.ReactNode }) {
  const [version, setVersion] = React.useState(0);
  /* خدمات ثابتة الهوية خارج العرض — إعادة بنائها في كل عرض تُسقط
   * اعتماديات التأثير وتُبقي الصفحة في تحميل دائم. */
  const servicesRef = React.useRef<Record<string, unknown> | null>(null);
  if (servicesRef.current === null) {
    const schedules = new ScheduleService(store, () => NOW);
    servicesRef.current = {
      preferences,
      inventory: new InventoryMaterialService(store, () => NOW),
      supplierPurchases: new SupplierPurchaseService(store, () => NOW),
      projectFinance: new ProjectFinancialService(store, () => NOW),
      cashContinuity: new CashContinuityService(store, () => NOW),
      dailyFollowUp: new DailyFollowUpService(store),
      schedules,
      recurrences: new ScheduleRecurrenceService(store),
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
    };
  }
  contextRef.current = {
    ...servicesRef.current,
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

async function setCapabilities(disabled: readonly string[]) {
  const saved = await preferences.saveDisabledCapabilities(disabled);
  if (!saved.ok) throw new Error(saved.message);
}

/* سياق محرر الشراء للقدرات — نفس محرر المجموعة ٢ مع خدمة التفضيلات
 * للحارس المركزي (G-004 على صفحات الشراء: وصلتا الاستلام). */
function PurchaseEditorHarness() {
  const [version, setVersion] = React.useState(0);
  const servicesRef = React.useRef<Record<string, unknown> | null>(null);
  if (servicesRef.current === null) {
    servicesRef.current = {
      preferences,
      inventory: new InventoryMaterialService(store, () => NOW),
      supplierPurchases: new SupplierPurchaseService(store, () => NOW),
      cashContinuity: new CashContinuityService(store, () => NOW),
      formDrafts: new FormDraftService(store),
    };
  }
  contextRef.current = {
    ...servicesRef.current,
    dataVersion: version,
    notifyDataChanged: () => setVersion(current => current + 1),
  };
  mockedUsePrototypeServices.mockImplementation(
    () => contextRef.current as unknown as ReturnType<typeof usePrototypeServices>,
  );
  return (
    <QuickRecordingProvider>
      <UnsavedChangesProvider navigate={wouterMocks.navigate}>
        <SupplierPurchaseEditor />
      </UnsavedChangesProvider>
    </QuickRecordingProvider>
  );
}

describe("G-004 — capability disablement hides every creation entry", () => {
  beforeEach(async () => {
    wouterMocks.navigate.mockReset();
    wouterMocks.location = "/";
    wouterMocks.search = "";
    wouterMocks.params = {};
    vi.clearAllMocks();
    store = new MemoryLocalStore();
    preferences = new PreferenceService(store, () => NOW);
    /* الرئيسية تحتاج ملفًا محفوظًا (نمط Set003 نفسه). */
    const profiles = new ProfileService(store);
    const savedProfile = await profiles.save("مشروع-G004");
    if (!savedProfile.ok) throw new Error(savedProfile.message);
  });
  afterEach(() => cleanup());

  it("suppliers disabled: the audited purchase button disappears while existing purchases stay readable", async () => {
    /* سجل شراءً قائمًا أولًا — السجلات القائمة تبقى ظاهرة دائمًا. */
    const suppliers = new SupplierPurchaseService(store, () => NOW);
    const created = await suppliers.recordPurchase({
      supplierName: "مؤسسة النسيج",
      note: "قماش",
      purchasedOn: "2026-09-19",
      dueOn: null,
      totalMinor: 5000,
      initialPaidMinor: 0,
      idempotencyKey: "g004-existing-purchase",
    });
    expect(created.ok).toBe(true);
    await setCapabilities(["suppliers"]);
    render(<Harness page={<Suppliers />} />);
    await waitFor(() => {
      expect(screen.queryByText("سجّل شراء مواد")).toBeNull();
    });
    /* الثغرة المدققة: الزر كان يظهر مع تعطيل الموردين — الآن يختفي، والسجل
     * القائم والذمم يبقيان مقروءين. */
    await waitFor(() => {
      expect(screen.getByText("مؤسسة النسيج")).toBeTruthy();
    });
    expect(screen.queryByText("لا مشتريات بعد") ?? screen.getByText("مؤسسة النسيج")).toBeTruthy();
  });

  it("suppliers re-enabled: the creation entry returns after re-enabling", async () => {
    await setCapabilities(["suppliers"]);
    const { unmount } = render(<Harness page={<Suppliers />} />);
    await waitFor(() => {
      expect(screen.queryByText("سجّل شراء مواد")).toBeNull();
    });
    unmount();
    await setCapabilities([]);
    render(<Harness page={<Suppliers />} />);
    await waitFor(() => {
      expect(screen.getByText("سجّل شراء مواد")).toBeTruthy();
    });
  });

  it("inventory disabled: the creation toolbar disappears while materials and movements stay readable", async () => {
    const inventory = new InventoryMaterialService(store, () => NOW);
    const opened = await inventory.openMaterial({
      name: "قماش قطنية",
      unit: "meter",
      tracking: "tracked",
      opening: {
        quantityState: "confirmed",
        quantityMilli: 10_000,
        costState: "known",
        valueMinor: 5_000,
        confirmedOn: "2026-09-01",
        sourceNote: "جرد",
      },
      note: "افتتاح",
      operationKey: "g004-material-open",
    });
    expect(opened.ok).toBe(true);
    await setCapabilities(["inventory"]);
    render(<Harness page={<InventoryMaterials />} />);
    await waitFor(() => {
      expect(screen.queryByText("مادة جديدة")).toBeNull();
      expect(screen.queryByText("استلام شراء")).toBeNull();
      expect(screen.queryByText("استهلاك أو استلام نقص")).toBeNull();
      expect(screen.queryByText("هدر مادة")).toBeNull();
    });
    /* المادة القائمة تبقى ظاهرة بقراءتها. */
    await waitFor(() => {
      expect(screen.getByText("قماش قطنية")).toBeTruthy();
    });
  });

  it("orders disabled: the schedule empty-state order entry disappears", async () => {
    await setCapabilities(["orders"]);
    render(<Harness page={<Schedule />} />);
    await waitFor(() => {
      expect(screen.queryByText("بدء طلب")).toBeNull();
    });
    await waitFor(() => {
      expect(screen.getByText("لا توجد مواعيد تشغيلية")).toBeTruthy();
    });
  });

  it("catalog disabled: the home catalog quick action disappears while the enabled entries stay", async () => {
    await setCapabilities(["catalog"]);
    render(<Harness page={<Home />} />);
    render(<Harness page={<Home />} />);
    const quickActions = await screen.findByTestId("home-quick-actions");
    expect(quickActions.textContent).not.toContain("منتجاتي وخدماتي");
    /* البيع والمصروف (الأساس غير القابل للإيقاف) يبقيان. */
    expect(quickActions.textContent).toContain("سجّل بيعًا");
    expect(quickActions.textContent).toContain("سجّل مصروفًا");
  });

  it("inventory disabled on a purchase detail: the receipt bridge CTA disappears while the purchase stays readable", async () => {
    /* شراء قائم بمادة متتبَّعة (جسر الاستلام ظاهرًا مبدئيًا) — G-004 على
     * صفحات الشراء نفسها لا على دفتر المواد وحده. */
    const inventory = new InventoryMaterialService(store, () => NOW);
    const opened = await inventory.openMaterial({
      name: "قماش الجسر",
      unit: "meter",
      tracking: "tracked",
      opening: {
        quantityState: "confirmed",
        quantityMilli: 10_000,
        costState: "known",
        valueMinor: 5_000,
        confirmedOn: "2026-09-01",
        sourceNote: "جرد",
      },
      note: "افتتاح",
      operationKey: "g004-bridge-material",
    });
    if (!opened.ok) throw new Error(opened.message);
    const saved = await store.saveSupplierPurchase(
      createSupplierPurchase({
        id: "g004-bridge-purchase",
        supplierName: "مورد الجسر",
        note: "قماش",
        purchasedOn: "2026-09-19",
        dueOn: null,
        totalMinor: 9000,
        initialPaidMinor: 0,
        recordedAt: "2026-09-19T00:00:00.000Z",
        idempotencyKey: "g004-bridge-key",
        materialId: opened.value.material.id,
        expectedQuantityMilli: 15_000,
      }),
    );
    if (!saved.ok) throw new Error(saved.message);
    await setCapabilities(["inventory"]);
    wouterMocks.params = { id: "g004-bridge-purchase" };
    wouterMocks.location = "/suppliers/purchase/g004-bridge-purchase";
    render(<PurchaseEditorHarness />);
    /* وصلتا الاستلام (الجسر والاستمرار) تختفيان مع توقف المخزون. */
    await waitFor(() => {
      expect(screen.queryByText("استلم المواد في المخزون")).toBeNull();
    });
    /* الشراء نفسه والدفعات تبقى مقروءة كما وعدت الإعدادات. */
    await waitFor(() => {
      expect(screen.getByText(/شراء من مورد الجسر/)).toBeTruthy();
    });
    expect(screen.getByText(/إدخال المخزون متوقف من الإعدادات/)).toBeTruthy();
  });

  it("ActualMaterialPanel without onRecord (inventory paused) shows the honest note, never a create button", () => {
    const notRecorded = {
      phase: "ready",
      comparison: { status: "not_recorded" },
    } as unknown as Parameters<typeof ActualMaterialPanel>[0]["state"];
    /* مع الوصلة: زر الإنشاء ظاهر كما كان. */
    const { rerender } = render(<ActualMaterialPanel state={notRecorded} onRecord={() => undefined} />);
    expect(screen.getByText("سجّل استهلاك مادة إذا كان مؤثرًا")).toBeTruthy();
    /* بلا وصلة (المخزون متوقف): قراءة صادقة بلا زر إنشاء — السجل القائم
     * لا يختفي (OrderDetail وطبقة التنفيذ). */
    rerender(<ActualMaterialPanel state={notRecorded} />);
    expect(screen.queryByText("سجّل استهلاك مادة إذا كان مؤثرًا")).toBeNull();
    expect(screen.getByText("إدخال المخزون متوقف من الإعدادات")).toBeTruthy();
  });
});
