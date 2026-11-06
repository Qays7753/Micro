/** @vitest-environment jsdom */
/**
 * UXR-06 (F-011 — عقد SET): الإعدادات فهرس قصير — الاختيار يفتح مجموعته
 * ويعود للفهرس؛ كل إعداد قائم يصل إلى بيته؛ الوصلة العميقة ?focus=guided-import
 * تفتح مجموعة البيانات مباشرة. لا فئة فارغة ولا إعداد مالي جديد.
 *
 * ⚠️ مؤجل التشغيل بأمر المالك (أمر التنفيذ المتصل 2026-11-06 §6): يُكتب مع
 * التغيير ولا يُشغَّل إلا في التحقق الشامل بعد W05. */
import React from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { usePrototypeServices } from "@/app/PrototypeServicesContext";
import { ThemeProvider } from "@/contexts/ThemeContext";
import Settings from "@/pages/Settings";
import { IntegrityCheckService } from "@/application/finance/integrityCheckService";
import { ProjectFinancialService } from "@/application/finance/projectFinancialService";
import { StatementService } from "@/application/finance/statementService";
import { CashContinuityService } from "@/application/cash/cashContinuityService";
import { PreferenceService } from "@/application/preferences/preferenceService";
import { ProfileService } from "@/application/profile/profileService";
import { AgreementService } from "@/application/agreements/agreementService";
import { CostService } from "@/application/cost/costService";
import { InventoryMaterialService } from "@/application/inventory/inventoryMaterialService";
import { SupplierPurchaseService } from "@/application/suppliers/supplierPurchaseService";
import { CatalogService } from "@/application/catalog/catalogService";
import { MemoryLocalStore } from "@/storage/local/MemoryLocalStore";

vi.mock("@/app/PrototypeServicesContext", () => ({
  usePrototypeServices: vi.fn(),
}));

const mockedUsePrototypeServices = vi.mocked(usePrototypeServices);

let wouterSearch = "";
vi.mock("wouter", () => ({
  useSearch: () => wouterSearch,
  useLocation: () => ["/settings", vi.fn()],
  useParams: () => ({}),
}));

function mockServices() {
  const settingsStore = new MemoryLocalStore();
  mockedUsePrototypeServices.mockReturnValue({
    integrityCheck: new IntegrityCheckService(
      new MemoryLocalStore(),
      new ProjectFinancialService(new MemoryLocalStore()),
      new StatementService(new MemoryLocalStore(), new ProjectFinancialService(new MemoryLocalStore())),
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

describe("UXR-06 — F-011: الإعدادات فهرس قصير يفتح مجموعته ويعود", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    wouterSearch = "";
    vi.stubGlobal(
      "matchMedia",
      vi.fn().mockReturnValue({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() }),
    );
    mockServices();
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    cleanup();
  });

  it("الجذر فهرس فقط: أربع مجموعات، بلا فئة فارغة، ولا أقسام مفتوحة في الجذر", async () => {
    render(
      <ThemeProvider defaultTheme="system" switchable>
        <Settings />
      </ThemeProvider>,
    );
    expect(await screen.findByTestId("settings-group-project")).toBeTruthy();
    expect(screen.getByTestId("settings-group-usage")).toBeTruthy();
    expect(screen.getByTestId("settings-group-data")).toBeTruthy();
    expect(screen.getByTestId("settings-group-check")).toBeTruthy();
    /* لا قسم مفتوح في الجذر — الفهرس هو الجذر (F-011). */
    expect(screen.queryByTestId("capabilities-section")).toBeNull();
    expect(screen.queryByRole("button", { name: "حفظ نسخة" })).toBeNull();
    expect(screen.queryByRole("button", { name: "استعادة نسخة" })).toBeNull();
  });

  it("اختيار «البيانات والنسخ الاحتياطي» يفتح مجموعته ويصل كل إعداد قائم إليه، والرجوع يعيد الفهرس", async () => {
    render(
      <ThemeProvider defaultTheme="system" switchable>
        <Settings />
      </ThemeProvider>,
    );
    fireEvent.click(await screen.findByTestId("settings-group-data"));
    expect(await screen.findByRole("heading", { name: "النسخ الاحتياطي والاستعادة" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "حفظ نسخة" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "استعادة نسخة" })).toBeTruthy();
    expect(screen.getByRole("heading", { name: "استيراد بيانات البداية" })).toBeTruthy();
    /* الرجوع للفهرس يعيد فهرس المجموعات */
    fireEvent.click(screen.getByTestId("settings-back-to-index"));
    expect(await screen.findByTestId("settings-group-data")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "استعادة نسخة" })).toBeNull();
  });

  it("«فحص البيانات» يفتح مجموعته وحدها دون بقية الأقسام", async () => {
    render(
      <ThemeProvider defaultTheme="system" switchable>
        <Settings />
      </ThemeProvider>,
    );
    fireEvent.click(await screen.findByTestId("settings-group-check"));
    /* القسم موجود داخل مجموعته (مطويًا كصيانة يدوية) — والمجموعات الأخرى لا تظهر معه.
     * تصحيح مؤرخ 2026-11-06 (UXR-W05 — فحوص المرحلة النهائية): العنوان يطابق عنصرين
     * (سطر القسم <b> وعنوانه <h2>) فالمطابق بالنص وحده يجد اثنين — الدور الدقيق
     * (heading) يحسم التمييز، وهو المقصود فعلًا: القسم وعنوانه داخل مجموعته. */
    expect(await screen.findByRole("heading", { name: "فحص البيانات" })).toBeTruthy();
    expect(screen.queryByTestId("settings-group-data")).toBeNull();
    expect(screen.queryByRole("heading", { name: "النسخ الاحتياطي والاستعادة" })).toBeNull();
  });

  it("الوصلة العميقة ?focus=guided-import تفتح مجموعة البيانات مباشرة", async () => {
    wouterSearch = "?focus=guided-import";
    render(
      <ThemeProvider defaultTheme="system" switchable>
        <Settings />
      </ThemeProvider>,
    );
    expect(await screen.findByRole("heading", { name: "استيراد بيانات البداية" })).toBeTruthy();
    expect(screen.queryByTestId("settings-group-data")).toBeNull();
  });
});
