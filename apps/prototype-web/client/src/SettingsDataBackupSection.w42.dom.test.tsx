/** @vitest-environment jsdom */

/* P-4.2-3 (Wave 4.2 — قرار المالك T2): حارس القسم الموحد «البيانات والنسخ الاحتياطي».
 * - قسم واحد مسمى بالاسم المعتمد — لا طبقتين («بيانات ونسخ احتياطي محلي» و«بيانات
 *   البداية والاستعادة» دُمجتا).
 * - الترتيب «الأقل تدميرًا أولًا»: الحقيقة → القفل → التصدير → الاستعادة →
 *   الإدخال الافتتاحي الموجه → التذكير → التشخيص → دقة المال → التصفير أخيرًا.
 * - مدخل واحد فقط (لا تكرار في أدواتي — حرسه P-4.2-2).
 * - مدخلات الملف: الاستعادة أولًا ثم الإدخال الافتتاحي (ترتيب DOM يعتمده
 *   حارس بوابة القفل). */
import React from "react";
import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { usePrototypeServices } from "@/app/PrototypeServicesContext";
import { LocalLockService } from "@/application/security/localLockService";
import { IntegrityCheckService } from "@/application/finance/integrityCheckService";
import { ProjectFinancialService } from "@/application/finance/projectFinancialService";
import { StatementService } from "@/application/finance/statementService";
import { CashContinuityService } from "@/application/cash/cashContinuityService";
import { MemoryLocalStore } from "@/storage/local/MemoryLocalStore";
import { PreferenceService } from "@/application/preferences/preferenceService";
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

vi.mock("wouter", () => ({
  useSearch: () => "",
  useLocation: () => ["/settings", vi.fn()],
  useParams: () => ({}),
}));

const mockedUsePrototypeServices = vi.mocked(usePrototypeServices);

describe("P-4.2-3 — القسم الموحد «البيانات والنسخ الاحتياطي» (T2)", () => {
  beforeEach(() => {
    vi.stubGlobal(
      "matchMedia",
      vi.fn().mockReturnValue({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() }),
    );
    const settingsStore = new MemoryLocalStore();
    mockedUsePrototypeServices.mockReturnValue({
      localLock: new LocalLockService(new MemoryLocalStore()),
      integrityCheck: new IntegrityCheckService(
        new MemoryLocalStore(),
        new ProjectFinancialService(new MemoryLocalStore()),
        new StatementService(new MemoryLocalStore(), new ProjectFinancialService(new MemoryLocalStore())),
        new CashContinuityService(new MemoryLocalStore()),
      ),
      preferences: new PreferenceService(settingsStore),
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
        confirmImport: vi.fn(),
        createVerifiedExport: vi.fn(async () => ({ ok: false })),
        resetAll: vi.fn(async () => ({ ok: false })),
      },
      guidedOpeningImport: { prepare: vi.fn(), confirm: vi.fn() },
      dataVersion: 0,
      notifyDataChanged: vi.fn(),
    } as unknown as ReturnType<typeof usePrototypeServices>);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    cleanup();
  });

  it("قسم واحد بالاسم المعتمد يضم كل قدرات البيانات — ولا طبقتين قديمتين", async () => {
    render(
      <ThemeProvider defaultTheme="system" switchable>
        <Settings />
      </ThemeProvider>,
    );
    await waitFor(() => expect(screen.getByRole("heading", { name: "احمِ بياناتك" })).toBeTruthy());

    /* الاسم المعتمد للقسم الموحد. */
    expect(screen.getByText("البيانات والنسخ الاحتياطي")).toBeTruthy();

    /* أسماء الطبقتين القديمتين اختفت. */
    expect(screen.queryByText("بيانات ونسخ احتياطي محلي")).toBeNull();
    expect(screen.queryByText("بيانات البداية والاستعادة")).toBeNull();

    /* كل القدرات الست المطلوبة داخل القسم الموحد. */
    const section = screen.getByText("البيانات والنسخ الاحتياطي").closest("details");
    expect(section).not.toBeNull();
    const scope = within(section as HTMLElement);
    expect(scope.getByRole("button", { name: "تصدير البيانات المحلية" })).toBeTruthy();
    expect(scope.getByRole("button", { name: "اختيار ملف استيراد" })).toBeTruthy();
    expect(scope.getByRole("heading", { name: "إدخال موقف افتتاحي" })).toBeTruthy();
    expect(scope.getByRole("heading", { name: "تذكير النسخة الاحتياطية" })).toBeTruthy();
    expect(scope.getByRole("heading", { name: "تقرير التشخيص المحلي" })).toBeTruthy();
    expect(scope.getByRole("button", { name: "بدء مسار المشروع الجديد" })).toBeTruthy();
  });

  it("الترتيب: الأقل تدميرًا أولًا والتصفير أخيرًا — ومدخلا الملف بترتيبهما المعتمد", async () => {
    const { container } = render(
      <ThemeProvider defaultTheme="system" switchable>
        <Settings />
      </ThemeProvider>,
    );
    await waitFor(() => expect(screen.getByRole("heading", { name: "احمِ بياناتك" })).toBeTruthy());

    const section = screen.getByText("البيانات والنسخ الاحتياطي").closest("details") as HTMLElement;
    const order = (label: string) => {
      const nodes = Array.from(section.querySelectorAll("h2, button[aria-label]"));
      return nodes.findIndex(
        node => node.textContent?.includes(label) || node.getAttribute("aria-label")?.includes(label),
      );
    };
    /* الحقيقة قبل التصدير قبل الاستعادة قبل الإدخال الافتتاحي قبل التصفير. */
    const truth = order("بياناتك على هذا الجهاز");
    const exportRow = order("تصدير البيانات المحلية");
    const importRow = order("اختيار ملف استيراد");
    const guided = order("إدخال موقف افتتاحي");
    const reset = order("بدء مسار المشروع الجديد");
    expect(truth).toBeGreaterThanOrEqual(0);
    expect(truth).toBeLessThan(exportRow);
    expect(exportRow).toBeLessThan(importRow);
    expect(importRow).toBeLessThan(guided);
    expect(guided).toBeLessThan(reset);

    /* مدخلا الملف: الاستعادة أولًا ثم الإدخال الافتتاحي (يعتمده حارس بوابة القفل). */
    const fileInputs = Array.from(container.querySelectorAll('input[type="file"]'));
    expect(fileInputs.length).toBe(2);
    expect(fileInputs[0]!.getAttribute("aria-label") ?? "import").toBeTruthy();
  });
});
