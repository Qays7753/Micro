/** @vitest-environment jsdom */
/* S18 (DOC-027 — SDF-068): الأدلة الدائمة العابرة للمراحل للتعريف الكنوني
 * للحالة: «الخطأ والرجوع والإلغاء والفراغ على هاتف RTL: تبقى المدخلات حيث
 * أمكن، والإلغاء بلا كتابة، والخطأ قرب حقله. مساعدة! مسماة وقابلة للتركيز
 * ولا تخفي أثرًا مهمًا.»
 *
 * أصحاب الحالة الأساسيون (004/002/005/011/027/044): أدلة كل سطح قائمة في
 * اختبارات مراحله (الفحص الأدناه يوثقها في مصفوفة الرحلات)؛ هذا الاختبار
 * يسد الفجوتين العابرتين الحقيقيتين فقط:
 *  ١) 044/JRN-008: مساعدة «عن النسخ الاحتياطي» مسماة وقابلة للتركيز،
 *     والأثر المهم (الاستبدال وحماية الموجود) يبقى ظاهرًا خارجها — عقد ٠٤٤
 *     B1-5 الذي أضيف مع S18.
 *  ٢) 005/JRN-003: الثلاثية الكاملة على سطح واحد — الخطأ قرب حقله بلا
 *     استدعاء خدمة، والمدخلات تبقى (مسودة)، والإلغاء/عدم التأكيد لا يكتبان.
 */
import React from "react";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { usePrototypeServices } from "@/app/PrototypeServicesContext";
import { UnsavedChangesProvider } from "@/components/forms/UnsavedChangesGuard";
import DirectSaleEditor from "@/pages/DirectSaleEditor";
import { IntegrityCheckService } from "@/application/finance/integrityCheckService";
import { ProjectFinancialService } from "@/application/finance/projectFinancialService";
import { StatementService } from "@/application/finance/statementService";
import { CashContinuityService } from "@/application/cash/cashContinuityService";
import { MemoryLocalStore } from "@/storage/local/MemoryLocalStore";
import { PreferenceService } from "@/application/preferences/preferenceService";
import { ProfileService } from "@/application/profile/profileService";
import { AgreementService } from "@/application/agreements/agreementService";
import { CostService } from "@/application/cost/costService";
import { InventoryMaterialService } from "@/application/inventory/inventoryMaterialService";
import { SupplierPurchaseService } from "@/application/suppliers/supplierPurchaseService";
import { CatalogService } from "@/application/catalog/catalogService";
import Settings from "@/pages/Settings";
import { ThemeProvider } from "@/contexts/ThemeContext";

vi.mock("@/app/PrototypeServicesContext", () => ({
  usePrototypeServices: vi.fn(),
}));

const wouterMocks = vi.hoisted(() => ({
  location: "/direct-sales/new",
  navigate: vi.fn(),
}));

vi.mock("wouter", () => ({
  useSearch: () => "",
  useLocation: () => [wouterMocks.location, wouterMocks.navigate],
  useParams: () => ({}),
}));

const mockedUsePrototypeServices = vi.mocked(usePrototypeServices);

/* ─── 044/JRN-008: المساعدة المسماة والأثر الظاهر ─── */

function mockSettingsServices() {
  const settingsStore = new MemoryLocalStore();
  const finance = new ProjectFinancialService(new MemoryLocalStore());
  mockedUsePrototypeServices.mockReturnValue({
    integrityCheck: new IntegrityCheckService(
      new MemoryLocalStore(),
      finance,
      new StatementService(new MemoryLocalStore(), finance),
      new CashContinuityService(new MemoryLocalStore()),
    ),
    preferences: new PreferenceService(settingsStore),
    profiles: new ProfileService(settingsStore),
    agreements: new AgreementService(settingsStore, new CostService(settingsStore)),
    inventory: new InventoryMaterialService(settingsStore),
    supplierPurchases: new SupplierPurchaseService(settingsStore),
    catalog: new CatalogService(settingsStore),
    actualTime: {
      readOperatingMode: vi.fn(async () => ({
        ok: true,
        value: { workMode: null, actualTimeTrackingEnabled: false },
      })),
      saveOperatingMode: vi.fn(),
    },
    transfers: {
      createExport: vi.fn(async () => ({ ok: false })),
      prepareImport: vi.fn(),
      prepareRestore: vi.fn(),
      confirmImport: vi.fn(),
      createVerifiedExport: vi.fn(async () => ({ ok: false })),
      resetAll: vi.fn(async () => ({ ok: false })),
      readRestoreStatus: vi.fn(async () => ({
        ok: true,
        value: { generation: 0, rollbackCreatedAt: null, unresolvedIntent: false },
      })),
      readActiveRollback: vi.fn(async () => ({ ok: true, value: null })),
      prepareRollbackRestore: vi.fn(async () => ({ ok: false })),
    },
    guidedOpeningImport: { prepare: vi.fn(), confirm: vi.fn() },
    dataVersion: 0,
    notifyDataChanged: vi.fn(),
  } as unknown as ReturnType<typeof usePrototypeServices>);
}

describe("SDF-068 (S18) — مساعدة النسخ الاحتياطي المسماة والأثر الظاهر (044/JRN-008)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal(
      "matchMedia",
      vi.fn().mockReturnValue({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() }),
    );
    mockSettingsServices();
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    cleanup();
  });

  it("«عن النسخ الاحتياطي» مساعدة مسماة قابلة للتركيز — والأثر المهم يبقى ظاهرًا خارجها لا خلفها", async () => {
    render(
      <ThemeProvider defaultTheme="system" switchable>
        <Settings />
      </ThemeProvider>,
    );
    /* UXR-06 (F-011): فتح مجموعة «البيانات والنسخ الاحتياطي» قبل فحص القسم. */
    fireEvent.click(screen.getByTestId("settings-group-data"));
    await waitFor(() =>
      expect(screen.getByRole("heading", { name: "النسخ الاحتياطي والاستعادة" })).toBeTruthy(),
    );

    const dataSection = screen.getByText("البيانات والنسخ الاحتياطي").closest("details") as HTMLElement;
    const scope = within(dataSection);

    /* المساعدة مسماة: عنصر details بعنوان «عن النسخ الاحتياطي» وملخصه
     * «افتح المساعدة» — الملخص عنصر تفاعلي أصلي قابل للتركيز بلوحة
     * المفاتيح (نفس نمط أدوات المشروع المعتمد). */
    const help = scope.getByText("عن النسخ الاحتياطي").closest("details") as HTMLDetailsElement;
    expect(help).not.toBeNull();
    expect(help.open).toBe(false);
    const summary = help.querySelector("summary") as HTMLElement;
    expect(summary).not.toBeNull();
    expect(summary.textContent).toContain("افتح المساعدة");
    /* الملخص قابل للتركيز: عنصر تفاعلي أصلي (لا tabindex="-1" ولا aria-hidden). */
    expect(summary.getAttribute("aria-hidden")).toBeNull();
    expect(summary.getAttribute("tabindex")).not.toBe("-1");

    /* الأثر المهم لا يختبئ خلف المساعدة: مع المساعدة مغلقة يبقى أثر
     * الاستبدال والمسح ظاهرًا في موضعهما (التحقق والملخص قبل استبدال أي
     * بيانات؛ والمسح بعد نسخة مُتحقق منها) — عقد ٠٤٤ B1: «لا يُخفى أثر
     * الاستبدال خلف المساعدة» (نص النسخة الرجوع يظهر داخل المعاينة عند
     * وجودها — موضعه ليس خلف المساعدة بل في أثر الفعل نفسه). */
    expect(scope.getByText(/نعرض ملخصًا قبل استبدال أي بيانات/)).toBeTruthy();
    expect(scope.getByText(/يمسح كل بيانات هذا الجهاز بعد نسخة احتياطية مُتحقق منها/)).toBeTruthy();
  });
});

/* ─── 005/JRN-003: الثلاثية — الخطأ قرب الحقل، المدخلات تبقى، الإلغاء بلا كتابة ─── */

function saleServices() {
  const saveDraft = vi.fn().mockResolvedValue({ ok: true, value: { updatedAt: "2026-11-04T12:00:00.000Z" } });
  const record = vi.fn();
  mockedUsePrototypeServices.mockReturnValue({
    formDrafts: {
      read: vi.fn().mockResolvedValue({ ok: true, value: null }),
      save: saveDraft,
      discard: vi.fn().mockResolvedValue({ ok: true, value: null }),
    },
    catalog: { list: vi.fn().mockResolvedValue({ ok: true, items: [] }) },
    directSales: { record },
    cashContinuity: { overview: vi.fn().mockResolvedValue({ ok: true, value: { wallets: [] } }) },
    saleCollectionReversal: {
      listReversibleCollections: vi.fn().mockResolvedValue({ ok: true, value: [] }),
      preview: vi.fn(),
      reverse: vi.fn(),
    },
    projectFinance: { distributeUnallocated: vi.fn() },
    notifyDataChanged: vi.fn(),
  } as unknown as ReturnType<typeof usePrototypeServices>);
  return { saveDraft, record };
}

describe("SDF-068 (S18) — بيع مباشر: الخطأ قرب حقله والمدخلات تبقى والإلغاء بلا كتابة (005/JRN-003)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    wouterMocks.location = "/direct-sales/new";
    wouterMocks.navigate.mockReset();
  });
  afterEach(cleanup);

  it("الثلاثية الكاملة على سطح واحد: رفض صادق قرب الحقل بلا استدعاء، ومسودة تحفظ المدخلات، ولا كتابة بلا تأكيد", async () => {
    const { saveDraft, record } = saleServices();
    render(
      <UnsavedChangesProvider navigate={wouterMocks.navigate}>
        <DirectSaleEditor />
      </UnsavedChangesProvider>,
    );
    await screen.findByRole("heading", { name: "تسجيل بيع مباشر" });

    /* ١ — الخطأ قرب حقله: قيمة جزئية فائضة تُرفض برسالة الحقل نفسها
     * (role=alert) وبلا أي استدعاء للخدمة. */
    fireEvent.change(screen.getByLabelText("إجمالي البيع — د.أ"), { target: { value: "12.00" } });
    fireEvent.click(screen.getByRole("radio", { name: /استلمت جزءًا والباقي دَين/ }));
    fireEvent.change(screen.getByLabelText("المقبوض الآن — د.أ"), { target: { value: "13.00" } });
    fireEvent.click(screen.getByRole("button", { name: "حفظ البيع المباشر" }));
    const fieldError = await screen.findByText(/المقبوض لا يتجاوز السعر المتفق عليه/);
    expect(fieldError.closest("[role='alert'], .micro-field-error")).not.toBeNull();
    expect(record).not.toHaveBeenCalled();

    /* ٢ — المدخلات تبقى حيث أمكن: الكتابة الصالحة تمر بآلية المسودة
     * القائمة (بيع جديد) فتبقى القيم عند الرجوع/الإلغاء لا تُفقد. */
    fireEvent.change(screen.getByLabelText("المقبوض الآن — د.أ"), { target: { value: "5.00" } });
    fireEvent.change(screen.getByLabelText("الكمية"), { target: { value: "2" } });
    await waitFor(() => expect(saveDraft).toHaveBeenCalled());
    /* واجهة الخدمة: save(formKind, scopeId, values, savedAt) — القيم في
     * المعامل الثالث. */
    const savedValues = saveDraft.mock.calls.at(-1)?.[2] as { quantity?: number };
    expect(savedValues?.quantity).toBe(2);

    /* ٣ — الإلغاء/عدم التأكيد لا يكتبان: ما زال المستخدم في النموذج بلا
     * تأكيد حفظ — لا استدعاء خدمة الكتابة إطلاقًا (البيع يسجل بقصد صريح
     * لا بمجرد الكتابة أو مغادرة الحقل). */
    expect(record).not.toHaveBeenCalled();
  });
});
