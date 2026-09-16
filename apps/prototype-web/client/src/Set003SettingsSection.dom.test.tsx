/** @vitest-environment jsdom */
/* إصلاح المتابعة (SET-003) — انحدار مركّز على السطح الذي فشل في CI:
 * صفحة الإعدادات تقسيّم «قدرات مشروعك» تُصيَّر عبر خدمات حقيقية موافقة
 * للعقد (التفضيلات + خدمات أعداد السجلات) لا عبر مضاعف يدوي ناقص؛
 * أي دالة مفقودة من خدمة تُقرأ هنا يجب أن تفشل بصوت عالٍ لا برفض
 * غير معالج صامت. التبديل نفسه يمر بالمخزن الحقيقي فيُثبت بقاء التفضيل. */
import React from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { usePrototypeServices } from "@/app/PrototypeServicesContext";
import { MemoryLocalStore } from "@/storage/local/MemoryLocalStore";
import { PreferenceService } from "@/application/preferences/preferenceService";
import { AgreementService } from "@/application/agreements/agreementService";
import { CostService } from "@/application/cost/costService";
import { InventoryMaterialService } from "@/application/inventory/inventoryMaterialService";
import { SupplierPurchaseService } from "@/application/suppliers/supplierPurchaseService";
import { CatalogService } from "@/application/catalog/catalogService";
import { LocalLockService } from "@/application/security/localLockService";
import { IntegrityCheckService } from "@/application/finance/integrityCheckService";
import { ProjectFinancialService } from "@/application/finance/projectFinancialService";
import { StatementService } from "@/application/finance/statementService";
import { CashContinuityService } from "@/application/cash/cashContinuityService";
import { FormDraftService } from "@/application/drafts/formDraftService";
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
const NOW = "2026-09-16T09:00:00.000Z";

describe("SET-003 follow-up — Settings capabilities section over contract-complete services", () => {
  let store: MemoryLocalStore;
  let preferences: PreferenceService;

  beforeEach(() => {
    vi.stubGlobal(
      "matchMedia",
      vi.fn().mockReturnValue({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() }),
    );
    store = new MemoryLocalStore();
    preferences = new PreferenceService(store, () => NOW);
    mockedUsePrototypeServices.mockReturnValue({
      localLock: new LocalLockService(store, () => NOW),
      formDrafts: new FormDraftService(store),
      integrityCheck: new IntegrityCheckService(
        store,
        new ProjectFinancialService(store, () => NOW),
        new StatementService(store, new ProjectFinancialService(store, () => NOW)),
        new CashContinuityService(store, () => NOW),
      ),
      preferences,
      agreements: new AgreementService(store, new CostService(store, () => NOW), () => NOW),
      inventory: new InventoryMaterialService(store, () => NOW),
      supplierPurchases: new SupplierPurchaseService(store, () => NOW),
      catalog: new CatalogService(store, () => NOW),
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

  it("renders the four capabilities through real services and persists a disable through the real store", async () => {
    render(
      <ThemeProvider defaultTheme="system" switchable>
        <Settings />
      </ThemeProvider>,
    );
    const section = await screen.findByTestId("capabilities-section");
    expect(section.textContent).toContain("قدرات مشروعك");
    /* القدرات الأربع كلها حاضرة — الأساس غير قابل للإيقاف. */
    expect(section.textContent).toContain("الطلبات والتنفيذ");
    expect(section.textContent).toContain("المواد والمخزون");
    expect(section.textContent).toContain("الموردون والمشتريات");
    expect(section.textContent).toContain("منتجاتي وخدماتي");
    expect(section.textContent).toContain("الأساس دائمًا مفعّل");

    /* إيقاف قدرة الطلبات — الزر الأول في الصف الأول. */
    const ordersRow = screen.getByText("الطلبات والتنفيذ").closest("section");
    expect(ordersRow).toBeTruthy();
    const toggle = ordersRow!.querySelector("button");
    expect(toggle!.textContent).toContain("إيقاف الإدخال");
    fireEvent.click(toggle!);
    await waitFor(() => expect(toggle!.textContent).toContain("تفعيل"));

    /* التفضيل عبر الخدمة الحقيقية والمخزن الحقيقي — لا وهم مضاعف. */
    const reread = await preferences.readDisabledCapabilities();
    if (!reread.ok) throw new Error(reread.message);
    expect(reread.disabled).toEqual(["orders"]);
  });
});
