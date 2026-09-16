/** @vitest-environment jsdom */

import React from "react";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
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

describe("Settings backup actions carry visible Arabic labels (U-11)", () => {
  beforeEach(() => {
    vi.stubGlobal(
      "matchMedia",
      vi.fn().mockReturnValue({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() }),
    );
    /* إصلاح المتابعة (SET-003): الخدمات الحقيقية عبر مخزن ذاكرة — مضاعفة
     * الاختبار موافقة للعقد بنيويًا، فأي دالة يفتقدها مضاعف يدوي صارت تفشل
     * هنا بصوت عالٍ بدل رفض غير معالج صامت (عطل CI 16 خطأ). */
    const settingsStore = new MemoryLocalStore();
    mockedUsePrototypeServices.mockReturnValue({
      /* المجموعة ٥: القفل المحلي وفحص السلامة بعد الاستعادة — موجودان في السياق الحقيقي. */
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

  it("labels the export and import actions in words, not icons alone", async () => {
    render(
      <ThemeProvider defaultTheme="system" switchable>
        <Settings />
      </ThemeProvider>,
    );
    await waitFor(() => expect(screen.getByRole("heading", { name: "احمِ بياناتك" })).toBeTruthy());

    const exportButton = screen.getByRole("button", { name: "تصدير البيانات المحلية" });
    const importButton = screen.getByRole("button", { name: "اختيار ملف استيراد" });
    expect(exportButton.textContent).toContain("تصدير");
    expect(importButton.textContent).toContain("استيراد");

    // The data-protection layer stands open, so the safest actions are not hidden.
    const layer = document.querySelector("details.micro-decision-layer");
    expect(layer).toBeTruthy();
    expect(layer!.hasAttribute("open")).toBe(true);
  });
});
